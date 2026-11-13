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

const LANGUAGE_NAMES = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German',
  'zh-Hans': 'Simplified Chinese', 'zh-Hant': 'Traditional Chinese',
  ja: 'Japanese', ko: 'Korean', 'pt-BR': 'Brazilian Portuguese',
  hi: 'Hindi', ar: 'Arabic'
};
const LOCALES = Object.keys(LANGUAGE_NAMES);

async function expectNoClippedText(page, screen, rootSelector) {
  await page.mouse.move(0, 0);
  await waitForEntrance(page);
  const issues = await page.evaluate((rootSelector) => {
    const root = document.querySelector(rootSelector) || document.body;
    const problems = [];
    const viewport = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > viewport + 1) {
      problems.push('page scrolls horizontally (' + document.documentElement.scrollWidth + 'px for ' + viewport + 'px)');
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue.trim()) continue;
      const parent = node.parentElement;
      if (!parent || parent.closest('script,style,svg,textarea,.sr-only,[hidden]')) continue;
      let visiblyHidden = false;
      for (let ancestor = parent; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) { visiblyHidden = true; break; }
      }
      if (visiblyHidden) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const lines = Array.from(range.getClientRects()).filter((rect) => rect.width > 0.5 && rect.height > 0.5);
      if (!lines.length) continue;

      let box = parent;
      while (box && box !== document.body) {
        const boxStyle = getComputedStyle(box);
        const overflow = boxStyle.overflowX + boxStyle.overflowY;
        if (/auto|scroll/.test(overflow)) break;
        if (/hidden|clip/.test(overflow)) {
          const bounds = box.getBoundingClientRect();
          const clipped = lines.some((line) => line.left < bounds.left - 1 || line.right > bounds.right + 1 || line.top < bounds.top - 1 || line.bottom > bounds.bottom + 1);
          if (clipped) {
            problems.push('clipped: "' + node.nodeValue.trim().slice(0, 48) + '" in ' + (box.tagName.toLowerCase() + (box.id ? '#' + box.id : '') + (box.className && typeof box.className === 'string' ? '.' + box.className.trim().split(/\s+/).join('.') : '')));
          }
          break;
        }
        box = box.parentElement;
      }

      lines.forEach((line) => {
        if (line.right > viewport + 1 || line.left < -1) {
          problems.push('outside viewport: "' + node.nodeValue.trim().slice(0, 48) + '"');
        }
      });
    }

    root.querySelectorAll('button, a').forEach((element) => {
      if (element.innerText.trim().length < 3 || element.closest('[hidden],.sr-only')) return;
      if (element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2) {
        problems.push('overflowing control: "' + element.innerText.trim().slice(0, 48) + '"');
      }
    });
    return Array.from(new Set(problems));
  }, rootSelector);
  expect(issues, 'layout issues on ' + screen + ':\n' + issues.join('\n')).toEqual([]);
}

async function openLanguagePicker(page) {
  const picker = page.locator('#language-picker');
  if (!(await picker.evaluate((element) => element.open))) {
    await page.locator('#language-picker summary').click();
  }
}

