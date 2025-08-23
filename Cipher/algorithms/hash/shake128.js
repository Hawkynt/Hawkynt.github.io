#!/usr/bin/env node
/*
 * SHAKE128 Universal Extendable-Output Function Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * SHAKE128 is an extendable-output function (XOF) based on the Keccak sponge function.
 * It can produce outputs of any desired length. Part of the SHA-3 family.
 * 
 * Specification: NIST FIPS 202
 * Reference: https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 */

(function(global) {
  'use strict';
  
  // Load OpCodes library for common operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  // SHAKE128 constants
  const SHAKE128_RATE = 168;        // Rate in bytes (1344 bits)
  const SHAKE128_CAPACITY = 32;     // Capacity in bytes (256 bits)
  const KECCAK_ROUNDS = 24;         // Number of Keccak-f[1600] rounds
  
  // Keccak round constants
  const RC = [
    0x0000000000000001, 0x0000000000008082, 0x800000000000808a, 0x8000000080008000,
    0x000000000000808b, 0x0000000080000001, 0x8000000080008081, 0x8000000000008009,
    0x000000000000008a, 0x0000000000000088, 0x0000000080008009, 0x8000000000008003,
    0x8000000000008002, 0x8000000000000080, 0x000000000000800a, 0x800000008000000a,
    0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
    0x0000000000008082, 0x8000000000000001, 0x0000000080008003, 0x8000000080000000
  ];
  
  // Rotation offsets for rho step
  const RHO_OFFSETS = [
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41,
    45, 15, 21, 8, 18, 2, 61, 56, 14
  ];
  
  /**
   * Convert 64-bit number to high/low 32-bit representation
   * @param {number} val - 64-bit value (may lose precision)
   * @returns {Array} [low32, high32]
   */
  function to64bit(val) {
    return [val & 0xFFFFFFFF, Math.floor(val / 0x100000000) & 0xFFFFFFFF];
  }
  
  /**
   * 64-bit left rotation (using 32-bit operations)
   * @param {Array} val - [low32, high32]
   * @param {number} positions - Rotation positions
   * @returns {Array} Rotated [low32, high32]
   */
  function rotl64(val, positions) {
    const [low, high] = val;
    positions %= 64;
    
    if (positions === 0) return [low, high];
    
    if (positions === 32) {
      return [high, low];
    } else if (positions < 32) {
      const newHigh = ((high << positions) | (low >>> (32 - positions))) >>> 0;
      const newLow = ((low << positions) | (high >>> (32 - positions))) >>> 0;
      return [newLow, newHigh];
    } else {
      positions -= 32;
      const newHigh = ((low << positions) | (high >>> (32 - positions))) >>> 0;
      const newLow = ((high << positions) | (low >>> (32 - positions))) >>> 0;
      return [newLow, newHigh];
    }
  }
  
  /**
   * 64-bit XOR operation
   * @param {Array} a - [low32, high32]
   * @param {Array} b - [low32, high32]
   * @returns {Array} XOR result [low32, high32]
   */
  function xor64(a, b) {
    return [a[0] ^ b[0], a[1] ^ b[1]];
  }
  
  /**
   * Keccak-f[1600] permutation
   * @param {Array} state - 25 x [low32, high32] state array
   */
  function keccakF(state) {
    for (let round = 0; round < KECCAK_ROUNDS; round++) {
      // Theta step
      const C = new Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = [0, 0];
        for (let y = 0; y < 5; y++) {
          C[x] = xor64(C[x], state[x + 5 * y]);
        }
      }
      
      const D = new Array(5);
      for (let x = 0; x < 5; x++) {
        D[x] = xor64(C[(x + 4) % 5], rotl64(C[(x + 1) % 5], 1));
      }
      
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + 5 * y] = xor64(state[x + 5 * y], D[x]);
        }
      }
      
      // Rho step
      for (let i = 0; i < 25; i++) {
        state[i] = rotl64(state[i], RHO_OFFSETS[i]);
      }
      
      // Pi step
      const temp = new Array(25);
      for (let i = 0; i < 25; i++) {
        temp[i] = [state[i][0], state[i][1]];
      }
      
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + 5 * y] = temp[((x + 3 * y) % 5) + 5 * x];
        }
      }
      
      // Chi step
      for (let y = 0; y < 5; y++) {
        const row = new Array(5);
        for (let x = 0; x < 5; x++) {
          row[x] = [state[x + 5 * y][0], state[x + 5 * y][1]];
        }
        
        for (let x = 0; x < 5; x++) {
          const notNext = [~row[(x + 1) % 5][0], ~row[(x + 1) % 5][1]];
          const andResult = [notNext[0] & row[(x + 2) % 5][0], notNext[1] & row[(x + 2) % 5][1]];
          state[x + 5 * y] = xor64(row[x], andResult);
        }
      }
      
      // Iota step
      const rc = to64bit(RC[round]);
      state[0] = xor64(state[0], rc);
    }
  }
  
  /**
   * SHAKE128 hasher class
   */
  function Shake128Hasher() {
    this.state = new Array(25);
    for (let i = 0; i < 25; i++) {
      this.state[i] = [0, 0];
    }
    this.buffer = new Uint8Array(SHAKE128_RATE);
    this.bufferLength = 0;
    this.squeezing = false;
    this.squeezed = 0;
  }
  
  Shake128Hasher.prototype.absorb = function(data) {
    if (this.squeezing) {
      throw new Error('Cannot absorb after squeezing has started');
    }
    
    if (typeof data === 'string') {
      data = OpCodes.AnsiToBytes(data);
    }
    
    let offset = 0;
    
    while (offset < data.length) {
      const remaining = SHAKE128_RATE - this.bufferLength;
      const toCopy = Math.min(remaining, data.length - offset);
      
      // Copy data to buffer
      for (let i = 0; i < toCopy; i++) {
        this.buffer[this.bufferLength + i] = data[offset + i];
      }
      
      this.bufferLength += toCopy;
      offset += toCopy;
      
      // Process full blocks
      if (this.bufferLength === SHAKE128_RATE) {
        this.absorbBlock();
        this.bufferLength = 0;
      }
    }
  };
  
  Shake128Hasher.prototype.absorbBlock = function() {
    // XOR buffer into state (little-endian)
    for (let i = 0; i < SHAKE128_RATE; i += 8) {
      const word = [
        OpCodes.Pack32LE(this.buffer[i], this.buffer[i + 1], this.buffer[i + 2], this.buffer[i + 3]),
        OpCodes.Pack32LE(this.buffer[i + 4], this.buffer[i + 5], this.buffer[i + 6], this.buffer[i + 7])
      ];
      const stateIndex = Math.floor(i / 8);
      this.state[stateIndex] = xor64(this.state[stateIndex], word);
    }
    
    keccakF(this.state);
  };
  
  Shake128Hasher.prototype.finalize = function() {
    if (this.squeezing) {
      return;
    }
    
    // Pad with 0x1F (SHAKE padding)
    this.buffer[this.bufferLength] = 0x1F;
    
    // Fill rest with zeros except last byte
    for (let i = this.bufferLength + 1; i < SHAKE128_RATE - 1; i++) {
      this.buffer[i] = 0;
    }
    
    // Set last bit of last byte
    this.buffer[SHAKE128_RATE - 1] = 0x80;
    
    // Absorb final block
    this.absorbBlock();
    
    this.squeezing = true;
  };
  
  Shake128Hasher.prototype.squeeze = function(outputLength) {
    if (!this.squeezing) {
      this.finalize();
    }
    
    const output = new Uint8Array(outputLength);
    let outputOffset = 0;
    
    while (outputOffset < outputLength) {
      // Generate rate bytes from current state
      const available = Math.min(SHAKE128_RATE, outputLength - outputOffset);
      
      for (let i = 0; i < available; i += 8) {
        const stateIndex = Math.floor(i / 8);
        const word = this.state[stateIndex];
        
        const bytes1 = OpCodes.Unpack32LE(word[0]);
        const bytes2 = OpCodes.Unpack32LE(word[1]);
        
        for (let j = 0; j < 4 && outputOffset < outputLength; j++) {
          output[outputOffset++] = bytes1[j];
        }
        for (let j = 0; j < 4 && outputOffset < outputLength; j++) {
          output[outputOffset++] = bytes2[j];
        }
      }
      
      // If we need more output, apply Keccak-f again
      if (outputOffset < outputLength) {
        keccakF(this.state);
      }
    }
    
    return output;
  };
  
  // SHAKE128 Universal Cipher Interface
  const Shake128 = {
    internalName: 'shake128',
    name: 'SHAKE128',
    // Required Cipher interface properties
    minKeyLength: 0,        // Minimum key length in bytes
    maxKeyLength: 64,        // Maximum key length in bytes
    stepKeyLength: 1,       // Key length step size
    minBlockSize: 0,        // Minimum block size in bytes
    maxBlockSize: 0,        // Maximum block size (0 = unlimited)
    stepBlockSize: 1,       // Block size step
    instances: {},          // Instance tracking
    
    // XOF interface
    Init: function() {
      this.hasher = new Shake128Hasher();
      this.bKey = false;
    },
    
    KeySetup: function(key) {
      // SHAKE128 doesn't use keys in standard mode
      this.hasher = new Shake128Hasher();
      this.bKey = false;
    },
    
    encryptBlock: function(blockIndex, data) {
      if (typeof data === 'string') {
        this.hasher.absorb(data);
        // Default output length of 32 bytes for compatibility
        return OpCodes.BytesToHex(this.hasher.squeeze(32));
      }
      return '';
    },
    
    decryptBlock: function(blockIndex, data) {
      // XOF functions don't decrypt
      return this.encryptBlock(blockIndex, data);
    },
    
    // Direct XOF interface
    hash: function(data, outputLength) {
      outputLength = outputLength || 32; // Default to 32 bytes
      const hasher = new Shake128Hasher();
      hasher.absorb(data);
      return hasher.squeeze(outputLength);
    },
    
    ClearData: function() {
      if (this.hasher) {
        for (let i = 0; i < this.hasher.state.length; i++) {
          this.hasher.state[i] = [0, 0];
        }
        this.hasher.buffer.fill(0);
      }
      this.bKey = false;
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(Shake128);
  }
  
  // AlgorithmFramework compatibility layer
  if (global.AlgorithmFramework) {
    const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType,
            CryptoAlgorithm, IAlgorithmInstance, TestCase } = global.AlgorithmFramework;
    
    class Shake128Wrapper extends CryptoAlgorithm {
      constructor() {
        super();
        this.name = Shake128.name;
        this.category = CategoryType.HASH;
        this.securityStatus = SecurityStatus.ACTIVE;
        this.complexity = ComplexityType.MEDIUM;
        this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
        this.year = 2015;
        this.country = "BE";
        this.description = "SHAKE128 extensible-output function based on Keccak";
        
        if (Shake128.tests) {
          this.tests = Shake128.tests.map(test => 
            new TestCase(test.input, test.expected, test.text, test.uri)
          );
        }
      }
      
      CreateInstance(isInverse = false) {
        return new Shake128WrapperInstance(this, isInverse);
      }
    }
    
    class Shake128WrapperInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse) {
        super(algorithm, isInverse);
        this.instance = Object.create(Shake128);
        this.instance.Init();
      }
      
      ProcessData(input) {
        return this.instance.hash(input, 32);
      }
      
      Reset() {
        this.instance.ClearData();
        this.instance.Init();
      }
    }
    
    RegisterAlgorithm(new Shake128Wrapper());
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Shake128;
  }
  
  // Make available globally
  global.Shake128 = Shake128;
  
})(typeof global !== 'undefined' ? global : window);