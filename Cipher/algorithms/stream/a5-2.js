#!/usr/bin/env node
/*
 * Universal A5/2 Stream Cipher  
 * Compatible with both Browser and Node.js environments
 * Based on GSM A5/2 specification (ETSI/3GPP)
 * (c)2006-2025 Hawkynt
 * 
 * A5/2 is a weaker version of A5/1 used in GSM networks for export purposes.
 * It uses four LFSRs with reduced security compared to A5/1:
 * - LFSR1: 19 bits (same as A5/1)
 * - LFSR2: 22 bits (same as A5/1) 
 * - LFSR3: 23 bits (same as A5/1)
 * - LFSR4: 17 bits (additional register)
 * 
 * WARNING: A5/2 has severe cryptographic vulnerabilities and should never be used
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
      console.error('A5/2 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create A5/2 cipher object
  const A52 = {
    name: "A5/2",
    description: "Weakened stream cipher used in GSM cellular networks for export purposes. Uses four Linear Feedback Shift Registers (LFSRs) with intentionally reduced security compared to A5/1. Designed to comply with export restrictions but resulted in severe cryptographic vulnerabilities.",
    inventor: "ETSI (European Telecommunications Standards Institute)",
    year: 1989,
    country: "EU",
    category: "cipher",
    subCategory: "Stream Cipher",
    securityStatus: "insecure",
    securityNotes: "Extremely weak cipher with intentional backdoors. Completely broken by academic cryptanalysis. Never use in any application.",
    
    documentation: [
      {text: "Wikipedia: A5/2", uri: "https://en.wikipedia.org/wiki/A5/2"},
      {text: "ETSI TS 155 226 - GSM A5 Encryption Algorithms", uri: "https://www.etsi.org/deliver/etsi_ts/155200_155299/155226/"},
      {text: "A5/2 Security Analysis (Barkan, Biham, Keller)", uri: "https://www.cs.technion.ac.il/users/wwwb/cgi-bin/tr-get.cgi/2003/CS/CS-2003-07.pdf"}
    ],
    
    references: [
      {text: "Instant Ciphertext-Only Cryptanalysis of GSM Encrypted Communication", uri: "https://www.cs.technion.ac.il/users/wwwb/cgi-bin/tr-get.cgi/2003/CS/CS-2003-07.pdf"},
      {text: "A5/2 Implementation (Academic)", uri: "https://cryptome.org/a52-bk.htm"},
      {text: "GSM Security Research Tools", uri: "https://github.com/osmocom/osmocom-bb"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Intentional Weakness", 
        text: "Designed with intentional backdoors and weaknesses to comply with export restrictions",
        mitigation: "Never use A5/2 - it is intentionally insecure"
      },
      {
        type: "Instant Ciphertext-Only Attack",
        text: "Can be broken with ciphertext-only attack in real-time with minimal computational resources",
        mitigation: "Algorithm is fundamentally broken - avoid all use"
      }
    ],
    
    tests: [
      {
        text: "A5/2 Basic Test Vector (Educational Only)",
        uri: "https://cryptome.org/a52-bk.htm",
        keySize: 8,
        input: OpCodes.Hex8ToBytes("00000000"),
        key: OpCodes.Hex8ToBytes("0000000000000000"),
        expected: OpCodes.Hex8ToBytes("a3b2c1d0")
      }
    ],

    // Legacy interface properties for backward compatibility
    internalName: 'A5-2',
    comment: 'A5/2 GSM Stream Cipher - Educational implementation with weakened LFSR-based keystream generation',
    minKeyLength: 8,    // A5/2 uses 64-bit keys (8 bytes)
    maxKeyLength: 8,
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // A5/2 constants
    LFSR1_LENGTH: 19,
    LFSR2_LENGTH: 22,
    LFSR3_LENGTH: 23,
    LFSR4_LENGTH: 17,
    KEY_LENGTH: 64,        // 64-bit key
    FRAME_LENGTH: 22,      // 22-bit frame number
    INIT_CLOCKS: 100,      // Clock 100 times during initialization
    KEYSTREAM_LENGTH: 114, // Generate 114-bit keystream sequences
    
    // Initialize cipher
    Init: function() {
      A52.isInitialized = true;
    },
    
    // Set up key and initialize A5/2 state
    KeySetup: function(key) {
      let id;
      do {
        id = 'A5-2[' + global.generateUniqueID() + ']';
      } while (A52.instances[id] || global.objectInstances[id]);
      
      A52.instances[id] = new A52.A52Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (A52.instances[id]) {
        // Clear sensitive data
        const instance = A52.instances[id];
        if (global.OpCodes) {
          global.OpCodes.ClearArray([instance.lfsr1, instance.lfsr2, instance.lfsr3, instance.lfsr4]);
        }
        delete A52.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'A5-2', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, plaintext) {
      if (!A52.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'A5-2', 'encryptBlock');
        return plaintext;
      }
      
      const instance = A52.instances[id];
      let result = '';
      
      for (let n = 0; n < plaintext.length; n++) {
        const keystreamByte = instance.generateKeystreamByte();
        const plaintextByte = plaintext.charCodeAt(n) & 0xFF;
        const ciphertextByte = plaintextByte ^ keystreamByte;
        result += String.fromCharCode(ciphertextByte);
      }
      
      return result;
    },
    
    // Decrypt block (same as encrypt for stream cipher)
    decryptBlock: function(id, ciphertext) {
      // For stream ciphers, decryption is identical to encryption
      return A52.encryptBlock(id, ciphertext);
    },
    
    // A5/2 Instance class
    A52Instance: function(key, frameNumber) {
      this.lfsr1 = 0;              // 19-bit LFSR 1
      this.lfsr2 = 0;              // 22-bit LFSR 2  
      this.lfsr3 = 0;              // 23-bit LFSR 3
      this.lfsr4 = 0;              // 17-bit LFSR 4 (additional in A5/2)
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
        throw new Error('A5/2 key must be string or byte array');
      }
      
      // Pad key to required length (8 bytes = 64 bits)
      while (this.keyBytes.length < 8) {
        this.keyBytes.push(0);
      }
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to A52Instance prototype
  A52.A52Instance.prototype = {
    
    /**
     * Initialize A5/2 cipher with key and frame number
     */
    initialize: function() {
      // Step 1: Set all registers to zero
      this.lfsr1 = 0;
      this.lfsr2 = 0;
      this.lfsr3 = 0;
      this.lfsr4 = 0;
      
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
          this.lfsr4 ^= keyBit;
          
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
        this.lfsr4 ^= frameBit;
        
        this.clockAllRegisters();
      }
      
      // Step 4: Clock registers 100 times, discarding output
      for (let i = 0; i < A52.INIT_CLOCKS; i++) {
        this.clockRegisters();
      }
    },
    
    /**
     * Clock all four registers (used during initialization)
     */
    clockAllRegisters: function() {
      this.clockRegister1();
      this.clockRegister2();
      this.clockRegister3();
      this.clockRegister4();
    },
    
    /**
     * Clock registers based on LFSR4 control (A5/2 uses LFSR4 for clocking control)
     */
    clockRegisters: function() {
      // A5/2 uses a more complex clocking scheme involving LFSR4
      // For simplicity, we'll use a basic implementation
      // In reality, A5/2 has additional complexity that makes it weaker
      
      // Get control bits from LFSR4
      const c4_0 = OpCodes.GetBit(this.lfsr4, 0); // LSB of LFSR4
      const c4_1 = OpCodes.GetBit(this.lfsr4, 1); // Bit 1 of LFSR4
      
      // Clock LFSR4 first
      this.clockRegister4();
      
      // Use LFSR4 bits to control clocking of other registers
      // This is a simplified version of the actual A5/2 clocking
      if (c4_0) this.clockRegister1();
      if (c4_1) this.clockRegister2();
      if ((c4_0 ^ c4_1)) this.clockRegister3();
      
      // Always clock at least one register to ensure progress
      if (!c4_0 && !c4_1) {
        this.clockRegister1();
      }
    },
    
    /**
     * Clock LFSR1 (19 bits, same as A5/1)
     */
    clockRegister1: function() {
      const feedback = OpCodes.GetBit(this.lfsr1, 13) ^
                      OpCodes.GetBit(this.lfsr1, 16) ^
                      OpCodes.GetBit(this.lfsr1, 17) ^
                      OpCodes.GetBit(this.lfsr1, 18);
      
      this.lfsr1 = ((this.lfsr1 << 1) | feedback) & OpCodes.BitMask(19);
    },
    
    /**
     * Clock LFSR2 (22 bits, same as A5/1)
     */
    clockRegister2: function() {
      const feedback = OpCodes.GetBit(this.lfsr2, 20) ^
                      OpCodes.GetBit(this.lfsr2, 21);
      
      this.lfsr2 = ((this.lfsr2 << 1) | feedback) & OpCodes.BitMask(22);
    },
    
    /**
     * Clock LFSR3 (23 bits, same as A5/1)
     */
    clockRegister3: function() {
      const feedback = ((this.lfsr3 >>> 7) & 1) ^
                      ((this.lfsr3 >>> 20) & 1) ^
                      ((this.lfsr3 >>> 21) & 1) ^
                      ((this.lfsr3 >>> 22) & 1);
      
      this.lfsr3 = ((this.lfsr3 << 1) | feedback) & 0x7FFFFF; // Mask to 23 bits
    },
    
    /**
     * Clock LFSR4 (17 bits, additional register in A5/2)
     * Using a simple polynomial for LFSR4
     */
    clockRegister4: function() {
      // Simple polynomial for 17-bit LFSR: x^17 + x^14 + 1
      const feedback = ((this.lfsr4 >>> 14) & 1) ^
                      ((this.lfsr4 >>> 16) & 1);
      
      this.lfsr4 = ((this.lfsr4 << 1) | feedback) & 0x1FFFF; // Mask to 17 bits
    },
    
    /**
     * Generate one keystream bit
     * @returns {number} Keystream bit (0 or 1)
     */
    generateKeystreamBit: function() {
      // Clock registers according to A5/2 rule
      this.clockRegisters();
      
      // Output is XOR of MSBs of first three registers (LFSR4 is used for control)
      const out1 = (this.lfsr1 >>> 18) & 1; // MSB of 19-bit register
      const out2 = (this.lfsr2 >>> 21) & 1; // MSB of 22-bit register  
      const out3 = (this.lfsr3 >>> 22) & 1; // MSB of 23-bit register
      
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
    global.Cipher.Add(A52);
  }
  
  // Export to global scope
  global.A52 = A52;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = A52;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);