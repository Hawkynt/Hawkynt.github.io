#!/usr/bin/env node
/*
 * Universal Algorithm Tester
 * Comprehensive test runner for all algorithm categories in the cipher collection
 * Auto-detects algorithm types and validates test vectors
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection
  const isNode = typeof module !== 'undefined' && module.exports;
  const isBrowser = typeof window !== 'undefined';
  
  // Load dependencies for Node.js
  if (isNode) {
    try {
      require('./universal-cipher-env.js');
      require('./cipher.js');
    } catch (e) {
      console.error('Failed to load required dependencies:', e.message);
      return;
    }
  }
  
  // Universal Algorithm Tester
  const UniversalAlgorithmTester = {
    results: {
      totalTests: 0,
      passed: 0,
      failed: 0,
      errors: 0,
      skipped: 0,
      categories: {},
      algorithmResults: {}
    },
    
    // Algorithm categories and their expected interface methods
    ALGORITHM_CATEGORIES: {
      'cipher': {
        subcategories: ['Block Cipher', 'Stream Cipher', 'Classical Cipher', 'Asymmetric Cipher'],
        requiredMethods: ['KeySetup', 'ClearData'],
        encryptMethods: ['encryptBlock', 'EncryptBlock'],
        decryptMethods: ['decryptBlock', 'DecryptBlock'],
        testMethod: 'testCipher'
      },
      'hash': {
        subcategories: ['Cryptographic Hash', 'Fast Hash', 'Specialized Hash'],
        requiredMethods: ['Init'],
        hashMethods: ['Hash', 'hash', 'encryptBlock', 'EncryptBlock'],
        testMethod: 'testHash'
      },
      'encoding': {
        subcategories: ['Base Encoding', 'Text Encoding', 'Binary Encoding', 'Specialized'],
        requiredMethods: ['KeySetup', 'ClearData'],
        encodeMethods: ['encryptBlock', 'EncryptBlock', 'encode'],
        decodeMethods: ['decryptBlock', 'DecryptBlock', 'decode'],
        testMethod: 'testEncoding'
      },
      'compression': {
        subcategories: ['Dictionary', 'Statistical', 'Transform', 'Modern'],
        requiredMethods: ['Init'],
        compressMethods: ['compress', 'encryptBlock', 'EncryptBlock'],
        decompressMethods: ['decompress', 'decryptBlock', 'DecryptBlock'],
        testMethod: 'testCompression'
      },
      'mac': {
        subcategories: ['HMAC', 'CMAC', 'Universal Hash'],
        requiredMethods: ['KeySetup', 'Init'],
        authMethods: ['authenticate', 'mac', 'encryptBlock', 'EncryptBlock'],
        testMethod: 'testMAC'
      },
      'kdf': {
        subcategories: ['Password-Based', 'Key-Based', 'Function-Based'],
        requiredMethods: ['Init'],
        deriveMethods: ['derive', 'pbkdf', 'encryptBlock', 'EncryptBlock'],
        testMethod: 'testKDF'
      },
      'checksum': {
        subcategories: ['CRC Family', 'Simple Checksum', 'Network Checksum'],
        requiredMethods: ['Init'],
        checksumMethods: ['checksum', 'hash', 'encryptBlock', 'EncryptBlock'],
        testMethod: 'testChecksum'
      }
    },
    
    /**
     * Initialize the test runner
     */
    init: function() {
      console.log('=== Universal Algorithm Tester v2.0 ===');
      console.log('Environment:', isNode ? 'Node.js' : 'Browser');
      console.log('');
      
      // Reset results
      this.results = {
        totalTests: 0,
        passed: 0,
        failed: 0,
        errors: 0,
        skipped: 0,
        categories: {},
        algorithmResults: {}
      };
      
      return true;
    },
    
    /**
     * Test a single algorithm with its test vectors
     * @param {Object} algorithm - Algorithm object with metadata and methods
     * @param {string} algorithmName - Name of the algorithm
     */
    testAlgorithm: function(algorithm, algorithmName) {
      if (!algorithm) {
        console.log(`❌ ${algorithmName}: Algorithm object is null or undefined`);
        this.results.errors++;
        return false;
      }
      
      console.log(`\n=== Testing ${algorithmName} ===`);
      
      // Detect algorithm category
      const category = this.detectAlgorithmCategory(algorithm);
      if (!category) {
        console.log(`⚠️  ${algorithmName}: Unknown algorithm category, skipping`);
        this.results.skipped++;
        return false;
      }
      
      console.log(`📋 Category: ${category} (${algorithm.subCategory || 'Unknown subcategory'})`);
      
      // Initialize category results if needed
      if (!this.results.categories[category]) {
        this.results.categories[category] = { total: 0, passed: 0, failed: 0, errors: 0, skipped: 0 };
      }
      
      // Get test vectors
      const testVectors = this.extractTestVectors(algorithm);
      if (!testVectors || testVectors.length === 0) {
        console.log(`⚠️  ${algorithmName}: No test vectors found, skipping functional tests`);
        this.results.skipped++;
        this.results.categories[category].skipped++;
        return this.performBasicValidation(algorithm, algorithmName, category);
      }
      
      console.log(`🧪 Found ${testVectors.length} test vector(s)`);
      
      // Test each vector
      let algorithmPassed = true;
      let testCount = 0;
      
      for (const vector of testVectors) {
        testCount++;
        console.log(`\n--- Test Vector ${testCount}: ${vector.text || vector.description || 'Unnamed'} ---`);
        
        const testResult = this.runTestVector(algorithm, vector, category, algorithmName);
        this.results.totalTests++;
        this.results.categories[category].total++;
        
        if (testResult.success) {
          this.results.passed++;
          this.results.categories[category].passed++;
          console.log(`✅ PASSED: ${testResult.message || 'Test vector validated successfully'}`);
        } else if (testResult.error) {
          this.results.errors++;
          this.results.categories[category].errors++;
          algorithmPassed = false;
          console.log(`❌ ERROR: ${testResult.message}`);
        } else {
          this.results.failed++;
          this.results.categories[category].failed++;
          algorithmPassed = false;
          console.log(`❌ FAILED: ${testResult.message}`);
        }
      }
      
      // Store algorithm result
      this.results.algorithmResults[algorithmName] = {
        category: category,
        testVectors: testVectors.length,
        passed: algorithmPassed,
        details: testCount > 0 ? `${testCount} test vectors` : 'Basic validation only'
      };
      
      return algorithmPassed;
    },
    
    /**
     * Detect algorithm category from metadata
     * @param {Object} algorithm - Algorithm object
     * @returns {string|null} - Detected category or null
     */
    detectAlgorithmCategory: function(algorithm) {
      // Check explicit category field
      if (algorithm.category && this.ALGORITHM_CATEGORIES[algorithm.category]) {
        return algorithm.category;
      }
      
      // Try to infer from algorithm properties and methods
      const methods = Object.getOwnPropertyNames(algorithm);
      
      // Check for hash-specific patterns
      if (methods.includes('Hash') || methods.includes('hash') || 
          (algorithm.name && algorithm.name.toLowerCase().includes('sha')) ||
          (algorithm.name && algorithm.name.toLowerCase().includes('md5')) ||
          (algorithm.cantDecode === true)) {
        return 'hash';
      }
      
      // Check for encoding patterns
      if (algorithm.name && (
          algorithm.name.toLowerCase().includes('base') ||
          algorithm.name.toLowerCase().includes('hex') ||
          algorithm.name.toLowerCase().includes('morse'))) {
        return 'encoding';
      }
      
      // Check for cipher patterns (most common)
      if (methods.includes('encryptBlock') || methods.includes('EncryptBlock') ||
          methods.includes('decryptBlock') || methods.includes('DecryptBlock')) {
        return 'cipher';
      }
      
      // Fallback to cipher for unknown patterns
      console.log(`⚠️  Could not detect category for algorithm, assuming 'cipher'`);
      return 'cipher';
    },
    
    /**
     * Extract test vectors from algorithm metadata
     * @param {Object} algorithm - Algorithm object
     * @returns {Array} - Array of test vectors
     */
    extractTestVectors: function(algorithm) {
      const vectors = [];
      
      // Check multiple possible locations for test vectors
      const possibleSources = [
        algorithm.tests,
        algorithm.testVectors,
        algorithm.metadata && algorithm.metadata.testVectors,
        algorithm.metadata && algorithm.metadata.tests
      ];
      
      for (const source of possibleSources) {
        if (Array.isArray(source)) {
          vectors.push(...source);
        }
      }
      
      return vectors;
    },
    
    /**
     * Run a single test vector against an algorithm
     * @param {Object} algorithm - Algorithm object
     * @param {Object} vector - Test vector
     * @param {string} category - Algorithm category
     * @param {string} algorithmName - Algorithm name
     * @returns {Object} - Test result
     */
    runTestVector: function(algorithm, vector, category, algorithmName) {
      try {
        // Get category configuration
        const categoryConfig = this.ALGORITHM_CATEGORIES[category];
        if (!categoryConfig) {
          return { success: false, error: true, message: `Unknown category: ${category}` };
        }
        
        // Call appropriate test method
        const testMethodName = categoryConfig.testMethod;
        if (this[testMethodName]) {
          return this[testMethodName](algorithm, vector, algorithmName);
        } else {
          return { success: false, error: true, message: `Test method ${testMethodName} not implemented` };
        }
        
      } catch (error) {
        return { 
          success: false, 
          error: true, 
          message: `Exception during test: ${error.message}` 
        };
      }
    },
    
    /**
     * Test cipher algorithms
     */
    testCipher: function(algorithm, vector, algorithmName) {
      try {
        // Initialize if needed
        if (algorithm.Init && typeof algorithm.Init === 'function') {
          algorithm.Init();
        }
        
        // Prepare test data
        const input = this.prepareTestData(vector.input || vector.plaintext || vector.data);
        const expectedOutput = this.prepareTestData(vector.expected || vector.ciphertext || vector.output);
        const key = this.prepareTestData(vector.key);
        
        if (!input) {
          return { success: false, message: 'No input data in test vector' };
        }
        
        if (!expectedOutput) {
          return { success: false, message: 'No expected output in test vector' };
        }
        
        // Set up key
        let keyId = null;
        if (algorithm.KeySetup && typeof algorithm.KeySetup === 'function') {
          keyId = algorithm.KeySetup(key || '');
          if (!keyId) {
            return { success: false, message: 'KeySetup failed' };
          }
        }
        
        try {
          // Test encryption
          let actualOutput = null;
          if (algorithm.encryptBlock && typeof algorithm.encryptBlock === 'function') {
            actualOutput = algorithm.encryptBlock(keyId, input);
          } else if (algorithm.EncryptBlock && typeof algorithm.EncryptBlock === 'function') {
            actualOutput = algorithm.EncryptBlock(keyId, input);
          } else {
            return { success: false, message: 'No encrypt method found' };
          }
          
          // Compare results
          const success = this.compareResults(actualOutput, expectedOutput);
          const message = success ? 'Cipher test passed' : `Output mismatch - Expected: ${this.formatOutput(expectedOutput)}, Got: ${this.formatOutput(actualOutput)}`;
          
          return { success: success, message: message };
          
        } finally {
          // Clean up
          if (keyId && algorithm.ClearData && typeof algorithm.ClearData === 'function') {
            algorithm.ClearData(keyId);
          }
        }
        
      } catch (error) {
        return { success: false, error: true, message: error.message };
      }
    },
    
    /**
     * Test hash algorithms
     */
    testHash: function(algorithm, vector, algorithmName) {
      try {
        // Initialize if needed
        if (algorithm.Init && typeof algorithm.Init === 'function') {
          algorithm.Init();
        }
        
        // Prepare test data
        const input = this.prepareTestData(vector.input || vector.data || vector.message || '');
        const expectedHash = this.prepareTestData(vector.expected || vector.hash || vector.output);
        
        if (expectedHash === null) {
          return { success: false, message: 'No expected hash in test vector' };
        }
        
        // Test hashing
        let actualHash = null;
        if (algorithm.Hash && typeof algorithm.Hash === 'function') {
          actualHash = algorithm.Hash(input);
        } else if (algorithm.hash && typeof algorithm.hash === 'function') {
          actualHash = algorithm.hash(input);
        } else if (algorithm.encryptBlock && typeof algorithm.encryptBlock === 'function') {
          // Some hash functions use cipher interface
          const keyId = algorithm.KeySetup ? algorithm.KeySetup('') : null;
          actualHash = algorithm.encryptBlock(keyId, input);
          if (keyId && algorithm.ClearData) algorithm.ClearData(keyId);
        } else {
          return { success: false, message: 'No hash method found' };
        }
        
        // Compare results (handle hex string format)
        const success = this.compareResults(actualHash, expectedHash);
        const message = success ? 'Hash test passed' : `Hash mismatch - Expected: ${this.formatOutput(expectedHash)}, Got: ${this.formatOutput(actualHash)}`;
        
        return { success: success, message: message };
        
      } catch (error) {
        return { success: false, error: true, message: error.message };
      }
    },
    
    /**
     * Test encoding algorithms
     */
    testEncoding: function(algorithm, vector, algorithmName) {
      try {
        // Initialize if needed
        if (algorithm.Init && typeof algorithm.Init === 'function') {
          algorithm.Init();
        }
        
        // Prepare test data
        const input = this.prepareTestData(vector.input || vector.data || vector.plaintext);
        const expectedOutput = this.prepareTestData(vector.expected || vector.encoded || vector.output);
        
        if (input === null) {
          return { success: false, message: 'No input data in test vector' };
        }
        
        if (expectedOutput === null) {
          return { success: false, message: 'No expected output in test vector' };
        }
        
        // Set up key (encodings usually don't need keys)
        let keyId = null;
        if (algorithm.KeySetup && typeof algorithm.KeySetup === 'function') {
          keyId = algorithm.KeySetup(vector.key || '');
        }
        
        try {
          // Test encoding
          let actualOutput = null;
          if (algorithm.encode && typeof algorithm.encode === 'function') {
            actualOutput = algorithm.encode(input);
          } else if (algorithm.encryptBlock && typeof algorithm.encryptBlock === 'function') {
            actualOutput = algorithm.encryptBlock(keyId, input);
          } else if (algorithm.EncryptBlock && typeof algorithm.EncryptBlock === 'function') {
            actualOutput = algorithm.EncryptBlock(keyId, input);
          } else {
            return { success: false, message: 'No encode method found' };
          }
          
          // Compare results
          const success = this.compareResults(actualOutput, expectedOutput);
          const message = success ? 'Encoding test passed' : `Output mismatch - Expected: ${this.formatOutput(expectedOutput)}, Got: ${this.formatOutput(actualOutput)}`;
          
          return { success: success, message: message };
          
        } finally {
          // Clean up
          if (keyId && algorithm.ClearData && typeof algorithm.ClearData === 'function') {
            algorithm.ClearData(keyId);
          }
        }
        
      } catch (error) {
        return { success: false, error: true, message: error.message };
      }
    },
    
    /**
     * Test compression algorithms
     */
    testCompression: function(algorithm, vector, algorithmName) {
      try {
        // Initialize if needed
        if (algorithm.Init && typeof algorithm.Init === 'function') {
          algorithm.Init();
        }
        
        // Prepare test data
        const input = this.prepareTestData(vector.input || vector.data);
        const expectedOutput = this.prepareTestData(vector.expected || vector.compressed || vector.output);
        
        if (input === null) {
          return { success: false, message: 'No input data in test vector' };
        }
        
        // Test compression
        let actualOutput = null;
        if (algorithm.compress && typeof algorithm.compress === 'function') {
          actualOutput = algorithm.compress(input);
        } else if (algorithm.encryptBlock && typeof algorithm.encryptBlock === 'function') {
          const keyId = algorithm.KeySetup ? algorithm.KeySetup('') : null;
          actualOutput = algorithm.encryptBlock(keyId, input);
          if (keyId && algorithm.ClearData) algorithm.ClearData(keyId);
        } else {
          return { success: false, message: 'No compress method found' };
        }
        
        if (expectedOutput !== null) {
          // Compare with expected output if provided
          const success = this.compareResults(actualOutput, expectedOutput);
          const message = success ? 'Compression test passed' : `Output mismatch - Expected: ${this.formatOutput(expectedOutput)}, Got: ${this.formatOutput(actualOutput)}`;
          return { success: success, message: message };
        } else {
          // Just verify compression produced some output
          const success = actualOutput !== null && actualOutput !== input;
          const message = success ? 'Compression produced output' : 'Compression failed to produce output';
          return { success: success, message: message };
        }
        
      } catch (error) {
        return { success: false, error: true, message: error.message };
      }
    },
    
    /**
     * Test MAC algorithms
     */
    testMAC: function(algorithm, vector, algorithmName) {
      try {
        // Initialize if needed
        if (algorithm.Init && typeof algorithm.Init === 'function') {
          algorithm.Init();
        }
        
        // Prepare test data
        const input = this.prepareTestData(vector.input || vector.data || vector.message);
        const key = this.prepareTestData(vector.key);
        const expectedMAC = this.prepareTestData(vector.expected || vector.mac || vector.tag || vector.output);
        
        if (input === null) {
          return { success: false, message: 'No input data in test vector' };
        }
        
        if (expectedMAC === null) {
          return { success: false, message: 'No expected MAC in test vector' };
        }
        
        // Set up key
        let keyId = null;
        if (algorithm.KeySetup && typeof algorithm.KeySetup === 'function') {
          keyId = algorithm.KeySetup(key || '');
          if (!keyId) {
            return { success: false, message: 'KeySetup failed for MAC' };
          }
        }
        
        try {
          // Test MAC generation
          let actualMAC = null;
          if (algorithm.authenticate && typeof algorithm.authenticate === 'function') {
            actualMAC = algorithm.authenticate(input, key);
          } else if (algorithm.mac && typeof algorithm.mac === 'function') {
            actualMAC = algorithm.mac(input, key);
          } else if (algorithm.encryptBlock && typeof algorithm.encryptBlock === 'function') {
            actualMAC = algorithm.encryptBlock(keyId, input);
          } else {
            return { success: false, message: 'No MAC method found' };
          }
          
          // Compare results
          const success = this.compareResults(actualMAC, expectedMAC);
          const message = success ? 'MAC test passed' : `MAC mismatch - Expected: ${this.formatOutput(expectedMAC)}, Got: ${this.formatOutput(actualMAC)}`;
          
          return { success: success, message: message };
          
        } finally {
          // Clean up
          if (keyId && algorithm.ClearData && typeof algorithm.ClearData === 'function') {
            algorithm.ClearData(keyId);
          }
        }
        
      } catch (error) {
        return { success: false, error: true, message: error.message };
      }
    },
    
    /**
     * Test KDF algorithms
     */
    testKDF: function(algorithm, vector, algorithmName) {
      try {
        // Initialize if needed
        if (algorithm.Init && typeof algorithm.Init === 'function') {
          algorithm.Init();
        }
        
        // Prepare test data
        const password = this.prepareTestData(vector.password || vector.input || vector.key);
        const salt = this.prepareTestData(vector.salt);
        const iterations = vector.iterations || vector.rounds || 1000;
        const outputSize = vector.outputSize || vector.dkLen || 32;
        const expectedOutput = this.prepareTestData(vector.expected || vector.derivedKey || vector.output);
        
        if (password === null) {
          return { success: false, message: 'No password/input in test vector' };
        }
        
        if (expectedOutput === null) {
          return { success: false, message: 'No expected derived key in test vector' };
        }
        
        // Test key derivation
        let actualOutput = null;
        if (algorithm.derive && typeof algorithm.derive === 'function') {
          actualOutput = algorithm.derive(password, salt, iterations, outputSize);
        } else if (algorithm.pbkdf && typeof algorithm.pbkdf === 'function') {
          actualOutput = algorithm.pbkdf(password, salt, iterations, outputSize);
        } else if (algorithm.encryptBlock && typeof algorithm.encryptBlock === 'function') {
          const keyId = algorithm.KeySetup ? algorithm.KeySetup(password) : null;
          actualOutput = algorithm.encryptBlock(keyId, salt || '');
          if (keyId && algorithm.ClearData) algorithm.ClearData(keyId);
        } else {
          return { success: false, message: 'No KDF method found' };
        }
        
        // Compare results
        const success = this.compareResults(actualOutput, expectedOutput);
        const message = success ? 'KDF test passed' : `Derived key mismatch - Expected: ${this.formatOutput(expectedOutput)}, Got: ${this.formatOutput(actualOutput)}`;
        
        return { success: success, message: message };
        
      } catch (error) {
        return { success: false, error: true, message: error.message };
      }
    },
    
    /**
     * Test checksum algorithms
     */
    testChecksum: function(algorithm, vector, algorithmName) {
      try {
        // Initialize if needed
        if (algorithm.Init && typeof algorithm.Init === 'function') {
          algorithm.Init();
        }
        
        // Prepare test data
        const input = this.prepareTestData(vector.input || vector.data || vector.message || '');
        const expectedChecksum = this.prepareTestData(vector.expected || vector.checksum || vector.crc || vector.output);
        
        if (expectedChecksum === null) {
          return { success: false, message: 'No expected checksum in test vector' };
        }
        
        // Test checksum calculation
        let actualChecksum = null;
        if (algorithm.checksum && typeof algorithm.checksum === 'function') {
          actualChecksum = algorithm.checksum(input);
        } else if (algorithm.hash && typeof algorithm.hash === 'function') {
          actualChecksum = algorithm.hash(input);
        } else if (algorithm.encryptBlock && typeof algorithm.encryptBlock === 'function') {
          const keyId = algorithm.KeySetup ? algorithm.KeySetup('') : null;
          actualChecksum = algorithm.encryptBlock(keyId, input);
          if (keyId && algorithm.ClearData) algorithm.ClearData(keyId);
        } else {
          return { success: false, message: 'No checksum method found' };
        }
        
        // Compare results
        const success = this.compareResults(actualChecksum, expectedChecksum);
        const message = success ? 'Checksum test passed' : `Checksum mismatch - Expected: ${this.formatOutput(expectedChecksum)}, Got: ${this.formatOutput(actualChecksum)}`;
        
        return { success: success, message: message };
        
      } catch (error) {
        return { success: false, error: true, message: error.message };
      }
    },
    
    /**
     * Perform basic validation when no test vectors are available
     */
    performBasicValidation: function(algorithm, algorithmName, category) {
      console.log(`🔍 Performing basic validation for ${algorithmName}`);
      
      const categoryConfig = this.ALGORITHM_CATEGORIES[category];
      if (!categoryConfig) {
        console.log(`❌ Unknown category: ${category}`);
        return false;
      }
      
      // Check required methods exist
      for (const method of categoryConfig.requiredMethods || []) {
        if (typeof algorithm[method] !== 'function') {
          console.log(`❌ Missing required method: ${method}`);
          return false;
        }
      }
      
      console.log(`✅ Basic validation passed - required methods present`);
      return true;
    },
    
    /**
     * Prepare test data from various input formats
     */
    prepareTestData: function(data) {
      if (data === null || data === undefined) {
        return null;
      }
      
      // Handle different input types
      if (typeof data === 'string') {
        return data;
      }
      
      if (Array.isArray(data)) {
        // Convert byte array to string
        return String.fromCharCode.apply(null, data);
      }
      
      if (typeof data === 'object' && data.constructor === Uint8Array) {
        // Convert Uint8Array to string
        return String.fromCharCode.apply(null, Array.from(data));
      }
      
      // Convert to string as fallback
      return String(data);
    },
    
    /**
     * Compare test results with expected output
     */
    compareResults: function(actual, expected) {
      if (actual === expected) {
        return true;
      }
      
      // Handle null/undefined cases
      if (actual == null || expected == null) {
        return false;
      }
      
      // Convert both to comparable format
      const actualStr = this.normalizeOutput(actual);
      const expectedStr = this.normalizeOutput(expected);
      
      return actualStr === expectedStr;
    },
    
    /**
     * Normalize output for comparison
     */
    normalizeOutput: function(output) {
      if (output == null) {
        return '';
      }
      
      if (typeof output === 'string') {
        // Remove whitespace and convert to lowercase for hex comparisons
        return output.replace(/\s+/g, '').toLowerCase();
      }
      
      if (Array.isArray(output)) {
        // Convert byte array to hex string
        return output.map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('').toLowerCase();
      }
      
      return String(output).toLowerCase();
    },
    
    /**
     * Format output for display
     */
    formatOutput: function(output) {
      if (output == null) {
        return 'null';
      }
      
      if (typeof output === 'string') {
        // Show first 50 characters
        return output.length > 50 ? output.substring(0, 50) + '...' : output;
      }
      
      if (Array.isArray(output)) {
        // Show first 10 bytes as hex
        const hex = output.slice(0, 10).map(b => (b & 0xFF).toString(16).padStart(2, '0')).join(' ');
        return output.length > 10 ? `[${hex}...]` : `[${hex}]`;
      }
      
      return String(output);
    },
    
    /**
     * Test all algorithms registered with the Cipher system
     */
    testAllAlgorithms: function() {
      this.init();
      
      if (typeof Cipher === 'undefined' || !Cipher.GetCiphers) {
        console.log('❌ Cipher system not available');
        return false;
      }
      
      const availableAlgorithms = Cipher.GetCiphers();
      console.log(`📊 Found ${availableAlgorithms.length} registered algorithms\n`);
      
      if (availableAlgorithms.length === 0) {
        console.log('⚠️  No algorithms registered in Cipher system');
        return false;
      }
      
      let overallSuccess = true;
      
      // Test each algorithm
      for (const algorithmName of availableAlgorithms) {
        try {
          const algorithm = Cipher.GetCipher(algorithmName);
          const success = this.testAlgorithm(algorithm, algorithmName);
          if (!success) {
            overallSuccess = false;
          }
        } catch (error) {
          console.log(`❌ ${algorithmName}: Exception during testing - ${error.message}`);
          this.results.errors++;
          overallSuccess = false;
        }
      }
      
      // Print summary
      this.printSummary();
      
      return overallSuccess;
    },
    
    /**
     * Test algorithms in a specific category
     */
    testCategory: function(categoryName) {
      this.init();
      
      if (!this.ALGORITHM_CATEGORIES[categoryName]) {
        console.log(`❌ Unknown category: ${categoryName}`);
        return false;
      }
      
      console.log(`🎯 Testing algorithms in category: ${categoryName}\n`);
      
      if (typeof Cipher === 'undefined' || !Cipher.GetCiphers) {
        console.log('❌ Cipher system not available');
        return false;
      }
      
      const availableAlgorithms = Cipher.GetCiphers();
      const categoryAlgorithms = [];
      
      // Filter algorithms by category
      for (const algorithmName of availableAlgorithms) {
        try {
          const algorithm = Cipher.GetCipher(algorithmName);
          const detectedCategory = this.detectAlgorithmCategory(algorithm);
          if (detectedCategory === categoryName) {
            categoryAlgorithms.push(algorithmName);
          }
        } catch (error) {
          console.log(`⚠️  Skipping ${algorithmName} due to error: ${error.message}`);
        }
      }
      
      if (categoryAlgorithms.length === 0) {
        console.log(`⚠️  No algorithms found in category: ${categoryName}`);
        return false;
      }
      
      console.log(`📊 Found ${categoryAlgorithms.length} algorithms in category ${categoryName}`);
      
      let overallSuccess = true;
      
      // Test each algorithm in the category
      for (const algorithmName of categoryAlgorithms) {
        try {
          const algorithm = Cipher.GetCipher(algorithmName);
          const success = this.testAlgorithm(algorithm, algorithmName);
          if (!success) {
            overallSuccess = false;
          }
        } catch (error) {
          console.log(`❌ ${algorithmName}: Exception during testing - ${error.message}`);
          this.results.errors++;
          overallSuccess = false;
        }
      }
      
      // Print summary
      this.printSummary();
      
      return overallSuccess;
    },
    
    /**
     * Print comprehensive test summary
     */
    printSummary: function() {
      console.log('\n' + '='.repeat(60));
      console.log('🏁 UNIVERSAL ALGORITHM TEST SUMMARY');
      console.log('='.repeat(60));
      
      // Overall results
      console.log(`📊 Total Tests: ${this.results.totalTests}`);
      console.log(`✅ Passed: ${this.results.passed} (${Math.round(this.results.passed / Math.max(this.results.totalTests, 1) * 100)}%)`);
      console.log(`❌ Failed: ${this.results.failed} (${Math.round(this.results.failed / Math.max(this.results.totalTests, 1) * 100)}%)`);
      console.log(`🚫 Errors: ${this.results.errors} (${Math.round(this.results.errors / Math.max(this.results.totalTests, 1) * 100)}%)`);
      console.log(`⏭️  Skipped: ${this.results.skipped} (${Math.round(this.results.skipped / Math.max(this.results.totalTests, 1) * 100)}%)`);
      
      // Category breakdown
      if (Object.keys(this.results.categories).length > 0) {
        console.log('\n📋 Results by Category:');
        for (const [category, stats] of Object.entries(this.results.categories)) {
          const total = stats.total + stats.skipped;
          console.log(`  ${category}: ${stats.passed}/${total} passed (${stats.failed} failed, ${stats.errors} errors, ${stats.skipped} skipped)`);
        }
      }
      
      // Algorithm results
      if (Object.keys(this.results.algorithmResults).length > 0) {
        console.log('\n🧪 Algorithm Results:');
        for (const [name, result] of Object.entries(this.results.algorithmResults)) {
          const status = result.passed ? '✅' : '❌';
          console.log(`  ${status} ${name} (${result.category}): ${result.details}`);
        }
      }
      
      console.log('='.repeat(60));
      
      const overallSuccess = this.results.failed === 0 && this.results.errors === 0;
      console.log(overallSuccess ? '🎉 ALL TESTS SUCCESSFUL!' : '⚠️  SOME TESTS FAILED - CHECK RESULTS ABOVE');
    }
  };
  
  // Export for both environments
  if (isNode) {
    module.exports = UniversalAlgorithmTester;
    
    // Auto-run if this is the main module
    if (require.main === module) {
      // Check command line arguments
      const args = process.argv.slice(2);
      
      if (args.length > 0) {
        const command = args[0].toLowerCase();
        
        if (command === 'category' && args.length > 1) {
          const categoryName = args[1].toLowerCase();
          UniversalAlgorithmTester.testCategory(categoryName);
        } else if (command === 'help' || command === '-h' || command === '--help') {
          console.log('Universal Algorithm Tester Usage:');
          console.log('  node universal-algorithm-tester.js                 - Test all algorithms');
          console.log('  node universal-algorithm-tester.js category <name> - Test specific category');
          console.log('  node universal-algorithm-tester.js help            - Show this help');
          console.log('');
          console.log('Available categories:');
          for (const category of Object.keys(UniversalAlgorithmTester.ALGORITHM_CATEGORIES)) {
            console.log(`  - ${category}`);
          }
        } else {
          console.log('Unknown command. Use "help" for usage information.');
        }
      } else {
        // Default: test all algorithms
        UniversalAlgorithmTester.testAllAlgorithms();
      }
    }
  } else {
    global.UniversalAlgorithmTester = UniversalAlgorithmTester;
  }
  
})(typeof global !== 'undefined' ? global : window);