export async function dismissSyliusWidget(page) {
  // нижняя зелёная панель Sylius Plus
  const infoToggle = page.locator('#info-toggle').first(); // квадрат с "i" / "X"
  const infoBox    = page.locator('#info-box').first();    // сам блок

  if (await infoBox.isVisible().catch(() => false)) {
    if (await infoToggle.count()) {
      await infoToggle.click().catch(() => {});
      await infoBox.waitFor({ state: 'hidden', timeout: 1500 }).catch(() => {});
    }
    // подстраховка — клик по самой иконке X
    if (await infoBox.isVisible().catch(() => false)) {
      const xIcon = page.locator('#info-toggle svg.bi-x-lg').first();
      if (await xIcon.count()) {
        await xIcon.click().catch(() => {});
        await infoBox.waitFor({ state: 'hidden', timeout: 1500 }).catch(() => {});
      }
    }
  }
}

