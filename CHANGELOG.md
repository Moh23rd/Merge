# Sixfold — Changelog

**Version 2.0 · Silent update · 9 November 2026**

A polish and motion pass, with one small secret in the cover.

## Motion and touch

- **Smoother game transitions.** Screen entrances, result cards and win overlays now use a longer spring curve instead of arriving all at once.
- **Desktop motion.** On a mouse, cartridge cards lift, buttons respond, and the six-piece cover tilts gently with the pointer.
- **Reduced motion stays quiet.** Every new transition has a still fallback for `prefers-reduced-motion`.

## Fixes

- **Fruit Merge colours.** Fruit now keeps its natural palette no matter which app accent is selected, so cherries stay red and leaves stay green.
- **Opaque grapes.** The grape bunch has a solid body behind its separate circles, closing the transparent gaps that let the board show through.
- **Header spacing.** On wide screens, the in-game title and description now sit clearly below the back button and cartridge label.
- **PC layout.** The larger play-screen entrance and the new cover tilt respect fine-pointer and reduced-motion preferences.

## The hidden word game

- **A secret in the six-piece cover.** Tap the six numbered pieces in order, 01 through 06, to open a full five-letter word game.
- **Standard rules.** Six guesses, green for the right spot, yellow for a letter elsewhere, gray when a letter is absent, and duplicate letters score only as often as they appear in the answer.
- **Made to be replayed.** A random answer each round, a new-word action, saved progress, played/win/streak stats and a shareable result.
- **Still hidden.** It is not on the game cards, and opening `#wordle` directly does not unlock it.

## Under the hood

- App version 2.0.
- Offline cache moves to `sixfold-2.0.0`; asset URLs use `?v=2.0.0`.
- New styles live in `polish.css`; the hidden game uses `wordle.js` and `wordle-words.js`.

---

**Version 2.0 · Public release · 9 November 2026**

Sixfold’s pocket-arcade release. The six games and their rules are unchanged; the collection around them has been rebuilt to look and feel like one small, considered arcade.

## A new home

- **A six-piece cover.** Six numbered blocks build the Sixfold mark as the home screen arrives, with a soft staggered spring and a still version for reduced motion.
- **Six cartridge cards.** Every game gets its own number, category and mini board preview, with a clear Play action and saved-progress note.
- **Surprise me.** One button opens a random game for the times you cannot pick.
- **A flat page.** The home and game backgrounds now use one page colour that matches the browser and phone chrome exactly in light and dark.

## A more tactile game shell

- Every game screen carries its cartridge number and category back into play.
- Score cards and primary actions pick up the game’s own accent colour.
- The new shell keeps the existing controls, rules, saves and keyboard paths intact.

## One Line

- **100 shapes across four chapters**, with the shape map and saved stars carried forward from 1.0.4.
- **A star meter** in the shape map shows total progress against all 300 stars.
- Hints, star sharing and open-end puzzles remain available.

## Fixes and polish

- The page title, social metadata, install manifests, About panel, version label and collection share text now identify Sixfold 2.0.
- The new What’s New card describes the 2.0 changes instead of repeating the 1.0.5 One Line note.
- The README uses the new 2.0 card as its banner and now correctly documents 100 One Line shapes.
- Offline cache moves to `sixfold-2.0.0`; asset URLs use `?v=2.0.0`.

## Under the hood

- App version 2.0.
- Plain HTML, CSS and JavaScript; no build step.
- Published at [moh23rd.github.io/Sixfold](https://moh23rd.github.io/Sixfold/).

---

**Version 1.0.5 · Public release · 9 November 2026**

- One Line gained a Hint button that pulses the next dot; taking a hint caps that shape at two stars.
- Star progress can be shared from the shape map or after a solve.
- Small polish for the One Line status row and controls.

**Version 1.0.4 · Public release · 9 November 2026**

- One Line grew to 100 shapes across four chapters, with a shape map, saved stars and open-end puzzles.
- About gained a permanent changelog and a clearer button.

**Version 1.0.3 · Public release · 8 November 2026**

- The Chrome install notice can be dismissed for good.
- About and privacy moved to the home screen, with a new share icon and matching panel corners.

**Version 1.0 · Public release · 8 November 2026**

Sixfold’s first public release.

- Six complete games: Merge, Water Sort, One Line, Fruit Merge, Tic Tac Toe and Minesweeper.
- Every game saves its own board, best score and progress on the device.
- Installable on Android and iPhone, with a matching launch screen and offline play.
- Six colour palettes, light/dark/auto, reduced-motion support and full keyboard play.
- Accessibility audited: zero WCAG A/AA violations on the hub and game screens in both themes.
- Fruit Merge stops drawing when the pile is still, and a browser visit reaches the hub about half a second sooner.
- One Line launched with ten shapes; 1.0.4 expanded it to the current 100.
