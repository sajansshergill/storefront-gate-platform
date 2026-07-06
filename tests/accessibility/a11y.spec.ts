import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import type { AxeResults } from 'axe-core';

/**
 * Accessibility gate — WCAG 2.1 AA scans on consumer-facing pages.
 *
 * The role lists accessibility testing as a bonus; for a consumer eCommerce
 * brand it's also a legal and reputational risk surface. These run in CI on the
 * PR gate, so a change that introduces a serious contrast or ARIA violation on
 * the storefront can't merge silently.
 *
 * We fail on 'serious' and 'critical' impacts only — 'minor'/'moderate' are
 * reported as warnings so the gate stays actionable rather than noisy.
 */

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'product-detail', path: '/products/medusa-sweatpants' },
  { name: 'cart', path: '/cart' },
];

const BLOCKING_IMPACTS = ['serious', 'critical'];

for (const { name, path } of PAGES) {
  test(`${name} has no serious or critical a11y violations @a11y`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const results: AxeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = results.violations.filter((v) =>
      BLOCKING_IMPACTS.includes(v.impact ?? ''),
    );

    // Human-readable failure output: which rule, where, and how to fix.
    if (blocking.length > 0) {
      const summary = blocking
        .map((v) => `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n    ${v.helpUrl}`)
        .join('\n');
      console.log(`\nA11y violations on ${name}:\n${summary}\n`);
    }

    expect(blocking, `serious/critical WCAG violations on ${name}`).toEqual([]);
  });
}