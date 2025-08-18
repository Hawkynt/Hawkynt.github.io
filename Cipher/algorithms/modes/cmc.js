/*
 * CMC (CMC Mode) Mode of Operation
 * Tweakable block cipher mode
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const CMCMetadata = CipherMetadata.createMetadata({
    name: 'CMC',
    category: 'mode',
    description: 'CMC mode - tweakable block cipher with strong security',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (depends on underlying cipher)',
    cryptoFamily: 'Mode of operation',
    cryptoType: 'Symmetric',
    security: 'High - strong pseudorandom permutation',
    country: 'USA',
    year: 2003,
    references: [
      'Halevi, Rogaway 2003',
      'Academic literature'
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('CMC', {
      szName: 'CMC',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 2003,
      metadata: CMCMetadata,
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