/*
 * Blum-Micali Cryptographically Secure Pseudo-Random Number Generator
 * Based on the discrete logarithm problem
 * Original algorithm by Manuel Blum and Silvio Micali (1984)
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

  class BlumMicaliAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Blum-Micali";
      this.description = "Blum-Micali is a cryptographically secure pseudo-random bit generator based on the difficulty of computing discrete logarithms. It generates random bits by iteratively computing g^x mod p where g is a primitive root and p is a large prime, extracting one bit per iteration based on whether the result is in the lower or upper half of the range.";
      this.inventor = "Manuel Blum, Silvio Micali";
      this.year = 1984;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Cryptographic PRNG";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = true;
      this.SupportedSeedSizes = [new KeySize(1, 128, 1)]; // Flexible seed size

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: How to Generate Cryptographically Strong Sequences of Pseudo Random Bits (1982)",
          "https://apps.dtic.mil/sti/pdfs/ADA114854.pdf"
        ),
        new LinkItem(
          "Wikipedia: Blum-Micali Algorithm",
          "https://en.wikipedia.org/wiki/Blum%E2%80%93Micali_algorithm"
        ),
        new LinkItem(
          "Handbook of Applied Cryptography - Section 5.4.2",
          "http://cacr.uwaterloo.ca/hac/"
        )
      ];

      this.references = [
        new LinkItem(
          "Introduction to Modern Cryptography by Katz and Lindell",
          "https://www.cs.umd.edu/~jkatz/imc.html"
        ),
        new LinkItem(
          "Lecture Notes on Pseudorandom Generators",
          "https://www.cs.princeton.edu/courses/archive/spr05/cos598D/scribe1.pdf"
        )
      ];

      // Test vectors derived from known parameters
      // Using parameters from the C# implementation and computing expected outputs
      this.tests = [
        {
          text: "Small parameters: p=23, g=5 (primitive root), seed=3",
          uri: "https://en.wikipedia.org/wiki/Blum%E2%80%93Micali_algorithm",
          input: null,
          p: 23n,
          g: 5n,
          seed: OpCodes.Hex8ToBytes("03"), // seed = 3
          outputSize: 2, // Generate 2 bytes (16 bits)
          // threshold = (23-1)/2 = 11
          // Sequence of states and bits:
          // state=10 -> bit=0, state=9 -> bit=0, state=11 -> bit=0, state=22 -> bit=1
          // state=1 -> bit=0, state=5 -> bit=0, state=20 -> bit=1, state=12 -> bit=1
          // state=18 -> bit=1, state=6 -> bit=0, state=8 -> bit=0, state=16 -> bit=1
          // state=3 -> bit=0, state=10 -> bit=0, state=9 -> bit=0, state=11 -> bit=0
          // Bits: 00010011 10010000 = 0x13 0x90
          expected: OpCodes.Hex8ToBytes("1390")
        },
        {
          text: "Medium parameters: p=47, g=5, seed=7",
          uri: "https://www.cs.princeton.edu/courses/archive/spr05/cos598D/scribe1.pdf",
          input: null,
          p: 47n,
          g: 5n,
          seed: OpCodes.Hex8ToBytes("07"), // seed = 7
          outputSize: 4, // Generate 4 bytes
          // threshold = (47-1)/2 = 23
          // Sequence produces repeating pattern due to cycle in exponentiation
          // Bits: 00111000 11100011 10001110 00111000 = 0x38 0xe3 0x8e 0x38
          expected: OpCodes.Hex8ToBytes("38e38e38")
        },
        {
          text: "Default C# parameters: p=6364136223846793005, g=2147483647, seed=42",
          uri: "https://github.com/Hawkynt/C--FrameworkExtensions/blob/master/Hawkynt.RandomNumberGenerators/Cryptographic/BlumMicali.cs",
          input: null,
          p: 6364136223846793005n,
          g: 2147483647n,
          seed: OpCodes.Hex8ToBytes("2a"), // seed = 42
          outputSize: 8, // Generate 8 bytes (64 bits)
          // threshold = (6364136223846793005-1)/2 = 3182068111923396502
          // Deterministic output from modular exponentiation sequence
          // Bits: 10100111 00101101 10011111 10010110 11110011 11010000 00110110 00100010
          expected: OpCodes.Hex8ToBytes("a72d9f96f3d03622")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new BlumMicaliInstance(this);
    }
  }

  class BlumMicaliInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Blum-Micali state
      this._p = null;           // Large prime modulus
      this._g = null;           // Primitive root (generator)
      this._state = null;       // Current state x_i
      this._threshold = null;   // (p-1)/2 for bit extraction
      this._ready = false;      // Generator ready flag
    }

    /**
     * Set the prime modulus p
     * Should be a large prime for cryptographic security
     */
    set p(value) {
      if (typeof value === 'number') {
        value = BigInt(value);
      }

      if (value <= 2n) {
        throw new Error('Prime p must be greater than 2');
      }

      this._p = value;
      this._threshold = (value - 1n) / 2n;
    }

    get p() {
      return this._p;
    }

    /**
     * Set the generator g (primitive root modulo p)
     * Should be a primitive root for proper distribution
     */
    set g(value) {
      if (typeof value === 'number') {
        value = BigInt(value);
      }

      if (value <= 1n) {
        throw new Error('Generator g must be greater than 1');
      }

      this._g = value;
    }

    get g() {
      return this._g;
    }

    /**
     * Set seed value (initial state)
     * Seed must be in range [2, p-1]
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      if (!this._p) {
        throw new Error('Must set p before setting seed');
      }

      if (!this._g) {
        throw new Error('Must set g before setting seed');
      }

      // Convert seed bytes to BigInt
      let seedValue = 0n;
      for (let i = 0; i < seedBytes.length; ++i) {
        seedValue = OpCodes.OrN(OpCodes.ShiftLn(seedValue, 8), BigInt(seedBytes[i]));
      }

      // Ensure seed is in valid range [2, p-1]
      seedValue = seedValue % this._p;
      if (seedValue < 2n) {
        seedValue = 2n;
      }

      this._state = seedValue;
      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate a single bit using Blum-Micali algorithm
     * Algorithm:
     * 1. Compute x_(i+1) = g^(x_i) mod p
     * 2. Output bit = 0 if x_(i+1) <= (p-1)/2, else 1
     */
    _generateBit() {
      if (!this._ready) {
        throw new Error('Blum-Micali not initialized: set p, g, and seed first');
      }

      // Update state: x_(i+1) = g^(x_i) mod p
      this._state = OpCodes.ModPowN(this._g, this._state, this._p);

      // Extract bit: 0 if state <= threshold, else 1
      return this._state <= this._threshold ? 0 : 1;
    }

    /**
     * Generate a single byte (8 bits)
     */
    _generateByte() {
      let byte = 0;

      for (let i = 0; i < 8; ++i) {
        byte = OpCodes.Shl8(byte, 1) | this._generateBit();
      }

      return byte;
    }

    /**
     * Generate random bytes
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('Blum-Micali not initialized: set p, g, and seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      for (let i = 0; i < length; ++i) {
        output.push(this._generateByte());
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For PRNG, Feed can be used to add entropy (reseed)
      // Not implemented in basic Blum-Micali - would require mixing
      // For now, Feed is a no-op (Blum-Micali is deterministic)
    }

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
  const algorithmInstance = new BlumMicaliAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { BlumMicaliAlgorithm, BlumMicaliInstance };
}));
