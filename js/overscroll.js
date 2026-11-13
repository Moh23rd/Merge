/* Android 12 and later replaced the old overscroll glow with a stretch: the
   content pulls past the edge, stretches, then springs back. A fixed app shell
   with its own scroller never receives that effect, so the home screen
   reproduces it here. The pull is damped and capped rather than tracking the
   finger 1:1, which is what makes the platform's version feel physical.

   The whole gesture is followed, not only one that begins at an edge, so a
   normal scroll that reaches the top still stretches. A fling that arrives at
   an edge after the finger has lifted is caught from the scroll velocity, so
   fast scrolling gets the same cue as a deliberate drag.

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
  const FLING_MIN = 0.35;    // px/ms — below this a scroll just stops at the edge
  const SETTLE = 420;

  let hub = null;
  let surface = null;
  let tracking = false;
  let mode = 0; // 1 = pulling at the top, -1 = pulling at the bottom
  let startX = 0;
  let startY = 0;
  let startScroll = 0;
  let pull = 0;
  let settleTimer = 0;
  let flingTimer = 0;
  let allowed = true;
  let lastTop = null;
  let lastAt = 0;

  function atEdge(direction) {
    if (!hub) return false;
    if (direction > 0) return hub.scrollTop <= 0;
    return hub.scrollTop + hub.clientHeight >= hub.scrollHeight - 1;
  }

  function transformFor(scale, direction) {
    if (!surface) return;
    surface.style.transformOrigin = direction > 0 ? '50% 0%' : '50% 100%';
    surface.style.transform = 'scaleY(' + scale.toFixed(4) + ')';
  }

  function paint() {
    if (!surface) return;
    const scale = 1 + (pull / MAX_PULL) * MAX_STRETCH;
    transformFor(scale, mode);
  }

  function settle() {
    if (!surface) return;
    tracking = false;
    mode = 0;
    pull = 0;
    window.clearTimeout(flingTimer);
    surface.classList.remove('is-dragging', 'is-flinging');
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
    window.clearTimeout(flingTimer);
    surface.classList.remove('is-dragging', 'is-stretching', 'is-flinging');
    surface.style.transform = '';
    surface.style.transformOrigin = '';
  }

  /* A fling stops at the edge with the finger already gone. Play the same
     stretch as a short pulse, scaled by how fast the list arrived. */
  function fling(direction, speed) {
    if (!allowed || !surface || (tracking && mode)) return;
    if (!atEdge(direction)) return;
    mode = direction;
    pull = Math.min(MAX_PULL, 26 + speed * 22);
    window.clearTimeout(flingTimer);
    surface.classList.remove('is-dragging', 'is-stretching');
    surface.classList.add('is-flinging');
    transformFor(1, direction);
    void surface.offsetHeight;
    paint();
    flingTimer = window.setTimeout(settle, 90);
  }

  function onStart(event) {
    if (!allowed || !hub || event.touches.length !== 1) {
      if (tracking) settle();
      return;
    }
    // Catching a spring-back starts from rest, the way the native effect does.
    if (surface.classList.contains('is-stretching')) drop();
    window.clearTimeout(flingTimer);
    surface.classList.remove('is-flinging');
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startScroll = hub.scrollTop;
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
      // Let horizontal gestures through untouched. Vertical gestures are
      // followed all the way to an edge, even when they began mid-list.
      if (Math.abs(dx) > Math.abs(dy)) return;
      if (Math.abs(dy) < 4) return;
    }

    // How far the finger has travelled past what the scroller could use. The
    // scrollTop term means a swipe that starts halfway down the list only
    // begins pulling once the list has actually reached the top (or bottom).
    const over = mode
      ? (mode > 0 ? dy - startScroll + hub.scrollTop : -dy + startScroll - hub.scrollTop)
      : (dy > 0 && atEdge(1)) ? dy - startScroll + hub.scrollTop
      : (dy < 0 && atEdge(-1)) ? -dy + startScroll - hub.scrollTop
      : -1;

    if (over <= 0) {
      if (mode) settle();
      return;
    }

    if (!mode) {
      mode = dy > 0 ? 1 : -1;
      surface.classList.add('is-dragging');
      surface.classList.remove('is-stretching', 'is-flinging');
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

  function onScroll() {
    if (!allowed || !hub || !surface) return;
    const now = window.performance && performance.now ? performance.now() : Date.now();
    const top = hub.scrollTop;
    if (lastTop === null) {
      lastTop = top;
      lastAt = now;
      return;
    }
    const dt = Math.max(1, now - lastAt);
    const speed = (top - lastTop) / dt;
    const max = hub.scrollHeight - hub.clientHeight;

    // Momentum is still moving towards the edge when the scroller reaches it.
    if (!tracking && top <= 0 && lastTop > 0 && speed < -FLING_MIN) {
      fling(1, -speed);
    } else if (!tracking && top >= max && lastTop < max && speed > FLING_MIN) {
      fling(-1, speed);
    }

    lastTop = top;
    lastAt = now;
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
    hub.addEventListener('scroll', onScroll, { passive: true });
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
