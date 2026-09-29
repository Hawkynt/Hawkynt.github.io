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
  /** @type {int32} */
  const BLOCK_SIZE = 64;  // bytes
  /** @type {int32} */
  const DIGEST_SIZE = 20; // bytes (160 bits)
  /** @type {int32} */
  const KEY_SIZE = 20;    // bytes (160 bits)

  // RIPEMD-160 round constants (left line K[0..4], right line K[5..9])
  /** @type {uint32[]} */
  const K = [
    0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e,
    0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000
  ];

  // RIPEMD-160 message word selection, left and right lines
  /** @type {int32[]} */
  const R_LEFT = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
    3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
    1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
    4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
  ];
  /** @type {int32[]} */
  const R_RIGHT = [
    5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
    6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
    15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
    8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
    12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
  ];

  // RIPEMD-160 rotation amounts, left and right lines
  /** @type {int32[]} */
  const S_LEFT = [
    11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
    7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
    11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
    11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
    9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
  ];
  /** @type {int32[]} */
  const S_RIGHT = [
    8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
    9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
    9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
    15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
    8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
  ];

  /**
   * RIPEMD-160 boolean function of one round group
   * @param {int32} round - 0..4 selects F, G, H, I, J
   * @param {uint32} x - First word
   * @param {uint32} y - Second word
   * @param {uint32} z - Third word
   * @returns {uint32} f(x, y, z)
   */
  function boolFn(round, x, y, z) {
    switch (round) {
      case 0: return OpCodes.Xor32(OpCodes.Xor32(x, y), z);                  // F
      case 1: return OpCodes.Xor32(z, OpCodes.And32(x, OpCodes.Xor32(y, z))); // G
      case 2: return OpCodes.Xor32(z, OpCodes.Or32(x, OpCodes.Not32(y)));     // H
      case 3: return OpCodes.Xor32(y, OpCodes.And32(z, OpCodes.Xor32(x, y))); // I
      default: return OpCodes.Xor32(x, OpCodes.Or32(y, OpCodes.Not32(z)));    // J
    }
  }

  /**
   * One RIPEMD-160 line (80 steps) over the five words in v
   * @param {uint32[]} v - Working words a, b, c, d, e (updated in place)
   * @param {uint32[]} X - 16 message words
   * @param {boolean} right - true for the right line (J..F, K[5..9])
   * @returns {void}
   */
  function ripemdLine(v, X, right) {
    let a = v[0];
    let b = v[1];
    let c = v[2];
    let d = v[3];
    let e = v[4];
    for (let j = 0; j < 80; ++j) {
      const group = Math.floor(j / 16);
      /** @type {uint32} */
      let f = 0;
      /** @type {uint32} */
      let k = 0;
      /** @type {int32} */
      let r = 0;
      /** @type {int32} */
      let s = 0;
      if (right) {
        f = boolFn(4 - group, b, c, d);
        k = K[5 + group];
        r = R_RIGHT[j];
        s = S_RIGHT[j];
      } else {
        f = boolFn(group, b, c, d);
        k = K[group];
        r = R_LEFT[j];
        s = S_LEFT[j];
      }
      const t = OpCodes.Add32(OpCodes.RotL32(OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(a, f), X[r]), k), s), e);
      a = e;
      e = d;
      d = OpCodes.RotL32(c, 10);
      c = b;
      b = t;
    }
    v[0] = a;
    v[1] = b;
    v[2] = c;
    v[3] = d;
    v[4] = e;
  }

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
        },
        {
          text: "TTMAC: alphabet, 26 bytes (NESSIE)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt",
          key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff01234567"),
          input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
          expected: OpCodes.Hex8ToBytes("2186ca09c5533198b7371f245273504ca92bae60")
        },
        // 56 and 62 bytes leave fewer than eight free bytes in the 64 byte block,
        // so the padding and the length field spill into a second block.
        {
          text: "TTMAC: 56 bytes, padding spills into a second block (NESSIE)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt",
          key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff01234567"),
          input: OpCodes.AnsiToBytes("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
          expected: OpCodes.Hex8ToBytes("8a7bf77aef62a2578497a27c0d6518a429e7c14d")
        },
        {
          text: "TTMAC: 62 bytes, padding spills into a second block (NESSIE)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt",
          key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff01234567"),
          input: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"),
          expected: OpCodes.Hex8ToBytes("54bac392a886806d169556fcbb6789b54fb364fb")
        },
        {
          text: "TTMAC: 8 x '1234567890', 80 bytes over two blocks (NESSIE)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt",
          key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff01234567"),
          input: OpCodes.AnsiToBytes("1234567890".repeat(8)),
          expected: OpCodes.Hex8ToBytes("0ced2c9f8f0d9d03981ab5c8184bac43dd54c484")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for the inverse, which a MAC does not have
   * @returns {TTMACInstance} New MAC instance (null for the inverse)
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new TTMACInstance(this);
    }
  }

  /**
 * TTMAC instance implementing the Feed/Result pattern
 * @class
 * @extends {IMacInstance}
 */

  class TTMACInstance extends IMacInstance {
    /**
     * @param {TTMACAlgorithm} algorithm - Parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint32[]} */
      this._key = null;
      /** @type {uint32[]} */
      this.digest = null;
      /** @type {uint8[]} */
      this.buffer = [];
      /** @type {uint64} */
      this.bitCount = 0;
      this.reset();
    }

    /**
   * Set the key
   * @param {uint8[]} keyBytes - 20-byte key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== KEY_SIZE) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (expected " + KEY_SIZE + ")");
      }

      // Convert key to little-endian words
      /** @type {uint32[]} */
      const keyWords = new Array(5);
      for (let i = 0; i < 5; ++i) {
        keyWords[i] = OpCodes.Pack32LE(
          keyBytes[i * 4],
          keyBytes[i * 4 + 1],
          keyBytes[i * 4 + 2],
          keyBytes[i * 4 + 3]
        );
      }
      this._key = keyWords;

      this.reset();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]} Copy of key bytes or null
   */

    get key() {
      if (!this._key) {
        return null;
      }
      /** @type {uint8[]} */
      const keyBytes = [];
      for (let i = 0; i < 5; ++i) {
        const bytes = OpCodes.Unpack32LE(this._key[i]);
        for (let j = 0; j < 4; ++j) keyBytes.push(bytes[j]);
      }
      return keyBytes;
    }

    /**
     * Restart the MAC: both tracks start from the key (zero without a key)
     * @returns {void}
     */
    reset() {
      /** @type {uint32[]} */
      const d = new Array(10);
      for (let i = 0; i < 10; ++i) d[i] = 0;
      if (this._key) {
        // Initialize digest with key (two tracks)
        for (let i = 0; i < 5; ++i) {
          d[i] = this._key[i];      // Track A
          d[i + 5] = this._key[i];  // Track B
        }
      }
      this.digest = d;
      this.buffer = [];
      this.bitCount = 0;
    }

    /**
   * Feed message bytes
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");

      for (let _i = 0; _i < data.length; _i++) this.buffer.push(data[_i]);
      this.bitCount += data.length * 8;

      // Process complete blocks
      while (this.buffer.length >= BLOCK_SIZE) {
        const block = this.buffer.splice(0, BLOCK_SIZE);
        this._transform(block, false);
      }
    }

    /**
     * Two-track RIPEMD-160 style compression of one 64-byte block
     * @param {uint8[]} blockBytes - 64-byte block
     * @param {boolean} isLast - true for the block carrying the length
     * @returns {void}
     */
    _transform(blockBytes, isLast) {
      // Convert block to little-endian words
      /** @type {uint32[]} */
      const X = new Array(16);
      for (let i = 0; i < 16; ++i) {
        X[i] = OpCodes.Pack32LE(blockBytes[i * 4], blockBytes[i * 4 + 1], blockBytes[i * 4 + 2], blockBytes[i * 4 + 3]);
      }

      // Determine which track is A and which is B
      /** @type {int32} */
      let trackA = 0;  // digest[0..4]
      /** @type {int32} */
      let trackB = 5;  // digest[5..9]
      if (isLast) {
        trackB = 0;  // swap for final block
        trackA = 5;
      }

      // Working variables of both lines
      const v1 = this.digest.slice(trackA, trackA + 5);
      const v2 = this.digest.slice(trackB, trackB + 5);

      ripemdLine(v1, X, false);  // Track 1: F, G, H, I, J
      ripemdLine(v2, X, true);   // Track 2: J, I, H, G, F

      // Update state
      const a1 = OpCodes.Sub32(v1[0], this.digest[trackA]);
      const b1 = OpCodes.Sub32(v1[1], this.digest[trackA + 1]);
      const c1 = OpCodes.Sub32(v1[2], this.digest[trackA + 2]);
      const d1 = OpCodes.Sub32(v1[3], this.digest[trackA + 3]);
      const e1 = OpCodes.Sub32(v1[4], this.digest[trackA + 4]);
      const a2 = OpCodes.Sub32(v2[0], this.digest[trackB]);
      const b2 = OpCodes.Sub32(v2[1], this.digest[trackB + 1]);
      const c2 = OpCodes.Sub32(v2[2], this.digest[trackB + 2]);
      const d2 = OpCodes.Sub32(v2[3], this.digest[trackB + 3]);
      const e2 = OpCodes.Sub32(v2[4], this.digest[trackB + 4]);

      if (!isLast) {
        this.digest[trackA] = OpCodes.Sub32(OpCodes.Add32(b1, e1), d2);
        this.digest[trackA + 1] = OpCodes.Sub32(c1, e2);
        this.digest[trackA + 2] = OpCodes.Sub32(d1, a2);
        this.digest[trackA + 3] = OpCodes.Sub32(e1, b2);
        this.digest[trackA + 4] = OpCodes.Sub32(a1, c2);
        this.digest[trackB] = OpCodes.Sub32(d1, e2);
        this.digest[trackB + 1] = OpCodes.Sub32(OpCodes.Add32(e1, c1), a2);
        this.digest[trackB + 2] = OpCodes.Sub32(a1, b2);
        this.digest[trackB + 3] = OpCodes.Sub32(b1, c2);
        this.digest[trackB + 4] = OpCodes.Sub32(c1, d2);
      } else {
        this.digest[trackB] = OpCodes.Sub32(a2, a1);
        this.digest[trackB + 1] = OpCodes.Sub32(b2, b1);
        this.digest[trackB + 2] = OpCodes.Sub32(c2, c1);
        this.digest[trackB + 3] = OpCodes.Sub32(d2, d1);
        this.digest[trackB + 4] = OpCodes.Sub32(e2, e1);
        this.digest[trackA] = 0;
        this.digest[trackA + 1] = 0;
        this.digest[trackA + 2] = 0;
        this.digest[trackA + 3] = 0;
        this.digest[trackA + 4] = 0;
      }
    }

    /**
   * Get the MAC of everything fed so far
   * @returns {uint8[]} 20-byte MAC
   * @throws {Error} If key not set
   */

    Result() {
      if (!this._key) throw new Error("Key not set");

      // Pad message
      const paddingLength = BLOCK_SIZE - ((this.buffer.length + 8) % BLOCK_SIZE);
      this.buffer.push(0x80);
      for (let i = 1; i < paddingLength; ++i) {
        this.buffer.push(0x00);
      }

      // Append bit count (little-endian 64-bit)
      const bitCountLo = OpCodes.ToUint32(this.bitCount);
      /** @type {uint32} */
      const bitCountHi = OpCodes.ToUint32(Math.floor(this.bitCount / 0x100000000));
      const loBytes = OpCodes.Unpack32LE(bitCountLo);
      const hiBytes = OpCodes.Unpack32LE(bitCountHi);
      for (let i = 0; i < 4; ++i) this.buffer.push(loBytes[i]);
      for (let i = 0; i < 4; ++i) this.buffer.push(hiBytes[i]);

      // When the message tail leaves fewer than eight free bytes in its block the
      // padding spills into a second block. Only the block carrying the length is
      // the final one; the spill block is an ordinary block.
      while (this.buffer.length > BLOCK_SIZE) {
        const block = this.buffer.splice(0, BLOCK_SIZE);
        this._transform(block, false);
      }

      // Process final block
      this._transform(this.buffer, true);

      // Extract MAC (from digest[0..4] after final transform)
      /** @type {uint8[]} */
      const mac = [];
      for (let i = 0; i < 5; ++i) {
        const bytes = OpCodes.Unpack32LE(this.digest[i]);
        for (let j = 0; j < 4; ++j) mac.push(bytes[j]);
      }

      this.reset();
      return mac;
    }
  }

  const algorithmInstance = new TTMACAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { TTMACAlgorithm, TTMACInstance };
}));
