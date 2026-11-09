/* A short six-colour flourish for a win. Deliberately small: a handful of
   paper-coloured chips lifting off the result card and settling, not a
   full-screen takeover. Motion is skipped entirely for reduced-motion users. */
(function () {
  'use strict';

  const COLOURS = ['#e85f3b', '#efb07a', '#e3b94a', '#8bbd54', '#39a9a1', '#5b8fd5'];
  const COUNT = 16;

  function reduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function play(anchor) {
    if (reduced()) return;
    const target = anchor && anchor.getBoundingClientRect ? anchor : null;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;

    const layer = document.createElement('div');
    layer.className = 'victory-layer';
    layer.setAttribute('aria-hidden', 'true');

    const originX = rect.left + rect.width / 2;
    const originY = rect.top + Math.min(rect.height * 0.45, 46);

    for (let i = 0; i < COUNT; i += 1) {
      const bit = document.createElement('i');
      const angle = (Math.PI * 2 * i) / COUNT + Math.random() * 0.5;
      const distance = 30 + Math.random() * 58;
      const size = 4 + Math.random() * 4;
      bit.className = 'victory-bit';
      bit.style.left = originX + 'px';
      bit.style.top = originY + 'px';
      bit.style.width = size + 'px';
      bit.style.height = size + 'px';
      bit.style.background = COLOURS[i % COLOURS.length];
      bit.style.setProperty('--dx', (Math.cos(angle) * distance).toFixed(1) + 'px');
      bit.style.setProperty('--dy', (Math.sin(angle) * distance - 22 - Math.random() * 26).toFixed(1) + 'px');
      bit.style.setProperty('--rot', Math.round((Math.random() - 0.5) * 220) + 'deg');
      bit.style.animationDelay = (Math.random() * 70).toFixed(0) + 'ms';
      layer.appendChild(bit);
    }

    document.body.appendChild(layer);
    if (target.classList) {
      target.classList.remove('is-victory');
      void target.offsetWidth;
      target.classList.add('is-victory');
      window.setTimeout(function () { target.classList.remove('is-victory'); }, 720);
    }
    window.setTimeout(function () { layer.remove(); }, 1000);
  }

  window.MergeCelebrate = { play: play };
})();
