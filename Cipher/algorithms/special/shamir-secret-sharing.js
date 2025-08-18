#!/usr/bin/env node
/*
 * Universal Shamir Secret Sharing
 * Compatible with both Browser and Node.js environments
 * Based on Adi Shamir's 1979 algorithm
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of Shamir's Secret Sharing scheme.
 * Demonstrates threshold cryptography where a secret is divided
 * into n shares, requiring any k shares to reconstruct the secret.
 * 
 * Uses Lagrange interpolation in finite fields (GF(p)) for security.
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
      console.error('Shamir Secret Sharing requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Secret Sharing Constants
  const SSS_CONSTANTS = {
    DEFAULT_PRIME: 2147483647,    // Large prime (2^31 - 1)
    MAX_SHARES: 255,              // Maximum number of shares
    MIN_THRESHOLD: 2,             // Minimum threshold
    WORD_SIZE: 4,                 // Process secrets in 32-bit words
    SAFE_PRIMES: [                // Collection of safe primes
      2147483647,   // 2^31 - 1
      1073741827,   // 2^30 - 5
      536870923,    // 2^29 - 5
      268435459,    // 2^28 - 3
      134217757,    // 2^27 - 19
      67108879,     // 2^26 - 15
      33554467,     // 2^25 - 29
      16777259      // 2^24 - 37
    ]
  };
  
  const ShamirSecretSharing = {
    internalName: 'shamir-secret-sharing',
    name: 'Shamir Secret Sharing',
    
    // Required Cipher interface properties
    minKeyLength: 0,         // No key required
    maxKeyLength: 0,         // No key used
    stepKeyLength: 1,        // N/A
    minBlockSize: 1,         // Can share single bytes
    maxBlockSize: 0,         // No maximum limit
    stepBlockSize: 1,        // Byte-wise processing
    instances: {},           // Instance tracking
    
    // Metadata
    version: '1.0.0',
    date: '2025-01-17',
    author: 'Adi Shamir (1979) - Educational Implementation',
    description: 'Threshold Secret Sharing using Polynomial Interpolation in Finite Fields',
    reference: 'Shamir, A. (1979). How to share a secret. Communications of the ACM',
    
    // Security parameters
    maxShares: 255,
    minThreshold: 2,
    
    /**
     * Initialize Secret Sharing instance
     */
    Init: function() {
      const instance = {
        threshold: 0,           // k: minimum shares needed
        numShares: 0,           // n: total shares to generate
        prime: SSS_CONSTANTS.DEFAULT_PRIME,
        polynomial: [],         // Coefficients of secret polynomial
        shares: [],             // Generated shares
        secretLength: 0,        // Length of original secret
        initialized: false
      };
      
      const instanceId = Math.random().toString(36).substr(2, 9);
      this.instances[instanceId] = instance;
      return instanceId;
    },
    
    /**
     * Setup secret sharing parameters
     */
    Setup: function(instanceId, threshold, numShares, prime = null) {
      const instance = this.instances[instanceId];
      if (!instance) {
        throw new Error('Invalid Secret Sharing instance ID');
      }
      
      if (threshold < SSS_CONSTANTS.MIN_THRESHOLD || threshold > SSS_CONSTANTS.MAX_SHARES) {
        throw new Error('Threshold must be between ' + SSS_CONSTANTS.MIN_THRESHOLD + ' and ' + SSS_CONSTANTS.MAX_SHARES);
      }
      
      if (numShares < threshold || numShares > SSS_CONSTANTS.MAX_SHARES) {
        throw new Error('Number of shares must be between threshold and ' + SSS_CONSTANTS.MAX_SHARES);
      }
      
      instance.threshold = threshold;
      instance.numShares = numShares;
      
      // Select appropriate prime
      if (prime) {
        instance.prime = prime;
      } else {
        // Choose smallest safe prime larger than numShares
        instance.prime = SSS_CONSTANTS.SAFE_PRIMES.find(p => p > numShares) || SSS_CONSTANTS.DEFAULT_PRIME;
      }
      
      instance.initialized = true;
      return true;
    },
    
    /**
     * Generate shares for a secret
     */
    ShareSecret: function(instanceId, secret) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.initialized) {
        throw new Error('Secret Sharing instance not properly initialized');
      }
      
      if (!secret || secret.length === 0) {
        throw new Error('Secret cannot be empty');
      }
      
      // Convert secret to array if needed
      if (!Array.isArray(secret)) {
        secret = Array.from(secret);
      }
      
      instance.secretLength = secret.length;
      instance.shares = [];
      
      // Process secret in chunks that fit in the finite field
      const chunkSize = this.getChunkSize(instance.prime);
      const secretShares = [];
      
      for (let offset = 0; offset < secret.length; offset += chunkSize) {
        const chunk = secret.slice(offset, offset + chunkSize);
        
        // Convert chunk to integer
        let secretValue = 0;
        for (let i = 0; i < chunk.length; i++) {
          secretValue = (secretValue * 256 + chunk[i]) % instance.prime;
        }
        
        // Generate polynomial with secret as constant term
        instance.polynomial = [secretValue];
        for (let i = 1; i < instance.threshold; i++) {
          instance.polynomial.push(this.secureRandom(instance.prime));
        }
        
        // Evaluate polynomial at different points to create shares
        const chunkShares = [];
        for (let x = 1; x <= instance.numShares; x++) {
          const y = this.evaluatePolynomial(instance.polynomial, x, instance.prime);
          chunkShares.push({ x: x, y: y });
        }
        
        secretShares.push(chunkShares);
      }
      
      // Reorganize shares by participant
      instance.shares = [];
      for (let i = 0; i < instance.numShares; i++) {
        const participantShares = [];
        for (let j = 0; j < secretShares.length; j++) {
          participantShares.push(secretShares[j][i]);
        }
        instance.shares.push({
          id: i + 1,
          chunks: participantShares,
          metadata: {
            threshold: instance.threshold,
            totalShares: instance.numShares,
            secretLength: instance.secretLength,
            prime: instance.prime,
            chunkSize: chunkSize
          }
        });
      }
      
      return instance.shares;
    },
    
    /**
     * Reconstruct secret from shares
     */
    ReconstructSecret: function(shares) {
      if (!shares || shares.length === 0) {
        throw new Error('No shares provided for reconstruction');
      }
      
      // Extract metadata from first share
      const metadata = shares[0].metadata;
      if (!metadata) {
        throw new Error('Share metadata missing - cannot reconstruct');
      }
      
      if (shares.length < metadata.threshold) {
        throw new Error('Insufficient shares: need ' + metadata.threshold + ', got ' + shares.length);
      }
      
      // Use first k shares for reconstruction
      const kShares = shares.slice(0, metadata.threshold);
      const prime = metadata.prime;
      const secretLength = metadata.secretLength;
      const chunkSize = metadata.chunkSize;
      
      // Determine number of chunks
      const numChunks = kShares[0].chunks.length;
      const reconstructedSecret = [];
      
      // Reconstruct each chunk using Lagrange interpolation
      for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
        // Extract points for this chunk
        const points = kShares.map(share => ({
          x: share.chunks[chunkIdx].x,
          y: share.chunks[chunkIdx].y
        }));
        
        // Reconstruct using Lagrange interpolation at x=0
        const secretValue = this.lagrangeInterpolation(points, 0, prime);
        
        // Convert back to bytes
        const chunkBytes = this.integerToBytes(secretValue, chunkSize);
        reconstructedSecret.push(...chunkBytes);
      }
      
      // Trim to original secret length
      return reconstructedSecret.slice(0, secretLength);
    },
    
    /**
     * Evaluate polynomial at point x in GF(p)
     */
    evaluatePolynomial: function(coefficients, x, prime) {
      let result = 0;
      let xPower = 1;
      
      for (let i = 0; i < coefficients.length; i++) {
        result = (result + (coefficients[i] * xPower) % prime) % prime;
        xPower = (xPower * x) % prime;
      }
      
      return result;
    },
    
    /**
     * Lagrange interpolation to find polynomial value at x=0
     */
    lagrangeInterpolation: function(points, x, prime) {
      let result = 0;
      
      for (let i = 0; i < points.length; i++) {
        let basis = points[i].y;
        
        // Calculate Lagrange basis polynomial
        for (let j = 0; j < points.length; j++) {
          if (i !== j) {
            const numerator = (x - points[j].x + prime) % prime;
            const denominator = (points[i].x - points[j].x + prime) % prime;
            const inv = this.modInverse(denominator, prime);
            basis = (basis * numerator % prime * inv) % prime;
          }
        }
        
        result = (result + basis) % prime;
      }
      
      return result;
    },
    
    /**
     * Modular multiplicative inverse using Extended Euclidean Algorithm
     */
    modInverse: function(a, m) {
      if (this.gcd(a, m) !== 1) {
        throw new Error('Modular inverse does not exist');
      }
      
      // Extended Euclidean Algorithm
      let m0 = m;
      let x0 = 0, x1 = 1;
      
      while (a > 1) {
        const q = Math.floor(a / m);
        let t = m;
        
        m = a % m;
        a = t;
        t = x0;
        
        x0 = x1 - q * x0;
        x1 = t;
      }
      
      if (x1 < 0) {
        x1 += m0;
      }
      
      return x1;
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
     * Get appropriate chunk size for prime
     */
    getChunkSize: function(prime) {
      // Ensure chunks fit comfortably in the field
      let size = 1;
      let maxValue = 256;
      
      while (maxValue < prime / 256) {
        size++;
        maxValue *= 256;
      }
      
      return Math.max(1, size - 1);
    },
    
    /**
     * Convert integer to byte array
     */
    integerToBytes: function(value, length) {
      const bytes = [];
      for (let i = 0; i < length; i++) {
        bytes.unshift(value & 0xFF);
        value = Math.floor(value / 256);
      }
      return bytes;
    },
    
    /**
     * Generate cryptographically secure random number
     */
    secureRandom: function(max) {
      // Use crypto APIs if available, fallback to Math.random for educational use
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return array[0] % max;
      } else if (typeof require !== 'undefined') {
        try {
          const crypto = require('crypto');
          return crypto.randomInt(0, max);
        } catch (e) {
          // Fallback to Math.random
        }
      }
      
      // Educational fallback (not cryptographically secure)
      return Math.floor(Math.random() * max);
    },
    
    /**
     * Verify share integrity and reconstruct partial secret
     */
    VerifyShares: function(shares, expectedThreshold) {
      if (!shares || shares.length === 0) {
        return { valid: false, error: 'No shares provided' };
      }
      
      // Check metadata consistency
      const metadata = shares[0].metadata;
      if (!metadata) {
        return { valid: false, error: 'Missing share metadata' };
      }
      
      if (metadata.threshold !== expectedThreshold) {
        return { valid: false, error: 'Threshold mismatch' };
      }
      
      // Verify all shares have consistent metadata
      for (let i = 1; i < shares.length; i++) {
        const meta = shares[i].metadata;
        if (!meta || 
            meta.threshold !== metadata.threshold ||
            meta.totalShares !== metadata.totalShares ||
            meta.secretLength !== metadata.secretLength ||
            meta.prime !== metadata.prime) {
          return { valid: false, error: 'Inconsistent share metadata' };
        }
      }
      
      return { 
        valid: true, 
        threshold: metadata.threshold,
        canReconstruct: shares.length >= metadata.threshold
      };
    },
    
    /**
     * Clear sensitive instance data
     */
    ClearData: function(instanceId) {
      const instance = this.instances[instanceId];
      if (instance) {
        // Clear sensitive data
        instance.polynomial.fill(0);
        if (instance.shares) {
          instance.shares.forEach(share => {
            if (share.chunks) {
              share.chunks.forEach(chunk => {
                chunk.x = 0;
                chunk.y = 0;
              });
            }
          });
        }
        instance.threshold = 0;
        instance.numShares = 0;
        instance.secretLength = 0;
        instance.initialized = false;
        
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
        type: 'Secret Sharing',
        description: 'Threshold cryptography using polynomial interpolation',
        inventor: 'Adi Shamir (1979)',
        security: 'Information-theoretic security in finite fields',
        applications: 'Key escrow, distributed storage, multi-party computation',
        threshold: 'k-out-of-n secret sharing',
        reconstruction: 'Lagrange interpolation in GF(p)'
      };
    }
  };
  
  // Test vectors for Shamir Secret Sharing
  ShamirSecretSharing.testVectors = [
    {
      algorithm: 'Shamir Secret Sharing',
      testId: 'sss-basic-001',
      description: 'Basic 2-out-of-3 secret sharing with ASCII message',
      category: 'educational',
      
      secret: 'Hello',
      threshold: 2,
      numShares: 3,
      prime: 2147483647,
      
      // Note: Shares will be different each time due to randomness
      expectedReconstruction: 'Hello',
      
      source: {
        type: 'educational',
        identifier: 'Basic SSS Test',
        title: 'Shamir Secret Sharing Educational Example',
        url: 'https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing',
        organization: 'Educational',
        section: 'Algorithm Verification',
        datePublished: '1979-01-01',
        dateAccessed: '2025-01-17'
      }
    },
    {
      algorithm: 'Shamir Secret Sharing',
      testId: 'sss-crypto-002',
      description: '3-out-of-5 sharing with cryptographic key',
      category: 'educational',
      
      secretHex: '000102030405060708090A0B0C0D0E0F',
      threshold: 3,
      numShares: 5,
      prime: 2147483647,
      
      expectedReconstructionHex: '000102030405060708090A0B0C0D0E0F',
      
      source: {
        type: 'educational',
        identifier: 'Crypto Key SSS Test',
        title: 'Shamir Secret Sharing for Cryptographic Keys',
        url: 'https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing',
        organization: 'Educational',
        section: 'Cryptographic Applications',
        datePublished: '1979-01-01',
        dateAccessed: '2025-01-17'
      }
    }
  ];
  
  // Register with Cipher system if available
  if (typeof global.Cipher !== 'undefined') {
    global.Cipher.AddCipher(ShamirSecretSharing);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShamirSecretSharing;
  }
  
  // Export to global scope
  global.ShamirSecretSharing = ShamirSecretSharing;
  
})(typeof global !== 'undefined' ? global : window);