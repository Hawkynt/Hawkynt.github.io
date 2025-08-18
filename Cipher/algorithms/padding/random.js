/*
 * Random Padding Scheme
 * Fills with random bytes to reach block size
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const RandomPaddingMetadata = CipherMetadata.createMetadata({
    name: 'Random Padding',
    category: 'padding',
    description: 'Random byte padding - ambiguous removal, provides some obfuscation',
    keySize: 'N/A (padding scheme)',
    blockSize: 'Variable',
    cryptoFamily: 'Padding scheme',
    cryptoType: 'Symmetric',
    security: 'Weak - ambiguous padding removal',
    country: 'International',
    year: 1970,
    references: [
      'Early encryption systems',
      'Not recommended for modern use'
    ],
    testVectors: [
      {
        description: 'Random padding for 16-byte block, 13 bytes input',
        input: Hex8ToBytes('6bc1bee22e409f96e93d7e11739317'),
        blockSize: 16,
        expected: '6bc1bee22e409f96e93d7e11739317[random][random][random]'
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('Random Padding', {
      szName: 'Random Padding',
      szCategory: 'padding',
      szCountry: 'International',
      nYear: 1970,
      metadata: RandomPaddingMetadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(blockSize, paddingLength) {
        return { 
          blockSize: blockSize || 16,
          paddingLength: paddingLength || null, // If null, pad to block boundary
          id: Math.random() 
        };
      },
      
      PadData: function(keyId, data) {
        const blockSize = keyId.blockSize;
        let paddingLength;
        
        if (keyId.paddingLength !== null) {
          paddingLength = keyId.paddingLength;
        } else {
          paddingLength = blockSize - (data.length % blockSize);
          if (paddingLength === blockSize) {
            paddingLength = 0; // No padding needed
          }
        }
        
        if (paddingLength === 0) {
          return data;
        }
        
        const padding = new Array(paddingLength).fill(0).map(() => Math.floor(Math.random() * 256));
        return data.concat(padding);
      },
      
      UnpadData: function(keyId, paddedData, originalLength) {
        // Warning: Random padding removal is ambiguous without knowing original length
        if (originalLength !== undefined) {
          return paddedData.slice(0, originalLength);
        } else {
          console.warn('Random padding removal is ambiguous - original length required');
          return paddedData; // Can't safely remove padding
        }
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);