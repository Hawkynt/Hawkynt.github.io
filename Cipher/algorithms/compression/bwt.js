#!/usr/bin/env node
/*
 * Universal Burrows-Wheeler Transform (BWT)
 * Based on original 1994 paper by Burrows and Wheeler
 * Compatible with both Browser and Node.js environments
 * 
 * The Burrows-Wheeler Transform is a reversible transformation
 * that rearranges data to make it more compressible. It's used
 * as a preprocessing step in compression algorithms like bzip2.
 * 
 * References:
 * - Burrows, M.; Wheeler, D. (1994). "A block-sorting lossless data compression algorithm"
 * - Technical Report 124, Digital Equipment Corporation
 * 
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
      return;
    }
  }
  
  if (!global.Cipher && typeof require !== 'undefined') {
    try {
      require('../../universal-cipher-env.js');
      require('../../cipher.js');
    } catch (e) {
      console.error('Failed to load cipher dependencies:', e.message);
      return;
    }
  }
  
  const BWT = {
    internalName: 'bwt',
    name: 'Burrows-Wheeler Transform',
    version: '1.0.0',
        comment: 'Educational implementation for learning purposes',
    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,

    
    // End-of-string marker (should not appear in input)
    EOS_MARKER: 0,
    
    /**
     * Initialize the transform
     */
    Init: function() {
      this.EOS_MARKER = 0; // Use null byte as end marker
    },
    
    /**
     * Set up transform parameters
     * @param {Object} key - Configuration options
     */
    KeySetup: function(key) {
      if (typeof key === 'object' && key !== null) {
        this.EOS_MARKER = key.eosMarker || 0;
      }
    },
    
    /**
     * Apply forward or inverse BWT
     * @param {number} mode - Transform mode (0 = forward, 1 = inverse)
     * @param {string|Array} data - Input data
     * @returns {Object|Array} Transform result
     */
    encryptBlock: function(mode, data) {
      if (mode === 0) {
        return this.forwardTransform(data);
      } else if (mode === 1) {
        return this.inverseTransform(data);
      } else {
        throw new Error('BWT: Invalid mode');
      }
    },
    
    /**
     * Alias for szEncryptBlock
     */
    decryptBlock: function(mode, data) {
      return this.encryptBlock(mode, data);
    },
    
    /**
     * Apply forward Burrows-Wheeler Transform
     * @param {string|Array} data - Input data
     * @returns {Object} {transformed: Array, index: number}
     */
    forwardTransform: function(data) {
      // Convert input to byte array
      let input;
      if (typeof data === 'string') {
        input = OpCodes.StringToBytes(data);
      } else if (Array.isArray(data)) {
        input = data.slice();
      } else {
        throw new Error('BWT: Invalid input data type');
      }
      
      if (input.length === 0) {
        return { transformed: [], index: 0 };
      }
      
      // Add end-of-string marker
      const inputWithEOS = input.concat([this.EOS_MARKER]);
      const n = inputWithEOS.length;
      
      // Generate all rotations with their indices
      const rotations = [];
      for (let i = 0; i < n; i++) {
        rotations.push({
          rotation: inputWithEOS.slice(i).concat(inputWithEOS.slice(0, i)),
          originalIndex: i
        });
      }
      
      // Sort rotations lexicographically
      rotations.sort((a, b) => {
        for (let i = 0; i < n; i++) {
          if (a.rotation[i] !== b.rotation[i]) {
            return a.rotation[i] - b.rotation[i];
          }
        }
        return 0;
      });
      
      // Extract last column and find index of original string
      const lastColumn = [];
      let originalIndex = -1;
      
      for (let i = 0; i < rotations.length; i++) {
        lastColumn.push(rotations[i].rotation[n - 1]);
        if (rotations[i].originalIndex === 0) {
          originalIndex = i;
        }
      }
      
      return {
        transformed: lastColumn,
        index: originalIndex
      };
    },
    
    /**
     * Apply inverse Burrows-Wheeler Transform
     * @param {Object|Array} data - Transform result or just the transformed array
     * @param {number} index - Original string index (if data is just array)
     * @returns {Array} Original data
     */
    inverseTransform: function(data, index = null) {
      let lastColumn, originalIndex;
      
      if (typeof data === 'object' && data.transformed && typeof data.index === 'number') {
        // Data is complete transform result
        lastColumn = data.transformed;
        originalIndex = data.index;
      } else if (Array.isArray(data) && typeof index === 'number') {
        // Data is just the transformed array
        lastColumn = data;
        originalIndex = index;
      } else {
        throw new Error('BWT: Invalid input format for inverse transform');
      }
      
      if (lastColumn.length === 0) {
        return [];
      }
      
      const n = lastColumn.length;
      
      // Create first column by sorting last column
      const firstColumn = lastColumn.slice().sort((a, b) => a - b);
      
      // Build next array (mapping from last column to first column)
      const next = new Array(n);
      const count = new Array(256).fill(0);
      
      // Count occurrences of each character in first column
      for (let i = 0; i < n; i++) {
        count[firstColumn[i]]++;
      }
      
      // Convert counts to starting positions
      let total = 0;
      for (let i = 0; i < 256; i++) {
        const temp = count[i];
        count[i] = total;
        total += temp;
      }
      
      // Build next array
      for (let i = 0; i < n; i++) {
        const char = lastColumn[i];
        next[count[char]] = i;
        count[char]++;
      }
      
      // Reconstruct original string
      const result = [];
      let current = originalIndex;
      
      for (let i = 0; i < n; i++) {
        const char = lastColumn[current];
        if (char !== this.EOS_MARKER) {
          result.push(char);
        }
        current = next[current];
      }
      
      return result;
    },
    
    /**
     * Analyze BWT properties of input data
     * @param {string|Array} data - Input data
     * @returns {Object} Analysis results
     */
    analyze: function(data) {
      const result = this.forwardTransform(data);
      const transformed = result.transformed;
      
      // Count character frequencies
      const frequencies = new Array(256).fill(0);
      for (const byte of transformed) {
        frequencies[byte]++;
      }
      
      // Count runs (consecutive identical characters)
      let runs = 0;
      let maxRun = 0;
      let currentRun = 1;
      
      for (let i = 1; i < transformed.length; i++) {
        if (transformed[i] === transformed[i - 1]) {
          currentRun++;
        } else {
          runs++;
          maxRun = Math.max(maxRun, currentRun);
          currentRun = 1;
        }
      }
      if (currentRun > 0) {
        runs++;
        maxRun = Math.max(maxRun, currentRun);
      }
      
      // Calculate entropy
      let entropy = 0;
      const length = transformed.length;
      for (let i = 0; i < 256; i++) {
        if (frequencies[i] > 0) {
          const prob = frequencies[i] / length;
          entropy -= prob * Math.log2(prob);
        }
      }
      
      return {
        originalLength: Array.isArray(data) ? data.length : OpCodes.StringToBytes(data).length,
        transformedLength: transformed.length,
        primaryIndex: result.index,
        uniqueCharacters: frequencies.filter(f => f > 0).length,
        entropy: entropy,
        runs: runs,
        maxRunLength: maxRun,
        compressionPotential: entropy < 7 ? 'Good' : entropy < 6 ? 'Very Good' : 'Poor'
      };
    },
    
    /**
     * Test round-trip transformation
     * @param {string|Array} data - Test data
     * @returns {boolean} True if round-trip successful
     */
    testRoundTrip: function(data) {
      try {
        const forward = this.forwardTransform(data);
        const inverse = this.inverseTransform(forward);
        
        // Convert input to bytes for comparison
        const originalBytes = Array.isArray(data) ? data : OpCodes.StringToBytes(data);
        
        if (originalBytes.length !== inverse.length) {
          return false;
        }
        
        for (let i = 0; i < originalBytes.length; i++) {
          if (originalBytes[i] !== inverse[i]) {
            return false;
          }
        }
        
        return true;
      } catch (e) {
        return false;
      }
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      this.EOS_MARKER = 0;
    },
    
    /**
     * Get cipher information
     * @returns {Object} Cipher information
     */
    GetInfo: function() {
      return {
        name: this.name,
        version: this.version,
        type: 'Transform',
        blockSize: 'Variable',
        keySize: 'EOS marker',
        description: 'Burrows-Wheeler Transform for data preprocessing',
        properties: ['Reversible', 'Increases compressibility', 'Block-sorting'],
        applications: ['bzip2 compression', 'Data compression preprocessing', 'Bioinformatics'],
        inventors: 'Michael Burrows and David Wheeler (1994)',
        complexity: 'O(n log n) time, O(n) space'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined' && Cipher.AddCipher) {
    Cipher.AddCipher(BWT);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BWT;
  }
  
  // Make available globally
  global.BWT = BWT;
  
})(typeof global !== 'undefined' ? global : window);