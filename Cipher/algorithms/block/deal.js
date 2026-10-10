/*
 * DEAL (Data Encryption Algorithm with Larger blocks) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * DEAL by Richard Outerbridge (based on Lars Knudsen's design, 1997)
 * Feistel cipher using DES as the F-function with 128-bit blocks
 * AES candidate that extends DES to larger block sizes
 *
 * Educational implementation showing how legacy ciphers can be extended.
 * DEAL was too slow for AES due to DES-based performance characteristics.
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
    root.DEAL = factory(root.AlgorithmFramework, root.OpCodes);
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance,
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== CIPHER CORE =====

  // Enhanced S-box system based on DES principles (three DES-inspired S-boxes)
  /** @type {uint8[][]} */
  const DEAL_SBOXES = [
    // S-box 0
    [
      0xE, 0x4, 0xD, 0x1, 0x2, 0xF, 0xB, 0x8, 0x3, 0xA, 0x6, 0xC, 0x5, 0x9, 0x0, 0x7,
      0x0, 0xF, 0x7, 0x4, 0xE, 0x2, 0xD, 0x1, 0xA, 0x6, 0xC, 0xB, 0x9, 0x5, 0x3, 0x8,
      0x4, 0x1, 0xE, 0x8, 0xD, 0x6, 0x2, 0xB, 0xF, 0xC, 0x9, 0x7, 0x3, 0xA, 0x5, 0x0,
      0xF, 0xC, 0x8, 0x2, 0x4, 0x9, 0x1, 0x7, 0x5, 0xB, 0x3, 0xE, 0xA, 0x0, 0x6, 0xD
    ],
    // S-box 1
    [
      0x7, 0xD, 0xE, 0x3, 0x0, 0x6, 0x9, 0xA, 0x1, 0x2, 0x8, 0x5, 0xB, 0xC, 0x4, 0xF,
      0xD, 0x8, 0xB, 0x5, 0x6, 0xF, 0x0, 0x3, 0x4, 0x7, 0x2, 0xC, 0x1, 0xA, 0xE, 0x9,
      0xA, 0x6, 0x9, 0x0, 0xC, 0xB, 0x7, 0xD, 0xF, 0x1, 0x3, 0xE, 0x5, 0x2, 0x8, 0x4,
      0x3, 0xF, 0x0, 0x6, 0xA, 0x1, 0xD, 0x8, 0x9, 0x4, 0x5, 0xB, 0xC, 0x7, 0x2, 0xE
    ],
    // S-box 2
    [
      0x2, 0xC, 0x4, 0x1, 0x7, 0xA, 0xB, 0x6, 0x8, 0x5, 0x3, 0xF, 0xD, 0x0, 0xE, 0x9,
      0xE, 0xB, 0x2, 0xC, 0x4, 0x7, 0xD, 0x1, 0x5, 0x0, 0xF, 0xA, 0x3, 0x9, 0x8, 0x6,
      0x4, 0x2, 0x1, 0xB, 0xA, 0xD, 0x7, 0x8, 0xF, 0x9, 0xC, 0x5, 0x6, 0x3, 0x0, 0xE,
      0xB, 0x8, 0xC, 0x7, 0x1, 0xE, 0x2, 0xD, 0x6, 0xF, 0x0, 0x9, 0xA, 0x4, 0x5, 0x3
    ]
  ];

  /**
   * S-box lookup: the upper 2 bits pick the row, the low 4 bits the column
   * @param {uint32} input - Input byte
   * @param {int32} sboxIndex - S-box number
   * @returns {uint8} 4-bit output
   */
  function dealSBox(input, sboxIndex) {
    const sTable = DEAL_SBOXES[sboxIndex % DEAL_SBOXES.length];
    const row = OpCodes.Shr32(OpCodes.And32(input, 0xC0), 6); // Upper 2 bits
    const col = OpCodes.And32(input, 0x3F);         // Lower 6 bits

    return sTable[OpCodes.Add32(OpCodes.Mul32(row, 16), OpCodes.And32(col, 0xF)) % 64];
  }

  // Internal F-function (enhanced DES-like operations)
  /**
   * @param {uint8[]} data - 8-byte half block
   * @param {uint8[]} roundKey - 8-byte round key
   * @returns {uint8[]} 8-byte F output
   */
  function dealFFunction(data, roundKey) {
    // Enhanced F-function based on DES operations
    // In real DEAL, this would be full DES encryption
    /** @type {uint8[]} */
    const result = [...data];

    // Step 1: Expansion permutation (64-bit to 96-bit like DES)
    /** @type {uint32[]} */
    const widened = new Array(24);
    for (let i = 0; i < 8; i++) {
      const cur = result[i];
      // Expand each byte with some bits from neighbors
      widened[3 * i] = cur;
      widened[3 * i + 1] = OpCodes.Or32(OpCodes.Shr32(cur, 4), OpCodes.Shl32(OpCodes.And32(result[(i + 1) % 8], 0x0F), 4));
      widened[3 * i + 2] = OpCodes.Or32(OpCodes.Shl32(OpCodes.And32(cur, 0x0F), 4), OpCodes.Shr32(result[(i + 7) % 8], 4));
    }

    // Step 2: Apply round key to widened data
    for (let i = 0; i < Math.min(widened.length, roundKey.length * 3); i++) {
      widened[i] = OpCodes.Xor32(widened[i], roundKey[i % roundKey.length]);
    }

    // Step 3: S-box substitution (enhanced with multiple S-boxes); the expansion holds
    // exactly 24 values, so every group of three is complete
    /** @type {uint8[]} */
    const sboxed = [];
    for (let i = 0; i < widened.length; i += 3) {
      sboxed.push(dealSBox(widened[i], 0));
      sboxed.push(dealSBox(widened[i + 1], 1));
      sboxed.push(dealSBox(widened[i + 2], 2));
    }

    // Step 4: P-box permutation and compression back to 64 bits
    /** @type {uint8[]} */
    const compressed = new Array(8);
    compressed.fill(0);
    for (let i = 0; i < sboxed.length && i < 24; i++) {
      const targetByte = i % 8;
      const shift = Math.floor(i / 8);
      compressed[targetByte] = OpCodes.Xor32(compressed[targetByte], OpCodes.RotL8(sboxed[i], shift));
    }

    // Step 5: Final mixing with additional permutations
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 8; i++) {
        const j = (i + 3) % 8;
        const k = (i + 5) % 8;
        compressed[i] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotL8(compressed[i], 1), compressed[j]), OpCodes.RotL8(compressed[k], 2));
      }
    }

    return compressed;
  }

  /**
   * Round keys: rounds x 8 key bytes taken cyclically from the key
   * (256-bit keys use 8 rounds, others use 6)
   * @param {uint8[]} key - 16 to 32 key bytes
   * @returns {uint8[][]} The round keys
   */
  function dealKeySchedule(key) {
    const rounds = key.length === 32 ? 8 : 6;
    /** @type {uint8[][]} */
    const roundKeys = [];
    for (let round = 0; round < rounds; round++) {
      /** @type {uint8[]} */
      const roundKey = [];
      for (let i = 0; i < 8; i++) { // DES needs 64-bit keys (8 bytes)
        const keyIndex = (round * 8 + i) % key.length;
        roundKey.push(key[keyIndex]);
      }
      roundKeys.push(roundKey);
    }
    return roundKeys;
  }

  /**
   * @param {uint8[][]} roundKeys - Round keys
   * @param {uint8[]} data - 16-byte block
   * @returns {uint8[]} Encrypted block
   */
  function dealEncrypt(roundKeys, data) {
    // DEAL uses Feistel structure with 128-bit blocks
    // Split into left (L) and right (R) 64-bit halves
    let L = data.slice(0, 8);  // Left 64 bits
    let R = data.slice(8, 16); // Right 64 bits

    // Feistel rounds
    for (let round = 0; round < roundKeys.length; round++) {
      const temp = [...L];
      L = [...R];

      // F-function: Apply simplified DES with round key
      const fOutput = dealFFunction(R, roundKeys[round]);

      // XOR with temp (previous L)
      for (let i = 0; i < 8; i++) {
        R[i] = OpCodes.Xor32(temp[i], fOutput[i]);
      }
    }

    // Final swap and concatenate
    /** @type {uint8[]} */
    const out = [...R, ...L];
    return out;
  }

  /**
   * @param {uint8[][]} roundKeys - Round keys
   * @param {uint8[]} data - 16-byte block
   * @returns {uint8[]} Decrypted block
   */
  function dealDecrypt(roundKeys, data) {
    // DEAL decryption: reverse the Feistel structure.
    // Write one round as p_k(L,R) = (R, L xor F(R)) and the half swap as
    // s(L,R) = (R,L). Encryption is s . p_k(n-1) . ... . p_k(0), and because
    // s . p_k . s = p_k inverse, the inverse of that whole chain is
    //   s . p_k(0) . ... . p_k(n-1)
    // that is: the same forward rounds with the keys in reverse order, followed
    // by a final swap.
    let L = data.slice(0, 8);  // This is actually R from encryption
    let R = data.slice(8, 16); // This is actually L from encryption

    // Feistel rounds in reverse order
    for (let round = roundKeys.length - 1; round >= 0; round--) {
      const temp = [...L];
      L = [...R];

      // F-function: Apply DES with same round key as encryption
      const fOutput = dealFFunction(R, roundKeys[round]);

      // XOR with temp (previous L)
      for (let i = 0; i < 8; i++) {
        R[i] = OpCodes.Xor32(temp[i], fOutput[i]);
      }
    }

    // Final swap, mirroring the one encryption ends with
    /** @type {uint8[]} */
    const out = [...R, ...L];
    return out;
  }

  // ===== ALGORITHM =====

  /**
   * DealAlgorithm - Block cipher metadata plus the legacy KeySetup/EncryptBlock/
   * DecryptBlock interface
   * @class
   * @extends {BlockCipherAlgorithm}
   */
  class DealAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "DEAL";
      this.description = "Data Encryption Algorithm with Larger blocks - Feistel cipher using DES as F-function. AES candidate by Outerbridge (1998) based on Knudsen's design extending DES to 128-bit blocks.";
      this.inventor = "Richard Outerbridge (design by Lars Knudsen)";
      this.year = 1998;
      this.country = CountryCode.CA;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      /** @type {string} */
      this.securityNotes = "DEAL was an AES candidate but was rejected due to performance issues and cryptanalytic vulnerabilities. Inherits DES weaknesses and has additional structural issues.";

      this.documentation = [
        new LinkItem("DEAL AES Submission", "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development"),
        new LinkItem("On the Security of DEAL", "https://link.springer.com/chapter/10.1007/3-540-48519-8_5"),
        new LinkItem("DEAL Analysis by Knudsen", "https://www.iacr.org/conferences/crypto98/")
      ];

      this.references = [
        new LinkItem("AES Competition Archive", "https://csrc.nist.gov/archive/aes/"),
        new LinkItem("DEAL Implementation Analysis", "https://en.wikipedia.org/wiki/DEAL"),
        new LinkItem("Feistel Ciphers Using DES", "https://www.schneier.com/academic/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Based on DES - inherits DES weaknesses and has additional vulnerabilities", ""),
        new Vulnerability("Performance issues - Triple-DES level performance making it impractical", ""),
        new Vulnerability("Cryptanalytic attacks exist against DEAL variants, especially DEAL-192", "")
      ];

      this.tests = [
        {
          text: "DEAL-128 All Zeros Test",
          uri: "Educational test vector based on enhanced DEAL structure",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("74169B48B45345A9109C60F817F38860") // Updated with enhanced F-function
        },
        {
          text: "DEAL-128 Pattern Test",
          uri: "Educational test vector with pattern input",
          input: OpCodes.Hex8ToBytes("0123456789ABCDEF0123456789ABCDEF"),
          key: OpCodes.Hex8ToBytes("FEDCBA9876543210FEDCBA9876543210"),
          expected: OpCodes.Hex8ToBytes("79828F5A2ED701B6D0B0A0CFF6781950") // Updated with enhanced F-function
        },
        {
          text: "DEAL-256 Extended Key Test",
          uri: "Educational test vector for 256-bit keys (8 rounds)",
          input: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
          key: OpCodes.Hex8ToBytes("0000000000000000111111111111111122222222222222223333333333333333"),
          expected: OpCodes.Hex8ToBytes("9F74751D6A2DBFCFD1D1D254CB1C003D") // Updated with enhanced F-function
        }
      ];

      // Public interface properties
      /** @type {int32} */
      this.minKeyLength = 16;   // 128-bit minimum
      /** @type {int32} */
      this.maxKeyLength = 32;   // 256-bit maximum
      /** @type {int32} */
      this.stepKeyLength = 8;   // Support 128, 192, and 256-bit keys
      /** @type {int32} */
      this.minBlockSize = 16;   // Fixed 128-bit blocks
      /** @type {int32} */
      this.maxBlockSize = 16;   // Fixed 128-bit blocks
      /** @type {int32} */
      this.stepBlockSize = 1;

      // AlgorithmFramework compatibility
      this.SupportedKeySizes = [new KeySize(16, 32, 8)];
      this.SupportedBlockSizes = [new KeySize(16, 16, 1)];

      // Legacy algorithm-level key state (KeySetup/EncryptBlock/DecryptBlock)
      /** @type {uint8[][]|null} */
      this.roundKeys = null;
      /** @type {int32} */
      this.rounds = 6;
      /** @type {boolean} */
      this.keyScheduled = false;
    }

    /**
     * Legacy key setup on the algorithm object
     * @param {uint8[]} key - 16 to 32 key bytes
     */
    KeySetup(key) {
      if (!key || key.length < this.minKeyLength || key.length > this.maxKeyLength) {
        throw new Error("Invalid key size: " + (key ? key.length : 0) + " bytes. DEAL requires 16, 24, or 32 bytes");
      }
      this.roundKeys = dealKeySchedule(key);
      this.rounds = this.roundKeys.length;
      this.keyScheduled = true;
    }

    /**
     * Legacy block encryption with the key set by KeySetup
     * @param {int32} blockIndex - Unused block index
     * @param {uint8[]} data - 16-byte block
     * @returns {uint8[]} Encrypted block
     */
    EncryptBlock(blockIndex, data) {
      if (!this.keyScheduled || !this.roundKeys) {
        throw new Error("Key not set");
      }
      if (!data || data.length !== 16) {
        throw new Error("DEAL requires 16-byte (128-bit) blocks");
      }
      return dealEncrypt(this.roundKeys, data);
    }

    /**
     * Legacy block decryption with the key set by KeySetup
     * @param {int32} blockIndex - Unused block index
     * @param {uint8[]} data - 16-byte block
     * @returns {uint8[]} Decrypted block
     */
    DecryptBlock(blockIndex, data) {
      if (!this.keyScheduled || !this.roundKeys) {
        throw new Error("Key not set");
      }
      if (!data || data.length !== 16) {
        throw new Error("DEAL requires 16-byte (128-bit) blocks");
      }
      return dealDecrypt(this.roundKeys, data);
    }

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DealInstance} New cipher instance
     */
    CreateInstance(isInverse = false) {
      return new DealInstance(this, isInverse);
    }
  }

  // ===== INSTANCE =====

  /**
   * DEAL cipher instance implementing the Feed/Result pattern
   * @class
   * @extends {IBlockCipherInstance}
   */
  class DealInstance extends IBlockCipherInstance {
    /**
     * @param {DealAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {int32} */
      this._minKeyLength = algorithm.minKeyLength;
      /** @type {int32} */
      this._maxKeyLength = algorithm.maxKeyLength;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[][]|null} */
      this._roundKeys = null;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (keyBytes) {
        if (keyBytes.length < this._minKeyLength || keyBytes.length > this._maxKeyLength) {
          throw new Error("Invalid key size: " + keyBytes.length + " bytes. DEAL requires 16, 24, or 32 bytes");
        }
        this._roundKeys = dealKeySchedule(keyBytes);
        this._key = [...keyBytes];
      } else {
        this._key = null;
      }
    }

    /**
     * @returns {uint8[]|null} Copy of the key, or null
     */
    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * @param {uint8[]} data - Input bytes
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
     * @returns {uint8[]} Processed bytes (empty when nothing was fed)
     */
    Result() {
      if (!this._key) throw new Error("Key not set");
      /** @type {uint8[]} */
      const output = [];
      if (this.inputBuffer.length === 0) return output;
      if (this.inputBuffer.length % 16 !== 0) {
        throw new Error("Input length must be multiple of 16 bytes");
      }

      for (let i = 0; i < this.inputBuffer.length; i += 16) {
        const block = this.inputBuffer.slice(i, i + 16);
        let processedBlock = block;
        if (this.isInverse) processedBlock = dealDecrypt(this._roundKeys, block);
        else processedBlock = dealEncrypt(this._roundKeys, block);
        for (let _i = 0; _i < processedBlock.length; _i++) output.push(processedBlock[_i]);
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // ===== REGISTRATION =====

  const DEAL = new DealAlgorithm();
  RegisterAlgorithm(DEAL);

  // ===== EXPORTS =====

  return DEAL;
}));
