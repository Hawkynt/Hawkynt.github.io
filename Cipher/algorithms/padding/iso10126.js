/*
 * ISO 10126 Padding Scheme
 * Pads with random bytes except last byte indicates padding length
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const ISO10126Metadata = CipherMetadata.createMetadata({
    name: 'ISO 10126',
    category: 'padding',
    description: 'ISO 10126 padding - random bytes with length byte at end',
    keySize: 'N/A (padding scheme)',
    blockSize: 'Variable (1-255 bytes)',
    cryptoFamily: 'Padding scheme',
    cryptoType: 'Symmetric',
    security: 'Good - random padding provides some confusion',
    country: 'International',
    year: 1991,
    references: [
      'ISO/IEC 10126',
      'Withdrawn standard',
      'Random padding scheme'
    ],
    testVectors: [
      {
        description: 'ISO 10126 padding for 16-byte block, 13 bytes input',
        input: Hex8ToBytes('6bc1bee22e409f96e93d7e11739317'),
        blockSize: 16,
        expected: '6bc1bee22e409f96e93d7e11739317[random][random]03'
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('ISO 10126', {
      szName: 'ISO 10126',
      szCategory: 'padding',
      szCountry: 'International',
      nYear: 1991,
      metadata: ISO10126Metadata,
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
        
        // Create padding: random bytes followed by length byte
        const padding = new Array(paddingLength - 1).fill(0).map(() => Math.floor(Math.random() * 256));
        padding.push(paddingLength);
        
        return data.concat(padding);
      },
      
      UnpadData: function(keyId, paddedData) {
        if (paddedData.length === 0) return paddedData;
        
        const paddingLength = paddedData[paddedData.length - 1];
        
        // Validate padding length
        if (paddingLength < 1 || paddingLength > keyId.blockSize) {
          throw new Error('Invalid ISO 10126 padding');
        }
        
        return paddedData.slice(0, paddedData.length - paddingLength);
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);