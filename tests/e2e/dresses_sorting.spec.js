// tests/e2e/dresses_sorting.spec.js
import { test, expect } from '@playwright/test';
import DressesPage from '../../pages/DressesPage.js';

test.describe('Dresses: sorting', () => {
  test.beforeEach(async ({ page }) => {
    const dresses = new DressesPage(page);
    await dresses.open();
    await expect(dresses.heading).toBeVisible();
  });

  // helpers for stable string ordering
  const expectAscByName = (arr) => {
    const collator = new Intl.Collator('en', { sensitivity: 'base' });
    const sorted = [...arr].sort((a, b) => collator.compare(a, b));
    expect(arr).toEqual(sorted);
  };
  const expectDescByName = (arr) => {
    const collator = new Intl.Collator('en', { sensitivity: 'base' });
    const sorted = [...arr].sort((a, b) => collator.compare(b, a));
    expect(arr).toEqual(sorted);
  };

  test('AZ, ZA, Newest↔Oldest (mirror), Cheapest', async ({ page }) => {
    const dresses = new DressesPage(page);

    // 1) From A to Z
    await dresses.sortByLabel('From A to Z');
    const aToZ = await dresses.names();
    expect(aToZ.length).toBeGreaterThan(0);
    expectAscByName(aToZ);

    // 2) From Z to A
    await dresses.sortByLabel('From Z to A');
    const zToA = await dresses.names();
    expectDescByName(zToA);

    // 3) Newest first -> capture order
    await dresses.sortByLabel('Newest first');
    const newest = await dresses.names();
    expect(newest.length).toBeGreaterThan(0);

    // 4) Oldest first -> should be reverse of newest
    await dresses.sortByLabel('Oldest first');
    const oldest = await dresses.names();
    expect(oldest.length).toBe(newest.length);
    expect(oldest).toEqual([...newest].reverse());

    // 5) Cheapest first -> numeric ascending
    await dresses.sortByLabel('Cheapest first');
    const prices = await dresses.prices();
    expect(prices.length).toBeGreaterThan(1);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});
