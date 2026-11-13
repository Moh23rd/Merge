const { test } = require('@playwright/test');
const { LANGUAGE_NAMES, LOCALES, setPreferences } = require('./helpers');
const { expectAllScreensAccessible } = require('./accessibility');

for (const locale of LOCALES) {
  test('hub, every game and settings have no axe violations in ' + LANGUAGE_NAMES[locale] + ' dark theme', async ({ page }) => {
    await setPreferences(page, 'dark', locale);
    await expectAllScreensAccessible(page, 'dark', locale);
  });
}
