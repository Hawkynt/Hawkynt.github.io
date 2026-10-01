/*
 * A list of named unit cases, run on demand (shared by the given/when/then
 * unit-test modules that the two test runners call).
 * (c)2006-2025 Hawkynt
 *
 * A case passes when its function returns, fails when it throws, and is
 * skipped when it returns the string 'skip' (a prerequisite such as a
 * compiler is missing). runAsync() also awaits a case that returns a promise,
 * for code under test that is itself asynchronous.
 */

'use strict';

/**
 * @returns {{case: function(string, function): void, run: function(object=): object, runAsync: function(object=): Promise<object>}}
 *   case(name, fn) records a case; run({ verbose }) runs them all and returns
 *   { passed, failed, skipped, detail }; runAsync({ verbose }) does the same,
 *   awaiting each case
 */
function createCases() {
  const cases = [];

  function tally() {
    const counts = { passed: 0, failed: 0, skipped: 0 };
    return {
      record(name, outcome, error, options) {
        if (error) {
          ++counts.failed;
          console.log(`  ✗ ${name}\n      ${String(error.message).split('\n').join('\n      ')}`);
        } else if (outcome === 'skip') {
          ++counts.skipped;
          console.log(`  - ${name} (skipped)`);
        } else {
          ++counts.passed;
          if (options.verbose) console.log(`  ✓ ${name}`);
        }
      },
      summary() {
        const { passed, failed, skipped } = counts;
        console.log(`${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`);
        return { passed, failed, skipped, detail: skipped ? `${skipped} skipped` : '' };
      }
    };
  }

  return {
    case(name, fn) { cases.push({ name, fn }); },
    run(options = {}) {
      const t = tally();
      for (const { name, fn } of cases) {
        let outcome, error = null;
        try { outcome = fn(); } catch (e) { error = e; }
        t.record(name, outcome, error, options);
      }
      return t.summary();
    },
    async runAsync(options = {}) {
      const t = tally();
      for (const { name, fn } of cases) {
        let outcome, error = null;
        try { outcome = await fn(); } catch (e) { error = e; }
        t.record(name, outcome, error, options);
      }
      return t.summary();
    }
  };
}

module.exports = { createCases };
