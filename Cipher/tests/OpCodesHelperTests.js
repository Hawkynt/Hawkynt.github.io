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

// ---------------------------------------------------------------- Pack64 / Unpack64
function bytesEqual(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((b, i) => b !== expected[i]))
    throw new Error(`expected [${expected}], got [${actual}]`);
}
// Boundary values with their 8 big-endian bytes (the spec is positional notation)
const QWORDS = [
  ['0', 0n, [0, 0, 0, 0, 0, 0, 0, 0]],
  ['1', 1n, [0, 0, 0, 0, 0, 0, 0, 1]],
  ['2^32 - 1', 0xFFFFFFFFn, [0, 0, 0, 0, 0xFF, 0xFF, 0xFF, 0xFF]],
  ['2^32', 0x100000000n, [0, 0, 0, 1, 0, 0, 0, 0]],
  ['2^53', 1n << 53n, [0, 0x20, 0, 0, 0, 0, 0, 0]],
  ['2^64 - 1', (1n << 64n) - 1n, [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]],
  ['0x0102030405060708', 0x0102030405060708n, [1, 2, 3, 4, 5, 6, 7, 8]]
];
for (const [name, value, be] of QWORDS) {
  const le = be.slice().reverse();
  test(`Pack64BE: given the big-endian bytes of ${name}, when packed, then the BigInt ${name} is returned`, () => {
    equal(OpCodes.Pack64BE(...be), value);
  });
  test(`Pack64LE: given the little-endian bytes of ${name}, when packed, then the BigInt ${name} is returned`, () => {
    equal(OpCodes.Pack64LE(...le), value);
  });
  test(`Unpack64BE: given the BigInt ${name}, when unpacked, then its 8 big-endian bytes are returned`, () => {
    bytesEqual(OpCodes.Unpack64BE(value), be);
  });
  test(`Unpack64LE: given the BigInt ${name}, when unpacked, then its 8 little-endian bytes are returned`, () => {
    bytesEqual(OpCodes.Unpack64LE(value), le);
  });
  test(`Pack64/Unpack64: given ${name}, when unpacked and packed again in either byte order, then it round-trips`, () => {
    equal(OpCodes.Pack64BE(...OpCodes.Unpack64BE(value)), value);
    equal(OpCodes.Pack64LE(...OpCodes.Unpack64LE(value)), value);
  });
}
test('Pack64BE: given bytes above 0xFF, when packed, then only their low 8 bits count', () => {
  equal(OpCodes.Pack64BE(0x101, 0, 0, 0, 0, 0, 0, 0x1FF), (1n << 56n) + 0xFFn);
});
test('Pack64LE: given bytes above 0xFF, when packed, then only their low 8 bits count', () => {
  equal(OpCodes.Pack64LE(0x1FF, 0, 0, 0, 0, 0, 0, 0x101), (1n << 56n) + 0xFFn);
});
test('Unpack64BE/LE: given 2^53 as a Number (a safe integer), when unpacked, then the bytes equal those of the BigInt', () => {
  bytesEqual(OpCodes.Unpack64BE(2 ** 53), [0, 0x20, 0, 0, 0, 0, 0, 0]);
  bytesEqual(OpCodes.Unpack64LE(2 ** 53), [0, 0, 0, 0, 0, 0, 0x20, 0]);
});
test('Unpack64BE/LE: given 2^64 (one past the range), when unpacked, then it wraps to 0 like every 64-bit word', () => {
  bytesEqual(OpCodes.Unpack64BE(1n << 64n), [0, 0, 0, 0, 0, 0, 0, 0]);
  bytesEqual(OpCodes.Unpack64LE(1n << 64n), [0, 0, 0, 0, 0, 0, 0, 0]);
});
test('Unpack64BE: given -1n, when unpacked, then its 64-bit two\'s complement (all ones) is returned', () => {
  bytesEqual(OpCodes.Unpack64BE(-1n), [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
});
test('Unpack64LE: given a fractional Number, when unpacked, then a RangeError is thrown', () => {
  throws(() => OpCodes.Unpack64LE(1.5), RangeError);
});

// ---------------------------------------------------------------- SecureRandomBytes
const isByteArray = (a, n) => Array.isArray(a) && a.length === n && a.every(b => Number.isInteger(b) && b >= 0 && b <= 255);
test('SecureRandomBytes: given 32, when drawn, then a plain array of 32 bytes (uint8[]) is returned', () => {
  if (!isByteArray(OpCodes.SecureRandomBytes(32), 32)) throw new Error('not 32 bytes in 0..255');
});
test('SecureRandomBytes: given 0 (lower boundary), when drawn, then an empty array is returned', () => {
  equal(OpCodes.SecureRandomBytes(0).length, 0);
});
test('SecureRandomBytes: given 65537 (one past a Web Crypto call), when drawn, then every byte is filled', () => {
  const a = OpCodes.SecureRandomBytes(65537);
  if (!isByteArray(a, 65537)) throw new Error('not 65537 bytes');
  if (a.slice(65520).every(b => b === 0)) throw new Error('the tail beyond 65536 was not filled');
});
test('SecureRandomBytes: given two draws of 32, when compared, then they differ', () => {
  if (OpCodes.SecureRandomBytes(32).join() === OpCodes.SecureRandomBytes(32).join()) throw new Error('two draws are equal');
});
test('SecureRandomBytes: given no Web Crypto, when drawn, then node\'s crypto.randomBytes fills them', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
  try {
    if (!isByteArray(OpCodes.SecureRandomBytes(16), 16)) throw new Error('not 16 bytes');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor); else delete globalThis.crypto;
  }
});
test('SecureRandomBytes: given -1, 1.5 or a string, when drawn, then a RangeError is thrown', () => {
  throws(() => OpCodes.SecureRandomBytes(-1), RangeError);
  throws(() => OpCodes.SecureRandomBytes(1.5), RangeError);
  throws(() => OpCodes.SecureRandomBytes('4'), RangeError);
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
