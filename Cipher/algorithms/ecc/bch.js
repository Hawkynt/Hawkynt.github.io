#!/usr/bin/env node
/*
 * Universal BCH (Bose-Chaudhuri-Hocquenghem) Error Correction Codes
 * Compatible with both Browser and Node.js environments
 * Based on classical BCH theory for error detection and correction
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of BCH codes using Galois Field arithmetic.
 * BCH codes are a class of cyclic error-correcting codes that can detect
 * and correct multiple random errors in transmitted data.
 * 
 * WARNING: This implementation is for educational purposes only.
 * Use proven error correction libraries for production systems.
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
      console.error('BCH Codes require Cipher system to be loaded first');
      return;
    }
  }
  
  // BCH Constants
  const BCH_CONSTANTS = {
    MAX_M: 16,              // Maximum extension field GF(2^m)
    MIN_M: 3,               // Minimum extension field GF(2^3) = GF(8)
    MAX_T: 32,              // Maximum error correction capability
    
    // Primitive polynomials for GF(2^m)
    PRIMITIVE_POLYNOMIALS: {
      3: 0x0B,    // x^3 + x + 1 (GF(8))
      4: 0x13,    // x^4 + x + 1 (GF(16))
      5: 0x25,    // x^5 + x^2 + 1 (GF(32))
      6: 0x43,    // x^6 + x + 1 (GF(64))
      7: 0x89,    // x^7 + x^3 + 1 (GF(128))
      8: 0x11D,   // x^8 + x^4 + x^3 + x^2 + 1 (GF(256))
      9: 0x211,   // x^9 + x^4 + 1 (GF(512))
      10: 0x409,  // x^10 + x^3 + 1 (GF(1024))
      11: 0x805,  // x^11 + x^2 + 1 (GF(2048))
      12: 0x1053, // x^12 + x^6 + x^4 + x + 1 (GF(4096))
    }
  };
  
  const BCHCodes = {
    internalName: 'bch-codes',
    name: 'BCH Error Correction Codes',
    
    // Required Cipher interface properties
    minKeyLength: 0,         // No key required
    maxKeyLength: 0,         // ECC parameters instead
    stepKeyLength: 1,        // N/A
    minBlockSize: 1,         // Can encode single bits
    maxBlockSize: 0,         // Limited by field size
    stepBlockSize: 1,        // Bit-wise processing
    instances: {},           // Instance tracking
    
    // Metadata
    version: '1.0.0',
    date: '2025-01-17',
    author: 'Bose-Chaudhuri-Hocquenghem (1959-1960) - Educational Implementation',
    description: 'Cyclic Error Correction Codes using Galois Field Mathematics',
    reference: 'BCH Codes: Error Correction Coding Theory',
    
    // Code parameters
    supportedFields: [3, 4, 5, 6, 7, 8],  // GF(2^m) implementations
    
    /**
     * Initialize BCH instance
     */
    Init: function() {
      const instance = {
        m: 0,                   // Extension field parameter (GF(2^m))
        n: 0,                   // Code length (2^m - 1)
        k: 0,                   // Information length
        t: 0,                   // Error correction capability
        d: 0,                   // Minimum distance (2t + 1)
        
        // Galois Field elements
        fieldSize: 0,           // 2^m
        primitivePolynomial: 0, // Primitive polynomial for GF(2^m)
        alpha: [],              // Powers of primitive element α
        logTable: [],           // Discrete logarithm table
        antilogTable: [],       // Antilog table
        
        // BCH polynomials
        generatorPolynomial: [],  // Generator polynomial g(x)
        minimalPolynomials: [],   // Minimal polynomials
        
        // Encoding/Decoding state
        syndrome: [],           // Error syndrome
        errorPositions: [],     // Positions of detected errors
        
        initialized: false
      };
      
      const instanceId = Math.random().toString(36).substr(2, 9);
      this.instances[instanceId] = instance;
      return instanceId;
    },
    
    /**
     * Setup BCH code parameters
     */
    Setup: function(instanceId, m, t) {
      const instance = this.instances[instanceId];
      if (!instance) {
        throw new Error('Invalid BCH instance ID');
      }
      
      if (m < BCH_CONSTANTS.MIN_M || m > BCH_CONSTANTS.MAX_M) {
        throw new Error('Field parameter m must be between ' + BCH_CONSTANTS.MIN_M + ' and ' + BCH_CONSTANTS.MAX_M);
      }
      
      if (t < 1 || t > BCH_CONSTANTS.MAX_T) {
        throw new Error('Error correction capability t must be between 1 and ' + BCH_CONSTANTS.MAX_T);
      }
      
      instance.m = m;
      instance.t = t;
      instance.n = Math.pow(2, m) - 1;
      instance.d = 2 * t + 1;
      instance.fieldSize = Math.pow(2, m);
      
      // Get primitive polynomial for this field
      instance.primitivePolynomial = BCH_CONSTANTS.PRIMITIVE_POLYNOMIALS[m];
      if (!instance.primitivePolynomial) {
        throw new Error('Primitive polynomial not available for GF(2^' + m + ')');
      }
      
      // Initialize Galois Field
      this.initializeGaloisField(instance);
      
      // Generate generator polynomial
      this.generateBCHPolynomial(instance);
      
      // Calculate information length
      instance.k = instance.n - this.polynomialDegree(instance.generatorPolynomial);
      
      if (instance.k <= 0) {
        throw new Error('Invalid BCH parameters: no information bits');
      }
      
      instance.initialized = true;
      
      return {
        n: instance.n,
        k: instance.k,
        t: instance.t,
        d: instance.d,
        rate: instance.k / instance.n,
        redundancy: instance.n - instance.k
      };
    },
    
    /**
     * Initialize Galois Field GF(2^m)
     */
    initializeGaloisField: function(instance) {
      const fieldSize = instance.fieldSize;
      const primitive = instance.primitivePolynomial;
      
      // Initialize tables
      instance.alpha = new Array(fieldSize);
      instance.logTable = new Array(fieldSize);
      instance.antilogTable = new Array(fieldSize);
      
      // Generate powers of primitive element α
      instance.alpha[0] = 1;  // α^0 = 1
      
      for (let i = 1; i < fieldSize - 1; i++) {
        instance.alpha[i] = instance.alpha[i - 1] << 1;
        
        // Apply primitive polynomial reduction
        if (instance.alpha[i] >= fieldSize) {
          instance.alpha[i] ^= primitive;
        }
      }
      
      // Build logarithm and antilog tables
      instance.logTable[0] = -1;  // log(0) is undefined
      for (let i = 0; i < fieldSize - 1; i++) {
        const value = instance.alpha[i];
        instance.logTable[value] = i;
        instance.antilogTable[i] = value;
      }
    },
    
    /**
     * Generate BCH generator polynomial
     */
    generateBCHPolynomial: function(instance) {
      const t = instance.t;
      const n = instance.n;
      
      // Generator polynomial is LCM of minimal polynomials of α, α^2, ..., α^(2t)
      let generator = [1];  // Start with g(x) = 1
      
      instance.minimalPolynomials = [];
      
      for (let i = 1; i <= 2 * t; i++) {
        const minPoly = this.findMinimalPolynomial(instance, i);
        instance.minimalPolynomials.push(minPoly);
        
        // Multiply generator by minimal polynomial if not already included
        if (!this.isDivisible(generator, minPoly)) {
          generator = this.multiplyPolynomials(generator, minPoly, instance);
        }
      }
      
      instance.generatorPolynomial = generator;
    },
    
    /**
     * Find minimal polynomial of α^i over GF(2)
     */
    findMinimalPolynomial: function(instance, power) {
      const m = instance.m;
      const conjugates = [];
      let currentPower = power;
      
      // Find all conjugates: α^i, α^(2i), α^(4i), ..., α^(2^j * i) where 2^j * i ≡ i (mod n)
      do {
        conjugates.push(currentPower % (instance.n));
        currentPower = (currentPower * 2) % (instance.n);
      } while (currentPower !== power);
      
      // Build minimal polynomial as product of (x - α^conjugate)
      let minPoly = [1];  // Start with 1
      
      for (let conjugate of conjugates) {
        // Multiply by (x - α^conjugate)
        const factor = [this.galoisExp(instance, conjugate), 1];  // x - α^conjugate
        minPoly = this.multiplyPolynomials(minPoly, factor, instance);
      }
      
      return minPoly;
    },
    
    /**
     * Encode data using BCH code
     */
    Encode: function(instanceId, data) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.initialized) {
        throw new Error('BCH instance not properly initialized');
      }
      
      if (!Array.isArray(data)) {
        data = Array.from(data);
      }
      
      // Convert bytes to bits if necessary
      let bits = [];
      for (let byte of data) {
        for (let i = 7; i >= 0; i--) {
          bits.push((byte >> i) & 1);
        }
      }
      
      // Pad or truncate to information length
      while (bits.length < instance.k) {
        bits.unshift(0);
      }
      bits = bits.slice(-instance.k);
      
      // Systematic encoding: codeword = [data | parity]
      const parity = this.calculateParity(instance, bits);
      const codeword = bits.concat(parity);
      
      return {
        codeword: codeword,
        dataLength: instance.k,
        parityLength: instance.n - instance.k,
        totalLength: instance.n
      };
    },
    
    /**
     * Calculate parity bits for systematic encoding
     */
    calculateParity: function(instance, data) {
      // Multiply data polynomial by x^(n-k) and divide by generator polynomial
      const dataExtended = data.concat(new Array(instance.n - instance.k).fill(0));
      const remainder = this.polynomialDivision(dataExtended, instance.generatorPolynomial);
      
      return remainder;
    },
    
    /**
     * Decode BCH codeword with error correction
     */
    Decode: function(instanceId, receivedCodeword) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.initialized) {
        throw new Error('BCH instance not properly initialized');
      }
      
      if (!Array.isArray(receivedCodeword)) {
        receivedCodeword = Array.from(receivedCodeword);
      }
      
      if (receivedCodeword.length !== instance.n) {
        throw new Error('Received codeword length must be ' + instance.n);
      }
      
      // Step 1: Calculate syndrome
      instance.syndrome = this.calculateSyndrome(instance, receivedCodeword);
      
      // Step 2: Check if errors detected
      const errorsDetected = instance.syndrome.some(s => s !== 0);
      
      if (!errorsDetected) {
        // No errors detected
        return {
          corrected: receivedCodeword.slice(0, instance.k),
          errors: 0,
          errorPositions: [],
          success: true
        };
      }
      
      // Step 3: Find error positions using Berlekamp-Massey algorithm
      const errorLocator = this.berlekampMassey(instance);
      
      // Step 4: Find roots of error locator polynomial (Chien search)
      instance.errorPositions = this.chienSearch(instance, errorLocator);
      
      // Step 5: Correct errors
      const correctedCodeword = receivedCodeword.slice();
      for (let pos of instance.errorPositions) {
        correctedCodeword[pos] ^= 1;  // Flip bit at error position
      }
      
      // Step 6: Verify correction
      const verificationSyndrome = this.calculateSyndrome(instance, correctedCodeword);
      const correctionSuccessful = verificationSyndrome.every(s => s === 0);
      
      return {
        corrected: correctedCodeword.slice(0, instance.k),
        errors: instance.errorPositions.length,
        errorPositions: instance.errorPositions.slice(),
        success: correctionSuccessful,
        uncorrectable: instance.errorPositions.length > instance.t
      };
    },
    
    /**
     * Calculate syndrome for error detection
     */
    calculateSyndrome: function(instance, codeword) {
      const syndrome = [];
      
      // Calculate S_i = r(α^i) for i = 1, 2, ..., 2t
      for (let i = 1; i <= 2 * instance.t; i++) {
        let syndromeValue = 0;
        
        // Evaluate received polynomial at α^i
        for (let j = 0; j < codeword.length; j++) {
          if (codeword[j] === 1) {
            const power = (i * (codeword.length - 1 - j)) % (instance.n);
            syndromeValue ^= this.galoisExp(instance, power);
          }
        }
        
        syndrome.push(syndromeValue);
      }
      
      return syndrome;
    },
    
    /**
     * Berlekamp-Massey algorithm for finding error locator polynomial
     */
    berlekampMassey: function(instance) {
      const syndrome = instance.syndrome;
      const t = instance.t;
      
      let C = [1];  // Error locator polynomial
      let B = [1];  // Auxiliary polynomial
      let L = 0;    // Degree of C
      let m = 1;    // Counter
      let b = 1;    // Field element
      
      for (let n = 0; n < 2 * t; n++) {
        // Calculate discrepancy
        let d = syndrome[n];
        for (let i = 1; i <= L; i++) {
          if (i < C.length) {
            d ^= this.galoisMultiply(instance, C[i], syndrome[n - i]);
          }
        }
        
        if (d === 0) {
          m++;
        } else {
          const T = C.slice();
          
          // Update C
          for (let i = 0; i < B.length; i++) {
            const coeff = this.galoisMultiply(instance, d, this.galoisInverse(instance, b));
            const term = this.galoisMultiply(instance, coeff, B[i]);
            
            if (C.length <= m + i) {
              C.length = m + i + 1;
              C.fill(0, T.length);
            }
            C[m + i] ^= term;
          }
          
          if (2 * L <= n) {
            L = n + 1 - L;
            B = T.slice();
            b = d;
            m = 1;
          } else {
            m++;
          }
        }
      }
      
      return C;
    },
    
    /**
     * Chien search for finding roots of error locator polynomial
     */
    chienSearch: function(instance, errorLocator) {
      const errorPositions = [];
      
      // Test all possible positions α^(-i) for i = 0, 1, ..., n-1
      for (let i = 0; i < instance.n; i++) {
        let sum = 0;
        
        // Evaluate error locator polynomial at α^(-i)
        for (let j = 0; j < errorLocator.length; j++) {
          const power = (j * (instance.n - i)) % instance.n;
          sum ^= this.galoisMultiply(instance, errorLocator[j], this.galoisExp(instance, power));
        }
        
        if (sum === 0) {
          errorPositions.push(i);
        }
      }
      
      return errorPositions;
    },
    
    /**
     * Galois field multiplication
     */
    galoisMultiply: function(instance, a, b) {
      if (a === 0 || b === 0) return 0;
      
      const logA = instance.logTable[a];
      const logB = instance.logTable[b];
      const logSum = (logA + logB) % (instance.fieldSize - 1);
      
      return instance.antilogTable[logSum];
    },
    
    /**
     * Galois field exponentiation
     */
    galoisExp: function(instance, power) {
      if (power === 0) return 1;
      power = power % (instance.fieldSize - 1);
      return instance.antilogTable[power];
    },
    
    /**
     * Galois field inverse
     */
    galoisInverse: function(instance, a) {
      if (a === 0) throw new Error('Cannot invert zero in Galois field');
      
      const logA = instance.logTable[a];
      const logInv = (instance.fieldSize - 1 - logA) % (instance.fieldSize - 1);
      
      return instance.antilogTable[logInv];
    },
    
    /**
     * Polynomial multiplication in GF(2^m)
     */
    multiplyPolynomials: function(p1, p2, instance) {
      const result = new Array(p1.length + p2.length - 1).fill(0);
      
      for (let i = 0; i < p1.length; i++) {
        for (let j = 0; j < p2.length; j++) {
          result[i + j] ^= this.galoisMultiply(instance, p1[i], p2[j]);
        }
      }
      
      return result;
    },
    
    /**
     * Polynomial division in GF(2^m)
     */
    polynomialDivision: function(dividend, divisor) {
      const remainder = dividend.slice();
      
      for (let i = 0; i <= remainder.length - divisor.length; i++) {
        if (remainder[i] !== 0) {
          for (let j = 0; j < divisor.length; j++) {
            remainder[i + j] ^= divisor[j];
          }
        }
      }
      
      return remainder.slice(remainder.length - divisor.length + 1);
    },
    
    /**
     * Get polynomial degree
     */
    polynomialDegree: function(polynomial) {
      for (let i = polynomial.length - 1; i >= 0; i--) {
        if (polynomial[i] !== 0) {
          return i;
        }
      }
      return 0;
    },
    
    /**
     * Check if polynomial p1 is divisible by p2
     */
    isDivisible: function(p1, p2) {
      const remainder = this.polynomialDivision(p1, p2);
      return remainder.every(coeff => coeff === 0);
    },
    
    /**
     * Clear sensitive instance data
     */
    ClearData: function(instanceId) {
      const instance = this.instances[instanceId];
      if (instance) {
        // Clear arrays
        instance.alpha = [];
        instance.logTable = [];
        instance.antilogTable = [];
        instance.generatorPolynomial = [];
        instance.minimalPolynomials = [];
        instance.syndrome = [];
        instance.errorPositions = [];
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
        type: 'Error Correction Code',
        description: 'Cyclic codes for multiple error detection and correction',
        inventors: 'Bose, Chaudhuri, Hocquenghem (1959-1960)',
        mathematics: 'Galois field GF(2^m) polynomial arithmetic',
        properties: 'Systematic, cyclic, linear block codes',
        applications: 'Data storage, satellite communications, digital TV',
        decoding: 'Syndrome calculation, Berlekamp-Massey, Chien search',
        performance: 'Corrects up to t random errors'
      };
    }
  };
  
  // Test vectors for BCH Codes
  BCHCodes.testVectors = [
    {
      algorithm: 'BCH Codes',
      testId: 'bch-simple-001',
      description: 'BCH(7,4,3) single error correction code',
      category: 'educational',
      
      m: 3,
      t: 1,
      n: 7,
      k: 4,
      d: 3,
      
      testData: [1, 0, 1, 1],
      expectedCodeword: [1, 0, 1, 1, 0, 1, 0],
      errorPattern: [0, 0, 1, 0, 0, 0, 0],  // Single error
      
      source: {
        type: 'educational',
        identifier: 'BCH Theory',
        title: 'Error Correction Coding: Mathematical Methods and Algorithms',
        url: 'https://en.wikipedia.org/wiki/BCH_code',
        organization: 'Educational',
        section: 'BCH(7,4) Example',
        datePublished: '1960-01-01',
        dateAccessed: '2025-01-17'
      }
    },
    {
      algorithm: 'BCH Codes',
      testId: 'bch-extended-002',
      description: 'BCH(15,7,5) double error correction code',
      category: 'educational',
      
      m: 4,
      t: 2,
      n: 15,
      k: 7,
      d: 5,
      
      testData: [1, 1, 0, 1, 0, 1, 1],
      // Actual codeword will be computed
      errorPattern: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],  // Double error
      
      source: {
        type: 'educational',
        identifier: 'BCH Theory',
        title: 'Error Correction Coding: Mathematical Methods and Algorithms',
        url: 'https://en.wikipedia.org/wiki/BCH_code',
        organization: 'Educational',
        section: 'BCH(15,7) Example',
        datePublished: '1960-01-01',
        dateAccessed: '2025-01-17'
      }
    }
  ];
  
  // Register with Cipher system if available
  if (typeof global.Cipher !== 'undefined') {
    global.Cipher.AddCipher(BCHCodes);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BCHCodes;
  }
  
  // Export to global scope
  global.BCHCodes = BCHCodes;
  
})(typeof global !== 'undefined' ? global : window);