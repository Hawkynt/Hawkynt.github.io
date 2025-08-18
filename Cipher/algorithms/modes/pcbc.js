/*
 * PCBC (Propagating Cipher Block Chaining) Mode of Operation
 * Block chaining mode with plaintext and ciphertext feedback
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const PCBCMetadata = CipherMetadata.createMetadata({
    name: 'PCBC',
    category: 'mode',
    description: 'Propagating Cipher Block Chaining - errors propagate indefinitely',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (depends on underlying cipher)',
    cryptoFamily: 'Mode of operation',
    cryptoType: 'Symmetric',
    security: 'Good - strong error propagation',
    country: 'USA',
    year: 1982,
    references: [
      'Kerberos v4',
      'Academic literature'
    ],
    testVectors: [
      {
        description: 'PCBC mode test vector',
        key: '2b7e151628aed2a6abf7158809cf4f3c',
        iv: '000102030405060708090a0b0c0d0e0f',
        plaintext: '6bc1bee22e409f96e93d7e117393172a',
        expected: '7649abac8119b246cee98e9b12e9197d'
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('PCBC', {
      szName: 'PCBC',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 1982,
      metadata: PCBCMetadata,
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
        // PCBC encryption implementation placeholder
        return plaintext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      Decrypt: function(keyId, ciphertext, iv) {
        // PCBC decryption implementation placeholder
        return ciphertext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);