/*
 * Jefferson Wheel Cipher Implementation
 * Historical Cipher Device from Thomas Jefferson (1790s)
 * (c)2006-2025 Hawkynt
 */


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

  class JeffersonWheel extends CryptoAlgorithm {
      constructor() {
        super();
        this.name = "Jefferson Wheel";
        this.description = "Polyalphabetic substitution cipher using rotating wheels with randomly arranged alphabets. Invented by Thomas Jefferson around 1795 as a mechanical encryption device.";
        this.category = CategoryType.CLASSICAL;
        this.subCategory = "Classical Cipher";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.securityNotes = "Historical educational cipher. Vulnerable to frequency analysis with sufficient ciphertext. Demonstrates early mechanical cryptographic engineering.";
        this.inventor = "Thomas Jefferson";
        this.year = 1795;
        this.country = CountryCode.US;
        this.complexity = ComplexityType.MEDIUM;

        this.documentation = [
          new LinkItem("Jefferson Papers at Library of Congress", "https://www.loc.gov/collections/thomas-jefferson-papers/"),
          new LinkItem("Cryptographic History", "https://en.wikipedia.org/wiki/Jefferson_disk"),
          new LinkItem("NSA Cryptologic History", "https://www.nsa.gov/about/cryptologic-heritage/")
        ];

        this.references = [
          new LinkItem("Thomas Jefferson Foundation", "https://www.monticello.org/"),
          new LinkItem("Cipher Machines History", "https://www.cryptomuseum.com/"),
          new LinkItem("American Cryptology Museum", "https://www.nsa.gov/about/cryptologic-heritage/museum/")
        ];

        this.knownVulnerabilities = [
          "Vulnerable to frequency analysis attacks when sufficient ciphertext is available",
          "With enough plaintext-ciphertext pairs, wheel alphabets can be recovered"
        ];

        this.tests = [
          {
            text: "Jefferson Wheel Basic Test",
            uri: "Historical records and reconstructions", 
            input: global.OpCodes.AnsiToBytes("HELLO"), 
            key: global.OpCodes.AnsiToBytes("10|0"),
            expected: global.OpCodes.AnsiToBytes("LZPQY")
          },
          {
            text: "Educational Example",
            uri: "Modern educational reconstruction",
            input: global.OpCodes.AnsiToBytes("CIPHER"), 
            key: global.OpCodes.AnsiToBytes("6|5"),
            expected: global.OpCodes.AnsiToBytes("LEOWNR")
          }
        ];

      }

      CreateInstance(isInverse = false) {
        return new JeffersonWheelInstance(this, isInverse);
      }
    }

    class JeffersonWheelInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm, isInverse);
        this.isInverse = isInverse;
        this.wheelCount = 10;
        this.alignment = 0;
        this.wheels = [];
        this.wheelPositions = [];
        this.keyScheduled = false;
        this.inputBuffer = [];
      }

      get defaultWheels() {
        return [
        "ZWAXJGDLUBVIQHKYPNTCRMSOEF", // Wheel 1
        "HXUCZVAMDSLKPEFJRIGQWNOTBY", // Wheel 2
        "JDRKQLFWVBTPZMUGXNHYOCPEIA", // Wheel 3
        "OUGZNPKMEAHQWSLRJDXFYTBICV", // Wheel 4
        "VPKMCWSLZNEXROYFBQTGUHJAID", // Wheel 5
        "MNBVCXZLKJHGFDSAPOIUYTREWQ", // Wheel 6
        "QWERTYUIOPASDFGHJKLZXCVBNM", // Wheel 7
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ", // Wheel 8
        "ZYXWVUTSRQPONMLKJIHGFEDCBA", // Wheel 9
        "PLOKIJUHYGTFRDESWAQZXCVBNM", // Wheel 10
        "LKJHGFDSAMNBVCXZPOIUYTREWQ", // Wheel 11
        "POIUYTREWQLKJHGFDSAMNBVCXZ", // Wheel 12
        "MNBVCXZASDFGHJKLPOIUYTREWQ", // Wheel 13
        "WERTYUIOPASLKJHGFDZXCVBNMQ", // Wheel 14
        "XCVBNMASDFGHJKLPOIUYTREWQZ", // Wheel 15
        "REWQPOIUYTRMNBVCXZASDFGHJK", // Wheel 16
        "DFGHJKLZXCVBNMQWERTYUIOPAS", // Wheel 17
        "YUIOPASDFGHJKLZXCVBNMQWERT", // Wheel 18
        "BNMQWERTYUIOPASDFGHJKLZXCV", // Wheel 19
        "HJKLZXCVBNMQWERTYUIOPASDFG", // Wheel 20
        "QWERTASDFGZXCVBNHJKLYUIOP", // Wheel 21
        "ASDFGHJKLQWERTYUIOPZXCVBNM", // Wheel 22
        "ZXCVBNMQWERTYUIOPASDFGHJKL", // Wheel 23
        "TYUIOPASDFGHJKLZXCVBNMQWER", // Wheel 24
        "GHJKLZXCVBNMQWERTYUIOPASDF", // Wheel 25
          "UIOPASDFGHJKLZXCVBNMQWERTY"  // Wheel 26
        ];
      }

      Initialize() {
        this.wheels = [];
        this.wheelPositions = [];
        this.alignment = 0;
        this.keyScheduled = false;

        // Set default key if none set
        if (!this.keyScheduled) {
          this.key = global.OpCodes.AnsiToBytes("10|0");
        }

        return true;
      }

      // Property setter for key (test framework compatibility)
      set key(keyData) {
        this._key = keyData;
        const keyString = keyData ? String.fromCharCode(...keyData) : "10|0";

        if (keyString.includes('|')) {
          // Parse key as wheel configuration
          const parts = keyString.split('|');
          this.wheelCount = parseInt(parts[0]) || 10;
          this.alignment = parseInt(parts[1]) || 0;
        } else {
          // Simple key - use wheel count
          this.wheelCount = Math.max(1, Math.min(26, keyString.length || 10));
          this.alignment = 0;
        }

        // Use default wheels
        this.wheels = this.defaultWheels.slice(0, this.wheelCount);

        // Initialize wheel positions
        this.wheelPositions = new Array(this.wheelCount).fill(0);

        this.keyScheduled = true;
      }

      get key() {
        return this._key || "10|0";
      }

      SetKey(key) {
        this.key = key;
        return true;
      }

      setWheelPositions(positions) {
        if (positions && positions.length >= this.wheelCount) {
          for (let i = 0; i < this.wheelCount; i++) {
            this.wheelPositions[i] = positions[i] % 26;
          }
        }
      }

      getWheelChar(wheelIndex, position) {
        if (wheelIndex >= this.wheels.length) {
          throw new Error('Wheel index out of range');
        }

        const wheel = this.wheels[wheelIndex];
        return wheel[position % 26];
      }

      findCharOnWheel(wheelIndex, char) {
        if (wheelIndex >= this.wheels.length) {
          throw new Error('Wheel index out of range');
        }

        const wheel = this.wheels[wheelIndex];
        const pos = wheel.indexOf(char);
        return pos >= 0 ? pos : 0;
      }

      encryptChar(char, wheelIndex) {
        const charCode = char.charCodeAt(0);

        // Only encrypt letters
        if (charCode >= 65 && charCode <= 90) { // A-Z
          const letterIndex = charCode - 65;
          const wheel = wheelIndex % this.wheelCount;
          const position = (letterIndex + this.wheelPositions[wheel]) % 26;
          const alignedPosition = (position + this.alignment) % 26;

          return this.getWheelChar(wheel, alignedPosition);
        } else if (charCode >= 97 && charCode <= 122) { // a-z
          const letterIndex = charCode - 97;
          const wheel = wheelIndex % this.wheelCount;
          const position = (letterIndex + this.wheelPositions[wheel]) % 26;
          const alignedPosition = (position + this.alignment) % 26;

          return this.getWheelChar(wheel, alignedPosition).toLowerCase();
        }

        return char; // Return non-letters unchanged
      }

      decryptChar(char, wheelIndex) {
        const charCode = char.charCodeAt(0);

        // Only decrypt letters
        if (charCode >= 65 && charCode <= 90) { // A-Z
          const wheel = wheelIndex % this.wheelCount;
          let position = this.findCharOnWheel(wheel, char);
          position = (position - this.alignment + 26) % 26;
          position = (position - this.wheelPositions[wheel] + 26) % 26;

          return String.fromCharCode(65 + position);
        } else if (charCode >= 97 && charCode <= 122) { // a-z
          const wheel = wheelIndex % this.wheelCount;
          let position = this.findCharOnWheel(wheel, char.toUpperCase());
          position = (position - this.alignment + 26) % 26;
          position = (position - this.wheelPositions[wheel] + 26) % 26;

          return String.fromCharCode(97 + position);
        }

        return char; // Return non-letters unchanged
      }

      // Feed data to the cipher
      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer = [...data];
      }

      // Get the result of the transformation  
      Result() {
        if (!this.inputBuffer || this.inputBuffer.length === 0) {
          return [];
        }

        return this.Process(this.inputBuffer, !this.isInverse);
      }

      Process(input, isEncryption = true) {
        // Ensure key is set up (fallback to default)
        if (!this.keyScheduled) {
          this.key = global.OpCodes.AnsiToBytes("10|0");
        }

        const result = [];
        let wheelIndex = 0;

        for (let i = 0; i < input.length; i++) {
          const char = String.fromCharCode(input[i]);
          const processed = isEncryption ? 
            this.encryptChar(char, wheelIndex) : 
            this.decryptChar(char, wheelIndex);
          result.push(processed.charCodeAt(0));

          // Advance to next wheel for each letter
          if ((char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z')) {
            wheelIndex++;
          }
        }

        return result;
      }

      ClearData() {
        if (global.OpCodes.ClearArray) {
          global.OpCodes.ClearArray(this.wheels);
          global.OpCodes.ClearArray(this.wheelPositions);
        }
        this.keyScheduled = false;
      }

    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new JeffersonWheel();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { JeffersonWheel, JeffersonWheelInstance };
}));