/* Optional device settings: accessibility, Sudoku input and local backup.
   Everything is stored in localStorage and never leaves the device. */
(function () {
  'use strict';

  const KEY = 'sixfold.settings.v1';
  const DEFAULTS = {
    highContrast: false,
    colorblind: false,
    largeDigits: false,
    leftHanded: false,
    hideTimer: false,
    checkMistakes: false,
    inputMode: 'cell',
    sound: true
  };
  const $ = function (id) { return document.getElementById(id); };
  let values = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      const next = Object.assign({}, DEFAULTS);
      if (raw && typeof raw === 'object') {
        Object.keys(DEFAULTS).forEach(function (key) {
          if (typeof raw[key] === typeof DEFAULTS[key]) next[key] = raw[key];
        });
        if (next.inputMode !== 'cell' && next.inputMode !== 'digit') next.inputMode = 'cell';
      }
      return next;
    } catch (err) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(values)); } catch (err) {}
  }

  function apply() {
    const root = document.documentElement;
    const attrs = {
      contrast: values.highContrast ? 'high' : '',
      colorblind: values.colorblind ? 'on' : '',
      'large-digits': values.largeDigits ? 'on' : '',
      'left-handed': values.leftHanded ? 'on' : '',
      'hide-timer': values.hideTimer ? 'on' : '',
      'check-mistakes': values.checkMistakes ? 'on' : '',
      'input-mode': values.inputMode
    };
    Object.keys(attrs).forEach(function (name) {
      if (attrs[name]) root.setAttribute('data-' + name, attrs[name]);
      else root.removeAttribute('data-' + name);
    });
    document.querySelectorAll('[data-setting]').forEach(function (button) {
      const key = button.dataset.setting;
      const on = Boolean(values[key]);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      const state = button.querySelector('.setting-state');
      if (state) state.textContent = on ? 'On' : 'Off';
    });
    document.querySelectorAll('[data-setting-input]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.settingInput === values.inputMode ? 'true' : 'false');
    });
    try {
      window.dispatchEvent(new CustomEvent('sixfold:settings', { detail: getAll() }));
    } catch (err) {}
  }

  function set(key, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) return;
    if (key === 'inputMode') values.inputMode = value === 'digit' ? 'digit' : 'cell';
    else values[key] = Boolean(value);
    save();
    apply();
  }

  function toggle(key) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) return;
    set(key, !values[key]);
  }

  function get(key) {
    return values[key];
  }

  function getAll() {
    return Object.assign({}, values);
  }

  function status(message) {
    const el = $('backup-status');
    if (el) el.textContent = message;
  }

  function exportBackup() {
    const data = {};
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !/^(merge2048|merge-games|sixfold)/.test(key)) continue;
        data[key] = localStorage.getItem(key);
      }
    } catch (err) {
      status('Storage is not available in this browser.');
      return;
    }
    const payload = {
      app: 'Sixfold',
      version: 5,
      exportedAt: new Date().toISOString(),
      data: data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sixfold-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    status('Backup downloaded. Keep it somewhere safe.');
  }

  function clearLocal() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && /^(merge2048|merge-games|sixfold)/.test(key)) keys.push(key);
      }
      keys.forEach(function (key) { localStorage.removeItem(key); });
    } catch (err) {}
  }

  function importBackup(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      status('That backup is too large to be a Sixfold backup.');
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      let payload;
      try { payload = JSON.parse(String(reader.result)); } catch (err) {
        status('That file is not a valid JSON backup.');
        return;
      }
      if (!payload || payload.app !== 'Sixfold' || !payload.data || typeof payload.data !== 'object') {
        status('That file is not a Sixfold backup.');
        return;
      }
      const entries = Object.keys(payload.data);
      if (entries.length > 300) {
        status('That backup contains too many entries.');
        return;
      }
      for (let i = 0; i < entries.length; i += 1) {
        const key = entries[i];
        const value = payload.data[key];
        if (!/^(merge2048|merge-games|sixfold)/.test(key) || typeof value !== 'string' || value.length > 1500000) {
          status('That backup contains an unsupported entry.');
          return;
        }
      }
      const ok = window.confirm('Restore this Sixfold backup? It will replace every board, score and setting on this device.');
      if (!ok) return;
      clearLocal();
      entries.forEach(function (key) {
        try { localStorage.setItem(key, payload.data[key]); } catch (err) {}
      });
      status('Backup restored. Reloading…');
      window.setTimeout(function () { location.reload(); }, 350);
    };
    reader.onerror = function () { status('Could not read that file.'); };
    reader.readAsText(file);
  }

  function init() {
    apply();
    document.querySelectorAll('[data-setting]').forEach(function (button) {
      button.addEventListener('click', function () { toggle(button.dataset.setting); });
    });
    document.querySelectorAll('[data-setting-input]').forEach(function (button) {
      button.addEventListener('click', function () { set('inputMode', button.dataset.settingInput); });
    });
    const exportBtn = $('backup-export');
    if (exportBtn) exportBtn.addEventListener('click', exportBackup);
    const openImport = $('backup-import-open');
    const input = $('backup-import');
    if (openImport && input) {
      openImport.addEventListener('click', function () { input.click(); });
      input.addEventListener('change', function () {
        importBackup(input.files && input.files[0]);
        input.value = '';
      });
    }
    window.addEventListener('storage', function (event) {
      if (event.key !== KEY) return;
      values = load();
      apply();
    });
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(function () {});
    }
  }

  window.SixfoldSettings = {
    get: get,
    all: getAll,
    set: set,
    toggle: toggle
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
