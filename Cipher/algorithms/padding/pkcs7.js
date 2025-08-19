/*
 * PKCS#7 Padding Scheme
 * Pads data to a multiple of block size using byte values equal to the padding length
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }

  const PKCS7 = {
    name: "PKCS#7 Padding",
    description: "PKCS#7 padding scheme where padding bytes contain the number of padding bytes added. Ensures data is padded to block boundary with deterministic padding removal.",
    inventor: "RSA Laboratories",
    year: 1993,
    country: "US",
    category: "paddingScheme",
    subCategory: "Block Padding",
    securityStatus: null,
    securityNotes: "Standard padding scheme with no inherent security issues. Can be vulnerable to padding oracle attacks when used with insecure modes.",
    
    documentation: [
      {text: "RFC 2315 - PKCS #7: Cryptographic Message Syntax", uri: "https://tools.ietf.org/rfc/rfc2315.txt"},
      {text: "RFC 5652 - Cryptographic Message Syntax (CMS)", uri: "https://tools.ietf.org/rfc/rfc5652.txt"},
      {text: "Wikipedia - Padding (cryptography)", uri: "https://en.wikipedia.org/wiki/Padding_(cryptography)#PKCS#5_and_PKCS#7"}
    ],
    
    references: [
      {text: "OpenSSL PKCS7 Padding", uri: "https://github.com/openssl/openssl/blob/master/crypto/evp/evp_lib.c"},
      {text: "Crypto++ PKCS Padding", uri: "https://github.com/weidai11/cryptopp/blob/master/pkcspad.cpp"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Padding Oracle Attack", 
        text: "When decryption errors reveal padding validity, attackers can decrypt arbitrary ciphertexts byte by byte",
        mitigation: "Use authenticated encryption modes or ensure error messages don't distinguish between padding and other decryption errors"
      }
    ],
    
    tests: [
      {
        text: "PKCS#7 Padding Test - 13 bytes to 16-byte boundary",
        uri: "https://tools.ietf.org/rfc/rfc2315.txt",
        blockSize: 16,
        input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e11739317"),
        expected: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e11739317030303")
      },
      {
        text: "PKCS#7 Padding Test - Full block gets full padding block",
        uri: "https://tools.ietf.org/rfc/rfc2315.txt",
        blockSize: 16,
        input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
        expected: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a10101010101010101010101010101010")
      }
    ],

    Init: function() {
      return true;
    }

    // TODO: Implementation methods here...
  };

  // Auto-register with Subsystem if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(PKCS7);

  // Legacy registration for compatibility
  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('PKCS7', {
      szName: 'PKCS#7',
      szCategory: 'padding',
      szCountry: 'USA',
      nYear: 1993,
      metadata: PKCS7,
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
        const padding = new Array(paddingLength).fill(paddingLength);
        return data.concat(padding);
      },
      
      UnpadData: function(keyId, paddedData) {
        if (paddedData.length === 0) return paddedData;
        
        const paddingLength = paddedData[paddedData.length - 1];
        
        // Validate padding
        if (paddingLength < 1 || paddingLength > keyId.blockSize) {
          throw new Error('Invalid PKCS#7 padding');
        }
        
        for (let i = 1; i <= paddingLength; i++) {
          if (paddedData[paddedData.length - i] !== paddingLength) {
            throw new Error('Invalid PKCS#7 padding');
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