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
            input: OpCodes.AnsiToBytes("JEFFERSON"),
            key: OpCodes.AnsiToBytes("25|1"),
            expected: OpCodes.AnsiToBytes("FHYGMNYBL")
          },
          {
            text: "Offset zero is the identity row - the plaintext row is the ciphertext row",
            uri: "https://en.wikipedia.org/wiki/Jefferson_disk",
            input: OpCodes.AnsiToBytes("ATTACKATDAWN"),
            key: OpCodes.AnsiToBytes("25|0"),
            expected: OpCodes.AnsiToBytes("ATTACKATDAWN")
          }
        ];

      }

      /**
       * Create new instance
       * @param {boolean} [isInverse=false] - Decryption mode flag
       * @returns {JeffersonWheelInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new JeffersonWheelInstance(this, isInverse);
      }
    }

    class JeffersonWheelInstance extends IAlgorithmInstance {
      /**
       * @param {JeffersonWheel} algorithm - Parent algorithm instance
       * @param {boolean} [isInverse=false] - Decryption mode flag
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm, isInverse);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {int32} */
        this.wheelCount = 10;
        /** @type {int32} */
        this.alignment = 0;
        /** @type {string[]} */
        this.wheels = [];
        /** @type {int32[]} */
        this.wheelPositions = [];
        /** @type {boolean} */
        this.keyScheduled = false;
        /** @type {uint8[]} */
        this.inputBuffer = [];
        /** @type {uint8[]|null} */
        this._key = null;
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
      /**
       * @returns {string[]} The 25 M-94 wheel alphabets
       */
      get defaultWheels() {
        return this._wheelAlphabets();
      }

      /**
       * @returns {string[]} The 25 M-94 wheel alphabets, a fresh array
       */
      _wheelAlphabets() {
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

      /**
       * @returns {boolean} Always true
       */
      Initialize() {
        this.wheels = [];
        this.wheelPositions = [];
        this.alignment = 0;
        this.keyScheduled = false;

        // Set default key if none set
        if (!this.keyScheduled) {
          this.key = OpCodes.AnsiToBytes("10|0");
        }

        return true;
      }

      /**
       * Key "count|alignment" (test framework compatibility); any other text
       * selects as many wheels as it has characters
       * @param {uint8[]|null} keyData - Key bytes
       */
      set key(keyData) {
        this._key = keyData;
        /** @type {string} */
        const keyString = keyData ? String.fromCharCode(...keyData) : "10|0";

        if (keyString.includes('|')) {
          // Parse key as wheel configuration
          /** @type {string[]} */
          const parts = keyString.split('|');
          /** @type {int32} */
          const count = parseInt(parts[0]);
          /** @type {int32} */
          const offset = parseInt(parts[1]);
          this.wheelCount = count ? count : 10;
          this.alignment = offset ? offset : 0;
        } else {
          // Simple key - use wheel count
          this.wheelCount = Math.max(1, Math.min(26, keyString.length > 0 ? keyString.length : 10));
          this.alignment = 0;
        }

        // Use default wheels
        this.wheels = this._wheelAlphabets().slice(0, this.wheelCount);

        // Initialize wheel positions
        this.wheelPositions = OpCodes.CreateArray(this.wheelCount, 0);

        this.keyScheduled = true;
      }

      /**
       * Get a copy of the key bytes last set
       * @returns {uint8[]|null} Copy of the key bytes, or null when none were set
       */
      get key() {
        return this._key ? this._key.slice() : null;
      }

      /**
       * @param {uint8[]|null} key - Key bytes
       * @returns {boolean} Always true
       */
      SetKey(key) {
        this.key = key;
        return true;
      }

      /**
       * @param {int32[]} positions - One rotation per wheel
       * @returns {void}
       */
      setWheelPositions(positions) {
        if (positions && positions.length >= this.wheelCount) {
          for (let i = 0; i < this.wheelCount; i++) {
            this.wheelPositions[i] = positions[i] % 26;
          }
        }
      }

      /**
       * @param {int32} wheelIndex - Wheel
       * @param {int32} position - Row
       * @returns {string} Letter on that row (undefined for a negative row)
       */
      getWheelChar(wheelIndex, position) {
        if (wheelIndex >= this.wheels.length) {
          throw new Error('Wheel index out of range');
        }

        /** @type {string} */
        const wheel = this.wheels[wheelIndex];
        /** @type {string} */
        const letter = wheel[position % 26];
        return letter;
      }

      /**
       * @param {int32} wheelIndex - Wheel
       * @param {string} char - Upper-case letter
       * @returns {int32} Its row on the wheel, 0 when absent
       */
      findCharOnWheel(wheelIndex, char) {
        if (wheelIndex >= this.wheels.length) {
          throw new Error('Wheel index out of range');
        }

        /** @type {string} */
        const wheel = this.wheels[wheelIndex];
        /** @type {int32} */
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
       * @param {int32} wheelIndex - Which letter of the message this is
       * @returns {string} Enciphered character, case preserved
       */
      encryptChar(char, wheelIndex) {
        /** @type {int32} */
        const charCode = char.charCodeAt(0);
        /** @type {boolean} */
        const isUpper = charCode >= 65 && charCode <= 90;
        /** @type {boolean} */
        const isLower = charCode >= 97 && charCode <= 122;

        if (!isUpper && !isLower) return char; // Return non-letters unchanged

        /** @type {int32} */
        const wheel = wheelIndex % this.wheelCount;
        /** @type {int32} */
        const row = this.findCharOnWheel(wheel, char.toUpperCase());
        /** @type {int32} */
        const shifted = (row + this.alignment + this.wheelPositions[wheel]) % 26;
        /** @type {string} */
        const result = this.getWheelChar(wheel, shifted);

        if (isUpper) {
          return result;
        }
        /** @type {string} */
        const lower = result.toLowerCase();
        return lower;
      }

      /**
       * Read back up the same wheel by the same number of rows.
       * @param {string} char - One ciphertext character
       * @param {int32} wheelIndex - Which letter of the message this is
       * @returns {string} Deciphered character, case preserved
       */
      decryptChar(char, wheelIndex) {
        /** @type {int32} */
        const charCode = char.charCodeAt(0);
        /** @type {boolean} */
        const isUpper = charCode >= 65 && charCode <= 90;
        /** @type {boolean} */
        const isLower = charCode >= 97 && charCode <= 122;

        if (!isUpper && !isLower) return char; // Return non-letters unchanged

        /** @type {int32} */
        const wheel = wheelIndex % this.wheelCount;
        /** @type {int32} */
        const row = this.findCharOnWheel(wheel, char.toUpperCase());
        /** @type {int32} */
        const shifted = (row - this.alignment - this.wheelPositions[wheel] + 52) % 26;
        /** @type {string} */
        const result = this.getWheelChar(wheel, shifted);

        if (isUpper) {
          return result;
        }
        /** @type {string} */
        const lower = result.toLowerCase();
        return lower;
      }

      // Feed data to the cipher

      // Get the result of the transformation  
      /**
       * @returns {uint8[]} Processed bytes
       */
      Result() {
        if (!this.inputBuffer || this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }

        return this.Process(this.inputBuffer, !this.isInverse);
      }

      /**
       * @param {uint8[]} input - Data
       * @param {boolean} [isEncryption=true] - Direction
       * @returns {uint8[]} Processed bytes
       */
      Process(input, isEncryption = true) {
        // Ensure key is set up (fallback to default)
        if (!this.keyScheduled) {
          this.key = OpCodes.AnsiToBytes("10|0");
        }

        /** @type {uint8[]} */
        const result = [];
        /** @type {int32} */
        let wheelIndex = 0;

        for (let i = 0; i < input.length; i++) {
          /** @type {string} */
          const char = String.fromCharCode(input[i]);
          /** @type {string} */
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

      /**
       * @returns {void}
       */
      ClearData() {
        OpCodes.ClearArray(this.wheels);
        OpCodes.ClearArray(this.wheelPositions);
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