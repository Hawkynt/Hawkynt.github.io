/*
 * Skein Hash Function - AlgorithmFramework Implementation
 * Production-quality implementation based on Skein 1.3 specification
 * (c)2006-2025 Hawkynt
 *
 * This implementation is based on the official NIST SHA-3 submission (Skein 1.3)
 * and Bouncy Castle reference implementation.
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
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== THREEFISH-512 CIPHER IMPLEMENTATION =====

  // Threefish-512 rotation constants (from Skein 1.3 spec)
  const ROTATION_0_0 = 46, ROTATION_0_1 = 36, ROTATION_0_2 = 19, ROTATION_0_3 = 37;
  const ROTATION_1_0 = 33, ROTATION_1_1 = 27, ROTATION_1_2 = 14, ROTATION_1_3 = 42;
  const ROTATION_2_0 = 17, ROTATION_2_1 = 49, ROTATION_2_2 = 36, ROTATION_2_3 = 39;
  const ROTATION_3_0 = 44, ROTATION_3_1 = 9, ROTATION_3_2 = 54, ROTATION_3_3 = 56;
  const ROTATION_4_0 = 39, ROTATION_4_1 = 30, ROTATION_4_2 = 34, ROTATION_4_3 = 24;
  const ROTATION_5_0 = 13, ROTATION_5_1 = 50, ROTATION_5_2 = 10, ROTATION_5_3 = 17;
  const ROTATION_6_0 = 25, ROTATION_6_1 = 29, ROTATION_6_2 = 39, ROTATION_6_3 = 43;
  const ROTATION_7_0 = 8, ROTATION_7_1 = 35, ROTATION_7_2 = 56, ROTATION_7_3 = 22;

  const ROUNDS_512 = 72;
  const C_240 = 0x1BD11BDAA9FC1A22n; // Key schedule parity constant

  // Rotate left and XOR for mixing
  function rotlXor64(x, n, xor) {
    const mask = 0xFFFFFFFFFFFFFFFFn;
    x = BigInt(x) & mask;
    xor = BigInt(xor) & mask;
    n = Number(n) & 63;
    return (((x << BigInt(n)) | (x >> BigInt(64 - n))) ^ xor) & mask;
  }

  // XOR and rotate right for unmixing
  function xorRotr64(x, n, xor) {
    const mask = 0xFFFFFFFFFFFFFFFFn;
    x = BigInt(x) & mask;
    xor = BigInt(xor) & mask;
    const xored = x ^ xor;
    n = Number(n) & 63;
    return ((xored >> BigInt(n)) | (xored << BigInt(64 - n))) & mask;
  }

  // Threefish-512 encryption
  function threefish512Encrypt(key, tweak, block) {
    const mask = 0xFFFFFFFFFFFFFFFFn;

    // Key schedule (extended key with parity)
    const kw = new Array(17);
    let knw = C_240;
    for (let i = 0; i < 8; i++) {
      kw[i] = BigInt(key[i]) & mask;
      knw ^= kw[i];
    }
    kw[8] = knw;
    for (let i = 0; i < 8; i++) {
      kw[9 + i] = kw[i];
    }

    // Tweak schedule
    const t = new Array(5);
    t[0] = BigInt(tweak[0]) & mask;
    t[1] = BigInt(tweak[1]) & mask;
    t[2] = t[0] ^ t[1];
    t[3] = t[0];
    t[4] = t[1];

    // Load block into state
    let b0 = BigInt(block[0]) & mask;
    let b1 = BigInt(block[1]) & mask;
    let b2 = BigInt(block[2]) & mask;
    let b3 = BigInt(block[3]) & mask;
    let b4 = BigInt(block[4]) & mask;
    let b5 = BigInt(block[5]) & mask;
    let b6 = BigInt(block[6]) & mask;
    let b7 = BigInt(block[7]) & mask;

    // Initial subkey injection
    b0 += kw[0];
    b1 += kw[1];
    b2 += kw[2];
    b3 += kw[3];
    b4 += kw[4];
    b5 += kw[5] + t[0];
    b6 += kw[6] + t[1];
    b7 += kw[7];

    // 72 rounds (18 iterations of 4 rounds each)
    for (let d = 1; d < (ROUNDS_512 / 4); d += 2) {
      const dm9 = d % 9;
      const dm3 = d % 3;

      // 4 rounds of mix and permute
      b1 = rotlXor64(b1, ROTATION_0_0, b0 += b1);
      b3 = rotlXor64(b3, ROTATION_0_1, b2 += b3);
      b5 = rotlXor64(b5, ROTATION_0_2, b4 += b5);
      b7 = rotlXor64(b7, ROTATION_0_3, b6 += b7);

      b1 = rotlXor64(b1, ROTATION_1_0, b2 += b1);
      b7 = rotlXor64(b7, ROTATION_1_1, b4 += b7);
      b5 = rotlXor64(b5, ROTATION_1_2, b6 += b5);
      b3 = rotlXor64(b3, ROTATION_1_3, b0 += b3);

      b1 = rotlXor64(b1, ROTATION_2_0, b4 += b1);
      b3 = rotlXor64(b3, ROTATION_2_1, b6 += b3);
      b5 = rotlXor64(b5, ROTATION_2_2, b0 += b5);
      b7 = rotlXor64(b7, ROTATION_2_3, b2 += b7);

      b1 = rotlXor64(b1, ROTATION_3_0, b6 += b1);
      b7 = rotlXor64(b7, ROTATION_3_1, b0 += b7);
      b5 = rotlXor64(b5, ROTATION_3_2, b2 += b5);
      b3 = rotlXor64(b3, ROTATION_3_3, b4 += b3);

      // Subkey injection
      b0 += kw[dm9];
      b1 += kw[dm9 + 1];
      b2 += kw[dm9 + 2];
      b3 += kw[dm9 + 3];
      b4 += kw[dm9 + 4];
      b5 += kw[dm9 + 5] + t[dm3];
      b6 += kw[dm9 + 6] + t[dm3 + 1];
      b7 += kw[dm9 + 7] + BigInt(d);

      // 4 more rounds
      b1 = rotlXor64(b1, ROTATION_4_0, b0 += b1);
      b3 = rotlXor64(b3, ROTATION_4_1, b2 += b3);
      b5 = rotlXor64(b5, ROTATION_4_2, b4 += b5);
      b7 = rotlXor64(b7, ROTATION_4_3, b6 += b7);

      b1 = rotlXor64(b1, ROTATION_5_0, b2 += b1);
      b7 = rotlXor64(b7, ROTATION_5_1, b4 += b7);
      b5 = rotlXor64(b5, ROTATION_5_2, b6 += b5);
      b3 = rotlXor64(b3, ROTATION_5_3, b0 += b3);

      b1 = rotlXor64(b1, ROTATION_6_0, b4 += b1);
      b3 = rotlXor64(b3, ROTATION_6_1, b6 += b3);
      b5 = rotlXor64(b5, ROTATION_6_2, b0 += b5);
      b7 = rotlXor64(b7, ROTATION_6_3, b2 += b7);

      b1 = rotlXor64(b1, ROTATION_7_0, b6 += b1);
      b7 = rotlXor64(b7, ROTATION_7_1, b0 += b7);
      b5 = rotlXor64(b5, ROTATION_7_2, b2 += b5);
      b3 = rotlXor64(b3, ROTATION_7_3, b4 += b3);

      // Subkey injection
      b0 += kw[dm9 + 1];
      b1 += kw[dm9 + 2];
      b2 += kw[dm9 + 3];
      b3 += kw[dm9 + 4];
      b4 += kw[dm9 + 5];
      b5 += kw[dm9 + 6] + t[dm3 + 1];
      b6 += kw[dm9 + 7] + t[dm3 + 2];
      b7 += kw[dm9 + 8] + BigInt(d + 1);
    }

    // Mask all to 64-bit before returning
    return [
      b0 & mask, b1 & mask, b2 & mask, b3 & mask,
      b4 & mask, b5 & mask, b6 & mask, b7 & mask
    ];
  }

  // ===== SKEIN-512 UBI MODE =====

  const PARAM_TYPE_CONFIG = 4;
  const PARAM_TYPE_MESSAGE = 48;
  const PARAM_TYPE_OUTPUT = 63;

  // UBI tweak structure
  const T1_FINAL = 1n << 63n;
  const T1_FIRST = 1n << 62n;

  class SkeinUBI {
    constructor(blockSize) {
      this.blockSize = blockSize; // 64 bytes for Skein-512
      this.currentBlock = new Uint8Array(blockSize);
      this.currentOffset = 0;
      this.tweak = [0n, 0n]; // [T0, T1]
      this.message = new Array(8); // 8 x 64-bit words
    }

    reset(type) {
      this.tweak[0] = 0n;
      this.tweak[1] = BigInt(type) << 56n; // Type in bits 120-125
      this.tweak[1] |= T1_FIRST; // Set first flag
      this.currentOffset = 0;
    }

    update(data, offset, length, chain) {
      let copied = 0;
      while (copied < length) {
        if (this.currentOffset === this.blockSize) {
          this.processBlock(chain);
          this.tweak[1] &= ~T1_FIRST; // Clear first flag
          this.currentOffset = 0;
        }

        const toCopy = Math.min(length - copied, this.blockSize - this.currentOffset);
        for (let i = 0; i < toCopy; i++) {
          this.currentBlock[this.currentOffset + i] = data[offset + copied + i];
        }
        copied += toCopy;
        this.currentOffset += toCopy;
        this.tweak[0] += BigInt(toCopy); // Advance position
      }
    }

    processBlock(chain) {
      // Convert current block to 64-bit words (little-endian)
      for (let i = 0; i < 8; i++) {
        const offset = i * 8;
        this.message[i] = BigInt(this.currentBlock[offset]) |
                         (BigInt(this.currentBlock[offset + 1]) << 8n) |
                         (BigInt(this.currentBlock[offset + 2]) << 16n) |
                         (BigInt(this.currentBlock[offset + 3]) << 24n) |
                         (BigInt(this.currentBlock[offset + 4]) << 32n) |
                         (BigInt(this.currentBlock[offset + 5]) << 40n) |
                         (BigInt(this.currentBlock[offset + 6]) << 48n) |
                         (BigInt(this.currentBlock[offset + 7]) << 56n);
      }

      // Encrypt message with Threefish using current chain as key
      const output = threefish512Encrypt(chain, this.tweak, this.message);

      // XOR with message (Davies-Meyer construction)
      for (let i = 0; i < 8; i++) {
        chain[i] = (output[i] ^ this.message[i]) & 0xFFFFFFFFFFFFFFFFn;
      }
    }

    doFinal(chain) {
      // Pad remaining block with zeros
      for (let i = this.currentOffset; i < this.blockSize; i++) {
        this.currentBlock[i] = 0;
      }

      // Set final flag
      this.tweak[1] |= T1_FINAL;
      this.processBlock(chain);
    }
  }

  // ===== SKEIN HASH FUNCTION =====

  // Precalculated initial state for Skein-512-512 (from Skein 1.3 spec Appendix C)
  const INITIAL_STATE_512_512 = Object.freeze([
    0x4903ADFF749C51CEn, 0x0D95DE399746DF03n, 0x8FD1934127C79BCEn, 0x9A255629FF352CB1n,
    0x5DB62599DF6CA7B0n, 0xEABE394CA9D5C3F4n, 0x991112C71A75B523n, 0xAE18A40B660FCC33n
  ]);

  class SkeinHasher {
    constructor(outputBits) {
      this.outputBits = outputBits;
      this.blockSize = 64; // Skein-512 uses 64-byte blocks
      this.chain = new Array(8); // 8 x 64-bit state
      this.ubi = new SkeinUBI(this.blockSize);

      // Initialize chain with precalculated initial state for 512-512
      if (outputBits === 512) {
        for (let i = 0; i < 8; i++) {
          this.chain[i] = INITIAL_STATE_512_512[i];
        }
      } else {
        // For other output sizes, compute UBI(CFG) from zero state
        for (let i = 0; i < 8; i++) {
          this.chain[i] = 0n;
        }
        this.processConfig();
      }

      // Save initial state for reset
      this.initialState = [...this.chain];
    }

    processConfig() {
      // Configuration block: "SHA3" (4 bytes) + version (2 bytes) + reserved (2 bytes) + output length (8 bytes)
      const config = new Uint8Array(32);
      config[0] = 0x53; // 'S'
      config[1] = 0x48; // 'H'
      config[2] = 0x41; // 'A'
      config[3] = 0x33; // '3'
      config[4] = 1;    // Version 1
      config[5] = 0;    // Version (MSB)

      // Output length in bits (little-endian 64-bit)
      const outBits = BigInt(this.outputBits);
      for (let i = 0; i < 8; i++) {
        config[8 + i] = Number((outBits >> BigInt(i * 8)) & 0xFFn);
      }

      this.ubi.reset(PARAM_TYPE_CONFIG);
      this.ubi.update(config, 0, 32, this.chain);
      this.ubi.doFinal(this.chain);
    }

    update(data) {
      if (typeof data === 'string') {
        data = OpCodes.AnsiToBytes(data);
      }
      this.ubi.update(data, 0, data.length, this.chain);
    }

    finalize() {
      // Finalize message block
      this.ubi.doFinal(this.chain);

      // Output transformation
      const outputBytes = this.outputBits / 8;
      const result = new Uint8Array(outputBytes);

      const counter = new Uint8Array(8);
      counter[0] = 0; // Output counter starts at 0

      this.ubi.reset(PARAM_TYPE_OUTPUT);
      this.ubi.update(counter, 0, 8, this.chain);

      const outputWords = [...this.chain]; // Copy chain before final
      this.ubi.doFinal(outputWords);

      // Convert 64-bit words to bytes (little-endian)
      const wordsNeeded = Math.ceil(outputBytes / 8);
      for (let i = 0; i < wordsNeeded; i++) {
        const word = outputWords[i];
        const bytesToWrite = Math.min(8, outputBytes - i * 8);
        for (let j = 0; j < bytesToWrite; j++) {
          result[i * 8 + j] = Number((word >> BigInt(j * 8)) & 0xFFn);
        }
      }

      return result;
    }

    reset() {
      for (let i = 0; i < 8; i++) {
        this.chain[i] = this.initialState[i];
      }
      this.ubi.reset(PARAM_TYPE_MESSAGE);
    }
  }

  // ===== ALGORITHM REGISTRATION =====

  /**
 * SkeinAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class SkeinAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "Skein";
      this.description = "Skein-512 hash function from NIST SHA-3 competition. Built on Threefish-512 tweakable block cipher using UBI mode. Finalist in SHA-3 competition (lost to Keccak).";
      this.inventor = "Bruce Schneier, Niels Ferguson, Stefan Lucks, Doug Whiting, Mihir Bellare, Tadayoshi Kohno, Jon Callas, Jesse Walker";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-3 Competition Finalist";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.SupportedOutputSizes = [64]; // 512 bits
      this.blockSize = 64;
      this.outputSize = 64;

      this.documentation = [
        new LinkItem("Skein 1.3 Specification", "https://www.schneier.com/academic/skein/skein1.3.pdf"),
        new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project"),
        new LinkItem("Threefish Cipher", "https://www.schneier.com/academic/threefish/")
      ];

      this.references = [
        new LinkItem("Bouncy Castle Implementation", "https://github.com/bcgit/bc-csharp"),
        new LinkItem("SHA-3 Zoo", "https://keccak.team/obsolete_SHA3_zoo/Skein.html")
      ];

      // Official test vectors from NIST Skein 1.3 submission
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes(""), // empty string
          OpCodes.Hex8ToBytes("bc5b4c50925519c290cc634277ae3d6257212395cba733bbad37a4af0fa06af41fca7903d06564fea7a2d3730dbdb80c1f85562dfcc070334ea4d1d9e72cba7a"),
          "Skein-512-512 empty string",
          "https://www.schneier.com/academic/skein/skein1.3.pdf"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("fb"), // single byte 0xFB
          OpCodes.Hex8ToBytes("c49e03d50b4b2cc46bd3b7ef7014c8a45b016399fd1714467b7596c86de98240e35bf7f9772b7d65465cd4cffab14e6bc154c54fc67b8bc340abf08eff572b9e"),
          "Skein-512-512 single byte 0xFB",
          "https://www.schneier.com/academic/skein/skein1.3.pdf"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("fbd17c26b61a82e12e125f0d459b96c91ab4837dff22b39b78439430cdfc5dc8"),
          OpCodes.Hex8ToBytes("abefb179d52f68f86941acbbe014cc67ec66ad78b7ba9508eb1400ee2cbdb06f9fe7c2a260a0272d0d80e8ef5e8737c0c6a5f1c02ceb00fb2746f664b85fcef5"),
          "Skein-512-512 32-byte message (Bouncy Castle test vector)",
          "https://github.com/bcgit/bc-csharp"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new SkeinInstance(this);
    }
  }

  /**
 * Skein cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SkeinInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.hasher = new SkeinHasher(512);
      this.hasher.ubi.reset(PARAM_TYPE_MESSAGE);
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.hasher.update(data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      return this.hasher.finalize();
    }

    ProcessData(input, key) {
      this.hasher.reset();
      this.hasher.ubi.reset(PARAM_TYPE_MESSAGE);
      this.hasher.update(input);
      return this.hasher.finalize();
    }

    Reset() {
      this.hasher = new SkeinHasher(512);
      this.hasher.ubi.reset(PARAM_TYPE_MESSAGE);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SkeinAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { SkeinAlgorithm, SkeinInstance };
}));
