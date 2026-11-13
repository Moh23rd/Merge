/* The hidden game's dictionary and board code are 36KB that most visits never
   need. They load the moment the Wordle screen becomes active, whichever way
   it was reached: the six-piece cover, a history route, or a direct link.
   The service worker keeps both files in the offline shell for later visits. */
(function () {
  'use strict';

  let loading = false;

  function ensureWordle() {
    if (loading || window.SixfoldWordle) return;
    loading = true;
    const files = ['js/wordle-words.js?v=4.0.0-w4', 'js/wordle.js?v=4.0.0-w4'];
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
