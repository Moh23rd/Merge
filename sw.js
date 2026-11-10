/* Offline cache for Sixfold. Bump VERSION whenever the assets change. */
const VERSION = 'sixfold-3.0.0';
// Keep these matching index.html. A new cache version refreshes the shell even
// when the asset URLs themselves do not change.
const ASSET = '3.0.0';
const GAMES = '3.0.0';

const SHELL = [
  './',
  './index.html',
  './styles.css?v=' + ASSET,
  './theme.js?v=' + ASSET,
  './game.js?v=' + ASSET,
  './haptics.js?v=' + ASSET,
  './overscroll.js?v=' + ASSET,
  './celebrate.js?v=' + ASSET,
  './sharecard.js?v=' + ASSET,
  './install.js?v=' + ASSET,
  './games.css?v=' + GAMES,
  './home.css?v=' + GAMES,
  './polish.css?v=' + GAMES,
  './games.js?v=' + GAMES,
  './wordle-loader.js?v=' + GAMES,
  // The hidden word game is loaded on demand, but it still belongs in the
  // offline shell so unlocking it works with no connection.
  './wordle-words.js?v=' + GAMES,
  './wordle.js?v=' + GAMES,
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
