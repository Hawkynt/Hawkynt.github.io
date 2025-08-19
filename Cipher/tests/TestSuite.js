#!/usr/bin/env node
/*
 * Comprehensive Test Suite for Cipher Algorithms
 * Tests syntax, metadata compliance, functionality, and optimization
 * (c)2006-2025 Hawkynt
 */

const fs = require('fs');
const path = require('path');

class TestSuite {
  constructor() {
    this.totalAlgorithms = 0;
    this.algorithmsPerCategory = {};
    this.results = {
      syntax: { passed: 0, failed: 0, errors: [] },
      metadata: { passed: 0, failed: 0, errors: [] },
      functionality: { passed: 0, failed: 0, errors: [] },
      optimization: { passed: 0, failed: 0, errors: [] }
    };
    this.algorithmDetails = [];
  }

  // Main entry point
  async runAllTests() {
    console.log('SynthelicZ Cipher Tools - Comprehensive Test Suite');
    console.log('================================================');
    console.log('');

    try {
      // Load OpCodes first
      await this.loadDependencies();
      
      // Discover and test all algorithms
      await this.discoverAlgorithms();
      
      // Generate final report
      this.generateReport();
      
    } catch (error) {
      console.error('Fatal error during test execution:', error.message);
      process.exit(1);
    }
  }

  // Load required dependencies
  async loadDependencies() {
    console.log('Loading dependencies...');
    
    try {
      // Load OpCodes
      require('../OpCodes.js');
      if (!global.OpCodes) {
        throw new Error('OpCodes not loaded properly');
      }
      
      // Load cipher environment
      require('../universal-cipher-env.js');
      require('../cipher.js');
      
      console.log('✓ Dependencies loaded successfully\n');
    } catch (error) {
      throw new Error(`Failed to load dependencies: ${error.message}`);
    }
  }

  // Discover all algorithm files
  async discoverAlgorithms() {
    const algorithmsDir = path.join(__dirname, '..', 'algorithms');
    const categories = fs.readdirSync(algorithmsDir).filter(item => 
      fs.statSync(path.join(algorithmsDir, item)).isDirectory()
    );

    console.log(`Found ${categories.length} algorithm categories:`);
    categories.forEach(cat => console.log(`  - ${cat}`));
    console.log('');

    for (const category of categories) {
      await this.testCategory(category);
    }
  }

  // Test all algorithms in a category
  async testCategory(category) {
    const categoryPath = path.join(__dirname, '..', 'algorithms', category);
    const files = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
    
    console.log(`Testing ${category} algorithms (${files.length} files):`);
    
    this.algorithmsPerCategory[category] = 0;
    
    for (const file of files) {
      await this.testAlgorithm(category, file);
    }
    
    console.log('');
  }

  // Test individual algorithm file
  async testAlgorithm(category, filename) {
    const filePath = path.join(__dirname, '..', 'algorithms', category, filename);
    const algorithmName = path.basename(filename, '.js');
    
    console.log(`  Testing ${algorithmName}...`);
    
    this.totalAlgorithms++;
    this.algorithmsPerCategory[category]++;
    
    const algorithmData = {
      name: algorithmName,
      category: category,
      file: filename,
      tests: {
        syntax: false,
        metadata: false,
        functionality: false,
        optimization: false
      },
      details: {}
    };

    // SYNTAX TEST - JavaScript compilation
    algorithmData.tests.syntax = await this.testSyntax(filePath, algorithmData);
    
    if (algorithmData.tests.syntax) {
      // METADATA TEST - CONTRIBUTING.MD interface format
      algorithmData.tests.metadata = await this.testMetadata(filePath, category, algorithmData);
      
      // FUNCTIONALITY TEST - Test vectors
      algorithmData.tests.functionality = await this.testFunctionality(filePath, algorithmData);
      
      // OPTIMIZATION TEST - OpCodes usage
      algorithmData.tests.optimization = await this.testOptimization(filePath, algorithmData);
    }
    
    this.algorithmDetails.push(algorithmData);
    
    const status = Object.values(algorithmData.tests).every(t => t) ? '✓' : '✗';
    console.log(`    ${status} ${algorithmName} - Syntax:${algorithmData.tests.syntax?'✓':'✗'} Metadata:${algorithmData.tests.metadata?'✓':'✗'} Function:${algorithmData.tests.functionality?'✓':'✗'} Optimization:${algorithmData.tests.optimization?'✓':'✗'}`);
  }

