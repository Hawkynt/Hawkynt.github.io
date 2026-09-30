/*
 * Skein (DarkCrypt variant) - AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * The Skein-512-512 used by the DarkCrypt Total Commander plugin is Skein
 * version 1.1 (15 November 2008), the SHA-3 round 1 definition. It predates
 * both later tweaks to Threefish-512:
 *
 *  - the round 2 tweak (version 1.2) replaced the rotation constants; the
 *    round 1 set is listed in Skein v1.3, Appendix D, Table 29
 *  - the round 3 tweak (version 1.3) replaced the key schedule parity constant
 *    C5 = 0x5555555555555555 with C240 = 0x1BD11BDAA9FC1A22
 *
 * UBI chaining, the configuration block, the tweak encoding and the output
 * transform are the same in every version. It matches the Skein-512-512
 * vectors of the version 1.1 paper (Appendix C.2) and every byte-aligned
 * entry of the version 1.1 known-answer tests (ShortMsgKAT_512,
 * LongMsgKAT_512). Test vectors verified against the DarkCrypt implementation.
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
}((function () {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== THREEFISH-512 CORE (Skein version 1.1) =====

  // Round 1 Threefish-512 rotation constants (Skein spec v1.3, Appendix D,
  // Table 29 - "October 2008 (NIST Round 1)"), replaced in version 1.2.
  const ROTATION_0_0 = 38, ROTATION_0_1 = 30, ROTATION_0_2 = 50, ROTATION_0_3 = 53;
  const ROTATION_1_0 = 48, ROTATION_1_1 = 20, ROTATION_1_2 = 43, ROTATION_1_3 = 31;
  const ROTATION_2_0 = 34, ROTATION_2_1 = 14, ROTATION_2_2 = 15, ROTATION_2_3 = 27;
  const ROTATION_3_0 = 26, ROTATION_3_1 = 12, ROTATION_3_2 = 58, ROTATION_3_3 = 7;
  const ROTATION_4_0 = 33, ROTATION_4_1 = 49, ROTATION_4_2 = 8,  ROTATION_4_3 = 42;
  const ROTATION_5_0 = 39, ROTATION_5_1 = 27, ROTATION_5_2 = 41, ROTATION_5_3 = 14;
  const ROTATION_6_0 = 29, ROTATION_6_1 = 26, ROTATION_6_2 = 11, ROTATION_6_3 = 9;
  const ROTATION_7_0 = 33, ROTATION_7_1 = 51, ROTATION_7_2 = 39, ROTATION_7_3 = 35;

  const ROUNDS_512 = 72;

  // Key schedule parity constant C5 of Skein versions 1.0 to 1.2; version 1.3
  // replaced it with C240 = 0x1BD11BDAA9FC1A22.
  const C_PARITY = 0x5555555555555555n;

  const MASK64 = 0xFFFFFFFFFFFFFFFFn;

  /**
   * Rotate left and XOR for mixing: rotl64(x, n) xor xor, both reduced to 64 bits
   * @param {BigInt} x - word to rotate (may exceed 64 bits)
   * @param {int32} n - rotation count
   * @param {BigInt} xor - word to XOR in (may exceed 64 bits)
   * @returns {BigInt} 64-bit result
   */
  function rotlXor64(x, n, xor) {
    const word = OpCodes.AndN(x, MASK64);
    const other = OpCodes.AndN(xor, MASK64);
    const count = OpCodes.And32(n, 63);
    return OpCodes.AndN(OpCodes.XorN(OpCodes.RotL64n(word, count), other), MASK64);
  }

  /**
   * Threefish-512 encryption (Skein version 1.1: round 1 rotations and parity constant)
   * @param {BigInt[]} key - eight 64-bit key words
   * @param {BigInt[]} tweak - two 64-bit tweak words
   * @param {BigInt[]} block - eight 64-bit plaintext words
   * @returns {BigInt[]} eight 64-bit ciphertext words
   */
  function threefish512Encrypt(key, tweak, block) {
    /** @type {BigInt[]} */
    const kw = new Array(17);
    let knw = C_PARITY;
    for (let i = 0; i < 8; i++) {
      kw[i] = OpCodes.AndN(BigInt(key[i]), MASK64);
      knw = OpCodes.XorN(knw, kw[i]);
    }
    kw[8] = knw;
    for (let i = 0; i < 8; i++) {
      kw[9 + i] = kw[i];
    }

    /** @type {BigInt[]} */
    const t = new Array(5);
    t[0] = OpCodes.AndN(BigInt(tweak[0]), MASK64);
    t[1] = OpCodes.AndN(BigInt(tweak[1]), MASK64);
    t[2] = OpCodes.XorN(t[0], t[1]);
    t[3] = t[0];
    t[4] = t[1];

    let b0 = OpCodes.AndN(BigInt(block[0]), MASK64);
    let b1 = OpCodes.AndN(BigInt(block[1]), MASK64);
    let b2 = OpCodes.AndN(BigInt(block[2]), MASK64);
    let b3 = OpCodes.AndN(BigInt(block[3]), MASK64);
    let b4 = OpCodes.AndN(BigInt(block[4]), MASK64);
    let b5 = OpCodes.AndN(BigInt(block[5]), MASK64);
    let b6 = OpCodes.AndN(BigInt(block[6]), MASK64);
    let b7 = OpCodes.AndN(BigInt(block[7]), MASK64);

    b0 += kw[0];
    b1 += kw[1];
    b2 += kw[2];
    b3 += kw[3];
    b4 += kw[4];
    b5 += kw[5] + t[0];
    b6 += kw[6] + t[1];
    b7 += kw[7];

    for (let d = 1; d < (ROUNDS_512 / 4); d += 2) {
      const dm9 = d % 9;
      const dm3 = d % 3;

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

      b0 += kw[dm9];
      b1 += kw[dm9 + 1];
      b2 += kw[dm9 + 2];
      b3 += kw[dm9 + 3];
      b4 += kw[dm9 + 4];
      b5 += kw[dm9 + 5] + t[dm3];
      b6 += kw[dm9 + 6] + t[dm3 + 1];
      b7 += kw[dm9 + 7] + BigInt(d);

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

      b0 += kw[dm9 + 1];
      b1 += kw[dm9 + 2];
      b2 += kw[dm9 + 3];
      b3 += kw[dm9 + 4];
      b4 += kw[dm9 + 5];
      b5 += kw[dm9 + 6] + t[dm3 + 1];
      b6 += kw[dm9 + 7] + t[dm3 + 2];
      b7 += kw[dm9 + 8] + BigInt(d + 1);
    }

    /** @type {BigInt[]} */
    const out = [
      OpCodes.AndN(b0, MASK64), OpCodes.AndN(b1, MASK64), OpCodes.AndN(b2, MASK64), OpCodes.AndN(b3, MASK64),
      OpCodes.AndN(b4, MASK64), OpCodes.AndN(b5, MASK64), OpCodes.AndN(b6, MASK64), OpCodes.AndN(b7, MASK64)
    ];
    return out;
  }

  // ===== SKEIN-512 UBI MODE (standard) =====

  const PARAM_TYPE_CONFIG = 4;
  const PARAM_TYPE_MESSAGE = 48;
  const PARAM_TYPE_OUTPUT = 63;

  const T1_FINAL = OpCodes.ShiftLn(1n, 63);
  const T1_FIRST = OpCodes.ShiftLn(1n, 62);

  /**
   * Unique Block Iteration over the DarkCrypt Threefish-512
   * @class
   */
  class SkeinUBI {
    /**
     * @param {int32} blockSize - bytes per block (64 for Skein-512)
     */
    constructor(blockSize) {
      /** @type {int32} */
      this.blockSize = blockSize;
      /** @type {uint8[]} */
      this.currentBlock = new Uint8Array(blockSize);
      /** @type {int32} */
      this.currentOffset = 0;
      /** @type {BigInt[]} */
      this.tweak = [0n, 0n];
      /** @type {BigInt[]} */
      this.message = new Array(8);
    }

    /**
     * Start a new UBI invocation of the given type
     * @param {int32} type - block type (config, message, output)
     * @returns {void}
     */
    reset(type) {
      this.tweak[0] = 0n;
      this.tweak[1] = OpCodes.OrN(OpCodes.ShiftLn(BigInt(type), 56), T1_FIRST);
      this.currentOffset = 0;
    }

    /**
     * Absorb bytes, compressing every block that is followed by more data
     * @param {uint8[]} data - source bytes
     * @param {int32} offset - first byte to take
     * @param {int32} length - number of bytes to take
     * @param {BigInt[]} chain - chaining value, updated in place
     * @returns {void}
     */
    update(data, offset, length, chain) {
      let copied = 0;
      while (copied < length) {
        if (this.currentOffset === this.blockSize) {
          this.processBlock(chain);
          this.tweak[1] &= ~T1_FIRST;
          this.currentOffset = 0;
        }

        const toCopy = Math.min(length - copied, this.blockSize - this.currentOffset);
        for (let i = 0; i < toCopy; i++) {
          this.currentBlock[this.currentOffset + i] = data[offset + copied + i];
        }
        copied += toCopy;
        this.currentOffset += toCopy;
        this.tweak[0] += BigInt(toCopy);
      }
    }

    /**
     * Compress the current block into the chaining value
     * @param {BigInt[]} chain - chaining value, updated in place
     * @returns {void}
     */
    processBlock(chain) {
      for (let i = 0; i < 8; i++) {
        const off = i * 8;
        let w = 0n;
        for (let j = 0; j < 8; j++) {
          w = OpCodes.OrN(w, OpCodes.ShiftLn(BigInt(this.currentBlock[off + j]), j * 8));
        }
        this.message[i] = w;
      }

      /** @type {BigInt[]} */
      const output = threefish512Encrypt(chain, this.tweak, this.message);

      for (let i = 0; i < 8; i++) {
        chain[i] = OpCodes.AndN(OpCodes.XorN(output[i], this.message[i]), MASK64);
      }
    }

    /**
     * Zero-pad and compress the last block with the final flag set
     * @param {BigInt[]} chain - chaining value, updated in place
     * @returns {void}
     */
    doFinal(chain) {
      for (let i = this.currentOffset; i < this.blockSize; i++) {
        this.currentBlock[i] = 0;
      }
      this.tweak[1] = OpCodes.OrN(this.tweak[1], T1_FINAL);
      this.processBlock(chain);
    }
  }

  // ===== SKEIN HASH FUNCTION (DarkCrypt variant, 512-bit output) =====

  /**
   * DarkCrypt Skein-512 with a configurable output length
   * @class
   */
  class SkeinHasher {
    /**
     * @param {int32} outputBits - digest length in bits
     */
    constructor(outputBits) {
      /** @type {int32} */
      this.outputBits = outputBits;
      /** @type {int32} */
      this.blockSize = 64;
      /** @type {BigInt[]} */
      this.chain = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
      /** @type {SkeinUBI} */
      this.ubi = new SkeinUBI(this.blockSize);

      this.processConfig();
      /** @type {BigInt[]} */
      this.initialState = this.chain.slice();
    }

    /**
     * Chain the configuration block (UBI type 4) into the zero state
     * @returns {void}
     */
    processConfig() {
      // Configuration block: "SHA3" (4 bytes) + version (2 bytes) + reserved (2 bytes)
      // + output length in bits (8 bytes), zero-padded to the 64-byte block size.
      const config = new Uint8Array(32);
      config[0] = 0x53; // 'S'
      config[1] = 0x48; // 'H'
      config[2] = 0x41; // 'A'
      config[3] = 0x33; // '3'
      config[4] = 1;    // Version 1 (low byte)
      config[5] = 0;    // Version (high byte)

      const outBits = BigInt(this.outputBits);
      for (let i = 0; i < 8; i++) {
        /** @type {uint8} */
        const lengthByte = Number(OpCodes.AndN(OpCodes.ShiftRn(outBits, i * 8), 0xFFn));
        config[8 + i] = lengthByte;
      }

      this.ubi.reset(PARAM_TYPE_CONFIG);
      this.ubi.update(config, 0, 32, this.chain);
      this.ubi.doFinal(this.chain);
    }

    /**
     * Absorb message bytes
     * @param {uint8[]} data - message bytes
     * @returns {void}
     */
    update(data) {
      this.ubi.update(data, 0, data.length, this.chain);
    }

    /**
     * Finish the message and run the output transformation
     * @returns {uint8[]} outputBits/8 digest bytes (a Uint8Array)
     */
    finalize() {
      this.ubi.doFinal(this.chain);

      const outputBytes = this.outputBits / 8;
      const result = new Uint8Array(outputBytes);

      const counter = new Uint8Array(8);
      this.ubi.reset(PARAM_TYPE_OUTPUT);
      this.ubi.update(counter, 0, 8, this.chain);

      /** @type {BigInt[]} */
      const outputWords = this.chain.slice();
      this.ubi.doFinal(outputWords);

      const wordsNeeded = Math.ceil(outputBytes / 8);
      for (let i = 0; i < wordsNeeded; i++) {
        const word = outputWords[i];
        const bytesToWrite = Math.min(8, outputBytes - i * 8);
        for (let j = 0; j < bytesToWrite; j++) {
          /** @type {uint8} */
          const digestByte = Number(OpCodes.AndN(OpCodes.ShiftRn(word, j * 8), 0xFFn));
          result[i * 8 + j] = digestByte;
        }
      }

      return result;
    }

    /**
     * Back to the initial chaining value
     * @returns {void}
     */
    reset() {
      for (let i = 0; i < 8; i++) {
        this.chain[i] = this.initialState[i];
      }
      this.ubi.reset(PARAM_TYPE_MESSAGE);
    }
  }

  // ===== ALGORITHM REGISTRATION =====

  class DarkCryptSkeinAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "Skein (DarkCrypt)";
      this.description = "Skein-512-512 as used by the DarkCrypt Total Commander plugin: Skein version 1.1, the SHA-3 round 1 definition, with the original Threefish-512 rotation constants (replaced in version 1.2) and key schedule parity constant 0x5555555555555555 (replaced by C240 in version 1.3). Matches the published version 1.1 test vectors and known-answer tests, not those of the final Skein 1.3.";
      this.inventor = "Bruce Schneier, Niels Ferguson, Stefan Lucks, Doug Whiting, Mihir Bellare, Tadayoshi Kohno, Jon Callas, Jesse Walker";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "DarkCrypt Variant";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.SupportedOutputSizes = [new KeySize(64, 64, 1)]; // 512 bits
      /** @type {int32} */
      this.blockSize = 64;
      /** @type {int32} */
      this.outputSize = 64;

      this.documentation = [
        new LinkItem("Skein 1.3 Specification", "https://www.schneier.com/academic/skein/skein1.3.pdf"),
        new LinkItem("Threefish Cipher", "https://www.schneier.com/academic/threefish/"),
        new LinkItem("Skein 1.1 Specification (15 Nov 2008)", "https://github.com/SparkDustJoe/Skein/blob/master/skein1.1.pdf"),
        new LinkItem("Skein NIST Round 3 Tweak Description", "https://www.schneier.com/wp-content/uploads/2015/01/skein-1.3-modifications.pdf"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.references = [
        new LinkItem("DarkCrypt Total Commander plugin", "https://github.com/Zdimon/DarkCryptTC")
      ];

      // Skein version 1.1 paper, Appendix C.2, the version 1.1 known-answer tests,
      // and further test vectors verified against the DarkCrypt implementation.
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes("ff"),
          OpCodes.Hex8ToBytes("8fca8d2705f99a56904308a4004c64efb668818b58b0895bf7296a2c5a54f9301483d622c4a5aec855ac30087e1eb0e83940906e7b055d70d446c8d285f27f01"),
          "Skein 1.1 Appendix C.2 - Skein-512-512, 1 byte",
          "https://github.com/SparkDustJoe/Skein/blob/master/skein1.1.pdf"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0efeeedecebeae9e8e7e6e5e4e3e2e1e0dfdedddcdbdad9d8d7d6d5d4d3d2d1d0cfcecdcccbcac9c8c7c6c5c4c3c2c1c0"),
          OpCodes.Hex8ToBytes("0fc42e100b2cd0b0c69f39383f9d2d17af6cf74e2aa8d4e2d91cbf94a59935a3123b7f9250f982224bf0c3e190be10ab41add8c1e35cbec4b1b3c35dbba5869c"),
          "Skein 1.1 Appendix C.2 - Skein-512-512, 64 bytes",
          "https://github.com/SparkDustJoe/Skein/blob/master/skein1.1.pdf"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0efeeedecebeae9e8e7e6e5e4e3e2e1e0dfdedddcdbdad9d8d7d6d5d4d3d2d1d0cfcecdcccbcac9c8c7c6c5c4c3c2c1c0bfbebdbcbbbab9b8b7b6b5b4b3b2b1b0afaeadacabaaa9a8a7a6a5a4a3a2a1a09f9e9d9c9b9a999897969594939291908f8e8d8c8b8a89888786858483828180"),
          OpCodes.Hex8ToBytes("0f019e7c1849167cecb9a0d8f1b00ccd5b14159c5aaee449dab55a1bc6c85103e8378454912e46af63067950f863043ccfa3699887a2577337caa66531bdbf9e"),
          "Skein 1.1 Appendix C.2 - Skein-512-512, 128 bytes",
          "https://github.com/SparkDustJoe/Skein/blob/master/skein1.1.pdf"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes(""),
          OpCodes.Hex8ToBytes("d3f7263a09837f4ce5c8ef70a5ddffac7b92d6c2ace5a12265bd5b593260a3ff20d8b4b4c5494e945448b37abb1fc526f6b46089208fde938d7f23724c4bdfb7"),
          "Skein 1.1 ShortMsgKAT_512 - Len = 0",
          "https://web.archive.org/web/2015/http://www.skein-hash.info/sites/default/files/skein_NIST_CD_121508.zip"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("cc"),
          OpCodes.Hex8ToBytes("a37fa71a4bff725887fd1e3c087a0d9c427e475962d4d4abfa45f098ec16a18c1e2f957c0ec343f7e910ec30e34aecfa703f6d2a334250e5446cdce71a99c222"),
          "Skein 1.1 ShortMsgKAT_512 - Len = 8",
          "https://web.archive.org/web/2015/http://www.skein-hash.info/sites/default/files/skein_NIST_CD_121508.zip"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("abc"),
          OpCodes.Hex8ToBytes("c52438c670f3d580dc4cb8d085141a19643668f82a6ad5f4ecb9292f04b8f38f1b9dcc8dc4108f72e6ec81fc6cbcd6edf1867fc4f0beafa692957a4adc1183e3"),
          "DarkCrypt Skein \"abc\"",
          "https://github.com/Zdimon/DarkCryptTC"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          OpCodes.Hex8ToBytes("df2624902ccc7e042541952126f94750802b3a1e61fa6e22f8bc981066874095883455ddd2b0c96a28f1074b4f151829ffc65415503f504e76f362c312120644"),
          "DarkCrypt Skein incremental 64-byte message",
          "https://github.com/Zdimon/DarkCryptTC"
        )
      ];
    }

    /**
     * Create new hash instance
     * @param {boolean} [isInverse=false] - unused, hashes have no inverse
     * @returns {DarkCryptSkeinInstance} New hash instance, null for the (nonexistent) inverse
     */
    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new DarkCryptSkeinInstance(this);
    }
  }

  class DarkCryptSkeinInstance extends IHashFunctionInstance {
    /**
     * @param {DarkCryptSkeinAlgorithm} algorithm - parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {SkeinHasher} */
      this.hasher = new SkeinHasher(512);
      this.hasher.ubi.reset(PARAM_TYPE_MESSAGE);
    }

    /**
     * Feed data to the hash. Successive calls extend the message.
     * @param {uint8[]} data - Input data bytes
     * @returns {void}
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      this.hasher.update(data);
    }

    /**
     * Finish the message and return the digest
     * @returns {uint8[]} 64-byte digest
     */
    Result() {
      /** @type {uint8[]} */
      const digest = this.hasher.finalize();
      return digest;
    }

    /**
     * Hash one whole message from the initial state
     * @param {uint8[]} input - message bytes
     * @param {uint8[]} key - unused
     * @returns {uint8[]} digest
     */
    ProcessData(input, key) {
      this.hasher.reset();
      this.hasher.ubi.reset(PARAM_TYPE_MESSAGE);
      this.hasher.update(input);
      /** @type {uint8[]} */
      const digest = this.hasher.finalize();
      return digest;
    }

    /**
     * Start over with a fresh hasher
     * @returns {void}
     */
    Reset() {
      this.hasher = new SkeinHasher(512);
      this.hasher.ubi.reset(PARAM_TYPE_MESSAGE);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DarkCryptSkeinAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSkeinAlgorithm, DarkCryptSkeinInstance };
}));
