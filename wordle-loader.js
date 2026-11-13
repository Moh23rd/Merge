/* The hidden game's dictionaries and board code are several hundred KB that
   most visits never need. They load the moment the Wordle screen becomes
   active, whichever way it was reached: the six-piece cover, a history route,
   or a direct link. English keeps its original word list; other languages get
   their own pack. The service worker keeps all of these in the offline shell. */
(function () {
  'use strict';

  const VERSION = '5.3.0-wordle';
  let loading = false;

  function locale() {
    try { return window.SixfoldI18n ? window.SixfoldI18n.locale() : 'en'; } catch (err) { return 'en'; }
  }

  function ensureWordle() {
    if (loading || window.SixfoldWordle) return;
    loading = true;
    const files = [
      'wordle-words.js?v=' + VERSION,
      'wordle-i18n.js?v=' + VERSION
    ];
    if (locale() !== 'en') files.push('wordle-locales.js?v=' + VERSION);
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
