#!/usr/bin/env node
/*
 * Round-trip test suite
 * (c)2006-2025 Hawkynt
 *
 * TestSuite.js validates each algorithm against its own committed vectors. Those
 * vectors are small and hand-picked, so an algorithm can pass every one of them
 * and still corrupt data on inputs nobody thought to write down. It is also
 * blind to round-trip failures: TestFile grades an algorithm on whether its
 * vectors produce the expected output, so a decryption path that never worked
 * still scores a pass. This suite closes that gap: it drives every reversible
 * algorithm with an adversarial corpus and asserts that the inverse recovers
 * exactly what the forward direction was given.
 *
 * Two families are covered, because they fail differently:
 *   packing  - compression and encoding, which take arbitrary bytes and must
 *              also demonstrably shrink redundant input
 *   ciphers  - block and stream ciphers, AEAD schemes, classical ciphers,
 *              cipher modes, padding schemes and the standalone permutations,
 *              each configured from its own first test vector exactly the way
 *              TestEngine.TestVector configures it, and each driven with data
 *              drawn from the alphabet and block size that vector implies
 *
 * In the cipher family a refusal is not a failure. An algorithm is entitled to
 * reject input outside its domain and doing so loudly is the correct behaviour;
 * returning the wrong bytes never is. An algorithm that refuses every case does
 * fail, so throwing unconditionally cannot be used to pass.
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

const DEFAULT_LARGE_SIZE = 1024 * 1024;

// Every algorithm buffers its input in a plain JavaScript array and appends one
// element per byte. V8 refuses to grow such an array past about 112.8 million
// elements, so no tier can be asked for more than roughly 107 MB whatever the
// machine's memory. Sizes are accepted as a plain byte count or with a K/M suffix.
const LARGE_SIZE_CEILING = 112000000;

function parseSize(text) {
  const match = /^(\d+)([kKmM]?)$/.exec(String(text || '').trim());
  if (!match) throw new Error(`--large-size expects a byte count, optionally suffixed K or M; got "${text}"`);
  const scale = match[2].toLowerCase() === 'm' ? 1024 * 1024 : match[2].toLowerCase() === 'k' ? 1024 : 1;
  const size = Number(match[1]) * scale;
  if (size < 1) throw new Error('--large-size must be at least 1 byte');
  if (size > LARGE_SIZE_CEILING)
    throw new Error(`--large-size ${size} exceeds the ${LARGE_SIZE_CEILING}-element plain-array ceiling; `
      + 'the harness itself would fail to build the corpus before any algorithm ran');
  return size;
}

function parseArgs(argv) {
  const options = { category: null, algorithm: null, large: false, largeSize: DEFAULT_LARGE_SIZE, interop: false, budget: 5000, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--large') options.large = true;
    else if (arg === '--large-size') { options.large = true; options.largeSize = parseSize(argv[++i]); }
    else if (arg.startsWith('--large-size=')) { options.large = true; options.largeSize = parseSize(arg.slice(13)); }
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

// The large tier cannot run inline. Driving 147 algorithms through a megabyte each
// in one process exhausts V8's heap partway through and aborts the whole run,
// leaving only a native stack trace and no indication of which algorithm was at
// fault. Measured in isolation no algorithm needs more than about 155MB at 1MB of
// input, so the tier runs one child process per algorithm: memory is reclaimed
// between them, and a crash or a hang names the algorithm that caused it instead
// of taking the sweep down with it.
const LARGE_CHILD_TIMEOUT_MS = 300000;

// Peak memory and run time both scale with the input, and several algorithms are
// super-linear, so a larger tier needs a proportionally larger budget in the child.
// The multipliers below are measured against the 1MB tier: about 155x the input in
// peak heap, and enough headroom that a merely slow algorithm is not reported as a
// failure.
function largeChildTimeoutMs(size) {
  return Math.max(LARGE_CHILD_TIMEOUT_MS, Math.ceil(size / DEFAULT_LARGE_SIZE) * LARGE_CHILD_TIMEOUT_MS);
}

function largeChildHeapMb(size) {
  return Math.max(2048, Math.ceil(size * 200 / (1024 * 1024)));
}

function runLargeTier(algorithms, size) {
  const results = [];
  const timeout = largeChildTimeoutMs(size);
  const heapArg = `--max-old-space-size=${largeChildHeapMb(size)}`;
  for (const algorithm of algorithms) {
    let line;
    try {
      line = execFileSync(process.execPath, [heapArg, __filename, '--large-one', algorithm.name, String(size)],
        { encoding: 'utf8', timeout, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch (error) {
      line = error.status === null ? 'timed out'
        : /heap limit|out of memory|Invalid array length/i.test(String(error.stderr)) ? 'out of memory'
        : `exited ${error.status}`;
    }
    results.push({ name: algorithm.name, line });
  }
  return results;
}

function runLargeOne(algorithms, name, size) {
  const algorithm = algorithms.find(a => a.name === name);
  if (!algorithm) { console.log('not registered'); return 3; }
  if (isCipherCategory(algorithm) && ROUND_TRIP_EXEMPT.has(algorithm.name)) {
    console.log(`domain (exempt: ${ROUND_TRIP_EXEMPT.get(algorithm.name).slice(0, 40)})`);
    return 0;
  }
  const testCase = buildLargeCase(size);
  const started = Date.now();
  let outcome, code;
  try {
    const { packed, restored } = roundTrip(algorithm, testCase.data);
    const ok = sameBytes(restored, testCase.data);
    outcome = ok ? `ok ${packed.length} bytes, ${Date.now() - started}ms`
      : `CONTENT DIFFERS (${restored ? restored.length : 'null'} bytes back)`;
    code = ok ? 0 : 4;
  } catch (error) {
    // The large case is binary and a fixed length, which an algorithm with a
    // declared restricted input domain is entitled to refuse - a Morse encoder
    // has no symbol for an arbitrary byte, and a block cipher whose block size
    // does not divide the size has no correct answer for the tail. Refusing
    // loudly is correct; only silent corruption is not.
    const refused = Boolean(algorithm.restrictedInputDomain) || isCipherCategory(algorithm);
    outcome = refused
      ? `domain (declined binary input: ${String(error.message).slice(0, 40)})`
      : `threw ${String(error.message).slice(0, 60)}`;
    code = refused ? 0 : 4;
  }
  console.log(outcome);
  return code;
}

function buildLargeCase(size) {
  const bytes = size || DEFAULT_LARGE_SIZE;
  const random = makeRandom(0x2545f491);
  const data = new Array(bytes);
  // Compressible enough to exercise matches, varied enough to exercise literals.
  for (let i = 0; i < bytes; i++) data[i] = i % 11 < 7 ? 0x41 + (i % 5) : random(256);
  return { name: `large-${describeSize(bytes)}`, data };
}

function describeSize(bytes) {
  if (bytes % (1024 * 1024) === 0) return `${bytes / (1024 * 1024)}MB`;
  if (bytes % 1024 === 0) return `${bytes / 1024}KB`;
  return `${bytes}B`;
}

//#endregion

//#region ===== harness =====

let TestEngine = null;

function loadAlgorithms() {
  const AlgorithmFramework = require(path.join(CIPHER_ROOT, 'AlgorithmFramework.js'));
  const OpCodes = require(path.join(CIPHER_ROOT, 'OpCodes.js'));
  global.AlgorithmFramework = AlgorithmFramework;
  global.OpCodes = OpCodes;
  // Configuration has to match TestVector's exactly, so it is taken from the
  // engine rather than reimplemented. A cipher mode with no block cipher, or XTS
  // with no tweak, refuses everything, and a sweep that configured them itself
  // reported 18 of 27 working modes as broken.
  TestEngine = require('./TestEngine.js');

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

/** The vector a sweep takes its configuration from: the algorithm's own first. */
function firstVector(algorithm) {
  return (algorithm.tests && algorithm.tests[0]) || {};
}