async function chooseLocale(page, locale) {
  await openLanguagePicker(page);
  await page.locator('[data-locale="' + locale + '"]').click();
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

test('Arabic and Hindi interface numbers use native digits', async ({ page }) => {
  await page.goto('/');
  for (const [locale, zero, one, digitPattern] of [
    ['ar', '٠', '٠١', /[٠-٩]/],
    ['hi', '०', '०१', /[०-९]/]
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
  // Seven locales, each with a full reload in and out of the picker.
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

for (const locale of LOCALES) {
  test(LANGUAGE_NAMES[locale] + ' fits a 320px screen without clipped text', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await setPreferences(page, 'light', locale);
    await expectHubSettingsAndGamesFit(page, locale);
  });
}

for (const locale of LOCALES) {
  for (const theme of ['light', 'dark']) {
    test('hub, every game and settings have no axe violations in ' + LANGUAGE_NAMES[locale] + ' ' + theme + ' theme', async ({ page }) => {
      await setPreferences(page, theme, locale);
      await expectAllScreensAccessible(page, theme, locale);
    });
  }
}

async function openWordle(page) {
  await page.goto('/');
  await page.waitForSelector('#daily');
  await page.waitForFunction(() => document.documentElement.classList.contains('home-ready'));
  for (let i = 0; i < 6; i += 1) {
    await page.evaluate((index) => {
      const piece = document.querySelectorAll('.home-six-piece')[index];
      if (piece) piece.click();
    }, i);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(400);
  if (await page.locator('#hidden-reveal').isVisible()) {
    await page.evaluate(() => document.querySelector('#hidden-reveal-skip').click());
  }
  await page.waitForSelector('body[data-screen="wordle"]');
  await page.waitForSelector('#wordle-board .wordle-tile');
  await page.waitForTimeout(200);
}

test('Wordle uses the selected language dictionary, input mode and result copy', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');
  for (const locale of ['en', 'es', 'ar', 'zh-Hans']) {
    await page.evaluate((next) => localStorage.setItem('sixfold.locale.v1', next), locale);
    await openWordle(page);
    const info = await page.evaluate((code) => {
      const key = 'sixfold.wordle.game.v1' + (code === 'en' ? '' : '::' + code);
      const game = JSON.parse(localStorage.getItem(key));
      const pack = code === 'en'
        ? window.SixfoldWordleWords
        : window.SixfoldWordleLocales[code];
      return {
        answer: game && game.answer,
        inPack: Boolean(pack && game && pack.answers.indexOf(game.answer) !== -1),
        ime: Boolean(document.querySelector('#wordle-ime-input')),
        keys: document.querySelectorAll('#wordle-keyboard .wordle-key').length,
        status: document.querySelector('#wordle-status').textContent
      };
    }, locale);
    expect(info.answer, locale + ' stores a word').toBeTruthy();
    expect(info.inPack, locale + ' word belongs to its pack').toBe(true);
    if (locale === 'en' || locale === 'es') {
      expect(info.ime, locale + ' uses the on-screen letter keyboard').toBe(false);
      expect(info.keys).toBeGreaterThan(20);
    } else {
      expect(info.ime, locale + ' uses the native input field').toBe(true);
      await expect(page.locator('#wordle-ime-input')).toBeVisible();
    }
    await expectNoClippedText(page, locale + ' Wordle', '#wordle');
    if (locale === 'ar') {
      await page.setViewportSize({ width: 320, height: 720 });
      const form = await page.locator('.wordle-ime').boundingBox();
      expect(form.x).toBeGreaterThanOrEqual(0);
      expect(form.x + form.width).toBeLessThanOrEqual(320);
      await page.setViewportSize({ width: 390, height: 844 });
    }

    if (info.ime) {
      await page.locator('#wordle-ime-input').fill(info.answer);
      await page.locator('#wordle-ime-input').press('Enter');
    } else {
      const characters = Array.from(
        new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(info.answer),
        (part) => part.segment
      );
      for (const character of characters) {
        await page.locator('#wordle-keyboard [data-key="' + character + '"]').click();
      }
      await page.locator('#wordle-keyboard [data-key="Enter"]').click();
    }
    await expect(page.locator('#wordle-result')).toBeVisible();
    await expect(page.locator('#wordle-result-title')).not.toBeEmpty();
  }
});

test('Wordle board is accessible in Arabic', async ({ page }) => {
  await setPreferences(page, 'light', 'ar');
  await openWordle(page);
  await expectNoAxeViolations(page, 'Arabic Wordle');
});

test.describe('Wordle locale packs', () => {
  test.use({ serviceWorkers: 'allow' });

  test('downloads and caches only the active language dictionary', async ({ page }) => {
    const packs = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/wordle-locales/')) packs.push(url.pathname);
    });

    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('sixfold.locale.v1', 'es'));
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller);
    await openWordle(page);
    await page.waitForFunction(() => window.SixfoldWordle && window.SixfoldWordleLocales);

    const loaded = await page.evaluate(() => Object.keys(window.SixfoldWordleLocales || {}));
    expect(loaded).toEqual(['es']);
    expect(packs).toEqual(['/wordle-locales/es.js']);

    await expect.poll(async () => page.evaluate(async () => {
      const names = await caches.keys();
      for (const name of names.filter((value) => value.startsWith('sixfold-'))) {
        const cache = await caches.open(name);
        const entries = await cache.keys();
        if (entries.some((request) => new URL(request.url).pathname === '/wordle-locales/es.js')) return true;
      }
      return false;
    })).toBe(true);
  });

  test('keeps an offline English fallback separate from the localized game', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript(() => localStorage.setItem('sixfold.locale.v1', 'es'));
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller);
    await page.waitForFunction(async () => {
      const names = await caches.keys();
      for (const name of names.filter((value) => value.startsWith('sixfold-'))) {
        const cache = await caches.open(name);
        const paths = (await cache.keys()).map((request) => new URL(request.url).pathname);
        if (paths.includes('/index.html') && paths.includes('/wordle.js')) return true;
      }
      return false;
    });

    const cachedPacks = async () => page.evaluate(async () => {
      const names = await caches.keys();
      const packs = [];
      for (const name of names.filter((value) => value.startsWith('sixfold-'))) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          const path = new URL(request.url).pathname;
          if (path.startsWith('/wordle-locales/')) packs.push(path);
        }
      }
      return packs;
    });
    expect(await cachedPacks()).toEqual([]);

    await page.context().setOffline(true);
    await openWordle(page);
    await page.waitForFunction(() => window.SixfoldWordle && window.SixfoldWordleWords);

    const info = await page.evaluate(() => {
      const game = JSON.parse(localStorage.getItem('sixfold.wordle.game.v1'));
      const localized = localStorage.getItem('sixfold.wordle.game.v1::es');
      const words = window.SixfoldWordleWords;
      return {
        answer: game && game.answer,
        inEnglish: Boolean(game && words.answers.indexOf(game.answer) !== -1),
        localized: localized ? JSON.parse(localized) : null,
        packs: Object.keys(window.SixfoldWordleLocales || {})
      };
    });
    expect(info.answer).toBeTruthy();
    expect(info.inEnglish).toBe(true);
    expect(info.localized).toBeNull();
    expect(info.packs).toEqual([]);
    await expect(page.locator('#wordle-board .wordle-tile').first()).toBeVisible();
    expect(await cachedPacks()).toEqual([]);

    await page.context().setOffline(false);
    await openWordle(page);
    await page.waitForFunction(() => window.SixfoldWordleLocales && window.SixfoldWordleLocales.es);
    const transition = await page.evaluate(() => {
      const fallback = JSON.parse(localStorage.getItem('sixfold.wordle.game.v1'));
      const localized = JSON.parse(localStorage.getItem('sixfold.wordle.game.v1::es'));
      const pack = window.SixfoldWordleLocales && window.SixfoldWordleLocales.es;
      return {
        fallbackAnswer: fallback && fallback.answer,
        localizedAnswer: localized && localized.answer,
        inSpanish: Boolean(localized && pack && pack.answers.indexOf(localized.answer) !== -1)
      };
    });
    expect(transition.fallbackAnswer).toBe(info.answer);
    expect(transition.localizedAnswer).toBeTruthy();
    expect(transition.inSpanish).toBe(true);
  });
});
