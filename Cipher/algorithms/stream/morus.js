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

  // MORUS-640 constants (32-bit words)
  const CONSTANTS_640 = Object.freeze([
    [0x02010100, 0x0d080503, 0x59372215, 0x6279e990],
    [0x55183ddb, 0xf12fc26d, 0x42311120, 0xdd28b573]
  ]);

  // ===== ALGORITHM IMPLEMENTATION =====

class MORUS extends StreamCipherAlgorithm {
  constructor() {
    super();

    this.name = "MORUS";
    this.description = "CAESAR competition finalist for authenticated encryption. High-performance AEAD cipher with 5-register state machine optimized for modern processors. Designed by Hongjun Wu and Tao Huang.";
    this.inventor = "Hongjun Wu, Tao Huang";
    this.year = 2014;
    this.category = CategoryType.STREAM;
    this.subCategory = "Authenticated Encryption";
    this.securityStatus = SecurityStatus.EXPERIMENTAL;
    this.complexity = ComplexityType.EXPERT;
    this.country = CountryCode.SG;

    this.SupportedKeySizes = [new KeySize(16, 16, 1)];
    this.SupportedBlockSizes = [new KeySize(0, 65536, 1)];

    this.documentation = [
      new LinkItem("CAESAR MORUS Submission", "https://competitions.cr.yp.to/round3/morusv2.pdf"),
      new LinkItem("MORUS Paper", "https://eprint.iacr.org/2013/629"),
      new LinkItem("CAESAR Competition", "https://competitions.cr.yp.to/")
    ];

    this.vulnerabilities = [
      new Vulnerability("State Recovery", "Potential state recovery in certain configurations"),
      new Vulnerability("Not Standardized", "CAESAR finalist but not standardized - use for research only")
    ];

    this.tests = [
      {
        text: "MORUS-640-128 Test Vector - Empty",
        uri: "Educational implementation test",
        input: OpCodes.Hex8ToBytes(''),
        key: OpCodes.Hex8ToBytes('00112233445566778899aabbccddeeff'),
        nonce: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
        expected: OpCodes.Hex8ToBytes('36114c3337ab27d84eeb88efadc5a5a7')
      },
      {
        text: "MORUS-640-128 Test Vector - Small",
        uri: "Educational implementation test",
        input: OpCodes.Hex8ToBytes('01020304'),
        key: OpCodes.Hex8ToBytes('00112233445566778899aabbccddeeff'),
        nonce: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
        expected: OpCodes.Hex8ToBytes('72585912a2802959514d13f11dbad73d4eea8999')
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new MORUSInstance(this, isInverse);
  }
}

class MORUSInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._nonce = null;

    // MORUS-640 state (5 registers of 4×32-bit words)
    this.state = null;
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
    if (this._nonce) {
      this._initialize();
    }
  }

  get key() { return this._key ? [...this._key] : null; }

