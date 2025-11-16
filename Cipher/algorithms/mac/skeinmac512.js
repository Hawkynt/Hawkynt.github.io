/*
 * Skein-512-MAC - Skein-512 in Keyed Mode for Message Authentication
 * Production-quality implementation based on Skein 1.3 specification
 * (c)2006-2025 Hawkynt
 *
 * Skein natively supports MAC mode through its UBI (Unique Block Iteration) framework
 * by processing a KEY block before the MESSAGE blocks.
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
          MacAlgorithm, IMacInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

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

  const PARAM_TYPE_KEY = 0;
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

  // ===== SKEIN MAC HASHER =====

  class SkeinMACHasher {
    constructor(outputBits) {
      this.outputBits = outputBits;
      this.blockSize = 64; // Skein-512 uses 64-byte blocks
      this.chain = new Array(8); // 8 x 64-bit state
      this.ubi = new SkeinUBI(this.blockSize);
      this.key = null;

      // Initialize chain to zeros (will process KEY block first)
      for (let i = 0; i < 8; i++) {
        this.chain[i] = 0n;
      }
    }

    setKey(keyBytes) {
      this.key = keyBytes ? [...keyBytes] : null;
    }

    init() {
      // Reset chain to zeros
      for (let i = 0; i < 8; i++) {
        this.chain[i] = 0n;
      }

      // Process KEY block first (this is what makes it MAC mode)
      if (this.key) {
        this.ubi.reset(PARAM_TYPE_KEY);
        this.ubi.update(this.key, 0, this.key.length, this.chain);
        this.ubi.doFinal(this.chain);
      }

      // Process configuration block
      this.processConfig();

      // Reset UBI for MESSAGE blocks
      this.ubi.reset(PARAM_TYPE_MESSAGE);
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
  }

  // ===== ALGORITHM REGISTRATION =====

  class SkeinMAC512Algorithm extends MacAlgorithm {
    constructor() {
      super();

      this.name = "Skein-512-MAC";
      this.description = "Skein-512 in keyed mode for message authentication. Uses Skein's native UBI framework with KEY block processing for secure MAC generation. Supports variable-length keys and output.";
      this.inventor = "Bruce Schneier, Niels Ferguson, Stefan Lucks, Doug Whiting, Mihir Bellare, Tadayoshi Kohno, Jon Callas, Jesse Walker";
      this.year = 2008;
      this.category = CategoryType.MAC;
      this.subCategory = "Hash-based MAC";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.SupportedKeySizes = [new KeySize(1, 256, 1)]; // Variable key size (Skein supports arbitrary key lengths)
      this.SupportedOutputSizes = [64]; // Default 512 bits, but supports variable

      this.documentation = [
        new LinkItem("Skein 1.3 Specification", "https://www.schneier.com/academic/skein/skein1.3.pdf"),
        new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project")
      ];

      this.references = [
        new LinkItem("Bouncy Castle SkeinMac", "https://github.com/bcgit/bc-lts-java/blob/main/core/src/main/java/org/bouncycastle/crypto/macs/SkeinMac.java"),
        new LinkItem("Skein Test Vectors", "https://www.schneier.com/academic/skein/skein_golden_kat.txt")
      ];

      // Official test vectors from Skein 1.3 NIST submission (skein_golden_kat.txt)
      // From BouncyCastle SkeinMacTest.java
      this.tests = [
        {
          text: "Skein-512-MAC Official Test Vector - empty message",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java",
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("cb41f1706cde09651203c2d0efbaddf847a0d315cb2e53ff8bac41da0002672e920244c66e02d5f0dad3e94c42bb65f0d14157decf4105ef5609d5b0984457c1935df3061ff06e9f204192ba11e5bb2cac0430c1c370cb3d113fea5ec1021eb875e5946d7a96ac69a1626c6206b7252736f24253c9ee9b85eb852dfc814631346c"),
          expected: OpCodes.Hex8ToBytes("9bd43d2a2fcfa92becb9f69faab3936978f1b865b7e44338fc9c8f16aba949ba340291082834a1fc5aa81649e13d50cd98641a1d0883062bfe2c16d1faa7e3aa")
        },
        {
          text: "Skein-512-MAC Official Test Vector - 1 byte (0xd3)",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java",
          input: OpCodes.Hex8ToBytes("d3"),
          key: OpCodes.Hex8ToBytes("cb41f1706cde09651203c2d0efbaddf847a0d315cb2e53ff8bac41da0002672e920244c66e02d5f0dad3e94c42bb65f0d14157decf4105ef5609d5b0984457c1"),
          expected: OpCodes.Hex8ToBytes("f0c0a10f031c8fc69cfabcd54154c318b5d6cd95d06b12cf20264402492211ee010d5cecc2dc37fd772afac0596b2bf71e6020ef2dee7c860628b6e643ed9ff6")
        },
        {
          text: "Skein-512-MAC Official Test Vector - 8 bytes",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java",
          input: OpCodes.Hex8ToBytes("d3090c72167517f7"),
          key: OpCodes.Hex8ToBytes("cb41f1706cde09651203c2d0efbaddf847a0d315cb2e53ff8bac41da0002672e"),
          expected: OpCodes.Hex8ToBytes("0c1f1921253dd8e5c2d4c5f4099f851042d91147892705829161f5fc64d89785226eb6e187068493ee4c78a4b7c0f55a8cbbb1a5982c2daf638fc6a74b16b0d7")
        },
        {
          text: "Skein-512-MAC Official Test Vector - 16 bytes",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java",
          input: OpCodes.Hex8ToBytes("d3090c72167517f7c7ad82a70c2fd3f6"),
          key: OpCodes.Hex8ToBytes("cb41f1706cde09651203c2d0efbaddf847a0d315cb2e53ff8bac41da0002672e920244c66e02d5f0dad3e94c42bb65f0d14157decf4105ef5609d5b0984457c1"),
          expected: OpCodes.Hex8ToBytes("478d7b6c0cc6e35d9ebbdedf39128e5a36585db6222891692d1747d401de34ce3db6fcbab6c968b7f2620f4a844a2903b547775579993736d2493a75ff6752a1")
        },
        {
          text: "Skein-512-MAC Official Test Vector - 24 bytes",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java",
          input: OpCodes.Hex8ToBytes("d3090c72167517f7c7ad82a70c2fd3f6443f608301591e59"),
          key: OpCodes.Hex8ToBytes("cb41f1706cde09651203c2d0efbaddf847a0d315cb2e53ff8bac41da0002672e920244c66e02d5f0dad3e94c42bb65f0d14157decf4105ef5609d5b0984457c193"),
          expected: OpCodes.Hex8ToBytes("13c170bac1de35e5fb843f65fabecf214a54a6e0458a4ff6ea5df91915468f4efcd371effa8965a9e82c5388d84730490dcf3976af157b8baf550655a5a6ab78")
        },
        {
          text: "Skein-512-MAC Official Test Vector - 48 bytes",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java",
          input: OpCodes.Hex8ToBytes("d3090c72167517f7c7ad82a70c2fd3f6443f608301591e598eadb195e8357135ba26fede2ee187417f816048d00fc235"),
          key: OpCodes.Hex8ToBytes("cb41f1706cde09651203c2d0efbaddf847a0d315cb2e53ff8bac41da0002672e920244c66e02d5f0dad3e94c42bb65f0d14157decf4105ef5609d5b0984457c1"),
          expected: OpCodes.Hex8ToBytes("a947812529a72fd3b8967ec391b298bee891babc8487a1ec4ea3d88f6b2b5be09ac6a780f30f8e8c3bbb4f18bc302a28f3e87d170ba0f858a8fefe3487478cca")
        },
        {
          text: "Skein-512-MAC Official Test Vector - 64 bytes",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java",
          input: OpCodes.Hex8ToBytes("d3090c72167517f7c7ad82a70c2fd3f6443f608301591e598eadb195e8357135ba26fede2ee187417f816048d00fc23512737a2113709a77e4170c49a94b7fdf"),
          key: OpCodes.Hex8ToBytes("cb41f1706cde09651203c2d0efbaddf847a0d315cb2e53ff8bac41da0002672e920244c66e02d5f0dad3e94c42bb65f0d14157decf4105ef5609d5b0984457c1935df3061ff06e9f204192ba11e5bb2cac0430c1c370cb3d113fea5ec1021eb875e5946d7a96ac69a1626c6206b7252736f24253c9ee9b85eb852dfc814631346c"),
          expected: OpCodes.Hex8ToBytes("7690ba61f10e0bba312980b0212e6a9a51b0e9aadfde7ca535754a706e042335b29172aae29d8bad18efaf92d43e6406f3098e253f41f2931eda5911dc740352")
        },
        {
          text: "Skein-512-MAC Official Test Vector - 80 bytes",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java",
          input: OpCodes.Hex8ToBytes("d3090c72167517f7c7ad82a70c2fd3f6443f608301591e598eadb195e8357135ba26fede2ee187417f816048d00fc23512737a2113709a77e4170c49a94b7fdff45ff579a72287743102e7766c35ca5abc5dfe2f63a1e726ce5fbd2926db03a2"),
          key: OpCodes.Hex8ToBytes("cb41f1706cde09651203c2d0efbaddf847a0d315cb2e53ff8bac41da0002672e"),
          expected: OpCodes.Hex8ToBytes("d10e3ba81855ac087fbf5a3bc1f99b27d05f98ba22441138026225d34a418b93fd9e8dfaf5120757451adabe050d0eb59d271b0fe1bbf04badbcf9ba25a8791b")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SkeinMAC512Instance(this, isInverse);
    }
  }

  /**
 * SkeinMAC512 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SkeinMAC512Instance extends IMacInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._outputSize = 64; // Default 512 bits
      this.hasher = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      // Validate against algorithm's SupportedKeySizes
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    set outputSize(sizeBytes) {
      this._outputSize = sizeBytes;
    }

    get outputSize() {
      return this._outputSize;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");

      // Lazy initialization on first Feed
      if (!this.hasher) {
        this.hasher = new SkeinMACHasher(this._outputSize * 8);
        this.hasher.setKey(this._key);
        this.hasher.init();
      }

      this.hasher.update(data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");

      // Initialize hasher if not already done (empty message case)
      if (!this.hasher) {
        this.hasher = new SkeinMACHasher(this._outputSize * 8);
        this.hasher.setKey(this._key);
        this.hasher.init();
      }

      const mac = this.hasher.finalize();

      // Reset for next MAC operation
      this.hasher = null;

      return mac;
    }

    ProcessData(input, key) {
      if (key) this.key = key;
      if (!this._key) throw new Error("Key not set");

      this.hasher = new SkeinMACHasher(this._outputSize * 8);
      this.hasher.setKey(this._key);
      this.hasher.init();
      this.hasher.update(input);
      const mac = this.hasher.finalize();
      this.hasher = null;

      return mac;
    }

    Reset() {
      this.hasher = null;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SkeinMAC512Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { SkeinMAC512Algorithm, SkeinMAC512Instance };
}));
