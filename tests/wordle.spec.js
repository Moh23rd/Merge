const { test, expect } = require('@playwright/test');
const { LANGUAGE_NAMES, LOCALES, setPreferences, expectNoClippedText, chooseLocale } = require('./helpers');
const { expectNoAxeViolations } = require('./accessibility');

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

  const cachedPacks = (page) => page.evaluate(async () => {
    const packs = [];
    for (const name of (await caches.keys()).filter((value) => value.startsWith('sixfold-'))) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const path = new URL(request.url).pathname;
        if (path.startsWith('/wordle-locales/')) packs.push(path);
      }
    }
    return packs;
  });

  const waitForShell = (page) => page.waitForFunction(async () => {
    const names = await caches.keys();
    for (const name of names.filter((value) => value.startsWith('sixfold-'))) {
      const cache = await caches.open(name);
      const paths = (await cache.keys()).map((request) => new URL(request.url).pathname);
      if (paths.includes('/index.html') && paths.includes('/wordle.js')) return true;
    }
    return false;
  });

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
    expect([...new Set(packs)]).toEqual(['/wordle-locales/es.js']);
    await expect.poll(() => cachedPacks(page)).toContain('/wordle-locales/es.js');
  });

  test('prefetches the newly selected language after a language change', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller);
    await page.locator('#appearance').click();
    await chooseLocale(page, 'es');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect.poll(() => cachedPacks(page)).toContain('/wordle-locales/es.js');
  });

  test('prefetches the active dictionary after an online visit', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sixfold.locale.v1', 'es'));
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller);
    await expect.poll(() => cachedPacks(page)).toContain('/wordle-locales/es.js');

    await page.context().setOffline(true);
    await openWordle(page);
    await page.waitForFunction(() => window.SixfoldWordleLocales && window.SixfoldWordleLocales.es);
    const info = await page.evaluate(() => {
      const game = JSON.parse(localStorage.getItem('sixfold.wordle.game.v1::es'));
      const pack = window.SixfoldWordleLocales.es;
      return {
        answer: game && game.answer,
        inSpanish: Boolean(game && pack && pack.answers.indexOf(game.answer) !== -1),
        fallback: localStorage.getItem('sixfold.wordle.game.v1::offline-en'),
        noticeHidden: document.getElementById('wordle-offline').hidden
      };
    });
    expect(info.answer).toBeTruthy();
    expect(info.inSpanish).toBe(true);
    expect(info.fallback).toBeNull();
    expect(info.noticeHidden).toBe(true);
    await expect(page.locator('#wordle-offline')).toBeHidden();
  });

  test('retries the active dictionary when the connection returns', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller);
    await waitForShell(page);
    await page.evaluate(() => localStorage.setItem('sixfold.locale.v1', 'es'));

    await page.context().setOffline(true);
    await page.reload();
    expect(await cachedPacks(page)).toEqual([]);

    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => cachedPacks(page)).toContain('/wordle-locales/es.js');
  });

  test('keeps an offline English fallback separate from the localized game', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller);
    await waitForShell(page);
    await openWordle(page);
    const englishAnswer = await page.evaluate(() => {
      const game = JSON.parse(localStorage.getItem('sixfold.wordle.game.v1'));
      return game && game.answer;
    });
    expect(englishAnswer).toBeTruthy();

    await page.context().setOffline(true);
    await page.evaluate(() => localStorage.setItem('sixfold.locale.v1', 'es'));
    expect(await cachedPacks(page)).toEqual([]);
    await openWordle(page);

    const info = await page.evaluate(() => {
      const fallback = JSON.parse(localStorage.getItem('sixfold.wordle.game.v1::offline-en'));
      const english = JSON.parse(localStorage.getItem('sixfold.wordle.game.v1'));
      const localized = localStorage.getItem('sixfold.wordle.game.v1::es');
      const words = window.SixfoldWordleWords;
      return {
        answer: fallback && fallback.answer,
        inEnglish: Boolean(fallback && words.answers.indexOf(fallback.answer) !== -1),
        englishAnswer: english && english.answer,
        localized: localized ? JSON.parse(localized) : null,
        packs: Object.keys(window.SixfoldWordleLocales || {}),
        guesses: fallback && fallback.guesses.length,
        notice: (function () {
          const el = document.getElementById('wordle-offline');
          return el && !el.hidden ? el.textContent : '';
        })()
      };
    });
    expect(info.answer).toBeTruthy();
    expect(info.inEnglish).toBe(true);
    expect(info.englishAnswer).toBe(englishAnswer);
    expect(info.localized).toBeNull();
    expect(info.packs).toEqual([]);
    expect(info.guesses).toBe(0);
    expect(info.notice).toContain('Sin conexión');
    const notice = page.locator('#wordle-offline');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('role', 'note');
    await expect(notice).toHaveAttribute('aria-live', 'polite');
    await expect(notice).toContainText('diccionario');
    await expect(notice).toContainText('no está disponible');
    await expectNoClippedText(page, 'Spanish Wordle fallback', '#wordle');
    await page.setViewportSize({ width: 320, height: 720 });
    await expectNoClippedText(page, 'Spanish Wordle fallback at 320px', '#wordle .wordle-main');
    await page.setViewportSize({ width: 390, height: 844 });

    await page.context().setOffline(false);
    await openWordle(page);
    await page.waitForFunction(() => window.SixfoldWordleLocales && window.SixfoldWordleLocales.es);
    const transition = await page.evaluate(() => {
      const fallback = JSON.parse(localStorage.getItem('sixfold.wordle.game.v1::offline-en'));
      const english = JSON.parse(localStorage.getItem('sixfold.wordle.game.v1'));
      const localized = JSON.parse(localStorage.getItem('sixfold.wordle.game.v1::es'));
      const pack = window.SixfoldWordleLocales && window.SixfoldWordleLocales.es;
      return {
        fallbackAnswer: fallback && fallback.answer,
        fallbackGuesses: fallback && fallback.guesses.length,
        englishAnswer: english && english.answer,
        localizedAnswer: localized && localized.answer,
        localizedGuesses: localized && localized.guesses.length,
        noticeHidden: document.getElementById('wordle-offline').hidden,
        inSpanish: Boolean(localized && pack && pack.answers.indexOf(localized.answer) !== -1)
      };
    });
    expect(transition.fallbackAnswer).toBe(info.answer);
    expect(transition.fallbackGuesses).toBe(0);
    expect(transition.englishAnswer).toBe(englishAnswer);
    expect(transition.localizedAnswer).toBeTruthy();
    expect(transition.localizedGuesses).toBe(0);
    expect(transition.noticeHidden).toBe(true);
    expect(transition.inSpanish).toBe(true);
  });
});

