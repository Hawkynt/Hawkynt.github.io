/*
 * PKCS#7 Padding Scheme
 * Pads data to a multiple of block size using byte values equal to the padding length
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const PKCS7Metadata = CipherMetadata.createMetadata({
    name: 'PKCS#7',
    category: 'padding',
    description: 'PKCS#7 padding - each padding byte contains the padding length',
    keySize: 'N/A (padding scheme)',
    blockSize: 'Variable (1-255 bytes)',
    cryptoFamily: 'Padding scheme',
    cryptoType: 'Symmetric',
    security: 'Standard - widely used and secure',
    country: 'USA',
    year: 1993,
    references: [
      'RFC 2315 (PKCS #7)',
      'RFC 5652 (CMS)',
      'ANSI X9.31'
    ],
    testVectors: [
      {
        description: 'PKCS#7 padding for 16-byte block, 13 bytes input',
        input: '6bc1bee22e409f96e93d7e11739317',
        blockSize: 16,
        expected: '6bc1bee22e409f96e93d7e11739317030303'
      },
      {
        description: 'PKCS#7 padding for 8-byte block, 5 bytes input',
        input: '6bc1bee22e',
        blockSize: 8,
        expected: '6bc1bee22e030303'
      },
      {
        description: 'PKCS#7 padding for full block (16 bytes)',
        input: '6bc1bee22e409f96e93d7e117393172a',
        blockSize: 16,
        expected: '6bc1bee22e409f96e93d7e117393172a10101010101010101010101010101010'
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('PKCS7', {
      szName: 'PKCS#7',
      szCategory: 'padding',
      szCountry: 'USA',
      nYear: 1993,
      metadata: PKCS7Metadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(blockSize) {
        return { blockSize: blockSize || 16, id: Math.random() };
      },
      
      PadData: function(keyId, data) {
        const blockSize = keyId.blockSize;
        const paddingLength = blockSize - (data.length % blockSize);
        const padding = new Array(paddingLength).fill(paddingLength);
        return data.concat(padding);
      },
      
      UnpadData: function(keyId, paddedData) {
        if (paddedData.length === 0) return paddedData;
        
        const paddingLength = paddedData[paddedData.length - 1];
        
        // Validate padding
        if (paddingLength < 1 || paddingLength > keyId.blockSize) {
          throw new Error('Invalid PKCS#7 padding');
        }
        
        for (let i = 1; i <= paddingLength; i++) {
          if (paddedData[paddedData.length - i] !== paddingLength) {
            throw new Error('Invalid PKCS#7 padding');
          }
        }
        
        return paddedData.slice(0, paddedData.length - paddingLength);
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);