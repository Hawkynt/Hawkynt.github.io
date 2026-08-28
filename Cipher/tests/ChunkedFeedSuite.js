#!/usr/bin/env node
/*
 * Chunked-feed suite
 * (c)2006-2025 Hawkynt
 *
 * Feed followed by Result is the framework's streaming contract, and it carries
 * one property that holds for every algorithm that accepts a byte stream:
 *
 *     Feed(whole)  ==  Feed(part1); Feed(part2); ... Feed(partN)
 *
 * for any split of the same byte string. Nothing else checked it. Every
 * committed test vector hands the whole message over in a single call, so an
 * algorithm that mishandles buffering across calls passes its own vectors and
 * TestSuite reports it green: the defect only shows when a caller streams a file
 * through it, which is exactly what a caller does with a large input.
 *
 * The sweep it replaced found the property broken in 103 of 1088 registered
 * algorithms, including SHA-1, the whole SHA-2 family, BLAKE2b, BLAKE3, MD2,
 * MD4, Tiger, Whirlpool, every Base-N encoder and most of the key derivation
 * functions. The failures came in three shapes:
 *
 *   - Feed called Init() first, so each call threw the previous one away and the
 *     digest was of the final chunk only
 *   - Feed assigned rather than appended (this.inputBuffer = data), so the
 *     stored message was the final chunk only
 *   - Feed consumed whole units out of its argument and buffered the remainder
 *     in a field the next call never looked at, so the tail of every chunk but
 *     the last was dropped and any padding was written at the wrong offset
 *
 * Each algorithm is configured from its own first test vector carrying a
 * non-empty input, through TestEngine.ConfigureInstance, so that it is set up
 * exactly the way TestVector sets it up. Reimplementing that setup is what makes
 * a sweep report working algorithms as broken: a cipher mode with no block
 * cipher, or XTS with no tweak, refuses everything.
 *
 * A refusal is not a failure. An algorithm entitled to see its whole input at
 * once may say so by throwing on the second Feed, and doing that loudly is a
 * defensible design. Returning a different answer without complaining is never
 * defensible, and that is the only thing this suite fails on.
 *
 * Usage:
 *   node tests/ChunkedFeedSuite.js
 *   node tests/ChunkedFeedSuite.js --category hash
 *   node tests/ChunkedFeedSuite.js --algorithm "SHA-256"
 *   node tests/ChunkedFeedSuite.js --verbose
 *
 * Exits non-zero when any non-exempt algorithm silently differs, so it can gate CI.
 */

'use strict';

const path = require('path');
const fs = require('fs');

const CIPHER_ROOT = path.resolve(__dirname, '..');

//#region ===== options =====

