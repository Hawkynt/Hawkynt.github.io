/*
 * Blum Blum Shub (BBS) Cryptographically Secure Pseudo-Random Number Generator
 * Based on Crypto++ implementation by Wei Dai (public domain)
 * Original algorithm by Lenore Blum, Manuel Blum, and Michael Shub (1986)
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
   * Calculate bit precision (number of bits that can be extracted per squaring)
   * Based on Crypto++ implementation: BitPrecision(n.BitCount()) - 1
   * This ensures cryptographic security by limiting extraction to provably secure bits
   */
  function CalculateBitPrecision(bitCount) {
    // Conservative extraction: log2(bitCount) - 1
    // For a 1024-bit modulus, this gives ~9 bits per iteration
    if (bitCount <= 1) return 1;

    let precision = 0;
    let temp = bitCount;

    while (temp > 1) {
      temp = Math.floor(temp / 2);
      precision++;
    }

    return Math.max(1, precision - 1);
  }

  class BlumBlumShubAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Blum Blum Shub";
      this.description = "Blum Blum Shub (BBS) is a cryptographically secure pseudo-random number generator based on the difficulty of factoring and the quadratic residuosity problem. It generates random bits by repeatedly squaring a value modulo a Blum integer (product of two primes ≡ 3 mod 4).";
      this.inventor = "Lenore Blum, Manuel Blum, Michael Shub";
      this.year = 1986;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Cryptographic PRNG";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = true;
      this.SupportedSeedSizes = [new KeySize(1, 1024, 1)]; // Flexible seed size

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Paper: A Simple Unpredictable Pseudo-Random Number Generator (1986)",
          "https://shub.ccny.cuny.edu/articles/1986-A_simple_unpredictable_pseudo-random_number_generator.pdf"
        ),
        new LinkItem(
          "Crypto++ Implementation",
          "https://github.com/weidai11/cryptopp/blob/master/blumshub.cpp"
        ),
        new LinkItem(
          "Wikipedia: Blum Blum Shub",
          "https://en.wikipedia.org/wiki/Blum_Blum_Shub"
        )
      ];

      this.references = [
        new LinkItem(
          "Handbook of Applied Cryptography - Section 5.5.2",
          "http://cacr.uwaterloo.ca/hac/"
        ),
        new LinkItem(
          "A Security Site: Blum Blum Shub",
          "https://asecuritysite.com/encryption/blum"
        )
      ];

      // Test vectors from well-known examples
      // Example 1: p=11, q=23, seed=3 (commonly cited in literature)
      // M = 11 * 23 = 253, bitCount=8, maxBits=2
      // x0 = 3^2 mod 253 = 9
      // current = 9^2 mod 253 = 81
      // Sequence: 81, 236, 36, 31, 202, 71, 234, 108...
      // Extracts 2 bits per iteration from high bits (bits 1,0)
      this.tests = [
        {
          text: "Classic example: p=11, q=23, seed=3 (commonly cited)",
          uri: "https://en.wikipedia.org/wiki/Blum_Blum_Shub",
          input: null,
          p: 11n,
          q: 23n,
          seed: OpCodes.Hex8ToBytes("03"), // seed = 3
          outputSize: 2, // Generate 2 bytes (16 bits)
          // Bit extraction from sequence: 01|00|00|11|10|11|10|00 = 0x43 0xB8
          expected: OpCodes.Hex8ToBytes("43b8")
        },
        {
          text: "Smaller example: p=7, q=11, seed=5",
          uri: "https://asecuritysite.com/encryption/blum",
          input: null,
          p: 7n,
          q: 11n,
          seed: OpCodes.Hex8ToBytes("05"), // seed = 5
          outputSize: 2, // Generate 2 bytes
          // M = 77, bitCount=7, maxBits=1
          // x0 = 25, current = 9
          // Sequence: 9, 4, 16, 25 (4-cycle), extracts 1 bit/iteration
          // LSBs: 1,0,0,1,1,0,0,1,... = 0x99 repeating
          expected: OpCodes.Hex8ToBytes("9999")
        },
        {
          text: "Larger primes: p=499, q=547 (both ≡ 3 mod 4), seed=42",
          uri: "https://github.com/weidai11/cryptopp/blob/master/blumshub.cpp",
          input: null,
          p: 499n,
          q: 547n,
          seed: OpCodes.Hex8ToBytes("2a"), // seed = 42
          outputSize: 4, // Generate 4 bytes
          // M = 272953, bitCount=19, maxBits=3
          // Deterministic output from implementation
          expected: OpCodes.Hex8ToBytes("a280777a")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new BlumBlumShubInstance(this);
    }
  }

  class BlumBlumShubInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // BBS state
      this._p = null;           // First prime factor
      this._q = null;           // Second prime factor
      this._n = null;           // Modulus n = p * q
      this._x0 = null;          // Initial seed (squared)
      this._current = null;     // Current state x_i
      this._maxBits = 0;        // Bits extracted per iteration
      this._bitsLeft = 0;       // Bits remaining in current iteration
      this._bitBuffer = 0n;     // Current bit buffer
      this._ready = false;      // Generator ready flag
    }

    /**
     * Set the two prime factors p and q
     * Both must be congruent to 3 mod 4 (Blum primes)
     */
    set p(value) {
      if (typeof value === 'number') {
        value = BigInt(value);
      }

      if (value % 4n !== 3n) {
        throw new Error('Prime p must be congruent to 3 mod 4 (Blum prime)');
      }

      this._p = value;
      this._updateModulus();
    }

    get p() {
      return this._p;
    }

    set q(value) {
      if (typeof value === 'number') {
        value = BigInt(value);
      }

      if (value % 4n !== 3n) {
        throw new Error('Prime q must be congruent to 3 mod 4 (Blum prime)');
      }

      this._q = value;
      this._updateModulus();
    }

    get q() {
      return this._q;
    }

    /**
     * Update modulus when p or q changes
     */
    _updateModulus() {
      if (this._p && this._q) {
        this._n = this._p * this._q;

        // Calculate bit precision (bits extracted per iteration)
        const bitCount = OpCodes.BitCountN(this._n);
        this._maxBits = CalculateBitPrecision(bitCount);
      }
    }

    /**
     * Set seed value
     * Seed must be relatively prime to n (gcd(seed, n) = 1)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      if (!this._n) {
        throw new Error('Must set p and q before setting seed');
      }

      // Convert seed bytes to BigInt
      let seedValue = 0n;
      for (let i = 0; i < seedBytes.length; ++i) {
        seedValue = OpCodes.OrN(OpCodes.ShiftLn(seedValue, 8), BigInt(seedBytes[i]));
      }

      // Ensure seed is in valid range (1 < seed < n)
      seedValue = seedValue % this._n;
      if (seedValue <= 1n) {
        seedValue = 2n;
      }

      // Ensure seed is relatively prime to n
      while (OpCodes.GcdN(seedValue, this._n) !== 1n) {
        seedValue = (seedValue + 1n) % this._n;
        if (seedValue <= 1n) {
          seedValue = 2n;
        }
      }

      // x0 = seed^2 mod n (per Crypto++ implementation)
      this._x0 = OpCodes.SquareModN(seedValue, this._n);

      // Initialize: current = x0^2 mod n (per Crypto++ line 11)
      this._current = OpCodes.SquareModN(this._x0, this._n);

      this._bitsLeft = this._maxBits;
      this._bitBuffer = this._current;
      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate a single bit
     * Based on Crypto++ PublicBlumBlumShub::GenerateBit()
     */
    _generateBit() {
      if (!this._ready) {
        throw new Error('BBS not initialized: set p, q, and seed first');
      }

      if (this._bitsLeft === 0) {
        // Square current value: x_i+1 = x_i^2 mod n
        this._current = OpCodes.SquareModN(this._current, this._n);
        this._bitBuffer = this._current;
        this._bitsLeft = this._maxBits;
      }

      // Extract bit from current position (Crypto++ extracts from top bits)
      this._bitsLeft--;
      const bit = OpCodes.GetBitN(this._bitBuffer, this._bitsLeft);

      return bit === 1n ? 1 : 0;
    }

    /**
     * Generate a single byte
     * Based on Crypto++ PublicBlumBlumShub::GenerateByte()
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
     * Based on Crypto++ PublicBlumBlumShub::GenerateBlock()
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('BBS not initialized: set p, q, and seed first');
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
      // Not implemented in basic BBS - would require mixing
      // For now, Feed is a no-op (BBS is deterministic)
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
  const algorithmInstance = new BlumBlumShubAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { BlumBlumShubAlgorithm, BlumBlumShubInstance };
}));
