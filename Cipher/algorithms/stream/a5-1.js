/*
 * Universal A5/1 Stream Cipher
 * Compatible with both Browser and Node.js environments
 * Based on GSM A5/1 specification (ETSI/3GPP)
 * (c)2006-2025 Hawkynt
 * 
 * A5/1 is a stream cipher used in GSM cellular networks for over-the-air
 * communication privacy. It uses three irregularly clocked LFSRs.
 * 
 * WARNING: A5/1 has known cryptographic vulnerabilities and should not be used
 * in production systems. This implementation is for educational purposes only.
 */

(function(global) {
  'use strict';
  
  // Environment detection and dependency loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    try {
      global.AlgorithmFramework = require('../../AlgorithmFramework.js');
    } catch (e) {
      // AlgorithmFramework not available, use string fallback
    }
  }
  
  const A51 = {
    name: 'A5/1',
    description: 'GSM stream cipher using three irregularly clocked LFSRs with majority voting. Educational implementation demonstrating telecommunications security algorithms from cellular networks.',
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: 'Stream Cipher',
    securityStatus: global.AlgorithmFramework ? global.AlgorithmFramework.SecurityStatus.INSECURE : null,
    
    documentation: [
      {text: 'Wikipedia: A5/1', uri: 'https://en.wikipedia.org/wiki/A5/1'},
      {text: 'ETSI TS 155 226 - A5/1 Encryption Algorithm', uri: 'https://www.etsi.org/deliver/etsi_ts/155200_155299/155226/'},
      {text: '3GPP TS 55.216 - A5/1 Algorithm Specification', uri: 'https://www.3gpp.org/DynaReport/55216.htm'}
    ],
    
    references: [
      {text: 'OsmocomBB A5/1 Implementation', uri: 'https://github.com/osmocom/osmocom-bb'},
      {text: 'A5/1 Reference Implementation (Cryptome)', uri: 'https://cryptome.org/a51-bsw.htm'},
      {text: 'Real Time Cryptanalysis of A5/1 (Biryukov-Shamir-Wagner)', uri: 'https://www.cosic.esat.kuleuven.be/publications/article-152.pdf'}
    ],
    
    knownVulnerabilities: [
      {
        type: 'Time-Memory Tradeoff Attack', 
        text: 'Practical real-time key recovery attacks demonstrated by Biryukov-Shamir-Wagner and others',
        mitigation: 'Use modern algorithms like A5/3 (KASUMI) or A5/4 instead'
      },
      {
        type: 'Correlation Attack',
        text: 'Exploits linear properties of LFSRs to recover internal state',
        mitigation: 'Algorithm is fundamentally insecure - avoid all use'
      }
    ],
    
    tests: [
      {
        text: 'A5/1 Test Vector - Key 1',
        uri: 'A5/1 reference implementation with frame=0',
        input: OpCodes.Hex8ToBytes('000000000000000000000000000000'),
        key: OpCodes.Hex8ToBytes('123456789abcdef0'),
        expected: OpCodes.Hex8ToBytes('b7d37880be862cdbf6d401fae7ffa2')
      },
      {
        text: 'A5/1 Test Vector - Key 2',
        uri: 'A5/1 reference implementation with different key',
        input: OpCodes.Hex8ToBytes('0102030405060708090a0b0c0d0e0f'),
        key: OpCodes.Hex8ToBytes('fedcba9876543210'),
        expected: OpCodes.Hex8ToBytes('6a97039a899deca7df5a3f722e7bff')
      }
    ],
    
    CreateInstance: function() {
      return {
        _lfsr1: 0,
        _lfsr2: 0,
        _lfsr3: 0,
        _keyBytes: [],
        _frameNumber: 0,
        _inputData: [],
        _initialized: false,
        
        set key(keyData) {
          this._keyBytes = [];
          this._frameNumber = 0;

          if (typeof keyData === 'object' && keyData.key && keyData.frame !== undefined) {
            // Handle test vector format with frame number
            const key = keyData.key;
            this._frameNumber = keyData.frame;

            if (Array.isArray(key)) {
              for (let k = 0; k < key.length && this._keyBytes.length < 8; k++) {
                this._keyBytes.push(key[k] & 0xFF);
              }
            }
          } else if (typeof keyData === 'string') {
            for (let k = 0; k < keyData.length && this._keyBytes.length < 8; k++) {
              this._keyBytes.push(keyData.charCodeAt(k) & 0xFF);
            }
          } else if (Array.isArray(keyData)) {
            for (let k = 0; k < keyData.length && this._keyBytes.length < 8; k++) {
              this._keyBytes.push(keyData[k] & 0xFF);
            }
          }

          while (this._keyBytes.length < 8) {
            this._keyBytes.push(0);
          }

          this._initialize();
        },
        
        Feed: function(data) {
          this._inputData = [];
          if (Array.isArray(data)) {
            this._inputData = data.slice();
          } else if (typeof data === 'string') {
            for (let i = 0; i < data.length; i++) {
              this._inputData.push(data.charCodeAt(i));
            }
          }
        },
        
        Result: function() {
          if (!this._initialized || this._inputData.length === 0) {
            return this._inputData.slice();
          }

          const result = [];
          for (let i = 0; i < this._inputData.length; i++) {
            const keystreamByte = this._generateKeystreamByte();
            result.push(this._inputData[i] ^ keystreamByte);
          }
          return result;
        },
        
        _initialize: function() {
          // Initialize registers to zero
          this._lfsr1 = 0;
          this._lfsr2 = 0;
          this._lfsr3 = 0;

          // Load 64-bit secret key (following reference C implementation)
          for (let i = 0; i < 64; i++) {
            // FIRST: Clock all registers
            this._clockAllRegisters();

            // THEN: XOR key bit if it's set (standard key loading: key[i>>3] >> (i&7))
            const byteIdx = Math.floor(i / 8);
            const bitIdx = i % 8;
            if (this._keyBytes[byteIdx] & (1 << bitIdx)) {
              this._lfsr1 ^= 1;
              this._lfsr2 ^= 1;
              this._lfsr3 ^= 1;
            }
          }

          // Load 22-bit frame number
          const frameNumber = this._frameNumber || 0;
          for (let i = 0; i < 22; i++) {
            // FIRST: Clock all registers
            this._clockAllRegisters();

            // THEN: XOR frame bit if it's set
            if (frameNumber & (1 << i)) {
              this._lfsr1 ^= 1;
              this._lfsr2 ^= 1;
              this._lfsr3 ^= 1;
            }
          }

          // Mix for 100 cycles using majority clocking (discard output)
          for (let i = 0; i < 100; i++) {
            this._clockRegisters();
          }

          this._initialized = true;
        },

        // Parity function - exact match to C reference implementation
        _parity: function(x) {
          return OpCodes.PopCountFast(x) & 1;
        },

        // Clock one register - exact match to C reference
        _clockone: function(reg, mask, taps) {
          const t = reg & taps;
          reg = (reg << 1) & mask;
          reg |= this._parity(t);
          return reg;
        },
        
        _clockAllRegisters: function() {
          // Constants from C reference
          const R1MASK = 0x07FFFF;  // 19 bits
          const R2MASK = 0x3FFFFF;  // 22 bits
          const R3MASK = 0x7FFFFF;  // 23 bits
          const R1TAPS = 0x072000;  // bits 18,17,16,13
          const R2TAPS = 0x300000;  // bits 21,20
          const R3TAPS = 0x700080;  // bits 22,21,20,7

          this._lfsr1 = this._clockone(this._lfsr1, R1MASK, R1TAPS);
          this._lfsr2 = this._clockone(this._lfsr2, R2MASK, R2TAPS);
          this._lfsr3 = this._clockone(this._lfsr3, R3MASK, R3TAPS);
        },
        
        _clockRegisters: function() {
          // Constants from C reference
          const R1MASK = 0x07FFFF;  // 19 bits
          const R2MASK = 0x3FFFFF;  // 22 bits
          const R3MASK = 0x7FFFFF;  // 23 bits
          const R1TAPS = 0x072000;  // bits 18,17,16,13
          const R2TAPS = 0x300000;  // bits 21,20
          const R3TAPS = 0x700080;  // bits 22,21,20,7
          const R1MID = 0x000100;   // bit 8
          const R2MID = 0x000400;   // bit 10
          const R3MID = 0x000400;   // bit 10

          // Check clocking bits
          const c1 = (this._lfsr1 & R1MID) !== 0 ? 1 : 0;
          const c2 = (this._lfsr2 & R2MID) !== 0 ? 1 : 0;
          const c3 = (this._lfsr3 & R3MID) !== 0 ? 1 : 0;

          // Majority vote
          const maj = (c1 + c2 + c3) >= 2 ? 1 : 0;

          // Clock each register only if its clocking bit matches the majority
          if (c1 === maj) {
            this._lfsr1 = this._clockone(this._lfsr1, R1MASK, R1TAPS);
          }
          if (c2 === maj) {
            this._lfsr2 = this._clockone(this._lfsr2, R2MASK, R2TAPS);
          }
          if (c3 === maj) {
            this._lfsr3 = this._clockone(this._lfsr3, R3MASK, R3TAPS);
          }
        },
        
        
        _generateKeystreamBit: function() {
          // Constants from C reference
          const R1OUT = 0x040000;  // bit 18
          const R2OUT = 0x200000;  // bit 21
          const R3OUT = 0x400000;  // bit 22

          this._clockRegisters();

          // Output bit generation - exact match to C reference getbit()
          return ((this._lfsr1 & R1OUT) ? 1 : 0) ^
                 ((this._lfsr2 & R2OUT) ? 1 : 0) ^
                 ((this._lfsr3 & R3OUT) ? 1 : 0);
        },
        
        _generateKeystreamByte: function() {
          let byte = 0;
          for (let i = 0; i < 8; i++) {
            const bit = this._generateKeystreamBit();
            if (bit) {
              byte = OpCodes.SetBit(byte, 7 - i, 1); // MSB first
            }
          }
          return byte;
        }
      };
    }
  };
  
  // Auto-registration with AlgorithmFramework
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(A51);
  }
  
  // Legacy registration
  if (global.Cipher) global.Cipher.Add(A51);
  if (typeof module !== 'undefined') module.exports = A51;
  
})(typeof global !== 'undefined' ? global : window);