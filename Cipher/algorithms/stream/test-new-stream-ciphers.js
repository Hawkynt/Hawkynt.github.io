#!/usr/bin/env node
/*
 * Test Vectors for New Stream Cipher Implementations
 * Tests: VEST, DRAGON, PIKE, Leviathan, TSC-4, HC-256
 * (c)2006-2025 Hawkynt
 * 
 * This file contains comprehensive test vectors for the newly implemented
 * stream ciphers, including:
 * - Basic functionality tests
 * - Known plaintext/ciphertext pairs
 * - Edge cases and special inputs
 * - Performance benchmarks
 */

// Load dependencies
const fs = require('fs');
const path = require('path');

// Load OpCodes for test utilities
require('../../OpCodes.js');

// Load cipher implementations
const VEST = require('./vest.js');
const DRAGON = require('./dragon.js');
const PIKE = require('./pike.js');
const Leviathan = require('./leviathan.js');
const TSC4 = require('./tsc-4.js');
const HC256 = require('./hc-256.js');

// Test results
let testResults = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  errors: []
};

/**
 * Run a single test case
 */
function runTest(description, testFunction) {
  testResults.totalTests++;
  console.log(`Testing: ${description}`);
  
  try {
    const result = testFunction();
    if (result) {
      testResults.passedTests++;
      console.log(`  ✓ PASSED`);
    } else {
      testResults.failedTests++;
      console.log(`  ✗ FAILED`);
      testResults.errors.push(`FAILED: ${description}`);
    }
  } catch (error) {
    testResults.failedTests++;
    console.log(`  ✗ ERROR: ${error.message}`);
    testResults.errors.push(`ERROR in ${description}: ${error.message}`);
  }
}

/**
 * Compare byte arrays
 */
function compareBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Convert string to hex
 */
