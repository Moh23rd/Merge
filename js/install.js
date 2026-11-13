(() => {
  'use strict';

  const FIX_DISMISSED_KEY = 'merge2048.installFixDismissed';
  const INSTALLED_KEY = 'merge2048.installed';

  const block = document.getElementById('install-block');
  const btn = document.getElementById('install-app');
  const copy = document.getElementById('install-copy');
  const fix = document.getElementById('install-fix');
  const fixBtn = document.getElementById('install-fix-install');
  const fixNote = document.getElementById('install-fix-note');
  const fixClose = document.getElementById('install-fix-close');
  if (!block || !btn || !copy) return;

  const displayMode = window.matchMedia('(display-mode: standalone)');
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Chrome, Firefox and other iOS browsers still need Safari for a home-screen app.
  const isIOSNonSafari = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome\//.test(ua) && !/EdgA|OPR|SamsungBrowser/.test(ua);
  const chromeMajor = Number((ua.match(/Chrome\/(\d+)/) || [])[1] || 0);
  const isGitHubPages = /(^|\.)github\.io$/i.test(window.location.hostname);
  // Chrome 154–156 treats every app on one origin as installed. The fix
  // shipped in 157.0.8103.15, so only older Chromium builds need this notice.
  const needsChromeInstallFix = isAndroid && isChrome && isGitHubPages &&
    chromeMajor >= 154 && chromeMajor < 157;
  let prompt = null;

  function readFlag(key) {
    try {
      return localStorage.getItem(key) === '1';
    } catch (err) {
      return false;
    }
  }

  function writeFlag(key) {
    try {
      localStorage.setItem(key, '1');
    } catch (err) {
      /* private mode or storage disabled */
    }
  }

  // A dismissal is permanent for this device. The notice is a one-off
  // recovery prompt, not a permanent badge, and a home-screen install also
  // retires it for good.
  let fixDismissed = readFlag(FIX_DISMISSED_KEY);
  let wasInstalled = readFlag(INSTALLED_KEY);

  function installed() {
    return displayMode.matches || navigator.standalone === true;
  }

  function hide() {
    block.hidden = true;
    btn.hidden = true;
  }

  function hideFix() {
    if (fix) fix.hidden = true;
    if (fixBtn) fixBtn.hidden = true;
  }

  function sync() {
    const nowInstalled = installed();
    if (nowInstalled) {
      wasInstalled = true;
      writeFlag(INSTALLED_KEY);
      hide();
      hideFix();
      return;
    }

    prompt = window.__mergeInstallPrompt || null;
    const canPrompt = Boolean(prompt);

    if (needsChromeInstallFix && fix && !fixDismissed && !wasInstalled) {
      fix.hidden = false;
      if (fixBtn) fixBtn.hidden = !canPrompt;
      if (fixNote) {
        fixNote.textContent = canPrompt
          ? 'Chrome 154–156 cannot install a second app from github.io. Use Install app here instead of Chrome’s menu, or update Chrome to 157 or newer.'
          : 'Chrome 154–156 cannot install a second app from github.io. Update Chrome to 157 or newer, then install Sixfold again.';
      }
    } else {
      hideFix();
    }

    if (canPrompt) {
      block.hidden = false;
      btn.hidden = false;
      copy.textContent = 'Add Sixfold to your home screen for an app-like, offline-friendly collection.';
      return;
    }

    if (isIOS) {
      block.hidden = false;
      btn.hidden = true;
      copy.textContent = isIOSNonSafari
        ? 'Open this page in Safari, tap Share, then choose Add to Home Screen.'
        : 'Tap Share, then choose Add to Home Screen.';
      return;
    }

    if (needsChromeInstallFix) {
      block.hidden = false;
      btn.hidden = true;
      copy.textContent = 'Chrome 154–156 cannot install a second app from github.io. Update Chrome to 157 or newer, then try again.';
      return;
    }

    hide();
  }

  async function installFromPrompt() {
    if (!prompt) return;
    const deferred = prompt;
    prompt = null;
    window.__mergeInstallPrompt = null;
    try {
      deferred.prompt();
      await deferred.userChoice;
    } catch (err) {
      /* the browser declined to show its prompt */
    }
    sync();
  }

  btn.addEventListener('click', installFromPrompt);
  if (fixBtn) fixBtn.addEventListener('click', installFromPrompt);

  if (fixClose) {
    fixClose.addEventListener('click', function () {
      fixDismissed = true;
      writeFlag(FIX_DISMISSED_KEY);
      hideFix();
    });
  }

  window.addEventListener('merge:install-available', sync);
  window.addEventListener('appinstalled', function () {
    window.__mergeInstallPrompt = null;
    wasInstalled = true;
    writeFlag(INSTALLED_KEY);
    hide();
    hideFix();
  });
  if (displayMode.addEventListener) displayMode.addEventListener('change', sync);

  sync();
})();
