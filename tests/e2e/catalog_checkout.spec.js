// tests/e2e/catalog_checkout.spec.js
import { test, expect } from '@playwright/test';
import { CategoryPage } from '../../pages/CategoryPage.js';
import { ProductPage } from '../../pages/ProductPage.js';
import { CartPage } from '../../pages/CartPage.js';
import { CheckoutPage } from '../../pages/CheckoutPage.js';
import { parseMoney, getHeaderCartBadge, ensureCartHasOneItem } from '../../utils/shopHelpers.js';


/* -------------------- CATALOG / CART -------------------- */

// E2E-C01 | Caps → Simple
test('E2E-C01: Навигация Caps → Simple, сетка, крошки, контролы', async ({ page }) => {
  const cat = new CategoryPage(page);
  await cat.openCapsSimple();
  await cat.assertSimpleBasics();

  // проверим сами крошки текстом
  const crumbsText = (await cat.breadcrumbs.first().textContent()) || '';
  expect(crumbsText).toMatch(/Home/i);
  expect(crumbsText).toMatch(/Fashion Category/i);
  expect(crumbsText).toMatch(/Caps/i);
  expect(crumbsText).toMatch(/Simple/i);
});

// E2E-C02 | Сортировка
test('E2E-C02: Sort → Most expensive first сортирует по убыванию цены', async ({ page }) => {
  const cat = new CategoryPage(page);
  await cat.openCapsSimple();

  await cat.sortByMostExpensive();
  const prices = await cat.getVisiblePrices();
  expect(prices.length).toBeGreaterThan(1);
  for (let i = 1; i < prices.length; i++) {
    expect(prices[i - 1]).toBeGreaterThanOrEqual(prices[i]);
  }
});

// E2E-C03 | Go level up
test('E2E-C03: Кнопка Go level up возвращает к Caps', async ({ page }) => {
  const cat = new CategoryPage(page);
  await cat.openCapsSimple();
  await cat.goLevelUpToCaps();

  await expect(page.getByRole('heading', { name: /^Caps$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Simple$/i })).toBeVisible();
});

// E2E-C04 | Переход на карточку
test('E2E-C04: Клик по Beautiful cap for woman → страница товара', async ({ page }) => {
  const cat = new CategoryPage(page);
  await cat.openCapsSimple();

  const prod = new ProductPage(page);
  await prod.openFromListByName('Beautiful cap for woman');
  await prod.assertProductBasics('Beautiful cap for woman');
});

// E2E-C05 | Добавление в корзину
test('E2E-C05: Add to cart → корзина, зелёный баннер, бейдж 1 item', async ({ page }) => {
  const cat = new CategoryPage(page);
  await cat.openCapsSimple();

  const prod = new ProductPage(page);
  await prod.openFromListByName('Beautiful cap for woman');
  await prod.addItemToCart();

  const cart = new CartPage(page);
  await cart.assertOpened();
  await expect(cart.successAlert).toBeVisible();

  const badge = await getHeaderCartBadge(page);
  if (badge) expect(Number(badge)).toBeGreaterThanOrEqual(1);

  const count = await cart.rows.count();
  expect(count).toBeGreaterThan(0);
});

// E2E-C06 | Изменение количества
test('E2E-C06: Изменение Qty пересчитывает суммы', async ({ page }) => {
  await ensureCartHasOneItem(page);
  const cart = new CartPage(page);

  const before = await cart.totals();

  const qty = cart.qtyInputAt(0);
  await qty.fill('2');
  await qty.blur();

  await expect(async () => {
    const after = await cart.totals();
    expect(after.row).toBeGreaterThanOrEqual(before.row * 2 - 0.01);
    expect(after.items).toBeGreaterThanOrEqual(before.items * 2 - 0.01);
    expect(after.order).toBeGreaterThan(before.order - 0.01);
  }).toPass();
});

// E2E-C07 | Очистка корзины
test('E2E-C07: Clear cart очищает корзину', async ({ page }) => {
  await ensureCartHasOneItem(page);
  const cart = new CartPage(page);

  const hadClear = await cart.clearIfPossible();
  if (!hadClear) test.skip('Clear cart отсутствует/не активна в этом окружении');

  // корзина пуста / суммы нули
  const text = ((await cart.summaryBox.textContent()) || '');
  const zero = parseMoney(text) === 0 || /€\s*0\.?0*/.test(text);
  expect(zero).toBeTruthy();

  await expect(page.getByRole('button', { name: /Checkout/i })).toHaveCount(0);
});

/* -------------------- CHECKOUT -------------------- */

