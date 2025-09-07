// pages/CheckoutPage.js
import { expect } from '@playwright/test';
export class CheckoutPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // Address form (обе разметки поддержаны: по name и по id)
    this.addrForm = page
      .locator('form[name="sylius_shop_checkout_address"], form[id^="sylius_checkout_address"]')
      .first();
    // алиас, чтобы не ломать существующие обращения
    this.addressForm = this.addrForm;

    this.bill = {
      email:   this.addrForm.locator('#sylius_shop_checkout_address_customer_email'),
      first:   this.addrForm.locator('#sylius_shop_checkout_address_billingAddress_firstName'),
      last:    this.addrForm.locator('#sylius_shop_checkout_address_billingAddress_lastName'),
      street:  this.addrForm.locator('#sylius_shop_checkout_address_billingAddress_street'),
      country: this.addrForm.locator('#sylius_shop_checkout_address_billingAddress_countryCode'),
      city:    this.addrForm.locator('#sylius_shop_checkout_address_billingAddress_city'),
      postcode:this.addrForm.locator('#sylius_shop_checkout_address_billingAddress_postcode'),
    };

    // чек-бокс "Use different address for shipping?"
    this.diffShip = this.page.getByRole('checkbox', { name: /Use different address/i }).first();

    // локаторы полей Shipping address (точечные, по id)
    this.ship = {
      first:    this.addrForm.locator('#sylius_shop_checkout_address_shippingAddress_firstName'),
      last:     this.addrForm.locator('#sylius_shop_checkout_address_shippingAddress_lastName'),
      street:   this.addrForm.locator('#sylius_shop_checkout_address_shippingAddress_street'),
      country:  this.addrForm.locator('#sylius_shop_checkout_address_shippingAddress_countryCode'),
      province: this.addrForm.locator('#sylius_shop_checkout_address_shippingAddress_provinceName'),
      city:     this.addrForm.locator('#sylius_shop_checkout_address_shippingAddress_city'),
      postcode: this.addrForm.locator('#sylius_shop_checkout_address_shippingAddress_postcode'),
      phone:    this.addrForm.locator('#sylius_shop_checkout_address_shippingAddress_phoneNumber'),
    };


    // Steps
    this.headingShipping   = page.getByRole('heading', { name: /(Shipping|Shipment)/i }).first();
    this.shippingForm      = page.locator('form[name="sylius_shop_checkout_select_shipping"]').first();
    this.shippingOptions   = page.getByRole('radio', { name: /(UPS|FedEx)/i });
    this.checkoutUserLink  = page.locator('a[href*="/account/dashboard"]').first(); // "Checking out as <email>"
    this.summaryHeading    = page.getByRole('heading', { name: /Summary/i }).first();
    this.orderTotalLabel   = page.getByText(/Order total/i).first();
    this.shippingRoute     = page.locator('body[data-route="sylius_shop_checkout_select_shipping"]');

    this.headingPayment  = page.getByRole('heading', { name: /Payment/i });
    // Complete: надёжная привязка по route + реальный h1
    this.completeRoute   = page.locator('body[data-route="sylius_shop_checkout_complete"]');
    this.headingComplete = page.getByRole('heading', { name: /Summary/i }).first();

    // Shipping radios
    this.shipUPS   = this.page.locator('input[name*="select_shipping"][type="radio"][value="ups"]').first();
    this.shipFedEx = this.page.locator('input[name*="select_shipping"][type="radio"][value="fedex"]').first();

    this.summaryBox = this.page.locator('.checkout-sidebar, .order-summary, aside .order-summary, .summary').first();
    this.summaryShipRow = this.page.getByText(/^Estimated shipping cost:/i).locator('..'); // строка с доставкой

    this.paymentRoute = page.locator('body[data-route="sylius_shop_checkout_select_payment"]');
    this.changeShipping = page
    .locator('a:has-text("Change shipping method"), button:has-text("Change shipping method")')
    .first();

    // Payment
    this.bankTransfer = page.getByLabel(/Bank transfer/i);

    // Complete
    this.placeOrder = page.getByRole('button', { name: /^Place order$/i });

    // Navigation
    this.nextBtn = page.getByRole('button', { name: /^Next$/i });
  }

  // Без exact:true — устойчиво к "Email *", "First name *" и локализациям
    errorUnder(labelText) {
    const esc = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re  = new RegExp(`^${esc}\\b`, 'i');

    return this.addrForm
      .locator('.field', { has: this.page.getByLabel(re) })
      .locator('.invalid-feedback')
      .first();
    }

  async fromCartClickCheckout() {
    await this.page.getByRole('button', { name: /^Checkout$/i }).click();
  }

  async selectCountryByLabel(labelOrRegex) {
  const sel = this.bill.country;

  // Если пришла строка — обычный путь
  if (typeof labelOrRegex === 'string') {
    await sel.selectOption({ label: labelOrRegex });
    return;
  }

  // Если пришёл RegExp — найдём подходящий <option> и выберем по value
  if (labelOrRegex instanceof RegExp) {
    const options = sel.locator('option');
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const opt = options.nth(i);
      const text = (await opt.textContent())?.trim() || '';
      if (labelOrRegex.test(text)) {
        const value = await opt.getAttribute('value');
        if (value) {
          await sel.selectOption(value);
          return;
        }
      }
    }
    throw new Error(`Country matching ${labelOrRegex} not found in select`);
  }

  throw new Error('countryLabel must be string or RegExp');
  }


  async fillAddress({ email, first, last, street, countryLabel, city, postcode }) {
    await this.bill.email.fill(email);
    await this.bill.first.fill(first);
    await this.bill.last.fill(last);
    await this.bill.street.fill(street);
    await this.selectCountryByLabel(countryLabel);
    await this.bill.city.fill(city);
    await this.bill.postcode.fill(postcode);
  }

  // включить/выключить «Use different address …» и дождаться состояния
  async toggleDifferentShipping(enable = true) {
    const target = !!enable;
    const now = await this.diffShip.isChecked().catch(() => false);
    if (now !== target) {
      await this.diffShip.setChecked(target);
    }

    // ждём, пока блок Shipping address реально (про)появится / спрячется
    const shouldBeVisible = target;
    await expect(async () => {
      const vis = await this.ship.first.isVisible().catch(() => false);
      expect(vis).toBe(shouldBeVisible);
    }).toPass({ timeout: 4000, intervals: [150, 300, 600] });
  }

   /** Запускает серверную валидацию адреса и ждёт появления ошибок */
  async submitAddressAndWaitValidation() {
    await Promise.all([
      this.page
        .waitForResponse(r => r.url().includes('/checkout/address')
          && r.request().method() === 'POST')
        .catch(() => null),
      this.next(), // сабмитим текущие значения формы
    ]);
    // подтверждаем, что хотя бы одна ошибка отрисована
    await this.addrForm.locator('.invalid-feedback').first().waitFor({ timeout: 5000 });
  }

  /** Заполняет минимально НЕвалидные значения (для проверок длины/валидности) */
  async fillAddressWithShortInvalids() {
    await this.fillAddress({
      email: '1',              // триггерит «invalid email»
      first: '1',
      last: '1',
      street: '1',
      countryLabel: /France|Poland|United States/i,
      city: '1',
      postcode: '1',
    });
  }

  /** Удобный ассертер ошибок под полями: принимает пары [label, regex] */
  async expectFieldErrors(pairs) {
    for (const [label, rx] of pairs) {
      const err = this.errorUnder(label);
      await expect(err).toBeVisible();
      await expect(err).toHaveText(rx);
    }
  }

  async waitShippingAddressSection() {
  await expect(async () => {
    const first = await this.ship.first.isVisible().catch(() => false);
    const city  = await this.ship.city.isVisible().catch(() => false);
    expect(first && city).toBeTruthy();
  }).toPass({ timeout: 3500, intervals: [120, 240, 480] });
  }

  async next() {
  const btn = this.page.getByRole('button', { name: /^Next/i }).first();
    await Promise.all([
      btn.click(),
      this.page.waitForLoadState('domcontentloaded').catch(() => {}),
    ]);
  }

  // Устойчиво подтверждаем, что шаг Shipping прорендерился
