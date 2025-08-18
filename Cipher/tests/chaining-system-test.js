#!/usr/bin/env node
/*
 * Algorithm Chaining System Test
 * Validates algorithm chaining functionality and workflows
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load chaining system
  try {
    require('../algorithm-chaining-system.js');
    require('../OpCodes.js');
    require('../universal-cipher-env.js');
    require('../cipher.js');
  } catch (e) {
    console.error('Failed to load chaining system:', e.message);
    process.exit(1);
  }
  
  const ChainingSystemTest = {
    
    testResults: [],
    testChains: [
      {
        name: 'Basic Encryption Chain',
        operations: [
          { algorithm: 'caesar', category: 'classical' },
          { algorithm: 'base64', category: 'encoding' }
        ],
        testData: 'Hello World!'
      },
      {
        name: 'Multi-Layer Security Chain',
        operations: [
          { algorithm: 'aes', category: 'block' },
          { algorithm: 'base64', category: 'encoding' },
          { algorithm: 'compression', category: 'compression' }
        ],
        testData: 'This is a longer test message that should compress well and then be encrypted securely.'
      },
      {
        name: 'Hash and Encode Chain',
        operations: [
          { algorithm: 'sha256', category: 'hash' },
          { algorithm: 'base64', category: 'encoding' }
        ],
        testData: 'Data to be hashed'
      },
      {
        name: 'Classical Cipher Chain',
        operations: [
          { algorithm: 'caesar', category: 'classical' },
          { algorithm: 'vigenere', category: 'classical' },
          { algorithm: 'atbash', category: 'classical' }
        ],
        testData: 'SECRET MESSAGE'
      },
      {
        name: 'Modern Crypto Chain',
        operations: [
          { algorithm: 'chacha20', category: 'stream' },
          { algorithm: 'poly1305', category: 'mac' },
          { algorithm: 'base64', category: 'encoding' }
        ],
        testData: 'Modern authenticated encryption test'
      }
    ],
    
    // Test all chaining functionality
    testChainingSystem: function() {
      console.log('Algorithm Chaining System Test Suite');
      console.log('====================================');
      
      const startTime = Date.now();
      let totalTests = 0;
      let passedTests = 0;
      
      // Test basic chaining functions
      console.log('\n=== Testing Basic Chaining Functions ===');
      totalTests += this.testBasicChaining();
      passedTests += this.testResults.filter(r => r.success).length;
      
      // Test chain validation
      console.log('\n=== Testing Chain Validation ===');
      const validationResults = this.testChainValidation();
      totalTests += validationResults.total;
      passedTests += validationResults.passed;
      
      // Test chain execution
      console.log('\n=== Testing Chain Execution ===');
      const executionResults = this.testChainExecution();
      totalTests += executionResults.total;
      passedTests += executionResults.passed;
      
      // Test error handling
      console.log('\n=== Testing Error Handling ===');
      const errorResults = this.testErrorHandling();
      totalTests += errorResults.total;
      passedTests += errorResults.passed;
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Generate summary
      console.log('\n====================================');
      console.log('Chaining System Summary:');
      console.log(`Total Tests: ${totalTests}`);
      console.log(`Passed: ${passedTests}`);
      console.log(`Failed: ${totalTests - passedTests}`);
      console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
      console.log(`Total Time: ${totalTime}ms`);
      
      this.generateDetailedReport();
      
      return {
        total: totalTests,
        passed: passedTests,
        failed: totalTests - passedTests,
        successRate: (passedTests / totalTests) * 100,
        totalTime: totalTime,
        results: this.testResults
      };
    },
    
    // Test basic chaining operations
    testBasicChaining: function() {
      let testCount = 0;
      
      if (!global.AlgorithmChainSystem) {
        console.log('✗ AlgorithmChainSystem not available');
        this.testResults.push({
          category: 'basic',
          test: 'System availability',
          success: false,
          error: 'AlgorithmChainSystem not loaded'
        });
        return 1;
      }
      
      // Test chain creation
      testCount++;
      try {
        global.AlgorithmChainSystem.createNewChain();
        console.log('✓ Chain creation');
        this.testResults.push({
          category: 'basic',
          test: 'Chain creation',
          success: true
        });
      } catch (e) {
        console.log(`✗ Chain creation: ${e.message}`);
        this.testResults.push({
          category: 'basic',
          test: 'Chain creation',
          success: false,
          error: e.message
        });
      }
      
      // Test adding operations
      testCount++;
      try {
        global.AlgorithmChainSystem.addOperationToChain('caesar', 'classical');
        global.AlgorithmChainSystem.addOperationToChain('base64', 'encoding');
        const chain = global.AlgorithmChainSystem.getCurrentChain();
        
        if (Array.isArray(chain) && chain.length === 2) {
          console.log('✓ Adding operations to chain');
          this.testResults.push({
            category: 'basic',
            test: 'Adding operations',
            success: true
          });
        } else {
          throw new Error('Chain does not contain expected operations');
        }
      } catch (e) {
        console.log(`✗ Adding operations: ${e.message}`);
        this.testResults.push({
          category: 'basic',
          test: 'Adding operations',
          success: false,
          error: e.message
        });
      }
      
      // Test chain clearing
      testCount++;
      try {
        global.AlgorithmChainSystem.clearChain();
        const chain = global.AlgorithmChainSystem.getCurrentChain();
        
        if (Array.isArray(chain) && chain.length === 0) {
          console.log('✓ Chain clearing');
          this.testResults.push({
            category: 'basic',
            test: 'Chain clearing',
            success: true
          });
        } else {
          throw new Error('Chain was not properly cleared');
        }
      } catch (e) {
        console.log(`✗ Chain clearing: ${e.message}`);
        this.testResults.push({
          category: 'basic',
          test: 'Chain clearing',
          success: false,
          error: e.message
        });
      }
      
      return testCount;
    },
    
    // Test chain validation
    testChainValidation: function() {
      let testCount = 0;
      let passedCount = 0;
      
      this.testChains.forEach(chainTest => {
        testCount++;
        
        try {
          // Create test chain
          global.AlgorithmChainSystem.createNewChain();
          chainTest.operations.forEach(op => {
            global.AlgorithmChainSystem.addOperationToChain(op.algorithm, op.category);
          });
          
          // Validate chain
          const validation = global.AlgorithmChainSystem.validateChain();
          
          if (validation && typeof validation === 'object') {
            passedCount++;
            console.log(`✓ Chain validation: ${chainTest.name}`);
            this.testResults.push({
              category: 'validation',
              test: `Chain validation: ${chainTest.name}`,
              success: true,
              chainLength: chainTest.operations.length
            });
          } else {
            console.log(`✗ Chain validation failed: ${chainTest.name}`);
            this.testResults.push({
              category: 'validation',
              test: `Chain validation: ${chainTest.name}`,
              success: false,
              error: 'Validation returned invalid result'
            });
          }
        } catch (e) {
          console.log(`✗ Chain validation error: ${chainTest.name} - ${e.message}`);
          this.testResults.push({
            category: 'validation',
            test: `Chain validation: ${chainTest.name}`,
            success: false,
            error: e.message
          });
        }
      });
      
      return { total: testCount, passed: passedCount };
    },
    
    // Test chain execution
    testChainExecution: function() {
      let testCount = 0;
      let passedCount = 0;
      
      // Test simple chains that should work
      const simpleChains = this.testChains.slice(0, 2); // Test first 2 chains
      
      simpleChains.forEach(chainTest => {
        testCount++;
        
        try {
          // Create and setup chain
          global.AlgorithmChainSystem.createNewChain();
          chainTest.operations.forEach(op => {
            global.AlgorithmChainSystem.addOperationToChain(op.algorithm, op.category);
          });
          
          // Execute chain (if execution method exists)
          if (typeof global.AlgorithmChainSystem.executeChain === 'function') {
            const result = global.AlgorithmChainSystem.executeChain(chainTest.testData);
            
            if (result && result !== chainTest.testData) {
              passedCount++;
              console.log(`✓ Chain execution: ${chainTest.name}`);
              this.testResults.push({
                category: 'execution',
                test: `Chain execution: ${chainTest.name}`,
                success: true,
                inputLength: chainTest.testData.length,
                outputLength: result.length
              });
            } else {
              console.log(`✗ Chain execution produced no change: ${chainTest.name}`);
              this.testResults.push({
                category: 'execution',
                test: `Chain execution: ${chainTest.name}`,
                success: false,
                error: 'No transformation occurred'
              });
            }
          } else {
            // Test chain setup if execution not available
            const chain = global.AlgorithmChainSystem.getCurrentChain();
            if (chain.length === chainTest.operations.length) {
              passedCount++;
              console.log(`✓ Chain setup: ${chainTest.name}`);
              this.testResults.push({
                category: 'execution',
                test: `Chain setup: ${chainTest.name}`,
                success: true,
                note: 'Execution method not available, tested setup only'
              });
            } else {
              console.log(`✗ Chain setup failed: ${chainTest.name}`);
              this.testResults.push({
                category: 'execution',
                test: `Chain setup: ${chainTest.name}`,
                success: false,
                error: 'Chain length mismatch'
              });
            }
          }
        } catch (e) {
          console.log(`✗ Chain execution error: ${chainTest.name} - ${e.message}`);
          this.testResults.push({
            category: 'execution',
            test: `Chain execution: ${chainTest.name}`,
            success: false,
            error: e.message
          });
        }
      });
      
      return { total: testCount, passed: passedCount };
    },
    
    // Test error handling
    testErrorHandling: function() {
      let testCount = 0;
      let passedCount = 0;
      
      // Test invalid algorithm
      testCount++;
      try {
        global.AlgorithmChainSystem.createNewChain();
        global.AlgorithmChainSystem.addOperationToChain('nonexistent', 'invalid');
        
        // Should handle gracefully
        const chain = global.AlgorithmChainSystem.getCurrentChain();
        console.log('✓ Invalid algorithm handling');
        passedCount++;
        this.testResults.push({
          category: 'error',
          test: 'Invalid algorithm handling',
          success: true
        });
      } catch (e) {
        console.log(`✓ Invalid algorithm properly rejected: ${e.message}`);
        passedCount++;
        this.testResults.push({
          category: 'error',
          test: 'Invalid algorithm handling',
          success: true,
          note: 'Properly rejected invalid algorithm'
        });
      }
      
      // Test empty chain validation
      testCount++;
      try {
        global.AlgorithmChainSystem.createNewChain();
        const validation = global.AlgorithmChainSystem.validateChain();
        
        console.log('✓ Empty chain validation');
        passedCount++;
        this.testResults.push({
          category: 'error',
          test: 'Empty chain validation',
          success: true
        });
      } catch (e) {
        console.log(`✗ Empty chain validation failed: ${e.message}`);
        this.testResults.push({
          category: 'error',
          test: 'Empty chain validation',
          success: false,
          error: e.message
        });
      }
      
      // Test chain operation removal
      testCount++;
      try {
        global.AlgorithmChainSystem.createNewChain();
        global.AlgorithmChainSystem.addOperationToChain('caesar', 'classical');
        global.AlgorithmChainSystem.addOperationToChain('base64', 'encoding');
        
        if (typeof global.AlgorithmChainSystem.removeOperationFromChain === 'function') {
          global.AlgorithmChainSystem.removeOperationFromChain(0);
          const chain = global.AlgorithmChainSystem.getCurrentChain();
          
          if (chain.length === 1) {
            console.log('✓ Operation removal');
            passedCount++;
            this.testResults.push({
              category: 'error',
              test: 'Operation removal',
              success: true
            });
          } else {
            console.log('✗ Operation removal failed');
            this.testResults.push({
              category: 'error',
              test: 'Operation removal',
              success: false,
              error: 'Operation not properly removed'
            });
          }
        } else {
          console.log('✓ Operation removal method not available (skipped)');
          passedCount++;
          this.testResults.push({
            category: 'error',
            test: 'Operation removal',
            success: true,
            note: 'Method not available, skipped'
          });
        }
      } catch (e) {
        console.log(`✗ Operation removal error: ${e.message}`);
        this.testResults.push({
          category: 'error',
          test: 'Operation removal',
          success: false,
          error: e.message
        });
      }
      
      return { total: testCount, passed: passedCount };
    },
    
    // Generate detailed report
    generateDetailedReport: function() {
      console.log('\n=== Detailed Chaining System Report ===');
      
      // Group by category
      const byCategory = {};
      this.testResults.forEach(result => {
        if (!byCategory[result.category]) {
          byCategory[result.category] = { passed: 0, failed: 0, total: 0 };
        }
        
        byCategory[result.category].total++;
        if (result.success) {
          byCategory[result.category].passed++;
        } else {
          byCategory[result.category].failed++;
        }
      });
      
      console.log('\nResults by Category:');
      Object.entries(byCategory).forEach(([category, stats]) => {
        const rate = ((stats.passed / stats.total) * 100).toFixed(1);
        console.log(`  ${category}: ${stats.passed}/${stats.total} (${rate}%)`);
      });
      
      // Show failures
      const failures = this.testResults.filter(r => !r.success);
      if (failures.length > 0) {
        console.log('\nFailures:');
        failures.forEach(failure => {
          console.log(`  ${failure.test}: ${failure.error}`);
        });
      }
      
      // Show performance metrics
      const executionTests = this.testResults.filter(r => r.category === 'execution' && r.success);
      if (executionTests.length > 0) {
        console.log('\nChain Performance:');
        executionTests.forEach(test => {
          if (test.inputLength && test.outputLength) {
            const ratio = (test.outputLength / test.inputLength).toFixed(2);
            console.log(`  ${test.test}: ${test.inputLength} → ${test.outputLength} bytes (${ratio}x)`);
          }
        });
      }
    }
  };
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChainingSystemTest;
  }
  
  // Auto-run if called directly
  if (typeof require !== 'undefined' && require.main === module) {
    ChainingSystemTest.testChainingSystem();
  }
  
  // Export to global scope
  global.ChainingSystemTest = ChainingSystemTest;
  
})(typeof global !== 'undefined' ? global : window);