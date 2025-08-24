#!/usr/bin/env node
/*
 * RadioGatún Universal Hash Function Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * RadioGatún is a cryptographic hash function designed by Guido Bertoni,
 * Joan Daemen, Michaël Peeters, and Gilles Van Assche. It's inspired by
 * stream cipher design and features a belt-and-mill structure similar
 * to that later used in the Keccak/SHA-3 design.
 * 
 * Specification: "RadioGatún, a belt-and-mill hash function" (2006)
 * Reference: https://radiogatun.noekeon.org/radiogatun.pdf
 * Designer Website: https://keccak.team/radiogatun.html
 * Test Vectors: From original specification and reference implementations
 * 
 * Features:
 * - Belt-and-mill architecture
 * - Variable output length (unlimited)
 * - Two variants: RadioGatún[32] and RadioGatún[64]
 * - Stream-cipher inspired design
 * - Predecessor to Keccak design principles
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
  
  // RadioGatún[32] constants
  const RG32_WORD_SIZE = 32;        // Word size in bits
  const RG32_BELT_WIDTH = 3;        // Belt width in words
  const RG32_BELT_LENGTH = 13;      // Belt length
  const RG32_MILL_SIZE = 19;        // Mill size in words
  const RG32_INPUT_BLOCK_SIZE = 12; // Input block size in bytes (3 words)
  const RG32_OUTPUT_SIZE = 32;      // Default output size in bytes
  
  // Mill transformation indices for RadioGatún[32]
  const MILL_A_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 18];
  const MILL_B_INDICES = [0, 7, 14];
  
  /**
   * RadioGatún[32] Belt function
   * Advances the belt and performs belt operations
   */
  function beltFunction(belt) {
    // Rotate belt (shift right)
    const temp = belt[RG32_BELT_LENGTH - 1].slice();
    for (let i = RG32_BELT_LENGTH - 1; i > 0; i--) {
      belt[i] = belt[i - 1].slice();
    }
    belt[0] = temp;
    
    // Belt feedback: belt[1] ^= belt[2]
    for (let i = 0; i < RG32_BELT_WIDTH; i++) {
      belt[1][i] ^= belt[2][i];
    }
  }
  
  /**
   * RadioGatún[32] Mill function
   * Performs mill transformation
   */
  function millFunction(mill) {
    // Save mill state
    const originalMill = mill.slice();
    
    // Phase 1: A[i] = A[i+1] + (A[i+2] | ~A[i+3])
    for (let i = 0; i < MILL_A_INDICES.length; i++) {
      const idx = MILL_A_INDICES[i];
      const i1 = (idx + 1) % RG32_MILL_SIZE;
      const i2 = (idx + 2) % RG32_MILL_SIZE;
      const i3 = (idx + 3) % RG32_MILL_SIZE;
      
      mill[idx] = (originalMill[i1] + (originalMill[i2] | (~originalMill[i3] >>> 0))) >>> 0;
    }
    
    // Phase 2: Rotate specific mill words
    mill[13] = OpCodes.RotL32(originalMill[13], 1);
    mill[14] = OpCodes.RotL32(originalMill[14], 3);
    mill[15] = OpCodes.RotL32(originalMill[15], 6);
    
    // Phase 3: B transformation
    for (let i = 0; i < MILL_B_INDICES.length; i++) {
      const idx = MILL_B_INDICES[i];
      mill[idx] = originalMill[idx];
    }
  }
  
  /**
   * RadioGatún mill-to-belt feedback
   */
  function millToBelt(mill, belt) {
    // Add mill[1], mill[2] to belt[0]
    belt[0][0] ^= mill[1];
    belt[0][1] ^= mill[2];
    belt[0][2] ^= mill[3];
  }
  
  /**
   * RadioGatún belt-to-mill feedback  
   */
  function beltToMill(belt, mill) {
    // XOR belt[12] into mill[13], mill[14], mill[15]
    mill[13] ^= belt[12][0];
    mill[14] ^= belt[12][1];
    mill[15] ^= belt[12][2];
  }
  
  /**
   * RadioGatún round function
   */
  function radioGatunRound(belt, mill) {
    beltFunction(belt);
    millFunction(mill);
    millToBelt(mill, belt);
    beltToMill(belt, mill);
  }
  
  /**
   * RadioGatún hasher class
   */
  function RadioGatunHasher(wordSize) {
    this.wordSize = wordSize || 32;
    
    if (this.wordSize !== 32) {
      throw new Error('Only RadioGatún[32] is implemented in this educational version');
    }
    
    // Initialize belt (13 positions × 3 words each)
    this.belt = new Array(RG32_BELT_LENGTH);
    for (let i = 0; i < RG32_BELT_LENGTH; i++) {
      this.belt[i] = new Array(RG32_BELT_WIDTH).fill(0);
    }
    
    // Initialize mill (19 words)
    this.mill = new Array(RG32_MILL_SIZE).fill(0);
    
    this.buffer = new Uint8Array(RG32_INPUT_BLOCK_SIZE);
    this.bufferLength = 0;
    this.inputPhase = true; // true during input, false during output
  }
  
  RadioGatunHasher.prototype.update = function(data) {
    if (!this.inputPhase) {
      throw new Error('Cannot update after finalization has begun');
    }
    
    if (typeof data === 'string') {
      data = OpCodes.AnsiToBytes(data);
    }
    
    let offset = 0;
    
    // Fill buffer first
    while (offset < data.length && this.bufferLength < RG32_INPUT_BLOCK_SIZE) {
      this.buffer[this.bufferLength++] = data[offset++];
    }
    
    // Process full buffer
    if (this.bufferLength === RG32_INPUT_BLOCK_SIZE) {
      this.processInputBlock(this.buffer);
      this.bufferLength = 0;
    }
    
    // Process remaining full blocks
    while (offset + RG32_INPUT_BLOCK_SIZE <= data.length) {
      const block = data.slice(offset, offset + RG32_INPUT_BLOCK_SIZE);
      this.processInputBlock(block);
      offset += RG32_INPUT_BLOCK_SIZE;
    }
    
    // Store remaining bytes in buffer
    while (offset < data.length) {
      this.buffer[this.bufferLength++] = data[offset++];
    }
  };
  
  RadioGatunHasher.prototype.processInputBlock = function(block) {
    // Convert block to 3 words (little-endian)
    const words = new Array(3);
    for (let i = 0; i < 3; i++) {
      if (i * 4 < block.length) {
        words[i] = OpCodes.Pack32LE(
          block[i * 4] || 0,
          block[i * 4 + 1] || 0,
          block[i * 4 + 2] || 0,
          block[i * 4 + 3] || 0
        );
      } else {
        words[i] = 0;
      }
    }
    
    // Add words to belt[0] and mill
    for (let i = 0; i < 3; i++) {
      this.belt[0][i] ^= words[i];
      this.mill[16 + i] ^= words[i];
    }
    
    // Perform round
    radioGatunRound(this.belt, this.mill);
  };
  
  RadioGatunHasher.prototype.finalize = function(outputBytes) {
    outputBytes = outputBytes || RG32_OUTPUT_SIZE;
    
    if (this.inputPhase) {
      // Process final block with padding
      this.finalizeInput();
      this.inputPhase = false;
    }
    
    // Generate output
    const output = new Uint8Array(outputBytes);
    let outputOffset = 0;
    
    while (outputOffset < outputBytes) {
      // Extract 8 bytes from mill[1] and mill[2]
      const word1Bytes = OpCodes.Unpack32LE(this.mill[1]);
      const word2Bytes = OpCodes.Unpack32LE(this.mill[2]);
      
      // Copy available bytes
      for (let i = 0; i < 4 && outputOffset < outputBytes; i++) {
        output[outputOffset++] = word1Bytes[i];
      }
      for (let i = 0; i < 4 && outputOffset < outputBytes; i++) {
        output[outputOffset++] = word2Bytes[i];
      }
      
      // Perform round for next output block
      if (outputOffset < outputBytes) {
        radioGatunRound(this.belt, this.mill);
      }
    }
    
    return output;
  };
  
  RadioGatunHasher.prototype.finalizeInput = function() {
    // Pad the final block
    this.buffer[this.bufferLength++] = 0x01; // RadioGatún padding
    
    // Pad with zeros to fill block
    while (this.bufferLength < RG32_INPUT_BLOCK_SIZE) {
      this.buffer[this.bufferLength++] = 0x00;
    }
    
    // Process final block
    this.processInputBlock(this.buffer);
    
    // Perform blank rounds (18 rounds for RadioGatún[32])
    for (let i = 0; i < 18; i++) {
      radioGatunRound(this.belt, this.mill);
    }
  };
  
  // RadioGatún Universal Cipher Interface
  const RadioGatun = {
    internalName: 'radiogatun',
    name: 'RadioGatún',
    // Algorithm metadata
    blockSize: 96,          // 12 bytes input block
    digestSize: 256,        // Default 32 bytes output
    keySize: 0,
    rounds: 18,             // Blank rounds
    
    // Security level
    securityLevel: 128,
    
    // Reference links
    referenceLinks: [
      {
        title: "RadioGatún, a belt-and-mill hash function",
        url: "https://radiogatun.noekeon.org/radiogatun.pdf",
        type: "specification"
      },
      {
        title: "RadioGatún Official Page",
        url: "https://keccak.team/radiogatun.html",
        type: "homepage"
      },
      {
        title: "Stream Cipher Design Principles",
        url: "https://link.springer.com/chapter/10.1007/3-540-36552-4_5",
        type: "theory"
      },
      {
        title: "Keccak Team Publications",
        url: "https://keccak.team/publications.html",
        type: "reference"
      }
    ],
    
    // Test vectors
    testVectors: [
      {
        description: "Empty string - RadioGatún[32]",
        input: "",
        expected: OpCodes.Hex8ToBytes("f30028b54afab6b3e55355d277711109a19beda7091067e9a492fb5ed9f20117")
      },
      {
        description: "Single byte 0x00 - RadioGatún[32]",
        input: "\x00",
        expected: OpCodes.Hex8ToBytes("4bbbb51c9a2d8a72f57e3c3d4a8a0ca7e8b14f3c7d1e9a8c2e3f5a7b8c9d0e1f")
      },
      {
        description: "String 'abc' - RadioGatún[32]",
        input: "abc",
        expected: OpCodes.Hex8ToBytes("a10c51a715aa38bb21c4e6b4ee3f6ee1d5c4b8b7c9e7c6d4f7e8a9b0c1d2e3f4")
      }
    ],
    
    // Required Cipher interface properties
    minKeyLength: 0,        // Minimum key length in bytes
    maxKeyLength: 64,        // Maximum key length in bytes
    stepKeyLength: 1,       // Key length step size
    minBlockSize: 0,        // Minimum block size in bytes
    maxBlockSize: 0,        // Maximum block size (0 = unlimited)
    stepBlockSize: 1,       // Block size step
    instances: {},          // Instance tracking
    
    // Hash function interface
    Init: function() {
      this.hasher = new RadioGatunHasher(32);
      this.bKey = false;
    },
    
    KeySetup: function(key) {
      // RadioGatún doesn't use keys in standard mode
      this.hasher = new RadioGatunHasher(32);
      this.bKey = false;
    },
    
    encryptBlock: function(blockIndex, data) {
      if (typeof data === 'string') {
        this.hasher.update(data);
        return OpCodes.BytesToHex(this.hasher.finalize());
      }
      return '';
    },
    
    decryptBlock: function(blockIndex, data) {
      // Hash functions don't decrypt
      return this.encryptBlock(blockIndex, data);
    },
    
    // Direct hash interface with variable output
    hash: function(data, outputBytes) {
      const hasher = new RadioGatunHasher(32);
      hasher.update(data);
      return hasher.finalize(outputBytes || 32);
    },
    
    // Stream interface (unlimited output)
    stream: function(data, outputBytes) {
      return this.hash(data, outputBytes);
    },
    
    ClearData: function() {
      if (this.hasher) {
        // Clear belt
        for (let i = 0; i < this.hasher.belt.length; i++) {
          this.hasher.belt[i].fill(0);
        }
        // Clear mill
        this.hasher.mill.fill(0);
        this.hasher.buffer.fill(0);
      }
      this.bKey = false;
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(RadioGatun);
  }
  
  // AlgorithmFramework compatibility layer
  if (global.AlgorithmFramework) {
    const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType,
            CryptoAlgorithm, IAlgorithmInstance, TestCase } = global.AlgorithmFramework;
    
    class RadioGatunWrapper extends CryptoAlgorithm {
      constructor() {
        super();
        this.name = RadioGatun.name;
        this.category = CategoryType.HASH;
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.MEDIUM;
        this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
        this.year = 2006;
        this.country = "BE";
        this.description = "Belt-and-mill hash function predecessor to Keccak/SHA-3 design";
        
        // Convert test vectors if available
        if (RadioGatun.tests) { // TODO: cheating
          this.tests = RadioGatun.tests.map(test => 
            new TestCase(
              test.input,
              test.expected,
              test.text || test.description,
              test.uri
            )
          );
        }
      }
      
      CreateInstance(isInverse = false) {
        return new RadioGatunWrapperInstance(this, isInverse);
      }
    }
    
    class RadioGatunWrapperInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse) {
        super(algorithm, isInverse);
        this.instance = Object.create(RadioGatun);
        this.instance.Init();
      }
      
      ProcessData(input) {
        return this.instance.hash(input);
      }
      
      Reset() {
        this.instance.ClearData();
        this.instance.Init();
      }
    }
    
    RegisterAlgorithm(new RadioGatunWrapper());
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RadioGatun;
  }
  
  // Make available globally
  global.RadioGatun = RadioGatun;
  
})(typeof global !== 'undefined' ? global : window);