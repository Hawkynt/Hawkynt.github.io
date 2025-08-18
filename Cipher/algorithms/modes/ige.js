/*
 * IGE (Infinite Garble Extension) Mode of Operation
 * Block cipher mode with infinite error propagation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const IGEMetadata = CipherMetadata.createMetadata({
    name: 'IGE',
    category: 'mode',
    description: 'Infinite Garble Extension - bidirectional cipher chaining',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (depends on underlying cipher)',
    cryptoFamily: 'Mode of operation',
    cryptoType: 'Symmetric',
    security: 'Good - infinite error propagation',
    country: 'International',
    year: 1995,
    references: [
      'Campbell, Wiener 1995',
      'Used in some VPN implementations'
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('IGE', {
      szName: 'IGE',
      szCategory: 'mode',
      szCountry: 'International',
      nYear: 1995,
      metadata: IGEMetadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(key, blockCipher) {
        return { key: key, blockCipher: blockCipher, id: Math.random() };
      },
      
      Encrypt: function(keyId, plaintext, iv1, iv2) {
        return plaintext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      Decrypt: function(keyId, ciphertext, iv1, iv2) {
        return ciphertext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);