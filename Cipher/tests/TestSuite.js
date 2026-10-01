#!/usr/bin/env node
/*
 * Algorithm test runner: is each algorithm correct?
 * (c)2006-2025 Hawkynt
 *
 * Every algorithm file is read, compiled and loaded once; every category below
 * then works from that one load.
 *
 * Per file:
 * - COMPILATION: JavaScript syntax, compiled as Node compiles a module
 * - INTERFACE: the file loads and registers at least one algorithm
 * - METADATA: metadata compliance with CONTRIBUTING.md
 * - ISSUES: unresolved TODO, FIXME, BUG, ISSUE, HACK comments
 * - FUNCTIONALITY: the committed test vectors; an algorithm with an inverse must
 *   also recover each vector's input from its output (algorithms with no
 *   inverse - hashes, MACs, KDFs, generators and the exemption list in
 *   round-trip-exemptions.js - are not round-tripped)
 * - OPTIMIZATION: OpCodes instead of raw bit operators
 * - TYPES: value sites whose type no policy tier supplies (OpCodes JSDoc,
 *   framework interfaces, local JSDoc - see TypeCoverage.js), held to each
 *   file's budget in type-budgets.json. The budget is a ratchet: a file fails
 *   when its count rises above it; a budget of 0 means the file is policy-clean.
 *   That the OpCodes and framework tiers are themselves fully typed is the
 *   JSDOC category of tests/TranspilerSuite.js.
 *
 * Over the algorithms the files registered:
 * - ROUNDTRIP: every reversible algorithm decodes its own output over an
 *   adversarial corpus, and compressors compress (RoundTrip.js)
 * - CHUNKED: Feed(whole) equals Feed(part1); Feed(part2); ... for any split
 *   (ChunkedFeed.js)
 *
 * Over the whole collection (when it is all tested, or named by --only):
 * - BROWSER: every script tag of index.html evaluates, in page order, in a
 *   context with no require, module or global, as the browser loads it
 *   (BrowserLoad.js)
 * - LIBRARY: unit tests of the shared code the algorithms are built from:
 *   OpCodes helpers (OpCodesHelperTests.js), ByteBuffer (ByteBufferTests.js),
 *   of the category selection and summary of the runners (RunnerTests.js),
 *   of algorithm paths no vector reaches (AlgorithmRegressionTests.js), and
 *   of how the test engine applies a vector's fields (TestEngineTests.js)
 *
 * Options:
 *   <file.js>                 test one file
 *   --category=<dir>          test one category directory (e.g. --category=hash)
 *   --algorithm=<name>        test the file(s) with that base name (e.g. --algorithm=murmurhash3)
 *   --only=<a,b>              run only these categories (e.g. --only=roundtrip,types)
 *   --skip=<a,b>              run everything but these
 *   --verbose, -v             details, including every untyped value site
 *   --update-type-budgets     lower each tested file's TYPES budget to its current count
 *   --allow-budget-increase   with --update-type-budgets: also raise budgets (and add new files)
 *   --large                   ROUNDTRIP: also push 1 MB through each algorithm
 *   --large-size=<n[K|M]>     ROUNDTRIP: the same with another size (see LARGE-INPUTS.md)
 *   --budget=<ms>             ROUNDTRIP: time per algorithm for the small corpus
 *
 * Exits non-zero when any check of a selected category fails.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const TestEngine = require('./TestEngine');
const TypeCoverage = require('./TypeCoverage');
const RoundTrip = require('./RoundTrip');
const ChunkedFeed = require('./ChunkedFeed');
const BrowserLoad = require('./BrowserLoad');
const OpCodesHelperTests = require('./OpCodesHelperTests');
const ByteBufferTests = require('./ByteBufferTests');
const RunnerTests = require('./RunnerTests');
const AlgorithmRegressionTests = require('./AlgorithmRegressionTests');
const TestEngineTests = require('./TestEngineTests');
const Runner = require('./CategoryRunner');

const CIPHER_DIR = path.join(__dirname, '..');
const ALGORITHMS_DIR = path.join(CIPHER_DIR, 'algorithms');
const TYPE_BUDGETS_FILE = path.join(__dirname, 'type-budgets.json');
const FILE_TIMEOUT_MS = 5000;

// Categories reported per file. The first six come from TestEngine.TestFile.
const FILE_CATEGORIES = [
  { key: 'compilation', label: 'COMPILATION' },
  { key: 'interface', label: 'INTERFACE' },
  { key: 'metadata', label: 'METADATA' },
  { key: 'issues', label: 'ISSUES' },
  { key: 'functionality', label: 'FUNCTIONALITY' },
  { key: 'optimization', label: 'OPTIMIZATION' },
  { key: 'types', label: 'TYPES' }
];
const ENGINE_KEYS = FILE_CATEGORIES.slice(0, 6).map(c => c.key);
// Names on the per-file progress line
const FILE_LABELS = { compilation: 'Compilation', interface: 'Interface', metadata: 'Metadata', functionality: 'Function', optimization: 'Optimization' };

// LIBRARY: the unit tests of the shared code every algorithm is built from,
// and of the category selection and summary these runners are built from.
const Library = {
  async run(context) {
    const parts = [['OpCodes helpers', OpCodesHelperTests.run(context)], ['ByteBuffer', ByteBufferTests.run(context)],
      ['test runner', RunnerTests.run(context)], ['algorithm regressions', AlgorithmRegressionTests.run(context)],
      ['test engine', await TestEngineTests.run(context)]];
    return {
      passed: parts.reduce((sum, [, r]) => sum + r.passed, 0),
      failed: parts.reduce((sum, [, r]) => sum + r.failed, 0),
      detail: parts.map(([name, r]) => `${name} ${r.passed}/${r.passed + r.failed}`).join(', ')
    };
  }
};

// Categories run once per run. 'collection' checks the site or its shared
// libraries: it runs first, while the heap is still small, and only when the
// whole collection is tested or --only names it. 'algorithms' sweeps what the
// tested files registered, after every file has been loaded. Each module exports
// run(context) and returns { passed, failed, detail }.
const SWEEPS = [
  { key: 'roundtrip', label: 'ROUNDTRIP', title: 'Round trips over an adversarial corpus', module: RoundTrip, scope: 'algorithms' },
  { key: 'chunked', label: 'CHUNKED', title: 'Feeding in chunks matches feeding whole', module: ChunkedFeed, scope: 'algorithms' },
  { key: 'browser', label: 'BROWSER', title: 'Every script tag of index.html loads as the browser loads it', module: BrowserLoad, scope: 'collection' },
  { key: 'library', label: 'LIBRARY', title: 'Unit tests of OpCodes helpers, ByteBuffer, the test runner, algorithm regressions and the test engine', module: Library, scope: 'collection' }
];

const CATEGORY_KEYS = [...FILE_CATEGORIES.map(c => c.key), ...SWEEPS.map(s => s.key)];

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

/**
 * Read the command line.
 * @param {string[]} args - process arguments
 * @returns {Object} options
 */
