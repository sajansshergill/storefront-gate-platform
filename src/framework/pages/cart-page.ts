import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class CartPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/cart');
    await expect(this.page.getByRole('main').or(this.page.locator('body'))).toBeVisible();
  }

  async getLineItemPrice(title: string): Promise<string> {
    const row = this.page.getByText(title).locator('xpath=ancestor::*[self::tr or self::li or self::div][1]');
    const price = row.getByText(/\$\s?\d+([.,]\d{2})?/).first();
    await expect(price).toBeVisible();
    return (await price.textContent())?.trim() ?? '';
  }

  async getQuantity(title: string): Promise<number> {
    const row = this.page.getByText(title).locator('xpath=ancestor::*[self::tr or self::li or self::div][1]');
    const quantity = row.getByLabel(/quantity/i).or(row.locator('input[type="number"]')).first();
    await expect(quantity).toBeVisible();
    return Number(await quantity.inputValue());
  }

  async getSubtotal(): Promise<string> {
    const subtotal = this.page
      .getByText(/subtotal/i)
      .locator('xpath=ancestor::*[self::tr or self::li or self::div][1]')
      .getByText(/\$\s?\d+([.,]\d{2})?/)
      .first();
    await expect(subtotal).toBeVisible();
    return (await subtotal.textContent())?.trim() ?? '';
  }

  async proceedToCheckout(): Promise<void> {
    await this.page.getByRole('button', { name: /checkout|continue/i }).or(
      this.page.getByRole('link', { name: /checkout|continue/i }),
    ).first().click();
    await expect(this.page).toHaveURL(/checkout|cart/);
  }
}
