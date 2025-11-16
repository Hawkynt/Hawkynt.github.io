/*
 * Complementary Multiply-with-Carry (CMWC) Pseudo-Random Number Generator
 * Invented by George Marsaglia (2003)
 *
 * CMWC is an extension of the Multiply-with-Carry (MWC) generator that uses
 * a large array of state values and a carry, producing extremely long periods.
 * The "complementary" aspect means it returns the complement of the computed value.
 *
 * The algorithm uses:
 *   Q[n] = (a * Q[n-r] + c) mod 2^64
 *   c = floor((a * Q[n-r] + c) / 2^64)
 *   output = 2^64 - 1 - Q[n]
 *
 * Where:
 *   Q = array of r state values (r = 4096 for CMWC4096)
 *   c = carry value
 *   a = multiplier (chosen for optimal period)
 *   n = current index in circular array
 *
 * CMWC4096 with a = 18782 has a period of approximately 2^131104, making it
 * suitable for simulations requiring massive numbers of random values.
 *
 * Reference: Marsaglia, G. (2003). "Random Number Generators"
 * Journal of Modern Applied Statistical Methods, 2(1), 2-13.
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

  class CMWCAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "CMWC (Complementary Multiply-with-Carry)";
      this.description = "CMWC is an advanced pseudo-random number generator invented by George Marsaglia. It uses a large state array (4096 values) with multiply-and-carry operations, achieving an extraordinary period of 2^131104. The complementary aspect returns the bitwise complement of computed values, improving randomness quality.";
      this.inventor = "George Marsaglia";
      this.year = 2003;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Deterministic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 8, 1)]; // 1-8 bytes for 64-bit seed

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: Random Number Generators (Journal of Modern Applied Statistical Methods, 2003)",
          "https://digitalcommons.wayne.edu/jmasm/vol2/iss1/2/"
        ),
        new LinkItem(
          "Wikipedia: Multiply-with-carry pseudorandom number generator",
          "https://en.wikipedia.org/wiki/Multiply-with-carry_pseudorandom_number_generator"
        ),
        new LinkItem(
          "Marsaglia's Post on CMWC4096 (sci.crypt, 2003)",
          "https://groups.google.com/g/sci.crypt/c/yoaCpGWKEk0"
        ),
        new LinkItem(
          "Logical Intuitions: PRNG 3: Complementary Multiply-with-Carry",
          "https://blacklen.wordpress.com/2011/05/15/prng-3-complementary-multiply-with-carry/"
        )
      ];

      this.references = [
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        ),
        new LinkItem(
          "DieHarder Random Number Test Suite",
          "https://webhome.phy.duke.edu/~rgb/General/dieharder.php"
        ),
        new LinkItem(
          "Uncommons Maths CMWC4096RNG Java Implementation",
          "https://maths.uncommons.org/api/org/uncommons/maths/random/CMWC4096RNG.html"
        )
      ];

      // Test vectors generated from reference C# implementation
      // Seeded using SplitMix64 (as per C# code) for reproducibility
      // CMWC constants: R=4096, A=6364136223846793005 (0x5851F42D4C957F2D)
      this.tests = [
        {
          text: "Seed 0: First 5 outputs (40 bytes) - verified against C# reference",
          uri: "X:\\Coding\\Working Copies\\Hawkynt.git\\Randomizer\\RandomNumberGenerators\\Deterministic\\ComplementaryMultiplyWithCarry.cs",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "8B912EACCA47B64C" +
            "238592B521F4679E" +
            "5AA031F54B2DDE8C" +
            "EAA62EDFE6338250" +
            "F333513179FBD3EC"
          )
        },
        {
          text: "Seed 1: First 5 outputs (40 bytes)",
          uri: "X:\\Coding\\Working Copies\\Hawkynt.git\\Randomizer\\RandomNumberGenerators\\Deterministic\\ComplementaryMultiplyWithCarry.cs",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "C108910A0E5EB78A" +
            "710077017762A450" +
            "17F2258DEA636A19" +
            "60CDE049597DFDFE" +
            "76DFD35B7206ACFD"
          )
        },
        {
          text: "Seed 42: First 5 outputs (40 bytes)",
          uri: "X:\\Coding\\Working Copies\\Hawkynt.git\\Randomizer\\RandomNumberGenerators\\Deterministic\\ComplementaryMultiplyWithCarry.cs",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002A"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "8211488F4151822E" +
            "08142692D53EEBF4" +
            "3ED2AC69AFB32196" +
            "B7937D066ECE679C" +
            "F68F0E03DE311C72"
          )
        },
        {
          text: "Seed 1234567: First 8 outputs (64 bytes)",
          uri: "X:\\Coding\\Working Copies\\Hawkynt.git\\Randomizer\\RandomNumberGenerators\\Deterministic\\ComplementaryMultiplyWithCarry.cs",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000012D687"),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes(
            "3E8EECF519743031" +
            "BEDF18E3222799CD" +
            "EB8F9B725B43854F" +
            "8A91E2002DEDF10B" +
            "9EAE5EE7C03CAD41" +
            "6A6574DEF1B8840F" +
            "E939516B2F6A4F74" +
            "3D4DA6C4C5B8EB73"
          )
        },
        {
          text: "Seed 987654321: First 8 outputs (64 bytes)",
          uri: "X:\\Coding\\Working Copies\\Hawkynt.git\\Randomizer\\RandomNumberGenerators\\Deterministic\\ComplementaryMultiplyWithCarry.cs",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000003ADE68B1"),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes(
            "1AC7B2559BE4D603" +
            "EA2C816307A5144A" +
            "A700D67E836ECB76" +
            "04E9A7352E91D212" +
            "05C4820E5877A6D3" +
            "59613D5949C1E7DE" +
            "07B44A075E6CEB68" +
            "C305EA20312D2BCA"
          )
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
      return new CMWCInstance(this);
    }
  }

  /**
 * CMWC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CMWCInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // CMWC4096 constants (from Marsaglia's specification)
      this.R = 4096;                                  // Array size
      this.A = 6364136223846793005n;                 // Multiplier (0x5851F42D4C957F2D)

      // Generator state
      this._state = new Array(this.R);               // State array Q[0..R-1]
      this._carry = 0n;                              // Carry value
      this._index = this.R - 1;                      // Current index
      this._ready = false;
    }

    /**
     * Seed using SplitMix64 to initialize state array
     * This matches the C# implementation which uses SplitMix64.Next() for seeding
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 64-bit value for SplitMix64
      let seedValue = 0n;
      for (let i = 0; i < seedBytes.length && i < 8; ++i) {
        seedValue = OpCodes.OrN(OpCodes.ShiftLn(seedValue, 8), BigInt(seedBytes[i]));
      }

      // Use SplitMix64 to initialize state array (matches C# implementation)
      // NOTE: C# uses SplitMix64.Next(ref seed) which modifies seed in place!
      // We need to simulate this behavior by tracking the advancing state
      const GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;
      const MIX_CONST_1 = 0xBF58476D1CE4E5B9n;
      const MIX_CONST_2 = 0x94D049BB133111EBn;

      // SplitMix64.Next(ref z) function (mimics C# implementation)
      const splitmix64Next = (z) => {
        let local = z;
        local = OpCodes.AndN(local + GOLDEN_GAMMA, 0xFFFFFFFFFFFFFFFFn);
        local = OpCodes.AndN(OpCodes.XorN(local, OpCodes.ShiftRn(local, 30)) * MIX_CONST_1, 0xFFFFFFFFFFFFFFFFn);
        local = OpCodes.AndN(OpCodes.XorN(local, OpCodes.ShiftRn(local, 27)) * MIX_CONST_2, 0xFFFFFFFFFFFFFFFFn);
        local = OpCodes.AndN(OpCodes.XorN(local, OpCodes.ShiftRn(local, 31)), 0xFFFFFFFFFFFFFFFFn);
        return local;  // Returns new state AND updates z in C# via ref
      };

      // Initialize state array using SplitMix64
      let currentSeed = seedValue;
      for (let i = 0; i < this.R; ++i) {
        const value = splitmix64Next(currentSeed);
        currentSeed = value;  // Update seed for next iteration (simulates C# ref behavior)
        this._state[i] = value;
      }

      // Initialize carry using SplitMix64
      const carry = splitmix64Next(currentSeed);
      this._carry = carry;

      this._index = this.R - 1;
      this._ready = true;
    }


    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 64-bit value using CMWC algorithm
     *
     * Algorithm (from C# implementation):
     * 1. index = (index + 1) % R
     * 2. t = A * state[index] + carry  (128-bit arithmetic)
     * 3. carry = t >> 64 (high 64 bits)
     * 4. state[index] = t & 0xFFFFFFFFFFFFFFFF (low 64 bits)
     * 5. return 2^64 - 1 - state[index] (complement)
     */
    _next64() {
      if (!this._ready) {
        throw new Error('CMWC not initialized: set seed first');
      }

      // Step 1: Update index (circular array)
      this._index = (this._index + 1) % this.R;

      // Step 2: t = A * state[index] + carry (128-bit arithmetic)
      const t = OpCodes.AndN(this.A * this._state[this._index] + this._carry, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn);

      // Step 3: Extract carry (high 64 bits)
      this._carry = OpCodes.ShiftRn(t, 64);

      // Step 4: Update state (low 64 bits)
      this._state[this._index] = OpCodes.AndN(t, 0xFFFFFFFFFFFFFFFFn);

      // Step 5: Return complement (CMWC = Complementary MWC)
      return OpCodes.AndN(0xFFFFFFFFFFFFFFFFn - this._state[this._index], 0xFFFFFFFFFFFFFFFFn);
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('CMWC not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 64-bit value
        const value = this._next64();

        // Extract bytes (big-endian order - most significant byte first)
        const bytesToExtract = Math.min(bytesRemaining, 8);
        for (let i = 0; i < bytesToExtract; ++i) {
          const byte = Number(OpCodes.AndN(OpCodes.ShiftRn(value, (7 - i) * 8), 0xFFn));
          output.push(byte);
        }

        bytesRemaining -= bytesToExtract;
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
      // For PRNG, Feed is not used for standard operation
      // Could be used to add entropy in future versions
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default to 64 bytes
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
  }

  // Register algorithm
  const algorithmInstance = new CMWCAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { CMWCAlgorithm, CMWCInstance };
}));
