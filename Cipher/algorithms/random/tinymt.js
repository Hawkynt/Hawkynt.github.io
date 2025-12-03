/*
 * TinyMT (Tiny Mersenne Twister) Pseudo-Random Number Generator
 * Based on reference implementation by Mutsuo Saito and Makoto Matsumoto
 * RFC 8682: TinyMT32 Pseudorandom Number Generator (PRNG)
 *
 * TinyMT32 generates high-quality pseudo-random numbers with a period of 2^127-1
 * Uses a compact state of only 127 bits (4 x 32-bit words) - much smaller than MT19937
 * Designed for embedded systems and applications where memory is constrained
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

  // TinyMT32 algorithm constants from RFC 8682
  const TINYMT32_MEXP = 127;           // Mersenne exponent
  const TINYMT32_SH0 = 1;              // Shift parameter 0
  const TINYMT32_SH1 = 10;             // Shift parameter 1
  const TINYMT32_SH8 = 8;              // Shift parameter 8
  const TINYMT32_MASK = 0x7FFFFFFF;    // Mask (lower 31 bits)

  // Default parameters from RFC 8682 (first entry of precalculated parameter sets)
  const DEFAULT_MAT1 = 0x8F7011EE;     // Parameter mat1
  const DEFAULT_MAT2 = 0xFC78FF1F;     // Parameter mat2
  const DEFAULT_TMAT = 0x3793FDFF;     // Parameter tmat (tempering matrix)

  // Initialization constants
  const INIT_MULTIPLIER = 1812433253;  // Initialization multiplier (same as MT19937)
  const MIN_LOOP = 8;                  // Minimum initialization loops
  const PRE_LOOP = 8;                  // Pre-loop iterations

  class TinyMTAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "TinyMT (Tiny Mersenne Twister)";
      this.description = "TinyMT32 is a compact variant of Mersenne Twister with 127-bit state and period of 2^127-1. Designed for embedded systems where MT19937's large state is impractical, it passes rigorous statistical tests while using minimal memory.";
      this.inventor = "Mutsuo Saito and Makoto Matsumoto";
      this.year = 2011;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Pseudo-Random Number Generator";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.JP;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(4, 4, 1)]; // 32-bit seed

      // Documentation
      this.documentation = [
        new LinkItem(
          "RFC 8682: TinyMT32 PRNG Specification",
          "https://datatracker.ietf.org/doc/rfc8682/"
        ),
        new LinkItem(
          "Official GitHub Repository",
          "https://github.com/MersenneTwister-Lab/TinyMT"
        ),
        new LinkItem(
          "TinyMT Homepage (Hiroshima University)",
          "http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/TINYMT/index.html"
        ),
        new LinkItem(
          "Original Paper: A fast jump ahead algorithm for linear recurrences",
          "https://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/ARTICLES/tinymt.pdf"
        )
      ];

      this.references = [
        new LinkItem(
          "Reference Implementation (C code)",
          "https://github.com/MersenneTwister-Lab/TinyMT/blob/master/tinymt/tinymt32.c"
        ),
        new LinkItem(
          "Precalculated Parameter Sets",
          "https://github.com/jj1bdx/tinymtdc-longbatch"
        )
      ];

      // Test vectors from RFC 8682 Section 3.1
      // These are the first 10 outputs with seed = 1 using default parameters
      this.tests = [
        {
          text: "TinyMT32 with seed 1 (RFC 8682 test vector, first 10 outputs)",
          uri: "https://datatracker.ietf.org/doc/rfc8682/",
          input: null,
          seed: OpCodes.Unpack32LE(1), // Seed 1 as little-endian byte array
          outputSize: 40, // 10 uint32 values = 40 bytes
          expected: OpCodes.ConcatArrays([
            OpCodes.Unpack32LE(2545341989),  // Verified from RFC 8682
            OpCodes.Unpack32LE(981918433),
            OpCodes.Unpack32LE(3715302833),
            OpCodes.Unpack32LE(2387538352),
            OpCodes.Unpack32LE(3591001365),
            OpCodes.Unpack32LE(3820442102),
            OpCodes.Unpack32LE(2114400566),
            OpCodes.Unpack32LE(2196103051),
            OpCodes.Unpack32LE(2783359912),
            OpCodes.Unpack32LE(764534509)
          ])
        },
        {
          text: "TinyMT32 with seed 1 (RFC 8682 extended test, outputs 11-20)",
          uri: "https://datatracker.ietf.org/doc/rfc8682/",
          input: null,
          seed: OpCodes.Unpack32LE(1), // Seed 1 as little-endian byte array
          skipBytes: 40, // Skip first 10 outputs
          outputSize: 40, // Next 10 uint32 values
          expected: OpCodes.ConcatArrays([
            OpCodes.Unpack32LE(643179475),   // Outputs 11-20 from RFC 8682
            OpCodes.Unpack32LE(1822416315),
            OpCodes.Unpack32LE(881558334),
            OpCodes.Unpack32LE(4207026366),
            OpCodes.Unpack32LE(3690273640),
            OpCodes.Unpack32LE(3240535687),
            OpCodes.Unpack32LE(2921447122),
            OpCodes.Unpack32LE(3984931427),
            OpCodes.Unpack32LE(4092394160),
            OpCodes.Unpack32LE(44209675)
          ])
        },
        {
          text: "TinyMT32 with seed 1 (RFC 8682 extended test, outputs 21-30)",
          uri: "https://datatracker.ietf.org/doc/rfc8682/",
          input: null,
          seed: OpCodes.Unpack32LE(1), // Seed 1 as little-endian byte array
          skipBytes: 80, // Skip first 20 outputs
          outputSize: 40, // Next 10 uint32 values
          expected: OpCodes.ConcatArrays([
            OpCodes.Unpack32LE(2188315343),  // Outputs 21-30 from RFC 8682
            OpCodes.Unpack32LE(2908663843),
            OpCodes.Unpack32LE(1834519336),
            OpCodes.Unpack32LE(3774670961),
            OpCodes.Unpack32LE(3019990707),
            OpCodes.Unpack32LE(4065554902),
            OpCodes.Unpack32LE(1239765502),
            OpCodes.Unpack32LE(4035716197),
            OpCodes.Unpack32LE(3412127188),
            OpCodes.Unpack32LE(552822483)
          ])
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
      return new TinyMTInstance(this);
    }
  }

  /**
 * TinyMT cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class TinyMTInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // TinyMT32 state (127 bits = 4 x 32-bit words)
      this._status = new Array(4);  // Internal state vector
      this._mat1 = DEFAULT_MAT1;    // Parameter mat1
      this._mat2 = DEFAULT_MAT2;    // Parameter mat2
      this._tmat = DEFAULT_TMAT;    // Tempering matrix parameter
      this._initialized = false;    // Initialization flag
      this._outputSize = 32;        // Default output size in bytes
      this._skipBytes = 0;          // Number of bytes to skip before output
    }

    /**
     * Initialize the generator with a 32-bit seed
     * Based on RFC 8682 tinymt32_init() function
     *
     * @param {Array} seedBytes - 4-byte array containing 32-bit seed (little-endian)
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._initialized = false;
        return;
      }

      // Convert seed bytes to 32-bit unsigned integer (little-endian)
      let seedValue = 0;
      for (let i = 0; i < Math.min(seedBytes.length, 4); ++i) {
        seedValue = OpCodes.OrN(seedValue, OpCodes.Shl32(seedBytes[i], i * 8));
      }
      seedValue = OpCodes.ToUint32(seedValue);

      // Initialize state array (from RFC 8682 tinymt32_init)
      this._status[0] = seedValue;
      this._status[1] = this._mat1;
      this._status[2] = this._mat2;
      this._status[3] = this._tmat;

      // Initialization loop (MIN_LOOP = 8 iterations)
      for (let i = 1; i < MIN_LOOP; ++i) {
        // status[i AND 3] XOR= i + MULT * (status[(i-1) AND 3] XOR (status[(i-1) AND 3] shr 30))
        const prev = this._status[OpCodes.AndN(i - 1, 3)];
        const xored = OpCodes.ToUint32(OpCodes.XorN(prev, OpCodes.Shr32(prev, 30)));
        // CRITICAL: Use Math.imul for correct 32-bit integer multiplication
        // Regular JavaScript multiplication loses precision with large numbers
        const mult = OpCodes.ToUint32(Math.imul(INIT_MULTIPLIER, xored));
        this._status[OpCodes.AndN(i, 3)] = OpCodes.XorN(this._status[OpCodes.AndN(i, 3)], OpCodes.ToUint32(i + mult));
      }

      // Period certification
      this._periodCertification();

      // Pre-loop iterations (call next_state PRE_LOOP = 8 times)
      for (let i = 0; i < PRE_LOOP; ++i) {
        this._nextState();
      }

      this._initialized = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Period certification to ensure period of 2^127-1
     * From RFC 8682 - checks if state is all zeros and fixes it
     */
    _periodCertification() {
      // Check if all status words are zero (after masking)
      if (OpCodes.AndN(this._status[0], TINYMT32_MASK) === 0 &&
          this._status[1] === 0 &&
          this._status[2] === 0 &&
          this._status[3] === 0) {
        // Set to non-zero state to guarantee period
        this._status[0] = 'T'.charCodeAt(0); // ASCII 'T' = 84
        this._status[1] = 'I'.charCodeAt(0); // ASCII 'I' = 73
        this._status[2] = 'N'.charCodeAt(0); // ASCII 'N' = 78
        this._status[3] = 'Y'.charCodeAt(0); // ASCII 'Y' = 89
      }
    }

    /**
     * Update internal state (state transition function)
     * Based on RFC 8682 tinymt32_next_state() function
     */
    _nextState() {
      let x, y;

      // Extract and combine state elements
      y = this._status[3];
      x = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(this._status[0], TINYMT32_MASK),
           this._status[1]),
           this._status[2]));

      // Apply shifts and XOR
      x = OpCodes.XorN(x, OpCodes.ToUint32(OpCodes.Shl32(x, TINYMT32_SH0)));
      y = OpCodes.ToUint32(OpCodes.XorN(y, OpCodes.XorN(OpCodes.Shr32(y, TINYMT32_SH0), x)));

      // Rotate state array
      this._status[0] = this._status[1];
      this._status[1] = this._status[2];
      this._status[2] = OpCodes.ToUint32(OpCodes.XorN(x, OpCodes.Shl32(y, TINYMT32_SH1)));
      this._status[3] = y;

      // Conditional matrix operations based on LSB of y
      // CRITICAL: Use signed arithmetic for proper masking behavior
      const lsb = OpCodes.AndN(y, 1);
      if (lsb !== 0) {
        this._status[1] = OpCodes.XorN(this._status[1], this._mat1);
        this._status[2] = OpCodes.XorN(this._status[2], this._mat2);
      }
    }

    /**
     * Apply tempering transformation to generate output
     * Based on RFC 8682 tinymt32_temper() function
     *
     * @returns {number} 32-bit unsigned random value
     */
    _temper() {
      let t0, t1;

      t0 = this._status[3];
      t1 = OpCodes.ToUint32(this._status[0] + OpCodes.Shr32(this._status[2], TINYMT32_SH8));

      t0 = OpCodes.XorN(t0, t1);

      // Conditional XOR with tmat based on LSB of t1
      if (OpCodes.AndN(t1, 1) !== 0) {
        t0 = OpCodes.XorN(t0, this._tmat);
      }

      return OpCodes.ToUint32(t0);
    }

    /**
     * Generate the next 32-bit random value
     * Based on RFC 8682 tinymt32_generate_uint32() function
     *
     * @returns {number} 32-bit unsigned random value
     */
    _next32() {
      if (!this._initialized) {
        throw new Error('TinyMT32 not initialized: set seed first');
      }

      this._nextState();
      return this._temper();
    }

    /**
     * Generate random bytes
     * Outputs bytes in little-endian order (LSB first)
     *
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._initialized) {
        throw new Error('TinyMT32 not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      // Generate complete 32-bit words
      const fullWords = Math.floor(length / 4);
      for (let i = 0; i < fullWords; ++i) {
        const value = this._next32();
        // Output in little-endian format
        output.push(OpCodes.AndN(value, 0xFF));
        output.push(OpCodes.AndN(OpCodes.Shr32(value, 8), 0xFF));
        output.push(OpCodes.AndN(OpCodes.Shr32(value, 16), 0xFF));
        output.push(OpCodes.AndN(OpCodes.Shr32(value, 24), 0xFF));
      }

      // Handle remaining bytes (if length not multiple of 4)
      const remainingBytes = length % 4;
      if (remainingBytes > 0) {
        const value = this._next32();
        for (let i = 0; i < remainingBytes; ++i) {
          output.push(OpCodes.AndN(OpCodes.Shr32(value, i * 8), 0xFF));
        }
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
      // For PRNG, Feed is not used in standard TinyMT32
      // The algorithm is deterministic based on initial seed only
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Handle skipBytes parameter for test vectors
      if (this._skipBytes > 0) {
        this.NextBytes(this._skipBytes);
        this._skipBytes = 0;
      }

      // Generate output of specified size
      return this.NextBytes(this._outputSize);
    }

    /**
     * Set output size for Result() method
     */
    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
    }

    /**
     * Set number of bytes to skip before generating output
     * Used for testing specific positions in the output stream
     */
    set skipBytes(count) {
      this._skipBytes = count;
    }

    get skipBytes() {
      return this._skipBytes;
    }
  }

  // Register algorithm
  const algorithmInstance = new TinyMTAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { TinyMTAlgorithm, TinyMTInstance };
}));
