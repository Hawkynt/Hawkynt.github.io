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

class HC128 extends StreamCipherAlgorithm {
  constructor() {
    super();

    this.name = "HC-128";
    this.description = "eSTREAM Profile 1 finalist with table-based design. Uses two 512-word tables with complex update functions for high-speed software encryption. Designed by Hongjun Wu.";
    this.inventor = "Hongjun Wu";
    this.year = 2004;
    this.category = CategoryType.STREAM;
    this.subCategory = "Stream Cipher";
    this.securityStatus = null;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.CN;

    this.SupportedKeySizes = [new KeySize(16, 16, 1)];
    this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

    this.documentation = [
      new LinkItem("eSTREAM HC-128 Specification", "https://www.ecrypt.eu.org/stream/p3ciphers/hc/hc128_p3.pdf"),
      new LinkItem("HC-128 Wikipedia", "https://en.wikipedia.org/wiki/HC-128"),
      new LinkItem("eSTREAM Portfolio", "https://www.ecrypt.eu.org/stream/")
    ];

    this.vulnerabilities = [
      new Vulnerability("Weak Key Classes", "Theoretical weak key classes identified, though not practical")
    ];

    this.tests = [
      {
        text: "HC-128 eSTREAM Test Vector",
        uri: "https://github.com/neoeinstein/bouncycastle/blob/master/crypto/test/data/hc256/hc128/ecrypt_HC-128.txt",
        key: OpCodes.Hex8ToBytes("80000000000000000000000000000000"),
        iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("378602B98F32A74847515654AE0DE7ED8F72BC34776A065103E51595521FFE47")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new HC128Instance(this, isInverse);
  }
}

class HC128Instance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._iv = null;

    // HC-128 state
    this.P = null;              // P table (512 32-bit words)
    this.Q = null;              // Q table (512 32-bit words)
    this.X = null;              // X array (16 words)
    this.Y = null;              // Y array (16 words)
    this.counter = 0;           // Step counter
    this.keystreamBuffer = [];
    this.keystreamPosition = 0;

    // Constants
    this.TABLE_SIZE = 512;
    this.INIT_STEPS = 1024;
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
    if (this._iv) {
      this._initialize();
    }
  }

  get key() { return this._key ? [...this._key] : null; }

