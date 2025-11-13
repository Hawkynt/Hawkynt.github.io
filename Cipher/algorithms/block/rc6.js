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
    // Browser/Worker global - assign exports to global scope
    const exports = factory(root.AlgorithmFramework, root.OpCodes);
    if (exports) Object.assign(root, exports);
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
          BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  class RC6Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RC6";
      this.description = "AES competition finalist featuring data-dependent rotations and efficient design. RC6-32/20/b with 128-bit blocks, variable key sizes (128-256 bits), and 20 rounds.";
      this.inventor = "Ronald Rivest, Matt Robshaw, Ray Sidney, Yiqun Lisa Yin";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Feistel-like Block Cipher";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 32, 8) // RC6-128/192/256
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("RC6 AES Submission", "https://www.grc.com/r&d/rc6.pdf"),
        new LinkItem("Wikipedia - RC6", "https://en.wikipedia.org/wiki/RC6"),
        new LinkItem("AES Competition Archive", "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development")
      ];

      this.references = [
        new LinkItem("Crypto++ RC6 Implementation", "https://github.com/weidai11/cryptopp/blob/master/rc6.cpp"),
        new LinkItem("Bouncy Castle RC6 Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RC6Engine.java"),
        new LinkItem("LibTomCrypt RC6 Implementation", "https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/rc6.c")
      ];

      // Test vectors from Crypto++ test suite (rc6val.dat)
      // Source: https://github.com/weidai11/cryptopp/blob/master/TestData/rc6val.dat
      this.tests = [
        {
          text: 'Crypto++ RC6-128 Test Vector #1',
          uri: 'https://github.com/weidai11/cryptopp/blob/master/TestData/rc6val.dat',
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("8FC3A53656B1F778C129DF4E9848A41E")
        },
        {
          text: 'Crypto++ RC6-128 Test Vector #2',
          uri: 'https://github.com/weidai11/cryptopp/blob/master/TestData/rc6val.dat',
          input: OpCodes.Hex8ToBytes("02132435465768798A9BACBDCEDFE0F1"),
          key: OpCodes.Hex8ToBytes("0123456789ABCDEF0112233445566778"),
          expected: OpCodes.Hex8ToBytes("524E192F4715C6231F51F6367EA43F18")
        },
        {
          text: 'Crypto++ RC6-192 Test Vector #1',
          uri: 'https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RC6Test.java',
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("6cd61bcb190b30384e8a3f168690ae82")
        },
        {
          text: 'Crypto++ RC6-256 Test Vector #1',
          uri: 'https://github.com/weidai11/cryptopp/blob/master/TestData/rc6val.dat',
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("8f5fbd0510d15fa893fa3fda6e857ec2")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new RC6Instance(this, isInverse);
    }
  }

  class RC6Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.sTable = null;
      this.rounds = 20; // RC6-32/20/b standard
      this.inputBuffer = [];
      this.BlockSize = 16; // 128-bit blocks
    }

    // Magic constants for RC6-32 (w=32)
    // P = Odd((e-2) * 2^32) where e = 2.718281828...
    static P32 = 0xb7e15163;
    // Q = Odd((phi-1) * 2^32) where phi = 1.618033988... (golden ratio)
    static Q32 = 0x9e3779b9;
    // LGW = log2(32) = 5
    static LGW = 5;

    // Property setter for key - validates and generates key schedule
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.sTable = null;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this._expandKey(keyBytes);
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * RC6 Key Expansion
     * Generates the key schedule S[0..2r+3] from user key
     * Based on the RC6 specification and reference implementations
     */
    _expandKey(keyBytes) {
      const r = this.rounds;
      const c = Math.max(Math.floor((keyBytes.length + 3) / 4), 1);

      // Initialize L array from key bytes (little-endian)
      const L = new Array(c).fill(0);
      for (let i = keyBytes.length - 1; i >= 0; i--) {
        const wordIndex = Math.floor(i / 4);
        L[wordIndex] = ((L[wordIndex] << 8) | (keyBytes[i] & 0xFF)) >>> 0;
      }

      // Initialize S array with magic constants
      const sTableSize = 2 * (r + 2);
      this.sTable = new Array(sTableSize);
      this.sTable[0] = RC6Instance.P32;

      for (let i = 1; i < sTableSize; i++) {
        this.sTable[i] = (this.sTable[i - 1] + RC6Instance.Q32) >>> 0;
      }

      // Mix in the user key
      let A = 0;
      let B = 0;
      let i = 0;
      let j = 0;
      const iterations = 3 * Math.max(sTableSize, c);

      for (let k = 0; k < iterations; k++) {
        // S[i] = ROL(S[i] + A + B, 3)
        A = this.sTable[i] = OpCodes.RotL32((this.sTable[i] + A + B) >>> 0, 3);

        // L[j] = ROL(L[j] + A + B, A + B)
        const sum = (A + B) >>> 0;
        B = L[j] = OpCodes.RotL32((L[j] + sum) >>> 0, sum);

        i = (i + 1) % sTableSize;
        j = (j + 1) % c;
      }
    }

    /**
     * RC6 Encryption
     * Input: 4 words A, B, C, D (128-bit block)
     * Output: 4 words A, B, C, D (128-bit ciphertext)
     */
    _encryptBlock(input) {
      // Load block as 4 little-endian 32-bit words
      let A = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      let B = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
      let C = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]);
      let D = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]);

      // Pre-whitening
      B = (B + this.sTable[0]) >>> 0;
      D = (D + this.sTable[1]) >>> 0;

      // Main rounds
      for (let i = 1; i <= this.rounds; i++) {
        // t = ROL((B * (2B + 1)), 5)
        const tInput = (B * ((2 * B + 1) >>> 0)) >>> 0;
        const t = OpCodes.RotL32(tInput, RC6Instance.LGW);

        // u = ROL((D * (2D + 1)), 5)
        const uInput = (D * ((2 * D + 1) >>> 0)) >>> 0;
        const u = OpCodes.RotL32(uInput, RC6Instance.LGW);

        // A = ROL(A XOR t, u) + S[2i]
        A = (OpCodes.RotL32((A ^ t) >>> 0, u) + this.sTable[2 * i]) >>> 0;

        // C = ROL(C XOR u, t) + S[2i + 1]
        C = (OpCodes.RotL32((C ^ u) >>> 0, t) + this.sTable[2 * i + 1]) >>> 0;

        // (A, B, C, D) = (B, C, D, A)
        const temp = A;
        A = B;
        B = C;
        C = D;
        D = temp;
      }

      // Post-whitening
      A = (A + this.sTable[2 * this.rounds + 2]) >>> 0;
      C = (C + this.sTable[2 * this.rounds + 3]) >>> 0;

      // Convert back to bytes (little-endian)
      const output = [];
      output.push(...OpCodes.Unpack32LE(A));
      output.push(...OpCodes.Unpack32LE(B));
      output.push(...OpCodes.Unpack32LE(C));
      output.push(...OpCodes.Unpack32LE(D));

      return output;
    }

    /**
     * RC6 Decryption
     * Input: 4 words A, B, C, D (128-bit ciphertext)
     * Output: 4 words A, B, C, D (128-bit plaintext)
     */
    _decryptBlock(input) {
      // Load block as 4 little-endian 32-bit words
      let A = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      let B = OpCodes.Pack32LE(input[4], input[5], input[6], input[7]);
      let C = OpCodes.Pack32LE(input[8], input[9], input[10], input[11]);
      let D = OpCodes.Pack32LE(input[12], input[13], input[14], input[15]);

      // Undo post-whitening
      C = (C - this.sTable[2 * this.rounds + 3]) >>> 0;
      A = (A - this.sTable[2 * this.rounds + 2]) >>> 0;

      // Main rounds (in reverse)
      for (let i = this.rounds; i >= 1; i--) {
        // Undo rotation (A, B, C, D) = (B, C, D, A)
        const temp = D;
        D = C;
        C = B;
        B = A;
        A = temp;

        // t = ROL((B * (2B + 1)), 5)
        const tInput = (B * ((2 * B + 1) >>> 0)) >>> 0;
        const t = OpCodes.RotL32(tInput, RC6Instance.LGW);

        // u = ROL((D * (2D + 1)), 5)
        const uInput = (D * ((2 * D + 1) >>> 0)) >>> 0;
        const u = OpCodes.RotL32(uInput, RC6Instance.LGW);

        // C = ROR(C - S[2i + 1], t) XOR u
        C = (OpCodes.RotR32((C - this.sTable[2 * i + 1]) >>> 0, t) ^ u) >>> 0;

        // A = ROR(A - S[2i], u) XOR t
        A = (OpCodes.RotR32((A - this.sTable[2 * i]) >>> 0, u) ^ t) >>> 0;
      }

      // Undo pre-whitening
      D = (D - this.sTable[1]) >>> 0;
      B = (B - this.sTable[0]) >>> 0;

      // Convert back to bytes (little-endian)
      const output = [];
      output.push(...OpCodes.Unpack32LE(A));
      output.push(...OpCodes.Unpack32LE(B));
      output.push(...OpCodes.Unpack32LE(C));
      output.push(...OpCodes.Unpack32LE(D));

      return output;
    }

    // Feed data to the cipher (accumulates until we have complete blocks)
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    // Get the result of the transformation
    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length for block cipher
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);

        const processed = this.isInverse
          ? this._decryptBlock(block)
          : this._encryptBlock(block);

        output.push(...processed);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new RC6Algorithm());

  return {};
}));
