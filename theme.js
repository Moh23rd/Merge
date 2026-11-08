/* Theme (auto / light / dark), colour palettes, browser chrome and the reopen preference. */
(function () {
  'use strict';

  const THEME_KEY = 'merge2048.theme';
  const PALETTE_KEY = 'merge2048.palette';
  const RESUME_KEY = 'merge2048.resume';

  // The hand-tuned "Warm" ramp, one colour per tile for 2 … 2048.
  const WARM = [
    '#f3ecdf', '#f0e3c8', '#efb07a', '#ee9563', '#ec7c55', '#e85f3b',
    '#e7c364', '#e3b94a', '#dcab30', '#cf9822', '#b9801a'
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
  const state = { theme: 'auto', palette: 'warm', resume: 'continue' };

  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto') state.theme = savedTheme;
    const savedPalette = localStorage.getItem(PALETTE_KEY);
    if (PALETTES.some(function (p) { return p.id === savedPalette; })) state.palette = savedPalette;
    if (localStorage.getItem(RESUME_KEY) === 'fresh') state.resume = 'fresh';
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
    const href = (theme === 'dark' ? 'manifest-dark.webmanifest' : 'manifest.webmanifest') + '?v=62';
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

  function applyPalette(id, persist) {
    const palette = PALETTES.filter(function (p) { return p.id === id; })[0] || PALETTES[0];
    state.palette = palette.id;
    paintBrowserChrome();

    for (let i = 0; i < WARM.length; i++) {
      root.style.setProperty('--t' + (2 << i), recolor(WARM[i], palette));
    }
    root.style.setProperty(
      '--ink-tile-low',
      palette.mono ? hslToHex(0, 0, 0.46) : palette.shift ? hslToHex(34 + palette.shift, 0.11, 0.46) : '#857a6b'
    );

    if (persist) {
      try { localStorage.setItem(PALETTE_KEY, palette.id); } catch (err) {}
    }
    syncPaletteButtons();
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

  /* ---------- reopen preference ---------- */

  function syncResumeButtons() {
    document.querySelectorAll('[data-resume-opt]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.dataset.resumeOpt === state.resume ? 'true' : 'false');
    });
  }

  function setResume(mode) {
    state.resume = mode === 'fresh' ? 'fresh' : 'continue';
    try {
      localStorage.setItem(RESUME_KEY, state.resume);
    } catch (err) {
      /* ignore */
    }
    syncResumeButtons();
  }

  /* ---------- reset ---------- */

  const BEST_KEYS = ['merge2048.best', 'merge2048.best.3', 'merge2048.best.5'];

  // Two taps for anything destructive: the first arms the button, the second does it.
  function armReset(btn, label, action) {
    let armed = false;
    let timer = 0;

    function disarm() {
      armed = false;
      btn.dataset.armed = 'false';
      btn.textContent = label;
    }

    btn.addEventListener('click', function () {
      if (!armed) {
        armed = true;
        btn.dataset.armed = 'true';
        btn.textContent = 'Tap again';
        timer = window.setTimeout(disarm, 3200);
        return;
      }
      window.clearTimeout(timer);
      armed = false;
      btn.dataset.armed = 'false';
      action(btn, label);
    });
  }

  function resetBestScores(btn, label) {
    BEST_KEYS.forEach(function (key) {
      try { localStorage.removeItem(key); } catch (err) {}
    });
    if (window.MergeGame && window.MergeGame.refreshBest) window.MergeGame.refreshBest();
    btn.textContent = 'Cleared';
    window.setTimeout(function () { btn.textContent = label; }, 1400);
  }

  function resetAllSettings(btn) {
    // Preferences and the saved game go back to defaults; best scores have their own button.
    // Stop the game's pagehide/visibilitychange save from restoring the board
    // when the reset reloads the page.
    if (window.MergeGame && window.MergeGame.suspendSaving) window.MergeGame.suspendSaving();
    try {
      Object.keys(localStorage).forEach(function (key) {
        if (key.indexOf('merge2048.') !== 0) return;
        if (BEST_KEYS.indexOf(key) !== -1) return;
        localStorage.removeItem(key);
      });
    } catch (err) {
      /* ignore */
    }
    btn.textContent = 'Resetting…';
    window.setTimeout(function () { window.location.reload(); }, 250);
  }

  // Light/dark at a glance in the header; the segmented control in the sheet stays.
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
    });
  }

  /* ---------- sheet ---------- */

  const appEl = document.querySelector('.app');
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
    if (appEl && 'inert' in appEl) appEl.inert = true;
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
      document.documentElement.classList.remove('sheet-open');
      if (appEl && 'inert' in appEl) appEl.inert = false;
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
  const helpSheet = document.getElementById('help');
  const helpBtn = document.getElementById('how-to');

  function wireSheet(sheet, openerBtn) {
    if (!sheet || !openerBtn) return;
    openerBtn.addEventListener('click', function () {
      openSheet(sheet, openerBtn);
    });
    sheet.querySelectorAll('[data-close], .sheet-done').forEach(function (el) {
      el.addEventListener('click', function () {
        closeSheet(sheet);
      });
    });
  }

  wireSheet(appearanceSheet, appearanceBtn);
  wireSheet(helpSheet, helpBtn);

  function activeSheet() {
    if (appearanceSheet && !appearanceSheet.hidden) return appearanceSheet;
    if (helpSheet && !helpSheet.hidden) return helpSheet;
    return null;
  }

  function sheetFocusables(sheet) {
    return Array.prototype.slice.call(
      sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) {
      return !el.hidden && !el.disabled && el.getClientRects().length > 0;
    });
  }

  if (appearanceSheet || helpSheet) {
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

  // Show the panel by itself once, and only to someone who has never played
  // here before. Any trace of earlier use means this is not a first visit.
  const HELP_SEEN_KEY = 'merge2048.helpSeen';

  function firstVisit() {
    try {
      if (localStorage.getItem(HELP_SEEN_KEY)) return false;
      return !Object.keys(localStorage).some(function (key) {
        return key.indexOf('merge2048.') === 0;
      });
    } catch (err) {
      // Storage blocked: don't risk greeting the same person on every load.
      return false;
    }
  }

  if (helpSheet && helpBtn && firstVisit()) {
    try {
      // Mark it before showing, so a reload mid-read doesn't ask again.
      localStorage.setItem(HELP_SEEN_KEY, '1');
    } catch (err) {
      /* storage blocked: the welcome simply won't repeat */
    }
    window.requestAnimationFrame(function () {
      openSheet(helpSheet, helpBtn);
    });
  }

  if (appearanceSheet) {
    appearanceSheet.querySelectorAll('[data-theme-opt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyTheme(btn.dataset.themeOpt, true);
      });
    });
    appearanceSheet.querySelectorAll('[data-resume-opt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setResume(btn.dataset.resumeOpt);
      });
    });
  }

  /* ---------- start ---------- */

  const resetBestBtn = document.getElementById('reset-best');
  const resetSettingsBtn = document.getElementById('reset-settings');
  if (resetBestBtn) armReset(resetBestBtn, 'Best scores', resetBestScores);
  if (resetSettingsBtn) armReset(resetSettingsBtn, 'All settings', resetAllSettings);

  buildPalettes();
  applyTheme(state.theme, false);
  applyPalette(state.palette, false);
  syncResumeButtons();

  const onSchemeChange = function () {
    if (state.theme === 'auto') applyTheme('auto', false);
  };
  if (mq.addEventListener) mq.addEventListener('change', onSchemeChange);
  else if (mq.addListener) mq.addListener(onSchemeChange);
})();