const WORDLE_IME_LOCALES = ['ar', 'hi', 'ja', 'ko', 'zh-Hans', 'zh-Hant'];

async function captureWordleShare(page) {
  await page.evaluate(() => {
    window.__wordleShare = '';
    // Force the text fallback so the test observes the same localized copy a
    // browser without file sharing would copy. The stub also keeps the test
    // independent of clipboard permissions.
    try { Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); } catch (err) {}
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: function (text) {
            window.__wordleShare = text;
            return Promise.resolve();
          }
        }
      });
    } catch (err) {}
  });
  await page.locator('#wordle-result-share').click();
  await page.waitForFunction(() => Boolean(window.__wordleShare));
  return page.evaluate(() => window.__wordleShare);
}

for (const locale of LOCALES) {
  test('Wordle end-to-end matrix: ' + LANGUAGE_NAMES[locale], async ({ page }) => {
    test.setTimeout(45000);
    await setPreferences(page, 'light', locale);
    await openWordle(page);

    const stateKey = 'sixfold.wordle.game.v1' + (locale === 'en' ? '' : '::' + locale);
    const info = await page.evaluate(({ stateKey, locale }) => {
      const game = JSON.parse(localStorage.getItem(stateKey));
      const pack = locale === 'en'
        ? window.SixfoldWordleWords
        : window.SixfoldWordleLocales[locale];
      const ime = document.querySelector('#wordle-ime-input');
      return {
        answer: game && game.answer,
        inPack: Boolean(game && pack && pack.answers.indexOf(game.answer) !== -1),
        ime: Boolean(ime),
        dir: document.documentElement.dir,
        inputDir: ime ? getComputedStyle(ime).direction : null
      };
    }, { stateKey, locale });

    expect(info.answer, locale + ' stores an answer').toBeTruthy();
    expect(info.inPack, locale + ' answer belongs to its pack').toBe(true);
    expect(info.ime, locale + ' input mode').toBe(WORDLE_IME_LOCALES.includes(locale));
    expect(info.dir, locale + ' document direction').toBe(locale === 'ar' ? 'rtl' : 'ltr');
    if (locale === 'ar') {
      expect(info.inputDir, 'Arabic IME direction').toBe('rtl');
      await expect(page.locator('#wordle-ime-input')).toHaveAttribute('dir', 'rtl');
      const screenDirection = await page.locator('#wordle').evaluate((element) => getComputedStyle(element).direction);
      expect(screenDirection, 'Arabic Wordle layout direction').toBe('rtl');
    }

    if (info.ime) {
      const input = page.locator('#wordle-ime-input');
      await expect(input).toBeVisible();
      await input.fill(info.answer);
      await input.press('Enter');
    } else {
      const characters = Array.from(
        new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(info.answer),
        (part) => part.segment
      );
      for (const character of characters) {
        await page.evaluate((key) => {
          const button = Array.from(document.querySelectorAll('#wordle-keyboard [data-key]'))
            .find((candidate) => candidate.dataset.key === key);
          if (!button) throw new Error('Missing keyboard key ' + key);
          button.click();
        }, character);
      }
      await page.locator('#wordle-keyboard [data-key="Enter"]').click();
    }

    await expect(page.locator('#wordle-result')).toBeVisible();
    await expect(page.locator('#wordle-result-title')).not.toBeEmpty();

    const digits = locale === 'ar' ? /[٠-٩]/ : locale === 'hi' ? /[०-९]/ : null;
    const played = await page.locator('#wordle-played').innerText();
    const streak = await page.locator('#wordle-streak').innerText();
    const stats = await page.locator('#wordle-result-stats').innerText();
    const boardLabel = await page.locator('#wordle-board').getAttribute('aria-label');
    expect(played).not.toBe('');
    expect(streak).not.toBe('');
    expect(stats).not.toBe('');
    expect(boardLabel).toBeTruthy();
    if (digits) {
      expect(played, locale + ' played digits').toMatch(digits);
      expect(streak, locale + ' streak digits').toMatch(digits);
      expect(stats, locale + ' stats digits').not.toMatch(/[0-9]/);
      expect(boardLabel, locale + ' board digits').not.toMatch(/[0-9]/);
    }

    const share = await captureWordleShare(page);
    expect(share).toContain('Sixfold — Wordle');
    expect(share).toContain('🟩🟩🟩🟩🟩');
    if (locale === 'ar') expect(share).toContain('١/٦');
    else if (locale === 'hi') expect(share).toContain('१/६');
    else expect(share).toContain('1/6');
  });
}
