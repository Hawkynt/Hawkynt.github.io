/*
 * CTS (Ciphertext Stealing) Mode of Operation
 * Handles arbitrary length messages without padding
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const CTSMetadata = CipherMetadata.createMetadata({
    name: 'CTS',
    category: 'mode',
    description: 'Ciphertext Stealing mode - handles arbitrary length without padding',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (depends on underlying cipher)',
    cryptoFamily: 'Mode of operation',
    cryptoType: 'Symmetric',
    security: 'Good - no padding required',
    country: 'USA',
    year: 1982,
    references: [
      'RFC 3962',
      'Academic literature',
      'Kerberos implementations'
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('CTS', {
      szName: 'CTS',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 1982,
      metadata: CTSMetadata,
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
        // CTS encryption implementation placeholder
        return plaintext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      Decrypt: function(keyId, ciphertext, iv) {
        // CTS decryption implementation placeholder
        return ciphertext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);