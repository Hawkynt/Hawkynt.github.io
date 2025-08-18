#!/usr/bin/env node
/*
 * FF3 Format-Preserving Encryption Universal Implementation  
 * Based on NIST Special Publication 800-38G (March 2016)
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation - DO NOT USE IN PRODUCTION
 * FF3 is deprecated due to security vulnerabilities but included for historical/educational purposes
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
      console.error('FF3 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const FF3 = {
    // Public interface properties
    internalName: 'FF3',
    name: 'FF3 Format-Preserving Encryption (DEPRECATED)',
    comment: 'NIST SP 800-38G FF3 Mode - DEPRECATED due to security issues. Educational use only.',
    minKeyLength: 16, // 128-bit AES minimum
    maxKeyLength: 32, // 256-bit AES maximum
    stepKeyLength: 8,
    minBlockSize: 2,
    maxBlockSize: 56,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // FF3 constants
    RADIX_MIN: 2,
    RADIX_MAX: 65536,
    TWEAK_LENGTH: 16, // FF3 requires 64-bit (8 byte) tweak
    
    // Test vectors from NIST SP 800-38G (before deprecation)
    testVectors: [
      {
        input: '890121234567890000',
        key: '2DE79D232DF5585D68CE47882AE256D6',
        tweak: 'CBD09280979564',
        radix: 10,
        expected: '750918814058654607',
        description: 'NIST FF3 Sample - 18 digit decimal (deprecated)'
      }
    ],
    
    // Initialize FF3
    Init: function() {
      FF3.isInitialized = true;
      console.warn('FF3 is deprecated due to security vulnerabilities. Use FF1 instead.');
    },
    
    // Set up key for FF3
    KeySetup: function(key) {
      let id;
      do {
        id = 'FF3[' + global.generateUniqueID() + ']';
      } while (FF3.instances[id] || global.objectInstances[id]);
      
      FF3.instances[szID] = new FF3.FF3Instance(key);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear FF3 data
    ClearData: function(id) {
      if (FF3.instances[id]) {
        delete FF3.instances[szID];
        delete global.objectInstances[szID];
      }
    },
    
    // Encrypt a block using FF3
    encryptBlock: function(intInstanceID, szInput, optional_szTweak, optional_intRadix) {
      const id = 'FF3[' + intInstanceID + ']';
      if (!FF3.instances[id]) return '';
      
      return FF3.instances[szID].encrypt(szInput, optional_szTweak || '0000000000000000', optional_intRadix || 10);
    },
    
    // Decrypt a block using FF3
    decryptBlock: function(intInstanceID, szInput, optional_szTweak, optional_intRadix) {
      const id = 'FF3[' + intInstanceID + ']';
      if (!FF3.instances[id]) return '';
      
      return FF3.instances[szID].decrypt(szInput, optional_szTweak || '0000000000000000', optional_intRadix || 10);
    },
    
    // FF3 Instance Class
    FF3Instance: function(key) {
      this.key = OpCodes.HexToBytes(key);
      this.keyLength = this.key.length;
      
      // Validate key length
      if (this.keyLength !== 16 && this.keyLength !== 24 && this.keyLength !== 32) {
        throw new Error('FF3: Invalid key length. Must be 128, 192, or 256 bits');
      }
      
      // For FF3, we need to reverse key bytes (per NIST spec)
      this.keyReversed = this.key.slice().reverse();
      
      this.setupAES();
    },
    
    // Setup AES functions
    setupAES: function() {
      FF3.FF3Instance.prototype.setupAES = function() {
        this.rounds = this.keyLength === 16 ? 10 : (this.keyLength === 24 ? 12 : 14);
      };
      
      // AES encryption function (simplified for educational purposes)
      FF3.FF3Instance.prototype.aesEncrypt = function(plaintext, key) {
        // Simplified AES-like encryption
        const result = new Array(16);
        for (let i = 0; i < 16; i++) {
          result[i] = plaintext[i % plaintext.length] ^ key[i % key.length];
          // Apply simple transformation
          result[i] = ((result[i] << 1) | (result[i] >> 7)) & 0xFF;
        }
        return result;
      };
      
      // Convert string to numeral array
      FF3.FF3Instance.prototype.stringToNumerals = function(str, radix) {
        const numerals = [];
        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          let numeral;
          
          if (char >= '0' && char <= '9') {
            numeral = char.charCodeAt(0) - 48;
          } else if (char >= 'a' && char <= 'z') {
            numeral = char.charCodeAt(0) - 87;
          } else if (char >= 'A' && char <= 'Z') {
            numeral = char.charCodeAt(0) - 55;
          } else {
            throw new Error('FF3: Invalid character in input string');
          }
          
          if (numeral >= radix) {
            throw new Error('FF3: Character not valid for specified radix');
          }
          numerals.push(numeral);
        }
        return numerals;
      };
      
      // Convert numeral array to string
      FF3.FF3Instance.prototype.numeralsToString = function(numerals, radix) {
        let result = '';
        for (let i = 0; i < numerals.length; i++) {
          const numeral = numerals[i];
          if (numeral < 10) {
            result += String.fromCharCode(48 + numeral);
          } else if (numeral < 36) {
            result += String.fromCharCode(87 + numeral);
          } else {
            throw new Error('FF3: Invalid numeral value');
          }
        }
        return result;
      };
      
      // Numeral string to big integer (simplified)
      FF3.FF3Instance.prototype.numeralStringToInt = function(numerals, radix) {
        let result = 0;
        for (let i = 0; i < numerals.length; i++) {
          result = result * radix + numerals[i];
        }
        return result;
      };
      
      // Big integer to numeral string (simplified)
      FF3.FF3Instance.prototype.intToNumeralString = function(value, radix, length) {
        const numerals = [];
        for (let i = 0; i < length; i++) {
          numerals.unshift(value % radix);
          value = Math.floor(value / radix);
        }
        return numerals;
      };
      
      // FF3 Encrypt function
      FF3.FF3Instance.prototype.encrypt = function(plaintext, tweak, radix) {
        radix = radix || 10;
        
        // Validate inputs
        if (radix < FF3.RADIX_MIN || radix > FF3.RADIX_MAX) {
          throw new Error('FF3: Invalid radix');
        }
        
        if (plaintext.length < FF3.minBlockSize || plaintext.length > FF3.maxBlockSize) {
          throw new Error('FF3: Invalid plaintext length');
        }
        
        // Validate tweak length (should be 64 bits = 16 hex chars)
        if (tweak.length !== 16) {
          throw new Error('FF3: Tweak must be 64 bits (16 hex characters)');
        }
        
        // Convert to numerals
        const X = this.stringToNumerals(plaintext, radix);
        const n = X.length;
        
        // Split into halves
        const u = Math.ceil(n / 2);
        const v = n - u;
        const A = X.slice(0, u);
        const B = X.slice(u);
        
        // Parse tweak
        const tweakBytes = OpCodes.HexToBytes(tweak);
        const TL = tweakBytes.slice(0, 4);
        const TR = tweakBytes.slice(4, 8);
        
        // FF3 has 8 rounds
        for (let i = 0; i < 8; i++) {
          let W;
          if (i % 2 === 0) {
            // Even round: use TR
            W = TR.slice();
          } else {
            // Odd round: use TL  
            W = TL.slice();
          }
          
          // XOR with round number
          W[3] ^= i;
          
          // Convert B to bytes and pad
          const bInt = this.numeralStringToInt(B, radix);
          const bBytes = [
            (bInt >>> 24) & 0xFF,
            (bInt >>> 16) & 0xFF,
            (bInt >>> 8) & 0xFF,
            bInt & 0xFF
          ];
          
          // Combine W and B bytes for AES input
          const P = [...W, ...bBytes, 0, 0, 0, 0, 0, 0, 0, 0];
          
          // AES encryption
          const S = this.aesEncrypt(P, this.keyReversed);
          
          // Extract y from S
          let y = 0;
          for (let j = 0; j < 4; j++) {
            y = (y << 8) | S[j];
          }
          
          // Calculate c
          const aInt = this.numeralStringToInt(A, radix);
          const modulus = Math.pow(radix, A.length);
          const c = (aInt + y) % modulus;
          const C = this.intToNumeralString(c, radix, A.length);
          
          // Swap for next round
          A.splice(0, A.length, ...B);
          B.splice(0, B.length, ...C);
        }
        
        return this.numeralsToString([...A, ...B], radix);
      };
      
      // FF3 Decrypt function  
      FF3.FF3Instance.prototype.decrypt = function(ciphertext, tweak, radix) {
        radix = radix || 10;
        
        // Convert to numerals
        const Y = this.stringToNumerals(ciphertext, radix);
        const n = Y.length;
        
        // Split into halves
        const u = Math.ceil(n / 2);
        const v = n - u;
        const A = Y.slice(0, u);
        const B = Y.slice(u);
        
        // Parse tweak
        const tweakBytes = OpCodes.HexToBytes(tweak);
        const TL = tweakBytes.slice(0, 4);
        const TR = tweakBytes.slice(4, 8);
        
        // FF3 rounds in reverse (7 down to 0)
        for (let i = 7; i >= 0; i--) {
          let W;
          if (i % 2 === 0) {
            W = TR.slice();
          } else {
            W = TL.slice();
          }
          
          W[3] ^= i;
          
          const aInt = this.numeralStringToInt(A, radix);
          const aBytes = [
            (aInt >>> 24) & 0xFF,
            (aInt >>> 16) & 0xFF,
            (aInt >>> 8) & 0xFF,
            aInt & 0xFF
          ];
          
          const P = [...W, ...aBytes, 0, 0, 0, 0, 0, 0, 0, 0];
          const S = this.aesEncrypt(P, this.keyReversed);
          
          let y = 0;
          for (let j = 0; j < 4; j++) {
            y = (y << 8) | S[j];
          }
          
          const bInt = this.numeralStringToInt(B, radix);
          const modulus = Math.pow(radix, B.length);
          const c = (bInt - y + modulus) % modulus;
          const C = this.intToNumeralString(c, radix, B.length);
          
          // Swap for next round
          B.splice(0, B.length, ...A);
          A.splice(0, A.length, ...C);
        }
        
        return this.numeralsToString([...A, ...B], radix);
      };
    }
  };
  
  // Initialize the prototype functions
  FF3.setupAES();
  
  // Auto-register with Cipher system
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(FF3);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FF3;
  }
  
})(typeof global !== 'undefined' ? global : window);