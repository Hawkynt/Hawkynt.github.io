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

class HCAlgorithm extends StreamCipherAlgorithm {
  constructor(variant = '128') {
    super();

    const config = this._getVariantConfig(variant);

    this.variant = variant;
    this.name = `HC-${variant}`;
    this.description = config.description;
    this.inventor = "Hongjun Wu";
    this.year = 2004;
    this.category = CategoryType.STREAM;
    this.subCategory = "Stream Cipher";
    this.securityStatus = null;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.CN;

    this.SupportedKeySizes = config.keySizes;
    this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

    this.documentation = [
      new LinkItem(`eSTREAM HC-${variant} Specification`, config.specUrl),
      new LinkItem(`HC-${variant} Wikipedia`, config.wikiUrl),
      new LinkItem("eSTREAM Portfolio", "https://www.ecrypt.eu.org/stream/")
    ];

    this.vulnerabilities = config.vulnerabilities;
    this.tests = config.tests;

    // Variant-specific configuration
    this.TABLE_SIZE = config.tableSize;
    this.INIT_STEPS = config.initSteps;
    this.HAS_XY_ARRAYS = config.hasXYArrays;
    this.IV_SIZE = config.ivSize;
    this.KEY_WORDS = config.keyWords;
    this.W_SIZE = config.wSize;
  }

  _getVariantConfig(variant) {
    const configs = {
      '128': {
        description: "eSTREAM Profile 1 finalist with table-based design. Uses two 512-word tables with complex update functions for high-speed software encryption. Designed by Hongjun Wu.",
        specUrl: "https://www.ecrypt.eu.org/stream/p3ciphers/hc/hc128_p3.pdf",
        wikiUrl: "https://en.wikipedia.org/wiki/HC-128",
        tableSize: 512,
        initSteps: 1024,
        hasXYArrays: true,
        ivSize: 16,
        keyWords: 4,
        wSize: 1280,
        keySizes: [new KeySize(16, 16, 1)],
        vulnerabilities: [
          new Vulnerability("Weak Key Classes", "Theoretical weak key classes identified, though not practical")
        ],
        tests: [
          {
            text: "HC-128 eSTREAM Test Vector",
            uri: "https://github.com/neoeinstein/bouncycastle/blob/master/crypto/test/data/hc256/hc128/ecrypt_HC-128.txt",
            key: OpCodes.Hex8ToBytes("80000000000000000000000000000000"),
            iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
            input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
            expected: OpCodes.Hex8ToBytes("378602B98F32A74847515654AE0DE7ED8F72BC34776A065103E51595521FFE47")
          }
        ]
      },
      '256': {
        description: "eSTREAM Phase 3 finalist with large table-based design. Uses two 1024-word tables with nonlinear update functions for high-speed software encryption. Designed by Hongjun Wu.",
        specUrl: "https://www.ecrypt.eu.org/stream/p3ciphers/hc/hc256_p3.pdf",
        wikiUrl: "https://en.wikipedia.org/wiki/HC-256",
        tableSize: 1024,
        initSteps: 4096,
        hasXYArrays: false,
        ivSize: 32,
        keyWords: 8,
        wSize: 2560,
        keySizes: [new KeySize(32, 32, 1)],
        vulnerabilities: [
          new Vulnerability("Distinguishing Attack", "2^255 complexity distinguishing attack (impractical)")
        ],
        tests: [
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
        ]
      }
    };
    return configs[variant] || configs['128'];
  }

  CreateInstance(isInverse = false) {
    return new HCInstance(this, isInverse);
  }
}

class HCInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._iv = null;

    // HC state
    this.P = null;
    this.Q = null;
    this.counter = 0;
    this.keystreamBuffer = [];
    this.keystreamPosition = 0;

    // Variant-specific state (only for HC-128)
    if (algorithm.HAS_XY_ARRAYS) {
      this.X = null;
      this.Y = null;
    }

    // Constants from algorithm
    this.TABLE_SIZE = algorithm.TABLE_SIZE;
    this.INIT_STEPS = algorithm.INIT_STEPS;
    this.HAS_XY_ARRAYS = algorithm.HAS_XY_ARRAYS;
    this.IV_SIZE = algorithm.IV_SIZE;
    this.KEY_WORDS = algorithm.KEY_WORDS;
    this.W_SIZE = algorithm.W_SIZE;
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
    if (!ivBytes || ivBytes.length !== this.IV_SIZE) {
      this._iv = new Array(this.IV_SIZE).fill(0);
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

    if (this.HAS_XY_ARRAYS) {
      this._initializeHC128();
    } else {
      this._initializeHC256();
    }
  }

  /**
   * Initialize HC-128 (uses X and Y arrays)
   */
  _initializeHC128() {
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
   * Initialize HC-256 (no X/Y arrays)
   */
  _initializeHC256() {
    // Initialize tables
    this.P = new Array(this.TABLE_SIZE);
    this.Q = new Array(this.TABLE_SIZE);

    // Convert key and IV to 32-bit words (little-endian)
    const K = new Array(8);
    const IV = new Array(8);

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
    return (OpCodes.RotR32(x, 7) ^ OpCodes.RotR32(x, 18) ^ (x >>> 3)) >>> 0;
  }

  /**
   * f2 function for key expansion
   */
  _f2(x) {
    return (OpCodes.RotR32(x, 17) ^ OpCodes.RotR32(x, 19) ^ (x >>> 10)) >>> 0;
  }

  /**
   * h1 function for P table lookups (Q table) - HC-128 variant
   */
  _h1_128(x) {
    const a = x & 0xFF;
    const c = (x >>> 16) & 0xFF;
    return (this.Q[a] + this.Q[256 + c]) >>> 0;
  }

  /**
   * h2 function for Q table lookups (P table) - HC-128 variant
   */
  _h2_128(x) {
    const a = x & 0xFF;
    const c = (x >>> 16) & 0xFF;
    return (this.P[a] + this.P[256 + c]) >>> 0;
  }

  /**
   * h1 function for P table (uses Q table lookups) - HC-256 variant
   */
  _h1_256(x) {
    const a = x & 0xFF;
    const b = (x >>> 8) & 0xFF;
    const c = (x >>> 16) & 0xFF;
    const d = (x >>> 24) & 0xFF;
    return (this.Q[a] + this.Q[256 + b] + this.Q[512 + c] + this.Q[768 + d]) >>> 0;
  }

  /**
   * h2 function for Q table (uses P table lookups) - HC-256 variant
   */
  _h2_256(x) {
    const a = x & 0xFF;
    const b = (x >>> 8) & 0xFF;
    const c = (x >>> 16) & 0xFF;
    const d = (x >>> 24) & 0xFF;
    return (this.P[a] + this.P[256 + b] + this.P[512 + c] + this.P[768 + d]) >>> 0;
  }

  /**
   * Setup update function (16 steps without keystream output) - HC-128 only
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
        const tem3 = this._h1_128(this.X[(i + 4) & 0xF]);

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
        const tem3 = this._h2_128(this.Y[(i + 4) & 0xF]);

        this.Q[j & 0x1FF] = (this.Q[j & 0x1FF] + tem2 + (tem0 ^ tem1)) >>> 0;
        this.Q[j & 0x1FF] = (this.Q[j & 0x1FF] ^ tem3) >>> 0;
        this.Y[i & 0xF] = this.Q[j & 0x1FF];
      }
    }
  }

  /**
   * Generate keystream (16 steps with output) - HC-128 only
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
        const tem3 = this._h1_128(this.X[(i + 4) & 0xF]);

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
        const tem3 = this._h2_128(this.Y[(i + 4) & 0xF]);

        this.Q[j & 0x1FF] = (this.Q[j & 0x1FF] + tem2 + (tem0 ^ tem1)) >>> 0;
        this.Y[i & 0xF] = this.Q[j & 0x1FF];
        keystream[i] = (tem3 ^ this.Q[j & 0x1FF]) >>> 0;
      }
    }
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

      s = (this._h1_256(this.P[j12]) ^ this.P[j]) >>> 0;
    } else {
      // Update Q table
      const j3 = (j - 3) & 0x3FF;
      const j10 = (j - 10) & 0x3FF;
      const j12 = (j - 12) & 0x3FF;
      const j1023 = (j - 1023) & 0x3FF;

      this.Q[j] = (this.Q[j] + this.Q[j10] +
                   (OpCodes.RotR32(this.Q[j3], 10) ^ OpCodes.RotR32(this.Q[j1023], 23)) +
                   this.P[(this.Q[j3] ^ this.Q[j1023]) & 0x3FF]) >>> 0;

      s = (this._h2_256(this.Q[j12]) ^ this.Q[j]) >>> 0;
    }

    this.counter = (this.counter + 1) % 2048; // Wrap at 2048
    return s;
  }

  /**
   * Generate a block of keystream
   */
  _generateBlock() {
    if (this.HAS_XY_ARRAYS) {
      // HC-128: Generate 64 bytes (16 words)
      const keystreamWords = new Array(16);
      this._generateKeystream16(keystreamWords);

      const keystream = [];
      for (let i = 0; i < 16; i++) {
        const bytes = OpCodes.Unpack32LE(keystreamWords[i]);
        keystream.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }

      return keystream;
    } else {
      // HC-256: Generate 16 bytes (4 words)
      const keystream = [];

      for (let i = 0; i < 4; i++) {
        const word = this._generateWord();
        const bytes = OpCodes.Unpack32LE(word);
        keystream.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }

      return keystream;
    }
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

  // Register both variants
  const hc128 = new HCAlgorithm('128');
  const hc256 = new HCAlgorithm('256');

  if (!AlgorithmFramework.Find(hc128.name)) {
    RegisterAlgorithm(hc128);
  }

  if (!AlgorithmFramework.Find(hc256.name)) {
    RegisterAlgorithm(hc256);
  }

  // ===== EXPORTS =====

  return { HCAlgorithm, HCInstance };
}));
