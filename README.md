# merge — 2048

A calm little slide-and-merge puzzle. This is the complete static app (v48), with no build step, server code, database or account system.

Live copy: https://site-58d4c06196df4e3aa353fcca2f921cf1.freebuff.page/  
Contact: mohrd9685@gmail.com

## Play locally

1. Unzip the archive.
2. Open `index.html` in a modern browser.

The game works from a folder for ordinary play. Install and offline support need the files to be served over HTTPS or from localhost. For a local server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Publishing on GitHub

**GitHub Pages does not turn a `.zip` file into a website.** You have two options:

### Publish the game as a website

1. Unzip this archive.
2. Create a repository and upload the **contents** of the unzipped folder, not the folder itself. Keep `index.html` at the top level, with `icons/`, `fonts/`, `splash/`, `og-image.png` and the other files beside it.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
5. GitHub will publish the game at `https://<your-user>.github.io/<repository>/`.

GitHub Pages supplies HTTPS, so the install and offline features will work there.

### Keep the ZIP as a download

If you want GitHub to store the ZIP for people to download, create a release, choose **Draft a new release**, and attach `merge-2048-v48.zip`. GitHub will keep it as a release asset; it will not run it as a website.

## Before GitHub Pages becomes the permanent address

The page currently points its canonical and social-sharing URLs at the live Freebuff copy. If GitHub Pages becomes the main address, update those URLs near the top of `index.html` to the GitHub Pages address. That makes link previews and search engines use the new address. Once the GitHub Pages URL is known, this is a small edit.

## What is inside

- `index.html` — page, how-to-play, install guidance, privacy and contact
- `styles.css` — layout, themes, colours and accessibility states
- `game.js` — game logic, keyboard controls, result card and sharing
- `theme.js` — theme, palette, settings and focus handling
- `haptics.js` — vibration feedback
- `install.js` — Android install prompt and iPhone instructions
- `sw.js` — offline cache (v48)
- `manifest.webmanifest` and `manifest-dark.webmanifest` — install metadata and icons
- `icons/` — home-screen and app icons
- `splash/` — iOS launch images
- `fonts/` — Space Grotesk typeface and its licence
- `og-image.png` — social-sharing card
- `.nojekyll` — tells GitHub Pages to serve the files as they are

The app keeps the board, best scores and appearance choices in the browser. There are no accounts, ads, analytics or third-party trackers.
