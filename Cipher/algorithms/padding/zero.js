/*
 * Zero Padding Scheme
 * Pads data with zero bytes to reach block size
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const ZeroPaddingMetadata = {
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
        input: OpCodes.Hex8ToBytes('6bc1bee22e409f96e93d7e11739317'),
        blockSize: 16,
        expected: OpCodes.Hex8ToBytes('6bc1bee22e409f96e93d7e11739317000000')
      },
      {
        description: 'Zero padding for 8-byte block, 5 bytes input',
        input: OpCodes.Hex8ToBytes('6bc1bee22e'),
        blockSize: 8,
        expected: OpCodes.Hex8ToBytes('6bc1bee22e000000')
      },
      {
        description: 'Zero padding for full block (no padding needed)',
        input: OpCodes.Hex8ToBytes('6bc1bee22e409f96e93d7e117393172a'),
        blockSize: 16,
        expected: OpCodes.Hex8ToBytes('6bc1bee22e409f96e93d7e117393172a')
      }
    ]
  };

  const ZeroPadding = {
    internalName: 'ZeroPadding',
    name: 'Zero Padding',
    comment: 'Pads data with zero bytes to reach block size. WARNING: Ambiguous when data ends with zeros',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 512,
    stepBlockSize: 1,
    metadata: ZeroPaddingMetadata,
    
    Init: function() {
      return true;
    },
    
    KeySetup: function(blockSize) {
      return { blockSize: blockSize || 16, id: Math.random() };
    },
    
    EncryptBlock: function(keyId, data) {
      // For padding schemes, EncryptBlock performs padding
      const blockSize = keyId.blockSize;
      const paddingLength = blockSize - (data.length % blockSize);
      
      if (paddingLength === blockSize) {
        return data; // No padding needed
      }
      
      let result = data;
      for (let i = 0; i < paddingLength; i++) {
        result += String.fromCharCode(0);
      }
      return result;
    },
    
    DecryptBlock: function(keyId, paddedData) {
      // For padding schemes, DecryptBlock performs unpadding
      // Warning: Zero padding removal is ambiguous
      let result = paddedData;
      while (result.length > 0 && result.charCodeAt(result.length - 1) === 0) {
        result = result.slice(0, -1);
      }
      return result;
    },
    
    ClearData: function(keyId) {
      return true;
    },
    
    instances: {
      ZeroPadding: function() { return ZeroPadding; }
    }
  };

  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(ZeroPadding);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(ZeroPadding);
  }

  // Legacy registration for compatibility
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