from pathlib import Path
import re
import subprocess

ROOT = Path.cwd()

CSS = ['styles.css', 'games.css', 'home.css', 'polish.css', 'sudoku.css']
JS = ['celebrate.js', 'game.js', 'games.js', 'haptics.js', 'install.js',
      'overscroll.js', 'sharecard.js', 'sudoku.js', 'theme.js',
      'wordle-loader.js', 'wordle-words.js', 'wordle.js']

for folder, names in (('css', CSS), ('js', JS)):
    (ROOT / folder).mkdir(exist_ok=True)
    for name in names:
        subprocess.run(['git', 'mv', name, f'{folder}/{name}'], cwd=ROOT, check=True)

def edit(path, pairs, regex=False):
    file = ROOT / path
    text = file.read_text(encoding='utf-8')
    for old, new in pairs:
        if regex:
            text, count = re.subn(old, new, text)
        else:
            count = text.count(old)
            text = text.replace(old, new)
        if count == 0:
            raise SystemExit(f'{path}: missing {old!r}')
    file.write_text(text, encoding='utf-8')

# HTML: assets live under css/ and js/; the service worker stays at root for scope.
edit('index.html', [
    (r'href="(styles|games|home|polish|sudoku)\.css', r'href="css/\1.css'),
    (r'src="(celebrate|game|games|haptics|install|overscroll|sharecard|sudoku|theme|wordle-loader|wordle-words|wordle)\.js', r'src="js/\1.js'),
], regex=True)

# The moved stylesheet must walk up one directory to reach the bundled font.
edit('css/styles.css', [('url("fonts/', 'url("../fonts/')])

# Remove the retired beta wording from the two section comments.
edit('css/games.css', [('Beta home — the pocket puzzle annual', 'Home — the pocket puzzle annual')])
edit('css/home.css', [('Beta home v2 — the pocket arcade', 'Home v2 — the pocket arcade')])

# The hidden Wordle files are now loaded from js/.
edit('js/wordle-loader.js', [
    ("'wordle-words.js", "'js/wordle-words.js"),
    ("'wordle.js", "'js/wordle.js"),
])

# Offline shell follows the new paths and gets a fresh cache generation.
sw = ROOT / 'sw.js'
text = sw.read_text(encoding='utf-8')
for name in CSS:
    text = text.replace("'./" + name, "'./css/" + name)
for name in JS:
    text = text.replace("'./" + name, "'./js/" + name)
text = text.replace('sixfold-4.0.1', 'sixfold-4.0.2')
sw.write_text(text, encoding='utf-8')

# Release check understands the organised layout and protects it.
check = ROOT / 'scripts/check-4.0.mjs'
text = check.read_text(encoding='utf-8')
text = text.replace("  'sw.js',\n", "  'sw.js',\n  'css/styles.css',\n  'js/game.js',\n")
text = text.replace('sixfold-4.0.1', 'sixfold-4.0.2')
text = text.replace(
    "  ['service worker caches the license page', sw.includes(\"'./licenses.html'\")],\n",
    "  ['service worker caches the license page', sw.includes(\"'./licenses.html'\")],\n"
    "  ['index links the organised stylesheet', index.includes('href=\"css/styles.css')],\n"
    "  ['index loads the organised game code', index.includes('src=\"js/games.js')],\n"
)
check.write_text(text, encoding='utf-8')

# README layout block matches the real tree.
readme = ROOT / 'README.md'
text = readme.read_text(encoding='utf-8')
old = '''```
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
```'''
new = '''```
index.html                  hub, game screens, help, install and rules
licenses.html               licence and App Store notice
css/                        shell, hub, game, Sudoku and polish styles
js/                         game logic, Sudoku, Wordle, theme and interface
sw.js                       offline shell
manifest*.webmanifest       install metadata
fonts/, icons/, splash/     bundled assets
.github/, scripts/          release checks
```'''
if old not in text:
    raise SystemExit('README: project layout block not found')
readme.write_text(text.replace(old, new), encoding='utf-8')

# Remove the temporary organisation workflow and this script from the tree.
(ROOT / '.github/workflows/organise-assets.yml').unlink()
Path(__file__).unlink()

print('organised', len(CSS), 'stylesheets and', len(JS), 'scripts')
