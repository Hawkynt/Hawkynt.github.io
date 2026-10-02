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

// ---------------------------------------------------------------- GMAC
test('GMAC: given 2^32 + 24 bits of data, when the tag is computed, then the GHASH length block holds all 64 bits of len(A) and a zero len(C)', () => {
  const { GMACAlgorithm } = require(path.join(CIPHER_ROOT, 'algorithms', 'mac', 'gmac.js'));
  const instance = new GMACAlgorithm().CreateInstance();
  instance.key = Array.from(Buffer.alloc(16));
  instance.nonce = Array.from(Buffer.alloc(12));
  let ghashInput = null;
  const ghash = instance._ghash.bind(instance);
  instance._ghash = data => { ghashInput = Array.from(data); return ghash(data); };
  // Given: a buffer reporting 2^29 + 3 bytes whose contents GHASH need not see
  // (the length block is what is under test, and 512 MiB is too much to allocate)
  instance.inputBuffer = { length: LONG_BYTES, slice: () => [] };
  // When
  instance.Result();
  // Then: SP 800-38D 7.1 step 5 - [len(A)]_64 || [len(C)]_64, big-endian
  equalHex(ghashInput.slice(-16), hex(leBytes(LONG_BITS, 8).reverse().concat(leBytes(0n, 8))));
});

