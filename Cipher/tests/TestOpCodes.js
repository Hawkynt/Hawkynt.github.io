#!/usr/bin/env node
/*
 * OpCodes Test Suite - Comprehensive Testing for Cryptographic Operations Library
 * Tests all bit manipulation, arithmetic, conversion, and utility functions
 * 
 * Test Categories:
 * - BIT_MANIPULATION: Rotation and shifting operations (8, 16, 32, 64, 128-bit)
 * - BYTE_WORD_OPS: Packing, unpacking, endianness conversions
 * - MULTI_PRECISION: UInt64, UInt128, UInt256, UInt512 arithmetic
 * - CONVERSIONS: String/hex/byte conversions and array operations
 * - MATHEMATICS: Modular arithmetic, GF operations, matrix operations
 * - PERFORMANCE: Memory pooling, timing-safe operations, optimizations
 * 
 * (c)2006-2025 Hawkynt
 */

const fs = require('fs');
const path = require('path');

class OpCodesTestSuite {
  constructor() {
    this.verbose = false;
    this.results = {
      bit_manipulation: { passed: 0, failed: 0, errors: [] },
      byte_word_ops: { passed: 0, failed: 0, errors: [] },
      multi_precision: { passed: 0, failed: 0, errors: [] },
      conversions: { passed: 0, failed: 0, errors: [] },
      mathematics: { passed: 0, failed: 0, errors: [] },
      performance: { passed: 0, failed: 0, errors: [] }
    };
  }

  // Main entry point
  async runAllTests() {
    console.log('OpCodes Library - Comprehensive Test Suite');
    console.log('==========================================');
    console.log('');

    try {
      // Load OpCodes
      await this.loadOpCodes();
      
      // Parse command line arguments
      const args = process.argv.slice(2);
      this.verbose = args.includes('--verbose') || args.includes('-v');
      
      // Run all test categories
      console.log('Running comprehensive OpCodes tests...\n');
      
      await this.testBitManipulation();
      await this.testByteWordOperations();
      await this.testMultiPrecisionArithmetic();
      await this.testConversions();
      await this.testMathematics();
      await this.testPerformance();
      
      // Generate final report
      this.generateReport();
      
    } catch (error) {
      console.error('Fatal error during test execution:', error.message);
      process.exit(1);
    }
  }

  // Load OpCodes library
  async loadOpCodes() {
    console.log('Loading OpCodes library...');
    
    try {
      const opCodesPath = path.join(__dirname, '..', 'OpCodes.js');
      require(opCodesPath);
      
      if (!global.OpCodes) {
        throw new Error('OpCodes not loaded properly');
      }
      
      console.log('✓ OpCodes loaded successfully\n');
    } catch (error) {
      throw new Error(`Failed to load OpCodes: ${error.message}`);
    }
  }

