// src/utils/nav.js
export const Routes = {
  caps: 'taxons/caps',
  capsSimple: 'taxons/fashion-category/caps/simple', // основной
  capsSimpleAlt: 'taxons/caps/simple',               // запасной
  cart: 'cart',
};

 // Переход по ОТНОСИТЕЛЬНОМУ пути, чтобы baseURL с /en_US сохранялся
export async function gotoPath(page, relative, optionsOrWaitUntil = {}) {
  const raw = String(relative || '').trim();
  const clean = raw.replace(/^\/+/, ''); // убрали ведущие слэши

  const defaults = { waitUntil: 'domcontentloaded' };
  const options =
    typeof optionsOrWaitUntil === 'string'
      ? { waitUntil: optionsOrWaitUntil }
      : { ...defaults, ...(optionsOrWaitUntil || {}) };

  // ВАЖНО: без ведущего слэша — тогда Playwright добавит к базовому /en_US
  await page.goto(clean || '.', options);
}

/** Удобный шорткат для открытия корзины */
export async function openCart(page) {
  // Уже в корзине — ничего не делаем
  if (/\/cart(\/|\?|$)/.test(page.url())) return;

  // 1) Попробовать открыть offcanvas корзины из хедера
  const cartBtn = page.locator(
    'button[aria-label="cart button"], [data-bs-toggle="offcanvas"][data-bs-target="#offcanvasCart"]'
  ).first();

  if (await cartBtn.count()) {
    await cartBtn.click();

    // ждём панель
    const panel = page.locator('#offcanvasCart, .offcanvas.offcanvas-end').first();
    await panel.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

    // 2) Внутри панели нажимаем "View and edit cart"
    let viewCart = panel.getByRole('button', { name: /View and edit cart/i }).first();
    if (!(await viewCart.count())) {
      viewCart = panel.getByRole('link', { name: /View and edit cart/i }).first();
    }

    if (await viewCart.count()) {
      await Promise.all([
        page.waitForURL(/\/cart(\/|\?|$)/, { timeout: 10000 }).catch(() => {}),
        viewCart.click(),
      ]);
      if (/\/cart(\/|\?|$)/.test(page.url())) return;
    }
  }

  // 3) Фолбэк: прямая навигация, с мягким ретраем на случай сетевых глюков
  for (let i = 0; i < 2; i++) {
    try {
      await gotoPath(page, Routes.cart);
      await page.waitForURL(/\/cart(\/|\?|$)/, { timeout: 8000 }).catch(() => {});
      break;
    } catch (e) {
      if (String(e).includes('ERR_CONNECTION_CLOSED') && i === 0) {
        await page.waitForTimeout(400);
        continue;
      }
      throw e;
    }
  }
}


