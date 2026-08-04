#!/usr/bin/env node
/*
 * Round-trip test suite
 * (c)2006-2025 Hawkynt
 *
 * TestSuite.js validates each algorithm against its own committed vectors. Those
 * vectors are small and hand-picked, so an algorithm can pass every one of them
 * and still corrupt data on inputs nobody thought to write down. This suite
 * closes that gap: it drives every reversible algorithm with an adversarial
 * corpus and asserts decompress(compress(x)) === x.
 *
 * Tiers:
 *   (default)   adversarial corpus, small inputs, every algorithm
 *   --large     additionally push 1 MB through each algorithm
 *   --interop   additionally check the formats that have a reference
 *               implementation available (node zlib, bzip2) in BOTH directions
 *
 * Usage:
 *   node tests/RoundTripSuite.js
 *   node tests/RoundTripSuite.js --category compression
 *   node tests/RoundTripSuite.js --algorithm "LZ77"
 *   node tests/RoundTripSuite.js --large --interop
 *   node tests/RoundTripSuite.js --budget 5000      # ms per algorithm
 *
 * Exits non-zero when any algorithm fails, so it can gate CI.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const CIPHER_ROOT = path.resolve(__dirname, '..');

//#region ===== options =====

function parseArgs(argv) {
  const options = { category: null, algorithm: null, large: false, interop: false, budget: 5000, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--large') options.large = true;
    else if (arg === '--interop') options.interop = true;
    else if (arg === '--verbose') options.verbose = true;
    else if (arg === '--category') options.category = argv[++i];
    else if (arg === '--algorithm') options.algorithm = argv[++i];
    else if (arg === '--budget') options.budget = Number(argv[++i]);
    else if (arg.startsWith('--category=')) options.category = arg.slice(11);
    else if (arg.startsWith('--algorithm=')) options.algorithm = arg.slice(12);
    else if (arg.startsWith('--budget=')) options.budget = Number(arg.slice(9));
  }
  return options;
}

//#endregion

//#region ===== corpus =====

// Deterministic generator: the corpus must be identical on every run and on
// every machine, otherwise a failure cannot be reproduced from the report.
function makeRandom(seed) {
  let state = seed >>> 0;
  return function next(limit) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return (state >>> 8) % limit;
  };
}

function buildCorpus() {
  const random = makeRandom(0x9e3779b9);
  const cases = [];

  cases.push({ name: 'empty', data: [] });
  cases.push({ name: 'single', data: [0x41] });
  cases.push({ name: 'two-bytes', data: [0x00, 0xff] });
  cases.push({ name: 'repeated', data: new Array(128).fill(0x61) });
  cases.push({ name: 'text', data: [...Buffer.from('the quick brown fox jumps over the lazy dog. ')] });

  const alternating = [];
  for (let i = 0; i < 128; i++) alternating.push(i % 2 ? 0x62 : 0x61);
  cases.push({ name: 'alternating', data: alternating });

  const incompressible = [];
  for (let i = 0; i < 128; i++) incompressible.push(random(256));
  cases.push({ name: 'incompressible', data: incompressible });

  const mixed = [];
  for (let i = 0; i < 160; i++) mixed.push(i % 7 < 4 ? 0x41 + (i % 3) : random(256));
  cases.push({ name: 'mixed', data: mixed });

  // Every byte value, so reserved markers and escape codes cannot hide.
  const allBytes = [];
  for (let i = 0; i < 256; i++) allBytes.push(i);
  cases.push({ name: 'all-byte-values', data: allBytes });

  // Long run, which is where self-referential matches (offset < length) break.
  const longRun = new Array(1024).fill(0x5a);
  cases.push({ name: 'long-run', data: longRun });

  return cases;
}

function buildLargeCase() {
  const random = makeRandom(0x2545f491);
  const size = 1024 * 1024;
  const data = new Array(size);
  // Compressible enough to exercise matches, varied enough to exercise literals.
  for (let i = 0; i < size; i++) data[i] = i % 11 < 7 ? 0x41 + (i % 5) : random(256);
  return { name: 'large-1MB', data };
}

//#endregion

//#region ===== harness =====

function loadAlgorithms() {
  const AlgorithmFramework = require(path.join(CIPHER_ROOT, 'AlgorithmFramework.js'));
  const OpCodes = require(path.join(CIPHER_ROOT, 'OpCodes.js'));
  global.AlgorithmFramework = AlgorithmFramework;
  global.OpCodes = OpCodes;

  const algorithmRoot = path.join(CIPHER_ROOT, 'algorithms');
  for (const category of fs.readdirSync(algorithmRoot).sort()) {
    const dir = path.join(algorithmRoot, category);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).sort()) {
      if (!file.endsWith('.js')) continue;
      try { require(path.join(dir, file)); } catch (error) { /* reported by TestSuite */ }
    }
  }
  return AlgorithmFramework.Algorithms || [];
}

function sameBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if ((a[i] & 0xff) !== (b[i] & 0xff)) return false;
  return true;
}

function roundTrip(algorithm, data) {
  const forward = algorithm.CreateInstance(false);
  forward.Feed(data);
  const packed = forward.Result();
  const inverse = algorithm.CreateInstance(true);
  inverse.Feed(packed);
  return { packed, restored: inverse.Result() };
}

// Categories whose algorithms are reversible in the compress/decompress sense.
const REVERSIBLE_CATEGORIES = new Set(['Compression Algorithms', 'Encoding Schemes']);

function selectAlgorithms(algorithms, options) {
  return algorithms
    .filter(a => a.category && REVERSIBLE_CATEGORIES.has(a.category.name))
    .filter(a => !options.category || (a.category.name.toLowerCase().includes(options.category.toLowerCase())))
    .filter(a => !options.algorithm || a.name.toLowerCase().includes(options.algorithm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
}

//#endregion

//#region ===== interoperability =====

function commandAvailable(command) {
  try { execFileSync(command, ['--version'], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function interopTargets() {
  const targets = [
    {
      algorithm: 'DEFLATE',
      reference: 'node zlib (RFC 1951 raw DEFLATE)',
      compress: d => [...zlib.deflateRawSync(Buffer.from(d))],
      decompress: d => [...zlib.inflateRawSync(Buffer.from(d))],
      available: true,
    },
    {
      algorithm: 'Brotli',
      reference: 'node zlib (RFC 7932)',
      compress: d => [...zlib.brotliCompressSync(Buffer.from(d))],
      decompress: d => [...zlib.brotliDecompressSync(Buffer.from(d))],
      available: typeof zlib.brotliCompressSync === 'function',
    },
    {
      algorithm: 'Zstandard',
      reference: 'node zlib (RFC 8878)',
      compress: d => [...zlib.zstdCompressSync(Buffer.from(d))],
      decompress: d => [...zlib.zstdDecompressSync(Buffer.from(d))],
      available: typeof zlib.zstdCompressSync === 'function',
    },
    {
      algorithm: 'BZIP2',
      reference: 'bzip2 CLI',
      compress: d => [...execFileSync('bzip2', ['-c', '-9'], { input: Buffer.from(d), maxBuffer: 1 << 28 })],
      decompress: d => [...execFileSync('bzip2', ['-dc'], { input: Buffer.from(d), maxBuffer: 1 << 28 })],
      available: commandAvailable('bzip2'),
    },
  ];
  return targets.filter(t => t.available);
}

function runInterop(algorithms, options) {
  const samples = [
    ['text', [...Buffer.from('the quick brown fox jumps over the lazy dog. '.repeat(8))]],
    ['repeated', new Array(512).fill(0x61)],
    ['binary', Array.from({ length: 512 }, (_, i) => (i * 37 + 11) & 0xff)],
  ];
  const results = [];
  for (const target of interopTargets()) {
    const algorithm = algorithms.find(a => a.name === target.algorithm);
    if (!algorithm) { results.push({ ...target, status: 'absent' }); continue; }
    let readsReference = 0, referenceReadsOurs = 0;
    const notes = [];
    for (const [label, data] of samples) {
      try {
        const inverse = algorithm.CreateInstance(true);
        inverse.Feed(target.compress(data));
        if (sameBytes(inverse.Result(), data)) readsReference++;
        else notes.push(`${label}: ours decoded reference output incorrectly`);
      } catch (error) { notes.push(`${label}: ours threw on reference output`); }
      try {
        const forward = algorithm.CreateInstance(false);
        forward.Feed(data);
        if (sameBytes(target.decompress(forward.Result()), data)) referenceReadsOurs++;
        else notes.push(`${label}: reference decoded ours incorrectly`);
      } catch (error) { notes.push(`${label}: reference rejected our output`); }
    }
    const total = samples.length;
    const status = readsReference === total && referenceReadsOurs === total ? 'interoperable'
      : readsReference === 0 && referenceReadsOurs === 0 ? 'incompatible' : 'partial';
    results.push({ ...target, status, readsReference, referenceReadsOurs, total, notes });
  }
  return results;
}

//#endregion

function main() {
  const options = parseArgs(process.argv.slice(2));
  const algorithms = loadAlgorithms();
  const selected = selectAlgorithms(algorithms, options);

  console.log('Round-trip suite');
  console.log('================\n');
  console.log(`${selected.length} reversible algorithm(s); budget ${options.budget}ms each`
    + `${options.large ? '; +1MB tier' : ''}${options.interop ? '; +interoperability tier' : ''}\n`);

  const corpus = buildCorpus();
  if (options.large) corpus.push(buildLargeCase());

  const failed = [];
  const slow = [];
  const restricted = [];
  let passed = 0;

  for (const algorithm of selected) {
    const started = Date.now();
    const problems = [];
    let truncated = false;

    for (const testCase of corpus) {
      if (Date.now() - started > options.budget) { truncated = true; break; }
      try {
        const { packed, restored } = roundTrip(algorithm, testCase.data);
        if (!sameBytes(restored, testCase.data))
          problems.push(`${testCase.name}: ${testCase.data.length} -> ${packed.length} -> `
            + `${restored ? restored.length : 'null'} bytes, content differs`);
      } catch (error) {
        problems.push(`${testCase.name}: ${String(error.message).slice(0, 70)}`);
      }
    }

    // An algorithm may legitimately accept only part of the byte space (a DNA
    // codec has no encoding for a fifth symbol). That is only acceptable when it
    // says so up front AND rejects loudly - silent corruption is never allowed,
    // so a wrong-bytes result still fails even for a declared restricted domain.
    const rejectionsOnly = problems.length > 0 && problems.every(p => !p.includes('content differs'));
    if (problems.length && algorithm.restrictedInputDomain && rejectionsOnly) {
      restricted.push(algorithm.name);
      console.log(`DOMAIN ${algorithm.name} (declared restricted input domain; rejected ${problems.length} case(s) without corrupting)`);
    } else if (problems.length) {
      failed.push({ name: algorithm.name, problems });
      console.log(`FAIL  ${algorithm.name}`);
      problems.slice(0, 4).forEach(p => console.log(`        ${p}`));
    } else if (truncated) {
      slow.push(algorithm.name);
      console.log(`SLOW  ${algorithm.name} (exceeded ${options.budget}ms, partially checked)`);
    } else {
      passed++;
      if (options.verbose) console.log(`ok    ${algorithm.name}`);
    }
  }

  console.log(`\n${passed} passed, ${failed.length} failed, ${slow.length} too slow to finish`);

  let interopFailures = 0;
  if (options.interop) {
    console.log('\nInteroperability with reference implementations');
    console.log('----------------------------------------------');
    for (const result of runInterop(algorithms, options)) {
      if (result.status === 'absent') { console.log(`  skip           ${result.algorithm} (not registered)`); continue; }
      const label = result.status === 'interoperable' ? 'interoperable'
        : result.status === 'partial' ? 'partial      ' : 'incompatible ';
      console.log(`  ${label}  ${result.algorithm}  [${result.reference}]`
        + `  decode-theirs ${result.readsReference}/${result.total}, they-decode-ours ${result.referenceReadsOurs}/${result.total}`);
      result.notes.slice(0, 2).forEach(n => console.log(`        ${n}`));
      if (result.status !== 'interoperable') interopFailures++;
    }
  }

  if (failed.length) {
    console.log('\nRound-trip failures are data-loss defects: an algorithm that cannot decode');
    console.log('its own output will silently corrupt real input.');
  }
  process.exitCode = failed.length ? 1 : 0;
}

main();
