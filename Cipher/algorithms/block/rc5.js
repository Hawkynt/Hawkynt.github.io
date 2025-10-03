/*
 * RC5 (Rivest Cipher 5) Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * RC5 Algorithm by Ron Rivest (RSA Data Security)
 * Variable word size, rounds, and key length (RC5-w/r/b)
 * This implementation defaults to RC5-32/12/16
 * Features data-dependent rotations
 * 
 * Based on RFC 2040 and original RC5 specification
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

  class RC5Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RC5";
      this.description = "Variable symmetric block cipher with data-dependent rotations. Features configurable word size, rounds, and key length. This implementation uses RC5-32/12/16 (32-bit words, 12 rounds, up to 255-byte key).";
      this.inventor = "Ronald Rivest";
      this.year = 1994;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null; // Patent expired, good security record with adequate parameters
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm-specific metadata  
      this.SupportedKeySizes = [
        new KeySize(0, 255, 1) // 0-255 bytes, any byte length
      ];
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0) // Fixed 64-bit blocks for RC5-32
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 2040 - RC5 Algorithm", "https://tools.ietf.org/rfc/rfc2040.txt"),
        new LinkItem("Original RC5 Paper", "https://people.csail.mit.edu/rivest/Rivest-rc5rev.pdf")
      ];

      this.references = [
        new LinkItem("Rivest's RC5 Reference", "https://people.csail.mit.edu/rivest/Rivest-rc5rev.pdf"),
        new LinkItem("RC5 Patent (Expired)", "https://patents.google.com/patent/US5724428A")
      ];

      // Test vectors verified with avr-crypto-lib and our implementation
      this.tests = [
        {
          text: "RC5-32/12/16 zero key, zero plaintext",
          uri: "https://github.com/cantora/avr-crypto-lib/blob/master/testvectors/Rc5-128-64.verified.test-vectors",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("21a5dbee154b8f6d")
        },
        {
          text: "RC5-32/12/16 pattern key and plaintext",
          uri: "https://tools.ietf.org/rfc/rfc2040.txt",
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("b734213608254d2f")
        },
        {
          text: "RC5-32/12/16 all ones key and plaintext",
          uri: "https://tools.ietf.org/rfc/rfc2040.txt",
          input: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
          expected: OpCodes.Hex8ToBytes("778769e9be0167b7")
        }
      ];
    }

    // Required: Create instance for this algorithm
    CreateInstance(isInverse = false) {
      return new RC5Instance(this, isInverse);
    }

    // RC5 Constants
    static get MAGIC_P() { return 0xb7e15163; } // P = Odd((e-2)*2^32)
    static get MAGIC_Q() { return 0x9e3779b9; } // Q = Odd((φ-1)*2^32)
    static get DEFAULT_ROUNDS() { return 12; }
  }

  // Instance class - handles the actual encryption/decryption
  class RC5Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.expandedKey = null; // S table
      this.inputBuffer = [];
      this.BlockSize = 8; // 64 bits for RC5-32
      this.KeySize = 0;   // will be set when key is assigned
      this.rounds = RC5Algorithm.DEFAULT_ROUNDS;
    }

    // Property setter for key - validates and sets up key schedule
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.expandedKey = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (keyBytes.length - ks.minSize) % ks.stepSize === 0
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes]; // Copy the key
      this.KeySize = keyBytes.length;
      this._keyExpansion();
    }

    get key() {
      return this._key ? [...this._key] : null; // Return copy
    }

    // Feed data to the cipher (accumulates until we have complete blocks)
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      // Add data to input buffer
      this.inputBuffer.push(...data);
    }

    // Get the result of the transformation
    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Process complete blocks
      const output = [];
      const blockSize = this.BlockSize;

      // Validate input length for block cipher
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error(`Input length must be multiple of ${blockSize} bytes`);
      }

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this.isInverse 
          ? this._decryptBlock(block) 
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Private method for key expansion
    _keyExpansion() {
      const u = 4; // Bytes per word (4 for 32-bit)
      const c = Math.max(1, Math.ceil(this.KeySize / u)); // Words in key
      const tableSize = 2 * (this.rounds + 1); // t = 2*(r+1)
      const L = new Array(c); // Key in word array

      // Step 1: Copy key into L array (little-endian as per RFC 2040)
      for (let i = 0; i < c; i++) {
        L[i] = 0;
      }

      for (let i = 0; i < this.KeySize; i++) {
        const keyByte = this._key[i] & 0xFF;
        const shift = 8 * (i % u); // 0, 8, 16, 24
        L[Math.floor(i / u)] = (L[Math.floor(i / u)] + (keyByte << shift)) >>> 0;
      }

      // Step 2: Initialize S array with magic constants
      this.expandedKey = new Array(tableSize);
      this.expandedKey[0] = RC5Algorithm.MAGIC_P;
      for (let i = 1; i < tableSize; i++) {
        this.expandedKey[i] = (this.expandedKey[i - 1] + RC5Algorithm.MAGIC_Q) >>> 0;
      }

      // Step 3: Mix key into S array
      let A = 0, B = 0;
      let i = 0, j = 0;
      const iterations = 3 * Math.max(tableSize, c);

      for (let k = 0; k < iterations; k++) {
        // S[i] = ROL(S[i] + A + B, 3)
        this.expandedKey[i] = (this.expandedKey[i] + A + B) >>> 0;
        A = this.expandedKey[i] = OpCodes.RotL32(this.expandedKey[i], 3);

        // L[j] = ROL(L[j] + A + B, A + B)
        L[j] = (L[j] + A + B) >>> 0;
        B = L[j] = OpCodes.RotL32(L[j], (A + B) & 31);

        i = (i + 1) % tableSize;
        j = (j + 1) % c;
      }

      // Clear temporary key array
      OpCodes.ClearArray(L);
    }

    // Private method for block encryption
    _encryptBlock(plainBytes) {
      if (plainBytes.length !== 8) {
        throw new Error(`Invalid block size: ${plainBytes.length} bytes`);
      }

      // Convert to two 32-bit words (little-endian)
      let A = OpCodes.Pack32LE(plainBytes[0], plainBytes[1], plainBytes[2], plainBytes[3]);
      let B = OpCodes.Pack32LE(plainBytes[4], plainBytes[5], plainBytes[6], plainBytes[7]);

      // Add first round keys
      A = (A + this.expandedKey[0]) >>> 0;
      B = (B + this.expandedKey[1]) >>> 0;

      // Perform rounds
      for (let i = 1; i <= this.rounds; i++) {
        // A = ROL(A XOR B, B) + S[2*i]
        A = A ^ B;
        A = OpCodes.RotL32(A, B & 31);
        A = (A + this.expandedKey[2 * i]) >>> 0;

        // B = ROL(B XOR A, A) + S[2*i+1]
        B = B ^ A;
        B = OpCodes.RotL32(B, A & 31);
        B = (B + this.expandedKey[2 * i + 1]) >>> 0;
      }

      // Convert back to bytes (little-endian)
      return [
        ...OpCodes.Unpack32LE(A),
        ...OpCodes.Unpack32LE(B)
      ];
    }

    // Private method for block decryption
    _decryptBlock(cipherBytes) {
      if (cipherBytes.length !== 8) {
        throw new Error(`Invalid block size: ${cipherBytes.length} bytes`);
      }

      // Convert to two 32-bit words (little-endian)
      let A = OpCodes.Pack32LE(cipherBytes[0], cipherBytes[1], cipherBytes[2], cipherBytes[3]);
      let B = OpCodes.Pack32LE(cipherBytes[4], cipherBytes[5], cipherBytes[6], cipherBytes[7]);

      // Perform rounds in reverse
      for (let i = this.rounds; i >= 1; i--) {
        // B = ROR(B - S[2*i+1], A) XOR A
        B = (B - this.expandedKey[2 * i + 1]) >>> 0;
        B = OpCodes.RotR32(B, A & 31);
        B = B ^ A;

        // A = ROR(A - S[2*i], B) XOR B
        A = (A - this.expandedKey[2 * i]) >>> 0;
        A = OpCodes.RotR32(A, B & 31);
        A = A ^ B;
      }

      // Subtract first round keys
      A = (A - this.expandedKey[0]) >>> 0;
      B = (B - this.expandedKey[1]) >>> 0;

      // Convert back to bytes (little-endian)
      return [
        ...OpCodes.Unpack32LE(A),
        ...OpCodes.Unpack32LE(B)
      ];
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new RC5Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RC5Algorithm, RC5Instance };
}));