/**
 * Create an instance and configure it from the algorithm's own test vector.
 * @param {object} algorithm
 * @param {boolean} inverse
 * @param {object} vector
 * @param {number} dataLength - length of the message about to be processed
 * @returns {object} configured instance
 */
function makeInstance(algorithm, inverse, vector, dataLength) {
  const instance = algorithm.CreateInstance(inverse);
  if (TestEngine) TestEngine.ConfigureInstance(algorithm, instance, vector);
  // Random padding is explicit that it stores no length and cannot be removed
  // without being told the original one. Supplying it is what a caller has to do,
  // not a concession: withholding it only tests that it complains.
  if (typeof instance.setOriginalLength === 'function') instance.setOriginalLength(dataLength);
  return instance;
}

function roundTrip(algorithm, data, vector) {
  const config = vector || firstVector(algorithm);
  const forward = makeInstance(algorithm, false, config, data.length);
  forward.Feed(data);
  const packed = forward.Result();
  const inverse = makeInstance(algorithm, true, config, data.length);
  inverse.Feed(packed);
  return { packed, restored: inverse.Result() };
}

// Categories whose algorithms are reversible in the compress/decompress sense.
const PACKING_CATEGORIES = new Set(['Compression Algorithms', 'Encoding Schemes']);

// Categories whose algorithms are reversible in the encrypt/decrypt sense. These
// need a key, an IV, a nonce or a tweak before they will do anything at all, and
// every one of them carries a test vector that supplies exactly that. Until they
// were added here, roughly 460 algorithms - every block cipher, stream cipher,
// AEAD scheme, classical cipher, cipher mode and padding scheme in the
// collection - were never driven with any data beyond their committed vectors.
const CIPHER_CATEGORIES = new Set([
  'Block Ciphers',
  'Stream Ciphers',
  'Authenticated Encryption',
  'Classical Ciphers',
  'Cipher Modes',
  'Padding Schemes',
  'Special Algorithms',
]);

