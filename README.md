# Sixfold

![Sixfold — six games, no filler.](og-image.png)

Sixfold is a small, installable pocket arcade: six satisfying puzzle games in one offline web app. No accounts, no ads, no tracking, and no connection required.

**[Play Sixfold →](https://moh23rd.github.io/Sixfold/)**

**Merge** · **Sudoku** · **Tic Tac Toe** · **Minesweeper** · **Water Sort** · **Fruit Merge**

## The games

- **Merge** — classic 2048. Slide the tiles, match equal numbers, reach 2048 and keep going. Also plays on a 3 × 3 or 5 × 5 board.
- **Sudoku** — a standard 9 × 9 grid in Easy, Medium, Hard and Expert. Every puzzle has exactly one solution, with notes, undo, erase, hints, a timer and best times saved on the device.
- **Tic Tac Toe** — X goes first. Play another person or take on one of three computer levels, including a Perfect opponent that cannot be beaten, only drawn.
- **Minesweeper** — Beginner 9 × 9, Intermediate 16 × 16 and Expert 30 × 16, with a safe first tap, flags and chording.
- **Water Sort** — pour colour until every tube holds one colour. Eight fixed levels, easy to hard.
- **Fruit Merge** — a Suika-style drop-and-merge board with the canonical eleven-fruit chain and triangular pair scoring.

Every game saves its own board, best score and progress on the device, so closing the tab never loses a round.

## A small, considered arcade

- **Made for a phone, comfortable on a desk.** The hub and every game layout adapt from a 320px screen up to a wide desktop.
- **One look for the collection.** Light, dark or auto, with six colour palettes. The page and the browser chrome always match.
- **Quiet motion.** Springy entrances, tactile result cards and a stamped seal when a round is cleared, with a still fallback for reduced motion.
- **Play how you like.** Touch, mouse and full keyboard controls, plus screen-reader labels throughout.
- **Installable.** Add Sixfold to a home screen for an app-like window and offline play.

## Install

- **Android / Chrome:** open **About & privacy** from the hub and tap **Install app** when it appears.
- **iPhone / Safari:** tap **Share**, then **Add to Home Screen**.
- **Other browsers:** use the browser menu’s **Install** or **Add to Home Screen** option.

The app works offline after the first visit. If Chrome opens an older installed copy, update Chrome or use the in-page **Install app** prompt.

## Privacy

No accounts, ads, analytics or third-party scripts. Boards, scores and appearance choices stay in local storage on the device. The light/dark choice is also kept in a first-party cookie so an installed app can pick matching launch chrome. The phone controls the bottom system bar, so that bar keeps the colour it was given at install time.

**Erase all data** in Look & feel removes every board, score, streak, saved puzzle and appearance choice. Each game also has its own reset in its bottom tool row.

## Development

Serve the repository root over localhost, because the service worker and install prompt need a real origin:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Opening `index.html` directly still plays, but offline caching and installation stay off.

### Project layout

```
index.html                  hub, game screens, help, install and rules
licenses.html               licence and App Store notice
styles.css, home.css        shared shell, hub layout and theme tokens
games.css, polish.css       in-game screens and interface polish
sudoku.css                  Sudoku board and difficulty styles
game.js, games.js           game logic and controls
sudoku.js                   Sudoku generator, solver and saved progress
theme.js, sound.js          appearance, accessibility and interface behaviour
overscroll.js, celebrate.js interface effects
sharecard.js                result cards
sw.js                       offline shell
manifest*.webmanifest       install metadata
fonts/, icons/, splash/     bundled assets
.github/, scripts/          release checks
```

The site is published with GitHub Pages from the `main` branch root. No build step is required.

## Release notes

Version history lives in [CHANGELOG.md](CHANGELOG.md); tagged builds are on [GitHub Releases](https://github.com/Moh23rd/Sixfold/releases).

## Rules references

The games were checked against their original rules: Gabriele Cirulli’s 2048, Nintendo’s Suika Game (fruit chain and pair scoring), the standard Minesweeper field sizes and first-click convention, classic water-sort rules, standard Sudoku with unique solutions, and standard tic-tac-toe with a minimax opponent.

## Licence

Game code is released under the [GNU General Public License v3.0](LICENSE) (`GPL-3.0-only`). A separate [Apple App Store additional permission](APPSTORE-EXCEPTION.md) applies to App Store distribution. The Google Sans Flex typeface is included under the [SIL Open Font License 1.1](fonts/OFL.txt).

Questions or bug reports: [mohrd9685@gmail.com](mailto:mohrd9685@gmail.com).
