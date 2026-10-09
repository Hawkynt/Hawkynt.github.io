#!/usr/bin/env node
/*
 * Transpiler test runner: does the transpiler work?
 * (c)2006-2025 Hawkynt
 *
 * Categories, in run order:
 * - CODEGEN: every language plugin and dialect generates code for the shared
 *   AST test cases (CodeGenTests.js)
 * - INFERENCE: type inference of the shared transpiler AST (TypeInferenceTests.js)
 * - POLICY: the type resolution order - OpCodes JSDoc, framework interfaces,
 *   local JSDoc - and the untyped-site count built on it (TypePolicyTests.js)
 * - SOUNDNESS: the type-soundness checker that runs algorithms against their
 *   IL types: its value predicates, instrumentation and sampling
 *   (TypeSoundnessTests.js)
 * - JSDOC: every OpCodes and AlgorithmFramework member is fully typed by
 *   JSDoc, the two tiers every algorithm's types come from (JSDocTierAudit.js)
 * - CSHARP: regressions of systematic C# transpilation faults; compiles and
 *   runs the C# runtime stubs when the .NET SDK is installed
 *   (CSharpTranspileRegressions.js)
 * - HARNESS: the cross-language validation itself: vector plans, reading a
 *   harness run back, judging languages, error classes, and each vector
 *   harness end to end against hand-written stand-ins for transpiled code
 *   (TranspilerValidationTests.js); the C# cases need the .NET SDK
 * - TSPHP: regressions of systematic TypeScript and PHP transpilation faults;
 *   compiles and runs each case when tsc/php is installed
 *   (TsPhpTranspileRegressions.js)
 * - VALIDATION: transpiles every algorithm to every installed language,
 *   compiles it and runs its vectors where the language is interpreted
 *   (TranspilerValidation.js). It takes over ten minutes unscoped and depends
 *   on which toolchains are installed, so it runs only when named:
 *   --only=validation, or --only=...,validation
 *
 * Options:
 *   --only=<a,b>          run only these categories (e.g. --only=codegen,csharp)
 *   --skip=<a,b>          run the default categories but these
 *   --verbose, -v         details
 *   --language=<name>     CODEGEN, VALIDATION: one language (e.g. python, csharp)
 *   --quick               CODEGEN: smoke cases only; VALIDATION: 3 algorithms per category
 *   --group=<text>        INFERENCE: only the test groups whose name contains it (e.g. literal)
 *   --no-dotnet           CSHARP, HARNESS: do not compile and run C#
 *   --category=<dir>      VALIDATION: one algorithm category directory
 *   --algorithm=<text>    VALIDATION: algorithm files whose name contains it
 *   --compile-only        VALIDATION: compile, do not execute
 *   --jobs=<n>            VALIDATION: algorithm files validated at a time (default: half the cores)
 *   --timeout=<seconds>   VALIDATION: limit of one compile or run (default 120)
 *   --report[=<path>]     VALIDATION: write the per-algorithm results as JSON (default
 *                         tests/transpiler-validation-output/validation-report.json)
 *
 * Exits non-zero when any check of a selected category fails.
 */

'use strict';

const Runner = require('./CategoryRunner');

// Each module is loaded when its category runs: the code generators and the
// transpiler are large, and a narrowed run should not pay for the others.
const CATEGORIES = [
  { key: 'codegen', label: 'CODEGEN', title: 'Code generation for every language and dialect', module: './CodeGenTests' },
  { key: 'inference', label: 'INFERENCE', title: 'Type inference of the transpiler AST', module: './TypeInferenceTests' },
  { key: 'policy', label: 'POLICY', title: 'Type resolution order and untyped-site count', module: './TypePolicyTests' },
  { key: 'soundness', label: 'SOUNDNESS', title: 'The type-soundness checker', module: './TypeSoundnessTests' },
  { key: 'jsdoc', label: 'JSDOC', title: 'OpCodes and AlgorithmFramework JSDoc completeness', module: './JSDocTierAudit' },
  { key: 'csharp', label: 'CSHARP', title: 'C# transpilation regressions', module: './CSharpTranspileRegressions' },
  { key: 'harness', label: 'HARNESS', title: 'The cross-language validation harness', module: './TranspilerValidationTests' },
  { key: 'python', label: 'PYTHON', title: 'Python transpilation regressions', module: './PythonTranspileRegressions' },
  { key: 'tsphp', label: 'TSPHP', title: 'TypeScript and PHP transpilation regressions', module: './TsPhpTranspileRegressions' },
  { key: 'perl', label: 'PERL', title: 'Perl transpilation regressions', module: './PerlTranspileRegressions' },
  { key: 'validation', label: 'VALIDATION', title: 'Cross-language transpile, compile and run', module: './TranspilerValidation' }
];
const CATEGORY_KEYS = CATEGORIES.map(c => c.key);
const DEFAULT_KEYS = CATEGORY_KEYS.filter(k => k !== 'validation');

