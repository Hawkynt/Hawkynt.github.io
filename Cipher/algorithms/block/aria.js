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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  /**
 * AriaAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class AriaAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ARIA";
      this.description = "Korean national encryption standard (KS X 1213:2004) with 128-bit block size. Supports 128/192/256-bit keys using Substitution-Permutation Network structure.";
      this.inventor = "Korean Agency for Technology and Standards";
      this.year = 2004;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.KR;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 32, 8) // ARIA-128/192/256
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 5794 - ARIA Encryption Algorithm", "https://tools.ietf.org/rfc/rfc5794.txt"),
        new LinkItem("KS X 1213:2004 - Korean Standard", "https://www.kats.go.kr/"),
        new LinkItem("Wikipedia - ARIA cipher", "https://en.wikipedia.org/wiki/ARIA_(cipher)")
      ];

      this.references = [
        new LinkItem("Original ARIA Specification", "https://tools.ietf.org/rfc/rfc5794.txt"),
        new LinkItem("OpenSSL ARIA Implementation", "https://github.com/openssl/openssl/blob/master/crypto/aria/"),
        new LinkItem("Crypto++ ARIA Implementation", "https://github.com/weidai11/cryptopp/blob/master/aria.cpp")
      ];

      // Test vectors from RFC 5794 (official)
      this.tests = [
        {
          text: "DarkCrypt ARIA vector 1/zero",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("c20857dd9106ddde286ec59fa98d77cc")
        },
        {
          text: "DarkCrypt ARIA vector 2/incr",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("7a859561ff6f42df04a242bfea4fe9dc")
        },
        {
          text: "DarkCrypt ARIA vector 3/incr2",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("7570fa11eef8439511faeeaed33d511d")
        },

        {
          text: 'RFC 5794 ARIA-128 Test Vector',
          uri: 'https://tools.ietf.org/rfc/rfc5794.txt',
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("d718fbd6ab644c739da95f3be6451778")
        },
        {
          text: 'RFC 5794 ARIA-192 Test Vector',
          uri: 'https://tools.ietf.org/rfc/rfc5794.txt',
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f1011121314151617"),
          expected: OpCodes.Hex8ToBytes("26449c1805dbe7aa25a468ce263a9e79")
        },
        {
          text: 'RFC 5794 ARIA-256 Test Vector',
          uri: 'https://tools.ietf.org/rfc/rfc5794.txt',
          input: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("f92bd7c79fb72e2f2b8f80c1972d24fc")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {AriaInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new AriaInstance(this, isInverse);
    }
  }

  // ARIA S-boxes from RFC 5794 - SB1, SB2; SB3 and SB4 are their inverses
  const ARIA_SB1 = OpCodes.Hex8ToBytes(
    "637c777bf26b6fc53001672bfed7ab76ca82c97dfa5947f0add4a2af9ca472c0" +
    "b7fd9326363ff7cc34a5e5f171d8311504c723c31896059a071280e2eb27b275" +
    "09832c1a1b6e5aa0523bd6b329e32f8453d100ed20fcb15b6acbbe394a4c58cf" +
    "d0efaafb434d338545f9027f503c9fa851a3408f929d38f5bcb6da2110fff3d2" +
    "cd0c13ec5f974417c4a77e3d645d197360814fdc222a908846eeb814de5e0bdb" +
    "e0323a0a4906245cc2d3ac629195e479e7c8376d8dd54ea96c56f4ea657aae08" +
    "ba78252e1ca6b4c6e8dd741f4bbd8b8a703eb5664803f60e613557b986c11d9e" +
    "e1f8981169d98e949b1e87e9ce5528df8ca1890dbfe6426841992d0fb054bb16"
  );
  Object.freeze(ARIA_SB1);
  const ARIA_SB2 = OpCodes.Hex8ToBytes(
    "e24e54fc94c24acc620d6a463c4d8bd15efa64cbb497be2bbc772e03d31959c1" +
    "1d06416b55f09969ea9c18ae63dfe7bb007366fb964c85e43a0945aa0fee10eb" +
    "2d7ff429accfad918d78c895f92fcecd087a88385c832a2847dbb8c793a41253" +
    "ff870e3136215848018e377432cae9b1b7ab0cd7c4564226079860d9b6b91140" +
    "ec208cbda0c984044923f14f501f13dcd8c09e57e3c37b653b028f3ee82592e5" +
    "15ddfd17a9bfd49a7ec53967fe769d43a7e1d0f568f21b347005a38ad57986a8" +
    "30c6514b1ea627f635d26e2416825fdae675a2ef2cb21c9f5d6f800a72449b6c" +
    "900b5b337d5a52f361a1f7b0d63f7c6ded14e0a53d22b3f889de711aafbab581"
  );
  Object.freeze(ARIA_SB2);
  /**
   * @param {uint8[]} sbox - Forward S-box
   * @returns {uint8[]} Inverse S-box
   */
  function invertSBox(sbox) {
    /** @type {uint8[]} */
    const inverse = new Array(256);
    for (let i = 0; i < 256; i++) {
      inverse[sbox[i]] = i;
    }
    return inverse;
  }

  const ARIA_SB3 = invertSBox(ARIA_SB1);
  Object.freeze(ARIA_SB3);
  const ARIA_SB4 = invertSBox(ARIA_SB2);
  Object.freeze(ARIA_SB4);

  // Key generation constants (RFC 5794)
  /** @type {uint32[][]} */
  const ARIA_C = [
    [0x517cc1b7, 0x27220a94, 0xfe13abe8, 0xfa9a6ee0],
    [0x6db14acc, 0x9e21c820, 0xff28b1d5, 0xef5de2b0],
    [0xdb92371d, 0x2126e970, 0x03249775, 0x04e8c90e]
  ];
  Object.freeze(ARIA_C[0]);
  Object.freeze(ARIA_C[1]);
  Object.freeze(ARIA_C[2]);
  Object.freeze(ARIA_C);

  /**
 * Aria cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class AriaInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {AriaAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      // Copied from the typed algorithm (the C# translation cannot reach it through this.algorithm)
      /** @type {KeySize[]} */
      this._keySizes = algorithm.SupportedKeySizes;
      this.isInverse = isInverse;
      this.key = null;
      /** @type {uint32[][]|null} */
      this.roundKeys = null;
      /** @type {int32} */
      this.rounds = 0;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    // ARIA S-boxes from RFC 5794 - SB1, SB2, SB3, SB4
    static SB1 = ARIA_SB1;

    static SB2 = ARIA_SB2;

    // SB3 and SB4 are inverses of SB1 and SB2 respectively
    static SB3 = ARIA_SB3;
    static SB4 = ARIA_SB4;

    // Key generation constants (RFC 5794)
    static C = ARIA_C;

    // Property setter for key - validates and sets up key schedule
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.KeySize = 0;
        this.rounds = 0;
        return;
      }

      // Validate key size
      const sizes = this._keySizes;
      let isValidSize = false;
      for (let i = 0; i < sizes.length; i++) {
        const ks = sizes[i];
        if (keyBytes.length < ks.minSize || keyBytes.length > ks.maxSize) continue;
        if (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0) {
          isValidSize = true;
          break;
        }
      }

      if (!isValidSize) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes");
      }

      this._key = [...keyBytes]; // Copy the key
      this.KeySize = keyBytes.length;

      // Determine number of rounds based on key length
      if (keyBytes.length === 16) {
        this.rounds = 12; // ARIA-128
      } else if (keyBytes.length === 24) {
        this.rounds = 14; // ARIA-192
      } else {
        this.rounds = 16; // ARIA-256
      }

      this.roundKeys = this._generateKeySchedule(keyBytes);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null; // Return copy
    }

    // Feed data to the cipher (accumulates until we have complete blocks)
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      // Add data to input buffer
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    // Get the result of the transformation
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Process complete blocks
      /** @type {uint8[]} */
      const output = [];
      const blockSize = this.BlockSize;

      // Validate input length for block cipher
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error("Input length must be multiple of " + blockSize + " bytes");
      }

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this.isInverse
          ? this._decryptBlock(block)
          : this._encryptBlock(block);
        for (let _i = 0; _i < processedBlock.length; _i++) output.push(processedBlock[_i]);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Generate ARIA key schedule according to RFC 5794
    /**
     * @param {uint8[]} masterKey - 16, 24 or 32 key bytes
     * @returns {uint32[][]} Round keys of four words
     */
    _generateKeySchedule(masterKey) {
      // Step 1: Split master key into KL (left 128 bits) and KR (remaining bits)
      /** @type {uint32[]} */
      const KL = new Array(4);
      KL.fill(0);
      /** @type {uint32[]} */
      const KR = new Array(4);
      KR.fill(0);

      // Initialize KL with first 128 bits of master key
      for (let i = 0; i < 16; i++) {
        KL[OpCodes.Shr32(i, 2)] = OpCodes.Or32(KL[OpCodes.Shr32(i, 2)], OpCodes.Shl32(masterKey[i], 24 - (i % 4) * 8));
      }

      // Initialize KR with remaining bits (for 192/256-bit keys)
      if (this.KeySize > 16) {
        for (let i = 16; i < Math.min(32, this.KeySize); i++) {
          if (i < masterKey.length) {
            KR[Math.floor((i - 16) / 4)] = OpCodes.Or32(KR[Math.floor((i - 16) / 4)], OpCodes.Shl32(masterKey[i], 24 - ((i - 16) % 4) * 8));
          }
        }
      }

      // Step 2: Select constants based on key size
      /** @type {uint32[]} */
      let CK1;
      /** @type {uint32[]} */
      let CK2;
      /** @type {uint32[]} */
      let CK3;
      if (this.KeySize === 16) {        // ARIA-128
        CK1 = ARIA_C[0];  // C1
        CK2 = ARIA_C[1];  // C2
        CK3 = ARIA_C[2];  // C3
      } else if (this.KeySize === 24) { // ARIA-192
        CK1 = ARIA_C[1];  // C2
        CK2 = ARIA_C[2];  // C3
        CK3 = ARIA_C[0];  // C1
      } else {                          // ARIA-256
        CK1 = ARIA_C[2];  // C3
        CK2 = ARIA_C[0];  // C1
        CK3 = ARIA_C[1];  // C2
      }

      // Step 3: Generate intermediate values W0, W1, W2, W3
      const W0 = [...KL];  // W0 = KL

      // W1 = FO(W0 XOR CK1) XOR KR
      let temp = this._xorWords(W0, CK1);
      temp = this._fo(temp);
      const W1 = this._xorWords(temp, KR);

      // W2 = FE(W1 XOR CK2) XOR W0
      temp = this._xorWords(W1, CK2);
      temp = this._fe(temp);
      const W2 = this._xorWords(temp, W0);

      // W3 = FO(W2 XOR CK3) XOR W1
      temp = this._xorWords(W2, CK3);
      temp = this._fo(temp);
      const W3 = this._xorWords(temp, W1);

      // Step 4: Generate round keys using RFC 5794 formulas
      /** @type {uint32[][]} */
      const rk = [];

      // ek1 = W0^(OpCodes.Shr32(W1, 19))
      rk.push(this._xorWords(W0, this._rotateRight(W1, 19)));

      // ek2 = W1^(OpCodes.Shr32(W2, 19))
      rk.push(this._xorWords(W1, this._rotateRight(W2, 19)));

      // ek3 = W2^(OpCodes.Shr32(W3, 19))
      rk.push(this._xorWords(W2, this._rotateRight(W3, 19)));

      // ek4 = (OpCodes.Shr32(W0, 19))^W3
      rk.push(this._xorWords(this._rotateRight(W0, 19), W3));

      // ek5 = W0^(OpCodes.Shr32(W1, 31))
      rk.push(this._xorWords(W0, this._rotateRight(W1, 31)));

      // ek6 = W1^(OpCodes.Shr32(W2, 31))
      rk.push(this._xorWords(W1, this._rotateRight(W2, 31)));

      // ek7 = W2^(OpCodes.Shr32(W3, 31))
      rk.push(this._xorWords(W2, this._rotateRight(W3, 31)));

      // ek8 = (OpCodes.Shr32(W0, 31))^W3
      rk.push(this._xorWords(this._rotateRight(W0, 31), W3));

      // ek9 = W0^(W1 <<< 61) = W0^(OpCodes.Shr32(W1, 67))
      rk.push(this._xorWords(W0, this._rotateRight(W1, 67)));

      // ek10 = W1^(W2 <<< 61) = W1^(OpCodes.Shr32(W2, 67))
      rk.push(this._xorWords(W1, this._rotateRight(W2, 67)));

      // ek11 = W2^(W3 <<< 61) = W2^(OpCodes.Shr32(W3, 67))
      rk.push(this._xorWords(W2, this._rotateRight(W3, 67)));

      // ek12 = (W0 <<< 61)^W3 = (OpCodes.Shr32(W0, 67))^W3
      rk.push(this._xorWords(this._rotateRight(W0, 67), W3));

      // Additional round keys for ARIA-192/256
      if (this.rounds >= 14) {
        // ek13 = W0^(OpCodes.Shr32(W1, 97))
        rk.push(this._xorWords(W0, this._rotateRight(W1, 97)));
        // ek14 = W1^(OpCodes.Shr32(W2, 97))
        rk.push(this._xorWords(W1, this._rotateRight(W2, 97)));
        // ek15 (final for ARIA-192)
        rk.push(this._xorWords(W2, this._rotateRight(W3, 97)));
      }

      if (this.rounds >= 16) {
        // ek16 = (OpCodes.Shr32(W0, 97))^W3
        rk.push(this._xorWords(this._rotateRight(W0, 97), W3));
        // ek17 = W0^(W1 <<< 19) = W0^(OpCodes.Shr32(W1, 109)) (final for ARIA-256)
        rk.push(this._xorWords(W0, this._rotateRight(W1, 109)));
      }

      // For ARIA-128: need ek13 (final round key) when only 12 generated
      if (this.rounds === 12 && rk.length === 12) {
        rk.push(this._xorWords(W0, this._rotateRight(W1, 97)));
      }

      return rk;
    }

    /**
     * @param {uint32[]} w1 - Four words
     * @param {uint32[]} w2 - Four words
     * @returns {uint32[]} w1 XOR w2
     */
    _xorWords(w1, w2) {
      /** @type {uint32[]} */
      const out = [OpCodes.Xor32(w1[0], w2[0]), OpCodes.Xor32(w1[1], w2[1]), OpCodes.Xor32(w1[2], w2[2]), OpCodes.Xor32(w1[3], w2[3])];
      return out;
    }

    // Rotate 128-bit value right by specified number of bits
    /**
     * @param {uint32[]} words - 128-bit value as four words
     * @param {int32} bits - Rotation amount
     * @returns {uint32[]} Rotated value
     */
    _rotateRight(words, bits) {
      /** @type {uint32[]} */
      const result = new Array(4);
      const wordShift = Math.floor(bits / 32) % 4;
      const bitShift = bits % 32;

      if (bitShift === 0) {
        // Simple word rotation
        for (let i = 0; i < 4; i++) {
          result[i] = words[(i + 4 - wordShift) % 4];
        }
      } else {
        // Bit-level rotation
        for (let i = 0; i < 4; i++) {
          const srcIdx1 = (i + 4 - wordShift) % 4;
          const srcIdx2 = (srcIdx1 + 3) % 4; // Previous word in rotation
          result[i] = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shr32(words[srcIdx1], bitShift), OpCodes.Shl32(words[srcIdx2], 32 - bitShift)));
        }
      }
      return result;
    }

    /**
     * @param {uint32[]} data - Four words
     * @returns {uint32[]} Odd round function output
     */
    _fo(data) {
      let temp = this._substitution1(data);
      temp = this._mixColumns(temp);
      return temp;
    }

    /**
     * @param {uint32[]} data - Four words
     * @returns {uint32[]} Even round function output
     */
    _fe(data) {
      let temp = this._substitution2(data);
      temp = this._mixColumns(temp);
      return temp;
    }

    // SL1 Substitution Layer 1 (Type 1): SB1, SB2, SB3, SB4 pattern
    /**
     * @param {uint32[]} data - Four words
     * @returns {uint32[]} Substituted words
     */
    _substitution1(data) {
      /** @type {uint32[]} */
      const packed = new Array(4);

      // Extract all 16 bytes from the 4 words
      /** @type {uint8[]} */
      const bytes = [];
      for (let i = 0; i < 4; i++) {
        bytes.push(OpCodes.And32(OpCodes.Shr32(data[i], 24), 0xff));
        bytes.push(OpCodes.And32(OpCodes.Shr32(data[i], 16), 0xff));
        bytes.push(OpCodes.And32(OpCodes.Shr32(data[i], 8), 0xff));
        bytes.push(OpCodes.And32(data[i], 0xff));
      }

      // Apply SL1: y[i] = SB[i%4](x[i]) where SB = [SB1, SB2, SB3, SB4]
      /** @type {uint8[][]} */
      const sboxes = [ARIA_SB1, ARIA_SB2, ARIA_SB3, ARIA_SB4];
      for (let i = 0; i < 16; i++) {
        bytes[i] = sboxes[i % 4][bytes[i]];
      }

      // Pack bytes back into words
      for (let i = 0; i < 4; i++) {
        packed[i] = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
                    OpCodes.Shl32(bytes[i*4], 24),
                    OpCodes.Shl32(bytes[i*4+1], 16)),
                    OpCodes.Shl32(bytes[i*4+2], 8)),
                    bytes[i*4+3]));
      }
      return packed;
    }

    // SL2 Substitution Layer 2 (Type 2): SB3, SB4, SB1, SB2 pattern
    /**
     * @param {uint32[]} data - Four words
     * @returns {uint32[]} Substituted words
     */
    _substitution2(data) {
      /** @type {uint32[]} */
      const packed = new Array(4);

      // Extract all 16 bytes from the 4 words
      /** @type {uint8[]} */
      const bytes = [];
      for (let i = 0; i < 4; i++) {
        bytes.push(OpCodes.And32(OpCodes.Shr32(data[i], 24), 0xff));
        bytes.push(OpCodes.And32(OpCodes.Shr32(data[i], 16), 0xff));
        bytes.push(OpCodes.And32(OpCodes.Shr32(data[i], 8), 0xff));
        bytes.push(OpCodes.And32(data[i], 0xff));
      }

      // Apply SL2: y[i] = SB[i%4](x[i]) where SB = [SB3, SB4, SB1, SB2]
      /** @type {uint8[][]} */
      const sboxes = [ARIA_SB3, ARIA_SB4, ARIA_SB1, ARIA_SB2];
      for (let i = 0; i < 16; i++) {
        bytes[i] = sboxes[i % 4][bytes[i]];
      }

      // Pack bytes back into words
      for (let i = 0; i < 4; i++) {
        packed[i] = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
                    OpCodes.Shl32(bytes[i*4], 24),
                    OpCodes.Shl32(bytes[i*4+1], 16)),
                    OpCodes.Shl32(bytes[i*4+2], 8)),
                    bytes[i*4+3]));
      }
      return packed;
    }

    // ARIA Diffusion Layer A function - RFC 5794
    /**
     * @param {uint32[]} data - Four words
     * @returns {uint32[]} Diffused words
     */
    _mixColumns(data) {
      // Convert 32-bit words to individual bytes
      /** @type {uint8[]} */
      const x = [];
      for (let i = 0; i < 4; i++) {
        x.push(OpCodes.And32(OpCodes.Shr32(data[i], 24), 0xff));
        x.push(OpCodes.And32(OpCodes.Shr32(data[i], 16), 0xff));
        x.push(OpCodes.And32(OpCodes.Shr32(data[i], 8), 0xff));
        x.push(OpCodes.And32(data[i], 0xff));
      }

      // Apply ARIA diffusion layer transformation
      /** @type {uint8[]} */
      const y = new Array(16);
      y[0]  = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[3], x[4]), x[6]), x[8]), x[9]), x[13]), x[14]);
      y[1]  = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[2], x[5]), x[7]), x[8]), x[9]), x[12]), x[15]);
      y[2]  = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[1], x[4]), x[6]), x[10]), x[11]), x[12]), x[15]);
      y[3]  = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[0], x[5]), x[7]), x[10]), x[11]), x[13]), x[14]);
      y[4]  = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[0], x[2]), x[5]), x[8]), x[11]), x[14]), x[15]);
      y[5]  = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[1], x[3]), x[4]), x[9]), x[10]), x[14]), x[15]);
      y[6]  = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[0], x[2]), x[7]), x[9]), x[10]), x[12]), x[13]);
      y[7]  = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[1], x[3]), x[6]), x[8]), x[11]), x[12]), x[13]);
      y[8]  = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[0], x[1]), x[4]), x[7]), x[10]), x[13]), x[15]);
      y[9]  = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[0], x[1]), x[5]), x[6]), x[11]), x[12]), x[14]);
      y[10] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[2], x[3]), x[5]), x[6]), x[8]), x[13]), x[15]);
      y[11] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[2], x[3]), x[4]), x[7]), x[9]), x[12]), x[14]);
      y[12] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[1], x[2]), x[6]), x[7]), x[9]), x[11]), x[12]);
      y[13] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[0], x[3]), x[6]), x[7]), x[8]), x[10]), x[13]);
      y[14] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[0], x[3]), x[4]), x[5]), x[9]), x[11]), x[14]);
      y[15] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x[1], x[2]), x[4]), x[5]), x[8]), x[10]), x[15]);

      // Convert bytes back to 32-bit words
      /** @type {uint32[]} */
      const packed = new Array(4);
      for (let i = 0; i < 4; i++) {
        packed[i] = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
                    OpCodes.Shl32(y[i*4], 24),
                    OpCodes.Shl32(y[i*4+1], 16)),
                    OpCodes.Shl32(y[i*4+2], 8)),
                    y[i*4+3]));
      }

      return packed;
    }

    // Encrypt 128-bit block
    /**
     * @param {uint8[]} plaintext - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(plaintext) {
      if (plaintext.length !== 16) {
        throw new Error('Input must be exactly 16 bytes');
      }

      // Convert bytes to 32-bit words
      /** @type {uint32[]} */
      let words = [
        OpCodes.Pack32BE(plaintext[0], plaintext[1], plaintext[2], plaintext[3]),
        OpCodes.Pack32BE(plaintext[4], plaintext[5], plaintext[6], plaintext[7]),
        OpCodes.Pack32BE(plaintext[8], plaintext[9], plaintext[10], plaintext[11]),
        OpCodes.Pack32BE(plaintext[12], plaintext[13], plaintext[14], plaintext[15])
      ];

      // Initial round key addition
      words = this._xorWords(words, this.roundKeys[0]);

      // Main rounds
      for (let round = 1; round < this.rounds; round++) {
        if (round % 2 === 1) {
          words = this._fo(words);
        } else {
          words = this._fe(words);
        }
        words = this._xorWords(words, this.roundKeys[round]);
      }

      // Final substitution (odd/even depends on total rounds)
      if (this.rounds % 2 === 0) {
        words = this._substitution2(words);
      } else {
        words = this._substitution1(words);
      }

      // Final round key addition
      words = this._xorWords(words, this.roundKeys[this.rounds]);

      // Convert back to bytes
      return [
        OpCodes.And32(OpCodes.Shr32(words[0], 24), 0xff), OpCodes.And32(OpCodes.Shr32(words[0], 16), 0xff), OpCodes.And32(OpCodes.Shr32(words[0], 8), 0xff), OpCodes.And32(words[0], 0xff),
        OpCodes.And32(OpCodes.Shr32(words[1], 24), 0xff), OpCodes.And32(OpCodes.Shr32(words[1], 16), 0xff), OpCodes.And32(OpCodes.Shr32(words[1], 8), 0xff), OpCodes.And32(words[1], 0xff),
        OpCodes.And32(OpCodes.Shr32(words[2], 24), 0xff), OpCodes.And32(OpCodes.Shr32(words[2], 16), 0xff), OpCodes.And32(OpCodes.Shr32(words[2], 8), 0xff), OpCodes.And32(words[2], 0xff),
        OpCodes.And32(OpCodes.Shr32(words[3], 24), 0xff), OpCodes.And32(OpCodes.Shr32(words[3], 16), 0xff), OpCodes.And32(OpCodes.Shr32(words[3], 8), 0xff), OpCodes.And32(words[3], 0xff)
      ];
    }

    // Decrypt 128-bit block
    /**
     * @param {uint8[]} ciphertext - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(ciphertext) {
      if (ciphertext.length !== 16) {
        throw new Error('Input must be exactly 16 bytes');
      }

      // Convert bytes to 32-bit words
      /** @type {uint32[]} */
      let words = [
        OpCodes.Pack32BE(ciphertext[0], ciphertext[1], ciphertext[2], ciphertext[3]),
        OpCodes.Pack32BE(ciphertext[4], ciphertext[5], ciphertext[6], ciphertext[7]),
        OpCodes.Pack32BE(ciphertext[8], ciphertext[9], ciphertext[10], ciphertext[11]),
        OpCodes.Pack32BE(ciphertext[12], ciphertext[13], ciphertext[14], ciphertext[15])
      ];

      // Initial round key addition (same as final encryption key)
      words = this._xorWords(words, this.roundKeys[this.rounds]);

      // Inverse final substitution
      if (this.rounds % 2 === 0) {
        words = this._invSubstitution2(words);
      } else {
        words = this._invSubstitution1(words);
      }

      // Main rounds in reverse
      for (let round = this.rounds - 1; round >= 1; round--) {
        words = this._xorWords(words, this.roundKeys[round]);

        if (round % 2 === 1) {
          words = this._invFo(words);
        } else {
          words = this._invFe(words);
        }
      }

      // Final round key addition
      words = this._xorWords(words, this.roundKeys[0]);

      // Convert back to bytes
      return [
        OpCodes.And32(OpCodes.Shr32(words[0], 24), 0xff), OpCodes.And32(OpCodes.Shr32(words[0], 16), 0xff), OpCodes.And32(OpCodes.Shr32(words[0], 8), 0xff), OpCodes.And32(words[0], 0xff),
        OpCodes.And32(OpCodes.Shr32(words[1], 24), 0xff), OpCodes.And32(OpCodes.Shr32(words[1], 16), 0xff), OpCodes.And32(OpCodes.Shr32(words[1], 8), 0xff), OpCodes.And32(words[1], 0xff),
        OpCodes.And32(OpCodes.Shr32(words[2], 24), 0xff), OpCodes.And32(OpCodes.Shr32(words[2], 16), 0xff), OpCodes.And32(OpCodes.Shr32(words[2], 8), 0xff), OpCodes.And32(words[2], 0xff),
        OpCodes.And32(OpCodes.Shr32(words[3], 24), 0xff), OpCodes.And32(OpCodes.Shr32(words[3], 16), 0xff), OpCodes.And32(OpCodes.Shr32(words[3], 8), 0xff), OpCodes.And32(words[3], 0xff)
      ];
    }

    /**
     * @param {uint32[]} data - Four words
     * @returns {uint32[]} Inverse odd round function output
     */
    _invFo(data) {
      let temp = this._invMixColumns(data);
      temp = this._invSubstitution1(temp);
      return temp;
    }

    /**
     * @param {uint32[]} data - Four words
     * @returns {uint32[]} Inverse even round function output
     */
    _invFe(data) {
      let temp = this._invMixColumns(data);
      temp = this._invSubstitution2(temp);
      return temp;
    }

    // Inverse substitution functions - SL2 is inverse of SL1
    /**
     * @param {uint32[]} data - Four words
     * @returns {uint32[]} SL1 inverse (= SL2)
     */
    _invSubstitution1(data) {
      return this._substitution2(data); // SL2 is inverse of SL1
    }

    /**
     * @param {uint32[]} data - Four words
     * @returns {uint32[]} SL2 inverse (= SL1)
     */
    _invSubstitution2(data) {
      return this._substitution1(data); // SL1 is inverse of SL2
    }

    /**
     * @param {uint32[]} data - Four words
     * @returns {uint32[]} Diffused words (the layer is an involution)
     */
    _invMixColumns(data) {
      // ARIA diffusion is involutory - same operation for encryption and decryption
      return this._mixColumns(data);
    }
  }

  // Register the algorithm
  const algorithmInstance = new AriaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // Export
  return { AriaAlgorithm, AriaInstance };
}));