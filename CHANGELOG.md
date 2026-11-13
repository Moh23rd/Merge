# Changelog

## 4.0.0 — 11 November 2026

4.0 is the Sudoku release. It rolls up every change since Sixfold 3.0,
including the 3.0.x refinements, and finishes the short-landscape and
six-piece cover work.

### Added

- **Sudoku replaces One Line** as the second game: a 9 × 9 grid in Easy,
  Medium, Hard and Expert, a guaranteed unique solution, notes, erase, undo,
  hints, a timer, per-difficulty best times, saved progress and a shareable
  result.
- **A board-left Sudoku landscape layout**, with the grid on the left and one
  control rail beside it. Short phones keep the tutorial, status line, number
  pad, tools and footer visible without a dead band between the board and the
  controls.
- **A three-step Sudoku coach** that teaches selecting a cell, placing a
  number, and using Notes and Hint.
- **Hidden-game discovery**: the six-piece cover assembles, tapping 01 through
  06 in order unlocks a short reveal, and the cover replays its build when you
  return to the hub.
- **A six-piece launch splash** with a staggered mark and progress rail.
- **Wordle image share cards**, alongside the existing result shares.
- **A versioned What's New note** above the hero.
- **A 4.0 offline shell** and refreshed asset versions.

### Changed

- The collection now reads Merge, Sudoku, Tic Tac Toe, Minesweeper, Water Sort,
  Fruit Merge. Meta, Open Graph, Twitter, both manifests, the ticker and the
  README all list Sudoku and no longer mention One Line.
- One Line and its 100-shape, four-chapter mode are removed, along with its hub
  card, game screen, level sheet and related code.
- Every result card now uses the same three-second auto-next beat and shared
  result shape.
- Wordle keeps its in-page keyboard on phones and pointer devices, with Enter
  in the bottom-right key position, and its offline guess list now covers the
  full five-letter Wordle list.
- Water Sort pours multiple layers in one move, with splash, ring and droplet
  impact effects on the receiving tube.
- Fruit Merge has an opaque aim ghost, batched aim redraws, a capped DPR and
  tighter collision checks.
- Tic Tac Toe two-player results and share stats are corrected.
- Short-landscape sizing across the arcade keeps controls, share cards and
  result overlays inside the viewport.
- The service worker now scopes cached responses, checks successful responses
  and cleans up older cache generations.

### Fixed

- The six-piece cover no longer replaces its entrance with the old fast tap
  animation. Tiles are real buttons, a touch fallback absorbs the delayed
  synthetic click, a tap is a transient press state, and the build uses
  backwards fill so hover and press transforms still work afterwards.
- Sudoku's short-landscape layout no longer hides the first-play tutorial or
  strands the board away from its controls.
- Wordle's result dialog takes focus so Enter cannot immediately start a new
  round.
- Reduced-motion coverage now includes the splash, cover, reveal and hub-return
  motion.

## 3.0.0

Sixfold 3.0 introduced the current collection shell and result-card flow. The
3.0.x follow-ups are included in the 4.0.0 entry above.

Earlier release history lives in
[GitHub Releases](https://github.com/Moh23rd/Sixfold/releases).
