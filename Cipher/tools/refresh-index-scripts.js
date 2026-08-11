#!/usr/bin/env node
/*
 * Browser script-tag refresher
 * (c)2006-2025 Hawkynt
 *
 * index.html loads every algorithm with its own <script> tag, written by hand.
 * The Node test suites walk the algorithm directories instead, so a file added
 * without a matching tag passes every test and is simply absent in the browser -
 * the one environment the tests cannot see. That drifted to 250 of 933 files
 * missing, including 128 block ciphers and 46 stream ciphers.
 *
 * The tag list is generated from the directories instead. Load order is
 * preserved as directory-then-filename so a diff stays readable; data modules
 * are emitted before the algorithms that read them.
 *
 * Usage:
 *   node tools/refresh-index-scripts.js            rewrite the generated block
 *   node tools/refresh-index-scripts.js --check    report drift, change nothing
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CIPHER_ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(CIPHER_ROOT, 'index.html');
const BEGIN = '    <!-- BEGIN GENERATED ALGORITHM SCRIPTS -->';
const END = '    <!-- END GENERATED ALGORITHM SCRIPTS -->';

function collect() {
  const root = path.join(CIPHER_ROOT, 'algorithms');
  const tags = [];
  for (const directory of fs.readdirSync(root).sort()) {
    const full = path.join(root, directory);
    if (!fs.statSync(full).isDirectory()) continue;
    const files = fs.readdirSync(full).filter(f => f.endsWith('.js')).sort();
    // A `.data.js` module only holds tables and must be defined before whatever
    // reads it, so those are emitted first within their directory.
    const data = files.filter(f => f.endsWith('.data.js'));
    const code = files.filter(f => !f.endsWith('.data.js'));
    for (const file of [...data, ...code])
      tags.push(`    <script src="./algorithms/${directory}/${file}"></script>`);
  }
  return tags;
}

function main() {
  const check = process.argv.includes('--check');
  const before = fs.readFileSync(INDEX, 'utf8');
  if (!before.includes(BEGIN)) {
    console.error('index.html does not carry the generated-block markers.');
    process.exitCode = 2;
    return;
  }

  const block = [BEGIN, ...collect(), END].join('\n');
  const after = before.slice(0, before.indexOf(BEGIN)) + block + before.slice(before.indexOf(END) + END.length);

  if (after === before) { console.log('index.html script tags are up to date.'); return; }
  if (check) {
    console.log('index.html script tags are out of date - run node tools/refresh-index-scripts.js');
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(INDEX, after);
  console.log(`index.html: ${collect().length} algorithm script tag(s) written.`);
}

main();
