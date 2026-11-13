#!/usr/bin/env node
/*
 * Catalog completeness and placeholder audit.
 *
 * English strings in i18n.js are the source of truth. Every translated
 * catalog must contain exactly the same message keys, with the same numbered
 * placeholders, and no empty copy. The newer catalogs use a named template
 * table; those templates must match i18n-patterns.js in both keys and
 * placeholders. This catches a missing translation before the UI silently
 * falls back to English, and catches a template that drops or renumbers an
 * argument before it produces a broken status line at runtime.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function fail(message) {
  errors.push(message);
}

function read(file) {
  return readFileSync(join(root, file), 'utf8');
}

function evaluate(file, context) {
  vm.runInNewContext(read(file), context, { filename: file });
}

function extract(source, label, pattern) {
  const match = source.match(pattern);
  if (!match) {
    throw new Error('Could not locate ' + label + ' in i18n.js');
  }
  return vm.runInNewContext('(' + match[1] + ')');
}

function placeholders(value) {
  // A translation may need the same argument twice (for example, repeating
  // the digit name in a sentence). Compare the set of arguments, not how
  // many times each one appears.
  return [...new Set([...String(value).matchAll(/\{(\d+)\}/g)].map((match) => Number(match[1])))]
    .sort((a, b) => a - b)
    .join(',');
}

function namedPlaceholders(value) {
  // Wordle's copy uses {name} arguments rather than the numbered placeholders
  // in the main catalogs. Compare the same way: the set, not the repetition.
  return [...new Set([...String(value).matchAll(/\{([A-Za-z_]\w*)\}/g)].map((match) => match[1]))]
    .sort()
    .join(',');
}

function checkMessages(locale, messages, english) {
  if (!messages || typeof messages !== 'object' || Array.isArray(messages)) {
    fail(locale + ': messages must be an object');
    return 0;
  }

  const expected = Object.keys(english);
  const actual = Object.keys(messages);
  const missing = expected.filter((key) => !(key in messages));
  const extra = actual.filter((key) => !(key in english));

  if (missing.length) {
    fail(locale + ': ' + missing.length + ' missing message(s): ' + missing.slice(0, 8).join(' | '));
  }
  if (extra.length) {
    fail(locale + ': ' + extra.length + ' unknown message key(s): ' + extra.slice(0, 8).join(' | '));
  }

  for (const key of expected) {
    if (!(key in messages)) continue;
    const value = messages[key];
    if (typeof value !== 'string' || !value.trim()) {
      fail(locale + ': empty message for "' + key + '"');
      continue;
    }
    if (placeholders(value) !== placeholders(key)) {
      fail(locale + ': placeholder mismatch for "' + key + '"');
    }
  }

  return actual.length;
}

function checkTemplates(locale, templates, sourceText) {
  if (!templates || typeof templates !== 'object' || Array.isArray(templates)) {
    fail(locale + ': templates must be an object');
    return 0;
  }

  const expected = Object.keys(sourceText);
  const actual = Object.keys(templates);
  const missing = expected.filter((key) => !(key in templates));
  const extra = actual.filter((key) => !(key in sourceText));

  if (missing.length) {
    fail(locale + ': ' + missing.length + ' missing template(s): ' + missing.slice(0, 8).join(' | '));
  }
  if (extra.length) {
    fail(locale + ': ' + extra.length + ' unknown template(s): ' + extra.slice(0, 8).join(' | '));
  }

  for (const key of expected) {
    if (!(key in templates)) continue;
    const value = templates[key];
    if (typeof value !== 'string' || !value.trim()) {
      fail(locale + ': empty template for "' + key + '"');
      continue;
    }
    if (placeholders(value) !== placeholders(sourceText[key])) {
      fail(
        locale + ': template placeholder mismatch for "' + key + '" (expected {' +
        placeholders(sourceText[key]) + '}, found {' + placeholders(value) + '})'
      );
    }
  }

  return actual.length;
}

function checkWordleStrings(locale, messages, english) {
  if (!messages || typeof messages !== 'object' || Array.isArray(messages)) {
    fail('Wordle ' + locale + ': messages must be an object');
    return 0;
  }

  const expected = Object.keys(english);
  const actual = Object.keys(messages);
  const missing = expected.filter((key) => !(key in messages));
  const extra = actual.filter((key) => !(key in english));

  if (missing.length) {
    fail('Wordle ' + locale + ': ' + missing.length + ' missing message(s): ' + missing.slice(0, 8).join(' | '));
  }
  if (extra.length) {
    fail('Wordle ' + locale + ': ' + extra.length + ' unknown message key(s): ' + extra.slice(0, 8).join(' | '));
  }

  for (const key of expected) {
    if (!(key in messages)) continue;
    const value = messages[key];
    if (typeof value !== 'string' || !value.trim()) {
      fail('Wordle ' + locale + ': empty message for "' + key + '"');
      continue;
    }
    if (namedPlaceholders(value) !== namedPlaceholders(english[key])) {
      fail('Wordle ' + locale + ': placeholder mismatch for "' + key + '"');
    }
  }

  return actual.length;
}

function checkWordPack(label, pack) {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
    fail(label + ': dictionary must be an object');
    return 0;
  }

  for (const field of ['answers', 'valid']) {
    const words = pack[field];
    if (!Array.isArray(words) || !words.length) {
      fail(label + ': ' + field + ' must be a non-empty array');
      continue;
    }
    if (words.some((word) => typeof word !== 'string' || !word.trim())) {
      fail(label + ': ' + field + ' contains a non-string or empty word');
    }
  }

  return Array.isArray(pack.answers) ? pack.answers.length : 0;
}

function checkMeta(locale, meta) {
  if (!meta || typeof meta !== 'object') {
    fail(locale + ': meta must be an object');
    return;
  }
  for (const field of ['title', 'description', 'ogDescription']) {
    if (typeof meta[field] !== 'string' || !meta[field].trim()) {
      fail(locale + ': empty meta.' + field);
    }
  }
}

const i18nSource = read('i18n.js');
const english = extract(
  i18nSource,
  'the English message catalog',
  /  var ES = (\{[\s\S]*?\n  \});\n\n  var PATTERNS/
);
const supported = extract(
  i18nSource,
  'the supported locale registry',
  /  var SUPPORTED = (\{[\s\S]*?\n  \});/
);

const window = {};
evaluate('i18n-patterns.js', { window });
const sourceText = window.SixfoldPatterns && window.SixfoldPatterns.text;
if (!sourceText) {
  console.error('i18n-patterns.js does not expose SixfoldPatterns.text');
  process.exit(1);
}

const catalogWindow = {};
for (const file of readdirSync(root)) {
  if (!/^i18n-.*\.js$/.test(file) || file === 'i18n.js' || file === 'i18n-patterns.js') continue;
  evaluate(file, { window: catalogWindow });
}
const catalogs = catalogWindow.SixfoldCatalogs || {};

// Spanish lives inside i18n.js next to the English source, so it has no
// separate catalog. Every other non-English locale needs one.
const targets = Object.keys(supported).filter((locale) => locale !== 'en' && locale !== 'es');
for (const locale of targets) {
  if (!catalogs[locale]) {
    fail(locale + ': supported locale has no catalog file');
  }
}
for (const locale of Object.keys(catalogs)) {
  if (!(locale in supported)) {
    fail(locale + ': catalog exists for an unsupported locale');
  }
}

let messageCount = 0;
let templateCount = 0;
for (const locale of targets) {
  const catalog = catalogs[locale];
  if (!catalog) continue;

  checkMeta(locale, catalog.meta);
  const messages = checkMessages(locale, catalog.messages, english);
  messageCount += messages;

  if (catalog.templates) {
    templateCount += checkTemplates(locale, catalog.templates, sourceText);
  } else if (Array.isArray(catalog.patterns)) {
    if (!catalog.patterns.length) fail(locale + ': patterns array is empty');
  } else {
    fail(locale + ': catalog has neither templates nor patterns');
  }

  if (!errors.some((message) => message.startsWith(locale + ':'))) {
    const kind = catalog.templates
      ? Object.keys(catalog.templates).length + ' templates'
      : catalog.patterns.length + ' patterns';
    console.log('  ok  ' + locale + ' — ' + messages + ' messages, ' + kind);
  }
}

// Wordle keeps the English source strings and every translation in its own
// catalog. Validate the same keys and named placeholders as the main catalogs.
const wordleWindow = {};
evaluate('wordle-i18n.js', { window: wordleWindow });
const wordleStrings = wordleWindow.SixfoldWordleStrings || {};
const expectedWordleLocales = Object.keys(supported).sort();
const actualWordleLocales = Object.keys(wordleStrings).sort();
const missingWordleLocales = expectedWordleLocales.filter((locale) => !(locale in wordleStrings));
const extraWordleLocales = actualWordleLocales.filter((locale) => !(locale in supported));
if (missingWordleLocales.length) {
  fail('Wordle: missing locale catalog(s): ' + missingWordleLocales.join(', '));
}
if (extraWordleLocales.length) {
  fail('Wordle: catalog exists for an unsupported locale: ' + extraWordleLocales.join(', '));
}

const englishWordle = wordleStrings.en;
let wordleStringCount = 0;
if (!englishWordle) {
  fail('Wordle: English catalog is missing');
} else {
  for (const locale of expectedWordleLocales) {
    if (!(locale in wordleStrings)) continue;
    wordleStringCount += checkWordleStrings(locale, wordleStrings[locale], englishWordle);
  }
}
if (!errors.some((message) => message.startsWith('Wordle'))) {
  console.log('  ok  Wordle strings — ' + expectedWordleLocales.length + ' locales, ' + wordleStringCount + ' messages');
}

// English uses wordle-words.js; every other locale has its own lazy pack.
const expectedPackLocales = expectedWordleLocales.filter((locale) => locale !== 'en');
const packDirectory = 'wordle-locales';
let packFiles = [];
try {
  packFiles = readdirSync(join(root, packDirectory))
    .filter((file) => file.endsWith('.js'))
    .sort();
} catch (err) {
  fail('Wordle: ' + packDirectory + '/ is missing');
}
const packLocales = packFiles.map((file) => file.slice(0, -3));
const missingPacks = expectedPackLocales.filter((locale) => packLocales.indexOf(locale) === -1);
const extraPacks = packLocales.filter((locale) => expectedPackLocales.indexOf(locale) === -1);
if (missingPacks.length) {
  fail('Wordle: missing dictionary pack(s): ' + missingPacks.join(', '));
}
if (extraPacks.length) {
  fail('Wordle: dictionary pack for an unsupported locale: ' + extraPacks.join(', '));
}

const englishWordsWindow = {};
evaluate('wordle-words.js', { window: englishWordsWindow });
let dictionaryCount = 0;
let wordCount = checkWordPack('Wordle en dictionary', englishWordsWindow.SixfoldWordleWords);
if (wordCount) dictionaryCount += 1;

for (const file of packFiles) {
  const locale = file.slice(0, -3);
  const packWindow = {};
  evaluate(packDirectory + '/' + file, { window: packWindow });
  const packs = packWindow.SixfoldWordleLocales || {};
  const keys = Object.keys(packs);
  if (keys.length !== 1 || keys[0] !== locale) {
    fail('Wordle ' + locale + ': pack must expose only its own locale');
    continue;
  }
  const answers = checkWordPack('Wordle ' + locale + ' dictionary', packs[locale]);
  if (answers) {
    dictionaryCount += 1;
    wordCount += answers;
  }
}

const loaderSource = read('wordle-loader.js');
const packList = loaderSource.match(/PACK_LOCALES\s*=\s*\[([\s\S]*?)\]/);
const declaredPacks = packList
  ? [...packList[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort()
  : [];
if (!packList) {
  fail('Wordle: could not find PACK_LOCALES in wordle-loader.js');
} else if (declaredPacks.join(',') !== expectedPackLocales.join(',')) {
  fail('Wordle: PACK_LOCALES does not match the supported locale packs');
}
if (!errors.some((message) => message.startsWith('Wordle'))) {
  console.log('  ok  Wordle dictionaries — ' + dictionaryCount + ' dictionaries, ' + wordCount + ' answers');
}

if (errors.length) {
  console.error('\nLocalization audit failed:\n');
  for (const message of errors) console.error('  ' + message);
  console.error('\nFix the catalogs and Wordle dictionaries, then run `npm run test:i18n` again.');
  process.exitCode = 1;
} else {
  console.log(
    '\nLocalization audit passed: ' + targets.length + ' catalogs, ' +
    messageCount + ' messages, ' + templateCount + ' templates; Wordle: ' +
    expectedWordleLocales.length + ' locales, ' + dictionaryCount + ' dictionaries.\n'
  );
}
