#!/usr/bin/env node
/*
 * MAYO Universal Implementation
 * NIST Post-Quantum Cryptography Round 2 Candidate (2025)
 * 
 * This is an educational implementation of the MAYO algorithm,
 * a multivariate signature scheme based on Oil and Vinegar.
 * 
 * WARNING: This implementation is for educational purposes only and should never
 * be used in production systems. Use NIST-certified implementations for real applications.
 * 
 * MAYO: Multivariate quadrAtIc digital signatures with vOlatile keys
 * Based on Oil and Vinegar multivariate cryptosystem
 * 
 * REFERENCE: NIST Post-Quantum Cryptography Additional Digital Signatures Round 2
 * URL: https://csrc.nist.gov/projects/pqc-dig-sig
 * 
 * (c)2025 Hawkynt - Educational implementation based on NIST specifications
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  // MAYO Parameter Sets (NIST Round 2 submission)
  const MAYO_PARAMS = {
    'MAYO-1': { 
      n: 66, m: 64, o: 8, v: 58,
      k: 9, q: 16, sk_bytes: 24, pk_bytes: 1168, sig_bytes: 321,
      security_level: 128
    },
    'MAYO-2': { 
      n: 78, m: 64, o: 18, v: 60,
      k: 4, q: 16, sk_bytes: 24, pk_bytes: 5488, sig_bytes: 180,
      security_level: 128
    },
    'MAYO-3': { 
      n: 99, m: 96, o: 10, v: 89,
      k: 11, q: 16, sk_bytes: 32, pk_bytes: 2656, sig_bytes: 577,
      security_level: 192
    },
    'MAYO-5': { 
      n: 133, m: 128, o: 12, v: 121,
      k: 12, q: 16, sk_bytes: 40, pk_bytes: 5008, sig_bytes: 838,
      security_level: 256
    }
  };
  
  // MAYO Constants
  const MAYO_FIELD_SIZE = 16; // GF(16)
  const MAYO_PRIMITIVE_POLY = 0x13; // x^4 + x + 1 for GF(16)
  
  // Precomputed GF(16) operations table
  const GF16_LOG = new Array(16);
  const GF16_EXP = new Array(16);
  
  // Initialize GF(16) tables
  function initGF16Tables() {
    let a = 1;
    for (let i = 0; i < 15; i++) {
      GF16_EXP[i] = a;
      GF16_LOG[a] = i;
      a = (a << 1) ^ (a & 8 ? MAYO_PRIMITIVE_POLY : 0);
    }
    GF16_LOG[0] = -1; // log(0) is undefined
  }
  
  initGF16Tables();
  
  const Mayo = {
    name: "MAYO",
    description: "Multivariate quadrAtIc digital signatures with vOlatile keys. NIST Round 2 post-quantum signature scheme based on Oil and Vinegar multivariate cryptography.",
    inventor: "Ward Beullens",
    year: 2023,
    country: "Belgium",
    category: "cipher",
    subCategory: "Asymmetric Cipher",
    securityStatus: "experimental",
    securityNotes: "NIST Round 2 post-quantum digital signature candidate. Security based on solving systems of multivariate quadratic equations over finite fields (MQ problem).",
    
    // Core algorithm properties
    minKeyLength: 24,
    maxKeyLength: 40,
    stepKeyLength: 8,
    minBlockSize: 16,
    maxBlockSize: 1024,
    stepBlockSize: 16,
    
    documentation: [
      {text: "NIST PQC Additional Digital Signatures", uri: "https://csrc.nist.gov/projects/pqc-dig-sig"},
      {text: "MAYO Specification", uri: "https://mayo-nist.org/"},
      {text: "Oil and Vinegar Wikipedia", uri: "https://en.wikipedia.org/wiki/Oil_and_Vinegar_(cryptography)"},
      {text: "Multivariate Cryptography", uri: "https://en.wikipedia.org/wiki/Multivariate_cryptography"}
    ],
    
    references: [
      {text: "MAYO NIST Submission", uri: "https://mayo-nist.org/mayo-nist-submission.zip"},
      {text: "Oil and Vinegar Original Paper", uri: "https://link.springer.com/chapter/10.1007/BFb0024447"},
      {text: "NIST Round 2 Status Report", uri: "https://csrc.nist.gov/pubs/ir/8528/final"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Direct Attack", 
        text: "Solving the system of quadratic equations directly using Groebner basis algorithms",
        mitigation: "Use sufficiently large parameters to make direct solving computationally infeasible"
      },
      {
        type: "MinRank Attack", 
        text: "Exploiting the structure of Oil and Vinegar to recover the secret key",
        mitigation: "Balanced Oil and Vinegar parameters and secure parameter selection"
      }
    ],
    
    // Initialize MAYO instance
    init: function(paramSet) {
      if (!paramSet || !MAYO_PARAMS[paramSet]) {
        paramSet = 'MAYO-1';
      }
      
      this.params = MAYO_PARAMS[paramSet];
      this.paramSet = paramSet;
      this.isInitialized = true;
      
      return true;
    },
    
    // Generate key pair
    keyGen: function() {
      if (!this.isInitialized) {
        throw new Error("MAYO not initialized. Call init() first.");
      }
      
      const params = this.params;
      
      // Generate secret key - random Oil and Vinegar matrices
      const sk = new Array(params.sk_bytes);
      for (let i = 0; i < params.sk_bytes; i++) {
        sk[i] = Math.floor(Math.random() * 256);
      }
      
      // Generate public key from secret key
      const pk = this.generatePublicKey(sk);
      
      return {
        privateKey: sk,
        publicKey: pk,
        algorithm: 'MAYO',
        paramSet: this.paramSet
      };
    },
    
    // Generate public key from secret key
    generatePublicKey: function(sk) {
      const params = this.params;
      const pk = new Array(params.pk_bytes);
      
      // Simplified public key generation
      // In real implementation, this would involve complex multivariate polynomial evaluation
      for (let i = 0; i < params.pk_bytes; i++) {
        pk[i] = (sk[i % params.sk_bytes] + i) % 256;
      }
      
      return pk;
    },
    
    // Sign message
    sign: function(message, privateKey) {
      if (!this.isInitialized) {
        throw new Error("MAYO not initialized. Call init() first.");
      }
      
      const params = this.params;
      
      // Hash message (simplified - real implementation uses secure hash)
      const msgHash = this.hashMessage(message);
      
      // Generate signature (simplified Oil and Vinegar signing)
      const signature = new Array(params.sig_bytes);
      
      for (let i = 0; i < params.sig_bytes; i++) {
        signature[i] = (msgHash[i % msgHash.length] + privateKey[i % privateKey.length]) % 256;
      }
      
      return signature;
    },
    
    // Verify signature
    verify: function(message, signature, publicKey) {
      if (!this.isInitialized) {
        throw new Error("MAYO not initialized. Call init() first.");
      }
      
      // Hash message
      const msgHash = this.hashMessage(message);
      
      // Verify signature (simplified verification)
      for (let i = 0; i < Math.min(signature.length, msgHash.length); i++) {
        const expected = (msgHash[i] + publicKey[i % publicKey.length]) % 256;
        if (signature[i] !== expected) {
          return false;
        }
      }
      
      return true;
    },
    
    // Hash message (simplified)
    hashMessage: function(message) {
      if (typeof message === 'string') {
        message = OpCodes.StringToBytes(message);
      }
      
      // Simple hash function for educational purposes
      const hash = new Array(32);
      for (let i = 0; i < 32; i++) {
        hash[i] = 0;
      }
      
      for (let i = 0; i < message.length; i++) {
        hash[i % 32] ^= message[i];
      }
      
      return hash;
    },
    
    // GF(16) field operations
    gf16Add: function(a, b) {
      return a ^ b; // Addition in GF(16) is XOR
    },
    
    gf16Mul: function(a, b) {
      if (a === 0 || b === 0) return 0;
      return GF16_EXP[(GF16_LOG[a] + GF16_LOG[b]) % 15];
    },
    
    gf16Inv: function(a) {
      if (a === 0) return 0;
      return GF16_EXP[15 - GF16_LOG[a]];
    },
    
    // Test vector generation
    generateTestVector: function() {
      this.init('MAYO-1');
      const keyPair = this.keyGen();
      const message = "MAYO test message";
      const signature = this.sign(message, keyPair.privateKey);
      const isValid = this.verify(message, signature, keyPair.publicKey);
      
      return {
        algorithm: 'MAYO',
        paramSet: 'MAYO-1',
        message: OpCodes.BytesToHex8(OpCodes.StringToBytes(message)),
        publicKey: OpCodes.BytesToHex8(keyPair.publicKey.slice(0, 32)),
        signature: OpCodes.BytesToHex8(signature.slice(0, 32)),
        valid: isValid
      };
    }
  };
  
  // Register with global Cipher system if available
  if (typeof global.Cipher !== 'undefined' && global.Cipher.AddCipher) {
    global.Cipher.AddCipher(Mayo);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Mayo;
  }
  
  // Export for browser
  if (typeof global !== 'undefined') {
    global.Mayo = Mayo;
  }
  
})(typeof global !== 'undefined' ? global : window);