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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

class ChaCha20 extends StreamCipherAlgorithm {
  constructor() {
    super();

    this.name = "ChaCha20";
    this.description = "Modern stream cipher designed by Daniel J. Bernstein as a variant of Salsa20 with improved diffusion. Uses 20 rounds of quarter-round operations with 256-bit keys and 96-bit nonces. Widely adopted in TLS 1.3, SSH, and other modern protocols.";
    this.inventor = "Daniel J. Bernstein";
    this.year = 2008;
    this.category = CategoryType.STREAM;
    this.subCategory = "Stream Cipher";
    this.securityStatus = null;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    this.SupportedKeySizes = [new KeySize(32, 32, 1)];
    this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

    this.documentation = [
      new LinkItem("RFC 7539: ChaCha20 and Poly1305 for IETF Protocols", "https://tools.ietf.org/html/rfc7539"),
      new LinkItem("Bernstein: ChaCha, a variant of Salsa20", "https://cr.yp.to/chacha/chacha-20080128.pdf")
    ];

    this.tests = [
      {
        text: "RFC 7539 ChaCha20 Test Vector 1 - Block 0",
        uri: "https://tools.ietf.org/rfc/rfc7539.txt#section-2.3.2",
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
        nonce: OpCodes.Hex8ToBytes("000000090000004a00000000"),
        counter: 1,
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("10f1e7e4d13b5915500fdd1fa32071c4c7d1f4c733c068030422aa9ac3d46c4ed2826446079faa0914c2d705d98b02a2b5129cd1de164eb9cbd083e8a2503c4e")
      },
      {
        text: "RFC 7539 ChaCha20 Encryption Test",
        uri: "https://tools.ietf.org/rfc/rfc7539.txt#section-2.4.2",
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
        nonce: OpCodes.Hex8ToBytes("000000000000004a00000000"),
        counter: 1,
        input: OpCodes.AsciiToBytes("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it."),
        expected: OpCodes.Hex8ToBytes("6e2e359a2568f98041ba0728dd0d6981e97e7aec1d4360c20a27afccfd9fae0bf91b65c5524733ab8f593dabcd62b3571639d624e65152ab8f530c359f0861d807ca0dbf500d6a6156a38e088a22b65e52bc514d16ccf806818ce91ab77937365af90bbf74a35be6b40b8eedf2785e42874d")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new ChaCha20Instance(this, isInverse);
  }
}

class ChaCha20Instance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._nonce = new Array(12).fill(0);
    this._counter = 0;
    this.state = new Array(16);
    this.keystreamBuffer = [];
    this.keystreamPosition = 0;

    this.CONSTANTS = [
      OpCodes.Pack32LE(0x65, 0x78, 0x70, 0x61), // "expand 32-byte k" - "expa"
      OpCodes.Pack32LE(0x6e, 0x64, 0x20, 0x33), // "nd 3"
      OpCodes.Pack32LE(0x32, 0x2d, 0x62, 0x79), // "2-by"
      OpCodes.Pack32LE(0x74, 0x65, 0x20, 0x6b)  // "te k"
    ];
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
    this._initializeState();
  }

  get key() { return this._key ? [...this._key] : null; }

  set nonce(nonceBytes) {
    if (!nonceBytes || nonceBytes.length !== 12) {
      this._nonce = new Array(12).fill(0);
    } else {
      this._nonce = [...nonceBytes];
    }
    this._initializeState();
  }

  get nonce() { return this._nonce ? [...this._nonce] : null; }

  set iv(ivBytes) {
    this.nonce = ivBytes;
  }

  get iv() { return this.nonce; }

  set counter(counterValue) {
    this._counter = counterValue || 0;
    if (this._key && this._nonce) {
      this._initializeState();
    }
  }

  get counter() { return this._counter; }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this._key) throw new Error("Key not set");
    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this._key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    const output = [];
    for (let i = 0; i < this.inputBuffer.length; i++) {
      const keystreamByte = this._getNextKeystreamByte();
      output.push(this.inputBuffer[i] ^ keystreamByte);
    }

    this.inputBuffer = [];
    return output;
  }

  _initializeState() {
    if (!this._key || !this._nonce) return;

    // Constants (words 0-3)
    for (let i = 0; i < 4; i++) {
      this.state[i] = this.CONSTANTS[i];
    }

    // Key (words 4-11)
    for (let i = 0; i < 8; i++) {
      const offset = i * 4;
      this.state[4 + i] = OpCodes.Pack32LE(
        this._key[offset],
        this._key[offset + 1],
        this._key[offset + 2],
        this._key[offset + 3]
      );
    }

    // Counter (word 12)
    this.state[12] = this._counter;

    // Nonce (words 13-15)
    for (let i = 0; i < 3; i++) {
      const offset = i * 4;
      this.state[13 + i] = OpCodes.Pack32LE(
        this._nonce[offset],
        this._nonce[offset + 1],
        this._nonce[offset + 2],
        this._nonce[offset + 3]
      );
    }

    this.keystreamBuffer = [];
    this.keystreamPosition = 0;
  }

  _quarterRound(state, a, b, c, d) {
    state[a] = OpCodes.Add32(state[a], state[b]);
    state[d] ^= state[a];
    state[d] = OpCodes.RotL32(state[d], 16);

    state[c] = OpCodes.Add32(state[c], state[d]);
    state[b] ^= state[c];
    state[b] = OpCodes.RotL32(state[b], 12);

    state[a] = OpCodes.Add32(state[a], state[b]);
    state[d] ^= state[a];
    state[d] = OpCodes.RotL32(state[d], 8);

    state[c] = OpCodes.Add32(state[c], state[d]);
    state[b] ^= state[c];
    state[b] = OpCodes.RotL32(state[b], 7);
  }

  _generateBlock() {
    const workingState = this.state.slice(0);

    // Perform 20 rounds (10 double-rounds)
    for (let round = 0; round < 10; round++) {
      // Odd round: column operations
      this._quarterRound(workingState, 0, 4, 8, 12);
      this._quarterRound(workingState, 1, 5, 9, 13);
      this._quarterRound(workingState, 2, 6, 10, 14);
      this._quarterRound(workingState, 3, 7, 11, 15);

      // Even round: diagonal operations
      this._quarterRound(workingState, 0, 5, 10, 15);
      this._quarterRound(workingState, 1, 6, 11, 12);
      this._quarterRound(workingState, 2, 7, 8, 13);
      this._quarterRound(workingState, 3, 4, 9, 14);
    }

    // Add original state to working state
    for (let i = 0; i < 16; i++) {
      workingState[i] = OpCodes.Add32(workingState[i], this.state[i]);
    }

    // Convert words to bytes (little-endian)
    const keystream = [];
    for (let i = 0; i < 16; i++) {
      const bytes = OpCodes.Unpack32LE(workingState[i]);
      keystream.push(bytes[0], bytes[1], bytes[2], bytes[3]);
    }

    // Increment counter for next block
    this._counter = OpCodes.Add32(this._counter, 1);
    this.state[12] = this._counter;

    return keystream;
  }

  _getNextKeystreamByte() {
    if (this.keystreamPosition >= this.keystreamBuffer.length) {
      this.keystreamBuffer = this._generateBlock();
      this.keystreamPosition = 0;
    }

    return this.keystreamBuffer[this.keystreamPosition++];
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new ChaCha20();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ChaCha20, ChaCha20Instance };
}));
