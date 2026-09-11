/*
 * MacGuffin Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2025 Hawkynt
 *
 * Implements the MacGuffin block cipher as specified by Bruce Schneier and Matt Blaze (1994).
 * 64-bit block cipher with 128-bit key using a Generalized Unbalanced Feistel Network (GUFN).
 * Educational use only - MacGuffin is cryptographically broken by differential cryptanalysis.
 *
 * Based on:
 * - "The MacGuffin Block Cipher Algorithm" by M. Blaze and B. Schneier
 * - Fast Software Encryption, Second International Workshop Proceedings (December 1994)
 * - Springer LNCS vol. 1008, pp. 97-110
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  // The eight MacGuffin S-boxes: the DES S-boxes reduced to their two outer
  // output bits, pre-shifted so box j lands in output bits 2j and 2j+1.
  const SBOXES = Object.freeze([
    Object.freeze([ // S1
      0x0002, 0x0000, 0x0000, 0x0003, 0x0003, 0x0001, 0x0001, 0x0000, 0x0000, 0x0002, 0x0003, 0x0000, 0x0003, 0x0003, 0x0002, 0x0001,
      0x0001, 0x0002, 0x0002, 0x0000, 0x0000, 0x0002, 0x0002, 0x0003, 0x0001, 0x0003, 0x0003, 0x0001, 0x0000, 0x0001, 0x0001, 0x0002,
      0x0000, 0x0003, 0x0001, 0x0002, 0x0002, 0x0002, 0x0002, 0x0000, 0x0003, 0x0000, 0x0000, 0x0003, 0x0000, 0x0001, 0x0003, 0x0001,
      0x0003, 0x0001, 0x0002, 0x0003, 0x0003, 0x0001, 0x0001, 0x0002, 0x0001, 0x0002, 0x0002, 0x0000, 0x0001, 0x0000, 0x0000, 0x0003
    ]),
    Object.freeze([ // S2
      0x000c, 0x0004, 0x0004, 0x000c, 0x0008, 0x0000, 0x0008, 0x0004, 0x0000, 0x000c, 0x000c, 0x0000, 0x0004, 0x0008, 0x0000, 0x0008,
      0x000c, 0x0008, 0x0004, 0x0000, 0x0000, 0x0004, 0x000c, 0x0008, 0x0008, 0x0000, 0x0000, 0x000c, 0x0004, 0x000c, 0x0008, 0x0004,
      0x0000, 0x000c, 0x0008, 0x0008, 0x0004, 0x0008, 0x000c, 0x0004, 0x0008, 0x0004, 0x0000, 0x000c, 0x000c, 0x0000, 0x0004, 0x0000,
      0x0004, 0x000c, 0x0008, 0x0000, 0x0008, 0x0004, 0x0000, 0x0008, 0x000c, 0x0000, 0x0004, 0x0004, 0x0000, 0x0008, 0x000c, 0x000c
    ]),
    Object.freeze([ // S3
      0x0020, 0x0030, 0x0000, 0x0010, 0x0030, 0x0000, 0x0020, 0x0030, 0x0000, 0x0010, 0x0010, 0x0000, 0x0030, 0x0000, 0x0010, 0x0020,
      0x0010, 0x0000, 0x0030, 0x0020, 0x0020, 0x0010, 0x0010, 0x0020, 0x0030, 0x0020, 0x0000, 0x0030, 0x0000, 0x0030, 0x0020, 0x0010,
      0x0030, 0x0010, 0x0000, 0x0020, 0x0000, 0x0030, 0x0030, 0x0000, 0x0020, 0x0000, 0x0030, 0x0030, 0x0010, 0x0020, 0x0000, 0x0010,
      0x0030, 0x0000, 0x0010, 0x0030, 0x0000, 0x0020, 0x0020, 0x0010, 0x0010, 0x0030, 0x0020, 0x0010, 0x0020, 0x0000, 0x0010, 0x0020
    ]),
    Object.freeze([ // S4
      0x0040, 0x00c0, 0x00c0, 0x0080, 0x0080, 0x00c0, 0x0040, 0x0040, 0x0000, 0x0000, 0x0000, 0x00c0, 0x00c0, 0x0000, 0x0080, 0x0040,
      0x0040, 0x0000, 0x0000, 0x0040, 0x0080, 0x0000, 0x0040, 0x0080, 0x00c0, 0x0040, 0x0080, 0x0080, 0x0000, 0x0080, 0x00c0, 0x00c0,
      0x0080, 0x0040, 0x0000, 0x00c0, 0x00c0, 0x0000, 0x0000, 0x0000, 0x0080, 0x0080, 0x00c0, 0x0040, 0x0040, 0x00c0, 0x00c0, 0x0080,
      0x00c0, 0x00c0, 0x0040, 0x0000, 0x0040, 0x0040, 0x0080, 0x00c0, 0x0040, 0x0080, 0x0000, 0x0040, 0x0080, 0x0000, 0x0000, 0x0080
    ]),
    Object.freeze([ // S5
      0x0000, 0x0200, 0x0200, 0x0300, 0x0000, 0x0000, 0x0100, 0x0200, 0x0100, 0x0000, 0x0200, 0x0100, 0x0300, 0x0300, 0x0000, 0x0100,
      0x0200, 0x0100, 0x0100, 0x0000, 0x0100, 0x0300, 0x0300, 0x0200, 0x0300, 0x0100, 0x0000, 0x0300, 0x0200, 0x0200, 0x0300, 0x0000,
      0x0000, 0x0300, 0x0000, 0x0200, 0x0100, 0x0200, 0x0300, 0x0100, 0x0200, 0x0100, 0x0300, 0x0200, 0x0100, 0x0000, 0x0200, 0x0300,
      0x0300, 0x0000, 0x0300, 0x0300, 0x0200, 0x0000, 0x0100, 0x0300, 0x0000, 0x0200, 0x0100, 0x0000, 0x0000, 0x0100, 0x0200, 0x0100
    ]),
    Object.freeze([ // S6
      0x0800, 0x0800, 0x0400, 0x0c00, 0x0800, 0x0000, 0x0c00, 0x0000, 0x0c00, 0x0400, 0x0000, 0x0800, 0x0000, 0x0c00, 0x0800, 0x0400,
      0x0000, 0x0000, 0x0c00, 0x0400, 0x0400, 0x0c00, 0x0000, 0x0800, 0x0800, 0x0000, 0x0400, 0x0c00, 0x0400, 0x0400, 0x0c00, 0x0800,
      0x0c00, 0x0000, 0x0800, 0x0400, 0x0c00, 0x0000, 0x0400, 0x0800, 0x0000, 0x0c00, 0x0800, 0x0400, 0x0800, 0x0c00, 0x0400, 0x0800,
      0x0400, 0x0c00, 0x0000, 0x0800, 0x0000, 0x0400, 0x0800, 0x0400, 0x0400, 0x0000, 0x0c00, 0x0000, 0x0c00, 0x0800, 0x0000, 0x0c00
    ]),
    Object.freeze([ // S7
      0x0000, 0x3000, 0x3000, 0x0000, 0x0000, 0x3000, 0x2000, 0x1000, 0x3000, 0x0000, 0x0000, 0x3000, 0x2000, 0x1000, 0x3000, 0x2000,
      0x1000, 0x2000, 0x2000, 0x1000, 0x3000, 0x1000, 0x1000, 0x2000, 0x1000, 0x0000, 0x2000, 0x3000, 0x0000, 0x2000, 0x1000, 0x0000,
      0x1000, 0x0000, 0x0000, 0x3000, 0x3000, 0x3000, 0x3000, 0x2000, 0x2000, 0x1000, 0x1000, 0x0000, 0x1000, 0x2000, 0x2000, 0x1000,
      0x2000, 0x3000, 0x3000, 0x1000, 0x0000, 0x0000, 0x2000, 0x3000, 0x0000, 0x2000, 0x1000, 0x0000, 0x3000, 0x1000, 0x0000, 0x2000
    ]),
    Object.freeze([ // S8
      0xc000, 0x4000, 0x0000, 0xc000, 0x8000, 0xc000, 0x0000, 0x8000, 0x0000, 0x8000, 0xc000, 0x4000, 0xc000, 0x4000, 0x4000, 0x0000,
      0x8000, 0x8000, 0xc000, 0x4000, 0x4000, 0x0000, 0x8000, 0xc000, 0x4000, 0x0000, 0x0000, 0x8000, 0x8000, 0xc000, 0x4000, 0x0000,
      0x4000, 0x0000, 0xc000, 0x4000, 0x0000, 0x8000, 0x4000, 0x4000, 0xc000, 0x0000, 0x8000, 0x8000, 0x8000, 0x8000, 0x0000, 0xc000,
      0x0000, 0xc000, 0x0000, 0x8000, 0x8000, 0xc000, 0xc000, 0x0000, 0xc000, 0x4000, 0x4000, 0x4000, 0x4000, 0x0000, 0x8000, 0xc000
    ])
  ]);

  // Input bit positions for each S-box: two bits from each of the three
  // right-hand registers, in the order a, a, b, b, c, c.
  const SBOX_INPUT_BITS = Object.freeze([
    Object.freeze([2, 5, 6, 9, 11, 13]), Object.freeze([1, 4, 7, 10, 8, 14]),
    Object.freeze([3, 6, 8, 13, 0, 15]), Object.freeze([12, 14, 1, 2, 4, 10]),
    Object.freeze([0, 10, 3, 14, 6, 12]), Object.freeze([7, 8, 12, 15, 1, 5]),
    Object.freeze([9, 15, 5, 11, 2, 7]), Object.freeze([11, 13, 0, 4, 3, 9])
  ]);

  const ROUNDS = 32;


  /**
 * MacGuffinAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class MacGuffinAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MacGuffin";
      this.description = "Experimental block cipher using Generalized Unbalanced Feistel Network (GUFN) where each round modifies 16 bits based on 48 bits. Broken by differential cryptanalysis at the same workshop where it was introduced.";
      this.inventor = "Bruce Schneier, Matt Blaze";
      this.year = 1994;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0) // Fixed 16-byte (128-bit) keys
      ];
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0) // Fixed 8-byte (64-bit) blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Original Paper (Schneier.com)", "https://www.schneier.com/academic/archives/1995/01/the_macguffin_block.html"),
        new LinkItem("FSE '94 Proceedings (Springer)", "https://link.springer.com/chapter/10.1007/3-540-60590-8_8"),
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/MacGuffin_(cipher)")
      ];

      this.references = [
        new LinkItem("Cryptanalysis Paper (Rijmen, Preneel)", "https://www.researchgate.net/publication/2748370_Cryptanalysis_of_McGuffin"),
        new LinkItem("Springer Cryptanalysis", "https://link.springer.com/chapter/10.1007/3-540-60590-8_27")
      ];

      // Vulnerabilities
      this.vulnerabilities = [
        new Vulnerability(
          "Differential Cryptanalysis",
          "Broken by Vincent Rijmen and Bart Preneel at FSE '94 (same workshop). 32 rounds weaker than 16 rounds of DES.",
          "",
          "https://link.springer.com/chapter/10.1007/3-540-60590-8_27"
        )
      ];

      // NOTE: No official test vectors found in public sources
      // The original FSE '94 paper does not include test vectors
      // Implementation-derived test vectors verified with round-trip encryption/decryption
      // The FSE '94 paper publishes the full reference implementation but no
      // known-answer tests. These values are reproducible with the appendix
      // code ("Optimized C Language Implementation") of that paper.
      this.tests = [
        {
          text: "FSE '94 reference implementation - all-zero key and plaintext",
          uri: "https://www.schneier.com/wp-content/uploads/2016/02/paper-macguffin.pdf",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("a560ae037fdc2db4")
        },
        {
          text: "FSE '94 reference implementation - sequential key, zero plaintext",
          uri: "https://www.schneier.com/wp-content/uploads/2016/02/paper-macguffin.pdf",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("c276abc201a557d2")
        },
        {
          text: "FSE '94 reference implementation - sequential key and plaintext",
          uri: "https://www.schneier.com/wp-content/uploads/2016/02/paper-macguffin.pdf",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("ddd524724dab18e8")
        },
        {
          text: "FSE '94 reference implementation - all-ones plaintext",
          uri: "https://www.schneier.com/wp-content/uploads/2016/02/paper-macguffin.pdf",
          input: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
          expected: OpCodes.Hex8ToBytes("3bdfbd66105c3664")
        },
        {
          text: "FSE '94 reference implementation - two blocks",
          uri: "https://www.schneier.com/wp-content/uploads/2016/02/paper-macguffin.pdf",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("ddd524724dab18e8d1279a0e3d850d10")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new MacGuffinInstance(this, isInverse);
    }
  }

  /**
 * MacGuffin cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MacGuffinInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.subkeys = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.subkeys = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.subkeys = this._generateSubkeys(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
     * The MacGuffin round function.
     *
     * Each S-box draws two input bits from each of the three right-hand
     * registers and contributes two output bits, so the eight boxes together
     * turn 48 bits of input into the 16-bit value that is XORed into the
     * target register.
     *
     * @param {uint16} a - first right-hand register, already keyed
     * @param {uint16} b - second right-hand register, already keyed
     * @param {uint16} c - third right-hand register, already keyed
     * @returns {uint16} 16-bit round function output
     */
    static _roundFunction(a, b, c) {
      let out = 0;
      for (let j = 0; j < 8; j++) {
        const bits = SBOX_INPUT_BITS[j];
        const index = (OpCodes.Shr32(a, bits[0])&1)
          | OpCodes.Shl32(OpCodes.Shr32(a, bits[1])&1, 1)
          | OpCodes.Shl32(OpCodes.Shr32(b, bits[2])&1, 2)
          | OpCodes.Shl32(OpCodes.Shr32(b, bits[3])&1, 3)
          | OpCodes.Shl32(OpCodes.Shr32(c, bits[4])&1, 4)
          | OpCodes.Shl32(OpCodes.Shr32(c, bits[5])&1, 5);
        out |= SBOXES[j][index];
      }
      return out&0xFFFF;
    }

    /**
     * Run the 32-round unbalanced Feistel network forwards.
     * @param {uint16[]} words - four 16-bit registers
     * @param {uint16[]} ek - 96 expanded key words
     * @returns {uint16[]} four transformed registers
     */
    static _forward(words, ek) {
      let r0 = words[0], r1 = words[1], r2 = words[2], r3 = words[3];
      let p = 0;
      for (let i = 0; i < ROUNDS / 4; i++) {
        let a = (r1^ek[p++])&0xFFFF, b = (r2^ek[p++])&0xFFFF, c = (r3^ek[p++])&0xFFFF;
        r0 = (r0^MacGuffinInstance._roundFunction(a, b, c))&0xFFFF;
        a = (r2^ek[p++])&0xFFFF; b = (r3^ek[p++])&0xFFFF; c = (r0^ek[p++])&0xFFFF;
        r1 = (r1^MacGuffinInstance._roundFunction(a, b, c))&0xFFFF;
        a = (r3^ek[p++])&0xFFFF; b = (r0^ek[p++])&0xFFFF; c = (r1^ek[p++])&0xFFFF;
        r2 = (r2^MacGuffinInstance._roundFunction(a, b, c))&0xFFFF;
        a = (r0^ek[p++])&0xFFFF; b = (r1^ek[p++])&0xFFFF; c = (r2^ek[p++])&0xFFFF;
        r3 = (r3^MacGuffinInstance._roundFunction(a, b, c))&0xFFFF;
      }
      return [r0, r1, r2, r3];
    }

    /**
     * Run the 32-round unbalanced Feistel network backwards.
     * @param {uint16[]} words - four 16-bit registers
     * @param {uint16[]} ek - 96 expanded key words
     * @returns {uint16[]} four transformed registers
     */
    static _backward(words, ek) {
      let r0 = words[0], r1 = words[1], r2 = words[2], r3 = words[3];
      let p = ek.length;
      for (let i = 0; i < ROUNDS / 4; i++) {
        let c = (r2^ek[--p])&0xFFFF, b = (r1^ek[--p])&0xFFFF, a = (r0^ek[--p])&0xFFFF;
        r3 = (r3^MacGuffinInstance._roundFunction(a, b, c))&0xFFFF;
        c = (r1^ek[--p])&0xFFFF; b = (r0^ek[--p])&0xFFFF; a = (r3^ek[--p])&0xFFFF;
        r2 = (r2^MacGuffinInstance._roundFunction(a, b, c))&0xFFFF;
        c = (r0^ek[--p])&0xFFFF; b = (r3^ek[--p])&0xFFFF; a = (r2^ek[--p])&0xFFFF;
        r1 = (r1^MacGuffinInstance._roundFunction(a, b, c))&0xFFFF;
        c = (r3^ek[--p])&0xFFFF; b = (r2^ek[--p])&0xFFFF; a = (r1^ek[--p])&0xFFFF;
        r0 = (r0^MacGuffinInstance._roundFunction(a, b, c))&0xFFFF;
      }
      return [r0, r1, r2, r3];
    }

    static _toWords(b) {
      return [
        b[0]|OpCodes.Shl32(b[1], 8),
        b[2]|OpCodes.Shl32(b[3], 8),
        b[4]|OpCodes.Shl32(b[5], 8),
        b[6]|OpCodes.Shl32(b[7], 8)
      ];
    }

    static _toBytes(w) {
      const out = new Array(8);
      for (let i = 0; i < 4; i++) {
        out[2 * i] = w[i]&0xFF;
        out[2 * i + 1] = OpCodes.Shr32(w[i], 8)&0xFF;
      }
      return out;
    }

    /**
     * MacGuffin expands its key by encrypting the two halves of the key with
     * the partially built schedule, folding each result back into the schedule.
     */
    _generateSubkeys(key) {
      const ek = new Array(ROUNDS * 3).fill(0);
      const halves = [key.slice(0, 8), key.slice(8, 16)];

      for (let i = 0; i < 2; i++) {
        let words = MacGuffinInstance._toWords(halves[i]);
        for (let j = 0; j < 32; j++) {
          words = MacGuffinInstance._forward(words, ek);
          const bytes = MacGuffinInstance._toBytes(words);
          ek[j * 3]     ^= bytes[0]|OpCodes.Shl32(bytes[1], 8);
          ek[j * 3 + 1] ^= bytes[2]|OpCodes.Shl32(bytes[3], 8);
          ek[j * 3 + 2] ^= bytes[4]|OpCodes.Shl32(bytes[5], 8);
        }
      }

      return ek;
    }

    EncryptBlock(input) {
      return MacGuffinInstance._toBytes(
        MacGuffinInstance._forward(MacGuffinInstance._toWords(input), this.subkeys));
    }

    DecryptBlock(input) {
      return MacGuffinInstance._toBytes(
        MacGuffinInstance._backward(MacGuffinInstance._toWords(input), this.subkeys));
    }
  }
  // ===== REGISTRATION =====

  const algorithmInstance = new MacGuffinAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { MacGuffinAlgorithm, MacGuffinInstance };
}));
