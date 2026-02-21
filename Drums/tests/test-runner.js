// Minimal browser-based test runner
// Discovers tests registered via describe/it, runs them, and reports results.

(function (ns) {
'use strict';

const _suites = [];
let _currentSuite = null;

function describe(name, fn) {
  const suite = { name, tests: [], beforeEachFn: null, passed: 0, failed: 0, errors: [] };
  _suites.push(suite);
  _currentSuite = suite;
  fn();
  _currentSuite = null;
}

function beforeEach(fn) {
  if (_currentSuite)
    _currentSuite.beforeEachFn = fn;
}

function it(name, fn) {
  if (!_currentSuite)
    throw new Error(`it("${name}") called outside of describe()`);

  _currentSuite.tests.push({ name, fn });
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
    },
    toEqual(expected) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b)
        throw new Error(`Expected ${b} but got ${a}`);
    },
    toBeNull() {
      if (actual !== null)
        throw new Error(`Expected null but got ${JSON.stringify(actual)}`);
    },
    toBeUndefined() {
      if (actual !== undefined)
        throw new Error(`Expected undefined but got ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual)
        throw new Error(`Expected truthy but got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual)
        throw new Error(`Expected falsy but got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected))
        throw new Error(`Expected ${JSON.stringify(actual)} > ${JSON.stringify(expected)}`);
    },
    toBeLessThan(expected) {
      if (!(actual < expected))
        throw new Error(`Expected ${JSON.stringify(actual)} < ${JSON.stringify(expected)}`);
    },
    toBeGreaterThanOrEqual(expected) {
      if (!(actual >= expected))
        throw new Error(`Expected ${JSON.stringify(actual)} >= ${JSON.stringify(expected)}`);
    },
    toContain(expected) {
      if (typeof actual === 'string') {
        if (!actual.includes(expected))
          throw new Error(`Expected "${actual}" to contain "${expected}"`);
      } else if (Array.isArray(actual)) {
        if (!actual.includes(expected))
          throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
      } else
        throw new Error(`toContain requires string or array, got ${typeof actual}`);
    },
    toThrow() {
      if (typeof actual !== 'function')
        throw new Error('toThrow requires a function');

      let threw = false;
      try {
        actual();
      } catch {
        threw = true;
      }
      if (!threw)
        throw new Error('Expected function to throw but it did not');
    },
    not: {
      toBe(expected) {
        if (actual === expected)
          throw new Error(`Expected value to not be ${JSON.stringify(expected)}`);
      },
      toBeNull() {
        if (actual === null)
          throw new Error('Expected value to not be null');
      },
      toEqual(expected) {
        const a = JSON.stringify(actual);
        const b = JSON.stringify(expected);
        if (a === b)
          throw new Error(`Expected value to not equal ${b}`);
      },
    },
  };
}

async function runAllTests() {
  const results = { totalPassed: 0, totalFailed: 0, suites: [] };
  const startTime = performance.now();

  for (const suite of _suites) {
    for (const test of suite.tests) {
      const testStart = performance.now();
      try {
        if (suite.beforeEachFn)
          suite.beforeEachFn();

        const result = test.fn();
        if (result instanceof Promise)
          await result;

        const elapsed = performance.now() - testStart;
        if (elapsed > 200)
          console.warn(`  ⚠ ${test.name} took ${elapsed.toFixed(1)}ms (budget: 200ms)`);

        ++suite.passed;
        ++results.totalPassed;
      } catch (e) {
        ++suite.failed;
        ++results.totalFailed;
        suite.errors.push({ test: test.name, message: e.message, stack: e.stack });
      }
    }
    results.suites.push(suite);
  }

  results.elapsed = performance.now() - startTime;
  return results;
}

function renderResults(results, container) {
  container.innerHTML = '';

  const header = document.createElement('h1');
  const allPassed = results.totalFailed === 0;
  header.textContent = allPassed
    ? `✅ ALL PASS — ${results.totalPassed} tests (${results.elapsed.toFixed(0)}ms)`
    : `❌ ${results.totalFailed} FAILED / ${results.totalPassed} passed (${results.elapsed.toFixed(0)}ms)`;
  header.style.color = allPassed ? '#4caf50' : '#f44336';
  container.appendChild(header);

  for (const suite of results.suites) {
    const section = document.createElement('details');
    section.open = suite.failed > 0;

    const summary = document.createElement('summary');
    const icon = suite.failed > 0 ? '❌' : '✅';
    summary.textContent = `${icon} ${suite.name} — ${suite.passed}/${suite.tests.length} passed`;
    summary.style.fontWeight = 'bold';
    summary.style.cursor = 'pointer';
    summary.style.padding = '4px 0';
    section.appendChild(summary);

    for (const err of suite.errors) {
      const div = document.createElement('div');
      div.style.color = '#f44336';
      div.style.marginLeft = '1.5em';
      div.style.whiteSpace = 'pre-wrap';
      div.textContent = `  ✗ ${err.test}\n    ${err.message}`;
      section.appendChild(div);
    }

    container.appendChild(section);
  }

  // non-zero exit code analog: set document title for CI
  document.title = allPassed ? '[PASS] Tests' : '[FAIL] Tests';
}

ns.describe = describe;
ns.it = it;
ns.expect = expect;
ns.beforeEach = beforeEach;
ns.runAllTests = runAllTests;
ns.renderResults = renderResults;

})(window.TestRunner = window.TestRunner || {});
