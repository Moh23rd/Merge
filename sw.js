/* Offline cache for Sixfold. Bump VERSION whenever the assets change. */
// 3.0: the shell is rebuilt so the three-second result timing and the
// restored What's New note reach clients that already hold an older cache.
const VERSION = 'sixfold-3.0.9';
// Keep these matching index.html. A new cache version refreshes the shell even
// when the asset URLs themselves do not change. The game code has its own
// query suffix, so it must be listed separately or offline play would look for
// files that were never cached.
const ASSET = '3.0.0';
const GAME_CODE = '3.0.0-w4';
const GAMES_CSS = '3.0.0-w6';
const POLISH_CSS = '3.0.0-w8';
const GAMES_JS = '3.0.0-w10';
const SUDOKU_CSS = '3.0.0-w8';

const SHELL = [
  './',
  './index.html',
  './styles.css?v=' + ASSET,
  './theme.js?v=' + ASSET,
  './game.js?v=' + GAME_CODE,
  './haptics.js?v=' + ASSET,
  './overscroll.js?v=' + ASSET,
  './celebrate.js?v=' + ASSET,
  './sharecard.js?v=' + ASSET,
  './install.js?v=' + ASSET,
  './games.css?v=' + GAMES_CSS,
  './home.css?v=' + ASSET,
  './polish.css?v=' + POLISH_CSS,
  './sudoku.css?v=' + SUDOKU_CSS,
  './sudoku.js?v=' + GAME_CODE,
  './games.js?v=' + GAMES_JS,
  './wordle-loader.js?v=' + GAME_CODE,
  // The hidden word game is loaded on demand, but it still belongs in the
  // offline shell so unlocking it works with no connection.
  './wordle-words.js?v=' + GAME_CODE,
  './wordle.js?v=' + GAME_CODE,
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-1024.png',
  './icons/icon-maskable-512.png',
  './icons/icon-maskable-1024.png',
  './fonts/google-sans-flex.woff2?v=' + ASSET
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
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
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
          const copy = response.clone();
          caches
            .open(VERSION)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Pages: freshest version when online, the saved copy when not.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache a real HTML page. A non-page navigation must never
          // replace the offline app shell.
          if ((response.headers.get('Content-Type') || '').indexOf('text/html') !== -1) {
            const copy = response.clone();
            caches
              .open(VERSION)
              .then((cache) => cache.put('./index.html', copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.match('./index.html').then((cached) => cached || caches.match('./'))
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
