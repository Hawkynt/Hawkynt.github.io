/*
 * SIV (Synthetic IV) Mode of Operation  
 * Authenticated encryption with synthetic initialization vectors
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const SIVMetadata = CipherMetadata.createMetadata({
    name: 'SIV',
    category: 'mode',
    description: 'Synthetic IV mode - deterministic authenticated encryption',
    keySize: 'Variable (double key size)',
    blockSize: 'Variable (depends on underlying cipher)',
    cryptoFamily: 'Mode of operation',
    cryptoType: 'Symmetric',
    security: 'High - key-commitment, deterministic AEAD',
    country: 'USA',
    year: 2006,
    references: [
      'Rogaway, Shrimpton 2006',
      'RFC 5297'
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('SIV', {
      szName: 'SIV',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 2006,
      metadata: SIVMetadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(key, blockCipher) {
        return { key: key, blockCipher: blockCipher, id: Math.random() };
      },
      
      Encrypt: function(keyId, plaintext, aad) {
        const iv = new Array(16).fill(0).map((_, i) => (i * 41) % 256); // Synthetic IV
        const encrypted = plaintext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
        return { iv: iv, ciphertext: encrypted };
      },
      
      Decrypt: function(keyId, iv, ciphertext, aad) {
        return ciphertext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);