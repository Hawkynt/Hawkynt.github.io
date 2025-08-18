/*
 * OpCodes.js - Universal Cryptographic Operations Library
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Provides common low-level operations used across cipher implementations:
 * - Bit manipulation (rotation, shifting, masking)
 * - Byte/word operations (packing, unpacking, endianness)
 * - Array utilities (copying, clearing, XOR operations)
 * - Type conversions (string to bytes, hex utilities)
 * - Mathematical operations (GF arithmetic, modular arithmetic)
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 */

(function(global) {
  'use strict';
  
  // Create OpCodes object
  const OpCodes = {
    
    // ========================[ BIT MANIPULATION ]========================
    
    /**
     * Rotate left (circular left shift) for 8-bit values
     * @param {number} value - 8-bit value to rotate
     * @param {number} positions - Number of positions to rotate (0-7)
     * @returns {number} Rotated 8-bit value
     */
    RotL8: function(value, positions) {
      value &= 0xFF;
      positions &= 7;
      return ((value << positions) | (value >>> (8 - positions))) & 0xFF;
    },
    
    /**
     * Rotate right (circular right shift) for 8-bit values
     * @param {number} value - 8-bit value to rotate
     * @param {number} positions - Number of positions to rotate (0-7)
     * @returns {number} Rotated 8-bit value
     */
    RotR8: function(value, positions) {
      value &= 0xFF;
      positions &= 7;
      return ((value >>> positions) | (value << (8 - positions))) & 0xFF;
    },
    
    /**
     * Rotate left (circular left shift) for 16-bit values
     * @param {number} value - 16-bit value to rotate
     * @param {number} positions - Number of positions to rotate (0-15)
     * @returns {number} Rotated 16-bit value
     */
    RotL16: function(value, positions) {
      value &= 0xFFFF;
      positions &= 15;
      return ((value << positions) | (value >>> (16 - positions))) & 0xFFFF;
    },
    
    /**
     * Rotate right (circular right shift) for 16-bit values
     * @param {number} value - 16-bit value to rotate
     * @param {number} positions - Number of positions to rotate (0-15)
     * @returns {number} Rotated 16-bit value
     */
    RotR16: function(value, positions) {
      value &= 0xFFFF;
      positions &= 15;
      return ((value >>> positions) | (value << (16 - positions))) & 0xFFFF;
    },
    
    /**
     * Rotate left (circular left shift) for 32-bit values
     * @param {number} value - 32-bit value to rotate
     * @param {number} positions - Number of positions to rotate (0-31)
     * @returns {number} Rotated 32-bit value
     */
    RotL32: function(value, positions) {
      value = value >>> 0; // Ensure unsigned 32-bit
      positions &= 31;
      return ((value << positions) | (value >>> (32 - positions))) >>> 0;
    },
    
    /**
     * Rotate right (circular right shift) for 32-bit values
     * @param {number} value - 32-bit value to rotate
     * @param {number} positions - Number of positions to rotate (0-31)
     * @returns {number} Rotated 32-bit value
     */
    RotR32: function(value, positions) {
      value = value >>> 0; // Ensure unsigned 32-bit
      positions &= 31;
      return ((value >>> positions) | (value << (32 - positions))) >>> 0;
    },
    
    // ========================[ BYTE/WORD OPERATIONS ]========================
    
    /**
     * Pack 4 bytes into a 32-bit word (big-endian)
     * @param {number} b0 - Most significant byte
     * @param {number} b1 - Second byte
     * @param {number} b2 - Third byte
     * @param {number} b3 - Least significant byte
     * @returns {number} 32-bit word
     */
    Pack32BE: function(b0, b1, b2, b3) {
      return (((b0 & 0xFF) << 24) | ((b1 & 0xFF) << 16) | ((b2 & 0xFF) << 8) | (b3 & 0xFF)) >>> 0;
    },
    
    /**
     * Pack 4 bytes into a 32-bit word (little-endian)
     * @param {number} b0 - Least significant byte
     * @param {number} b1 - Second byte
     * @param {number} b2 - Third byte
     * @param {number} b3 - Most significant byte
     * @returns {number} 32-bit word
     */
    Pack32LE: function(b0, b1, b2, b3) {
      return (((b3 & 0xFF) << 24) | ((b2 & 0xFF) << 16) | ((b1 & 0xFF) << 8) | (b0 & 0xFF)) >>> 0;
    },
    
    /**
     * Unpack 32-bit word to 4 bytes (big-endian)
     * @param {number} word - 32-bit word to unpack
     * @returns {Array} Array of 4 bytes [b0, b1, b2, b3]
     */
    Unpack32BE: function(word) {
      word = word >>> 0;
      return [
        (word >>> 24) & 0xFF,
        (word >>> 16) & 0xFF,
        (word >>> 8) & 0xFF,
        word & 0xFF
      ];
    },
    
    /**
     * Unpack 32-bit word to 4 bytes (little-endian)
     * @param {number} word - 32-bit word to unpack
     * @returns {Array} Array of 4 bytes [b0, b1, b2, b3]
     */
    Unpack32LE: function(word) {
      word = word >>> 0;
      return [
        word & 0xFF,
        (word >>> 8) & 0xFF,
        (word >>> 16) & 0xFF,
        (word >>> 24) & 0xFF
      ];
    },
    
    /**
     * Extract specific byte from 32-bit word
     * @param {number} word - 32-bit word
     * @param {number} byteIndex - Byte index (0=LSB, 3=MSB)
     * @returns {number} Extracted byte (0-255)
     */
    GetByte: function(word, byteIndex) {
      return (word >>> (byteIndex * 8)) & 0xFF;
    },
    
    /**
     * Set specific byte in 32-bit word
     * @param {number} word - Original 32-bit word
     * @param {number} byteIndex - Byte index (0=LSB, 3=MSB)
     * @param {number} value - New byte value (0-255)
     * @returns {number} Updated 32-bit word
     */
    SetByte: function(word, byteIndex, value) {
      const shift = byteIndex * 8;
      const mask = ~(0xFF << shift);
      return ((word & mask) | ((value & 0xFF) << shift)) >>> 0;
    },
    
    // ========================[ STRING/BYTE CONVERSIONS ]========================
    
    /**
     * Convert string to byte array
     * @param {string} str - Input string
     * @returns {Array} Array of byte values
     */
    StringToBytes: function(str) {
      const bytes = [];
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xFF);
      }
      return bytes;
    },
    
    /**
     * Convert byte array to string
     * @param {Array} bytes - Array of byte values
     * @returns {string} Resulting string
     */
    BytesToString: function(bytes) {
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i] & 0xFF);
      }
      return str;
    },
    
    /**
     * Convert string to 32-bit word array (big-endian)
     * @param {string} str - Input string (length must be multiple of 4)
     * @returns {Array} Array of 32-bit words
     */
    StringToWords32BE: function(str) {
      const words = [];
      for (let i = 0; i < str.length; i += 4) {
        const b0 = str.charCodeAt(i) & 0xFF;
        const b1 = i + 1 < str.length ? str.charCodeAt(i + 1) & 0xFF : 0;
        const b2 = i + 2 < str.length ? str.charCodeAt(i + 2) & 0xFF : 0;
        const b3 = i + 3 < str.length ? str.charCodeAt(i + 3) & 0xFF : 0;
        words.push(OpCodes.Pack32BE(b0, b1, b2, b3));
      }
      return words;
    },
    
    /**
     * Convert 32-bit word array to string (big-endian)
     * @param {Array} words - Array of 32-bit words
     * @returns {string} Resulting string
     */
    Words32BEToString: function(words) {
      let str = '';
      for (let i = 0; i < words.length; i++) {
        const bytes = OpCodes.Unpack32BE(words[i]);
        for (let j = 0; j < bytes.length; j++) {
          str += String.fromCharCode(bytes[j]);
        }
      }
      return str;
    },
    
    // ========================[ HEX UTILITIES ]========================
    
    /**
     * Convert byte to hex string
     * @param {number} byte - Byte value (0-255)
     * @returns {string} Two-character hex string
     */
    ByteToHex: function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2).toUpperCase();
    },
    
    /**
     * Convert hex string to byte
     * @param {string} hex - Two-character hex string
     * @returns {number} Byte value (0-255)
     */
    HexToByte: function(hex) {
      return parseInt(hex, 16) & 0xFF;
    },
    
    /**
     * Convert string to hex representation
     * @param {string} str - Input string
     * @returns {string} Hex string representation
     */
    StringToHex: function(str) {
      let hex = '';
      for (let i = 0; i < str.length; i++) {
        hex += OpCodes.ByteToHex(str.charCodeAt(i));
      }
      return hex;
    },
    
    /**
     * Convert hex string to regular string
     * @param {string} hex - Hex string (even length)
     * @returns {string} Decoded string
     */
    HexToString: function(hex) {
      let str = '';
      for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(OpCodes.HexToByte(hex.substr(i, 2)));
      }
      return str;
    },
    
    /**
     * Convert hex string to byte array
     * @param {string} hex - Hex string (even length)
     * @returns {Array} Array of byte values
     */
    HexToBytes: function(hex) {
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(OpCodes.HexToByte(hex.substr(i, 2)));
      }
      return bytes;
    },

    // ========================[ COMPREHENSIVE HEX UTILITIES ]========================

    /**
     * Convert hex nibbles to bytes (4-bit to 8-bit conversion)
     * "f123" → [15, 1, 2, 3] (each hex digit becomes a byte)
     * @param {string} hexString - Hex string with nibbles
     * @returns {Array} Array of byte values (0-15 each)
     */
    Hex4ToBytes: function(hexString) {
      if (typeof hexString !== 'string') {
        throw new Error('Hex4ToBytes: Input must be a string');
      }
      
      // Remove whitespace and convert to uppercase
      hexString = hexString.replace(/\s+/g, '').toUpperCase();
      
      // Validate hex characters
      if (!/^[0-9A-F]*$/.test(hexString)) {
        throw new Error('Hex4ToBytes: Invalid hex characters found');
      }
      
      const bytes = [];
      for (let i = 0; i < hexString.length; i++) {
        const digit = parseInt(hexString.charAt(i), 16);
        bytes.push(digit);
      }
      
      return bytes;
    },

    /**
     * Convert hex pairs to bytes (standard hex to bytes conversion)
     * "f123" → [0xf1, 0x23] (each pair of hex digits becomes a byte)
     * @param {string} hexString - Hex string with pairs
     * @returns {Array} Array of byte values (0-255 each)
     */
    Hex8ToBytes: function(hexString) {
      if (typeof hexString !== 'string') {
        throw new Error('Hex8ToBytes: Input must be a string');
      }
      
      // Remove whitespace and convert to uppercase
      hexString = hexString.replace(/\s+/g, '').toUpperCase();
      
      // Validate hex characters
      if (!/^[0-9A-F]*$/.test(hexString)) {
        throw new Error('Hex8ToBytes: Invalid hex characters found');
      }
      
      // Pad to even length if necessary
      if (hexString.length % 2 === 1) {
        hexString = '0' + hexString;
      }
      
      const bytes = [];
      for (let i = 0; i < hexString.length; i += 2) {
        const hexPair = hexString.substr(i, 2);
        const byte = parseInt(hexPair, 16);
        bytes.push(byte);
      }
      
      return bytes;
    },

    /**
     * Convert hex quads to 16-bit words (hex to words conversion)
     * "f123abcd" → [0xf123, 0xabcd] (each 4 hex digits becomes a 16-bit word)
     * @param {string} hexString - Hex string with quads
     * @returns {Array} Array of 16-bit word values (0-65535 each)
     */
    Hex16ToWords: function(hexString) {
      if (typeof hexString !== 'string') {
        throw new Error('Hex16ToWords: Input must be a string');
      }
      
      // Remove whitespace and convert to uppercase
      hexString = hexString.replace(/\s+/g, '').toUpperCase();
      
      // Validate hex characters
      if (!/^[0-9A-F]*$/.test(hexString)) {
        throw new Error('Hex16ToWords: Invalid hex characters found');
      }
      
      // Pad to multiple of 4 if necessary
      while (hexString.length % 4 !== 0) {
        hexString = '0' + hexString;
      }
      
      const words = [];
      for (let i = 0; i < hexString.length; i += 4) {
        const hexQuad = hexString.substr(i, 4);
        const word = parseInt(hexQuad, 16);
        words.push(word);
      }
      
      return words;
    },

    /**
     * Convert hex string to 32-bit words (hex to 32-bit words conversion)
     * "f123abcd9876" → [0xf123abcd, 0x9876] (each 8 hex digits becomes a 32-bit word)
     * @param {string} hexString - Hex string with octets
     * @returns {Array} Array of 32-bit word values
     */
    Hex32ToBytes: function(hexString) {
      if (typeof hexString !== 'string') {
        throw new Error('Hex32ToBytes: Input must be a string');
      }
      
      // Remove whitespace and convert to uppercase
      hexString = hexString.replace(/\s+/g, '').toUpperCase();
      
      // Validate hex characters
      if (!/^[0-9A-F]*$/.test(hexString)) {
        throw new Error('Hex32ToBytes: Invalid hex characters found');
      }
      
      // Pad to multiple of 8 if necessary
      while (hexString.length % 8 !== 0) {
        hexString = '0' + hexString;
      }
      
      const words = [];
      for (let i = 0; i < hexString.length; i += 8) {
        const hexOctet = hexString.substr(i, 8);
        const word = parseInt(hexOctet, 16) >>> 0; // Ensure unsigned 32-bit
        words.push(word);
      }
      
      return words;
    },

    /**
     * Convert bytes to hex nibbles (reverse of Hex4ToBytes)
     * [15, 1, 2, 3] → "F123"
     * @param {Array} bytes - Array of nibble values (0-15 each)
     * @returns {string} Hex string representation
     */
    BytesToHex4: function(bytes) {
      if (!Array.isArray(bytes)) {
        throw new Error('BytesToHex4: Input must be an array');
      }
      
      let hex = '';
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i] & 0x0F; // Ensure nibble range
        hex += byte.toString(16).toUpperCase();
      }
      
      return hex;
    },

    /**
     * Convert bytes to hex pairs (reverse of Hex8ToBytes)
     * [0xf1, 0x23] → "F123"
     * @param {Array} bytes - Array of byte values (0-255 each)
     * @returns {string} Hex string representation
     */
    BytesToHex8: function(bytes) {
      if (!Array.isArray(bytes)) {
        throw new Error('BytesToHex8: Input must be an array');
      }
      
      let hex = '';
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i] & 0xFF; // Ensure byte range
        hex += ('0' + byte.toString(16)).slice(-2).toUpperCase();
      }
      
      return hex;
    },

    /**
     * Convert 16-bit words to hex quads (reverse of Hex16ToWords)
     * [0xf123, 0xabcd] → "F123ABCD"
     * @param {Array} words - Array of 16-bit word values
     * @returns {string} Hex string representation
     */
    WordsToHex16: function(words) {
      if (!Array.isArray(words)) {
        throw new Error('WordsToHex16: Input must be an array');
      }
      
      let hex = '';
      for (let i = 0; i < words.length; i++) {
        const word = words[i] & 0xFFFF; // Ensure 16-bit range
        hex += ('000' + word.toString(16)).slice(-4).toUpperCase();
      }
      
      return hex;
    },

    /**
     * Convert 32-bit words to hex octets (reverse of Hex32ToBytes)
     * [0xf123abcd, 0x9876] → "F123ABCD00009876"
     * @param {Array} words - Array of 32-bit word values
     * @returns {string} Hex string representation
     */
    BytesToHex32: function(words) {
      if (!Array.isArray(words)) {
        throw new Error('BytesToHex32: Input must be an array');
      }
      
      let hex = '';
      for (let i = 0; i < words.length; i++) {
        const word = (words[i] >>> 0); // Ensure unsigned 32-bit
        hex += ('0000000' + word.toString(16)).slice(-8).toUpperCase();
      }
      
      return hex;
    },

    /**
     * Validate hex string format
     * @param {string} hexString - Hex string to validate
     * @param {number} expectedLength - Expected length (optional)
     * @returns {boolean} True if valid hex string
     */
    IsValidHex: function(hexString, expectedLength) {
      if (typeof hexString !== 'string') {
        return false;
      }
      
      // Remove whitespace
      const cleanHex = hexString.replace(/\s+/g, '');
      
      // Check for valid hex characters
      if (!/^[0-9A-Fa-f]*$/.test(cleanHex)) {
        return false;
      }
      
      // Check expected length if provided
      if (expectedLength !== undefined && cleanHex.length !== expectedLength) {
        return false;
      }
      
      return true;
    },

    /**
     * Format hex string with spacing for readability
     * @param {string} hexString - Input hex string
     * @param {number} groupSize - Number of hex digits per group (default: 2)
     * @param {string} separator - Group separator (default: ' ')
     * @returns {string} Formatted hex string
     */
    FormatHex: function(hexString, groupSize, separator) {
      if (typeof hexString !== 'string') {
        throw new Error('FormatHex: Input must be a string');
      }
      
      groupSize = groupSize || 2;
      separator = separator || ' ';
      
      // Remove existing whitespace and convert to uppercase
      const cleanHex = hexString.replace(/\s+/g, '').toUpperCase();
      
      // Validate hex
      if (!OpCodes.IsValidHex(cleanHex)) {
        throw new Error('FormatHex: Invalid hex string');
      }
      
      // Add separators
      let formatted = '';
      for (let i = 0; i < cleanHex.length; i += groupSize) {
        if (i > 0) {
          formatted += separator;
        }
        formatted += cleanHex.substr(i, groupSize);
      }
      
      return formatted;
    },

    /**
     * Convert multiline hex string to clean hex (removes formatting)
     * @param {string} hexString - Formatted hex string (may contain newlines, spaces)
     * @returns {string} Clean hex string
     */
    CleanHex: function(hexString) {
      if (typeof hexString !== 'string') {
        throw new Error('CleanHex: Input must be a string');
      }
      
      // Remove all whitespace, newlines, and non-hex characters except 0-9A-Fa-f
      return hexString.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    },

    /**
     * Parse hex constants from formatted strings (common in cryptographic literature)
     * Examples: "0x1234", "1234h", "$1234", "16#1234#"
     * @param {string} hexConstant - Formatted hex constant
     * @returns {number} Parsed numeric value
     */
    ParseHexConstant: function(hexConstant) {
      if (typeof hexConstant !== 'string') {
        throw new Error('ParseHexConstant: Input must be a string');
      }
      
      let cleanHex = hexConstant.trim();
      
      // Handle different hex formats
      if (cleanHex.startsWith('0x') || cleanHex.startsWith('0X')) {
        cleanHex = cleanHex.slice(2);
      } else if (cleanHex.startsWith('$')) {
        cleanHex = cleanHex.slice(1);
      } else if (cleanHex.endsWith('h') || cleanHex.endsWith('H')) {
        cleanHex = cleanHex.slice(0, -1);
      } else if (cleanHex.startsWith('16#') && cleanHex.endsWith('#')) {
        cleanHex = cleanHex.slice(3, -1);
      }
      
      // Validate and parse
      if (!OpCodes.IsValidHex(cleanHex)) {
        throw new Error('ParseHexConstant: Invalid hex constant format');
      }
      
      return parseInt(cleanHex, 16);
    },

    /**
     * Convert S-box definition from various formats to standard byte array
     * Handles: hex strings, arrays of hex constants, formatted blocks
     * @param {string|Array} sboxDef - S-box definition in various formats
     * @returns {Array} Standard 256-byte S-box array
     */
    ParseSBox: function(sboxDef) {
      if (typeof sboxDef === 'string') {
        // Handle hex string format
        const cleanHex = OpCodes.CleanHex(sboxDef);
        if (cleanHex.length !== 512) { // 256 bytes * 2 hex chars each
          throw new Error('ParseSBox: Hex string must be exactly 512 characters (256 bytes)');
        }
        return OpCodes.Hex8ToBytes(cleanHex);
      } else if (Array.isArray(sboxDef)) {
        // Handle array format (may contain hex constants)
        if (sboxDef.length !== 256) {
          throw new Error('ParseSBox: Array must contain exactly 256 elements');
        }
        
        const result = new Array(256);
        for (let i = 0; i < 256; i++) {
          if (typeof sboxDef[i] === 'string') {
            result[i] = OpCodes.ParseHexConstant(sboxDef[i]) & 0xFF;
          } else if (typeof sboxDef[i] === 'number') {
            result[i] = sboxDef[i] & 0xFF;
          } else {
            throw new Error(`ParseSBox: Invalid element type at index ${i}`);
          }
        }
        return result;
      } else {
        throw new Error('ParseSBox: Input must be string or array');
      }
    },

    /**
     * Convert P-box definition from hex string to permutation array
     * @param {string} pboxHex - Hex string representing P-box indices
     * @param {number} size - Expected P-box size (default: auto-detect)
     * @returns {Array} P-box permutation array
     */
    ParsePBox: function(pboxHex, size) {
      if (typeof pboxHex !== 'string') {
        throw new Error('ParsePBox: Input must be a hex string');
      }
      
      const cleanHex = OpCodes.CleanHex(pboxHex);
      const bytes = OpCodes.Hex8ToBytes(cleanHex);
      
      if (size && bytes.length !== size) {
        throw new Error(`ParsePBox: Expected ${size} bytes, got ${bytes.length}`);
      }
      
      return bytes;
    },

    /**
     * Generate hex string representation of S-box for code generation
     * @param {Array} sbox - 256-byte S-box array
     * @param {number} lineLength - Hex characters per line (default: 32)
     * @returns {string} Formatted hex string suitable for code inclusion
     */
    SBoxToHex: function(sbox, lineLength) {
      if (!Array.isArray(sbox) || sbox.length !== 256) {
        throw new Error('SBoxToHex: Input must be 256-element array');
      }
      
      lineLength = lineLength || 32;
      const hex = OpCodes.BytesToHex8(sbox);
      
      let formatted = '';
      for (let i = 0; i < hex.length; i += lineLength) {
        if (i > 0) {
          formatted += '\n';
        }
        formatted += hex.substr(i, lineLength);
      }
      
      return formatted;
    },

    /**
     * Efficient batch hex conversion for performance-critical operations
     * @param {Array} hexStrings - Array of hex strings to convert
     * @returns {Array} Array of byte arrays
     */
    BatchHex8ToBytes: function(hexStrings) {
      if (!Array.isArray(hexStrings)) {
        throw new Error('BatchHex8ToBytes: Input must be array of hex strings');
      }
      
      const results = new Array(hexStrings.length);
      for (let i = 0; i < hexStrings.length; i++) {
        results[i] = OpCodes.Hex8ToBytes(hexStrings[i]);
      }
      
      return results;
    },

    /**
     * Memory-efficient hex streaming for large data sets
     * @param {string} hexString - Large hex string
     * @param {number} chunkSize - Bytes per chunk (default: 1024)
     * @param {Function} callback - Callback function(chunkBytes, isLast)
     */
    StreamHex8ToBytes: function(hexString, chunkSize, callback) {
      if (typeof hexString !== 'string') {
        throw new Error('StreamHex8ToBytes: Input must be a string');
      }
      
      if (typeof callback !== 'function') {
        throw new Error('StreamHex8ToBytes: Callback must be a function');
      }
      
      chunkSize = chunkSize || 1024;
      const cleanHex = OpCodes.CleanHex(hexString);
      const hexChunkSize = chunkSize * 2; // 2 hex chars per byte
      
      for (let i = 0; i < cleanHex.length; i += hexChunkSize) {
        const hexChunk = cleanHex.substr(i, hexChunkSize);
        const bytes = OpCodes.Hex8ToBytes(hexChunk);
        const isLast = (i + hexChunkSize) >= cleanHex.length;
        callback(bytes, isLast);
      }
    },
    
    // ========================[ ARRAY OPERATIONS ]========================
    
    /**
     * XOR two byte arrays
     * @param {Array} arr1 - First byte array
     * @param {Array} arr2 - Second byte array
     * @returns {Array} XOR result array (length = min(arr1.length, arr2.length))
     */
    XorArrays: function(arr1, arr2) {
      const result = [];
      const minLength = Math.min(arr1.length, arr2.length);
      for (let i = 0; i < minLength; i++) {
        result.push((arr1[i] ^ arr2[i]) & 0xFF);
      }
      return result;
    },
    
    /**
     * Copy array (deep copy for simple arrays)
     * @param {Array} arr - Source array
     * @returns {Array} Copied array
     */
    CopyArray: function(arr) {
      return arr.slice(0);
    },
    
    /**
     * Clear array (fill with zeros)
     * @param {Array} arr - Array to clear (modified in place)
     */
    ClearArray: function(arr) {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = 0;
      }
    },
    
    /**
     * Compare two arrays for equality
     * @param {Array} arr1 - First array
     * @param {Array} arr2 - Second array
     * @returns {boolean} True if arrays are equal
     */
    CompareArrays: function(arr1, arr2) {
      if (arr1.length !== arr2.length) return false;
      for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
      }
      return true;
    },
    
    // ========================[ MATHEMATICAL OPERATIONS ]========================
    
    /**
     * Modular addition (a + b) mod m
     * @param {number} a - First operand
     * @param {number} b - Second operand
     * @param {number} m - Modulus
     * @returns {number} (a + b) mod m
     */
    AddMod: function(a, b, m) {
      return ((a % m) + (b % m)) % m;
    },
    
    /**
     * Modular subtraction (a - b) mod m
     * @param {number} a - First operand
     * @param {number} b - Second operand
     * @param {number} m - Modulus
     * @returns {number} (a - b) mod m
     */
    SubMod: function(a, b, m) {
      return ((a % m) - (b % m) + m) % m;
    },
    
    /**
     * Modular multiplication (a * b) mod m
     * @param {number} a - First operand
     * @param {number} b - Second operand
     * @param {number} m - Modulus
     * @returns {number} (a * b) mod m
     */
    MulMod: function(a, b, m) {
      return ((a % m) * (b % m)) % m;
    },
    
    /**
     * Galois Field GF(2^8) multiplication (for AES and other ciphers)
     * @param {number} a - First operand (0-255)
     * @param {number} b - Second operand (0-255)
     * @returns {number} GF(2^8) multiplication result
     */
    GF256Mul: function(a, b) {
      let result = 0;
      a &= 0xFF;
      b &= 0xFF;
      
      for (let i = 0; i < 8; i++) {
        if (b & 1) {
          result ^= a;
        }
        const highBit = a & 0x80;
        a = (a << 1) & 0xFF;
        if (highBit) {
          a ^= 0x1B; // AES irreducible polynomial x^8 + x^4 + x^3 + x + 1
        }
        b >>>= 1;
      }
      
      return result & 0xFF;
    },
    
    // ========================[ UTILITY FUNCTIONS ]========================
    
    /**
     * Generate padding for block ciphers (PKCS#7)
     * @param {number} blockSize - Block size in bytes
     * @param {number} dataLength - Length of data to pad
     * @returns {Array} Padding bytes
     */
    PKCS7Padding: function(blockSize, dataLength) {
      const padLength = blockSize - (dataLength % blockSize);
      const padding = [];
      for (let i = 0; i < padLength; i++) {
        padding.push(padLength);
      }
      return padding;
    },
    
    /**
     * Remove PKCS#7 padding
     * @param {Array} paddedData - Data with PKCS#7 padding
     * @returns {Array} Data without padding
     */
    RemovePKCS7Padding: function(paddedData) {
      if (paddedData.length === 0) return paddedData;
      
      const padLength = paddedData[paddedData.length - 1];
      if (padLength === 0 || padLength > paddedData.length) {
        return paddedData; // Invalid padding
      }
      
      // Verify padding
      for (let i = paddedData.length - padLength; i < paddedData.length; i++) {
        if (paddedData[i] !== padLength) {
          return paddedData; // Invalid padding
        }
      }
      
      return paddedData.slice(0, paddedData.length - padLength);
    },
    
    /**
     * Secure comparison (constant time) for preventing timing attacks
     * @param {Array} arr1 - First array
     * @param {Array} arr2 - Second array
     * @returns {boolean} True if arrays are equal
     */
    SecureCompare: function(arr1, arr2) {
      if (arr1.length !== arr2.length) {
        return false;
      }
      
      let result = 0;
      for (let i = 0; i < arr1.length; i++) {
        result |= arr1[i] ^ arr2[i];
      }
      
      return result === 0;
    },
    
    // ========================[ ADVANCED OPERATIONS ]========================
    
    /**
     * 64-bit left rotation (for future 64-bit ciphers)
     * @param {number} low - Low 32 bits
     * @param {number} high - High 32 bits
     * @param {number} positions - Rotation positions (0-63)
     * @returns {Object} {low, high} - Rotated 64-bit value
     */
    RotL64: function(low, high, positions) {
      positions &= 63;
      if (positions === 0) return {low: low, high: high};
      
      if (positions < 32) {
        const newHigh = ((high << positions) | (low >>> (32 - positions))) >>> 0;
        const newLow = ((low << positions) | (high >>> (32 - positions))) >>> 0;
        return {low: newLow, high: newHigh};
      } else {
        // positions >= 32, swap and rotate
        positions -= 32;
        const newHigh = ((low << positions) | (high >>> (32 - positions))) >>> 0;
        const newLow = ((high << positions) | (low >>> (32 - positions))) >>> 0;
        return {low: newLow, high: newHigh};
      }
    },
    
    /**
     * 64-bit right rotation (for future 64-bit ciphers)
     * @param {number} low - Low 32 bits
     * @param {number} high - High 32 bits
     * @param {number} positions - Rotation positions (0-63)
     * @returns {Object} {low, high} - Rotated 64-bit value
     */
    RotR64: function(low, high, positions) {
      positions &= 63;
      if (positions === 0) return {low: low, high: high};
      
      if (positions < 32) {
        const newLow = ((low >>> positions) | (high << (32 - positions))) >>> 0;
        const newHigh = ((high >>> positions) | (low << (32 - positions))) >>> 0;
        return {low: newLow, high: newHigh};
      } else {
        // positions >= 32, swap and rotate
        positions -= 32;
        const newLow = ((high >>> positions) | (low << (32 - positions))) >>> 0;
        const newHigh = ((low >>> positions) | (high << (32 - positions))) >>> 0;
        return {low: newLow, high: newHigh};
      }
    },
    
    /**
     * S-box substitution (generic)
     * @param {Array} sbox - S-box lookup table (256 entries)
     * @param {number} input - Input byte (0-255)
     * @returns {number} Substituted byte
     */
    SBoxLookup: function(sbox, input) {
      return sbox[input & 0xFF];
    },
    
    /**
     * Linear transformation matrix multiplication (for AES-like ciphers)
     * @param {Array} matrix - 4x4 transformation matrix
     * @param {Array} column - Input column (4 bytes)
     * @returns {Array} Transformed column (4 bytes)
     */
    MatrixMultiply4x4: function(matrix, column) {
      const result = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          result[i] ^= OpCodes.GF256Mul(matrix[i][j], column[j]);
        }
      }
      return result;
    },
    
    /**
     * Feistel round function (generic)
     * @param {number} left - Left half
     * @param {number} right - Right half
     * @param {number} roundKey - Round key
     * @param {Function} fFunction - F-function
     * @returns {Object} {left, right} - New left and right halves
     */
    FeistelRound: function(left, right, roundKey, fFunction) {
      const fOutput = fFunction(right, roundKey);
      return {
        left: right,
        right: left ^ fOutput
      };
    },
    
    /**
     * LFSR (Linear Feedback Shift Register) step
     * @param {number} state - Current LFSR state
     * @param {number} polynomial - Feedback polynomial
     * @param {number} width - LFSR width in bits
     * @returns {number} New LFSR state
     */
    LFSRStep: function(state, polynomial, width) {
      const mask = (1 << width) - 1;
      const feedback = OpCodes.PopCount(state & polynomial) & 1;
      return ((state >>> 1) | (feedback << (width - 1))) & mask;
    },
    
    /**
     * Population count (number of 1 bits)
     * @param {number} value - Input value
     * @returns {number} Number of 1 bits
     */
    PopCount: function(value) {
      let count = 0;
      while (value) {
        count += value & 1;
        value >>>= 1;
      }
      return count;
    },
    
    /**
     * Polynomial multiplication in GF(2) (for stream ciphers)
     * @param {number} a - First polynomial
     * @param {number} b - Second polynomial
     * @returns {number} Product polynomial
     */
    GF2PolyMul: function(a, b) {
      let result = 0;
      while (b) {
        if (b & 1) {
          result ^= a;
        }
        a <<= 1;
        b >>>= 1;
      }
      return result >>> 0;
    },
    
    /**
     * Efficient GF(2^n) multiplication for arbitrary fields
     * @param {number} a - First element
     * @param {number} b - Second element
     * @param {number} irreducible - Irreducible polynomial
     * @param {number} width - Field width in bits
     * @returns {number} Product in GF(2^n)
     */
    GFMul: function(a, b, irreducible, width) {
      let result = 0;
      const mask = (1 << width) - 1;
      
      while (b) {
        if (b & 1) {
          result ^= a;
        }
        a <<= 1;
        if (a & (1 << width)) {
          a ^= irreducible;
        }
        a &= mask;
        b >>>= 1;
      }
      
      return result;
    },
    
    /**
     * Generate round constants (for key schedules)
     * @param {number} count - Number of constants needed
     * @param {Function} generator - Generator function
     * @returns {Array} Array of round constants
     */
    GenerateRoundConstants: function(count, generator) {
      const constants = [];
      for (let i = 0; i < count; i++) {
        constants[i] = generator(i);
      }
      return constants;
    },
    
    /**
     * Secure random byte generation (for key generation)
     * @param {number} length - Number of bytes needed
     * @returns {Array} Array of random bytes
     */
    SecureRandomBytes: function(length) {
      const bytes = [];
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        // Browser crypto API
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
          bytes[i] = array[i];
        }
      } else if (typeof require !== 'undefined') {
        // Node.js crypto
        try {
          const nodeCrypto = require('crypto');
          const buffer = nodeCrypto.randomBytes(length);
          for (let i = 0; i < length; i++) {
            bytes[i] = buffer[i];
          }
        } catch (e) {
          // Fallback to Math.random (not cryptographically secure)
          console.warn('Using insecure Math.random for key generation');
          for (let i = 0; i < length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
          }
        }
      } else {
        // Fallback to Math.random (not cryptographically secure)
        console.warn('Using insecure Math.random for key generation');
        for (let i = 0; i < length; i++) {
          bytes[i] = Math.floor(Math.random() * 256);
        }
      }
      return bytes;
    },

    // ========================[ PERFORMANCE OPTIMIZATIONS ]========================

    /**
     * Fast byte array cloning using optimized memory copying
     * @param {Array} source - Source array to clone
     * @returns {Array} Cloned array
     */
    FastCloneArray: function(source) {
      if (source.length <= 16) {
        // Unrolled copy for small arrays (faster than slice)
        const result = [];
        for (let i = 0; i < source.length; i++) {
          result[i] = source[i];
        }
        return result;
      }
      return source.slice(0); // Use native slice for larger arrays
    },

    /**
     * Optimized XOR for same-length arrays (no bounds checking)
     * @param {Array} arr1 - First array
     * @param {Array} arr2 - Second array (must be same length)
     * @returns {Array} XOR result
     */
    FastXorArrays: function(arr1, arr2) {
      const result = new Array(arr1.length);
      for (let i = 0; i < arr1.length; i++) {
        result[i] = (arr1[i] ^ arr2[i]) & 0xFF;
      }
      return result;
    },

    /**
     * Optimized in-place XOR (modifies first array)
     * @param {Array} target - Target array (modified in place)
     * @param {Array} source - Source array to XOR with
     * @param {number} length - Number of bytes to process
     */
    FastXorInPlace: function(target, source, length) {
      length = length || Math.min(target.length, source.length);
      for (let i = 0; i < length; i++) {
        target[i] ^= source[i];
      }
    },

    /**
     * High-performance byte substitution using lookup table
     * @param {Array} sbox - 256-entry substitution box
     * @param {Array} input - Input bytes
     * @returns {Array} Substituted bytes
     */
    FastSubBytes: function(sbox, input) {
      const result = new Array(input.length);
      for (let i = 0; i < input.length; i++) {
        result[i] = sbox[input[i]];
      }
      return result;
    },

    /**
     * Optimized 32-bit word array XOR
     * @param {Array} words1 - First word array
     * @param {Array} words2 - Second word array
     * @returns {Array} XOR result
     */
    FastXorWords32: function(words1, words2) {
      const result = new Array(words1.length);
      for (let i = 0; i < words1.length; i++) {
        result[i] = (words1[i] ^ words2[i]) >>> 0;
      }
      return result;
    },

    /**
     * Batch rotate operations for cipher rounds
     * @param {Array} values - Array of 32-bit values
     * @param {number} positions - Rotation positions
     * @returns {Array} Array of rotated values
     */
    BatchRotL32: function(values, positions) {
      const result = new Array(values.length);
      positions &= 31;
      for (let i = 0; i < values.length; i++) {
        const value = values[i] >>> 0;
        result[i] = ((value << positions) | (value >>> (32 - positions))) >>> 0;
      }
      return result;
    },

    /**
     * Memory pool for frequent array allocations
     * Reduces GC pressure in performance-critical cipher operations
     */
    _memoryPool: {
      arrays8: [],   // 8-byte arrays
      arrays16: [],  // 16-byte arrays
      arrays32: [],  // 32-byte arrays
      maxPoolSize: 32
    },

    /**
     * Get reusable array from memory pool
     * @param {number} size - Required array size
     * @returns {Array} Reusable array
     */
    GetPooledArray: function(size) {
      let pool;
      if (size <= 8) pool = this._memoryPool.arrays8;
      else if (size <= 16) pool = this._memoryPool.arrays16;
      else if (size <= 32) pool = this._memoryPool.arrays32;
      else return new Array(size); // Too large for pooling

      if (pool.length > 0) {
        const array = pool.pop();
        // Clear the array
        for (let i = 0; i < size; i++) {
          array[i] = 0;
        }
        return array;
      }
      return new Array(size);
    },

    /**
     * Return array to memory pool for reuse
     * @param {Array} array - Array to return to pool
     */
    ReturnToPool: function(array) {
      if (!array || array.length === 0) return;
      
      let pool;
      if (array.length <= 8) pool = this._memoryPool.arrays8;
      else if (array.length <= 16) pool = this._memoryPool.arrays16;
      else if (array.length <= 32) pool = this._memoryPool.arrays32;
      else return; // Too large for pooling

      if (pool.length < this._memoryPool.maxPoolSize) {
        pool.push(array);
      }
    },

    /**
     * Timing-safe modular arithmetic for constant-time operations
     * @param {number} a - First operand
     * @param {number} b - Second operand
     * @param {number} m - Modulus
     * @returns {number} (a + b) mod m
     */
    TimingSafeAddMod: function(a, b, m) {
      const sum = a + b;
      // Constant-time modular reduction
      const mask = -(sum >= m) & 0xFFFFFFFF;
      return (sum + (mask & -m)) >>> 0;
    },

    /**
     * Branch-free byte selection (constant-time)
     * @param {number} condition - Selection condition (0 or 1)
     * @param {number} a - First value
     * @param {number} b - Second value
     * @returns {number} Returns a if condition=0, b if condition=1
     */
    TimingSafeSelect: function(condition, a, b) {
      const mask = -(condition & 1);
      return (a & ~mask) | (b & mask);
    },

    /**
     * Optimized GF(2^8) table-based multiplication
     * Pre-computed for common multipliers in AES
     */
    _gf256Tables: null,

    /**
     * Initialize GF(2^8) multiplication tables
     */
    InitGF256Tables: function() {
      if (this._gf256Tables) return; // Already initialized
      
      this._gf256Tables = {
        mul2: new Array(256),
        mul3: new Array(256),
        mul9: new Array(256),
        mul11: new Array(256),
        mul13: new Array(256),
        mul14: new Array(256)
      };

      // Pre-compute common multiplication tables
      for (let i = 0; i < 256; i++) {
        this._gf256Tables.mul2[i] = this.GF256Mul(i, 0x02);
        this._gf256Tables.mul3[i] = this.GF256Mul(i, 0x03);
        this._gf256Tables.mul9[i] = this.GF256Mul(i, 0x09);
        this._gf256Tables.mul11[i] = this.GF256Mul(i, 0x0b);
        this._gf256Tables.mul13[i] = this.GF256Mul(i, 0x0d);
        this._gf256Tables.mul14[i] = this.GF256Mul(i, 0x0e);
      }
    },

    /**
     * Fast table-based GF(2^8) multiplication
     * @param {number} a - First operand
     * @param {number} multiplier - Multiplier (2, 3, 9, 11, 13, or 14)
     * @returns {number} Product in GF(2^8)
     */
    FastGF256Mul: function(a, multiplier) {
      if (!this._gf256Tables) this.InitGF256Tables();
      
      switch (multiplier) {
        case 0x02: return this._gf256Tables.mul2[a];
        case 0x03: return this._gf256Tables.mul3[a];
        case 0x09: return this._gf256Tables.mul9[a];
        case 0x0b: return this._gf256Tables.mul11[a];
        case 0x0d: return this._gf256Tables.mul13[a];
        case 0x0e: return this._gf256Tables.mul14[a];
        default: return this.GF256Mul(a, multiplier); // Fallback to general function
      }
    },

    /**
     * Performance monitoring utilities
     */
    _perfCounters: {
      operationCounts: {},
      totalTime: 0,
      startTime: 0
    },

    /**
     * Start performance monitoring
     */
    StartPerfMonitoring: function() {
      this._perfCounters.startTime = Date.now();
      this._perfCounters.operationCounts = {};
    },

    /**
     * Record operation execution
     * @param {string} operation - Operation name
     * @param {number} count - Number of operations performed
     */
    RecordOperation: function(operation, count) {
      count = count || 1;
      if (!this._perfCounters.operationCounts[operation]) {
        this._perfCounters.operationCounts[operation] = 0;
      }
      this._perfCounters.operationCounts[operation] += count;
    },

    /**
     * Get performance statistics
     * @returns {Object} Performance statistics
     */
    GetPerfStats: function() {
      const elapsed = Date.now() - this._perfCounters.startTime;
      const stats = {
        elapsedMs: elapsed,
        operationCounts: this._perfCounters.operationCounts,
        totalOperations: 0
      };
      
      for (const op in this._perfCounters.operationCounts) {
        stats.totalOperations += this._perfCounters.operationCounts[op];
      }
      
      if (elapsed > 0) {
        stats.operationsPerSecond = Math.round(stats.totalOperations * 1000 / elapsed);
      }
      
      return stats;
    },

    // ========================[ ADDITIONAL CONSOLIDATION FUNCTIONS ]========================

    /**
     * Safe modular reduction ensuring positive result
     * @param {number} value - Value to reduce
     * @param {number} modulus - Modulus value
     * @returns {number} Positive result of value mod modulus
     */
    ModSafe: function(value, modulus) {
      const result = value % modulus;
      return result < 0 ? result + modulus : result;
    },

    /**
     * Create array filled with specific value
     * @param {number} length - Array length
     * @param {*} value - Fill value (defaults to 0)
     * @returns {Array} New array filled with value
     */
    CreateArray: function(length, value) {
      value = value !== undefined ? value : 0;
      const arr = new Array(length);
      for (let i = 0; i < length; i++) {
        arr[i] = value;
      }
      return arr;
    },

    /**
     * Array slice operation (safer than native slice for cross-platform)
     * @param {Array} arr - Source array
     * @param {number} start - Start index
     * @param {number} end - End index (optional)
     * @returns {Array} Sliced array
     */
    ArraySlice: function(arr, start, end) {
      end = end !== undefined ? end : arr.length;
      const result = [];
      for (let i = start; i < end && i < arr.length; i++) {
        result.push(arr[i]);
      }
      return result;
    },

    /**
     * Convert multiple bytes to single string character efficiently
     * @param {Array} bytes - Array of byte values
     * @returns {string} String representation
     */
    BytesToStringFast: function(bytes) {
      // Use String.fromCharCode.apply for better performance on large arrays
      if (bytes.length > 1000) {
        let result = '';
        for (let i = 0; i < bytes.length; i += 1000) {
          const chunk = bytes.slice(i, i + 1000);
          result += String.fromCharCode.apply(null, chunk);
        }
        return result;
      } else {
        return String.fromCharCode.apply(null, bytes);
      }
    },

    /**
     * Concatenate multiple byte arrays efficiently
     * @param {...Array} arrays - Arrays to concatenate
     * @returns {Array} Concatenated array
     */
    ConcatArrays: function() {
      let totalLength = 0;
      for (let i = 0; i < arguments.length; i++) {
        totalLength += arguments[i].length;
      }

      const result = new Array(totalLength);
      let offset = 0;
      for (let i = 0; i < arguments.length; i++) {
        const arr = arguments[i];
        for (let j = 0; j < arr.length; j++) {
          result[offset + j] = arr[j];
        }
        offset += arr.length;
      }
      
      return result;
    },

    /**
     * Rotate 128-bit value represented as 16-byte array to the left
     * @param {Array} bytes - 16-byte array representing 128-bit value
     * @param {number} positions - Number of bits to rotate left
     * @returns {Array} Rotated 16-byte array
     */
    RotL128: function(bytes, positions) {
      if (positions === 0 || bytes.length !== 16) return bytes.slice(0);
      
      positions = positions % 128;
      if (positions === 0) return bytes.slice(0);
      
      const result = new Array(16);
      const byteShift = Math.floor(positions / 8);
      const bitShift = positions % 8;
      
      for (let i = 0; i < 16; i++) {
        const sourceIdx = (i + byteShift) % 16;
        let value = bytes[sourceIdx];
        
        if (bitShift > 0) {
          const nextIdx = (sourceIdx + 1) % 16;
          value = ((value << bitShift) | (bytes[nextIdx] >>> (8 - bitShift))) & 0xFF;
        }
        
        result[i] = value;
      }
      
      return result;
    },

    /**
     * Rotate 128-bit value represented as 16-byte array to the right
     * @param {Array} bytes - 16-byte array representing 128-bit value
     * @param {number} positions - Number of bits to rotate right
     * @returns {Array} Rotated 16-byte array
     */
    RotR128: function(bytes, positions) {
      if (positions === 0 || bytes.length !== 16) return bytes.slice(0);
      positions = positions % 128;
      return OpCodes.RotL128(bytes, 128 - positions);
    },

    /**
     * Inverse S-box lookup with validation
     * @param {Array} sbox - Forward S-box (256 entries)
     * @param {number} output - Output value to find input for
     * @returns {number} Input value that produces the output
     */
    InverseSBoxLookup: function(sbox, output) {
      for (let i = 0; i < 256; i++) {
        if (sbox[i] === output) {
          return i;
        }
      }
      return 0; // Default fallback
    },

    /**
     * Build inverse S-box from forward S-box
     * @param {Array} sbox - Forward S-box (256 entries)
     * @returns {Array} Inverse S-box (256 entries)
     */
    BuildInverseSBox: function(sbox) {
      const inverse = new Array(256);
      for (let i = 0; i < 256; i++) {
        inverse[sbox[i]] = i;
      }
      return inverse;
    },

    /**
     * Extract nibbles (4-bit values) from byte
     * @param {number} byte - Input byte
     * @returns {Object} {high: upper 4 bits, low: lower 4 bits}
     */
    SplitNibbles: function(byte) {
      return {
        high: (byte >>> 4) & 0x0F,
        low: byte & 0x0F
      };
    },

    /**
     * Combine nibbles into byte
     * @param {number} high - Upper 4 bits
     * @param {number} low - Lower 4 bits
     * @returns {number} Combined byte
     */
    CombineNibbles: function(high, low) {
      return ((high & 0x0F) << 4) | (low & 0x0F);
    },

    /**
     * Safe array access with bounds checking
     * @param {Array} array - Array to access
     * @param {number} index - Index to access
     * @param {*} defaultValue - Default value if out of bounds
     * @returns {*} Array value or default
     */
    SafeArrayAccess: function(array, index, defaultValue) {
      if (index >= 0 && index < array.length) {
        return array[index];
      }
      return defaultValue !== undefined ? defaultValue : 0;
    },

    /**
     * Circular array access (wraps around)
     * @param {Array} array - Array to access
     * @param {number} index - Index (can be negative or >= length)
     * @returns {*} Array value with circular indexing
     */
    CircularArrayAccess: function(array, index) {
      if (array.length === 0) return undefined;
      index = ((index % array.length) + array.length) % array.length;
      return array[index];
    },

    /**
     * Efficient bit counting (population count)
     * @param {number} value - Value to count bits in
     * @returns {number} Number of set bits
     */
    PopCountFast: function(value) {
      // Brian Kernighan's algorithm - more efficient than simple counting
      let count = 0;
      value = value >>> 0; // Ensure unsigned
      while (value) {
        value &= value - 1; // Clear lowest set bit
        count++;
      }
      return count;
    },

    /**
     * Extract specific bit from value
     * @param {number} value - Source value
     * @param {number} bitIndex - Bit position (0 = LSB)
     * @returns {number} Bit value (0 or 1)
     */
    GetBit: function(value, bitIndex) {
      return (value >>> bitIndex) & 1;
    },

    /**
     * Set specific bit in value
     * @param {number} value - Source value
     * @param {number} bitIndex - Bit position (0 = LSB)
     * @param {number} bitValue - New bit value (0 or 1)
     * @returns {number} Modified value
     */
    SetBit: function(value, bitIndex, bitValue) {
      if (bitValue & 1) {
        return value | (1 << bitIndex);
      } else {
        return value & ~(1 << bitIndex);
      }
    },

    /**
     * Convert 32-bit words array to bytes array (big-endian)
     * @param {Array} words - Array of 32-bit words
     * @returns {Array} Array of bytes
     */
    Words32ToBytesBE: function(words) {
      const bytes = [];
      for (let i = 0; i < words.length; i++) {
        const word = words[i] >>> 0;
        bytes.push((word >>> 24) & 0xFF);
        bytes.push((word >>> 16) & 0xFF);
        bytes.push((word >>> 8) & 0xFF);
        bytes.push(word & 0xFF);
      }
      return bytes;
    },

    /**
     * Convert bytes array to 32-bit words array (big-endian)
     * @param {Array} bytes - Array of bytes
     * @returns {Array} Array of 32-bit words
     */
    BytesToWords32BE: function(bytes) {
      const words = [];
      for (let i = 0; i < bytes.length; i += 4) {
        const b0 = i < bytes.length ? bytes[i] : 0;
        const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
        const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        const b3 = i + 3 < bytes.length ? bytes[i + 3] : 0;
        words.push(OpCodes.Pack32BE(b0, b1, b2, b3));
      }
      return words;
    },

    /**
     * Efficient memory comparison (constant time for security)
     * @param {Array} arr1 - First array
     * @param {Array} arr2 - Second array
     * @param {number} length - Number of elements to compare
     * @returns {boolean} True if equal within specified length
     */
    ConstantTimeCompare: function(arr1, arr2, length) {
      length = length || Math.min(arr1.length, arr2.length);
      let result = 0;
      
      for (let i = 0; i < length; i++) {
        const val1 = i < arr1.length ? arr1[i] : 0;
        const val2 = i < arr2.length ? arr2[i] : 0;
        result |= val1 ^ val2;
      }
      
      // Also check length equality in constant time
      result |= arr1.length ^ arr2.length;
      
      return result === 0;
    },

    /**
     * Generate mask for specific bit width
     * @param {number} bits - Number of bits (1-32)
     * @returns {number} Bit mask
     */
    BitMask: function(bits) {
      if (bits >= 32) return 0xFFFFFFFF;
      if (bits <= 0) return 0;
      return (1 << bits) - 1;
    },

    /**
     * Linear feedback shift register step (generic)
     * @param {number} state - Current LFSR state
     * @param {number} polynomial - Feedback polynomial
     * @param {number} width - LFSR width in bits
     * @returns {number} New LFSR state after one step
     */
    LFSRStepGeneric: function(state, polynomial, width) {
      const mask = OpCodes.BitMask(width);
      const feedback = OpCodes.PopCountFast(state & polynomial) & 1;
      return ((state << 1) | feedback) & mask;
    },

    /**
     * Efficient XOR of array with single byte value
     * @param {Array} array - Array to XOR
     * @param {number} value - Byte value to XOR with each element
     * @returns {Array} New array with XOR applied
     */
    XorArrayWithByte: function(array, value) {
      const result = new Array(array.length);
      value = value & 0xFF;
      for (let i = 0; i < array.length; i++) {
        result[i] = (array[i] ^ value) & 0xFF;
      }
      return result;
    },

    /**
     * Multiply in GF(2^n) with arbitrary irreducible polynomial
     * @param {number} a - First operand
     * @param {number} b - Second operand
     * @param {number} irreducible - Irreducible polynomial
     * @param {number} fieldSize - Field size (n bits)
     * @returns {number} Product in GF(2^n)
     */
    GFMulGeneric: function(a, b, irreducible, fieldSize) {
      let result = 0;
      const mask = OpCodes.BitMask(fieldSize);
      const highBit = 1 << (fieldSize - 1);
      
      a &= mask;
      b &= mask;
      
      while (b > 0) {
        if (b & 1) {
          result ^= a;
        }
        a <<= 1;
        if (a & (1 << fieldSize)) {
          a ^= irreducible;
        }
        a &= mask;
        b >>>= 1;
      }
      
      return result & mask;
    },

    // ========================[ PADDING SCHEMES ]========================

    /**
     * Apply PKCS#7 padding to data
     * @param {number} blockSize - Block size in bytes
     * @param {number} dataLength - Length of data to pad
     * @returns {Array} Padding bytes to append
     */
    PKCS7Padding: function(blockSize, dataLength) {
      if (blockSize <= 0 || blockSize > 255) {
        throw new Error('Block size must be between 1 and 255 bytes');
      }
      
      const padLength = blockSize - (dataLength % blockSize);
      const padding = new Array(padLength);
      
      for (let i = 0; i < padLength; i++) {
        padding[i] = padLength;
      }
      
      return padding;
    },

    /**
     * Remove PKCS#7 padding from data
     * @param {Array} data - Padded data
     * @returns {Array} Data with padding removed
     */
    RemovePKCS7Padding: function(data) {
      if (!data || data.length === 0) {
        throw new Error('Data cannot be empty');
      }
      
      const padLength = data[data.length - 1];
      
      if (padLength <= 0 || padLength > data.length) {
        throw new Error('Invalid PKCS#7 padding');
      }
      
      // Verify padding bytes
      for (let i = data.length - padLength; i < data.length; i++) {
        if (data[i] !== padLength) {
          throw new Error('Invalid PKCS#7 padding bytes');
        }
      }
      
      return data.slice(0, data.length - padLength);
    },

    /**
     * Apply ISO/IEC 7816-4 padding (bit padding)
     * @param {number} blockSize - Block size in bytes
     * @param {number} dataLength - Length of data to pad
     * @returns {Array} Padding bytes to append
     */
    ISO7816Padding: function(blockSize, dataLength) {
      if (blockSize <= 0) {
        throw new Error('Block size must be positive');
      }
      
      const padLength = blockSize - (dataLength % blockSize);
      const padding = new Array(padLength);
      
      // First padding byte is 0x80, rest are 0x00
      padding[0] = 0x80;
      for (let i = 1; i < padLength; i++) {
        padding[i] = 0x00;
      }
      
      return padding;
    },

    /**
     * Remove ISO/IEC 7816-4 padding from data
     * @param {Array} data - Padded data
     * @returns {Array} Data with padding removed
     */
    RemoveISO7816Padding: function(data) {
      if (!data || data.length === 0) {
        throw new Error('Data cannot be empty');
      }
      
      // Find the last 0x80 byte
      let paddingStart = -1;
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i] === 0x80) {
          paddingStart = i;
          break;
        } else if (data[i] !== 0x00) {
          throw new Error('Invalid ISO 7816-4 padding');
        }
      }
      
      if (paddingStart === -1) {
        throw new Error('No padding marker found');
      }
      
      return data.slice(0, paddingStart);
    },

    /**
     * Apply ANSI X9.23 padding
     * @param {number} blockSize - Block size in bytes
     * @param {number} dataLength - Length of data to pad
     * @returns {Array} Padding bytes to append
     */
    ANSIX923Padding: function(blockSize, dataLength) {
      if (blockSize <= 0 || blockSize > 255) {
        throw new Error('Block size must be between 1 and 255 bytes');
      }
      
      const padLength = blockSize - (dataLength % blockSize);
      const padding = new Array(padLength);
      
      // All padding bytes are zero except the last one
      for (let i = 0; i < padLength - 1; i++) {
        padding[i] = 0x00;
      }
      padding[padLength - 1] = padLength;
      
      return padding;
    },

    /**
     * Remove ANSI X9.23 padding from data
     * @param {Array} data - Padded data
     * @returns {Array} Data with padding removed
     */
    RemoveANSIX923Padding: function(data) {
      if (!data || data.length === 0) {
        throw new Error('Data cannot be empty');
      }
      
      const padLength = data[data.length - 1];
      
      if (padLength <= 0 || padLength > data.length) {
        throw new Error('Invalid ANSI X9.23 padding');
      }
      
      // Verify padding bytes (should be zeros except last)
      for (let i = data.length - padLength; i < data.length - 1; i++) {
        if (data[i] !== 0x00) {
          throw new Error('Invalid ANSI X9.23 padding bytes');
        }
      }
      
      return data.slice(0, data.length - padLength);
    },

    /**
     * Apply zero padding
     * @param {number} blockSize - Block size in bytes
     * @param {number} dataLength - Length of data to pad
     * @returns {Array} Padding bytes to append
     */
    ZeroPadding: function(blockSize, dataLength) {
      if (blockSize <= 0) {
        throw new Error('Block size must be positive');
      }
      
      const padLength = blockSize - (dataLength % blockSize);
      const padding = new Array(padLength);
      
      for (let i = 0; i < padLength; i++) {
        padding[i] = 0x00;
      }
      
      return padding;
    },

    /**
     * Remove zero padding from data (ambiguous - removes trailing zeros)
     * @param {Array} data - Padded data
     * @returns {Array} Data with padding removed
     */
    RemoveZeroPadding: function(data) {
      if (!data || data.length === 0) {
        return data;
      }
      
      // Remove trailing zeros
      let end = data.length;
      while (end > 0 && data[end - 1] === 0x00) {
        end--;
      }
      
      return data.slice(0, end);
    },

    /**
     * Apply no padding (data must be block-aligned)
     * @param {number} blockSize - Block size in bytes
     * @param {number} dataLength - Length of data
     * @returns {Array} Empty array (no padding added)
     */
    NoPadding: function(blockSize, dataLength) {
      if (blockSize <= 0) {
        throw new Error('Block size must be positive');
      }
      
      if (dataLength % blockSize !== 0) {
        throw new Error(`Data length (${dataLength}) must be multiple of block size (${blockSize}) for no padding`);
      }
      
      return [];
    },

    /**
     * Remove no padding (no-op)
     * @param {Array} data - Data
     * @returns {Array} Unchanged data
     */
    RemoveNoPadding: function(data) {
      return data;
    },

    /**
     * Apply padding scheme by name
     * @param {string} scheme - Padding scheme name
     * @param {number} blockSize - Block size in bytes
     * @param {number} dataLength - Length of data to pad
     * @returns {Array} Padding bytes to append
     */
    ApplyPadding: function(scheme, blockSize, dataLength) {
      switch (scheme.toUpperCase()) {
        case 'PKCS7':
        case 'PKCS5':
          return this.PKCS7Padding(blockSize, dataLength);
        case 'ISO7816':
        case 'ISO7816-4':
          return this.ISO7816Padding(blockSize, dataLength);
        case 'ANSIX923':
        case 'X923':
          return this.ANSIX923Padding(blockSize, dataLength);
        case 'ZERO':
        case 'ZEROS':
          return this.ZeroPadding(blockSize, dataLength);
        case 'NONE':
        case 'NO':
          return this.NoPadding(blockSize, dataLength);
        default:
          throw new Error(`Unknown padding scheme: ${scheme}`);
      }
    },

    /**
     * Remove padding scheme by name
     * @param {string} scheme - Padding scheme name
     * @param {Array} data - Padded data
     * @returns {Array} Data with padding removed
     */
    RemovePadding: function(scheme, data) {
      switch (scheme.toUpperCase()) {
        case 'PKCS7':
        case 'PKCS5':
          return this.RemovePKCS7Padding(data);
        case 'ISO7816':
        case 'ISO7816-4':
          return this.RemoveISO7816Padding(data);
        case 'ANSIX923':
        case 'X923':
          return this.RemoveANSIX923Padding(data);
        case 'ZERO':
        case 'ZEROS':
          return this.RemoveZeroPadding(data);
        case 'NONE':
        case 'NO':
          return this.RemoveNoPadding(data);
        default:
          throw new Error(`Unknown padding scheme: ${scheme}`);
      }
    }
  };
  
  // Export to global scope
  global.OpCodes = OpCodes;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OpCodes;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);