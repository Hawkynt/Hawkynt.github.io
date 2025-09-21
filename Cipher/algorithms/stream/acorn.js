/*
 * ACORN Implementation - Authenticated Encryption with Associated Data
 * CAESAR Competition Winner (Lightweight Category)
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
  
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    try {
      global.AlgorithmFramework = require('../../AlgorithmFramework.js');
    } catch (e) {
      console.error('Failed to load AlgorithmFramework:', e.message);
      return;
    }
  }
  
  const CA_ONE_WORD = 0xFFFFFFFF;
  const CA_ZERO_WORD = 0x00000000;
  const CB_ONE_WORD = 0xFFFFFFFF;
  const CB_ZERO_WORD = 0x00000000;
  const CA_ONE_BYTE = 0xFF;
  const CA_ZERO_BYTE = 0x00;
  const CB_ONE_BYTE = 0xFF;
  const CB_ZERO_BYTE = 0x00;

  const S1_HIGH_MASK = 0x1FFFFFFF;
  const S2_HIGH_MASK = 0x00003FFF;
  const S3_HIGH_MASK = 0x00007FFF;
  const S4_HIGH_MASK = 0x0000007F;
  const S5_HIGH_MASK = 0x0000001F;
  const S6_HIGH_MASK = 0x07FFFFFF;

  function toUint32(value) {
    return value >>> 0;
  }

  function maj8(x, y, z) {
    const a = x & 0xFF;
    const b = y & 0xFF;
    const c = z & 0xFF;
    return ((a & b) ^ (a & c) ^ (b & c)) & 0xFF;
  }

  function ch8(x, y, z) {
    const a = x & 0xFF;
    const b = y & 0xFF;
    const c = z & 0xFF;
    return ((a & b) ^ (((~a) & 0xFF) & c)) & 0xFF;
  }

  function createContext() {
    return {
      s1_l: 0, s1_h: 0,
      s2_l: 0, s2_h: 0,
      s3_l: 0, s3_h: 0,
      s4_l: 0, s4_h: 0,
      s5_l: 0, s5_h: 0,
      s6_l: 0, s6_h: 0,
      s7: 0,
      authDone: 0
    };
  }

  function resetContext(ctx) {
    ctx.s1_l = ctx.s1_h = 0;
    ctx.s2_l = ctx.s2_h = 0;
    ctx.s3_l = ctx.s3_h = 0;
    ctx.s4_l = ctx.s4_h = 0;
    ctx.s5_l = ctx.s5_h = 0;
    ctx.s6_l = ctx.s6_h = 0;
    ctx.s7 = 0;
    ctx.authDone = 0;
  }

  function wordFromBytes(bytes, offset) {
    return (
      (bytes[offset] & 0xFF) |
      ((bytes[offset + 1] & 0xFF) << 8) |
      ((bytes[offset + 2] & 0xFF) << 16) |
      ((bytes[offset + 3] & 0xFF) << 24)
    ) >>> 0;
  }

  function applyShift8(ctx, s7Low, feedback) {
    const mixed = (s7Low ^ ((feedback << 4) & 0xFF)) & 0xFF;
    ctx.s7 = (feedback >>> 4) & 0x0F;

    ctx.s1_l = toUint32((ctx.s1_l >>> 8) | ((ctx.s1_h & 0xFF) << 24));
    ctx.s1_h = toUint32((ctx.s1_h >>> 8) | (((ctx.s2_l & 0xFF) << (61 - 40)) >>> 0)) & S1_HIGH_MASK;

    ctx.s2_l = toUint32((ctx.s2_l >>> 8) | ((ctx.s2_h & 0xFF) << 24));
    ctx.s2_h = toUint32((ctx.s2_h >>> 8) | (((ctx.s3_l & 0xFF) << (46 - 40)) >>> 0)) & S2_HIGH_MASK;

    ctx.s3_l = toUint32((ctx.s3_l >>> 8) | ((ctx.s3_h & 0xFF) << 24));
    ctx.s3_h = toUint32((ctx.s3_h >>> 8) | (((ctx.s4_l & 0xFF) << (47 - 40)) >>> 0)) & S3_HIGH_MASK;

    ctx.s4_l = toUint32((ctx.s4_l >>> 8) | ((ctx.s4_h & 0xFF) << 24) | ((ctx.s5_l & 0xFF) << (39 - 8)));
    ctx.s4_h = ((ctx.s5_l & 0xFF) >>> (40 - 39)) & S4_HIGH_MASK;

    ctx.s5_l = toUint32((ctx.s5_l >>> 8) | ((ctx.s5_h & 0xFF) << 24) | ((ctx.s6_l & 0xFF) << (37 - 8)));
    ctx.s5_h = ((ctx.s6_l & 0xFF) >>> (40 - 37)) & S5_HIGH_MASK;

    ctx.s6_l = toUint32((ctx.s6_l >>> 8) | ((ctx.s6_h & 0xFF) << 24));
    ctx.s6_h = toUint32((ctx.s6_h >>> 8) | (mixed << 19)) & S6_HIGH_MASK;
  }

  function acornEncrypt8(ctx, plaintextByte, caByte, cbByte) {
    const s244 = (ctx.s6_l >>> 14) & 0xFF;
    const s235 = (ctx.s6_l >>> 5) & 0xFF;
    const s196 = (ctx.s5_l >>> 3) & 0xFF;
    const s160 = (ctx.s4_l >>> 6) & 0xFF;
    const s111 = (ctx.s3_l >>> 4) & 0xFF;
    const s66 = (ctx.s2_l >>> 5) & 0xFF;
    const s23 = (ctx.s1_l >>> 23) & 0xFF;
    const s12 = (ctx.s1_l >>> 12) & 0xFF;

    let s7Low = (ctx.s7 ^ s235 ^ (ctx.s6_l & 0xFF)) & 0xFF;
    ctx.s6_l = toUint32(ctx.s6_l ^ s196 ^ (ctx.s5_l & 0xFF));
    ctx.s5_l = toUint32(ctx.s5_l ^ s160 ^ (ctx.s4_l & 0xFF));
    ctx.s4_l = toUint32(ctx.s4_l ^ s111 ^ (ctx.s3_l & 0xFF));
    ctx.s3_l = toUint32(ctx.s3_l ^ s66 ^ (ctx.s2_l & 0xFF));
    ctx.s2_l = toUint32(ctx.s2_l ^ s23 ^ (ctx.s1_l & 0xFF));

    const keystream = (s12 ^ (ctx.s4_l & 0xFF) ^ maj8(s235, ctx.s2_l, ctx.s5_l) ^ ch8(ctx.s6_l, s111, s66)) & 0xFF;
    const caMask = caByte & s196;
    const cbMask = cbByte & keystream;
    let feedback = ((ctx.s1_l & 0xFF) ^ ((~ctx.s3_l) & 0xFF) ^ maj8(s244, s23, s160) ^ caMask ^ cbMask) & 0xFF;
    feedback ^= plaintextByte & 0xFF;

    applyShift8(ctx, s7Low, feedback);
    return (plaintextByte ^ keystream) & 0xFF;
  }

  function acornDecrypt8(ctx, ciphertextByte) {
    const s244 = (ctx.s6_l >>> 14) & 0xFF;
    const s235 = (ctx.s6_l >>> 5) & 0xFF;
    const s196 = (ctx.s5_l >>> 3) & 0xFF;
    const s160 = (ctx.s4_l >>> 6) & 0xFF;
    const s111 = (ctx.s3_l >>> 4) & 0xFF;
    const s66 = (ctx.s2_l >>> 5) & 0xFF;
    const s23 = (ctx.s1_l >>> 23) & 0xFF;
    const s12 = (ctx.s1_l >>> 12) & 0xFF;

    let s7Low = (ctx.s7 ^ s235 ^ (ctx.s6_l & 0xFF)) & 0xFF;
    ctx.s6_l = toUint32(ctx.s6_l ^ s196 ^ (ctx.s5_l & 0xFF));
    ctx.s5_l = toUint32(ctx.s5_l ^ s160 ^ (ctx.s4_l & 0xFF));
    ctx.s4_l = toUint32(ctx.s4_l ^ s111 ^ (ctx.s3_l & 0xFF));
    ctx.s3_l = toUint32(ctx.s3_l ^ s66 ^ (ctx.s2_l & 0xFF));
    ctx.s2_l = toUint32(ctx.s2_l ^ s23 ^ (ctx.s1_l & 0xFF));

    const keystream = (s12 ^ (ctx.s4_l & 0xFF) ^ maj8(s235, ctx.s2_l, ctx.s5_l) ^ ch8(ctx.s6_l, s111, s66)) & 0xFF;
    const plaintext = (ciphertextByte ^ keystream) & 0xFF;

    let feedback = ((ctx.s1_l & 0xFF) ^ ((~ctx.s3_l) & 0xFF) ^ maj8(s244, s23, s160) ^ s196) & 0xFF;
    feedback ^= plaintext;

    applyShift8(ctx, s7Low, feedback);
    return plaintext;
  }

  function encryptWord(ctx, word, caWord, cbWord) {
    let result = 0;
    for (let offset = 0; offset < 32; offset += 8) {
      const inputByte = (word >>> offset) & 0xFF;
      const caByte = (caWord >>> offset) & 0xFF;
      const cbByte = (cbWord >>> offset) & 0xFF;
      const outByte = acornEncrypt8(ctx, inputByte, caByte, cbByte);
      result |= outByte << offset;
    }
    return result >>> 0;
  }

  function acornPad(ctx, cbWord) {
    encryptWord(ctx, 1, CA_ONE_WORD, cbWord);
    encryptWord(ctx, 0, CA_ONE_WORD, cbWord);
    encryptWord(ctx, 0, CA_ONE_WORD, cbWord);
    encryptWord(ctx, 0, CA_ONE_WORD, cbWord);
    encryptWord(ctx, 0, CA_ZERO_WORD, cbWord);
    encryptWord(ctx, 0, CA_ZERO_WORD, cbWord);
    encryptWord(ctx, 0, CA_ZERO_WORD, cbWord);
    encryptWord(ctx, 0, CA_ZERO_WORD, cbWord);
  }

  function initializeContext(ctx, keyBytes, ivBytes) {
    resetContext(ctx);
    const keyWords = [
      wordFromBytes(keyBytes, 0),
      wordFromBytes(keyBytes, 4),
      wordFromBytes(keyBytes, 8),
      wordFromBytes(keyBytes, 12)
    ];
    const ivWords = [
      wordFromBytes(ivBytes, 0),
      wordFromBytes(ivBytes, 4),
      wordFromBytes(ivBytes, 8),
      wordFromBytes(ivBytes, 12)
    ];
    for (let i = 0; i < 4; i++) {
      encryptWord(ctx, keyWords[i], CA_ONE_WORD, CB_ONE_WORD);
    }
    for (let i = 0; i < 4; i++) {
      encryptWord(ctx, ivWords[i], CA_ONE_WORD, CB_ONE_WORD);
    }
    encryptWord(ctx, (keyWords[0] ^ 0x00000001) >>> 0, CA_ONE_WORD, CB_ONE_WORD);
    encryptWord(ctx, keyWords[1], CA_ONE_WORD, CB_ONE_WORD);
    encryptWord(ctx, keyWords[2], CA_ONE_WORD, CB_ONE_WORD);
    encryptWord(ctx, keyWords[3], CA_ONE_WORD, CB_ONE_WORD);
    for (let round = 0; round < 11; round++) {
      for (let i = 0; i < 4; i++) {
        encryptWord(ctx, keyWords[i], CA_ONE_WORD, CB_ONE_WORD);
      }
    }
  }

  function absorbAAD(ctx, aad) {
    if (!aad || aad.length === 0) {
      return;
    }
    for (let i = 0; i < aad.length; i++) {
      acornEncrypt8(ctx, aad[i] & 0xFF, CA_ONE_BYTE, CB_ONE_BYTE);
    }
  }

  function encryptBytes(ctx, plaintext) {
    if (!ctx.authDone) {
      acornPad(ctx, CB_ONE_WORD);
      ctx.authDone = 1;
    }
    if (!plaintext || plaintext.length === 0) {
      return [];
    }
    const output = new Array(plaintext.length);
    for (let i = 0; i < plaintext.length; i++) {
      output[i] = acornEncrypt8(ctx, plaintext[i] & 0xFF, CA_ONE_BYTE, CB_ZERO_BYTE);
    }
    return output;
  }

  function decryptBytes(ctx, ciphertext) {
    if (!ctx.authDone) {
      acornPad(ctx, CB_ONE_WORD);
      ctx.authDone = 1;
    }
    if (!ciphertext || ciphertext.length === 0) {
      return [];
    }
    const output = new Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
      output[i] = acornDecrypt8(ctx, ciphertext[i] & 0xFF);
    }
    return output;
  }

  function finalizeTag(ctx) {
    if (!ctx.authDone) {
      acornPad(ctx, CB_ONE_WORD);
    }
    acornPad(ctx, CB_ZERO_WORD);
    for (let i = 0; i < 20; i++) {
      encryptWord(ctx, 0, CA_ONE_WORD, CB_ONE_WORD);
    }
    const tagBytes = [];
    for (let i = 0; i < 4; i++) {
      const word = encryptWord(ctx, 0, CA_ONE_WORD, CB_ONE_WORD);
      for (let shift = 0; shift < 32; shift += 8) {
        tagBytes.push((word >>> shift) & 0xFF);
      }
    }
    return tagBytes.slice(0, 16);
  }

  const ACORN = {
    name: "ACORN",
    description: "Authenticated encryption with associated data (AEAD) stream cipher designed for lightweight applications. Winner of CAESAR competition lightweight category with 128-bit security and efficient hardware implementation.",
    inventor: "Hongjun Wu, Tao Huang, Phuong Pham, Steven Sim",
    year: 2016,
    country: "Multi-national",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.STREAM : 'stream',
    subCategory: "Stream Cipher",
    securityStatus: null,
    securityNotes: "CAESAR competition winner with thorough security analysis. Designed for IoT and resource-constrained environments with authenticated encryption.",
    
    documentation: [
      {text: "CAESAR Submission", uri: "https://competitions.cr.yp.to/round3/acornv3.pdf"},
      {text: "CAESAR Competition Results", uri: "https://competitions.cr.yp.to/caesar-submissions.html"},
      {text: "Algorithm Specification", uri: "https://acorn-cipher.org/"}
    ],
    
    references: [
      {text: "Reference Implementation", uri: "https://github.com/hongjun-wu/ACORN-128"},
      {text: "CAESAR Benchmarks", uri: "https://bench.cr.yp.to/results-aead.html"},
      {text: "NIST Lightweight Crypto", uri: "https://csrc.nist.gov/projects/lightweight-cryptography"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Weak Key Classes",
        text: "Small subset of keys may have reduced security margins",
        mitigation: "Use random key generation and avoid structured or low-entropy keys"
      },
      {
        type: "Implementation Attacks",
        text: "Side-channel vulnerabilities in software implementations",
        mitigation: "Use constant-time implementation and appropriate countermeasures"
      }
    ],
    
    tests: [
      {
        text: "ACORN-128 Test Vector 1 (Empty Message)",
        uri: "https://competitions.cr.yp.to/round3/acornv3.pdf",
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        aad: OpCodes.Hex8ToBytes(""),
        input: OpCodes.Hex8ToBytes(""),
        plaintext: OpCodes.Hex8ToBytes(""),
        expectedCiphertext: OpCodes.Hex8ToBytes(""),
        expectedTag: OpCodes.Hex8ToBytes("835E5317896E86B2447143C74F6FFC1E"),
        expected: OpCodes.Hex8ToBytes("835E5317896E86B2447143C74F6FFC1E")
      },
      {
        text: "ACORN-128 Test Vector 2 (Single Byte Plaintext)",
        uri: "https://competitions.cr.yp.to/round3/acornv3.pdf",
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        aad: OpCodes.Hex8ToBytes(""),
        input: OpCodes.Hex8ToBytes("01"),
        plaintext: OpCodes.Hex8ToBytes("01"),
        expectedCiphertext: OpCodes.Hex8ToBytes("2B"),
        expectedTag: OpCodes.Hex8ToBytes("4B60640E26F0A99DD01F93BF634997CB"),
        expected: OpCodes.Hex8ToBytes("2B4B60640E26F0A99DD01F93BF634997CB")
      },
      {
        text: "ACORN-128 Test Vector 3 (AAD Only)",
        uri: "https://competitions.cr.yp.to/round3/acornv3.pdf",
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        aad: OpCodes.Hex8ToBytes("01"),
        input: OpCodes.Hex8ToBytes(""),
        plaintext: OpCodes.Hex8ToBytes(""),
        expectedCiphertext: OpCodes.Hex8ToBytes(""),
        expectedTag: OpCodes.Hex8ToBytes("982EF7D1BBA7F89A1575297A095CD7F2"),
        expected: OpCodes.Hex8ToBytes("982EF7D1BBA7F89A1575297A095CD7F2")
      }
    ],

    // Legacy interface properties
    internalName: 'acorn',
    minKeyLength: 16,
    maxKeyLength: 16,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    version: '1.0.0',
    keySize: 16,
    blockSize: 16,
    
    // Algorithm metadata
    isStreamCipher: true,
    isBlockCipher: false,
    isAEAD: true,
    complexity: 'Medium',
    family: 'Lightweight',
    // Removed duplicate category - using the correct one at line 35
    
    // ACORN state (293 bits)
    state: null,
    keyScheduled: false,
    
    // ACORN constants
    STATE_SIZE: 293,
    KEY_SIZE: 128,
    IV_SIZE: 128,
    TAG_SIZE: 128,
    
    // Initialize ACORN
    Init: function() {
      this.state = null;
      this.key = null;
      this.keyScheduled = false;
      return true;
    },
    
    // Key setup
    KeySetup: function(key) {
      if (key.length !== 16) {
        throw new Error('ACORN requires exactly 16-byte (128-bit) key');
      }
      
      this.key = OpCodes.CopyArray(key);
      this.keyScheduled = true;
      
      return 'acorn-128-' + Math.random().toString(36).substr(2, 9);
    },
    
    // Initialize ACORN state with key and IV
    initializeState: function(key, iv) {
      if (!key || key.length !== 16) {
        throw new Error('ACORN requires exactly 16-byte (128-bit) key');
      }
      if (!iv || iv.length !== 16) {
        throw new Error('ACORN requires 16-byte IV');
      }
      const context = createContext();
      initializeContext(context, key, iv);
      return context;
    },

    encryptAEAD: function(key, iv, aad, plaintext) {
      const context = this.initializeState(key, iv);
      const aadBytes = Array.isArray(aad) ? aad : (aad ? OpCodes.CopyArray(aad) : []);
      absorbAAD(context, aadBytes);
      const message = Array.isArray(plaintext) ? plaintext : (plaintext ? OpCodes.CopyArray(plaintext) : []);
      const ciphertext = encryptBytes(context, message);
      const tag = finalizeTag(context);
      return {
        ciphertext: ciphertext,
        tag: tag
      };
    },

    decryptAEAD: function(key, iv, aad, ciphertext, expectedTag) {
      const context = this.initializeState(key, iv);
      const aadBytes = Array.isArray(aad) ? aad : (aad ? OpCodes.CopyArray(aad) : []);
      absorbAAD(context, aadBytes);
      const cipherBytes = Array.isArray(ciphertext) ? ciphertext : (ciphertext ? OpCodes.CopyArray(ciphertext) : []);
      const plaintext = decryptBytes(context, cipherBytes);
      const tag = finalizeTag(context);
      if (!OpCodes.SecureCompare(tag, expectedTag)) {
        throw new Error('Authentication tag verification failed');
      }
      return plaintext;
    },
    
    // Legacy cipher interface (simplified)
    szEncryptBlock: function(blockIndex, plaintext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      const iv = new Array(16).fill(0);
      iv[0] = blockIndex & 0xFF;
      iv[1] = (blockIndex >> 8) & 0xFF;
      
      const result = this.encryptAEAD(this.key, iv, null, plaintext);
      return result.ciphertext.concat(result.tag);
    },
    
    szDecryptBlock: function(blockIndex, ciphertext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      if (ciphertext.length < 16) {
        throw new Error('Ciphertext too short for authentication tag');
      }
      
      const iv = new Array(16).fill(0);
      iv[0] = blockIndex & 0xFF;
      iv[1] = (blockIndex >> 8) & 0xFF;
      
      const actualCiphertext = ciphertext.slice(0, -16);
      const tag = ciphertext.slice(-16);
      
      return this.decryptAEAD(this.key, iv, null, actualCiphertext, tag);
    },
    
    CreateInstance: function(isInverse = false) {
      const algorithm = this;
      const tagBytes = this.TAG_SIZE / 8;
      return {
        _key: null,
        _iv: null,
        _aad: [],
        _input: [],
        set key(value) {
          this._key = value ? OpCodes.CopyArray(value) : null;
        },
        set iv(value) {
          this._iv = value ? OpCodes.CopyArray(value) : null;
        },
        set nonce(value) {
          this.iv = value;
        },
        set aad(value) {
          this._aad = value ? OpCodes.CopyArray(value) : [];
        },
        set associatedData(value) {
          this.aad = value;
        },
        Feed: function(data) {
          if (Array.isArray(data)) {
            this._input = OpCodes.CopyArray(data);
          } else if (typeof data === 'string') {
            this._input = OpCodes.AsciiToBytes(data);
          } else {
            this._input = [];
          }
        },
        Result: function() {
          const key = this._key ? OpCodes.CopyArray(this._key) : new Array(algorithm.KEY_SIZE / 8).fill(0);
          const iv = this._iv ? OpCodes.CopyArray(this._iv) : new Array(algorithm.IV_SIZE / 8).fill(0);
          const aad = this._aad ? OpCodes.CopyArray(this._aad) : [];
          const ctx = Object.create(algorithm);
          ctx.Init();
          if (isInverse) {
            const data = this._input ? OpCodes.CopyArray(this._input) : [];
            if (data.length < tagBytes) {
              return [];
            }
            const ciphertext = data.slice(0, data.length - tagBytes);
            const tag = data.slice(data.length - tagBytes);
            return ctx.decryptAEAD(key, iv, aad, ciphertext, tag);
          }
          const plaintext = this._input ? OpCodes.CopyArray(this._input) : [];
          const result = ctx.encryptAEAD(key, iv, aad, plaintext);
          return result.ciphertext.concat(result.tag);
        }
      };
    },
    ClearData: function() {
      if (this.key) {
        OpCodes.ClearArray(this.key);
        this.key = null;
      }
      this.keyScheduled = false;
    },
    
    // Test vector runner
    runTestVector: function() {
      console.log('Running ACORN test vectors...');
      
      let allPassed = true;
      
      for (let i = 0; i < this.tests.length; i++) {
        const test = this.tests[i];
        console.log(`Running test: ${test.text}`);
        
        try {
          const result = this.encryptAEAD(test.key, test.iv, test.aad, test.plaintext);
          
          const ciphertextMatch = OpCodes.SecureCompare(result.ciphertext, test.expectedCiphertext);
          const tagMatch = OpCodes.SecureCompare(result.tag, test.expectedTag);
          
          if (ciphertextMatch && tagMatch) {
            console.log(`Test ${i + 1}: PASS`);
          } else {
            console.log(`Test ${i + 1}: FAIL`);
            if (!ciphertextMatch) {
              console.log('Expected ciphertext:', OpCodes.BytesToHex8(test.expectedCiphertext));
              console.log('Actual ciphertext:', OpCodes.BytesToHex8(result.ciphertext));
            }
            if (!tagMatch) {
              console.log('Expected tag:', OpCodes.BytesToHex8(test.expectedTag));
              console.log('Actual tag:', OpCodes.BytesToHex8(result.tag));
            }
            allPassed = false;
          }
          
          // Test decryption
          if (ciphertextMatch && tagMatch) {
            const decrypted = this.decryptAEAD(test.key, test.iv, test.aad, result.ciphertext, result.tag);
            const decryptMatch = OpCodes.SecureCompare(decrypted, test.plaintext);
            
            if (!decryptMatch) {
              console.log(`Test ${i + 1} decryption: FAIL`);
              allPassed = false;
            }
          }
          
        } catch (error) {
          console.log(`Test ${i + 1}: ERROR - ${error.message}`);
          allPassed = false;
        }
      }
      
      // Demonstrate lightweight properties
      console.log('\nACORN Lightweight Demonstration:');
      this.Init();
      this.KeySetup(OpCodes.Hex8ToBytes("0123456789ABCDEF0123456789ABCDEF"));
      
      const iv = OpCodes.Hex8ToBytes("FEDCBA9876543210FEDCBA9876543210");
      const aad = OpCodes.AsciiToBytes("IoT Device");
      const plaintext = OpCodes.AsciiToBytes("Sensor data: 25.3°C");
      
      const encrypted = this.encryptAEAD(this.key, iv, aad, plaintext);
      console.log('Plaintext:', OpCodes.BytesToString(plaintext));
      console.log('AAD:', OpCodes.BytesToString(aad));
      console.log('Ciphertext:', OpCodes.BytesToHex8(encrypted.ciphertext));
      console.log('Tag:', OpCodes.BytesToHex8(encrypted.tag));
      
      const decrypted = this.decryptAEAD(this.key, iv, aad, encrypted.ciphertext, encrypted.tag);
      const demoSuccess = OpCodes.SecureCompare(decrypted, plaintext);
      console.log('Decrypted:', OpCodes.BytesToString(decrypted));
      console.log('Demo test:', demoSuccess ? 'PASS' : 'FAIL');
      
      return {
        algorithm: 'ACORN-128',
        allTestsPassed: allPassed && demoSuccess,
        testCount: this.tests.length,
        stateSize: this.STATE_SIZE,
        keySize: this.KEY_SIZE,
        tagSize: this.TAG_SIZE,
        notes: 'CAESAR competition winner for lightweight authenticated encryption'
      };
    }
  };
  
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(ACORN);
  }
  
  // Legacy registration
  if (typeof global.RegisterAlgorithm === 'function') {
    global.RegisterAlgorithm(ACORN);
  }
  
  // Auto-register with Cipher system if available
  if (global.Cipher) {
    global.Cipher.Add(ACORN);
  }
  
  // Export to global scope
  global.ACORN = ACORN;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ACORN;
  }
  
})(typeof global !== 'undefined' ? global : window);