// ---------------------------------------------------------------- TupleHash
// cSHAKE absorbs N and S before the message, so TupleHash used to drop a
// customization set after the elements. Expected values: NIST SP 800-185
// TupleHash samples #2 and #5, X = (000102, 101112131415), S = "My Tuple App".
function tupleHashWithCustomizationLast(algorithmName, outputSize) {
  require(path.join(CIPHER_ROOT, 'algorithms', 'hash', 'cshake.js'));
  const algorithms = require(path.join(CIPHER_ROOT, 'algorithms', 'hash', 'tuplehash.js'));
  const instance = new algorithms[algorithmName]().CreateInstance();
  // Given: the elements are fed first, then the output length, then S
  instance.Feed(Array.from(Buffer.from('000102', 'hex')));
  instance.Feed(Array.from(Buffer.from('101112131415', 'hex')));
  instance.outputSize = outputSize;
  instance.customization = Array.from(Buffer.from('My Tuple App'));
  // When: the digest is computed
  return instance.Result();
}
test('TupleHash128: given the customization is set after the elements, when hashed, then the digest is NIST sample #2', () => {
  equalHex(tupleHashWithCustomizationLast('TupleHash128', 32), '75cdb20ff4db1154e841d758e24160c54bae86eb8c13e7f5f40eb35588e96dfb');
});
test('TupleHash256: given the customization is set after the elements, when hashed, then the digest is NIST sample #5', () => {
  equalHex(tupleHashWithCustomizationLast('TupleHash256', 64), '147c2191d5ed7efd98dbd96d7ab5a11692576f5fe2a5065f3e33de6bba9f3aa1c4e9a068a289c61c95aab30aee1e410b0b607de3620e24a4e3bf9852a1d4367e');
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

function pbkdf2(framework, password, salt, iterations, size, hashName) {
  const instance = framework.Find('PBKDF2').CreateInstance();
  if (hashName !== undefined) instance.hashFunction = hashName;
  instance.salt = Array.from(Buffer.from(salt));
  instance.iterations = iterations;
  instance.outputSize = size;
  instance.Feed(Array.from(Buffer.from(password)));
  return instance.Result();
}

// RFC 6070 test case 1, also node's crypto.pbkdf2Sync('password', 'salt', 1, 20, 'sha1')
const PBKDF2_RFC6070_1 = '0c60c80f961f0e71f3a9b524af6012062fe037a6';

// RFC 7914 section 11 (PBKDF2-HMAC-SHA256, passwd/salt, c=1), first 32 of its 64 bytes;
// also node's crypto.pbkdf2Sync('passwd', 'salt', 1, 32, 'sha256')
const PBKDF2_RFC7914_SHA256_32 = '55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc';

test('PBKDF2: given a page with HMAC but without SHA-1, when a key is derived, then it is the RFC 6070 key or a refusal naming SHA-1 - never a wrong key', () => {
  const framework = pageWith('algorithms/mac/hmac.js', 'algorithms/kdf/pbkdf2.js');
  correctOrRefused(attempt(() => pbkdf2(framework, 'password', 'salt', 1, 20)), PBKDF2_RFC6070_1, 'SHA-1');
});
test('PBKDF2: given a page with SHA-1 but without HMAC, when a key is derived, then it is the RFC 6070 key or a refusal naming HMAC - never a wrong key', () => {
  const framework = pageWith('algorithms/hash/sha1.js', 'algorithms/kdf/pbkdf2.js');
  correctOrRefused(attempt(() => pbkdf2(framework, 'password', 'salt', 1, 20)), PBKDF2_RFC6070_1, 'HMAC');
});
test('PBKDF2: given a page with SHA-1 and HMAC, when a key is derived, then it is the RFC 6070 key', () => {
  const framework = pageWith('algorithms/hash/sha1.js', 'algorithms/mac/hmac.js', 'algorithms/kdf/pbkdf2.js');
  equalHex(pbkdf2(framework, 'password', 'salt', 1, 20), PBKDF2_RFC6070_1);
});
test('PBKDF2: given a page with SHA-256 and HMAC, when hashFunction is SHA-256, then the key is the RFC 7914 one', () => {
  const framework = pageWith('algorithms/hash/sha256.js', 'algorithms/mac/hmac.js', 'algorithms/kdf/pbkdf2.js');
  equalHex(pbkdf2(framework, 'passwd', 'salt', 1, 32, 'SHA-256'), PBKDF2_RFC7914_SHA256_32);
});
test('PBKDF2: given an unknown or non-string hash name, when it is set, then it is refused - never silently ignored', () => {
  const { PBKDF2Algorithm } = require(path.join(CIPHER_ROOT, 'algorithms', 'kdf', 'pbkdf2.js'));
  const instance = new PBKDF2Algorithm().CreateInstance();
  for (const bad of ['SHA256', 'MD5', 'SHA3-256', '', 'WHIRLPOOL', Array.from(Buffer.from('SHA-256')), null, 256]) {
    const outcome = attempt(() => { instance.hashFunction = bad; });
    if (!outcome.error) throw new Error(`${JSON.stringify(bad)} was accepted`);
    if (!/hash/i.test(outcome.error.message)) throw new Error(`refusal does not say why: ${outcome.error.message}`);
  }
  if (instance.hashFunction !== 'SHA-1') throw new Error(`a refused name changed the hash to ${instance.hashFunction}`);
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

function sp800108(framework, hashName, keyHex, outputLength) {
  const instance = framework.Find('SP800-108-Counter').CreateInstance();
  instance.hashAlgorithm = hashName;
  instance.label = Array.from(Buffer.from('LABEL'));
  instance.context = Array.from(Buffer.from('CONTEXT'));
  instance.outputLength = outputLength;
  instance.counterBits = 32;
  instance.Feed(Array.from(Buffer.from(keyHex, 'hex')));
  return instance.Result();
}
// An 80-byte key, longer than the SHA-256 block: OpenSSL 3.5
// `openssl kdf -keylen 48 -kdfopt mac:HMAC -kdfopt digest:SHA2-256 -kdfopt hexkey:<key>
//  -kdfopt hexsalt:4c4142454c -kdfopt hexinfo:434f4e54455854 KBKDF`, and the same from node's createHmac
const KBKDF_KEY80 = '01080f161d242b323940474e555c636a71787f868d949ba2a9b0b7bec5ccd3dae1e8eff6fd040b121920272e353c434a51585f666d747b828990979ea5acb3bac1c8cfd6dde4ebf2f900070e151c232a';
const KBKDF_SHA256_KEY80_48 = 'f28a73665986e50ce5d1084bdcf38f9f77c895daba4e28f099b7a118e01ead397831f8dd6a3402ed1339de497275652c';

test('SP 800-108 counter: given a page with HMAC and SHA-256 and an 80-byte key, when 48 bytes (two PRF blocks) are derived, then they are the OpenSSL KBKDF bytes', () => {
  const framework = pageWith('algorithms/hash/sha256.js', 'algorithms/mac/hmac.js', 'algorithms/kdf/sp800-108-counter.js');
  equalHex(sp800108(framework, 'SHA-256', KBKDF_KEY80, 48), KBKDF_SHA256_KEY80_48);
});
test('SP 800-108 counter: given a page without HMAC, when a key is derived, then it is the OpenSSL KBKDF key or a refusal naming HMAC - never a wrong key', () => {
  const framework = pageWith('algorithms/hash/sha256.js', 'algorithms/kdf/sp800-108-counter.js');
  correctOrRefused(attempt(() => sp800108(framework, 'SHA-256', KBKDF_KEY80, 48)), KBKDF_SHA256_KEY80_48, 'HMAC');
});

function gmac(framework, keyHex, nonceHex, messageHex) {
  const instance = framework.Find('GMAC').CreateInstance();
  instance.key = Array.from(Buffer.from(keyHex, 'hex'));
  instance.nonce = Array.from(Buffer.from(nonceHex, 'hex'));
  instance.Feed(Array.from(Buffer.from(messageHex, 'hex')));
  return instance.Result();
}
// node: createCipheriv('aes-128-gcm', key, nonce), setAAD(message), empty plaintext, getAuthTag()
const GMAC_KEY = '010e1b2835424f5c697683909daab7c4';
const GMAC_NONCE = '020f1c293643505d6a778491';
const GMAC_MESSAGE = '03101d2a3744515e6b7885929facb9c6d3e0edfa';
const GMAC_TAG = 'be845653884a7a35f9d79b6fd26134cf';

test('GMAC: given a page with Rijndael, when a 20-byte message is authenticated, then the tag is node AES-GCM\'s', () => {
  const framework = pageWith('algorithms/block/rijndael.js', 'algorithms/mac/gmac.js');
  equalHex(gmac(framework, GMAC_KEY, GMAC_NONCE, GMAC_MESSAGE), GMAC_TAG);
});
test('GMAC: given a page without AES, when a message is authenticated, then the tag is node AES-GCM\'s or a refusal naming AES - never a wrong tag', () => {
  const framework = pageWith('algorithms/mac/gmac.js');
  correctOrRefused(attempt(() => gmac(framework, GMAC_KEY, GMAC_NONCE, GMAC_MESSAGE)), GMAC_TAG, 'AES');
});

// ---------------------------------------------------------------- Brotli
// The encoder used to answer an empty input with zero bytes, which no other
// Brotli decoder accepts. The oracle is node's own Brotli decoder, not ours.
test('Brotli: given an empty input, when compressed, then node\'s zlib decodes the stream to zero bytes', () => {
  const zlib = require('zlib');
  if (typeof zlib.brotliDecompressSync !== 'function') return; // no reference decoder in this node build
  require(path.join(CIPHER_ROOT, 'algorithms', 'compression', 'brotli-dictionary.data.js'));
  require(path.join(CIPHER_ROOT, 'algorithms', 'compression', 'brotli.js'));
  const brotli = global.AlgorithmFramework.Algorithms.find(a => a.name === 'Brotli');
  const encoder = brotli.CreateInstance(false);
  encoder.Feed([]);
  const stream = encoder.Result();
  if (stream.length === 0) throw new Error('an empty input produced zero bytes, which is not a Brotli stream');
  const decoded = zlib.brotliDecompressSync(Buffer.from(stream));
  if (decoded.length !== 0) throw new Error(`node decoded ${decoded.length} byte(s), expected none`);
});

// ---------------------------------------------------------------- Zstandard
// RFC 8878 4.2.1.3: a Huffman tree description never transmits the last
// symbol's weight; the decoder derives it from the power-of-2 sum. The encoder
// used to write that weight and the decoder used to expect it, so Huffman-coded
// literals over small alphabets broke interoperability in both directions. The
// oracle is node's own Zstandard codec, never our encoder's output.
function smallAlphabetInputs() {
  const inputs = [];
  let seed = 20260930;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  for (const symbols of [2, 3, 4, 7, 16])
    for (const length of [16, 31, 100, 1000, 4096, 20000]) {
      const data = [];
      for (let i = 0; i < length; ++i) data.push(Math.floor(next() / 65536) % symbols); // an LCG's low bits have short periods
      inputs.push({ label: `${symbols} symbols x ${length}`, data });
    }
  return inputs;
}
function zstandard() {
  require(path.join(CIPHER_ROOT, 'algorithms', 'compression', 'zstd.js'));
  return global.AlgorithmFramework.Algorithms.find(a => a.name === 'Zstandard');
}
function zstdPass(algorithm, inverse, bytes) {
  const instance = algorithm.CreateInstance(inverse);
  instance.Feed(bytes);
  return instance.Result();
}

test('Zstandard: given small-alphabet inputs, when compressed, then node\'s zlib decodes every stream to the input', () => {
  const zlib = require('zlib');
  if (typeof zlib.zstdDecompressSync !== 'function') return; // no reference decoder in this node build
  const algorithm = zstandard();
  const failures = [];
  for (const { label, data } of smallAlphabetInputs()) {
    let decoded = null;
    try { decoded = [...zlib.zstdDecompressSync(Buffer.from(zstdPass(algorithm, false, data)))]; }
    catch (error) { failures.push(`${label}: node rejected the stream (${error.message})`); continue; }
    if (hex(decoded) !== hex(data)) failures.push(`${label}: node decoded different bytes`);
  }
  if (failures.length) throw new Error(`${failures.length} case(s): ${failures.slice(0, 4).join('; ')}`);
});

test('Zstandard: given small-alphabet streams from node\'s zlib, when decompressed, then every stream yields the input', () => {
  const zlib = require('zlib');
  if (typeof zlib.zstdCompressSync !== 'function') return; // no reference encoder in this node build
  const algorithm = zstandard();
  const failures = [];
  for (const { label, data } of smallAlphabetInputs()) {
    let decoded = null;
    try { decoded = zstdPass(algorithm, true, [...zlib.zstdCompressSync(Buffer.from(data))]); }
    catch (error) { failures.push(`${label}: threw ${error.message}`); continue; }
    if (hex(decoded) !== hex(data)) failures.push(`${label}: decoded different bytes`);
  }
  if (failures.length) throw new Error(`${failures.length} case(s): ${failures.slice(0, 4).join('; ')}`);
});

// ---------------------------------------------------------------- XChaCha20
function xchacha20Instance() {
  const { XChaCha20Algorithm } = require(path.join(CIPHER_ROOT, 'algorithms', 'stream', 'xchacha20.js'));
  return new XChaCha20Algorithm().CreateInstance();
}
function expectThrow(fn, fragment) {
  try { fn(); } catch (error) {
    if (!String(error.message).includes(fragment)) throw new Error(`threw '${error.message}', expected '${fragment}'`);
    return;
  }
  throw new Error(`did not throw (expected '${fragment}')`);
}

// HChaCha20 output is only an intermediate subkey, which no XChaCha20 vector exposes
test('XChaCha20: given the draft-irtf-cfrg-xchacha-03 section 2.2.1 key and nonce, when HChaCha20 runs, then it returns the published subkey', () => {
  const instance = xchacha20Instance();
  const key = [...Buffer.from('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', 'hex')];
  const nonce = [...Buffer.from('000000090000004a0000000031415927', 'hex')];
  equalHex(instance._hchacha20(key, nonce), '82413b4227b27bfed30e42508a877d73a0f9e4d58a74a853c12ec41326d3ecdc');
});

test('XChaCha20: given a libsodium tv_hchacha20 key and input, when HChaCha20 runs, then it returns the published output', () => {
  // https://github.com/jedisct1/libsodium/blob/master/test/default/xchacha20.c (first tv_hchacha20 entry)
  const instance = xchacha20Instance();
  const key = [...Buffer.from('24f11cce8a1b3d61e441561a696c1c1b7e173d084fd4812425435a8896a013dc', 'hex')];
  const input = [...Buffer.from('d9660c5900ae19ddad28d6e06e45fe5e', 'hex')];
  equalHex(instance._hchacha20(key, input), '5966b3eec3bff1189f831f06afe4d4e3be97fa9235ec8c20d08acfbbb4e851e3');
});

// A.3.2.2 needs block counter 1, which the cross-language harnesses do not apply
test('XChaCha20: given the draft-irtf-cfrg-xchacha-03 A.3.2.2 inputs and block counter 1, when encrypted, then the published ciphertext results', () => {
  const { XChaCha20Algorithm } = require(path.join(CIPHER_ROOT, 'algorithms', 'stream', 'xchacha20.js'));
  const algorithm = new XChaCha20Algorithm();
  const a321 = algorithm.tests[0]; // A.3.2.1: the same plaintext, key and nonce at block counter 0
  const instance = algorithm.CreateInstance();
  instance.key = a321.key;
  instance.nonce = a321.nonce;
  instance.counter = 1;
  instance.Feed(a321.input);
  equalHex(instance.Result(),
    '7d0a2e6b7f7c65a236542630294e063b7ab9b555a5d5149aa21e4ae1e4fbce87' +
    'ecc8e08a8b5e350abe622b2ffa617b202cfad72032a3037e76ffdcdc4376ee05' +
    '3a190d7e46ca1de04144850381b9cb29f051915386b8a710b8ac4d027b8b050f' +
    '7cba5854e028d564e453b8a968824173fc16488b8970cac828f11ae53cabd201' +
    '12f87107df24ee6183d2274fe4c8b1485534ef2c5fbc1ec24bfc3663efaa08bc' +
    '047d29d25043532db8391a8a3d776bf4372a6955827ccb0cdd4af403a7ce4c63' +
    'd595c75a43e045f0cce1f29c8b93bd65afc5974922f214a40b7c402cdb91ae73' +
    'c0b63615cdad0480680f16515a7ace9d39236464328a37743ffc28f4ddb324f4' +
    'd0f5bbdc270c65b1749a6efff1fbaa09536175ccd29fb9e6057b307320d31683' +
    '8a9c71f70b5b5907a66f7ea49aadc409');
});

test('XChaCha20: given the counter at 2^32-1, when one block is encrypted, then it succeeds; when a second block is needed, then it throws instead of wrapping', () => {
  const instance = xchacha20Instance();
  instance.key = new Array(32).fill(0);
  instance.counter = 0xFFFFFFFF;
  instance.Feed(new Array(64).fill(0));
  if (instance.Result().length !== 64) throw new Error('one block at the last counter value was not produced');
  instance.Feed(new Array(65).fill(0));
  expectThrow(() => instance.Result(), 'wrap');
});

test('XChaCha20: given a counter outside 0..2^32-1 or not an integer, when it is set, then it is rejected', () => {
  const instance = xchacha20Instance();
  expectThrow(() => { instance.counter = -1; }, 'counter');
  expectThrow(() => { instance.counter = 0x100000000; }, 'counter');
  expectThrow(() => { instance.counter = 1.5; }, 'counter');
  instance.counter = null;
  if (instance.counter !== 0) throw new Error('null did not restore counter 0');
});

// ---------------------------------------------------------------- random padding
// The vectors run seeded or in test mode; the secure-random path is what an
// unseeded instance uses, and its bytes cannot be committed as a vector.
function paddingInstance(file, className, isInverse) {
  const Algorithm = require(path.join(CIPHER_ROOT, 'algorithms', 'padding', file))[className];
  return new Algorithm().CreateInstance(isInverse);
}
function pad(file, className, data, blockSize) {
  const instance = paddingInstance(file, className, false);
  instance.blockSize = blockSize;
  instance.Feed(data);
  return instance.Result();
}
const PAD_DATA = [0x41, 0x42, 0x43, 0x44, 0x45];

test('ISO 10126: given an unseeded instance and 5 bytes, when padded to 16, then 10 secure random bytes and the length byte 11 follow the data', () => {
  const padded = pad('iso10126.js', 'Iso10126Algorithm', PAD_DATA, 16);
  if (padded.length !== 16) throw new Error(`expected 16 bytes, got ${padded.length}`);
  equalHex(padded.slice(0, 5), hex(PAD_DATA));
  if (padded[15] !== 11) throw new Error(`expected length byte 11, got ${padded[15]}`);
  for (const b of padded) if (!Number.isInteger(b) || b < 0 || b > 255) throw new Error(`not a byte: ${b}`);
});

test('ISO 10126: given an unseeded instance and a whole block, when padded, then a full block of 15 random bytes and the length byte 16 is added', () => {
  const padded = pad('iso10126.js', 'Iso10126Algorithm', new Array(16).fill(7), 16);
  if (padded.length !== 32 || padded[31] !== 16) throw new Error(`expected 32 bytes ending in 16, got ${padded.length} ending in ${padded[31]}`);
});

test('ISO 10126: given two unseeded paddings of the same data, when compared, then their random bytes differ and both unpad to the data', () => {
  const first = pad('iso10126.js', 'Iso10126Algorithm', PAD_DATA, 32);
  const second = pad('iso10126.js', 'Iso10126Algorithm', PAD_DATA, 32);
  // 26 random bytes each: equal by chance with probability 2^-208
  if (hex(first) === hex(second)) throw new Error('two unseeded paddings are identical');
  for (const padded of [first, second]) {
    const unpad = paddingInstance('iso10126.js', 'Iso10126Algorithm', true);
    unpad.blockSize = 32;
    unpad.Feed(padded);
    equalHex(unpad.Result(), hex(PAD_DATA));
  }
});

test('Random padding: given an unseeded instance and 5 bytes, when padded to 16 and unpadded with the original length, then the data returns', () => {
  const padded = pad('random.js', 'RandomPaddingAlgorithm', PAD_DATA, 16);
  if (padded.length !== 16) throw new Error(`expected 16 bytes, got ${padded.length}`);
  equalHex(padded.slice(0, 5), hex(PAD_DATA));
  for (const b of padded) if (!Number.isInteger(b) || b < 0 || b > 255) throw new Error(`not a byte: ${b}`);
  const unpad = paddingInstance('random.js', 'RandomPaddingAlgorithm', true);
  unpad.blockSize = 16;
  unpad.setOriginalLength(PAD_DATA.length);
  unpad.Feed(padded);
  equalHex(unpad.Result(), hex(PAD_DATA));
});

test('Random padding: given a whole block, when padded, then nothing is added', () => {
  const padded = pad('random.js', 'RandomPaddingAlgorithm', new Array(16).fill(7), 16);
  equalHex(padded, hex(new Array(16).fill(7)));
});

test('Random padding: given no original length, when unpadding, then it is refused', () => {
  const unpad = paddingInstance('random.js', 'RandomPaddingAlgorithm', true);
  unpad.blockSize = 16;
  unpad.Feed(new Array(16).fill(0));
  expectThrow(() => unpad.Result(), 'original data length');
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
