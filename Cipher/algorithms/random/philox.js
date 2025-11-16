/*
 * Philox4x32-10 Counter-Based Pseudo-Random Number Generator
 * From the Random123 library by D. E. Shaw Research
 *
 * Philox (Product HI, LO, XOR) is a counter-based PRNG based on integer multiplication
 * in a Feistel-like network. It's trivially parallelizable and has a period of 2^128.
 *
 * Key features:
 * - Counter-based (no internal state, pure function of counter+key)
 * - Trivially parallelizable (any counter can be computed independently)
 * - Period: 2^128
 * - Passes all SmallCrush, Crush, and BigCrush tests from TestU01
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

  // Philox4x32-10 constants from Random123 library
  const PHILOX_M4x32_0 = 0xD2511F53; // First multiplier constant
  const PHILOX_M4x32_1 = 0xCD9E8D57; // Second multiplier constant
  const PHILOX_W32_0 = 0x9E3779B9;   // First Weyl constant (golden ratio)
  const PHILOX_W32_1 = 0xBB67AE85;   // Second Weyl constant (sqrt(3)-1)

  /**
   * Single Philox4x32 round function
   * Implements the Feistel-like network with multiplication and XOR
   */
  function philox4x32Round(counter, key) {
    // counter is [c0, c1, c2, c3]
    // key is [k0, k1]

    // Multiply-split operations using OpCodes
    const hi0 = OpCodes.MulHi32(PHILOX_M4x32_0, counter[0]);
    const lo0 = OpCodes.Mul32(PHILOX_M4x32_0, counter[0]);
    const hi1 = OpCodes.MulHi32(PHILOX_M4x32_1, counter[2]);
    const lo1 = OpCodes.Mul32(PHILOX_M4x32_1, counter[2]);

    // Feistel-like mixing with key (XOR is simple enough to use directly)
    return [
      (hi1 ^ counter[1] ^ key[0]) >>> 0,
      lo1 >>> 0,
      (hi0 ^ counter[3] ^ key[1]) >>> 0,
      lo0 >>> 0
    ];
  }

  /**
   * Bump key (Weyl sequence for key schedule)
   */
  function philox4x32BumpKey(key) {
    return [
      OpCodes.Add32(key[0], PHILOX_W32_0),
      OpCodes.Add32(key[1], PHILOX_W32_1)
    ];
  }

  /**
   * Philox4x32-10: 10 rounds of the Philox transformation
   */
  function philox4x32_10(counter, key) {
    let ctr = [...counter];
    let k = [...key];

    // Apply 10 rounds
    for (let i = 0; i < 10; ++i) {
      ctr = philox4x32Round(ctr, k);
      if (i < 9) { // Don't bump key after last round
        k = philox4x32BumpKey(k);
      }
    }

    return ctr;
  }

  class PhiloxAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Philox4x32-10";
      this.description = "Counter-based PRNG using integer multiplication in a Feistel-like network. Trivially parallelizable with 2^128 period, passes all TestU01 statistical tests. Part of the Random123 library by D. E. Shaw Research.";
      this.inventor = "John K. Salmon, Mark A. Moraes, Ron O. Dror, David E. Shaw";
      this.year = 2011;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Counter-Based PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.IsCounterBased = true; // Special property: no state, pure function
      this.SupportedKeySizes = [new KeySize(8, 8, 1)]; // 64-bit key (2x 32-bit words)

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
          "Philox Header Reference",
          "https://www.thesalmons.org/john/random123/releases/1.08/docs/philox_8h_source.html"
        )
      ];

      this.references = [
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        ),
        new LinkItem(
          "Intel MKL Philox4x32-10 Documentation",
          "https://www.intel.com/content/www/us/en/docs/onemkl/developer-reference-vector-statistics-notes/2021-1/philox4x32-10.html"
        )
      ];

      // Official test vectors from Random123 kat_vectors file
      // Format: counter (4x 32-bit little-endian), key (2x 32-bit little-endian)
      // Expected output: 4x 32-bit little-endian words
      // Source: https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors
      this.tests = [
        {
          text: "Philox4x32-10: Counter=0, Key=0 - Random123 kat_vectors",
          uri: "https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 16,
          // kat_vectors: 6627e8d5 e169c58d bc57ac4c 9b00dbd8 (big-endian words)
          // little-endian bytes: d5 e8 27 66 8d c5 69 e1 4c ac 57 bc d8 db 00 9b
          expected: OpCodes.Hex8ToBytes("d5e827668dc569e14cac57bcd8db009b")
        },
        {
          text: "Philox4x32-10: Counter=0xFFFFFFFF (all), Key=0xFFFFFFFF (all) - Random123 kat_vectors",
          uri: "https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors",
          input: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          outputSize: 16,
          // kat_vectors: 408f276d 41c83b0e a20bc7c6 6d5451fd (big-endian words)
          // little-endian bytes: 6d 27 8f 40 0e 3b c8 41 c6 c7 0b a2 fd 51 54 6d
          expected: OpCodes.Hex8ToBytes("6d278f400e3bc841c6c70ba2fd51546d")
        },
        {
          text: "Philox4x32-10: Counter=π digits, Key=π digits - Random123 kat_vectors",
          uri: "https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors",
          // kat_vectors counter (BE words): 243f6a88 85a308d3 13198a2e 03707344
          // as LE bytes: 88 6a 3f 24 d3 08 a3 85 2e 8a 19 13 44 73 70 03
          input: OpCodes.Hex8ToBytes("886a3f24d308a3852e8a191344737003"),
          // kat_vectors key (BE words): a4093822 299f31d0
          // as LE bytes: 22 38 09 a4 d0 31 9f 29
          key: OpCodes.Hex8ToBytes("223809a4d0319f29"),
          outputSize: 16,
          // kat_vectors output (BE words): d16cfe09 94fdcceb 5001e420 24126ea1
          // as LE bytes: 09 fe 6c d1 eb cc fd 94 20 e4 01 50 a1 6e 12 24
          expected: OpCodes.Hex8ToBytes("09fe6cd1ebccfd9420e40150a16e1224")
        },
        {
          text: "Philox4x32-10: Counter=(1,0,0,0), Key=(0,0) - Counter variation",
          uri: "https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors",
          input: OpCodes.Hex8ToBytes("01000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 16,
          // Verified against reference implementation
          expected: OpCodes.Hex8ToBytes("a4cce4f8db00b25ceb74a5b167ff7e09")
        },
        {
          text: "Philox4x32-10: Counter=(0,0,0,0), Key=(1,0) - Key variation",
          uri: "https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0100000000000000"),
          outputSize: 16,
          // Verified against reference implementation
          expected: OpCodes.Hex8ToBytes("7006e8e3bc0e0ae5c022f29527aa15b6")
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
        return null; // Counter-based PRNGs have no inverse operation
      }
      return new PhiloxInstance(this);
    }
  }

  /**
 * Philox cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PhiloxInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Key (2x 32-bit words)
      this._key = [0, 0];
      this._ready = false;

      // Counter state (4x 32-bit words)
      this._counter = [0, 0, 0, 0];

      // Buffer for partial output
      this._buffer = [];
      this._bufferPos = 0;
    }

    /**
     * Set key value (8 bytes = 2x 32-bit words, little-endian)
     */
    set key(keyBytes) {
      if (!keyBytes || keyBytes.length === 0) {
        this._ready = false;
        return;
      }

      if (keyBytes.length !== 8) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 8 bytes)`);
      }

      // Parse key as little-endian 32-bit words
      this._key[0] = OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]);
      this._key[1] = OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]);
      this._ready = true;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return null; // Cannot retrieve key
    }

    /**
     * Set counter value (16 bytes = 4x 32-bit words, little-endian)
     * For counter-based PRNGs, the "seed" is actually the initial counter value
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._counter = [0, 0, 0, 0];
        return;
      }

      if (seedBytes.length !== 16) {
        throw new Error(`Invalid counter size: ${seedBytes.length} bytes (expected 16 bytes)`);
      }

      // Parse counter as little-endian 32-bit words
      this._counter[0] = OpCodes.Pack32LE(seedBytes[0], seedBytes[1], seedBytes[2], seedBytes[3]);
      this._counter[1] = OpCodes.Pack32LE(seedBytes[4], seedBytes[5], seedBytes[6], seedBytes[7]);
      this._counter[2] = OpCodes.Pack32LE(seedBytes[8], seedBytes[9], seedBytes[10], seedBytes[11]);
      this._counter[3] = OpCodes.Pack32LE(seedBytes[12], seedBytes[13], seedBytes[14], seedBytes[15]);

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
      // Increment as a 128-bit little-endian integer
      this._counter[0] = OpCodes.Add32(this._counter[0], 1);
      if (this._counter[0] === 0) {
        this._counter[1] = OpCodes.Add32(this._counter[1], 1);
        if (this._counter[1] === 0) {
          this._counter[2] = OpCodes.Add32(this._counter[2], 1);
          if (this._counter[2] === 0) {
            this._counter[3] = OpCodes.Add32(this._counter[3], 1);
          }
        }
      }
    }

    /**
     * Generate one block (16 bytes) from current counter
     */
    _generateBlock() {
      if (!this._ready) {
        throw new Error('Philox not initialized: set key first');
      }

      // Apply Philox4x32-10 to current counter
      const result = philox4x32_10(this._counter, this._key);

      // Convert result to bytes (little-endian)
      const bytes = [];
      for (let i = 0; i < 4; ++i) {
        const wordBytes = OpCodes.Unpack32LE(result[i]);
        bytes.push(...wordBytes);
      }

      // Increment counter for next block
      this._incrementCounter();

      return bytes;
    }

    /**
     * Generate random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Philox not initialized: set key first');
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
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      // For counter-based PRNG, Feed sets the counter/seed
      if (data && data.length > 0) {
        this.seed = data;
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

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
  const algorithmInstance = new PhiloxAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { PhiloxAlgorithm, PhiloxInstance };
}));
