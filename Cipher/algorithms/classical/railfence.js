/*
 * Rail Fence Cipher Implementation
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

  class RailFenceCipher extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Rail Fence Cipher";
      this.description = "Classical transposition cipher writing plaintext diagonally on successive rails of imaginary fence, then reading horizontally. Simple zigzag pattern with configurable number of rails. Easily broken by brute force due to limited key space.";
      this.inventor = "Unknown (Classical)";
      this.year = 1800;
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Classical Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Rail_fence_cipher"),
        new LinkItem("Educational Tutorial", "https://www.dcode.fr/rail-fence-cipher"),
        new LinkItem("Cryptii Implementation", "https://cryptii.com/pipes/rail-fence-cipher")
      ];

      this.references = [
        new LinkItem("Practical Cryptography", "http://practicalcryptography.com/ciphers/classical-era/rail-fence/"),
        new LinkItem("GeeksforGeeks Tutorial", "https://www.geeksforgeeks.org/rail-fence-cipher-encryption-decryption/"),
        new LinkItem("Educational Implementation", "https://www.dcode.fr/rail-fence-cipher")
      ];

      this.knownVulnerabilities = [
        {
          type: "Brute Force Attack",
          text: "Very limited key space (number of rails), easily brute forced even by hand",
          uri: "https://en.wikipedia.org/wiki/Rail_fence_cipher",
          mitigation: "None - cipher is fundamentally insecure"
        },
        {
          type: "Frequency Analysis", 
          text: "Character frequencies preserved, making statistical analysis possible",
          uri: "http://practicalcryptography.com/ciphers/classical-era/rail-fence/",
          mitigation: "Use only for educational demonstrations"
        }
      ];

      // Test vectors using byte arrays (using key field for rails)
      this.tests = [
        {
          text: "Classic rail fence example with 3 rails",
          uri: "https://en.wikipedia.org/wiki/Rail_fence_cipher",
          input: OpCodes.AnsiToBytes("WEAREDISCOVEREDFLEEATONCE"),
          key: OpCodes.AnsiToBytes("3"),
          expected: OpCodes.AnsiToBytes("WECRLTEERDSOEEFEAOCAIVDEN")
        },
        {
          text: "Educational example with 4 rails",
          uri: "https://www.geeksforgeeks.org/rail-fence-cipher-encryption-decryption/",
          input: OpCodes.AnsiToBytes("ATTACKATDAWN"),
          key: OpCodes.AnsiToBytes("4"),
          expected: OpCodes.AnsiToBytes("AATKTNTCDWAA")
        },
        {
          text: "Simple 2 rail example",
          uri: "https://www.dcode.fr/rail-fence-cipher",
          input: OpCodes.AnsiToBytes("HELLO"),
          key: OpCodes.AnsiToBytes("2"),
          expected: OpCodes.AnsiToBytes("HLOEL")
        },
        {
          text: "Mixed case with spaces",
          uri: "https://cryptii.com/pipes/rail-fence-cipher",
          input: OpCodes.AnsiToBytes("Hello World"),
          key: OpCodes.AnsiToBytes("3"),
          expected: OpCodes.AnsiToBytes("Horel ollWd")
        },
        {
          text: "Long message with 5 rails",
          uri: "http://practicalcryptography.com/ciphers/classical-era/rail-fence/",
          input: OpCodes.AnsiToBytes("THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG"),
          key: OpCodes.AnsiToBytes("5"),
          expected: OpCodes.AnsiToBytes("TBJRDHKRXUETYOECOOMVHZGQIWFPOEAUNSL")
        }
      ];

      // For the test suite compatibility 
      this.testVectors = this.tests;
    }

    // Create instance for this algorithm
    CreateInstance(isInverse = false) {
      return new RailFenceCipherInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  class RailFenceCipherInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.rails = 3; // Default number of rails
      this.inputBuffer = [];
    }

    // Property setter for rails (key)
    set rails(railsData) {
      if (typeof railsData === 'number') {
        this._rails = Math.max(2, Math.min(26, Math.floor(railsData)));
      } else if (Array.isArray(railsData) && railsData.length > 0) {
        // If rails provided as byte array, use first byte as rail count
        const railCount = railsData[0];
        this._rails = Math.max(2, Math.min(26, railCount));
      } else {
        this._rails = 3; // Default
      }
    }

    get rails() {
      return this._rails || 3;
    }

    // Property setter for key (used by test framework)
    set key(keyData) {
      if (!keyData || keyData.length === 0) {
        this._rails = 3; // Default
      } else {
        // Convert key bytes to integer
        const keyStr = String.fromCharCode.apply(null, keyData);
        const railCount = parseInt(keyStr, 10);
        if (!isNaN(railCount)) {
          this._rails = Math.max(2, Math.min(26, railCount));
        } else {
          this._rails = 3; // Default
        }
      }
    }

    get key() {
      return this._rails || 3;
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

      const rails = this.rails;
      const inputStr = String.fromCharCode.apply(null, this.inputBuffer);
      let result;

      if (this.isInverse) {
        result = this.decryptRailFence(inputStr, rails);
      } else {
        result = this.encryptRailFence(inputStr, rails);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      // Convert result string back to byte array
      const output = [];
      for (let i = 0; i < result.length; i++) {
        output.push(result.charCodeAt(i));
      }

      return output;
    }

    // Encrypt using rail fence algorithm
    encryptRailFence(plaintext, rails) {
      if (plaintext.length === 0 || rails < 2) {
        return plaintext;
      }

      // Create rail arrays
      const railArrays = [];
      for (let i = 0; i < rails; i++) {
        railArrays[i] = [];
      }

      // Fill rails with zigzag pattern
      let currentRail = 0;
      let direction = 1; // 1 for down, -1 for up

      for (let i = 0; i < plaintext.length; i++) {
        railArrays[currentRail].push(plaintext.charAt(i));

        // Move to next rail
        currentRail += direction;

        // Change direction at boundaries
        if (currentRail === rails - 1 || currentRail === 0) {
          direction *= -1;
        }
      }

      // Read off rails horizontally
      let result = '';
      for (let i = 0; i < rails; i++) {
        result += railArrays[i].join('');
      }

      return result;
    }

    // Decrypt using rail fence algorithm
    decryptRailFence(ciphertext, rails) {
      if (ciphertext.length === 0 || rails < 2) {
        return ciphertext;
      }

      // Create rail arrays
      const railArrays = [];
      for (let i = 0; i < rails; i++) {
        railArrays[i] = [];
      }

      // Calculate how many characters go on each rail
      const railLengths = new Array(rails).fill(0);
      let currentRail = 0;
      let direction = 1;

      for (let i = 0; i < ciphertext.length; i++) {
        railLengths[currentRail]++;
        currentRail += direction;

        if (currentRail === rails - 1 || currentRail === 0) {
          direction *= -1;
        }
      }

      // Distribute cipher text to rails
      let pos = 0;
      for (let i = 0; i < rails; i++) {
        for (let j = 0; j < railLengths[i]; j++) {
          railArrays[i].push(ciphertext.charAt(pos++));
        }
      }

      // Read back in zigzag pattern
      const railIndices = new Array(rails).fill(0);
      currentRail = 0;
      direction = 1;
      let result = '';

      for (let i = 0; i < ciphertext.length; i++) {
        result += railArrays[currentRail][railIndices[currentRail]++];
        currentRail += direction;

        if (currentRail === rails - 1 || currentRail === 0) {
          direction *= -1;
        }
      }

      return result;
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new RailFenceCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RailFenceCipher, RailFenceCipherInstance };
}));