function parseOptions(args) {
  Runner.rejectUnknownOptions(args,
    ['--verbose', '-v', '--update-type-budgets', '--allow-budget-increase', '--large'],
    ['category', 'algorithm', 'only', 'skip', 'large-size', 'budget']);
  const { selected, explicit } = Runner.selectCategories(args, CATEGORY_KEYS);
  const largeSize = Runner.optionValue(args, 'large-size');
  const budget = Runner.optionValue(args, 'budget');
  if (budget !== null && !(Number(budget) > 0)) throw new Error(`--budget expects milliseconds; got "${budget}"`);
  return {
    selected, explicit,
    verbose: args.includes('--verbose') || args.includes('-v'),
    categoryFilter: Runner.optionValue(args, 'category'),
    algorithmFilter: Runner.optionValue(args, 'algorithm'),
    singleFile: args.find(arg => !arg.startsWith('-')) || null,
    updateTypeBudgets: args.includes('--update-type-budgets'),
    allowBudgetIncrease: args.includes('--allow-budget-increase'),
    sweep: {
      large: args.includes('--large') || largeSize !== null,
      largeSize: largeSize !== null ? RoundTrip.parseSize(largeSize) : RoundTrip.DEFAULT_LARGE_SIZE,
      budget: budget !== null ? Number(budget) : RoundTrip.DEFAULT_BUDGET_MS
    }
  };
}

