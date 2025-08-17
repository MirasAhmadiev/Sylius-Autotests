import { test, expect } from '@playwright/test';

test('@api список товаров доступен', async ({ request }) => {
  const res = await request.get('/api/v2/shop/products', {
    headers: { Accept: 'application/ld+json' }
  });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data).toBeTruthy();
});
