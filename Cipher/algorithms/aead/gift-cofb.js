/*
 * GIFT-COFB - NIST Lightweight Cryptography Finalist
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * GIFT-COFB combines the GIFT-128 block cipher with the COFB (COmbined FeedBack)
 * authenticated encryption mode. It provides authenticated encryption with associated
 * data (AEAD) optimized for lightweight applications.
 *
 * Features:
 * - 128-bit key, 128-bit nonce
 * - 128-bit authentication tag
 * - GIFT-128 block cipher (bit-sliced implementation)
 * - COFB mode with efficient processing
 * - NIST LWC finalist
 *
 * References:
 * - https://www.isical.ac.in/~lightweight/COFB/
 * - NIST Lightweight Cryptography Competition
 * - Reference implementation: rweather/lightweight-crypto
 *
 * This implementation is for educational purposes only.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== GIFT-128 BLOCK CIPHER =====

  // Round constants for GIFT-128 (bit-sliced representation)
  const GIFT128_RC = new Uint8Array([
    0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3E, 0x3D, 0x3B,
    0x37, 0x2F, 0x1E, 0x3C, 0x39, 0x33, 0x27, 0x0E,
    0x1D, 0x3A, 0x35, 0x2B, 0x16, 0x2C, 0x18, 0x30,
    0x21, 0x02, 0x05, 0x0B, 0x17, 0x2E, 0x1C, 0x38,
    0x31, 0x23, 0x06, 0x0D, 0x1B, 0x36, 0x2D, 0x1A
  ]);

  // GIFT-128 key schedule (matches C reference TINY variant)
  class GIFT128KeySchedule {
    constructor(key) {
      // Mirror the fixslicing word order of 3, 1, 2, 0
      // Load as big-endian 32-bit words
      this.k = new Uint32Array(4);
      this.k[0] = OpCodes.Pack32BE(key[12], key[13], key[14], key[15]);
      this.k[1] = OpCodes.Pack32BE(key[4], key[5], key[6], key[7]);
      this.k[2] = OpCodes.Pack32BE(key[8], key[9], key[10], key[11]);
      this.k[3] = OpCodes.Pack32BE(key[0], key[1], key[2], key[3]);
    }
  }

  // Bit permutation helper (from C reference)
  function bitPermuteStep(value, mask, shift) {
    const t = ((value >>> shift) ^ value) & mask;
    return ((value ^ t) ^ (t << shift)) >>> 0;
  }

  // PERM3_INNER - core permutation
  function perm3Inner(x) {
    x = bitPermuteStep(x, 0x0a0a0a0a, 3);
    x = bitPermuteStep(x, 0x00cc00cc, 6);
    x = bitPermuteStep(x, 0x0000f0f0, 12);
    x = bitPermuteStep(x, 0x000000ff, 24);
    return x >>> 0;
  }

  // Row permutations PERM0-PERM3
  function perm0(x) {
    return OpCodes.RotL32(perm3Inner(x), 8);
  }

  function perm1(x) {
    return OpCodes.RotL32(perm3Inner(x), 16);
  }

  function perm2(x) {
    return OpCodes.RotL32(perm3Inner(x), 24);
  }

  function perm3(x) {
    return perm3Inner(x);
  }

  // GIFT-128 encryption (TINY variant - matches C reference exactly)
  function gift128bEncryptPreloaded(ks, output, input) {
    let s0 = input[0];
    let s1 = input[1];
    let s2 = input[2];
    let s3 = input[3];

    // Initialize key schedule words in the order used by TINY variant
    let w0 = ks.k[3];
    let w1 = ks.k[1];
    let w2 = ks.k[2];
    let w3 = ks.k[0];

    // Perform all 40 rounds
    for (let round = 0; round < 40; ++round) {
      // SubCells - apply the S-box
      s1 ^= s0 & s2;
      s0 ^= s1 & s3;
      s2 ^= s0 | s1;
      s3 ^= s2;
      s1 ^= s3;
      s3 ^= 0xFFFFFFFF;
      s2 ^= s0 & s1;

      // Swap s0 and s3
      let temp = s0;
      s0 = s3;
      s3 = temp;

      // PermBits - apply the 128-bit permutation
      s0 = perm0(s0);
      s1 = perm1(s1);
      s2 = perm2(s2);
      s3 = perm3(s3);

      // AddRoundKey - XOR in the key schedule and the round constant
      s2 ^= w1;
      s1 ^= w3;
      s3 ^= (0x80000000 ^ GIFT128_RC[round]) >>> 0;

      // Rotate the key schedule
      temp = w3;
      w3 = w2;
      w2 = w1;
      w1 = w0;
      w0 = (((temp & 0xFFFC0000) >>> 2) | ((temp & 0x00030000) << 14) |
            ((temp & 0x00000FFF) << 4) | ((temp & 0x0000F000) >>> 12)) >>> 0;
    }

    output[0] = s0 >>> 0;
    output[1] = s1 >>> 0;
    output[2] = s2 >>> 0;
    output[3] = s3 >>> 0;
  }

  // ===== COFB MODE IMPLEMENTATION =====

  // Doubles an L value in F(2^64)
  function cofbDoubleL(L) {
    const mask = L.x >> 31;  // Arithmetic right shift: -1 if MSB set, 0 otherwise
    const newY = ((L.y << 1) ^ (mask & 0x1B)) >>> 0;
    const newX = ((L.x << 1) | (L.y >>> 31)) >>> 0;
    return { x: newX, y: newY };
  }

  // Triples an L value in F(2^64)
  function cofbTripleL(L) {
    const mask = L.x >> 31;  // Arithmetic right shift: -1 if MSB set, 0 otherwise
    const tx = (((L.x << 1) | (L.y >>> 31)) ^ L.x) >>> 0;
    const ty = (((L.y << 1) ^ (mask & 0x1B)) ^ L.y) >>> 0;
    return { x: tx, y: ty };
  }

  // Applies the COFB feedback function to Y
  function cofbFeedback(Y) {
    const lx = Y[0];
    const ly = Y[1];
    Y[0] = Y[2];
    Y[1] = Y[3];
    Y[2] = ((lx << 1) | (ly >>> 31)) >>> 0;
    Y[3] = ((ly << 1) | (lx >>> 31)) >>> 0;
  }

  // Process associated data
  function cofbProcessAD(ks, Y, L, ad, mlen) {
    let adlen = ad.length;
    let pos = 0;

    const DEBUG = false;  // Set to true to enable debug output
    if (DEBUG) console.log(`[cofbProcessAD] adlen=${adlen}, mlen=${mlen}`);

    // Process all complete AD blocks except the last
    while (adlen > 16) {
      L = cofbDoubleL(L);

      // Apply feedback
      cofbFeedback(Y);

      // XOR Y with L and AD
      Y[0] ^= L.x ^ OpCodes.Pack32BE(ad[pos], ad[pos+1], ad[pos+2], ad[pos+3]);
      Y[1] ^= L.y ^ OpCodes.Pack32BE(ad[pos+4], ad[pos+5], ad[pos+6], ad[pos+7]);
      Y[2] ^= OpCodes.Pack32BE(ad[pos+8], ad[pos+9], ad[pos+10], ad[pos+11]);
      Y[3] ^= OpCodes.Pack32BE(ad[pos+12], ad[pos+13], ad[pos+14], ad[pos+15]);

      // Encrypt Y in-place
      gift128bEncryptPreloaded(ks, Y, Y);

      pos += 16;
      adlen -= 16;
    }

    // Process last AD block (with padding if needed)
    // Apply feedback
    const lx = Y[0];
    const ly = Y[1];
    Y[0] = Y[2];
    Y[1] = Y[3];
    Y[2] = ((lx << 1) | (ly >>> 31)) >>> 0;
    Y[3] = ((ly << 1) | (lx >>> 31)) >>> 0;
    if (DEBUG) console.log(`[cofbProcessAD] Y after feedback: [${Y[0].toString(16)}, ${Y[1].toString(16)}, ${Y[2].toString(16)}, ${Y[3].toString(16)}]`);

    if (adlen === 16) {
      // Full last block - XOR Y with AD
      if (DEBUG) console.log(`[cofbProcessAD] Processing full 16-byte AD block at pos=${pos}`);
      Y[0] ^= OpCodes.Pack32BE(ad[pos], ad[pos+1], ad[pos+2], ad[pos+3]);
      Y[1] ^= OpCodes.Pack32BE(ad[pos+4], ad[pos+5], ad[pos+6], ad[pos+7]);
      Y[2] ^= OpCodes.Pack32BE(ad[pos+8], ad[pos+9], ad[pos+10], ad[pos+11]);
      Y[3] ^= OpCodes.Pack32BE(ad[pos+12], ad[pos+13], ad[pos+14], ad[pos+15]);
      if (DEBUG) console.log(`[cofbProcessAD] Y after XOR with AD: [${Y[0].toString(16)}, ${Y[1].toString(16)}, ${Y[2].toString(16)}, ${Y[3].toString(16)}]`);
      if (DEBUG) console.log(`[cofbProcessAD] Before triple: L={x:${L.x.toString(16)}, y:${L.y.toString(16)}}`);
      L = cofbTripleL(L);
      if (DEBUG) console.log(`[cofbProcessAD] After triple: L={x:${L.x.toString(16)}, y:${L.y.toString(16)}}`);
    } else {
      // Partial last block - pad with 0x80
      if (DEBUG) console.log(`[cofbProcessAD] Processing partial/empty AD block, adlen=${adlen}`);
      const padded = new Uint8Array(16);
      padded.set(ad.subarray(pos, pos + adlen));
      padded[adlen] = 0x80;
      if (DEBUG) console.log(`[cofbProcessAD] Padded AD: ${Array.from(padded).map(b => b.toString(16).padStart(2, '0')).join('')}`);

      Y[0] ^= OpCodes.Pack32BE(padded[0], padded[1], padded[2], padded[3]);
      Y[1] ^= OpCodes.Pack32BE(padded[4], padded[5], padded[6], padded[7]);
      Y[2] ^= OpCodes.Pack32BE(padded[8], padded[9], padded[10], padded[11]);
      Y[3] ^= OpCodes.Pack32BE(padded[12], padded[13], padded[14], padded[15]);
      if (DEBUG) console.log(`[cofbProcessAD] Y after XOR with padded AD: [${Y[0].toString(16)}, ${Y[1].toString(16)}, ${Y[2].toString(16)}, ${Y[3].toString(16)}]`);
      if (DEBUG) console.log(`[cofbProcessAD] Before double-triple: L={x:${L.x.toString(16)}, y:${L.y.toString(16)}}`);
      L = cofbTripleL(cofbTripleL(L));
      if (DEBUG) console.log(`[cofbProcessAD] After double-triple: L={x:${L.x.toString(16)}, y:${L.y.toString(16)}}`);
    }

    // If message is empty, triple L two more times
    if (mlen === 0) {
      if (DEBUG) console.log(`[cofbProcessAD] Message empty, tripling L twice more`);
      if (DEBUG) console.log(`[cofbProcessAD] Before: L={x:${L.x.toString(16)}, y:${L.y.toString(16)}}`);
      L = cofbTripleL(L);
      L = cofbTripleL(L);
      if (DEBUG) console.log(`[cofbProcessAD] After: L={x:${L.x.toString(16)}, y:${L.y.toString(16)}}`);
    }

    // XOR with L and encrypt in-place
    if (DEBUG) console.log(`[cofbProcessAD] Final XOR with L and encrypt`);
    if (DEBUG) console.log(`[cofbProcessAD] Y before final XOR: [${Y[0].toString(16)}, ${Y[1].toString(16)}, ${Y[2].toString(16)}, ${Y[3].toString(16)}]`);
    if (DEBUG) console.log(`[cofbProcessAD] L for final XOR: {x:${L.x.toString(16)}, y:${L.y.toString(16)}}`);
    Y[0] ^= L.x;
    Y[1] ^= L.y;
    if (DEBUG) console.log(`[cofbProcessAD] Y after final XOR: [${Y[0].toString(16)}, ${Y[1].toString(16)}, ${Y[2].toString(16)}, ${Y[3].toString(16)}]`);
    gift128bEncryptPreloaded(ks, Y, Y);
    if (DEBUG) console.log(`[cofbProcessAD] Final Y after encrypt: [${Y[0].toString(16)}, ${Y[1].toString(16)}, ${Y[2].toString(16)}, ${Y[3].toString(16)}]`);

    return L;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class GiftCofbAlgorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "GIFT-COFB";
      this.description = "NIST Lightweight Cryptography finalist combining GIFT-128 block cipher with COFB authenticated encryption mode. Provides efficient authenticated encryption for resource-constrained devices.";
      this.inventor = "Subhadeep Banik, Avik Chakraborti, Tetsu Iwata, Kazuhiko Minematsu, Mridul Nandi, Thomas Peyrin, Yu Sasaki, Siang Meng Sim, Yosuke Todo";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0)  // 128-bit key only
      ];
      this.SupportedTagSizes = [
        new KeySize(16, 16, 0)  // 128-bit tag only
      ];
      this.SupportsDetached = false;

      // Documentation and references
      this.documentation = [
        new LinkItem("GIFT-COFB Official Site", "https://www.isical.ac.in/~lightweight/COFB/"),
        new LinkItem("NIST LWC Finalist", "https://csrc.nist.gov/Projects/lightweight-cryptography"),
        new LinkItem("GIFT-COFB Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/gift-cofb-spec-final.pdf"),
        new LinkItem("Reference Implementation", "https://github.com/rweather/lightweight-crypto")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [];

      // Test vectors from NIST LWC KAT (GIFT-COFB.txt)
      // https://github.com/rweather/lightweight-crypto/blob/master/test/kat/GIFT-COFB.txt
      this.tests = [
        {
          text: "NIST LWC KAT Count 1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("368965836D36614DE2FC24D0F801B9AF")
        },
        {
          text: "NIST LWC KAT Count 2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("AE5DCDD1285D5177FE251DEB99D727DC")
        },
        {
          text: "NIST LWC KAT Count 17 (empty PT, 16-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: [],
          expected: OpCodes.Hex8ToBytes("709657D81DDC509AA20DC66F18FF9907")
        },
        {
          text: "NIST LWC KAT Count 34 (1-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("5DF96DB329E92688242EF4E06F94FE1BD9")
        },
        {
          text: "NIST LWC KAT Count 529 (16-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("5D595FC00A309301719B30AD9E6D720FEDE74D8C9D1332ADA0413FC514E14918")
        },
        {
          text: "NIST LWC KAT Count 545 (16-byte PT, 16-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("3BFF715A56CBA49D1F7AC0691A966FDCBF77814044BF3FC9A9DEBBD393F545D4")
        },
        {
          text: "NIST LWC KAT Count 1057 (32-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("5D595FC00A309301719B30AD9E6D720F6F6F4759A224A9688EB4C75686A1B801660053CFDC1CC57345FD8E411FEB6E52")
        }
      ];

      // Constants
      this.KEY_SIZE = 16;      // 128 bits
      this.NONCE_SIZE = 16;    // 128 bits
      this.TAG_SIZE = 16;      // 128 bits
    }

    CreateInstance(isInverse = false) {
      return new GiftCofbInstance(this, isInverse);
    }
  }

  // ===== INSTANCE IMPLEMENTATION =====

  class GiftCofbInstance extends IAeadInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._associatedData = null;
      this.inputBuffer = [];
    }

    // Property setters with validation
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error('Invalid key size: ' + keyBytes.length + ' bytes (must be 16)');
      }

      this._key = new Uint8Array(keyBytes);
    }

    get key() {
      return this._key ? new Uint8Array(this._key) : null;
    }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== 16) {
        throw new Error('Invalid nonce size: ' + nonceBytes.length + ' bytes (must be 16)');
      }

      this._nonce = new Uint8Array(nonceBytes);
    }

    get nonce() {
      return this._nonce ? new Uint8Array(this._nonce) : null;
    }

    set associatedData(adBytes) {
      this._associatedData = adBytes ? new Uint8Array(adBytes) : new Uint8Array(0);
    }

    get associatedData() {
      return this._associatedData ? new Uint8Array(this._associatedData) : new Uint8Array(0);
    }

    // Feed/Result pattern implementation
    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error('Key not set');
      if (!this._nonce) throw new Error('Nonce not set');

      const input = new Uint8Array(this.inputBuffer);
      this.inputBuffer = [];

      if (this.isInverse) {
        return this._decrypt(input);
      } else {
        return this._encrypt(input);
      }
    }

    _encrypt(plaintext) {
      const ks = new GIFT128KeySchedule(this._key);
      const ad = this._associatedData || new Uint8Array(0);
      const mlen = plaintext.length;

      const DEBUG = false;

      // Initialize Y with encrypted nonce
      const Y = new Uint32Array(4);
      Y[0] = OpCodes.Pack32BE(this._nonce[0], this._nonce[1], this._nonce[2], this._nonce[3]);
      Y[1] = OpCodes.Pack32BE(this._nonce[4], this._nonce[5], this._nonce[6], this._nonce[7]);
      Y[2] = OpCodes.Pack32BE(this._nonce[8], this._nonce[9], this._nonce[10], this._nonce[11]);
      Y[3] = OpCodes.Pack32BE(this._nonce[12], this._nonce[13], this._nonce[14], this._nonce[15]);
      if (DEBUG) console.log(`[_encrypt] Y before encrypt: [${Y[0].toString(16)}, ${Y[1].toString(16)}, ${Y[2].toString(16)}, ${Y[3].toString(16)}]`);
      gift128bEncryptPreloaded(ks, Y, Y);
      if (DEBUG) console.log(`[_encrypt] Y after encrypt: [${Y[0].toString(16)}, ${Y[1].toString(16)}, ${Y[2].toString(16)}, ${Y[3].toString(16)}]`);

      // Initialize L from first two words of Y
      let L = { x: Y[0], y: Y[1] };
      if (DEBUG) console.log(`[_encrypt] Initial L: {x:${L.x.toString(16)}, y:${L.y.toString(16)}}`);

      // Process associated data (always, even if empty - matches C reference)
      L = cofbProcessAD(ks, Y, L, ad, mlen);

      // Encrypt plaintext
      const ciphertext = new Uint8Array(mlen + 16);
      let pos = 0;
      let remaining = mlen;

      // Process complete blocks
      while (remaining > 16) {
        const P = new Uint32Array(4);
        P[0] = OpCodes.Pack32BE(plaintext[pos], plaintext[pos+1], plaintext[pos+2], plaintext[pos+3]);
        P[1] = OpCodes.Pack32BE(plaintext[pos+4], plaintext[pos+5], plaintext[pos+6], plaintext[pos+7]);
        P[2] = OpCodes.Pack32BE(plaintext[pos+8], plaintext[pos+9], plaintext[pos+10], plaintext[pos+11]);
        P[3] = OpCodes.Pack32BE(plaintext[pos+12], plaintext[pos+13], plaintext[pos+14], plaintext[pos+15]);

        // XOR Y with P to get ciphertext
        const c0 = Y[0] ^ P[0];
        const c1 = Y[1] ^ P[1];
        const c2 = Y[2] ^ P[2];
        const c3 = Y[3] ^ P[3];

        const bytes = OpCodes.Unpack32BE(c0);
        ciphertext[pos] = bytes[0]; ciphertext[pos+1] = bytes[1];
        ciphertext[pos+2] = bytes[2]; ciphertext[pos+3] = bytes[3];
        const bytes1 = OpCodes.Unpack32BE(c1);
        ciphertext[pos+4] = bytes1[0]; ciphertext[pos+5] = bytes1[1];
        ciphertext[pos+6] = bytes1[2]; ciphertext[pos+7] = bytes1[3];
        const bytes2 = OpCodes.Unpack32BE(c2);
        ciphertext[pos+8] = bytes2[0]; ciphertext[pos+9] = bytes2[1];
        ciphertext[pos+10] = bytes2[2]; ciphertext[pos+11] = bytes2[3];
        const bytes3 = OpCodes.Unpack32BE(c3);
        ciphertext[pos+12] = bytes3[0]; ciphertext[pos+13] = bytes3[1];
        ciphertext[pos+14] = bytes3[2]; ciphertext[pos+15] = bytes3[3];

        L = cofbDoubleL(L);
        cofbFeedback(Y);
        Y[0] ^= L.x ^ P[0];
        Y[1] ^= L.y ^ P[1];
        Y[2] ^= P[2];
        Y[3] ^= P[3];
        gift128bEncryptPreloaded(ks, Y, Y);

        pos += 16;
        remaining -= 16;
      }

      // Process last block
      if (remaining === 16) {
        const P = new Uint32Array(4);
        P[0] = OpCodes.Pack32BE(plaintext[pos], plaintext[pos+1], plaintext[pos+2], plaintext[pos+3]);
        P[1] = OpCodes.Pack32BE(plaintext[pos+4], plaintext[pos+5], plaintext[pos+6], plaintext[pos+7]);
        P[2] = OpCodes.Pack32BE(plaintext[pos+8], plaintext[pos+9], plaintext[pos+10], plaintext[pos+11]);
        P[3] = OpCodes.Pack32BE(plaintext[pos+12], plaintext[pos+13], plaintext[pos+14], plaintext[pos+15]);

        const c0 = Y[0] ^ P[0];
        const c1 = Y[1] ^ P[1];
        const c2 = Y[2] ^ P[2];
        const c3 = Y[3] ^ P[3];

        const bytes = OpCodes.Unpack32BE(c0);
        ciphertext[pos] = bytes[0]; ciphertext[pos+1] = bytes[1];
        ciphertext[pos+2] = bytes[2]; ciphertext[pos+3] = bytes[3];
        const bytes1 = OpCodes.Unpack32BE(c1);
        ciphertext[pos+4] = bytes1[0]; ciphertext[pos+5] = bytes1[1];
        ciphertext[pos+6] = bytes1[2]; ciphertext[pos+7] = bytes1[3];
        const bytes2 = OpCodes.Unpack32BE(c2);
        ciphertext[pos+8] = bytes2[0]; ciphertext[pos+9] = bytes2[1];
        ciphertext[pos+10] = bytes2[2]; ciphertext[pos+11] = bytes2[3];
        const bytes3 = OpCodes.Unpack32BE(c3);
        ciphertext[pos+12] = bytes3[0]; ciphertext[pos+13] = bytes3[1];
        ciphertext[pos+14] = bytes3[2]; ciphertext[pos+15] = bytes3[3];

        cofbFeedback(Y);
        Y[0] ^= P[0];
        Y[1] ^= P[1];
        Y[2] ^= P[2];
        Y[3] ^= P[3];
        L = cofbTripleL(L);
        pos += 16;
      } else if (remaining > 0) {
        // Partial last block
        const padded = new Uint8Array(16);
        padded.set(plaintext.subarray(pos, pos + remaining));
        padded[remaining] = 0x80;

        const P = new Uint32Array(4);
        P[0] = OpCodes.Pack32BE(padded[0], padded[1], padded[2], padded[3]);
        P[1] = OpCodes.Pack32BE(padded[4], padded[5], padded[6], padded[7]);
        P[2] = OpCodes.Pack32BE(padded[8], padded[9], padded[10], padded[11]);
        P[3] = OpCodes.Pack32BE(padded[12], padded[13], padded[14], padded[15]);

        // Convert Y to bytes, XOR with padded plaintext bytes, extract only needed bytes
        const yBytes = new Uint8Array(16);
        const yb0 = OpCodes.Unpack32BE(Y[0]);
        const yb1 = OpCodes.Unpack32BE(Y[1]);
        const yb2 = OpCodes.Unpack32BE(Y[2]);
        const yb3 = OpCodes.Unpack32BE(Y[3]);
        yBytes.set(yb0, 0);
        yBytes.set(yb1, 4);
        yBytes.set(yb2, 8);
        yBytes.set(yb3, 12);

        // XOR plaintext bytes with Y bytes and copy only needed bytes to ciphertext
        for (let i = 0; i < remaining; ++i) {
          ciphertext[pos + i] = plaintext[pos + i] ^ yBytes[i];
        }

        cofbFeedback(Y);
        Y[0] ^= P[0];
        Y[1] ^= P[1];
        Y[2] ^= P[2];
        Y[3] ^= P[3];
        L = cofbTripleL(cofbTripleL(L));
        pos += remaining;
      }

      // Generate authentication tag
      if (mlen > 0) {
        Y[0] ^= L.x;
        Y[1] ^= L.y;
        gift128bEncryptPreloaded(ks, Y, Y);
      }

      // Append tag
      const tag = OpCodes.Unpack32BE(Y[0]);
      ciphertext[pos] = tag[0]; ciphertext[pos+1] = tag[1];
      ciphertext[pos+2] = tag[2]; ciphertext[pos+3] = tag[3];
      const tag1 = OpCodes.Unpack32BE(Y[1]);
      ciphertext[pos+4] = tag1[0]; ciphertext[pos+5] = tag1[1];
      ciphertext[pos+6] = tag1[2]; ciphertext[pos+7] = tag1[3];
      const tag2 = OpCodes.Unpack32BE(Y[2]);
      ciphertext[pos+8] = tag2[0]; ciphertext[pos+9] = tag2[1];
      ciphertext[pos+10] = tag2[2]; ciphertext[pos+11] = tag2[3];
      const tag3 = OpCodes.Unpack32BE(Y[3]);
      ciphertext[pos+12] = tag3[0]; ciphertext[pos+13] = tag3[1];
      ciphertext[pos+14] = tag3[2]; ciphertext[pos+15] = tag3[3];

      return Array.from(ciphertext);
    }

    _decrypt(ciphertext) {
      if (ciphertext.length < 16) {
        throw new Error('Ciphertext too short (minimum 16 bytes for tag)');
      }

      const ks = new GIFT128KeySchedule(this._key);
      const ad = this._associatedData || new Uint8Array(0);
      const mlen = ciphertext.length - 16;

      // Initialize Y with encrypted nonce
      const Y = new Uint32Array(4);
      Y[0] = OpCodes.Pack32BE(this._nonce[0], this._nonce[1], this._nonce[2], this._nonce[3]);
      Y[1] = OpCodes.Pack32BE(this._nonce[4], this._nonce[5], this._nonce[6], this._nonce[7]);
      Y[2] = OpCodes.Pack32BE(this._nonce[8], this._nonce[9], this._nonce[10], this._nonce[11]);
      Y[3] = OpCodes.Pack32BE(this._nonce[12], this._nonce[13], this._nonce[14], this._nonce[15]);
      gift128bEncryptPreloaded(ks, Y, Y);

      // Initialize L from first two words of Y
      let L = { x: Y[0], y: Y[1] };

      // Process associated data (always, even if empty - matches C reference)
      L = cofbProcessAD(ks, Y, L, ad, mlen);

      // Decrypt ciphertext
      const plaintext = new Uint8Array(mlen);
      let pos = 0;
      let remaining = mlen;

      // Process complete blocks
      while (remaining > 16) {
        const C = new Uint32Array(4);
        C[0] = OpCodes.Pack32BE(ciphertext[pos], ciphertext[pos+1], ciphertext[pos+2], ciphertext[pos+3]);
        C[1] = OpCodes.Pack32BE(ciphertext[pos+4], ciphertext[pos+5], ciphertext[pos+6], ciphertext[pos+7]);
        C[2] = OpCodes.Pack32BE(ciphertext[pos+8], ciphertext[pos+9], ciphertext[pos+10], ciphertext[pos+11]);
        C[3] = OpCodes.Pack32BE(ciphertext[pos+12], ciphertext[pos+13], ciphertext[pos+14], ciphertext[pos+15]);

        const P = new Uint32Array(4);
        P[0] = Y[0] ^ C[0];
        P[1] = Y[1] ^ C[1];
        P[2] = Y[2] ^ C[2];
        P[3] = Y[3] ^ C[3];

        const bytes = OpCodes.Unpack32BE(P[0]);
        plaintext[pos] = bytes[0]; plaintext[pos+1] = bytes[1];
        plaintext[pos+2] = bytes[2]; plaintext[pos+3] = bytes[3];
        const bytes1 = OpCodes.Unpack32BE(P[1]);
        plaintext[pos+4] = bytes1[0]; plaintext[pos+5] = bytes1[1];
        plaintext[pos+6] = bytes1[2]; plaintext[pos+7] = bytes1[3];
        const bytes2 = OpCodes.Unpack32BE(P[2]);
        plaintext[pos+8] = bytes2[0]; plaintext[pos+9] = bytes2[1];
        plaintext[pos+10] = bytes2[2]; plaintext[pos+11] = bytes2[3];
        const bytes3 = OpCodes.Unpack32BE(P[3]);
        plaintext[pos+12] = bytes3[0]; plaintext[pos+13] = bytes3[1];
        plaintext[pos+14] = bytes3[2]; plaintext[pos+15] = bytes3[3];

        L = cofbDoubleL(L);
        cofbFeedback(Y);
        Y[0] ^= L.x ^ P[0];
        Y[1] ^= L.y ^ P[1];
        Y[2] ^= P[2];
        Y[3] ^= P[3];
        gift128bEncryptPreloaded(ks, Y, Y);

        pos += 16;
        remaining -= 16;
      }

      // Process last block
      if (remaining === 16) {
        const C = new Uint32Array(4);
        C[0] = OpCodes.Pack32BE(ciphertext[pos], ciphertext[pos+1], ciphertext[pos+2], ciphertext[pos+3]);
        C[1] = OpCodes.Pack32BE(ciphertext[pos+4], ciphertext[pos+5], ciphertext[pos+6], ciphertext[pos+7]);
        C[2] = OpCodes.Pack32BE(ciphertext[pos+8], ciphertext[pos+9], ciphertext[pos+10], ciphertext[pos+11]);
        C[3] = OpCodes.Pack32BE(ciphertext[pos+12], ciphertext[pos+13], ciphertext[pos+14], ciphertext[pos+15]);

        const P = new Uint32Array(4);
        P[0] = Y[0] ^ C[0];
        P[1] = Y[1] ^ C[1];
        P[2] = Y[2] ^ C[2];
        P[3] = Y[3] ^ C[3];

        const bytes = OpCodes.Unpack32BE(P[0]);
        plaintext[pos] = bytes[0]; plaintext[pos+1] = bytes[1];
        plaintext[pos+2] = bytes[2]; plaintext[pos+3] = bytes[3];
        const bytes1 = OpCodes.Unpack32BE(P[1]);
        plaintext[pos+4] = bytes1[0]; plaintext[pos+5] = bytes1[1];
        plaintext[pos+6] = bytes1[2]; plaintext[pos+7] = bytes1[3];
        const bytes2 = OpCodes.Unpack32BE(P[2]);
        plaintext[pos+8] = bytes2[0]; plaintext[pos+9] = bytes2[1];
        plaintext[pos+10] = bytes2[2]; plaintext[pos+11] = bytes2[3];
        const bytes3 = OpCodes.Unpack32BE(P[3]);
        plaintext[pos+12] = bytes3[0]; plaintext[pos+13] = bytes3[1];
        plaintext[pos+14] = bytes3[2]; plaintext[pos+15] = bytes3[3];

        cofbFeedback(Y);
        Y[0] ^= P[0];
        Y[1] ^= P[1];
        Y[2] ^= P[2];
        Y[3] ^= P[3];
        L = cofbTripleL(L);
        pos += 16;
      } else if (remaining > 0) {
        // Partial last block
        const tempBytes = new Uint8Array(16);
        const b0 = OpCodes.Unpack32BE(Y[0]);
        const b1 = OpCodes.Unpack32BE(Y[1]);
        const b2 = OpCodes.Unpack32BE(Y[2]);
        const b3 = OpCodes.Unpack32BE(Y[3]);
        tempBytes.set(b0, 0);
        tempBytes.set(b1, 4);
        tempBytes.set(b2, 8);
        tempBytes.set(b3, 12);

        // XOR to get plaintext
        for (let i = 0; i < remaining; ++i) {
          plaintext[pos + i] = tempBytes[i] ^ ciphertext[pos + i];
        }

        // Reconstruct padded plaintext block
        const padded = new Uint8Array(16);
        padded.set(plaintext.subarray(pos, pos + remaining));
        padded[remaining] = 0x80;

        const P = new Uint32Array(4);
        P[0] = OpCodes.Pack32BE(padded[0], padded[1], padded[2], padded[3]);
        P[1] = OpCodes.Pack32BE(padded[4], padded[5], padded[6], padded[7]);
        P[2] = OpCodes.Pack32BE(padded[8], padded[9], padded[10], padded[11]);
        P[3] = OpCodes.Pack32BE(padded[12], padded[13], padded[14], padded[15]);

        cofbFeedback(Y);
        Y[0] ^= P[0];
        Y[1] ^= P[1];
        Y[2] ^= P[2];
        Y[3] ^= P[3];
        L = cofbTripleL(cofbTripleL(L));
        pos += remaining;
      }

      // Verify authentication tag
      if (mlen > 0) {
        Y[0] ^= L.x;
        Y[1] ^= L.y;
        gift128bEncryptPreloaded(ks, Y, Y);
      }

      // Check tag
      const computedTag = new Uint8Array(16);
      const tag0 = OpCodes.Unpack32BE(Y[0]);
      const tag1 = OpCodes.Unpack32BE(Y[1]);
      const tag2 = OpCodes.Unpack32BE(Y[2]);
      const tag3 = OpCodes.Unpack32BE(Y[3]);
      computedTag.set(tag0, 0);
      computedTag.set(tag1, 4);
      computedTag.set(tag2, 8);
      computedTag.set(tag3, 12);

      const receivedTag = ciphertext.subarray(mlen, mlen + 16);

      // Constant-time comparison
      let diff = 0;
      for (let i = 0; i < 16; ++i) {
        diff |= computedTag[i] ^ receivedTag[i];
      }

      if (diff !== 0) {
        throw new Error('Authentication tag verification failed');
      }

      return Array.from(plaintext);
    }
  }

  // Register algorithm
  RegisterAlgorithm(new GiftCofbAlgorithm());

  return GiftCofbAlgorithm;
}));
