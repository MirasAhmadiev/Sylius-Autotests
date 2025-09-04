// src/pages/ProductPage.js
import { expect } from '@playwright/test';
import { dismissSyliusWidget } from '../utils/ui.js';
import { gotoPath } from '../utils/nav.js';

class ProductPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.main = page.locator('main, #main, [role="main"]').first();

    // Базовые элементы карточки
    this.price = page.locator('.product-price, .price, [class*="price"], .fs-3').first();
    this.qty = page.locator('input[name*=quantity], input#quantity, input[name="quantity"]').first();
    this.addToCart = page.getByRole('button', { name: /^Add to cart$/i }).first();

    this.title = this.page.getByRole('heading', { level: 1 }).first();
    this.flashSuccess = this.page.getByRole('alert').filter({ hasText: /added to cart/i }).first();
  }

  async assertReady() {
    await this.main.waitFor({ state: 'visible' });
    await this.page.waitForLoadState('domcontentloaded');
    await this.title.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await this.price.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await dismissSyliusWidget(this.page).catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {}); // добиваем хвосты
  }

  // Открываем карточку товара: сперва кликом по видимой ссылке с именем, иначе — прямой урл по slug
  async openFromListByName(name) {
    const link = this.page.getByRole('link', { name }).first();
    if (await link.count()) {
      await link.click();
    } else {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      await gotoPath(this.page, `products/${slug}`);
    }

    // На демо иногда всплывает «Unexpected error occurred» — перетриггерим
    await this._recoverFromDemoError(name);
    await this.assertProductBasics(name);
  }

  // Минимальные проверки, что страница товара действительно открыта
  async assertProductBasics(name) {
    await this.page.getByRole('heading', { name }).first().waitFor({ timeout: 15000 });
    await this.price.waitFor({ timeout: 15000 });
    await this.qty.waitFor({ timeout: 15000 });
    await this.addToCart.waitFor({ timeout: 15000 });

    // Закрыть зелёный виджет, если он мешает кликам
    await dismissSyliusWidget(this.page).catch(() => {});
  }

  // Карточка полностью готова к клику
  async _waitProductReady() {
    await expect(this.page.getByRole('heading')).toBeVisible({ timeout: 15000 });
    await expect(this.price).toBeVisible({ timeout: 10000 });
    await expect(this.qty).toBeVisible({ timeout: 10000 });
    await expect(this.addToCart).toBeVisible({ timeout: 10000 });
    await expect(this.addToCart).toBeEnabled({ timeout: 10000 });

    // главный img действительно прогрузился (безопасно)
    const mainImg = this.page
      .locator('img.object-fit-cover, .product-show img, main img')
      .first();

    // не стопаем тест, если img гоняется лениво/перемонтируется
    await mainImg.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

    // берём "снимок" хэндла и декодируем, если доступно — без автопоиска
    const handle = await mainImg.elementHandle().catch(() => null);
    if (handle) {
      await this.page
        .evaluate(async (img) => {
          try { if (img && img.decode) { await img.decode(); } } catch {}
        }, handle)
        .catch(() => {});
    }

    // сеть «устаканилась»
    await this.page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  }

  // Клик по Add to cart со страхующей логикой для демо (объединённая версия)
async addItemToCart(productNameForRetry) {
  // 1) PDP должна быть полностью готова
  await this._waitProductReady();
  await expect(this.addToCart).toBeEnabled();

  // функция одного клика с ожиданиями сети
  const clickAndWaitResponse = async () => {
    const reAdd = /\/cart\/add\b/;
    const [resp] = await Promise.all([
      this.page.waitForResponse(
        r => reAdd.test(r.url()) && r.request().method() === 'POST',
        { timeout: 15000 }
      ).catch(() => null),
      this.addToCart.click(),
    ]);
    return resp;
  };

  // 2) первый заход
  let resp = await clickAndWaitResponse();

  // 3) если 5xx или видна страница ошибки — мягкий ретрай
  const errorPage = this.page
    .getByText(/Unexpected error occurred|The page you are looking for does not exist/i)
    .first();
  const onError = (resp && resp.status && resp.status() >= 500)
    || (await errorPage.isVisible().catch(() => false));

  if (onError) {
    if (!productNameForRetry) {
      productNameForRetry = await this.page.getByRole('heading').first().textContent()
        .then(t => (t || '').trim())
        .catch(() => '');
    }
    await this._recoverFromDemoError(productNameForRetry);
    await this._waitProductReady();
    resp = await clickAndWaitResponse();
  }

  // 4) ждём переход в /cart (обычный submit у Sylius) или заголовок корзины
  await this.page.waitForURL(/\/cart(\?|$)/, { timeout: 15000 }).catch(() => {});
  await this.page
    .getByRole('heading', { name: /(Your shopping cart|Shopping cart|Cart)/i })
    .first()
    .waitFor({ timeout: 5000 })
    .catch(() => {});

  // 5) зелёный локальный алерт (не критичен)
  await this.page.getByRole('alert').first().waitFor({ timeout: 5000 }).catch(() => {});
}

// Совместимость: если где-то вызывается addToCart(), пусть проксируется
async addToCart() {
  return this.addItemToCart();
}


  // Восстановление после редкой страницы ошибки на демо
  async _recoverFromDemoError(name) {
    const error = this.page
      .getByText(/Unexpected error occurred|The page you are looking for does not exist/i)
      .first();
    if (await error.count()) {
      await this.page.goBack().catch(() => {});
      if (name) {
        const link = this.page.getByRole('link', { name }).first();
        if (await link.count()) {
          await link.click().catch(() => {});
        }
      }
    }
  }
}

export { ProductPage };
export default ProductPage;