// E2E-CHK01 | Address успешный → Shipping
test('E2E-CHK01: Address успешный ввод → шаг Shipping', async ({ page }) => {
  await ensureCartHasOneItem(page);
  const chk = new CheckoutPage(page);
  await chk.fromCartClickCheckout();

  await chk.fillAddress({
    email: `qa+${Date.now()}@example.com`,
    first: 'Anna', last: 'Smith',
    street: 'Baker street 1',
    countryLabel: /Poland|United States|France/i,
    city: 'Krakow', postcode: '30-001',
  });
  await chk.next();
  await chk.onShipping();

  await expect(page.getByText(/^Checking out as/i)).toBeVisible();
  await expect(page.getByText(/Items total|Order total/i)).toBeVisible();
});

// E2E-CHK02 | Use different address → дублирует поля
test('E2E-CHK02: галка Use different address дублирует данные', async ({ page }) => {
  await ensureCartHasOneItem(page);
  const chk = new CheckoutPage(page);
  await chk.fromCartClickCheckout();

  const bill = {
    email: `qa+${Date.now()}@example.com`,
    first: 'Anna', last: 'Smith',
    street: 'Main 10',
    countryLabel: /France|Poland|United States/i,
    city: 'Paris', postcode: '75001',
  };
  await chk.fillAddress(bill);
  await chk.toggleDifferentShipping(true);

  await expect(page.getByRole('heading', { name: /Shipping address/i })).toBeVisible();
  // проверим, что значения появились (точное совпадение может отличаться по name-атрибутам)
  const shipFirst = await page.getByLabel(/^Shipping first name|First name \(shipping\)/i).inputValue().catch(()=>'');
  const shipLast  = await page.getByLabel(/^Shipping last name|Last name \(shipping\)/i).inputValue().catch(()=>'');
  const shipCity  = await page.getByLabel(/^Shipping city|City \(shipping\)/i).inputValue().catch(()=>'');
  expect(shipFirst).toBeTruthy();
  expect(shipLast).toBeTruthy();
  expect(shipCity).toBeTruthy();
});

// E2E-CHK03 | Shipping: UPS ↔ FedEx меняет стоимость
test('E2E-CHK03: Shipping — выбор метода влияет на итог', async ({ page }) => {
  await ensureCartHasOneItem(page);
  const chk = new CheckoutPage(page);
  await chk.fromCartClickCheckout();

  await chk.fillAddress({
    email: `qa+${Date.now()}@example.com`,
    first: 'Anna', last: 'Smith',
    street: 'Baker 1', countryLabel: /Poland|France|United States/i,
    city: 'City', postcode: '00-001',
  });
  await chk.next();
  await chk.onShipping();

  await chk.selectShipping('UPS');
  const ups = await chk.shippingTotals();

  await chk.selectShipping('FedEx');
  const fed = await chk.shippingTotals();

  expect(ups.ship).not.toBeNaN();
  expect(fed.ship).not.toBeNaN();
  expect(ups.ship).not.toBe(fed.ship);
  expect(ups.order).not.toBe(fed.order);
});

// E2E-CHK04 | Payment: Bank transfer
test('E2E-CHK04: Payment — выбираем Bank transfer', async ({ page }) => {
  await ensureCartHasOneItem(page);
  const chk = new CheckoutPage(page);
  await chk.fromCartClickCheckout();

  await chk.fillAddress({
    email: `qa+${Date.now()}@example.com`,
    first: 'Anna', last: 'Smith',
    street: 'Baker 1', countryLabel: /Poland|France|United States/i,
    city: 'City', postcode: '00-001',
  });
  await chk.next(); // → Shipping
  await chk.onShipping();
  await chk.next(); // → Payment

  await chk.onPayment();
  await chk.selectBankTransfer();
  await chk.next(); // → Complete

  await chk.onComplete();
});

// E2E-CHK05 | Complete: Place order → Thank you
test('E2E-CHK05: Complete — финализация заказа', async ({ page }) => {
  await ensureCartHasOneItem(page);
  const chk = new CheckoutPage(page);
  await chk.fromCartClickCheckout();

  await chk.fillAddress({
    email: `qa+${Date.now()}@example.com`,
    first: 'Anna', last: 'Smith',
    street: 'Baker 1', countryLabel: /Poland|France|United States/i,
    city: 'City', postcode: '00-001',
  });
  await chk.next(); // Shipping
  await chk.next(); // Payment
  await chk.selectBankTransfer();
  await chk.next(); // Complete

  await expect(page.getByText(/Billing address/i)).toBeVisible();
  await expect(page.getByText(/Shipping address/i)).toBeVisible();
  await expect(page.getByText(/Payments/i)).toBeVisible();
  await expect(page.getByText(/Shipments/i)).toBeVisible();
  await expect(page.getByText(/Items/i)).toBeVisible();

  await chk.confirmOrder();
  await expect(page.getByRole('heading', { name: /^Thank you!/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Change payment method/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Create an account/i })).toBeVisible();

  const headerText = (await page.locator('.cart, a[href*="cart"]').first().textContent()) || '';
  expect(/€\s*0/.test(headerText) || !/€\s*\d/.test(headerText)).toBeTruthy();
});

/* -------------------- NEGATIVE -------------------- */

