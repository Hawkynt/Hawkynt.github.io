#!/usr/bin/env node
/*
 * Universal Baudot Code Encoder/Decoder
 * Based on International Telegraph Alphabet No. 2 (ITA2/CCITT-2)
 * Compatible with both Browser and Node.js environments
 * 
 * Baudot code is a 5-bit character encoding used in early teleprinters
 * and telegraph systems. It uses two modes: LETTERS and FIGURES, selected
 * by special shift characters.
 * 
 * References:
 * - ITU-T Recommendation F.1: Operational provisions for the international
 *   public telegram service
 * - CCITT-2 (ITA2): International Telegraph Alphabet No. 2
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
  
  const BaudotCode = {
    internalName: 'baudot',
    name: 'Baudot Code (ITA2)',
    version: '1.0.0',
    description: 'Educational implementation for learning purposes',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,

    
    // ITA2 character sets - indexed by 5-bit value (0-31)
    lettersSet: [
      '\\0',  'E',  '\\n', 'A',  ' ',  'S',  'I',  'U',    // 00-07
      '\\r', 'D',  'R',   'J',  'N',  'F',  'C',  'K',    // 08-15
      'T',   'Z',  'L',   'W',  'H',  'Y',  'P',  'Q',    // 16-23
      'O',   'B',  'G',   'FIG', 'M', 'X',  'V',  'LET'   // 24-31
    ],
    
    figuresSet: [
      '\\0',  '3',  '\\n', '-',  ' ',  "'", '8',  '7',    // 00-07
      '\\r', '$',  '4',   ',', '.',  '!',  ':',  '(',    // 08-15
      '5',   '+',  ')',   '2',  '#',  '6',  '0',  '1',    // 16-23
      '9',   '?',  '&',   'FIG', '.',  '/',  ';',  'LET'   // 24-31
    ],
    
    // Reverse lookup tables
    lettersToCode: null,
    figuresToCode: null,
    
    // Special control codes
    LTRS: 31,  // Letters shift (code 31)
    FIGS: 27,  // Figures shift (code 27)
    
    /**
     * Initialize the cipher and build lookup tables
     */
    Init: function() {
      // Build reverse lookup tables
      this.lettersToCode = {};
      this.figuresToCode = {};
      
      for (let i = 0; i < 32; i++) {
        const letter = this.lettersSet[i];
        const figure = this.figuresSet[i];
        
        if (letter && letter !== 'LET' && letter !== 'FIG') {
          this.lettersToCode[letter] = i;
        }
        
        if (figure && figure !== 'LET' && figure !== 'FIG') {
          this.figuresToCode[figure] = i;
        }
      }
    },
    
    /**
     * Set up encoding parameters
     * @param {Object} key - Configuration options
     */
    KeySetup: function(key) {
      this.Init(); // Ensure lookup tables are built
    },
    
    /**
     * Encode text to Baudot code
     * @param {number} mode - Encoding mode (0 = encode to binary, 1 = encode to text)
     * @param {string} data - Input text to encode
     * @returns {Array|string} Baudot code as bit array or formatted string
     */
    encryptBlock: function(mode, data) {
      if (typeof data !== 'string') {
        throw new Error('Baudot: Input must be a string');
      }
      
      if (data.length === 0) {
        return mode === 0 ? [] : '';
      }
      
      const codes = [];
      let currentMode = 'LETTERS';  // Start in letters mode
      
      for (let i = 0; i < data.length; i++) {
        const char = data[i].toUpperCase();
        let code = null;
        let requiredMode = null;
        
        // Determine which mode the character belongs to
        if (this.lettersToCode.hasOwnProperty(char)) {
          code = this.lettersToCode[char];
          requiredMode = 'LETTERS';
        } else if (this.figuresToCode.hasOwnProperty(char)) {
          code = this.figuresToCode[char];
          requiredMode = 'FIGURES';
        } else {
          // Unknown character - skip or use space
          continue;
        }
        
        // Switch modes if necessary
        if (requiredMode !== currentMode) {
          if (requiredMode === 'LETTERS') {
            codes.push(this.LTRS);
          } else {
            codes.push(this.FIGS);
          }
          currentMode = requiredMode;
        }
        
        codes.push(code);
      }
      
      if (mode === 0) {
        // Return as bit array (5 bits per character)
        const bits = [];
        for (const code of codes) {
          for (let bit = 4; bit >= 0; bit--) {
            bits.push((code >>> bit) & 1);
          }
        }
        return bits;
      } else if (mode === 1) {
        // Return as formatted text
        return codes.map(code => {
          const binary = code.toString(2).padStart(5, '0');
          const letter = this.lettersSet[code];
          const figure = this.figuresSet[code];
          return `${binary} (${letter}/${figure})`;
        }).join('\\n');
      } else {
        throw new Error('Baudot: Invalid encoding mode');
      }
    },
    
    /**
     * Decode Baudot code to text
     * @param {number} mode - Decoding mode (0 = from binary array, 1 = from text)
     * @param {Array|string} data - Baudot code to decode
     * @returns {string} Decoded text
     */
    decryptBlock: function(mode, data) {
      let codes = [];
      
      if (mode === 0) {
        // Decode from bit array
        if (!Array.isArray(data)) {
          throw new Error('Baudot: Binary input must be an array');
        }
        
        if (data.length % 5 !== 0) {
          throw new Error('Baudot: Binary input length must be multiple of 5');
        }
        
        for (let i = 0; i < data.length; i += 5) {
          let code = 0;
          for (let bit = 0; bit < 5; bit++) {
            code = (code << 1) | (data[i + bit] ? 1 : 0);
          }
          codes.push(code);
        }
        
      } else if (mode === 1) {
        // Decode from formatted text
        if (typeof data !== 'string') {
          throw new Error('Baudot: Text input must be a string');
        }
        
        const lines = data.split('\\n');
        for (const line of lines) {
          const match = line.match(/^([01]{5})/);
          if (match) {
            codes.push(parseInt(match[1], 2));
          }
        }
        
      } else {
        throw new Error('Baudot: Invalid decoding mode');
      }
      
      // Convert codes to text
      let result = '';
      let currentMode = 'LETTERS';  // Start in letters mode
      
      for (const code of codes) {
        if (code === this.LTRS) {
          currentMode = 'LETTERS';
          continue;
        } else if (code === this.FIGS) {
          currentMode = 'FIGURES';
          continue;
        }
        
        if (code >= 0 && code < 32) {
          const char = currentMode === 'LETTERS' ? 
            this.lettersSet[code] : this.figuresSet[code];
          
          if (char && char !== 'LET' && char !== 'FIG') {
            if (char === '\\n') {
              result += '\\n';
            } else if (char === '\\r') {
              result += '\\r';
            } else if (char === '\\0') {
              result += '\\0';
            } else {
              result += char;
            }
          }
        }
      }
      
      return result;
    },
    
    /**
     * Get character information for a given code
     * @param {number} code - 5-bit Baudot code (0-31)
     * @returns {Object} Character information
     */
    getCharInfo: function(code) {
      if (code < 0 || code > 31) {
        return null;
      }
      
      return {
        code: code,
        binary: code.toString(2).padStart(5, '0'),
        letter: this.lettersSet[code],
        figure: this.figuresSet[code],
        isControl: code === this.LTRS || code === this.FIGS
      };
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      // No sensitive data to clear
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
        blockSize: '5 bits per character',
        keySize: 'None',
        description: 'Baudot Code (ITA2) - 5-bit telegraph encoding',
        standard: 'ITU-T F.1, CCITT-2',
        modes: ['LETTERS', 'FIGURES'],
        characters: 32,
        inventor: 'Émile Baudot (1870s)',
        applications: ['Telegraph', 'Telex', 'Early teleprinters']
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(BaudotCode);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaudotCode;
  }
  
  // Make available globally
  global.BaudotCode = BaudotCode;
  
})(typeof global !== 'undefined' ? global : window);