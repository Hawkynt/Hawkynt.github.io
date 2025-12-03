/*
 * Wyrand Pseudo-Random Number Generator
 * Based on WyHash by Wang Yi
 * Reference: https://github.com/wangyi-fudan/wyhash
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

  class WyrandAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Wyrand";
      this.description = "Wyrand is an extremely fast 64-bit pseudo-random number generator based on the WyHash mixing function. Designed by Wang Yi, it passes TestU01 BigCrush and is used in Go's standard library fastrand. Provides excellent statistical quality with minimal state and exceptional performance.";
      this.inventor = "Wang Yi";
      this.year = 2020;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Hash-Based PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.CN;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 8, 1)]; // 1-8 bytes (up to 64-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "WyHash Official Repository",
          "https://github.com/wangyi-fudan/wyhash"
        ),
        new LinkItem(
          "Modern Non-Cryptographic Hash Function and PRNG (Paper)",
          "https://github.com/wangyi-fudan/wyhash/blob/master/Modern%20Non-Cryptographic%20Hash%20Function%20and%20Pseudorandom%20Number%20Generator.pdf"
        ),
        new LinkItem(
          "Go Runtime Implementation (fastrand)",
          "https://go.dev/src/runtime/hash64.go"
        ),
        new LinkItem(
          "TestU01 Statistical Testing Suite",
          "http://simul.iro.umontreal.ca/testu01/tu01.html"
        )
      ];

      this.references = [
        new LinkItem(
          "Lemire's Testing RNG - Wyrand Implementation",
          "https://github.com/lemire/testingRNG/blob/master/source/wyrand.h"
        ),
        new LinkItem(
          "Wyrand Rust Implementation",
          "https://github.com/Bluefinger/wyrand-rs"
        ),
        new LinkItem(
          "WyHash .NET Implementation",
          "https://github.com/cocowalla/wyhash-dotnet"
        )
      ];

      // Test vectors verified against reference implementation
      // Generated using official algorithm from wyhash repository
      this.tests = [
        {
          text: "Seed 0: First 8 outputs (verified against reference C implementation)",
          uri: "https://github.com/wangyi-fudan/wyhash",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 64, // 8 outputs × 8 bytes each
          expected: OpCodes.Hex8ToBytes(
            "111CB3A78F59A58E" + // Output 1
            "CEABD938FF4E856D" + // Output 2
            "61FB51318F47D2A4" + // Output 3
            "78BD03C491909760" + // Output 4
            "7C003D7FB14820DE" + // Output 5
            "8769964729356B1F" + // Output 6
            "E214284DC87F9829" + // Output 7
            "29A283EBB1B295A2"   // Output 8
          )
        },
        {
          text: "Seed 1: First 5 outputs",
          uri: "https://github.com/wangyi-fudan/wyhash",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000001"),
          outputSize: 40, // 5 outputs × 8 bytes each
          expected: OpCodes.Hex8ToBytes(
            "CDEF1695E1F8ED2C" + // Output 1
            "61D6D24B1C9AAD40" + // Output 2
            "8CF880C22EEBFADF" + // Output 3
            "05B3A992FEDC4F8A" + // Output 4
            "01942E5B0CB4AE64"   // Output 5
          )
        },
        {
          text: "Seed 42: First 5 outputs (commonly used test seed)",
          uri: "https://github.com/wangyi-fudan/wyhash",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000000002A"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "AE4A7CBFDDA9B434" +
            "E9CC09D33D38D9D2" +
            "CB5756512B93433A" +
            "EB29B2A1320E1A71" +
            "5A3BD6480ED396C0"
          )
        },
        {
          text: "Seed 1234567: First 5 outputs",
          uri: "https://github.com/wangyi-fudan/wyhash",
          input: null,
          seed: OpCodes.Hex8ToBytes("000000000012D687"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "0E6C0D75670E37CC" +
            "6C97C0B827352C64" +
            "D0CD28CEC7470D39" +
            "A51D2A195AC69861" +
            "E09117771F95F935"
          )
        },
        {
          text: "Seed 0x123456789ABCDEF: First 5 outputs",
          uri: "https://github.com/wangyi-fudan/wyhash",
          input: null,
          seed: OpCodes.Hex8ToBytes("0123456789ABCDEF"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "58B962217AAFC627" +
            "D7488E0F880DBD37" +
            "A175B746466EAC63" +
            "159C6469D42795C0" +
            "CC2EC3081B141BE7"
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
      return new WyrandInstance(this);
    }
  }

  /**
 * Wyrand cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class WyrandInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Wyrand constants (from WyHash implementation)
      this.WYRAND_PRIME0 = 0xa0761d6478bd642fn;  // Increment constant (related to golden ratio)
      this.WYRAND_PRIME1 = 0xe7037ed1a0b428dbn;  // XOR mixing constant

      // Generator state
      this._state = 0n;
      this._ready = false;
    }

    /**
     * Set seed value (1-8 bytes)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 64-bit BigInt (big-endian - most significant byte first)
      this._state = 0n;
      for (let i = 0; i < seedBytes.length && i < 8; ++i) {
        this._state = OpCodes.OrN(OpCodes.ShiftLn(this._state, 8), BigInt(seedBytes[i]));
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * 128-bit multiplication helper
     * Multiplies two 64-bit values and returns {hi, lo} parts
     * @param {BigInt} a - First 64-bit value
     * @param {BigInt} b - Second 64-bit value
     * @returns {Object} {hi: high64bits, lo: low64bits}
     */
    _multiply128(a, b) {
      const mask32 = 0xFFFFFFFFn;

      // Split into 32-bit parts for accurate multiplication
      const a_lo = OpCodes.AndN(a, mask32);
      const a_hi = OpCodes.ShiftRn(a, 32n);
      const b_lo = OpCodes.AndN(b, mask32);
      const b_hi = OpCodes.ShiftRn(b, 32n);

      // Compute partial products (64-bit intermediate results)
      const ll = a_lo * b_lo;
      const lh = a_lo * b_hi;
      const hl = a_hi * b_lo;
      const hh = a_hi * b_hi;

      // Combine with carry propagation
      const mid1 = lh + OpCodes.ShiftRn(ll, 32n);
      const mid2 = hl + OpCodes.AndN(mid1, mask32);

      const lo = OpCodes.AndN(OpCodes.OrN(OpCodes.ShiftLn(OpCodes.AndN(mid2, mask32), 32n), OpCodes.AndN(ll, mask32)), 0xFFFFFFFFFFFFFFFFn);
      const hi = OpCodes.AndN(hh + OpCodes.ShiftRn(mid1, 32n) + OpCodes.ShiftRn(mid2, 32n), 0xFFFFFFFFFFFFFFFFn);

      return { hi, lo };
    }

    /**
     * Generate next 64-bit value using Wyrand algorithm
     *
     * Algorithm (from wyhash reference):
     * 1. state += WYRAND_PRIME0
     * 2. t = (state) * (state XOR WYRAND_PRIME1)  // 128-bit multiplication
     * 3. return (t shr 64) XOR t  // XOR high and low parts
     */
    _next64() {
      if (!this._ready) {
        throw new Error('Wyrand not initialized: set seed first');
      }

      // Step 1: Advance state by adding WYRAND_PRIME0
      this._state = OpCodes.AndN(this._state + this.WYRAND_PRIME0, 0xFFFFFFFFFFFFFFFFn);

      // Step 2: Mix state with WYRAND_PRIME1
      const mixed = OpCodes.XorN(this._state, this.WYRAND_PRIME1);

      // Step 3: 128-bit multiplication of state * mixed
      const product = this._multiply128(this._state, mixed);

      // Step 4: XOR high and low 64-bit parts for final output
      const output = OpCodes.XorN(product.hi, product.lo);

      return OpCodes.AndN(output, 0xFFFFFFFFFFFFFFFFn);
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Wyrand not initialized: set seed first');
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
          const byte = Number(OpCodes.AndN(OpCodes.ShiftRn(value, BigInt((7 - i) * 8)), 0xFFn));
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
      // For PRNG, Feed can be used to add entropy (reseed)
      // Not implemented in basic Wyrand - would require mixing
      // For now, Feed is a no-op (Wyrand is deterministic)
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
  const algorithmInstance = new WyrandAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { WyrandAlgorithm, WyrandInstance };
}));
