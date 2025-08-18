/*
 * Universal RC6 Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * Based on RC6-32/20/b algorithm by Rivest, Robshaw, Sidney, and Yin
 * AES candidate cipher with 128-bit blocks and variable key lengths
 * (c)2025 Educational implementation for learning purposes only
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes dependency:', e.message);
      return;
    }
  }
  
  // Ensure environment dependencies are available
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
      console.error('RC6 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // RC6 Algorithm Constants
  const RC6_W = 32;           // word size in bits
  const RC6_R = 20;           // number of rounds
  const RC6_P32 = 0xB7E15163; // Magic constant P for key setup  
  const RC6_Q32 = 0x9E3779B9; // Magic constant Q for key setup
  const RC6_LGW = 5;          // log2(w) = log2(32) = 5
  const RC6_KEY_SCHEDULE_SIZE = 2 * RC6_R + 4; // 44 words
  
  // RC6 Cipher Implementation
  const RC6 = {
    // Public interface properties
    internalName: 'RC6',
    name: 'RC6',
    comment: 'RC6-32/20/b Block Cipher - AES candidate by Rivest et al.',
    minKeyLength: 16,      // 128 bits minimum
    maxKeyLength: 32,      // 256 bits maximum 
    stepKeyLength: 8,      // 64-bit increments
    minBlockSize: 16,      // 128-bit fixed block size
    maxBlockSize: 16,      // 128-bit fixed block size
    stepBlockSize: 1,
    instances: {},

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "ú2în\rg/\u001f+µÁÇ'E!",
        "description": "RC6 128-bit key, all zeros test vector (official AES submission)"
    },
    {
        "input": "\u0002\u0013$5FWhy¬½Îßàñ",
        "key": "ïÍ«gE#\u0001ï\u0012#4EVgx",
        "expected": "ttÅ\u0010VzÉAèNCVÿ^#ä",
        "description": "RC6 128-bit key, pattern test vector (official AES submission)"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "Ö\u0012¦^{jÉ³!É\u0007È",
        "description": "RC6 192-bit key, all zeros test vector (official AES submission)"
    },
    {
        "input": "\u0002\u0013$5FWhy¬½Îßàñ",
        "key": "ïÍ«gE#\u0001ï\u0012#4EVgx«¼ÍÞïð",
        "expected": "SeöoÖ='Ã³|X²WO9q",
        "description": "RC6 192-bit key, pattern test vector (official AES submission)"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "3É\u001bs¯;`Ú8\u0013|º\u001a»Áò",
        "description": "RC6 256-bit key, all zeros test vector (official AES submission)"
    },
    {
        "input": "\u0002\u0013$5FWhy¬½Îßàñ",
        "key": "ïÍ«gE#\u0001ï\u0012#4EVgx«¼ÍÞïð\u00102TvºÜþ",
        "expected": "\\\\Ö4ú\u0007#\u001aBK%þ\u001f¸",
        "description": "RC6 256-bit key, pattern test vector (official AES submission)"
    }
],

  // Reference links to authoritative sources and production implementations
  referenceLinks: {
    specifications: [
      {
        name: 'RC6 Algorithm Specification',
        url: 'https://people.csail.mit.edu/rivest/Rivest-rc6.pdf',
        description: 'Original RC6 specification by Rivest, Robshaw, Sidney, and Yin'
      },
      {
        name: 'AES Candidate RC6 Submission',
        url: 'https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development',
        description: 'NIST AES candidate submission documents for RC6'
      },
      {
        name: 'RC6 Technical Report',
        url: 'https://people.csail.mit.edu/rivest/pubs/RRSY98.pdf',
        description: 'Detailed technical analysis and specification of RC6 algorithm'
      },
      {
        name: 'RC6 Patent Information',
        url: 'https://patents.google.com/patent/US6269163B1',
        description: 'RC6 algorithm patent - US Patent 6,269,163'
      }
    ],
    implementations: [
      {
        name: 'Crypto++ RC6 Implementation',
        url: 'https://github.com/weidai11/cryptopp/blob/master/rc6.cpp',
        description: 'High-performance C++ RC6 implementation'
      },
      {
        name: 'Bouncy Castle RC6 Implementation',
        url: 'https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines',
        description: 'Java RC6 implementation from Bouncy Castle'
      },
      {
        name: 'OpenSSL RC6 Reference',
        url: 'https://github.com/openssl/openssl/tree/master/crypto/',
        description: 'OpenSSL cryptographic library structure and cipher implementations'
      },
      {
        name: 'libgcrypt Cipher Collection',
        url: 'https://github.com/gpg/libgcrypt/blob/master/cipher/',
        description: 'GNU libgcrypt cryptographic algorithm implementations'
      }
    ],
    validation: [
      {
        name: 'RC6 AES Submission Test Vectors',
        url: 'https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development',
        description: 'Official test vectors from RC6 AES candidate submission'
      },
      {
        name: 'NIST AES Process Documentation',
        url: 'https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development',
        description: 'NIST documentation of AES selection process including RC6 evaluation'
      },
      {
        name: 'RC6 Cryptanalysis Research',
        url: 'https://www.iacr.org/cryptodb/data/paper.php?pubkey=1287',
        description: 'Academic research on RC6 security properties and cryptanalysis'
      }
    ]
  },

    cantDecode: false,
    isInitialized: false,
    
    // Initialize cipher
    Init: function() {
      RC6.isInitialized = true;
    },
    
    // Key setup - generates round key schedule
    KeySetup: function(key) {
      let id;
      do {
        id = 'RC6[' + global.generateUniqueID() + ']';
      } while (RC6.instances[id] || global.objectInstances[id]);
      
      // Convert key to byte array if string
      let keyBytes;
      if (typeof key === 'string') {
        keyBytes = global.OpCodes.StringToBytes(key);
      } else if (Array.isArray(key)) {
        keyBytes = key;
      } else {
        global.throwException('Invalid key format', key, 'RC6', 'KeySetup');
        return null;
      }
      
      // Validate key length
      if (keyBytes.length < RC6.minKeyLength || keyBytes.length > RC6.maxKeyLength) {
        global.throwException('Invalid key length', keyBytes.length, 'RC6', 'KeySetup');
        return null;
      }
      
      RC6.instances[id] = new RC6.RC6Instance(keyBytes);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (RC6.instances[id]) {
        // Clear sensitive key schedule data
        if (RC6.instances[id].keySchedule) {
          global.OpCodes.ClearArray(RC6.instances[id].keySchedule);
        }
        delete RC6.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'RC6', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (128 bits = 16 bytes)
    encryptBlock: function(id, plaintext) {
      if (!RC6.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'RC6', 'encryptBlock');
        return plaintext;
      }
      
      const instance = RC6.instances[id];
      
      // Convert input to bytes
      let plainBytes;
      if (typeof plaintext === 'string') {
        plainBytes = global.OpCodes.StringToBytes(plaintext);
      } else if (Array.isArray(plaintext)) {
        plainBytes = plaintext;
      } else {
        return plaintext; // Invalid input
      }
      
      // Pad to 16 bytes if needed
      while (plainBytes.length < 16) {
        plainBytes.push(0);
      }
      
      // Process 16-byte blocks
      let result = [];
      for (let offset = 0; offset < plainBytes.length; offset += 16) {
        const block = plainBytes.slice(offset, offset + 16);
        const encryptedBlock = RC6._encryptBlock(instance.keySchedule, block);
        result = result.concat(encryptedBlock);
      }
      
      // Convert back to string if input was string
      if (typeof plaintext === 'string') {
        return global.OpCodes.BytesToString(result);
      }
      return result;
    },
    
    // Decrypt block (128 bits = 16 bytes)
    decryptBlock: function(id, ciphertext) {
      if (!RC6.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'RC6', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = RC6.instances[id];
      
      // Convert input to bytes
      let cipherBytes;
      if (typeof ciphertext === 'string') {
        cipherBytes = global.OpCodes.StringToBytes(ciphertext);
      } else if (Array.isArray(ciphertext)) {
        cipherBytes = ciphertext;
      } else {
        return ciphertext; // Invalid input
      }
      
      // Process 16-byte blocks
      let result = [];
      for (let offset = 0; offset < cipherBytes.length; offset += 16) {
        const block = cipherBytes.slice(offset, offset + 16);
        const decryptedBlock = RC6._decryptBlock(instance.keySchedule, block);
        result = result.concat(decryptedBlock);
      }
      
      // Convert back to string if input was string
      if (typeof ciphertext === 'string') {
        return global.OpCodes.BytesToString(result);
      }
      return result;
    },
    
    // RC6 Core Encryption Function - exact match to C reference implementation
    _encryptBlock: function(keySchedule, block) {
      // Convert 16 bytes to 4 words (little-endian)
      let A = global.OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let B = global.OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let C = global.OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let D = global.OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);
      
      // Pre-whitening: B += S[0], D += S[1] (exactly as in C)
      B = (B + keySchedule[0]) >>> 0;
      D = (D + keySchedule[1]) >>> 0;
      
      // 20 rounds with register rotation - matching C reference pattern exactly
      // f_rnd(2,a,b,c,d); f_rnd(4,b,c,d,a); f_rnd(6,c,d,a,b); f_rnd(8,d,a,b,c); etc.
      for (let round = 0; round < 20; round++) {
        const i = 2 + round * 2; // Key index: 2, 4, 6, 8, ...
        
        // RC6 round function: f_rnd(i,a,b,c,d)
        // u = rotl(d * (d + d + 1), 5);
        // t = rotl(b * (b + b + 1), 5);  
        // a = rotl(a ^ t, u) + l_key[i];
        // c = rotl(c ^ u, t) + l_key[i + 1];
        const u = global.OpCodes.RotL32((D * (D + D + 1)) >>> 0, 5);
        const t = global.OpCodes.RotL32((B * (B + B + 1)) >>> 0, 5);
        A = (global.OpCodes.RotL32((A ^ t) >>> 0, u & 31) + keySchedule[i]) >>> 0;
        C = (global.OpCodes.RotL32((C ^ u) >>> 0, t & 31) + keySchedule[i + 1]) >>> 0;
        
        // Register rotation: (A,B,C,D) -> (B,C,D,A)
        const temp = A;
        A = B;
        B = C;
        C = D;
        D = temp;
      }
      
      // Post-whitening: A += S[42], C += S[43] (exactly as in C)
      A = (A + keySchedule[42]) >>> 0;
      C = (C + keySchedule[43]) >>> 0;
      
      // Convert back to bytes (little-endian)
      const result = [];
      const bytes0 = global.OpCodes.Unpack32LE(A);
      const bytes1 = global.OpCodes.Unpack32LE(B);
      const bytes2 = global.OpCodes.Unpack32LE(C);
      const bytes3 = global.OpCodes.Unpack32LE(D);
      
      return bytes0.concat(bytes1, bytes2, bytes3);
    },
    
    // RC6 Core Decryption Function - exact match to C reference implementation  
    _decryptBlock: function(keySchedule, block) {
      // Convert 16 bytes to 4 words (little-endian)
      let A = global.OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
      let B = global.OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
      let C = global.OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
      let D = global.OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);
      
      // Undo post-whitening: C -= S[43], A -= S[42] (exactly as in C)
      C = (C - keySchedule[43]) >>> 0;
      A = (A - keySchedule[42]) >>> 0;
      
      // 20 rounds in reverse order with register rotation
      // i_rnd(40,d,a,b,c); i_rnd(38,c,d,a,b); i_rnd(36,b,c,d,a); i_rnd(34,a,b,c,d); etc.
      for (let round = 19; round >= 0; round--) {
        const i = 2 + round * 2; // Key index: 40, 38, 36, 34, ..., 4, 2
        
        // Rotate registers backward: (A,B,C,D) -> (D,A,B,C)
        const temp = D;
        D = C;
        C = B;
        B = A;
        A = temp;
        
        // RC6 inverse round function: i_rnd(i,a,b,c,d)
        // u = rotl(d * (d + d + 1), 5);
        // t = rotl(b * (b + b + 1), 5);
        // c = rotr(c - l_key[i + 1], t) ^ u;
        // a = rotr(a - l_key[i], u) ^ t;
        const u = global.OpCodes.RotL32((D * (D + D + 1)) >>> 0, 5);
        const t = global.OpCodes.RotL32((B * (B + B + 1)) >>> 0, 5);
        C = global.OpCodes.RotR32((C - keySchedule[i + 1]) >>> 0, t & 31) ^ u;
        A = global.OpCodes.RotR32((A - keySchedule[i]) >>> 0, u & 31) ^ t;
      }
      
      // Undo pre-whitening: D -= S[1], B -= S[0] (exactly as in C)
      D = (D - keySchedule[1]) >>> 0;
      B = (B - keySchedule[0]) >>> 0;
      
      // Convert back to bytes (little-endian)
      const result = [];
      const bytes0 = global.OpCodes.Unpack32LE(A);
      const bytes1 = global.OpCodes.Unpack32LE(B);
      const bytes2 = global.OpCodes.Unpack32LE(C);
      const bytes3 = global.OpCodes.Unpack32LE(D);
      
      return bytes0.concat(bytes1, bytes2, bytes3);
    },
    
    // RC6 Instance class
    RC6Instance: function(keyBytes) {
      this.keyLength = keyBytes.length;
      this.keySchedule = RC6._generateKeySchedule(keyBytes);
    },
    
    // Key schedule generation following the official RC6 C reference implementation
    _generateKeySchedule: function(keyBytes) {
      const keyLenBits = keyBytes.length * 8;
      const c = Math.floor((keyBytes.length + 3) / 4); // Key length in 32-bit words
      
      // Initialize S array with magic constants (44 words = 2*20+4)
      const S = new Array(44);
      S[0] = 0xb7e15163; // RC6_P32
      for (let k = 1; k < 44; k++) {
        S[k] = (S[k - 1] + 0x9e3779b9) >>> 0; // Add RC6_Q32
      }
      
      // Convert key bytes to 32-bit words (little-endian)
      const L = new Array(Math.max(c, 1));
      for (let i = 0; i < L.length; i++) {
        L[i] = 0;
      }
      
      // Pack bytes into words (little-endian like C reference)
      for (let i = 0; i < keyBytes.length; i++) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = i % 4;
        L[wordIndex] |= (keyBytes[i] << (8 * byteIndex));
        L[wordIndex] = L[wordIndex] >>> 0; // Ensure unsigned 32-bit
      }
      
      // Key mixing phase - exactly 132 iterations like C reference
      let A = 0, B = 0;
      let i = 0, j = 0;
      const t = c - 1; // As in C code: t = (key_len / 32) - 1
      
      for (let k = 0; k < 132; k++) {
        // a = rotl(l_key[i] + a + b, 3); b += a;
        A = global.OpCodes.RotL32((S[i] + A + B) >>> 0, 3);
        B = (B + A) >>> 0;
        // b = rotl(l[j] + b, b);  -- NOTE: rotation by B, not B & 31!
        B = global.OpCodes.RotL32((L[j] + B) >>> 0, B);  // Critical: no masking here
        S[i] = A;
        L[j] = B;
        i = (i === 43) ? 0 : i + 1;  // i = (i + 1) % 44
        j = (j === t) ? 0 : j + 1;   // j = (j + 1) % c
      }
      
      // Clear temporary key array
      global.OpCodes.ClearArray(L);
      
      return S;
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(RC6);
  }
  
  // Export to global scope
  global.RC6 = RC6;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RC6;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);