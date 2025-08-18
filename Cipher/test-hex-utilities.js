#!/usr/bin/env node
/*
 * Comprehensive Tests for Hex Utilities in OpCodes.js
 * (c)2025 Hawkynt
 * 
 * Tests all hex conversion functions for correctness, edge cases, and performance.
 * Run with: node test-hex-utilities.js
 */

// Load OpCodes.js
if (typeof OpCodes === 'undefined') {
  try {
    require('./OpCodes.js');
  } catch (e) {
    console.error('Failed to load OpCodes.js:', e.message);
    process.exit(1);
  }
}

class HexUtilityTests {
  constructor() {
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.totalTests = 0;
  }

  assert(condition, message) {
    this.totalTests++;
    if (condition) {
      this.testsPassed++;
      console.log(`✓ ${message}`);
    } else {
      this.testsFailed++;
      console.error(`✗ ${message}`);
    }
  }

  arrayEquals(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
    return true;
  }

  runTests() {
    console.log('Running comprehensive hex utility tests...\n');
    
    this.testHex4ToBytes();
    this.testHex8ToBytes();
    this.testHex16ToBytes();
    this.testHex32ToBytes();
    this.testBytesToHex4();
    this.testBytesToHex8();
    this.testBytesToHex16();
    this.testBytesToHex32();
    this.testValidation();
    this.testFormatting();
    this.testParsing();
    this.testSBoxParsing();
    this.testEdgeCases();
    this.testPerformance();
    
    this.printResults();
  }

  testHex4ToBytes() {
    console.log('Testing Hex4ToBytes...');
    
    // Basic conversion
    let result = OpCodes.Hex4ToBytes('f123');
    this.assert(this.arrayEquals(result, [15, 1, 2, 3]), 'Hex4ToBytes basic conversion');
    
    // Single digit
    result = OpCodes.Hex4ToBytes('a');
    this.assert(this.arrayEquals(result, [10]), 'Hex4ToBytes single digit');
    
    // Empty string
    result = OpCodes.Hex4ToBytes('');
    this.assert(this.arrayEquals(result, []), 'Hex4ToBytes empty string');
    
    // Lowercase
    result = OpCodes.Hex4ToBytes('abc');
    this.assert(this.arrayEquals(result, [10, 11, 12]), 'Hex4ToBytes lowercase');
    
    // With whitespace
    result = OpCodes.Hex4ToBytes(' f1 23 ');
    this.assert(this.arrayEquals(result, [15, 1, 2, 3]), 'Hex4ToBytes with whitespace');
    
    // Error cases
    try {
      OpCodes.Hex4ToBytes('xyz');
      this.assert(false, 'Hex4ToBytes should reject invalid characters');
    } catch (e) {
      this.assert(true, 'Hex4ToBytes rejects invalid characters');
    }
  }

  testHex8ToBytes() {
    console.log('\nTesting Hex8ToBytes...');
    
    // Basic conversion
    let result = OpCodes.Hex8ToBytes('f123');
    this.assert(this.arrayEquals(result, [0xf1, 0x23]), 'Hex8ToBytes basic conversion');
    
    // Single byte
    result = OpCodes.Hex8ToBytes('ff');
    this.assert(this.arrayEquals(result, [255]), 'Hex8ToBytes single byte');
    
    // Odd length (auto-padding)
    result = OpCodes.Hex8ToBytes('f');
    this.assert(this.arrayEquals(result, [0x0f]), 'Hex8ToBytes odd length padding');
    
    // Multiple bytes
    result = OpCodes.Hex8ToBytes('0123456789abcdef');
    this.assert(this.arrayEquals(result, [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]), 'Hex8ToBytes multiple bytes');
    
    // With whitespace
    result = OpCodes.Hex8ToBytes(' f1 23 ab ');
    this.assert(this.arrayEquals(result, [0xf1, 0x23, 0xab]), 'Hex8ToBytes with whitespace');
  }

  testHex16ToBytes() {
    console.log('\nTesting Hex16ToBytes...');
    
    // Basic conversion
    let result = OpCodes.Hex16ToBytes('f123abcd');
    this.assert(this.arrayEquals(result, [0xf123, 0xabcd]), 'Hex16ToBytes basic conversion');
    
    // Single word
    result = OpCodes.Hex16ToBytes('ffff');
    this.assert(this.arrayEquals(result, [65535]), 'Hex16ToBytes single word');
    
    // Auto-padding
    result = OpCodes.Hex16ToBytes('f');
    this.assert(this.arrayEquals(result, [0x000f]), 'Hex16ToBytes auto-padding');
    
    // Partial padding
    result = OpCodes.Hex16ToBytes('123');
    this.assert(this.arrayEquals(result, [0x0123]), 'Hex16ToBytes partial padding');
  }

  testHex32ToBytes() {
    console.log('\nTesting Hex32ToBytes...');
    
    // Basic conversion
    let result = OpCodes.Hex32ToBytes('f123abcd9876543e');
    this.assert(this.arrayEquals(result, [0xf123abcd, 0x9876543e]), 'Hex32ToBytes basic conversion');
    
    // Single word
    result = OpCodes.Hex32ToBytes('ffffffff');
    this.assert(result[0] === 0xffffffff, 'Hex32ToBytes single word');
    
    // Auto-padding
    result = OpCodes.Hex32ToBytes('f');
    this.assert(result[0] === 0x0000000f, 'Hex32ToBytes auto-padding');
  }

