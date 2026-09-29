/**
 * OpCodesHelperTests.js - unit tests for OpCodes helpers that were added to
 * give algorithm-common operations a typed (tier-1) home. Every case is
 * written Given / When / Then and covers equivalence classes, boundaries and
 * error cases, not only the happy path.
 *
 * Part of the LIBRARY category: node tests/TestSuite.js --only=library [--verbose]
 */

'use strict';

const path = require('path');
const OpCodes = require(path.join(__dirname, '..', 'OpCodes.js'));

const cases = require('./UnitCases.js').createCases();
const test = cases.case;
function equal(actual, expected) {
  if (actual !== expected) throw new Error(`expected ${String(expected)}n, got ${String(actual)}n`);
}
function throws(fn, type) {
  try { fn(); } catch (e) {
    if (type && !(e instanceof type)) throw new Error(`expected ${type.name}, got ${e.constructor.name}: ${e.message}`);
    return;
  }
  throw new Error('expected an exception');
}

const P25519 = (1n << 255n) - 19n;

// ---------------------------------------------------------------- ModN
test('ModN: given 0 <= a < m, when reduced, then a is returned unchanged', () => {
  equal(OpCodes.ModN(3n, 7n), 3n);
});
test('ModN: given a = 0, when reduced, then 0 is returned', () => {
  equal(OpCodes.ModN(0n, 7n), 0n);
});
test('ModN: given a = m - 1 (upper boundary), when reduced, then m - 1 is returned', () => {
  equal(OpCodes.ModN(6n, 7n), 6n);
});
test('ModN: given a = m (boundary), when reduced, then 0 is returned', () => {
  equal(OpCodes.ModN(7n, 7n), 0n);
});
test('ModN: given a > m, when reduced, then the ordinary remainder is returned', () => {
  equal(OpCodes.ModN(23n, 7n), 2n);
});
test('ModN: given a negative a, when reduced, then the non-negative representative is returned', () => {
  equal(OpCodes.ModN(-3n, 7n), 4n);
});
test('ModN: given a = -m, when reduced, then 0 is returned (no result equal to m)', () => {
  equal(OpCodes.ModN(-7n, 7n), 0n);
});
test('ModN: given a = -1, when reduced, then m - 1 is returned', () => {
  equal(OpCodes.ModN(-1n, 7n), 6n);
});
test('ModN: given m = 1 (smallest modulus), when reduced, then 0 is returned for any a', () => {
  equal(OpCodes.ModN(-5n, 1n), 0n);
  equal(OpCodes.ModN(5n, 1n), 0n);
});
test('ModN: given a 255-bit modulus, when a negative value is reduced, then it lands in [0, p)', () => {
  equal(OpCodes.ModN(-2n, P25519), P25519 - 2n);
});
test('ModN: given m = 0, when reduced, then a RangeError is thrown', () => {
  throws(() => OpCodes.ModN(3n, 0n), RangeError);
});
test('ModN: given a negative modulus, when reduced, then a RangeError is thrown', () => {
  throws(() => OpCodes.ModN(3n, -7n), RangeError);
});

// ---------------------------------------------------------------- ModInverseN
test('ModInverseN: given a small prime modulus, when inverted, then the textbook inverse is returned', () => {
  equal(OpCodes.ModInverseN(3n, 11n), 4n);
});
test('ModInverseN: given a = 1, when inverted, then 1 is returned', () => {
  equal(OpCodes.ModInverseN(1n, 11n), 1n);
});
test('ModInverseN: given a = m - 1, when inverted, then m - 1 is returned (self-inverse)', () => {
  equal(OpCodes.ModInverseN(10n, 11n), 10n);
});
test('ModInverseN: given a > m, when inverted, then a is reduced first', () => {
  equal(OpCodes.ModInverseN(14n, 11n), 4n);
});
test('ModInverseN: given a negative a, when inverted, then the inverse of a mod m is returned', () => {
  equal(OpCodes.ModInverseN(-8n, 11n), 4n); // -8 = 3 mod 11
});
test('ModInverseN: given a composite modulus and a coprime value, when inverted, then the product is 1 mod m', () => {
  const inv = OpCodes.ModInverseN(7n, 40n);
  equal(inv, 23n);
  equal(OpCodes.ModN(7n * inv, 40n), 1n);
});
test('ModInverseN: given m = 1, when inverted, then 0 is returned', () => {
  equal(OpCodes.ModInverseN(5n, 1n), 0n);
});
test('ModInverseN: given a 255-bit prime, when several values are inverted, then each product is 1 mod p', () => {
  for (const a of [2n, 3n, 121666n, P25519 - 1n, (1n << 200n) + 12345n]) {
    const inv = OpCodes.ModInverseN(a, P25519);
    if (inv < 0n || inv >= P25519) throw new Error('inverse out of range');
    equal(OpCodes.ModN(a * inv, P25519), 1n);
  }
});
test('ModInverseN: given a value sharing a factor with m, when inverted, then a RangeError is thrown', () => {
  throws(() => OpCodes.ModInverseN(4n, 8n), RangeError);
});
test('ModInverseN: given a = 0, when inverted, then a RangeError is thrown', () => {
  throws(() => OpCodes.ModInverseN(0n, 11n), RangeError);
});
test('ModInverseN: given a multiple of m, when inverted, then a RangeError is thrown', () => {
  throws(() => OpCodes.ModInverseN(22n, 11n), RangeError);
});
test('ModInverseN: given m = 0, when inverted, then a RangeError is thrown', () => {
  throws(() => OpCodes.ModInverseN(3n, 0n), RangeError);
});
test('ModInverseN: given a negative modulus, when inverted, then a RangeError is thrown', () => {
  throws(() => OpCodes.ModInverseN(3n, -11n), RangeError);
});

/**
 * Run every OpCodes helper case.
 * @param {object} options - { verbose }
 * @returns {object} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  console.log('OpCodes helper tests');
  return cases.run(options);
}

module.exports = { run };
