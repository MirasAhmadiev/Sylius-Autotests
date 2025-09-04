// src/pages/CategoryPage.js
import { gotoPath, Routes } from '../utils/nav.js';
import { dismissSyliusWidget } from '../utils/ui.js';
import { expect } from '@playwright/test';


class CategoryPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // основной контейнер
    this.main = page.locator('main, #main, [role="main"]').first();

    // заголовок "Simple" (жёсткое совпадение)
    this.headingSimple = page.getByRole('heading', { name: /^Simple/i }).first();

    // основной контейнер со списком товаров (новая и старая вёрстка)
    this.productsGrid = this.page.locator('.products-grid, .ui.cards, .products .grid').first();

    // карточки/ссылки товара — считаем именно внутри productsGrid
    this.gridItems = this.productsGrid.locator([
      'a.link-reset',
      'a[href^="/products/"]',       // fallback
      '.product-card',
      '.card',                        // старая тема
      '.product-tile'                 // запасной вариант
    ].join(', '));

    // хлебные крошки / level up
    this.levelUp   = this.page.getByRole('link', { name: /Go level up/i }).first();
    this.breadcrumbs = this.page.locator('.breadcrumb, nav[aria-label="breadcrumb"], .ui.breadcrumb').first();

    // сортировка (новая тема: dropdown с кнопкой и пунктами)
    // ВАЖНО: не берём '.dropdown'.first() — это верхнее меню "Caps".
    this.sortBtn   = this.page.getByRole('button', { name: /^Sort:/i }).first();
    this.sortMenu  = this.sortBtn
      .locator('xpath=ancestor::div[contains(@class,"dropdown")][1]//div[contains(@class,"dropdown-menu")]')
      .first();
    // пункт «Most expensive first» — именно внутри меню сортировки
    this.sortMostExp = this.sortMenu.getByRole('link', { name: /Most expensive first/i }).first();


    // цены в карточках
    this.gridPrices = this.productsGrid.locator([
      '[data-applied-promotions-locale] + span', // актуальная верстка Sylius
      '.product-card [class*="price"]',
      '.product-tile [class*="price"]',
      '.card [class*="price"]',
      '.price'                                  // запасной
    ].join(', '));


    // маркеры ошибок — как у тебя было
    this.notFound   = this.page.getByText(/The page you are looking for does not exist/i).first();
    this.serverError= this.page.getByText(/Unexpected error occurred/i).first();
  }

    // true, если уже выбрано "Most expensive first"
  async isSortedMostExpensive() {
    const url = this.page.url();
    if (/sorting%5Bprice%5D=desc/i.test(url)) return true;
    const txt = await this.sortBtn.innerText().catch(() => '');
    return /most expensive first/i.test(txt);
  }

    // --- Навигация: Home → Caps (dropdown) → Simple
  async openCapsSimple() {
    // в самом начале openCapsSimple
    await gotoPath(this.page, '');
    await dismissSyliusWidget(this.page).catch(() => {});

    // Клик по "Caps" (button или link)
    let caps = this.page.getByRole('button', { name: /^Caps$/i }).first();
    if (!(await caps.count())) caps = this.page.getByRole('link', { name: /^Caps$/i }).first();
    if (await caps.count()) await caps.click().catch(() => {});

    // Если дропдаун открыт — клик по "Simple"
    const menu = this.page.locator('.dropdown-menu, .dropdown-menu.show').first();
    const simpleInMenu = menu.getByRole('link', { name: /^Simple$/i }).first();
    if (await menu.isVisible().catch(() => false) && await simpleInMenu.count()) {
      await simpleInMenu.click().catch(() => {});
    } else {
      // Иначе попробуем найти "Simple" как обычную ссылку (на странице Caps)
      const simpleAnywhere = this.page.getByRole('link', { name: /^Simple$/i }).first();
      if (await simpleAnywhere.count()) await simpleAnywhere.click().catch(() => {});
    }

    let ok = await this._waitSimpleRendered(8000);
    if (!ok) {
      // фолбэк прямым путём (ваш скрин подтвердил этот slug)
      await gotoPath(this.page, Routes.capsSimpleAlt); // 'taxons/caps/simple'
      ok = await this._waitSimpleRendered(8000);
    }

    if (!ok) {
      // полезные логи на случай редкого фэйла
      console.log('DEBUG URL:', this.page.url());
      console.log('DEBUG CRUMBS:', await this.breadcrumbs.textContent().catch(()=>''));
      await this.page.screenshot({ path: 'debug_simple_fail.png', fullPage: true }).catch(()=>{});
      throw new Error('Simple category did not render');
    }

    await expect(this.gridItems.first()).toBeVisible({ timeout: 5000 });
    await this.page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});

    await dismissSyliusWidget(this.page).catch(() => {}); // ещё раз — если всплыл
  }

  // --- Ожидания базовой вёрстки Simple
  async assertSimpleBasics() {
    await this.headingSimple.waitFor({ timeout: 15000 });
    await this.gridItems.first().waitFor({ timeout: 15000 });

    const n = await this.gridItems.count();
    if (n < 2) throw new Error(`Ожидалось минимум 2 карточки, найдено: ${n}`);
  }

