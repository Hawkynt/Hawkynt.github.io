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
  
  const A51 = {
    name: 'A5/1',
    description: 'GSM stream cipher using three irregularly clocked LFSRs with majority voting. Educational implementation demonstrating telecommunications security algorithms from cellular networks.',
    category: 'cipher',
    subCategory: 'Stream Cipher',
    securityStatus: 'insecure',
    
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
        text: 'A5/1 Test Vector - Zero key',
        uri: 'https://cryptome.org/a51-bsw.htm',
        input: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
        key: OpCodes.Hex8ToBytes('0000000000000000'),
        expected: OpCodes.Hex8ToBytes('7ab2a406fb2f6728bb0a1b43b9fc01d7')
      },
      {
        text: 'A5/1 Test Vector - Pattern key',
        uri: 'Generated from GSM specification',
        input: OpCodes.Hex8ToBytes('0102030405060708090a0b0c0d0e0f10'),
        key: OpCodes.Hex8ToBytes('0123456789abcdef'),
        expected: OpCodes.Hex8ToBytes('95f89afb212d6e47c0e5fd37b03ca2f8')
      }
    ],
    
    CreateInstance: function() {
      return {
        _lfsr1: 0,
        _lfsr2: 0,
        _lfsr3: 0,
        _keyBytes: [],
        _inputData: [],
        _initialized: false,
        
        set key(keyData) {
          this._keyBytes = [];
          
          if (typeof keyData === 'string') {
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
          this._lfsr1 = 0;
          this._lfsr2 = 0;
          this._lfsr3 = 0;
          
          // Mix in 64-bit secret key
          for (let byteIdx = 0; byteIdx < 8; byteIdx++) {
            const keyByte = this._keyBytes[byteIdx];
            for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
              const keyBit = OpCodes.GetBit(keyByte, bitIdx);
              
              this._lfsr1 ^= keyBit;
              this._lfsr2 ^= keyBit;
              this._lfsr3 ^= keyBit;
              
              this._clockAllRegisters();
            }
          }
          
          // Mix in frame number (default 0)
          const frameNumber = 0;
          for (let bitIdx = 0; bitIdx < 22; bitIdx++) {
            const frameBit = OpCodes.GetBit(frameNumber, bitIdx);
            
            this._lfsr1 ^= frameBit;
            this._lfsr2 ^= frameBit;
            this._lfsr3 ^= frameBit;
            
            this._clockAllRegisters();
          }
          
          // Clock registers 100 times
          for (let i = 0; i < 100; i++) {
            this._clockRegisters();
          }
          
          this._initialized = true;
        },
        
        _clockAllRegisters: function() {
          this._clockRegister1();
          this._clockRegister2();
          this._clockRegister3();
        },
        
        _clockRegisters: function() {
          const c1 = OpCodes.GetBit(this._lfsr1, 8);
          const c2 = OpCodes.GetBit(this._lfsr2, 10);
          const c3 = OpCodes.GetBit(this._lfsr3, 10);
          
          const majority = (c1 + c2 + c3) >= 2 ? 1 : 0;
          
          if (c1 === majority) this._clockRegister1();
          if (c2 === majority) this._clockRegister2();
          if (c3 === majority) this._clockRegister3();
        },
        
        _clockRegister1: function() {
          const feedback = OpCodes.GetBit(this._lfsr1, 13) ^
                          OpCodes.GetBit(this._lfsr1, 16) ^
                          OpCodes.GetBit(this._lfsr1, 17) ^
                          OpCodes.GetBit(this._lfsr1, 18);
          
          this._lfsr1 = ((this._lfsr1 << 1) | feedback) & OpCodes.BitMask(19);
        },
        
        _clockRegister2: function() {
          const feedback = OpCodes.GetBit(this._lfsr2, 20) ^
                          OpCodes.GetBit(this._lfsr2, 21);
          
          this._lfsr2 = ((this._lfsr2 << 1) | feedback) & OpCodes.BitMask(22);
        },
        
        _clockRegister3: function() {
          const feedback = OpCodes.GetBit(this._lfsr3, 7) ^
                          OpCodes.GetBit(this._lfsr3, 20) ^
                          OpCodes.GetBit(this._lfsr3, 21) ^
                          OpCodes.GetBit(this._lfsr3, 22);
          
          this._lfsr3 = ((this._lfsr3 << 1) | feedback) & OpCodes.BitMask(23);
        },
        
        _generateKeystreamBit: function() {
          this._clockRegisters();
          
          const out1 = OpCodes.GetBit(this._lfsr1, 18);
          const out2 = OpCodes.GetBit(this._lfsr2, 21);
          const out3 = OpCodes.GetBit(this._lfsr3, 22);
          
          return out1 ^ out2 ^ out3;
        },
        
        _generateKeystreamByte: function() {
          let byte = 0;
          for (let i = 0; i < 8; i++) {
            byte = (byte << 1) | this._generateKeystreamBit();
          }
          return byte;
        }
      };
    }
  };
  
  // Auto-registration
  if (global.Cipher) global.Cipher.Add(A51);
  if (typeof module !== 'undefined') module.exports = A51;
  
})(typeof global !== 'undefined' ? global : window);