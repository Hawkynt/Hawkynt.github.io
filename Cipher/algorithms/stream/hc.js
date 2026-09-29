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
    this.name = "HC-" + variant;
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
      new LinkItem("eSTREAM HC-" + variant + " Specification", config.specUrl),
      new LinkItem("HC-" + variant + " Wikipedia", config.wikiUrl),
      new LinkItem("eSTREAM Portfolio", "https://www.ecrypt.eu.org/stream/")
    ];

    this.references = [
      new LinkItem("Hongjun Wu HC-" + variant + " Reference Implementation", config.refUrl),
      new LinkItem("Crypto++ HC-" + variant + " Implementation", config.refLibUrl)
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
        refUrl: "https://personal.ntu.edu.sg/wuhj/research/hc/hc128_ref.h",
        refLibUrl: "https://github.com/weidai11/cryptopp/blob/master/hc128.h",
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
        refUrl: "https://personal.ntu.edu.sg/wuhj/research/hc/hc256_ref.h",
        refLibUrl: "https://github.com/weidai11/cryptopp/blob/master/hc256.h",
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
          },
          {
            text: "DarkCrypt keystream, incremental key",
            uri: "https://totalcmd.net/plugring/darkcrypttc.html",
            key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
            iv: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
            input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
            expected: OpCodes.Hex8ToBytes("7cb997d6e1b46dd7c0a9629b441c377114d6c18f230291fa7ef0b039aedcc9aaa4ae05ba13f3931e3f8373aa320a8bcf28e825b2084d0fa486be52c92c3c6f1487f9af5c886705dcbd33d08c62e59c814a719c6b0372f44948d5130aaf20289bc3dc704d2ffa09ce7989d5afc977695afa6c82dd92a9a01cdc5de373127cc4e1")
          },
          {
            text: "DarkCrypt incremental plaintext, incremental key",
            uri: "https://totalcmd.net/plugring/darkcrypttc.html",
            key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
            iv: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
            input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
            expected: OpCodes.Hex8ToBytes("7cb895d5e5b16bd0c8a068904811397e04c7d39c371787ed66e9aa22b2c1d7b5848f279937d6b53917aa59811e27a5e018d917813c783993be8768f21001512b")
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
  /**
   * @param {HCAlgorithm} algorithm
   * @param {boolean} [isInverse=false]
   */
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    /** @type {KeySize[]} */
    this.keySizeList = algorithm.SupportedKeySizes;
    /** @type {boolean} */
    this.isInverse = isInverse;
    /** @type {uint8[]} */
    this.inputBuffer = [];
    /** @type {uint8[]|null} */
    this._key = null;
    /** @type {uint8[]|null} */
    this._iv = null;

    // HC state
    /** @type {uint32[]|null} */
    this.P = null;
    /** @type {uint32[]|null} */
    this.Q = null;
    /** @type {int32} */
    this._step = 0;
    /** @type {uint8[]} */
    this.keystreamBuffer = [];
    /** @type {int32} */
    this.keystreamPosition = 0;

    // Variant-specific state (only for HC-128)
    if (algorithm.HAS_XY_ARRAYS) {
      /** @type {uint32[]|null} */
      this.X = null;
      /** @type {uint32[]|null} */
      this.Y = null;
    }

    // Constants from algorithm
    /** @type {int32} */
    this.TABLE_SIZE = algorithm.TABLE_SIZE;
    /** @type {int32} */
    this.INIT_STEPS = algorithm.INIT_STEPS;
    /** @type {boolean} */
    this.HAS_XY_ARRAYS = algorithm.HAS_XY_ARRAYS;
    /** @type {int32} */
    this.IV_SIZE = algorithm.IV_SIZE;
    /** @type {int32} */
    this.KEY_WORDS = algorithm.KEY_WORDS;
    /** @type {int32} */
    this.W_SIZE = algorithm.W_SIZE;
  }

  /**
   * @param {uint8[]|null} keyBytes
   */
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      return;
    }

    const sizes = this.keySizeList;
    let isValidSize = false;
    for (let k = 0; k < sizes.length; k++) {
      const ks = sizes[k];
      if (keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize) {
        isValidSize = true;
        break;
      }
    }

    if (!isValidSize) {
      throw new Error("Invalid key size: " + keyBytes.length + " bytes");
    }

    this._key = [...keyBytes];
    if (this._iv) {
      this._initialize();
    }
  }

  /**
   * @returns {uint8[]|null}
   */
  get key() { return this._key ? [...this._key] : null; }

  /**
   * @param {uint8[]|null} ivBytes
   */
  set iv(ivBytes) {
    if (!ivBytes || ivBytes.length !== this.IV_SIZE) {
      this._iv = OpCodes.CreateArray(this.IV_SIZE, 0);
    } else {
      this._iv = [...ivBytes];
    }

    if (this._key) {
      this._initialize();
    }
  }

  /**
   * @returns {uint8[]|null}
   */
  get iv() { return this._iv ? [...this._iv] : null; }

  /**
   * @param {uint8[]} data
   */
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this._key) throw new Error("Key not set");
    for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
  }

  /**
   * @returns {uint8[]}
   */
  Result() {
    if (!this._key) throw new Error("Key not set");

    // Handle empty input
    if (this.inputBuffer.length === 0) {
      /** @type {uint8[]} */
      const empty = [];
      return empty;
    }

    /** @type {uint8[]} */
    const output = [];
    for (let i = 0; i < this.inputBuffer.length; i++) {
      const keystreamByte = this._getNextKeystreamByte();
      output.push(OpCodes.Xor8(this.inputBuffer[i], keystreamByte));
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
    /** @type {uint32[]} */
    const pTable = new Array(this.TABLE_SIZE);
    /** @type {uint32[]} */
    const qTable = new Array(this.TABLE_SIZE);
    this.P = pTable;
    this.Q = qTable;
    /** @type {uint32[]} */
    const xWords = new Array(16);
    /** @type {uint32[]} */
    const yWords = new Array(16);
    this.X = xWords;
    this.Y = yWords;

    // Convert key and IV to 32-bit words (little-endian)
    /** @type {uint32[]} */
    const kwords = new Array(4);
    /** @type {uint32[]} */
    const vwords = new Array(4);

    for (let i = 0; i < 4; i++) {
      kwords[i] = OpCodes.Pack32LE(
        this._key[i * 4],
        this._key[i * 4 + 1],
        this._key[i * 4 + 2],
        this._key[i * 4 + 3]
      );

      vwords[i] = OpCodes.Pack32LE(
        this._iv[i * 4],
        this._iv[i * 4 + 1],
        this._iv[i * 4 + 2],
        this._iv[i * 4 + 3]
      );
    }

    // Initialize W array for key expansion
    /** @type {uint32[]} */
    const W = new Array(1280);

    // Load key and IV into first 16 positions of W
    for (let i = 0; i < 4; i++) {
      W[i] = kwords[i];
      W[i + 4] = kwords[i]; // Duplicate key
      W[i + 8] = vwords[i];
      W[i + 12] = vwords[i]; // Duplicate IV
    }

    // Expand to fill first 272 positions
    for (let i = 16; i < 272; i++) {
      W[i] = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(this._f2(W[i - 2]), W[i - 7]), this._f1(W[i - 15])), W[i - 16]), i);
    }

    // Copy first 16 positions from positions 256-271
    for (let i = 0; i < 16; i++) {
      W[i] = W[256 + i];
    }

    // Continue expansion to fill 1024 positions
    for (let i = 16; i < 1024; i++) {
      W[i] = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(this._f2(W[i - 2]), W[i - 7]), this._f1(W[i - 15])), W[i - 16]), 256 + i);
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
    this._step = 0;
    for (let i = 0; i < 64; i++) {
      this._setupUpdate();
    }

    // Reset counter for keystream generation
    this._step = 0;
    this.keystreamBuffer = [];
    this.keystreamPosition = 0;
  }

  /**
   * Initialize HC-256 (no X/Y arrays)
   */
  _initializeHC256() {
    // Initialize tables
    /** @type {uint32[]} */
    const pTable = new Array(this.TABLE_SIZE);
    /** @type {uint32[]} */
    const qTable = new Array(this.TABLE_SIZE);
    this.P = pTable;
    this.Q = qTable;

    // Convert key and IV to 32-bit words (little-endian)
    /** @type {uint32[]} */
    const kwords = new Array(8);
    /** @type {uint32[]} */
    const vwords = new Array(8);

    for (let i = 0; i < 8; i++) {
      kwords[i] = OpCodes.Pack32LE(
        this._key[i * 4],
        this._key[i * 4 + 1],
        this._key[i * 4 + 2],
        this._key[i * 4 + 3]
      );

      vwords[i] = OpCodes.Pack32LE(
        this._iv[i * 4],
        this._iv[i * 4 + 1],
        this._iv[i * 4 + 2],
        this._iv[i * 4 + 3]
      );
    }

    // Initialize W array for key expansion (2560 words)
    /** @type {uint32[]} */
    const W = new Array(2560);

    // Load key and IV into W
    for (let i = 0; i < 8; i++) {
      W[i] = kwords[i];
      W[i + 8] = vwords[i];
    }

    // Key expansion using f1 and f2 functions
    for (let i = 16; i < 2560; i++) {
      W[i] = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(this._f2(W[i - 2]), W[i - 7]), this._f1(W[i - 15])), W[i - 16]), i);
    }

    // Initialize P and Q tables from W
    for (let i = 0; i < this.TABLE_SIZE; i++) {
      this.P[i] = W[i + 512];
      this.Q[i] = W[i + 1536];
    }

    // Run cipher for 4096 steps to initialize tables
    this._step = 0;
    for (let i = 0; i < this.INIT_STEPS; i++) {
      this._generateWord();
    }

    // Reset counter for keystream generation
    this._step = 0;
    this.keystreamBuffer = [];
    this.keystreamPosition = 0;
  }

  /**
   * f1 function for key expansion
   * @param {uint32} x
   * @returns {uint32}
   */
  _f1(x) {
    return OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(x, 7), OpCodes.RotR32(x, 18)), OpCodes.Shr32(x, 3)));
  }

  /**
   * f2 function for key expansion
   * @param {uint32} x
   * @returns {uint32}
   */
  _f2(x) {
    return OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.RotR32(x, 17), OpCodes.RotR32(x, 19)), OpCodes.Shr32(x, 10)));
  }

  /**
   * h1 function for P table lookups (Q table) - HC-128 variant
   * @param {uint32} x
   * @returns {uint32}
   */
  _h1_128(x) {
    /** @type {int32} */
    const a = OpCodes.And32(x, 0xFF);
    /** @type {int32} */
    const c = OpCodes.And32(OpCodes.Shr32(x, 16), 0xFF);
    return OpCodes.Add32(this.Q[a], this.Q[256 + c]);
  }

  /**
   * h2 function for Q table lookups (P table) - HC-128 variant
   * @param {uint32} x
   * @returns {uint32}
   */
  _h2_128(x) {
    /** @type {int32} */
    const a = OpCodes.And32(x, 0xFF);
    /** @type {int32} */
    const c = OpCodes.And32(OpCodes.Shr32(x, 16), 0xFF);
    return OpCodes.Add32(this.P[a], this.P[256 + c]);
  }

  /**
   * h1 function for P table (uses Q table lookups) - HC-256 variant
   * @param {uint32} x
   * @returns {uint32}
   */
  _h1_256(x) {
    /** @type {int32} */
    const a = OpCodes.And32(x, 0xFF);
    /** @type {int32} */
    const b = OpCodes.And32(OpCodes.Shr32(x, 8), 0xFF);
    /** @type {int32} */
    const c = OpCodes.And32(OpCodes.Shr32(x, 16), 0xFF);
    /** @type {int32} */
    const d = OpCodes.And32(OpCodes.Shr32(x, 24), 0xFF);
    return OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(this.Q[a], this.Q[256 + b]), this.Q[512 + c]), this.Q[768 + d]);
  }

  /**
   * h2 function for Q table (uses P table lookups) - HC-256 variant
   * @param {uint32} x
   * @returns {uint32}
   */
  _h2_256(x) {
    /** @type {int32} */
    const a = OpCodes.And32(x, 0xFF);
    /** @type {int32} */
    const b = OpCodes.And32(OpCodes.Shr32(x, 8), 0xFF);
    /** @type {int32} */
    const c = OpCodes.And32(OpCodes.Shr32(x, 16), 0xFF);
    /** @type {int32} */
    const d = OpCodes.And32(OpCodes.Shr32(x, 24), 0xFF);
    return OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(this.P[a], this.P[256 + b]), this.P[512 + c]), this.P[768 + d]);
  }

  /**
   * Setup update function (16 steps without keystream output) - HC-128 only
   */
  _setupUpdate() {
    /** @type {int32} */
    const cc = OpCodes.And32(this._step, 0x1FF);

    if (this._step < 512) {
      this._step = OpCodes.And32(this._step + 16, 0x3FF);
      for (let i = 0; i < 16; i++) {
        const j = OpCodes.And32(cc + i, 0x1FF);
        const nextJ = OpCodes.And32(cc + i + 1, 0x1FF);

        const tem2 = OpCodes.RotR32(this.X[OpCodes.And32(i + 6, 0xF)], 8);
        const tem0 = OpCodes.RotR32(this.P[nextJ], 23);
        const tem1 = OpCodes.RotR32(this.X[OpCodes.And32(i + 13, 0xF)], 10);
        const tem3 = this._h1_128(this.X[OpCodes.And32(i + 4, 0xF)]);

        this.P[j] = OpCodes.Add32(OpCodes.Add32(this.P[j], tem2), OpCodes.Xor32(tem0, tem1));
        this.P[j] = OpCodes.ToUint32(OpCodes.Xor32(this.P[j], tem3));
        this.X[OpCodes.And32(i, 0xF)] = this.P[j];
      }
    } else {
      this._step = OpCodes.And32(this._step + 16, 0x3FF);
      for (let i = 0; i < 16; i++) {
        const j = OpCodes.And32(512 + cc + i, 0x3FF);
        const nextJ = OpCodes.And32(512 + cc + i + 1, 0x3FF);

        const tem2 = OpCodes.RotL32(this.Y[OpCodes.And32(i + 6, 0xF)], 8);
        const tem0 = OpCodes.RotL32(this.Q[OpCodes.And32(nextJ, 0x1FF)], 23);
        const tem1 = OpCodes.RotL32(this.Y[OpCodes.And32(i + 13, 0xF)], 10);
        const tem3 = this._h2_128(this.Y[OpCodes.And32(i + 4, 0xF)]);

        this.Q[OpCodes.And32(j, 0x1FF)] = OpCodes.Add32(OpCodes.Add32(this.Q[OpCodes.And32(j, 0x1FF)], tem2), OpCodes.Xor32(tem0, tem1));
        this.Q[OpCodes.And32(j, 0x1FF)] = OpCodes.ToUint32(OpCodes.Xor32(this.Q[OpCodes.And32(j, 0x1FF)], tem3));
        this.Y[OpCodes.And32(i, 0xF)] = this.Q[OpCodes.And32(j, 0x1FF)];
      }
    }
  }

  /**
   * Generate keystream (16 steps with output) - HC-128 only
   * @param {uint32[]} words
   */
  _generateKeystream16(words) {
    /** @type {int32} */
    const cc = OpCodes.And32(this._step, 0x1FF);

    if (this._step < 512) {
      this._step = OpCodes.And32(this._step + 16, 0x3FF);
      for (let i = 0; i < 16; i++) {
        const j = OpCodes.And32(cc + i, 0x1FF);
        const nextJ = OpCodes.And32(cc + i + 1, 0x1FF);

        const tem2 = OpCodes.RotR32(this.X[OpCodes.And32(i + 6, 0xF)], 8);
        const tem0 = OpCodes.RotR32(this.P[nextJ], 23);
        const tem1 = OpCodes.RotR32(this.X[OpCodes.And32(i + 13, 0xF)], 10);
        const tem3 = this._h1_128(this.X[OpCodes.And32(i + 4, 0xF)]);

        this.P[j] = OpCodes.Add32(OpCodes.Add32(this.P[j], tem2), OpCodes.Xor32(tem0, tem1));
        this.X[OpCodes.And32(i, 0xF)] = this.P[j];
        words[i] = OpCodes.ToUint32(OpCodes.Xor32(tem3, this.P[j]));
      }
    } else {
      this._step = OpCodes.And32(this._step + 16, 0x3FF);
      for (let i = 0; i < 16; i++) {
        const j = OpCodes.And32(512 + cc + i, 0x3FF);
        const nextJ = OpCodes.And32(512 + cc + i + 1, 0x3FF);

        const tem2 = OpCodes.RotL32(this.Y[OpCodes.And32(i + 6, 0xF)], 8);
        const tem0 = OpCodes.RotL32(this.Q[OpCodes.And32(nextJ, 0x1FF)], 23);
        const tem1 = OpCodes.RotL32(this.Y[OpCodes.And32(i + 13, 0xF)], 10);
        const tem3 = this._h2_128(this.Y[OpCodes.And32(i + 4, 0xF)]);

        this.Q[OpCodes.And32(j, 0x1FF)] = OpCodes.Add32(OpCodes.Add32(this.Q[OpCodes.And32(j, 0x1FF)], tem2), OpCodes.Xor32(tem0, tem1));
        this.Y[OpCodes.And32(i, 0xF)] = this.Q[OpCodes.And32(j, 0x1FF)];
        words[i] = OpCodes.ToUint32(OpCodes.Xor32(tem3, this.Q[OpCodes.And32(j, 0x1FF)]));
      }
    }
  }

  /**
   * Generate one 32-bit keystream word following official HC-256 specification
   * @returns {uint32}
   */
  _generateWord() {
    const j = OpCodes.And32(this._step, 0x3FF); // 1024 mask for table index
    /** @type {uint32} */
    let s = 0;

    if (this._step < 1024) {
      // Update P table
      const j3 = OpCodes.And32(j - 3, 0x3FF);
      const j10 = OpCodes.And32(j - 10, 0x3FF);
      const j12 = OpCodes.And32(j - 12, 0x3FF);
      const j1023 = OpCodes.And32(j - 1023, 0x3FF);

      this.P[j] = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(this.P[j], this.P[j10]),
                   OpCodes.Xor32(OpCodes.RotR32(this.P[j3], 10), OpCodes.RotR32(this.P[j1023], 23))),
                   this.Q[OpCodes.And32(OpCodes.Xor32(this.P[j3], this.P[j1023]), 0x3FF)]);

      s = OpCodes.ToUint32(OpCodes.Xor32(this._h1_256(this.P[j12]), this.P[j]));
    } else {
      // Update Q table
      const j3 = OpCodes.And32(j - 3, 0x3FF);
      const j10 = OpCodes.And32(j - 10, 0x3FF);
      const j12 = OpCodes.And32(j - 12, 0x3FF);
      const j1023 = OpCodes.And32(j - 1023, 0x3FF);

      this.Q[j] = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(this.Q[j], this.Q[j10]),
                   OpCodes.Xor32(OpCodes.RotR32(this.Q[j3], 10), OpCodes.RotR32(this.Q[j1023], 23))),
                   this.P[OpCodes.And32(OpCodes.Xor32(this.Q[j3], this.Q[j1023]), 0x3FF)]);

      s = OpCodes.ToUint32(OpCodes.Xor32(this._h2_256(this.Q[j12]), this.Q[j]));
    }

    this._step = (this._step + 1) % 2048; // Wrap at 2048
    return s;
  }

  /**
   * Generate a block of keystream
   * @returns {uint8[]}
   */
  _generateBlock() {
    if (this.HAS_XY_ARRAYS) {
      // HC-128: Generate 64 bytes (16 words)
      /** @type {uint32[]} */
      const ksWords = new Array(16);
      this._generateKeystream16(ksWords);

      /** @type {uint8[]} */
      const keystream = [];
      for (let i = 0; i < 16; i++) {
        const bytes = OpCodes.Unpack32LE(ksWords[i]);
        keystream.push(bytes[0]);
        keystream.push(bytes[1]);
        keystream.push(bytes[2]);
        keystream.push(bytes[3]);
      }

      return keystream;
    } else {
      // HC-256: Generate 16 bytes (4 words)
      /** @type {uint8[]} */
      const keystream = [];

      for (let i = 0; i < 4; i++) {
        const word = this._generateWord();
        const bytes = OpCodes.Unpack32LE(word);
        keystream.push(bytes[0]);
        keystream.push(bytes[1]);
        keystream.push(bytes[2]);
        keystream.push(bytes[3]);
      }

      return keystream;
    }
  }

  /**
   * Get next keystream byte
   * @returns {uint8}
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
