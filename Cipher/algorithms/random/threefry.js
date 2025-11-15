/*
 * Threefry2x64-20 Counter-Based Pseudo-Random Number Generator
 * From the Random123 library by D. E. Shaw Research
 *
 * Threefry is a counter-based PRNG based on the Threefish block cipher's round function.
 * It uses 64-bit arithmetic with addition, rotation, and XOR operations.
 *
 * Key features:
 * - Counter-based (no internal state, pure function of counter+key)
 * - Trivially parallelizable (any counter can be computed independently)
 * - Period: 2^128
 * - Passes all SmallCrush, Crush, and BigCrush tests from TestU01
 * - Based on Threefish tweakable block cipher
 *
 * Reference: "Parallel Random Numbers: As Easy as 1, 2, 3"
 * John K. Salmon, Mark A. Moraes, Ron O. Dror, David E. Shaw
 * SC11, November 2011
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

  // Threefry2x64-20 constants from Random123 library
  const SKEIN_KS_PARITY_64 = 0x1BD11BDAA9FC1A22n; // Key schedule parity constant

  // Rotation constants for Threefry2x64 (8 constants, applied in groups during 20 rounds)
  const ROTATION_CONSTANTS = [16, 42, 12, 31, 16, 32, 24, 21];

  /**
   * Helper: Convert 8 bytes to 64-bit BigInt (little-endian)
   */
  function bytesToBigInt64LE(bytes, offset) {
    return (
      (BigInt(bytes[offset + 7]) << 56n) |
      (BigInt(bytes[offset + 6]) << 48n) |
      (BigInt(bytes[offset + 5]) << 40n) |
      (BigInt(bytes[offset + 4]) << 32n) |
      (BigInt(bytes[offset + 3]) << 24n) |
      (BigInt(bytes[offset + 2]) << 16n) |
      (BigInt(bytes[offset + 1]) << 8n) |
      BigInt(bytes[offset + 0])
    );
  }

  /**
   * Helper: Convert 64-bit BigInt to 8 bytes (little-endian)
   */
  function bigInt64ToBytes(value) {
    const mask = 0xFFn;
    return [
      Number(value & mask),
      Number((value >> 8n) & mask),
      Number((value >> 16n) & mask),
      Number((value >> 24n) & mask),
      Number((value >> 32n) & mask),
      Number((value >> 40n) & mask),
      Number((value >> 48n) & mask),
      Number((value >> 56n) & mask)
    ];
  }

  /**
   * Single Threefry2x64 round function
   * Implements the Threefish-based round: Add, Rotate, XOR
   */
  function threefry2x64Round(x0, x1, rotation) {
    // Add operation
    x0 = (x0 + x1) & 0xFFFFFFFFFFFFFFFFn;

    // Rotate x1 using OpCodes
    x1 = OpCodes.RotL64n(x1, rotation);

    // XOR with x0
    x1 = x1 ^ x0;

    return [x0, x1];
  }

  /**
   * Threefry2x64-20: 20 rounds of the Threefry transformation
   *
   * @param {Array} counter - [c0, c1] as BigInt values
   * @param {Array} key - [k0, k1] as BigInt values
   * @returns {Array} [result0, result1] as BigInt values
   */
  function threefry2x64_20(counter, key) {
    const mask64 = 0xFFFFFFFFFFFFFFFFn;

    // Key schedule setup
    const ks = [
      key[0] & mask64,
      key[1] & mask64,
      (key[0] ^ key[1] ^ SKEIN_KS_PARITY_64) & mask64
    ];

    let x0 = counter[0] & mask64;
    let x1 = counter[1] & mask64;

    // 20 rounds, with key injection every 4 rounds
    for (let round = 0; round < 20; ++round) {
      // Key injection at rounds 0, 4, 8, 12, 16
      if (round % 4 === 0) {
        const s = round / 4;
        x0 = (x0 + ks[s % 3]) & mask64;
        x1 = (x1 + ks[(s + 1) % 3] + BigInt(s)) & mask64;
      }

      // Apply round function with appropriate rotation constant
      const rotation = ROTATION_CONSTANTS[round % 8];
      [x0, x1] = threefry2x64Round(x0, x1, rotation);
    }

    // Final key injection (round 20)
    const s = 5; // 20 / 4
    x0 = (x0 + ks[s % 3]) & mask64;
    x1 = (x1 + ks[(s + 1) % 3] + BigInt(s)) & mask64;

    return [x0, x1];
  }

  class ThreefryAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Threefry2x64-20";
      this.description = "Counter-based PRNG using Threefish block cipher round function. Trivially parallelizable with 2^128 period, passes all TestU01 statistical tests. Part of the Random123 library by D. E. Shaw Research.";
      this.inventor = "John K. Salmon, Mark A. Moraes, Ron O. Dror, David E. Shaw";
      this.year = 2011;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Counter-Based PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.IsCounterBased = true; // Special property: no state, pure function
      this.SupportedKeySizes = [new KeySize(16, 16, 1)]; // 128-bit key (2x 64-bit words)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: Parallel Random Numbers: As Easy as 1, 2, 3 (SC11, 2011)",
          "https://www.thesalmons.org/john/random123/papers/random123sc11.pdf"
        ),
        new LinkItem(
          "Random123 Library Documentation",
          "https://www.thesalmons.org/john/random123/releases/latest/docs/index.html"
        ),
        new LinkItem(
          "Random123 GitHub Repository",
          "https://github.com/DEShawResearch/random123"
        ),
        new LinkItem(
          "Threefry Header Reference",
          "https://www.thesalmons.org/john/random123/releases/1.08/docs/threefry_8h_source.html"
        )
      ];

      this.references = [
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        ),
        new LinkItem(
          "Threefish Block Cipher Specification",
          "https://www.schneier.com/academic/skein/"
        )
      ];

      // Official test vectors from Random123 kat_vectors file
      // Format: counter (2x 64-bit little-endian), key (2x 64-bit little-endian)
      // Expected output: 2x 64-bit little-endian words
      // Source: https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors
      this.tests = [
        {
          text: "Threefry2x64-20: Counter=0, Key=0 - Random123 kat_vectors",
          uri: "https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          outputSize: 16,
          // kat_vectors: c2b6e3a8c2c69865 6f81ed42f350084d (big-endian words)
          // little-endian bytes: 65 98 c6 c2 a8 e3 b6 c2 4d 08 50 f3 42 ed 81 6f
          expected: OpCodes.Hex8ToBytes("6598c6c2a8e3b6c24d0850f342ed816f")
        },
        {
          text: "Threefry2x64-20: Counter=0xFFFFFFFFFFFFFFFF (all), Key=0xFFFFFFFFFFFFFFFF (all) - Random123 kat_vectors",
          uri: "https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors",
          input: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
          outputSize: 16,
          // kat_vectors: e02cb7c4d95d277a d06633d0893b8b68 (big-endian words)
          // little-endian bytes: 7a 27 5d d9 c4 b7 2c e0 68 8b 3b 89 d0 33 66 d0
          expected: OpCodes.Hex8ToBytes("7a275dd9c4b72ce0688b3b89d03366d0")
        },
        {
          text: "Threefry2x64-20: Counter=π digits, Key=π digits - Random123 kat_vectors",
          uri: "https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors",
          // kat_vectors counter (BE words): 243f6a8885a308d3 13198a2e03707344
          // as LE bytes: d3 08 a3 85 88 6a 3f 24 44 73 70 03 2e 8a 19 13
          input: OpCodes.Hex8ToBytes("d308a385886a3f24447370032e8a1913"),
          // kat_vectors key (BE words): a4093822299f31d0 082efa98ec4e6c89
          // as LE bytes: d0 31 9f 29 22 38 09 a4 89 6c 4e ec 98 fa 2e 08
          key: OpCodes.Hex8ToBytes("d0319f29223809a4896c4eec98fa2e08"),
          outputSize: 16,
          // kat_vectors output (BE words): 263c7d30bb0f0af1 56be8361d3311526
          // as LE bytes: f1 0a 0f bb 30 7d 3c 26 26 15 31 d3 61 83 be 56
          expected: OpCodes.Hex8ToBytes("f10a0fbb307d3c26261531d36183be56")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // Counter-based PRNGs have no inverse operation
      }
      return new ThreefryInstance(this);
    }
  }

  class ThreefryInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Key (2x 64-bit words as BigInt)
      this._key = [0n, 0n];
      this._ready = false;

      // Counter state (2x 64-bit words as BigInt)
      this._counter = [0n, 0n];

      // Buffer for partial output
      this._buffer = [];
      this._bufferPos = 0;
    }

    /**
     * Set key value (16 bytes = 2x 64-bit words, little-endian)
     */
    set key(keyBytes) {
      if (!keyBytes || keyBytes.length === 0) {
        this._ready = false;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16 bytes)`);
      }

      // Parse key as little-endian 64-bit words
      this._key[0] = bytesToBigInt64LE(keyBytes, 0);
      this._key[1] = bytesToBigInt64LE(keyBytes, 8);
      this._ready = true;
    }

    get key() {
      return null; // Cannot retrieve key
    }

    /**
     * Set counter value (16 bytes = 2x 64-bit words, little-endian)
     * For counter-based PRNGs, the "seed" is actually the initial counter value
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._counter = [0n, 0n];
        return;
      }

      if (seedBytes.length !== 16) {
        throw new Error(`Invalid counter size: ${seedBytes.length} bytes (expected 16 bytes)`);
      }

      // Parse counter as little-endian 64-bit words
      this._counter[0] = bytesToBigInt64LE(seedBytes, 0);
      this._counter[1] = bytesToBigInt64LE(seedBytes, 8);

      // Clear buffer when counter changes
      this._buffer = [];
      this._bufferPos = 0;
    }

    get seed() {
      return null; // Cannot retrieve seed/counter
    }

    /**
     * Increment the counter (for sequential generation)
     */
    _incrementCounter() {
      const mask64 = 0xFFFFFFFFFFFFFFFFn;

      // Increment as a 128-bit little-endian integer
      this._counter[0] = (this._counter[0] + 1n) & mask64;
      if (this._counter[0] === 0n) {
        this._counter[1] = (this._counter[1] + 1n) & mask64;
      }
    }

    /**
     * Generate one block (16 bytes) from current counter
     */
    _generateBlock() {
      if (!this._ready) {
        throw new Error('Threefry not initialized: set key first');
      }

      // Apply Threefry2x64-20 to current counter
      const result = threefry2x64_20(this._counter, this._key);

      // Convert result to bytes (little-endian)
      const bytes = [
        ...bigInt64ToBytes(result[0]),
        ...bigInt64ToBytes(result[1])
      ];

      // Increment counter for next block
      this._incrementCounter();

      return bytes;
    }

    /**
     * Generate random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Threefry not initialized: set key first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let remaining = length;

      // Use buffered bytes first
      while (this._bufferPos < this._buffer.length && remaining > 0) {
        output.push(this._buffer[this._bufferPos++]);
        --remaining;
      }

      // Generate new blocks as needed
      while (remaining > 0) {
        this._buffer = this._generateBlock();
        this._bufferPos = 0;

        const bytesToCopy = Math.min(remaining, this._buffer.length);
        for (let i = 0; i < bytesToCopy; ++i) {
          output.push(this._buffer[this._bufferPos++]);
        }
        remaining -= bytesToCopy;
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For counter-based PRNG, Feed sets the counter/seed
      if (data && data.length > 0) {
        this.seed = data;
      }
    }

    Result() {
      const size = this._outputSize || 16; // Default to one block
      return this.NextBytes(size);
    }

    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize || 16;
    }
  }

  // Register algorithm
  const algorithmInstance = new ThreefryAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { ThreefryAlgorithm, ThreefryInstance };
}));
