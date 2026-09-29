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
 * - TYPES: Counts value sites whose type no policy tier supplies (OpCodes JSDoc,
 *   framework interfaces, local JSDoc - see TypeCoverage.js) and holds each file
 *   to its budget in type-budgets.json. The budget is a ratchet: a file fails
 *   when its count rises above it; a budget of 0 means the file is policy-clean.
 *
 * Options:
 *   <file.js>                 test one file
 *   --category=<dir>          test one category (e.g. --category=hash)
 *   --algorithm=<name>        test the file(s) with that base name (e.g. --algorithm=murmurhash3)
 *   --verbose                 details, including every untyped value site
 *   --update-type-budgets     lower each tested file's TYPES budget to its current count
 *   --allow-budget-increase   with --update-type-budgets: also raise budgets (and add new files)
 *
 * (c)2006-2025 Hawkynt
 */

const fs = require('fs');
const path = require('path');
const { TestFile, TestAlgorithm, TestVector } = require('./TestEngine');
const TypeCoverage = require('./TypeCoverage');
const JSDocTierAudit = require('./JSDocTierAudit');

const CIPHER_DIR = path.join(__dirname, '..');
const TYPE_BUDGETS_FILE = path.join(__dirname, 'type-budgets.json');

/**
 * Budgets of untyped value sites per algorithm file (path relative to Cipher/).
 * -1 marks a file the transpiler could not parse when the budget was set.
 * @returns {Object} path -> budget
 */