  // Test if file loads without syntax errors
  async testSyntax(filePath, algorithmData) {
    try {
      // Clear any previous algorithm from global scope
      const algorithmName = algorithmData.name.toUpperCase();
      delete global[algorithmName];
      
      // Try to require the file
      delete require.cache[require.resolve(filePath)];
      require(filePath);
      
      // Check if algorithm was properly loaded
      if (global[algorithmName]) {
        algorithmData.details.loadedSuccessfully = true;
        this.results.syntax.passed++;
        return true;
      } else {
        algorithmData.details.syntaxError = 'Algorithm not found in global scope';
        this.results.syntax.failed++;
        this.results.syntax.errors.push(`${algorithmData.name}: Algorithm not exported to global scope`);
        return false;
      }
    } catch (error) {
      algorithmData.details.syntaxError = error.message;
      this.results.syntax.failed++;
      this.results.syntax.errors.push(`${algorithmData.name}: ${error.message}`);
      return false;
    }
  }

  // Test metadata compliance with CONTRIBUTING.md format
  async testMetadata(filePath, expectedCategory, algorithmData) {
    try {
      const algorithmName = algorithmData.name.toUpperCase();
      const algorithm = global[algorithmName];
      
      if (!algorithm) {
        this.results.metadata.failed++;
        this.results.metadata.errors.push(`${algorithmData.name}: Algorithm not loaded`);
        return false;
      }

      const requiredFields = ['name', 'description', 'category', 'subCategory'];
      const missingFields = [];
      
      // Check required fields
      for (const field of requiredFields) {
        if (!algorithm[field]) {
          missingFields.push(field);
        }
      }
      
      // Check category matches subfolder
      const categoryMatch = algorithm.category === 'cipher' || 
                           algorithm.category === expectedCategory ||
                           (expectedCategory === 'classical' && algorithm.category === 'cipher');
      
      if (!categoryMatch) {
        missingFields.push(`category mismatch: expected ${expectedCategory}, got ${algorithm.category}`);
      }
      
      // Count documentation, vulnerabilities, tests
      const docCount = algorithm.documentation ? algorithm.documentation.length : 0;
      const vulnCount = algorithm.knownVulnerabilities ? algorithm.knownVulnerabilities.length : 0;
      const testCount = algorithm.tests ? algorithm.tests.length : 0;
      
      algorithmData.details.metadata = {
        hasAllRequiredFields: missingFields.length === 0,
        missingFields: missingFields,
        categoryMatch: categoryMatch,
        documentationCount: docCount,
        vulnerabilityCount: vulnCount,
        testVectorCount: testCount
      };
      
      if (missingFields.length === 0) {
        this.results.metadata.passed++;
        return true;
      } else {
        this.results.metadata.failed++;
        this.results.metadata.errors.push(`${algorithmData.name}: Missing fields: ${missingFields.join(', ')}`);
        return false;
      }
      
    } catch (error) {
      algorithmData.details.metadataError = error.message;
      this.results.metadata.failed++;
      this.results.metadata.errors.push(`${algorithmData.name}: ${error.message}`);
      return false;
    }
  }

  // Test functionality using test vectors
  async testFunctionality(filePath, algorithmData) {
    try {
      const algorithmName = algorithmData.name.toUpperCase();
      const algorithm = global[algorithmName];
      
      if (!algorithm || !algorithm.tests) {
        algorithmData.details.functionality = { hasTests: false };
        this.results.functionality.failed++;
        this.results.functionality.errors.push(`${algorithmData.name}: No test vectors found`);
        return false;
      }
      
      const testResults = [];
      let allPassed = true;
      
      for (let i = 0; i < algorithm.tests.length; i++) {
        const test = algorithm.tests[i];
        
        try {
          // Ensure we have the required test data
          if (!test.input || !test.key || !test.expected) {
            testResults.push({ index: i, passed: false, error: 'Missing test data' });
            allPassed = false;
            continue;
          }
          
          // Try to encrypt using the algorithm
          let result;
          if (algorithm.encrypt && typeof algorithm.encrypt === 'function') {
            result = algorithm.encrypt(test.input, test.key);
          } else {
            testResults.push({ index: i, passed: false, error: 'No encrypt function' });
            allPassed = false;
            continue;
          }
          
          // Compare result with expected
          const passed = this.compareArrays(result, test.expected);
          testResults.push({ index: i, passed: passed });
          
          if (!passed) {
            allPassed = false;
          }
          
        } catch (error) {
          testResults.push({ index: i, passed: false, error: error.message });
          allPassed = false;
        }
      }
      
      algorithmData.details.functionality = {
        hasTests: true,
        testCount: algorithm.tests.length,
        results: testResults,
        allPassed: allPassed
      };
      
      if (allPassed) {
        this.results.functionality.passed++;
        return true;
      } else {
        this.results.functionality.failed++;
        this.results.functionality.errors.push(`${algorithmData.name}: ${testResults.filter(r => !r.passed).length}/${testResults.length} tests failed`);
        return false;
      }
      
    } catch (error) {
      algorithmData.details.functionalityError = error.message;
      this.results.functionality.failed++;
      this.results.functionality.errors.push(`${algorithmData.name}: ${error.message}`);
      return false;
    }
  }

