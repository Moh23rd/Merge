# Wordle dictionary audit

Audit date: 2026-11-13

Scope: `wordle-words.js`, `wordle-locales/*.js`, the files that load them, and
the project’s attribution files. This is an engineering and editorial review,
not legal advice.

## Verdict

The dictionaries are structurally and mechanically valid, but the current data
is **not ready to ship as a curated, family-friendly Wordle answer pool**.

- Every answer and valid guess is exactly five user-perceived characters.
- Answers are subsets of valid guesses, with no duplicates, whitespace or
  mixed-case entries.
- IME and keyboard-row invariants pass: native-input locales expose no rows,
  and every non-IME layout covers all answer and valid-guess graphemes.
- The English list has a small number of ambiguous brand/proper-name entries
  and technical words.
- The non-English answer pools are largely **frequency-list strings**, not
  curated words: function words, inflections, headline terms, countries,
  politicians, brands and some profanity.
- Provenance and licensing are not recorded well enough to redistribute the
  data confidently. There are no pinned source revisions or full notices in
  the app.

Run the repeatable check with:

```sh
npm run audit:wordle
npm run audit:wordle:strict
```

The first prints the review findings and exits non-zero only when a structural
or data invariant fails. The strict command also exits non-zero while the
provenance and policy findings remain, and is the intended release gate.

## Inventory

The structural and invariant validators found zero errors.

| Locale | Answers | Valid guesses | Input | Policy hits |
| --- | ---: | ---: | --- | ---: |
| English (`en`) | 814 | 14,855 | base rows | 33 |
| Arabic (`ar`) | 400 | 12,000 | IME | 48 |
| German (`de`) | 400 | 2,382 | rows | 23 |
| Spanish (`es`) | 400 | 2,696 | rows | 16 |
| French (`fr`) | 400 | 2,724 | rows | 19 |
| Hindi (`hi`) | 100 | 1,039 | IME | 22 |
| Japanese (`ja`) | 300 | 566 | IME | 21 |
| Korean (`ko`) | 300 | 312 | IME | 34 |
| Brazilian Portuguese (`pt-BR`) | 400 | 2,801 | rows | 18 |
| Simplified Chinese (`zh-Hans`) | 300 | 587 | IME | 94 |
| Traditional Chinese (`zh-Hant`) | 300 | 587 | IME | 94 |

“Policy hits” are entries found by the curated denylist and named-entity
patterns in `scripts/wordle-audit-policy.json`. They are a lower bound, not an
exhaustive count.

## Dictionary invariants

`npm run audit:wordle` fails hard on any of these:

- `answers` and `valid` are non-empty arrays of non-empty strings.
- Every entry is exactly five grapheme clusters, with no whitespace, non-NFC
  text or non-lower-case letters.
- Neither list contains duplicate entries.
- Every answer appears in the valid-guess list.
- `ime`, when present, is a boolean and matches the locale policy.
- IME locales (`ar`, `hi`, `ja`, `ko`, `zh-Hans`, `zh-Hant`) set `ime: true`
  and declare no keyboard rows; the game uses its native input field.
- Non-IME locales use the base rows or declare their own. Rows are non-empty,
  every key is exactly one grapheme, action keys are not stored in the data,
  keys are unique across the whole keyboard, and the rows collectively cover
  every grapheme used by all answers and valid guesses. Coverage matters
  because `wordle.js` accepts a tapped key only when it is in `KEY_CHARS`.

The check is run in CI with `npm run audit:wordle`; a structural or invariant
failure fails the build. `npm run audit:wordle:strict` remains the stronger
manual/release gate for the known provenance and editorial debt.

## Sources and licensing

### English list

`wordle-words.js` says the answers are a “common-word subset of the original
Wordle answer list” and the valid guesses are the “full five-letter Wordle
guess list.” It records no URL, revision or license.

