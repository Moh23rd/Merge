/* Theme (auto / light / dark), colour palettes and browser chrome. */
(function () {
  'use strict';

  const THEME_KEY = 'merge2048.theme';
  const PALETTE_KEY = 'merge2048.palette';

  // The hand-tuned "Warm" ramp, one colour per tile for 2 … 2048.
  const WARM = [
    '#f3ecdf', '#f0e3c8', '#efb07a', '#ee9563', '#ec7c55', '#e85f3b',
    '#e7c364', '#e3b94a', '#dcab30', '#cf9822', '#b9801a'
  ];

  // The seven accent colours the collection games use for tubes, fruit, marks
  // and mine numbers. They follow the selected palette just like the tiles.
  const GAME_ACCENTS = [
    '#e85f3b', '#e3a92f', '#8bbd54', '#39a9a1', '#5b8fd5', '#9a6bb5', '#d96b8a'
  ];

  // Other palettes are the warm colours hue-shifted (or, for Mono, desaturated),
  // so they keep the same brightness curve and stay equally readable.
  const PALETTES = [
    { id: 'warm', label: 'Warm' },
    { id: 'ocean', label: 'Ocean', shift: 196 },
    { id: 'forest', label: 'Forest', shift: 104 },
    { id: 'berry', label: 'Berry', shift: 296 },
    { id: 'dusk', label: 'Dusk', shift: 252 },
    { id: 'mono', label: 'Mono', mono: true }
  ];

  // Page chrome colours that pick up the palette, page background included.
  const PAGE_VARS = ['--page', '--panel', '--sheet-bg', '--overlay'];

  const root = document.documentElement;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const state = { theme: 'auto', palette: 'warm' };

  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto') state.theme = savedTheme;
    const savedPalette = localStorage.getItem(PALETTE_KEY);
    if (PALETTES.some(function (p) { return p.id === savedPalette; })) state.palette = savedPalette;
  } catch (err) {
    /* storage blocked — defaults are fine */
  }

  /* ---------- colour helpers ---------- */

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return '#' + rgb.map(function (v) {
      const n = Math.max(0, Math.min(255, Math.round((v + m) * 255)));
      return (n < 16 ? '0' : '') + n.toString(16);
    }).join('');
  }

  function activePalette() {
    return PALETTES.filter(function (p) { return p.id === state.palette; })[0] || PALETTES[0];
  }

  // Recolours #rrggbb or #rrggbbaa for the given palette, keeping alpha.
  function recolor(hex, palette) {
    const value = String(hex).trim();
    const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
    if (!match) return hex;
    if (!palette.mono && !palette.shift) return value;

    const alpha = match[2] ? match[2].toLowerCase() : '';
    const n = parseInt(match[1], 16);
    const hsl = rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
    if (palette.mono) return hslToHex(hsl[0], 0.04, hsl[2]) + alpha;
    return hslToHex(hsl[0] + palette.shift, hsl[1], hsl[2]) + alpha;
  }

  /* ---------- page tint ---------- */

  function tintPage() {
    PAGE_VARS.forEach(function (name) {
      root.style.removeProperty(name);
    });
    const palette = activePalette();
    if (!palette.mono && !palette.shift) return;

    const computed = getComputedStyle(root);
    const bases = PAGE_VARS.map(function (name) {
      return [name, computed.getPropertyValue(name).trim()];
    });
    bases.forEach(function (pair) {
      if (!/^#[0-9a-f]{6,8}$/i.test(pair[1])) return;
      root.style.setProperty(pair[0], recolor(pair[1], palette));
    });
  }

  /* ---------- browser chrome ---------- */

  // The two flat page colours before any palette is applied.
  const PAGE_BASE = { light: '#f6f1e8', dark: '#1a1918' };

  // The page colour for the theme and palette in use, worked out arithmetically
  // (no layout reads), so the bar can be repainted the instant a swatch is tapped.
  function chromeColour() {
    return recolor(root.dataset.theme === 'dark' ? PAGE_BASE.dark : PAGE_BASE.light, activePalette());
  }

  // The phone's status bar / address bar follows the page, palette included.
  function paintBrowserChrome() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = chromeColour();
      if (meta.getAttribute('content') !== bg) meta.setAttribute('content', bg);
    }
    // Scrollbars, form controls and the phone's own surfaces follow this too.
    const scheme = document.querySelector('meta[name="color-scheme"]');
    if (scheme) scheme.setAttribute('content', root.dataset.theme === 'dark' ? 'dark' : 'light');
  }

  // The installed app's bottom strip comes from the manifest, not theme-color.
  // Keep the theme cookie for a future install, and point the link at the
  // matching light/dark file so a fresh install captures the right colour.
  function syncManifest() {
    const theme = root.dataset.theme === 'dark' ? 'dark' : 'light';
    try {
      const age = '; path=/; max-age=31536000; SameSite=Lax';
      document.cookie = 'merge2048_theme=' + theme + age;
    } catch (err) {
      /* cookies blocked — the manifest falls back to the phone's theme */
    }

    let link = document.getElementById('manifest-link');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      link.id = 'manifest-link';
      document.head.appendChild(link);
    }
    const href = (theme === 'dark' ? 'manifest-dark.webmanifest' : 'manifest.webmanifest') + '?v=1.0';
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  }

  function refreshPage() {
    tintPage();
    paintBrowserChrome();
    syncManifest();
  }

  // The result image is drawn from the page colours, so tell the game when they
  // change and an open result card can redraw it with the new appearance.
  function announceAppearance() {
    try {
      window.dispatchEvent(new CustomEvent('merge:appearance'));
    } catch (err) {
      /* an old browser: the preview keeps the colours it opened with */
    }
  }

  /* ---------- theme ---------- */

  function resolvedTheme() {
    return state.theme === 'auto' ? (mq.matches ? 'dark' : 'light') : state.theme;
  }

  function syncThemeButtons() {
    document.querySelectorAll('[data-theme-opt]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.dataset.themeOpt === state.theme ? 'true' : 'false');
    });
    // The header button is a plain light/dark switch, independent of the Auto setting.
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      const isDark = root.dataset.theme === 'dark';
      toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    }
  }

  function applyTheme(pref, persist) {
    state.theme = pref;
    root.dataset.theme = resolvedTheme();
    // Bar first, then the rest of the page: they change together instead of the
    // status bar trailing the new colours.
    paintBrowserChrome();
    if (persist) {
      try { localStorage.setItem(THEME_KEY, pref); } catch (err) {}
    }
    syncThemeButtons();
    refreshPage();
    announceAppearance();
  }

  /* ---------- palettes ---------- */

  function syncPaletteButtons() {
    document.querySelectorAll('[data-palette-opt]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.dataset.paletteOpt === state.palette ? 'true' : 'false');
    });
  }

  function syncHubPalette() {
    const label = document.getElementById('hub-palette-label');
    if (label) label.textContent = activePalette().label;
  }

  function applyPalette(id, persist) {
    const palette = PALETTES.filter(function (p) { return p.id === id; })[0] || PALETTES[0];
    state.palette = palette.id;
    paintBrowserChrome();

    for (let i = 0; i < WARM.length; i++) {
      root.style.setProperty('--t' + (2 << i), recolor(WARM[i], palette));
    }
    // Shared accents for the other five games (see games.css/games.js).
    for (let i = 0; i < GAME_ACCENTS.length; i++) {
      root.style.setProperty('--g' + (i + 1), recolor(GAME_ACCENTS[i], palette));
    }
    root.style.setProperty(
      '--ink-tile-low',
      palette.mono ? hslToHex(0, 0, 0.46) : palette.shift ? hslToHex(34 + palette.shift, 0.11, 0.46) : '#857a6b'
    );

    if (persist) {
      try { localStorage.setItem(PALETTE_KEY, palette.id); } catch (err) {}
    }
    syncPaletteButtons();
    syncHubPalette();
    refreshPage();
    announceAppearance();
  }

  function buildPalettes() {
    const wrap = document.getElementById('palettes');
    if (!wrap) return;
    PALETTES.forEach(function (p) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'palette';
      btn.dataset.paletteOpt = p.id;
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', p.label + ' colours');

      const sw = document.createElement('span');
      sw.className = 'swatches';
      [2, 6, 10].forEach(function (i) {
        const dot = document.createElement('span');
        dot.style.background = recolor(WARM[i], p);
        sw.appendChild(dot);
      });

      const label = document.createElement('span');
      label.textContent = p.label;

      btn.appendChild(sw);
      btn.appendChild(label);
      btn.addEventListener('click', function () {
        applyPalette(p.id, true);
      });
      wrap.appendChild(btn);
    });
  }

  /* ---------- fullscreen ---------- */

  function fullscreenAvailable() {
    return !!(root.requestFullscreen || root.webkitRequestFullscreen || root.webkitRequestFullScreen);
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  const homeFocusBtn = document.getElementById('home-focus-toggle');
  if (homeFocusBtn) {
    if (!fullscreenAvailable()) {
      homeFocusBtn.hidden = true;
    } else {
      const syncHomeFocus = function () {
        const active = !!fullscreenElement();
        homeFocusBtn.setAttribute('aria-pressed', String(active));
        homeFocusBtn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
        homeFocusBtn.title = active ? 'Exit fullscreen' : 'Enter fullscreen';
      };

      const toggleHomeFocus = function () {
        if (fullscreenElement()) {
          const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
          if (!exit) return;
          try {
            const pending = exit.call(document);
            if (pending && typeof pending.catch === 'function') pending.catch(function () {});
          } catch (err) {}
          return;
        }
        const request = root.requestFullscreen || root.webkitRequestFullscreen || root.webkitRequestFullScreen;
        if (!request) return;
        try {
          const pending = request.call(root);
          if (pending && typeof pending.catch === 'function') pending.catch(function () {});
        } catch (err) {}
      };

      homeFocusBtn.addEventListener('click', toggleHomeFocus);
      document.addEventListener('fullscreenchange', syncHomeFocus);
      document.addEventListener('webkitfullscreenchange', syncHomeFocus);
      syncHomeFocus();
    }
  }

  /* ---------- sheet ---------- */

  const appEl = document.querySelector('.app');
  const hubEl = document.getElementById('hub');
  const sheetOpeners = new WeakMap();
  const sheetCloseTimers = new WeakMap();

  function openSheet(sheet, opener) {
    if (!sheet) return;
    const pendingClose = sheetCloseTimers.get(sheet);
    if (pendingClose) {
      window.clearTimeout(pendingClose);
      sheetCloseTimers.delete(sheet);
    }
    sheetOpeners.set(sheet, opener || null);
    sheet.hidden = false;
    // Commit the display change before the entering styles, so the card rises
    // rather than appearing on the same frame it is revealed.
    void sheet.offsetWidth;
    sheet.classList.remove('is-closing');
    sheet.classList.add('is-open');
    // The page behind the sheet can't be tabbed into or tapped while it's open.
    // Hub, Merge and the five game screens each have their own top-level layer.
    const screen = document.body.dataset.screen;
    const background = screen === 'hub' ? hubEl : screen === 'merge' ? appEl : document.getElementById(screen);
    if (background && 'inert' in background && !background.inert) {
      background.inert = true;
      sheet._inertBackground = background;
    }
    document.documentElement.classList.add('sheet-open');
    const doneBtn = sheet.querySelector('.sheet-done');
    if (doneBtn) doneBtn.focus();
  }

  function closeSheet(sheet) {
    if (!sheet || sheet.hidden || sheet.classList.contains('is-closing')) return;
    // Let the scrim and card leave before removing the dialog from the page.
    sheet.classList.remove('is-open');
    sheet.classList.add('is-closing');
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(function () {
      sheet.hidden = true;
      sheet.classList.remove('is-open', 'is-closing');
      sheet.removeAttribute('data-context');
      document.documentElement.classList.remove('sheet-open');
      if (sheet._inertBackground) {
        sheet._inertBackground.inert = false;
        sheet._inertBackground = null;
      }
      // Send focus back to whatever opened the sheet.
      const opener = sheetOpeners.get(sheet);
      if (opener) opener.focus();
      sheetOpeners.delete(sheet);
      sheetCloseTimers.delete(sheet);
    }, reduced ? 0 : 320);
    sheetCloseTimers.set(sheet, timer);
  }

  const appearanceSheet = document.getElementById('sheet');
  const appearanceBtn = document.getElementById('appearance');
  const sizeSheet = document.getElementById('size-sheet');
  const sizeBtn = document.getElementById('merge-size');
  const helpSheet = document.getElementById('help');
  const helpBtn = document.getElementById('how-to');
  const aboutSheet = document.getElementById('about');
  const aboutBtn = document.getElementById('hub-about');
  const resetSheet = document.getElementById('reset-sheet');
  const resetTitleEl = document.getElementById('reset-title');
  const resetCopyEl = document.getElementById('reset-copy');
  const resetConfirmBtn = document.getElementById('reset-confirm');
  let resetAction = null;
  const helpTitleEl = document.getElementById('help-title');
  const helpStepsEl = document.getElementById('help-steps');
  const defaultHelpTitle = helpTitleEl ? helpTitleEl.textContent : 'How to play';
  const defaultHelpSteps = helpStepsEl
    ? Array.prototype.map.call(helpStepsEl.children, function (item) { return item.textContent; })
    : [];

  function renderHelp(title, steps) {
    if (!helpTitleEl || !helpStepsEl) return;
    helpTitleEl.textContent = title || defaultHelpTitle;
    helpStepsEl.textContent = '';
    (steps && steps.length ? steps : defaultHelpSteps).forEach(function (copy) {
      const item = document.createElement('li');
      item.textContent = copy;
      helpStepsEl.appendChild(item);
    });
  }

  function wireSheet(sheet, openerBtn) {
    if (!sheet || !openerBtn) return;
    openerBtn.addEventListener('click', function () {
      // Merge's own help button always sees Merge's instructions, even after
      // another game has borrowed the sheet.
      if (sheet === helpSheet) renderHelp(defaultHelpTitle, defaultHelpSteps);
      openSheet(sheet, openerBtn);
    });
    sheet.querySelectorAll('[data-close], .sheet-done').forEach(function (el) {
      el.addEventListener('click', function () {
        closeSheet(sheet);
      });
    });
  }

  wireSheet(appearanceSheet, appearanceBtn);
  wireSheet(sizeSheet, sizeBtn);
  wireSheet(helpSheet, helpBtn);
  wireSheet(aboutSheet, aboutBtn);

  if (resetSheet) {
    resetSheet.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', function () {
        resetAction = null;
        closeSheet(resetSheet);
      });
    });
    if (resetConfirmBtn) {
      resetConfirmBtn.addEventListener('click', function () {
        const action = resetAction;
        resetAction = null;
        closeSheet(resetSheet);
        if (action) action();
      });
    }
  }

  function openGameReset(options) {
    if (!options) return;
    if (!resetSheet || !resetTitleEl || !resetCopyEl || !resetConfirmBtn) {
      if (options.onConfirm) options.onConfirm();
      return;
    }
    resetTitleEl.textContent = 'Reset ' + options.name + '?';
    resetCopyEl.textContent = options.copy || ('This clears ' + options.name + ' data on this device.');
    resetConfirmBtn.textContent = 'Reset ' + options.name;
    resetAction = options.onConfirm || null;
    openSheet(resetSheet, options.opener || null);
  }

  function activeSheet() {
    if (appearanceSheet && !appearanceSheet.hidden) return appearanceSheet;
    if (sizeSheet && !sizeSheet.hidden) return sizeSheet;
    if (helpSheet && !helpSheet.hidden) return helpSheet;
    if (aboutSheet && !aboutSheet.hidden) return aboutSheet;
    if (resetSheet && !resetSheet.hidden) return resetSheet;
    return null;
  }

  function sheetFocusables(sheet) {
    return Array.prototype.slice.call(
      sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) {
      return !el.hidden && !el.disabled && el.getClientRects().length > 0;
    });
  }

  if (appearanceSheet || helpSheet || aboutSheet || resetSheet) {
    document.addEventListener('keydown', function (e) {
      const sheet = activeSheet();
      if (!sheet) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSheet(sheet);
        return;
      }
      if (e.key !== 'Tab') return;

      const focusables = sheetFocusables(sheet);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !sheet.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !sheet.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  // The in-game coach handles the first moves; Help stays available in Look.

  if (appearanceSheet) {
    appearanceSheet.querySelectorAll('[data-theme-opt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyTheme(btn.dataset.themeOpt, true);
      });
    });
  }

  /* ---------- start ---------- */

  buildPalettes();
  applyTheme(state.theme, false);
  applyPalette(state.palette, false);

  // Display controls on the other game screens use the same theme state and
  // persistence as Merge's footer toggle, without duplicating the theme logic.
  window.MergeTheme = {
    toggle: function () {
      applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
    },
    isDark: function () {
      return root.dataset.theme === 'dark';
    },
    openHelp: function (title, steps, opener) {
      if (!helpSheet) return;
      renderHelp(title, steps);
      openSheet(helpSheet, opener || helpBtn);
    },
    palette: function () {
      return state.palette;
    },
    // Recolour any accent hex with the active palette. Canvas games call this.
    colour: function (hex) {
      return recolor(hex, activePalette());
    },
    confirmReset: openGameReset,
    closeSheet: closeSheet
  };

  const onSchemeChange = function () {
    if (state.theme === 'auto') applyTheme('auto', false);
  };
  if (mq.addEventListener) mq.addEventListener('change', onSchemeChange);
  else if (mq.addListener) mq.addListener(onSchemeChange);
})();
