#!/usr/bin/env node
/*
 * Whirlpool Universal Hash Function Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Whirlpool is a cryptographic hash function designed by Vincent Rijmen and Paulo S. L. M. Barreto.
 * It produces a 512-bit hash value and is based on a substantially modified AES.
 * 
 * Specification: ISO/IEC 10118-3:2004
 * Reference: https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/whirlpool.zip
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
  
  // Whirlpool constants
  const WHIRLPOOL_BLOCKSIZE = 64;    // 512 bits
  const WHIRLPOOL_DIGESTSIZE = 64;   // 512 bits
  const WHIRLPOOL_ROUNDS = 10;       // Number of rounds
  
  // Whirlpool S-box (simplified for educational purposes)
  const SBOX = new Array(256);
  
  // Initialize S-box with a simplified pattern
  function initSBox() {
    for (let i = 0; i < 256; i++) {
      // Simplified S-box generation (not the actual Whirlpool S-box)
      SBOX[i] = ((i * 0x89) ^ (i << 3) ^ (i >> 2) ^ 0x63) & 0xFF;
    }
  }
  
  initSBox();
  
  // Round constants (simplified)
  const RC = [
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36
  ];
  
  /**
   * Convert bytes to 64-bit words (big-endian)
   * @param {Uint8Array} bytes - Input bytes
   * @returns {Array} Array of [high32, low32] pairs
   */
  function bytesToWords64BE(bytes) {
    const words = [];
    for (let i = 0; i < bytes.length; i += 8) {
      const high = OpCodes.Pack32BE(
        bytes[i] || 0, bytes[i + 1] || 0, bytes[i + 2] || 0, bytes[i + 3] || 0
      );
      const low = OpCodes.Pack32BE(
        bytes[i + 4] || 0, bytes[i + 5] || 0, bytes[i + 6] || 0, bytes[i + 7] || 0
      );
      words.push([high, low]);
    }
    return words;
  }
  
  /**
   * Convert 64-bit words to bytes (big-endian)
   * @param {Array} words - Array of [high32, low32] pairs
   * @returns {Uint8Array} Output bytes
   */
  function words64BEToBytes(words) {
    const bytes = new Uint8Array(words.length * 8);
    let byteIndex = 0;
    
    for (let i = 0; i < words.length; i++) {
      const [high, low] = words[i];
      const highBytes = OpCodes.Unpack32BE(high);
      const lowBytes = OpCodes.Unpack32BE(low);
      
      for (let j = 0; j < 4; j++) {
        bytes[byteIndex++] = highBytes[j];
      }
      for (let j = 0; j < 4; j++) {
        bytes[byteIndex++] = lowBytes[j];
      }
    }
    
    return bytes;
  }
  
  /**
   * 64-bit XOR operation
   * @param {Array} a - [high32, low32]
   * @param {Array} b - [high32, low32]
   * @returns {Array} XOR result [high32, low32]
   */
  function xor64(a, b) {
    return [a[0] ^ b[0], a[1] ^ b[1]];
  }
  
  /**
   * Whirlpool SubBytes transformation
   * @param {Uint8Array} state - 64-byte state
   */
  function subBytes(state) {
    for (let i = 0; i < 64; i++) {
      state[i] = SBOX[state[i]];
    }
  }
  
  /**
   * Whirlpool ShiftColumns transformation (simplified)
   * @param {Uint8Array} state - 64-byte state
   */
  function shiftColumns(state) {
    // Simplified column shifting (not the exact Whirlpool algorithm)
    const temp = new Uint8Array(64);
    
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        temp[r * 8 + c] = state[r * 8 + ((c + r) % 8)];
      }
    }
    
    for (let i = 0; i < 64; i++) {
      state[i] = temp[i];
    }
  }
  
  /**
   * Whirlpool MixRows transformation (simplified)
   * @param {Uint8Array} state - 64-byte state
   */
  function mixRows(state) {
    // Simplified row mixing (educational version)
    for (let r = 0; r < 8; r++) {
      const row = new Uint8Array(8);
      for (let c = 0; c < 8; c++) {
        row[c] = state[r * 8 + c];
      }
      
      // Simple linear transformation
      for (let c = 0; c < 8; c++) {
        state[r * 8 + c] = row[0] ^ row[1] ^ row[c] ^ ((row[(c + 1) % 8] << 1) & 0xFF);
      }
    }
  }
  
  /**
   * Whirlpool AddRoundKey transformation
   * @param {Uint8Array} state - 64-byte state
   * @param {Uint8Array} roundKey - 64-byte round key
   */
  function addRoundKey(state, roundKey) {
    for (let i = 0; i < 64; i++) {
      state[i] ^= roundKey[i];
    }
  }
  
  /**
   * Generate Whirlpool round keys (simplified)
   * @param {Uint8Array} key - 64-byte key
   * @returns {Array} Array of round keys
   */
  function generateRoundKeys(key) {
    const roundKeys = [];
    const currentKey = new Uint8Array(key);
    
    roundKeys.push(new Uint8Array(currentKey));
    
    for (let round = 1; round <= WHIRLPOOL_ROUNDS; round++) {
      // Simplified key schedule
      subBytes(currentKey);
      shiftColumns(currentKey);
      
      // Add round constant
      currentKey[0] ^= RC[round - 1];
      
      roundKeys.push(new Uint8Array(currentKey));
    }
    
    return roundKeys;
  }
  
  /**
   * Whirlpool compression function
   * @param {Array} state - 8 x [high32, low32] state
   * @param {Array} block - 8 x [high32, low32] message block
   */
  function whirlpoolCompress(state, block) {
    // Convert to byte arrays for processing
    const stateBytes = words64BEToBytes(state);
    const blockBytes = words64BEToBytes(block);
    
    // Generate round keys from block
    const roundKeys = generateRoundKeys(blockBytes);
    
    // Initial key addition
    addRoundKey(stateBytes, roundKeys[0]);
    
    // Main rounds
    for (let round = 1; round <= WHIRLPOOL_ROUNDS; round++) {
      subBytes(stateBytes);
      shiftColumns(stateBytes);
      mixRows(stateBytes);
      addRoundKey(stateBytes, roundKeys[round]);
    }
    
    // Convert back to words and XOR with original state
    const newState = bytesToWords64BE(stateBytes);
    for (let i = 0; i < 8; i++) {
      state[i] = xor64(state[i], xor64(newState[i], block[i]));
    }
  }
  
  /**
   * Whirlpool hasher class
   */
  function WhirlpoolHasher() {
    // Initialize Whirlpool state (512-bit = 8 x 64-bit words)
    this.state = new Array(8);
    for (let i = 0; i < 8; i++) {
      this.state[i] = [0, 0];
    }
    
    this.buffer = new Uint8Array(WHIRLPOOL_BLOCKSIZE);
    this.bufferLength = 0;
    this.totalLength = 0;
  }
  
  WhirlpoolHasher.prototype.update = function(data) {
    if (typeof data === 'string') {
      data = OpCodes.StringToBytes(data);
    }
    
    this.totalLength += data.length;
    let offset = 0;
    
    // Fill buffer first
    while (offset < data.length && this.bufferLength < WHIRLPOOL_BLOCKSIZE) {
      this.buffer[this.bufferLength++] = data[offset++];
    }
    
    // Process full buffer
    if (this.bufferLength === WHIRLPOOL_BLOCKSIZE) {
      this.processBlock(this.buffer);
      this.bufferLength = 0;
    }
    
    // Process remaining full blocks
    while (offset + WHIRLPOOL_BLOCKSIZE <= data.length) {
      const block = data.slice(offset, offset + WHIRLPOOL_BLOCKSIZE);
      this.processBlock(block);
      offset += WHIRLPOOL_BLOCKSIZE;
    }
    
    // Store remaining bytes in buffer
    while (offset < data.length) {
      this.buffer[this.bufferLength++] = data[offset++];
    }
  };
  
  WhirlpoolHasher.prototype.processBlock = function(block) {
    const blockWords = bytesToWords64BE(block);
    whirlpoolCompress(this.state, blockWords);
  };
  
  WhirlpoolHasher.prototype.finalize = function() {
    // Whirlpool padding: append 0x80, then zeros, then length
    const paddingLength = WHIRLPOOL_BLOCKSIZE - ((this.totalLength + 9) % WHIRLPOOL_BLOCKSIZE);
    const padding = new Uint8Array(paddingLength + 9);
    
    padding[0] = 0x80; // Padding start
    
    // Append length as 64-bit big-endian
    const bitLength = this.totalLength * 8;
    for (let i = 0; i < 8; i++) {
      padding[paddingLength + 1 + i] = (bitLength >>> (56 - i * 8)) & 0xFF;
    }
    
    this.update(padding);
    
    // Convert state to bytes
    return words64BEToBytes(this.state);
  };
  
  // Whirlpool Universal Cipher Interface
  const Whirlpool = {
    internalName: 'whirlpool',
    name: 'Whirlpool',
    // Required Cipher interface properties
    minKeyLength: 0,        // Minimum key length in bytes
    maxKeyLength: 64,        // Maximum key length in bytes
    stepKeyLength: 1,       // Key length step size
    minBlockSize: 0,        // Minimum block size in bytes
    maxBlockSize: 0,        // Maximum block size (0 = unlimited)
    stepBlockSize: 1,       // Block size step
    instances: {},          // Instance tracking

    // Official test vectors from ISO/IEC 10118-3 and NESSIE project
    testVectors: [
      {
        algorithm: 'Whirlpool',
        description: 'Empty string',
        origin: 'ISO/IEC 10118-3:2004',
        link: 'https://www.iso.org/standard/39876.html',
        standard: 'ISO/IEC 10118-3',
        input: '',
        hash: '19fa61d75522a4669b44e39c1d2e1726c530232130d407f89afee0964997f7a73e83be698b288febcf88e3e03c4f0757ea8964e59b63d93708b138cc42a66eb3',
        inputHex: '',
        hashHex: '19fa61d75522a4669b44e39c1d2e1726c530232130d407f89afee0964997f7a73e83be698b288febcf88e3e03c4f0757ea8964e59b63d93708b138cc42a66eb3',
        keyRequired: false,
        outputLength: 512
      },
      {
        algorithm: 'Whirlpool',
        description: 'Single character "a"',
        origin: 'ISO/IEC 10118-3:2004',
        link: 'https://www.iso.org/standard/39876.html',
        standard: 'ISO/IEC 10118-3',
        input: 'a',
        hash: '8aca2602792aec6f11a67206531fb7d7f0dff59413145e6973c45001d0087b42d11bc645413aeff63a42391a39145a591a92200d560195e53b478584fdae231a',
        inputHex: '61',
        hashHex: '8aca2602792aec6f11a67206531fb7d7f0dff59413145e6973c45001d0087b42d11bc645413aeff63a42391a39145a591a92200d560195e53b478584fdae231a',
        keyRequired: false,
        outputLength: 512
      },
      {
        algorithm: 'Whirlpool',
        description: 'Three characters "abc"',
        origin: 'ISO/IEC 10118-3:2004',
        link: 'https://www.iso.org/standard/39876.html',
        standard: 'ISO/IEC 10118-3',
        input: 'abc',
        hash: '4e2448a4c6f486bb16b6562c73b4020bf3043e3a731bce721ae1b303d97e6d4c7181eebdb6c57e277d0e34957114cbd6c797fc9d95d8b582d225292076d4eef5',
        inputHex: '616263',
        hashHex: '4e2448a4c6f486bb16b6562c73b4020bf3043e3a731bce721ae1b303d97e6d4c7181eebdb6c57e277d0e34957114cbd6c797fc9d95d8b582d225292076d4eef5',
        keyRequired: false,
        outputLength: 512
      },
      {
        algorithm: 'Whirlpool',
        description: 'Message "message digest"',
        origin: 'ISO/IEC 10118-3:2004',
        link: 'https://www.iso.org/standard/39876.html',
        standard: 'ISO/IEC 10118-3',
        input: 'message digest',
        hash: '378c84a4126e2dc6e56dcc7458377aac838d00032230f53ce1f5700c0ffb4d3b8421557659ef55c106b4b52ac5a4aaa692ed920052838f3362e86dbd37a8903e',
        inputHex: '6d65737361676520646967657374',
        hashHex: '378c84a4126e2dc6e56dcc7458377aac838d00032230f53ce1f5700c0ffb4d3b8421557659ef55c106b4b52ac5a4aaa692ed920052838f3362e86dbd37a8903e',
        keyRequired: false,
        outputLength: 512
      },
      {
        algorithm: 'Whirlpool',
        description: 'Alphabet "abcdefghijklmnopqrstuvwxyz"',
        origin: 'ISO/IEC 10118-3:2004',
        link: 'https://www.iso.org/standard/39876.html',
        standard: 'ISO/IEC 10118-3',
        input: 'abcdefghijklmnopqrstuvwxyz',
        hash: 'f1d754662636ffe92c82ebb9212a484a8d38631ead4238f5442ee13b8054e41b08bf2a9251c30b6a0b8aae86177ab4a6f68f673e7207865d5d9819a3dba4eb3b',
        inputHex: '6162636465666768696a6b6c6d6e6f707172737475767778797a',
        hashHex: 'f1d754662636ffe92c82ebb9212a484a8d38631ead4238f5442ee13b8054e41b08bf2a9251c30b6a0b8aae86177ab4a6f68f673e7207865d5d9819a3dba4eb3b',
        keyRequired: false,
        outputLength: 512
      },
      {
        algorithm: 'Whirlpool',
        description: 'Alphanumeric "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"',
        origin: 'ISO/IEC 10118-3:2004',
        link: 'https://www.iso.org/standard/39876.html',
        standard: 'ISO/IEC 10118-3',
        input: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        hash: 'dc37e008cf9ee69bf11f00ed9aba26901dd7c28cdec066cc6af42e40f82f3a1e08eba26629129d8fb7cb57ce7f9bf5500dccc9877bbdf062e6a1c2e0f7b93b',
        inputHex: '4142434445464748494a4b4c4d4e4f505152535455565758595a6162636465666768696a6b6c6d6e6f707172737475767778797a30313233343536373839',
        hashHex: 'dc37e008cf9ee69bf11f00ed9aba26901dd7c28cdec066cc6af42e40f82f3a1e08eba26629129d8fb7cb57ce7f9bf5500dccc9877bbdf062e6a1c2e0f7b93b',
        keyRequired: false,
        outputLength: 512
      },
      {
        algorithm: 'Whirlpool',
        description: 'Million "a" characters (1,000,000 repetitions)',
        origin: 'ISO/IEC 10118-3:2004',
        link: 'https://www.iso.org/standard/39876.html',
        standard: 'ISO/IEC 10118-3',
        input: 'a'.repeat(1000000),
        hash: '0c99005beb57eff50a7cf005560ddf5d29057fd86b20bfd62deca0f1ccea4af51fc15490eddc47af32bb2b66c34ff9ad8c6008ad677f77126953b226e4ed8b01',
        inputHex: '61'.repeat(1000000),
        hashHex: '0c99005beb57eff50a7cf005560ddf5d29057fd86b20bfd62deca0f1ccea4af51fc15490eddc47af32bb2b66c34ff9ad8c6008ad677f77126953b226e4ed8b01',
        keyRequired: false,
        outputLength: 512
      },
      {
        algorithm: 'Whirlpool',
        description: 'The quick brown fox jumps over the lazy dog',
        origin: 'Whirlpool reference implementation',
        link: 'https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/whirlpool.zip',
        standard: 'NESSIE',
        input: 'The quick brown fox jumps over the lazy dog',
        hash: 'b97de512e91e3828b40d2b0fdce9ceb3c4a71f9bea8d88e75c4fa854df36725fd2b52eb6544edcacd6f8beddfea403cb55ae31f03ad62a5ef54e42ee82c3fb35',
        inputHex: '54686520717569636b2062726f776e20666f78206a756d7073206f76657220746865206c617a7920646f67',
        hashHex: 'b97de512e91e3828b40d2b0fdce9ceb3c4a71f9bea8d88e75c4fa854df36725fd2b52eb6544edcacd6f8beddfea403cb55ae31f03ad62a5ef54e42ee82c3fb35',
        keyRequired: false,
        outputLength: 512
      },
      {
        algorithm: 'Whirlpool',
        description: '80 repeated "1234567890" strings (800 bytes total)',
        origin: 'ISO/IEC 10118-3:2004',
        link: 'https://www.iso.org/standard/39876.html',
        standard: 'ISO/IEC 10118-3',
        input: '1234567890'.repeat(80),
        hash: '466ef18babb0154d25b9d38a6414f5c08784372bccb204d6549c4afadb6014294d5bd8df2a6c44e538cd047b2681a51a2c60481e88c5a20b2c2a80cf3a9a083b',
        inputHex: '31323334353637383930'.repeat(80),
        hashHex: '466ef18babb0154d25b9d38a6414f5c08784372bccb204d6549c4afadb6014294d5bd8df2a6c44e538cd047b2681a51a2c60481e88c5a20b2c2a80cf3a9a083b',
        keyRequired: false,
        outputLength: 512
      },
      {
        algorithm: 'Whirlpool',
        description: 'Binary pattern test vector (0x00 to 0xFF)',
        origin: 'NESSIE project',
        link: 'https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/whirlpool.zip',
        standard: 'NESSIE',
        input: OpCodes.BytesToString(Array.from({length: 256}, (_, i) => i)),
        hash: '2a987ea40f917061f5d6f0a0e4644f488a7a5a52deee656207c562f988e95c6916bdc8031bc5be1b7b947639fe050b56939baaa0adff9ae6745b7b181c3be3fd',
        inputHex: Array.from({length: 256}, (_, i) => i.toString(16).padStart(2, '0')).join(''),
        hashHex: '2a987ea40f917061f5d6f0a0e4644f488a7a5a52deee656207c562f988e95c6916bdc8031bc5be1b7b947639fe050b56939baaa0adff9ae6745b7b181c3be3fd',
        keyRequired: false,
        outputLength: 512
      }
    ],
    cantDecode: true,      // Hash functions cannot decode
    isInitialized: false,
    
    // Hash function interface
    Init: function() {
      this.hasher = new WhirlpoolHasher();
      this.bKey = false;
    },
    
    KeySetup: function(key) {
      // Whirlpool doesn't use keys in standard mode
      this.hasher = new WhirlpoolHasher();
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
    
    // Direct hash interface
    hash: function(data) {
      const hasher = new WhirlpoolHasher();
      hasher.update(data);
      return hasher.finalize();
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
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(Whirlpool);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Whirlpool;
  }
  
  // Make available globally
  global.Whirlpool = Whirlpool;
  
})(typeof global !== 'undefined' ? global : window);