  set nonce(nonceBytes) {
    if (!nonceBytes || nonceBytes.length !== 16) {
      this._nonce = new Array(16).fill(0);
    } else {
      this._nonce = [...nonceBytes];
    }

    if (this._key) {
      this._initialize();
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

    // Handle empty input - return only tag
    if (this.inputBuffer.length === 0) {
      const tag = this._generateTag(0, 0);
      this.inputBuffer = [];
      return tag;
    }

    // Generate keystream and encrypt
    const keystream = this._generateKeystream(this.inputBuffer.length);
    const ciphertext = OpCodes.XorArrays(this.inputBuffer, keystream);

    // Generate tag (process plaintext for authentication)
    this._reinitialize();
    this._processPlaintext(this.inputBuffer);
    const tag = this._generateTag(0, this.inputBuffer.length);

    this.inputBuffer = [];
    return ciphertext.concat(tag);
  }

  _initialize() {
    if (!this._key || !this._nonce) return;

    // Initialize 5 registers of 4×32-bit words
    this.state = new Array(5);

    // Convert key and nonce to 32-bit words
    const keyWords = this._bytesToWords(this._key);
    const nonceWords = this._bytesToWords(this._nonce);

    // S[0] = key
    this.state[0] = [...keyWords];

    // S[1] = nonce
    this.state[1] = [...nonceWords];

    // S[2] = key XOR nonce
    this.state[2] = [];
    for (let i = 0; i < 4; i++) {
      this.state[2][i] = OpCodes.ToUint32(OpCodes.XorN(keyWords[i], nonceWords[i]));
    }

    // S[3] = constant
    this.state[3] = [...CONSTANTS_640[0]];

    // S[4] = constant
    this.state[4] = [...CONSTANTS_640[1]];

    // Run initialization rounds (16 rounds)
    for (let i = 0; i < 16; i++) {
      this._updateState();
    }
  }

  _reinitialize() {
    // Reinitialize state for authentication
    this._initialize();
  }

  /**
   * Convert byte array to 32-bit words (little-endian)
   */
  _bytesToWords(bytes) {
    const words = [];
    for (let i = 0; i < bytes.length; i += 4) {
      words.push(OpCodes.Pack32LE(
        bytes[i] || 0,
        bytes[i + 1] || 0,
        bytes[i + 2] || 0,
        bytes[i + 3] || 0
      ));
    }
    return words;
  }

  /**
   * Convert 32-bit words to byte array (little-endian)
   */
  _wordsToBytes(words) {
    const bytes = [];
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      bytes.push(OpCodes.AndN(word, 0xFF));
      bytes.push(OpCodes.AndN(OpCodes.Shr32(word, 8), 0xFF));
      bytes.push(OpCodes.AndN(OpCodes.Shr32(word, 16), 0xFF));
      bytes.push(OpCodes.AndN(OpCodes.Shr32(word, 24), 0xFF));
    }
    return bytes;
  }

  /**
   * MORUS state update function
   */
  _updateState() {
    const newState = new Array(5);
    for (let i = 0; i < 5; i++) {
      newState[i] = new Array(4);
    }

    // S'[0] = S[0] XOR (S[1] AND S[2]) XOR S[3] XOR (S[1] <<< 5) XOR (S[2] <<< 31)
    for (let i = 0; i < 4; i++) {
      newState[0][i] = OpCodes.ToUint32(
        OpCodes.XorN(
          OpCodes.XorN(
            OpCodes.XorN(
              OpCodes.XorN(this.state[0][i], OpCodes.AndN(this.state[1][i], this.state[2][i])),
              this.state[3][i]
            ),
            OpCodes.RotL32(this.state[1][i], 5)
          ),
          OpCodes.RotL32(this.state[2][i], 31)
        )
      );
    }

    // S'[1] = S[1] XOR (S[2] AND S[3]) XOR S[4] XOR (S[2] <<< 13) XOR (S[3] <<< 3)
    for (let i = 0; i < 4; i++) {
      newState[1][i] = OpCodes.ToUint32(
        OpCodes.XorN(
          OpCodes.XorN(
            OpCodes.XorN(
              OpCodes.XorN(this.state[1][i], OpCodes.AndN(this.state[2][i], this.state[3][i])),
              this.state[4][i]
            ),
            OpCodes.RotL32(this.state[2][i], 13)
          ),
          OpCodes.RotL32(this.state[3][i], 3)
        )
      );
    }

    // S'[2] = S[2] XOR (S[3] AND S[4]) XOR S[0] XOR (S[3] <<< 27) XOR (S[4] <<< 14)
    for (let i = 0; i < 4; i++) {
      newState[2][i] = OpCodes.ToUint32(
        OpCodes.XorN(
          OpCodes.XorN(
            OpCodes.XorN(
              OpCodes.XorN(this.state[2][i], OpCodes.AndN(this.state[3][i], this.state[4][i])),
              this.state[0][i]
            ),
            OpCodes.RotL32(this.state[3][i], 27)
          ),
          OpCodes.RotL32(this.state[4][i], 14)
        )
      );
    }

    // S'[3] = S[3] XOR (S[4] AND S[0]) XOR S[1] XOR (S[4] <<< 15) XOR (S[0] <<< 9)
    for (let i = 0; i < 4; i++) {
      newState[3][i] = OpCodes.ToUint32(
        OpCodes.XorN(
          OpCodes.XorN(
            OpCodes.XorN(
              OpCodes.XorN(this.state[3][i], OpCodes.AndN(this.state[4][i], this.state[0][i])),
              this.state[1][i]
            ),
            OpCodes.RotL32(this.state[4][i], 15)
          ),
          OpCodes.RotL32(this.state[0][i], 9)
        )
      );
    }

    // S'[4] = S[4] XOR (S[0] AND S[1]) XOR S[2] XOR (S[0] <<< 29) XOR (S[1] <<< 18)
    for (let i = 0; i < 4; i++) {
      newState[4][i] = OpCodes.ToUint32(
        OpCodes.XorN(
          OpCodes.XorN(
            OpCodes.XorN(
              OpCodes.XorN(this.state[4][i], OpCodes.AndN(this.state[0][i], this.state[1][i])),
              this.state[2][i]
            ),
            OpCodes.RotL32(this.state[0][i], 29)
          ),
          OpCodes.RotL32(this.state[1][i], 18)
        )
      );
    }

    this.state = newState;
  }

