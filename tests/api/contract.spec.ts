import { test, expect, request } from '@playwright/test';
import { Ajv } from 'ajv';
import { createRequire } from 'module';

/**
 * OpenAPI contract tests.
 *
 * The Newman collection covers functional behaviour; this layer enforces the
 * *contract* directly against JSON Schema so the backend can't drift from what
 * consumers (the storefront, mobile apps, partners) depend on. If a field is
 * renamed or a type changes, this fails before it reaches a customer.
 *
 * Schemas here are the source-of-truth slices of the store API's OpenAPI spec.
 * In a real repo these would be generated from the published openapi.json; they
 * are inlined here so the suite is self-contained.
 */

const STORE_API = process.env.STORE_API_URL ?? 'http://localhost:9000';

const ajv = new Ajv({ allErrors: true, strict: false });
const require = createRequire(import.meta.url);
const formatsPlugin = require('ajv-formats') as (instance: Ajv) => Ajv;
formatsPlugin(ajv);

const productListSchema = {
  type: 'object',
  required: ['products', 'count', 'offset', 'limit'],
  properties: {
    count: { type: 'integer' },
    offset: { type: 'integer' },
    limit: { type: 'integer' },
    products: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'variants'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          handle: { type: ['string', 'null'] },
          variants: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'title'],
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
} as const;

const cartSchema = {
  type: 'object',
  required: ['cart'],
  properties: {
    cart: {
      type: 'object',
      required: ['id', 'items', 'region_id'],
      properties: {
        id: { type: 'string' },
        region_id: { type: 'string' },
        items: { type: 'array' },
      },
    },
  },
} as const;

test.describe('API contract @smoke', () => {
  test('GET /store/products conforms to the product-list contract', async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${STORE_API}/store/products?limit=12`);
    expect(res.status()).toBe(200);

    const validate = ajv.compile(productListSchema);
    const body = await res.json();
    const valid = validate(body);
    expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
    await ctx.dispose();
  });

  test('POST /store/carts conforms to the cart contract', async () => {
    const ctx = await request.newContext();
    const res = await ctx.post(`${STORE_API}/store/carts`, { data: {} });
    expect(res.status()).toBe(200);

    const validate = ajv.compile(cartSchema);
    const body = await res.json();
    const valid = validate(body);
    expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(true);
    await ctx.dispose();
  });
});