/*
 * ISO/IEC 7816-4 Padding Scheme
 * Pads with 0x80 followed by zero bytes
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const ISO78164Metadata = CipherMetadata.createMetadata({
    name: 'ISO/IEC 7816-4',
    category: 'padding',
    description: 'ISO/IEC 7816-4 padding - 0x80 followed by zeros',
    keySize: 'N/A (padding scheme)',
    blockSize: 'Variable',
    cryptoFamily: 'Padding scheme',
    cryptoType: 'Symmetric',
    security: 'Good - unambiguous padding',
    country: 'International',
    year: 2005,
    references: [
      'ISO/IEC 7816-4',
      'Smart card communication',
      'Also known as bit padding'
    ],
    testVectors: [
      {
        description: 'ISO 7816-4 padding for 16-byte block, 13 bytes input',
        input: OpCodes.Hex8ToBytes('6bc1bee22e409f96e93d7e11739317'),
        blockSize: 16,
        expected: OpCodes.Hex8ToBytes('6bc1bee22e409f96e93d7e11739317800000')
      },
      {
        description: 'ISO 7816-4 padding for 8-byte block, 5 bytes input',
        input: OpCodes.Hex8ToBytes('6bc1bee22e'),
        blockSize: 8,
        expected: OpCodes.Hex8ToBytes('6bc1bee22e800000')
      },
      {
        description: 'ISO 7816-4 padding for full block',
        input: OpCodes.Hex8ToBytes('6bc1bee22e409f96e93d7e117393172a'),
        blockSize: 16,
        expected: OpCodes.Hex8ToBytes('6bc1bee22e409f96e93d7e117393172a8000000000000000000000000000000000')
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('ISO 7816-4', {
      szName: 'ISO/IEC 7816-4',
      szCategory: 'padding',
      szCountry: 'International',
      nYear: 2005,
      metadata: ISO78164Metadata,
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
        
        if (paddingLength === blockSize) {
          // Full block padding needed
          const padding = [0x80].concat(new Array(blockSize - 1).fill(0));
          return data.concat(padding);
        } else {
          // Partial block padding
          const padding = [0x80].concat(new Array(paddingLength - 1).fill(0));
          return data.concat(padding);
        }
      },
      
      UnpadData: function(keyId, paddedData) {
        if (paddedData.length === 0) return paddedData;
        
        // Find the last 0x80 byte
        let paddingStart = -1;
        for (let i = paddedData.length - 1; i >= 0; i--) {
          if (paddedData[i] === 0x80) {
            paddingStart = i;
            break;
          } else if (paddedData[i] !== 0x00) {
            throw new Error('Invalid ISO 7816-4 padding');
          }
        }
        
        if (paddingStart === -1) {
          throw new Error('Invalid ISO 7816-4 padding - no 0x80 byte found');
        }
        
        return paddedData.slice(0, paddingStart);
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);