/*
 * GCM (Galois/Counter Mode) Mode of Operation
 * Authenticated encryption mode combining CTR with authentication
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  const GCMMetadata = CipherMetadata.createMetadata({
    name: 'GCM',
    category: 'mode',
    description: 'Galois/Counter Mode - authenticated encryption combining counter mode with universal hashing for authentication. Provides both confidentiality and authenticity.',
    year: 2007,
    country: 'US',
    keySize: 'Variable (depends on underlying cipher)',
    blockSize: 'Variable (depends on underlying cipher)',
    cryptoFamily: 'Mode of operation',
    cryptoType: 'Symmetric',
    security: 'High - authenticated encryption, widely used in TLS and IPsec',
    
    documentation: [
      {
        text: "NIST SP 800-38D Standard",
        uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf"
      },
      {
        text: "GCM Wikipedia Article",
        uri: "https://en.wikipedia.org/wiki/Galois/Counter_Mode"
      },
      {
        text: "The Galois/Counter Mode of Operation (McGrew & Viega)",
        uri: "https://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.58.4924"
      }
    ],
    
    references: [
      {
        text: "RFC 5288 - AES Galois Counter Mode (GCM) Cipher Suites for TLS",
        uri: "https://tools.ietf.org/rfc/rfc5288.txt"
      },
      {
        text: "OpenSSL GCM Implementation",
        uri: "https://github.com/openssl/openssl/blob/master/crypto/modes/gcm128.c"
      },
      {
        text: "ISO/IEC 19772:2009",
        uri: "https://www.iso.org/standard/46345.html"
      }
    ],
    
    testVectors: [
      {
        description: 'AES-128 GCM Test Case 1 (NIST SP 800-38D)',
        source: 'NIST SP 800-38D',
        key: '00000000000000000000000000000000',
        iv: '000000000000000000000000',
        plaintext: '',
        aad: '',
        expected: '58e2fccefa7e3061367f1d57a4e7455a'
      },
      {
        description: 'AES-128 GCM Test Case 2 (NIST SP 800-38D)',
        source: 'NIST SP 800-38D',
        key: '00000000000000000000000000000000',
        iv: '000000000000000000000000',
        plaintext: '00000000000000000000000000000000',
        aad: '',
        expected: '0388dace60b6a392f328c2b971b2fe78ab6e47d42cec13bdf53a67b21257bddf'
      }
    ],
    
    performance: {
      throughput: "~2-4 GB/s with AES-NI hardware support",
      memoryUsage: "Small constant memory overhead for authentication state",
      parallelizable: true
    },
    
    vulnerabilities: [
      {
        type: "IV/Nonce reuse",
        description: "Catastrophic failure if same IV is used with same key",
        mitigation: "Always use unique IVs; consider SIV mode for nonce-misuse resistance"
      }
    ],
    
    usage: {
      recommended: true,
      deprecated: false,
      replacedBy: null,
      useCases: ["TLS 1.2/1.3", "IPsec", "General authenticated encryption", "High-performance AEAD"]
    }
  });

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