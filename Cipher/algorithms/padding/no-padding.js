/*
 * No Padding Scheme
 * No padding applied - data must be exact block size
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const NoPaddingMetadata = CipherMetadata.createMetadata({
    name: 'No Padding',
    category: 'padding',
    description: 'No padding - data must be exact multiple of block size',
    keySize: 'N/A (padding scheme)',
    blockSize: 'Variable (must match input size)',
    cryptoFamily: 'Padding scheme',
    cryptoType: 'Symmetric',
    security: 'N/A - no security properties',
    country: 'International',
    year: 1970,
    references: [
      'Raw block cipher usage',
      'ECB, CBC without padding'
    ],
    testVectors: [
      {
        description: 'No padding for exact block size',
        input: Hex8ToBytes('6bc1bee22e409f96e93d7e117393172a'),
        blockSize: 16,
        expected: Hex8ToBytes('6bc1bee22e409f96e93d7e117393172a')
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('No Padding', {
      szName: 'No Padding',
      szCategory: 'padding',
      szCountry: 'International',
      nYear: 1970,
      metadata: NoPaddingMetadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(blockSize) {
        return { blockSize: blockSize || 16, id: Math.random() };
      },
      
      PadData: function(keyId, data) {
        const blockSize = keyId.blockSize;
        
        if (data.length % blockSize !== 0) {
          throw new Error('Data length must be multiple of block size when using no padding');
        }
        
        return data; // No padding applied
      },
      
      UnpadData: function(keyId, paddedData) {
        return paddedData; // No unpadding needed
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);