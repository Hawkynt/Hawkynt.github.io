/*
 * Rule30 Cellular Automata Stream Cipher Implementation
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
  
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      // Node.js environment - load dependencies
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('Rule30 cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  const Rule30 = {
    name: "Rule30",
    description: "Elementary cellular automaton-based pseudorandom number generator using Rule 30 pattern. Exhibits chaotic behavior suitable for simple random number generation but not cryptographically secure.",
    inventor: "Stephen Wolfram",
    year: 1983,
    country: "GB",
    category: "cipher",
    subCategory: "Stream Cipher",
    securityStatus: "educational",
    securityNotes: "Cellular automaton not designed for cryptographic use. Predictable with sufficient state knowledge and lacks proper cryptographic properties. Educational use only.",
    
    documentation: [
      {text: "Rule 30 Wikipedia", uri: "https://en.wikipedia.org/wiki/Rule_30"},
      {text: "A New Kind of Science", uri: "https://www.wolframscience.com/nks/"}
    ],
    
    references: [
      {text: "Wolfram's Original Paper", uri: "https://www.stephenwolfram.com/publications/cellular-automata-irreversibility/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Predictability", 
        text: "State can be reconstructed from sufficient keystream output, not cryptographically secure",
        mitigation: "Use only for educational purposes, never for actual cryptography"
      }
    ],
    
    tests: [
      {
        text: "Basic Rule30 Test",
        uri: "Educational test case",
        keySize: 8,
        key: Hex8ToBytes("0102030405060708"),
        input: Hex8ToBytes("00000000000000000000000000000000"),
        expected: [] // No official test vectors, cellular automaton based
      }
    ],

    // Required by cipher system
    minKeyLength: 1,
    maxKeyLength: 1024,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 1024,
    stepBlockSize: 1,
    instances: {},
    
    // Cipher parameters
    nBlockSizeInBits: 8,     // Generate 8 bits at a time
    nKeySizeInBits: 256,     // Use key to initialize the CA state
    
    // Constants
    DEFAULT_SIZE: 127,       // CA array size (odd number for central cell)
    
    // Internal state
    cells: null,             // Current CA state
    size: 0,                 // Array size
    centerIndex: 0,          // Index of center cell
    isInitialized: false,
    
    /**
     * Initialize cipher with empty state
     */
    Init: function() {
      this.size = this.DEFAULT_SIZE;
      this.centerIndex = Math.floor(this.size / 2);
      this.cells = new Array(this.size).fill(0);
      this.isInitialized = false;
      return true;
    },
    
    /**
     * Setup key for Rule30 stream cipher
     * @param {Array} key - Key as byte array (32 bytes for 256-bit key)
     */
    KeySetup: function(key) {
      if (!key || key.length !== 32) {
        throw new Error('Rule30 requires 256-bit (32 byte) key');
      }
      
      // Initialize state
      this.Init();
      
      // Initialize CA state from key
      // Use key bytes to set initial cell states
      for (let i = 0; i < this.size; i++) {
        const keyIndex = i % key.length;
        const bitIndex = i % 8;
        this.cells[i] = (key[keyIndex] >>> bitIndex) & 1;
      }
      
      // Ensure at least one cell is set (to avoid all-zero state)
      if (this.cells.every(cell => cell === 0)) {
        this.cells[this.centerIndex] = 1;
      }
      
      // Perform some initial evolution steps to mix the state
      for (let step = 0; step < 100; step++) {
        this.evolveCA();
      }
      
      this.isInitialized = true;
      return true;
    },
    
    /**
     * Apply Rule 30 evolution to the cellular automaton
     * Rule 30: 00011110 (binary)
     * Current pattern -> Next state
     * 111 -> 0, 110 -> 0, 101 -> 0, 100 -> 1
     * 011 -> 1, 010 -> 1, 001 -> 1, 000 -> 0
     */
    evolveCA: function() {
      const newCells = new Array(this.size);
      
      for (let i = 0; i < this.size; i++) {
        // Get neighbors (with wrap-around)
        const left = this.cells[(i - 1 + this.size) % this.size];
        const center = this.cells[i];
        const right = this.cells[(i + 1) % this.size];
        
        // Apply Rule 30
        // XOR of left neighbor and (center OR right neighbor)
        newCells[i] = left ^ (center | right);
      }
      
      this.cells = newCells;
    },
    
    /**
     * Generate a single bit from the center cell
     * @returns {number} 0 or 1
     */
    generateBit: function() {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized - call KeySetup first');
      }
      
      // Evolve the CA one step
      this.evolveCA();
      
      // Return the center cell value
      return this.cells[this.centerIndex];
    },
    
    /**
     * Generate a byte (8 bits) from the CA
     * @returns {number} Byte value (0-255)
     */
    generateByte: function() {
      let byte = 0;
      
      for (let bit = 0; bit < 8; bit++) {
        const bitValue = this.generateBit();
        byte |= (bitValue << bit);
      }
      
      return byte;
    },
    
    /**
     * Generate keystream bytes
     * @param {number} length - Number of bytes to generate
     * @returns {Array} Array of keystream bytes
     */
    generateKeystream: function(length) {
      const keystream = [];
      
      for (let i = 0; i < length; i++) {
        keystream.push(this.generateByte());
      }
      
      return keystream;
    },
    
    /**
     * Encrypt block using Rule30 stream cipher
     * @param {number} position - Block position (unused for stream cipher)
     * @param {string} input - Input data as string
     * @returns {string} Encrypted data as string
     */
    encryptBlock: function(position, input) {
      if (!this.isInitialized) {
        throw new Error('Cipher not initialized');
      }
      
      const inputBytes = OpCodes.StringToBytes(input);
      const keystream = this.generateKeystream(inputBytes.length);
      const outputBytes = OpCodes.XorArrays(inputBytes, keystream);
      
      return OpCodes.BytesToString(outputBytes);
    },
    
    /**
     * Decrypt block (same as encrypt for stream cipher)
     * @param {number} position - Block position
     * @param {string} input - Input data as string
     * @returns {string} Decrypted data as string
     */
    decryptBlock: function(position, input) {
      return this.encryptBlock(position, input);
    },
    
    /**
     * Get current CA state for debugging
     * @returns {Array} Current cell states
     */
    getState: function() {
      return this.cells ? this.cells.slice() : null;
    },
    
    /**
     * Set CA size (must be odd number for central cell)
     * @param {number} size - New size for the CA
     */
    setSize: function(size) {
      if (size % 2 === 0) {
        size++; // Ensure odd size
      }
      
      this.size = size;
      this.centerIndex = Math.floor(size / 2);
      
      if (this.cells) {
        // Resize existing array
        if (this.cells.length < size) {
          // Expand array
          const newCells = new Array(size).fill(0);
          const offset = Math.floor((size - this.cells.length) / 2);
          for (let i = 0; i < this.cells.length; i++) {
            newCells[offset + i] = this.cells[i];
          }
          this.cells = newCells;
        } else if (this.cells.length > size) {
          // Shrink array (keep center portion)
          const offset = Math.floor((this.cells.length - size) / 2);
          this.cells = this.cells.slice(offset, offset + size);
        }
      }
    },
    
    /**
     * Clear sensitive data
     */
    ClearData: function() {
      if (this.cells) {
        OpCodes.ClearArray(this.cells);
        this.cells = null;
      }
      this.isInitialized = false;
    }
  };
  
  // Auto-register with Subsystem (according to category) if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(Rule30);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Rule30;
  }
  
  // Make available globally
  global.Rule30 = Rule30;
  
})(typeof global !== 'undefined' ? global : window);