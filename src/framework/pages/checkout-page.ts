import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Address, Customer } from '../utils/data-factory.js';

export class CheckoutPage {
  constructor(private readonly page: Page) {}

  async fillContact(customer: Customer): Promise<void> {
    await this.page.getByLabel(/email/i).fill(customer.email);
    await this.page.getByLabel(/phone/i).fill(customer.phone).catch(() => undefined);
  }

  async fillShipping(address: Address, customer: Customer): Promise<void> {
    await this.fillByLabel(/first name/i, customer.firstName);
    await this.fillByLabel(/last name/i, customer.lastName);
    await this.fillByLabel(/address/i, address.address1);
    await this.fillByLabel(/city/i, address.city);
    await this.fillByLabel(/state|province/i, address.province);
    await this.fillByLabel(/postal|zip/i, address.postalCode);

    const country = this.page.getByLabel(/country/i).first();
    if (await country.count()) {
      await country.selectOption(address.countryCode).catch(() => undefined);
    }
  }

  async selectShippingMethod(): Promise<void> {
    const method = this.page.getByRole('radio').first();
    if (await method.count()) {
      await method.check();
    }

    const continueButton = this.page.getByRole('button', { name: /continue|shipping/i }).first();
    if (await continueButton.count()) {
      await continueButton.click();
    }
  }

  async payWithTestCard(): Promise<void> {
    await this.fillByLabel(/card number/i, '4242424242424242', false);
    await this.fillByLabel(/expiry|expiration/i, '1230', false);
    await this.fillByLabel(/cvc|security/i, '123', false);
  }

  async getReviewLineItemPrice(title: string): Promise<string> {
    const row = this.page.getByText(title).locator('xpath=ancestor::*[self::tr or self::li or self::div][1]');
    const price = row.getByText(/\$\s?\d+([.,]\d{2})?/).first();
    await expect(price).toBeVisible();
    return (await price.textContent())?.trim() ?? '';
  }

  async placeOrder(): Promise<void> {
    await this.page.getByRole('button', { name: /place order|pay|complete/i }).first().click();
    await expect(this.page.getByText(/thank you|order|confirmation/i).first()).toBeVisible();
  }

  async getConfirmationOrderNumber(): Promise<string> {
    const confirmation = this.page.getByText(/order\s*#?\s*[a-z0-9_-]+/i).first();
    await expect(confirmation).toBeVisible();
    return (await confirmation.textContent())?.trim() ?? '';
  }

  private async fillByLabel(pattern: RegExp, value: string, required = true): Promise<void> {
    const field = this.page.getByLabel(pattern).first();
    if (await field.count()) {
      await field.fill(value);
      return;
    }

    if (required) {
      throw new Error(`Missing checkout field matching ${pattern}`);
    }
  }
}
