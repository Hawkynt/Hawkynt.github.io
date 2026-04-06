;(function() {
  'use strict';

  const suites = [];
  let currentSuite = null;

  function describe(name, fn) {
    const suite = { name, tests: [], beforeEachFn: null, afterEachFn: null };
    const prev = currentSuite;
    currentSuite = suite;
    fn();
    currentSuite = prev;
    suites.push(suite);
  }

  function it(name, fn) {
    if (!currentSuite)
      throw new Error('it() must be called inside describe()');
    currentSuite.tests.push({ name, fn });
  }

  function beforeEach(fn) {
    if (!currentSuite)
      throw new Error('beforeEach() must be called inside describe()');
    currentSuite.beforeEachFn = fn;
  }

  function afterEach(fn) {
    if (!currentSuite)
      throw new Error('afterEach() must be called inside describe()');
    currentSuite.afterEachFn = fn;
  }

  const assert = {
    equal(actual, expected, msg) {
      if (actual !== expected)
        throw new Error(msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },

    notEqual(actual, expected, msg) {
      if (actual === expected)
        throw new Error(msg || `Expected value to differ from ${JSON.stringify(expected)}`);
    },

    ok(value, msg) {
      if (!value)
        throw new Error(msg || `Expected truthy, got ${JSON.stringify(value)}`);
    },

    throws(fn, msg) {
      let threw = false;
      try { fn(); } catch (_) { threw = true; }
      if (!threw)
        throw new Error(msg || 'Expected function to throw');
    },

    async rejects(fn, msg) {
      let threw = false;
      try { await fn(); } catch (_) { threw = true; }
      if (!threw)
        throw new Error(msg || 'Expected promise to reject');
    },

    deepEqual(actual, expected, msg) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b)
        throw new Error(msg || `Deep equal failed:\n  actual:   ${a}\n  expected: ${b}`);
    },

    closeTo(actual, expected, delta, msg) {
      if (Math.abs(actual - expected) > delta)
        throw new Error(msg || `Expected ${actual} to be within ${delta} of ${expected}`);
    },

    greaterThan(actual, expected, msg) {
      if (!(actual > expected))
        throw new Error(msg || `Expected ${actual} > ${expected}`);
    },

    lessThan(actual, expected, msg) {
      if (!(actual < expected))
        throw new Error(msg || `Expected ${actual} < ${expected}`);
    },

    includes(arr, value, msg) {
      if (!arr.includes(value))
        throw new Error(msg || `Expected array to include ${JSON.stringify(value)}`);
    },

    isArray(value, msg) {
      if (!Array.isArray(value))
        throw new Error(msg || `Expected array, got ${typeof value}`);
    },

    isNull(value, msg) {
      if (value !== null)
        throw new Error(msg || `Expected null, got ${JSON.stringify(value)}`);
    },

    isUndefined(value, msg) {
      if (value !== undefined)
        throw new Error(msg || `Expected undefined, got ${JSON.stringify(value)}`);
    },

    instanceOf(value, ctor, msg) {
      if (!(value instanceof ctor))
        throw new Error(msg || `Expected instance of ${ctor.name}`);
    },

    typeOf(value, type, msg) {
      if (typeof value !== type)
        throw new Error(msg || `Expected typeof ${type}, got ${typeof value}`);
    }
  };

  function skip(reason) {
    const err = new Error(reason || 'Skipped');
    err._skip = true;
    throw err;
  }

  async function runAll() {
    const output = document.getElementById('test-output');
    const summary = document.getElementById('test-summary');
    if (!output || !summary)
      return;

    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const total = suites.reduce((n, s) => n + s.tests.length, 0);

    summary.textContent = `Running ${total} tests...`;
    summary.className = 'running';
    output.innerHTML = '';

    for (const suite of suites) {
      const suiteEl = document.createElement('div');
      suiteEl.className = 'suite';

      const heading = document.createElement('h3');
      heading.textContent = suite.name;
      suiteEl.appendChild(heading);

      for (const test of suite.tests) {
        const testEl = document.createElement('div');
        testEl.className = 'test';

        try {
          if (suite.beforeEachFn)
            await suite.beforeEachFn();
          await test.fn();
          if (suite.afterEachFn)
            await suite.afterEachFn();
          testEl.className = 'test pass';
          testEl.textContent = `\u2713 ${test.name}`;
          ++passed;
        } catch (err) {
          if (err._skip) {
            testEl.className = 'test skip';
            testEl.textContent = `\u25CB ${test.name} (skipped: ${err.message})`;
            ++skipped;
          } else {
            testEl.className = 'test fail';
            testEl.textContent = `\u2717 ${test.name}`;
            const detail = document.createElement('pre');
            detail.className = 'error-detail';
            detail.textContent = err.message + (err.stack ? '\n' + err.stack : '');
            testEl.appendChild(detail);
            ++failed;
          }
          try {
            if (suite.afterEachFn)
              await suite.afterEachFn();
          } catch (_) {}
        }

        suiteEl.appendChild(testEl);
      }

      output.appendChild(suiteEl);
    }

    const statusText = `${passed} passed, ${failed} failed, ${skipped} skipped (${total} total)`;
    summary.textContent = statusText;
    summary.className = failed > 0 ? 'fail' : 'pass';
  }

  window.TestRunner = { describe, it, beforeEach, afterEach, assert, skip, runAll };
})();
