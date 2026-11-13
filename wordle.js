/* The hidden word game behind the six-piece cover. Standard Wordle rules:
   five letters, six guesses, and duplicate letters only score as often as they
   occur in the answer. The board uses the active interface language's word
   pack; scripts without a practical on-screen layout use a native IME input.
   Progress, stats and the current word stay on-device. */
(function () {
  'use strict';

  const root = document.getElementById('wordle');
  const englishWords = window.SixfoldWordleWords;
  if (!root || !englishWords || !englishWords.answers || !englishWords.valid) return;

  const $ = function (id) { return document.getElementById(id); };
  const boardEl = $('wordle-board');
  const keyboardEl = $('wordle-keyboard');
  const statusEl = $('wordle-status');
  const resultEl = $('wordle-result');
  const resultTitle = $('wordle-result-title');
  const resultCopy = $('wordle-result-copy');
  const resultStats = $('wordle-result-stats');
  const resultNew = $('wordle-result-new');
  const resultShare = $('wordle-result-share');
  const newBtn = $('wordle-new');
  const playedEl = $('wordle-played');
  const streakEl = $('wordle-streak');
  const titleEl = $('wordle-title');
  if (!boardEl || !keyboardEl || !statusEl || !resultEl || !titleEl) return;

  const I18N = window.SixfoldI18n;
  const LOCALE = I18N ? I18N.locale() : 'en';
  const PACKS = window.SixfoldWordleLocales || {};
  const pack = PACKS[LOCALE];
  const hasPack = Boolean(pack && Array.isArray(pack.answers) && pack.answers.length);
  const words = hasPack ? pack : englishWords;
  const IME = Boolean(pack && pack.ime);
  const ALL_STRINGS = window.SixfoldWordleStrings || {};
  const STRINGS = ALL_STRINGS[LOCALE] || ALL_STRINGS.en || {};

  const ROWS = 6;
  const COLS = 5;
  // An offline English fallback round belongs to the English game. Keeping it
  // under the localized key would restore an English answer after the pack loads.
  const GAME_KEY = 'sixfold.wordle.game.v1' + (hasPack && LOCALE !== 'en' ? '::' + LOCALE : '');
  const STATS_KEY = 'sixfold.wordle.stats.v1';
  const ANSWER_SET = new Set(words.answers.map(normalize));
  const VALID_SET = new Set(words.valid.concat(words.answers).map(normalize));
  const BASE_KEY_ROWS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['Backspace', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'Enter']
  ];
  const KEY_ROWS = IME ? [] : (Array.isArray(pack && pack.rows) && pack.rows.length
    ? pack.rows.map(function (row) { return Array.from(row); })
    : BASE_KEY_ROWS.map(function (row) { return row.slice(); }));
  if (!IME && pack && Array.isArray(pack.rows) && pack.rows.length) {
    const lastRow = KEY_ROWS[KEY_ROWS.length - 1];
    lastRow.unshift('Backspace');
    lastRow.push('Enter');
  }
  const KEY_CHARS = new Set();
  KEY_ROWS.forEach(function (row) {
    row.forEach(function (letter) {
      if (letter !== 'Backspace' && letter !== 'Enter') KEY_CHARS.add(normalize(letter));
    });
  });
  const STATE_RANK = { absent: 1, present: 2, correct: 3 };
  const EMPTY_STATS = { played: 0, wins: 0, streak: 0, max: 0, dist: [0, 0, 0, 0, 0, 0] };
  let segmenter = null;
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      segmenter = new Intl.Segmenter(LOCALE, { granularity: 'grapheme' });
    }
  } catch (err) {
    segmenter = null;
  }

  let stats = readStats();
  let state = restoreState();
  let input = '';
  let busy = false;
  let composing = false;
  let imeInput = null;
  let revealTimer = 0;
  let messageTimer = 0;
  let rowEls = [];
  let tileEls = [];
  let keyEls = {};

  function tr(key, values) {
    const template = STRINGS[key] || (ALL_STRINGS.en && ALL_STRINGS.en[key]) || key;
    const text = template.replace(/\{(\w+)\}/g, function (match, name) {
      return values && values[name] !== undefined ? String(values[name]) : match;
    });
    return I18N && I18N.number ? I18N.number(text) : text;
  }

  function normalize(value) {
    return String(value || '').normalize('NFC').toLocaleLowerCase(LOCALE);
  }

  function pieces(value) {
    const text = String(value || '').normalize('NFC');
    if (!text) return [];
    if (segmenter) return Array.from(segmenter.segment(text), function (part) { return part.segment; });
    return Array.from(text);
  }

  function isFive(value) {
    return pieces(value).length === COLS;
  }

  function isGuess(value) {
    const word = normalize(value);
    return isFive(word) && VALID_SET.has(word);
  }

  function displayWord(value) {
    // German uppercase ß expands to SS, which would put two letters in one
    // tile. Use the capital sharp S so a five-letter answer stays five tiles.
    return String(value || '').replace(/ß/g, 'ẞ').toLocaleUpperCase(LOCALE);
  }

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* storage blocked: the current round still plays */
    }
  }

  function cleanStats(value) {
    const next = Object.assign({}, EMPTY_STATS, value && typeof value === 'object' ? value : {});
    next.played = Math.max(0, Number(next.played) || 0);
    next.wins = Math.max(0, Number(next.wins) || 0);
    next.streak = Math.max(0, Number(next.streak) || 0);
    next.max = Math.max(0, Number(next.max) || 0);
    next.dist = Array.isArray(next.dist) ? next.dist.slice(0, 6).map(function (n) { return Math.max(0, Number(n) || 0); }) : [0, 0, 0, 0, 0, 0];
    while (next.dist.length < 6) next.dist.push(0);
    return next;
  }

  function readStats() {
    return cleanStats(load(STATS_KEY, null));
  }

  function saveStats() {
    save(STATS_KEY, stats);
  }

  function pickAnswer(previous) {
    if (!words.answers.length) return 'crane';
    let answer = previous;
    for (let tries = 0; tries < 20 && answer === previous; tries += 1) {
      answer = normalize(words.answers[Math.floor(Math.random() * words.answers.length)]);
    }
    return answer;
  }

  function freshState() {
    return {
      answer: pickAnswer(''),
      guesses: [],
      status: 'playing',
      scored: false
    };
  }

  function restoreState() {
    const saved = load(GAME_KEY, null);
    const savedAnswer = saved && typeof saved === 'object' ? normalize(saved.answer) : '';
    const next = saved && typeof saved === 'object' && ANSWER_SET.has(savedAnswer)
      ? Object.assign({}, saved, { answer: savedAnswer })
      : freshState();
    next.guesses = Array.isArray(next.guesses) ? next.guesses.filter(isGuess).slice(0, ROWS) : [];
    if (next.guesses.indexOf(next.answer) !== -1) next.status = 'won';
    else if (next.guesses.length >= ROWS) next.status = 'lost';
    else next.status = 'playing';
    next.scored = next.status !== 'playing' && next.scored === true;
    if (next.status !== 'playing' && !next.scored) {
      recordResult(next.status === 'won', next.guesses.length);
      next.scored = true;
      save(GAME_KEY, next);
    }
    return next;
  }

  function recordResult(won, tries) {
    stats.played += 1;
    if (won) {
      stats.wins += 1;
      stats.streak += 1;
      stats.max = Math.max(stats.max, stats.streak);
      const index = Math.min(5, Math.max(0, tries - 1));
      stats.dist[index] += 1;
    } else {
      stats.streak = 0;
    }
    saveStats();
  }

  function saveState() {
    save(GAME_KEY, state);
  }

  function scoreGuess(guess, answer) {
    const guessParts = pieces(guess);
    const answerParts = pieces(answer);
    const result = new Array(COLS).fill('absent');
    const remaining = {};
    for (let i = 0; i < COLS; i += 1) {
      remaining[answerParts[i]] = (remaining[answerParts[i]] || 0) + 1;
    }
    for (let i = 0; i < COLS; i += 1) {
      if (guessParts[i] === answerParts[i]) {
        result[i] = 'correct';
        remaining[guessParts[i]] -= 1;
      }
    }
    for (let i = 0; i < COLS; i += 1) {
      if (result[i] === 'correct') continue;
      const letter = guessParts[i];
      if (remaining[letter] > 0) {
        result[i] = 'present';
        remaining[letter] -= 1;
      }
    }
    return result;
  }

  function buildBoard() {
    boardEl.innerHTML = '';
    rowEls = [];
    tileEls = [];
    for (let row = 0; row < ROWS; row += 1) {
      const rowEl = document.createElement('div');
      rowEl.className = 'wordle-row';
      rowEl.setAttribute('role', 'row');
      const rowTiles = [];
      for (let col = 0; col < COLS; col += 1) {
        const tile = document.createElement('div');
        tile.className = 'wordle-tile';
        tile.setAttribute('role', 'gridcell');
        tile.setAttribute('aria-label', tr('row', { row: row + 1, col: col + 1, state: tr('empty') }));
        rowEl.appendChild(tile);
        rowTiles.push(tile);
      }
      boardEl.appendChild(rowEl);
      rowEls.push(rowEl);
      tileEls.push(rowTiles);
    }
  }

  function paintTile(tile, letter, score, row, col) {
    const shown = letter || '';
    tile.textContent = shown ? displayWord(shown) : '';
    tile.dataset.filled = shown ? 'true' : 'false';
    if (score) tile.dataset.state = score;
    else tile.removeAttribute('data-state');
    const spoken = shown
      ? displayWord(shown) + ', ' + (score ? tr(score) : tr('typed'))
      : tr('empty');
    tile.setAttribute('aria-label', tr('row', { row: row + 1, col: col + 1, state: spoken }));
  }

  function render(revealRow) {
    const inputParts = pieces(input);
    for (let row = 0; row < ROWS; row += 1) {
      const rowEl = rowEls[row];
      const guess = state.guesses[row];
      const current = !guess && row === state.guesses.length && state.status === 'playing';
      rowEl.classList.toggle('is-current', current);
      rowEl.classList.remove('is-shaking');
      const guessParts = guess ? pieces(guess) : [];
      const scores = guess ? scoreGuess(guess, state.answer) : null;
      for (let col = 0; col < COLS; col += 1) {
        const tile = tileEls[row][col];
        tile.classList.remove('is-revealing');
        tile.style.removeProperty('--i');
        const letter = guess ? guessParts[col] : (current ? inputParts[col] || '' : '');
        paintTile(tile, letter, scores ? scores[col] : '', row, col);
        if (scores && row === revealRow) {
          tile.style.setProperty('--i', String(col));
          tile.classList.add('is-revealing');
        }
      }
    }
    boardEl.setAttribute('aria-label', tr('board', { used: state.guesses.length }));
  }

  function buildKeyboard() {
    keyboardEl.innerHTML = '';
    keyboardEl.classList.toggle('wordle-keyboard--ime', IME);
    keyboardEl.setAttribute('aria-label', tr('keyboard'));
    keyEls = {};
    imeInput = null;

    if (IME) {
      const form = document.createElement('form');
      form.className = 'wordle-ime';
      form.noValidate = true;

      const field = document.createElement('input');
      field.type = 'text';
      field.id = 'wordle-ime-input';
      field.className = 'wordle-ime-input';
      field.autocomplete = 'off';
      field.autocapitalize = 'off';
      field.spellcheck = false;
      field.enterKeyHint = 'done';
      field.maxLength = 40;
      field.dir = document.documentElement.dir || 'auto';
      field.setAttribute('aria-label', tr('yourGuess'));
      field.setAttribute('placeholder', tr('typePrompt'));

      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.className = 'wordle-key wordle-key--wide wordle-key--enter';
      submit.textContent = tr('enter');
      submit.setAttribute('aria-label', tr('enter'));

      field.addEventListener('compositionstart', function () { composing = true; });
      field.addEventListener('compositionend', function () {
        composing = false;
        syncFromIme();
      });
      field.addEventListener('input', function () {
        if (!composing) syncFromIme();
      });
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (composing) return;
        syncFromIme();
        submitGuess();
      });

      form.appendChild(field);
      form.appendChild(submit);
      keyboardEl.appendChild(form);
      imeInput = field;
      return;
    }

    KEY_ROWS.forEach(function (letters) {
      const row = document.createElement('div');
      row.className = 'wordle-key-row';
      letters.forEach(function (letter) {
        const key = document.createElement('button');
        const action = letter === 'Backspace' || letter === 'Enter';
        const label = letter === 'Backspace' ? '⌫' : letter === 'Enter' ? tr('enter') : displayWord(letter);
        key.type = 'button';
        key.className = 'wordle-key';
        key.dataset.key = letter;
        key.textContent = label;
        if (letter === 'Backspace') {
          key.classList.add('wordle-key--wide');
          key.setAttribute('aria-label', tr('backspace'));
        } else if (letter === 'Enter') {
          key.classList.add('wordle-key--wide', 'wordle-key--enter');
          key.setAttribute('aria-label', tr('enter'));
        } else {
          key.setAttribute('aria-label', label);
        }
        if (!action) key.setAttribute('lang', LOCALE);
        row.appendChild(key);
        keyEls[letter] = key;
      });
      keyboardEl.appendChild(row);
    });
  }

  function syncFromIme() {
    if (!imeInput) return;
    const next = pieces(imeInput.value).slice(0, COLS).join('');
    imeInput.value = next;
    if (next !== input) {
      input = next;
      setStatus('');
      render();
    }
  }

  function syncImeValue() {
    if (imeInput) imeInput.value = input;
  }

  function updateKeyboard() {
    if (IME) return;
    const best = {};
    state.guesses.forEach(function (guess) {
      const guessParts = pieces(guess);
      const scores = scoreGuess(guess, state.answer);
      for (let i = 0; i < COLS; i += 1) {
        const letter = guessParts[i];
        if (!best[letter] || STATE_RANK[scores[i]] > STATE_RANK[best[letter]]) {
          best[letter] = scores[i];
        }
      }
    });
    Object.keys(keyEls).forEach(function (letter) {
      if (letter === 'Backspace' || letter === 'Enter') return;
      if (best[letter]) keyEls[letter].dataset.state = best[letter];
      else keyEls[letter].removeAttribute('data-state');
    });
  }

  function updateStats() {
    if (playedEl) playedEl.textContent = I18N ? I18N.number(stats.played) : String(stats.played);
    if (streakEl) streakEl.textContent = I18N ? I18N.number(stats.streak) : String(stats.streak);
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function flashStatus(message) {
    window.clearTimeout(messageTimer);
    setStatus(message);
    messageTimer = window.setTimeout(function () {
      if (state.status === 'playing' && !busy) setStatus(tr('typePrompt'));
    }, 2200);
  }

  function shake() {
    const row = rowEls[state.guesses.length];
    if (!row) return;
    row.classList.remove('is-shaking');
    void row.offsetWidth;
    row.classList.add('is-shaking');
    window.setTimeout(function () { row.classList.remove('is-shaking'); }, 380);
  }

  function addLetter(letter) {
    if (IME || busy || state.status !== 'playing' || pieces(input).length >= COLS) return;
    const next = normalize(letter);
    if (!KEY_CHARS.has(next)) return;
    input = pieces(input + next).join('');
    setStatus('');
    render();
  }

  function removeLetter() {
    if (busy || state.status !== 'playing' || !input.length) return;
    input = pieces(input).slice(0, -1).join('');
    syncImeValue();
    setStatus('');
    render();
  }

  function submitGuess() {
    if (busy || state.status !== 'playing') return;
    if (pieces(input).length < COLS) {
      flashStatus(tr('notEnough'));
      shake();
      return;
    }
    const guess = normalize(input);
    if (!isGuess(guess)) {
      flashStatus(tr('notInList'));
      shake();
      return;
    }

    state.guesses.push(guess);
    input = '';
    syncImeValue();
    busy = true;
    saveState();
    render(state.guesses.length - 1);
    updateKeyboard();
    const won = guess === state.answer;
    const lost = !won && state.guesses.length >= ROWS;
    setStatus(won ? tr('found') : lost ? tr('noMore') : tr('checking'));
    if (window.MergeHaptics && window.MergeHaptics.merge) window.MergeHaptics.merge(24);

    window.clearTimeout(revealTimer);
    revealTimer = window.setTimeout(function () {
      busy = false;
      if (won) finish(true);
      else if (lost) finish(false);
      else {
        render();
        setStatus(tr('guessOf', { guess: state.guesses.length + 1 }));
      }
    }, 5 * 82 + 360);
  }

  function finish(won) {
    state.status = won ? 'won' : 'lost';
    if (!state.scored) {
      recordResult(won, state.guesses.length);
      state.scored = true;
    }
    saveState();
    render();
    updateKeyboard();
    updateStats();
    showResult(won);
    if (won) {
      if (window.MergeHaptics && window.MergeHaptics.win) window.MergeHaptics.win();
      if (window.MergeCelebrate) {
        window.setTimeout(function () {
          window.MergeCelebrate.win(resultEl.querySelector('.wordle-result-card'));
        }, 120);
      }
    }
  }

  function showResult(won) {
    const tries = state.guesses.length;
    const resultCard = resultEl.querySelector('.wordle-result-card');
    if (!won && window.MergeCelebrate) window.MergeCelebrate.clear(resultCard);
    resultEl.hidden = false;
    // The result card is reused after a new round. Reflow once so its reveal
    // animation plays every time instead of only on the first finish.
    resultEl.classList.remove('is-revealed');
    void resultEl.offsetWidth;
    resultEl.classList.add('is-revealed');
    resultEl.dataset.state = won ? 'won' : 'lost';
    resultTitle.textContent = won
      ? (tries === 1 ? tr('oneGuess') : tr('solvedIn', { tries: tries }))
      : tr('notThisTime');
    resultCopy.textContent = won
      ? tr('wordWas', { word: displayWord(state.answer) })
      : tr('nextOne', { word: displayWord(state.answer) });
    if (resultStats) {
      const rate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
      resultStats.textContent = tr('stats', {
        played: stats.played,
        rate: rate,
        streak: stats.streak,
        best: stats.max
      });
    }
    if (resultNew) resultNew.textContent = tr('newGame');
    if (resultShare) {
      const shareLabel = I18N ? I18N.t('Share result') : 'Share result';
      resultShare.hidden = false;
      resultShare.setAttribute('aria-label', shareLabel);
      resultShare.setAttribute('title', shareLabel);
    }
    if (document.body.dataset.screen === 'wordle') {
      // Focus the dialog, not the New word button, so Enter cannot start a
      // fresh round before the result has been seen.
      resultEl.focus({ preventScroll: true });
    }
  }

  function hideResult() {
    resultEl.hidden = true;
    resultEl.classList.remove('is-revealed');
    resultEl.removeAttribute('data-state');
  }

  function newGame() {
    window.clearTimeout(revealTimer);
    window.clearTimeout(messageTimer);
    state = freshState();
    input = '';
    busy = false;
    hideResult();
    saveState();
    syncImeValue();
    render();
    updateKeyboard();
    updateStats();
    setStatus(tr('prompt'));
    try { (imeInput || boardEl).focus({ preventScroll: true }); } catch (err) {}
  }

  function shareResult() {
    const pattern = state.guesses.map(function (guess) {
      return scoreGuess(guess, state.answer).map(function (score) {
        return score === 'correct' ? '🟩' : score === 'present' ? '🟨' : '⬛';
      }).join('');
    }).join('\n');
    const score = state.status === 'won' ? String(state.guesses.length) : 'X';
    const text = 'Sixfold — Wordle ' + score + '/6\n\n' + pattern;
    const win = state.status === 'won';
    const streak = stats.streak ? tr('dayStreak', { n: stats.streak }) : tr('noStreak');
    // Keep the emoji grid in the shared text, but give Wordle the same image
    // card as every other finished game when file sharing is available.
    if (window.MergeShare && window.MergeShare.result) {
      window.MergeShare.result('Sixfold — Wordle', text, {
        game: 'Wordle', number: '??', kind: tr('shareGuesses'),
        title: win ? tr('shareSolved') : tr('shareLost'),
        score: score + '/6', label: tr('shareGuesses'),
        meta: [tr('wordWas', { word: displayWord(state.answer) }), streak],
        accent: '#9a6bb5'
      });
    } else if (window.MergeShare && window.MergeShare.share) {
      window.MergeShare.share('Sixfold — Wordle', text);
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    }
  }

  function handleKey(key) {
    if (key === 'Enter') submitGuess();
    else if (key === 'Backspace') removeLetter();
    else if (!IME) addLetter(key);
  }

  function onKeyDown(event) {
    if (document.body.dataset.screen !== 'wordle') return;
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.repeat) return;
    if (document.documentElement.classList.contains('sheet-open')) return;
    const target = event.target;
    if (target && target.closest && target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'Enter') {
      if (target && target.closest && target.closest('a')) return;
      if (target && target.closest && target.closest('button') && !target.closest('[data-key]')) return;
      event.preventDefault();
      submitGuess();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      removeLetter();
      return;
    }
    if (IME) return;
    const letter = normalize(event.key);
    if (pieces(letter).length === 1 && KEY_CHARS.has(letter)) {
      event.preventDefault();
      addLetter(letter);
    }
  }

  function activate() {
    updateStats();
    if (state.status === 'playing') {
      hideResult();
      syncImeValue();
      render();
      updateKeyboard();
      setStatus(state.guesses.length ? tr('guessOf', { guess: state.guesses.length + 1 }) : tr('prompt'));
    } else {
      render();
      updateKeyboard();
      showResult(state.status === 'won');
    }
  }

  function deactivate() {
    saveState();
  }

  function reset() {
    window.clearTimeout(revealTimer);
    window.clearTimeout(messageTimer);
    try {
      Object.keys(localStorage).forEach(function (key) {
        if (key === STATS_KEY || key.indexOf('sixfold.wordle.game.v1') === 0) localStorage.removeItem(key);
      });
    } catch (err) {}
    stats = cleanStats(null);
    state = freshState();
    input = '';
    busy = false;
    hideResult();
    saveStats();
    saveState();
    syncImeValue();
    render();
    updateKeyboard();
    updateStats();
    setStatus(tr('reset'));
  }

  // Persist a fresh round immediately as well: otherwise a reload before the
  // first guess silently replaces the word the player was looking at.
  saveState();
  buildBoard();
  buildKeyboard();
  updateStats();
  render();
  updateKeyboard();

  keyboardEl.addEventListener('click', function (event) {
    const key = event.target.closest('[data-key]');
    if (!key) return;
    handleKey(key.dataset.key);
  });
  resultNew.addEventListener('click', newGame);
  resultShare.addEventListener('click', shareResult);
  if (newBtn) newBtn.addEventListener('click', newGame);
  document.addEventListener('keydown', onKeyDown);

  if (state.status !== 'playing') showResult(state.status === 'won');
  else setStatus(state.guesses.length ? tr('guessOf', { guess: state.guesses.length + 1 }) : tr('prompt'));

  window.SixfoldWordle = {
    title: titleEl,
    activate: activate,
    deactivate: deactivate,
    reset: reset,
    newGame: newGame
  };
})();
