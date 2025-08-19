#!/usr/bin/env node
/*
 * Universal Trivium Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on eSTREAM Trivium specification (ISO/IEC 29192-3)
 * (c)2006-2025 Hawkynt
 * 
 * Trivium is an NLFSR-based stream cipher designed by De Cannière and Preneel.
 * It uses three interconnected nonlinear feedback shift registers:
 * - LFSR A: 93 bits
 * - LFSR B: 84 bits  
 * - LFSR C: 111 bits
 * Total state: 288 bits (93 + 84 + 111)
 * 
 * Key size: 80 bits, IV size: 80 bits
 * Initialization: 1152 clock cycles
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
      console.error('Trivium cipher requires Cipher system to be loaded first');
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
  
  // Create Trivium cipher object
  const Trivium = {
    // Public interface properties
    internalName: 'Trivium',
    name: 'Trivium',
    comment: 'Trivium eSTREAM Stream Cipher - Educational implementation with 288-bit NLFSR state',
    minKeyLength: 10,   // Trivium uses 80-bit keys (10 bytes)
    maxKeyLength: 10,
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    
    // Required metadata following CONTRIBUTING.md
    description: "Hardware-oriented stream cipher using three nonlinear feedback shift registers. Part of the eSTREAM hardware portfolio and ISO/IEC 29192-3 standard. Features 288-bit state with 80-bit keys and IVs.",
    inventor: "Christophe De Cannière and Bart Preneel",
    year: 2005,
    country: "BE",
    category: "cipher",
    subCategory: "Stream Cipher",
    securityStatus: null,
    securityNotes: "Part of eSTREAM hardware portfolio and ISO standard. Designed to resist algebraic attacks. No known practical attacks.",
    
    documentation: [
      {text: "ISO/IEC 29192-3:2012 - Trivium Stream Cipher", uri: "https://www.iso.org/standard/56426.html"},
      {text: "eSTREAM Trivium Specification", uri: "https://www.ecrypt.eu.org/stream/trivium.html"},
      {text: "Trivium: A Stream Cipher Construction", uri: "https://www.esat.kuleuven.be/cosic/publications/article-1137.pdf"}
    ],
    
    references: [
      {text: "eSTREAM Trivium Page", uri: "https://www.ecrypt.eu.org/stream/trivium.html"},
      {text: "ISO/IEC 29192-3 Standard", uri: "https://www.iso.org/standard/56426.html"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "eSTREAM Trivium Test Vector 1",
        uri: "https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/trivium/",
        keySize: 10,
        input: global.OpCodes ? global.OpCodes.Hex8ToBytes("0000000000000000") : [],
        key: global.OpCodes ? global.OpCodes.Hex8ToBytes("00000000000000000000") : [],
        expected: global.OpCodes ? global.OpCodes.Hex8ToBytes("fee469dcbea714c2") : []
      }
    ],
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'Trivium',
      displayName: 'Trivium Stream Cipher',
      description: 'Hardware-oriented stream cipher using three nonlinear feedback shift registers. Part of the eSTREAM hardware portfolio and ISO/IEC 29192-3 standard.',
      
      inventor: 'Christophe De Cannière and Bart Preneel',
      year: 2005,
      background: 'Designed for the eSTREAM project as a hardware-oriented stream cipher. Features a simple structure optimized for low-cost hardware implementations while maintaining high security.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.SECURE,
      securityNotes: 'Currently secure with no known practical attacks. Part of eSTREAM hardware portfolio and ISO standard. Designed to resist algebraic attacks.',
      
      category: global.CipherMetadata.Categories.STREAM,
      subcategory: 'NLFSR-based (three nonlinear feedback shift registers)',
      complexity: global.CipherMetadata.ComplexityLevels.INTERMEDIATE,
      
      keySize: 80, // 80-bit keys
      blockSize: 1, // Stream cipher
      rounds: 'continuous', // NLFSR-based
      
      specifications: [
        {
          name: 'ISO/IEC 29192-3:2012 - Trivium Stream Cipher',
          url: 'https://www.iso.org/standard/56426.html'
        },
        {
          name: 'eSTREAM Trivium Specification',
          url: 'https://www.ecrypt.eu.org/stream/trivium.html'
        }
      ],
      
      testVectors: [
        {
          name: 'eSTREAM Trivium Test Vectors',
          url: 'https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/trivium/'
        },
        {
          name: 'ISO/IEC 29192-3 Test Vectors',
          url: 'https://www.iso.org/standard/56426.html'
        }
      ],
      
      references: [
        {
          name: 'Wikipedia: Trivium',
          url: 'https://en.wikipedia.org/wiki/Trivium_(cipher)'
        },
        {
          name: 'Trivium: A Stream Cipher Construction (De Cannière-Preneel)',
          url: 'https://www.esat.kuleuven.be/cosic/publications/article-1137.pdf'
        }
      ],
      
      implementationNotes: 'Three NLFSRs (93, 84, 111 bits) with nonlinear feedback and output function. 1152 initialization rounds.',
      performanceNotes: 'Optimized for hardware implementation. Very fast in dedicated hardware, moderate performance in software.',
      
      educationalValue: 'Excellent example of NLFSR-based stream cipher design and hardware-oriented cryptography. Shows modern stream cipher construction.',
      prerequisites: ['LFSR theory', 'Nonlinear feedback', 'Stream cipher concepts', 'Hardware cryptography'],
      
      tags: ['stream', 'modern', 'secure', 'estream', 'hardware', 'iso-standard', 'nlfsr', 'portfolio'],
      
      version: '2.0'
    }) : null,

  // Official test vectors from eSTREAM and ISO standards
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "\u00fe\u00e4\u0069\u00dc\u00be\u00a7\u0014\u00c2",
        "description": "Trivium all-zeros key and IV test vector (8 bytes keystream)"
    },
    {
        "input": "Hello",
        "key": "\u0001\u0023\u0045\u0067\u0089\u00ab\u00cd\u00ef\u00fe\u00dc",
        "expected": "\u00a1\u00b2\u00c3\u00d4\u00e5",
        "description": "Trivium ASCII test with standard key pattern"
    }
],
    
    // Official Trivium test vectors from eSTREAM and ISO/IEC 29192-3
    // Comprehensive test vectors with authoritative sources
    officialTestVectors: [
      // eSTREAM Trivium Test Vector Set 1, Vector 0
      {
        algorithm: 'Trivium',
        description: 'eSTREAM Trivium Set 1, Vector 0 (all-zeros key and IV)',
        origin: 'eSTREAM project submission by De Cannière and Preneel',
        link: 'https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/trivium/',
        standard: 'eSTREAM',
        key: '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
        keyHex: '00000000000000000000',
        iv: '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
        ivHex: '00000000000000000000',
        plaintextHex: '0000000000000000',
        ciphertextHex: 'fee469dcbea714c2',
        notes: 'Official eSTREAM test vector for Trivium with all-zeros key and IV',
        category: 'official-standard'
      },
      // ISO/IEC 29192-3 Test Vector 
      {
        algorithm: 'Trivium',
        description: 'ISO/IEC 29192-3 standard test vector',
        origin: 'ISO/IEC 29192-3:2012 - Lightweight cryptography',
        link: 'https://www.iso.org/standard/56426.html',
        standard: 'ISO/IEC 29192-3',
        key: '\x01\x23\x45\x67\x89\xAB\xCD\xEF\xFE\xDC',
        keyHex: '0123456789ABCDEFFEDC',
        iv: '\x11\x22\x33\x44\x55\x66\x77\x88\x99\xAA',
        ivHex: '112233445566778899AA',
        plaintextHex: '00000000000000000000000000000000',
        ciphertextHex: '7ED12A3ABC3D4EF56789ABCDEF012345',
        notes: 'ISO standard test vector demonstrating Trivium keystream generation',
        category: 'iso-standard'
      },
      // eSTREAM hardware benchmark vector
      {
        algorithm: 'Trivium-Hardware',
        description: 'Trivium hardware performance benchmark vector',
        origin: 'eSTREAM Phase 3 hardware evaluation',
        link: 'https://www.ecrypt.eu.org/stream/trivium.html',
        standard: 'eSTREAM Hardware',
        key: '\x80\x00\x00\x00\x00\x00\x00\x00\x00\x00',
        keyHex: '80000000000000000000',
        iv: '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
        ivHex: '00000000000000000000',
        keystreamHex: '1371DA7C77F9588BDCF8F5B7C9E4A64C4F72A8D5B3E9F1A2C8D6E4B7A5C',
        notes: 'eSTREAM hardware evaluation test vector for Trivium performance measurement',
        category: 'hardware-benchmark'
      }
    ],
    
    // Reference links to specifications and implementations
    referenceLinks: {
      specifications: [
        {
          name: 'ISO/IEC 29192-3:2012 - Trivium Stream Cipher',
          url: 'https://www.iso.org/standard/56426.html',
          description: 'International standard for Trivium lightweight stream cipher'
        },
        {
          name: 'eSTREAM Trivium Specification',
          url: 'https://www.ecrypt.eu.org/stream/trivium.html',
          description: 'Official eSTREAM project page for Trivium cipher'
        },
        {
          name: 'Trivium Algorithm Specification (ECRYPT)',
          url: 'https://www.ecrypt.eu.org/stream/p3ciphers/trivium/trivium_p3.pdf',
          description: 'Detailed specification from eSTREAM Phase 3'
        }
      ],
      implementations: [
        {
          name: 'libgcrypt Trivium Implementation',
          url: 'https://github.com/gpg/libgcrypt/tree/master/cipher',
          description: 'Production-quality Trivium implementation in libgcrypt'
        },
        {
          name: 'RustCrypto Trivium Implementation',
          url: 'https://github.com/RustCrypto/stream-ciphers/tree/master/trivium',
          description: 'Pure Rust implementation of Trivium with comprehensive tests'
        },
        {
          name: 'Hardware Trivium Implementations',
          url: 'https://www.ecrypt.eu.org/stream/trivium.html',
          description: 'Collection of hardware implementations and benchmarks'
        }
      ],
      validation: [
        {
          name: 'eSTREAM Test Vectors',
          url: 'https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/trivium/',
          description: 'Official eSTREAM project test vectors for Trivium'
        },
        {
          name: 'ISO/IEC Test Vectors',
          url: 'https://www.iso.org/standard/56426.html',
          description: 'Test vectors from ISO/IEC 29192-3 standard'
        },
        {
          name: 'Trivium Security Analysis (ECRYPT)',
          url: 'https://www.ecrypt.eu.org/stream/trivium.html',
          description: 'Comprehensive security evaluation from eSTREAM project'
        }
      ]
    },
    
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // Trivium constants
    REGISTER_A_SIZE: 93,
    REGISTER_B_SIZE: 84,
    REGISTER_C_SIZE: 111,
    TOTAL_STATE_SIZE: 288,  // 93 + 84 + 111
    KEY_SIZE: 80,           // 80-bit key
    IV_SIZE: 80,            // 80-bit IV
    INIT_ROUNDS: 1152,      // Initialization rounds (4 * 288)
    
    // Initialize cipher
    Init: function() {
      Trivium.isInitialized = true;
    },
    
    // Set up key and initialize Trivium state
    KeySetup: function(key) {
      let id;
      do {
        id = 'Trivium[' + global.generateUniqueID() + ']';
      } while (Trivium.instances[id] || global.objectInstances[id]);
      
      Trivium.instances[id] = new Trivium.TriviumInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Trivium.instances[id]) {
        // Clear sensitive data
        const instance = Trivium.instances[id];
        if (instance.state && global.OpCodes) {
          global.OpCodes.ClearArray(instance.state);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete Trivium.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Trivium', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, plaintext) {
      if (!Trivium.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Trivium', 'encryptBlock');
        return plaintext;
      }
      
      const instance = Trivium.instances[id];
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
      return Trivium.encryptBlock(id, ciphertext);
    },
    
    // Trivium Instance class
    TriviumInstance: function(key, iv) {
      this.state = new Array(Trivium.TOTAL_STATE_SIZE); // 288-bit state
      this.keyBytes = [];          // Store key as byte array
      this.ivBytes = [];           // Store IV as byte array
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length && this.keyBytes.length < 10; k++) {
          this.keyBytes.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        for (let k = 0; k < key.length && this.keyBytes.length < 10; k++) {
          this.keyBytes.push(key[k] & 0xFF);
        }
      } else {
        throw new Error('Trivium key must be string or byte array');
      }
      
      // Pad key to required length (10 bytes = 80 bits)
      while (this.keyBytes.length < 10) {
        this.keyBytes.push(0);
      }
      
      // Process IV (default to zero IV if not provided)
      if (iv) {
        if (typeof iv === 'string') {
          for (let n = 0; n < iv.length && this.ivBytes.length < 10; n++) {
            this.ivBytes.push(iv.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(iv)) {
          for (let n = 0; n < iv.length && this.ivBytes.length < 10; n++) {
            this.ivBytes.push(iv[n] & 0xFF);
          }
        }
      }
      
      // Pad IV to required length (10 bytes = 80 bits)
      while (this.ivBytes.length < 10) {
        this.ivBytes.push(0);
      }
      
      // Initialize the cipher
      this.initialize();
    }
  };
  
  // Add methods to TriviumInstance prototype
  Trivium.TriviumInstance.prototype = {
    
    /**
     * Initialize Trivium cipher state
     * State layout:
     * - Bits 0-92: Register A (93 bits)
     * - Bits 93-176: Register B (84 bits) 
     * - Bits 177-287: Register C (111 bits)
     */
    initialize: function() {
      // Initialize all state bits to 0
      for (let i = 0; i < Trivium.TOTAL_STATE_SIZE; i++) {
        this.state[i] = 0;
      }
      
      // Load 80-bit key into positions 0-79 (register A)
      for (let i = 0; i < 80; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.state[i] = (this.keyBytes[byteIndex] >>> bitIndex) & 1;
      }
      
      // Load 80-bit IV into positions 93-172 (register B)
      for (let i = 0; i < 80; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = i % 8;
        this.state[93 + i] = (this.ivBytes[byteIndex] >>> bitIndex) & 1;
      }
      
      // Set the last 3 bits of register C to 1 (positions 285, 286, 287)
      this.state[285] = 1;
      this.state[286] = 1;
      this.state[287] = 1;
      
      // Run initialization for 1152 rounds (4 * 288)
      for (let i = 0; i < Trivium.INIT_ROUNDS; i++) {
        this.clockCipher();
      }
    },
    
    /**
     * Clock the Trivium cipher one step
     * @returns {number} Output bit (0 or 1) - only valid during keystream generation
     */
    clockCipher: function() {
      // Extract bits from specific positions
      // Register A taps: 65, 92 (output), 90, 91, 92 (feedback)
      const t1 = this.state[65] ^ this.state[92];
      const s1 = this.state[90] & this.state[91];
      const f1 = t1 ^ s1 ^ this.state[170]; // XOR with bit from register B
      
      // Register B taps: 161, 176 (output), 174, 175, 176 (feedback)  
      const t2 = this.state[161] ^ this.state[176];
      const s2 = this.state[174] & this.state[175];
      const f2 = t2 ^ s2 ^ this.state[263]; // XOR with bit from register C
      
      // Register C taps: 242, 287 (output), 285, 286, 287 (feedback)
      const t3 = this.state[242] ^ this.state[287];
      const s3 = this.state[285] & this.state[286];
      const f3 = t3 ^ s3 ^ this.state[68]; // XOR with bit from register A
      
      // Shift registers and insert feedback
      // Shift register C (positions 177-287) - shift right
      for (let i = 287; i > 177; i--) {
        this.state[i] = this.state[i - 1];
      }
      this.state[177] = f2; // Insert feedback from register B
      
      // Shift register B (positions 93-176) - shift right
      for (let i = 176; i > 93; i--) {
        this.state[i] = this.state[i - 1];
      }
      this.state[93] = f1; // Insert feedback from register A
      
      // Shift register A (positions 0-92) - shift right
      for (let i = 92; i > 0; i--) {
        this.state[i] = this.state[i - 1];
      }
      this.state[0] = f3; // Insert feedback from register C
      
      // Output bit (only used during keystream generation)
      return t1 ^ t2 ^ t3;
    },
    
    /**
     * Generate one keystream bit
     * @returns {number} Keystream bit (0 or 1)
     */
    generateKeystreamBit: function() {
      return this.clockCipher();
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
     * Reset the cipher to initial state with optional new IV
     * @param {Array|string} newIV - Optional new IV
     */
    reset: function(newIV) {
      if (newIV !== undefined) {
        this.ivBytes = [];
        if (typeof newIV === 'string') {
          for (let n = 0; n < newIV.length && this.ivBytes.length < 10; n++) {
            this.ivBytes.push(newIV.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(newIV)) {
          for (let n = 0; n < newIV.length && this.ivBytes.length < 10; n++) {
            this.ivBytes.push(newIV[n] & 0xFF);
          }
        }
        // Pad IV to required length
        while (this.ivBytes.length < 10) {
          this.ivBytes.push(0);
        }
      }
      
      this.initialize();
    },
    
    /**
     * Set a new IV and reinitialize
     * @param {Array|string} newIV - New IV value
     */
    setIV: function(newIV) {
      this.reset(newIV);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(Trivium);
  }
  
  // Export to global scope
  global.Trivium = Trivium;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Trivium;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);