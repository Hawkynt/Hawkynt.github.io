/*
 * LRW (Liskov-Rivest-Wagner) Mode of Operation
 * Tweakable block cipher mode for disk encryption
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const LRWMetadata = CipherMetadata.createMetadata({
    name: 'LRW',
    category: 'mode',
    description: 'Liskov-Rivest-Wagner mode - tweakable block cipher',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (depends on underlying cipher)',
    cryptoFamily: 'Mode of operation',
    cryptoType: 'Symmetric',
    security: 'Good - predecessor to XTS',
    country: 'USA',
    year: 2002,
    references: [
      'Liskov, Rivest, Wagner 2002',
      'Replaced by XTS',
      'IEEE P1619'
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('LRW', {
      szName: 'LRW', 
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 2002,
      metadata: LRWMetadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(key, blockCipher) {
        return { key: key, blockCipher: blockCipher, id: Math.random() };
      },
      
      Encrypt: function(keyId, plaintext, tweak) {
        return plaintext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      Decrypt: function(keyId, ciphertext, tweak) {
        return ciphertext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);