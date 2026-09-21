#!/usr/bin/env node
/*
 * Browser load suite
 * (c)2006-2025 Hawkynt
 *
 * The collection is served as a static site: index.html loads every algorithm
 * through its own script tag, with no bundler and no module loader. The Node
 * suites walk the directories and require() each file instead, so they exercise
 * a path the browser never takes - and a file that reads a Node-only binding,
 * or resolves a dependency through require(), passes every one of them while
 * throwing in the browser and never registering at all.
 *
 * That is not hypothetical. X25519 read `global` at module scope and never
 * registered; Ed25519 looked for SHA-512 the same way and failed every
 * signature; Schnorr resolved SHA-256 while loading, which both unregistered it
 * and stole two entries from the generated hash index. All three passed the
 * whole Node gate.
 *
 * This suite evaluates every script tag in index.html, in the order the page
 * lists them, in a context that has no require, no module and no global - only
 * the browser's own builtins. A file that throws here is broken for every user
 * of the site.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CIPHER_ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(CIPHER_ROOT, 'index.html');

// Files known to throw on load, with the reason next to each. A name belongs
// here only when the failure is understood and the fix is tracked elsewhere;
// anything absent from this list that throws fails the run.
const LOAD_EXEMPT = new Map([]);

function browserContext() {
  const sandbox = {
    console, Math, Date, JSON, Array, Object, String, Number, Boolean,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
    Float32Array, Float64Array, BigInt, BigInt64Array, BigUint64Array,
    Error, TypeError, RangeError, Map, Set, Symbol, Promise,
    ArrayBuffer, DataView, isNaN, parseInt, parseFloat, encodeURIComponent,
    decodeURIComponent, setTimeout, clearTimeout,
  };
  // A browser has window and self; it has neither require, module nor global.
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

function scriptTags() {
  const html = fs.readFileSync(INDEX, 'utf8');
  return [...html.matchAll(/<script src="\.\/([^"]+\.js)"><\/script>/g)].map(m => m[1]);
}

function main() {
  const tags = scriptTags();
  if (!tags.length) {
    console.error('index.html carries no script tags - nothing was checked.');
    process.exitCode = 2;
    return;
  }

  const sandbox = browserContext();
  const failures = [];
  let loaded = 0;

  for (const rel of tags) {
    const file = path.join(CIPHER_ROOT, rel);
    if (!fs.existsSync(file)) { failures.push({ rel, reason: 'file named by index.html does not exist' }); continue; }
    try {
      vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: rel });
      loaded++;
    } catch (error) {
      failures.push({ rel, reason: String(error.message).slice(0, 100) });
    }
  }

  const unexpected = failures.filter(f => !LOAD_EXEMPT.has(f.rel));
  const excused = failures.filter(f => LOAD_EXEMPT.has(f.rel));

  for (const f of unexpected) console.log(`FAIL  ${f.rel}\n        ${f.reason}`);
  for (const f of excused) console.log(`EXEMPT ${f.rel} (${LOAD_EXEMPT.get(f.rel)})`);

  const framework = sandbox.AlgorithmFramework;
  const registered = framework && framework.Algorithms ? framework.Algorithms.length : 0;
  if (!registered) {
    console.log('\nAlgorithmFramework never reached the page global - the site would load nothing.');
    process.exitCode = 1;
    return;
  }

  console.log(`\n${loaded}/${tags.length} script(s) evaluated, ${registered} algorithm(s) registered, `
    + `${unexpected.length} failed, ${excused.length} exempt`);
  process.exitCode = unexpected.length ? 1 : 0;
}

main();
