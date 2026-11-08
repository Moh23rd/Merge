# Sixfold — Changelog

**Version 1.0 · Public release · 8 November 2026**

Sixfold’s first public release: six complete games, audited against their originals, polished for phones, and ready to install.

## Six games

- **Merge** — classic 2048 with 3 × 3 and 5 × 5 options, merge-value scoring, a 2048 win that lets you keep going, and a no-move loss.
- **Water Sort** — eight fixed levels, solver-checked, with grouped pours and one-colour tubes.
- **One Line** — ten Euler-circuit shapes, each traceable from any dot.
- **Fruit Merge** — the canonical eleven-fruit chain and Suika’s triangular pair scoring.
- **Tic Tac Toe** — X first, standard lines and draws, with an unbeatable minimax opponent.
- **Minesweeper** — Beginner 9 × 9, Intermediate 16 × 16 and Expert 30 × 16, a safe first tap, flags and chording.

## Polish

- Every game saves its own board, best score and progress on the device.
- Installable on Android and iPhone, with a matching launch screen and offline play.
- Six colour palettes, light/dark/auto, reduced-motion support and full keyboard play.
- Accessibility audited: zero WCAG A/AA violations on the hub and game screens in both themes.
- Fruit Merge stops drawing when the pile is still, and a browser visit reaches the hub about half a second sooner.

## Under the hood

