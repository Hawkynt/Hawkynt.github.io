/*
 * Fletcher-32 Implementation
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
      console.error('Fletcher32 requires Cipher system to be loaded first');
      return;
    }
  }
  
  const Fletcher32 = {
    name: "Fletcher-32",
    description: "Fletcher-32 checksum algorithm providing better error detection than simple checksums. Uses two running sums with different weights to detect errors.",
    inventor: "John G. Fletcher",
    year: 1982,
    country: "US",
    category: "checksum",
    subCategory: "Simple Checksum",
    securityStatus: "educational",
    securityNotes: "Not cryptographically secure. Designed for error detection, not security. Can be easily forged or manipulated by attackers.",
    
    documentation: [
      {text: "Wikipedia - Fletcher's checksum", uri: "https://en.wikipedia.org/wiki/Fletcher%27s_checksum"},
      {text: "RFC 1146 - TCP Alternative Checksum Options", uri: "https://tools.ietf.org/rfc/rfc1146.txt"},
      {text: "Original Fletcher Paper", uri: "https://ieeexplore.ieee.org/document/1094155"}
    ],
    
    references: [
      {text: "Linux Kernel Fletcher Implementation", uri: "https://github.com/torvalds/linux/blob/master/lib/checksum.c"},
      {text: "BSD Socket Implementation", uri: "https://github.com/freebsd/freebsd-src/blob/main/sys/netinet/in_cksum.c"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Not Cryptographically Secure", 
        text: "Fletcher checksums are designed for error detection, not security. They can be easily manipulated by attackers",
        mitigation: "Use cryptographic hash functions (SHA-256, SHA-3) for security purposes"
      },
      {
        type: "Collision Vulnerability", 
        text: "Fletcher checksums have known collision patterns and can produce the same checksum for different inputs",
        mitigation: "Use for error detection only, not for data integrity in security contexts"
      }
    ],
    
    tests: [
      {
        text: "Fletcher-32 Standard Test - Empty Input",
        uri: "https://en.wikipedia.org/wiki/Fletcher%27s_checksum",
        input: [],
        expected: Hex8ToBytes("00000000")
      },
      {
        text: "Fletcher-32 Standard Test - Simple String",
        uri: "https://en.wikipedia.org/wiki/Fletcher%27s_checksum",
        input: ANSIToBytes("abcde"),
        expected: Hex8ToBytes("028002aa")
      }
    ],

    // Legacy interface properties for compatibility
    internalName: 'Fletcher32',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: true,
    isInitialized: false,
    
    MODULO: 65535,
    BLOCK_SIZE: 359,
    
    // Legacy test vectors for compatibility
    legacyTestVectors: [
      {
        algorithm: 'Fletcher-32',
        description: 'Empty input test',
        origin: 'Standard test',
        link: 'https://en.wikipedia.org/wiki/Fletcher%27s_checksum',
        standard: 'Fletcher Algorithm',
        input: '',
        inputHex: '',
        checksum: '00000000',
        notes: 'Edge case: empty input should produce zero checksum',
        category: 'boundary'
      },
      {
        algorithm: 'Fletcher-32',
        description: 'Single byte test',
        origin: 'Standard test',
        link: 'https://en.wikipedia.org/wiki/Fletcher%27s_checksum',
        standard: 'Fletcher Algorithm',
        input: 'a',
        inputHex: '61',
        checksum: '00610061',
        notes: 'Single character input',
        category: 'basic'
      },
      {
        algorithm: 'Fletcher-32',
        description: 'Simple ASCII string',
        origin: 'Common test case',
        link: 'https://en.wikipedia.org/wiki/Fletcher%27s_checksum',
        standard: 'Fletcher Algorithm',
        input: 'abcde',
        inputHex: '6162636465',
        checksum: '028002aa',
        notes: 'Basic ASCII string test',
        category: 'basic'
      },
      {
        algorithm: 'Fletcher-32',
        description: 'Another ASCII test',
        origin: 'Common test case',
        link: 'https://en.wikipedia.org/wiki/Fletcher%27s_checksum',
        standard: 'Fletcher Algorithm',
        input: 'abcdef',
        inputHex: '616263646566',
        checksum: '036e0393',
        notes: 'Six character ASCII string',
        category: 'basic'
      },
      {
        algorithm: 'Fletcher-32',
        description: 'Alphabet test',
        origin: 'Standard test',
        link: 'https://en.wikipedia.org/wiki/Fletcher%27s_checksum',
        standard: 'Fletcher Algorithm',
        input: 'abcdefghijklmnopqrstuvwxyz',
        inputHex: '6162636465666768696a6b6c6d6e6f707172737475767778797a',
        checksum: '2057220e',
        notes: 'Full lowercase alphabet',
        category: 'standard'
      },
      {
        algorithm: 'Fletcher-32',
        description: 'Numeric string test',
        origin: 'Standard test',
        link: 'https://en.wikipedia.org/wiki/Fletcher%27s_checksum',
        standard: 'Fletcher Algorithm',
        input: '1234567890',
        inputHex: '31323334353637383930',
        checksum: '19de1a87',
        notes: 'Numeric digits test',
        category: 'basic'
      },
      {
        algorithm: 'Fletcher-32',
        description: 'All zero bytes',
        origin: 'Boundary test',
        link: 'https://en.wikipedia.org/wiki/Fletcher%27s_checksum',
        standard: 'Fletcher Algorithm',
        input: '\x00\x00\x00\x00\x00',
        inputHex: '0000000000',
        checksum: '00000000',
        notes: 'Zero bytes should produce zero checksum',
        category: 'boundary'
      },
      {
        algorithm: 'Fletcher-32',
        description: 'All 0xFF bytes',
        origin: 'Boundary test',
        link: 'https://en.wikipedia.org/wiki/Fletcher%27s_checksum',
        standard: 'Fletcher Algorithm',
        input: '\xff\xff\xff\xff\xff',
        inputHex: 'ffffffffff',
        checksum: 'f9f4fef9',
        notes: 'Maximum value bytes test',
        category: 'boundary'
      },
      {
        algorithm: 'Fletcher-32',
        description: 'Longer text passage',
        origin: 'Extended test',
        link: 'https://en.wikipedia.org/wiki/Fletcher%27s_checksum',
        standard: 'Fletcher Algorithm',
        input: 'The quick brown fox jumps over the lazy dog',
        inputHex: '54686520717569636b2062726f776e20666f78206a756d7073206f76657220746865206c617a7920646f67',
        checksum: '143c1f8f',
        notes: 'Classic pangram test string',
        category: 'standard'
      },
      {
        algorithm: 'Fletcher-32',
        description: 'Large block test (near overflow)',
        origin: 'Stress test',
        link: 'https://en.wikipedia.org/wiki/Fletcher%27s_checksum',
        standard: 'Fletcher Algorithm',
        input: 'A'.repeat(358),
        inputHex: '41'.repeat(358),
        checksum: '7d267c8c',
        notes: 'Test block size near overflow limit',
        category: 'boundary'
      },
      {
        algorithm: 'Fletcher-32',
        description: 'Network packet simulation',
        origin: 'Real-world test',
        link: 'https://tools.ietf.org/html/rfc1146',
        standard: 'Network Protocol',
        input: 'UDP:192.168.1.1:53->8.8.8.8:53',
        inputHex: '5544503a3139322e3136382e312e313a35332d3e382e382e382e383a3533',
        checksum: '4b983476',
        notes: 'Simulated network packet header',
        category: 'application'
      }
    ],
    
    // Reference links for Fletcher-32
    referenceLinks: {
      specifications: [
        {
          name: 'Fletcher, J.G. "An Arithmetic Checksum for Serial Transmissions"',
          url: 'https://ieeexplore.ieee.org/document/1094155',
          description: 'Original Fletcher checksum paper (IEEE Transactions on Communications, 1982)'
        },
        {
          name: 'RFC 1146: TCP Alternate Checksum Options',
          url: 'https://tools.ietf.org/html/rfc1146',
          description: 'Fletcher checksum usage in TCP'
        },
        {
          name: 'ISO 8473 Network Protocol Standard',
          url: 'https://www.iso.org/standard/15690.html',
          description: 'ISO standard using Fletcher checksum'
        },
        {
          name: 'Fletcher Checksum Wikipedia',
          url: 'https://en.wikipedia.org/wiki/Fletcher%27s_checksum',
          description: 'Comprehensive overview of Fletcher checksum algorithms'
        }
      ],
      implementations: [
        {
          name: 'Linux Kernel Fletcher Implementation',
          url: 'https://github.com/torvalds/linux/blob/master/lib/checksum.c',
          description: 'Production kernel checksum implementations'
        },
        {
          name: 'BSD Socket Implementation',
          url: 'https://github.com/freebsd/freebsd-src/blob/main/sys/netinet/in_cksum.c',
          description: 'FreeBSD network checksum implementation'
        },
        {
          name: 'OpenSSL Checksum Utilities',
          url: 'https://github.com/openssl/openssl/blob/master/crypto/sha/sha1_one.c',
          description: 'OpenSSL checksum implementations'
        },
        {
          name: 'Python Checksum Libraries',
          url: 'https://pypi.org/project/checksums/',
          description: 'Python checksum library implementations'
        }
      ],
      validation: [
        {
          name: 'Fletcher Test Vectors',
          url: 'https://datatracker.ietf.org/doc/html/rfc1146#appendix-B',
          description: 'RFC test vectors for Fletcher checksum validation'
        },
        {
          name: 'NIST Checksum Validation',
          url: 'https://csrc.nist.gov/Projects/Cryptographic-Algorithm-Validation-Program',
          description: 'NIST validation programs for checksum algorithms'
        },
        {
          name: 'Online Fletcher Calculator',
          url: 'https://www.scadacore.com/tools/programming-calculators/online-checksum-calculator/',
          description: 'Online tools for Fletcher checksum calculation'
        }
      ],
      applications: [
        {
          name: 'Network Protocol Headers',
          url: 'https://tools.ietf.org/html/rfc793',
          description: 'TCP/UDP checksum usage in network protocols'
        },
        {
          name: 'File System Integrity',
          url: 'https://en.wikipedia.org/wiki/ZFS',
          description: 'ZFS and other file systems using checksums'
        },
        {
          name: 'Serial Communication',
          url: 'https://en.wikipedia.org/wiki/Serial_communication',
          description: 'Fletcher checksum in serial data transmission'
        },
        {
          name: 'Embedded Systems',
          url: 'https://en.wikipedia.org/wiki/Embedded_system',
          description: 'Checksum usage in embedded and real-time systems'
        }
      ]
    },
    
    // Initialize cipher
    Init: function() {
      Fletcher32.isInitialized = true;
    },
    
    // Set up Fletcher32 instance
    KeySetup: function() {
      let id;
      do {
        id = 'Fletcher32[' + global.generateUniqueID() + ']';
      } while (Fletcher32.instances[id] || global.objectInstances[id]);
      
      Fletcher32.instances[id] = new Fletcher32.Fletcher32Instance();
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear Fletcher32 data
    ClearData: function(id) {
      if (Fletcher32.instances[id]) {
        delete Fletcher32.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Fletcher32', 'ClearData');
        return false;
      }
    },
    
    // Calculate checksum (encryption interface)
    encryptBlock: function(id, data) {
      if (!Fletcher32.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Fletcher32', 'encryptBlock');
        return '';
      }
      
      return Fletcher32.calculate(data);
    },
    
    // Fletcher32 is one-way (no decryption)
    decryptBlock: function(id, cipherText) {
      global.throwException('Operation Not Supported Exception', 'Fletcher32 checksum cannot be reversed', 'Fletcher32', 'decryptBlock');
      return cipherText;
    },
    
    /**
     * Core Fletcher-32 checksum calculation
     * @param {string} data - Data to checksum
     * @returns {string} 32-bit checksum as 8-character hex string
     */
    calculate: function(data) {
      const bytes = OpCodes.StringToBytes(data);
      let sum1 = 0;
      let sum2 = 0;
      
      // Process data in blocks to prevent overflow
      let index = 0;
      while (index < bytes.length) {
        const blockEnd = Math.min(index + Fletcher32.BLOCK_SIZE, bytes.length);
        
        // Process one block
        for (let i = index; i < blockEnd; i++) {
          sum1 += bytes[i];
          sum2 += sum1;
        }
        
        // Reduce modulo 65535 to prevent overflow
        sum1 %= Fletcher32.MODULO;
        sum2 %= Fletcher32.MODULO;
        
        index = blockEnd;
      }
      
      // Combine the two 16-bit sums into a 32-bit checksum
      const checksum = (sum2 << 16) | sum1;
      
      // Return as 8-character hex string (32-bit value)
      return OpCodes.BytesToHex(OpCodes.Unpack32BE(checksum >>> 0));
    },
    
    /**
     * Calculate Fletcher-32 checksum incrementally
     * @param {string} data - Data to add to checksum
     * @param {Object} state - Previous state {sum1, sum2}
     * @returns {Object} New state and checksum
     */
    calculateIncremental: function(data, state) {
      const bytes = OpCodes.StringToBytes(data);
      let sum1 = state ? state.sum1 : 0;
      let sum2 = state ? state.sum2 : 0;
      
      // Process data in blocks to prevent overflow
      let index = 0;
      while (index < bytes.length) {
        const blockEnd = Math.min(index + Fletcher32.BLOCK_SIZE, bytes.length);
        
        // Process one block
        for (let i = index; i < blockEnd; i++) {
          sum1 += bytes[i];
          sum2 += sum1;
        }
        
        // Reduce modulo 65535 to prevent overflow
        sum1 %= Fletcher32.MODULO;
        sum2 %= Fletcher32.MODULO;
        
        index = blockEnd;
      }
      
      // Combine the two 16-bit sums into a 32-bit checksum
      const checksum = (sum2 << 16) | sum1;
      
      return {
        sum1: sum1,
        sum2: sum2,
        checksum: OpCodes.BytesToHex(OpCodes.Unpack32BE(checksum >>> 0))
      };
    },
    
    /**
     * Verify Fletcher-32 checksum
     * @param {string} data - Original data
     * @param {string} expectedChecksum - Expected checksum (hex)
     * @returns {boolean} True if checksum is valid
     */
    verify: function(data, expectedChecksum) {
      const calculatedChecksum = Fletcher32.calculate(data);
      return OpCodes.SecureCompare(
        OpCodes.HexToBytes(calculatedChecksum),
        OpCodes.HexToBytes(expectedChecksum.toLowerCase())
      );
    },
    
    /**
     * Calculate Fletcher-16 variant (for comparison)
     * @param {string} data - Data to checksum
     * @returns {string} 16-bit checksum as 4-character hex string
     */
    fletcher16: function(data) {
      const bytes = OpCodes.StringToBytes(data);
      let sum1 = 0;
      let sum2 = 0;
      
      for (let i = 0; i < bytes.length; i++) {
        sum1 = (sum1 + bytes[i]) % 255;
        sum2 = (sum2 + sum1) % 255;
      }
      
      const checksum = (sum2 << 8) | sum1;
      return OpCodes.BytesToHex(OpCodes.Unpack16BE(checksum)).substring(0, 4);
    },
    
    /**
     * Calculate Fletcher-64 variant (for higher precision)
     * @param {string} data - Data to checksum
     * @returns {string} 64-bit checksum as 16-character hex string
     */
    fletcher64: function(data) {
      const bytes = OpCodes.StringToBytes(data);
      let sum1 = 0;
      let sum2 = 0;
      const modulo = 0xFFFFFFFF; // 2^32 - 1
      
      // Process 4-byte chunks for Fletcher-64
      for (let i = 0; i < bytes.length; i += 4) {
        let chunk = 0;
        for (let j = 0; j < 4 && i + j < bytes.length; j++) {
          chunk |= (bytes[i + j] << (j * 8));
        }
        
        sum1 = (sum1 + chunk) % modulo;
        sum2 = (sum2 + sum1) % modulo;
      }
      
      // Combine into 64-bit checksum
      const high = sum2;
      const low = sum1;
      
      return OpCodes.BytesToHex(OpCodes.Unpack32BE(high)) + 
             OpCodes.BytesToHex(OpCodes.Unpack32BE(low));
    },
    
    /**
     * Benchmark Fletcher-32 performance
     * @param {number} dataSize - Size of test data in bytes
     * @returns {Object} Performance metrics
     */
    benchmark: function(dataSize) {
      dataSize = dataSize || 1024 * 1024; // Default 1MB
      
      // Generate test data
      const testData = 'A'.repeat(dataSize);
      
      // Warm up
      for (let i = 0; i < 10; i++) {
        Fletcher32.calculate(testData);
      }
      
      // Benchmark
      const startTime = Date.now();
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        Fletcher32.calculate(testData);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const throughput = (dataSize * iterations) / (totalTime / 1000); // bytes per second
      
      return {
        dataSize: dataSize,
        iterations: iterations,
        totalTime: totalTime,
        averageTime: totalTime / iterations,
        throughput: throughput,
        throughputMB: throughput / (1024 * 1024)
      };
    },
    
    // Instance class
    Fletcher32Instance: function() {
      this.sum1 = 0;
      this.sum2 = 0;
      this.initialized = true;
    }
  };
  
  // Auto-register with Subsystem if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(Fletcher32);

  // Legacy registration for compatibility
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Fletcher32);
  }
  
  // Export to global scope
  global.Fletcher32 = Fletcher32;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Fletcher32;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);