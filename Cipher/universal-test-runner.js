#!/usr/bin/env node
/*
 * Universal Cipher Test Runner
 * Tests cipher implementations in both Node.js and Browser environments
 * Auto-discovers algorithms from categorized directory structure
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection
  const isNode = typeof module !== 'undefined' && module.exports;
  const isBrowser = typeof window !== 'undefined';
  
  // Load dependencies for Node.js
  if (isNode) {
    require('./universal-cipher-env.js');
    require('./cipher.js');
    
    // Auto-discovered universal cipher implementations from categorized structure
    const cipherModules = [
      './algorithms/asymmetric/beth-piper.js',
      './algorithms/asymmetric/dilithium.js',
      './algorithms/asymmetric/ml-kem.js',
      './algorithms/asymmetric/slh-dsa.js',
      './algorithms/asymmetric/sphincs-plus.js',
      './algorithms/block/3des.js',
      './algorithms/block/anubis.js',
      './algorithms/block/aria.js',
      './algorithms/block/baseking.js',
      './algorithms/block/blowfish.js',
      './algorithms/block/camellia.js',
      './algorithms/block/cast128.js',
      './algorithms/block/cast256.js',
      './algorithms/block/cham.js',
      './algorithms/block/clefia.js',
      './algorithms/block/crypton.js',
      './algorithms/block/deal.js',
      './algorithms/block/des.js',
      './algorithms/block/des-x.js',
      './algorithms/block/dfc.js',
      './algorithms/block/feal.js',
      './algorithms/block/ff1.js',
      './algorithms/block/ff3.js',
      './algorithms/block/gost-kuznyechik.js',
      './algorithms/block/gost28147.js',
      './algorithms/block/idea.js',
      './algorithms/block/kalyna.js',
      './algorithms/block/khazad.js',
      './algorithms/block/lea.js',
      './algorithms/block/loki89.js',
      './algorithms/block/loki97.js',
      './algorithms/block/lucifer.js',
      './algorithms/block/magenta.js',
      './algorithms/block/mars.js',
      './algorithms/block/misty1.js',
      './algorithms/block/misty2.js',
      './algorithms/block/newdes.js',
      './algorithms/block/noekeon.js',
      './algorithms/block/present.js',
      './algorithms/block/present128.js',
      './algorithms/block/rc2.js',
      './algorithms/block/rc5.js',
      './algorithms/block/rc6.js',
      './algorithms/block/rijndael.js',
      './algorithms/block/safer.js',
      './algorithms/block/seed.js',
      './algorithms/block/serpent.js',
      './algorithms/block/simon.js',
      './algorithms/block/skipjack.js',
      './algorithms/block/sm4.js',
      './algorithms/block/speck.js',
      './algorithms/block/square.js',
      './algorithms/block/tea.js',
      './algorithms/block/threefish.js',
      './algorithms/block/twofish.js',
      './algorithms/block/xtea.js',
      './algorithms/block/xxtea.js',
      './algorithms/classical/affine.js',
      './algorithms/classical/beaufort.js',
      './algorithms/classical/caesar.js',
      './algorithms/classical/enigma.js',
      './algorithms/classical/foursquare.js',
      './algorithms/classical/hill.js',
      './algorithms/classical/nihilist.js',
      './algorithms/classical/playfair.js',
      './algorithms/classical/scytale.js',
      './algorithms/classical/twosquare.js',
      './algorithms/classical/vigenere.js',
      './algorithms/compression/bpe.js',
      './algorithms/compression/brotli.js',
      './algorithms/compression/bwt.js',
      './algorithms/compression/deflate-simple.js',
      './algorithms/compression/delta.js',
      './algorithms/compression/elias-delta.js',
      './algorithms/compression/elias-gamma.js',
      './algorithms/compression/fibonacci.js',
      './algorithms/compression/huffman.js',
      './algorithms/compression/lz4.js',
      './algorithms/compression/lz77.js',
      './algorithms/compression/lz78.js',
      './algorithms/compression/lzw.js',
      './algorithms/compression/rle.js',
      './algorithms/compression/shannon-fano.js',
      './algorithms/compression/unary.js',
      './algorithms/encoding/atbash.js',
      './algorithms/encoding/base16.js',
      './algorithms/encoding/base32.js',
      './algorithms/encoding/base58.js',
      './algorithms/encoding/base64.js',
      './algorithms/encoding/base85.js',
      './algorithms/encoding/base91.js',
      './algorithms/encoding/baudot.js',
      './algorithms/encoding/binhex.js',
      './algorithms/encoding/bubblebabble.js',
      './algorithms/encoding/koremutake.js',
      './algorithms/encoding/manchester.js',
      './algorithms/encoding/morse.js',
      './algorithms/encoding/pem.js',
      './algorithms/encoding/polybius.js',
      './algorithms/encoding/rot.js',
      './algorithms/encoding/uuencode.js',
      './algorithms/encoding/xxencode.js',
      './algorithms/hash/adler32.js',
      './algorithms/hash/blake2b.js',
      './algorithms/hash/blake2s.js',
      './algorithms/hash/blake3.js',
      './algorithms/hash/crc16.js',
      './algorithms/hash/crc32.js',
      './algorithms/hash/fnv.js',
      './algorithms/hash/md2.js',
      './algorithms/hash/md4.js',
      './algorithms/hash/md5.js',
      './algorithms/hash/ripemd160.js',
      './algorithms/hash/sha1.js',
      './algorithms/hash/sha224.js',
      './algorithms/hash/sha256.js',
      './algorithms/hash/sha3-256.js',
      './algorithms/hash/sha384.js',
      './algorithms/hash/sha512.js',
      './algorithms/hash/shake128.js',
      './algorithms/hash/siphash.js',
      './algorithms/hash/streebog.js',
      './algorithms/hash/tiger.js',
      './algorithms/hash/whirlpool.js',
      './algorithms/hash/xxhash32.js',
      './algorithms/kdf/argon2.js',
      './algorithms/mac/cmac.js',
      './algorithms/mac/hmac.js',
      './algorithms/mac/poly1305.js',
      './algorithms/special/3way.js',
      './algorithms/special/ascon.js',
      './algorithms/special/ccm.js',
      './algorithms/special/eax.js',
      './algorithms/special/fish.js',
      './algorithms/special/ocb.js',
      './algorithms/stream/a5-1.js',
      './algorithms/stream/a5-2.js',
      './algorithms/stream/a5-3.js',
      './algorithms/stream/achterbahn.js',
      './algorithms/stream/chacha20.js',
      './algorithms/stream/crypto1.js',
      './algorithms/stream/e0.js',
      './algorithms/stream/e2.js',
      './algorithms/stream/f-fcsr.js',
      './algorithms/stream/geffe.js',
      './algorithms/stream/grain.js',
      './algorithms/stream/grain-v1.js',
      './algorithms/stream/hc-128.js',
      './algorithms/stream/isaac.js',
      './algorithms/stream/mickey.js',
      './algorithms/stream/miller.js',
      './algorithms/stream/mugi.js',
      './algorithms/stream/panama.js',
      './algorithms/stream/rabbit.js',
      './algorithms/stream/rc4.js',
      './algorithms/stream/rule30.js',
      './algorithms/stream/salsa20.js',
      './algorithms/stream/shrinking-generator.js',
      './algorithms/stream/snow3g.js',
      './algorithms/stream/sosemanuk.js',
      './algorithms/stream/spritz.js',
      './algorithms/stream/trivium.js',
      './algorithms/stream/wake.js',
      './algorithms/stream/zuc.js'
    ];
    
    console.log('=== Loading Universal Cipher System ===\n');
    
    // Load all cipher modules
    cipherModules.forEach(module => {
      try {
        require(module);
        const fileName = module.split('/').pop().replace('.js', '');
        console.log(`✓ Loaded ${fileName}`);
      } catch (error) {
        console.log(`✗ Failed to load ${module}: ${error.message}`);
      }
    });
  }
  
  // Test framework
  const TestRunner = {
    tests: [],
    results: {
      total: 0,
      passed: 0,
      failed: 0,
      errors: 0
    },
    
    addTest: function(name, testFn, description) {
      this.tests.push({
        name: name,
        fn: testFn,
        description: description || 'No description'
      });
    },
    
    runAllTests: function() {
      console.log('\n=== UNIVERSAL CIPHER TESTING ===');
      console.log('Environment:', isNode ? 'Node.js' : 'Browser');
      
      if (typeof Cipher !== 'undefined' && Cipher.GetCiphers) {
        const availableCiphers = Cipher.GetCiphers();
        console.log('Available ciphers:', availableCiphers.length);
        console.log('');
      } else {
        console.log('❌ Cipher system not loaded properly');
        return;
      }
      
      console.log('=== Testing Individual Algorithms ===\n');
      
      this.results = { total: 0, passed: 0, failed: 0, errors: 0 };
      
      this.tests.forEach(test => {
        this.runSingleTest(test);
      });
      
      this.printSummary();
      this.testCipherByCipher();
    },
    
    runSingleTest: function(test) {
      this.results.total++;
      
      try {
        const result = test.fn();
        if (result === true || (result && result.success === true)) {
          this.results.passed++;
          console.log(`✓ ${test.name}: PASSED`);
        } else {
          this.results.failed++;
          const error = result && result.error ? ` - ${result.error}` : '';
          console.log(`✗ ${test.name}: FAILED${error}`);
        }
      } catch (error) {
        this.results.errors++;
        console.log(`❌ ${test.name}: ERROR - ${error.message}`);
      }
    },
    
    printSummary: function() {
      console.log('\n=== TEST SUMMARY ===');
      console.log(`Total tests: ${this.results.total}`);
      console.log(`Passed: ${this.results.passed} (${Math.round(this.results.passed/this.results.total*100) || 0}%)`);
      console.log(`Failed: ${this.results.failed} (${Math.round(this.results.failed/this.results.total*100) || 0}%)`);
      console.log(`Errors: ${this.results.errors} (${Math.round(this.results.errors/this.results.total*100) || 0}%)`);
    },
    
    testCipherByCipher: function() {
      console.log('\n=== CIPHER-BY-CIPHER RESULTS ===');
      
      if (typeof Cipher === 'undefined' || !Cipher.GetCiphers) {
        console.log('❌ Cipher system not available');
        return;
      }
      
      const availableCiphers = Cipher.GetCiphers();
      
      availableCiphers.forEach(cipherName => {
        try {
          const cipher = Cipher.GetCipher(cipherName);
          if (cipher) {
            console.log(`✓ ${cipherName}: Available`);
            
            // Basic functionality test
            if (cipher.Init) cipher.Init();
            if (cipher.KeySetup && cipher.EncryptBlock) {
              const keyId = cipher.KeySetup('testkey');
              if (keyId !== undefined) {
                console.log(`  ✓ Key setup successful`);
              } else {
                console.log(`  ⚠️ Key setup returned undefined`);
              }
            }
          } else {
            console.log(`✗ ${cipherName}: Failed to retrieve cipher object`);
          }
        } catch (error) {
          console.log(`❌ ${cipherName}: ${error.message}`);
        }
      });
    }
  };
  
  // Add some basic tests
  TestRunner.addTest('Caesar Cipher', function() {
    if (typeof Cipher === 'undefined' || !Cipher.GetCipher) {
      return { success: false, error: 'Cipher system not loaded' };
    }
    
    try {
      const caesar = Cipher.GetCipher('Caesar');
      if (!caesar) {
        return { success: false, error: 'Caesar cipher not found' };
      }
      
      if (caesar.Init) caesar.Init();
      const keyId = caesar.KeySetup('');
      const encrypted = caesar.EncryptBlock(keyId, 'HELLO');
      caesar.ClearData(keyId);
      
      return { success: encrypted === 'KHOOR' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, 'Test Caesar cipher with basic shift');
  
  TestRunner.addTest('Base64 Encoding', function() {
    if (typeof Cipher === 'undefined' || !Cipher.GetCipher) {
      return { success: false, error: 'Cipher system not loaded' };
    }
    
    try {
      const base64 = Cipher.GetCipher('BASE64');
      if (!base64) {
        return { success: false, error: 'BASE64 encoder not found' };
      }
      
      if (base64.Init) base64.Init();
      const keyId = base64.KeySetup('');
      const encoded = base64.EncryptBlock(keyId, 'hello');
      base64.ClearData(keyId);
      
      return { success: encoded === 'aGVsbG8=' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, 'Test Base64 encoding');
  
  // Export for both environments
  if (isNode) {
    module.exports = TestRunner;
    
    // Auto-run if this is the main module
    if (require.main === module) {
      TestRunner.runAllTests();
    }
  } else {
    global.TestRunner = TestRunner;
  }
  
})(typeof global !== 'undefined' ? global : window);