/*
 * RC2 (Rivest Cipher 2) Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * RC2 Algorithm by Ron Rivest (RSA Data Security)
 * Block size: 64 bits (8 bytes), Key size: 1-128 bytes
 * Uses 18 rounds with mixing and mashing operations
 * 
 * Based on RFC 2268 and Bouncy Castle authoritative implementation
 * Reference: https://www.rfc-editor.org/rfc/rfc2268.txt
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
      this.description = "RC2 variable-key-size block cipher with 64-bit blocks. Uses mixing and mashing operations over 18 rounds. Developed by Ron Rivest at RSA Data Security in 1987. Cryptographically broken.";
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
        new LinkItem("RFC 2268 - RC2 Algorithm Description", "https://www.rfc-editor.org/rfc/rfc2268.txt"),
        new LinkItem("RSA Data Security RC2 Specification", "https://www.rsa.com/en-us/company/labs/historical-cryptanalysis/rc2")
      ];

      this.references = [
        new LinkItem("Bouncy Castle RC2 Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RC2Engine.java"),
        new LinkItem("NIST Computer Security Resource Center", "https://csrc.nist.gov/projects/block-cipher-techniques"),
        new LinkItem("Applied Cryptography by Bruce Schneier", "https://www.schneier.com/books/applied_cryptography/")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Related-key attacks",
          "RC2 is vulnerable to related-key attacks due to weak key schedule",
          "Use AES or other modern ciphers instead"
        ),
        new Vulnerability(
          "Linear cryptanalysis",
          "RC2 has linear approximations that reduce effective security",
          "Algorithm is obsolete for secure applications"
        )
      ];

      // Official test vectors from RFC 2268
      this.tests = [
        {
          text: "RFC 2268 Test Vector #1: 8-byte all-zero key, 63-bit effective",
          uri: "https://www.rfc-editor.org/rfc/rfc2268.txt",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000"),
          effectiveBits: 63,
          expected: OpCodes.Hex8ToBytes("ebb773f993278eff")
        },
        {
          text: "RFC 2268 Test Vector #2: 8-byte all-ones key, 64-bit effective", 
          uri: "https://www.rfc-editor.org/rfc/rfc2268.txt",
          input: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          effectiveBits: 64,
          expected: OpCodes.Hex8ToBytes("278b27e42e2f0d49")
        },
        {
          text: "RFC 2268 Test Vector #3: pattern key and plaintext, 64-bit effective",
          uri: "https://www.rfc-editor.org/rfc/rfc2268.txt",
          input: OpCodes.Hex8ToBytes("1000000000000001"),
          key: OpCodes.Hex8ToBytes("3000000000000000"),
          effectiveBits: 64,
          expected: OpCodes.Hex8ToBytes("30649edf9be7d2c2")
        },
        {
          text: "RFC 2268 Test Vector #4: 1-byte key, 64-bit effective",
          uri: "https://www.rfc-editor.org/rfc/rfc2268.txt",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("88"),
          effectiveBits: 64,
          expected: OpCodes.Hex8ToBytes("61a8a244adacccf0")
        },
        {
          text: "RFC 2268 Test Vector #5: 7-byte key, 64-bit effective",
          uri: "https://www.rfc-editor.org/rfc/rfc2268.txt",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("88bca90e90875a"),
          effectiveBits: 64,
          expected: OpCodes.Hex8ToBytes("6ccf4308974c267f")
        },
        {
          text: "RFC 2268 Test Vector #6: 16-byte key, 64-bit effective",
          uri: "https://www.rfc-editor.org/rfc/rfc2268.txt", 
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("88bca90e90875a7f0f79c384627bafb2"),
          effectiveBits: 64,
          expected: OpCodes.Hex8ToBytes("1a807d272bbe5db1")
        },
        {
          text: "RFC 2268 Test Vector #7: 16-byte key, 128-bit effective",
          uri: "https://www.rfc-editor.org/rfc/rfc2268.txt",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("88bca90e90875a7f0f79c384627bafb2"),
          effectiveBits: 128,
          expected: OpCodes.Hex8ToBytes("2269552ab0f85ca6")
        }
      ];
    }

    // RC2 PITABLE - 256-byte permutation table from RFC 2268
    static get PITABLE() {
      return [
        0xd9, 0x78, 0xf9, 0xc4, 0x19, 0xdd, 0xb5, 0xed,
        0x28, 0xe9, 0xfd, 0x79, 0x4a, 0xa0, 0xd8, 0x9d,
        0xc6, 0x7e, 0x37, 0x83, 0x2b, 0x76, 0x53, 0x8e,
        0x62, 0x4c, 0x64, 0x88, 0x44, 0x8b, 0xfb, 0xa2,
        0x17, 0x9a, 0x59, 0xf5, 0x87, 0xb3, 0x4f, 0x13,
        0x61, 0x45, 0x6d, 0x8d, 0x09, 0x81, 0x7d, 0x32,
        0xbd, 0x8f, 0x40, 0xeb, 0x86, 0xb7, 0x7b, 0x0b,
        0xf0, 0x95, 0x21, 0x22, 0x5c, 0x6b, 0x4e, 0x82,
        0x54, 0xd6, 0x65, 0x93, 0xce, 0x60, 0xb2, 0x1c,
        0x73, 0x56, 0xc0, 0x14, 0xa7, 0x8c, 0xf1, 0xdc,
        0x12, 0x75, 0xca, 0x1f, 0x3b, 0xbe, 0xe4, 0xd1,
        0x42, 0x3d, 0xd4, 0x30, 0xa3, 0x3c, 0xb6, 0x26,
        0x6f, 0xbf, 0x0e, 0xda, 0x46, 0x69, 0x07, 0x57,
        0x27, 0xf2, 0x1d, 0x9b, 0xbc, 0x94, 0x43, 0x03,
        0xf8, 0x11, 0xc7, 0xf6, 0x90, 0xef, 0x3e, 0xe7,
        0x06, 0xc3, 0xd5, 0x2f, 0xc8, 0x66, 0x1e, 0xd7,
        0x08, 0xe8, 0xea, 0xde, 0x80, 0x52, 0xee, 0xf7,
        0x84, 0xaa, 0x72, 0xac, 0x35, 0x4d, 0x6a, 0x2a,
        0x96, 0x1a, 0xd2, 0x71, 0x5a, 0x15, 0x49, 0x74,
        0x4b, 0x9f, 0xd0, 0x5e, 0x04, 0x18, 0xa4, 0xec,
        0xc2, 0xe0, 0x41, 0x6e, 0x0f, 0x51, 0xcb, 0xcc,
        0x24, 0x91, 0xaf, 0x50, 0xa1, 0xf4, 0x70, 0x39,
        0x99, 0x7c, 0x3a, 0x85, 0x23, 0xb8, 0xb4, 0x7a,
        0xfc, 0x02, 0x36, 0x5b, 0x25, 0x55, 0x97, 0x31,
        0x2d, 0x5d, 0xfa, 0x98, 0xe3, 0x8a, 0x92, 0xae,
        0x05, 0xdf, 0x29, 0x10, 0x67, 0x6c, 0xba, 0xc9,
        0xd3, 0x00, 0xe6, 0xcf, 0xe1, 0x9e, 0xa8, 0x2c,
        0x63, 0x16, 0x01, 0x3f, 0x58, 0xe2, 0x89, 0xa9,
        0x0d, 0x38, 0x34, 0x1b, 0xab, 0x33, 0xff, 0xb0,
        0xbb, 0x48, 0x0c, 0x5f, 0xb9, 0xb1, 0xcd, 0x2e,
        0xc5, 0xf3, 0xdb, 0x47, 0xe5, 0xa5, 0x9c, 0x77,
        0x0a, 0xa6, 0x20, 0x68, 0xfe, 0x7f, 0xc1, 0xad
      ];
    }

    // Required: Create instance for this algorithm
    CreateInstance(isInverse = false) {
      return new RC2Instance(this, isInverse);
    }

    // Helper function for 16-bit left rotation using OpCodes
    static _rotateWordLeft(x, y) {
      return OpCodes.RotL16(x, y);
    }

    // Generate expanded key following RFC 2268 specification
    static generateWorkingKey(keyBytes, effectiveBits) {
      if (!keyBytes || keyBytes.length === 0) {
        throw new Error('Key is required');
      }
      
      // Default effective bits to key length * 8 if not specified
      if (typeof effectiveBits === 'undefined') {
        effectiveBits = keyBytes.length * 8;
      }
      
      // Phase 1: Expand input key to 128 bytes using PITABLE
      const xKey = new Array(128);
      let len = keyBytes.length;
      
      // Copy key bytes
      for (let i = 0; i < len; i++) {
        xKey[i] = keyBytes[i] & 0xFF;
      }
      
      // Expand to 128 bytes if needed
      if (len < 128) {
        let index = 0;
        let x = xKey[len - 1];
        
        do {
          x = RC2Algorithm.PITABLE[(x + xKey[index++]) & 0xFF] & 0xFF;
          xKey[len++] = x;
        } while (len < 128);
      }
      
      // Phase 2: Reduce effective key size to specified bit length
      len = Math.floor((effectiveBits + 7) / 8); // effective key length in bytes
      let x = RC2Algorithm.PITABLE[xKey[128 - len] & (0xFF >>> (7 & -effectiveBits))] & 0xFF;
      xKey[128 - len] = x;
      
      for (let i = 128 - len - 1; i >= 0; i--) {
        x = RC2Algorithm.PITABLE[x ^ xKey[i + len]] & 0xFF;
        xKey[i] = x;
      }
      
      // Phase 3: Convert to 16-bit words (little-endian)
      const expandedKey = new Array(64);
      for (let i = 0; i < 64; i++) {
        expandedKey[i] = (xKey[2 * i] + (xKey[2 * i + 1] << 8)) & 0xFFFF;
      }
      
      return expandedKey;
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
      this.effectiveBits = null; // Will be set from test vector or default to key length * 8
    }

    // Property setter for effective bits
    set effectiveBits(value) {
      this._effectiveBits = value;
      // If we already have a key, regenerate the expanded key with new effective bits
      if (this._key) {
        this._setupKey();
      }
    }

    get effectiveBits() {
      return this._effectiveBits;
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

    // Private method to set up the key schedule
    _setupKey() {
      if (!this._key) return;
      
      // Use effective bits if set, otherwise default to key length * 8
      const effectiveBits = this.effectiveBits !== null ? this.effectiveBits : (this._key.length * 8);
      
      this.expandedKey = RC2Algorithm.generateWorkingKey(this._key, effectiveBits);
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

      // Clear input buffer for next operation using secure clearing
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return output;
    }

    // Private method for block encryption
    _encryptBlock(plainBytes) {
      if (plainBytes.length !== 8) {
        throw new Error(`Invalid block size: ${plainBytes.length} bytes`);
      }

      if (!this.expandedKey) {
        throw new Error('Key not set up. Call key setter first.');
      }

      // Pack input into 16-bit words (little-endian) using OpCodes
      let x10 = OpCodes.Pack16LE(plainBytes[0], plainBytes[1]);
      let x32 = OpCodes.Pack16LE(plainBytes[2], plainBytes[3]);  
      let x54 = OpCodes.Pack16LE(plainBytes[4], plainBytes[5]);
      let x76 = OpCodes.Pack16LE(plainBytes[6], plainBytes[7]);
      
      // Rounds 0-16 (5 rounds of mixing)
      for (let i = 0; i <= 16; i += 4) {
        x10 = RC2Algorithm._rotateWordLeft((x10 + (x32 & ~x76) + (x54 & x76) + this.expandedKey[i]) & 0xFFFF, 1);
        x32 = RC2Algorithm._rotateWordLeft((x32 + (x54 & ~x10) + (x76 & x10) + this.expandedKey[i + 1]) & 0xFFFF, 2);
        x54 = RC2Algorithm._rotateWordLeft((x54 + (x76 & ~x32) + (x10 & x32) + this.expandedKey[i + 2]) & 0xFFFF, 3);
        x76 = RC2Algorithm._rotateWordLeft((x76 + (x10 & ~x54) + (x32 & x54) + this.expandedKey[i + 3]) & 0xFFFF, 5);
      }
      
      // First mash operation (after round 5)
      x10 = (x10 + this.expandedKey[x76 & 63]) & 0xFFFF;
      x32 = (x32 + this.expandedKey[x10 & 63]) & 0xFFFF;
      x54 = (x54 + this.expandedKey[x32 & 63]) & 0xFFFF;
      x76 = (x76 + this.expandedKey[x54 & 63]) & 0xFFFF;
      
      // Rounds 20-40 (6 rounds of mixing)
      for (let i = 20; i <= 40; i += 4) {
        x10 = RC2Algorithm._rotateWordLeft((x10 + (x32 & ~x76) + (x54 & x76) + this.expandedKey[i]) & 0xFFFF, 1);
        x32 = RC2Algorithm._rotateWordLeft((x32 + (x54 & ~x10) + (x76 & x10) + this.expandedKey[i + 1]) & 0xFFFF, 2);
        x54 = RC2Algorithm._rotateWordLeft((x54 + (x76 & ~x32) + (x10 & x32) + this.expandedKey[i + 2]) & 0xFFFF, 3);
        x76 = RC2Algorithm._rotateWordLeft((x76 + (x10 & ~x54) + (x32 & x54) + this.expandedKey[i + 3]) & 0xFFFF, 5);
      }
      
      // Second mash operation (after round 11)
      x10 = (x10 + this.expandedKey[x76 & 63]) & 0xFFFF;
      x32 = (x32 + this.expandedKey[x10 & 63]) & 0xFFFF;
      x54 = (x54 + this.expandedKey[x32 & 63]) & 0xFFFF;
      x76 = (x76 + this.expandedKey[x54 & 63]) & 0xFFFF;
      
      // Rounds 44-60 (5 rounds of mixing)
      for (let i = 44; i < 64; i += 4) {
        x10 = RC2Algorithm._rotateWordLeft((x10 + (x32 & ~x76) + (x54 & x76) + this.expandedKey[i]) & 0xFFFF, 1);
        x32 = RC2Algorithm._rotateWordLeft((x32 + (x54 & ~x10) + (x76 & x10) + this.expandedKey[i + 1]) & 0xFFFF, 2);
        x54 = RC2Algorithm._rotateWordLeft((x54 + (x76 & ~x32) + (x10 & x32) + this.expandedKey[i + 2]) & 0xFFFF, 3);
        x76 = RC2Algorithm._rotateWordLeft((x76 + (x10 & ~x54) + (x32 & x54) + this.expandedKey[i + 3]) & 0xFFFF, 5);
      }

      // Pack output (little-endian) using OpCodes
      return [
        ...OpCodes.Unpack16LE(x10),
        ...OpCodes.Unpack16LE(x32),
        ...OpCodes.Unpack16LE(x54),
        ...OpCodes.Unpack16LE(x76)
      ];
    }

    // Private method for block decryption
    _decryptBlock(cipherBytes) {
      if (cipherBytes.length !== 8) {
        throw new Error(`Invalid block size: ${cipherBytes.length} bytes`);
      }

      if (!this.expandedKey) {
        throw new Error('Key not set up. Call key setter first.');
      }

      // Pack input into 16-bit words (little-endian) using OpCodes
      let x10 = OpCodes.Pack16LE(cipherBytes[0], cipherBytes[1]);
      let x32 = OpCodes.Pack16LE(cipherBytes[2], cipherBytes[3]);
      let x54 = OpCodes.Pack16LE(cipherBytes[4], cipherBytes[5]);
      let x76 = OpCodes.Pack16LE(cipherBytes[6], cipherBytes[7]);
      
      // Reverse rounds 44-60 (5 rounds of mixing) 
      for (let i = 60; i >= 44; i -= 4) {
        x76 = (RC2Algorithm._rotateWordLeft(x76, 11) - ((x10 & ~x54) + (x32 & x54) + this.expandedKey[i + 3])) & 0xFFFF;
        x54 = (RC2Algorithm._rotateWordLeft(x54, 13) - ((x76 & ~x32) + (x10 & x32) + this.expandedKey[i + 2])) & 0xFFFF;
        x32 = (RC2Algorithm._rotateWordLeft(x32, 14) - ((x54 & ~x10) + (x76 & x10) + this.expandedKey[i + 1])) & 0xFFFF;
        x10 = (RC2Algorithm._rotateWordLeft(x10, 15) - ((x32 & ~x76) + (x54 & x76) + this.expandedKey[i])) & 0xFFFF;
      }
      
      // Reverse second mash operation (after round 11)
      x76 = (x76 - this.expandedKey[x54 & 63]) & 0xFFFF;
      x54 = (x54 - this.expandedKey[x32 & 63]) & 0xFFFF;
      x32 = (x32 - this.expandedKey[x10 & 63]) & 0xFFFF;
      x10 = (x10 - this.expandedKey[x76 & 63]) & 0xFFFF;
      
      // Reverse rounds 20-40 (6 rounds of mixing)
      for (let i = 40; i >= 20; i -= 4) {
        x76 = (RC2Algorithm._rotateWordLeft(x76, 11) - ((x10 & ~x54) + (x32 & x54) + this.expandedKey[i + 3])) & 0xFFFF;
        x54 = (RC2Algorithm._rotateWordLeft(x54, 13) - ((x76 & ~x32) + (x10 & x32) + this.expandedKey[i + 2])) & 0xFFFF;
        x32 = (RC2Algorithm._rotateWordLeft(x32, 14) - ((x54 & ~x10) + (x76 & x10) + this.expandedKey[i + 1])) & 0xFFFF;
        x10 = (RC2Algorithm._rotateWordLeft(x10, 15) - ((x32 & ~x76) + (x54 & x76) + this.expandedKey[i])) & 0xFFFF;
      }
      
      // Reverse first mash operation (after round 5)
      x76 = (x76 - this.expandedKey[x54 & 63]) & 0xFFFF;
      x54 = (x54 - this.expandedKey[x32 & 63]) & 0xFFFF;
      x32 = (x32 - this.expandedKey[x10 & 63]) & 0xFFFF;
      x10 = (x10 - this.expandedKey[x76 & 63]) & 0xFFFF;
      
      // Reverse rounds 0-16 (5 rounds of mixing)
      for (let i = 16; i >= 0; i -= 4) {
        x76 = (RC2Algorithm._rotateWordLeft(x76, 11) - ((x10 & ~x54) + (x32 & x54) + this.expandedKey[i + 3])) & 0xFFFF;
        x54 = (RC2Algorithm._rotateWordLeft(x54, 13) - ((x76 & ~x32) + (x10 & x32) + this.expandedKey[i + 2])) & 0xFFFF;
        x32 = (RC2Algorithm._rotateWordLeft(x32, 14) - ((x54 & ~x10) + (x76 & x10) + this.expandedKey[i + 1])) & 0xFFFF;
        x10 = (RC2Algorithm._rotateWordLeft(x10, 15) - ((x32 & ~x76) + (x54 & x76) + this.expandedKey[i])) & 0xFFFF;
      }

      // Pack output (little-endian) using OpCodes
      return [
        ...OpCodes.Unpack16LE(x10),
        ...OpCodes.Unpack16LE(x32),
        ...OpCodes.Unpack16LE(x54),
        ...OpCodes.Unpack16LE(x76)
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