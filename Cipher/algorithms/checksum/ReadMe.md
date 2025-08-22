# Checksum Algorithms Implementation Guide

This guide explains how to implement new checksum algorithms and algorithm families following the established patterns in this comprehensive educational collection.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Single Algorithm Implementation](#single-algorithm-implementation)
3. [Multi-Variant Algorithm Families](#multi-variant-algorithm-families)
4. [Implementation Patterns](#implementation-patterns)
5. [Testing Strategy](#testing-strategy)
6. [Documentation Standards](#documentation-standards)
7. [Best Practices](#best-practices)

## Architecture Overview

### Core Principles

Our checksum collection follows these fundamental principles:

1. **Multi-variant architecture** - Avoid code duplication by implementing flexible algorithm classes
2. **Educational focus** - Every implementation includes educational value and real-world context
3. **Universal compatibility** - Works in both Browser and Node.js environments
4. **Comprehensive testing** - Official test vectors with reference sources
5. **Complete documentation** - History, applications, vulnerabilities, and references

### Directory Structure

```
algorithms/checksum/
├── crc8.js          # CRC-8 family (4 variants)
├── crc16.js         # CRC-16 family (4 variants) 
├── crc24.js         # CRC-24 family (3 variants)
├── crc32.js         # CRC-32 family (3 variants)
├── crc64.js         # CRC-64 family (3 variants)
├── crc128.js        # CRC-128 family (3 variants)
├── fletcher.js      # Fletcher family (4 variants)
├── adler.js         # Adler family (3 variants)
├── unix-sum.js      # Unix Sum family (2 variants)
├── internet-checksum.js # Internet Checksum (RFC 1071)
├── check-digit.js   # Check Digit family (3 variants)
├── isbn.js          # ISBN family (2 variants)
├── parity.js        # Parity family (3 variants)
└── README.md        # This guide
```

## Single Algorithm Implementation

For algorithms with only one variant, use this pattern:

### Template Structure

```javascript
/*
 * Algorithm Name Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Brief description of the algorithm and its purpose.
 * Real-world applications and educational context.
 */

if (!global.AlgorithmFramework && typeof require !== 'undefined')
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');

if (!global.OpCodes && typeof require !== 'undefined')
  global.OpCodes = require('../../OpCodes.js');

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        Algorithm, IAlgorithmInstance, TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

class YourAlgorithm extends Algorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Your-Algorithm-Name";
    this.description = "Educational description with real-world context and applications.";
    this.inventor = "Algorithm Inventor";
    this.year = 1970;
    this.category = CategoryType.CHECKSUM;
    this.subCategory = "Algorithm Category";
    this.securityStatus = SecurityStatus.EDUCATIONAL; // NEVER claim "secure"
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.US;

    // Documentation and references
    this.documentation = [
      new LinkItem("Primary Reference", "https://example.com/spec"),
      new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/..."),
      new LinkItem("Tutorial/Guide", "https://example.com/tutorial"),
      new LinkItem("Original Paper", "https://example.com/paper"),
      new LinkItem("Standard Specification", "https://example.com/standard"),
      new LinkItem("Implementation Guide", "https://example.com/implementation")
    ];
    
    this.references = [
      new LinkItem("Original Implementation", "https://example.com/impl.c"),
      new LinkItem("Some library that already uses it", "https://example.com/impl.java"),
      new LinkItem("Some other 3rd party implementation", "https://example.com/impl.cpp")
    ];
    
    this.knownVulnerabilities = [
      new Vulnerability(
        "Security Limitation", 
        "Description and recommended alternatives"
      )
    ];

    // Test vectors with official sources
    this.tests = [
      {
        text: "Zero data", 
        uri: "https://example.com/kat.txt",
        input: [],
        expected: OpCodes.Hex8ToBytes("expected_output")
      ),
      {
        text: "All ones", 
        uri: "https://example.com/kat.txt",
        input: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFF"),
        expected: OpCodes.Hex8ToBytes("expected_output")
      ),
      {
        text: "All zeroes", 
        uri: "https://example.com/kat.txt",
        input: OpCodes.Hex8ToBytes("0000000000000000"),
        expected: OpCodes.Hex8ToBytes("expected_output")
      ),
      {
        text: "Wikipedia", 
        uri: "https://wikipedia.com/Your-Algorithm-Name(Checksum)",
        input: OpCodes.AnsiToBytes("Wikipedia"),
        expected: OpCodes.Hex8ToBytes("expected_output")
      )
    ];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // Checksums typically don't support inverse operations
    }
    return new YourAlgorithmInstance(this);
  }
}

class YourAlgorithmInstance extends IAlgorithmInstance {
  constructor(algorithm) {
    super(algorithm);
    // Initialize algorithm state
  }

  Feed(data) {
    if (!Array.isArray(data))
      throw new Error('YourAlgorithmInstance.Feed: Input must be byte array');
    
    // Process input data
    // Update internal state
  }

  Result() {
    // Calculate final result
    // Reset state for next calculation
    // Return result as byte array
    return [/* result bytes */];
  }
}

// Register the algorithm
RegisterAlgorithm(new YourAlgorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports)
  module.exports = { YourAlgorithm, YourAlgorithmInstance };
```

## Multi-Variant Algorithm Families

For algorithm families with multiple variants (like Fletcher, CRC, etc.), use this more sophisticated pattern:

### Template Structure

```javascript
/*
 * Algorithm Family Implementation with Multiple Variants
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Algorithm family description covering all variants.
 * Educational context and real-world applications.
 * Explanation of why multiple variants exist.
 */

// Load dependencies...

// Base algorithm class that accepts configuration parameters
class AlgorithmFamilyAlgorithm extends Algorithm {
  constructor(variant = 'DEFAULT') {
    super();
    
    // Get configuration for this variant
    this.config = this._getVariantConfig(variant);
    
    // Required metadata (variant-specific)
    this.name = `Algorithm-Family-${variant}`;
    this.description = `${this.config.description} Educational context for this variant.`;
    this.inventor = this.config.inventor || "Default Inventor";
    this.year = this.config.year || 1970;
    this.category = CategoryType.CHECKSUM;
    this.subCategory = "Algorithm Family";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = this.config.complexity || ComplexityType.BEGINNER;
    this.country = this.config.country || CountryCode.US;

    // Common documentation for the family
    this.documentation = [/* family documentation */];
    this.references = [/* family references */];
    this.knownVulnerabilities = [/* family vulnerabilities */];

    // Variant-specific test vectors
    this.tests = this.config.tests;
  }

  _getVariantConfig(variant) {
    const configs = {
      'VARIANT1': {
        description: 'First variant description and use cases',
        complexity: ComplexityType.BEGINNER,
        // Variant-specific parameters
        parameter1: 'value1',
        parameter2: 42,
        tests: [
          new TestCase(
            OpCodes.AnsiToBytes("test"),
            OpCodes.Hex8ToBytes("result"),
            "Variant 1 test",
            "Reference source"
          )
        ]
      },
      'VARIANT2': {
        description: 'Second variant description and use cases',
        complexity: ComplexityType.INTERMEDIATE,
        // Different parameters for this variant
        parameter1: 'value2',
        parameter2: 84,
        tests: [/* variant 2 tests */]
      }
      // Add more variants as needed
    };
    
    return configs[variant] || configs['VARIANT1'];
  }

  CreateInstance(isInverse = false) {
    if (isInverse)
      return null;
    
    return new AlgorithmFamilyInstance(this, this.config);
  }
}

class AlgorithmFamilyInstance extends IAlgorithmInstance {
  constructor(algorithm, config) {
    super(algorithm);
    this.config = config;
    // Initialize state using config parameters
  }

  Feed(data) {
    // Process data according to variant configuration
    // Use this.config.parameter1, this.config.parameter2, etc.
  }

  Result() {
    // Calculate result based on variant configuration
    // Different variants may have different result formats
  }
}

// Register all variants
RegisterAlgorithm(new AlgorithmFamilyAlgorithm('VARIANT1'));
RegisterAlgorithm(new AlgorithmFamilyAlgorithm('VARIANT2'));
// Register additional variants...

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) 
  module.exports = { AlgorithmFamilyAlgorithm, AlgorithmFamilyInstance };

```

## Testing Strategy

### 1. Debug Implementation First

Create a debug script to test your implementation:

```javascript
// test-your-algorithm-debug.js
global.AlgorithmFramework = require('../AlgorithmFramework.js');
global.OpCodes = require('../OpCodes.js');

require('../algorithms/checksum/your-algorithm.js');

console.log('Debugging Your Algorithm...\n');

const algorithm = global.AlgorithmFramework.Find('Your-Algorithm-Name');
const instance = algorithm.CreateInstance(false);

// Test with known inputs
instance.Feed([/* test input */]);
const result = instance.Result();
console.log('Result:', result.map(b => b.toString(16).padStart(2, '0')).join(''));

// Manual calculation for verification
console.log('Expected:', '/* expected result */');
```

### 2. Compute Correct Test Vectors

Don't guess test vectors - compute them:

```javascript
// For single-variant algorithms
const testInputs = [
  [],
  [0x61], // 'a'
  [0x61, 0x62, 0x63], // "abc"
  [/* more test cases */]
];

testInputs.forEach((input, index) => {
  const instance = algorithm.CreateInstance(false);
  instance.Feed(input);
  const result = instance.Result();
  console.log(`Test ${index + 1}:`, result.map(b => b.toString(16).padStart(2, '0')).join(''));
});
```

### 3. Validate Against Reference Implementations

When possible, validate against known reference implementations (this is what references field is for!):

- Online calculators
- Standard library implementations
- Official test vectors from RFCs/standards (stored in tests field!)

### 4. Create Comprehensive Test Suite

```javascript
// test-your-algorithm-comprehensive.js
function testAlgorithmVariant(algorithmName) {
  const algorithm = global.AlgorithmFramework.Find(algorithmName);
  console.log(`=== ${algorithmName} ===`);
  
  let allPass = true;
  
  // Test all official test vectors
  algorithm.tests.forEach((test, index) => {
    const instance = algorithm.CreateInstance(false);
    instance.Feed(test.input);
    const result = instance.Result();
    const match = JSON.stringify(result) === JSON.stringify(test.expected);
    
    console.log(`Test ${index + 1}: ${match ? 'PASS' : 'FAIL'} - ${test.text}`);
    if (!match) allPass = false;
  });
  
  // Test inverse operation
  const inverseResult = algorithm.CreateInstance(true);
  console.log(`Inverse test: ${inverseResult === null ? 'PASS' : 'FAIL'}`);
  
  // Test streaming capability
  const instance = algorithm.CreateInstance(false);
  instance.Feed([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
  instance.Feed([0x20]); // " "
  instance.Feed([0x57, 0x6F, 0x72, 0x6C, 0x64]); // "World"
  const streamResult = instance.Result();
  console.log(`Streaming test: PASS - Result: 0x${streamResult.map(b => b.toString(16).padStart(2, '0')).join('')}`);
  
  console.log(`Overall ${algorithmName}: ${allPass ? 'PASS' : 'FAIL'}\n`);
  return allPass;
}
```

### Comments and Code Documentation

```javascript
// Algorithm description and purpose
class YourAlgorithm extends Algorithm {
  constructor() {
    // Metadata setup...
  }

  _getVariantConfig(variant) {
    // Configuration explanation
    const configs = {
      'VARIANT': {
        description: 'Variant purpose and applications',
        // Parameter explanations
        parameter1: value1, // What this parameter controls
        parameter2: value2, // Why this value is chosen
      }
    };
  }
}

class YourAlgorithmInstance extends IAlgorithmInstance {
  Feed(data) {
    // Algorithm step explanation
    for (let i = 0; i < data.length; ++i)
      // What this operation does and why
      this.state = this._updateState(this.state, data[i]);
  }

  Result() {
    // Final calculation explanation
    const result = this._finalizeResult(this.state);
    
    // Reset explanation
    this.state = this._initialState();
    
    return result;
  }
}
```

## Best Practices

### 1. Multi-Variant Architecture Benefits

**✅ DO: Multi-variant families**
```javascript
// Single flexible implementation
class FletcherAlgorithm extends Algorithm {
  constructor(variant = '32') {
    this.config = this._getVariantConfig(variant);
    // One implementation, multiple configurations
  }
}

RegisterAlgorithm(new FletcherAlgorithm('8'));
RegisterAlgorithm(new FletcherAlgorithm('16'));
RegisterAlgorithm(new FletcherAlgorithm('32'));
RegisterAlgorithm(new FletcherAlgorithm('64'));
```

**❌ DON'T: Separate implementations**
```javascript
// Avoid code duplication
class Fletcher8Algorithm extends Algorithm { /* ... */ }
class Fletcher16Algorithm extends Algorithm { /* ... */ }
class Fletcher32Algorithm extends Algorithm { /* ... */ }
class Fletcher64Algorithm extends Algorithm { /* ... */ }
```

### 2. Configuration-Driven Implementation

**✅ DO: Parameter-based behavior**
```javascript
Feed(data) {
  for (let i = 0; i < data.length; ++i) {
    this.sum1 = (this.sum1 + data[i]) % this.config.modulo;
    this.sum2 = (this.sum2 + this.sum1) % this.config.modulo;
  }
}
```

**❌ DON'T: Hard-coded variants**
```javascript
Feed(data) {
  if (this.variant === '8') {
    // Hard-coded logic for Fletcher-8
  } else if (this.variant === '16') {
    // Hard-coded logic for Fletcher-16
  }
  // etc...
}
```

### 3. Educational Test Vectors

**✅ DO: Educational progression**
```javascript
tests: [
  new TestCase([], [0x00], "Empty input", "Base case"),
  new TestCase([0x61], [0x62], "Single byte 'a'", "Simple case"),
  new TestCase([0x61, 0x62, 0x63], [0x84], "String 'abc'", "Common case"),
  new TestCase([/* complex */], [/* result */], "Real-world example", "RFC reference")
]
```

**❌ DON'T: Random test data**
```javascript
tests: [
  new TestCase([0x42, 0x13, 0x99], [0xAB], "Random data", "No reference")
]
```

### 4. Error Handling

**✅ DO: Comprehensive validation**
```javascript
Feed(data) {
  if (!Array.isArray(data))
    throw new Error('YourAlgorithm.Feed: Input must be byte array');
  
  for (let byte of data)
    if (!Number.isInteger(byte) || byte < 0 || byte > 255)
      throw new Error('YourAlgorithm.Feed: All elements must be bytes (0-255)');
  
  // Process data...
}
```

### 5. State Management

**✅ DO: Proper state reset**
```javascript
Result() {
  // Calculate result
  const result = this._calculateResult();
  
  // Reset for next calculation
  this.state = this._initialState();
  
  return result;
}
```

### 6. Universal Compatibility

**✅ DO: Environment detection**

```javascript
if (!global.AlgorithmFramework && typeof require !== 'undefined')
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');

if (typeof module !== 'undefined' && module.exports)
  module.exports = { YourAlgorithm, YourAlgorithmInstance };

```

### 7. OpCodes Usage

**✅ DO: Use OpCodes utilities**
```javascript
// Use OpCodes for common operations
const result = OpCodes.Unpack32BE(checksum);
const testInput = OpCodes.AnsiToBytes("test string");
const expected = OpCodes.Hex8ToBytes("deadbeef");
```

**❌ DON'T: Manual byte manipulation**
```javascript
// Avoid manual bit manipulation when OpCodes provides utilities
const result = [
  (checksum >>> 24) & 0xFF,
  (checksum >>> 16) & 0xFF,
  (checksum >>> 8) & 0xFF,
  checksum & 0xFF
]; // Use OpCodes.Unpack32BE instead
```

## Implementation Checklist

Before submitting a new algorithm implementation:

- [ ] **Architecture**: Multi-variant family or justified single implementation?
- [ ] **Metadata**: Complete algorithm information with educational context?
- [ ] **Documentation**: References (to code), vulnerabilities, real-world applications?
- [ ] **Test Vectors**: Computed correctly with reference sources (URLs to look them up and prove)?
- [ ] **Error Handling**: Comprehensive input validation?
- [ ] **State Management**: Proper reset between calculations?
- [ ] **Universal Compatibility**: Works in Browser + Node.js?
- [ ] **OpCodes Integration**: Uses OpCodes utilities appropriately?
- [ ] **Educational Value**: Clear progression from simple to complex?
- [ ] **Code Quality**: Clean, documented, consistent with existing patterns?

## Conclusion

The multi-variant architecture pattern has proven successful across all our checksum families:

- **CRC Family**: 6 bit-widths × 20 total variants
- **Fletcher Family**: 4 bit-widths with different arithmetic parameters
- **Adler Family**: 3 bit-widths with prime modulus optimization
- **Check Digit Family**: 3 mathematical approaches (modulo 10, dihedral D5, quasigroups)

This pattern maximizes code reuse, maintains educational clarity, and provides comprehensive coverage of algorithm variations while avoiding duplication.

When implementing new algorithms, always consider: "Could this benefit from a multi-variant approach?" If multiple standard parameter sets exist, the answer is usually yes.

The result is a clean, maintainable, and educationally valuable collection that demonstrates both algorithmic diversity and implementation excellence.