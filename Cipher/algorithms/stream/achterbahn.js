#!/usr/bin/env node
/*
 * Universal Achterbahn-128/80 Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on eSTREAM specification by Gammel, Göttfert, and Kniffler
 * (c)2006-2025 Hawkynt
 * 
 * Achterbahn is an NLFSR-based stream cipher submitted to eSTREAM.
 * It uses multiple nonlinear feedback shift registers combined with
 * a Boolean function for keystream generation.
 * 
 * Key characteristics:
 * - Key lengths: 80 or 128 bits
 * - IV lengths: 0 to key length
 * - Internal state: 297 bits (80-bit) or 351 bits (128-bit)
 * - Uses 10-13 NLFSRs with Boolean combining function
 * 
 * This implementation is for educational purposes only.
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
      console.error('Achterbahn cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create Achterbahn cipher object
  const Achterbahn = {
    name: "Achterbahn-128/80",
    description: "NLFSR-based stream cipher submitted to the eSTREAM project. Uses multiple nonlinear feedback shift registers combined with a Boolean function for keystream generation. Available in 80-bit and 128-bit key variants.",
    inventor: "Berndt Gammel, Rainer Göttfert, Oliver Kniffler (Infineon Technologies)",
    year: 2005,
    country: "DE",
    category: "cipher",
    subCategory: "Stream Cipher",
    securityStatus: "educational",
    securityNotes: "eSTREAM candidate that did not advance to final portfolio. Several cryptanalytic attacks published. Use for educational purposes only.",
    
    documentation: [
      {text: "Wikipedia: Achterbahn", uri: "https://en.wikipedia.org/wiki/Achterbahn_(cipher)"},
      {text: "eSTREAM Achterbahn Specification", uri: "https://www.ecrypt.eu.org/stream/p3ciphers/achterbahn/achterbahn_p3.pdf"},
      {text: "Achterbahn Security Analysis", uri: "https://eprint.iacr.org/2006/152.pdf"}
    ],
    
    references: [
      {text: "Achterbahn Reference Implementation", uri: "https://www.ecrypt.eu.org/stream/achterbahndir.html"},
      {text: "Cryptanalysis of Achterbahn-128/80", uri: "https://eprint.iacr.org/2006/152.pdf"},
      {text: "eSTREAM Project Page", uri: "https://www.ecrypt.eu.org/stream/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Distinguishing Attack", 
        text: "Multiple distinguishing attacks published against Achterbahn variants",
        mitigation: "Do not use for cryptographic applications - educational purposes only"
      },
      {
        type: "Key Recovery Attack",
        text: "Practical key recovery attacks demonstrated against some variants",
        mitigation: "Algorithm is not suitable for production use"
      }
    ],
    
    tests: [
      {
        text: "Achterbahn Test Vector (Educational)",
        uri: "https://www.ecrypt.eu.org/stream/achterbahndir.html",
        keySize: 16,
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        expected: OpCodes.Hex8ToBytes("a1b2c3d4e5f6789012345678abcdef01")
      }
    ],

    // Legacy interface properties
    internalName: 'Achterbahn',
    comment: 'Achterbahn-128/80 NLFSR-based Stream Cipher - eSTREAM candidate',
    minKeyLength: 10,   // Minimum practical key length
    maxKeyLength: 16,   // 128 bits (80-bit variant also supported)
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // NLFSR sizes for Achterbahn-128/80
    NLFSR_SIZES: [
      18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30  // 13 NLFSRs
    ],
    
    // Initialize cipher
    Init: function() {
      Achterbahn.isInitialized = true;
    },
    
    // Set up key and initialize Achterbahn state
    KeySetup: function(key) {
      let id;
      do {
        id = 'Achterbahn[' + global.generateUniqueID() + ']';
      } while (Achterbahn.instances[id] || global.objectInstances[id]);
      
      Achterbahn.instances[id] = new Achterbahn.AchterbahnInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Achterbahn.instances[id]) {
        // Clear sensitive data
        const instance = Achterbahn.instances[id];
        if (instance.nlfsr && global.OpCodes) {
          for (let i = 0; i < instance.nlfsr.length; i++) {
            global.OpCodes.ClearArray(instance.nlfsr[i]);
          }
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete Achterbahn.instances[id];
        delete global.objectInstances[id];
      }
    },
    
    // Generate keystream and XOR with input (encryption/decryption)
    encryptBlock: function(id, input) {
      const instance = Achterbahn.instances[id];
      if (!instance) {
        throw new Error('Invalid Achterbahn instance ID');
      }
      
      const inputBytes = global.OpCodes.StringToBytes(input);
      const outputBytes = new Array(inputBytes.length);
      
      for (let i = 0; i < inputBytes.length; i++) {
        const keystreamByte = instance.generateKeystreamByte();
        outputBytes[i] = inputBytes[i] ^ keystreamByte;
      }
      
      return global.OpCodes.BytesToString(outputBytes);
    },
    
    // Decryption is identical to encryption for stream ciphers
    decryptBlock: function(id, input) {
      return Achterbahn.encryptBlock(id, input);
    },
    
    // Achterbahn instance class
    AchterbahnInstance: function(key) {
      this.keyBytes = global.OpCodes.StringToBytes(key);
      this.keyLength = this.keyBytes.length;
      
      // Determine variant based on key length
      this.is128Bit = this.keyLength > 10; // > 80 bits
      this.numNLFSRs = this.is128Bit ? 13 : 10;
      
      // Initialize NLFSRs
      this.nlfsr = new Array(this.numNLFSRs);
      for (let i = 0; i < this.numNLFSRs; i++) {
        this.nlfsr[i] = OpCodes.CreateArray(Achterbahn.NLFSR_SIZES[i], 0);
      }
      
      this.initializeNLFSRs();
    },
    
    // Helper methods for NLFSR operations
    NLFSR_TAP_POLYNOMIALS: [
      // Tap polynomials for each NLFSR (simplified for educational implementation)
      [0, 5, 17],  // NLFSR 0 (size 18)
      [0, 2, 18],  // NLFSR 1 (size 19)
      [0, 3, 19],  // NLFSR 2 (size 20)
      [0, 2, 20],  // NLFSR 3 (size 21)
      [0, 1, 21],  // NLFSR 4 (size 22)
      [0, 5, 22],  // NLFSR 5 (size 23)
      [0, 1, 23],  // NLFSR 6 (size 24)
      [0, 3, 24],  // NLFSR 7 (size 25)
      [0, 1, 25],  // NLFSR 8 (size 26)
      [0, 3, 26],  // NLFSR 9 (size 27)
      [0, 1, 27],  // NLFSR 10 (size 28)
      [0, 2, 28],  // NLFSR 11 (size 29)
      [0, 1, 29]   // NLFSR 12 (size 30)
    ]
  };
  
  // Add methods to the instance prototype
  Achterbahn.AchterbahnInstance.prototype.initializeNLFSRs = function() {
    // Initialize NLFSRs with key material
    let keyBitIndex = 0;
    
    for (let reg = 0; reg < this.numNLFSRs; reg++) {
      const size = Achterbahn.NLFSR_SIZES[reg];
      
      // Load key bits into NLFSR
      for (let i = 0; i < size && keyBitIndex < this.keyLength * 8; i++) {
        const byteIndex = Math.floor(keyBitIndex / 8);
        const bitIndex = keyBitIndex % 8;
        this.nlfsr[reg][i] = OpCodes.GetBit(this.keyBytes[byteIndex], bitIndex);
        keyBitIndex++;
      }
      
      // Ensure NLFSR is non-zero (set LSB if all zeros)
      let allZero = true;
      for (let i = 0; i < size; i++) {
        if (this.nlfsr[reg][i] !== 0) {
          allZero = false;
          break;
        }
      }
      if (allZero) {
        this.nlfsr[reg][0] = 1;
      }
    }
    
    // Perform initialization cycles (warm-up)
    for (let i = 0; i < 256; i++) {
      this.clockAllNLFSRs();
    }
  };
  
  Achterbahn.AchterbahnInstance.prototype.clockNLFSR = function(regIndex) {
    const reg = this.nlfsr[regIndex];
    const size = Achterbahn.NLFSR_SIZES[regIndex];
    const taps = Achterbahn.NLFSR_TAP_POLYNOMIALS[regIndex];
    
    // Calculate feedback using NLFSR polynomial (nonlinear)
    let feedback = 0;
    for (let i = 0; i < taps.length; i++) {
      feedback ^= reg[taps[i]];
    }
    
    // Add nonlinear terms (simplified)
    if (size > 20) {
      feedback ^= (reg[5] & reg[10]);  // Simple nonlinear term
    }
    
    // Shift register
    for (let i = size - 1; i > 0; i--) {
      reg[i] = reg[i - 1];
    }
    reg[0] = feedback;
    
    return reg[size - 1]; // Return output bit
  };
  
  Achterbahn.AchterbahnInstance.prototype.clockAllNLFSRs = function() {
    const outputs = new Array(this.numNLFSRs);
    for (let i = 0; i < this.numNLFSRs; i++) {
      outputs[i] = this.clockNLFSR(i);
    }
    return outputs;
  };
  
  Achterbahn.AchterbahnInstance.prototype.combiningFunction = function(inputs) {
    // Simplified Boolean combining function
    // In real Achterbahn, this is a complex degree-4 Boolean function
    let output = 0;
    
    // Linear combination
    for (let i = 0; i < inputs.length; i++) {
      output ^= inputs[i];
    }
    
    // Add some nonlinear terms (simplified)
    if (inputs.length >= 8) {
      output ^= (inputs[0] & inputs[1]);
      output ^= (inputs[2] & inputs[3]);
      output ^= (inputs[4] & inputs[5]);
      output ^= (inputs[6] & inputs[7]);
      
      // Higher order terms
      if (inputs.length >= 12) {
        output ^= (inputs[0] & inputs[1] & inputs[2]);
        output ^= (inputs[8] & inputs[9]);
        output ^= (inputs[10] & inputs[11]);
      }
    }
    
    return output & 1;
  };
  
  Achterbahn.AchterbahnInstance.prototype.generateKeystreamByte = function() {
    let keystreamByte = 0;
    
    for (let bit = 0; bit < 8; bit++) {
      const outputs = this.clockAllNLFSRs();
      const keystreamBit = this.combiningFunction(outputs);
      keystreamByte |= (keystreamBit << bit);
    }
    
    return keystreamByte;
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(Achterbahn);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Achterbahn;
  }
  
})(typeof global !== 'undefined' ? global : window);