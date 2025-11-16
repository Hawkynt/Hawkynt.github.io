/*
 * MWC64X Pseudo-Random Number Generator
 * Invented by David B. Thomas (2011)
 *
 * MWC64X is a GPU-optimized Multiply-With-Carry generator designed for parallel
 * execution in OpenCL/CUDA environments. It combines excellent statistical properties
 * with minimal state (64 bits) and very fast generation (5-6 instructions per output).
 *
 * Period: 2^63 (approximately 9.2 × 10^18)
 * State: 64 bits (two 32-bit words: x and c)
 * Multiplier: A = 4294883355
 * Output: 32-bit unsigned integer (x XOR c)
 *
 * Algorithm:
 *   Given state (x, c):
 *   temp = A * x + c
 *   x' = temp mod 2^32  (lower 32 bits)
 *   c' = floor(temp / 2^32)  (upper 32 bits)
 *   output = x XOR c
 *
 * The multiplier 4294883355 is carefully chosen to give period P = (A*2^32-2)/2 ≈ 2^63.
 *
 * References:
 * - David B. Thomas, "MWC64X - Uniform random number generator for OpenCL"
 *   http://cas.ee.ic.ac.uk/people/dt10/research/rngs-gpu-mwc64x.html
 * - Marsaglia & Zaman (1991), "A new class of random number generators"
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

  class MWC64XAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MWC64X";
      this.description = "MWC64X is a GPU-optimized 64-bit Multiply-With-Carry generator designed for OpenCL/CUDA with period ~2^63. It uses minimal state (64 bits) and very fast operations (5-6 instructions) while passing rigorous statistical tests. Ideal for massively parallel simulations.";
      this.inventor = "David B. Thomas";
      this.year = 2011;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Multiply-With-Carry PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.GB;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 8, 1)]; // 1-8 bytes seed

      // Documentation
      this.documentation = [
        new LinkItem(
          "Official MWC64X Page (David B. Thomas, Imperial College)",
          "http://cas.ee.ic.ac.uk/people/dt10/research/rngs-gpu-mwc64x.html"
        ),
        new LinkItem(
          "Original MWC Paper: Marsaglia & Zaman (1991)",
          "https://projecteuclid.org/journals/annals-of-applied-probability/volume-1/issue-3/A-New-Class-of-Random-Number-Generators/10.1214/aoap/1177005878.full"
        ),
        new LinkItem(
          "OpenCL Implementation Example (GitHub)",
          "https://github.com/profmaad/opencl-option-pricer/blob/master/kernels/mwc64x/"
        ),
        new LinkItem(
          "SYCL-PRNG Library (MWC64X implementation)",
          "https://github.com/Wigner-GPU-Lab/SYCL-PRNG"
        )
      ];

      this.references = [
        new LinkItem(
          "GPU Random Number Generation Review",
          "https://arxiv.org/abs/1204.6193"
        ),
        new LinkItem(
          "Wikipedia: Multiply-with-carry pseudorandom number generator",
          "https://en.wikipedia.org/wiki/Multiply-with-carry_pseudorandom_number_generator"
        )
      ];

      // Test vectors generated from reference implementation
      // Multiplier A = 4294883355
      // Algorithm: state = A * x + c; output = x ^ c
      // State format: 64-bit value where lower 32 bits = x, upper 32 bits = c
      this.tests = [
        {
          text: "Seed 1: First 10 outputs (40 bytes) - x=1, c=0",
          uri: "http://cas.ee.ic.ac.uk/people/dt10/research/rngs-gpu-mwc64x.html",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000000000000"), // x=1, c=0 (little-endian)
          outputSize: 40, // 10 outputs × 4 bytes each
          expected: OpCodes.Hex8ToBytes(
            "01000000" +  // Output 1: 0x00000001 (1)
            "1BB8FEFF" +  // Output 2: 0xFFFEB81B (4294883355)
            "EEA2075C" +  // Output 3: 0x5C07A2EE (1544004334)
            "CBA5B14E" +  // Output 4: 0x4EB1A5CB (1320265163)
            "A56F2152" +  // Output 5: 0x52216FA5 (1377922981)
            "5D2FE55C" +  // Output 6: 0x5CE52F5D (1558523741)
            "CF64D299" +  // Output 7: 0x99D264CF (2580702415)
            "CF405917" +  // Output 8: 0x175940CF (391725263)
            "8EEB1D43" +  // Output 9: 0x431DEB8E (1126034318)
            "29577CED"    // Output 10: 0xED7C5729 (3984348969)
          )
        },
        {
          text: "Seed 123456: First 10 outputs - decimal seed value",
          uri: "http://cas.ee.ic.ac.uk/people/dt10/research/rngs-gpu-mwc64x.html",
          input: null,
          seed: OpCodes.Hex8ToBytes("40E2010000000000"), // x=123456, c=0 (little-endian)
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "40E20100" +  // Output 1: 0x0001E240 (123456)
            "FD3E5196" +  // Output 2: 0x96513EFD (2521906941)
            "4536E3A9" +  // Output 3: 0xA9E33645 (2850240069)
            "81B77780" +  // Output 4: 0x8077B781 (2155329409)
            "05D90D3D" +  // Output 5: 0x3D0DD905 (1024317701)
            "686FC6B7" +  // Output 6: 0xB7C66F68 (3083235176)
            "0E0EBD5F" +  // Output 7: 0x5FBD0E0E (1606225422)
            "07623CCD" +  // Output 8: 0xCD3C6207 (3443286535)
            "8A3874E5" +  // Output 9: 0xE574388A (3849599114)
            "8088B9CE"    // Output 10: 0xCEB98880 (3468265600)
          )
        },
        {
          text: "Seed 0xDEADBEEF: First 10 outputs - hex seed value",
          uri: "http://cas.ee.ic.ac.uk/people/dt10/research/rngs-gpu-mwc64x.html",
          input: null,
          seed: OpCodes.Hex8ToBytes("EFBEADDE00000000"), // x=0xDEADBEEF, c=0 (little-endian)
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "EFBEADDE" +  // Output 1: 0xDEADBEEF (3735928559)
            "824A1C01" +  // Output 2: 0x011C4A82 (18631298)
            "FC445617" +  // Output 3: 0x175644FC (391529724)
            "08BAA593" +  // Output 4: 0x93A5BA08 (2477111816)
            "2E54E3AE" +  // Output 5: 0xAEE3542E (2934133806)
            "FA448724" +  // Output 6: 0x248744FA (612844794)
            "CD006F09" +  // Output 7: 0x096F00CD (158269645)
            "0BE01ACA" +  // Output 8: 0xCA1AE00B (3390758923)
            "EFFEDC7A" +  // Output 9: 0x7ADCFEEF (2061303535)
            "03A5C5EB"    // Output 10: 0xEBC5A503 (3955598595)
          )
        },
        {
          text: "Seed x=1, c=1: First 10 outputs - non-zero carry",
          uri: "http://cas.ee.ic.ac.uk/people/dt10/research/rngs-gpu-mwc64x.html",
          input: null,
          seed: OpCodes.Hex8ToBytes("0100000001000000"), // x=1, c=1 (little-endian)
          outputSize: 40,
          expected: OpCodes.Hex8ToBytes(
            "00000000" +  // Output 1: 0x00000000 (0)
            "1CB8FEFF" +  // Output 2: 0xFFFEB81C (4294883356)
            "CCFA045C" +  // Output 3: 0x5C04FACC (1543830220)
            "1ACFBE32" +  // Output 4: 0x32BECF1A (851365658)
            "4B02F33D" +  // Output 5: 0x3DF3024B (1039336011)
            "BDC64F0E" +  // Output 6: 0x0E4FC6BD (240109245)
            "57D817FF" +  // Output 7: 0xFF17D857 (4279752791)
            "7A3489BA" +  // Output 8: 0xBA89347A (3129554042)
            "FF68477C" +  // Output 9: 0x7C4768FF (2085054719)
            "9903A06A"    // Output 10: 0x6AA00399 (1788871577)
          )
        },
        {
          text: "Seed 999999: First 8 outputs - medium seed value",
          uri: "http://cas.ee.ic.ac.uk/people/dt10/research/rngs-gpu-mwc64x.html",
          input: null,
          seed: OpCodes.Hex8ToBytes("3F420F0000000000"), // x=999999, c=0 (little-endian)
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes(
            "3F420F00" +  // Output 1: 0x000F423F (999999)
            "8E06B474" +  // Output 2: 0x74B4068E (1958176910)
            "B3B8662B" +  // Output 3: 0x2B66B8B3 (728446131)
            "4D8765CD" +  // Output 4: 0xCD65874D (3446736717)
            "94D31ED4" +  // Output 5: 0xD41ED394 (3559141268)
            "DD1D373C" +  // Output 6: 0x3C371DDD (1010310621)
            "B2D2EE21" +  // Output 7: 0x21EED2B2 (569852594)
            "30B81CDB"    // Output 8: 0xDB1CB830 (3675683888)
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
      return new MWC64XInstance(this);
    }
  }

  /**
 * MWC64X cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MWC64XInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // MWC64X state: 64 bits total
      // Lower 32 bits: x (state)
      // Upper 32 bits: c (carry)
      this._x = 0;
      this._c = 0;
      this._ready = false;

      // MWC64X multiplier constant
      this._A = 4294883355;
    }

    /**
     * Set seed value (1-8 bytes)
     * Bytes 0-3: x (state) - little-endian 32-bit
     * Bytes 4-7: c (carry) - little-endian 32-bit (optional, defaults to 0)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Initialize x from first 1-4 bytes (little-endian)
      if (seedBytes.length >= 4) {
        this._x = OpCodes.Pack32LE(
          seedBytes[0],
          seedBytes[1],
          seedBytes[2],
          seedBytes[3]
        );
      } else {
        // For seeds < 4 bytes, pack what we have (pad with zeros)
        const bytes = [0, 0, 0, 0];
        for (let i = 0; i < Math.min(seedBytes.length, 4); ++i) {
          bytes[i] = seedBytes[i];
        }
        this._x = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      }

      // Initialize c from bytes 4-7 (little-endian), default to 0
      if (seedBytes.length >= 8) {
        this._c = OpCodes.Pack32LE(
          seedBytes[4],
          seedBytes[5],
          seedBytes[6],
          seedBytes[7]
        );
      } else if (seedBytes.length >= 5) {
        // For partial carry bytes, pack what we have
        const bytes = [0, 0, 0, 0];
        for (let i = 4; i < seedBytes.length; ++i) {
          bytes[i - 4] = seedBytes[i];
        }
        this._c = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      } else {
        this._c = 0;
      }

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Generate next 32-bit value using MWC64X algorithm
     *
     * Algorithm:
     *   output = x XOR c
     *   temp = A * x + c
     *   x = temp mod 2^32
     *   c = floor(temp / 2^32)
     *
     * We use BigInt for 64-bit arithmetic to avoid precision loss.
     *
     * NOTE: The bit operations (^, &, >>, >>>) here are fundamental MWC64X primitives.
     * These cannot use OpCodes as they operate on BigInt (64-bit) and require native
     * JavaScript operators for correct semantics. OpCodes does not provide 64-bit
     * arithmetic functions, and these operations are essential to the algorithm's
     * mathematical correctness.
     */
    _next32() {
      if (!this._ready) {
        throw new Error('MWC64X not initialized: set seed first');
      }

      // Calculate output BEFORE updating state (x XOR c)
      // XOR is the core mixing function of MWC64X, must use native operator
      const output = (this._x ^ this._c) >>> 0;

      // Perform 64-bit multiply-with-carry: temp = A * x + c
      // BigInt required for exact 64-bit arithmetic (no OpCodes equivalent)
      const temp = BigInt(this._A) * BigInt(this._x) + BigInt(this._c);

      // Split result: lower 32 bits = new x, upper 32 bits = new c
      // BigInt bit operations required (& and >> on 64-bit values)
      this._x = Number(temp & 0xFFFFFFFFn);
      this._c = Number(temp >> 32n);

      return output;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('MWC64X not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let bytesRemaining = length;

      while (bytesRemaining > 0) {
        // Generate next 32-bit value
        const value = this._next32();

        // Extract bytes (little-endian order)
        const bytesToExtract = Math.min(bytesRemaining, 4);
        const bytes = OpCodes.Unpack32LE(value);

        for (let i = 0; i < bytesToExtract; ++i) {
          output.push(bytes[i]);
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
  const algorithmInstance = new MWC64XAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { MWC64XAlgorithm, MWC64XInstance };
}));
