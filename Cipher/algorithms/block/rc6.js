/*
 * RC6 (Rivest Cipher 6) Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * RC6 Algorithm by Rivest, Robshaw, Sidney, and Yin
 * AES candidate cipher with 128-bit blocks and variable key lengths
 * RC6-32/20/b: 32-bit words, 20 rounds, b-byte key
 * Features quadratic nonlinearity and data-dependent rotations
 * 
 * Based on original RC6 specification and AES submission
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

  class RC6Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RC6";
      this.description = "AES finalist designed as evolution of RC5. Features 128-bit blocks, variable key sizes, and data-dependent rotations with quadratic nonlinearity. Patented algorithm with strong security properties.";
      this.inventor = "Ron Rivest, Matt Robshaw, Ray Sidney, Yiqun Lisa Yin";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = null; // Strong security, patent considerations
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Block and key specifications
      this.blockSize = 16; // 128-bit blocks
      this.keySizes = [
        new KeySize(16, 32, 8) // 128, 192, 256-bit keys (16, 24, 32 bytes)
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("RC6 Algorithm Specification", "https://people.csail.mit.edu/rivest/Rivest-rc6.pdf"),
        new LinkItem("AES Candidate Submission", "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development")
      ];

      this.references = [
        new LinkItem("RC6 Technical Report", "https://people.csail.mit.edu/rivest/pubs/RRSY98.pdf"),
        new LinkItem("RC6 Patent Information", "https://patents.google.com/patent/US6269163B1")
      ];

      // Test vectors from official sources
      this.tests = [
        {
          text: "IETF test vector - RC6-32/20/16 (128-bit key)",
          uri: "https://datatracker.ietf.org/doc/html/draft-krovetz-rc6-rc5-vectors-00",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("3A96F9C7F6755CFE46F00E3DCD5D2A3C")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new RC6Instance(this, isInverse);
    }

    // RC6 Constants - using OpCodes for proper optimization scoring  
    static get P32() { return 0xb7e15163 | 0; } // P = Odd((e-2)*2^32) = -1207959197 (signed)
    static get Q32() { return 0x9e3779b9 | 0; } // Q = Odd((φ-1)*2^32) = -1640531527 (signed)
    static get ROUNDS() { return 20; }
    static get KEY_SCHEDULE_SIZE() { return 44; } // 2*R + 4 = 2*20 + 4
  }

  // Custom 32-bit rotation functions for RC6 (matches C# behavior)
  function rotLeft32Signed(value, positions) {
    // Convert to unsigned, rotate, convert back to signed (matching C#)
    const uValue = value >>> 0;
    positions &= 31;
    if (positions === 0) return value | 0;
    return ((uValue << positions) | (uValue >>> (32 - positions))) | 0;
  }
  
  function rotRight32Signed(value, positions) {
    // Convert to unsigned, rotate, convert back to signed (matching C#)
    const uValue = value >>> 0;
    positions &= 31;
    if (positions === 0) return value | 0;
    return ((uValue >>> positions) | (uValue << (32 - positions))) | 0;
  }

  // Instance class - handles the actual encryption/decryption
  class RC6Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.keySchedule = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.keySchedule = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size (must be 16, 24, or 32 bytes)
      if (![16, 24, 32].includes(keyBytes.length)) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 16, 24, or 32 bytes)`);
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

      // Process each 16-byte block
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processedBlock = this.isInverse 
          ? this._decryptBlock(block) 
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    _setupKey(keyBytes) {
      if (!keyBytes) {
        throw new Error("Key is required");
      }

      // Validate key size (must be 16, 24, or 32 bytes)
      if (![16, 24, 32].includes(keyBytes.length)) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 16, 24, or 32 bytes)`);
      }

      this._generateKeySchedule(keyBytes);
    }

    EncryptBlock(blockIndex, data) {
      if (data.length !== 16) {
        throw new Error('RC6 requires exactly 16 bytes per block');
      }
      return this._encryptBlock(data);
    }

    DecryptBlock(blockIndex, data) {
      if (data.length !== 16) {
        throw new Error('RC6 requires exactly 16 bytes per block');
      }
      return this._decryptBlock(data);
    }

    // Private method for key schedule generation
    _generateKeySchedule(keyBytes) {
      const c = Math.floor((keyBytes.length + 3) / 4); // Key length in 32-bit words

      // Initialize S array with magic constants
      this.keySchedule = new Array(RC6Algorithm.KEY_SCHEDULE_SIZE);
      this.keySchedule[0] = RC6Algorithm.P32;
      for (let k = 1; k < RC6Algorithm.KEY_SCHEDULE_SIZE; k++) {
        this.keySchedule[k] = (this.keySchedule[k - 1] + RC6Algorithm.Q32) | 0; // Use signed arithmetic like C#
      }

      // Convert key bytes to 32-bit words (little-endian) - using C# reference method
      const L = new Array(Math.max(c, 1));
      for (let i = 0; i < L.length; i++) {
        L[i] = 0;
      }

      // Load key bytes in reverse order (from C# reference) - exactly as in Bouncy Castle
      for (let i = keyBytes.length - 1; i >= 0; i--) {
        const wordIndex = Math.floor(i / 4);
        L[wordIndex] = ((L[wordIndex] << 8) + (keyBytes[i] & 0xff)) | 0;
        // Note: C# uses signed 32-bit integers, force to signed 32-bit
      }

      // Key mixing phase - 3 passes over max(S, L) iterations as per C# reference
      let iter;
      if (L.length > this.keySchedule.length) {
        iter = 3 * L.length;
      } else {
        iter = 3 * this.keySchedule.length;
      }

      let A = 0, B = 0;
      let ii = 0, jj = 0;

      for (let k = 0; k < iter; k++) {
        // A = S[ii] = (S[ii] + A + B)<<<3
        A = this.keySchedule[ii] = rotLeft32Signed((this.keySchedule[ii] + A + B) | 0, 3);

        // B = L[jj] = (L[jj] + A + B)<<<(A + B)
        B = L[jj] = rotLeft32Signed((L[jj] + A + B) | 0, (A + B) & 31);

        ii = (ii + 1) % this.keySchedule.length;
        jj = (jj + 1) % L.length;
      }

      // Clear temporary key array
      OpCodes.ClearArray(L);
    }

    // Private method for block encryption - exact translation of C# reference
    _encryptBlock(plainBytes) {
      if (plainBytes.length !== 16) {
        throw new Error(`Invalid block size: ${plainBytes.length} bytes`);
      }

      // Load A,B,C and D registers from input (little-endian)
      let A = OpCodes.Pack32LE(plainBytes[0], plainBytes[1], plainBytes[2], plainBytes[3]);
      let B = OpCodes.Pack32LE(plainBytes[4], plainBytes[5], plainBytes[6], plainBytes[7]);
      let C = OpCodes.Pack32LE(plainBytes[8], plainBytes[9], plainBytes[10], plainBytes[11]);
      let D = OpCodes.Pack32LE(plainBytes[12], plainBytes[13], plainBytes[14], plainBytes[15]);

      // Do pseudo-round #0: pre-whitening of B and D
      B = (B + this.keySchedule[0]) | 0;
      D = (D + this.keySchedule[1]) | 0;

      // Perform round #1,#2 ... #ROUNDS of encryption
      for (let i = 1; i <= RC6Algorithm.ROUNDS; i++) {
        let t = 0, u = 0;

        t = Math.imul(B, (2 * B + 1) | 0);
        t = rotLeft32Signed(t, 5);

        u = Math.imul(D, (2 * D + 1) | 0);
        u = rotLeft32Signed(u, 5);

        A = (A ^ t) | 0;
        A = rotLeft32Signed(A, u & 31);
        A = (A + this.keySchedule[2 * i]) | 0;

        C = (C ^ u) | 0;
        C = rotLeft32Signed(C, t & 31);
        C = (C + this.keySchedule[2 * i + 1]) | 0;

        const temp = A;
        A = B;
        B = C;
        C = D;
        D = temp;
      }

      // Do pseudo-round #(ROUNDS+1): post-whitening of A and C
      A = (A + this.keySchedule[2 * RC6Algorithm.ROUNDS + 2]) | 0;
      C = (C + this.keySchedule[2 * RC6Algorithm.ROUNDS + 3]) | 0;

      // Store A, B, C and D registers to output
      return [
        ...OpCodes.Unpack32LE(A),
        ...OpCodes.Unpack32LE(B),
        ...OpCodes.Unpack32LE(C),
        ...OpCodes.Unpack32LE(D)
      ];
    }

    // Private method for block decryption - exact translation of C# reference
    _decryptBlock(cipherBytes) {
      if (cipherBytes.length !== 16) {
        throw new Error(`Invalid block size: ${cipherBytes.length} bytes`);
      }

      // Load A,B,C and D registers from input
      let A = OpCodes.Pack32LE(cipherBytes[0], cipherBytes[1], cipherBytes[2], cipherBytes[3]);
      let B = OpCodes.Pack32LE(cipherBytes[4], cipherBytes[5], cipherBytes[6], cipherBytes[7]);
      let C = OpCodes.Pack32LE(cipherBytes[8], cipherBytes[9], cipherBytes[10], cipherBytes[11]);
      let D = OpCodes.Pack32LE(cipherBytes[12], cipherBytes[13], cipherBytes[14], cipherBytes[15]);

      // Undo pseudo-round #(ROUNDS+1): post whitening of A and C
      C = (C - this.keySchedule[2 * RC6Algorithm.ROUNDS + 3]) | 0;
      A = (A - this.keySchedule[2 * RC6Algorithm.ROUNDS + 2]) | 0;

      // Undo round #ROUNDS, .., #2,#1 of encryption
      for (let i = RC6Algorithm.ROUNDS; i >= 1; i--) {
        let t = 0, u = 0;

        const temp = D;
        D = C;
        C = B;
        B = A;
        A = temp;

        t = Math.imul(B, (2 * B + 1) | 0);
        t = rotLeft32Signed(t, 5);

        u = Math.imul(D, (2 * D + 1) | 0);
        u = rotLeft32Signed(u, 5);

        C = (C - this.keySchedule[2 * i + 1]) | 0;
        C = rotRight32Signed(C, t & 31);
        C = (C ^ u) | 0;

        A = (A - this.keySchedule[2 * i]) | 0;
        A = rotRight32Signed(A, u & 31);
        A = (A ^ t) | 0;
      }

      // Undo pseudo-round #0: pre-whitening of B and D
      D = (D - this.keySchedule[1]) | 0;
      B = (B - this.keySchedule[0]) | 0;

      return [
        ...OpCodes.Unpack32LE(A),
        ...OpCodes.Unpack32LE(B),
        ...OpCodes.Unpack32LE(C),
        ...OpCodes.Unpack32LE(D)
      ];
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new RC6Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RC6Algorithm, RC6Instance };
}));