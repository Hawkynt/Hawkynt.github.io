/*
 * Category selection and the closing summary, shared by the two test runners
 * (tests/TestSuite.js and tests/TranspilerSuite.js).
 * (c)2006-2025 Hawkynt
 *
 * A runner declares its categories in order; the command line picks some of
 * them with --only=a,b and/or --skip=c. Each category reports how many of its
 * checks passed and failed, and the runner prints one line per category and
 * a single verdict. Any failure in a selected category fails the process.
 */

'use strict';

/**
 * The value of --name=value, or null.
 * @param {string[]} args - command-line arguments
 * @param {string} name - option name without dashes
 * @returns {string|null} value
 */
function optionValue(args, name) {
  const prefix = `--${name}=`;
  const arg = args.find(a => a.startsWith(prefix));
  return arg === undefined ? null : arg.slice(prefix.length);
}

/**
 * Parse a comma-separated category list and reject names the runner does not have.
 * @param {string|null} text - e.g. "roundtrip,types"
 * @param {string[]} known - category keys of the runner
 * @param {string} option - option name, for the error message
 * @returns {string[]|null} keys, or null when the option was not given
 */
function parseList(text, known, option) {
  if (text === null) return null;
  const keys = text.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
  if (keys.length === 0) throw new Error(`--${option}= needs at least one category (${known.join(', ')})`);
  const unknown = keys.filter(k => !known.includes(k));
  if (unknown.length)
    throw new Error(`--${option}: unknown categor${unknown.length > 1 ? 'ies' : 'y'} ${unknown.join(', ')} (known: ${known.join(', ')})`);
  return keys;
}

/**
 * The categories a run covers: --only (or every default category), minus --skip.
 * @param {string[]} args - command-line arguments
 * @param {string[]} known - every category key, in run order
 * @param {string[]} [defaults] - what runs when --only is not given (default: all)
 * @returns {{selected: Set<string>, explicit: Set<string>}} selected keys, and those named by --only
 */
function selectCategories(args, known, defaults = known) {
  const only = parseList(optionValue(args, 'only'), known, 'only');
  const skip = parseList(optionValue(args, 'skip'), known, 'skip') || [];
  const selected = new Set((only || defaults).filter(k => !skip.includes(k)));
  if (selected.size === 0) throw new Error('--only/--skip leave no category to run');
  return { selected, explicit: new Set(only || []) };
}

/**
 * Reject options the runner does not understand, so a typo cannot silently
 * run something other than what was asked for.
 * @param {string[]} args - command-line arguments
 * @param {string[]} flags - accepted flags without a value (e.g. "--verbose")
 * @param {string[]} valued - accepted option names taking =value (e.g. "only")
 */
function rejectUnknownOptions(args, flags, valued) {
  for (const arg of args) {
    if (!arg.startsWith('-')) continue;
    if (flags.includes(arg)) continue;
    if (valued.some(name => arg.startsWith(`--${name}=`))) continue;
    throw new Error(`unknown option ${arg}`);
  }
}

/**
 * Print one line per category and the overall verdict.
 * The percentage is floored, so a partial pass never shows 100%.
 * @param {string} title - heading of the summary
 * @param {object[]} rows - { label, passed, failed, detail } in run order
 * @returns {number} failed checks over all rows
 */
function printSummary(title, rows) {
  console.log(`\n=== ${title} ===`);
  const width = Math.max(...rows.map(r => r.label.length)) + 1;
  for (const row of rows) {
    const status = row.failed ? 'FAIL' : 'ok  ';
    const total = row.passed + row.failed;
    console.log(`${status} ${`${row.label}:`.padEnd(width)} ${row.passed}/${total} passed${row.detail ? ` (${row.detail})` : ''}`);
  }
  const passed = rows.reduce((sum, r) => sum + r.passed, 0);
  const failed = rows.reduce((sum, r) => sum + r.failed, 0);
  const total = passed + failed;
  const percentage = total > 0 ? Math.floor(passed * 100 / total) : 100;
  const failing = rows.filter(r => r.failed).map(r => r.label);

  console.log('');
  console.log(`${passed}/${total} checks passed (${percentage}%)`);
  console.log(failing.length === 0
    ? 'VERDICT: PASS'
    : `VERDICT: FAIL - ${failed} check(s) failed in ${failing.join(', ')}`);
  return failed;
}

module.exports = { optionValue, parseList, selectCategories, rejectUnknownOptions, printSummary };
