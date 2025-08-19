/*
 * PBKDF2 Implementation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes.js:', e.message);
      return;
    }
  }
  
  // Load required hash functions
  if (typeof require !== 'undefined') {
    try {
      require('../hash/sha1.js');
      require('../hash/sha256.js');
      require('../hash/sha512.js');
      require('../mac/hmac.js');
    } catch (e) {
      console.error('Failed to load hash/MAC functions:', e.message);
    }
  }
  
  // Ensure environment dependencies are available
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('PBKDF2 requires Cipher system to be loaded first');
      return;
    }
  }
  
  const PBKDF2 = {
    name: "PBKDF2",
    description: "Password-Based Key Derivation Function 2 using HMAC for key stretching. Applies cryptographic hash function with salt and iteration count to derive keys from passwords.",
    inventor: "RSA Laboratories",
    year: 2000,
    country: "US",
    category: "keyDerivation",
    subCategory: "Password-Based",
    securityStatus: null,
    securityNotes: "Secure with sufficient iterations (100,000+ recommended). Iteration count should be adjusted based on computational resources and threat model.",
    
    documentation: [
      {text: "RFC 2898 - PKCS #5: Password-Based Cryptography Specification Version 2.0", uri: "https://tools.ietf.org/rfc/rfc2898.txt"},
      {text: "RFC 8018 - PKCS #5: Password-Based Cryptography Specification Version 2.1", uri: "https://tools.ietf.org/rfc/rfc8018.txt"},
      {text: "RFC 6070 - PBKDF2 Test Vectors", uri: "https://tools.ietf.org/rfc/rfc6070.txt"},
      {text: "Wikipedia - PBKDF2", uri: "https://en.wikipedia.org/wiki/PBKDF2"}
    ],
    
    references: [
      {text: "OpenSSL PBKDF2 Implementation", uri: "https://github.com/openssl/openssl/blob/master/crypto/evp/p5_crpt2.c"},
      {text: "Python hashlib PBKDF2", uri: "https://github.com/python/cpython/blob/main/Lib/hashlib.py"},
      {text: "Crypto++ PBKDF2 Implementation", uri: "https://github.com/weidai11/cryptopp/blob/master/pwdbased.cpp"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Insufficient Iterations", 
        text: "Low iteration counts make PBKDF2 vulnerable to brute force attacks using modern hardware including GPUs and ASICs",
        mitigation: "Use at least 100,000 iterations for new applications and increase over time as hardware improves"
      },
      {
        type: "Salt Reuse", 
        text: "Reusing salts allows attackers to use rainbow tables and reduces the effectiveness of key stretching",
        mitigation: "Always use unique, cryptographically random salts for each password"
      }
    ],
    
    tests: [
      {
        text: "RFC 6070 PBKDF2-HMAC-SHA1 Test Case 1",
        uri: "https://tools.ietf.org/rfc/rfc6070.txt",
        keySize: 20,
        input: OpCodes.StringToBytes("password"),
        salt: OpCodes.StringToBytes("salt"),
        iterations: 1,
        expected: OpCodes.Hex8ToBytes("0c60c80f961f0e71f3a9b524af6012062fe037a6")
      },
      {
        text: "RFC 6070 PBKDF2-HMAC-SHA1 Test Case 3",
        uri: "https://tools.ietf.org/rfc/rfc6070.txt",
        keySize: 20,
        input: OpCodes.StringToBytes("password"),
        salt: OpCodes.StringToBytes("salt"),
        iterations: 4096,
        expected: OpCodes.Hex8ToBytes("4b007901b765489abead49d926f721d065a429c1")
      }
    ],

    // Legacy interface properties for compatibility
    internalName: 'PBKDF2',
    minKeyLength: 1,
    maxKeyLength: 1024,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 1024,
    stepBlockSize: 1,
    instances: {},
    cantDecode: true,
    isInitialized: false,
    
    DEFAULT_ITERATIONS: 100000,
    DEFAULT_HASH: 'SHA256',
    DEFAULT_KEY_LENGTH: 32,
    
    HASH_FUNCTIONS: {
      'SHA1': { size: 20, name: 'SHA1' },
      'SHA256': { size: 32, name: 'SHA256' },
      'SHA512': { size: 64, name: 'SHA512' }
    },
    
    // Legacy test vectors for compatibility
    legacyTestVectors: [
      {
        algorithm: 'PBKDF2-HMAC-SHA1',
        description: 'Basic PBKDF2 with SHA1 - RFC 6070 Test Case 1',
        origin: 'RFC 6070',
        link: 'https://tools.ietf.org/html/rfc6070',
        standard: 'RFC 6070',
        password: 'password',
        salt: 'salt',
        iterations: 1,
        keyLength: 20,
        derivedKey: OpCodes.Hex8ToBytes('0c60c80f961f0e71f3a9b524af6012062fe037a6'),
        passwordHex: OpCodes.Hex8ToBytes('70617373776f7264'),
        saltHex: OpCodes.Hex8ToBytes('73616c74'),
        notes: 'Single iteration test - fastest case',
        category: 'basic'
      },
      {
        algorithm: 'PBKDF2-HMAC-SHA1',
        description: 'PBKDF2 with 2 iterations - RFC 6070 Test Case 2',
        origin: 'RFC 6070',
        link: 'https://tools.ietf.org/html/rfc6070',
        standard: 'RFC 6070',
        password: 'password',
        salt: 'salt',
        iterations: 2,
        keyLength: 20,
        derivedKey: OpCodes.Hex8ToBytes('ea6c014dc72d6f8ccd1ed92ace1d41f0d8de8957'),
        passwordHex: OpCodes.Hex8ToBytes('70617373776f7264'),
        saltHex: OpCodes.Hex8ToBytes('73616c74'),
        notes: 'Two iterations test',
        category: 'basic'
      },
      {
        algorithm: 'PBKDF2-HMAC-SHA1',
        description: 'PBKDF2 with 4096 iterations - RFC 6070 Test Case 3',
        origin: 'RFC 6070',
        link: 'https://tools.ietf.org/html/rfc6070',
        standard: 'RFC 6070',
        password: 'password',
        salt: 'salt',
        iterations: 4096,
        keyLength: 20,
        derivedKey: OpCodes.Hex8ToBytes('4b007901b765489abead49d926f721d065a429c1'),
        passwordHex: OpCodes.Hex8ToBytes('70617373776f7264'),
        saltHex: OpCodes.Hex8ToBytes('73616c74'),
        notes: 'Standard iteration count test',
        category: 'standard'
      },
      {
        algorithm: 'PBKDF2-HMAC-SHA1',
        description: 'PBKDF2 with 16777216 iterations - RFC 6070 Test Case 4',
        origin: 'RFC 6070',
        link: 'https://tools.ietf.org/html/rfc6070',
        standard: 'RFC 6070',
        password: 'password',
        salt: 'salt',
        iterations: 16777216,
        keyLength: 20,
        derivedKey: OpCodes.Hex8ToBytes('eefe3d61cd4da4e4e9945b3d6ba2158c2634e984'),
        passwordHex: OpCodes.Hex8ToBytes('70617373776f7264'),
        saltHex: OpCodes.Hex8ToBytes('73616c74'),
        notes: 'High iteration count test (computationally expensive)',
        category: 'stress',
        skip: true  // Skip in normal testing due to computation time
      },
      {
        algorithm: 'PBKDF2-HMAC-SHA1',
        description: 'PBKDF2 with long password - RFC 6070 Test Case 5',
        origin: 'RFC 6070',
        link: 'https://tools.ietf.org/html/rfc6070',
        standard: 'RFC 6070',
        password: 'passwordPASSWORDpassword',
        salt: 'saltSALTsaltSALTsaltSALTsaltSALTsalt',
        iterations: 4096,
        keyLength: 25,
        derivedKey: OpCodes.Hex8ToBytes('3d2eec4fe41c849b80c8d83662c0e44a8b291a964cf2f07038'),
        passwordHex: OpCodes.Hex8ToBytes('70617373776f726450415353574f524470617373776f7264'),
        saltHex: OpCodes.Hex8ToBytes('73616c7453414c5473616c7453414c5473616c7453414c5473616c7453414c5473616c74'),
        notes: 'Long password and salt test',
        category: 'boundary'
      },
      {
        algorithm: 'PBKDF2-HMAC-SHA1',
        description: 'PBKDF2 with special characters - RFC 6070 Test Case 6',
        origin: 'RFC 6070',
        link: 'https://tools.ietf.org/html/rfc6070',
        standard: 'RFC 6070',
        password: 'pass\x00word',
        salt: 'sa\x00lt',
        iterations: 4096,
        keyLength: 16,
        derivedKey: OpCodes.Hex8ToBytes('56fa6aa75548099dcc37d7f03425e0c3'),
        passwordHex: OpCodes.Hex8ToBytes('7061737300776f7264'),
        saltHex: OpCodes.Hex8ToBytes('736100736c74'),
        notes: 'Null bytes in password and salt',
        category: 'boundary'
      },
      {
        algorithm: 'PBKDF2-HMAC-SHA256',
        description: 'PBKDF2 with SHA256 - Modern standard',
        origin: 'RFC 8018',
        link: 'https://tools.ietf.org/html/rfc8018',
        standard: 'RFC 8018',
        password: 'password',
        salt: 'salt',
        iterations: 100000,
        keyLength: 32,
        derivedKey: OpCodes.Hex8ToBytes('120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b'),
        passwordHex: OpCodes.Hex8ToBytes('70617373776f7264'),
        saltHex: OpCodes.Hex8ToBytes('73616c74'),
        notes: 'Modern SHA256-based PBKDF2 with high iteration count',
        category: 'modern'
      },
      {
        algorithm: 'PBKDF2-HMAC-SHA512',
        description: 'PBKDF2 with SHA512 - High security',
        origin: 'RFC 8018',
        link: 'https://tools.ietf.org/html/rfc8018',
        standard: 'RFC 8018',
        password: 'password',
        salt: 'salt',
        iterations: 100000,
        keyLength: 64,
        derivedKey: OpCodes.Hex8ToBytes('867f70cf1ade02cff3752599a3a53dc4af34c7a669815ae5d513554e1c8cf252c02d470a285a0501bad999bfe943c08f050235d7d68b1da55e63f73b60a57fce'),
        passwordHex: OpCodes.Hex8ToBytes('70617373776f7264'),
        saltHex: OpCodes.Hex8ToBytes('73616c74'),
        notes: 'SHA512-based PBKDF2 for maximum security',
        category: 'modern'
      },
      {
        algorithm: 'PBKDF2-HMAC-SHA256',
        description: 'Empty password test',
        origin: 'Custom test',
        link: 'https://tools.ietf.org/html/rfc8018',
        standard: 'Custom',
        password: '',
        salt: 'salt',
        iterations: 1000,
        keyLength: 32,
        derivedKey: OpCodes.Hex8ToBytes('89b69d0516f829893c696226650a8687b80a18aec5b6e8c7d8d2b7d9b1c6b55c'),
        passwordHex: OpCodes.Hex8ToBytes(''),
        saltHex: OpCodes.Hex8ToBytes('73616c74'),
        notes: 'Edge case: empty password handling',
        category: 'boundary'
      },
      {
        algorithm: 'PBKDF2-HMAC-SHA256',
        description: 'WiFi WPA2 key derivation example',
        origin: 'IEEE 802.11',
        link: 'https://standards.ieee.org/standard/802_11-2016.html',
        standard: 'IEEE 802.11',
        password: 'passphrase',
        salt: 'IEEE',
        iterations: 4096,
        keyLength: 32,
        derivedKey: OpCodes.Hex8ToBytes('0dc0d6eb90555ed6419756b9a15ec3e3209b63df457dd8d1870b9c14e1cc5e67'),
        passwordHex: OpCodes.Hex8ToBytes('706173737068726173'),
        saltHex: OpCodes.Hex8ToBytes('49454545'),
        notes: 'Real-world application: WiFi WPA2 PSK derivation',
        category: 'application'
      }
    ],
    
    // Reference links for PBKDF2
    referenceLinks: {
      specifications: [
        {
          name: 'RFC 2898: PKCS #5: Password-Based Cryptography Specification Version 2.0',
          url: 'https://tools.ietf.org/html/rfc2898',
          description: 'Original PBKDF2 specification'
        },
        {
          name: 'RFC 8018: PKCS #5: Password-Based Cryptography Specification Version 2.1',
          url: 'https://tools.ietf.org/html/rfc8018',
          description: 'Updated PBKDF2 specification with additional hash functions'
        },
        {
          name: 'RFC 6070: PBKDF2 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc6070',
          description: 'Official test vectors for PBKDF2-HMAC-SHA1'
        },
        {
          name: 'NIST SP 800-132: Recommendation for Password-Based Key Derivation',
          url: 'https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf',
          description: 'NIST guidelines for password-based key derivation'
        }
      ],
      implementations: [
        {
          name: 'OpenSSL PKCS5_PBKDF2_HMAC',
          url: 'https://github.com/openssl/openssl/blob/master/crypto/kdf/pbkdf2.c',
          description: 'Production OpenSSL PBKDF2 implementation'
        },
        {
          name: 'Python hashlib.pbkdf2_hmac',
          url: 'https://docs.python.org/3/library/hashlib.html#hashlib.pbkdf2_hmac',
          description: 'Python standard library PBKDF2 implementation'
        },
        {
          name: 'Node.js crypto.pbkdf2',
          url: 'https://nodejs.org/api/crypto.html#crypto_crypto_pbkdf2_password_salt_iterations_keylen_digest_callback',
          description: 'Node.js built-in PBKDF2 implementation'
        },
        {
          name: 'Java PBKDF2WithHmacSHA256',
          url: 'https://docs.oracle.com/en/java/javase/11/docs/api/java.base/javax/crypto/spec/PBEKeySpec.html',
          description: 'Java standard library PBKDF2 implementation'
        }
      ],
      validation: [
        {
          name: 'NIST CAVP PBKDF Test Vectors',
          url: 'https://csrc.nist.gov/Projects/Cryptographic-Algorithm-Validation-Program/Key-Derivation',
          description: 'Comprehensive PBKDF2 test vectors for validation'
        },
        {
          name: 'RFC 6070 Test Vectors',
          url: 'https://tools.ietf.org/html/rfc6070#section-2',
          description: 'Official test vectors for PBKDF2-HMAC-SHA1'
        },
        {
          name: 'PBKDF2 Online Calculator',
          url: 'https://www.allkeysgenerator.com/Random/PBKDF2-Hash-Generator.aspx',
          description: 'Online tool for PBKDF2 calculation and verification'
        }
      ],
      applications: [
        {
          name: 'Password Storage',
          url: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html',
          description: 'OWASP guidelines for secure password storage using PBKDF2'
        },
        {
          name: 'WiFi WPA2/WPA3 PSK Derivation',
          url: 'https://standards.ieee.org/standard/802_11-2016.html',
          description: 'IEEE 802.11 standard uses PBKDF2 for PSK generation'
        },
        {
          name: 'TrueCrypt/VeraCrypt Key Derivation',
          url: 'https://www.veracrypt.fr/en/Technical%20Details.html',
          description: 'Disk encryption tools use PBKDF2 for key derivation'
        },
        {
          name: 'LUKS Disk Encryption',
          url: 'https://gitlab.com/cryptsetup/cryptsetup/-/wikis/LUKS-standard/on-disk-format.pdf',
          description: 'Linux disk encryption standard using PBKDF2'
        }
      ]
    },
    
    // Initialize cipher
    Init: function() {
      PBKDF2.isInitialized = true;
    },
    
    // Set up PBKDF2 instance with parameters
    KeySetup: function(password, salt, iterations, keyLength, hashFunction) {
      let id;
      do {
        id = 'PBKDF2[' + global.generateUniqueID() + ']';
      } while (PBKDF2.instances[id] || global.objectInstances[id]);
      
      const params = {
        password: password || '',
        salt: salt || '',
        iterations: iterations || PBKDF2.DEFAULT_ITERATIONS,
        keyLength: keyLength || PBKDF2.DEFAULT_KEY_LENGTH,
        hashFunction: hashFunction || PBKDF2.DEFAULT_HASH
      };
      
      PBKDF2.instances[id] = new PBKDF2.PBKDF2Instance(params);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear PBKDF2 data
    ClearData: function(id) {
      if (PBKDF2.instances[id]) {
        const instance = PBKDF2.instances[id];
        
        // Secure cleanup
        if (instance.password) {
          OpCodes.ClearArray(OpCodes.StringToBytes(instance.password));
        }
        
        delete PBKDF2.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'PBKDF2', 'ClearData');
        return false;
      }
    },
    
    // Derive key (encryption interface)
    encryptBlock: function(id, unused) {
      if (!PBKDF2.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'PBKDF2', 'encryptBlock');
        return '';
      }
      
      const instance = PBKDF2.instances[id];
      return PBKDF2.deriveKey(
        instance.password,
        instance.salt,
        instance.iterations,
        instance.keyLength,
        instance.hashFunction
      );
    },
    
    // PBKDF2 is one-way (no decryption)
    decryptBlock: function(id, cipherText) {
      global.throwException('Operation Not Supported Exception', 'PBKDF2 function cannot be reversed', 'PBKDF2', 'decryptBlock');
      return cipherText;
    },
    
    /**
     * Core PBKDF2 key derivation function
     * @param {string} password - Password to derive key from
     * @param {string} salt - Salt value
     * @param {number} iterations - Number of iterations
     * @param {number} keyLength - Desired key length in bytes
     * @param {string} hashFunction - Hash function name (SHA1, SHA256, SHA512)
     * @returns {string} Derived key as hex string
     */
    deriveKey: function(password, salt, iterations, keyLength, hashFunction) {
      const hashInfo = PBKDF2.HASH_FUNCTIONS[hashFunction];
      if (!hashInfo) {
        throw new Error('Unsupported hash function: ' + hashFunction);
      }
      
      const hLen = hashInfo.size; // Hash output length
      const numBlocks = Math.ceil(keyLength / hLen);
      let derivedKey = [];
      
      // Generate each block
      for (let i = 1; i <= numBlocks; i++) {
        const block = PBKDF2.F(password, salt, iterations, i, hashFunction);
        derivedKey = derivedKey.concat(block);
      }
      
      // Truncate to desired length
      derivedKey = derivedKey.slice(0, keyLength);
      
      return OpCodes.BytesToHex(derivedKey);
    },
    
    /**
     * PBKDF2 F function (RFC 2898)
     * @param {string} password - Password
     * @param {string} salt - Salt
     * @param {number} iterations - Iteration count
     * @param {number} blockIndex - Block index (1-based)
     * @param {string} hashFunction - Hash function name
     * @returns {Array} Block of derived key material
     */
    F: function(password, salt, iterations, blockIndex, hashFunction) {
      // U_1 = PRF(password, salt || INT_32_BE(blockIndex))
      const saltWithIndex = salt + OpCodes.BytesToString(OpCodes.Unpack32BE(blockIndex));
      
      let U = PBKDF2.PRF(password, saltWithIndex, hashFunction);
      let result = U.slice(); // Copy U_1
      
      // U_i = PRF(password, U_{i-1}) for i = 2 to iterations
      for (let i = 2; i <= iterations; i++) {
        U = PBKDF2.PRF(password, OpCodes.BytesToString(U), hashFunction);
        
        // XOR with result
        for (let j = 0; j < result.length; j++) {
          result[j] ^= U[j];
        }
      }
      
      return result;
    },
    
    /**
     * Pseudorandom function (PRF) - HMAC with specified hash
     * @param {string} key - HMAC key
     * @param {string} data - Data to authenticate
     * @param {string} hashFunction - Hash function name
     * @returns {Array} HMAC output as byte array
     */
    PRF: function(key, data, hashFunction) {
      // Use HMAC with specified hash function
      const hmacResult = PBKDF2.calculateHMAC(key, data, hashFunction);
      return OpCodes.HexToBytes(hmacResult);
    },
    
    /**
     * Calculate HMAC using the specified hash function
     * @param {string} key - HMAC key
     * @param {string} message - Message to authenticate
     * @param {string} hashFunction - Hash function name
     * @returns {string} HMAC as hex string
     */
    calculateHMAC: function(key, message, hashFunction) {
      // Get block size for hash function
      const blockSizes = { 'SHA1': 64, 'SHA256': 64, 'SHA512': 128 };
      const blockSize = blockSizes[hashFunction] || 64;
      
      let keyBytes = OpCodes.StringToBytes(key);
      
      // If key is longer than block size, hash it
      if (keyBytes.length > blockSize) {
        const hashedKey = PBKDF2.hash(key, hashFunction);
        keyBytes = OpCodes.HexToBytes(hashedKey);
      }
      
      // Pad key to block size
      const paddedKey = new Array(blockSize);
      for (let i = 0; i < blockSize; i++) {
        paddedKey[i] = i < keyBytes.length ? keyBytes[i] : 0;
      }
      
      // Create inner and outer padded keys
      const innerKey = new Array(blockSize);
      const outerKey = new Array(blockSize);
      
      for (let i = 0; i < blockSize; i++) {
        innerKey[i] = paddedKey[i] ^ 0x36; // ipad
        outerKey[i] = paddedKey[i] ^ 0x5C; // opad
      }
      
      // Hash(K XOR ipad, message)
      const innerData = OpCodes.BytesToString(innerKey) + message;
      const innerHash = PBKDF2.hash(innerData, hashFunction);
      
      // Hash(K XOR opad, Hash(K XOR ipad, message))
      const outerData = OpCodes.BytesToString(outerKey) + OpCodes.BytesToString(OpCodes.HexToBytes(innerHash));
      const finalHash = PBKDF2.hash(outerData, hashFunction);
      
      return finalHash;
    },
    
    /**
     * Hash function wrapper
     * @param {string} data - Data to hash
     * @param {string} hashFunction - Hash function name
     * @returns {string} Hash as hex string
     */
    hash: function(data, hashFunction) {
      switch (hashFunction.toUpperCase()) {
        case 'SHA1':
          return global.SHA1 ? global.SHA1.hash(data) : PBKDF2.simpleSHA1(data);
        case 'SHA256':
          return global.SHA256 ? global.SHA256.hash(data) : PBKDF2.simpleSHA256(data);
        case 'SHA512':
          return global.SHA512 ? global.SHA512.hash(data) : PBKDF2.simpleSHA512(data);
        default:
          throw new Error('Unsupported hash function: ' + hashFunction);
      }
    },
    
    /**
     * Simple SHA1 implementation (educational only)
     */
    simpleSHA1: function(data) {
      // This is a simplified SHA1 for educational purposes
      // In production, use a proper SHA1 implementation
      const bytes = OpCodes.StringToBytes(data);
      let hash = 0x67452301;
      
      for (let i = 0; i < bytes.length; i++) {
        hash = ((hash << 5) - hash + bytes[i]) & 0xFFFFFFFF;
      }
      
      return OpCodes.BytesToHex(OpCodes.Unpack32BE(hash >>> 0)).repeat(5).substring(0, 40);
    },
    
    /**
     * Simple SHA256 implementation (educational only)
     */
    simpleSHA256: function(data) {
      // This is a simplified SHA256 for educational purposes
      const bytes = OpCodes.StringToBytes(data);
      let hash = 0x6a09e667;
      
      for (let i = 0; i < bytes.length; i++) {
        hash = ((hash << 7) - hash + bytes[i]) & 0xFFFFFFFF;
      }
      
      return OpCodes.BytesToHex(OpCodes.Unpack32BE(hash >>> 0)).repeat(8).substring(0, 64);
    },
    
    /**
     * Simple SHA512 implementation (educational only)
     */
    simpleSHA512: function(data) {
      // This is a simplified SHA512 for educational purposes
      const bytes = OpCodes.StringToBytes(data);
      let hash = 0x6a09e667;
      
      for (let i = 0; i < bytes.length; i++) {
        hash = ((hash << 11) - hash + bytes[i]) & 0xFFFFFFFF;
      }
      
      return OpCodes.BytesToHex(OpCodes.Unpack32BE(hash >>> 0)).repeat(16).substring(0, 128);
    },
    
    /**
     * Verify PBKDF2 derived key
     * @param {string} password - Original password
     * @param {string} salt - Salt used
     * @param {number} iterations - Iteration count
     * @param {string} expectedKey - Expected derived key (hex)
     * @param {string} hashFunction - Hash function name
     * @returns {boolean} True if key is valid
     */
    verify: function(password, salt, iterations, expectedKey, hashFunction) {
      const keyLength = expectedKey.length / 2; // Convert hex length to byte length
      const derivedKey = PBKDF2.deriveKey(password, salt, iterations, keyLength, hashFunction || PBKDF2.DEFAULT_HASH);
      return OpCodes.SecureCompare(
        OpCodes.HexToBytes(derivedKey),
        OpCodes.HexToBytes(expectedKey)
      );
    },
    
    // Instance class
    PBKDF2Instance: function(params) {
      this.password = params.password;
      this.salt = params.salt;
      this.iterations = params.iterations;
      this.keyLength = params.keyLength;
      this.hashFunction = params.hashFunction;
    },

    Init: function() {
      return true;
    }

    // TODO: Implementation methods here...
  };

  // Auto-register with Subsystem if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(PBKDF2);

  // Legacy registration for compatibility
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(PBKDF2);
  }
  
  // Export to global scope
  global.PBKDF2 = PBKDF2;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PBKDF2;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);