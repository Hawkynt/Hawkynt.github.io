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

        // Key format is "wheelCount|offset": how many of the wheels are on the
        // spindle, and how many rows below the plaintext row the ciphertext is
        // read off.
        this.tests = [
          {
            text: "dCode worked example - JEFFERSON on the 25 standard wheels, read one row below",
            uri: "https://www.dcode.fr/jefferson-wheel-cipher",
            input: global.OpCodes.AnsiToBytes("JEFFERSON"),
            key: global.OpCodes.AnsiToBytes("25|1"),
            expected: global.OpCodes.AnsiToBytes("FHYGMNYBL")
          },
          {
            text: "Offset zero is the identity row - the plaintext row is the ciphertext row",
            uri: "https://en.wikipedia.org/wiki/Jefferson_disk",
            input: global.OpCodes.AnsiToBytes("ATTACKATDAWN"),
            key: global.OpCodes.AnsiToBytes("25|0"),
            expected: global.OpCodes.AnsiToBytes("ATTACKATDAWN")
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

      // The 25 documented wheel alphabets of the M-94, the US Army's
      // production Jefferson disk. Every one is a permutation of A-Z, wheel 17
      // famously beginning ARMYOFTHEUS.
      //
      // The set this replaces was not a documented wheel set and did not even
      // hold together as one: wheel 3 carried P twice and no S, wheel 16
      // carried R twice and no L, and wheel 21 was 25 letters long. A wheel
      // that is not a permutation cannot be read backwards, so those three
      // wheels silently corrupted anything they touched.
      get defaultWheels() {
        return [
          "ABCEIGDJFVUYMHTQKZOLRXSPWN", // Wheel 1
          "ACDEHFIJKTLMOUVYGZNPQXRWSB", // Wheel 2
          "ADKOMJUBGEPHSCZINXFYQRTVWL", // Wheel 3
          "AEDCBIFGJHLKMRUOQVPTNWYXZS", // Wheel 4
          "AFNQUKDOPITJBRHCYSLWEMZVXG", // Wheel 5
          "AGPOCIXLURNDYZHWBJSQFKVMET", // Wheel 6
          "AHXJEZBNIKPVROGSYDULCFMQTW", // Wheel 7
          "AIHPJOBWKCVFZLQERYNSUMGTDX", // Wheel 8
          "AJDSKQOIVTZEFHGYUNLPMBXWCR", // Wheel 9
          "AKELBDFJGHONMTPRQSVZUXYWIC", // Wheel 10
          "ALTMSXVQPNOHUWDIZYCGKRFBEJ", // Wheel 11
          "AMNFLHQGCUJTBYPZKXISRDVEWO", // Wheel 12
          "ANCJILDHBMKGXUZTSWQYVORPFE", // Wheel 13
          "AODWPKJVIUQHZCTXBLEGNYRSMF", // Wheel 14
          "APBVHIYKSGUENTCXOWFQDRLJZM", // Wheel 15
          "AQJNUBTGIMWZRVLXCSHDEOKFPY", // Wheel 16
          "ARMYOFTHEUSZJXDPCWGQIBKLNV", // Wheel 17
          "ASDMCNEQBOZPLGVJRKYTFUIWXH", // Wheel 18
          "ATOJYLFXNGWHVCMIRBSEKUPDZQ", // Wheel 19
          "AUTRZXQLYIOVBPESNHJWMDGFCK", // Wheel 20
          "AVNKHRGOXEYBFSJMUDQCLZWTIP", // Wheel 21
          "AWVSFDLIEBHKNRJQZGMXPUCOTY", // Wheel 22
          "AXKWREVDTUFOYHMLSIQNJCPGBZ", // Wheel 23
          "AYJPXMVKBQWUGLOSTECHNZFRID", // Wheel 24
          "AZDNBUHYFWJLVGRCQMPSOEXTKI"  // Wheel 25
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

      /**
       * Turn the wheel until the plaintext letter is on the plaintext row,
       * then read the letter 'alignment' rows further round the same wheel.
       *
       * The plaintext letter has to be LOOKED UP on the wheel; using its
       * position in A-Z as a row number instead turned the device into a
       * fixed substitution by the wheel alphabet and made an offset of zero
       * encipher rather than stand still, which is not how a Jefferson disk
       * works and disagreed with the published worked example.
       * @param {string} char - One plaintext character
       * @param {number} wheelIndex - Which letter of the message this is
       * @returns {string} Enciphered character, case preserved
       */
      encryptChar(char, wheelIndex) {
        const charCode = char.charCodeAt(0);
        const isUpper = charCode >= 65 && charCode <= 90;
        const isLower = charCode >= 97 && charCode <= 122;

        if (!isUpper && !isLower) return char; // Return non-letters unchanged

        const wheel = wheelIndex % this.wheelCount;
        const row = this.findCharOnWheel(wheel, char.toUpperCase());
        const shifted = (row + this.alignment + this.wheelPositions[wheel]) % 26;
        const result = this.getWheelChar(wheel, shifted);

        return isUpper ? result : result.toLowerCase();
      }

      /**
       * Read back up the same wheel by the same number of rows.
       * @param {string} char - One ciphertext character
       * @param {number} wheelIndex - Which letter of the message this is
       * @returns {string} Deciphered character, case preserved
       */
      decryptChar(char, wheelIndex) {
        const charCode = char.charCodeAt(0);
        const isUpper = charCode >= 65 && charCode <= 90;
        const isLower = charCode >= 97 && charCode <= 122;

        if (!isUpper && !isLower) return char; // Return non-letters unchanged

        const wheel = wheelIndex % this.wheelCount;
        const row = this.findCharOnWheel(wheel, char.toUpperCase());
        const shifted = (row - this.alignment - this.wheelPositions[wheel] + 52) % 26;
        const result = this.getWheelChar(wheel, shifted);

        return isUpper ? result : result.toLowerCase();
      }

      // Feed data to the cipher

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