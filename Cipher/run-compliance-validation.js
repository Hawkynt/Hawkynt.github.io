#!/usr/bin/env node
/*
 * Compliance Validation Runner
 * Discovers all algorithm files and validates their metadata structure and test vectors
 * Generates comprehensive compliance report for the entire cipher collection
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection
  const isNode = typeof module !== 'undefined' && module.exports;
  const isBrowser = typeof window !== 'undefined';
  
  let fs, path;
  
  // Load dependencies for Node.js
  if (isNode) {
    try {
      fs = require('fs');
      path = require('path');
      require('./universal-cipher-env.js');
      require('./cipher.js');
      require('./universal-algorithm-tester.js');
    } catch (e) {
      console.error('Failed to load required dependencies:', e.message);
      return;
    }
  }
  
  const ComplianceValidator = {
    results: {
      discovered: 0,
      loaded: 0,
      tested: 0,
      passed: 0,
      failed: 0,
      errors: 0,
      skipped: 0,
      metadataIssues: 0,
      algorithmsWithoutTests: 0,
      categories: {},
      algorithmDetails: {}
    },
    
    // Required metadata fields according to CONTRIBUTING.md
    REQUIRED_METADATA: [
      'name',
      'description', 
      'category',
      'subCategory'
    ],
    
    // Optional but recommended metadata fields
    RECOMMENDED_METADATA: [
      'inventor',
      'year',
      'country',
      'securityStatus',
      'securityNotes',
      'documentation',
      'references',
      'tests'
    ],
    
    // Valid categories from CONTRIBUTING.md
    VALID_CATEGORIES: [
      'cipher',
      'modeOfOperation',
      'paddingScheme', 
      'hash',
      'checksum',
      'compression',
      'keyDerivation',
      'randomNumberGenerator',
      'encodingScheme',
      'errorCorrection'
    ],
    
    // Valid security status values
    VALID_SECURITY_STATUS: [
      null,
      'insecure',
      'educational', 
      'experimental'
    ],
    
    /**
     * Initialize the compliance validator
     */
    init: function() {
      console.log('=== Cipher Collection Compliance Validation ===');
      console.log('Discovering and validating all algorithms in the collection...');
      console.log('');
      
      // Reset results
      this.results = {
        discovered: 0,
        loaded: 0,
        tested: 0,
        passed: 0,
        failed: 0,
        errors: 0,
        skipped: 0,
        metadataIssues: 0,
        algorithmsWithoutTests: 0,
        categories: {},
        algorithmDetails: {}
      };
      
      return true;
    },
    
    /**
     * Discover all algorithm files in the algorithms directory
     */
    discoverAlgorithmFiles: function() {
      if (!isNode) {
        console.log('❌ File discovery only available in Node.js environment');
        return [];
      }
      
      const algorithmsDir = path.join(__dirname, 'algorithms');
      
      if (!fs.existsSync(algorithmsDir)) {
        console.log('❌ Algorithms directory not found');
        return [];
      }
      
      console.log('🔍 Discovering algorithm files...');
      
      const files = [];
      
      // Recursively scan all subdirectories
      const scanDirectory = (dir, category = null) => {
        try {
          const items = fs.readdirSync(dir);
          
          for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
              // Recursively scan subdirectory
              const subCategory = category ? `${category}/${item}` : item;
              scanDirectory(fullPath, subCategory);
            } else if (item.endsWith('.js') && !item.includes('test') && !item.includes('demo')) {
              files.push({
                path: fullPath,
                relativePath: path.relative(__dirname, fullPath),
                category: category,
                filename: item,
                name: item.replace('.js', '')
              });
            }
          }
        } catch (error) {
          console.log(`⚠️  Error scanning directory ${dir}: ${error.message}`);
        }
      };
      
      scanDirectory(algorithmsDir);
      
      console.log(`📁 Discovered ${files.length} algorithm files`);
      this.results.discovered = files.length;
      
      return files;
    },
    
    /**
     * Load and validate a single algorithm file
     */
    validateAlgorithmFile: function(fileInfo) {
      try {
        console.log(`\n=== Validating ${fileInfo.relativePath} ===`);
        
        // Load the algorithm file
        delete require.cache[require.resolve(fileInfo.path)];
        const algorithmModule = require(fileInfo.path);
        
        // Try to extract algorithm object
        let algorithm = null;
        
        // Check if it's directly exported
        if (algorithmModule && typeof algorithmModule === 'object') {
          algorithm = algorithmModule;
        }
        
        // Check global scope for algorithm (common pattern)
        if (!algorithm) {
          const possibleNames = [
            fileInfo.name.toUpperCase(),
            fileInfo.name.toLowerCase(),
            fileInfo.name,
            fileInfo.name.charAt(0).toUpperCase() + fileInfo.name.slice(1)
          ];
          
          for (const name of possibleNames) {
            if (global[name] && typeof global[name] === 'object') {
              algorithm = global[name];
              break;
            }
          }
        }
        
        if (!algorithm) {
          console.log(`❌ Could not extract algorithm object from ${fileInfo.filename}`);
          this.results.errors++;
          return null;
        }
        
        console.log(`✅ Successfully loaded algorithm: ${algorithm.name || fileInfo.name}`);
        this.results.loaded++;
        
        // Validate metadata
        const metadataValidation = this.validateMetadata(algorithm, fileInfo);
        
        // Store algorithm details
        const algorithmName = algorithm.name || algorithm.internalName || fileInfo.name;
        this.results.algorithmDetails[algorithmName] = {
          file: fileInfo.relativePath,
          category: algorithm.category || 'unknown',
          subCategory: algorithm.subCategory || 'unknown',
          hasTests: this.hasTestVectors(algorithm),
          metadataValid: metadataValidation.valid,
          metadataIssues: metadataValidation.issues,
          algorithm: algorithm
        };
        
        return algorithm;
        
      } catch (error) {
        console.log(`❌ Error loading ${fileInfo.filename}: ${error.message}`);
        this.results.errors++;
        return null;
      }
    },
    
    /**
     * Validate algorithm metadata according to CONTRIBUTING.md guidelines
     */
    validateMetadata: function(algorithm, fileInfo) {
      console.log(`📋 Validating metadata for ${algorithm.name || fileInfo.name}...`);
      
      const issues = [];
      
      // Check required fields
      for (const field of this.REQUIRED_METADATA) {
        if (!algorithm[field]) {
          issues.push(`Missing required field: ${field}`);
        }
      }
      
      // Validate category
      if (algorithm.category && !this.VALID_CATEGORIES.includes(algorithm.category)) {
        issues.push(`Invalid category: ${algorithm.category}. Must be one of: ${this.VALID_CATEGORIES.join(', ')}`);
      }
      
      // Validate security status
      if (algorithm.securityStatus !== undefined && !this.VALID_SECURITY_STATUS.includes(algorithm.securityStatus)) {
        issues.push(`Invalid securityStatus: ${algorithm.securityStatus}. Must be one of: ${this.VALID_SECURITY_STATUS.join(', ')}`);
      }
      
      // Check for forbidden security claims
      if (algorithm.securityStatus === 'secure') {
        issues.push('FORBIDDEN: securityStatus cannot be "secure" - use null instead');
      }
      
      // Check description length (should be concise)
      if (algorithm.description && algorithm.description.length > 500) {
        issues.push(`Description too long (${algorithm.description.length} chars). Should be max 3 sentences.`);
      }
      
      // Check for test vectors
      if (!this.hasTestVectors(algorithm)) {
        issues.push('No test vectors found - algorithm should have tests array with at least one test vector');
      }
      
      // Check documentation links
      if (algorithm.documentation && Array.isArray(algorithm.documentation)) {
        for (let i = 0; i < algorithm.documentation.length; i++) {
          const doc = algorithm.documentation[i];
          if (!doc.text || !doc.uri) {
            issues.push(`documentation[${i}] missing text or uri field`);
          }
        }
      }
      
      // Check reference links
      if (algorithm.references && Array.isArray(algorithm.references)) {
        for (let i = 0; i < algorithm.references.length; i++) {
          const ref = algorithm.references[i];
          if (!ref.text || !ref.uri) {
            issues.push(`references[${i}] missing text or uri field`);
          }
        }
      }
      
      // Report results
      if (issues.length === 0) {
        console.log(`✅ Metadata validation passed`);
      } else {
        console.log(`⚠️  Metadata validation found ${issues.length} issue(s):`);
        for (const issue of issues) {
          console.log(`   - ${issue}`);
        }
        this.results.metadataIssues++;
      }
      
      return {
        valid: issues.length === 0,
        issues: issues
      };
    },
    
    /**
     * Check if algorithm has test vectors
     */
    hasTestVectors: function(algorithm) {
      const testSources = [
        algorithm.tests,
        algorithm.testVectors,
        algorithm.metadata && algorithm.metadata.testVectors,
        algorithm.metadata && algorithm.metadata.tests
      ];
      
      for (const source of testSources) {
        if (Array.isArray(source) && source.length > 0) {
          return true;
        }
      }
      
      return false;
    },
    
    /**
     * Run the complete compliance validation
     */
    runFullValidation: function() {
      this.init();
      
      // Discover all algorithm files
      const files = this.discoverAlgorithmFiles();
      if (files.length === 0) {
        console.log('❌ No algorithm files found to validate');
        return false;
      }
      
      console.log(`\n🔬 Loading and validating ${files.length} algorithm files...`);
      
      const loadedAlgorithms = [];
      
      // Load and validate each file
      for (const fileInfo of files) {
        const algorithm = this.validateAlgorithmFile(fileInfo);
        if (algorithm) {
          loadedAlgorithms.push(algorithm);
          
          // Track categories
          const category = algorithm.category || 'unknown';
          if (!this.results.categories[category]) {
            this.results.categories[category] = { count: 0, tested: 0, passed: 0 };
          }
          this.results.categories[category].count++;
        }
      }
      
      console.log(`\n🧪 Running functional tests on loaded algorithms...`);
      
      // Run functional tests using UniversalAlgorithmTester
      if (typeof UniversalAlgorithmTester !== 'undefined') {
        for (const algorithm of loadedAlgorithms) {
          try {
            const algorithmName = algorithm.name || algorithm.internalName;
            console.log(`\n--- Testing ${algorithmName} ---`);
            
            const testResult = UniversalAlgorithmTester.testAlgorithm(algorithm, algorithmName);
            this.results.tested++;
            
            const category = algorithm.category || 'unknown';
            this.results.categories[category].tested++;
            
            if (testResult) {
              this.results.passed++;
              this.results.categories[category].passed++;
              console.log(`✅ ${algorithmName}: Functional tests PASSED`);
            } else {
              this.results.failed++;
              console.log(`❌ ${algorithmName}: Functional tests FAILED`);
            }
            
            // Update algorithm details
            const details = this.results.algorithmDetails[algorithmName];
            if (details) {
              details.functionalTestPassed = testResult;
            }
            
          } catch (error) {
            console.log(`❌ Error testing ${algorithm.name}: ${error.message}`);
            this.results.errors++;
          }
        }
      } else {
        console.log('⚠️  UniversalAlgorithmTester not available, skipping functional tests');
      }
      
      // Count algorithms without tests
      this.results.algorithmsWithoutTests = Object.values(this.results.algorithmDetails)
        .filter(details => !details.hasTests).length;
      
      // Generate final report
      this.generateComplianceReport();
      
      return this.results.errors === 0 && this.results.failed === 0;
    },
    
    /**
     * Generate comprehensive compliance report
     */
    generateComplianceReport: function() {
      console.log('\n' + '='.repeat(80));
      console.log('📊 COMPREHENSIVE COMPLIANCE VALIDATION REPORT');
      console.log('='.repeat(80));
      
      // Overall statistics
      console.log('\n📈 OVERALL STATISTICS:');
      console.log(`  Files discovered: ${this.results.discovered}`);
      console.log(`  Successfully loaded: ${this.results.loaded}`);
      console.log(`  Functional tests run: ${this.results.tested}`);
      console.log(`  Tests passed: ${this.results.passed}`);
      console.log(`  Tests failed: ${this.results.failed}`);
      console.log(`  Load errors: ${this.results.errors}`);
      console.log(`  Algorithms with metadata issues: ${this.results.metadataIssues}`);
      console.log(`  Algorithms without test vectors: ${this.results.algorithmsWithoutTests}`);
      
      // Success rate
      const successRate = this.results.tested > 0 ? 
        Math.round((this.results.passed / this.results.tested) * 100) : 0;
      console.log(`  Overall success rate: ${successRate}%`);
      
      // Category breakdown
      if (Object.keys(this.results.categories).length > 0) {
        console.log('\n📋 RESULTS BY CATEGORY:');
        for (const [category, stats] of Object.entries(this.results.categories)) {
          const categoryRate = stats.tested > 0 ? 
            Math.round((stats.passed / stats.tested) * 100) : 0;
          console.log(`  ${category}: ${stats.count} algorithms, ${stats.tested} tested, ${stats.passed} passed (${categoryRate}%)`);
        }
      }
      
      // Algorithms with issues
      const problemAlgorithms = Object.entries(this.results.algorithmDetails)
        .filter(([name, details]) => 
          !details.metadataValid || !details.hasTests || details.functionalTestPassed === false);
      
      if (problemAlgorithms.length > 0) {
        console.log('\n⚠️  ALGORITHMS NEEDING ATTENTION:');
        for (const [name, details] of problemAlgorithms) {
          console.log(`  ${name} (${details.file}):`);
          
          if (!details.metadataValid && details.metadataIssues) {
            console.log(`    - Metadata issues: ${details.metadataIssues.length}`);
            for (const issue of details.metadataIssues.slice(0, 3)) {
              console.log(`      • ${issue}`);
            }
            if (details.metadataIssues.length > 3) {
              console.log(`      • ... and ${details.metadataIssues.length - 3} more`);
            }
          }
          
          if (!details.hasTests) {
            console.log(`    - Missing test vectors`);
          }
          
          if (details.functionalTestPassed === false) {
            console.log(`    - Functional tests failed`);
          }
          
          console.log('');
        }
      }
      
      // Successful algorithms
      const successfulAlgorithms = Object.entries(this.results.algorithmDetails)
        .filter(([name, details]) => 
          details.metadataValid && details.hasTests && details.functionalTestPassed === true);
      
      console.log(`\n✅ FULLY COMPLIANT ALGORITHMS (${successfulAlgorithms.length}):`);
      for (const [name, details] of successfulAlgorithms) {
        console.log(`  ✓ ${name} (${details.category}/${details.subCategory})`);
      }
      
      // Recommendations
      console.log('\n💡 RECOMMENDATIONS:');
      
      if (this.results.metadataIssues > 0) {
        console.log(`  - Fix metadata issues in ${this.results.metadataIssues} algorithms`);
        console.log(`  - Follow CONTRIBUTING.md guidelines for required fields`);
        console.log(`  - Never set securityStatus to "secure" - use null instead`);
      }
      
      if (this.results.algorithmsWithoutTests > 0) {
        console.log(`  - Add test vectors to ${this.results.algorithmsWithoutTests} algorithms`);
        console.log(`  - Use official sources (NIST, RFC, etc.) for test vectors`);
        console.log(`  - Mark as "experimental" if no test vectors available`);
      }
      
      if (this.results.failed > 0) {
        console.log(`  - Debug ${this.results.failed} algorithms with failing functional tests`);
        console.log(`  - Verify test vector format and expected outputs`);
        console.log(`  - Check algorithm implementation against specifications`);
      }
      
      // Quality score
      const qualityMetrics = {
        loadRate: Math.round((this.results.loaded / this.results.discovered) * 100),
        metadataRate: Math.round(((this.results.loaded - this.results.metadataIssues) / this.results.loaded) * 100),
        testCoverageRate: Math.round(((this.results.loaded - this.results.algorithmsWithoutTests) / this.results.loaded) * 100),
        functionalRate: this.results.tested > 0 ? Math.round((this.results.passed / this.results.tested) * 100) : 0
      };
      
      const overallQuality = Math.round(
        (qualityMetrics.loadRate + qualityMetrics.metadataRate + 
         qualityMetrics.testCoverageRate + qualityMetrics.functionalRate) / 4
      );
      
      console.log('\n🎯 COLLECTION QUALITY METRICS:');
      console.log(`  Load success rate: ${qualityMetrics.loadRate}%`);
      console.log(`  Metadata compliance rate: ${qualityMetrics.metadataRate}%`);
      console.log(`  Test coverage rate: ${qualityMetrics.testCoverageRate}%`);
      console.log(`  Functional test success rate: ${qualityMetrics.functionalRate}%`);
      console.log(`  Overall collection quality: ${overallQuality}%`);
      
      console.log('\n' + '='.repeat(80));
      
      if (overallQuality >= 90) {
        console.log('🏆 EXCELLENT - Collection meets high quality standards!');
      } else if (overallQuality >= 75) {
        console.log('👍 GOOD - Collection quality is solid with room for improvement');
      } else if (overallQuality >= 50) {
        console.log('⚠️  NEEDS WORK - Several algorithms need attention');
      } else {
        console.log('🔧 REQUIRES MAJOR IMPROVEMENTS - Many algorithms need fixes');
      }
      
      return overallQuality;
    },
    
    /**
     * Generate detailed report for a specific category
     */
    validateCategory: function(categoryName) {
      this.init();
      
      console.log(`🎯 Validating algorithms in category: ${categoryName}\n`);
      
      const files = this.discoverAlgorithmFiles();
      const categoryFiles = files.filter(f => f.category === categoryName);
      
      if (categoryFiles.length === 0) {
        console.log(`❌ No algorithms found in category: ${categoryName}`);
        return false;
      }
      
      console.log(`📁 Found ${categoryFiles.length} files in category ${categoryName}`);
      
      for (const fileInfo of categoryFiles) {
        const algorithm = this.validateAlgorithmFile(fileInfo);
        if (algorithm && typeof UniversalAlgorithmTester !== 'undefined') {
          try {
            const testResult = UniversalAlgorithmTester.testAlgorithm(algorithm, algorithm.name || fileInfo.name);
            console.log(testResult ? '✅ Tests passed' : '❌ Tests failed');
          } catch (error) {
            console.log(`❌ Test error: ${error.message}`);
          }
        }
      }
      
      return true;
    }
  };
  
  // Export for both environments
  if (isNode) {
    module.exports = ComplianceValidator;
    
    // Auto-run if this is the main module
    if (require.main === module) {
      // Check command line arguments
      const args = process.argv.slice(2);
      
      if (args.length > 0) {
        const command = args[0].toLowerCase();
        
        if (command === 'category' && args.length > 1) {
          const categoryName = args[1];
          ComplianceValidator.validateCategory(categoryName);
        } else if (command === 'help' || command === '-h' || command === '--help') {
          console.log('Compliance Validation Runner Usage:');
          console.log('  node run-compliance-validation.js                 - Full validation');
          console.log('  node run-compliance-validation.js category <name> - Validate specific category');
          console.log('  node run-compliance-validation.js help            - Show this help');
          console.log('');
          console.log('This tool will:');
          console.log('  • Discover all algorithm files in algorithms/ directory');
          console.log('  • Load each algorithm and validate metadata structure');
          console.log('  • Run functional tests on all algorithms with test vectors');
          console.log('  • Generate comprehensive compliance report');
          console.log('  • Identify algorithms needing attention');
        } else {
          console.log('Unknown command. Use "help" for usage information.');
        }
      } else {
        // Default: run full validation
        ComplianceValidator.runFullValidation();
      }
    }
  } else {
    global.ComplianceValidator = ComplianceValidator;
  }
  
})(typeof global !== 'undefined' ? global : window);