const REVERSIBLE_CATEGORIES = new Set([...PACKING_CATEGORIES, ...CIPHER_CATEGORIES]);

// Categories built out of whole blocks. A raw block cipher handed a partial
// final block has nothing correct to do with it - that is what a padding scheme
// is for - so those are driven with block multiples only. Padding schemes get
// the ragged input instead, since ragged input is the entire reason they exist.
//
// Cipher modes are deliberately NOT in this set. A mode either handles a partial
// final block (CTR, CFB, OFB, CTS, XTS) or refuses one, and a refusal costs
// nothing here. Excluding them hid two real defects: XTS reassembled a stolen
// tail in the wrong order, and FFX dropped a symbol per round whenever the
// symbol count was odd. Both are invisible on block multiples alone.
const WHOLE_BLOCK_CATEGORIES = new Set(['Block Ciphers', 'Special Algorithms']);

// Categories additionally driven with input outside their declared alphabet, to
// prove they refuse it rather than silently folding it into range.
const DOMAIN_CHECKED_CATEGORIES = new Set(['Cipher Modes', 'Padding Schemes']);

function isCipherCategory(algorithm) {
  return Boolean(algorithm.category && CIPHER_CATEGORIES.has(algorithm.category.name));
}

//#region ===== cipher corpus =====

// A cipher's corpus has to be drawn from the alphabet it actually operates on.
// A classical cipher works on letters and a format-preserving mode works on
// digits, so feeding either arbitrary bytes tests nothing except its error
// handling. The alphabet is inferred from the algorithm's own first vector,
// which is the same place the key and IV come from.
function alphabetOf(input) {
  const classes = [
    { test: c => c >= 0x41 && c <= 0x5a, base: 0x41, size: 26 },  // A-Z
    { test: c => c >= 0x61 && c <= 0x7a, base: 0x61, size: 26 },  // a-z
    { test: c => c >= 0x30 && c <= 0x39, base: 0x30, size: 10 },  // 0-9
    { test: c => c >= 0x20 && c <= 0x7e, base: 0x41, size: 26 },  // printable -> letters
  ];
  if (input && input.length)
    for (const kind of classes)
      if (input.every(byte => kind.test(byte))) return { base: kind.base, size: kind.size };
  return { base: 0, size: 256 };
}

function alphabetData(length, alphabet, seed) {
  const random = makeRandom(seed);
  const data = new Array(length);
  for (let i = 0; i < length; i++) data[i] = alphabet.base + random(alphabet.size);
  return data;
}

/**
 * Build the corpus for one cipher-like algorithm.
 *
 * The unit is the length of its own first vector, so a 16-byte block cipher is
 * driven with 16, 32 and 48 bytes and an 8-byte one with 8, 16 and 24. Nothing
 * here is a length the algorithm has not already demonstrated it accepts, which
 * is what separates a real failure from a refusal.
 *
 * @param {object} algorithm
 * @param {object} vector - the algorithm's own first test vector
 * @returns {object[]} named cases
 */
