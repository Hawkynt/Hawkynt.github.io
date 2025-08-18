/*
 * PKCS#1 Padding Scheme
 * RSA encryption/signature padding scheme
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const PKCS1Metadata = CipherMetadata.createMetadata({
    name: 'PKCS#1',
    category: 'padding',
    description: 'PKCS#1 v1.5 padding - for RSA encryption and signatures',
    keySize: 'N/A (padding scheme)',
    blockSize: 'Variable (RSA key size)',
    cryptoFamily: 'Padding scheme',
    cryptoType: 'Asymmetric',
    security: 'Standard - widely used for RSA',
    country: 'USA',
    year: 1991,
    references: [
      'RFC 8017 (PKCS #1 v2.2)',
      'RFC 2437 (PKCS #1 v2.0)',
      'RSA Security'
    ],
    testVectors: [
      {
        description: 'PKCS#1 v1.5 encryption padding',
        message: '6bc1bee22e409f96e93d7e11739317',
        blockSize: 128,
        paddingType: 'encryption',
        expected: '0002[random_bytes]006bc1bee22e409f96e93d7e11739317'
      }
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('PKCS1', {
      szName: 'PKCS#1',
      szCategory: 'padding',
      szCountry: 'USA',
      nYear: 1991,
      metadata: PKCS1Metadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(keySize, paddingType) {
        return { keySize: keySize || 256, paddingType: paddingType || 'encryption', id: Math.random() };
      },
      
      PadData: function(keyId, data, paddingType) {
        const keySize = keyId.keySize;
        const maxDataLength = keySize - 11; // PKCS#1 overhead
        
        if (data.length > maxDataLength) {
          throw new Error('Data too long for PKCS#1 padding');
        }
        
        const paddingLength = keySize - data.length - 3;
        let padding;
        
        if (paddingType === 'signature' || keyId.paddingType === 'signature') {
          padding = new Array(paddingLength).fill(0xFF);
          return [0x00, 0x01].concat(padding).concat([0x00]).concat(data);
        } else {
          // Encryption padding with random bytes
          padding = new Array(paddingLength).fill(0).map(() => Math.floor(Math.random() * 254) + 1);
          return [0x00, 0x02].concat(padding).concat([0x00]).concat(data);
        }
      },
      
      UnpadData: function(keyId, paddedData) {
        if (paddedData.length < 11) {
          throw new Error('Invalid PKCS#1 padding');
        }
        
        if (paddedData[0] !== 0x00) {
          throw new Error('Invalid PKCS#1 padding - missing leading zero');
        }
        
        const blockType = paddedData[1];
        if (blockType !== 0x01 && blockType !== 0x02) {
          throw new Error('Invalid PKCS#1 padding - invalid block type');
        }
        
        let separatorIndex = -1;
        for (let i = 2; i < paddedData.length; i++) {
          if (paddedData[i] === 0x00) {
            separatorIndex = i;
            break;
          }
        }
        
        if (separatorIndex === -1 || separatorIndex < 10) {
          throw new Error('Invalid PKCS#1 padding - no separator found');
        }
        
        return paddedData.slice(separatorIndex + 1);
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);