/* Vibration feedback only — no audio. */
(function () {
  'use strict';

  const STORE = 'merge2048.haptics';
  let enabled = true;

  try {
    if (localStorage.getItem(STORE) === 'off') enabled = false;
  } catch (err) {
    /* storage blocked — vibration stays on */
  }

  function supported() {
    return typeof navigator.vibrate === 'function';
  }

  function buzz(pattern) {
    if (!enabled || !supported()) return false;
    try {
      return navigator.vibrate(pattern);
    } catch (err) {
      /* some browsers only allow this during a gesture */
      return false;
    }
  }

  window.MergeHaptics = {
    supported: supported,

    merge: function (value) {
      buzz(value >= 256 ? 28 : 14);
    },

    win: function () {
      buzz([20, 45, 20, 45, 90]);
    },

    over: function () {
      buzz([45, 60, 95]);
    },

    isEnabled: function () {
      return enabled;
    },

    toggle: function () {
      enabled = !enabled;
      try {
        localStorage.setItem(STORE, enabled ? 'on' : 'off');
      } catch (err) {
        /* ignore */
      }
      if (enabled) {
        buzz(14);
      } else if (supported()) {
        try {
          navigator.vibrate(0);
        } catch (err) {
          /* ignore */
        }
      }
      return enabled;
    }
  };
})();