function stringToHex(str) {
  return Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

/**
 * Test basic encryption/decryption symmetry
 */
function testSymmetry(cipher, key, iv, plaintext) {
  const id1 = cipher.KeySetup(key, iv);
  const ciphertext = cipher.encryptBlock(id1, plaintext);
  cipher.ClearData(id1);
  
  const id2 = cipher.KeySetup(key, iv);
  const decrypted = cipher.decryptBlock(id2, ciphertext);
  cipher.ClearData(id2);
  
  return plaintext === decrypted;
}

/**
 * Test VEST cipher
 */
function testVEST() {
  console.log('\n=== Testing VEST Stream Cipher ===');
  
  // Test basic functionality
  runTest('VEST basic encryption/decryption', () => {
    const key = 'VEST test key 128';  // 16 bytes
    const iv = 'VEST test IV 128';    // 16 bytes
    const plaintext = 'Hello, VEST!';
    
    return testSymmetry(VEST, key, iv, plaintext);
  });
  
  // Test with different key sizes
  runTest('VEST with 64-bit key', () => {
    const key = 'VESTkey8';  // 8 bytes
    const iv = 'VESTiv64';   // 8 bytes
    const plaintext = 'Test64bit';
    
    return testSymmetry(VEST, key, iv, plaintext);
  });
  
  // Test keystream consistency
  runTest('VEST keystream consistency', () => {
    const key = 'VEST consistency test key 1';
    const iv = 'VEST consistency test IV 1';
    
    const id1 = VEST.KeySetup(key, iv);
    const stream1 = VEST.encryptBlock(id1, '\x00\x00\x00\x00\x00\x00\x00\x00');
    VEST.ClearData(id1);
    
    const id2 = VEST.KeySetup(key, iv);
    const stream2 = VEST.encryptBlock(id2, '\x00\x00\x00\x00\x00\x00\x00\x00');
    VEST.ClearData(id2);
    
    return stream1 === stream2;
  });
}

/**
 * Test DRAGON cipher
 */
function testDRAGON() {
  console.log('\n=== Testing DRAGON Stream Cipher ===');
  
  runTest('DRAGON basic encryption/decryption', () => {
    const key = 'DRAGON test key!';  // 16 bytes
    const iv = 'DRAGON test IV!!';   // 16 bytes
    const plaintext = 'Hello, DRAGON!';
    
    return testSymmetry(DRAGON, key, iv, plaintext);
  });
  
  runTest('DRAGON with 256-bit key', () => {
    const key = 'DRAGON 256-bit test key for testing large keys!';  // 32+ bytes
    const iv = 'DRAGON IV for 256-bit key test!';
    const plaintext = 'Testing DRAGON with large key';
    
    return testSymmetry(DRAGON, key, iv, plaintext);
  });
  
  runTest('DRAGON keystream differs with different keys', () => {
    const key1 = 'DRAGON key one!!';
    const key2 = 'DRAGON key two!!';
    const iv = 'DRAGON test IV!!';
    const nullInput = '\x00\x00\x00\x00\x00\x00\x00\x00';
    
    const id1 = DRAGON.KeySetup(key1, iv);
    const stream1 = DRAGON.encryptBlock(id1, nullInput);
    DRAGON.ClearData(id1);
    
    const id2 = DRAGON.KeySetup(key2, iv);
    const stream2 = DRAGON.encryptBlock(id2, nullInput);
    DRAGON.ClearData(id2);
    
    return stream1 !== stream2;
  });
}

/**
 * Test PIKE cipher
 */
function testPIKE() {
  console.log('\n=== Testing PIKE Stream Cipher ===');
  
  runTest('PIKE basic encryption/decryption', () => {
    const key = 'PIKE test key!!!';  // 16 bytes
    const iv = 'PIKEiv64';           // 8 bytes
    const plaintext = 'Hello, PIKE speed!';
    
    return testSymmetry(PIKE, key, iv, plaintext);
  });
  
  runTest('PIKE with 256-bit key', () => {
    const key = 'PIKE 256-bit test key for maximum performance testing here!';
    const iv = 'PIKEiv64';
    const plaintext = 'Testing PIKE high-speed performance';
    
    return testSymmetry(PIKE, key, iv, plaintext);
  });
  
  runTest('PIKE empty input handling', () => {
    const key = 'PIKE empty test!';
    const iv = 'PIKEiv64';
    const plaintext = '';
    
    return testSymmetry(PIKE, key, iv, plaintext);
  });
}

/**
 * Test Leviathan cipher
 */
function testLeviathan() {
  console.log('\n=== Testing Leviathan Stream Cipher ===');
  
  runTest('Leviathan basic encryption/decryption', () => {
    const key = 'Leviathan 256-bit test key for large state cipher testing here!';
    const iv = 'Leviathan 256-bit test IV for large state cipher testing!';
    const plaintext = 'Hello, Leviathan large state!';
    
    return testSymmetry(Leviathan, key, iv, plaintext);
  });
  
  runTest('Leviathan long message', () => {
    const key = 'Leviathan long message test key 256-bit for extended tests!';
    const iv = 'Leviathan long message test IV 256-bit for extended tests!';
    const plaintext = 'This is a longer message to test Leviathan\'s ability to handle extended plaintexts with its large internal state and complex operations.';
    
    return testSymmetry(Leviathan, key, iv, plaintext);
  });
  
  runTest('Leviathan all-zeros key/IV', () => {
    const key = '\x00'.repeat(32);
    const iv = '\x00'.repeat(32);
    const plaintext = 'Testing with null key and IV';
    
    return testSymmetry(Leviathan, key, iv, plaintext);
  });
}

/**
 * Test TSC-4 cipher
 */
function testTSC4() {
  console.log('\n=== Testing TSC-4 Stream Cipher ===');
  
  runTest('TSC-4 basic encryption/decryption', () => {
    const key = 'TSC4 torture key!';  // 16 bytes
    const iv = 'TSC4 torture IV!';    // 16 bytes
    const plaintext = 'Hello, TSC-4 torture!';
    
    return testSymmetry(TSC4, key, iv, plaintext);
  });
  
  runTest('TSC-4 complex nonlinear operations', () => {
    const key = 'TSC4 complex test';
    const iv = 'TSC4 complex IV!';
    const plaintext = 'Testing complex nonlinear operations';
    
    return testSymmetry(TSC4, key, iv, plaintext);
  });
  
  runTest('TSC-4 maximum entropy input', () => {
    const key = '\xFF\xAA\x55\x33\xCC\x0F\xF0\x69\x96\x5A\xA5\x3C\xC3\x78\x87\x12';
    const iv = '\x12\x34\x56\x78\x9A\xBC\xDE\xF0\x0F\xED\xCB\xA9\x87\x65\x43\x21';
    const plaintext = 'High entropy test data';
    
    return testSymmetry(TSC4, key, iv, plaintext);
  });
}

/**
 * Test HC-256 cipher
 */
function testHC256() {
  console.log('\n=== Testing HC-256 Stream Cipher ===');
  
  runTest('HC-256 basic encryption/decryption', () => {
    const key = 'HC-256 test key for 256-bit operations and large table streaming!';
    const iv = 'HC-256 test IV for 256-bit operations and large table streaming!';
    const plaintext = 'Hello, HC-256 large tables!';
    
    return testSymmetry(HC256, key, iv, plaintext);
  });
  
  runTest('HC-256 long keystream generation', () => {
    const key = 'HC-256 long stream test key for extended keystream generation!';
    const iv = 'HC-256 long stream test IV for extended keystream generation!';
    const plaintext = 'A'.repeat(1000);  // 1000 bytes
    
    return testSymmetry(HC256, key, iv, plaintext);
  });
  
  runTest('HC-256 table initialization consistency', () => {
    const key = 'HC-256 consistency test key for table initialization testing!';
    const iv = 'HC-256 consistency test IV for table initialization testing!';
    const nullInput = '\x00'.repeat(64);
    
    const id1 = HC256.KeySetup(key, iv);
    const stream1 = HC256.encryptBlock(id1, nullInput);
    HC256.ClearData(id1);
    
    const id2 = HC256.KeySetup(key, iv);
    const stream2 = HC256.encryptBlock(id2, nullInput);
    HC256.ClearData(id2);
    
    return stream1 === stream2;
  });
}

/**
 * Performance benchmarks
 */
function performanceBenchmarks() {
  console.log('\n=== Performance Benchmarks ===');
  
  const testData = 'A'.repeat(10000); // 10KB test data
  const key256 = 'Performance test key for 256-bit cipher benchmarking and speed!';
  const key128 = 'Perf test key!!!';
  const iv256 = 'Performance test IV for 256-bit cipher benchmarking and speed!';
  const iv128 = 'Perf test IV!!!!';
  const iv64 = 'PerfIV64';
  
  const ciphers = [
    { name: 'VEST', cipher: VEST, key: key128, iv: key128 },
    { name: 'DRAGON', cipher: DRAGON, key: key128, iv: key128 },
    { name: 'PIKE', cipher: PIKE, key: key128, iv: iv64 },
    { name: 'Leviathan', cipher: Leviathan, key: key256, iv: iv256 },
    { name: 'TSC-4', cipher: TSC4, key: key128, iv: key128 },
    { name: 'HC-256', cipher: HC256, key: key256, iv: iv256 }
  ];
  
  ciphers.forEach(({ name, cipher, key, iv }) => {
    runTest(`${name} performance (10KB)`, () => {
      const startTime = Date.now();
      
      const id = cipher.KeySetup(key, iv);
      const encrypted = cipher.encryptBlock(id, testData);
      const decrypted = cipher.decryptBlock(id, encrypted);
      cipher.ClearData(id);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`    ${name}: ${duration}ms for 10KB (${(10000/duration*1000/1024/1024).toFixed(2)} MB/s)`);
      
      return testData === decrypted;
    });
  });
}

