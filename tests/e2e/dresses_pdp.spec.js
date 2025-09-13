// tests/e2e/dresses_pdp.spec.js
import { test, expect } from '@playwright/test';
import DressesPage from '../../pages/DressesPage.js';
import DressProductPage from '../../pages/DressProductPage.js';
import { dismissSyliusWidget } from '../../utils/ui.js';

/** Collapses whitespace for reliable comparisons */
const _norm = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

test.describe('Dresses: PDP scenarios (DRS-PDP-01..07)', () => {
  test.beforeEach(async ({ page }) => {
    const dresses = new DressesPage(page);
    await dresses.open();
    await dismissSyliusWidget(page).catch(() => {});
    await expect(dresses.heading).toBeVisible();
  });

  test('DRS-PDP-01 — Навигация в Dresses и открытие товара', async ({ page }) => {
    const dresses = new DressesPage(page);
    // 1) Проверяем, что мы на странице Dresses: H1 + крошки
    await expect(dresses.heading).toHaveText(/\bDresses\b/i);
    const crumbs = await page.locator('ol.breadcrumb').first().allTextContents().catch(() => []);
    expect(_norm(crumbs.join(' '))).toMatch(/Fashion Category\s*.*\s*Dresses/i);

    // 2) Открываем первый доступный товар из грида
    const firstCard = page.locator('.products-grid > * a.link-reset').first();
    const nameInCard = _norm(await firstCard.locator('.h6, h6, [class*=h6]').first().textContent().catch(() => ''));
    await firstCard.click();

    // 3) Проверяем PDP: заголовок и крошки
    const pdp = new DressProductPage(page);
    await expect(pdp.title).toBeVisible();
    await expect(pdp.title).toHaveText(new RegExp(`^${nameInCard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
    const bc = await pdp.breadcrumbText();
    expect(bc).toMatch(/Dresses/i);
    expect(bc).toMatch(new RegExp(nameInCard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  test('DRS-PDP-02 — Контролы существуют и имеют дефолты', async ({ page }) => {
    const dresses = new DressesPage(page);
    await page.locator('.products-grid > * a.link-reset').first().click();
    const pdp = new DressProductPage(page);

    // Контролы видимы (label + select/input)
    await expect(pdp.sizeLabel).toHaveText(/Dress size/i);
    await expect(pdp.size).toBeVisible();

    await expect(pdp.heightLabel).toHaveText(/Dress height/i);
    await expect(pdp.height).toBeVisible();

    await expect(pdp.quantityLabel).toHaveText(/Quantity/i);
    await expect(pdp.quantity).toBeVisible();

    // Дефолты
    const size = await pdp.size.inputValue();
    const height = await pdp.height.inputValue();
    const qty = await pdp.quantity.inputValue();
    expect(['dress_s','dress_m','dress_l','dress_xl','dress_xxl']).toContain(size);
    expect(['dress_height_petite','dress_height_regular','dress_height_tall']).toContain(height);
    expect(qty).toBe('1');

    // Add to cart активна
    await expect(pdp.addToCart).toBeEnabled();
  });

  test('DRS-PDP-03 — Изменение «Dress size»', async ({ page }) => {
    const dresses = new DressesPage(page);
    await page.locator('.products-grid > * a.link-reset').first().click();
    const pdp = new DressProductPage(page);

    const opts = await pdp.size.locator('option').allTextContents();
    expect(opts).toEqual(expect.arrayContaining(['S','M']));

    const target = opts.includes('M') ? 'M' : opts.find(o => /[A-Z]{1,3}/i.test(o));
    await pdp.size.selectOption({ label: target });
    await page.locator('body').click();
    await expect(pdp.size.locator('option:checked')).toHaveText(new RegExp(`^${target}$`));
    await expect(pdp.addToCart).toBeEnabled();
  });

  test('DRS-PDP-04 — Изменение «Dress height»', async ({ page }) => {
    const dresses = new DressesPage(page);
    await page.locator('.products-grid > * a.link-reset').first().click();
    const pdp = new DressProductPage(page);

    const opts = await pdp.height.locator('option').allTextContents();
    expect(opts).toEqual(expect.arrayContaining(['Petite','Regular']));

    const target = opts.includes('Regular') ? 'Regular' : opts[0];
    await pdp.height.selectOption({ label: target });
    await page.locator('body').click();
    await expect(pdp.height.locator('option:checked')).toHaveText(new RegExp(`^${target}$`));
    await expect(pdp.addToCart).toBeEnabled();
  });

  test('DRS-PDP-05 — Изменение «Quantity»', async ({ page }) => {
    const dresses = new DressesPage(page);
    await page.locator('.products-grid > * a.link-reset').first().click();
    const pdp = new DressProductPage(page);

    await expect(pdp.quantity).toHaveAttribute('type', /number/i);
    await expect(pdp.quantity).toHaveAttribute('min', '1');
    await expect(pdp.quantity).toHaveValue('1');

    // Увеличить стрелкой вверх до 2
    await pdp.quantity.focus();
    await page.keyboard.press('ArrowUp');
    await expect(pdp.quantity).toHaveValue('2');

    // Ввести 3
    await pdp.quantity.fill('3');
    await expect(pdp.quantity).toHaveValue('3');

    // Уменьшить до 1
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(pdp.quantity).toHaveValue('1');

    // Попробовать 0 и -1 — ожидать нормализацию к минимуму 1
    for (const bad of ['0','-1']) {
      await pdp.quantity.fill(bad);
      await pdp.quantity.blur();
      // HTML5 validity: <input min="1"> → rangeUnderflow
      const validity = await pdp.quantity.evaluate(e => ({
        valid: e.checkValidity(),
        underflow: e.validity.rangeUnderflow,
        val: e.value
      }));
      expect(validity.valid).toBe(false);
      expect(validity.underflow).toBe(true);
    }

    await expect(pdp.addToCart).toBeEnabled();
  });

  test('DRS-PDP-06 — Наличие и работа аккордеонов «Details», «Attributes», «Reviews»', async ({ page }) => {
    const dresses = new DressesPage(page);
    await page.locator('.products-grid > * a.link-reset').first().click();
    const pdp = new DressProductPage(page);

    // Заголовки видны
    await expect(pdp.detailsHeader).toBeVisible();
    await expect(pdp.attributesHeader).toBeVisible();
    await expect(pdp.reviewsHeader).toBeVisible();

    // Details toggle
    if (await pdp.isExpanded(pdp.detailsHeader)) {
      await pdp.ensureClosed(pdp.detailsHeader, pdp.detailsBody);
      await pdp.ensureOpen(pdp.detailsHeader, pdp.detailsBody);
    } else {
      await pdp.ensureOpen(pdp.detailsHeader, pdp.detailsBody);
      await pdp.ensureClosed(pdp.detailsHeader, pdp.detailsBody);
      await pdp.ensureOpen(pdp.detailsHeader, pdp.detailsBody);
    }
    await expect(pdp.detailsBody).toContainText(/\w+/, { useInnerText: true });

    // Attributes toggle + table
    if (await pdp.isExpanded(pdp.attributesHeader)) {
      await pdp.ensureClosed(pdp.attributesHeader, pdp.attributesBody);
      await pdp.ensureOpen(pdp.attributesHeader, pdp.attributesBody);
    } else {
      await pdp.ensureOpen(pdp.attributesHeader, pdp.attributesBody);
      await pdp.ensureClosed(pdp.attributesHeader, pdp.attributesBody);
      await pdp.ensureOpen(pdp.attributesHeader, pdp.attributesBody);
    }
    await expect(pdp.attributesTable).toBeVisible();

    // Reviews toggle + either "no reviews" info or "Add your review" link
    if (await pdp.isExpanded(pdp.reviewsHeader)) {
      await pdp.ensureClosed(pdp.reviewsHeader, pdp.reviewsBody);
      await pdp.ensureOpen(pdp.reviewsHeader, pdp.reviewsBody);
    } else {
      await pdp.ensureOpen(pdp.reviewsHeader, pdp.reviewsBody);
      await pdp.ensureClosed(pdp.reviewsHeader, pdp.reviewsBody);
      await pdp.ensureOpen(pdp.reviewsHeader, pdp.reviewsBody);
    }
    await expect(pdp.reviewsBody).toBeVisible();
    // Секция открыта — ссылка "Add your review" видна всегда
    await expect(pdp.addYourReview).toBeVisible();

    // Если есть алерт "There are no reviews" — это кейс 0 отзывов,
    // иначе проверяем, что виден хотя бы один реальный отзыв
    const emptyCount = await pdp.reviewsEmpty.count();
    if (emptyCount > 0) {
      await expect(pdp.reviewsEmpty).toBeVisible();
    } else {
      // Элемент рейтинга присутствует у каждого отзыва
      await expect(pdp.reviewsBody.locator('.sylius-rating').first()).toBeVisible();
    }
  });

  test('DRS-PDP-07 — Дымовая на 2–3 товара из Dresses (контролы + секции)', async ({ page }) => {
    const dresses = new DressesPage(page);
    const links = page.locator('.products-grid a.link-reset');
    const count = Math.min(await links.count(), 3);
    expect(count).toBeGreaterThanOrEqual(1);

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const nameInCard = _norm(await link.locator('.h6, h6, [class*=h6]').first().textContent().catch(() => ''));
      await link.click();
      const pdp = new DressProductPage(page);

      // Контролы присутствуют
      await expect(pdp.size).toBeVisible();
      await expect(pdp.height).toBeVisible();
      await expect(pdp.quantity).toBeVisible();
      await expect(pdp.addToCart).toBeEnabled();

      // Быстрый toggle Details
      await pdp.ensureOpen(pdp.detailsHeader, pdp.detailsBody);
      await pdp.ensureClosed(pdp.detailsHeader, pdp.detailsBody);

      // Назад в категорию
      await page.goBack();
      await expect(dresses.heading).toBeVisible();
    }
  });
});
