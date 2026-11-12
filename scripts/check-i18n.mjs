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

if (errors.length) {
  console.error('\nLocalization audit failed:\n');
  for (const message of errors) console.error('  ' + message);
  console.error('\nFix the catalogs, then run `npm run test:i18n` again.');
  process.exitCode = 1;
} else {
  console.log(
    '\nLocalization audit passed: ' + targets.length + ' catalogs, ' +
    messageCount + ' messages, ' + templateCount + ' templates.\n'
  );
}
