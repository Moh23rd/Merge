import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'native/www');

const files = [
  'index.html',
  'licenses.html',
  'LICENSE',
  'APPSTORE-EXCEPTION.md',
  'styles.css',
  'home.css',
  'games.css',
  'polish.css',
  'sudoku.css',
  'v5.css',
  'celebrate.js',
  'daily.js',
  'game.js',
  'games.js',
  'haptics.js',
  'i18n.js',
  'i18n-fr.js',
  'i18n-de.js',
  'i18n-zh-hans.js',
  'i18n-zh-hant.js',
  'i18n-ja.js',
  'i18n-ko.js',
  'i18n-pt-br.js',
  'i18n-hi.js',
  'i18n-kn.js',
  'i18n-ar.js',
  'i18n-patterns.js',
  'install.js',
  'native.js',
  'overscroll.js',
  'settings.js',
  'sharecard.js',
  'theme.js',
  'sudoku.js',
  'theme.js',
  'update.js',
  'wordle-loader.js',
  'wordle-words.js',
  'wordle-i18n.js',
  'wordle.js',
  'manifest.webmanifest',
  'manifest-dark.webmanifest'
];

const directories = ['fonts', 'icons', 'splash', 'wordle-locales'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const file of files) cpSync(join(root, file), join(out, file));
for (const directory of directories) {
  cpSync(join(root, directory), join(out, directory), { recursive: true });
}

// Capacitor injects the bridge, but classic script pages also need the
// plugin proxies registered. Concatenate the official UMD builds into a
// native-only file so the web/PWA build never pays for Capacitor core.
const pluginSources = [
  'node_modules/@capacitor/core/dist/capacitor.js',
  'node_modules/@capacitor/app/dist/plugin.js',
  'node_modules/@capacitor/splash-screen/dist/plugin.js',
  'node_modules/@capacitor/status-bar/dist/plugin.js'
];
const pluginBundle = pluginSources.map(function (file) {
  return '/* ' + file + ' */\n' + readFileSync(join(root, file), 'utf8');
}).join('\n');
writeFileSync(join(out, 'native-plugins.js'), pluginBundle);

let shell = readFileSync(join(out, 'index.html'), 'utf8');
const nativeScript = /([ \t]*)<script src="native\.js\?v=[^"]+"><\/script>/;
if (!nativeScript.test(shell)) {
  throw new Error('native shell: could not find the native.js script tag');
}
shell = shell.replace(nativeScript, function (tag, indent) {
  return indent + '<script src="native-plugins.js"></script>\n' + tag;
});
writeFileSync(join(out, 'index.html'), shell);

// Capacitor serves the staged shell from its local origin. Keep a marker so
// support and store diagnostics can see which bundle is in the binary.
writeFileSync(join(out, 'native-build.txt'), 'Sixfold 5.1 native web bundle\n');
console.log('native web bundle ready:', out);
