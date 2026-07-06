import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export class ProductPage {
  constructor(private readonly page: Page) {}

  async goto(handle: string): Promise<void> {
    await this.page.goto(`/products/${handle}`);
    await expect(this.page.getByRole('main').or(this.page.locator('body'))).toBeVisible();
  }

  async getTitle(): Promise<string> {
    const heading = this.page.getByRole('heading').first();
    await expect(heading).toBeVisible();
    return (await heading.textContent())?.trim() ?? '';
  }

  async getDisplayedPrice(): Promise<string> {
    const price = this.page
      .getByText(/\$\s?\d+([.,]\d{2})?/)
      .first()
      .or(this.page.locator('[data-testid*="price"]').first());
    await expect(price).toBeVisible();
    return (await price.textContent())?.trim() ?? '';
  }

  async selectVariant(label: string): Promise<void> {
    const option = this.page.getByRole('button', { name: new RegExp(label, 'i') });
    if (await option.count()) {
      await option.first().click();
      return;
    }

    const select = this.page.getByLabel(/size|variant|option/i).first();
    await select.selectOption({ label });
  }

  async addToCart(): Promise<void> {
    await this.addToCartButton().click();
    await expect(this.page.getByText(/added|cart|bag/i).first()).toBeVisible();
  }

  private addToCartButton(): Locator {
    return this.page.getByRole('button', { name: /add.*(cart|bag)/i }).first();
  }
}
