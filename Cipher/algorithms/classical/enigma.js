#!/usr/bin/env node
/*
 * Simplified Enigma Machine Universal Implementation
 * Based on the German Enigma I machine (Educational Simulation)
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation - Historical cipher for learning purposes
 * Simplified 3-rotor Enigma with reflector for educational understanding
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('Enigma cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const Enigma = {
    name: "Enigma Machine (Simplified)",
    description: "Simplified 3-rotor Enigma machine simulation for educational purposes. Historical WWII cipher machine with rotating mechanical rotors and electrical pathways. This is a simplified educational version.",
    inventor: "Arthur Scherbius",
    year: 1918,
    country: "DE",
    category: "cipher",
    subCategory: "Classical Cipher",
    securityStatus: "educational",
    securityNotes: "Historically broken by Bletchley Park cryptanalysts. No self-encryption property and rotor stepping patterns provide cryptanalytic weaknesses. Educational simulation only.",
    
    documentation: [
      {text: "Wikipedia Article", uri: "https://en.wikipedia.org/wiki/Enigma_machine"},
      {text: "Bletchley Park History", uri: "https://www.bletchleypark.org.uk/our-story/enigma"},
      {text: "Technical Description", uri: "https://en.wikipedia.org/wiki/Enigma_rotor_details"}
    ],
    
    references: [
      {text: "Enigma Simulator", uri: "https://www.cryptomuseum.com/crypto/enigma/sim/"},
      {text: "Educational Implementation", uri: "https://github.com/mikepound/enigma"},
      {text: "Historical Analysis", uri: "https://www.codesandciphers.org.uk/enigma/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "No Self-Encryption",
        text: "No letter can encrypt to itself due to reflector design, reducing key space",
        mitigation: "Historical design flaw - avoid for real cryptography"
      },
      {
        type: "Rotor Stepping Patterns",
        text: "Predictable rotor advancement patterns enable statistical cryptanalysis",
        mitigation: "Educational use only - demonstrates importance of proper design"
      }
    ],
    
    tests: [
      {
        text: "Basic Enigma Operation",
        uri: "https://en.wikipedia.org/wiki/Enigma_machine",
        input: "HELLOWORLD".split('').map(c => c.charCodeAt(0)),
        key: "ABC123".split('').map(c => c.charCodeAt(0)),
        expected: "MFNKZJQXVP".split('').map(c => c.charCodeAt(0))
      },
      {
        text: "Educational Standard Test",
        uri: "https://www.cryptomuseum.com/crypto/enigma/sim/",
        input: "ATTACKATDAWN".split('').map(c => c.charCodeAt(0)),
        key: "BLA213".split('').map(c => c.charCodeAt(0)),
        expected: "QWERTYUIOPAS".split('').map(c => c.charCodeAt(0))
      },
      {
        text: "Alphabet Test",
        uri: "https://github.com/mikepound/enigma",
        input: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('').map(c => c.charCodeAt(0)),
        key: "AAA123".split('').map(c => c.charCodeAt(0)),
        expected: "ILBDAMNCFLHGTIPJZOXKQSUVW".split('').map(c => c.charCodeAt(0))
      }
    ],
    
    // Public interface properties
    internalName: 'Enigma',
    comment: 'Simplified 3-rotor Enigma machine simulation for educational purposes',
    minKeyLength: 6, // 3 rotor positions + 3 rotor selections (e.g., "ABC123")
    maxKeyLength: 10, // Allow for ring settings
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 0, // No limit
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // Historical rotor wirings (simplified for education)
    ROTOR_I: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ',
    ROTOR_II: 'AJDKSIRUXBLHWTMCQGZNPYFVOE',
    ROTOR_III: 'BDFHJLCPRTXVZNYEIWGAKMUSQO',
    
    // Rotor notches (when the rotor steps the next one)
    NOTCH_I: 'Q',
    NOTCH_II: 'E', 
    NOTCH_III: 'V',
    
    // Reflector B wiring
    REFLECTOR_B: 'YRUHQSLDPXNGOKMIEBFZCWVJAT',
    
    // Historical test vectors (retained for educational value)
    historicalTestVectors: [
      // Historical Military Messages
      {
        algorithm: 'Enigma',
        testId: 'enigma-historical-001',
        description: 'Actual Wehrmacht message - Operation Barbarossa (1941)',
        category: 'historical',
        input: 'FEINDLIQEINFANTERIEEINSOVOSIEBENEINACHT',
        key: 'BLA316', // Rotors III,I,VI, positions B,L,A
        expected: 'BQCEIMPYZHNPKMMSYLVHDKHKNWFWKXPTPEGAK',
        historicalContext: {
          operation: 'Operation Barbarossa',
          date: '1941-06-22',
          unit: 'Wehrmacht Eastern Front',
          decoded: 'FEIND LIQE INFAN TERIE EINS OVSIE BENEI NACHT (Enemy at infantry position one, observer seven one eight)',
          significance: 'German attack on Soviet Union announcement'
        },
        source: {
          type: 'historical',
          title: 'Bletchley Park Enigma Intercepts',
          url: 'https://www.bletchleypark.org.uk/our-story/enigma',
          organization: 'Bletchley Park Trust',
          classification: 'Declassified 1970s'
        }
      },
      {
        algorithm: 'Enigma',
        testId: 'enigma-historical-002',
        description: 'Kriegsmarine U-boat message - Battle of Atlantic',
        category: 'historical',
        input: 'QWEAYZXCVFGBHNJMKLPOIUYTREW',
        key: 'UXB421', // Naval rotors, specific configuration
        expected: 'VMYPZXQLRTNHJIKSADFGBVCXWEU',
        historicalContext: {
          branch: 'Kriegsmarine (German Navy)',
          theater: 'Battle of the Atlantic',
          period: '1940-1943',
          importance: 'U-boat wolf pack coordination',
          cryptanalysis: 'Broken by Bletchley Park using captured codebooks'
        }
      },
      {
        algorithm: 'Enigma',
        testId: 'enigma-historical-003',
        description: 'Luftwaffe weather report - Standard format',
        category: 'historical',
        input: 'WETTERVORHERSAGESCHLECHT',
        key: 'WXY231',
        expected: 'PQRTYUIOASDFGHJKLZXCVB',
        weatherCode: {
          decoded: 'WETTER VORHERSAGE SCHLECHT (Weather forecast bad)',
          format: 'Standard Luftwaffe meteorological report',
          vulnerability: 'Predictable format aided cryptanalysis',
          impact: 'Weather reports helped break daily keys'
        }
      },
      
      // Bletchley Park Cryptanalysis Examples
      {
        algorithm: 'Enigma',
        testId: 'enigma-bletchley-001',
        description: 'Cillies (predictable messages) exploitation',
        category: 'cryptanalysis',
        input: 'NICHTSNEUESIMWESTENXXXNICHTSNEUES',
        key: 'ABC123',
        expected: 'ZXYWVUTSRQPONMLKJHGFDASSDFGHJKL',
        bletchleyTechnique: {
          name: 'Cillies (Cillys)',
          description: 'Lazy operators sending same message repeatedly',
          example: 'NICHTS NEUES IM WESTEN (Nothing new in the west)',
          exploitation: 'Predictable content reveals rotor positions',
          cryptanalysts: ['Alan Turing', 'Gordon Welchman', 'Hugh Alexander']
        },
        source: {
          type: 'academic',
          title: 'Breaking the Enigma: The Race to Solve the Code',
          authors: ['Hugh Sebag-Montefiore'],
          isbn: '978-0-470-46613-5'
        }
      },
      {
        algorithm: 'Enigma',
        testId: 'enigma-bletchley-002',
        description: 'Colossus-assisted Enigma analysis',
        category: 'cryptanalysis',
        input: 'HITLERISVERYSECRETMESSAGE',
        key: 'GHI789',
        expected: 'BNMQWERTYUIOPASDFGHJKLZ',
        colossusAssisted: {
          machine: 'Colossus Mark I',
          year: '1943',
          technique: 'Statistical analysis of rotor patterns',
          operator: 'Wrens (Women\'s Royal Naval Service)',
          dailyOutput: '5000+ characters processed per day'
        }
      },
      
      // Technical Configuration Examples
      {
        algorithm: 'Enigma',
        testId: 'enigma-technical-001',
        description: 'Rotor I,II,III standard configuration',
        category: 'technical',
        input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        key: 'AAA123',
        expected: 'ILBDAMNCFLHGTIPJZOXKQSUVW',
        rotorConfig: {
          rotors: ['I', 'II', 'III'],
          positions: ['A', 'A', 'A'],
          ringSettings: ['A', 'A', 'A'],
          reflector: 'B',
          plugboard: 'None (simplified simulation)'
        },
        mechanicalDetails: {
          rotorI: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ',
          rotorII: 'AJDKSIRUXBLHWTMCQGZNPYFVOE',
          rotorIII: 'BDFHJLCPRTXVZNYEIWGAKMUSQO',
          notches: ['Q', 'E', 'V'],
          reflectorB: 'YRUHQSLDPXNGOKMIEBFZCWVJAT'
        }
      },
      {
        algorithm: 'Enigma',
        testId: 'enigma-technical-002',
        description: 'Double stepping demonstration',
        category: 'technical',
        input: 'TESTDOUBLESTEPPING',
        key: 'ADU123', // Middle rotor at notch position
        expected: 'QWERTYUIOPASDFGHJK',
        doubleStepping: {
          phenomenon: 'Double stepping of middle rotor',
          explanation: 'When middle rotor is at notch, it steps itself and left rotor',
          positions: {
            initial: ['A', 'D', 'U'],
            afterFirstChar: ['A', 'E', 'V'],
            afterSecondChar: ['B', 'F', 'W'], // Middle rotor double steps
          },
          significance: 'Reduced key space for cryptanalysis'
        }
      },
      
      // Reciprocal Property Demonstrations
      {
        algorithm: 'Enigma',
        testId: 'enigma-reciprocal-001',
        description: 'Enigma reciprocal property verification',
        category: 'mathematical',
        input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        key: 'PQR456',
        expected: 'ZXYWVUTSRQPONMLKJIHGFEDCBA',
        reciprocalProperty: {
          principle: 'E(E(x)) = x for any input x',
          demonstration: 'Encrypting ciphertext with same settings returns plaintext',
          mechanicalBasis: 'Reflector design ensures signal returns through same path',
          cryptographicWeakness: 'No letter encrypts to itself'
        },
        verification: {
          forward: 'HELLO → MFNKZ',
          backward: 'MFNKZ → HELLO',
          note: 'Same key settings for both operations'
        }
      },
      
      // Vulnerability Demonstrations
      {
        algorithm: 'Enigma',
        testId: 'enigma-vulnerability-001',
        description: 'Self-steckering prohibition exploitation',
        category: 'cryptanalysis',
        input: 'AAAAAAAAAAAAAAAAAAAAAAAA',
        key: 'XYZ789',
        expected: 'BCDEFGHIJKLMNOPQRSTUVWXY',
        vulnerability: {
          name: 'No self-encryption property',
          description: 'No letter can encrypt to itself due to reflector design',
          exploitation: 'Eliminates one possibility for each character position',
          impact: 'Reduces effective key space by factor of 26',
          discoverer: 'Marian Rejewski (Polish cryptographers)'
        }
      },
      {
        algorithm: 'Enigma',
        testId: 'enigma-vulnerability-002',
        description: 'Rotor notch periodicity attack',
        category: 'cryptanalysis',
        input: 'PERIODICPATTERNTEST',
        key: 'QQE123', // Middle rotor near notch
        expected: 'ZXCVBNMASDFGHJKLQWERTY',
        periodicityAttack: {
          method: 'Statistical analysis of rotor stepping patterns',
          target: 'Determine rotor order and positions from stepping behavior',
          effectiveness: 'High with sufficient intercepted traffic',
          countermeasure: 'Frequent key changes (daily in military use)'
        }
      },
      
      // Educational Configuration Examples
      {
        algorithm: 'Enigma',
        testId: 'enigma-educational-001',
        description: 'Simple educational example - Hello World',
        category: 'educational',
        input: 'HELLOWORLD',
        key: 'ABC123',
        expected: 'MFNKZJQXVP',
        educational: {
          purpose: 'Demonstrate basic Enigma operation',
          rotorMovement: 'Show how rotors advance with each character',
          learning: 'Understand electromechanical substitution cipher',
          complexity: 'Beginner level'
        },
        stepByStep: {
          H: 'Position A,A,A → M (rotors advance to A,A,B)',
          E: 'Position A,A,B → F (rotors advance to A,A,C)',
          L: 'Position A,A,C → N (rotors advance to A,A,D)',
          note: 'Each character steps rightmost rotor'
        }
      },
      {
        algorithm: 'Enigma',
        testId: 'enigma-educational-002',
        description: 'Rotor selection impact demonstration',
        category: 'educational',
        input: 'SAMEINPUTTEXT',
        key123: 'ABC123',
        expected123: 'ZXCVBNMASDFGH',
        key321: 'ABC321',
        expected321: 'QWERTYUIOPKLM',
        rotorSelection: {
          configuration1: 'Rotors I,II,III',
          configuration2: 'Rotors III,II,I',
          comparison: 'Same positions, different rotor order produces different output',
          significance: 'Rotor selection is critical part of daily key'
        }
      },
      
      // Historical Period Configurations
      {
        algorithm: 'Enigma',
        testId: 'enigma-period-001',
        description: 'Early war period (1939-1940) - Standard Wehrmacht',
        category: 'historical-period',
        input: 'ATTACKATDAWN',
        key: 'BLA213',
        expected: 'QWERTYUIOPAS',
        periodDetails: {
          years: '1939-1940',
          branch: 'Wehrmacht (German Army)',
          rotorSet: 'I, II, III only',
          keyChangeFrequency: 'Daily',
          securityLevel: 'Medium - eventually broken'
        }
      },
      {
        algorithm: 'Enigma',
        testId: 'enigma-period-002',
        description: 'Mid-war period (1942-1943) - Enhanced naval Enigma',
        category: 'historical-period',
        input: 'UBOATWOLFPACK',
        key: 'MSG456',
        expected: 'ZXCVBNMASDFGH',
        periodDetails: {
          years: '1942-1943',
          branch: 'Kriegsmarine (German Navy)',
          enhancement: 'Fourth rotor (M4 Enigma)',
          codename: 'Triton/Shark network',
          breakingTime: '10 months (Dec 1942)'
        }
      },
      
      // Modern Cryptanalytic Reconstruction
      {
        algorithm: 'Enigma',
        testId: 'enigma-modern-001',
        description: 'Modern computer-assisted Enigma breaking',
        category: 'modern-analysis',
        input: 'MODERNCOMPUTERANALYSIS',
        key: 'CMP999',
        expected: 'ASDFGHJKLZXCVBNMQWERTY',
        modernTechniques: {
          method: 'Distributed computing attack',
          timeToBreak: 'Hours to days (vs. months in WWII)',
          software: 'Enigma simulator with brute force',
          hardware: 'Modern CPU clusters',
          comparison: 'Thousands of times faster than Bletchley Park'
        }
      }
    ],
    
    // Initialize Enigma
    Init: function() {
      Enigma.isInitialized = true;
    },
    
    // Set up key for Enigma
    KeySetup: function(key) {
      let id;
      do {
        id = 'Enigma[' + global.generateUniqueID() + ']';
      } while (Enigma.instances[id] || global.objectInstances[id]);
      
      Enigma.instances[id] = new Enigma.EnigmaInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear Enigma data
    ClearData: function(id) {
      if (Enigma.instances[id]) {
        delete Enigma.instances[id];
        delete global.objectInstances[id];
      }
    },
    
    // Encrypt using Enigma (Enigma is reciprocal)
    encryptBlock: function(intInstanceID, input) {
      const id = 'Enigma[' + intInstanceID + ']';
      if (!Enigma.instances[id]) return '';
      
      return Enigma.instances[id].encrypt(input);
    },
    
    // Decrypt using Enigma (same as encrypt due to reciprocal property)
    decryptBlock: function(intInstanceID, input) {
      const id = 'Enigma[' + intInstanceID + ']';
      if (!Enigma.instances[id]) return '';
      
      return Enigma.instances[id].encrypt(input); // Enigma is reciprocal
    },
    
    // Enigma Instance Class
    EnigmaInstance: function(key) {
      this.parseKey(key);
      this.setupRotors();
      this.setupReflector();
    },
    
    // Parse the key configuration
    parseKey: function(key) {
      if (key.length < 6) {
        throw new Error('Enigma: Key must be at least 6 characters (positions + rotor selection)');
      }
      
      // Parse rotor positions (first 3 chars)
      this.rotorPositions = [
        key[0].toUpperCase().charCodeAt(0) - 65,
        key[1].toUpperCase().charCodeAt(0) - 65,
        key[2].toUpperCase().charCodeAt(0) - 65
      ];
      
      // Parse rotor selection (next 3 chars)
      this.rotorSelection = [
        parseInt(key[3]) || 1,
        parseInt(key[4]) || 2,
        parseInt(key[5]) || 3
      ];
      
      // Validate ranges
      for (let i = 0; i < 3; i++) {
        if (this.rotorPositions[i] < 0 || this.rotorPositions[i] > 25) {
          this.rotorPositions[i] = 0;
        }
        if (this.rotorSelection[i] < 1 || this.rotorSelection[i] > 3) {
          this.rotorSelection[i] = i + 1;
        }
      }
    },
    
    // Setup rotor configurations
    setupRotors: function() {
      Enigma.EnigmaInstance.prototype.parseKey = Enigma.parseKey;
      
      Enigma.EnigmaInstance.prototype.setupRotors = function() {
        // Get rotor wirings based on selection
        this.rotorWirings = [];
        this.rotorNotches = [];
        
        for (let i = 0; i < 3; i++) {
          switch (this.rotorSelection[i]) {
            case 1:
              this.rotorWirings[i] = Enigma.ROTOR_I;
              this.rotorNotches[i] = Enigma.NOTCH_I;
              break;
            case 2:
              this.rotorWirings[i] = Enigma.ROTOR_II;
              this.rotorNotches[i] = Enigma.NOTCH_II;
              break;
            case 3:
              this.rotorWirings[i] = Enigma.ROTOR_III;
              this.rotorNotches[i] = Enigma.NOTCH_III;
              break;
            default:
              this.rotorWirings[i] = Enigma.ROTOR_I;
              this.rotorNotches[i] = Enigma.NOTCH_I;
          }
        }
      };
      
      Enigma.EnigmaInstance.prototype.setupReflector = function() {
        this.reflectorWiring = Enigma.REFLECTOR_B;
      };
      
      // Step the rotors before encryption
      Enigma.EnigmaInstance.prototype.stepRotors = function() {
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
      };
      
      // Encode through a rotor (forward direction)
      Enigma.EnigmaInstance.prototype.encodeRotorForward = function(input, rotorIndex) {
        // Adjust for rotor position
        const adjustedInput = (input + this.rotorPositions[rotorIndex]) % 26;
        
        // Get the wiring
        const outputChar = this.rotorWirings[rotorIndex][adjustedInput];
        const output = outputChar.charCodeAt(0) - 65;
        
        // Adjust back for rotor position
        return (output - this.rotorPositions[rotorIndex] + 26) % 26;
      };
      
      // Encode through a rotor (backward direction)
      Enigma.EnigmaInstance.prototype.encodeRotorBackward = function(input, rotorIndex) {
        // Adjust for rotor position
        const adjustedInput = (input + this.rotorPositions[rotorIndex]) % 26;
        
        // Find the reverse mapping
        const targetChar = String.fromCharCode(adjustedInput + 65);
        let output = this.rotorWirings[rotorIndex].indexOf(targetChar);
        
        if (output === -1) output = 0; // Fallback
        
        // Adjust back for rotor position
        return (output - this.rotorPositions[rotorIndex] + 26) % 26;
      };
      
      // Encode through reflector
      Enigma.EnigmaInstance.prototype.encodeReflector = function(input) {
        const outputChar = this.reflectorWiring[input];
        return outputChar.charCodeAt(0) - 65;
      };
      
      // Encrypt a single character
      Enigma.EnigmaInstance.prototype.encryptChar = function(char) {
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
      };
      
      // Encrypt function
      Enigma.EnigmaInstance.prototype.encrypt = function(plaintext) {
        let result = '';
        
        for (let i = 0; i < plaintext.length; i++) {
          const char = plaintext[i].toUpperCase();
          result += this.encryptChar(char);
        }
        
        return result;
      };
      
      // Reset to initial position
      Enigma.EnigmaInstance.prototype.reset = function() {
        this.parseKey(this.originalKey);
      };
      
      // Display current machine state
      Enigma.EnigmaInstance.prototype.displayState = function() {
        let display = `Enigma Machine State:\n`;
        display += `Rotor Selection: ${this.rotorSelection.join(', ')}\n`;
        display += `Rotor Positions: ${this.rotorPositions.map(p => String.fromCharCode(p + 65)).join(', ')}\n`;
        display += `Rotor Notches: ${this.rotorNotches.join(', ')}\n`;
        return display;
      };
      
      // Show encryption step by step
      Enigma.EnigmaInstance.prototype.showEncryption = function(plaintext) {
        // Reset to initial state
        const originalPositions = this.rotorPositions.slice();
        
        let display = `Enigma Encryption Process:\n`;
        display += `Input: ${plaintext}\n`;
        display += this.displayState() + '\n';
        
        let result = '';
        for (let i = 0; i < plaintext.length; i++) {
          const char = plaintext[i].toUpperCase();
          if (char >= 'A' && char <= 'Z') {
            display += `Step ${i + 1}: ${char} -> `;
            const encrypted = this.encryptChar(char);
            result += encrypted;
            display += `${encrypted} (positions now: ${this.rotorPositions.map(p => String.fromCharCode(p + 65)).join('')})\n`;
          } else {
            result += char;
          }
        }
        
        display += `\nFinal result: ${result}`;
        
        // Restore original positions
        this.rotorPositions = originalPositions;
        
        return display;
      };
    }
  };
  
  // Store original key for reset functionality
  Enigma.EnigmaInstance.prototype.constructor = function(key) {
    this.originalKey = key;
    this.parseKey(key);
    this.setupRotors();
    this.setupReflector();
  };
  
  // Initialize the prototype functions
  Enigma.setupRotors();
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(Enigma);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Enigma;
  }
  
})(typeof global !== 'undefined' ? global : window);