class TestSuite {
  constructor(options) {
    this.options = options;
    this.selected = options.selected;
    this.verbose = options.verbose;
    this.totalAlgorithms = 0;
    this.algorithmsPerCategory = {};
    this.testedFiles = new Set();                           // lower-cased absolute paths
    // Algorithm name -> what failed. Keyed by name so an algorithm registered
    // under several names is counted once.
    this.invertibilityFailures = new Map();
    this.results = {};
    for (const { key } of FILE_CATEGORIES) this.results[key] = { passed: 0, failed: 0, errors: [] };
    this.sweepRows = [];
    this.typeBudgets = loadTypeBudgets();
    this.typeCounts = {};                                   // path -> count (null: unparsed)
    this.typeTotals = { sites: 0, opcodes: 0, framework: 0, local: 0, unparsed: 0 };
    this.typeTimeMs = 0;
    this.sources = new Map();                               // absolute path -> text, read once
  }

  /**
   * The text of a source file, read from disk once per run.
   * @param {string} file - path
   * @returns {string} text
   */
  readSource(file) {
    const key = path.resolve(file);
    if (!this.sources.has(key)) this.sources.set(key, fs.readFileSync(key, 'utf8'));
    return this.sources.get(key);
  }

  /** @returns {boolean} true when a file, category or algorithm filter narrows the run */
  get narrowed() {
    return Boolean(this.options.singleFile || this.options.categoryFilter || this.options.algorithmFilter);
  }

  async run() {
    const runs = sweep => this.selected.has(sweep.key)
      && (sweep.scope === 'algorithms' || !this.narrowed || this.options.explicit.has(sweep.key));
    const collectionSweeps = SWEEPS.filter(s => s.scope === 'collection' && runs(s));
    const algorithmSweeps = SWEEPS.filter(s => s.scope === 'algorithms' && runs(s));
    const leftOut = SWEEPS.filter(s => this.selected.has(s.key) && !runs(s)).map(s => s.key);

    console.log('SynthelicZ Cipher Tools - Algorithm Test Suite');
    console.log('==============================================');
    console.log(`Categories: ${CATEGORY_KEYS.filter(k => this.selected.has(k) && !leftOut.includes(k)).join(', ')}`);
    if (leftOut.length)
      console.log(`Left out of a narrowed run: ${leftOut.join(', ')} (name them in --only to run them)`);
    console.log('');

    await TestEngine.LoadDependencies(true, this.verbose);

    for (const sweep of collectionSweeps) await this.runSweep(sweep);

    if (FILE_CATEGORIES.some(c => this.selected.has(c.key)) || algorithmSweeps.length) {
      if (this.options.singleFile) await this.testSingleFile(this.options.singleFile);
      else await this.discoverAlgorithms();
    }

    for (const sweep of algorithmSweeps) await this.runSweep(sweep);

    const failed = this.generateReport();
    if (this.options.updateTypeBudgets && this.selected.has('types'))
      this.writeTypeBudgets();
    console.log(`\nWall time: ${process.uptime().toFixed(1)}s`);
    return failed;
  }

  /**
   * Run one once-per-run category and keep its summary row.
   * @param {Object} sweep - entry of SWEEPS
   */
  async runSweep(sweep) {
    console.log(`\n=== ${sweep.label}: ${sweep.title} ===`);
    const result = await sweep.module.run({
      algorithms: this.algorithmsInScope(),
      verbose: this.verbose,
      options: this.options.sweep,
      readSource: file => this.readSource(file)
    });
    this.sweepRows.push({ key: sweep.key, label: sweep.label, ...result });
  }

  /**
   * The registered algorithms the run covers: all of them, or those the
   * selected files registered when a filter narrows the run.
   * @returns {Object[]} algorithms
   */
  algorithmsInScope() {
    const all = (global.AlgorithmFramework.Algorithms || []).filter(a => a.category);
    if (!this.narrowed) return all;
    const sources = global.__algorithmSources;
    return all.filter(a => sources && this.testedFiles.has(sources.get(a)));
  }

