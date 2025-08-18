#!/usr/bin/env node
/*
 * Universal ChaCha20 Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on RFC 7539 specification and official test vectors
 * (c)2006-2025 Hawkynt
 * 
 * ChaCha20 is a stream cipher designed by Daniel J. Bernstein.
 * It is a variant of Salsa20 with improved diffusion.
 * The algorithm uses:
 * - 256-bit keys (32 bytes)
 * - 96-bit nonces (12 bytes) with 32-bit counter (RFC 7539)
 * - 20 rounds of quarter-round operations
 * - 512-bit blocks (64 bytes) of keystream generation
 * 
 * This implementation follows RFC 7539 for compatibility with modern protocols.
 * For educational purposes only - use proven libraries for production.
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
      console.error('ChaCha20 cipher requires Cipher system to be loaded first');
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
  
  // Create ChaCha20 cipher object
  const ChaCha20 = {
    // Public interface properties
    internalName: 'ChaCha20',
    name: 'ChaCha20 Stream Cipher',
    comment: 'ChaCha20 Stream Cipher - RFC 7539 specification with official test vectors',
    minKeyLength: 32,   // ChaCha20 requires exactly 32-byte keys
    maxKeyLength: 32,
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // Comprehensive metadata
    metadata: global.CipherMetadata ? global.CipherMetadata.createMetadata({
      algorithm: 'ChaCha20',
      displayName: 'ChaCha20 Stream Cipher',
      description: 'Modern stream cipher designed by Daniel J. Bernstein as a variant of Salsa20 with improved diffusion. Uses 20 rounds of quarter-round operations and supports 256-bit keys with 96-bit nonces.',
      
      inventor: 'Daniel J. Bernstein',
      year: 2008,
      background: 'Designed as an improved version of Salsa20 with better diffusion properties. ChaCha20 became widely adopted after being standardized in RFC 7539 and is used in TLS 1.3, SSH, and other modern protocols.',
      
      securityStatus: global.CipherMetadata.SecurityStatus.SECURE,
      securityNotes: 'Currently secure with no known practical attacks. Adopted by major protocols (TLS 1.3, SSH). 256-bit key provides excellent security margin.',
      
      category: global.CipherMetadata.Categories.STREAM,
      subcategory: 'ARX (Add-Rotate-XOR)',
      complexity: global.CipherMetadata.ComplexityLevels.INTERMEDIATE,
      
      keySize: 256, // 256-bit keys
      blockSize: 512, // 64-byte keystream blocks
      rounds: 20,
      
      specifications: [
        {
          name: 'RFC 7539: ChaCha20 and Poly1305 for IETF Protocols',
          url: 'https://tools.ietf.org/html/rfc7539'
        },
        {
          name: 'Bernstein: ChaCha, a variant of Salsa20',
          url: 'https://cr.yp.to/chacha/chacha-20080128.pdf'
        }
      ],
      
      testVectors: [
        {
          name: 'RFC 7539 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc7539#section-2.4.2'
        },
        {
          name: 'IETF ChaCha20 Test Suite',
          url: 'https://github.com/RustCrypto/stream-ciphers/tree/master/chacha20/tests'
        }
      ],
      
      references: [
        {
          name: 'Wikipedia: ChaCha20-Poly1305',
          url: 'https://en.wikipedia.org/wiki/ChaCha20-Poly1305'
        },
        {
          name: 'Cryptographic Right Answers - ChaCha20',
          url: 'https://latacora.micro.blog/2018/04/03/cryptographic-right-answers.html'
        }
      ],
      
      implementationNotes: 'RFC 7539 compliant implementation with 96-bit nonce and 32-bit counter. Uses OpCodes for rotations and word operations.',
      performanceNotes: 'Very fast on modern CPUs due to ARX operations. Approximately 3-4 cycles per byte on modern x86-64 processors.',
      
      educationalValue: 'Excellent example of modern stream cipher design, ARX operations, and nonce-based cryptography. Shows evolution from block to stream ciphers.',
      prerequisites: ['Stream cipher concepts', 'Bitwise operations', 'Modular arithmetic', 'Cryptographic nonces'],
      
      tags: ['stream', 'modern', 'secure', 'rfc7539', 'bernstein', 'salsa20-variant', 'tls', 'arx'],
      
      version: '2.0'
    }) : null,

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f",
        "expected": "9ý+}ÙÅ\u0019j½\u0003w¸ÜJI",
        "description": "ChaCha20 with RFC key, zero nonce, counter=0 (educational test)"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "v¸à­ ñ=@]jåS½(",
        "description": "ChaCha20 all-zeros key test (educational verification)"
    },
    {
        "input": "Hello World!",
        "key": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f",
        "expected": "qG\u0011¶åN\u0005ÿÑgV",
        "description": "ChaCha20 \"Hello World!\" test with RFC 7539 key"
    },
    {
        "input": "\u0000",
        "key": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f",
        "expected": "9",
        "description": "ChaCha20 single byte test (first keystream byte)"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ",
        "expected": "ö¸A/J°a1gÁâ>ú¢",
        "description": "ChaCha20 all-ones key test vector"
    }
],
    
    // Official ChaCha20 test vectors from RFC 7539 and reference implementations
    // Comprehensive test vectors with authoritative sources and validation data
    officialTestVectors: [
      // RFC 7539 ChaCha20 Test Vector 1 (Section 2.3.2)
      {
        algorithm: 'ChaCha20',
        description: 'RFC 7539 ChaCha20 Test Vector 1 (Section 2.3.2)',
        origin: 'IETF RFC 7539, Section 2.3.2',
        link: 'https://tools.ietf.org/rfc/rfc7539.txt',
        standard: 'RFC 7539',
        key: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f',
        keyHex: '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
        nonce: '\x00\x00\x00\x09\x00\x00\x00\x4a\x00\x00\x00\x00',
        nonceHex: '000000090000004a00000000',
        counter: 1,
        plaintext: 'Ladies and Gentlemen of the class of \'99: If I could offer you only one tip for the future, sunscreen would be it.',
        ciphertext: '\x6e\x2e\x35\x9a\x25\x68\xf9\x80\x41\xba\x07\x28\xdd\x0d\x69\x81\xe9\x7e\x7a\xec\x1d\x43\x60\xc2\x0a\x27\xaf\xcc\xfd\x9f\xae\x0b\xf9\x1b\x65\xc5\x52\x47\x33\xab\x8f\x59\x3d\xab\xcd\x62\xb3\x57\x16\x39\xd6\x24\xe6\x51\x52\xab\x8f\x53\x0c\x35\x9f\x08\x61\xd8\x07\xca\x0d\xbf\x50\x0d\x6a\x61\x56\xa3\x8e\x08\x8a\x22\xb6\x5e\x52\xbc\x51\x4d\x16\xcc\xf8\x06\x81\x8c\xe9\x1a\xb7\x79\x37\x36\x5a\xf9\x0b\xbf\x74\xa3\x5b\xe6\xb4\x0b\x8e\xed\xf2\x78\x5e\x42\x87\x4d',
        ciphertextHex: '6e2e359a2568f98041ba0728dd0d6981e97e7aec1d4360c20a27afccfd9fae0bf91b65c5524733ab8f593dabcd62b3571639d624e65152ab8f530c359f0861d807ca0dbf500d6a6156a38e088a22b65e52bc514d16ccf806818ce91ab77937365af90bbf74a35be6b40b8eedf2785e42874d',
        notes: 'Official RFC 7539 test vector demonstrating ChaCha20 encryption with full message',
        category: 'official-standard'
      },
      // RFC 7539 Quarter Round Test (Section 2.1.1)
      {
        algorithm: 'ChaCha20-QuarterRound',
        description: 'RFC 7539 Quarter Round Test (Section 2.1.1)',
        origin: 'IETF RFC 7539, Section 2.1.1',
        link: 'https://tools.ietf.org/rfc/rfc7539.txt',
        standard: 'RFC 7539',
        input: [0x11111111, 0x01020304, 0x9b8d6f43, 0x01234567],
        output: [0xea2a92f4, 0xcb1cf8ce, 0x4581472e, 0x5881c4bb],
        notes: 'Quarter round function test for internal ChaCha20 verification',
        category: 'internal-function'
      }
    ],
    
    // Reference links to authoritative sources and production implementations
    referenceLinks: {
      specifications: [
        {
          name: 'RFC 7539 - ChaCha20 and Poly1305 for IETF Protocols',
          url: 'https://tools.ietf.org/rfc/rfc7539.txt',
          description: 'Official IETF specification for ChaCha20 stream cipher'
        },
        {
          name: 'ChaCha, a variant of Salsa20 (Bernstein)',
          url: 'https://cr.yp.to/chacha/chacha-20080128.pdf',
          description: 'Original paper by Daniel J. Bernstein introducing ChaCha20'
        },
        {
          name: 'ChaCha20 Official Page (DJB)',
          url: 'https://cr.yp.to/chacha.html',
          description: 'Daniel J. Bernstein\'s official ChaCha page with reference implementations'
        }
      ],
      implementations: [
        {
          name: 'OpenSSL ChaCha20 Implementation',
          url: 'https://github.com/openssl/openssl/blob/master/crypto/chacha/',
          description: 'Production-quality ChaCha20 implementation from OpenSSL'
        },
        {
          name: 'libsodium ChaCha20 Implementation',
          url: 'https://github.com/jedisct1/libsodium/tree/master/src/libsodium/crypto_stream_chacha20',
          description: 'High-performance ChaCha20 implementation from libsodium'
        },
        {
          name: 'RustCrypto ChaCha20 Implementation',
          url: 'https://github.com/RustCrypto/stream-ciphers/tree/master/chacha20',
          description: 'Pure Rust implementation of ChaCha20 with comprehensive tests'
        }
      ],
      validation: [
        {
          name: 'RFC 7539 Test Vectors',
          url: 'https://tools.ietf.org/rfc/rfc7539.txt#section-2.4.2',
          description: 'Official test vectors from RFC 7539 specification'
        },
        {
          name: 'Project Wycheproof ChaCha20 Tests',
          url: 'https://github.com/google/wycheproof/tree/master/testvectors',
          description: 'Google\'s comprehensive ChaCha20 test vectors'
        }
      ]
    },
    
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // ChaCha20 constants
    CONSTANTS: [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574], // "expand 32-byte k"
    BLOCK_SIZE: 64,        // ChaCha20 generates 64-byte keystream blocks
    NONCE_SIZE: 12,        // RFC 7539 uses 12-byte nonces
    KEY_SIZE: 32,          // ChaCha20 uses 32-byte keys
    
    // Initialize cipher
    Init: function() {
      ChaCha20.isInitialized = true;
    },
    
    // Set up key and initialize ChaCha20 state
    KeySetup: function(key) {
      let id;
      do {
        id = 'ChaCha20[' + global.generateUniqueID() + ']';
      } while (ChaCha20.instances[id] || global.objectInstances[id]);
      
      ChaCha20.instances[szID] = new ChaCha20.ChaCha20Instance(key);
      global.objectInstances[szID] = true;
      return szID;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (ChaCha20.instances[id]) {
        // Clear sensitive data
        const instance = ChaCha20.instances[szID];
        if (instance.state && global.OpCodes) {
          global.OpCodes.ClearArray(instance.state);
        }
        if (instance.keyBytes && global.OpCodes) {
          global.OpCodes.ClearArray(instance.keyBytes);
        }
        delete ChaCha20.instances[szID];
        delete global.objectInstances[szID];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'ChaCha20', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, szPlainText) {
      if (!ChaCha20.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'ChaCha20', 'encryptBlock');
        return szPlainText;
      }
      
      const instance = ChaCha20.instances[szID];
      let result = '';
      
      for (let n = 0; n < szPlainText.length; n++) {
        const keystreamByte = instance.getNextKeystreamByte();
        const plaintextByte = szPlainText.charCodeAt(n) & 0xFF;
        const ciphertextByte = plaintextByte ^ keystreamByte;
        szResult += String.fromCharCode(ciphertextByte);
      }
      
      return szResult;
    },
    
    // Decrypt block (same as encrypt for stream cipher)
    decryptBlock: function(id, szCipherText) {
      // For stream ciphers, decryption is identical to encryption
      return ChaCha20.encryptBlock(id, szCipherText);
    },
    
    // ChaCha20 Instance class
    ChaCha20Instance: function(key, nonce, counter) {
      this.keyBytes = [];          // Store key as byte array
      this.nonce = [];             // Store nonce as byte array
      this.counter = counter || 0; // Block counter (32-bit)
      this.state = new Array(16);  // ChaCha20 state (16 32-bit words)
      this.keystreamBuffer = [];   // Buffer for generated keystream
      this.keystreamPosition = 0;  // Current position in keystream buffer
      
      // Process key input
      if (typeof key === 'string') {
        // Convert string to bytes
        for (let k = 0; k < key.length && this.keyBytes.length < ChaCha20.KEY_SIZE; k++) {
          this.keyBytes.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        // Copy array (up to KEY_SIZE bytes)
        for (let k = 0; k < key.length && this.keyBytes.length < ChaCha20.KEY_SIZE; k++) {
          this.keyBytes.push(key[k] & 0xFF);
        }
      } else {
        throw new Error('ChaCha20 key must be string or byte array');
      }
      
      // Pad key to required length if necessary
      while (this.keyBytes.length < ChaCha20.KEY_SIZE) {
        this.keyBytes.push(0);
      }
      
      // Process nonce (default to zero nonce if not provided)
      if (nonce) {
        if (typeof nonce === 'string') {
          for (let n = 0; n < nonce.length && this.nonce.length < ChaCha20.NONCE_SIZE; n++) {
            this.nonce.push(nonce.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(nonce)) {
          for (let n = 0; n < nonce.length && this.nonce.length < ChaCha20.NONCE_SIZE; n++) {
            this.nonce.push(nonce[n] & 0xFF);
          }
        }
      }
      
      // Pad nonce to required length
      while (this.nonce.length < ChaCha20.NONCE_SIZE) {
        this.nonce.push(0);
      }
      
      // Initialize state
      this.initializeState();
    }
  };
  
  // Add methods to ChaCha20Instance prototype
  ChaCha20.ChaCha20Instance.prototype = {
    
    /**
     * Initialize the ChaCha20 state array
     * State layout (16 32-bit words):
     * 0-3:   Constants "expand 32-byte k"
     * 4-11:  256-bit key (8 words)
     * 12:    32-bit counter
     * 13-15: 96-bit nonce (3 words)
     */
    initializeState: function() {
      // Constants (words 0-3)
      for (let i = 0; i < 4; i++) {
        this.state[i] = ChaCha20.CONSTANTS[i];
      }
      
      // Key (words 4-11) - convert bytes to little-endian words
      for (let i = 0; i < 8; i++) {
        const offset = i * 4;
        this.state[4 + i] = global.OpCodes.Pack32LE(
          this.keyBytes[offset],
          this.keyBytes[offset + 1],
          this.keyBytes[offset + 2],
          this.keyBytes[offset + 3]
        );
      }
      
      // Counter (word 12)
      this.state[12] = this.counter;
      
      // Nonce (words 13-15) - convert bytes to little-endian words
      for (let i = 0; i < 3; i++) {
        const offset = i * 4;
        this.state[13 + i] = global.OpCodes.Pack32LE(
          this.nonce[offset],
          this.nonce[offset + 1],
          this.nonce[offset + 2],
          this.nonce[offset + 3]
        );
      }
    },
    
    /**
     * ChaCha20 quarter-round operation
     * Operates on 4 words of the state: (a, b, c, d)
     * @param {Array} state - Working state array
     * @param {number} a - Index of first word
     * @param {number} b - Index of second word  
     * @param {number} c - Index of third word
     * @param {number} d - Index of fourth word
     */
    quarterRound: function(state, a, b, c, d) {
      // a += b; d ^= a; d <<<= 16;
      state[a] = (state[a] + state[b]) >>> 0;
      state[d] ^= state[a];
      state[d] = global.OpCodes.RotL32(state[d], 16);
      
      // c += d; b ^= c; b <<<= 12;
      state[c] = (state[c] + state[d]) >>> 0;
      state[b] ^= state[c];
      state[b] = global.OpCodes.RotL32(state[b], 12);
      
      // a += b; d ^= a; d <<<= 8;
      state[a] = (state[a] + state[b]) >>> 0;
      state[d] ^= state[a];
      state[d] = global.OpCodes.RotL32(state[d], 8);
      
      // c += d; b ^= c; b <<<= 7;
      state[c] = (state[c] + state[d]) >>> 0;
      state[b] ^= state[c];
      state[b] = global.OpCodes.RotL32(state[b], 7);
    },
    
    /**
     * Generate a 64-byte block of keystream
     * @returns {Array} 64 bytes of keystream
     */
    generateBlock: function() {
      // Create working copy of state
      const workingState = this.state.slice(0);
      
      // Perform 20 rounds (10 double-rounds)
      for (let round = 0; round < 10; round++) {
        // Odd round: column operations
        this.quarterRound(workingState, 0, 4, 8, 12);
        this.quarterRound(workingState, 1, 5, 9, 13);
        this.quarterRound(workingState, 2, 6, 10, 14);
        this.quarterRound(workingState, 3, 7, 11, 15);
        
        // Even round: diagonal operations
        this.quarterRound(workingState, 0, 5, 10, 15);
        this.quarterRound(workingState, 1, 6, 11, 12);
        this.quarterRound(workingState, 2, 7, 8, 13);
        this.quarterRound(workingState, 3, 4, 9, 14);
      }
      
      // Add original state to working state
      for (let i = 0; i < 16; i++) {
        workingState[i] = (workingState[i] + this.state[i]) >>> 0;
      }
      
      // Convert words to bytes (little-endian)
      const keystream = [];
      for (let i = 0; i < 16; i++) {
        const bytes = global.OpCodes.Unpack32LE(workingState[i]);
        keystream.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }
      
      // Increment counter for next block
      this.counter = (this.counter + 1) >>> 0;
      this.state[12] = this.counter;
      
      return keystream;
    },
    
    /**
     * Get the next keystream byte
     * @returns {number} Next keystream byte (0-255)
     */
    getNextKeystreamByte: function() {
      // Check if we need to generate a new block
      if (this.keystreamPosition >= this.keystreamBuffer.length) {
        this.keystreamBuffer = this.generateBlock();
        this.keystreamPosition = 0;
      }
      
      return this.keystreamBuffer[this.keystreamPosition++];
    },
    
    /**
     * Reset the cipher to initial state with optional new nonce/counter
     * @param {Array|string} newNonce - Optional new nonce
     * @param {number} newCounter - Optional new counter value
     */
    reset: function(newNonce, newCounter) {
      if (newNonce !== undefined) {
        this.nonce = [];
        if (typeof newNonce === 'string') {
          for (let n = 0; n < newNonce.length && this.nonce.length < ChaCha20.NONCE_SIZE; n++) {
            this.nonce.push(newNonce.charCodeAt(n) & 0xFF);
          }
        } else if (Array.isArray(newNonce)) {
          for (let n = 0; n < newNonce.length && this.nonce.length < ChaCha20.NONCE_SIZE; n++) {
            this.nonce.push(newNonce[n] & 0xFF);
          }
        }
        // Pad nonce to required length
        while (this.nonce.length < ChaCha20.NONCE_SIZE) {
          this.nonce.push(0);
        }
      }
      
      if (newCounter !== undefined) {
        this.counter = newCounter >>> 0;
      } else {
        this.counter = 0;
      }
      
      this.keystreamBuffer = [];
      this.keystreamPosition = 0;
      this.initializeState();
    },
    
    /**
     * Set a new nonce for the cipher
     * @param {Array|string} newNonce - New nonce value
     */
    setNonce: function(newNonce) {
      this.reset(newNonce, 0);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(ChaCha20);
  }
  
  // Export to global scope
  global.ChaCha20 = ChaCha20;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChaCha20;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);