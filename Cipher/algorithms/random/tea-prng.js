/*
 * TEA-PRNG (Tiny Encryption Algorithm as PRNG)
 * Based on TEA block cipher by David Wheeler and Roger Needham (1994)
 * Counter mode operation for pseudorandom number generation
 *
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          RandomGenerationAlgorithm, IRandomGeneratorInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  class TEAPRNGAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "TEA-PRNG";
      this.description = "Pseudorandom number generator based on the Tiny Encryption Algorithm (TEA) operating in counter mode. Encrypts sequential 64-bit counter values to produce random output. Simple and fast but TEA's cryptographic weaknesses limit security.";
      this.inventor = "David Wheeler, Roger Needham";
      this.year = 1994;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Pseudorandom Number Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.GB;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(16, 16, 0)]; // Fixed 128-bit seed (TEA key size)

      // Documentation
      this.documentation = [
        new LinkItem(
          "TEA: A Tiny Encryption Algorithm",
          "https://www.cix.co.uk/~klockstone/tea.htm"
        ),
        new LinkItem(
          "Cambridge Computer Laboratory TEA",
          "https://www.cl.cam.ac.uk/teaching/1415/SecurityII/tea.pdf"
        ),
        new LinkItem(
          "Original TEA Paper",
          "https://link.springer.com/chapter/10.1007/3-540-60590-8_29"
        ),
        new LinkItem(
          "Counter Mode Operation",
          "https://en.wikipedia.org/wiki/Block_cipher_mode_of_operation#Counter_(CTR)"
        )
      ];

      this.references = [
        new LinkItem(
          "Crypto++ TEA Implementation",
          "https://github.com/weidai11/cryptopp/blob/master/tea.cpp"
        ),
        new LinkItem(
          "Bouncy Castle TEA Implementation",
          "https://github.com/bcgit/bc-csharp/blob/master/crypto/src/crypto/engines/TEAEngine.cs"
        )
      ];

      // Test vectors: Verify TEA cipher correctness in counter mode
      // These validate that TEA encryption is working correctly
      // Generated using TEA block cipher with counter values as plaintext
      this.tests = [
        {
          text: "TEA-PRNG with all-zero seed, counter=0 - First block",
          uri: "https://www.cix.co.uk/~klockstone/tea.htm",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("41EA3A0A94BAA940") // TEA encrypt(counter=0) with key=0
        },
        {
          text: "TEA-PRNG with all-zero seed - First 16 bytes (2 blocks)",
          uri: "https://www.cix.co.uk/~klockstone/tea.htm",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          outputSize: 16,
          // Counter 0: 41EA3A0A94BAA940, Counter 1: 414091A7A27F9C32
          expected: OpCodes.Hex8ToBytes("41EA3A0A94BAA940414091A7A27F9C32")
        },
        {
          text: "TEA-PRNG with all-ones seed - First block",
          uri: "https://www.cix.co.uk/~klockstone/tea.htm",
          input: null,
          seed: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("B94A017DDE3F22CB") // TEA encrypt(counter=0) with key=0xFF...
        },
        {
          text: "TEA-PRNG with sequential seed - First 24 bytes (3 blocks)",
          uri: "https://www.cix.co.uk/~klockstone/tea.htm",
          input: null,
          seed: OpCodes.Hex8ToBytes("0123456789ABCDEFFEDCBA9876543210"),
          outputSize: 24,
          // Counter 0: F257F7402D578CEE, Counter 1: 9000E53C6E764572, Counter 2: 47665AEC5CCF9639
          expected: OpCodes.Hex8ToBytes("F257F7402D578CEE9000E53C6E76457247665AEC5CCF9639")
        },
        {
          text: "TEA-PRNG with ASCII seed - First block",
          uri: "https://www.cix.co.uk/~klockstone/tea.htm",
          input: null,
          seed: OpCodes.AnsiToBytes("YELLOW SUBMARINE"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("AA3DC1152C9E1C64") // TEA encrypt(counter=0) with ASCII key
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new TEAPRNGInstance(this);
    }
  }

  /**
 * TEAPRNG cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TEAPRNGInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // PRNG state
      this._key = null;
      this._counter = 0n; // 64-bit counter
      this._ready = false;

      // TEA constants
      this.DELTA = 0x9E3779B9; // Magic constant (2^32 / golden ratio)
      this.ROUNDS = 32;        // Standard TEA uses 32 rounds
    }

    /**
     * Set seed value (becomes TEA encryption key)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._key = null;
        this._ready = false;
        return;
      }

      // Validate seed size (must be 16 bytes for TEA key)
      if (seedBytes.length !== 16) {
        throw new Error(`Invalid seed size: ${seedBytes.length} bytes. TEA-PRNG requires exactly 16 bytes`);
      }

      // Store key and reset counter
      this._key = [...seedBytes];
      this._counter = 0n;
      this._ready = true;
    }

    get seed() {
      return this._key ? [...this._key] : null;
    }

    /**
     * Encrypt a 64-bit block using TEA cipher
     * @param {BigInt} counterValue - 64-bit counter to encrypt
     * @returns {Array} 8-byte encrypted block
     */
    _encryptCounter(counterValue) {
      // Convert counter to two 32-bit words (big-endian)
      let v0 = Number(OpCodes.AndN(OpCodes.ShiftRn(counterValue, 32n), 0xFFFFFFFFn));
      let v1 = Number(OpCodes.AndN(counterValue, 0xFFFFFFFFn));

      // Extract key as four 32-bit words (big-endian)
      const k0 = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
      const k1 = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
      const k2 = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
      const k3 = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);

      let sum = 0;

      // 32 rounds of TEA encryption using OpCodes
      for (let i = 0; i < this.ROUNDS; ++i) {
        sum = OpCodes.Add32(sum, this.DELTA);
        v0 = OpCodes.Add32(v0, OpCodes.Add32(OpCodes.Shl32(v1, 4), k0)^OpCodes.Add32(v1, sum)^OpCodes.Add32(OpCodes.Shr32(v1, 5), k1));
        v1 = OpCodes.Add32(v1, OpCodes.Add32(OpCodes.Shl32(v0, 4), k2)^OpCodes.Add32(v0, sum)^OpCodes.Add32(OpCodes.Shr32(v0, 5), k3));
      }

      // Convert back to bytes (big-endian)
      const v0Bytes = OpCodes.Unpack32BE(v0);
      const v1Bytes = OpCodes.Unpack32BE(v1);

      return [...v0Bytes, ...v1Bytes];
    }

    /**
     * Generate random bytes using TEA in counter mode
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('TEA-PRNG not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      // Generate blocks until we have enough bytes
      while (output.length < length) {
        // Encrypt current counter value
        const block = this._encryptCounter(this._counter);

        // Increment counter for next block using OpCodes
        this._counter = OpCodes.AndN(this._counter + 1n, 0xFFFFFFFFFFFFFFFFn); // Keep counter at 64-bit

        // Add bytes from block (may be partial for last block)
        for (let i = 0; i < block.length && output.length < length; ++i) {
          output.push(block[i]);
        }
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      // For PRNG, Feed is typically not used (TEA-PRNG is deterministic)
      // Could be used for reseeding if needed
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default to 32 bytes
      const size = this._outputSize || 32;
      return this.NextBytes(size);
    }

    /**
     * Set output size for Result() method
     */
    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize || 32;
    }
  }

  // Register algorithm
  const algorithmInstance = new TEAPRNGAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { TEAPRNGAlgorithm, TEAPRNGInstance };
}));
