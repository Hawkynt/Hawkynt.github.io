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

class Phelix extends StreamCipherAlgorithm {
  constructor() {
    super();

    this.name = "Phelix";
    this.description = "Educational implementation inspired by Phelix stream cipher. eSTREAM candidate designed for high-speed authenticated encryption using XOR, addition mod 2^32, and rotation operations.";
    this.inventor = "Doug Whiting, Bruce Schneier, Stefan Lucks, Frédéric Muller";
    this.year = 2004;
    this.category = CategoryType.STREAM;
    this.subCategory = "Stream Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    this.SupportedKeySizes = [new KeySize(32, 32, 1)];
    this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

    this.documentation = [
      new LinkItem("Phelix Wikipedia", "https://en.wikipedia.org/wiki/Phelix"),
      new LinkItem("eSTREAM Project", "https://www.ecrypt.eu.org/stream/"),
      new LinkItem("Schneier on Security", "https://www.schneier.com/academic/archives/2005/01/phelix.html")
    ];

    this.vulnerabilities = [
      new Vulnerability("Key Recovery Attack", "Wu and Preneel showed key recovery with 2^37 operations when nonces are reused"),
      new Vulnerability("Educational Implementation", "Simplified educational implementation - use only for learning")
    ];

    this.tests = [
      {
        text: "Phelix Educational Test Vector 1 (Empty)",
        uri: "Educational test case",
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        input: OpCodes.Hex8ToBytes(""),
        expected: OpCodes.Hex8ToBytes("")
      },
      {
        text: "Phelix Educational Test Vector 2 (Single Byte)",
        uri: "Educational test case",
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        input: OpCodes.Hex8ToBytes("00"),
        expected: OpCodes.Hex8ToBytes("A2")
      },
      {
        text: "Phelix Educational Test Vector 3 (Two Bytes)",
        uri: "Educational test case",
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        input: OpCodes.Hex8ToBytes("0001"),
        expected: OpCodes.Hex8ToBytes("A2BA")
      },
      {
        text: "Phelix Educational Test Vector 4 (Block)",
        uri: "Educational test case",
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        expected: OpCodes.Hex8ToBytes("A2BA9B5E4109CEA6B815E83E3D807D61")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new PhelixInstance(this, isInverse);
  }
}

class PhelixInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._nonce = new Array(16).fill(0);
    this.STATE_SIZE = 8;
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

  set nonce(nonceBytes) {
    if (!nonceBytes || nonceBytes.length !== 16) {
      this._nonce = new Array(16).fill(0);
    } else {
      this._nonce = [...nonceBytes];
    }
  }

  get nonce() { return this._nonce ? [...this._nonce] : null; }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this._key) throw new Error("Key not set");
    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this._key) throw new Error("Key not set");

    // Handle empty input (valid for stream ciphers)
    if (this.inputBuffer.length === 0) {
      return [];
    }

    const output = this._educationalPhelix(this._key, this._nonce || new Array(16).fill(0), this.inputBuffer);
    this.inputBuffer = [];
    return output;
  }

  _educationalPhelix(key, nonce, data) {
    // Initialize state with key and nonce
    const state = new Array(this.STATE_SIZE);

    // Load key (32 bytes = 8 words)
    for (let i = 0; i < 8; i++) {
      state[i] = OpCodes.Pack32LE(
        key[i * 4], key[i * 4 + 1], key[i * 4 + 2], key[i * 4 + 3]
      );
    }

    // Mix in nonce (16 bytes = 4 words)
    for (let i = 0; i < 4; i++) {
      const nonceWord = OpCodes.Pack32LE(
        nonce[i * 4], nonce[i * 4 + 1], nonce[i * 4 + 2], nonce[i * 4 + 3]
      );
      state[i] = (state[i] + nonceWord) >>> 0;
      state[i + 4] ^= nonceWord;
    }

    // Initialize with rounds (Phelix-inspired mixing)
    for (let round = 0; round < 16; round++) {
      for (let i = 0; i < this.STATE_SIZE; i++) {
        const j = (i + 1) % this.STATE_SIZE;
        const k = (i + 3) % this.STATE_SIZE;

        // Addition mod 2^32, XOR, and rotation (core Phelix operations)
        state[i] = (state[i] + state[j]) >>> 0;
        state[i] ^= OpCodes.RotL32(state[k], 7);
        state[i] = OpCodes.RotL32(state[i], 13);
        state[i] = (state[i] + 0x9E3779B9) >>> 0;  // Golden ratio constant
      }
    }

    // Generate keystream and encrypt data
    const output = [];
    const keystreamBytes = [];

    // Extract initial keystream
    for (let i = 0; i < 8; i++) {
      const bytes = OpCodes.Unpack32LE(state[i]);
      keystreamBytes.push(...bytes);
    }

    // Process data
    for (let i = 0; i < data.length; i++) {
      // Refresh keystream when needed
      if (i > 0 && (i % 32) === 0) {
        // Update state for more keystream
        for (let j = 0; j < this.STATE_SIZE; j++) {
          const next = (j + 1) % this.STATE_SIZE;
          const prev = (j + this.STATE_SIZE - 1) % this.STATE_SIZE;

          state[j] = (state[j] + state[next]) >>> 0;
          state[j] ^= OpCodes.RotL32(state[prev], 11);
          state[j] = OpCodes.RotL32(state[j], 17);
        }

        // Extract new keystream
        keystreamBytes.length = 0;
        for (let j = 0; j < 8; j++) {
          const bytes = OpCodes.Unpack32LE(state[j]);
          keystreamBytes.push(...bytes);
        }
      }

      output.push(data[i] ^ keystreamBytes[i % keystreamBytes.length]);
    }

    return output;
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new Phelix();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Phelix, PhelixInstance };
}));
