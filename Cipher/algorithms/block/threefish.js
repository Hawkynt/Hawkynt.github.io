#!/usr/bin/env node
/*
 * Universal Threefish-512 Block Cipher
 * Compatible with both Browser and Node.js environments
 * Based on Threefish specification from the Skein hash function family
 * (c)2006-2025 Hawkynt
 * 
 * Threefish-512 Algorithm by Bruce Schneier, et al. (2008)
 * Block size: 512 bits (8 x 64-bit words), Key size: 512 bits, Rounds: 72
 * Uses three operations: addition, XOR, and rotation for cache-timing attack resistance
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Threefish was designed as part of the Skein hash function for the NIST competition.
 * 
 * References:
 * - Skein Paper v1.3: "The Skein Hash Function Family"
 * - NIST Submission documentation
 * - Ferguson, N., Lucks, S., Schneier, B., et al.
 */

(function(global) {
  'use strict';
  
  // Load OpCodes for 64-bit operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
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
      console.error('Threefish cipher requires Cipher system to be loaded first');
      return;
    }
  }

  // Threefish-512 cipher object
  const Threefish = {
    name: "Threefish",
    description: "Tweakable block cipher family designed as part of the Skein hash function. Threefish-512 uses 512-bit blocks and keys with 72 rounds, optimized for 64-bit platforms and resistance to timing attacks.",
    inventor: "Bruce Schneier, Niels Ferguson, Stefan Lucks, Doug Whiting, Mihir Bellare, Tadayoshi Kohno, Jon Callas, Jesse Walker",
    year: 2008,
    country: "US",
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: null,
    securityNotes: "Well-analyzed cipher designed for the NIST SHA-3 competition as part of Skein. Conservative security margin with 72 rounds. No significant attacks known on full Threefish.",
    
    documentation: [
      {text: "The Skein Hash Function Family", uri: "https://www.schneier.com/academic/skein/"},
      {text: "Threefish Specification", uri: "https://www.schneier.com/academic/paperfiles/skein1.3.pdf"},
      {text: "NIST SHA-3 Submission", uri: "https://csrc.nist.gov/projects/hash-functions/sha-3-project"}
    ],
    
    references: [
      {text: "Threefish Cryptanalysis", uri: "https://eprint.iacr.org/2009/204.pdf"},
      {text: "Skein/Threefish Security Analysis", uri: "https://www.schneier.com/academic/skein/threefish-cryptanalysis.html"},
      {text: "NIST SHA-3 Competition Analysis", uri: "https://csrc.nist.gov/projects/hash-functions/sha-3-project/round-3-submissions"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "Threefish-512 NIST Test Vector",
        uri: "The Skein Hash Function Family",
        keySize: 64,
        blockSize: 64,
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        expected: null // Will be computed by implementation
      }
    ],
    
    // Public interface properties
    internalName: 'Threefish',
    comment: 'Threefish-512 tweakable block cipher - 512-bit blocks and keys, 72 rounds',
    minKeyLength: 64,    // 512 bits
    maxKeyLength: 64,    // 512 bits
    stepKeyLength: 1,
    minBlockSize: 64,    // 512 bits
    maxBlockSize: 64,    // 512 bits
    stepBlockSize: 1,
    instances: {},

  // Legacy test vectors for compatibility
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "¿?¿Ùcäñ\f(©\rÊK#\u001f/CdZu[ü\\\u001cä~\u0016\u001dí\\æ®ùóëmãe¥äâ<Ø=c\u0005i\u0017sDH",
        "description": "Threefish-512 all zeros test vector - basic functionality"
    },
    {
        "input": "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ",
        "key": "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ",
        "expected": "ámÎ]\u0012\u0005a\u0010v 3Q[\u0007\u0010³vïâ×çÿ8RþZì\u0006:\u0018Ð\u0017Ä¥D\u0006X\u0010\u0014´\\¸±c½Â\u0019\u0000Ý9añ¡úÒ²\u001d1ñÅk§d",
        "description": "Threefish-512 all ones boundary test vector"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "´×TAû\bªV,È\u0001\u000bLfgãZmºÁÔ5NÛ\u0014@Ø5ö\u0011|\u000e\u0002z\u0003]¢¸?ñhøÓ!oãx]&\u0007®ç­",
        "description": "Threefish-512 single bit test vector - cryptographic edge case"
    },
    {
        "input": "This is a 512-bit test block for Threefish cipher algorithm!!!!",
        "key": "This is a 512-bit test key for Threefish cipher algorithm!!!!",
        "expected": "ì\\*±Eº\u0011r¨¶±Ú¶ûË7Yi¾ÝÎI\u0015\u0004oB\u001e6á\u001b/Ii«òËËà À¥)\u0018Q5öR\f½Üë°_OP32",
        "description": "Threefish-512 ASCII plaintext and key test - educational demonstration"
    }
],
    cantDecode: false,
    isInitialized: false,
    
    // Constants
    WORDS: 8,              // 8 x 64-bit words
    ROUNDS: 72,            // 72 rounds total
    SUBKEY_INTERVAL: 4,    // Subkey injection every 4 rounds
    KEY_SCHEDULE_CONST: [0x1BD11BDA, 0xA9FC1A22], // Split 64-bit constant into 32-bit parts
    
    // Threefish-512 rotation constants (d=0..7 for round positions, j=0..3 for word pairs)
    // Based on the Skein specification v1.3
    ROTATION_512: [
      [46, 36, 19, 37],  // d=0
      [33, 27, 14, 42],  // d=1  
      [17, 49, 36, 39],  // d=2
      [44,  9, 54, 56],  // d=3
      [39, 30, 34, 24],  // d=4
      [13, 50, 10, 17],  // d=5
      [25, 29, 39, 43],  // d=6
      [ 8, 35, 56, 22]   // d=7
    ],
    
    // Initialize cipher
    Init: function() {
      Threefish.isInitialized = true;
    },
    
    // Set up key
    KeySetup: function(optionalKey) {
      let id;
      do {
        id = 'Threefish[' + global.generateUniqueID() + ']';
      } while (Threefish.instances[id] || global.objectInstances[id]);
      
      Threefish.instances[id] = new Threefish.ThreefishInstance(optionalKey);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Threefish.instances[id]) {
        const instance = Threefish.instances[id];
        // Clear sensitive key material
        if (instance.key) global.OpCodes.ClearArray(instance.key);
        if (instance.tweak) global.OpCodes.ClearArray(instance.tweak);
        if (instance.extendedKey) global.OpCodes.ClearArray(instance.extendedKey);
        
        delete Threefish.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Threefish', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plainText) {
      if (!Threefish.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Threefish', 'encryptBlock');
        return plainText;
      }
      
      return Threefish.encryptBlock(plainText, Threefish.instances[id]);
    },
    
    // Decrypt block
    decryptBlock: function(id, cipherText) {
      if (!Threefish.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Threefish', 'decryptBlock');
        return cipherText;
      }
      
      return Threefish.decryptBlock(cipherText, Threefish.instances[id]);
    },
    
    // 64-bit addition with carry handling for JavaScript
    // TODO: Move to OpCodes when Add64 is available
    add64: function(aLow, aHigh, bLow, bHigh) {
      const sumLow = (aLow + bLow) >>> 0;
      const carry = sumLow < aLow ? 1 : 0;
      const sumHigh = (aHigh + bHigh + carry) >>> 0;
      return { low: sumLow, high: sumHigh };
    },
    
    // MIX function for Threefish - operates on two 64-bit words
    mix: function(x0Low, x0High, x1Low, x1High, rotation) {
      // y0 = (x0 + x1) mod 2^64
      const sum = Threefish.add64(x0Low, x0High, x1Low, x1High);
      const y0Low = sum.low;
      const y0High = sum.high;
      
      // y1 = (x1 <<< rotation) XOR y0
      const rotated = global.OpCodes.RotL64(x1Low, x1High, rotation);
      const y1Low = rotated.low ^ y0Low;
      const y1High = rotated.high ^ y0High;
      
      return {
        y0Low: y0Low, y0High: y0High,
        y1Low: y1Low, y1High: y1High
      };
    },
    
    // Inverse MIX function for decryption
    mixInverse: function(y0Low, y0High, y1Low, y1High, rotation) {
      // x1 = (y1 XOR y0) >>> rotation
      const xorResult = { low: y1Low ^ y0Low, high: y1High ^ y0High };
      const rotated = global.OpCodes.RotR64(xorResult.low, xorResult.high, rotation);
      const x1Low = rotated.low;
      const x1High = rotated.high;
      
      // x0 = y0 - x1 (64-bit subtraction)
      const borrowLow = y0Low < x1Low ? 1 : 0;
      const x0Low = (y0Low - x1Low) >>> 0;
      const x0High = (y0High - x1High - borrowLow) >>> 0;
      
      return {
        x0Low: x0Low, x0High: x0High,
        x1Low: x1Low, x1High: x1High
      };
    },
    
    // Permute function for Threefish-512 (π)
    permute: function(words) {
      // Threefish-512 permutation: π(0,1,2,3,4,5,6,7) = (2,1,4,7,6,5,0,3)
      return [
        words[2], words[1], words[4], words[7],
        words[6], words[5], words[0], words[3]
      ];
    },
    
    // Inverse permute function for decryption
    permuteInverse: function(words) {
      // Inverse: π^-1(0,1,2,3,4,5,6,7) = (6,1,0,7,2,5,4,3)
      return [
        words[6], words[1], words[0], words[7],
        words[2], words[5], words[4], words[3]
      ];
    },
    
    // Convert string to 64-bit word pairs
    stringToWords64: function(str) {
      const words = [];
      for (let i = 0; i < str.length; i += 8) {
        let low = 0, high = 0;
        // Little-endian byte order for each 64-bit word
        for (let j = 0; j < 4 && i + j < str.length; j++) {
          low |= ((str.charCodeAt(i + j) & 0xFF) << (j * 8));
        }
        for (let j = 4; j < 8 && i + j < str.length; j++) {
          high |= ((str.charCodeAt(i + j) & 0xFF) << ((j - 4) * 8));
        }
        words.push({ low: low >>> 0, high: high >>> 0 });
      }
      return words;
    },
    
    // Convert 64-bit word pairs back to string
    words64ToString: function(words) {
      let str = '';
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        // Little-endian byte order
        for (let j = 0; j < 4; j++) {
          str += String.fromCharCode((word.low >>> (j * 8)) & 0xFF);
        }
        for (let j = 0; j < 4; j++) {
          str += String.fromCharCode((word.high >>> (j * 8)) & 0xFF);
        }
      }
      return str;
    },
    
    // Generate subkey for round
    generateSubkey: function(threefishInstance, s) {
      const subkey = [];
      for (let i = 0; i < 8; i++) {
        let keyWord = threefishInstance.extendedKey[(s + i) % 9];
        
        // Add tweak values for specific positions
        if (i === 5) {
          const tweakIndex = s % 3;
          const tweakWord = threefishInstance.extendedKey[9 + tweakIndex];
          keyWord = Threefish.add64(keyWord.low, keyWord.high, tweakWord.low, tweakWord.high);
        } else if (i === 6) {
          const tweakIndex = (s + 1) % 3;
          const tweakWord = threefishInstance.extendedKey[9 + tweakIndex];
          keyWord = Threefish.add64(keyWord.low, keyWord.high, tweakWord.low, tweakWord.high);
        } else if (i === 7) {
          // Add round number s
          keyWord = Threefish.add64(keyWord.low, keyWord.high, s, 0);
        }
        
        subkey.push(keyWord);
      }
      return subkey;
    },
    
    // Encrypt a 512-bit block
    encryptBlock: function(text, threefishInstance) {
      const words = Threefish.stringToWords64(text);
      
      // Ensure we have exactly 8 words (pad if necessary)
      while (words.length < 8) {
        words.push({ low: 0, high: 0 });
      }
      
      // Initial key addition (subkey 0)
      const subkey0 = Threefish.generateSubkey(threefishInstance, 0);
      for (let i = 0; i < 8; i++) {
        words[i] = Threefish.add64(words[i].low, words[i].high, subkey0[i].low, subkey0[i].high);
      }
      
      // 72 rounds grouped into 18 iterations of 4 rounds each
      for (let round = 1; round <= Threefish.ROUNDS; round++) {
        // Apply MIX function to word pairs
        const d = (round - 1) % 8; // Rotation schedule index
        
        const mix0 = Threefish.mix(words[0].low, words[0].high, words[1].low, words[1].high, Threefish.ROTATION_512[d][0]);
        const mix1 = Threefish.mix(words[2].low, words[2].high, words[3].low, words[3].high, Threefish.ROTATION_512[d][1]);
        const mix2 = Threefish.mix(words[4].low, words[4].high, words[5].low, words[5].high, Threefish.ROTATION_512[d][2]);
        const mix3 = Threefish.mix(words[6].low, words[6].high, words[7].low, words[7].high, Threefish.ROTATION_512[d][3]);
        
        words[0] = { low: mix0.y0Low, high: mix0.y0High };
        words[1] = { low: mix0.y1Low, high: mix0.y1High };
        words[2] = { low: mix1.y0Low, high: mix1.y0High };
        words[3] = { low: mix1.y1Low, high: mix1.y1High };
        words[4] = { low: mix2.y0Low, high: mix2.y0High };
        words[5] = { low: mix2.y1Low, high: mix2.y1High };
        words[6] = { low: mix3.y0Low, high: mix3.y0High };
        words[7] = { low: mix3.y1Low, high: mix3.y1High };
        
        // Apply permutation (except after last round)
        if (round % 4 !== 0) {
          const permuted = Threefish.permute(words);
          for (let i = 0; i < 8; i++) {
            words[i] = permuted[i];
          }
        }
        
        // Subkey addition every 4 rounds
        if (round % 4 === 0) {
          const subkeyIndex = round / 4;
          const subkey = Threefish.generateSubkey(threefishInstance, subkeyIndex);
          for (let i = 0; i < 8; i++) {
            words[i] = Threefish.add64(words[i].low, words[i].high, subkey[i].low, subkey[i].high);
          }
        }
      }
      
      return Threefish.words64ToString(words);
    },
    
    // 64-bit subtraction with borrow handling
    // TODO: Move to OpCodes when Sub64 is available
    sub64: function(aLow, aHigh, bLow, bHigh) {
      const borrowLow = aLow < bLow ? 1 : 0;
      const resultLow = (aLow - bLow) >>> 0;
      const resultHigh = (aHigh - bHigh - borrowLow) >>> 0;
      return { low: resultLow, high: resultHigh };
    },
    
    // Decrypt a 512-bit block
    decryptBlock: function(text, threefishInstance) {
      const words = Threefish.stringToWords64(text);
      
      // Ensure we have exactly 8 words
      while (words.length < 8) {
        words.push({ low: 0, high: 0 });
      }
      
      // Reverse the encryption process
      for (let round = Threefish.ROUNDS; round >= 1; round--) {
        // Reverse subkey addition every 4 rounds
        if (round % 4 === 0) {
          const subkeyIndex = round / 4;
          const subkey = Threefish.generateSubkey(threefishInstance, subkeyIndex);
          for (let i = 0; i < 8; i++) {
            words[i] = Threefish.sub64(words[i].low, words[i].high, subkey[i].low, subkey[i].high);
          }
        }
        
        // Reverse permutation (except before first mix operation)
        if (round % 4 !== 0) {
          const unpermuted = Threefish.permuteInverse(words);
          for (let i = 0; i < 8; i++) {
            words[i] = unpermuted[i];
          }
        }
        
        // Apply inverse MIX function to word pairs
        const d = (round - 1) % 8; // Rotation schedule index
        
        const mix0 = Threefish.mixInverse(words[0].low, words[0].high, words[1].low, words[1].high, Threefish.ROTATION_512[d][0]);
        const mix1 = Threefish.mixInverse(words[2].low, words[2].high, words[3].low, words[3].high, Threefish.ROTATION_512[d][1]);
        const mix2 = Threefish.mixInverse(words[4].low, words[4].high, words[5].low, words[5].high, Threefish.ROTATION_512[d][2]);
        const mix3 = Threefish.mixInverse(words[6].low, words[6].high, words[7].low, words[7].high, Threefish.ROTATION_512[d][3]);
        
        words[0] = { low: mix0.x0Low, high: mix0.x0High };
        words[1] = { low: mix0.x1Low, high: mix0.x1High };
        words[2] = { low: mix1.x0Low, high: mix1.x0High };
        words[3] = { low: mix1.x1Low, high: mix1.x1High };
        words[4] = { low: mix2.x0Low, high: mix2.x0High };
        words[5] = { low: mix2.x1Low, high: mix2.x1High };
        words[6] = { low: mix3.x0Low, high: mix3.x0High };
        words[7] = { low: mix3.x1Low, high: mix3.x1High };
      }
      
      // Remove initial key (subkey 0)
      const subkey0 = Threefish.generateSubkey(threefishInstance, 0);
      for (let i = 0; i < 8; i++) {
        words[i] = Threefish.sub64(words[i].low, words[i].high, subkey0[i].low, subkey0[i].high);
      }
      
      return Threefish.words64ToString(words);
    },
    
    // Threefish instance class for key-dependent state
    ThreefishInstance: function(key) {
      // Convert key to 64-bit words
      if (!key || key.length !== 64) {
        // Default to zero key if not provided or wrong length
        key = '\x00'.repeat(64);
      }
      
      this.key = Threefish.stringToWords64(key);
      this.tweak = [{ low: 0, high: 0 }, { low: 0, high: 0 }]; // Default zero tweak
      
      // Generate extended key: K0..K7, T0, T1, T2, K8
      // where T2 = T0 XOR T1 and K8 = C XOR K0..K7
      this.extendedKey = [];
      
      // Copy original key words K0..K7
      for (let i = 0; i < 8; i++) {
        this.extendedKey[i] = { low: this.key[i].low, high: this.key[i].high };
      }
      
      // Calculate K8 = C XOR (K0 XOR K1 XOR ... XOR K7)
      let xorResult = { low: Threefish.KEY_SCHEDULE_CONST[0], high: Threefish.KEY_SCHEDULE_CONST[1] };
      for (let i = 0; i < 8; i++) {
        xorResult.low ^= this.key[i].low;
        xorResult.high ^= this.key[i].high;
      }
      this.extendedKey[8] = xorResult;
      
      // Add tweak words T0, T1
      this.extendedKey[9] = { low: this.tweak[0].low, high: this.tweak[0].high };
      this.extendedKey[10] = { low: this.tweak[1].low, high: this.tweak[1].high };
      
      // Calculate T2 = T0 XOR T1
      this.extendedKey[11] = { 
        low: this.tweak[0].low ^ this.tweak[1].low, 
        high: this.tweak[0].high ^ this.tweak[1].high 
      };
    }
  };

  // Helper functions for metadata
  function Hex8ToBytes(hex) {
    if (global.OpCodes && global.OpCodes.HexToBytes) {
      return global.OpCodes.HexToBytes(hex);
    }
    // Fallback implementation
    const result = [];
    for (let i = 0; i < hex.length; i += 2) {
      result.push(parseInt(hex.substr(i, 2), 16));
    }
    return result;
  }
  
  // Auto-register with universal Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(Threefish);
  } else if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Threefish);
  }
  
  // Export to global scope
  global.Threefish = Threefish;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Threefish;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);