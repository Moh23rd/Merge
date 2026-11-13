/* Native shell glue. On the web this file does nothing; inside the Capacitor
   wrapper it hides the native launch screen and keeps Android's back gesture
   in step with Sixfold's own navigation. */
(function () {
  'use strict';

  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;

  document.documentElement.classList.add('is-native');
  var plugins = cap.Plugins || {};

  function ignoreRejection(value) {
    if (value && typeof value.catch === 'function') value.catch(function () {});
  }

  function hideSplash() {
    var splash = plugins.SplashScreen;
    if (!splash || !splash.hide) return;
    window.setTimeout(function () {
      try { ignoreRejection(splash.hide()); } catch (err) {}
    }, 820);
  }

  function syncBars() {
    var bar = plugins.StatusBar;
    if (!bar) return;
    var dark = window.MergeTheme && window.MergeTheme.isDark
      ? window.MergeTheme.isDark()
      : document.documentElement.dataset.theme === 'dark';
    try { ignoreRejection(bar.setStyle({ style: dark ? 'DARK' : 'LIGHT' })); } catch (err) {}
    if (cap.getPlatform && cap.getPlatform() === 'android') {
      try { ignoreRejection(bar.setBackgroundColor({ color: dark ? '#1a1918' : '#f6f1e8' })); } catch (err) {}
    }
  }

  function back() {
    if (location.hash && location.hash !== '#hub') {
      if (window.history.length > 1) history.back();
      else location.hash = '#hub';
      return;
    }
    var app = plugins.App;
    if (app && app.minimizeApp) {
      try { ignoreRejection(app.minimizeApp()); } catch (err) {}
    }
  }

  function wireBack() {
    var app = plugins.App;
    if (!app || !app.addListener) return;
    try { ignoreRejection(app.addListener('backButton', back)); } catch (err) {}
  }

  window.addEventListener('load', function () {
    hideSplash();
    syncBars();
  });
  window.addEventListener('merge:appearance', syncBars);
  wireBack();
})();
