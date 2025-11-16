/*
 * Xorshift1024* Pseudo-Random Number Generator
 * Original algorithm by Sebastiano Vigna (2014)
 * Reference implementation: https://prng.di.unimi.it/xorshift1024star.c
 *
 * State: 16 × 64-bit values (1024 bits total) + position index (p)
 * Period: 2^1024 - 1
 * Multiplier: 0x9e3779b97f4a7c13 (fixed-point golden ratio)
 *
 * Algorithm: XOR-shift operations on 1024-bit state with golden ratio multiplier
 *   See reference: https://prng.di.unimi.it/xorshift1024star.c
 *
 * Note: The two lowest bits are LFSRs of degree 1024 and may fail binary rank tests.
 * For high-quality bits, use upper bits or sign test for Boolean extraction.
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

  /**
   * SplitMix64 seeding function
   * Used to initialize xorshift1024* state from a single 64-bit seed
   * Based on https://prng.di.unimi.it/splitmix64.c
   *
   * @param {BigInt} state - Current state value
   * @returns {Object} - { value: output, nextState: new state }
   */
  function SplitMix64(state) {
    const GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;
    state = OpCodes.ToQWord(state + GOLDEN_GAMMA);

    let z = state;
    z = OpCodes.XorN(z, OpCodes.ShiftRn(z, 30));
    z = OpCodes.ToQWord(z * 0xBF58476D1CE4E5B9n);
    z = OpCodes.XorN(z, OpCodes.ShiftRn(z, 27));
    z = OpCodes.ToQWord(z * 0x94D049BB133111EBn);
    z = OpCodes.XorN(z, OpCodes.ShiftRn(z, 31));

    return { value: z, nextState: state };
  }

  class Xorshift1024StarAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Xorshift1024*";
      this.description = "Xorshift1024* is a large-state xorshift pseudo-random number generator with multiplicative scrambling by Sebastiano Vigna. Uses 1024 bits of state for a period of 2^1024-1, making it suitable for parallel applications. Features golden ratio multiplier for output quality.";
      this.inventor = "Sebastiano Vigna";
      this.year = 2014;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Non-Cryptographic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.IT;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(8, 8, 1)]; // 64-bit seed

      // Documentation
      this.documentation = [
        new LinkItem(
          "Official Reference Implementation (C)",
          "https://prng.di.unimi.it/xorshift1024star.c"
        ),
        new LinkItem(
          "Xorshift Generators Homepage",
          "https://prng.di.unimi.it/xorshift.php"
        ),
        new LinkItem(
          "Original Paper: An experimental exploration of Marsaglia's xorshift generators (2014)",
          "https://arxiv.org/abs/1402.6246"
        ),
        new LinkItem(
          "Further Scramblings of Marsaglia's Xorshift Generators",
          "https://vigna.di.unimi.it/ftp/papers/xorshiftplus.pdf"
        )
      ];

      this.references = [
        new LinkItem(
          "Wikipedia: Xorshift",
          "https://en.wikipedia.org/wiki/Xorshift"
        ),
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        ),
        new LinkItem(
          "DSI Utilities - Java Implementation",
          "https://dsiutils.di.unimi.it/docs/it/unimi/dsi/util/XorShift1024StarPhiRandom.html"
        )
      ];

      // Test vectors generated from official reference implementation
      // Seeded using SplitMix64 to initialize 16x 64-bit state values
      // Output verified against C reference code at https://prng.di.unimi.it/xorshift1024star.c
      this.tests = [
        {
          text: "Seed=1: First four 64-bit outputs from xorshift1024* (official reference)",
          uri: "https://prng.di.unimi.it/xorshift1024star.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000000000000"),
          outputSize: 32, // 4 × 64-bit values = 32 bytes
          // State initialized via 16 calls to SplitMix64(seed=1)
          // Outputs (little-endian bytes per 64-bit value):
          expected: OpCodes.Hex8ToBytes("ebec18c6c320b75ff0c3e55baa47687a9fda494782f91f6578beb9d0157ed311")
        },
        {
          text: "Seed=0: First four 64-bit outputs (zero seed initialization)",
          uri: "https://prng.di.unimi.it/xorshift1024star.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("d66fb9683583763f7e3e02cd0d1b704985bbd386166f265f7da6a5f93a72f14d")
        },
        {
          text: "Seed=12345: First four 64-bit outputs",
          uri: "https://prng.di.unimi.it/xorshift1024star.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("3930000000000000"), // 12345 little-endian
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("f0eb9cd17d61a08e9a889e3235eae19970744689e4cf1fda4b9d595ecb44b440")
        },
        {
          text: "Seed=0xDEADBEEF: First four 64-bit outputs",
          uri: "https://prng.di.unimi.it/xorshift1024star.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("efbeadde00000000"), // 0xDEADBEEF little-endian
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("3fae770327913ba438267944642a8ba9c7c06767d60c319e99cad00ed5565195")
        },
        {
          text: "Seed=1000000: First six 64-bit outputs (large seed test)",
          uri: "https://prng.di.unimi.it/xorshift1024star.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("40420f0000000000"), // 1000000 little-endian
          outputSize: 48, // 6 × 64-bit values
          expected: OpCodes.Hex8ToBytes("e7438768d321bb87a6ae572109ee23880f85c9c0cd4bde5c0603680e40371b26d201f4cf7f0e9e870a034214cfa6af09")
        },
        {
          text: "Seed=0xFFFFFFFFFFFFFFFF: Maximum seed value test",
          uri: "https://prng.di.unimi.it/xorshift1024star.c",
          input: null,
          seed: OpCodes.Hex8ToBytes("ffffffffffffffff"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("ff8b751a747b5b338dff602bc75ead46e4dc5b1ab29c51f528f5a435034c4f00")
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
      return new Xorshift1024StarInstance(this);
    }
  }

  /**
 * Xorshift1024Star cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Xorshift1024StarInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Xorshift1024* state: 16 × 64-bit values + position index
      this._state = new Array(16).fill(0n);
      this._p = 0; // Position index
      this._ready = false;

      // Multiplier constant: 0x9e3779b97f4a7c13 (golden ratio)
      this._MULTIPLIER = 0x9e3779b97f4a7c13n;
    }

    /**
     * Set seed value (64-bit)
     * Uses SplitMix64 to initialize the 16 state values
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 64-bit BigInt (little-endian)
      let seedValue = 0n;
      for (let i = 0; i < Math.min(8, seedBytes.length); ++i) {
        seedValue = OpCodes.OrN(seedValue, OpCodes.ShiftLn(BigInt(seedBytes[i]), i * 8));
      }

      // Initialize state using SplitMix64
      // Each of 16 state values is generated using successive SplitMix64 calls
      let splitmixState = seedValue;
      for (let i = 0; i < 16; ++i) {
        const result = SplitMix64(splitmixState);
        this._state[i] = result.value;
        splitmixState = result.nextState;
      }

      this._p = 0;
      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 64-bit random value
     * Implements the xorshift1024* algorithm
     * Reference: https://prng.di.unimi.it/xorshift1024star.c
     *
     * @returns {BigInt} 64-bit random value
     */
    _next64() {
      if (!this._ready) {
        throw new Error('Xorshift1024* not initialized: set seed first');
      }

      const s0 = this._state[this._p];
      this._p = (this._p + 1)&15;
      let s1 = this._state[this._p];

      s1 = OpCodes.XorN(s1, OpCodes.ToQWord(OpCodes.ShiftLn(s1, 31)));

      this._state[this._p] = OpCodes.XorN(
        OpCodes.XorN(
          OpCodes.XorN(s1, s0),
          OpCodes.ShiftRn(s1, 11)
        ),
        OpCodes.ShiftRn(s0, 30)
      );

      return OpCodes.ToQWord(this._state[this._p] * this._MULTIPLIER);
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Xorshift1024* not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesGenerated = 0;

      while (bytesGenerated < length) {
        // Generate next 64-bit value
        const value64 = this._next64();

        // Extract bytes in little-endian order
        for (let i = 0; i < 8 && bytesGenerated < length; ++i) {
          const shifted = OpCodes.ShiftRn(value64, i * 8);
          const byteVal = Number(OpCodes.AndN(shifted, 0xFFn));
          output.push(byteVal);
          ++bytesGenerated;
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
      // For PRNG, Feed is a no-op (xorshift1024* is deterministic)
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default to 64 bytes (8 × 64-bit values)
      const size = this._outputSize || 64;
      return this.NextBytes(size);
    }

    /**
     * Set output size for Result() method
     */
    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize || 64;
    }

    /**
     * Jump function (equivalent to 2^512 calls to _next64())
     * Useful for parallel computation - allows generating non-overlapping subsequences
     * Based on official implementation at https://prng.di.unimi.it/xorshift1024star.c
     */
    jump() {
      if (!this._ready) {
        throw new Error('Xorshift1024* not initialized: set seed first');
      }

      // Jump polynomial coefficients from official C implementation
      const JUMP = [
        0x84242f96eca9c41dn, 0xa3c65b8776f96855n, 0x5b34a39f070b5837n, 0x4489affce4f31a1en,
        0x2ffeeb0a48316f40n, 0xdc2d9891fe68c022n, 0x3659132bb12fea70n, 0xaac17d8efa43cab8n,
        0xc4cb815590989b13n, 0x5ee975283d71c93bn, 0x691548c86c1bd540n, 0x7910c41d10a1e6a5n,
        0x0b5fc64563b3e2a8n, 0x047f7684e9fc949dn, 0xb99181f2d8f685can, 0x284600e3f30e38c3n
      ];

      const t = new Array(16).fill(0n);

      for (let i = 0; i < JUMP.length; ++i) {
        for (let b = 0; b < 64; ++b) {
          const mask = OpCodes.ShiftLn(1n, b);
          if (OpCodes.AndN(JUMP[i], mask) !== 0n) {
            for (let j = 0; j < 16; ++j) {
              t[j] = OpCodes.XorN(t[j], this._state[j]);
            }
          }
          this._next64();
        }
      }

      for (let j = 0; j < 16; ++j) {
        this._state[j] = t[j];
      }
    }
  }

  // Register algorithm
  const algorithmInstance = new Xorshift1024StarAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { Xorshift1024StarAlgorithm, Xorshift1024StarInstance };
}));
