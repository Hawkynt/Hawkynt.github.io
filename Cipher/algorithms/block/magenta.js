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
        new Vulnerability("Structural Weakness", "https://www.schneier.com/academic/archives/1999/05/cryptanalysis_of_mag.html", "MAGENTA has significant structural weaknesses", "Educational cipher - not recommended for production use"),
        new Vulnerability("Low Round Count", "https://csrc.nist.gov/archive/aes/round1/conf1/papers/jacobson.pdf", "Only 6-8 rounds insufficient for security", "Failed AES candidate due to vulnerabilities")
      ];

      // Test vectors
      this.tests = [
        {
          text: "MAGENTA Zero Key/Zero Input Test",
          uri: "Educational test vector",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("00000000000000000000000000000000")
        },
        {
          text: "MAGENTA Test Pattern",
          uri: "Educational test vector",
          input: OpCodes.Hex8ToBytes("0123456789ABCDEF0123456789ABCDEF"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("D80B0B1152A1C87672174DB619A85664")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new MagentaInstance(this, isInverse);
    }
  }

  class MagentaInstance extends IBlockCipherInstance {
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

    get key() {
      return this._key ? [...this._key] : null; // Return copy
    }

    // Feed data to the cipher
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

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

    // MAGENTA key setup
    _keySetup(key) {
      const keySchedule = {
        key: OpCodes.CopyArray(key),
        rounds: key.length === 32 ? 8 : 6,
        subkeys: []
      };

      // Generate subkeys - MAGENTA uses symmetric arrangement
      if (key.length === 16) {
        // 128-bit key: K1, K1, K2, K2, K1, K1 (where K1=key[0:7], K2=key[8:15])
        const k1 = key.slice(0, 8);
        const k2 = key.slice(8, 16);
        keySchedule.subkeys = [k1, k1, k2, k2, k1, k1];
      } else if (key.length === 24) {
        // 192-bit key: similar pattern with 3 parts
        const k1 = key.slice(0, 8);
        const k2 = key.slice(8, 16);
        const k3 = key.slice(16, 24);
        keySchedule.subkeys = [k1, k2, k3, k1, k2, k3];
      } else {
        // 256-bit key: 8 rounds with 4 parts
        const k1 = key.slice(0, 8);
        const k2 = key.slice(8, 16);
        const k3 = key.slice(16, 24);
        const k4 = key.slice(24, 32);
        keySchedule.subkeys = [k1, k2, k3, k4, k1, k2, k3, k4];
      }

      return keySchedule;
    }

    // MAGENTA S-box using GF(2^8) discrete exponentiation
    // S-box[x] = x^99 in GF(2^8) with irreducible polynomial x^8 + x^4 + x^3 + x + 1
    _generateSBox() {
      const sbox = new Array(256);
      const irreducible = 0x11B; // x^8 + x^4 + x^3 + x + 1

      sbox[0] = 0; // Special case: 0^99 = 0

      for (let i = 1; i < 256; i++) {
        let result = 1;
        let base = i;
        let exp = 99;

        // Fast exponentiation in GF(2^8)
        while (exp > 0) {
          if (exp & 1) {
            result = this._gf256Multiply(result, base, irreducible);
          }
          base = this._gf256Multiply(base, base, irreducible);
          exp >>>= 1;
        }

        sbox[i] = result;
      }

      return sbox;
    }

    // Galois Field GF(2^8) multiplication with specified irreducible polynomial
    _gf256Multiply(a, b, irreducible) {
      let result = 0;
      a &= 0xFF;
      b &= 0xFF;

      for (let i = 0; i < 8; i++) {
        if (b & 1) {
          result ^= a;
        }

        const highBit = a & 0x80;
        a = (a << 1) & 0xFF;
        if (highBit) {
          a ^= irreducible;
        }

        b >>>= 1;
      }

      return result & 0xFF;
    }

    // MAGENTA permutation C3 - cyclic 3-bit permutation on 16 bytes
    _permutationC3(data) {
      if (data.length !== 16) {
        throw new Error('C3 permutation requires exactly 16 bytes');
      }

      // C3 performs a cyclic 3-bit rotation on the entire 128-bit block
      // This is equivalent to rotating the 16-byte array by 3 bits to the left
      const result = new Array(16);

      // Convert bytes to a single 128-bit value for bit-level operations
      let carry = 0;
      for (let i = 15; i >= 0; i--) {
        const temp = (data[i] << 3) | carry;
        result[i] = temp & 0xFF;
        carry = (temp >> 8) & 0x07;
      }

      // Apply the final carry to the most significant bits of result[0]
      result[0] |= carry;

      return result;
    }

    // MAGENTA shuffle operation on 8 bytes
    _shuffle(data) {
      if (data.length !== 8) {
        throw new Error('Shuffle operation requires exactly 8 bytes');
      }

      // MAGENTA shuffle permutation: (0,1,2,3,4,5,6,7) -> (4,5,6,7,0,1,2,3)
      return [
        data[4], data[5], data[6], data[7],
        data[0], data[1], data[2], data[3]
      ];
    }

    // MAGENTA F-function
    _fFunction(right, subkey, sbox) {
      // Concatenate right half (8 bytes) with subkey (8 bytes)
      const combined = right.concat(subkey);

      // Apply C3 permutation
      const permuted = this._permutationC3(combined);

      // Apply S-box substitution to all 16 bytes
      const substituted = permuted.map(byte => sbox[byte]);

      // Apply shuffle to first 8 bytes only
      const shuffled = this._shuffle(substituted.slice(0, 8));

      return shuffled;
    }

    // MAGENTA encryption
    _encryptBlock(data) {
      if (data.length !== 16) {
        throw new Error('Block size must be 16 bytes');
      }

      // Split into left and right halves (64 bits each)
      let left = data.slice(0, 8);
      let right = data.slice(8, 16);

      // Apply Feistel rounds
      for (let round = 0; round < this.keySchedule.rounds; round++) {
        const subkey = this.keySchedule.subkeys[round];
        const fOutput = this._fFunction(right, subkey, this.sbox);

        // XOR f-output with left half
        const newRight = OpCodes.XorArrays(left, fOutput);

        // Swap halves for next round
        left = right;
        right = newRight;
      }

      // Final swap (standard Feistel)
      return right.concat(left);
    }

    // MAGENTA decryption
    _decryptBlock(data) {
      if (data.length !== 16) {
        throw new Error('Block size must be 16 bytes');
      }

      // Split into left and right halves
      let left = data.slice(0, 8);
      let right = data.slice(8, 16);

      // Apply Feistel rounds in reverse order
      for (let round = this.keySchedule.rounds - 1; round >= 0; round--) {
        const subkey = this.keySchedule.subkeys[round];
        const fOutput = this._fFunction(right, subkey, this.sbox);

        // XOR f-output with left half
        const newRight = OpCodes.XorArrays(left, fOutput);

        // Swap halves for next round
        left = right;
        right = newRight;
      }

      // Final swap (standard Feistel)
      return right.concat(left);
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