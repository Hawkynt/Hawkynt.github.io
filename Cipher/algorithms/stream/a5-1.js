#!/usr/bin/env node
/*
 * Universal A5/1 Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on GSM A5/1 specification (ETSI/3GPP)
 * (c)2006-2025 Hawkynt
 * 
 * A5/1 is a stream cipher used in GSM cellular networks for over-the-air
 * communication privacy. It uses three irregularly clocked LFSRs:
 * - LFSR1: 19 bits, polynomial x^19 + x^18 + x^17 + x^14 + 1
 * - LFSR2: 22 bits, polynomial x^22 + x^21 + 1  
 * - LFSR3: 23 bits, polynomial x^23 + x^22 + x^21 + x^8 + 1
 * 
 * WARNING: A5/1 has known cryptographic vulnerabilities and should not be used
 * in production systems. This implementation is for educational purposes only.
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
      console.error('A5/1 cipher requires Cipher system to be loaded first');
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
  
  // Create A5/1 cipher object
  const A51 = {
    name: "A5/1",
    description: "Stream cipher used in GSM cellular networks for over-the-air communication privacy. Uses three irregularly clocked Linear Feedback Shift Registers (LFSRs) with majority function clocking control. Developed as part of the GSM standard for encrypting voice and data transmissions between mobile phones and base stations.",
    inventor: "ETSI (European Telecommunications Standards Institute)",
    year: 1987,
    country: "EU",
    category: "cipher",
    subCategory: "Stream Cipher",
    securityStatus: "insecure",
    securityNotes: "Cryptographically broken by various attacks including time-memory tradeoffs, correlation attacks, and real-time key recovery. Superseded by A5/3 (KASUMI) in modern GSM networks.",
    
    documentation: [
      {text: "Wikipedia: A5/1", uri: "https://en.wikipedia.org/wiki/A5/1"},
      {text: "ETSI TS 155 226 - A5/1 Encryption Algorithm", uri: "https://www.etsi.org/deliver/etsi_ts/155200_155299/155226/"},
      {text: "3GPP TS 55.216 - A5/1 Algorithm Specification", uri: "https://www.3gpp.org/DynaReport/55216.htm"}
    ],
    
    references: [
      {text: "OsmocomBB A5/1 Implementation", uri: "https://github.com/osmocom/osmocom-bb"},
      {text: "A5/1 Reference Implementation (Cryptome)", uri: "https://cryptome.org/a51-bsw.htm"},
      {text: "Real Time Cryptanalysis of A5/1 (Biryukov-Shamir-Wagner)", uri: "https://www.cosic.esat.kuleuven.be/publications/article-152.pdf"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Time-Memory Tradeoff Attack", 
        text: "Practical real-time key recovery attacks demonstrated by Biryukov-Shamir-Wagner and others",
        mitigation: "Use modern algorithms like A5/3 (KASUMI) or A5/4 instead"
      },
      {
        type: "Correlation Attack",
        text: "Exploits linear properties of LFSRs to recover internal state",
        mitigation: "Algorithm is fundamentally insecure - avoid all use"
      }
    ],
    
    tests: [
      {
        text: "ETSI A5/1 Standard Test Vector",
        uri: "https://www.etsi.org/deliver/etsi_ts/155200_155299/155226/",
        keySize: 8,
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("0123456789ABCDEF"),
        expected: OpCodes.Hex8ToBytes("534EAA582FE8151AB6E1855A728C0051")
      },
      {
        text: "A5/1 All-zeros Test Vector (Educational)",
        uri: "https://cryptome.org/a51-bsw.htm",
        keySize: 8,
        input: OpCodes.Hex8ToBytes("00000000"),
        key: OpCodes.Hex8ToBytes("0000000000000000"),
        expected: OpCodes.Hex8ToBytes("ef4c987b")
      }
    ],

    // Legacy interface properties for backward compatibility
    internalName: 'A5-1',
    comment: 'A5/1 GSM Stream Cipher - Educational implementation with LFSR-based keystream generation',
    minKeyLength: 8,    // A5/1 uses 64-bit keys (8 bytes)
    maxKeyLength: 8,
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},

    
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // A5/1 constants
    LFSR1_LENGTH: 19,
    LFSR2_LENGTH: 22,
    LFSR3_LENGTH: 23,
    KEY_LENGTH: 64,        // 64-bit key
    FRAME_LENGTH: 22,      // 22-bit frame number
    INIT_CLOCKS: 100,      // Clock 100 times during initialization
    KEYSTREAM_LENGTH: 114, // Generate 114-bit keystream sequences
    
    // Initialize cipher
    Init: function() {
      A51.isInitialized = true;
    },
    
    // Set up key and initialize A5/1 state
    KeySetup: function(key) {
      let id;
      do {
        id = 'A5-1[' + global.generateUniqueID() + ']';
      } while (A51.instances[id] || global.objectInstances[id]);
      
      A51.instances[id] = new A51.A51Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (A51.instances[id]) {
        // Clear sensitive data
        const instance = A51.instances[id];
        if (instance.lfsr1 && global.OpCodes) {
          global.OpCodes.ClearArray([instance.lfsr1]);
        }
        if (instance.lfsr2 && global.OpCodes) {
          global.OpCodes.ClearArray([instance.lfsr2]);
        }
        if (instance.lfsr3 && global.OpCodes) {
          global.OpCodes.ClearArray([instance.lfsr3]);
        }
        delete A51.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'A5-1', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, plainText) {
      if (!A51.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'A5-1', 'encryptBlock');
        return plainText;
      }
      
      const instance = A51.instances[id];
      let result = '';
      
      for (let n = 0; n < plainText.length; n++) {
        const keystreamByte = instance.generateKeystreamByte();
        const plaintextByte = plainText.charCodeAt(n) & 0xFF;
        const ciphertextByte = plaintextByte ^ keystreamByte;
        result += String.fromCharCode(ciphertextByte);
      }
      
      return result;
    },
    
    // Decrypt block (same as encrypt for stream cipher)
    decryptBlock: function(id, cipherText) {
      // For stream ciphers, decryption is identical to encryption
      return A51.encryptBlock(id, cipherText);
    },
    
    // A5/1 Instance class
    A51Instance: function(key, frameNumber) {
      this.lfsr1 = 0;              // 19-bit LFSR 1
      this.lfsr2 = 0;              // 22-bit LFSR 2  
      this.lfsr3 = 0;              // 23-bit LFSR 3
      this.keyBytes = [];          // Store key as byte array
      this.frameNumber = frameNumber || 0; // Frame number for initialization
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length && this.keyBytes.length < 8; k++) {
          this.keyBytes.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        for (let k = 0; k < key.length && this.keyBytes.length < 8; k++) {
          this.keyBytes.push(key[k] & 0xFF);
        }
      } else {
        throw new Error('A5/1 key must be string or byte array');
      }
      
      // Pad key to required length (8 bytes = 64 bits)
      while (this.keyBytes.length < 8) {
        this.keyBytes.push(0);
      }
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to A51Instance prototype
  A51.A51Instance.prototype = {
    
    /**
     * Initialize A5/1 cipher with key and frame number
     */
    initialize: function() {
      // Step 1: Set all registers to zero
      this.lfsr1 = 0;
      this.lfsr2 = 0;
      this.lfsr3 = 0;
      
      // Step 2: Mix in 64-bit secret key
      // XOR each key bit to least significant bit of each register
      for (let byteIdx = 0; byteIdx < 8; byteIdx++) {
        const keyByte = this.keyBytes[byteIdx];
        for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
          const keyBit = (keyByte >>> bitIdx) & 1;
          
          // XOR key bit to LSB of each register and clock all registers
          this.lfsr1 ^= keyBit;
          this.lfsr2 ^= keyBit;
          this.lfsr3 ^= keyBit;
          
          this.clockAllRegisters();
        }
      }
      
      // Step 3: Mix in 22-bit frame number
      for (let bitIdx = 0; bitIdx < 22; bitIdx++) {
        const frameBit = (this.frameNumber >>> bitIdx) & 1;
        
        // XOR frame bit to LSB of each register and clock all registers
        this.lfsr1 ^= frameBit;
        this.lfsr2 ^= frameBit;
        this.lfsr3 ^= frameBit;
        
        this.clockAllRegisters();
      }
      
      // Step 4: Clock registers 100 times, discarding output
      for (let i = 0; i < A51.INIT_CLOCKS; i++) {
        this.clockRegisters();
      }
    },
    
    /**
     * Clock all three registers (used during initialization)
     */
    clockAllRegisters: function() {
      this.clockRegister1();
      this.clockRegister2();
      this.clockRegister3();
    },
    
    /**
     * Clock registers based on majority rule (used during keystream generation)
     */
    clockRegisters: function() {
      // Get clocking bits
      const c1 = OpCodes.GetBit(this.lfsr1, 8);  // Bit 8 of LFSR1
      const c2 = OpCodes.GetBit(this.lfsr2, 10); // Bit 10 of LFSR2
      const c3 = OpCodes.GetBit(this.lfsr3, 10); // Bit 10 of LFSR3
      
      // Calculate majority bit
      const majority = (c1 + c2 + c3) >= 2 ? 1 : 0;
      
      // Clock registers that agree with majority
      if (c1 === majority) this.clockRegister1();
      if (c2 === majority) this.clockRegister2();
      if (c3 === majority) this.clockRegister3();
    },
    
    /**
     * Clock LFSR1 (19 bits, polynomial x^19 + x^18 + x^17 + x^14 + 1)
     * Feedback taps: bits 13, 16, 17, 18 (0-indexed)
     */
    clockRegister1: function() {
      const feedback = OpCodes.GetBit(this.lfsr1, 13) ^
                      OpCodes.GetBit(this.lfsr1, 16) ^
                      OpCodes.GetBit(this.lfsr1, 17) ^
                      OpCodes.GetBit(this.lfsr1, 18);
      
      this.lfsr1 = ((this.lfsr1 << 1) | feedback) & OpCodes.BitMask(19);
    },
    
    /**
     * Clock LFSR2 (22 bits, polynomial x^22 + x^21 + 1)  
     * Feedback taps: bits 20, 21 (0-indexed)
     */
    clockRegister2: function() {
      const feedback = OpCodes.GetBit(this.lfsr2, 20) ^
                      OpCodes.GetBit(this.lfsr2, 21);
      
      this.lfsr2 = ((this.lfsr2 << 1) | feedback) & OpCodes.BitMask(22);
    },
    
    /**
     * Clock LFSR3 (23 bits, polynomial x^23 + x^22 + x^21 + x^8 + 1)
     * Feedback taps: bits 7, 20, 21, 22 (0-indexed)
     */
    clockRegister3: function() {
      const feedback = OpCodes.GetBit(this.lfsr3, 7) ^
                      OpCodes.GetBit(this.lfsr3, 20) ^
                      OpCodes.GetBit(this.lfsr3, 21) ^
                      OpCodes.GetBit(this.lfsr3, 22);
      
      this.lfsr3 = ((this.lfsr3 << 1) | feedback) & OpCodes.BitMask(23);
    },
    
    /**
     * Generate one keystream bit
     * @returns {number} Keystream bit (0 or 1)
     */
    generateKeystreamBit: function() {
      // Clock registers according to majority rule
      this.clockRegisters();
      
      // Output is XOR of MSBs of all three registers
      const out1 = OpCodes.GetBit(this.lfsr1, 18); // MSB of 19-bit register
      const out2 = OpCodes.GetBit(this.lfsr2, 21); // MSB of 22-bit register  
      const out3 = OpCodes.GetBit(this.lfsr3, 22); // MSB of 23-bit register
      
      return out1 ^ out2 ^ out3;
    },
    
    /**
     * Generate one keystream byte (8 bits)
     * @returns {number} Keystream byte (0-255)
     */
    generateKeystreamByte: function() {
      let byte = 0;
      for (let i = 0; i < 8; i++) {
        byte = (byte << 1) | this.generateKeystreamBit();
      }
      return byte;
    },
    
    /**
     * Generate multiple keystream bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Array} Array of keystream bytes
     */
    generateKeystream: function(length) {
      const keystream = [];
      for (let n = 0; n < length; n++) {
        keystream.push(this.generateKeystreamByte());
      }
      return keystream;
    },
    
    /**
     * Reset the cipher with new frame number
     * @param {number} newFrameNumber - New frame number for re-initialization
     */
    reset: function(newFrameNumber) {
      if (newFrameNumber !== undefined) {
        this.frameNumber = newFrameNumber & 0x3FFFFF; // Mask to 22 bits
      }
      this.initialize();
    },
    
    /**
     * Set a new frame number and reinitialize
     * @param {number} frameNumber - Frame number (0 to 2^22-1)
     */
    setFrameNumber: function(frameNumber) {
      this.reset(frameNumber);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(A51);
  }
  
  // Export to global scope
  global.A51 = A51;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = A51;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);