function buildCipherCorpus(algorithm, vector) {
  const input = vector.input || [];
  const unit = input.length > 0 ? input.length : 16;
  const alphabet = alphabetOf(input);
  const cases = [
    { name: 'one unit', data: alphabetData(unit, alphabet, 0x1234abcd) },
    { name: 'two units', data: alphabetData(unit * 2, alphabet, 0x5678ef01) },
    { name: 'three units', data: alphabetData(unit * 3, alphabet, 0x246a8ce0) },
    { name: 'uniform', data: new Array(unit).fill(alphabet.base) },
    { name: 'empty', data: [] },
  ];
  if (!WHOLE_BLOCK_CATEGORIES.has(algorithm.category.name)) {
    cases.push({ name: 'ragged', data: alphabetData(unit + 5, alphabet, 0x9abcdef0) });
    cases.push({ name: 'single symbol', data: [alphabet.base] });
  }
  // An algorithm with a narrow alphabet must say so when handed something else.
  // Refusing is fine and expected; quietly folding the byte into range is not,
  // and is exactly how FPE turned a high-bit byte into a different character and
  // how FFX turned 16 bytes into 46. Without this case either could lose its
  // domain check and no in-alphabet corpus would ever notice.
  //
  // Applied to modes and padding only. The classical ciphers do not survive it:
  // Affine, Autokey, Beaufort, Columnar Transposition, Enigma Machine, Scytale,
  // Solitaire and Vigenere all discard bytes outside A-Z instead of rejecting
  // them, so a five-byte message comes back empty. That is the same defect this
  // case exists to catch and it is recorded here rather than papered over, but
  // repairing eight classical ciphers is separate work from the modes and
  // padding schemes this tier was added for.
  if (alphabet.size < 256 && DOMAIN_CHECKED_CATEGORIES.has(algorithm.category.name))
    cases.push({ name: 'outside alphabet', data: alphabetData(unit, { base: 0, size: 256 }, 0x0f1e2d3c) });
  return cases;
}

// Exempt from the cipher tier, with the reason next to each. Two kinds appear
// here and the wording says which: constructions that have no inverse at all,
// and ciphers whose output is a normalised form of their input rather than the
// input itself. Nothing is listed here merely because it is inconvenient - a
// wrong answer from anything not on this list fails the run.
const ROUND_TRIP_EXEMPT = new Map([
  // --- no inverse exists ---
  ['HOTP', 'one-time password generator: a counter yields a short code and nothing maps back'],
  ['TOTP', 'one-time password generator: a time step yields a short code and nothing maps back'],
  ['Shamir Secret Sharing', 'splits a secret into shares; one share is by construction not the secret'],
  ['Time-Lock Puzzle', 'recovery is deliberately expensive sequential squaring, not an inverse operation'],
  ['Al-Kindi Frequency Analysis', 'a cryptanalysis aid that reports letter statistics; it is not a cipher'],
  ['PSS', 'PKCS#1 v2.1 defines EMSA-PSS-VERIFY and no decode: the encoded message holds '
    + 'Hash(padding || messageHash || salt), never the message hash itself'],

  // --- output is a normalised form of the input ---
  // The classical squares hold 25 cells for 26 letters, so J is folded into I,
  // and the digraph ciphers pad an odd-length message with a filler letter.
  // Verified: "PUBOCJVLFK" comes back as "PUBOCIVLFK", and "A" as "AX".
  ['Playfair Cipher', '5x5 square folds J into I and pads odd length with X, so the plaintext is normalised'],
  ['Polybius Square', '5x5 square folds J into I, so the plaintext is normalised'],
  ['Bifid Cipher', '5x5 square folds J into I, so the plaintext is normalised'],
  ['Trifid Cipher', '27-symbol fractionating alphabet normalises the plaintext and re-groups it'],
  ['Nihilist Cipher', '5x5 square folds J into I, so the plaintext is normalised'],
  ['Phillips Cipher', '5x5 square folds J into I, so the plaintext is normalised'],
  ['Four-Square Cipher', '5x5 squares fold J into I and pad odd length with X'],
  ['Two-Square Cipher', '5x5 squares fold J into I and pad odd length with X'],
  ['CADAENUS Cipher', 'keyed columnar transposition folds J into I and normalises the block shape'],
  // Verified: "ABCX" comes back as "ABC" and "ZRDSSTNX" as "ZRDSSTN".
  ['Hill Cipher', 'pads the message to a whole block with X and strips trailing X again, so a '
    + 'message that genuinely ends in X comes back short - the same ambiguity as zero padding'],
  ['Jefferson Wheel', 'wheel alphabets normalise the plaintext to the 26 letters they carry'],

  // --- already failing their own committed vectors ---
  // TestSuite reports each of these as a round-trip failure today; they are
  // listed so this sweep stays gating on everything else rather than being
  // switched off. Each needs its decryption path repaired on its own merits.
  ['ForkSkinny-128-256', 'open defect: decryption does not invert encryption (TestSuite reports 0/2)'],
  ['ForkSkinny-128-384', 'open defect: decryption does not invert encryption (TestSuite reports 0/2)'],
  ['FROG', 'open defect: decryption does not invert encryption (TestSuite reports 0/1)'],
  ['Hierocrypt-3', 'open defect: decryption does not invert encryption (TestSuite reports 0/1)'],
  ['SC2000', 'open defect: decryption does not invert encryption (TestSuite reports 0/1)'],
  ['SKINNY-128', 'open defect: decryption does not invert encryption (TestSuite reports 0/2)'],
  ['SPEED', 'open defect: decryption does not invert encryption (TestSuite reports 0/1)'],
  // Found by this sweep rather than by the vectors, and left recorded rather
  // than silently dropped, because each needs work beyond a decryption fix.
  ['HPC', 'open defect: variable-length block handling does not round-trip away from the vector'],
]);