- App version 1.0
- Offline cache `sixfold-1.0`
- Published at [moh23rd.github.io/Sixfold](https://moh23rd.github.io/Sixfold/)

---

## Beta history

**Version 2.5.2 · Beta · 8 November 2026**

A small layout tidy-up.

## Changed

- **The version label moved to the hub.** It used to float at the bottom of the Merge screen; it now sits quietly beneath the home-screen footer, so a game in progress has the bottom edge to itself.
- **The hub footer wraps cleanly on narrow phones** instead of squeezing its lines together.
- **Asset versions move to 2.5.2** with offline cache `sixfold-v28`.
- Not yet published to GitHub.

**Version 2.5.1 · Beta · 8 November 2026**

A performance, accessibility and repository pass ahead of publishing the source.

## Faster

- **The hub no longer waits behind the launch screen.** An installed app keeps the full launch composition; a browser visit lifts it after the first frame, cutting roughly half a second from every visit.
- **Fruit Merge stops drawing when the pile is still.** The animation loop wakes on the next drop and pauses while the tab is hidden. An idle board measured 119 frames in two seconds before the change and none after.
- **Asset versions move to 2.5.1** so every device fetches the new files instead of the cached 2.5.0 copies.

## Clearer

- **Fruit Merge shows a keyboard focus ring** on the canvas instead of hiding focus entirely.
- **Small text now clears 4.5:1 contrast** on the What’s New card, the Fruit Merge next-fruit labels and hint, and the mini tile art.
- **Minesweeper and Tic Tac Toe expose valid accessibility trees.** The mine grid now has real rows with a column and row count, and the tic-tac-toe board is a labelled group instead of an invalid grid.
- **The What’s New dismiss button keeps its 28px ring but gets a 44px touch target.**

## Repository

- Added a README, an MIT licence and a `.gitignore` so the project is ready to publish.
- Refreshed offline cache `sixfold-v27`.
- Not yet published to GitHub.

**Version 2.5.0 · Beta · 8 November 2026**

A full rules-and-fairness audit of all six games.

## Corrected

- **Fruit Merge now uses the Suika scoring table.** A cherry pair pays 1, a strawberry pair 3, and so on to 66 for two watermelons. The old build paid the next tier and added a separate 100-point clear bonus. The fruit previously shown as Orange is now Persimmon, matching the official chain.
- **Minesweeper now has the standard fields.** Beginner is 9 × 9 with 10 mines, Intermediate is 16 × 16 with 40, and Expert is 30 × 16 with 99. The first tap opens a safe pocket, flags are optional, and chording follows the classic behaviour.
- **Water Sort’s eight levels were solver-checked.** Every fixed board has at least one valid sequence of pours.
- **Merge, One Line and Tic Tac Toe were checked against their canonical rules.** Merge uses the classic 4 × 4 board by default, 2/4 spawns at 90/10, merge-value scoring, a 2048 win with keep-going, and a no-move loss. One Line’s ten shapes are Euler circuits, so every shape can be traced from any dot. Tic Tac Toe has X first, standard win lines and draws, and an unbeatable Perfect minimax opponent.

## Under the hood

- Version 2.5.0
- Refreshed offline cache `sixfold-v26`
- Not yet published to GitHub.

**Version 2.4.2 · Beta · 8 November 2026**

This follow-up closes the remaining tutorial-dismissal bug.

## Fixes

- **Tutorials now ignore extra actions.** If a player taps something unrelated while a tutorial is waiting for its next step, that tap is discarded instead of sitting in front of the real action. This was why a card could remain visible after the requested move had already been made.
- **One Line’s starter shape completes its tutorial.** The first triangle has three links, so the final step no longer waits for a fourth.
- **Every game dismisses its coach at the end of a round**, even if the guided actions were not followed.
- **The home-screen logo follows the theme** instead of using the text colour as its background.

## Under the hood

- Version 2.4.2
- Refreshed offline cache `sixfold-v25`
- Not yet published to GitHub.

**Version 2.4.1 · Beta · 8 November 2026**

This small update fixes two issues found in 2.4.0.

## Fixes

- **Tutorials now finish cleanly.** One Line’s three-link starter shape was waiting for a fourth link, so its coach card could remain after the puzzle was solved. The tutorial now completes on the starter shape, and every game dismisses its coach when the tutorial or the round is finished.
- **The home-screen logo follows the theme.** The small Sixfold mark was using the text colour as its tile colour, which made it appear light in dark mode and dark in light mode. It now uses the theme’s surface colour in both modes.

Everything else from 2.4.0 remains: neutral home previews, liquid Water Sort tubes, beginner dots only on levels 1–2, the original One Line shapes, guided first moves in all six games, and the refreshed offline cache.

## Under the hood

- Version 2.4.1
- Refreshed offline cache `sixfold-v24`
- Not yet published to GitHub.

**Version 2.4.0 · Beta · 8 November 2026**

This build makes the collection easier to settle into and gives Water Sort its liquid finish.

## What’s new

- **A short coached first move in every game.** Merge, Water Sort, One Line, Fruit Merge, Tic Tac Toe and Minesweeper each show one small in-game step at a time. The next step appears only after the player performs the action. Every tutorial has a permanent Skip.
- **One Line is back to its original shapes.** Triangle through Grand Tour return, with any dot as a valid start. The ten shapes are ordered by link count so each level gets a little harder.
- **Water Sort looks like liquid.** The playable tubes and home thumbnail now use continuous colour layers with a curved base and a glass meniscus instead of separate rounded blocks.
- **Beginner dots only last two levels.** The pour-target dot is shown on levels 1 and 2, then the board gets out of the way.
- **Cleaner home previews.** Preview panels are now neutral, palette-aware surfaces. They no longer turn muddy or olive when a palette is applied, and the Water Sort, Tic Tac Toe and Minesweeper cards share the same clean treatment.

## Also in this build

- The first-visit Help sheet no longer opens over Merge; the new coach takes its place while Help remains in the Look panel.
- Existing saves, theme choices, offline play and the five-second auto-advance remain in place.
- One Line’s old level set has no ringed open ends.

## Under the hood

- Version 2.4.0
- Refreshed offline cache `sixfold-v23`
- No accounts, no ads, and no connection needed after the first load.
- Not yet published to GitHub.

**Version 2.3.0 · Beta · 8 November 2026**

Sixfold is six calm puzzle games in one offline collection: Merge, Water Sort, One Line, Fruit Merge, Tic Tac Toe and Minesweeper.

## What’s new

- **Home previews now match the games.** The Tic Tac Toe marks use one consistent X colour and one consistent O colour, the Water Sort card shows proper test tubes, and every preview illustration follows the active palette.
- **Preview panels follow your colours.** The soft background behind each home-screen preview is now built from the same shared accent colours as the games, so changing the palette refreshes the whole collection immediately.
- **One Line has a real difficulty curve.** The first three shapes are forgiving Euler circuits that work from any dot. Medium and hard shapes have two ringed open ends: starting elsewhere can dead-end, and choosing the wrong branch can still strand the trail. Medium adds three two-end shapes; hard adds four larger branching trails.
- **Clearer easy-to-medium-hard labels.** Water Sort and One Line now name the tier beside the current level. The Merge board sheet explains the 3×3, 4×4 and 5×5 progression, while Tic Tac Toe and Minesweeper keep their existing difficulty controls.
- **A small “What’s new” note.** After a version update, a compact note appears at the top of the home screen with three short highlights. Dismiss it once and it stays gone until the next release.

## Also in this build

- The Tic Tac Toe preview no longer colours marks by grid position, which caused the mixed X and blue O in the old card.
- The Water Sort preview now uses the same glass rim, curved base and colour layers as the playable tubes.
- The home cards, result-card artwork and game boards share the same palette accents.
- Existing saves, theme choices, offline play and the five-second auto-advance remain in place.

## Tester notes

- If an older copy is already installed on your home screen, close and reopen it once so the refreshed offline cache loads.
- Please check the native share sheet and the launch screen on a real phone.
- The game layouts are designed to stay put without scrolling, including at 320px wide and in landscape.

## Under the hood

- Version 2.3.0
- Refreshed offline cache `sixfold-v22`
- No accounts, no ads, and no connection needed after the first load.
- Not yet published to GitHub.
