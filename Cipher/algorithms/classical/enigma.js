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

  const UPPER_A = 65, UPPER_Z = 90;

  /**
   * Printable stand-in for a byte, for use in an error message.
   * @param {number} byte - Offending byte
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
      const byte = message[i];
      if (byte < UPPER_A || byte > UPPER_Z)
        throw new Error(`EnigmaMachineInstance.Result: byte 0x${byte.toString(16).padStart(2, '0')}`
          + ` ('${DescribeByte(byte)}') at position ${i} is not one of the 26 letters A-Z`
          + ' the machine has keys for');
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
        {
          type: "No Self-Encryption",
          text: "No letter can encrypt to itself due to reflector design, reducing key space",
          uri: "https://en.wikipedia.org/wiki/Enigma_machine#Reflector",
          mitigation: "Historical design flaw - avoid for real cryptography"
        },
        {
          type: "Rotor Stepping Patterns",
          text: "Predictable rotor advancement patterns enable statistical cryptanalysis",
          uri: "https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma",
          mitigation: "Educational use only - demonstrates importance of proper design"
        }
      ];

      // Test vectors using byte arrays - bit-perfect results from implementation
      this.tests = [
        {
          text: "Basic Enigma Operation",
          uri: "https://en.wikipedia.org/wiki/Enigma_machine",
          input: OpCodes.AnsiToBytes("HELLOWORLD"),
          key: OpCodes.AnsiToBytes("ABC123"),
          expected: OpCodes.AnsiToBytes("ROMULLBIBB")
        }
      ];

      // For the test suite compatibility 
      this.testVectors = this.tests;
    }

    // Create instance for this algorithm
    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
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
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // Historical rotor wirings (simplified for education)
      this.ROTOR_I = 'EKMFLGDQVZNTOWYHXUSPAIBRCJ';
      this.ROTOR_II = 'AJDKSIRUXBLHWTMCQGZNPYFVOE';
      this.ROTOR_III = 'BDFHJLCPRTXVZNYEIWGAKMUSQO';

      // Rotor notches (when the rotor steps the next one)
      this.NOTCH_I = 'Q';
      this.NOTCH_II = 'E'; 
      this.NOTCH_III = 'V';

      // Reflector B wiring
      this.REFLECTOR_B = 'YRUHQSLDPXNGOKMIEBFZCWVJAT';

      // Initialize with default configuration
      this.rotorPositions = [0, 0, 0]; // A, A, A
      this.rotorSelection = [1, 2, 3]; // I, II, III
      this.rotorWirings = [];
      this.rotorNotches = [];
      this.reflectorWiring = this.REFLECTOR_B;

      this.setupRotors();
    }

    // Property setter for key
    set key(keyData) {
      if (!keyData || keyData.length < 6) {
        this.parseKey("ABC123"); // Default key
      } else {
        const keyStr = String.fromCharCode.apply(null, keyData);
        this.parseKey(keyStr);
      }
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this.rotorPositions.map(p => String.fromCharCode(p + 65)).join('') + 
             this.rotorSelection.join('');
    }

    // Parse the key configuration
    parseKey(keyStr) {
      const key = keyStr.toUpperCase();

      // Parse rotor positions (first 3 chars)
      this.rotorPositions = [
        Math.max(0, Math.min(25, (key.charCodeAt(0) || 65) - 65)),
        Math.max(0, Math.min(25, (key.charCodeAt(1) || 65) - 65)),
        Math.max(0, Math.min(25, (key.charCodeAt(2) || 65) - 65))
      ];

      // Parse rotor selection (next 3 chars)
      this.rotorSelection = [
        Math.max(1, Math.min(3, parseInt(key[3]) || 1)),
        Math.max(1, Math.min(3, parseInt(key[4]) || 2)),
        Math.max(1, Math.min(3, parseInt(key[5]) || 3))
      ];

      this.setupRotors();
    }

    // Setup rotor configurations
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

    // Step the rotors before encryption
    stepRotors() {
      // Double stepping mechanism (simplified)
      let step = [false, false, false];

      // Always step the rightmost rotor
      step[2] = true;

      // Check for notch positions to step middle rotor
      const middleNotchPosition = this.rotorNotches[1].charCodeAt(0) - 65;
      if (this.rotorPositions[1] === middleNotchPosition) {
        step[1] = true;
        step[0] = true; // Double stepping
      }

      // Check for notch positions to step left rotor
      const leftNotchPosition = this.rotorNotches[0].charCodeAt(0) - 65;
      if (this.rotorPositions[0] === leftNotchPosition) {
        step[0] = true;
      }

      // Apply stepping
      for (let i = 0; i < 3; i++) {
        if (step[i]) {
          this.rotorPositions[i] = (this.rotorPositions[i] + 1) % 26;
        }
      }
    }

    // Encode through a rotor (forward direction)
    encodeRotorForward(input, rotorIndex) {
      // Adjust for rotor position
      const adjustedInput = (input + this.rotorPositions[rotorIndex]) % 26;

      // Get the wiring
      const outputChar = this.rotorWirings[rotorIndex][adjustedInput];
      const output = outputChar.charCodeAt(0) - 65;

      // Adjust back for rotor position
      return (output - this.rotorPositions[rotorIndex] + 26) % 26;
    }

    // Encode through a rotor (backward direction)
    encodeRotorBackward(input, rotorIndex) {
      // Adjust for rotor position
      const adjustedInput = (input + this.rotorPositions[rotorIndex]) % 26;

      // Find the reverse mapping
      const targetChar = String.fromCharCode(adjustedInput + 65);
      let output = this.rotorWirings[rotorIndex].indexOf(targetChar);

      if (output === -1) output = 0; // Fallback

      // Adjust back for rotor position
      return (output - this.rotorPositions[rotorIndex] + 26) % 26;
    }

    // Encode through reflector
    encodeReflector(input) {
      const outputChar = this.reflectorWiring[input];
      return outputChar.charCodeAt(0) - 65;
    }

    // Encrypt a single letter, given as its 0-25 position in the alphabet
    encryptLetter(letter) {
      // Step rotors before encryption
      this.stepRotors();

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

    // Feed data to the cipher

    // Get the result of the transformation
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.inputBuffer.length === 0) {
        return [];
      }

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