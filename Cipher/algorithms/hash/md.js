

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

  // ===== SHARED MD CONSTANTS AND UTILITIES =====

  // MD2 S-box (RFC 1319 Appendix A) - Complete 256-byte table
  const MD2_S = Object.freeze([
    0x29, 0x2E, 0x43, 0xC9, 0xA2, 0xD8, 0x7C, 0x01, 0x3D, 0x36, 0x54, 0xA1, 0xEC, 0xF0, 0x06, 0x13,
    0x62, 0xA7, 0x05, 0xF3, 0xC0, 0xC7, 0x73, 0x8C, 0x98, 0x93, 0x2B, 0xD9, 0xBC, 0x4C, 0x82, 0xCA,
    0x1E, 0x9B, 0x57, 0x3C, 0xFD, 0xD4, 0xE0, 0x16, 0x67, 0x42, 0x6F, 0x18, 0x8A, 0x17, 0xE5, 0x12,
    0xBE, 0x4E, 0xC4, 0xD6, 0xDA, 0x9E, 0xDE, 0x49, 0xA0, 0xFB, 0xF5, 0x8E, 0xBB, 0x2F, 0xEE, 0x7A,
    0xA9, 0x68, 0x79, 0x91, 0x15, 0xB2, 0x07, 0x3F, 0x94, 0xC2, 0x10, 0x89, 0x0B, 0x22, 0x5F, 0x21,
    0x80, 0x7F, 0x5D, 0x9A, 0x5A, 0x90, 0x32, 0x27, 0x35, 0x3E, 0xCC, 0xE7, 0xBF, 0xF7, 0x97, 0x03,
    0xFF, 0x19, 0x30, 0xB3, 0x48, 0xA5, 0xB5, 0xD1, 0xD7, 0x5E, 0x92, 0x2A, 0xAC, 0x56, 0xAA, 0xC6,
    0x4F, 0xB8, 0x38, 0xD2, 0x96, 0xA4, 0x7D, 0xB6, 0x76, 0xFC, 0x6B, 0xE2, 0x9C, 0x74, 0x04, 0xF1,
    0x45, 0x9D, 0x70, 0x59, 0x64, 0x71, 0x87, 0x20, 0x86, 0x5B, 0xCF, 0x65, 0xE6, 0x2D, 0xA8, 0x02,
    0x1B, 0x60, 0x25, 0xAD, 0xAE, 0xB0, 0xB9, 0xF6, 0x1C, 0x46, 0x61, 0x69, 0x34, 0x40, 0x7E, 0x0F,
    0x55, 0x47, 0xA3, 0x23, 0xDD, 0x51, 0xAF, 0x3A, 0xC3, 0x5C, 0xF9, 0xCE, 0xBA, 0xC5, 0xEA, 0x26,
    0x2C, 0x53, 0x0D, 0x6E, 0x85, 0x28, 0x84, 0x09, 0xD3, 0xDF, 0xCD, 0xF4, 0x41, 0x81, 0x4D, 0x52,
    0x6A, 0xDC, 0x37, 0xC8, 0x6C, 0xC1, 0xAB, 0xFA, 0x24, 0xE1, 0x7B, 0x08, 0x0C, 0xBD, 0xB1, 0x4A,
    0x78, 0x88, 0x95, 0x8B, 0xE3, 0x63, 0xE8, 0x6D, 0xE9, 0xCB, 0xD5, 0xFE, 0x3B, 0x00, 0x1D, 0x39,
    0xF2, 0xEF, 0xB7, 0x0E, 0x66, 0x58, 0xD0, 0xE4, 0xA6, 0x77, 0x72, 0xF8, 0xEB, 0x75, 0x4B, 0x0A,
    0x31, 0x44, 0x50, 0xB4, 0x8F, 0xED, 0x1F, 0x1A, 0xDB, 0x99, 0x8D, 0x33, 0x9F, 0x11, 0x83, 0x14
  ]);

  // MD4 constants
  const MD4_H = Object.freeze([0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476]);

  // MD4 auxiliary functions
  function MD4_F(x, y, z) { return (x & y) | (~x & z); }
  function MD4_G(x, y, z) { return (x & y) | (x & z) | (y & z); }
  function MD4_AUX_H(x, y, z) { return x ^ y ^ z; }

  // Shared padding function for MD4/MD5 (Merkle-Damgard construction)
  function padMessageMD(msgBytes) {
    const msgLength = msgBytes.length;
    const bitLength = msgLength * 8;

    // Create copy for padding
    const padded = msgBytes.slice();

    // Append the '1' bit (plus zero padding to make it a byte)
    padded.push(0x80);

    // Append 0 <= k < 512 bits '0', such that the resulting message length in bits
    // is congruent to 448 (mod 512)
    while ((padded.length % 64) !== 56) {
      padded.push(0x00);
    }

    // Append original length in bits mod 2^64 to message as 64-bit little-endian integer
    const bitLengthLow = bitLength & 0xFFFFFFFF;
    const bitLengthHigh = Math.floor(bitLength / 0x100000000);

    const lengthBytes = OpCodes.Unpack32LE(bitLengthLow).concat(OpCodes.Unpack32LE(bitLengthHigh));
    padded.push(...lengthBytes);

    return padded;
  }

  // ===== MD2 IMPLEMENTATION =====

  /**
 * MD2Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class MD2Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MD2";
      this.description = "MD2 is a 128-bit cryptographic hash function and predecessor to MD4 and MD5. It is extremely slow and cryptographically broken with known collision and preimage attacks.";
      this.inventor = "Ronald Rivest";
      this.year = 1989;
      this.category = CategoryType.HASH;
      this.subCategory = "MD Family";
      this.securityStatus = SecurityStatus.INSECURE;
      this.complexity = ComplexityType.BASIC;
      this.country = CountryCode.US;

      // Hash-specific metadata
      this.SupportedOutputSizes = [16]; // 128 bits = 16 bytes

      // Performance and technical specifications
      this.blockSize = 16; // 128 bits = 16 bytes
      this.outputSize = 16; // 128 bits = 16 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 1319 - MD2 Message-Digest Algorithm", "https://tools.ietf.org/html/rfc1319"),
        new LinkItem("Wikipedia MD2", "https://en.wikipedia.org/wiki/MD2_(cryptography)")
      ];

      this.references = [
        new LinkItem("MD2 Cryptanalysis Papers", "https://link.springer.com/chapter/10.1007/978-3-540-45146-4_3")
      ];

      // Test vectors from RFC 1319 with expected byte arrays
      this.tests = [
        {
          text: "RFC 1319 Test Vector - Empty string",
          uri: "https://tools.ietf.org/html/rfc1319",
          input: [],
          expected: OpCodes.Hex8ToBytes('8350e5a3e24c153df2275c9f80692773')
        },
        {
          text: "RFC 1319 Test Vector - 'a'",
          uri: "https://tools.ietf.org/html/rfc1319",
          input: [0x61], // 'a'
          expected: OpCodes.Hex8ToBytes('32ec01ec4a6dac72c0ab96fb34c0b5d1')
        },
        {
          text: "RFC 1319 Test Vector - 'abc'",
          uri: "https://tools.ietf.org/html/rfc1319",
          input: [0x61, 0x62, 0x63], // 'abc'
          expected: OpCodes.Hex8ToBytes('da853b0d3f88d99b30283a69e6ded6bb')
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new MD2AlgorithmInstance(this, isInverse);
    }
  }

  /**
 * MD2Algorithm cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MD2AlgorithmInstance extends IHashFunctionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 16; // 128 bits = 16 bytes

      // MD2 state
      this._buffer = [];
      this._length = 0;
    }

    Init() {
      this._buffer = [];
      this._length = 0;
    }

    Update(data) {
      if (!data || data.length === 0) return;

      // Convert string to byte array if needed
      if (typeof data === 'string') {
        data = OpCodes.AnsiToBytes(data);
      }

      this._buffer = this._buffer.concat(Array.from(data));
      this._length += data.length;
    }

    Final() {
      return this._computeMD2(this._buffer);
    }

    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    _computeMD2(data) {
      // Step 1: Padding
      const padLength = 16 - (data.length % 16);
      const paddedData = data.concat(new Array(padLength).fill(padLength));

      // Step 2: Checksum computation
      const checksum = new Array(16).fill(0);
      let L = 0;

      for (let i = 0; i < paddedData.length; i += 16) {
        for (let j = 0; j < 16; j++) {
          const c = paddedData[i + j];
          checksum[j] ^= MD2_S[c ^ L];
          L = checksum[j];
        }
      }

      // Step 3: Hash computation
      const finalData = paddedData.concat(checksum);
      const hash = new Array(48).fill(0); // MD2 uses 48-byte state

      // Process each 16-byte block
      for (let i = 0; i < finalData.length; i += 16) {
        // Copy block into X[16..31]
        for (let j = 0; j < 16; j++) {
          hash[16 + j] = finalData[i + j];
          hash[32 + j] = hash[16 + j] ^ hash[j];
        }

        // 18 rounds of transformation
        let t = 0;
        for (let round = 0; round < 18; round++) {
          for (let k = 0; k < 48; k++) {
            t = hash[k] ^ MD2_S[t];
            hash[k] = t;
          }
          const mod_val = 0xFF + 1;
          t = (t + round) % mod_val;
        }
      }

      // Return first 16 bytes as hash
      return hash.slice(0, 16);
    }

    KeySetup(key) {
      // Hashes don't use keys
      return true;
    }

    EncryptBlock(blockIndex, plaintext) {
      // Return hash of the plaintext
      return this.Hash(plaintext);
    }

    DecryptBlock(blockIndex, ciphertext) {
      // Hash functions are one-way
      throw new Error('MD2 is a one-way hash function - decryption not possible');
    }

    ClearData() {
      if (this._buffer) OpCodes.ClearArray(this._buffer);
      this._length = 0;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      this.Init();
      this.Update(data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      return this.Final();
    }
  }

  // ===== MD4 IMPLEMENTATION =====

  /**
 * MD4Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class MD4Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MD4";
      this.description = "MD4 is a 128-bit cryptographic hash function and predecessor to MD5. It is cryptographically broken with practical collision attacks and should only be used for educational purposes.";
      this.inventor = "Ronald Rivest";
      this.year = 1990;
      this.category = CategoryType.HASH;
      this.subCategory = "MD Family";
      this.securityStatus = SecurityStatus.INSECURE;
      this.complexity = ComplexityType.BASIC;
      this.country = CountryCode.US;

      // Hash-specific metadata
      this.SupportedOutputSizes = [16]; // 128 bits = 16 bytes

      // Performance and technical specifications
      this.blockSize = 64; // 512 bits = 64 bytes
      this.outputSize = 16; // 128 bits = 16 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 1320 - MD4 Message-Digest Algorithm", "https://tools.ietf.org/html/rfc1320"),
        new LinkItem("Wikipedia MD4", "https://en.wikipedia.org/wiki/MD4")
      ];

      this.references = [
        new LinkItem("MD4 Collision Attacks", "https://link.springer.com/chapter/10.1007/978-3-540-28628-8_1")
      ];

      // Test vectors from RFC 1320 with expected byte arrays
      this.tests = [
        {
          text: "RFC 1320 Test Vector - Empty string",
          uri: "https://tools.ietf.org/html/rfc1320",
          input: [],
          expected: OpCodes.Hex8ToBytes("31d6cfe0d16ae931b73c59d7e0c089c0")
        },
        {
          text: "RFC 1320 Test Vector - 'a'",
          uri: "https://tools.ietf.org/html/rfc1320",
          input: OpCodes.AnsiToBytes("a"),
          expected: OpCodes.Hex8ToBytes("bde52cb31de33e46245e05fbdbd6fb24")
        },
        {
          text: "RFC 1320 Test Vector - 'abc'",
          uri: "https://tools.ietf.org/html/rfc1320",
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("a448017aaf21d8525fc10ae87aa6729d")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new MD4AlgorithmInstance(this, isInverse);
    }
  }

  /**
 * MD4Algorithm cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MD4AlgorithmInstance extends IHashFunctionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 16; // 128 bits = 16 bytes

      // MD4 state
      this._buffer = [];
      this._length = 0;
    }

    Init() {
      this._buffer = [];
      this._length = 0;
    }

    Update(data) {
      if (!data || data.length === 0) return;

      // Convert string to byte array if needed
      if (typeof data === 'string') {
        data = OpCodes.AnsiToBytes(data);
      }

      this._buffer = this._buffer.concat(Array.from(data));
      this._length += data.length;
    }

    Final() {
      return this._computeMD4(this._buffer);
    }

    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    _computeMD4(data) {
      // Pre-processing: append padding
      const paddedMsg = padMessageMD(data);

      // Initialize MD4 buffer
      let h = [...MD4_H];

      // Process message in 512-bit chunks
      for (let chunkStart = 0; chunkStart < paddedMsg.length; chunkStart += 64) {
        const chunk = paddedMsg.slice(chunkStart, chunkStart + 64);

        // Break chunk into sixteen 32-bit little-endian words
        const X = new Array(16);
        for (let i = 0; i < 16; i++) {
          const offset = i * 4;
          X[i] = OpCodes.Pack32LE(chunk[offset], chunk[offset + 1], chunk[offset + 2], chunk[offset + 3]);
        }

        // Initialize working variables
        let A = h[0], B = h[1], C = h[2], D = h[3];

        // MD4 complete 3-round algorithm (RFC 1320)

        // Round 1: F function, no constants
        const round1Ops = [
          [0, 1, 2, 3,  0,  3], [3, 0, 1, 2,  1,  7], [2, 3, 0, 1,  2, 11], [1, 2, 3, 0,  3, 19],
          [0, 1, 2, 3,  4,  3], [3, 0, 1, 2,  5,  7], [2, 3, 0, 1,  6, 11], [1, 2, 3, 0,  7, 19],
          [0, 1, 2, 3,  8,  3], [3, 0, 1, 2,  9,  7], [2, 3, 0, 1, 10, 11], [1, 2, 3, 0, 11, 19],
          [0, 1, 2, 3, 12,  3], [3, 0, 1, 2, 13,  7], [2, 3, 0, 1, 14, 11], [1, 2, 3, 0, 15, 19]
        ];

        const vars = [A, B, C, D];
        for (const [a, b, c, d, xi, s] of round1Ops) {
          const temp = (vars[a] + MD4_F(vars[b], vars[c], vars[d]) + X[xi]) >>> 0;
          vars[a] = OpCodes.RotL32(temp, s);
        }
        [A, B, C, D] = vars;

        // Round 2: G function, constant 0x5A827999
        const round2Ops = [
          [0, 1, 2, 3,  0,  3], [3, 0, 1, 2,  4,  5], [2, 3, 0, 1,  8,  9], [1, 2, 3, 0, 12, 13],
          [0, 1, 2, 3,  1,  3], [3, 0, 1, 2,  5,  5], [2, 3, 0, 1,  9,  9], [1, 2, 3, 0, 13, 13],
          [0, 1, 2, 3,  2,  3], [3, 0, 1, 2,  6,  5], [2, 3, 0, 1, 10,  9], [1, 2, 3, 0, 14, 13],
          [0, 1, 2, 3,  3,  3], [3, 0, 1, 2,  7,  5], [2, 3, 0, 1, 11,  9], [1, 2, 3, 0, 15, 13]
        ];

        const vars2 = [A, B, C, D];
        for (const [a, b, c, d, xi, s] of round2Ops) {
          const temp = (vars2[a] + MD4_G(vars2[b], vars2[c], vars2[d]) + X[xi] + 0x5A827999) >>> 0;
          vars2[a] = OpCodes.RotL32(temp, s);
        }
        [A, B, C, D] = vars2;

        // Round 3: H function, constant 0x6ED9EBA1
        const round3Ops = [
          [0, 1, 2, 3,  0,  3], [3, 0, 1, 2,  8,  9], [2, 3, 0, 1,  4, 11], [1, 2, 3, 0, 12, 15],
          [0, 1, 2, 3,  2,  3], [3, 0, 1, 2, 10,  9], [2, 3, 0, 1,  6, 11], [1, 2, 3, 0, 14, 15],
          [0, 1, 2, 3,  1,  3], [3, 0, 1, 2,  9,  9], [2, 3, 0, 1,  5, 11], [1, 2, 3, 0, 13, 15],
          [0, 1, 2, 3,  3,  3], [3, 0, 1, 2, 11,  9], [2, 3, 0, 1,  7, 11], [1, 2, 3, 0, 15, 15]
        ];

        const vars3 = [A, B, C, D];
        for (const [a, b, c, d, xi, s] of round3Ops) {
          const temp = (vars3[a] + MD4_AUX_H(vars3[b], vars3[c], vars3[d]) + X[xi] + 0x6ED9EBA1) >>> 0;
          vars3[a] = OpCodes.RotL32(temp, s);
        }
        [A, B, C, D] = vars3;

        // Add this chunk's hash to result so far
        h[0] = (h[0] + A) >>> 0;
        h[1] = (h[1] + B) >>> 0;
        h[2] = (h[2] + C) >>> 0;
        h[3] = (h[3] + D) >>> 0;
      }

      // Convert to byte array (little-endian)
      const result = [];
      h.forEach(word => {
        const bytes = OpCodes.Unpack32LE(word);
        result.push(...bytes);
      });

      return result;
    }

    KeySetup(key) {
      // Hashes don't use keys
      return true;
    }

    EncryptBlock(blockIndex, plaintext) {
      // Return hash of the plaintext
      return this.Hash(plaintext);
    }

    DecryptBlock(blockIndex, ciphertext) {
      // Hash functions are one-way
      throw new Error('MD4 is a one-way hash function - decryption not possible');
    }

    ClearData() {
      if (this._buffer) OpCodes.ClearArray(this._buffer);
      this._length = 0;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      this.Init();
      this.Update(data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      return this.Final();
    }
  }

  // ===== MD5 IMPLEMENTATION =====

  /**
 * MD5Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class MD5Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Basic information
      this.name = "MD5";
      this.description = "128-bit cryptographic hash function designed by Ronald Rivest. Fast but cryptographically broken with practical collision attacks.";
      this.inventor = "Ronald Rivest";
      this.year = 1991;
      this.category = CategoryType.HASH;
      this.subCategory = "MD Family";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Capabilities
      this.SupportedOutputSizes = [{ minSize: 16, maxSize: 16, stepSize: 1 }];

      // Documentation
      this.documentation = [
        new LinkItem("RFC 1321 - The MD5 Message-Digest Algorithm", "https://tools.ietf.org/html/rfc1321"),
        new LinkItem("NIST SP 800-107 - Recommendation for Applications Using Approved Hash Algorithms", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-107r1.pdf"),
        new LinkItem("Wikipedia - MD5", "https://en.wikipedia.org/wiki/MD5")
      ];

      // References
      this.references = [
        new LinkItem("OpenSSL MD5 Implementation", "https://github.com/openssl/openssl/blob/master/crypto/md5/md5_dgst.c"),
        new LinkItem("MD5 Collision Research", "https://www.win.tue.nl/hashclash/rogue-ca/"),
        new LinkItem("RFC 6151 - Updated Security Considerations for MD5", "https://tools.ietf.org/html/rfc6151")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability("Collision Attack", "Practical collision attacks demonstrated by Wang et al. in 2004. Can generate two different messages with same MD5 hash.", "https://eprint.iacr.org/2004/199.pdf"),
        new Vulnerability("Chosen-prefix Collision", "Attackers can create collisions with chosen prefixes, enabling sophisticated attacks.", "https://www.win.tue.nl/hashclash/rogue-ca/"),
        new Vulnerability("Rainbow Table Attack", "Common passwords vulnerable to precomputed rainbow table attacks.", "")
      ];

      // Test vectors from RFC 1321
      this.tests = [
        {
          input: [],
          expected: OpCodes.Hex8ToBytes("d41d8cd98f00b204e9800998ecf8427e"),
          text: "RFC 1321 Test Vector - Empty string",
          uri: "https://tools.ietf.org/html/rfc1321"
        },
        {
          input: OpCodes.AnsiToBytes("a"),
          expected: OpCodes.Hex8ToBytes("0cc175b9c0f1b6a831c399e269772661"),
          text: "RFC 1321 Test Vector - 'a'",
          uri: "https://tools.ietf.org/html/rfc1321"
        },
        {
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("900150983cd24fb0d6963f7d28e17f72"),
          text: "RFC 1321 Test Vector - 'abc'",
          uri: "https://tools.ietf.org/html/rfc1321"
        },
        {
          input: OpCodes.AnsiToBytes("message digest"),
          expected: OpCodes.Hex8ToBytes("f96b697d7cb7938d525a2f31aaf161d0"),
          text: "RFC 1321 Test Vector - 'message digest'",
          uri: "https://tools.ietf.org/html/rfc1321"
        },
        {
          input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
          expected: OpCodes.Hex8ToBytes("c3fcd3d76192e4007dfb496cca67e13b"),
          text: "RFC 1321 Test Vector - alphabet",
          uri: "https://tools.ietf.org/html/rfc1321"
        },
        {
          input: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"),
          expected: OpCodes.Hex8ToBytes("d174ab98d277d9f5a5611c2c9f419d9f"),
          text: "RFC 1321 Test Vector - alphanumeric",
          uri: "https://tools.ietf.org/html/rfc1321"
        },
        {
          input: OpCodes.AnsiToBytes("1234567890".repeat(8)),
          expected: OpCodes.Hex8ToBytes("57edf4a22be3c955ac49da2e2107b67a"),
          text: "RFC 1321 Test Vector - numeric sequence",
          uri: "https://tools.ietf.org/html/rfc1321"
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      // Hash functions don't have an inverse operation
      if (isInverse) {
        return null;
      }
      return new MD5AlgorithmInstance(this);
    }
  }

  /**
 * MD5Algorithm cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MD5AlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.OutputSize = 16; // 128 bits
      this._Reset();
    }

    _Reset() {
      // MD5 initialization values (RFC 1321)
      const initValues = OpCodes.Hex32ToDWords('67452301EFCDAB8998BADCFE10325476');
      this.h = new Uint32Array(initValues);

      this.buffer = new Uint8Array(64);
      this.bufferLength = 0;
      this.totalLength = 0;
    }

    Initialize() {
      this._Reset();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      const input = new Uint8Array(data);
      this.totalLength += input.length;

      let offset = 0;

      // Process any remaining bytes in buffer
      if (this.bufferLength > 0) {
        const needed = 64 - this.bufferLength;
        const available = Math.min(needed, input.length);

        this.buffer.set(input.slice(0, available), this.bufferLength);
        this.bufferLength += available;
        offset = available;

        if (this.bufferLength === 64) {
          this._ProcessBlock(this.buffer);
          this.bufferLength = 0;
        }
      }

      // Process complete 64-byte blocks
      while (offset + 64 <= input.length) {
        this._ProcessBlock(input.slice(offset, offset + 64));
        offset += 64;
      }

      // Store remaining bytes in buffer
      if (offset < input.length) {
        const remaining = input.slice(offset);
        this.buffer.set(remaining, 0);
        this.bufferLength = remaining.length;
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Save current state
      const originalH = this.h.slice();
      const originalBuffer = this.buffer.slice();
      const originalBufferLength = this.bufferLength;
      const originalTotalLength = this.totalLength;

      // Create padding
      const msgLength = this.totalLength;
      const padLength = (msgLength % 64 < 56) ? (56 - (msgLength % 64)) : (120 - (msgLength % 64));

      // Add padding
      const padding = new Uint8Array(padLength + 8);
      padding[0] = 0x80; // First padding bit is 1

      // Add length in bits as 64-bit little-endian
      const bitLength = msgLength * 8;
      const lengthBytes = OpCodes.Unpack32LE(bitLength);
      padding[padLength] = lengthBytes[0];
      padding[padLength + 1] = lengthBytes[1];
      padding[padLength + 2] = lengthBytes[2];
      padding[padLength + 3] = lengthBytes[3];
      // For practical message sizes, high 32 bits are always 0
      padding[padLength + 4] = 0;
      padding[padLength + 5] = 0;
      padding[padLength + 6] = 0;
      padding[padLength + 7] = 0;

      this.Feed(padding);

      // Convert hash to bytes (little-endian)
      const result = [];
      for (let i = 0; i < 4; i++) {
        const bytes = OpCodes.Unpack32LE(this.h[i]);
        result.push(...bytes);
      }

      // Restore original state (so Result() can be called multiple times)
      this.h = originalH;
      this.buffer = originalBuffer;
      this.bufferLength = originalBufferLength;
      this.totalLength = originalTotalLength;

      return result;
    }

    _ProcessBlock(block) {
      // Convert block to 32-bit words (little-endian)
      const w = new Array(16);
      for (let i = 0; i < 16; i++) {
        w[i] = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
      }

      // Initialize working variables
      let a = this.h[0], b = this.h[1], c = this.h[2], d = this.h[3];

      // MD5 round constants (RFC 1321)
      const k = OpCodes.Hex32ToDWords(
        'D76AA478E8C7B756242070DBC1BDCEEEF57C0FAF4787C62AA8304613FD469501' +
        '698098D88B44F7AFFFFF5BB1895CD7BE6B901122FD987193A679438E49B40821' +
        'F61E2562C040B340265E5A51E9B6C7AAD62F105D02441453D8A1E681E7D3FBC8' +
        '21E1CDE6C33707D6F4D50D87455A14EDA9E3E905FCEFA3F8676F02D98D2A4C8A' +
        'FFFA39428771F6816D9D6122FDE5380CA4BEEA444BDECFA9F6BB4B60BEBFBC70' +
        '289B7EC6EAA127FAD4EF308504881D05D9D4D039E6DB99E51FA27CF8C4AC5665' +
        'F4292244432AFF97AB9423A7FC93A039655B59C38F0CCC92FFEFF47D85845DD1' +
        '6FA87E4FFE2CE6E0A30143144E0811A1F7537E82BD3AF2352AD7D2BBEB86D391'
      );

      // MD5 auxiliary functions
      const F = (x, y, z) => (x & y) | (~x & z);
      const G = (x, y, z) => (x & z) | (y & ~z);
      const H = (x, y, z) => x ^ y ^ z;
      const I = (x, y, z) => y ^ (x | ~z);

      // MD5 shift amounts per round (RFC 1321)
      const shifts = [
        7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
        5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
        4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
        6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21
      ];

      // MD5 rounds
      for (let i = 0; i < 64; i++) {
        let f, g;

        if (i < 16) {
          f = F(b, c, d);
          g = i;
        } else if (i < 32) {
          f = G(b, c, d);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          f = H(b, c, d);
          g = (3 * i + 5) % 16;
        } else {
          f = I(b, c, d);
          g = (7 * i) % 16;
        }

        f = (f + a + k[i] + w[g]) >>> 0;
        a = d;
        d = c;
        c = b;
        b = (b + OpCodes.RotL32(f, shifts[i])) >>> 0;
      }

      // Add to hash
      this.h[0] = (this.h[0] + a) >>> 0;
      this.h[1] = (this.h[1] + b) >>> 0;
      this.h[2] = (this.h[2] + c) >>> 0;
      this.h[3] = (this.h[3] + d) >>> 0;
    }
  }

  // ===== REGISTRATION =====

  const md2Instance = new MD2Algorithm();
  if (!AlgorithmFramework.Find(md2Instance.name)) {
    RegisterAlgorithm(md2Instance);
  }

  const md4Instance = new MD4Algorithm();
  if (!AlgorithmFramework.Find(md4Instance.name)) {
    RegisterAlgorithm(md4Instance);
  }

  const md5Instance = new MD5Algorithm();
  if (!AlgorithmFramework.Find(md5Instance.name)) {
    RegisterAlgorithm(md5Instance);
  }

  // ===== EXPORTS =====

  return {
    MD2Algorithm, MD2AlgorithmInstance,
    MD4Algorithm, MD4AlgorithmInstance,
    MD5Algorithm, MD5AlgorithmInstance
  };
}));
