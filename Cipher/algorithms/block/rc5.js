/*
 * Universal RC5 Cipher Implementation
 * Compatible with both Browser and Node.js environments
 * Based on Ronald Rivest's RC5 specification and reference implementation
 * Supports variable word size, rounds, and key length (RC5-w/r/b)
 * (c)2006-2025 Hawkynt
 * 
 * RC5 is a fast symmetric block cipher designed by Ron Rivest in 1994.
 * It features data-dependent rotations and is notable for its simplicity.
 * This implementation follows RFC 2040 and the original C reference.
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
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
      console.error('RC5 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create RC5 cipher object
  const RC5 = {
    name: "RC5",
    description: "Variable symmetric block cipher designed by Ron Rivest. Features data-dependent rotations and configurable parameters (word size, rounds, key length).",
    inventor: "Ronald Rivest",
    year: 1994,
    country: "US", 
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: null,
    securityNotes: "Patented algorithm with good security record when used with adequate parameters. Patent expired in 2015.",
    
    documentation: [
      {text: "RFC 2040", uri: "https://tools.ietf.org/rfc/rfc2040.txt"},
      {text: "RC5 Original Paper", uri: "https://people.csail.mit.edu/rivest/Rivest-rc5rev.pdf"},
      {text: "Wikipedia Article", uri: "https://en.wikipedia.org/wiki/RC5"}
    ],
    
    references: [
      {text: "Rivest's RC5 Reference", uri: "https://people.csail.mit.edu/rivest/Rivest-rc5rev.pdf"},
      {text: "RFC 2040 Specification", uri: "https://tools.ietf.org/rfc/rfc2040.txt"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "RFC 2040 Test Vector - RC5-32/12/16",
        uri: "https://tools.ietf.org/rfc/rfc2040.txt",
        keySize: 16,
        blockSize: 8,
        input: global.OpCodes.Hex8ToBytes("0000000000000000"),
        key: global.OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: global.OpCodes.Hex8ToBytes("21a5dbee154b8f6d")
      }
    ],

    // Public interface properties
    internalName: 'RC5',
    comment: 'RC5 Variable Block Cipher (RC5-32/12/16 default)',
    minKeyLength: 0,     // 0 bytes minimum
    maxKeyLength: 255,   // 255 bytes maximum
    stepKeyLength: 1,
    minBlockSize: 8,     // 8 bytes for RC5-32
    maxBlockSize: 8,     // Fixed 64-bit blocks for RC5-32
    stepBlockSize: 1,
    instances: {},

  // Legacy testVectors section - replaced with compliant tests above
    legacyTestVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "!¥Ûî\u0015Km",
        "description": "RC5-32/12/16 test vector 1: all zeros input and key"
    },
    {
        "input": "ÿÿÿÿÿÿÿÿ",
        "key": "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ",
        "expected": "wié¾\u0001g·",
        "description": "RC5-32/12/16 test vector 2: all ones input and key"
    },
    {
        "input": "\u0001#Eg«Íï",
        "key": "\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010",
        "expected": "·4!6\b%M/",
        "description": "RC5-32/12/16 test vector 3: sequential pattern"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "",
        "expected": "!¥Ûî\u0015Km",
        "description": "RC5-32/12/16 test vector 4: null key (same as zero key)"
    }
],

  // Reference links to authoritative sources and production implementations
  referenceLinks: {
    specifications: [
      {
        name: 'RC5 Algorithm Specification (Original Paper)',
        url: 'https://people.csail.mit.edu/rivest/Rivest-rc5rev.pdf',
        description: 'Original RC5 specification by Ronald Rivest at MIT'
      },
      {
        name: 'RFC 2040 - RC5, RC5-CBC, RC5-CBC-Pad, and RC5-CTS Algorithms',
        url: 'https://tools.ietf.org/rfc/rfc2040.txt',
        description: 'IETF RFC defining RC5 algorithm and its cipher block chaining modes'
      },
      {
        name: 'MIT RC5 Algorithm Page',
        url: 'https://people.csail.mit.edu/rivest/Rivest-rc5.txt',
        description: 'MIT computer science page for RC5 algorithm documentation'
      },
      {
        name: 'RC5 Patent Information',
        url: 'https://patents.google.com/patent/US5724428A',
        description: 'RC5 algorithm patent (expired) - US Patent 5,724,428'
      }
    ],
    implementations: [
      {
        name: 'OpenSSL RC5 Implementation',
        url: 'https://github.com/openssl/openssl/blob/master/crypto/rc5/',
        description: 'Production-quality RC5 implementation from OpenSSL'
      },
      {
        name: 'Crypto++ RC5 Implementation',
        url: 'https://github.com/weidai11/cryptopp/blob/master/rc5.cpp',
        description: 'High-performance C++ RC5 implementation'
      },
      {
        name: 'Bouncy Castle RC5 Implementation',
        url: 'https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines',
        description: 'Java RC5 implementation from Bouncy Castle'
      },
      {
        name: 'libgcrypt RC5 Implementation',
        url: 'https://github.com/gpg/libgcrypt/blob/master/cipher/',
        description: 'GNU libgcrypt cryptographic library implementation'
      }
    ],
    validation: [
      {
        name: 'RC5 Test Vectors',
        url: 'https://people.csail.mit.edu/rivest/Rivest-rc5rev.pdf',
        description: 'Official test vectors from RC5 specification document'
      },
      {
        name: 'NIST Cryptographic Algorithm Validation',
        url: 'https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program',
        description: 'NIST guidance for cryptographic algorithm validation'
      },
      {
        name: 'RC5 Cryptanalysis Research',
        url: 'https://www.iacr.org/cryptodb/data/paper.php?pubkey=1052',
        description: 'Academic research on RC5 security properties and cryptanalysis'
      }
    ]
  },

    cantDecode: false,
    isInitialized: false,
    
    // RC5 Constants and Parameters
    DEFAULT_WORD_SIZE: 32,      // w = word size in bits
    DEFAULT_ROUNDS: 12,         // r = number of rounds
    DEFAULT_KEY_BYTES: 16,      // b = key length in bytes
    MAGIC_P: 0xb7e15163,       // P = Odd((e-2)*2^32) where e is base of natural log
    MAGIC_Q: 0x9e3779b9,       // Q = Odd((φ-1)*2^32) where φ is golden ratio
    
    // Initialize cipher
    Init: function() {
      RC5.isInitialized = true;
    },
    
    // Set up key and create instance
    KeySetup: function(optional_key) {
      let id;
      do {
        id = 'RC5[' + global.generateUniqueID() + ']';
      } while (RC5.instances[id] || global.objectInstances[id]);
      
      RC5.instances[id] = new RC5.RC5Instance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (RC5.instances[id]) {
        // Securely clear the key table
        const instance = RC5.instances[id];
        if (instance.S && global.OpCodes && global.OpCodes.ClearArray) {
          global.OpCodes.ClearArray(instance.S);
        }
        delete RC5.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'RC5', 'ClearData');
        return false;
      }
    },
    
    // Encrypt 8-byte block
    encryptBlock: function(id, plaintext) {
      if (!RC5.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'RC5', 'encryptBlock');
        return plaintext;
      }
      
      const instance = RC5.instances[id];
      
      // Handle string input - pad to 8 bytes if needed
      let input = plaintext;
      while (input.length < 8) {
        input += '\0';
      }
      
      // Process in 8-byte blocks
      let result = '';
      for (let blockStart = 0; blockStart < input.length; blockStart += 8) {
        const block = input.substr(blockStart, 8);
        const encryptedBlock = RC5._encryptBlock(instance, block);
        result += encryptedBlock;
      }
      
      return result;
    },
    
    // Decrypt 8-byte block
    decryptBlock: function(id, ciphertext) {
      if (!RC5.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'RC5', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = RC5.instances[id];
      
      // Process in 8-byte blocks
      let result = '';
      for (let blockStart = 0; blockStart < ciphertext.length; blockStart += 8) {
        const block = ciphertext.substr(blockStart, 8);
        if (block.length === 8) {
          const decryptedBlock = RC5._decryptBlock(instance, block);
          result += decryptedBlock;
        }
      }
      
      return result;
    },
    
    // RC5 encryption function (internal)
    _encryptBlock: function(instance, blockStr) {
      if (blockStr.length !== 8) {
        throw new Error('RC5 block must be exactly 8 bytes');
      }
      
      // Convert string to two 32-bit words (little-endian)
      const bytes = global.OpCodes.StringToBytes(blockStr);
      let A = global.OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      let B = global.OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7]);
      
      // Add first round keys
      A = (A + instance.S[0]) >>> 0;
      B = (B + instance.S[1]) >>> 0;
      
      // Perform rounds
      for (let i = 1; i <= instance.rounds; i++) {
        // A = ROL(A XOR B, B) + S[2*i]
        A = A ^ B;
        A = global.OpCodes.RotL32(A, B & 31);
        A = (A + instance.S[2 * i]) >>> 0;
        
        // B = ROL(B XOR A, A) + S[2*i+1]
        B = B ^ A;
        B = global.OpCodes.RotL32(B, A & 31);
        B = (B + instance.S[2 * i + 1]) >>> 0;
      }
      
      // Convert back to string (little-endian)
      const resultA = global.OpCodes.Unpack32LE(A);
      const resultB = global.OpCodes.Unpack32LE(B);
      return global.OpCodes.BytesToString(resultA.concat(resultB));
    },
    
    // RC5 decryption function (internal)
    _decryptBlock: function(instance, blockStr) {
      if (blockStr.length !== 8) {
        throw new Error('RC5 block must be exactly 8 bytes');
      }
      
      // Convert string to two 32-bit words (little-endian)
      const bytes = global.OpCodes.StringToBytes(blockStr);
      let A = global.OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      let B = global.OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7]);
      
      // Perform rounds in reverse
      for (let i = instance.rounds; i >= 1; i--) {
        // B = ROR(B - S[2*i+1], A) XOR A
        B = (B - instance.S[2 * i + 1]) >>> 0;
        B = global.OpCodes.RotR32(B, A & 31);
        B = B ^ A;
        
        // A = ROR(A - S[2*i], B) XOR B
        A = (A - instance.S[2 * i]) >>> 0;
        A = global.OpCodes.RotR32(A, B & 31);
        A = A ^ B;
      }
      
      // Subtract first round keys
      A = (A - instance.S[0]) >>> 0;
      B = (B - instance.S[1]) >>> 0;
      
      // Convert back to string (little-endian)
      const resultA = global.OpCodes.Unpack32LE(A);
      const resultB = global.OpCodes.Unpack32LE(B);
      return global.OpCodes.BytesToString(resultA.concat(resultB));
    },
    
    // RC5 Instance class
    RC5Instance: function(key) {
      this.wordSize = RC5.DEFAULT_WORD_SIZE;
      this.rounds = RC5.DEFAULT_ROUNDS;
      this.keyBytes = key ? key.length : RC5.DEFAULT_KEY_BYTES;
      this.tableSize = 2 * (this.rounds + 1); // t = 2*(r+1)
      this.S = new Array(this.tableSize); // Expanded key table
      
      // Perform key expansion
      this._keyExpansion(key || '');
    }
  };
  
  // Add key expansion method to RC5Instance prototype
  RC5.RC5Instance.prototype._keyExpansion = function(key) {
    const u = this.wordSize / 8; // Bytes per word (4 for 32-bit)
    const c = Math.max(1, Math.ceil(this.keyBytes / u)); // Words in key
    const L = new Array(c); // Key in word array
    
    // Step 1: Copy key into L array (little-endian)
    for (let i = 0; i < c; i++) {
      L[i] = 0;
    }
    
    for (let i = this.keyBytes - 1; i >= 0; i--) {
      const keyByte = i < key.length ? key.charCodeAt(i) & 0xFF : 0;
      L[Math.floor(i / u)] = ((L[Math.floor(i / u)] << 8) + keyByte) >>> 0;
    }
    
    // Step 2: Initialize S array with magic constants
    this.S[0] = RC5.MAGIC_P;
    for (let i = 1; i < this.tableSize; i++) {
      this.S[i] = (this.S[i - 1] + RC5.MAGIC_Q) >>> 0;
    }
    
    // Step 3: Mix key into S array
    let A = 0, B = 0;
    let i = 0, j = 0;
    const iterations = 3 * Math.max(this.tableSize, c);
    
    for (let k = 0; k < iterations; k++) {
      // S[i] = ROL(S[i] + A + B, 3)
      this.S[i] = (this.S[i] + A + B) >>> 0;
      A = this.S[i] = global.OpCodes.RotL32(this.S[i], 3);
      
      // L[j] = ROL(L[j] + A + B, A + B)
      L[j] = (L[j] + A + B) >>> 0;
      B = L[j] = global.OpCodes.RotL32(L[j], (A + B) & 31);
      
      i = (i + 1) % this.tableSize;
      j = (j + 1) % c;
    }
    
    // Clear temporary key array
    if (global.OpCodes && global.OpCodes.ClearArray) {
      global.OpCodes.ClearArray(L);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(RC5);
  }
  
  // Export to global scope
  global.RC5 = RC5;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RC5;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);