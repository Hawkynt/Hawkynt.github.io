/**
 * TestEngineTests.js - unit tests of how TestEngine applies a vector's fields.
 * Every field of a vector must reach the instance; one that cannot - a
 * misspelling, a setting the algorithm does not have, a setter that throws -
 * fails the vector instead of leaving the default in place, where a vector
 * whose expected value the default happens to produce would pass unnoticed.
 * Every case is Given / When / Then, driven through a stand-in algorithm whose
 * output depends visibly on its one setting.
 *
 * Part of the LIBRARY category: node tests/TestSuite.js --only=library [--verbose]
 */

'use strict';

const path = require('path');
const CIPHER_ROOT = path.join(__dirname, '..');
const AlgorithmFramework = require(path.join(CIPHER_ROOT, 'AlgorithmFramework.js'));
require(path.join(CIPHER_ROOT, 'OpCodes.js'));
const TestEngine = require('./TestEngine.js');
const { createCases } = require('./UnitCases.js');

const cases = createCases();
const test = cases.case;

function equal(actual, expected, what = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}expected ${e}, got ${a}`);
}
function matches(text, pattern) {
  if (!pattern.test(String(text))) throw new Error(`expected a message matching ${pattern}, got: ${text}`);
}

/**
 * A stand-in algorithm: adds `shift` to every byte (default 0). It has a
 * hashFunction-less, salt-less interface on purpose, a property `refusing`
 * whose setter always throws, and no inverse, so only the vector is checked.
 */
class ShiftInstance {
  constructor() { this.shift = 0; this.data = []; }
  set refusing(value) { throw new Error(`refuses ${value}`); }
  get refusing() { return null; }
  Feed(data) { this.data.push(...data); }
  Result() { return this.data.map(b => (b + this.shift) % 256); }
}
const shiftAlgorithm = {
  name: 'Shift stand-in',
  category: AlgorithmFramework.CategoryType.HASH,
  CreateInstance(isInverse) { return isInverse ? null : new ShiftInstance(); }
};
const vector = fields => Object.assign({ text: 'stand-in vector', uri: 'none', input: [1, 2, 3] }, fields);
const run = fields => TestEngine.TestVector(shiftAlgorithm, vector(fields), 0);

// ------------------------------------------------------------ correct settings
test('TestEngine: given two vectors differing only in shift, when each is run, then each passes with its own output', async () => {
  const unshifted = await run({ shift: 0, expected: [1, 2, 3] });
  const shifted = await run({ shift: 5, expected: [6, 7, 8] });
  equal([unshifted.passed, shifted.passed, unshifted.error, shifted.error], [true, true, null, null]);
});
test('TestEngine: given the same two vectors with their expected values swapped, when run, then both fail - the setting is really applied', async () => {
  const unshifted = await run({ shift: 0, expected: [6, 7, 8] });
  const shifted = await run({ shift: 5, expected: [1, 2, 3] });
  equal([unshifted.passed, shifted.passed], [false, false]);
});
test('TestEngine: given a field whose value is undefined (boundary), when run, then it is not demanded of the instance', async () => {
  const result = await run({ shfit: undefined, expected: [1, 2, 3] });
  equal([result.passed, result.error], [true, null]);
});

// ------------------------------------------------------------ fields not applied
test('TestEngine: given a misspelled field whose setting\'s default yields the expected value, when run, then the vector fails naming the field and algorithm', async () => {
  // Without strictness this passed: shift stays 0, and 0 is what expected encodes
  const result = await run({ shfit: 0, expected: [1, 2, 3] });
  equal(result.passed, false);
  matches(result.error, /'shfit' is not applied: Shift stand-in has no setter or property/);
});
test('TestEngine: given a dedicated-setter field the algorithm lacks (hashFunction), when run, then the vector fails naming it', async () => {
  // The shape of the PBKDF2 defect: a hash choice the instance never took
  const result = await run({ hashFunction: 'SHA-256', expected: [1, 2, 3] });
  equal(result.passed, false);
  matches(result.error, /'hashFunction' is not applied/);
});
test('TestEngine: given a field whose setter throws, when run, then the vector fails with the field and the setter\'s message', async () => {
  const result = await run({ refusing: 7, expected: [1, 2, 3] });
  equal(result.passed, false);
  matches(result.error, /Setting vector field 'refusing' on Shift stand-in failed: refuses 7/);
});
test('TestEngine: given a misspelled field, when ConfigureInstance applies the vector, then it throws rather than configuring part of it', () => {
  let error = null;
  try { TestEngine.ConfigureInstance(shiftAlgorithm, new ShiftInstance(), vector({ shfit: 1 })); } catch (e) { error = e; }
  if (!error) throw new Error('expected an exception');
  matches(error.message, /'shfit'/);
});

// ------------------------------------------------------------ descriptive and framework fields
test('TestEngine: given the declared descriptive field roundTripOnly on a vector with no expected value, when run, then it passes', async () => {
  const result = await run({ roundTripOnly: true });
  equal([result.passed, result.error], [true, null]);
});
test('TestEngine: given roundTripOnly on a vector that does carry an expected value, when run, then it fails as contradictory', async () => {
  const result = await run({ roundTripOnly: true, expected: [1, 2, 3] });
  equal(result.passed, false);
  matches(result.error, /'roundTripOnly' contradicts its expected value/);
});
test('TestEngine: given only framework fields (text, uri, input, expected, inverse), when run, then none is demanded of the instance', async () => {
  const result = await run({ inverse: false, expected: [1, 2, 3] });
  equal([result.passed, result.error], [true, null]);
});

// ------------------------------------------------------------ cipher modes
test('TestEngine: given a cipher-mode vector naming an unregistered block cipher, when run, then it fails instead of running against the stand-in cipher', async () => {
  const mode = {
    name: 'Mode stand-in',
    category: AlgorithmFramework.CategoryType.MODE,
    CreateInstance(isInverse) {
      return isInverse ? null : { setBlockCipher() {}, key: null, Feed() {}, Result() { return [0]; } };
    }
  };
  const result = await TestEngine.TestVector(mode, vector({ cipher: 'No Such Cipher', key: [0], expected: [0] }), 0);
  equal(result.passed, false);
  matches(result.error, /'cipher' is not applied: no block cipher named 'No Such Cipher'/);
});

// ------------------------------------------------------------ UnitCases.runAsync
test('UnitCases: given an asynchronous case that rejects, when runAsync runs the list, then it is counted as failed', async () => {
  const list = createCases();
  list.case('resolves', async () => {});
  list.case('rejects', async () => { throw new Error('late'); });
  const log = console.log;
  console.log = () => {};
  let result;
  try { result = await list.runAsync(); } finally { console.log = log; }
  equal([result.passed, result.failed], [1, 1]);
});

/**
 * Run every case of the engine's vector handling.
 * @param {object} options - { verbose }
 * @returns {Promise<object>} { passed, failed, skipped, detail }
 */
async function runAll(options = {}) {
  console.log('Test engine tests');
  return cases.runAsync(options);
}

module.exports = { run: runAll };

if (require.main === module) {
  runAll({ verbose: process.argv.includes('--verbose') || process.argv.includes('-v') })
    .then(result => process.exit(result.failed ? 1 : 0));
}