  // Test optimization (OpCodes usage, no bare hex values, etc.)
  async testOptimization(filePath, algorithmData) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Check for bare hex values (should use OpCodes.Hex8ToBytes)
      const bareHexPattern = /0x[0-9A-Fa-f]{8,}/g;
      const bareHexMatches = fileContent.match(bareHexPattern) || [];
      
      // Check for string literals in non-metadata fields (should use byte arrays)
      const stringLiteralPattern = /"[0-9A-Fa-f]{8,}"/g;
      const stringMatches = fileContent.match(stringLiteralPattern) || [];
      
      // Check for OpCodes usage
      const opCodesUsage = fileContent.includes('OpCodes.');
      
      // Check for typical bit functions that should use OpCodes
      const bitFunctionPatterns = [
        /value\s*<<\s*\d+/g,  // Left shift
        /value\s*>>\s*\d+/g,  // Right shift
        /value\s*&\s*0x/g,    // Bitwise AND with hex
        /value\s*\|\s*value/g // Bitwise OR
      ];
      
      let potentialOptimizations = 0;
      bitFunctionPatterns.forEach(pattern => {
        const matches = fileContent.match(pattern) || [];
        potentialOptimizations += matches.length;
      });
      
      algorithmData.details.optimization = {
        usesOpCodes: opCodesUsage,
        bareHexCount: bareHexMatches.length,
        stringLiteralCount: stringMatches.length,
        potentialOptimizations: potentialOptimizations,
        issues: []
      };
      
      if (bareHexMatches.length > 0) {
        algorithmData.details.optimization.issues.push(`${bareHexMatches.length} bare hex values found`);
      }
      if (stringMatches.length > 0) {
        algorithmData.details.optimization.issues.push(`${stringMatches.length} string literals found`);
      }
      if (!opCodesUsage && potentialOptimizations > 0) {
        algorithmData.details.optimization.issues.push('Could benefit from OpCodes usage');
      }
      
      const isOptimized = opCodesUsage && bareHexMatches.length === 0 && stringMatches.length === 0;
      
      if (isOptimized) {
        this.results.optimization.passed++;
        return true;
      } else {
        this.results.optimization.failed++;
        this.results.optimization.errors.push(`${algorithmData.name}: ${algorithmData.details.optimization.issues.join(', ')}`);
        return false;
      }
      
    } catch (error) {
      algorithmData.details.optimizationError = error.message;
      this.results.optimization.failed++;
      this.results.optimization.errors.push(`${algorithmData.name}: ${error.message}`);
      return false;
    }
  }

  // Helper function to compare byte arrays
  compareArrays(arr1, arr2) {
    if (!arr1 || !arr2) return false;
    if (arr1.length !== arr2.length) return false;
    
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
    return true;
  }

  // Generate comprehensive test report
  generateReport() {
    console.log('\n=== COMPREHENSIVE TEST REPORT ===');
    console.log(`Total algorithms tested: ${this.totalAlgorithms}`);
    console.log('\nAlgorithms per category:');
    Object.entries(this.algorithmsPerCategory).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });
    
    console.log('\n=== TEST RESULTS SUMMARY ===');
    console.log(`SYNTAX:        ${this.results.syntax.passed}/${this.totalAlgorithms} passed`);
    console.log(`METADATA:      ${this.results.metadata.passed}/${this.totalAlgorithms} passed`);
    console.log(`FUNCTIONALITY: ${this.results.functionality.passed}/${this.totalAlgorithms} passed`);
    console.log(`OPTIMIZATION:  ${this.results.optimization.passed}/${this.totalAlgorithms} passed`);
    
    // Show errors if any
    ['syntax', 'metadata', 'functionality', 'optimization'].forEach(testType => {
      if (this.results[testType].errors.length > 0) {
        console.log(`\n=== ${testType.toUpperCase()} ERRORS ===`);
        this.results[testType].errors.forEach(error => {
          console.log(`  ✗ ${error}`);
        });
      }
    });
    
    // Overall score
    const totalTests = this.totalAlgorithms * 4;
    const totalPassed = Object.values(this.results).reduce((sum, result) => sum + result.passed, 0);
    const overallScore = ((totalPassed / totalTests) * 100).toFixed(1);
    
    console.log(`\n=== OVERALL SCORE ===`);
    console.log(`${totalPassed}/${totalTests} tests passed (${overallScore}%)`);
    
    if (overallScore >= 90) {
      console.log('🎉 Excellent! Your cipher collection is in great shape!');
    } else if (overallScore >= 75) {
      console.log('👍 Good job! Some areas need attention.');
    } else if (overallScore >= 50) {
      console.log('⚠️  Needs improvement. Focus on failing tests.');
    } else {
      console.log('🔧 Significant work needed. Start with syntax errors.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new TestSuite();
  testSuite.runAllTests().catch(console.error);
}

module.exports = TestSuite;
