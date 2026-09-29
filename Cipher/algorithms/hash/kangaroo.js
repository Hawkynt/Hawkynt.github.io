/*
 * KangarooTwelve Hash Function - Universal AlgorithmFramework Implementation
 * Based on Keccak-p[1600, 12] permutation
 * NIST Lightweight Cryptography Submission
 * (c)2006-2025 Hawkynt
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    root.KangarooTwelve = factory(root.AlgorithmFramework, root.OpCodes);
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
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM CONSTANTS =====

  const BLKSIZE = 8192;                    // Block size (8KB)
  const DIGESTLEN = 32;                    // Default digest length (256 bits)
  const STRENGTH = 128;                    // Security strength (128 bits)
  const ROUNDS = 12;                       // Keccak-p rounds
  const RATE_BYTES = OpCodes.Shr32(1600 - OpCodes.Shl32(STRENGTH, 1), 3);  // Rate = 168 bytes

  // Keccak round constants (24 total, we use the last 12 for Kangaroo12)
  /** @type {BigInt[]} */
  const KECCAK_RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
    0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
  ];

  // Domain separation bytes and markers. The three domain separators are
  // applied by the padding, not absorbed as data, so that they merge with the
  // pad10*1 terminator when only one byte of the block is left.
  const SINGLE_DOMAIN = 0x07;              // Single node domain separator
  const LEAF_DOMAIN = 0x0B;                // Intermediate leaf domain separator
  const FINAL_DOMAIN = 0x06;               // Final node domain separator
  /** @type {uint8[]} Final node marker, ahead of its domain */
  const FINAL_MARKER = [0xFF, 0xFF];
  /** @type {uint8[]} First node marker */
  const FIRST = [3, 0, 0, 0, 0, 0, 0, 0];
  /** @type {BigInt} */
  const MASK64 = 0xFFFFFFFFFFFFFFFFn;

  // ===== HELPER FUNCTIONS =====

  /**
   * Right-encode a length value (variable-length encoding)
   * @param {uint32} strLen - Length to encode
   * @returns {uint8[]} Encoded length as byte array
   */
  function rightEncode(strLen) {
    /** @type {uint8[]} */
    const result = [];
    if (strLen === 0) {
      result.push(0);
      return result;
    }

    let n = 0;
    let v = strLen;
    while (v > 0) {
      n++;
      v = OpCodes.Shr32(v, 8);
    }

    for (let i = 0; i < n; i++) {
      result.push(OpCodes.GetByte(strLen, n - i - 1));
    }
    result.push(n);

    return result;
  }

  /**
   * Pack 8 bytes into a 64-bit BigInt (little-endian)
   * @param {uint8[]} bytes - Byte array
   * @param {int32} offset - Starting offset
   * @returns {BigInt} 64-bit value
   */
  function pack64LE(bytes, offset) {
    let value = BigInt(bytes[offset]);
    for (let k = 1; k < 8; k++) {
      value = OpCodes.OrN(value, OpCodes.ShiftLn(BigInt(bytes[offset + k]), 8 * k));
    }
    return value;
  }

  /**
   * Unpack 64-bit BigInt into 8 bytes (little-endian)
   * @param {BigInt} value - 64-bit value
   * @param {uint8[]} bytes - Output byte array
   * @param {int32} offset - Starting offset
   * @returns {void}
   */
  function unpack64LE(value, bytes, offset) {
    for (let k = 0; k < 8; k++) {
      /** @type {uint8} */
      const b = Number(OpCodes.AndN(OpCodes.ShiftRn(value, 8 * k), 0xFFn));
      bytes[offset + k] = b;
    }
  }

  /**
   * XOR five 64-bit BigInt lanes together (Keccak theta parity)
   * @param {BigInt} a - Lane 1
   * @param {BigInt} b - Lane 2
   * @param {BigInt} c - Lane 3
   * @param {BigInt} d - Lane 4
   * @param {BigInt} e - Lane 5
   * @returns {BigInt} Combined XOR of all five lanes
   */
  function xor5(a, b, c, d, e) {
    return OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(a, b), c), d), e);
  }

  /**
   * Keccak chi term (NOT a) AND b for 64-bit lanes
   * @param {BigInt} a - Lane to complement (0 .. 2^64-1)
   * @param {BigInt} b - Lane (0 .. 2^64-1)
   * @returns {BigInt} (~a) & b within 64 bits
   */
  function andNot64(a, b) {
    return OpCodes.AndN(OpCodes.XorN(a, MASK64), b);
  }

  // ===== KECCAK SPONGE IMPLEMENTATION =====

  /**
   * KangarooSponge - Keccak-p[1600, rounds] sponge construction
   * @class
   */
  class KangarooSponge {
    /**
     * Initialize an empty sponge
     * @param {int32} strength - Security strength in bits (capacity / 2)
     * @param {int32} rounds - Keccak-p rounds
     */
    constructor(strength, rounds) {
      /** @type {int32} Rate in bytes */
      this.rateBytes = OpCodes.Shr32(1600 - OpCodes.Shl32(strength, 1), 3);
      /** @type {int32} */
      this.rounds = rounds;
      /** @type {BigInt[]} */
      this.state = new Array(25);
      /** @type {uint8[]} */
      this.queue = new Array(this.rateBytes);
      /** @type {int32} */
      this.bytesInQueue = 0;
      /** @type {boolean} */
      this.squeezing = false;
      this.initSponge();
    }

    /**
     * Reset to the empty sponge
     * @returns {void}
     */
    initSponge() {
      this.state.fill(0n);
      this.queue.fill(0);
      this.bytesInQueue = 0;
      this.squeezing = false;
    }

    /**
     * Absorb bytes
     * @param {uint8[]} data - Source bytes
     * @param {int32} off - First byte
     * @param {int32} len - Number of bytes
     * @returns {void}
     */
    absorb(data, off, len) {
      if (this.squeezing) {
        throw new Error("Cannot absorb while squeezing");
      }

      let count = 0;
      while (count < len) {
        if (this.bytesInQueue === 0 && count <= (len - this.rateBytes)) {
          do {
            this.absorbBlock(data, off + count);
            count += this.rateBytes;
          } while (count <= (len - this.rateBytes));
        } else {
          const partialBlock = Math.min(this.rateBytes - this.bytesInQueue, len - count);
          for (let i = 0; i < partialBlock; i++) {
            this.queue[this.bytesInQueue + i] = data[off + count + i];
          }

          this.bytesInQueue += partialBlock;
          count += partialBlock;

          if (this.bytesInQueue === this.rateBytes) {
            this.absorbBlock(this.queue, 0);
            this.bytesInQueue = 0;
          }
        }
      }
    }

    /**
     * XOR one rate block into the state and permute
     * @param {uint8[]} data - Source bytes
     * @param {int32} off - First byte of the block
     * @returns {void}
     */
    absorbBlock(data, off) {
      const count = OpCodes.Shr32(this.rateBytes, 3);
      let offset = off;
      for (let i = 0; i < count; i++) {
        this.state[i] = OpCodes.XorN(this.state[i], pack64LE(data, offset));
        offset += 8;
      }
      this.keccakPermutation();
    }

    /**
     * Append the TurboSHAKE domain separator and the pad10*1 padding, then
     * permute. The separator must be applied here rather than absorbed as an
     * ordinary data byte: when exactly one byte of the block is still free the
     * separator and the terminating 0x80 land on the SAME byte and have to
     * merge into 0x87 (0x8B, 0x86). Absorbing the separator first flushes the
     * block and the padding then spills into a whole extra block, which is a
     * different - and wrong - message. This is the same collision that was
     * repaired in sha3.js and shake.js.
     * @param {uint8} domainByte - 0x07 single node, 0x0B leaf, 0x06 final node
     * @returns {void}
     */
    padAndSwitchToSqueezingPhase(domainByte) {
      if (typeof domainByte !== 'number') {
        throw new Error('padAndSwitchToSqueezingPhase requires a domain separator');
      }

      // absorb() flushes a full queue, so there is always at least one free byte
      for (let i = this.bytesInQueue; i < this.rateBytes; i++) {
        this.queue[i] = 0;
      }

      this.queue[this.bytesInQueue] = OpCodes.Xor8(this.queue[this.bytesInQueue], domainByte);
      this.queue[this.rateBytes - 1] = OpCodes.Xor8(this.queue[this.rateBytes - 1], 0x80);

      this.absorbBlock(this.queue, 0);

      this.extract();
      this.bytesInQueue = this.rateBytes;
      this.squeezing = true;
    }

    /**
     * Squeeze bytes
     * @param {uint8[]} output - Destination
     * @param {int32} offset - First destination index
     * @param {int32} outputLength - Number of bytes
     * @returns {void}
     */
    squeeze(output, offset, outputLength) {
      if (!this.squeezing) {
        // The domain separator is not known at this level, so squeezing an
        // unpadded sponge cannot be repaired here - it is a caller error.
        throw new Error('Cannot squeeze before padding: no domain separator');
      }

      let i = 0;
      while (i < outputLength) {
        if (this.bytesInQueue === 0) {
          this.keccakPermutation();
          this.extract();
          this.bytesInQueue = this.rateBytes;
        }

        const partialBlock = Math.min(this.bytesInQueue, outputLength - i);
        for (let j = 0; j < partialBlock; j++) {
          output[offset + i + j] = this.queue[this.rateBytes - this.bytesInQueue + j];
        }

        this.bytesInQueue -= partialBlock;
        i += partialBlock;
      }
    }

    /**
     * Copy the rate part of the state into the queue
     * @returns {void}
     */
    extract() {
      const count = OpCodes.Shr32(this.rateBytes, 3);
      for (let i = 0; i < count; i++) {
        unpack64LE(this.state[i], this.queue, i * 8);
      }
    }

    /**
     * Keccak-p[1600, rounds] on the state (the last rounds of Keccak-f)
     * @returns {void}
     */
    keccakPermutation() {
      const A = this.state;

      const myBase = KECCAK_RC.length - this.rounds;

      for (let round = 0; round < this.rounds; round++) {
        // Theta
        const c0 = xor5(A[0], A[5], A[10], A[15], A[20]);
        const c1 = xor5(A[1], A[6], A[11], A[16], A[21]);
        const c2 = xor5(A[2], A[7], A[12], A[17], A[22]);
        const c3 = xor5(A[3], A[8], A[13], A[18], A[23]);
        const c4 = xor5(A[4], A[9], A[14], A[19], A[24]);

        const d0 = OpCodes.XorN(OpCodes.RotL64n(c1, 1), c4);
        const d1 = OpCodes.XorN(OpCodes.RotL64n(c2, 1), c0);
        const d2 = OpCodes.XorN(OpCodes.RotL64n(c3, 1), c1);
        const d3 = OpCodes.XorN(OpCodes.RotL64n(c4, 1), c2);
        const d4 = OpCodes.XorN(OpCodes.RotL64n(c0, 1), c3);

        for (let y = 0; y < 25; y += 5) {
          A[y] = OpCodes.XorN(A[y], d0);
          A[y + 1] = OpCodes.XorN(A[y + 1], d1);
          A[y + 2] = OpCodes.XorN(A[y + 2], d2);
          A[y + 3] = OpCodes.XorN(A[y + 3], d3);
          A[y + 4] = OpCodes.XorN(A[y + 4], d4);
        }

        // Rho and Pi combined
        const c1_temp = OpCodes.RotL64n(A[1], 1);
        A[1] = OpCodes.RotL64n(A[6], 44);
        A[6] = OpCodes.RotL64n(A[9], 20);
        A[9] = OpCodes.RotL64n(A[22], 61);
        A[22] = OpCodes.RotL64n(A[14], 39);
        A[14] = OpCodes.RotL64n(A[20], 18);
        A[20] = OpCodes.RotL64n(A[2], 62);
        A[2] = OpCodes.RotL64n(A[12], 43);
        A[12] = OpCodes.RotL64n(A[13], 25);
        A[13] = OpCodes.RotL64n(A[19], 8);
        A[19] = OpCodes.RotL64n(A[23], 56);
        A[23] = OpCodes.RotL64n(A[15], 41);
        A[15] = OpCodes.RotL64n(A[4], 27);
        A[4] = OpCodes.RotL64n(A[24], 14);
        A[24] = OpCodes.RotL64n(A[21], 2);
        A[21] = OpCodes.RotL64n(A[8], 55);
        A[8] = OpCodes.RotL64n(A[16], 45);
        A[16] = OpCodes.RotL64n(A[5], 36);
        A[5] = OpCodes.RotL64n(A[3], 28);
        A[3] = OpCodes.RotL64n(A[18], 21);
        A[18] = OpCodes.RotL64n(A[17], 15);
        A[17] = OpCodes.RotL64n(A[11], 10);
        A[11] = OpCodes.RotL64n(A[7], 6);
        A[7] = OpCodes.RotL64n(A[10], 3);
        A[10] = c1_temp;

        // Chi
        for (let y = 0; y < 25; y += 5) {
          const a0 = A[y];
          const a1 = A[y + 1];
          const a2 = A[y + 2];
          const a3 = A[y + 3];
          const a4 = A[y + 4];

          A[y] = OpCodes.XorN(a0, andNot64(a1, a2));
          A[y + 1] = OpCodes.XorN(a1, andNot64(a2, a3));
          A[y + 2] = OpCodes.XorN(a2, andNot64(a3, a4));
          A[y + 3] = OpCodes.XorN(a3, andNot64(a4, a0));
          A[y + 4] = OpCodes.XorN(a4, andNot64(a0, a1));
        }

        // Iota
        A[0] = OpCodes.XorN(A[0], KECCAK_RC[myBase + round]);
      }
    }
  }

  // ===== HELPER FUNCTIONS FOR TEST VECTORS =====

  /**
   * Build standard test buffer (pattern of 00-FA repeating, i % 251)
   * @param {int32} length - Buffer length
   * @returns {uint8[]} Test buffer
   */
  function buildStandardBuffer(length) {
    /** @type {uint8[]} */
    const result = new Array(length);
    for (let i = 0; i < length; i++) {
      result[i] = i % 251;
    }
    return result;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * KangarooTwelve Algorithm Definition
   */
  class KangarooTwelveAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "KangarooTwelve";
      this.description = "Fast hashing based on Keccak-p[1600,12] with tree structure for parallel processing. NIST Lightweight Cryptography submission offering high performance and variable output length.";
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche, Ronny Van Keer";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "Extendable-Output Function (XOF)";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE; // Belgium (Keccak team)

      this.SupportedDigestSizes = [new KeySize(1, 8192, 1)];

      this.documentation = [
        new LinkItem(
          "RFC 9861: KangarooTwelve and TurboSHAKE",
          "https://www.rfc-editor.org/rfc/rfc9861"
        ),
        new LinkItem(
          "Official Website",
          "https://keccak.team/kangarootwelve.html"
        )
      ];

      this.references = [
        new LinkItem(
          "XKCP (eXtended Keccak Code Package) - Reference Implementation",
          "https://github.com/XKCP/XKCP"
        )
      ];

      // Test vectors from RFC 9861 (KangarooTwelve and TurboSHAKE), Section 5
      this.tests = [
        // Empty input
        {
          text: "KangarooTwelve Test Vector #1 - Empty input (32 bytes)",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: OpCodes.Hex8ToBytes(""),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("1AC2D450FC3B4205D19DA7BFCA1B37513C0803577AC7167F06FE2CE1F0EF39E5")
        },
        // Empty input (64 bytes)
        {
          text: "KangarooTwelve Test Vector #2 - Empty input (64 bytes)",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: OpCodes.Hex8ToBytes(""),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("1AC2D450FC3B4205D19DA7BFCA1B37513C0803577AC7167F06FE2CE1F0EF39E54269C056B8C82E48276038B6D292966CC07A3D4645272E31FF38508139EB0A71")
        },
        // 1 byte (pattern)
        {
          text: "KangarooTwelve Test Vector #4 - 1 byte pattern",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: buildStandardBuffer(1),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("2BDA92450E8B147F8A7CB629E784A058EFCA7CF7D8218E02D345DFAA65244A1F")
        },
        // 17 bytes (pattern)
        {
          text: "KangarooTwelve Test Vector #5 - 17 bytes pattern",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: buildStandardBuffer(17),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("6BF75FA2239198DB4772E36478F8E19B0F371205F6A9A93A273F51DF37122888")
        },
        // 17^2 = 289 bytes (pattern)
        {
          text: "KangarooTwelve Test Vector #6 - 289 bytes pattern",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: buildStandardBuffer(17 * 17),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("0C315EBCDEDBF61426DE7DCF8FB725D1E74675D7F5327A5067F367B108ECB67C")
        },
        // 17^3 = 4913 bytes (pattern)
        {
          text: "KangarooTwelve Test Vector #7 - 4913 bytes pattern",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: buildStandardBuffer(17 * 17 * 17),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("CB552E2EC77D9910701D578B457DDF772C12E322E4EE7FE417F92C758F0D59D0")
        },
        // 17^4 = 83521 bytes (pattern)
        {
          text: "KangarooTwelve Test Vector #8 - 83521 bytes pattern",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: buildStandardBuffer(17 * 17 * 17 * 17),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("8701045E22205345FF4DDA05555CBB5C3AF1A771C2B89BAEF37DB43D9998B9FE")
        },
        // 17^5 = 1419857 bytes (pattern)
        {
          text: "KangarooTwelve Test Vector #9 - 1419857 bytes pattern",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: buildStandardBuffer(17 * 17 * 17 * 17 * 17),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("844D610933B1B9963CBDEB5AE3B6B05CC7CBD67CEEDF883EB678A0A8E0371682")
        },
        // 17^6 = 24137569 bytes (pattern)
        {
          text: "KangarooTwelve Test Vector #10 - 24137569 bytes pattern",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: buildStandardBuffer(17 * 17 * 17 * 17 * 17 * 17),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("3C390782A8A4E89FA6367F72FEAAF13255C8D95878481D3CD8CE85F58E880AF8")
        },
        // Empty input with 1 byte personalization
        {
          text: "KangarooTwelve Test Vector #11 - Empty input, 1 byte personalization",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: OpCodes.Hex8ToBytes(""),
          personalization: buildStandardBuffer(1),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("FAB658DB63E94A246188BF7AF69A133045F46EE984C56E3C3328CAAF1AA1A583")
        },
        // 1 byte 0xFF with 41 byte personalization
        {
          text: "KangarooTwelve Test Vector #12 - 1 byte 0xFF, 41 bytes personalization",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: new Array(1).fill(0xFF),
          personalization: buildStandardBuffer(41),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("D848C5068CED736F4462159B9867FD4C20B808ACC3D5BC48E0B06BA0A3762EC4")
        },
        // 3 bytes 0xFF with 41^2 = 1681 bytes personalization
        {
          text: "KangarooTwelve Test Vector #13 - 3 bytes 0xFF, 1681 bytes personalization",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: new Array(3).fill(0xFF),
          personalization: buildStandardBuffer(41 * 41),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("C389E5009AE57120854C2E8C64670AC01358CF4C1BAF89447A724234DC7CED74")
        },
        // 7 bytes 0xFF with 41^3 = 68921 bytes personalization
        {
          text: "KangarooTwelve Test Vector #14 - 7 bytes 0xFF, 68921 bytes personalization",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: new Array(7).fill(0xFF),
          personalization: buildStandardBuffer(41 * 41 * 41),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("75D2F86A2E644566726B4FBCFC5657B9DBCF070C7B0DCA06450AB291D7443BCF")
        },
        // The RFC vectors step by powers of 17 and step straight over the two
        // lengths where this implementation was wrong: the 8192-byte chunking
        // boundary, and the message length at which the TurboSHAKE domain
        // separator has to merge with the pad10*1 terminator in one byte.
        {
          text: "KangarooTwelve: 8192-byte pattern (last single-node length)",
          uri: "https://github.com/cloudflare/circl/blob/main/xof/k12/k12_test.go",
          input: buildStandardBuffer(8192),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("48F256F6772F9EDFB6A8B661EC92DC93")
        },
        {
          text: "KangarooTwelve: 8193-byte pattern (first tree-hashed length)",
          uri: "https://github.com/cloudflare/circl/blob/main/xof/k12/k12_test.go",
          input: buildStandardBuffer(8193),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("BB66FE72EAEA5179418D5295EE134485")
        },
        {
          text: "KangarooTwelve: 16384-byte pattern (two full chunks)",
          uri: "https://github.com/cloudflare/circl/blob/main/xof/k12/k12_test.go",
          input: buildStandardBuffer(16384),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("82778F7F7234C83352E76837B721FBDB")
        },
        {
          text: "KangarooTwelve: 16385-byte pattern",
          uri: "https://github.com/cloudflare/circl/blob/main/xof/k12/k12_test.go",
          input: buildStandardBuffer(16385),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("5F8D2B943922B451842B4E82740D0236")
        },
        {
          text: "KangarooTwelve: 24576-byte pattern (three full chunks)",
          uri: "https://github.com/cloudflare/circl/blob/main/xof/k12/k12_test.go",
          input: buildStandardBuffer(24576),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("F4082A8FE7D1635AA042CD1DA63BF235")
        },
        {
          text: "KangarooTwelve: 24577-byte pattern",
          uri: "https://github.com/cloudflare/circl/blob/main/xof/k12/k12_test.go",
          input: buildStandardBuffer(24577),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("38CB940999ACA742D69DD79298C6051C")
        },
        {
          // S = M || length_encode(0) is 167 bytes, one short of the 168-byte
          // rate, so the `07` domain separator and the `80` pad terminator
          // occupy the same byte and must merge into `87`. Value follows from
          // RFC 9861 section 3.2; cross-checked against XKCP's published
          // self-test checksum, which covers 34 lengths of this shape.
          text: "KangarooTwelve: 166-byte pattern (domain separator meets pad10*1)",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: buildStandardBuffer(166),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("CBBE9DD1E423F20003FBA7BB219491C8D1F445FA5C4199D6C6C70C9FDC101964")
        },
        {
          text: "KangarooTwelve: 334-byte pattern (domain separator meets pad10*1, second block)",
          uri: "https://www.rfc-editor.org/rfc/rfc9861",
          input: buildStandardBuffer(334),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("FF92C42FDBDCB983D402FDC05F7D6EDD1AE0A24AADD145CF129C8E7E7C057B3B")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // Hash functions have no inverse
      }
      return new KangarooTwelveInstance(this);
    }
  }

  /**
   * KangarooTwelve Instance
   * @class
   * @extends {IHashFunctionInstance}
   */
  class KangarooTwelveInstance extends IHashFunctionInstance {
    /**
     * Initialize a KangarooTwelve instance
     * @param {KangarooTwelveAlgorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);

      /** @type {KangarooSponge} */
      this.treeSponge = new KangarooSponge(STRENGTH, ROUNDS);
      /** @type {KangarooSponge} */
      this.leafSponge = new KangarooSponge(STRENGTH, ROUNDS);
      /** @type {int32} 32 bytes for K12 */
      this.chainLen = OpCodes.Shr32(STRENGTH, 2);

      /** @type {int32} */
      this._outputSize = DIGESTLEN;
      /** @type {uint8[]} */
      this._personalization = null;
      /** @type {uint8[]} */
      this.personalBytes = [];

      /** @type {boolean} */
      this.squeezing = false;
      /** @type {uint32} */
      this.currNode = 0;
      /** @type {int32} */
      this.processed = 0;

      this.buildPersonal(null);
    }

    /**
     * Set the output length
     * @param {int32} size - Output length in bytes (at least 1)
     */
    set outputSize(size) {
      if (size < 1) {
        throw new Error("Output size must be at least 1 byte");
      }
      this._outputSize = size;
    }

    /**
     * The output length
     * @returns {int32} Output length in bytes
     */
    get outputSize() {
      return this._outputSize;
    }

    /**
     * Set the customization string (null clears it)
     * @param {uint8[]} pers - Customization bytes
     */
    set personalization(pers) {
      if (pers === null || pers === undefined) {
        this._personalization = null;
      } else {
        this._personalization = pers.slice();
      }
      this.buildPersonal(this._personalization);
    }

    /**
     * The customization string
     * @returns {uint8[]} Copy of it, or null when unset
     */
    get personalization() {
      if (this._personalization === null) return null;
      return this._personalization.slice();
    }

    /**
     * Precompute C || length_encode(|C|)
     * @param {uint8[]} personal - Customization bytes, or null
     * @returns {void}
     */
    buildPersonal(personal) {
      const myLen = personal !== null ? personal.length : 0;
      const myEnc = rightEncode(myLen);

      /** @type {uint8[]} */
      const bytes = [];
      for (let i = 0; i < myLen; i++) {
        bytes.push(personal[i]);
      }
      for (let i = 0; i < myEnc.length; i++) {
        bytes.push(myEnc[i]);
      }
      this.personalBytes = bytes;
    }

    /**
     * Feed message bytes
     * @param {uint8[]} data - Input data bytes
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      this.processData(data, 0, data.length);
    }

    /**
     * Finish the message and squeeze outputSize bytes; starts a new message
     * @returns {uint8[]} Output bytes
     */
    Result() {
      // Switch to squeezing if not already
      if (!this.squeezing) {
        this.switchToSqueezing();
      }

      // Squeeze output
      /** @type {uint8[]} */
      const output = new Array(this._outputSize);
      this.treeSponge.squeeze(output, 0, this._outputSize);

      // Reset for next operation
      this.reset();

      return output;
    }

    /**
     * Absorb bytes into the current node, opening leaves at chunk boundaries
     * @param {uint8[]} data - Source bytes
     * @param {int32} inOffset - First byte
     * @param {int32} len - Number of bytes
     * @returns {void}
     */
    processData(data, inOffset, len) {
      if (this.squeezing) {
        throw new Error("Cannot absorb while squeezing");
      }

      const mySponge = this.currNode === 0 ? this.treeSponge : this.leafSponge;
      const mySpace = BLKSIZE - this.processed;

      // If all data fits in current block
      if (mySpace >= len) {
        mySponge.absorb(data, inOffset, len);
        this.processed += len;
        return;
      }

      // Absorb as much as possible
      if (mySpace > 0) {
        mySponge.absorb(data, inOffset, mySpace);
        this.processed += mySpace;
      }

      // Process remaining blocks
      let myProcessed = mySpace;
      while (myProcessed < len) {
        if (this.processed === BLKSIZE) {
          this.switchLeaf(true);
        }

        const myDataLen = Math.min(len - myProcessed, BLKSIZE);
        this.leafSponge.absorb(data, inOffset + myProcessed, myDataLen);
        this.processed += myDataLen;
        myProcessed += myDataLen;
      }
    }

    /**
     * Close the current chunk: the first chunk gets the FIRST marker, a leaf is
     * finished and its chaining value absorbed into the tree
     * @param {boolean} moreToCome - Whether another chunk follows
     * @returns {void}
     */
    switchLeaf(moreToCome) {
      if (this.currNode === 0) {
        // First node - absorb FIRST marker
        this.treeSponge.absorb(FIRST, 0, FIRST.length);
      } else {
        // Intermediate node - pad with the leaf domain separator, then squeeze
        this.leafSponge.padAndSwitchToSqueezingPhase(LEAF_DOMAIN);
        /** @type {uint8[]} */
        const hash = new Array(this.chainLen);
        this.leafSponge.squeeze(hash, 0, this.chainLen);
        this.treeSponge.absorb(hash, 0, this.chainLen);
        this.leafSponge.initSponge();
      }

      if (moreToCome) {
        this.currNode++;
      }
      this.processed = 0;
    }

    /**
     * Absorb the customization, finish the tree and pad
     * @returns {void}
     */
    switchToSqueezing() {
      // Absorb personalization
      this.processData(this.personalBytes, 0, this.personalBytes.length);

      if (this.currNode === 0) {
        // Single node mode - pad with the single-node domain separator
        this.treeSponge.padAndSwitchToSqueezingPhase(SINGLE_DOMAIN);
      } else {
        // Multi-node mode - complete final leaf, then finalize tree
        this.switchLeaf(false);

        // Encode and absorb node count
        const lengthEnc = rightEncode(this.currNode);
        this.treeSponge.absorb(lengthEnc, 0, lengthEnc.length);

        // Absorb FINAL marker (0xFF 0xFF), then pad with the final domain byte
        this.treeSponge.absorb(FINAL_MARKER, 0, FINAL_MARKER.length);
        this.treeSponge.padAndSwitchToSqueezingPhase(FINAL_DOMAIN);
      }

      this.squeezing = true;
    }

    /**
     * Start a new message (the customization is kept)
     * @returns {void}
     */
    reset() {
      this.treeSponge.initSponge();
      this.leafSponge.initSponge();
      this.currNode = 0;
      this.processed = 0;
      this.squeezing = false;
    }
  }

  // ===== REGISTER ALGORITHM =====

  RegisterAlgorithm(new KangarooTwelveAlgorithm());

  return KangarooTwelveAlgorithm;
}));