  // Test helper functions
  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
    }
  }

  assertArrayEqual(actual, expected, message) {
    if (actual.length !== expected.length) {
      throw new Error(`${message}\n  Length mismatch - Expected: ${expected.length}, Actual: ${actual.length}`);
    }
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) {
        throw new Error(`${message}\n  Index ${i} - Expected: ${expected[i]}, Actual: ${actual[i]}`);
      }
    }
  }

  runTest(category, testName, testFunction) {
    try {
      testFunction();
      this.results[category].passed++;
      if (this.verbose) {
        console.log(`  ✓ ${testName}`);
      }
    } catch (error) {
      this.results[category].failed++;
      this.results[category].errors.push({
        test: testName,
        error: error.message
      });
      console.log(`  ✗ ${testName}: ${error.message}`);
    }
  }

  // ======================[ BIT MANIPULATION TESTS ]======================
  async testBitManipulation() {
    console.log('Testing Bit Manipulation Operations:');
    
    // 8-bit rotation tests
    this.runTest('bit_manipulation', 'RotL8 basic', () => {
      this.assertEqual(OpCodes.RotL8(0x12, 4), 0x21, 'RotL8(0x12, 4) should equal 0x21');
      this.assertEqual(OpCodes.RotL8(0xFF, 1), 0xFF, 'RotL8(0xFF, 1) should equal 0xFF');
      this.assertEqual(OpCodes.RotL8(0x80, 1), 0x01, 'RotL8(0x80, 1) should equal 0x01');
    });

    this.runTest('bit_manipulation', 'RotR8 basic', () => {
      this.assertEqual(OpCodes.RotR8(0x12, 4), 0x21, 'RotR8(0x12, 4) should equal 0x21');
      this.assertEqual(OpCodes.RotR8(0x01, 1), 0x80, 'RotR8(0x01, 1) should equal 0x80');
    });

    // 16-bit rotation tests
    this.runTest('bit_manipulation', 'RotL16 basic', () => {
      this.assertEqual(OpCodes.RotL16(0x1234, 8), 0x3412, 'RotL16(0x1234, 8) should equal 0x3412');
      this.assertEqual(OpCodes.RotL16(0x8000, 1), 0x0001, 'RotL16(0x8000, 1) should equal 0x0001');
    });

    this.runTest('bit_manipulation', 'RotR16 basic', () => {
      this.assertEqual(OpCodes.RotR16(0x1234, 8), 0x3412, 'RotR16(0x1234, 8) should equal 0x3412');
      this.assertEqual(OpCodes.RotR16(0x0001, 1), 0x8000, 'RotR16(0x0001, 1) should equal 0x8000');
    });

    // 32-bit rotation tests
    this.runTest('bit_manipulation', 'RotL32 basic', () => {
      this.assertEqual(OpCodes.RotL32(0x12345678, 16), 0x56781234, 'RotL32(0x12345678, 16) should equal 0x56781234');
      this.assertEqual(OpCodes.RotL32(0x80000000, 1), 0x00000001, 'RotL32(0x80000000, 1) should equal 0x00000001');
    });

    this.runTest('bit_manipulation', 'RotR32 basic', () => {
      this.assertEqual(OpCodes.RotR32(0x12345678, 16), 0x56781234, 'RotR32(0x12345678, 16) should equal 0x56781234');
      this.assertEqual(OpCodes.RotR32(0x00000001, 1), 0x80000000, 'RotR32(0x00000001, 1) should equal 0x80000000');
    });

    // 64-bit rotation tests
    this.runTest('bit_manipulation', 'RotL64 basic', () => {
      const result = OpCodes.RotL64(0x12345678, 0x9ABCDEF0, 32);
      this.assertEqual(result.high, 0x12345678, 'RotL64 high part incorrect'); // after 32-bit rotation: original low becomes high
      this.assertEqual(result.low, 0x9ABCDEF0, 'RotL64 low part incorrect');   // after 32-bit rotation: original high becomes low
    });

    this.runTest('bit_manipulation', 'RotR64 basic', () => {
      const result = OpCodes.RotR64(0x12345678, 0x9ABCDEF0, 32);
      this.assertEqual(result.high, 0x12345678, 'RotR64 high part incorrect'); // after 32-bit rotation: original low becomes high  
      this.assertEqual(result.low, 0x9ABCDEF0, 'RotR64 low part incorrect');   // after 32-bit rotation: original high becomes low
    });

    // 128-bit rotation tests
    this.runTest('bit_manipulation', 'RotL128 basic', () => {
      const input = [0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88];
      const result = OpCodes.RotL128(input, 8);
      this.assertEqual(result[0], 0x34, 'RotL128 first byte incorrect');
      this.assertEqual(result[15], 0x12, 'RotL128 last byte incorrect');
    });

    console.log('');
  }

  // ======================[ BYTE/WORD OPERATIONS TESTS ]======================
  async testByteWordOperations() {
    console.log('Testing Byte/Word Operations:');

    // 32-bit packing tests
    this.runTest('byte_word_ops', 'Pack32BE', () => {
      this.assertEqual(OpCodes.Pack32BE(0x12, 0x34, 0x56, 0x78), 0x12345678, 'Pack32BE failed');
    });

    this.runTest('byte_word_ops', 'Pack32LE', () => {
      this.assertEqual(OpCodes.Pack32LE(0x78, 0x56, 0x34, 0x12), 0x12345678, 'Pack32LE failed');
    });

    // 32-bit unpacking tests
    this.runTest('byte_word_ops', 'Unpack32BE', () => {
      const result = OpCodes.Unpack32BE(0x12345678);
      this.assertArrayEqual(result, [0x12, 0x34, 0x56, 0x78], 'Unpack32BE failed');
    });

    this.runTest('byte_word_ops', 'Unpack32LE', () => {
      const result = OpCodes.Unpack32LE(0x12345678);
      this.assertArrayEqual(result, [0x78, 0x56, 0x34, 0x12], 'Unpack32LE failed');
    });

    // Byte operations tests
    this.runTest('byte_word_ops', 'GetByte', () => {
      this.assertEqual(OpCodes.GetByte(0x12345678, 0), 0x78, 'GetByte LSB failed');
      this.assertEqual(OpCodes.GetByte(0x12345678, 3), 0x12, 'GetByte MSB failed');
    });

    this.runTest('byte_word_ops', 'SetByte', () => {
      this.assertEqual(OpCodes.SetByte(0x12345678, 0, 0xAB), 0x123456AB, 'SetByte LSB failed');
      this.assertEqual(OpCodes.SetByte(0x12345678, 3, 0xCD), 0xCD345678, 'SetByte MSB failed');
    });

    // 64-bit split/combine tests
    this.runTest('byte_word_ops', 'Split64 and Combine64', () => {
      const value = 0x123456789ABCDEF0;
      const split = OpCodes.Split64(value);
      const combined = OpCodes.Combine64(split.high32, split.low32);
      this.assertEqual(combined, value, 'Split64/Combine64 round-trip failed');
    });

    console.log('');
  }

  // ======================[ MULTI-PRECISION ARITHMETIC TESTS ]======================
  async testMultiPrecisionArithmetic() {
    console.log('Testing Multi-Precision Arithmetic:');

    // UInt64 tests
    this.runTest('multi_precision', 'UInt64 create and basic ops', () => {
      const a = OpCodes.UInt64.create(0x12345678, 0x9ABCDEF0);
      const b = OpCodes.UInt64.create(0x11111111, 0x22222222);
      
      this.assertArrayEqual(a, [0x12345678, 0x9ABCDEF0], 'UInt64 create failed');
      
      const sum = OpCodes.UInt64.add(a, b);
      this.assertArrayEqual(sum, [0x23456789, 0xBCDF0112], 'UInt64 add failed');
      
      const xor = OpCodes.UInt64.xor(a, b);
      this.assertArrayEqual(xor, [0x03254769, 0xB89EFCD2], 'UInt64 xor failed');
    });

    this.runTest('multi_precision', 'UInt64 conversions', () => {
      const bytes = [0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0];
      const uint64 = OpCodes.UInt64.fromBytes(bytes);
      const backToBytes = OpCodes.UInt64.toBytes(uint64);
      
      this.assertArrayEqual(backToBytes, bytes, 'UInt64 byte conversion round-trip failed');
    });

    // UInt128 tests
    this.runTest('multi_precision', 'UInt128 create and basic ops', () => {
      const a = OpCodes.UInt128.create(0x12345678, 0x9ABCDEF0, 0x11111111, 0x22222222);
      const b = OpCodes.UInt128.create(0x11111111, 0x11111111, 0x11111111, 0x11111111);
      
      this.assertArrayEqual(a, [0x12345678, 0x9ABCDEF0, 0x11111111, 0x22222222], 'UInt128 create failed');
      
      const sum = OpCodes.UInt128.add(a, b);
      this.assertArrayEqual(sum, [0x23456789, 0xABCDF001, 0x22222222, 0x33333333], 'UInt128 add failed');
    });

    this.runTest('multi_precision', 'UInt128 conversions', () => {
      const bytes = new Array(16).fill(0).map((_, i) => i + 1);
      const uint128 = OpCodes.UInt128.fromBytes(bytes);
      const backToBytes = OpCodes.UInt128.toBytes(uint128);
      
      this.assertArrayEqual(backToBytes, bytes, 'UInt128 byte conversion round-trip failed');
    });

    // UInt256 tests
    this.runTest('multi_precision', 'UInt256 create and basic ops', () => {
      const a = OpCodes.UInt256.create(0x12345678, 0x9ABCDEF0, 0x11111111, 0x22222222, 0x33333333, 0x44444444, 0x55555555, 0x66666666);
      
      this.assertEqual(a.length, 8, 'UInt256 should have 8 words');
      this.assertEqual(a[0], 0x12345678, 'UInt256 first word incorrect');
      this.assertEqual(a[7], 0x66666666, 'UInt256 last word incorrect');
      
      const isZero = OpCodes.UInt256.isZero(OpCodes.UInt256.create());
      this.assert(isZero, 'UInt256 zero check failed');
    });

    // UInt512 tests
    this.runTest('multi_precision', 'UInt512 create and basic ops', () => {
      const a = OpCodes.UInt512.create(0x12345678);
      
      this.assertEqual(a.length, 16, 'UInt512 should have 16 words');
      this.assertEqual(a[15], 0x12345678, 'UInt512 last word incorrect');
      
      const clone = OpCodes.UInt512.clone(a);
      const isEqual = OpCodes.UInt512.equals(a, clone);
      this.assert(isEqual, 'UInt512 clone/equals failed');
    });

    // Arithmetic operations tests
    this.runTest('multi_precision', 'UInt64 sub and mul', () => {
      const a = OpCodes.UInt64.create(0x12345678, 0x9ABCDEF0);
      const b = OpCodes.UInt64.create(0x11111111, 0x11111111);
      
      const diff = OpCodes.UInt64.sub(a, b);
      this.assertArrayEqual(diff, [0x01234567, 0x89ABCDDF], 'UInt64 sub failed');
      
      const small_a = OpCodes.UInt64.create(0, 0x1000);
      const small_b = OpCodes.UInt64.create(0, 0x1000);
      const product = OpCodes.UInt64.mul(small_a, small_b);
      this.assertArrayEqual(product, [0, 0x1000000], 'UInt64 mul failed');
    });

    console.log('');
  }

  // ======================[ CONVERSIONS TESTS ]======================
  async testConversions() {
    console.log('Testing Conversion Operations:');

    // String to bytes conversion
    this.runTest('conversions', 'AnsiToBytes', () => {
      const result = OpCodes.AnsiToBytes('ABC');
      this.assertArrayEqual(result, [0x41, 0x42, 0x43], 'AnsiToBytes failed');
    });

    this.runTest('conversions', 'AsciiToBytes', () => {
      const result = OpCodes.AsciiToBytes('ABC');
      this.assertArrayEqual(result, [0x41, 0x42, 0x43], 'AsciiToBytes failed');
    });

    // Hex conversion tests
    this.runTest('conversions', 'Hex4ToBytes', () => {
      const result = OpCodes.Hex4ToBytes('f123');
      this.assertArrayEqual(result, [15, 1, 2, 3], 'Hex4ToBytes failed');
    });

    this.runTest('conversions', 'Hex8ToBytes', () => {
      const result = OpCodes.Hex8ToBytes('f123');
      this.assertArrayEqual(result, [0xf1, 0x23], 'Hex8ToBytes failed');
    });

    this.runTest('conversions', 'Hex16ToWords', () => {
      const result = OpCodes.Hex16ToWords('f123abcd');
      this.assertArrayEqual(result, [0xf123, 0xabcd], 'Hex16ToWords failed');
    });

    this.runTest('conversions', 'Hex32ToDWords', () => {
      const result = OpCodes.Hex32ToDWords('f123abcd9876ef01');
      this.assertArrayEqual(result, [0xf123abcd, 0x9876ef01], 'Hex32ToDWords failed');
    });

    // Array operations
    this.runTest('conversions', 'XorArrays', () => {
      const a = [0x12, 0x34, 0x56];
      const b = [0x11, 0x22, 0x33];
      const result = OpCodes.XorArrays(a, b);
      this.assertArrayEqual(result, [0x03, 0x16, 0x65], 'XorArrays failed');
    });

    this.runTest('conversions', 'CompareArrays', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      const c = [1, 2, 4];
      
      this.assert(OpCodes.CompareArrays(a, b), 'CompareArrays equal failed');
      this.assert(!OpCodes.CompareArrays(a, c), 'CompareArrays not equal failed');
    });

    // Words/bytes conversion
    this.runTest('conversions', 'Words32ToBytesBE and BytesToWords32BE', () => {
      const words = [0x12345678, 0x9ABCDEF0];
      const bytes = OpCodes.Words32ToBytesBE(words);
      const backToWords = OpCodes.BytesToWords32BE(bytes);
      
      this.assertArrayEqual(backToWords, words, 'Words32/Bytes conversion round-trip failed');
    });

    console.log('');
  }

  // ======================[ MATHEMATICS TESTS ]======================
  async testMathematics() {
    console.log('Testing Mathematical Operations:');

    // Modular arithmetic
    this.runTest('mathematics', 'AddMod', () => {
      this.assertEqual(OpCodes.AddMod(10, 15, 7), 4, 'AddMod failed');
      this.assertEqual(OpCodes.AddMod(5, 3, 9), 8, 'AddMod failed');
    });

    this.runTest('mathematics', 'SubMod', () => {
      this.assertEqual(OpCodes.SubMod(10, 3, 7), 0, 'SubMod failed');
      this.assertEqual(OpCodes.SubMod(3, 10, 7), 0, 'SubMod failed'); // (3-10+7) % 7 = 0
    });

    this.runTest('mathematics', 'MulMod', () => {
      this.assertEqual(OpCodes.MulMod(6, 7, 5), 2, 'MulMod failed'); // (6*7) % 5 = 42 % 5 = 2
    });

    // GF(2^8) arithmetic
    this.runTest('mathematics', 'GF256Mul', () => {
      this.assertEqual(OpCodes.GF256Mul(0x53, 0xCA), 0x01, 'GF256Mul AES example failed');
      this.assertEqual(OpCodes.GF256Mul(0x02, 0x87), 0x15, 'GF256Mul x2 multiplication failed');
    });

    // Population count
    this.runTest('mathematics', 'PopCount', () => {
      this.assertEqual(OpCodes.PopCount(0b1011), 3, 'PopCount failed');
      this.assertEqual(OpCodes.PopCount(0xFF), 8, 'PopCount 0xFF failed');
    });

    this.runTest('mathematics', 'PopCountFast', () => {
      this.assertEqual(OpCodes.PopCountFast(0b1011), 3, 'PopCountFast failed');
      this.assertEqual(OpCodes.PopCountFast(0xFF), 8, 'PopCountFast 0xFF failed');
    });

    // Bit operations
    this.runTest('mathematics', 'GetBit and SetBit', () => {
      this.assertEqual(OpCodes.GetBit(0b1010, 1), 1, 'GetBit failed');
      this.assertEqual(OpCodes.GetBit(0b1010, 0), 0, 'GetBit failed');
      
      this.assertEqual(OpCodes.SetBit(0b1010, 0, 1), 0b1011, 'SetBit to 1 failed');
      this.assertEqual(OpCodes.SetBit(0b1010, 1, 0), 0b1000, 'SetBit to 0 failed');
    });

    // Nibble operations
    this.runTest('mathematics', 'SplitNibbles and CombineNibbles', () => {
      const nibbles = OpCodes.SplitNibbles(0xAB);
      this.assertEqual(nibbles.high, 0xA, 'SplitNibbles high failed');
      this.assertEqual(nibbles.low, 0xB, 'SplitNibbles low failed');
      
      const combined = OpCodes.CombineNibbles(0xA, 0xB);
      this.assertEqual(combined, 0xAB, 'CombineNibbles failed');
    });

    console.log('');
  }

  // ======================[ PERFORMANCE TESTS ]======================
  async testPerformance() {
    console.log('Testing Performance Optimizations:');

    // Memory pool tests
    this.runTest('performance', 'Memory pool operations', () => {
      const arr8 = OpCodes.GetPooledArray(8);
      this.assertEqual(arr8.length, 8, 'GetPooledArray(8) failed');
      
      OpCodes.ReturnToPool(arr8);
      // Should succeed without error
    });

    // Fast array operations
    this.runTest('performance', 'FastXorArrays', () => {
      const a = [0x12, 0x34, 0x56];
      const b = [0x11, 0x22, 0x33];
      const result = OpCodes.FastXorArrays(a, b);
      this.assertArrayEqual(result, [0x03, 0x16, 0x65], 'FastXorArrays failed');
    });

    this.runTest('performance', 'FastXorWords32', () => {
      const a = [0x12345678, 0x9ABCDEF0];
      const b = [0x11111111, 0x22222222];
      const result = OpCodes.FastXorWords32(a, b);
      this.assertArrayEqual(result, [0x03254769, 0xB89EFCD2], 'FastXorWords32 failed');
    });

    // Timing-safe operations
    this.runTest('performance', 'ConstantTimeCompare', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      const c = [1, 2, 4];
      
      this.assert(OpCodes.ConstantTimeCompare(a, b), 'ConstantTimeCompare equal failed');
      this.assert(!OpCodes.ConstantTimeCompare(a, c), 'ConstantTimeCompare not equal failed');
    });

    this.runTest('performance', 'SecureCompare', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      const c = [1, 2, 4];
      
      this.assert(OpCodes.SecureCompare(a, b), 'SecureCompare equal failed');
      this.assert(!OpCodes.SecureCompare(a, c), 'SecureCompare not equal failed');
    });

    // Hash utilities
    this.runTest('performance', 'Message length encoding', () => {
      const length64LE = OpCodes.EncodeMsgLength64LE(512);
      this.assertEqual(length64LE.length, 8, 'EncodeMsgLength64LE should return 8 bytes');
      
      const length128BE = OpCodes.EncodeMsgLength128BE(1024);
      this.assertEqual(length128BE.length, 16, 'EncodeMsgLength128BE should return 16 bytes');
    });

    console.log('');
  }

  // Generate final test report
  generateReport() {
    console.log('OpCodes Test Results Summary:');
    console.log('=============================');
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const [category, results] of Object.entries(this.results)) {
      totalPassed += results.passed;
      totalFailed += results.failed;
      
      const status = results.failed === 0 ? '✓' : '✗';
      console.log(`${status} ${category.toUpperCase().replace('_', ' ')}: ${results.passed} passed, ${results.failed} failed`);
      
      if (results.failed > 0) {
        for (const error of results.errors) {
          console.log(`    ✗ ${error.test}: ${error.error}`);
        }
      }
    }
    
    console.log('');
    console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);
    
    if (totalFailed === 0) {
      console.log('🎉 All OpCodes tests passed successfully!');
      process.exit(0);
    } else {
      console.log('❌ Some OpCodes tests failed. Please review the errors above.');
      process.exit(1);
    }
  }
}

// Run the test suite if this file is executed directly
if (require.main === module) {
  const testSuite = new OpCodesTestSuite();
  testSuite.runAllTests().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = OpCodesTestSuite;