  testBytesToHex4() {
    console.log('\nTesting BytesToHex4...');
    
    let result = OpCodes.BytesToHex4([15, 1, 2, 3]);
    this.assert(result === 'F123', 'BytesToHex4 basic conversion');
    
    result = OpCodes.BytesToHex4([0, 10, 15]);
    this.assert(result === '0AF', 'BytesToHex4 with zero and max values');
  }

  testBytesToHex8() {
    console.log('\nTesting BytesToHex8...');
    
    let result = OpCodes.BytesToHex8([0xf1, 0x23]);
    this.assert(result === 'F123', 'BytesToHex8 basic conversion');
    
    result = OpCodes.BytesToHex8([0, 255, 127]);
    this.assert(result === '00FF7F', 'BytesToHex8 with edge values');
  }

  testBytesToHex16() {
    console.log('\nTesting BytesToHex16...');
    
    let result = OpCodes.BytesToHex16([0xf123, 0xabcd]);
    this.assert(result === 'F123ABCD', 'BytesToHex16 basic conversion');
    
    result = OpCodes.BytesToHex16([0, 65535]);
    this.assert(result === '0000FFFF', 'BytesToHex16 with edge values');
  }

  testBytesToHex32() {
    console.log('\nTesting BytesToHex32...');
    
    let result = OpCodes.BytesToHex32([0xf123abcd, 0x9876543e]);
    this.assert(result === 'F123ABCD9876543E', 'BytesToHex32 basic conversion');
  }

  testValidation() {
    console.log('\nTesting validation functions...');
    
    this.assert(OpCodes.IsValidHex('123abc'), 'IsValidHex accepts valid hex');
    this.assert(!OpCodes.IsValidHex('123xyz'), 'IsValidHex rejects invalid hex');
    this.assert(OpCodes.IsValidHex('123abc', 6), 'IsValidHex accepts correct length');
    this.assert(!OpCodes.IsValidHex('123abc', 8), 'IsValidHex rejects incorrect length');
  }

  testFormatting() {
    console.log('\nTesting formatting functions...');
    
    let result = OpCodes.FormatHex('123abcdef', 2, ' ');
    this.assert(result === '12 3A BC DE F', 'FormatHex with spaces');
    
    result = OpCodes.FormatHex('123abcdef', 4, '-');
    this.assert(result === '123A-BCDE-F', 'FormatHex with dashes');
    
    result = OpCodes.CleanHex(' 12 3a\nbc  def ');
    this.assert(result === '123ABCDEF', 'CleanHex removes formatting');
  }

  testParsing() {
    console.log('\nTesting hex constant parsing...');
    
    this.assert(OpCodes.ParseHexConstant('0x1234') === 0x1234, 'ParseHexConstant 0x prefix');
    this.assert(OpCodes.ParseHexConstant('1234h') === 0x1234, 'ParseHexConstant h suffix');
    this.assert(OpCodes.ParseHexConstant('$1234') === 0x1234, 'ParseHexConstant $ prefix');
    this.assert(OpCodes.ParseHexConstant('16#1234#') === 0x1234, 'ParseHexConstant Ada format');
  }

  testSBoxParsing() {
    console.log('\nTesting S-box parsing...');
    
    // Test hex string format
    const hexString = '636c777ba2e8ba7e81c2c92ec183b0'; // 15 bytes
    const paddedHex = hexString + '00'; // Pad to 16 bytes
    
    // Test array format
    const arrayFormat = new Array(256);
    for (let i = 0; i < 256; i++) {
      arrayFormat[i] = i;
    }
    
    try {
      const result = OpCodes.ParseSBox(arrayFormat);
      this.assert(result.length === 256, 'ParseSBox handles array format');
      this.assert(result[0] === 0 && result[255] === 255, 'ParseSBox array values correct');
    } catch (e) {
      this.assert(false, 'ParseSBox should handle valid array format');
    }
  }

  testEdgeCases() {
    console.log('\nTesting edge cases...');
    
    // Empty inputs
    this.assert(OpCodes.Hex8ToBytes('').length === 0, 'Empty hex string produces empty array');
    this.assert(OpCodes.BytesToHex8([]).length === 0, 'Empty array produces empty hex string');
    
    // Large inputs
    const largeHex = '0123456789abcdef'.repeat(100);
    const largeBytes = OpCodes.Hex8ToBytes(largeHex);
    this.assert(largeBytes.length === 800, 'Large hex string conversion');
    
    // Round-trip conversion
    const originalBytes = [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0];
    const hexString = OpCodes.BytesToHex8(originalBytes);
    const convertedBytes = OpCodes.Hex8ToBytes(hexString);
    this.assert(this.arrayEquals(originalBytes, convertedBytes), 'Round-trip conversion preserves data');
  }

  testPerformance() {
    console.log('\nTesting performance...');
    
    const largeHex = '0123456789abcdef'.repeat(1000); // 16KB of hex
    const startTime = Date.now();
    
    for (let i = 0; i < 100; i++) {
      OpCodes.Hex8ToBytes(largeHex);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    this.assert(duration < 1000, `Performance test completed in ${duration}ms (should be < 1000ms)`);
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('HEX UTILITIES TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Total tests: ${this.totalTests}`);
    console.log(`Passed: ${this.testsPassed}`);
    console.log(`Failed: ${this.testsFailed}`);
    console.log(`Success rate: ${((this.testsPassed / this.totalTests) * 100).toFixed(1)}%`);
    
    if (this.testsFailed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Hex utilities are working correctly.');
    } else {
      console.log(`\n❌ ${this.testsFailed} tests failed. Please review the implementation.`);
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new HexUtilityTests();
  tester.runTests();
}

module.exports = HexUtilityTests;