// tests/e2e/home.spec.js  (ESM)
import { test, expect } from '@playwright/test';

test('@ui главная страница открывается', async ({ page }) => {

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // базовая проверка, что это действительно Sylius
  await expect(page).toHaveTitle(/Fashion Plus Web Store/i);

  // проверим, что в шапке видна хотя бы одна «опорная» ссылка
  const headerLink = page.locator('a', { hasText: /Sylius|Login|Register/i }).first();
  await expect(headerLink).toBeVisible();
});

