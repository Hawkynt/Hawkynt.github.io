#!/usr/bin/env node
/*
 * Test Vector Validation System
 * Validates all algorithm test vectors against official standards
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  const fs = require('fs');
  const path = require('path');
  
  // Load core systems
  try {
    require('../OpCodes.js');
    require('../universal-cipher-env.js');
    require('../cipher.js');
  } catch (e) {
    console.error('Failed to load dependencies:', e.message);
    process.exit(1);
  }
  
  const TestVectorValidator = {
    
    validationResults: [],
    totalVectors: 0,
    passedVectors: 0,
    failedVectors: 0,
    
    // Discover and load all algorithm files
    discoverAlgorithms: function() {
      const algorithms = [];
      const algorithmDir = path.join(__dirname, '..', 'algorithms');
      
      if (!fs.existsSync(algorithmDir)) {
        console.warn('Algorithms directory not found');
        return algorithms;
      }
      
      const categories = fs.readdirSync(algorithmDir)
        .filter(item => fs.statSync(path.join(algorithmDir, item)).isDirectory());
      
      categories.forEach(category => {
        const categoryPath = path.join(algorithmDir, category);
        const files = fs.readdirSync(categoryPath)
          .filter(file => file.endsWith('.js'));
        
        files.forEach(file => {
          try {
            const algorithmPath = path.join(categoryPath, file);
            const algorithm = require(algorithmPath);
            
            if (algorithm && (algorithm.testVectors || algorithm.officialTestVectors)) {
              algorithms.push({
                name: algorithm.internalName || algorithm.name,
                category: category,
                file: file,
                path: algorithmPath,
                algorithm: algorithm
              });
            }
          } catch (e) {
            console.warn(`Failed to load ${file}: ${e.message}`);
          }
        });
      });
      
      return algorithms;
    },
    
    // Validate test vectors for a specific algorithm
    validateAlgorithmVectors: function(algorithmInfo) {
      console.log(`\n=== Validating ${algorithmInfo.name} ===`);
      
      const algorithm = algorithmInfo.algorithm;
      const testVectors = algorithm.testVectors || algorithm.officialTestVectors || [];
      
      if (testVectors.length === 0) {
        console.log('No test vectors found');
        return { passed: 0, failed: 0, total: 0 };
      }
      
      let passed = 0;
      let failed = 0;
      
      testVectors.forEach((vector, index) => {
        this.totalVectors++;
        
        try {
          const result = this.validateTestVector(algorithm, vector, index + 1);
          if (result.success) {
            passed++;
            this.passedVectors++;
            console.log(`✓ Vector ${index + 1}: ${vector.description || 'Test vector'}`);
          } else {
            failed++;
            this.failedVectors++;
            console.log(`✗ Vector ${index + 1}: ${result.error}`);
          }
          
          this.validationResults.push({
            algorithm: algorithmInfo.name,
            vectorIndex: index + 1,
            description: vector.description || 'Test vector',
            success: result.success,
            error: result.error,
            standard: vector.standard,
            origin: vector.origin
          });
        } catch (e) {
          failed++;
          this.failedVectors++;
          console.log(`✗ Vector ${index + 1}: Exception - ${e.message}`);
          
          this.validationResults.push({
            algorithm: algorithmInfo.name,
            vectorIndex: index + 1,
            description: vector.description || 'Test vector',
            success: false,
            error: e.message
          });
        }
      });
      
      return { passed, failed, total: testVectors.length };
    },
    
    // Validate individual test vector
    validateTestVector: function(algorithm, vector, vectorNumber) {
      // Check required metadata
      if (!vector.description) {
        return { success: false, error: 'Missing description' };
      }
      
      if (!vector.origin && !vector.standard) {
        return { success: false, error: 'Missing origin or standard information' };
      }
      
      // Check for essential test data
      if (algorithm.category === 'block' || algorithm.internalName === 'Rijndael') {
        if (!vector.key || !vector.plaintext || !vector.ciphertext) {
          return { success: false, error: 'Missing key, plaintext, or ciphertext' };
        }
        
        // Validate hex representations if present
        if (vector.keyHex && !this.isValidHex(vector.keyHex)) {
          return { success: false, error: 'Invalid keyHex format' };
        }
        
        if (vector.plaintextHex && !this.isValidHex(vector.plaintextHex)) {
          return { success: false, error: 'Invalid plaintextHex format' };
        }
        
        if (vector.ciphertextHex && !this.isValidHex(vector.ciphertextHex)) {
          return { success: false, error: 'Invalid ciphertextHex format' };
        }
      }
      
      // Stream cipher validation
      if (algorithm.category === 'stream' || algorithm.internalName === 'ChaCha20') {
        if (vector.key && vector.nonce !== undefined) {
          if (!vector.plaintext && !vector.keystream) {
            return { success: false, error: 'Missing plaintext or keystream for stream cipher' };
          }
        }
      }
      
      // Hash function validation
      if (algorithm.category === 'hash') {
        if (!vector.input || !vector.hash) {
          return { success: false, error: 'Missing input or hash for hash function' };
        }
      }
      
      // Validate links if present
      if (vector.link && !this.isValidUrl(vector.link)) {
        return { success: false, error: 'Invalid link URL format' };
      }
      
      return { success: true };
    },
    
    // Helper: Check if string is valid hex
    isValidHex: function(str) {
      return /^[0-9a-fA-F]*$/.test(str) && str.length % 2 === 0;
    },
    
    // Helper: Check if string is valid URL
    isValidUrl: function(str) {
      try {
        new URL(str);
        return true;
      } catch {
        return false;
      }
    },
    
    // Validate reference links in algorithm
    validateReferenceLinks: function(algorithm) {
      if (!algorithm.referenceLinks) {
        return { success: false, error: 'Missing referenceLinks section' };
      }
      
      const sections = ['specifications', 'implementations', 'validation'];
      for (const section of sections) {
        if (algorithm.referenceLinks[section]) {
          for (const link of algorithm.referenceLinks[section]) {
            if (!link.name || !link.url || !link.description) {
              return { success: false, error: `Incomplete reference link in ${section}` };
            }
            
            if (!this.isValidUrl(link.url)) {
              return { success: false, error: `Invalid URL in ${section}: ${link.url}` };
            }
          }
        }
      }
      
      return { success: true };
    },
    
    // Generate comprehensive validation report
    generateValidationReport: function() {
      const report = {
        summary: {
          totalAlgorithms: 0,
          totalVectors: this.totalVectors,
          passedVectors: this.passedVectors,
          failedVectors: this.failedVectors,
          successRate: ((this.passedVectors / this.totalVectors) * 100).toFixed(1)
        },
        byAlgorithm: {},
        byStandard: {},
        issues: []
      };
      
      // Group results by algorithm
      this.validationResults.forEach(result => {
        if (!report.byAlgorithm[result.algorithm]) {
          report.byAlgorithm[result.algorithm] = {
            passed: 0,
            failed: 0,
            total: 0,
            issues: []
          };
          report.summary.totalAlgorithms++;
        }
        
        const algReport = report.byAlgorithm[result.algorithm];
        algReport.total++;
        
        if (result.success) {
          algReport.passed++;
        } else {
          algReport.failed++;
          algReport.issues.push({
            vector: result.vectorIndex,
            description: result.description,
            error: result.error
          });
          
          report.issues.push({
            algorithm: result.algorithm,
            vector: result.vectorIndex,
            error: result.error
          });
        }
        
        // Group by standard
        if (result.standard) {
          if (!report.byStandard[result.standard]) {
            report.byStandard[result.standard] = { passed: 0, failed: 0, total: 0 };
          }
          
          report.byStandard[result.standard].total++;
          if (result.success) {
            report.byStandard[result.standard].passed++;
          } else {
            report.byStandard[result.standard].failed++;
          }
        }
      });
      
      return report;
    },
    
    // Run complete validation
    runValidation: function() {
      console.log('SynthelicZ Cipher Tools - Test Vector Validation');
      console.log('================================================');
      
      const startTime = Date.now();
      
      // Discover algorithms
      console.log('Discovering algorithms...');
      const algorithms = this.discoverAlgorithms();
      console.log(`Found ${algorithms.length} algorithms with test vectors`);
      
      // Validate each algorithm
      algorithms.forEach(algorithmInfo => {
        this.validateAlgorithmVectors(algorithmInfo);
        
        // Also validate reference links
        const linkValidation = this.validateReferenceLinks(algorithmInfo.algorithm);
        if (!linkValidation.success) {
          console.log(`⚠ Reference links: ${linkValidation.error}`);
        }
      });
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Generate and display report
      const report = this.generateValidationReport();
      
      console.log('\n================================================');
      console.log('Validation Summary:');
      console.log(`Total Algorithms: ${report.summary.totalAlgorithms}`);
      console.log(`Total Test Vectors: ${report.summary.totalVectors}`);
      console.log(`Passed: ${report.summary.passedVectors}`);
      console.log(`Failed: ${report.summary.failedVectors}`);
      console.log(`Success Rate: ${report.summary.successRate}%`);
      console.log(`Validation Time: ${totalTime}ms`);
      
      // Show top issues
      if (report.issues.length > 0) {
        console.log('\nTop Issues:');
        report.issues.slice(0, 10).forEach(issue => {
          console.log(`  - ${issue.algorithm} Vector ${issue.vector}: ${issue.error}`);
        });
        
        if (report.issues.length > 10) {
          console.log(`  ... and ${report.issues.length - 10} more issues`);
        }
      }
      
      // Standards coverage
      console.log('\nStandards Coverage:');
      Object.entries(report.byStandard).forEach(([standard, stats]) => {
        const rate = ((stats.passed / stats.total) * 100).toFixed(1);
        console.log(`  ${standard}: ${stats.passed}/${stats.total} (${rate}%)`);
      });
      
      console.log('\n=== Test Vector Validation Complete ===');
      
      return report;
    }
  };
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestVectorValidator;
  }
  
  // Auto-run if called directly
  if (typeof require !== 'undefined' && require.main === module) {
    TestVectorValidator.runValidation();
  }
  
  // Export to global scope
  global.TestVectorValidator = TestVectorValidator;
  
})(typeof global !== 'undefined' ? global : window);