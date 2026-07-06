import { test, expect } from '../../src/framework/fixtures/test-fixtures.js';
import { newCustomer } from '../../src/framework/utils/data-factory.js';

test.describe('account management', () => {
  test('shopper can register and log back in @smoke', async ({ accountPage, page }) => {
    const customer = newCustomer();

    await accountPage.register(customer);
    expect(await accountPage.isLoggedIn()).toBe(true);

    await page.getByRole('link', { name: /logout|sign out/i }).or(
      page.getByRole('button', { name: /logout|sign out/i }),
    ).first().click();

    await accountPage.login(customer);
    expect(await accountPage.isLoggedIn()).toBe(true);
  });
});
