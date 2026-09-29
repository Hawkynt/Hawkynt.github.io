/*
 * CMAC (Cipher-based Message Authentication Code) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * CMAC is a block cipher-based MAC algorithm that provides cryptographic authentication.
 * This implementation uses AES as the underlying block cipher and follows NIST SP 800-38B.
 */

// Load AlgorithmFramework (REQUIRED)

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

  class CMACAlgorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "CMAC";
      this.description = "Cipher-based Message Authentication Code as defined in NIST SP 800-38B. Provides cryptographic authentication using AES block cipher.";
      this.inventor = "NIST";
      this.year = 2005;
      this.category = CategoryType.MAC;
      this.subCategory = "CMAC";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // MAC-specific configuration
      this.SupportedMacSizes = [
        new KeySize(16, 16, 0)  // 128-bit MAC output
      ];
      this.NeedsKey = true;

      // Documentation links
      this.documentation = [
        new LinkItem("NIST SP 800-38B - CMAC Specification", "https://csrc.nist.gov/publications/detail/sp/800-38b/final"),
        new LinkItem("RFC 4493 - The AES-CMAC Algorithm", "https://tools.ietf.org/html/rfc4493")
      ];

      // Reference links
      this.references = [
        new LinkItem("OpenSSL CMAC Implementation", "https://github.com/openssl/openssl/blob/master/crypto/cmac/cmac.c"),
        new LinkItem("Bouncy Castle CMAC", "https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/macs"),
        new LinkItem("Python Cryptography CMAC", "https://cryptography.io/en/latest/hazmat/primitives/mac/cmac/")
      ];

      // Test vectors from NIST SP 800-38B
      this.tests = [
        // Test Case 1: Empty message
        {
          text: "NIST SP 800-38B Example 1 - Empty Message",
          uri: "https://csrc.nist.gov/publications/detail/sp/800-38b/final",
          input: [],
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          expected: OpCodes.Hex8ToBytes("bb1d6929e95937287fa37d129b756746")
        },
        // Test Case 2: Single block message
        {
          text: "NIST SP 800-38B Example 2 - Single Block",
          uri: "https://csrc.nist.gov/publications/detail/sp/800-38b/final",
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          expected: OpCodes.Hex8ToBytes("070a16b46b4d4144f79bdd9dd04a287c")
        },
        // Test Case 3: Multi-block message
        {
          text: "NIST SP 800-38B Example 3 - Multi Block",
          uri: "https://csrc.nist.gov/publications/detail/sp/800-38b/final",
          input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          expected: OpCodes.Hex8ToBytes("dfa66747de9ae63030ca32611497c827")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {CMACInstance} New MAC instance (null for the inverse)
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // CMAC cannot be reversed
      }
      return new CMACInstance(this);
    }
  }

  // Instance class - handles the actual CMAC computation
  /**
 * CMAC instance implementing the Feed/Result pattern
 * @class
 * @extends {IMacInstance}
 */

  class CMACInstance extends IMacInstance {
    /**
     * @param {CMACAlgorithm} algorithm - Parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint8[]} */
      this._key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]} */
      this.state = OpCodes.CreateArray(16, 0); // AES block state

      // AES-128 S-box
      /** @type {uint8[]} */
      this.SBOX = OpCodes.Hex8ToBytes(
        "637c777bf26b6fc53001672bfed7ab76" +
        "ca82c97dfa5947f0add4a2af9ca472c0" +
        "b7fd9326363ff7cc34a5e5f171d83115" +
        "04c723c31896059a071280e2eb27b275" +
        "09832c1a1b6e5aa0523bd6b329e32f84" +
        "53d100ed20fcb15b6acbbe394a4c58cf" +
        "d0efaafb434d338545f9027f503c9fa8" +
        "51a3408f929d38f5bcb6da2110fff3d2" +
        "cd0c13ec5f974417c4a77e3d645d1973" +
        "60814fdc222a908846eeb814de5e0bdb" +
        "e0323a0a4906245cc2d3ac629195e479" +
        "e7c8376d8dd54ea96c56f4ea657aae08" +
        "ba78252e1ca6b4c6e8dd741f4bbd8b8a" +
        "703eb5664803f60e613557b986c11d9e" +
        "e1f8981169d98e949b1e87e9ce5528df" +
        "8ca1890dbfe6426841992d0fb054bb16"
      );

      // AES round constants
      /** @type {uint8[]} */
      this.RCON = OpCodes.Hex8ToBytes("01020408102040801b36");

      /** @type {uint8[][]} */
      this.roundKeys = null;
      // CMAC subkeys K1 and K2
      /** @type {uint8[]} */
      this.subkeyK1 = null;
      /** @type {uint8[]} */
      this.subkeyK2 = null;
    }

    // Property setter for key
    /**
   * Set the AES-128 key
   * @param {uint8[]} keyBytes - 16-byte key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.subkeyK1 = null;
        this.subkeyK2 = null;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 16) {
        throw new Error("CMAC requires 128-bit (16-byte) AES key");
      }

      this._key = keyBytes.slice();
      this.roundKeys = null; // Not needed when using framework AES
      this._generateSubkeys();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]} Copy of key bytes or null
   */

    get key() {
      if (!this._key) return null;
      return this._key.slice();
    }

    // Feed data to the MAC
    /**
   * Feed data to the MAC
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If the data is not a byte array
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    // Get the MAC result
    /**
   * Get the MAC of everything fed so far
   * @returns {uint8[]} 16-byte MAC
   * @throws {Error} If key not set
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      // Note: Empty input is valid for CMAC

      const mac = this._computeCMAC();
      this.inputBuffer = []; // Clear buffer for next use
      this.state.fill(0); // Reset state
      return mac;
    }

    /**
     * Compute MAC (IMacInstance interface)
     * @param {uint8[]} data - Message bytes
     * @returns {uint8[]} 16-byte MAC
     */
    ComputeMac(data) {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }

      // Temporarily store current buffer and replace with new data
      const originalBuffer = this.inputBuffer;
      this.inputBuffer = data.slice();
      const result = this.Result();
      this.inputBuffer = originalBuffer; // Restore original buffer
      return result;
    }

    /**
     * AES key expansion for AES-128
     * @param {uint8[]} key - 16-byte key
     * @returns {uint8[][]} 11 round keys of 16 bytes
     */
    _expandKey(key) {
      /** @type {uint8[][]} */
      const roundKeys = [];
      const Nk = 4; // Number of 32-bit words in key (128 bits / 32 = 4)
      const Nb = 4; // Number of columns in state (always 4 for AES)
      const Nr = 10; // Number of rounds (10 for AES-128)

      /** @type {uint8[][]} */
      const w = new Array((Nb * (Nr + 1))); // 44 words total

      // Copy key into first Nk words
      for (let i = 0; i < Nk; i++) {
        w[i] = key.slice(4 * i, 4 * i + 4);
      }

      // Generate remaining words
      for (let i = Nk; i < Nb * (Nr + 1); i++) {
        const temp = w[i-1].slice();

        if (i % Nk === 0) {
          // RotWord: rotate left by one byte
          const t = temp[0];
          temp[0] = temp[1];
          temp[1] = temp[2];
          temp[2] = temp[3];
          temp[3] = t;

          // SubWord: substitute bytes using S-box
          for (let j = 0; j < 4; j++) {
            temp[j] = this.SBOX[temp[j]];
          }

          // XOR with Rcon
          temp[0] = OpCodes.Xor8(temp[0], this.RCON[Math.floor(i/Nk) - 1]);
        }

        // w[i] = w[i-Nk] XOR temp
        /** @type {uint8[]} */
        const prev = w[i-Nk];
        /** @type {uint8[]} */
        const next = new Array(4);
        for (let j = 0; j < 4; j++) {
          next[j] = OpCodes.Xor8(prev[j], temp[j]);
        }
        w[i] = next;
      }

      // Convert word array to round key array
      for (let round = 0; round <= Nr; round++) {
        /** @type {uint8[]} */
        const roundKey = [];
        for (let col = 0; col < Nb; col++) {
          /** @type {uint8[]} */
          const column = w[round * Nb + col];
          for (let j = 0; j < 4; j++) roundKey.push(column[j]);
        }
        roundKeys[round] = roundKey;
      }

      return roundKeys;
    }

    /**
     * Generate the CMAC subkeys K1 and K2 into subkeyK1/subkeyK2
     * @returns {void}
     */
    _generateSubkeys() {
      // Encrypt zero block with AES
      /** @type {uint8[]} */
      const zeroBlock = OpCodes.CreateArray(16, 0);
      const L = this._aesEncrypt(zeroBlock);

      // Generate K1
      const K1 = this._leftShift(L);
      if (OpCodes.And8(L[0], 0x80) !== 0) {
        K1[15] = OpCodes.Xor8(K1[15], 0x87); // Rb constant for 128-bit blocks
      }

      // Generate K2
      const K2 = this._leftShift(K1);
      if (OpCodes.And8(K1[0], 0x80) !== 0) {
        K2[15] = OpCodes.Xor8(K2[15], 0x87);
      }

      this.subkeyK1 = K1;
      this.subkeyK2 = K2;
    }

    /**
     * Left shift by one bit for CMAC subkey generation
     * @param {uint8[]} data - Byte string
     * @returns {uint8[]} data shifted left by one bit
     */
    _leftShift(data) {
      /** @type {uint8[]} */
      const result = new Array(data.length);
      /** @type {uint8} */
      let carry = 0;

      for (let i = data.length - 1; i >= 0; i--) {
        /** @type {uint8} */
        const newCarry = OpCodes.And8(data[i], 0x80) !== 0 ? 1 : 0;
        result[i] = OpCodes.Or8(OpCodes.Shl8(data[i], 1), carry);
        carry = newCarry;
      }

      return result;
    }

    /**
     * AES-128 encryption - minimal implementation for CMAC
     * @param {uint8[]} plaintext - 16-byte block
     * @returns {uint8[]} 16-byte ciphertext block
     */
    _aesEncrypt(plaintext) {
      if (!this.roundKeys) {
        this.roundKeys = this._expandKey(this._key);
      }

      const state = plaintext.slice();

      // Initial AddRoundKey
      this._addRoundKey(state, this.roundKeys[0]);

      // 9 main rounds
      for (let round = 1; round < 10; round++) {
        this._subBytes(state);
        this._shiftRows(state);
        this._mixColumns(state);
        this._addRoundKey(state, this.roundKeys[round]);
      }

      // Final round (no MixColumns)
      this._subBytes(state);
      this._shiftRows(state);
      this._addRoundKey(state, this.roundKeys[10]);

      return state;
    }

    /**
     * @param {uint8[]} state - AES state (modified in place)
     * @param {uint8[]} roundKey - 16-byte round key
     * @returns {void}
     */
    _addRoundKey(state, roundKey) {
      for (let i = 0; i < 16; i++) {
        state[i] = OpCodes.Xor8(state[i], roundKey[i]);
      }
    }

    /**
     * @param {uint8[]} state - AES state (modified in place)
     * @returns {void}
     */
    _subBytes(state) {
      for (let i = 0; i < 16; i++) {
        state[i] = this.SBOX[state[i]];
      }
    }

    /**
     * @param {uint8[]} state - AES state (modified in place)
     * @returns {void}
     */
    _shiftRows(state) {
      // Row 1: shift left by 1
      const temp1 = state[1];
      state[1] = state[5];
      state[5] = state[9];
      state[9] = state[13];
      state[13] = temp1;

      // Row 2: shift left by 2
      const temp2a = state[2];
      const temp2b = state[6];
      state[2] = state[10];
      state[6] = state[14];
      state[10] = temp2a;
      state[14] = temp2b;

      // Row 3: shift left by 3 (equivalent to shift right by 1)
      const temp3 = state[15];
      state[15] = state[11];
      state[11] = state[7];
      state[7] = state[3];
      state[3] = temp3;
    }

    /**
     * @param {uint8[]} state - AES state (modified in place)
     * @returns {void}
     */
    _mixColumns(state) {
      for (let col = 0; col < 4; col++) {
        const c0 = state[col * 4];
        const c1 = state[col * 4 + 1];
        const c2 = state[col * 4 + 2];
        const c3 = state[col * 4 + 3];

        state[col * 4] = OpCodes.Xor8(this._mul2(c0), OpCodes.Xor8(this._mul3(c1), OpCodes.Xor8(c2, c3)));
        state[col * 4 + 1] = OpCodes.Xor8(c0, OpCodes.Xor8(this._mul2(c1), OpCodes.Xor8(this._mul3(c2), c3)));
        state[col * 4 + 2] = OpCodes.Xor8(c0, OpCodes.Xor8(c1, OpCodes.Xor8(this._mul2(c2), this._mul3(c3))));
        state[col * 4 + 3] = OpCodes.Xor8(this._mul3(c0), OpCodes.Xor8(c1, OpCodes.Xor8(c2, this._mul2(c3))));
      }
    }

    /**
     * Multiply by x in GF(2^8) modulo the AES polynomial
     * @param {uint8} x - Byte
     * @returns {uint8} 2 * x
     */
    _mul2(x) {
      if (OpCodes.And8(x, 0x80) !== 0) return OpCodes.Xor8(OpCodes.Shl8(x, 1), 0x1B);
      return OpCodes.Shl8(x, 1);
    }

    /**
     * Multiply by x + 1 in GF(2^8)
     * @param {uint8} x - Byte
     * @returns {uint8} 3 * x
     */
    _mul3(x) {
      return OpCodes.Xor8(this._mul2(x), x);
    }

    /**
     * Core CMAC computation over inputBuffer
     * @returns {uint8[]} 16-byte MAC
     */
    _computeCMAC() {
      /** @type {uint8[]} */
      let x = OpCodes.CreateArray(16, 0); // CBC-MAC state
      const msgLen = this.inputBuffer.length;

      // Special case: empty message
      if (msgLen === 0) {
        /** @type {uint8[]} */
        const finalBlock = OpCodes.CreateArray(16, 0);
        finalBlock[0] = 0x80; // Padding

        // XOR with K2 (for incomplete block)
        for (let i = 0; i < 16; i++) {
          finalBlock[i] = OpCodes.Xor8(finalBlock[i], this.subkeyK2[i]);
        }

        // XOR with state and encrypt
        for (let i = 0; i < 16; i++) {
          x[i] = OpCodes.Xor8(x[i], finalBlock[i]);
        }

        return this._aesEncrypt(x);
      }

      // Process all complete blocks except the last block
      let pos = 0;
      const numCompleteBlocks = Math.floor(msgLen / 16);
      const isCompleteMessage = (msgLen % 16 === 0);

      // Process complete blocks (but not the final block if message is complete)
      /** @type {int32} */
      let blocksToProcess = numCompleteBlocks;
      if (isCompleteMessage) blocksToProcess = numCompleteBlocks - 1;

      for (let blockNum = 0; blockNum < blocksToProcess; blockNum++) {
        const block = this.inputBuffer.slice(pos, pos + 16);

        // XOR with previous state
        for (let i = 0; i < 16; i++) {
          x[i] = OpCodes.Xor8(x[i], block[i]);
        }

        // Encrypt with AES
        x = this._aesEncrypt(x);
        pos += 16;
      }

      // Handle final block
      const remainingBytes = msgLen - pos;
      /** @type {uint8[]} */
      const finalBlock = OpCodes.CreateArray(16, 0);

      if (remainingBytes === 16) {
        // Complete final block: XOR with K1
        for (let i = 0; i < 16; i++) {
          finalBlock[i] = OpCodes.Xor8(this.inputBuffer[pos + i], this.subkeyK1[i]);
        }
      } else {
        // Incomplete final block: pad and XOR with K2
        for (let i = 0; i < remainingBytes; i++) {
          finalBlock[i] = this.inputBuffer[pos + i];
        }
        if (remainingBytes < 16) {
          finalBlock[remainingBytes] = 0x80; // Padding
        }

        for (let i = 0; i < 16; i++) {
          finalBlock[i] = OpCodes.Xor8(finalBlock[i], this.subkeyK2[i]);
        }
      }

      // XOR with state and encrypt
      for (let i = 0; i < 16; i++) {
        x[i] = OpCodes.Xor8(x[i], finalBlock[i]);
      }

      return this._aesEncrypt(x);
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new CMACAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CMACAlgorithm, CMACInstance };
}));