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
 * - JSDOC: every OpCodes and AlgorithmFramework member is fully typed by
 *   JSDoc, the two tiers every algorithm's types come from (JSDocTierAudit.js)
 *
 * Options:
 *   --only=<a,b>          run only these categories (e.g. --only=codegen,csharp)
 *   --skip=<a,b>          run everything but these
 *   --verbose, -v         details
 *   --language=<name>     CODEGEN: one language (e.g. python, csharp)
 *   --quick               CODEGEN: smoke cases only
 *   --group=<text>        INFERENCE: only the test groups whose name contains it (e.g. literal)
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
  { key: 'jsdoc', label: 'JSDOC', title: 'OpCodes and AlgorithmFramework JSDoc completeness', module: './JSDocTierAudit' }
];
const CATEGORY_KEYS = CATEGORIES.map(c => c.key);

/**
 * Read the command line.
 * @param {string[]} args - process arguments
 * @returns {Object} options
 */
function parseOptions(args) {
  Runner.rejectUnknownOptions(args,
    ['--verbose', '-v', '--quick'],
    ['only', 'skip', 'language', 'group']);
  const positional = args.find(arg => !arg.startsWith('-'));
  if (positional) throw new Error(`unexpected argument ${positional}`);
  const { selected } = Runner.selectCategories(args, CATEGORY_KEYS);
  return {
    selected,
    verbose: args.includes('--verbose') || args.includes('-v'),
    quick: args.includes('--quick'),
    language: Runner.optionValue(args, 'language'),
    group: Runner.optionValue(args, 'group')
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
