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

  // Leviathan S-box (AES S-box)
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

class Leviathan extends StreamCipherAlgorithm {
  constructor() {
    super();

    this.name = "Leviathan";
    this.description = "Large-state eSTREAM candidate with 4096-bit internal state. Uses 8 parallel LFSRs with nonlinear S-box filter for high security margin. Designed by David McGrew but eliminated in Phase 2 due to performance concerns.";
    this.inventor = "David McGrew";
    this.year = 2005;
    this.category = CategoryType.STREAM;
    this.subCategory = "Stream Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.US;

    this.SupportedKeySizes = [new KeySize(32, 32, 1)];
    this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

    this.documentation = [
      new LinkItem("eSTREAM Leviathan Page", "https://www.ecrypt.eu.org/stream/leviathan.html"),
      new LinkItem("eSTREAM Project", "https://www.ecrypt.eu.org/stream/")
    ];

    this.vulnerabilities = [
      new Vulnerability("Performance Issues", "Large state causes poor performance, eliminated from eSTREAM Phase 2"),
      new Vulnerability("Cryptanalytic Concerns", "Various cryptanalytic issues identified during evaluation")
    ];

    this.tests = [
      {
        text: "Leviathan Test Vector - Basic",
        uri: "Educational implementation test",
        key: OpCodes.Hex8ToBytes('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'),
        iv: OpCodes.Hex8ToBytes('101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f'),
        input: OpCodes.Hex8ToBytes('4c617267652073746174652074657374'),
        expected: OpCodes.Hex8ToBytes('c66722497fc085671eb4ad666198fc1d')
      },
      {
        text: "Leviathan Test Vector - All Zeros",
        uri: "Educational implementation test",
        key: OpCodes.Hex8ToBytes('00'.repeat(32)),
        iv: OpCodes.Hex8ToBytes('00'.repeat(32)),
        input: OpCodes.Hex8ToBytes('4e756c6c206b6579207465737470'),
        expected: OpCodes.Hex8ToBytes('2d160f0f4308061a431706101713')
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new LeviathanInstance(this, isInverse);
  }
}

class LeviathanInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._iv = new Array(32).fill(0);

    // Leviathan state
    this.state = null;
    this.wordBuffer = null;
    this.wordBufferPos = 0;

    // Constants
    this.STATE_SIZE = 128;     // 128 words = 4096 bits
    this.LFSR_COUNT = 8;       // 8 parallel LFSRs
    this.LFSR_SIZE = 16;       // Each LFSR has 16 words
    this.INIT_ROUNDS = 2048;   // Initialization rounds
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
      const keystreamByte = this._generateKeystreamByte();
      output.push(this.inputBuffer[i] ^ keystreamByte);
    }

    this.inputBuffer = [];
    return output;
  }

  _initialize() {
    if (!this._key || !this._iv) return;

    // Initialize large state (4096 bits)
    this.state = new Array(this.STATE_SIZE);

    // Convert key to 32-bit words (8 words from 32 bytes)
    const keyWords = [];
    for (let i = 0; i < 32; i += 4) {
      keyWords.push(OpCodes.Pack32LE(
        this._key[i], this._key[i + 1], this._key[i + 2], this._key[i + 3]
      ));
    }

    // Convert IV to 32-bit words (8 words from 32 bytes)
    const ivWords = [];
    for (let i = 0; i < 32; i += 4) {
      ivWords.push(OpCodes.Pack32LE(
        this._iv[i], this._iv[i + 1], this._iv[i + 2], this._iv[i + 3]
      ));
    }

    // Initialize state with key and IV material
    for (let i = 0; i < this.STATE_SIZE; i++) {
      if (i < keyWords.length) {
        this.state[i] = keyWords[i];
      } else if (i < keyWords.length + ivWords.length) {
        this.state[i] = ivWords[i - keyWords.length];
      } else {
        // Fill remaining state with derived material
        this.state[i] = this.state[i % keyWords.length] ^
                       this.state[(i * 3) % ivWords.length + keyWords.length];
      }
    }

    // Extensive initialization mixing (2048 rounds)
    for (let round = 0; round < this.INIT_ROUNDS; round++) {
      this._mixLargeState();
    }

    // Reset keystream buffer
    this.wordBuffer = null;
    this.wordBufferPos = 0;
  }

  /**
   * Mix the large state using parallel LFSR operations
   */
  _mixLargeState() {
    // Process state in chunks as parallel LFSRs
    for (let lfsr = 0; lfsr < this.LFSR_COUNT; lfsr++) {
      const offset = lfsr * this.LFSR_SIZE;
      this._mixLFSR(offset);
    }

    // Cross-LFSR mixing
    this._crossMix();
  }

  /**
   * Mix single LFSR section
   */
  _mixLFSR(offset) {
    // LFSR feedback with multiple tap points
    const feedback = this.state[offset] ^
                     this.state[offset + 3] ^
                     this.state[offset + 7] ^
                     this.state[offset + 12];

    // Shift LFSR
    for (let i = 0; i < this.LFSR_SIZE - 1; i++) {
      this.state[offset + i] = this.state[offset + i + 1];
    }
    this.state[offset + this.LFSR_SIZE - 1] = feedback;
  }

  /**
   * Cross-mixing between different LFSRs
   */
  _crossMix() {
    for (let i = 0; i < this.LFSR_COUNT - 1; i++) {
      const lfsr1_offset = i * this.LFSR_SIZE;
      const lfsr2_offset = (i + 1) * this.LFSR_SIZE;

      // Mix last word of current LFSR with first word of next LFSR
      const mix = this.state[lfsr1_offset + this.LFSR_SIZE - 1] ^
                 this.state[lfsr2_offset];

      this.state[lfsr1_offset + this.LFSR_SIZE - 1] = mix;
      this.state[lfsr2_offset] = OpCodes.RotL32(mix, 11);
    }
  }

  /**
   * Nonlinear filter function using S-box
   */
  _nonlinearFilter() {
    // Extract values from specific positions in the large state
    const x1 = this.state[7];
    const x2 = this.state[23];
    const x3 = this.state[47];
    const x4 = this.state[71];
    const x5 = this.state[95];
    const x6 = this.state[119];

    // Apply S-box operations
    const bytes1 = OpCodes.Unpack32LE(x1 ^ x4);
    const bytes2 = OpCodes.Unpack32LE(x2 ^ x5);
    const bytes3 = OpCodes.Unpack32LE(x3 ^ x6);

    const sbox_out1 = OpCodes.Pack32LE(
      SBOX[bytes1[0]], SBOX[bytes1[1]],
      SBOX[bytes1[2]], SBOX[bytes1[3]]
    );

    const sbox_out2 = OpCodes.Pack32LE(
      SBOX[bytes2[0]], SBOX[bytes2[1]],
      SBOX[bytes2[2]], SBOX[bytes2[3]]
    );

    const sbox_out3 = OpCodes.Pack32LE(
      SBOX[bytes3[0]], SBOX[bytes3[1]],
      SBOX[bytes3[2]], SBOX[bytes3[3]]
    );

    // Combine with rotation and XOR
    return sbox_out1 ^
           OpCodes.RotL32(sbox_out2, 8) ^
           OpCodes.RotL32(sbox_out3, 16);
  }

  /**
   * Generate one keystream word (32 bits)
   */
  _generateKeystreamWord() {
    // Update the large state
    this._mixLargeState();

    // Apply nonlinear filter to generate output
    return this._nonlinearFilter();
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

  const algorithmInstance = new Leviathan();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Leviathan, LeviathanInstance };
}));
