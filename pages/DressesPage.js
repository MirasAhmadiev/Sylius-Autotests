// src/pages/DressesPage.js
// POM for the Dresses category page (search controls & grid)
import { gotoPath } from '../utils/nav.js';
import { dismissSyliusWidget } from '../utils/ui.js';

/** Utility: trim text and collapse spaces */
function _norm(t) {
  return (t ?? '').replace(/\s+/g, ' ').trim();
}

export default class DressesPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // Main content
    this.main = page.locator('main, #main, [role="main"]').first();
    this.heading = page.getByRole('heading', { name: /^Dresses$/i }).first();

    // Search form (robust: find a form that owns the search input)
    this.searchForm = page
      .locator('form:has(input[name="criteria[search][value]"])')
      .or(page.locator('form:has(input[name*="criteria"][name*="search"][name*="[value]"])'))
      .first();

    // Search input
    this.searchInput = page
      .locator('input[name="criteria[search][value]"]')
      .or(page.getByPlaceholder(/value/i))
      .first();

    // Buttons: submit (magnifier) and clear (X)
    this.searchBtn = this.searchForm
      .getByRole('button', { name: /search/i })
      .or(this.searchForm.locator('button[type="submit"]'))
      .or(this.searchForm.locator('button:has(svg.bi-search)'))
      .first();

    this.clearBtn = this.searchForm
      .getByRole('link', { name: /clear/i })                        // <a aria-label="clear filter">
      .or(this.searchForm.locator('a[aria-label*="clear" i]'))
      .or(this.searchForm.locator('button[type="reset"]'))
      .or(this.searchForm.locator('button:has(svg.bi-x, path.bi-x)'))
      .first();

    // Info banner "There are no results to display"
    this.infoBanner = page
      .getByRole('alert')
      .filter({ hasText: /There are no results to display/i })
      .or(page.locator('.alert.alert-info:has-text("There are no results to display")'))
      .first();

     // Грид и карточки
    this.grid = this.page.locator('.products-grid').first();               // берём без привязки к main
    this.cards = this.grid.locator(':scope > div:has(a.link-reset)');      // «дети грида, где есть ссылка на продукт»
    // Заголовки товаров: div.h6.text-break внутри карточки
    this.cardTitles = this.grid.locator(':scope > div .h6.text-break');

    // Show / Sort indicators (loose selectors; we store text to compare later)
    this.showContainer = this.main.locator('text=Show:').locator('xpath=..').first();
    this.sortContainer = this.main.locator('text=Sort:').locator('xpath=..').first();
  }

async open() {
  // 1) Главная (от baseURL)
  await gotoPath(this.page, '');                // эквивалент './' от baseURL
  await dismissSyliusWidget(this.page).catch(() => {});

  // 2) Клик по пункту меню "Dresses" в шапке
  const header = this.page.locator('header, nav').first();
  let dressesLink = header.getByRole('link', { name: /^Dresses$/i }).first();
  if (!(await dressesLink.count())) {
    // запасной вариант (если не нашли в header)
    dressesLink = this.page.getByRole('link', { name: /^Dresses$/i }).first();
  }

  if (await dressesLink.count()) {
    await Promise.all([
      this.page.waitForURL(/\/taxons\/fashion-category\/dresses(\/|\?|$)/, { timeout: 10_000 }),
      dressesLink.click()
    ]);
  } else {
    // 3) Фолбэк: прямой переход (на случай нестандартной разметки)
    await gotoPath(this.page, 'taxons/fashion-category/dresses');
  }

  // 4) Контрольный прогрев локаторов страницы Dresses
  await Promise.race([
    this.heading.waitFor({ state: 'visible', timeout: 8_000 }),
    this.searchInput.waitFor({ state: 'visible', timeout: 8_000 }),
  ]).catch(() => {});
}

  /** Capture baseline list (titles) and controls state */
  async captureBaseline() {
    const titles = await this.titles();
    const count = titles.length;
    const showText = (await this.showContainer.count())
      ? (await this.showContainer.textContent()).replace(/\s+/g, ' ').trim()
      : null;
    const sortText = (await this.sortContainer.count())
      ? (await this.sortContainer.textContent()).replace(/\s+/g, ' ').trim()
      : null;
     return { titles, count, showText, sortText };
   }

  /** Return trimmed titles of all visible products */
  async titles() {
   // основной путь
   let el = this.cardTitles;
   let n = await el.count();
   // фолбэк на всякий случай — поиск по всей сетке
   if (n === 0) {
     el = this.page.locator('.products-grid .h6.text-break');
     n = await el.count();
   }
   const out = [];
   for (let i = 0; i < n; i++) {
     const t = await el.nth(i).textContent().catch(() => '');
     if (t) out.push(t.replace(/\s+/g, ' ').trim());
   }
   return out;
 }

  /** Submit a search query and wait for URL + either results or banner */
  /**
+   * @param {string} query
+   * @param {{expectResults?: boolean}} [opts]
+   */
  async search(query, opts = {}) {
  await this.searchInput.fill(query);
  await this.searchBtn.click();

  const enc = encodeURIComponent(query);
  await this.page.waitForURL(new RegExp(`criteria%5Bsearch%5D%5Bvalue%5D=${enc}`), { timeout: 10_000 });

  if (opts.expectResults === true) {
    // ждём сам грид и хотя бы один заголовок карточки
    await this.grid.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    await this.page.waitForFunction(
      () => document.querySelectorAll('.products-grid .h6.text-break').length > 0,
      null,
      { timeout: 10_000 }
    );
  } else if (opts.expectResults === false) {
    await this.infoBanner.waitFor({ state: 'visible', timeout: 10_000 });
  } else {
    await this.page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  }
}

  /** Click the clear (X) button to reset */
  async clear() {
    await this.clearBtn.click();
    // Wait for the query param to disappear
    await this.page.waitForURL((url) => !url.toString().includes('criteria%5Bsearch%5D%5Bvalue%5D'), {
      timeout: 8000,
    }).catch(() => {});
    // Also wait for banner to hide if it was visible
    if (await this.infoBanner.isVisible().catch(() => false)) {
      await this.infoBanner.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
  }

  /** Wait for search results/banners to stabilize */
  async waitForResults(q) {
    const enc = encodeURIComponent(q);
    await this.page.waitForURL(new RegExp(`criteria%5Bsearch%5D%5Bvalue%5D=${enc}`), { timeout: 8000 });
    // Wait for either: info banner visible OR at least one card visible OR network to idle
    await Promise.race([
      this.infoBanner.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {}),
      this.cards.first().waitFor({ state: 'visible', timeout: 6000 }).catch(() => {}),
      this.page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {}),
    ]);
  }
}
