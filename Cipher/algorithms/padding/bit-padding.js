/*
 * Bit Padding Scheme (same as ISO/IEC 7816-4)
 * Pads with 0x80 (bit '1') followed by zero bytes
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const BitPaddingMetadata = CipherMetadata.createMetadata({
    name: 'Bit Padding',
    category: 'padding',
    description: 'Bit padding - single 1 bit followed by zero bits (same as ISO 7816-4)',
    keySize: 'N/A (padding scheme)',
    blockSize: 'Variable',
    cryptoFamily: 'Padding scheme',
    cryptoType: 'Symmetric',
    security: 'Good - unambiguous padding removal',
    country: 'International',
    year: 1980,
    references: [
      'Merkle-Damgård construction',
      'Hash function padding',
      'Same as ISO/IEC 7816-4'
    ],
    testVectors: [
      {
        description: 'Bit padding for 16-byte block, 13 bytes input',
        input: Hex8ToBytes('6bc1bee22e409f96e93d7e11739317'),
        blockSize: 16,
        expected: Hex8ToBytes('6bc1bee22e409f96e93d7e11739317800000')
      },
      {
        description: 'Bit padding for full block',
        input: Hex8ToBytes('6bc1bee22e409f96e93d7e117393172a'),
        blockSize: 16,
        expected: Hex8ToBytes('6bc1bee22e409f96e93d7e117393172a8000000000000000000000000000000000')
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('Bit Padding', {
      szName: 'Bit Padding',
      szCategory: 'padding',
      szCountry: 'International',
      nYear: 1980,
      metadata: BitPaddingMetadata,
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
        
        // Find the last 0x80 byte (the '1' bit)
        let paddingStart = -1;
        for (let i = paddedData.length - 1; i >= 0; i--) {
          if (paddedData[i] === 0x80) {
            paddingStart = i;
            break;
          } else if (paddedData[i] !== 0x00) {
            throw new Error('Invalid bit padding');
          }
        }
        
        if (paddingStart === -1) {
          throw new Error('Invalid bit padding - no 0x80 byte found');
        }
        
        return paddedData.slice(0, paddingStart);
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);