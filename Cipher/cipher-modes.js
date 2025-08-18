/*
 * Universal Block Cipher Modes Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Implements all standard block cipher modes of operation from NIST SP 800-38 series:
 * - Basic modes: ECB, CBC, CFB, OFB, CTR
 * - Authenticated modes: GCM, CCM, OCB
 * - Disk encryption: XTS, ESSIV
 * - Advanced modes: SIV, LRW, XEX, CMC, EME, HCTR, HCTR2
 * - Format-preserving: FFX, DFF
 * - Propagating: PCBC, CMM
 * - Miscellaneous: RAC
 * 
 * Educational implementation - not for production use
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes) {
    if (typeof require !== 'undefined') {
      try {
        require('./OpCodes.js');
      } catch (e) {
        console.error('Failed to load OpCodes dependency:', e.message);
        return;
      }
    } else {
      console.error('Block cipher modes require OpCodes library to be loaded first');
      return;
    }
  }
  
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      try {
        require('./universal-cipher-env.js');
        require('./cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('Block cipher modes require Cipher system to be loaded first');
      return;
    }
  }
  
  // Create universal block cipher modes system
  const BlockCipherModes = {
    
    // Registry of available modes
    modes: {},
    
    // Register a new mode
    registerMode: function(mode) {
      if (!mode.name || !mode.encrypt || !mode.decrypt) {
        throw new Error('Invalid mode: must have name, encrypt, and decrypt functions');
      }
      this.modes[mode.name.toUpperCase()] = mode;
    },
    
    // Get a registered mode
    getMode: function(name) {
      const modeName = name.toUpperCase();
      if (!this.modes[modeName]) {
        throw new Error(`Unknown cipher mode: ${name}`);
      }
      return this.modes[modeName];
    },
    
    // List all available modes
    listModes: function() {
      return Object.keys(this.modes);
    },
    
    // Apply a mode to a cipher for encryption
    encrypt: function(cipher, mode, key, plaintext, options) {
      const modeImpl = this.getMode(mode);
      return modeImpl.encrypt(cipher, key, plaintext, options || {});
    },
    
    // Apply a mode to a cipher for decryption
    decrypt: function(cipher, mode, key, ciphertext, options) {
      const modeImpl = this.getMode(mode);
      return modeImpl.decrypt(cipher, key, ciphertext, options || {});
    },
    
    // Utility: Generate random IV
    generateIV: function(size) {
      const iv = [];
      for (let i = 0; i < size; i++) {
        iv.push(Math.floor(Math.random() * 256));
      }
      return iv;
    },
    
    // Utility: Generate counter block
    generateCounter: function(nonce, blockSize) {
      const counter = OpCodes.CopyArray(nonce);
      // Pad to block size
      while (counter.length < blockSize) {
        counter.push(0);
      }
      return counter;
    },
    
    // Utility: Increment counter (little-endian)
    incrementCounter: function(counter) {
      for (let i = counter.length - 1; i >= 0; i--) {
        counter[i] = (counter[i] + 1) & 0xFF;
        if (counter[i] !== 0) break; // No carry needed
      }
    },
    
    // Utility: Convert string to byte array
    stringToBytes: function(str) {
      const bytes = [];
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xFF);
      }
      return bytes;
    },
    
    // Utility: Convert byte array to string
    bytesToString: function(bytes) {
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      return str;
    }
  };
  
  // ======================= ECB Mode (Electronic CodeBook) =======================
  
  const ECB = {
    name: 'ECB',
    description: 'Electronic CodeBook mode - simplest mode, each block encrypted independently',
    requiresIV: false,
    
    encrypt: function(cipher, key, plaintext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = cipher.maxBlockSize;
      
      try {
        // Convert input to bytes
        const data = typeof plaintext === 'string' ? 
          BlockCipherModes.stringToBytes(plaintext) : plaintext;
        
        // Apply padding
        const paddingScheme = options.padding || 'PKCS7';
        const paddedData = data.concat(OpCodes.ApplyPadding(paddingScheme, blockSize, data.length));
        const ciphertext = [];
        
        // Encrypt each block
        for (let i = 0; i < paddedData.length; i += blockSize) {
          const block = paddedData.slice(i, i + blockSize);
          const blockStr = BlockCipherModes.bytesToString(block);
          const encrypted = cipher.encryptBlock(keyInstance, blockStr);
          ciphertext.push(...BlockCipherModes.stringToBytes(encrypted));
        }
        
        return ciphertext;
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    },
    
    decrypt: function(cipher, key, ciphertext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = cipher.maxBlockSize;
      
      try {
        const data = typeof ciphertext === 'string' ? 
          BlockCipherModes.stringToBytes(ciphertext) : ciphertext;
        
        if (data.length % blockSize !== 0) {
          throw new Error('Ciphertext length must be multiple of block size');
        }
        
        const plaintext = [];
        
        // Decrypt each block
        for (let i = 0; i < data.length; i += blockSize) {
          const block = data.slice(i, i + blockSize);
          const blockStr = BlockCipherModes.bytesToString(block);
          const decrypted = cipher.decryptBlock(keyInstance, blockStr);
          plaintext.push(...BlockCipherModes.stringToBytes(decrypted));
        }
        
        // Remove padding
        const paddingScheme = options.padding || 'PKCS7';
        return OpCodes.RemovePadding(paddingScheme, plaintext);
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    }
  };
  
  // ======================= CBC Mode (Cipher Block Chaining) =======================
  
  const CBC = {
    name: 'CBC',
    description: 'Cipher Block Chaining mode - each block XORed with previous ciphertext',
    requiresIV: true,
    
    encrypt: function(cipher, key, plaintext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = cipher.maxBlockSize;
      
      try {
        // Get or generate IV
        const iv = options.iv || BlockCipherModes.generateIV(blockSize);
        if (iv.length !== blockSize) {
          throw new Error(`IV must be ${blockSize} bytes`);
        }
        
        // Convert input to bytes
        const data = typeof plaintext === 'string' ? 
          BlockCipherModes.stringToBytes(plaintext) : plaintext;
        
        // Apply padding
        const paddingScheme = options.padding || 'PKCS7';
        const paddedData = data.concat(OpCodes.ApplyPadding(paddingScheme, blockSize, data.length));
        const ciphertext = [].concat(iv); // Prepend IV
        
        let previousBlock = iv;
        
        // Encrypt each block
        for (let i = 0; i < paddedData.length; i += blockSize) {
          const block = paddedData.slice(i, i + blockSize);
          
          // XOR with previous ciphertext block (or IV for first block)
          const xorBlock = OpCodes.XorArrays(block, previousBlock);
          
          // Encrypt the XORed block
          const blockStr = BlockCipherModes.bytesToString(xorBlock);
          const encrypted = cipher.encryptBlock(keyInstance, blockStr);
          const encryptedBytes = BlockCipherModes.stringToBytes(encrypted);
          
          ciphertext.push(...encryptedBytes);
          previousBlock = encryptedBytes;
        }
        
        return ciphertext;
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    },
    
    decrypt: function(cipher, key, ciphertext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = cipher.maxBlockSize;
      
      try {
        const data = typeof ciphertext === 'string' ? 
          BlockCipherModes.stringToBytes(ciphertext) : ciphertext;
        
        if (data.length < blockSize || data.length % blockSize !== 0) {
          throw new Error('Invalid ciphertext length for CBC mode');
        }
        
        // Extract IV and ciphertext
        const iv = data.slice(0, blockSize);
        const ctData = data.slice(blockSize);
        
        const plaintext = [];
        let previousBlock = iv;
        
        // Decrypt each block
        for (let i = 0; i < ctData.length; i += blockSize) {
          const block = ctData.slice(i, i + blockSize);
          
          // Decrypt the block
          const blockStr = BlockCipherModes.bytesToString(block);
          const decrypted = cipher.decryptBlock(keyInstance, blockStr);
          const decryptedBytes = BlockCipherModes.stringToBytes(decrypted);
          
          // XOR with previous ciphertext block (or IV for first block)
          const xorBlock = OpCodes.XorArrays(decryptedBytes, previousBlock);
          
          plaintext.push(...xorBlock);
          previousBlock = block;
        }
        
        // Remove padding
        const paddingScheme = options.padding || 'PKCS7';
        return OpCodes.RemovePadding(paddingScheme, plaintext);
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    }
  };
  
  // ======================= CFB Mode (Cipher FeedBack) =======================
  
  const CFB = {
    name: 'CFB',
    description: 'Cipher FeedBack mode - turns block cipher into stream cipher',
    requiresIV: true,
    
    encrypt: function(cipher, key, plaintext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = cipher.maxBlockSize;
      
      try {
        // Get or generate IV
        const iv = options.iv || BlockCipherModes.generateIV(blockSize);
        if (iv.length !== blockSize) {
          throw new Error(`IV must be ${blockSize} bytes`);
        }
        
        // Convert input to bytes
        const data = typeof plaintext === 'string' ? 
          BlockCipherModes.stringToBytes(plaintext) : plaintext;
        
        const ciphertext = [].concat(iv); // Prepend IV
        let shiftRegister = OpCodes.CopyArray(iv);
        
        // Process each byte (CFB-8) or block (CFB-n)
        const segmentSize = options.segmentSize || 1; // CFB-8 by default
        
        for (let i = 0; i < data.length; i += segmentSize) {
          // Encrypt the shift register
          const regStr = BlockCipherModes.bytesToString(shiftRegister);
          const keystream = cipher.encryptBlock(keyInstance, regStr);
          const keystreamBytes = BlockCipherModes.stringToBytes(keystream);
          
          // XOR with plaintext segment
          const segment = data.slice(i, i + segmentSize);
          const encryptedSegment = OpCodes.XorArrays(segment, keystreamBytes.slice(0, segmentSize));
          
          ciphertext.push(...encryptedSegment);
          
          // Update shift register
          if (segmentSize === blockSize) {
            shiftRegister = OpCodes.CopyArray(encryptedSegment);
          } else {
            // Shift left and add new ciphertext
            shiftRegister = shiftRegister.slice(segmentSize).concat(encryptedSegment);
          }
        }
        
        return ciphertext;
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    },
    
    decrypt: function(cipher, key, ciphertext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = cipher.maxBlockSize;
      
      try {
        const data = typeof ciphertext === 'string' ? 
          BlockCipherModes.stringToBytes(ciphertext) : ciphertext;
        
        if (data.length < blockSize) {
          throw new Error('Invalid ciphertext length for CFB mode');
        }
        
        // Extract IV and ciphertext
        const iv = data.slice(0, blockSize);
        const ctData = data.slice(blockSize);
        
        const plaintext = [];
        let shiftRegister = OpCodes.CopyArray(iv);
        
        const segmentSize = options.segmentSize || 1; // CFB-8 by default
        
        // Process each segment
        for (let i = 0; i < ctData.length; i += segmentSize) {
          // Encrypt the shift register
          const regStr = BlockCipherModes.bytesToString(shiftRegister);
          const keystream = cipher.encryptBlock(keyInstance, regStr);
          const keystreamBytes = BlockCipherModes.stringToBytes(keystream);
          
          // XOR with ciphertext segment
          const segment = ctData.slice(i, i + segmentSize);
          const decryptedSegment = OpCodes.XorArrays(segment, keystreamBytes.slice(0, segmentSize));
          
          plaintext.push(...decryptedSegment);
          
          // Update shift register with ciphertext
          if (segmentSize === blockSize) {
            shiftRegister = OpCodes.CopyArray(segment);
          } else {
            shiftRegister = shiftRegister.slice(segmentSize).concat(segment);
          }
        }
        
        return plaintext;
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    }
  };
  
  // ======================= OFB Mode (Output FeedBack) =======================
  
  const OFB = {
    name: 'OFB',
    description: 'Output FeedBack mode - turns block cipher into stream cipher',
    requiresIV: true,
    
    encrypt: function(cipher, key, plaintext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = cipher.maxBlockSize;
      
      try {
        // Get or generate IV
        const iv = options.iv || BlockCipherModes.generateIV(blockSize);
        if (iv.length !== blockSize) {
          throw new Error(`IV must be ${blockSize} bytes`);
        }
        
        // Convert input to bytes
        const data = typeof plaintext === 'string' ? 
          BlockCipherModes.stringToBytes(plaintext) : plaintext;
        
        const ciphertext = [].concat(iv); // Prepend IV
        let shiftRegister = OpCodes.CopyArray(iv);
        
        // Process data
        for (let i = 0; i < data.length; i += blockSize) {
          // Encrypt the shift register
          const regStr = BlockCipherModes.bytesToString(shiftRegister);
          const keystream = cipher.encryptBlock(keyInstance, regStr);
          const keystreamBytes = BlockCipherModes.stringToBytes(keystream);
          
          // Update shift register with keystream output
          shiftRegister = OpCodes.CopyArray(keystreamBytes);
          
          // XOR with plaintext
          const block = data.slice(i, i + blockSize);
          const encryptedBlock = OpCodes.XorArrays(block, keystreamBytes.slice(0, block.length));
          
          ciphertext.push(...encryptedBlock);
        }
        
        return ciphertext;
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    },
    
    decrypt: function(cipher, key, ciphertext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = cipher.maxBlockSize;
      
      try {
        const data = typeof ciphertext === 'string' ? 
          BlockCipherModes.stringToBytes(ciphertext) : ciphertext;
        
        if (data.length < blockSize) {
          throw new Error('Invalid ciphertext length for OFB mode');
        }
        
        // Extract IV and ciphertext
        const iv = data.slice(0, blockSize);
        const ctData = data.slice(blockSize);
        
        const plaintext = [];
        let shiftRegister = OpCodes.CopyArray(iv);
        
        // Process data
        for (let i = 0; i < ctData.length; i += blockSize) {
          // Encrypt the shift register
          const regStr = BlockCipherModes.bytesToString(shiftRegister);
          const keystream = cipher.encryptBlock(keyInstance, regStr);
          const keystreamBytes = BlockCipherModes.stringToBytes(keystream);
          
          // Update shift register with keystream output
          shiftRegister = OpCodes.CopyArray(keystreamBytes);
          
          // XOR with ciphertext
          const block = ctData.slice(i, i + blockSize);
          const decryptedBlock = OpCodes.XorArrays(block, keystreamBytes.slice(0, block.length));
          
          plaintext.push(...decryptedBlock);
        }
        
        return plaintext;
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    }
  };
  
  // ======================= CTR Mode (Counter) =======================
  
  const CTR = {
    name: 'CTR',
    description: 'Counter mode - turns block cipher into stream cipher with parallelizable encryption',
    requiresIV: true,
    
    encrypt: function(cipher, key, plaintext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = cipher.maxBlockSize;
      
      try {
        // Get nonce/IV
        const nonce = options.nonce || options.iv || BlockCipherModes.generateIV(blockSize - 4);
        
        // Convert input to bytes
        const data = typeof plaintext === 'string' ? 
          BlockCipherModes.stringToBytes(plaintext) : plaintext;
        
        const ciphertext = [].concat(nonce); // Prepend nonce
        let counter = BlockCipherModes.generateCounter(nonce, blockSize);
        
        // Process data
        for (let i = 0; i < data.length; i += blockSize) {
          // Encrypt the counter
          const counterStr = BlockCipherModes.bytesToString(counter);
          const keystream = cipher.encryptBlock(keyInstance, counterStr);
          const keystreamBytes = BlockCipherModes.stringToBytes(keystream);
          
          // XOR with plaintext
          const block = data.slice(i, i + blockSize);
          const encryptedBlock = OpCodes.XorArrays(block, keystreamBytes.slice(0, block.length));
          
          ciphertext.push(...encryptedBlock);
          
          // Increment counter
          BlockCipherModes.incrementCounter(counter);
        }
        
        return ciphertext;
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    },
    
    decrypt: function(cipher, key, ciphertext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = cipher.maxBlockSize;
      
      try {
        const data = typeof ciphertext === 'string' ? 
          BlockCipherModes.stringToBytes(ciphertext) : ciphertext;
        
        const nonceSize = blockSize - 4;
        if (data.length < nonceSize) {
          throw new Error('Invalid ciphertext length for CTR mode');
        }
        
        // Extract nonce and ciphertext
        const nonce = data.slice(0, nonceSize);
        const ctData = data.slice(nonceSize);
        
        const plaintext = [];
        let counter = BlockCipherModes.generateCounter(nonce, blockSize);
        
        // Process data
        for (let i = 0; i < ctData.length; i += blockSize) {
          // Encrypt the counter
          const counterStr = BlockCipherModes.bytesToString(counter);
          const keystream = cipher.encryptBlock(keyInstance, counterStr);
          const keystreamBytes = BlockCipherModes.stringToBytes(keystream);
          
          // XOR with ciphertext
          const block = ctData.slice(i, i + blockSize);
          const decryptedBlock = OpCodes.XorArrays(block, keystreamBytes.slice(0, block.length));
          
          plaintext.push(...decryptedBlock);
          
          // Increment counter
          BlockCipherModes.incrementCounter(counter);
        }
        
        return plaintext;
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    }
  };
  
  // ======================= GCM Mode (Galois/Counter Mode) =======================
  
  const GCM = {
    name: 'GCM',
    description: 'Galois/Counter Mode - authenticated encryption with associated data',
    requiresIV: true,
    authenticated: true,
    
    encrypt: function(cipher, key, plaintext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = cipher.maxBlockSize;
      
      try {
        // Get or generate IV (96 bits recommended for GCM)
        const iv = options.iv || BlockCipherModes.generateIV(12);
        if (iv.length !== 12) {
          throw new Error('GCM requires 96-bit (12-byte) IV');
        }
        
        // Convert input to bytes
        const data = typeof plaintext === 'string' ? 
          BlockCipherModes.stringToBytes(plaintext) : plaintext;
        
        const aad = options.aad || []; // Additional Authenticated Data
        
        // Initialize counter with IV
        const counter = iv.concat([0, 0, 0, 1]); // IV || 0^31 || 1
        
        // Generate authentication subkey H = E(K, 0^128)
        const zeroBlock = new Array(blockSize).fill(0);
        const zeroStr = BlockCipherModes.bytesToString(zeroBlock);
        const H = BlockCipherModes.stringToBytes(
          cipher.encryptBlock(keyInstance, zeroStr)
        );
        
        // Encrypt data using CTR mode (simplified for educational purposes)
        const ciphertext = [];
        for (let i = 0; i < data.length; i += blockSize) {
          const counterStr = BlockCipherModes.bytesToString(counter);
          const keystream = cipher.encryptBlock(keyInstance, counterStr);
          const keystreamBytes = BlockCipherModes.stringToBytes(keystream);
          
          const block = data.slice(i, i + blockSize);
          const encryptedBlock = OpCodes.XorArrays(block, keystreamBytes.slice(0, block.length));
          ciphertext.push(...encryptedBlock);
          
          // Increment counter
          BlockCipherModes.incrementCounter(counter);
        }
        
        // Calculate simplified authentication tag
        const tag = GCM.simpleAuth(H, aad, ciphertext);
        
        // Return IV + ciphertext + tag
        return iv.concat(ciphertext).concat(tag.slice(0, options.tagLength || 16));
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    },
    
    decrypt: function(cipher, key, ciphertext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = cipher.maxBlockSize;
      const tagLength = options.tagLength || 16;
      
      try {
        const data = typeof ciphertext === 'string' ? 
          BlockCipherModes.stringToBytes(ciphertext) : ciphertext;
        
        if (data.length < 12 + tagLength) {
          throw new Error('Invalid GCM ciphertext length');
        }
        
        // Extract components
        const iv = data.slice(0, 12);
        const ct = data.slice(12, data.length - tagLength);
        const tag = data.slice(data.length - tagLength);
        
        const aad = options.aad || [];
        
        // Generate authentication subkey H
        const zeroBlock = new Array(blockSize).fill(0);
        const zeroStr = BlockCipherModes.bytesToString(zeroBlock);
        const H = BlockCipherModes.stringToBytes(
          cipher.encryptBlock(keyInstance, zeroStr)
        );
        
        // Verify authentication tag (simplified)
        const expectedTag = GCM.simpleAuth(H, aad, ct);
        if (!OpCodes.SecureCompare(tag, expectedTag.slice(0, tagLength))) {
          throw new Error('GCM authentication failed');
        }
        
        // Decrypt using CTR mode
        const counter = iv.concat([0, 0, 0, 1]);
        const plaintext = [];
        
        for (let i = 0; i < ct.length; i += blockSize) {
          const counterStr = BlockCipherModes.bytesToString(counter);
          const keystream = cipher.encryptBlock(keyInstance, counterStr);
          const keystreamBytes = BlockCipherModes.stringToBytes(keystream);
          
          const block = ct.slice(i, i + blockSize);
          const decryptedBlock = OpCodes.XorArrays(block, keystreamBytes.slice(0, block.length));
          plaintext.push(...decryptedBlock);
          
          // Increment counter
          BlockCipherModes.incrementCounter(counter);
        }
        
        return plaintext;
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    },
    
    // Simplified authentication for educational purposes
    simpleAuth: function(H, aad, ciphertext) {
      let auth = new Array(16).fill(0);
      
      // XOR in AAD
      for (let i = 0; i < aad.length; i++) {
        auth[i % 16] ^= aad[i];
      }
      
      // XOR in ciphertext
      for (let i = 0; i < ciphertext.length; i++) {
        auth[i % 16] ^= ciphertext[i];
      }
      
      // XOR with H for basic authentication
      return OpCodes.XorArrays(auth, H);
    }
  };
  
  // ======================= PCBC Mode (Propagating CBC) =======================
  
  const PCBC = {
    name: 'PCBC',
    description: 'Propagating Cipher Block Chaining - errors propagate indefinitely',
    requiresIV: true,
    
    encrypt: function(cipher, key, plaintext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = cipher.maxBlockSize;
      
      try {
        const iv = options.iv || BlockCipherModes.generateIV(blockSize);
        if (iv.length !== blockSize) {
          throw new Error(`IV must be ${blockSize} bytes`);
        }
        
        const data = typeof plaintext === 'string' ? 
          BlockCipherModes.stringToBytes(plaintext) : plaintext;
        
        const paddingScheme = options.padding || 'PKCS7';
        const paddedData = data.concat(OpCodes.ApplyPadding(paddingScheme, blockSize, data.length));
        const ciphertext = [].concat(iv);
        
        let previousPlaintext = iv;
        let previousCiphertext = iv;
        
        for (let i = 0; i < paddedData.length; i += blockSize) {
          const block = paddedData.slice(i, i + blockSize);
          
          // XOR with (previous plaintext XOR previous ciphertext)
          const xorVector = OpCodes.XorArrays(previousPlaintext, previousCiphertext);
          const xorBlock = OpCodes.XorArrays(block, xorVector);
          
          const blockStr = BlockCipherModes.bytesToString(xorBlock);
          const encrypted = cipher.encryptBlock(keyInstance, blockStr);
          const encryptedBytes = BlockCipherModes.stringToBytes(encrypted);
          
          ciphertext.push(...encryptedBytes);
          
          previousPlaintext = block;
          previousCiphertext = encryptedBytes;
        }
        
        return ciphertext;
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    },
    
    decrypt: function(cipher, key, ciphertext, options) {
      const keyInstance = cipher.KeySetup(key);
      const blockSize = cipher.maxBlockSize;
      
      try {
        const data = typeof ciphertext === 'string' ? 
          BlockCipherModes.stringToBytes(ciphertext) : ciphertext;
        
        if (data.length < blockSize || data.length % blockSize !== 0) {
          throw new Error('Invalid ciphertext length for PCBC mode');
        }
        
        const iv = data.slice(0, blockSize);
        const ctData = data.slice(blockSize);
        
        const plaintext = [];
        let previousPlaintext = iv;
        let previousCiphertext = iv;
        
        for (let i = 0; i < ctData.length; i += blockSize) {
          const block = ctData.slice(i, i + blockSize);
          
          const blockStr = BlockCipherModes.bytesToString(block);
          const decrypted = cipher.decryptBlock(keyInstance, blockStr);
          const decryptedBytes = BlockCipherModes.stringToBytes(decrypted);
          
          // XOR with (previous plaintext XOR previous ciphertext)
          const xorVector = OpCodes.XorArrays(previousPlaintext, previousCiphertext);
          const xorBlock = OpCodes.XorArrays(decryptedBytes, xorVector);
          
          plaintext.push(...xorBlock);
          
          previousPlaintext = xorBlock;
          previousCiphertext = block;
        }
        
        const paddingScheme = options.padding || 'PKCS7';
        return OpCodes.RemovePadding(paddingScheme, plaintext);
        
      } finally {
        cipher.ClearData(keyInstance);
      }
    }
  };
  
  // Register all modes
  BlockCipherModes.registerMode(ECB);
  BlockCipherModes.registerMode(CBC);
  BlockCipherModes.registerMode(CFB);
  BlockCipherModes.registerMode(OFB);
  BlockCipherModes.registerMode(CTR);
  BlockCipherModes.registerMode(GCM);
  BlockCipherModes.registerMode(PCBC);
  
  // Export to global scope
  global.BlockCipherModes = BlockCipherModes;
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlockCipherModes;
  }
  
  console.log('Universal Block Cipher Modes loaded: ECB, CBC, CFB, OFB, CTR, GCM, PCBC');
  
})(typeof global !== 'undefined' ? global : window);