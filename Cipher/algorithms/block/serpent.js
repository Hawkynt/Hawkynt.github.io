/*
 * Serpent Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Serpent Algorithm by Anderson, Biham, and Knudsen
 * - 128-bit block size, variable key length (128, 192, 256 bits)
 * - 32 rounds with 8 different 4x4 S-boxes
 * - Substitution-permutation network structure
 * - AES finalist with conservative security margin
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

  class SerpentAlgorithm extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Serpent";
      this.description = "AES finalist cipher by Anderson, Biham, and Knudsen with 32 rounds and 8 S-boxes. Uses substitution-permutation network with 128-bit blocks and 128/192/256-bit keys. Conservative security design.";
      this.inventor = "Ross Anderson, Eli Biham, Lars Knudsen";
      this.year = 1998;
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null; // Conservative assessment - strong cipher but AES preferred
      this.complexity = AlgorithmFramework.ComplexityType.ADVANCED;
      this.country = AlgorithmFramework.CountryCode.GB;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new AlgorithmFramework.KeySize(16, 32, 8) // 128/192/256-bit
      ];
      this.SupportedBlockSizes = [
        new AlgorithmFramework.KeySize(16, 16, 0) // Fixed 128-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("Serpent Algorithm Specification", "https://www.cl.cam.ac.uk/~rja14/serpent.html"),
        new AlgorithmFramework.LinkItem("Serpent: A New Block Cipher Proposal", "https://www.cl.cam.ac.uk/~rja14/Papers/serpent.pdf"),
        new AlgorithmFramework.LinkItem("NIST AES Candidate Submission", "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("Crypto++ Serpent Implementation", "https://github.com/weidai11/cryptopp/blob/master/serpent.cpp"),
        new AlgorithmFramework.LinkItem("libgcrypt Serpent Implementation", "https://github.com/gpg/libgcrypt/blob/master/cipher/serpent.c"),
        new AlgorithmFramework.LinkItem("Bouncy Castle Serpent Implementation", "https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines")
      ];

      // No known practical attacks against full Serpent
      this.knownVulnerabilities = [
        new AlgorithmFramework.Vulnerability("Performance vs AES", "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development", "Slower than AES, which contributed to AES selection by NIST", "AES preferred for performance-critical applications, Serpent acceptable for high-security needs")
      ];

      // Test vectors from official specification
      this.tests = [
        {
          text: "Serpent 128-bit key test vector",
          uri: "https://www.cl.cam.ac.uk/~rja14/serpent.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("d29d576fcea3a3a7ed9099f29273d78e")
        },
        {
          text: "Serpent 256-bit key test vector", 
          uri: "https://www.cl.cam.ac.uk/~rja14/serpent.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("b2288b968ae8b08648d1ce9606fd992d")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SerpentInstance(this, isInverse);
    }
  }

  class SerpentInstance extends AlgorithmFramework.IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;

      // Serpent constants
      this.ROUNDS = 32;
      this.PHI = 0x9e3779b9; // Golden ratio constant for key schedule

      // Serpent S-boxes as lookup tables (0-15 input -> 0-15 output)
      this.SBOX = [
        [3, 8, 15, 1, 10, 6, 5, 11, 14, 13, 4, 2, 7, 0, 9, 12],  // S0
        [15, 12, 2, 7, 9, 0, 5, 10, 1, 11, 14, 8, 6, 13, 3, 4],   // S1
        [8, 6, 7, 9, 3, 12, 10, 15, 13, 1, 14, 4, 0, 11, 5, 2],   // S2
        [0, 15, 11, 8, 12, 9, 6, 3, 13, 1, 2, 4, 10, 7, 5, 14],   // S3
        [1, 15, 8, 3, 12, 0, 11, 6, 2, 5, 4, 10, 9, 14, 7, 13],   // S4
        [15, 5, 2, 11, 4, 10, 9, 12, 0, 3, 14, 8, 13, 6, 7, 1],   // S5
        [7, 2, 12, 5, 8, 4, 6, 11, 14, 9, 1, 15, 13, 3, 10, 0],   // S6
        [1, 13, 15, 0, 14, 8, 2, 11, 7, 4, 12, 10, 9, 3, 5, 6]    // S7
      ];

      // Inverse S-boxes (reverse lookup)
      this.SBOX_INV = [];
      for (let i = 0; i < 8; i++) {
        this.SBOX_INV[i] = new Array(16);
        for (let j = 0; j < 16; j++) {
          this.SBOX_INV[i][this.SBOX[i][j]] = j;
        }
      }
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
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

      // Generate round keys
      this.roundKeys = this._generateKeySchedule(keyBytes);
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

      // Validate input length
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];

      // Process each 16-byte block
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processedBlock = this.isInverse 
          ? this._decryptBlock(block) 
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    // All S-box operations now use lookup tables above

    // Apply S-box using lookup table (4-bit nibble parallel)
    _sbox(sboxNum, x0, x1, x2, x3) {
      const sbox = this.SBOX[sboxNum];
      const result = [0, 0, 0, 0];

      // Process each 4-bit nibble in parallel
      for (let bit = 0; bit < 32; bit += 4) {
        const mask = 0xF << bit;
        const shift = bit;

        // Extract 4-bit nibbles
        const n0 = (x0 & mask) >>> shift;
        const n1 = (x1 & mask) >>> shift;
        const n2 = (x2 & mask) >>> shift;
        const n3 = (x3 & mask) >>> shift;

        // Apply S-box transformation
        const s0 = sbox[n0];
        const s1 = sbox[n1];
        const s2 = sbox[n2];
        const s3 = sbox[n3];

        // Put back transformed nibbles
        result[0] |= (s0 << shift);
        result[1] |= (s1 << shift);
        result[2] |= (s2 << shift);
        result[3] |= (s3 << shift);
      }

      return result;
    }

    _sboxInv(sboxNum, x0, x1, x2, x3) {
      const sboxInv = this.SBOX_INV[sboxNum];
      const result = [0, 0, 0, 0];

      // Process each 4-bit nibble in parallel
      for (let bit = 0; bit < 32; bit += 4) {
        const mask = 0xF << bit;
        const shift = bit;

        // Extract 4-bit nibbles
        const n0 = (x0 & mask) >>> shift;
        const n1 = (x1 & mask) >>> shift;
        const n2 = (x2 & mask) >>> shift;
        const n3 = (x3 & mask) >>> shift;

        // Apply inverse S-box transformation
        const s0 = sboxInv[n0];
        const s1 = sboxInv[n1];
        const s2 = sboxInv[n2];
        const s3 = sboxInv[n3];

        // Put back transformed nibbles
        result[0] |= (s0 << shift);
        result[1] |= (s1 << shift);
        result[2] |= (s2 << shift);
        result[3] |= (s3 << shift);
      }

      return result;
    }

    // Linear transformation function
    _linearTransform(x0, x1, x2, x3) {
      x0 = OpCodes.RotL32(x0, 13);
      x2 = OpCodes.RotL32(x2, 3);
      x3 ^= x2 ^ ((x0 << 3) >>> 0);
      x1 ^= x0 ^ x2;
      x3 = OpCodes.RotL32(x3, 7);
      x1 = OpCodes.RotL32(x1, 1);
      x0 ^= x1 ^ x3;
      x2 ^= x3 ^ ((x1 << 7) >>> 0);
      x0 = OpCodes.RotL32(x0, 5);
      x2 = OpCodes.RotL32(x2, 22);

      return [x0, x1, x2, x3];
    }

    // Inverse linear transformation function
    _linearTransformInv(x0, x1, x2, x3) {
      x2 = OpCodes.RotR32(x2, 22);
      x0 = OpCodes.RotR32(x0, 5);
      x2 ^= x3 ^ ((x1 << 7) >>> 0);
      x0 ^= x1 ^ x3;
      x3 = OpCodes.RotR32(x3, 7);
      x1 = OpCodes.RotR32(x1, 1);
      x3 ^= x2 ^ ((x0 << 3) >>> 0);
      x1 ^= x0 ^ x2;
      x2 = OpCodes.RotR32(x2, 3);
      x0 = OpCodes.RotR32(x0, 13);

      return [x0, x1, x2, x3];
    }

    // Key scheduling function
    _generateKeySchedule(key) {
      // Pad key to 256 bits if necessary
      const keyWords = new Array(8).fill(0);

      // Copy key bytes into words
      for (let i = 0; i < Math.min(key.length, 32); i++) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = i % 4;
        keyWords[wordIndex] |= (key[i] << (byteIndex * 8));
      }

      // If key is shorter than 256 bits, apply padding
      if (key.length < 32) {
        const padIndex = key.length;
        const wordIndex = Math.floor(padIndex / 4);
        const byteIndex = padIndex % 4;
        keyWords[wordIndex] |= (1 << (byteIndex * 8));
      }

      // Generate extended key (132 words total)
      const extendedKey = new Array(132);

      // Copy initial key words
      for (let i = 0; i < 8; i++) {
        extendedKey[i] = keyWords[i] >>> 0; // Ensure unsigned 32-bit
      }

      // Generate remaining key words
      for (let i = 8; i < 132; i++) {
        const temp = extendedKey[i - 8] ^ extendedKey[i - 5] ^ extendedKey[i - 3] ^ extendedKey[i - 1] ^ this.PHI ^ (i - 8);
        extendedKey[i] = OpCodes.RotL32(temp, 11);
      }

      // Apply S-boxes to subkeys (libgcrypt approach)
      const roundKeys = [];

      for (let round = 0; round < 33; round++) {
        const baseIndex = round * 4;
        const sboxIndex = (32 + 3 - round) % 8; // Correct S-box order for key schedule

        const x0 = extendedKey[baseIndex + 8];
        const x1 = extendedKey[baseIndex + 9];
        const x2 = extendedKey[baseIndex + 10];
        const x3 = extendedKey[baseIndex + 11];

        const transformed = this._sbox(sboxIndex, x0, x1, x2, x3);
        roundKeys.push(transformed);
      }

      return roundKeys;
    }

    // Encrypt a block
    _encryptBlock(block) {
      if (block.length !== 16) {
        throw new Error('Serpent block size must be exactly 16 bytes');
      }

      // Convert plaintext to 32-bit words (little-endian)
      let x0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let x1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let x2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let x3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      // 32 encryption rounds
      for (let round = 0; round < this.ROUNDS; round++) {
        // Key mixing
        x0 ^= this.roundKeys[round][0];
        x1 ^= this.roundKeys[round][1];
        x2 ^= this.roundKeys[round][2];
        x3 ^= this.roundKeys[round][3];

        // S-box substitution (correct order for encryption)
        const sboxIndex = round % 8;
        const sboxResult = this._sbox(sboxIndex, x0, x1, x2, x3);
        x0 = sboxResult[0];
        x1 = sboxResult[1];
        x2 = sboxResult[2];
        x3 = sboxResult[3];

        // Linear transformation (except in the last round)
        if (round < this.ROUNDS - 1) {
          const ltResult = this._linearTransform(x0, x1, x2, x3);
          x0 = ltResult[0];
          x1 = ltResult[1];
          x2 = ltResult[2];
          x3 = ltResult[3];
        }
      }

      // Final key mixing
      x0 ^= this.roundKeys[32][0];
      x1 ^= this.roundKeys[32][1];
      x2 ^= this.roundKeys[32][2];
      x3 ^= this.roundKeys[32][3];

      // Convert back to bytes (little-endian)
      const result = [];
      const bytes0 = OpCodes.Unpack32LE(x0);
      const bytes1 = OpCodes.Unpack32LE(x1);
      const bytes2 = OpCodes.Unpack32LE(x2);
      const bytes3 = OpCodes.Unpack32LE(x3);

      result.push(...bytes0, ...bytes1, ...bytes2, ...bytes3);

      return result;
    }

    // Decrypt a block
    _decryptBlock(block) {
      if (block.length !== 16) {
        throw new Error('Serpent block size must be exactly 16 bytes');
      }

      // Convert ciphertext to 32-bit words (little-endian)
      let x0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let x1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let x2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let x3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

      // Initial key mixing (undo final key mixing)
      x0 ^= this.roundKeys[32][0];
      x1 ^= this.roundKeys[32][1];
      x2 ^= this.roundKeys[32][2];
      x3 ^= this.roundKeys[32][3];

      // 32 decryption rounds (in reverse order)
      for (let round = this.ROUNDS - 1; round >= 0; round--) {
        // Inverse linear transformation first (except for last round which is now first)
        if (round < this.ROUNDS - 1) {
          const ltResult = this._linearTransformInv(x0, x1, x2, x3);
          x0 = ltResult[0];
          x1 = ltResult[1];
          x2 = ltResult[2];
          x3 = ltResult[3];
        }

        // Inverse S-box substitution (correct order for decryption)
        const sboxIndex = round % 8;
        const sboxResult = this._sboxInv(sboxIndex, x0, x1, x2, x3);
        x0 = sboxResult[0];
        x1 = sboxResult[1];
        x2 = sboxResult[2];
        x3 = sboxResult[3];

        // Key mixing (undo the round key)
        x0 ^= this.roundKeys[round][0];
        x1 ^= this.roundKeys[round][1];
        x2 ^= this.roundKeys[round][2];
        x3 ^= this.roundKeys[round][3];
      }

      // Convert back to bytes (little-endian)
      const result = [];
      const bytes0 = OpCodes.Unpack32LE(x0);
      const bytes1 = OpCodes.Unpack32LE(x1);
      const bytes2 = OpCodes.Unpack32LE(x2);
      const bytes3 = OpCodes.Unpack32LE(x3);

      result.push(...bytes0, ...bytes1, ...bytes2, ...bytes3);

      return result;
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new SerpentAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SerpentAlgorithm, SerpentInstance };
}));