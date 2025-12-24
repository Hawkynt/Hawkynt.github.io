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
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize } = AlgorithmFramework;

  // S-box (4-bit to 4-bit substitution) - involution property
  const SBOX = [0x0, 0x4, 0x8, 0xF, 0x1, 0x5, 0xE, 0x9, 0x2, 0x7, 0xA, 0xC, 0xB, 0xD, 0x6, 0x3];

  // P-layer bit permutation: for i in range(16): for j in range(4): P[idx++] = i + j*16
  const P = [];
  for (let i = 0; i < 16; ++i) {
    for (let j = 0; j < 4; ++j) {
      P.push(i + j * 16);
    }
  }

  const P_INV = new Array(64);
  for (let i = 0; i < 64; ++i) {
    P_INV[P[i]] = i;
  }

  // Linear layer matrices L0, L1, L2, L3 (16x16 binary matrices)
  const L0 = [
    0b0000100010001000, 0b0000010001000100, 0b0000001000100010, 0b0000000100010001,
    0b1000000010001000, 0b0100000001000100, 0b0010000000100010, 0b0001000000010001,
    0b1000100000001000, 0b0100010000000100, 0b0010001000000010, 0b0001000100000001,
    0b1000100010000000, 0b0100010001000000, 0b0010001000100000, 0b0001000100010000
  ];

  const L1 = [
    0b1100000000010000, 0b0110000000001000, 0b0011000000000100, 0b0001100000000010,
    0b0000110000000001, 0b0000011010000000, 0b0000001101000000, 0b1000000100100000,
    0b1000000000011000, 0b0100000000001100, 0b0010000000000110, 0b0001000000000011,
    0b0000100010000001, 0b0000010011000000, 0b0000001001100000, 0b0000000100110000
  ];

  const L2 = [
    0b0000110000000001, 0b0000011010000000, 0b0000001101000000, 0b1000000100100000,
    0b1100000000010000, 0b0110000000001000, 0b0011000000000100, 0b0001100000000010,
    0b0000100010000001, 0b0000010011000000, 0b0000001001100000, 0b0000000100110000,
    0b1000000000011000, 0b0100000000001100, 0b0010000000000110, 0b0001000000000011
  ];

  const L3 = [
    0b1000100000001000, 0b0100010000000100, 0b0010001000000010, 0b0001000100000001,
    0b1000100010000000, 0b0100010001000000, 0b0010001000100000, 0b0001000100010000,
    0b0000100010001000, 0b0000010001000100, 0b0000001000100010, 0b0000000100010001,
    0b1000000010001000, 0b0100000001000100, 0b0010000000100010, 0b0001000000010001
  ];

  // Inverse matrices (L0 and L3 are self-inverse)
  // From pypride reference implementation
  const L1_INV = [
    0b0000001100000010, 0b1000000100000001, 0b1100000010000000, 0b0110000001000000,
    0b0011000000100000, 0b0001100000010000, 0b0000110000001000, 0b0000011000000100,
    0b0001000000011000, 0b0000100000001100, 0b0000010000000110, 0b0000001000000011,
    0b0000000110000001, 0b1000000011000000, 0b0100000001100000, 0b0010000000110000
  ];

  const L2_INV = [
    0b0011000000100000, 0b0001100000010000, 0b0000110000001000, 0b0000011000000100,
    0b0000001100000010, 0b1000000100000001, 0b1100000010000000, 0b0110000001000000,
    0b0000000110000001, 0b1000000011000000, 0b0100000001100000, 0b0010000000110000,
    0b0001000000011000, 0b0000100000001100, 0b0000010000000110, 0b0000001000000011
  ];

  // Matrix multiplication in GF(2)
  // Matrix is 16x16, input and output are 16-bit values
  // Following pypride: row 0 -> bit 15 (MSB), row 15 -> bit 0 (LSB)
  function matrixMult(matrix, input) {
    let result = 0;
    for (let row = 0; row < 16; ++row) {
      const rowVal = matrix[row];
      // Count set bits in (rowVal AND input) - this is the dot product in GF(2)
      const dotProduct = OpCodes.And32(rowVal, input);
      // Count bits using Brian Kernighan's algorithm
      let bitCount = 0;
      let temp = dotProduct;
      while (temp) {
        temp = OpCodes.And32(temp, temp - 1);  // Clear least significant bit
        ++bitCount;
      }
      if (bitCount % 2 === 1) {
        result = OpCodes.Or32(result, OpCodes.Shl32(1, 15 - row));  // MSB-first like pypride
      }
    }
    return result;
  }

  // Convert byte array to 64-bit BigInt (big-endian)
  function bytesToInt(bytes) {
    let result = 0n;
    for (let i = 0; i < 8; ++i) {
      result = (result << 8n) | BigInt(bytes[i]);
    }
    return result;
  }

  // Convert 64-bit BigInt to byte array (big-endian)
  function intToBytes(value) {
    // Manual unpacking since OpCodes.Unpack64BE doesn't support BigInt
    const result = new Array(8);
    for (let i = 7; i >= 0; --i) {
      result[i] = Number(value & 0xFFn);
      value >>= 8n;
    }
    return result;
  }

  // Apply bit permutation to 64-bit state (as BigInt)
  // Following pypride: state_[p[i]] = state[i]
  // Bit at input position i goes to output position p[i]
  function applyPermutation(state, perm) {
    let result = 0n;
    for (let i = 0; i < 64; ++i) {
      const bitValue = (state >> BigInt(i)) & 1n;
      const outPos = perm[i];
      result |= bitValue << BigInt(outPos);
    }
    return result;
  }

  // Apply S-box to 64-bit state (as BigInt)
  function applySbox(state) {
    let result = 0n;
    for (let i = 0; i < 16; ++i) {
      const nibble = Number((state >> BigInt(i * 4)) & 0xFn);
      const sboxed = SBOX[nibble];
      result |= BigInt(sboxed) << BigInt(i * 4);
    }
    return result;
  }

  // Apply linear layer L to 64-bit state (as BigInt)
  // Following pypride: L = diag(L3, L2, L1, L0) from LSB to MSB
  // Segment 0 (bits 0-15) uses L3, segment 1 uses L2, segment 2 uses L1, segment 3 uses L0
  function linearLayer(state) {
    let result = 0n;
    const matrices = [L3, L2, L1, L0];  // pypride order: L3, L2, L1, L0

    for (let seg = 0; seg < 4; ++seg) {
      // Extract 16-bit segment (4 nibbles)
      const input = Number((state >> BigInt(seg * 16)) & 0xFFFFn);

      // Apply matrix multiplication
      const output = matrixMult(matrices[seg], input);

      // Pack result back
      result |= BigInt(output) << BigInt(seg * 16);
    }

    return result;
  }

  // Apply inverse linear layer (as BigInt)
  function invLinearLayer(state) {
    let result = 0n;
    const invMatrices = [L3, L2_INV, L1_INV, L0];  // pypride order: L3_inv, L2_inv, L1_inv, L0_inv (L0 and L3 are self-inverse)

    for (let seg = 0; seg < 4; ++seg) {
      // Extract 16-bit segment (4 nibbles)
      const input = Number((state >> BigInt(seg * 16)) & 0xFFFFn);

      // Apply inverse matrix multiplication
      const output = matrixMult(invMatrices[seg], input);

      // Pack result back
      result |= BigInt(output) << BigInt(seg * 16);
    }

    return result;
  }

  // Key schedule function g
  function g(x, i, j) {
    const m = [193, 165, 81, 197];
    return (x + m[j] * i) % 256;  // Modulo instead of bitwise AND
  }

  // Generate round keys from 128-bit key
  function generateRoundKeys(key) {
    const k0 = key.slice(0, 8);
    const k1 = key.slice(8, 16);

    const roundKeys = [];

    // Generate 20 round keys
    for (let i = 1; i <= 20; ++i) {
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

    return { k0, k1, roundKeys };
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

      this.tests = [
        {
          text: "PRIDE Test Vector #1 (pypride Reference)",
          uri: "https://github.com/obfusk/pypride",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("82b4109fcc70bd1f")
        },
        {
          text: "PRIDE Test Vector #2 (pypride Reference)",
          uri: "https://github.com/obfusk/pypride",
          input: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("d70e60680a17b956")
        },
        {
          text: "PRIDE Test Vector #3 (pypride Reference)",
          uri: "https://github.com/obfusk/pypride",
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("0000000000000000fedcba9876543210"),
          expected: OpCodes.Hex8ToBytes("d1372929712d336e")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
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
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._keySchedule = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this._keySchedule = null;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16 bytes)`);
      }

      this._key = [...keyBytes];
      this._keySchedule = generateRoundKeys(new Uint8Array(this._key));
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
      if (this.inputBuffer.length % 8 !== 0) {
        throw new Error(`Invalid input length: ${this.inputBuffer.length} bytes (must be multiple of 8)`);
      }

      const output = [];
      const numBlocks = this.inputBuffer.length / 8;

      for (let b = 0; b < numBlocks; ++b) {
        const block = this.inputBuffer.slice(b * 8, (b + 1) * 8);
        const processed = this.processBlock(block);
        output.push(...processed);
      }

      this.inputBuffer = [];
      return output;
    }

    processBlock(block) {
      // Convert byte array to BigInt (big-endian)
      let state = bytesToInt(block);
      const k0 = bytesToInt(this._keySchedule.k0);

      if (this.isInverse) {
        // Decryption: reverse of encryption

        // 1. Apply P^{-1}
        state = applyPermutation(state, P_INV);

        // 2. XOR with k0 (whitening)
        state ^= k0;

        // 3. 20 rounds in reverse
        for (let r = 19; r >= 0; --r) {
          // S-box (involution, so same as forward)
          state = applySbox(state);

          // Round key XOR (apply P^{-1} to round key before XOR, following pypride)
          const rk = bytesToInt(this._keySchedule.roundKeys[r]);
          state ^= applyPermutation(rk, P_INV);

          // If not last iteration (r > 0), apply P, L^{-1}, P^{-1}
          if (r > 0) {
            state = applyPermutation(state, P);
            state = invLinearLayer(state);
            state = applyPermutation(state, P_INV);
          }
        }

        // 4. XOR with k0 (whitening)
        state ^= k0;

        // 5. Apply P
        state = applyPermutation(state, P);

      } else {
        // Encryption following pypride reference

        // 1. Apply P^{-1} to message
        state = applyPermutation(state, P_INV);

        // 2. XOR with k0 (whitening)
        state ^= k0;

        // 3. 20 rounds
        for (let r = 0; r < 20; ++r) {
          // Round key XOR (apply P^{-1} to round key before XOR, following pypride)
          const rk = bytesToInt(this._keySchedule.roundKeys[r]);
          state ^= applyPermutation(rk, P_INV);

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
        state ^= k0;

        // 5. Apply P
        state = applyPermutation(state, P);
      }

      // Convert BigInt back to byte array (big-endian)
      return intToBytes(state);
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new Pride());

  return Pride;
}));
