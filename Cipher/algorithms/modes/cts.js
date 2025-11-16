/*
 * CTS (Ciphertext Stealing) Mode of Operation
 * Handles arbitrary length messages without padding
 * (c)2006-2025 Hawkynt
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
    root.CTS = factory(root.AlgorithmFramework, root.OpCodes);
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

  class CtsAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "CTS";
      this.description = "Ciphertext Stealing (CTS) mode allows block ciphers to handle arbitrary-length plaintexts without padding by 'stealing' ciphertext bits from the penultimate block to pad the final block. This maintains the original plaintext length while providing the security properties of CBC mode.";
      this.inventor = "Meyer, Matyas";
      this.year = 1982;
      this.category = CategoryType.MODE;
      this.subCategory = "Block Cipher Mode";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.RequiresIV = true;
      this.SupportedIVSizes = [
        new KeySize(8, 32, 8) // Common block sizes: 8 (DES), 16 (AES), 32 (256-bit blocks)
      ];

      this.documentation = [
        new LinkItem("RFC 3962 - AES Encryption for Kerberos 5", "https://tools.ietf.org/rfc/rfc3962.txt"),
        new LinkItem("NIST SP 800-38A - Addendum", "https://csrc.nist.gov/publications/detail/sp/800-38a/addendum/final"),
        new LinkItem("IEEE P1363 - CTS Definition", "https://standards.ieee.org/standard/1363-2000.html")
      ];

      this.references = [
        new LinkItem("Applied Cryptography", "Bruce Schneier - CTS Mode"),
        new LinkItem("Handbook of Applied Cryptography", "Chapter 7 - Block Cipher Modes")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("IV Reuse", "Reusing IV with same key reveals patterns. Always use unique IVs."),
        new Vulnerability("Minimum Length", "Requires at least one full block. Cannot encrypt data shorter than block size."),
        new Vulnerability("Error Propagation", "Like CBC, single-bit errors in ciphertext affect two plaintext blocks.")
      ];

      this.tests = [
        {
          text: "CTS round-trip test #1 - 17 bytes (partial final block)",
          uri: "https://tools.ietf.org/rfc/rfc3962.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("4920776f756c64206c696b652074686520"),
          key: OpCodes.Hex8ToBytes("636869636b656e207465726979616b69"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000")
        },
        {
          text: "CTS round-trip test #2 - 31 bytes (partial final block)",
          uri: "https://tools.ietf.org/rfc/rfc3962.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("4920776f756c64206c696b65207468652047656e6572616c20476175277320"),
          key: OpCodes.Hex8ToBytes("636869636b656e207465726979616b69"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000")
        },
        {
          text: "CTS round-trip test #3 - 16 bytes (exact block boundary)",
          uri: "https://tools.ietf.org/rfc/rfc3962.txt",
          cipher: "AES",
          input: OpCodes.Hex8ToBytes("4920776f756c64206c696b6520746865"),
          key: OpCodes.Hex8ToBytes("636869636b656e207465726979616b69"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CtsModeInstance(this, isInverse);
    }
  }

  /**
 * CtsMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CtsModeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.inputBuffer = [];
      this.iv = null;
    }

    setBlockCipher(cipher) {
      if (!cipher || !cipher.BlockSize) {
        throw new Error("Invalid block cipher instance");
      }
      this.blockCipher = cipher;
    }

    setIV(iv) {
      if (!this.blockCipher) {
        throw new Error("Block cipher must be set before IV");
      }
      if (!iv || iv.length !== this.blockCipher.BlockSize) {
        throw new Error(`IV must be ${this.blockCipher.BlockSize} bytes`);
      }
      this.iv = [...iv];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.iv) {
        throw new Error("IV not set. Call setIV() first.");
      }
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.iv) {
        throw new Error("IV not set. Call setIV() first.");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      const blockSize = this.blockCipher.BlockSize;

      // CTS requires at least one full block
      if (this.inputBuffer.length < blockSize) {
        throw new Error(`CTS requires at least ${blockSize} bytes (one full block)`);
      }

      const result = this.isInverse ? this._decrypt() : this._encrypt();

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return result;
    }

    _encrypt() {
      const blockSize = this.blockCipher.BlockSize;
      const totalLen = this.inputBuffer.length;

      // Handle complete blocks first (CBC mode)
      const fullBlocks = Math.floor(totalLen / blockSize);
      const remainingBytes = totalLen % blockSize;

      let output = [];
      let previousBlock = [...this.iv];

      if (remainingBytes === 0) {
        // Exact multiple of block size - standard CBC
        for (let i = 0; i < fullBlocks; i++) {
          const block = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);

          // XOR with previous ciphertext (or IV)
          const xorBlock = [];
          for (let j = 0; j < blockSize; j++) {
            xorBlock[j] = block[j] ^ previousBlock[j];
          }

          // Encrypt
          const cipher = this.blockCipher.algorithm.CreateInstance(false);
          cipher.key = this.blockCipher.key;
          cipher.Feed(xorBlock);
          const encryptedBlock = cipher.Result();

          output.push(...encryptedBlock);
          previousBlock = [...encryptedBlock];
        }
      } else {
        // CTS mode - handle partial final block

        // Process all but last two blocks normally (CBC)
        for (let i = 0; i < fullBlocks - 1; i++) {
          const block = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);

          // XOR with previous ciphertext (or IV)
          const xorBlock = [];
          for (let j = 0; j < blockSize; j++) {
            xorBlock[j] = block[j] ^ previousBlock[j];
          }

          // Encrypt
          const cipher = this.blockCipher.algorithm.CreateInstance(false);
          cipher.key = this.blockCipher.key;
          cipher.Feed(xorBlock);
          const encryptedBlock = cipher.Result();

          output.push(...encryptedBlock);
          previousBlock = [...encryptedBlock];
        }

        // CTS handling for last two blocks
        const penultimateBlock = this.inputBuffer.slice((fullBlocks - 1) * blockSize, fullBlocks * blockSize);
        const finalPartialBlock = this.inputBuffer.slice(fullBlocks * blockSize);

        // Step 1: Encrypt penultimate block normally
        const xorPenultimate = [];
        for (let j = 0; j < blockSize; j++) {
          xorPenultimate[j] = penultimateBlock[j] ^ previousBlock[j];
        }

        const cipher1 = this.blockCipher.algorithm.CreateInstance(false);
        cipher1.key = this.blockCipher.key;
        cipher1.Feed(xorPenultimate);
        const encryptedPenultimate = cipher1.Result();

        // Step 2: Create final block by padding with stolen ciphertext
        const paddedFinal = [...finalPartialBlock];
        for (let i = remainingBytes; i < blockSize; i++) {
          paddedFinal[i] = encryptedPenultimate[i];
        }

        // Step 3: Encrypt the padded final block
        const xorFinal = [];
        for (let j = 0; j < blockSize; j++) {
          xorFinal[j] = paddedFinal[j] ^ previousBlock[j];
        }

        const cipher2 = this.blockCipher.algorithm.CreateInstance(false);
        cipher2.key = this.blockCipher.key;
        cipher2.Feed(xorFinal);
        const encryptedFinal = cipher2.Result();

        // Step 4: Output final block first, then truncated penultimate
        output.push(...encryptedFinal);
        output.push(...encryptedPenultimate.slice(0, remainingBytes));
      }

      return output;
    }

    _decrypt() {
      const blockSize = this.blockCipher.BlockSize;
      const totalLen = this.inputBuffer.length;

      // Handle complete blocks first
      const fullBlocks = Math.floor(totalLen / blockSize);
      const remainingBytes = totalLen % blockSize;

      let output = [];
      let previousBlock = [...this.iv];

      if (remainingBytes === 0) {
        // Exact multiple of block size - standard CBC
        for (let i = 0; i < fullBlocks; i++) {
          const block = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);

          // Decrypt
          const cipher = this.blockCipher.algorithm.CreateInstance(true);
          cipher.key = this.blockCipher.key;
          cipher.Feed(block);
          const decryptedBlock = cipher.Result();

          // XOR with previous ciphertext (or IV)
          const plainBlock = [];
          for (let j = 0; j < blockSize; j++) {
            plainBlock[j] = decryptedBlock[j] ^ previousBlock[j];
          }

          output.push(...plainBlock);
          previousBlock = [...block];
        }
      } else {
        // CTS mode - handle partial final block

        // Process all but last two blocks normally (CBC)
        for (let i = 0; i < fullBlocks - 1; i++) {
          const block = this.inputBuffer.slice(i * blockSize, (i + 1) * blockSize);

          // Decrypt
          const cipher = this.blockCipher.algorithm.CreateInstance(true);
          cipher.key = this.blockCipher.key;
          cipher.Feed(block);
          const decryptedBlock = cipher.Result();

          // XOR with previous ciphertext (or IV)
          const plainBlock = [];
          for (let j = 0; j < blockSize; j++) {
            plainBlock[j] = decryptedBlock[j] ^ previousBlock[j];
          }

          output.push(...plainBlock);
          previousBlock = [...block];
        }

        // CTS handling for last two blocks
        // Note: Encryption outputs [final_block, truncated_penultimate], so we need to reverse this
        const finalBlock = this.inputBuffer.slice((fullBlocks - 1) * blockSize, fullBlocks * blockSize);
        const truncatedPenultimate = this.inputBuffer.slice(fullBlocks * blockSize);

        // Step 1: Decrypt the final block
        const cipher1 = this.blockCipher.algorithm.CreateInstance(true);
        cipher1.key = this.blockCipher.key;
        cipher1.Feed(finalBlock);
        const decryptedFinal = cipher1.Result();

        // Step 2: Reconstruct full penultimate ciphertext by combining truncated part with stolen bits
        // First reverse the CBC XOR to get the padded final block
        const paddedFinal = [];
        for (let i = 0; i < blockSize; i++) {
          paddedFinal[i] = decryptedFinal[i] ^ previousBlock[i];
        }

        const penultimateCipher = [...truncatedPenultimate];
        for (let i = remainingBytes; i < blockSize; i++) {
          penultimateCipher[i] = paddedFinal[i]; // Use the stolen bytes from padded final
        }

        // Step 3: Decrypt penultimate block
        const cipher2 = this.blockCipher.algorithm.CreateInstance(true);
        cipher2.key = this.blockCipher.key;
        cipher2.Feed(penultimateCipher);
        const decryptedPenultimate = cipher2.Result();

        // Step 4: XOR to get plaintext blocks
        const plainPenultimate = [];
        for (let j = 0; j < blockSize; j++) {
          plainPenultimate[j] = decryptedPenultimate[j] ^ previousBlock[j];
        }

        const plainFinalPartial = [];
        for (let j = 0; j < remainingBytes; j++) {
          plainFinalPartial[j] = paddedFinal[j]; // Extract the original final partial block
        }

        // Output in correct order (penultimate full block, then final partial block)
        output.push(...plainPenultimate);
        output.push(...plainFinalPartial);
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new CtsAlgorithm());

  // ===== EXPORTS =====

  return { CtsAlgorithm, CtsModeInstance };
}));