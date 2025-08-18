#!/usr/bin/env node
/*
 * Universal LDPC (Low-Density Parity-Check) Error Correction Codes
 * Compatible with both Browser and Node.js environments
 * Based on modern LDPC theory and belief propagation decoding
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of LDPC codes using sparse parity-check matrices.
 * LDPC codes are among the best error correction codes, approaching the
 * Shannon limit for many channel types.
 * 
 * WARNING: This implementation is for educational purposes only.
 * Use optimized LDPC libraries for production systems.
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
      console.error('LDPC Codes require Cipher system to be loaded first');
      return;
    }
  }
  
  // LDPC Constants
  const LDPC_CONSTANTS = {
    MAX_ITERATIONS: 100,     // Maximum belief propagation iterations
    MIN_ITERATIONS: 5,       // Minimum iterations
    CONVERGENCE_THRESHOLD: 1e-6,  // Convergence threshold for soft decoding
    MAX_CODE_LENGTH: 10000,  // Maximum practical code length
    MIN_CODE_LENGTH: 10,     // Minimum code length
    
    // Standard LDPC code configurations
    STANDARD_CODES: {
      'wifi_648_324': { n: 648, k: 324, rate: 0.5 },      // WiFi 802.11n
      'dvb_16200_8100': { n: 16200, k: 8100, rate: 0.5 }, // DVB-S2
      'wimax_576_288': { n: 576, k: 288, rate: 0.5 }      // WiMAX
    }
  };
  
  const LDPCCodes = {
    internalName: 'ldpc-codes',
    name: 'LDPC Error Correction Codes',
    
    // Required Cipher interface properties
    minKeyLength: 0,         // No key required
    maxKeyLength: 0,         // ECC parameters instead
    stepKeyLength: 1,        // N/A
    minBlockSize: 1,         // Can encode single bits
    maxBlockSize: 0,         // Limited by implementation
    stepBlockSize: 1,        // Bit-wise processing
    instances: {},           // Instance tracking
    
    // Metadata
    version: '1.0.0',
    date: '2025-01-17',
    author: 'Robert Gallager (1962) - Educational Implementation',
    description: 'Low-Density Parity-Check Codes with Belief Propagation Decoding',
    reference: 'Gallager: Low-Density Parity-Check Codes (1963)',
    
    // Code parameters
    supportedRates: [0.5, 0.667, 0.75, 0.833],  // Common code rates
    
    /**
     * Initialize LDPC instance
     */
    Init: function() {
      const instance = {
        n: 0,                   // Code length (total bits)
        k: 0,                   // Information length
        m: 0,                   // Parity check length (n - k)
        rate: 0,                // Code rate (k/n)
        
        // Parity check matrix (sparse representation)
        H: [],                  // Parity check matrix
        G: [],                  // Generator matrix (optional)
        
        // Sparse matrix representations
        variableNodes: [],      // Variable node connections
        checkNodes: [],         // Check node connections
        
        // Bipartite graph parameters
        dv: 0,                  // Variable node degree
        dc: 0,                  // Check node degree
        
        // Decoding parameters
        maxIterations: LDPC_CONSTANTS.MAX_ITERATIONS,
        convergenceThreshold: LDPC_CONSTANTS.CONVERGENCE_THRESHOLD,
        
        // Decoding state
        beliefs: [],            // Belief propagation messages
        posteriors: [],         // Posterior probabilities
        
        initialized: false
      };
      
      const instanceId = Math.random().toString(36).substr(2, 9);
      this.instances[instanceId] = instance;
      return instanceId;
    },
    
    /**
     * Setup LDPC code parameters
     */
    Setup: function(instanceId, n, k, constructionMethod = 'regular') {
      const instance = this.instances[instanceId];
      if (!instance) {
        throw new Error('Invalid LDPC instance ID');
      }
      
      if (n < LDPC_CONSTANTS.MIN_CODE_LENGTH || n > LDPC_CONSTANTS.MAX_CODE_LENGTH) {
        throw new Error('Code length must be between ' + LDPC_CONSTANTS.MIN_CODE_LENGTH + ' and ' + LDPC_CONSTANTS.MAX_CODE_LENGTH);
      }
      
      if (k >= n || k < 1) {
        throw new Error('Information length must be between 1 and n-1');
      }
      
      instance.n = n;
      instance.k = k;
      instance.m = n - k;
      instance.rate = k / n;
      
      // Construct parity check matrix based on method
      switch (constructionMethod) {
        case 'regular':
          this.constructRegularLDPC(instance);
          break;
        case 'irregular':
          this.constructIrregularLDPC(instance);
          break;
        case 'structured':
          this.constructStructuredLDPC(instance);
          break;
        default:
          throw new Error('Unknown construction method: ' + constructionMethod);
      }
      
      // Build bipartite graph representation
      this.buildBipartiteGraph(instance);
      
      instance.initialized = true;
      
      return {
        n: instance.n,
        k: instance.k,
        m: instance.m,
        rate: instance.rate,
        dv: instance.dv,
        dc: instance.dc,
        density: this.calculateDensity(instance.H)
      };
    },
    
    /**
     * Construct regular LDPC code (constant node degrees)
     */
    constructRegularLDPC: function(instance) {
      const n = instance.n;
      const m = instance.m;
      
      // Choose node degrees for good performance
      instance.dv = Math.max(3, Math.ceil(4 * instance.rate));  // Variable node degree
      instance.dc = Math.ceil(instance.dv / instance.rate);     // Check node degree
      
      // Initialize parity check matrix
      instance.H = this.createSparseMatrix(m, n);
      
      // Regular construction: each variable node connects to dv check nodes
      for (let v = 0; v < n; v++) {
        const checkNodes = this.randomSample(m, instance.dv);
        for (let c of checkNodes) {
          this.setSparseElement(instance.H, c, v, 1);
        }
      }
      
      // Ensure each check node has approximately dc connections
      this.balanceCheckNodes(instance);
    },
    
    /**
     * Construct irregular LDPC code (variable node degrees)
     */
    constructIrregularLDPC: function(instance) {
      const n = instance.n;
      const m = instance.m;
      
      // Use degree distribution that approaches capacity
      const lambda = [0, 0.01, 0.38, 0.3, 0.31];  // Variable node distribution
      const rho = [0, 0.68, 0.32];                 // Check node distribution
      
      instance.H = this.createSparseMatrix(m, n);
      
      // Assign degrees according to distribution
      for (let v = 0; v < n; v++) {
        const degree = this.sampleDegree(lambda);
        const checkNodes = this.randomSample(m, degree);
        for (let c of checkNodes) {
          this.setSparseElement(instance.H, c, v, 1);
        }
      }
      
      // Calculate average degrees
      instance.dv = this.calculateAverageVariableDegree(instance.H);
      instance.dc = this.calculateAverageCheckDegree(instance.H);
    },
    
    /**
     * Construct structured LDPC code (e.g., QC-LDPC)
     */
    constructStructuredLDPC: function(instance) {
      const n = instance.n;
      const m = instance.m;
      
      // Simple circulant-based construction
      const submatrixSize = Math.floor(Math.sqrt(n));
      instance.H = this.createSparseMatrix(m, n);
      
      // Create circulant submatrices
      for (let i = 0; i < Math.floor(m / submatrixSize); i++) {
        for (let j = 0; j < Math.floor(n / submatrixSize); j++) {
          if (Math.random() < 0.3) {  // 30% chance of non-zero submatrix
            const shift = Math.floor(Math.random() * submatrixSize);
            this.addCirculantSubmatrix(instance.H, i * submatrixSize, j * submatrixSize, submatrixSize, shift);
          }
        }
      }
      
      instance.dv = this.calculateAverageVariableDegree(instance.H);
      instance.dc = this.calculateAverageCheckDegree(instance.H);
    },
    
    /**
     * Encode data using LDPC code
     */
    Encode: function(instanceId, data) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.initialized) {
        throw new Error('LDPC instance not properly initialized');
      }
      
      if (!Array.isArray(data)) {
        data = Array.from(data);
      }
      
      // Convert bytes to bits
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
      
      // Systematic encoding: solve H * c = 0 where c = [u | p]
      const parity = this.calculateParitySystematic(instance, bits);
      const codeword = bits.concat(parity);
      
      return {
        codeword: codeword,
        dataLength: instance.k,
        parityLength: instance.m,
        totalLength: instance.n
      };
    },
    
    /**
     * Calculate parity bits for systematic encoding
     */
    calculateParitySystematic: function(instance, data) {
      // For systematic encoding, we need to solve H1 * u + H2 * p = 0
      // This is simplified for educational purposes
      const parity = new Array(instance.m).fill(0);
      
      for (let i = 0; i < instance.m; i++) {
        let sum = 0;
        
        // Sum data bits according to parity check matrix
        for (let j = 0; j < instance.k; j++) {
          if (this.getSparseElement(instance.H, i, j) === 1) {
            sum ^= data[j];
          }
        }
        
        parity[i] = sum;
      }
      
      return parity;
    },
    
    /**
     * Decode using belief propagation algorithm
     */
    Decode: function(instanceId, receivedSignal, channelLLR = null) {
      const instance = this.instances[instanceId];
      if (!instance || !instance.initialized) {
        throw new Error('LDPC instance not properly initialized');
      }
      
      if (!Array.isArray(receivedSignal)) {
        receivedSignal = Array.from(receivedSignal);
      }
      
      if (receivedSignal.length !== instance.n) {
        throw new Error('Received signal length must be ' + instance.n);
      }
      
      // Initialize channel LLRs (log-likelihood ratios)
      if (!channelLLR) {
        channelLLR = this.hardToSoftDecision(receivedSignal);
      }
      
      // Initialize belief propagation
      this.initializeBeliefPropagation(instance, channelLLR);
      
      // Iterative belief propagation
      let converged = false;
      let iteration = 0;
      
      while (!converged && iteration < instance.maxIterations) {
        // Variable to check messages
        this.updateVariableToCheckMessages(instance);
        
        // Check to variable messages
        this.updateCheckToVariableMessages(instance);
        
        // Update posterior beliefs
        this.updatePosteriorBeliefs(instance, channelLLR);
        
        // Check for convergence
        converged = this.checkConvergence(instance);
        iteration++;
      }
      
      // Make hard decisions
      const decoded = this.makeHardDecisions(instance);
      
      // Verify syndrome
      const syndrome = this.calculateSyndrome(instance, decoded);
      const syndromeZero = syndrome.every(s => s === 0);
      
      return {
        decoded: decoded.slice(0, instance.k),
        codeword: decoded,
        iterations: iteration,
        converged: converged,
        syndrome: syndrome,
        success: syndromeZero
      };
    },
    
    /**
     * Convert hard decisions to soft LLRs
     */
    hardToSoftDecision: function(hardBits) {
      return hardBits.map(bit => bit === 0 ? 4.0 : -4.0);  // Simple AWGN assumption
    },
    
    /**
     * Initialize belief propagation messages
     */
    initializeBeliefPropagation: function(instance, channelLLR) {
      const n = instance.n;
      const m = instance.m;
      
      // Initialize message arrays
      instance.beliefs = {
        variableToCheck: this.createSparseMatrix(m, n),
        checkToVariable: this.createSparseMatrix(m, n)
      };
      
      instance.posteriors = channelLLR.slice();
      
      // Initialize variable to check messages with channel LLRs
      for (let v = 0; v < n; v++) {
        for (let c of instance.variableNodes[v]) {
          this.setSparseElement(instance.beliefs.variableToCheck, c, v, channelLLR[v]);
        }
      }
    },
    
    /**
     * Update variable to check messages
     */
    updateVariableToCheckMessages: function(instance) {
      for (let v = 0; v < instance.n; v++) {
        const connectedChecks = instance.variableNodes[v];
        
        for (let c of connectedChecks) {
          let message = instance.posteriors[v];
          
          // Subtract incoming message from this check node
          const incomingMessage = this.getSparseElement(instance.beliefs.checkToVariable, c, v);
          message -= incomingMessage;
          
          this.setSparseElement(instance.beliefs.variableToCheck, c, v, message);
        }
      }
    },
    
    /**
     * Update check to variable messages
     */
    updateCheckToVariableMessages: function(instance) {
      for (let c = 0; c < instance.m; c++) {
        const connectedVariables = instance.checkNodes[c];
        
        for (let v of connectedVariables) {
          let product = 1.0;
          
          // Calculate product of tanh(incoming_messages / 2)
          for (let otherV of connectedVariables) {
            if (otherV !== v) {
              const incomingMessage = this.getSparseElement(instance.beliefs.variableToCheck, c, otherV);
              product *= Math.tanh(incomingMessage / 2.0);
            }
          }
          
          // Avoid numerical issues
          product = Math.max(-0.999, Math.min(0.999, product));
          
          // Convert back to LLR
          const message = 2.0 * Math.atanh(product);
          this.setSparseElement(instance.beliefs.checkToVariable, c, v, message);
        }
      }
    },
    
    /**
     * Update posterior beliefs
     */
    updatePosteriorBeliefs: function(instance, channelLLR) {
      for (let v = 0; v < instance.n; v++) {
        let posterior = channelLLR[v];
        
        // Sum all incoming check-to-variable messages
        for (let c of instance.variableNodes[v]) {
          const incomingMessage = this.getSparseElement(instance.beliefs.checkToVariable, c, v);
          posterior += incomingMessage;
        }
        
        instance.posteriors[v] = posterior;
      }
    },
    
    /**
     * Check for convergence
     */
    checkConvergence: function(instance) {
      // Simple convergence check based on hard decisions
      const hardDecisions = this.makeHardDecisions(instance);
      const syndrome = this.calculateSyndrome(instance, hardDecisions);
      return syndrome.every(s => s === 0);
    },
    
    /**
     * Make hard decisions from posterior beliefs
     */
    makeHardDecisions: function(instance) {
      return instance.posteriors.map(llr => llr > 0 ? 0 : 1);
    },
    
    /**
     * Calculate syndrome H * c
     */
    calculateSyndrome: function(instance, codeword) {
      const syndrome = new Array(instance.m).fill(0);
      
      for (let c = 0; c < instance.m; c++) {
        let sum = 0;
        for (let v = 0; v < instance.n; v++) {
          if (this.getSparseElement(instance.H, c, v) === 1) {
            sum ^= codeword[v];
          }
        }
        syndrome[c] = sum;
      }
      
      return syndrome;
    },
    
    /**
     * Build bipartite graph representation
     */
    buildBipartiteGraph: function(instance) {
      instance.variableNodes = Array.from({ length: instance.n }, () => []);
      instance.checkNodes = Array.from({ length: instance.m }, () => []);
      
      // Build adjacency lists
      for (let c = 0; c < instance.m; c++) {
        for (let v = 0; v < instance.n; v++) {
          if (this.getSparseElement(instance.H, c, v) === 1) {
            instance.variableNodes[v].push(c);
            instance.checkNodes[c].push(v);
          }
        }
      }
    },
    
    /**
     * Sparse matrix operations
     */
    createSparseMatrix: function(rows, cols) {
      return Array.from({ length: rows }, () => new Map());
    },
    
    setSparseElement: function(matrix, row, col, value) {
      if (value !== 0) {
        matrix[row].set(col, value);
      } else {
        matrix[row].delete(col);
      }
    },
    
    getSparseElement: function(matrix, row, col) {
      return matrix[row].get(col) || 0;
    },
    
    /**
     * Utility functions
     */
    randomSample: function(n, k) {
      const indices = Array.from({ length: n }, (_, i) => i);
      const sample = [];
      
      for (let i = 0; i < k && i < n; i++) {
        const randomIndex = Math.floor(Math.random() * (n - i));
        sample.push(indices[randomIndex]);
        indices[randomIndex] = indices[n - 1 - i];
      }
      
      return sample;
    },
    
    calculateDensity: function(H) {
      let nonZeros = 0;
      const totalElements = H.length * (H.length > 0 ? H[0].size : 0);
      
      for (let row of H) {
        nonZeros += row.size;
      }
      
      return totalElements > 0 ? nonZeros / totalElements : 0;
    },
    
    /**
     * Clear sensitive instance data
     */
    ClearData: function(instanceId) {
      const instance = this.instances[instanceId];
      if (instance) {
        // Clear matrices and arrays
        instance.H = [];
        instance.G = [];
        instance.variableNodes = [];
        instance.checkNodes = [];
        instance.beliefs = {};
        instance.posteriors = [];
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
        description: 'Low-density parity-check codes with belief propagation decoding',
        inventor: 'Robert Gallager (1962)',
        decoding: 'Iterative belief propagation (sum-product algorithm)',
        performance: 'Near Shannon limit performance',
        applications: 'WiFi, DVB-S2, WiMAX, 5G, storage systems',
        structure: 'Sparse bipartite graphs, Tanner graphs',
        complexity: 'Linear in code length per iteration'
      };
    }
  };
  
  // Test vectors for LDPC Codes
  LDPCCodes.testVectors = [
    {
      algorithm: 'LDPC Codes',
      testId: 'ldpc-small-001',
      description: 'Small regular LDPC(12,6) code for educational testing',
      category: 'educational',
      
      n: 12,
      k: 6,
      rate: 0.5,
      construction: 'regular',
      
      testData: [1, 0, 1, 1, 0, 1],
      // Actual codeword will be computed based on generated H matrix
      
      source: {
        type: 'educational',
        identifier: 'LDPC Theory',
        title: 'Modern Coding Theory',
        url: 'https://en.wikipedia.org/wiki/Low-density_parity-check_code',
        organization: 'Educational',
        section: 'Basic LDPC Example',
        datePublished: '1962-01-01',
        dateAccessed: '2025-01-17'
      }
    },
    {
      algorithm: 'LDPC Codes',
      testId: 'ldpc-wifi-002',
      description: 'WiFi 802.11n inspired LDPC code structure',
      category: 'practical',
      
      n: 48,
      k: 24,
      rate: 0.5,
      construction: 'structured',
      
      testData: Array.from({ length: 24 }, (_, i) => i % 2),
      
      source: {
        type: 'standard',
        identifier: 'IEEE 802.11n',
        title: 'Wireless LAN Medium Access Control and Physical Layer Specifications',
        url: 'https://standards.ieee.org/standard/802_11n-2009.html',
        organization: 'IEEE',
        section: 'LDPC Coding',
        datePublished: '2009-10-29',
        dateAccessed: '2025-01-17'
      }
    }
  ];
  
  // Register with Cipher system if available
  if (typeof global.Cipher !== 'undefined') {
    global.Cipher.AddCipher(LDPCCodes);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LDPCCodes;
  }
  
  // Export to global scope
  global.LDPCCodes = LDPCCodes;
  
})(typeof global !== 'undefined' ? global : window);