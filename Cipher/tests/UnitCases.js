/*
 * A list of named unit cases, run on demand (shared by the given/when/then
 * unit-test modules that the two test runners call).
 * (c)2006-2025 Hawkynt
 *
 * A case passes when its function returns, fails when it throws, and is
 * skipped when it returns the string 'skip' (a prerequisite such as a
 * compiler is missing).
 */

'use strict';

/**
 * @returns {{case: function(string, function): void, run: function(object=): object}}
 *   case(name, fn) records a case; run({ verbose }) runs them all and returns
 *   { passed, failed, skipped, detail }
 */
function createCases() {
  const cases = [];
  return {
    case(name, fn) { cases.push({ name, fn }); },
    run(options = {}) {
      let passed = 0, failed = 0, skipped = 0;
      for (const { name, fn } of cases) {
        try {
          if (fn() === 'skip') {
            ++skipped;
            console.log(`  - ${name} (skipped)`);
            continue;
          }
          ++passed;
          if (options.verbose) console.log(`  ✓ ${name}`);
        } catch (e) {
          ++failed;
          console.log(`  ✗ ${name}\n      ${String(e.message).split('\n').join('\n      ')}`);
        }
      }
      console.log(`${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`);
      return { passed, failed, skipped, detail: skipped ? `${skipped} skipped` : '' };
    }
  };
}

module.exports = { createCases };