function parseArgs(argv) {
  const options = { category: null, algorithm: null, verbose: false, listAll: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--verbose') options.verbose = true;
    else if (arg === '--list') options.listAll = true;
    else if (arg === '--category') options.category = argv[++i];
    else if (arg === '--algorithm') options.algorithm = argv[++i];
    else if (arg.startsWith('--category=')) options.category = arg.slice(11);
    else if (arg.startsWith('--algorithm=')) options.algorithm = arg.slice(12);
  }
  return options;
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
  // engine rather than reimplemented.
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

function byteOf(value) {
  return ((Math.trunc(value) % 256) + 256) % 256;
}

function sameBytes(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (byteOf(a[i]) !== byteOf(b[i])) return false;
  return true;
}

function preview(bytes) {
  if (!bytes) return String(bytes);
  let text = '';
  for (let i = 0; i < Math.min(bytes.length, 12); i++)
    text += (byteOf(bytes[i]) + 0x100).toString(16).slice(1);
  return text + (bytes.length > 12 ? '...' : '');
}

/**
 * The vector a sweep takes its configuration from: the algorithm's first one
 * carrying a non-empty input. Vector zero is very often the empty message, which
 * cannot be split and would leave a third of the collection unchecked.
 * @param {object} algorithm
 * @returns {object} test vector, possibly empty
 */
function configVector(algorithm) {
  const tests = algorithm.tests || [];
  for (const test of tests) if (test && test.input && test.input.length) return test;
  return tests[0] || {};
}

/**
 * Create an instance and configure it from the algorithm's own test vector.
 * @param {object} algorithm
 * @param {object} vector
 * @param {number} dataLength - length of the message about to be processed
 * @returns {object} configured instance, or null if the algorithm declines one
 */
function makeInstance(algorithm, vector, dataLength) {
  const instance = algorithm.CreateInstance(false);
  if (!instance) return null;
  TestEngine.ConfigureInstance(algorithm, instance, vector);
  if (typeof instance.setOriginalLength === 'function') instance.setOriginalLength(dataLength);
  return instance;
}

function drive(algorithm, vector, message, parts) {
  const instance = makeInstance(algorithm, vector, message.length);
  if (!instance) return { declined: true };
  for (const part of parts) instance.Feed(part);
  return { out: instance.Result() };
}

//#endregion

//#region ===== splittings =====

// Sizes chosen around the block and rate boundaries algorithms actually use: one
// byte at a time, below and above a 16-byte rate, either side of 8 and 32, and
// two odd sizes that never align with any of them.
const CHUNK_SIZES = [1, 3, 7, 8, 15, 16, 17, 31, 33];

// One message split into pieces of varying length, because a defect can survive
// every uniform split and still show up on an uneven one - a coder that buffers
// correctly for a fixed stride can still mis-handle a short piece following a
// long one.
const UNEVEN_PATTERN = [1, 5, 2, 13, 3, 9, 7, 4];

function splitFixed(message, size) {
  const parts = [];
  for (let offset = 0; offset < message.length; offset += size)
    parts.push(message.slice(offset, offset + size));
  return parts.length ? parts : [[]];
}

function splitUneven(message) {
  const parts = [];
  let offset = 0;
  let index = 0;
  while (offset < message.length) {
    const size = Math.min(UNEVEN_PATTERN[index++ % UNEVEN_PATTERN.length], message.length - offset);
    parts.push(message.slice(offset, offset + size));
    offset += size;
  }
  return parts.length ? parts : [[]];
}

function splittingsOf(message) {
  const splittings = [];
  for (const size of CHUNK_SIZES)
    if (size < message.length) splittings.push({ name: `chunks of ${size}`, parts: splitFixed(message, size) });
  if (message.length >= 2) {
    const half = Math.floor(message.length / 2);
    splittings.push({ name: 'two halves', parts: [message.slice(0, half), message.slice(half)] });
  }
  if (message.length > 3) splittings.push({ name: 'uneven pieces', parts: splitUneven(message) });
  return splittings;
}

// A message has to be long enough for a split to cross the boundary the
// algorithm buffers on, or the sweep reports a broken algorithm as correct. The
// Gimli hash defect this suite was written for is invisible below 8 bytes, and
// its own first non-empty vector is one byte: at three times that length the
// repaired and the unrepaired code agree on every splitting. 256 clears the
// largest block in the collection - SHA-512 and Whirlpool compress 128 bytes at
// a time - with a whole block to spare on either side of a split.
const TARGET_MESSAGE_LENGTH = 256;

// Not every algorithm can be handed that much. A Hadamard code emits 2^k symbols
// for k input symbols, so 256 bytes is 2^256 of output: asking for it aborts the
// process on an allocation failure, which no amount of try/catch recovers from
// and which would take the whole sweep down with it. The long message is
// therefore grown by doubling rather than demanded outright, and the growth stops
// at the last length the algorithm answered cheaply. Measured on this collection
// that keeps Hadamard at 12 bytes and lets everything stream-shaped reach 256.
const OUTPUT_CEILING = 65536;         // absolute size at which growing stops
const EXPANSION_LIMIT = 64;           // output bytes per input byte before it counts as explosive
const EXPANSION_SLACK = 4096;         // fixed headers and framing are not expansion
const PROBE_BUDGET_MS = 250;          // a length that is already slow will not be doubled

// Used only when no vector carries an input to borrow. Deterministic, so a
// failure reproduces from the report alone.
function syntheticMessage(length) {
  const bytes = new Array(length);
  for (let i = 0; i < length; i++) bytes[i] = byteOf(i * 37 + 11);
  return bytes;
}

/**
 * The messages one algorithm is driven with.
 *
 * Both are built from the algorithm's own vector input, so neither is a length
 * or an alphabet it has not already demonstrated it accepts - which is what
 * separates a real difference from a refusal. Repeating it to a whole number of
 * copies also keeps a block cipher's message a multiple of its block size.
 *
 * The long message is the one that does the work. A vector input is frequently
 * one or two bytes, and no split of two bytes crosses anything: the sweep that
 * found 103 defects would have missed the Gimli hash it was written for, whose
 * first non-empty vector is a single byte. The short message is kept alongside
 * it only so that a difference which appears at exactly the vector's own length
 * is reported at that length.
 *
 * A little over a hundred algorithms carry no vector with a non-empty input at
 * all - the random number generators, which are seeded through a property, and
 * the AEAD schemes whose first vector encrypts the empty message. Skipping them
 * would leave a tenth of the collection unchecked, so they are driven with a
 * fixed synthetic message instead. Nothing is lost by guessing wrong there: an
 * algorithm that will not accept it refuses, and a refusal never fails the run.
 *
 * @param {object} algorithm
 * @param {object} vector
 * @returns {object[]} named messages
 */
function messagesFor(algorithm, vector) {
  const input = (vector.input && vector.input.length) ? vector.input.slice() : null;
  if (!input) {
    const bytes = grownMessage(algorithm, vector, 8, syntheticMessage);
    return [{ name: 'synthetic message', bytes }];
  }

  const repeat = length => repeatUnit(input, length / input.length);
  const messages = [{ name: 'vector input', bytes: input }];
  const grown = grownMessage(algorithm, vector, input.length, repeat);
  if (grown.length > input.length)
    messages.push({ name: `vector input x${grown.length / input.length}`, bytes: grown });
  return messages;
}

function repeatUnit(unit, copies) {
  const bytes = [];
  for (let round = 0; round < copies; round++)
    for (let i = 0; i < unit.length; i++) bytes.push(unit[i]);
  return bytes;
}

/**
 * The longest message of this shape the algorithm still answers cheaply.
 *
 * Doubling upwards is what makes this safe. An allocation failure aborts the
 * process rather than throwing, and no try/catch recovers from that, so a length
 * that would cause one must never be reached: every candidate is a doubling of a
 * length that already came back small and quick, and a doubling that multiplies
 * the output by more than four is treated as the start of exponential growth and
 * ends the search. On this collection that stops the Hadamard code - 2^k output
 * symbols for k input symbols - at 12 bytes, and lets everything stream-shaped
 * reach the full target.
 *
 * @param {object} algorithm
 * @param {object} vector
 * @param {number} unitLength - smallest length to start from
 * @param {function} build - build a message of a given length
 * @returns {uint8[]} the largest safe message, never shorter than one unit
 */
function grownMessage(algorithm, vector, unitLength, build) {
  let accepted = build(unitLength);
  let acceptedSize;

  try {
    const base = drive(algorithm, vector, accepted, [accepted.slice()]);
    if (base.declined) return accepted;
    acceptedSize = base.out ? base.out.length : 0;
  } catch (error) { return accepted; }

  while (accepted.length < TARGET_MESSAGE_LENGTH) {
    // Never double a length that already produced a lot: the next step squares
    // it for anything growing exponentially.
    if (acceptedSize > OUTPUT_CEILING) break;
    if (acceptedSize > EXPANSION_LIMIT * accepted.length + EXPANSION_SLACK) break;

    const candidate = build(accepted.length * 2);
    let produced;
    const started = Date.now();
    try {
      const outcome = drive(algorithm, vector, candidate, [candidate.slice()]);
      if (outcome.declined) break;      // refuses this length; keep what worked
      produced = outcome.out ? outcome.out.length : 0;
    } catch (error) { break; }

    if (Date.now() - started > PROBE_BUDGET_MS) break;
    if (produced > acceptedSize * 4 + EXPANSION_SLACK) break;

    accepted = candidate;
    acceptedSize = produced;
  }

  return accepted;
}

//#endregion

//#region ===== exemptions =====

// Exempt from the sweep, with the reason next to each. Nothing is listed here
// because it is inconvenient: an entry says that splitting the algorithm's input
// is not a meaningful operation, because the construction is defined over a
// sequence of separate strings rather than over one message. A silent difference
// from anything not on this list fails the run.
//
// An exemption that outlives its repair is worse than no exemption, since it
// hides the next regression, so an entry is deleted as soon as the algorithm
// agrees. The block and fountain codes in algorithms/ecc were held here while
// their Feed was repaired to accumulate; they now agree and are gone.
const CHUNKED_FEED_EXEMPT = new Map([

  // ===== Hash Functions =====
  //
  // TupleHash is the one construction in the collection for which the property
  // this suite asserts is deliberately false. NIST SP 800-185 section 5 defines
  // TupleHash over a tuple of strings, each length-prefixed by encode_string
  // before it is absorbed, precisely so that the tuple ("ab", "c") hashes
  // differently from ("abc"). Each Feed is therefore one tuple element and not a
  // slice of one message, and making it agree would destroy the unambiguous
  // encoding the function exists to provide.
  ['TupleHash128', 'tuple hash (NIST SP 800-185 section 5): each Feed is one length-prefixed '
    + 'tuple element, and distinguishing ("ab", "c") from ("abc") is the function\'s purpose'],
  ['TupleHash256', 'tuple hash (NIST SP 800-185 section 5): each Feed is one length-prefixed '
    + 'tuple element, and distinguishing ("ab", "c") from ("abc") is the function\'s purpose'],

]);

//#endregion

//#region ===== sweep =====

/**
 * Sweep one algorithm.
 *
 * Two whole-message runs come first: an algorithm that answers differently to
 * two identical runs is non-deterministic, and comparing a split against it
 * would report noise as a defect.
 *
 * @param {object} algorithm
 * @param {object} vector
 * @param {object} message - { name, bytes }
 * @returns {object} { status, detail }
 */
function sweepMessage(algorithm, vector, message) {
  let first, second;
  try { first = drive(algorithm, vector, message.bytes, [message.bytes.slice()]); }
  catch (error) { return { status: 'whole refused', detail: String(error.message).slice(0, 90) }; }
  if (first.declined) return { status: 'no instance' };

  try { second = drive(algorithm, vector, message.bytes, [message.bytes.slice()]); }
  catch (error) { return { status: 'whole refused', detail: String(error.message).slice(0, 90) }; }
  if (!sameBytes(first.out, second.out)) return { status: 'nondeterministic' };

  const splittings = splittingsOf(message.bytes);
  if (!splittings.length) return { status: 'too short', detail: `${message.bytes.length} byte(s)` };

  const differences = [];
  let refused = 0;
  for (const splitting of splittings) {
    let result;
    try { result = drive(algorithm, vector, message.bytes, splitting.parts); }
    catch (error) { refused++; continue; }
    if (result.declined) continue;
    if (!sameBytes(result.out, first.out))
      differences.push(`${message.name}, ${splitting.name}: ${message.bytes.length} bytes whole -> `
        + `${first.out ? first.out.length : 'null'} [${preview(first.out)}], split -> `
        + `${result.out ? result.out.length : 'null'} [${preview(result.out)}]`);
  }

  if (differences.length)
    return { status: 'differs', detail: differences[0], differing: differences.length, total: splittings.length };
  if (refused === splittings.length) return { status: 'refuses', detail: `all ${refused} splitting(s)` };
  return { status: 'agrees', detail: `${splittings.length - refused}/${splittings.length} splitting(s)` };
}

// Worst outcome wins, except that agreeing on one message outweighs refusing
// another: an algorithm that streams its vector correctly and rejects a
// three-times-longer one has demonstrated the property.
const SEVERITY = ['differs', 'agrees', 'refuses', 'nondeterministic', 'whole refused',
                  'too short', 'no instance', 'no vector input'];

function sweepAlgorithm(algorithm) {
  const vector = configVector(algorithm);
  let messages;
  try { messages = messagesFor(algorithm, vector); }
  catch (error) { return { status: 'whole refused', detail: String(error.message).slice(0, 90) }; }
  if (!messages.length) return { status: 'no vector input' };

  let worst = null;
  for (const message of messages) {
    let outcome;
    try { outcome = sweepMessage(algorithm, vector, message); }
    catch (error) { outcome = { status: 'whole refused', detail: String(error.message).slice(0, 90) }; }
    if (!worst || SEVERITY.indexOf(outcome.status) < SEVERITY.indexOf(worst.status)) worst = outcome;
  }
  return worst;
}

//#endregion

function selectAlgorithms(algorithms, options) {
  return algorithms
    .filter(a => a.category)
    .filter(a => !options.category || a.category.name.toLowerCase().includes(options.category.toLowerCase()))
    .filter(a => !options.algorithm || a.name.toLowerCase().includes(options.algorithm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const algorithms = loadAlgorithms();
  const selected = selectAlgorithms(algorithms, options);

  console.log('Chunked-feed suite');
  console.log('==================\n');
  console.log('Feed(whole) must equal Feed(part1); Feed(part2); ... for any split\n');
  console.log(`${selected.length} registered algorithm(s)\n`);

  const buckets = new Map();
  const differing = [];
  const exempted = [];

  for (const algorithm of selected) {
    const reason = CHUNKED_FEED_EXEMPT.get(algorithm.name);
    const outcome = sweepAlgorithm(algorithm);
    const status = reason && outcome.status === 'differs' ? 'exempt' : outcome.status;

    if (!buckets.has(status)) buckets.set(status, []);
    buckets.get(status).push(algorithm.name);

    if (status === 'exempt') {
      exempted.push({ name: algorithm.name, reason });
      if (options.verbose) console.log(`EXEMPT ${algorithm.name} (${reason})`);
    } else if (status === 'differs') {
      differing.push({ name: algorithm.name, category: algorithm.category.name, ...outcome });
      console.log(`DIFFERS ${algorithm.name} [${algorithm.category.name}] `
        + `${outcome.differing}/${outcome.total} splitting(s)`);
      console.log(`          ${outcome.detail}`);
    } else if (options.verbose || options.listAll) {
      console.log(`${status.padEnd(16)} ${algorithm.name}${outcome.detail ? ` (${outcome.detail})` : ''}`);
    }
  }

  console.log('\nOutcome                 Algorithms');
  console.log('-'.repeat(46));
  for (const status of [...SEVERITY, 'exempt']) {
    const names = buckets.get(status);
    if (names) console.log(`  ${status.padEnd(22)}${names.length}`);
  }

  if (differing.length) {
    console.log('\nA silent difference is a data-integrity defect: a caller that streams a');
    console.log('message through one of these gets a different answer than a caller that');
    console.log('hands it over in one piece, and neither the algorithm nor the framework');
    console.log('says so. Feed must append to whatever state the previous call left, and');
    console.log('any padding or framing belongs in Result, not in each Feed.');
    console.log('\nAn algorithm that genuinely needs its whole input at once should throw on');
    console.log('the second Feed. That is reported as "refuses" and does not fail the run.');
  }

  process.exitCode = differing.length ? 1 : 0;
}

main();
