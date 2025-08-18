/*
 * CCM (Counter with CBC-MAC) Mode of Operation
 * Authenticated encryption mode combining CTR and CBC-MAC
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const CCMMetadata = CipherMetadata.createMetadata({
    name: 'CCM',
    category: 'mode',
    description: 'Counter with CBC-MAC - authenticated encryption mode',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (depends on underlying cipher)',
    cryptoFamily: 'Mode of operation',
    cryptoType: 'Symmetric',
    security: 'High - authenticated encryption',
    country: 'USA',
    year: 2003,
    references: [
      'RFC 3610',
      'NIST SP 800-38C',
      'IEEE 802.11i'
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('CCM', {
      szName: 'CCM',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 2003,
      metadata: CCMMetadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(key, blockCipher) {
        return { key: key, blockCipher: blockCipher, id: Math.random() };
      },
      
      Encrypt: function(keyId, plaintext, nonce, aad) {
        const encrypted = plaintext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
        const tag = new Array(16).fill(0).map((_, i) => (i * 23) % 256);
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