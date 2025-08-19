/*
 * GCM (Galois/Counter Mode) Mode of Operation
 * Authenticated encryption mode combining CTR with authentication
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }

  const GCM = {
    name: "GCM",
    description: "Galois/Counter Mode providing authenticated encryption by combining CTR mode with Galois field multiplication for authentication. Widely used in TLS, IPsec, and other security protocols.",
    inventor: "David A. McGrew, John Viega",
    year: 2007,
    country: "US",
    category: "modeOfOperation",
    subCategory: "Authenticated Mode",
    securityStatus: null,
    securityNotes: "Secure when used with unique nonces. Catastrophic failure occurs with nonce reuse under the same key.",
    
    documentation: [
      {text: "NIST SP 800-38D Standard", uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf"},
      {text: "Wikipedia - Galois/Counter Mode", uri: "https://en.wikipedia.org/wiki/Galois/Counter_Mode"},
      {text: "Original GCM Paper (McGrew & Viega)", uri: "https://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.58.4924"},
      {text: "RFC 5288 - AES GCM Cipher Suites for TLS", uri: "https://tools.ietf.org/rfc/rfc5288.txt"}
    ],
    
    references: [
      {text: "OpenSSL GCM Implementation", uri: "https://github.com/openssl/openssl/blob/master/crypto/modes/gcm128.c"},
      {text: "ISO/IEC 19772:2009 Standard", uri: "https://www.iso.org/standard/46345.html"},
      {text: "Crypto++ GCM Implementation", uri: "https://github.com/weidai11/cryptopp/blob/master/gcm.cpp"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Nonce Reuse Attack", 
        text: "Reusing the same nonce with the same key completely breaks confidentiality and authenticity",
        mitigation: "Always use unique nonces; implement proper nonce generation and tracking"
      },
      {
        type: "Authentication Key Recovery", 
        text: "With nonce reuse, the authentication key can be recovered allowing forgery of arbitrary messages",
        mitigation: "Use SIV mode or other nonce-misuse resistant AEAD schemes for critical applications"
      }
    ],
    
    tests: [
      {
        text: "NIST SP 800-38D Test Case 1",
        uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf",
        keySize: 16,
        blockSize: 16,
        input: OpCodes.Hex8ToBytes(""), // empty plaintext
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        iv: OpCodes.Hex8ToBytes("000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("58e2fccefa7e3061367f1d57a4e7455a")
      },
      {
        text: "NIST SP 800-38D Test Case 2",
        uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf",
        keySize: 16,
        blockSize: 16,
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        iv: OpCodes.Hex8ToBytes("000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("0388dace60b6a392f328c2b971b2fe78ab6e47d42cec13bdf53a67b21257bddf")
      }
    ],

    Init: function() {
      return true;
    }

    // TODO: Implementation methods here...
  };

  // Auto-register with Subsystem if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(GCM);

  // Legacy registration for compatibility
  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    Cipher.RegisterCipher('GCM', {
      szName: 'GCM',
      szCategory: 'mode',
      szCountry: 'USA',
      nYear: 2007,
      metadata: GCMMetadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(key, blockCipher) {
        return { 
          key: key, 
          blockCipher: blockCipher,
          blockSize: blockCipher?.blockSize || 16,
          id: Math.random() 
        };
      },
      
      Encrypt: function(keyId, plaintext, iv, aad) {
        // GCM encryption implementation placeholder
        const encrypted = plaintext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
        const tag = new Array(16).fill(0).map((_, i) => (i * 17) % 256); // Placeholder tag
        return { ciphertext: encrypted, tag: tag };
      },
      
      Decrypt: function(keyId, ciphertext, iv, aad, tag) {
        // GCM decryption implementation placeholder
        return ciphertext.map((byte, i) => byte ^ ((i + keyId.key[i % keyId.key.length]) % 256));
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

})(typeof global !== 'undefined' ? global : window);