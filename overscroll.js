/* Android 12 and later replaced the old overscroll glow with a stretch: the
   content pulls past the edge, stretches, then springs back. A fixed app shell
   with its own scroller never receives that effect, so the home screen
   reproduces it here. The pull is damped and capped rather than tracking the
   finger 1:1, which is what makes the platform's version feel physical.

   iOS keeps its native rubber band: this file does nothing there, and the CSS
   that disables the native edge effect is scoped to the class added below. */
(function () {
  'use strict';

  const ua = navigator.userAgent || '';
  if (!/Android/i.test(ua) || /iPhone|iPad|iPod/i.test(ua)) return;

  const motion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  if (motion && motion.matches) return;

  const root = document.documentElement;
  const MAX_PULL = 110;      // finger travel, in px, that maps to full stretch
  const MAX_STRETCH = 0.045; // 4.5% at most — a cue, not a distortion
  const SETTLE = 420;

  let hub = null;
  let surface = null;
  let tracking = false;
  let mode = 0; // 1 = pulling at the top, -1 = pulling at the bottom
  let startX = 0;
  let startY = 0;
  let pull = 0;
  let settleTimer = 0;
  let allowed = true;

  function atEdge(direction) {
    if (!hub) return false;
    if (direction > 0) return hub.scrollTop <= 0;
    return hub.scrollTop + hub.clientHeight >= hub.scrollHeight - 1;
  }

  function paint() {
    if (!surface) return;
    const scale = 1 + (pull / MAX_PULL) * MAX_STRETCH;
    surface.style.transformOrigin = mode > 0 ? '50% 0%' : '50% 100%';
    surface.style.transform = 'scaleY(' + scale.toFixed(4) + ')';
  }

  function settle() {
    if (!surface) return;
    tracking = false;
    mode = 0;
    pull = 0;
    surface.classList.remove('is-dragging');
    surface.classList.add('is-stretching');
    // Force the transition to see the current scale before it is removed.
    void surface.offsetHeight;
    surface.style.transform = '';
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(function () {
      surface.classList.remove('is-stretching');
      surface.style.transformOrigin = '';
    }, SETTLE + 40);
  }

  function drop() {
    if (!surface) return;
    tracking = false;
    mode = 0;
    pull = 0;
    window.clearTimeout(settleTimer);
    surface.classList.remove('is-dragging', 'is-stretching');
    surface.style.transform = '';
    surface.style.transformOrigin = '';
  }

  function onStart(event) {
    if (!allowed || !hub || event.touches.length !== 1) {
      if (tracking) settle();
      return;
    }
    // Catching a spring-back starts from rest, the way the native effect does.
    if (surface.classList.contains('is-stretching')) drop();
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    tracking = true;
    mode = 0;
    pull = 0;
  }

  function onMove(event) {
    if (!allowed || !tracking || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (!mode) {
      // Let horizontal gestures and normal scrolling through untouched.
      if (Math.abs(dx) > Math.abs(dy) || Math.abs(dy) < 6) return;
      if (dy > 0 && atEdge(1)) {
        mode = 1;
      } else if (dy < 0 && atEdge(-1)) {
        mode = -1;
      } else {
        tracking = false;
        return;
      }
      surface.classList.add('is-dragging');
      surface.classList.remove('is-stretching');
    }

    const over = (mode > 0 ? dy : -dy) - 6;
    if (over <= 0) {
      settle();
      return;
    }
    if (event.cancelable) event.preventDefault();
    pull = MAX_PULL * (1 - Math.exp(-over / 96));
    paint();
  }

  function onEnd() {
    if (!tracking) return;
    if (mode) settle();
    else tracking = false;
  }

  function attach() {
    hub = document.getElementById('hub');
    if (!hub) return;
    surface = hub.querySelector('.hub-shell');
    if (!surface) return;
    root.classList.add('has-stretch');
    hub.addEventListener('touchstart', onStart, { passive: true });
    hub.addEventListener('touchmove', onMove, { passive: false });
    hub.addEventListener('touchend', onEnd, { passive: true });
    hub.addEventListener('touchcancel', onEnd, { passive: true });
  }

  if (motion) {
    const syncMotion = function () {
      allowed = !motion.matches;
      if (!allowed) {
        drop();
        root.classList.remove('has-stretch');
      } else {
        root.classList.add('has-stretch');
      }
    };
    if (motion.addEventListener) motion.addEventListener('change', syncMotion);
    else if (motion.addListener) motion.addListener(syncMotion);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();
