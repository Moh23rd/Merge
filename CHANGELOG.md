# Changelog

## Unreleased

### Changed

- **Daily Sixfold** now uses the same flat paper surfaces and hard edge as the
  rest of the hub, with no gradient wash. The section can be hidden from
  **Look & feel → Home** without losing streaks or check-ins.
- **The language picker** is a compact collapsed row that expands only when
  needed, instead of showing every language at once.
- **Sudoku settings** — larger digits, left-handed layout, hidden timer,
  mistake checking and input order — moved from the hub sheet into a
  **Sudoku settings** sheet on the Sudoku screen.

### Fixed

- Wordle now opens with the English word list when the selected language's
  dictionary has not been cached yet, such as the first visit while offline,
  instead of failing to load the game. That fallback round has its own save,
  separate from both the English game and localized games, so reconnecting
  starts the language's own round without touching an English round.
- Interface numbers now use Arabic-Indic digits in Arabic and Devanagari
  digits in Hindi, including scores, timers, daily counters and Sudoku
  digits, while dates and share text use the same locale-aware numerals.

### Added

- **Wordle pack prefetch**: after an online visit, the active language's
  dictionary is downloaded in the background and retried when the connection
  returns, so offline play opens in the selected language before the game is
  first launched.
- **Multilingual Wordle**: the hidden game now has localized board copy,
  result text and five-character dictionaries for all eleven interface
  languages, with a native input method for scripts that do not use the
  on-screen letter grid. Only the active language's dictionary is downloaded
  and cached.
- **Localization audit in CI**: `npm run test:i18n` checks every catalog against
  the English source for missing or unknown keys, empty copy and mismatched
  numbered placeholders, including the shared dynamic-copy templates. It also
  guards the Wordle strings and all eleven locale dictionaries.
- **Localized store listings and privacy policies** for Simplified and
  Traditional Chinese, Japanese, Korean, Brazilian Portuguese, Hindi and
  Arabic, alongside the English and Spanish store copy.
- **Seven more interface languages**: Simplified and Traditional Chinese,
  Japanese, Korean, Brazilian Portuguese, Hindi and Arabic. Each includes a
  complete catalog for the hub, all six games, settings, help, accessibility
  labels, validation messages, game status lines, dates and daily share text.
  Arabic switches the interface to right-to-left.
- **Offline script fonts** for Chinese, Japanese, Korean, Devanagari and Arabic,
  subset to the characters Sixfold actually uses, so translated screens keep a
  consistent face without a network request.
- **French and German localization**: complete catalogs for the hub, all six
  games, settings, help, accessibility labels, validation messages, game
  status lines, dates and daily share text. The language picker now offers
  eleven languages in a responsive grid on phones.
- **Locale layout tests** at 320px and 390px for every language, checking for
  clipped text and horizontal overflow alongside the existing light/dark axe
  scans.

## 5.1.0 — 12 November 2026

5.1 adds Spanish localization and native app-store wrappers while keeping the
game offline, account-free and free of ads or tracking.

### Added

- **Spanish localization**: an English/Spanish catalog covering the hub, game
  screens, settings, help, accessibility labels, validation messages, game
  status lines, dates and daily share text.
- **Language switch** in Look & feel, with the choice persisted on the device.
  The first visit follows the device language.
- **Native Android and iOS projects** generated with Capacitor 8, using the
  same app id `com.moh23rd.sixfold`, branded icons and light/dark splash
  screens.
- **Native-only plugin bundle** for the launch screen, status-bar colours and
  Android back navigation. The PWA never loads Capacitor core.
- **Native release material**: build and signing notes, English and Spanish
  store listings, review answers and a privacy policy.
- **Native build scripts** that stage only the public static shell and keep
  `native/www` reproducible.

### Changed

- The app version, service-worker cache and native build numbers move to
  5.1.0 / 510.
- The service worker is disabled inside the native shells; local storage and
  the existing save format are unchanged.
- Store-facing privacy copy now states that the Android WebView declares
  internet permission but the app sends no gameplay or personal data.

### Not shipped in this workspace

- No signed Android or iOS binary and no store upload. Both require the
  platform toolchains, signing identities and store accounts.

### Still deliberately out of scope

- No accounts, ads, subscriptions, global leaderboard or server-dependent
  daily puzzle.
- No friend-to-friend challenge inbox; the daily share link remains the first
  challenge primitive.

## 5.0.0 — 11 November 2026

5.0 is the Daily Sixfold release. It adds a reason to come back each day
without adding accounts, ads, tracking or a server.

### Added

- **Daily Sixfold**: a date-seeded challenge in every game — a seeded Merge
  board, Sudoku grid, Tic Tac Toe computer, Minesweeper field, Water Sort level
  and Fruit Merge run — plus a local streak, a best streak and a 30-day
  calendar. It works offline.
- **Daily runs stay separate**: a daily board never overwrites the player’s
  normal saved game, and only a finished daily challenge checks off the slot.
- **Daily Sudoku archive**: every date in the calendar produces the same seeded
  grid, and past days can be replayed.
- **Spoiler-free daily sharing**: a link carries the date, not the solution.
- **Sudoku Learn mode**: technique-aware hints for naked and hidden singles,
  auto-notes, optional mistake checking, a technique guide and a richer
  post-game summary.
- **Accessibility controls**: high contrast, colour-blind cues, larger Sudoku
  digits, left-handed landscape layout, timer hiding and cell-first or
  digit-first number entry.
- **Interface sounds** with a separate setting, plus pause/resume for Sudoku.
- **Backup and restore**: a JSON export of every board, score, streak and
  setting, and a guarded restore flow.
- **Persistent storage**: `navigator.storage.persist()` is requested where the
  browser supports it.
- **Update prompt**: a waiting service worker can be applied without a hard
  refresh.
- **Playwright and axe test suite**, plus GitHub Actions CI.
- **Feedback routes**: in-app Discussions and issue links, with bug and idea
  templates.

### Changed

- Sudoku hints now teach a technique before offering to place a digit. When no
  single is available, the panel says that it is revealing a cell.
- Daily progress is part of the collection shell, not a separate mode.
- Settings and backup live together under Look & feel.

### Still deliberately out of scope

- No accounts, ads, subscriptions, global leaderboard or server-dependent
  daily puzzle.
- Localization, a native app-store wrapper and a friend-to-friend challenge
  inbox remain separate future work; the daily share link is the first
  challenge primitive.

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
- Beta previews build through `beta.sh` and can never cache themselves as the
  release shell.

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
3.0.x follow-ups and preview iterations are included in the 4.0.0 entry above.

Earlier release history lives in
[GitHub Releases](https://github.com/Moh23rd/Sixfold/releases).
