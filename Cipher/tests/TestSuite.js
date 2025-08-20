#!/usr/bin/env node
/*
 * Comprehensive Test Suite for Cipher Algorithms
 * Tests compilation, interface compatibility, metadata compliance, unresolved issues, functionality, and optimization
 * 
 * Test Categories:
 * - COMPILATION: Tests JavaScript syntax using `node -c` (syntax errors)
 * - INTERFACE: Tests if algorithm can be loaded and RegisterAlgorithm accepts it (interface errors)
 * - METADATA: Tests metadata compliance with CONTRIBUTING.md format
 * - ISSUES: Tests for unresolved TODO, FIXME, BUG, ISSUE comments
 * - FUNCTIONALITY: Tests algorithm functionality using test vectors
 * - OPTIMIZATION: Tests OpCodes usage for performance optimization
 * 
 * (c)2006-2025 Hawkynt
 */

const fs = require('fs');
const path = require('path');

class TestSuite {
  constructor() {
    this.totalAlgorithms = 0;
    this.algorithmsPerCategory = {};
    this.results = {
      compilation: { passed: 0, failed: 0, errors: [] },
      interface: { passed: 0, failed: 0, errors: [] },
      metadata: { passed: 0, failed: 0, errors: [] },
      issues: { passed: 0, failed: 0, errors: [] },
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
      
      // Check if single file test was requested
      const singleFile = process.argv[2];
      if (singleFile) {
        await this.testSingleFile(singleFile);
      } else {
        // Discover and test all algorithms
        await this.discoverAlgorithms();
      }
      
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
      
      // Load AlgorithmFramework
      global.AlgorithmFramework = require('../AlgorithmFramework.js');
      if (!global.AlgorithmFramework) {
        throw new Error('AlgorithmFramework not loaded properly');
      }
      
      console.log('✓ Dependencies loaded successfully\n');
    } catch (error) {
      throw new Error(`Failed to load dependencies: ${error.message}`);
    }
  }

  // Test a single file specified by filename
  async testSingleFile(filename) {
    const algorithmsDir = path.join(__dirname, '..', 'algorithms');
    let foundFile = false;
    
    console.log(`Searching for file: ${filename}`);
    console.log('');
    
    // Search through all categories
    const categories = fs.readdirSync(algorithmsDir).filter(item => 
      fs.statSync(path.join(algorithmsDir, item)).isDirectory()
    );
    
    for (const category of categories) {
      const categoryPath = path.join(algorithmsDir, category);
      const files = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
      
      if (files.includes(filename)) {
        foundFile = true;
        console.log(`Found ${filename} in category: ${category}`);
        this.algorithmsPerCategory[category] = 1;
        await this.testAlgorithm(category, filename);
        break;
      }
    }
    
    if (!foundFile) {
      console.error(`Error: File '${filename}' not found in any algorithm category.`);
      process.exit(1);
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
        compilation: false,
        interface: false,
        metadata: false,
        issues: false,
        functionality: false,
        optimization: false
      },
      details: {}
    };

    // COMPILATION TEST - JavaScript syntax and loading
    algorithmData.tests.compilation = await this.testCompilation(filePath, algorithmData);
    
    if (algorithmData.tests.compilation) {
      // INTERFACE TEST - AlgorithmFramework registration compatibility
      algorithmData.tests.interface = await this.testInterface(filePath, algorithmData);
      
      if (algorithmData.tests.interface) {
        // METADATA TEST - CONTRIBUTING.MD interface format
        algorithmData.tests.metadata = await this.testMetadata(filePath, category, algorithmData);
        
        // ISSUES TEST - Check for TODO, ISSUE, BUG, FIXME comments
        algorithmData.tests.issues = await this.testIssues(filePath, algorithmData);
        
        // FUNCTIONALITY TEST - Test vectors
        algorithmData.tests.functionality = await this.testFunctionality(filePath, algorithmData);
        
        // OPTIMIZATION TEST - OpCodes usage
        algorithmData.tests.optimization = await this.testOptimization(filePath, algorithmData);
      }
    }
    
    this.algorithmDetails.push(algorithmData);
    
    const status = Object.values(algorithmData.tests).every(t => t) ? '✓' : '✗';
    const registeredInfo = algorithmData.details.registeredNames 
      ? ` [Registered: ${algorithmData.details.registeredNames.join(', ')}]`
      : '';
    
    // Add round-trip information if available
    let roundTripInfo = '';
    if (algorithmData.details.testResults) {
      const roundTripSummary = algorithmData.details.testResults
        .filter(r => r.roundTripsAttempted > 0)
        .map(r => `${r.roundTripsPassed}/${r.roundTripsAttempted}`)
        .join(',');
      if (roundTripSummary) {
        roundTripInfo = ` [Round-trips: ${roundTripSummary}]`;
      }
    }
    
