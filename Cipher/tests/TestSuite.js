#!/usr/bin/env node
/*
 * Comprehensive Test Suite for Cipher Algorithms - CLI Interface
 * Tests compilation, interface compatibility, metadata compliance, unresolved issues, functionality, and optimization
 *
 * This is the CLI wrapper that uses TestEngine for all testing logic
 * Maintains exact same interface as original for backward compatibility
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
const TestEngine = require('./TestEngine');

class TestSuite {
  constructor() {
    this.engine = new TestEngine({ verbose: false, silent: false });
    this.totalAlgorithms = 0;
    this.algorithmsPerCategory = {};
    this.verbose = false;
    this.algorithmDetails = [];
  }

  // Main entry point - maintains exact same interface
  async runAllTests() {
    console.log('SynthelicZ Cipher Tools - Comprehensive Test Suite');
    console.log('================================================');
    console.log('');

    try {
      // Load OpCodes first
      await this.loadDependencies();

      // Parse command line arguments
      const args = process.argv.slice(2);
      this.verbose = args.includes('--verbose') || args.includes('-v');
      this.engine.verbose = this.verbose;

      // Filter out flags to get the filename
      const singleFile = args.find(arg => !arg.startsWith('--') && !arg.startsWith('-'));

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
      await this.engine.loadDependencies();
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
        this.algorithmsPerCategory[category] = 0; // Initialize to 0, will be incremented in testAlgorithm
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

  // Test individual algorithm file - now uses TestEngine
  async testAlgorithm(category, filename) {
    const filePath = path.join(__dirname, '..', 'algorithms', category, filename);
    const algorithmName = path.basename(filename, '.js');

    console.log(`  Testing ${algorithmName}...`);

    this.totalAlgorithms++;
    this.algorithmsPerCategory[category]++;

    // Use TestEngine to do the actual testing
    const algorithmData = await this.engine.testAlgorithm(filePath, algorithmName, category);
    this.algorithmDetails.push(algorithmData);

    // Format output exactly like original
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

    // Show verbose output if requested (matches original format)
    if (this.verbose && algorithmData.details.testResults) {
      this.showVerboseTestResults(algorithmData);
    }
  }

  // Show detailed test results in verbose mode
  showVerboseTestResults(algorithmData) {
    console.log(`\n=== DETAILED TEST RESULTS for ${algorithmData.name} ===`);

    for (const result of algorithmData.details.testResults) {
      console.log(`\nAlgorithm: ${result.algorithm}`);
      console.log(`Status: ${result.status.toUpperCase()}`);

      if (result.status === 'passed') {
        console.log(`  Vectors Passed: ${result.vectorsPassed}/${result.vectorsTotal}`);
        console.log(`  Round-trips Passed: ${result.roundTripsPassed}/${result.roundTripsAttempted}`);
        if (result.requiresRoundTrips) {
          console.log(`  Invertibility Requirement: ✓ ENFORCED (perfect round-trips required)`);
        } else if (result.requiresEncodingStability) {
          console.log(`  Invertibility Requirement: ✓ ENFORCED (encoding stability required)`);
        }
      } else if (result.status === 'failed-roundtrips') {
        console.log(`  Vectors Passed: ${result.vectorsPassed}/${result.vectorsTotal}`);
        console.log(`  Round-trips Passed: ${result.roundTripsPassed}/${result.roundTripsAttempted} (FAILED - REQUIRED)`);
        console.log(`  Issue: ${result.message}`);
        console.log(`  Invertibility Requirement: ✗ FAILED (invertible algorithm must support decryption)`);
      } else if (result.status === 'failed-encoding-stability') {
        console.log(`  Vectors Passed: ${result.vectorsPassed}/${result.vectorsTotal}`);
        console.log(`  Encoding Stability: ${result.roundTripsPassed}/${result.roundTripsAttempted} (FAILED - REQUIRED)`);
        console.log(`  Issue: ${result.message}`);
        console.log(`  Encoding Stability Requirement: ✗ FAILED (encoding must be stable)`);
      } else if (result.status === 'failed') {
        console.log(`  Vectors Passed: ${result.vectorsPassed}/${result.vectorsTotal}`);
        console.log(`  Issue: Test vector validation failed`);
      } else if (result.status === 'no-tests') {
        console.log(`  Issue: ${result.message}`);
      } else if (result.status === 'error') {
        console.log(`  Issue: ${result.message}`);
      }

      // Show individual vector details if available
      if (result.vectorDetails && result.vectorDetails.length > 0) {
        console.log(`\n  Test Vector Details:`);
        for (const vector of result.vectorDetails) {
          const statusSymbol = vector.passed ? '✓' : '✗';
          const roundTripSymbol = vector.roundTripSuccess ? '↺✓' : '↺✗';
          console.log(`    ${statusSymbol} Vector ${vector.index}: ${vector.text} ${roundTripSymbol}`);

          if (!vector.passed && vector.error) {
            console.log(`      Error: ${vector.error}`);
          }
        }
      }
    }
    console.log('===============================================\n');
  }

  // Generate comprehensive test report - matches original format exactly
  generateReport() {
    // Get results from engine
    const engineResults = this.engine.getResultsSummary();

    // Show errors if any (matches original format)
    ['compilation', 'interface', 'metadata', 'issues', 'functionality', 'optimization'].forEach(testType => {
      if (this.engine.results[testType].errors.length > 0) {
        console.log(`\n=== ${testType.toUpperCase()} ERRORS ===`);
        this.engine.results[testType].errors.forEach(error => {
          console.log(`  ✗ ${error}`);
        });
      }
    });

    console.log('\n=== COMPREHENSIVE TEST REPORT ===');
    console.log(`Total algorithms tested: ${this.totalAlgorithms}`);
    console.log('');
    console.log('Algorithms per category:');
    Object.entries(this.algorithmsPerCategory).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });
    console.log('');

    console.log('=== TEST RESULTS SUMMARY ===');
    console.log(`🔧 COMPILATION:   ${this.engine.results.compilation.passed}/${this.engine.results.compilation.passed + this.engine.results.compilation.failed} passed`);
    console.log(`🔌 INTERFACE:     ${this.engine.results.interface.passed}/${this.engine.results.interface.passed + this.engine.results.interface.failed} passed`);
    console.log(`📋 METADATA:      ${this.engine.results.metadata.passed}/${this.engine.results.metadata.passed + this.engine.results.metadata.failed} passed`);
    console.log(`⚠️ ISSUES:        ${this.engine.results.issues.passed}/${this.engine.results.issues.passed + this.engine.results.issues.failed} passed`);
    console.log(`⚡ FUNCTIONALITY: ${this.engine.results.functionality.passed}/${this.engine.results.functionality.passed + this.engine.results.functionality.failed} passed`);
    console.log(`🚀 OPTIMIZATION:  ${this.engine.results.optimization.passed}/${this.engine.results.optimization.passed + this.engine.results.optimization.failed} passed`);
    console.log('');

    console.log('=== OVERALL SCORE ===');
    const totalTests = engineResults.total;
    const passedTests = engineResults.passed;
    const percentage = engineResults.percentage;

    console.log(`${passedTests}/${totalTests} tests passed (${percentage}%)`);

    if (percentage === 100) {
      console.log('🎉 Excellent! Your cipher collection is in great shape!');
    } else if (percentage >= 90) {
      console.log('👍 Good job! Some areas need attention.');
    } else if (percentage >= 70) {
      console.log('⚠️ Several issues need to be addressed.');
    } else {
      console.log('❌ Major issues found. Significant work needed.');
    }
  }
}

// CLI execution
if (require.main === module) {
  const testSuite = new TestSuite();
  testSuite.runAllTests().catch(error => {
    console.error('Failed to run tests:', error.message);
    process.exit(1);
  });
}

module.exports = TestSuite;