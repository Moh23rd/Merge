/* Shared dynamic game copy for the newer locale catalogs. The static interface
   is a direct string lookup; board summaries, scores and daily status lines
   follow the same English patterns as the Spanish/French/German catalogs but
   use a translated template table so a catalog only carries text, not code. */
(function () {
  'use strict';

  var TEXT = {
    how: 'How to play {1}',
    resetQ: 'Reset {1}?',
    reset: 'Reset {1}',
    clearDevice: 'This clears {1} data on this device.',
    boardRows: '{1} by {2} board. {3}',
    tube: 'Tube {1}, {2}',
    resetData: 'Reset {1} data',
    boardSizeBy: 'Board size, {1} by {2}',
    boardSize: 'Board size: {1} × {2}',
    mineBoard: '{1} Minesweeper board, {2} columns by {3} rows',
    fruitBoard: 'Fruit Merge board. Score {1}. Next fruit: {2}. Drag to aim, release to drop. Arrow keys aim, space drops.',
    rowCell: 'Row {1}, column {2}, {3}',
    score: 'Score {1}',
    best: 'Best {1}',
    moves: 'Moves {1}',
    movesCount: '{1} moves',
    pointsBest: '{1} points · best {2}',
    ofSixDone: '{1} of six done · {2} to go.',
    playToday: 'Play {1} for today',
    replayToday: 'Replay {1} for today',
    ofSixGames: '{1}, {2} of six games',
    dailySudokuDate: 'Daily Sudoku for {1}.',
    dailyOne: 'Daily Sixfold · {1}. One solution.',
    dailySolved: 'Daily Sixfold · {1}. Solved.',
    daily: 'Daily Sixfold · {1}.',
    tapCellDigit: 'Tap a cell for {1}.',
    allNines: 'All nine {1}s are already placed.',
    onlyFits: 'Only {1} fits in this cell: every other digit already appears in its row, column or box.',
    digitUnit: '{1} has only one possible square in {2} {3}. The square itself may allow other numbers, but this digit cannot go anywhere else.',
    reveal: 'Reveal {1}',
    place: 'Place {1}',
    revealed: 'Revealed a {1}.',
    placed: '{1}: placed {2}.',
    inRowCol: '{1} in row {2}, column {3}.',
    buildingUnique: 'Building a unique {1} puzzle…',
    buildingDaily: 'Building the {1} daily puzzle…',
    puzzleReady: '{1} puzzle ready. One solution.',
    newRoundCopy: 'New round. {1}',
    twoWatermelons: 'Two watermelons cleared — +{1}!',
    dropped: 'Dropped {1}. Pair it with another.',
    numberMines: 'A {1}. Count the mines around it.',
    allFlags: 'All {1} flags are placed. Remove one first.',
    needsFlags: 'That number needs {1} flags first.',
    boardMoves: '{1} × {2} • {3} moves',
    finishedNoHints: '{1} puzzle finished in {2} without hints.',
    finishedHints: '{1} puzzle finished in {2} with {3} hints.',
    mistakesSuffix: ' {1} checked mistakes.',
    solvedOne: '1 puzzle solved',
    solvedMany: '{1} puzzles solved',
    bestSuffix: ' · best {1}',
    mistakesSuffix2: ' · {1} mistakes',
    checkedFull: '{1} of six games checked in. A full set.',
    checkedSudoku: '{1} of six games checked in. You can still replay the Sudoku.',
    checkedOff: '{1} checked off. {2} of six today.',
    dailyComplete: 'Daily Sixfold complete. All six games played.',
    levelOf: 'Level {1} of {2}',
    tierLevel: '{1} · Level {2} of {3}',
    youAreXTier: 'You are X · {1}',
    dailyBeat: 'Daily Sixfold. Beat the seeded {1} computer.',
    dailyTier: 'Daily Sixfold. Seeded {1} level.',
    dailyField: 'Daily Sixfold. Clear the seeded {1} field.',
    guesses: '{1} guesses',
    wordleBoard: 'Wordle board, {1} of 6 guesses used',
    wordWas: 'The word was {1}.',
    size: '{1} × {2}',
    streakDays: '{1} day streak',
    dailyClearLevel: 'Daily Sixfold. Clear this seeded level.',
    dailyFruit: 'Daily Sixfold. Seeded fruit run.',
    dailyRunBoard: 'Daily Sixfold run. Seeded {1} by {2} board.',
    dailyYourMove: 'Daily Sixfold. Your move. You are X.',
    dailyDrop: 'Daily Sixfold. Drop fruit.',
    dailySequence: 'Daily Sixfold. Seeded {1} by {2} — every new tile follows today’s sequence.',
    newBoard: 'New {1} by {2} board.',
    resumed: 'Resumed game. Score {1}.',
    openSpace: 'Open space. Keep reading the numbers.',
    fieldCleared: 'Field cleared. Every safe square is open.',
    dailyClosed: 'Daily challenge closed. Fresh normal field.',
    dailyOpening: 'Daily Sixfold. Opening square revealed. Clear the seeded field.',
    youWinThree: 'You win. Three in a row.',
    computerWins: 'Computer wins this round.',
    draw: 'A draw. Every square filled.',
    freshFruit: 'Fresh fruit. Drag to aim, release to drop.',
    dailyDrag: 'Daily Sixfold. Drag to aim, release to drop.',
    pileTop: 'The pile reached the top. Start a fresh run.',
    bestReset: 'Best score reset. Fresh run.',
    levelClear: 'Level clear. Every colour has its own tube.',
    undone: 'Undone. Take another look.',
    selectionCleared: 'Selection cleared.',
    poured: 'Poured. Keep going.',
    noMoves: 'No moves left. Undo or start a fresh board.',
    freshField: 'Fresh field. The first square is always safe.',
    mineHit: 'Mine hit. The field is revealed.',
    trySeeded: 'Try the same seeded field again.',
    tryFresh: 'Try a fresh field. The first square is always safe.',
    roundComplete: 'Round complete.',
    newRound: 'New round.',
    newPuzzle: 'New puzzle.',
    paused: 'Paused.',
    rowLabel: 'Row {1}:',
    full: '{1} of 4 full'
  };

  var SPECS = [
    [/^How to play (.+)$/, 'how'],
    [/^Reset (.+)\?$/, 'resetQ'],
    [/^Reset (.+)$/, 'reset'],
    [/^This clears (.+) data on this device\.$/, 'clearDevice'],
    [/^(\d+) by (\d+) board\. (.+)$/, 'boardRows'],
    [/^Tube (\d+), (.+)$/, 'tube'],
    [/^Reset (.+) data$/, 'resetData'],
    [/^Board size, (\d+) by (\d+)$/, 'boardSizeBy'],
    [/^Board size: (\d+) × (\d+)$/, 'boardSize'],
    [/^(Beginner|Intermediate|Expert) Minesweeper board, (\d+) columns by (\d+) rows$/, 'mineBoard'],
    [/^Fruit Merge board\. Score (\d+)\. Next fruit: (.+)\. Drag to aim, release to drop\. Arrow keys aim, space drops\.$/, 'fruitBoard'],
    [/^Row (\d+), column (\d+), (.+)$/, 'rowCell'],
    [/^Score (\d+)$/, 'score'],
    [/^Best (\d+)$/, 'best'],
    [/^Moves (\d+)$/, 'moves'],
    [/^(\d+) moves?$/, 'movesCount'],
    [/^(\d+) points · best (\d+)$/, 'pointsBest'],
    [/^(\d+) of six done · (\d+) to go\.$/, 'ofSixDone'],
    [/^Play (.+) for today$/, 'playToday'],
    [/^Replay (.+) for today$/, 'replayToday'],
    [/^(.+), (\d+) of six games$/, 'ofSixGames'],
    [/^Daily Sudoku for (.+)\.$/, 'dailySudokuDate'],
    [/^Daily Sixfold · (.+)\. One solution\.$/, 'dailyOne'],
    [/^Daily Sixfold · (.+)\. Solved\.$/, 'dailySolved'],
    [/^Daily Sixfold · ((?:(?!\. ).)+)\.$/, 'daily'],
    [/^Tap a cell for (\d+)\.$/, 'tapCellDigit'],
    [/^All nine (\d+)s are already placed\.$/, 'allNines'],
    [/^Only (\d+) fits in this cell: every other digit already appears in its row, column or box\.$/, 'onlyFits'],
    [/^(\d+) has only one possible square in (row|column|box) (\d+)\. The square itself may allow other numbers, but this digit cannot go anywhere else\.$/, 'digitUnit'],
    [/^(Reveal|Place) (\d+)$/, 'revealPlace'],
    [/^Revealed a (\d+)\.$/, 'revealed'],
    [/^(.+): placed (\d+)\.$/, 'placed'],
    [/^(.+) in row (\d+), column (\d+)\.$/, 'inRowCol'],
    [/^Building a unique (.+) puzzle…$/, 'buildingUnique'],
    [/^Building the (.+) daily puzzle…$/, 'buildingDaily'],
    [/^(.+) puzzle ready\. One solution\.$/, 'puzzleReady'],
    [/^New round\. (.+)$/, 'newRoundCopy'],
    [/^Two watermelons cleared — \+(\d+)!$/, 'twoWatermelons'],
    [/^Dropped (.+)\. Pair it with another\.$/, 'dropped'],
    [/^A (\d+)\. Count the mines around it\.$/, 'numberMines'],
    [/^All (\d+) flags are placed\. Remove one first\.$/, 'allFlags'],
    [/^That number needs (\d+) flags? first\.$/, 'needsFlags'],
    [/^(\d+) × (\d+) • (\d+) moves?$/, 'boardMoves'],
    [/^(?:Daily Sixfold · (.+?)\. )?(Easy|Medium|Hard|Expert) puzzle finished in (.+?) with (no hints|\d+ hints?)(?: and (\d+) checked mistakes?)?\.$/, 'finished'],
    [/^(\d+) puzzles? solved(?: · best (.+?))?(?: · (\d+) mistakes?)?$/, 'solved'],
    [/^(\d+) of six games checked in\. A full set\.$/, 'checkedFull'],
    [/^(\d+) of six games checked in\. You can still replay the Sudoku\.$/, 'checkedSudoku'],
    [/^(\d+) checked off\. (\d+) of six today\.$/, 'checkedOff'],
    [/^Daily Sixfold complete\. All six games played\.$/, 'dailyComplete'],
    [/^Level (\d+) of (\d+)$/, 'levelOf'],
    [/^(Easy|Medium|Hard) · Level (\d+) of (\d+)$/, 'tierLevel'],
    [/^You are X · (.+)$/, 'youAreXTier'],
    [/^Daily Sixfold\. Beat the seeded (.+) computer\.$/, 'dailyBeat'],
    [/^Daily Sixfold\. Seeded (.+) level\.$/, 'dailyTier'],
    [/^Daily Sixfold\. Clear the seeded (.+) field\.$/, 'dailyField'],
    [/^(\d+) guesses?$/, 'guesses'],
    [/^Wordle board, (\d+) of 6 guesses used$/, 'wordleBoard'],
    [/^The word was ([A-Z]+)\.$/, 'wordWas'],
    [/^(\d+) × (\d+)$/, 'size'],
    [/^(\d+) day streak$/, 'streakDays'],
    [/^Daily Sixfold\. Clear this seeded level\.$/, 'dailyClearLevel'],
    [/^Daily Sixfold\. Seeded fruit run\.$/, 'dailyFruit'],
    [/^Daily Sixfold run\. Seeded (\d+) by (\d+) board\.$/, 'dailyRunBoard'],
    [/^Daily Sixfold\. Your move\. You are X\.$/, 'dailyYourMove'],
    [/^Daily Sixfold\. Drop fruit\.$/, 'dailyDrop'],
    [/^Daily Sixfold\. Seeded (\d+) by (\d+) — every new tile follows today’s sequence\.$/, 'dailySequence'],
    [/^New (\d+) by (\d+) board\.$/, 'newBoard'],
    [/^Resumed game\. Score (\d+)\.$/, 'resumed'],
    [/^Open space\. Keep reading the numbers\.$/, 'openSpace'],
    [/^Field cleared\. Every safe square is open\.$/, 'fieldCleared'],
    [/^Daily challenge closed\. Fresh normal field\.$/, 'dailyClosed'],
    [/^Daily Sixfold\. Opening square revealed\. Clear the seeded field\.$/, 'dailyOpening'],
    [/^You win\. Three in a row\.$/, 'youWinThree'],
    [/^Computer wins this round\.$/, 'computerWins'],
    [/^A draw\. Every square filled\.$/, 'draw'],
    [/^Fresh fruit\. Drag to aim, release to drop\.$/, 'freshFruit'],
    [/^Daily Sixfold\. Drag to aim, release to drop\.$/, 'dailyDrag'],
    [/^The pile reached the top\. Start a fresh run\.$/, 'pileTop'],
    [/^Best score reset\. Fresh run\.$/, 'bestReset'],
    [/^Level clear\. Every colour has its own tube\.$/, 'levelClear'],
    [/^Undone\. Take another look\.$/, 'undone'],
    [/^Selection cleared\.$/, 'selectionCleared'],
    [/^Poured\. Keep going\.$/, 'poured'],
    [/^No moves left\. Undo or start a fresh board\.$/, 'noMoves'],
    [/^Fresh field\. The first square is always safe\.$/, 'freshField'],
    [/^Mine hit\. The field is revealed\.$/, 'mineHit'],
    [/^Try the same seeded field again\.$/, 'trySeeded'],
    [/^Try a fresh field\. The first square is always safe\.$/, 'tryFresh'],
    [/^Round complete\.$/, 'roundComplete'],
    [/^New round\.$/, 'newRound'],
    [/^New puzzle\.$/, 'newPuzzle'],
    [/^Paused\.$/, 'paused']
  ];

  function build(catalog) {
    var messages = catalog.messages || {};
    var templates = catalog.templates || {};
    var terms = catalog.terms || {};

    function word(value) {
      var text = String(value == null ? '' : value);
      var key = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
      return messages[key] || messages[text.toLowerCase()] || text;
    }

    function text(key, args) {
      var source = templates[key] || TEXT[key] || key;
      return String(source).replace(/\{(\d+)\}/g, function (_, index) {
        return word(args[Number(index) - 1]);
      });
    }

    function rowState(state) {
      return String(state)
        .replace(/detonated mine/g, terms.detonatedMine || 'detonated mine')
        .replace(/misplaced flag/g, terms.misplacedFlag || 'misplaced flag')
        .replace(/\bgiven\b/g, terms.given || 'given')
        .replace(/\bnotes\b/g, terms.notes || 'notes')
        .replace(/\bconflict\b/g, terms.conflict || 'conflict')
        .replace(/\bhidden\b/g, terms.hidden || 'hidden')
        .replace(/\bflagged\b/g, terms.flagged || 'flagged')
        .replace(/\bmine\b/g, terms.mine || 'mine')
        .replace(/\bempty\b/g, terms.empty || 'empty');
    }

    function tubeState(state) {
      return String(state)
        .replace(/\bempty\b/g, terms.empty || 'empty')
        .replace(/(\d+) of 4 full/g, function (_, count) {
          return text('full', [count]);
        })
        .replace(/\bselected\b/g, terms.selected || 'selected')
        .replace(/\bcoral\b/g, terms.coral || 'coral')
        .replace(/\bamber\b/g, terms.amber || 'amber')
        .replace(/\blime\b/g, terms.lime || 'lime')
        .replace(/\bteal\b/g, terms.teal || 'teal')
        .replace(/\bblue\b/g, terms.blue || 'blue')
        .replace(/\bgrape\b/g, terms.grape || 'grape')
        .replace(/\brose\b/g, terms.rose || 'rose');
    }

    return SPECS.map(function (spec) {
      var re = spec[0];
      var kind = spec[1];
      return [re, function (match) {
        var args = Array.prototype.slice.call(arguments, 1);
        if (kind === 'boardRows') {
          var rows = String(args[2]).replace(/Row (\d+):\s*/g, function (_, number) {
            return text('rowLabel', [number]) + ' ';
          }).replace(/\bempty\b/g, terms.empty || 'empty');
          return text('boardRows', [args[0], args[1], rows]);
        }
        if (kind === 'tube') return text('tube', [args[0], tubeState(args[1])]);
        if (kind === 'rowCell') return text('rowCell', [args[0], args[1], rowState(args[2])]);
        if (kind === 'digitUnit') return text('digitUnit', [args[0], terms[args[1]] || args[1], args[2]]);
        if (kind === 'revealPlace') return text(args[0] === 'Reveal' ? 'reveal' : 'place', [args[1]]);
        if (kind === 'finished') {
          var copy = /^no hints$/.test(args[3])
            ? text('finishedNoHints', [args[1], args[2]])
            : text('finishedHints', [args[1], args[2], String(args[3]).replace(/\D/g, '')]);
          if (args[4]) copy = copy.replace(/\.$/, '') + text('mistakesSuffix', [args[4]]);
          return (args[0] ? text('daily', [args[0]]) + ' ' : '') + copy;
        }
        if (kind === 'solved') {
          var solved = args[0] === '1' ? text('solvedOne', []) : text('solvedMany', [args[0]]);
          if (args[1]) solved += text('bestSuffix', [args[1]]);
          if (args[2]) solved += text('mistakesSuffix2', [args[2]]);
          return solved;
        }
        if (kind === 'newRoundCopy') return text('newRoundCopy', [word(args[0])]);
        return text(kind, args);
      }];
    });
  }

  window.SixfoldPatterns = { text: TEXT, build: build };
})();
