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
        if (positions === 0) {
          // Simple swap for exact 32-bit rotation
          return {low: high, high: low};
        }
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
        if (positions === 0) {
          // Simple swap for exact 32-bit rotation
          return {low: high, high: low};
        }
        const newLow = ((high >>> positions) | (low << (32 - positions))) >>> 0;
        const newHigh = ((low >>> positions) | (high << (32 - positions))) >>> 0;
        return {low: newLow, high: newHigh};
      }
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
      
      for (let i = 0; i < 16; ++i) {
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

    // ========================[ BYTE/WORD OPERATIONS ]========================
    
    /**
     * Pack 4 bytes into a 32-bit word (big-endian)
     * @param {number} b0 - Most significant byte
     * @param {number} b1 - Second byte
     * @param {number} b2 - Third byte
     * @param {number} b3 - Least significant byte
     * @returns {number} 32-bit word
     */
    Pack16BE: function(b0, b1) {
      return ((b0 & 0xFF) << 8) | (b1 & 0xFF);
    },
    
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
     * Unpack 16-bit word to 2 bytes (big-endian)
     * @param {number} word - 16-bit word to unpack
     * @returns {Array} Array of 2 bytes [b0, b1]
     */
    Unpack16BE: function(word) {
      word = word & 0xFFFF;
      return [
        (word >>> 8) & 0xFF,
        word & 0xFF
      ];
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
     * Convert 32-bit words array to bytes array (big-endian)
     * @param {Array} words - Array of 32-bit words
     * @returns {Array} Array of bytes
     */
    Words32ToBytesBE: function(words) {
      const bytes = [];
      for (let i = 0; i < words.length; ++i) {
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

    /**
     * Split JavaScript number into high/low 32-bit components
     * Safely handles JavaScript's 53-bit integer limitation for 64-bit operations
     * @param {number} value - JavaScript number to split
     * @returns {Object} {high32, low32} - High and low 32-bit components
     */
    Split64: function(value) {
      const low32 = value & 0xFFFFFFFF;
      const high32 = Math.floor(value / 0x100000000);
      return { high32: high32, low32: low32 };
    },

    /**
     * Combine high/low 32-bit components into JavaScript number
     * @param {number} high32 - High 32 bits
     * @param {number} low32 - Low 32 bits
     * @returns {number} Combined JavaScript number
     */
    Combine64: function(high32, low32) {
      return (high32 * 0x100000000) + (low32 >>> 0);
    },

    // ========================[ 64-BIT ARITHMETIC UTILITIES ]========================
    
    /**
     * 64-bit unsigned integer arithmetic utilities
     * Uses [high32, low32] representation for JavaScript compatibility
     * Essential for SHA-512, SHA-384, and other 64-bit cryptographic algorithms
     */
    UInt64: {
      /**
       * Create 64-bit value from high and low 32-bit components
       * @param {number} high - High 32 bits
       * @param {number} low - Low 32 bits  
       * @returns {Array} [high32, low32] representation
       */
      create: function(high, low) {
        return [high >>> 0, low >>> 0];
      },

      /**
       * Create 64-bit value from bytes array (big-endian)
       * @param {Array} bytes - 8-byte array
       * @returns {Array} 64-bit value [high32, low32]
       */
      fromBytes: function(bytes) {
        if (bytes.length < 8) {
          const padded = new Array(8).fill(0);
          for (let i = 0; i < bytes.length; i++) {
            padded[8 - bytes.length + i] = bytes[i];
          }
          bytes = padded;
        }
        return [
          OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]),
          OpCodes.Pack32BE(bytes[4], bytes[5], bytes[6], bytes[7])
        ];
      },

      /**
       * Convert 64-bit value to bytes array (big-endian)
       * @param {Array} a - 64-bit value [high32, low32]
       * @returns {Array} 8-byte array
       */
      toBytes: function(a) {
        const highBytes = OpCodes.Unpack32BE(a[0]);
        const lowBytes = OpCodes.Unpack32BE(a[1]);
        return highBytes.concat(lowBytes);
      },

      /**
       * Create 64-bit value from uint16 array (big-endian)
       * @param {Array} words16 - 4-word array of 16-bit values
       * @returns {Array} 64-bit value [high32, low32]
       */
      fromUInt16: function(words16) {
        if (words16.length < 4) {
          const padded = new Array(4).fill(0);
          for (let i = 0; i < words16.length; i++) {
            padded[4 - words16.length + i] = words16[i];
          }
          words16 = padded;
        }
        return [
          ((words16[0] & 0xFFFF) << 16) | (words16[1] & 0xFFFF),
          ((words16[2] & 0xFFFF) << 16) | (words16[3] & 0xFFFF)
        ];
      },

      /**
       * Convert 64-bit value to uint16 array (big-endian)
       * @param {Array} a - 64-bit value [high32, low32]
       * @returns {Array} 4-word array of 16-bit values
       */
      toUInt16: function(a) {
        return [
          (a[0] >>> 16) & 0xFFFF, a[0] & 0xFFFF,
          (a[1] >>> 16) & 0xFFFF, a[1] & 0xFFFF
        ];
      },

      /**
       * Create 64-bit value from uint32 array (big-endian)
       * @param {Array} words32 - 2-word array of 32-bit values
       * @returns {Array} 64-bit value [high32, low32]
       */
      fromUInt32: function(words32) {
        if (words32.length < 2) {
          const padded = new Array(2).fill(0);
          for (let i = 0; i < words32.length; i++) {
            padded[2 - words32.length + i] = words32[i];
          }
          words32 = padded;
        }
        return [words32[0] >>> 0, words32[1] >>> 0];
      },

      /**
       * Convert 64-bit value to uint32 array (big-endian)
       * @param {Array} a - 64-bit value [high32, low32]
       * @returns {Array} 2-word array of 32-bit values
       */
      toUInt32: function(a) {
        return [a[0], a[1]];
      },

      /**
       * 64-bit addition
       * @param {Array} a - First 64-bit value [high32, low32]
       * @param {Array} b - Second 64-bit value [high32, low32]
       * @returns {Array} Sum as [high32, low32]
       */
      add: function(a, b) {
        const low = (a[1] + b[1]) >>> 0;
        const high = (a[0] + b[0] + (low < a[1] ? 1 : 0)) >>> 0;
        return [high, low];
      },

      /**
       * 64-bit subtraction
       * @param {Array} a - First 64-bit value (minuend) [high32, low32]
       * @param {Array} b - Second 64-bit value (subtrahend) [high32, low32]
       * @returns {Array} Difference as [high32, low32]
       */
      sub: function(a, b) {
        const low = (a[1] - b[1]) >>> 0;
        const high = (a[0] - b[0] - (a[1] < b[1] ? 1 : 0)) >>> 0;
        return [high, low];
      },

      /**
       * 64-bit multiplication (returns low 64 bits of result)
       * @param {Array} a - First 64-bit value [high32, low32]
       * @param {Array} b - Second 64-bit value [high32, low32]
       * @returns {Array} Product as [high32, low32] (truncated)
       */
      mul: function(a, b) {
        const a0 = a[1] & 0xFFFF;
        const a1 = a[1] >>> 16;
        const a2 = a[0] & 0xFFFF;
        const a3 = a[0] >>> 16;
        
        const b0 = b[1] & 0xFFFF;
        const b1 = b[1] >>> 16;
        const b2 = b[0] & 0xFFFF;
        const b3 = b[0] >>> 16;
        
        let c0 = a0 * b0;
        let c1 = a1 * b0 + a0 * b1 + (c0 >>> 16);
        let c2 = a2 * b0 + a1 * b1 + a0 * b2 + (c1 >>> 16);
        let c3 = a3 * b0 + a2 * b1 + a1 * b2 + a0 * b3 + (c2 >>> 16);
        
        return [
          ((c3 & 0xFFFF) << 16) | (c2 & 0xFFFF),
          ((c1 & 0xFFFF) << 16) | (c0 & 0xFFFF)
        ];
      },

      /**
       * 64-bit right rotation
       * @param {Array} a - 64-bit value [high32, low32]
       * @param {number} n - Number of positions to rotate (0-63)
       * @returns {Array} Rotated value as [high32, low32]
       */
      rotr: function(a, n) {
        if (n === 0) return a;
        n = n % 64; // Ensure n is within valid range
        
        if (n < 32) {
          // For rotations less than 32 bits
          const high = ((a[0] >>> n) | ((a[1] << (32 - n)) & 0xFFFFFFFF)) >>> 0;
          const low = ((a[1] >>> n) | ((a[0] << (32 - n)) & 0xFFFFFFFF)) >>> 0;
          return [high, low];
        } else {
          // For rotations 32 bits or more, swap and adjust
          const shift = n - 32;
          const high = ((a[1] >>> shift) | ((a[0] << (32 - shift)) & 0xFFFFFFFF)) >>> 0;
          const low = ((a[0] >>> shift) | ((a[1] << (32 - shift)) & 0xFFFFFFFF)) >>> 0;
          return [high, low];
        }
      },

      /**
       * 64-bit left rotation
       * @param {Array} a - 64-bit value [high32, low32]
       * @param {number} n - Number of positions to rotate (0-63)
       * @returns {Array} Rotated value as [high32, low32]
       */
      rotl: function(a, n) {
        if (n === 0) return a;
        return OpCodes.UInt64.rotr(a, 64 - (n % 64));
      },

      /**
       * 64-bit right shift (logical)
       * @param {Array} a - 64-bit value [high32, low32]
       * @param {number} n - Number of positions to shift (0-63)
       * @returns {Array} Shifted value as [high32, low32]
       */
      shr: function(a, n) {
        if (n === 0) return a;
        if (n < 32) {
          const high = (a[0] >>> n) >>> 0;
          const low = ((a[1] >>> n) | (a[0] << (32 - n))) >>> 0;
          return [high, low];
        } else {
          return [0, (a[0] >>> (n - 32)) >>> 0];
        }
      },

      /**
       * 64-bit left shift (logical)
       * @param {Array} a - 64-bit value [high32, low32]
       * @param {number} n - Number of positions to shift (0-63)
       * @returns {Array} Shifted value as [high32, low32]
       */
      shl: function(a, n) {
        if (n === 0) return a;
        if (n < 32) {
          const high = ((a[0] << n) | (a[1] >>> (32 - n))) >>> 0;
          const low = (a[1] << n) >>> 0;
          return [high, low];
        } else {
          return [(a[1] << (n - 32)) >>> 0, 0];
        }
      },

      /**
       * 64-bit XOR operation
       * @param {Array} a - First 64-bit value [high32, low32]
       * @param {Array} b - Second 64-bit value [high32, low32]
       * @returns {Array} XOR result as [high32, low32]
       */
      xor: function(a, b) {
        return [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0];
      },

      /**
       * 64-bit AND operation
       * @param {Array} a - First 64-bit value [high32, low32]
       * @param {Array} b - Second 64-bit value [high32, low32]
       * @returns {Array} AND result as [high32, low32]
       */
      and: function(a, b) {
        return [(a[0] & b[0]) >>> 0, (a[1] & b[1]) >>> 0];
      },

      /**
       * 64-bit OR operation
       * @param {Array} a - First 64-bit value [high32, low32]
       * @param {Array} b - Second 64-bit value [high32, low32]
       * @returns {Array} OR result as [high32, low32]
       */
      or: function(a, b) {
        return [(a[0] | b[0]) >>> 0, (a[1] | b[1]) >>> 0];
      },

      /**
       * 64-bit NOT operation
       * @param {Array} a - 64-bit value [high32, low32]
       * @returns {Array} NOT result as [high32, low32]
       */
      not: function(a) {
        return [(~a[0]) >>> 0, (~a[1]) >>> 0];
      },

      /**
       * Convert 64-bit value to JavaScript number (loses precision beyond 53 bits)
       * @param {Array} a - 64-bit value [high32, low32]
       * @returns {number} JavaScript number representation
       */
      toNumber: function(a) {
        return OpCodes.Combine64(a[0], a[1]);
      },

      /**
       * Create 64-bit value from JavaScript number
       * @param {number} num - JavaScript number
       * @returns {Array} 64-bit representation as [high32, low32]
       */
      fromNumber: function(num) {
        const split = OpCodes.Split64(num);
        return [split.high32, split.low32];
      },

      /**
       * Compare two 64-bit values for equality
       * @param {Array} a - First 64-bit value [high32, low32]
       * @param {Array} b - Second 64-bit value [high32, low32]
       * @returns {boolean} True if equal
       */
      equals: function(a, b) {
        return a[0] === b[0] && a[1] === b[1];
      },

      /**
       * Clone 64-bit value
       * @param {Array} a - 64-bit value [high32, low32]
       * @returns {Array} Cloned value as [high32, low32]
       */
      clone: function(a) {
        return [a[0], a[1]];
      }
    },

    /**
     * 128-bit unsigned integer arithmetic utilities
     * Uses [word3, word2, word1, word0] representation (big-endian word order)
     * Essential for cryptographic algorithms requiring 128-bit precision
     */
    UInt128: {
      /**
       * Create 128-bit value from four 32-bit words
       * @param {number} w3 - Most significant word
       * @param {number} w2 - Second word
       * @param {number} w1 - Third word
       * @param {number} w0 - Least significant word
       * @returns {Array} [w3, w2, w1, w0] representation
       */
      create: function(w3, w2, w1, w0) {
        return [(w3 || 0) >>> 0, (w2 || 0) >>> 0, (w1 || 0) >>> 0, (w0 || 0) >>> 0];
      },

      /**
       * Create 128-bit value from two 64-bit values
       * @param {Array} high64 - High 64 bits [high32, low32]
       * @param {Array} low64 - Low 64 bits [high32, low32]
       * @returns {Array} 128-bit value [w3, w2, w1, w0]
       */
      fromUInt64: function(high64, low64) {
        return [high64[0], high64[1], low64[0], low64[1]];
      },

      /**
       * Split 128-bit value into two 64-bit values
       * @param {Array} a - 128-bit value [w3, w2, w1, w0]
       * @returns {Object} {high64: [w3, w2], low64: [w1, w0]}
       */
      toUInt64: function(a) {
        return {
          high64: [a[0], a[1]],
          low64: [a[2], a[3]]
        };
      },

      /**
       * Create 128-bit value from bytes array (big-endian)
       * @param {Array} bytes - 16-byte array
       * @returns {Array} 128-bit value [w3, w2, w1, w0]
       */
      fromBytes: function(bytes) {
        if (bytes.length < 16) {
          // Pad with zeros if needed
          const padded = new Array(16).fill(0);
          for (let i = 0; i < bytes.length; i++) {
            padded[16 - bytes.length + i] = bytes[i];
          }
          bytes = padded;
        }
        return [
          OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]),
          OpCodes.Pack32BE(bytes[4], bytes[5], bytes[6], bytes[7]),
          OpCodes.Pack32BE(bytes[8], bytes[9], bytes[10], bytes[11]),
          OpCodes.Pack32BE(bytes[12], bytes[13], bytes[14], bytes[15])
        ];
      },

      /**
       * Convert 128-bit value to bytes array (big-endian)
       * @param {Array} a - 128-bit value [w3, w2, w1, w0]
       * @returns {Array} 16-byte array
       */
      toBytes: function(a) {
        const result = [];
        for (let i = 0; i < 4; i++) {
          const bytes = OpCodes.Unpack32BE(a[i]);
          result.push(...bytes);
        }
        return result;
      },

      /**
       * Create 128-bit value from uint16 array (big-endian)
       * @param {Array} words16 - 8-word array of 16-bit values
       * @returns {Array} 128-bit value [w3, w2, w1, w0]
       */
      fromUInt16: function(words16) {
        if (words16.length < 8) {
          const padded = new Array(8).fill(0);
          for (let i = 0; i < words16.length; i++) {
            padded[8 - words16.length + i] = words16[i];
          }
          words16 = padded;
        }
        return [
          ((words16[0] & 0xFFFF) << 16) | (words16[1] & 0xFFFF),
          ((words16[2] & 0xFFFF) << 16) | (words16[3] & 0xFFFF),
          ((words16[4] & 0xFFFF) << 16) | (words16[5] & 0xFFFF),
          ((words16[6] & 0xFFFF) << 16) | (words16[7] & 0xFFFF)
        ];
      },

      /**
       * Convert 128-bit value to uint16 array (big-endian)
       * @param {Array} a - 128-bit value [w3, w2, w1, w0]
       * @returns {Array} 8-word array of 16-bit values
       */
      toUInt16: function(a) {
        const result = [];
        for (let i = 0; i < 4; i++) {
          result.push((a[i] >>> 16) & 0xFFFF);
          result.push(a[i] & 0xFFFF);
        }
        return result;
      },

      /**
       * Create 128-bit value from uint32 array (big-endian)
       * @param {Array} words32 - 4-word array of 32-bit values
       * @returns {Array} 128-bit value [w3, w2, w1, w0]
       */
      fromUInt32: function(words32) {
        if (words32.length < 4) {
          const padded = new Array(4).fill(0);
          for (let i = 0; i < words32.length; i++) {
            padded[4 - words32.length + i] = words32[i];
          }
          words32 = padded;
        }
        return [words32[0] >>> 0, words32[1] >>> 0, words32[2] >>> 0, words32[3] >>> 0];
      },

      /**
       * Convert 128-bit value to uint32 array (big-endian)
       * @param {Array} a - 128-bit value [w3, w2, w1, w0]
       * @returns {Array} 4-word array of 32-bit values
       */
      toUInt32: function(a) {
        return [a[0], a[1], a[2], a[3]];
      },

      /**
       * 128-bit addition
       * @param {Array} a - First 128-bit value
       * @param {Array} b - Second 128-bit value
       * @returns {Array} Sum as 128-bit value
       */
      add: function(a, b) {
        let carry = 0;
        const result = new Array(4);
        
        for (let i = 3; i >= 0; i--) {
          const sum = a[i] + b[i] + carry;
          result[i] = sum >>> 0;
          carry = sum > 0xFFFFFFFF ? 1 : 0;
        }
        
        return result;
      },

      /**
       * 128-bit subtraction
       * @param {Array} a - First 128-bit value (minuend)
       * @param {Array} b - Second 128-bit value (subtrahend)
       * @returns {Array} Difference as 128-bit value
       */
      sub: function(a, b) {
        let borrow = 0;
        const result = new Array(4);
        
        for (let i = 3; i >= 0; i--) {
          const diff = a[i] - b[i] - borrow;
          result[i] = diff >>> 0;
          borrow = diff < 0 ? 1 : 0;
        }
        
        return result;
      },

      /**
       * 128-bit multiplication (returns low 128 bits of result)
       * @param {Array} a - First 128-bit value
       * @param {Array} b - Second 128-bit value
       * @returns {Array} Product as 128-bit value (truncated)
       */
      mul: function(a, b) {
        const result = new Array(4).fill(0);
        
        for (let i = 3; i >= 0; i--) {
          let carry = 0;
          for (let j = 3; j >= 0; j--) {
            if (i + j >= 3) {
              const prod = a[i] * b[j] + result[i + j - 3] + carry;
              result[i + j - 3] = prod >>> 0;
              carry = Math.floor(prod / 0x100000000);
            }
          }
        }
        
        return result;
      },

      /**
       * 128-bit XOR operation
       * @param {Array} a - First 128-bit value
       * @param {Array} b - Second 128-bit value
       * @returns {Array} XOR result
       */
      xor: function(a, b) {
        return [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0, (a[2] ^ b[2]) >>> 0, (a[3] ^ b[3]) >>> 0];
      },

      /**
       * 128-bit AND operation
       * @param {Array} a - First 128-bit value
       * @param {Array} b - Second 128-bit value
       * @returns {Array} AND result
       */
      and: function(a, b) {
        return [(a[0] & b[0]) >>> 0, (a[1] & b[1]) >>> 0, (a[2] & b[2]) >>> 0, (a[3] & b[3]) >>> 0];
      },

      /**
       * 128-bit OR operation
       * @param {Array} a - First 128-bit value
       * @param {Array} b - Second 128-bit value
       * @returns {Array} OR result
       */
      or: function(a, b) {
        return [(a[0] | b[0]) >>> 0, (a[1] | b[1]) >>> 0, (a[2] | b[2]) >>> 0, (a[3] | b[3]) >>> 0];
      },

      /**
       * 128-bit NOT operation
       * @param {Array} a - 128-bit value
       * @returns {Array} NOT result
       */
      not: function(a) {
        return [(~a[0]) >>> 0, (~a[1]) >>> 0, (~a[2]) >>> 0, (~a[3]) >>> 0];
      },

      /**
       * 128-bit left shift
       * @param {Array} a - 128-bit value
       * @param {number} n - Number of positions to shift (0-127)
       * @returns {Array} Shifted value
       */
      shl: function(a, n) {
        if (n === 0) return a.slice();
        n = n % 128;
        if (n === 0) return a.slice();
        
        const result = [0, 0, 0, 0];
        const wordShift = Math.floor(n / 32);
        const bitShift = n % 32;
        
        for (let i = 0; i < 4; i++) {
          const srcIndex = i + wordShift;
          if (srcIndex < 4) {
            result[i] |= (a[srcIndex] << bitShift) >>> 0;
            if (bitShift > 0 && srcIndex + 1 < 4) {
              result[i] |= a[srcIndex + 1] >>> (32 - bitShift);
            }
          }
        }
        
        return result;
      },

      /**
       * 128-bit right shift
       * @param {Array} a - 128-bit value
       * @param {number} n - Number of positions to shift (0-127)
       * @returns {Array} Shifted value
       */
      shr: function(a, n) {
        if (n === 0) return a.slice();
        n = n % 128;
        if (n === 0) return a.slice();
        
        const result = [0, 0, 0, 0];
        const wordShift = Math.floor(n / 32);
        const bitShift = n % 32;
        
        for (let i = 3; i >= 0; i--) {
          const srcIndex = i - wordShift;
          if (srcIndex >= 0) {
            result[i] |= a[srcIndex] >>> bitShift;
            if (bitShift > 0 && srcIndex - 1 >= 0) {
              result[i] |= (a[srcIndex - 1] << (32 - bitShift)) >>> 0;
            }
          }
        }
        
        return result;
      },

      /**
       * 128-bit right rotation
       * @param {Array} a - 128-bit value
       * @param {number} n - Number of positions to rotate (0-127)
       * @returns {Array} Rotated value
       */
      rotr: function(a, n) {
        if (n === 0) return a.slice();
        n = n % 128;
        if (n === 0) return a.slice();
        
        const shifted = OpCodes.UInt128.shr(a, n);
        const rotated = OpCodes.UInt128.shl(a, 128 - n);
        return OpCodes.UInt128.or(shifted, rotated);
      },

      /**
       * 128-bit left rotation
       * @param {Array} a - 128-bit value
       * @param {number} n - Number of positions to rotate (0-127)
       * @returns {Array} Rotated value
       */
      rotl: function(a, n) {
        if (n === 0) return a.slice();
        return OpCodes.UInt128.rotr(a, 128 - (n % 128));
      },

      /**
       * Compare two 128-bit values for equality
       * @param {Array} a - First 128-bit value
       * @param {Array} b - Second 128-bit value
       * @returns {boolean} True if equal
       */
      equals: function(a, b) {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
      },

      /**
       * Clone 128-bit value
       * @param {Array} a - 128-bit value
       * @returns {Array} Cloned value
       */
      clone: function(a) {
        return [a[0], a[1], a[2], a[3]];
      },

      /**
       * Check if 128-bit value is zero
       * @param {Array} a - 128-bit value
       * @returns {boolean} True if zero
       */
      isZero: function(a) {
        return a[0] === 0 && a[1] === 0 && a[2] === 0 && a[3] === 0;
      }
    },

    /**
     * 256-bit unsigned integer arithmetic utilities
     * Uses [w7, w6, w5, w4, w3, w2, w1, w0] representation (big-endian word order)
     * Essential for ECC, RSA, and other public-key cryptographic algorithms
     */
    UInt256: {
      /**
       * Create 256-bit value from eight 32-bit words
       * @param {number} w7 - Most significant word
       * @param {number} w6 - Second word
       * @param {number} w5 - Third word
       * @param {number} w4 - Fourth word
       * @param {number} w3 - Fifth word
       * @param {number} w2 - Sixth word
       * @param {number} w1 - Seventh word
       * @param {number} w0 - Least significant word
       * @returns {Array} [w7, w6, w5, w4, w3, w2, w1, w0] representation
       */
      create: function(w7, w6, w5, w4, w3, w2, w1, w0) {
        return [
          (w7 || 0) >>> 0, (w6 || 0) >>> 0, (w5 || 0) >>> 0, (w4 || 0) >>> 0,
          (w3 || 0) >>> 0, (w2 || 0) >>> 0, (w1 || 0) >>> 0, (w0 || 0) >>> 0
        ];
      },

      /**
       * Create 256-bit value from two 128-bit values
       * @param {Array} high128 - High 128 bits
       * @param {Array} low128 - Low 128 bits
       * @returns {Array} 256-bit value
       */
      fromUInt128: function(high128, low128) {
        return [high128[0], high128[1], high128[2], high128[3], low128[0], low128[1], low128[2], low128[3]];
      },

      /**
       * Create 256-bit value from bytes array (big-endian)
       * @param {Array} bytes - 32-byte array
       * @returns {Array} 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
       */
      fromBytes: function(bytes) {
        if (bytes.length < 32) {
          const padded = new Array(32).fill(0);
          for (let i = 0; i < bytes.length; i++) {
            padded[32 - bytes.length + i] = bytes[i];
          }
          bytes = padded;
        }
        const result = new Array(8);
        for (let i = 0; i < 8; i++) {
          const offset = i * 4;
          result[i] = OpCodes.Pack32BE(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
        }
        return result;
      },

      /**
       * Convert 256-bit value to bytes array (big-endian)
       * @param {Array} a - 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
       * @returns {Array} 32-byte array
       */
      toBytes: function(a) {
        const result = [];
        for (let i = 0; i < 8; i++) {
          const bytes = OpCodes.Unpack32BE(a[i]);
          result.push(...bytes);
        }
        return result;
      },

      /**
       * Create 256-bit value from uint16 array (big-endian)
       * @param {Array} words16 - 16-word array of 16-bit values
       * @returns {Array} 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
       */
      fromUInt16: function(words16) {
        if (words16.length < 16) {
          const padded = new Array(16).fill(0);
          for (let i = 0; i < words16.length; i++) {
            padded[16 - words16.length + i] = words16[i];
          }
          words16 = padded;
        }
        const result = new Array(8);
        for (let i = 0; i < 8; i++) {
          const offset = i * 2;
          result[i] = ((words16[offset] & 0xFFFF) << 16) | (words16[offset + 1] & 0xFFFF);
        }
        return result;
      },

      /**
       * Convert 256-bit value to uint16 array (big-endian)
       * @param {Array} a - 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
       * @returns {Array} 16-word array of 16-bit values
       */
      toUInt16: function(a) {
        const result = [];
        for (let i = 0; i < 8; i++) {
          result.push((a[i] >>> 16) & 0xFFFF);
          result.push(a[i] & 0xFFFF);
        }
        return result;
      },

      /**
       * Create 256-bit value from uint32 array (big-endian)
       * @param {Array} words32 - 8-word array of 32-bit values
       * @returns {Array} 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
       */
      fromUInt32: function(words32) {
        if (words32.length < 8) {
          const padded = new Array(8).fill(0);
          for (let i = 0; i < words32.length; i++) {
            padded[8 - words32.length + i] = words32[i];
          }
          words32 = padded;
        }
        const result = new Array(8);
        for (let i = 0; i < 8; i++) {
          result[i] = words32[i] >>> 0;
        }
        return result;
      },

      /**
       * Convert 256-bit value to uint32 array (big-endian)
       * @param {Array} a - 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
       * @returns {Array} 8-word array of 32-bit values
       */
      toUInt32: function(a) {
        return a.slice();
      },

      /**
       * Create 256-bit value from uint64 array (big-endian)
       * @param {Array} words64 - Array of 4 UInt64 values [[h,l], [h,l], [h,l], [h,l]]
       * @returns {Array} 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
       */
      fromUInt64: function(words64) {
        if (words64.length < 4) {
          const padded = new Array(4);
          for (let i = 0; i < 4; i++) {
            padded[i] = i < (4 - words64.length) ? [0, 0] : words64[i - (4 - words64.length)];
          }
          words64 = padded;
        }
        return [
          words64[0][0], words64[0][1], words64[1][0], words64[1][1],
          words64[2][0], words64[2][1], words64[3][0], words64[3][1]
        ];
      },

      /**
       * Convert 256-bit value to uint64 array (big-endian)
       * @param {Array} a - 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
       * @returns {Array} Array of 4 UInt64 values [[h,l], [h,l], [h,l], [h,l]]
       */
      toUInt64: function(a) {
        return [
          [a[0], a[1]], [a[2], a[3]], [a[4], a[5]], [a[6], a[7]]
        ];
      },

      /**
       * 256-bit addition
       * @param {Array} a - First 256-bit value
       * @param {Array} b - Second 256-bit value
       * @returns {Array} Sum as 256-bit value
       */
      add: function(a, b) {
        let carry = 0;
        const result = new Array(8);
        
        for (let i = 7; i >= 0; i--) {
          const sum = a[i] + b[i] + carry;
          result[i] = sum >>> 0;
          carry = sum > 0xFFFFFFFF ? 1 : 0;
        }
        
        return result;
      },

      /**
       * 256-bit subtraction
       * @param {Array} a - First 256-bit value (minuend)
       * @param {Array} b - Second 256-bit value (subtrahend)
       * @returns {Array} Difference as 256-bit value
       */
      sub: function(a, b) {
        let borrow = 0;
        const result = new Array(8);
        
        for (let i = 7; i >= 0; i--) {
          const diff = a[i] - b[i] - borrow;
          result[i] = diff >>> 0;
          borrow = diff < 0 ? 1 : 0;
        }
        
        return result;
      },

      /**
       * 256-bit multiplication (returns low 256 bits of result)
       * @param {Array} a - First 256-bit value
       * @param {Array} b - Second 256-bit value
       * @returns {Array} Product as 256-bit value (truncated)
       */
      mul: function(a, b) {
        const result = new Array(8).fill(0);
        
        for (let i = 7; i >= 0; i--) {
          let carry = 0;
          for (let j = 7; j >= 0; j--) {
            if (i + j >= 7) {
              const prod = a[i] * b[j] + result[i + j - 7] + carry;
              result[i + j - 7] = prod >>> 0;
              carry = Math.floor(prod / 0x100000000);
            }
          }
        }
        
        return result;
      },

      /**
       * 256-bit XOR operation
       * @param {Array} a - First 256-bit value
       * @param {Array} b - Second 256-bit value
       * @returns {Array} XOR result
       */
      xor: function(a, b) {
        const result = new Array(8);
        for (let i = 0; i < 8; i++) {
          result[i] = (a[i] ^ b[i]) >>> 0;
        }
        return result;
      },

      /**
       * 256-bit AND operation
       * @param {Array} a - First 256-bit value
       * @param {Array} b - Second 256-bit value
       * @returns {Array} AND result
       */
      and: function(a, b) {
        const result = new Array(8);
        for (let i = 0; i < 8; i++) {
          result[i] = (a[i] & b[i]) >>> 0;
        }
        return result;
      },

      /**
       * 256-bit OR operation
       * @param {Array} a - First 256-bit value
       * @param {Array} b - Second 256-bit value
       * @returns {Array} OR result
       */
      or: function(a, b) {
        const result = new Array(8);
        for (let i = 0; i < 8; i++) {
          result[i] = (a[i] | b[i]) >>> 0;
        }
        return result;
      },

      /**
       * 256-bit NOT operation
       * @param {Array} a - 256-bit value
       * @returns {Array} NOT result
       */
      not: function(a) {
        const result = new Array(8);
        for (let i = 0; i < 8; i++) {
          result[i] = (~a[i]) >>> 0;
        }
        return result;
      },

      /**
       * 256-bit left shift
       * @param {Array} a - 256-bit value
       * @param {number} n - Number of positions to shift (0-255)
       * @returns {Array} Shifted value
       */
      shl: function(a, n) {
        if (n === 0) return a.slice();
        n = n % 256;
        if (n === 0) return a.slice();
        
        const result = new Array(8).fill(0);
        const wordShift = Math.floor(n / 32);
        const bitShift = n % 32;
        
        for (let i = 0; i < 8; i++) {
          const srcIndex = i + wordShift;
          if (srcIndex < 8) {
            result[i] |= (a[srcIndex] << bitShift) >>> 0;
            if (bitShift > 0 && srcIndex + 1 < 8) {
              result[i] |= a[srcIndex + 1] >>> (32 - bitShift);
            }
          }
        }
        
        return result;
      },

      /**
       * 256-bit right shift
       * @param {Array} a - 256-bit value
       * @param {number} n - Number of positions to shift (0-255)
       * @returns {Array} Shifted value
       */
      shr: function(a, n) {
        if (n === 0) return a.slice();
        n = n % 256;
        if (n === 0) return a.slice();
        
        const result = new Array(8).fill(0);
        const wordShift = Math.floor(n / 32);
        const bitShift = n % 32;
        
        for (let i = 7; i >= 0; i--) {
          const srcIndex = i - wordShift;
          if (srcIndex >= 0) {
            result[i] |= a[srcIndex] >>> bitShift;
            if (bitShift > 0 && srcIndex - 1 >= 0) {
              result[i] |= (a[srcIndex - 1] << (32 - bitShift)) >>> 0;
            }
          }
        }
        
        return result;
      },

      /**
       * 256-bit right rotation
       * @param {Array} a - 256-bit value
       * @param {number} n - Number of positions to rotate (0-255)
       * @returns {Array} Rotated value
       */
      rotr: function(a, n) {
        if (n === 0) return a.slice();
        n = n % 256;
        if (n === 0) return a.slice();
        
        const shifted = OpCodes.UInt256.shr(a, n);
        const rotated = OpCodes.UInt256.shl(a, 256 - n);
        return OpCodes.UInt256.or(shifted, rotated);
      },

      /**
       * 256-bit left rotation
       * @param {Array} a - 256-bit value
       * @param {number} n - Number of positions to rotate (0-255)
       * @returns {Array} Rotated value
       */
      rotl: function(a, n) {
        if (n === 0) return a.slice();
        return OpCodes.UInt256.rotr(a, 256 - (n % 256));
      },

      /**
       * Compare two 256-bit values for equality
       * @param {Array} a - First 256-bit value
       * @param {Array} b - Second 256-bit value
       * @returns {boolean} True if equal
       */
      equals: function(a, b) {
        for (let i = 0; i < 8; i++) {
          if (a[i] !== b[i]) return false;
        }
        return true;
      },

      /**
       * Clone 256-bit value
       * @param {Array} a - 256-bit value
       * @returns {Array} Cloned value
       */
      clone: function(a) {
        return a.slice();
      },

      /**
       * Check if 256-bit value is zero
       * @param {Array} a - 256-bit value
       * @returns {boolean} True if zero
       */
      isZero: function(a) {
        for (let i = 0; i < 8; i++) {
          if (a[i] !== 0) return false;
        }
        return true;
      }
    },

    /**
     * 512-bit unsigned integer arithmetic utilities
     * Uses [w15, w14, ..., w1, w0] representation (big-endian word order)
     * Essential for RSA-4096, post-quantum cryptography, and extended-precision arithmetic
     */
    UInt512: {
      /**
       * Create 512-bit value from sixteen 32-bit words
       * @param {...number} words - Up to 16 words (w15 to w0, MSB first)
       * @returns {Array} [w15, w14, ..., w1, w0] representation
       */
      create: function() {
        const result = new Array(16).fill(0);
        for (let i = 0; i < Math.min(arguments.length, 16); i++) {
          result[15 - i] = (arguments[i] || 0) >>> 0;
        }
        return result;
      },

      /**
       * Create 512-bit value from two 256-bit values
       * @param {Array} high256 - High 256 bits
       * @param {Array} low256 - Low 256 bits
       * @returns {Array} 512-bit value
       */
      fromUInt256: function(high256, low256) {
        return high256.concat(low256);
      },

      /**
       * Create 512-bit value from bytes array (big-endian)
       * @param {Array} bytes - 64-byte array
       * @returns {Array} 512-bit value [w15, w14, ..., w1, w0]
       */
      fromBytes: function(bytes) {
        if (bytes.length < 64) {
          const padded = new Array(64).fill(0);
          for (let i = 0; i < bytes.length; i++) {
            padded[64 - bytes.length + i] = bytes[i];
          }
          bytes = padded;
        }
        const result = new Array(16);
        for (let i = 0; i < 16; i++) {
          const offset = i * 4;
          result[i] = OpCodes.Pack32BE(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
        }
        return result;
      },

      /**
       * Convert 512-bit value to bytes array (big-endian)
       * @param {Array} a - 512-bit value [w15, w14, ..., w1, w0]
       * @returns {Array} 64-byte array
       */
      toBytes: function(a) {
        const result = [];
        for (let i = 0; i < 16; i++) {
          const bytes = OpCodes.Unpack32BE(a[i]);
          result.push(...bytes);
        }
        return result;
      },

      /**
       * Create 512-bit value from uint16 array (big-endian)
       * @param {Array} words16 - 32-word array of 16-bit values
       * @returns {Array} 512-bit value [w15, w14, ..., w1, w0]
       */
      fromUInt16: function(words16) {
        if (words16.length < 32) {
          const padded = new Array(32).fill(0);
          for (let i = 0; i < words16.length; i++) {
            padded[32 - words16.length + i] = words16[i];
          }
          words16 = padded;
        }
        const result = new Array(16);
        for (let i = 0; i < 16; i++) {
          const offset = i * 2;
          result[i] = ((words16[offset] & 0xFFFF) << 16) | (words16[offset + 1] & 0xFFFF);
        }
        return result;
      },

      /**
       * Convert 512-bit value to uint16 array (big-endian)
       * @param {Array} a - 512-bit value [w15, w14, ..., w1, w0]
       * @returns {Array} 32-word array of 16-bit values
       */
      toUInt16: function(a) {
        const result = [];
        for (let i = 0; i < 16; i++) {
          result.push((a[i] >>> 16) & 0xFFFF);
          result.push(a[i] & 0xFFFF);
        }
        return result;
      },

      /**
       * Create 512-bit value from uint32 array (big-endian)
       * @param {Array} words32 - 16-word array of 32-bit values
       * @returns {Array} 512-bit value [w15, w14, ..., w1, w0]
       */
      fromUInt32: function(words32) {
        if (words32.length < 16) {
          const padded = new Array(16).fill(0);
          for (let i = 0; i < words32.length; i++) {
            padded[16 - words32.length + i] = words32[i];
          }
          words32 = padded;
        }
        const result = new Array(16);
        for (let i = 0; i < 16; i++) {
          result[i] = words32[i] >>> 0;
        }
        return result;
      },

      /**
       * Convert 512-bit value to uint32 array (big-endian)
       * @param {Array} a - 512-bit value [w15, w14, ..., w1, w0]
       * @returns {Array} 16-word array of 32-bit values
       */
      toUInt32: function(a) {
        return a.slice();
      },

      /**
       * Create 512-bit value from uint64 array (big-endian)
       * @param {Array} words64 - Array of 8 UInt64 values [[h,l], [h,l], ...]
       * @returns {Array} 512-bit value [w15, w14, ..., w1, w0]
       */
      fromUInt64: function(words64) {
        if (words64.length < 8) {
          const padded = new Array(8);
          for (let i = 0; i < 8; i++) {
            padded[i] = i < (8 - words64.length) ? [0, 0] : words64[i - (8 - words64.length)];
          }
          words64 = padded;
        }
        const result = new Array(16);
        for (let i = 0; i < 8; i++) {
          result[i * 2] = words64[i][0];
          result[i * 2 + 1] = words64[i][1];
        }
        return result;
      },

      /**
       * Convert 512-bit value to uint64 array (big-endian)
       * @param {Array} a - 512-bit value [w15, w14, ..., w1, w0]
       * @returns {Array} Array of 8 UInt64 values [[h,l], [h,l], ...]
       */
      toUInt64: function(a) {
        const result = new Array(8);
        for (let i = 0; i < 8; i++) {
          result[i] = [a[i * 2], a[i * 2 + 1]];
        }
        return result;
      },

      /**
       * Create 512-bit value from uint128 array (big-endian)
       * @param {Array} words128 - Array of 4 UInt128 values
       * @returns {Array} 512-bit value [w15, w14, ..., w1, w0]
       */
      fromUInt128: function(words128) {
        if (words128.length < 4) {
          const padded = new Array(4);
          for (let i = 0; i < 4; i++) {
            padded[i] = i < (4 - words128.length) ? [0, 0, 0, 0] : words128[i - (4 - words128.length)];
          }
          words128 = padded;
        }
        const result = new Array(16);
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            result[i * 4 + j] = words128[i][j];
          }
        }
        return result;
      },

      /**
       * Convert 512-bit value to uint128 array (big-endian)
       * @param {Array} a - 512-bit value [w15, w14, ..., w1, w0]
       * @returns {Array} Array of 4 UInt128 values
       */
      toUInt128: function(a) {
        const result = new Array(4);
        for (let i = 0; i < 4; i++) {
          result[i] = [a[i * 4], a[i * 4 + 1], a[i * 4 + 2], a[i * 4 + 3]];
        }
        return result;
      },

      /**
       * 512-bit addition
       * @param {Array} a - First 512-bit value
       * @param {Array} b - Second 512-bit value
       * @returns {Array} Sum as 512-bit value
       */
      add: function(a, b) {
        let carry = 0;
        const result = new Array(16);
        
        for (let i = 15; i >= 0; i--) {
          const sum = a[i] + b[i] + carry;
          result[i] = sum >>> 0;
          carry = sum > 0xFFFFFFFF ? 1 : 0;
        }
        
        return result;
      },

      /**
       * 512-bit subtraction
       * @param {Array} a - First 512-bit value (minuend)
       * @param {Array} b - Second 512-bit value (subtrahend)
       * @returns {Array} Difference as 512-bit value
       */
      sub: function(a, b) {
        let borrow = 0;
        const result = new Array(16);
        
        for (let i = 15; i >= 0; i--) {
          const diff = a[i] - b[i] - borrow;
          result[i] = diff >>> 0;
          borrow = diff < 0 ? 1 : 0;
        }
        
        return result;
      },

      /**
       * 512-bit multiplication (returns low 512 bits of result)
       * @param {Array} a - First 512-bit value
       * @param {Array} b - Second 512-bit value
       * @returns {Array} Product as 512-bit value (truncated)
       */
      mul: function(a, b) {
        const result = new Array(16).fill(0);
        
        for (let i = 15; i >= 0; i--) {
          let carry = 0;
          for (let j = 15; j >= 0; j--) {
            if (i + j >= 15) {
              const prod = a[i] * b[j] + result[i + j - 15] + carry;
              result[i + j - 15] = prod >>> 0;
              carry = Math.floor(prod / 0x100000000);
            }
          }
        }
        
        return result;
      },

      /**
       * 512-bit XOR operation
       * @param {Array} a - First 512-bit value
       * @param {Array} b - Second 512-bit value
       * @returns {Array} XOR result
       */
      xor: function(a, b) {
        const result = new Array(16);
        for (let i = 0; i < 16; i++) {
          result[i] = (a[i] ^ b[i]) >>> 0;
        }
        return result;
      },

      /**
       * 512-bit AND operation
       * @param {Array} a - First 512-bit value
       * @param {Array} b - Second 512-bit value
       * @returns {Array} AND result
       */
      and: function(a, b) {
        const result = new Array(16);
        for (let i = 0; i < 16; i++) {
          result[i] = (a[i] & b[i]) >>> 0;
        }
        return result;
      },

      /**
       * 512-bit OR operation
       * @param {Array} a - First 512-bit value
       * @param {Array} b - Second 512-bit value
       * @returns {Array} OR result
       */
      or: function(a, b) {
        const result = new Array(16);
        for (let i = 0; i < 16; i++) {
          result[i] = (a[i] | b[i]) >>> 0;
        }
        return result;
      },

      /**
       * 512-bit NOT operation
       * @param {Array} a - 512-bit value
       * @returns {Array} NOT result
       */
      not: function(a) {
        const result = new Array(16);
        for (let i = 0; i < 16; i++) {
          result[i] = (~a[i]) >>> 0;
        }
        return result;
      },

      /**
       * 512-bit left shift
       * @param {Array} a - 512-bit value
       * @param {number} n - Number of positions to shift (0-511)
       * @returns {Array} Shifted value
       */
      shl: function(a, n) {
        if (n === 0) return a.slice();
        n = n % 512;
        if (n === 0) return a.slice();
        
        const result = new Array(16).fill(0);
        const wordShift = Math.floor(n / 32);
        const bitShift = n % 32;
        
        for (let i = 0; i < 16; i++) {
          const srcIndex = i + wordShift;
          if (srcIndex < 16) {
            result[i] |= (a[srcIndex] << bitShift) >>> 0;
            if (bitShift > 0 && srcIndex + 1 < 16) {
              result[i] |= a[srcIndex + 1] >>> (32 - bitShift);
            }
          }
        }
        
        return result;
      },

      /**
       * 512-bit right shift
       * @param {Array} a - 512-bit value
       * @param {number} n - Number of positions to shift (0-511)
       * @returns {Array} Shifted value
       */
      shr: function(a, n) {
        if (n === 0) return a.slice();
        n = n % 512;
        if (n === 0) return a.slice();
        
        const result = new Array(16).fill(0);
        const wordShift = Math.floor(n / 32);
        const bitShift = n % 32;
        
        for (let i = 15; i >= 0; i--) {
          const srcIndex = i - wordShift;
          if (srcIndex >= 0) {
            result[i] |= a[srcIndex] >>> bitShift;
            if (bitShift > 0 && srcIndex - 1 >= 0) {
              result[i] |= (a[srcIndex - 1] << (32 - bitShift)) >>> 0;
            }
          }
        }
        
        return result;
      },

      /**
       * 512-bit right rotation
       * @param {Array} a - 512-bit value
       * @param {number} n - Number of positions to rotate (0-511)
       * @returns {Array} Rotated value
       */
      rotr: function(a, n) {
        if (n === 0) return a.slice();
        n = n % 512;
        if (n === 0) return a.slice();
        
        const shifted = OpCodes.UInt512.shr(a, n);
        const rotated = OpCodes.UInt512.shl(a, 512 - n);
        return OpCodes.UInt512.or(shifted, rotated);
      },

      /**
       * 512-bit left rotation
       * @param {Array} a - 512-bit value
       * @param {number} n - Number of positions to rotate (0-511)
       * @returns {Array} Rotated value
       */
      rotl: function(a, n) {
        if (n === 0) return a.slice();
        return OpCodes.UInt512.rotr(a, 512 - (n % 512));
      },

      /**
       * Compare two 512-bit values for equality
       * @param {Array} a - First 512-bit value
       * @param {Array} b - Second 512-bit value
       * @returns {boolean} True if equal
       */
      equals: function(a, b) {
        for (let i = 0; i < 16; i++) {
          if (a[i] !== b[i]) return false;
        }
        return true;
      },

      /**
       * Clone 512-bit value
       * @param {Array} a - 512-bit value
       * @returns {Array} Cloned value
       */
      clone: function(a) {
        return a.slice();
      },

      /**
       * Check if 512-bit value is zero
       * @param {Array} a - 512-bit value
       * @returns {boolean} True if zero
       */
      isZero: function(a) {
        for (let i = 0; i < 16; i++) {
          if (a[i] !== 0) return false;
        }
        return true;
      }
    },
    
    // ========================[ STRING/BYTE CONVERSIONS ]========================
    
    /**
     * Convert string to byte array
     * @param {string} str - Input string
     * @returns {Array} Array of byte values
     */
    AnsiToBytes: function(str) {
      const bytes = [];
      for (let i = 0; i < str.length; ++i)
        bytes.push(str.charCodeAt(i) & 0x7F);
      
      return bytes;
    },
     
    /**
     * Convert string to byte array
     * @param {string} str - Input string
     * @returns {Array} Array of byte values
     */
    AsciiToBytes: function(str) {
      const bytes = [];
      for (let i = 0; i < str.length; ++i)
        bytes.push(str.charCodeAt(i) & 0xFF);
      
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
      if (typeof hexString !== 'string')
        throw new Error('Hex4ToBytes: Input must be a string');
            
      // Validate hex characters
      if (!/^[0-9A-Fa-f]*$/.test(hexString))
        throw new Error('Hex4ToBytes: Invalid hex characters found');
      
      const bytes = [];
      for (let i = 0; i < hexString.length; ++i)
        bytes.push(parseInt(hexString.charAt(i), 16));
      
      return bytes;
    },

    /**
     * Convert hex pairs to bytes (standard hex to bytes conversion)
     * "f123" → [0xf1, 0x23] (each pair of hex digits becomes a byte)
     * @param {string} hexString - Hex string with pairs
     * @returns {Array} Array of byte values (0-255 each)
     */
    Hex8ToBytes: function(hexString) {
      if (typeof hexString !== 'string')
        throw new Error('Hex8ToBytes: Input must be a string');
      
      // Validate hex characters
      if (!/^[0-9A-Fa-f]*$/.test(hexString))
        throw new Error('Hex8ToBytes: Invalid hex characters found');
      
      // Validate length
      if (hexString.length & 1 !== 0)
        throw new Error('Hex8ToBytes: Length must be even');
      
      const bytes = [];
      for (let i = 0; i < hexString.length; i += 2)
        bytes.push(parseInt(hexString.substr(i, 2), 16));
      
      return bytes;
    },

    /**
     * Convert hex quads to 16-bit words (hex to words conversion)
     * "f123abcd" → [0xf123, 0xabcd] (each 4 hex digits becomes a 16-bit word)
     * @param {string} hexString - Hex string with quads
     * @returns {Array} Array of 16-bit word values (0-65535 each)
     */
    Hex16ToWords: function(hexString) {
      if (typeof hexString !== 'string')
        throw new Error('Hex16ToWords: Input must be a string');
      
      // Validate hex characters
      if (!/^[0-9A-Fa-f]*$/.test(hexString)) 
        throw new Error('Hex16ToWords: Invalid hex characters found');
      
      // Validate length
      if (hexString.length & 3 !== 0)
        throw new Error('Hex16ToWords: Length must be divisible by 4');

      const words = [];
      for (let i = 0; i < hexString.length; i += 4)
        words.push(parseInt(hexString.substr(i, 4), 16));
      
      return words;
    },

    /**
     * Convert hex string to 32-bit words (hex to 32-bit words conversion)
     * "f123abcd9876" → [0xf123abcd, 0x9876] (each 8 hex digits becomes a 32-bit word)
     * @param {string} hexString - Hex string with octets
     * @returns {Array} Array of 32-bit word values
     */
    Hex32ToDWords: function(hexString) {
      if (typeof hexString !== 'string')
        throw new Error('Hex32ToDWords: Input must be a string');
      
      // Validate hex characters
      if (!/^[0-9A-Fa-f]*$/.test(hexString)) 
        throw new Error('Hex32ToDWords: Invalid hex characters found');
      
      // Validate length
      if (hexString.length & 7 !== 0)
        throw new Error('Hex32ToDWords: Length must be divisible by 8');
      
      const words = [];
      for (let i = 0; i < hexString.length; i += 8)
        words.push( parseInt(hexString.substr(i, 8), 16) >>> 0);
      
      return words;
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
      if (arr.length <= 16) {
        // Unrolled copy for small arrays (faster than slice)
        const result = [];
        for (let i = 0; i < arr.length; ++i)
          result[i] = arr[i];
        
        return result;
      }

      return arr.slice(0);
    },
    
    /**
     * Clear array (fill with zeros)
     * @param {Array} arr - Array to clear (modified in place)
     */
    ClearArray: function(arr) {
      for (let i = 0; i < arr.length; ++i)
        arr[i] = 0;
    },
    
    /**
     * Copy bytes from source to destination array
     * @param {Array} src - Source array
     * @param {number} srcOffset - Source offset
     * @param {Array} dst - Destination array
     * @param {number} dstOffset - Destination offset
     * @param {number} length - Number of bytes to copy
     */
    CopyBytes: function(src, srcOffset, dst, dstOffset, length) {
      for (let i = 0; i < length; ++i)
        dst[dstOffset + i] = src[srcOffset + i];
    },
    
    /**
     * Compare two arrays for equality
     * @param {Array} arr1 - First array
     * @param {Array} arr2 - Second array
     * @returns {boolean} True if arrays are equal
     */
    CompareArrays: function(arr1, arr2) {
      if (arr1.length !== arr2.length) return false;
      for (let i = 0; i < arr1.length; ++i)
        if (arr1[i] !== arr2[i]) return false;

      return true;
    },
    
    
    /**
     * Secure comparison (constant time) for preventing timing attacks
     * @param {Array} arr1 - First array
     * @param {Array} arr2 - Second array
     * @returns {boolean} True if arrays are equal
     */
    SecureCompare: function(arr1, arr2) {
      if (arr1.length !== arr2.length)
        return false;
      
      let result = 0;
      for (let i = 0; i < arr1.length; ++i)
        result |= arr1[i] ^ arr2[i];
      
      return result === 0;
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

      for (let i = 0; i < 8; ++i) {
        if (b & 1)
          result ^= a;

        const highBit = a & 0x80;
        a = (a << 1) & 0xFF;
        if (highBit)
          a ^= 0x1B; // AES irreducible polynomial x^8 + x^4 + x^3 + x + 1

        b >>>= 1;
      }
      
      return result & 0xFF;
    },
    
    // ========================[ ADVANCED OPERATIONS ]========================
    
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
      for (let i = 0; i < 4; ++i)
      for (let j = 0; j < 4; ++j)
        result[i] ^= OpCodes.GF256Mul(matrix[i][j], column[j]);
        
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
      for (let i = 0; i < count; ++i)
        constants[i] = generator(i);

      return constants;
    },
    
    // ========================[ PERFORMANCE OPTIMIZATIONS ]========================

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

      if (pool.length <= 0)
        return new Array(size);

      const array = pool.pop();
      this.ClearArray(array);
      return array;
    },

    /**
     * Return array to memory pool for reuse
     * @param {Array} array - Array to return to pool
     */
    ReturnToPool: function(array) {
      if (!array || array.length === 0) return;
      
      let pool;
      if (array.length === 8) pool = this._memoryPool.arrays8;
      else if (array.length === 16) pool = this._memoryPool.arrays16;
      else if (array.length === 32) pool = this._memoryPool.arrays32;
      else return; // Not from pool

      if (pool.length < this._memoryPool.maxPoolSize)
        pool.push(array);
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

    // ========================[ HASH ALGORITHM UTILITIES ]========================
    
    /**
     * Encode 64-bit message length for MD5/SHA-1 (little-endian)
     * Safely handles JavaScript's 53-bit integer limitation
     * @param {number} bitLength - Message length in bits
     * @returns {Array} 8-byte array in little-endian format
     */
    EncodeMsgLength64LE: function(bitLength) {
      const split = OpCodes.Split64(bitLength);
      
      // Pack low 32 bits in little-endian
      const lowBytes = OpCodes.Unpack32LE(split.low32);
      // Pack high 32 bits in little-endian  
      const highBytes = OpCodes.Unpack32LE(split.high32);
      
      return lowBytes.concat(highBytes);
    },
    
    /**
     * Encode 128-bit message length for SHA-384/SHA-512 (big-endian)
     * Safely handles JavaScript's 53-bit integer limitation
     * @param {number} bitLength - Message length in bits
     * @returns {Array} 16-byte array in big-endian format
     */
    EncodeMsgLength128BE: function(bitLength) {
      const split = OpCodes.Split64(bitLength);
      
      // First 8 bytes are zero for typical message lengths
      const result = [0, 0, 0, 0, 0, 0, 0, 0];
      
      // Pack high 32 bits in big-endian (bytes 8-11)
      const highBytes = OpCodes.Unpack32BE(split.high32);
      // Pack low 32 bits in big-endian (bytes 12-15)
      const lowBytes = OpCodes.Unpack32BE(split.low32);
      
      return result.concat(highBytes).concat(lowBytes);
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
      for (let i = 0; i < length; ++i)
        arr[i] = value;

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
      for (let i = start; i < end && i < arr.length; ++i)
        result.push(arr[i]);

      return result;
    },

    /**
     * Concatenate multiple byte arrays efficiently
     * @param {...Array} arrays - Arrays to concatenate
     * @returns {Array} Concatenated array
     */
    ConcatArrays: function() {
      let totalLength = 0;
      for (let i = 0; i < arguments.length; ++i)
        totalLength += arguments[i].length;

      const result = new Array(totalLength);
      let offset = 0;
      for (let i = 0; i < arguments.length; ++i) {
        const arr = arguments[i];
        for (let j = 0; j < arr.length; ++j)
          result[offset + j] = arr[j];

        offset += arr.length;
      }
      
      return result;
    },

    /**
     * Inverse S-box lookup with validation
     * @param {Array} sbox - Forward S-box (256 entries)
     * @param {number} output - Output value to find input for
     * @returns {number} Input value that produces the output
     */
    InverseSBoxLookup: function(sbox, output) {
      for (let i = 0; i < 256; ++i)
        if (sbox[i] === output)
          return i;

      return 0; // Default fallback
    },

    /**
     * Build inverse S-box from forward S-box
     * @param {Array} sbox - Forward S-box (256 entries)
     * @returns {Array} Inverse S-box (256 entries)
     */
    BuildInverseSBox: function(sbox) {
      const inverse = new Array(256);
      for (let i = 0; i < 256; ++i)
        inverse[sbox[i]] = i;

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
        ++count;
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
      return bitValue & 1 ? value | (1 << bitIndex) : value & ~(1 << bitIndex);
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
      for (let i = 0; i < array.length; ++i)
        result[i] = (array[i] ^ value) & 0xFF;

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

    /**
     * Create Uint32Array from hex string values (for cryptographic constants)
     * @param {Array<string>} hexValues - Array of hex strings
     * @returns {Uint32Array} Array of 32-bit values
     */
    CreateUint32ArrayFromHex: function(hexValues) {
      const result = new Uint32Array(hexValues.length);
      for (let i = 0; i < hexValues.length; i++) {
        let hexStr = hexValues[i];
        // Remove 0x prefix if present
        if (hexStr.startsWith('0x') || hexStr.startsWith('0X')) {
          hexStr = hexStr.substring(2);
        }
        // Validate hex string
        if (!/^[0-9A-Fa-f]+$/.test(hexStr)) {
          throw new Error('CreateUint32ArrayFromHex: Invalid hex string: ' + hexValues[i]);
        }
        // Parse as 32-bit unsigned integer
        result[i] = parseInt(hexStr, 16) >>> 0;
      }
      return result;
    },

    /**
     * Create byte array from hex string values (for cryptographic constants)
     * @param {Array<string>} hexValues - Array of hex strings (each representing bytes)
     * @returns {Array} Array of byte values
     */
    CreateByteArrayFromHex: function(hexValues) {
      const result = [];
      for (let i = 0; i < hexValues.length; i++) {
        let hexStr = hexValues[i];
        // Remove 0x prefix if present
        if (hexStr.startsWith('0x') || hexStr.startsWith('0X')) {
          hexStr = hexStr.substring(2);
        }
        // Validate hex string
        if (!/^[0-9A-Fa-f]+$/.test(hexStr)) {
          throw new Error('CreateByteArrayFromHex: Invalid hex string: ' + hexValues[i]);
        }
        // Convert hex string to bytes
        const bytes = OpCodes.Hex8ToBytes(hexStr);
        for (let j = 0; j < bytes.length; j++) {
          result.push(bytes[j]);
        }
      }
      return result;
    },

    /**
     * Create array of 64-bit values as [high32, low32] pairs from hex strings
     * @param {Array<string>} hexValues - Array of 16-character hex strings representing 64-bit values
     * @returns {Array<Array<number>>} Array of [high32, low32] pairs
     */
    CreateUint64ArrayFromHex: function(hexValues) {
      const result = [];
      for (let i = 0; i < hexValues.length; i++) {
        let hexStr = hexValues[i];
        // Remove 0x prefix if present
        if (hexStr.startsWith('0x') || hexStr.startsWith('0X')) {
          hexStr = hexStr.substring(2);
        }
        // Validate hex string
        if (!/^[0-9A-Fa-f]+$/.test(hexStr)) {
          throw new Error('CreateUint64ArrayFromHex: Invalid hex string: ' + hexValues[i]);
        }
        // Pad to 16 characters if needed
        hexStr = hexStr.padStart(16, '0');
        if (hexStr.length !== 16) {
          throw new Error('CreateUint64ArrayFromHex: Hex string must represent 64-bit value: ' + hexValues[i]);
        }
        // Split into high and low 32-bit parts
        const high = parseInt(hexStr.substring(0, 8), 16) >>> 0;
        const low = parseInt(hexStr.substring(8, 16), 16) >>> 0;
        result.push([high, low]);
      }
      return result;
    }

  };
  
  // Export to global scope
  global.OpCodes = OpCodes;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OpCodes;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);