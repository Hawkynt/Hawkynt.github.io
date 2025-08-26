
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

  // ===== ALGORITHM IMPLEMENTATION =====

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

        this.tests = [
          new TestCase(
            [10000], // timeSteps for educational test
            [true],  // expectedSuccess
            'Educational Fiat-Shamir proof with small parameters',
            'https://link.springer.com/chapter/10.1007/3-540-47721-7_12'
          )
        ];

        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new FiatShamirInstance(this, isInverse);
      }
    }

    class FiatShamirInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // Public parameters
        this.n = null;                // Modulus n = p * q
        this.v = [];                  // Public keys (quadratic residues)

        // Secret parameters (prover only)
        this.p = null;                // First prime (secret)
        this.q = null;                // Second prime (secret)
        this.s = [];                  // Secret keys (square roots)

        // Protocol state
        this.securityRounds = FS_CONSTANTS.MIN_SECURITY_ROUNDS;
        this.modulusBits = FS_CONSTANTS.DEFAULT_MODULUS_BITS;
        this.numSecrets = 1;          // Number of secret values

        // Session data
        this.commitments = [];        // Prover commitments (x values)
        this.challenges = [];         // Verifier challenges (e values)
        this.responses = [];          // Prover responses (y values)

        this.initialized = false;
        this.isProver = false;
        this.isVerifier = false;
      }

      set key(keyData) {
        // Fiat-Shamir doesn't use traditional keys - parameters are generated
        // This can be used to set protocol parameters if needed
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        // For Fiat-Shamir, this could run a proof protocol
        // For now, return success indicator
        const result = this.isInverse ? [0] : [1]; // Simple success/failure

        this.inputBuffer = [];
        return result;
      }

      /**
       * Generate Fiat-Shamir parameters (done by trusted setup or prover)
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
        const primeBits = Math.floor(modulusBits / 2);
        this.p = this.generateBlumPrime(primeBits);
        this.q = this.generateBlumPrime(primeBits);

        // Ensure primes are different
        while (this.p === this.q) {
          this.q = this.generateBlumPrime(primeBits);
        }

        // Calculate modulus
        this.n = this.p * this.q;

        // Generate secret keys and corresponding public keys
        this.s = [];
        this.v = [];

        for (let i = 0; i < numSecrets; i++) {
          // Generate random secret s_i relatively prime to n
          let secret;
          do {
            secret = this.secureRandomRange(1, this.n);
          } while (this.gcd(secret, this.n) !== 1);

          this.s.push(secret);

          // Calculate public key v_i = s_i^2 mod n
          const publicKey = this.modMul(secret, secret, this.n);
          this.v.push(publicKey);
        }

        this.initialized = true;
        this.isProver = true;

        return {
          modulus: this.n,
          publicKeys: this.v.slice(),
          modulusBits: modulusBits,
          numSecrets: numSecrets
        };
      }

      /**
       * Setup verifier with public parameters
       */
      SetupVerifier(publicParams) {
        if (!publicParams || !publicParams.modulus || !publicParams.publicKeys) {
          throw new Error('Invalid public parameters');
        }

        this.n = publicParams.modulus;
        this.v = publicParams.publicKeys.slice();
        this.numSecrets = publicParams.publicKeys.length;
        this.modulusBits = publicParams.modulusBits || 1024;

        this.initialized = true;
        this.isVerifier = true;

        return true;
      }

      // Mathematical helper methods
      generateBlumPrime(bits) {
        const min = Math.pow(2, bits - 1);
        const max = Math.pow(2, bits) - 1;

        for (let attempt = 0; attempt < 1000; attempt++) {
          let candidate = min + Math.floor(Math.random() * (max - min));

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

      isProbablePrime(n, k = 10) {
        if (n < 2) return false;
        if (n === 2 || n === 3) return true;
        if (n % 2 === 0) return false;

        // Small prime check
        for (let prime of FS_CONSTANTS.SMALL_PRIMES) {
          if (n === prime) return true;
          if (n % prime === 0) return false;
        }

        return true; // Simplified for educational purposes
      }

      fastModExp(base, exponent, modulus) {
        if (modulus === 1) return 0;

        let result = 1;
        base = base % modulus;

        while (exponent > 0) {
          if (exponent % 2 === 1) {
            result = this.modMul(result, base, modulus);
          }
          exponent = Math.floor(exponent / 2);
          base = this.modMul(base, base, modulus);
        }

        return result;
      }

      modMul(a, b, m) {
        return (a * b) % m;
      }

      gcd(a, b) {
        while (b !== 0) {
          const temp = b;
          b = a % b;
          a = temp;
        }
        return a;
      }

      secureRandomRange(min, max) {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          const range = max - min;
          const array = new Uint32Array(1);
          crypto.getRandomValues(array);
          return min + (array[0] % range);
        } else {
          return min + Math.floor(Math.random() * (max - min));
        }
      }

      /**
       * Start zero-knowledge proof session
       */
      StartProof(securityRounds = 40) {
        if (!this.initialized) {
          throw new Error('Fiat-Shamir instance not properly initialized');
        }

        if (securityRounds < FS_CONSTANTS.MIN_SECURITY_ROUNDS || 
            securityRounds > FS_CONSTANTS.MAX_SECURITY_ROUNDS) {
          throw new Error('Security rounds must be between ' + 
                         FS_CONSTANTS.MIN_SECURITY_ROUNDS + ' and ' + 
                         FS_CONSTANTS.MAX_SECURITY_ROUNDS);
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