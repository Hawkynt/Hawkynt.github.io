/*
 * Zero Padding Scheme
 * Pads data with zero bytes to reach block size
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const ZeroPaddingMetadata = CipherMetadata.createMetadata({
    name: 'Zero Padding',
    category: 'padding',
    description: 'Zero byte padding - fills remaining bytes with zeros',
    keySize: 'N/A (padding scheme)',
    blockSize: 'Variable',
    cryptoFamily: 'Padding scheme',
    cryptoType: 'Symmetric',
    security: 'Weak - can cause ambiguity if data ends with zeros',
    country: 'International',
    year: 1970,
    references: [
      'ISO/IEC 9797-1',
      'Common padding method'
    ],
    testVectors: [
      {
        description: 'Zero padding for 16-byte block, 13 bytes input',
        input: '6bc1bee22e409f96e93d7e11739317',
        blockSize: 16,
        expected: '6bc1bee22e409f96e93d7e11739317000000'
      },
      {
        description: 'Zero padding for 8-byte block, 5 bytes input',
        input: '6bc1bee22e',
        blockSize: 8,
        expected: '6bc1bee22e000000'
      },
      {
        description: 'Zero padding for full block (no padding needed)',
        input: '6bc1bee22e409f96e93d7e117393172a',
        blockSize: 16,
        expected: '6bc1bee22e409f96e93d7e117393172a'
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('Zero Padding', {
      szName: 'Zero Padding',
      szCategory: 'padding',
      szCountry: 'International',
      nYear: 1970,
      metadata: ZeroPaddingMetadata,
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
          return data; // No padding needed
        }
        
        const padding = new Array(paddingLength).fill(0);
        return data.concat(padding);
      },
      
      UnpadData: function(keyId, paddedData) {
        // Warning: Zero padding removal is ambiguous
        // This removes trailing zeros, but can't distinguish padding from actual data
        let lastNonZero = paddedData.length - 1;
        while (lastNonZero >= 0 && paddedData[lastNonZero] === 0) {
          lastNonZero--;
        }
        
        return paddedData.slice(0, lastNonZero + 1);
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);