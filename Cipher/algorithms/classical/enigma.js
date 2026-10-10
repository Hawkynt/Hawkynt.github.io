/*
 * Enigma Machine Implementation
 * Based on the German Enigma I machine (Educational Simulation)
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

  /** @type {int32} */
  const UPPER_A = 65;
  /** @type {int32} */
  const UPPER_Z = 90;

  /**
   * Printable stand-in for a byte, for use in an error message.
   * @param {uint8} byte - Offending byte
   * @returns {string} The character itself when it is printable ASCII, else '?'
   */
  function DescribeByte(byte) {
    return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '?';
  }

  /**
   * Reject the first byte the machine has no key for, naming it and its place.
   * @param {uint8[]} message - Bytes about to be enciphered
   * @throws {Error} On the first byte outside A-Z
   */
  function RequireLetters(message) {
    for (let i = 0; i < message.length; i++) {
      /** @type {uint8} */
      const byte = message[i];
      if (byte < UPPER_A || byte > UPPER_Z) {
        /** @type {string} */
        let hex = byte.toString(16);
        while (hex.length < 2) hex = '0' + hex;
        throw new Error("EnigmaMachineInstance.Result: byte 0x" + hex
          + " ('" + DescribeByte(byte) + "') at position " + i + " is not one of the 26 letters A-Z"
          + ' the machine has keys for');
      }
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class EnigmaMachine extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Enigma Machine";
      this.description = "Simplified 3-rotor Enigma machine simulation for educational purposes. Historical WWII cipher machine with rotating mechanical rotors and electrical pathways. Uses reciprocal substitution through rotor wirings and reflector. Input domain: uppercase A-Z only. The machine is 26 keys, 26 lamps and 26 rotor contacts - it has no key for a digit, a space, a punctuation mark or a lowercase letter, and operators spelled such things out in the plaintext before enciphering. Anything outside A-Z is therefore refused by name and position rather than case-folded or passed through in clear, and A-Z round-trips exactly because the machine is reciprocal.";
      this.inventor = "Arthur Scherbius";
      this.year = 1918;
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Classical Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.DE;

      // The machine has 26 keys, 26 lamps and 26 contacts per rotor, and no
      // notion of case. There is no wiring an out-of-range byte could travel
      // along, so it is rejected instead. Declared here so the round-trip
      // suite scores that rejection as a domain limit, not a defect.
      this.restrictedInputDomain = true;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Enigma_machine"),
        new LinkItem("Bletchley Park History", "https://www.bletchleypark.org.uk/our-story/enigma"),
        new LinkItem("Technical Description", "https://en.wikipedia.org/wiki/Enigma_rotor_details")
      ];

      this.references = [
        new LinkItem("Enigma Simulator", "https://www.cryptomuseum.com/crypto/enigma/sim/"),
        new LinkItem("Educational Implementation", "https://github.com/mikepound/enigma"),
        new LinkItem("Historical Analysis", "https://www.codesandciphers.org.uk/enigma/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "No Self-Encryption",
          "No letter can encrypt to itself due to reflector design, reducing key space",
          "Historical design flaw - avoid for real cryptography",
          "https://en.wikipedia.org/wiki/Enigma_machine#Reflector"
        ),
        new Vulnerability(
          "Rotor Stepping Patterns",
          "Predictable rotor advancement patterns enable statistical cryptanalysis",
          "Educational use only - demonstrates importance of proper design",
          "https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma"
        )
      ];

      // Test vectors using byte arrays.
      // Key format is three start positions followed by three rotor numbers,
      // so "AAA123" is rotors I, II and III left to right standing at AAA.
      this.tests = [
        {
          text: "Wikipedia canonical check - rotors I II III left to right, wide B reflector, ring settings A, start AAA, typing AAAAA gives BDZGO",
          uri: "https://en.wikipedia.org/wiki/Enigma_rotor_details",
          input: OpCodes.AnsiToBytes("AAAAA"),
          key: OpCodes.AnsiToBytes("AAA123"),
          expected: OpCodes.AnsiToBytes("BDZGO")
        },
        {
          text: "The same check carried on to 25 letters, which crosses the right rotor's turnover at V and so exercises the middle rotor stepping",
          uri: "https://en.wikipedia.org/wiki/Enigma_rotor_details",
          input: OpCodes.AnsiToBytes("AAAAAAAAAAAAAAAAAAAAAAAAA"),
          key: OpCodes.AnsiToBytes("AAA123"),
          expected: OpCodes.AnsiToBytes("BDZGOWCXLTKSBTMCDLPBMUQOF")
        },
        {
          text: "Reciprocity - the machine is its own inverse, so the 25-letter ciphertext returns 25 A's on the same setting",
          uri: "https://en.wikipedia.org/wiki/Enigma_rotor_details",
          input: OpCodes.AnsiToBytes("BDZGOWCXLTKSBTMCDLPBMUQOF"),
          key: OpCodes.AnsiToBytes("AAA123"),
          expected: OpCodes.AnsiToBytes("AAAAAAAAAAAAAAAAAAAAAAAAA")
        },
        {
          text: "Start position ABC. No published source carries this value; it is here to cover a non-zero start position",
          uri: "https://en.wikipedia.org/wiki/Enigma_machine",
          input: OpCodes.AnsiToBytes("HELLOWORLD"),
          key: OpCodes.AnsiToBytes("ABC123"),
          expected: OpCodes.AnsiToBytes("ROMULLBIBB")
        }
      ];

      // For the test suite compatibility
      /** @type {TestCase[]} */
      this.testVectors = this.tests;
    }

    // Create instance for this algorithm
    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {EnigmaMachineInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new EnigmaMachineInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  /**
 * EnigmaMachine cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class EnigmaMachineInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {EnigmaMachine} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];

      // Historical rotor wirings (simplified for education)
      /** @type {string} */
      this.ROTOR_I = 'EKMFLGDQVZNTOWYHXUSPAIBRCJ';
      /** @type {string} */
      this.ROTOR_II = 'AJDKSIRUXBLHWTMCQGZNPYFVOE';
      /** @type {string} */
      this.ROTOR_III = 'BDFHJLCPRTXVZNYEIWGAKMUSQO';

      // Rotor notches (when the rotor steps the next one)
      /** @type {string} */
      this.NOTCH_I = 'Q';
      /** @type {string} */
      this.NOTCH_II = 'E';
      /** @type {string} */
      this.NOTCH_III = 'V';

      // Reflector B wiring
      /** @type {string} */
      this.REFLECTOR_B = 'YRUHQSLDPXNGOKMIEBFZCWVJAT';

      // Initialize with default configuration
      /** @type {int32[]} */
      this.rotorPositions = [0, 0, 0]; // A, A, A
      /** @type {int32[]} */
      this.rotorSelection = [1, 2, 3]; // I, II, III
      /** @type {string[]} */
      this.rotorWirings = [];
      /** @type {string[]} */
      this.rotorNotches = [];
      /** @type {string} */
      this.reflectorWiring = this.REFLECTOR_B;

      this.setupRotors();
    }

    /**
     * Key "PPPSSS": three start positions A-Z and three rotor numbers 1-3
     * @param {uint8[]|null} keyData - Key bytes; shorter than 6 selects "ABC123"
     */
    set key(keyData) {
      this._keyBytes = keyData ? Array.from(keyData) : null;
      if (!keyData || keyData.length < 6) {
        this.parseKey("ABC123"); // Default key
      } else {
        /** @type {string} */
        const keyStr = String.fromCharCode.apply(null, keyData);
        this.parseKey(keyStr);
      }
    }

    /**
   * @returns {uint8[]|null} The key bytes as set
   */

    get key() {
      return this._keyBytes || null;
    }

    /**
     * Start position encoded by the key character at an index
     * @param {string} setting - Upper-case key text
     * @param {int32} index - Character index
     * @returns {int32} Position 0..25 (A for a missing character)
     */
    _positionAt(setting, index) {
      /** @type {int32} */
      const code = setting.charCodeAt(index);
      /** @type {int32} */
      const letter = code ? code : 65;
      return Math.max(0, Math.min(25, letter - 65));
    }

    /**
     * Rotor number encoded by the key character at an index
     * @param {string} setting - Upper-case key text
     * @param {int32} index - Character index
     * @param {int32} fallback - Rotor when the character is no digit (or 0)
     * @returns {int32} Rotor number 1..3
     */
    _rotorAt(setting, index, fallback) {
      /** @type {int32} */
      const digit = parseInt(setting.charAt(index));
      return Math.max(1, Math.min(3, digit ? digit : fallback));
    }

    /**
     * Parse the key configuration
     * @param {string} keyStr - Key text
     * @returns {void}
     */
    parseKey(keyStr) {
      /** @type {string} */
      const setting = keyStr.toUpperCase();

      // Parse rotor positions (first 3 chars)
      this.rotorPositions = [
        this._positionAt(setting, 0),
        this._positionAt(setting, 1),
        this._positionAt(setting, 2)
      ];

      // Parse rotor selection (next 3 chars)
      this.rotorSelection = [
        this._rotorAt(setting, 3, 1),
        this._rotorAt(setting, 4, 2),
        this._rotorAt(setting, 5, 3)
      ];

      this.setupRotors();
    }

    /**
     * Setup rotor configurations
     * @returns {void}
     */
    setupRotors() {
      this.rotorWirings = [];
      this.rotorNotches = [];

      for (let i = 0; i < 3; i++) {
        switch (this.rotorSelection[i]) {
          case 1:
            this.rotorWirings[i] = this.ROTOR_I;
            this.rotorNotches[i] = this.NOTCH_I;
            break;
          case 2:
            this.rotorWirings[i] = this.ROTOR_II;
            this.rotorNotches[i] = this.NOTCH_II;
            break;
          case 3:
            this.rotorWirings[i] = this.ROTOR_III;
            this.rotorNotches[i] = this.NOTCH_III;
            break;
          default:
            this.rotorWirings[i] = this.ROTOR_I;
            this.rotorNotches[i] = this.NOTCH_I;
        }
      }
    }

    // Step the rotors before encryption.
    //
    // The pawls read the rotor to their right, not the one they turn:
    //  - the right rotor advances on every key press;
    //  - the middle rotor advances when the RIGHT rotor is standing at its
    //    own notch as the key goes down;
    //  - the middle rotor also advances when it is itself standing at its
    //    notch, and drags the left rotor round with it - the double step.
    //
    // Reading the middle rotor's notch to decide whether the middle rotor
    // steps, and the left rotor's notch to decide whether the left rotor
    // steps, meant neither ever moved: the middle rotor could only reach its
    // own notch by stepping, and it never stepped. The machine degenerated
    // into a period-26 substitution and diverged from the real Enigma at the
    // 22nd letter of a message begun at AAA.
    /**
     * @returns {void}
     */
    stepRotors() {
      /** @type {int32} */
      const middleNotch = this.rotorNotches[1].charCodeAt(0) - 65;
      /** @type {int32} */
      const rightNotch = this.rotorNotches[2].charCodeAt(0) - 65;

      /** @type {boolean} */
      const middleAtNotch = this.rotorPositions[1] === middleNotch;
      /** @type {boolean} */
      const rightAtNotch = this.rotorPositions[2] === rightNotch;

      /** @type {boolean[]} */
      const step = [middleAtNotch, middleAtNotch || rightAtNotch, true];

      for (let i = 0; i < 3; i++) {
        if (step[i]) {
          this.rotorPositions[i] = (this.rotorPositions[i] + 1) % 26;
        }
      }
    }

    /**
     * Encode through a rotor (forward direction)
     * @param {int32} input - Letter 0..25
     * @param {int32} rotorIndex - Rotor 0..2
     * @returns {int32} Letter 0..25
     */
    encodeRotorForward(input, rotorIndex) {
      // Adjust for rotor position
      /** @type {int32} */
      const adjustedInput = (input + this.rotorPositions[rotorIndex]) % 26;

      // Get the wiring
      /** @type {string} */
      const wiring = this.rotorWirings[rotorIndex];
      /** @type {string} */
      const outputChar = wiring[adjustedInput];
      /** @type {int32} */
      const output = outputChar.charCodeAt(0) - 65;

      // Adjust back for rotor position
      return (output - this.rotorPositions[rotorIndex] + 26) % 26;
    }

    /**
     * Encode through a rotor (backward direction)
     * @param {int32} input - Letter 0..25
     * @param {int32} rotorIndex - Rotor 0..2
     * @returns {int32} Letter 0..25
     */
    encodeRotorBackward(input, rotorIndex) {
      // Adjust for rotor position
      /** @type {int32} */
      const adjustedInput = (input + this.rotorPositions[rotorIndex]) % 26;

      // Find the reverse mapping
      /** @type {string} */
      const targetChar = String.fromCharCode(adjustedInput + 65);
      /** @type {int32} */
      let output = this.rotorWirings[rotorIndex].indexOf(targetChar);

      if (output === -1) output = 0; // Fallback

      // Adjust back for rotor position
      return (output - this.rotorPositions[rotorIndex] + 26) % 26;
    }

    /**
     * Encode through reflector
     * @param {int32} input - Letter 0..25
     * @returns {int32} Reflected letter 0..25
     */
    encodeReflector(input) {
      /** @type {string} */
      const outputChar = this.reflectorWiring[input];
      return outputChar.charCodeAt(0) - 65;
    }

    /**
     * Encrypt a single letter, given as its 0-25 position in the alphabet
     * @param {int32} letter - Letter 0..25
     * @returns {int32} Enciphered letter 0..25
     */
    encryptLetter(letter) {
      // Step rotors before encryption
      this.stepRotors();

      /** @type {int32} */
      let current = letter;

      // Forward through rotors (right to left)
      current = this.encodeRotorForward(current, 2); // Right rotor
      current = this.encodeRotorForward(current, 1); // Middle rotor
      current = this.encodeRotorForward(current, 0); // Left rotor

      // Through reflector
      current = this.encodeReflector(current);

      // Backward through rotors (left to right)
      current = this.encodeRotorBackward(current, 0); // Left rotor
      current = this.encodeRotorBackward(current, 1); // Middle rotor
      current = this.encodeRotorBackward(current, 2); // Right rotor

      return current;
    }

    // Get the result of the transformation
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      /** @type {uint8[]} */
      const message = this.inputBuffer;

      // Anything the keyboard has no key for is refused by name and position,
      // and the whole message is checked before a single key is pressed so a
      // refusal does not leave the rotors part-way through it. Uppercasing the
      // message instead, as this did, both silently discarded case and could
      // change its length outright: 0xdf uppercases to "SS", which turned 256
      // bytes of input into 257 bytes of output.
      RequireLetters(message);

      // Clear input buffer for next operation
      this.inputBuffer = [];

      // Process each letter (Enigma is reciprocal, so encryption=decryption)
      /** @type {uint8[]} */
      const output = new Array(message.length);
      for (let i = 0; i < message.length; i++)
        output[i] = UPPER_A + this.encryptLetter(message[i] - UPPER_A);

      return output;
    }
  }
  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new EnigmaMachine();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { EnigmaMachine, EnigmaMachineInstance };
}));