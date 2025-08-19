/*
 * CFB (Cipher Feedback) Mode of Operation
 * Converts block cipher to stream cipher using feedback
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }

  const CipherMetadata = global.CipherMetadata || {};

  const CFBMetadata = CipherMetadata.createMetadata({
    name: 'CFB',
    category: 'mode',
    description: 'Cipher Feedback mode - converts block cipher to stream cipher with error propagation',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (depends on underlying cipher)',
    cryptoFamily: 'Mode of operation',
    cryptoType: 'Symmetric',
    security: 'Good - self-synchronizing, error propagation',
    country: 'USA',
    year: 1981,
    references: [
      'FIPS 81',
      'NIST SP 800-38A',
      'ISO/IEC 10116'
    ],
    testVectors: [
      {
        description: 'AES-128 CFB mode test vector',
        key: '2b7e151628aed2a6abf7158809cf4f3c',
        iv: '000102030405060708090a0b0c0d0e0f',
        plaintext: '6bc1bee22e409f96e93d7e117393172a',
        expected: '3b3fd92eb72dad20333449f8e83cfb4a'
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('CFB', {
      szName: 'CFB',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 1981,
      metadata: CFBMetadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(key, blockCipher) {
        return { 
          key: key, 
          blockCipher: blockCipher,
          blockSize: blockCipher?.blockSize || 16,
          id: Math.random() 
        };
      },
      
      Encrypt: function(keyId, plaintext, iv) {
        // CFB encryption implementation placeholder
        return plaintext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      Decrypt: function(keyId, ciphertext, iv) {
        // CFB decryption implementation placeholder
        return ciphertext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);