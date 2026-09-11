/*
 * MAGENTA Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * Deutsche Telekom AES Candidate (1998)
 * (c)2006-2025 Hawkynt
 * 
 * MAGENTA (Multifunctional Algorithm for General-purpose Encryption and Network 
 * Telecommunication Applications) is a 128-bit block cipher with 128, 192, or 256-bit keys.
 * It uses a modified Feistel structure with 6 rounds (128/192-bit keys) or 8 rounds (256-bit keys).
 * 
 * NOTE: This is an educational implementation. MAGENTA has known cryptographic
 * weaknesses and should not be used for actual security purposes.
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

  /**
 * MagentaAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class MagentaAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MAGENTA";
      this.description = "Deutsche Telekom AES candidate with modified Feistel structure and GF(2^8) operations. Educational implementation of a cipher with known vulnerabilities.";
      this.inventor = "Michael Jacobson Jr., Klaus Huber";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.INSECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.DE;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0), // 128-bit keys
        new KeySize(24, 24, 0), // 192-bit keys
        new KeySize(32, 32, 0)  // 256-bit keys
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0) // 128-bit blocks only
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("MAGENTA AES Submission", "https://csrc.nist.gov/archive/aes/round1/conf1/papers/jacobson.pdf"),
        new LinkItem("Schneier Analysis", "https://www.schneier.com/academic/archives/1999/05/cryptanalysis_of_mag.html")
      ];

      this.references = [
        new LinkItem("AES Competition Archive", "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development"),
        new LinkItem("MAGENTA Specification", "https://csrc.nist.gov/archive/aes/round1/conf1/papers/jacobson.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Structural Weakness", "MAGENTA has significant structural weaknesses", "Educational cipher - not recommended for production use", "https://www.schneier.com/academic/archives/1999/05/cryptanalysis_of_mag.html"),
        new Vulnerability("Low Round Count", "Only 6-8 rounds insufficient for security", "Failed AES candidate due to vulnerabilities", "https://csrc.nist.gov/archive/aes/round1/conf1/papers/jacobson.pdf")
      ];

      // Official Known Answer Tests from the MAGENTA AES round-1 submission
      // package (magenta-vals.zip), as distributed by NIST.
      const NIST_KAT = "https://web.archive.org/web/20070109105056/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/magenta-vals.zip";
      this.tests = [
        {
          text: "NIST AES round-1 ecb_int.txt, 128-bit key (non-zero key and plaintext)",
          uri: NIST_KAT,
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          key: OpCodes.Hex8ToBytes("FFFEFDFCFBFAF9F8F7F6F5F4F3F2F1F0"),
          expected: OpCodes.Hex8ToBytes("0909105491F0EF3D363EAE828A504E2B")
        },
        {
          text: "NIST AES round-1 ecb_tbl.txt I=1, 128-bit key",
          uri: NIST_KAT,
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("CA7D2B729FF35FBD75E8C72E8049F7D4")
        },
        {
          text: "NIST AES round-1 ecb_vt.txt I=1, 128-bit key",
          uri: NIST_KAT,
          input: OpCodes.Hex8ToBytes("80000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("F6B50C496E9A97ABE925DA2E7C891974")
        },
        {
          text: "NIST AES round-1 ecb_vk.txt I=1, 128-bit key",
          uri: NIST_KAT,
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("80000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("D923FF2B95212CA5581693F71137AAFA")
        },
        {
          text: "NIST AES round-1 ecb_vk.txt I=2, 128-bit key",
          uri: NIST_KAT,
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("40000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("462E3204FCEE82BEAE4FA8CB66696502")
        },
        {
          text: "NIST AES round-1 ecb_tbl.txt I=1, 192-bit key",
          uri: NIST_KAT,
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("CA7D2B729FF35FBD75E8C72E8049F7D4")
        },
        {
          text: "NIST AES round-1 ecb_vk.txt I=1, 192-bit key",
          uri: NIST_KAT,
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("800000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("588EBEE01DDF366998F50D3FF58BEAEC")
        },
        {
          text: "NIST AES round-1 ecb_tbl.txt I=1, 256-bit key",
          uri: NIST_KAT,
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("F0F66C085C77CA9433C95E0300C71891")
        },
        {
          text: "NIST AES round-1 ecb_vk.txt I=1, 256-bit key",
          uri: NIST_KAT,
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("8000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("9A199E39C2DF1F1C17CEA243F8E5147E")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new MagentaInstance(this, isInverse);
    }
  }

  /**
 * Magenta cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MagentaInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.keySchedule = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
      this.sbox = null;
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
        this.keySchedule = null;
        this.KeySize = 0;
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
      this.keySchedule = this._keySetup(keyBytes);
      this.sbox = this._generateSBox();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null; // Return copy
    }

    // Feed data to the cipher
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

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
        for (let _i = 0; _i < processedBlock.length; _i++) output.push(processedBlock[_i]);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // MAGENTA key setup
    _keySetup(key) {
      const keySchedule = {
        key: OpCodes.CopyArray(key),
        rounds: key.length === 32 ? 8 : 6,
        subkeys: []
      };

      // Subkeys are the 64-bit key words in a palindromic arrangement. This
      // symmetry is intrinsic to the design (and is what Biham et al. attacked).
      if (key.length === 16) {
        // 128-bit key: K1, K1, K2, K2, K1, K1
        const k1 = key.slice(0, 8);
        const k2 = key.slice(8, 16);
        keySchedule.subkeys = [k1, k1, k2, k2, k1, k1];
      } else if (key.length === 24) {
        // 192-bit key: K1, K2, K3, K3, K2, K1
        const k1 = key.slice(0, 8);
        const k2 = key.slice(8, 16);
        const k3 = key.slice(16, 24);
        keySchedule.subkeys = [k1, k2, k3, k3, k2, k1];
      } else {
        // 256-bit key: K1, K2, K3, K4, K4, K3, K2, K1
        const k1 = key.slice(0, 8);
        const k2 = key.slice(8, 16);
        const k3 = key.slice(16, 24);
        const k4 = key.slice(24, 32);
        keySchedule.subkeys = [k1, k2, k3, k4, k4, k3, k2, k1];
      }

      return keySchedule;
    }

    // Exponentiation table f, Equation (1) of the MAGENTA specification.
    // f(x) = alpha^x in GF(2^8) generated by the primitive polynomial
    // x^8 + x^6 + x^5 + x^2 + 1, whose reduction byte is 0x65; f(255) = 0.
    // Built with plain arithmetic so no bitwise shift operators are needed:
    // doubling is multiplication by two and the overflow test is a compare.
    _generateSBox() {
      const table = new Array(256);
      let value = 1;

      for (let i = 0; i < 255; i++) {
        table[i] = value;
        value = value * 2;
        if (value > 0xFF) {
          value = OpCodes.XorN(value % 256, 0x65);
        }
      }

      table[255] = 0;

      return table;
    }

    // A(x, y) = f(x XOR f(y)) - Equation (2)
    _A(x, y, f) {
      return f[OpCodes.XorN(x, f[y])];
    }

    // pi(x0..x15) = (PE(x0,x8), PE(x1,x9), ..., PE(x7,x15)) where
    // PE(x, y) = (A(x,y), A(y,x)) is the pseudo-exponentiation - Equation (3)
    _pi(data, f) {
      const result = new Array(16);

      for (let i = 0; i < 8; i++) {
        result[2 * i] = this._A(data[i], data[i + 8], f);
        result[2 * i + 1] = this._A(data[i + 8], data[i], f);
      }

      return result;
    }

    // T(w) = pi(pi(pi(pi(w)))) - four rounds of the shuffle-exponentiation layer
    _T(data, f) {
      return this._pi(this._pi(this._pi(this._pi(data, f), f), f), f);
    }

    // S(x0..x15) = (x0,x2,x4,...,x14, x1,x3,x5,...,x15)
    // The even-indexed bytes followed by the odd-indexed bytes.
    _shuffle(data) {
      if (data.length !== 16) {
        throw new Error('Shuffle operation requires exactly 16 bytes');
      }

      const result = new Array(16);

      for (let i = 0; i < 8; i++) {
        result[i] = data[2 * i];
        result[i + 8] = data[2 * i + 1];
      }

      return result;
    }

    // C(1, w) = T(w);  C(n+1, w) = T(w XOR S(C(n, w)))
    _C(n, data, f) {
      let result = this._T(data, f);

      for (let level = 1; level < n; level++) {
        result = this._T(OpCodes.XorArrays(data, this._shuffle(result)), f);
      }

      return result;
    }

    // MAGENTA F-function: the first eight bytes of S(C(3, X || SK))
    _fFunction(right, subkey, f) {
      return this._shuffle(this._C(3, right.concat(subkey), f)).slice(0, 8);
    }

    // MAGENTA encryption
    _encryptBlock(data) {
      if (data.length !== 16) {
        throw new Error('Block size must be 16 bytes');
      }

      // Split into left and right halves (64 bits each)
      let left = data.slice(0, 8);
      let right = data.slice(8, 16);

      // Feistel rounds: (L, R) -> (R, L XOR F(R, SK))
      for (let round = 0; round < this.keySchedule.rounds; round++) {
        const subkey = this.keySchedule.subkeys[round];
        const newRight = OpCodes.XorArrays(left, this._fFunction(right, subkey, this.sbox));

        left = right;
        right = newRight;
      }

      // MAGENTA is a Feistel network without unswapping after the final round,
      // so the halves are emitted in their natural order.
      return left.concat(right);
    }

    // MAGENTA decryption
    _decryptBlock(data) {
      if (data.length !== 16) {
        throw new Error('Block size must be 16 bytes');
      }

      // Split into left and right halves
      let left = data.slice(0, 8);
      let right = data.slice(8, 16);

      // Inverse of (L, R) -> (R, L XOR F(R, SK)) is (L, R) -> (R XOR F(L, SK), L),
      // walking the subkeys from the last round back to the first.
      for (let round = this.keySchedule.rounds - 1; round >= 0; round--) {
        const subkey = this.keySchedule.subkeys[round];
        const newLeft = OpCodes.XorArrays(right, this._fFunction(left, subkey, this.sbox));

        right = left;
        left = newLeft;
      }

      return left.concat(right);
    }
  }

  // Register the algorithm immediately

  // ===== REGISTRATION =====

    const algorithmInstance = new MagentaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { MagentaAlgorithm, MagentaInstance };
}));