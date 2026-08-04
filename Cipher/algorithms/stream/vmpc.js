/*
 * VMPC (Variably Modified Permutation Composition) Stream Cipher
 * Production implementation compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * VMPC is an RC4-like stream cipher designed by Bartosz Zoltak.
 * It uses a modified permutation composition with enhanced mixing
 * for improved security compared to RC4.
 *
 * Key Features:
 * - Variable key size (1-256 bytes)
 * - Variable IV size (1-768 bytes recommended)
 * - 256-byte S-box internal state
 * - Modified RC4-like PRGA with triple indirection: S[S[S[s]] + 1]
 * - Submitted to eSTREAM project (2004)
 *
 * Algorithm Structure:
 * 1. KSA (Key Scheduling): Initialize S-box with key over 768 rounds
 * 2. IV Scheduling: Further scramble S-box with IV over 768 rounds
 * 3. PRGA: Generate keystream using modified indirection: z = P[P[P[s]] + 1]
 *
 * SECURITY STATUS: EXPERIMENTAL - Not as widely analyzed as standard algorithms
 * USE FOR: Research, specialized applications requiring RC4-like stream ciphers
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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
          StreamCipherAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * VMPCAlgorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class VMPCAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "VMPC";
      this.description = "Variably Modified Permutation Composition stream cipher using RC4-like structure with enhanced mixing function P[P[P[s]]+1]. Designed as improved RC4 alternative with stronger security properties.";
      this.inventor = "Bartosz Zoltak";
      this.year = 2004;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.PL;

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(1, 256, 0)  // Variable key size: 1-256 bytes
      ];
      this.SupportedNonceSizes = [
        new KeySize(1, 768, 0)  // Variable IV/nonce size: 1-768 bytes recommended
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("VMPC Specification", "http://www.vmpcfunction.com/vmpc.pdf"),
        new LinkItem("eSTREAM Submission", "https://www.ecrypt.eu.org/stream/p2ciphers/vmpc/vmpc_p2.pdf")
      ];

      this.references = [
        new LinkItem("BouncyCastle VMPCEngine.java Implementation", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/engines/VMPCEngine.java"),
        new LinkItem("Author's Own C/Pascal/Assembler Implementations", "http://www.vmpcfunction.com/cipher.htm")
      ];

      // Security notes
      this.knownVulnerabilities = [
        new Vulnerability(
          "Limited Cryptanalysis",
          "VMPC has received less cryptanalytic attention compared to established stream ciphers",
          "Use only after thorough security review for your specific use case"
        )
      ];

      // Official test vectors from BouncyCastle implementation
      this.tests = [
        {
          text: "BouncyCastle Test Vector - First 256 bytes (verified against Java implementation)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/VMPCTest.java",
          input: new Array(256).fill(0),
          key: OpCodes.Hex8ToBytes("9661410AB797D8A9EB767C21172DF6C7"),
          iv: OpCodes.Hex8ToBytes("4B5C2F003E67F39557A8D26F3DA2B155"),
          // Expected output verified against BouncyCastle Java reference implementation
          // BouncyCastle test checks positions: 0,1,2,3 = A8,24,79,F5 and 252,253,254,255 = B8,FC,66,A4
          expected: OpCodes.Hex8ToBytes(
            "A82479F512E604148DB1548CD194702EDE20E787FE248A543EFE139C071B78AC" +
            "7C2AF5A8272D0ED09C649ECDFDECEC20454C8A7F675AD8816BA569DAB29B7079" +
            "D57A2F1279EBD9AEFB67A8D6403AF44C2D8C4327D09AD4F35A0C967D7DC31319" +
            "C7DAB130E7EB69C9B71518011226B4D28F4927249F0103721714DCA5F7C62040" +
            "58E11C87EB014DAB75041CC2D096A7F7719081C3D7292D5A9C6CA4AA59D386CA" +
            "D51DB9EFDBE45A8293BD34EE876FC7E994653AB726F83B82ABDAEBA885C7050B" +
            "9BF9B74FF64CE0F64094A80FECBF0481C1E0D2E8CAB65DC3B8FDECB7720C860F" +
            "A143EFF4F36FA8F729E791D1A6BE657BACAC49815467C2CA4A3951C0B8FC66A4"
          )
        },
        {
          text: "BouncyCastle Test Vector - First 32 keystream bytes",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/VMPCTest.java",
          input: new Array(32).fill(0),
          key: OpCodes.Hex8ToBytes("9661410AB797D8A9EB767C21172DF6C7"),
          iv: OpCodes.Hex8ToBytes("4B5C2F003E67F39557A8D26F3DA2B155"),
          expected: OpCodes.Hex8ToBytes("A82479F512E604148DB1548CD194702EDE20E787FE248A543EFE139C071B78AC")
        },
        {
          text: "DarkCrypt Vmpc - 128-byte keystream (key=00..3F, IV=00)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: new Array(128).fill(0),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          iv: [0],
          expected: OpCodes.Hex8ToBytes("291626f81795b6895ec89d4fd2dbb1195ba0a901161bb1ba0b8e3f5ec14187ae94ab8fe2e9a564b8e9c1345cfede17968aba3029130327bdfec2b641134b30c310dc2991128094cfeadb960e65c7b9d5eb1705b5401de5a8fdd966b6d3fd6d3d212410385fc1b834ac3b3f3268ea7c2aac731ada2e113afb7800bdc541cbbe92")
        },
        {
          text: "DarkCrypt Vmpc - enc of 00..3F (key=00..3F, IV=00)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          iv: [0],
          expected: OpCodes.Hex8ToBytes("291724fb1390b08e56c19744ded6bf164bb1bb12020ea7ad13972545dd5c99b1b48aadc1cd80429fc1e81e77d2f339b9ba8b021a2736118ac6fb8c7a2f760efc")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      // Stream cipher - encryption and decryption are identical
      return new VMPCInstance(this, isInverse);
    }
  }

  // Instance class implementing VMPC stream cipher
  /**
 * VMPC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class VMPCInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      // VMPC state
      this.P = new Array(256);  // S-box permutation (called P in VMPC spec)
      this.n = 0;               // PRGA counter n
      this.s = 0;               // PRGA counter s
      this.initialized = false;
    }

    // Property setter for key
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      const keyLength = keyBytes.length;
      if (keyLength < 1 || keyLength > 256) {
        throw new Error(`Invalid VMPC key size: ${keyLength} bytes. Requires 1-256 bytes`);
      }

      this._key = [...keyBytes];

      // Initialize if we also have IV
      if (this._iv) {
        this._initializeVMPC();
      }
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for IV/nonce
    set iv(ivData) {
      if (!ivData) {
        this._iv = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(ivData)) {
        throw new Error("Invalid IV - must be byte array");
      }

      const ivLength = ivData.length;
      if (ivLength < 1 || ivLength > 768) {
        throw new Error(`Invalid VMPC IV size: ${ivLength} bytes. Requires 1-768 bytes`);
      }

      this._iv = [...ivData];

      // Initialize if we also have key
      if (this._key) {
        this._initializeVMPC();
      }
    }

    /**
   * Get copy of current IV
   * @returns {uint8[]|null} Copy of IV bytes or null
   */

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    set nonce(nonceData) {
      this.iv = nonceData;
    }

    get nonce() {
      return this.iv;
    }

    // Feed data to the cipher
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._iv) {
        throw new Error("IV not set");
      }

      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    // Get the cipher result
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._iv) {
        throw new Error("IV not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (!this.initialized) {
        throw new Error("VMPC not properly initialized");
      }

      const output = [];

      // Process input data byte by byte (stream cipher)
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._generateKeystreamByte();
        output.push(OpCodes.Xor32(this.inputBuffer[i], keystreamByte));
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Initialize VMPC with key and IV
    _initializeVMPC() {
      if (!this._key || !this._iv) return;

      // Step 1: Initialize P-box with identity permutation
      for (let i = 0; i < 256; i++) {
        this.P[i] = i;
      }

      // Step 2: Key Scheduling Algorithm (KSA) - scramble P with key over 768 rounds
      this.s = 0;
      for (let m = 0; m < 768; m++) {
        const i = OpCodes.ToByte(m);  // m mod 256
        const keyByte = this._key[m % this._key.length];

        // s = P[(s + P[i] + key[m mod keyLen]) mod 256]
        this.s = this.P[OpCodes.ToByte(this.s + this.P[i] + keyByte)];

        // Swap P[i] and P[s]
        const temp = this.P[i];
        this.P[i] = this.P[this.s];
        this.P[this.s] = temp;
      }

      // Step 3: IV Scheduling - further scramble P with IV over 768 rounds
      for (let m = 0; m < 768; m++) {
        const i = OpCodes.ToByte(m);  // m mod 256
        const ivByte = this._iv[m % this._iv.length];

        // s = P[(s + P[i] + iv[m mod ivLen]) mod 256]
        this.s = this.P[OpCodes.ToByte(this.s + this.P[i] + ivByte)];

        // Swap P[i] and P[s]
        const temp = this.P[i];
        this.P[i] = this.P[this.s];
        this.P[this.s] = temp;
      }

      // Reset PRGA counters
      this.n = 0;
      this.initialized = true;
    }

    // Pseudo-Random Generation Algorithm (PRGA) - generate one keystream byte
    _generateKeystreamByte() {
      // Load P[n]
      const pn = this.P[OpCodes.ToByte(this.n)];

      // Update s: s = P[(s + P[n]) mod 256]
      this.s = this.P[OpCodes.ToByte(this.s + pn)];

      // Load P[s]
      const ps = this.P[OpCodes.ToByte(this.s)];

      // Triple indirection to generate keystream byte
      // z = P[(P[P[s]] + 1) mod 256]
      // ps already contains P[s], so P[ps] is P[P[s]], and P[(P[ps] + 1)] is P[P[P[s]] + 1]
      const z = this.P[OpCodes.ToByte(this.P[OpCodes.ToByte(ps)] + 1)];

      // Swap P[n] and P[s]
      this.P[OpCodes.ToByte(this.n)] = ps;
      this.P[OpCodes.ToByte(this.s)] = pn;

      // Increment n: n = (n + 1) mod 256
      this.n = OpCodes.ToByte(this.n + 1);

      return z;
    }
  }

  // Register the algorithm
  const algorithmInstance = new VMPCAlgorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return { VMPCAlgorithm, VMPCInstance };
}));
