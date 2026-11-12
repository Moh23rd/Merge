/* Tiny optional interface sounds. Audio only starts after a real gesture, and
   the preference lives with the other device settings. */
(function () {
  'use strict';

  let context = null;
  let lastClick = 0;

  function enabled() {
    return !window.SixfoldSettings || window.SixfoldSettings.get('sound') !== false;
  }

  function audio() {
    if (!enabled()) return null;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      if (!context) context = new AudioCtor();
      if (context.state === 'suspended') context.resume().catch(function () {});
      return context;
    } catch (err) {
      return null;
    }
  }

  function tone(frequency, start, duration, volume) {
    const ctx = audio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime + start);
    gain.gain.setValueAtTime(0, ctx.currentTime + start);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + duration + 0.02);
  }

  function click() {
    const now = Date.now();
    if (now - lastClick < 32) return;
    lastClick = now;
    tone(620, 0, 0.035, 0.035);
  }

  function win() {
    if (!enabled()) return;
    tone(523.25, 0, 0.12, 0.06);
    tone(659.25, 0.09, 0.13, 0.055);
    tone(783.99, 0.18, 0.22, 0.05);
  }

  document.addEventListener('pointerdown', function (event) {
    if (!enabled()) return;
    const target = event.target && event.target.closest ? event.target.closest('button, [role="button"], a') : null;
    if (!target || target.disabled) return;
    click();
  }, true);

  window.addEventListener('sixfold:win', win);

  function hookCelebrate() {
    const celebrate = window.MergeCelebrate;
    if (!celebrate || celebrate.__sixfoldSound) return;
    const original = celebrate.win;
    celebrate.win = function () {
      win();
      return original.apply(this, arguments);
    };
    celebrate.__sixfoldSound = true;
  }

  hookCelebrate();
  window.setTimeout(hookCelebrate, 0);
  window.setTimeout(hookCelebrate, 400);

  window.SixfoldSound = {
    play: function (name) { if (name === 'win') win(); else click(); },
    click: click,
    win: win
  };
})();