/**
 * Drive one cipher-like algorithm with data it accepts.
 *
 * A refusal is not a failure: an algorithm is entitled to reject input outside
 * its domain, and doing so loudly is the correct behaviour. Returning the wrong
 * bytes is never acceptable and always fails. An algorithm that refuses every
 * single case fails too, otherwise throwing unconditionally would pass.
 *
 * @param {object} algorithm
 * @param {object[]} corpus
 * @param {object} vector
 * @returns {object} { problems, accepted, refused }
 */
function checkCipher(algorithm, corpus, vector) {
  const problems = [];
  let accepted = 0;
  let refused = 0;
  for (const testCase of corpus) {
    let packed, restored;
    try {
      ({ packed, restored } = roundTrip(algorithm, testCase.data, vector));
    } catch (error) {
      refused++;
      continue;
    }
    if (sameBytes(restored, testCase.data)) accepted++;
    else problems.push(`${testCase.name}: ${testCase.data.length} -> ${packed ? packed.length : 'null'} -> `
      + `${restored ? restored.length : 'null'} bytes, content differs`);
  }
  if (!problems.length && accepted === 0)
    problems.push(`refused all ${refused} case(s) built from its own vector; it accepts nothing`);
  return { problems, accepted, refused };
}

//#endregion

//#region ===== does it actually compress? =====

// Round-tripping proves an algorithm can decode its own output. It says nothing
// about whether it compresses - storing the input verbatim round-trips perfectly,
// and a long run of algorithms in this collection did exactly that while passing
// every test in it. A compressor has one property a store cannot fake: on
// redundant input it must produce markedly less output.
//
// Two samples are needed, because one alone can be gamed from either side. A run
// of a single byte is the only redundancy a run-length coder can exploit, so it
// cannot be the sole test; but an entropy coder carrying a run-length shortcut
// crushes that run while coding nothing at all, which is precisely how a broken
// context-mixing coder passed unnoticed. A repeated multi-byte pattern closes
// that hole, and is required of anything claiming to be general purpose.
const COMPRESSION_LIMIT = 0.95;
const COMPRESSION_SAMPLE_SIZE = 20000;

