#!/usr/bin/env node
/*
 * Strict Algorithm Tester
 * Enforces strict interface requirements for algorithm categories
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection
  const isNode = typeof module !== 'undefined' && module.exports;
  
  // Load dependencies for Node.js
  if (isNode) {
    try {
      require('./universal-cipher-env.js');
      require('./cipher.js');
    } catch (e) {
      console.warn('Dependencies not available in Node.js environment:', e.message);
      // Don't return - allow the module to continue for testing purposes
    }
  }
  
  const StrictAlgorithmTester = {
    
    // STRICT interface requirements (checking both cases for compatibility)
    REQUIRED_INTERFACES: {
      'cipher_block': {
        required: [['Init'], ['encryptBlock', 'EncryptBlock'], ['decryptBlock', 'DecryptBlock']],
        description: 'Block ciphers MUST have Init(keyBytes,...)/encryptBlock(plainBytes)/decryptBlock(cipherBytes)'
      },
      'cipher_stream': {
        required: [['Init'], ['encryptStream', 'EncryptStream'], ['decryptStream', 'DecryptStream']],
        description: 'Stream ciphers MUST have Init(keyBytes,...)/encryptStream(byteEnumerator)/decryptStream(byteEnumerator)'
      },
      'hash': {
        required: [['Hash', 'hash']],
        description: 'Hashes MUST have Hash(bytes) or hash(bytes)'
      },
      'encoding': {
        required: [['encode', 'Encode'], ['decode', 'Decode']],
        description: 'Encoders MUST have encode(bytes)/decode(bytes)'
      },
      'compression': {
        required: [['compress', 'Compress'], ['decompress', 'Decompress']],
        description: 'Compressors MUST have compress(bytes)/decompress(bytes)'
      }
    },
    
    /**
     * Validate algorithm interface compliance
     */
    validateInterface: function(algorithm, algorithmName) {
      const strategy = this.determineAlgorithmType(algorithm);
      
      if (strategy === 'invalid') {
        return {
          valid: false,
          error: `Algorithm ${algorithmName} does not implement any recognized interface`,
          missing: [],
          strategy: 'invalid'
        };
      }
      
      const requirements = this.REQUIRED_INTERFACES[strategy];
      if (!requirements) {
        return {
          valid: false,
          error: `No interface requirements defined for strategy: ${strategy}`,
          missing: [],
          strategy: strategy
        };
      }
      
      const missing = [];
      for (const methodGroup of requirements.required) {
        // Check if any method in the group exists
        const hasMethod = methodGroup.some(method => 
          algorithm[method] && typeof algorithm[method] === 'function'
        );
        
        if (!hasMethod) {
          missing.push(methodGroup.join(' or '));
        }
      }
      
      return {
        valid: missing.length === 0,
        error: missing.length > 0 ? 
          `${requirements.description}. Missing: ${missing.join(', ')}` : null,
        missing: missing,
        strategy: strategy,
        description: requirements.description
      };
    },
    
    /**
     * Strictly determine algorithm type based on available methods
     */
    determineAlgorithmType: function(algorithm) {
      // Check for block cipher interface (lowercase or uppercase)
      if (this.hasAnyMethodGroup(algorithm, [['Init'], ['encryptBlock', 'EncryptBlock'], ['decryptBlock', 'DecryptBlock']])) {
        return 'cipher_block';
      }
      
      // Check for stream cipher interface  
      if (this.hasAnyMethodGroup(algorithm, [['Init'], ['encryptStream', 'EncryptStream'], ['decryptStream', 'DecryptStream']])) {
        return 'cipher_stream';
      }
      
      // Check for hash interface
      if (this.hasAnyMethodGroup(algorithm, [['Hash', 'hash']])) {
        return 'hash';
      }
      
      // Check for encoding interface
      if (this.hasAnyMethodGroup(algorithm, [['encode', 'Encode'], ['decode', 'Decode']])) {
        return 'encoding';
      }
      
      // Check for compression interface
      if (this.hasAnyMethodGroup(algorithm, [['compress', 'Compress'], ['decompress', 'Decompress']])) {
        return 'compression';
      }
      
      return 'invalid';
    },
    
    /**
     * Check if algorithm has all required method groups
     */
    hasAnyMethodGroup: function(algorithm, methodGroups) {
      return methodGroups.every(methodGroup => 
        methodGroup.some(method => 
          algorithm[method] && typeof algorithm[method] === 'function'
        )
      );
    },
    
    /**
     * Get the actual method name from a group of alternatives
     */
    getActualMethod: function(algorithm, methodGroup) {
      for (const method of methodGroup) {
        if (algorithm[method] && typeof algorithm[method] === 'function') {
          return method;
        }
      }
      return null;
    },
    
    /**
     * Test a single algorithm with strict interface validation
     */
    testAlgorithm: function(algorithm, algorithmName) {
      console.log(`\n=== Testing ${algorithmName} ===`);
      
      // First validate interface
      const validation = this.validateInterface(algorithm, algorithmName);
      
      if (!validation.valid) {
        console.log(`❌ INTERFACE VALIDATION FAILED`);
        console.log(`   Error: ${validation.error}`);
        return {
          algorithmName: algorithmName,
          interfaceValid: false,
          error: validation.error,
          strategy: validation.strategy,
          testsRun: 0,
          testsPassed: 0,
          testsFailed: 0
        };
      }
      
      console.log(`✅ Interface validation passed: ${validation.strategy}`);
      console.log(`   ${validation.description}`);
      
      // Now run actual tests if interface is valid
      const testResults = this.runAlgorithmTests(algorithm, algorithmName, validation.strategy);
      
      return {
        algorithmName: algorithmName,
        interfaceValid: true,
        strategy: validation.strategy,
        ...testResults
      };
    },
    
    /**
     * Run tests for an algorithm with validated interface
     */
    runAlgorithmTests: function(algorithm, algorithmName, strategy) {
      const testVectors = algorithm.tests || algorithm.testVectors || [];
      
      if (testVectors.length === 0) {
        console.log(`⚠️  No test vectors found for ${algorithmName}`);
        return {
          testsRun: 0,
          testsPassed: 0,
          testsFailed: 0,
          noTestVectors: true
        };
      }
      
      let passed = 0;
      let failed = 0;
      
      for (let i = 0; i < testVectors.length; i++) {
        const testVector = testVectors[i];
        const testName = testVector.text || `Test ${i + 1}`;
        
        try {
          const result = this.runSingleTest(algorithm, testVector, strategy);
          
          if (result.success) {
            console.log(`  ✅ ${testName}`);
            passed++;
          } else {
            console.log(`  ❌ ${testName}: ${result.error}`);
            failed++;
          }
        } catch (error) {
          console.log(`  ❌ ${testName}: Exception - ${error.message}`);
          failed++;
        }
      }
      
      const total = passed + failed;
      console.log(`📊 Results: ${passed}/${total} passed (${Math.round(passed/total*100)}%)`);
      
      return {
        testsRun: total,
        testsPassed: passed,
        testsFailed: failed
      };
    },
    
    /**
     * Run a single test vector with strict interface
     */
    runSingleTest: function(algorithm, testVector, strategy) {
      switch (strategy) {
        case 'cipher_block':
          return this.testBlockCipher(algorithm, testVector);
        case 'cipher_stream':
          return this.testStreamCipher(algorithm, testVector);
        case 'hash':
          return this.testHash(algorithm, testVector);
        case 'encoding':
          return this.testEncoding(algorithm, testVector);
        case 'compression':
          return this.testCompression(algorithm, testVector);
        default:
          return { success: false, error: `Unknown strategy: ${strategy}` };
      }
    },
    
    /**
     * Test block cipher with strict interface
     */
    testBlockCipher: function(algorithm, testVector) {
      const key = testVector.key || testVector.keyBytes;
      const input = testVector.input || testVector.plaintext;
      const expected = testVector.expected || testVector.ciphertext;
      
      if (!key || !input || !expected) {
        return { success: false, error: 'Missing key, input, or expected data' };
      }
      
      // Get actual method names
      const encryptMethod = this.getActualMethod(algorithm, ['encryptBlock', 'EncryptBlock']);
      
      if (!encryptMethod) {
        return { success: false, error: 'No encrypt method found' };
      }
      
      // Initialize with key
      algorithm.Init(key);
      
      // Encrypt using the correct method name
      const result = algorithm[encryptMethod](input);
      
      // Compare results
      if (this.arraysEqual(result, expected)) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: `Expected ${this.bytesToHex(expected)}, got ${this.bytesToHex(result)}` 
        };
      }
    },
    
    /**
     * Test stream cipher with strict interface
     */
    testStreamCipher: function(algorithm, testVector) {
      const key = testVector.key || testVector.keyBytes;
      const input = testVector.input || testVector.plaintext;
      const expected = testVector.expected || testVector.ciphertext;
      
      if (!key || !input || !expected) {
        return { success: false, error: 'Missing key, input, or expected data' };
      }
      
      // Initialize with key
      algorithm.Init(key);
      
      // Create byte enumerator (simple array for testing)
      const byteEnumerator = input;
      
      // Encrypt stream
      const result = algorithm.EncryptStream(byteEnumerator);
      
      // Compare results
      if (this.arraysEqual(result, expected)) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: `Expected ${this.bytesToHex(expected)}, got ${this.bytesToHex(result)}` 
        };
      }
    },
    
    /**
     * Test hash with strict interface
     */
    testHash: function(algorithm, testVector) {
      const input = testVector.input || testVector.data || [];
      const expected = testVector.expected || testVector.hash;
      
      if (!expected) {
        return { success: false, error: 'Missing expected hash data' };
      }
      
      // Hash the input
      const result = algorithm.Hash(input);
      
      // Compare results
      if (this.arraysEqual(result, expected)) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: `Expected ${this.bytesToHex(expected)}, got ${this.bytesToHex(result)}` 
        };
      }
    },
    
    /**
     * Test encoding with strict interface
     */
    testEncoding: function(algorithm, testVector) {
      const input = testVector.input || testVector.data;
      const expected = testVector.expected || testVector.encoded;
      
      if (!input || !expected) {
        return { success: false, error: 'Missing input or expected data' };
      }
      
      // Encode the input
      const result = algorithm.Encode(input);
      
      // Compare results
      if (this.arraysEqual(result, expected)) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: `Expected ${this.bytesToHex(expected)}, got ${this.bytesToHex(result)}` 
        };
      }
    },
    
    /**
     * Test compression with strict interface
     */
    testCompression: function(algorithm, testVector) {
      const input = testVector.input || testVector.data;
      const expected = testVector.expected || testVector.compressed;
      
      if (!input) {
        return { success: false, error: 'Missing input data' };
      }
      
      // Compress the input
      const result = algorithm.Compress(input);
      
      if (expected) {
        // Compare with expected if provided
        if (this.arraysEqual(result, expected)) {
          return { success: true };
        } else {
          return { 
            success: false, 
            error: `Expected ${this.bytesToHex(expected)}, got ${this.bytesToHex(result)}` 
          };
        }
      } else {
        // Just verify compression produces output
        if (result && result.length > 0) {
          return { success: true };
        } else {
          return { success: false, error: 'Compression produced no output' };
        }
      }
    },
    
    /**
     * Compare two byte arrays for equality
     */
    arraysEqual: function(a, b) {
      if (!a || !b) return false;
      if (a.length !== b.length) return false;
      
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      
      return true;
    },
    
    /**
     * Convert byte array to hex string for display
     */
    bytesToHex: function(bytes) {
      if (!bytes) return 'null';
      return Array.from(bytes, byte => 
        ('0' + (byte & 0xFF).toString(16)).slice(-2)
      ).join('');
    },
    
    /**
     * Test all registered algorithms with strict validation
     */
    testAllAlgorithms: function() {
      console.log('🔍 Testing all registered algorithms with strict interface validation...\n');
      
      const algorithms = global.Cipher ? global.Cipher.ciphers : {};
      const algorithmNames = Object.keys(algorithms);
      
      if (algorithmNames.length === 0) {
        console.log('❌ No algorithms found in Cipher.ciphers');
        return;
      }
      
      console.log(`Found ${algorithmNames.length} registered algorithms\n`);
      
      let totalTested = 0;
      let interfaceValid = 0;
      let interfaceInvalid = 0;
      let totalTests = 0;
      let totalPassed = 0;
      let totalFailed = 0;
      
      for (const algorithmName of algorithmNames) {
        const algorithm = algorithms[algorithmName];
        const result = this.testAlgorithm(algorithm, algorithmName);
        
        totalTested++;
        
        if (result.interfaceValid) {
          interfaceValid++;
          totalTests += result.testsRun;
          totalPassed += result.testsPassed;
          totalFailed += result.testsFailed;
        } else {
          interfaceInvalid++;
        }
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('📊 SUMMARY REPORT');
      console.log('='.repeat(60));
      console.log(`Total Algorithms Tested: ${totalTested}`);
      console.log(`✅ Valid Interfaces: ${interfaceValid} (${Math.round(interfaceValid/totalTested*100)}%)`);
      console.log(`❌ Invalid Interfaces: ${interfaceInvalid} (${Math.round(interfaceInvalid/totalTested*100)}%)`);
      console.log(`\nTest Vector Results:`);
      console.log(`  Total Tests Run: ${totalTests}`);
      console.log(`  ✅ Passed: ${totalPassed} (${totalTests > 0 ? Math.round(totalPassed/totalTests*100) : 0}%)`);
      console.log(`  ❌ Failed: ${totalFailed} (${totalTests > 0 ? Math.round(totalFailed/totalTests*100) : 0}%)`);
    }
  };
  
  // Export for Node.js or make global for browser
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StrictAlgorithmTester;
  } else {
    global.StrictAlgorithmTester = StrictAlgorithmTester;
  }
  
  // Auto-run if called directly from command line
  if (isNode && require.main === module) {
    StrictAlgorithmTester.testAllAlgorithms();
  }
  
})(typeof global !== 'undefined' ? global : window);