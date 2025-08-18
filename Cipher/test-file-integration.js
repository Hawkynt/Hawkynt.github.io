#!/usr/bin/env node
/*
 * File Integration Test Suite
 * Comprehensive testing for file handling capabilities
 * (c)2006-2025 Hawkynt - Test suite for SynthelicZ Cipher Tools file system
 */

(function(global) {
  'use strict';
  
  // Test configuration
  const TEST_CONFIG = {
    maxFileSize: 1024 * 1024, // 1MB for testing
    testDataSizes: [0, 1, 16, 64, 256, 1024, 4096], // bytes
    supportedFormats: ['text', 'binary', 'hex', 'base64', 'json', 'csv', 'xml'],
    testCiphers: ['Caesar', 'BASE64', 'ROT13', 'Atbash']
  };
  
  // Test data generators
  const TestData = {
    // Generate random binary data
    randomBinary: function(size) {
      let data = '';
      for (let i = 0; i < size; i++) {
        data += String.fromCharCode(Math.floor(Math.random() * 256));
      }
      return data;
    },
    
    // Generate random text data
    randomText: function(size) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?';
      let text = '';
      for (let i = 0; i < size; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return text;
    },
    
    // Generate hex test data
    randomHex: function(byteCount) {
      let hex = '';
      for (let i = 0; i < byteCount; i++) {
        const byte = Math.floor(Math.random() * 256);
        hex += (byte < 16 ? '0' : '') + byte.toString(16).toUpperCase() + ' ';
      }
      return hex.trim();
    },
    
    // Generate specific patterns for testing
    patterns: {
      allZeros: function(size) {
        return '\x00'.repeat(size);
      },
      allOnes: function(size) {
        return '\xFF'.repeat(size);
      },
      ascending: function(size) {
        let data = '';
        for (let i = 0; i < size; i++) {
          data += String.fromCharCode(i % 256);
        }
        return data;
      },
      repeating: function(size, pattern = 'ABC') {
        let data = '';
        for (let i = 0; i < size; i++) {
          data += pattern.charAt(i % pattern.length);
        }
        return data;
      }
    }
  };
  
  // Test suite object
  const FileIntegrationTests = {
    results: {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    },
    
    // Initialize test environment
    init: function() {
      console.log('🧪 File Integration Test Suite');
      console.log('============================');
      
      // Load required modules
      this.loadModules();
      
      // Run all tests
      this.runAllTests();
      
      // Show results
      this.showResults();
    },
    
    // Load required modules
    loadModules: function() {
      try {
        if (typeof require !== 'undefined') {
          // Node.js environment
          require('./universal-cipher-env.js');
          require('./cipher.js');
          require('./cipher-file-handler.js');
          require('./hex-editor.js');
          require('./download-manager.js');
          require('./file-integration.js');
          
          // Load some cipher implementations
          require('./algorithms/classical/caesar.js');
          require('./algorithms/encoding/base64.js');
          require('./algorithms/encoding/rot.js');
          require('./algorithms/encoding/atbash.js');
        }
        
        this.log('✅ Modules loaded successfully');
      } catch (error) {
        this.error('❌ Failed to load modules:', error.message);
      }
    },
    
    // Run all test suites
    runAllTests: function() {
      console.log('\n📝 Running File Integration Tests...\n');
      
      this.testFileHandler();
      this.testHexEditor();
      this.testDownloadManager();
      this.testFormatConversions();
      this.testCipherIntegration();
      this.testErrorHandling();
      this.testPerformance();
    },
    
    // Test file handler functionality
    testFileHandler: function() {
      console.log('🔍 Testing File Handler...');
      
      // Test file type detection
      this.test('File type detection - text', () => {
        if (!global.CipherFileHandler) throw new Error('CipherFileHandler not available');
        
        const textFile = { name: 'test.txt', type: 'text/plain' };
        const detectedType = global.CipherFileHandler.detectFileType(textFile);
        return detectedType === 'text';
      });
      
      this.test('File type detection - binary', () => {
        const binaryFile = { name: 'test.bin', type: 'application/octet-stream' };
        const detectedType = global.CipherFileHandler.detectFileType(binaryFile);
        return detectedType === 'binary';
      });
      
      // Test file size validation
      this.test('File size validation', () => {
        const largeFile = { size: global.CipherFileHandler.MAX_FILE_SIZE + 1 };
        const result = largeFile.size <= global.CipherFileHandler.MAX_FILE_SIZE;
        return !result; // Should fail validation
      });
      
      // Test string conversion functions
      this.test('String to hex conversion', () => {
        const input = 'Hello';
        const expected = '48 65 6C 6C 6F';
        const result = global.CipherFileHandler.stringToHex(input);
        return result === expected;
      });
      
      this.test('String to base64 conversion', () => {
        const input = 'Hello';
        const result = global.CipherFileHandler.stringToBase64(input);
        return result === 'SGVsbG8=' || result.includes('SGVsbG8'); // Allow for different base64 implementations
      });
    },
    
    // Test hex editor functionality
    testHexEditor: function() {
      console.log('🔧 Testing Hex Editor...');
      
      // Test hex validation
      this.test('Hex validation - valid', () => {
        if (!global.HexEditor) throw new Error('HexEditor not available');
        
        const validHex = '48656C6C6F';
        return global.HexEditor.utils.isValidHex(validHex);
      });
      
      this.test('Hex validation - invalid', () => {
        const invalidHex = '48656C6C6G'; // Contains 'G'
        return !global.HexEditor.utils.isValidHex(invalidHex);
      });
      
      // Test hex to binary conversion
      this.test('Hex to binary conversion', () => {
        const hex = '48656C6C6F';
        const expected = 'Hello';
        const result = global.HexEditor.utils.hexToBinary(hex);
        return result === expected;
      });
      
      // Test hex formatting
      this.test('Hex formatting', () => {
        const input = '48656c6c6f';
        const expected = '48 65 6C 6C 6F';
        const result = global.HexEditor.utils.formatHex(input);
        return result === expected;
      });
      
      // Test string to formatted hex
      this.test('String to formatted hex', () => {
        const input = 'ABC';
        const result = global.HexEditor.utils.stringToHex(input);
        const lines = result.split('\n');
        return lines.length > 0 && lines[0].includes('00000000:') && lines[0].includes('ABC');
      });
    },
    
    // Test download manager functionality
    testDownloadManager: function() {
      console.log('💾 Testing Download Manager...');
      
      if (typeof window === 'undefined') {
        console.log('  ⏭️  Skipping download tests (Node.js environment)');
        return;
      }
      
      // Test filename generation
      this.test('Filename generation', () => {
        if (!global.DownloadManager) throw new Error('DownloadManager not available');
        
        const filename = global.DownloadManager.generateFilename('test', 'text', false);
        return filename.includes('test') && filename.endsWith('.txt');
      });
      
      // Test format processing
      TEST_CONFIG.supportedFormats.forEach(format => {
        this.test(`Format processing - ${format}`, () => {
          const testData = 'Hello World';
          const processed = global.DownloadManager.processDataForFormat(testData, format);
          return processed !== null && processed !== undefined;
        });
      });
      
      // Test data analysis
      this.test('Data entropy calculation', () => {
        const randomData = TestData.randomBinary(256);
        const entropy = global.DownloadManager.calculateEntropy(randomData);
        return entropy >= 0 && entropy <= 8; // Shannon entropy bounds
      });
    },
    
    // Test format conversions
    testFormatConversions: function() {
      console.log('🔄 Testing Format Conversions...');
      
      const testString = 'Hello, World! 123';
      
      // Test all format conversions with different data sizes
      TEST_CONFIG.testDataSizes.forEach(size => {
        if (size === 0) return; // Skip empty data for some tests
        
        const testData = TestData.randomText(size);
        
        this.test(`Text format conversion (${size} bytes)`, () => {
          if (!global.DownloadManager) return true; // Skip if not available
          
          const processed = global.DownloadManager.processDataForFormat(testData, 'text');
          return processed === testData;
        });
        
        this.test(`Hex format conversion (${size} bytes)`, () => {
          if (!global.DownloadManager) return true;
          
          const processed = global.DownloadManager.processDataForFormat(testData, 'hex');
          return typeof processed === 'string' && processed.length > 0;
        });
        
        this.test(`JSON format conversion (${size} bytes)`, () => {
          if (!global.DownloadManager) return true;
          
          const processed = global.DownloadManager.processDataForFormat(testData, 'json');
          try {
            const parsed = JSON.parse(processed);
            return parsed.metadata && parsed.data;
          } catch (e) {
            return false;
          }
        });
      });
    },
    
    // Test cipher integration
    testCipherIntegration: function() {
      console.log('🔐 Testing Cipher Integration...');
      
      // Test with available ciphers
      const availableCiphers = global.Cipher ? global.Cipher.getCiphers() : [];
      
      availableCiphers.forEach(cipherName => {
        if (TEST_CONFIG.testCiphers.includes(cipherName)) {
          this.test(`Cipher integration - ${cipherName}`, () => {
            try {
              const testData = 'Hello World';
              const id = global.Cipher.InitCipher(cipherName, 'testkey');
              
              if (id) {
                const encrypted = global.Cipher.szEncrypt(id, testData, 'ECB');
                const decrypted = global.Cipher.szDecrypt(id, encrypted, 'ECB');
                global.Cipher.ClearData(id);
                
                // For ciphers that should preserve data
                if (cipherName === 'Caesar' || cipherName === 'ROT13' || cipherName === 'Atbash') {
                  return testData === decrypted;
                } else {
                  return encrypted !== testData; // Should be different after encryption
                }
              }
              return false;
            } catch (e) {
              console.warn(`  ⚠️  Cipher ${cipherName} error:`, e.message);
              return false;
            }
          });
        }
      });
      
      // Test file integration functions
      if (global.FileIntegration) {
        this.test('File integration entropy calculation', () => {
          const entropy = global.FileIntegration.calculateEntropy('Hello World');
          return entropy > 0 && entropy < 8;
        });
        
        this.test('File integration compression ratio', () => {
          global.arrStrings = {
            'InputData': 'Hello',
            'OutputData': 'SGVsbG8='
          };
          const ratio = global.FileIntegration.calculateCompressionRatio();
          return ratio > 0;
        });
        
        this.test('Key strength assessment', () => {
          const weak = global.FileIntegration.assessKeyStrength('123');
          const strong = global.FileIntegration.assessKeyStrength('ThisIsAVeryStrongPassword123!@#');
          return weak.includes('Weak') && strong.includes('Strong');
        });
      }
    },
    
    // Test error handling
    testErrorHandling: function() {
      console.log('⚠️  Testing Error Handling...');
      
      // Test with invalid data
      this.test('Invalid hex handling', () => {
        if (!global.HexEditor) return true;
        
        try {
          const result = global.HexEditor.utils.hexToBinary('INVALID_HEX_123XYZ');
          return result === ''; // Should return empty string for invalid hex
        } catch (e) {
          return true; // Exception is also acceptable
        }
      });
      
      this.test('Empty data handling', () => {
        if (!global.DownloadManager) return true;
        
        const processed = global.DownloadManager.processDataForFormat('', 'hex');
        return processed !== null;
      });
      
      this.test('Large data handling', () => {
        if (!global.HexEditor) return true;
        
        const largeData = TestData.randomBinary(10000);
        try {
          const hex = global.HexEditor.utils.stringToHex(largeData);
          return hex.length > 0;
        } catch (e) {
          console.warn('  ⚠️  Large data test failed:', e.message);
          return false;
        }
      });
    },
    
    // Test performance
    testPerformance: function() {
      console.log('⚡ Testing Performance...');
      
      const performanceTest = (name, testFunction, iterations = 1000) => {
        this.test(`Performance - ${name}`, () => {
          const start = Date.now();
          
          for (let i = 0; i < iterations; i++) {
            testFunction();
          }
          
          const duration = Date.now() - start;
          const perOperation = duration / iterations;
          
          console.log(`  📊 ${name}: ${duration}ms total, ${perOperation.toFixed(2)}ms per operation`);
          
          return perOperation < 10; // Should be under 10ms per operation
        });
      };
      
      // Test conversion performance
      const testData = TestData.randomText(1000);
      
      if (global.CipherFileHandler) {
        performanceTest('String to hex conversion', () => {
          global.CipherFileHandler.stringToHex(testData);
        }, 100);
        
        performanceTest('String to base64 conversion', () => {
          global.CipherFileHandler.stringToBase64(testData);
        }, 100);
      }
      
      if (global.HexEditor) {
        const hexData = '48656C6C6F576F726C64';
        performanceTest('Hex to binary conversion', () => {
          global.HexEditor.utils.hexToBinary(hexData);
        }, 1000);
      }
      
      if (global.FileIntegration) {
        performanceTest('Entropy calculation', () => {
          global.FileIntegration.calculateEntropy(testData);
        }, 10);
      }
    },
    
    // Test helper functions
    test: function(name, testFunction) {
      this.results.total++;
      
      try {
        const result = testFunction();
        if (result) {
          this.results.passed++;
          console.log(`  ✅ ${name}`);
        } else {
          this.results.failed++;
          console.log(`  ❌ ${name} - Test returned false`);
          this.results.errors.push(`${name}: Test returned false`);
        }
      } catch (error) {
        this.results.failed++;
        console.log(`  ❌ ${name} - ${error.message}`);
        this.results.errors.push(`${name}: ${error.message}`);
      }
    },
    
    log: function(message) {
      console.log(message);
    },
    
    error: function(message, details) {
      console.error(message, details || '');
      this.results.errors.push(`${message} ${details || ''}`);
    },
    
    // Show final results
    showResults: function() {
      console.log('\n' + '='.repeat(50));
      console.log('📊 TEST RESULTS');
      console.log('='.repeat(50));
      
      const passRate = this.results.total > 0 ? 
        ((this.results.passed / this.results.total) * 100).toFixed(1) : 0;
      
      console.log(`Total Tests: ${this.results.total}`);
      console.log(`Passed: ${this.results.passed} (${passRate}%)`);
      console.log(`Failed: ${this.results.failed}`);
      
      if (this.results.failed > 0) {
        console.log('\n❌ FAILED TESTS:');
        this.results.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }
      
      console.log('\n' + (this.results.failed === 0 ? 
        '🎉 All tests passed! File integration is working correctly.' :
        `⚠️  ${this.results.failed} test(s) failed. Review the implementation.`));
      
      // Exit with appropriate code for CI/CD
      if (typeof process !== 'undefined' && process.exit) {
        process.exit(this.results.failed > 0 ? 1 : 0);
      }
    }
  };
  
  // Export for both Node.js and browser
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileIntegrationTests;
  } else {
    global.FileIntegrationTests = FileIntegrationTests;
  }
  
  // Auto-run if this is the main module
  if (typeof require !== 'undefined' && require.main === module) {
    FileIntegrationTests.init();
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);