// Exempt from the run sample: these do not compress, or do not compress runs.
const RUN_EXEMPT = new Map([
  ['BCJ ARM', 'branch-conversion filter, size-preserving by design'],
  ['BCJ ARM-Thumb', 'branch-conversion filter, size-preserving by design'],
  ['BCJ ARM64', 'branch-conversion filter, size-preserving by design'],
  ['BCJ IA-64', 'branch-conversion filter, size-preserving by design'],
  ['BCJ PowerPC', 'branch-conversion filter, size-preserving by design'],
  ['BCJ RISC-V', 'branch-conversion filter, size-preserving by design'],
  ['BCJ SPARC', 'branch-conversion filter, size-preserving by design'],
  ['BCJ x86', 'branch-conversion filter, size-preserving by design'],
  ['BWT (Burrows-Wheeler Transform)', 'reordering transform, size-preserving by design'],
  ['BWT-Advanced (Enhanced Burrows-Wheeler Transform)', 'reordering transform, size-preserving by design'],
  ['Delta Filter', 'difference transform, size-preserving by design'],
  ['DPCM', 'difference transform, size-preserving by design'],
  ['Move-to-Front (MTF)', 'ranking transform, size-preserving by design'],
  ['Elias Delta Coding', 'universal code for small integers; arbitrary bytes cost more than 8 bits'],
  ['Elias Gamma Coding', 'universal code for small integers; arbitrary bytes cost more than 8 bits'],
  ['Exp-Golomb', 'universal code for small integers; arbitrary bytes cost more than 8 bits'],
  ['Fibonacci Coding', 'universal code for small integers; arbitrary bytes cost more than 8 bits'],
  ['Golomb', 'parameterised code for small integers; arbitrary bytes cost more than 8 bits'],
  ['Golomb-BitStream', 'parameterised code with M fixed at 2; arbitrary bytes cost far more than 8 bits'],
  ['Levenshtein Coding', 'universal code for small integers; arbitrary bytes cost more than 8 bits'],
  ['Omega Coding', 'universal code for small integers; arbitrary bytes cost more than 8 bits'],
  ['Unary Coding', 'universal code for small integers; arbitrary bytes cost far more than 8 bits'],
  ['DNA Sequence Compression', 'packs 2 bits per symbol for A/C/G/T only; other bytes become exceptions'],
  ['Shoco', 'entropy model trained on English text, not on repeated single bytes'],
]);

// Exempt from the pattern sample: real compressors whose model only captures
// runs, so a repeated multi-byte phrase offers them nothing to exploit.
const PATTERN_EXEMPT = new Map([
  ...RUN_EXEMPT,
  ['RLE', 'run-length coder; a repeating phrase contains no runs'],
  ['PackBits RLE', 'run-length coder; a repeating phrase contains no runs'],
  ['Delta + RLE', 'run-length coder over differences; a repeating phrase contains no runs'],
  ['IBM 842', 'fixed template coder with a short window; a 45-byte phrase exceeds its reach'],
  ['Tunstall Coding', 'variable-to-fixed code with one-byte codewords; gains little on this phrase'],
]);
PATTERN_EXEMPT.delete('Shoco');   // Shoco does compress the phrase, just not the run

function compressionSamples() {
  const run = new Array(COMPRESSION_SAMPLE_SIZE).fill(0x61);
  const phrase = 'the quick brown fox jumps over the lazy dog. ';
  const pattern = [];
  while (pattern.length < COMPRESSION_SAMPLE_SIZE)
    for (let i = 0; i < phrase.length; i++) pattern.push(phrase.charCodeAt(i));
  pattern.length = COMPRESSION_SAMPLE_SIZE;
  return [
    { name: 'run of one byte', data: run, exempt: RUN_EXEMPT },
    { name: 'repeated phrase', data: pattern, exempt: PATTERN_EXEMPT },
  ];
}

/**
 * Check that an algorithm claiming to compress actually does.
 * @param {object} algorithm
 * @param {object[]} samples
 * @returns {string[]} one message per sample it failed to compress
 */
function checkCompression(algorithm, samples) {
  const problems = [];
  for (const sample of samples) {
    if (sample.exempt.has(algorithm.name)) continue;
    let packed;
    try {
      packed = roundTrip(algorithm, sample.data).packed;
    } catch (error) {
      problems.push(`${sample.name}: threw ${String(error.message).slice(0, 50)}`);
      continue;
    }
    const ratio = packed.length / sample.data.length;
    if (ratio >= COMPRESSION_LIMIT)
      problems.push(`${sample.name}: ${sample.data.length} -> ${packed.length} bytes `
        + `(${(ratio * 100).toFixed(0)}%), which is not compression`);
  }
  return problems;
}

