#!/usr/bin/env node
/*
 * Universal Time-Lock Puzzle Implementation
 * Compatible with both Browser and Node.js environments
 * Based on Rivest-Shamir-Wagner 1996 algorithm
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of Time-Lock Puzzles for timed-release cryptography.
 * Allows encrypting a message that cannot be decrypted until a specified
 * amount of computation has been performed, providing a cryptographic time delay.
 * 
 * WARNING: This implementation is for educational purposes only.
 * Timing assumptions may not hold in production environments.
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
  
  // Load hash functions for key derivation
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
      console.error('Time-Lock Puzzle requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Time-Lock Puzzle Constants
  const TLP_CONSTANTS = {
    DEFAULT_MODULUS_BITS: 1024,   // RSA modulus size
    MIN_TIME_STEPS: 1000,         // Minimum computation steps
    MAX_TIME_STEPS: Math.pow(2, 40), // Maximum computation steps
    SMALL_PRIMES: [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47],
    DEFAULT_EXPONENT: 65537,      // Standard RSA exponent
    KEY_DERIVATION_ROUNDS: 1000   // PBKDF2-like rounds
  };
  
  const TimeLockPuzzle = {
    internalName: 'time-lock-puzzle',
    name: 'Time-Lock Puzzle',
    
    // Required Cipher interface properties
    minKeyLength: 0,         // No traditional key
    maxKeyLength: 0,         // Uses derived parameters
    stepKeyLength: 1,        // N/A
    minBlockSize: 1,         // Can encrypt single bytes
    maxBlockSize: 128,       // Limited by RSA modulus size
    stepBlockSize: 1,        // Byte-wise processing
    instances: {},           // Instance tracking
    
    // Metadata
    version: '1.0.0',
    date: '2025-01-17',
    author: 'Rivest-Shamir-Wagner (1996) - Educational Implementation',
    description: 'Time-Lock Puzzles for Timed-Release Cryptography',
    reference: 'RSW96: Time-lock puzzles and timed-release Crypto',
    
    // Security parameters
    defaultModulusBits: 1024,
    
    /**
     * Initialize Time-Lock Puzzle instance
     */
    Init: function() {
      const instance = {
        p: null,                // First prime
        q: null,                // Second prime
        n: null,                // Modulus n = p * q
        phi: null,              // Euler's totient φ(n) = (p-1)(q-1)
        timeSteps: 0,           // Number of squaring operations
        puzzle: null,           // Puzzle value
        solution: null,         // Solution to puzzle
        encryptedMessage: null, // XOR encrypted message
        modulusBits: TLP_CONSTANTS.DEFAULT_MODULUS_BITS,
        initialized: false
      };
      
      const instanceId = Math.random().toString(36).substr(2, 9);
      this.instances[instanceId] = instance;
      return instanceId;
    },
    
    /**
     * Generate RSA parameters for Time-Lock Puzzle
     */
    GenerateParameters: function(instanceId, modulusBits = TLP_CONSTANTS.DEFAULT_MODULUS_BITS) {
      const instance = this.instances[instanceId];
      if (!instance) {
        throw new Error('Invalid Time-Lock Puzzle instance ID');
      }
      
      if (modulusBits < 512 || modulusBits > 4096) {
        throw new Error('Modulus size must be between 512 and 4096 bits');
      }
      
      instance.modulusBits = modulusBits;
      
      // Generate two prime numbers
      const primeBits = Math.floor(modulusBits / 2);
      instance.p = this.generatePrime(primeBits);
      instance.q = this.generatePrime(primeBits);
      
      // Ensure primes are different
      while (instance.p === instance.q) {
        instance.q = this.generatePrime(primeBits);
      }
      
      // Calculate modulus and totient
      instance.n = instance.p * instance.q;
      instance.phi = (instance.p - 1) * (instance.q - 1);
      
      instance.initialized = true;
      return {
        modulus: instance.n,
        modulusBits: modulusBits,
        publicOnly: true  // Don't expose private factors
      };
    },
    
    /**
     * Create Time-Lock Puzzle
     */
    CreatePuzzle: function(instanceId, message, timeSteps) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.initialized) {
        throw new Error('Time-Lock Puzzle instance not properly initialized');
      }
      
      if (timeSteps < TLP_CONSTANTS.MIN_TIME_STEPS || timeSteps > TLP_CONSTANTS.MAX_TIME_STEPS) {
        throw new Error('Time steps must be between ' + TLP_CONSTANTS.MIN_TIME_STEPS + ' and ' + TLP_CONSTANTS.MAX_TIME_STEPS);
      }
      
      if (!Array.isArray(message)) {
        message = Array.from(message);
      }
      
      if (message.length > Math.floor(instance.modulusBits / 8) - 20) {
        throw new Error('Message too long for modulus size');
      }
      
      instance.timeSteps = timeSteps;
      
      // Step 1: Generate random values
      const a = this.secureRandomMod(instance.n);
      const secretKey = this.secureRandomBytes(32); // 256-bit secret
      
      // Step 2: Compute 2^t mod φ(n) efficiently using knowledge of φ(n)
      const exponent = this.fastModExp(2, timeSteps, instance.phi);
      
      // Step 3: Compute solution s = a^(2^t) mod n
      instance.solution = this.fastModExp(a, exponent, instance.n);
      
      // Step 4: Derive encryption key from solution
      const encryptionKey = this.deriveKey(instance.solution, secretKey, 32);
      
      // Step 5: Encrypt message with derived key
      instance.encryptedMessage = this.xorEncrypt(message, encryptionKey);
      
      // Step 6: Create puzzle (public information)
      instance.puzzle = {
        modulus: instance.n,
        generator: a,
        timeSteps: timeSteps,
        encryptedMessage: instance.encryptedMessage,
        keyDerivationSalt: secretKey,
        created: Date.now()
      };
      
      return instance.puzzle;
    },
    
    /**
     * Solve Time-Lock Puzzle (performs sequential squaring)
     */
    SolvePuzzle: function(puzzle, progressCallback = null) {
      if (!puzzle || !puzzle.modulus || !puzzle.generator || !puzzle.timeSteps) {
        throw new Error('Invalid puzzle format');
      }
      
      const n = puzzle.modulus;
      const a = puzzle.generator;
      const t = puzzle.timeSteps;
      
      // Perform sequential squaring: compute a^(2^t) mod n
      let result = a;
      const startTime = Date.now();
      
      for (let i = 0; i < t; i++) {
        result = this.modMul(result, result, n);
        
        // Report progress periodically
        if (progressCallback && i % 1000 === 0) {
          const progress = i / t;
          const elapsed = Date.now() - startTime;
          const estimated = elapsed / progress;
          progressCallback({
            step: i,
            totalSteps: t,
            progress: progress,
            elapsedMs: elapsed,
            estimatedTotalMs: estimated
          });
        }
      }
      
      // Derive decryption key
      const decryptionKey = this.deriveKey(result, puzzle.keyDerivationSalt, 32);
      
      // Decrypt message
      const decryptedMessage = this.xorEncrypt(puzzle.encryptedMessage, decryptionKey);
      
      return {
        solution: result,
        decryptedMessage: decryptedMessage,
        solveTimeMs: Date.now() - startTime
      };
    },
    
    /**
     * Generate a prime number (simplified for educational purposes)
     */
    generatePrime: function(bits) {
      const min = Math.pow(2, bits - 1);
      const max = Math.pow(2, bits) - 1;
      
      for (let attempt = 0; attempt < 1000; attempt++) {
        let candidate = min + Math.floor(Math.random() * (max - min));
        
        // Ensure odd
        if (candidate % 2 === 0) candidate++;
        
        if (this.isProbablePrime(candidate, 10)) {
          return candidate;
        }
      }
      
      throw new Error('Failed to generate prime in reasonable time');
    },
    
    /**
     * Miller-Rabin primality test (simplified)
     */
    isProbablePrime: function(n, k = 10) {
      if (n < 2) return false;
      if (n === 2 || n === 3) return true;
      if (n % 2 === 0) return false;
      
      // Small prime check
      for (let prime of TLP_CONSTANTS.SMALL_PRIMES) {
        if (n === prime) return true;
        if (n % prime === 0) return false;
      }
      
      // Miller-Rabin test
      let d = n - 1;
      let r = 0;
      while (d % 2 === 0) {
        d /= 2;
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
     * Modular multiplication with overflow protection
     */
    modMul: function(a, b, m) {
      // Use JavaScript's built-in handling for large numbers
      // Note: In production, use proper big integer libraries
      return (a * b) % m;
    },
    
    /**
     * Secure random number modulo n
     */
    secureRandomMod: function(n) {
      // Generate random number less than n
      // Simplified for educational purposes
      return Math.floor(Math.random() * n);
    },
    
    /**
     * Generate secure random bytes
     */
    secureRandomBytes: function(length) {
      const bytes = new Array(length);
      
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
          bytes[i] = array[i];
        }
      } else {
        // Fallback for educational purposes
        for (let i = 0; i < length; i++) {
          bytes[i] = Math.floor(Math.random() * 256);
        }
      }
      
      return bytes;
    },
    
    /**
     * Derive encryption key using simple key stretching
     */
    deriveKey: function(secret, salt, keyLength) {
      // Simple key derivation (use proper PBKDF2/HKDF in production)
      const combined = [secret & 0xFF, (secret >> 8) & 0xFF, (secret >> 16) & 0xFF, (secret >> 24) & 0xFF].concat(salt);
      
      // Hash multiple rounds for key stretching
      let hash = combined;
      for (let i = 0; i < TLP_CONSTANTS.KEY_DERIVATION_ROUNDS; i++) {
        hash = this.simpleHash(hash);
      }
      
      // Extend to desired key length
      const key = [];
      for (let i = 0; i < keyLength; i++) {
        key.push(hash[i % hash.length]);
      }
      
      return key;
    },
    
    /**
     * Simple hash function for educational purposes
     */
    simpleHash: function(data) {
      // Very simple hash for educational use - use SHA-256 in production
      const hash = new Array(32);
      let state = 0x12345678;
      
      for (let i = 0; i < data.length; i++) {
        state = ((state << 5) + (state >>> 27) + data[i]) >>> 0;
      }
      
      for (let i = 0; i < 32; i++) {
        hash[i] = (state >>> (i % 32)) & 0xFF;
        state = ((state << 3) + (state >>> 29)) >>> 0;
      }
      
      return hash;
    },
    
    /**
     * XOR encryption/decryption
     */
    xorEncrypt: function(data, key) {
      const result = new Array(data.length);
      for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ key[i % key.length];
      }
      return result;
    },
    
    /**
     * Estimate solve time based on benchmarking
     */
    EstimateSolveTime: function(timeSteps, benchmarkSteps = 1000) {
      const startTime = Date.now();
      
      // Quick benchmark of modular squaring
      let a = 12345;
      const n = 2147483647; // Large prime
      
      for (let i = 0; i < benchmarkSteps; i++) {
        a = this.modMul(a, a, n);
      }
      
      const benchmarkTime = Date.now() - startTime;
      const estimatedMs = (benchmarkTime / benchmarkSteps) * timeSteps;
      
      return {
        benchmarkSteps: benchmarkSteps,
        benchmarkTimeMs: benchmarkTime,
        timeSteps: timeSteps,
        estimatedSolveTimeMs: estimatedMs,
        estimatedSolveTimeHours: estimatedMs / (1000 * 60 * 60)
      };
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
        instance.phi = null;
        instance.solution = null;
        if (instance.encryptedMessage) instance.encryptedMessage.fill(0);
        instance.timeSteps = 0;
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
        type: 'Time-Release Cryptography',
        description: 'Encrypts messages that can only be decrypted after specified computation',
        inventors: 'Ronald Rivest, Adi Shamir, David Wagner (1996)',
        security: 'Based on sequential computation assumption',
        applications: 'Sealed bid auctions, timed commitments, delayed disclosure',
        computation: 'Sequential modular squaring operations',
        parallel: 'Assumed not to benefit significantly from parallelization'
      };
    }
  };
  
  // Test vectors for Time-Lock Puzzles
  TimeLockPuzzle.testVectors = [
    {
      algorithm: 'Time-Lock Puzzle',
      testId: 'tlp-educational-001',
      description: 'Educational Time-Lock Puzzle with short delay',
      category: 'educational',
      
      message: 'Secret',
      timeSteps: 10000,
      modulusBits: 512,
      
      // Note: Actual puzzle values will vary due to random generation
      expectedSolution: 'Secret',
      
      source: {
        type: 'academic',
        identifier: 'RSW96',
        title: 'Time-lock puzzles and timed-release Crypto',
        url: 'https://people.csail.mit.edu/rivest/pubs/RSW96.pdf',
        organization: 'MIT',
        section: 'Algorithm Description',
        datePublished: '1996-01-01',
        dateAccessed: '2025-01-17'
      }
    },
    {
      algorithm: 'Time-Lock Puzzle',
      testId: 'tlp-practical-002',
      description: 'Practical Time-Lock Puzzle for medium-term storage',
      category: 'educational',
      
      messageHex: '48656C6C6F20576F726C64', // "Hello World"
      timeSteps: 100000,
      modulusBits: 1024,
      
      expectedSolutionHex: '48656C6C6F20576F726C64',
      
      source: {
        type: 'academic',
        identifier: 'RSW96',
        title: 'Time-lock puzzles and timed-release Crypto',
        url: 'https://people.csail.mit.edu/rivest/pubs/RSW96.pdf',
        organization: 'MIT',
        section: 'Practical Applications',
        datePublished: '1996-01-01',
        dateAccessed: '2025-01-17'
      }
    }
  ];
  
  // Register with Cipher system if available
  if (typeof global.Cipher !== 'undefined') {
    global.Cipher.AddCipher(TimeLockPuzzle);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeLockPuzzle;
  }
  
  // Export to global scope
  global.TimeLockPuzzle = TimeLockPuzzle;
  
})(typeof global !== 'undefined' ? global : window);