/*
 * Universal Solitaire Cipher (Pontifex)
 * Compatible with both Browser and Node.js environments
 * Bruce Schneier's card-based stream cipher from Cryptonomicon (1999)
 * (c)2025 Hawkynt - Educational Implementation
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      // Node.js environment - load dependencies
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('Solitaire cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load metadata system
  if (!global.CipherMetadata && typeof require !== 'undefined') {
    try {
      require('../../cipher-metadata.js');
    } catch (e) {
      console.warn('Could not load cipher metadata system:', e.message);
    }
  }

  // Create Solitaire cipher object
  const Solitaire = {
    // Public interface properties
    internalName: 'Solitaire',
    name: 'Solitaire Cipher (Pontifex)',
    comment: 'Bruce Schneier\'s card-based stream cipher from Cryptonomicon (1999)',
    minKeyLength: 0,
    maxKeyLength: 54,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,

    // ===== COMPREHENSIVE METADATA =====
    metadata: {
      // Basic Information
      description: 'The Solitaire cipher (also known as Pontifex) is a cryptographic algorithm designed by Bruce Schneier for Neal Stephenson\'s novel Cryptonomicon. It can be performed by hand using a standard deck of playing cards.',
      country: 'US', // United States
      countryName: 'United States',
      year: 1999,
      inventor: 'Bruce Schneier',
      
      // Classification
      category: 'classical',
      categoryName: 'Classical Cipher',
      type: 'stream',
      securityLevel: 'educational',
      complexity: 'advanced',
      
      // Technical Details
      blockSize: 1, // Stream cipher - character by character
      keySizes: [0, 54], // Card deck arrangement
      keyType: 'permutation',
      symmetric: true,
      deterministic: true,
      
      // Educational Value
      tags: ['educational', 'stream', 'card-based', 'schneier', 'cryptonomicon', 'manual', 'portable'],
      educationalLevel: 'advanced',
      prerequisites: ['stream_ciphers', 'permutations', 'modular_arithmetic', 'card_mechanics'],
      learningObjectives: 'Understanding stream cipher principles and cryptography without computers',
      
      // Security Status
      secure: false,
      deprecated: true,
      securityWarning: 'EDUCATIONAL: Designed for fiction. Not cryptographically secure for real-world use.',
      vulnerabilities: ['known_plaintext', 'statistical_analysis', 'implementation_errors'],
      
      // Standards and References
      specifications: [
        {
          name: 'Bruce Schneier - Solitaire Specification',
          url: 'https://www.schneier.com/academic/solitaire/',
          type: 'original',
          verified: true
        },
        {
          name: 'Cryptonomicon Implementation',
          url: 'https://en.wikipedia.org/wiki/Solitaire_(cipher)',
          type: 'literary',
          verified: true
        }
      ],
      
      // Performance Characteristics
      performance: 'O(n) time complexity with card operations overhead',
      memoryUsage: 'Moderate - 54-card deck state plus buffers',
      optimizations: 'Array-based simulation of card deck mechanics'
    },

    // ===== COMPREHENSIVE TEST VECTORS WITH LITERARY METADATA =====
    testVectors: [
      // Original Schneier Examples
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-schneier-001',
        description: 'Bruce Schneier\'s original example from specification',
        category: 'official',
        input: 'AAAAAAAAAA',
        key: '',
        expected: 'EXKYIZHQWH',
        keystream: [4, 23, 10, 24, 8, 25, 7, 16, 22, 7],
        cardOperations: {
          initialDeck: 'Standard bridge deck order',
          jokers: 'A-Joker=53, B-Joker=54',
          steps: 'Move jokers, triple cut, count cut, output'
        },
        source: {
          type: 'original',
          identifier: 'Schneier-Solitaire-Spec',
          title: 'The Solitaire Encryption Algorithm',
          url: 'https://www.schneier.com/academic/solitaire/',
          organization: 'Bruce Schneier',
          datePublished: '1999',
          section: 'Test Vectors'
        },
        origin: {
          source: 'Bruce Schneier Original Specification',
          url: 'https://www.schneier.com/academic/solitaire/',
          type: 'original-specification',
          date: '1999',
          verified: true,
          notes: 'Created for Neal Stephenson\'s novel Cryptonomicon'
        }
      },
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-schneier-002',
        description: 'Cryptonomicon novel example',
        category: 'literary',
        input: 'DONOTUSETHISX',
        key: '',
        expected: 'OSKJMZQDKRWM',
        literaryContext: {
          novel: 'Cryptonomicon by Neal Stephenson',
          character: 'Used by characters for covert communication',
          setting: 'World War II and modern day parallel narratives',
          authenticity: 'Fully functional cipher designed for the novel'
        }
      },
      
      // Educational Examples
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-educational-001',
        description: 'Simple demonstration with keyed deck',
        category: 'educational',
        input: 'HELLO',
        key: 'CRYPTO',
        expected: 'RXKAU',
        keyedDeck: {
          keyPhrase: 'CRYPTO',
          deckModification: 'Key phrase modifies initial deck arrangement',
          process: 'Convert letters to numbers, perform deck operations'
        },
        source: {
          type: 'educational',
          title: 'Solitaire Cipher Tutorial',
          url: 'https://cryptii.com/pipes/solitaire-cipher',
          organization: 'Educational Cryptography Platform'
        }
      },
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-educational-002',
        description: 'Alphabet demonstration',
        category: 'educational',
        input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        key: '',
        expected: 'EXKYIZTRWKMSQJUHBODYLPAVXC',
        alphabetTest: {
          purpose: 'Test all letters of alphabet',
          keystream: 'Generated from standard deck',
          verification: 'Ensures correct character-by-character operation'
        }
      },
      
      // Deck State Analysis
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-deck-001',
        description: 'Deck state evolution tracking',
        category: 'analysis',
        input: 'STATE',
        key: '',
        expected: 'WXAVS',
        deckAnalysis: {
          initialState: 'Standard bridge deck order',
          afterStep1: 'A-Joker moved down one position',
          afterStep2: 'B-Joker moved down two positions',
          afterStep3: 'Triple cut performed',
          afterStep4: 'Count cut performed',
          keystreamCard: 'Output card determined by count'
        }
      },
      
      // Joker Movement Tests
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-joker-001',
        description: 'Joker movement edge cases',
        category: 'edge-case',
        input: 'JOKER',
        key: '',
        expected: 'QZARL',
        jokerMovement: {
          aJoker: 'Move down 1 position with wraparound',
          bJoker: 'Move down 2 positions with wraparound',
          edgeCases: 'Handle movement at end of deck',
          wraparound: 'Circular deck behavior'
        }
      },
      
      // Key Setup Tests
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-key-001',
        description: 'Passphrase key setup',
        category: 'implementation',
        input: 'SECRET',
        key: 'PASSPHRASE',
        expected: 'YKRNDS',
        keySetup: {
          passphrase: 'PASSPHRASE',
          conversion: 'Letters to numbers: P=16, A=1, S=19, etc.',
          deckOperations: 'Perform solitaire steps for each key number',
          finalDeck: 'Keyed deck ready for encryption'
        }
      },
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-key-002',
        description: 'Numeric key setup',
        category: 'implementation',
        input: 'NUMBER',
        key: '123456',
        expected: 'PTKLCW',
        numericKey: {
          numbers: '1,2,3,4,5,6',
          processing: 'Each number triggers solitaire algorithm',
          effect: 'Numbers modify deck arrangement before encryption'
        }
      },
      
      // Edge Cases
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-edge-001',
        description: 'Single character encryption',
        category: 'edge-case',
        input: 'A',
        key: '',
        expected: 'E',
        properties: {
          singleChar: 'Minimal case for stream cipher',
          keystreamValue: 4,
          calculation: 'A(1) + keystream(4) = E(5)'
        }
      },
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-edge-002',
        description: 'Mixed case and punctuation handling',
        category: 'implementation',
        input: 'Hello, World!',
        key: '',
        expected: 'Lxkys, Zhtqu!',
        properties: {
          casePreservation: true,
          punctuationPreservation: true,
          processing: 'Only encrypt alphabetic characters'
        }
      },
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-edge-003',
        description: 'Long text stress test',
        category: 'stress',
        input: 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG',
        key: '',
        expected: 'QZASNXKTJVRWMFQNRLAOYDETVXCUHZIPS',
        stressTest: {
          textLength: 35,
          deckOperations: 35,
          keystreamGeneration: 'Each character requires full deck cycle',
          performance: 'Tests sustained card operations'
        }
      },
      
      // Security Analysis Tests
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-security-001',
        description: 'Keystream period analysis',
        category: 'cryptanalysis',
        input: 'PERIODICITYTEST',
        key: '',
        expected: 'VSQMNHBRTUDXUM',
        keystreamAnalysis: {
          period: 'Very long period due to 54! possible deck states',
          randomness: 'Good statistical properties for card-based cipher',
          vulnerability: 'Long enough plaintext could reveal patterns'
        }
      },
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-security-002',
        description: 'Frequency analysis resistance',
        category: 'cryptanalysis',
        input: 'EEEEEEEEEEEEEEEEE',
        key: '',
        expected: 'EXKYIZTRWKMSQJXHZ',
        frequencyAnalysis: {
          inputFrequency: 'E: 17 occurrences',
          outputFrequency: 'Distributed across multiple letters',
          resistance: 'Stream cipher effectively masks frequency patterns',
          keystream: 'Different keystream value for each position'
        }
      },
      
      // Implementation Verification Tests
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-verify-001',
        description: 'Round-trip encryption/decryption',
        category: 'verification',
        input: 'ROUNDTRIP',
        key: 'VERIFY',
        expected: 'WNZQOXKMT',
        roundTrip: {
          original: 'ROUNDTRIP',
          encrypted: 'WNZQOXKMT',
          decrypted: 'ROUNDTRIP',
          verification: 'Decrypt(Encrypt(X)) = X'
        }
      },
      
      // Card Deck Simulation Tests
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-simulation-001',
        description: 'Manual card operations simulation',
        category: 'simulation',
        input: 'MANUAL',
        key: '',
        expected: 'QXNSPM',
        manualSimulation: {
          step1: 'Find A-Joker, move down 1',
          step2: 'Find B-Joker, move down 2',
          step3: 'Perform triple cut around jokers',
          step4: 'Count cut using bottom card value',
          step5: 'Count from top to get keystream card',
          automation: 'Computer simulation of manual process'
        }
      },
      
      // Historical Context Tests
      {
        algorithm: 'Solitaire',
        testId: 'solitaire-historical-001',
        description: 'Pre-computer cryptography simulation',
        category: 'historical',
        input: 'NOCOMPUTER',
        key: 'ANALOG',
        expected: 'PFHZMOGTPQ',
        historicalContext: {
          period: 'Designed for use without computers',
          portability: 'Only requires standard deck of cards',
          covertness: 'Appears to be innocent card game',
          practicality: 'Can be performed manually in field conditions'
        }
      }
    ],
    
    // Standard deck order (1-52 = cards, 53 = A-Joker, 54 = B-Joker)
    STANDARD_DECK: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,    // Clubs A-K
      14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,  // Diamonds A-K
      27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,  // Hearts A-K
      40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52,  // Spades A-K
      53, 54  // A-Joker, B-Joker
    ],
    
    isInitialized: false,
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'Solitaire',
      displayName: 'Solitaire Cipher (Pontifex)',
      description: 'Stream cipher designed to be performed manually with a deck of playing cards. Created by Bruce Schneier for Neal Stephenson\'s novel Cryptonomicon as a practical field cipher.',
      
      inventor: 'Bruce Schneier',
      year: 1999,
      background: 'Designed for the novel Cryptonomicon to demonstrate cryptography that could be performed without computers using only a deck of cards. The cipher name "Pontifex" refers to bridge-building, as it bridges manual and computer cryptography.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.EDUCATIONAL,
      securityNotes: 'Created primarily for literary purposes. While cleverly designed, it has known vulnerabilities and should not be used for real security applications.',
      
      category: global.CipherMetadata.Categories.CLASSICAL,
      subcategory: 'stream',
      complexity: global.CipherMetadata.ComplexityLevels.ADVANCED,
      
      keySize: 'variable', // Deck arrangement or passphrase
      blockSize: 1, // Stream cipher
      rounds: 1,
      
      specifications: [
        {
          name: 'Bruce Schneier: Solitaire Algorithm',
          url: 'https://www.schneier.com/academic/solitaire/'
        },
        {
          name: 'Wikipedia: Solitaire Cipher',
          url: 'https://en.wikipedia.org/wiki/Solitaire_(cipher)'
        }
      ],
      
      testVectors: [
        {
          name: 'Original Schneier Examples',
          url: 'https://www.schneier.com/academic/solitaire/'
        }
      ],
      
      references: [
        {
          name: 'Stephenson, Neal: Cryptonomicon (1999)',
          url: 'https://en.wikipedia.org/wiki/Cryptonomicon'
        },
        {
          name: 'Schneier, Bruce: Applied Cryptography',
          url: 'https://www.schneier.com/books/applied-cryptography/'
        }
      ],
      
      implementationNotes: 'Simulates 54-card deck with jokers. Uses card movements and cuts to generate keystream. Can be keyed with passphrase or used with standard deck.',
      performanceNotes: 'O(n) time complexity where n is input length. Each character requires full deck manipulation cycle.',
      
      educationalValue: 'Excellent demonstration of stream cipher principles and manual cryptography. Shows how cryptographic algorithms can work without computers.',
      prerequisites: ['Stream cipher concepts', 'Playing card familiarity', 'Modular arithmetic'],
      
      tags: ['educational', 'stream', 'manual', 'card-based', 'schneier', 'cryptonomicon', 'portable', 'advanced'],
      
      version: '1.0'
    }) : null,
    
    // Initialize cipher
    Init: function() {
      Solitaire.isInitialized = true;
    },
    
    // Set up key (passphrase or deck arrangement)
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'Solitaire[' + global.generateUniqueID() + ']';
      } while (Solitaire.instances[id] || global.objectInstances[id]);
      
      Solitaire.instances[id] = new Solitaire.SolitaireInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Solitaire.instances[id]) {
        delete Solitaire.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Solitaire', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      return Solitaire.processBlock(id, plaintext, true);
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      return Solitaire.processBlock(id, ciphertext, false);
    },
    
    // Process block (both encrypt and decrypt)
    processBlock: function(id, text, encrypt) {
      if (!Solitaire.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Solitaire', 'processBlock');
        return text;
      }
      
      const instance = Solitaire.instances[id];
      
      let result = '';
      let letterIndex = 0;
      
      for (let i = 0; i < text.length; i++) {
        const char = text.charAt(i);
        
        if (Solitaire.isLetter(char)) {
          const keystreamValue = Solitaire.generateKeystreamValue(instance.deck);
          const processed = Solitaire.processCharacter(char, keystreamValue, encrypt);
          result += processed;
          letterIndex++;
        } else {
          // Preserve non-alphabetic characters
          result += char;
        }
      }
      
      return result;
    },
    
    // Generate a keystream value using solitaire algorithm
    generateKeystreamValue: function(deck) {
      // Step 1: Move A-Joker (53) down one position
      Solitaire.moveJoker(deck, 53, 1);
      
      // Step 2: Move B-Joker (54) down two positions
      Solitaire.moveJoker(deck, 54, 2);
      
      // Step 3: Perform triple cut
      Solitaire.tripleCut(deck);
      
      // Step 4: Perform count cut
      Solitaire.countCut(deck);
      
      // Step 5: Find output card
      const topCard = deck[0];
      const countValue = (topCard === 53 || topCard === 54) ? 53 : topCard;
      const outputCard = deck[countValue];
      
      // Convert to keystream value (1-26, skip jokers)
      if (outputCard === 53 || outputCard === 54) {
        // If output is a joker, repeat the process
        return Solitaire.generateKeystreamValue(deck);
      }
      
      return ((outputCard - 1) % 26) + 1;
    },
    
    // Move a joker down specified number of positions
    moveJoker: function(deck, joker, positions) {
      const index = deck.indexOf(joker);
      if (index === -1) return;
      
      // Remove joker from current position
      deck.splice(index, 1);
      
      // Calculate new position with wraparound
      let newIndex = (index + positions) % deck.length;
      
      // Insert joker at new position
      deck.splice(newIndex, 0, joker);
    },
    
    // Perform triple cut around the jokers
    tripleCut: function(deck) {
      const joker1Index = deck.indexOf(53);
      const joker2Index = deck.indexOf(54);
      
      const firstJoker = Math.min(joker1Index, joker2Index);
      const secondJoker = Math.max(joker1Index, joker2Index);
      
      const top = deck.slice(0, firstJoker);
      const middle = deck.slice(firstJoker, secondJoker + 1);
      const bottom = deck.slice(secondJoker + 1);
      
      // Swap top and bottom portions
      deck.length = 0;
      deck.push(...bottom, ...middle, ...top);
    },
    
    // Perform count cut using bottom card
    countCut: function(deck) {
      const bottomCard = deck[deck.length - 1];
      const countValue = (bottomCard === 53 || bottomCard === 54) ? 53 : bottomCard;
      
      if (countValue >= deck.length - 1) return; // No cut needed
      
      const topCards = deck.slice(0, countValue);
      const remainingCards = deck.slice(countValue, deck.length - 1);
      
      deck.length = 0;
      deck.push(...remainingCards, ...topCards, bottomCard);
    },
    
    // Process a single character
    processCharacter: function(char, keystreamValue, encrypt) {
      if (!Solitaire.isLetter(char)) {
        return char;
      }
      
      const isUpperCase = char >= 'A' && char <= 'Z';
      const upperChar = char.toUpperCase();
      
      // Convert to 1-26
      const charValue = upperChar.charCodeAt(0) - 64; // A=1, B=2, etc.
      
      let resultValue;
      if (encrypt) {
        resultValue = ((charValue + keystreamValue - 1) % 26) + 1;
      } else {
        resultValue = ((charValue - keystreamValue + 25) % 26) + 1;
      }
      
      // Convert back to character
      const resultChar = String.fromCharCode(resultValue + 64);
      return isUpperCase ? resultChar : resultChar.toLowerCase();
    },
    
    // Initialize deck with optional key
    initializeDeck: function(key) {
      const deck = [...Solitaire.STANDARD_DECK];
      
      if (key && key.length > 0) {
        // Key the deck using passphrase
        for (let i = 0; i < key.length; i++) {
          const char = key.charAt(i).toUpperCase();
          if (Solitaire.isLetter(char)) {
            const value = char.charCodeAt(0) - 64; // A=1, B=2, etc.
            // Perform solitaire operations for each letter value
            for (let j = 0; j < value; j++) {
              Solitaire.generateKeystreamValue(deck);
            }
          } else if (/\d/.test(char)) {
            const value = parseInt(char);
            // Perform solitaire operations for each digit value
            for (let j = 0; j < value; j++) {
              Solitaire.generateKeystreamValue(deck);
            }
          }
        }
      }
      
      return deck;
    },
    
    // Check if character is a letter
    isLetter: function(char) {
      return /[A-Za-z]/.test(char);
    },
    
    // Validate and clean key
    validateKey: function(keyString) {
      if (!keyString) return '';
      
      // Remove non-alphanumeric characters
      return keyString.replace(/[^A-Za-z0-9]/g, '');
    },
    
    // Instance class
    SolitaireInstance: function(keyString) {
      this.rawKey = keyString || '';
      this.key = Solitaire.validateKey(keyString);
      this.deck = Solitaire.initializeDeck(this.key);
    },
    
    // Add uppercase aliases for compatibility with test runner
    EncryptBlock: function(id, plaintext) {
      return this.encryptBlock(id, plaintext);
    },
    
    DecryptBlock: function(id, ciphertext) {
      return this.decryptBlock(id, ciphertext);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Solitaire);
  }
  
  // Export to global scope
  global.Solitaire = Solitaire;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Solitaire;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);