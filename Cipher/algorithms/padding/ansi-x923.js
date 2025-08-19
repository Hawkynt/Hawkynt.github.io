/*
 * ANSI X9.23 Padding Scheme
 * Pads with zeros except last byte indicates padding length
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const ANSIX923Metadata = CipherMetadata.createMetadata({
    name: 'ANSI X9.23',
    category: 'padding',
    description: 'ANSI X9.23 padding - zeros with length byte at end',
    keySize: 'N/A (padding scheme)',
    blockSize: 'Variable (1-255 bytes)',
    cryptoFamily: 'Padding scheme',
    cryptoType: 'Symmetric',
    security: 'Standard - used in financial applications',
    country: 'USA',
    year: 1998,
    references: [
      'ANSI X9.23',
      'Financial cryptographic standards',
      'Alternative to PKCS#7'
    ],
    testVectors: [
      {
        description: 'ANSI X9.23 padding for 16-byte block, 13 bytes input',
        input: OpCodes.Hex8ToBytes('6bc1bee22e409f96e93d7e11739317'),
        blockSize: 16,
        expected: OpCodes.Hex8ToBytes('6bc1bee22e409f96e93d7e11739317000003')
      },
      {
        description: 'ANSI X9.23 padding for 8-byte block, 5 bytes input', 
        input: OpCodes.Hex8ToBytes('6bc1bee22e'),
        blockSize: 8,
        expected: OpCodes.Hex8ToBytes('6bc1bee22e000003')
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('ANSI X9.23', {
      szName: 'ANSI X9.23',
      szCategory: 'padding',
      szCountry: 'USA',
      nYear: 1998,
      metadata: ANSIX923Metadata,
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
        
        // Create padding: zeros followed by length byte
        const padding = new Array(paddingLength - 1).fill(0);
        padding.push(paddingLength);
        
        return data.concat(padding);
      },
      
      UnpadData: function(keyId, paddedData) {
        if (paddedData.length === 0) return paddedData;
        
        const paddingLength = paddedData[paddedData.length - 1];
        
        // Validate padding length
        if (paddingLength < 1 || paddingLength > keyId.blockSize) {
          throw new Error('Invalid ANSI X9.23 padding');
        }
        
        // Check that padding bytes (except last) are zeros
        for (let i = paddedData.length - paddingLength; i < paddedData.length - 1; i++) {
          if (paddedData[i] !== 0) {
            throw new Error('Invalid ANSI X9.23 padding');
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