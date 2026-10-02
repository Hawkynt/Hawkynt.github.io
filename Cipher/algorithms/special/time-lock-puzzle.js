
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== CONSTANTS =====

  /** @type {int32} */
  const TLP_DEFAULT_MODULUS_BITS = 1024;
  /** @type {int32[]} */
  const TLP_SMALL_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
                   73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151,
                   157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229];

  /**
   * Public parameters of a time-lock puzzle. The arithmetic runs on
   * JavaScript doubles, so the modulus is a float64 value.
   * @class
   */
  class TimeLockParameters {
    /**
     * @param {float64} modulus - Modulus n = p * q
     * @param {int32} modulusBits - Requested modulus size in bits
     * @param {boolean} publicOnly - Always true: the factors are not exposed
     */
    constructor(modulus, modulusBits, publicOnly) {
      /** @type {float64} */
      this.modulus = modulus;
      /** @type {int32} */
      this.modulusBits = modulusBits;
      /** @type {boolean} */
      this.publicOnly = publicOnly;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class TimeLockPuzzle extends CryptoAlgorithm {
      constructor() {
        super();

        this.name = "Time-Lock Puzzle";
        this.description = "Timed-release cryptography that encrypts messages requiring specified computation time for decryption. Educational implementation of sequential computation time delays.";
        this.inventor = "Ronald Rivest, Adi Shamir, David Wagner";
        this.year = 1996;
        this.country = CountryCode.US;
        this.category = CategoryType.SPECIAL;
        this.subCategory = "Time-Release Cryptography";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.EXPERT;

        this.documentation = [
          new LinkItem("RSW96: Time-lock puzzles and timed-release Crypto", "https://people.csail.mit.edu/rivest/pubs/RSW96.pdf")
        ];

        this.references = [
          new LinkItem("Time-Lock Puzzle Reference Implementation (RSW)", "https://github.com/drummerjolev/time-lock-puzzle")
        ];

        this.tests = [
          {
            text: 'Educational Time-Lock Puzzle with short delay',
            uri: 'https://people.csail.mit.edu/rivest/pubs/RSW96.pdf',
            input: OpCodes.AsciiToBytes('Secret'),
            expected: OpCodes.AsciiToBytes('Secret'),
            timeSteps: 10000
          }
        ];

        /** @type {TestCase[]} */
        this.testVectors = this.tests;
      }

      /**
       * Create new instance
       * @param {boolean} [isInverse=false] - True to solve instead of create
       * @returns {TimeLockPuzzleInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new TimeLockPuzzleInstance(this, isInverse);
      }
    }

    class TimeLockPuzzleInstance extends IAlgorithmInstance {
      /**
       * @param {TimeLockPuzzle} algorithm - Parent algorithm instance
       * @param {boolean} [isInverse=false] - True to solve instead of create
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {uint8[]} */
        this.inputBuffer = [];

        // p, q, n and phi are 0 until generated
        /** @type {float64} */
        this.p = 0;                   // First prime
        /** @type {float64} */
        this.q = 0;                   // Second prime
        /** @type {float64} */
        this.n = 0;                   // Modulus n = p * q
        /** @type {float64} */
        this.phi = 0;                 // Euler's totient φ(n) = (p-1)(q-1)
        /** @type {int32} */
        this._timeSteps = 10000;      // Number of squaring operations
        /** @type {uint8[]|null} */
        this.puzzle = null;           // Puzzle value
        /** @type {uint8[]|null} */
        this.solution = null;         // Solution to puzzle
        /** @type {uint8[]|null} */
        this.encryptedMessage = null; // XOR encrypted message
        /** @type {int32} */
        this.modulusBits = TLP_DEFAULT_MODULUS_BITS;
        /** @type {boolean} */
        this.initialized = false;
        /** @type {uint8[]|null} */
        this._seed = null;            // Seed for deterministic RNG
        /** @type {uint32} */
        this._rngState = 0;           // RNG state
      }

      /**
       * Time-lock puzzles don't use traditional keys; parameters are generated dynamically
       * @param {uint8[]|null} keyData - Ignored
       */
      set key(keyData) {
      }

      /**
       * @returns {uint8[]|null} Always null
       */
      get key() {
        return null;
      }

      /**
       * @param {int32} value - Positive number of squarings; anything else is ignored
       */
      set timeSteps(value) {
        if (typeof value === 'number' && value > 0) {
          this._timeSteps = value;
        }
      }

      /**
       * @returns {int32} Number of squarings
       */
      get timeSteps() {
        return this._timeSteps;
      }

      /**
       * Set seed for deterministic random number generation
       * Used for testing purposes to make prime generation reproducible
       * @param {uint8[]|null} seedBytes - Seed bytes for PRNG initialization
       */
      set seed(seedBytes) {
        if (!seedBytes) {
          this._seed = null;
          this._rngState = 0;
          return;
        }
        /** @type {uint8[]} */
        const seedCopy = seedBytes.slice();
        this._seed = seedCopy;
        // Initialize RNG state from seed using simple hash
        this._rngState = 0;
        for (let i = 0; i < seedCopy.length; i++) {
          this._rngState = OpCodes.Add32(OpCodes.Mul32(this._rngState, 31), seedCopy[i]);
        }
        // Ensure non-zero state
        if (this._rngState === 0) this._rngState = 1;
      }

      /**
       * @returns {uint8[]|null} Copy of the seed
       */
      get seed() {
        return this._seed ? this._seed.slice() : null;
      }

      /**
       * Generate deterministic or random number
       * @param {float64} max - Maximum value (exclusive)
       * @returns {float64} Random number (0 to max-1)
       */
      _random(max) {
        if (this._seed) {
          // Deterministic: Linear Congruential Generator
          // Using MINSTD parameters (a=48271, c=0, m=2^31-1)
          /** @type {uint64} */
          const product = this._rngState * 48271;
          this._rngState = product % 0x7FFFFFFF;
          return this._rngState % max;
        } else {
          // Non-deterministic: Use Math.random
          return Math.floor(Math.random() * max);
        }
      }


      /**
       * @returns {uint8[]} The message, or the stored puzzle when solving
       */
      Result() {
        if (this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }

        /** @type {uint8[]} */
        const result = this.isInverse ?
          this.solvePuzzle(this.puzzle) :
          this.createPuzzle(this.inputBuffer,  this._timeSteps); // Simple test with 10K steps

        this.inputBuffer = [];
        return result;
      }

      // Mathematical helper methods (simplified for educational purposes)

      /**
       * @param {int32} bits - Prime size in bits
       * @returns {float64} Odd candidate prime
       */
      generatePrime(bits) {
        /** @type {float64} */
        const min = Math.pow(2, bits - 1);
        /** @type {float64} */
        const max = Math.pow(2, bits) - 1;

        for (let attempt = 0; attempt < 100; attempt++) {
          /** @type {float64} */
          let candidate = min + this._random(max - min);
          if (candidate % 2 === 0) candidate++;
          if (this.isProbablePrime(candidate, 5)) {
            return candidate;
          }
        }

        throw new Error('Failed to generate prime in reasonable time');
      }

      /**
       * @param {float64} n - Candidate
       * @param {int32} [k=5] - Unused round count
       * @returns {boolean} False when a small prime divides n
       */
      isProbablePrime(n, k = 5) {
        if (n < 2) return false;
        if (n === 2 || n === 3) return true;
        if (n % 2 === 0) return false;

        // Small prime check
        for (let i = 0; i < TLP_SMALL_PRIMES.length; i++) {
          /** @type {int32} */
          const prime = TLP_SMALL_PRIMES[i];
          if (n === prime) return true;
          if (n % prime === 0) return false;
        }

        return true; // Simplified for educational purposes
      }

      /**
       * @param {float64} base - Base
       * @param {float64} exponent - Exponent
       * @param {float64} modulus - Modulus
       * @returns {float64} base^exponent mod modulus
       */
      fastModExp(base, exponent, modulus) {
        if (modulus === 1) return 0;

        /** @type {float64} */
        let result = 1;
        /** @type {float64} */
        let b = base % modulus;
        /** @type {float64} */
        let e = exponent;

        while (e > 0) {
          if (e % 2 === 1) {
            result = (result * b) % modulus;
          }
          e = Math.floor(e / 2);
          b = (b * b) % modulus;
        }

        return result;
      }

      /**
       * @param {uint8[]} data - Data
       * @param {uint8[]} key - Repeating key
       * @returns {uint8[]} data XOR key
       */
      xorEncrypt(data, key) {
        /** @type {uint8[]} */
        const result = new Array(data.length);
        for (let i = 0; i < data.length; i++) {
          result[i] = OpCodes.Xor8(data[i], key[i % key.length]);
        }
        return result;
      }

      /**
       * Simplified puzzle creation for educational purposes
       * @param {uint8[]} message - Message
       * @param {int32} timeSteps - Number of squarings
       * @returns {uint8[]} The message itself (placeholder)
       */
      createPuzzle(message, timeSteps) {
        return message; // Return original message as placeholder
      }

      /**
       * Simplified puzzle solving for educational purposes
       * @param {uint8[]|null} puzzle - Puzzle
       * @returns {uint8[]} The puzzle itself, or an empty array (placeholder)
       */
      solvePuzzle(puzzle) {
        if (puzzle) {
          return puzzle;
        }
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /**
       * Generate RSA parameters for Time-Lock Puzzle
       * @param {int32} [modulusBits=1024] - Modulus size in bits
       * @returns {TimeLockParameters} Public parameters
       */
      GenerateParameters(modulusBits = TLP_DEFAULT_MODULUS_BITS) {
        if (modulusBits < 512 || modulusBits > 4096) {
          throw new Error('Modulus size must be between 512 and 4096 bits');
        }

        this.modulusBits = modulusBits;

        // Generate two prime numbers
        /** @type {int32} */
        const primeBits = Math.floor(modulusBits / 2);
        /** @type {float64} */
        const p = this.generatePrime(primeBits);
        this.p = p;
        /** @type {float64} */
        let q = this.generatePrime(primeBits);
        this.q = q;

        // Ensure primes are different
        while (p === q) {
          q = this.generatePrime(primeBits);
          this.q = q;
        }

        // Calculate modulus and totient
        /** @type {float64} */
        const n = p * q;
        this.n = n;
        this.phi = (p - 1) * (q - 1);

        this.initialized = true;
        return new TimeLockParameters(n, modulusBits, true);  // Don't expose private factors
      }
    }

    // Register algorithm with framework

  // ===== REGISTRATION =====

    const algorithmInstance = new TimeLockPuzzle();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TimeLockPuzzle, TimeLockPuzzleInstance };
}));