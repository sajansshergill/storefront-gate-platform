# LoadRunner ↔ k6 Equivalency

The role asks for **LoadRunner** specifically. LoadRunner is proprietary and not
freely available for a public portfolio, so the load layer of this platform is
built in **k6** (`tests/load/flash-sale.js`). This document maps the concepts
one-to-one to show the competency transfers directly — the modeling, the metrics,
and the analysis are identical; only the vendor tooling differs.

## Concept mapping

| LoadRunner | k6 (this project) | Notes |
|---|---|---|
| VUser | Virtual User (VU) | The concurrent simulated shopper. |
| VUser script (Action.c) | The `default function` in `flash-sale.js` | The per-user journey: browse → cart → checkout. |
| Transactions (`lr_start_transaction` / `lr_end_transaction`) | `group()` blocks + custom `Trend` metrics | `checkout_latency`, `add_to_cart_latency` are the named, measured business transactions. |
| Rendezvous points (`lr_rendezvous`) | `ramping-vus` spike stage | The `target: 300` spike stage simulates everyone hitting the sale at once. |
| Controller — scenario schedule | `scenarios` + `stages` | Ramp-up, sustained peak, ramp-down are declared as stages. |
| Runtime settings — think time | `sleep()` with randomization | Models real user pacing between steps. |
| Pacing | Loop iteration cadence under the executor | Governed by the ramping-vus executor. |
| SLA (in Analysis) | `thresholds` | `p(95)<800`, `p(99)<1500`, `funnel_errors rate<0.01`. Thresholds are the pass/fail gate. |
| Analysis — percentile graphs | k6 summary + `--summary-export` JSON | Feeds the Streamlit dashboard's p95/p99 tiles. |
| Parameterization (data files) | `__ENV` vars + randomized product selection | Environment-driven, seeded product handles. |
| Correlation (capturing dynamic values) | Capturing `cart.id` / `variant_id` from JSON responses | Same technique: extract a server-generated ID from one response, feed the next request. |

## What "peak traffic without degradation" means here

The flash-sale scenario ramps to **300 concurrent VUs** and holds for two minutes
— the sustained-peak window is the real test. The build **fails** if:

- p95 of any request exceeds 800 ms, or p99 exceeds 1500 ms
- checkout p95 exceeds 1200 ms (checkout is heavier, so a looser but explicit bar)
- more than 1% of funnel steps error

These thresholds are the k6 equivalent of a LoadRunner Analysis SLA: the load
test isn't "did it run," it's "did it stay within the contract under stress."

## Migrating this to LoadRunner

If a team standardizes on LoadRunner, the port is mechanical:

1. Each `group()` becomes an `lr_start_transaction` / `lr_end_transaction` pair.
2. The captured `cart.id` / `variant_id` become correlation rules (`web_reg_save_param`).
3. The `stages` schedule becomes a Controller scenario with the same ramp profile.
4. The `thresholds` become SLA definitions in Analysis.

The analytical skill — choosing the ramp profile, picking the transactions to
measure, reading percentiles under load, and setting defensible SLAs — is the
part that matters, and it is fully demonstrated here.