async assertShippingLoaded() {
  await expect(async () => {
    const routeOk   = (await this.shippingRoute.count().catch(() => 0)) > 0;
    const radiosOk  = (await this.shippingOptions.count().catch(() => 0)) > 0;
    const summaryOk = await this.summaryHeading.isVisible().catch(() => false);
    const totalOk   = await this.orderTotalLabel.isVisible().catch(() => false);
    const userOk    = (await this.checkoutUserLink.count().catch(() => 0)) > 0;

    // Достаточно: есть страница Shipping + варианты доставки + (Summary или Order total).
    // Баннер "Checking out as ..." учитываем как необязательный бонус.
    expect(routeOk && radiosOk && (summaryOk || totalOk || userOk)).toBeTruthy();
  }).toPass({ timeout: 4000, intervals: [150, 300, 600] });
}

  async onShipping() {
    await expect(async () => {
      const h = await this.headingShipping.isVisible().catch(() => false);
      const f = await this.shippingForm.isVisible().catch(() => false);
      const r = (await this.shippingOptions.count().catch(() => 0)) > 0;
      expect(h || f || r).toBeTruthy();
    }).toPass({ timeout: 4000, intervals: [150, 300, 600] });
  }

  async onPayment() { await this.headingPayment.waitFor(); }
  
  async onComplete() {
    await expect(async () => {
      const routeOk = (await this.completeRoute.count().catch(() => 0)) > 0;
      const hOk     = await this.headingComplete.isVisible().catch(() => false);
      const btnOk   = await this.placeOrder.isVisible().catch(() => false);
      // Достаточно: либо загрузился route, либо виден заголовок + кнопка Place order.
      expect(routeOk || (hOk && btnOk)).toBeTruthy();
    }).toPass({ timeout: 5000, intervals: [150, 300, 600] });
  }

  // приватный парсер денег
  #money(t = '') {
    const m = String(t)
      .replace(/[^\d.,-]/g, '')
      .replace(/\.(?=.*\.)/g, '')   // убрать лишние точки-разделители тысяч
      .replace(',', '.')
      .match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  }

  // прочитать "Estimated shipping cost"
  async readSummaryShipping() {
    const row = await this.summaryShipRow.textContent().catch(() => '');
    return this.#money(row);
  }

  // прочитать "Order total"
  async readSummaryOrder() {
    const txt = await this.summaryBox.textContent().catch(() => '');
    const m = txt.match(/Order total:\s*([^\n]+)/i);
    return this.#money(m?.[1] || '');
  }

  // текущее выбранное значение доставки: 'ups' | 'fedex' | null
  async #currentShippingValue() {
    const checked = this.page.locator('input[name*="select_shipping"][type="radio"]:checked').first();
    if (!(await checked.count())) return null;
    return (await checked.getAttribute('value')) || null;
  }

  async #clickShippingAndWait(value /* 'ups' | 'fedex' */) {
  // no-op, если уже выбран
  const checked = this.page.locator('input[name*="select_shipping"][type="radio"]:checked').first();
  const cur = (await checked.count()) ? (await checked.getAttribute('value')) : null;
  if (cur === value) return;

  // кликаем по label (надёжнее, чем по input)
  const radio = value === 'ups' ? this.shipUPS : this.shipFedEx;
  const id    = await radio.getAttribute('id');
  const label = this.page.locator(`label[for="${id}"]`).first();
  await label.click();

  // ждём PUT или то, что нужное радио стало checked
  await Promise.race([
    this.page
      .waitForResponse(r => /\/checkout\/select-shipping/.test(r.url()) && r.request().method() === 'PUT')
      .catch(() => {}),
    this.page.waitForFunction(v => {
      const el = document.querySelector(`input[name*="select_shipping"][type="radio"][value="${v}"]`);
      return !!(el && el.checked);
    }, value, { timeout: 5000 }).catch(() => {})
  ]);
  }

  async selectShippingUPS()   { await this.#clickShippingAndWait('ups'); }
  async selectShippingFedEx() { await this.#clickShippingAndWait('fedex'); }

  async #readTotalsOnPayment() {
  await this.onPayment();
  return {
    ship:  await this.readSummaryShipping(),
    order: await this.readSummaryOrder(),
  };
  }

  async #backToShippingFromPayment() {
    await this.changeShipping.click();
    await this.onShipping();
  }


  // (опционально) вернуть оба числа
  async shippingTotals() {
  const onShipping = (await this.shippingRoute.count()) > 0;

  if (onShipping) {
    await this.next();                 // сабмитим Shipping → пересчёт на Payment
    const totals = await this.#readTotalsOnPayment();
    await this.#backToShippingFromPayment(); // возвращаемся для дальнейших действий теста
    return totals;
  }

  // если уже на Payment — просто читаем
  return await this.#readTotalsOnPayment();
  }


  async selectBankTransfer() {
    if (await this.bankTransfer.count()) await this.bankTransfer.check();
  }

  async confirmOrder() {
    await this.placeOrder.click();
  }
}
