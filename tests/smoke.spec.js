const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

async function expectNoAxeViolations(page, screen) {
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations
    .map((violation) => violation.id + ' (' + violation.impact + '): ' + violation.nodes.map((node) => node.target.join(' ')).join('; '))
    .join('\n');
  expect(results.violations, 'axe violations on ' + screen + ':\n' + summary).toEqual([]);
}

async function expectAllScreensAccessible(page, theme) {
  await page.goto('/');
  await page.waitForSelector('#daily');
  await expect(page.locator('#boot-splash')).toBeHidden();
  await expectNoAxeViolations(page, theme + ' hub');

  for (const game of ['merge', 'sudoku', 'ttt', 'mines', 'water', 'fruit']) {
    await page.locator('[data-game="' + game + '"]').click();
    await expect(page.locator(game === 'merge' ? 'main.app' : '#' + game)).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-screen', game);
    await expectNoAxeViolations(page, theme + ' ' + game);

    if (game === 'merge') await page.locator('#back-to-games').click();
    else await page.locator('#' + game + ' [data-back]').first().click();
    await expect(page.locator('#hub')).toBeVisible();
  }

  await page.locator('#appearance').click();
  await expect(page.locator('#sheet')).toBeVisible();
  await expectNoAxeViolations(page, theme + ' settings');
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

test('hub, every game and settings have no axe violations in light theme', async ({ page }) => {
  await expectAllScreensAccessible(page, 'light');
});

test('hub, every game and settings have no axe violations in dark theme', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('merge2048.theme', 'dark'));
  await expectAllScreensAccessible(page, 'dark');
});
