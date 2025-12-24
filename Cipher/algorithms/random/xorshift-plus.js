/*
 * XorShift+ Pseudo-Random Number Generator
 * Ported from C# implementation: Hawkynt.RandomNumberGenerators.Deterministic.XorShiftPlus
 *
 * This implementation uses a custom XorShift+ variant with 2x 64-bit state variables.
 * State initialization: x=seed (or 1 if seed==0), y=~seed (or 1 if ~seed==0)
 * Algorithm parameters: (a=23, b=17, c=26)
 *
 * Period: 2^128 - 1
 * State: 128 bits (two 64-bit words: x, y)
 *
 * Algorithm:
 *   x = XOR(x, left_shift(x, 23))
 *   x = XOR(x, right_shift(x, 17))
 *   x = XOR(x, XOR(y, right_shift(y, 26)))
 *   swap(x, y)
 *   return add(x, y)
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

  class XorShiftPlusAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "XorShift+";
      this.description = "XorShift+ is a fast pseudo-random number generator using XOR-shift operations with addition scrambling. Uses parameters (23, 17, 26) and complementary seed initialization for improved coverage of the state space.";
      this.inventor = "George Marsaglia / Sebastiano Vigna";
      this.year = 2003;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Deterministic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 8, 1)]; // 1-8 bytes (up to 64-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Wikipedia: Xorshift",
          "https://en.wikipedia.org/wiki/Xorshift"
        ),
        new LinkItem(
          "Original Xorshift Paper (Marsaglia, 2003)",
          "https://www.jstatsoft.org/article/view/v008i14"
        ),
        new LinkItem(
          "Vigna's Analysis of Xorshift Generators",
          "https://vigna.di.unimi.it/ftp/papers/xorshift.pdf"
        )
      ];

      this.references = [
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        ),
        new LinkItem(
          "Modern PRNG Alternatives (xoshiro/xoroshiro)",
          "https://prng.di.unimi.it/"
        )
      ];

      // Test vectors generated from JavaScript implementation
      // Ported from C# Hawkynt.RandomNumberGenerators.Deterministic.XorShiftPlus
      this.tests = [
        {
          text: "Seed(1): First 5 outputs - verified against ported C# implementation",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000000000000"),
          outputSize: 40, // 5 outputs × 8 bytes each
          expected: OpCodes.Hex8ToBytes(
            "3E008000C0FFFFFF" +  // Output 1
            "01100000C0FFFFFF" +  // Output 2
            "FFEF9FFEFF4F00E0" +  // Output 3
            "BEFF0FFF3FC000C0" +  // Output 4
            "CE1FE4FF373000E0"    // Output 5
          )
        },
        {
          text: "Seed(2): First 5 outputs",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0200000000000000"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "7D000001C0FFFFFF" +  // Output 1
            "42108000C0FFFFFF" +  // Output 2
            "FFDF1FFEFF8F00E0" +  // Output 3
            "7DFF5FFE3F4001C0" +  // Output 4
            "CD2FB8FF2F3000E0"    // Output 5
          )
        },
        {
          text: "Seed(123456789): First 10 outputs",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("15CD5B0700000000"),
          outputSize: 80,
          expected: OpCodes.Hex8ToBytes(
            "D67917552752FCFF" +  // Output 1
            "EF01A4542752FCFF" +  // Output 2
            "2BD2AE106DE2AD13" +  // Output 3
            "DD22E59137E85B27" +  // Output 4
            "F133926903D03D4A" +  // Output 5
            "82A4449B6CD1ACF6" +  // Output 6
            "CB6BBF5808D507AB" +  // Output 7
            "69126F885C380D9E" +  // Output 8
            "E9FDB04D5EE0C066" +  // Output 9
            "1EB3A02D6279EFF6"    // Output 10
          )
        },
        {
          text: "Seed(1000000): First 5 outputs - large seed value",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("40420F0000000000"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "C64DC12361F8FFFF" +  // Output 1
            "CF355F2361F8FFFF" +  // Output 2
            "E0FFC3275E889130" +  // Output 3
            "B5BFC4335D392361" +  // Output 4
            "FAF73ECEC1DEA55F"    // Output 5
          )
        },
        {
          text: "Seed(0xFFFFFFFFFFFFFFFF): First 5 outputs - maximum seed",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFF"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "C2FF7F0000000000" +  // Output 1
            "41FF7F0100000000" +  // Output 2
            "BEEFFF0000400000" +  // Output 3
            "7C00F00000800000" +  // Output 4
            "BD200C01F83F0000"    // Output 5
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
      return new XorShiftPlusInstance(this);
    }
  }

  /**
 * XorShiftPlus cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class XorShiftPlusInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // XorShift+ uses 2x 64-bit state variables (x, y)
      // JavaScript doesn't have native 64-bit integers, so we use pairs of 32-bit values
      this._x_low = 0;
      this._x_high = 0;
      this._y_low = 0;
      this._y_high = 0;
      this._ready = false;
    }

    /**
     * Set seed value (1-8 bytes)
     * Matches C# logic: x = seed (or 1 if seed==0), y = ~seed (or 1 if ~seed==0)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Pack seed bytes into 64-bit value (little-endian)
      let seed_low = 0;
      let seed_high = 0;

      if (seedBytes.length >= 4) {
        seed_low = OpCodes.Pack32LE(
          seedBytes[0] || 0,
          seedBytes[1] || 0,
          seedBytes[2] || 0,
          seedBytes[3] || 0
        );
      } else if (seedBytes.length > 0) {
        const bytes = [0, 0, 0, 0];
        for (let i = 0; i < seedBytes.length; ++i) {
          bytes[i] = seedBytes[i];
        }
        seed_low = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      }

      if (seedBytes.length >= 8) {
        seed_high = OpCodes.Pack32LE(
          seedBytes[4] || 0,
          seedBytes[5] || 0,
          seedBytes[6] || 0,
          seedBytes[7] || 0
        );
      }

      // x = seed == 0 ? 1 : seed
      if (seed_low === 0 && seed_high === 0) {
        this._x_low = 1;
        this._x_high = 0;
      } else {
        this._x_low = seed_low;
        this._x_high = seed_high;
      }

      // y = ~seed == 0 ? 1 : ~seed
      const not_seed_low = OpCodes.Not32(seed_low);
      const not_seed_high = OpCodes.Not32(seed_high);

      if (not_seed_low === 0 && not_seed_high === 0) {
        this._y_low = 1;
        this._y_high = 0;
      } else {
        this._y_low = not_seed_low;
        this._y_high = not_seed_high;
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * 64-bit left shift
     */
    _shl64(low, high, shift) {
      low = OpCodes.ToUint32(low);
      high = OpCodes.ToUint32(high);

      if (shift === 0) return [low, high];
      if (shift >= 32) {
        return [0, OpCodes.ToUint32(OpCodes.Shl32(low, shift - 32))];
      }

      const highShifted = OpCodes.Shl32(high, shift);
      const lowShifted = OpCodes.Shr32(low, 32 - shift);
      const newHigh = OpCodes.ToUint32(OpCodes.OrN(highShifted, lowShifted));
      const newLow = OpCodes.ToUint32(OpCodes.Shl32(low, shift));
      return [newLow, newHigh];
    }

    /**
     * 64-bit right shift
     */
    _shr64(low, high, shift) {
      low = OpCodes.ToUint32(low);
      high = OpCodes.ToUint32(high);

      if (shift === 0) return [low, high];
      if (shift >= 32) {
        return [OpCodes.ToUint32(OpCodes.Shr32(high, shift - 32)), 0];
      }

      const lowShifted = OpCodes.Shr32(low, shift);
      const highShifted = OpCodes.Shl32(high, 32 - shift);
      const newLow = OpCodes.ToUint32(OpCodes.OrN(lowShifted, highShifted));
      const newHigh = OpCodes.ToUint32(OpCodes.Shr32(high, shift));
      return [newLow, newHigh];
    }

    /**
     * 64-bit XOR
     */
    _xor64(low1, high1, low2, high2) {
      return [OpCodes.ToUint32(OpCodes.XorN(low1, low2)), OpCodes.ToUint32(OpCodes.XorN(high1, high2))];
    }

    /**
     * 64-bit addition
     */
    _add64(low1, high1, low2, high2) {
      low1 = OpCodes.ToUint32(low1);
      high1 = OpCodes.ToUint32(high1);
      low2 = OpCodes.ToUint32(low2);
      high2 = OpCodes.ToUint32(high2);

      const lowSum = low1 + low2;
      const carry = (lowSum > 0xFFFFFFFF) ? 1 : 0;
      const newLow = OpCodes.ToUint32(lowSum);
      const newHigh = OpCodes.ToUint32(high1 + high2 + carry);

      return [newLow, newHigh];
    }

    /**
     * Generate next 64-bit value using custom XorShift+ algorithm
     *
     * C# algorithm:
     * var x = this._x;
     * var y = this._y;
     * x = XOR(x, left_shift(x, 23));
     * x = XOR(x, right_shift(x, 17));
     * x = XOR(x, XOR(y, right_shift(y, 26)));
     * this._x = y;
     * this._y = x;
     * return add(x, y);
     */
    _next64() {
      if (!this._ready) {
        throw new Error('XorShift+ not initialized: set seed first');
      }

      let x_low = this._x_low;
      let x_high = this._x_high;
      const y_low = this._y_low;
      const y_high = this._y_high;

      // x ^= OpCodes.Shl32(x, 23)
      let temp = this._shl64(x_low, x_high, 23);
      [x_low, x_high] = this._xor64(x_low, x_high, temp[0], temp[1]);

      // x ^= x >> 17
      temp = this._shr64(x_low, x_high, 17);
      [x_low, x_high] = this._xor64(x_low, x_high, temp[0], temp[1]);

      // x ^= y^(y >> 26)
      temp = this._shr64(y_low, y_high, 26);
      temp = this._xor64(y_low, y_high, temp[0], temp[1]);
      [x_low, x_high] = this._xor64(x_low, x_high, temp[0], temp[1]);

      // this._x = y
      this._x_low = y_low;
      this._x_high = y_high;

      // this._y = x
      this._y_low = x_low;
      this._y_high = x_high;

      // return x + y
      return this._add64(x_low, x_high, y_low, y_high);
    }

    /**
     * Generate random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('XorShift+ not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        const [low, high] = this._next64();

        const bytesToExtract = Math.min(bytesRemaining, 8);

        if (bytesToExtract > 0) {
          const lowBytes = OpCodes.Unpack32LE(low);
          for (let i = 0; i < Math.min(bytesToExtract, 4); ++i) {
            output.push(lowBytes[i]);
          }
        }

        if (bytesToExtract > 4) {
          const highBytes = OpCodes.Unpack32LE(high);
          for (let i = 0; i < bytesToExtract - 4; ++i) {
            output.push(highBytes[i]);
          }
        }

        bytesRemaining -= bytesToExtract;
      }

      return output;
    }

    // AlgorithmFramework interface
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {}

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      const size = this._outputSize || 64;

      if (this._skip && this._skip > 0) {
        for (let i = 0; i < this._skip; ++i) {
          this._next64();
        }
        this._skip = 0;
      }

      return this.NextBytes(size);
    }

    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize || 64;
    }

    set skip(count) {
      this._skip = count;
    }

    get skip() {
      return this._skip || 0;
    }
  }

  // Register algorithm
  const algorithmInstance = new XorShiftPlusAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { XorShiftPlusAlgorithm, XorShiftPlusInstance };
}));
