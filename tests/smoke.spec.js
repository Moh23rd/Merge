const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

async function waitForEntrance(page) {
  // Screens fade and lift into place. Axe has to measure the settled design; a
  // frame mid-transition reports blended colors. Infinite marquees are ignored.
  await page.waitForFunction(() => {
    return !document.body.getAnimations({ subtree: true }).some((animation) => {
      const timing = animation.effect && animation.effect.getComputedTiming();
      return timing && timing.endTime !== Infinity && animation.playState === 'running';
    });
  });
}

async function expectNoAxeViolations(page, screen) {
  // The pointer stays where the last click landed, which can hover an unrelated
  // control on the next screen. Park it and let the hover transition settle.
  await page.mouse.move(0, 0);
  await waitForEntrance(page);
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations
    .map((violation) => violation.id + ' (' + violation.impact + '): ' + violation.nodes.map((node) => node.target.join(' ')).join('; '))
    .join('\n');
  expect(results.violations, 'axe violations on ' + screen + ':\n' + summary).toEqual([]);
}

async function expectAllScreensAccessible(page, theme, locale) {
  const screen = (locale === 'es' ? 'Spanish ' : 'English ') + theme;
  await page.goto('/');
  await page.waitForSelector('#daily');
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('#boot-splash')).toBeHidden();
  await expect(page.locator('html')).toHaveClass(/home-ready/);
  await waitForEntrance(page);
  await expectNoAxeViolations(page, screen + ' hub');

  for (const game of ['merge', 'sudoku', 'ttt', 'mines', 'water', 'fruit']) {
    await page.locator('[data-game="' + game + '"]').click();
    await expect(page.locator(game === 'merge' ? 'main.app' : '#' + game)).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-screen', game);
    await waitForEntrance(page);
    await expectNoAxeViolations(page, screen + ' ' + game);

    if (game === 'merge') await page.locator('#back-to-games').click();
    else await page.locator('#' + game + ' [data-back]').first().click();
    await expect(page.locator('#hub')).toBeVisible();
  }

  await page.locator('#appearance').click();
  await expect(page.locator('#sheet')).toBeVisible();
  await waitForEntrance(page);
  await expectNoAxeViolations(page, screen + ' settings');
}

async function setPreferences(page, theme, locale) {
  await page.addInitScript(({ theme, locale }) => {
    localStorage.setItem('merge2048.theme', theme);
    localStorage.setItem('sixfold.locale.v1', locale);
  }, { theme, locale });
}

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

  const switched = page.waitForEvent('load');
  await page.locator('[data-locale="es"]').click();
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

test('hub, every game and settings have no axe violations in English light theme', async ({ page }) => {
  await setPreferences(page, 'light', 'en');
  await expectAllScreensAccessible(page, 'light', 'en');
});

test('hub, every game and settings have no axe violations in English dark theme', async ({ page }) => {
  await setPreferences(page, 'dark', 'en');
  await expectAllScreensAccessible(page, 'dark', 'en');
});

test('hub, every game and settings have no axe violations in Spanish light theme', async ({ page }) => {
  await setPreferences(page, 'light', 'es');
  await expectAllScreensAccessible(page, 'light', 'es');
});

test('hub, every game and settings have no axe violations in Spanish dark theme', async ({ page }) => {
  await setPreferences(page, 'dark', 'es');
  await expectAllScreensAccessible(page, 'dark', 'es');
});
