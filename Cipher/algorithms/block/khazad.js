/*
 * Khazad Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * Based on the original NESSIE submission by Paulo Barreto and Vincent Rijmen
 * (c)2006-2025 Hawkynt
 * 
 * References:
 * - P.S.L.M. Barreto, V. Rijmen, "The Khazad legacy-level block cipher",
 *   NESSIE submission, 2000.
 * - Official Java implementation version 2.0 (2001.09.24)
 */

// Load AlgorithmFramework (REQUIRED)

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

  class KhazadAlgorithm extends AlgorithmFramework.BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Khazad";
      this.description = "NESSIE submission block cipher with 64-bit blocks and 128-bit keys. Uses substitution-permutation network with involutional components for efficient encryption and decryption.";
      this.inventor = "Paulo S.L.M. Barreto, Vincent Rijmen";
      this.year = 2000;
      this.category = AlgorithmFramework.CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
      this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
      this.country = AlgorithmFramework.CountryCode.BR;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new AlgorithmFramework.KeySize(16, 16, 1) // 128-bit keys only
      ];
      this.SupportedBlockSizes = [
        new AlgorithmFramework.KeySize(8, 8, 1) // 64-bit blocks only
      ];

      // Documentation and references
      this.documentation = [
        new AlgorithmFramework.LinkItem("NESSIE Submission", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/khazad.zip"),
        new AlgorithmFramework.LinkItem("Khazad Specification", "https://www.cosic.esat.kuleuven.be/nessie/reports/phase1/khaWP1-008.pdf"),
        new AlgorithmFramework.LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Khazad")
      ];

      this.references = [
        new AlgorithmFramework.LinkItem("Original Java Reference", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/khazad.zip"),
        new AlgorithmFramework.LinkItem("NESSIE Portfolio", "https://www.cosic.esat.kuleuven.be/nessie/")
      ];

      this.knownVulnerabilities = [
        new AlgorithmFramework.Vulnerability("Weak Key Schedule", "https://www.cosic.esat.kuleuven.be/nessie/", "Some weak key properties identified during NESSIE evaluation process", "Use only for educational purposes, not for production systems")
      ];

      // Test vectors from NESSIE
      this.tests = [
        {
          text: "NESSIE Test Vector - All zeros",
          uri: "https://www.cosic.esat.kuleuven.be/nessie/testvectors/",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("49a4ce32ac6f2d2d")
        },
        {
          text: "NESSIE Test Vector - Test pattern",
          uri: "https://www.cosic.esat.kuleuven.be/nessie/testvectors/",
          input: OpCodes.Hex8ToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("ba3d6b277a201412")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new KhazadInstance(this, isInverse);
    }
  }

  class KhazadInstance extends AlgorithmFramework.IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.roundKeyEnc = null;
      this.roundKeyDec = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 16;

      // Initialize cipher constants and tables
      this.R = 8; // Number of rounds
      this.isInitialized = false;

      // S-box from original Java reference - exact same string
      this.Sbox = "\uba54\u2f74\u53d3\ud24d\u50ac\u8dbf\u7052\u9a4c" +
                  "\uead5\u97d1\u3351\u5ba6\ude48\ua899\udb32\ub7fc" +
                  "\ue39e\u919b\ue2bb\u416e\ua5cb\u6b95\ua1f3\ub102" +
                  "\uccc4\u1d14\uc363\uda5d\u5fdc\u7dcd\u7f5a\u6c5c" +
                  "\uf726\uffed\ue89d\u6f8e\u19a0\uf089\u0f07\uaffb" +
                  "\u0815\u0d04\u0164\udf76\u79dd\u3d16\u3f37\u6d38" +
                  "\ub973\ue935\u5571\u7b8c\u7288\uf62a\u3e5e\u2746" +
                  "\u0c65\u6861\u03c1\u57d6\ud958\ud866\ud73a\uc83c" +
                  "\ufa96\ua798\uecb8\uc7ae\u694b\uaba9\u670a\u47f2" +
                  "\ub522\ue5ee\ube2b\u8112\u831b\u0e23\uf545\u21ce" +
                  "\u492c\uf9e6\ub628\u1782\u1a8b\ufe8a\u09c9\u874e" +
                  "\ue12e\ue4e0\ueb90\ua41e\u8560\u0025\uf4f1\u940b" +
                  "\ue775\uef34\u31d4\ud086\u7ead\ufd29\u303b\u9ff8" +
                  "\uc613\u0605\uc511\u777c\u7a78\u361c\u3959\u1856" +
                  "\ub3b0\u2420\ub292\ua3c0\u4462\u10b4\u8443\u93c2" +
                  "\u4abd\u8f2d\ubc9c\u6a40\ucfa2\u804f\u1fca\uaa42";

      // Lookup tables - T[8][256] as 64-bit values split into [high32, low32]
      this.T = [];
      this.S = [];
      this.c = [];

      this._initializeTables();
    }

    get Key() {
      return this.key;
    }

    set Key(value) {
      if (!value || value.length !== 16) {
        throw new Error('Invalid Khazad key size: ' + (value ? 8 * value.length : 0) + ' bits. Required: 128 bits.');
      }
      this.key = value;
      this.KeySize = value.length;
      this._setupKey();
    }

    _initializeTables() {
      if (this.isInitialized) return;

      // Initialize lookup tables
      for (let t = 0; t < 8; t++) {
        this.T[t] = [];
      }

      // Build S-box and transformation tables exactly like Java reference
      for (let x = 0; x < 256; x++) {
        // Extract S-box value exactly like Java: Sbox.charAt(x/2) & 0xffffL
        const c = this.Sbox.charCodeAt(Math.floor(x/2)) & 0xFFFF;
        const s1 = ((x & 1) === 0) ? (c >>> 8) : (c & 0xFF);

        // Galois field operations exactly like Java reference implementation
        let s2 = s1 << 1;
        if (s2 >= 0x100) s2 ^= 0x11d;

        const s3 = s2 ^ s1;

        let s4 = s2 << 1;
        if (s4 >= 0x100) s4 ^= 0x11d;

        const s5 = s4 ^ s1;
        const s6 = s4 ^ s2;
        const s7 = s6 ^ s1;

        let s8 = s4 << 1;
        if (s8 >= 0x100) s8 ^= 0x11d;

        const sb = s8 ^ s2 ^ s1;

        // Build transformation tables exactly like Java reference
        // Java: T[0][x] = (s1 << 56) | (s3 << 48) | (s4 << 40) | (s5 << 32) | (s6 << 24) | (s8 << 16) | (sb << 8) | s7;
        // Convert to [high32, low32]: high32 = bits 63-32, low32 = bits 31-0
        this.T[0][x] = [((s1 << 24) | (s3 << 16) | (s4 << 8) | s5) >>> 0, ((s6 << 24) | (s8 << 16) | (sb << 8) | s7) >>> 0];
        this.T[1][x] = [((s3 << 24) | (s1 << 16) | (s5 << 8) | s4) >>> 0, ((s8 << 24) | (s6 << 16) | (s7 << 8) | sb) >>> 0];
        this.T[2][x] = [((s4 << 24) | (s5 << 16) | (s1 << 8) | s3) >>> 0, ((sb << 24) | (s7 << 16) | (s6 << 8) | s8) >>> 0];
        this.T[3][x] = [((s5 << 24) | (s4 << 16) | (s3 << 8) | s1) >>> 0, ((s7 << 24) | (sb << 16) | (s8 << 8) | s6) >>> 0];
        this.T[4][x] = [((s6 << 24) | (s8 << 16) | (sb << 8) | s7) >>> 0, ((s1 << 24) | (s3 << 16) | (s4 << 8) | s5) >>> 0];
        this.T[5][x] = [((s8 << 24) | (s6 << 16) | (s7 << 8) | sb) >>> 0, ((s3 << 24) | (s1 << 16) | (s5 << 8) | s4) >>> 0];
        this.T[6][x] = [((sb << 24) | (s7 << 16) | (s6 << 8) | s8) >>> 0, ((s4 << 24) | (s5 << 16) | (s1 << 8) | s3) >>> 0];
        this.T[7][x] = [((s7 << 24) | (sb << 16) | (s8 << 8) | s6) >>> 0, ((s5 << 24) | (s4 << 16) | (s3 << 8) | s1) >>> 0];

        this.S[x] = s1;
      }

      // Initialize round constants exactly like Java reference
      for (let r = 0; r <= this.R; r++) {
        // Java: c[r] = ((Sbox.charAt(4*r + 0) & 0xffffL) << 48) | 
        //              ((Sbox.charAt(4*r + 1) & 0xffffL) << 32) |
        //              ((Sbox.charAt(4*r + 2) & 0xffffL) << 16) |
        //              ((Sbox.charAt(4*r + 3) & 0xffffL)      );
        const c0 = (this.Sbox.charCodeAt(4*r + 0) & 0xFFFF);
        const c1 = (this.Sbox.charCodeAt(4*r + 1) & 0xFFFF);
        const c2 = (this.Sbox.charCodeAt(4*r + 2) & 0xFFFF);
        const c3 = (this.Sbox.charCodeAt(4*r + 3) & 0xFFFF);

        // Java bit layout: c0<<48 | c1<<32 | c2<<16 | c3<<0
        // Split into [high32, low32]: [c0<<16|c1, c2<<16|c3]
        this.c[r] = [((c0 << 16) | c1) >>> 0, ((c2 << 16) | c3) >>> 0];
      }

      this.isInitialized = true;
    }

    _setupKey() {
      if (!this.key) return;

      // Map byte array cipher key to initial key state (mu) exactly like Java
      // Java assigns key[0..7] to K2 and key[8..15] to K1  
      let K2 = this._bytesToLong(this.key, 0);
      let K1 = this._bytesToLong(this.key, 8);

      this.roundKeyEnc = [];
      this.roundKeyDec = [];

      // Compute the round keys exactly like Java reference
      for (let r = 0; r <= this.R; r++) {
        // Java: K[r] = rho(c[r], K1) ^ K2
        // rho = T[0][K1>>>56] ^ T[1][(K1>>>48)&0xff] ^ ... ^ c[r]
        const b0 = (K1[0] >>> 24) & 0xFF;
        const b1 = (K1[0] >>> 16) & 0xFF;
        const b2 = (K1[0] >>> 8) & 0xFF;
        const b3 = K1[0] & 0xFF;
        const b4 = (K1[1] >>> 24) & 0xFF;
        const b5 = (K1[1] >>> 16) & 0xFF;
        const b6 = (K1[1] >>> 8) & 0xFF;
        const b7 = K1[1] & 0xFF;

        let rhoResult = [0, 0];
        rhoResult = this._xor64(rhoResult, this.T[0][b0]);
        rhoResult = this._xor64(rhoResult, this.T[1][b1]);
        rhoResult = this._xor64(rhoResult, this.T[2][b2]);
        rhoResult = this._xor64(rhoResult, this.T[3][b3]);
        rhoResult = this._xor64(rhoResult, this.T[4][b4]);
        rhoResult = this._xor64(rhoResult, this.T[5][b5]);
        rhoResult = this._xor64(rhoResult, this.T[6][b6]);
        rhoResult = this._xor64(rhoResult, this.T[7][b7]);
        rhoResult = this._xor64(rhoResult, this.c[r]);

        this.roundKeyEnc[r] = this._xor64(rhoResult, K2);
        K2 = K1;
        K1 = this.roundKeyEnc[r];
      }

      // Compute the inverse key schedule exactly like Java reference
      // K'^0 = K^R, K'^R = K^0, K'^r = theta(K^{R-r})
      this.roundKeyDec[0] = this.roundKeyEnc[this.R];
      for (let r = 1; r < this.R; r++) {
        const K1 = this.roundKeyEnc[this.R - r];

        // theta(K1) = T[0][S[K1>>>56]] ^ T[1][S[(K1>>>48)&0xff]] ^ ...
        const b0 = this.S[(K1[0] >>> 24) & 0xFF];
        const b1 = this.S[(K1[0] >>> 16) & 0xFF];
        const b2 = this.S[(K1[0] >>> 8) & 0xFF];
        const b3 = this.S[K1[0] & 0xFF];
        const b4 = this.S[(K1[1] >>> 24) & 0xFF];
        const b5 = this.S[(K1[1] >>> 16) & 0xFF];
        const b6 = this.S[(K1[1] >>> 8) & 0xFF];
        const b7 = this.S[K1[1] & 0xFF];

        let thetaResult = [0, 0];
        thetaResult = this._xor64(thetaResult, this.T[0][b0]);
        thetaResult = this._xor64(thetaResult, this.T[1][b1]);
        thetaResult = this._xor64(thetaResult, this.T[2][b2]);
        thetaResult = this._xor64(thetaResult, this.T[3][b3]);
        thetaResult = this._xor64(thetaResult, this.T[4][b4]);
        thetaResult = this._xor64(thetaResult, this.T[5][b5]);
        thetaResult = this._xor64(thetaResult, this.T[6][b6]);
        thetaResult = this._xor64(thetaResult, this.T[7][b7]);

        this.roundKeyDec[r] = thetaResult;
      }
      this.roundKeyDec[this.R] = this.roundKeyEnc[0];
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('Feed expects byte array');
      }
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this.key) {
        throw new Error('Key not set');
      }

      const output = [];
      while (this.inputBuffer.length >= this.BlockSize) {
        const block = this.inputBuffer.splice(0, this.BlockSize);
        const processed = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
        output.push(...processed);
      }
      return output;
    }

    _encryptBlock(block) {
      if (block.length !== 8) {
        throw new Error('Khazad requires 8-byte blocks');
      }
      return this._crypt(block, this.roundKeyEnc);
    }

    _decryptBlock(block) {
      if (block.length !== 8) {
        throw new Error('Khazad requires 8-byte blocks');
      }
      return this._crypt(block, this.roundKeyDec);
    }

    _crypt(block, roundKey) {
      // Map byte array block to cipher state (mu) and add initial round key (sigma[K^0])
      let state = this._bytesToLong(block, 0);
      state = this._xor64(state, roundKey[0]);

      // R - 1 full rounds
      for (let r = 1; r < this.R; r++) {
        const b0 = (state[0] >>> 24) & 0xFF;
        const b1 = (state[0] >>> 16) & 0xFF;
        const b2 = (state[0] >>> 8) & 0xFF;
        const b3 = state[0] & 0xFF;
        const b4 = (state[1] >>> 24) & 0xFF;
        const b5 = (state[1] >>> 16) & 0xFF;
        const b6 = (state[1] >>> 8) & 0xFF;
        const b7 = state[1] & 0xFF;

        let newState = [0, 0];
        newState = this._xor64(newState, this.T[0][b0]);
        newState = this._xor64(newState, this.T[1][b1]);
        newState = this._xor64(newState, this.T[2][b2]);
        newState = this._xor64(newState, this.T[3][b3]);
        newState = this._xor64(newState, this.T[4][b4]);
        newState = this._xor64(newState, this.T[5][b5]);
        newState = this._xor64(newState, this.T[6][b6]);
        newState = this._xor64(newState, this.T[7][b7]);
        newState = this._xor64(newState, roundKey[r]);

        state = newState;
      }

      // Last round: selective byte masking exactly like Java
      const b0 = (state[0] >>> 24) & 0xFF;
      const b1 = (state[0] >>> 16) & 0xFF;
      const b2 = (state[0] >>> 8) & 0xFF;
      const b3 = state[0] & 0xFF;
      const b4 = (state[1] >>> 24) & 0xFF;
      const b5 = (state[1] >>> 16) & 0xFF;
      const b6 = (state[1] >>> 8) & 0xFF;
      const b7 = state[1] & 0xFF;

      const t0 = this.T[0][b0];
      const t1 = this.T[1][b1];
      const t2 = this.T[2][b2];
      const t3 = this.T[3][b3];
      const t4 = this.T[4][b4];
      const t5 = this.T[5][b5];
      const t6 = this.T[6][b6];
      const t7 = this.T[7][b7];

      // Final round: mask specific byte from each T-table lookup exactly like Java
      // Extract the required bytes from each T-table entry exactly as Java does
      const byte7 = (t0[0] >>> 24) & 0xFF;  // T[0] byte 7 → high32[31:24]
      const byte6 = (t1[0] >>> 16) & 0xFF;  // T[1] byte 6 → high32[23:16]
      const byte5 = (t2[0] >>> 8) & 0xFF;   // T[2] byte 5 → high32[15:8]
      const byte4 = t3[0] & 0xFF;           // T[3] byte 4 → high32[7:0]
      const byte3 = (t4[1] >>> 24) & 0xFF;  // T[4] byte 3 → low32[31:24]
      const byte2 = (t5[1] >>> 16) & 0xFF;  // T[5] byte 2 → low32[23:16]
      const byte1 = (t6[1] >>> 8) & 0xFF;   // T[6] byte 1 → low32[15:8]
      const byte0 = t7[1] & 0xFF;           // T[7] byte 0 → low32[7:0]

      // Combine bytes into 64-bit value [high32, low32]
      const finalState = [
        ((byte7 << 24) | (byte6 << 16) | (byte5 << 8) | byte4) >>> 0,
        ((byte3 << 24) | (byte2 << 16) | (byte1 << 8) | byte0) >>> 0
      ];

      const result = this._xor64(finalState, roundKey[this.R]);
      return this._longToBytes(result);
    }

    // Utility methods
    _xor64(a, b) {
      return [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0];
    }

    _bytesToLong(bytes, offset) {
      // Convert 8 bytes to 64-bit [high32, low32] format exactly like Java
      const high = ((bytes[offset] & 0xFF) << 24) |
                   ((bytes[offset + 1] & 0xFF) << 16) |
                   ((bytes[offset + 2] & 0xFF) << 8) |
                   (bytes[offset + 3] & 0xFF);
      const low = ((bytes[offset + 4] & 0xFF) << 24) |
                  ((bytes[offset + 5] & 0xFF) << 16) |
                  ((bytes[offset + 6] & 0xFF) << 8) |
                  (bytes[offset + 7] & 0xFF);
      return [high >>> 0, low >>> 0];
    }

    _longToBytes(value) {
      return [
        (value[0] >>> 24) & 0xFF,
        (value[0] >>> 16) & 0xFF,
        (value[0] >>> 8) & 0xFF,
        value[0] & 0xFF,
        (value[1] >>> 24) & 0xFF,
        (value[1] >>> 16) & 0xFF,
        (value[1] >>> 8) & 0xFF,
        value[1] & 0xFF
      ];
    }
  }

  // ===== REGISTRATION =====

    const algorithmInstance = new KhazadAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { KhazadAlgorithm, KhazadInstance };
}));