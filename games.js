/* The game collection shell. Merge keeps its own screen; the other four games
   are self-contained, offline-first modules on the same page. */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const $$ = function (selector) { return Array.from(document.querySelectorAll(selector)); };
  const body = document.body;
  const app = document.querySelector('.app');
  const hub = $('hub');
  const screens = {
    water: $('water'),
    oneline: $('oneline'),
    fruit: $('fruit'),
    ttt: $('ttt'),
    mines: $('mines'),
    wordle: $('wordle')
  };
  const cards = $$('[data-game]');
  const backButtons = $$('[data-back]');
  if (!app || !hub || !screens.water || !screens.oneline || !screens.fruit || !screens.ttt || !screens.mines || !screens.wordle) return;

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* storage blocked — the current session still works */
    }
  }

  function shuffle(values) {
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = values[i];
      values[i] = values[j];
      values[j] = temp;
    }
    return values;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /* ---------- sharing ---------- */

  const SHARE_TITLE = 'Sixfold — Six games. No filler.';
  const SHARE_TEXT = 'Sixfold: six games, no filler — an offline pocket arcade of Merge, Water Sort, One Line, Fruit Merge, Tic Tac Toe and Minesweeper. No accounts, no ads.';
  let toastTimer = 0;

  function shareUrl() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return '';
    return location.origin + location.pathname;
  }

  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.classList.remove('is-on');
      window.setTimeout(function () {
        if (!el.classList.contains('is-on')) el.hidden = true;
      }, 220);
    }, 2300);
  }

  function copyShare(text) {
    const url = shareUrl();
    const full = url ? text + ' ' + url : text;
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      toast('Copy is not available in this browser.');
      return;
    }
    navigator.clipboard.writeText(full).then(function () {
      toast('Copied — paste it anywhere.');
    }).catch(function () {
      toast('Could not copy the text.');
    });
  }

  function share(title, text) {
    const url = shareUrl();
    if (navigator.share) {
      navigator.share({ title: title || SHARE_TITLE, text: text, url: url || undefined }).catch(function (err) {
        // Closing the share sheet is a choice, not a failure.
        if (err && err.name === 'AbortError') return;
        copyShare(text);
      });
      return;
    }
    copyShare(text);
  }

  /* Share the generated Sixfold card when the browser can share files, and
     fall back to the plain text/link share everywhere else. Keeping this in
     one helper means all six games use the same card and the same fallback. */
  function shareResult(title, text, data) {
    if (!window.MergeShareCard || typeof File !== 'function' || !navigator.share || !navigator.canShare) {
      share(title, text);
      return;
    }
    window.MergeShareCard.share(data, title, text).then(function (shared) {
      if (!shared) share(title, text);
    }).catch(function () {
      share(title, text);
    });
  }

  window.MergeShare = {
    share: share,
    url: shareUrl,
    toast: toast
  };

  /* ---------- first-play coach ---------- */
  // Each coach card advances only when the player takes the action it asks
  // for. It is deliberately small so it can live in the existing status slot.
  const COACH_KEY = 'sixfold.coach.';
  const TUTORIALS = {
    merge: [
      { event: 'move', text: 'Swipe or drag the board to move every tile.' },
      { event: 'move', text: 'Push two matching numbers together to merge them.', test: function (d) { return d.merges > 0; } },
      { event: 'move', text: 'Keep going. A fresh tile appears after every move.', test: function (d) { return d.moves >= 3; } }
    ],
    water: [
      { event: 'select', text: 'Tap a tube to pick up its top colour.' },
      { event: 'pour', text: 'Now tap a second tube to pour it.' },
      { event: 'pour', text: 'Nice. Keep pouring until each tube holds one colour.', test: function (d) { return d.moves >= 2; } }
    ],
    oneline: [
      { event: 'start', text: 'Tap any dot to begin the line.' },
      { event: 'link', text: 'Drag or tap a connected dot.' },
      { event: 'link', text: 'Keep tracing. Each link can only be used once.', test: function (d) { return d.links >= 3; } }
    ],
    fruit: [
      { event: 'aim', text: 'Drag across the board to aim the fruit.' },
      { event: 'drop', text: 'Lift your finger to drop it.' },
      { event: 'merge', text: 'Drop a matching fruit on top to make a bigger one.' }
    ],
    ttt: [
      { event: 'xmove', text: 'Tap any square to place your X.' },
      { event: 'reply', text: 'O answers. Look for a line of three.' },
      { event: 'xmove', text: 'Now place your second X. Three in a row wins.', test: function (d) { return d.moves >= 3; } }
    ],
    mines: [
      { event: 'open', text: 'Tap a square to open it. The first tap is always safe.' },
      { event: 'flag', text: 'Switch on Flag and tap a square to mark a mine.' }
    ]
  };
  const coach = { game: null, step: 0, events: [], host: null, el: null };
  let coachEl = null;

  function coachSeen(game) {
    try { return localStorage.getItem(COACH_KEY + game) === '1'; } catch (err) { return false; }
  }

  function markCoachSeen(game) {
    if (!game) return;
    try { localStorage.setItem(COACH_KEY + game, '1'); } catch (err) {}
  }

  function coachHost(game) {
    if (game === 'merge') return document.querySelector('.app .status');
    const root = screens[game];
    return root ? root.querySelector('.play-feedback') : null;
  }

  function hideCoach() {
    if (coach.el && coach.el.parentNode) coach.el.parentNode.removeChild(coach.el);
    if (coach.host) coach.host.classList.remove('has-coach');
    coach.game = null;
    coach.host = null;
    coach.step = 0;
    coach.events = [];
  }

  function buildCoach() {
    const el = document.createElement('div');
    el.className = 'coach';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Quick tutorial');
    el.innerHTML = '<span class="coach-step" aria-hidden="true"></span>' +
      '<p class="coach-text" aria-live="polite"></p>' +
      '<button class="coach-skip" type="button" aria-label="Skip tutorial" title="Skip tutorial">Skip</button>';
    el.querySelector('.coach-skip').addEventListener('click', function () {
      markCoachSeen(coach.game);
      hideCoach();
    });
    return el;
  }

  function showCoachStep() {
    if (!coach.el || !coach.game) return;
    const steps = TUTORIALS[coach.game];
    const step = steps && steps[coach.step];
    if (!step) return;
    coach.el.querySelector('.coach-step').textContent = (coach.step + 1) + '/' + steps.length;
    coach.el.querySelector('.coach-text').textContent = step.text;
    coach.el.classList.remove('coach-in');
    void coach.el.offsetWidth;
    coach.el.classList.add('coach-in');
  }

  function enterCoach(game) {
    if (coach.game === game) return;
    hideCoach();
    if (!TUTORIALS[game] || coachSeen(game)) return;
    const host = coachHost(game);
    if (!host) return;
    if (game === 'merge') {
      const overlay = $('overlay');
      if (overlay && !overlay.hidden) return;
    } else if (host.querySelector('.play-win:not([hidden])')) {
      return;
    }
    if (!coachEl) coachEl = buildCoach();
    coach.game = game;
    coach.host = host;
    coach.step = 0;
    coach.events = [];
    coach.el = coachEl;
    host.insertBefore(coachEl, host.firstChild);
    host.classList.add('has-coach');
    showCoachStep();
  }

  function coachEvent(game, type, detail) {
    if (coach.game !== game) return;
    coach.events.push({ type: type, detail: detail || {} });
    if (coach.events.length > 24) coach.events.shift();
    while (coach.game === game && coach.events.length) {
      const steps = TUTORIALS[game];
      const step = steps[coach.step];
      if (!step) {
        markCoachSeen(game);
        hideCoach();
        return;
      }
      const next = coach.events.shift();
      // Ignore actions that are not part of this step. Keeping an unrelated tap
      // at the front of the queue would block the real action behind it and the
      // card would never finish.
      if (next.type !== step.event) continue;
      if (step.test && !step.test(next.detail)) continue;
      coach.step += 1;
      if (coach.step >= steps.length) {
        markCoachSeen(game);
        hideCoach();
        return;
      }
      showCoachStep();
    }
  }

  function completeCoach(game) {
    if (coach.game !== game) return;
    markCoachSeen(game);
    hideCoach();
  }

  window.MergeCoach = {
    enter: enterCoach,
    event: coachEvent,
    complete: completeCoach
  };

  window.addEventListener('sixfold:merge-move', function (event) {
    coachEvent('merge', 'move', event.detail || {});
  });

  window.addEventListener('sixfold:merge-end', function () {
    completeCoach('merge');
  });

  let current = 'hub';
  let lastGame = 'merge';
  const games = {};

  /* Every finished round offers a short pause before the next one starts.
     Five seconds is enough to read the result and still keeps the games moving. */
  const AUTO_NEXT_DELAY = 5000;
  let autoNextTimer = 0;
  let autoNextButton = null;

  function cancelAutoNext() {
    if (autoNextTimer) {
      window.clearTimeout(autoNextTimer);
      autoNextTimer = 0;
    }
    if (autoNextButton) {
      if (autoNextButton.dataset.autoNextBase) {
        autoNextButton.textContent = autoNextButton.dataset.autoNextBase;
      }
      autoNextButton = null;
    }
  }

  function scheduleAutoNext(button, action) {
    cancelAutoNext();
    if (!button) return;
    autoNextButton = button;
    if (!button.dataset.autoNextBase) {
      button.dataset.autoNextBase = button.textContent.trim();
    }
    const screen = document.body.dataset.screen;
    let remaining = Math.ceil(AUTO_NEXT_DELAY / 1000);

    function paint() {
      button.textContent = 'Next ' + remaining + 's';
    }

    paint();
    // A manual tap should take over immediately and stop the countdown.
    button.addEventListener('click', cancelAutoNext, { once: true });

    function tick() {
      if (!button.isConnected || button.closest('[hidden]') ||
          document.body.dataset.screen !== screen ||
          document.documentElement.classList.contains('sheet-open')) {
        cancelAutoNext();
        return;
      }
      remaining -= 1;
      if (remaining <= 0) {
        const nextAction = action;
        cancelAutoNext();
        nextAction();
        return;
      }
      paint();
      autoNextTimer = window.setTimeout(tick, 1000);
    }

    autoNextTimer = window.setTimeout(tick, 1000);
  }

  window.MergeAutoNext = {
    schedule: scheduleAutoNext,
    cancel: cancelAutoNext
  };

  function setScreen(screen) {
    if (current !== screen) cancelAutoNext();
    if (current !== screen && games[current] && games[current].deactivate) {
      games[current].deactivate();
    }
    current = screen;

    hub.hidden = screen !== 'hub';
    Object.keys(screens).forEach(function (key) {
      screens[key].hidden = key !== screen;
    });

    const isMerge = screen === 'merge';
    app.toggleAttribute('inert', !isMerge);
    if (isMerge) app.removeAttribute('aria-hidden');
    else app.setAttribute('aria-hidden', 'true');
    body.dataset.screen = screen;

    if (isMerge) {
      window.dispatchEvent(new Event('resize'));
      const back = $('back-to-games');
      if (back) back.focus({ preventScroll: true });
    } else if (screen !== 'hub' && games[screen]) {
      games[screen].activate();
      const title = games[screen].title;
      if (title) title.focus({ preventScroll: true });
    }
    enterCoach(screen);
  }

  const GAME_NAMES = {
    merge: 'Merge',
    water: 'Water Sort',
    oneline: 'One Line',
    fruit: 'Fruit Merge',
    ttt: 'Tic Tac Toe',
    mines: 'Minesweeper',
    wordle: 'Wordle'
  };
  const VALID_GAMES = Object.keys(GAME_NAMES);
  const PUBLIC_GAMES = VALID_GAMES.filter(function (name) { return name !== 'wordle'; });

  function focusLastCard() {
    const card = document.querySelector('[data-game="' + lastGame + '"]') || document.querySelector('[data-game]');
    if (card) card.focus({ preventScroll: true });
  }

  function updateDocumentTitle() {
    document.title = current === 'hub' ? 'Sixfold — Six games. No filler.' : (GAME_NAMES[current] || 'Sixfold') + ' — Sixfold';
  }

  function openGame(game) {
    if (VALID_GAMES.indexOf(game) === -1 || game === 'wordle') return;
    lastGame = game;
    setScreen(game);
    updateDocumentTitle();
    try {
      if (!history.state || history.state.game !== game) {
        history.pushState({ game: game }, '', '#' + game);
      }
    } catch (err) {
      /* file:// or a browser with history restricted */
    }
  }

  // The word game is absent from the collection cards and the initial hash
  // route. The six-piece cover opens it, after which it behaves like the rest.
  function openWordle() {
    lastGame = 'wordle';
    setScreen('wordle');
    updateDocumentTitle();
    try {
      if (!history.state || history.state.game !== 'wordle') {
        history.pushState({ game: 'wordle' }, '', '#wordle');
      }
    } catch (err) {
      /* file:// or a browser with history restricted */
    }
  }

  function backToHub() {
    try {
      if (history.state && history.state.game && history.state.game !== 'hub') {
        history.back();
        return;
      }
      history.replaceState({ game: 'hub' }, '', location.pathname + location.search);
    } catch (err) {
      /* fall through to the local transition */
    }
    setScreen('hub');
    updateDocumentTitle();
    focusLastCard();
  }

  window.addEventListener('popstate', function (event) {
    const screen = event.state && event.state.game ? event.state.game : 'hub';
    if (screen !== 'hub' && VALID_GAMES.indexOf(screen) !== -1) {
      lastGame = screen;
      setScreen(screen);
    } else {
      setScreen('hub');
      focusLastCard();
    }
    updateDocumentTitle();
  });

  function initRoute() {
    const initial = (location.hash || '').replace(/^#/, '');
    try {
      history.replaceState({ game: 'hub' }, '', location.pathname + location.search);
    } catch (err) {
      /* file:// or a browser with history restricted */
    }
    setScreen('hub');
    updateDocumentTitle();
    if (PUBLIC_GAMES.indexOf(initial) !== -1) openGame(initial);
  }

  cards.forEach(function (card) {
    card.addEventListener('click', function () { openGame(card.dataset.game); });
  });

  const hubShare = $('hub-share');
  if (hubShare) {
    hubShare.addEventListener('click', function () {
      share(SHARE_TITLE, SHARE_TEXT);
    });
  }

  const surpriseBtn = $('home-surprise');
  if (surpriseBtn) {
    surpriseBtn.addEventListener('click', function () {
      if (!cards.length) return;
      const pick = cards[Math.floor(Math.random() * cards.length)];
      if (pick && pick.dataset.game) openGame(pick.dataset.game);
    });
  }

  /* The cover is the six-piece Sixfold mark, so its six numbered tiles are the
     secret key. Tap 01 through 06 in order; any wrong tap starts the sequence
     again. The only feedback is a tiny physical press, which keeps the game
     hidden until it is actually found. */
  const sixPieces = $$('.home-six-piece');
  let sixStep = 0;
  function clearSixPress() {
    sixPieces.forEach(function (piece) { piece.classList.remove('is-six-hit'); });
  }
  sixPieces.forEach(function (piece, index) {
    piece.addEventListener('click', function () {
      if (index !== sixStep) {
        sixStep = index === 0 ? 1 : 0;
        clearSixPress();
        if (index === 0) {
          piece.classList.remove('is-six-hit');
          void piece.offsetWidth;
          piece.classList.add('is-six-hit');
        }
        return;
      }
      sixStep += 1;
      piece.classList.remove('is-six-hit');
      void piece.offsetWidth;
      piece.classList.add('is-six-hit');
      if (sixStep === sixPieces.length) {
        sixStep = 0;
        window.setTimeout(openWordle, 120);
      }
    });
  });

  /* A small pointer tilt on the cover gives desktop mice the same sense of
     physicality that touch scrolling already gives the phone layout. */
  const sixArt = document.querySelector('.home-hero-art');
  const sixGrid = document.querySelector('.home-six');
  if (sixArt && sixGrid && window.matchMedia &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    sixArt.addEventListener('pointermove', function (event) {
      const rect = sixArt.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      sixGrid.style.setProperty('--six-tilt-x', (y * -4.5).toFixed(2) + 'deg');
      sixGrid.style.setProperty('--six-tilt-y', (x * 6.5).toFixed(2) + 'deg');
    });
    sixArt.addEventListener('pointerleave', function () {
      sixGrid.style.removeProperty('--six-tilt-x');
      sixGrid.style.removeProperty('--six-tilt-y');
    });
  }

  backButtons.forEach(function (button) {
    button.addEventListener('click', backToHub);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && current !== 'hub' && current !== 'merge' && !event.defaultPrevented) {
      event.preventDefault();
      backToHub();
    }
  });

  games.merge = {
    title: null,
    activate: function () {},
    deactivate: function () {}
  };

  const PLAY_HELP = {
    water: {
      title: 'How to play Water Sort',
      steps: [
        'Tap a tube to pick up its top colour, then tap another tube to pour.',
        'You can pour onto the same colour or into an empty tube.',
        'A tube is finished when it holds four of one colour.',
        'Sort every colour, one tube each. If no move remains, undo or start a fresh board.'
      ]
    },
    oneline: {
      title: 'How to play One Line',
      steps: [
        'Start on any dot. Every link can be used exactly once.',
        'Revisit dots, never links. Lift and continue from the glowing end.',
        'Later shapes have two ringed open ends — start on one of them.',
        'Finish without undo, restart or a hint to earn three stars. Shapes opens the full map.',
        'Stuck? Hint (or H) pulses the next dot. A hint caps that shape at two stars.'
      ]
    },
    fruit: {
      title: 'How to play Fruit Merge',
      steps: [
        'Drag left or right to aim, then release to drop the fruit.',
        'Two matching fruit join into the next, larger fruit.',
        'Each merge scores the value of the pair you combine.',
        'Two watermelons clear both and keep the run going.',
        'Keep the pile below the top line.',
        'Bigger merges score more. The best score saves on this device.'
      ]
    },
    ttt: {
      title: 'How to play Tic Tac Toe',
      steps: [
        'Tap any square to place your mark.',
        'On the computer levels, O answers after every X move.',
        'Easy plays loosely, Sharp takes wins and blocks, Perfect never misses.',
        'Choose 2 players to turn off the computer and pass the phone.',
        'Line up three marks across, down or diagonally to win.'
      ]
    },
    mines: {
      title: 'How to play Minesweeper',
      steps: [
        'Beginner is 9 × 9, Intermediate is 16 × 16, and Expert is 30 × 16 with 99 mines.',
        'Tap a square to open it. Your first tap opens a safe pocket.',
        'A number counts the mines in the eight surrounding squares.',
        'Long-press a square, or turn on Flag mode, to mark a mine.',
        'Tap an open number to clear around it when its flags match.',
        'Open every safe square to clear the field. Flags are optional.'
      ]
    },
    wordle: {
      title: 'How to play Wordle',
      steps: [
        'Guess the five-letter word in six tries.',
        'Green means the letter is in the right spot. Yellow means it is in the word but in another spot. Gray means it is not in the word.',
        'Duplicate letters score only as many times as they appear in the answer.',
        'Type on a keyboard or tap the keys, then press Enter to submit.',
        'After a win or a loss, New word starts a fresh round.'
      ]
    }
  };

  const RESET_COPY = {
    merge: 'This clears the current Merge board, all best scores and the tip history. Your look and board size stay as they are.',
    water: 'This clears Water Sort progress and starts again at level 1. Your other games are untouched.',
    oneline: 'This clears One Line progress, every star and all unlocked shapes, and starts again at shape 1. Your other games are untouched.',
    fruit: 'This clears your Fruit Merge best score and starts a fresh run. Your other games are untouched.',
    ttt: 'This clears your Tic Tac Toe records for both computer and two-player games and starts a new round. Your other games are untouched.',
    mines: 'This clears your Minesweeper field choice and starts a new Beginner field. Your other games are untouched.',
    wordle: 'This clears your Wordle stats and starts a fresh word. Your other games are untouched.'
  };

  function requestGameReset(game, opener) {
    const name = GAME_NAMES[game];
    const copy = RESET_COPY[game];
    const reset = function () {
      if (game === 'merge') {
        if (window.MergeGame && window.MergeGame.resetData) window.MergeGame.resetData();
      } else if (games[game] && games[game].reset) {
        games[game].reset();
      }
    };
    if (window.MergeTheme && window.MergeTheme.confirmReset) {
      window.MergeTheme.confirmReset({ name: name, copy: copy, onConfirm: reset, opener: opener });
    } else {
      reset();
    }
  }

  /* Every game gets the same chrome as Merge: a back arrow at the top, then
     title and stat cards, then the bottom tool row and its primary action.
     The tools are generated once so the five screens cannot drift apart. */
  function installPlayTools() {
    const hapticButtons = [];

    $$('.play-screen').forEach(function (screen) {
      const foot = screen.querySelector('.play-foot');
      if (!foot || foot.querySelector('.play-tools')) return;
      const guide = PLAY_HELP[screen.id];
      const name = guide ? guide.title.replace('How to play ', '') : 'this game';

      const tools = document.createElement('div');
      tools.className = 'play-tools';
      tools.setAttribute('role', 'group');
      tools.setAttribute('aria-label', 'Game controls');

      const hapticBtn = document.createElement('button');
      hapticBtn.type = 'button';
      hapticBtn.className = 'play-tool';
      hapticBtn.dataset.playTool = 'haptics';
      hapticBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8.5" y="3" width="7" height="18" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.8" /><g class="waves" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 9.4a4.6 4.6 0 0 0 0 5.2" /><path d="M19 9.4a4.6 4.6 0 0 1 0 5.2" /></g><path class="slash" d="M4.5 19.5l15-15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>';
      hapticBtn.addEventListener('click', function () {
        if (!window.MergeHaptics) return;
        window.MergeHaptics.toggle();
        syncHaptics();
      });
      tools.appendChild(hapticBtn);
      hapticButtons.push(hapticBtn);

      const helpBtn = document.createElement('button');
      helpBtn.type = 'button';
      helpBtn.className = 'play-tool';
      helpBtn.dataset.playTool = 'help';
      helpBtn.setAttribute('aria-label', 'How to play ' + name);
      helpBtn.title = 'How to play ' + name;
      helpBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M9.6 9.4a2.6 2.6 0 0 1 5.1.7c0 1.7-2.4 1.9-2.4 3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /><circle cx="12" cy="17.3" r="1.05" fill="currentColor" /></svg>';
      helpBtn.addEventListener('click', function () {
        if (guide && window.MergeTheme && window.MergeTheme.openHelp) {
          window.MergeTheme.openHelp(guide.title, guide.steps, helpBtn);
        }
      });
      tools.appendChild(helpBtn);

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'play-tool play-reset';
      resetBtn.dataset.playTool = 'reset';
      resetBtn.setAttribute('aria-label', 'Reset ' + name + ' data');
      resetBtn.title = 'Reset ' + name + ' data';
      resetBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /><path d="M20 4v6h-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>';
      resetBtn.addEventListener('click', function () { requestGameReset(screen.id, resetBtn); });
      tools.appendChild(resetBtn);

      foot.insertBefore(tools, foot.firstChild);
    });

    function syncHaptics() {
      if (!window.MergeHaptics) return;
      const enabled = window.MergeHaptics.isEnabled();
      hapticButtons.forEach(function (button) {
        button.classList.toggle('is-off', !enabled);
        button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        button.setAttribute('aria-label', enabled ? 'Vibration on' : 'Vibration off');
        button.title = enabled ? 'Vibration on' : 'Vibration off';
      });
    }

    syncHaptics();
  }

  /* ======================================================================
     Water Sort
     ====================================================================== */

  (function waterSort() {
    const root = screens.water;
    if (!root) return;
    const tubesEl = $('water-tubes');
    const levelLabel = $('water-level-label');
    const levelValue = $('water-level');
    const movesEl = $('water-moves');
    const statusEl = $('water-status');
    const winEl = $('water-win');
    const nextBtn = $('water-next');
    const undoBtn = $('water-undo');
    const newBtn = $('water-new');
    const title = $('water-title');
    const STATE_KEY = 'merge-games.water.state.v3';
    const CAP = 4;
    const COLORS = [
      { name: 'coral', hex: '#e85f3b', deep: '#b83828' },
      { name: 'amber', hex: '#e3a92f', deep: '#ad7414' },
      { name: 'lime', hex: '#8bbd54', deep: '#5d8e2f' },
      { name: 'teal', hex: '#39a9a1', deep: '#167b77' },
      { name: 'blue', hex: '#5b8fd5', deep: '#3264a5' },
      { name: 'grape', hex: '#9a6bb5', deep: '#6d4389' },
      { name: 'rose', hex: '#d96b8a', deep: '#a33d5e' }
    ];
    const LEVELS = [
      { tier: 'Easy', colors: 3, tubes: [[2, 1, 0, 0], [1, 2, 0, 1], [1, 2, 0, 2], [], []] },
      { tier: 'Easy', colors: 4, tubes: [[0, 1, 1, 0], [2, 3, 3, 2], [0, 3, 2, 0], [1, 1, 2, 3], [], []] },
      { tier: 'Medium', colors: 4, tubes: [[2, 1, 3, 3], [0, 2, 1, 2], [1, 3, 0, 2], [1, 3, 0, 0], [], []] },
      { tier: 'Medium', colors: 5, tubes: [[2, 2, 0, 4], [1, 0, 1, 3], [2, 4, 4, 2], [3, 0, 0, 3], [4, 3, 1, 1], [], []] },
      { tier: 'Medium', colors: 5, tubes: [[0, 2, 3, 0], [1, 0, 3, 1], [1, 2, 0, 4], [3, 4, 2, 4], [2, 3, 4, 1], [], []] },
      { tier: 'Hard', colors: 6, tubes: [[1, 3, 1, 5], [2, 0, 2, 4], [5, 1, 2, 4], [4, 5, 3, 0], [0, 1, 0, 2], [4, 3, 5, 3], [], []] },
      { tier: 'Hard', colors: 6, tubes: [[1, 0, 2, 1], [4, 5, 3, 1], [5, 2, 0, 3], [5, 1, 0, 4], [4, 3, 2, 3], [4, 2, 0, 5], [], []] },
      { tier: 'Hard', colors: 6, tubes: [[5, 1, 0, 2], [2, 1, 0, 1], [5, 2, 4, 4], [3, 3, 0, 5], [3, 0, 4, 1], [4, 2, 3, 5], [], []] }
    ];

    let level = 0;
    let tubes = [];
    let moves = 0;
    let selected = -1;
    let history = [];
    let solved = false;
    let busy = false;
    let statusTimer = 0;

    function colorOf(index) {
      const base = COLORS[index] || COLORS[0];
      const theme = window.MergeTheme;
      if (theme && theme.colour) {
        return { name: base.name, hex: theme.colour(base.hex), deep: theme.colour(base.deep) };
      }
      return base;
    }

    function cloneTubes(source) {
      return source.map(function (tube) { return tube.slice(); });
    }

    function isSorted(state) {
      return state.every(function (tube) {
        if (!tube.length) return true;
        if (tube.length !== CAP) return false;
        return tube.every(function (color) { return color === tube[0]; });
      });
    }

    function canPour(from, to) {
      if (from === to) return 0;
      const source = tubes[from];
      const destination = tubes[to];
      if (!source || !source.length || !destination || destination.length >= CAP) return 0;
      const top = source[source.length - 1];
      if (destination.length && destination[destination.length - 1] !== top) return 0;
      let run = 0;
      for (let i = source.length - 1; i >= 0 && source[i] === top; i -= 1) run += 1;
      return Math.min(run, CAP - destination.length);
    }

    function hasMove() {
      for (let from = 0; from < tubes.length; from += 1) {
        if (!tubes[from].length) continue;
        for (let to = 0; to < tubes.length; to += 1) {
          if (from !== to && canPour(from, to) > 0) return true;
        }
      }
      return false;
    }

    function status(message, hold) {
      if (!statusEl) return;
      statusEl.textContent = message;
      window.clearTimeout(statusTimer);
      if (hold) {
        statusTimer = window.setTimeout(function () {
          if (!solved && selected === -1) statusEl.textContent = 'Tap a tube, then a target.';
        }, hold);
      }
    }

    function saveState() {
      save(STATE_KEY, {
        level: level,
        tubes: cloneTubes(tubes),
        moves: moves,
        history: history.slice(-60),
        solved: solved
      });
    }

    function updateStats() {
      if (levelLabel) levelLabel.textContent = LEVELS[level].tier + ' · Level ' + (level + 1) + ' of ' + LEVELS.length;
      if (levelValue) levelValue.textContent = String(level + 1);
      if (movesEl) movesEl.textContent = String(moves);
    }

    function invalidate(index, message) {
      const button = tubesEl.querySelector('[data-index="' + index + '"]');
      if (button) {
        button.classList.remove('is-invalid');
        void button.offsetWidth;
        button.classList.add('is-invalid');
        window.setTimeout(function () { button.classList.remove('is-invalid'); }, 420);
      }
      status(message, 2300);
    }

    function render() {
      if (!tubesEl) return;
      updateStats();
      if (winEl) winEl.hidden = !solved;
      if (statusEl) statusEl.hidden = solved;
      tubesEl.innerHTML = '';
      const columns = tubes.length <= 3 ? tubes.length : tubes.length <= 6 ? 3 : 4;
      tubesEl.style.setProperty('--water-cols', String(columns));
      tubesEl.dataset.count = String(tubes.length);

      tubes.forEach(function (tube, index) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'water-tube';
        button.dataset.index = String(index);
        button.setAttribute('aria-pressed', selected === index ? 'true' : 'false');
        button.disabled = solved;
        const visible = tube.slice().reverse().map(function (color) { return colorOf(color).name; }).join(', ');
        button.setAttribute('aria-label', 'Tube ' + (index + 1) + ', ' +
          (tube.length ? (visible + ', ' + tube.length + ' of 4 full') : 'empty') +
          (selected === index ? ', selected' : ''));
        button.title = tube.length ? visible : 'Empty tube';

        if (selected === index) button.classList.add('is-selected');
        if (level < 2 && selected >= 0 && selected !== index && canPour(selected, index) > 0) {
          button.classList.add('is-target');
        }

        const glass = document.createElement('span');
        glass.className = 'water-glass';
        tube.forEach(function (color, layer) {
          const segment = document.createElement('span');
          segment.className = 'water-seg' + (layer === tube.length - 1 ? ' water-surface' : '');
          segment.style.setProperty('--liquid', colorOf(color).hex);
          segment.style.setProperty('--liquid-deep', colorOf(color).deep);
          segment.setAttribute('aria-hidden', 'true');
          glass.appendChild(segment);
        });

        const shine = document.createElement('span');
        shine.className = 'water-shine';
        shine.setAttribute('aria-hidden', 'true');
        glass.appendChild(shine);
        button.appendChild(glass);
        button.addEventListener('click', function () { chooseTube(index); });
        tubesEl.appendChild(button);
      });
    }

    function pourStream(fromIndex, toIndex, color) {
      const from = tubesEl.querySelector('[data-index="' + fromIndex + '"]');
      const to = tubesEl.querySelector('[data-index="' + toIndex + '"]');
      if (!from || !to) return;
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const sx = a.left + a.width / 2;
      const sy = a.top + Math.max(8, a.height * 0.18);
      const dx = b.left + b.width / 2;
      const dy = b.top + Math.max(8, b.height * 0.18);
      const lift = Math.max(22, Math.abs(sy - dy) * 0.42);
      const layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      layer.setAttribute('class', 'water-pour-layer');
      layer.setAttribute('viewBox', '0 0 ' + window.innerWidth + ' ' + window.innerHeight);
      layer.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M ' + sx + ' ' + sy + ' Q ' + ((sx + dx) / 2) + ' ' + (Math.min(sy, dy) - lift) + ' ' + dx + ' ' + dy);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color.hex);
      path.setAttribute('stroke-width', '4');
      path.setAttribute('stroke-linecap', 'round');
      layer.appendChild(path);
      document.body.appendChild(layer);
      window.setTimeout(function () { layer.remove(); }, 460);
    }

    function chooseTube(index) {
      if (solved || busy) return;
      if (selected === -1) {
        if (!tubes[index].length) {
          invalidate(index, 'That tube is empty. Pick one with colour in it.');
          return;
        }
        selected = index;
        render();
        coachEvent('water', 'select');
        status('Now choose a tube with room on top.', 2600);
        return;
      }
      if (selected === index) {
        selected = -1;
        render();
        status('Selection cleared.', 1400);
        return;
      }
      const amount = canPour(selected, index);
      if (!amount) {
        invalidate(index, 'That pour will not fit. Match the top colour and leave room.');
        return;
      }
      const sourceIndex = selected;
      const colorIndex = tubes[sourceIndex][tubes[sourceIndex].length - 1];
      history.push({ tubes: cloneTubes(tubes), moves: moves });
      const source = tubes[sourceIndex];
      const destination = tubes[index];
      destination.push.apply(destination, source.splice(source.length - amount, amount));
      moves += 1;
      selected = -1;
      solved = isSorted(tubes);
      coachEvent('water', 'pour', { moves: moves });
      saveState();
      render();
      const sourceEl = tubesEl.querySelector('[data-index="' + sourceIndex + '"]');
      const targetEl = tubesEl.querySelector('[data-index="' + index + '"]');
      if (sourceEl) sourceEl.classList.add('is-pouring');
      if (targetEl) targetEl.classList.add('is-receiving');
      pourStream(sourceIndex, index, colorOf(colorIndex));
      busy = true;
      window.setTimeout(function () {
        busy = false;
        if (sourceEl) sourceEl.classList.remove('is-pouring');
        if (targetEl) targetEl.classList.remove('is-receiving');
      }, 300);
      if (solved) {
        if (window.MergeCoach) window.MergeCoach.complete('water');
        status('Level clear. Every colour has its own tube.');
        if (window.MergeHaptics) window.MergeHaptics.win();
        if (window.MergeCelebrate) window.MergeCelebrate.play(winEl);
        if (nextBtn) nextBtn.focus({ preventScroll: true });
        scheduleAutoNext(nextBtn, nextLevel);
      } else if (!hasMove()) {
        status('No moves left. Undo or start a fresh board.', 0);
      } else {
        status('Poured. Keep going.', 1600);
        if (window.MergeHaptics) window.MergeHaptics.merge(moves);
      }
    }

    function loadLevel(index, message) {
      cancelAutoNext();
      level = ((index % LEVELS.length) + LEVELS.length) % LEVELS.length;
      tubes = cloneTubes(LEVELS[level].tubes);
      moves = 0;
      selected = -1;
      history = [];
      solved = isSorted(tubes);
      busy = false;
      saveState();
      render();
      status(solved ? 'Level clear. Every colour has its own tube.' : !hasMove()
        ? 'No moves left. Undo or start a fresh board.'
        : (message || 'Tap a tube, then a target.'), 0);
    }

    function restore() {
      const saved = load(STATE_KEY, null);
      if (saved && Number.isInteger(saved.level) && Array.isArray(saved.tubes) &&
          saved.tubes.length === LEVELS[saved.level]?.tubes.length &&
          saved.tubes.every(function (tube) { return Array.isArray(tube) && tube.length <= CAP; })) {
        level = saved.level;
        tubes = saved.tubes.map(function (tube) {
          return tube.filter(function (color) { return Number.isInteger(color) && color >= 0 && color < COLORS.length; });
        });
        moves = Number.isInteger(saved.moves) && saved.moves >= 0 ? saved.moves : 0;
        history = Array.isArray(saved.history) ? saved.history.filter(function (entry) {
          return entry && Array.isArray(entry.tubes) && Number.isInteger(entry.moves);
        }).slice(-60) : [];
        solved = isSorted(tubes);
        render();
        status(solved ? 'Level clear. Every colour has its own tube.' : !hasMove()
          ? 'No moves left. Undo or start a fresh board.'
          : 'Tap a tube, then a target.', 0);
      } else {
        loadLevel(0);
      }
    }

    function undo() {
      cancelAutoNext();
      if (!history.length) {
        status('Nothing to undo yet.', 1700);
        return;
      }
      const previous = history.pop();
      tubes = cloneTubes(previous.tubes);
      moves = previous.moves;
      selected = -1;
      solved = false;
      busy = false;
      saveState();
      render();
      status('Undone. Take another look.', 1700);
    }

    function nextLevel() {
      cancelAutoNext();
      const next = (level + 1) % LEVELS.length;
      loadLevel(level + 1, LEVELS[next].tier + ' level ' + (next + 1) + '. Take your time.');
    }

    undoBtn.addEventListener('click', undo);
    newBtn.addEventListener('click', function () {
      loadLevel(level, 'Fresh board. Same colours, same calm.');
    });
    nextBtn.addEventListener('click', nextLevel);

    const shareBtn = $('water-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        shareResult('Water Sort', 'I sorted Water Sort level ' + (level + 1) + ' of ' + LEVELS.length +
          ' in ' + moves + (moves === 1 ? ' move' : ' moves') + '. Can you?', {
          game: 'Water Sort', number: '02', kind: 'SORTING',
          title: 'Water Sort',
          score: moves,
          label: 'MOVES',
          meta: ['Level ' + (level + 1) + ' of ' + LEVELS.length, 'Every colour sorted'],
          accent: '#39a9a1'
        });
      });
    }

    document.addEventListener('keydown', function (event) {
      if (current !== 'water' || event.defaultPrevented || document.documentElement.classList.contains('sheet-open')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target && target.closest && target.closest('input, textarea, select')) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === 'u') {
        event.preventDefault();
        undo();
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        loadLevel(level, 'Fresh board. Same colours, same calm.');
        return;
      }
      if (key === 'n') {
        event.preventDefault();
        loadLevel(level + 1, 'Next board. Take your time.');
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        const buttons = $$('.water-tube');
        if (!buttons.length) return;
        let index = buttons.indexOf(document.activeElement);
        if (index === -1) index = selected >= 0 ? selected : 0;
        const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
        index = (index + (forward ? 1 : -1) + buttons.length) % buttons.length;
        buttons[index].focus({ preventScroll: true });
      }
    });

    window.addEventListener('merge:appearance', function () { render(); });

    restore();
    games.water = {
      title: title,
      activate: function () {
        render();
        if (solved) scheduleAutoNext(nextBtn, nextLevel);
        else cancelAutoNext();
      },
      deactivate: function () {
        cancelAutoNext();
        saveState();
      },
      reset: function () {
        try { localStorage.removeItem(STATE_KEY); } catch (err) {}
        loadLevel(0, 'Progress reset. Back to level 1.');
      }
    };
  })();

  /* ======================================================================
     One Line
     ====================================================================== */

  (function oneLine() {
    const root = screens.oneline;
    if (!root) return;
    const svg = $('one-line-svg');
    const levelEl = $('one-line-level');
    const labelEl = $('one-line-level-label');
    const levelValue = $('one-line-level-value');
    const movesEl = $('one-line-moves');
    const statusEl = $('one-line-status');
    const winEl = $('one-line-win');
    const winCopy = $('one-line-win-copy');
    const starsEl = $('one-line-stars');
    const nextBtn = $('one-line-win-next');
    const restartBtn = $('one-line-restart');
    const undoBtn = $('one-line-undo');
    const shapesBtn = $('one-line-new');
    const title = $('one-line-title');
    const levelSheet = $('one-line-levels');
    const levelGrid = $('one-line-level-grid');
    const hintBtn = $('one-line-hint');
    const statusRow = $('one-line-status-row');
    const shareBtn = $('one-line-share');
    const shareStarsBtn = $('one-line-share-stars');
    const starTotalEl = $('one-line-star-total');
    const starMeter = $('one-line-star-meter');
    const starMeterFill = $('one-line-star-meter-fill');
    const LEVEL_KEY = 'merge-games.oneline.level.v2';
    const CHAPTERS = ['Easy', 'Medium', 'Hard', 'Expert'];

    /* The first ten shapes are hand-drawn. The rest are generated as clean,
       planar boards: no lines cross and no line runs through a dot. Every
       board starts as an Euler circuit; after the first chapter one extra
       chord leaves exactly two open ends, so the player has to begin on one
       of the ringed dots. */
    const HANDMADE = [
      {
        name: 'Triangle',
        nodes: [[50, 18], [24, 72], [76, 72]],
        edges: [[0, 1], [1, 2], [2, 0]]
      },
      {
        name: 'Square',
        nodes: [[26, 26], [74, 26], [74, 74], [26, 74]],
        edges: [[0, 1], [1, 2], [2, 3], [3, 0]]
      },
      {
        name: 'Bow',
        nodes: [[50, 50], [22, 24], [22, 76], [78, 24], [78, 76]],
        edges: [[0, 1], [1, 2], [2, 0], [0, 3], [3, 4], [4, 0]]
      },
      {
        name: 'House',
        nodes: [[62, 78], [30, 78], [30, 44], [62, 44], [18, 18], [48, 18]],
        edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 5], [5, 2]]
      },
      {
        name: 'Star',
        nodes: [[50, 16], [58.8, 37.9], [82.3, 39.5], [63.7, 55.7], [70, 77.5], [50, 63], [30, 77.5], [36.3, 55.7], [17.7, 39.5], [41.2, 37.9]],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 0]]
      },
      {
        name: 'Clover',
        nodes: [[50, 50], [50, 12], [82, 36], [82, 64], [50, 88], [18, 64], [18, 36]],
        edges: [[0, 1], [1, 2], [2, 0], [0, 3], [3, 4], [4, 0], [0, 5], [5, 6], [6, 0]]
      },
      {
        name: 'Switchback',
        nodes: [[22, 18], [50, 18], [78, 18], [78, 40], [50, 40], [50, 62], [78, 62], [78, 84], [50, 84], [22, 84], [22, 62], [22, 40]],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 0]]
      },
      {
        name: 'Spectacles',
        nodes: [[50, 50], [14, 50], [23, 32], [41, 32], [41, 68], [23, 68], [59, 32], [77, 32], [86, 50], [77, 68], [59, 68]],
        edges: [[0, 3], [3, 2], [2, 1], [1, 5], [5, 4], [4, 0], [0, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 0]]
      },
      {
        name: 'Four leaf',
        nodes: [[50, 50], [50, 10], [78, 28], [90, 50], [78, 72], [50, 90], [22, 72], [10, 50], [22, 28]],
        edges: [[0, 1], [1, 2], [2, 0], [0, 3], [3, 4], [4, 0], [0, 5], [5, 6], [6, 0], [0, 7], [7, 8], [8, 0]]
      },
      {
        name: 'Grand tour',
        nodes: [[22, 18], [50, 18], [78, 18], [78, 40], [50, 40], [50, 62], [78, 62], [78, 84], [50, 84], [22, 84], [22, 62], [22, 40], [8, 8], [35, 8]],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 0], [0, 12], [12, 13], [13, 0]]
      }
    ];
    HANDMADE.forEach(function (board) { board.handmade = true; });

    function makeRng(seed) {
      let value = seed >>> 0;
      return function () {
        value = (value + 0x6D2B79F5) >>> 0;
        let t = value;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function dist(a, b) {
      return Math.hypot(a[0] - b[0], a[1] - b[1]);
    }

    function orientation(a, b, c) {
      return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    }

    function onSegment(a, b, c) {
      const epsilon = 1e-9;
      return Math.abs(orientation(a, b, c)) < epsilon &&
        c[0] >= Math.min(a[0], b[0]) - epsilon &&
        c[0] <= Math.max(a[0], b[0]) + epsilon &&
        c[1] >= Math.min(a[1], b[1]) - epsilon &&
        c[1] <= Math.max(a[1], b[1]) + epsilon;
    }

    function segmentsCross(a, b, c, d) {
      const o1 = orientation(a, b, c);
      const o2 = orientation(a, b, d);
      const o3 = orientation(c, d, a);
      const o4 = orientation(c, d, b);
      if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) &&
          ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
      return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
    }

    function shareNode(edge, other) {
      return edge[0] === other[0] || edge[0] === other[1] ||
        edge[1] === other[0] || edge[1] === other[1];
    }

    function pointToSegment(point, a, b) {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const lengthSq = dx * dx + dy * dy;
      if (!lengthSq) return dist(point, a);
      let t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSq;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
    }

    function placePath(ai, bi, count, side, rng, nodes, edges) {
      const A = nodes[ai];
      const B = nodes[bi];
      const dx = B[0] - A[0];
      const dy = B[1] - A[1];
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      const points = [];

      for (let step = 1; step <= count; step += 1) {
        const t = step / (count + 1);
        const offset = (count === 1 ? 12 : 9) + rng() * 9;
        const along = (rng() - 0.5) * 7;
        const x = A[0] + dx * t + nx * offset * side - (dy / length) * along;
        const y = A[1] + dy * t + ny * offset * side + (dx / length) * along;
        if (x < 12 || x > 88 || y < 12 || y > 88) return null;
        for (let n = 0; n < nodes.length; n += 1) {
          if (dist([x, y], nodes[n]) < 12.5) return null;
        }
        for (let e = 0; e < edges.length; e += 1) {
          const edge = edges[e];
          if (pointToSegment([x, y], nodes[edge[0]], nodes[edge[1]]) < 8) return null;
        }
        for (let p = 0; p < points.length; p += 1) {
          if (dist([x, y], points[p]) < 12.5) return null;
        }
        points.push([x, y]);
      }

      const ids = [ai].concat(points.map(function (point, index) {
        return nodes.length + index;
      }), [bi]);
      const allNodes = nodes.concat(points);
      const candidate = [];
      for (let i = 0; i < ids.length - 1; i += 1) {
        candidate.push([ids[i], ids[i + 1]]);
      }

      for (let i = 0; i < candidate.length; i += 1) {
        const edge = candidate[i];
        for (let e = 0; e < edges.length; e += 1) {
          const other = edges[e];
          if ((edge[0] === other[0] && edge[1] === other[1]) ||
              (edge[0] === other[1] && edge[1] === other[0])) return null;
        }
      }

      for (let i = 0; i < candidate.length; i += 1) {
        const edge = candidate[i];
        const p1 = allNodes[edge[0]];
        const p2 = allNodes[edge[1]];
        for (let e = 0; e < edges.length; e += 1) {
          const other = edges[e];
          if (shareNode(edge, other)) continue;
          if (segmentsCross(p1, p2, allNodes[other[0]], allNodes[other[1]])) return null;
        }
        for (let p = 0; p < i; p += 1) {
          const other = candidate[p];
          if (shareNode(edge, other)) continue;
          if (segmentsCross(p1, p2, allNodes[other[0]], allNodes[other[1]])) return null;
        }
        for (let n = 0; n < allNodes.length; n += 1) {
          if (n === edge[0] || n === edge[1]) continue;
          if (pointToSegment(allNodes[n], p1, p2) < 8) return null;
        }
      }

      return { points: points, edges: candidate };
    }

    /* One Line used to build every generated shape from the same ring, which
       made later levels read as the same drawing turned to a new angle. These
       five simple, non-crossing families vary the silhouette itself: circle,
       ellipse, rounded diamond, eight-point star and hexagon. Node counts and
       rotation move too, so even two shapes of the same family feel different. */
    function baseLoop(index, rng) {
      const styles = ['ring', 'ellipse', 'diamond', 'star', 'hexagon'];
      const style = styles[index % styles.length];
      const rotation = rng() * Math.PI * 2;
      let count = 4 + Math.floor(rng() * 3);
      if (style === 'diamond') count = 4;
      if (style === 'star') count = 8;
      if (style === 'hexagon') count = 6;

      const nodes = [];
      for (let i = 0; i < count; i += 1) {
        const angle = rotation + (i * Math.PI * 2) / count;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        let x = 50;
        let y = 50;
        if (style === 'ellipse') {
          x = 50 + c * (31 + rng() * 7);
          y = 50 + s * (20 + rng() * 6);
        } else if (style === 'diamond') {
          x = 50 + 36 * Math.sign(c) * Math.pow(Math.abs(c), 0.62);
          y = 50 + 31 * Math.sign(s) * Math.pow(Math.abs(s), 0.62);
        } else if (style === 'star') {
          const radius = i % 2 ? 17 + rng() * 3 : 37 + rng() * 3;
          x = 50 + c * radius;
          y = 50 + s * radius;
        } else if (style === 'hexagon') {
          x = 50 + c * (32 + rng() * 4);
          y = 50 + s * (28 + rng() * 4);
        } else {
          const radius = 24 + rng() * 9;
          x = 50 + c * radius;
          y = 50 + s * radius;
        }
        nodes.push([clamp(x, 13, 87), clamp(y, 13, 87)]);
      }

      return {
        nodes: nodes,
        edges: nodes.map(function (_, i) { return [i, (i + 1) % count]; })
      };
    }

    function buildEvenBoard(index) {
      const rng = makeRng(0x9E3779B9 ^ (index * 2654435761));
      const target = clamp(4 + Math.round(index * 24 / 89 + (rng() - 0.5) * 3), 4, 30);
      const base = baseLoop(index, rng);
      let nodes = base.nodes;
      let edges = base.edges;

      let ears = 0;
      while (edges.length < target && ears < 9) {
        let added = false;
        for (let tries = 0; tries < 240 && !added; tries += 1) {
          const ai = Math.floor(rng() * nodes.length);
          const bi = Math.floor(rng() * nodes.length);
          if (bi === ai) continue;
          if (dist(nodes[ai], nodes[bi]) < 22) continue;
          const countA = rng() < 0.55 ? 1 : 2;
          const countB = rng() < 0.55 ? 1 : 2;
          const pathA = placePath(ai, bi, countA, 1, rng, nodes, edges);
          if (!pathA) continue;
          const nodesA = nodes.concat(pathA.points);
          const edgesA = edges.concat(pathA.edges);
          const pathB = placePath(ai, bi, countB, -1, rng, nodesA, edgesA);
          if (!pathB) continue;
          nodes = nodesA.concat(pathB.points);
          edges = edgesA.concat(pathB.edges);
          added = true;
          ears += 1;
        }
        if (!added) break;
      }

      return { nodes: nodes, edges: edges };
    }

    function addOpenEdge(board, rng) {
      const nodes = board.nodes;
      const edges = board.edges;
      const pairs = [];
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const exists = edges.some(function (edge) {
            return (edge[0] === i && edge[1] === j) || (edge[0] === j && edge[1] === i);
          });
          if (exists || dist(nodes[i], nodes[j]) < 16) continue;
          pairs.push([i, j]);
        }
      }
      for (let i = pairs.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        const temp = pairs[i];
        pairs[i] = pairs[j];
        pairs[j] = temp;
      }
      for (let p = 0; p < pairs.length; p += 1) {
        const i = pairs[p][0];
        const j = pairs[p][1];
        const a = nodes[i];
        const b = nodes[j];
        let valid = true;
        for (let e = 0; e < edges.length; e += 1) {
          const edge = edges[e];
          if (shareNode([i, j], edge)) continue;
          if (segmentsCross(a, b, nodes[edge[0]], nodes[edge[1]])) {
            valid = false;
            break;
          }
        }
        if (!valid) continue;
        for (let n = 0; n < nodes.length; n += 1) {
          if (n === i || n === j) continue;
          if (pointToSegment(nodes[n], a, b) < 8) {
            valid = false;
            break;
          }
        }
        if (!valid) continue;
        edges.push([i, j]);
        return true;
      }
      return false;
    }

    function degreeCounts(board) {
      const counts = board.nodes.map(function () { return 0; });
      board.edges.forEach(function (edge) {
        counts[edge[0]] += 1;
        counts[edge[1]] += 1;
      });
      return counts;
    }

    const GENERATED = [];
    for (let i = 0; i < 90; i += 1) {
      GENERATED.push(buildEvenBoard(i));
    }
    const LEVELS = HANDMADE.concat(GENERATED);
    LEVELS.sort(function (a, b) {
      return a.edges.length - b.edges.length ||
        a.nodes.length - b.nodes.length ||
        (a.handmade === b.handmade ? 0 : a.handmade ? -1 : 1);
    });
    LEVELS.forEach(function (board, index) {
      if (!board.handmade) board.name = 'Shape ' + (index + 1);
    });
    const CHAPTER_SIZE = Math.ceil(LEVELS.length / 4);
    for (let i = CHAPTER_SIZE; i < LEVELS.length; i += 1) {
      addOpenEdge(LEVELS[i], makeRng(0xABCDEF ^ (i * 7919)));
    }

    function chapterFor(index) {
      return CHAPTERS[Math.min(CHAPTERS.length - 1, Math.floor(index / CHAPTER_SIZE))] || CHAPTERS[0];
    }

    let level = 0;
    let unlocked = 0;
    let starMap = {};
    let path = [];
    let used = new Set();
    let solved = false;
    let pointerId = null;
    let pointerActive = false;
    let attemptUndo = false;
    let attemptRestart = false;
    let attemptHint = false;

    function data() {
      return LEVELS[level];
    }

    function edgeKey(a, b) {
      return Math.min(a, b) + '-' + Math.max(a, b);
    }

    function edgeExists(a, b) {
      return data().edges.some(function (edge) {
        return (edge[0] === a && edge[1] === b) || (edge[0] === b && edge[1] === a);
      });
    }

    function setStatus(message) {
      if (statusEl) statusEl.textContent = message;
    }

    function saveProgress() {
      save(LEVEL_KEY, {
        level: level,
        unlocked: unlocked,
        stars: starMap
      });
    }

    function starSummary() {
      let total = 0;
      let solvedCount = 0;
      Object.keys(starMap).forEach(function (key) {
        const value = starMap[key] || 0;
        total += value;
        if (value > 0) solvedCount += 1;
      });
      return { total: total, solved: solvedCount };
    }

    function shareStarProgress(justSolved) {
      // Sharing is a deliberate pause: keep the result card up instead of
      // letting the five-second next-round timer replace it.
      if (window.MergeAutoNext) window.MergeAutoNext.cancel();
      const summary = starSummary();
      const max = LEVELS.length * 3;
      let message;
      if (summary.total >= max) {
        message = justSolved
          ? 'I just completed One Line — all ' + LEVELS.length + ' shapes and ' + max + ' stars. Can you match it?'
          : 'I earned all ' + max + ' stars in One Line — all ' + LEVELS.length + ' shapes solved. Can you match it?';
      } else if (justSolved && starMap[String(level)]) {
        message = 'I solved One Line shape ' + (level + 1) + ' with ' + starMap[String(level)] +
          ' stars — ' + summary.total + ' of ' + max + ' stars so far. Can you beat it?';
      } else if (!summary.solved) {
        message = 'I’m playing One Line in Sixfold — ' + LEVELS.length +
          ' shapes, one unbroken line each. Can you beat my stars?';
      } else {
        message = 'I’ve earned ' + summary.total + ' of ' + max + ' stars in One Line — ' +
          summary.solved + ' of ' + LEVELS.length + ' shapes solved. Can you beat it?';
      }
      shareResult('One Line', message, {
        game: 'One Line', number: '03', kind: 'DRAWING',
        title: 'Shape ' + (level + 1),
        score: summary.total,
        label: 'OF ' + max + ' STARS',
        meta: [summary.solved + ' of ' + LEVELS.length + ' solved', 'One unbroken line'],
        accent: '#e85f3b'
      });
    }

    /* Walk the unused links with Hierholzer's algorithm. If the trail uses
       every remaining link, it is a real continuation from the current dot. */
    function remainingTrail(start) {
      const board = data();
      const adjacency = board.nodes.map(function () { return []; });
      let remaining = 0;
      board.edges.forEach(function (edge) {
        const key = edgeKey(edge[0], edge[1]);
        if (used.has(key)) return;
        adjacency[edge[0]].push({ to: edge[1], key: key });
        adjacency[edge[1]].push({ to: edge[0], key: key });
        remaining += 1;
      });
      let odd = 0;
      adjacency.forEach(function (list) {
        if (list.length % 2) odd += 1;
      });
      if (!remaining || !adjacency[start].length) {
        return { trail: [start], edges: 0, remaining: remaining, odd: odd, startOdd: adjacency[start].length % 2 === 1 };
      }
      const seen = new Set();
      const stack = [start];
      const trail = [];
      while (stack.length) {
        const node = stack[stack.length - 1];
        const next = adjacency[node].find(function (option) { return !seen.has(option.key); });
        if (next) {
          seen.add(next.key);
          stack.push(next.to);
        } else {
          trail.push(stack.pop());
        }
      }
      trail.reverse();
      return { trail: trail, edges: seen.size, remaining: remaining, odd: odd, startOdd: adjacency[start].length % 2 === 1 };
    }

    function highlightHint(index) {
      const nodes = svg.querySelectorAll('.one-node');
      for (let i = 0; i < nodes.length; i += 1) {
        nodes[i].classList.toggle('is-hint', i === index);
      }
      const target = nodes[index];
      if (!target) return;
      const label = target.getAttribute('aria-label') || '';
      if (label.indexOf(', hint') === -1) target.setAttribute('aria-label', label + ', hint');
      target.focus({ preventScroll: true });
    }

    function showHint() {
      if (solved) return;
      const board = data();
      const degrees = degreeCounts(board);
      const open = degrees.filter(function (count) { return count % 2; }).length;
      const firstHint = !attemptHint;

      if (!path.length) {
        const candidates = board.nodes.map(function (_, index) { return index; }).filter(function (index) {
          return open === 2 ? degrees[index] % 2 === 1 : degrees[index] > 0;
        });
        for (let i = 0; i < candidates.length; i += 1) {
          const trial = remainingTrail(candidates[i]);
          if (trial.remaining > 0 && trial.edges === trial.remaining && trial.trail.length > 1) {
            attemptHint = true;
            highlightHint(candidates[i]);
            setStatus('Hint: start on the pulsing dot.' +
              (firstHint && !attemptUndo && !attemptRestart ? ' This shape now tops out at two stars.' : ''));
            return;
          }
        }
        setStatus('No hint is available for this shape.');
        return;
      }

      const current = path[path.length - 1];
      const trial = remainingTrail(current);
      if (!trial.remaining) {
        setStatus('Every link is already used.');
        return;
      }
      // A trail can only start on an even dot when every unused dot is even.
      // Starting on a closed dot of an open shape cannot finish the shape.
      const canFinish = trial.odd === 0 || (trial.odd === 2 && trial.startOdd);
      if (!canFinish || trial.edges !== trial.remaining || trial.trail.length < 2) {
        if (path.length === 1 && open === 2 && degrees[current] % 2 === 0) {
          setStatus('Start on a ringed dot. Restart to begin again.');
        } else {
          setStatus('This line can’t be finished from here. Undo a step or restart.');
        }
        return;
      }

      attemptHint = true;
      highlightHint(trial.trail[1]);
      setStatus('Hint: tap the pulsing dot.' +
        (firstHint && !attemptUndo && !attemptRestart ? ' This shape now tops out at two stars.' : ''));
    }

    function introMessage() {
      const degrees = degreeCounts(data());
      const open = degrees.filter(function (count) { return count % 2; }).length;
      return open === 2
        ? 'Start on a ringed dot. Use every link once.'
        : 'Drag from any dot. Use every link once.';
    }

    function startMessage(index) {
      const degrees = degreeCounts(data());
      const open = degrees.filter(function (count) { return count % 2; }).length;
      if (open === 2 && degrees[index] % 2 === 0) {
        return 'Started on a closed dot. Ringed dots are the open ends.';
      }
      return 'Line started. Drag or tap a connected dot.';
    }

    function updateStats() {
      const board = data();
      if (levelEl) {
        levelEl.setAttribute('aria-label', 'Open shape list. ' + chapterFor(level) +
          ', shape ' + (level + 1) + ' of ' + LEVELS.length + '.');
      }
      if (labelEl) {
        labelEl.textContent = chapterFor(level) + ' · ' + (level + 1) + ' of ' + LEVELS.length;
      }
      if (levelValue) levelValue.textContent = String(level + 1);
      if (movesEl) movesEl.textContent = String(Math.max(0, path.length - 1));
      if (starsEl) starsEl.setAttribute('aria-label', (starMap[String(level)] || 0) + ' of 3 stars');
      return board;
    }

    function focusCurrent() {
      const node = svg.querySelector('.one-node.is-current');
      if (node) node.focus({ preventScroll: true });
    }

    function render() {
      if (!svg) return;
      const board = updateStats();
      svg.innerHTML = '';

      const edgeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const pathLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const nodeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      board.edges.forEach(function (edge) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', board.nodes[edge[0]][0]);
        line.setAttribute('y1', board.nodes[edge[0]][1]);
        line.setAttribute('x2', board.nodes[edge[1]][0]);
        line.setAttribute('y2', board.nodes[edge[1]][1]);
        line.setAttribute('class', 'one-edge' + (used.has(edgeKey(edge[0], edge[1])) ? ' is-used' : ''));
        edgeLayer.appendChild(line);
      });

      if (path.length > 1) {
        const trail = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        trail.setAttribute('class', 'one-path');
        trail.setAttribute('points', path.map(function (index) {
          return board.nodes[index][0] + ',' + board.nodes[index][1];
        }).join(' '));
        pathLayer.appendChild(trail);
      }

      const inPath = new Set(path);
      const degrees = degreeCounts(board);
      board.nodes.forEach(function (node, index) {
        const isOpen = degrees[index] % 2 === 1;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', node[0]);
        circle.setAttribute('cy', node[1]);
        circle.setAttribute('r', '4.7');
        circle.setAttribute('class', 'one-node' +
          (isOpen ? ' is-open-end' : '') +
          (inPath.has(index) ? ' is-visited' : '') +
          (path[path.length - 1] === index ? ' is-current' : ''));
        circle.setAttribute('tabindex', '0');
        circle.setAttribute('role', 'button');
        circle.setAttribute('aria-label', 'Dot ' + (index + 1) + ' of ' + board.nodes.length +
          (isOpen ? ', open end' : '') +
          (path[path.length - 1] === index ? ', current line end' : ''));
        circle.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            tapNode(index);
          }
        });
        nodeLayer.appendChild(circle);
      });

      svg.appendChild(edgeLayer);
      svg.appendChild(pathLayer);
      svg.appendChild(nodeLayer);
      if (winEl) winEl.hidden = !solved;
      if (statusEl) statusEl.hidden = false;
      if (statusRow) statusRow.hidden = solved;
      else if (statusEl) statusEl.hidden = solved;
      svg.classList.toggle('is-complete', solved);
    }

    function noOpenLink() {
      if (!path.length) return false;
      const last = path[path.length - 1];
      return !data().edges.some(function (edge) {
        if (edge[0] !== last && edge[1] !== last) return false;
        return !used.has(edgeKey(edge[0], edge[1]));
      });
    }

    function finish() {
      cancelAutoNext();
      solved = true;
      pointerActive = false;
      pointerId = null;
      const earned = attemptRestart ? 1 : (attemptUndo || attemptHint) ? 2 : 3;
      const key = String(level);
      starMap[key] = Math.max(starMap[key] || 0, earned);
      if (level === unlocked && unlocked < LEVELS.length - 1) {
        unlocked += 1;
      }
      saveProgress();
      render();
      if (winCopy) {
        winCopy.textContent = 'All ' + used.size + ' links in one unbroken stroke. ' + earned + ' of 3 stars.';
      }
      if (starsEl) {
        starsEl.textContent = ['', '★☆☆', '★★☆', '★★★'][earned];
        starsEl.setAttribute('aria-label', earned + ' of 3 stars');
        starsEl.hidden = false;
      }
      if (nextBtn) {
        nextBtn.textContent = level === LEVELS.length - 1 ? 'Choose a shape' : 'Next shape';
        delete nextBtn.dataset.autoNextBase;
      }
      setStatus('One line. Every link used.');
      if (window.MergeCoach) window.MergeCoach.complete('oneline');
      if (window.MergeHaptics) window.MergeHaptics.win();
      if (window.MergeCelebrate) window.MergeCelebrate.play(winEl);
      if (nextBtn) {
        nextBtn.focus({ preventScroll: true });
        if (level < LEVELS.length - 1) scheduleAutoNext(nextBtn, nextLevel);
      }
    }

    function addNode(index) {
      if (solved) return false;
      const last = path[path.length - 1];
      if (last === undefined || index === last) return false;
      const key = edgeKey(last, index);
      if (!edgeExists(last, index) || used.has(key)) return false;
      used.add(key);
      path.push(index);
      if (window.MergeCoach) window.MergeCoach.event('oneline', 'link', { links: used.size });
      if (used.size === data().edges.length) {
        finish();
      } else {
        render();
        if (window.MergeHaptics) window.MergeHaptics.merge(path.length);
        if (noOpenLink()) {
          setStatus('Dead end. Step back or restart.');
        } else {
          setStatus('Keep going. ' + (data().edges.length - used.size) + ' link' +
            (data().edges.length - used.size === 1 ? '' : 's') + ' left.');
        }
      }
      return true;
    }

    function stepBack() {
      cancelAutoNext();
      if (!path.length) {
        setStatus('The line is clear. Pick a dot to begin.');
        return;
      }
      if (path.length > 1 || solved) attemptUndo = true;
      if (path.length === 1) {
        path = [];
        render();
        setStatus('Line cleared. Pick a dot to begin.');
        return;
      }
      const last = path.pop();
      const previous = path[path.length - 1];
      used.delete(edgeKey(previous, last));
      solved = false;
      if (winEl) winEl.hidden = true;
      render();
      setStatus('Stepped back. Pick another link.');
    }

    function tapNode(index) {
      if (solved) return;
      if (!path.length) {
        path = [index];
        render();
        setStatus(startMessage(index));
        if (window.MergeCoach) window.MergeCoach.event('oneline', 'start');
        focusCurrent();
        return;
      }
      const last = path[path.length - 1];
      if (index === last) {
        setStatus('That is the line end. Choose a connected dot.');
        return;
      }
      if (path.length > 1 && index === path[path.length - 2]) {
        stepBack();
        return;
      }
      if (addNode(index)) {
        focusCurrent();
      } else {
        setStatus('Those dots are not connected by an unused link.');
      }
    }

    function reset(message, isRestart) {
      cancelAutoNext();
      path = [];
      used = new Set();
      solved = false;
      pointerId = null;
      pointerActive = false;
      attemptUndo = false;
      attemptRestart = !!isRestart;
      attemptHint = false;
      if (winEl) winEl.hidden = true;
      if (winCopy) winCopy.textContent = '';
      if (starsEl) {
        starsEl.textContent = '';
        starsEl.hidden = true;
      }
      if (nextBtn) {
        nextBtn.textContent = 'Next shape';
        delete nextBtn.dataset.autoNextBase;
      }
      saveProgress();
      render();
      setStatus(message || introMessage());
    }

    function nextLevel() {
      cancelAutoNext();
      if (level + 1 < LEVELS.length && level + 1 <= unlocked) {
        level += 1;
        saveProgress();
        reset(chapterFor(level) + ' · Shape ' + (level + 1) + '. ' + introMessage());
        return;
      }
      if (level + 1 < LEVELS.length) {
        setStatus('Solve this shape to unlock the next one.');
      }
      openLevelSheet(nextBtn || shapesBtn || levelEl);
    }

    function renderLevelGrid() {
      if (!levelGrid) return;
      if (starTotalEl) {
        const total = starSummary().total;
        const max = LEVELS.length * 3;
        starTotalEl.textContent = total + ' of ' + max + ' stars';
        if (starMeter) {
          starMeter.setAttribute('aria-valuenow', String(total));
          starMeter.setAttribute('aria-valuetext', total + ' of ' + max + ' stars');
          starMeter.classList.toggle('has-stars', total > 0);
        }
        if (starMeterFill) starMeterFill.style.width = (total / max * 100) + '%';
      }
      levelGrid.innerHTML = '';
      LEVELS.forEach(function (board, index) {
        const stars = starMap[String(index)] || 0;
        const locked = index > unlocked;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'level-cell' +
          (index === level ? ' is-current' : '') +
          (locked ? ' is-locked' : '');
        button.disabled = locked;

        const number = document.createElement('strong');
        number.textContent = String(index + 1);

        const dots = document.createElement('span');
        dots.className = 'level-dots';
        dots.setAttribute('aria-hidden', 'true');
        for (let dot = 0; dot < 3; dot += 1) {
          const mark = document.createElement('i');
          if (dot < stars) mark.className = 'on';
          dots.appendChild(mark);
        }

        button.appendChild(number);
        button.appendChild(dots);
        button.setAttribute('aria-label', 'Shape ' + (index + 1) + ', ' + chapterFor(index) +
          (locked ? ', locked' : stars ? ', ' + stars + ' of 3 stars' : ', not solved'));
        button.addEventListener('click', function () { selectLevel(index); });
        levelGrid.appendChild(button);
      });
    }

    function openLevelSheet(opener) {
      if (!levelSheet || !levelGrid) return;
      cancelAutoNext();
      renderLevelGrid();
      if (window.MergeTheme && window.MergeTheme.openSheet) {
        window.MergeTheme.openSheet(levelSheet, opener || shapesBtn || levelEl);
      } else {
        levelSheet.hidden = false;
        levelSheet.classList.add('is-open');
      }
      const doneBtn = levelSheet.querySelector('.sheet-done');
      const current = levelGrid.querySelector('.is-current');
      window.setTimeout(function () {
        if (doneBtn) doneBtn.focus({ preventScroll: true });
        if (current) current.scrollIntoView({ block: 'nearest' });
      }, 60);
    }

    function closeLevelSheet() {
      if (!levelSheet || levelSheet.hidden) return;
      if (window.MergeTheme && window.MergeTheme.closeSheet) {
        window.MergeTheme.closeSheet(levelSheet);
      } else {
        levelSheet.hidden = true;
        levelSheet.classList.remove('is-open');
      }
    }

    function selectLevel(index) {
      if (index < 0 || index >= LEVELS.length || index > unlocked) return;
      level = index;
      saveProgress();
      closeLevelSheet();
      reset(chapterFor(level) + ' · Shape ' + (level + 1) + '. ' + introMessage());
    }

    function svgPoint(event) {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return { x: -100, y: -100 };
      return {
        x: ((event.clientX - rect.left) / rect.width) * 100,
        y: ((event.clientY - rect.top) / rect.height) * 100
      };
    }

    function nearestNode(event) {
      const point = svgPoint(event);
      let best = null;
      let bestDistance = 11;
      data().nodes.forEach(function (node, index) {
        const distance = Math.hypot(node[0] - point.x, node[1] - point.y);
        if (distance < bestDistance) {
          best = index;
          bestDistance = distance;
        }
      });
      return best;
    }

    function extendFromPointer(index) {
      if (index === null || solved) return;
      if (!path.length) {
        path = [index];
        render();
        setStatus(startMessage(index));
        if (window.MergeCoach) window.MergeCoach.event('oneline', 'start');
        return;
      }
      const last = path[path.length - 1];
      if (index === last) return;
      if (path.length > 1 && index === path[path.length - 2]) {
        stepBack();
        return;
      }
      if (addNode(index)) {
        setStatus('Keep tracing. ' + (data().edges.length - used.size) + ' links left.');
      }
    }

    svg.addEventListener('pointerdown', function (event) {
      if (solved) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const index = nearestNode(event);
      if (index === null) return;
      event.preventDefault();
      const last = path[path.length - 1];
      if (!path.length || index === last || (path.length > 1 && index === path[path.length - 2]) ||
          (last !== undefined && edgeExists(last, index) && !used.has(edgeKey(last, index)))) {
        extendFromPointer(index);
        pointerId = event.pointerId;
        pointerActive = true;
        try { svg.setPointerCapture(event.pointerId); } catch (err) {}
      } else {
        setStatus('Start at the glowing line end or a free dot.');
      }
    });

    svg.addEventListener('pointermove', function (event) {
      if (!pointerActive || solved) return;
      extendFromPointer(nearestNode(event));
    });

    function endPointer(event) {
      if (pointerId !== null && event && event.pointerId !== undefined && event.pointerId !== pointerId) return;
      pointerActive = false;
      pointerId = null;
      if (!solved) {
        setStatus(path.length ? 'Line paused at the glowing dot. Continue from there.' : 'Pick a dot to begin.');
      }
    }

    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);
    svg.addEventListener('pointerleave', function (event) {
      if (pointerActive && event.pointerType === 'mouse') endPointer(event);
    });

    document.addEventListener('keydown', function (event) {
      if (current !== 'oneline' || event.defaultPrevented || document.documentElement.classList.contains('sheet-open')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target && target.closest && target.closest('input, textarea, select')) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === 'u' || event.key === 'Backspace') {
        event.preventDefault();
        stepBack();
      } else if (key === 'r') {
        event.preventDefault();
        reset('Same shape. Start again.', true);
      } else if (key === 'h') {
        event.preventDefault();
        showHint();
      } else if (key === 'n') {
        event.preventDefault();
        nextLevel();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && levelSheet && !levelSheet.hidden) {
        closeLevelSheet();
      }
    });

    restartBtn.addEventListener('click', function () { reset('Same shape. Start again.', true); });
    if (undoBtn) undoBtn.addEventListener('click', stepBack);
    if (hintBtn) hintBtn.addEventListener('click', showHint);
    if (shapesBtn) shapesBtn.addEventListener('click', function () { openLevelSheet(shapesBtn); });
    if (levelEl) levelEl.addEventListener('click', function () { openLevelSheet(levelEl); });
    nextBtn.addEventListener('click', nextLevel);
    if (shareBtn) shareBtn.addEventListener('click', function () { shareStarProgress(true); });
    if (shareStarsBtn) shareStarsBtn.addEventListener('click', function () { shareStarProgress(false); });
    if (levelSheet) {
      levelSheet.querySelectorAll('[data-close], .sheet-done').forEach(function (el) {
        el.addEventListener('click', closeLevelSheet);
      });
    }

    const saved = load(LEVEL_KEY, null);
    if (saved && typeof saved === 'object') {
      if (Number.isInteger(saved.level) && saved.level >= 0 && saved.level < LEVELS.length) {
        level = saved.level;
      }
      if (Number.isInteger(saved.unlocked)) {
        unlocked = clamp(saved.unlocked, 0, LEVELS.length - 1);
      }
      if (saved.stars && typeof saved.stars === 'object') {
        Object.keys(saved.stars).forEach(function (key) {
          const value = saved.stars[key];
          if (/^\d+$/.test(key) && Number.isInteger(value) && value >= 1 && value <= 3) {
            const index = Number(key);
            if (index >= 0 && index < LEVELS.length) {
              starMap[key] = value;
              unlocked = Math.max(unlocked, Math.min(index + 1, LEVELS.length - 1));
            }
          }
        });
      }
    }
    unlocked = Math.max(unlocked, Math.min(level, LEVELS.length - 1));
    level = Math.min(level, unlocked);
    reset(introMessage());

    games.oneline = {
      title: title,
      activate: function () {
        render();
        if (solved && level < LEVELS.length - 1) scheduleAutoNext(nextBtn, nextLevel);
        else cancelAutoNext();
        setStatus(path.length ? 'Line paused at the glowing dot. Continue from there.' : introMessage());
      },
      deactivate: function () {
        cancelAutoNext();
        pointerActive = false;
        pointerId = null;
      },
      reset: function () {
        level = 0;
        unlocked = 0;
        starMap = {};
        try { localStorage.removeItem(LEVEL_KEY); } catch (err) {}
        reset('Progress reset. Back to shape 1.');
      }
    };
  })();

  /* ======================================================================
     Tic Tac Toe
     ====================================================================== */

  (function ticTacToe() {
    const root = screens.ttt;
    if (!root) return;
    const boardEl = $('ttt-board');
    const statusEl = $('ttt-status');
    const resultEl = $('ttt-result');
    const resultTitle = $('ttt-result-title');
    const resultCopy = $('ttt-result-copy');
    const againBtn = $('ttt-again');
    const newBtn = $('ttt-new');
    const difficultyEl = $('ttt-difficulty');
    const winsEl = $('ttt-wins');
    const drawsEl = $('ttt-draws');
    const lossesEl = $('ttt-losses');
    const winsLabel = $('ttt-wins-label');
    const drawsLabel = $('ttt-draws-label');
    const lossesLabel = $('ttt-losses-label');
    const tagEl = $('ttt-tag');
    const subEl = $('ttt-sub');
    const noteEl = $('ttt-note');
    const title = $('ttt-title');
    const STATS_KEY = 'merge-games.ttt.stats.v2';
    const TWO_STATS_KEY = 'merge-games.ttt.two.v2';
    const DIFFICULTY_KEY = 'merge-games.ttt.difficulty.v2';
    const MODE_KEY = 'merge-games.ttt.mode.v1';
    const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const AI_STYLES = {
      easy: { note: 'Easy computer: loose and forgiving.', status: 'Loose and forgiving.' },
      sharp: { note: 'Sharp computer: takes wins and blocks.', status: 'Takes wins and blocks.' },
      perfect: { note: 'Perfect computer: never misses.', status: 'Never misses.' }
    };
    const savedStats = load(STATS_KEY, null);
    const savedTwoStats = load(TWO_STATS_KEY, null);
    const savedDifficulty = load(DIFFICULTY_KEY, null);
    const savedMode = load(MODE_KEY, null);
    let stats = {
      wins: savedStats && Number.isInteger(savedStats.wins) ? savedStats.wins : 0,
      draws: savedStats && Number.isInteger(savedStats.draws) ? savedStats.draws : 0,
      losses: savedStats && Number.isInteger(savedStats.losses) ? savedStats.losses : 0
    };
    let twoStats = {
      x: savedTwoStats && Number.isInteger(savedTwoStats.x) ? savedTwoStats.x : 0,
      draws: savedTwoStats && Number.isInteger(savedTwoStats.draws) ? savedTwoStats.draws : 0,
      o: savedTwoStats && Number.isInteger(savedTwoStats.o) ? savedTwoStats.o : 0
    };
    let mode = savedMode && savedMode.mode === 'two' ? 'two' : 'computer';
    let difficulty = savedDifficulty && ['easy', 'sharp', 'perfect'].indexOf(savedDifficulty.difficulty) !== -1
      ? savedDifficulty.difficulty : 'sharp';
    let board = Array(9).fill('');
    let turn = 'X';
    let over = false;
    let winner = '';
    let winLine = null;
    let thinking = false;
    let aiTimer = 0;
    const cells = [];

    function saveStats() {
      save(STATS_KEY, stats);
    }

    function saveDifficulty() {
      save(DIFFICULTY_KEY, { difficulty: difficulty });
    }

    function saveTwoStats() {
      save(TWO_STATS_KEY, twoStats);
    }

    function saveMode() {
      save(MODE_KEY, { mode: mode });
    }

    function status(message) {
      if (statusEl) statusEl.textContent = message;
    }

    function findWinner(state) {
      for (let i = 0; i < LINES.length; i += 1) {
        const [a, b, c] = LINES[i];
        if (state[a] && state[a] === state[b] && state[a] === state[c]) {
          return { mark: state[a], line: LINES[i] };
        }
      }
      return null;
    }

    function full(state) {
      return state.every(function (cell) { return cell !== ''; });
    }

    function render() {
      if (!boardEl) return;
      const shown = mode === 'two' ? twoStats : stats;
      if (winsEl) winsEl.textContent = String(mode === 'two' ? shown.x : shown.wins);
      if (drawsEl) drawsEl.textContent = String(shown.draws);
      if (lossesEl) lossesEl.textContent = String(mode === 'two' ? shown.o : shown.losses);
      if (winsLabel) winsLabel.textContent = mode === 'two' ? 'X wins' : 'Wins';
      if (drawsLabel) drawsLabel.textContent = 'Draws';
      if (lossesLabel) lossesLabel.textContent = mode === 'two' ? 'O wins' : 'Losses';
      if (tagEl) tagEl.textContent = mode === 'two'
        ? 'Two players · one phone'
        : 'You are X · ' + difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
      if (subEl) subEl.textContent = mode === 'two' ? 'Take turns. X starts.' : 'Beat the computer to three in a row.';
      if (noteEl) noteEl.textContent = mode === 'two'
        ? 'X and O take turns. Tap a level to play the computer.'
        : AI_STYLES[difficulty].note;
      if (difficultyEl) {
        Array.from(difficultyEl.querySelectorAll('[data-ttt-difficulty]')).forEach(function (button) {
          button.setAttribute('aria-pressed', mode === 'computer' && button.dataset.tttDifficulty === difficulty ? 'true' : 'false');
          button.classList.toggle('is-inactive', mode === 'two');
        });
        Array.from(difficultyEl.querySelectorAll('[data-ttt-mode]')).forEach(function (button) {
          button.setAttribute('aria-pressed', button.dataset.tttMode === mode ? 'true' : 'false');
        });
      }
      cells.forEach(function (cell, index) {
        const mark = board[index];
        cell.textContent = mark;
        cell.disabled = Boolean(mark) || over || thinking;
        cell.className = 'ttt-cell' +
          (mark === 'X' ? ' is-x' : mark === 'O' ? ' is-o' : '') +
          (winLine && winLine.indexOf(index) !== -1 ? ' is-win' : '');
        const row = Math.floor(index / 3) + 1;
        const col = (index % 3) + 1;
        cell.setAttribute('aria-label', 'Row ' + row + ', column ' + col + ', ' + (mark || 'empty'));
      });
      drawStrike();
      if (resultEl) resultEl.hidden = !over;
      if (over) {
        if (resultTitle) {
          resultTitle.textContent = mode === 'two'
            ? (winner === 'X' ? 'X wins.' : winner === 'O' ? 'O wins.' : 'A draw.')
            : (winner === 'X' ? 'You win.' : winner === 'O' ? 'Computer wins.' : 'A draw.');
        }
        if (resultCopy) resultCopy.textContent = winner ? 'Three in a row.' : 'Every square filled. Nothing wasted.';
      }
      if (statusEl) statusEl.hidden = over;
    }

    // The document calls for a strike-through line across the winning triplet.
    // The board is a square 3 x 3 grid, so the eight lines can be drawn from the
    // cell centres in percentage space and stay aligned at every board size.
    function drawStrike() {
      if (!boardEl) return;
      const previous = boardEl.querySelector('.ttt-strike');
      if (previous) previous.remove();
      if (!over || !winLine) return;
      const first = winLine[0];
      const last = winLine[2];
      const x1 = ((first % 3) * 2 + 1) / 6 * 100;
      const y1 = (Math.floor(first / 3) * 2 + 1) / 6 * 100;
      const x2 = ((last % 3) * 2 + 1) / 6 * 100;
      const y2 = (Math.floor(last / 3) * 2 + 1) / 6 * 100;
      const strike = document.createElement('span');
      strike.className = 'ttt-strike';
      strike.setAttribute('aria-hidden', 'true');
      strike.style.left = x1 + '%';
      strike.style.top = y1 + '%';
      strike.style.width = Math.hypot(x2 - x1, y2 - y1) + '%';
      strike.style.transform = 'rotate(' + (Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI) + 'deg)';
      boardEl.appendChild(strike);
    }

    function finish(mark, line) {
      over = true;
      winner = mark;
      if (window.MergeCoach) window.MergeCoach.complete('ttt');
      winLine = line;
      if (mode === 'two') {
        if (mark === 'X') twoStats.x += 1;
        else if (mark === 'O') twoStats.o += 1;
        else twoStats.draws += 1;
        saveTwoStats();
      } else {
        if (mark === 'X') stats.wins += 1;
        else if (mark === 'O') stats.losses += 1;
        else stats.draws += 1;
        saveStats();
      }
      status(mode === 'two'
        ? (mark ? mark + ' wins this round.' : 'A draw. Every square filled.')
        : (mark === 'X' ? 'You win. Three in a row.' : mark === 'O' ? 'Computer wins this round.' : 'A draw. Every square filled.'));
      render();
      if (mark === 'X' && mode !== 'two' && window.MergeCelebrate) {
        window.MergeCelebrate.play(resultCopy && resultCopy.closest('.play-win'));
      }
      if (againBtn) againBtn.focus({ preventScroll: true });
      scheduleAutoNext(againBtn, newRound);
    }

    function finishDraw() {
      finish('', null);
    }

    function applyMove(index, mark) {
      if (board[index] || over) return;
      board[index] = mark;
      if (mark === 'X') coachEvent('ttt', 'xmove', { index: index, moves: board.filter(Boolean).length });
      else coachEvent('ttt', 'reply', { index: index });
      const result = findWinner(board);
      if (result) {
        finish(result.mark, result.line);
        return;
      }
      if (full(board)) {
        finishDraw();
        return;
      }
      turn = mark === 'X' ? 'O' : 'X';
      thinking = false;
      render();
      if (mode === 'computer') {
        if (turn === 'O') {
          status('Computer is thinking…');
          scheduleAI();
        } else {
          status('Your move. You are X.');
        }
      } else {
        status(turn === 'X' ? "X's move." : "O's move.");
      }
    }

    function randomMove(state) {
      const empty = [];
      state.forEach(function (mark, index) { if (!mark) empty.push(index); });
      return empty.length ? empty[Math.floor(Math.random() * empty.length)] : null;
    }

    function winningMove(state, mark) {
      for (let i = 0; i < 9; i += 1) {
        if (state[i]) continue;
        state[i] = mark;
        const result = findWinner(state);
        state[i] = '';
        if (result) return i;
      }
      return null;
    }

    function minimax(state, isMax, depth, alpha, beta) {
      const result = findWinner(state);
      if (result) return result.mark === 'O' ? 10 - depth : depth - 10;
      if (full(state)) return 0;
      let best = isMax ? -Infinity : Infinity;
      for (let i = 0; i < 9; i += 1) {
        if (state[i]) continue;
        state[i] = isMax ? 'O' : 'X';
        const score = minimax(state, !isMax, depth + 1, alpha, beta);
        state[i] = '';
        if (isMax) {
          best = Math.max(best, score);
          alpha = Math.max(alpha, score);
        } else {
          best = Math.min(best, score);
          beta = Math.min(beta, score);
        }
        if (beta <= alpha) break;
      }
      return best;
    }

    function chooseMove() {
      if (difficulty === 'easy') {
        // Easy mostly plays the first square it likes. It can take a win now
        // and then, but it does not look for a block.
        if (Math.random() < 0.22) {
          const win = winningMove(board.slice(), 'O');
          if (win !== null) return win;
        }
        return randomMove(board);
      }
      if (difficulty === 'sharp') {
        const win = winningMove(board.slice(), 'O');
        if (win !== null) return win;
        const block = winningMove(board.slice(), 'X');
        if (block !== null) return block;
        // Sharp takes the middle or a corner, with the occasional human-like
        // lapse onto a side so every round does not follow the same script.
        if (Math.random() < 0.12) return randomMove(board);
        const strong = [];
        if (!board[4]) strong.push(4);
        [0, 2, 6, 8].forEach(function (index) { if (!board[index]) strong.push(index); });
        if (strong.length) return strong[Math.floor(Math.random() * strong.length)];
        return randomMove(board);
      }
      // Perfect play can still vary: choose randomly between equally optimal
      // moves, so the board does not follow the same script every round.
      let bestScore = -Infinity;
      let bestMoves = [];
      for (let i = 0; i < 9; i += 1) {
        if (board[i]) continue;
        board[i] = 'O';
        const score = minimax(board, false, 1, -Infinity, Infinity);
        board[i] = '';
        if (score > bestScore) {
          bestScore = score;
          bestMoves = [i];
        } else if (score === bestScore) {
          bestMoves.push(i);
        }
      }
      return bestMoves.length ? bestMoves[Math.floor(Math.random() * bestMoves.length)] : null;
    }

    function scheduleAI() {
      if (mode !== 'computer') return;
      window.clearTimeout(aiTimer);
      thinking = true;
      render();
      aiTimer = window.setTimeout(function () {
        if (current !== 'ttt' || over) return;
        thinking = false;
        const move = chooseMove();
        if (move === null) return;
        applyMove(move, 'O');
      }, 320);
    }

    function newRound() {
      cancelAutoNext();
      window.clearTimeout(aiTimer);
      board = Array(9).fill('');
      turn = 'X';
      over = false;
      winner = '';
      winLine = null;
      thinking = false;
      render();
      status(mode === 'two' ? "X's move." : 'Your move. You are X.');
    }

    function makeBoard() {
      if (!boardEl) return;
      boardEl.innerHTML = '';
      for (let i = 0; i < 9; i += 1) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'ttt-cell';
        cell.dataset.index = String(i);
        cell.addEventListener('click', function () {
          if (over || thinking || board[i]) return;
          if (mode === 'two') applyMove(i, turn);
          else if (turn === 'X') applyMove(i, 'X');
        });
        boardEl.appendChild(cell);
        cells.push(cell);
      }
    }

    if (difficultyEl) {
      difficultyEl.addEventListener('click', function (event) {
        const twoPlayer = event.target.closest('[data-ttt-mode="two"]');
        if (twoPlayer) {
          mode = 'two';
          saveMode();
          newRound();
          status('Two players. X starts.');
          return;
        }
        const button = event.target.closest('[data-ttt-difficulty]');
        if (!button) return;
        if (mode !== 'computer') {
          mode = 'computer';
          saveMode();
        }
        difficulty = button.dataset.tttDifficulty;
        saveDifficulty();
        newRound();
        status('New round. ' + AI_STYLES[difficulty].status);
      });
    }
    againBtn.addEventListener('click', newRound);
    newBtn.addEventListener('click', newRound);

    const shareBtn = $('ttt-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        const level = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        const copy = mode === 'two'
          ? (winner ? winner + ' won a two-player round of Tic Tac Toe on one phone.' : 'Our two-player Tic Tac Toe round ended in a draw.')
          : winner === 'X'
            ? 'I beat the ' + level + ' computer at Tic Tac Toe.'
            : winner === 'O'
              ? 'The ' + level + ' computer got me at Tic Tac Toe.'
              : 'I drew against the ' + level + ' computer at Tic Tac Toe.';
        shareResult('Tic Tac Toe', copy, {
          game: 'Tic Tac Toe', number: '05', kind: 'CLASSIC',
          title: winner === 'X' ? 'You win' : winner === 'O' ? (mode === 'two' ? 'O wins' : 'Computer wins') : 'A draw',
          score: mode === 'two' ? (twoStats.x + '–' + twoStats.o) : (stats.wins + '–' + stats.losses),
          label: mode === 'two' ? 'X – O' : 'WINS – LOSSES',
          meta: [level + ' computer', stats.draws + ' draws'],
          accent: '#8bbd54'
        });
      });
    }

    makeBoard();
    newRound();

    games.ttt = {
      title: title,
      activate: function () {
        render();
        if (over) scheduleAutoNext(againBtn, newRound);
        else if (mode === 'computer' && turn === 'O') scheduleAI();
        else cancelAutoNext();
      },
      deactivate: function () {
        cancelAutoNext();
        window.clearTimeout(aiTimer);
        thinking = false;
        render();
      },
      reset: function () {
        stats = { wins: 0, draws: 0, losses: 0 };
        twoStats = { x: 0, draws: 0, o: 0 };
        try {
          localStorage.removeItem(STATS_KEY);
          localStorage.removeItem(TWO_STATS_KEY);
        } catch (err) {}
        newRound();
        status('Record reset. New round.');
      }
    };
  })();

  /* ======================================================================
     Fruit Merge
     ====================================================================== */

  (function fruitMerge() {
    const root = screens.fruit;
    if (!root) return;
    const canvas = $('fruit-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const scoreEl = $('fruit-score');
    const bestEl = $('fruit-best');
    const nextDot = $('fruit-next-dot');
    const nextName = $('fruit-next-name');
    const statusEl = $('fruit-status');
    const overlay = $('fruit-over');
    const finalScore = $('fruit-final-score');
    const finalBest = $('fruit-final-best');
    const againBtn = $('fruit-again');
    const newBtn = $('fruit-new');
    const title = $('fruit-title');
    const BEST_KEY = 'merge-games.fruit.best.v3';

    const W = 360;
    const H = 450;
    const LEFT = 16;
    const RIGHT = W - 16;
    const BOTTOM = H - 10;
    const TOP = 22;
    const DANGER = 112;
    const GRAVITY = 1200;
    const DROP_LOCK = 0.4;
    const DANGER_GRACE = 1.15;
    /* Suika scores the pair being consumed using triangular values:
       cherries pay 1, strawberries 3, and so on up to 66 for two watermelons. */
    const SCORES = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];

    /* The canonical eleven-fruit chain. Radii rise with the rank so the
       physics naturally makes larger fruit take more space. */
    const FRUITS = [
      { name: 'Cherry', color: '#ca4b55', light: '#f0918d', deep: '#872a35', r: 13 },
      { name: 'Strawberry', color: '#d9565c', light: '#f4a09b', deep: '#962a38', r: 16 },
      { name: 'Grapes', color: '#8e63b2', light: '#cba7e1', deep: '#5c397a', r: 20 },
      { name: 'Dekopon', color: '#e58a35', light: '#f5be69', deep: '#a55418', r: 24 },
      { name: 'Persimmon', color: '#e07b2c', light: '#f5ad5b', deep: '#a54b13', r: 29 },
      { name: 'Apple', color: '#c64d43', light: '#ee8e78', deep: '#842c2d', r: 34 },
      { name: 'Pear', color: '#9cac47', light: '#d4de87', deep: '#627326', r: 40 },
      { name: 'Peach', color: '#e58c80', light: '#f7bdae', deep: '#a65350', r: 46 },
      { name: 'Pineapple', color: '#d6a62d', light: '#f1d064', deep: '#966b1c', r: 52 },
      { name: 'Melon', color: '#8fae5b', light: '#d0e19f', deep: '#5a7533', r: 58 },
      { name: 'Watermelon', color: '#408454', light: '#7db78b', deep: '#215b38', r: 65 }
    ];

    // Keep the hand-picked fruit colours and recolour copies when the palette
    // changes, so the canvas follows the same six choices as Merge.
    const FRUIT_BASE = FRUITS.map(function (fruit) { return Object.assign({}, fruit); });

    function syncPalette() {
      // Fruit has its own natural colours. The app palette may recolour the
      // board, tubes and chrome, but a cherry should never turn teal.
      FRUITS.forEach(function (fruit, index) {
        const base = FRUIT_BASE[index];
        fruit.color = base.color;
        fruit.light = base.light;
        fruit.deep = base.deep;
      });
    }

    let fruits = [];
    let effects = [];
    let score = 0;
    let best = Number(load(BEST_KEY, 0)) || 0;
    let nextTier = 0;
    let aimX = W / 2;
    let over = false;
    let running = false;
    let raf = 0;
    let lastTime = 0;
    let dropLock = 0;
    let pointer = null;
    let nearTop = false;
    let warningShown = false;
    let ui = {};
    let dpr = 1;

    function readUi() {
      const computed = getComputedStyle(document.documentElement);
      ui = {
        page: computed.getPropertyValue('--page').trim() || '#f6f1e8',
        panel: computed.getPropertyValue('--panel').trim() || '#e4d9c7',
        card: computed.getPropertyValue('--card').trim() || 'rgba(255,255,255,.8)',
        ink: computed.getPropertyValue('--ink').trim() || '#3b3833',
        muted: computed.getPropertyValue('--muted').trim() || '#6f665a',
        warn: computed.getPropertyValue('--warn').trim() || '#c94b35',
        line: computed.getPropertyValue('--line').trim() || 'rgba(94,76,45,.12)'
      };
    }

    function setupCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.aspectRatio = W + ' / ' + H;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function randomTier() {
      /* Smaller fruit dominate the queue so an early run does not get buried
         under three large drops in a row. Large fruit still appear; they are
         simply rarer, as in a tuned Suika-style opening. */
      const weights = [20, 22, 22, 19, 17];
      let roll = Math.random() * 100;
      for (let i = 0; i < weights.length; i += 1) {
        roll -= weights[i];
        if (roll < 0) return i;
      }
      return 0;
    }

    function saveBest() {
      save(BEST_KEY, best);
    }

    function setStatus(message) {
      if (statusEl && statusEl.textContent !== message) statusEl.textContent = message;
    }

    function updateHud() {
      if (scoreEl) scoreEl.textContent = String(score);
      if (bestEl) bestEl.textContent = String(best);
      const fruit = FRUITS[nextTier];
      if (nextDot) {
        nextDot.style.background = 'radial-gradient(circle at 32% 28%, ' + fruit.light + ', ' + fruit.color + ' 58%, ' + fruit.deep + ')';
        nextDot.style.boxShadow = 'inset -2px -3px 0 rgba(0,0,0,.14)';
      }
      if (nextName) nextName.textContent = fruit.name;
      canvas.setAttribute('aria-label', 'Fruit Merge board. Score ' + score +
        '. Next fruit: ' + fruit.name + '. Drag to aim, release to drop. Arrow keys aim, space drops.');
    }

    function newRun() {
      cancelAutoNext();
      fruits = [];
      effects = [];
      score = 0;
      nextTier = randomTier();
      aimX = W / 2;
      over = false;
      dropLock = 0;
      nearTop = false;
      warningShown = false;
      drag = null;
      if (overlay) overlay.hidden = true;
      if (finalScore) finalScore.textContent = '0';
      if (finalBest) finalBest.textContent = String(best);
      updateHud();
      if (statusEl) statusEl.hidden = false;
      setStatus('Drag to aim. Release to drop. Match two of the same fruit.');
      render(0);
    }

    function startLoop() {
      if (running) return;
      running = true;
      lastTime = 0;
      raf = window.requestAnimationFrame(loop);
    }

    function stopLoop() {
      running = false;
      window.cancelAnimationFrame(raf);
    }

    /* True when nothing is moving and no merge effect is still playing. */
    function atRest() {
      if (effects.length || dropLock > 0) return false;
      for (let i = 0; i < fruits.length; i += 1) {
        const fruit = fruits[i];
        if (Math.abs(fruit.vx) + Math.abs(fruit.vy) > 4) return false;
      }
      return true;
    }

    function loop(time) {
      if (!running) return;
      const delta = lastTime ? Math.min(0.033, (time - lastTime) / 1000) : 0.016;
      lastTime = time;
      step(delta);
      render(delta);
      /* A settled board needs no more frames. The next drop wakes the loop, so
         an idle game no longer holds a 60 fps draw loop open. */
      if (atRest()) {
        stopLoop();
        return;
      }
      raf = window.requestAnimationFrame(loop);
    }

    function makeFruit(tier, x, y) {
      return {
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        r: FRUITS[tier].r,
        tier: tier,
        age: 0,
        mergeLock: 0,
        angle: (Math.random() - 0.5) * 0.3,
        spin: 0,
        dangerTime: 0,
        dead: false
      };
    }

    function resolvePair(a, b) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minimum = a.r + b.r;
      let distance = Math.hypot(dx, dy);
      if (distance >= minimum) return;
      if (distance < 0.001) distance = 0.001;
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = minimum - distance;
      const invA = 1 / (a.r * a.r);
      const invB = 1 / (b.r * b.r);
      const total = invA + invB;
      a.x -= nx * overlap * (invA / total);
      a.y -= ny * overlap * (invA / total);
      b.x += nx * overlap * (invB / total);
      b.y += ny * overlap * (invB / total);

      const relativeX = b.vx - a.vx;
      const relativeY = b.vy - a.vy;
      const along = relativeX * nx + relativeY * ny;
      if (along < 0) {
        const impulse = -(1.04) * along / total;
        a.vx -= impulse * nx * invA;
        a.vy -= impulse * ny * invA;
        b.vx += impulse * nx * invB;
        b.vy += impulse * ny * invB;
      }
      const tangentX = -ny;
      const tangentY = nx;
      const tangentSpeed = relativeX * tangentX + relativeY * tangentY;
      const friction = tangentSpeed * 0.2;
      a.vx += friction * tangentX * (invA / total);
      a.vy += friction * tangentY * (invA / total);
      b.vx -= friction * tangentX * (invB / total);
      b.vy -= friction * tangentY * (invB / total);
    }

    function addMergeEffect(a, b, tier, points) {
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      effects.push({ type: 'ring', x: x, y: y, r: Math.max(a.r, b.r), tier: tier, life: 0.42, max: 0.42 });
      for (let i = 0; i < 9; i += 1) {
        const angle = (Math.PI * 2 * i) / 9 + Math.random() * 0.4;
        const speed = 48 + Math.random() * 90;
        effects.push({
          type: 'spark', x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 30,
          r: 1.6 + Math.random() * 2.2, life: 0.38 + Math.random() * 0.25, max: 0.63, tier: tier
        });
      }
      effects.push({
        type: 'score', x: x, y: y - 8, text: '+' + points, life: 0.72, max: 0.72, tier: tier
      });
    }

    /* A larger fruit displaces the fruit around the contact point. This is a
       velocity impulse rather than a position nudge, so chain reactions can
       travel through a settled pile. */
    function scatterNeighbours(merged, first, second) {
      const growth = Math.max(2, merged.r - Math.max(first.r, second.r));
      const reach = merged.r + 8;
      fruits.forEach(function (other) {
        if (other === merged || other.dead) return;
        const dx = other.x - merged.x;
        const dy = other.y - merged.y;
        const distance = Math.hypot(dx, dy);
        if (distance > reach + other.r) return;
        const nx = distance > 0.001 ? dx / distance : 0;
        const ny = distance > 0.001 ? dy / distance : -1;
        const falloff = clamp(1 - distance / (reach + other.r), 0, 1);
        const push = growth * 18 * falloff;
        other.vx += nx * push;
        other.vy += ny * push;
      });
    }

    function mergePair(a, b, pending) {
      if (a.dead || b.dead) return;
      a.dead = true;
      b.dead = true;
      const newTier = a.tier + 1;
      const finalClear = newTier >= FRUITS.length;
      const points = SCORES[a.tier];
      const x = clamp((a.x + b.x) / 2, LEFT + FRUITS[Math.min(newTier, FRUITS.length - 1)].r, RIGHT - FRUITS[Math.min(newTier, FRUITS.length - 1)].r);
      const y = clamp((a.y + b.y) / 2, TOP + FRUITS[Math.min(newTier, FRUITS.length - 1)].r, BOTTOM - FRUITS[Math.min(newTier, FRUITS.length - 1)].r);
      pending.push({ tier: newTier, x: x, y: y, a: a, b: b });
      addMergeEffect(a, b, newTier, points);
      score += points;
      if (newTier === FRUITS.length - 1) {
        setStatus('Watermelon! You reached the top of the fruit chain.');
        if (window.MergeHaptics) window.MergeHaptics.win();
        if (window.MergeCelebrate) window.MergeCelebrate.play(document.querySelector('.fruit-stage'));
      }
      if (finalClear) {
        setStatus('Two watermelons cleared — +' + points + '!');
      }
      if (score > best) {
        best = score;
        saveBest();
      }
      updateHud();
      coachEvent('fruit', 'merge', { tier: newTier });
      if (window.MergeHaptics) window.MergeHaptics.merge(newTier * 40);
    }

    function step(delta) {
      effects = effects.filter(function (effect) {
        effect.life -= delta;
        if (effect.type === 'spark') {
          effect.x += effect.vx * delta;
          effect.y += effect.vy * delta;
          effect.vy += 260 * delta;
          effect.vx *= 0.98;
        }
        return effect.life > 0;
      });

      if (over) return;
      dropLock = Math.max(0, dropLock - delta);

      fruits.forEach(function (fruit) {
        fruit.age += delta;
        fruit.mergeLock = Math.max(0, fruit.mergeLock - delta);
        fruit.vy += GRAVITY * delta;
        fruit.x += fruit.vx * delta;
        fruit.y += fruit.vy * delta;
        fruit.vx *= 0.998;
        fruit.spin += fruit.vx * delta * 0.018;
        fruit.angle += fruit.spin * delta;
        if (fruit.x - fruit.r < LEFT) {
          fruit.x = LEFT + fruit.r;
          fruit.vx = Math.abs(fruit.vx) * 0.18;
          fruit.spin *= 0.7;
        } else if (fruit.x + fruit.r > RIGHT) {
          fruit.x = RIGHT - fruit.r;
          fruit.vx = -Math.abs(fruit.vx) * 0.18;
          fruit.spin *= 0.7;
        }
        if (fruit.y + fruit.r > BOTTOM) {
          fruit.y = BOTTOM - fruit.r;
          if (fruit.vy > 0) fruit.vy *= -0.1;
          fruit.vx *= 0.9;
          fruit.spin *= 0.8;
          if (Math.abs(fruit.vy) < 7) fruit.vy = 0;
        }
      });

      const pending = [];
      for (let pass = 0; pass < 5; pass += 1) {
        for (let i = 0; i < fruits.length; i += 1) {
          const a = fruits[i];
          if (a.dead) continue;
          for (let j = i + 1; j < fruits.length; j += 1) {
            const b = fruits[j];
            if (b.dead) continue;
            const distance = Math.hypot(b.x - a.x, b.y - a.y);
            if (distance >= a.r + b.r) continue;
            if (a.tier === b.tier && a.mergeLock <= 0 && b.mergeLock <= 0 && a.age > 0.1 && b.age > 0.1) {
              mergePair(a, b, pending);
            } else if (!a.dead && !b.dead) {
              resolvePair(a, b);
            }
          }
        }
      }

      pending.forEach(function (item) {
        if (item.tier < FRUITS.length) {
          const fruit = makeFruit(item.tier, item.x, item.y);
          fruit.vx = (item.a.vx + item.b.vx) * 0.38;
          fruit.vy = Math.min((item.a.vy + item.b.vy) * 0.38, 70);
          fruit.mergeLock = 0.16;
          fruits.push(fruit);
          scatterNeighbours(fruit, item.a, item.b);
        }
      });
      fruits = fruits.filter(function (fruit) { return !fruit.dead; });

      nearTop = fruits.some(function (fruit) { return fruit.age > 0.8 && fruit.y - fruit.r < DANGER + 26; });
      fruits.forEach(function (fruit) {
        const speed = Math.hypot(fruit.vx, fruit.vy);
        if (fruit.age > 0.85 && fruit.y - fruit.r < DANGER && speed < 150) {
          fruit.dangerTime += delta;
        } else if (fruit.age > 0.2) {
          fruit.dangerTime = Math.max(0, fruit.dangerTime - delta * 1.6);
        }
      });
      if (fruits.some(function (fruit) { return fruit.dangerTime > DANGER_GRACE; })) {
        endRun();
        return;
      }

      if (nearTop && !warningShown) {
        warningShown = true;
        setStatus('Careful — the pile is close to the top.');
      } else if (!nearTop && warningShown) {
        warningShown = false;
        setStatus('Room again. Keep building pairs.');
      }
      if (fruits.length > 64) fruits = fruits.slice(-64);
    }

    function endRun() {
      if (over) return;
      over = true;
      if (window.MergeCoach) window.MergeCoach.complete('fruit');
      if (overlay) overlay.hidden = false;
      if (finalScore) finalScore.textContent = String(score);
      if (finalBest) finalBest.textContent = String(best);
      setStatus('The pile reached the top. Start a fresh run.');
      if (statusEl) statusEl.hidden = true;
      if (window.MergeHaptics) window.MergeHaptics.over();
      render(0);
      if (againBtn) againBtn.focus({ preventScroll: true });
      scheduleAutoNext(againBtn, beginNewRun);
    }

    function roundedPath(x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function drawBackground() {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.fillStyle = ui.page;
      ctx.fillRect(0, 0, W, H);

      roundedPath(LEFT - 2, TOP - 12, RIGHT - LEFT + 4, BOTTOM - TOP + 18, 20);
      ctx.fillStyle = ui.panel;
      ctx.shadowColor = 'rgba(70, 48, 22, 0.2)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 12;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = ui.line;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const inner = ctx.createLinearGradient(0, TOP, 0, BOTTOM);
      inner.addColorStop(0, ui.page);
      inner.addColorStop(1, ui.card);
      roundedPath(LEFT + 4, TOP + 2, RIGHT - LEFT - 8, BOTTOM - TOP + 2, 15);
      ctx.fillStyle = inner;
      ctx.fill();

      // Glass: a broad soft sheen down each side, a bright rim and a thicker
      // base lip. Kept as paint, not blur, so it stays cheap on phones.
      const glass = ctx.createLinearGradient(LEFT, 0, RIGHT, 0);
      glass.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
      glass.addColorStop(0.12, 'rgba(255, 255, 255, 0.07)');
      glass.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
      glass.addColorStop(0.86, 'rgba(255, 255, 255, 0.05)');
      glass.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
      roundedPath(LEFT + 4, TOP + 2, RIGHT - LEFT - 8, BOTTOM - TOP + 2, 15);
      ctx.fillStyle = glass;
      ctx.fill();

      roundedPath(LEFT + 6, TOP + 4, RIGHT - LEFT - 12, BOTTOM - TOP - 2, 13);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      roundedPath(LEFT + 18, BOTTOM - 6, RIGHT - LEFT - 36, 8, 4);
      ctx.fillStyle = 'rgba(94, 76, 45, 0.07)';
      ctx.fill();

      if (nearTop) {
        const warning = ctx.createLinearGradient(0, TOP, 0, DANGER + 34);
        warning.addColorStop(0, 'rgba(201, 75, 53, 0.16)');
        warning.addColorStop(1, 'rgba(201, 75, 53, 0)');
        ctx.fillStyle = warning;
        ctx.fillRect(LEFT + 4, TOP + 2, RIGHT - LEFT - 8, DANGER - TOP + 32);
      }

      ctx.strokeStyle = nearTop ? ui.warn : 'rgba(201, 75, 53, 0.48)';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(LEFT + 8, DANGER);
      ctx.lineTo(RIGHT - 8, DANGER);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = nearTop ? ui.warn : ui.muted;
      ctx.font = '800 8px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(nearTop ? 'DANGER — MERGE TO MAKE ROOM' : 'KEEP BELOW', LEFT + 12, DANGER - 7);
      ctx.restore();
    }

    function drawLeaf(x, y, r, flip) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(flip ? 0.55 : -0.55);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.34, r * 0.13, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#5d8d4f';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }

    function drawFace(r, tier) {
      if (r < 16) return;
      const eye = Math.max(1.2, r * 0.052);
      const eyeY = -r * 0.08;
      const eyeX = r * 0.22;
      ctx.fillStyle = 'rgba(47, 35, 28, 0.72)';
      ctx.beginPath();
      ctx.arc(-eyeX, eyeY, eye, 0, Math.PI * 2);
      ctx.arc(eyeX, eyeY, eye, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(47, 35, 28, 0.55)';
      ctx.lineWidth = Math.max(1, r * 0.035);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, r * 0.13, r * 0.1, 0.2, Math.PI - 0.2);
      ctx.stroke();
      if (tier >= 8) {
        ctx.fillStyle = 'rgba(255, 214, 190, 0.45)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.33, r * 0.2, r * 0.1, r * 0.045, 0, 0, Math.PI * 2);
        ctx.ellipse(r * 0.33, r * 0.2, r * 0.1, r * 0.045, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawFruit(fruit) {
      const def = FRUITS[fruit.tier];
      const r = fruit.r;
      ctx.save();
      ctx.translate(fruit.x, fruit.y);
      ctx.rotate(fruit.angle || 0);

      ctx.beginPath();
      ctx.ellipse(0, r * 0.86, r * 0.78, r * 0.16, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(60, 42, 24, 0.12)';
      ctx.fill();

      const gradient = ctx.createRadialGradient(-r * 0.38, -r * 0.44, r * 0.08, 0, 0, r * 1.08);
      gradient.addColorStop(0, def.light);
      gradient.addColorStop(0.56, def.color);
      gradient.addColorStop(1, def.deep);

      ctx.beginPath();
      if (fruit.tier === 1) {
        ctx.moveTo(0, -r * 0.92);
        ctx.bezierCurveTo(r * 0.92, -r * 0.8, r * 0.86, r * 0.63, 0, r * 0.88);
        ctx.bezierCurveTo(-r * 0.86, r * 0.63, -r * 0.92, -r * 0.8, 0, -r * 0.92);
      } else if (fruit.tier === 5) {
        ctx.moveTo(0, -r * 0.94);
        ctx.bezierCurveTo(r * 0.76, -r * 0.8, r * 0.98, -r * 0.02, r * 0.78, r * 0.45);
        ctx.bezierCurveTo(r * 0.58, r * 0.93, -r * 0.58, r * 0.93, -r * 0.78, r * 0.45);
        ctx.bezierCurveTo(-r * 0.98, -r * 0.02, -r * 0.76, -r * 0.8, 0, -r * 0.94);
      } else if (fruit.tier === 6) {
        ctx.moveTo(0, -r * 0.68);
        ctx.bezierCurveTo(r * 0.42, -r * 0.98, r * 0.92, -r * 0.58, r * 0.82, r * 0.27);
        ctx.bezierCurveTo(r * 0.72, r * 0.88, -r * 0.72, r * 0.88, -r * 0.82, r * 0.27);
        ctx.bezierCurveTo(-r * 0.92, -r * 0.58, -r * 0.42, -r * 0.98, 0, -r * 0.68);
      } else if (fruit.tier === 8) {
        ctx.ellipse(0, 0, r * 0.78, r * 0.98, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(0, 0, r, 0, Math.PI * 2);
      }
      if (fruit.tier !== 2) {
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = 'rgba(57, 39, 24, 0.18)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        // A dark, opaque body behind the individual grapes closes the little
        // transparent gaps between them without changing the bunch silhouette.
        ctx.beginPath();
        ctx.ellipse(0, r * 0.02, r * 0.72, r * 0.78, 0, 0, Math.PI * 2);
        ctx.fillStyle = def.deep;
        ctx.fill();
      }

      if (fruit.tier === 1) {
        ctx.fillStyle = 'rgba(255, 235, 190, 0.7)';
        for (let i = 0; i < 7; i += 1) {
          const angle = (Math.PI * 2 * i) / 7 + 0.3;
          ctx.beginPath();
          ctx.ellipse(Math.cos(angle) * r * 0.38, Math.sin(angle) * r * 0.3 + r * 0.08, r * 0.035, r * 0.075, angle, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#4f7e3d';
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.72);
        ctx.lineTo(-r * 0.12, -r * 0.94);
        ctx.lineTo(0, -r * 0.7);
        ctx.lineTo(r * 0.16, -r * 0.97);
        ctx.lineTo(r * 0.54, -r * 0.72);
        ctx.lineTo(r * 0.18, -r * 0.56);
        ctx.lineTo(0, -r * 0.75);
        ctx.lineTo(-r * 0.18, -r * 0.56);
        ctx.closePath();
        ctx.fill();
      }

      if (fruit.tier === 2) {
        // A compact bunch: overlapping shaded grapes instead of one purple ball.
        const grapes = [
          [-0.30, -0.38], [0.02, -0.46], [0.32, -0.36],
          [-0.46, -0.12], [-0.14, -0.14], [0.20, -0.12], [0.45, -0.08],
          [-0.32, 0.20], [0.02, 0.24], [0.34, 0.18],
          [-0.10, 0.46]
        ];
        grapes.forEach(function (grape, i) {
          const gx = grape[0] * r;
          const gy = grape[1] * r;
          const gr = r * (0.225 + (i % 3) * 0.012);
          const gg = ctx.createRadialGradient(gx - gr * 0.35, gy - gr * 0.42, gr * 0.08, gx, gy, gr);
          gg.addColorStop(0, def.light);
          gg.addColorStop(0.62, def.color);
          gg.addColorStop(1, def.deep);
          ctx.beginPath();
          ctx.arc(gx, gy, gr, 0, Math.PI * 2);
          ctx.fillStyle = gg;
          ctx.fill();
          ctx.strokeStyle = 'rgba(53, 30, 72, 0.2)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        });
        ctx.strokeStyle = '#5c7d3c';
        ctx.lineWidth = Math.max(1.2, r * 0.06);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.55);
        ctx.quadraticCurveTo(r * 0.08, -r * 0.92, r * 0.28, -r * 0.86);
        ctx.stroke();
        drawLeaf(r * 0.46, -r * 0.78, r, true);
      }

      if (fruit.tier === 3 || fruit.tier === 4) {
        ctx.strokeStyle = 'rgba(80, 48, 17, 0.2)';
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.82);
          ctx.quadraticCurveTo(i * r * 0.24, 0, 0, r * 0.84);
          ctx.stroke();
        }
        drawLeaf(r * 0.55, -r * 0.78, r, true);
      }

      if (fruit.tier === 7) {
        ctx.strokeStyle = 'rgba(130, 56, 54, 0.24)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.82);
        ctx.quadraticCurveTo(r * 0.25, 0, 0, r * 0.82);
        ctx.stroke();
        drawLeaf(-r * 0.55, -r * 0.78, r, false);
      }

      if (fruit.tier === 9) {
        ctx.strokeStyle = 'rgba(63, 104, 35, 0.3)';
        ctx.lineWidth = 1.5;
        for (let i = -2; i <= 2; i += 1) {
          ctx.beginPath();
          ctx.moveTo(i * r * 0.28, -r * 0.75);
          ctx.quadraticCurveTo(i * r * 0.42, 0, i * r * 0.28, r * 0.75);
          ctx.stroke();
        }
        drawLeaf(r * 0.5, -r * 0.78, r, true);
      }

      if (fruit.tier === 10) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.99, 0, Math.PI * 2);
        ctx.clip();
        ctx.strokeStyle = 'rgba(18, 61, 33, 0.58)';
        ctx.lineWidth = r * 0.055;
        for (let i = -2; i <= 2; i += 1) {
          ctx.beginPath();
          ctx.arc(i * r * 0.34, 0, r * 0.95, -0.65, 0.65);
          ctx.stroke();
        }
        ctx.restore();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.985, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(18, 61, 33, 0.3)';
        ctx.lineWidth = r * 0.07;
        ctx.stroke();
        ctx.strokeStyle = '#5c7d3c';
        ctx.lineWidth = Math.max(1.6, r * 0.055);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.06, -r * 0.94);
        ctx.quadraticCurveTo(r * 0.3, -r * 1.18, r * 0.02, -r * 1.28);
        ctx.stroke();
        drawLeaf(r * 0.42, -r * 1.02, r, true);
      }

      if (fruit.tier === 8) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.77, r * 0.97, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.strokeStyle = 'rgba(250, 225, 120, 0.4)';
        ctx.lineWidth = 1.15;
        for (let i = -5; i <= 5; i += 1) {
          ctx.beginPath();
          ctx.moveTo(-r, i * r * 0.24 - r * 0.4);
          ctx.lineTo(r, i * r * 0.24 + r * 0.4);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-r, i * r * 0.24 + r * 0.4);
          ctx.lineTo(r, i * r * 0.24 - r * 0.4);
          ctx.stroke();
        }
        ctx.restore();

        // A proper five-leaf crown, wider than the old tuft.
        ctx.fillStyle = 'rgba(71, 113, 41, 0.95)';
        for (let i = 0; i < 5; i += 1) {
          const lean = (i - 2) * r * 0.17;
          ctx.beginPath();
          ctx.moveTo(lean * 0.4, -r * 0.78);
          ctx.quadraticCurveTo(lean * 1.2, -r * 1.22, lean, -r * 1.04);
          ctx.quadraticCurveTo(lean - r * 0.09, -r * 1.26, lean * 0.4, -r * 0.78);
          ctx.fill();
        }
      }

      if (fruit.tier === 0) {
        // Two cherries sharing the one physics circle.
        ctx.beginPath();
        ctx.arc(-r * 0.44, r * 0.22, r * 0.56, 0, Math.PI * 2);
        ctx.fillStyle = def.deep;
        ctx.fill();
        ctx.strokeStyle = 'rgba(57, 39, 24, 0.2)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(-r * 0.6, r * 0.05, r * 0.16, r * 0.07, -0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
        ctx.fill();

        ctx.strokeStyle = '#5c7d3c';
        ctx.lineWidth = Math.max(1.4, r * 0.085);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r * 0.12, -r * 0.72);
        ctx.quadraticCurveTo(-r * 0.08, -r * 1.38, r * 0.48, -r * 1.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.42, -r * 0.12);
        ctx.quadraticCurveTo(-r * 0.58, -r * 1.06, r * 0.46, -r * 1.3);
        ctx.stroke();
        drawLeaf(r * 0.55, -r * 1.16, r * 0.8, true);
      } else if (fruit.tier !== 2 && fruit.tier !== 3 && fruit.tier !== 4 && fruit.tier < 9) {
        ctx.strokeStyle = '#6f7f45';
        ctx.lineWidth = Math.max(1.3, r * 0.06);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.82);
        ctx.quadraticCurveTo(r * 0.1, -r * 1.08, r * 0.24, -r * 1.02);
        ctx.stroke();
        drawLeaf(r * 0.28, -r * 0.97, r * 0.8, true);
      }

      ctx.beginPath();
      ctx.ellipse(-r * 0.42, -r * 0.4, r * 0.24, r * 0.1, -0.65, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.38)';
      ctx.fill();

      ctx.restore();
    }

    function drawGuide() {
      if (over) return;
      const tier = nextTier;
      const r = FRUITS[tier].r;
      const x = clamp(aimX, LEFT + r, RIGHT - r);
      ctx.save();
      ctx.strokeStyle = 'rgba(111, 102, 90, 0.24)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 7]);
      ctx.beginPath();
      ctx.moveTo(x, 38 + r);
      ctx.lineTo(x, BOTTOM - 8);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.globalAlpha = 0.65;
      const ghost = { x: x, y: 44, r: r, tier: tier, angle: 0 };
      drawFruit(ghost);
      ctx.globalAlpha = 1;
      ctx.fillStyle = ui.muted;
      ctx.font = '800 8px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.restore();
    }

    function drawEffects() {
      effects.forEach(function (effect) {
        const alpha = Math.max(0, effect.life / effect.max);
        ctx.save();
        ctx.globalAlpha = alpha;
        if (effect.type === 'ring') {
          ctx.strokeStyle = FRUITS[Math.min(effect.tier, FRUITS.length - 1)].light;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.r + (1 - alpha) * 28, 0, Math.PI * 2);
          ctx.stroke();
        } else if (effect.type === 'spark') {
          ctx.fillStyle = FRUITS[Math.min(effect.tier, FRUITS.length - 1)].light;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (effect.type === 'score') {
          ctx.fillStyle = ui.ink;
          ctx.font = '800 12px ui-sans-serif, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(effect.text, effect.x, effect.y - (1 - alpha) * 22);
        }
        ctx.restore();
      });
    }

    function render() {
      drawBackground();
      fruits.forEach(drawFruit);
      drawEffects();
      drawGuide();
    }

    function aimFromEvent(event) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      aimX = clamp(((event.clientX - rect.left) / rect.width) * W, 0, W);
      render();
    }

    function dropFruit() {
      if (over || dropLock > 0) {
        if (!over && dropLock > 0) setStatus('Let the last fruit settle for a moment.');
        return;
      }
      const tier = nextTier;
      const r = FRUITS[tier].r;
      const x = clamp(aimX, LEFT + r, RIGHT - r);
      const fruit = makeFruit(tier, x, 34);
      fruit.vy = 60;
      fruit.mergeLock = 0.12;
      fruits.push(fruit);
      nextTier = randomTier();
      dropLock = DROP_LOCK;
      updateHud();
      startLoop();
      setStatus('Dropped a ' + FRUITS[tier].name.toLowerCase() + '. Pair it with another.');
      coachEvent('fruit', 'drop');
      if (window.MergeHaptics) window.MergeHaptics.merge(20);
      render();
    }

    function beginNewRun() {
      cancelAutoNext();
      newRun();
      startLoop();
      setStatus('Fresh fruit. Drag to aim, release to drop.');
    }

    let drag = null;
    canvas.addEventListener('pointerdown', function (event) {
      if (over) return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      aimFromEvent(event);
      coachEvent('fruit', 'aim');
      try { canvas.setPointerCapture(event.pointerId); } catch (err) {}
    });
    canvas.addEventListener('pointermove', function (event) {
      if (over) return;
      if (drag && event.pointerId === drag.id) {
        aimFromEvent(event);
      } else if (event.pointerType === 'mouse' && !drag) {
        aimFromEvent(event);
      }
    });
    canvas.addEventListener('pointerup', function (event) {
      if (over) return;
      if (drag && event.pointerId === drag.id) {
        aimFromEvent(event);
        drag = null;
        dropFruit();
      }
    });
    canvas.addEventListener('pointercancel', function () { drag = null; });

    document.addEventListener('keydown', function (event) {
      if (current !== 'fruit' || event.defaultPrevented || document.documentElement.classList.contains('sheet-open')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target && target.closest && target.closest('button, a, input, textarea, select')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const step = event.key === 'ArrowLeft' ? -10 : 10;
        aimX = clamp(aimX + step, 0, W);
        render();
        coachEvent('fruit', 'aim');
      } else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (!over) dropFruit();
      } else if (event.key === 'r' || event.key === 'R' || event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        beginNewRun();
      }
    });

    againBtn.addEventListener('click', beginNewRun);
    newBtn.addEventListener('click', beginNewRun);

    const shareBtn = $('fruit-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        shareResult('Fruit Merge', 'I scored ' + score + ' in Fruit Merge. My best is ' + best + '. Can you beat it?', {
          game: 'Fruit Merge', number: '04', kind: 'MERGING',
          title: 'Run complete',
          score: score,
          label: 'POINTS',
          meta: ['Best ' + best, 'Endless mode'],
          accent: '#e3b94a'
        });
      });
    }

    window.addEventListener('merge:appearance', function () {
      syncPalette();
      readUi();
      updateHud();
      if (current === 'fruit') render();
    });
    window.addEventListener('resize', function () {
      setupCanvas();
      if (current === 'fruit') render();
    });

    /* A hidden tab gets no animation frames; a visible one picks the loop up
       again only while this game is the open screen. */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopLoop();
      } else if (current === 'fruit') {
        startLoop();
        render();
      }
    });

    syncPalette();
    readUi();
    setupCanvas();
    newRun();
    render();
    games.fruit = {
      title: title,
      activate: function () {
        readUi();
        setupCanvas();
        updateHud();
        render();
        startLoop();
        if (over) scheduleAutoNext(againBtn, beginNewRun);
        else cancelAutoNext();
      },
      deactivate: function () {
        cancelAutoNext();
        stopLoop();
        drag = null;
      },
      reset: function () {
        best = 0;
        try { localStorage.removeItem(BEST_KEY); } catch (err) {}
        if (bestEl) bestEl.textContent = '0';
        if (finalBest) finalBest.textContent = '0';
        beginNewRun();
        setStatus('Best score reset. Fresh run.');
      }
    };
  })();

  /* ======================================================================
     Minesweeper
     ====================================================================== */

  (function minesweeper() {
    const root = screens.mines;
    if (!root) return;
    const boardEl = $('mines-board');
    const statusEl = $('mines-status');
    const resultEl = $('mines-result');
    const resultTitle = $('mines-result-title');
    const resultCopy = $('mines-result-copy');
    const againBtn = $('mines-again');
    const newBtn = $('mines-new');
    const difficultyEl = $('mines-difficulty');
    const flagBtn = $('mines-flag-toggle');
    const leftEl = $('mines-left');
    const timeEl = $('mines-time');
    const levelTag = $('mines-level-tag');
    const title = $('mines-title');
    const DIFFICULTY_KEY = 'merge-games.mines.difficulty.v1';
    const LEVELS = {
      easy: { label: 'Beginner', cols: 9, rows: 9, mines: 10 },
      medium: { label: 'Intermediate', cols: 16, rows: 16, mines: 40 },
      hard: { label: 'Expert', cols: 30, rows: 16, mines: 99 }
    };
    const NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const savedDifficulty = load(DIFFICULTY_KEY, null);
    let difficulty = savedDifficulty && LEVELS[savedDifficulty.difficulty] ? savedDifficulty.difficulty : 'easy';
    let cols = LEVELS[difficulty].cols;
    let rows = LEVELS[difficulty].rows;
    let mineCount = LEVELS[difficulty].mines;
    let cells = [];
    let started = false;
    let over = false;
    let won = false;
    let flags = 0;
    let moves = 0;
    let revealed = 0;
    let timerStartedAt = 0;
    let timerElapsed = 0;
    let timerInterval = 0;
    let flagMode = false;
    let focusIndex = 0;
    let longPressTimer = 0;
    let longPressIndex = -1;
    let pointerStart = null;
    let suppressClick = false;
    let cellButtons = [];
    let explodedIndex = -1;

    function currentLevel() {
      return LEVELS[difficulty];
    }

    function indexOf(row, col) {
      return row * cols + col;
    }

    function neighbours(index) {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const result = [];
      for (let r = row - 1; r <= row + 1; r += 1) {
        for (let c = col - 1; c <= col + 1; c += 1) {
          if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
          if (r === row && c === col) continue;
          result.push(indexOf(r, c));
        }
      }
      return result;
    }

    function status(message) {
      if (statusEl) statusEl.textContent = message;
    }

    function formatTime(ms) {
      const seconds = Math.floor(ms / 1000);
      return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    }

    function elapsedTime() {
      return timerElapsed + (timerStartedAt ? Date.now() - timerStartedAt : 0);
    }

    function updateTimer() {
      if (timeEl) timeEl.textContent = formatTime(elapsedTime());
    }

    function stopTimer() {
      if (timerStartedAt) {
        timerElapsed += Date.now() - timerStartedAt;
        timerStartedAt = 0;
      }
      if (timerInterval) {
        window.clearInterval(timerInterval);
        timerInterval = 0;
      }
    }

    function startTimer() {
      if (timerStartedAt || over) return;
      timerStartedAt = Date.now();
      updateTimer();
      timerInterval = window.setInterval(updateTimer, 250);
    }

    function clearTimer() {
      stopTimer();
      timerElapsed = 0;
      updateTimer();
    }

    function updateStats() {
      if (leftEl) leftEl.textContent = String(Math.max(0, mineCount - flags));
      updateTimer();
      if (levelTag) levelTag.textContent = currentLevel().label + ' · ' + cols + ' × ' + rows;
      if (flagBtn) {
        flagBtn.setAttribute('aria-pressed', flagMode ? 'true' : 'false');
        flagBtn.classList.toggle('is-on', flagMode);
      }
      if (difficultyEl) {
        Array.from(difficultyEl.querySelectorAll('[data-mines-difficulty]')).forEach(function (button) {
          button.setAttribute('aria-pressed', button.dataset.minesDifficulty === difficulty ? 'true' : 'false');
        });
      }
    }

    function makeBoard() {
      cells = [];
      for (let i = 0; i < cols * rows; i += 1) {
        cells.push({ mine: false, open: false, flag: false, count: 0 });
      }
      boardEl.style.setProperty('--mines-cols', String(cols));
      boardEl.style.setProperty('--mines-rows', String(rows));
      boardEl.style.aspectRatio = cols + ' / ' + rows;
      boardEl.dataset.cols = String(cols);
      boardEl.dataset.rows = String(rows);
      boardEl.setAttribute('aria-label', currentLevel().label + ' Minesweeper board, ' + cols + ' columns by ' + rows + ' rows');
      boardEl.innerHTML = '';
      boardEl.setAttribute('aria-rowcount', String(rows));
      boardEl.setAttribute('aria-colcount', String(cols));
      cellButtons = [];
      let rowEl = null;
      for (let i = 0; i < cells.length; i += 1) {
        if (i % cols === 0) {
          rowEl = document.createElement('div');
          rowEl.className = 'mines-row';
          rowEl.setAttribute('role', 'row');
          boardEl.appendChild(rowEl);
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mines-cell';
        button.dataset.index = String(i);
        button.setAttribute('role', 'gridcell');
        button.setAttribute('tabindex', i === 0 ? '0' : '-1');
        button.setAttribute('aria-label', 'Row 1, column 1, hidden');
        rowEl.appendChild(button);
        cellButtons.push(button);
      }
    }

    function reset(message) {
      cancelAutoNext();
      const level = currentLevel();
      root.dataset.difficulty = difficulty;
      cols = level.cols;
      rows = level.rows;
      mineCount = level.mines;
      started = false;
      over = false;
      won = false;
      flags = 0;
      moves = 0;
      revealed = 0;
      flagMode = false;
      focusIndex = 0;
      explodedIndex = -1;
      clearTimer();
      if (resultEl) resultEl.hidden = true;
      if (statusEl) statusEl.hidden = false;
      makeBoard();
      updateStats();
      render();
      status(message || 'Tap a square to begin. Long-press to flag.');
    }

    function placeMines(safeIndex) {
      const safe = new Set([safeIndex]);
      neighbours(safeIndex).forEach(function (index) { safe.add(index); });
      const candidates = [];
      for (let i = 0; i < cells.length; i += 1) {
        if (!safe.has(i)) candidates.push(i);
      }
      shuffle(candidates);
      for (let i = 0; i < Math.min(mineCount, candidates.length); i += 1) {
        cells[candidates[i]].mine = true;
      }
      cells.forEach(function (cell, index) {
        if (cell.mine) return;
        cell.count = neighbours(index).filter(function (n) { return cells[n].mine; }).length;
      });
    }

    function cellLabel(index) {
      const cell = cells[index];
      const row = Math.floor(index / cols) + 1;
      const col = (index % cols) + 1;
      if (index === explodedIndex) return 'Row ' + row + ', column ' + col + ', detonated mine';
      if (over && cell.flag && !cell.mine) return 'Row ' + row + ', column ' + col + ', misplaced flag';
      if (cell.flag) return 'Row ' + row + ', column ' + col + ', flagged';
      if (!cell.open) return 'Row ' + row + ', column ' + col + ', hidden';
      if (cell.mine) return 'Row ' + row + ', column ' + col + ', mine';
      return 'Row ' + row + ', column ' + col + ', ' + (cell.count || 'empty');
    }

    function render() {
      updateStats();
      cells.forEach(function (cell, index) {
        const button = cellButtons[index];
        if (!button) return;
        button.className = 'mines-cell' +
          (cell.open ? ' is-open' : '') +
          (cell.flag ? ' is-flagged' : '') +
          (cell.mine && (cell.open || over) ? ' is-mine' : '') +
          (cell.mine && cell.open && index === explodedIndex ? ' is-detonated' : '') +
          (cell.open && !cell.mine && cell.count > 0 ? ' has-' + cell.count : '') +
          (cell.open && !cell.mine && cell.count === 0 ? ' is-empty' : '') +
          (over && !cell.mine && cell.flag ? ' is-wrong' : '');
        if (cell.open && !cell.mine && cell.count > 0) {
          button.textContent = String(cell.count);
        } else if (cell.open && cell.mine) {
          button.textContent = '✹';
        } else if (cell.flag) {
          button.textContent = over && !cell.mine ? '×' : '⚑';
        } else {
          button.textContent = '';
        }
        button.setAttribute('aria-label', cellLabel(index));
        button.setAttribute('aria-disabled', over ? 'true' : 'false');
        button.setAttribute('tabindex', index === focusIndex ? '0' : '-1');
      });
      if (over) {
        if (resultTitle) resultTitle.textContent = won ? 'Field cleared.' : 'Mine hit.';
        if (resultCopy) resultCopy.textContent = won
          ? 'Every safe square is open.'
          : 'Try a fresh field. The first square is always safe.';
        if (resultEl) resultEl.hidden = false;
        // On a loss the result card already says "Mine hit"; keeping the status
        // line too made the page taller in landscape and pushed the board off.
        if (statusEl) statusEl.hidden = true;
      }
    }

    function finish(win, exploded) {
      over = true;
      won = win;
      if (window.MergeCoach) window.MergeCoach.complete('mines');
      explodedIndex = win ? -1 : (Number.isInteger(exploded) ? exploded : -1);
      if (win) {
        cells.forEach(function (cell) {
          if (cell.mine) cell.flag = true;
        });
        flags = mineCount;
        stopTimer();
        if (window.MergeHaptics) window.MergeHaptics.win();
        status('Field cleared. Every safe square is open.');
      } else {
        cells.forEach(function (cell) {
          if (cell.mine) cell.open = true;
        });
        stopTimer();
        if (window.MergeHaptics) window.MergeHaptics.over();
        status('Mine hit. The field is revealed.');
      }
      render();
      if (win && window.MergeCelebrate) {
        window.MergeCelebrate.play(resultTitle && resultTitle.closest('.play-win'));
      }
      if (againBtn) againBtn.focus({ preventScroll: true });
      scheduleAutoNext(againBtn, function () {
        reset('Fresh field. The first square is always safe.');
      });
    }

    function checkWin() {
      if (revealed === cols * rows - mineCount) finish(true);
    }

    function openCell(index) {
      if (over || cells[index].open || cells[index].flag) return;
      if (!started) {
        started = true;
        placeMines(index);
        startTimer();
      }
      const cell = cells[index];
      if (cell.mine) {
        cell.open = true;
        finish(false, index);
        return;
      }
      const queue = [index];
      while (queue.length) {
        const current = queue.shift();
        const item = cells[current];
        if (item.open || item.flag || item.mine) continue;
        item.open = true;
        revealed += 1;
        if (item.count === 0) {
          neighbours(current).forEach(function (neighbour) {
            if (!cells[neighbour].open && !cells[neighbour].flag) queue.push(neighbour);
          });
        }
      }
      moves += 1;
      coachEvent('mines', 'open', { moves: moves });
      updateStats();
      render();
      status(cell.count ? 'A ' + cell.count + '. Count the mines around it.' : 'Open space. Keep reading the numbers.');
      if (window.MergeHaptics) window.MergeHaptics.merge(10);
      checkWin();
    }

    function toggleFlag(index) {
      if (over || cells[index].open) return;
      const cell = cells[index];
      if (!cell.flag && flags >= mineCount) {
        status('All ' + mineCount + ' flags are placed. Remove one first.');
        return;
      }
      cell.flag = !cell.flag;
      flags += cell.flag ? 1 : -1;
      moves += 1;
      coachEvent('mines', 'flag', { flags: flags });
      updateStats();
      render();
      status(cell.flag ? 'Flag placed. Tap it again to remove it.' : 'Flag removed.');
      if (window.MergeHaptics) window.MergeHaptics.merge(8);
      checkWin();
    }

    function chord(index) {
      if (over || !cells[index].open || !cells[index].count) return;
      const around = neighbours(index);
      const flagged = around.filter(function (n) { return cells[n].flag; }).length;
      if (flagged !== cells[index].count) {
        status('That number needs ' + cells[index].count + ' flag' + (cells[index].count === 1 ? '' : 's') + ' first.');
        return;
      }
      around.forEach(function (neighbour) {
        if (!cells[neighbour].flag && !cells[neighbour].open) openCell(neighbour);
      });
    }

    function focusCell(index) {
      if (!cellButtons[index]) return;
      focusIndex = index;
      cellButtons.forEach(function (button, i) {
        button.setAttribute('tabindex', i === index ? '0' : '-1');
      });
      cellButtons[index].focus({ preventScroll: true });
    }

    function handleActivate(index) {
      focusIndex = index;
      cellButtons.forEach(function (button, i) {
        button.setAttribute('tabindex', i === index ? '0' : '-1');
      });
      if (over) return;
      if (flagMode) toggleFlag(index);
      else if (cells[index].open && cells[index].count) chord(index);
      else openCell(index);
    }

    boardEl.addEventListener('click', function (event) {
      const button = event.target.closest('.mines-cell');
      if (!button) return;
      const index = Number(button.dataset.index);
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      focusCell(index);
      handleActivate(index);
    });

    boardEl.addEventListener('contextmenu', function (event) {
      const button = event.target.closest('.mines-cell');
      if (!button) return;
      event.preventDefault();
      const index = Number(button.dataset.index);
      focusCell(index);
      toggleFlag(index);
    });

    boardEl.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const button = event.target.closest('.mines-cell');
      if (!button) return;
      pointerStart = { x: event.clientX, y: event.clientY };
      longPressIndex = Number(button.dataset.index);
      window.clearTimeout(longPressTimer);
      longPressTimer = window.setTimeout(function () {
        if (longPressIndex < 0) return;
        suppressClick = true;
        focusCell(longPressIndex);
        toggleFlag(longPressIndex);
        if (window.MergeHaptics) window.MergeHaptics.merge(16);
        longPressIndex = -1;
      }, 420);
    });

    boardEl.addEventListener('pointermove', function (event) {
      if (!pointerStart) return;
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 10) {
        window.clearTimeout(longPressTimer);
        pointerStart = null;
      }
    });

    boardEl.addEventListener('pointerup', function () {
      window.clearTimeout(longPressTimer);
      pointerStart = null;
      window.setTimeout(function () {
        longPressIndex = -1;
        suppressClick = false;
      }, 30);
    });

    boardEl.addEventListener('pointercancel', function () {
      window.clearTimeout(longPressTimer);
      pointerStart = null;
      longPressIndex = -1;
      suppressClick = false;
    });

    document.addEventListener('keydown', function (event) {
      if (current !== 'mines' || event.defaultPrevented || document.documentElement.classList.contains('sheet-open')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target && target.closest && target.closest('input, textarea, select')) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === 'f') {
        event.preventDefault();
        toggleFlag(focusIndex);
        return;
      }
      if (key === 'c') {
        event.preventDefault();
        chord(focusIndex);
        return;
      }
      if (key === 'r' || key === 'n') {
        event.preventDefault();
        reset('Fresh field. The first square is always safe.');
        return;
      }
      if (event.key.indexOf('Arrow') !== 0) return;
      event.preventDefault();
      const row = Math.floor(focusIndex / cols);
      const col = focusIndex % cols;
      let nextRow = row;
      let nextCol = col;
      if (event.key === 'ArrowUp') nextRow = Math.max(0, row - 1);
      if (event.key === 'ArrowDown') nextRow = Math.min(rows - 1, row + 1);
      if (event.key === 'ArrowLeft') nextCol = Math.max(0, col - 1);
      if (event.key === 'ArrowRight') nextCol = Math.min(cols - 1, col + 1);
      focusCell(indexOf(nextRow, nextCol));
    });

    difficultyEl.addEventListener('click', function (event) {
      const button = event.target.closest('[data-mines-difficulty]');
      if (!button) return;
      difficulty = button.dataset.minesDifficulty;
      save(DIFFICULTY_KEY, { difficulty: difficulty });
      reset('New ' + currentLevel().label + ' field. First square is safe.');
    });

    flagBtn.addEventListener('click', function () {
      flagMode = !flagMode;
      updateStats();
      status(flagMode ? 'Flag mode on. Tap squares to mark mines.' : 'Flag mode off. Tap to dig.');
    });

    againBtn.addEventListener('click', function () { reset('Fresh field. The first square is always safe.'); });
    newBtn.addEventListener('click', function () { reset('Fresh field. The first square is always safe.'); });

    const shareBtn = $('mines-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        const copy = won
          ? 'I cleared Minesweeper on ' + currentLevel().label + ' in ' + formatTime(elapsedTime()) + '.'
          : 'The ' + currentLevel().label + ' Minesweeper field got me after ' + formatTime(elapsedTime()) + '.';
        shareResult('Minesweeper', copy, {
          game: 'Minesweeper', number: '06', kind: 'LOGIC',
          title: won ? 'Field cleared' : 'Mine hit',
          score: formatTime(elapsedTime()),
          label: won ? 'TIME' : 'LASTED',
          meta: [currentLevel().label, won ? 'Every safe square open' : 'The field was revealed'],
          accent: '#5b8fd5'
        });
      });
    }

    reset('Tap a square to begin. Long-press to flag.');
    games.mines = {
      title: title,
      activate: function () {
        render();
        if (over) {
          scheduleAutoNext(againBtn, function () {
            reset('Fresh field. The first square is always safe.');
          });
        } else {
          cancelAutoNext();
          if (started) startTimer();
        }
      },
      deactivate: function () {
        cancelAutoNext();
        stopTimer();
      },
      reset: function () {
        difficulty = 'easy';
        try { localStorage.removeItem(DIFFICULTY_KEY); } catch (err) {}
        reset('Board reset. Beginner field. First tap is safe.');
        updateStats();
      }
    };
  })();

  const mergeResetBtn = $('merge-reset');
  if (mergeResetBtn) {
    mergeResetBtn.addEventListener('click', function () {
      requestGameReset('merge', mergeResetBtn);
    });
  }

  games.wordle = {
    title: $('wordle-title'),
    activate: function () {
      if (window.SixfoldWordle) window.SixfoldWordle.activate();
    },
    deactivate: function () {
      if (window.SixfoldWordle) window.SixfoldWordle.deactivate();
    },
    reset: function () {
      if (window.SixfoldWordle) window.SixfoldWordle.reset();
    }
  };

  installPlayTools();
  initRoute();
})();
