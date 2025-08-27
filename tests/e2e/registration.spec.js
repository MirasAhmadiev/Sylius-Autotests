import { test, expect } from '@playwright/test';
import { RegistrationPage } from '../../pages/RegistrationPage';
import { userBuilder, uniqueEmail } from '../../utils/dataBuilders';

// Вспомогательный ассерт на текст ошибки (бывает разный casing/пробелы)
const byText = (page, text) => page.getByText(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

// E2E-01 — Переход к форме регистрации
test('E2E-01: Register из хедера ведёт к форме регистрации', async ({ page }) => {
  const reg = new RegistrationPage(page);
  await reg.open();

  await expect(reg.heading).toBeVisible();
  await expect(reg.firstName).toBeVisible();
  await expect(reg.lastName).toBeVisible();
  await expect(reg.email).toBeVisible();
  await expect(reg.password).toBeVisible();
  await expect(reg.verification).toBeVisible();
  await expect(reg.submit).toBeVisible();
  await expect(reg.signInLink).toBeVisible();
});

// E2E-02 — Успешная регистрация (happy path)
test('E2E-02: Успешная регистрация', async ({ page }) => {
  const reg = new RegistrationPage(page);
  await reg.open();

  await reg.fill(
    userBuilder({
      email: uniqueEmail('anna'),
    })
  );
  await reg.submitForm();

  await expect(reg.successAlert).toBeVisible();
  await expect(reg.successAlert).toContainText(
    'Thank you for registering, check your email to verify your account.'
  );
  await expect(byText(page, 'Thank you for your registration')).toBeVisible();
});

// E2E-03 — Обязательные поля: сабмит пустой формы
test('E2E-03: Сабмит пустой формы — обязательные поля подсвечены', async ({ page }) => {
  const reg = new RegistrationPage(page);
  await reg.open();

  await reg.submitForm();

  await expect(byText(page, 'Please enter your first name.')).toBeVisible();
  await expect(byText(page, 'Please enter your last name.')).toBeVisible();
  await expect(byText(page, 'Please enter your email.')).toBeVisible();
  await expect(byText(page, 'Please enter your password.')).toBeVisible();

  // Verification: только если реально помечено как required в DOM
  const isRequired = await reg.verification.evaluate(
    el => el.hasAttribute('required') || el.getAttribute('aria-required') === 'true'
  );
  if (isRequired) {
    const isInvalid = await reg.verification.evaluate(el => !el.checkValidity());
    expect(isInvalid, 'Verification must be invalid on empty submit').toBeTruthy();
  } else {
    test.info().annotations.push({
      type: 'note',
      description: 'Verification не помечено как required в текущем билде — пропускаем проверку',
    });
  }
});

// E2E-04 — Минимальная длина: имя/фамилия/пароль (параметризованный)
test('E2E-04: Минимальная длина для First/Last name и Password', async ({ page }) => {
  const cases = [
    {
      name: 'First name minLength(2)',
      overrides: { firstName: '1' },
      expectText: 'First name must be at least 2 characters long.',
    },
    {
      name: 'Last name minLength(2)',
      overrides: { lastName: '1' },
      expectText: 'Last name must be at least 2 characters long.',
    },
    {
      name: 'Password minLength(4)',
      overrides: { password: 'a', verification: 'a' },
      expectText: 'Password must be at least 4 characters long.',
    },
  ];

  for (const [i, c] of cases.entries()) {
    await test.step(c.name, async () => {
      const reg = new RegistrationPage(page);
      await reg.open();

      await reg.fill(
        userBuilder({
          email: uniqueEmail(`min-${i}`),
          ...c.overrides,
        })
      );
      await reg.submitForm();

      await expect(byText(page, c.expectText)).toBeVisible();

      // Проверяем, что ошибки из других кейсов не всплыли
      for (const other of cases.filter(x => x !== c)) {
        await expect(byText(page, other.expectText)).toHaveCount(0);
      }
    });
  }
});

// E2E-05 — Валидация email: формат некорректный (параметризованный)
test('E2E-05: Неверный формат email', async ({ page }) => {
  const invalid = ['user@', 'sad@d', 'user.example.com'];

  for (const [i, email] of invalid.entries()) {
    await test.step(`email = ${email}`, async () => {
      const reg = new RegistrationPage(page);
      await reg.open();

      await reg.fill(
        userBuilder({
          email,
        })
      );
      await reg.submitForm();

      await expect(byText(page, 'This email is invalid.')).toBeVisible();
    });
  }
});

// E2E-06 — Несовпадение паролей
test("E2E-06: Несовпадение паролей — сообщение 'don't match'", async ({ page }) => {
  const reg = new RegistrationPage(page);
  await reg.open();

  await reg.fill(
    userBuilder({
      email: uniqueEmail('mismatch'),
      password: 'qwer',
      verification: 'qwe1',
    })
  );
  await reg.submitForm();

  await expect(byText(page, "The entered passwords don't match")).toBeVisible();
});

// E2E-06a: Пустая Verification при заполненном Password
test("E2E-06a: Пустая Verification при заполненном Password — показывает 'don't match'", async ({ page }) => {
  const reg = new RegistrationPage(page);
  await reg.open();

  await reg.fill(userBuilder({
    email: uniqueEmail('blank-ver'),
    password: 'qwer',
    verification: '' // пусто
  }));
  await reg.submitForm();

  await expect(byText(page, "The entered passwords don't match")).toBeVisible();
});

// E2E-07 — "Sign in here." ведёт на страницу логина
test('E2E-07: Переход по ссылке Sign in here -> Login', async ({ page }) => {
  const reg = new RegistrationPage(page);
  await reg.open();

  await reg.signInLink.click();

  // URL с учётом возможного префикса локали (например, /en_US/login)
  await expect(page).toHaveURL(/\/(?:[a-z]{2}_[A-Z]{2}\/)?login\b/i);

  // Ключевые элементы формы логина
  await expect(page.getByRole('heading', { name: /^Login$/i })).toBeVisible();
  await expect(page.getByLabel(/Username|Email/i)).toBeVisible();
  await expect(page.getByLabel(/Password/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Login$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Forgot password\?/i })).toBeVisible();
});
