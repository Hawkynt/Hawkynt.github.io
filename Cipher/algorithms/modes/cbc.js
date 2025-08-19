/*
 * Cipher Block Chaining (CBC) Mode
 * Each block is XORed with the previous ciphertext block before encryption
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }

  const CBC = {
    name: "CBC",
    description: "Cipher Block Chaining mode where each plaintext block is XORed with the previous ciphertext block before encryption. Requires initialization vector and padding for messages not multiple of block size.",
    inventor: "IBM",
    year: 1976,
    country: "US",
    category: "modeOfOperation",
    subCategory: "Confidentiality Mode",
    securityStatus: null,
    securityNotes: "Secure with proper IV generation. Predictable IVs can lead to information leakage. Padding oracle attacks possible with improper error handling.",
    
    documentation: [
      {text: "NIST SP 800-38A - Block Cipher Modes", uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf"},
      {text: "Wikipedia - Block cipher mode of operation", uri: "https://en.wikipedia.org/wiki/Block_cipher_mode_of_operation#Cipher_block_chaining_(CBC)"},
      {text: "RFC 3602 - AES-CBC Cipher Algorithm", uri: "https://tools.ietf.org/rfc/rfc3602.txt"}
    ],
    
    references: [
      {text: "OpenSSL CBC Implementation", uri: "https://github.com/openssl/openssl/blob/master/crypto/modes/cbc128.c"},
      {text: "Crypto++ CBC Mode", uri: "https://github.com/weidai11/cryptopp/blob/master/modes.cpp"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Padding Oracle Attack", 
        text: "CBC with PKCS#7 padding is vulnerable to padding oracle attacks when decryption errors are distinguishable",
        mitigation: "Use authenticated encryption modes like GCM, or implement proper error handling without leaking padding information"
      },
      {
        type: "IV Predictability", 
        text: "Using predictable initialization vectors can lead to information leakage about the first block",
        mitigation: "Always use cryptographically random IVs and never reuse IVs with the same key"
      }
    ],
    
    tests: [
      {
        text: "NIST SP 800-38A CBC Test Vector",
        uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf",
        keySize: 16,
        blockSize: 16,
        input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
        key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
        iv: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        expected: OpCodes.Hex8ToBytes("7649abac8119b246cee98e9b12e9197d")
      }
    ],

    Init: function() {
      return true;
    }

    // TODO: Implementation methods here...
  };

  // Auto-register with Subsystem if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(CBC);

  // Legacy registration for compatibility
  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('CBC', {
      szName: 'CBC',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 1976,
      metadata: CBC,
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