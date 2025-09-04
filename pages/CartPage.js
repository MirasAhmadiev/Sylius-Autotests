// pages/CartPage.js
import { expect } from '@playwright/test';

export class CartPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // Заголовок страницы корзины
    this.heading = page
      .getByRole('heading', { name: /(Your shopping cart|Shopping cart|Cart)/i })
      .first();

    // Ряды таблицы с позициями
    this.rows = this.page.locator('table tbody tr');

    // Зелёный баннер об успехе (на демо появляется именно в корзине)
    this.successAlert = page
      .getByRole('alert')
      .filter({ hasText: /Item has been added to cart/i });

    // Основные кнопки/блоки
    this.checkoutBtn = page.getByRole('button', { name: /Checkout$/i });
    this.clearBtn = page
     .getByRole('button', { name: /Clear cart/i })
     .or(this.page.getByRole('link', { name: /Clear cart/i }));
    // alias для удобства и совместимости
    this.clearCartBtn = this.clearBtn;
    this.summaryBox = page.locator('.summary, aside, .order-summary').first();
  }

  // Корзина открыта
  async assertOpened() {
    await expect(this.heading.first()).toBeVisible({ timeout: 20_000 });

    // Мягко подождём зелёный баннер (если был переход из карточки после add-to-cart)
    await this.successAlert.first().waitFor({ timeout: 5_000 }).catch(() => {});

    // И хотя бы одну строку с товаром — тоже мягко
    await this.rows.first().waitFor({ timeout: 10_000 }).catch(() => {});
  }

  // Поле количества по индексу строки
  qtyInputAt(index = 0) {
  return this.rows
    .nth(index)
    .locator('input[id^="sylius_shop_cart_items_"][id$="_quantity"], input[type="number"][name*="[quantity]"]')
    .first();
  }

  // Чтение сумм (Summary + итог в первой строке таблицы)
  async totals() {
  // страница корзины точно открыта
  await this.assertOpened();

  // находим контейнер Summary надёжно:
  // h3 "Summary" → ближайший предок (div/aside)
  const summary =
    this.page
      .getByRole('heading', { name: /^Summary$/i })
      .locator('xpath=ancestor::*[self::aside or self::div][1]')
      .first()
      // запасной путь, если заголовок вдруг изменится, но останется класс
      .or(this.page.locator('aside.order-summary, div.order-summary').first());

  await summary.waitFor({ state: 'visible', timeout: 10_000 });

  const readFromSummary = async (labelRe) => {
    // берём строку с меткой и читаем всё содержимое строки (включая сумму)
    const row = summary.getByText(labelRe).locator('..').first();
    await row.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
    const text = (await row.textContent()) || '';
    return this.#money(text);
  };

  // total в первой строке таблицы — последняя ячейка
  const rowTotalCell = this.rows.first().locator('td').last();
  const rowText = (await rowTotalCell.textContent()) || '';

  return {
    row:   this.#money(rowText),
    items: await readFromSummary(/Items total/i),
    order: await readFromSummary(/Order total/i),
  };
}


  // Устойчивое очищение корзины
async clearCart() {
  if (await this.clearCartBtn.count()) {
    const btn = this.clearCartBtn.first();
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await Promise.all([
      // даём LiveComponent завершить действие
      this.page.waitForLoadState('networkidle').catch(() => {}),
      btn.click(),
    ]);
    // дождёмся результата (корзина опустела или был перерендер)
    await this.page.getByText(/Your cart is empty/i).first()
      .waitFor({ timeout: 3000 }).catch(() => {});
    return true;
  }
  return false;
}

// Back-compat: старый вызов остаётся рабочим
async clearIfPossible() {
  return this.clearCart();
}

  // Нормализация денег "€1,234.56" → 1234.56
  #money(s) {
    const norm = s
      .replace(/[^\d.,\-]/g, '')     // убрать всё лишнее
      .replace(/\.(?=\d{3}\b)/g, '') // "1.234,56" → "1234,56"
      .replace(',', '.');
    return Number(norm);
  }
}

export default CartPage;
