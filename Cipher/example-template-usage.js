/*
 * Example: Using the Updated Metadata Template Structure
 * Shows how to implement an algorithm following Metadata-template.js
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const CipherMetadata = global.CipherMetadata || {};

  // Example algorithm using the exact template structure with proper security handling
  const ExampleAlgorithm = {
    name: "AES-GCM",
    description: "Advanced Encryption Standard in Galois/Counter Mode. Provides authenticated encryption combining AES block cipher with universal hashing. Widely used in TLS and modern cryptographic protocols.",
    inventor: "Joan Daemen, Vincent Rijmen (AES) + David McGrew, John Viega (GCM)",
    year: 2007,
    country: "BE", // Belgium for AES, US for GCM
    category: "cipher", // Using template categories
    subCategory: "Authenticated Encryption",
    securityStatus: null, // NEVER claim "secure" - null means not thoroughly analyzed by us
    securityNotes: "Widely used in production systems. Implementation requires careful IV handling. No known practical attacks as of implementation date.",
    
    documentation: [
      {text: "NIST SP 800-38D - GCM Standard", uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf"},
      {text: "AES-GCM Wikipedia", uri: "https://en.wikipedia.org/wiki/Galois/Counter_Mode"},
      {text: "RFC 5288 - AES GCM for TLS", uri: "https://tools.ietf.org/rfc/rfc5288.txt"}
    ],
    
    references: [
      {text: "OpenSSL GCM Implementation", uri: "https://github.com/openssl/openssl/blob/master/crypto/modes/gcm128.c"},
      {text: "Bouncy Castle Java", uri: "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/modes/GCMBlockCipher.java"},
      {text: "Go crypto/cipher GCM", uri: "https://github.com/golang/go/blob/master/src/crypto/cipher/gcm.go"}
    ],
    
    knownVulnerabilities: [
      {
        type: "IV/Nonce reuse", 
        text: "Catastrophic failure if the same IV is used twice with the same key. Complete loss of confidentiality and authenticity.",
        mitigation: "Always ensure IV uniqueness. Consider using deterministic construction or SIV mode for nonce-misuse resistance."
      },
      {
        type: "Weak random IV",
        text: "Using predictable or weak random number generators for IV generation can lead to collisions.",
        mitigation: "Use cryptographically secure random number generator for IV generation."
      }
    ],
    
    tests: [
      // AES-128-GCM test vector from NIST
      {
        text: "NIST Test Vector 1", 
        uri: "https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/cavp-testing-block-cipher-modes",
        keySize: 16, 
        blockSize: 16,
        input: Hex8ToBytes(""),
        key: Hex8ToBytes("00000000000000000000000000000000"), 
        expected: Hex8ToBytes("58e2fccefa7e3061367f1d57a4e7455a")
      },
      // AES-128-GCM with plaintext
      {
        text: "NIST Test Vector 2",
        uri: "https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/cavp-testing-block-cipher-modes",
        keySize: 16,
        blockSize: 16,
        input: Hex8ToBytes("00000000000000000000000000000000"),
        key: Hex8ToBytes("00000000000000000000000000000000"),
        expected: Hex8ToBytes("0388dace60b6a392f328c2b971b2fe78ab6e47d42cec13bdf53a67b21257bddf")
      }
    ]
  };

  // Register with the cipher system using our enhanced metadata
  if (typeof Cipher !== 'undefined' && Cipher.RegisterCipher) {
    const metadata = CipherMetadata.createMetadata(ExampleAlgorithm);
    
    Cipher.RegisterCipher('AES-GCM-Example', {
      szName: 'AES-GCM (Template Example)',
      szCategory: 'cipher',
      szCountry: 'BE/US',
      nYear: 2007,
      metadata: metadata,
      working: true,
      
      Init: function() {
        return true;
      },
      
      KeySetup: function(key) {
        return { key: key, id: Math.random() };
      },
      
      Encrypt: function(keyId, plaintext, iv, aad) {
        // Implementation would go here
        return { ciphertext: plaintext, tag: new Array(16).fill(0) };
      },
      
      Decrypt: function(keyId, ciphertext, iv, aad, tag) {
        // Implementation would go here
        return ciphertext;
      },
      
      ClearData: function(keyId) {
        return true;
      }
    });
  }

  // Export the example
  global.ExampleAlgorithm = ExampleAlgorithm;

})(typeof global !== 'undefined' ? global : window);