/**
 * A positive whole number option, or null when it was not given.
 * @param {string|null} text - option value
 * @param {string} name - option name, for the error message
 * @returns {number|null}
 */
function positiveInteger(text, name) {
  if (text === null) return null;
  if (!/^[1-9]\d*$/.test(text)) throw new Error(`--${name}= needs a positive whole number, got '${text}'`);
  return Number(text);
}

/**
 * Read the command line.
 * @param {string[]} args - process arguments
 * @returns {Object} options
 */
function parseOptions(args) {
  Runner.rejectUnknownOptions(args,
    ['--verbose', '-v', '--quick', '--no-dotnet', '--compile-only', '--report'],
    ['only', 'skip', 'language', 'group', 'category', 'algorithm', 'jobs', 'timeout', 'report']);
  const positional = args.find(arg => !arg.startsWith('-'));
  if (positional) throw new Error(`unexpected argument ${positional}`);
  const { selected } = Runner.selectCategories(args, CATEGORY_KEYS, DEFAULT_KEYS);
  return {
    selected,
    verbose: args.includes('--verbose') || args.includes('-v'),
    quick: args.includes('--quick'),
    dotnet: !args.includes('--no-dotnet'),
    compileOnly: args.includes('--compile-only'),
    report: args.includes('--report') ? true : Runner.optionValue(args, 'report'),
    jobs: positiveInteger(Runner.optionValue(args, 'jobs'), 'jobs'),
    timeout: positiveInteger(Runner.optionValue(args, 'timeout'), 'timeout'),
    language: Runner.optionValue(args, 'language'),
    group: Runner.optionValue(args, 'group'),
    category: Runner.optionValue(args, 'category'),
    algorithm: Runner.optionValue(args, 'algorithm')
  };
}

/**
 * Run the selected categories and print the summary.
 * @param {Object} options - from parseOptions
 * @returns {Promise<number>} failed checks
 */
async function runSuite(options) {
  console.log('SynthelicZ Cipher Tools - Transpiler Test Suite');
  console.log('===============================================');
  console.log(`Categories: ${CATEGORY_KEYS.filter(k => options.selected.has(k)).join(', ')}`);

  const rows = [];
  for (const category of CATEGORIES) {
    if (!options.selected.has(category.key)) continue;
    console.log(`\n=== ${category.label}: ${category.title} ===`);
    const started = Date.now();
    let result;
    try {
      result = await require(category.module).run(options);
    } catch (error) {
      // A category that crashes has failed; the others still run.
      console.log(`  ✗ ${category.label} crashed: ${error.stack || error.message}`);
      result = { passed: 0, failed: 1, detail: `crashed: ${error.message}` };
    }
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    rows.push({ label: category.label, passed: result.passed, failed: result.failed,
      detail: [result.detail, `${seconds}s`].filter(Boolean).join('; ') });
  }

  const failed = Runner.printSummary('TRANSPILER TEST SUMMARY', rows);
  console.log(`\nWall time: ${process.uptime().toFixed(1)}s`);
  return failed;
}

if (require.main === module) {
  let options;
  try {
    options = parseOptions(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  runSuite(options).then(failed => {
    if (failed > 0) process.exitCode = 1;
  }).catch(error => {
    console.error('Fatal error during test execution:', error.message);
    process.exit(1);
  });
}

module.exports = { parseOptions, runSuite };
