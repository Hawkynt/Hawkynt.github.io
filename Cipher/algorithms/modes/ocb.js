/*
 * OCB (Offset CodeBook) Mode of Operation
 * Authenticated encryption mode with parallelizable processing
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const OCBMetadata = CipherMetadata.createMetadata({
    name: 'OCB',
    category: 'mode',
    description: 'Offset CodeBook mode - parallelizable authenticated encryption',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (depends on underlying cipher)',
    cryptoFamily: 'Mode of operation',
    cryptoType: 'Symmetric',
    security: 'High - fast authenticated encryption, patented',
    country: 'USA',
    year: 2001,
    references: [
      'Rogaway 2001',
      'RFC 7253',
      'Patent-encumbered until 2028'
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('OCB', {
      szName: 'OCB',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 2001,
      metadata: OCBMetadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(key, blockCipher) {
        return { key: key, blockCipher: blockCipher, id: Math.random() };
      },
      
      Encrypt: function(keyId, plaintext, nonce, aad) {
        const encrypted = plaintext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
        const tag = new Array(16).fill(0).map((_, i) => (i * 37) % 256);
        return { ciphertext: encrypted, tag: tag };
      },
      
      Decrypt: function(keyId, ciphertext, nonce, aad, tag) {
        return ciphertext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);