/*
 * XorShift* Pseudo-Random Number Generator
 * Ported from C# implementation: Hawkynt.RandomNumberGenerators.Deterministic.XorShiftStar
 *
 * This implementation uses XorShift* variant with 1x 64-bit state variable.
 * State initialization: s=seed (or 1 if seed==0)
 * Algorithm parameters: (a=12, b=25, c=27)
 * Multiplier: 0x2545F4914F6CDD1D
 *
 * Period: 2^64 - 1
 * State: 64 bits (one 64-bit word: s)
 *
 * Algorithm:
 *   s ^= s >> 12
 *   s ^= s << 25
 *   s ^= s >> 27
 *   return s * 0x2545F4914F6CDD1D
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

  class XorShiftStarAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "XorShift*";
      this.description = "XorShift* is a fast pseudo-random number generator using XOR-shift operations with multiplicative scrambling. Uses parameters (12, 25, 27) and multiplier 0x2545F4914F6CDD1D for excellent output quality across all bits.";
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
      // Ported from C# Hawkynt.RandomNumberGenerators.Deterministic.XorShiftStar
      this.tests = [
        {
          text: "Seed(1): First 5 outputs - verified against ported C# implementation",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000000000000"),
          outputSize: 40, // 5 outputs × 8 bytes each
          expected: OpCodes.Hex8ToBytes(
            "1DDD6C894BCEE447" +  // Output 1
            "1D6579E0A8A6CFAB" +  // Output 2
            "571F73EB8F0DD1B9" +  // Output 3
            "9D011BBBA018B44D" +  // Output 4
            "00A65A4DB099610E"    // Output 5
          )
        },
        {
          text: "Seed(2): First 5 outputs",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("0200000000000000"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "3ABAD912979CC98F" +  // Output 1
            "3ACAF2C0514D9F57" +  // Output 2
            "CB1B53ECF6354976" +  // Output 3
            "5798DD31DCEDA994" +  // Output 4
            "57E3DB90C4465D0E"    // Output 5
          )
        },
        {
          text: "Seed(123456789): First 10 outputs",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("15CD5B0700000000"),
          outputSize: 80,
          expected: OpCodes.Hex8ToBytes(
            "D7E3F5835AC3C0ED" +  // Output 1
            "4B1C8D2DFAF4927E" +  // Output 2
            "74FF46405BDFAE48" +  // Output 3
            "75B0473394D7A620" +  // Output 4
            "BA63DEB35831759F" +  // Output 5
            "B6E6BF4FDF85C679" +  // Output 6
            "0C5DC26184BB3E85" +  // Output 7
            "3625A2470CD6A48A" +  // Output 8
            "51A4D0C3064B6C78" +  // Output 9
            "8E87A3D5727327EA"    // Output 10
          )
        },
        {
          text: "Seed(1000000): First 8 outputs - large seed value",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("40420F0000000000"),
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes(
            "D52118FD7BFADB0D" +  // Output 1
            "A4AD2BB4EFCC4314" +  // Output 2
            "2184447D9A8874F8" +  // Output 3
            "83A7ABA09F5B1225" +  // Output 4
            "CEF92F21C2B56863" +  // Output 5
            "A2AF0EB1790F3E00" +  // Output 6
            "CF8FF1667CA73FE8" +  // Output 7
            "B94BCFBFE165FF7D"    // Output 8
          )
        },
        {
          text: "Seed(0xDEADBEEFCAFEBABE): First 5 outputs - hex seed pattern",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("BEBAFECAEFBEADDE"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "F4800A9FBF57297D" +  // Output 1
            "3641B0846BA6FC25" +  // Output 2
            "FF7044FEB40DB26F" +  // Output 3
            "362EF881BBC1F152" +  // Output 4
            "BCD0CC19A888450B"    // Output 5
          )
        },
        {
          text: "Seed(0xFFFFFFFFFFFFFFFF): First 5 outputs - maximum seed",
          uri: "https://github.com/Hawkynt/Randomizer",
          input: null,
          seed: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFF"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "000000C6E5C92CF9" +  // Output 1
            "E3AE1EFDD884F48F" +  // Output 2
            "C6AB6F32F3956C34" +  // Output 3
            "C0F2C5379CCC56C5" +  // Output 4
            "071A10833F652D6C"    // Output 5
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
      return new XorShiftStarInstance(this);
    }
  }

  /**
 * XorShiftStar cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class XorShiftStarInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // XorShift* uses 1x 64-bit state variable
      this._s_low = 0;
      this._s_high = 0;
      this._ready = false;

      // Multiplier constant: 0x2545F4914F6CDD1D
      this._MULT_LOW = 0x4F6CDD1D;
      this._MULT_HIGH = 0x2545F491;
    }

    /**
     * Set seed value (1-8 bytes)
     * Matches C# logic: s = seed (or 1 if seed==0)
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

      // s = seed == 0 ? 1 : seed
      if (seed_low === 0 && seed_high === 0) {
        this._s_low = 1;
        this._s_high = 0;
      } else {
        this._s_low = seed_low;
        this._s_high = seed_high;
      }

      this._ready = true;
    }

    get seed() {
      return null;
    }

    /**
     * 64-bit right shift
     */
    _shr64(low, high, shift) {
      low = low >>> 0;
      high = high >>> 0;

      if (shift === 0) return [low, high];
      if (shift >= 32) {
        return [(high >>> (shift - 32)) >>> 0, 0];
      }

      const newLow = ((low >>> shift) | (high << (32 - shift))) >>> 0;
      const newHigh = (high >>> shift) >>> 0;
      return [newLow, newHigh];
    }

    /**
     * 64-bit left shift
     */
    _shl64(low, high, shift) {
      low = low >>> 0;
      high = high >>> 0;

      if (shift === 0) return [low, high];
      if (shift >= 32) {
        return [0, (low << (shift - 32)) >>> 0];
      }

      const newHigh = ((high << shift) | (low >>> (32 - shift))) >>> 0;
      const newLow = (low << shift) >>> 0;
      return [newLow, newHigh];
    }

    /**
     * 64-bit XOR
     */
    _xor64(low1, high1, low2, high2) {
      return [(low1 ^ low2) >>> 0, (high1 ^ high2) >>> 0];
    }

    /**
     * 64-bit multiplication (keeping low 64 bits)
     */
    _mul64(aLow, aHigh, bLow, bHigh) {
      aLow = aLow >>> 0;
      aHigh = aHigh >>> 0;
      bLow = bLow >>> 0;
      bHigh = bHigh >>> 0;

      // Split into 16-bit chunks
      const a00 = aLow & 0xFFFF;
      const a16 = aLow >>> 16;
      const a32 = aHigh & 0xFFFF;
      const a48 = aHigh >>> 16;

      const b00 = bLow & 0xFFFF;
      const b16 = bLow >>> 16;
      const b32 = bHigh & 0xFFFF;
      const b48 = bHigh >>> 16;

      // Multiply 16-bit chunks
      let c00 = a00 * b00;
      let c16 = c00 >>> 16;
      c00 &= 0xFFFF;

      c16 += a16 * b00;
      let c32 = c16 >>> 16;
      c16 &= 0xFFFF;

      c16 += a00 * b16;
      c32 += c16 >>> 16;
      c16 &= 0xFFFF;

      c32 += a32 * b00;
      let c48 = c32 >>> 16;
      c32 &= 0xFFFF;

      c32 += a16 * b16;
      c48 += c32 >>> 16;
      c32 &= 0xFFFF;

      c32 += a00 * b32;
      c48 += c32 >>> 16;
      c32 &= 0xFFFF;

      c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
      c48 &= 0xFFFF;

      return [((c16 << 16) | c00) >>> 0, ((c48 << 16) | c32) >>> 0];
    }

    /**
     * Generate next 64-bit value using XorShift* algorithm
     *
     * C# algorithm:
     * var s = this._state;
     * s ^= s >> 12;
     * s ^= s << 25;
     * s ^= s >> 27;
     * this._state = s;
     * return s * _MULTIPLICATOR;
     */
    _next64() {
      if (!this._ready) {
        throw new Error('XorShift* not initialized: set seed first');
      }

      let s_low = this._s_low;
      let s_high = this._s_high;

      // s ^= s >> 12
      let temp = this._shr64(s_low, s_high, 12);
      [s_low, s_high] = this._xor64(s_low, s_high, temp[0], temp[1]);

      // s ^= s << 25
      temp = this._shl64(s_low, s_high, 25);
      [s_low, s_high] = this._xor64(s_low, s_high, temp[0], temp[1]);

      // s ^= s >> 27
      temp = this._shr64(s_low, s_high, 27);
      [s_low, s_high] = this._xor64(s_low, s_high, temp[0], temp[1]);

      // Update state
      this._s_low = s_low;
      this._s_high = s_high;

      // return s * 0x2545F4914F6CDD1D
      return this._mul64(s_low, s_high, this._MULT_LOW, this._MULT_HIGH);
    }

    /**
     * Generate random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('XorShift* not initialized: set seed first');
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
  const algorithmInstance = new XorShiftStarAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { XorShiftStarAlgorithm, XorShiftStarInstance };
}));
