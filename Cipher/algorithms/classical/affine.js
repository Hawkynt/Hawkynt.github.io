/*
 * Affine Cipher Implementation
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)

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

  class AffineCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Affine Cipher";
      this.description = "Classical mathematical cipher using linear transformation f(x) = (ax + b) mod 26. Requires coefficient 'a' to be coprime with 26 for reversibility. One of the oldest mathematical ciphers based on modular arithmetic.";
      this.inventor = "Unknown (Ancient)";
      this.year = 1929;
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Classical Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.ANCIENT;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Affine_cipher"),
        new LinkItem("Mathematical Foundation", "https://mathworld.wolfram.com/AffineCipher.html"),
        new LinkItem("Cryptography Theory", "https://www.cs.uri.edu/cryptography/classicalaffine.htm")
      ];

      this.references = [
        new LinkItem("DCode Implementation", "https://www.dcode.fr/affine-cipher"),
        new LinkItem("Educational Example", "https://github.com/geeksforgeeks/affine-cipher"),
        new LinkItem("University Tutorial", "https://www.cs.uregina.ca/Links/class-info/425/Affine/")
      ];

      this.knownVulnerabilities = [
        {
          type: "Frequency Analysis",
          text: "Letter frequencies preserved, making frequency analysis effective against longer texts",
          uri: "https://en.wikipedia.org/wiki/Frequency_analysis",
          mitigation: "Use only for educational purposes, never for actual security"
        },
        {
          type: "Small Key Space",
          text: "Only 312 possible keys (12 valid 'a' values × 26 'b' values), vulnerable to brute force",
          uri: "https://en.wikipedia.org/wiki/Brute-force_attack",
          mitigation: "Consider as demonstration cipher only"
        }
      ];

      // Test vectors using byte arrays - mathematical examples
      this.tests = [
        {
          text: "DCode Reference Test", 
          uri: "https://www.dcode.fr/affine-cipher",
          input: OpCodes.AnsiToBytes("DCODE"),
          key: OpCodes.AnsiToBytes("5,3"),
          expected: OpCodes.AnsiToBytes("SNVSX")
        },
        {
          text: "GeeksforGeeks Example",
          uri: "https://www.geeksforgeeks.org/affine-cipher/",
          input: OpCodes.AnsiToBytes("HELLO"),
          key: OpCodes.AnsiToBytes("17,20"),
          expected: OpCodes.AnsiToBytes("JKZZY")
        },
        {
          text: "Identity Transformation",
          uri: "https://en.wikipedia.org/wiki/Affine_cipher",
          input: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
          key: OpCodes.AnsiToBytes("1,0"),
          expected: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        }
      ];

      // For the test suite compatibility 
      this.testVectors = this.tests;
    }

    // Create instance for this algorithm
    CreateInstance(isInverse = false) {
      return new AffineCipherInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  class AffineCipherInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.keyA = 1;  // Multiplicative coefficient
      this.keyB = 0;  // Additive coefficient
      this.inputBuffer = [];

      // Valid values for 'a' (must be coprime with 26)
      this.VALID_A_VALUES = [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25];
    }

    // Property setter for key
    set key(keyData) {
      if (!keyData || keyData.length === 0) {
        this.keyA = 1;
        this.keyB = 0;
      } else {
        // Parse key format: "a,b" 
        const keyStr = String.fromCharCode.apply(null, keyData);
        const parts = keyStr.split(',');

        if (parts.length >= 2) {
          const a = parseInt(parts[0].trim(), 10);
          const b = parseInt(parts[1].trim(), 10);

          // Validate 'a' is coprime with 26
          if (this.VALID_A_VALUES.includes(a)) {
            this.keyA = a;
          } else {
            this.keyA = 1; // Default safe value
          }

          this.keyB = ((b % 26) + 26) % 26; // Normalize b to 0-25
        } else {
          this.keyA = 1;
          this.keyB = 0;
        }
      }
    }

    get key() {
      return [this.keyA, this.keyB];
    }

    // Find modular multiplicative inverse of a mod 26
    modInverse(a, m) {
      for (let x = 1; x < m; x++) {
        if ((a * x) % m === 1) {
          return x;
        }
      }
      return 1; // Fallback
    }

    // Feed data to the cipher
    Feed(data) {
      if (!data || data.length === 0) return;

      // Add data to input buffer
      this.inputBuffer.push(...data);
    }

    // Get the result of the transformation
    Result() {
      if (this.inputBuffer.length === 0) {
        return [];
      }

      const output = [];
      const inputStr = String.fromCharCode.apply(null, this.inputBuffer);

      // Normalize input to uppercase letters only
      const normalizedInput = inputStr.toUpperCase().replace(/[^A-Z]/g, '');

      // Process each character
      for (const char of normalizedInput) {
        const x = char.charCodeAt(0) - 65; // Convert A-Z to 0-25
        let y;

        if (this.isInverse) {
          // Decryption: x = a^-1 * (y - b) mod 26
          const aInv = this.modInverse(this.keyA, 26);
          y = (aInv * (x - this.keyB + 26)) % 26;
        } else {
          // Encryption: y = (ax + b) mod 26
          y = (this.keyA * x + this.keyB) % 26;
        }

        const resultChar = String.fromCharCode(y + 65); // Convert 0-25 back to A-Z
        output.push(resultChar.charCodeAt(0));
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new AffineCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { AffineCipher, AffineCipherInstance };
}));