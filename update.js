/* A non-blocking update prompt. The inline registration in index.html sends
   the ready registration here so beta previews can still strip it. */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const DISMISS_KEY = 'sixfold.update.dismissed.v1';
  let waiting = null;
  let refreshing = false;

  function banner() { return $('update-banner'); }

  function show(worker) {
    if (!worker || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch (err) {}
    waiting = worker;
    const el = banner();
    if (el) el.hidden = false;
  }

  function hide() {
    const el = banner();
    if (el) el.hidden = true;
  }

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (err) {}
    hide();
  }

  function reload() {
    if (!waiting) return;
    refreshing = true;
    const el = banner();
    const copy = el && el.querySelector('.update-copy');
    if (copy) copy.textContent = 'Installing the update…';
    try { waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (err) { location.reload(); }
    window.setTimeout(function () { if (refreshing) location.reload(); }, 1600);
  }

  function watch(registration) {
    if (!registration) return;
    if (registration.waiting) show(registration.waiting);
    registration.addEventListener('updatefound', function () {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', function () {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) show(worker);
      });
    });
  }

  window.addEventListener('sixfold:sw', function (event) { watch(event.detail); });

  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing) location.reload();
    });
    navigator.serviceWorker.ready.then(function (registration) {
      if (registration.waiting) show(registration.waiting);
    }).catch(function () {});
  }

  document.addEventListener('DOMContentLoaded', function () {
    const reloadBtn = $('update-reload');
    const laterBtn = $('update-later');
    if (reloadBtn) reloadBtn.addEventListener('click', reload);
    if (laterBtn) laterBtn.addEventListener('click', dismiss);
  });
})();
