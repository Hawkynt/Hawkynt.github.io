/*
 * Salsa20 Stream Cipher Implementation
 * (c)2006-2025 Hawkynt
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
  
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    try {
      global.AlgorithmFramework = require('../../AlgorithmFramework.js');
    } catch (e) {
      console.error('Failed to load AlgorithmFramework:', e.message);
      return;
    }
  }
  
  const Salsa20 = {
    name: "Salsa20",
    description: "ARX-based stream cipher designed for high performance and security using Addition, Rotation, and XOR operations. Part of eSTREAM portfolio with no S-boxes or lookup tables required.",
    inventor: "Daniel J. Bernstein",
    year: 2005,
    country: "US",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: "Stream Cipher",
    securityStatus: null,
    securityNotes: "Well-analyzed eSTREAM finalist with strong security record. However, use established cryptographic libraries for production systems.",
    
    documentation: [
      {text: "Salsa20 Specification", uri: "https://cr.yp.to/snuffle/spec.pdf"},
      {text: "RFC 7914", uri: "https://tools.ietf.org/html/rfc7914"},
      {text: "eSTREAM Portfolio", uri: "https://www.ecrypt.eu.org/stream/"}
    ],
    
    references: [
      {text: "DJB's Salsa20 Page", uri: "https://cr.yp.to/snuffle.html"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "eSTREAM Salsa20 Set 1, Vector 0 (128-bit key)",
        uri: "https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/salsa20/",
        keySize: 16,
        key: global.OpCodes.Hex8ToBytes("80000000000000000000000000000000"),
        nonce: global.OpCodes.Hex8ToBytes("0000000000000000"),
        input: global.OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: global.OpCodes.Hex8ToBytes("4dfa5e481da23ea09a31022050859936")
      },
      {
        text: "eSTREAM Salsa20 Set 6, Vector 0 (256-bit key)",
        uri: "https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/salsa20/",
        keySize: 32,
        key: global.OpCodes.Hex8ToBytes("8000000000000000000000000000000000000000000000000000000000000000"),
        nonce: global.OpCodes.Hex8ToBytes("0000000000000000"),
        input: global.OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: global.OpCodes.Hex8ToBytes("e3be8fdd8beca2e3ea8ef9475b29a6e7")
      },
      {
        text: "Salsa20 Keystream Test (Bernstein spec)",
        uri: "https://cr.yp.to/snuffle/spec.pdf",
        keySize: 32,
        key: global.OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
        nonce: global.OpCodes.Hex8ToBytes("0102030405060708"),
        input: global.OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        expected: global.OpCodes.Hex8ToBytes("b5e33b3ec95473426445e0dd89413b2b5fcff5d7738a88b5e66c3999a44b7b8dfdc61b978e59b919b42c95b4a11fdd0a41aadf8b0e90825cf9e6fb0c61a7c8b5")
      }
    ],

    // Public interface properties
    minKeyLength: 16,   // 128-bit minimum
    maxKeyLength: 32,   // 256-bit maximum
    stepKeyLength: 16,  // Support 128-bit and 256-bit keys
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'Salsa20',
      displayName: 'Salsa20 Stream Cipher',
      description: 'Fast and secure stream cipher designed by Daniel J. Bernstein using ARX operations. Part of the eSTREAM portfolio and uses 256-bit keys with 64-bit nonces.',
      
      inventor: 'Daniel J. Bernstein',
      year: 2005,
      background: 'Designed for the eSTREAM project as a high-speed stream cipher. Uses a simple ARX (Add-Rotate-XOR) design with no S-boxes or lookup tables, making it fast on a wide variety of platforms.',
      
      securityStatus: null,
      securityNotes: 'Well-analyzed eSTREAM finalist with strong security record. Part of the eSTREAM portfolio. Inspired the design of ChaCha20.',
      
      category: global.CipherMetadata.Categories.STREAM,
      subcategory: 'ARX (Add-Rotate-XOR)',
      complexity: global.CipherMetadata.ComplexityLevels.INTERMEDIATE,
      
      keySize: '128/256 bits', // Variable key size
      blockSize: 512, // 64-byte keystream blocks
      rounds: 20,
      
      specifications: [
        {
          name: 'Salsa20 Specification (Daniel J. Bernstein)',
          url: 'https://cr.yp.to/snuffle/spec.pdf'
        },
        {
          name: 'RFC 7914 - Salsa20/8 Core Reference',
          url: 'https://tools.ietf.org/html/rfc7914'
        }
      ],
      
      testVectors: [
        {
          name: 'eSTREAM Salsa20 Test Vectors',
          url: 'https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/salsa20/'
        },
        {
          name: 'Bernstein Salsa20 Test Vectors',
          url: 'https://cr.yp.to/snuffle/spec.pdf'
        }
      ],
      
      references: [
        {
          name: 'Wikipedia: Salsa20',
          url: 'https://en.wikipedia.org/wiki/Salsa20'
        },
        {
          name: 'The Salsa20 Family of Stream Ciphers',
          url: 'https://cr.yp.to/streamciphers/salsa20/spec.pdf'
        }
      ],
      
      implementationNotes: 'ARX-based design with 20 rounds of quarter-round operations. Supports both 128-bit and 256-bit keys.',
      performanceNotes: 'Very fast due to simple operations and no table lookups. Approximately 4-6 cycles per byte on modern processors.',
      
      educationalValue: 'Excellent introduction to ARX ciphers and modern stream cipher design. Shows evolution from block to stream ciphers.',
      prerequisites: ['Stream cipher concepts', 'Bitwise operations', 'ARX operations', 'Cryptographic nonces'],
      
      tags: ['stream', 'modern', 'secure', 'estream', 'bernstein', 'arx', 'portfolio'],
      
      version: '2.0'
    }) : null,

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "Mú^H\u001d¢> 1\u0002 P6",
        "description": "Salsa20 128-bit key Set 1 Vector 0 - First 16 bytes of keystream"
    },
    {
        "input": "Hello World!",
        "key": "\u0001#Eg«ÍïþÜºvT2\u0010",
        "expected": "ú|A@Ñ×xå,ê",
        "description": "Salsa20 128-bit practical ASCII test vector - educational use"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f ",
        "expected": "w(\u000b¢lðÚ",
        "description": "Salsa20 256-bit key test vector - 8 byte keystream"
    },
    {
        "input": "TEST",
        "key": "+~\u0015\u0016(®Ò¦«÷\u0015\tÏO<",
        "expected": "Þô",
        "description": "Salsa20 128-bit simple text test - educational demonstration"
    }
],
    
    // Official Salsa20 test vectors from eSTREAM and Bernstein's specification
    // Comprehensive test vectors with authoritative sources and validation data
    officialTestVectors: [
      // eSTREAM Salsa20 Test Vector Set 1, Vector 0 (128-bit key)
      {
        algorithm: 'Salsa20',
        description: 'eSTREAM Salsa20/20 Set 1, Vector 0 (128-bit key)',
        origin: 'eSTREAM project submission by Daniel J. Bernstein',
        link: 'https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/salsa20/',
        standard: 'eSTREAM',
        key: '\x80\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
        keyHex: OpCodes.Hex8ToBytes('80000000000000000000000000000000'),
        nonce: '\x00\x00\x00\x00\x00\x00\x00\x00',
        nonceHex: OpCodes.Hex8ToBytes('0000000000000000'),
        counter: 0,
        plaintextHex: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
        ciphertextHex: OpCodes.Hex8ToBytes('4dfa5e481da23ea09a31022050859936'),
        notes: 'Official eSTREAM test vector for Salsa20/20 with 128-bit key',
        category: 'official-standard'
      },
      // eSTREAM Salsa20 Test Vector Set 6, Vector 0 (256-bit key)
      {
        algorithm: 'Salsa20',
        description: 'eSTREAM Salsa20/20 Set 6, Vector 0 (256-bit key)',
        origin: 'eSTREAM project submission by Daniel J. Bernstein',
        link: 'https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/salsa20/',
        standard: 'eSTREAM',
        key: '\x80\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
        keyHex: OpCodes.Hex8ToBytes('8000000000000000000000000000000000000000000000000000000000000000'),
        nonce: '\x00\x00\x00\x00\x00\x00\x00\x00',
        nonceHex: OpCodes.Hex8ToBytes('0000000000000000'),
        counter: 0,
        plaintextHex: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
        ciphertextHex: OpCodes.Hex8ToBytes('e3be8fdd8beca2e3ea8ef9475b29a6e7'),
        notes: 'Official eSTREAM test vector for Salsa20/20 with 256-bit key',
        category: 'official-standard'
      },
      // Bernstein specification keystream test
      {
        algorithm: 'Salsa20-Keystream',
        description: 'Salsa20 keystream generation test (Bernstein spec)',
        origin: 'Daniel J. Bernstein, Salsa20 specification',
        link: 'https://cr.yp.to/snuffle/spec.pdf',
        standard: 'Bernstein-Spec',
        key: '\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f\x20',
        keyHex: OpCodes.Hex8ToBytes('0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20'),
        nonce: '\x01\x02\x03\x04\x05\x06\x07\x08',
        nonceHex: OpCodes.Hex8ToBytes('0102030405060708'),
        counter: 0,
        keystreamHex: OpCodes.Hex8ToBytes('b5e33b3ec95473426445e0dd89413b2b5fcff5d7738a88b5e66c3999a44b7b8dfdc61b978e59b919b42c95b4a11fdd0a41aadf8b0e90825cf9e6fb0c61a7c8b5'),
        notes: 'Salsa20 keystream generation test from original specification',
        category: 'keystream-test'
      },
      // Additional eSTREAM vector for robustness testing
      {
        algorithm: 'Salsa20',
        description: 'eSTREAM Salsa20/20 Set 2, Vector 63 (128-bit key, high bit in nonce)',
        origin: 'eSTREAM project submission by Daniel J. Bernstein',
        link: 'https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/salsa20/',
        standard: 'eSTREAM',
        key: '\x00\x53\xa6\xf9\x4c\x9f\xf2\x45\x98\xeb\x3e\x91\xe4\x37\x8a\xdd',
        keyHex: OpCodes.Hex8ToBytes('0053a6f94c9ff24598eb3e91e4378add'),
        nonce: '\x0d\x74\xdb\x42\xa9\x10\x77\xde',
        nonceHex: OpCodes.Hex8ToBytes('0d74db42a91077de'),
        counter: 0,
        plaintextHex: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
        ciphertextHex: OpCodes.Hex8ToBytes('05e1e7beb697d999656bf37c1b978806'),
        notes: 'eSTREAM test vector with complex key/nonce pattern for robustness testing',
        category: 'robustness-test'
      }
    ],
    
    // Reference links to authoritative sources and production implementations
    referenceLinks: {
      specifications: [
        {
          name: 'Salsa20 Specification (Daniel J. Bernstein)',
          url: 'https://cr.yp.to/snuffle/spec.pdf',
          description: 'Original Salsa20 specification by Daniel J. Bernstein'
        },
        {
          name: 'eSTREAM Salsa20 Submission',
          url: 'https://www.ecrypt.eu.org/stream/salsa20pf.html',
          description: 'Official eSTREAM project portfolio entry for Salsa20'
        },
        {
          name: 'RFC 7914 - Salsa20/8 Core',
          url: 'https://tools.ietf.org/html/rfc7914',
          description: 'IETF RFC documenting Salsa20/8 core for scrypt usage'
        },
        {
          name: 'Salsa20 Official Page (DJB)',
          url: 'https://cr.yp.to/salsa20.html',
          description: 'Daniel J. Bernstein\'s official Salsa20 page with reference implementations'
        }
      ],
      implementations: [
        {
          name: 'libsodium Salsa20 Implementation',
          url: 'https://github.com/jedisct1/libsodium/tree/master/src/libsodium/crypto_stream_salsa20',
          description: 'High-performance Salsa20 implementation from libsodium'
        },
        {
          name: 'Bernstein Reference Implementation',
          url: 'https://cr.yp.to/snuffle/salsa20/ref/',
          description: 'Reference C implementation by Daniel J. Bernstein'
        },
        {
          name: 'RustCrypto Salsa20 Implementation',
          url: 'https://github.com/RustCrypto/stream-ciphers/tree/master/salsa20',
          description: 'Pure Rust implementation of Salsa20 with comprehensive tests'
        }
      ],
      validation: [
        {
          name: 'eSTREAM Test Vectors',
          url: 'https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/salsa20/',
          description: 'Official eSTREAM project test vectors for Salsa20'
        },
        {
          name: 'Bernstein Test Vectors',
          url: 'https://cr.yp.to/snuffle/spec.pdf',
          description: 'Original test vectors from Bernstein\'s specification'
        },
        {
          name: 'SUPERCOP Benchmarks',
          url: 'https://bench.cr.yp.to/results-stream.html',
          description: 'Performance benchmarks and validation for Salsa20'
        }
      ]
    },
    
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // Salsa20 constants - "expand 32-byte k" and "expand 16-byte k"
    CONSTANTS_32: [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574], // "expand 32-byte k"
    CONSTANTS_16: [0x61707865, 0x3120646e, 0x79622d36, 0x6b206574], // "expand 16-byte k"
    
    // Initialize cipher
    Init: function() {
      Salsa20.isInitialized = true;
    },
    
    // Set up key and initialize Salsa20 state
    KeySetup: function(key) {
      let id;
      do {
        id = 'Salsa20[' + global.generateUniqueID() + ']';
      } while (Salsa20.instances[id] || global.objectInstances[id]);
      
      Salsa20.instances[id] = new Salsa20.Salsa20Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Create instance for testing framework
    CreateInstance: function(isDecrypt) {
      return {
        _instance: null,
        _inputData: [],
        
        set key(keyData) {
          this._instance = new Salsa20.Salsa20Instance(keyData);
        },
        
        set keySize(size) {
          this._keySize = size;
        },
        
        set nonce(nonceData) {
          if (this._instance) {
            this._instance.setNonce(nonceData);
          } else {
            this._nonce = nonceData;
          }
        },
        
        Feed: function(data) {
          if (Array.isArray(data)) {
            this._inputData = data.slice();
          } else if (typeof data === 'string') {
            this._inputData = [];
            for (let i = 0; i < data.length; i++) {
              this._inputData.push(data.charCodeAt(i));
            }
          }
        },
        
        Result: function() {
          if (!this._inputData || this._inputData.length === 0) {
            return [];
          }
          
          if (!this._instance) {
            return [];
          }
          
          // Apply nonce if stored
          if (this._nonce && this._instance.setNonce) {
            this._instance.setNonce(this._nonce);
          }
          
          const result = [];
          for (let i = 0; i < this._inputData.length; i++) {
            const keystreamByte = this._instance.getNextKeystreamByte ? 
              this._instance.getNextKeystreamByte() : 
              this._instance.generateKeystreamByte();
            result.push(this._inputData[i] ^ keystreamByte);
          }
          return result;
        }
      };
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Salsa20.instances[id]) {
        // Clear sensitive data
        const instance = Salsa20.instances[id];
        if (instance.key && global.OpCodes) {
          global.OpCodes.ClearArray(instance.key);
        }
        if (instance.state && global.OpCodes) {
          global.OpCodes.ClearArray(instance.state);
        }
        delete Salsa20.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Salsa20', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (generates keystream and XORs with input)
    encryptBlock: function(id, plainText) {
      if (!Salsa20.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Salsa20', 'encryptBlock');
        return plainText;
      }
      
      const instance = Salsa20.instances[id];
      let result = '';
      
      for (let n = 0; n < plainText.length; n++) {
        const keystreamByte = instance.getNextKeystreamByte();
        const plaintextByte = plainText.charCodeAt(n) & 0xFF;
        const ciphertextByte = plaintextByte ^ keystreamByte;
        result += String.fromCharCode(ciphertextByte);
      }
      
      return result;
    },
    
    // Decrypt block (same as encrypt for stream cipher)
    decryptBlock: function(id, cipherText) {
      // For stream ciphers, decryption is identical to encryption
      // But we need to ensure we use the same keystream position
      if (!Salsa20.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Salsa20', 'decryptBlock');
        return cipherText;
      }
      
      const instance = Salsa20.instances[id];
      let result = '';
      
      for (let n = 0; n < cipherText.length; n++) {
        const keystreamByte = instance.getNextKeystreamByte();
        const ciphertextByte = cipherText.charCodeAt(n) & 0xFF;
        const plaintextByte = ciphertextByte ^ keystreamByte;
        result += String.fromCharCode(plaintextByte);
      }
      
      return result;
    },
    
    // Salsa20 quarter-round function
    quarterRound: function(y0, y1, y2, y3) {
      if (!global.OpCodes) {
        throw new Error('OpCodes library required for Salsa20 operations');
      }
      
      // ARX operations: Addition, Rotation, XOR
      y1 ^= global.OpCodes.RotL32((y0 + y3) >>> 0, 7);
      y2 ^= global.OpCodes.RotL32((y1 + y0) >>> 0, 9);
      y3 ^= global.OpCodes.RotL32((y2 + y1) >>> 0, 13);
      y0 ^= global.OpCodes.RotL32((y3 + y2) >>> 0, 18);
      
      return [y0 >>> 0, y1 >>> 0, y2 >>> 0, y3 >>> 0];
    },
    
    // Salsa20 core function (20 rounds)
    salsa20Core: function(input) {
      if (!global.OpCodes) {
        throw new Error('OpCodes library required for Salsa20 operations');
      }
      
      // Copy input to working state
      const x = input.slice(0);
      
      // Apply 20 rounds (10 double rounds)
      for (let i = 0; i < 10; i++) {
        // Column rounds
        let temp = Salsa20.quarterRound(x[0], x[4], x[8], x[12]);
        x[0] = temp[0]; x[4] = temp[1]; x[8] = temp[2]; x[12] = temp[3];
        
        temp = Salsa20.quarterRound(x[5], x[9], x[13], x[1]);
        x[5] = temp[0]; x[9] = temp[1]; x[13] = temp[2]; x[1] = temp[3];
        
        temp = Salsa20.quarterRound(x[10], x[14], x[2], x[6]);
        x[10] = temp[0]; x[14] = temp[1]; x[2] = temp[2]; x[6] = temp[3];
        
        temp = Salsa20.quarterRound(x[15], x[3], x[7], x[11]);
        x[15] = temp[0]; x[3] = temp[1]; x[7] = temp[2]; x[11] = temp[3];
        
        // Row rounds
        temp = Salsa20.quarterRound(x[0], x[1], x[2], x[3]);
        x[0] = temp[0]; x[1] = temp[1]; x[2] = temp[2]; x[3] = temp[3];
        
        temp = Salsa20.quarterRound(x[5], x[6], x[7], x[4]);
        x[5] = temp[0]; x[6] = temp[1]; x[7] = temp[2]; x[4] = temp[3];
        
        temp = Salsa20.quarterRound(x[10], x[11], x[8], x[9]);
        x[10] = temp[0]; x[11] = temp[1]; x[8] = temp[2]; x[9] = temp[3];
        
        temp = Salsa20.quarterRound(x[15], x[12], x[13], x[14]);
        x[15] = temp[0]; x[12] = temp[1]; x[13] = temp[2]; x[14] = temp[3];
      }
      
      // Add original input to result
      const output = new Array(16);
      for (let i = 0; i < 16; i++) {
        output[i] = (x[i] + input[i]) >>> 0;
      }
      
      return output;
    },
    
    // Salsa20 Instance class
    Salsa20Instance: function(key) {
      this.key = [];          // Key bytes
      this.nonce = [0, 0];    // 64-bit nonce (2 x 32-bit words)
      this.counter = [0, 0];  // 64-bit counter (2 x 32-bit words)
      this.state = new Array(16); // 16 x 32-bit state matrix
      this.keystreamBuffer = []; // Buffered keystream bytes
      this.bufferIndex = 0;   // Current position in buffer
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length; k++) {
          this.key.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        this.key = key.slice(0); // Copy array
      } else {
        throw new Error('Salsa20 key must be string or byte array');
      }
      
      // Validate key length
      if (this.key.length !== 16 && this.key.length !== 32) {
        throw new Error('Salsa20 key must be 16 or 32 bytes (128 or 256 bits)');
      }
      
      // Initialize with default nonce (all zeros)
      this.setNonce([0, 0, 0, 0, 0, 0, 0, 0]);
      
      // Setup initial state
      this.setupState();
    }
  };
  
  // Add methods to Salsa20Instance prototype
  Salsa20.Salsa20Instance.prototype = {
    
    /**
     * Set the nonce/IV for encryption
     * @param {Array} nonceBytes - 8-byte nonce array
     */
    setNonce: function(nonceBytes) {
      if (!Array.isArray(nonceBytes) || nonceBytes.length !== 8) {
        throw new Error('Salsa20 nonce must be 8 bytes');
      }
      
      if (!global.OpCodes) {
        throw new Error('OpCodes library required for Salsa20 operations');
      }
      
      // Convert bytes to 32-bit words (little-endian)
      this.nonce[0] = global.OpCodes.Pack32LE(nonceBytes[0], nonceBytes[1], nonceBytes[2], nonceBytes[3]);
      this.nonce[1] = global.OpCodes.Pack32LE(nonceBytes[4], nonceBytes[5], nonceBytes[6], nonceBytes[7]);
      
      // Reset counter
      this.counter[0] = 0;
      this.counter[1] = 0;
      
      // Clear keystream buffer
      this.keystreamBuffer = [];
      this.bufferIndex = 0;
      
      // Update state
      this.setupState();
    },
    
    /**
     * Setup the 16-word Salsa20 state matrix
     */
    setupState: function() {
      if (!global.OpCodes) {
        throw new Error('OpCodes library required for Salsa20 operations');
      }
      
      // Choose constants based on key length
      const constants = (this.key.length === 32) ? Salsa20.CONSTANTS_32 : Salsa20.CONSTANTS_16;
      
      // State layout:
      // 0   1   2   3
      // 4   5   6   7
      // 8   9  10  11
      // 12 13  14  15
      
      // Constants
      this.state[0] = constants[0];
      this.state[5] = constants[1];
      this.state[10] = constants[2];
      this.state[15] = constants[3];
      
      // Key
      if (this.key.length === 32) {
        // 256-bit key
        this.state[1] = global.OpCodes.Pack32LE(this.key[0], this.key[1], this.key[2], this.key[3]);
        this.state[2] = global.OpCodes.Pack32LE(this.key[4], this.key[5], this.key[6], this.key[7]);
        this.state[3] = global.OpCodes.Pack32LE(this.key[8], this.key[9], this.key[10], this.key[11]);
        this.state[4] = global.OpCodes.Pack32LE(this.key[12], this.key[13], this.key[14], this.key[15]);
        this.state[11] = global.OpCodes.Pack32LE(this.key[16], this.key[17], this.key[18], this.key[19]);
        this.state[12] = global.OpCodes.Pack32LE(this.key[20], this.key[21], this.key[22], this.key[23]);
        this.state[13] = global.OpCodes.Pack32LE(this.key[24], this.key[25], this.key[26], this.key[27]);
        this.state[14] = global.OpCodes.Pack32LE(this.key[28], this.key[29], this.key[30], this.key[31]);
      } else {
        // 128-bit key (repeated)
        this.state[1] = global.OpCodes.Pack32LE(this.key[0], this.key[1], this.key[2], this.key[3]);
        this.state[2] = global.OpCodes.Pack32LE(this.key[4], this.key[5], this.key[6], this.key[7]);
        this.state[3] = global.OpCodes.Pack32LE(this.key[8], this.key[9], this.key[10], this.key[11]);
        this.state[4] = global.OpCodes.Pack32LE(this.key[12], this.key[13], this.key[14], this.key[15]);
        this.state[11] = this.state[1]; // Repeat key
        this.state[12] = this.state[2];
        this.state[13] = this.state[3];
        this.state[14] = this.state[4];
      }
      
      // Counter (positions 8-9)
      this.state[8] = this.counter[0];
      this.state[9] = this.counter[1];
      
      // Nonce (positions 6-7)
      this.state[6] = this.nonce[0];
      this.state[7] = this.nonce[1];
    },
    
    /**
     * Generate 64 bytes of keystream
     * @returns {Array} Array of 64 keystream bytes
     */
    generateBlock: function() {
      // Update state with current counter
      this.state[8] = this.counter[0];
      this.state[9] = this.counter[1];
      
      // Apply Salsa20 core function
      const output = Salsa20.salsa20Core(this.state);
      
      // Convert 32-bit words to bytes (little-endian)
      const keystream = [];
      for (let i = 0; i < 16; i++) {
        const bytes = global.OpCodes.Unpack32LE(output[i]);
        keystream.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }
      
      // Increment counter
      this.counter[0] = (this.counter[0] + 1) >>> 0;
      if (this.counter[0] === 0) {
        this.counter[1] = (this.counter[1] + 1) >>> 0;
      }
      
      return keystream;
    },
    
    /**
     * Get next keystream byte
     * @returns {number} Keystream byte (0-255)
     */
    getNextKeystreamByte: function() {
      // Generate new block if buffer is empty
      if (this.bufferIndex >= this.keystreamBuffer.length) {
        this.keystreamBuffer = this.generateBlock();
        this.bufferIndex = 0;
      }
      
      return this.keystreamBuffer[this.bufferIndex++];
    },
    
    /**
     * Generate multiple keystream bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Array} Array of keystream bytes
     */
    generateKeystream: function(length) {
      const keystream = [];
      for (let n = 0; n < length; n++) {
        keystream.push(this.getNextKeystreamByte());
      }
      return keystream;
    },
    
    /**
     * Reset cipher to initial state with same key and nonce
     */
    reset: function() {
      this.counter[0] = 0;
      this.counter[1] = 0;
      this.keystreamBuffer = [];
      this.bufferIndex = 0;
      this.setupState();
    }
  };
  
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(Salsa20);
  }
  
  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(Salsa20);
  }
  
  // Auto-register with Cipher system if available
  if (global.Cipher) {
    global.Cipher.Add(Salsa20);
  }
  
  // Export to global scope
  global.Salsa20 = Salsa20;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Salsa20;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);