    const issuesCount = algorithmData.details.issues ? algorithmData.details.issues.totalCount : 0;
    const issuesStatus = algorithmData.tests.issues ? '0' : `${issuesCount}`;
    console.log(`    ${status} ${algorithmName} - Compilation:${algorithmData.tests.compilation?'✓':'✗'} Interface:${algorithmData.tests.interface?'✓':'✗'} Metadata:${algorithmData.tests.metadata?'✓':'✗'} Issues:${issuesStatus} Function:${algorithmData.tests.functionality?'✓':'✗'} Optimization:${algorithmData.tests.optimization?'✓':'✗'}${registeredInfo}${roundTripInfo}`);
  }

  // Test if file has valid JavaScript syntax without executing
  async testCompilation(filePath, algorithmData) {
    try {
      // Use Node.js to check syntax without executing
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // Use the full path for node -c
      await execAsync(`node -c "${filePath}"`);
      
      algorithmData.details.syntaxValid = true;
      this.results.compilation.passed++;
      return true;
      
    } catch (error) {
      algorithmData.details.compilationError = error.stderr || error.message;
      this.results.compilation.failed++;
      this.results.compilation.errors.push(`${algorithmData.name}: ${error.stderr || error.message}`);
      return false;
    }
  }

  // Test if algorithm can be loaded and registered via AlgorithmFramework
  async testInterface(filePath, algorithmData) {
    try {
      // Clear the algorithm registry before testing
      global.AlgorithmFramework.Clear();
      
      // Clear require cache to ensure fresh load
      delete require.cache[require.resolve(filePath)];
      
      // Try to require the file (this should call RegisterAlgorithm internally)
      require(filePath);
      
      // Check if algorithms were registered
      const registeredAlgorithms = global.AlgorithmFramework.Algorithms;
      const algorithmCount = registeredAlgorithms.length;
      
      if (algorithmCount > 0) {
        algorithmData.details.addedToFramework = true;
        algorithmData.details.algorithmCount = algorithmCount;
        algorithmData.details.registeredNames = registeredAlgorithms.map(alg => alg.name);
        this.results.interface.passed++;
        return true;
      } else {
        algorithmData.details.interfaceError = 'No algorithms registered (RegisterAlgorithm likely failed)';
        this.results.interface.failed++;
        this.results.interface.errors.push(`${algorithmData.name}: No algorithms registered`);
        return false;
      }
      
    } catch (error) {
      algorithmData.details.interfaceError = error.message;
      this.results.interface.failed++;
      this.results.interface.errors.push(`${algorithmData.name}: ${error.message}`);
      return false;
    }
  }

  // Test metadata compliance with CONTRIBUTING.md format
  async testMetadata(filePath, expectedCategory, algorithmData) {
    try {
      // Get registered algorithms from AlgorithmFramework
      const registeredAlgorithms = global.AlgorithmFramework.Algorithms;
      
      if (!registeredAlgorithms || registeredAlgorithms.length === 0) {
        this.results.metadata.failed++;
        this.results.metadata.errors.push(`${algorithmData.name}: No algorithms registered for metadata testing`);
        return false;
      }

      // Test metadata for each registered algorithm
      let anyCompliant = false;
      const metadataResults = [];
      
      for (const algorithm of registeredAlgorithms) {
        const requiredFields = ['name', 'description', 'category'];
        const missingFields = [];
        
        // Check required fields
        for (const field of requiredFields) {
          if (!algorithm[field]) {
            missingFields.push(field);
          }
        }
        
        // Check category matches subfolder (more flexible mapping)
        const categoryName = algorithm.category?.name?.toLowerCase() || '';
        const categoryMatch = categoryName.includes(expectedCategory.toLowerCase()) ||
                             (expectedCategory === 'classical' && categoryName.includes('classical')) ||
                             (expectedCategory === 'block' && (categoryName.includes('block') || categoryName.includes('cipher'))) ||
                             (expectedCategory === 'stream' && (categoryName.includes('stream') || categoryName.includes('cipher')));
        
        if (!categoryMatch) {
          missingFields.push(`category mismatch: expected ${expectedCategory}, got ${algorithm.category}`);
        }
        
        // Count documentation, vulnerabilities, tests
        const docCount = algorithm.documentation ? algorithm.documentation.length : 0;
        const vulnCount = algorithm.knownVulnerabilities ? algorithm.knownVulnerabilities.length : 0;
        const testCount = algorithm.testVectors ? algorithm.testVectors.length : 0;
        
        const algorithmMetadata = {
          algorithm: algorithm.name,
          hasAllRequiredFields: missingFields.length === 0,
          missingFields: missingFields,
          categoryMatch: categoryMatch,
          documentationCount: docCount,
          vulnerabilityCount: vulnCount,
          testVectorCount: testCount
        };
        
        metadataResults.push(algorithmMetadata);
        
        if (missingFields.length === 0) {
          anyCompliant = true;
        }
      }
      
      algorithmData.details.metadata = {
        algorithmCount: registeredAlgorithms.length,
        results: metadataResults,
        anyCompliant: anyCompliant
      };
      
      if (anyCompliant) {
        this.results.metadata.passed++;
        return true;
      } else {
        this.results.metadata.failed++;
        const failedAlgorithms = metadataResults.filter(r => !r.hasAllRequiredFields).length;
        this.results.metadata.errors.push(`${algorithmData.name}: ${failedAlgorithms}/${metadataResults.length} algorithms failed metadata validation`);
        return false;
      }
      
    } catch (error) {
      algorithmData.details.metadataError = error.message;
      this.results.metadata.failed++;
      this.results.metadata.errors.push(`${algorithmData.name}: ${error.message}`);
      return false;
    }
  }

  // Test for unresolved issues (TODO, ISSUE, BUG, FIXME comments)
  async testIssues(filePath, algorithmData) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Define issue patterns to search for
      const issuePatterns = [
        { type: 'TODO', pattern: /\/\/.*TODO.*|\/\*.*TODO.*\*\//gi },
        { type: 'FIXME', pattern: /\/\/.*FIXME.*|\/\*.*FIXME.*\*\//gi },
        { type: 'BUG', pattern: /\/\/.*BUG.*|\/\*.*BUG.*\*\//gi },
        { type: 'ISSUE', pattern: /\/\/.*ISSUE.*|\/\*.*ISSUE.*\*\//gi }
      ];
      
      const foundIssues = [];
      let totalIssueCount = 0;
      
      // Search for each issue type
      issuePatterns.forEach(({ type, pattern }) => {
        const matches = fileContent.match(pattern) || [];
        if (matches.length > 0) {
          foundIssues.push({ type, count: matches.length, comments: matches });
          totalIssueCount += matches.length;
        }
      });
      
      algorithmData.details.issues = {
        totalCount: totalIssueCount,
        issueTypes: foundIssues,
        hasUnresolvedIssues: totalIssueCount > 0
      };
      
      if (totalIssueCount === 0) {
        this.results.issues.passed++;
        return true;
      } else {
        const issuesSummary = foundIssues.map(issue => `${issue.count} ${issue.type}`).join(', ');
        this.results.issues.failed++;
        this.results.issues.errors.push(`${algorithmData.name}: ${issuesSummary}`);
        return false;
      }
      
    } catch (error) {
      algorithmData.details.issuesError = error.message;
      this.results.issues.failed++;
      this.results.issues.errors.push(`${algorithmData.name}: ${error.message}`);
      return false;
    }
  }

  // Test if algorithm works with basic test vectors
  async testFunctionality(filePath, algorithmData) {
    if (algorithmData.details.interfaceError) {
      this.results.functionality.skipped++;
      return false;
    }
    
    try {
      // Get registered algorithms
      const registeredAlgorithms = global.AlgorithmFramework.Algorithms;
      
      if (!registeredAlgorithms || registeredAlgorithms.length === 0) {
        algorithmData.details.functionalityError = 'No algorithms registered for testing';
        this.results.functionality.failed++;
        this.results.functionality.errors.push(`${algorithmData.name}: No algorithms registered`);
        return false;
      }
      
      // Test each registered algorithm
      let anySuccess = false;
      const testResults = [];
      
      for (const algorithm of registeredAlgorithms) {
        try {
          // Get test vectors from metadata
          const testVectors = algorithm.testVectors || [];
          
          if (testVectors.length === 0) {
            testResults.push({
              algorithm: algorithm.name,
              status: 'no-tests',
              message: 'No test vectors available'
            });
            continue;
          }
          
          // Test first vector (or all if reasonable number)
          const vectorsToTest = testVectors.slice(0, Math.min(3, testVectors.length));
          let vectorsPassed = 0;
          let roundTripsPassed = 0;
          
          for (const vector of vectorsToTest) {
            try {
              // Create fresh instance for each test vector
              const testInstance = algorithm.CreateInstance(false); // false = forward/encrypt mode
              
              // Apply test vector properties to instance (automatic configuration)
              for (const [key, value] of Object.entries(vector)) {
                if (key !== 'text' && key !== 'uri' && key !== 'input' && key !== 'expected' && key !== 'output') {
                  try {
                    if (testInstance.hasOwnProperty(key) || key in testInstance) {
                      testInstance[key] = value;
                    }
                  } catch (propertyError) {
                    // Property setting failed, continue anyway
                  }
                }
              }
              
              // Feed input data
              testInstance.Feed(vector.input);
              
              // Get result
              const result = testInstance.Result();
              
              // Compare with expected output (try both 'expected' and 'output' properties)
              const expectedOutput = vector.expected || vector.output;
              if (this.compareArrays(result, expectedOutput)) {
                vectorsPassed++;
                
                // Try round-trip test by attempting to create an inverse instance
                try {
                  // Try to create an inverse instance (decrypt mode)
                  const inverseInstance = algorithm.CreateInstance(true); // true = inverse/decrypt mode
                  
                  if (inverseInstance) {
                    // Apply same properties to inverse instance
                    for (const [key, value] of Object.entries(vector)) {
                      if (key !== 'text' && key !== 'uri' && key !== 'input' && key !== 'expected' && key !== 'output') {
                        try {
                          if (inverseInstance.hasOwnProperty(key) || key in inverseInstance) {
                            inverseInstance[key] = value;
                          }
                        } catch (propertyError) {
                          // Property setting failed, continue anyway
                        }
                      }
                    }
                    
                    // Feed the result (encrypted data) to decrypt it back
                    inverseInstance.Feed(result);
                    const decryptedResult = inverseInstance.Result();
                    
                    // Check if we get back the original input
                    if (this.compareArrays(decryptedResult, vector.input)) {
                      roundTripsPassed++;
                    }
                  }
                } catch (inverseError) {
                  // Inverse instance creation failed or round-trip failed - that's okay
                  // Not all algorithms support inverse operations
                }
              }
            } catch (vectorError) {
              // Vector failed, but continue testing others
              continue;
            }
          }
          
          if (vectorsPassed > 0) {
            anySuccess = true;
            testResults.push({
              algorithm: algorithm.name,
              status: 'passed',
              vectorsPassed: vectorsPassed,
              vectorsTotal: vectorsToTest.length,
              roundTripsPassed: roundTripsPassed,
              roundTripsAttempted: vectorsPassed // Only attempt round-trip on successful vectors
            });
          } else {
            testResults.push({
              algorithm: algorithm.name,
              status: 'failed',
              vectorsPassed: 0,
              vectorsTotal: vectorsToTest.length,
              roundTripsPassed: 0,
              roundTripsAttempted: 0
            });
          }
          
        } catch (algorithmError) {
          testResults.push({
            algorithm: algorithm.name,
            status: 'error',
            message: algorithmError.message
          });
        }
      }
      
      algorithmData.details.testResults = testResults;
      
      if (anySuccess) {
        this.results.functionality.passed++;
        return true;
      } else {
        algorithmData.details.functionalityError = 'All algorithm tests failed';
        this.results.functionality.failed++;
        this.results.functionality.errors.push(`${algorithmData.name}: All algorithms failed testing`);
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
    
    // Show errors if any
    ['compilation', 'interface', 'metadata', 'issues', 'functionality', 'optimization'].forEach(testType => {
      if (this.results[testType].errors.length > 0) {
        console.log(`\n=== ${testType.toUpperCase()} ERRORS ===`);
        this.results[testType].errors.forEach(error => {
          console.log(`  ✗ ${error}`);
        });
      }
    });
    
    // Overall score
    const totalTests = this.totalAlgorithms * 6; // 6 test categories: compilation, interface, metadata, issues, functionality, optimization
    const totalPassed = Object.values(this.results).reduce((sum, result) => sum + result.passed, 0);
    const overallScore = ((totalPassed / totalTests) * 100).toFixed(1);
    
    console.log('\n=== COMPREHENSIVE TEST REPORT ===');
    console.log(`Total algorithms tested: ${this.totalAlgorithms}`);
    console.log('\nAlgorithms per category:');
    Object.entries(this.algorithmsPerCategory).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });
    
    console.log('\n=== TEST RESULTS SUMMARY ===');
    console.log(`🔧 COMPILATION:   ${this.results.compilation.passed}/${this.totalAlgorithms} passed`);
    console.log(`🔌 INTERFACE:     ${this.results.interface.passed}/${this.totalAlgorithms} passed`);
    console.log(`📋 METADATA:      ${this.results.metadata.passed}/${this.totalAlgorithms} passed`);
    console.log(`⚠️ ISSUES:        ${this.results.issues.passed}/${this.totalAlgorithms} passed`);
    console.log(`⚡ FUNCTIONALITY: ${this.results.functionality.passed}/${this.totalAlgorithms} passed`);
    console.log(`🚀 OPTIMIZATION:  ${this.results.optimization.passed}/${this.totalAlgorithms} passed`);
    
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
