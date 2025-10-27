/*
 * TTMAC (Two-Track MAC)
 * Professional implementation matching Crypto++ reference
 * (c)2006-2025 Hawkynt
 *
 * Two parallel tracks based on RIPEMD-160 compression function
 * 160-bit MAC with 160-bit key
 * Reference: http://www.weidai.com/scan-mirror/mac.html#TTMAC
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, ComplexityType, CountryCode,
          MacAlgorithm, IMacInstance, LinkItem, KeySize } = AlgorithmFramework;

  // TTMAC parameters
  const BLOCK_SIZE = 64;  // bytes
  const DIGEST_SIZE = 20; // bytes (160 bits)
  const KEY_SIZE = 20;    // bytes (160 bits)

  // RIPEMD-160 round constants
  const K = [
    0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e,
    0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000
  ];

  // RIPEMD-160 boolean functions
  function F(x, y, z) { return x ^ y ^ z; }
  function G(x, y, z) { return z ^ (x & (y ^ z)); }
  function H(x, y, z) { return z ^ (x | ~y); }
  function I(x, y, z) { return y ^ (z & (x ^ y)); }
  function J(x, y, z) { return x ^ (y | ~z); }

  class TTMACAlgorithm extends MacAlgorithm {
    constructor() {
      super();
      this.name = "TTMAC";
      this.description = "Two-Track MAC using dual RIPEMD-160 compression functions. Provides 160-bit authentication tags with 160-bit keys. Based on NESSIE submission.";
      this.inventor = "Kevin Springle";
      this.year = 2000;
      this.category = CategoryType.MAC;
      this.subCategory = "Iterated MAC";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.SupportedKeySizes = [new KeySize(20, 20, 1)];
      this.SupportedMacSizes = [new KeySize(20, 20, 1)];
      this.BlockSize = 64;

      this.documentation = [
        new LinkItem("TTMAC Specification", "http://www.weidai.com/scan-mirror/mac.html#TTMAC"),
        new LinkItem("NESSIE", "https://www.cosic.esat.kuleuven.be/nessie/")
      ];

      this.references = [
        new LinkItem("Crypto++ TTMAC", "https://github.com/weidai11/cryptopp/blob/master/ttmac.cpp")
      ];

      this.tests = [
        {
          text: "TTMAC: Empty message (NESSIE)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt",
          key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff01234567"),
          input: [],
          expected: OpCodes.Hex8ToBytes("2dec8ed4a0fd712ed9fbf2ab466ec2df21215e4a")
        },
        {
          text: "TTMAC: 'a' (NESSIE)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt",
          key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff01234567"),
          input: OpCodes.AnsiToBytes("a"),
          expected: OpCodes.Hex8ToBytes("5893e3e6e306704dd77ad6e6ed432cde321a7756")
        },
        {
          text: "TTMAC: 'abc' (NESSIE)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt",
          key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff01234567"),
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("70bfd1029797a5c16da5b557a1f0b2779b78497e")
        },
        {
          text: "TTMAC: 'message digest' (NESSIE)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt",
          key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff01234567"),
          input: OpCodes.AnsiToBytes("message digest"),
          expected: OpCodes.Hex8ToBytes("8289f4f19ffe4f2af737de4bd71c829d93a972fa")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new TTMACInstance(this);
    }
  }

  class TTMACInstance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this.reset();
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== KEY_SIZE) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${KEY_SIZE})`);
      }

      // Convert key to little-endian words
      this._key = new Uint32Array(5);
      for (let i = 0; i < 5; ++i) {
        this._key[i] = OpCodes.Pack32LE(
          keyBytes[i * 4],
          keyBytes[i * 4 + 1],
          keyBytes[i * 4 + 2],
          keyBytes[i * 4 + 3]
        );
      }

      this.reset();
    }

    get key() {
      if (!this._key) return null;
      const keyBytes = new Uint8Array(KEY_SIZE);
      for (let i = 0; i < 5; ++i) {
        const bytes = OpCodes.Unpack32LE(this._key[i]);
        keyBytes[i * 4] = bytes[0];
        keyBytes[i * 4 + 1] = bytes[1];
        keyBytes[i * 4 + 2] = bytes[2];
        keyBytes[i * 4 + 3] = bytes[3];
      }
      return Array.from(keyBytes);
    }

    reset() {
      if (this._key) {
        // Initialize digest with key (two tracks)
        this.digest = new Uint32Array(10);
        for (let i = 0; i < 5; ++i) {
          this.digest[i] = this._key[i];      // Track A
          this.digest[i + 5] = this._key[i];  // Track B
        }
      } else {
        this.digest = new Uint32Array(10);
      }
      this.buffer = [];
      this.bitCount = 0;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");

      this.buffer.push(...data);
      this.bitCount += data.length * 8;

      // Process complete blocks
      while (this.buffer.length >= BLOCK_SIZE) {
        const block = this.buffer.splice(0, BLOCK_SIZE);
        this._transform(block, false);
      }
    }

    _transform(blockBytes, isLast) {
      // Convert block to little-endian words
      const X = new Uint32Array(16);
      for (let i = 0; i < 16; ++i) {
        X[i] = OpCodes.Pack32LE(
          blockBytes[i * 4] || 0,
          blockBytes[i * 4 + 1] || 0,
          blockBytes[i * 4 + 2] || 0,
          blockBytes[i * 4 + 3] || 0
        );
      }

      // Determine which track is A and which is B
      let trackA, trackB;
      if (!isLast) {
        trackA = 0;  // digest[0..4]
        trackB = 5;  // digest[5..9]
      } else {
        trackB = 0;  // swap for final block
        trackA = 5;
      }

      // Initialize working variables
      let a1 = this.digest[trackA];
      let b1 = this.digest[trackA + 1];
      let c1 = this.digest[trackA + 2];
      let d1 = this.digest[trackA + 3];
      let e1 = this.digest[trackA + 4];
      let a2 = this.digest[trackB];
      let b2 = this.digest[trackB + 1];
      let c2 = this.digest[trackB + 2];
      let d2 = this.digest[trackB + 3];
      let e2 = this.digest[trackB + 4];

      // Helper for subround
      const subround = (fn, s, a, b, c, d, e, x, k) => {
        const temp = (a + fn(b, c, d) + x + k) >>> 0;
        a = (OpCodes.RotL32(temp, s) + e) >>> 0;
        c = OpCodes.RotL32(c, 10);
        return [a, c];
      };

      // Track 1: 80 rounds (5 groups of 16)
      // Round 1: F function
      [a1, c1] = subround(F, 11, a1, b1, c1, d1, e1, X[ 0], K[0]); [e1, b1] = subround(F, 14, e1, a1, b1, c1, d1, X[ 1], K[0]);
      [d1, a1] = subround(F, 15, d1, e1, a1, b1, c1, X[ 2], K[0]); [c1, e1] = subround(F, 12, c1, d1, e1, a1, b1, X[ 3], K[0]);
      [b1, d1] = subround(F,  5, b1, c1, d1, e1, a1, X[ 4], K[0]); [a1, c1] = subround(F,  8, a1, b1, c1, d1, e1, X[ 5], K[0]);
      [e1, b1] = subround(F,  7, e1, a1, b1, c1, d1, X[ 6], K[0]); [d1, a1] = subround(F,  9, d1, e1, a1, b1, c1, X[ 7], K[0]);
      [c1, e1] = subround(F, 11, c1, d1, e1, a1, b1, X[ 8], K[0]); [b1, d1] = subround(F, 13, b1, c1, d1, e1, a1, X[ 9], K[0]);
      [a1, c1] = subround(F, 14, a1, b1, c1, d1, e1, X[10], K[0]); [e1, b1] = subround(F, 15, e1, a1, b1, c1, d1, X[11], K[0]);
      [d1, a1] = subround(F,  6, d1, e1, a1, b1, c1, X[12], K[0]); [c1, e1] = subround(F,  7, c1, d1, e1, a1, b1, X[13], K[0]);
      [b1, d1] = subround(F,  9, b1, c1, d1, e1, a1, X[14], K[0]); [a1, c1] = subround(F,  8, a1, b1, c1, d1, e1, X[15], K[0]);

      // Round 2: G function
      [e1, b1] = subround(G,  7, e1, a1, b1, c1, d1, X[ 7], K[1]); [d1, a1] = subround(G,  6, d1, e1, a1, b1, c1, X[ 4], K[1]);
      [c1, e1] = subround(G,  8, c1, d1, e1, a1, b1, X[13], K[1]); [b1, d1] = subround(G, 13, b1, c1, d1, e1, a1, X[ 1], K[1]);
      [a1, c1] = subround(G, 11, a1, b1, c1, d1, e1, X[10], K[1]); [e1, b1] = subround(G,  9, e1, a1, b1, c1, d1, X[ 6], K[1]);
      [d1, a1] = subround(G,  7, d1, e1, a1, b1, c1, X[15], K[1]); [c1, e1] = subround(G, 15, c1, d1, e1, a1, b1, X[ 3], K[1]);
      [b1, d1] = subround(G,  7, b1, c1, d1, e1, a1, X[12], K[1]); [a1, c1] = subround(G, 12, a1, b1, c1, d1, e1, X[ 0], K[1]);
      [e1, b1] = subround(G, 15, e1, a1, b1, c1, d1, X[ 9], K[1]); [d1, a1] = subround(G,  9, d1, e1, a1, b1, c1, X[ 5], K[1]);
      [c1, e1] = subround(G, 11, c1, d1, e1, a1, b1, X[ 2], K[1]); [b1, d1] = subround(G,  7, b1, c1, d1, e1, a1, X[14], K[1]);
      [a1, c1] = subround(G, 13, a1, b1, c1, d1, e1, X[11], K[1]); [e1, b1] = subround(G, 12, e1, a1, b1, c1, d1, X[ 8], K[1]);

      // Round 3: H function
      [d1, a1] = subround(H, 11, d1, e1, a1, b1, c1, X[ 3], K[2]); [c1, e1] = subround(H, 13, c1, d1, e1, a1, b1, X[10], K[2]);
      [b1, d1] = subround(H,  6, b1, c1, d1, e1, a1, X[14], K[2]); [a1, c1] = subround(H,  7, a1, b1, c1, d1, e1, X[ 4], K[2]);
      [e1, b1] = subround(H, 14, e1, a1, b1, c1, d1, X[ 9], K[2]); [d1, a1] = subround(H,  9, d1, e1, a1, b1, c1, X[15], K[2]);
      [c1, e1] = subround(H, 13, c1, d1, e1, a1, b1, X[ 8], K[2]); [b1, d1] = subround(H, 15, b1, c1, d1, e1, a1, X[ 1], K[2]);
      [a1, c1] = subround(H, 14, a1, b1, c1, d1, e1, X[ 2], K[2]); [e1, b1] = subround(H,  8, e1, a1, b1, c1, d1, X[ 7], K[2]);
      [d1, a1] = subround(H, 13, d1, e1, a1, b1, c1, X[ 0], K[2]); [c1, e1] = subround(H,  6, c1, d1, e1, a1, b1, X[ 6], K[2]);
      [b1, d1] = subround(H,  5, b1, c1, d1, e1, a1, X[13], K[2]); [a1, c1] = subround(H, 12, a1, b1, c1, d1, e1, X[11], K[2]);
      [e1, b1] = subround(H,  7, e1, a1, b1, c1, d1, X[ 5], K[2]); [d1, a1] = subround(H,  5, d1, e1, a1, b1, c1, X[12], K[2]);

      // Round 4: I function
      [c1, e1] = subround(I, 11, c1, d1, e1, a1, b1, X[ 1], K[3]); [b1, d1] = subround(I, 12, b1, c1, d1, e1, a1, X[ 9], K[3]);
      [a1, c1] = subround(I, 14, a1, b1, c1, d1, e1, X[11], K[3]); [e1, b1] = subround(I, 15, e1, a1, b1, c1, d1, X[10], K[3]);
      [d1, a1] = subround(I, 14, d1, e1, a1, b1, c1, X[ 0], K[3]); [c1, e1] = subround(I, 15, c1, d1, e1, a1, b1, X[ 8], K[3]);
      [b1, d1] = subround(I,  9, b1, c1, d1, e1, a1, X[12], K[3]); [a1, c1] = subround(I,  8, a1, b1, c1, d1, e1, X[ 4], K[3]);
      [e1, b1] = subround(I,  9, e1, a1, b1, c1, d1, X[13], K[3]); [d1, a1] = subround(I, 14, d1, e1, a1, b1, c1, X[ 3], K[3]);
      [c1, e1] = subround(I,  5, c1, d1, e1, a1, b1, X[ 7], K[3]); [b1, d1] = subround(I,  6, b1, c1, d1, e1, a1, X[15], K[3]);
      [a1, c1] = subround(I,  8, a1, b1, c1, d1, e1, X[14], K[3]); [e1, b1] = subround(I,  6, e1, a1, b1, c1, d1, X[ 5], K[3]);
      [d1, a1] = subround(I,  5, d1, e1, a1, b1, c1, X[ 6], K[3]); [c1, e1] = subround(I, 12, c1, d1, e1, a1, b1, X[ 2], K[3]);

      // Round 5: J function
      [b1, d1] = subround(J,  9, b1, c1, d1, e1, a1, X[ 4], K[4]); [a1, c1] = subround(J, 15, a1, b1, c1, d1, e1, X[ 0], K[4]);
      [e1, b1] = subround(J,  5, e1, a1, b1, c1, d1, X[ 5], K[4]); [d1, a1] = subround(J, 11, d1, e1, a1, b1, c1, X[ 9], K[4]);
      [c1, e1] = subround(J,  6, c1, d1, e1, a1, b1, X[ 7], K[4]); [b1, d1] = subround(J,  8, b1, c1, d1, e1, a1, X[12], K[4]);
      [a1, c1] = subround(J, 13, a1, b1, c1, d1, e1, X[ 2], K[4]); [e1, b1] = subround(J, 12, e1, a1, b1, c1, d1, X[10], K[4]);
      [d1, a1] = subround(J,  5, d1, e1, a1, b1, c1, X[14], K[4]); [c1, e1] = subround(J, 12, c1, d1, e1, a1, b1, X[ 1], K[4]);
      [b1, d1] = subround(J, 13, b1, c1, d1, e1, a1, X[ 3], K[4]); [a1, c1] = subround(J, 14, a1, b1, c1, d1, e1, X[ 8], K[4]);
      [e1, b1] = subround(J, 11, e1, a1, b1, c1, d1, X[11], K[4]); [d1, a1] = subround(J,  8, d1, e1, a1, b1, c1, X[ 6], K[4]);
      [c1, e1] = subround(J,  5, c1, d1, e1, a1, b1, X[15], K[4]); [b1, d1] = subround(J,  6, b1, c1, d1, e1, a1, X[13], K[4]);

      // Track 2: 80 rounds (5 groups of 16) - reverse order
      [a2, c2] = subround(J,  8, a2, b2, c2, d2, e2, X[ 5], K[5]); [e2, b2] = subround(J,  9, e2, a2, b2, c2, d2, X[14], K[5]);
      [d2, a2] = subround(J,  9, d2, e2, a2, b2, c2, X[ 7], K[5]); [c2, e2] = subround(J, 11, c2, d2, e2, a2, b2, X[ 0], K[5]);
      [b2, d2] = subround(J, 13, b2, c2, d2, e2, a2, X[ 9], K[5]); [a2, c2] = subround(J, 15, a2, b2, c2, d2, e2, X[ 2], K[5]);
      [e2, b2] = subround(J, 15, e2, a2, b2, c2, d2, X[11], K[5]); [d2, a2] = subround(J,  5, d2, e2, a2, b2, c2, X[ 4], K[5]);
      [c2, e2] = subround(J,  7, c2, d2, e2, a2, b2, X[13], K[5]); [b2, d2] = subround(J,  7, b2, c2, d2, e2, a2, X[ 6], K[5]);
      [a2, c2] = subround(J,  8, a2, b2, c2, d2, e2, X[15], K[5]); [e2, b2] = subround(J, 11, e2, a2, b2, c2, d2, X[ 8], K[5]);
      [d2, a2] = subround(J, 14, d2, e2, a2, b2, c2, X[ 1], K[5]); [c2, e2] = subround(J, 14, c2, d2, e2, a2, b2, X[10], K[5]);
      [b2, d2] = subround(J, 12, b2, c2, d2, e2, a2, X[ 3], K[5]); [a2, c2] = subround(J,  6, a2, b2, c2, d2, e2, X[12], K[5]);

      [e2, b2] = subround(I,  9, e2, a2, b2, c2, d2, X[ 6], K[6]); [d2, a2] = subround(I, 13, d2, e2, a2, b2, c2, X[11], K[6]);
      [c2, e2] = subround(I, 15, c2, d2, e2, a2, b2, X[ 3], K[6]); [b2, d2] = subround(I,  7, b2, c2, d2, e2, a2, X[ 7], K[6]);
      [a2, c2] = subround(I, 12, a2, b2, c2, d2, e2, X[ 0], K[6]); [e2, b2] = subround(I,  8, e2, a2, b2, c2, d2, X[13], K[6]);
      [d2, a2] = subround(I,  9, d2, e2, a2, b2, c2, X[ 5], K[6]); [c2, e2] = subround(I, 11, c2, d2, e2, a2, b2, X[10], K[6]);
      [b2, d2] = subround(I,  7, b2, c2, d2, e2, a2, X[14], K[6]); [a2, c2] = subround(I,  7, a2, b2, c2, d2, e2, X[15], K[6]);
      [e2, b2] = subround(I, 12, e2, a2, b2, c2, d2, X[ 8], K[6]); [d2, a2] = subround(I,  7, d2, e2, a2, b2, c2, X[12], K[6]);
      [c2, e2] = subround(I,  6, c2, d2, e2, a2, b2, X[ 4], K[6]); [b2, d2] = subround(I, 15, b2, c2, d2, e2, a2, X[ 9], K[6]);
      [a2, c2] = subround(I, 13, a2, b2, c2, d2, e2, X[ 1], K[6]); [e2, b2] = subround(I, 11, e2, a2, b2, c2, d2, X[ 2], K[6]);

      [d2, a2] = subround(H,  9, d2, e2, a2, b2, c2, X[15], K[7]); [c2, e2] = subround(H,  7, c2, d2, e2, a2, b2, X[ 5], K[7]);
      [b2, d2] = subround(H, 15, b2, c2, d2, e2, a2, X[ 1], K[7]); [a2, c2] = subround(H, 11, a2, b2, c2, d2, e2, X[ 3], K[7]);
      [e2, b2] = subround(H,  8, e2, a2, b2, c2, d2, X[ 7], K[7]); [d2, a2] = subround(H,  6, d2, e2, a2, b2, c2, X[14], K[7]);
      [c2, e2] = subround(H,  6, c2, d2, e2, a2, b2, X[ 6], K[7]); [b2, d2] = subround(H, 14, b2, c2, d2, e2, a2, X[ 9], K[7]);
      [a2, c2] = subround(H, 12, a2, b2, c2, d2, e2, X[11], K[7]); [e2, b2] = subround(H, 13, e2, a2, b2, c2, d2, X[ 8], K[7]);
      [d2, a2] = subround(H,  5, d2, e2, a2, b2, c2, X[12], K[7]); [c2, e2] = subround(H, 14, c2, d2, e2, a2, b2, X[ 2], K[7]);
      [b2, d2] = subround(H, 13, b2, c2, d2, e2, a2, X[10], K[7]); [a2, c2] = subround(H, 13, a2, b2, c2, d2, e2, X[ 0], K[7]);
      [e2, b2] = subround(H,  7, e2, a2, b2, c2, d2, X[ 4], K[7]); [d2, a2] = subround(H,  5, d2, e2, a2, b2, c2, X[13], K[7]);

      [c2, e2] = subround(G, 15, c2, d2, e2, a2, b2, X[ 8], K[8]); [b2, d2] = subround(G,  5, b2, c2, d2, e2, a2, X[ 6], K[8]);
      [a2, c2] = subround(G,  8, a2, b2, c2, d2, e2, X[ 4], K[8]); [e2, b2] = subround(G, 11, e2, a2, b2, c2, d2, X[ 1], K[8]);
      [d2, a2] = subround(G, 14, d2, e2, a2, b2, c2, X[ 3], K[8]); [c2, e2] = subround(G, 14, c2, d2, e2, a2, b2, X[11], K[8]);
      [b2, d2] = subround(G,  6, b2, c2, d2, e2, a2, X[15], K[8]); [a2, c2] = subround(G, 14, a2, b2, c2, d2, e2, X[ 0], K[8]);
      [e2, b2] = subround(G,  6, e2, a2, b2, c2, d2, X[ 5], K[8]); [d2, a2] = subround(G,  9, d2, e2, a2, b2, c2, X[12], K[8]);
      [c2, e2] = subround(G, 12, c2, d2, e2, a2, b2, X[ 2], K[8]); [b2, d2] = subround(G,  9, b2, c2, d2, e2, a2, X[13], K[8]);
      [a2, c2] = subround(G, 12, a2, b2, c2, d2, e2, X[ 9], K[8]); [e2, b2] = subround(G,  5, e2, a2, b2, c2, d2, X[ 7], K[8]);
      [d2, a2] = subround(G, 15, d2, e2, a2, b2, c2, X[10], K[8]); [c2, e2] = subround(G,  8, c2, d2, e2, a2, b2, X[14], K[8]);

      [b2, d2] = subround(F,  8, b2, c2, d2, e2, a2, X[12], K[9]); [a2, c2] = subround(F,  5, a2, b2, c2, d2, e2, X[15], K[9]);
      [e2, b2] = subround(F, 12, e2, a2, b2, c2, d2, X[10], K[9]); [d2, a2] = subround(F,  9, d2, e2, a2, b2, c2, X[ 4], K[9]);
      [c2, e2] = subround(F, 12, c2, d2, e2, a2, b2, X[ 1], K[9]); [b2, d2] = subround(F,  5, b2, c2, d2, e2, a2, X[ 5], K[9]);
      [a2, c2] = subround(F, 14, a2, b2, c2, d2, e2, X[ 8], K[9]); [e2, b2] = subround(F,  6, e2, a2, b2, c2, d2, X[ 7], K[9]);
      [d2, a2] = subround(F,  8, d2, e2, a2, b2, c2, X[ 6], K[9]); [c2, e2] = subround(F, 13, c2, d2, e2, a2, b2, X[ 2], K[9]);
      [b2, d2] = subround(F,  6, b2, c2, d2, e2, a2, X[13], K[9]); [a2, c2] = subround(F,  5, a2, b2, c2, d2, e2, X[14], K[9]);
      [e2, b2] = subround(F, 15, e2, a2, b2, c2, d2, X[ 0], K[9]); [d2, a2] = subround(F, 13, d2, e2, a2, b2, c2, X[ 3], K[9]);
      [c2, e2] = subround(F, 11, c2, d2, e2, a2, b2, X[ 9], K[9]); [b2, d2] = subround(F, 11, b2, c2, d2, e2, a2, X[11], K[9]);

      // Update state
      a1 = (a1 - this.digest[trackA]) >>> 0;
      b1 = (b1 - this.digest[trackA + 1]) >>> 0;
      c1 = (c1 - this.digest[trackA + 2]) >>> 0;
      d1 = (d1 - this.digest[trackA + 3]) >>> 0;
      e1 = (e1 - this.digest[trackA + 4]) >>> 0;
      a2 = (a2 - this.digest[trackB]) >>> 0;
      b2 = (b2 - this.digest[trackB + 1]) >>> 0;
      c2 = (c2 - this.digest[trackB + 2]) >>> 0;
      d2 = (d2 - this.digest[trackB + 3]) >>> 0;
      e2 = (e2 - this.digest[trackB + 4]) >>> 0;

      if (!isLast) {
        this.digest[trackA] = ((b1 + e1) - d2) >>> 0;
        this.digest[trackA + 1] = (c1 - e2) >>> 0;
        this.digest[trackA + 2] = (d1 - a2) >>> 0;
        this.digest[trackA + 3] = (e1 - b2) >>> 0;
        this.digest[trackA + 4] = (a1 - c2) >>> 0;
        this.digest[trackB] = (d1 - e2) >>> 0;
        this.digest[trackB + 1] = ((e1 + c1) - a2) >>> 0;
        this.digest[trackB + 2] = (a1 - b2) >>> 0;
        this.digest[trackB + 3] = (b1 - c2) >>> 0;
        this.digest[trackB + 4] = (c1 - d2) >>> 0;
      } else {
        this.digest[trackB] = (a2 - a1) >>> 0;
        this.digest[trackB + 1] = (b2 - b1) >>> 0;
        this.digest[trackB + 2] = (c2 - c1) >>> 0;
        this.digest[trackB + 3] = (d2 - d1) >>> 0;
        this.digest[trackB + 4] = (e2 - e1) >>> 0;
        this.digest[trackA] = 0;
        this.digest[trackA + 1] = 0;
        this.digest[trackA + 2] = 0;
        this.digest[trackA + 3] = 0;
        this.digest[trackA + 4] = 0;
      }
    }

    Result() {
      if (!this._key) throw new Error("Key not set");

      // Pad message
      const paddingLength = BLOCK_SIZE - ((this.buffer.length + 8) % BLOCK_SIZE);
      this.buffer.push(0x80);
      for (let i = 1; i < paddingLength; ++i) {
        this.buffer.push(0x00);
      }

      // Append bit count (little-endian 64-bit)
      const bitCountLo = this.bitCount >>> 0;
      const bitCountHi = Math.floor(this.bitCount / 0x100000000) >>> 0;
      this.buffer.push(bitCountLo & 0xff, (bitCountLo >>> 8) & 0xff, (bitCountLo >>> 16) & 0xff, (bitCountLo >>> 24) & 0xff);
      this.buffer.push(bitCountHi & 0xff, (bitCountHi >>> 8) & 0xff, (bitCountHi >>> 16) & 0xff, (bitCountHi >>> 24) & 0xff);

      // Process final block
      this._transform(this.buffer, true);

      // Extract MAC (from digest[0..4] after final transform)
      const mac = new Uint8Array(DIGEST_SIZE);
      for (let i = 0; i < 5; ++i) {
        const bytes = OpCodes.Unpack32LE(this.digest[i]);
        mac[i * 4] = bytes[0];
        mac[i * 4 + 1] = bytes[1];
        mac[i * 4 + 2] = bytes[2];
        mac[i * 4 + 3] = bytes[3];
      }

      this.reset();
      return Array.from(mac);
    }
  }

  const algorithmInstance = new TTMACAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { TTMACAlgorithm, TTMACInstance };
}));