  set iv(ivBytes) {
    if (!ivBytes || ivBytes.length !== 16) {
      this._iv = new Array(16).fill(0);
    } else {
      this._iv = [...ivBytes];
    }

    if (this._key) {
      this._initialize();
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

    const output = [];
    for (let i = 0; i < this.inputBuffer.length; i++) {
      const keystreamByte = this._getNextKeystreamByte();
      output.push(this.inputBuffer[i] ^ keystreamByte);
    }

    this.inputBuffer = [];
    return output;
  }

  _initialize() {
    if (!this._key || !this._iv) return;

    // Initialize tables
    this.P = new Array(this.TABLE_SIZE);
    this.Q = new Array(this.TABLE_SIZE);
    this.X = new Array(16);
    this.Y = new Array(16);

    // Convert key and IV to 32-bit words (little-endian)
    const K = new Array(4);
    const IV = new Array(4);

    for (let i = 0; i < 4; i++) {
      K[i] = OpCodes.Pack32LE(
        this._key[i * 4],
        this._key[i * 4 + 1],
        this._key[i * 4 + 2],
        this._key[i * 4 + 3]
      ) >>> 0;

      IV[i] = OpCodes.Pack32LE(
        this._iv[i * 4],
        this._iv[i * 4 + 1],
        this._iv[i * 4 + 2],
        this._iv[i * 4 + 3]
      ) >>> 0;
    }

    // Initialize W array for key expansion
    const W = new Array(1280);

    // Load key and IV into first 16 positions of W
    for (let i = 0; i < 4; i++) {
      W[i] = K[i];
      W[i + 4] = K[i]; // Duplicate key
      W[i + 8] = IV[i];
      W[i + 12] = IV[i]; // Duplicate IV
    }

    // Expand to fill first 272 positions
    for (let i = 16; i < 272; i++) {
      W[i] = (this._f2(W[i - 2]) + W[i - 7] + this._f1(W[i - 15]) + W[i - 16] + i) >>> 0;
    }

    // Copy first 16 positions from positions 256-271
    for (let i = 0; i < 16; i++) {
      W[i] = W[256 + i];
    }

    // Continue expansion to fill 1024 positions
    for (let i = 16; i < 1024; i++) {
      W[i] = (this._f2(W[i - 2]) + W[i - 7] + this._f1(W[i - 15]) + W[i - 16] + 256 + i) >>> 0;
    }

    // Initialize P and Q tables from W
    for (let i = 0; i < this.TABLE_SIZE; i++) {
      this.P[i] = W[i];
      this.Q[i] = W[i + 512];
    }

    // Initialize X and Y arrays
    for (let i = 0; i < 16; i++) {
      this.X[i] = W[512 - 16 + i];
      this.Y[i] = W[1024 - 16 + i];
    }

    // Run setup for 1024 steps (64 iterations of 16 steps)
    this.counter = 0;
    for (let i = 0; i < 64; i++) {
      this._setupUpdate();
    }

    // Reset counter for keystream generation
    this.counter = 0;
    this.keystreamBuffer = [];
    this.keystreamPosition = 0;
  }

  /**
   * f1 function for key expansion
   */
  _f1(x) {
    return (OpCodes.RotR32(x, 7) ^ OpCodes.RotR32(x, 18) ^ (x >>> 3)) >>> 0;
  }

  /**
   * f2 function for key expansion
   */
  _f2(x) {
    return (OpCodes.RotR32(x, 17) ^ OpCodes.RotR32(x, 19) ^ (x >>> 10)) >>> 0;
  }

  /**
   * h1 function for P table lookups (Q table)
   */
  _h1(x) {
    const a = x & 0xFF;
    const c = (x >>> 16) & 0xFF;
    return (this.Q[a] + this.Q[256 + c]) >>> 0;
  }

  /**
   * h2 function for Q table lookups (P table)
   */
  _h2(x) {
    const a = x & 0xFF;
    const c = (x >>> 16) & 0xFF;
    return (this.P[a] + this.P[256 + c]) >>> 0;
  }

  /**
   * Setup update function (16 steps without keystream output)
   */
  _setupUpdate() {
    const cc = this.counter & 0x1FF;

    if (this.counter < 512) {
      this.counter = (this.counter + 16) & 0x3FF;
      for (let i = 0; i < 16; i++) {
        const j = (cc + i) & 0x1FF;
        const nextJ = (cc + i + 1) & 0x1FF;

        const tem2 = OpCodes.RotR32(this.X[(i + 6) & 0xF], 8);
        const tem0 = OpCodes.RotR32(this.P[nextJ], 23);
        const tem1 = OpCodes.RotR32(this.X[(i + 13) & 0xF], 10);
        const tem3 = this._h1(this.X[(i + 4) & 0xF]);

        this.P[j] = (this.P[j] + tem2 + (tem0 ^ tem1)) >>> 0;
        this.P[j] = (this.P[j] ^ tem3) >>> 0;
        this.X[i & 0xF] = this.P[j];
      }
    } else {
      this.counter = (this.counter + 16) & 0x3FF;
      for (let i = 0; i < 16; i++) {
        const j = (512 + cc + i) & 0x3FF;
        const nextJ = (512 + cc + i + 1) & 0x3FF;

        const tem2 = OpCodes.RotL32(this.Y[(i + 6) & 0xF], 8);
        const tem0 = OpCodes.RotL32(this.Q[nextJ & 0x1FF], 23);
        const tem1 = OpCodes.RotL32(this.Y[(i + 13) & 0xF], 10);
        const tem3 = this._h2(this.Y[(i + 4) & 0xF]);

        this.Q[j & 0x1FF] = (this.Q[j & 0x1FF] + tem2 + (tem0 ^ tem1)) >>> 0;
        this.Q[j & 0x1FF] = (this.Q[j & 0x1FF] ^ tem3) >>> 0;
        this.Y[i & 0xF] = this.Q[j & 0x1FF];
      }
    }
  }

  /**
   * Generate keystream (16 steps with output)
   */
  _generateKeystream16(keystream) {
    const cc = this.counter & 0x1FF;

    if (this.counter < 512) {
      this.counter = (this.counter + 16) & 0x3FF;
      for (let i = 0; i < 16; i++) {
        const j = (cc + i) & 0x1FF;
        const nextJ = (cc + i + 1) & 0x1FF;

        const tem2 = OpCodes.RotR32(this.X[(i + 6) & 0xF], 8);
        const tem0 = OpCodes.RotR32(this.P[nextJ], 23);
        const tem1 = OpCodes.RotR32(this.X[(i + 13) & 0xF], 10);
        const tem3 = this._h1(this.X[(i + 4) & 0xF]);

        this.P[j] = (this.P[j] + tem2 + (tem0 ^ tem1)) >>> 0;
        this.X[i & 0xF] = this.P[j];
        keystream[i] = (tem3 ^ this.P[j]) >>> 0;
      }
    } else {
      this.counter = (this.counter + 16) & 0x3FF;
      for (let i = 0; i < 16; i++) {
        const j = (512 + cc + i) & 0x3FF;
        const nextJ = (512 + cc + i + 1) & 0x3FF;

        const tem2 = OpCodes.RotL32(this.Y[(i + 6) & 0xF], 8);
        const tem0 = OpCodes.RotL32(this.Q[nextJ & 0x1FF], 23);
        const tem1 = OpCodes.RotL32(this.Y[(i + 13) & 0xF], 10);
        const tem3 = this._h2(this.Y[(i + 4) & 0xF]);

        this.Q[j & 0x1FF] = (this.Q[j & 0x1FF] + tem2 + (tem0 ^ tem1)) >>> 0;
        this.Y[i & 0xF] = this.Q[j & 0x1FF];
        keystream[i] = (tem3 ^ this.Q[j & 0x1FF]) >>> 0;
      }
    }
  }

  /**
   * Generate a block of keystream (64 bytes)
   */
  _generateBlock() {
    const keystreamWords = new Array(16);
    this._generateKeystream16(keystreamWords);

    const keystream = [];
    for (let i = 0; i < 16; i++) {
      const bytes = OpCodes.Unpack32LE(keystreamWords[i]);
      keystream.push(bytes[0], bytes[1], bytes[2], bytes[3]);
    }

    return keystream;
  }

  /**
   * Get next keystream byte
   */
  _getNextKeystreamByte() {
    // Check if we need to generate a new block
    if (this.keystreamPosition >= this.keystreamBuffer.length) {
      this.keystreamBuffer = this._generateBlock();
      this.keystreamPosition = 0;
    }

    return this.keystreamBuffer[this.keystreamPosition++];
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new HC128();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { HC128, HC128Instance };
}));
