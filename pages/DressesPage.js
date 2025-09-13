// pages/DressesPage.js
// POM for the Dresses category page (search, sorting & grid)
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
      .or(this.page.getByPlaceholder(/value/i))
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

    // Grid and cards
    this.grid = this.page.locator('.products-grid').first();
    this.cards = this.grid.locator(':scope > div:has(a.link-reset)');
    this.cardTitles = this.grid.locator(':scope > div .h6.text-break');

    // Show / Sort containers (for passive checks)
    this.showContainer = this.main.locator('text=Show:').locator('xpath=..').first();
    this.sortContainer = this.main.locator('text=Sort:').locator('xpath=..').first();

    // --- NEW: Sorting controls (robust to layout changes)
    this.sortBtn  = this.page.getByRole('button', { name: /^Sort:/i }).first();
    this.sortMenu = this.sortBtn
      .locator('xpath=ancestor::div[contains(@class,"dropdown")][1]//div[contains(@class,"dropdown-menu")]')
      .first();
  }

  // ---------- NAVIGATION ----------
  async open() {
    // 1) Home (relative to baseURL), close Sylius widget
    await gotoPath(this.page, '');
    await dismissSyliusWidget(this.page).catch(() => {});

    // 2) Header → Dresses (fallback to any visible link text "Dresses")
    const header = this.page.locator('header, nav').first();
    let dressesLink = header.getByRole('link', { name: /^Dresses$/i }).first();
    if (!(await dressesLink.count())) {
      dressesLink = this.page.getByRole('link', { name: /^Dresses$/i }).first();
    }

    if (await dressesLink.count()) {
      await Promise.all([
        this.page.waitForURL(/\/taxons\/fashion-category\/dresses(\/|\?|$)/, { timeout: 10_000 }),
        dressesLink.click()
      ]);
    } else {
      // 3) Fallback: direct route
      await gotoPath(this.page, 'taxons/fashion-category/dresses');
    }

    // 4) Warm up key anchors
    await Promise.race([
      this.heading.waitFor({ state: 'visible', timeout: 8_000 }),
      this.searchInput.waitFor({ state: 'visible', timeout: 8_000 }),
    ]).catch(() => {});
  }

  // ---------- BASELINE ----------
  async captureBaseline() {
    const titles = await this.titles();
    const count = titles.length;
    const showText = (await this.showContainer.count())
      ? _norm(await this.showContainer.textContent())
      : null;
    const sortText = (await this.sortContainer.count())
      ? _norm(await this.sortContainer.textContent())
      : null;
    return { titles, count, showText, sortText };
  }

  // ---------- TITLES ----------
  async titles() {
    let el = this.cardTitles;
    let n = await el.count();
    if (n === 0) {
      el = this.page.locator('.products-grid .h6.text-break');
      n = await el.count();
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = await el.nth(i).textContent().catch(() => '');
      if (t) out.push(_norm(t));
    }
    return out;
  }
  // Alias for clarity in specs
  async names() { return this.titles(); }

  // ---------- PRICES ----------
  async prices() {
    // Prefer Sylius' current markup: price immediately after promo-div
    let priceLoc = this.grid.locator('[data-applied-promotions-locale] + span, .product-card [class*="price"], .product-tile [class*="price"], .card [class*="price"], .price');
    let cnt = await priceLoc.count();

    if (cnt === 0) {
      // Fallback XPath
      priceLoc = this.grid.locator('xpath=.//div[@data-applied-promotions-locale]/following-sibling::span[1]');
      cnt = await priceLoc.count();
    }

    const texts = (await priceLoc.allTextContents())
      .map(t => _norm(t))
      .filter(Boolean);

    const nums = texts
      .map(t => t
        .replace(/[^\d,.\-]/g, '')      // keep digits & separators
        .replace(/\.(?=\d{3}\b)/g, '')  // 1.234 → 1234
        .replace(',', '.')              // 29,30 → 29.30
      )
      .map(n => Number(n))
      .filter(n => !Number.isNaN(n));

    // Anti-flake: ensure grid is visible & at least 2 prices (after sort reflow)
    await this.grid.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    return nums;
  }

  // ---------- SEARCH ----------
  /**
   * @param {string} query
   * @param {{expectResults?: boolean}} [opts]
   */
  async search(query, opts = {}) {
    await this.searchInput.fill(query);
    await this.searchBtn.click();

    const enc = encodeURIComponent(query);
    await this.page.waitForURL(new RegExp(`criteria%5Bsearch%5D%5Bvalue%5D=${enc}`), { timeout: 10_000 });

    if (opts.expectResults === true) {
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

  async clear() {
    await this.clearBtn.click();
    await this.page.waitForURL((url) => !url.toString().includes('criteria%5Bsearch%5D%5Bvalue%5D'), {
      timeout: 8000,
    }).catch(() => {});
    if (await this.infoBanner.isVisible().catch(() => false)) {
      await this.infoBanner.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
  }

  async waitForResults(q) {
    const enc = encodeURIComponent(q);
    await this.page.waitForURL(new RegExp(`criteria%5Bsearch%5D%5Bvalue%5D=${enc}`), { timeout: 8000 });
    await Promise.race([
      this.infoBanner.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {}),
      this.cards.first().waitFor({ state: 'visible', timeout: 6000 }).catch(() => {}),
      this.page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {}),
    ]);
  }

  // ---------- NEW: SORTING ----------
  /** Map label → expected query regex for stability */
  _urlRegexFor(label) {
    const m = String(label).toLowerCase();
    if (/from a to z/.test(m))      return /sorting.*name.*asc/i;
    if (/from z to a/.test(m))      return /sorting.*name.*desc/i;
    if (/newest/.test(m))           return /sorting.*createdat.*desc/i;
    if (/oldest/.test(m))           return /sorting.*createdat.*asc/i;
    if (/cheapest/.test(m))         return /sorting.*price.*asc/i;
    return null; // not all builds include query params; we'll fall back to text check
  }

  /** Open the sort dropdown (idempotent). */
  async _openSortMenu() {
    await this.sortBtn.click();
    await this.sortMenu.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {});
  }

  /** Select sort option by visible label, wait for URL/text + grid stability */
  async sortByLabel(label) {
    await this._openSortMenu();

    const option = this.sortMenu.getByRole('link', { name: new RegExp(`^${label}$`, 'i') }).first();
    await Promise.allSettled([
      this.page.waitForLoadState('networkidle', { timeout: 15_000 }),
      (async () => {
        const re = this._urlRegexFor(label);
        if (re) await this.page.waitForURL(re, { timeout: 15_000 }).catch(() => {});
      })(),
      option.click(),
    ]);

    // wait for button text to reflect the selection (fallback when URL doesn't change)
    await this.page.waitForFunction(
      (expected) => {
        const btn = [...document.querySelectorAll('button')].find(b => /Sort:/i.test(b?.textContent || ''));
        return btn && new RegExp(expected, 'i').test(btn.textContent || '');
      },
      _norm(`Sort: ${label}`),
      { timeout: 5_000 }
    ).catch(() => {});

    // grid stable
    await this.grid.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    await this.page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  }
}
