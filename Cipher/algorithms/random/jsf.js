/*
 * JSF (Jenkins Small Fast) Pseudo-Random Number Generator
 * Based on Bob Jenkins' original specification (2007)
 *
 * JSF is a small, fast, non-cryptographic PRNG designed by Bob Jenkins.
 * It maintains 128 bits of internal state (four 32-bit values: a, b, c, d)
 * and uses rotation and addition operations for mixing. The algorithm passes
 * PractRand statistical testing and is used as the baseline for evaluating
 * other small fast chaotic RNGs.
 *
 * State: 128 bits (four 32-bit words: a, b, c, d)
 * Algorithm: e = a - ROL(b, 27)
 *            a = b ^ ROL(c, 17)
 *            b = c + d
 *            c = d + e
 *            d = e + a
 *            return d
 *
 * Period: 2^126 (expected average cycle length)
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

  class JSFAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "JSF";
      this.description = "JSF (Jenkins Small Fast) is a compact, high-speed pseudo-random number generator by Bob Jenkins with 128-bit state. It uses simple operations (rotate, add, XOR) to achieve good statistical properties and passes PractRand testing. Widely used as a baseline for evaluating small fast RNGs.";
      this.inventor = "Bob Jenkins";
      this.year = 2007;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Deterministic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 4, 1)]; // 1-4 bytes (up to 32-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Original Specification: A small noncryptographic PRNG",
          "http://burtleburtle.net/bob/rand/smallprng.html"
        ),
        new LinkItem(
          "PractRand Analysis: Bob Jenkins's Small PRNG",
          "https://www.pcg-random.org/posts/bob-jenkins-small-prng-passes-practrand.html"
        ),
        new LinkItem(
          "C++ Implementation by Melissa O'Neill",
          "https://gist.github.com/imneme/85cff47d4bad8de6bdeb671f9c76c814"
        ),
        new LinkItem(
          "Wikipedia: Jenkins hash function",
          "https://en.wikipedia.org/wiki/Jenkins_hash_function"
        )
      ];

      this.references = [
        new LinkItem(
          "PractRand Statistical Testing Suite",
          "https://pracrand.sourceforge.net/"
        ),
        new LinkItem(
          "Bob Jenkins' Website: Hash and PRNG algorithms",
          "http://burtleburtle.net/bob/hash/"
        )
      ];

      // Test vectors verified against Bob Jenkins' reference C implementation
      // Source: http://burtleburtle.net/bob/rand/smallprng.html
      // Generated using reference implementation with standard initialization
      this.tests = [
        {
          text: "Seed 0x00000000: First 10 outputs (40 bytes) - verified against reference C implementation",
          uri: "http://burtleburtle.net/bob/rand/smallprng.html",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000000"),
          outputSize: 40, // 10 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "1A9B6C07" +  // Output 1: 446393351
            "9A550895" +  // Output 2: 2589264021
            "F12BE876" +  // Output 3: 4046186614
            "0902BA19" +  // Output 4: 151173657
            "20F1A244" +  // Output 5: 552706628
            "832BC5D2" +  // Output 6: 2200683986
            "0BFDB9A1" +  // Output 7: 201177505
            "7384175A" +  // Output 8: 1938036570
            "96A0F7E5" +  // Output 9: 2527131621
            "470AD8F6"    // Output 10: 1191893238
          )
        },
        {
          text: "Seed 0x00000001: First 10 outputs (40 bytes) - reference implementation",
          uri: "http://burtleburtle.net/bob/rand/smallprng.html",
          input: null,
          seed: OpCodes.Hex8ToBytes("00000001"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "A25132F4" +  // Output 1: 2723230452
            "1EFA0761" +  // Output 2: 519702369
            "332B56B3" +  // Output 3: 858478259
            "D1AEDB87" +  // Output 4: 3517897607
            "4C4D7156" +  // Output 5: 1280143702
            "B663157A" +  // Output 6: 3059946874
            "9B0A0C8A" +  // Output 7: 2601127050
            "973762FE" +  // Output 8: 2536989438
            "DDE060EC" +  // Output 9: 3722469612
            "17E08DEC"    // Output 10: 400592364
          )
        },
        {
          text: "Seed 0xDEADBEEF: First 10 outputs - test with common debug value",
          uri: "http://burtleburtle.net/bob/rand/smallprng.html",
          input: null,
          seed: OpCodes.Hex8ToBytes("DEADBEEF"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "FA65A416" +  // Output 1: 4200965142
            "ADDCC8E0" +  // Output 2: 2916927712
            "93BC44AC" +  // Output 3: 2478589100
            "7ABD07E5" +  // Output 4: 2059208677
            "19CBDD75" +  // Output 5: 432790901
            "4B2DC247" +  // Output 6: 1261290055
            "64721EEF" +  // Output 7: 1685200623
            "1216E1BF" +  // Output 8: 303489471
            "FDCAEC4E" +  // Output 9: 4257934414
            "4DD17FB7"    // Output 10: 1305575351
          )
        },
        {
          text: "Seed 0x12345678: First 10 outputs - test with sequential byte pattern",
          uri: "http://burtleburtle.net/bob/rand/smallprng.html",
          input: null,
          seed: OpCodes.Hex8ToBytes("12345678"),
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "4324435B" +  // Output 1: 1126450011
            "28203161" +  // Output 2: 673198433
            "E6D195A6" +  // Output 3: 3872495014
            "31E53A77" +  // Output 4: 837106295
            "7C50CDFB" +  // Output 5: 2085670395
            "1849D870" +  // Output 6: 407492720
            "8ACF3D19" +  // Output 7: 2328837401
            "B11C67E4" +  // Output 8: 2971428836
            "22BAC887" +  // Output 9: 582666375
            "7C58E3E7"    // Output 10: 2086200295
          )
        },
        {
          text: "Seed 0xCAFEBABE: First 8 outputs (32 bytes) - test with another common value",
          uri: "http://burtleburtle.net/bob/rand/smallprng.html",
          input: null,
          seed: OpCodes.Hex8ToBytes("CAFEBABE"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "C722B02E" +  // Output 1: 3340939310
            "94AF7B4B" +  // Output 2: 2494528331
            "AD16571E" +  // Output 3: 2903922462
            "1F2632D3" +  // Output 4: 522597075
            "FAA708AC" +  // Output 5: 4205250732
            "C7A955C6" +  // Output 6: 3349763526
            "227B8144" +  // Output 7: 578519364
            "37A4F519"    // Output 8: 933557529
          )
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new JSFInstance(this);
    }
  }

  class JSFInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // JSF uses 4x 32-bit state variables (a, b, c, d)
      this._a = 0;
      this._b = 0;
      this._c = 0;
      this._d = 0;
      this._ready = false;
    }

    /**
     * Set seed value (1-4 bytes)
     * Seed format: up to 4 bytes mapped to a single 32-bit seed value
     * Initialization: a = 0xf1ea5eed (constant)
     *                b = c = d = seed
     *                Run 20 iterations to mix state
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Convert seed bytes to 32-bit value (big-endian)
      let seedValue = 0;
      if (seedBytes.length >= 4) {
        seedValue = OpCodes.Pack32BE(
          seedBytes[0],
          seedBytes[1],
          seedBytes[2],
          seedBytes[3]
        );
      } else if (seedBytes.length === 3) {
        seedValue = OpCodes.Pack32BE(
          seedBytes[0],
          seedBytes[1],
          seedBytes[2],
          0
        );
      } else if (seedBytes.length === 2) {
        seedValue = OpCodes.Pack32BE(
          seedBytes[0],
          seedBytes[1],
          0,
          0
        );
      } else {
        seedValue = OpCodes.Pack32BE(
          seedBytes[0],
          0,
          0,
          0
        );
      }

      // Initialize state according to Bob Jenkins' specification
      this._a = 0xf1ea5eed;
      this._b = seedValue;
      this._c = seedValue;
      this._d = seedValue;

      // Mark as ready before initialization iterations
      this._ready = true;

      // Run 20 iterations to mix the initial state
      for (let i = 0; i < 20; ++i) {
        this._next32();
      }
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 32-bit value using JSF algorithm
     *
     * Algorithm from Bob Jenkins (http://burtleburtle.net/bob/rand/smallprng.html):
     * e = a - ROL(b, 27)
     * a = b ^ ROL(c, 17)
     * b = c + d
     * c = d + e
     * d = e + a
     * return d
     */
    _next32() {
      if (!this._ready) {
        throw new Error('JSF not initialized: set seed first');
      }

      // Step 1: e = a - ROL(b, 27)
      const e = (this._a - OpCodes.RotL32(this._b, 27)) >>> 0;

      // Step 2: a = b ^ ROL(c, 17)
      this._a = (this._b ^ OpCodes.RotL32(this._c, 17)) >>> 0;

      // Step 3: b = c + d
      this._b = (this._c + this._d) >>> 0;

      // Step 4: c = d + e
      this._c = (this._d + e) >>> 0;

      // Step 5: d = e + a
      this._d = (e + this._a) >>> 0;

      return this._d;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('JSF not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 32-bit value
        const value = this._next32();

        // Extract bytes (big-endian order)
        const bytesToExtract = Math.min(bytesRemaining, 4);
        const bytes = OpCodes.Unpack32BE(value);

        for (let i = 0; i < bytesToExtract; ++i) {
          output.push(bytes[i]);
        }

        bytesRemaining -= bytesToExtract;
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For PRNG, Feed can be used to skip outputs
      // Not standard for JSF, but useful for testing
    }

    Result() {
      // Use specified output size or default to 32 bytes
      const size = this._outputSize || 32;

      // Handle skip parameter for test vectors
      if (this._skip && this._skip > 0) {
        // Skip the specified number of 32-bit outputs
        for (let i = 0; i < this._skip; ++i) {
          this._next32();
        }
        this._skip = 0; // Reset skip counter
      }

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

    /**
     * Set skip count (number of outputs to skip before generating result)
     */
    set skip(count) {
      this._skip = count;
    }

    get skip() {
      return this._skip || 0;
    }
  }

  // Register algorithm
  const algorithmInstance = new JSFAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { JSFAlgorithm, JSFInstance };
}));
