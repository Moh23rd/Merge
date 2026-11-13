const { test, expect } = require('@playwright/test');
const { LANGUAGE_NAMES, LOCALES, setPreferences, expectNoClippedText, openLanguagePicker } = require('./helpers');

async function expectHubSettingsAndGamesFit(page, locale) {
  await page.goto('/');
  await page.waitForSelector('#daily');
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('#boot-splash')).toBeHidden();
  await expect(page.locator('html')).toHaveClass(/home-ready/);
  await expectNoClippedText(page, LANGUAGE_NAMES[locale] + ' hub at 320px', '#hub');

  await page.locator('#appearance').click();
  await expect(page.locator('#sheet')).toBeVisible();
  await openLanguagePicker(page);
  await expectNoClippedText(page, LANGUAGE_NAMES[locale] + ' settings at 320px', '#sheet');
  await page.locator('#sheet-done').click();

  for (const game of ['merge', 'sudoku', 'ttt', 'mines', 'water', 'fruit']) {
    await page.locator('[data-game="' + game + '"]').click();
    await expect(page.locator(game === 'merge' ? 'main.app' : '#' + game)).toBeVisible();
    await expectNoClippedText(page, LANGUAGE_NAMES[locale] + ' ' + game + ' at 320px', game === 'merge' ? 'main.app' : '#' + game);
    if (game === 'merge') await page.locator('#back-to-games').click();
    else await page.locator('#' + game + ' [data-back]').first().click();
    await expect(page.locator('#hub')).toBeVisible();
  }
}

for (const locale of LOCALES) {
  test(LANGUAGE_NAMES[locale] + ' fits a 320px screen without clipped text', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await setPreferences(page, 'light', locale);
    await expectHubSettingsAndGamesFit(page, locale);
  });
}