The original Wordle source was publicly readable, and third-party mirrors such
as [`stuartpb/wordles`](https://github.com/stuartpb/wordles) describe the raw
lists as commonly considered public domain. That is not an authoritative
license from The New York Times, and the NYT has sent copyright takedown
notices to Wordle clones ([CBS News, 2024](https://www.cbsnews.com/news/nyt-copyright-takedown-wordle-clones-new-york-times/)).
The repository should not rely on “the original Wordle list” as its provenance
while shipping under GPLv3 without a reviewed data license.

### Non-English lists

Every locale file begins with the same claim:

> Adapted from Wordle Global (MIT), wordfreq and Wordle JP (MIT), filtered to
> five user-perceived characters.

That is not enough to establish redistribution rights:

- **Wordle Global** — its public repository is
  [Hugo0/wordle](https://github.com/Hugo0/wordle). Its README licenses the
  **original code** under MIT and credits wooorm/dictionaries, FrequencyWords,
  wordfreq, Wordles of the World and contributor data. The MIT license does
  not, by itself, grant MIT rights over every word list contributed to the
  project. The current wordle.global site also reserves its word lists in its
  terms. A source file, commit or data license for each language is missing.
- **wordfreq** — [rspeer/wordfreq](https://github.com/rspeer/wordfreq) is
  Apache-2.0 for code, but its data files are
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The wordfreq
  README explicitly warns that converting the data to a plain CSV/word list
  removes the attribution and does not follow the data license. The packs need
  the wordfreq attribution, license link and a statement of changes.
- **Wordle JP** — the header does not identify which project or revision. The
  current [sen-ltd/wordle-jp](https://github.com/sen-ltd/wordle-jp) is MIT and
  describes a small curated list, while other Japanese Wordle projects use
  separate dictionary terms (NICT, JMdict, IPAdic and others). The Japanese
  answer pool contains brands and names that are not explained by the cited
  MIT list, so the attribution is incomplete.
- The upstream Wordle Global credits also include
  [wooorm/dictionaries](https://github.com/wooorm/dictionaries) (per-language
  Hunspell licenses), [FrequencyWords](https://github.com/hermitdave/FrequencyWords)
  and other data. None is named in this repository.

The app has no dictionary notice in `README.md` or `licenses.html`. The license
view only covers GPLv3, the App Store exception and the font. At minimum, any
redistributed derivative needs source, revision, license, attribution and a
description of the changes.

## Answer-pool review

### Method

1. Loaded all 11 dictionaries and checked shape, grapheme length, duplicates,
   answer/guess membership, script coverage and normalization.
2. Reviewed every answer list manually, with emphasis on short, frequent strings
   that are likely to be names, brands, political terms, profanity or sentence
   fragments.
3. Encoded the reproducible subset in
   `scripts/wordle-audit-policy.json`; the audit reports curated hits plus
   named-entity/administrative patterns for Chinese, Korean and Hindi.

### Cross-locale finding

The non-English answers are not translations of the English answers and are
not curated answer pools. They are the most frequent five-grapheme strings in a
frequency corpus. That produces:

- articles, prepositions, pronouns and conjugated verbs instead of guessable
  common nouns;
- countries, cities, politicians, parties, religious terms and news events;
- brands, bands, films and technology terms;
- abbreviations, sentence fragments and phrases with particles;
- accidental profanity and sexual slang.

Chinese and Traditional Chinese are largely two script renderings of the same
300-entry frequency list, with a few regional variants, not two independently
localized lists.

### Confirmed examples

**English**

- Profanity/sexual slang: `booty`.
- Ambiguous brand/proper-name entries with common lowercase senses: `adobe`,
  `bible`, `billy`, `bobby`, `canon`, `china`, `chile`, `dutch`, `excel`,
  `harry`, `pixel`, `ralph`, `robin`, `roger`, `sally`, `smith`, `sonic`,
  `vista`, `welsh`.
- Technical/online words: `admin`, `anime`, `cyber`, `email`, `inbox`, `login`,
  `modem`, `proxy`, `rehab`, `scuba`, `sigma`, `theta`, `turbo`, `viral`.

**Spanish**

- Proper names, countries and cities: `jesús`, `maría`, `pedro`, `pablo`,
  `david`, `jorge`, `diego`, `lópez`, `pérez`, `reyes`, `china`, `chile`,
  `india`, `japón`, `rusia`, `parís`.
- Most other answers are high-frequency function words or inflections
  (`sobre`, `tiene`, `desde`, `ahora`, `están`) rather than a curated noun set.
- The accepted-guess pool also contains `joder`, `polla`, `porno`, `porro`,
  `zorra` and similar terms. They are not answers, but a family-friendly game
  still needs a deliberate guess-list policy.

**French**

- Profanity: `merde`, `chier`.
- Proper names, places and religious terms: `jésus`, `paris`, `marie`,
  `louis`, `david`, `james`, `peter`, `seine`, `lille`, `syrie`, `maroc`,
  `chine`, `japon`, `islam`, `juifs`.
- English loanwords/abbreviations: `black`, `perso`.

**German**

- Profanity: `arsch`.
- Political/religious/proper terms: `nazis`, `juden`, `islam`, `jesus`,
  `trump`, `peter`, `frank`, `maria`, `david`, `klaus`, `georg`, `heinz`,
  `simon`, `josef`, `japan`, `polen`, `paris`, `china`, `rhein`, `mainz`.
- English loanwords: `black`, `sorry`.

**Brazilian Portuguese**

- Profanity: `merda`, `porra`.
- Proper names, places and brands: `jesus`, `maria`, `pedro`, `silva`,
  `dilma`, `harry`, `bahia`, `índia`, `japão`, `paris`, `china`, `porto`,
  `natal`.
- English/European-Portuguese forms: `world`, `facto`, and the older spelling
  `idéia`.

**Arabic**

The answers include `اليمن`, `إيران`, `سوريا`, `لبنان`, `روسيا`, `الصين`,
`تركيا`, `فرنسا`, `الهند`, `ليبيا`, `باريس`, `بيروت`, `مدريد`, `القدس`,
`بغداد`, `كوريا`, `سورية`, `مصرية`, `رمضان`, `تويتر`, `النبي`, `الشيخ`,
`السيد`, `الحسن`, `مصطفى`, `سلمان`, `مبارك`, `عثمان`, `مايكل`, `ماريا`,
`والله`, `بالله`, `اللهم` and `تعالى`, alongside violence/politics terms such
as `الحرب`, `الجيش`, `السجن`, `جريمة`, `العنف`, `القتل`, `معركة`, `الحزب`
and `الملك`, and the sexual term `الجنس`. This is a news/corpus vocabulary,
not a word-game answer pool.

**Hindi**

The 100 answers are almost entirely news and political vocabulary:
`केजरीवाल`, `इलाहाबाद`, `हैदराबाद`, `गोरखपुर`, `तमिलनाडु`, `देहरादून`,
`उदयपुर`, `अमृतसर`, `जबलपुर`, `फतेहपुर`, `महाभारत`, `परशुराम`, `मनमोहन`,
`राजकुमार`, `आईपीएल`, `मुसलमान`, `मुसलमानों`, `आतंकवादी` and `नरसंहार`.
Several entries are inflected or misspelled (`मुसलमानो`) rather than
standalone dictionary forms.

**Japanese**

The answers mix words, sentence fragments and names:

- sentence fragments/particle phrases: `をめぐって`, `にたいして`, `というのも`,
  `それでいて`, `でなければ`, `ようするに`, `だとすると`, `にわたって`;
- names, brands and places: `とんねるず`, `しんのすけ`, `たまごっち`,
  `ひたちなか`, `なっちゃん`, `ぐらんぷり`;
- profanity/sexual terms: `ちくしょう`, `ざまあみろ`, `いやらしい`,
  `おしゃぶり`.

A Japanese answer pool needs native-speaker curation around standalone
hiragana words; many of these would be rejected as “not a word” by players.

**Korean**

The answers are dominated by proper nouns, brands, technology and foreign
loanwords: `방탄소년단`, `스포츠토토`, `셰익스피어`, `스파이더맨`,
`메르세데스`, `포켓몬스터`, `롯데시네마`, `현대캐피탈`, `월스트리트`,
`크리스마스`, `안드로이드`, `아이스크림`, `인도네시아`, `캘리포니아`,
`엘리자베스`, `다이아몬드`, `바르셀로나`, `팔레스타인`, plus administrative
names such as `인천광역시`, `대구광역시` and `서울특별시`. This is not a
playable common-word pool.

**Chinese**

The 300 “answers” are overwhelmingly political entities, institutions,
historical events and fixed phrases: `中国共产党`, `天安门广场`,
`文化大革命`, `中央电视台`, `华尔街日报`, `美国国务院`, `南京大屠杀`,
`邓小平理论`, `一九八九年`, `联合国大会`, `北京青年报`, `西藏自治区`,
`香港基本法`, `百分之九十`, `第二十四条`, `十万八千里`. Many are sensitive
political terms, numeric phrases or four-character idioms padded into a
five-character cell. The Traditional Chinese list is a script conversion of
the same content.

### Translation quality

There is no evidence that the non-English answers were translated or
semantically aligned with the English answer pool. The result is not a
localization of the game’s word choice; it is a frequency dump. A proper
localization needs native-speaker editorial review of both answers and valid
guesses, not machine transliteration of the English list.

## Reproducible validation path

Added:

- `scripts/audit-wordle-dictionaries.mjs` — dependency-free structural,
  invariant, provenance and answer-pool checks.
- `scripts/wordle-audit-policy.json` — the curated review policy and
  named-entity patterns.
- `npm run audit:wordle` — human-readable report.
- `npm run audit:wordle -- --json` — machine-readable report.
- `npm run audit:wordle:strict` — exits non-zero when provenance or policy
  findings exist.

The audit currently reports **0 structural errors, 0 invariant errors, 25
provenance findings and 27 policy findings**. The default command exits 0 with
review findings and is safe to run in CI; the strict command exits 1. This is
intentional until the data and notices are fixed.

### What is still missing for generation

There is no generator because the repository does not contain the source
snapshots. A reproducible build should add:

1. A pinned source manifest per locale (URL, commit/version, license, retrieval
   date and checksum).
2. A checked-in snapshot or download script for the exact source files.
3. A generator that filters to five graphemes, separates answers from valid
   guesses, applies the profanity/proper-noun/sensitive-term policy, and emits
   the current pack format.
4. A native-speaker review file naming the reviewer and the exceptions they
   approved.
5. A license/attribution page linked from the in-app licenses view and README.

Until then, the validator prevents new structural mistakes and makes the
editorial/provenance debt visible, but it cannot recreate the missing sources.

## Recommended remediation order

1. **Do not ship the current non-English answer pools.** Replace them with
   short, common, standalone words reviewed by native speakers; keep proper
   nouns, politics, religion, brands, sexual terms and sentence fragments out.
2. **Curate the English answer list.** Remove or explicitly justify `booty`,
   ambiguous proper-noun/brand entries and online/technical words. Keep a
   broader accepted-guess list if desired, but apply a profanity/slur policy to
   it too.
3. **Pin and license the sources.** Record source URLs, revisions, licenses and
   changes; add the wordfreq CC BY-SA attribution and the Wordle Global/Wordle
   JP notices. Replace the “original Wordle” English list with a
   reviewed-license source.
4. **Add the generated lists and review records to the repository**, not just
   the resulting minified data.
5. **Keep `audit:wordle` in CI** for structural and invariant regressions, then
   switch CI to `audit:wordle:strict` once the provenance and answer-pool debt
   is cleared.
