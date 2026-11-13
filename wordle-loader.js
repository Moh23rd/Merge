/* The hidden game's dictionaries and board code are several hundred KB that
   most visits never need. They load the moment the Wordle screen becomes
   active, whichever way it was reached: the six-piece cover, a history route,
   or a direct link. English keeps its original word list; every other language
   downloads only its own pack. The service worker caches that active pack
   after the first fetch. */
(function () {
  'use strict';

  const VERSION = '5.3.1-wordle';
  const PACK_LOCALES = ['es', 'fr', 'de', 'pt-BR', 'ar', 'ja', 'hi', 'ko', 'zh-Hans', 'zh-Hant'];
  let loading = false;

  function locale() {
    try { return window.SixfoldI18n ? window.SixfoldI18n.locale() : 'en'; } catch (err) { return 'en'; }
  }

  function ensureWordle() {
    if (loading || window.SixfoldWordle) return;
    loading = true;
    const active = locale();
    const files = [
      'wordle-words.js?v=' + VERSION,
      'wordle-i18n.js?v=' + VERSION
    ];
    if (PACK_LOCALES.indexOf(active) !== -1) {
      files.push('wordle-locales/' + active + '.js?v=' + VERSION);
    }
    files.push('wordle.js?v=' + VERSION);
    files.reduce(function (chain, src) {
      return chain.then(function () {
        return new Promise(function (resolve, reject) {
          const script = document.createElement('script');
          script.src = src;
          script.onload = resolve;
          script.onerror = function () { reject(new Error('Could not load ' + src)); };
          document.head.appendChild(script);
        });
      });
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

  window.SixfoldEnsureWordle = ensureWordle;
})();