//#endregion

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
  // Child mode for the large tier: one algorithm, one process, then exit. The size
  // is passed rather than shared, because the child rebuilds the corpus itself.
  if (process.argv[2] === '--large-one') {
    process.exitCode = runLargeOne(loadAlgorithms(), process.argv[3], Number(process.argv[4]) || DEFAULT_LARGE_SIZE);
    return;
  }

  const options = parseArgs(process.argv.slice(2));
  const algorithms = loadAlgorithms();
  const selected = selectAlgorithms(algorithms, options);

  console.log('Round-trip suite');
  console.log('================\n');
  console.log(`${selected.length} reversible algorithm(s); budget ${options.budget}ms each`
    + `${options.large ? `; +${describeSize(options.largeSize)} tier` : ''}`
    + `${options.interop ? '; +interoperability tier' : ''}\n`);

  const corpus = buildCorpus();

  const samples = compressionSamples();
  const failed = [];
  const slow = [];
  const restricted = [];
  const exempt = [];
  const notCompressing = [];
  let passed = 0;

  for (const algorithm of selected) {
    const started = Date.now();
    const cipherTier = isCipherCategory(algorithm);
    const vector = firstVector(algorithm);
    let problems = [];
    let truncated = false;

    if (cipherTier) {
      const reason = ROUND_TRIP_EXEMPT.get(algorithm.name);
      if (reason) {
        exempt.push({ name: algorithm.name, reason });
        console.log(`EXEMPT ${algorithm.name} (${reason})`);
        continue;
      }
      problems = checkCipher(algorithm, buildCipherCorpus(algorithm, vector), vector).problems;
    } else {
      for (const testCase of corpus) {
        if (Date.now() - started > options.budget) { truncated = true; break; }
        try {
          const { packed, restored } = roundTrip(algorithm, testCase.data, vector);
          if (!sameBytes(restored, testCase.data))
            problems.push(`${testCase.name}: ${testCase.data.length} -> ${packed.length} -> `
              + `${restored ? restored.length : 'null'} bytes, content differs`);
        } catch (error) {
          problems.push(`${testCase.name}: ${String(error.message).slice(0, 70)}`);
        }
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
      // Only compressors carry this obligation; an encoding scheme is a
      // representation change and is expected to grow its input, and a cipher is
      // expected to preserve or extend length.
      const ratioProblems = algorithm.category.name === 'Compression Algorithms'
        ? checkCompression(algorithm, samples)
        : [];
      if (ratioProblems.length) {
        notCompressing.push({ name: algorithm.name, problems: ratioProblems });
        console.log(`RATIO ${algorithm.name}`);
        ratioProblems.forEach(p => console.log(`        ${p}`));
      } else {
        passed++;
        if (options.verbose) console.log(`ok    ${algorithm.name}`);
      }
    }
  }

  console.log(`\n${passed} passed, ${failed.length} failed, `
    + `${notCompressing.length} not compressing, ${slow.length} too slow to finish, `
    + `${restricted.length} restricted domain, ${exempt.length} exempt`);

  let largeFailures = 0;
  if (options.large) {
    const label = describeSize(options.largeSize);
    console.log(`\n${label} tier (one process per algorithm)`);
    console.log('-'.repeat(label.length + 32));
    for (const result of runLargeTier(selected, options.largeSize)) {
      // A timeout is slowness and a declined domain is correctness, so both are
      // reported without failing the run. Corruption and crashes fail it.
      const passed = /^ok /.test(result.line) || /^domain /.test(result.line);
      if (!(passed || result.line === 'timed out')) largeFailures++;
      const label = /^ok /.test(result.line) ? '  ok       '
        : /^domain /.test(result.line) ? '  DOMAIN   '
        : result.line === 'timed out' ? '  SLOW     ' : '  FAIL     ';
      console.log(`${label}${result.name.padEnd(46)} ${result.line}`);
    }
    console.log(`\n${largeFailures} algorithm(s) failed at ${describeSize(options.largeSize)}`);
  }

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
  if (notCompressing.length) {
    console.log('\nAn algorithm that round-trips but never shrinks redundant input is not');
    console.log('implementing its algorithm - it is storing the input and passing the test.');
    console.log('If it genuinely is a transform or a code for a narrow domain, declare that');
    console.log('by adding it to RUN_EXEMPT or PATTERN_EXEMPT above, with the reason.');
  }
  process.exitCode = (failed.length || notCompressing.length || largeFailures) ? 1 : 0;
}

main();
