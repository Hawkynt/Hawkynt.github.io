#!/usr/bin/env node
/*
 * OpCodes Test Suite
 * Verifies functionality of the universal cryptographic operations library
 */

// Load OpCodes library
const OpCodes = require('./OpCodes.js');

console.log('=== OpCodes.js Test Suite ===\n');

let testCount = 0;
let passCount = 0;

function test(name, actual, expected, description) {
  testCount++;
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  if (passed) {
    passCount++;
    console.log(`✓ ${name}: ${description}`);
  } else {
    console.log(`✗ ${name}: ${description}`);
    console.log(`  Expected: ${JSON.stringify(expected)}`);
    console.log(`  Actual:   ${JSON.stringify(actual)}`);
  }
}

// ========================[ BIT MANIPULATION TESTS ]========================
console.log('--- Bit Manipulation Tests ---');

test('RotL8', OpCodes.RotL8(0x80, 1), 0x01, 'Rotate 0x80 left by 1 position');
test('RotR8', OpCodes.RotR8(0x01, 1), 0x80, 'Rotate 0x01 right by 1 position');
test('RotL16', OpCodes.RotL16(0x8000, 1), 0x0001, 'Rotate 0x8000 left by 1 position');
test('RotR16', OpCodes.RotR16(0x0001, 1), 0x8000, 'Rotate 0x0001 right by 1 position');
test('RotL32', OpCodes.RotL32(0x80000000, 1), 0x00000001, 'Rotate 0x80000000 left by 1 position');
test('RotR32', OpCodes.RotR32(0x00000001, 1), 0x80000000, 'Rotate 0x00000001 right by 1 position');

// ========================[ BYTE/WORD OPERATIONS TESTS ]========================
console.log('\n--- Byte/Word Operations Tests ---');

test('Pack32BE', OpCodes.Pack32BE(0x12, 0x34, 0x56, 0x78), 0x12345678, 'Pack bytes into 32-bit word (big-endian)');
test('Pack32LE', OpCodes.Pack32LE(0x78, 0x56, 0x34, 0x12), 0x12345678, 'Pack bytes into 32-bit word (little-endian)');
test('Unpack32BE', OpCodes.Unpack32BE(0x12345678), [0x12, 0x34, 0x56, 0x78], 'Unpack 32-bit word to bytes (big-endian)');
test('Unpack32LE', OpCodes.Unpack32LE(0x12345678), [0x78, 0x56, 0x34, 0x12], 'Unpack 32-bit word to bytes (little-endian)');
test('GetByte', OpCodes.GetByte(0x12345678, 2), 0x34, 'Extract byte 2 from 32-bit word');
test('SetByte', OpCodes.SetByte(0x12345678, 1, 0xFF), 0x1234FF78, 'Set byte 1 in 32-bit word');

// ========================[ STRING/BYTE CONVERSION TESTS ]========================
console.log('\n--- String/Byte Conversion Tests ---');

test('StringToBytes', OpCodes.StringToBytes('ABC'), [0x41, 0x42, 0x43], 'Convert string to byte array');
test('BytesToString', OpCodes.BytesToString([0x41, 0x42, 0x43]), 'ABC', 'Convert byte array to string');
test('StringToWords32BE', OpCodes.StringToWords32BE('ABCD'), [0x41424344], 'Convert string to 32-bit words (big-endian)');
test('Words32BEToString', OpCodes.Words32BEToString([0x41424344]), 'ABCD', 'Convert 32-bit words to string (big-endian)');

// ========================[ HEX UTILITIES TESTS ]========================
console.log('\n--- Hex Utilities Tests ---');

test('ByteToHex', OpCodes.ByteToHex(0x41), '41', 'Convert byte to hex string');
test('HexToByte', OpCodes.HexToByte('41'), 0x41, 'Convert hex string to byte');
test('StringToHex', OpCodes.StringToHex('ABC'), '414243', 'Convert string to hex');
test('HexToString', OpCodes.HexToString('414243'), 'ABC', 'Convert hex to string');

// ========================[ ARRAY OPERATIONS TESTS ]========================
console.log('\n--- Array Operations Tests ---');

test('XorArrays', OpCodes.XorArrays([0x11, 0x22, 0x33], [0x44, 0x55, 0x66]), [0x55, 0x77, 0x55], 'XOR two byte arrays');
test('CopyArray', OpCodes.CopyArray([1, 2, 3]), [1, 2, 3], 'Copy array');
test('CompareArrays true', OpCodes.CompareArrays([1, 2, 3], [1, 2, 3]), true, 'Compare equal arrays');
test('CompareArrays false', OpCodes.CompareArrays([1, 2, 3], [1, 2, 4]), false, 'Compare different arrays');

// ========================[ MATHEMATICAL OPERATIONS TESTS ]========================
console.log('\n--- Mathematical Operations Tests ---');

test('AddMod', OpCodes.AddMod(15, 8, 10), 3, 'Modular addition: (15 + 8) mod 10');
test('SubMod', OpCodes.SubMod(5, 8, 10), 7, 'Modular subtraction: (5 - 8) mod 10');
test('MulMod', OpCodes.MulMod(7, 8, 10), 6, 'Modular multiplication: (7 * 8) mod 10');

// GF(2^8) multiplication tests (important for AES)
test('GF256Mul x02', OpCodes.GF256Mul(0x53, 0x02), 0xA6, 'GF(2^8) multiplication: 0x53 * 0x02');
test('GF256Mul x03', OpCodes.GF256Mul(0x53, 0x03), 0xF5, 'GF(2^8) multiplication: 0x53 * 0x03');

// ========================[ UTILITY FUNCTIONS TESTS ]========================
console.log('\n--- Utility Functions Tests ---');

test('PKCS7Padding', OpCodes.PKCS7Padding(8, 5), [3, 3, 3], 'PKCS#7 padding for block size 8, data length 5');
test('RemovePKCS7Padding', OpCodes.RemovePKCS7Padding([1, 2, 3, 3, 3]), [1, 2], 'Remove PKCS#7 padding');
test('SecureCompare true', OpCodes.SecureCompare([1, 2, 3], [1, 2, 3]), true, 'Secure compare equal arrays');
test('SecureCompare false', OpCodes.SecureCompare([1, 2, 3], [1, 2, 4]), false, 'Secure compare different arrays');

// ========================[ PERFORMANCE TEST ]========================
console.log('\n--- Performance Test ---');

const iterations = 100000;
const testData = 0x12345678;
const start = Date.now();

for (let i = 0; i < iterations; i++) {
  OpCodes.RotL32(testData, 1);
  OpCodes.Pack32BE(0x12, 0x34, 0x56, 0x78);
  OpCodes.GF256Mul(0x53, 0x02);
}

const elapsed = Date.now() - start;
console.log(`✓ Performance: ${iterations} operations in ${elapsed}ms (${Math.round(iterations/elapsed*1000)} ops/sec)`);

// ========================[ SUMMARY ]========================
console.log('\n=== Test Summary ===');
console.log(`Total Tests: ${testCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${testCount - passCount}`);
console.log(`Success Rate: ${Math.round(passCount/testCount*100)}%`);

if (passCount === testCount) {
  console.log('\n🎉 All tests passed! OpCodes.js is ready for use.');
} else {
  console.log('\n❌ Some tests failed. Please review the implementation.');
  process.exit(1);
}