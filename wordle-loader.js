/* The hidden game's dictionaries and board code are several hundred KB that
   most visits never need. They load the moment the Wordle screen becomes
   active, whichever way it was reached: the six-piece cover, a history route,
   or a direct link. English keeps its original word list; every other language
   downloads only its own pack. The service worker caches that active pack
   after the first fetch. */
(function () {
  'use strict';

  const VERSION = '5.3.6-wordle';
  const PACK_LOCALES = ['es', 'fr', 'de', 'pt-BR', 'ar', 'ja', 'hi', 'ko', 'zh-Hans', 'zh-Hant'];
  const prefetched = Object.create(null);
  const prefetching = Object.create(null);
  let loading = false;

  function locale() {
    try { return window.SixfoldI18n ? window.SixfoldI18n.locale() : 'en'; } catch (err) { return 'en'; }
  }

  function loadScript(src, optional) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = function () {
        // A locale pack may not be cached on an offline first visit. The game
        // already falls back to the English word list, so keep loading it.
        if (optional) {
          resolve();
        } else {
          reject(new Error('Could not load ' + src));
        }
      };
      document.head.appendChild(script);
    });
  }

  function prefetchPack() {
    const active = locale();
    if (PACK_LOCALES.indexOf(active) === -1) return;
    if (prefetched[active] || prefetching[active]) return;
    if (window.SixfoldWordleLocales && window.SixfoldWordleLocales[active]) {
      prefetched[active] = true;
      return;
    }
    if (!navigator.onLine) return;

    prefetching[active] = true;
    fetch('wordle-locales/' + active + '.js?v=' + VERSION, { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('Could not prefetch ' + active);
        prefetched[active] = true;
      })
      .catch(function () {
        // The online listener retries after a failed or offline request.
      })
      .then(function () { delete prefetching[active]; });
  }

  function whenWorkerReady(task) {
    if (!navigator.serviceWorker || !navigator.serviceWorker.ready) {
      task();
      return;
    }
    navigator.serviceWorker.ready.then(function (registration) {
      const pending = registration.installing || registration.waiting;
      if (navigator.serviceWorker.controller && !pending) {
        task();
        return;
      }
      // On a first visit the worker can be active before it claims this page,
      // and during an update the newest cache is not ready yet. Prefetch once
      // the page is controlled so the pack lands in the current cache.
      navigator.serviceWorker.addEventListener('controllerchange', task, { once: true });
    }, task);
  }

  function schedulePrefetch() {
    whenWorkerReady(function () {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(prefetchPack, { timeout: 2000 });
      } else {
        window.setTimeout(prefetchPack, 500);
      }
    });
  }

  function ensureWordle() {
    if (loading || window.SixfoldWordle) return;
    loading = true;
    const active = locale();
    const files = [
      { src: 'wordle-words.js?v=' + VERSION },
      { src: 'wordle-i18n.js?v=' + VERSION }
    ];
    if (PACK_LOCALES.indexOf(active) !== -1) {
      files.push({ src: 'wordle-locales/' + active + '.js?v=' + VERSION, optional: true });
    }
    files.push({ src: 'wordle.js?v=' + VERSION });
    files.reduce(function (chain, file) {
      return chain.then(function () { return loadScript(file.src, file.optional); });
    }, Promise.resolve()).catch(function () {
      loading = false;
    });
  }

  // games.js owns the unlock and the routing; watching the screen flag keeps
  // this loader out of that logic and makes it work for every entry path.
  function checkScreen() {
    if (document.body && document.body.dataset.screen === 'wordle') ensureWordle();
  }

  if (document.body) {
    new MutationObserver(checkScreen).observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
    checkScreen();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      new MutationObserver(checkScreen).observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
      checkScreen();
    });
  }

  if (document.readyState === 'complete') schedulePrefetch();
  else window.addEventListener('load', schedulePrefetch);
  window.addEventListener('online', function () { whenWorkerReady(prefetchPack); });

  window.SixfoldEnsureWordle = ensureWordle;
})();
