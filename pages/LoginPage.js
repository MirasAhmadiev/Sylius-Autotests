// pages/LoginPage.js
export class LoginPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // Header
    this.headerLoginLink = page.getByRole('link', { name: /^Login$/i });
    this.headerRegisterLink = page.getByRole('link', { name: /^Register$/i });
    this.headerMyAccount = page.getByRole('link', { name: /My account/i });
    this.headerLogout = page.getByRole('link', { name: /Logout/i });
    this.headerHello = page.getByText(/^Hello\b/i);

    // Login page
    this.heading = page.getByRole('heading', { name: /^Login$/i });
    this.username = page.getByLabel(/Username|Email/i);
    this.password = page.getByLabel(/Password/i);
    this.rememberMe = page.getByLabel(/Remember me/i);
    this.loginButton = page.getByRole('button', { name: /^Login$/i });
    this.forgotPasswordLink = page.getByRole('link', { name: /Forgot password\?/i });
    this.leftRegisterLink = page.getByRole('link', { name: /Register here/i });

    // Alerts
    this.infoBanner = page.locator('.alert.alert-info');           // "Test credentials"
    this.errorAlert = page.locator('.alert.alert-danger')          // "Invalid credentials."
      .or(page.getByRole('alert').filter({ hasText: /Invalid credentials\./i }));
    this.alert = page.getByRole('alert');
  }

  async openViaHeader() {
    await this.page.goto('/');
    await this.headerLoginLink.click();
    await this.page.waitForURL(/\/(?:[a-z]{2}_[A-Z]{2}\/)?login\b/i);
    await this.page.waitForLoadState('domcontentloaded');
    await this.heading.waitFor();
  }

  async fill({ username, password, remember }) {
    // убедимся, что поля реально готовы к вводу
    await this.username.waitFor({ state: 'visible' });
    await this.password.waitFor({ state: 'visible' });

    if (username !== undefined) await this.username.fill(username);
    if (password !== undefined) await this.password.fill(password);
    if (remember === true) await this.rememberMe.check().catch(() => {});
    if (remember === false) await this.rememberMe.uncheck().catch(() => {});
  }

  async submit() {
    await this.loginButton.click();
  }

  async getDemoCreds() {
    let user = process.env.DEMO_USER || 'fashion@example.com';
    let pass = process.env.DEMO_PASS || 'sylius';
    try {
      const txt = (await this.infoBanner.first().textContent()) || '';
      const m = txt.match(/Username:\s*([^\s]+)[\s\S]*Password:\s*([^\s]+)/i);
      if (m) { user = m[1].trim(); pass = m[2].trim(); }
    } catch { /* ignore */ }
    return { username: user, password: pass };
  }
}
