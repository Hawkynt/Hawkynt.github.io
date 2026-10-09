/*
 * Multiply-with-Carry (MWC) Pseudo-Random Number Generator
 * Invented by George Marsaglia (1991)
 *
 * Lag-1 multiply-with-carry with base b = 2^32, as given by javamex and by
 * Numerical Recipes (3rd ed., p. 348). The 64-bit state x holds the current
 * value in its low 32 bits and the carry in its high 32 bits; each step is
 *
 *   x = a * (x AND 0xFFFFFFFF) + (x >> 32)
 *
 * and returns the low 32 bits of the new x. The default multiplier
 * a = 0xFFFFDA61 (4294957665) is the first one Numerical Recipes lists. Since
 * a < 2^32, a * (2^32 - 1) + (2^32 - 1) < 2^64, so x never overflows.
 *
 * Seed: 1-8 bytes, little-endian, giving x (bytes 0-3 the value, bytes 4-7
 * the carry; javamex seeds only the value and starts with a zero carry).
 * Output: each 32-bit result as 4 little-endian bytes.
 *
 * Reference: Marsaglia and Zaman (1991), "A new class of random number
 * generators", Annals of Applied Probability, 1(3), 462-480.
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
          RandomGenerationAlgorithm, IRandomGeneratorInstance, LinkItem, KeySize } = AlgorithmFramework;

  class MWCAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Multiply-with-Carry (MWC)";
      this.description = "George Marsaglia's lag-1 multiply-with-carry generator with base 2^32: a 64-bit state holds the current value and the carry, and each step computes x = a * (x mod 2^32) + floor(x / 2^32), returning the low 32 bits. The default multiplier 0xFFFFDA61 is the one used by javamex and Numerical Recipes.";
      this.inventor = "George Marsaglia";
      this.year = 1991;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Deterministic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 8, 1)]; // 1-8 bytes: value, then carry

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: A new class of random number generators (1991)",
          "https://projecteuclid.org/journals/annals-of-applied-probability/volume-1/issue-3/A-New-Class-of-Random-Number-Generators/10.1214/aoap/1177005878.full"
        ),
        new LinkItem(
          "javamex: Multiply-with-carry generator in Java",
          "https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml"
        ),
        new LinkItem(
          "Wikipedia: Multiply-with-carry pseudorandom number generator",
          "https://en.wikipedia.org/wiki/Multiply-with-carry_pseudorandom_number_generator"
        )
      ];

      this.references = [
        new LinkItem(
          "Numerical Recipes (3rd ed., p. 348)",
          "http://numerical.recipes/"
        ),
        new LinkItem(
          "Efficient MWC Random Number Generators with Maximal Period",
          "https://www.math.ias.edu/~goresky/MWC.pdf"
        )
      ];

      // Expected outputs come from the javamex step
      //   x = a * (x & 0xffffffffL) + (x >>> 32); return (int) x;
      // run with native 64-bit arithmetic in an independent C program.
      this.tests = [
        {
          text: "Seed 1, multiplier 0xFFFFDA61: first 10 outputs",
          uri: "https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml",
          input: null,
          seed: OpCodes.Hex8ToBytes("01000000"),
          outputSize: 40,
          multiplier: 0xffffda61,
          expected: OpCodes.Hex8ToBytes(
            "61DAFFFFC1588705E3AF1B01F54AE9548EB8608C" +
            "48182A2A3527B9462B0F807A1B7AFEAE653FCC02"
          )
        },
        {
          text: "Seed 12345: first 10 outputs",
          uri: "https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml",
          input: null,
          seed: OpCodes.Hex8ToBytes("39300000"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "99CFE9F83123C79B95BA2470C2A0FFA59CC72364" +
            "7902ED47BEB29376E57D5B4916578EAD732E5DEB"
          )
        },
        {
          text: "Seed 0xDEADBEEF: first 10 outputs",
          uri: "https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml",
          input: null,
          seed: OpCodes.Hex8ToBytes("EFBEADDE"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "8FDE7D9564B855D47BCE9950CB93F6898EA017FD" +
            "524115EE6E0F730B04A36330443A0197AB973439"
          )
        },
        {
          text: "Seed 999999999: first 16 outputs",
          uri: "https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml",
          input: null,
          seed: OpCodes.Hex8ToBytes("FFC99A3B"),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes(
            "9FAFAA9B7BB235E159F784F81B14E04E0F6F7098" +
            "33E3FD60FBDCE9A80D4ECDAA15691EE7E8E7B9B9" +
            "06B622AEE3E0DB8D722011CB3C2B88F4567C3E3C" +
            "E35FC081"
          )
        },
        {
          text: "Value 0xDEADBEEF with carry 0x12345678: first 8 outputs",
          uri: "https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml",
          input: null,
          seed: OpCodes.Hex8ToBytes("EFBEADDE78563412"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "0735B2A7DCAB54F5BE92440BCDED870CC43D799D" +
            "393B4DB83821F2FB5B661D3E"
          )
        },
        {
          text: "Fixed point: value 2^32 - 1 with carry a - 1 (largest carry) repeats",
          uri: "https://en.wikipedia.org/wiki/Multiply-with-carry_pseudorandom_number_generator",
          input: null,
          seed: OpCodes.Hex8ToBytes("FFFFFFFF60DAFFFF"),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
        }
      ];
    }

    /**
     * Create new generator instance
     * @param {boolean} [isInverse=false] - Must be false; a PRNG has no inverse
     * @returns {MWCInstance|null} New generator instance
     */
    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new MWCInstance(this);
    }
  }

  /**
   * MWC generator instance
   * @class
   * @extends {IRandomGeneratorInstance}
   */
  class MWCInstance extends IRandomGeneratorInstance {
    /**
     * @param {MWCAlgorithm} algorithm - Parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {int32} */
      this._outputSize = 0; // 0 selects the default of 64 bytes
      /** @type {uint32} */
      this._multiplier = 0xffffda61; // Numerical Recipes / javamex
      /** @type {boolean} */
      this._ready = false;
      /** @type {uint32} */
      this._value = 0; // low 32 bits of x
      /** @type {uint32} */
      this._carry = 0; // high 32 bits of x
    }

    /**
     * Set the seed: 1-8 little-endian bytes of x (value, then carry)
     * @param {uint8[]|null} seedBytes - Seed bytes
     * @throws {Error} If the seed is longer than 8 bytes
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }
      if (seedBytes.length > 8) {
        throw new Error("Invalid seed size: " + seedBytes.length + " bytes. MWC takes 1-8 bytes");
      }

      /** @type {uint8[]} */
      const padded = [0, 0, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < seedBytes.length; i++) padded[i] = seedBytes[i];

      this._value = OpCodes.Pack32LE(padded[0], padded[1], padded[2], padded[3]);
      this._carry = OpCodes.Pack32LE(padded[4], padded[5], padded[6], padded[7]);
      this._ready = true;
    }

    /**
     * @returns {uint8[]|null} The seed cannot be read back: null
     */
    get seed() {
      return null;
    }

    /**
     * Set the multiplier a (default 0xFFFFDA61)
     * @param {uint32} value - Multiplier
     */
    set multiplier(value) {
      this._multiplier = OpCodes.ToUint32(value);
    }

    /**
     * @returns {uint32} Multiplier
     */
    get multiplier() {
      return this._multiplier;
    }

    /**
     * One MWC step: x = a * value + carry, split into the new value (low 32
     * bits, returned) and the new carry (high 32 bits).
     * @returns {uint32} Next 32-bit output
     */
    _next32() {
      if (!this._ready) {
        throw new Error('MWC not initialized: set seed first');
      }

      const low = OpCodes.Add32(OpCodes.Mul32(this._multiplier, this._value), this._carry);
      // Adding the old carry overflows the low word exactly when the sum wraps below it
      const overflow = low < this._carry ? 1 : 0;
      this._carry = OpCodes.Add32(OpCodes.MulHi32(this._multiplier, this._value), overflow);
      this._value = low;
      return low;
    }

    /**
     * Generate random bytes
     * @param {int32} length - Number of random bytes to generate
     * @returns {uint8[]} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('MWC not initialized: set seed first');
      }

      /** @type {uint8[]} */
      const output = [];
      while (output.length < length) {
        const bytes = OpCodes.Unpack32LE(this._next32());
        for (let i = 0; i < 4 && output.length < length; i++) output.push(bytes[i]);
      }
      return output;
    }

    /**
     * Not used: the generator takes no input
     * @param {uint8[]} data - Ignored
     */
    Feed(data) {
    }

    /**
     * Produce the configured number of output bytes
     * @returns {uint8[]} Generated bytes
     */
    Result() {
      return this.NextBytes(this.outputSize);
    }

    /**
     * Set output size for Result() method
     * @param {int32} size - Bytes returned by Result()
     */
    set outputSize(size) {
      this._outputSize = size;
    }

    /**
     * @returns {int32} Bytes returned by Result()
     */
    get outputSize() {
      return (this._outputSize ? this._outputSize : 64);
    }
  }

  // Register algorithm
  const algorithmInstance = new MWCAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { MWCAlgorithm, MWCInstance };
}));