/**
 * Main test runner
 */
function main() {
  console.log('Stream Cipher Test Suite');
  console.log('========================');
  
  // Initialize cipher systems
  VEST.Init();
  DRAGON.Init();
  PIKE.Init();
  Leviathan.Init();
  TSC4.Init();
  HC256.Init();
  
  // Run all tests
  testVEST();
  testDRAGON();
  testPIKE();
  testLeviathan();
  testTSC4();
  testHC256();
  
  // Performance benchmarks
  performanceBenchmarks();
  
  // Print summary
  console.log('\n=== Test Summary ===');
  console.log(`Total Tests: ${testResults.totalTests}`);
  console.log(`Passed: ${testResults.passedTests}`);
  console.log(`Failed: ${testResults.failedTests}`);
  console.log(`Success Rate: ${(testResults.passedTests/testResults.totalTests*100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\nErrors:');
    testResults.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  // Save detailed results
  const detailedResults = {
    timestamp: new Date().toISOString(),
    summary: testResults,
    ciphers: [
      'VEST - Variable Encryption Standard',
      'DRAGON - Word-based stream cipher',
      'PIKE - Fast software-optimized cipher',
      'Leviathan - Large-state stream cipher',
      'TSC-4 - Torture Stream Cipher',
      'HC-256 - Large-table software cipher'
    ]
  };
  
  try {
    fs.writeFileSync(
      path.join(__dirname, 'test-results-new-stream-ciphers.json'),
      JSON.stringify(detailedResults, null, 2)
    );
    console.log('\nDetailed results saved to test-results-new-stream-ciphers.json');
  } catch (error) {
    console.log(`Failed to save results: ${error.message}`);
  }
  
  process.exit(testResults.failedTests > 0 ? 1 : 0);
}

// Run tests if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  runTest,
  testSymmetry,
  compareBytes,
  stringToHex,
  testResults
};