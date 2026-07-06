import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Customer } from '../utils/data-factory.js';

export class AccountPage {
  constructor(private readonly page: Page) {}

  async register(customer: Customer): Promise<void> {
    await this.page.goto('/account/register');
    await this.page.getByLabel(/first name/i).fill(customer.firstName);
    await this.page.getByLabel(/last name/i).fill(customer.lastName);
    await this.page.getByLabel(/email/i).fill(customer.email);
    await this.page.getByLabel(/^password$/i).fill(customer.password);
    await this.page.getByRole('button', { name: /register|create account|sign up/i }).click();
    await expect(this.page.getByText(/account|profile|logout/i).first()).toBeVisible();
  }

  async login(customer: Customer): Promise<void> {
    await this.page.goto('/account/login');
    await this.page.getByLabel(/email/i).fill(customer.email);
    await this.page.getByLabel(/password/i).fill(customer.password);
    await this.page.getByRole('button', { name: /log in|login|sign in/i }).click();
    await expect(this.page.getByText(/account|profile|logout/i).first()).toBeVisible();
  }

  async isLoggedIn(): Promise<boolean> {
    return this.page.getByText(/logout|profile|orders/i).first().isVisible();
  }

  async getMostRecentOrderNumber(): Promise<string | null> {
    await this.page.goto('/account/orders');
    const order = this.page.getByText(/order\s*#?\s*[a-z0-9_-]+/i).first();
    return (await order.count()) ? ((await order.textContent())?.trim() ?? null) : null;
  }
}
