/* Vibration feedback only — no audio.

   The web Vibration API is a simple on/off motor, so "premium" here means
   restraint: very short pulses, a little space between them, and a stronger
   pattern only when the moment deserves it. Long buzzes read as a phone call;
   the whole set below stays under 150ms. */
(function () {
  'use strict';

  const STORE = 'merge2048.haptics';
  let enabled = true;

  try {
    if (localStorage.getItem(STORE) === 'off') enabled = false;
  } catch (err) {
    /* storage blocked — vibration stays on */
  }

  const api = typeof navigator.vibrate === 'function';
  // Two pulses closer than this blur into one muddy buzz. Coalescing them also
  // stops a rapid Fruit Merge chain from machine-gunning the motor.
  const MIN_GAP = 32;
  let lastPulse = 0;

  const PATTERN = {
    tap: [8],
    mergeLow: [10],
    mergeMid: [11, 16, 9],
    mergeHigh: [12, 18, 10, 18, 12],
    win: [11, 30, 12, 30, 14, 30, 22],
    over: [24, 46, 15]
  };

  function supported() {
    return api;
  }

  function cancel() {
    if (!api) return;
    try {
      navigator.vibrate(0);
    } catch (err) {
      /* ignore */
    }
  }

  function buzz(pattern, force) {
    if (!enabled || !api) return false;
    const now = performance.now();
    if (!force && now - lastPulse < MIN_GAP) return false;
    lastPulse = now;
    try {
      return navigator.vibrate(pattern);
    } catch (err) {
      /* some browsers only allow this during a gesture */
      return false;
    }
  }

  // The home screen stays silent. Browsing cards and scrolling the hub used to
  // fire a tick on every touch, which read as a rattle rather than feedback;
  // vibration now belongs only to moves made inside a game.

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') cancel();
  });
  window.addEventListener('pagehide', cancel);

  window.MergeHaptics = {
    supported: supported,
    cancel: cancel,

    tap: function () {
      buzz(PATTERN.tap);
    },

    merge: function (value) {
      const size = Number(value) || 0;
      if (size >= 256) buzz(PATTERN.mergeHigh);
      else if (size >= 64) buzz(PATTERN.mergeMid);
      else buzz(PATTERN.mergeLow);
    },

    win: function () {
      buzz(PATTERN.win);
    },

    over: function () {
      buzz(PATTERN.over);
    },

    isEnabled: function () {
      return enabled;
    },

    toggle: function () {
      if (enabled) {
        enabled = false;
        try {
          localStorage.setItem(STORE, 'off');
        } catch (err) {
          /* ignore */
        }
        cancel();
        return false;
      }

      enabled = true;
      try {
        localStorage.setItem(STORE, 'on');
      } catch (err) {
        /* ignore */
      }
      // A crisp confirmation on the switch itself, even if the last pulse was
      // a moment ago.
      buzz(PATTERN.tap, true);
      return true;
    }
  };
})();
