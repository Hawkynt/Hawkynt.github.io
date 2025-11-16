/* LION Block Cipher Construction
 * Production Implementation - Bit-perfect with Botan reference
 * (c)2006-2025 Hawkynt
 *
 * LION (Low-complexity Internalized Optimized Network) is a variable block-size
 * cipher construction designed by Ross Anderson and Eli Biham. It combines a
 * hash function and stream cipher to create a block cipher suitable for
 * encrypting large blocks (up to megabytes).
 *
 * Construction:
 * - Split block into LEFT (hash_size bytes) and RIGHT (remaining bytes)
 * - Encryption: 3-round Feistel-like structure
 *   1. L0 = L ⊕ K1; R0 = R ⊕ S(L0)
 *   2. L1 = L0 ⊕ H(R0)
 *   3. L2 = L1 ⊕ K2; R1 = R0 ⊕ S(L2)
 *
 * This implementation uses SHA-1 (20-byte output) and RC4 as inner primitives.
 * Block size is 64 bytes (512 bits) matching Botan test vectors.
 *
 * SECURITY STATUS: Educational - Not for production use
 * The security depends entirely on the inner hash and stream cipher.
 * SHA-1 is broken, RC4 is broken, so LION(SHA-1,RC4) is not secure.
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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Load SHA-1 and RC4 algorithms (must be loaded before LION)
  let SHA1Class = null;
  let RC4Class = null;

  // Attempt to load dependencies
  if (typeof require !== 'undefined') {
    try {
      const sha1Module = require('../hash/sha1.js');
      SHA1Class = sha1Module.SHA1Algorithm;
      const rc4Module = require('../stream/rc4.js');
      RC4Class = rc4Module.RC4Algorithm;
    } catch (e) {
      // Dependencies not available via require
    }
  }

  // Check global namespace if require failed
  if (!SHA1Class && typeof root !== 'undefined' && root.AlgorithmFramework) {
    // Try to find registered algorithms
    const registry = root.AlgorithmFramework.GetAlgorithmRegistry ?
                     root.AlgorithmFramework.GetAlgorithmRegistry() : null;
    if (registry) {
      const sha1Algo = registry.find(a => a.name === 'SHA-1');
      if (sha1Algo) SHA1Class = sha1Algo.constructor;
      const rc4Algo = registry.find(a => a.name === 'RC4');
      if (rc4Algo) RC4Class = rc4Algo.constructor;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * LIONAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class LIONAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "LION";
      this.description = "Variable block-size cipher construction combining hash function and stream cipher in three-round Feistel structure. Security depends on inner primitives. This implementation uses SHA-1 and RC4.";
      this.inventor = "Ross Anderson, Eli Biham";
      this.year = 1996;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher Construction";
      this.securityStatus = null; // Educational - security depends on inner algorithms
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.GB; // Anderson is British

      // LION block size is variable; with SHA-1 (20 bytes), minimum is 41 bytes
      // Standard implementation uses 64-byte blocks
      this.SupportedBlockSizes = [
        new KeySize(64, 64, 1) // Fixed at 64 bytes for this implementation
      ];

      // Key size: 2 bytes to 2 * hash_output_size (2 to 40 bytes for SHA-1)
      this.SupportedKeySizes = [
        new KeySize(2, 40, 2) // 2 to 40 bytes (even numbers only)
      ];

      // Documentation
      this.documentation = [
        new LinkItem("Original Paper: Two Practical and Provably Secure Block Ciphers",
                     "https://www.cl.cam.ac.uk/~rja14/Papers/bear-lion.pdf"),
        new LinkItem("Wikipedia - BEAR and LION Ciphers",
                     "https://en.wikipedia.org/wiki/BEAR_and_LION_ciphers"),
        new LinkItem("Botan Library Implementation",
                     "https://github.com/randombit/botan/blob/master/src/lib/block/lion/lion.cpp")
      ];

      // Botan test vectors
      this.tests = [
        {
          text: "Botan Test Vector - LION(SHA-1,RC4,64)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/block/lion.vec",
          input: OpCodes.Hex8ToBytes("1112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F3031323334353637382015B3DB2DC49529C2D26B1F1E86C65EC7B946AB2D2E2F30"),
          key: OpCodes.Hex8ToBytes("00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF"),
          expected: OpCodes.Hex8ToBytes("BCE3BE866EF63AF5AD4CBA8C3CAA2AA9CF9BB3CC2A3D77FF7C05D0EC7E684AD6134ABFD7DF6842B7292071064C9F4DFE4B9D34EAE89201136B7CE70ED4A190DB")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LIONInstance(this, isInverse);
    }
  }

  // Instance class implementing LION cipher
  /**
 * LION cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LIONInstance extends IBlockCipherInstance {
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
      this.key1 = null; // First half of key
      this.key2 = null; // Second half of key

      // Hash function parameters (SHA-1)
      this.hashSize = 20; // SHA-1 produces 20-byte output
      this.blockSize = 64; // Total block size in bytes
      this.leftSize = 20; // Left part size (hash output size)
      this.rightSize = 44; // Right part size (64 - 20)
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.key1 = null;
        this.key2 = null;
        return;
      }

      // Validate key size (2 to 40 bytes for SHA-1, must be even)
      if (keyBytes.length < 2 || keyBytes.length > 40 || (keyBytes.length % 2) !== 0) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. LION requires 2-40 bytes (even numbers).`);
      }

      this._key = [...keyBytes];

      // Split key into two halves, then zero-pad to hashSize
      const halfSize = keyBytes.length / 2;

      this.key1 = new Array(this.hashSize);
      this.key2 = new Array(this.hashSize);

      // Initialize with zeros
      for (let i = 0; i < this.hashSize; i++) {
        this.key1[i] = 0;
        this.key2[i] = 0;
      }

      // Copy first half to key1
      for (let i = 0; i < halfSize; i++) {
        this.key1[i] = keyBytes[i];
      }

      // Copy second half to key2
      for (let i = 0; i < halfSize; i++) {
        this.key2[i] = keyBytes[halfSize + i];
      }
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // SHA-1 hash function wrapper
    _hash(data) {
      // Use external SHA-1 module if available (fully OpCodes-optimized)
      if (typeof require !== 'undefined') {
        try {
          const sha1Module = require('../hash/sha1.js');
          const sha1Instance = sha1Module.SHA1Algorithm.prototype.CreateInstance.call(new sha1Module.SHA1Algorithm());
          sha1Instance.Feed(data);
          return sha1Instance.Result();
        } catch (e) {
          // Fall through to embedded implementation
        }
      }

      // Embedded SHA-1 implementation for standalone use
      // NOTE: Contains direct bit operations for educational clarity
      // Production use relies on external SHA-1 module with full OpCodes integration
      let h0 = 0x67452301;
      let h1 = 0xEFCDAB89;
      let h2 = 0x98BADCFE;
      let h3 = 0x10325476;
      let h4 = 0xC3D2E1F0;

      const msgLen = data.length;
      const bitLen = msgLen * 8;

      const paddedData = [...data];
      paddedData.push(0x80);

      while ((paddedData.length % 64) !== 56) {
        paddedData.push(0x00);
      }

      for (let i = 0; i < 4; i++) paddedData.push(0x00);
      const lenBytes = OpCodes.Unpack32BE(bitLen);
      for (let i = 0; i < 4; i++) paddedData.push(lenBytes[i]);

      for (let offset = 0; offset < paddedData.length; offset += 64) {
        const block = paddedData.slice(offset, offset + 64);

        const W = new Array(80);
        for (let t = 0; t < 16; t++) {
          W[t] = OpCodes.Pack32BE(block[t*4], block[t*4+1], block[t*4+2], block[t*4+3]);
        }
        for (let t = 16; t < 80; t++) {
          const xor1 = W[t-3] >>> 0;
          const xor2 = W[t-8] >>> 0;
          const xor3 = W[t-14] >>> 0;
          const xor4 = W[t-16] >>> 0;
          const temp = ((xor1 ^ xor2) ^ (xor3 ^ xor4)) >>> 0;
          W[t] = OpCodes.RotL32(temp, 1);
        }

        let a = h0, b = h1, c = h2, d = h3, e = h4;

        for (let t = 0; t < 80; t++) {
          let f, k;
          if (t < 20) {
            f = ((b & c) | ((~b) & d)) >>> 0;
            k = 0x5A827999;
          } else if (t < 40) {
            f = ((b ^ c) ^ d) >>> 0;
            k = 0x6ED9EBA1;
          } else if (t < 60) {
            f = ((b & c) | ((b & d) | (c & d))) >>> 0;
            k = 0x8F1BBCDC;
          } else {
            f = ((b ^ c) ^ d) >>> 0;
            k = 0xCA62C1D6;
          }

          const temp = (OpCodes.RotL32(a, 5) + f + e + k + W[t]) >>> 0;
          e = d;
          d = c;
          c = OpCodes.RotL32(b, 30);
          b = a;
          a = temp;
        }

        h0 = (h0 + a) >>> 0;
        h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0;
        h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0;
      }

      const result = [];
      [h0, h1, h2, h3, h4].forEach(word => {
        const bytes = OpCodes.Unpack32BE(word);
        result.push(...bytes);
      });

      return result;
    }

    // RC4 stream cipher wrapper
    _rc4(key, data) {
      // Embedded RC4 implementation for LION construction
      // NOTE: Contains direct bit operations for performance
      // The external RC4 module is not used here to avoid circular dependencies

      // RC4 Key Scheduling Algorithm (KSA)
      const S = new Array(256);
      for (let i = 0; i < 256; i++) {
        S[i] = i;
      }

      let j = 0;
      for (let i = 0; i < 256; i++) {
        j = (j + S[i] + key[i % key.length]) & 0xFF;
        // Swap S[i] and S[j]
        const temp = S[i];
        S[i] = S[j];
        S[j] = temp;
      }

      // Pseudo-Random Generation Algorithm (PRGA)
      let i = 0;
      j = 0;
      const output = [];

      for (let k = 0; k < data.length; k++) {
        i = (i + 1) & 0xFF;
        j = (j + S[i]) & 0xFF;

        // Swap S[i] and S[j]
        const temp = S[i];
        S[i] = S[j];
        S[j] = temp;

        const t = (S[i] + S[j]) & 0xFF;
        const keystreamByte = S[t];
        const ciphertextByte = (data[k] ^ keystreamByte) & 0xFF;
        output.push(ciphertextByte);
      }

      return output;
    }

    // Feed/Result pattern implementation
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }
      if (this.inputBuffer.length % this.blockSize !== 0) {
        throw new Error(`Input must be multiple of block size (${this.blockSize} bytes)`);
      }

      const output = [];

      // Process each block
      for (let blockIdx = 0; blockIdx < this.inputBuffer.length; blockIdx += this.blockSize) {
        const block = this.inputBuffer.slice(blockIdx, blockIdx + this.blockSize);

        const inL = block.slice(0, this.leftSize);
        const inR = block.slice(this.leftSize);

        let outL, outR;

        if (this.isInverse) {
          // Decryption (reverse of encryption)

          // Step 1: buffer = inL XOR K2; outR = RC4(buffer, inR)
          let buffer = OpCodes.XorArrays(inL, this.key2);
          outR = this._rc4(buffer, inR);

          // Step 2: hash = H(outR); outL = inL XOR hash
          const hash = this._hash(outR);
          outL = OpCodes.XorArrays(inL, hash);

          // Step 3: buffer = outL XOR K1; outR = RC4(buffer, outR)
          buffer = OpCodes.XorArrays(outL, this.key1);
          outR = this._rc4(buffer, outR);

        } else {
          // Encryption following Botan's exact sequence

          // Step 1: buffer = inL XOR K1; outR = RC4(buffer, inR)
          let buffer = OpCodes.XorArrays(inL, this.key1);
          outR = this._rc4(buffer, inR);

          // Step 2: hash = H(outR); outL = inL XOR hash
          const hash = this._hash(outR);
          outL = OpCodes.XorArrays(inL, hash);

          // Step 3: buffer = outL XOR K2; outR = RC4(buffer, outR)
          buffer = OpCodes.XorArrays(outL, this.key2);
          outR = this._rc4(buffer, outR);
        }

        output.push(...outL, ...outR);
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // Register algorithm
  const algorithmInstance = new LIONAlgorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return { LIONAlgorithm, LIONInstance };
}));
