/* Offline cache for Sixfold. Bump VERSION whenever the assets change. */
// 5.3: multilingual Wordle dictionaries, keyboards and result copy.
// 5.3 licenses: add the in-app license view and its source documents.
// 5.3.1: Wordle loads and caches only the active language's dictionary.
// 5.3.2: an uncached locale pack falls back to the English word list.
// 5.3.3: the fallback round saves separately from the localized game.
// 5.3.4: prefetch the active pack and retry it when online returns.
// 5.3.5: show the offline fallback notice.
// 5.3.6: localized release labels, fallback copy and style refresh.
// 5.3.7: 5.2 What’s New copy in every locale, plus RTL panel padding.
const VERSION = 'sixfold-5.3.7-licenses';
// Cache Storage is shared by every app on the origin. Only remove Sixfold's
// own older caches, never another project's offline data.
const CACHE_PREFIX = 'sixfold-';
// Keep these matching index.html. A new cache version refreshes the shell even
// when the asset URLs themselves do not change. The game code has its own
// query suffix, so it must be listed separately or offline play would look for
// files that were never cached.
const ASSET = '4.0.0';
const STYLE_ASSET = '5.2.0';
const FONT_ASSET = '4.0.1';
const THEME_JS = '5.2.0';
const GAME_CODE = '4.0.0-w4';
const WORDLE_CODE = '5.3.6-wordle';
const SUDOKU_GAME_CODE = '5.2.0';
const LOCALE_FONT = '5.1.3';
const GAMES_CSS = '4.0.0-w14';
const POLISH_CSS = '4.0.0-w11';
const GAMES_JS = '5.1.0';
const SUDOKU_CSS = '4.0.0-w13';
const V5_CSS = '5.2.0';
const HOME_CSS = '4.0.0-w5';

const SHELL = [
  './',
  './index.html',
  './licenses.html',
  './LICENSE',
  './APPSTORE-EXCEPTION.md',
  './styles.css?v=' + STYLE_ASSET,
  './theme.js?v=' + THEME_JS,
  './game.js?v=' + GAME_CODE,
  './haptics.js?v=' + ASSET,
  './overscroll.js?v=' + ASSET,
  './celebrate.js?v=' + ASSET,
  './sharecard.js?v=' + ASSET,
  './install.js?v=' + ASSET,
  './games.css?v=' + GAMES_CSS,
  './home.css?v=' + HOME_CSS,
  './polish.css?v=' + POLISH_CSS,
  './sudoku.css?v=' + SUDOKU_CSS,
  './v5.css?v=' + V5_CSS,
  './settings.js?v=5.2.0',
  './sound.js?v=5.1.0',
  './sudoku.js?v=' + SUDOKU_GAME_CODE,
  './games.js?v=' + GAMES_JS,
  './daily.js?v=5.2.0',
  './update.js?v=5.1.0',
  './i18n-fr.js?v=5.3.7',
  './i18n-de.js?v=5.3.7',
  './i18n-zh-hans.js?v=5.3.7',
  './i18n-zh-hant.js?v=5.3.7',
  './i18n-ja.js?v=5.3.7',
  './i18n-ko.js?v=5.3.7',
  './i18n-pt-br.js?v=5.3.7',
  './i18n-hi.js?v=5.3.7',
  './i18n-ar.js?v=5.3.7',
  './i18n-patterns.js?v=5.3.7',
  './i18n.js?v=5.3.7',
  './native.js?v=5.1.0',
  './wordle-loader.js?v=' + WORDLE_CODE,
  // The hidden word game is loaded on demand, but it still belongs in the
  // offline shell so unlocking it works with no connection. The active locale
  // pack is not in the first install; it is cached after its first fetch.
  './wordle-words.js?v=' + WORDLE_CODE,
  './wordle-i18n.js?v=' + WORDLE_CODE,
  './wordle.js?v=' + WORDLE_CODE,
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-1024.png',
  './icons/icon-maskable-512.png',
  './icons/icon-maskable-1024.png',
  './fonts/google-sans-flex.woff2?v=' + FONT_ASSET,
  './fonts/sixfold-sc.woff2?v=' + LOCALE_FONT,
  './fonts/sixfold-tc.woff2?v=' + LOCALE_FONT,
  './fonts/sixfold-jp.woff2?v=' + LOCALE_FONT,
  './fonts/sixfold-kr.woff2?v=' + LOCALE_FONT,
  './fonts/sixfold-devanagari.woff2?v=' + LOCALE_FONT,
  './fonts/sixfold-arabic.woff2?v=' + LOCALE_FONT
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) =>
        Promise.all(
          SHELL.map((url) =>
            fetch(url, { cache: 'reload' }).then((response) => {
              if (!response.ok) throw new Error('Failed to cache ' + url);
              return cache.put(url, response);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The downloadable source archive is a one-off asset, not part of the app
  // shell. Leave it entirely to the browser so a download can never be saved
  // as a page fallback.
  if (url.pathname.endsWith('.zip')) return;

  // Install details must always be current, or the phone keeps its old bar colours.
  if (url.pathname.endsWith('.webmanifest')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(VERSION)
              .then((cache) => cache.put(request, copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Pages: freshest version when online, the saved copy when not. The
  // licenses page is a separate document, so keep its own offline fallback.
  if (request.mode === 'navigate') {
    const page = url.pathname.endsWith('/licenses.html') ? './licenses.html' : './index.html';
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache a successful HTML page. A failed navigation (including
          // GitHub Pages' 404 page) must never replace the offline app shell.
          if (response.ok &&
              (response.headers.get('Content-Type') || '').indexOf('text/html') !== -1) {
            const copy = response.clone();
            caches
              .open(VERSION)
              .then((cache) => cache.put(page, copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.match(page)
            .then((cached) => cached || caches.match('./index.html'))
            .then((cached) => cached || caches.match('./'))
        )
    );
    return;
  }

  // Everything else: serve from cache immediately, refresh quietly for next time.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        fetch(request)
          .then((response) => {
            if (response && response.ok) {
              caches
                .open(VERSION)
                .then((cache) => cache.put(request, response))
                .catch(() => {});
            }
          })
          .catch(() => {});
        return cached;
      }

      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches
            .open(VERSION)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
        }
        return response;
      });
    })
  );
});
