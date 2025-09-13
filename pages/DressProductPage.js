// pages/DressProductPage.js
// Standalone POM for Dress Product PDP (size/height/qty + accordions)
// Uses robust, ID-based selectors from DOM snapshots.
import { expect } from '@playwright/test';
import { dismissSyliusWidget } from '../utils/ui.js';
import { gotoPath } from '../utils/nav.js';

/** Normalize whitespace */
const _norm = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

export default class DressProductPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.main = page.locator('main, #main, [role="main"]').first();

    // Breadcrumbs + title
    this.breadcrumbs = page.locator('ol.breadcrumb, nav[aria-label*=breadcrumb i]').first();
    this.title = page.getByRole('heading', { level: 1 }).first();

    // Exact, stable controls from DOM snapshots
    this.size = page.locator('#sylius_shop_add_to_cart_cartItem_variant_dress_size').first();
    this.sizeLabel = page.locator('label[for="sylius_shop_add_to_cart_cartItem_variant_dress_size"]').first();

    this.height = page.locator('#sylius_shop_add_to_cart_cartItem_variant_dress_height').first();
    this.heightLabel = page.locator('label[for="sylius_shop_add_to_cart_cartItem_variant_dress_height"]').first();

    this.quantity = page.locator('#sylius_shop_add_to_cart_cartItem_quantity').first();
    this.quantityLabel = page.locator('label[for="sylius_shop_add_to_cart_cartItem_quantity"]').first();

    this.addToCart = page.locator('#add-to-cart-button').first();

    // Accordions (Bootstrap)
    this.detailsHeader = page.locator('button[aria-controls="details"]').first();
    this.detailsBody   = page.locator('#details.accordion-collapse').first();

    this.attributesHeader = page.locator('button[aria-controls="attributes"]').first();
    this.attributesBody   = page.locator('#attributes.accordion-collapse').first();
    this.attributesTable  = this.attributesBody.locator('table');

    this.reviewsHeader = page.locator('button[aria-controls="reviews"]').first();
    this.reviewsBody   = page.locator('#reviews.accordion-collapse').first();
    this.reviewsEmpty  = this.reviewsBody.locator('.alert.alert-info:has-text("There are no reviews")');
    this.addYourReview = this.reviewsBody.getByRole('link', { name: /Add your review/i }).first();
  }

  /** Navigate to PDP by product slug */
  async openBySlug(slug) {
    await gotoPath(this.page, slug.startsWith('/') ? slug : `/products/${slug}`);
    await dismissSyliusWidget(this.page).catch(() => {});
    await expect(this.title).toBeVisible();
  }

  /** Return visible breadcrumb text (single line) */
  async breadcrumbText() {
    const raw = await this.breadcrumbs.textContent().catch(() => '');
    return _norm(raw);
  }

  /** Read select option texts */
  async sizeOptions()    { return await this.size.locator('option').allTextContents(); }
  async heightOptions()  { return await this.height.locator('option').allTextContents(); }
  async selectedLabel(select) {
  return (await select.locator('option:checked').first().textContent()).trim();
}

  // Accordion helpers based on aria-expanded + class 'show'
  async isExpanded(header) {
    return (await header.getAttribute('aria-expanded')) === 'true';
  }

  async ensureOpen(header, body) {
  // решаем состояние по двум источникам: aria-expanded + класс show
    const [expanded, hasShow] = await Promise.all([
      header.getAttribute('aria-expanded'),
      body.evaluate(el => el.classList.contains('show')),
    ]);
    if (expanded !== 'true' && !hasShow) {
      await header.scrollIntoViewIfNeeded();
      await header.click();
    }
    // дождаться завершения transition: сначала уйдёт 'collapsing', потом появится 'show'
    await expect(body).not.toHaveClass(/\bcollapsing\b/);
    await expect(body).toHaveClass(/\baccordion-collapse\b.*\bshow\b/);
  }


  async ensureClosed(header, body) {
    const [expanded, hasShow] = await Promise.all([
      header.getAttribute('aria-expanded'),
      body.evaluate(el => el.classList.contains('show')),
    ]);
    if (expanded === 'true' || hasShow) {
      await header.scrollIntoViewIfNeeded();
      await header.click();
    }
    // дождаться завершения transition: нет 'collapsing' и нет 'show'
    await expect(body).not.toHaveClass(/\bcollapsing\b/);
    await expect(body).not.toHaveClass(/\bshow\b/);
  }

}
