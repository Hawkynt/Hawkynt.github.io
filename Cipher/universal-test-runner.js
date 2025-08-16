#!/usr/bin/env node
/*
 * Universal Cipher Test Runner
 * Tests cipher implementations in both Node.js and Browser environments
 * (c)2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection
  const isNode = typeof module !== 'undefined' && module.exports;
  const isBrowser = typeof window !== 'undefined';
  
  // Load dependencies for Node.js
  if (isNode) {
    require('./universal-cipher-env.js');
    require('./cipher-universal.js');
    require('./official_test_vectors.js');
    
    // Load universal cipher implementations
    const cipherModules = [
      './caesar-universal.js',
      './base64-universal.js',
      './rot-universal.js',
      './atbash-universal.js',
      './anubis-universal.js',
      './blowfish-universal.js',
      './cast128-universal.js',
      './des-universal.js',
      './3des-universal.js',
      './rijndael-universal.js',
      './idea-universal.js',
      './khazad-universal.js',
      './seed-universal.js',
      './tea-universal.js',
      './xtea-universal.js',
      './threefish-universal.js',
      './twofish-universal.js',
      './camellia-universal.js',
      './mars-universal.js',
      './noekeon-universal.js',
      './rc2-universal.js',
      './rc5-universal.js',
      './rc6-universal.js',
      './rc4-universal.js',
      './salsa20-universal.js',
      './chacha20-universal.js',
      './serpent-universal.js',
      './square-universal.js',
      './skipjack-universal.js',
      './safer-universal.js',
      './gost28147-universal.js',
      './sm4-universal.js',
      './speck-universal.js',
      './present-universal.js'
    ];
    
    console.log('=== Loading Universal Cipher System ===');
    cipherModules.forEach(module => {
      try {
        require(module);
        console.log(`✓ Loaded: ${module}`);
      } catch (error) {
        console.error(`✗ Failed to load ${module}:`, error.message);
      }
    });
  }
  
  // Test runner class
  const UniversalTestRunner = {
    
    // Helper function for hex conversion
    stringToHex: function(str) {
      if (!str) return '';
      let hex = '';
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        hex += (code < 16 ? '0' : '') + code.toString(16).toUpperCase() + ' ';
      }
      return hex.trim();
    },
    
    // Run comprehensive tests
    runAllTests: function() {
      console.log('\n=== UNIVERSAL CIPHER TESTING ===');
      console.log(`Environment: ${isNode ? 'Node.js' : 'Browser'}`);
      
      if (typeof global.officialTestVectors === 'undefined') {
        console.error('✗ Official test vectors not loaded');
        return { success: false, error: 'Test vectors not available' };
      }
      
      if (typeof global.Cipher === 'undefined') {
        console.error('✗ Cipher system not loaded');
        return { success: false, error: 'Cipher system not available' };
      }
      
      const availableCiphers = global.Cipher.getCiphers();
      console.log(`Available ciphers: ${availableCiphers.join(', ')}`);
      
      let totalTests = 0;
      let passedTests = 0;
      let failedTests = 0;
      let errorTests = 0;
      const results = {};
      
      console.log('\n=== Testing Individual Algorithms ===');
      
      for (const cipherName of availableCiphers) {
        console.log(`\n--- Testing ${cipherName} ---`);
        
        const testVectors = global.officialTestVectors[cipherName];
        if (!testVectors) {
          console.log(`  ⚠️  No test vectors available for ${cipherName}`);
          continue;
        }
        
        results[cipherName] = { passed: 0, failed: 0, errors: 0, details: [] };
        
        // Check if cipher exists
        if (!global.Cipher.boolExistsCipher(cipherName)) {
          console.log(`  ✗ Cipher ${cipherName} not registered`);
          results[cipherName].errors = testVectors.length;
          errorTests += testVectors.length;
          totalTests += testVectors.length;
          continue;
        }
        
        for (let i = 0; i < testVectors.length; i++) {
          const testVector = testVectors[i];
          totalTests++;
          
          console.log(`  Test ${i + 1}: ${testVector.description}`);
          
          try {
            // Initialize cipher
            const cipherID = global.Cipher.InitCipher(cipherName, testVector.key);
            if (!cipherID) {
              throw new Error('Failed to initialize cipher');
            }
            
            // Perform encryption
            let output = global.Cipher.szEncrypt(cipherID, testVector.input);
            output = output.substring(0, testVector.expected.length);
            
            // Clean up
            global.Cipher.ClearData(cipherID);
            
            // Compare results
            if (output === testVector.expected) {
              console.log(`    ✓ PASS`);
              passedTests++;
              results[cipherName].passed++;
            } else {
              console.log(`    ✗ FAIL - Output mismatch`);
              console.log(`      Input:    "${testVector.input}" | Hex: ${UniversalTestRunner.stringToHex(testVector.input)}`);
              console.log(`      Key:      "${testVector.key}" | Hex: ${UniversalTestRunner.stringToHex(testVector.key)}`);
              console.log(`      Expected: "${testVector.expected}" | Hex: ${UniversalTestRunner.stringToHex(testVector.expected)}`);
              console.log(`      Got:      "${output}" | Hex: ${UniversalTestRunner.stringToHex(output)}`);
              failedTests++;
              results[cipherName].failed++;
            }
            
            results[cipherName].details.push({
              description: testVector.description,
              status: output === testVector.expected ? 'pass' : 'fail',
              input: testVector.input,
              key: testVector.key,
              expected: testVector.expected,
              output: output
            });
            
          } catch (error) {
            console.log(`    ✗ ERROR: ${error.message}`);
            errorTests++;
            results[cipherName].errors++;
            
            results[cipherName].details.push({
              description: testVector.description,
              status: 'error',
              error: error.message
            });
          }
        }
      }
      
      // Summary
      console.log('\n=== TEST SUMMARY ===');
      console.log(`Total tests: ${totalTests}`);
      console.log(`Passed: ${passedTests} (${totalTests > 0 ? Math.round(passedTests/totalTests*100) : 0}%)`);
      console.log(`Failed: ${failedTests} (${totalTests > 0 ? Math.round(failedTests/totalTests*100) : 0}%)`);
      console.log(`Errors: ${errorTests} (${totalTests > 0 ? Math.round(errorTests/totalTests*100) : 0}%)`);
      
      console.log('\n=== CIPHER-BY-CIPHER RESULTS ===');
      for (const cipherName in results) {
        const result = results[cipherName];
        const total = result.passed + result.failed + result.errors;
        let status = '❌ FAILED';
        if (result.errors === 0 && result.failed === 0) {
          status = '✅ PASSED';
        } else if (result.errors === 0) {
          status = '⚠️  ISSUES';
        }
        
        console.log(`${cipherName}: ${status} (${result.passed}/${total} passed, ${result.failed} failed, ${result.errors} errors)`);
      }
      
      if (failedTests > 0 || errorTests > 0) {
        console.log('\n=== DETAILED FAILURE ANALYSIS ===');
        for (const cipherName in results) {
          const result = results[cipherName];
          if (result.failed > 0 || result.errors > 0) {
            console.log(`\n${cipherName} issues:`);
            result.details.forEach(detail => {
              if (detail.status !== 'pass') {
                console.log(`  - ${detail.description}: ${detail.status === 'error' ? detail.error : 'output mismatch'}`);
              }
            });
          }
        }
      }
      
      return {
        success: errorTests === 0 && failedTests === 0,
        totalTests: totalTests,
        passedTests: passedTests,
        failedTests: failedTests,
        errorTests: errorTests,
        results: results
      };
    },
    
    // Test specific cipher
    testCipher: function(cipherName) {
      if (!global.Cipher.boolExistsCipher(cipherName)) {
        console.error(`Cipher ${cipherName} not available`);
        return false;
      }
      
      const testVectors = global.officialTestVectors[cipherName];
      if (!testVectors) {
        console.warn(`No test vectors for ${cipherName}`);
        return true; // Not a failure, just no tests
      }
      
      console.log(`Testing ${cipherName} with ${testVectors.length} test vectors...`);
      
      for (let i = 0; i < testVectors.length; i++) {
        const testVector = testVectors[i];
        
        try {
          const cipherID = global.Cipher.InitCipher(cipherName, testVector.key);
          const output = global.Cipher.szEncrypt(cipherID, testVector.input);
          global.Cipher.ClearData(cipherID);
          
          if (output === testVector.expected) {
            console.log(`  ✓ ${testVector.description}`);
          } else {
            console.log(`  ✗ ${testVector.description} - FAILED`);
            return false;
          }
        } catch (error) {
          console.log(`  ✗ ${testVector.description} - ERROR: ${error.message}`);
          return false;
        }
      }
      
      return true;
    }
  };
  
  // Export for both environments
  global.UniversalTestRunner = UniversalTestRunner;
  
  // Auto-run tests in Node.js
  if (isNode && require.main === module) {
    const testResults = UniversalTestRunner.runAllTests();
    process.exit(testResults.success ? 0 : 1);
  }
  
  // Node.js module export
  if (isNode && module.exports) {
    module.exports = UniversalTestRunner;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);