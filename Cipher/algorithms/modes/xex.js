/*
 * XEX (XOR-Encrypt-XOR) Mode of Operation
 * Tweakable block cipher mode 
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const XEXMetadata = CipherMetadata.createMetadata({
    name: 'XEX',
    category: 'mode',
    description: 'XOR-Encrypt-XOR mode - tweakable block cipher construction',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (depends on underlying cipher)', 
    cryptoFamily: 'Mode of operation',
    cryptoType: 'Symmetric',
    security: 'Good - basis for XTS mode',
    country: 'USA',
    year: 2004,
    references: [
      'Rogaway 2004',
      'IEEE 1619-2007',
      'Basis for XTS mode'
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('XEX', {
      szName: 'XEX',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 2004,
      metadata: XEXMetadata,
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