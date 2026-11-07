(() => {
  'use strict';

  const block = document.getElementById('install-block');
  const btn = document.getElementById('install-app');
  const copy = document.getElementById('install-copy');
  if (!block || !btn || !copy) return;

  const displayMode = window.matchMedia('(display-mode: standalone)');
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let prompt = null;

  function installed() {
    return displayMode.matches || navigator.standalone === true;
  }

  function hide() {
    block.hidden = true;
    btn.hidden = true;
  }

  function sync() {
    if (installed()) {
      hide();
      return;
    }

    prompt = window.__mergeInstallPrompt || null;
    if (prompt) {
      block.hidden = false;
      btn.hidden = false;
      copy.textContent = 'Add Merge to your home screen for an app-like, offline-friendly game.';
      return;
    }

    if (isIOS) {
      block.hidden = false;
      btn.hidden = true;
      copy.textContent = 'Open this page in Safari, tap Share, then choose Add to Home Screen.';
      return;
    }

    hide();
  }

  btn.addEventListener('click', async function () {
    if (!prompt) return;
    const deferred = prompt;
    prompt = null;
    try {
      deferred.prompt();
      await deferred.userChoice;
    } catch (err) {
      /* the browser declined to show its prompt */
    }
    window.__mergeInstallPrompt = null;
    sync();
  });

  window.addEventListener('merge:install-available', sync);
  window.addEventListener('appinstalled', function () {
    window.__mergeInstallPrompt = null;
    hide();
  });
  if (displayMode.addEventListener) displayMode.addEventListener('change', sync);

  sync();
})();
