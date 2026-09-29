/**
 * AlgorithmRegressionTests.js - unit tests of algorithm paths the committed
 * vectors cannot reach: message lengths too long to hash in a test run, and
 * code that runs only when a dependency is missing. Every case is written
 * Given / When / Then; each expected value comes from the specification or an
 * external implementation, never from the code under test.
 *
 * Part of the LIBRARY category: node tests/TestSuite.js --only=library [--verbose]
 */

'use strict';

const path = require('path');
const CIPHER_ROOT = path.join(__dirname, '..');
require(path.join(CIPHER_ROOT, 'AlgorithmFramework.js'));
require(path.join(CIPHER_ROOT, 'OpCodes.js'));

const cases = require('./UnitCases.js').createCases();
const test = cases.case;

function hex(bytes) {
  return Array.from(bytes, b => (b & 0xFF).toString(16).padStart(2, '0')).join('');
}
function equalHex(actual, expected) {
  if (hex(actual) !== expected) throw new Error(`expected ${expected}, got ${hex(actual)}`);
}
/** Little-endian bytes of a non-negative BigInt, zero-extended to the given width */
function leBytes(value, width) {
  const out = [];
  for (let i = 0; i < width; i++) out.push(Number((value >> BigInt(8 * i)) & 0xFFn));
  return out;
}

// A byte count whose bit count needs the 33rd bit: 2^29 + 3 bytes = 2^32 + 24 bits
const LONG_BYTES = 2 ** 29 + 3;
const LONG_BITS = BigInt(LONG_BYTES) * 8n;

// ---------------------------------------------------------------- HAVAL
test('HAVAL: given a message of 2^32 + 24 bits, when finalized, then bytes 120-127 of the last block hold all 64 bits of the length', () => {
  const { HavalHasher } = require(path.join(CIPHER_ROOT, 'algorithms', 'hash', 'haval.js'));
  const hasher = new HavalHasher(3, 256);
  const blocks = [];
  hasher.processBlock = block => { blocks.push(Array.from(block)); };
  // Given: 2^29 bytes already absorbed, then a 3-byte tail
  hasher.totalLength = LONG_BYTES - 3;
  hasher.update([0, 0, 0]);
  hasher.finalize();
  // Then: HAVAL's footer ends with the bit length as a 64-bit little-endian number
  const last = blocks[blocks.length - 1];
  equalHex(last.slice(120, 128), hex(leBytes(LONG_BITS, 8)));
});

// ---------------------------------------------------------------- GOST R 34.11-94
test('GOST R 34.11-94: given a message of 2^32 + 24 bits, when finalized, then the length block holds the whole bit count', () => {
  const { GOST3411Instance, GOST3411Algorithm } = require(path.join(CIPHER_ROOT, 'algorithms', 'hash', 'gost3411.js'));
  const instance = new GOST3411Instance(new GOST3411Algorithm());
  const blocks = [];
  const compress = instance._processBlock.bind(instance);
  instance._processBlock = (block, offset) => { blocks.push(Array.from(block)); compress(block, offset); };
  // Given: 2^29 bytes already absorbed, then a 3-byte tail
  instance.byteCount = LONG_BYTES - 3;
  instance.Feed([0, 0, 0]);
  instance.Result();
  // Then: after the padded tail come L (the bit length, 256-bit little-endian) and the checksum
  equalHex(blocks[blocks.length - 2], hex(leBytes(LONG_BITS, 32)));
});

// ---------------------------------------------------------------- missing dependencies
// A page context (no require, no module, no global) holding only the named
// scripts: what an algorithm meets when the hash or cipher it builds on is not
// on the page.
function pageWith(...files) {
  const fs = require('fs');
  const vm = require('vm');
  const sandbox = require('./BrowserLoad').browserContext();
  for (const file of ['AlgorithmFramework.js', 'OpCodes.js', ...files]) {
    vm.runInContext(fs.readFileSync(path.join(CIPHER_ROOT, file), 'utf8'), sandbox, { filename: file });
  }
  return sandbox.AlgorithmFramework;
}
/** Runs fn; a thrown Error is returned as { error }, a result as { value } */
function attempt(fn) {
  try { return { value: fn() }; } catch (e) { return { error: e }; }
}
/** Passes when the outcome is the expected bytes or an error naming the missing dependency */
function correctOrRefused(outcome, expected, dependency) {
  if (outcome.error) {
    if (!String(outcome.error.message).includes(dependency)) throw new Error(`refused without naming ${dependency}: ${outcome.error.message}`);
    return;
  }
  equalHex(outcome.value, expected);
}

function pbkdf2(framework, password, salt, iterations, size) {
  const instance = framework.Find('PBKDF2').CreateInstance();
  instance.salt = Array.from(Buffer.from(salt));
  instance.iterations = iterations;
  instance.outputSize = size;
  instance.Feed(Array.from(Buffer.from(password)));
  return instance.Result();
}

// RFC 6070 test case 1, also node's crypto.pbkdf2Sync('password', 'salt', 1, 20, 'sha1')
const PBKDF2_RFC6070_1 = '0c60c80f961f0e71f3a9b524af6012062fe037a6';

test('PBKDF2: given a page without SHA-1, when a key is derived, then it is the RFC 6070 key or a refusal naming SHA-1 - never a wrong key', () => {
  const framework = pageWith('algorithms/kdf/pbkdf2.js');
  correctOrRefused(attempt(() => pbkdf2(framework, 'password', 'salt', 1, 20)), PBKDF2_RFC6070_1, 'SHA-1');
});
test('PBKDF2: given a page with SHA-1, when a key is derived, then it is the RFC 6070 key', () => {
  const framework = pageWith('algorithms/hash/sha1.js', 'algorithms/kdf/pbkdf2.js');
  equalHex(pbkdf2(framework, 'password', 'salt', 1, 20), PBKDF2_RFC6070_1);
});

function pbkdf1(framework, hashName, iterations) {
  const instance = framework.Find('PBKDF1').CreateInstance();
  instance.hashFunction = hashName;
  instance.salt = Array.from(Buffer.from('saltsalt'));
  instance.iterations = iterations;
  instance.outputSize = 16;
  instance.Feed(Array.from(Buffer.from('password')));
  return instance.Result();
}
// OpenSSL evpkdf_pbkdf1.txt: password/saltsalt, 2 iterations, SHA-1
const PBKDF1_OPENSSL_SHA1_2 = 'e3a8dfcf2eea6dc81d2ad154274faae9';

test('PBKDF1: given a page without SHA-1, when a key is derived with SHA1, then it is the OpenSSL key or a refusal naming SHA-1 - never a wrong key', () => {
  const framework = pageWith('algorithms/kdf/pbkdf1.js');
  correctOrRefused(attempt(() => pbkdf1(framework, 'SHA1', 2)), PBKDF1_OPENSSL_SHA1_2, 'SHA-1');
});
test('PBKDF1: given a page with SHA-1, when a key is derived with the undashed name SHA1, then it is the OpenSSL key', () => {
  const framework = pageWith('algorithms/hash/sha1.js', 'algorithms/kdf/pbkdf1.js');
  equalHex(pbkdf1(framework, 'SHA1', 2), PBKDF1_OPENSSL_SHA1_2);
});

/**
 * Run every algorithm regression case.
 * @param {object} options - { verbose }
 * @returns {object} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  console.log('Algorithm regression tests');
  return cases.run(options);
}

module.exports = { run };
