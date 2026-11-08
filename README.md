# Sixfold 1.0

![Sixfold — six calm puzzle games](https://moh23rd.github.io/Sixfold/og-image.png?v=1.0)

Six calm puzzle games in one page. No accounts, no ads, no tracking — and it keeps working offline.

**[Play Sixfold →](https://moh23rd.github.io/Sixfold/)**

**Merge** · **Water Sort** · **One Line** · **Fruit Merge** · **Tic Tac Toe** · **Minesweeper**

Built as a small installable web app: plain HTML, CSS and JavaScript, no framework, no build step.

## The games

- **Merge** — classic 2048. Slide the tiles, match equal numbers, reach 2048 and keep going. Also plays on a 3 × 3 or 5 × 5 board.
- **Water Sort** — pour colour until every tube holds one colour. Eight fixed levels, easy to hard.
- **One Line** — draw every link exactly once. Ten shapes, each solvable from any dot.
- **Fruit Merge** — a Suika-style drop-and-merge board with the canonical eleven-fruit chain and triangular pair scoring.
- **Tic Tac Toe** — X goes first against a Perfect opponent that cannot be beaten, only drawn.
- **Minesweeper** — Beginner 9 × 9, Intermediate 16 × 16 and Expert 30 × 16, with a safe first tap, flags and chording.

Every game saves its own board, best score and progress on the device, so closing the tab never loses a round.

## Install

- **Android / Chrome:** open **How to play** and tap **Install app** when it appears.
- **iPhone / Safari:** tap **Share**, then **Add to Home Screen**.
- **Other browsers:** use the browser menu’s **Install** or **Add to Home Screen** option.

The app works offline after the first visit. If Chrome says it is installed but will not open, remove any old copy from the Home Screen or browser app settings and try again.

## Privacy

No accounts, ads, analytics or third-party scripts. Boards, scores and appearance choices stay in local storage on the device. The light/dark choice is also kept in a first-party cookie so an installed app can pick matching launch chrome. The phone controls the bottom system bar, so that bar keeps the colour it was given at install time.

## Running locally

Serve the repository root over localhost, because the service worker and install prompt need a real origin:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Opening `index.html` directly still plays, but offline caching and installation stay off.

## Project structure

```
index.html                 hub, game screens, help and install sheets
styles.css                 shared shell, theme tokens, 2048 board
games.css                  hub cards and the five other games
game.js                    Merge (2048)
games.js                   Water Sort, One Line, Fruit Merge, Tic Tac Toe, Minesweeper
theme.js                   palettes, light/dark, focus and appearance controls
sw.js                      offline cache (bump VERSION when assets change)
manifest*.webmanifest      install metadata for light and dark chrome
icons/, splash/, fonts/    app icons, iOS launch images and the typeface
CHANGELOG.md               release history, including the beta builds
```

The site is published with GitHub Pages from the `main` branch root. No build step is required.

## Rules references

The games were checked against their original rules: Gabriele Cirulli’s 2048, Nintendo’s Suika Game (fruit chain and pair scoring), the standard Minesweeper field sizes and first-click convention, classic water-sort rules, Euler-trail puzzles for One Line, and standard tic-tac-toe with a minimax opponent.

## Credits and licence

Game code is released under the [MIT License](LICENSE). The Google Sans Flex typeface is included under the [SIL Open Font License 1.1](fonts/OFL.txt).

Questions or bug reports: [mohrd9685@gmail.com](mailto:mohrd9685@gmail.com).
