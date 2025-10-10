(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

class Pomaranch extends StreamCipherAlgorithm {
  constructor() {
    super();

    this.name = "Pomaranch";
    this.description = "Educational implementation inspired by Pomaranch eSTREAM Phase 3 finalist. Uses nine linear feedback shift registers with nonlinear combining function.";
    this.inventor = "Carlos Cid, Gaëtan Leurent";
    this.year = 2005;
    this.category = CategoryType.STREAM;
    this.subCategory = "Stream Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.GB;

    this.SupportedKeySizes = [new KeySize(16, 32, 16)];
    this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

    this.documentation = [
      new LinkItem("eSTREAM Pomaranch Specification", "https://www.ecrypt.eu.org/stream/p3ciphers/pomaranch/pomaranch_p3.pdf"),
      new LinkItem("eSTREAM Portfolio", "https://www.ecrypt.eu.org/stream/")
    ];

    this.vulnerabilities = [
      new Vulnerability("Time-Memory-Data Tradeoff", "Vulnerable to TMDT attacks and various algebraic attacks on LFSR structure"),
      new Vulnerability("Educational Implementation", "Simplified educational implementation - use only for learning")
    ];

    this.tests = [
      {
        text: "Pomaranch Educational Test Vector 1 (Empty)",
        uri: "Educational test case",
        key: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
        iv: [0,1,2,3,4,5,6,7],
        input: [],
        expected: []
      },
      {
        text: "Pomaranch Educational Test Vector 2 (Single Byte)",
        uri: "Educational test case",
        key: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
        iv: [0,1,2,3,4,5,6,7],
        input: [0],
        expected: [173]
      },
      {
        text: "Pomaranch Educational Test Vector 3 (Two Bytes)",
        uri: "Educational test case",
        key: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
        iv: [0,1,2,3,4,5,6,7],
        input: [0,1],
        expected: [173, 58]
      },
      {
        text: "Pomaranch Educational Test Vector 4 (Block)",
        uri: "Educational test case",
        key: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
        iv: [0,1,2,3,4,5,6,7],
        input: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
        expected: [173, 58, 14, 55, 30, 95, 59, 145, 24, 158, 210, 114, 225, 200, 69, 159]
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new PomaranchInstance(this, isInverse);
  }
}

class PomaranchInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._iv = new Array(8).fill(0);
    this.LFSR_COUNT = 9;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      return;
    }

    const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
      keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
    );

    if (!isValidSize) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
    }

    this._key = [...keyBytes];
  }

  get key() { return this._key ? [...this._key] : null; }

  set iv(ivBytes) {
    if (!ivBytes || ivBytes.length !== 8) {
      this._iv = new Array(8).fill(0);
    } else {
      this._iv = [...ivBytes];
    }
  }

  get iv() { return this._iv ? [...this._iv] : null; }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this._key) throw new Error("Key not set");
    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this._key) throw new Error("Key not set");

    // Handle empty input
    if (this.inputBuffer.length === 0) {
      return [];
    }

    const output = this._educationalPomaranch(this._key, this._iv || new Array(8).fill(0), this.inputBuffer);
    this.inputBuffer = [];
    return output;
  }

  _educationalPomaranch(key, iv, data) {
    // Initialize 9 LFSR states
    const lfsrs = new Array(this.LFSR_COUNT);

    // Initialize each LFSR with key and IV material
    for (let i = 0; i < this.LFSR_COUNT; i++) {
      // Use different parts of key for each LFSR
      const keyOffset = (i * 2) % key.length;
      lfsrs[i] = OpCodes.Pack32LE(
        key[keyOffset], key[(keyOffset + 1) % key.length],
        key[(keyOffset + 2) % key.length], key[(keyOffset + 3) % key.length]
      );

      // Mix in IV for the first few LFSRs
      if (iv && iv.length >= 8 && i < 4) {
        const ivOffset = i * 2;
        lfsrs[i] ^= OpCodes.Pack32LE(
          iv[ivOffset], iv[ivOffset + 1], 0, 0
        );
      }

      // Ensure non-zero state
      if (lfsrs[i] === 0) {
        lfsrs[i] = 0x12345678 + i;
      }
    }

    // Run initialization rounds
    for (let round = 0; round < 32; round++) {
      for (let i = 0; i < this.LFSR_COUNT; i++) {
        // LFSR feedback
        const feedback = ((lfsrs[i] >>> 31) ^ (lfsrs[i] >>> 6) ^ (lfsrs[i] >>> 4) ^ (lfsrs[i] >>> 1)) & 1;
        lfsrs[i] = ((lfsrs[i] << 1) | feedback) >>> 0;
      }
    }

    // Generate keystream and encrypt data
    const output = [];

    for (let i = 0; i < data.length; i++) {
      // Clock all LFSRs
      for (let j = 0; j < this.LFSR_COUNT; j++) {
        const feedback = ((lfsrs[j] >>> 31) ^ (lfsrs[j] >>> 6) ^ (lfsrs[j] >>> 4) ^ (lfsrs[j] >>> 1)) & 1;
        lfsrs[j] = ((lfsrs[j] << 1) | feedback) >>> 0;
      }

      // Nonlinear combining function (majority + XOR)
      let keystreamByte = 0;
      for (let bit = 0; bit < 8; bit++) {
        let majority = 0;

        // Count bits from all LFSRs at current position
        for (let j = 0; j < this.LFSR_COUNT; j++) {
          if ((lfsrs[j] >>> bit) & 1) {
            majority++;
          }
        }

        // Majority function
        if (majority >= 5) {
          keystreamByte |= (1 << bit);
        }
      }

      // Additional mixing with position and key material
      keystreamByte ^= (key[i % key.length] + i) & 0xFF;
      keystreamByte ^= (lfsrs[i % this.LFSR_COUNT] >>> ((i % 4) * 8)) & 0xFF;

      output.push(data[i] ^ (keystreamByte & 0xFF));
    }

    return output;
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new Pomaranch();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Pomaranch, PomaranchInstance };
}));
