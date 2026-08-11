#!/usr/bin/env node
/*
 * Category README refresher
 * (c)2006-2025 Hawkynt
 *
 * The per-directory READMEs list which algorithms are implemented, and they were
 * maintained by hand. They drifted badly: the compression list named 24
 * implemented algorithms against 127 actually registered, and 12 of the 19
 * entries under "Missing Algorithms" had been implemented long since.
 *
 * So the implemented list is generated from the registry instead. The
 * not-yet-implemented list stays hand-written, because knowing what is worth
 * adding is a judgement no registry can make - but it is now *validated*: if an
 * entry there is registered, that is an error rather than a stale line nobody
 * noticed.
 *
 * Usage:
 *   node tools/refresh-readmes.js            rewrite the generated sections
 *   node tools/refresh-readmes.js --check    report drift, change nothing (CI)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CIPHER_ROOT = path.resolve(__dirname, '..');
const BEGIN = '<!-- BEGIN GENERATED ALGORITHM LIST -->';
const END = '<!-- END GENERATED ALGORITHM LIST -->';

//#region ===== registry =====

// Which file registered which algorithm: RegisterAlgorithm is wrapped while each
// source is loaded, so a name can be traced back to the file that owns it.
function loadRegistry() {
  const AlgorithmFramework = require(path.join(CIPHER_ROOT, 'AlgorithmFramework.js'));
  global.AlgorithmFramework = AlgorithmFramework;
  global.OpCodes = require(path.join(CIPHER_ROOT, 'OpCodes.js'));

  const owner = new Map();
  const original = AlgorithmFramework.RegisterAlgorithm;
  let current = null;
  AlgorithmFramework.RegisterAlgorithm = function (algorithm) {
    if (algorithm && algorithm.name && !owner.has(algorithm.name)) owner.set(algorithm.name, current);
    return original.apply(this, arguments);
  };

  const algorithmRoot = path.join(CIPHER_ROOT, 'algorithms');
  const byDirectory = new Map();
  for (const directory of fs.readdirSync(algorithmRoot).sort()) {
    const full = path.join(algorithmRoot, directory);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const file of fs.readdirSync(full).sort()) {
      if (!file.endsWith('.js')) continue;
      current = { directory, file };
      try { require(path.join(full, file)); } catch (error) { /* a broken file is the test suite's problem, not the README's */ }
    }
  }

  for (const algorithm of AlgorithmFramework.Algorithms || []) {
    const source = owner.get(algorithm.name);
    if (!source) continue;
    if (!byDirectory.has(source.directory)) byDirectory.set(source.directory, []);
    byDirectory.get(source.directory).push({ name: algorithm.name, file: source.file, description: algorithm.description || '' });
  }
  return byDirectory;
}

//#endregion

//#region ===== rendering =====

// One sentence is enough for an index; the generated reference carries the rest.
function firstSentence(text) {
  const cleaned = String(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const stop = cleaned.search(/\.(\s|$)/);
  return stop < 0 ? cleaned : cleaned.slice(0, stop);
}

function renderList(entries) {
  const sorted = entries.slice().sort((a, b) => a.name.localeCompare(b.name));
  const lines = [BEGIN, '', `${sorted.length} implemented, generated from the registry by \`tools/refresh-readmes.js\`.`, ''];
  for (const entry of sorted) {
    const summary = firstSentence(entry.description);
    lines.push(`- **${entry.name}** (\`${entry.file}\`)${summary ? ' - ' + summary : ''}`);
  }
  lines.push('', END);
  return lines.join('\n');
}

//#endregion

//#region ===== validation of the hand-written list =====

// "Missing" entries that are in fact registered are the drift that made these
// files misleading, so they are reported rather than silently regenerated away.
function staleMissingEntries(markdown, registeredNames) {
  const section = markdown.split(/^#+\s*(?:Missing|Not Yet Implemented|Planned)/mi)[1];
  if (!section) return [];
  const claimed = [...section.matchAll(/^\s*-\s*\[ \]\s*\*\*([^*]+)\*\*/gm)].map(m => m[1].trim());
  const normalise = s => s.toLowerCase().replace(/\s*\(.*$/, '').replace(/[^a-z0-9]/g, '');
  const registered = new Set([...registeredNames].map(normalise));
  return claimed.filter(entry => registered.has(normalise(entry)));
}

//#endregion

function main() {
  const check = process.argv.includes('--check');
  const byDirectory = loadRegistry();
  const allNames = new Set();
  for (const entries of byDirectory.values()) for (const e of entries) allNames.add(e.name);

  let drifted = 0, written = 0;
  for (const [directory, entries] of [...byDirectory].sort()) {
    const readme = ['README.md', 'ReadMe.md']
      .map(n => path.join(CIPHER_ROOT, 'algorithms', directory, n))
      .find(p => fs.existsSync(p));
    if (!readme) continue;

    const before = fs.readFileSync(readme, 'utf8');
    if (!before.includes(BEGIN)) continue;   // opt-in: only files carrying the markers

    const rendered = renderList(entries);
    const after = before.slice(0, before.indexOf(BEGIN)) + rendered + before.slice(before.indexOf(END) + END.length);

    const stale = staleMissingEntries(after, allNames);
    if (stale.length) {
      drifted++;
      console.log(`${directory}/: ${stale.length} entry(ies) listed as missing but registered: ${stale.join(', ')}`);
    }
    if (after === before) continue;
    if (check) { drifted++; console.log(`${directory}/: generated list is out of date`); continue; }
    fs.writeFileSync(readme, after);
    written++;
    console.log(`${directory}/: ${entries.length} algorithm(s) written`);
  }

  if (check) {
    console.log(drifted ? `\n${drifted} README(s) out of date - run node tools/refresh-readmes.js` : '\nREADMEs are up to date.');
    process.exitCode = drifted ? 1 : 0;
    return;
  }
  console.log(`\n${written} README(s) refreshed, ${allNames.size} algorithm(s) registered in total.`);
}

main();
