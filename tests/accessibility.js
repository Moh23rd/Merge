const { expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { LANGUAGE_NAMES, waitForEntrance, expectNoClippedText, openLanguagePicker } = require('./helpers');

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
  const screen = LANGUAGE_NAMES[locale] + ' ' + theme;
  await page.goto('/');
  await page.waitForSelector('#daily');
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('#boot-splash')).toBeHidden();
  await expect(page.locator('html')).toHaveClass(/home-ready/);
  await waitForEntrance(page);
  await expectNoAxeViolations(page, screen + ' hub');
  await expectNoClippedText(page, screen + ' hub', '#hub');

  for (const game of ['merge', 'sudoku', 'ttt', 'mines', 'water', 'fruit']) {
    await page.locator('[data-game="' + game + '"]').click();
    await expect(page.locator(game === 'merge' ? 'main.app' : '#' + game)).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-screen', game);
    await waitForEntrance(page);
    await expectNoAxeViolations(page, screen + ' ' + game);
    await expectNoClippedText(page, screen + ' ' + game, game === 'merge' ? 'main.app' : '#' + game);

    if (game === 'merge') await page.locator('#back-to-games').click();
    else await page.locator('#' + game + ' [data-back]').first().click();
    await expect(page.locator('#hub')).toBeVisible();
  }

  await page.locator('#appearance').click();
  await expect(page.locator('#sheet')).toBeVisible();
  await openLanguagePicker(page);
  await waitForEntrance(page);
  await expectNoAxeViolations(page, screen + ' settings');
  await expectNoClippedText(page, screen + ' settings', '#sheet');
}

module.exports = { expectNoAxeViolations, expectAllScreensAccessible };
