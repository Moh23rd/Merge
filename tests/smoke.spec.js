const { test, expect } = require('@playwright/test');
const { LOCALES, chooseLocale } = require('./helpers');

test('all six hub cards open their game screen', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.home-game[data-game="merge"]');
  const expected = {
    merge: 'Merge',
    sudoku: 'Sudoku',
    ttt: 'Tic Tac Toe',
    mines: 'Minesweeper',
    water: 'Water Sort',
    fruit: 'Fruit Merge'
  };
  for (const [game, title] of Object.entries(expected)) {
    await page.locator('[data-game="' + game + '"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-screen', game);
    if (game === 'merge') {
      await expect(page.locator('main.app')).toBeVisible();
      await expect(page.locator('main.app h1')).toContainText(title);
      await page.locator('#back-to-games').click();
    } else {
      await expect(page.locator('#' + game)).toBeVisible();
      await expect(page.locator('#' + game + '-title')).toContainText(title);
      await page.locator('#' + game + ' [data-back]').first().click();
    }
    await expect(page.locator('#hub')).toBeVisible();
  }
});

test('Daily Sixfold panel is present and starts the daily Sudoku', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#daily')).toBeVisible();
  await expect(page.locator('#daily-date')).not.toBeEmpty();
  await expect(page.locator('#daily-games .daily-game')).toHaveCount(6);
  await page.locator('#daily-sudoku').click();
  await expect(page.locator('#sudoku')).toBeVisible();
  await expect(page.locator('#sudoku-board .sudoku-cell')).toHaveCount(81);
  await expect(page.locator('#sudoku-status')).toContainText('Daily Sixfold');
});

test('daily section can be hidden and restored from Look & feel', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#daily')).toBeVisible();
  await page.locator('#appearance').click();
  await expect(page.locator('#sheet')).toBeVisible();
  await page.locator('[data-setting="dailyPuzzle"]').click();
  await expect(page.locator('#daily')).toBeHidden();

  await page.reload();
  await expect(page.locator('#daily')).toBeHidden();
  await page.locator('#appearance').click();
  await expect(page.locator('[data-setting="dailyPuzzle"]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-setting="dailyPuzzle"]').click();
  await expect(page.locator('#daily')).toBeVisible();
});

 test('Sudoku settings live in the Sudoku screen', async ({ page }) => {
  await page.goto('/#sudoku');
  await page.waitForSelector('#sudoku-board .sudoku-cell');
  await expect(page.locator('#sheet [data-setting="largeDigits"]')).toHaveCount(0);

  await page.locator('#sudoku-settings-open').click();
  await expect(page.locator('#sudoku-settings')).toBeVisible();
  await page.locator('#sudoku-settings [data-setting="largeDigits"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-large-digits', 'on');
  await page.locator('#sudoku-settings .sheet-done').click();
  await expect(page.locator('#sudoku-settings')).toBeHidden();
});

test('Arabic, Hindi and Kannada interface numbers use native digits', async ({ page }) => {
  await page.goto('/');
  for (const [locale, zero, one, digitPattern] of [
    ['ar', '٠', '٠١', /[٠-٩]/],
    ['hi', '०', '०१', /[०-९]/],
    ['kn', '೦', '೦೧', /[೦-೯]/]
  ]) {
    await page.evaluate((next) => localStorage.setItem('sixfold.locale.v1', next), locale);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('#daily-streak')).toHaveText(zero);
    await expect(page.locator('.daily-game-num').first()).toHaveText(one);
    const date = await page.locator('#daily-date').innerText();
    expect(date).toMatch(digitPattern);
    expect(date).not.toMatch(/[0-9]/);
  }
});

test('Sudoku hint opens the learning panel', async ({ page }) => {
  await page.goto('/#sudoku');
  await page.waitForSelector('#sudoku-board .sudoku-cell');
  await page.locator('#sudoku-hint').click();
  await expect(page.locator('#sudoku-hint-panel')).toBeVisible();
  await expect(page.locator('#sudoku-hint-title')).not.toBeEmpty();
  await expect(page.locator('#sudoku-hint-copy')).not.toBeEmpty();
});

test('appearance settings update the document and backup downloads', async ({ page }) => {
  await page.goto('/');
  await page.locator('#appearance').click();
  await expect(page.locator('#sheet')).toBeVisible();
  await expect(page.locator('#accessibility-settings')).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-setting="sound"]')).toHaveCount(0);
  await page.locator('#accessibility-settings summary').click();
  await expect(page.locator('#accessibility-settings')).toHaveAttribute('open', '');
  await page.locator('[data-setting="highContrast"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await page.locator('[data-setting="highContrast"]').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-contrast', 'high');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#backup-export').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^sixfold-backup-.*\.json$/);
});

test('language switch to Spanish survives a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('#appearance').click();
  await expect(page.locator('#sheet')).toBeVisible();
  await expect(page.locator('#language-picker')).not.toHaveAttribute('open', '');
  await expect(page.locator('#language-seg')).toBeHidden();

  const switched = page.waitForEvent('load');
  await chooseLocale(page, 'es');
  await switched;

  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('#daily-title')).toHaveText('Los seis de hoy.');
  expect(await page.evaluate(() => localStorage.getItem('sixfold.locale.v1'))).toBe('es');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('#daily-title')).toHaveText('Los seis de hoy.');

  await page.locator('#appearance').click();
  await expect(page.locator('#sheet')).toBeVisible();
  await expect(page.locator('[data-locale="es"]')).toHaveAttribute('aria-pressed', 'true');
});

test('language switch back to English survives a reload', async ({ page }) => {
  // Seed Spanish once. addInitScript re-runs on every navigation and would
  // overwrite the English choice that this test is verifying.
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('sixfold.locale.v1', 'es'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.locator('#appearance').click();
  await expect(page.locator('#sheet')).toBeVisible();

  const switched = page.waitForEvent('load');
  await chooseLocale(page, 'en');
  await switched;

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#daily-title')).toHaveText('Today’s six.');
  expect(await page.evaluate(() => localStorage.getItem('sixfold.locale.v1'))).toBe('en');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#daily-title')).toHaveText('Today’s six.');

  await page.locator('#appearance').click();
  await expect(page.locator('#sheet')).toBeVisible();
  await expect(page.locator('[data-locale="en"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-locale="es"]')).toHaveAttribute('aria-pressed', 'false');
});

test('every added language switches from settings and persists', async ({ page }) => {
  // Every added locale, each with a full reload in and out of the picker.
  test.setTimeout(120000);
  await page.goto('/');
  for (const locale of LOCALES.filter((code) => code !== 'en')) {
    await expect(page.locator('#boot-splash')).toBeHidden();
    await page.locator('#appearance').click();
    await expect(page.locator('#sheet')).toBeVisible();
    const switched = page.waitForEvent('load');
    await chooseLocale(page, locale);
    await switched;
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    const daily = await page.evaluate(() => SixfoldI18n.t('Today’s six.'));
    await expect(page.locator('#daily-title')).toHaveText(daily);
    expect(await page.evaluate(() => localStorage.getItem('sixfold.locale.v1'))).toBe(locale);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('#daily-title')).toHaveText(daily);
    await expect(page.locator('#boot-splash')).toBeHidden();
    await page.locator('#appearance').click();
    await expect(page.locator('[data-locale="' + locale + '"]')).toHaveAttribute('aria-pressed', 'true');

    const reset = page.waitForEvent('load');
    await chooseLocale(page, 'en');
    await reset;
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    expect(await page.evaluate(() => localStorage.getItem('sixfold.locale.v1'))).toBe('en');
  }
});
