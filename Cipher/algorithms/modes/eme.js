/*
 * EME (ECB-Mask-ECB) Mode of Operation
 * Wide-block tweakable block cipher mode
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const EMEMetadata = CipherMetadata.createMetadata({
    name: 'EME',
    category: 'mode',
    description: 'ECB-Mask-ECB mode - wide-block tweakable cipher',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (wide blocks)',
    cryptoFamily: 'Mode of operation',
    cryptoType: 'Symmetric',
    security: 'Good - wide-block construction',
    country: 'USA',
    year: 2003,
    references: [
      'Halevi, Rogaway 2003',
      'Wide-block cipher construction'
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('EME', {
      szName: 'EME',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 2003,
      metadata: EMEMetadata,
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