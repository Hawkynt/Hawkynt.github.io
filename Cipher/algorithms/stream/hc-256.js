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

class HC256 extends StreamCipherAlgorithm {
  constructor() {
    super();

    this.name = "HC-256";
    this.description = "eSTREAM Phase 3 finalist with large table-based design. Uses two 1024-word tables with nonlinear update functions for high-speed software encryption. Designed by Hongjun Wu.";
    this.inventor = "Hongjun Wu";
    this.year = 2004;
    this.category = CategoryType.STREAM;
    this.subCategory = "Stream Cipher";
    this.securityStatus = null;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.CN;

    this.SupportedKeySizes = [new KeySize(32, 32, 1)];
    this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

    this.documentation = [
      new LinkItem("eSTREAM HC-256 Specification", "https://www.ecrypt.eu.org/stream/p3ciphers/hc/hc256_p3.pdf"),
      new LinkItem("HC-256 Wikipedia", "https://en.wikipedia.org/wiki/HC-256"),
      new LinkItem("eSTREAM Portfolio", "https://www.ecrypt.eu.org/stream/")
    ];

    this.vulnerabilities = [
      new Vulnerability("Distinguishing Attack", "2^255 complexity distinguishing attack (impractical)")
    ];

    this.tests = [
      {
        text: "HC-256 Test Vector - Zero Key/IV",
        uri: "eSTREAM verified implementation",
        key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        iv: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("5B078985D8F6F30D42C5C02FA6B6795153F06534801F89F24E74248B720B4818")
      },
      {
        text: "HC-256 Test Vector - Non-zero Key/IV",
        uri: "eSTREAM verified implementation",
        key: OpCodes.Hex8ToBytes("0053A6F94C9FF24598EB3E91E4378ADD3083D6297CCF2275C81B6EC11467BA0D"),
        iv: OpCodes.Hex8ToBytes("0D74DB42A91077DE45AC137AE148AF16B9C6B1F8E9C1A86A6B17F1B9A6C3C8F7"),
        input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("2EC868D5779C5F522A5E2A9530A675EC359DD8D08845F57064562FE0C5927EA4")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new HC256Instance(this, isInverse);
  }
}

class HC256Instance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._iv = null;

    // HC-256 state
    this.P = null;              // P table (1024 32-bit words)
    this.Q = null;              // Q table (1024 32-bit words)
    this.counter = 0;           // Step counter
    this.keystreamBuffer = [];
    this.keystreamPosition = 0;

    // Constants
    this.TABLE_SIZE = 1024;
    this.INIT_STEPS = 4096;
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
    if (!ivBytes || ivBytes.length !== 32) {
      this._iv = new Array(32).fill(0);
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

    // Convert key and IV to 32-bit words (little-endian)
    const K = [];
    const IV = [];

    for (let i = 0; i < 8; i++) {
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

    // Initialize W array for key expansion (2560 words)
    const W = new Array(2560);

    // Load key and IV into W
    for (let i = 0; i < 8; i++) {
      W[i] = K[i];
      W[i + 8] = IV[i];
    }

    // Key expansion using f1 and f2 functions
    for (let i = 16; i < 2560; i++) {
      W[i] = (this._f2(W[i - 2]) + W[i - 7] + this._f1(W[i - 15]) + W[i - 16] + i) >>> 0;
    }

    // Initialize P and Q tables from W
    for (let i = 0; i < this.TABLE_SIZE; i++) {
      this.P[i] = W[i + 512];
      this.Q[i] = W[i + 1536];
    }

    // Run cipher for 4096 steps to initialize tables
    this.counter = 0;
    for (let i = 0; i < this.INIT_STEPS; i++) {
      this._generateWord();
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
    return OpCodes.RotR32(x, 7) ^ OpCodes.RotR32(x, 18) ^ (x >>> 3);
  }

  /**
   * f2 function for key expansion
   */
  _f2(x) {
    return OpCodes.RotR32(x, 17) ^ OpCodes.RotR32(x, 19) ^ (x >>> 10);
  }

  /**
   * h1 function for P table (uses Q table lookups)
   */
  _h1(x) {
    const a = x & 0xFF;
    const b = (x >>> 8) & 0xFF;
    const c = (x >>> 16) & 0xFF;
    const d = (x >>> 24) & 0xFF;
    return (this.Q[a] + this.Q[256 + b] + this.Q[512 + c] + this.Q[768 + d]) >>> 0;
  }

  /**
   * h2 function for Q table (uses P table lookups)
   */
  _h2(x) {
    const a = x & 0xFF;
    const b = (x >>> 8) & 0xFF;
    const c = (x >>> 16) & 0xFF;
    const d = (x >>> 24) & 0xFF;
    return (this.P[a] + this.P[256 + b] + this.P[512 + c] + this.P[768 + d]) >>> 0;
  }

  /**
   * Generate one 32-bit keystream word following official HC-256 specification
   */
  _generateWord() {
    const j = this.counter & 0x3FF; // 1024 mask for table index
    let s;

    if (this.counter < 1024) {
      // Update P table
      const j3 = (j - 3) & 0x3FF;
      const j10 = (j - 10) & 0x3FF;
      const j12 = (j - 12) & 0x3FF;
      const j1023 = (j - 1023) & 0x3FF;

      this.P[j] = (this.P[j] + this.P[j10] +
                   (OpCodes.RotR32(this.P[j3], 10) ^ OpCodes.RotR32(this.P[j1023], 23)) +
                   this.Q[(this.P[j3] ^ this.P[j1023]) & 0x3FF]) >>> 0;

      s = (this._h1(this.P[j12]) ^ this.P[j]) >>> 0;
    } else {
      // Update Q table
      const j3 = (j - 3) & 0x3FF;
      const j10 = (j - 10) & 0x3FF;
      const j12 = (j - 12) & 0x3FF;
      const j1023 = (j - 1023) & 0x3FF;

      this.Q[j] = (this.Q[j] + this.Q[j10] +
                   (OpCodes.RotR32(this.Q[j3], 10) ^ OpCodes.RotR32(this.Q[j1023], 23)) +
                   this.P[(this.Q[j3] ^ this.Q[j1023]) & 0x3FF]) >>> 0;

      s = (this._h2(this.Q[j12]) ^ this.Q[j]) >>> 0;
    }

    this.counter = (this.counter + 1) % 2048; // Wrap at 2048
    return s;
  }

  /**
   * Generate a block of keystream (16 bytes)
   */
  _generateBlock() {
    const keystream = [];

    // Generate 4 32-bit words (16 bytes total)
    for (let i = 0; i < 4; i++) {
      const word = this._generateWord();
      const bytes = OpCodes.Unpack32LE(word);
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

  const algorithmInstance = new HC256();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { HC256, HC256Instance };
}));
