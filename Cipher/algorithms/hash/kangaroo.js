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
  const RATE_BYTES = (1600 - (STRENGTH << 1)) >> 3;  // Rate = 168 bytes

  // Keccak round constants (24 total, we use the last 12 for Kangaroo12)
  const KECCAK_RC = Object.freeze([
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
    0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
  ]);

  // Domain separation bytes and markers
  const SINGLE = [0x07];                   // Single node marker
  const INTERMEDIATE = [0x0B];             // Intermediate leaf marker
  const FINAL = [0xFF, 0xFF, 0x06];        // Final marker (includes domain)
  const FIRST = [3, 0, 0, 0, 0, 0, 0, 0];  // First node marker

  // ===== HELPER FUNCTIONS =====

  /**
   * Right-encode a length value (variable-length encoding)
   * @param {number} strLen - Length to encode
   * @returns {Array} Encoded length as byte array
   */
  function rightEncode(strLen) {
    if (strLen === 0) {
      return [0];
    }

    let n = 0;
    let v = strLen;
    while (v > 0) {
      n++;
      v = Math.floor(v / 256);
    }

    const result = new Array(n + 1);
    result[n] = n;

    for (let i = 0; i < n; i++) {
      result[i] = OpCodes.Shr32(strLen, 8 * (n - i - 1)) & 0xFF;
    }

    return result;
  }

  /**
   * Pack 8 bytes into a 64-bit BigInt (little-endian)
   * @param {Array} bytes - Byte array
   * @param {number} offset - Starting offset
   * @returns {BigInt} 64-bit value
   */
  function pack64LE(bytes, offset) {
    return (
      (BigInt(bytes[offset + 7]) << 56n) |
      (BigInt(bytes[offset + 6]) << 48n) |
      (BigInt(bytes[offset + 5]) << 40n) |
      (BigInt(bytes[offset + 4]) << 32n) |
      (BigInt(bytes[offset + 3]) << 24n) |
      (BigInt(bytes[offset + 2]) << 16n) |
      (BigInt(bytes[offset + 1]) << 8n) |
      BigInt(bytes[offset])
    );
  }

  /**
   * Unpack 64-bit BigInt into 8 bytes (little-endian)
   * @param {BigInt} value - 64-bit value
   * @param {Array} bytes - Output byte array
   * @param {number} offset - Starting offset
   */
  function unpack64LE(value, bytes, offset) {
    bytes[offset] = Number(value & 0xFFn);
    bytes[offset + 1] = Number((value >> 8n) & 0xFFn);
    bytes[offset + 2] = Number((value >> 16n) & 0xFFn);
    bytes[offset + 3] = Number((value >> 24n) & 0xFFn);
    bytes[offset + 4] = Number((value >> 32n) & 0xFFn);
    bytes[offset + 5] = Number((value >> 40n) & 0xFFn);
    bytes[offset + 6] = Number((value >> 48n) & 0xFFn);
    bytes[offset + 7] = Number((value >> 56n) & 0xFFn);
  }

  // ===== KECCAK SPONGE IMPLEMENTATION =====

  /**
   * KangarooSponge - Keccak-p[1600, rounds] sponge construction
   */
  class KangarooSponge {
    constructor(strength, rounds) {
      this.rateBytes = (1600 - (strength << 1)) >> 3;
      this.rounds = rounds;
      this.state = new Array(25).fill(0n);
      this.queue = new Array(this.rateBytes).fill(0);
      this.bytesInQueue = 0;
      this.squeezing = false;
    }

    initSponge() {
      this.state.fill(0n);
      this.queue.fill(0);
      this.bytesInQueue = 0;
      this.squeezing = false;
    }

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

    absorbBlock(data, off) {
      const count = this.rateBytes >> 3;
      let offset = off;
      for (let i = 0; i < count; i++) {
        this.state[i] ^= pack64LE(data, offset);
        offset += 8;
      }
      this.keccakPermutation();
    }

    padAndSwitchToSqueezingPhase() {
      // Keccak padding: 10*1
      // Fill any remaining space with zeros and XOR 0x80 at the last position

      // Fill remaining queue with zeros
      for (let i = this.bytesInQueue; i < this.rateBytes; i++) {
        this.queue[i] = 0;
      }

      // XOR 0x80 at the last position for padding
      this.queue[this.rateBytes - 1] ^= 0x80;

      this.absorbBlock(this.queue, 0);

      this.extract();
      this.bytesInQueue = this.rateBytes;
      this.squeezing = true;
    }

    squeeze(output, offset, outputLength) {
      if (!this.squeezing) {
        // Pad and switch to squeezing if not already done
        this.padAndSwitchToSqueezingPhase();
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

    extract() {
      const count = this.rateBytes >> 3;
      for (let i = 0; i < count; i++) {
        unpack64LE(this.state[i], this.queue, i * 8);
      }
    }

    keccakPermutation() {
      let A = this.state;

      const myBase = KECCAK_RC.length - this.rounds;

      for (let round = 0; round < this.rounds; round++) {
        // Theta
        const c0 = A[0] ^ A[5] ^ A[10] ^ A[15] ^ A[20];
        const c1 = A[1] ^ A[6] ^ A[11] ^ A[16] ^ A[21];
        const c2 = A[2] ^ A[7] ^ A[12] ^ A[17] ^ A[22];
        const c3 = A[3] ^ A[8] ^ A[13] ^ A[18] ^ A[23];
        const c4 = A[4] ^ A[9] ^ A[14] ^ A[19] ^ A[24];

        const d0 = OpCodes.RotL64n(c1, 1) ^ c4;
        const d1 = OpCodes.RotL64n(c2, 1) ^ c0;
        const d2 = OpCodes.RotL64n(c3, 1) ^ c1;
        const d3 = OpCodes.RotL64n(c4, 1) ^ c2;
        const d4 = OpCodes.RotL64n(c0, 1) ^ c3;

        A[0] ^= d0; A[5] ^= d0; A[10] ^= d0; A[15] ^= d0; A[20] ^= d0;
        A[1] ^= d1; A[6] ^= d1; A[11] ^= d1; A[16] ^= d1; A[21] ^= d1;
        A[2] ^= d2; A[7] ^= d2; A[12] ^= d2; A[17] ^= d2; A[22] ^= d2;
        A[3] ^= d3; A[8] ^= d3; A[13] ^= d3; A[18] ^= d3; A[23] ^= d3;
        A[4] ^= d4; A[9] ^= d4; A[14] ^= d4; A[19] ^= d4; A[24] ^= d4;

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

          A[y] = a0 ^ (~a1 & a2);
          A[y + 1] = a1 ^ (~a2 & a3);
          A[y + 2] = a2 ^ (~a3 & a4);
          A[y + 3] = a3 ^ (~a4 & a0);
          A[y + 4] = a4 ^ (~a0 & a1);
        }

        // Iota
        A[0] ^= KECCAK_RC[myBase + round];
      }
    }
  }

  // ===== HELPER FUNCTIONS FOR TEST VECTORS =====

  /**
   * Build standard test buffer (pattern of 00-FA repeating, i % 251)
   * @param {number} length - Buffer length
   * @returns {Array} Test buffer
   */
  function buildStandardBuffer(length) {
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
          "KangarooTwelve Draft Specification",
          "https://tools.ietf.org/html/draft-viguier-kangarootwelve-04"
        ),
        new LinkItem(
          "Official Website",
          "https://keccak.team/kangarootwelve.html"
        )
      ];

      // Test vectors from https://tools.ietf.org/html/draft-viguier-kangarootwelve-04
      this.tests = [
        // Empty input
        {
          text: "KangarooTwelve Test Vector #1 - Empty input (32 bytes)",
          uri: "https://tools.ietf.org/html/draft-viguier-kangarootwelve-04",
          input: OpCodes.Hex8ToBytes(""),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("1AC2D450FC3B4205D19DA7BFCA1B37513C0803577AC7167F06FE2CE1F0EF39E5")
        },
        // Empty input (64 bytes)
        {
          text: "KangarooTwelve Test Vector #2 - Empty input (64 bytes)",
          uri: "https://tools.ietf.org/html/draft-viguier-kangarootwelve-04",
          input: OpCodes.Hex8ToBytes(""),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("1AC2D450FC3B4205D19DA7BFCA1B37513C0803577AC7167F06FE2CE1F0EF39E54269C056B8C82E48276038B6D292966CC07A3D4645272E31FF38508139EB0A71")
        },
        // 1 byte (pattern)
        {
          text: "KangarooTwelve Test Vector #4 - 1 byte pattern",
          uri: "https://tools.ietf.org/html/draft-viguier-kangarootwelve-04",
          input: buildStandardBuffer(1),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("2BDA92450E8B147F8A7CB629E784A058EFCA7CF7D8218E02D345DFAA65244A1F")
        },
        // 17 bytes (pattern)
        {
          text: "KangarooTwelve Test Vector #5 - 17 bytes pattern",
          uri: "https://tools.ietf.org/html/draft-viguier-kangarootwelve-04",
          input: buildStandardBuffer(17),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("6BF75FA2239198DB4772E36478F8E19B0F371205F6A9A93A273F51DF37122888")
        },
        // 17^2 = 289 bytes (pattern)
        {
          text: "KangarooTwelve Test Vector #6 - 289 bytes pattern",
          uri: "https://tools.ietf.org/html/draft-viguier-kangarootwelve-04",
          input: buildStandardBuffer(17 * 17),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("0C315EBCDEDBF61426DE7DCF8FB725D1E74675D7F5327A5067F367B108ECB67C")
        },
        // 17^3 = 4913 bytes (pattern)
        {
          text: "KangarooTwelve Test Vector #7 - 4913 bytes pattern",
          uri: "https://tools.ietf.org/html/draft-viguier-kangarootwelve-04",
          input: buildStandardBuffer(17 * 17 * 17),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("CB552E2EC77D9910701D578B457DDF772C12E322E4EE7FE417F92C758F0D59D0")
        },
        // 17^4 = 83521 bytes (pattern)
        {
          text: "KangarooTwelve Test Vector #8 - 83521 bytes pattern",
          uri: "https://tools.ietf.org/html/draft-viguier-kangarootwelve-04",
          input: buildStandardBuffer(17 * 17 * 17 * 17),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("8701045E22205345FF4DDA05555CBB5C3AF1A771C2B89BAEF37DB43D9998B9FE")
        },
        // 17^5 = 1419857 bytes (pattern)
        {
          text: "KangarooTwelve Test Vector #9 - 1419857 bytes pattern",
          uri: "https://tools.ietf.org/html/draft-viguier-kangarootwelve-04",
          input: buildStandardBuffer(17 * 17 * 17 * 17 * 17),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("844D610933B1B9963CBDEB5AE3B6B05CC7CBD67CEEDF883EB678A0A8E0371682")
        },
        // 17^6 = 24137569 bytes (pattern)
        {
          text: "KangarooTwelve Test Vector #10 - 24137569 bytes pattern",
          uri: "https://tools.ietf.org/html/draft-viguier-kangarootwelve-04",
          input: buildStandardBuffer(17 * 17 * 17 * 17 * 17 * 17),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("3C390782A8A4E89FA6367F72FEAAF13255C8D95878481D3CD8CE85F58E880AF8")
        },
        // Empty input with 1 byte personalization
        {
          text: "KangarooTwelve Test Vector #11 - Empty input, 1 byte personalization",
          uri: "https://tools.ietf.org/html/draft-viguier-kangarootwelve-04",
          input: OpCodes.Hex8ToBytes(""),
          personalization: buildStandardBuffer(1),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("FAB658DB63E94A246188BF7AF69A133045F46EE984C56E3C3328CAAF1AA1A583")
        },
        // 1 byte 0xFF with 41 byte personalization
        {
          text: "KangarooTwelve Test Vector #12 - 1 byte 0xFF, 41 bytes personalization",
          uri: "https://tools.ietf.org/html/draft-viguier-kangarootwelve-04",
          input: new Array(1).fill(0xFF),
          personalization: buildStandardBuffer(41),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("D848C5068CED736F4462159B9867FD4C20B808ACC3D5BC48E0B06BA0A3762EC4")
        },
        // 3 bytes 0xFF with 41^2 = 1681 bytes personalization
        {
          text: "KangarooTwelve Test Vector #13 - 3 bytes 0xFF, 1681 bytes personalization",
          uri: "https://tools.ietf.org/html/draft-viguier-kangarootwelve-04",
          input: new Array(3).fill(0xFF),
          personalization: buildStandardBuffer(41 * 41),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("C389E5009AE57120854C2E8C64670AC01358CF4C1BAF89447A724234DC7CED74")
        },
        // 7 bytes 0xFF with 41^3 = 68921 bytes personalization
        {
          text: "KangarooTwelve Test Vector #14 - 7 bytes 0xFF, 68921 bytes personalization",
          uri: "https://tools.ietf.org/html/draft-viguier-kangarootwelve-04",
          input: new Array(7).fill(0xFF),
          personalization: buildStandardBuffer(41 * 41 * 41),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("75D2F86A2E644566726B4FBCFC5657B9DBCF070C7B0DCA06450AB291D7443BCF")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // Hash functions have no inverse
      }
      return new KangarooTwelveInstance(this);
    }
  }

  /**
   * KangarooTwelve Instance
   */
  class KangarooTwelveInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      this.treeSponge = new KangarooSponge(STRENGTH, ROUNDS);
      this.leafSponge = new KangarooSponge(STRENGTH, ROUNDS);
      this.chainLen = STRENGTH >> 2; // 32 bytes for K12

      this._outputSize = DIGESTLEN;
      this._personalization = null;
      this.personalBytes = [];

      this.squeezing = false;
      this.currNode = 0;
      this.processed = 0;

      this.buildPersonal(null);
    }

    set outputSize(size) {
      if (size < 1) {
        throw new Error("Output size must be at least 1 byte");
      }
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
    }

    set personalization(pers) {
      this._personalization = pers ? [...pers] : null;
      this.buildPersonal(this._personalization);
    }

    get personalization() {
      return this._personalization ? [...this._personalization] : null;
    }

    buildPersonal(personal) {
      const myLen = personal ? personal.length : 0;
      const myEnc = rightEncode(myLen);

      this.personalBytes = new Array(myLen + myEnc.length);
      if (personal) {
        for (let i = 0; i < myLen; i++) {
          this.personalBytes[i] = personal[i];
        }
      }
      for (let i = 0; i < myEnc.length; i++) {
        this.personalBytes[myLen + i] = myEnc[i];
      }
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.processData(data, 0, data.length);
    }

    Result() {
      // Switch to squeezing if not already
      if (!this.squeezing) {
        this.switchToSqueezing();
      }

      // Squeeze output
      const output = new Array(this._outputSize);
      this.treeSponge.squeeze(output, 0, this._outputSize);

      // Reset for next operation
      this.reset();

      return output;
    }

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

    switchLeaf(moreToCome) {
      if (this.currNode === 0) {
        // First node - absorb FIRST marker
        this.treeSponge.absorb(FIRST, 0, FIRST.length);
      } else {
        // Intermediate node - absorb INTERMEDIATE marker (0x0B), pad, then squeeze
        this.leafSponge.absorb(INTERMEDIATE, 0, INTERMEDIATE.length);
        this.leafSponge.padAndSwitchToSqueezingPhase();
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

    switchToSqueezing() {
      // Absorb personalization
      this.processData(this.personalBytes, 0, this.personalBytes.length);

      if (this.currNode === 0) {
        // Single node mode - absorb SINGLE marker (0x07), then pad
        this.treeSponge.absorb(SINGLE, 0, 1);
        this.treeSponge.padAndSwitchToSqueezingPhase();
      } else {
        // Multi-node mode - complete final leaf, then finalize tree
        this.switchLeaf(false);

        // Encode and absorb node count
        const lengthEnc = rightEncode(this.currNode);
        this.treeSponge.absorb(lengthEnc, 0, lengthEnc.length);

        // Absorb FINAL marker (0xFF 0xFF 0x06), then pad
        this.treeSponge.absorb(FINAL, 0, FINAL.length);
        this.treeSponge.padAndSwitchToSqueezingPhase();
      }

      this.squeezing = true;
    }

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