function loadTypeBudgets() {
  try {
    return JSON.parse(fs.readFileSync(TYPE_BUDGETS_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

class TestSuite {
  constructor() {
    this.totalAlgorithms = 0;
    this.algorithmsPerCategory = {};
    this.verbose = false;
    this.algorithmDetails = [];
    // Algorithm name -> what failed. Keyed by name so an algorithm registered
    // under several names is counted once.
    this.invertibilityFailures = new Map();
    this.engine = null; // Will be initialized in loadDependencies
    this.results = {
      compilation: { passed: 0, failed: 0, errors: [] },
      interface: { passed: 0, failed: 0, errors: [] },
      metadata: { passed: 0, failed: 0, errors: [] },
      issues: { passed: 0, failed: 0, errors: [] },
      functionality: { passed: 0, failed: 0, errors: [] },
      optimization: { passed: 0, failed: 0, errors: [] },
      types: { passed: 0, failed: 0, errors: [] }
    };
    this.typeBudgets = loadTypeBudgets();
    this.typeCounts = {};                                   // path -> count (null: unparsed)
    this.typeTotals = { sites: 0, opcodes: 0, framework: 0, local: 0, unparsed: 0 };
    this.typeTimeMs = 0;
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

      const option = name => (args.find(arg => arg.startsWith(`--${name}=`)) || '').split('=')[1] || null;
      this.categoryFilter = option('category');
      this.algorithmFilter = option('algorithm');
      this.updateTypeBudgets = args.includes('--update-type-budgets');
      this.allowBudgetIncrease = args.includes('--allow-budget-increase');

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

      if (this.updateTypeBudgets)
        this.writeTypeBudgets();

    } catch (error) {
      console.error('Fatal error during test execution:', error.message);
      process.exit(1);
    }
  }

  // Load required dependencies
  async loadDependencies() {
    console.log('Loading dependencies...');
    try {
      // Load AlgorithmFramework and OpCodes
      const frameworkPath = path.join(__dirname, '..', 'AlgorithmFramework.js');
      const opCodesPath = path.join(__dirname, '..', 'OpCodes.js');

      global.AlgorithmFramework = require(frameworkPath);
      global.OpCodes = require(opCodesPath);

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
      fs.statSync(path.join(algorithmsDir, item)).isDirectory() &&
      (!this.categoryFilter || item === this.categoryFilter)
    );
    if (categories.length === 0)
      throw new Error(`No algorithm category '${this.categoryFilter}'`);

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
    const files = fs.readdirSync(categoryPath).filter(file =>
      file.endsWith('.js') && !file.endsWith('.data.js') &&
      (!this.algorithmFilter || path.basename(file, '.js') === this.algorithmFilter)
    );
    if (files.length === 0) return;

    console.log(`Testing ${category} algorithms (${files.length} files):`);

    this.algorithmsPerCategory[category] = 0;

    for (const file of files) {
      await this.testAlgorithm(category, file);
    }

    console.log('');
  }

  // Test individual algorithm file - uses new simplified TestEngine
  async testAlgorithm(category, filename) {
    const filePath = path.join(__dirname, '..', 'algorithms', category, filename);
    const algorithmName = path.basename(filename, '.js');

    console.log(`  Testing ${algorithmName}...`);

    this.totalAlgorithms++;
    this.algorithmsPerCategory[category]++;

    // Use TestFile from new TestEngine with timing and 5-second timeout
    const startTime = process.hrtime.bigint();
    const timeoutMs = 5000;

    let result;
    let timedOut = false;

    try {
      // Race between test execution and timeout
      result = await Promise.race([
        TestFile(filePath, { verbose: this.verbose, silent: false }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
        )
      ]);
    } catch (error) {
      if (error.message === 'TIMEOUT') {
        timedOut = true;
        // Create failed result for timeout
        result = {
          compilation: { passed: true, error: null },
          interface: { passed: true, error: null },
          metadata: { passed: true, error: null },
          issues: { passed: true, errors: [] },
          functionality: { passed: false, error: `Test execution exceeded ${timeoutMs}ms timeout` },
          optimization: { passed: false, error: 'Not tested due to timeout' }
        };
      } else {
        throw error;
      }
    }

    const endTime = process.hrtime.bigint();
    const elapsedMs = Number(endTime - startTime) / 1_000_000;

    result.types = this.testTypes(filePath);

    // Convert to old format for compatibility
    const algorithmData = {
      name: algorithmName,
      filePath: filePath,
      tests: {
        compilation: result.compilation.passed,
        interface: result.interface.passed,
        metadata: result.metadata.passed,
        issues: result.issues.passed,
        functionality: result.functionality.passed,
        optimization: result.optimization.passed,
        types: result.types.passed
      },
      details: {
        registeredNames: result.interface.algorithms,
        testResults: result.functionality.testResults,
        issues: result.issues.errors.length > 0 ? { totalCount: result.issues.errors.length } : null
      }
    };

    this.algorithmDetails.push(algorithmData);

    // Update accumulated results
    this.updateResults(result);

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

    // A failed inverse used to be printed and then thrown away. The status was
    // read by the verbose display and nowhere else, so an algorithm that could
    // not decrypt what it encrypted still counted as a pass: 36 of them reported
    // a failed invertibility requirement inside a run that printed 100% and
    // exited 0. Algorithms with no meaningful inverse are named on the shared
    // exemption list and never reach this branch.
    if (algorithmData.details.testResults) {
      for (const r of algorithmData.details.testResults) {
        if (r.status !== 'failed-roundtrips' && r.status !== 'failed-encoding-stability') continue;
        const kind = r.status === 'failed-roundtrips' ? 'round-trip' : 'encoding stability';
        this.invertibilityFailures.set(algorithmName,
          `${kind} ${r.roundTripsPassed}/${r.roundTripsAttempted}`);
      }
    }

    const issuesCount = algorithmData.details.issues ? algorithmData.details.issues.totalCount : 0;
    const issuesStatus = algorithmData.tests.issues ? '0' : `${issuesCount}`;
    const timingInfo = timedOut ? ` (TIMEOUT after ${elapsedMs.toFixed(2)}ms)` : ` (${elapsedMs.toFixed(2)}ms)`;
    console.log(`    ${status} ${algorithmName} - Compilation:${algorithmData.tests.compilation?'✓':'✗'} Interface:${algorithmData.tests.interface?'✓':'✗'} Metadata:${algorithmData.tests.metadata?'✓':'✗'} Issues:${issuesStatus} Function:${algorithmData.tests.functionality?'✓':'✗'} Optimization:${algorithmData.tests.optimization?'✓':'✗'} Types:${result.types.summary}${registeredInfo}${roundTripInfo}${timingInfo}`);

    // Show verbose output if requested (matches original format)
    if (this.verbose && algorithmData.details.testResults) {
      this.showVerboseTestResults(algorithmData);
    }
    if (this.verbose && result.types.sites.length > 0) {
      console.log(`    Untyped value sites in ${result.types.file}:`);
      for (const site of result.types.sites)
        console.log(`      ${result.types.file}:${site.line} [${site.tier}] ${site.expression} - ${site.reason}`);
    }
  }

  /**
   * TYPES: count the file's untyped value sites and hold it to its budget.
   * @param {string} filePath - Algorithm file
   * @returns {Object} { passed, error, summary, sites, file }
   */
  testTypes(filePath) {
    const file = path.relative(CIPHER_DIR, filePath).split(path.sep).join('/');
    const start = process.hrtime.bigint();
    const coverage = TypeCoverage.analyzeFile(filePath);
    this.typeTimeMs += Number(process.hrtime.bigint() - start) / 1_000_000;

    const hasBudget = Object.prototype.hasOwnProperty.call(this.typeBudgets, file);
    const budget = hasBudget ? this.typeBudgets[file] : 0;
    this.typeCounts[file] = coverage.count;

    if (coverage.parseError) {
      ++this.typeTotals.unparsed;
      // -1: the transpiler could not parse this file when its budget was set either.
      const passed = budget === -1;
      return {
        passed, file, sites: [], summary: 'unparsed',
        error: passed ? null : `${file}: the transpiler cannot parse it (${coverage.parseError})`
      };
    }

    const tiers = TypeCoverage.byTier(coverage.sites);
    this.typeTotals.sites += coverage.count;
    for (const tier of Object.keys(tiers)) this.typeTotals[tier] = (this.typeTotals[tier] || 0) + tiers[tier];
    const passed = budget === -1 || coverage.count <= budget;
    return {
      passed, file, sites: coverage.sites,
      summary: `${coverage.count}/${budget === -1 ? '-' : budget}`,
      error: passed ? null : `${file}: ${coverage.count} untyped value sites, budget ${budget}` +
        (hasBudget ? '' : ' (new file: add JSDoc, or record a budget with --update-type-budgets --allow-budget-increase)')
    };
  }

  /**
   * Rewrite type-budgets.json from this run's counts: only ever lower a budget,
   * unless --allow-budget-increase is given too. Files not tested keep theirs.
   */
  writeTypeBudgets() {
    const budgets = { ...this.typeBudgets };
    let lowered = 0, raised = 0;
    for (const [file, count] of Object.entries(this.typeCounts)) {
      const next = count === null ? -1 : count;        // -1: the transpiler cannot parse the file
      const has = Object.prototype.hasOwnProperty.call(budgets, file);
      const current = has ? budgets[file] : null;
      if (has && current === next) continue;
      // Stricter: a lower count, or a real count where the file was unparsable.
      const stricter = has && next !== -1 && (current === -1 || next < current);
      if (stricter) {
        budgets[file] = next;
        ++lowered;
      } else if (this.allowBudgetIncrease) {
        budgets[file] = next;
        ++raised;
      }
    }
    const sorted = {};
    for (const file of Object.keys(budgets).sort()) sorted[file] = budgets[file];
    fs.writeFileSync(TYPE_BUDGETS_FILE, JSON.stringify(sorted, null, 1).replace(/^ /gm, '  ') + '\n');
    console.log(`\nType budgets: ${lowered} lowered, ${raised} raised or added -> ${path.relative(CIPHER_DIR, TYPE_BUDGETS_FILE)}`);
    if (!this.allowBudgetIncrease)
      console.log('(budgets only go down; pass --allow-budget-increase as well to raise or add one)');
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

  // Update accumulated test results
  updateResults(result) {
    const testTypes = ['compilation', 'interface', 'metadata', 'issues', 'functionality', 'optimization', 'types'];

    testTypes.forEach(type => {
      if (result[type].passed) {
        this.results[type].passed++;
      } else {
        this.results[type].failed++;
        if (result[type].error) {
          this.results[type].errors.push(result[type].error);
        }
        if (result[type].errors && Array.isArray(result[type].errors)) {
          this.results[type].errors.push(...result[type].errors.map(e => typeof e === 'string' ? e : e.content || JSON.stringify(e)));
        }
      }
    });
  }

  // Generate comprehensive test report - matches original format exactly
  generateReport() {
    // Calculate summary
    const engineResults = {
      passed: Object.values(this.results).reduce((sum, r) => sum + r.passed, 0),
      total: Object.values(this.results).reduce((sum, r) => sum + r.passed + r.failed, 0)
    };
    engineResults.percentage = engineResults.total > 0
      ? Math.round((engineResults.passed / engineResults.total) * 100)
      : 0;

    // Show errors if any (matches original format)
    ['compilation', 'interface', 'metadata', 'issues', 'functionality', 'optimization', 'types'].forEach(testType => {
      if (this.results[testType].errors.length > 0) {
        console.log(`\n=== ${testType.toUpperCase()} ERRORS ===`);
        this.results[testType].errors.forEach(error => {
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
    console.log(`🔧 COMPILATION:   ${this.results.compilation.passed}/${this.results.compilation.passed + this.results.compilation.failed} passed`);
    console.log(`🔌 INTERFACE:     ${this.results.interface.passed}/${this.results.interface.passed + this.results.interface.failed} passed`);
    console.log(`📋 METADATA:      ${this.results.metadata.passed}/${this.results.metadata.passed + this.results.metadata.failed} passed`);
    console.log(`⚠️ ISSUES:        ${this.results.issues.passed}/${this.results.issues.passed + this.results.issues.failed} passed`);
    console.log(`⚡ FUNCTIONALITY: ${this.results.functionality.passed}/${this.results.functionality.passed + this.results.functionality.failed} passed`);
    console.log(`🚀 OPTIMIZATION:  ${this.results.optimization.passed}/${this.results.optimization.passed + this.results.optimization.failed} passed`);
    const t = this.typeTotals;
    console.log(`🔠 TYPES:         ${this.results.types.passed}/${this.results.types.passed + this.results.types.failed} passed` +
      ` (${t.sites} untyped value sites: ${t.opcodes} OpCodes JSDoc, ${t.framework} framework, ${t.local} local source` +
      `${t.unparsed ? `; ${t.unparsed} file(s) not parsed` : ''}; +${(this.typeTimeMs / 1000).toFixed(1)}s)`);

    // Tiers 1 and 2 are libraries every file relies on: each of their members
    // must be fully typed by JSDoc, or no algorithm can be.
    this.tierAuditGaps = 0;
    for (const [label, audit] of [['OpCodes', JSDocTierAudit.auditOpCodes()], ['AlgorithmFramework', JSDocTierAudit.auditFramework()]]) {
      const gaps = audit.members.filter(m => m.gaps.length > 0);
      this.tierAuditGaps += gaps.length;
      console.log(`📚 ${label} JSDoc: ${audit.typed}/${audit.total} members fully typed`);
      for (const m of gaps) console.log(`  ✗ ${label}.${m.name}: ${m.gaps.join('; ')}`);
    }
    console.log('');

    console.log('=== OVERALL SCORE ===');
    const totalTests = engineResults.total;
    const passedTests = engineResults.passed;
    const percentage = engineResults.percentage;

    // The percentage was rounded, so 5575 of 5580 printed as "100%" and drew the
    // congratulatory line - five failures reported as a clean run. It is floored
    // now, and only a genuinely empty failure list counts as complete.
    const failedTests = totalTests - passedTests;
    const displayed = totalTests > 0 ? Math.floor((passedTests / totalTests) * 100) : 100;

    console.log(`${passedTests}/${totalTests} tests passed (${displayed}%)`);

    if (failedTests === 0) {
      console.log('🎉 Excellent! Your cipher collection is in great shape!');
    } else if (displayed >= 90) {
      console.log(`👍 Good job! ${failedTests} test(s) need attention.`);
    } else if (displayed >= 70) {
      console.log(`⚠️ ${failedTests} test(s) need to be addressed.`);
    } else {
      console.log(`❌ Major issues found: ${failedTests} test(s) failing.`);
    }

    if (this.invertibilityFailures.size > 0) {
      console.log('');
      console.log(`=== INVERTIBILITY (${this.invertibilityFailures.size} algorithm(s) cannot recover their own output) ===`);
      for (const [name, detail] of this.invertibilityFailures)
        console.log(`  ✗ ${name} - ${detail}`);
      console.log('An algorithm with no meaningful inverse belongs on the list in');
      console.log('tests/round-trip-exemptions.js with its reason, not here.');
    }

    // Anything above zero has to fail the process, or the suite cannot gate
    // anything: it exited 0 whatever happened, so a broken algorithm - or a file
    // that throws while loading - passed CI unnoticed.
    this.failedTestCount = failedTests + this.invertibilityFailures.size + this.tierAuditGaps;
  }
}

// CLI execution
if (require.main === module) {
  const testSuite = new TestSuite();
  testSuite.runAllTests().then(() => {
    // Without this the suite exited 0 no matter how many tests failed, so it
    // could report problems but never stop anything acting on them.
    if (testSuite.failedTestCount > 0) process.exitCode = 1;
  }).catch(error => {
    console.error('Failed to run tests:', error.message);
    process.exit(1);
  });
}

module.exports = TestSuite;