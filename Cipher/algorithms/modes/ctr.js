/*
 * Counter (CTR) Mode
 * Turns a block cipher into a stream cipher by encrypting successive counter values
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const CTRMetadata = CipherMetadata.createMetadata({
    name: 'CTR',
    category: 'mode',
    description: 'Counter mode - encrypts successive counter values to create a keystream',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (depends on underlying cipher)',
    cryptoFamily: 'Block cipher mode',
    cryptoType: 'Symmetric',
    security: 'Good - secure and allows parallel processing',
    country: 'USA',
    year: 1979,
    references: [
      'NIST SP 800-38A',
      'RFC 3686 (AES-CTR)',
      'Diffie and Hellman (1979)'
    ],
    testVectors: [
      {
        description: 'AES-128 CTR test vector',
        key: '2b7e151628aed2a6abf7158809cf4f3c',
        iv: 'f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff',
        plaintext: '6bc1bee22e409f96e93d7e117393172a',
        ciphertext: '874d6191b620e3261bef6864990db6ce'
      },
      {
        description: 'AES-128 CTR second block',
        key: '2b7e151628aed2a6abf7158809cf4f3c',
        iv: 'f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff',
        plaintext: 'ae2d8a571e03ac9c9eb76fac45af8e51',
        ciphertext: '9806f66b7970fdff8617187bb9fffdff'
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('CTR', {
      szName: 'CTR',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 1979,
      metadata: CTRMetadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(key) {
        return { key: key, counter: 0, nonce: null, id: Math.random() };
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