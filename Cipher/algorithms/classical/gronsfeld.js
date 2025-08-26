/*
 * Gronsfeld Cipher Implementation
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

  class GronsfeldCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Gronsfeld Cipher";
      this.description = "Polyalphabetic substitution cipher using numeric key instead of letters. Each digit represents Caesar shift value, making it Vigenère variant with reduced key space. Named after Count of Gronsfeld in 16th century.";
      this.inventor = "Count of Gronsfeld";
      this.year = 1518;
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Classical Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.NL;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Gronsfeld_cipher"),
        new LinkItem("Historical Context", "http://practicalcryptography.com/ciphers/classical-era/gronsfeld/"),
        new LinkItem("Cryptanalysis Methods", "https://en.wikipedia.org/wiki/Kasiski_examination")
      ];

      this.references = [
        new LinkItem("Educational Implementation", "https://www.dcode.fr/gronsfeld-cipher"),
        new LinkItem("CryptoCrack Examples", "https://sites.google.com/site/cryptocrackprogram/user-guide/cipher-types/substitution/gronsfeld"),
        new LinkItem("Practical Cryptography", "http://practicalcryptography.com/ciphers/classical-era/gronsfeld/")
      ];

      this.knownVulnerabilities = [
        {
          type: "Kasiski Examination",
          text: "Repeated patterns in ciphertext reveal key length, enabling frequency analysis like Vigenère",
          uri: "https://en.wikipedia.org/wiki/Kasiski_examination",
          mitigation: "None - fundamental weakness of polyalphabetic substitution"
        },
        {
          type: "Reduced Key Space", 
          text: "Only 10 possible shifts (0-9) compared to 26 for Vigenère, making brute force easier",
          uri: "http://practicalcryptography.com/ciphers/classical-era/gronsfeld/",
          mitigation: "Use only for educational demonstrations"
        }
      ];

      // Test vectors using byte arrays (corrected with actual Gronsfeld outputs)
      this.tests = [
        {
          text: "Traditional Gronsfeld example with simple numeric key",
          uri: "https://sites.google.com/site/cryptocrackprogram/user-guide/cipher-types/substitution/gronsfeld",
          input: OpCodes.AnsiToBytes("DEFENDTHEEASTWALLOFTHECASTLE"),
          key: OpCodes.AnsiToBytes("31415"),
          expected: OpCodes.AnsiToBytes("GFJFSGULFJDTXXFOMSGYKFGBXWMI")
        },
        {
          text: "Military communication example",
          uri: "http://practicalcryptography.com/ciphers/classical-era/gronsfeld/",
          input: OpCodes.AnsiToBytes("ATTACKATDAWN"),
          key: OpCodes.AnsiToBytes("1234"),
          expected: OpCodes.AnsiToBytes("BVWEDMDXECZR")
        },
        {
          text: "Basic alphabet transformation test",
          uri: "https://cryptii.com/pipes/gronsfeld-cipher",
          input: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
          key: OpCodes.AnsiToBytes("12345"),
          expected: OpCodes.AnsiToBytes("BDFHJGIKMOLNPRTQSUWYVXZBDA")
        },
        {
          text: "Single digit key test - equivalent to Caesar",
          uri: "https://www.dcode.fr/gronsfeld-cipher",
          input: OpCodes.AnsiToBytes("HELLO"),
          key: OpCodes.AnsiToBytes("3"),
          expected: OpCodes.AnsiToBytes("KHOOR")
        },
        {
          text: "Mixed case text with spaces",
          uri: "https://www.dcode.fr/gronsfeld-cipher",
          input: OpCodes.AnsiToBytes("Hello World"),
          key: OpCodes.AnsiToBytes("12345"),
          expected: OpCodes.AnsiToBytes("Igopt Xqupi")
        }
      ];

      // For the test suite compatibility 
      this.testVectors = this.tests;
    }

    // Create instance for this algorithm
    CreateInstance(isInverse = false) {
      return new GronsfeldCipherInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  class GronsfeldCipherInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = [];
      this.inputBuffer = [];

      // Character sets
      this.ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }

    // Property setter for key
    set key(keyData) {
      if (!keyData || keyData.length === 0) {
        this._processedKey = "12345"; // Default key
      } else {
        // Convert key bytes to numeric string, keep only digits
        const keyStr = String.fromCharCode.apply(null, keyData);
        this._processedKey = keyStr.replace(/[^0-9]/g, '');
        if (this._processedKey.length === 0) {
          this._processedKey = "12345"; // Fallback
        }
      }
    }

    get key() {
      return this._processedKey || "12345";
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
      const processedKey = this.key;
      let keyIndex = 0;

      // Process each byte
      for (const byte of this.inputBuffer) {
        const char = String.fromCharCode(byte);

        if (/[A-Za-z]/.test(char)) {
          // Get shift from key (cycle through key)
          const shift = parseInt(processedKey[keyIndex % processedKey.length]);
          const effectiveShift = this.isInverse ? -shift : shift;

          const isUpperCase = char >= 'A' && char <= 'Z';
          const baseCode = isUpperCase ? 65 : 97; // 'A' or 'a'
          const charCode = char.charCodeAt(0);

          // Apply shift with modular arithmetic
          const shiftedCode = ((charCode - baseCode + effectiveShift + 26) % 26) + baseCode;
          output.push(shiftedCode);
          keyIndex++;
        } else {
          // Non-alphabetic characters pass through unchanged
          output.push(byte);
        }
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new GronsfeldCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { GronsfeldCipher, GronsfeldCipherInstance };
}));