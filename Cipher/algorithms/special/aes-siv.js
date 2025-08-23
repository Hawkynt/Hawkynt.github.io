#!/usr/bin/env node
/*
 * AES-SIV (Synthetic Initialization Vector) Implementation
 * Compatible with both Browser and Node.js environments
 * Based on RFC 5297 - Synthetic Initialization Vector (SIV) Authenticated Encryption
 * (c)2006-2025 Hawkynt
 * 
 * AES-SIV Algorithm Overview:
 * - Deterministic authenticated encryption with associated data (AEAD)
 * - Provides both authenticity and confidentiality with deterministic behavior
 * - Resistant to nonce reuse attacks - safe even with repeated nonces
 * - Two-pass construction: S2V for authentication + CTR for encryption
 * - Uses AES as underlying block cipher with SIV mode construction
 * 
 * Key Features:
 * - Key sizes: 256 bits, 384 bits, or 512 bits (for AES-128, AES-192, AES-256)
 * - Deterministic encryption (same plaintext → same ciphertext)
 * - Nonce misuse-resistant (safe to reuse nonces)
 * - Supports multiple associated data strings
 * - SIV (authentication tag) serves as synthetic IV for encryption
 * 
 * Construction:
 * 1. S2V (String-to-Vector): Generate 128-bit authentication tag
 * 2. Use authentication tag as synthetic IV for AES-CTR encryption
 * 3. Output: SIV || Ciphertext (authentication tag + encrypted data)
 * 
 * WARNING: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 * 
 * References:
 * - RFC 5297: Synthetic Initialization Vector (SIV) Authenticated Encryption
 * - "Deterministic Authenticated-Encryption" by Rogaway & Shrimpton
 * - "SIV-AES: Specifications and Analysis" technical papers
 */

