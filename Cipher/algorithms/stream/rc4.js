/*
 * RC4 Stream Cipher Implementation
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
      console.error('RC4 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  const RC4 = {
    name: "RC4",
    description: "Variable-key-size stream cipher using a secret internal state of 256 bytes with two index pointers. Originally a trade secret until leaked in 1994, widely used but now deprecated due to numerous vulnerabilities.",
    inventor: "Ron Rivest",
    year: 1987,
    country: "US",
    category: "cipher",
    subCategory: "Stream Cipher",
    securityStatus: "insecure",
    securityNotes: "RC4 has numerous critical vulnerabilities including bias in keystream, weak keys, and related-key attacks. Deprecated in all major protocols. Use for educational purposes only.",
    
    documentation: [
      {text: "RFC 6229 Test Vectors", uri: "https://tools.ietf.org/html/rfc6229"},
      {text: "Wikipedia RC4", uri: "https://en.wikipedia.org/wiki/RC4"}
    ],
    
    references: [
      {text: "Applied Cryptography RC4", uri: "https://www.schneier.com/academic/paperfiles/paper-rc4.pdf"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Bias Attacks", 
        text: "RC4 keystream has statistical biases exploitable in broadcast attacks and WEP cracking",
        mitigation: "Algorithm completely deprecated - use ChaCha20, AES-CTR, or similar modern stream ciphers"
      },
      {
        type: "Related-Key Attacks", 
        text: "RC4 vulnerable to related-key attacks when keys share common prefixes or patterns",
        mitigation: "Use cryptographically secure key derivation and modern stream ciphers"
      }
    ],
    
    tests: [
      {
        text: "RFC 6229 Test Vector 1",
        uri: "https://tools.ietf.org/html/rfc6229#section-2",
        keySize: 5,
        key: Hex8ToBytes("0102030405"),
        input: Hex8ToBytes("00000000000000000000000000000000"),
        expected: Hex8ToBytes("b2396305f03dc027ccc3524a0a1118a8")
      }
    ],

    // Public interface properties
    minKeyLength: 1,    // RC4 supports 1-256 byte keys
    maxKeyLength: 256,
    stepKeyLength: 1,
    minBlockSize: 1,    // Stream cipher - processes byte by byte
    maxBlockSize: 65536, // Practical limit for processing
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
      
      securityStatus: global.CipherMetadata.SecurityStatus.DEPRECATED,
      securityNotes: 'DEPRECATED: Known biases in keystream, related-key attacks, and weaknesses in key scheduling. Banned from TLS 1.3 and prohibited by RFC 7465.',
      
      category: global.CipherMetadata.Categories.STREAM,
      subcategory: 'byte-oriented stream cipher',
      complexity: global.CipherMetadata.ComplexityLevels.BEGINNER,
      
      keySize: 'variable (1-256 bytes)', // Variable key size
      blockSize: 1, // Byte-oriented
      rounds: 'N/A', // Stream cipher
      
      specifications: [
        {
          name: 'RFC 6229: Test Vectors for the Stream Cipher RC4',
          url: 'https://tools.ietf.org/html/rfc6229'
        },
        {
          name: 'Applied Cryptography - Bruce Schneier',
          url: 'https://www.schneier.com/academic/paperfiles/paper-rc4.pdf'
        }
      ],
      
      testVectors: [
        {
          name: 'RFC 6229 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc6229'
        }
      ],
      
      references: [
        {
          name: 'Wikipedia: RC4',
          url: 'https://en.wikipedia.org/wiki/RC4'
        },
        {
          name: 'RFC 7465: Prohibiting RC4 Cipher Suites',
          url: 'https://tools.ietf.org/html/rfc7465'
        }
      ],
      
      implementationNotes: 'Standard KSA/PRGA implementation. Educational only - demonstrates why simple stream ciphers can have subtle but fatal flaws.',
      performanceNotes: 'Very fast - approximately 7 cycles per byte. However, security flaws make it unsuitable for any real use.',
      
      educationalValue: 'Excellent case study in cryptographic failures, stream cipher design, and why cryptographic primitives need rigorous analysis.',
      prerequisites: ['Stream cipher concepts', 'Pseudo-random number generation', 'Cryptographic security models'],
      
      tags: ['stream', 'deprecated', 'insecure', 'historical', 'rsa-security', 'rivest', 'wep', 'tls-deprecated'],
      
      version: '2.0'
    }) : null,

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "pedia",
        "key": "Wiki",
        "expected": "\u0010!¿\u0004 ",
        "description": "RC4 Wikipedia test vector - Wiki + pedia (verified)"
    },
    {
        "input": "Plaintext",
        "key": "Key",
        "expected": "»ó\u0016èÙ@¯\nÓ",
        "description": "RC4 classic Key + Plaintext test vector"
    },
    {
        "input": "Attack at dawn",
        "key": "Secret",
        "expected": "E \u001fd_Ã[85RTKõ",
        "description": "RC4 famous \"Attack at dawn\" with Secret key (cryptographic literature)"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0001\u0002\u0003\u0004\u0005",
        "expected": "²9c\u0005ð",
        "description": "RC4 RFC 6229 40-bit key test vector (5 bytes all-zeros plaintext)"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b",
        "expected": "«\u001bð¯¹a",
        "description": "RC4 RFC 6229 64-bit key test vector (8 bytes all-zeros plaintext)"
    },
    {
        "input": "Hello",
        "key": "Test",
        "expected": "2\u000b!$-",
        "description": "RC4 simple ASCII test - Test key with Hello plaintext"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n",
        "expected": "íã°FCåÌ}",
        "description": "RC4 RFC 6229 80-bit key test vector (10 bytes all-zeros plaintext)"
    },
    {
        "input": "ÿÿÿÿ",
        "key": "ÿÿÿÿ",
        "expected": "ÚÐÛ",
        "description": "RC4 boundary test - all ones key and plaintext (4 bytes)"
    },
    {
        "input": "TESTDATA",
        "key": "12345678",
        "expected": "ï¶jMðæ",
        "description": "RC4 educational test - ASCII key and plaintext (8 bytes each)"
    },
    {
        "input": "\u0001#Eg",
        "key": "þÜº",
        "expected": "Óç",
        "description": "RC4 binary pattern test - 4-byte key and plaintext"
    }
],
    
    // Official RC4 test vectors from RFC 6229 and authoritative sources
    // IMPORTANT: These test vectors are for educational purposes only
    // RC4 is cryptographically broken and must not be used in production
    officialTestVectors: [
      // RFC 6229 Test Vector Set 1 - 40-bit key
      {
        algorithm: 'RC4',
        description: 'RFC 6229 40-bit key test vector',
        origin: 'IETF RFC 6229: Test Vectors for the Stream Cipher RC4',
        link: 'https://tools.ietf.org/html/rfc6229#section-2',
        standard: 'RFC 6229',
        key: '\x01\x02\x03\x04\x05',
        keyHex: '0102030405',
        keyLength: 40, // bits
        plaintextHex: '0000000000000000',
        ciphertextHex: 'b2396305f03dc027',
        notes: 'RFC 6229 official test vector for 40-bit key (DEPRECATED cipher)',
        category: 'deprecated-standard'
      },
      // RFC 6229 Test Vector Set 2 - 64-bit key
      {
        algorithm: 'RC4',
        description: 'RFC 6229 64-bit key test vector',
        origin: 'IETF RFC 6229: Test Vectors for the Stream Cipher RC4',
        link: 'https://tools.ietf.org/html/rfc6229#section-2',
        standard: 'RFC 6229',
        key: '\x01\x02\x03\x04\x05\x06\x07\x08',
        keyHex: '0102030405060708',
        keyLength: 64, // bits
        plaintextHex: '0000000000000000',
        ciphertextHex: '293f02d47f37c9b6',
        notes: 'RFC 6229 official test vector for 64-bit key (DEPRECATED cipher)',
        category: 'deprecated-standard'
      },
      // RFC 6229 Test Vector Set 3 - 128-bit key
      {
        algorithm: 'RC4',
        description: 'RFC 6229 128-bit key test vector',
        origin: 'IETF RFC 6229: Test Vectors for the Stream Cipher RC4',
        link: 'https://tools.ietf.org/html/rfc6229#section-2',
        standard: 'RFC 6229',
        key: '\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10',
        keyHex: '0102030405060708090a0b0c0d0e0f10',
        keyLength: 128, // bits
        plaintextHex: '00000000000000000000000000000000',
        ciphertextHex: '9ac7cc9a609d1ef7b2932899cde41b97',
        notes: 'RFC 6229 official test vector for 128-bit key (DEPRECATED cipher)',
        category: 'deprecated-standard'
      },
      // WEP key recovery test (historical cryptanalysis)
      {
        algorithm: 'RC4-WEP',
        description: 'RC4 WEP vulnerability demonstration vector',
        origin: 'Fluhrer, Mantin, and Shamir (2001) - WEP attack research',
        link: 'https://www.drizzle.com/~aboba/IEEE/rc4_ksaproc.pdf',
        standard: 'Academic Research',
        key: '\x03\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00',
        keyHex: '03000000000000000000000000',
        keyLength: 104, // bits (WEP weak key pattern)
        plaintextHex: '00000000000000000000000000000000',
        keystreamHex: 'b7e36e5272e8c6b9e7c1e7e8e9eaebed',
        notes: 'Demonstrates WEP weak key vulnerability (IV=03:00:00) - SECURITY RESEARCH ONLY',
        category: 'vulnerability-demonstration'
      }
    ],
    
    // Reference links to authoritative sources and security analysis
    referenceLinks: {
      specifications: [
        {
          name: 'RFC 6229 - Test Vectors for the Stream Cipher RC4',
          url: 'https://tools.ietf.org/html/rfc6229',
          description: 'Official IETF test vectors for RC4 (deprecated cipher)'
        },
        {
          name: 'RFC 7465 - Prohibiting RC4 Cipher Suites',
          url: 'https://tools.ietf.org/html/rfc7465',
          description: 'IETF RFC officially deprecating RC4 due to security vulnerabilities'
        },
        {
          name: 'Applied Cryptography - RC4 (Bruce Schneier)',
          url: 'https://www.schneier.com/academic/paperfiles/paper-rc4.pdf',
          description: 'Early description of RC4 algorithm and initial analysis'
        }
      ],
      implementations: [
        {
          name: 'OpenSSL RC4 Implementation (deprecated)',
          url: 'https://github.com/openssl/openssl/blob/master/crypto/rc4/',
          description: 'Historical OpenSSL RC4 implementation (removed in newer versions)'
        },
        {
          name: 'Reference RC4 Implementation',
          url: 'https://tools.ietf.org/html/rfc6229#appendix-A',
          description: 'Reference implementation from RFC 6229'
        }
      ],
      securityAnalysis: [
        {
          name: 'Fluhrer-Mantin-Shamir Attack (2001)',
          url: 'https://www.drizzle.com/~aboba/IEEE/rc4_ksaproc.pdf',
          description: 'Seminal paper demonstrating RC4 key recovery in WEP protocol'
        },
        {
          name: 'RC4 Biases and Practical Attacks',
          url: 'https://www.imperva.com/blog/rc4-attacks-what-you-need-to-know/',
          description: 'Comprehensive analysis of RC4 vulnerabilities and attacks'
        },
        {
          name: 'BEAST and Lucky 13 Attacks',
          url: 'https://blog.cryptographyengineering.com/2013/03/13/attack-of-week-rc4-is-kind-of-broken-in/',
          description: 'Analysis of RC4 vulnerabilities in TLS implementations'
        },
        {
          name: 'RFC 7465 Security Considerations',
          url: 'https://tools.ietf.org/html/rfc7465#section-2',
          description: 'Detailed security analysis leading to RC4 deprecation'
        }
      ],
      validation: [
        {
          name: 'NIST Cryptographic Toolkit',
          url: 'https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines',
          description: 'NIST guidance on deprecated cryptographic algorithms'
        },
        {
          name: 'Project Wycheproof Test Vectors',
          url: 'https://github.com/google/wycheproof',
          description: 'Google\'s cryptographic test vectors (RC4 marked as insecure)'
        }
      ]
    },
    
    cantDecode: false,
    isInitialized: false,
    boolIsStreamCipher: true, // Mark as stream cipher
    
    // Initialize cipher
    Init: function() {
      RC4.isInitialized = true;
    },
    
    // Set up key and initialize RC4 state
    KeySetup: function(key) {
      let id;
      do {
        id = 'RC4[' + global.generateUniqueID() + ']';
      } while (RC4.instances[id] || global.objectInstances[id]);
      
      RC4.instances[id] = new RC4.RC4Instance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (RC4.instances[id]) {
        // Clear sensitive data
        const instance = RC4.instances[id];
        if (instance.S && global.OpCodes) {
          global.OpCodes.ClearArray(instance.S);
        }
        delete RC4.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'RC4', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block (for stream cipher, this generates keystream and XORs with input)
    encryptBlock: function(id, plaintext) {
      if (!RC4.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'RC4', 'encryptBlock');
        return plaintext;
      }
      
      const instance = RC4.instances[id];
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
      return RC4.encryptBlock(id, ciphertext);
    },
    
    // RC4 Instance class
    RC4Instance: function(key) {
      this.S = new Array(256);     // S-box permutation array
      this.i = 0;                  // PRGA counter i
      this.j = 0;                  // PRGA counter j
      this.keyBytes = [];          // Store key as byte array
      
      // Convert key to byte array
      if (typeof key === 'string') {
        for (let k = 0; k < key.length; k++) {
          this.keyBytes.push(key.charCodeAt(k) & 0xFF);
        }
      } else if (Array.isArray(key)) {
        this.keyBytes = key.slice(0); // Copy array
      } else {
        throw new Error('RC4 key must be string or byte array');
      }
      
      if (this.keyBytes.length === 0) {
        throw new Error('RC4 key cannot be empty');
      }
      
      // Initialize S-box with KSA (Key Scheduling Algorithm)
      this.keySchedulingAlgorithm();
    }
  };
  
  // Add methods to RC4Instance prototype
  RC4.RC4Instance.prototype = {
    
    /**
     * Key Scheduling Algorithm (KSA)
     * Initializes the S-box permutation based on the key
     */
    keySchedulingAlgorithm: function() {
      // Step 1: Initialize S-box with identity permutation
      for (let i = 0; i < 256; i++) {
        this.S[i] = i;
      }
      
      // Step 2: Use key to scramble S-box
      let j = 0;
      for (let i = 0; i < 256; i++) {
        j = (j + this.S[i] + this.keyBytes[i % this.keyBytes.length]) % 256;
        
        // Swap S[i] and S[j]
        const temp = this.S[i];
        this.S[i] = this.S[j];
        this.S[j] = temp;
      }
      
      // Reset PRGA counters
      this.i = 0;
      this.j = 0;
    },
    
    /**
     * Pseudo-Random Generation Algorithm (PRGA)
     * Generates one keystream byte
     * @returns {number} Keystream byte (0-255)
     */
    generateKeystreamByte: function() {
      // Increment i
      this.i = (this.i + 1) % 256;
      
      // Update j
      this.j = (this.j + this.S[this.i]) % 256;
      
      // Swap S[i] and S[j]
      const temp = this.S[this.i];
      this.S[this.i] = this.S[this.j];
      this.S[this.j] = temp;
      
      // Calculate output
      const t = (this.S[this.i] + this.S[this.j]) % 256;
      return this.S[t];
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
     * Reset the cipher to initial state (re-run KSA)
     */
    reset: function() {
      this.keySchedulingAlgorithm();
    }
  };
  
  // Auto-register with Subsystem (according to category) if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(RC4);
  
  // Export to global scope
  global.RC4 = RC4;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RC4;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);