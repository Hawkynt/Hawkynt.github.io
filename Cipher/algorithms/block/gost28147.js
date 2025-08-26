/*
 * GOST 28147-89 Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * GOST 28147-89 - Russian Federal Standard block cipher
 * 64-bit blocks with 256-bit keys, 32 rounds Feistel network
 * Uses 8 S-boxes with 4-bit to 4-bit substitution
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

  class Gost28147Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "GOST 28147-89";
      this.description = "Russian Federal Standard GOST 28147-89 block cipher. Feistel cipher with 64-bit blocks, 256-bit keys, and 32 rounds. Uses 8 S-boxes for 4-bit substitution. Educational implementation of the Soviet/Russian encryption standard.";
      this.inventor = "Soviet Union cryptographers";
      this.year = 1989;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(32, 32, 0)  // GOST 28147-89: 256-bit keys only
      ];
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0)    // 64-bit blocks only
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 4357 - Additional Cryptographic Algorithms for GOST 28147-89", "https://tools.ietf.org/rfc/rfc4357.txt"),
        new LinkItem("GOST 28147-89 Standard", "https://www.tc26.ru/en/standard/gost/"),
        new LinkItem("Wikipedia - GOST block cipher", "https://en.wikipedia.org/wiki/GOST_(block_cipher)")
      ];

      this.references = [
        new LinkItem("RFC 4357 Specification", "https://tools.ietf.org/rfc/rfc4357.txt"),
        new LinkItem("Applied Cryptography - GOST", "https://www.schneier.com/academic/archives/1996/09/description_of_a_new.html"),
        new LinkItem("Crypto++ GOST Implementation", "https://github.com/weidai11/cryptopp/blob/master/gost.cpp"),
        new LinkItem("OpenSSL GOST Implementation", "https://github.com/openssl/openssl/tree/master/engines/e_gost.c")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Weak key classes",
          "Some keys may exhibit weak cryptographic properties",
          "Use random keys and avoid pattern-based key generation"
        ),
        new Vulnerability(
          "S-box dependency",
          "Security depends heavily on the choice of S-boxes",
          "Use standardized S-box sets from RFC 4357"
        )
      ];

      // Test vectors using OpCodes byte arrays
      this.tests = [
        {
          text: "GOST 28147-89 all zeros plaintext - educational test vector",
          uri: "https://tools.ietf.org/rfc/rfc4357.txt",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("db5aa1ddd2c4fabb")
        },
        {
          text: "GOST 28147-89 pattern test vector - educational",
          uri: "https://tools.ietf.org/rfc/rfc4357.txt",
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("29d9ecb64cbf7478")
        },
        {
          text: "GOST 28147-89 all ones boundary test vector - educational",
          uri: "https://tools.ietf.org/rfc/rfc4357.txt",
          input: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
          expected: OpCodes.Hex8ToBytes("c3ac49f9a73a6e65")
        }
      ];

      // GOST 28147-89 S-boxes (RFC 4357 id-Gost28147-89-CryptoPro-A-ParamSet)
      this.GOST_SBOXES = [
        // S0
        [10, 4, 5, 6, 8, 1, 3, 7, 13, 12, 14, 0, 9, 2, 11, 15],
        // S1
        [5, 15, 4, 0, 2, 13, 11, 9, 1, 7, 6, 3, 12, 14, 10, 8],
        // S2 
        [7, 15, 12, 14, 9, 4, 1, 0, 3, 11, 5, 2, 6, 10, 8, 13],
        // S3
        [4, 10, 7, 12, 0, 15, 2, 8, 14, 1, 6, 5, 13, 11, 9, 3],
        // S4
        [7, 6, 4, 11, 9, 12, 2, 10, 1, 8, 0, 14, 15, 13, 3, 5],
        // S5
        [7, 6, 2, 4, 13, 9, 15, 0, 10, 1, 5, 11, 8, 14, 12, 3],
        // S6
        [13, 14, 4, 1, 7, 0, 5, 10, 3, 12, 8, 15, 6, 2, 9, 11],
        // S7
        [1, 3, 10, 9, 5, 11, 4, 15, 8, 6, 7, 14, 13, 0, 2, 12]
      ];
    }

    CreateInstance(isInverse = false) {
      return new Gost28147Instance(this, isInverse);
    }
  }

  class Gost28147Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.subkeys = null;
      this.inputBuffer = [];
      this.BlockSize = 8;     // 64-bit blocks
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.subkeys = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size (256 bits / 32 bytes)
      if (keyBytes.length !== 32) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. GOST 28147-89 requires 32 bytes (256 bits)`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this.subkeys = this._expandKey(keyBytes);
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length for block cipher
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];
      const blockSize = this.BlockSize;

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

    _encryptBlock(block) {
      if (block.length !== 8) {
        throw new Error("GOST 28147-89 requires exactly 8 bytes per block");
      }

      // Split into 32-bit halves (little-endian)
      let left = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let right = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);

      // 32 rounds of Feistel network
      // First 24 rounds: forward key order (K0,K1,...,K7, K0,K1,...,K7, K0,K1,...,K7)
      for (let round = 0; round < 24; round++) {
        const keyIndex = round % 8;
        const temp = left;
        left = right;
        right = temp ^ this._fFunction(right, this.subkeys[keyIndex]);
      }

      // Last 8 rounds: reverse key order (K7,K6,...,K0) - don't swap on final round
      for (let round = 24; round < 32; round++) {
        const keyIndex = 7 - (round - 24);
        if (round === 31) {
          // Final round - no swap
          right = left ^ this._fFunction(right, this.subkeys[keyIndex]);
        } else {
          const temp = left;
          left = right;
          right = temp ^ this._fFunction(right, this.subkeys[keyIndex]);
        }
      }

      // Convert back to bytes (little-endian)
      const leftBytes = OpCodes.Unpack32LE(left);
      const rightBytes = OpCodes.Unpack32LE(right);

      return [...leftBytes, ...rightBytes];
    }

    _decryptBlock(block) {
      if (block.length !== 8) {
        throw new Error("GOST 28147-89 requires exactly 8 bytes per block");
      }

      // Split into 32-bit halves (little-endian)
      let left = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let right = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);

      // 32 rounds of Feistel network (reverse of encryption for decryption)
      // First 8 rounds: reverse key order (K7,K6,...,K0) 
      for (let round = 0; round < 8; round++) {
        const keyIndex = 7 - round;
        const temp = left;
        left = right;
        right = temp ^ this._fFunction(right, this.subkeys[keyIndex]);
      }

      // Last 24 rounds: reverse key order repeated 3 times (K7→K0, K7→K0, K7→K0) - don't swap on final round
      for (let round = 8; round < 32; round++) {
        const keyIndex = 7 - ((round - 8) % 8);
        if (round === 31) {
          // Final round - no swap  
          right = left ^ this._fFunction(right, this.subkeys[keyIndex]);
        } else {
          const temp = left;
          left = right;
          right = temp ^ this._fFunction(right, this.subkeys[keyIndex]);
        }
      }

      // Convert back to bytes (little-endian)
      const leftBytes = OpCodes.Unpack32LE(left);
      const rightBytes = OpCodes.Unpack32LE(right);

      return [...leftBytes, ...rightBytes];
    }

    // F-function: F(R, K) = S(R + K) <<< 11
    _fFunction(right, subkey) {
      // Add subkey modulo 2^32
      const sum = (right + subkey) >>> 0;

      // Apply S-boxes (8 x 4-bit substitutions)
      let result = 0;
      for (let i = 0; i < 8; i++) {
        const nibble = (sum >>> (i * 4)) & 0xF;
        const sboxValue = this.algorithm.GOST_SBOXES[i][nibble];
        result |= (sboxValue << (i * 4));
      }

      // Rotate left by 11 positions
      return OpCodes.RotL32(result, 11);
    }

    _expandKey(keyBytes) {
      // Generate 8 x 32-bit subkeys from 256-bit key
      const subkeys = new Array(8);

      for (let i = 0; i < 8; i++) {
        const offset = i * 4;
        // Pack as little-endian 32-bit word
        subkeys[i] = OpCodes.Pack32LE(
          keyBytes[offset],
          keyBytes[offset + 1],
          keyBytes[offset + 2],
          keyBytes[offset + 3]
        );
      }

      return subkeys;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new Gost28147Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Gost28147Algorithm, Gost28147Instance };
}));