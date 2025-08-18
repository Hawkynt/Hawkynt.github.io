#!/usr/bin/env node
/*
 * Universal Fiat-Shamir Zero-Knowledge Protocol
 * Compatible with both Browser and Node.js environments
 * Based on Fiat-Shamir 1986 identification scheme
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of the Fiat-Shamir zero-knowledge proof protocol.
 * Demonstrates how to prove knowledge of a secret without revealing it.
 * Uses the square root problem modulo composite numbers for security.
 * 
 * WARNING: This implementation is for educational purposes only.
 * Use cryptographically reviewed implementations for production systems.
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes.js:', e.message);
      return;
    }
  }
  
  // Load hash functions for random oracle
  if (typeof require !== 'undefined') {
    try {
      require('../hash/sha256.js');
    } catch (e) {
      console.error('Failed to load SHA-256:', e.message);
    }
  }
  
  // Ensure environment dependencies are available
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('Fiat-Shamir requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Fiat-Shamir Constants
  const FS_CONSTANTS = {
    DEFAULT_MODULUS_BITS: 1024,   // RSA modulus size
    MIN_SECURITY_ROUNDS: 20,      // Minimum rounds for security
    MAX_SECURITY_ROUNDS: 100,     // Maximum practical rounds
    SMALL_PRIMES: [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47],
    CHALLENGE_BITS: 1             // Binary challenge (0 or 1)
  };
  
  const FiatShamir = {
    internalName: 'fiat-shamir',
    name: 'Fiat-Shamir Protocol',
    
    // Required Cipher interface properties
    minKeyLength: 0,         // No traditional key
    maxKeyLength: 0,         // Uses generated parameters
    stepKeyLength: 1,        // N/A
    minBlockSize: 0,         // Protocol-based
    maxBlockSize: 0,         // No message encryption
    stepBlockSize: 1,        // N/A
    instances: {},           // Instance tracking
    
    // Metadata
    version: '1.0.0',
    date: '2025-01-17',
    author: 'Amos Fiat and Adi Shamir (1986) - Educational Implementation',
    description: 'Zero-Knowledge Identification Protocol using Quadratic Residues',
    reference: 'FS86: How to prove yourself: practical solutions to identification and signature problems',
    
    // Security parameters
    defaultModulusBits: 1024,
    defaultSecurityRounds: 40,
    
    /**
     * Initialize Fiat-Shamir instance
     */
    Init: function() {
      const instance = {
        // Public parameters
        n: null,                // Modulus n = p * q
        v: [],                  // Public keys (quadratic residues)
        
        // Secret parameters (prover only)
        p: null,                // First prime (secret)
        q: null,                // Second prime (secret)
        s: [],                  // Secret keys (square roots)
        
        // Protocol state
        securityRounds: FS_CONSTANTS.MIN_SECURITY_ROUNDS,
        modulusBits: FS_CONSTANTS.DEFAULT_MODULUS_BITS,
        numSecrets: 1,          // Number of secret values
        
        // Session data
        commitments: [],        // Prover commitments (x values)
        challenges: [],         // Verifier challenges (e values)
        responses: [],          // Prover responses (y values)
        
        initialized: false,
        isProver: false,
        isVerifier: false
      };
      
      const instanceId = Math.random().toString(36).substr(2, 9);
      this.instances[instanceId] = instance;
      return instanceId;
    },
    
    /**
     * Generate Fiat-Shamir parameters (done by trusted setup or prover)
     */
    GenerateParameters: function(instanceId, modulusBits = 1024, numSecrets = 1) {
      const instance = this.instances[instanceId];
      if (!instance) {
        throw new Error('Invalid Fiat-Shamir instance ID');
      }
      
      if (modulusBits < 512 || modulusBits > 4096) {
        throw new Error('Modulus size must be between 512 and 4096 bits');
      }
      
      if (numSecrets < 1 || numSecrets > 10) {
        throw new Error('Number of secrets must be between 1 and 10');
      }
      
      instance.modulusBits = modulusBits;
      instance.numSecrets = numSecrets;
      
      // Generate two prime numbers
      const primeBits = Math.floor(modulusBits / 2);
      instance.p = this.generateBlumPrime(primeBits);
      instance.q = this.generateBlumPrime(primeBits);
      
      // Ensure primes are different
      while (instance.p === instance.q) {
        instance.q = this.generateBlumPrime(primeBits);
      }
      
      // Calculate modulus
      instance.n = instance.p * instance.q;
      
      // Generate secret keys and corresponding public keys
      instance.s = [];
      instance.v = [];
      
      for (let i = 0; i < numSecrets; i++) {
        // Generate random secret s_i relatively prime to n
        let secret;
        do {
          secret = this.secureRandomRange(1, instance.n);
        } while (this.gcd(secret, instance.n) !== 1);
        
        instance.s.push(secret);
        
        // Calculate public key v_i = s_i^2 mod n
        const publicKey = this.modMul(secret, secret, instance.n);
        instance.v.push(publicKey);
      }
      
      instance.initialized = true;
      instance.isProver = true;
      
      return {
        modulus: instance.n,
        publicKeys: instance.v.slice(),
        modulusBits: modulusBits,
        numSecrets: numSecrets
      };
    },
    
    /**
     * Setup verifier with public parameters
     */
    SetupVerifier: function(instanceId, publicParams) {
      const instance = this.instances[instanceId];
      if (!instance) {
        throw new Error('Invalid Fiat-Shamir instance ID');
      }
      
      if (!publicParams || !publicParams.modulus || !publicParams.publicKeys) {
        throw new Error('Invalid public parameters');
      }
      
      instance.n = publicParams.modulus;
      instance.v = publicParams.publicKeys.slice();
      instance.numSecrets = publicParams.publicKeys.length;
      instance.modulusBits = publicParams.modulusBits || 1024;
      
      instance.initialized = true;
      instance.isVerifier = true;
      
      return true;
    },
    
    /**
     * Start zero-knowledge proof session
     */
    StartProof: function(instanceId, securityRounds = 40) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.initialized) {
        throw new Error('Fiat-Shamir instance not properly initialized');
      }
      
      if (securityRounds < FS_CONSTANTS.MIN_SECURITY_ROUNDS || 
          securityRounds > FS_CONSTANTS.MAX_SECURITY_ROUNDS) {
        throw new Error('Security rounds must be between ' + 
                       FS_CONSTANTS.MIN_SECURITY_ROUNDS + ' and ' + 
                       FS_CONSTANTS.MAX_SECURITY_ROUNDS);
      }
      
      instance.securityRounds = securityRounds;
      instance.commitments = [];
      instance.challenges = [];
      instance.responses = [];
      
      return true;
    },
    
    /**
     * Prover: Generate commitment for one round
     */
    ProverCommit: function(instanceId) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.isProver) {
        throw new Error('Instance must be initialized as prover');
      }
      
      // Generate random value r
      const r = this.secureRandomRange(1, instance.n);
      
      // Compute commitment x = r^2 mod n
      const commitment = this.modMul(r, r, instance.n);
      
      // Store commitment and random value
      instance.commitments.push({
        x: commitment,
        r: r
      });
      
      return commitment;
    },
    
    /**
     * Verifier: Generate random challenge
     */
    VerifierChallenge: function(instanceId) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.isVerifier) {
        throw new Error('Instance must be initialized as verifier');
      }
      
      // Generate random binary challenge for each secret
      const challenge = [];
      for (let i = 0; i < instance.numSecrets; i++) {
        challenge.push(Math.random() < 0.5 ? 0 : 1);
      }
      
      instance.challenges.push(challenge);
      return challenge;
    },
    
    /**
     * Prover: Generate response to challenge
     */
    ProverRespond: function(instanceId, challenge) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.isProver) {
        throw new Error('Instance must be initialized as prover');
      }
      
      const roundIndex = instance.responses.length;
      if (roundIndex >= instance.commitments.length) {
        throw new Error('No commitment available for response');
      }
      
      const commitment = instance.commitments[roundIndex];
      const response = [];
      
      // For each secret
      for (let i = 0; i < instance.numSecrets; i++) {
        const e_i = challenge[i];
        
        if (e_i === 0) {
          // If challenge bit is 0, reveal r
          response.push(commitment.r);
        } else {
          // If challenge bit is 1, reveal r * s_i mod n
          const y = this.modMul(commitment.r, instance.s[i], instance.n);
          response.push(y);
        }
      }
      
      instance.responses.push(response);
      return response;
    },
    
    /**
     * Verifier: Verify prover's response
     */
    VerifierVerify: function(instanceId, commitment, challenge, response) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.isVerifier) {
        throw new Error('Instance must be initialized as verifier');
      }
      
      // Verify each part of the response
      for (let i = 0; i < instance.numSecrets; i++) {
        const e_i = challenge[i];
        const y_i = response[i];
        
        if (e_i === 0) {
          // Verify y_i^2 = x mod n
          const leftSide = this.modMul(y_i, y_i, instance.n);
          if (leftSide !== commitment) {
            return false;
          }
        } else {
          // Verify y_i^2 = x * v_i mod n
          const leftSide = this.modMul(y_i, y_i, instance.n);
          const rightSide = this.modMul(commitment, instance.v[i], instance.n);
          if (leftSide !== rightSide) {
            return false;
          }
        }
      }
      
      return true;
    },
    
    /**
     * Run complete interactive proof
     */
    RunInteractiveProof: function(proverId, verifierId) {
      const prover = this.instances[proverId];
      const verifier = this.instances[verifierId];
      
      if (!prover || !prover.isProver || !verifier || !verifier.isVerifier) {
        throw new Error('Both prover and verifier instances required');
      }
      
      const transcript = [];
      let allRoundsValid = true;
      
      for (let round = 0; round < prover.securityRounds; round++) {
        // Prover commits
        const commitment = this.ProverCommit(proverId);
        
        // Verifier challenges
        const challenge = this.VerifierChallenge(verifierId);
        
        // Prover responds
        const response = this.ProverRespond(proverId, challenge);
        
        // Verifier verifies
        const valid = this.VerifierVerify(verifierId, commitment, challenge, response);
        
        transcript.push({
          round: round,
          commitment: commitment,
          challenge: challenge,
          response: response,
          valid: valid
        });
        
        if (!valid) {
          allRoundsValid = false;
          break;
        }
      }
      
      return {
        success: allRoundsValid,
        transcript: transcript,
        securityLevel: Math.pow(2, -prover.securityRounds),
        rounds: prover.securityRounds
      };
    },
    
    /**
     * Generate Blum prime (p ≡ 3 mod 4)
     */
    generateBlumPrime: function(bits) {
      const min = Math.pow(2, bits - 1);
      const max = Math.pow(2, bits) - 1;
      
      for (let attempt = 0; attempt < 1000; attempt++) {
        let candidate = min + Math.floor(Math.random() * (max - min));
        
        // Ensure candidate ≡ 3 mod 4
        if (candidate % 4 !== 3) {
          candidate = candidate - (candidate % 4) + 3;
        }
        
        if (this.isProbablePrime(candidate, 10)) {
          return candidate;
        }
      }
      
      throw new Error('Failed to generate Blum prime in reasonable time');
    },
    
    /**
     * Miller-Rabin primality test
     */
    isProbablePrime: function(n, k = 10) {
      if (n < 2) return false;
      if (n === 2 || n === 3) return true;
      if (n % 2 === 0) return false;
      
      // Small prime check
      for (let prime of FS_CONSTANTS.SMALL_PRIMES) {
        if (n === prime) return true;
        if (n % prime === 0) return false;
      }
      
      // Miller-Rabin test
      let d = n - 1;
      let r = 0;
      while (d % 2 === 0) {
        d = Math.floor(d / 2);
        r++;
      }
      
      for (let i = 0; i < k; i++) {
        const a = 2 + Math.floor(Math.random() * (n - 4));
        let x = this.fastModExp(a, d, n);
        
        if (x === 1 || x === n - 1) continue;
        
        let composite = true;
        for (let j = 0; j < r - 1; j++) {
          x = this.modMul(x, x, n);
          if (x === n - 1) {
            composite = false;
            break;
          }
        }
        
        if (composite) return false;
      }
      
      return true;
    },
    
    /**
     * Fast modular exponentiation
     */
    fastModExp: function(base, exponent, modulus) {
      if (modulus === 1) return 0;
      
      let result = 1;
      base = base % modulus;
      
      while (exponent > 0) {
        if (exponent % 2 === 1) {
          result = this.modMul(result, base, modulus);
        }
        exponent = Math.floor(exponent / 2);
        base = this.modMul(base, base, modulus);
      }
      
      return result;
    },
    
    /**
     * Modular multiplication
     */
    modMul: function(a, b, m) {
      return (a * b) % m;
    },
    
    /**
     * Greatest Common Divisor
     */
    gcd: function(a, b) {
      while (b !== 0) {
        const temp = b;
        b = a % b;
        a = temp;
      }
      return a;
    },
    
    /**
     * Generate secure random number in range [min, max)
     */
    secureRandomRange: function(min, max) {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const range = max - min;
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return min + (array[0] % range);
      } else {
        // Fallback for educational purposes
        return min + Math.floor(Math.random() * (max - min));
      }
    },
    
    /**
     * Clear sensitive instance data
     */
    ClearData: function(instanceId) {
      const instance = this.instances[instanceId];
      if (instance) {
        // Clear sensitive data
        instance.p = null;
        instance.q = null;
        if (instance.s) instance.s.fill(0);
        if (instance.commitments) {
          instance.commitments.forEach(c => {
            c.x = 0;
            c.r = 0;
          });
        }
        instance.challenges = [];
        instance.responses = [];
        instance.initialized = false;
        instance.isProver = false;
        instance.isVerifier = false;
        
        // Remove instance
        delete this.instances[instanceId];
      }
      return true;
    },
    
    /**
     * Get algorithm information
     */
    GetInfo: function() {
      return {
        name: this.name,
        type: 'Zero-Knowledge Proof',
        description: 'Interactive identification protocol using quadratic residues',
        inventors: 'Amos Fiat and Adi Shamir (1986)',
        security: 'Based on quadratic residuosity assumption',
        properties: 'Completeness, Soundness, Zero-Knowledge',
        applications: 'Identification, authentication, digital signatures',
        rounds: 'Multiple rounds required for security',
        challenge: 'Binary challenges (0 or 1 per secret)'
      };
    }
  };
  
  // Test vectors for Fiat-Shamir Protocol
  FiatShamir.testVectors = [
    {
      algorithm: 'Fiat-Shamir Protocol',
      testId: 'fs-educational-001',
      description: 'Educational Fiat-Shamir proof with small parameters',
      category: 'educational',
      
      modulusBits: 512,
      numSecrets: 1,
      securityRounds: 20,
      
      // Note: Actual values will vary due to random generation
      expectedSuccess: true,
      expectedSecurityLevel: 'approximately 2^-20',
      
      source: {
        type: 'academic',
        identifier: 'FS86',
        title: 'How to prove yourself: practical solutions to identification and signature problems',
        url: 'https://link.springer.com/chapter/10.1007/3-540-47721-7_12',
        organization: 'Springer',
        section: 'Protocol Description',
        datePublished: '1986-01-01',
        dateAccessed: '2025-01-17'
      }
    },
    {
      algorithm: 'Fiat-Shamir Protocol',
      testId: 'fs-multi-secret-002',
      description: 'Multi-secret Fiat-Shamir proof for enhanced security',
      category: 'educational',
      
      modulusBits: 1024,
      numSecrets: 3,
      securityRounds: 40,
      
      expectedSuccess: true,
      expectedSecurityLevel: 'approximately 2^-40',
      
      source: {
        type: 'academic',
        identifier: 'FS86',
        title: 'How to prove yourself: practical solutions to identification and signature problems',
        url: 'https://link.springer.com/chapter/10.1007/3-540-47721-7_12',
        organization: 'Springer',
        section: 'Multiple Secrets Enhancement',
        datePublished: '1986-01-01',
        dateAccessed: '2025-01-17'
      }
    }
  ];
  
  // Register with Cipher system if available
  if (typeof global.Cipher !== 'undefined') {
    global.Cipher.AddCipher(FiatShamir);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FiatShamir;
  }
  
  // Export to global scope
  global.FiatShamir = FiatShamir;
  
})(typeof global !== 'undefined' ? global : window);