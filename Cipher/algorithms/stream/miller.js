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

class Miller extends StreamCipherAlgorithm {
  constructor() {
    super();

    this.name = "Miller Encoding";
    this.description = "Educational implementation of Miller encoding adapted as a stream cipher. Miller encoding is a line code where data bits are encoded with clock transitions for synchronization, adapted here for cryptographic demonstration.";
    this.inventor = "Miller et al.";
    this.year = 1963;
    this.category = CategoryType.STREAM;
    this.subCategory = "Stream Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.US;

    this.SupportedKeySizes = [new KeySize(1, 256, 1)];
    this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

    this.documentation = [
      new LinkItem("Miller Encoding", "https://en.wikipedia.org/wiki/Differential_Manchester_encoding"),
      new LinkItem("Line Codes", "https://en.wikipedia.org/wiki/Line_code")
    ];

    this.tests = [
      {
        text: "Miller Encoding Test Vector",
        uri: "Reference implementation output",
        input: OpCodes.Hex8ToBytes("0001020304050607"),
        key: OpCodes.Hex8ToBytes("00010203040506070809101112131415"),
        expected: OpCodes.Hex8ToBytes("1808021206120212")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new MillerInstance(this, isInverse);
  }
}

class MillerInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this._state = null;
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
      const keystreamByte = this._generateByte();
      output.push(OpCodes.XorN(this.inputBuffer[i], keystreamByte));
    }

    this.inputBuffer = [];
    return output;
  }

  _initializeState() {
    if (!this._key) return;

    // Miller-inspired state initialization with delay encoding concepts
    this._state = {
      delay: new Array(16).fill(0), // Delay line buffer
      phase: 0,
      clock: 0,
      counter: 0
    };

    // Seed delay line with key
    for (let i = 0; i < this._key.length && i < 16; i++) {
      this._state.delay[i] = this._key[i];
    }

    // Miller encoding initialization - phase transitions
    for (let i = 0; i < 16; i++) {
      const bit = OpCodes.AndN(this._state.delay[i], 1);
      // Miller encoding: transition at start, optional mid-bit transition
      this._state.phase = OpCodes.XorN(this._state.phase, 1); // Always transition at start
      if (bit) this._state.phase = OpCodes.XorN(this._state.phase, 1); // Additional transition for '1' bit
      this._state.delay[i] = OpCodes.AndN((this._state.delay[i] + this._state.phase), 0xFF);
    }
  }

  _generateByte() {
    if (!this._state) return 0;

    // Miller-inspired byte generation with delay encoding
    const pos = this._state.counter % 16;

    // Get current and delayed values
    const current = this._state.delay[pos];
    const delayed = this._state.delay[(pos + 8) % 16];

    // Miller encoding: XOR current with phase-shifted delayed value
    this._state.phase = OpCodes.AndN((this._state.phase + 1), 1);
    const byte = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(current, delayed), OpCodes.Shl32(this._state.phase, 4)), this._state.clock), 0xFF);

    // Update delay line (shift and insert new value)
    this._state.delay[pos] = OpCodes.AndN((this._state.delay[pos] + byte + this._state.counter), 0xFF);

    // Update state
    this._state.clock = OpCodes.AndN((this._state.clock + 1), 0xFF);
    this._state.counter = (this._state.counter + 1) % 16;

    return byte;
  }
}

  // ===== REGISTRATION =====

  const algorithmInstance = new Miller();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Miller, MillerInstance };
}));
