/*
 * PKCS#5 Padding Scheme
 * Password-based encryption padding (identical to PKCS#7 for 8-byte blocks)
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const PKCS5Metadata = CipherMetadata.createMetadata({
    name: 'PKCS#5',
    category: 'padding',
    description: 'PKCS#5 padding - for 8-byte block ciphers (subset of PKCS#7)',
    keySize: 'N/A (padding scheme)',
    blockSize: '8 bytes (64-bit blocks only)',
    cryptoFamily: 'Padding scheme',
    cryptoType: 'Symmetric',
    security: 'Standard - widely used for DES',
    country: 'USA',
    year: 1993,
    references: [
      'RFC 2898 (PKCS #5)',
      'Password-based cryptography',
      'Identical to PKCS#7 for 8-byte blocks'
    ],
    testVectors: [
      {
        description: 'PKCS#5 padding for 8-byte block, 5 bytes input',
        input: Hex8ToBytes('6bc1bee22e'),
        blockSize: 8,
        expected: Hex8ToBytes('6bc1bee22e030303')
      },
      {
        description: 'PKCS#5 padding for full 8-byte block',
        input: Hex8ToBytes('6bc1bee22e409f96'),
        blockSize: 8,
        expected: Hex8ToBytes('6bc1bee22e409f960808080808080808')
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('PKCS5', {
      szName: 'PKCS#5',
      szCategory: 'padding',
      szCountry: 'USA',
      nYear: 1993,
      metadata: PKCS5Metadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(blockSize) {
        if (blockSize && blockSize !== 8) {
          console.warn('PKCS#5 is designed for 8-byte blocks only');
        }
        return { blockSize: 8, id: Math.random() };
      },
      
      PadData: function(keyId, data) {
        const blockSize = 8; // PKCS#5 is always 8 bytes
        const paddingLength = blockSize - (data.length % blockSize);
        const padding = new Array(paddingLength).fill(paddingLength);
        return data.concat(padding);
      },
      
      UnpadData: function(keyId, paddedData) {
        if (paddedData.length === 0) return paddedData;
        
        const paddingLength = paddedData[paddedData.length - 1];
        
        // Validate padding
        if (paddingLength < 1 || paddingLength > 8) {
          throw new Error('Invalid PKCS#5 padding');
        }
        
        for (let i = 1; i <= paddingLength; i++) {
          if (paddedData[paddedData.length - i] !== paddingLength) {
            throw new Error('Invalid PKCS#5 padding');
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