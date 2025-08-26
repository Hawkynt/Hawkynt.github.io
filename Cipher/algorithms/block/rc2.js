/*
 * RC2 (Rivest Cipher 2) Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * RC2 Algorithm by Ron Rivest (RSA Data Security)
 * Block size: 64 bits (8 bytes), Key size: 8-128 bytes
 * Uses 16 rounds with mixing and mashing operations
 * 
 * Based on RFC 2268 - A Description of the RC2(r) Encryption Algorithm
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

  class RC2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RC2";
      this.description = "Ron Rivest's RC2 cipher with 64-bit blocks and variable key length. Uses mixing and mashing operations over 16 rounds. Historically important but now considered weak.";
      this.inventor = "Ron Rivest";
      this.year = 1987;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN; // RC2 has known weaknesses
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm-specific metadata  
      this.SupportedKeySizes = [
        new KeySize(1, 128, 1) // 1-128 bytes, any byte length
      ];
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0) // Fixed 64-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 2268 - RC2 Algorithm Description", "https://tools.ietf.org/rfc/rfc2268.txt")
      ];

      this.references = [
        new LinkItem("RSA Data Security RC2 Specification", "https://tools.ietf.org/rfc/rfc2268.txt")
      ];

      // Test vectors from RFC 2268 and authoritative sources
      this.tests = [
        {
          text: "RFC 2268 test vector: 8-byte all-zero key",
          uri: "https://tools.ietf.org/rfc/rfc2268.txt",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000"),
          expected: OpCodes.Hex8ToBytes("eba773f398a0960d")
        },
        {
          text: "RFC 2268 test vector: 8-byte all-ones key", 
          uri: "https://tools.ietf.org/rfc/rfc2268.txt",
          input: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          expected: OpCodes.Hex8ToBytes("278b27e42e2f0d49")
        },
        {
          text: "RFC 2268 test vector: pattern key and plaintext",
          uri: "https://tools.ietf.org/rfc/rfc2268.txt",
          input: OpCodes.Hex8ToBytes("1000000000000001"),
          key: OpCodes.Hex8ToBytes("3000000000000000"),
          expected: OpCodes.Hex8ToBytes("30649edf9be7d2c2")
        }
      ];
    }

    // Required: Create instance for this algorithm
    CreateInstance(isInverse = false) {
      return new RC2Instance(this, isInverse);
    }

    // RC2 PITABLE - 256-byte permutation table from RFC 2268
    static get PITABLE() {
      return [
        217,120,249,196, 25,221,181,237, 40,233,253,121, 74,160,216,157,
        198,126, 55,131, 43,118, 83,142, 98, 76,100,136, 68,139,251,162,
         23,154, 89,245,135,179, 79, 19, 97, 69,109,141,  9,129,125, 50,
        189,143, 64,235,134,183,123, 11,240,149, 33, 34, 92,107, 78,130,
         84,214,101,147,206, 96,178, 28,115, 86,192, 20,167,140,241,220,
         18,117,202, 31, 59,190,228,209, 66, 61,212, 48,163, 60,182, 38,
        111,191, 14,218, 70,105,  7, 87, 39,242, 29,155,188,148, 67,  3,
        248, 17,199,246,144,239, 62,231,  6,195,213, 47,200,102, 30,215,
          8,232,234,222,128, 82,238,247,132,170,114,172, 53, 77,106, 42,
        150, 26,210,113, 90, 21, 73,116, 75,159,208, 94,  4, 24,164,236,
        194,224, 65,110, 15, 81,203,204, 36,145,175, 80,161,244,112, 57,
        153,124, 58,133, 35,184,180,122,252,  2, 54, 91, 37, 85,151, 49,
         45, 93,250,152,227,138,146,174,  5,223, 41, 16,103,108,186,201,
        211,  0,230,207,225,158,168, 44, 99, 22,  1, 63, 88,226,137,169,
         13, 56, 52, 27,171, 51,255,176,187, 72, 12, 95,185,177,205, 46,
        197,243,219, 71,229,165,156,119, 10,166, 32,104,254,127,193,173
      ];
    }
  }

  // Instance class - handles the actual encryption/decryption
  class RC2Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.expandedKey = null;
      this.inputBuffer = [];
      this.BlockSize = 8; // 64 bits
      this.KeySize = 0;   // will be set when key is assigned
      this.effectiveBits = 1024; // Default effective key length
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
      this._setupKey();
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

    // Private method to set up the key schedule
    _setupKey() {
      this.expandedKey = new Array(64);  // 64 16-bit words
      const keyBytes = this._key;
      const keyLength = keyBytes.length;

      // RFC 2268: if effectiveBits is zero, use 1024
      let effectiveBits = this.effectiveBits;
      if (effectiveBits === 0) {
        effectiveBits = 1024;
      }

      // Step 1: Initialize L with key bytes (copy directly to byte array)
      const L = new Array(128);
      for (let i = 0; i < keyLength; i++) {
        L[i] = keyBytes[i];
      }

      // Step 2: Expand to 128 bytes using PITABLE (RFC 2268 algorithm)
      if (keyLength < 128) {
        let i = 0;
        let x = L[keyLength - 1];
        let len = keyLength;

        while (len < 128) {
          x = RC2Algorithm.PITABLE[(x + L[i]) & 0xFF];
          L[len] = x;
          i++;
          len++;
        }
      }

      // Step 3: Apply effective key length reduction (RFC 2268 Phase 2)
      const len = Math.floor((effectiveBits + 7) / 8);  // effective key length in bytes
      const i = 128 - len;
      let x = RC2Algorithm.PITABLE[L[i] & (0xFF >>> (7 & -effectiveBits))];
      L[i] = x;

      for (let j = i - 1; j >= 0; j--) {
        x = RC2Algorithm.PITABLE[x ^ L[j + len]];
        L[j] = x;
      }

      // Step 4: Convert to 16-bit words (little-endian) - RFC 2268 Phase 3
      for (let i = 0; i < 64; i++) {
        this.expandedKey[i] = OpCodes.Pack16LE(L[2 * i], L[2 * i + 1]);
      }
    }

    // Private method for block encryption
    _encryptBlock(plainBytes) {
      if (plainBytes.length !== 8) {
        throw new Error(`Invalid block size: ${plainBytes.length} bytes`);
      }

      // Pack into 16-bit words (little-endian)
      let R0 = OpCodes.Pack16LE(plainBytes[0], plainBytes[1]);
      let R1 = OpCodes.Pack16LE(plainBytes[2], plainBytes[3]);
      let R2 = OpCodes.Pack16LE(plainBytes[4], plainBytes[5]);
      let R3 = OpCodes.Pack16LE(plainBytes[6], plainBytes[7]);

      // 16 rounds of encryption
      for (let i = 0; i < 16; i++) {
        const j = i * 4;

        // Mix operation
        R0 = (R0 + (R1 & (~R3)) + (R2 & R3) + this.expandedKey[j]) & 0xFFFF;
        R0 = OpCodes.RotL16(R0, 1);

        R1 = (R1 + (R2 & (~R0)) + (R3 & R0) + this.expandedKey[j + 1]) & 0xFFFF;
        R1 = OpCodes.RotL16(R1, 2);

        R2 = (R2 + (R3 & (~R1)) + (R0 & R1) + this.expandedKey[j + 2]) & 0xFFFF;
        R2 = OpCodes.RotL16(R2, 3);

        R3 = (R3 + (R0 & (~R2)) + (R1 & R2) + this.expandedKey[j + 3]) & 0xFFFF;
        R3 = OpCodes.RotL16(R3, 5);

        // Mash operation after rounds 5 and 11 (i = 4 and 10)
        if (i === 4 || i === 10) {
          R0 = (R0 + this.expandedKey[R3 & 63]) & 0xFFFF;
          R1 = (R1 + this.expandedKey[R0 & 63]) & 0xFFFF;
          R2 = (R2 + this.expandedKey[R1 & 63]) & 0xFFFF;
          R3 = (R3 + this.expandedKey[R2 & 63]) & 0xFFFF;
        }
      }

      // Unpack to bytes (little-endian)
      return [
        ...OpCodes.Unpack16LE(R0),
        ...OpCodes.Unpack16LE(R1),
        ...OpCodes.Unpack16LE(R2),
        ...OpCodes.Unpack16LE(R3)
      ];
    }

    // Private method for block decryption
    _decryptBlock(cipherBytes) {
      if (cipherBytes.length !== 8) {
        throw new Error(`Invalid block size: ${cipherBytes.length} bytes`);
      }

      // Pack into 16-bit words (little-endian)
      let R0 = OpCodes.Pack16LE(cipherBytes[0], cipherBytes[1]);
      let R1 = OpCodes.Pack16LE(cipherBytes[2], cipherBytes[3]);
      let R2 = OpCodes.Pack16LE(cipherBytes[4], cipherBytes[5]);
      let R3 = OpCodes.Pack16LE(cipherBytes[6], cipherBytes[7]);

      // 16 rounds of decryption (reverse order)
      for (let i = 15; i >= 0; i--) {
        const j = i * 4;

        // Reverse mash operation after rounds 5 and 11 (i = 4 and 10)
        if (i === 4 || i === 10) {
          R3 = (R3 - this.expandedKey[R2 & 63]) & 0xFFFF;
          R2 = (R2 - this.expandedKey[R1 & 63]) & 0xFFFF;
          R1 = (R1 - this.expandedKey[R0 & 63]) & 0xFFFF;
          R0 = (R0 - this.expandedKey[R3 & 63]) & 0xFFFF;
        }

        // Reverse mix operation
        R3 = OpCodes.RotR16(R3, 5);
        R3 = (R3 - (R0 & (~R2)) - (R1 & R2) - this.expandedKey[j + 3]) & 0xFFFF;

        R2 = OpCodes.RotR16(R2, 3);
        R2 = (R2 - (R3 & (~R1)) - (R0 & R1) - this.expandedKey[j + 2]) & 0xFFFF;

        R1 = OpCodes.RotR16(R1, 2);
        R1 = (R1 - (R2 & (~R0)) - (R3 & R0) - this.expandedKey[j + 1]) & 0xFFFF;

        R0 = OpCodes.RotR16(R0, 1);
        R0 = (R0 - (R1 & (~R3)) - (R2 & R3) - this.expandedKey[j]) & 0xFFFF;
      }

      // Unpack to bytes (little-endian)
      return [
        ...OpCodes.Unpack16LE(R0),
        ...OpCodes.Unpack16LE(R1),
        ...OpCodes.Unpack16LE(R2),
        ...OpCodes.Unpack16LE(R3)
      ];
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new RC2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RC2Algorithm, RC2Instance };
}));