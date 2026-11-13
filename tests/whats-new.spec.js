const { test, expect } = require('@playwright/test');
const { LANGUAGE_NAMES, LOCALES, expectNoClippedText } = require('./helpers');

const WHATS_NEW_ITEMS = [
  'Wordle in all eleven languages: localized word lists, native input for Arabic, Hindi, Japanese, Korean and Chinese, and an offline English fallback',
  'Wordle offline support: the selected dictionary downloads in the background, and an English fallback round keeps the game playable when it is not cached',
  'Arabic and Hindi numerals, right-to-left Arabic, localized dates and share text across every game',
  'New interface languages: French, German, Chinese, Japanese, Korean, Brazilian Portuguese, Hindi and Arabic, with complete catalogs and offline fonts'
];

test.describe('What’s New 5.2', () => {
  for (const locale of LOCALES) {
    test(LANGUAGE_NAMES[locale] + ' translations and 320px layout', async ({ page }) => {
      await page.addInitScript(({ locale }) => {
        localStorage.setItem('sixfold.locale.v1', locale);
        localStorage.removeItem('sixfold.whats-new.dismissed');
      }, { locale });
      await page.goto('/');
      await page.waitForFunction((locale) => document.documentElement.lang === locale && window.SixfoldI18n, locale);

      const panel = page.locator('#whats-new');
      await expect(panel).toBeVisible();
      const rendered = await panel.locator('.whats-new-list li').evaluateAll((items) => items.map((item) => item.textContent.trim()));
      const expected = await page.evaluate((keys) => keys.map((key) => window.SixfoldI18n.t(key)), WHATS_NEW_ITEMS);
      expect(rendered).toEqual(expected);

      const heading = (await panel.locator('.whats-new-label').textContent()).trim();
      const expectedHeading = await page.evaluate(() => {
        const i18n = window.SixfoldI18n;
        return i18n.number(i18n.t('What’s new in 5.2'));
      });
      expect(heading).toBe(expectedHeading);

      if (locale !== 'en') {
        expect(heading, locale + ' heading').not.toBe('What’s new in 5.2');
        expected.forEach((text, index) => {
          expect(text, locale + ' item ' + (index + 1)).not.toBe(WHATS_NEW_ITEMS[index]);
        });
      }

      await page.setViewportSize({ width: 320, height: 720 });
      await expectNoClippedText(page, LANGUAGE_NAMES[locale] + ' What’s New at 320px', '#whats-new');

      if (locale === 'ar') {
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
        const direction = await panel.evaluate((element) => getComputedStyle(element).direction);
        expect(direction, 'Arabic What’s New direction').toBe('rtl');
        const width = await panel.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
        expect(width.scrollWidth, 'Arabic What’s New must not overflow').toBeLessThanOrEqual(width.clientWidth + 1);
      }
    });
  }
});