  // Test a single file specified by filename
  async testSingleFile(filename) {
    console.log(`Searching for file: ${filename}\n`);
    const categories = fs.readdirSync(ALGORITHMS_DIR).filter(item =>
      fs.statSync(path.join(ALGORITHMS_DIR, item)).isDirectory()
    );

    for (const category of categories) {
      const files = fs.readdirSync(path.join(ALGORITHMS_DIR, category)).filter(file => file.endsWith('.js'));
      if (files.includes(filename)) {
        console.log(`Found ${filename} in category: ${category}`);
        this.algorithmsPerCategory[category] = 0;
        await this.testFile(category, filename);
        return;
      }
    }
    throw new Error(`File '${filename}' not found in any algorithm category.`);
  }

  // Discover all algorithm files
  async discoverAlgorithms() {
    const filter = this.options.categoryFilter;
    const categories = fs.readdirSync(ALGORITHMS_DIR).filter(item =>
      fs.statSync(path.join(ALGORITHMS_DIR, item)).isDirectory() && (!filter || item === filter)
    );
    if (categories.length === 0)
      throw new Error(`No algorithm category '${filter}'`);

    console.log(`Found ${categories.length} algorithm categories:`);
    categories.forEach(cat => console.log(`  - ${cat}`));
    console.log('');

    for (const category of categories)
      await this.testCategory(category);
  }

  // Test all algorithms in a category
  async testCategory(category) {
    const filter = this.options.algorithmFilter;
    const files = fs.readdirSync(path.join(ALGORITHMS_DIR, category)).filter(file =>
      file.endsWith('.js') && !file.endsWith('.data.js') &&
      (!filter || path.basename(file, '.js') === filter)
    );
    if (files.length === 0) return;

    console.log(`Testing ${category} algorithms (${files.length} files):`);
    this.algorithmsPerCategory[category] = 0;
    for (const file of files)
      await this.testFile(category, file);
    console.log('');
  }

