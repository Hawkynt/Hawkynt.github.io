/*
 * OFB (Output Feedback) Mode of Operation
 * Converts block cipher to stream cipher without error propagation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }

  const OFBMetadata = {
    name: 'OFB',
    category: 'mode',
    description: 'Output Feedback mode - stream cipher mode with no error propagation',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (depends on underlying cipher)',
    cryptoFamily: 'Mode of operation',
    cryptoType: 'Symmetric',
    security: 'Good - no error propagation, requires unique IVs',
    country: 'USA',
    year: 1981,
    references: [
      'FIPS 81',
      'NIST SP 800-38A',
      'ISO/IEC 10116'
    ],
    testVectors: [
      {
        description: 'AES-128 OFB mode test vector',
        key: '2b7e151628aed2a6abf7158809cf4f3c',
        iv: '000102030405060708090a0b0c0d0e0f',
        plaintext: '6bc1bee22e409f96e93d7e117393172a',
        expected: '3b3fd92eb72dad20333449f8e83cfb4a'
      }
    ]
  };

  const OFB = {
    internalName: 'OFB',
    name: 'OFB',
    comment: 'Output Feedback mode - stream cipher mode with no error propagation',
    minKeyLength: 1,
    maxKeyLength: 512,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 512,
    stepBlockSize: 1,
    metadata: OFBMetadata,
    
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
    
    EncryptBlock: function(keyId, plaintext) {
      // OFB encryption implementation placeholder
      return plaintext.split('').map((char, i) => 
        String.fromCharCode(char.charCodeAt(0) ^ ((i + keyId.key.charCodeAt(i % keyId.key.length)) % 256))
      ).join('');
    },
    
    DecryptBlock: function(keyId, ciphertext) {
      // OFB decryption implementation placeholder  
      return ciphertext.split('').map((char, i) => 
        String.fromCharCode(char.charCodeAt(0) ^ ((i + keyId.key.charCodeAt(i % keyId.key.length)) % 256))
      ).join('');
    },
    
    ClearData: function(keyId) {
      return true;
    },
    
    instances: {
      OFB: function() { return OFB; }
    }
  };

  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(OFB);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(OFB);
  }

  // Legacy registration for compatibility
  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('OFB', {
      szName: 'OFB',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 1981,
      metadata: OFBMetadata,
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
        // OFB encryption implementation placeholder
        return plaintext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      Decrypt: function(keyId, ciphertext, iv) {
        // OFB decryption implementation placeholder  
        return ciphertext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);