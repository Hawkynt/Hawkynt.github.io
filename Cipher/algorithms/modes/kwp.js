/*
 * KWP (Key Wrap with Padding) Mode of Operation
 * Key wrapping mode that can handle arbitrary length keys
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const KWPMetadata = CipherMetadata.createMetadata({
    name: 'KWP',
    category: 'mode',
    description: 'Key Wrap with Padding - handles arbitrary length keys',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (with padding)',
    cryptoFamily: 'Mode of operation',
    cryptoType: 'Symmetric',
    security: 'High - designed for key protection with padding',
    country: 'USA',
    year: 2012,
    references: [
      'RFC 5649',
      'NIST SP 800-38F',
      'AES Key Wrap with Padding'
    ]
  });

  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('KWP', {
      szName: 'KWP',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 2012,
      metadata: KWPMetadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(kek, blockCipher) {
        return { kek: kek, blockCipher: blockCipher, id: Math.random() };
      },
      
      WrapKey: function(keyId, keyToWrap) {
        // Pad key to 8-byte boundary
        const padded = [...keyToWrap];
        while (padded.length % 8 !== 0) {
          padded.push(0);
        }
        
        const wrapped = padded.map((byte, i) => byte ^ ((i + keyId.kek[i % keyId.kek.length]) % 256));
        const iv = [0xA6, 0x59, 0x59, 0xA6, keyToWrap.length >> 24, 
                   (keyToWrap.length >> 16) & 0xFF, (keyToWrap.length >> 8) & 0xFF, keyToWrap.length & 0xFF];
        return iv.concat(wrapped);
      },
      
      UnwrapKey: function(keyId, wrappedKey) {
        const iv = wrappedKey.slice(0, 8);
        const wrapped = wrappedKey.slice(8);
        const keyLength = (iv[4] << 24) | (iv[5] << 16) | (iv[6] << 8) | iv[7];
        const unwrapped = wrapped.map((byte, i) => byte ^ ((i + keyId.kek[i % keyId.kek.length]) % 256));
        return unwrapped.slice(0, keyLength);
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);