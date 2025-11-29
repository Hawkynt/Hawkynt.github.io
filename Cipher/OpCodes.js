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
     * @param {uint8} value - 8-bit value to rotate
     * @param {int32} positions - Number of positions to rotate (0-7)
     * @returns {uint8} Rotated 8-bit value
     */
    RotL8: function(value, positions) {
      value &= 0xFF;
      positions &= 7;
      return ((value << positions) | (value >>> (8 - positions))) & 0xFF;
    },

    /**
     * Rotate right (circular right shift) for 8-bit values
     * @param {uint8} value - 8-bit value to rotate
     * @param {int32} positions - Number of positions to rotate (0-7)
     * @returns {uint8} Rotated 8-bit value
     */
    RotR8: function(value, positions) {
      value &= 0xFF;
      positions &= 7;
      return ((value >>> positions) | (value << (8 - positions))) & 0xFF;
    },

    /**
     * Rotate left (circular left shift) for 16-bit values
     * @param {uint16} value - 16-bit value to rotate
     * @param {int32} positions - Number of positions to rotate (0-15)
     * @returns {uint16} Rotated 16-bit value
     */
    RotL16: function(value, positions) {
      value &= 0xFFFF;
      positions &= 15;
      return ((value << positions) | (value >>> (16 - positions))) & 0xFFFF;
    },

    /**
     * Rotate right (circular right shift) for 16-bit values
     * @param {uint16} value - 16-bit value to rotate
     * @param {int32} positions - Number of positions to rotate (0-15)
     * @returns {uint16} Rotated 16-bit value
     */
    RotR16: function(value, positions) {
      value &= 0xFFFF;
      positions &= 15;
      return ((value >>> positions) | (value << (16 - positions))) & 0xFFFF;
    },

    /**
     * Rotate left (circular left shift) for 32-bit values
     * @param {uint32} value - 32-bit value to rotate
     * @param {int32} positions - Number of positions to rotate (0-31)
     * @returns {uint32} Rotated 32-bit value
     */
    RotL32: function(value, positions) {
      value = value >>> 0; // Ensure unsigned 32-bit
      positions &= 31;
      return ((value << positions) | (value >>> (32 - positions))) >>> 0;
    },

    /**
     * Rotate right (circular right shift) for 32-bit values
     * @param {uint32} value - 32-bit value to rotate
     * @param {int32} positions - Number of positions to rotate (0-31)
     * @returns {uint32} Rotated 32-bit value
     */
    RotR32: function(value, positions) {
      value = value >>> 0; // Ensure unsigned 32-bit
      positions &= 31;
      return ((value >>> positions) | (value << (32 - positions))) >>> 0;
    },

    /**
     * Logical left shift for 8-bit values
     * @param {uint8} value - 8-bit value to shift
     * @param {int32} positions - Number of positions to shift
     * @returns {uint8} Shifted 8-bit value
     */
    Shl8: function(value, positions) {
      return (value << positions) & 0xFF;
    },

    /**
     * Logical right shift for 8-bit values
     * @param {uint8} value - 8-bit value to shift
     * @param {int32} positions - Number of positions to shift
     * @returns {uint8} Shifted 8-bit value
     */
    Shr8: function(value, positions) {
      return (value >>> positions) & 0xFF;
    },

    /**
     * Logical left shift for 16-bit values
     * @param {uint16} value - 16-bit value to shift
     * @param {int32} positions - Number of positions to shift
     * @returns {uint16} Shifted 16-bit value
     */
    Shl16: function(value, positions) {
      return (value << positions) & 0xFFFF;
    },

    /**
     * Logical right shift for 16-bit values
     * @param {uint16} value - 16-bit value to shift
     * @param {int32} positions - Number of positions to shift
     * @returns {uint16} Shifted 16-bit value
     */
    Shr16: function(value, positions) {
      return (value >>> positions) & 0xFFFF;
    },

    /**
     * Logical left shift for 32-bit values
     * @param {uint32} value - 32-bit value to shift
     * @param {int32} positions - Number of positions to shift
     * @returns {uint32} Shifted 32-bit value (unsigned)
     */
    Shl32: function(value, positions) {
      return (value << positions) >>> 0;
    },

    /**
     * Logical right shift for 32-bit values
     * @param {uint32} value - 32-bit value to shift
     * @param {int32} positions - Number of positions to shift
     * @returns {uint32} Shifted 32-bit value (unsigned)
     */
    Shr32: function(value, positions) {
      return (value >>> positions) >>> 0;
    },

    /**
     * Rotate left (circular left shift) for 64-bit BigInt values
     * @param {BigInt} value - 64-bit BigInt value to rotate
     * @param {int32} positions - Number of positions to rotate (0-63)
     * @returns {BigInt} Rotated 64-bit BigInt value
     */
    RotL64n: function(value, positions) {
      const mask64 = 0xFFFFFFFFFFFFFFFFn;
      value = value & mask64;
      positions = positions & 63;
      if (positions === 0) return value;

      return ((value << BigInt(positions)) | (value >> BigInt(64 - positions))) & mask64;
    },

    /**
     * Rotate right (circular right shift) for 64-bit BigInt values
     * @param {BigInt} value - 64-bit BigInt value to rotate
     * @param {int32} positions - Number of positions to rotate (0-63)
     * @returns {BigInt} Rotated 64-bit BigInt value
     */
    RotR64n: function(value, positions) {
      const mask64 = 0xFFFFFFFFFFFFFFFFn;
      value = value & mask64;
      positions = positions & 63;
      if (positions === 0) return value;

      return ((value >> BigInt(positions)) | (value << BigInt(64 - positions))) & mask64;
    },

    /**
     * Left shift for BigInt values (arithmetic/logical shift)
     * @param {BigInt} value - BigInt value to shift
     * @param {int32} positions - Number of positions to shift
     * @returns {BigInt} Shifted BigInt value
     */
    ShiftLn: function(value, positions) {
      return value << BigInt(positions);
    },

    /**
     * Right shift for BigInt values (arithmetic/logical shift)
     * @param {BigInt} value - BigInt value to shift
     * @param {int32} positions - Number of positions to shift
     * @returns {BigInt} Shifted BigInt value
     */
    ShiftRn: function(value, positions) {
      return value >> BigInt(positions);
    },

    // ========================[ TYPE CONVERSIONS ]========================

    /**
     * Convert to unsigned 8-bit integer (byte)
     * @param {int32} value - Value to convert
     * @returns {uint8} Unsigned 8-bit value (0-255)
     */
    ToByte: function(value) {
      return value & 0xFF;
    },

    /**
     * Convert unsigned 32-bit to unsigned 8-bit integer (byte)
     * @param {uint32} value - Value to convert
     * @returns {uint8} Unsigned 8-bit value (0-255)
     */
    UintToByte: function(value) {
      return value & 0xFF;
    },

    /**
     * Convert to signed 8-bit integer
     * @param {int32} value - Value to convert
     * @returns {int8} Signed 8-bit value (-128 to 127)
     */
    ToSByte: function(value) {
      value = value & 0xFF;
      return value > 127 ? value - 256 : value;
    },

    /**
     * Convert to unsigned 16-bit integer (word)
     * @param {int32} value - Value to convert
     * @returns {uint16} Unsigned 16-bit value (0-65535)
     */
    ToWord: function(value) {
      return value & 0xFFFF;
    },

    /**
     * Convert to signed 16-bit integer (short)
     * @param {int32} value - Value to convert
     * @returns {int16} Signed 16-bit value (-32768 to 32767)
     */
    ToShort: function(value) {
      value = value & 0xFFFF;
      return value > 32767 ? value - 65536 : value;
    },

    /**
     * Convert to unsigned 32-bit integer (dword)
     * Replaces JavaScript's >>> 0 idiom
     * @param {int32} value - Value to convert
     * @returns {uint32} Unsigned 32-bit value
     */
    ToDWord: function(value) {
      return value >>> 0;
    },

    /**
     * Convert to signed 32-bit integer (int)
     * @param {uint32} value - Value to convert
     * @returns {int32} Signed 32-bit value
     */
    ToInt: function(value) {
      return value | 0;
    },

    /**
     * Convert to unsigned 64-bit BigInt (qword)
     * @param {BigInt} value - Value to convert
     * @returns {BigInt} Unsigned 64-bit value
     */
    ToQWord: function(value) {
      return BigInt(value) & 0xFFFFFFFFFFFFFFFFn;
    },

    /**
     * Convert to signed 64-bit BigInt (long)
     * @param {BigInt} value - Value to convert
     * @returns {BigInt} Signed 64-bit value
     */
    ToLong: function(value) {
      const val = BigInt(value) & 0xFFFFFFFFFFFFFFFFn;
      return val > 0x7FFFFFFFFFFFFFFFn ? val - 0x10000000000000000n : val;
    },

    /**
     * 64-bit left rotation (for future 64-bit ciphers)
     * @param {uint32} low - Low 32 bits
     * @param {uint32} high - High 32 bits
     * @param {int32} positions - Rotation positions (0-63)
     * @returns {(low: uint32, high: uint32)} Rotated 64-bit value
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
     * @returns {(low: uint32, high: uint32)} Rotated 64-bit value
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
     * Rotate left (circular left shift) for 128-bit BigInt values
     * @param {BigInt} value - 128-bit BigInt value to rotate
     * @param {number} positions - Number of positions to rotate (0-127)
     * @returns {BigInt} Rotated 128-bit BigInt value
     */
    RotL128n: function(value, positions) {
      const mask128 = (1n << 128n) - 1n;
      value = value & mask128;
      positions = positions & 127;
      if (positions === 0) return value;
      
      return ((value << BigInt(positions)) | (value >> BigInt(128 - positions))) & mask128;
    },

    /**
     * Rotate right (circular right shift) for 128-bit BigInt values
     * @param {BigInt} value - 128-bit BigInt value to rotate
     * @param {number} positions - Number of positions to rotate (0-127)
     * @returns {BigInt} Rotated 128-bit BigInt value
     */
    RotR128n: function(value, positions) {
      const mask128 = (1n << 128n) - 1n;
      value = value & mask128;
      positions = positions & 127;
      if (positions === 0) return value;
      
      return ((value >> BigInt(positions)) | (value << BigInt(128 - positions))) & mask128;
    },
    
    /**
     * Rotate 128-bit value represented as 16-byte array to the left
     * @param {uint8[]} bytes - 16-byte array representing 128-bit value
     * @param {number} positions - Number of bits to rotate left
     * @returns {uint8[]} Rotated 16-byte array
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
     * @param {uint8[]} bytes - 16-byte array representing 128-bit value
     * @param {number} positions - Number of bits to rotate right
     * @returns {uint8[]} Rotated 16-byte array
     */
    RotR128: function(bytes, positions) {
      if (positions === 0 || bytes.length !== 16) return bytes.slice(0);
      positions = positions % 128;
      return OpCodes.RotL128(bytes, 128 - positions);
    },

    // ========================[ BYTE/WORD OPERATIONS ]========================
    
    /**
     * Pack 2 bytes into a 16-bit word (big-endian)
     * @param {uint8} b0 - Most significant byte
     * @param {uint8} b1 - Least significant byte
     * @returns {uint16} 16-bit word
     */
    Pack16BE: function(b0, b1) {
      return ((b0 & 0xFF) << 8) | (b1 & 0xFF);
    },

    /**
     * Unpack 16-bit word to 2 bytes (big-endian)
     * @param {uint16} word - 16-bit word to unpack
     * @returns {uint8[]} Array of 2 bytes [b0, b1]
     */
    Unpack16BE: function(word) {
      word = word & 0xFFFF;
      return [
        (word >>> 8) & 0xFF,
        word & 0xFF
      ];
    },

    /**
     * Pack 2 bytes into a 16-bit word (little-endian)
     * @param {uint8} b0 - Least significant byte
     * @param {uint8} b1 - Most significant byte
     * @returns {uint16} 16-bit word
     */
    Pack16LE: function(b0, b1) {
      return ((b1 & 0xFF) << 8) | (b0 & 0xFF);
    },

    /**
     * Unpack 16-bit word to 2 bytes (little-endian)
     * @param {uint16} word - 16-bit word to unpack
     * @returns {uint8[]} Array of 2 bytes [b0, b1]
     */
    Unpack16LE: function(word) {
      word = word & 0xFFFF;
      return [
        word & 0xFF,
        (word >>> 8) & 0xFF
      ];
    },

    /**
     * Pack 4 bytes into a 32-bit dword (big-endian)
     * @param {uint8} b0 - Most significant byte
     * @param {uint8} b1 - Second byte
     * @param {uint8} b2 - Third byte
     * @param {uint8} b3 - Least significant byte
     * @returns {uint32} 32-bit word
     */
    Pack32BE: function(b0, b1, b2, b3) {
      return (((b0 & 0xFF) << 24) | ((b1 & 0xFF) << 16) | ((b2 & 0xFF) << 8) | (b3 & 0xFF)) >>> 0;
    },

    /**
     * Unpack 32-bit dword to 4 bytes (big-endian)
     * @param {uint32} dword - 32-bit dword to unpack
     * @returns {uint8[]} Array of 4 bytes [b0, b1, b2, b3]
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
     * Pack 4 bytes into a 32-bit dword (little-endian)
     * @param {uint8} b0 - Least significant byte
     * @param {uint8} b1 - Second byte
     * @param {uint8} b2 - Third byte
     * @param {uint8} b3 - Most significant byte
     * @returns {uint32} 32-bit word
     */
    Pack32LE: function(b0, b1, b2, b3) {
      return (((b3 & 0xFF) << 24) | ((b2 & 0xFF) << 16) | ((b1 & 0xFF) << 8) | (b0 & 0xFF)) >>> 0;
    },

    /**
     * Unpack 32-bit dword to 4 bytes (little-endian)
     * @param {uint32} dword - 32-bit dword to unpack
     * @returns {uint8[]} Array of 4 bytes [b0, b1, b2, b3]
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
     * Pack 8 bytes into a 64-bit BigInt (big-endian)
     * @param {uint8} b0 - Most significant byte
     * @param {uint8} b1 - Byte 1
     * @param {uint8} b2 - Byte 2
     * @param {uint8} b3 - Byte 3
     * @param {uint8} b4 - Byte 4
     * @param {uint8} b5 - Byte 5
     * @param {uint8} b6 - Byte 6
     * @param {uint8} b7 - Least significant byte
     * @returns {uint64} 64-bit BigInt value
     */
    Pack64BE: function(b0, b1, b2, b3, b4, b5, b6, b7) {
      return (
        ((b0 & 0xFF) << 56n)
        | ((b1 & 0xFF) << 48n)
        | ((b2 & 0xFF) << 40n)
        | ((b3 & 0xFF) << 32n)
        | ((b4 & 0xFF) << 24n)
        | ((b5 & 0xFF) << 16n)
        | ((b6 & 0xFF) <<  8n)
        | ((b7 & 0xFF))
      );
    },

    /**
     * Unpack 64-bit value to 8 bytes (big-endian)
     * @param {BigInt} qword - 64-bit value to unpack
     * @returns {uint8[]} Array of 8 bytes [b0, b1, b2, b3, b4, b5, b6, b7]
     */
    Unpack64BE: function (qword) {
      qword = qword >>> 0;
      return [
        (qword >> 56) & 0xFF,
        (qword >> 48) & 0xFF,
        (qword >> 40) & 0xFF,
        (qword >> 32) & 0xFF,
        (qword >> 24) & 0xFF,
        (qword >> 16) & 0xFF,
        (qword >>  8) & 0xFF,
        qword & 0xFF
      ];
    },

    /**
     * Pack 8 bytes into a 64-bit BigInt (little-endian)
     * @param {uint8} b0 - Least significant byte
     * @param {uint8} b1 - Byte 1
     * @param {uint8} b2 - Byte 2
     * @param {uint8} b3 - Byte 3
     * @param {uint8} b4 - Byte 4
     * @param {uint8} b5 - Byte 5
     * @param {uint8} b6 - Byte 6
     * @param {uint8} b7 - Most significant byte
     * @returns {uint64} 64-bit BigInt value
     */
    Pack64LE: function(b0, b1, b2, b3, b4, b5, b6, b7) {
      return (
        ((b7 & 0xFF) << 56n)
        | ((b6 & 0xFF) << 48n)
        | ((b5 & 0xFF) << 40n)
        | ((b4 & 0xFF) << 32n)
        | ((b3 & 0xFF) << 24n)
        | ((b2 & 0xFF) << 16n)
        | ((b1 & 0xFF) <<  8n)
        | ((b0 & 0xFF))
      );
    },

    /**
     * Unpack 64-bit value to 8 bytes (little-endian)
     * @param {uint64} qword - 64-bit value to unpack
     * @returns {uint8[]} Array of 8 bytes [b0, b1, b2, b3, b4, b5, b6, b7]
     */
    Unpack64LE: function (qword) {
      qword = qword >>> 0;
      return [
        qword & 0xFF,
        (qword >>  8) & 0xFF,
        (qword >> 16) & 0xFF,
        (qword >> 24) & 0xFF,
        (qword >> 32) & 0xFF,
        (qword >> 40) & 0xFF,
        (qword >> 48) & 0xFF,
        (qword >> 56) & 0xFF
      ];
    },
    
    /**
     * Convert 32-bit words array to bytes array (big-endian)
     * @param {uint32[]} words - Array of 32-bit words
     * @returns {uint8[]} Array of bytes
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
     * @param {uint8[]} bytes - Array of bytes
     * @returns {uint32[]} Array of 32-bit words
     */
    BytesToWords32BE: function(bytes) {
      /** @type {uint32[]} */
      const words = [];
      for (let i = 0; i < bytes.length; i += 4) {
        const b0 = OpCodes.ToByte(i < bytes.length ? bytes[i] : 0);
        const b1 = OpCodes.ToByte(i + 1 < bytes.length ? bytes[i + 1] : 0);
        const b2 = OpCodes.ToByte(i + 2 < bytes.length ? bytes[i + 2] : 0);
        const b3 = OpCodes.ToByte(i + 3 < bytes.length ? bytes[i + 3] : 0);
        words.push(OpCodes.Pack32BE(b0, b1, b2, b3));
      }
      return words;
    },

    /**
     * Extract specific byte from 32-bit word
     * @param {uint32} word - 32-bit word
     * @param {int32} byteIndex - Byte index (0=LSB, 3=MSB)
     * @returns {uint8} Extracted byte (0-255)
     */
    GetByte: function(word, byteIndex) {
      return (word >>> (byteIndex * 8)) & 0xFF;
    },

    /**
     * Set specific byte in 32-bit word
     * @param {uint32} word - Original 32-bit word
     * @param {int32} byteIndex - Byte index (0=LSB, 3=MSB)
     * @param {uint8} value - New byte value (0-255)
     * @returns {uint32} Updated 32-bit word
     */
    SetByte: function(word, byteIndex, value) {
      const shift = byteIndex * 8;
      const mask = ~(0xFF << shift);
      return ((word & mask) | ((value & 0xFF) << shift)) >>> 0;
    },

    /**
     * Split JavaScript number into high/low 32-bit components
     * Safely handles JavaScript's 53-bit integer limitation for 64-bit operations
     * @param {uint64} value - JavaScript number to split
     * @returns {(high32: uint32, low32: uint32)} {high32, low32} - High and low 32-bit components
     */
    Split64: function(value) {
      /** @type {uint32} */
      const low32 = value & 0xFFFFFFFF;
      /** @type {uint32} */
      const high32 = Math.floor(value / 0x100000000);
      return { high32: high32, low32: low32 };
    },

    /**
     * Combine high/low 32-bit components into JavaScript number
     * @param {uint32} high32 - High 32 bits
     * @param {uint32} low32 - Low 32 bits
     * @returns {uint64} Combined JavaScript number
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
       * @param {uint32} high - High 32 bits
       * @param {uint32} low - Low 32 bits
       * @returns {uint32[]} [high32, low32] representation
       */
      create: function(high, low) {
        return [high >>> 0, low >>> 0];
      },

      /**
       * Create 64-bit value from bytes array (big-endian)
       * @param {uint8[]} bytes - 8-byte array
       * @returns {uint32[]} 64-bit value [high32, low32]
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
       * @param {uint32[]} a - 64-bit value [high32, low32]
       * @returns {uint8[]} 8-byte array
       */
      toBytes: function(a) {
        const highBytes = OpCodes.Unpack32BE(a[0]);
        const lowBytes = OpCodes.Unpack32BE(a[1]);
        return highBytes.concat(lowBytes);
      },

      /**
       * Create 64-bit value from uint16 array (big-endian)
       * @param {uint16[]} words16 - 4-word array of 16-bit values
       * @returns {uint32[]} 64-bit value [high32, low32]
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
       * @param {uint32[]} a - 64-bit value [high32, low32]
       * @returns {uint16[]} 4-word array of 16-bit values
       */
      toUInt16: function(a) {
        return [
          (a[0] >>> 16) & 0xFFFF, a[0] & 0xFFFF,
          (a[1] >>> 16) & 0xFFFF, a[1] & 0xFFFF
        ];
      },

      /**
       * Create 64-bit value from uint32 array (big-endian)
       * @param {uint32[]} words32 - 2-word array of 32-bit values
       * @returns {uint32[]} 64-bit value [high32, low32]
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
       * @param {uint32[]} a - 64-bit value [high32, low32]
       * @returns {uint32[]} 2-word array of 32-bit values
       */
      toUInt32: function(a) {
        return [a[0], a[1]];
      },

      /**
       * 64-bit addition
       * @param {uint32[]} a - First 64-bit value [high32, low32]
       * @param {uint32[]} b - Second 64-bit value [high32, low32]
       * @returns {uint32[]} Sum as [high32, low32]
       */
      add: function(a, b) {
        const low = (a[1] + b[1]) >>> 0;
        const high = (a[0] + b[0] + (low < a[1] ? 1 : 0)) >>> 0;
        return [high, low];
      },

      /**
       * 64-bit subtraction
       * @param {uint32[]} a - First 64-bit value (minuend) [high32, low32]
       * @param {uint32[]} b - Second 64-bit value (subtrahend) [high32, low32]
       * @returns {uint32[]} Difference as [high32, low32]
       */
      sub: function(a, b) {
        const low = (a[1] - b[1]) >>> 0;
        const high = (a[0] - b[0] - (a[1] < b[1] ? 1 : 0)) >>> 0;
        return [high, low];
      },

      /**
       * 64-bit multiplication (returns low 64 bits of result)
       * @param {uint32[]} a - First 64-bit value [high32, low32]
       * @param {uint32[]} b - Second 64-bit value [high32, low32]
       * @returns {uint32[]} Product as [high32, low32] (truncated)
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
       * @param {uint32[]} a - 64-bit value [high32, low32]
       * @param {int32} n - Number of positions to rotate (0-63)
       * @returns {uint32[]} Rotated value as [high32, low32]
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
       * @param {uint32[]} a - 64-bit value [high32, low32]
       * @param {int32} n - Number of positions to rotate (0-63)
       * @returns {uint32[]} Rotated value as [high32, low32]
       */
      rotl: function(a, n) {
        if (n === 0) return a;
        return OpCodes.UInt64.rotr(a, 64 - (n % 64));
      },

      /**
       * 64-bit right shift (logical)
       * @param {uint32[]} a - 64-bit value [high32, low32]
       * @param {int32} n - Number of positions to shift (0-63)
       * @returns {uint32[]} Shifted value as [high32, low32]
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
       * @param {uint32[]} a - 64-bit value [high32, low32]
       * @param {int32} n - Number of positions to shift (0-63)
       * @returns {uint32[]} Shifted value as [high32, low32]
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
       * @param {uint32[]} a - First 64-bit value [high32, low32]
       * @param {uint32[]} b - Second 64-bit value [high32, low32]
       * @returns {uint32[]} XOR result as [high32, low32]
       */
      xor: function(a, b) {
        return [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0];
      },

      /**
       * 64-bit AND operation
       * @param {uint32[]} a - First 64-bit value [high32, low32]
       * @param {uint32[]} b - Second 64-bit value [high32, low32]
       * @returns {uint32[]} AND result as [high32, low32]
       */
      and: function(a, b) {
        return [(a[0] & b[0]) >>> 0, (a[1] & b[1]) >>> 0];
      },

      /**
       * 64-bit OR operation
       * @param {uint32[]} a - First 64-bit value [high32, low32]
       * @param {uint32[]} b - Second 64-bit value [high32, low32]
       * @returns {uint32[]} OR result as [high32, low32]
       */
      or: function(a, b) {
        return [(a[0] | b[0]) >>> 0, (a[1] | b[1]) >>> 0];
      },

      /**
       * 64-bit NOT operation
       * @param {uint32[]} a - 64-bit value [high32, low32]
       * @returns {uint32[]} NOT result as [high32, low32]
       */
      not: function(a) {
        return [(~a[0]) >>> 0, (~a[1]) >>> 0];
      },

      /**
       * Convert 64-bit value to JavaScript number (loses precision beyond 53 bits)
       * @param {uint32[]} a - 64-bit value [high32, low32]
       * @returns {uint64} JavaScript number representation
       */
      toNumber: function(a) {
        return OpCodes.Combine64(a[0], a[1]);
      },

      /**
       * Create 64-bit value from JavaScript number
       * @param {uint64} num - JavaScript number
       * @returns {uint32[]} 64-bit representation as [high32, low32]
       */
      fromNumber: function(num) {
        const split = OpCodes.Split64(num);
        return [split.high32, split.low32];
      },

      /**
       * Compare two 64-bit values for equality
       * @param {uint32[]} a - First 64-bit value [high32, low32]
       * @param {uint32[]} b - Second 64-bit value [high32, low32]
       * @returns {boolean} True if equal
       */
      equals: function(a, b) {
        return a[0] === b[0] && a[1] === b[1];
      },

      /**
       * Clone 64-bit value
       * @param {uint32[]} a - 64-bit value [high32, low32]
       * @returns {uint32[]} Cloned value as [high32, low32]
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
       * @param {uint32} w3 - Most significant word
       * @param {uint32} w2 - Second word
       * @param {uint32} w1 - Third word
       * @param {uint32} w0 - Least significant word
       * @returns {uint32[]} [w3, w2, w1, w0] representation
       */
      create: function(w3, w2, w1, w0) {
        return [(w3 || 0) >>> 0, (w2 || 0) >>> 0, (w1 || 0) >>> 0, (w0 || 0) >>> 0];
      },

      /**
       * Create 128-bit value from two 64-bit values
       * @param {uint32[]} high64 - High 64 bits [high32, low32]
       * @param {uint32[]} low64 - Low 64 bits [high32, low32]
       * @returns {uint32[]} 128-bit value [w3, w2, w1, w0]
       */
      fromUInt64: function(high64, low64) {
        return [high64[0], high64[1], low64[0], low64[1]];
      },

      /**
       * Split 128-bit value into two 64-bit values
       * @param {uint32[]} a - 128-bit value [w3, w2, w1, w0]
       * @returns {(high64: uint32[], low64: uint32[])} {high64: [w3, w2], low64: [w1, w0]}
       */
      toUInt64: function(a) {
        return {
          high64: [a[0], a[1]],
          low64: [a[2], a[3]]
        };
      },

      /**
       * Create 128-bit value from bytes array (big-endian)
       * @param {uint8[]} bytes - 16-byte array
       * @returns {uint32[]} 128-bit value [w3, w2, w1, w0]
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
       * @param {uint32[]} a - 128-bit value [w3, w2, w1, w0]
       * @returns {uint8[]} 16-byte array
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
       * @param {uint16[]} words16 - 8-word array of 16-bit values
       * @returns {uint32[]} 128-bit value [w3, w2, w1, w0]
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
       * @param {uint32[]} a - 128-bit value [w3, w2, w1, w0]
       * @returns {uint16[]} 8-word array of 16-bit values
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
       * @param {uint32[]} words32 - 4-word array of 32-bit values
       * @returns {uint32[]} 128-bit value [w3, w2, w1, w0]
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
       * @param {uint32[]} a - 128-bit value [w3, w2, w1, w0]
       * @returns {uint32[]} 4-word array of 32-bit values
       */
      toUInt32: function(a) {
        return [a[0], a[1], a[2], a[3]];
      },

      /**
       * 128-bit addition
       * @param {uint32[]} a - First 128-bit value
       * @param {uint32[]} b - Second 128-bit value
       * @returns {uint32[]} Sum as 128-bit value
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
       * @param {uint32[]} a - First 128-bit value (minuend)
       * @param {uint32[]} b - Second 128-bit value (subtrahend)
       * @returns {uint32[]} Difference as 128-bit value
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
       * @param {uint32[]} a - First 128-bit value
       * @param {uint32[]} b - Second 128-bit value
       * @returns {uint32[]} Product as 128-bit value (truncated)
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
       * @param {uint32[]} a - First 128-bit value
       * @param {uint32[]} b - Second 128-bit value
       * @returns {uint32[]} XOR result
       */
      xor: function(a, b) {
        return [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0, (a[2] ^ b[2]) >>> 0, (a[3] ^ b[3]) >>> 0];
      },

      /**
       * 128-bit AND operation
       * @param {uint32[]} a - First 128-bit value
       * @param {uint32[]} b - Second 128-bit value
       * @returns {uint32[]} AND result
       */
      and: function(a, b) {
        return [(a[0] & b[0]) >>> 0, (a[1] & b[1]) >>> 0, (a[2] & b[2]) >>> 0, (a[3] & b[3]) >>> 0];
      },

      /**
       * 128-bit OR operation
       * @param {uint32[]} a - First 128-bit value
       * @param {uint32[]} b - Second 128-bit value
       * @returns {uint32[]} OR result
       */
      or: function(a, b) {
        return [(a[0] | b[0]) >>> 0, (a[1] | b[1]) >>> 0, (a[2] | b[2]) >>> 0, (a[3] | b[3]) >>> 0];
      },

      /**
       * 128-bit NOT operation
       * @param {uint32[]} a - 128-bit value
       * @returns {uint32[]} NOT result
       */
      not: function(a) {
        return [(~a[0]) >>> 0, (~a[1]) >>> 0, (~a[2]) >>> 0, (~a[3]) >>> 0];
      },

      /**
       * 128-bit left shift
       * @param {uint32[]} a - 128-bit value
       * @param {int32} n - Number of positions to shift (0-127)
       * @returns {uint32[]} Shifted value
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
       * @param {uint32[]} a - 128-bit value
       * @param {int32} n - Number of positions to shift (0-127)
       * @returns {uint32[]} Shifted value
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
       * @param {uint32[]} a - 128-bit value
       * @param {int32} n - Number of positions to rotate (0-127)
       * @returns {uint32[]} Rotated value
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
       * @param {uint32[]} a - 128-bit value
       * @param {int32} n - Number of positions to rotate (0-127)
       * @returns {uint32[]} Rotated value
       */
      rotl: function(a, n) {
        if (n === 0) return a.slice();
        return OpCodes.UInt128.rotr(a, 128 - (n % 128));
      },

      /**
       * Compare two 128-bit values for equality
       * @param {uint32[]} a - First 128-bit value
       * @param {uint32[]} b - Second 128-bit value
       * @returns {boolean} True if equal
       */
      equals: function(a, b) {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
      },

      /**
       * Clone 128-bit value
       * @param {uint32[]} a - 128-bit value
       * @returns {uint32[]} Cloned value
       */
      clone: function(a) {
        return [a[0], a[1], a[2], a[3]];
      },

      /**
       * Check if 128-bit value is zero
       * @param {uint32[]} a - 128-bit value
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
       * @param {uint32} w7 - Most significant word
       * @param {uint32} w6 - Second word
       * @param {uint32} w5 - Third word
       * @param {uint32} w4 - Fourth word
       * @param {uint32} w3 - Fifth word
       * @param {uint32} w2 - Sixth word
       * @param {uint32} w1 - Seventh word
       * @param {uint32} w0 - Least significant word
       * @returns {uint32[]} [w7, w6, w5, w4, w3, w2, w1, w0] representation
       */
      create: function(w7, w6, w5, w4, w3, w2, w1, w0) {
        return [
          (w7 || 0) >>> 0, (w6 || 0) >>> 0, (w5 || 0) >>> 0, (w4 || 0) >>> 0,
          (w3 || 0) >>> 0, (w2 || 0) >>> 0, (w1 || 0) >>> 0, (w0 || 0) >>> 0
        ];
      },

      /**
       * Create 256-bit value from two 128-bit values
       * @param {uint32[]} high128 - High 128 bits [w3,w2,w1,w0]
       * @param {uint32[]} low128 - Low 128 bits [w3,w2,w1,w0]
       * @returns {uint32[]} 256-bit value [w7,w6,w5,w4,w3,w2,w1,w0]
       */
      fromUInt128: function(high128, low128) {
        return [high128[0], high128[1], high128[2], high128[3], low128[0], low128[1], low128[2], low128[3]];
      },

      /**
       * Create 256-bit value from bytes array (big-endian)
       * @param {uint8[]} bytes - 32-byte array
       * @returns {uint32[]} 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
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
       * @param {uint32[]} a - 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
       * @returns {uint8[]} 32-byte array
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
       * @param {uint16[]} words16 - 16-word array of 16-bit values
       * @returns {uint32[]} 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
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
       * @param {uint32[]} a - 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
       * @returns {uint16[]} 16-word array of 16-bit values
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
       * @param {uint32[]} words32 - 8-word array of 32-bit values
       * @returns {uint32[]} 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
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
       * @param {uint32[]} a - 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
       * @returns {uint32[]} 8-word array of 32-bit values
       */
      toUInt32: function(a) {
        return a.slice();
      },

      /**
       * Create 256-bit value from uint64 array (big-endian)
       * @param {uint32[][]} words64 - Array of 4 UInt64 values [[h,l], [h,l], [h,l], [h,l]]
       * @returns {uint32[]} 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
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
       * @param {uint32[]} a - 256-bit value [w7, w6, w5, w4, w3, w2, w1, w0]
       * @returns {uint32[][]} Array of 4 UInt64 values [[h,l], [h,l], [h,l], [h,l]]
       */
      toUInt64: function(a) {
        return [
          [a[0], a[1]], [a[2], a[3]], [a[4], a[5]], [a[6], a[7]]
        ];
      },

      /**
       * 256-bit addition
       * @param {uint32[]} a - First 256-bit value
       * @param {uint32[]} b - Second 256-bit value
       * @returns {uint32[]} Sum as 256-bit value
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
       * @param {uint32[]} a - First 256-bit value (minuend)
       * @param {uint32[]} b - Second 256-bit value (subtrahend)
       * @returns {uint32[]} Difference as 256-bit value
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
       * @param {uint32[]} a - First 256-bit value
       * @param {uint32[]} b - Second 256-bit value
       * @returns {uint32[]} Product as 256-bit value (truncated)
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
       * @param {uint32[]} a - First 256-bit value
       * @param {uint32[]} b - Second 256-bit value
       * @returns {uint32[]} XOR result
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
       * @param {uint32[]} a - First 256-bit value
       * @param {uint32[]} b - Second 256-bit value
       * @returns {uint32[]} AND result
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
       * @param {uint32[]} a - First 256-bit value
       * @param {uint32[]} b - Second 256-bit value
       * @returns {uint32[]} OR result
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
       * @param {uint32[]} a - 256-bit value
       * @returns {uint32[]} NOT result
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
       * @param {uint32[]} a - 256-bit value
       * @param {int32} n - Number of positions to shift (0-255)
       * @returns {uint32[]} Shifted value
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
       * @param {uint32[]} a - 256-bit value
       * @param {int32} n - Number of positions to shift (0-255)
       * @returns {uint32[]} Shifted value
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
       * @param {uint32[]} a - 256-bit value
       * @param {int32} n - Number of positions to rotate (0-255)
       * @returns {uint32[]} Rotated value
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
       * @param {uint32[]} a - 256-bit value
       * @param {int32} n - Number of positions to rotate (0-255)
       * @returns {uint32[]} Rotated value
       */
      rotl: function(a, n) {
        if (n === 0) return a.slice();
        return OpCodes.UInt256.rotr(a, 256 - (n % 256));
      },

      /**
       * Compare two 256-bit values for equality
       * @param {uint32[]} a - First 256-bit value
       * @param {uint32[]} b - Second 256-bit value
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
       * @param {uint32[]} a - 256-bit value
       * @returns {uint32[]} Cloned value
       */
      clone: function(a) {
        return a.slice();
      },

      /**
       * Check if 256-bit value is zero
       * @param {uint32[]} a - 256-bit value
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
       * @param {...uint32} words - Up to 16 words (w15 to w0, MSB first)
       * @returns {uint32[]} [w15, w14, ..., w1, w0] representation
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
       * @param {uint32[]} high256 - High 256 bits
       * @param {uint32[]} low256 - Low 256 bits
       * @returns {uint32[]} 512-bit value
       */
      fromUInt256: function(high256, low256) {
        return high256.concat(low256);
      },

      /**
       * Create 512-bit value from bytes array (big-endian)
       * @param {uint8[]} bytes - 64-byte array
       * @returns {uint32[]} 512-bit value [w15, w14, ..., w1, w0]
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
       * @param {uint32[]} a - 512-bit value [w15, w14, ..., w1, w0]
       * @returns {uint8[]} 64-byte array
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
       * @param {uint16[]} words16 - 32-word array of 16-bit values
       * @returns {uint32[]} 512-bit value [w15, w14, ..., w1, w0]
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
       * @param {uint32[]} a - 512-bit value [w15, w14, ..., w1, w0]
       * @returns {uint16[]} 32-word array of 16-bit values
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
       * @param {uint32[]} words32 - 16-word array of 32-bit values
       * @returns {uint32[]} 512-bit value [w15, w14, ..., w1, w0]
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
       * @param {uint32[]} a - 512-bit value [w15, w14, ..., w1, w0]
       * @returns {uint32[]} 16-word array of 32-bit values
       */
      toUInt32: function(a) {
        return a.slice();
      },

      /**
       * Create 512-bit value from uint64 array (big-endian)
       * @param {uint32[][]} words64 - Array of 8 UInt64 values [[h,l], [h,l], ...]
       * @returns {uint32[]} 512-bit value [w15, w14, ..., w1, w0]
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
       * @param {uint32[]} a - 512-bit value [w15, w14, ..., w1, w0]
       * @returns {uint32[][]} Array of 8 UInt64 values [[h,l], [h,l], ...]
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
       * @param {uint32[][]} words128 - Array of 4 UInt128 values
       * @returns {uint32[]} 512-bit value [w15, w14, ..., w1, w0]
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
       * @param {uint32[]} a - 512-bit value [w15, w14, ..., w1, w0]
       * @returns {uint32[][]} Array of 4 UInt128 values
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
       * @param {uint32[]} a - First 512-bit value
       * @param {uint32[]} b - Second 512-bit value
       * @returns {uint32[]} Sum as 512-bit value
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
       * @param {uint32[]} a - First 512-bit value (minuend)
       * @param {uint32[]} b - Second 512-bit value (subtrahend)
       * @returns {uint32[]} Difference as 512-bit value
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
       * @param {uint32[]} a - First 512-bit value
       * @param {uint32[]} b - Second 512-bit value
       * @returns {uint32[]} Product as 512-bit value (truncated)
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
       * @param {uint32[]} a - First 512-bit value
       * @param {uint32[]} b - Second 512-bit value
       * @returns {uint32[]} XOR result
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
       * @param {uint32[]} a - First 512-bit value
       * @param {uint32[]} b - Second 512-bit value
       * @returns {uint32[]} AND result
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
       * @param {uint32[]} a - First 512-bit value
       * @param {uint32[]} b - Second 512-bit value
       * @returns {uint32[]} OR result
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
       * @param {uint32[]} a - 512-bit value
       * @returns {uint32[]} NOT result
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
       * @param {uint32[]} a - 512-bit value
       * @param {int32} n - Number of positions to shift (0-511)
       * @returns {uint32[]} Shifted value
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
       * @param {uint32[]} a - 512-bit value
       * @param {int32} n - Number of positions to shift (0-511)
       * @returns {uint32[]} Shifted value
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
       * @param {uint32[]} a - 512-bit value
       * @param {int32} n - Number of positions to rotate (0-511)
       * @returns {uint32[]} Rotated value
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
       * @param {uint32[]} a - 512-bit value
       * @param {int32} n - Number of positions to rotate (0-511)
       * @returns {uint32[]} Rotated value
       */
      rotl: function(a, n) {
        if (n === 0) return a.slice();
        return OpCodes.UInt512.rotr(a, 512 - (n % 512));
      },

      /**
       * Compare two 512-bit values for equality
       * @param {uint32[]} a - First 512-bit value
       * @param {uint32[]} b - Second 512-bit value
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
       * @param {uint32[]} a - 512-bit value
       * @returns {uint32[]} Cloned value
       */
      clone: function(a) {
        return a.slice();
      },

      /**
       * Check if 512-bit value is zero
       * @param {uint32[]} a - 512-bit value
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
     * @returns {uint8[]} Array of byte values
     */
    AnsiToBytes: function(str) {
      const bytes = [];
      for (let i = 0; i < str.length; ++i)
        bytes.push(str.charCodeAt(i) & 0x7F);

      return bytes;
    },

    /**
     * Convert byte array to ANSI string
     * @param {uint8[]} bytes - Input byte array
     * @returns {string} ANSI string
     */
    BytesToAnsi: function(bytes) {
      let str = '';
      for (let i = 0; i < bytes.length; ++i)
        str += String.fromCharCode(bytes[i] & 0x7F);

      return str;
    },
     
    /**
     * Convert string to byte array
     * @param {string} str - Input string
     * @returns {uint8[]} Array of byte values
     */
    AsciiToBytes: function(str) {
      const bytes = [];
      for (let i = 0; i < str.length; ++i)
        bytes.push(str.charCodeAt(i) & 0xFF);

      return bytes;
    },

    /**
     * Convert double precision floating point to bytes (IEEE 754 little-endian)
     * Uses BitConverter pattern for C# compatibility
     * @param {float64} value - Double precision floating point value
     * @returns {uint8[]} 8-byte array in little-endian order
     */
    DoubleToBytes: function(value) {
      // For cross-platform compatibility, manually construct IEEE 754
      // This placeholder returns zero bytes - implement properly at platform level
      /** @type {uint8[]} */
      const result = /** @type {uint8[]} */([0, 0, 0, 0, 0, 0, 0, 0]);
      // Platform-specific implementation would go here
      // In C#: return BitConverter.GetBytes(value);
      return result;
    },

    /**
     * Convert bytes to double precision floating point (IEEE 754 little-endian)
     * Uses BitConverter pattern for C# compatibility
     * @param {uint8[]} bytes - 8-byte array in little-endian order
     * @returns {float64} Double precision floating point value
     */
    BytesToDouble: function(bytes) {
      if (bytes.length < 8)
        throw new Error('BytesToDouble: Need at least 8 bytes');

      // For cross-platform compatibility
      // This placeholder returns 0 - implement properly at platform level
      // In C#: return BitConverter.ToDouble(bytes, 0);
      return 0.0;
    },

    // ========================[ COMPREHENSIVE HEX UTILITIES ]========================

    /**
     * Convert hex nibbles to bytes (4-bit to 8-bit conversion)
     * "f123" → [15, 1, 2, 3] (each hex digit becomes a byte)
     * @param {string} hexString - Hex string with nibbles
     * @returns {uint8[]} Array of byte values (0-15 each)
     */
    Hex4ToBytes: function(hexString) {
      if (typeof hexString !== 'string')
        throw new Error('Hex4ToBytes: Input must be a string');

      // Validate hex characters
      if (!/^[0-9A-Fa-f]*$/.test(hexString))
        throw new Error('Hex4ToBytes: Invalid hex characters found');

      /** @type {uint8[]} */
      const bytes = [];
      for (let i = 0; i < hexString.length; ++i) {
        /** @type {uint8} */
        const charVal = OpCodes.HexCharCodeToValue(hexString.charCodeAt(i));
        bytes.push(charVal);
      }

      return bytes;
    },

    /**
     * Convert single hex character code to numeric value
     * @param {int32} code - Character code of hex character
     * @returns {uint8} Numeric value 0-15
     */
    HexCharCodeToValue: function(code) {
      if (code >= 48 && code <= 57) return (code - 48) & 0xFF; // '0'-'9'
      if (code >= 65 && code <= 70) return (code - 55) & 0xFF; // 'A'-'F'
      if (code >= 97 && code <= 102) return (code - 87) & 0xFF; // 'a'-'f'
      return 0;
    },

    /**
     * Convert hex pairs to bytes (standard hex to bytes conversion)
     * "f123" → [0xf1, 0x23] (each pair of hex digits becomes a byte)
     * @param {string} hexString - Hex string with pairs
     * @returns {uint8[]} Array of byte values (0-255 each)
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
     * @returns {uint16[]} Array of 16-bit word values (0-65535 each)
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
     * @returns {uint32[]} Array of 32-bit word values
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
     * @param {uint8[]} arr1 - First byte array
     * @param {uint8[]} arr2 - Second byte array
     * @returns {uint8[]} XOR result array (length = min(arr1.length, arr2.length))
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
     * @param {uint8[]} arr - Source array
     * @returns {uint8[]} Copied array
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
     * @param {uint8[]} arr - Array to clear (modified in place)
     */
    ClearArray: function(arr) {
      for (let i = 0; i < arr.length; ++i)
        arr[i] = 0;
    },
    
    /**
     * Copy bytes from source to destination array
     * @param {uint8[]} src - Source array
     * @param {int32} srcOffset - Source offset
     * @param {uint8[]} dst - Destination array
     * @param {int32} dstOffset - Destination offset
     * @param {int32} length - Number of bytes to copy
     */
    CopyBytes: function(src, srcOffset, dst, dstOffset, length) {
      for (let i = 0; i < length; ++i)
        dst[dstOffset + i] = src[srcOffset + i];
    },
    
    /**
     * Compare two arrays for equality
     * @param {uint8[]} arr1 - First array
     * @param {uint8[]} arr2 - Second array
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
     * @param {uint8[]} arr1 - First array
     * @param {uint8[]} arr2 - Second array
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
     * @param {int32} a - First operand
     * @param {int32} b - Second operand
     * @param {int32} m - Modulus
     * @returns {int32} (a + b) mod m
     */
    AddMod: function(a, b, m) {
      return ((a % m) + (b % m)) % m;
    },
    
    /**
     * Modular subtraction (a - b) mod m
     * @param {int32} a - First operand
     * @param {int32} b - Second operand
     * @param {int32} m - Modulus
     * @returns {int32} (a - b) mod m
     */
    SubMod: function(a, b, m) {
      return ((a % m) - (b % m) + m) % m;
    },
    
    /**
     * Modular multiplication (a * b) mod m
     * @param {int32} a - First operand
     * @param {int32} b - Second operand
     * @param {int32} m - Modulus
     * @returns {int32} (a * b) mod m
     */
    MulMod: function(a, b, m) {
      return ((a % m) * (b % m)) % m;
    },
    
    /**
     * Galois Field GF(2^8) multiplication (for AES and other ciphers)
     * @param {uint8} a - First operand (0-255)
     * @param {uint8} b - Second operand (0-255)
     * @returns {uint8} GF(2^8) multiplication result
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
     * @param {uint8[]} sbox - S-box lookup table (256 entries)
     * @param {uint8} input - Input byte (0-255)
     * @returns {uint8} Substituted byte
     */
    SBoxLookup: function(sbox, input) {
      return sbox[input & 0xFF];
    },
    
    /**
     * Linear transformation matrix multiplication (for AES-like ciphers)
     * @param {uint8[][]} matrix - 4x4 transformation matrix
     * @param {uint8[]} column - Input column (4 bytes)
     * @returns {uint8[]} Transformed column (4 bytes)
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
     * @param {uint32} left - Left half
     * @param {uint32} right - Right half
     * @param {uint32} roundKey - Round key
     * @param {Func<uint32, uint32, uint32>} fFunction - F-function
     * @returns {(left: uint32, right: uint32)} New left and right halves
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
     * @param {uint32} state - Current LFSR state
     * @param {uint32} polynomial - Feedback polynomial
     * @param {int32} width - LFSR width in bits
     * @returns {uint32} New LFSR state
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
     * @param {uint32} count - Number of constants needed
     * @param {Func<int32, uint32>} generator - Generator function
     * @returns {uint32[]} Array of round constants
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
     * @param {uint8[]} arr1 - First byte array
     * @param {uint8[]} arr2 - Second byte array (must be same length)
     * @returns {uint8[]} XOR result
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
     * @param {uint8[]} target - Target byte array (modified in place)
     * @param {uint8[]} source - Source byte array to XOR with
     * @param {int32} length - Number of bytes to process
     */
    FastXorInPlace: function(target, source, length) {
      length = length || Math.min(target.length, source.length);
      for (let i = 0; i < length; i++) {
        target[i] ^= source[i];
      }
    },

    /**
     * High-performance byte substitution using lookup table
     * @param {uint8[]} sbox - 256-entry substitution box
     * @param {uint8[]} input - Input bytes
     * @returns {uint8[]} Substituted bytes
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
     * @param {uint32[]} words1 - First word array
     * @param {uint32[]} words2 - Second word array
     * @returns {uint32[]} XOR result
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
     * @param {uint32[]} values - Array of 32-bit values
     * @param {number} positions - Rotation positions
     * @returns {uint32[]} Array of rotated values
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
     * Memory pool max size constant
     * @type {int32}
     */
    _memoryPoolMaxSize: 32,

    /**
     * Get reusable array from memory pool
     * @param {uint32} size - Required array size
     * @returns {uint8[]} Reusable byte array
     */
    GetPooledArray: function(size) {
      // For simplicity in C# transpilation, always create new array
      // Pool reuse is an optimization that can be added at the C# level
      /** @type {uint8[]} */
      const result = [];
      for (let i = 0; i < size; ++i)
        result.push(0);
      return result;
    },

    /**
     * Return array to memory pool for reuse
     * @param {uint8[]} array - Byte array to return to pool
     * @returns {void}
     */
    ReturnToPool: function(array) {
      // For simplicity in C# transpilation, no-op
      // Pool reuse is an optimization that can be added at the C# level
    },

    /**
     * Timing-safe modular arithmetic for constant-time operations
     * @param {uint32} a - First operand
     * @param {uint32} b - Second operand
     * @param {uint32} m - Modulus
     * @returns {uint32} (a + b) mod m
     */
    TimingSafeAddMod: function(a, b, m) {
      /** @type {uint32} */
      const sum = (a + b) >>> 0;
      // Constant-time modular reduction: create mask from comparison
      /** @type {uint32} */
      const cmp = sum >= m ? 1 : 0;
      // Use (0 - cmp) >>> 0 to avoid signed negation producing long
      /** @type {uint32} */
      const mask = (0 - cmp) >>> 0;
      /** @type {uint32} */
      const negM = (0 - m) >>> 0;
      return (sum + (mask & negM)) >>> 0;
    },

    /**
     * Branch-free byte selection (constant-time)
     * @param {uint32} condition - Selection condition (0 or 1)
     * @param {uint32} a - First value
     * @param {uint32} b - Second value
     * @returns {uint32} Returns a if condition=0, b if condition=1
     */
    TimingSafeSelect: function(condition, a, b) {
      /** @type {uint32} */
      const bit = condition & 1;
      /** @type {uint32} */
      const mask = (-bit) >>> 0;
      return ((a & ~mask) | (b & mask)) >>> 0;
    },

    // ========================[ HASH ALGORITHM UTILITIES ]========================
    
    /**
     * Encode 64-bit message length for MD5/SHA-1 (little-endian)
     * Safely handles JavaScript's 53-bit integer limitation
     * @param {uint64} bitLength - Message length in bits
     * @returns {uint8[]} 8-byte array in little-endian format
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
     * @param {uint64} bitLength - Message length in bits
     * @returns {uint8[]} 16-byte array in big-endian format
     */
    EncodeMsgLength128BE: function(bitLength) {
      const split = OpCodes.Split64(bitLength);

      // First 8 bytes are zero for typical message lengths
      /** @type {uint8[]} */
      const result = /** @type {uint8[]} */([0, 0, 0, 0, 0, 0, 0, 0]);

      // Pack high 32 bits in big-endian (bytes 8-11)
      const highBytes = OpCodes.Unpack32BE(split.high32);
      // Pack low 32 bits in big-endian (bytes 12-15)
      const lowBytes = OpCodes.Unpack32BE(split.low32);

      return result.concat(highBytes).concat(lowBytes);
    },

    // ========================[ ADDITIONAL CONSOLIDATION FUNCTIONS ]========================

    /**
     * Safe modular reduction ensuring positive result
     * @param {int32} value - Value to reduce
     * @param {int32} modulus - Modulus value
     * @returns {int32} Positive result of value mod modulus
     */
    ModSafe: function(value, modulus) {
      const result = value % modulus;
      return result < 0 ? result + modulus : result;
    },

    /**
     * Create array filled with specific value
     * @param {uint32} length - Array length
     * @param {uint8} value - Fill value (defaults to 0)
     * @returns {uint8[]} New array filled with value
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
     * @param {uint8[]} arr - Source array
     * @param {int32} start - Start index
     * @param {int32} end - End index (optional)
     * @returns {uint8[]} Sliced array
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
     * @param {uint8[][]} arrays - Arrays to concatenate
     * @returns {uint8[]} Concatenated array
     */
    ConcatArrays: function(arrays) {
      /** @type {int32} */
      let totalLength = 0;
      for (let i = 0; i < arrays.length; ++i)
        totalLength += arrays[i].length;

      /** @type {uint8[]} */
      const result = new Array(totalLength);
      /** @type {int32} */
      let offset = 0;
      for (let i = 0; i < arrays.length; ++i) {
        /** @type {uint8[]} */
        const arr = arrays[i];
        for (let j = 0; j < arr.length; ++j)
          result[offset + j] = arr[j];

        offset += arr.length;
      }

      return result;
    },

    /**
     * Inverse S-box lookup with validation
     * @param {uint8[]} sbox - Forward S-box (256 entries)
     * @param {uint8} output - Output value to find input for
     * @returns {uint8} Input value that produces the output
     */
    InverseSBoxLookup: function(sbox, output) {
      for (let i = 0; i < 256; ++i) {
        if (sbox[i] === output) {
          /** @type {uint8} */
          const result = i & 0xFF;
          return result;
        }
      }
      return 0; // Default fallback
    },

    /**
     * Build inverse S-box from forward S-box
     * @param {uint8[]} sbox - Forward S-box (256 entries)
     * @returns {uint8[]} Inverse S-box (256 entries)
     */
    BuildInverseSBox: function(sbox) {
      const inverse = new Array(256);
      for (let i = 0; i < 256; ++i)
        inverse[sbox[i]] = i;

      return inverse;
    },

    /**
     * Extract nibbles (4-bit values) from byte
     * @param {uint8} byte - Input byte
     * @returns {(high: uint8, low: uint8)} high=upper 4 bits, low=lower 4 bits
     */
    SplitNibbles: function(byte) {
      return {
        high: (byte >>> 4) & 0x0F,
        low: byte & 0x0F
      };
    },

    /**
     * Combine nibbles into byte
     * @param {uint8} high - Upper 4 bits
     * @param {uint8} low - Lower 4 bits
     * @returns {uint8} Combined byte
     */
    CombineNibbles: function(high, low) {
      return ((high & 0x0F) << 4) | (low & 0x0F);
    },

    /**
     * Safe array access with bounds checking
     * @param {uint8[]} array - Array to access
     * @param {uint32} index - Index to access
     * @param {uint8} defaultValue - Default value if out of bounds
     * @returns {uint8} Array value or default
     */
    SafeArrayAccess: function(array, index, defaultValue) {
      if (index >= 0 && index < array.length) {
        return array[index];
      }
      return defaultValue !== undefined ? defaultValue : 0;
    },

    /**
     * Circular array access (wraps around)
     * @param {uint8[]} array - Array to access
     * @param {int32} index - Index (can be negative or >= length)
     * @returns {uint8} Array value with circular indexing
     */
    CircularArrayAccess: function(array, index) {
      if (array.length === 0) return undefined;
      index = ((index % array.length) + array.length) % array.length;
      return array[index];
    },

    /**
     * Efficient bit counting (population count)
     * @param {uint32} value - Value to count bits in
     * @returns {int32} Number of set bits
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
     * @param {uint32} value - Source value
     * @param {uint8} bitIndex - Bit position (0 = LSB)
     * @returns {boolean} True if bit is set, false otherwise
     */
    GetBit: function(value, bitIndex) {
      return ((value >>> bitIndex) & 1) !== 0;
    },

    /**
     * Set specific bit in value
     * @param {uint32} value - Source value
     * @param {uint8} bitIndex - Bit position (0 = LSB)
     * @param {boolean} bitValue - New bit value
     * @returns {uint32} Modified value
     */
    SetBit: function(value, bitIndex, bitValue) {
      return bitValue ? (value | (1 << bitIndex)) >>> 0 : (value & ~(1 << bitIndex)) >>> 0;
    },

    /**
     * Efficient memory comparison (constant time for security)
     * @param {uint8[]} arr1 - First byte array
     * @param {uint8[]} arr2 - Second byte array
     * @param {int32} length - Number of elements to compare
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
     * @param {uint32} state - Current LFSR state
     * @param {uint32} polynomial - Feedback polynomial
     * @param {uint32} width - LFSR width in bits
     * @returns {uint32} New LFSR state after one step
     */
    LFSRStepGeneric: function(state, polynomial, width) {
      /** @type {uint32} */
      const mask = OpCodes.BitMask(width);
      /** @type {uint32} */
      const feedback = (OpCodes.PopCountFast(state & polynomial) & 1) >>> 0;
      return (((state << 1) | feedback) & mask) >>> 0;
    },

    /**
     * Efficient XOR of array with single byte value
     * @param {uint8[]} array - Byte array to XOR
     * @param {number} value - Byte value to XOR with each element
     * @returns {uint8[]} New array with XOR applied
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
     * @param {string[]} hexValues - Array of hex strings
     * @returns {uint32[]} Array of 32-bit values
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
     * @param {string[]} hexValues - Array of hex strings (each representing bytes)
     * @returns {uint8[]} Array of byte values
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
     * @param {string[]} hexValues - Array of 16-character hex strings representing 64-bit values
     * @returns {uint32[][]} Array of [high32, low32] pairs
     */
    CreateUint64ArrayFromHex: function(hexValues) {
      /** @type {uint32[][]} */
      const result = new Array(hexValues.length);
      for (let i = 0; i < hexValues.length; i++) {
        let hexStr = hexValues[i];
        // Remove 0x prefix if present
        if (hexStr.startsWith('0x') || hexStr.startsWith('0X'))
          hexStr = hexStr.substring(2);

        // Validate hex string
        if (!/^[0-9A-Fa-f]+$/.test(hexStr))
          throw new Error('CreateUint64ArrayFromHex: Invalid hex string: ' + hexValues[i]);

        // Pad to 16 characters if needed
        hexStr = hexStr.padStart(16, '0');
        if (hexStr.length !== 16)
          throw new Error('CreateUint64ArrayFromHex: Hex string must represent 64-bit value: ' + hexValues[i]);

        // Split into high and low 32-bit parts
        /** @type {uint32} */
        const high = parseInt(hexStr.substring(0, 8), 16) >>> 0;
        /** @type {uint32} */
        const low = parseInt(hexStr.substring(8, 16), 16) >>> 0;
        /** @type {uint32[]} */
        const pair = [high, low];
        result[i] = pair;
      }
      return result;
    },

    // ========================[ ARITHMETIC OPERATIONS ]========================

    /**
     * 32-bit unsigned multiplication ensuring proper overflow behavior
     * @param {number} a - First operand
     * @param {number} b - Second operand
     * @returns {number} 32-bit unsigned multiplication result (low 32 bits)
     */
    Mul32: function(a, b) {
      return Math.imul(a, b) >>> 0;
    },

    /**
     * High 32 bits of 32x32 → 64-bit unsigned multiplication
     * Used in counter-based PRNGs like Philox
     * @param {uint32} a - First operand
     * @param {uint32} b - Second operand
     * @returns {uint32} High 32 bits of the 64-bit product
     */
    MulHi32: function(a, b) {
      a = a >>> 0;
      b = b >>> 0;

      // Split into 16-bit parts for accurate multiplication
      /** @type {uint32} */
      const a_lo = a & 0xFFFF;
      /** @type {uint32} */
      const a_hi = a >>> 16;
      /** @type {uint32} */
      const b_lo = b & 0xFFFF;
      /** @type {uint32} */
      const b_hi = b >>> 16;

      // Compute partial products
      /** @type {uint32} */
      const p0 = (a_lo * b_lo) >>> 0;
      /** @type {uint32} */
      const p1 = (a_lo * b_hi) >>> 0;
      /** @type {uint32} */
      const p2 = (a_hi * b_lo) >>> 0;
      /** @type {uint32} */
      const p3 = (a_hi * b_hi) >>> 0;

      // Combine to get high 32 bits
      /** @type {uint32} */
      const carry = (((p0 >>> 16) + (p1 & 0xFFFF) + (p2 & 0xFFFF)) >>> 16) >>> 0;
      /** @type {uint32} */
      const hi = ((p3 + (p1 >>> 16) + (p2 >>> 16) + carry) >>> 0);

      return hi >>> 0;
    },

    /**
     * 32-bit unsigned addition ensuring proper overflow behavior
     * @param {number} a - First operand
     * @param {number} b - Second operand
     * @returns {number} 32-bit unsigned addition result
     */
    Add32: function(a, b) {
      return ((a + b) >>> 0);
    },

    /**
     * 32-bit unsigned subtraction ensuring proper underflow behavior
     * @param {number} a - First operand (minuend)
     * @param {number} b - Second operand (subtrahend)
     * @returns {number} 32-bit unsigned subtraction result
     */
    Sub32: function(a, b) {
      return ((a - b) >>> 0);
    },

    // ========================[ BITSTREAM OPERATIONS ]========================

    /**
     * Create a BitStream instance for efficient bit-level operations
     * Optimized for compression algorithms that need precise bit manipulation
     * @param {uint8[]} initialBytes - Optional initial byte array
     * @returns {_BitStream} BitStream instance
     */
    CreateBitStream: function(initialBytes) {
      return new OpCodes._BitStream(initialBytes);
    },

    /**
     * Internal BitStream class for bit-level operations
     * Uses uint64 buffer for efficient batching before outputting bytes
     * @private
     * @constructor
     * @param {uint8[]} initialBytes - Optional initial byte array
     */
    _BitStream: function(initialBytes) {
      /** @type {int32} Current 64-bit buffer for operations */
      this.buffer = 0;
      /** @type {int32} Number of valid bits in buffer (0-63) */
      this.bufferBits = 0;
      /** @type {uint8[]} Output byte array */
      this.byteArray = [];
      /** @type {int32} Read position in bits for reading operations */
      this.readPosition = 0;
      /** @type {int32} Total number of bits written */
      this.totalBitsWritten = 0;

      // Initialize from byte array if provided
      if (initialBytes && initialBytes.length > 0) {
        this.byteArray = initialBytes.slice(); // Copy array
        this.totalBitsWritten = initialBytes.length * 8;
      }

      /**
       * Write bits to the stream
       * @param {uint32} value - Value to write
       * @param {uint32} numBits - Number of bits to write (1-32)
       * @returns {void}
       */
      this.writeBits = function(value, numBits) {
        if (numBits <= 0 || numBits > 32) {
          throw new Error('BitStream.writeBits: numBits must be 1-32');
        }

        // Mask value to specified bit width
        const mask = numBits === 32 ? 0xFFFFFFFF : (1 << numBits) - 1;
        value = (value >>> 0) & mask;

        // Add bits to buffer
        this.buffer = (this.buffer << numBits) | value;
        this.bufferBits += numBits;
        this.totalBitsWritten += numBits;

        // Flush complete bytes from buffer
        while (this.bufferBits >= 8) {
          this.bufferBits -= 8;
          const byte = (this.buffer >>> this.bufferBits) & 0xFF;
          this.byteArray.push(byte);
          
          // Clear the flushed bits from buffer
          if (this.bufferBits > 0) {
            const remainingMask = (1 << this.bufferBits) - 1;
            this.buffer &= remainingMask;
          } else {
            this.buffer = 0;
          }
        }
      };

      /**
       * Write a single bit to the stream
       * @param {uint32} bit - Bit value (0 or 1)
       * @returns {void}
       */
      this.writeBit = function(bit) {
        this.writeBits(bit & 1, 1);
      };

      /**
       * Write a byte to the stream
       * @param {uint8} byte - Byte value (0-255)
       * @returns {void}
       */
      this.writeByte = function(byte) {
        this.writeBits(byte & 0xFF, 8);
      };

      /**
       * Write multiple bytes to the stream
       * @param {uint8[]} bytes - Array of bytes to write
       * @returns {void}
       */
      this.writeBytes = function(bytes) {
        for (let i = 0; i < bytes.length; i++) {
          this.writeByte(bytes[i]);
        }
      };

      /**
       * Write a 16-bit value in big-endian format
       * @param {uint16} value - 16-bit value
       * @returns {void}
       */
      this.writeUint16BE = function(value) {
        this.writeBits((value >>> 8) & 0xFF, 8);
        this.writeBits(value & 0xFF, 8);
      };

      /**
       * Write a 16-bit value in little-endian format
       * @param {uint16} value - 16-bit value
       * @returns {void}
       */
      this.writeUint16LE = function(value) {
        this.writeBits(value & 0xFF, 8);
        this.writeBits((value >>> 8) & 0xFF, 8);
      };

      /**
       * Write a 32-bit value in big-endian format
       * @param {number} value - 32-bit value
       */
      this.writeUint32BE = function(value) {
        value = value >>> 0; // Ensure unsigned
        this.writeBits((value >>> 24) & 0xFF, 8);
        this.writeBits((value >>> 16) & 0xFF, 8);
        this.writeBits((value >>> 8) & 0xFF, 8);
        this.writeBits(value & 0xFF, 8);
      };

      /**
       * Write a 32-bit value in little-endian format
       * @param {number} value - 32-bit value
       */
      this.writeUint32LE = function(value) {
        value = value >>> 0; // Ensure unsigned
        this.writeBits(value & 0xFF, 8);
        this.writeBits((value >>> 8) & 0xFF, 8);
        this.writeBits((value >>> 16) & 0xFF, 8);
        this.writeBits((value >>> 24) & 0xFF, 8);
      };

      /**
       * Read bits from the stream
       * @param {int32} numBits - Number of bits to read (1-32)
       * @returns {uint32} Read value
       */
      this.readBits = function(numBits) {
        if (numBits <= 0 || numBits > 32) {
          throw new Error('BitStream.readBits: numBits must be 1-32');
        }

        let result = 0;
        let bitsRead = 0;

        while (bitsRead < numBits) {
          const byteIndex = Math.floor(this.readPosition / 8);
          const bitOffset = this.readPosition % 8;
          
          if (byteIndex >= this.byteArray.length) {
            // No more data available - return partial result or throw error
            if (bitsRead === 0) {
              throw new Error('BitStream.readBits: No more data available');
            }
            break;
          }

          const currentByte = this.byteArray[byteIndex];
          const availableBits = 8 - bitOffset;
          const bitsToRead = Math.min(numBits - bitsRead, availableBits);
          
          // Extract bits from current byte
          const mask = (1 << bitsToRead) - 1;
          const extractedBits = (currentByte >>> (availableBits - bitsToRead)) & mask;
          
          result = (result << bitsToRead) | extractedBits;
          bitsRead += bitsToRead;
          this.readPosition += bitsToRead;
        }

        return result;
      };

      /**
       * Read a single bit from the stream
       * @returns {uint32} Bit value (0 or 1)
       */
      this.readBit = function() {
        return this.readBits(1);
      };

      /**
       * Read a byte from the stream
       * @returns {uint8} Byte value (0-255)
       */
      this.readByte = function() {
        return OpCodes.UintToByte(this.readBits(8));
      };

      /**
       * Read multiple bytes from the stream
       * @param {number} count - Number of bytes to read
       * @returns {uint8[]} Array of bytes
       */
      this.readBytes = function(count) {
        const bytes = [];
        for (let i = 0; i < count; i++) {
          bytes.push(this.readByte());
        }
        return bytes;
      };

      /**
       * Peek at bits without advancing read position
       * @param {number} numBits - Number of bits to peek (1-32)
       * @returns {number} Peeked value
       */
      this.peekBits = function(numBits) {
        const savedPosition = this.readPosition;
        const result = this.readBits(numBits);
        this.readPosition = savedPosition;
        return result;
      };

      /**
       * Skip bits in the stream
       * @param {number} numBits - Number of bits to skip
       */
      this.skipBits = function(numBits) {
        this.readPosition += numBits;
        // Clamp to valid range
        const maxPosition = this.byteArray.length * 8;
        if (this.readPosition > maxPosition) {
          this.readPosition = maxPosition;
        }
      };

      /**
       * Check if more bits are available for reading
       * @returns {boolean} True if more bits available
       */
      this.hasMoreBits = function() {
        return this.readPosition < this.byteArray.length * 8;
      };

      /**
       * Get remaining bits available for reading
       * @returns {int32} Number of bits remaining
       */
      this.getRemainingBits = function() {
        return Math.max(0, this.byteArray.length * 8 - this.readPosition);
      };

      /**
       * Reset read position to beginning
       */
      this.resetReadPosition = function() {
        this.readPosition = 0;
      };

      /**
       * Set read position to specific bit offset
       * @param {uint32} bitOffset - Bit position to seek to
       */
      this.seekBits = function(bitOffset) {
        /** @type {int32} */
        const maxBits = this.byteArray.length * 8;
        /** @type {int32} */
        const offset = bitOffset & 0x7FFFFFFF;
        /** @type {int32} */
        const clampedOffset = offset > maxBits ? maxBits : offset;
        this.readPosition = clampedOffset > 0 ? clampedOffset : 0;
      };

      /**
       * Flush remaining bits in buffer and return complete byte array
       * @param {boolean} padLastByte - Whether to pad the last byte with zeros (default: true)
       * @returns {uint8[]} Complete byte array with padding if needed
       */
      this.toArray = function(padLastByte) {
        padLastByte = padLastByte !== false; // Default to true

        if (this.bufferBits > 0 && padLastByte) {
          // Pad remaining bits with zeros and flush
          const paddingBits = 8 - this.bufferBits;
          this.buffer = this.buffer << paddingBits;
          this.byteArray.push(this.buffer & 0xFF);
          this.buffer = 0;
          this.bufferBits = 0;
        }

        return this.byteArray.slice(); // Return copy
      };

      /**
       * Get length of stream in bits
       * @returns {number} Total bits written
       */
      this.getBitLength = function() {
        return this.totalBitsWritten;
      };

      /**
       * Get length of stream in bytes (including partial bytes)
       * @returns {number} Total bytes including incomplete last byte
       */
      this.getByteLength = function() {
        const completeBytesInBuffer = Math.floor(this.bufferBits / 8);
        const hasPartialByte = (this.bufferBits % 8) > 0 ? 1 : 0;
        return this.byteArray.length + completeBytesInBuffer + hasPartialByte;
      };

      /**
       * Clear the stream and reset to initial state
       */
      this.clear = function() {
        this.buffer = 0;
        this.bufferBits = 0;
        this.byteArray = [];
        this.readPosition = 0;
        this.totalBitsWritten = 0;
      };

      /**
       * Clone the current stream
       * @returns {_BitStream} New BitStream instance with same content
       */
      this.clone = function() {
        const cloned = new OpCodes._BitStream();
        cloned.buffer = this.buffer;
        cloned.bufferBits = this.bufferBits;
        cloned.byteArray = this.byteArray.slice();
        cloned.readPosition = this.readPosition;
        cloned.totalBitsWritten = this.totalBitsWritten;
        return cloned;
      };

      /**
       * Get debug information about the stream state
       * @returns {(bufferBits: int32, bufferValue: string, byteArrayLength: int32, readPosition: int32, totalBitsWritten: int32, hasMoreBits: boolean, remainingBits: int32)} Debug information
       */
      this.getDebugInfo = function() {
        return {
          bufferBits: this.bufferBits,
          bufferValue: '0x' + this.buffer.toString(16),
          byteArrayLength: this.byteArray.length,
          readPosition: this.readPosition,
          totalBitsWritten: this.totalBitsWritten,
          hasMoreBits: this.hasMoreBits(),
          remainingBits: this.getRemainingBits()
        };
      };

      /**
       * Write variable-length integer (varint encoding)
       * @param {number} value - Value to encode (0 to 2^32-1)
       */
      this.writeVarInt = function(value) {
        value = value >>> 0; // Ensure unsigned
        while (value >= 0x80) {
          this.writeByte((value & 0x7F) | 0x80);
          value >>>= 7;
        }
        this.writeByte(value & 0x7F);
      };

      /**
       * Read variable-length integer (varint decoding)
       * @returns {uint32} Decoded value
       */
      this.readVarInt = function() {
        let result = 0;
        let shift = 0;
        let byte;
        
        do {
          if (shift >= 32) {
            throw new Error('BitStream.readVarInt: Integer overflow');
          }
          byte = this.readByte();
          result |= ((byte & 0x7F) << shift);
          shift += 7;
        } while (byte & 0x80);
        
        return result >>> 0;
      };

      /**
       * Write unary encoding (n ones followed by a zero)
       * @param {number} value - Value to encode
       */
      this.writeUnary = function(value) {
        for (let i = 0; i < value; i++) {
          this.writeBit(1);
        }
        this.writeBit(0);
      };

      /**
       * Read unary encoding
       * @returns {number} Decoded value
       */
      this.readUnary = function() {
        let count = 0;
        while (this.hasMoreBits() && this.readBit() === 1) {
          count++;
        }
        return count;
      };

      /**
       * Align to byte boundary by padding with zeros
       */
      this.alignToByte = function() {
        while (this.bufferBits % 8 !== 0) {
          this.writeBit(0);
        }
      };

      /**
       * Check if currently aligned to byte boundary
       * @returns {boolean} True if aligned to byte boundary
       */
      this.isAligned = function() {
        return this.bufferBits % 8 === 0;
      };
    },

    /**
     * GCM GHASH multiplication operation
     * @param {uint8[]} x - First 16-byte operand
     * @param {uint8[]} y - Second 16-byte operand
     * @returns {uint8[]} 16-byte result
     */
    GHashMul: function(x, y) {
      if (!x || x.length !== 16 || !y || y.length !== 16) {
        throw new Error('GHashMul requires 16-byte arrays');
      }

      /** @type {uint8[]} */
      const z = /** @type {uint8[]} */(new Array(16).fill(0));
      /** @type {uint8[]} */
      const v = /** @type {uint8[]} */([...y]);

      for (let i = 0; i < 16; i++) {
        /** @type {uint8} */
        const xi = x[i];
        for (let j = 7; j >= 0; j--) {
          if (xi & (1 << j)) {
            for (let k = 0; k < 16; k++) {
              z[k] = /** @type {uint8} */((z[k] ^ v[k]) & 0xFF);
            }
          }

          /** @type {uint8} */
          const lsb = /** @type {uint8} */(v[15] & 1);
          for (let k = 15; k >= 1; k--) {
            v[k] = /** @type {uint8} */(((v[k] >>> 1) | ((v[k-1] & 1) << 7)) & 0xFF);
          }
          v[0] = /** @type {uint8} */((v[0] >>> 1) & 0xFF);

          if (lsb !== 0) {
            v[0] = /** @type {uint8} */((v[0] ^ 0xE1) & 0xFF);
          }
        }
      }

      return z;
    },

    GCMIncrement: function(counter) {
      if (!counter || counter.length !== 16) {
        throw new Error('GCMIncrement requires 16-byte counter');
      }

      let carry = 1;
      for (let i = 15; i >= 12; i--) {
        const sum = counter[i] + carry;
        counter[i] = sum & 0xFF;
        carry = sum >>> 8;
      }

      return counter;
    },

    // ========================[ 64-BIT EMULATION OPERATIONS ]========================
    // Operations for 64-bit arithmetic using [HIGH, LOW] pair representation
    // Used by hash functions like BLAKE-384/512, SHA-512, etc.

    /**
     * Add two 64-bit values represented as [HIGH, LOW] pairs
     * @param {number} ah - High 32 bits of first operand
     * @param {number} al - Low 32 bits of first operand
     * @param {number} bh - High 32 bits of second operand
     * @param {number} bl - Low 32 bits of second operand
     * @returns {(h: uint32, l: uint32)} Result as HIGH and LOW 32-bit words
     */
    Add64_HL: function(ah, al, bh, bl) {
      const l = (al >>> 0) + (bl >>> 0);
      const h = (ah + bh + ((l / 0x100000000) | 0)) | 0;
      return { h: h >>> 0, l: l >>> 0 };
    },

    /**
     * Add three 32-bit low words (used for 64-bit 3-operand addition)
     * @param {number} al - Low word of first operand
     * @param {number} bl - Low word of second operand
     * @param {number} cl - Low word of third operand
     * @returns {number} Sum of low words (may overflow 32 bits)
     */
    Add3L64: function(al, bl, cl) {
      return (al >>> 0) + (bl >>> 0) + (cl >>> 0);
    },

    /**
     * Add three 32-bit high words with carry from low word sum
     * @param {number} lowSum - Sum of low words (may be > 32 bits)
     * @param {number} ah - High word of first operand
     * @param {number} bh - High word of second operand
     * @param {number} ch - High word of third operand
     * @returns {number} Sum of high words plus carry
     */
    Add3H64: function(lowSum, ah, bh, ch) {
      return (ah + bh + ch + ((lowSum / 0x100000000) | 0)) | 0;
    },

    /**
     * Rotate right a 64-bit value represented as [HIGH, LOW] pair
     * Optimized for common rotation amounts used in hash functions
     * @param {number} high - High 32 bits
     * @param {number} low - Low 32 bits
     * @param {number} n - Number of bits to rotate (0-63)
     * @returns {(h: uint32, l: uint32)} Rotated HIGH and LOW words
     */
    RotR64_HL: function(high, low, n) {
      n &= 63;
      if (n === 0) {
        return { h: high >>> 0, l: low >>> 0 };
      } else if (n === 32) {
        // Special case: 32-bit rotation = swap
        return { h: low >>> 0, l: high >>> 0 };
      } else if (n < 32) {
        // Rotation < 32 bits
        const h = ((high >>> n) | (low << (32 - n))) >>> 0;
        const l = ((low >>> n) | (high << (32 - n))) >>> 0;
        return { h: h, l: l };
      } else {
        // Rotation >= 32 bits (swap then rotate)
        n -= 32;
        const h = ((low >>> n) | (high << (32 - n))) >>> 0;
        const l = ((high >>> n) | (low << (32 - n))) >>> 0;
        return { h: h, l: l };
      }
    },

    /**
     * Rotate left a 64-bit value represented as [HIGH, LOW] pair
     * @param {number} high - High 32 bits
     * @param {number} low - Low 32 bits
     * @param {number} n - Number of bits to rotate (0-63)
     * @returns {(h: uint32, l: uint32)} Rotated HIGH and LOW words
     */
    RotL64_HL: function(high, low, n) {
      n &= 63;
      if (n === 0) {
        return { h: high >>> 0, l: low >>> 0 };
      } else if (n === 32) {
        // Special case: 32-bit rotation = swap
        return { h: low >>> 0, l: high >>> 0 };
      } else if (n < 32) {
        // Rotation < 32 bits
        const h = ((high << n) | (low >>> (32 - n))) >>> 0;
        const l = ((low << n) | (high >>> (32 - n))) >>> 0;
        return { h: h, l: l };
      } else {
        // Rotation >= 32 bits (swap then rotate)
        n -= 32;
        const h = ((low << n) | (high >>> (32 - n))) >>> 0;
        const l = ((high << n) | (low >>> (32 - n))) >>> 0;
        return { h: h, l: l };
      }
    },

    /**
     * Swap HIGH and LOW words of a 64-bit value (equivalent to 32-bit rotation)
     * @param {number} high - High 32 bits
     * @param {number} low - Low 32 bits
     * @returns {(h: uint32, l: uint32)} Swapped words
     */
    Swap64_HL: function(high, low) {
      return { h: low >>> 0, l: high >>> 0 };
    },

    /**
     * XOR two 64-bit values represented as [HIGH, LOW] pairs
     * @param {number} ah - First value high 32 bits
     * @param {number} al - First value low 32 bits
     * @param {number} bh - Second value high 32 bits
     * @param {number} bl - Second value low 32 bits
     * @returns {(h: uint32, l: uint32)} XOR result
     */
    Xor64_HL: function(ah, al, bh, bl) {
      return { h: (ah ^ bh) >>> 0, l: (al ^ bl) >>> 0 };
    },

    /**
     * Convert a value to unsigned 32-bit integer
     * @param {number} value - Value to convert
     * @returns {number} Unsigned 32-bit integer
     */
    ToUint32: function(value) {
      return value >>> 0;
    },

    /**
     * Constant-time array equality comparison
     * @param {uint8[]} arr1 - First byte array
     * @param {uint8[]} arr2 - Second byte array
     * @returns {boolean} True if arrays are equal, false otherwise
     */
    ArraysEqual: function(arr1, arr2) {
      if (arr1.length !== arr2.length) {
        return false;
      }

      let result = 0;
      for (let i = 0; i < arr1.length; ++i) {
        result |= arr1[i] ^ arr2[i];
      }

      return result === 0;
    },

    // ========================[ BIGINT OPERATIONS ]========================

    /**
     * Bitwise AND for BigInt values
     * @param {BigInt} a - First operand
     * @param {BigInt} b - Second operand
     * @returns {BigInt} a & b
     */
    AndN: function(a, b) {
      return a & b;
    },

    /**
     * Bitwise OR for BigInt values
     * @param {BigInt} a - First operand
     * @param {BigInt} b - Second operand
     * @returns {BigInt} a | b
     */
    OrN: function(a, b) {
      return a | b;
    },

    /**
     * Bitwise XOR for BigInt values
     * @param {BigInt} a - First operand
     * @param {BigInt} b - Second operand
     * @returns {BigInt} a ^ b
     */
    XorN: function(a, b) {
      return a ^ b;
    },

    /**
     * Extract specific bit from BigInt value
     * @param {BigInt} value - Source value
     * @param {number} bitIndex - Bit position (0 = LSB)
     * @returns {BigInt} Bit value (0n or 1n)
     */
    GetBitN: function(value, bitIndex) {
      return (value >> BigInt(bitIndex)) & 1n;
    },

    /**
     * Set specific bit in BigInt value
     * @param {BigInt} value - Source value
     * @param {number} bitIndex - Bit position (0 = LSB)
     * @param {BigInt} bitValue - New bit value (0n or 1n)
     * @returns {BigInt} Modified value
     */
    SetBitN: function(value, bitIndex, bitValue) {
      const mask = 1n << BigInt(bitIndex);
      return (bitValue & 1n) ? value | mask : value & ~mask;
    },

    // ========================[ BIGINT MODULAR ARITHMETIC ]========================

    /**
     * Modular multiplication for BigInt (a * b) mod m
     * @param {BigInt} a - First operand
     * @param {BigInt} b - Second operand
     * @param {BigInt} m - Modulus
     * @returns {BigInt} (a * b) mod m
     */
    MulModN: function(a, b, m) {
      return ((a % m) * (b % m)) % m;
    },

    /**
     * Modular squaring for BigInt (a * a) mod m
     * Optimized for BBS and other quadratic residue operations
     * @param {BigInt} a - Value to square
     * @param {BigInt} m - Modulus
     * @returns {BigInt} (a * a) mod m
     */
    SquareModN: function(a, m) {
      const reduced = a % m;
      return (reduced * reduced) % m;
    },

    /**
     * Modular exponentiation for BigInt (base^exp) mod m
     * Uses binary exponentiation (square-and-multiply)
     * @param {BigInt} base - Base value
     * @param {BigInt} exp - Exponent
     * @param {BigInt} m - Modulus
     * @returns {BigInt} (base^exp) mod m
     */
    ModPowN: function(base, exp, m) {
      if (m === 1n) return 0n;
      if (exp === 0n) return 1n;

      let result = 1n;
      base = base % m;

      while (exp > 0n) {
        if (exp & 1n) {
          result = (result * base) % m;
        }
        exp = exp >> 1n;
        base = (base * base) % m;
      }

      return result;
    },

    /**
     * Greatest Common Divisor using Euclidean algorithm for BigInt
     * @param {BigInt} a - First value
     * @param {BigInt} b - Second value
     * @returns {BigInt} GCD(a, b)
     */
    GcdN: function(a, b) {
      a = a < 0n ? -a : a;
      b = b < 0n ? -b : b;

      while (b !== 0n) {
        const temp = b;
        b = a % b;
        a = temp;
      }

      return a;
    },

    /**
     * Count bits in BigInt value
     * @param {BigInt} value - Value to measure
     * @returns {number} Number of bits required to represent value
     */
    BitCountN: function(value) {
      if (value === 0n) return 1;

      value = value < 0n ? -value : value;
      let count = 0;

      while (value > 0n) {
        count++;
        value = value >> 1n;
      }

      return count;
    }

  };
  
  // Export to global scope
  global.OpCodes = OpCodes;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OpCodes;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);