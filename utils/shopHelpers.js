// src/utils/shopHelpers.js
import CategoryPage from '../pages/CategoryPage.js';
import { gotoPath, Routes, openCart } from '../utils/nav.js';
import { dismissSyliusWidget } from '../utils/ui.js';

// Парсер цены в число (убираем валюты/разделители тысяч, запятую -> точка)
export function parseMoney(text) {
  if (!text) return NaN;
  const norm = String(text)
    .replace(/[^\d.,-]/g, '')        // только цифры и разделители
    .replace(/\.(?=\d{3}\b)/g, '')   // точка как разделитель тысяч
    .replace(',', '.');              // запятая как десятичный
  return Number(norm);
}

export async function waitCartEnter(page) {
  const until = Date.now() + 5000;

  while (Date.now() < until) {
    // 1) Баннер "Item has been added to cart"?
    const bannerVisible = await page.getByText(/Item has been added to cart/i)
      .first().isVisible().catch(() => false);
    if (bannerVisible) break;

    // 2) Бейдж стал "1"?
    const badge = await getHeaderCartBadge(page);        // теперь безопасно
    if (badge && /\b1\b/.test(badge)) break;

    // 3) Даём странице «перехватить» навигацию и стабилизироваться
    await page.waitForTimeout(150);
  }

  // Дальше — открываем корзину штатным способом
  await openCart(page);

  // И убеждаемся, что корзина готова
  await page.getByRole('heading', { name: /(Your shopping cart|Cart)/i })
    .first().waitFor({ timeout: 8000 });
  await page.locator('.order-summary, aside .order-summary, .summary')
    .first().waitFor({ timeout: 1500, state: 'attached' }).catch(() => {});
}


/**
 * Гарантируем, что в корзине есть хотя бы 1 товар.
 * Надёжно открываем Caps → Simple, открываем карточку,
 * добавляем в корзину и открываем страницу корзины.
 */
export async function ensureCartHasOneItem(page) {
  const cat = new CategoryPage(page);

  // 1) Надёжно попадаем в категорию Simple
  // твой путь через UI + фолбэк на прямой роут
  try {
    await cat.openCapsSimple();
  } catch {
    await gotoPath(page, Routes.capsSimple);
  }

  // 2) Открываем карточку товара
  // сперва по имени, иначе — первый видимый линк карточки (как у тебя)
  const byName = page.getByRole('link', { name: 'Beautiful cap for woman' }).first();
  if (await byName.count()) {
    await byName.click();
  } else {
    const firstCardLink = page
      .locator('a[href^="/products/"], .ui.cards .card a, .product .card a, .products-grid a.link-reset')
      .first();
    await firstCardLink.waitFor({ timeout: 10_000 }).catch(() => {});
    await firstCardLink.click().catch(() => {});
  }

  // 3) якоря PDP (форма добавления + кнопка)
  const productForm = page.locator('form[name="sylius_shop_add_to_cart"]').first();
  const addBtn = page.locator('#add-to-cart-button, form[name="sylius_shop_add_to_cart"] button[type="submit"]').first();
  const h1   = page.getByRole('heading', { level: 1 }).first();
  const price = page.locator('.product-price, .price, [class*="price"], .fs-3').first();

  await productForm.waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForLoadState('domcontentloaded');
  await h1.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  await price.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  await addBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await dismissSyliusWidget(page).catch(() => {});


  // 4) Кликаем Add to cart и ждём переход в /cart (или добираемся туда фолбэком)
  await addBtn.click();
  await waitCartEnter(page);

  // если по какой-то причине не на /cart — идём прямым маршрутом
  if (!/\/cart(\?|$)/.test(page.url())) {
    await openCart(page);
  }

  // 5) Анти-флейк: ошибка/пустая корзина — один ретрай
const fatal = page.getByText(/Unexpected error occurred/i).first();
const emptyInfo = page.getByText(/Your cart is empty/i).first();

if (await fatal.isVisible().catch(() => false) || await emptyInfo.isVisible().catch(() => false)) {
  await page.goBack().catch(() => {});
  await productForm.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  await dismissSyliusWidget(page).catch(() => {});
  await addBtn.waitFor({ state: 'visible', timeout: 10_000 });

  await Promise.all([
    page.waitForResponse(
      r => /\/cart\/add\b/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 15_000 }
    ).catch(() => null),
    addBtn.click(),
  ]);

  await page.waitForURL(/\/cart(\?|$)/, { timeout: 15_000 }).catch(async () => {
    await openCart(page);
  });
}


  // 6) Контроль: заголовок корзины (любой из вариантов)
  await page
    .getByRole('heading', { name: /(Your shopping cart|Shopping cart|Cart)/i })
    .first()
    .waitFor({ timeout: 15_000 });
}

/**
 * Возвращает текст бейджа на иконке корзины (или null, если его нет/навигация).
 */
export async function getHeaderCartBadge(page) {
  const badge = page.locator(
    'a[href*="cart"] .label, a[href*="cart"] .ui.label, a[href*="cart"] .badge, .cart .label, .cart .ui.label, .cart .badge'
  ).first();

  try {
    const n = await badge.count().catch(() => 0);        // навигация? вернём 0 и перезапросим
    if (!n) return null;
    const text = await badge.textContent({ timeout: 1000 }).catch(() => null);
    return text?.trim() ?? null;
  } catch {
    // execution context разрушен из-за навигации — отдаём null, чтобы верхний код повторил попытку
    return null;
  }
}
