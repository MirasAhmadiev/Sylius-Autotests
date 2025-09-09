// tests/e2e/search_dresses.spec.js
import { test, expect } from '@playwright/test';
import DressesPage from '../../pages/DressesPage.js';

test.describe('Dresses search', () => {
  test.beforeEach(async ({ page }) => {
    const dresses = new DressesPage(page);
    await dresses.open();
  });

  test('SRCH-01 — успешный поиск (позитив): по tunic находит товары', async ({ page }) => {
    const dresses = new DressesPage(page);
    const baseline = await dresses.captureBaseline();

    // 1) Выполнить поиск
    await dresses.search('tunic', { expectResults: true });

    // Проверки
    await expect(page).toHaveURL(/criteria%5Bsearch%5D%5Bvalue%5D=tunic/i);
    await expect(dresses.infoBanner).toBeHidden({ timeout: 1000 });

    const titles = await dresses.titles();
    expect(titles.length).toBeGreaterThan(0);

    for (const t of titles) {
      expect(t.toLowerCase()).toContain('tunic');
    }
    // Кол-во карточек в разумных пределах (1..baselineCount)
    expect(titles.length).toBeGreaterThanOrEqual(1);
    if (baseline.count) {
      expect.soft(titles.length).toBeLessThanOrEqual(baseline.count);
    }

    // Show / Sort не изменились (если удалось считать базовые значения)
    if (baseline.showText) {
      const showAfter = await dresses.showContainer.textContent().catch(() => '');
      expect.soft(showAfter?.replace(/\s+/g, ' ').trim()).toBe(baseline.showText);
    }
    if (baseline.sortText) {
      const sortAfter = await dresses.sortContainer.textContent().catch(() => '');
      expect.soft(sortAfter?.replace(/\s+/g, ' ').trim()).toBe(baseline.sortText);
    }
  });

  test('SRCH-02 — поиск без результатов (негатив): по about ноль карточек', async ({ page }) => {
    const dresses = new DressesPage(page);
    const baseline = await dresses.captureBaseline();

    await dresses.search('about', { expectResults: false });

    await expect(page).toHaveURL(/criteria%5Bsearch%5D%5Bvalue%5D=about/i);
    await expect(dresses.infoBanner).toBeVisible();
    // Сетка пуста
    await expect(dresses.cards).toHaveCount(0);

    // пагинации быть не должно (нет карточек, Show/Sort сохраняются)
    if (baseline.showText) {
      const showAfter = await dresses.showContainer.textContent().catch(() => '');
      expect.soft(showAfter?.replace(/\s+/g, ' ').trim()).toBe(baseline.showText);
    }
    if (baseline.sortText) {
      const sortAfter = await dresses.sortContainer.textContent().catch(() => '');
      expect.soft(sortAfter?.replace(/\s+/g, ' ').trim()).toBe(baseline.sortText);
    }
  });

  test('SRCH-03 — очистка поиска кнопкой X возвращает дефолт', async ({ page }) => {
    const dresses = new DressesPage(page);
    const baseline = await dresses.captureBaseline();

    await dresses.search('tunic', { expectResults: true });
    await dresses.clear();

    await expect(page).not.toHaveURL(/criteria%5Bsearch%5D%5Bvalue%5D=/i);
    await expect(dresses.infoBanner).toBeHidden();

    const titles = await dresses.titles();
    expect(titles.length).toBe(baseline.count);
    // Сравниваем списки названий 1:1
    for (let i = 0; i < titles.length; i++) {
      expect(titles[i]).toBe(baseline.titles[i]);
    }

    if (baseline.showText) {
      const showAfter = await dresses.showContainer.textContent().catch(() => '');
      expect.soft(showAfter?.replace(/\s+/g, ' ').trim()).toBe(baseline.showText);
    }
    if (baseline.sortText) {
      const sortAfter = await dresses.sortContainer.textContent().catch(() => '');
      expect.soft(sortAfter?.replace(/\s+/g, ' ').trim()).toBe(baseline.sortText);
    }
  });
});
