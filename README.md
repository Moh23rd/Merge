# Sixfold

![Sixfold — six games. no filler.](og-image.png)

Sixfold is a small, installable pocket arcade: six satisfying puzzle games in one offline web app. No accounts, no ads, no tracking — and it keeps working without a connection.

**[Play Sixfold →](https://moh23rd.github.io/Sixfold/)**

**Merge** · **Water Sort** · **One Line** · **Fruit Merge** · **Tic Tac Toe** · **Minesweeper**

## The games

- **Merge** — classic 2048. Slide the tiles, match equal numbers, reach 2048 and keep going. Also plays on a 3 × 3 or 5 × 5 board.
- **Water Sort** — pour colour until every tube holds one colour. Eight fixed levels, easy to hard.
- **One Line** — draw every link exactly once across 100 shapes in four chapters. Every shape starts from any dot, and clean solves earn up to three stars.
- **Fruit Merge** — a Suika-style drop-and-merge board with the canonical eleven-fruit chain and triangular pair scoring.
- **Tic Tac Toe** — X goes first. Play another person or take on one of three computer levels, including a Perfect opponent that cannot be beaten, only drawn.
- **Minesweeper** — Beginner 9 × 9, Intermediate 16 × 16 and Expert 30 × 16, with a safe first tap, flags and chording.

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

The app works offline after the first visit. If Chrome says it is installed but will not open, remove any old copy from the Home Screen or browser app settings and try again. On Chrome for Android 154–156, Chrome’s own install menu can confuse two apps on the same `github.io` origin; update Chrome to **157.0.8103.15** or newer. The hub shows this recovery note automatically on older builds and offers the page’s install prompt as a workaround.

## Privacy

No accounts, ads, analytics or third-party scripts. Boards, scores and appearance choices stay in local storage on the device. The light/dark choice is also kept in a first-party cookie so an installed app can pick matching launch chrome. The phone controls the bottom system bar, so that bar keeps the colour it was given at install time.

**Erase all data** in Look & feel removes every board, score, streak, saved shape and appearance choice. Each game also has its own reset in its bottom tool row.

## Running locally

Serve the repository root over localhost, because the service worker and install prompt need a real origin:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Opening `index.html` directly still plays, but offline caching and installation stay off.

## Project structure

```
index.html                 hub, game screens, help, install and rules sheets
styles.css                 shared shell, theme tokens and the 2048 board
home.css                   hub layout, six-piece intro and cartridge cards
games.css                  in-game screens and controls
polish.css                 motion, result cards and Wordle styles
game.js                    Merge (2048)
games.js                   Water Sort, One Line, Fruit Merge, Tic Tac Toe, Minesweeper
wordle.js                  the hidden five-letter game and its saved stats
wordle-words.js            offline answer and accepted-guess lists
theme.js                   palettes, light/dark, focus and appearance controls
overscroll.js              Android stretch overscroll on the hub
celebrate.js               result flourish and stamped seals
sharecard.js               share-card drawing for every game
sw.js                      offline cache (bump VERSION when assets change)
manifest*.webmanifest      install metadata for light and dark chrome
icons/, splash/, fonts/    app icons, iOS launch images and the typeface
```

The site is published with GitHub Pages from the `main` branch root. No build step is required.

## Release notes

Release notes and version history live in [GitHub Releases](https://github.com/Moh23rd/Sixfold/releases).

## Rules references

The games were checked against their original rules: Gabriele Cirulli’s 2048, Nintendo’s Suika Game (fruit chain and pair scoring), the standard Minesweeper field sizes and first-click convention, classic water-sort rules, Euler-trail puzzles for One Line, and standard tic-tac-toe with a minimax opponent.

## Credits and licence

Game code is released under the [MIT License](LICENSE). The Google Sans Flex typeface is included under the [SIL Open Font License 1.1](fonts/OFL.txt).

Questions or bug reports: [mohrd9685@gmail.com](mailto:mohrd9685@gmail.com).
