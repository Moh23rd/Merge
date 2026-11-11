/* The hidden word game behind the six-piece cover. Standard Wordle rules:
   five letters, six guesses, and duplicate letters only score as often as they
   occur in the answer. Progress, stats and the current word stay on-device. */
(function () {
  'use strict';

  const root = document.getElementById('wordle');
  const words = window.SixfoldWordleWords;
  if (!root || !words || !words.answers || !words.valid) return;

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
  const nativeInput = $('wordle-native-input');
  const nativeKeyboard = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const noteEl = document.querySelector('#wordle .play-note');
  const playedEl = $('wordle-played');
  const streakEl = $('wordle-streak');
  const titleEl = $('wordle-title');
  if (!boardEl || !keyboardEl || !statusEl || !resultEl || !titleEl) return;

  const ROWS = 6;
  const COLS = 5;
  const GAME_KEY = 'sixfold.wordle.game.v1';
  const STATS_KEY = 'sixfold.wordle.stats.v1';
  const ANSWER_SET = new Set(words.answers);
  const VALID_SET = new Set(words.valid.concat(words.answers));
  const KEY_ROWS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'Backspace', 'Enter']
  ];
  const STATE_RANK = { absent: 1, present: 2, correct: 3 };
  const EMPTY_STATS = { played: 0, wins: 0, streak: 0, max: 0, dist: [0, 0, 0, 0, 0, 0] };

  let stats = readStats();
  let state = restoreState();
  let input = '';
  let busy = false;
  let revealTimer = 0;
  let messageTimer = 0;
  let rowEls = [];
  let tileEls = [];
  let keyEls = {};

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
      answer = words.answers[Math.floor(Math.random() * words.answers.length)];
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
    const next = saved && typeof saved === 'object' && ANSWER_SET.has(saved.answer) ? Object.assign({}, saved) : freshState();
    next.guesses = Array.isArray(next.guesses) ? next.guesses.filter(function (word) {
      return typeof word === 'string' && /^[a-z]{5}$/.test(word) && VALID_SET.has(word);
    }).slice(0, ROWS) : [];
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
    const result = ['absent', 'absent', 'absent', 'absent', 'absent'];
    const remaining = {};
    for (let i = 0; i < COLS; i += 1) {
      remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
    for (let i = 0; i < COLS; i += 1) {
      if (guess[i] === answer[i]) {
        result[i] = 'correct';
        remaining[guess[i]] -= 1;
      }
    }
    for (let i = 0; i < COLS; i += 1) {
      if (result[i] === 'correct') continue;
      const letter = guess[i];
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
        tile.setAttribute('aria-label', 'Row ' + (row + 1) + ', column ' + (col + 1) + ', empty');
        rowEl.appendChild(tile);
        rowTiles.push(tile);
      }
      boardEl.appendChild(rowEl);
      rowEls.push(rowEl);
      tileEls.push(rowTiles);
    }
  }

  function paintTile(tile, letter, score, row, col) {
    tile.textContent = letter ? letter.toUpperCase() : '';
    tile.dataset.filled = letter ? 'true' : 'false';
    if (score) tile.dataset.state = score;
    else tile.removeAttribute('data-state');
    const spoken = letter ? letter.toUpperCase() + ', ' + score : 'empty';
    tile.setAttribute('aria-label', 'Row ' + (row + 1) + ', column ' + (col + 1) + ', ' + spoken);
  }

  function render(revealRow) {
    for (let row = 0; row < ROWS; row += 1) {
      const rowEl = rowEls[row];
      const guess = state.guesses[row];
      rowEl.classList.toggle('is-current', !guess && row === state.guesses.length && state.status === 'playing');
      rowEl.classList.remove('is-shaking');
      const scores = guess ? scoreGuess(guess, state.answer) : null;
      for (let col = 0; col < COLS; col += 1) {
        const tile = tileEls[row][col];
        tile.classList.remove('is-revealing');
        tile.style.removeProperty('--i');
        const letter = guess ? guess[col] : (row === state.guesses.length && state.status === 'playing' ? input[col] || '' : '');
        paintTile(tile, letter, scores ? scores[col] : '', row, col);
        if (scores && row === revealRow) {
          tile.style.setProperty('--i', String(col));
          tile.classList.add('is-revealing');
        }
      }
    }
    boardEl.setAttribute('aria-label', 'Wordle board, ' + state.guesses.length + ' of ' + ROWS + ' guesses used');
  }

  function buildKeyboard() {
    keyboardEl.innerHTML = '';
    keyEls = {};
    KEY_ROWS.forEach(function (letters) {
      const row = document.createElement('div');
      row.className = 'wordle-key-row';
      letters.forEach(function (letter) {
        const key = document.createElement('button');
        const label = letter === 'Backspace' ? '⌫' : letter === 'Enter' ? 'Enter' : letter.toUpperCase();
        key.type = 'button';
        key.className = 'wordle-key';
        key.dataset.key = letter;
        key.textContent = label;
        if (letter === 'Backspace') {
          key.classList.add('wordle-key--wide');
          key.setAttribute('aria-label', 'Backspace');
        } else if (letter === 'Enter') {
          key.classList.add('wordle-key--wide');
        } else {
          key.setAttribute('aria-label', letter.toUpperCase());
        }
        row.appendChild(key);
        keyEls[letter] = key;
      });
      keyboardEl.appendChild(row);
    });
  }

  function updateKeyboard() {
    const best = {};
    state.guesses.forEach(function (guess) {
      const scores = scoreGuess(guess, state.answer);
      for (let i = 0; i < COLS; i += 1) {
        const letter = guess[i];
        if (!best[letter] || STATE_RANK[scores[i]] > STATE_RANK[best[letter]]) {
          best[letter] = scores[i];
        }
      }
    });
    Object.keys(keyEls).forEach(function (letter) {
      if (letter === 'Enter' || letter === 'Backspace') return;
      if (best[letter]) keyEls[letter].dataset.state = best[letter];
      else keyEls[letter].removeAttribute('data-state');
    });
  }

  function updateStats() {
    if (playedEl) playedEl.textContent = String(stats.played);
    if (streakEl) streakEl.textContent = String(stats.streak);
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function idleMessage() {
    return nativeKeyboard
      ? 'Tap the board, then type a five-letter word.'
      : 'Six tries. Five letters. Find the word.';
  }

  function flashStatus(message) {
    window.clearTimeout(messageTimer);
    setStatus(message);
    messageTimer = window.setTimeout(function () {
      if (state.status === 'playing' && !busy) {
        setStatus(nativeKeyboard
          ? 'Tap the board and type a five-letter word.'
          : 'Type a five-letter word, then press Enter.');
      }
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
    if (busy || state.status !== 'playing' || input.length >= COLS) return;
    input += letter.toLowerCase();
    setStatus('');
    render();
  }

  function removeLetter() {
    if (busy || state.status !== 'playing' || !input.length) return;
    input = input.slice(0, -1);
    setStatus('');
    render();
  }

  function submitGuess() {
    if (busy || state.status !== 'playing') return;
    if (input.length < COLS) {
      flashStatus('Not enough letters.');
      shake();
      return;
    }
    const guess = input.toLowerCase();
    if (!VALID_SET.has(guess)) {
      flashStatus('That word is not in the list.');
      shake();
      return;
    }

    state.guesses.push(guess);
    input = '';
    if (nativeInput) nativeInput.value = '';
    busy = true;
    saveState();
    render(state.guesses.length - 1);
    updateKeyboard();
    const won = guess === state.answer;
    const lost = !won && state.guesses.length >= ROWS;
    setStatus(won ? 'You found it.' : lost ? 'No more guesses.' : 'Checking…');
    if (window.MergeHaptics && window.MergeHaptics.merge) window.MergeHaptics.merge(24);

    window.clearTimeout(revealTimer);
    revealTimer = window.setTimeout(function () {
      busy = false;
      if (won) finish(true);
      else if (lost) finish(false);
      else {
        render();
        setStatus('Guess ' + (state.guesses.length + 1) + ' of ' + ROWS + '.');
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
    resultEl.dataset.state = won ? 'won' : 'lost';
    resultTitle.textContent = won ? (tries === 1 ? 'One guess.' : 'Solved in ' + tries + '.') : 'Not this time.';
    resultCopy.textContent = won
      ? 'The word was ' + state.answer.toUpperCase() + '.'
      : 'The word was ' + state.answer.toUpperCase() + '. The next one is waiting.';
    if (resultStats) {
      const rate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
      resultStats.textContent = stats.played + ' played · ' + rate + '% won · streak ' + stats.streak + ' · best ' + stats.max;
    }
    if (resultShare) resultShare.hidden = false;
    if (nativeInput) {
      nativeInput.value = '';
      nativeInput.blur();
    }
    if (document.body.dataset.screen === 'wordle') {
      try {
        resultEl.focus({ preventScroll: true });
      } catch (err) {
        resultEl.focus();
      }
    }
  }

  function hideResult() {
    resultEl.hidden = true;
    resultEl.removeAttribute('data-state');
  }

  function newGame() {
    window.clearTimeout(revealTimer);
    window.clearTimeout(messageTimer);
    state = freshState();
    input = '';
    busy = false;
    if (nativeInput) nativeInput.value = '';
    hideResult();
    saveState();
    render();
    updateKeyboard();
    updateStats();
    setStatus(idleMessage());
    try { boardEl.focus({ preventScroll: true }); } catch (err) {}
  }

  function shareResult() {
    const pattern = state.guesses.map(function (guess) {
      return scoreGuess(guess, state.answer).map(function (score) {
        return score === 'correct' ? '🟩' : score === 'present' ? '🟨' : '⬛';
      }).join('');
    }).join('\n');
    const score = state.status === 'won' ? String(state.guesses.length) : 'X';
    const text = 'Sixfold — Wordle ' + score + '/6\n\n' + pattern;
    if (window.MergeShare && window.MergeShare.share) {
      window.MergeShare.share('Sixfold — Wordle', text);
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    }
  }

  function handleKey(key) {
    if (key === 'Enter') submitGuess();
    else if (key === 'Backspace') removeLetter();
    else if (/^[a-z]$/.test(key)) addLetter(key);
  }

  function onKeyDown(event) {
    if (document.body.dataset.screen !== 'wordle') return;
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (document.documentElement.classList.contains('sheet-open')) return;
    const target = event.target;
    if (target === nativeInput) return;
    if (target && target.closest && target.closest('input, textarea, select')) return;
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
    if (/^[a-zA-Z]$/.test(event.key)) {
      event.preventDefault();
      addLetter(event.key);
    }
  }

  function activate() {
    updateStats();
    if (state.status === 'playing') {
      hideResult();
      render();
      updateKeyboard();
      setStatus(state.guesses.length ? 'Guess ' + (state.guesses.length + 1) + ' of ' + ROWS + '.' : idleMessage());
    } else {
      render();
      updateKeyboard();
      showResult(state.status === 'won');
    }
  }

  function deactivate() {
    if (nativeInput) nativeInput.blur();
    saveState();
  }

  function reset() {
    window.clearTimeout(revealTimer);
    window.clearTimeout(messageTimer);
    try { localStorage.removeItem(GAME_KEY); } catch (err) {}
    try { localStorage.removeItem(STATS_KEY); } catch (err) {}
    stats = cleanStats(null);
    state = freshState();
    input = '';
    busy = false;
    if (nativeInput) nativeInput.value = '';
    hideResult();
    saveStats();
    saveState();
    render();
    updateKeyboard();
    updateStats();
    setStatus('Wordle reset. A fresh five-letter word is ready.');
  }

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
  document.addEventListener('keydown', onKeyDown);

  if (nativeInput) {
    nativeInput.addEventListener('focus', function () {
      nativeInput.value = input;
      try {
        nativeInput.setSelectionRange(input.length, input.length);
      } catch (err) {}
    });
    nativeInput.addEventListener('keydown', function (event) {
      if (event.isComposing) return;
      if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        submitGuess();
      }
    });
    nativeInput.addEventListener('input', function () {
      if (state.status !== 'playing' || busy) {
        nativeInput.value = input;
        return;
      }
      const typed = nativeInput.value.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, COLS);
      if (nativeInput.value !== typed) nativeInput.value = typed;
      input = typed;
      setStatus('');
      render();
    });
  }

  if (noteEl) {
    noteEl.textContent = nativeKeyboard
      ? 'Tap the board to type with your keyboard.'
      : 'Type on your keyboard or tap the keys below.';
  }

  if (state.status !== 'playing') showResult(state.status === 'won');
  else setStatus(state.guesses.length ? 'Guess ' + (state.guesses.length + 1) + ' of ' + ROWS + '.' : idleMessage());

  window.SixfoldWordle = {
    title: titleEl,
    activate: activate,
    deactivate: deactivate,
    reset: reset,
    newGame: newGame
  };
})();
