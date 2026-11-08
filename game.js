(() => {
  'use strict';

  const DEFAULT_SIZE = 4;
  const SIZE_KEY = 'merge2048.size';
  const SAVE_KEY = 'merge2048.save';
  const LAUNCH_FOCUS_KEY = 'merge2048.launchFullscreen';
  const SWIPE_MIN = 22;
  const MOVE_MS = 150;
  const STORE_BEST = 'merge2048.best';

  let size = DEFAULT_SIZE;

  const boardEl = document.getElementById('board');
  const gridEl = document.getElementById('grid');
  const tilesEl = document.getElementById('tiles');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const movesEl = document.getElementById('moves');
  const overlayEl = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const overlayScore = document.getElementById('overlay-score');
  const overlayMeta = document.getElementById('overlay-meta');
  const overlayShare = document.getElementById('overlay-share');
  const overlaySave = document.getElementById('overlay-save');
  const overlayBtn = document.getElementById('overlay-btn');
  const resultPreview = document.getElementById('result-preview');
  const resultPreviewImg = document.getElementById('result-preview-img');
  const newBtn = document.getElementById('new-game');
  const focusBtn = document.getElementById('focus-toggle');
  const viewResultBtn = document.getElementById('view-result');
  const hapticBtn = document.getElementById('vibration-toggle');
  const sheetEl = document.getElementById('sheet');
  const helpEl = document.getElementById('help');
  const hintEl = document.querySelector('.hint');
  const boardSummaryEl = document.getElementById('board-summary');
  const gameStatusEl = document.getElementById('game-status');
  const headerEl = document.querySelector('.header');
  const footerEl = document.querySelector('.footer');
  const HINT_TIGHT = 'Nearly full — look for a match.';
  const TIP_KEY = 'merge2048.tip';
  const TIP_EVERY = 14;
  const SHARE_FONT = '"Google Sans Flex", ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  // Short enough to stay on one line on the narrowest phone, and each one is
  // something you can act on in the next few moves.
  const TIPS = [
    'Tip: park your biggest tile in a corner.',
    'Tip: build along one edge, not in the middle.',
    'Tip: free a square before hunting for a merge.',
    'Tip: merge small tiles early, while it is easy.',
    'Tip: leave a lane open for the next big tile.',
    'Tip: keep tiles stepping down toward your corner.',
    'Tip: think twice — there is no undo.',
    'Tip: your board and best score are saved here.',
    'Tip: tap New game for a fresh board any time.',
    'Tip: 3×3 is a quick round; 5×5 is a long one.'
  ];

  // Start where the last visit left off, so the tips keep taking turns.
  let tipIndex = 0;
  let movesSinceTip = 0;
  let booted = false;
  try {
    const storedTip = Number(localStorage.getItem(TIP_KEY));
    if (Number.isInteger(storedTip) && storedTip >= 0) tipIndex = storedTip % TIPS.length;
  } catch (err) {
    /* storage blocked — start at the top */
  }

  const noHaptics = {
    supported: function () { return false; },
    merge: function () {}, win: function () {}, over: function () {},
    isEnabled: function () { return false; }, toggle: function () { return false; }
  };
  const haptics = window.MergeHaptics || noHaptics;

  const VEC = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] };

  let tiles = [];
  let grid = [];
  let score = 0;
  let best = 0;
  let moves = 0;
  // The record this game started with, so beating it is celebrated exactly once.
  let bestAtStart = 0;
  let beatBest = false;
  let recordTimer = 0;
  let statusTimer = 0;
  let won = false;
  // Whether the card on screen is the 2048 win, so Share can say so.
  let overlayWin = false;
  // The result behind the card: kept after it is put away so it can be opened
  // again, even once a new game is under way.
  let resultSnapshot = null;
  // The picture of the card, and the draw that is still on its way.
  let resultFile = null;
  let resultFilePromise = null;
  let resultImageToken = 0;
  let resultPreviewUrl = '';
  let shareFlashTimer = 0;
  let saveFlashTimer = 0;
  let busy = false;
  let nextId = 1;
  let cell = 0;
  // One measured box per grid cell, in pixels relative to the tile layer.
  // Tiles use these directly instead of recomputing cell + gap, so they stay
  // pinned to the real grid even when a cell lands on a fractional pixel or
  // the viewport is still settling after a resize.
  let cellBoxes = [];
  let overlayAction = null;
  // Bumped on every reset so a move that is still animating can't touch the new board.
  let generation = 0;
  // Set while "All settings" is being cleared: the reload that follows must not
  // let the pagehide save write the old board back into storage.
  let saveSuspended = false;
  let overlayHideTimer = 0;
  let scorePulseTimer = 0;

  /* ---------- board size ---------- */

  function readStoredSize() {
    try {
      const saved = Number(localStorage.getItem(SIZE_KEY));
      if (saved === 3 || saved === 4 || saved === 5) return saved;
    } catch (err) {
      /* storage blocked — use the default */
    }
    return DEFAULT_SIZE;
  }

  function buildCells() {
    gridEl.textContent = '';
    gridEl.style.gridTemplateColumns = 'repeat(' + size + ', 1fr)';
    gridEl.style.gridTemplateRows = 'repeat(' + size + ', 1fr)';
    for (let i = 0; i < size * size; i++) {
      const d = document.createElement('div');
      d.className = 'cell';
      gridEl.appendChild(d);
    }
  }

  function emptyGrid() {
    const rows = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) row.push(null);
      rows.push(row);
    }
    return rows;
  }

  // Each board size keeps its own best score, since bigger boards score higher.
  function bestKey() {
    return STORE_BEST + (size === DEFAULT_SIZE ? '' : '.' + size);
  }

  // The three cards keep a fixed, equal width; a long number steps down a size
  // instead of pushing the row wider.
  function setStat(el, value) {
    const text = String(value);
    el.textContent = text;
    el.classList.toggle('is-long', text.length === 5);
    el.classList.toggle('is-longer', text.length > 5);
  }

  function loadBest() {
    try {
      best = Number(localStorage.getItem(bestKey())) || 0;
    } catch (err) {
      best = 0;
    }
    setStat(bestEl, best);
  }

  size = readStoredSize();

  /* ---------- layout ---------- */

  function fontFor(value, base) {
    const len = String(value).length;
    const factor = len <= 2 ? 0.44 : len === 3 ? 0.36 : len === 4 ? 0.29 : 0.23;
    return Math.max(11, Math.round((base || cell) * factor)) + 'px';
  }

  function boxFor(tile) {
    return cellBoxes[tile.row * size + tile.col] || null;
  }

  function place(tile, animate) {
    const box = boxFor(tile);
    if (!box) return;
    if (animate === false) {
      tile.el.classList.add('instant');
      tile.el.style.transform = 'translate3d(' + box.x + 'px, ' + box.y + 'px, 0)';
      void tile.el.offsetWidth;
      tile.el.classList.remove('instant');
    } else {
      tile.el.style.transform = 'translate3d(' + box.x + 'px, ' + box.y + 'px, 0)';
    }
  }

  function measure() {
    const cells = gridEl.children;
    if (!cells.length) return;
    const origin = tilesEl.getBoundingClientRect();
    const boxes = [];
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i].getBoundingClientRect();
      // A hidden or not-yet-laid-out board has no usable geometry. Keep the
      // last good boxes and wait for the next resize rather than collapsing
      // every tile to zero.
      if (!r.width || !r.height) return;
      boxes.push({ x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height });
    }
    if (!boxes.length) return;
    cellBoxes = boxes;
    cell = boxes[0].w;

    // Resizing the board moves every tile at once. Suppress their travel
    // transitions for that frame so a fullscreen or orientation change does
    // not look like a hundred tiles are sliding at the same time.
    tilesEl.classList.add('is-measuring');
    for (const t of tiles) {
      const box = boxFor(t);
      if (!box) continue;
      t.el.style.width = box.w + 'px';
      t.el.style.height = box.h + 'px';
      t.el.style.fontSize = fontFor(t.value, box.w);
      t.el.style.transform = 'translate3d(' + box.x + 'px, ' + box.y + 'px, 0)';
    }
    void tilesEl.offsetWidth;
    tilesEl.classList.remove('is-measuring');
  }

  /* ---------- tiles ---------- */

  function createTile(value, row, col, isNew) {
    // The first tile of a new board can be asked for before the browser has
    // measured the freshly rebuilt grid.
    if (!cellBoxes.length) measure();
    const box = cellBoxes[row * size + col] || { x: 0, y: 0, w: cell, h: cell };
    const el = document.createElement('div');
    el.className = 'tile';
    el.dataset.v = String(value);
    el.style.width = box.w + 'px';
    el.style.height = box.h + 'px';
    el.style.fontSize = fontFor(value, box.w);

    const face = document.createElement('div');
    face.className = 'face' + (isNew ? ' appear' : '');
    face.textContent = String(value);

    el.appendChild(face);

    const tile = { id: nextId++, value: value, row: row, col: col, el: el, face: face };
    place(tile, false);
    tilesEl.appendChild(el);
    return tile;
  }

  function addRandomTile() {
    const empty = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!grid[r][c]) empty.push([r, c]);
      }
    }
    if (!empty.length) return null;

    const spot = empty[Math.floor(Math.random() * empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    const tile = createTile(value, spot[0], spot[1], true);
    grid[spot[0]][spot[1]] = tile;
    tiles.push(tile);
    return tile;
  }

  /* ---------- saved game ---------- */

  function saveGame() {
    const cells = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const t = grid[r][c];
        if (t) cells.push([t.value, r, c]);
      }
    }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        size: size,
        score: score,
        moves: moves,
        won: won,
        cells: cells
      }));
    } catch (err) {
      /* storage blocked — no resume, but the game still plays */
    }
  }

  function readSaved() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || (data.size !== 3 && data.size !== 4 && data.size !== 5) || !Array.isArray(data.cells)) return null;

      const cells = [];
      const taken = new Set();
      for (const item of data.cells) {
        if (!Array.isArray(item) || item.length < 3) continue;
        const value = Number(item[0]);
        const row = Number(item[1]);
        const col = Number(item[2]);
        if (!isFinite(value) || value < 2) continue;
        if (row < 0 || row >= data.size || col < 0 || col >= data.size) continue;
        // A damaged save must never place two tiles on the same square.
        const spot = row + ',' + col;
        if (taken.has(spot)) continue;
        taken.add(spot);
        cells.push([value, row, col]);
      }
      if (!cells.length) return null;
      return {
        size: data.size,
        score: Number(data.score) || 0,
        moves: Math.max(0, Math.floor(Number(data.moves) || 0)),
        won: !!data.won,
        cells: cells
      };
    } catch (err) {
      return null;
    }
  }

  function applyState(state) {
    tilesEl.textContent = '';
    tiles = [];
    grid = emptyGrid();
    for (const item of state.cells) {
      const tile = createTile(item[0], item[1], item[2], false);
      grid[item[1]][item[2]] = tile;
      tiles.push(tile);
    }
    score = state.score;
    won = state.won;
    setStat(scoreEl, score);
    if (score > best) {
      // A save can outrun a cleared best (the reset button exists), so lift it quietly.
      best = score;
      setStat(bestEl, best);
      try {
        localStorage.setItem(bestKey(), String(best));
      } catch (err) {
        /* ignore */
      }
    }
    moves = state.moves || 0;
    setStat(movesEl, moves);
    beatBest = false;
    bestAtStart = best;
    busy = false;
    hideOverlay();
    refreshHint();
    syncBoardAccessibility('Resumed game. Score ' + score + '.');
  }

  /* ---------- game rules ---------- */

  function buildOrder(dr, dc) {
    const rows = [];
    const cols = [];
    for (let i = 0; i < size; i++) {
      rows.push(i);
      cols.push(i);
    }
    if (dr > 0) rows.reverse();
    if (dc > 0) cols.reverse();
    return { rows: rows, cols: cols };
  }

  function move(dir) {
    if (busy || !overlayEl.hidden) return;

    const dr = VEC[dir][0];
    const dc = VEC[dir][1];
    const order = buildOrder(dr, dc);

    for (const t of tiles) t.merged = false;

    let moved = false;
    let gained = 0;
    const merges = [];

    for (const r of order.rows) {
      for (const c of order.cols) {
        const tile = grid[r][c];
        if (!tile) continue;

        let fr = r;
        let fc = c;
        for (;;) {
          const nr = fr + dr;
          const nc = fc + dc;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
          if (grid[nr][nc]) break;
          fr = nr;
          fc = nc;
        }

        const nr = fr + dr;
        const nc = fc + dc;
        const other = nr >= 0 && nr < size && nc >= 0 && nc < size ? grid[nr][nc] : null;

        if (other && other !== tile && other.value === tile.value && !other.merged) {
          grid[r][c] = null;
          other.merged = true;
          tile.row = nr;
          tile.col = nc;
          tile.gone = true;
          merges.push({ keep: other, gone: tile });
          gained += tile.value * 2;
          moved = true;
        } else if (fr !== r || fc !== c) {
          grid[r][c] = null;
          grid[fr][fc] = tile;
          tile.row = fr;
          tile.col = fc;
          moved = true;
        }
      }
    }

    if (!moved) {
      announceStatus('No tiles can move that way.');
      return;
    }

    moves += 1;
    setStat(movesEl, moves);

    if (merges.length) {
      let biggest = 0;
      for (const m of merges) biggest = Math.max(biggest, m.keep.value * 2);
      haptics.merge(biggest);
    }

    busy = true;
    syncResultButton();
    const moveGen = generation;
    for (const t of tiles) place(t, true);

    if (gained) {
      score += gained;
      updateScore();
      pulseScore();
    }

    window.setTimeout(function () {
      // The board was restarted while this move was animating — drop the result.
      if (moveGen !== generation) return;

      let reached2048 = false;

      for (const m of merges) {
        m.gone.el.remove();
        m.keep.value *= 2;
        m.keep.el.dataset.v = String(m.keep.value);
        m.keep.face.textContent = String(m.keep.value);
        m.keep.el.style.fontSize = fontFor(m.keep.value);
        m.keep.face.classList.remove('bump');
        void m.keep.face.offsetWidth;
        m.keep.face.classList.add('bump');
        if (m.keep.value === 2048) reached2048 = true;
      }

      tiles = tiles.filter(function (t) { return !t.gone; });

      addRandomTile();
      busy = false;
      syncResultButton();

      if (reached2048 && !won) {
        won = true;
        saveGame();
        haptics.win();
        syncBoardAccessibility('2048 reached. Score ' + score + '.');
        // The final tile can fill the board, in which case carrying on isn't
        // possible — offer a fresh round instead of a dead board.
        const finished = isGameOver();
        const snapshot = captureResult(true);
        if (finished) snapshot.text = 'You made it. No moves left — try again?';
        showResultCard(snapshot, false, finished);
        return;
      }

      saveGame();
      syncBoardAccessibility('Score ' + score + ', ' + moves + (moves === 1 ? ' move.' : ' moves.'));
      movesSinceTip += 1;
      if (movesSinceTip >= TIP_EVERY && !isGameOver() && !isNearlyFull()) {
        showTip(true);
      } else {
        refreshHint();
      }

      if (isGameOver()) {
        haptics.over();
        showResultCard(captureResult(false), false);
      }
    }, MOVE_MS);
  }

  function isGameOver() {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const t = grid[r][c];
        if (!t) return false;
        if (c + 1 < size && grid[r][c + 1] && grid[r][c + 1].value === t.value) return false;
        if (r + 1 < size && grid[r + 1][c] && grid[r + 1][c].value === t.value) return false;
      }
    }
    return true;
  }

  // Quiet heads-up when the board is almost out of room: a couple of squares
  // left and hardly any matches to play with. It only borrows the tip line.
  function isNearlyFull() {
    let empty = 0;
    let moves = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const t = grid[r][c];
        if (!t) {
          empty += 1;
          continue;
        }
        if (c + 1 < size && grid[r][c + 1] && grid[r][c + 1].value === t.value) moves += 1;
        if (r + 1 < size && grid[r + 1][c] && grid[r + 1][c].value === t.value) moves += 1;
      }
    }
    return empty <= 2 && moves <= 2;
  }

  function refreshHint() {
    if (!hintEl) return;
    const tight = !isGameOver() && isNearlyFull();
    if (tight) {
      // Announce the warning; leave the rotating tips out of the live region.
      hintEl.setAttribute('aria-live', 'polite');
      hintEl.textContent = HINT_TIGHT;
    } else {
      hintEl.textContent = TIPS[tipIndex];
      hintEl.setAttribute('aria-live', 'off');
    }
    hintEl.classList.toggle('is-warning', tight);
  }

  function boardSummary() {
    const rows = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) {
        const tile = grid[r][c];
        row.push(tile ? String(tile.value) : 'empty');
      }
      rows.push('Row ' + (r + 1) + ': ' + row.join(', '));
    }
    return size + ' by ' + size + ' board. ' + rows.join('. ') + '.';
  }

  function announceStatus(message) {
    if (!gameStatusEl) return;
    window.clearTimeout(statusTimer);
    gameStatusEl.textContent = '';
    statusTimer = window.setTimeout(function () {
      gameStatusEl.textContent = message;
    }, 30);
  }

  function syncBoardAccessibility(message) {
    if (boardSummaryEl) boardSummaryEl.textContent = boardSummary();
    if (message) announceStatus(message);
  }

  // Move on to the next tip: on every new board, and now and then during a
  // long one, so the line under the board keeps saying something new.
  function showTip(next) {
    if (!hintEl) return;
    movesSinceTip = 0;
    if (next) {
      tipIndex = (tipIndex + 1) % TIPS.length;
      try {
        localStorage.setItem(TIP_KEY, String(tipIndex));
      } catch (err) {
        /* private mode: the order just restarts next visit */
      }
    }
    refreshHint();
  }

  function pulseScore() {
    const card = scoreEl.closest('.score');
    if (!card) return;
    card.classList.remove('is-scoring');
    void card.offsetWidth;
    card.classList.add('is-scoring');
    window.clearTimeout(scorePulseTimer);
    scorePulseTimer = window.setTimeout(function () {
      card.classList.remove('is-scoring');
    }, 300);
  }

  function updateScore() {
    setStat(scoreEl, score);
    if (score > best) {
      best = score;
      setStat(bestEl, best);
      try {
        localStorage.setItem(bestKey(), String(best));
      } catch (err) {
        /* private mode: best score just won't persist */
      }
      // One small flourish the first time this game overtakes the old record.
      if (!beatBest && score > bestAtStart) {
        beatBest = true;
        celebrateBest();
      }
    }
  }

  function celebrateBest() {
    const card = bestEl.closest('.score');
    if (!card) return;
    card.classList.remove('is-record');
    void card.offsetWidth;
    card.classList.add('is-record');
    window.clearTimeout(recordTimer);
    recordTimer = window.setTimeout(function () {
      card.classList.remove('is-record');
    }, 1100);
  }

  /* ---------- overlay ---------- */

  function showOverlay(title, text, btnLabel, action, result) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayBtn.textContent = btnLabel;
    overlayAction = action;

    // Both a finished round and the 2048 win get the score card; only the win
    // offers to carry on when it first appears.
    overlayWin = !!(result && result.win);
    overlayScore.hidden = !result;
    overlayMeta.hidden = !result;
    overlayShare.hidden = !result;
    overlaySave.hidden = !result;
    // A new card starts clean; a leftover flash timer must not re-enable or
    // relabel these buttons while the new share/save is in progress.
    window.clearTimeout(shareFlashTimer);
    window.clearTimeout(saveFlashTimer);
    overlayShare.disabled = false;
    overlayShare.textContent = 'Share';
    overlaySave.disabled = false;
    overlaySave.textContent = 'Save image';
    if (result) {
      overlayScore.textContent = String(result.score);
      overlayMeta.textContent = result.size + ' × ' + result.size + ' • ' + result.moves + (result.moves === 1 ? ' move' : ' moves');
      // A new result starts with a clean placeholder rather than the previous
      // round's picture. A theme change keeps the current thumbnail until the
      // replacement is ready below.
      if (resultPreview) resultPreview.hidden = false;
      if (resultPreviewImg) resultPreviewImg.hidden = true;
      prepareResultImage(result);
    } else {
      resultFile = null;
      resultFilePromise = null;
      resultImageToken += 1;
      hideResultPreview();
    }

    // The card is modal: keep the controls underneath out of the tab order
    // while it is open.
    if (headerEl && 'inert' in headerEl) headerEl.inert = true;
    if (footerEl && 'inert' in footerEl) footerEl.inert = true;
    window.clearTimeout(overlayHideTimer);
    overlayEl.classList.remove('is-open', 'is-closing');
    overlayEl.hidden = false;
    void overlayEl.offsetWidth;
    overlayEl.classList.add('is-open');
    syncResultButton();
    // So a keyboard or screen-reader user lands on the way out of the card.
    try {
      overlayBtn.focus({ preventScroll: true });
    } catch (err) {
      overlayBtn.focus();
    }
  }

  function finishHideOverlay() {
    overlayEl.hidden = true;
    overlayEl.classList.remove('is-open', 'is-closing');
    // The card is gone, so the quiet way back to it becomes available.
    syncResultButton();
  }

  function hideOverlay() {
    if (overlayEl.hidden) return;
    overlayAction = null;
    overlayWin = false;
    if (headerEl && 'inert' in headerEl) headerEl.inert = false;
    if (footerEl && 'inert' in footerEl) footerEl.inert = false;
    syncResultButton();
    window.clearTimeout(overlayHideTimer);
    overlayEl.classList.remove('is-open');
    overlayEl.classList.add('is-closing');
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    overlayHideTimer = window.setTimeout(function () {
      finishHideOverlay();
      try {
        boardEl.focus({ preventScroll: true });
      } catch (err) {
        boardEl.focus();
      }
    }, reduced ? 0 : 260);
  }

  function overlayFocusables() {
    return Array.prototype.slice.call(overlayEl.querySelectorAll('button')).filter(function (el) {
      return !el.hidden && !el.disabled;
    });
  }

  document.addEventListener('keydown', function (e) {
    if (overlayEl.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      hideOverlay();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = overlayFocusables();
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !overlayEl.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !overlayEl.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  });

  // Keep the exact numbers from the moment the round ended, so opening the card
  // again later still tells the same story.
  function captureResult(win) {
    resultSnapshot = {
      win: !!win,
      title: win ? '2048!' : (beatBest ? 'New best!' : 'Game over'),
      text: win ? 'You made it. Keep going for a bigger score?' : 'Best ' + best,
      score: score,
      moves: moves,
      size: size,
      best: best,
      generation: generation
    };
    return resultSnapshot;
  }

  function showResultCard(snapshot, reopen, finished) {
    let label = 'Back to game';
    if (!reopen) {
      label = snapshot.win && !finished ? 'Keep going' : 'Try again';
    }
    const action = (reopen || (snapshot.win && !finished)) ? hideOverlay : newGame;
    showOverlay(snapshot.title, snapshot.text, label, action, snapshot);
  }

  function syncResultButton() {
    if (!viewResultBtn) return;
    // The chip keeps its place in the fixed-height status row even while the
    // result card is open (it is only veiled). That way closing the card only
    // reveals it again; nothing in the layout has to move.
    const hasResult = !!resultSnapshot;
    viewResultBtn.hidden = !hasResult;
    if (hasResult) {
      viewResultBtn.textContent = 'Result';
      viewResultBtn.setAttribute(
        'aria-label',
        resultSnapshot.generation === generation ? 'View result' : 'View last result'
      );
    }
    viewResultBtn.classList.toggle('is-veiled', hasResult && !overlayEl.hidden);
  }

  overlayBtn.addEventListener('click', function () {
    const action = overlayAction;
    hideOverlay();
    if (action) action();
  });

  /* ---------- sharing a finished round ---------- */

  function shareFont(weight, px) {
    return weight + ' ' + px + 'px ' + SHARE_FONT;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shareColors() {
    const styles = getComputedStyle(document.documentElement);
    const pick = function (name, fallback) {
      const value = styles.getPropertyValue(name).trim();
      return value || fallback;
    };
    return {
      page: pick('--page', '#f6f1e8'),
      panel: pick('--panel', '#e4d9c7'),
      ink: pick('--ink', '#3b3833'),
      muted: pick('--muted', '#6f665a'),
      tile: pick('--t2048', '#b9801a'),
      tileInk: pick('--ink-tile-high', '#fdfbf7')
    };
  }

  // A square picture of the result, drawn with the colours in use on the page.
  async function buildResultFile(data) {
    try {
      // The wordmark is already in use; wait for it so the picture uses it too.
      if (document.fonts && document.fonts.load) {
        await document.fonts.load(shareFont(700, 56));
      }
    } catch (err) {
      /* draw with the fallback face */
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');

    const colors = shareColors();
    const W = canvas.width;
    ctx.fillStyle = colors.page;
    ctx.fillRect(0, 0, W, W);
    ctx.textBaseline = 'middle';

    // Wordmark and one 2048 tile, so the picture is recognisably Merge.
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.ink;
    ctx.font = shareFont(700, 58);
    ctx.fillText('MERGE', 96, 142);

    const tileSize = 116;
    const tileX = W - 96 - tileSize;
    roundRect(ctx, tileX, 84, tileSize, tileSize, 24);
    ctx.fillStyle = colors.tile;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.tileInk;
    ctx.font = shareFont(700, 25);
    ctx.fillText('2048', tileX + tileSize / 2, 84 + tileSize / 2 + 1);

    // The card itself: title, score, board size and moves, best.
    const cardX = 92;
    const cardY = 286;
    const cardW = W - 184;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = 44;
    ctx.shadowOffsetY = 22;
    roundRect(ctx, cardX, cardY, cardW, 524, 56);
    ctx.fillStyle = colors.panel;
    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = colors.ink;
    ctx.font = shareFont(700, 46);
    ctx.fillText(data.title, W / 2, 366);

    ctx.font = shareFont(700, 168);
    ctx.fillText(String(data.score), W / 2, 500);

    ctx.fillStyle = colors.muted;
    ctx.font = shareFont(500, 31);
    ctx.fillText(data.size + ' × ' + data.size + ' • ' + data.moves + (data.moves === 1 ? ' move' : ' moves'), W / 2, 624);

    ctx.font = shareFont(500, 27);
    ctx.fillText('Best ' + data.best, W / 2, 678);

    const blob = await new Promise(function (resolve, reject) {
      canvas.toBlob(function (image) {
        if (image) resolve(image);
        else reject(new Error('image unavailable'));
      }, 'image/png');
    });

    if (typeof File === 'function') {
      return new File([blob], 'merge-2048-result.png', { type: 'image/png' });
    }
    blob.name = 'merge-2048-result.png';
    return blob;
  }

  function hideResultPreview() {
    if (resultPreviewImg) {
      resultPreviewImg.removeAttribute('src');
      resultPreviewImg.hidden = true;
      resultPreviewImg.classList.remove('is-fresh');
    }
    if (resultPreview) resultPreview.hidden = true;
    if (resultPreviewUrl) {
      URL.revokeObjectURL(resultPreviewUrl);
      resultPreviewUrl = '';
    }
  }

  // Decode the replacement before swapping it in, so a theme change never
  // leaves a blank square where the thumbnail was.
  function showResultPreview(file, token) {
    if (!resultPreview || !resultPreviewImg || !file) return;
    const nextUrl = URL.createObjectURL(file);
    const incoming = new Image();
    incoming.onload = function () {
      if (token !== resultImageToken) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      if (resultPreviewUrl) URL.revokeObjectURL(resultPreviewUrl);
      resultPreviewUrl = nextUrl;
      resultPreviewImg.src = nextUrl;
      resultPreviewImg.hidden = false;
      resultPreview.hidden = false;
      resultPreviewImg.classList.remove('is-fresh');
      void resultPreviewImg.offsetWidth;
      resultPreviewImg.classList.add('is-fresh');
    };
    incoming.onerror = function () {
      URL.revokeObjectURL(nextUrl);
    };
    incoming.src = nextUrl;
  }

  // Draw it once when the card opens, so a tap can share it straight away.
  function prepareResultImage(data) {
    const token = ++resultImageToken;
    resultFile = null;
    resultFilePromise = buildResultFile(data).then(function (file) {
      // A later card may have opened while this one was drawing.
      if (token === resultImageToken) {
        resultFile = file;
        showResultPreview(file, token);
      }
      return file;
    }).catch(function () {
      if (token === resultImageToken) hideResultPreview();
      return null;
    });
  }

  function shareMessage() {
    const data = resultSnapshot || { win: overlayWin, score: score, moves: moves, size: size };
    const board = data.size + ' × ' + data.size;
    const played = data.moves + (data.moves === 1 ? ' move' : ' moves');
    if (data.win) {
      return 'I reached 2048 on Merge — ' + board + ' in ' + played + ' with ' + data.score + ' points. Can you?';
    }
    return 'I scored ' + data.score + ' on Merge — ' + board + ' in ' + played + '. Can you beat it?';
  }

  // The address only belongs in a link when the game really lives on one.
  function shareUrl() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return '';
    return location.origin + location.pathname;
  }

  function flashShare(label) {
    overlayShare.textContent = label;
    overlayShare.disabled = true;
    window.clearTimeout(shareFlashTimer);
    shareFlashTimer = window.setTimeout(function () {
      overlayShare.textContent = 'Share';
      overlayShare.disabled = false;
    }, 1600);
  }

  // Somewhere without a share sheet (most desktops) copies the same line instead.
  function copyResult(message) {
    const url = shareUrl();
    const text = url ? message + ' ' + url : message;
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      flashShare('Couldn’t copy');
      return;
    }
    navigator.clipboard.writeText(text).then(function () {
      flashShare('Copied');
    }).catch(function () {
      flashShare('Couldn’t copy');
    });
  }

  function canShareFile(file) {
    if (!file || !navigator.share || !navigator.canShare) return false;
    try {
      return navigator.canShare({ files: [file] });
    } catch (err) {
      return false;
    }
  }

  function shareText(message, url) {
    if (navigator.share) {
      navigator.share({ title: 'Merge — 2048', text: message, url: url || undefined }).catch(function (err) {
        // Closing the share sheet is a choice, not a failure.
        if (err && err.name === 'AbortError') return;
        copyResult(message);
      });
      return;
    }
    copyResult(message);
  }

  function shareFile(file, message, url) {
    navigator.share({
      files: [file],
      title: 'Merge — 2048',
      text: url ? message + ' ' + url : message
    }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      shareText(message, url);
    });
  }

  function shareResult() {
    const message = shareMessage();
    const url = shareUrl();

    // Most taps happen after the picture is ready, so keep the share call in
    // the tap itself: some phones insist on it.
    if (resultFile && canShareFile(resultFile)) {
      shareFile(resultFile, message, url);
      return;
    }
    if (resultFilePromise && !resultFile) {
      resultFilePromise.then(function (file) {
        if (file && canShareFile(file)) shareFile(file, message, url);
        else shareText(message, url);
      });
      return;
    }
    shareText(message, url);
  }

  function flashSave(label) {
    overlaySave.textContent = label;
    overlaySave.disabled = true;
    window.clearTimeout(saveFlashTimer);
    saveFlashTimer = window.setTimeout(function () {
      overlaySave.textContent = 'Save image';
      overlaySave.disabled = false;
    }, 1600);
  }

  async function saveResultImage() {
    const file = resultFile || (resultFilePromise ? await resultFilePromise : null);
    if (!file) {
      flashSave('Couldn’t save');
      return;
    }
    const href = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'merge-2048-result.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(href); }, 1000);
    flashSave('Saved');
  }

  overlayShare.addEventListener('click', shareResult);
  overlaySave.addEventListener('click', saveResultImage);

  // The picture belongs to the card, so redraw it with the new page colours
  // while the result is on screen; Share and Save then match the preview.
  window.addEventListener('merge:appearance', function () {
    if (overlayEl.hidden || !resultSnapshot) return;
    prepareResultImage(resultSnapshot);
  });

  if (viewResultBtn) {
      viewResultBtn.addEventListener('click', function () {
        if (!resultSnapshot || busy) return;
        showResultCard(resultSnapshot, true);
      });
    }

  /* ---------- reset ---------- */

  function resetBoard() {
    generation += 1;
    hideOverlay();
    tilesEl.textContent = '';
    tiles = [];
    grid = emptyGrid();
    score = 0;
    moves = 0;
    setStat(movesEl, 0);
    won = false;
    busy = false;
    beatBest = false;
    bestAtStart = best;
    setStat(scoreEl, 0);
    measure();
    addRandomTile();
    addRandomTile();
    saveGame();
    syncResultButton();
    // A brand-new visitor still gets the classic first tip; every board after
    // that moves the line on.
    if (booted) {
      showTip(true);
    } else {
      booted = true;
      showTip(false);
    }
    syncBoardAccessibility('New ' + size + ' by ' + size + ' board.');
  }

  function newGame() {
    resetBoard();
  }

  /* ---------- board size switch ---------- */

  function syncSizeButtons() {
    document.querySelectorAll('[data-size-opt]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', Number(btn.dataset.sizeOpt) === size ? 'true' : 'false');
    });
  }

  function setSize(next) {
    if (next !== 3 && next !== 4 && next !== 5) return;
    if (next === size) {
      syncSizeButtons();
      return;
    }
    size = next;
    try {
      localStorage.setItem(SIZE_KEY, String(size));
    } catch (err) {
      /* storage blocked — the choice just won't stick */
    }
    buildCells();
    loadBest();
    newGame();
    syncSizeButtons();
  }

  /* ---------- input ---------- */

  let startX = 0;
  let startY = 0;
  let tracking = false;

  boardEl.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) {
      tracking = false;
      return;
    }
    tracking = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  boardEl.addEventListener('touchmove', function (e) {
    if (tracking && e.cancelable) e.preventDefault();
  }, { passive: false });

  boardEl.addEventListener('touchend', function (e) {
    if (!tracking) return;
    tracking = false;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? 'right' : 'left');
    } else {
      move(dy > 0 ? 'down' : 'up');
    }
  }, { passive: true });

  boardEl.addEventListener('touchcancel', function () {
    tracking = false;
  }, { passive: true });

  // Desktop and pen users get the same four-way drag as touch. Filtering by
  // pointer type keeps this path from firing twice alongside the touch handlers
  // above on phones.
  let pointerStart = null;

  boardEl.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' || e.button !== 0 || !overlayEl.hidden) return;
    pointerStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
    boardEl.classList.add('is-dragging');
    try {
      boardEl.setPointerCapture(e.pointerId);
    } catch (err) {
      /* pointer capture is a nicety; dragging still works without it */
    }
  });

  window.addEventListener('pointerup', function (e) {
    if (!pointerStart || e.pointerId !== pointerStart.id) return;
    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    pointerStart = null;
    boardEl.classList.remove('is-dragging');
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? 'right' : 'left');
    } else {
      move(dy > 0 ? 'down' : 'up');
    }
  });

  window.addEventListener('pointercancel', function (e) {
    if (!pointerStart || e.pointerId !== pointerStart.id) return;
    pointerStart = null;
    boardEl.classList.remove('is-dragging');
  });

  const KEYS = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down'
  };

  window.addEventListener('keydown', function (e) {
    // A sheet sits on top of the board; the game must not move underneath it.
    if (sheetEl && !sheetEl.hidden) return;
    if (helpEl && !helpEl.hidden) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const dir = KEYS[key];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  });

  /* ---------- distraction-free desktop mode ---------- */

  if (focusBtn) {
    const root = document.documentElement;
    const FOCUS_HANDOFF_MS = 170;
    let focusPending = false;
    let focusHandoffStarted = 0;
    let focusSettleTimer = 0;
    let launchFocusRequest = false;

    function fullscreenElement() {
      return document.fullscreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || null;
    }

    function syncFocusButton() {
      const active = root.classList.contains('is-focus');
      focusBtn.setAttribute('aria-pressed', String(active));
      focusBtn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
      focusBtn.title = active ? 'Exit fullscreen (Esc)' : 'Fullscreen (F)';
    }

    function prefersReducedMotion() {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function transitionFocusLayout(active) {
      root.classList.toggle('is-focus', active);
      syncFocusButton();
      measure();
    }

    function beginFocusHandoff() {
      focusHandoffStarted = Date.now();
      root.classList.add('is-focusing');
    }

    // The native resize happens between two different viewport sizes. Let the
    // page fade back for it, remeasure at the settled size, then fade in. This
    // turns the hard snap into one quiet handoff.
    function completeFocusHandoff(active) {
      if (focusSettleTimer) return;
      const wait = prefersReducedMotion()
        ? 0
        : Math.max(0, FOCUS_HANDOFF_MS - (Date.now() - focusHandoffStarted));
      focusSettleTimer = window.setTimeout(function () {
        focusSettleTimer = 0;
        transitionFocusLayout(active);
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            root.classList.remove('is-focusing');
            focusPending = false;
          });
        });
      }, wait);
    }

    function enterFocus() {
      if (root.classList.contains('is-focus') || focusPending) return;

      // requestFullscreen is optional. The in-window focus layout is a complete
      // fallback for browsers (or embedded previews) that refuse the request.
      const request = root.requestFullscreen || root.webkitRequestFullscreen || root.webkitRequestFullScreen;
      if (!request) {
        transitionFocusLayout(true);
        return;
      }

      focusPending = true;
      beginFocusHandoff();
      let pending;
      try {
        pending = request.call(root);
      } catch (err) {
        completeFocusHandoff(false);
        return;
      }

      // Older Safari returns nothing even when it starts fullscreen.
      if (!pending || typeof pending.then !== 'function') {
        completeFocusHandoff(true);
        return;
      }

      pending.then(function () {
        completeFocusHandoff(true);
      }, function () {
        completeFocusHandoff(false);
      });
    }

    function exitFocus() {
      const native = !!fullscreenElement();
      if (!native) {
        if (root.classList.contains('is-focus')) transitionFocusLayout(false);
        else syncFocusButton();
        focusPending = false;
        return;
      }
      if (focusPending) return;

      focusPending = true;
      beginFocusHandoff();
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
      if (!exit) {
        completeFocusHandoff(false);
        return;
      }

      const settle = function () { completeFocusHandoff(false); };
      try {
        const pending = exit.call(document);
        if (pending && typeof pending.then === 'function') pending.then(settle, settle);
        else settle();
      } catch (err) {
        settle();
      }
    }

    function toggleFocus() {
      if (focusPending) return;
      if (root.classList.contains('is-focus')) exitFocus();
      else enterFocus();
    }

    function syncFromFullscreen() {
      // The browser's Esc key or its own fullscreen control can end native
      // fullscreen without going through exitFocus.
      if (launchFocusRequest) return;
      const active = !!fullscreenElement();
      if (active) {
        if (!root.classList.contains('is-focus') && !focusSettleTimer) {
          if (!root.classList.contains('is-focusing')) beginFocusHandoff();
          completeFocusHandoff(true);
        }
        return;
      }
      if (root.classList.contains('is-focus') || root.classList.contains('is-focusing')) {
        if (!root.classList.contains('is-focusing')) beginFocusHandoff();
        completeFocusHandoff(false);
      } else {
        focusPending = false;
      }
    }

    focusBtn.addEventListener('click', toggleFocus);
    document.addEventListener('fullscreenchange', syncFromFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFromFullscreen);

    window.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        // Native fullscreen handles Esc itself; this is for the windowed
        // fallback and for browsers without the Fullscreen API.
        if (root.classList.contains('is-focus') && !fullscreenElement()) {
          e.preventDefault();
          exitFocus();
        }
        return;
      }
      if (e.key !== 'f' && e.key !== 'F') return;
      if (sheetEl && !sheetEl.hidden) return;
      if (helpEl && !helpEl.hidden) return;
      e.preventDefault();
      toggleFocus();
    });

    syncFocusButton();

    /* ---------- fullscreen on open (installed app only) ---------- */

    function installedApp() {
      return !!(
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) ||
        navigator.standalone === true
      );
    }

    function launchFocusEnabled() {
      try {
        return localStorage.getItem(LAUNCH_FOCUS_KEY) === '1';
      } catch (err) {
        return false;
      }
    }

    function armLaunchFocus() {
      if (!installedApp() || !launchFocusEnabled()) return;

      let listening = true;

      function stopListening() {
        if (!listening) return;
        listening = false;
        window.removeEventListener('pointerup', onFirstGesture, true);
        window.removeEventListener('keyup', onFirstGesture, true);
      }

      function onFirstGesture(e) {
        if (!listening) return;
        if (e.type === 'keyup' && ['Meta', 'Control', 'Alt', 'Shift', 'Tab', 'Escape'].indexOf(e.key) !== -1) return;
        if (e.target && e.target.closest && e.target.closest('#focus-toggle')) return;
        if (sheetEl && !sheetEl.hidden) return;
        if (helpEl && !helpEl.hidden) return;
        if (overlayEl && !overlayEl.hidden) return;
        stopListening();
        if (!fullscreenElement()) enterFocus();
      }

      // Browsers normally block fullscreen without a gesture. If the launch
      // request is refused, the same promise falls back to the first real
      // gesture instead of interrupting the opening animation.
      window.addEventListener('pointerup', onFirstGesture, true);
      window.addEventListener('keyup', onFirstGesture, true);

      const request = root.requestFullscreen || root.webkitRequestFullscreen || root.webkitRequestFullScreen;
      if (!request) {
        stopListening();
        return;
      }

      launchFocusRequest = true;
      let pending;
      try {
        pending = request.call(root);
      } catch (err) {
        launchFocusRequest = false;
        return;
      }

      const entered = function () {
        launchFocusRequest = false;
        if (!fullscreenElement()) return;
        stopListening();
        transitionFocusLayout(true);
      };

      if (pending && typeof pending.then === 'function') {
        pending.then(entered, function () {
          launchFocusRequest = false;
        });
      } else {
        entered();
      }
    }

    if (launchFocusEnabled() && installedApp()) armLaunchFocus();
  }

  newBtn.addEventListener('click', newGame);

  // Keep the board if the app is closed between moves; never mid-animation, when
  // the grid is still catching up with the tiles on screen.
  function saveIfIdle() {
    if (saveSuspended) return;
    if (!busy) saveGame();
  }
  window.addEventListener('pagehide', saveIfIdle);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveIfIdle();
  });

  if (haptics.supported()) {
    const syncHapticBtn = function () {
      const on = haptics.isEnabled();
      hapticBtn.classList.toggle('is-off', !on);
      hapticBtn.setAttribute('aria-pressed', String(on));
      hapticBtn.setAttribute('aria-label', on ? 'Vibration on' : 'Vibration off');
    };
    syncHapticBtn();
    hapticBtn.addEventListener('click', function () {
      haptics.toggle();
      syncHapticBtn();
    });
  } else {
    hapticBtn.hidden = true;
  }

  document.querySelectorAll('[data-size-opt]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setSize(Number(btn.dataset.sizeOpt));
    });
  });

  // Coalesce resize notifications into one frame. Native fullscreen and
  // orientation changes can otherwise trigger several full tile remeasures.
  // A resize also ends with a couple of trailing passes: the browser can
  // finish a fullscreen handoff a few frames after its last resize event, and
  // measuring only on the event would leave tiles a fraction behind the grid.
  let measureQueued = false;
  let settleTimer = 0;
  let settleTimerLate = 0;

  function afterResize() {
    window.clearTimeout(settleTimer);
    window.clearTimeout(settleTimerLate);
    settleTimer = window.setTimeout(measure, 180);
    settleTimerLate = window.setTimeout(measure, 450);
  }

  function queueMeasure() {
    afterResize();
    if (measureQueued) return;
    measureQueued = true;
    window.requestAnimationFrame(function () {
      measureQueued = false;
      measure();
    });
  }

  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(queueMeasure);
    resizeObserver.observe(boardEl);
    // Watching the grid as well catches a gap or padding shift that leaves
    // the board's outer box untouched.
    resizeObserver.observe(gridEl);
  }
  window.addEventListener('resize', queueMeasure);
  window.addEventListener('orientationchange', queueMeasure);
  window.addEventListener('pageshow', queueMeasure);
  document.addEventListener('fullscreenchange', queueMeasure);
  document.addEventListener('webkitfullscreenchange', queueMeasure);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) queueMeasure();
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', queueMeasure);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      queueMeasure();
      const family = 'Google Sans Flex';
      if (!window.FontFace || !document.fonts.check || document.fonts.check('500 16px "' + family + '"')) return;
      try {
        // Rarely, a browser leaves the CSS face in an error state even though
        // the file is fine. That stale face can also make later font loads
        // fail, so drop its rule and attach a recovered face instead.
        for (const sheet of Array.from(document.styleSheets)) {
          let rules;
          try { rules = Array.from(sheet.cssRules); } catch (err) { continue; }
          for (let i = rules.length - 1; i >= 0; i--) {
            const rule = rules[i];
            if (window.CSSRule && rule.type === CSSRule.FONT_FACE_RULE && String(rule.style.fontFamily).indexOf(family) !== -1) {
              try { sheet.deleteRule(i); } catch (err) { /* cross-origin or locked */ }
            }
          }
        }
        const face = new FontFace(family, 'url("fonts/google-sans-flex.woff2?v=1.0.4")', {
          weight: '100 1000',
          display: 'swap'
        });
        face.load().then(function (loaded) {
          document.fonts.add(loaded);
          queueMeasure();
        }).catch(function () {});
      } catch (err) {
        /* The CSS face may still recover on its own. */
      }
    }).catch(function () {});
  }

  /* ---------- start ---------- */

  // Leftovers from retired features; harmless, so just clear them once.
  try {
    localStorage.removeItem('merge2048.daily');
    localStorage.removeItem('merge2048.resume');
  } catch (err) {
    /* ignore */
  }

  // Used by the reset buttons in the appearance sheet.
  window.MergeGame = {
    refreshBest: function () {
      loadBest();
      bestAtStart = best;
    },
    suspendSaving: function () {
      saveSuspended = true;
    },
    newGame: newGame
  };

  const saved = readSaved();
  if (saved) size = saved.size;

  buildCells();
  syncSizeButtons();
  loadBest();
  measure();

  if (saved) {
    applyState(saved);
    try {
      localStorage.setItem(SIZE_KEY, String(size));
    } catch (err) {
      /* ignore */
    }
    if (isGameOver()) {
      showResultCard(captureResult(false), false);
    } else if (won) {
      // A resumed 2048 game keeps its card within reach rather than opening it.
      captureResult(true);
      syncResultButton();
    }
  } else {
    newGame();
  }

  // The launch screen and the board's entrance both finish after the first
  // measurement. One quiet pass at the end pins the tiles to the settled grid.
  window.setTimeout(measure, 700);
})();
