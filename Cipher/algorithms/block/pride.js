/*
 * PRIDE - Block Cipher Focused on Linear Layer
 * Professional implementation following CRYPTO 2014 specification
 * (c)2006-2025 Hawkynt
 *
 * PRIDE is a 64-bit block cipher with 128-bit keys designed for
 * 8-bit microcontrollers. It uses FX construction with 20 rounds
 * focusing on an efficient linear layer.
 *
 * Published: CRYPTO 2014
 * Authors: Martin R. Albrecht, Benedikt Driessen, Elif Bilge Kavun,
 *          Gregor Leander, Christof Paar, Tolga Yalçın
 *
 * Reference: https://eprint.iacr.org/2014/453
 * Reference Implementation: https://github.com/obfusk/pypride
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
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  // S-box (4-bit to 4-bit substitution) - involution property
  /** @type {uint8[]} */
  const SBOX = [0x0, 0x4, 0x8, 0xF, 0x1, 0x5, 0xE, 0x9, 0x2, 0x7, 0xA, 0xC, 0xB, 0xD, 0x6, 0x3];

  // P-layer bit permutation: for i in range(16): for j in range(4): P[idx++] = i + j*16
  /** @type {int32[]} */
  const P = [];
  for (let i = 0; i < 16; ++i) {
    for (let j = 0; j < 4; ++j) {
      P.push(i + j * 16);
    }
  }

  /** @type {int32[]} */
  const P_INV = new Array(64);
  for (let i = 0; i < 64; ++i) {
    P_INV[P[i]] = i;
  }

  // Linear layer matrices L0, L1, L2, L3 (16x16 binary matrices)
  /** @type {uint16[]} */
  const L0 = [
    0b0000100010001000, 0b0000010001000100, 0b0000001000100010, 0b0000000100010001,
    0b1000000010001000, 0b0100000001000100, 0b0010000000100010, 0b0001000000010001,
    0b1000100000001000, 0b0100010000000100, 0b0010001000000010, 0b0001000100000001,
    0b1000100010000000, 0b0100010001000000, 0b0010001000100000, 0b0001000100010000
  ];

  /** @type {uint16[]} */
  const L1 = [
    0b1100000000010000, 0b0110000000001000, 0b0011000000000100, 0b0001100000000010,
    0b0000110000000001, 0b0000011010000000, 0b0000001101000000, 0b1000000100100000,
    0b1000000000011000, 0b0100000000001100, 0b0010000000000110, 0b0001000000000011,
    0b0000100010000001, 0b0000010011000000, 0b0000001001100000, 0b0000000100110000
  ];

  /** @type {uint16[]} */
  const L2 = [
    0b0000110000000001, 0b0000011010000000, 0b0000001101000000, 0b1000000100100000,
    0b1100000000010000, 0b0110000000001000, 0b0011000000000100, 0b0001100000000010,
    0b0000100010000001, 0b0000010011000000, 0b0000001001100000, 0b0000000100110000,
    0b1000000000011000, 0b0100000000001100, 0b0010000000000110, 0b0001000000000011
  ];

  /** @type {uint16[]} */
  const L3 = [
    0b1000100000001000, 0b0100010000000100, 0b0010001000000010, 0b0001000100000001,
    0b1000100010000000, 0b0100010001000000, 0b0010001000100000, 0b0001000100010000,
    0b0000100010001000, 0b0000010001000100, 0b0000001000100010, 0b0000000100010001,
    0b1000000010001000, 0b0100000001000100, 0b0010000000100010, 0b0001000000010001
  ];

  // Inverse matrices (L0 and L3 are self-inverse)
  // From pypride reference implementation
  /** @type {uint16[]} */
  const L1_INV = [
    0b0000001100000010, 0b1000000100000001, 0b1100000010000000, 0b0110000001000000,
    0b0011000000100000, 0b0001100000010000, 0b0000110000001000, 0b0000011000000100,
    0b0001000000011000, 0b0000100000001100, 0b0000010000000110, 0b0000001000000011,
    0b0000000110000001, 0b1000000011000000, 0b0100000001100000, 0b0010000000110000
  ];

  /** @type {uint16[]} */
  const L2_INV = [
    0b0011000000100000, 0b0001100000010000, 0b0000110000001000, 0b0000011000000100,
    0b0000001100000010, 0b1000000100000001, 0b1100000010000000, 0b0110000001000000,
    0b0000000110000001, 0b1000000011000000, 0b0100000001100000, 0b0010000000110000,
    0b0001000000011000, 0b0000100000001100, 0b0000010000000110, 0b0000001000000011
  ];

  // The 64-bit state is held as two 32-bit words [high, low]: bit n of the
  // state (n = 0 is the least significant) is bit n of low for n < 32 and
  // bit n - 32 of high otherwise.

  // Matrix multiplication in GF(2)
  // Matrix is 16x16, input and output are 16-bit values
  // Following pypride: row 0 -> bit 15 (MSB), row 15 -> bit 0 (LSB)
  /**
   * @param {uint16[]} matrix - 16 matrix rows
   * @param {uint32} input - 16-bit input
   * @returns {uint32} 16-bit output
   */
  function matrixMult(matrix, input) {
    /** @type {uint32} */
    let result = 0;
    for (let row = 0; row < 16; ++row) {
      const rowVal = matrix[row];
      // Count set bits in (rowVal AND input) - this is the dot product in GF(2)
      const dotProduct = OpCodes.And32(rowVal, input);
      // Count bits using Brian Kernighan's algorithm
      let bitCount = 0;
      let temp = dotProduct;
      while (temp) {
        temp = OpCodes.And32(temp, OpCodes.Sub32(temp, 1));  // Clear least significant bit
        ++bitCount;
      }
      if (bitCount % 2 === 1) {
        result = OpCodes.Or32(result, OpCodes.Shl32(1, 15 - row));  // MSB-first like pypride
      }
    }
    return result;
  }

  // Convert byte array to the 64-bit state (big-endian)
  /**
   * @param {uint8[]} bytes - 8 bytes
   * @returns {uint32[]} State [high, low]
   */
  function bytesToState(bytes) {
    return [
      OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]),
      OpCodes.Pack32BE(bytes[4], bytes[5], bytes[6], bytes[7])
    ];
  }

  // Convert the 64-bit state to a byte array (big-endian)
  /**
   * @param {uint32[]} state - State [high, low]
   * @returns {uint8[]} 8 bytes
   */
  function stateToBytes(state) {
    return OpCodes.Unpack32BE(state[0]).concat(OpCodes.Unpack32BE(state[1]));
  }

  /**
   * @param {uint32[]} a - State [high, low]
   * @param {uint32[]} b - State [high, low]
   * @returns {uint32[]} a XOR b
   */
  function xorState(a, b) {
    return [OpCodes.Xor32(a[0], b[0]), OpCodes.Xor32(a[1], b[1])];
  }

  // Apply bit permutation to the 64-bit state
  // Following pypride: state_[p[i]] = state[i]
  // Bit at input position i goes to output position p[i]
  /**
   * @param {uint32[]} state - State [high, low]
   * @param {int32[]} perm - Bit permutation
   * @returns {uint32[]} Permuted state
   */
  function applyPermutation(state, perm) {
    /** @type {uint32} */
    let high = 0;
    /** @type {uint32} */
    let low = 0;
    for (let i = 0; i < 64; ++i) {
      const bitValue = (i < 32)
        ? OpCodes.And32(OpCodes.Shr32(state[1], i), 1)
        : OpCodes.And32(OpCodes.Shr32(state[0], i - 32), 1);
      const outPos = perm[i];
      if (outPos < 32) low = OpCodes.Or32(low, OpCodes.Shl32(bitValue, outPos));
      else high = OpCodes.Or32(high, OpCodes.Shl32(bitValue, outPos - 32));
    }
    return [high, low];
  }

  // Apply S-box to every nibble of a 32-bit half of the state
  /**
   * @param {uint32} word - 32-bit half of the state
   * @returns {uint32} Substituted half
   */
  function applySboxWord(word) {
    /** @type {uint32} */
    let result = 0;
    for (let i = 0; i < 8; ++i) {
      const nibble = OpCodes.And32(OpCodes.Shr32(word, i * 4), 0xF);
      result = OpCodes.Or32(result, OpCodes.Shl32(SBOX[nibble], i * 4));
    }
    return result;
  }

  // Apply S-box to the 64-bit state
  /**
   * @param {uint32[]} state - State [high, low]
   * @returns {uint32[]} Substituted state
   */
  function applySbox(state) {
    return [applySboxWord(state[0]), applySboxWord(state[1])];
  }

  // Apply one 16x16 matrix per 16-bit segment: segment 0 (bits 0-15) uses
  // m0, ..., segment 3 (bits 48-63) uses m3
  /**
   * @param {uint32[]} state - State [high, low]
   * @param {uint16[]} m0 - Matrix for segment 0 (bits 0-15)
   * @param {uint16[]} m1 - Matrix for segment 1 (bits 16-31)
   * @param {uint16[]} m2 - Matrix for segment 2 (bits 32-47)
   * @param {uint16[]} m3 - Matrix for segment 3 (bits 48-63)
   * @returns {uint32[]} Transformed state
   */
  function applyMatrices(state, m0, m1, m2, m3) {
    const s0 = matrixMult(m0, OpCodes.And32(state[1], 0xFFFF));
    const s1 = matrixMult(m1, OpCodes.Shr32(state[1], 16));
    const s2 = matrixMult(m2, OpCodes.And32(state[0], 0xFFFF));
    const s3 = matrixMult(m3, OpCodes.Shr32(state[0], 16));
    return [OpCodes.Or32(OpCodes.Shl32(s3, 16), s2), OpCodes.Or32(OpCodes.Shl32(s1, 16), s0)];
  }

  // Apply linear layer L to the 64-bit state
  // Following pypride: L = diag(L3, L2, L1, L0) from LSB to MSB
  // Segment 0 (bits 0-15) uses L3, segment 1 uses L2, segment 2 uses L1, segment 3 uses L0
  /**
   * @param {uint32[]} state - State [high, low]
   * @returns {uint32[]} Transformed state
   */
  function linearLayer(state) {
    return applyMatrices(state, L3, L2, L1, L0);  // pypride order: L3, L2, L1, L0
  }

  // Apply inverse linear layer
  /**
   * @param {uint32[]} state - State [high, low]
   * @returns {uint32[]} Transformed state
   */
  function invLinearLayer(state) {
    // pypride order: L3_inv, L2_inv, L1_inv, L0_inv (L0 and L3 are self-inverse)
    return applyMatrices(state, L3, L2_INV, L1_INV, L0);
  }

  // Key schedule function g
  /**
   * @param {int32} x - Key byte
   * @param {int32} i - Round number
   * @param {int32} j - Constant index
   * @returns {int32} (x + m[j] * i) mod 256
   */
  function g(x, i, j) {
    /** @type {int32[]} */
    const m = [193, 165, 81, 197];
    return (x + m[j] * i) % 256;  // Modulo instead of bitwise AND
  }

  // Generate the 20 round keys from the second key half
  /**
   * @param {uint8[]} key - 16-byte key
   * @returns {uint8[][]} 20 round keys of 8 bytes
   */
  function generateRoundKeys(key) {
    const k1 = key.slice(8, 16);

    /** @type {uint8[][]} */
    const roundKeys = [];

    // Generate 20 round keys
    for (let i = 1; i <= 20; ++i) {
      /** @type {uint8[]} */
      const rk = new Array(8);
      for (let j = 0; j < 8; ++j) {
        if (j % 2 === 0) {
          rk[j] = k1[j];
        } else {
          rk[j] = g(k1[j], i, Math.floor(j / 2));
        }
      }
      roundKeys.push(rk);
    }

    return roundKeys;
  }

  /**
 * Pride - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class Pride extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "PRIDE";
      this.description = "Block cipher optimized for 8-bit microcontrollers with focus on efficient linear layer. 64-bit block size with 128-bit keys using FX construction with 20 rounds. Designed for resource-constrained IoT devices with emphasis on low latency.";
      this.inventor = "Martin R. Albrecht, Benedikt Driessen, Elif Bilge Kavun, Gregor Leander, Christof Paar, Tolga Yalçın";
      this.year = 2014;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Lightweight Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.DE;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedBlockSizes = [new KeySize(8, 8, 1)];

      this.documentation = [
        new LinkItem("PRIDE Specification (ePrint Archive)", "https://eprint.iacr.org/2014/453"),
        new LinkItem("CRYPTO 2014 Paper", "https://link.springer.com/chapter/10.1007/978-3-662-44371-2_2"),
        new LinkItem("pypride Reference Implementation", "https://github.com/obfusk/pypride")
      ];

      this.references = [
        new LinkItem("Differential Analysis on Block Cipher PRIDE", "https://eprint.iacr.org/2014/525"),
        new LinkItem("Cryptanalysis of Full PRIDE Block Cipher", "https://eprint.iacr.org/2014/987")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Related-key differential attack",
          "Full 20-round PRIDE is breakable under the related-key model using related-key differential characteristics derived from its key schedule",
          "Do not reuse related keys; treat as broken under the related-key model and educational-only"
        )
      ];

      // All five test vectors from the PRIDE specification, Appendix J.
      // The 16-byte key is the concatenation k0 || k1.
      this.tests = [
        {
          text: "PRIDE Test Vector #1 - specification Appendix J",
          uri: "https://eprint.iacr.org/2014/453.pdf",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("82b4109fcc70bd1f")
        },
        {
          text: "PRIDE Test Vector #2 - specification Appendix J",
          uri: "https://eprint.iacr.org/2014/453.pdf",
          input: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("d70e60680a17b956")
        },
        {
          text: "PRIDE Test Vector #3 - specification Appendix J",
          uri: "https://eprint.iacr.org/2014/453.pdf",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("ffffffffffffffff0000000000000000"),
          expected: OpCodes.Hex8ToBytes("28f19f97f5e846a9")
        },
        {
          text: "PRIDE Test Vector #4 - specification Appendix J",
          uri: "https://eprint.iacr.org/2014/453.pdf",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000ffffffffffffffff"),
          expected: OpCodes.Hex8ToBytes("d123ebaf368fce62")
        },
        {
          text: "PRIDE Test Vector #5 - specification Appendix J",
          uri: "https://eprint.iacr.org/2014/453.pdf",
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("0000000000000000fedcba9876543210"),
          expected: OpCodes.Hex8ToBytes("d1372929712d336e")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {PrideInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new PrideInstance(this, isInverse);
    }
  }

  /**
 * Pride cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PrideInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Pride} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._k0 = null;
      /** @type {uint8[][]|null} */
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
        this._k0 = null;
        this._roundKeys = null;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (expected 16 bytes)");
      }

      this._key = [...keyBytes];
      this._k0 = this._key.slice(0, 8);
      this._roundKeys = generateRoundKeys(this._key);
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
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % 8 !== 0) {
        throw new Error("Invalid input length: " + this.inputBuffer.length + " bytes (must be multiple of 8)");
      }

      /** @type {uint8[]} */
      const output = [];
      const numBlocks = this.inputBuffer.length / 8;

      for (let b = 0; b < numBlocks; ++b) {
        const block = this.inputBuffer.slice(b * 8, (b + 1) * 8);
        const processed = this.processBlock(block);
        for (let _i = 0; _i < processed.length; _i++) output.push(processed[_i]);
      }

      this.inputBuffer = [];
      return output;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    processBlock(block) {
      // Convert byte array to the state (big-endian)
      let state = bytesToState(block);
      const k0 = bytesToState(this._k0);

      if (this.isInverse) {
        // Decryption: reverse of encryption

        // 1. Apply P^{-1}
        state = applyPermutation(state, P_INV);

        // 2. XOR with k0 (whitening)
        state = xorState(state, k0);

        // 3. 20 rounds in reverse
        for (let r = 19; r >= 0; --r) {
          // S-box (involution, so same as forward)
          state = applySbox(state);

          // Round key XOR (apply P^{-1} to round key before XOR, following pypride)
          const rk = bytesToState(this._roundKeys[r]);
          state = xorState(state, applyPermutation(rk, P_INV));

          // If not last iteration (r > 0), apply P, L^{-1}, P^{-1}
          if (r > 0) {
            state = applyPermutation(state, P);
            state = invLinearLayer(state);
            state = applyPermutation(state, P_INV);
          }
        }

        // 4. XOR with k0 (whitening)
        state = xorState(state, k0);

        // 5. Apply P
        state = applyPermutation(state, P);

      } else {
        // Encryption following pypride reference

        // 1. Apply P^{-1} to message
        state = applyPermutation(state, P_INV);

        // 2. XOR with k0 (whitening)
        state = xorState(state, k0);

        // 3. 20 rounds
        for (let r = 0; r < 20; ++r) {
          // Round key XOR (apply P^{-1} to round key before XOR, following pypride)
          const rk = bytesToState(this._roundKeys[r]);
          state = xorState(state, applyPermutation(rk, P_INV));

          // S-box
          state = applySbox(state);

          // If not last round, apply P, L, P^{-1}
          if (r < 19) {
            state = applyPermutation(state, P);
            state = linearLayer(state);
            state = applyPermutation(state, P_INV);
          }
        }

        // 4. XOR with k0 (whitening)
        state = xorState(state, k0);

        // 5. Apply P
        state = applyPermutation(state, P);
      }

      // Convert the state back to a byte array (big-endian)
      return stateToBytes(state);
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new Pride());

  return Pride;
}));
