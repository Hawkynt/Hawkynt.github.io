#!/usr/bin/env node
/*
 * Universal Poly1305 MAC (Message Authentication Code)
 * Compatible with both Browser and Node.js environments
 * Based on RFC 7539 - ChaCha20 and Poly1305 for IETF Protocols
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of Poly1305 MAC algorithm.
 * Poly1305 is a one-time authenticator designed by D.J. Bernstein.
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes) {
    if (typeof require !== 'undefined') {
      // Node.js environment - load dependencies
      try {
        require('../../OpCodes.js');
      } catch (e) {
        console.error('Failed to load OpCodes dependency:', e.message);
        return;
      }
    } else {
      console.error('Poly1305 requires OpCodes library to be loaded first');
      return;
    }
  }
  
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
      console.error('Poly1305 requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Poly1305 large integer arithmetic helpers
  const Poly1305Math = {
    // Prime field modulus: P = 2^130 - 5
    // Represented as five 32-bit limbs: [low32, next32, next32, next32, high2+carry]
    P: [0xFFFFFFFB, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, 0x3], // 2^130 - 5
    
    /**
     * Initialize a 130-bit number as 5 limbs of 26 bits each (for easier arithmetic)
     * @returns {Array} [limb0, limb1, limb2, limb3, limb4] - five 26-bit limbs
     */
    create130: function() {
      return [0, 0, 0, 0, 0];
    },
    
    /**
     * Load little-endian bytes into 130-bit representation
     * @param {Array} bytes - Array of bytes (up to 17 bytes for 130-bit + padding)
     * @returns {Array} 130-bit number as 5 limbs
     */
    load130: function(bytes) {
      const h = [0, 0, 0, 0, 0];
      let t0, t1, t2, t3, t4;
      
      if (bytes.length >= 4) {
        t0 = (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
      } else {
        t0 = 0;
        for (let i = 0; i < bytes.length && i < 4; i++) {
          t0 |= (bytes[i] << (i * 8));
        }
        t0 >>>= 0;
      }
      
      if (bytes.length >= 8) {
        t1 = (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0;
      } else {
        t1 = 0;
        for (let i = 4; i < bytes.length && i < 8; i++) {
          t1 |= (bytes[i] << ((i - 4) * 8));
        }
        t1 >>>= 0;
      }
      
      if (bytes.length >= 12) {
        t2 = (bytes[8] | (bytes[9] << 8) | (bytes[10] << 16) | (bytes[11] << 24)) >>> 0;
      } else {
        t2 = 0;
        for (let i = 8; i < bytes.length && i < 12; i++) {
          t2 |= (bytes[i] << ((i - 8) * 8));
        }
        t2 >>>= 0;
      }
      
      if (bytes.length >= 16) {
        t3 = (bytes[12] | (bytes[13] << 8) | (bytes[14] << 16) | (bytes[15] << 24)) >>> 0;
      } else {
        t3 = 0;
        for (let i = 12; i < bytes.length && i < 16; i++) {
          t3 |= (bytes[i] << ((i - 12) * 8));
        }
        t3 >>>= 0;
      }
      
      // Handle the high bit for padding (bit 128)
      t4 = 0;
      if (bytes.length >= 17) {
        t4 = bytes[16] & 0x03; // Only 2 bits for 130-bit
      }
      
      // Pack into 26-bit limbs for easier arithmetic
      h[0] = t0 & 0x3ffffff;
      h[1] = ((t0 >>> 26) | (t1 << 6)) & 0x3ffffff;
      h[2] = ((t1 >>> 20) | (t2 << 12)) & 0x3ffffff;
      h[3] = ((t2 >>> 14) | (t3 << 18)) & 0x3ffffff;
      h[4] = ((t3 >>> 8) | (t4 << 24)) & 0x3ffffff;
      
      return h;
    },
    
    /**
     * Store 130-bit number back to little-endian bytes
     * @param {Array} h - 130-bit number as 5 limbs
     * @returns {Array} Byte array (16 bytes for 128-bit output)
     */
    store130: function(h) {
      let t0, t1, t2, t3;
      
      // Unpack from 26-bit limbs
      t0 = (h[0] | (h[1] << 26)) >>> 0;
      t1 = ((h[1] >>> 6) | (h[2] << 20)) >>> 0;
      t2 = ((h[2] >>> 12) | (h[3] << 14)) >>> 0;
      t3 = ((h[3] >>> 18) | (h[4] << 8)) >>> 0;
      
      const bytes = [];
      bytes[0] = t0 & 0xff;
      bytes[1] = (t0 >>> 8) & 0xff;
      bytes[2] = (t0 >>> 16) & 0xff;
      bytes[3] = (t0 >>> 24) & 0xff;
      bytes[4] = t1 & 0xff;
      bytes[5] = (t1 >>> 8) & 0xff;
      bytes[6] = (t1 >>> 16) & 0xff;
      bytes[7] = (t1 >>> 24) & 0xff;
      bytes[8] = t2 & 0xff;
      bytes[9] = (t2 >>> 8) & 0xff;
      bytes[10] = (t2 >>> 16) & 0xff;
      bytes[11] = (t2 >>> 24) & 0xff;
      bytes[12] = t3 & 0xff;
      bytes[13] = (t3 >>> 8) & 0xff;
      bytes[14] = (t3 >>> 16) & 0xff;
      bytes[15] = (t3 >>> 24) & 0xff;
      
      return bytes;
    },
    
    /**
     * Add two 130-bit numbers: a + b
     * @param {Array} a - First 130-bit number
     * @param {Array} b - Second 130-bit number
     * @returns {Array} Result a + b (may need reduction)
     */
    add130: function(a, b) {
      const result = [0, 0, 0, 0, 0];
      let carry = 0;
      
      for (let i = 0; i < 5; i++) {
        const sum = a[i] + b[i] + carry;
        result[i] = sum & 0x3ffffff;
        carry = sum >>> 26;
      }
      
      return result;
    },
    
    /**
     * Multiply 130-bit number by 32-bit number: h * r
     * @param {Array} h - 130-bit multiplicand
     * @param {Array} r - 130-bit multiplier (clamped r value)
     * @returns {Array} Product h * r (before reduction)
     */
    mul130: function(h, r) {
      let c = 0;
      let d0, d1, d2, d3, d4;
      
      // Optimized multiplication for 26-bit limbs
      d0 = c;
      d0 += h[0] * r[0];
      d0 += (h[1] * r[4]) * 5;
      d0 += (h[2] * r[3]) * 5;
      d0 += (h[3] * r[2]) * 5;
      d0 += (h[4] * r[1]) * 5;
      c = d0 >>> 26; d0 &= 0x3ffffff;
      
      d1 = c;
      d1 += h[0] * r[1];
      d1 += h[1] * r[0];
      d1 += (h[2] * r[4]) * 5;
      d1 += (h[3] * r[3]) * 5;
      d1 += (h[4] * r[2]) * 5;
      c = d1 >>> 26; d1 &= 0x3ffffff;
      
      d2 = c;
      d2 += h[0] * r[2];
      d2 += h[1] * r[1];
      d2 += h[2] * r[0];
      d2 += (h[3] * r[4]) * 5;
      d2 += (h[4] * r[3]) * 5;
      c = d2 >>> 26; d2 &= 0x3ffffff;
      
      d3 = c;
      d3 += h[0] * r[3];
      d3 += h[1] * r[2];
      d3 += h[2] * r[1];
      d3 += h[3] * r[0];
      d3 += (h[4] * r[4]) * 5;
      c = d3 >>> 26; d3 &= 0x3ffffff;
      
      d4 = c;
      d4 += h[0] * r[4];
      d4 += h[1] * r[3];
      d4 += h[2] * r[2];
      d4 += h[3] * r[1];
      d4 += h[4] * r[0];
      c = d4 >>> 26; d4 &= 0x3ffffff;
      
      // Reduce modulo P = 2^130 - 5
      d0 += c * 5;
      c = d0 >>> 26; d0 &= 0x3ffffff;
      d1 += c;
      
      // Further propagate carries
      c = d1 >>> 26; d1 &= 0x3ffffff;
      d2 += c;
      c = d2 >>> 26; d2 &= 0x3ffffff;
      d3 += c;
      c = d3 >>> 26; d3 &= 0x3ffffff;
      d4 += c;
      c = d4 >>> 26; d4 &= 0x3ffffff;
      
      // Handle any remaining overflow
      d0 += c * 5;
      c = d0 >>> 26; d0 &= 0x3ffffff;
      d1 += c;
      
      return [d0, d1, d2, d3, d4];
    },
    
    /**
     * Final reduction modulo P = 2^130 - 5
     * @param {Array} h - 130-bit number to reduce
     * @returns {Array} Reduced result
     */
    freeze: function(h) {
      // First normalize carries
      let c = 0;
      for (let i = 0; i < 4; i++) {
        c += h[i];
        h[i] = c & 0x3ffffff;
        c >>>= 26;
      }
      c += h[4];
      h[4] = c & 0x3ffffff;
      c >>>= 26;
      
      // Reduce any overflow (c * 5 where c represents multiples of 2^130)
      h[0] += c * 5;
      c = h[0] >>> 26;
      h[0] &= 0x3ffffff;
      h[1] += c;
      
      // Final conditional subtraction of P = 2^130 - 5
      // Standard approach: try to subtract P, if no underflow then use the result
      const g = [0, 0, 0, 0, 0];
      
      // Compute g = h - (2^130 - 5) = h - 2^130 + 5 = h + 5 - 2^130
      // We'll compute h + 5 and check if it overflows 130 bits
      let carry = 5;
      for (let i = 0; i < 5; i++) {
        carry += h[i];
        g[i] = carry & 0x3ffffff;
        carry >>>= 26;
      }
      
      // carry now contains the overflow bit (bit 130)
      // If carry = 0, then h < P (no reduction needed)
      // If carry = 1, then h >= P (use g = h + 5 - 2^130 = h - P)
      
      // Use conditional move: if carry=0 use h, if carry=1 use g
      const mask = carry - 1; // carry=0 -> mask=-1, carry=1 -> mask=0
      for (let i = 0; i < 5; i++) {
        h[i] = (h[i] & mask) | (g[i] & ~mask);
      }
      
      return h;
    }
  };
  
  // Create Poly1305 MAC object
  const Poly1305 = {
    // Public interface properties (adapted for MAC algorithm)
    internalName: 'Poly1305',
    name: 'Poly1305 MAC',
    comment: 'RFC 7539 Poly1305 Message Authentication Code',
    minKeyLength: 32, // 32 bytes (256 bits) for one-time key
    maxKeyLength: 32,
    stepKeyLength: 1,
    minBlockSize: 16, // 16-byte blocks
    maxBlockSize: 16,
    stepBlockSize: 1,
    instances: {},
    cantDecode: true, // MACs don't decode, they verify
    isInitialized: false,
    
    // Constants for RFC 7539 Poly1305
    BLOCK_SIZE: 16,
    KEY_SIZE: 32,
    TAG_SIZE: 16,
    
    // Initialize MAC
    Init: function() {
      Poly1305.isInitialized = true;
    },
    
    // Set up key
    KeySetup: function(key) {
      let id;
      do {
        id = 'Poly1305[' + global.generateUniqueID() + ']';
      } while (Poly1305.instances[id] || global.objectInstances[id]);
      
      Poly1305.instances[id] = new Poly1305.Poly1305Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear MAC data
    ClearData: function(id) {
      if (Poly1305.instances[id]) {
        delete Poly1305.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Poly1305', 'ClearData');
        return false;
      }
    },
    
    // Compute MAC (encrypt interface)
    encryptBlock: function(id, message) {
      if (!Poly1305.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Poly1305', 'encryptBlock');
        return '';
      }
      
      const instance = Poly1305.instances[id];
      return instance.computeMAC(message);
    },
    
    // Verify MAC (decrypt interface)
    decryptBlock: function(id, data) {
      // For MACs, this could verify the tag
      // Input format: message + 16-byte tag
      if (!Poly1305.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Poly1305', 'decryptBlock');
        return '';
      }
      
      if (data.length < Poly1305.TAG_SIZE) {
        return ''; // Invalid: too short for tag
      }
      
      const instance = Poly1305.instances[id];
      const message = data.substring(0, data.length - Poly1305.TAG_SIZE);
      const providedTag = data.substring(data.length - Poly1305.TAG_SIZE);
      const computedTag = instance.computeMAC(message);
      
      // Constant-time comparison
      const tagBytes1 = OpCodes.StringToBytes(providedTag);
      const tagBytes2 = OpCodes.StringToBytes(computedTag);
      
      if (OpCodes.SecureCompare(tagBytes1, tagBytes2)) {
        return message; // Verification successful
      } else {
        return ''; // Verification failed
      }
    },
    
    // Instance class
    Poly1305Instance: function(key) {
      if (!key || key.length !== Poly1305.KEY_SIZE) {
        throw new Error('Poly1305 requires exactly 32-byte key');
      }
      
      const keyBytes = OpCodes.StringToBytes(key);
      
      // Clamp the r value (first 16 bytes)
      this.r = [0, 0, 0, 0, 0];
      const rBytes = keyBytes.slice(0, 16);
      
      // Apply RFC 7539 clamping to r
      rBytes[3] &= 0x0f;
      rBytes[7] &= 0x0f;
      rBytes[11] &= 0x0f;
      rBytes[15] &= 0x0f;
      rBytes[4] &= 0xfc;
      rBytes[8] &= 0xfc;
      rBytes[12] &= 0xfc;
      
      this.r = Poly1305Math.load130(rBytes);
      
      // Store s value (second 16 bytes)
      this.s = Poly1305Math.load130(keyBytes.slice(16, 32));
      
      /**
       * Compute Poly1305 MAC for a message
       * @param {string} message - Message to authenticate
       * @returns {string} 16-byte MAC tag
       */
      this.computeMAC = function(message) {
        const msgBytes = OpCodes.StringToBytes(message);
        let h = Poly1305Math.create130(); // Accumulator starts at 0
        
        // Process message in 16-byte blocks
        for (let i = 0; i < msgBytes.length; i += Poly1305.BLOCK_SIZE) {
          const blockSize = Math.min(Poly1305.BLOCK_SIZE, msgBytes.length - i);
          const block = msgBytes.slice(i, i + blockSize);
          
          // Pad block according to RFC 7539 section 2.5.1
          if (blockSize < Poly1305.BLOCK_SIZE) {
            // For partial blocks, add 0x01 byte followed by zeros
            block[blockSize] = 0x01;
            while (block.length < Poly1305.BLOCK_SIZE + 1) {
              block.push(0x00);
            }
          } else {
            // For full 16-byte blocks, add 0x01 as the 17th byte
            block.push(0x01);
          }
          
          // Load block as 130-bit number
          const blockNum = Poly1305Math.load130(block);
          
          // h = (h + block) * r mod P
          h = Poly1305Math.add130(h, blockNum);
          h = Poly1305Math.mul130(h, this.r);
        }
        
        // Add s and reduce to get final tag (128 bits)
        h = Poly1305Math.add130(h, this.s);
        h = Poly1305Math.freeze(h);
        
        // Return only the low 128 bits as the tag
        const tagBytes = Poly1305Math.store130(h);
        return OpCodes.BytesToString(tagBytes);
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Poly1305);
  }
  
  // Export to global scope
  global.Poly1305 = Poly1305;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Poly1305;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);