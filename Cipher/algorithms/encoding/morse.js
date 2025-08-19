#!/usr/bin/env node
/*
 * Universal Morse Code Encoder/Decoder
 * Based on International Telegraph Alphabet No. 2 (ITA2) and ITU-R M.1677-1
 * Compatible with both Browser and Node.js environments
 * 
 * Morse code is a method of transmitting text information as a series
 * of on-off tones, lights, or clicks using standardized sequences of
 * short and long signals called "dots" and "dashes".
 * 
 * References:
 * - ITU-R M.1677-1: International Morse Code
 * - ITA2 International Telegraph Alphabet No. 2
 * 
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
      return;
    }
  }
  
  if (!global.Cipher && typeof require !== 'undefined') {
    try {
      require('../../universal-cipher-env.js');
      require('../../cipher.js');
    } catch (e) {
      console.error('Failed to load cipher dependencies:', e.message);
      return;
    }
  }
  
  const MorseCode = {
    // Required metadata per CONTRIBUTING.md
    name: "Morse Code (International)",
    description: "Method of transmitting text information as a series of on-off tones, lights, or clicks using standardized sequences of short and long signals called dots and dashes. Based on International Telegraph Union standards for global compatibility.",
    inventor: "Samuel Morse",
    year: 1836,
    country: "US",
    category: "encodingScheme",
    subCategory: "Text Encoding",
    securityStatus: "educational",
    securityNotes: "Not encryption - text encoding only. Easily decoded. For educational purposes and basic communication.",
    
    documentation: [
      {text: "ITU-R M.1677-1: International Morse Code", uri: "https://www.itu.int/dms_pubrec/itu-r/rec/m/R-REC-M.1677-1-200910-I!!PDF-E.pdf"},
      {text: "Morse Code - Wikipedia", uri: "https://en.wikipedia.org/wiki/Morse_code"},
      {text: "International Telegraph Alphabet", uri: "https://en.wikipedia.org/wiki/Telegraph_code"}
    ],
    
    references: [
      {text: "GNU Radio Morse Code Implementation", uri: "https://github.com/gnuradio/gnuradio/tree/master/gr-digital/lib"},
      {text: "Ham Radio Morse Code Standards", uri: "https://www.arrl.org/morse-code"},
      {text: "Educational Morse Code Examples", uri: "https://morsecode.world/international/morse.html"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "Basic alphabet encoding test",
        uri: "https://en.wikipedia.org/wiki/Morse_code#Letters",
        input: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("HELLO") : "HELLO".split('').map(c => c.charCodeAt(0)),
        expected: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes(".... . .-.. .-.. ---") : ".... . .-.. .-.. ---".split('').map(c => c.charCodeAt(0))
      },
      {
        text: "Numbers and punctuation test",
        uri: "ITU-R M.1677-1 standard",
        input: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("SOS") : "SOS".split('').map(c => c.charCodeAt(0)),
        expected: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("... --- ...") : "... --- ...".split('').map(c => c.charCodeAt(0))
      },
      {
        text: "Mixed case and space test",
        uri: "Educational standard",
        input: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes("Hello World") : "Hello World".split('').map(c => c.charCodeAt(0)),
        expected: (typeof ANSIToBytes !== 'undefined') ? ANSIToBytes(".... . .-.. .-.. ---  /  .-- --- .-. .-.. -..") : ".... . .-.. .-.. ---  /  .-- --- .-. .-.. -..".split('').map(c => c.charCodeAt(0))
      }
    ],

    // Legacy interface properties for compatibility
    internalName: 'morse',
    version: '1.0.0',
    comment: 'Educational implementation for learning purposes',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,

    
    // International Morse Code alphabet (ITU-R M.1677-1)
    morseTable: {
      // Letters
      'A': '.-',    'B': '-...',  'C': '-.-.',  'D': '-..',   'E': '.',
      'F': '..-.',  'G': '--.',   'H': '....',  'I': '..',    'J': '.---',
      'K': '-.-',   'L': '.-..',  'M': '--',    'N': '-.',    'O': '---',
      'P': '.--.',  'Q': '--.-',  'R': '.-.',   'S': '...',   'T': '-',
      'U': '..-',   'V': '...-',  'W': '.--',   'X': '-..-',  'Y': '-.--',
      'Z': '--..',
      
      // Numbers
      '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
      '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
      
      // Punctuation
      '.': '.-.-.-',  ',': '--..--',  '?': '..--..',  '\'': '.----.',
      '!': '-.-.--',  '/': '-..-.',   '(': '-.--.',   ')': '-.--.-',
      '&': '.-...',   ':': '---...',  ';': '-.-.-.',  '=': '-...-',
      '+': '.-.-.',   '-': '-....-',  '_': '..--.-',  '"': '.-..-.',
      '$': '...-..-', '@': '.--.-.',  ' ': '/',       
      
      // Prosigns (procedural signals)
      '<AR>': '.-.-.',    // End of message
      '<AS>': '.-...',    // Wait
      '<BT>': '-...-',    // Break
      '<CT>': '-.-.-',    // Starting signal
      '<KA>': '-.-.-',    // Attention
      '<KN>': '-.--.',    // Go ahead
      '<SK>': '...-.-',   // End of work
      '<SN>': '...-.',    // Understood
      '<SOS>': '...---...' // Distress signal
    },
    
    // Reverse lookup table
    reverseTable: null,
    
    // Timing parameters (relative units)
    dotLength: 1,
    dashLength: 3,
    elementGap: 1,     // Gap between dots/dashes in same letter
    letterGap: 3,      // Gap between letters
    wordGap: 7,        // Gap between words
    
    /**
     * Initialize the cipher and build reverse lookup table
     */
    Init: function() {
      // Build reverse lookup table
      this.reverseTable = {};
      for (const [char, morse] of Object.entries(this.morseTable)) {
        this.reverseTable[morse] = char;
      }
    },
    
    /**
     * Set up encoding parameters
     * @param {Object} key - Configuration: {format: 'text'|'binary', timing: {...}}
     */
    KeySetup: function(key) {
      this.Init(); // Ensure tables are built
      
      if (typeof key === 'object' && key !== null) {
        // Update timing if provided
        if (key.timing) {
          this.dotLength = key.timing.dotLength || 1;
          this.dashLength = key.timing.dashLength || 3;
          this.elementGap = key.timing.elementGap || 1;
          this.letterGap = key.timing.letterGap || 3;
          this.wordGap = key.timing.wordGap || 7;
        }
      }
    },
    
    /**
     * Encode text to Morse code
     * @param {number} mode - Encoding mode (0 = encode)
     * @param {string} data - Input text to encode
     * @returns {string} Morse code representation
     */
    encryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('Morse: Invalid mode for encoding');
      }
      
      if (typeof data !== 'string') {
        throw new Error('Morse: Input must be a string');
      }
      
      if (data.length === 0) {
        return '';
      }
      
      const upperData = data.toUpperCase();
      const morseWords = [];
      
      // Split into words
      const words = upperData.split(/\\s+/);
      
      for (const word of words) {
        const morseLetters = [];
        
        for (let i = 0; i < word.length; i++) {
          const char = word[i];
          const morseChar = this.morseTable[char];
          
          if (morseChar) {
            morseLetters.push(morseChar);
          } else {
            // Unknown character - represent as question mark
            morseLetters.push(this.morseTable['?']);
          }
        }
        
        morseWords.push(morseLetters.join(' '));
      }
      
      return morseWords.join('  /  ');
    },
    
    /**
     * Decode Morse code to text
     * @param {number} mode - Decoding mode (0 = decode)
     * @param {string} data - Morse code to decode
     * @returns {string} Decoded text
     */
    decryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('Morse: Invalid mode for decoding');
      }
      
      if (typeof data !== 'string' || data.length === 0) {
        return '';
      }
      
      // Ensure reverse table is built
      if (!this.reverseTable) {
        this.Init();
      }
      
      // Clean up input - normalize spaces and separators
      let cleanData = data.trim()
        .replace(/\s*\/\s*/g, ' / ')  // Normalize word separators
        .replace(/\s+/g, ' ')          // Normalize multiple spaces
        .replace(/[^.\-\s/]/g, '');     // Remove invalid characters
      
      // Split by word separators
      const morseWords = cleanData.split(' / ');
      const decodedWords = [];
      
      for (const morseWord of morseWords) {
        if (morseWord.trim().length === 0) continue;
        
        // Split by letter separators (single space)
        const morseLetters = morseWord.trim().split(' ');
        const decodedLetters = [];
        
        for (const morseLetter of morseLetters) {
          if (morseLetter.length === 0) continue;
          
          const decodedChar = this.reverseTable[morseLetter];
          if (decodedChar) {
            decodedLetters.push(decodedChar);
          } else {
            // Unknown Morse pattern
            decodedLetters.push('?');
          }
        }
        
        decodedWords.push(decodedLetters.join(''));
      }
      
      return decodedWords.join(' ');
    },
    
    /**
     * Convert Morse to binary timing representation
     * @param {string} morseText - Morse code text
     * @returns {Array} Binary timing array (1 = signal, 0 = silence)
     */
    toBinary: function(morseText) {
      const binary = [];
      const words = morseText.split('  /  ');
      
      for (let w = 0; w < words.length; w++) {
        const letters = words[w].split(' ');
        
        for (let l = 0; l < letters.length; l++) {
          const letter = letters[l];
          
          for (let e = 0; e < letter.length; e++) {
            const element = letter[e];
            
            if (element === '.') {
              // Dot: signal for dot length
              for (let i = 0; i < this.dotLength; i++) {
                binary.push(1);
              }
            } else if (element === '-') {
              // Dash: signal for dash length
              for (let i = 0; i < this.dashLength; i++) {
                binary.push(1);
              }
            }
            
            // Element gap (except after last element in letter)
            if (e < letter.length - 1) {
              for (let i = 0; i < this.elementGap; i++) {
                binary.push(0);
              }
            }
          }
          
          // Letter gap (except after last letter in word)
          if (l < letters.length - 1) {
            for (let i = 0; i < this.letterGap; i++) {
              binary.push(0);
            }
          }
        }
        
        // Word gap (except after last word)
        if (w < words.length - 1) {
          for (let i = 0; i < this.wordGap; i++) {
            binary.push(0);
          }
        }
      }
      
      return binary;
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      // Reset timing to defaults
      this.dotLength = 1;
      this.dashLength = 3;
      this.elementGap = 1;
      this.letterGap = 3;
      this.wordGap = 7;
    },
    
    /**
     * Get cipher information
     * @returns {Object} Cipher information
     */
    GetInfo: function() {
      return {
        name: this.name,
        version: this.version,
        type: 'Encoding',
        blockSize: 'Variable',
        keySize: 'Timing parameters',
        description: 'International Morse Code (ITU-R M.1677-1)',
        standard: 'ITU-R M.1677-1',
        characters: Object.keys(this.morseTable).length,
        inventor: 'Samuel Morse (1830s)',
        features: ['Letters', 'Numbers', 'Punctuation', 'Prosigns', 'Binary timing']
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(MorseCode);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MorseCode;
  }
  
  // Make available globally
  global.MorseCode = MorseCode;
  
})(typeof global !== 'undefined' ? global : window);