  /**
   * Run the per-file categories on one algorithm file.
   * @param {string} category - category directory
   * @param {string} filename - file in it
   */
  async testFile(category, filename) {
    const filePath = path.join(ALGORITHMS_DIR, category, filename);
    const algorithmName = path.basename(filename, '.js');
    const source = this.readSource(filePath);

    this.totalAlgorithms++;
    this.algorithmsPerCategory[category]++;
    this.testedFiles.add(path.resolve(filePath).toLowerCase());

    const startTime = process.hrtime.bigint();
    let result = {};
    let timedOut = false;

    if (ENGINE_KEYS.some(k => this.selected.has(k))) {
      console.log(`  Testing ${algorithmName}...`);
      try {
        // Race between test execution and timeout
        result = await Promise.race([
          TestEngine.TestFile(filePath, { verbose: this.verbose, silent: false, source }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), FILE_TIMEOUT_MS))
        ]);
      } catch (error) {
        if (error.message !== 'TIMEOUT') throw error;
        timedOut = true;
        result = {
          compilation: { passed: true, error: null },
          interface: { passed: true, error: null },
          metadata: { passed: true, error: null },
          issues: { passed: true, errors: [] },
          functionality: { passed: false, error: `Test execution exceeded ${FILE_TIMEOUT_MS}ms timeout` },
          optimization: { passed: false, error: 'Not tested due to timeout' }
        };
      }
    } else {
      // Only the sweeps need this file: register its algorithms. A file that
      // fails to load is what INTERFACE reports.
      try { require(filePath); } catch (error) { /* reported by INTERFACE */ }
    }

    const elapsedMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

    if (this.selected.has('types')) result.types = this.testTypes(filePath, source);

    const testResults = result.functionality && this.selected.has('functionality') ? result.functionality.testResults : null;
    this.recordInvertibility(algorithmName, testResults, result);
    this.updateResults(result);

    const shown = FILE_CATEGORIES.filter(c => this.selected.has(c.key) && result[c.key]);
    if (shown.length === 0) return;                 // nothing per-file was selected

    const parts = shown.map(({ key }) => {
      const r = result[key];
      if (key === 'issues') return `Issues:${r.passed ? '0' : r.errors.length}`;
      if (key === 'types') return `Types:${r.summary}`;
      return `${FILE_LABELS[key]}:${r.passed ? '✓' : '✗'}`;
    });
    const status = shown.every(c => result[c.key].passed) ? '✓' : '✗';
    const registered = result.interface && result.interface.algorithms && result.interface.algorithms.length
      ? ` [Registered: ${result.interface.algorithms.join(', ')}]` : '';
    // Only algorithms with an inverse are round-tripped, so only they show a counter.
    const roundTrips = (testResults || [])
      .filter(r => r.roundTripsAttempted > 0)
      .map(r => `${r.roundTripsPassed}/${r.roundTripsAttempted}`)
      .join(',');
    const roundTripInfo = roundTrips ? ` [Round-trips: ${roundTrips}]` : '';
    const timingInfo = timedOut ? ` (TIMEOUT after ${elapsedMs.toFixed(2)}ms)` : ` (${elapsedMs.toFixed(2)}ms)`;
    console.log(`    ${status} ${algorithmName} - ${parts.join(' ')}${registered}${roundTripInfo}${timingInfo}`);

    if (this.verbose && testResults)
      this.showVerboseTestResults(algorithmName, testResults);
    if (this.verbose && result.types && result.types.sites.length > 0) {
      console.log(`    Untyped value sites in ${result.types.file}:`);
      for (const site of result.types.sites)
        console.log(`      ${result.types.file}:${site.line} [${site.tier}] ${site.expression} - ${site.reason}`);
    }
  }

  /**
   * A failed inverse used to be printed and then thrown away. The status was
   * read by the verbose display and nowhere else, so an algorithm that could
   * not decrypt what it encrypted still counted as a pass: 36 of them reported
   * a failed invertibility requirement inside a run that printed 100% and
   * exited 0. It now fails FUNCTIONALITY for its file. Algorithms with no
   * meaningful inverse are named on the shared exemption list and never reach
   * this branch.
   * @param {string} fileName - base name of the file
   * @param {Object[]|null} testResults - per-algorithm vector results
   * @param {Object} result - per-file result (functionality is updated)
   */
  recordInvertibility(fileName, testResults, result) {
    let failed = false;
    for (const r of testResults || []) {
      if (r.status !== 'failed-roundtrips' && r.status !== 'failed-encoding-stability') continue;
      const kind = r.status === 'failed-roundtrips' ? 'round-trip' : 'encoding stability';
      const detail = `${kind} ${r.roundTripsPassed}/${r.roundTripsAttempted}`;
      this.invertibilityFailures.set(r.algorithm, detail);
      failed = true;
      if (result.functionality.passed) {
        result.functionality.passed = false;
        result.functionality.error = `${fileName}: ${r.algorithm} cannot recover its own output (${detail})`;
      }
    }
    return failed;
  }

  /**
   * TYPES: count the file's untyped value sites and hold it to its budget.
   * @param {string} filePath - Algorithm file
   * @param {string} source - Its text
   * @returns {Object} { passed, error, summary, sites, file }
   */
  testTypes(filePath, source) {
    const file = path.relative(CIPHER_DIR, filePath).split(path.sep).join('/');
    const start = process.hrtime.bigint();
    const coverage = TypeCoverage.analyzeFile(filePath, source);
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
      } else if (this.options.allowBudgetIncrease) {
        budgets[file] = next;
        ++raised;
      }
    }
    const sorted = {};
    for (const file of Object.keys(budgets).sort()) sorted[file] = budgets[file];
    fs.writeFileSync(TYPE_BUDGETS_FILE, JSON.stringify(sorted, null, 1).replace(/^ /gm, '  ') + '\n');
    console.log(`\nType budgets: ${lowered} lowered, ${raised} raised or added -> ${path.relative(CIPHER_DIR, TYPE_BUDGETS_FILE)}`);
    if (!this.options.allowBudgetIncrease)
      console.log('(budgets only go down; pass --allow-budget-increase as well to raise or add one)');
  }

  // Show detailed test results in verbose mode
  showVerboseTestResults(fileName, testResults) {
    console.log(`\n=== DETAILED TEST RESULTS for ${fileName} ===`);

    for (const result of testResults) {
      console.log(`\nAlgorithm: ${result.algorithm}`);
      console.log(`Status: ${result.status.toUpperCase()}`);
      const roundTrips = result.roundTripsAttempted > 0;

      if (result.status === 'passed') {
        console.log(`  Vectors Passed: ${result.vectorsPassed}/${result.vectorsTotal}`);
        if (roundTrips) console.log(`  Round-trips Passed: ${result.roundTripsPassed}/${result.roundTripsAttempted}`);
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
      } else if (result.status === 'no-tests' || result.status === 'error') {
        console.log(`  Issue: ${result.message}`);
      }

      if (result.vectorDetails && result.vectorDetails.length > 0) {
        console.log(`\n  Test Vector Details:`);
        for (const vector of result.vectorDetails) {
          const statusSymbol = vector.passed ? '✓' : '✗';
          const roundTripSymbol = vector.roundTripSuccess === true ? ' ↺✓' : vector.roundTripSuccess === false ? ' ↺✗' : '';
          console.log(`    ${statusSymbol} Vector ${vector.index}: ${vector.text}${roundTripSymbol}`);
          if (!vector.passed && vector.error)
            console.log(`      Error: ${vector.error}`);
        }
      }
    }
    console.log('===============================================\n');
  }

  // Update accumulated per-file results (only the categories the run selected)
  updateResults(result) {
    for (const { key } of FILE_CATEGORIES) {
      if (!this.selected.has(key) || !result[key]) continue;
      const bucket = this.results[key];
      if (result[key].passed) {
        bucket.passed++;
        continue;
      }
      bucket.failed++;
      if (result[key].error) bucket.errors.push(result[key].error);
      if (Array.isArray(result[key].errors))
        bucket.errors.push(...result[key].errors.map(e => typeof e === 'string' ? e : e.content || JSON.stringify(e)));
    }
  }

  /**
   * Print the errors, one summary line per selected category and the verdict.
   * @returns {number} failed checks
   */
  generateReport() {
    const fileKeys = FILE_CATEGORIES.filter(c => this.selected.has(c.key));

    for (const { key } of fileKeys) {
      if (this.results[key].errors.length === 0) continue;
      console.log(`\n=== ${key.toUpperCase()} ERRORS ===`);
      this.results[key].errors.forEach(error => console.log(`  ✗ ${error}`));
    }

    if (this.invertibilityFailures.size > 0) {
      console.log('');
      console.log(`=== INVERTIBILITY (${this.invertibilityFailures.size} algorithm(s) cannot recover their own output) ===`);
      for (const [name, detail] of this.invertibilityFailures)
        console.log(`  ✗ ${name} - ${detail}`);
      console.log('An algorithm with no meaningful inverse belongs on the list in');
      console.log('tests/round-trip-exemptions.js with its reason, not here.');
    }

    if (this.totalAlgorithms > 0) {
      console.log(`\nAlgorithm files tested: ${this.totalAlgorithms}`);
      Object.entries(this.algorithmsPerCategory).forEach(([category, count]) => console.log(`  ${category}: ${count}`));
    }

    const rows = fileKeys.map(({ key, label }) => ({ label, passed: this.results[key].passed, failed: this.results[key].failed }));
    const types = rows.find(r => r.label === 'TYPES');
    if (types) {
      const t = this.typeTotals;
      types.detail = `${t.sites} untyped value sites: ${t.opcodes} OpCodes JSDoc, ${t.framework} framework, ${t.local} local source` +
        `${t.unparsed ? `; ${t.unparsed} file(s) not parsed` : ''}; +${(this.typeTimeMs / 1000).toFixed(1)}s`;
    }
    const order = SWEEPS.map(s => s.key);
    rows.push(...this.sweepRows.slice().sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)));

    return Runner.printSummary('TEST RESULTS SUMMARY', rows);
  }
}

// CLI execution
if (require.main === module) {
  let options;
  try {
    options = parseOptions(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  new TestSuite(options).run().then(failed => {
    // Without this the suite exited 0 no matter how many tests failed, so it
    // could report problems but never stop anything acting on them.
    if (failed > 0) process.exitCode = 1;
  }).catch(error => {
    console.error('Fatal error during test execution:', error.message);
    process.exit(1);
  });
}

module.exports = TestSuite;
