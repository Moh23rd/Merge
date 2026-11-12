/* Daily Sixfold — one local-date check-in for the collection, plus a seeded
   daily challenge for every game. No server, no account and no network
   required. */
(function () {
  'use strict';

  const KEY = 'sixfold.daily.v1';
  const ORDER = ['merge', 'sudoku', 'ttt', 'mines', 'water', 'fruit'];
  const GAMES = {
    merge: { label: 'Merge', goal: 'Finish seeded 4 × 4' },
    sudoku: { label: 'Sudoku', goal: 'Solve the daily grid' },
    ttt: { label: 'Tic Tac Toe', goal: 'Beat today’s computer' },
    mines: { label: 'Minesweeper', goal: 'Clear today’s field' },
    water: { label: 'Water Sort', goal: 'Clear today’s level' },
    fruit: { label: 'Fruit Merge', goal: 'Finish today’s run' }
  };
  const MAX_ARCHIVE = 30;
  const $ = function (id) { return document.getElementById(id); };

  function pad(value) { return String(value).padStart(2, '0'); }

  function todayKey(date) {
    const d = date instanceof Date ? date : new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function seedValue(text) {
    let hash = 2166136261;
    const source = String(text);
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(text) {
    let value = seedValue(text);
    return function () {
      value |= 0;
      value = value + 0x6D2B79F5 | 0;
      let t = Math.imul(value ^ value >>> 15, 1 | value);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function dateFromKey(key) {
    const parts = String(key || '').split('-').map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
    const d = new Date(parts[0], parts[1] - 1, parts[2], 12);
    if (d.getFullYear() !== parts[0] || d.getMonth() !== parts[1] - 1 || d.getDate() !== parts[2]) return null;
    return d;
  }

  function shiftKey(key, delta) {
    const d = dateFromKey(key);
    if (!d) return key;
    d.setDate(d.getDate() + delta);
    return todayKey(d);
  }

  function locale() {
    try { return window.SixfoldI18n ? window.SixfoldI18n.locale() : undefined; } catch (err) { return undefined; }
  }

  function tr(value) {
    try { return window.SixfoldI18n ? window.SixfoldI18n.t(value) : value; } catch (err) { return value; }
  }

  function pretty(key) {
    const d = dateFromKey(key);
    if (!d) return '';
    try {
      return d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (err) {
      return key;
    }
  }

  function short(key) {
    const d = dateFromKey(key);
    if (!d) return '';
    try {
      return d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
    } catch (err) {
      return key;
    }
  }

  function isKey(key) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(key || '')) && Boolean(dateFromKey(key));
  }

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
      return clean(parsed);
    } catch (err) {
      return clean(null);
    }
  }

  function clean(value) {
    const out = { days: {}, best: 0 };
    if (!value || typeof value !== 'object' || !value.days || typeof value.days !== 'object') return out;
    Object.keys(value.days).slice(0, 800).forEach(function (key) {
      if (!isKey(key)) return;
      const day = value.days[key];
      if (!day || typeof day !== 'object') return;
      const games = {};
      ORDER.forEach(function (game) {
        if (day.games && day.games[game]) games[game] = true;
      });
      if (Object.keys(games).length) out.days[key] = { games: games };
    });
    out.best = Math.max(0, Math.floor(Number(value.best) || 0));
    return out;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (err) {}
  }

  function dayFor(key) {
    return data.days[key] || null;
  }

  function countFor(key) {
    const day = dayFor(key);
    return day ? Object.keys(day.games).filter(function (game) { return GAMES[game]; }).length : 0;
  }

  function isDone(key, game) {
    const day = dayFor(key);
    return Boolean(day && day.games && day.games[game]);
  }

  function streak() {
    let cursor = countFor(todayKey()) ? todayKey() : shiftKey(todayKey(), -1);
    let total = 0;
    while (countFor(cursor) && total < 3660) {
      total += 1;
      cursor = shiftKey(cursor, -1);
    }
    return total;
  }

  function bestStreak() {
    return Math.max(data.best || 0, streak());
  }

  function announce(message) {
    const live = $('daily-live');
    if (live) {
      live.textContent = '';
      window.setTimeout(function () { live.textContent = message; }, 20);
    }
  }

  function complete(game, meta, dateKey) {
    if (!GAMES[game]) return false;
    const key = isKey(dateKey) ? dateKey : todayKey();
    const day = data.days[key] || { games: {} };
    if (day.games[game]) {
      render();
      return false;
    }
    day.games[game] = true;
    data.days[key] = day;
    const current = streak();
    data.best = Math.max(data.best || 0, current);
    save();
    render();
    const total = countFor(key);
    if (total === ORDER.length) {
      announce('Daily Sixfold complete. All six games played.');
      try { window.dispatchEvent(new CustomEvent('sixfold:daily-full', { detail: { date: key } })); } catch (err) {}
    } else {
      announce(tr(GAMES[game].label + ' checked off. ' + total + ' of six today.'));
    }
    try {
      window.dispatchEvent(new CustomEvent('sixfold:daily-change', {
        detail: { date: key, game: game, total: total, meta: meta || null }
      }));
    } catch (err) {}
    return true;
  }

  function play(game, dateKey) {
    if (!GAMES[game]) return;
    const date = isKey(dateKey) ? dateKey : todayKey();
    if (game === 'sudoku') {
      if (window.MergeGames && window.MergeGames.open) window.MergeGames.open('sudoku');
      else location.hash = '#sudoku';
      window.setTimeout(function () {
        if (window.SixfoldSudoku && window.SixfoldSudoku.startDaily) {
          window.SixfoldSudoku.startDaily(date);
        }
      }, 80);
      announce(tr('Daily Sudoku for ' + short(date) + '.'));
      return;
    }
    if (date !== todayKey()) {
      announce(tr('Only the Sudoku archive can be replayed. Other games count today.'));
      return;
    }
    if (window.MergeGames && window.MergeGames.open) window.MergeGames.open(game);
    else location.hash = '#' + game;
    window.setTimeout(function () {
      if (window.MergeGames && window.MergeGames.startDaily) {
        window.MergeGames.startDaily(game, 'sixfold-daily-v1|' + date + '|' + game, date);
      }
    }, 100);
    announce(tr(GAMES[game].goal) + ' · ' + short(date) + '.');
  }

  function share() {
    const key = todayKey();
    const done = countFor(key);
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('daily', key);
    const text = tr('Sixfold Daily') + ' · ' + pretty(key) + '\n' +
      done + tr('/6 games · ') + streak() + tr('-day streak.') + '\n' + tr('No spoilers — play today’s set:');
    const payload = { title: 'Sixfold Daily', text: text, url: url.toString() };
    const live = $('daily-live');
    if (navigator.share) {
      navigator.share(payload).catch(function () {});
      return;
    }
    const copy = text + '\n' + url.toString();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(copy).then(function () {
        announce(tr('Daily link copied.'));
        if (live) live.textContent = tr('Daily link copied.');
      }).catch(function () { announce(url.toString()); });
      return;
    }
    announce(url.toString());
  }

  function render() {
    const key = todayKey();
    const done = countFor(key);
    const total = ORDER.length;
    const dateEl = $('daily-date');
    const streakEl = $('daily-streak');
    const bestEl = $('daily-best');
    const summaryEl = $('daily-summary');
    const progressEl = $('daily-progress');
    const gamesEl = $('daily-games');
    if (dateEl) dateEl.textContent = pretty(key);
    if (streakEl) streakEl.textContent = String(streak());
    if (bestEl) bestEl.textContent = String(bestStreak());
    if (summaryEl) {
      summaryEl.textContent = tr(done === total
        ? 'Six of six. Today’s set is complete.'
        : done
          ? done + ' of six done · ' + (total - done) + ' to go.'
          : 'Every game has a date-seeded daily. Pick one to begin.');
    }
    if (progressEl) progressEl.style.setProperty('--daily-progress', (done / total * 100) + '%');

    if (gamesEl) {
      gamesEl.innerHTML = '';
      ORDER.forEach(function (game, index) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'daily-game' + (isDone(key, game) ? ' is-done' : '');
        button.dataset.dailyGame = game;
        button.setAttribute('aria-label', tr((isDone(key, game) ? 'Replay ' : 'Play ') + GAMES[game].label + ' for today'));
        button.innerHTML = '<span class="daily-game-num">0' + (index + 1) + '</span>' +
          '<strong>' + GAMES[game].label + '</strong>' +
          '<small>' + tr(isDone(key, game) ? 'Done' : GAMES[game].goal) + '</small>' +
          '<i aria-hidden="true">' + (isDone(key, game) ? '✓' : '›') + '</i>';
        button.addEventListener('click', function () { play(game); });
        gamesEl.appendChild(button);
      });
    }
    renderCalendar();
  }

  function renderCalendar() {
    const grid = $('daily-calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const today = todayKey();
    for (let i = MAX_ARCHIVE - 1; i >= 0; i -= 1) {
      const key = shiftKey(today, -i);
      const count = countFor(key);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'daily-day' + (key === today ? ' is-today' : '') +
        (count === ORDER.length ? ' is-full' : '') + (count ? ' is-started' : '');
      button.dataset.date = key;
      button.setAttribute('aria-label', tr(short(key) + ', ' + count + ' of six games'));
      const d = dateFromKey(key);
      button.innerHTML = '<span>' + (d ? d.getDate() : '') + '</span>' +
        '<i class="daily-day-dots" aria-hidden="true">' +
        ORDER.map(function (game) {
          return '<b class="' + (isDone(key, game) ? 'on' : '') + '"></b>';
        }).join('') + '</i>';
      button.addEventListener('click', function () { selectDay(key); });
      grid.appendChild(button);
    }
    if (!selectedDay) selectedDay = today;
    showDay(selectedDay);
  }

  function showDay(key) {
    selectedDay = key;
    const title = $('daily-day-title');
    const copy = $('daily-day-copy');
    const action = $('daily-day-play');
    const count = countFor(key);
    if (title) title.textContent = pretty(key) + (key === todayKey() ? ' · ' + tr('today') : '');
    if (copy) {
      copy.textContent = count
        ? tr(count + ' of six games checked in. ' + (count === ORDER.length ? 'A full set.' : 'You can still replay the Sudoku.'))
        : tr('No games checked in. The Sudoku can be replayed for this date; the other five scenarios are today only.');
    }
    if (action) {
      action.hidden = false;
      action.textContent = tr(count ? 'Replay this Sudoku' : 'Play this Sudoku');
      action.dataset.date = key;
    }
  }

  function selectDay(key) {
    if (!isKey(key)) return;
    showDay(key);
  }

  function openCalendar(opener) {
    renderCalendar();
    const sheet = $('daily-calendar');
    if (!sheet) return;
    if (window.MergeTheme && window.MergeTheme.openSheet) window.MergeTheme.openSheet(sheet, opener);
    else { sheet.hidden = false; sheet.classList.add('is-open'); }
  }

  function closeCalendar() {
    const sheet = $('daily-calendar');
    if (!sheet) return;
    if (window.MergeTheme && window.MergeTheme.closeSheet) window.MergeTheme.closeSheet(sheet);
    else { sheet.hidden = true; sheet.classList.remove('is-open'); }
  }

  function init() {
    render();
    const calendarBtn = $('daily-calendar-open');
    if (calendarBtn) calendarBtn.addEventListener('click', function () { openCalendar(calendarBtn); });
    const shareBtn = $('daily-share');
    if (shareBtn) shareBtn.addEventListener('click', share);
    const sudokuBtn = $('daily-sudoku');
    if (sudokuBtn) sudokuBtn.addEventListener('click', function () { play('sudoku'); });
    const sheet = $('daily-calendar');
    if (sheet) {
      sheet.querySelectorAll('[data-close]').forEach(function (el) {
        el.addEventListener('click', closeCalendar);
      });
    }
    const archivePlay = $('daily-day-play');
    if (archivePlay) {
      archivePlay.addEventListener('click', function () {
        play('sudoku', archivePlay.dataset.date || todayKey());
        closeCalendar();
      });
    }
    window.addEventListener('storage', function (event) {
      if (event.key !== KEY) return;
      data = load();
      render();
    });
    try { window.addEventListener('sixfold:daily-change', render); } catch (err) {}

    const url = new URL(location.href);
    const shared = url.searchParams.get('daily');
    if (isKey(shared) && shared <= todayKey() && shared >= shiftKey(todayKey(), -(MAX_ARCHIVE - 1))) {
      url.searchParams.delete('daily');
      try { history.replaceState({ game: 'hub' }, '', url.pathname + url.search + url.hash); } catch (err) {}
      window.setTimeout(function () { play('sudoku', shared); }, 220);
    }
  }

  let data = load();
  let selectedDay = todayKey();

  window.SixfoldDaily = {
    todayKey: todayKey,
    shiftKey: shiftKey,
    complete: complete,
    play: play,
    openCalendar: openCalendar,
    streak: streak,
    bestStreak: bestStreak,
    isDone: isDone,
    countFor: countFor,
    seededRandom: seededRandom
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
