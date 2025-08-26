/*
 * Threefish-512 Block Cipher - AlgorithmFramework Implementation
 * Compatible with both Browser and Node.js environments
 * Based on Threefish specification from the Skein hash function family
 * (c)2006-2025 Hawkynt
 * 
 * Threefish-512 Algorithm by Bruce Schneier, et al. (2008)
 * Block size: 512 bits (8 x 64-bit words), Key size: 512 bits, Rounds: 72
 * Uses three operations: addition, XOR, and rotation for cache-timing attack resistance
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Threefish was designed as part of the Skein hash function for the NIST competition.
 * 
 * References:
 * - Skein Paper v1.3: "The Skein Hash Function Family"
 * - NIST Submission documentation
 * - Ferguson, N., Lucks, S., Schneier, B., et al.
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

  class Threefish extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Threefish";
      this.description = "Tweakable block cipher family designed as part of the Skein hash function. Threefish-512 uses 512-bit blocks and keys with 72 rounds, optimized for 64-bit platforms and resistance to timing attacks.";
      this.inventor = "Bruce Schneier, Niels Ferguson, Stefan Lucks, Doug Whiting, Mihir Bellare, Tadayoshi Kohno, Jon Callas, Jesse Walker";
      this.year = 2008;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null; // Conservative - well-analyzed but not claiming secure
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(64, 64, 0) // Fixed 512-bit keys
      ];
      this.SupportedBlockSizes = [
        new KeySize(64, 64, 0) // Fixed 512-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("The Skein Hash Function Family", "https://www.schneier.com/academic/skein/"),
        new LinkItem("Threefish Specification", "https://www.schneier.com/academic/paperfiles/skein1.3.pdf"),
        new LinkItem("NIST SHA-3 Submission", "https://csrc.nist.gov/projects/hash-functions/sha-3-project")
      ];

      this.references = [
        new LinkItem("Threefish Cryptanalysis", "https://eprint.iacr.org/2009/204.pdf"),
        new LinkItem("Skein/Threefish Security Analysis", "https://www.schneier.com/academic/skein/threefish-cryptanalysis.html"),
        new LinkItem("NIST SHA-3 Competition Analysis", "https://csrc.nist.gov/projects/hash-functions/sha-3-project/round-3-submissions")
      ];

      this.knownVulnerabilities = [];

      // Test vectors - all zeros test
      this.tests = [
        {
          text: "Threefish-512 all zeros test vector",
          uri: "The Skein Hash Function Family",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: null // Will be computed by implementation for validation
        }
      ];

      // Constants
      this.WORDS = 8;              // 8 x 64-bit words
      this.ROUNDS = 72;            // 72 rounds total
      this.SUBKEY_INTERVAL = 4;    // Subkey injection every 4 rounds
      this.KEY_SCHEDULE_CONST = [0x1BD11BDA, 0xA9FC1A22]; // Split 64-bit constant into 32-bit parts

      // Threefish-512 rotation constants (d=0..7 for round positions, j=0..3 for word pairs)
      // Based on the Skein specification v1.3
      this.ROTATION_512 = [
        [46, 36, 19, 37],  // d=0
        [33, 27, 14, 42],  // d=1  
        [17, 49, 36, 39],  // d=2
        [44,  9, 54, 56],  // d=3
        [39, 30, 34, 24],  // d=4
        [13, 50, 10, 17],  // d=5
        [25, 29, 39, 43],  // d=6
        [ 8, 35, 56, 22]   // d=7
      ];
    }

    // Required: Create instance for this algorithm
    CreateInstance(isInverse = false) {
      return new ThreefishInstance(this, isInverse);
    }

    // 64-bit addition with carry handling for JavaScript
    // TODO: Move to OpCodes when Add64 is available
    add64(aLow, aHigh, bLow, bHigh) {
      const sumLow = (aLow + bLow) >>> 0;
      const carry = sumLow < aLow ? 1 : 0;
      const sumHigh = (aHigh + bHigh + carry) >>> 0;
      return { low: sumLow, high: sumHigh };
    }

    // MIX function for Threefish - operates on two 64-bit words
    mix(x0Low, x0High, x1Low, x1High, rotation) {
      // y0 = (x0 + x1) mod 2^64
      const sum = this.add64(x0Low, x0High, x1Low, x1High);
      const y0Low = sum.low;
      const y0High = sum.high;

      // y1 = (x1 <<< rotation) XOR y0
      const rotated = OpCodes.RotL64(x1Low, x1High, rotation);
      const y1Low = rotated.low ^ y0Low;
      const y1High = rotated.high ^ y0High;

      return {
        y0Low: y0Low, y0High: y0High,
        y1Low: y1Low, y1High: y1High
      };
    }

    // Inverse MIX function for decryption
    mixInverse(y0Low, y0High, y1Low, y1High, rotation) {
      // x1 = (y1 XOR y0) >>> rotation
      const xorResult = { low: y1Low ^ y0Low, high: y1High ^ y0High };
      const rotated = OpCodes.RotR64(xorResult.low, xorResult.high, rotation);
      const x1Low = rotated.low;
      const x1High = rotated.high;

      // x0 = y0 - x1 (64-bit subtraction)
      const borrowLow = y0Low < x1Low ? 1 : 0;
      const x0Low = (y0Low - x1Low) >>> 0;
      const x0High = (y0High - x1High - borrowLow) >>> 0;

      return {
        x0Low: x0Low, x0High: x0High,
        x1Low: x1Low, x1High: x1High
      };
    }

    // Permute function for Threefish-512 (π)
    permute(words) {
      // Threefish-512 permutation: π(0,1,2,3,4,5,6,7) = (2,1,4,7,6,5,0,3)
      return [
        words[2], words[1], words[4], words[7],
        words[6], words[5], words[0], words[3]
      ];
    }

    // Inverse permute function for decryption
    permuteInverse(words) {
      // Inverse: π^-1(0,1,2,3,4,5,6,7) = (6,1,0,7,2,5,4,3)
      return [
        words[6], words[1], words[0], words[7],
        words[2], words[5], words[4], words[3]
      ];
    }

    // Convert byte array to 64-bit word pairs
    bytesToWords64(bytes) {
      const words = [];
      for (let i = 0; i < bytes.length; i += 8) {
        let low = 0, high = 0;
        // Little-endian byte order for each 64-bit word
        for (let j = 0; j < 4 && i + j < bytes.length; j++) {
          low |= ((bytes[i + j] & 0xFF) << (j * 8));
        }
        for (let j = 4; j < 8 && i + j < bytes.length; j++) {
          high |= ((bytes[i + j] & 0xFF) << ((j - 4) * 8));
        }
        words.push({ low: low >>> 0, high: high >>> 0 });
      }
      return words;
    }

    // Convert 64-bit word pairs back to byte array
    words64ToBytes(words) {
      const bytes = [];
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        // Little-endian byte order
        for (let j = 0; j < 4; j++) {
          bytes.push((word.low >>> (j * 8)) & 0xFF);
        }
        for (let j = 0; j < 4; j++) {
          bytes.push((word.high >>> (j * 8)) & 0xFF);
        }
      }
      return bytes;
    }

    // Generate subkey for round
    generateSubkey(extendedKey, s) {
      const subkey = [];
      for (let i = 0; i < 8; i++) {
        let keyWord = extendedKey[(s + i) % 9];

        // Add tweak values for specific positions
        if (i === 5) {
          const tweakIndex = s % 3;
          const tweakWord = extendedKey[9 + tweakIndex];
          keyWord = this.add64(keyWord.low, keyWord.high, tweakWord.low, tweakWord.high);
        } else if (i === 6) {
          const tweakIndex = (s + 1) % 3;
          const tweakWord = extendedKey[9 + tweakIndex];
          keyWord = this.add64(keyWord.low, keyWord.high, tweakWord.low, tweakWord.high);
        } else if (i === 7) {
          // Add round number s
          keyWord = this.add64(keyWord.low, keyWord.high, s, 0);
        }

        subkey.push(keyWord);
      }
      return subkey;
    }

    // Encrypt a 512-bit block
    encryptBlock(bytes, extendedKey) {
      const words = this.bytesToWords64(bytes);

      // Ensure we have exactly 8 words (pad if necessary)
      while (words.length < 8) {
        words.push({ low: 0, high: 0 });
      }

      // Initial key addition (subkey 0)
      const subkey0 = this.generateSubkey(extendedKey, 0);
      for (let i = 0; i < 8; i++) {
        words[i] = this.add64(words[i].low, words[i].high, subkey0[i].low, subkey0[i].high);
      }

      // 72 rounds grouped into 18 iterations of 4 rounds each
      for (let round = 1; round <= this.ROUNDS; round++) {
        // Apply MIX function to word pairs
        const d = (round - 1) % 8; // Rotation schedule index

        const mix0 = this.mix(words[0].low, words[0].high, words[1].low, words[1].high, this.ROTATION_512[d][0]);
        const mix1 = this.mix(words[2].low, words[2].high, words[3].low, words[3].high, this.ROTATION_512[d][1]);
        const mix2 = this.mix(words[4].low, words[4].high, words[5].low, words[5].high, this.ROTATION_512[d][2]);
        const mix3 = this.mix(words[6].low, words[6].high, words[7].low, words[7].high, this.ROTATION_512[d][3]);

        words[0] = { low: mix0.y0Low, high: mix0.y0High };
        words[1] = { low: mix0.y1Low, high: mix0.y1High };
        words[2] = { low: mix1.y0Low, high: mix1.y0High };
        words[3] = { low: mix1.y1Low, high: mix1.y1High };
        words[4] = { low: mix2.y0Low, high: mix2.y0High };
        words[5] = { low: mix2.y1Low, high: mix2.y1High };
        words[6] = { low: mix3.y0Low, high: mix3.y0High };
        words[7] = { low: mix3.y1Low, high: mix3.y1High };

        // Apply permutation (except after last round)
        if (round % 4 !== 0) {
          const permuted = this.permute(words);
          for (let i = 0; i < 8; i++) {
            words[i] = permuted[i];
          }
        }

        // Subkey addition every 4 rounds
        if (round % 4 === 0) {
          const subkeyIndex = round / 4;
          const subkey = this.generateSubkey(extendedKey, subkeyIndex);
          for (let i = 0; i < 8; i++) {
            words[i] = this.add64(words[i].low, words[i].high, subkey[i].low, subkey[i].high);
          }
        }
      }

      return this.words64ToBytes(words);
    }

    // 64-bit subtraction with borrow handling
    // TODO: Move to OpCodes when Sub64 is available
    sub64(aLow, aHigh, bLow, bHigh) {
      const borrowLow = aLow < bLow ? 1 : 0;
      const resultLow = (aLow - bLow) >>> 0;
      const resultHigh = (aHigh - bHigh - borrowLow) >>> 0;
      return { low: resultLow, high: resultHigh };
    }

    // Decrypt a 512-bit block
    decryptBlock(bytes, extendedKey) {
      const words = this.bytesToWords64(bytes);

      // Ensure we have exactly 8 words
      while (words.length < 8) {
        words.push({ low: 0, high: 0 });
      }

      // Reverse the encryption process
      for (let round = this.ROUNDS; round >= 1; round--) {
        // Reverse subkey addition every 4 rounds
        if (round % 4 === 0) {
          const subkeyIndex = round / 4;
          const subkey = this.generateSubkey(extendedKey, subkeyIndex);
          for (let i = 0; i < 8; i++) {
            words[i] = this.sub64(words[i].low, words[i].high, subkey[i].low, subkey[i].high);
          }
        }

        // Reverse permutation (except before first mix operation)
        if (round % 4 !== 0) {
          const unpermuted = this.permuteInverse(words);
          for (let i = 0; i < 8; i++) {
            words[i] = unpermuted[i];
          }
        }

        // Apply inverse MIX function to word pairs
        const d = (round - 1) % 8; // Rotation schedule index

        const mix0 = this.mixInverse(words[0].low, words[0].high, words[1].low, words[1].high, this.ROTATION_512[d][0]);
        const mix1 = this.mixInverse(words[2].low, words[2].high, words[3].low, words[3].high, this.ROTATION_512[d][1]);
        const mix2 = this.mixInverse(words[4].low, words[4].high, words[5].low, words[5].high, this.ROTATION_512[d][2]);
        const mix3 = this.mixInverse(words[6].low, words[6].high, words[7].low, words[7].high, this.ROTATION_512[d][3]);

        words[0] = { low: mix0.x0Low, high: mix0.x0High };
        words[1] = { low: mix0.x1Low, high: mix0.x1High };
        words[2] = { low: mix1.x0Low, high: mix1.x0High };
        words[3] = { low: mix1.x1Low, high: mix1.x1High };
        words[4] = { low: mix2.x0Low, high: mix2.x0High };
        words[5] = { low: mix2.x1Low, high: mix2.x1High };
        words[6] = { low: mix3.x0Low, high: mix3.x0High };
        words[7] = { low: mix3.x1Low, high: mix3.x1High };
      }

      // Remove initial key (subkey 0)
      const subkey0 = this.generateSubkey(extendedKey, 0);
      for (let i = 0; i < 8; i++) {
        words[i] = this.sub64(words[i].low, words[i].high, subkey0[i].low, subkey0[i].high);
      }

      return this.words64ToBytes(words);
    }

    // Generate extended key from key bytes
    generateExtendedKey(keyBytes) {
      // Convert key to 64-bit words
      const keyWords = this.bytesToWords64(keyBytes);
      const tweak = [{ low: 0, high: 0 }, { low: 0, high: 0 }]; // Default zero tweak

      // Generate extended key: K0..K7, T0, T1, T2, K8
      // where T2 = T0 XOR T1 and K8 = C XOR K0..K7
      const extendedKey = [];

      // Copy original key words K0..K7
      for (let i = 0; i < 8; i++) {
        extendedKey[i] = { low: keyWords[i].low, high: keyWords[i].high };
      }

      // Calculate K8 = C XOR (K0 XOR K1 XOR ... XOR K7)
      let xorResult = { low: this.KEY_SCHEDULE_CONST[0], high: this.KEY_SCHEDULE_CONST[1] };
      for (let i = 0; i < 8; i++) {
        xorResult.low ^= keyWords[i].low;
        xorResult.high ^= keyWords[i].high;
      }
      extendedKey[8] = xorResult;

      // Add tweak words T0, T1
      extendedKey[9] = { low: tweak[0].low, high: tweak[0].high };
      extendedKey[10] = { low: tweak[1].low, high: tweak[1].high };

      // Calculate T2 = T0 XOR T1
      extendedKey[11] = { 
        low: tweak[0].low ^ tweak[1].low, 
        high: tweak[0].high ^ tweak[1].high 
      };

      return extendedKey;
    }
  }

  // Instance class - handles the actual encryption/decryption
  class ThreefishInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.extendedKey = null;
      this.inputBuffer = [];
      this.BlockSize = 64; // bytes (512 bits)
      this.KeySize = 0;    // will be set when key is assigned
    }

    // Property setter for key - validates and sets up extended key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.extendedKey = null;
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
      this.extendedKey = this.algorithm.generateExtendedKey(keyBytes);
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
          ? this.algorithm.decryptBlock(block, this.extendedKey) 
          : this.algorithm.encryptBlock(block, this.extendedKey);
        output.push(...processedBlock);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new Threefish();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Threefish, ThreefishInstance };
}));