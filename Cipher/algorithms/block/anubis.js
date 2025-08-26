/*
 * Anubis Block Cipher Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * Anubis is a 128-bit block cipher designed by Vincent Rijmen and Paulo S.L.M. Barreto
 * for the NESSIE project. Features variable key length from 128-320 bits.
 */


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

  // ===== ALGORITHM IMPLEMENTATION =====

  class AnubisAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Anubis";
      this.description = "128-bit block cipher designed by Vincent Rijmen and Paulo Barreto for the NESSIE project. Features variable key length from 128-320 bits in 32-bit increments.";
      this.inventor = "Vincent Rijmen, Paulo S.L.M. Barreto";
      this.year = 2000;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 40, 4) // 128-320 bits in 32-bit increments
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("NESSIE Project - Anubis Specification", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/anubis.zip"),
        new LinkItem("Wikipedia - Anubis (cipher)", "https://en.wikipedia.org/wiki/Anubis_(cipher)"),
        new LinkItem("Original Anubis Paper", "https://www.cosic.esat.kuleuven.be/publications/article-40.pdf")
      ];

      this.references = [
        new LinkItem("NESSIE Reference Implementation", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions.html"),
        new LinkItem("Crypto++ Anubis Implementation", "https://github.com/weidai11/cryptopp/blob/master/anubis.cpp")
      ];

      // Test vectors
      this.tests = [
        {
          text: "NESSIE Test Vector - 128-bit key all zeros",
          uri: "https://www.cosic.esat.kuleuven.be/nessie/testvectors/",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("625F0F663BF00F2D67B1E8B04F67A484")
        },
        {
          text: "NESSIE Test Vector - 128-bit key test pattern",
          uri: "https://www.cosic.esat.kuleuven.be/nessie/testvectors/",
          input: OpCodes.Hex8ToBytes("0123456789ABCDEF0011223344556677"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("020AA91C3A43B34445471767436BEE2D")
        },
        {
          text: "NESSIE Test Vector - 160-bit key",
          uri: "https://www.cosic.esat.kuleuven.be/nessie/testvectors/",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("761E6A8D9816F79F24EE40010F729098")
        }
      ];

      // Initialize lookup tables
      this._initializeTables();
    }

    CreateInstance(isInverse = false) {
      return new AnubisInstance(this, isInverse);
    }

    _initializeTables() {
      // Anubis S-box - original implementation from Paulo Barreto and Vincent Rijmen
      this.sbox = "\ua7d3\ue671\ud0ac\u4d79\u3ac9\u91fc\u1e47\u54bd" +
                  "\u8ca5\u7afb\u63b8\uddd4\ue5b3\uc5be\ua988\u0ca2" +
                  "\u39df\u29da\u2ba8\ucb4c\u4b22\uaa24\u4170\ua6f9" +
                  "\u5ae2\ub036\u7de4\u33ff\u6020\u088b\u5eab\u7f78" +
                  "\u7c2c\u57d2\udc6d\u7e0d\u5394\uc328\u2706\u5fad" +
                  "\u675c\u5548\u0e52\uea42\u5b5d\u3058\u5159\u3c4e" +
                  "\u388a\u7214\ue7c6\ude50\u8e92\ud177\u9345\u9ace" +
                  "\u2d03\u62b6\ub9bf\u966b\u3f07\u12ae\u4034\u463e" +
                  "\udbcf\ueccc\uc1a1\uc0d6\u1df4\u613b\u10d8\u68a0" +
                  "\ub10a\u696c\u49fa\u76c4\u9e9b\u6e99\uc2b7\u98bc" +
                  "\u8f85\u1fb4\uf811\u2e00\u251c\u2a3d\u054f\u7bb2" +
                  "\u3290\uaf19\ua3f7\u739d\u1574\ueeca\u9f0f\u1b75" +
                  "\u8684\u9c4a\u971a\u65f6\ued09\ubb26\u83eb\u6f81" +
                  "\u046a\u4301\u17e1\u87f5\u8de3\u2380\u4416\u6621" +
                  "\ufed5\u31d9\u3518\u0264\uf2f1\u56cd\u82c8\ubaf0" +
                  "\uefe9\ue8fd\u89d7\uc7b5\ua42f\u9513\u0bf3\ue037";

      // Initialize lookup tables
      this.T0 = new Array(256);
      this.T1 = new Array(256);
      this.T2 = new Array(256);
      this.T3 = new Array(256);
      this.T4 = new Array(256);
      this.T5 = new Array(256);

      for (let x = 0; x < 256; x++) {
        // Extract S-box value
        const c = this.sbox.charCodeAt(Math.floor(x / 2)) & 0xffff;
        const s1 = ((x & 1) === 0) ? (c >>> 8) : (c & 0xff);

        // Compute multiplications in GF(2^8) with irreducible polynomial 0x11d
        const s2 = this._gfMul(s1, 2);
        const s4 = this._gfMul(s1, 4);
        const s6 = s4 ^ s2;

        const x2 = this._gfMul(x, 2);
        const x4 = this._gfMul(x, 4);
        const x6 = x2 ^ x4;
        const x8 = this._gfMul(x, 8);

        // Build lookup tables using OpCodes for clean word packing
        this.T0[x] = OpCodes.Pack32BE(s1, s2, s4, s6);
        this.T1[x] = OpCodes.Pack32BE(s2, s1, s6, s4);
        this.T2[x] = OpCodes.Pack32BE(s4, s6, s1, s2);
        this.T3[x] = OpCodes.Pack32BE(s6, s4, s2, s1);
        this.T4[x] = OpCodes.Pack32BE(s1, s1, s1, s1);
        this.T5[x] = OpCodes.Pack32BE(x, x2, x6, x8);
      }
    }

    // GF(2^8) multiplication helper with polynomial 0x11d
    _gfMul(a, b) {
      let result = 0;
      a &= 0xff;
      b &= 0xff;

      while (b > 0) {
        if (b & 1) {
          result ^= a;
        }
        a <<= 1;
        if (a & 0x100) {
          a ^= 0x11d; // Irreducible polynomial
        }
        b >>>= 1;
      }
      return result & 0xff;
    }
  }

  // Instance class for actual encryption/decryption
  class AnubisInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeyEnc = null;
      this.roundKeyDec = null;
      this.inputBuffer = [];
      this.BlockSize = 16; // 128 bits
      this.KeySize = 0;
    }

    // Property setter for key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.roundKeyEnc = null;
        this.roundKeyDec = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
        (keyBytes.length - ks.minSize) % ks.stepSize === 0
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._generateKeySchedule(keyBytes);
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];
      const roundKey = this.isInverse ? this.roundKeyDec : this.roundKeyEnc;

      // Process each block
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processedBlock = this._crypt(block, roundKey);
        output.push(...processedBlock);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    // Core encryption/decryption function
    _crypt(bytes, roundKey) {
      if (bytes.length !== 16) {
        throw new Error('Anubis requires exactly 16-byte blocks');
      }

      const state = new Array(4);
      const inter = new Array(4);
      const R = roundKey.length - 1;

      // Convert input bytes to state array
      for (let i = 0; i < 4; i++) {
        state[i] = OpCodes.Pack32BE(bytes[i*4], bytes[i*4+1], bytes[i*4+2], bytes[i*4+3]);
        state[i] = (state[i] ^ roundKey[0][i]) >>> 0;
      }

      // R-1 full rounds
      for (let r = 1; r < R; r++) {
        inter[0] = (this.algorithm.T0[(state[0] >>> 24) & 0xff] ^
                    this.algorithm.T1[(state[1] >>> 24) & 0xff] ^
                    this.algorithm.T2[(state[2] >>> 24) & 0xff] ^
                    this.algorithm.T3[(state[3] >>> 24) & 0xff] ^
                    roundKey[r][0]) >>> 0;
        inter[1] = (this.algorithm.T0[(state[0] >>> 16) & 0xff] ^
                    this.algorithm.T1[(state[1] >>> 16) & 0xff] ^
                    this.algorithm.T2[(state[2] >>> 16) & 0xff] ^
                    this.algorithm.T3[(state[3] >>> 16) & 0xff] ^
                    roundKey[r][1]) >>> 0;
        inter[2] = (this.algorithm.T0[(state[0] >>> 8) & 0xff] ^
                    this.algorithm.T1[(state[1] >>> 8) & 0xff] ^
                    this.algorithm.T2[(state[2] >>> 8) & 0xff] ^
                    this.algorithm.T3[(state[3] >>> 8) & 0xff] ^
                    roundKey[r][2]) >>> 0;
        inter[3] = (this.algorithm.T0[state[0] & 0xff] ^
                    this.algorithm.T1[state[1] & 0xff] ^
                    this.algorithm.T2[state[2] & 0xff] ^
                    this.algorithm.T3[state[3] & 0xff] ^
                    roundKey[r][3]) >>> 0;

        for (let i = 0; i < 4; i++) {
          state[i] = inter[i];
        }
      }

      // Final round (different structure)
      inter[0] = ((this.algorithm.T0[(state[0] >>> 24) & 0xff] & 0xff000000) ^
                  (this.algorithm.T1[(state[1] >>> 24) & 0xff] & 0x00ff0000) ^
                  (this.algorithm.T2[(state[2] >>> 24) & 0xff] & 0x0000ff00) ^
                  (this.algorithm.T3[(state[3] >>> 24) & 0xff] & 0x000000ff) ^
                  roundKey[R][0]) >>> 0;
      inter[1] = ((this.algorithm.T0[(state[0] >>> 16) & 0xff] & 0xff000000) ^
                  (this.algorithm.T1[(state[1] >>> 16) & 0xff] & 0x00ff0000) ^
                  (this.algorithm.T2[(state[2] >>> 16) & 0xff] & 0x0000ff00) ^
                  (this.algorithm.T3[(state[3] >>> 16) & 0xff] & 0x000000ff) ^
                  roundKey[R][1]) >>> 0;
      inter[2] = ((this.algorithm.T0[(state[0] >>> 8) & 0xff] & 0xff000000) ^
                  (this.algorithm.T1[(state[1] >>> 8) & 0xff] & 0x00ff0000) ^
                  (this.algorithm.T2[(state[2] >>> 8) & 0xff] & 0x0000ff00) ^
                  (this.algorithm.T3[(state[3] >>> 8) & 0xff] & 0x000000ff) ^
                  roundKey[R][2]) >>> 0;
      inter[3] = ((this.algorithm.T0[state[0] & 0xff] & 0xff000000) ^
                  (this.algorithm.T1[state[1] & 0xff] & 0x00ff0000) ^
                  (this.algorithm.T2[state[2] & 0xff] & 0x0000ff00) ^
                  (this.algorithm.T3[state[3] & 0xff] & 0x000000ff) ^
                  roundKey[R][3]) >>> 0;

      // Convert state back to bytes
      const resultBytes = new Array(16);
      for (let i = 0; i < 4; i++) {
        const unpacked = OpCodes.Unpack32BE(inter[i]);
        resultBytes[i*4] = unpacked[0];
        resultBytes[i*4+1] = unpacked[1];
        resultBytes[i*4+2] = unpacked[2];
        resultBytes[i*4+3] = unpacked[3];
      }

      return resultBytes;
    }

    // Generate key schedule
    _generateKeySchedule(key) {
      const N = Math.floor(key.length / 4);
      const kappa = new Array(N);
      const inter = new Array(N);
      const R = 8 + N;

      this.roundKeyEnc = new Array(R + 1);
      this.roundKeyDec = new Array(R + 1);
      for (let i = 0; i <= R; i++) {
        this.roundKeyEnc[i] = new Array(4);
        this.roundKeyDec[i] = new Array(4);
      }

      // Map byte array cipher key to initial key state
      for (let i = 0; i < N; i++) {
        kappa[i] = OpCodes.Pack32BE(key[i*4], key[i*4+1], key[i*4+2], key[i*4+3]);
      }

      // Generate R+1 round keys
      for (let r = 0; r <= R; r++) {
        // Generate r-th round key
        let K0 = this.algorithm.T4[(kappa[N-1] >>> 24) & 0xff];
        let K1 = this.algorithm.T4[(kappa[N-1] >>> 16) & 0xff];
        let K2 = this.algorithm.T4[(kappa[N-1] >>> 8) & 0xff];
        let K3 = this.algorithm.T4[kappa[N-1] & 0xff];

        for (let t = N - 2; t >= 0; t--) {
          K0 = (this.algorithm.T4[(kappa[t] >>> 24) & 0xff] ^
                ((this.algorithm.T5[(K0 >>> 24) & 0xff] & 0xff000000) |
                 (this.algorithm.T5[(K0 >>> 16) & 0xff] & 0x00ff0000) |
                 (this.algorithm.T5[(K0 >>> 8) & 0xff] & 0x0000ff00) |
                 (this.algorithm.T5[K0 & 0xff] & 0x000000ff))) >>> 0;
          K1 = (this.algorithm.T4[(kappa[t] >>> 16) & 0xff] ^
                ((this.algorithm.T5[(K1 >>> 24) & 0xff] & 0xff000000) |
                 (this.algorithm.T5[(K1 >>> 16) & 0xff] & 0x00ff0000) |
                 (this.algorithm.T5[(K1 >>> 8) & 0xff] & 0x0000ff00) |
                 (this.algorithm.T5[K1 & 0xff] & 0x000000ff))) >>> 0;
          K2 = (this.algorithm.T4[(kappa[t] >>> 8) & 0xff] ^
                ((this.algorithm.T5[(K2 >>> 24) & 0xff] & 0xff000000) |
                 (this.algorithm.T5[(K2 >>> 16) & 0xff] & 0x00ff0000) |
                 (this.algorithm.T5[(K2 >>> 8) & 0xff] & 0x0000ff00) |
                 (this.algorithm.T5[K2 & 0xff] & 0x000000ff))) >>> 0;
          K3 = (this.algorithm.T4[kappa[t] & 0xff] ^
                ((this.algorithm.T5[(K3 >>> 24) & 0xff] & 0xff000000) |
                 (this.algorithm.T5[(K3 >>> 16) & 0xff] & 0x00ff0000) |
                 (this.algorithm.T5[(K3 >>> 8) & 0xff] & 0x0000ff00) |
                 (this.algorithm.T5[K3 & 0xff] & 0x000000ff))) >>> 0;
        }

        this.roundKeyEnc[r][0] = K0;
        this.roundKeyEnc[r][1] = K1;
        this.roundKeyEnc[r][2] = K2;
        this.roundKeyEnc[r][3] = K3;

        // Compute kappa^{r+1} from kappa^r (if not the last round)
        if (r < R) {
          for (let i = 0; i < N; i++) {
            inter[i] = (this.algorithm.T0[(kappa[i] >>> 24) & 0xff] ^
                        this.algorithm.T1[(kappa[(N + i - 1) % N] >>> 16) & 0xff] ^
                        this.algorithm.T2[(kappa[(N + i - 2) % N] >>> 8) & 0xff] ^
                        this.algorithm.T3[kappa[(N + i - 3) % N] & 0xff]) >>> 0;
          }
          kappa[0] = ((this.algorithm.T0[4*r] & 0xff000000) ^
                      (this.algorithm.T1[4*r + 1] & 0x00ff0000) ^
                      (this.algorithm.T2[4*r + 2] & 0x0000ff00) ^
                      (this.algorithm.T3[4*r + 3] & 0x000000ff) ^
                      inter[0]) >>> 0;
          for (let i = 1; i < N; i++) {
            kappa[i] = inter[i];
          }
        }
      }

      // Generate inverse key schedule for decryption
      for (let i = 0; i < 4; i++) {
        this.roundKeyDec[0][i] = this.roundKeyEnc[R][i];
        this.roundKeyDec[R][i] = this.roundKeyEnc[0][i];
      }
      for (let r = 1; r < R; r++) {
        for (let i = 0; i < 4; i++) {
          const v = this.roundKeyEnc[R - r][i];
          this.roundKeyDec[r][i] = (this.algorithm.T0[this.algorithm.T4[(v >>> 24) & 0xff] & 0xff] ^
                                    this.algorithm.T1[this.algorithm.T4[(v >>> 16) & 0xff] & 0xff] ^
                                    this.algorithm.T2[this.algorithm.T4[(v >>> 8) & 0xff] & 0xff] ^
                                    this.algorithm.T3[this.algorithm.T4[v & 0xff] & 0xff]) >>> 0;
        }
      }

      // Clear sensitive intermediate data
      OpCodes.ClearArray(kappa);
      OpCodes.ClearArray(inter);
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new AnubisAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { AnubisAlgorithm, AnubisInstance };
}));