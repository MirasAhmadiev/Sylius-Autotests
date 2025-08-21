export class RegistrationPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    this.linkRegister = page.getByRole('link', { name: 'Register' });
    this.heading = page.getByRole('heading', {
      name: /Create (a new )?customer account|Create a new customer account|Create an account/i,
    });

    this.firstName = page.getByLabel('First name');
    this.lastName = page.getByLabel('Last name');
    this.email = page.getByLabel('Email');
    this.phone = page.getByLabel('Phone number').or(page.locator('input[name*="[phoneNumber]"]'));
    this.password = page.getByLabel('Password');
    this.verification = page.getByLabel('Verification');
    this.newsletter = page.getByLabel('Subscribe to the newsletter')
      .or(page.locator('[name*="[subscribedToNewsletter]"]'));

    this.submit = page.getByRole('button', { name: 'Create an account' });
    this.successAlert = page.getByRole('alert');
    this.signInLink = page.getByRole('link', { name: 'Sign in here.' });
  }

  async open() {
    await this.page.goto('/');
    await this.linkRegister.click();
    await this.heading.waitFor();
  }

  async fill({ firstName, lastName, email, phone, password, verification, subscribe }) {
    if (firstName !== undefined) await this.firstName.fill(firstName);
    if (lastName !== undefined) await this.lastName.fill(lastName);
    if (email !== undefined) await this.email.fill(email);
    if (phone !== undefined) await this.phone.fill(phone);
    if (password !== undefined) await this.password.fill(password);
    if (verification !== undefined) await this.verification.fill(verification);
    if (subscribe === true) await this.newsletter.check().catch(() => {});
    if (subscribe === false) await this.newsletter.uncheck().catch(() => {});
  }

  async submitForm() {
    await this.submit.click();
  }
}
