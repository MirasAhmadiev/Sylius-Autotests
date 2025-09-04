// pages/CheckoutPage.js
export class CheckoutPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // Address
    this.email = page.getByLabel(/^Email/i);
    this.first = page.getByLabel(/^First name/i);
    this.last = page.getByLabel(/^Last name/i);
    this.street = page.getByLabel(/^Street address/i);
    this.country = page.getByLabel(/^Country/i);
    this.city = page.getByLabel(/^City/i);
    this.postcode = page.getByLabel(/^Postcode/i);
    this.diffShipping = page.getByLabel(/Use different address for shipping/i)
      .or(page.getByRole('checkbox', { name: /Use different/i }));

    // Steps
    this.headingShipping = page.getByRole('heading', { name: /Shipping/i });
    this.headingPayment = page.getByRole('heading', { name: /Payment/i });
    this.headingComplete = page.getByRole('heading', { name: /Complete/i });

    // Shipping radios
    this.ups = page.getByLabel(/UPS/i);
    this.fedex = page.getByLabel(/FedEx/i);

    // Payment
    this.bankTransfer = page.getByLabel(/Bank transfer/i);

    // Complete
    this.placeOrder = page.getByRole('button', { name: /^Place order$/i });

    // Navigation
    this.nextBtn = page.getByRole('button', { name: /^Next$/i });
  }

  async fromCartClickCheckout() {
    await this.page.getByRole('button', { name: /^Checkout$/i }).click();
  }

  async fillAddress({ email, first, last, street, countryLabel, city, postcode }) {
    await this.email.fill(email);
    await this.first.fill(first);
    await this.last.fill(last);
    await this.street.fill(street);
    await this.country.selectOption({ label: countryLabel });
    await this.city.fill(city);
    await this.postcode.fill(postcode);
  }

  async toggleDifferentShipping(on = true) {
    if (on) await this.diffShipping.check().catch(() => {});
    else await this.diffShipping.uncheck().catch(() => {});
  }

  async next() {
    await this.nextBtn.click();
  }

  async onShipping() { await this.headingShipping.waitFor(); }
  async onPayment() { await this.headingPayment.waitFor(); }
  async onComplete() { await this.headingComplete.waitFor(); }

  async selectShipping(name /* 'UPS' | 'FedEx' */) {
    const map = { UPS: this.ups, FedEx: this.fedex };
    await (map[name] || this.ups).check();
  }

  async shippingTotals() {
    const money = (s) => Number(s.replace(/[^\d,.\-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
    const ship = ((await this.page.getByText(/Estimated shipping cost/i).locator('..').textContent()) || '');
    const order = ((await this.page.getByText(/Order total/i).locator('..').textContent()) || '');
    return { ship: money(ship), order: money(order) };
  }

  async selectBankTransfer() {
    if (await this.bankTransfer.count()) await this.bankTransfer.check();
  }

  async confirmOrder() {
    await this.placeOrder.click();
  }
}