// --- Сортировка по "Most expensive first"
async sortByMostExpensive() {
  // если уже стоит нужная сортировка — просто убеждаемся, что сетка на месте
  if (await this.isSortedMostExpensive()) {
    await this.productsGrid.waitFor({ state: 'visible' }).catch(() => {});
    return;
  }

  // открыть именно меню сортировки
  await this.sortBtn.click();
  await this.sortMenu.waitFor({ state: 'visible', timeout: 3000 });

  // клик по пункту и ждём смену URL
  await Promise.all([
    this.page.waitForURL(/sorting.*price.*desc/i, { timeout: 15000 }),
    this.sortMostExp.click(),
  ]);

  // дождаться стабильности рендера
  await this.productsGrid.waitFor({ state: 'visible' });
  await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
}

  // --- Кнопка "Go level up" или прямой переход на Caps
  async goLevelUpToCaps() {
    if (await this.levelUp.count()) {
      await this.levelUp.click().catch(() => {});
    } else {
      await gotoPath(this.page, Routes.caps || 'taxons/caps');
    }
  }

  // --- Метод: вернуть массив чисел-цен, видимых на странице
  async getVisiblePrices() {
    // 1) сетка на месте
    await this.productsGrid.waitFor({ state: 'visible', timeout: 15_000 });

    // 2) ждём, пока появятся хотя бы 2 цены (после сортировки бывает краткий ребилд)
    await expect
      .poll(async () => await this.gridPrices.count(), {
        timeout: 10_000,
        intervals: [100, 200, 300, 500]
      })
      .toBeGreaterThan(1);

    // 3) основной источник
    let priceLoc = this.gridPrices;
    let cnt = await priceLoc.count();

    // 4) fallback на случай другой разметки: XPath "соседний span после promo-div"
    if (cnt === 0) {
      priceLoc = this.productsGrid.locator(
        'xpath=.//div[@data-applied-promotions-locale]/following-sibling::span[1]'
      );
      cnt = await priceLoc.count();
    }

    // 5) соберём тексты и распарсим в числа
    const texts = (await priceLoc.allTextContents())
      .map(t => t.trim())
      .filter(Boolean);

    const nums = texts
      .map(t => t
        .replace(/[^\d,.\-]/g, '')      // оставить цифры и разделители
        .replace(/\.(?=\d{3}\b)/g, '')  // 1.234 → 1234
        .replace(',', '.')              // 29,30 → 29.30
      )
      .map(n => Number(n))
      .filter(n => !Number.isNaN(n));

    // 6) на всякий случай — отладка, если пусто
    if (nums.length === 0) {
      console.log('DEBUG prices empty, url:', this.page.url());
      await this.page.screenshot({ path: 'debug_prices_empty.png' }).catch(() => {});
    }
    return nums;
  }

  // --- private: ждём рендер Simple либо распознаём 404/500
      async _waitSimpleRendered(timeout = 20000) {
      try {
        // ждём появления контейнера с сеткой
        await expect(this.productsGrid).toBeVisible({ timeout });

        // ждём, пока карточек станет > 0 (без ручного while)
        await expect.poll(() => this.gridItems.count(), {
          timeout,
          intervals: [100, 200, 300, 500],
        }).toBeGreaterThan(0);

        // любой из сигналов "мы на Simple"
        const hasHeading = await this.headingSimple.isVisible().catch(() => false);
        const urlHasSlug = /\/caps\/simple\b/i.test(this.page.url());
        const crumbsHasSimple = /Simple/i.test(
          (await this.breadcrumbs.textContent().catch(() => '')) || ''
        );

        return hasHeading || urlHasSlug || crumbsHasSimple;
      } catch {
        return false;
      }
    }


}

export { CategoryPage };      // именованный импорт
export default CategoryPage;  // импорт по умолчанию
