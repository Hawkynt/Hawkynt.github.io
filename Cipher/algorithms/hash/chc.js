/*
 * CHC (Cipher Hash Construction)
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * CHC constructs a hash function from a block cipher using the Matyas-Meyer-Oseas
 * construction. It requires a block cipher with key size equal to block size.
 * By default, uses Rijndael (AES) with 128-bit blocks.
 *
 * Based on LibTomCrypt implementation by Tom St Denis
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

  // CHC requires a block cipher with block size == key size (default: Rijndael/AES)
  // Ensure Rijndael is loaded (it will self-register if not already registered)
  if (typeof require !== 'undefined') {
    try {
      // Force re-registration by clearing and reloading
      const rijndaelModule = require('../block/rijndael.js');
      // Manually register if the module export includes the algorithm
      if (rijndaelModule && rijndaelModule.RijndaelAlgorithm) {
        const rijndaelAlgo = new rijndaelModule.RijndaelAlgorithm();
        if (!AlgorithmFramework.Find(rijndaelAlgo.name)) {
          AlgorithmFramework.RegisterAlgorithm(rijndaelAlgo);
        }
      }
    } catch (e) {
      // Rijndael will be loaded by test suite or manually
    }
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class CHCInstance extends IHashFunctionInstance {
    constructor(algorithm, blockCipherName) {
      super(algorithm);

      // Store the block cipher name (default to Rijndael)
      this.blockCipherName = blockCipherName || 'Rijndael (AES)';
      this.blockCipher = null;
      this.blockSize = 16; // Default for AES
      this.OutputSize = 16;

      // Lazy initialization will happen on first use
      this._initialized = false;
    }

    _EnsureInitialized() {
      if (this._initialized) return;

      // Get the block cipher (default to Rijndael/AES)
      const blockCipher = AlgorithmFramework.Find(this.blockCipherName);
      if (!blockCipher) {
        throw new Error('CHC requires ' + this.blockCipherName + ' block cipher to be loaded');
      }

      // Verify block cipher has key size == block size
      const blockSize = blockCipher.SupportedBlockSizes && blockCipher.SupportedBlockSizes.length > 0
        ? blockCipher.SupportedBlockSizes[0].minSize
        : 16;

      const hasMatchingKeySize = blockCipher.SupportedKeySizes &&
        blockCipher.SupportedKeySizes.some(ks =>
          ks.minSize <= blockSize && ks.maxSize >= blockSize
        );

      if (!hasMatchingKeySize) {
        throw new Error('CHC requires a block cipher with key size equal to block size');
      }

      // Block size must be > 8 bytes (64 bits)
      if (blockSize <= 8) {
        throw new Error('CHC requires block cipher with block size > 8 bytes');
      }

      this.blockCipher = blockCipher;
      this.blockSize = blockSize;
      this.OutputSize = blockSize;

      this._Reset();
      this._initialized = true;
    }

    _Reset() {
      // Initialize state by encrypting zero block with zero key
      const zeroBlock = new Uint8Array(this.blockSize);
      const zeroKey = new Uint8Array(this.blockSize);

      // Create cipher instance and encrypt zero block
      const cipherInstance = this.blockCipher.CreateInstance(false);
      cipherInstance.key = zeroKey;
      cipherInstance.Feed(zeroBlock);
      const encrypted = cipherInstance.Result();

      // Store as state
      this.state = new Uint8Array(encrypted);

      // Clear sensitive data
      OpCodes.ClearArray(zeroBlock);
      OpCodes.ClearArray(zeroKey);
      if (cipherInstance.Dispose) {
        cipherInstance.Dispose();
      }

      // Initialize buffer for incomplete blocks
      this.buffer = new Uint8Array(this.blockSize);
      this.bufferLength = 0;
      this.totalLength = 0;
    }

    Initialize() {
      this._EnsureInitialized();
      this._Reset();
    }

    Feed(data) {
      this._EnsureInitialized();
      if (!data || data.length === 0) return;

      const input = new Uint8Array(data);
      this.totalLength += input.length;

      let offset = 0;

      // Process any remaining bytes in buffer
      if (this.bufferLength > 0) {
        const needed = this.blockSize - this.bufferLength;
        const available = Math.min(needed, input.length);

        this.buffer.set(input.slice(0, available), this.bufferLength);
        this.bufferLength += available;
        offset = available;

        if (this.bufferLength === this.blockSize) {
          this._CompressBlock(this.buffer);
          this.bufferLength = 0;
        }
      }

      // Process complete blocks
      while (offset + this.blockSize <= input.length) {
        this._CompressBlock(input.slice(offset, offset + this.blockSize));
        offset += this.blockSize;
      }

      // Store remaining bytes in buffer
      if (offset < input.length) {
        const remaining = input.slice(offset);
        this.buffer.set(remaining, 0);
        this.bufferLength = remaining.length;
      }
    }

    Result() {
      this._EnsureInitialized();
      // Save current state for multiple Result() calls
      const originalState = this.state.slice();
      const originalBuffer = this.buffer.slice();
      const originalBufferLength = this.bufferLength;
      const originalTotalLength = this.totalLength;

      // CHC padding (Merkle-Damgard style)
      // Increase the length of the message
      const msgLength = this.totalLength;

      // Append the '1' bit (0x80)
      const paddingStart = new Uint8Array(1);
      paddingStart[0] = 0x80;

      // Calculate how much padding we need
      // We need to leave room for 8-byte length at the end
      const currentLength = this.bufferLength + 1; // +1 for the 0x80 byte
      let paddingZeros;

      if (currentLength > this.blockSize - 8) {
        // Need an extra block
        paddingZeros = (this.blockSize - currentLength) + (this.blockSize - 8);
      } else {
        // Fits in current block
        paddingZeros = this.blockSize - 8 - currentLength;
      }

      // Create padding: 0x80 + zeros + length
      const totalPadding = 1 + paddingZeros + 8;
      const padding = new Uint8Array(totalPadding);
      padding[0] = 0x80;

      // Store length in bits as 64-bit little-endian (like LibTomCrypt STORE64L)
      const bitLengthLow = OpCodes.ToUint32(msgLength * 8);
      const bitLengthHigh = 0; // For practical message sizes, high 32 bits are 0

      // Pack low 32 bits (little-endian)
      const lowBytes = OpCodes.Unpack32LE(bitLengthLow);
      padding[totalPadding - 8] = lowBytes[0];
      padding[totalPadding - 7] = lowBytes[1];
      padding[totalPadding - 6] = lowBytes[2];
      padding[totalPadding - 5] = lowBytes[3];

      // Pack high 32 bits (little-endian)
      const highBytes = OpCodes.Unpack32LE(bitLengthHigh);
      padding[totalPadding - 4] = highBytes[0];
      padding[totalPadding - 3] = highBytes[1];
      padding[totalPadding - 2] = highBytes[2];
      padding[totalPadding - 1] = highBytes[3];

      // Feed the padding
      this.Feed(padding);

      // Copy output
      const result = Array.from(this.state);

      // Restore original state (so Result() can be called multiple times)
      this.state = originalState;
      this.buffer = originalBuffer;
      this.bufferLength = originalBufferLength;
      this.totalLength = originalTotalLength;

      return result;
    }

    _CompressBlock(block) {
      // CHC Matyas-Meyer-Oseas compression function:
      // key    <= state
      // T0,T1  <= block
      // T0     <= encrypt(key, T0)
      // state  <= state XOR T0 XOR T1

      // T1 = copy of input block
      const T1 = new Uint8Array(block);

      // Create cipher instance with state as key
      const cipherInstance = this.blockCipher.CreateInstance(false);
      cipherInstance.key = Array.from(this.state);

      // Encrypt the input block: T0 = encrypt(state, block)
      cipherInstance.Feed(block);
      const T0 = new Uint8Array(cipherInstance.Result());

      // state = state XOR T0 XOR T1
      for (let i = 0; i < this.blockSize; i++) {
        this.state[i] ^= T0[i] ^ T1[i];
      }

      // Clear sensitive data
      OpCodes.ClearArray(T0);
      OpCodes.ClearArray(T1);
      if (cipherInstance.Dispose) {
        cipherInstance.Dispose();
      }
    }
  }

  class CHCAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Basic information
      this.name = "CHC";
      this.description = "Cipher Hash Construction builds a cryptographic hash from a block cipher using Matyas-Meyer-Oseas construction. Default implementation uses AES-128.";
      this.inventor = "Tom St Denis";
      this.year = 2005;
      this.category = CategoryType.HASH;
      this.subCategory = "Hash Construction";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Capabilities (depends on underlying cipher, default AES-128 = 16 bytes)
      this.SupportedOutputSizes = [{ minSize: 16, maxSize: 16, stepSize: 1 }];

      // Documentation
      this.documentation = [
        new LinkItem("LibTomCrypt CHC Implementation", "https://github.com/libtom/libtomcrypt/blob/develop/src/hashes/chc/chc.c"),
        new LinkItem("Matyas-Meyer-Oseas Construction", "https://en.wikipedia.org/wiki/One-way_compression_function#Matyas%E2%80%93Meyer%E2%80%93Oseas"),
        new LinkItem("LibTomCrypt Documentation", "https://github.com/libtom/libtomcrypt/blob/develop/doc/crypt.pdf")
      ];

      // References
      this.references = [
        new LinkItem("Hash Functions from Block Ciphers", "https://www.iacr.org/archive/crypto2004/31520570/pq.pdf"),
        new LinkItem("LibTomCrypt Source Repository", "https://github.com/libtom/libtomcrypt")
      ];

      // Test vectors from LibTomCrypt chc.c self-test
      // Uses AES-128 as the underlying block cipher
      this.tests = [
        {
          input: OpCodes.AnsiToBytes("hello world"),
          expected: OpCodes.Hex8ToBytes("cf579dc30a0eea610d5447c43c06f54e"),
          text: "LibTomCrypt Test Vector - 'hello world' with AES-128",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/hashes/chc/chc.c"
        }
      ];
    }

    CreateInstance(isInverse = false) {
      // Hash functions don't have an inverse operation
      if (isInverse) {
        return null;
      }

      // Use default AES-128 (Rijndael)
      return new CHCInstance(this, null);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new CHCAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CHCAlgorithm, CHCInstance };
}));
