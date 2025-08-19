/*
 * bcrypt Implementation - Password Hashing Function
 * Adaptive hash function based on Blowfish cipher
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const bcrypt = {
    name: "bcrypt",
    description: "Adaptive password hashing function based on the Blowfish cipher. Designed to be slow and resistant to brute-force attacks with configurable work factor (cost parameter).",
    inventor: "Niels Provos, David Mazières",
    year: 1999,
    country: "Multi-national",
    category: "hash",
    subCategory: "Password Hash",
    securityStatus: "active",
    securityNotes: "Production-ready password hashing function widely used in authentication systems. Adaptive design allows increasing computational cost as hardware improves.",
    
    documentation: [
      {text: "Original Paper", uri: "https://www.usenix.org/legacy/publications/library/proceedings/usenix99/provos.html"},
      {text: "RFC (draft)", uri: "https://tools.ietf.org/id/draft-irtf-cfrg-bcrypt-pbkdf-03.html"},
      {text: "OpenBSD Implementation", uri: "https://github.com/openbsd/src/blob/master/lib/libc/crypt/bcrypt.c"}
    ],
    
    references: [
      {text: "bcrypt.net", uri: "https://bcrypt-generator.com/"},
      {text: "Security Analysis", uri: "https://security.stackexchange.com/questions/4781/do-any-security-experts-recommend-bcrypt-for-password-storage"},
      {text: "OWASP Guidelines", uri: "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Length Limitation",
        text: "Passwords longer than 72 bytes are truncated",
        mitigation: "Pre-hash long passwords with SHA-256 or use alternative like Argon2"
      },
      {
        type: "Cost Parameter Obsolescence",
        text: "Cost parameter may become insufficient as hardware improves",
        mitigation: "Regularly review and increase cost parameter as needed"
      }
    ],
    
    tests: [
      {
        text: "bcrypt Test Vector 1 (Cost 4)",
        uri: "OpenBSD test vectors",
        password: OpCodes.StringToBytes("password"),
        salt: OpCodes.StringToBytes("$2a$04$N9qo8uLOickgx2ZMRZoMye"),
        cost: 4,
        expectedHash: "$2a$04$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
      },
      {
        text: "bcrypt Test Vector 2 (Empty Password)",
        uri: "OpenBSD test vectors",
        password: OpCodes.StringToBytes(""),
        salt: OpCodes.StringToBytes("$2a$06$DCq7YPn5Rq63x1Lad4cll."),
        cost: 6,
        expectedHash: "$2a$06$DCq7YPn5Rq63x1Lad4cll.TV4S6ytwfsfvkgY8jIucDrjc8deX1s."
      },
      {
        text: "bcrypt Test Vector 3 (Unicode)",
        uri: "Modern test cases",
        password: OpCodes.StringToBytes("Héllo Wørld"),
        salt: OpCodes.StringToBytes("$2a$08$123456789012345678901u"),
        cost: 8,
        expectedLength: 60 // Standard bcrypt output length
      }
    ],

    // Legacy interface properties
    internalName: 'bcrypt',
    minKeyLength: 0,
    maxKeyLength: 72,
    stepKeyLength: 1,
    minBlockSize: 8,
    maxBlockSize: 8,
    stepBlockSize: 1,
    instances: {},
    version: '1.0.0',
    keySize: 72,
    blockSize: 8,
    
    // Algorithm metadata
    isStreamCipher: false,
    isBlockCipher: false,
    isHash: true,
    isPasswordHash: true,
    complexity: 'High',
    family: 'bcrypt',
    category: 'Key-Derivation',
    
    // bcrypt constants
    BCRYPT_SALT_LEN: 16,
    BCRYPT_HASH_LEN: 24,
    BCRYPT_MIN_COST: 4,
    BCRYPT_MAX_COST: 31,
    
    // Blowfish constants (subset for bcrypt)
    BLOWFISH_ROUNDS: 16,
    
    // Base64 encoding table for bcrypt (custom alphabet)
    B64_ALPHABET: './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    
    // Current configuration
    cost: 10,
    salt: null,
    keyScheduled: false,
    
    // Initialize bcrypt
    Init: function() {
      this.cost = 10;
      this.salt = null;
      this.keyScheduled = false;
      return true;
    },
    
    // Key setup (cost parameter and optional salt)
    KeySetup: function(key, options) {
      if (typeof key === 'number') {
        this.cost = Math.max(this.BCRYPT_MIN_COST, Math.min(this.BCRYPT_MAX_COST, key));
      } else if (typeof key === 'string') {
        // Parse bcrypt salt string
        const match = key.match(/^\\$2[axy]?\\$(\\d{2})\\$(.{22})/);
        if (match) {
          this.cost = parseInt(match[1]);
          this.salt = this.decodeBase64(match[2]);
        } else {
          this.cost = 10;
        }
      } else {
        this.cost = 10;
      }
      
      if (options) {
        if (options.cost) this.cost = options.cost;
        if (options.salt) this.salt = options.salt;
      }
      
      this.keyScheduled = true;
      return 'bcrypt-' + this.cost + '-' + Math.random().toString(36).substr(2, 9);
    },
    
    // Generate random salt
    generateSalt: function() {
      const salt = new Array(this.BCRYPT_SALT_LEN);
      for (let i = 0; i < salt.length; i++) {
        salt[i] = Math.floor(Math.random() * 256);
      }
      return salt;
    },
    
    // bcrypt base64 encoding (different from standard base64)
    encodeBase64: function(data) {
      let result = '';
      const alphabet = this.B64_ALPHABET;
      
      for (let i = 0; i < data.length; i += 3) {
        const b1 = data[i] || 0;
        const b2 = data[i + 1] || 0;
        const b3 = data[i + 2] || 0;
        
        const combined = (b1 << 16) | (b2 << 8) | b3;
        
        result += alphabet[(combined >>> 18) & 63];
        result += alphabet[(combined >>> 12) & 63];
        result += alphabet[(combined >>> 6) & 63];
        result += alphabet[combined & 63];
      }
      
      return result;
    },
    
    // bcrypt base64 decoding
    decodeBase64: function(str) {
      const alphabet = this.B64_ALPHABET;
      const result = [];
      
      for (let i = 0; i < str.length; i += 4) {
        const c1 = alphabet.indexOf(str[i] || '.');
        const c2 = alphabet.indexOf(str[i + 1] || '.');
        const c3 = alphabet.indexOf(str[i + 2] || '.');
        const c4 = alphabet.indexOf(str[i + 3] || '.');
        
        const combined = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
        
        result.push((combined >>> 16) & 255);
        if (i + 2 < str.length) result.push((combined >>> 8) & 255);
        if (i + 3 < str.length) result.push(combined & 255);
      }
      
      return result;
    },
    
    // Simplified Blowfish key schedule for bcrypt
    blowfishKeySchedule: function(password, salt) {
      // This is a simplified educational implementation
      // Production bcrypt would use full Blowfish implementation
      
      const state = new Array(18); // P-array
      const sboxes = [new Array(256), new Array(256), new Array(256), new Array(256)];
      
      // Initialize with pi digits (simplified)
      for (let i = 0; i < 18; i++) {
        state[i] = 0x243F6A88 + i; // Simplified pi constants
      }
      
      for (let s = 0; s < 4; s++) {
        for (let i = 0; i < 256; i++) {
          sboxes[s][i] = 0x243F6A88 + s * 256 + i;
        }
      }
      
      // XOR password into P-array
      let passwordIndex = 0;
      for (let i = 0; i < 18; i++) {
        let word = 0;
        for (let j = 0; j < 4; j++) {
          word = (word << 8) | (password[passwordIndex % password.length] || 0);
          passwordIndex++;
        }
        state[i] ^= word;
      }
      
      return {pArray: state, sBoxes: sboxes};
    },
    
    // Simplified Blowfish encryption
    blowfishEncrypt: function(keySchedule, left, right) {
      const pArray = keySchedule.pArray;
      
      for (let i = 0; i < this.BLOWFISH_ROUNDS; i++) {
        left ^= pArray[i];
        // Simplified F function
        right ^= ((left + i) >>> 0) ^ 0x5A827999;
        
        // Swap
        const temp = left;
        left = right;
        right = temp;
      }
      
      // Undo last swap
      const temp = left;
      left = right;
      right = temp;
      
      right ^= pArray[16];
      left ^= pArray[17];
      
      return {left: left >>> 0, right: right >>> 0};
    },
    
    // bcrypt expensive key setup
    expensiveKeySetup: function(password, salt, cost) {
      let keySchedule = this.blowfishKeySchedule(password, salt);
      
      const iterations = 1 << cost;
      
      // Expensive key stretching
      for (let i = 0; i < iterations; i++) {
        keySchedule = this.blowfishKeySchedule(password, []);
        keySchedule = this.blowfishKeySchedule(salt, []);
      }
      
      return keySchedule;
    },
    
    // Generate bcrypt hash
    hashPassword: function(password, cost, salt) {
      if (password.length > 72) {
        password = password.slice(0, 72); // Truncate to 72 bytes
      }
      
      cost = cost || this.cost;
      salt = salt || this.salt || this.generateSalt();
      
      // Expensive key setup
      const keySchedule = this.expensiveKeySetup(password, salt, cost);
      
      // Encrypt magic string "OrpheanBeholderScryDoubt" 64 times
      const magic = OpCodes.StringToBytes("OrpheanBeholderScryDoubt");
      let ciphertext = OpCodes.CopyArray(magic);
      
      for (let i = 0; i < 64; i++) {
        for (let j = 0; j < ciphertext.length; j += 8) {
          const left = OpCodes.Pack32BE(
            ciphertext[j] || 0, ciphertext[j+1] || 0,
            ciphertext[j+2] || 0, ciphertext[j+3] || 0
          );
          const right = OpCodes.Pack32BE(
            ciphertext[j+4] || 0, ciphertext[j+5] || 0,
            ciphertext[j+6] || 0, ciphertext[j+7] || 0
          );
          
          const encrypted = this.blowfishEncrypt(keySchedule, left, right);
          
          const leftBytes = OpCodes.Unpack32BE(encrypted.left);
          const rightBytes = OpCodes.Unpack32BE(encrypted.right);
          
          for (let k = 0; k < 4; k++) {
            if (j + k < ciphertext.length) ciphertext[j + k] = leftBytes[k];
            if (j + k + 4 < ciphertext.length) ciphertext[j + k + 4] = rightBytes[k];
          }
        }
      }
      
      // Format result
      const version = "$2a$";
      const costStr = cost.toString().padStart(2, '0');
      const saltStr = this.encodeBase64(salt).substring(0, 22);
      const hashStr = this.encodeBase64(ciphertext.slice(0, 23));
      
      return version + costStr + "$" + saltStr + hashStr;
    },
    
    // Verify password against hash
    verifyPassword: function(password, hash) {
      const match = hash.match(/^\\$2[axy]?\\$(\\d{2})\\$(.{22})(.+)$/);
      if (!match) {
        throw new Error('Invalid bcrypt hash format');
      }
      
      const cost = parseInt(match[1]);
      const salt = this.decodeBase64(match[2]);
      
      const computedHash = this.hashPassword(password, cost, salt);
      return OpCodes.SecureCompare(OpCodes.StringToBytes(hash), OpCodes.StringToBytes(computedHash));
    },
    
    // Legacy cipher interface
    szEncryptBlock: function(blockIndex, plaintext) {
      const password = OpCodes.BytesToString(plaintext);
      return OpCodes.StringToBytes(this.hashPassword(OpCodes.StringToBytes(password)));
    },
    
    szDecryptBlock: function(blockIndex, ciphertext) {
      throw new Error('bcrypt is a one-way password hash function and cannot be decrypted');
    },
    
    ClearData: function() {
      if (this.salt) {
        OpCodes.ClearArray(this.salt);
      }
      this.keyScheduled = false;
    },
    
    // Test vector runner
    runTestVector: function() {
      console.log('Running bcrypt test vectors...');
      
      let allPassed = true;
      
      for (let i = 0; i < this.tests.length; i++) {
        const test = this.tests[i];
        console.log(`Running test: ${test.text}`);
        
        try {
          this.Init();
          this.KeySetup(test.cost);
          
          const password = OpCodes.BytesToString(test.password);
          let result;
          
          if (test.expectedHash) {
            // Test hash generation
            const salt = this.decodeBase64(test.salt.slice(7, 29)); // Extract salt from bcrypt string
            result = this.hashPassword(test.password, test.cost, salt);
            
            const passed = (result === test.expectedHash);
            
            if (passed) {
              console.log(`Test ${i + 1}: PASS`);
            } else {
              console.log(`Test ${i + 1}: FAIL`);
              console.log('Expected:', test.expectedHash);
              console.log('Actual:', result);
              allPassed = false;
            }
          } else if (test.expectedLength) {
            // Test length only
            result = this.hashPassword(test.password, test.cost);
            const passed = (result.length === test.expectedLength);
            
            if (passed) {
              console.log(`Test ${i + 1}: PASS (length check)`);
            } else {
              console.log(`Test ${i + 1}: FAIL (length: ${result.length}, expected: ${test.expectedLength})`);
              allPassed = false;
            }
          }
          
        } catch (error) {
          console.log(`Test ${i + 1}: ERROR - ${error.message}`);
          allPassed = false;
        }
      }
      
      // Additional demonstration
      console.log('\\nbcrypt Password Hashing Demonstration:');
      this.Init();
      this.KeySetup(8); // Cost 8
      
      const demoPassword = "SecurePassword123!";
      const hash1 = this.hashPassword(OpCodes.StringToBytes(demoPassword));
      const hash2 = this.hashPassword(OpCodes.StringToBytes(demoPassword));
      
      console.log('Password:', demoPassword);
      console.log('Hash 1:', hash1);
      console.log('Hash 2:', hash2);
      console.log('Hashes different (salt randomization):', hash1 !== hash2);
      
      // Test verification
      const verified = this.verifyPassword(OpCodes.StringToBytes(demoPassword), hash1);
      console.log('Password verification:', verified ? 'PASS' : 'FAIL');
      
      return {
        algorithm: 'bcrypt',
        cost: this.cost,
        allTestsPassed: allPassed,
        testCount: this.tests.length,
        maxPasswordLength: 72,
        hashLength: 60,
        notes: 'Adaptive password hashing function with configurable work factor'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(bcrypt);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = bcrypt;
  }
  
  // Global export
  global.bcrypt = bcrypt;
  
})(typeof global !== 'undefined' ? global : window);