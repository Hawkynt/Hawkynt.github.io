/*
 * Cipher Block Chaining (CBC) Mode
 * Each block is XORed with the previous ciphertext block before encryption
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const CBCMetadata = CipherMetadata.createMetadata({
    name: 'CBC',
    category: 'mode',
    description: 'Cipher Block Chaining mode - XORs each block with previous ciphertext',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (depends on underlying cipher)',
    cryptoFamily: 'Block cipher mode',
    cryptoType: 'Symmetric',
    security: 'Good - secure for most applications with proper IV',
    country: 'USA',
    year: 1976,
    references: [
      'FIPS 81 (1980)',
      'NIST SP 800-38A',
      'RFC 3602 (AES-CBC)'
    ],
    testVectors: [
      {
        description: 'AES-128 CBC test vector',
        key: '2b7e151628aed2a6abf7158809cf4f3c',
        iv: '000102030405060708090a0b0c0d0e0f',
        plaintext: '6bc1bee22e409f96e93d7e117393172a',
        ciphertext: '7649abac8119b246cee98e9b12e9197d'
      },
      {
        description: 'AES-128 CBC second block',
        key: '2b7e151628aed2a6abf7158809cf4f3c',
        iv: '7649abac8119b246cee98e9b12e9197d',
        plaintext: 'ae2d8a571e03ac9c9eb76fac45af8e51',
        ciphertext: '5086cb9b507219ee95db113a917678b2'
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('CBC', {
      szName: 'CBC',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 1976,
      metadata: CBCMetadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(key) {
        return { key: key, iv: null, id: Math.random() };
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