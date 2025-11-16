/*
 * Kuznyechik (GOST R 34.12-2015) - Russian Federal Block Cipher Standard
 * Professional implementation following RFC 7801 specification
 * (c)2006-2025 Hawkynt
 *
 * Kuznyechik ("Grasshopper" in Russian) is a symmetric block cipher with a
 * block length of 128 bits and a key length of 256 bits. Developed by the
 * Russian Federal Security Service's Center for Information Protection and
 * Special Communications with participation from InfoTeCS JSC.
 *
 * Approved by Decree #749 of the Russian Federal Agency on Technical
 * Regulating and Metrology on June 19, 2015. Standardized in RFC 7801.
 *
 * Security: Designed to replace the older GOST 28147-89 cipher.
 * Structure: SP-network with 10 rounds using non-linear S-box substitution
 *            and linear transformation L based on Galois Field arithmetic.
 *
 * Reference: https://datatracker.ietf.org/doc/html/rfc7801
 * Standard: GOST R 34.12-2015
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Pi substitution (S-box) from RFC 7801 Section 4.1
  const SBOX = new Uint8Array([
    0xFC, 0xEE, 0xDD, 0x11, 0xCF, 0x6E, 0x31, 0x16, 0xFB, 0xC4, 0xFA, 0xDA, 0x23, 0xC5, 0x04, 0x4D,
    0xE9, 0x77, 0xF0, 0xDB, 0x93, 0x2E, 0x99, 0xBA, 0x17, 0x36, 0xF1, 0xBB, 0x14, 0xCD, 0x5F, 0xC1,
    0xF9, 0x18, 0x65, 0x5A, 0xE2, 0x5C, 0xEF, 0x21, 0x81, 0x1C, 0x3C, 0x42, 0x8B, 0x01, 0x8E, 0x4F,
    0x05, 0x84, 0x02, 0xAE, 0xE3, 0x6A, 0x8F, 0xA0, 0x06, 0x0B, 0xED, 0x98, 0x7F, 0xD4, 0xD3, 0x1F,
    0xEB, 0x34, 0x2C, 0x51, 0xEA, 0xC8, 0x48, 0xAB, 0xF2, 0x2A, 0x68, 0xA2, 0xFD, 0x3A, 0xCE, 0xCC,
    0xB5, 0x70, 0x0E, 0x56, 0x08, 0x0C, 0x76, 0x12, 0xBF, 0x72, 0x13, 0x47, 0x9C, 0xB7, 0x5D, 0x87,
    0x15, 0xA1, 0x96, 0x29, 0x10, 0x7B, 0x9A, 0xC7, 0xF3, 0x91, 0x78, 0x6F, 0x9D, 0x9E, 0xB2, 0xB1,
    0x32, 0x75, 0x19, 0x3D, 0xFF, 0x35, 0x8A, 0x7E, 0x6D, 0x54, 0xC6, 0x80, 0xC3, 0xBD, 0x0D, 0x57,
    0xDF, 0xF5, 0x24, 0xA9, 0x3E, 0xA8, 0x43, 0xC9, 0xD7, 0x79, 0xD6, 0xF6, 0x7C, 0x22, 0xB9, 0x03,
    0xE0, 0x0F, 0xEC, 0xDE, 0x7A, 0x94, 0xB0, 0xBC, 0xDC, 0xE8, 0x28, 0x50, 0x4E, 0x33, 0x0A, 0x4A,
    0xA7, 0x97, 0x60, 0x73, 0x1E, 0x00, 0x62, 0x44, 0x1A, 0xB8, 0x38, 0x82, 0x64, 0x9F, 0x26, 0x41,
    0xAD, 0x45, 0x46, 0x92, 0x27, 0x5E, 0x55, 0x2F, 0x8C, 0xA3, 0xA5, 0x7D, 0x69, 0xD5, 0x95, 0x3B,
    0x07, 0x58, 0xB3, 0x40, 0x86, 0xAC, 0x1D, 0xF7, 0x30, 0x37, 0x6B, 0xE4, 0x88, 0xD9, 0xE7, 0x89,
    0xE1, 0x1B, 0x83, 0x49, 0x4C, 0x3F, 0xF8, 0xFE, 0x8D, 0x53, 0xAA, 0x90, 0xCA, 0xD8, 0x85, 0x61,
    0x20, 0x71, 0x67, 0xA4, 0x2D, 0x2B, 0x09, 0x5B, 0xCB, 0x9B, 0x25, 0xD0, 0xBE, 0xE5, 0x6C, 0x52,
    0x59, 0xA6, 0x74, 0xD2, 0xE6, 0xF4, 0xB4, 0xC0, 0xD1, 0x66, 0xAF, 0xC2, 0x39, 0x4B, 0x63, 0xB6
  ]);

  // Inverse Pi substitution (S-box inverse)
  const INV_SBOX = new Uint8Array(256);
  (function() {
    for (let i = 0; i < 256; ++i) {
      INV_SBOX[SBOX[i]] = i;
    }
  })();

  // Linear transformation multiplication constants from RFC 7801 Section 4.2
  const L_COEFFS = new Uint8Array([
    148, 32, 133, 16, 194, 192, 1, 251, 1, 192, 194, 16, 133, 32, 148, 1
  ]);

  // GF(2^8) multiplication with irreducible polynomial 0x1C3 (x^8 + x^7 + x^6 + x + 1)
  function gfMul(a, b) {
    let result = 0;
    for (let i = 0; i < 8; ++i) {
      if (b & 1) result ^= a;
      const high_bit_set = a & 0x80;
      a <<= 1;
      if (high_bit_set) a ^= 0xC3; // Reduction modulo 0x1C3
      b >>= 1;
    }
    return result & 0xFF;
  }

  // Linear transformation l: (V_8)^16 -> V_8 from RFC 7801 Section 4.2
  function linearTransformL(block) {
    let result = 0;
    for (let i = 0; i < 16; ++i) {
      result ^= gfMul(block[i], L_COEFFS[i]);
    }
    return result;
  }

  // R transformation from RFC 7801 Section 4.2: R(a_15,...,a_0) = (l(a) ⊕ a_15, a_15, a_14, ..., a_1)
  // Input:  [a_15, a_14, ..., a_1, a_0] at positions [0, 1, ..., 14, 15]
  // Output: [l⊕a_15, a_15, a_14, ..., a_1] at positions [0, 1, 2, ..., 15]
  function transformR(inputBlock) {
    const lValue = linearTransformL(inputBlock);
    const result = new Uint8Array(16);

    // out[0] = l ⊕ a_15
    result[0] = lValue ^ inputBlock[0];

    // out[1] = a_15, out[2] = a_14, ..., out[15] = a_1
    for (let i = 1; i < 16; ++i) {
      result[i] = inputBlock[i - 1];
    }

    return result;
  }

  // Linear transformation L: (V_8)^16 -> (V_8)^16 is R applied 16 times
  function transformL(inputBlock) {
    let block = new Uint8Array(inputBlock);

    // Apply R transformation 16 times
    for (let i = 0; i < 16; ++i) {
      block = transformR(block);
    }

    return block;
  }

  // Inverse R transformation: R^{-1}
  function invTransformR(inputBlock) {
    const result = new Uint8Array(16);

    // Reconstruct: out[0..14] = input[1..15]
    for (let i = 0; i < 15; ++i) {
      result[i] = inputBlock[i + 1];
    }

    // Compute out[15] such that l(result) = input[0] ⊕ input[1]
    // Since L_COEFFS[15] = 1, we have:
    // l(result) = sum(result[i] * L_COEFFS[i]) for i=0..15
    //           = sum(result[i] * L_COEFFS[i]) for i=0..14 + result[15] * 1
    // So: result[15] = input[0] ⊕ input[1] ⊕ sum(result[i] * L_COEFFS[i]) for i=0..14

    let partialL = 0;
    for (let i = 0; i < 15; ++i) {
      partialL ^= gfMul(result[i], L_COEFFS[i]);
    }

    result[15] = (inputBlock[0] ^ inputBlock[1] ^ partialL) & 0xFF;

    return result;
  }

  // Inverse linear transformation L^{-1} - apply R^{-1} 16 times
  function invTransformL(inputBlock) {
    let block = new Uint8Array(inputBlock);

    for (let i = 0; i < 16; ++i) {
      block = invTransformR(block);
    }

    return block;
  }

  // Substitution transformation S (apply S-box to all bytes)
  function transformS(block) {
    const result = new Uint8Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = SBOX[block[i]];
    }
    return result;
  }

  // Inverse substitution transformation S^{-1}
  function invTransformS(block) {
    const result = new Uint8Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = INV_SBOX[block[i]];
    }
    return result;
  }

  // XOR transformation X[k]
  function transformX(block, key) {
    const result = new Uint8Array(16);
    for (let i = 0; i < 16; ++i) {
      result[i] = block[i] ^ key[i];
    }
    return result;
  }

  // Feistel round constant C_i from RFC 7801 Section 4.3
  function getRoundConstant(i) {
    const result = new Uint8Array(16);
    result[15] = i; // Vec_128(i)
    return transformL(result);
  }

  // LSX transformation: L ∘ S ∘ X[k]
  function transformLSX(block, key) {
    let result = transformX(block, key);
    result = transformS(result);
    result = transformL(result);
    return result;
  }

  // Feistel function F[C](a,b) = (LSX[C](a) ⊕ b, a) from RFC 7801 Section 4.3
  function feistelF(a, b, c) {
    const lsxResult = transformLSX(a, c);
    const newA = transformX(lsxResult, b); // LSX[C](a) ⊕ b
    const newB = a; // a
    return [newA, newB];
  }

  // Key schedule from RFC 7801 Section 4.3 and 4.4
  // Following Botan's implementation for correctness
  function keyExpansion(key) {
    const keys = new Array(10);

    // Start with the 256-bit key split into two 128-bit halves
    let k1 = new Uint8Array(key.slice(0, 16));   // First 128 bits
    let k2 = new Uint8Array(key.slice(16, 32));  // Second 128 bits

    // Store initial keys
    keys[0] = new Uint8Array(k1);
    keys[1] = new Uint8Array(k2);

    // Perform 4 iterations, each generating 2 new key pairs
    for (let i = 0; i < 4; ++i) {
      // Each iteration performs 8 Feistel rounds (4 pairs)
      for (let r = 0; r < 8; r += 2) {
        // First Feistel round
        const c1 = getRoundConstant(8 * i + r + 1);
        let temp1 = transformLSX(k1, c1);
        temp1 = transformX(temp1, k2);

        const newK1 = temp1;
        const newK2 = k1;

        // Second Feistel round
        const c2 = getRoundConstant(8 * i + r + 2);
        let temp2 = transformLSX(newK1, c2);
        temp2 = transformX(temp2, newK2);

        k1 = temp2;
        k2 = newK1;
      }

      // Store keys after this iteration
      keys[2 * (i + 1)] = new Uint8Array(k1);
      keys[2 * (i + 1) + 1] = new Uint8Array(k2);
    }

    return keys;
  }

  /**
 * Kuznyechik - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class Kuznyechik extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Kuznyechik";
      this.description = "Russian Federal block cipher standard GOST R 34.12-2015 with 128-bit blocks and 256-bit keys. Designed to replace GOST 28147-89, featuring an SP-network structure with 10 rounds. Standardized in RFC 7801.";
      this.inventor = "Russian Federal Security Service";
      this.year = 2015;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 1)]; // 256-bit keys only
      this.SupportedBlockSizes = [new KeySize(16, 16, 1)]; // 128-bit blocks only

      this.documentation = [
        new LinkItem("RFC 7801 - GOST R 34.12-2015 Kuznyechik Specification", "https://datatracker.ietf.org/doc/html/rfc7801"),
        new LinkItem("GOST R 34.12-2015 Standard", "https://tc26.ru/en/standards/"),
        new LinkItem("Wikipedia - Kuznyechik", "https://en.wikipedia.org/wiki/Kuznyechik")
      ];

      // Official test vectors from RFC 7801 Sections 5.4, 5.5, 5.6
      this.tests = [
        {
          text: "RFC 7801 Section 5.5 - Encryption Test Vector",
          uri: "https://datatracker.ietf.org/doc/html/rfc7801#section-5.5",
          input: OpCodes.Hex8ToBytes("1122334455667700ffeeddccbbaa9988"),
          key: OpCodes.Hex8ToBytes("8899aabbccddeeff0011223344556677fedcba98765432100123456789abcdef"),
          expected: OpCodes.Hex8ToBytes("7f679d90bebc24305a468d42b9d4edcd")
        },
        {
          text: "RFC 7801 Section 5.6 - Decryption Test Vector",
          uri: "https://datatracker.ietf.org/doc/html/rfc7801#section-5.6",
          input: OpCodes.Hex8ToBytes("7f679d90bebc24305a468d42b9d4edcd"),
          key: OpCodes.Hex8ToBytes("8899aabbccddeeff0011223344556677fedcba98765432100123456789abcdef"),
          expected: OpCodes.Hex8ToBytes("1122334455667700ffeeddccbbaa9988"),
          inverse: true
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new KuznyechikInstance(this, isInverse);
    }
  }

  /**
 * Kuznyechik cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class KuznyechikInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._roundKeys = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this._roundKeys = null;
        return;
      }

      if (keyBytes.length !== 32) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 32 bytes)`);
      }

      this._key = [...keyBytes];
      this._roundKeys = keyExpansion(new Uint8Array(this._key));
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
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % 16 !== 0) {
        throw new Error(`Invalid input length: ${this.inputBuffer.length} bytes (must be multiple of 16)`);
      }

      const output = [];
      const numBlocks = this.inputBuffer.length / 16;

      for (let b = 0; b < numBlocks; ++b) {
        const block = new Uint8Array(this.inputBuffer.slice(b * 16, (b + 1) * 16));
        const encrypted = this.isInverse ? this.decryptBlock(block) : this.encryptBlock(block);
        output.push(...encrypted);
      }

      this.inputBuffer = [];
      return output;
    }

    encryptBlock(block) {
      let state = new Uint8Array(block);

      // 9 rounds of X[K_i] ∘ L ∘ S
      for (let i = 0; i < 9; ++i) {
        state = transformX(state, this._roundKeys[i]);
        state = transformS(state);
        state = transformL(state);
      }

      // Final round: X[K_10]
      state = transformX(state, this._roundKeys[9]);

      return state;
    }

    decryptBlock(block) {
      let state = new Uint8Array(block);

      // Inverse final round: X[K_10]
      state = transformX(state, this._roundKeys[9]);

      // 9 inverse rounds of L^{-1} ∘ S^{-1} ∘ X[K_i]
      for (let i = 8; i >= 0; --i) {
        state = invTransformL(state);
        state = invTransformS(state);
        state = transformX(state, this._roundKeys[i]);
      }

      return state;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new Kuznyechik());

  return Kuznyechik;
}));
