import { test as base, expect } from '@playwright/test';
import { AccountPage } from '../pages/account-page.js';
import { CartPage } from '../pages/cart-page.js';
import { CheckoutPage } from '../pages/checkout-page.js';
import { ProductPage } from '../pages/product-page.js';
import { DbClient } from '../utils/db-client.js';

type GateFixtures = {
  accountPage: AccountPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  db: DbClient;
  productPage: (handle: string) => Promise<ProductPage>;
};

export const test = base.extend<GateFixtures>({
  accountPage: async ({ page }, use) => {
    await use(new AccountPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  db: async ({}, use) => {
    const db = new DbClient();
    await use(db);
    await db.dispose();
  },
  productPage: async ({ page }, use) => {
    await use(async (handle: string) => {
      const product = new ProductPage(page);
      await product.goto(handle);
      return product;
    });
  },
});

export { expect };
