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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

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

    CreateInstance(isInverse = false) {
      return new AriaInstance(this, isInverse);
    }
  }

  class AriaInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeys = null;
      this.rounds = 0;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    // ARIA S-boxes from RFC 5794 - SB1, SB2, SB3, SB4
    static SB1 = Object.freeze([
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
    ]);

    static SB2 = Object.freeze([
      0xe2, 0x4e, 0x54, 0xfc, 0x94, 0xc2, 0x4a, 0xcc, 0x62, 0x0d, 0x6a, 0x46, 0x3c, 0x4d, 0x8b, 0xd1,
      0x5e, 0xfa, 0x64, 0xcb, 0xb4, 0x97, 0xbe, 0x2b, 0xbc, 0x77, 0x2e, 0x03, 0xd3, 0x19, 0x59, 0xc1,
      0x1d, 0x06, 0x41, 0x6b, 0x55, 0xf0, 0x99, 0x69, 0xea, 0x9c, 0x18, 0xae, 0x63, 0xdf, 0xe7, 0xbb,
      0x00, 0x73, 0x66, 0xfb, 0x96, 0x4c, 0x85, 0xe4, 0x3a, 0x09, 0x45, 0xaa, 0x0f, 0xee, 0x10, 0xeb,
      0x2d, 0x7f, 0xf4, 0x29, 0xac, 0xcf, 0xad, 0x91, 0x8d, 0x78, 0xc8, 0x95, 0xf9, 0x2f, 0xce, 0xcd,
      0x08, 0x7a, 0x88, 0x38, 0x5c, 0x83, 0x2a, 0x28, 0x47, 0xdb, 0xb8, 0xc7, 0x93, 0xa4, 0x12, 0x53,
      0xff, 0x87, 0x0e, 0x31, 0x36, 0x21, 0x58, 0x48, 0x01, 0x8e, 0x37, 0x74, 0x32, 0xca, 0xe9, 0xb1,
      0xb7, 0xab, 0x0c, 0xd7, 0xc4, 0x56, 0x42, 0x26, 0x07, 0x98, 0x60, 0xd9, 0xb6, 0xb9, 0x11, 0x40,
      0xec, 0x20, 0x8c, 0xbd, 0xa0, 0xc9, 0x84, 0x04, 0x49, 0x23, 0xf1, 0x4f, 0x50, 0x1f, 0x13, 0xdc,
      0xd8, 0xc0, 0x9e, 0x57, 0xe3, 0xc3, 0x7b, 0x65, 0x3b, 0x02, 0x8f, 0x3e, 0xe8, 0x25, 0x92, 0xe5,
      0x15, 0xdd, 0xfd, 0x17, 0xa9, 0xbf, 0xd4, 0x9a, 0x7e, 0xc5, 0x39, 0x67, 0xfe, 0x76, 0x9d, 0x43,
      0xa7, 0xe1, 0xd0, 0xf5, 0x68, 0xf2, 0x1b, 0x34, 0x70, 0x05, 0xa3, 0x8a, 0xd5, 0x79, 0x86, 0xa8,
      0x30, 0xc6, 0x51, 0x4b, 0x1e, 0xa6, 0x27, 0xf6, 0x35, 0xd2, 0x6e, 0x24, 0x16, 0x82, 0x5f, 0xda,
      0xe6, 0x75, 0xa2, 0xef, 0x2c, 0xb2, 0x1c, 0x9f, 0x5d, 0x6f, 0x80, 0x0a, 0x72, 0x44, 0x9b, 0x6c,
      0x90, 0x0b, 0x5b, 0x33, 0x7d, 0x5a, 0x52, 0xf3, 0x61, 0xa1, 0xf7, 0xb0, 0xd6, 0x3f, 0x7c, 0x6d,
      0xed, 0x14, 0xe0, 0xa5, 0x3d, 0x22, 0xb3, 0xf8, 0x89, 0xde, 0x71, 0x1a, 0xaf, 0xba, 0xb5, 0x81
    ]);

    // SB3 and SB4 are inverses of SB1 and SB2 respectively
    static SB3 = null; // Will be computed
    static SB4 = null; // Will be computed

    // Initialize inverse S-boxes
    static {
      // Compute SB3 as inverse of SB1
      const sb3 = new Array(256);
      for (let i = 0; i < 256; i++) {
        sb3[AriaInstance.SB1[i]] = i;
      }
      AriaInstance.SB3 = Object.freeze(sb3);

      // Compute SB4 as inverse of SB2
      const sb4 = new Array(256);
      for (let i = 0; i < 256; i++) {
        sb4[AriaInstance.SB2[i]] = i;
      }
      AriaInstance.SB4 = Object.freeze(sb4);
    }

    // Key generation constants (RFC 5794)
    static C = Object.freeze([
      Object.freeze([0x517cc1b7, 0x27220a94, 0xfe13abe8, 0xfa9a6ee0]),
      Object.freeze([0x6db14acc, 0x9e21c820, 0xff28b1d5, 0xef5de2b0]),
      Object.freeze([0xdb92371d, 0x2126e970, 0x03249775, 0x04e8c90e])
    ]);

    // Property setter for key - validates and sets up key schedule
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeys = null;
        this.KeySize = 0;
        this.rounds = 0;
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

    get key() {
      return this._key ? [...this._key] : null; // Return copy
    }

    // Feed data to the cipher (accumulates until we have complete blocks)
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      // Add data to input buffer
      this.inputBuffer.push(...data);
    }

    // Get the result of the transformation
    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Process complete blocks
      const output = [];
      const blockSize = this.BlockSize;

      // Validate input length for block cipher
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error(`Input length must be multiple of ${blockSize} bytes`);
      }

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);
        const processedBlock = this.isInverse
          ? this._decryptBlock(block)
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Generate ARIA key schedule according to RFC 5794
    _generateKeySchedule(masterKey) {
      // Step 1: Split master key into KL (left 128 bits) and KR (remaining bits)
      const KL = new Array(4).fill(0);
      const KR = new Array(4).fill(0);

      // Initialize KL with first 128 bits of master key
      for (let i = 0; i < 16; i++) {
        KL[i >> 2] |= masterKey[i] << (24 - ((i & 3) * 8));
      }

      // Initialize KR with remaining bits (for 192/256-bit keys)
      if (this.KeySize > 16) {
        for (let i = 16; i < Math.min(32, this.KeySize); i++) {
          if (i < masterKey.length) {
            KR[Math.floor((i - 16) / 4)] |= masterKey[i] << (24 - (((i - 16) & 3) * 8));
          }
        }
      }

      // Step 2: Select constants based on key size
      let CK1, CK2, CK3;
      if (this.KeySize === 16) {        // ARIA-128
        CK1 = AriaInstance.C[0];  // C1
        CK2 = AriaInstance.C[1];  // C2
        CK3 = AriaInstance.C[2];  // C3
      } else if (this.KeySize === 24) { // ARIA-192
        CK1 = AriaInstance.C[1];  // C2
        CK2 = AriaInstance.C[2];  // C3
        CK3 = AriaInstance.C[0];  // C1
      } else {                          // ARIA-256
        CK1 = AriaInstance.C[2];  // C3
        CK2 = AriaInstance.C[0];  // C1
        CK3 = AriaInstance.C[1];  // C2
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
      const rk = [];

      // ek1 = W0 ^ (W1 >>> 19)
      rk[0] = this._xorWords(W0, this._rotateRight(W1, 19));

      // ek2 = W1 ^ (W2 >>> 19)
      rk[1] = this._xorWords(W1, this._rotateRight(W2, 19));

      // ek3 = W2 ^ (W3 >>> 19)
      rk[2] = this._xorWords(W2, this._rotateRight(W3, 19));

      // ek4 = (W0 >>> 19) ^ W3
      rk[3] = this._xorWords(this._rotateRight(W0, 19), W3);

      // ek5 = W0 ^ (W1 >>> 31)
      rk[4] = this._xorWords(W0, this._rotateRight(W1, 31));

      // ek6 = W1 ^ (W2 >>> 31)
      rk[5] = this._xorWords(W1, this._rotateRight(W2, 31));

      // ek7 = W2 ^ (W3 >>> 31)
      rk[6] = this._xorWords(W2, this._rotateRight(W3, 31));

      // ek8 = (W0 >>> 31) ^ W3
      rk[7] = this._xorWords(this._rotateRight(W0, 31), W3);

      // ek9 = W0 ^ (W1 <<< 61) = W0 ^ (W1 >>> 67)
      rk[8] = this._xorWords(W0, this._rotateRight(W1, 67));

      // ek10 = W1 ^ (W2 <<< 61) = W1 ^ (W2 >>> 67)
      rk[9] = this._xorWords(W1, this._rotateRight(W2, 67));

      // ek11 = W2 ^ (W3 <<< 61) = W2 ^ (W3 >>> 67)
      rk[10] = this._xorWords(W2, this._rotateRight(W3, 67));

      // ek12 = (W0 <<< 61) ^ W3 = (W0 >>> 67) ^ W3
      rk[11] = this._xorWords(this._rotateRight(W0, 67), W3);

      // Additional round keys for ARIA-192/256
      if (this.rounds >= 14) {
        // ek13 = W0 ^ (W1 >>> 97)
        rk[12] = this._xorWords(W0, this._rotateRight(W1, 97));
        // ek14 = W1 ^ (W2 >>> 97)
        rk[13] = this._xorWords(W1, this._rotateRight(W2, 97));
        // ek15 (final for ARIA-192)
        rk[14] = this._xorWords(W2, this._rotateRight(W3, 97));
      }

      if (this.rounds >= 16) {
        // ek16 = (W0 >>> 97) ^ W3
        rk[15] = this._xorWords(this._rotateRight(W0, 97), W3);
        // ek17 = W0 ^ (W1 <<< 19) = W0 ^ (W1 >>> 109) (final for ARIA-256)
        rk[16] = this._xorWords(W0, this._rotateRight(W1, 109));
      }

      // For ARIA-128: need ek13 (final round key) when only 12 generated
      if (this.rounds === 12 && rk.length === 12) {
        rk[12] = this._xorWords(W0, this._rotateRight(W1, 97));
      }

      return rk;
    }

    _xorWords(w1, w2) {
      return [w1[0] ^ w2[0], w1[1] ^ w2[1], w1[2] ^ w2[2], w1[3] ^ w2[3]];
    }

    // Rotate 128-bit value right by specified number of bits
    _rotateRight(words, bits) {
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
          result[i] = ((words[srcIdx1] >>> bitShift) | (words[srcIdx2] << (32 - bitShift))) >>> 0;
        }
      }
      return result;
    }

    _fo(data) {
      let temp = this._substitution1(data);
      temp = this._mixColumns(temp);
      return temp;
    }

    _fe(data) {
      let temp = this._substitution2(data);
      temp = this._mixColumns(temp);
      return temp;
    }

    // SL1 Substitution Layer 1 (Type 1): SB1, SB2, SB3, SB4 pattern
    _substitution1(data) {
      const result = new Array(4);

      // Extract all 16 bytes from the 4 words
      const bytes = [];
      for (let i = 0; i < 4; i++) {
        bytes.push((data[i] >>> 24) & 0xff);
        bytes.push((data[i] >>> 16) & 0xff);
        bytes.push((data[i] >>> 8) & 0xff);
        bytes.push(data[i] & 0xff);
      }

      // Apply SL1: y[i] = SB[i%4](x[i]) where SB = [SB1, SB2, SB3, SB4]
      const sboxes = [AriaInstance.SB1, AriaInstance.SB2, AriaInstance.SB3, AriaInstance.SB4];
      for (let i = 0; i < 16; i++) {
        bytes[i] = sboxes[i % 4][bytes[i]];
      }

      // Pack bytes back into words
      for (let i = 0; i < 4; i++) {
        result[i] = (bytes[i*4] << 24) | (bytes[i*4+1] << 16) | (bytes[i*4+2] << 8) | bytes[i*4+3];
        result[i] >>>= 0;
      }
      return result;
    }

    // SL2 Substitution Layer 2 (Type 2): SB3, SB4, SB1, SB2 pattern
    _substitution2(data) {
      const result = new Array(4);

      // Extract all 16 bytes from the 4 words
      const bytes = [];
      for (let i = 0; i < 4; i++) {
        bytes.push((data[i] >>> 24) & 0xff);
        bytes.push((data[i] >>> 16) & 0xff);
        bytes.push((data[i] >>> 8) & 0xff);
        bytes.push(data[i] & 0xff);
      }

      // Apply SL2: y[i] = SB[i%4](x[i]) where SB = [SB3, SB4, SB1, SB2]
      const sboxes = [AriaInstance.SB3, AriaInstance.SB4, AriaInstance.SB1, AriaInstance.SB2];
      for (let i = 0; i < 16; i++) {
        bytes[i] = sboxes[i % 4][bytes[i]];
      }

      // Pack bytes back into words
      for (let i = 0; i < 4; i++) {
        result[i] = (bytes[i*4] << 24) | (bytes[i*4+1] << 16) | (bytes[i*4+2] << 8) | bytes[i*4+3];
        result[i] >>>= 0;
      }
      return result;
    }

    // ARIA Diffusion Layer A function - RFC 5794
    _mixColumns(data) {
      // Convert 32-bit words to individual bytes
      const x = [];
      for (let i = 0; i < 4; i++) {
        x.push((data[i] >>> 24) & 0xff);
        x.push((data[i] >>> 16) & 0xff);
        x.push((data[i] >>> 8) & 0xff);
        x.push(data[i] & 0xff);
      }

      // Apply ARIA diffusion layer transformation
      const y = new Array(16);
      y[0]  = x[3] ^ x[4] ^ x[6] ^ x[8]  ^ x[9]  ^ x[13] ^ x[14];
      y[1]  = x[2] ^ x[5] ^ x[7] ^ x[8]  ^ x[9]  ^ x[12] ^ x[15];
      y[2]  = x[1] ^ x[4] ^ x[6] ^ x[10] ^ x[11] ^ x[12] ^ x[15];
      y[3]  = x[0] ^ x[5] ^ x[7] ^ x[10] ^ x[11] ^ x[13] ^ x[14];
      y[4]  = x[0] ^ x[2] ^ x[5] ^ x[8]  ^ x[11] ^ x[14] ^ x[15];
      y[5]  = x[1] ^ x[3] ^ x[4] ^ x[9]  ^ x[10] ^ x[14] ^ x[15];
      y[6]  = x[0] ^ x[2] ^ x[7] ^ x[9]  ^ x[10] ^ x[12] ^ x[13];
      y[7]  = x[1] ^ x[3] ^ x[6] ^ x[8]  ^ x[11] ^ x[12] ^ x[13];
      y[8]  = x[0] ^ x[1] ^ x[4] ^ x[7]  ^ x[10] ^ x[13] ^ x[15];
      y[9]  = x[0] ^ x[1] ^ x[5] ^ x[6]  ^ x[11] ^ x[12] ^ x[14];
      y[10] = x[2] ^ x[3] ^ x[5] ^ x[6]  ^ x[8]  ^ x[13] ^ x[15];
      y[11] = x[2] ^ x[3] ^ x[4] ^ x[7]  ^ x[9]  ^ x[12] ^ x[14];
      y[12] = x[1] ^ x[2] ^ x[6] ^ x[7]  ^ x[9]  ^ x[11] ^ x[12];
      y[13] = x[0] ^ x[3] ^ x[6] ^ x[7]  ^ x[8]  ^ x[10] ^ x[13];
      y[14] = x[0] ^ x[3] ^ x[4] ^ x[5]  ^ x[9]  ^ x[11] ^ x[14];
      y[15] = x[1] ^ x[2] ^ x[4] ^ x[5]  ^ x[8]  ^ x[10] ^ x[15];

      // Convert bytes back to 32-bit words
      const result = new Array(4);
      for (let i = 0; i < 4; i++) {
        result[i] = (y[i*4] << 24) | (y[i*4+1] << 16) | (y[i*4+2] << 8) | y[i*4+3];
        result[i] >>>= 0; // Ensure unsigned 32-bit
      }

      return result;
    }

    // Encrypt 128-bit block
    _encryptBlock(plaintext) {
      if (plaintext.length !== 16) {
        throw new Error('Input must be exactly 16 bytes');
      }

      // Convert bytes to 32-bit words
      let state = [
        OpCodes.Pack32BE(plaintext[0], plaintext[1], plaintext[2], plaintext[3]),
        OpCodes.Pack32BE(plaintext[4], plaintext[5], plaintext[6], plaintext[7]),
        OpCodes.Pack32BE(plaintext[8], plaintext[9], plaintext[10], plaintext[11]),
        OpCodes.Pack32BE(plaintext[12], plaintext[13], plaintext[14], plaintext[15])
      ];

      // Initial round key addition
      state = this._xorWords(state, this.roundKeys[0]);

      // Main rounds
      for (let round = 1; round < this.rounds; round++) {
        if (round % 2 === 1) {
          state = this._fo(state);
        } else {
          state = this._fe(state);
        }
        state = this._xorWords(state, this.roundKeys[round]);
      }

      // Final substitution (odd/even depends on total rounds)
      if (this.rounds % 2 === 0) {
        state = this._substitution2(state);
      } else {
        state = this._substitution1(state);
      }

      // Final round key addition
      state = this._xorWords(state, this.roundKeys[this.rounds]);

      // Convert back to bytes
      return [
        (state[0] >>> 24) & 0xff, (state[0] >>> 16) & 0xff, (state[0] >>> 8) & 0xff, state[0] & 0xff,
        (state[1] >>> 24) & 0xff, (state[1] >>> 16) & 0xff, (state[1] >>> 8) & 0xff, state[1] & 0xff,
        (state[2] >>> 24) & 0xff, (state[2] >>> 16) & 0xff, (state[2] >>> 8) & 0xff, state[2] & 0xff,
        (state[3] >>> 24) & 0xff, (state[3] >>> 16) & 0xff, (state[3] >>> 8) & 0xff, state[3] & 0xff
      ];
    }

    // Decrypt 128-bit block
    _decryptBlock(ciphertext) {
      if (ciphertext.length !== 16) {
        throw new Error('Input must be exactly 16 bytes');
      }

      // Convert bytes to 32-bit words
      let state = [
        OpCodes.Pack32BE(ciphertext[0], ciphertext[1], ciphertext[2], ciphertext[3]),
        OpCodes.Pack32BE(ciphertext[4], ciphertext[5], ciphertext[6], ciphertext[7]),
        OpCodes.Pack32BE(ciphertext[8], ciphertext[9], ciphertext[10], ciphertext[11]),
        OpCodes.Pack32BE(ciphertext[12], ciphertext[13], ciphertext[14], ciphertext[15])
      ];

      // Initial round key addition (same as final encryption key)
      state = this._xorWords(state, this.roundKeys[this.rounds]);

      // Inverse final substitution
      if (this.rounds % 2 === 0) {
        state = this._invSubstitution2(state);
      } else {
        state = this._invSubstitution1(state);
      }

      // Main rounds in reverse
      for (let round = this.rounds - 1; round >= 1; round--) {
        state = this._xorWords(state, this.roundKeys[round]);

        if (round % 2 === 1) {
          state = this._invFo(state);
        } else {
          state = this._invFe(state);
        }
      }

      // Final round key addition
      state = this._xorWords(state, this.roundKeys[0]);

      // Convert back to bytes
      return [
        (state[0] >>> 24) & 0xff, (state[0] >>> 16) & 0xff, (state[0] >>> 8) & 0xff, state[0] & 0xff,
        (state[1] >>> 24) & 0xff, (state[1] >>> 16) & 0xff, (state[1] >>> 8) & 0xff, state[1] & 0xff,
        (state[2] >>> 24) & 0xff, (state[2] >>> 16) & 0xff, (state[2] >>> 8) & 0xff, state[2] & 0xff,
        (state[3] >>> 24) & 0xff, (state[3] >>> 16) & 0xff, (state[3] >>> 8) & 0xff, state[3] & 0xff
      ];
    }

    _invFo(data) {
      let temp = this._invMixColumns(data);
      temp = this._invSubstitution1(temp);
      return temp;
    }

    _invFe(data) {
      let temp = this._invMixColumns(data);
      temp = this._invSubstitution2(temp);
      return temp;
    }

    // Inverse substitution functions - SL2 is inverse of SL1
    _invSubstitution1(data) {
      return this._substitution2(data); // SL2 is inverse of SL1
    }

    _invSubstitution2(data) {
      return this._substitution1(data); // SL1 is inverse of SL2
    }

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