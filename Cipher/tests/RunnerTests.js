/**
 * RunnerTests.js - unit tests of the code the two test runners share:
 * category selection and the summary (CategoryRunner.js) and the case list
 * (UnitCases.js). Every case is Given / When / Then; classes, boundaries and
 * error cases.
 *
 * Part of the LIBRARY category: node tests/TestSuite.js --only=library [--verbose]
 */

'use strict';

const Runner = require('./CategoryRunner.js');
const { createCases } = require('./UnitCases.js');

const cases = createCases();
const test = cases.case;

function equal(actual, expected, what = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}expected ${e}, got ${a}`);
}
function throws(fn, pattern) {
  try { fn(); } catch (e) {
    if (pattern && !pattern.test(e.message)) throw new Error(`expected an error matching ${pattern}, got: ${e.message}`);
    return;
  }
  throw new Error('expected an exception');
}
/** Run fn with console.log captured; returns { result, output }. */
function captured(fn) {
  const lines = [];
  const log = console.log;
  console.log = (...parts) => lines.push(parts.join(' '));
  try { return { result: fn(), output: lines.join('\n') }; } finally { console.log = log; }
}

const KNOWN = ['alpha', 'beta', 'gamma', 'slow'];
const DEFAULTS = ['alpha', 'beta', 'gamma'];
const selected = args => [...Runner.selectCategories(args, KNOWN, DEFAULTS).selected];

// ------------------------------------------------------------ optionValue
test('optionValue: given no such option, when read, then null is returned', () => {
  equal(Runner.optionValue(['--other=1', 'file.js'], 'only'), null);
});
test('optionValue: given --name=value, when read, then the value is returned', () => {
  equal(Runner.optionValue(['--only=alpha'], 'only'), 'alpha');
});
test('optionValue: given an empty value (boundary), when read, then the empty string is returned', () => {
  equal(Runner.optionValue(['--only='], 'only'), '');
});
test('optionValue: given a value containing "=", when read, then everything after the first "=" is kept', () => {
  equal(Runner.optionValue(['--filter=a=b'], 'filter'), 'a=b');
});
test('optionValue: given an option whose name only starts with the asked name, when read, then it is not taken', () => {
  equal(Runner.optionValue(['--onlyx=alpha'], 'only'), null);
});

// ------------------------------------------------------------ parseList
test('parseList: given no option (null), when parsed, then null is returned', () => {
  equal(Runner.parseList(null, KNOWN, 'only'), null);
});
test('parseList: given mixed case and spaces, when parsed, then the keys are trimmed and lower-cased', () => {
  equal(Runner.parseList(' Alpha , GAMMA ', KNOWN, 'only'), ['alpha', 'gamma']);
});
test('parseList: given an empty list (boundary), when parsed, then an error names the known categories', () => {
  throws(() => Runner.parseList('', KNOWN, 'only'), /at least one category.*alpha/);
  throws(() => Runner.parseList(' , ', KNOWN, 'skip'), /--skip=/);
});
test('parseList: given an unknown category, when parsed, then an error names it', () => {
  throws(() => Runner.parseList('alpha,delta', KNOWN, 'only'), /unknown category delta/);
});
test('parseList: given several unknown categories, when parsed, then the error names all of them', () => {
  throws(() => Runner.parseList('delta,epsilon', KNOWN, 'only'), /unknown categories delta, epsilon/);
});

// ------------------------------------------------------------ selectCategories
test('selectCategories: given no --only or --skip, when selected, then exactly the defaults run', () => {
  equal(selected([]), DEFAULTS);
});
test('selectCategories: given --only, when selected, then only those run, including a non-default one', () => {
  equal(selected(['--only=slow,alpha']), ['slow', 'alpha']);
});
test('selectCategories: given --skip, when selected, then the defaults minus those run', () => {
  equal(selected(['--skip=beta']), ['alpha', 'gamma']);
});
test('selectCategories: given --only and --skip together, when selected, then --skip applies to the --only list', () => {
  equal(selected(['--only=alpha,beta', '--skip=beta']), ['alpha']);
});
test('selectCategories: given --skip of every default (boundary), when selected, then an error says nothing is left', () => {
  throws(() => selected(['--skip=alpha,beta,gamma']), /leave no category/);
});
test('selectCategories: given --only, when selected, then the named categories are reported as explicit', () => {
  const { explicit } = Runner.selectCategories(['--only=beta'], KNOWN, DEFAULTS);
  equal([...explicit], ['beta']);
});
test('selectCategories: given no --only, when selected, then nothing is explicit', () => {
  equal([...Runner.selectCategories(['--skip=beta'], KNOWN, DEFAULTS).explicit], []);
});

// ------------------------------------------------------------ rejectUnknownOptions
const FLAGS = ['--verbose', '-v'];
const VALUED = ['only', 'category'];
test('rejectUnknownOptions: given known flags, valued options and a positional file, when checked, then nothing is thrown', () => {
  Runner.rejectUnknownOptions(['--verbose', '-v', '--only=alpha', '--category=hash', 'aes.js'], FLAGS, VALUED);
});
test('rejectUnknownOptions: given an unknown flag, when checked, then an error names it', () => {
  throws(() => Runner.rejectUnknownOptions(['--interop'], FLAGS, VALUED), /unknown option --interop/);
});
test('rejectUnknownOptions: given a valued option without "=", when checked, then it is rejected', () => {
  throws(() => Runner.rejectUnknownOptions(['--category', 'hash'], FLAGS, VALUED), /unknown option --category/);
});
test('rejectUnknownOptions: given a flag written with a value, when checked, then it is rejected', () => {
  throws(() => Runner.rejectUnknownOptions(['--verbose=1'], FLAGS, VALUED), /unknown option --verbose=1/);
});

// ------------------------------------------------------------ printSummary
test('printSummary: given only passing rows, when printed, then 0 failures, 100% and PASS', () => {
  const { result, output } = captured(() => Runner.printSummary('T', [
    { label: 'A', passed: 3, failed: 0 }, { label: 'B', passed: 2, failed: 0, detail: 'x' }]));
  equal(result, 0);
  if (!/5\/5 checks passed \(100%\)/.test(output) || !/VERDICT: PASS/.test(output)) throw new Error(output);
  if (!/ok {3}B: +2\/2 passed \(x\)/.test(output)) throw new Error(output);
});
test('printSummary: given 999 of 1000 passing (boundary), when printed, then it shows 99%, never 100%', () => {
  const { result, output } = captured(() => Runner.printSummary('T', [{ label: 'A', passed: 999, failed: 1 }]));
  equal(result, 1);
  if (!/999\/1000 checks passed \(99%\)/.test(output)) throw new Error(output);
});
test('printSummary: given failing rows, when printed, then the verdict names the failing categories and the count', () => {
  const { result, output } = captured(() => Runner.printSummary('T', [
    { label: 'A', passed: 1, failed: 2 }, { label: 'B', passed: 1, failed: 0 }, { label: 'C', passed: 0, failed: 1 }]));
  equal(result, 3);
  if (!/VERDICT: FAIL - 3 check\(s\) failed in A, C/.test(output)) throw new Error(output);
  if (!/FAIL A:/.test(output)) throw new Error(output);
});
test('printSummary: given a row with no checks (boundary), when printed, then it passes as 0/0', () => {
  const { result, output } = captured(() => Runner.printSummary('T', [{ label: 'EMPTY', passed: 0, failed: 0 }]));
  equal(result, 0);
  if (!/0\/0 passed/.test(output) || !/\(100%\)/.test(output)) throw new Error(output);
});

// ------------------------------------------------------------ UnitCases
test('UnitCases: given passing, failing and skipped cases, when run, then each is counted once and all run', () => {
  const list = createCases();
  let ran = 0;
  list.case('passes', () => { ++ran; });
  list.case('throws', () => { ++ran; throw new Error('boom'); });
  list.case('skips', () => { ++ran; return 'skip'; });
  list.case('passes after a failure', () => { ++ran; });
  const { result, output } = captured(() => list.run());
  equal([result.passed, result.failed, result.skipped, ran], [2, 1, 1, 4]);
  if (!/✗ throws\n {6}boom/.test(output)) throw new Error(output);
});
test('UnitCases: given no cases (boundary), when run, then nothing passes or fails', () => {
  const { result } = captured(() => createCases().run());
  equal([result.passed, result.failed, result.skipped], [0, 0, 0]);
});
test('UnitCases: given a multi-line error, when reported, then every line is indented under the case', () => {
  const list = createCases();
  list.case('multi', () => { throw new Error('one\ntwo'); });
  const { output } = captured(() => list.run());
  if (!/ {6}one\n {6}two/.test(output)) throw new Error(output);
});

/**
 * Run every case of the shared runner code.
 * @param {object} options - { verbose }
 * @returns {object} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  console.log('Test runner tests');
  return cases.run(options);
}

module.exports = { run };
