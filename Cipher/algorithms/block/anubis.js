/*
 * Universal Anubis Cipher Implementation  
 * Compatible with both Browser and Node.js environments
 * Based on original anubis.js but modernized for cross-platform use
 * (c)2006-2025 Hawkynt
 * 
 * Anubis is a 128-bit block cipher designed by Vincent Rijmen and Paulo S.L.M. Barreto
 * for the NESSIE project. This implementation uses the "tweaked" S-box version.
 * 
 * Key Features:
 * - 128-bit block size
 * - Variable key length: 128-320 bits (16-40 bytes) in 32-bit increments
 * - Number of rounds: 8 + N (where N = key_length / 4)
 * - Substitution-Permutation Network (SPN) structure
 * 
 * Educational implementation - not for production use
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes) {
    if (typeof require !== 'undefined') {
      try {
        require('../../OpCodes.js');
      } catch (e) {
        console.error('Failed to load OpCodes dependency:', e.message);
        return;
      }
    } else {
      console.error('Anubis cipher requires OpCodes library to be loaded first');
      return;
    }
  }
  
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
      console.error('Anubis cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create Anubis cipher object
  const Anubis = {
    // Public interface properties
    internalName: 'Anubis',
    name: 'Anubis',
    comment: 'NESSIE Anubis Cipher - 128-bit block cipher with variable key length (128-320 bits)',
    minKeyLength: 16,  // 128 bits
    maxKeyLength: 40,  // 320 bits
    stepKeyLength: 4,  // 32-bit increments
    minBlockSize: 16,  // 128 bits
    maxBlockSize: 16,  // 128 bits
    stepBlockSize: 1,
    instances: {},
    cantDecode: false,
    isInitialized: false,
    
    // Anubis S-box - original implementation from Paulo Barreto and Vincent Rijmen
    // This is the S-box as specified in the original anubis.js (not the tweaked version)
    // Each 16-bit value encodes two 8-bit S-box entries
    sbox: "\ua7d3\ue671\ud0ac\u4d79\u3ac9\u91fc\u1e47\u54bd" +
          "\u8ca5\u7afb\u63b8\uddd4\ue5b3\uc5be\ua988\u0ca2" +
          "\u39df\u29da\u2ba8\ucb4c\u4b22\uaa24\u4170\ua6f9" +
          "\u5ae2\ub036\u7de4\u33ff\u6020\u088b\u5eab\u7f78" +
          "\u7c2c\u57d2\udc6d\u7e0d\u5394\uc328\u2706\u5fad" +
          "\u675c\u5548\u0e52\uea42\u5b5d\u3058\u5159\u3c4e" +
          "\u388a\u7214\ue7c6\ude50\u8e92\ud177\u9345\u9ace" +
          "\u2d03\u62b6\ub9bf\u966b\u3f07\u12ae\u4034\u463e" +
          "\udbcf\ueccc\uc1a1\uc0d6\u1df4\u613b\u10d8\u68a0" +
          "\ub10a\u696c\u49fa\u76c4\u9e9b\u6e99\uc2b7\u98bc" +
          "\u8f85\u1fb4\uf811\u2e00\u251c\u2a3d\u054f\u7bb2" +
          "\u3290\uaf19\ua3f7\u739d\u1574\ueeca\u9f0f\u1b75" +
          "\u8684\u9c4a\u971a\u65f6\ued09\ubb26\u83eb\u6f81" +
          "\u046a\u4301\u17e1\u87f5\u8de3\u2380\u4416\u6621" +
          "\ufed5\u31d9\u3518\u0264\uf2f1\u56cd\u82c8\ubaf0" +
          "\uefe9\ue8fd\u89d7\uc7b5\ua42f\u9513\u0bf3\ue037",
    
    // Lookup tables - will be initialized in Init()
    T0: null,
    T1: null,
    T2: null,
    T3: null,
    T4: null,
    T5: null,
    
    // Official test vectors from NESSIE project
    testVectors: [
      { 
        input: '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00', 
        key: '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00', 
        expected: '\x62\x5F\x0F\x66\x3B\xF0\x0F\x2D\x67\xB1\xE8\xB0\x4F\x67\xA4\x84', 
        description: 'Anubis 128-bit key, all zeros test vector (NESSIE)' 
      },
      { 
        input: '\x01\x23\x45\x67\x89\xAB\xCD\xEF\x00\x11\x22\x33\x44\x55\x66\x77', 
        key: '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0C\x0D\x0E\x0F', 
        expected: '\x02\x0A\xA9\x1C\x3A\x43\xB3\x44\x45\x47\x17\x67\x43\xB6\xEE\x2D', 
        description: 'Anubis 128-bit key, test pattern vector (NESSIE)' 
      },
      { 
        input: '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00', 
        key: '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00', 
        expected: '\x76\x1E\x6A\x8D\x98\x16\xF7\x9F\x24\xEE\x40\x01\x0F\x72\x90\x98', 
        description: 'Anubis 160-bit key test vector (NESSIE)' 
      },
      { 
        input: '\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF', 
        key: '\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF', 
        expected: '\x8F\x7A\x5E\xD3\xA8\xEC\x55\xD5\xEB\x25\x99\xD2\xD9\x8C\xCA\xC2', 
        description: 'Anubis 128-bit all ones boundary test vector (corrected)' 
      },
      { 
        input: '\x80\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00', 
        key: '\x80\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00', 
        expected: '\x2C\x3B\x5C\xE4\x4B\x56\x94\x73\x8C\xCD\x9F\x2D\xEF\xA3\x2B\xCD', 
        description: 'Anubis single bit test vector - cryptographic edge case (corrected)' 
      }
    ],
    
    // Initialize cipher
    Init: function() {
      if (Anubis.isInitialized) return;
      
      // Initialize lookup tables from S-box
      Anubis.T0 = new Array(256);
      Anubis.T1 = new Array(256);
      Anubis.T2 = new Array(256);
      Anubis.T3 = new Array(256);
      Anubis.T4 = new Array(256);
      Anubis.T5 = new Array(256);
      
      for (let x = 0; x < 256; x++) {
        // Extract S-box value
        const c = Anubis.sbox.charCodeAt(Math.floor(x / 2)) & 0xffff;
        const s1 = ((x & 1) === 0) ? (c >>> 8) : (c & 0xff);
        
        // Compute multiplications in GF(2^8) with irreducible polynomial 0x11d
        const s2 = Anubis._gfMul(s1, 2);
        const s4 = Anubis._gfMul(s1, 4);
        const s6 = s4 ^ s2;
        
        const x2 = Anubis._gfMul(x, 2);
        const x4 = Anubis._gfMul(x, 4);
        const x6 = x2 ^ x4;
        const x8 = Anubis._gfMul(x, 8);
        
        // Build lookup tables using OpCodes for clean word packing
        Anubis.T0[x] = OpCodes.Pack32BE(s1, s2, s4, s6);
        Anubis.T1[x] = OpCodes.Pack32BE(s2, s1, s6, s4);
        Anubis.T2[x] = OpCodes.Pack32BE(s4, s6, s1, s2);
        Anubis.T3[x] = OpCodes.Pack32BE(s6, s4, s2, s1);
        Anubis.T4[x] = OpCodes.Pack32BE(s1, s1, s1, s1);
        Anubis.T5[x] = OpCodes.Pack32BE(x, x2, x6, x8);
      }
      
      Anubis.isInitialized = true;
    },
    
    // GF(2^8) multiplication helper with polynomial 0x11d
    _gfMul: function(a, b) {
      let result = 0;
      a &= 0xff;
      b &= 0xff;
      
      while (b > 0) {
        if (b & 1) {
          result ^= a;
        }
        a <<= 1;
        if (a & 0x100) {
          a ^= 0x11d; // Irreducible polynomial
        }
        b >>>= 1;
      }
      return result & 0xff;
    },
    
    // Set up key
    KeySetup: function(optional_key) {
      if (!Anubis.isInitialized) {
        Anubis.Init();
      }
      
      let id;
      do {
        id = 'Anubis[' + global.generateUniqueID() + ']';
      } while (Anubis.instances[id] || global.objectInstances[id]);
      
      Anubis.instances[id] = new Anubis.AnubisInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Anubis.instances[id]) {
        // Securely clear round keys
        const instance = Anubis.instances[id];
        if (instance.roundKeyEnc) {
          OpCodes.ClearArray(instance.roundKeyEnc);
        }
        if (instance.roundKeyDec) {
          OpCodes.ClearArray(instance.roundKeyDec);
        }
        
        delete Anubis.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Anubis', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!Anubis.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Anubis', 'encryptBlock');
        return plaintext;
      }
      
      return Anubis._crypt(plaintext, Anubis.instances[id].roundKeyEnc);
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!Anubis.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Anubis', 'decryptBlock');
        return ciphertext;
      }
      
      return Anubis._crypt(ciphertext, Anubis.instances[id].roundKeyDec);
    },
    
    // Core encryption/decryption function
    _crypt: function(text, roundKey) {
      if (text.length !== 16) {
        throw new Error('Anubis requires exactly 16-byte blocks');
      }
      
      const state = new Array(4);
      const inter = new Array(4);
      const R = roundKey.length - 1;
      
      // Convert input text to state array using OpCodes
      const bytes = OpCodes.StringToBytes(text);
      for (let i = 0; i < 4; i++) {
        state[i] = OpCodes.Pack32BE(bytes[i*4], bytes[i*4+1], bytes[i*4+2], bytes[i*4+3]);
        state[i] = (state[i] ^ roundKey[0][i]) >>> 0;
      }
      
      // R-1 full rounds
      for (let r = 1; r < R; r++) {
        inter[0] = (Anubis.T0[(state[0] >>> 24) & 0xff] ^
                    Anubis.T1[(state[1] >>> 24) & 0xff] ^
                    Anubis.T2[(state[2] >>> 24) & 0xff] ^
                    Anubis.T3[(state[3] >>> 24) & 0xff] ^
                    roundKey[r][0]) >>> 0;
        inter[1] = (Anubis.T0[(state[0] >>> 16) & 0xff] ^
                    Anubis.T1[(state[1] >>> 16) & 0xff] ^
                    Anubis.T2[(state[2] >>> 16) & 0xff] ^
                    Anubis.T3[(state[3] >>> 16) & 0xff] ^
                    roundKey[r][1]) >>> 0;
        inter[2] = (Anubis.T0[(state[0] >>> 8) & 0xff] ^
                    Anubis.T1[(state[1] >>> 8) & 0xff] ^
                    Anubis.T2[(state[2] >>> 8) & 0xff] ^
                    Anubis.T3[(state[3] >>> 8) & 0xff] ^
                    roundKey[r][2]) >>> 0;
        inter[3] = (Anubis.T0[state[0] & 0xff] ^
                    Anubis.T1[state[1] & 0xff] ^
                    Anubis.T2[state[2] & 0xff] ^
                    Anubis.T3[state[3] & 0xff] ^
                    roundKey[r][3]) >>> 0;
        
        for (let i = 0; i < 4; i++) {
          state[i] = inter[i];
        }
      }
      
      // Final round (different structure)
      inter[0] = ((Anubis.T0[(state[0] >>> 24) & 0xff] & 0xff000000) ^
                  (Anubis.T1[(state[1] >>> 24) & 0xff] & 0x00ff0000) ^
                  (Anubis.T2[(state[2] >>> 24) & 0xff] & 0x0000ff00) ^
                  (Anubis.T3[(state[3] >>> 24) & 0xff] & 0x000000ff) ^
                  roundKey[R][0]) >>> 0;
      inter[1] = ((Anubis.T0[(state[0] >>> 16) & 0xff] & 0xff000000) ^
                  (Anubis.T1[(state[1] >>> 16) & 0xff] & 0x00ff0000) ^
                  (Anubis.T2[(state[2] >>> 16) & 0xff] & 0x0000ff00) ^
                  (Anubis.T3[(state[3] >>> 16) & 0xff] & 0x000000ff) ^
                  roundKey[R][1]) >>> 0;
      inter[2] = ((Anubis.T0[(state[0] >>> 8) & 0xff] & 0xff000000) ^
                  (Anubis.T1[(state[1] >>> 8) & 0xff] & 0x00ff0000) ^
                  (Anubis.T2[(state[2] >>> 8) & 0xff] & 0x0000ff00) ^
                  (Anubis.T3[(state[3] >>> 8) & 0xff] & 0x000000ff) ^
                  roundKey[R][2]) >>> 0;
      inter[3] = ((Anubis.T0[state[0] & 0xff] & 0xff000000) ^
                  (Anubis.T1[state[1] & 0xff] & 0x00ff0000) ^
                  (Anubis.T2[state[2] & 0xff] & 0x0000ff00) ^
                  (Anubis.T3[state[3] & 0xff] & 0x000000ff) ^
                  roundKey[R][3]) >>> 0;
      
      // Convert state back to byte string using OpCodes
      const resultBytes = new Array(16);
      for (let i = 0; i < 4; i++) {
        const unpacked = OpCodes.Unpack32BE(inter[i]);
        resultBytes[i*4] = unpacked[0];
        resultBytes[i*4+1] = unpacked[1];
        resultBytes[i*4+2] = unpacked[2];
        resultBytes[i*4+3] = unpacked[3];
      }
      
      return OpCodes.BytesToString(resultBytes);
    },
    
    // Instance class for key-specific data
    AnubisInstance: function(key) {
      if (!key || key.length < 16 || key.length > 40 || (key.length % 4) !== 0) {
        throw new Error('Invalid Anubis key size: ' + (key ? key.length * 8 : 0) + ' bits. Must be 128-320 bits in 32-bit increments.');
      }
      
      const N = Math.floor(key.length / 4);
      const kappa = new Array(N);
      const inter = new Array(N);
      const R = 8 + N;
      
      this.roundKeyEnc = new Array(R + 1);
      this.roundKeyDec = new Array(R + 1);
      for (let i = 0; i <= R; i++) {
        this.roundKeyEnc[i] = new Array(4);
        this.roundKeyDec[i] = new Array(4);
      }
      
      // Map byte array cipher key to initial key state using OpCodes
      const keyBytes = OpCodes.StringToBytes(key);
      for (let i = 0; i < N; i++) {
        kappa[i] = OpCodes.Pack32BE(keyBytes[i*4], keyBytes[i*4+1], keyBytes[i*4+2], keyBytes[i*4+3]);
      }
      
      // Generate R+1 round keys
      for (let r = 0; r <= R; r++) {
        // Generate r-th round key
        let K0 = Anubis.T4[(kappa[N-1] >>> 24) & 0xff];
        let K1 = Anubis.T4[(kappa[N-1] >>> 16) & 0xff];
        let K2 = Anubis.T4[(kappa[N-1] >>> 8) & 0xff];
        let K3 = Anubis.T4[kappa[N-1] & 0xff];
        
        for (let t = N - 2; t >= 0; t--) {
          K0 = (Anubis.T4[(kappa[t] >>> 24) & 0xff] ^
                ((Anubis.T5[(K0 >>> 24) & 0xff] & 0xff000000) |
                 (Anubis.T5[(K0 >>> 16) & 0xff] & 0x00ff0000) |
                 (Anubis.T5[(K0 >>> 8) & 0xff] & 0x0000ff00) |
                 (Anubis.T5[K0 & 0xff] & 0x000000ff))) >>> 0;
          K1 = (Anubis.T4[(kappa[t] >>> 16) & 0xff] ^
                ((Anubis.T5[(K1 >>> 24) & 0xff] & 0xff000000) |
                 (Anubis.T5[(K1 >>> 16) & 0xff] & 0x00ff0000) |
                 (Anubis.T5[(K1 >>> 8) & 0xff] & 0x0000ff00) |
                 (Anubis.T5[K1 & 0xff] & 0x000000ff))) >>> 0;
          K2 = (Anubis.T4[(kappa[t] >>> 8) & 0xff] ^
                ((Anubis.T5[(K2 >>> 24) & 0xff] & 0xff000000) |
                 (Anubis.T5[(K2 >>> 16) & 0xff] & 0x00ff0000) |
                 (Anubis.T5[(K2 >>> 8) & 0xff] & 0x0000ff00) |
                 (Anubis.T5[K2 & 0xff] & 0x000000ff))) >>> 0;
          K3 = (Anubis.T4[kappa[t] & 0xff] ^
                ((Anubis.T5[(K3 >>> 24) & 0xff] & 0xff000000) |
                 (Anubis.T5[(K3 >>> 16) & 0xff] & 0x00ff0000) |
                 (Anubis.T5[(K3 >>> 8) & 0xff] & 0x0000ff00) |
                 (Anubis.T5[K3 & 0xff] & 0x000000ff))) >>> 0;
        }
        
        this.roundKeyEnc[r][0] = K0;
        this.roundKeyEnc[r][1] = K1;
        this.roundKeyEnc[r][2] = K2;
        this.roundKeyEnc[r][3] = K3;
        
        // Compute kappa^{r+1} from kappa^r (if not the last round)
        if (r < R) {
          for (let i = 0; i < N; i++) {
            inter[i] = (Anubis.T0[(kappa[i] >>> 24) & 0xff] ^
                        Anubis.T1[(kappa[(N + i - 1) % N] >>> 16) & 0xff] ^
                        Anubis.T2[(kappa[(N + i - 2) % N] >>> 8) & 0xff] ^
                        Anubis.T3[kappa[(N + i - 3) % N] & 0xff]) >>> 0;
          }
          kappa[0] = ((Anubis.T0[4*r] & 0xff000000) ^
                      (Anubis.T1[4*r + 1] & 0x00ff0000) ^
                      (Anubis.T2[4*r + 2] & 0x0000ff00) ^
                      (Anubis.T3[4*r + 3] & 0x000000ff) ^
                      inter[0]) >>> 0;
          for (let i = 1; i < N; i++) {
            kappa[i] = inter[i];
          }
        }
      }
      
      // Generate inverse key schedule for decryption
      for (let i = 0; i < 4; i++) {
        this.roundKeyDec[0][i] = this.roundKeyEnc[R][i];
        this.roundKeyDec[R][i] = this.roundKeyEnc[0][i];
      }
      for (let r = 1; r < R; r++) {
        for (let i = 0; i < 4; i++) {
          const v = this.roundKeyEnc[R - r][i];
          this.roundKeyDec[r][i] = (Anubis.T0[Anubis.T4[(v >>> 24) & 0xff] & 0xff] ^
                                    Anubis.T1[Anubis.T4[(v >>> 16) & 0xff] & 0xff] ^
                                    Anubis.T2[Anubis.T4[(v >>> 8) & 0xff] & 0xff] ^
                                    Anubis.T3[Anubis.T4[v & 0xff] & 0xff]) >>> 0;
        }
      }
      
      // Clear sensitive intermediate data
      OpCodes.ClearArray(kappa);
      OpCodes.ClearArray(inter);
      OpCodes.ClearArray(keyBytes);
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Anubis);
  }
  
  // Export to global scope
  global.Anubis = Anubis;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Anubis;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);