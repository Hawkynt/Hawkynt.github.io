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
- **TranspilerValidationSuite.js** - Cross-language transpiler validation
- **CodeGenTestSuite.js** - Comprehensive transpiler AST coverage tests
- **README.md** - This documentation

## Verification

Run the demonstration to verify identical behavior:

```bash
node tests/TestDemo.js
```

This proves both CLI and UI interfaces produce identical results using the same core testing logic.

---

## Cross-Language Transpiler Validation

The `TranspilerValidationSuite.js` provides comprehensive cross-language testing:

### Features

1. **Auto-detects compilers/interpreters**: C (gcc), C++ (g++), C# (dotnet), Java, Python, PHP, Perl, Ruby, Go, Rust
2. **Dynamic algorithm discovery**: No hardcoded algorithms - works with all current and future algorithms
3. **JavaScript reference validation**: Validates algorithms pass JS tests before transpiling
4. **Multi-language transpilation**: Transpiles each algorithm to all available target languages
5. **Compilation testing**: Verifies transpiled code compiles/parses correctly
6. **Runtime execution**: Executes interpreted languages (Python, PHP, Perl, Ruby) to validate test harness
7. **Detailed reporting**: Generates JSON reports with per-algorithm, per-language results

### Usage

```bash
# Run all tests
node tests/TranspilerValidationSuite.js

# Quick test (3 algorithms per category)
node tests/TranspilerValidationSuite.js --quick

# Test specific algorithm
node tests/TranspilerValidationSuite.js --algorithm=tea

# Test specific category
node tests/TranspilerValidationSuite.js --category=block

# Test specific language only
node tests/TranspilerValidationSuite.js --language=csharp

# Compile-only mode (skip execution)
node tests/TranspilerValidationSuite.js --compile-only

# Verbose output with error details
node tests/TranspilerValidationSuite.js --verbose

# Generate detailed JSON report
node tests/TranspilerValidationSuite.js --report

# Combine options
node tests/TranspilerValidationSuite.js --quick --language=python --verbose
```

### Output Example

```
╔════════════════════════════════════════════════════════════╗
║       Transpiler Validation Suite                          ║
╚════════════════════════════════════════════════════════════╝

Detecting compilers/interpreters...

  ✓ C: gcc 13.2.0
  ✓ C++: g++ 13.2.0
  ✓ C#: 10.0.100
  ✓ Python: Python 3.11.9
  - Java: not found

Target languages: C, C++, C#, Python

Found 240 algorithms to test

━━━ BLOCK (45 algorithms) ━━━
  rijndael                  OK (4/4)
  tea                       OK (4/4)
  blowfish                  PARTIAL (compile: 3/4) [cpp]

Summary (45.2s)

Algorithms: 240 total, 235 JS-validated

Language Results:
  C:
    Transpiled: 230/235 (98%)
    Compiled:   215/230 (93%)
  C++:
    Transpiled: 230/235 (98%)
    Compiled:   210/230 (91%)
```

### Extending for New Languages

To add support for a new language:

1. Add compiler detection in `LANGUAGE_COMPILERS`
2. Create a test harness generator function (`generateXxxTestHarness`)
3. Add compilation/syntax test function (`testXxxCompilation`)
4. Optionally add execution function for interpreted languages

The suite automatically picks up new language plugins from `codingplugins/`.

---

*The modular test suite ensures UI applications can execute the exact same functionality tests as the CLI, maintaining consistency and reliability across all interfaces.*