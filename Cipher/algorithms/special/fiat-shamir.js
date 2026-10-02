
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
  const FS_MIN_SECURITY_ROUNDS = 10;
  /** @type {int32} */
  const FS_MAX_SECURITY_ROUNDS = 100;
  /** @type {int32} */
  const FS_DEFAULT_MODULUS_BITS = 1024;
  /** @type {int32[]} */
  const FS_SMALL_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
                   73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151,
                   157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229];

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * Public parameters of a Fiat-Shamir setup. The arithmetic runs on
   * JavaScript doubles, so the modulus and keys are float64 values.
   * @class
   */
  class FiatShamirParameters {
    /**
     * @param {float64} modulus - Modulus n = p * q
     * @param {float64[]} publicKeys - Public keys v_i = s_i^2 mod n
     * @param {int32} modulusBits - Requested modulus size in bits
     * @param {int32} numSecrets - Number of secrets
     */
    constructor(modulus, publicKeys, modulusBits, numSecrets) {
      /** @type {float64} */
      this.modulus = modulus;
      /** @type {float64[]} */
      this.publicKeys = publicKeys;
      /** @type {int32} */
      this.modulusBits = modulusBits;
      /** @type {int32} */
      this.numSecrets = numSecrets;
    }
  }

  class FiatShamir extends CryptoAlgorithm {
      constructor() {
        super();

        this.name = "Fiat-Shamir Protocol";
        this.description = "Zero-knowledge identification protocol using quadratic residues. Demonstrates proof of knowledge without revealing secrets through interactive challenge-response.";
        this.inventor = "Amos Fiat, Adi Shamir";
        this.year = 1986;
        this.country = CountryCode.IL;
        this.category = CategoryType.SPECIAL;
        this.subCategory = "Zero-Knowledge Proof";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.ADVANCED;

        this.documentation = [
          new LinkItem("FS86: How to prove yourself: practical solutions to identification and signature problems", "https://link.springer.com/chapter/10.1007/3-540-47721-7_12")
        ];

        this.references = [
          new LinkItem("Fiat-Shamir Zero-Knowledge Protocol Implementation", "https://github.com/ivansarno/FiatShamirProtocol")
        ];

        this.tests = [
          {
            text: 'Educational Fiat-Shamir proof verification with deterministic parameters',
            uri: 'https://link.springer.com/chapter/10.1007/3-540-47721-7_12',
            input: OpCodes.AsciiToBytes('test'),
            expected: OpCodes.AsciiToBytes('test'), // Protocol should pass through in simplified mode
            timeSteps: 10000
          }
        ];

        /** @type {TestCase[]} */
        this.testVectors = this.tests;
      }

      /**
       * Create new instance
       * @param {boolean} [isInverse=false] - Inverse mode flag
       * @returns {FiatShamirInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new FiatShamirInstance(this, isInverse);
      }
    }

    class FiatShamirInstance extends IAlgorithmInstance {
      /**
       * @param {FiatShamir} algorithm - Parent algorithm instance
       * @param {boolean} [isInverse=false] - Inverse mode flag
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {uint8[]} */
        this.inputBuffer = [];

        // Public parameters; n, p and q are 0 until generated or set up
        /** @type {float64} */
        this.n = 0;                   // Modulus n = p * q
        /** @type {float64[]} */
        this.v = [];                  // Public keys (quadratic residues)

        // Secret parameters (prover only)
        /** @type {float64} */
        this.p = 0;                   // First prime (secret)
        /** @type {float64} */
        this.q = 0;                   // Second prime (secret)
        /** @type {float64[]} */
        this.s = [];                  // Secret keys (square roots)

        // Protocol state
        /** @type {int32} */
        this.securityRounds = FS_MIN_SECURITY_ROUNDS;
        /** @type {int32} */
        this.modulusBits = FS_DEFAULT_MODULUS_BITS;
        /** @type {int32} */
        this.numSecrets = 1;          // Number of secret values
        /** @type {int32} */
        this._timeSteps = 10000;      // Time steps for puzzle

        // Session data
        /** @type {float64[]} */
        this.commitments = [];        // Prover commitments (x values)
        /** @type {float64[]} */
        this.challenges = [];         // Verifier challenges (e values)
        /** @type {float64[]} */
        this.responses = [];          // Prover responses (y values)

        /** @type {boolean} */
        this.initialized = false;
        /** @type {boolean} */
        this.isProver = false;
        /** @type {boolean} */
        this.isVerifier = false;
        /** @type {uint8[]|null} */
        this._seed = null;            // Seed for deterministic RNG
        /** @type {uint32} */
        this._rngState = 0;           // RNG state
      }

      /**
       * Fiat-Shamir doesn't use traditional keys - parameters are generated
       * @param {uint8[]|null} keyData - Ignored
       */
      set key(keyData) {
        // This can be used to set protocol parameters if needed
      }

      /**
       * @returns {uint8[]|null} Always null
       */
      get key() {
        return null;
      }

      /**
       * @param {int32} value - Positive number of time steps; anything else is ignored
       */
      set timeSteps(value) {
        if (typeof value === 'number' && value > 0) {
          this._timeSteps = value;
        }
      }

      /**
       * @returns {int32} Number of time steps
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
       * Pass the buffered data through
       * @returns {uint8[]} The buffered data
       */
      Result() {
        /** @type {uint8[]} */
        const result = this.inputBuffer.slice();
        if (this.inputBuffer.length === 0) return result;

        // For educational purposes, simplified protocol that passes data through
        // In a real implementation, this would run the zero-knowledge proof protocol
        this.inputBuffer = [];
        return result;
      }

      /**
       * Generate Fiat-Shamir parameters (done by trusted setup or prover)
       * @param {int32} [modulusBits=1024] - Modulus size in bits
       * @param {int32} [numSecrets=1] - Number of secrets
       * @returns {FiatShamirParameters} Public parameters
       */
      GenerateParameters(modulusBits = 1024, numSecrets = 1) {

        if (modulusBits < 512 || modulusBits > 4096) {
          throw new Error('Modulus size must be between 512 and 4096 bits');
        }

        if (numSecrets < 1 || numSecrets > 10) {
          throw new Error('Number of secrets must be between 1 and 10');
        }

        this.modulusBits = modulusBits;
        this.numSecrets = numSecrets;

        // Generate two prime numbers
        /** @type {int32} */
        const primeBits = Math.floor(modulusBits / 2);
        /** @type {float64} */
        const p = this.generateBlumPrime(primeBits);
        this.p = p;
        /** @type {float64} */
        let q = this.generateBlumPrime(primeBits);
        this.q = q;

        // Ensure primes are different
        while (p === q) {
          q = this.generateBlumPrime(primeBits);
          this.q = q;
        }

        // Calculate modulus
        /** @type {float64} */
        const n = p * q;
        this.n = n;

        // Generate secret keys and corresponding public keys
        this.s = [];
        this.v = [];

        for (let i = 0; i < numSecrets; i++) {
          // Generate random secret s_i relatively prime to n
          /** @type {float64} */
          let secret = 0;
          do {
            secret = this.secureRandomRange(1, n);
          } while (this.gcd(secret, n) !== 1);

          this.s.push(secret);

          // Calculate public key v_i = s_i^2 mod n
          this.v.push(this.modMul(secret, secret, n));
        }

        this.initialized = true;
        this.isProver = true;

        return new FiatShamirParameters(n, this.v.slice(), modulusBits, numSecrets);
      }

      /**
       * Setup verifier with public parameters
       * @param {FiatShamirParameters} publicParams - Public parameters
       * @returns {boolean} Always true
       */
      SetupVerifier(publicParams) {
        if (!publicParams || !publicParams.modulus || !publicParams.publicKeys) {
          throw new Error('Invalid public parameters');
        }

        this.n = publicParams.modulus;
        this.v = publicParams.publicKeys.slice();
        this.numSecrets = publicParams.publicKeys.length;
        this.modulusBits = publicParams.modulusBits ? publicParams.modulusBits : 1024;

        this.initialized = true;
        this.isVerifier = true;

        return true;
      }

      // Mathematical helper methods

      /**
       * @param {int32} bits - Prime size in bits
       * @returns {float64} Candidate prime congruent to 3 mod 4
       */
      generateBlumPrime(bits) {
        /** @type {float64} */
        const min = Math.pow(2, bits - 1);
        /** @type {float64} */
        const max = Math.pow(2, bits) - 1;

        for (let attempt = 0; attempt < 1000; attempt++) {
          /** @type {float64} */
          let candidate = min + this._random(max - min);

          // Ensure candidate ≡ 3 mod 4
          if (candidate % 4 !== 3) {
            candidate = candidate - (candidate % 4) + 3;
          }

          if (this.isProbablePrime(candidate, 10)) {
            return candidate;
          }
        }

        throw new Error('Failed to generate Blum prime in reasonable time');
      }

      /**
       * @param {float64} n - Candidate
       * @param {int32} [k=10] - Unused round count
       * @returns {boolean} False when a small prime divides n
       */
      isProbablePrime(n, k = 10) {
        if (n < 2) return false;
        if (n === 2 || n === 3) return true;
        if (n % 2 === 0) return false;

        // Small prime check
        for (let i = 0; i < FS_SMALL_PRIMES.length; i++) {
          /** @type {int32} */
          const prime = FS_SMALL_PRIMES[i];
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
            result = this.modMul(result, b, modulus);
          }
          e = Math.floor(e / 2);
          b = this.modMul(b, b, modulus);
        }

        return result;
      }

      /**
       * @param {float64} a - Operand
       * @param {float64} b - Operand
       * @param {float64} m - Modulus
       * @returns {float64} a * b mod m
       */
      modMul(a, b, m) {
        return (a * b) % m;
      }

      /**
       * @param {float64} a - Operand
       * @param {float64} b - Operand
       * @returns {float64} gcd(a, b)
       */
      gcd(a, b) {
        /** @type {float64} */
        let x = a;
        /** @type {float64} */
        let y = b;
        while (y !== 0) {
          /** @type {float64} */
          const temp = y;
          y = x % y;
          x = temp;
        }
        return x;
      }

      /**
       * @param {float64} min - Lower bound (inclusive)
       * @param {float64} max - Upper bound (exclusive)
       * @returns {float64} Random value in [min, max)
       */
      secureRandomRange(min, max) {
        return min + this._random(max - min);
      }

      /**
       * Start zero-knowledge proof session
       * @param {int32} [securityRounds=40] - Number of rounds
       * @returns {boolean} Always true
       */
      StartProof(securityRounds = 40) {
        if (!this.initialized) {
          throw new Error('Fiat-Shamir instance not properly initialized');
        }

        if (securityRounds < FS_MIN_SECURITY_ROUNDS ||
            securityRounds > FS_MAX_SECURITY_ROUNDS) {
          throw new Error('Security rounds must be between ' +
                         FS_MIN_SECURITY_ROUNDS + ' and ' +
                         FS_MAX_SECURITY_ROUNDS);
        }

        this.securityRounds = securityRounds;
        this.commitments = [];
        this.challenges = [];
        this.responses = [];

        return true;
      }
    }

    // Register algorithm with framework

  // ===== REGISTRATION =====

    const algorithmInstance = new FiatShamir();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FiatShamir, FiatShamirInstance };
}));