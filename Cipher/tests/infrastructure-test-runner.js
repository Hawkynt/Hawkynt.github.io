#!/usr/bin/env node
/*
 * Infrastructure Test Runner
 * Validates core systems: cipher loading, test vectors, code generation, chaining
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load core systems for testing
  if (typeof require !== 'undefined') {
    try {
      require('../OpCodes.js');
      require('../universal-cipher-env.js');
      require('../cipher.js');
      require('../code-generation-interface.js');
      require('../algorithm-chaining-system.js');
      require('../test-vector-system.js');
    } catch (e) {
      console.error('Failed to load dependencies:', e.message);
      process.exit(1);
    }
  }
  
  const InfrastructureTests = {
    
    testResults: [],
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    
    // Test OpCodes functionality
    testOpCodes: function() {
      console.log('\n=== Testing OpCodes Infrastructure ===');
      
      // Test basic operations
      this.runTest('OpCodes.RotL32', () => {
        const result = global.OpCodes.RotL32(0x12345678, 8);
        return result === 0x34567812;
      });
      
      this.runTest('OpCodes.Pack32BE', () => {
        const result = global.OpCodes.Pack32BE(0x12, 0x34, 0x56, 0x78);
        return result === 0x12345678;
      });
      
      this.runTest('OpCodes.StringToBytes', () => {
        const result = global.OpCodes.StringToBytes('ABC');
        return result.length === 3 && result[0] === 65 && result[1] === 66 && result[2] === 67;
      });
      
      this.runTest('OpCodes.XorArrays', () => {
        const a = [0x12, 0x34, 0x56];
        const b = [0x78, 0x9A, 0xBC];
        const result = global.OpCodes.XorArrays(a, b);
        return result[0] === (0x12 ^ 0x78) && result[1] === (0x34 ^ 0x9A) && result[2] === (0x56 ^ 0xBC);
      });
    },
    
    // Test cipher system loading
    testCipherSystem: function() {
      console.log('\n=== Testing Cipher System Infrastructure ===');
      
      this.runTest('Cipher object exists', () => {
        return typeof global.Cipher === 'object' && global.Cipher !== null;
      });
      
      this.runTest('Cipher.AddCipher function', () => {
        return typeof global.Cipher.AddCipher === 'function';
      });
      
      this.runTest('Cipher.getCiphers function', () => {
        return typeof global.Cipher.getCiphers === 'function';
      });
      
      // Test cipher registration
      this.runTest('Cipher registration', () => {
        const testCipher = {
          internalName: 'TestCipher',
          name: 'Test Cipher',
          minKeyLength: 16,
          maxKeyLength: 32,
          stepKeyLength: 1,
          minBlockSize: 16,
          maxBlockSize: 16,
          stepBlockSize: 1,
          instances: {},
          KeySetup: function() { return 'test-id'; },
          encryptBlock: function() { return 'encrypted'; },
          decryptBlock: function() { return 'decrypted'; }
        };
        
        const added = global.Cipher.AddCipher(testCipher);
        const exists = global.Cipher.boolExistsCipher('TestCipher');
        
        return added && exists;
      });
    },
    
    // Test algorithm loading from directories
    testAlgorithmLoading: function() {
      console.log('\n=== Testing Algorithm Loading ===');
      
      const fs = require('fs');
      const path = require('path');
      
      // Test loading algorithms from different categories
      const categories = ['block', 'stream', 'hash', 'classical', 'compression'];
      
      categories.forEach(category => {
        this.runTest(`Load ${category} algorithms`, () => {
          try {
            const categoryPath = path.join(__dirname, '..', 'algorithms', category);
            if (!fs.existsSync(categoryPath)) return true; // Skip if doesn't exist
            
            const files = fs.readdirSync(categoryPath)
              .filter(file => file.endsWith('.js'))
              .slice(0, 2); // Test first 2 files only for speed
            
            let loadedCount = 0;
            files.forEach(file => {
              try {
                require(path.join(categoryPath, file));
                loadedCount++;
              } catch (e) {
                console.warn(`Failed to load ${file}:`, e.message);
              }
            });
            
            return loadedCount > 0 || files.length === 0;
          } catch (e) {
            console.warn(`Category ${category} test failed:`, e.message);
            return false;
          }
        });
      });
    },
    
    // Test code generation system
    testCodeGeneration: function() {
      console.log('\n=== Testing Code Generation Infrastructure ===');
      
      if (!global.CodeGenerationInterface) {
        console.warn('CodeGenerationInterface not loaded, skipping tests');
        return;
      }
      
      const languages = ['python', 'cpp', 'java', 'rust'];
      
      languages.forEach(lang => {
        this.runTest(`Generate ${lang} code`, () => {
          try {
            const generateMethod = `generate${lang.charAt(0).toUpperCase() + lang.slice(1)}`;
            if (typeof global.CodeGenerationInterface[generateMethod] === 'function') {
              const code = global.CodeGenerationInterface[generateMethod]('TestAlgorithm', 'Test Algorithm', {});
              return typeof code === 'string' && code.length > 0;
            }
            return false;
          } catch (e) {
            console.warn(`Code generation for ${lang} failed:`, e.message);
            return false;
          }
        });
      });
    },
    
    // Test algorithm chaining system
    testChaining: function() {
      console.log('\n=== Testing Algorithm Chaining Infrastructure ===');
      
      if (!global.AlgorithmChainSystem) {
        console.warn('AlgorithmChainSystem not loaded, skipping tests');
        return;
      }
      
      this.runTest('Create algorithm chain', () => {
        try {
          global.AlgorithmChainSystem.createNewChain();
          global.AlgorithmChainSystem.addOperationToChain('caesar', 'classical');
          global.AlgorithmChainSystem.addOperationToChain('base64', 'encoding');
          const chain = global.AlgorithmChainSystem.getCurrentChain();
          return Array.isArray(chain) && chain.length === 2;
        } catch (e) {
          console.warn('Chain creation failed:', e.message);
          return false;
        }
      });
      
      this.runTest('Validate chain execution', () => {
        try {
          const result = global.AlgorithmChainSystem.validateChain();
          return typeof result === 'object';
        } catch (e) {
          console.warn('Chain validation failed:', e.message);
          return false;
        }
      });
    },
    
    // Test vector validation system
    testVectorSystem: function() {
      console.log('\n=== Testing Test Vector Infrastructure ===');
      
      if (!global.TestVectorSystem) {
        console.warn('TestVectorSystem not loaded, skipping tests');
        return;
      }
      
      this.runTest('Get test vectors', () => {
        try {
          const vectors = global.TestVectorSystem.getTestVectors('rijndael');
          return vectors !== null && typeof vectors === 'object';
        } catch (e) {
          console.warn('Test vector retrieval failed:', e.message);
          return false;
        }
      });
      
      this.runTest('Generate test report', () => {
        try {
          const mockResults = { passed: 3, failed: 1, total: 4, results: [] };
          const report = global.TestVectorSystem.generateTestReport('rijndael', mockResults);
          return typeof report === 'string' && report.includes('Test Vector Report');
        } catch (e) {
          console.warn('Test report generation failed:', e.message);
          return false;
        }
      });
    },
    
    // Test comprehensive algorithm functionality
    testAlgorithmFunctionality: function() {
      console.log('\n=== Testing Algorithm Functionality ===');
      
      // Test basic encryption/decryption if algorithms are loaded
      const ciphers = global.Cipher.getCiphers();
      
      if (ciphers.length > 0) {
        const testCipherName = ciphers[0];
        
        this.runTest(`${testCipherName} key setup`, () => {
          try {
            const cipher = global.Cipher.objGetCipher(testCipherName);
            const key = 'testkey123456789'; // 16 bytes
            const id = global.Cipher.InitCipher(testCipherName, key);
            
            if (id) {
              global.Cipher.ClearData(id);
              return true;
            }
            return false;
          } catch (e) {
            console.warn(`Key setup for ${testCipherName} failed:`, e.message);
            return false;
          }
        });
      }
    },
    
    // Test file system operations
    testFileSystem: function() {
      console.log('\n=== Testing File System Operations ===');
      
      const fs = require('fs');
      const path = require('path');
      
      this.runTest('OpCodes.js exists', () => {
        return fs.existsSync(path.join(__dirname, '..', 'OpCodes.js'));
      });
      
      this.runTest('cipher.js exists', () => {
        return fs.existsSync(path.join(__dirname, '..', 'cipher.js'));
      });
      
      this.runTest('Algorithms directory structure', () => {
        const algDir = path.join(__dirname, '..', 'algorithms');
        if (!fs.existsSync(algDir)) return false;
        
        const categories = fs.readdirSync(algDir).filter(item => {
          return fs.statSync(path.join(algDir, item)).isDirectory();
        });
        
        return categories.length > 0;
      });
    },
    
    // Run individual test
    runTest: function(testName, testFunction) {
      this.totalTests++;
      
      try {
        const startTime = Date.now();
        const result = testFunction();
        const endTime = Date.now();
        
        if (result) {
          this.passedTests++;
          console.log(`✓ ${testName} (${endTime - startTime}ms)`);
          this.testResults.push({ name: testName, status: 'PASS', time: endTime - startTime });
        } else {
          this.failedTests++;
          console.log(`✗ ${testName} - Failed`);
          this.testResults.push({ name: testName, status: 'FAIL', time: endTime - startTime, error: 'Test returned false' });
        }
      } catch (error) {
        this.failedTests++;
        console.log(`✗ ${testName} - Error: ${error.message}`);
        this.testResults.push({ name: testName, status: 'ERROR', time: 0, error: error.message });
      }
    },
    
    // Run all infrastructure tests
    runAllTests: function() {
      console.log('SynthelicZ Cipher Tools - Infrastructure Test Suite');
      console.log('=====================================================');
      
      const startTime = Date.now();
      
      // Run all test suites
      this.testOpCodes();
      this.testCipherSystem();
      this.testFileSystem();
      this.testAlgorithmLoading();
      this.testCodeGeneration();
      this.testChaining();
      this.testVectorSystem();
      this.testAlgorithmFunctionality();
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Generate summary report
      console.log('\n=====================================================');
      console.log('Test Summary:');
      console.log(`Total Tests: ${this.totalTests}`);
      console.log(`Passed: ${this.passedTests}`);
      console.log(`Failed: ${this.failedTests}`);
      console.log(`Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);
      console.log(`Total Time: ${totalTime}ms`);
      
      if (this.failedTests > 0) {
        console.log('\nFailed Tests:');
        this.testResults
          .filter(test => test.status !== 'PASS')
          .forEach(test => {
            console.log(`  - ${test.name}: ${test.error || 'Unknown failure'}`);
          });
      }
      
      console.log('\n=== Infrastructure Validation Complete ===');
      
      return {
        total: this.totalTests,
        passed: this.passedTests,
        failed: this.failedTests,
        successRate: (this.passedTests / this.totalTests) * 100,
        totalTime: totalTime,
        results: this.testResults
      };
    }
  };
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = InfrastructureTests;
  }
  
  // Auto-run if called directly
  if (typeof require !== 'undefined' && require.main === module) {
    InfrastructureTests.runAllTests();
  }
  
  // Export to global scope
  global.InfrastructureTests = InfrastructureTests;
  
})(typeof global !== 'undefined' ? global : window);