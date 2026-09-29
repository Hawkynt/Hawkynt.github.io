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
  /** @type {int32} */ const ROTATION_0_0 = 46;
  /** @type {int32} */ const ROTATION_0_1 = 36;
  /** @type {int32} */ const ROTATION_0_2 = 19;
  /** @type {int32} */ const ROTATION_0_3 = 37;
  /** @type {int32} */ const ROTATION_1_0 = 33;
  /** @type {int32} */ const ROTATION_1_1 = 27;
  /** @type {int32} */ const ROTATION_1_2 = 14;
  /** @type {int32} */ const ROTATION_1_3 = 42;
  /** @type {int32} */ const ROTATION_2_0 = 17;
  /** @type {int32} */ const ROTATION_2_1 = 49;
  /** @type {int32} */ const ROTATION_2_2 = 36;
  /** @type {int32} */ const ROTATION_2_3 = 39;
  /** @type {int32} */ const ROTATION_3_0 = 44;
  /** @type {int32} */ const ROTATION_3_1 = 9;
  /** @type {int32} */ const ROTATION_3_2 = 54;
  /** @type {int32} */ const ROTATION_3_3 = 56;
  /** @type {int32} */ const ROTATION_4_0 = 39;
  /** @type {int32} */ const ROTATION_4_1 = 30;
  /** @type {int32} */ const ROTATION_4_2 = 34;
  /** @type {int32} */ const ROTATION_4_3 = 24;
  /** @type {int32} */ const ROTATION_5_0 = 13;
  /** @type {int32} */ const ROTATION_5_1 = 50;
  /** @type {int32} */ const ROTATION_5_2 = 10;
  /** @type {int32} */ const ROTATION_5_3 = 17;
  /** @type {int32} */ const ROTATION_6_0 = 25;
  /** @type {int32} */ const ROTATION_6_1 = 29;
  /** @type {int32} */ const ROTATION_6_2 = 39;
  /** @type {int32} */ const ROTATION_6_3 = 43;
  /** @type {int32} */ const ROTATION_7_0 = 8;
  /** @type {int32} */ const ROTATION_7_1 = 35;
  /** @type {int32} */ const ROTATION_7_2 = 56;
  /** @type {int32} */ const ROTATION_7_3 = 22;

  /** @type {int32} */
  const ROUNDS_512 = 72;
  /** @type {BigInt} */
  const C_240 = 0x1BD11BDAA9FC1A22n; // Key schedule parity constant
  /** @type {BigInt} */
  const MASK64 = 0xFFFFFFFFFFFFFFFFn;

  /**
   * Rotate left and XOR for mixing
   * @param {BigInt} x - Word to rotate
   * @param {int32} n - Rotation amount
   * @param {BigInt} xor - Word to XOR in (reduced to 64 bits)
   * @returns {BigInt} rotl64(x, n) XOR xor
   */
  function rotlXor64(x, n, xor) {
    return OpCodes.XorN(OpCodes.RotL64n(x, n), OpCodes.AndN(xor, MASK64));
  }

  /**
   * Threefish-512 encryption
   * @param {BigInt[]} key - 8 key words
   * @param {BigInt[]} tweak - 2 tweak words
   * @param {BigInt[]} block - 8 plaintext words
   * @returns {BigInt[]} 8 ciphertext words
   */
  function threefish512Encrypt(key, tweak, block) {
    // Key schedule (extended key with parity)
    /** @type {BigInt[]} */
    const kw = new Array(17);
    /** @type {BigInt} */
    let knw = C_240;
    for (let i = 0; i < 8; i++) {
      kw[i] = OpCodes.AndN(key[i], MASK64);
      knw = OpCodes.XorN(knw, kw[i]);
    }
    kw[8] = knw;
    for (let i = 0; i < 8; i++) {
      kw[9 + i] = kw[i];
    }

    // Tweak schedule
    /** @type {BigInt[]} */
    const t = new Array(5);
    t[0] = OpCodes.AndN(tweak[0], MASK64);
    t[1] = OpCodes.AndN(tweak[1], MASK64);
    t[2] = OpCodes.XorN(t[0], t[1]);
    t[3] = t[0];
    t[4] = t[1];

    // Load block into state
    let b0 = OpCodes.AndN(block[0], MASK64);
    let b1 = OpCodes.AndN(block[1], MASK64);
    let b2 = OpCodes.AndN(block[2], MASK64);
    let b3 = OpCodes.AndN(block[3], MASK64);
    let b4 = OpCodes.AndN(block[4], MASK64);
    let b5 = OpCodes.AndN(block[5], MASK64);
    let b6 = OpCodes.AndN(block[6], MASK64);
    let b7 = OpCodes.AndN(block[7], MASK64);

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
    /** @type {BigInt[]} */
    const out = new Array(8);
    out[0] = OpCodes.AndN(b0, MASK64);
    out[1] = OpCodes.AndN(b1, MASK64);
    out[2] = OpCodes.AndN(b2, MASK64);
    out[3] = OpCodes.AndN(b3, MASK64);
    out[4] = OpCodes.AndN(b4, MASK64);
    out[5] = OpCodes.AndN(b5, MASK64);
    out[6] = OpCodes.AndN(b6, MASK64);
    out[7] = OpCodes.AndN(b7, MASK64);
    return out;
  }

  // ===== SKEIN-512 UBI MODE =====

  /**
   * A zeroed array of 64-bit words
   * @param {int32} count - Number of words
   * @returns {BigInt[]} count zero words
   */
  function zeroWords64(count) {
    /** @type {BigInt[]} */
    const zeros = new Array(count);
    for (let i = 0; i < count; i++) zeros[i] = 0n;
    return zeros;
  }

  /** @type {BigInt} */
  const PARAM_TYPE_KEY = 0n;
  /** @type {BigInt} */
  const PARAM_TYPE_CONFIG = 4n;
  /** @type {BigInt} */
  const PARAM_TYPE_MESSAGE = 48n;
  /** @type {BigInt} */
  const PARAM_TYPE_OUTPUT = 63n;

  // UBI tweak structure
  /** @type {BigInt} */
  const T1_FINAL = OpCodes.ShiftLn(1n, 63);
  /** @type {BigInt} */
  const T1_FIRST = OpCodes.ShiftLn(1n, 62);
  /** @type {BigInt} */
  const T1_FIRST_CLEAR = 0xBFFFFFFFFFFFFFFFn; // 64-bit complement of T1_FIRST

  class SkeinUBI {
    /**
     * @param {int32} blockSize - Block size in bytes (64 for Skein-512)
     */
    constructor(blockSize) {
      /** @type {int32} */
      this.blockSize = blockSize; // 64 bytes for Skein-512
      /** @type {uint8[]} */
      this.currentBlock = OpCodes.CreateArray(blockSize, 0);
      /** @type {int32} */
      this.currentOffset = 0;
      /** @type {BigInt[]} */
      this._tweakWords = zeroWords64(2); // [T0, T1]
      /** @type {BigInt[]} */
      this._msgWords = zeroWords64(8); // 8 x 64-bit words
    }

    /**
     * Start a new UBI invocation
     * @param {BigInt} type - Block type field
     * @returns {void}
     */
    reset(type) {
      this._tweakWords[0] = 0n;
      this._tweakWords[1] = OpCodes.ShiftLn(type, 56); // Type in bits 120-125
      this._tweakWords[1] = OpCodes.OrN(this._tweakWords[1], T1_FIRST); // Set first flag
      this.currentOffset = 0;
    }

    /**
     * Absorb bytes, processing every block except the last one held
     * @param {uint8[]} data - Source bytes
     * @param {int32} offset - Start index in data
     * @param {int32} length - Number of bytes
     * @param {BigInt[]} chain - Chaining value (updated in place)
     * @returns {void}
     */
    update(data, offset, length, chain) {
      let copied = 0;
      while (copied < length) {
        if (this.currentOffset === this.blockSize) {
          this.processBlock(chain);
          this._tweakWords[1] = OpCodes.AndN(this._tweakWords[1], T1_FIRST_CLEAR); // Clear first flag
          this.currentOffset = 0;
        }

        const toCopy = Math.min(length - copied, this.blockSize - this.currentOffset);
        for (let i = 0; i < toCopy; i++) {
          this.currentBlock[this.currentOffset + i] = data[offset + copied + i];
        }
        copied += toCopy;
        this.currentOffset += toCopy;
        this._tweakWords[0] += BigInt(toCopy); // Advance position
      }
    }

    /**
     * Run Threefish over the held block and fold it into the chain
     * @param {BigInt[]} chain - Chaining value (updated in place)
     * @returns {void}
     */
    processBlock(chain) {
      // Convert current block to 64-bit words (little-endian)
      for (let i = 0; i < 8; i++) {
        const offset = i * 8;
        /** @type {BigInt} */
        let w = 0n;
        for (let j = 0; j < 8; j++) {
          w = OpCodes.OrN(w, OpCodes.ShiftLn(BigInt(this.currentBlock[offset + j]), j * 8));
        }
        this._msgWords[i] = w;
      }

      // Encrypt message with Threefish using current chain as key
      const output = threefish512Encrypt(chain, this._tweakWords, this._msgWords);

      // XOR with message (Davies-Meyer construction)
      for (let i = 0; i < 8; i++) {
        chain[i] = OpCodes.AndN(OpCodes.XorN(output[i], this._msgWords[i]), MASK64);
      }
    }

    /**
     * Zero-pad and process the final block
     * @param {BigInt[]} chain - Chaining value (updated in place)
     * @returns {void}
     */
    doFinal(chain) {
      // Pad remaining block with zeros
      for (let i = this.currentOffset; i < this.blockSize; i++) {
        this.currentBlock[i] = 0;
      }

      // Set final flag
      this._tweakWords[1] = OpCodes.OrN(this._tweakWords[1], T1_FINAL);
      this.processBlock(chain);
    }
  }

  // ===== SKEIN MAC HASHER =====

  class SkeinMACHasher {
    /**
     * @param {int32} macBits - MAC length in bits
     */
    constructor(macBits) {
      /** @type {int32} */
      this._macBits = macBits;
      /** @type {int32} */
      this.blockSize = 64; // Skein-512 uses 64-byte blocks
      /** @type {BigInt[]} */
      this._chainWords = zeroWords64(8); // 8 x 64-bit state
      /** @type {SkeinUBI} */
      this.ubi = new SkeinUBI(this.blockSize);
      /** @type {uint8[]} */
      this.key = null;

      // Initialize chain to zeros (will process KEY block first)
      for (let i = 0; i < 8; i++) {
        this._chainWords[i] = 0n;
      }
    }

    /**
     * @param {uint8[]} keyBytes - Key bytes, or null for none
     * @returns {void}
     */
    setKey(keyBytes) {
      if (keyBytes) this.key = keyBytes.slice();
      else this.key = null;
    }

    /**
     * Process the key and configuration blocks and start the message
     * @returns {void}
     */
    init() {
      // Reset chain to zeros
      for (let i = 0; i < 8; i++) {
        this._chainWords[i] = 0n;
      }

      // Process KEY block first (this is what makes it MAC mode)
      if (this.key) {
        this.ubi.reset(PARAM_TYPE_KEY);
        this.ubi.update(this.key, 0, this.key.length, this._chainWords);
        this.ubi.doFinal(this._chainWords);
      }

      // Process configuration block
      this.processConfig();

      // Reset UBI for MESSAGE blocks
      this.ubi.reset(PARAM_TYPE_MESSAGE);
    }

    /**
     * Process the configuration block
     * @returns {void}
     */
    processConfig() {
      // Configuration block: "SHA3" (4 bytes) + version (2 bytes) + reserved (2 bytes) + output length (8 bytes)
      const config = OpCodes.CreateArray(32, 0);
      config[0] = 0x53; // 'S'
      config[1] = 0x48; // 'H'
      config[2] = 0x41; // 'A'
      config[3] = 0x33; // '3'
      config[4] = 1;    // Version 1
      config[5] = 0;    // Version (MSB)

      // Output length in bits (little-endian 64-bit)
      const lengthBytes = OpCodes.EncodeMsgLength64LE(this._macBits);
      for (let i = 0; i < 8; i++) {
        config[8 + i] = lengthBytes[i];
      }

      this.ubi.reset(PARAM_TYPE_CONFIG);
      this.ubi.update(config, 0, 32, this._chainWords);
      this.ubi.doFinal(this._chainWords);
    }

    /**
     * @param {uint8[]} data - Message bytes
     * @returns {void}
     */
    update(data) {
      this.ubi.update(data, 0, data.length, this._chainWords);
    }

    /**
     * Finish the message and run the output transformation
     * @returns {uint8[]} outputBits / 8 MAC bytes
     */
    finalize() {
      // Finalize message block
      this.ubi.doFinal(this._chainWords);

      // Output transformation
      const outputBytes = this._macBits / 8;
      const result = OpCodes.CreateArray(outputBytes, 0);

      const counter = OpCodes.CreateArray(8, 0); // Output counter starts at 0

      this.ubi.reset(PARAM_TYPE_OUTPUT);
      this.ubi.update(counter, 0, 8, this._chainWords);

      const outputWords = this._chainWords.slice(); // Copy chain before final
      this.ubi.doFinal(outputWords);

      // Convert 64-bit words to bytes (little-endian)
      const wordsNeeded = Math.ceil(outputBytes / 8);
      for (let i = 0; i < wordsNeeded; i++) {
        const w = outputWords[i];
        const bytesToWrite = Math.min(8, outputBytes - i * 8);
        for (let j = 0; j < bytesToWrite; j++) {
          /** @type {uint8} */
          const b = Number(OpCodes.AndN(OpCodes.ShiftRn(w, j * 8), 0xFFn));
          result[i * 8 + j] = b;
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
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.SupportedKeySizes = [new KeySize(1, 256, 1)]; // Variable key size (Skein supports arbitrary key lengths)
      this.SupportedOutputSizes = [new KeySize(64, 64, 1)]; // Default 512 bits, but supports variable

      this.documentation = [
        new LinkItem("The Skein Hash Function Family, Version 1.3", "https://www.schneier.com/wp-content/uploads/2015/01/skein.pdf"),
        new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project"),
        new LinkItem("Skein (hash function) Overview", "https://en.wikipedia.org/wiki/Skein_(hash_function)")
      ];

      this.references = [
        new LinkItem("Bouncy Castle SkeinMac", "https://github.com/bcgit/bc-lts-java/blob/main/core/src/main/java/org/bouncycastle/crypto/macs/SkeinMac.java"),
        new LinkItem("Skein3Fish Reference Implementation (C/Java/Go)", "https://github.com/wernerd/Skein3Fish")
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
          text: "Skein-512-MAC Official Test Vector - 96 bytes",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java",
          input: OpCodes.Hex8ToBytes("d3090c72167517f7c7ad82a70c2fd3f6443f608301591e598eadb195e8357135ba26fede2ee187417f816048d00fc23512737a2113709a77e4170c49a94b7fdff45ff579a72287743102e7766c35ca5abc5dfe2f63a1e726ce5fbd2926db03a2"),
          key: OpCodes.Hex8ToBytes("cb41f1706cde09651203c2d0efbaddf847a0d315cb2e53ff8bac41da0002672e"),
          expected: OpCodes.Hex8ToBytes("d10e3ba81855ac087fbf5a3bc1f99b27d05f98ba22441138026225d34a418b93fd9e8dfaf5120757451adabe050d0eb59d271b0fe1bbf04badbcf9ba25a8791b")
        },
        {
          text: "Skein-512-MAC Official Test Vector - 128 bytes, exactly two blocks",
          uri: "https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java",
          input: OpCodes.Hex8ToBytes("d3090c72167517f7c7ad82a70c2fd3f6443f608301591e598eadb195e8357135ba26fede2ee187417f816048d00fc23512737a2113709a77e4170c49a94b7fdff45ff579a72287743102e7766c35ca5abc5dfe2f63a1e726ce5fbd2926db03a2dd18b03fc1508a9aac45eb362440203a323e09edee6324ee2e37b4432c1867ed"),
          key: OpCodes.Hex8ToBytes("cb41f1706cde09651203c2d0efbaddf847a0d315cb2e53ff8bac41da0002672e920244c66e02d5f0dad3e94c42bb65f0d14157decf4105ef5609d5b0984457c1"),
          expected: OpCodes.Hex8ToBytes("04d8cddb0ad931d54d195899a094684344e902286037272890bce98a41813edc37a3cee190a693fcca613ee30049ce7ec2bdff9613f56778a13f8c28a21d167a")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - Unused: a MAC has no inverse
   * @returns {SkeinMAC512Instance} New MAC instance
   */

    CreateInstance(isInverse = false) {
      return new SkeinMAC512Instance(this, isInverse);
    }
  }

  /**
 * SkeinMAC512 instance implementing the Feed/Result pattern
 * @class
 * @extends {IMacInstance}
 */

  class SkeinMAC512Instance extends IMacInstance {
    /**
   * Initialize a Skein-512-MAC instance
   * @param {SkeinMAC512Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Unused: a MAC has no inverse
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {KeySize[]} */
      this._keySizes = algorithm.SupportedKeySizes;
      /** @type {uint8[]} */
      this._key = null;
      /** @type {int32} */
      this._outputSize = 64; // Default 512 bits
      /** @type {SkeinMACHasher} */
      this.hasher = null;
    }

    /**
   * Set the key
   * @param {uint8[]} keyBytes - Key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      // Validate against algorithm's SupportedKeySizes
      let isValidSize = false;
      for (let i = 0; i < this._keySizes.length; i++) {
        const ks = this._keySizes[i];
        if (keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize) isValidSize = true;
      }

      if (!isValidSize) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes");
      }

      this._key = keyBytes.slice();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]} Copy of key bytes or null
   */

    get key() {
      if (!this._key) return null;
      return this._key.slice();
    }

    /**
     * @param {int32} sizeBytes - MAC length in bytes
     */
    set outputSize(sizeBytes) {
      this._outputSize = sizeBytes;
    }

    /**
     * @returns {int32} MAC length in bytes
     */
    get outputSize() {
      return this._outputSize;
    }

    /**
   * Feed message bytes
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
   * Get the MAC of everything fed so far
   * @returns {uint8[]} MAC bytes
   * @throws {Error} If key not set
   */

    Result() {
      if (!this._key) throw new Error("Key not set");

      // Initialize hasher if not already done (empty message case)
      if (!this.hasher) {
        this.hasher = new SkeinMACHasher(this._outputSize * 8);
        this.hasher.setKey(this._key);
        this.hasher.init();
      }

      /** @type {uint8[]} */
      const mac = this.hasher.finalize();

      // Reset for next MAC operation
      this.hasher = null;

      return mac;
    }

    /**
     * One-shot MAC
     * @param {uint8[]} input - Message bytes
     * @param {uint8[]} key - Key, or null to keep the current one
     * @returns {uint8[]} MAC bytes
     */
    ProcessData(input, key) {
      if (key) this.key = key;
      if (!this._key) throw new Error("Key not set");

      this.hasher = new SkeinMACHasher(this._outputSize * 8);
      this.hasher.setKey(this._key);
      this.hasher.init();
      this.hasher.update(input);
      /** @type {uint8[]} */
      const mac = this.hasher.finalize();
      this.hasher = null;

      return mac;
    }

    /**
     * Drop any partial message
     * @returns {void}
     */
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
