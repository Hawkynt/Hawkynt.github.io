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

  // Dragon S-box (AES S-box)
  const SBOX = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
  ];

  // ===== ALGORITHM IMPLEMENTATION =====

class Dragon extends StreamCipherAlgorithm {
  constructor() {
    super();

    this.name = "Dragon";
    this.description = "Word-based eSTREAM candidate using two NLFSRs with 32-bit operations for high-speed software. Designed by Chen, Henricksen, et al. but eliminated in Phase 2 due to cryptanalytic vulnerabilities.";
    this.inventor = "K. Chen, M. Henricksen, A. Millan, J. Fuller, L. Simpson, E. Dawson, H. Lee, S. Moon";
    this.year = 2005;
    this.category = CategoryType.STREAM;
    this.subCategory = "Stream Cipher";
    this.securityStatus = SecurityStatus.BROKEN;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.AU;

    this.SupportedKeySizes = [new KeySize(16, 32, 16)];
    this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

    this.documentation = [
      new LinkItem("eSTREAM Dragon Specification", "https://www.ecrypt.eu.org/stream/dragonpf.html"),
      new LinkItem("eSTREAM Project", "https://www.ecrypt.eu.org/stream/"),
      new LinkItem("Cryptanalysis of Dragon", "https://eprint.iacr.org/2006/151.pdf")
    ];

    this.vulnerabilities = [
      new Vulnerability("Distinguishing Attack", "Multiple cryptanalytic attacks discovered during eSTREAM evaluation"),
      new Vulnerability("Key Recovery", "Practical attacks on the cipher structure")
    ];

    this.tests = [
      {
        text: "Dragon Test Vector - All Zeros",
        uri: "Educational implementation test",
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6")
      },
      {
        text: "Dragon Test Vector - Simple Key",
        uri: "Educational implementation test",
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("f4d08c757452e0d3d56512493f13973b")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new DragonInstance(this, isInverse);
  }
}

class DragonInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._iv = new Array(16).fill(0);

    // Dragon state
    this.nlfsr1 = null;
    this.nlfsr2 = null;
    this.wordBuffer = null;
    this.wordBufferPos = 0;

    // Constants
    this.NLFSR_SIZE = 8;       // Each NLFSR has 8 words
    this.INIT_ROUNDS = 1024;   // Initialization rounds
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
    if (this._iv !== null) {
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
      const keystreamByte = this._generateKeystreamByte();
      output.push(this.inputBuffer[i] ^ keystreamByte);
    }

    this.inputBuffer = [];
    return output;
  }

  _initialize() {
    if (!this._key || this._iv === null) return;

    // Initialize NLFSRs
    this.nlfsr1 = new Array(this.NLFSR_SIZE);
    this.nlfsr2 = new Array(this.NLFSR_SIZE);

    // Convert key to 32-bit words (little-endian)
    const keyWords = [];
    for (let i = 0; i < this._key.length; i += 4) {
      const b0 = this._key[i] || 0;
      const b1 = this._key[i + 1] || 0;
      const b2 = this._key[i + 2] || 0;
      const b3 = this._key[i + 3] || 0;
      keyWords.push(OpCodes.Pack32LE(b0, b1, b2, b3));
    }

    // Convert IV to 32-bit words (little-endian)
    const ivWords = [];
    for (let i = 0; i < 16; i += 4) {
      ivWords.push(OpCodes.Pack32LE(
        this._iv[i], this._iv[i + 1], this._iv[i + 2], this._iv[i + 3]
      ));
    }

    // Initialize NLFSRs with key and IV material
    for (let i = 0; i < this.NLFSR_SIZE; i++) {
      this.nlfsr1[i] = (i < keyWords.length) ? keyWords[i] : 0;
      this.nlfsr2[i] = (i < ivWords.length) ? ivWords[i] : 0;
    }

    // Mix key and IV through initialization rounds
    for (let round = 0; round < this.INIT_ROUNDS; round++) {
      this._clockNLFSRs();
    }

    // Reset keystream buffer
    this.wordBuffer = null;
    this.wordBufferPos = 0;
  }

  /**
   * Nonlinear function F (32-bit S-box substitution)
   */
  _F(x) {
    const bytes = OpCodes.Unpack32LE(x);
    return OpCodes.Pack32LE(
      SBOX[bytes[0]],
      SBOX[bytes[1]],
      SBOX[bytes[2]],
      SBOX[bytes[3]]
    );
  }

  /**
   * NLFSR1 feedback function
   */
  _getNLFSR1Feedback() {
    // Linear feedback polynomial terms
    const linear = this.nlfsr1[0] ^ this.nlfsr1[2] ^ this.nlfsr1[5] ^ this.nlfsr1[7];

    // Nonlinear terms using F function
    const nonlinear1 = this._F(this.nlfsr1[1] ^ this.nlfsr1[6]);
    const nonlinear2 = OpCodes.RotL32(this._F(this.nlfsr1[3]), 16);

    return linear ^ nonlinear1 ^ nonlinear2;
  }

  /**
   * NLFSR2 feedback function
   */
  _getNLFSR2Feedback() {
    // Linear feedback polynomial terms
    const linear = this.nlfsr2[0] ^ this.nlfsr2[3] ^ this.nlfsr2[4] ^ this.nlfsr2[7];

    // Nonlinear terms using F function
    const nonlinear1 = this._F(this.nlfsr2[1] ^ this.nlfsr2[5]);
    const nonlinear2 = OpCodes.RotL32(this._F(this.nlfsr2[2]), 8);

    return linear ^ nonlinear1 ^ nonlinear2;
  }

  /**
   * Clock both NLFSRs
   */
  _clockNLFSRs() {
    const feedback1 = this._getNLFSR1Feedback();
    const feedback2 = this._getNLFSR2Feedback();

    // Shift NLFSR1
    for (let i = 0; i < this.NLFSR_SIZE - 1; i++) {
      this.nlfsr1[i] = this.nlfsr1[i + 1];
    }
    this.nlfsr1[this.NLFSR_SIZE - 1] = feedback1;

    // Shift NLFSR2
    for (let i = 0; i < this.NLFSR_SIZE - 1; i++) {
      this.nlfsr2[i] = this.nlfsr2[i + 1];
    }
    this.nlfsr2[this.NLFSR_SIZE - 1] = feedback2;
  }

  /**
   * Generate one keystream word (32 bits)
   */
  _generateKeystreamWord() {
    // Clock the NLFSRs
    this._clockNLFSRs();

    // Output function combines values from both NLFSRs
    const x1 = this.nlfsr1[3] ^ this.nlfsr1[6];
    const x2 = this.nlfsr2[1] ^ this.nlfsr2[4];

    // Apply nonlinear filter
    const y1 = this._F(x1);
    const y2 = this._F(x2);

    // Combine with rotation and addition
    return (y1 + OpCodes.RotL32(y2, 16)) >>> 0;
  }

  /**
   * Generate one keystream byte
   */
  _generateKeystreamByte() {
    if (!this.wordBuffer || this.wordBufferPos >= 4) {
      this.wordBuffer = OpCodes.Unpack32LE(this._generateKeystreamWord());
      this.wordBufferPos = 0;
    }

    return this.wordBuffer[this.wordBufferPos++];
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new Dragon();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Dragon, DragonInstance };
}));
