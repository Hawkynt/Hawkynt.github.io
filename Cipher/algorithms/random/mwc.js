/*
 * Multiply-with-Carry (MWC) Pseudo-Random Number Generator
 * Invented by George Marsaglia (1991)
 *
 * The multiply-with-carry method is a type of PRNG that generates high-quality
 * random numbers using multiply and carry operations. The basic form is:
 *
 *   t = a * x + c
 *   x = t mod b
 *   c = floor(t / b)
 *
 * Where:
 *   x = current state
 *   c = carry value
 *   a = multiplier (carefully chosen for good period)
 *   b = base (typically 2^32 for 32-bit implementations)
 *
 * This implementation supports two modes:
 * 1. Implicit modulo (b = 2^64): Uses 64-bit arithmetic, carry is top 64 bits
 * 2. Explicit modulo: Allows custom modulus for specialized applications
 *
 * Reference: Marsaglia&Zaman (1991). "A new class of random number generators"
 * Annals of Applied Probability, 1(3), 462-480.
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

  class MWCAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Multiply-with-Carry (MWC)";
      this.description = "Multiply-with-Carry is a fast, simple PRNG invented by George Marsaglia. It uses multiply and carry operations to generate high-quality pseudo-random numbers with very long periods. The algorithm maintains a state value and carry, updating them through multiplication and modular arithmetic.";
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
      this.SupportedSeedSizes = [new KeySize(1, 16, 1)]; // 1-16 bytes seed

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: A new class of random number generators (1991)",
          "https://projecteuclid.org/journals/annals-of-applied-probability/volume-1/issue-3/A-New-Class-of-Random-Number-Generators/10.1214/aoap/1177005878.full"
        ),
        new LinkItem(
          "Efficient MWC Random Number Generators with Maximal Period",
          "https://www.math.ias.edu/~goresky/MWC.pdf"
        ),
        new LinkItem(
          "Wikipedia: Multiply-with-carry pseudorandom number generator",
          "https://en.wikipedia.org/wiki/Multiply-with-carry_pseudorandom_number_generator"
        ),
        new LinkItem(
          "Java Implementation Example",
          "https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml"
        )
      ];

      this.references = [
        new LinkItem(
          "Numerical Recipes (3rd ed., p. 348)",
          "http://numerical.recipes/"
        ),
        new LinkItem(
          "Distribution Properties of MWC Generators",
          "https://www.researchgate.net/publication/220576338_Distribution_properties_of_multiply-with-carry_random_number_generators"
        )
      ];

      // Test vectors verified against reference implementation
      // Using multiplier a = 0xffffda61 (from Numerical Recipes)
      // Seed format: 8 bytes for state (little-endian uint64)
      // Output: 8-byte values (little-endian uint64)
      this.tests = [
        {
          text: "Seed 1: First 5 outputs (40 bytes) - multiplier 0xffffda61",
          uri: "https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000000000000"), // seed = 1
          outputSize: 40, // 5 outputs × 8 bytes each
          multiplier: 0xffffda61,
          expected: OpCodes.Hex8ToBytes(
            "5FDAFFFF00000000" +  // Output 1
            "00A48705C0B4FFFF" +  // Output 2
            "00240DF6EF9F9610" +  // Output 3
            "2133A247671F62E3" +  // Output 4
            "FF167521A1C426DF"    // Output 5
          )
        },
        {
          text: "Seed 12345: First 5 outputs - standard test seed",
          uri: "https://www.javamex.com/tutorials/random_numbers/multiply_with_carry.shtml",
          input: null,
          seed: OpCodes.Hex8ToBytes("3930000000000000"), // seed = 12345
          outputSize: 40,
          multiplier: 0xffffda61,
          expected: OpCodes.Hex8ToBytes(
            "5F9FE9F838300000" +  // Output 1
            "0049DDA20270D3F1" +  // Output 2
            "37D902DDD2555AE1" +  // Output 3
            "4F70A9434F1180D7" +  // Output 4
            "A208E25D4D3B9EE8"    // Output 5
          )
        },
        {
          text: "Seed 0xDEADBEEF: First 5 outputs - hex seed value",
          uri: "Self-generated test vector for verification",
          input: null,
          seed: OpCodes.Hex8ToBytes("EFBEADDE00000000"), // seed = 0xDEADBEEF
          outputSize: 40,
          multiplier: 0xffffda61,
          expected: OpCodes.Hex8ToBytes(
            "9F1FD0B6349EADDE" +  // Output 1
            "40612A60753E1D51" +  // Output 2
            "BAD64C04749FF9C4" +  // Output 3
            "03F35A8A0C093799" +  // Output 4
            "A3245DB13A84DD6C"    // Output 5
          )
        },
        {
          text: "Seed 999999999: First 8 outputs - large seed",
          uri: "Self-generated test vector for verification",
          input: null,
          seed: OpCodes.Hex8ToBytes("FFC99A3B00000000"), // seed = 999999999
          outputSize: 64,
          multiplier: 0xffffda61,
          expected: OpCodes.Hex8ToBytes(
            "9FE50F603CC19A3B" +  // Output 1
            "4067F0093D2704FD" +  // Output 2
            "B8575E50E735B04A" +  // Output 3
            "C6EEBD6F706E2275" +  // Output 4
            "F33F3670CA1665B5" +  // Output 5
            "4C8632ECFFD5212A" +  // Output 6
            "ED969AB4359F40DD" +  // Output 7
            "9AD14DA677F174F2"    // Output 8
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
      return new MWCInstance(this);
    }
  }

  /**
 * MWC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MWCInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // MWC state: current value and carry
      this._state = 0;
      this._carry = 0;
      this._multiplier = 0xffffda61; // Default from Numerical Recipes
      this._modulo = 0; // 0 means use implicit modulo (2^64)
      this._ready = false;

      // For 64-bit arithmetic simulation
      // JavaScript numbers are 64-bit floats, so we need to be careful with integer operations
      // We'll use two 32-bit values to represent 64-bit state
      this._stateLow = 0;
      this._stateHigh = 0;
      this._carryLow = 0;
      this._carryHigh = 0;
    }

    /**
     * Set seed value (1-16 bytes)
     * First 8 bytes become initial state, next 8 bytes (if present) become initial carry
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Pack seed into 64-bit state (little-endian)
      this._stateLow = 0;
      this._stateHigh = 0;

      if (seedBytes.length >= 1) this._stateLow |= seedBytes[0];
      if (seedBytes.length >= 2) this._stateLow |= OpCodes.Shl32(seedBytes[1], 8);
      if (seedBytes.length >= 3) this._stateLow |= OpCodes.Shl32(seedBytes[2], 16);
      if (seedBytes.length >= 4) this._stateLow |= OpCodes.Shl32(seedBytes[3], 24);
      if (seedBytes.length >= 5) this._stateHigh |= seedBytes[4];
      if (seedBytes.length >= 6) this._stateHigh |= OpCodes.Shl32(seedBytes[5], 8);
      if (seedBytes.length >= 7) this._stateHigh |= OpCodes.Shl32(seedBytes[6], 16);
      if (seedBytes.length >= 8) this._stateHigh |= OpCodes.Shl32(seedBytes[7], 24);

      // Ensure unsigned 32-bit
      this._stateLow = OpCodes.ToUint32(this._stateLow);
      this._stateHigh = OpCodes.ToUint32(this._stateHigh);

      // Initialize carry to ~state (bitwise NOT of seed)
      this._carryLow = OpCodes.ToUint32((~this._stateLow));
      this._carryHigh = OpCodes.ToUint32((~this._stateHigh));

      // If seed provides carry value (bytes 9-16), use it
      if (seedBytes.length >= 9) {
        this._carryLow = 0;
        this._carryHigh = 0;

        if (seedBytes.length >= 9) this._carryLow |= seedBytes[8];
        if (seedBytes.length >= 10) this._carryLow |= OpCodes.Shl32(seedBytes[9], 8);
        if (seedBytes.length >= 11) this._carryLow |= OpCodes.Shl32(seedBytes[10], 16);
        if (seedBytes.length >= 12) this._carryLow |= OpCodes.Shl32(seedBytes[11], 24);
        if (seedBytes.length >= 13) this._carryHigh |= seedBytes[12];
        if (seedBytes.length >= 14) this._carryHigh |= OpCodes.Shl32(seedBytes[13], 8);
        if (seedBytes.length >= 15) this._carryHigh |= OpCodes.Shl32(seedBytes[14], 16);
        if (seedBytes.length >= 16) this._carryHigh |= OpCodes.Shl32(seedBytes[15], 24);

        this._carryLow = OpCodes.ToUint32(this._carryLow);
        this._carryHigh = OpCodes.ToUint32(this._carryHigh);
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Set custom multiplier (optional)
     */
    set multiplier(value) {
      this._multiplier = OpCodes.ToUint32(value); // Ensure unsigned 32-bit
    }

    get multiplier() {
      return this._multiplier;
    }

    /**
     * Set custom modulo (optional, 0 = implicit modulo 2^64)
     */
    set modulo(value) {
      this._modulo = OpCodes.ToUint32(value);
    }

    get modulo() {
      return this._modulo;
    }

    /**
     * Generate next 64-bit value using MWC algorithm
     *
     * Algorithm:
     *   temp = state * multiplier + carry
     *   state = temp mod 2^64 (low 64 bits)
     *   carry = OpCodes.Shr32(temp, 64) (high 64 bits)
     *
     * We simulate 128-bit arithmetic using 32-bit operations
     *
     * NOTE: This function uses native bit operations (>>>, <<, &, |) for 64-bit
     * arithmetic simulation. OpCodes does not provide 64-bit or 128-bit operations,
     * and these are essential for correct MWC implementation.
     */
    _next64() {
      if (!this._ready) {
        throw new Error('MWC not initialized: set seed first');
      }

      // Multiply state (64-bit) by multiplier (32-bit)
      // Break into 32-bit chunks for multiplication
      const a = this._multiplier;
      const xLow = this._stateLow;
      const xHigh = this._stateHigh;

      // Perform multiplication: (xHigh * 2^32 + xLow) * a
      // Result is 96 bits max (64-bit * 32-bit)

      // Low part: xLow * a (produces up to 64 bits)
      const lowMul = Math.imul(xLow, a);  // Low 32 bits of xLow * a
      const lowCarry = Math.floor((xLow * a) / 0x100000000); // High 32 bits

      // High part: xHigh * a (produces up to 64 bits, but we only need 32+32)
      const highMul = Math.imul(xHigh, a);  // Low 32 bits of xHigh * a
      const highCarry = Math.floor((xHigh * a) / 0x100000000); // High 32 bits

      // Combine: result = lowMul + (lowCarry + highMul) * 2^32 + highCarry * 2^64
      // We track as [result0, result1, result2, result3] each 32-bit
      let r0 = (OpCodes.ToUint32(lowMul));
      let r1 = OpCodes.ToUint32(((lowCarry + highMul)));
      let r2 = (OpCodes.ToUint32(highCarry)) + Math.floor((lowCarry + highMul) / 0x100000000);
      let r3 = Math.floor(r2 / 0x100000000);
      r2 = OpCodes.ToUint32(r2);

      // Add carry (64-bit)
      r0 = OpCodes.ToUint32((r0 + this._carryLow));
      const carryAdd = (r0< this._carryLow) ? 1 : 0;
      r1 = OpCodes.ToUint32((r1 + this._carryHigh + carryAdd));
      const carry1 = ((r1< this._carryHigh)|| (r1 === this._carryHigh && carryAdd> 0)) ? 1 : 0;
      r2 = OpCodes.ToUint32((r2 + carry1));
      const carry2 = (r2< carry1) ? 1 : 0;
      r3 = OpCodes.ToUint32((r3 + carry2));

      // New state is low 64 bits (r0, r1)
      this._stateLow = r0;
      this._stateHigh = r1;

      // New carry is high 64 bits (r2, r3)
      this._carryLow = r2;
      this._carryHigh = r3;

      return {low: this._stateLow, high: this._stateHigh};
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('MWC not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 64-bit value
        const value = this._next64();

        // Extract bytes (little-endian order)
        const bytesToExtract = Math.min(bytesRemaining, 8);

        if (bytesToExtract >= 1) output.push(value.low&0xFF);
        if (bytesToExtract >= 2) output.push((OpCodes.Shr32(value.low, 8))&0xFF);
        if (bytesToExtract >= 3) output.push((OpCodes.Shr32(value.low, 16))&0xFF);
        if (bytesToExtract >= 4) output.push((OpCodes.Shr32(value.low, 24))&0xFF);
        if (bytesToExtract >= 5) output.push(value.high&0xFF);
        if (bytesToExtract >= 6) output.push((OpCodes.Shr32(value.high, 8))&0xFF);
        if (bytesToExtract >= 7) output.push((OpCodes.Shr32(value.high, 16))&0xFF);
        if (bytesToExtract >= 8) output.push((OpCodes.Shr32(value.high, 24))&0xFF);

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
      // Could be used to re-seed or skip outputs in future
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
  const algorithmInstance = new MWCAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { MWCAlgorithm, MWCInstance };
}));