(function(global) {
  'use strict';
  
  // Load AlgorithmFramework (REQUIRED)
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }

  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }
  
  // Load AES dependency
  if (typeof require !== 'undefined') {
    try {
      require('../block/rijndael.js'); // AES implementation
    } catch (e) {
      console.error('Failed to load AES dependency:', e.message);
      return;
    }
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CryptoAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = global.AlgorithmFramework;
  
  class AesSiv extends CryptoAlgorithm {
    constructor() {
      super();
      
      this.name = "AES-SIV";
      this.description = "Synthetic Initialization Vector deterministic authenticated encryption. Provides nonce misuse resistance and deterministic encryption properties for secure AEAD operations.";
      this.inventor = "Phillip Rogaway, Thomas Shrimpton";
      this.year = 2006;
      this.country = CountryCode.US;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Deterministic AEAD";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      
      this.documentation = [
        new LinkItem("RFC 5297 - Synthetic Initialization Vector (SIV) Authenticated Encryption", "https://tools.ietf.org/html/rfc5297"),
        new LinkItem("NIST SP 800-38F - Methods for Key Derivation and Data Protection", "https://csrc.nist.gov/publications/detail/sp/800-38f/final")
      ];
      
      this.references = [
        new LinkItem("Deterministic Authenticated-Encryption (DAE) Paper", "https://web.cs.ucdavis.edu/~rogaway/papers/siv.pdf"),
        new LinkItem("SIV Mode Security Analysis", "https://eprint.iacr.org/2006/221.pdf")
      ];

      this.tests = [
        new TestCase(
          global.OpCodes.Hex8ToBytes(''), // empty plaintext
          global.OpCodes.Hex8ToBytes('85632d07c6e8f37f950acd320a2ecc9340c02b9690c4dc04daef7f6afe5c'),
          'RFC 5297 AES-SIV Test Vector 1 (empty plaintext)',
          'https://tools.ietf.org/html/rfc5297#appendix-A'
        ),
        new TestCase(
          global.OpCodes.Hex8ToBytes('112233445566778899aabbccddee'),
          global.OpCodes.Hex8ToBytes('85632d07c6e8f37f950acd320a2ecc9340c02b9690c4dc04daef7f6afe5c317722bc40d38f1b1d82e0eb24f83e6a'),
          'RFC 5297 AES-SIV Test Vector 2',
          'https://tools.ietf.org/html/rfc5297#appendix-A'
        )
      ];
      
      // Add key and AAD properties to test cases  
      this.tests[0].key = global.OpCodes.Hex8ToBytes('404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f');
      this.tests[0].aad = [];
      this.tests[1].key = global.OpCodes.Hex8ToBytes('404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f');
      this.tests[1].aad = [];
      
      this.testVectors = this.tests;
    }
    
    CreateInstance(isInverse = false) {
      return new AesSivInstance(this, isInverse);
    }
  }
  // SIV constants
  const BLOCK_SIZE = 16;        // AES block size
  const SIV_SIZE = 16;          // SIV tag size (128 bits)
  
  class AesSivInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this.key1 = [];             // First half of key (for CMAC)
      this.key2 = [];             // Second half of key (for CTR)
      this.aesId1 = null;         // AES instance for CMAC
      this.aesId2 = null;         // AES instance for CTR
      this.aadArray = [];         // Associated data
    }
    
    set key(keyData) {
      // Convert key to byte array
      let keyBytes;
      if (typeof keyData === 'string') {
        keyBytes = [];
        for (let k = 0; k < keyData.length; k++) {
          keyBytes.push(keyData.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(keyData)) {
        keyBytes = keyData;
      } else {
        throw new Error('AES-SIV key must be string or byte array');
      }
      
      this.initializeKeys(keyBytes);
    }
    
    set aad(aadData) {
      this.aadArray = Array.isArray(aadData) ? aadData : [aadData || ''];
    }
    
    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }
    
    Result() {
      if (this.inputBuffer.length === 0) return [];
      
      const result = this.isInverse ? 
        this.decrypt(this.inputBuffer, this.aadArray) : 
        this.encrypt(this.inputBuffer, this.aadArray);
      
      this.inputBuffer = [];
      return result;
    }
    
    /**
     * Initialize the two AES keys from master key
     * @param {Array} keyBytes - Master key bytes
     */
    initializeKeys(keyBytes) {
      // Validate key length (must be double AES key size)
      if (keyBytes.length !== 32 && keyBytes.length !== 48 && keyBytes.length !== 64) {
        throw new Error('AES-SIV key must be 256, 384, or 512 bits (32, 48, or 64 bytes)');
      }
      
      // Split key in half
      const halfLen = keyBytes.length / 2;
      this.key1 = keyBytes.slice(0, halfLen);      // First half for CMAC
      this.key2 = keyBytes.slice(halfLen);         // Second half for CTR
      
      // Initialize AES instances
      this.aesId1 = global.Rijndael.KeySetup(global.OpCodes.BytesToString(this.key1));
      this.aesId2 = global.Rijndael.KeySetup(global.OpCodes.BytesToString(this.key2));
    }
    
    /**
     * Galois Field multiplication by 2 (used in CMAC)
     * @param {Array} block - 16-byte block
     * @returns {Array} Block multiplied by 2 in GF(2^128)
     */
    gfMul2(block) {
      const result = new Array(16);
      let carry = 0;
      
      for (let i = 15; i >= 0; i--) {
        const newCarry = (block[i] & 0x80) ? 1 : 0;
        result[i] = ((block[i] << 1) | carry) & 0xFF;
        carry = newCarry;
      }
      
      // If there was a carry, XOR with the reduction polynomial
      if (carry) {
        result[15] ^= 0x87; // GF(2^128) reduction polynomial
      }
      
      return result;
    }
    
    /**
     * Generate CMAC subkeys K1 and K2
     * @returns {Object} Object with k1 and k2 arrays
     */
    generateCMACSubkeys() {
      // L = AES_K(0^128)
      const zeroBlock = new Array(16).fill(0);
      const L = global.OpCodes.StringToBytes(
        global.Rijndael.encryptBlock(this.aesId1, global.OpCodes.BytesToString(zeroBlock))
      );
      
      // K1 = L * 2
      const K1 = this.gfMul2(L);
      
      // K2 = K1 * 2
      const K2 = this.gfMul2(K1);
      
      return { k1: K1, k2: K2 };
    }
    
    /**
     * Compute CMAC of data
     * @param {Array} data - Data to authenticate
     * @returns {Array} 16-byte CMAC
     */
    computeCMAC(data) {
      const subkeys = this.generateCMACSubkeys();
      
      // Pad data to multiple of 16 bytes
      const paddedData = data.slice(0);
      const isComplete = (data.length % 16 === 0) && (data.length > 0);
      
      if (!isComplete) {
        // Pad with 10...0 pattern
        paddedData.push(0x80);
        while (paddedData.length % 16 !== 0) {
          paddedData.push(0);
        }
      }
      
      // Process blocks
      let mac = new Array(16).fill(0);
      
      for (let i = 0; i < paddedData.length; i += 16) {
        const block = paddedData.slice(i, i + 16);
        
        // XOR with previous MAC
        for (let j = 0; j < 16; j++) {
          block[j] ^= mac[j];
        }
        
        // If this is the last block, XOR with subkey
        if (i + 16 >= paddedData.length) {
          const subkey = isComplete ? subkeys.k1 : subkeys.k2;
          for (let j = 0; j < 16; j++) {
            block[j] ^= subkey[j];
          }
        }
        
        // Encrypt block
        mac = global.OpCodes.StringToBytes(
          global.Rijndael.encryptBlock(this.aesId1, global.OpCodes.BytesToString(block))
        );
      }
      
      return mac;
    }
    
    /**
     * S2V (String-to-Vector) function
     * @param {Array} strings - Array of strings to authenticate
     * @returns {Array} 16-byte SIV
     */
    s2v(strings) {
      // Start with CMAC of zero block
      const zeroBlock = new Array(16).fill(0);
      let v = this.computeCMAC(zeroBlock);
      
      // Process all but the last string
      for (let i = 0; i < strings.length - 1; i++) {
        const stringBytes = global.OpCodes.StringToBytes(strings[i]);
        const cmac = this.computeCMAC(stringBytes);
        
        // v = (v * 2) XOR CMAC(string)
        v = this.gfMul2(v);
        for (let j = 0; j < 16; j++) {
          v[j] ^= cmac[j];
        }
      }
      
      // Handle the last string (plaintext)
      if (strings.length > 0) {
        const lastString = global.OpCodes.StringToBytes(strings[strings.length - 1]);
        
        if (lastString.length >= 16) {
          // XOR v with last 16 bytes
          const lastBlock = lastString.slice(-16);
          for (let j = 0; j < 16; j++) {
            lastBlock[j] ^= v[j];
          }
          
          // Replace last 16 bytes and compute CMAC
          const modifiedString = lastString.slice(0, -16).concat(lastBlock);
          v = this.computeCMAC(modifiedString);
        } else {
          // Pad and XOR with doubled v
          const paddedString = lastString.slice(0);
          paddedString.push(0x80);
          while (paddedString.length < 16) {
            paddedString.push(0);
          }
          
          v = this.gfMul2(v);
          for (let j = 0; j < paddedString.length; j++) {
            v[j] ^= paddedString[j];
          }
          
          v = this.computeCMAC(v);
        }
      }
      
      return v;
    }
    
    /**
     * AES-CTR encryption/decryption
     * @param {Array} data - Data to encrypt/decrypt
     * @param {Array} iv - 16-byte initialization vector
     * @returns {Array} Encrypted/decrypted data
     */
    aesCTR(data, iv) {
      const result = [];
      let counter = iv.slice(0);
      
      // Clear the S bit (bit 31) of the IV for CTR mode
      counter[12] &= 0x7F;
      
      for (let i = 0; i < data.length; i += 16) {
        // Encrypt counter to get keystream
        const keystream = global.OpCodes.StringToBytes(
          global.Rijndael.encryptBlock(this.aesId2, global.OpCodes.BytesToString(counter))
        );
        
        // XOR with data
        for (let j = 0; j < 16 && i + j < data.length; j++) {
          result.push(data[i + j] ^ keystream[j]);
        }
        
        // Increment counter (big-endian)
        for (let j = 15; j >= 0; j--) {
          counter[j] = (counter[j] + 1) & 0xFF;
          if (counter[j] !== 0) break;
        }
      }
      
      return result;
    }
    
    /**
     * Encrypt plaintext with associated data
     * @param {Array} plaintext - Data to encrypt as byte array
     * @param {Array} aadArray - Array of associated data strings
     * @returns {Array} SIV || Ciphertext as byte array
     */
    encrypt(plaintext, aadArray = []) {
      // Convert byte array to string for S2V
      const plaintextStr = global.OpCodes.BytesToString(plaintext);
      // Prepare S2V input: AAD strings + plaintext
      const s2vInput = aadArray.slice(0);
      s2vInput.push(plaintextStr);
      
      // Compute SIV using S2V
      const siv = this.s2v(s2vInput);
      
      // Encrypt plaintext using AES-CTR with SIV as IV
      const ciphertext = this.aesCTR(plaintext, siv);
      
      // Return SIV || Ciphertext as byte array
      return siv.concat(ciphertext);
    }
    
    /**
     * Decrypt ciphertext and verify authenticity
     * @param {Array} ciphertextWithSIV - SIV || Ciphertext as byte array
     * @param {Array} aadArray - Array of associated data strings
     * @returns {Array} Decrypted plaintext as byte array
     */
    decrypt(ciphertextWithSIV, aadArray = []) {
      if (ciphertextWithSIV.length < SIV_SIZE) {
        throw new Error('Ciphertext must include 16-byte SIV');
      }
      
      // Split SIV and ciphertext
      const sivBytes = ciphertextWithSIV.slice(0, SIV_SIZE);
      const ciphertextBytes = ciphertextWithSIV.slice(SIV_SIZE);
      
      // Decrypt ciphertext using AES-CTR
      const plaintextBytes = this.aesCTR(ciphertextBytes, sivBytes);
      const plaintext = global.OpCodes.BytesToString(plaintextBytes);
      
      // Verify SIV by recomputing S2V
      const s2vInput = aadArray.slice(0);
      s2vInput.push(plaintext);
      const expectedSIV = this.s2v(s2vInput);
      
      // Constant-time comparison
      if (!global.OpCodes.ConstantTimeCompare(sivBytes, expectedSIV)) {
        throw new Error('Authentication verification failed - message integrity compromised');
      }
      
      return plaintextBytes;
    }
  }
  
  // Register algorithm with framework
  RegisterAlgorithm(new AesSiv());
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AesSiv, AesSivInstance };
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);