# SynthelicZ Cipher Tools - Modular Test Suite

The test suite has been refactored to support both **standalone CLI execution** and **module usage for UI integration**, while maintaining identical testing logic across both interfaces.

## Architecture Overview

```
TestSuite (CLI)
     ↓
TestEngine (Core Logic)
     ↑
TestAPI (UI Interface)
```

### Core Components

1. **TestEngine.js** - Core testing logic, no CLI dependencies
2. **TestSuite.js** - CLI wrapper maintaining backward compatibility
3. **TestAPI.js** - UI-friendly module interface
4. **TestDemo.js** - Demonstration that both interfaces use identical logic

## Usage Examples

### 1. CLI Usage (Unchanged)

The CLI interface works exactly as before:

```bash
# Test all algorithms
node tests/TestSuite.js

# Test single algorithm
node tests/TestSuite.js rijndael.js

# Verbose output
node tests/TestSuite.js --verbose
```

### 2. UI Module Usage

#### Basic Algorithm Testing

```javascript
const TestAPI = require('./tests/TestAPI');

async function testAlgorithm() {
  const testAPI = new TestAPI();
  await testAPI.initialize();

  const result = await testAPI.testAlgorithm('./algorithms/block/rijndael.js');

  if (result.success) {
    console.log(`${result.algorithm.name}: ${result.summary.score}`);
    console.log(`Tests passed: ${result.summary.passed}`);
    console.log(`Percentage: ${result.summary.percentage}%`);
  }
}
```

#### Functionality Testing (Test Vectors)

```javascript
const TestAPI = require('./tests/TestAPI');

async function testFunctionality() {
  const testAPI = new TestAPI();
  await testAPI.initialize();

  // Load algorithm instance
  const algorithms = await testAPI.loadAlgorithmInstance('./algorithms/block/rijndael.js');

  if (algorithms.success) {
    const algorithm = algorithms.algorithms[0].algorithm;

    // Test algorithm functionality
    const result = await testAPI.testAlgorithmFunctionality(algorithm);

    console.log(`Status: ${result.result.status}`);
    console.log(`Vectors: ${result.result.vectorsPassed}/${result.result.vectorsTotal}`);
    console.log(`Round-trips: ${result.result.roundTripsPassed}/${result.result.roundTripsAttempted}`);
  }
}
```

#### Individual Test Vector Testing

```javascript
const TestAPI = require('./tests/TestAPI');

async function testSingleVector() {
  const testAPI = new TestAPI();
  await testAPI.initialize();

  // Load algorithm
  const algorithms = await testAPI.loadAlgorithmInstance('./algorithms/block/rijndael.js');
  const algorithm = algorithms.algorithms[0].algorithm;

  // Test first vector
  const vector = algorithm.tests[0];
  const result = await testAPI.testSingleVector(algorithm, vector, 0);

  console.log(`Vector passed: ${result.result.passed}`);
  console.log(`Round-trip: ${result.result.roundTripSuccess}`);
}
```

#### Batch Testing with Progress

```javascript
const TestAPI = require('./tests/TestAPI');

async function batchTest() {
  const testAPI = new TestAPI();

  // Set progress callback
  testAPI.setProgressCallback((progress) => {
    console.log(`Testing ${progress.current}/${progress.total}: ${progress.algorithm}`);
  });

  await testAPI.initialize();

  // Test entire category
  const result = await testAPI.testCategory('block');

  console.log(`Tested ${result.summary.total} algorithms`);
  console.log(`Passed: ${result.summary.passed}, Failed: ${result.summary.failed}`);
}
```

## Key Features

### ✅ Identical Testing Logic

Both CLI and UI interfaces use the **exact same TestEngine**, ensuring:
- Same test vector validation
- Same round-trip testing
- Same metadata compliance checks
- Same optimization validation
- Identical results regardless of interface

### ✅ UI-Friendly Returns

The TestAPI returns structured JSON objects instead of console output:

```javascript
{
  success: true,
  algorithm: {
    name: "Rijndael (AES)",
    tests: {
      compilation: true,
      interface: true,
      metadata: true,
      issues: true,
      functionality: true,
      optimization: true
    },
    details: { /* detailed results */ }
  },
  summary: {
    passed: true,
    score: "6/6",
    percentage: 100,
    errors: []
  }
}
```

### ✅ Real-time Progress

For UI integration, the TestAPI supports progress callbacks:

```javascript
const testAPI = new TestAPI({
  progressCallback: (progress) => {
    updateProgressBar(progress.current, progress.total);
    setStatusText(`Testing ${progress.algorithm}...`);
  }
});
```

### ✅ Individual Vector Testing

Perfect for UI test vector execution:

```javascript
// Load algorithm instance
const algorithms = await testAPI.loadAlgorithmInstance(filePath);
const algorithm = algorithms.algorithms[0].algorithm;

// Test each vector individually
for (let i = 0; i < algorithm.tests.length; i++) {
  const vector = algorithm.tests[i];
  const result = await testAPI.testSingleVector(algorithm, vector, i);

  displayVectorResult(i, result.result.passed, result.result.roundTripSuccess);
}
```

## Test Categories

Both interfaces test these 6 categories:

1. **🔧 Compilation** - JavaScript syntax validation
2. **🔌 Interface** - AlgorithmFramework compatibility
3. **📋 Metadata** - CONTRIBUTING.md compliance
4. **⚠️ Issues** - TODO/FIXME comment detection
5. **⚡ Functionality** - Test vector validation & round-trips
6. **🚀 Optimization** - OpCodes usage verification

## Advanced Usage

### Core Engine Access

For advanced scenarios, access the TestEngine directly:

```javascript
const TestEngine = require('./tests/TestEngine');

const engine = new TestEngine({ verbose: true });
await engine.loadDependencies();

const result = await engine.testAlgorithm('./path/to/algorithm.js');
// Direct access to all testing methods
```

### Algorithm Discovery

Discover available algorithms programmatically:

```javascript
const testAPI = new TestAPI();
const discovery = await testAPI.discoverAlgorithms();

console.log(`Found ${discovery.discovery.totalAlgorithms} algorithms`);
for (const category of discovery.discovery.categories) {
  console.log(`${category.name}: ${category.count} algorithms`);
}
```

## Migration Guide

### For Existing CLI Users
No changes needed! The CLI works exactly as before.

### For UI Developers
Replace direct algorithm loading with TestAPI:

```javascript
// OLD: Manual algorithm testing
require('./algorithms/block/rijndael.js');
// manual test vector execution...

// NEW: Use TestAPI
const testAPI = new TestAPI();
const result = await testAPI.testAlgorithm('./algorithms/block/rijndael.js');
// Same functionality tests, UI-friendly results
```

## Files Overview

- **TestEngine.js** - Core testing logic (reusable)
- **TestSuite.js** - CLI interface (refactored to use TestEngine)
- **TestAPI.js** - UI module interface (uses TestEngine)
- **TestDemo.js** - Verification that both interfaces are identical
- **README.md** - This documentation

## Verification

Run the demonstration to verify identical behavior:

```bash
node tests/TestDemo.js
```

This proves both CLI and UI interfaces produce identical results using the same core testing logic.

---

*The modular test suite ensures UI applications can execute the exact same functionality tests as the CLI, maintaining consistency and reliability across all interfaces.*