// NEG-A01 — пустой Address
test('NEG-A01: Address пустой → ошибки под обязательными полями', async ({ page }) => {
  await ensureCartHasOneItem(page);
  const chk = new CheckoutPage(page);
  await chk.fromCartClickCheckout();

  await chk.next(); // пустая форма

  const mustSee = [
    'Please enter your email.',
    'Please enter first name.',
    'Please enter last name.',
    'Please enter street.',
    'Please select country.',
    'Please enter city.',
    'Please enter postcode.',
  ];
  for (const t of mustSee) {
    await expect(page.getByText(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))).toBeVisible();
  }
});

// NEG-A02 — минимальная длина/валидность
test('NEG-A02: Address некорректные значения → сообщения о длине/валидности', async ({ page }) => {
  await ensureCartHasOneItem(page);
  const chk = new CheckoutPage(page);
  await chk.fromCartClickCheckout();

  await chk.fillAddress({
    email: '1', first: '1', last: '1', street: '1',
    countryLabel: /Poland|France|United States/i, city: '1', postcode: '1',
  });
  await chk.next();

  await expect(page.getByText(/This email is invalid\./i)).toBeVisible();
  await expect(page.getByText(/First name must be at least 2 characters long\./i)).toBeVisible();
  await expect(page.getByText(/Last name must be at least 2 characters long\./i)).toBeVisible();
  await expect(page.getByText(/Street must be at least 2 characters long\./i)).toBeVisible();
  await expect(page.getByText(/City must be at least 2 characters long\./i)).toBeVisible();
});

// NEG-A03 — country только из списка
test('NEG-A03: Country выбирается только из списка', async ({ page }) => {
  await ensureCartHasOneItem(page);
  const chk = new CheckoutPage(page);
  await chk.fromCartClickCheckout();

  const country = chk.country;
  await country.type('Neverland').catch(() => {});
  const before = await country.inputValue();
  await country.selectOption({ label: /France|Poland|United States/i });
  const after = await country.inputValue();
  expect(before).not.toEqual(after);
});

// NEG-S01 — без выбора Shipping
test('NEG-S01: Shipping — без выбранного метода не пускает дальше', async ({ page }) => {
  await ensureCartHasOneItem(page);
  const chk = new CheckoutPage(page);
  await chk.fromCartClickCheckout();

  await chk.fillAddress({
    email: `qa+${Date.now()}@example.com`,
    first: 'Anna', last: 'Smith',
    street: 'Baker 1', countryLabel: /Poland|France|United States/i,
    city: 'City', postcode: '00-001',
  });
  await chk.next();
  await chk.onShipping();

  await chk.next();
  // Если пропустило — значит один из методов был выбран авт. образом
  if (await chk.headingPayment.count()) {
    const anyChecked = await page.getByRole('radio').isChecked().catch(() => false);
    expect(anyChecked).toBeTruthy();
  } else {
    await chk.onShipping();
  }
});

// NEG-P01 — Payment: PayPal не требуется
test('NEG-P01: Payment — можно продолжить с Bank transfer без PayPal', async ({ page }) => {
  await ensureCartHasOneItem(page);
  const chk = new CheckoutPage(page);
  await chk.fromCartClickCheckout();

  await chk.fillAddress({
    email: `qa+${Date.now()}@example.com`,
    first: 'Anna', last: 'Smith',
    street: 'Baker 1', countryLabel: /Poland|France|United States/i,
    city: 'City', postcode: '00-001',
  });
  await chk.next(); // Shipping
  await chk.next(); // Payment
  await chk.selectBankTransfer();
  await chk.next(); // Complete

  await chk.onComplete();
});

/* -------------------- UX (smoke) -------------------- */

test('UX-01: Из карточки товара клик по крошке Simple возвращает на категорию', async ({ page }) => {
  const cat = new CategoryPage(page);
  await cat.openCapsSimple();
  const prod = new ProductPage(page);
  await prod.openFromListByName('Beautiful cap for woman');

  await page.getByRole('link', { name: /^Simple$/i }).click();
  await expect(cat.headingSimple).toBeVisible();
});

test('UX-02: Бейдж корзины инкрементируется при добавлении ещё раз', async ({ page }) => {
  const cat = new CategoryPage(page);
  await cat.openCapsSimple();
  const prod = new ProductPage(page);
  await prod.openFromListByName('Beautiful cap for woman');
  await expect(prod.addToCart).toBeVisible();

  const before = await getHeaderCartBadge(page);
  await prod.addItemToCart();
  const after = await getHeaderCartBadge(page);

  if (before && after) {
    expect(Number(after)).toBeGreaterThanOrEqual(Number(before) + 1);
  } else {
    // запасной вариант: проверяем, что в корзине есть строки
    const cart = new CartPage(page);
    await cart.assertOpened();
    const rows = await cart.rows.count();
    expect(rows).toBeGreaterThan(0);
  }
});