  /**
   * Generate keystream
   */
  _generateKeystream(lengthBytes) {
    const keystreamWords = [];

    while (keystreamWords.length * 4 < lengthBytes) {
      // Keystream = S[0] XOR S[1] XOR (S[2] AND S[3]) XOR S[4]
      const ks = new Array(4);
      for (let i = 0; i < 4; i++) {
        ks[i] = OpCodes.ToUint32(
          OpCodes.XorN(
            OpCodes.XorN(
              OpCodes.XorN(this.state[0][i], this.state[1][i]),
              OpCodes.AndN(this.state[2][i], this.state[3][i])
            ),
            this.state[4][i]
          )
        );
      }

      keystreamWords.push(...ks);
      this._updateState();
    }

    // Convert to bytes and trim to requested length
    const keystreamBytes = this._wordsToBytes(keystreamWords);
    return keystreamBytes.slice(0, lengthBytes);
  }

  /**
   * Process plaintext for authentication
   */
  _processPlaintext(plaintext) {
    for (let i = 0; i < plaintext.length; i += 16) {
      const block = plaintext.slice(i, i + 16);
      while (block.length < 16) {
        block.push(0);
      }

      const blockWords = this._bytesToWords(block);
      for (let j = 0; j < 4; j++) {
        this.state[0][j] = OpCodes.ToUint32(OpCodes.XorN(this.state[0][j], blockWords[j]));
      }

      this._updateState();
    }
  }

  /**
   * Generate authentication tag
   */
  _generateTag(aadLength, plaintextLength) {
    // Encode lengths as 64-bit little-endian values
    const lengthWords = new Array(4);

    // AAD length (little-endian 64-bit)
    lengthWords[0] = OpCodes.AndN(aadLength, 0xFFFFFFFF);
    lengthWords[1] = OpCodes.AndN(Math.floor(aadLength / 0x100000000), 0xFFFFFFFF);

    // Plaintext length (little-endian 64-bit)
    lengthWords[2] = OpCodes.AndN(plaintextLength, 0xFFFFFFFF);
    lengthWords[3] = OpCodes.AndN(Math.floor(plaintextLength / 0x100000000), 0xFFFFFFFF);

    // XOR with state[0]
    for (let i = 0; i < 4; i++) {
      this.state[0][i] = OpCodes.ToUint32(OpCodes.XorN(this.state[0][i], lengthWords[i]));
    }

    // Final rounds (10 rounds)
    for (let i = 0; i < 10; i++) {
      this._updateState();
    }

    // Generate tag: S[0] XOR S[1] XOR S[2] XOR S[3]
    const tagWords = new Array(4);
    for (let i = 0; i < 4; i++) {
      tagWords[i] = OpCodes.ToUint32(
        OpCodes.XorN(
          OpCodes.XorN(
            OpCodes.XorN(this.state[0][i], this.state[1][i]),
            this.state[2][i]
          ),
          this.state[3][i]
        )
      );
    }

    return this._wordsToBytes(tagWords);
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new MORUS();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { MORUS, MORUSInstance };
}));
