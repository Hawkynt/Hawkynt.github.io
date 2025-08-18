#!/usr/bin/env node
/*
 * Universal Base85/Ascii85 Encoder/Decoder
 * Supports both Adobe Ascii85 and RFC 1924 (IPv6) variants
 * Compatible with both Browser and Node.js environments
 * 
 * Ascii85 is a binary-to-text encoding developed by Paul E. Rutter
 * that encodes 4 bytes in 5 ASCII characters (25% overhead vs 33% for Base64).
 * RFC 1924 defines a variant for IPv6 address encoding.
 * 
 * References:
 * - Adobe PostScript Language Reference Manual (Ascii85)
 * - RFC 1924: A Compact Representation of IPv6 Addresses
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
  
  const Base85 = {
    internalName: 'base85',
    name: 'Base85/Ascii85',
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

    
    // Adobe Ascii85 character set (33-117: '!' to 'u')
    asciiAlphabet: '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstu',
    
    // RFC 1924 character set for IPv6 encoding
    rfc1924Alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~',
    
    // Current encoding variant ('ascii85' or 'rfc1924')
    variant: 'ascii85',
    
    /**
     * Initialize the cipher
     */
    Init: function() {
      this.variant = 'ascii85'; // Default to Adobe Ascii85
    },
    
    /**
     * Set up encoding variant
     * @param {string} key - Variant selector: 'ascii85' or 'rfc1924'
     */
    KeySetup: function(key) {
      if (typeof key === 'string') {
        const variant = key.toLowerCase();
        if (variant === 'ascii85' || variant === 'rfc1924') {
          this.variant = variant;
        } else {
          throw new Error('Base85: Invalid variant. Use "ascii85" or "rfc1924"');
        }
      } else {
        this.variant = 'ascii85'; // Default
      }
    },
    
    /**
     * Encode binary data to Base85 string
     * @param {number} mode - Encoding mode (0 = encode)
     * @param {string|Array} data - Input data to encode
     * @returns {string} Base85 encoded string
     */
    encryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('Base85: Invalid mode for encoding');
      }
      
      // Convert input to byte array
      let bytes;
      if (typeof data === 'string') {
        bytes = OpCodes.StringToBytes(data);
      } else if (Array.isArray(data)) {
        bytes = data.slice();
      } else {
        throw new Error('Base85: Invalid input data type');
      }
      
      if (bytes.length === 0) {
        return '';
      }
      
      const alphabet = this.variant === 'rfc1924' ? this.rfc1924Alphabet : this.asciiAlphabet;
      let result = '';
      
      if (this.variant === 'rfc1924') {
        // RFC 1924: Encode entire input as single 128-bit number (for IPv6)
        if (bytes.length !== 16) {
          throw new Error('Base85 RFC1924: Input must be exactly 16 bytes (IPv6 address)');
        }
        
        // Convert 16 bytes to big integer
        let num = BigInt(0);
        for (let i = 0; i < bytes.length; i++) {
          num = num * BigInt(256) + BigInt(bytes[i]);
        }
        
        // Convert to base 85 (20 digits)
        const digits = [];
        for (let i = 0; i < 20; i++) {
          digits.unshift(Number(num % BigInt(85)));
          num = num / BigInt(85);
        }
        
        return digits.map(d => alphabet[d]).join('');
        
      } else {
        // Adobe Ascii85: Process in 4-byte groups
        for (let i = 0; i < bytes.length; i += 4) {
          const group = bytes.slice(i, i + 4);
          
          // Pad group to 4 bytes if necessary
          while (group.length < 4) {
            group.push(0);
          }
          
          // Convert 4 bytes to 32-bit number (big-endian)
          let value = 0;
          for (let j = 0; j < 4; j++) {
            value = (value << 8) | group[j];
          }
          
          // Special case: all zeros becomes 'z'
          if (value === 0 && i + 4 <= bytes.length) {
            result += 'z';
          } else {
            // Convert to 5 base-85 digits
            const digits = [];
            for (let j = 0; j < 5; j++) {
              digits.unshift(value % 85);
              value = Math.floor(value / 85);
            }
            
            // Convert digits to characters
            let encodedGroup = '';
            const actualBytes = Math.min(4, bytes.length - i);
            const outputChars = actualBytes === 4 ? 5 : actualBytes + 1;
            
            for (let j = 0; j < outputChars; j++) {
              encodedGroup += alphabet[digits[j]];
            }
            
            result += encodedGroup;
          }
        }
        
        // Add delimiters for Adobe format
        return '<~' + result + '~>';
      }
    },
    
    /**
     * Decode Base85 string to binary data
     * @param {number} mode - Decoding mode (0 = decode)
     * @param {string} data - Base85 string to decode
     * @returns {Array} Decoded byte array
     */
    decryptBlock: function(mode, data) {
      if (mode !== 0) {
        throw new Error('Base85: Invalid mode for decoding');
      }
      
      if (typeof data !== 'string' || data.length === 0) {
        return [];
      }
      
      const alphabet = this.variant === 'rfc1924' ? this.rfc1924Alphabet : this.asciiAlphabet;
      let input = data;
      
      if (this.variant === 'rfc1924') {
        // RFC 1924: Decode 20-character string to 16 bytes
        if (input.length !== 20) {
          throw new Error('Base85 RFC1924: Input must be exactly 20 characters');
        }
        
        // Convert from base 85 to big integer
        let num = BigInt(0);
        for (let i = 0; i < input.length; i++) {
          const char = input[i];
          const value = alphabet.indexOf(char);
          if (value === -1) {
            throw new Error('Base85: Invalid character in input: ' + char);
          }
          num = num * BigInt(85) + BigInt(value);
        }
        
        // Convert to 16 bytes
        const bytes = [];
        for (let i = 0; i < 16; i++) {
          bytes.unshift(Number(num % BigInt(256)));
          num = num / BigInt(256);
        }
        
        return bytes;
        
      } else {
        // Adobe Ascii85: Remove delimiters
        if (input.startsWith('<~') && input.endsWith('~>')) {
          input = input.slice(2, -2);
        }
        
        const bytes = [];
        let i = 0;
        
        while (i < input.length) {
          const char = input[i];
          
          // Handle special 'z' case (represents four zero bytes)
          if (char === 'z') {
            bytes.push(0, 0, 0, 0);
            i++;
            continue;
          }
          
          // Process 5-character group
          const group = input.slice(i, i + 5);
          let value = 0;
          
          // Convert characters to base-85 value
          for (let j = 0; j < group.length; j++) {
            const charValue = alphabet.indexOf(group[j]);
            if (charValue === -1) {
              throw new Error('Base85: Invalid character in input: ' + group[j]);
            }
            value = value * 85 + charValue;
          }
          
          // Convert to bytes (big-endian)
          const groupBytes = [];
          for (let j = 0; j < 4; j++) {
            groupBytes.unshift(value & 0xFF);
            value >>>= 8;
          }
          
          // Add appropriate number of bytes
          const bytesToAdd = group.length === 5 ? 4 : group.length - 1;
          for (let j = 0; j < bytesToAdd; j++) {
            bytes.push(groupBytes[j]);
          }
          
          i += group.length;
        }
        
        return bytes;
      }
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
        blockSize: this.variant === 'rfc1924' ? '16 bytes (IPv6)' : '4 bytes',
        keySize: 'Variant selector',
        description: 'Base85 encoding: ' + (this.variant === 'rfc1924' ? 'RFC 1924 (IPv6)' : 'Adobe Ascii85'),
        variants: ['ascii85', 'rfc1924']
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(Base85);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Base85;
  }
  
  // Make available globally
  global.Base85 = Base85;
  
})(typeof global !== 'undefined' ? global : window);