// tests/e2e/login.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';

const byText = (page, textOrRx) =>
  page.getByText(textOrRx instanceof RegExp ? textOrRx
    : new RegExp(String(textOrRx).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

// логин-сьют запускаем последовательно (стабильнее на демо)
test.describe.configure({ mode: 'parallel' });

// E2E-L01 — Переход к форме логина из шапки
test('E2E-L01: Login из хедера открывает форму логина', async ({ page }) => {
  const lp = new LoginPage(page);
  await lp.openViaHeader();

  await expect(lp.heading).toBeVisible();
  await expect(lp.username).toBeVisible();
  await expect(lp.password).toBeVisible();
  await expect(lp.rememberMe).toBeVisible();
  await expect(lp.loginButton).toBeVisible();
  await expect(lp.forgotPasswordLink).toBeVisible();
  await expect(lp.leftRegisterLink).toBeVisible();
  // слева блок "Don't have an account?" — достаточно наличия ссылки Register here
});

// Вспомогалка: успешный логин демо-кредами
async function loginWithDemoCreds(page) {
  const lp = new LoginPage(page);
  await lp.openViaHeader();
  const creds = await lp.getDemoCreds();
  await lp.fill({ username: creds.username, password: creds.password });
  await lp.submit();
  return lp;
}

// E2E-L02 — Успешная авторизация валидными демо-кредами
test('E2E-L02: Успешная авторизация демо-кредами', async ({ page }) => {
  const lp = await loginWithDemoCreds(page);

  // ждём, пока шапка переключится в авторизованное состояние
  await expect(lp.headerMyAccount).toBeVisible({ timeout: 10_000 });
  await expect(lp.headerLogout).toBeVisible();

  // приветствие "Hello ..." делаем необязательным (в разных темах его может не быть)
  const helloVisible = await lp.headerHello.first().isVisible().catch(() => false);
  if (helloVisible) await expect(lp.headerHello).toBeVisible();

  // а вот Login/Register должны исчезнуть обязательно
  await expect(lp.headerLoginLink).toHaveCount(0);
  await expect(lp.headerRegisterLink).toHaveCount(0);
});

// E2E-L03 — Невалидная авторизация: пустая форма
test('E2E-L03: Пустая форма → Invalid credentials', async ({ page }) => {
  const lp = new LoginPage(page);
  await lp.openViaHeader();
  await lp.submit();

  // Проверяем именно error-алерт, игнорируя "Test credentials"
  await expect(lp.errorAlert).toBeVisible();
  await expect(lp.errorAlert).toContainText(/Invalid credentials\./i);
  await expect(lp.heading).toBeVisible();
});

// E2E-L04 — Невалидная авторизация: произвольные неверные данные
test('E2E-L04: Неверные данные → Invalid credentials', async ({ page }) => {
  const lp = new LoginPage(page);
  await lp.openViaHeader();

  await lp.fill({ username: `bad${Date.now()}@example.com`, password: 'wrong-pass' });
  await lp.submit();

  await expect(lp.errorAlert).toBeVisible();
  await expect(lp.errorAlert).toContainText(/Invalid credentials\./i);
  await expect(lp.heading).toBeVisible();
});

// E2E-L05 — Переключение чекбокса Remember me (smoke)
test('E2E-L05: Remember me переключается', async ({ page }) => {
  const lp = new LoginPage(page);
  await lp.openViaHeader();

  const initial = await lp.rememberMe.isChecked().catch(() => false);
  await lp.rememberMe.click();
  const afterFirst = await lp.rememberMe.isChecked();
  expect(afterFirst).toBe(!initial);

  await lp.rememberMe.click();
  const afterSecond = await lp.rememberMe.isChecked();
  expect(afterSecond).toBe(initial);
});

// E2E-L06 — Навигация: Forgot password? → Reset password
test('E2E-L06: Forgot password? ведёт на Reset password', async ({ page }) => {
  const lp = new LoginPage(page);
  await lp.openViaHeader();

  await lp.forgotPasswordLink.click();

  await expect(page.getByRole('heading', { name: /^Reset password$/i })).toBeVisible();
  await expect(page.getByLabel(/Email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Reset$/i })).toBeVisible();
});

// E2E-L07 — Навигация: Register here со страницы логина → регистрация
test('E2E-L07: Register here (с логина) ведёт на регистрацию', async ({ page }) => {
  const lp = new LoginPage(page);
  await lp.openViaHeader();

  await lp.leftRegisterLink.click();

  await expect(page.getByRole('heading', { name: /Create (a new )?customer account|Create a new customer account|Create an account/i })).toBeVisible();
});

// E2E-L08 — Навигация: Register here со страницы Reset password → регистрация
test('E2E-L08: Register here (с Reset password) ведёт на регистрацию', async ({ page }) => {
  const lp = new LoginPage(page);
  await lp.openViaHeader();
  await lp.forgotPasswordLink.click();

  // в левом блоке на Reset password тоже должна быть ссылка Register here
  await page.getByRole('link', { name: /Register here/i }).click();

  await expect(page.getByRole('heading', { name: /Create (a new )?customer account|Create a new customer account|Create an account/i })).toBeVisible();
});

// E2E-L09 — Logout из авторизованного состояния
test('E2E-L09: Logout возвращает неавторизованную шапку', async ({ page }) => {
  const lp = await loginWithDemoCreds(page);
  await lp.headerLogout.click();

  await expect(lp.headerLoginLink).toBeVisible();
  await expect(lp.headerRegisterLink).toBeVisible();
  await expect(lp.headerMyAccount).toHaveCount(0);
  await expect(lp.headerHello).toHaveCount(0);
});
