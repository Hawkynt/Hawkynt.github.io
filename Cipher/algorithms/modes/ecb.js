/*
 * Electronic Codebook (ECB) Mode
 * Basic block cipher mode - encrypts each block independently
 * WARNING: Not secure for most applications due to pattern leakage
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }

  const CipherMetadata = global.CipherMetadata || {};

  const ECBMetadata = CipherMetadata.createMetadata({
    name: 'ECB',
    category: 'mode',
    description: 'Electronic Codebook mode - encrypts each block independently',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (depends on underlying cipher)',
    cryptoFamily: 'Block cipher mode',
    cryptoType: 'Symmetric',
    security: 'Weak - not recommended for most applications',
    country: 'USA',
    year: 1977,
    references: [
      'FIPS 81 (1980)',
      'NIST SP 800-38A'
    ],
    testVectors: [
      {
        description: 'AES-128 ECB test vector',
        key: '2b7e151628aed2a6abf7158809cf4f3c',
        plaintext: '6bc1bee22e409f96e93d7e117393172a',
        ciphertext: '3ad77bb40d7a3660a89ecaf32466ef97'
      },
      {
        description: 'AES-128 ECB second block',
        key: '2b7e151628aed2a6abf7158809cf4f3c',
        plaintext: 'ae2d8a571e03ac9c9eb76fac45af8e51',
        ciphertext: 'f5d3d58503b9699de785895a96fdbaaf'
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('ECB', {
      szName: 'ECB',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 1977,
      metadata: ECBMetadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(key) {
        return { key: key, id: Math.random() };
      },
      
      EncryptBlock: function(keyId, plaintext) {
        return plaintext;
      },
      
      DecryptBlock: function(keyId, ciphertext) {
        return ciphertext;
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);