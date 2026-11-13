#!/usr/bin/env node
/*
 * Reproducible audit for the Wordle dictionaries.
 *
 * Structural and data-invariant checks are hard failures: a pack that breaks
 * them can break the board or make words impossible to type. Provenance and
 * answer-pool policy checks are reported by default and become hard failures
 * with --strict, so this can be used as a review tool without pretending the
 * current data already satisfies the policy.
 *
 *   npm run audit:wordle
 *   npm run audit:wordle:strict
 *   node scripts/audit-wordle-dictionaries.mjs --json
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const json = process.argv.includes('--json');
const policy = JSON.parse(readFileSync(join(root, 'scripts/wordle-audit-policy.json'), 'utf8'));
const findings = { structural: [], invariants: [], provenance: [], policy: [] };
const report = { generatedAt: new Date().toISOString(), packs: [], findings };

function read(file) {
  return readFileSync(join(root, file), 'utf8');
}

function evaluate(file) {
  const context = { window: {} };
  vm.runInNewContext(read(file), context, { filename: file });
  return context.window;
}

function header(file) {
  const match = read(file).match(/^\/\*([\s\S]*?)\*\//);
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function husk(list) {
  return [...new Set(list)];
}

function normalize(value, locale) {
  return String(value || '').normalize('NFC').toLocaleLowerCase(locale);
}

const BASE_KEY_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm']
];

const expectedLocales = ['en', 'ar', 'de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt-BR', 'zh-Hans', 'zh-Hant'];
const packFiles = new Map([['en', 'wordle-words.js']]);
for (const file of readdirSync(join(root, 'wordle-locales')).filter((name) => name.endsWith('.js'))) {
  packFiles.set(file.slice(0, -3), 'wordle-locales/' + file);
}

const actualLocales = [...packFiles.keys()].sort();
if (actualLocales.join(',') !== expectedLocales.slice().sort().join(',')) {
  findings.structural.push('pack locales are ' + actualLocales.join(', ') + ', expected ' + expectedLocales.slice().sort().join(', '));
}

const appText = policy.provenance.appAttributionFiles.map(read).join('\n');
for (const source of policy.provenance.localeSources) {
  if (!appText.includes(source)) {
    findings.provenance.push('README/licenses.html do not attribute ' + source);
  }
}

for (const locale of expectedLocales) {
  const file = packFiles.get(locale);
  const packReport = { locale, file, answers: 0, valid: 0, structural: [], invariants: [], provenance: [], policy: [] };
  if (!file) {
    findings.structural.push(locale + ': no dictionary file');
    report.packs.push(packReport);
    continue;
  }

  const text = read(file);
  const sourceHeader = header(file);
  const window = evaluate(file);
  const data = locale === 'en' ? window.SixfoldWordleWords : window.SixfoldWordleLocales && window.SixfoldWordleLocales[locale];
  if (!data) {
    findings.structural.push(locale + ': file does not expose a dictionary for its locale');
    report.packs.push(packReport);
    continue;
  }

  const answers = data.answers;
  const valid = data.valid;
  packReport.answers = Array.isArray(answers) ? answers.length : 0;
  packReport.valid = Array.isArray(valid) ? valid.length : 0;
  packReport.header = sourceHeader;

  const add = (bucket, message) => {
    findings[bucket].push(locale + ': ' + message);
    packReport[bucket].push(message);
  };

  for (const field of ['answers', 'valid']) {
    const list = data[field];
    if (!Array.isArray(list) || !list.length) {
      add('structural', field + ' must be a non-empty array');
      continue;
    }
    if (list.some((word) => typeof word !== 'string' || !word.trim())) {
      add('structural', field + ' contains an empty or non-string entry');
    }
    const seenEntries = new Set();
    const duplicateEntries = new Set();
    for (const word of list) {
      if (seenEntries.has(word)) duplicateEntries.add(word);
      seenEntries.add(word);
    }
    if (duplicateEntries.size) add('invariants', field + ' has duplicate entries: ' + husk([...duplicateEntries]).slice(0, 5).join(', '));
    if (list.some((word) => typeof word === 'string' && /\s/.test(word))) add('invariants', field + ' contains whitespace');
    if (list.some((word) => typeof word === 'string' && word !== word.normalize('NFC'))) add('invariants', field + ' contains non-NFC text');
    if (list.some((word) => typeof word === 'string' && word !== word.toLocaleLowerCase(locale))) add('invariants', field + ' is not lower-cased');
  }

  if (!Array.isArray(answers) || !Array.isArray(valid)) {
    report.packs.push(packReport);
    continue;
  }

  const segmenter = new Intl.Segmenter(locale, { granularity: 'grapheme' });
  const pieces = (word) => Array.from(segmenter.segment(word), (part) => part.segment);
  const length = (word) => pieces(word).length;
  for (const field of ['answers', 'valid']) {
    const wrong = data[field].filter((word) => typeof word === 'string' && length(word) !== 5);
    if (wrong.length) add('invariants', field + ' has non-five-grapheme entries: ' + wrong.slice(0, 8).join(', '));
  }

  const notValid = answers.filter((word) => valid.indexOf(word) === -1);
  if (notValid.length) add('invariants', 'answers missing from valid guesses: ' + notValid.slice(0, 8).join(', '));

  const localePolicy = policy.locales[locale] || {};
  const declaredIme = data.ime;
  if (declaredIme !== undefined && typeof declaredIme !== 'boolean') {
    add('invariants', 'ime must be a boolean when present');
  }
  const hasIme = declaredIme === true;
  const wantsIme = localePolicy.ime === true;
  if (hasIme !== wantsIme) {
    add('invariants', 'ime is ' + (hasIme ? 'enabled' : 'disabled') + '; policy expects ' + (wantsIme ? 'enabled' : 'disabled'));
  }
  if (hasIme) {
    if (data.rows !== undefined && (!Array.isArray(data.rows) || data.rows.length)) {
      add('invariants', 'IME packs must not declare keyboard rows');
    }
  } else {
    const rawRows = data.rows === undefined ? BASE_KEY_ROWS : data.rows;
    if (!Array.isArray(rawRows) || !rawRows.length) {
      add('invariants', 'non-IME packs need a non-empty keyboard rows array');
    } else {
      const keys = [];
      const seenKeys = new Set();
      for (const [rowIndex, rawRow] of rawRows.entries()) {
        const row = typeof rawRow === 'string' ? Array.from(rawRow) : rawRow;
        if (!Array.isArray(row) || !row.length) {
          add('invariants', 'keyboard row ' + (rowIndex + 1) + ' is empty or not a row');
          continue;
        }
        for (const key of row) {
          if (typeof key !== 'string' || !key) {
            add('invariants', 'keyboard row ' + (rowIndex + 1) + ' has an empty or non-string key');
            continue;
          }
          if (key === 'Backspace' || key === 'Enter') {
            add('invariants', 'keyboard rows must not contain the action key ' + key);
            continue;
          }
          if (/\s/u.test(key) || length(key) !== 1) {
            add('invariants', 'keyboard key ' + JSON.stringify(key) + ' is not one grapheme');
            continue;
          }
          const normalizedKey = normalize(key, locale);
          if (seenKeys.has(normalizedKey)) {
            add('invariants', 'keyboard has duplicate key ' + key);
            continue;
          }
          seenKeys.add(normalizedKey);
          keys.push(key);
        }
      }
      const keySet = new Set(keys.map((key) => normalize(key, locale)));
      for (const field of ['answers', 'valid']) {
        const missing = [];
        for (const word of data[field]) {
          if (typeof word !== 'string') continue;
          for (const part of pieces(word)) {
            if (!keySet.has(normalize(part, locale)) && !missing.includes(part)) missing.push(part);
          }
        }
        if (missing.length) {
          add('invariants', field + ' use graphemes missing from the keyboard: ' + missing.join(' '));
        }
      }
    }
  }

  const expectedScript = localePolicy.script;
  if (expectedScript) {
    const script = new RegExp('\\p{Script=' + expectedScript + '}', 'u');
    const allowedCommon = locale === 'ja' ? /[\u30fc]/u : null;
    const wrongScript = answers.filter((word) => typeof word !== 'string' || [...word].some((char) => !script.test(char) && !(allowedCommon && allowedCommon.test(char))));
    if (wrongScript.length) add('policy', 'answers use characters outside ' + expectedScript + ': ' + wrongScript.slice(0, 6).join(', '));
  }

  const hit = (field) => (localePolicy[field] || []).filter((word) => answers.includes(word));
  const profanity = hit('profanity');
  const proper = hit('properNouns');
  const loanwords = hit('loanwords');
  const obscure = hit('obscure');
  const patternHits = [];
  for (const pattern of (policy.patterns && policy.patterns[locale]) || []) {
    const regex = new RegExp(pattern, 'u');
    for (const word of answers) {
      if (regex.test(word) && !patternHits.includes(word)) patternHits.push(word);
    }
  }
  if (profanity.length) add('policy', 'profanity/sexual terms in answers: ' + profanity.join(', '));
  if (proper.length) add('policy', 'proper nouns, names, brands or political/religious terms in answers: ' + proper.join(', '));
  if (loanwords.length) add('policy', 'loanwords or non-standard forms in answers: ' + loanwords.join(', '));
  if (obscure.length) add('policy', 'obscure, technical or non-standalone entries in answers: ' + obscure.join(', '));
  if (patternHits.length) add('policy', 'answer entries matching named-entity/administrative patterns: ' + patternHits.slice(0, 12).join(', ') + (patternHits.length > 12 ? ' …' : ''));
  packReport.policy = { profanity, properNouns: proper, loanwords, obscure, patternHits };

  const provenance = [];
  if (locale === 'en') {
    if (new RegExp(policy.provenance.englishSourcePattern, 'i').test(sourceHeader)) {
      provenance.push('header claims the “original Wordle” list, but records no source URL, revision or license');
    }
  } else {
    const missingSources = policy.provenance.localeSources.filter((source) => !sourceHeader.includes(source));
    if (missingSources.length) provenance.push('header does not name ' + missingSources.join(', '));
    if (!/(https?:\/\/|commit|revision|\bv\d)/i.test(sourceHeader)) {
      provenance.push('header records no source URL or revision');
    }
    if (sourceHeader.includes('wordfreq') && !/(CC BY-SA|Apache-2\.0)/i.test(sourceHeader)) {
      provenance.push('header does not record wordfreq’s data/code licenses');
    }
  }
  if (!/(MIT|GPL|CC BY|Apache|public domain)/i.test(sourceHeader)) {
    provenance.push('header records no license');
  }
  for (const message of provenance) add('provenance', message);
  packReport.provenance = provenance;

  report.packs.push(packReport);
}

const structuralErrors = findings.structural.length;
const invariantErrors = findings.invariants.length;
const policyErrors = findings.provenance.length + findings.policy.length;
report.summary = {
  structuralErrors,
  invariantErrors,
  provenanceFindings: findings.provenance.length,
  policyFindings: findings.policy.length,
  strict,
  passed: structuralErrors === 0 && invariantErrors === 0 && policyErrors === 0
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('Wordle dictionary audit');
  console.log('=======================');
  for (const pack of report.packs) {
    const policyCount = pack.policy && pack.policy.profanity
      ? pack.policy.profanity.length + pack.policy.properNouns.length +
        pack.policy.loanwords.length + pack.policy.obscure.length + pack.policy.patternHits.length
      : 0;
    console.log(
      pack.locale.padEnd(7) + ' answers ' + String(pack.answers).padStart(4) +
      ' · valid ' + String(pack.valid).padStart(5) +
      ' · structural ' + (pack.structural.length ? 'FAIL' : 'ok') +
      ' · invariants ' + (pack.invariants.length ? 'FAIL' : 'ok') +
      ' · provenance ' + (pack.provenance.length ? 'FAIL' : 'ok') +
      ' · policy hits ' + policyCount
    );
  }
  console.log('\nStructural findings: ' + structuralErrors);
  for (const message of findings.structural) console.log('  FAIL ' + message);
  console.log('Invariant findings: ' + invariantErrors);
  for (const message of findings.invariants) console.log('  FAIL ' + message);
  console.log('Provenance findings: ' + findings.provenance.length);
  for (const message of findings.provenance) console.log('  REVIEW ' + message);
  console.log('Answer-pool policy findings: ' + findings.policy.length);
  for (const message of findings.policy) console.log('  REVIEW ' + message);
  if (structuralErrors || invariantErrors) console.log('\nAudit failed structural/invariant checks.');
  else if (policyErrors) console.log('\nAudit completed with review findings.');
  else console.log('\nAudit passed.');
  if (!strict && policyErrors) {
    console.log('Run with --strict to fail on provenance/policy findings.');
  }
}

if (structuralErrors || invariantErrors || (strict && policyErrors)) process.exitCode = 1;
