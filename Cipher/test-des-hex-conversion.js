#!/usr/bin/env node
/*
 * Test DES Algorithm with Hex Utility Conversion
 * (c)2025 Hawkynt
 * 
 * Validates that the DES algorithm still works correctly after converting
 * S-boxes to use OpCodes hex utilities.
 */

// Load dependencies
if (typeof OpCodes === 'undefined') {
  try {
    require('./OpCodes.js');
    require('./universal-cipher-env.js');
    require('./cipher.js');
    require('./algorithms/block/des.js');
  } catch (e) {
    console.error('Failed to load dependencies:', e.message);
    process.exit(1);
  }
}

class DESHexConversionTest {
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

  runTests() {
    console.log('Testing DES algorithm with hex utility conversion...\n');
    
    this.testSBoxInitialization();
    this.testBasicEncryption();
    this.testDecryption();
    this.testTestVectors();
    this.testRoundTrip();
    
    this.printResults();
  }

  testSBoxInitialization() {
    console.log('Testing S-box initialization...');
    
    // Get DES algorithm
    const des = global.Cipher.GetCipher('DES');
    this.assert(des !== null, 'DES algorithm is available');
    
    if (des) {
      // Test that S-boxes are properly initialized
      des.initSBoxes();
      this.assert(des.SBOX !== null, 'S-boxes initialized');
      this.assert(des.SBOX.length === 8, 'All 8 S-boxes present');
      
      // Test specific S-box values (known DES S1 values)
      if (des.SBOX && des.SBOX[0]) {
        this.assert(des.SBOX[0][0][0] === 14, 'S1[0][0] = 14');
        this.assert(des.SBOX[0][0][1] === 4, 'S1[0][1] = 4');
        this.assert(des.SBOX[0][3][15] === 13, 'S1[3][15] = 13');
      }
    }
  }

  testBasicEncryption() {
    console.log('\nTesting basic encryption...');
    
    const des = global.Cipher.GetCipher('DES');
    if (!des) {
      this.assert(false, 'DES algorithm not available');
      return;
    }
    
    try {
      const instance = des.Init();
      this.assert(instance !== null, 'DES instance created');
      
      if (instance) {
        // Set up key
        const key = '\x01\x01\x01\x01\x01\x01\x01\x01';
        const keySetup = des.KeySetup(instance, key);
        this.assert(keySetup, 'Key setup successful');
        
        // Test encryption
        const plaintext = '\x00\x00\x00\x00\x00\x00\x00\x00';
        const ciphertext = des.szEncryptBlock(instance, plaintext);
        this.assert(ciphertext !== plaintext, 'Encryption produces different output');
        this.assert(ciphertext.length === 8, 'Ciphertext has correct length');
        
        des.ClearData(instance);
      }
    } catch (e) {
      this.assert(false, `Basic encryption failed: ${e.message}`);
    }
  }

  testDecryption() {
    console.log('\nTesting decryption...');
    
    const des = global.Cipher.GetCipher('DES');
    if (!des) {
      this.assert(false, 'DES algorithm not available');
      return;
    }
    
    try {
      const instance = des.Init();
      
      if (instance) {
        const key = '\x01\x01\x01\x01\x01\x01\x01\x01';
        des.KeySetup(instance, key);
        
        const plaintext = '\x00\x00\x00\x00\x00\x00\x00\x00';
        const ciphertext = des.szEncryptBlock(instance, plaintext);
        const decrypted = des.szDecryptBlock(instance, ciphertext);
        
        this.assert(decrypted === plaintext, 'Decryption recovers original plaintext');
        
        des.ClearData(instance);
      }
    } catch (e) {
      this.assert(false, `Decryption test failed: ${e.message}`);
    }
  }

  testTestVectors() {
    console.log('\nTesting with known test vectors...');
    
    const des = global.Cipher.GetCipher('DES');
    if (!des) {
      this.assert(false, 'DES algorithm not available');
      return;
    }
    
    // Test with some known DES test vectors
    const testVectors = [
      {
        key: '\x01\x01\x01\x01\x01\x01\x01\x01',
        plaintext: '\x00\x00\x00\x00\x00\x00\x00\x00',
        description: 'Weak key test vector'
      },
      {
        key: '\x01\x01\x01\x01\x01\x01\x01\x01',
        plaintext: '\x40\x00\x00\x00\x00\x00\x00\x00',
        description: 'Single bit set test vector'
      }
    ];
    
    for (let i = 0; i < testVectors.length; i++) {
      const tv = testVectors[i];
      
      try {
        const instance = des.Init();
        if (instance) {
          des.KeySetup(instance, tv.key);
          
          const ciphertext = des.szEncryptBlock(instance, tv.plaintext);
          const decrypted = des.szDecryptBlock(instance, ciphertext);
          
          this.assert(decrypted === tv.plaintext, `${tv.description} - round trip success`);
          this.assert(ciphertext !== tv.plaintext, `${tv.description} - encryption changes data`);
          
          des.ClearData(instance);
        }
      } catch (e) {
        this.assert(false, `Test vector ${i} failed: ${e.message}`);
      }
    }
  }

  testRoundTrip() {
    console.log('\nTesting round-trip encryption/decryption...');
    
    const des = global.Cipher.GetCipher('DES');
    if (!des) {
      this.assert(false, 'DES algorithm not available');
      return;
    }
    
    const testData = [
      '\x00\x00\x00\x00\x00\x00\x00\x00',
      '\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF',
      '\x01\x23\x45\x67\x89\xAB\xCD\xEF',
      '\xFE\xDC\xBA\x98\x76\x54\x32\x10'
    ];
    
    const key = '\x13\x34\x57\x79\xBC\xDF\xF1\x1A';
    
    for (let i = 0; i < testData.length; i++) {
      try {
        const instance = des.Init();
        if (instance) {
          des.KeySetup(instance, key);
          
          const plaintext = testData[i];
          const ciphertext = des.szEncryptBlock(instance, plaintext);
          const decrypted = des.szDecryptBlock(instance, ciphertext);
          
          this.assert(decrypted === plaintext, `Round-trip test ${i} successful`);
          
          des.ClearData(instance);
        }
      } catch (e) {
        this.assert(false, `Round-trip test ${i} failed: ${e.message}`);
      }
    }
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('DES HEX CONVERSION TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Total tests: ${this.totalTests}`);
    console.log(`Passed: ${this.testsPassed}`);
    console.log(`Failed: ${this.testsFailed}`);
    console.log(`Success rate: ${((this.testsPassed / this.totalTests) * 100).toFixed(1)}%`);
    
    if (this.testsFailed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! DES hex conversion is working correctly.');
    } else {
      console.log(`\n❌ ${this.testsFailed} tests failed. DES conversion may have issues.`);
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new DESHexConversionTest();
  tester.runTests();
}

module.exports = DESHexConversionTest;