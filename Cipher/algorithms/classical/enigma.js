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

  // ===== ALGORITHM IMPLEMENTATION =====

  class EnigmaMachine extends CryptoAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Enigma Machine";
      this.description = "Simplified 3-rotor Enigma machine simulation for educational purposes. Historical WWII cipher machine with rotating mechanical rotors and electrical pathways. Uses reciprocal substitution through rotor wirings and reflector.";
      this.inventor = "Arthur Scherbius";
      this.year = 1918;
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Classical Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.DE;

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
    CreateInstance(isInverse = false) {
      return new EnigmaMachineInstance(this, isInverse);
    }
  }

  // Instance class - handles the actual encryption/decryption
  class EnigmaMachineInstance extends IAlgorithmInstance {
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

    // Encrypt a single character
    encryptChar(char) {
      if (char < 'A' || char > 'Z') {
        return char; // Non-alphabetic characters pass through
      }

      // Step rotors before encryption
      this.stepRotors();

      // Convert to number
      let current = char.charCodeAt(0) - 65;

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

      // Convert back to character
      return String.fromCharCode(current + 65);
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
      const normalizedInput = inputStr.toUpperCase();

      // Process each character (Enigma is reciprocal, so encryption=decryption)
      for (let i = 0; i < normalizedInput.length; i++) {
        const char = normalizedInput[i];
        const encryptedChar = this.encryptChar(char);
        output.push(encryptedChar.charCodeAt(0));
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

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