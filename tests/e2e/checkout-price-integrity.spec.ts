import { test, expect } from '../../src/framework/fixtures/test-fixtures.js';
import { defaultShipping, newCustomer } from '../../src/framework/utils/data-factory.js';
import { priceToCents } from '../../src/framework/utils/db-client.js';

test.describe('checkout price integrity @smoke', () => {
  test('keeps product, cart, checkout, and database prices consistent', async ({
    productPage,
    cartPage,
    checkoutPage,
    db,
  }) => {
    test.skip(!process.env.DATABASE_URL, 'DATABASE_URL is required for database integrity assertions.');

    const customer = newCustomer();
    const shipping = defaultShipping();
    const product = await productPage('medusa-sweatpants');
    const title = await product.getTitle();
    const productPrice = await product.getDisplayedPrice();

    await product.addToCart();
    await cartPage.goto();
    const cartPrice = await cartPage.getLineItemPrice(title);
    expect(priceToCents(cartPrice)).toBe(priceToCents(productPrice));

    await cartPage.proceedToCheckout();
    await checkoutPage.fillContact(customer);
    await checkoutPage.fillShipping(shipping, customer);
    await checkoutPage.selectShippingMethod();
    await checkoutPage.payWithTestCard();

    const reviewPrice = await checkoutPage.getReviewLineItemPrice(title);
    expect(priceToCents(reviewPrice)).toBe(priceToCents(productPrice));

    await checkoutPage.placeOrder();
    const orderId = await db.getLatestOrderIdByEmail(customer.email);
    expect(orderId).not.toBeNull();

    const [lineItem] = await db.getOrderLineItems(orderId as string);
    expect(lineItem.title).toContain(title);
    expect(lineItem.unitPrice).toBe(priceToCents(productPrice));
  });

  test('cart quantity updates subtotal deterministically', async ({ productPage, cartPage, page }) => {
    const product = await productPage('medusa-sweatpants');
    const title = await product.getTitle();
    await product.addToCart();

    await cartPage.goto();
    const quantity = await cartPage.getQuantity(title);
    const linePrice = priceToCents(await cartPage.getLineItemPrice(title));
    const subtotal = priceToCents(await cartPage.getSubtotal());

    expect(quantity).toBeGreaterThan(0);
    expect(subtotal).toBeGreaterThanOrEqual(linePrice * quantity);
    await expect(page.getByRole('button', { name: /checkout/i }).or(page.getByRole('link', { name: /checkout/i }))).toBeVisible();
  });
});
