/* Sudoku — a standard 9 × 9 logic puzzle. Every row, column and 3 × 3 box
   must contain 1–9 exactly once. Puzzles are generated on-device with a
   unique solution, progress is saved, and the game never needs a network. */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const boardEl = $('sudoku-board');
  const padEl = $('sudoku-pad');
  const statusEl = $('sudoku-status');
  const titleEl = $('sudoku-title');
  const levelBtn = $('sudoku-level');
  const levelLabel = $('sudoku-level-label');
  const levelSheet = $('sudoku-levels');
  const levelGrid = $('sudoku-level-grid');
  const timeEl = $('sudoku-time');
  const bestEl = $('sudoku-best');
  const resultEl = $('sudoku-result');
  const resultTitle = $('sudoku-result-title');
  const resultCopy = $('sudoku-result-copy');
  const resultStats = $('sudoku-result-stats');
  const resultNew = $('sudoku-result-new');
  const resultShare = $('sudoku-result-share');
  const notesBtn = $('sudoku-notes');
  const eraseBtn = $('sudoku-erase');
  const undoBtn = $('sudoku-undo');
  const hintBtn = $('sudoku-hint');
  const newBtn = $('sudoku-new');

  if (!boardEl || !padEl || !titleEl) return;

  const N = 9;
  const CELLS = 81;
  const STATE_KEY = 'sixfold.sudoku.state.v1';
  const STATS_KEY = 'sixfold.sudoku.stats.v1';
  const DIFF_KEY = 'sixfold.sudoku.difficulty.v1';
  const LEVELS = {
    easy: { label: 'Easy', clues: 44 },
    medium: { label: 'Medium', clues: 35 },
    hard: { label: 'Hard', clues: 29 },
    expert: { label: 'Expert', clues: 24 }
  };
  const ORDER = ['easy', 'medium', 'hard', 'expert'];
  const EMPTY_STATS = {
    played: 0,
    wins: 0,
    streak: 0,
    best: { easy: null, medium: null, hard: null, expert: null }
  };

  let initialized = false;
  let difficulty = 'easy';
  let state = null;
  let selected = -1;
  let noteMode = false;
  let history = [];
  let cells = [];
  let padButtons = [];
  let stats = cleanStats(null);
  let timerId = 0;
  let saveId = 0;
  let runStart = 0;
  let hintTimer = 0;
  let statusTimer = 0;

  /* ---------- storage ---------- */

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
      /* storage blocked: the current puzzle still plays */
    }
  }

  function cleanStats(value) {
    const next = {
      played: Math.max(0, Number(value && value.played) || 0),
      wins: Math.max(0, Number(value && value.wins) || 0),
      streak: Math.max(0, Number(value && value.streak) || 0),
      best: Object.assign({}, EMPTY_STATS.best)
    };
    ORDER.forEach(function (key) {
      const time = value && value.best && Number(value.best[key]);
      if (Number.isFinite(time) && time > 0) next.best[key] = Math.round(time);
    });
    return next;
  }

  function saveStats() {
    save(STATS_KEY, stats);
  }

  function bestFor(key) {
    const value = stats.best[key];
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours) return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    return minutes + ':' + String(secs).padStart(2, '0');
  }

  /* ---------- puzzle generation ---------- */

  function shuffled(values) {
    const next = values.slice();
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = next[i];
      next[i] = next[j];
      next[j] = temp;
    }
    return next;
  }

  function makeSolved() {
    const digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const rows = [];
    shuffled([0, 1, 2]).forEach(function (band) {
      shuffled([0, 1, 2]).forEach(function (row) { rows.push(band * 3 + row); });
    });
    const cols = [];
    shuffled([0, 1, 2]).forEach(function (stack) {
      shuffled([0, 1, 2]).forEach(function (col) { cols.push(stack * 3 + col); });
    });
    const grid = [];
    for (let r = 0; r < N; r += 1) {
      for (let c = 0; c < N; c += 1) {
        const base = (rows[r] * 3 + Math.floor(rows[r] / 3) + cols[c]) % 9;
        grid.push(digits[base]);
      }
    }
    return grid;
  }

  function popcount(value) {
    let count = 0;
    let bits = value;
    while (bits) {
      bits &= bits - 1;
      count += 1;
    }
    return count;
  }

  function candidateMask(grid, index) {
    const row = Math.floor(index / N);
    const col = index % N;
    let mask = 0x1FF;
    for (let i = 0; i < N; i += 1) {
      const rowValue = grid[row * N + i];
      const colValue = grid[i * N + col];
      if (rowValue) mask &= ~(1 << (rowValue - 1));
      if (colValue) mask &= ~(1 << (colValue - 1));
    }
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r += 1) {
      for (let c = boxCol; c < boxCol + 3; c += 1) {
        const value = grid[r * N + c];
        if (value) mask &= ~(1 << (value - 1));
      }
    }
    return mask;
  }

  function countSolutions(start, limit) {
    const grid = start.slice();
    let count = 0;
    function search() {
      if (count >= limit) return;
      let bestIndex = -1;
      let bestMask = 0;
      let bestCount = 10;
      for (let i = 0; i < CELLS; i += 1) {
        if (grid[i]) continue;
        const mask = candidateMask(grid, i);
        const options = popcount(mask);
        if (options === 0) return;
        if (options < bestCount) {
          bestIndex = i;
          bestMask = mask;
          bestCount = options;
          if (options === 1) break;
        }
      }
      if (bestIndex === -1) {
        count += 1;
        return;
      }
      for (let digit = 1; digit <= 9; digit += 1) {
        if (!(bestMask & (1 << (digit - 1)))) continue;
        grid[bestIndex] = digit;
        search();
        grid[bestIndex] = 0;
        if (count >= limit) return;
      }
    }
    search();
    return count;
  }

  function makePuzzle(level) {
    const solution = makeSolved();
    const puzzle = solution.slice();
    const target = LEVELS[level].clues;
    const order = shuffled(Array.from({ length: CELLS }, function (_, index) { return index; }));
    let givens = puzzle.filter(Boolean).length;
    const started = Date.now();

    // Symmetric clues look right on a printed grid; keep a pair only when the
    // puzzle still has exactly one solution.
    for (let i = 0; i < order.length && givens > target; i += 1) {
      if (Date.now() - started > 2200) break;
      const index = order[i];
      const mirror = CELLS - 1 - index;
      if (!puzzle[index] && !puzzle[mirror]) continue;
      const first = puzzle[index];
      const second = puzzle[mirror];
      if (puzzle[index]) puzzle[index] = 0;
      if (mirror !== index && puzzle[mirror]) puzzle[mirror] = 0;
      if (countSolutions(puzzle, 2) === 1) {
        givens = puzzle.filter(Boolean).length;
      } else {
        puzzle[index] = first;
        if (mirror !== index) puzzle[mirror] = second;
      }
    }

    // A few puzzles cannot reach the requested clue count with symmetry alone.
    // Remove single clues only when uniqueness is preserved.
    for (let i = 0; i < order.length && givens > target; i += 1) {
      if (Date.now() - started > 2800) break;
      const index = order[i];
      if (!puzzle[index]) continue;
      const value = puzzle[index];
      puzzle[index] = 0;
      if (countSolutions(puzzle, 2) === 1) givens -= 1;
      else puzzle[index] = value;
    }

    return { puzzle: puzzle, solution: solution };
  }

  /* ---------- state ---------- */

  function cleanState(value) {
    if (!value || typeof value !== 'object') return null;
    if (!Array.isArray(value.puzzle) || !Array.isArray(value.solution) || !Array.isArray(value.grid) || !Array.isArray(value.notes)) return null;
    if (value.puzzle.length !== CELLS || value.solution.length !== CELLS || value.grid.length !== CELLS || value.notes.length !== CELLS) return null;
    const level = LEVELS[value.difficulty] ? value.difficulty : 'easy';
    const puzzle = value.puzzle.map(function (n) { return Number.isInteger(n) && n >= 0 && n <= 9 ? n : 0; });
    const solution = value.solution.map(function (n) { return Number.isInteger(n) && n >= 1 && n <= 9 ? n : 0; });
    const grid = value.grid.map(function (n, index) {
      if (!Number.isInteger(n) || n < 0 || n > 9) return 0;
      if (puzzle[index]) return puzzle[index];
      return n;
    });
    const notes = value.notes.map(function (n) { return Number.isInteger(n) && n >= 0 && n < 512 ? n : 0; });
    const solved = value.solved === true && grid.every(function (n, index) { return n === solution[index]; });
    return {
      puzzle: puzzle,
      solution: solution,
      grid: solved ? solution.slice() : grid,
      notes: notes,
      difficulty: level,
      elapsed: Math.max(0, Number(value.elapsed) || 0),
      hints: Math.max(0, Number(value.hints) || 0),
      solved: solved
    };
  }

  function saveState() {
    if (!state) return;
    save(STATE_KEY, {
      puzzle: state.puzzle,
      solution: state.solution,
      grid: state.grid,
      notes: state.notes,
      difficulty: state.difficulty,
      elapsed: Math.round(currentElapsed()),
      hints: state.hints,
      solved: state.solved
    });
  }

  function loadState() {
    return cleanState(load(STATE_KEY, null));
  }

  function currentElapsed() {
    if (!state) return 0;
    if (!runStart) return state.elapsed;
    return state.elapsed + (Date.now() - runStart) / 1000;
  }

  /* ---------- rendering ---------- */

  function conflictSet() {
    const conflicts = new Set();
    function check(indices) {
      const seen = {};
      indices.forEach(function (index) {
        const value = state.grid[index];
        if (!value) return;
        if (seen[value] !== undefined) {
          conflicts.add(index);
          conflicts.add(seen[value]);
        } else {
          seen[value] = index;
        }
      });
    }
    for (let r = 0; r < N; r += 1) {
      const row = [];
      for (let c = 0; c < N; c += 1) row.push(r * N + c);
      check(row);
    }
    for (let c = 0; c < N; c += 1) {
      const col = [];
      for (let r = 0; r < N; r += 1) col.push(r * N + c);
      check(col);
    }
    for (let box = 0; box < N; box += 1) {
      const cellsInBox = [];
      const boxRow = Math.floor(box / 3) * 3;
      const boxCol = (box % 3) * 3;
      for (let r = boxRow; r < boxRow + 3; r += 1) {
        for (let c = boxCol; c < boxCol + 3; c += 1) cellsInBox.push(r * N + c);
      }
      check(cellsInBox);
    }
    return conflicts;
  }

  function samePeers(index) {
    const row = Math.floor(index / N);
    const col = index % N;
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    return function (other) {
      if (other === index) return false;
      const otherRow = Math.floor(other / N);
      const otherCol = other % N;
      return otherRow === row || otherCol === col ||
        (otherRow >= boxRow && otherRow < boxRow + 3 && otherCol >= boxCol && otherCol < boxCol + 3);
    };
  }

  function notesText(mask) {
    const values = [];
    for (let digit = 1; digit <= 9; digit += 1) {
      if (mask & (1 << (digit - 1))) values.push(String(digit));
    }
    return values.join(' ');
  }

  function render() {
    if (!state) return;
    const conflicts = conflictSet();
    const selectedValue = selected >= 0 ? state.grid[selected] : 0;
    const isPeer = selected >= 0 ? samePeers(selected) : function () { return false; };
    const placed = {};
    for (let i = 0; i < CELLS; i += 1) {
      const cell = cells[i];
      if (!cell) continue;
      const given = state.puzzle[i] !== 0;
      const value = state.grid[i];
      const notes = state.notes[i];
      const classes = ['sudoku-cell'];
      if (given) classes.push('is-given');
      else if (value) classes.push('is-entry');
      if (i === selected) classes.push('is-selected');
      else if (isPeer(i)) classes.push('is-peer');
      if (selectedValue && value === selectedValue && i !== selected) classes.push('is-same');
      if (conflicts.has(i)) classes.push('is-conflict');
      if ((i % N) === 2 || (i % N) === 5) classes.push('is-edge-right');
      cell.className = classes.join(' ');
      cell.tabIndex = i === selected ? 0 : -1;
      cell.setAttribute('aria-selected', i === selected ? 'true' : 'false');
      cell.setAttribute('aria-invalid', conflicts.has(i) ? 'true' : 'false');

      if (value) {
        cell.textContent = String(value);
      } else if (notes) {
        let markup = '<span class="sudoku-notes" aria-hidden="true">';
        for (let digit = 1; digit <= 9; digit += 1) {
          markup += '<i>' + (notes & (1 << (digit - 1)) ? digit : '') + '</i>';
        }
        markup += '</span>';
        cell.innerHTML = markup;
      } else {
        cell.textContent = '';
      }

      if (value) placed[value] = (placed[value] || 0) + 1;
      const label = 'Row ' + (Math.floor(i / N) + 1) + ', column ' + ((i % N) + 1) + ', ' +
        (given ? 'given ' + value : value ? String(value) : 'empty') +
        (notes ? ', notes ' + notesText(notes) : '') +
        (conflicts.has(i) ? ', conflict' : '');
      cell.setAttribute('aria-label', label);
    }

    padButtons.forEach(function (button) {
      const digit = Number(button.dataset.digit);
      const used = placed[digit] || 0;
      const remaining = Math.max(0, N - used);
      const count = button.querySelector('.sudoku-pad-count');
      if (count) count.textContent = remaining > 0 ? String(remaining) : '';
      button.disabled = remaining === 0;
      button.setAttribute('aria-label', 'Enter ' + digit + ', ' + remaining + ' remaining');
    });

    if (levelLabel) levelLabel.textContent = LEVELS[difficulty].label;
    if (timeEl) timeEl.textContent = formatTime(currentElapsed());
    const best = bestFor(difficulty);
    if (bestEl) bestEl.textContent = best ? formatTime(best) : '—';
    if (notesBtn) notesBtn.setAttribute('aria-pressed', noteMode ? 'true' : 'false');
  }

  function renderPad() {
    if (!padEl) return;
    padEl.innerHTML = '';
    padButtons = [];
    for (let digit = 1; digit <= 9; digit += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sudoku-pad-key';
      button.dataset.digit = String(digit);
      button.innerHTML = '<span>' + digit + '</span><small class="sudoku-pad-count"></small>';
      button.addEventListener('click', function () { placeDigit(digit); });
      padEl.appendChild(button);
      padButtons.push(button);
    }
  }

  function buildBoard() {
    boardEl.innerHTML = '';
    cells = [];
    for (let r = 0; r < N; r += 1) {
      const row = document.createElement('div');
      row.className = 'sudoku-row';
      row.setAttribute('role', 'row');
      for (let c = 0; c < N; c += 1) {
        const index = r * N + c;
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'sudoku-cell';
        cell.dataset.index = String(index);
        cell.setAttribute('role', 'gridcell');
        cell.tabIndex = -1;
        cell.addEventListener('click', function () { select(index, true); });
        cell.addEventListener('focus', function () { select(index, false); });
        row.appendChild(cell);
        cells.push(cell);
      }
      boardEl.appendChild(row);
    }
  }

  /* ---------- actions ---------- */

  function setStatus(message, hold) {
    if (!statusEl) return;
    window.clearTimeout(statusTimer);
    statusEl.textContent = message;
    if (hold) {
      statusTimer = window.setTimeout(function () {
        if (state && !state.solved) statusEl.textContent = 'Tap a cell, then a number.';
      }, hold);
    }
  }

  function select(index, focus) {
    if (!state || state.solved) return;
    if (index < 0 || index >= CELLS) return;
    selected = index;
    render();
    if (focus && cells[index]) cells[index].focus({ preventScroll: true });
    if (window.MergeCoach) window.MergeCoach.event('sudoku', 'select');
  }

  function snapshot() {
    return { grid: state.grid.slice(), notes: state.notes.slice(), selected: selected };
  }

  function pushHistory() {
    history.push(snapshot());
    if (history.length > 120) history.shift();
  }

  function clearPeerNotes(index, digit) {
    const peers = samePeers(index);
    const bit = 1 << (digit - 1);
    for (let i = 0; i < CELLS; i += 1) {
      if (peers(i) && state.notes[i] & bit) state.notes[i] &= ~bit;
    }
  }

  function placedCount() {
    let count = 0;
    for (let i = 0; i < CELLS; i += 1) {
      if (!state.puzzle[i] && state.grid[i]) count += 1;
    }
    return count;
  }

  function placeDigit(digit) {
    if (!state || state.solved) return;
    if (selected < 0) {
      setStatus('Tap a cell first.', 1800);
      return;
    }
    if (state.puzzle[selected]) {
      setStatus('Givens are locked.', 1800);
      return;
    }
    if (!noteMode) {
      let used = 0;
      for (let i = 0; i < CELLS; i += 1) {
        if (state.grid[i] === digit) used += 1;
      }
      if (used >= 9) {
        setStatus('All nine ' + digit + 's are already placed.', 1800);
        return;
      }
    }
    pushHistory();
    if (noteMode) {
      state.grid[selected] = 0;
      state.notes[selected] ^= 1 << (digit - 1);
      setStatus('Note toggled.');
    } else {
      state.grid[selected] = digit;
      state.notes[selected] = 0;
      clearPeerNotes(selected, digit);
      setStatus('Digit placed.');
      if (window.MergeHaptics && window.MergeHaptics.merge) window.MergeHaptics.merge(16);
      if (window.MergeCoach) window.MergeCoach.event('sudoku', 'place', { placed: placedCount() });
    }
    saveState();
    render();
    checkSolved();
  }

  function eraseCell() {
    if (!state || state.solved || selected < 0) return;
    if (state.puzzle[selected]) {
      setStatus('Givens are locked.', 1800);
      return;
    }
    if (!state.grid[selected] && !state.notes[selected]) {
      setStatus('That cell is already empty.', 1600);
      return;
    }
    pushHistory();
    state.grid[selected] = 0;
    state.notes[selected] = 0;
    saveState();
    render();
    setStatus('Cell cleared.');
  }

  function undo() {
    if (!state || state.solved || !history.length) {
      setStatus('Nothing to undo.', 1600);
      return;
    }
    const previous = history.pop();
    state.grid = previous.grid;
    state.notes = previous.notes;
    selected = previous.selected;
    saveState();
    render();
    setStatus('Undone.');
  }

  function hint() {
    if (!state || state.solved) return;
    let target = selected;
    const needs = function (index) {
      return index >= 0 && !state.puzzle[index] && state.grid[index] !== state.solution[index];
    };
    if (!needs(target)) {
      target = -1;
      for (let i = 0; i < CELLS; i += 1) {
        if (needs(i)) {
          target = i;
          break;
        }
      }
    }
    if (target < 0) {
      setStatus('Every cell is already correct.');
      return;
    }
    pushHistory();
    state.grid[target] = state.solution[target];
    state.notes[target] = 0;
    clearPeerNotes(target, state.solution[target]);
    state.hints += 1;
    selected = target;
    saveState();
    render();
    if (cells[target]) {
      cells[target].classList.add('is-hint');
      window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(function () { if (cells[target]) cells[target].classList.remove('is-hint'); }, 950);
      cells[target].focus({ preventScroll: true });
    }
    setStatus('Hint placed a ' + state.solution[target] + '.');
    if (window.MergeCoach) window.MergeCoach.event('sudoku', 'place', { placed: placedCount() });
    checkSolved();
  }

  function toggleNotes() {
    if (!state || state.solved) return;
    noteMode = !noteMode;
    render();
    setStatus(noteMode ? 'Notes on. Tap numbers to pencil them in.' : 'Notes off.');
  }

  function checkSolved() {
    if (!state || state.solved) return;
    for (let i = 0; i < CELLS; i += 1) {
      if (state.grid[i] !== state.solution[i]) return;
    }
    finish();
  }

  function finish() {
    pauseTimer();
    state.solved = true;
    state.elapsed = Math.round(state.elapsed);
    const time = state.elapsed;
    const previous = bestFor(difficulty);
    stats.played += 1;
    stats.wins += 1;
    stats.streak += 1;
    if (previous === null || time < previous) stats.best[difficulty] = time;
    saveStats();
    saveState();
    render();
    showResult();
    if (window.MergeCoach) window.MergeCoach.complete('sudoku');
    if (window.MergeHaptics && window.MergeHaptics.win) window.MergeHaptics.win();
    if (window.MergeCelebrate && resultEl) {
      window.setTimeout(function () {
        window.MergeCelebrate.win(resultEl.querySelector('.sudoku-result-card'), { stamp: 'GRID COMPLETE' });
      }, 120);
    }
  }

  function showResult() {
    if (!resultEl) return;
    const best = bestFor(difficulty);
    resultEl.hidden = false;
    resultEl.dataset.state = 'won';
    if (resultTitle) resultTitle.textContent = 'Solved.';
    if (resultCopy) {
      resultCopy.textContent = LEVELS[difficulty].label + ' puzzle finished in ' + formatTime(state.elapsed) +
        (state.hints ? ' with ' + state.hints + (state.hints === 1 ? ' hint.' : ' hints.') : ' with no hints.');
    }
    if (resultStats) {
      resultStats.textContent = stats.wins + (stats.wins === 1 ? ' puzzle solved' : ' puzzles solved') +
        (best ? ' · best ' + formatTime(best) : '');
    }
    if (resultNew && document.body.dataset.screen === 'sudoku') resultNew.focus({ preventScroll: true });
  }

  function hideResult() {
    if (resultEl) {
      resultEl.hidden = true;
      resultEl.removeAttribute('data-state');
    }
  }

  function renderLevelSheet() {
    if (!levelGrid) return;
    levelGrid.innerHTML = '';
    ORDER.forEach(function (key) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sudoku-level-option' + (key === difficulty ? ' is-active' : '');
      const best = bestFor(key);
      button.innerHTML = '<strong>' + LEVELS[key].label + '</strong><span>' +
        (best ? 'Best ' + formatTime(best) : 'No solves yet') + '</span>';
      button.setAttribute('aria-pressed', key === difficulty ? 'true' : 'false');
      button.addEventListener('click', function () {
        difficulty = key;
        try { localStorage.setItem(DIFF_KEY, key); } catch (err) {}
        closeLevelSheet();
        startNewPuzzle(key);
      });
      levelGrid.appendChild(button);
    });
  }

  function openLevelSheet() {
    renderLevelSheet();
    if (window.MergeTheme && window.MergeTheme.openSheet) {
      window.MergeTheme.openSheet(levelSheet, levelBtn);
    } else if (levelSheet) {
      levelSheet.hidden = false;
      levelSheet.classList.add('is-open');
    }
  }

  function closeLevelSheet() {
    if (window.MergeTheme && window.MergeTheme.closeSheet) window.MergeTheme.closeSheet(levelSheet);
    else if (levelSheet) {
      levelSheet.hidden = true;
      levelSheet.classList.remove('is-open');
    }
  }

  function startNewPuzzle(level) {
    difficulty = LEVELS[level] ? level : difficulty;
    try { localStorage.setItem(DIFF_KEY, difficulty); } catch (err) {}
    pauseTimer();
    setStatus('Building a unique ' + LEVELS[difficulty].label + ' puzzle…');
    window.setTimeout(function () {
      const generated = makePuzzle(difficulty);
      state = {
        puzzle: generated.puzzle,
        solution: generated.solution,
        grid: generated.puzzle.slice(),
        notes: new Array(CELLS).fill(0),
        difficulty: difficulty,
        elapsed: 0,
        hints: 0,
        solved: false
      };
      selected = -1;
      for (let i = 0; i < CELLS; i += 1) {
        if (!state.puzzle[i]) {
          selected = i;
          break;
        }
      }
      history = [];
      noteMode = false;
      hideResult();
      saveState();
      render();
      renderLevelSheet();
      if (document.body.dataset.screen === 'sudoku') startTimer();
      setStatus(LEVELS[difficulty].label + ' puzzle ready. One solution.');
      // A programmatic focus would count as the player's first selection and
      // skip the coach's opening step. Only focus the board when no coach card
      // is waiting for that first tap.
      if (cells[selected] && !document.querySelector('.play-feedback.has-coach')) {
        cells[selected].focus({ preventScroll: true });
      }
    }, 30);
  }

  /* ---------- timer ---------- */

  function updateTime() {
    if (!state) return;
    if (timeEl) timeEl.textContent = formatTime(currentElapsed());
  }

  function startTimer() {
    if (!state || state.solved) return;
    if (!runStart) runStart = Date.now();
    if (timerId) return;
    timerId = window.setInterval(updateTime, 500);
  }

  function pauseTimer() {
    if (runStart && state) {
      state.elapsed += (Date.now() - runStart) / 1000;
      runStart = 0;
    }
    if (timerId) {
      window.clearInterval(timerId);
      timerId = 0;
    }
    updateTime();
  }

  /* ---------- keyboard ---------- */

  function moveSelection(deltaRow, deltaCol) {
    if (!state || state.solved) return;
    const current = selected >= 0 ? selected : 0;
    const row = Math.max(0, Math.min(N - 1, Math.floor(current / N) + deltaRow));
    const col = Math.max(0, Math.min(N - 1, (current % N) + deltaCol));
    select(row * N + col, true);
  }

  function onBoardKey(event) {
    if (!state || state.solved) return;
    if (document.documentElement.classList.contains('sheet-open') || (resultEl && !resultEl.hidden)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      if (key === 'ArrowUp') moveSelection(-1, 0);
      else if (key === 'ArrowDown') moveSelection(1, 0);
      else if (key === 'ArrowLeft') moveSelection(0, -1);
      else moveSelection(0, 1);
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      eraseCell();
      return;
    }
    if (/^[1-9]$/.test(key)) {
      event.preventDefault();
      placeDigit(Number(key));
      return;
    }
    if (key === 'n' || key === 'N') {
      event.preventDefault();
      toggleNotes();
      return;
    }
    if (key === 'h' || key === 'H') {
      event.preventDefault();
      hint();
      return;
    }
    if (key === 'u' || key === 'U') {
      event.preventDefault();
      undo();
    }
  }

  /* ---------- sharing ---------- */

  function sharePuzzle() {
    const time = state.solved ? state.elapsed : Math.round(currentElapsed());
    const label = LEVELS[difficulty].label;
    const hintText = state.hints ? state.hints + (state.hints === 1 ? ' hint' : ' hints') : 'no hints';
    const message = 'I solved a ' + label + ' Sudoku in ' + formatTime(time) + ' with ' + hintText + '. Can you?';
    const accent = window.MergeTheme && window.MergeTheme.colour ? window.MergeTheme.colour('#39a9a1') : '#39a9a1';
    if (window.MergeShare && window.MergeShare.result) {
      window.MergeShare.result('Sudoku', message, {
        game: 'Sudoku', number: '02', kind: 'LOGIC', title: 'Sudoku',
        score: formatTime(time), label: 'TIME', meta: [label, hintText], accent: accent
      });
      return;
    }
    if (window.MergeShare && window.MergeShare.share) window.MergeShare.share('Sudoku', message);
  }

  /* ---------- setup ---------- */

  function ensureInit() {
    if (initialized) return;
    initialized = true;
    buildBoard();
    renderPad();

    const savedDifficulty = load(DIFF_KEY, null);
    if (LEVELS[savedDifficulty]) difficulty = savedDifficulty;
    stats = cleanStats(load(STATS_KEY, null));
    state = loadState();
    if (state) difficulty = state.difficulty;

    if (!state) {
      state = {
        puzzle: new Array(CELLS).fill(0),
        solution: new Array(CELLS).fill(0),
        grid: new Array(CELLS).fill(0),
        notes: new Array(CELLS).fill(0),
        difficulty: difficulty,
        elapsed: 0,
        hints: 0,
        solved: false
      };
      startNewPuzzle(difficulty);
    } else {
      selected = -1;
      for (let i = 0; i < CELLS; i += 1) {
        if (!state.puzzle[i] && state.grid[i] !== state.solution[i]) {
          selected = i;
          break;
        }
      }
      render();
      if (state.solved) showResult();
    }

    if (levelBtn) levelBtn.addEventListener('click', openLevelSheet);
    if (levelSheet) {
      levelSheet.querySelectorAll('[data-close], .sheet-done').forEach(function (el) {
        el.addEventListener('click', closeLevelSheet);
      });
    }
    if (notesBtn) notesBtn.addEventListener('click', toggleNotes);
    if (eraseBtn) eraseBtn.addEventListener('click', eraseCell);
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (hintBtn) hintBtn.addEventListener('click', hint);
    if (newBtn) newBtn.addEventListener('click', function () { startNewPuzzle(difficulty); });
    if (resultNew) resultNew.addEventListener('click', function () { startNewPuzzle(difficulty); });
    if (resultShare) resultShare.addEventListener('click', sharePuzzle);
    boardEl.addEventListener('keydown', onBoardKey);

    document.addEventListener('visibilitychange', function () {
      if (document.body.dataset.screen !== 'sudoku') return;
      if (document.hidden) {
        pauseTimer();
        saveState();
      } else if (state && !state.solved) {
        startTimer();
      }
    });
    window.addEventListener('pagehide', saveState);
    saveId = window.setInterval(function () {
      if (document.body.dataset.screen === 'sudoku' && state && !state.solved) saveState();
    }, 5000);
  }

  function activate() {
    ensureInit();
    if (!state) return;
    if (state.solved) showResult();
    else hideResult();
    startTimer();
    render();
    if (!state.solved) setStatus(state.hints ? 'Hint used. Keep going.' : 'Tap a cell, then a number.');
  }

  function deactivate() {
    pauseTimer();
    saveState();
  }

  function reset() {
    pauseTimer();
    try { localStorage.removeItem(STATE_KEY); } catch (err) {}
    try { localStorage.removeItem(STATS_KEY); } catch (err) {}
    stats = cleanStats(null);
    difficulty = 'easy';
    try { localStorage.setItem(DIFF_KEY, difficulty); } catch (err) {}
    state = null;
    history = [];
    noteMode = false;
    hideResult();
    startNewPuzzle('easy');
    setStatus('Sudoku reset. A fresh Easy puzzle is ready.');
  }

  window.SixfoldSudoku = {
    title: titleEl,
    activate: activate,
    deactivate: deactivate,
    reset: reset
  };
})();
