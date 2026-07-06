import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

/**
 * flash-sale.js — Black Friday / flash-sale load model.
 *
 * Simulates the exact scenario the role cares about: a peak-traffic event where
 * a flood of shoppers hit browse -> cart -> checkout at once, and the platform
 * must hold latency and error rate without degradation.
 *
 * This is the k6 implementation of a LoadRunner scenario. See
 * docs/loadrunner-equivalency.md for the concept-by-concept mapping
 * (VUsers <-> VUs, Controller ramp schedule <-> stages, Analysis <-> thresholds/summary).
 *
 * Run:  k6 run tests/load/flash-sale.js
 *       k6 run -e STORE_API_URL=https://staging.example.com tests/load/flash-sale.js
 */

const STORE_API = __ENV.STORE_API_URL || 'http://localhost:9000';

// --- Custom metrics: the numbers you actually report after a load test ---
const checkoutLatency = new Trend('checkout_latency', true);
const addToCartLatency = new Trend('add_to_cart_latency', true);
const funnelErrors = new Rate('funnel_errors');
const ordersPlaced = new Counter('orders_placed');

export const options = {
  scenarios: {
    // A steady baseline of browsers, plus a sudden spike when the sale drops.
    flash_sale: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '1m', target: 50 },   // doors open — traffic climbs
        { duration: '30s', target: 300 },  // the sale drops — spike
        { duration: '2m', target: 300 },   // sustained peak (the real test)
        { duration: '1m', target: 50 },    // wind down
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  // Thresholds ARE the pass/fail gate. If these bust, the platform "degraded".
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1500'], // p95 < 800ms, p99 < 1.5s
    checkout_latency: ['p(95)<1200'],               // checkout is heavier; looser bar
    funnel_errors: ['rate<0.01'],                    // < 1% of funnel steps may fail
    http_req_failed: ['rate<0.02'],
  },
};

export default function () {
  let variantId;
  let cartId;

  group('01_browse_catalog', () => {
    const res = http.get(`${STORE_API}/store/products?limit=12`, {
      tags: { step: 'browse' },
    });
    const ok = check(res, {
      'catalog 200': (r) => r.status === 200,
      'catalog has products': (r) => (r.json('products') || []).length > 0,
    });
    funnelErrors.add(!ok);
    if (ok) {
      const products = res.json('products');
      const variants = products[Math.floor(Math.random() * products.length)].variants;
      variantId = variants && variants[0] && variants[0].id;
    }
    sleep(Math.random() * 2 + 1); // think time
  });

  group('02_create_cart', () => {
    const res = http.post(`${STORE_API}/store/carts`, '{}', {
      headers: { 'Content-Type': 'application/json' },
      tags: { step: 'create_cart' },
    });
    const ok = check(res, { 'cart created': (r) => r.status === 200 });
    funnelErrors.add(!ok);
    if (ok) cartId = res.json('cart.id');
    sleep(1);
  });

  group('03_add_to_cart', () => {
    if (!cartId || !variantId) {
      funnelErrors.add(true);
      return;
    }
    const res = http.post(
      `${STORE_API}/store/carts/${cartId}/line-items`,
      JSON.stringify({ variant_id: variantId, quantity: 1 }),
      { headers: { 'Content-Type': 'application/json' }, tags: { step: 'add_to_cart' } },
    );
    addToCartLatency.add(res.timings.duration);
    const ok = check(res, { 'item added': (r) => r.status === 200 });
    funnelErrors.add(!ok);
    sleep(Math.random() * 2 + 1);
  });

  group('04_checkout', () => {
    if (!cartId) {
      funnelErrors.add(true);
      return;
    }
    const res = http.post(
      `${STORE_API}/store/carts/${cartId}/complete`,
      '{}',
      { headers: { 'Content-Type': 'application/json' }, tags: { step: 'checkout' } },
    );
    checkoutLatency.add(res.timings.duration);
    const ok = check(res, {
      'checkout resolved': (r) => r.status === 200 || r.status === 400, // 400 = expected for unpaid demo cart
    });
    funnelErrors.add(!ok);
    if (res.status === 200) ordersPlaced.add(1);
  });
}