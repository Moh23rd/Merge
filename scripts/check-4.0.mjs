import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'index.html',
  'licenses.html',
  'LICENSE',
  'APPSTORE-EXCEPTION.md',
  'sw.js',
  'css/styles.css',
  'js/game.js',
  'manifest.webmanifest',
  'manifest-dark.webmanifest'
];

const missing = requiredFiles.filter((file) => !existsSync(join(root, file)));
if (missing.length > 0) {
  console.error(`Missing required 4.0 release file(s): ${missing.join(', ')}`);
  process.exit(1);
}

const read = (file) => readFileSync(join(root, file), 'utf8');
const index = read('index.html');
const licenses = read('licenses.html');
const sw = read('sw.js');

const checks = [
  ['index identifies the 4.0 release', index.includes('aria-label="Sixfold version 4.0"')],
  ['index links to the license page', index.includes('href="licenses.html"')],
  ['index declares its license', index.includes('rel="license" href="LICENSE"')],
  ['license page has the GPL heading', licenses.includes('GNU General Public License')],
  ['license page documents the App Store exception', licenses.includes('App Store')],
  ['service worker caches the 4.0 release', sw.includes("sixfold-4.0.2")],
  ['service worker caches the license page', sw.includes("'./licenses.html'")],
  ['index links the organised stylesheet', index.includes('href="css/styles.css')],
  ['index loads the organised game code', index.includes('src="js/games.js')],
  ['index does not expose the 5.1 release', !index.includes('version 5.1') && !index.includes('v=5.1.0')]
];

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name);
if (failed.length > 0) {
  console.error('4.0 release check failed:');
  for (const name of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`4.0 release check passed (${checks.length} assertions across ${requiredFiles.length} files).`);
