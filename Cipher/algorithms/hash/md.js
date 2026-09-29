

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
  /** @type {uint8[]} */
  const MD2_S = Object.freeze(OpCodes.Hex8ToBytes(
    '292E43C9A2D87C013D3654A1ECF00613' +
    '62A705F3C0C7738C98932BD9BC4C82CA' +
    '1E9B573CFDD4E01667426F188A17E512' +
    'BE4EC4D6DA9EDE49A0FBF58EBB2FEE7A' +
    'A968799115B2073F94C210890B225F21' +
    '807F5D9A5A903227353ECCE7BFF79703' +
    'FF1930B348A5B5D1D75E922AAC56AAC6' +
    '4FB838D296A47DB676FC6BE29C7404F1' +
    '459D705964718720865BCF65E62DA802' +
    '1B6025ADAEB0B9F61C46616934407E0F' +
    '5547A323DD51AF3AC35CF9CEBAC5EA26' +
    '2C530D6E85288409D3DFCDF441814D52' +
    '6ADC37C86CC1ABFA24E17B080CBDB14A' +
    '7888958BE363E86DE9CBD5FE3B001D39' +
    'F2EFB70E6658D0E4A67772F8EB754B0A' +
    '314450B48FED1F1ADB998D339F118314'
  ));

  // MD4 constants
  /** @type {uint32[]} */
  const MD4_H = Object.freeze(OpCodes.Hex32ToDWords('67452301EFCDAB8998BADCFE10325476'));

  // MD4 message word order of rounds 2 and 3, and the rotation of each step
  // (steps rotate the roles of A, B, C, D; see RFC 1320 section 3.4)
  /** @type {int32[]} */
  const MD4_X2 = [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15];
  /** @type {int32[]} */
  const MD4_X3 = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];
  /** @type {int32[]} */
  const MD4_S1 = [3, 7, 11, 19];
  /** @type {int32[]} */
  const MD4_S2 = [3, 5, 9, 13];
  /** @type {int32[]} */
  const MD4_S3 = [3, 9, 11, 15];

  /**
   * MD4 round 1 function: (x AND y) OR (NOT x AND z)
   * @param {uint32} x - Word
   * @param {uint32} y - Word
   * @param {uint32} z - Word
   * @returns {uint32} Result word
   */
  function MD4_F(x, y, z) { return OpCodes.Or32(OpCodes.And32(x, y), OpCodes.And32(OpCodes.Not32(x), z)); }

  /**
   * MD4 round 2 function: majority of x, y, z
   * @param {uint32} x - Word
   * @param {uint32} y - Word
   * @param {uint32} z - Word
   * @returns {uint32} Result word
   */
  function MD4_G(x, y, z) { return OpCodes.Or32(OpCodes.Or32(OpCodes.And32(x, y), OpCodes.And32(x, z)), OpCodes.And32(y, z)); }

  /**
   * MD4 round 3 function: x XOR y XOR z
   * @param {uint32} x - Word
   * @param {uint32} y - Word
   * @param {uint32} z - Word
   * @returns {uint32} Result word
   */
  function MD4_AUX_H(x, y, z) { return OpCodes.Xor32(OpCodes.Xor32(x, y), z); }

  // MD5 round constants (RFC 1321)
  /** @type {uint32[]} */
  const MD5_K = Object.freeze(OpCodes.Hex32ToDWords(
    'D76AA478E8C7B756242070DBC1BDCEEEF57C0FAF4787C62AA8304613FD469501' +
    '698098D88B44F7AFFFFF5BB1895CD7BE6B901122FD987193A679438E49B40821' +
    'F61E2562C040B340265E5A51E9B6C7AAD62F105D02441453D8A1E681E7D3FBC8' +
    '21E1CDE6C33707D6F4D50D87455A14EDA9E3E905FCEFA3F8676F02D98D2A4C8A' +
    'FFFA39428771F6816D9D6122FDE5380CA4BEEA444BDECFA9F6BB4B60BEBFBC70' +
    '289B7EC6EAA127FAD4EF308504881D05D9D4D039E6DB99E51FA27CF8C4AC5665' +
    'F4292244432AFF97AB9423A7FC93A039655B59C38F0CCC92FFEFF47D85845DD1' +
    '6FA87E4FFE2CE6E0A30143144E0811A1F7537E82BD3AF2352AD7D2BBEB86D391'
  ));

  // MD5 shift amounts per round (RFC 1321)
  /** @type {int32[]} */
  const MD5_SHIFTS = [
    7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
    5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
    4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
    6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21
  ];

  /**
   * MD5 F function: (x AND y) OR (NOT x AND z)
   * @param {uint32} x - Word
   * @param {uint32} y - Word
   * @param {uint32} z - Word
   * @returns {uint32} Result word
   */
  function MD5_F(x, y, z) { return OpCodes.Or32(OpCodes.And32(x, y), OpCodes.And32(OpCodes.Not32(x), z)); }

  /**
   * MD5 G function: (x AND z) OR (y AND NOT z)
   * @param {uint32} x - Word
   * @param {uint32} y - Word
   * @param {uint32} z - Word
   * @returns {uint32} Result word
   */
  function MD5_G(x, y, z) { return OpCodes.Or32(OpCodes.And32(x, z), OpCodes.And32(y, OpCodes.Not32(z))); }

  /**
   * MD5 H function: x XOR y XOR z
   * @param {uint32} x - Word
   * @param {uint32} y - Word
   * @param {uint32} z - Word
   * @returns {uint32} Result word
   */
  function MD5_H(x, y, z) { return OpCodes.Xor32(OpCodes.Xor32(x, y), z); }

  /**
   * MD5 I function: y XOR (x OR NOT z)
   * @param {uint32} x - Word
   * @param {uint32} y - Word
   * @param {uint32} z - Word
   * @returns {uint32} Result word
   */
  function MD5_I(x, y, z) { return OpCodes.Xor32(y, OpCodes.Or32(x, OpCodes.Not32(z))); }

  /**
   * Shared padding function for MD4 (Merkle-Damgard construction)
   * @param {uint8[]} msgBytes - Message
   * @returns {uint8[]} Padded message (a multiple of 64 bytes)
   */
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
    const bitLengthLow = OpCodes.ToUint32(bitLength);
    const bitLengthHigh = Math.floor(bitLength / 0x100000000);

    const lengthBytes = OpCodes.Unpack32LE(bitLengthLow).concat(OpCodes.Unpack32LE(bitLengthHigh));
    for (let _i = 0; _i < lengthBytes.length; _i++) padded.push(lengthBytes[_i]);

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
      this.SupportedOutputSizes = [new KeySize(16, 16, 1)]; // 128 bits = 16 bytes

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
   * Create new hash instance
   * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
   * @returns {MD2AlgorithmInstance} New hash instance
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
   * @param {MD2Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 16; // 128 bits = 16 bytes

      // MD2 state
      /** @type {uint8[]} */
      this._buffer = [];
      /** @type {int32} */
      this._length = 0;
      /** @type {boolean} */
      this._streamStarted = false;
    }

    /**
     * Start a new message
     * @returns {void}
     */
    Init() {
      this._buffer = [];
      this._length = 0;
    }

    /**
     * Add data to the message
     * @param {uint8[]} data - Bytes to hash
     * @returns {void}
     */
    Update(data) {
      if (!data || data.length === 0) return;

      this._buffer = this._buffer.concat(Array.from(data));
      this._length += data.length;
    }

    /**
     * Finish the message
     * @returns {uint8[]} Digest
     */
    Final() {
      return this._computeMD2(this._buffer);
    }

    /**
     * Hash a complete message in one operation
     * @param {uint8[]} message - Message to hash
     * @returns {uint8[]} Digest
     */
    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    /**
     * Compute the MD2 digest of a whole message (RFC 1319 section 3)
     * @param {uint8[]} data - Message
     * @returns {uint8[]} 16-byte digest
     */
    _computeMD2(data) {
      // Step 1: Padding
      const padLength = 16 - (data.length % 16);
      /** @type {uint8[]} */
      const padding = OpCodes.CreateArray(padLength, padLength);
      const paddedData = data.concat(padding);

      // Step 2: Checksum computation
      /** @type {uint8[]} */
      const checksum = OpCodes.CreateArray(16, 0);
      /** @type {uint8} */
      let L = 0;

      for (let i = 0; i < paddedData.length; i += 16) {
        for (let j = 0; j < 16; j++) {
          const c = paddedData[i + j];
          checksum[j] = OpCodes.ToByte(OpCodes.Xor32(checksum[j], MD2_S[OpCodes.ToByte(OpCodes.Xor32(c, L))]));
          L = checksum[j];
        }
      }

      // Step 3: Hash computation
      const finalData = paddedData.concat(checksum);
      /** @type {uint8[]} */
      const hash = OpCodes.CreateArray(48, 0); // MD2 uses 48-byte state

      // Process each 16-byte block
      for (let i = 0; i < finalData.length; i += 16) {
        // Copy block into X[16..31]
        for (let j = 0; j < 16; j++) {
          hash[16 + j] = finalData[i + j];
          hash[32 + j] = OpCodes.ToByte(OpCodes.Xor32(hash[16 + j], hash[j]));
        }

        // 18 rounds of transformation
        /** @type {uint8} */
        let t = 0;
        for (let round = 0; round < 18; round++) {
          for (let k = 0; k < 48; k++) {
            t = OpCodes.ToByte(OpCodes.Xor32(hash[k], MD2_S[t]));
            hash[k] = t;
          }
          t = OpCodes.ToByte(OpCodes.ToUint32(t + round));
        }
      }

      // Return first 16 bytes as hash
      return hash.slice(0, 16);
    }

    /**
     * Hashes take no key
     * @param {uint8[]} key - Unused
     * @returns {boolean} Always true
     */
    KeySetup(key) {
      // Hashes don't use keys
      return true;
    }

    /**
     * Hash one block (block-cipher style convenience)
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} plaintext - Bytes to hash
     * @returns {uint8[]} Digest
     */
    EncryptBlock(blockIndex, plaintext) {
      // Return hash of the plaintext
      return this.Hash(plaintext);
    }

    /**
     * Hash functions have no inverse
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} ciphertext - Unused
     * @returns {uint8[]} Never returns
     * @throws {Error} Always
     */
    DecryptBlock(blockIndex, ciphertext) {
      // Hash functions are one-way
      throw new Error('MD2 is a one-way hash function - decryption not possible');
    }

    /**
     * Wipe the buffered message
     * @returns {void}
     */
    ClearData() {
      if (this._buffer) OpCodes.ClearArray(this._buffer);
      this._length = 0;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @returns {void}
   */

    Feed(data) {
      // Init() discards the state, so it belongs at the start of the message and
      // not at the start of every call: Feed(a); Feed(b) must absorb the same
      // block sequence as Feed(a || b).
      if (!this._streamStarted) {
        this.Init();
        this._streamStarted = true;
      }
      this.Update(data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Digest
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
      this.SupportedOutputSizes = [new KeySize(16, 16, 1)]; // 128 bits = 16 bytes

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
   * Create new hash instance
   * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
   * @returns {MD4AlgorithmInstance} New hash instance
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
   * @param {MD4Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 16; // 128 bits = 16 bytes

      // MD4 state
      /** @type {uint8[]} */
      this._buffer = [];
      /** @type {int32} */
      this._length = 0;
      /** @type {boolean} */
      this._streamStarted = false;
    }

    /**
     * Start a new message
     * @returns {void}
     */
    Init() {
      this._buffer = [];
      this._length = 0;
    }

    /**
     * Add data to the message
     * @param {uint8[]} data - Bytes to hash
     * @returns {void}
     */
    Update(data) {
      if (!data || data.length === 0) return;

      this._buffer = this._buffer.concat(Array.from(data));
      this._length += data.length;
    }

    /**
     * Finish the message
     * @returns {uint8[]} Digest
     */
    Final() {
      return this._computeMD4(this._buffer);
    }

    /**
     * Hash a complete message in one operation
     * @param {uint8[]} message - Message to hash
     * @returns {uint8[]} Digest
     */
    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    /**
     * Compute the MD4 digest of a whole message (RFC 1320 section 3)
     * @param {uint8[]} data - Message
     * @returns {uint8[]} 16-byte digest
     */
    _computeMD4(data) {
      // Pre-processing: append padding
      const paddedMsg = padMessageMD(data);

      // Initialize MD4 buffer
      /** @type {uint32[]} */
      const h = MD4_H.slice();

      // Process message in 512-bit chunks
      for (let chunkStart = 0; chunkStart < paddedMsg.length; chunkStart += 64) {
        const chunk = paddedMsg.slice(chunkStart, chunkStart + 64);

        // Break chunk into sixteen 32-bit little-endian words
        /** @type {uint32[]} */
        const X = new Array(16);
        for (let i = 0; i < 16; i++) {
          const offset = i * 4;
          X[i] = OpCodes.Pack32LE(chunk[offset], chunk[offset + 1], chunk[offset + 2], chunk[offset + 3]);
        }

        // Working variables A, B, C, D; step i updates v[a] with a = 0, 3, 2, 1, ...
        // and uses the next three (cyclically) as the function arguments
        /** @type {uint32[]} */
        const v = h.slice();

        // Round 1: F function, no constant
        for (let i = 0; i < 16; i++) {
          const a = (4 - (i % 4)) % 4;
          const temp = OpCodes.Add32(OpCodes.Add32(v[a], MD4_F(v[(a + 1) % 4], v[(a + 2) % 4], v[(a + 3) % 4])), X[i]);
          v[a] = OpCodes.RotL32(temp, MD4_S1[i % 4]);
        }

        // Round 2: G function, constant 0x5A827999
        for (let i = 0; i < 16; i++) {
          const a = (4 - (i % 4)) % 4;
          const temp = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(v[a], MD4_G(v[(a + 1) % 4], v[(a + 2) % 4], v[(a + 3) % 4])), X[MD4_X2[i]]), 0x5A827999);
          v[a] = OpCodes.RotL32(temp, MD4_S2[i % 4]);
        }

        // Round 3: H function, constant 0x6ED9EBA1
        for (let i = 0; i < 16; i++) {
          const a = (4 - (i % 4)) % 4;
          const temp = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(v[a], MD4_AUX_H(v[(a + 1) % 4], v[(a + 2) % 4], v[(a + 3) % 4])), X[MD4_X3[i]]), 0x6ED9EBA1);
          v[a] = OpCodes.RotL32(temp, MD4_S3[i % 4]);
        }

        // Add this chunk's hash to result so far
        h[0] = OpCodes.Add32(h[0], v[0]);
        h[1] = OpCodes.Add32(h[1], v[1]);
        h[2] = OpCodes.Add32(h[2], v[2]);
        h[3] = OpCodes.Add32(h[3], v[3]);
      }

      // Convert to byte array (little-endian)
      /** @type {uint8[]} */
      const result = [];
      for (let i = 0; i < 4; i++) {
        const bytes = OpCodes.Unpack32LE(h[i]);
        for (let _i = 0; _i < bytes.length; _i++) result.push(bytes[_i]);
      }

      return result;
    }

    /**
     * Hashes take no key
     * @param {uint8[]} key - Unused
     * @returns {boolean} Always true
     */
    KeySetup(key) {
      // Hashes don't use keys
      return true;
    }

    /**
     * Hash one block (block-cipher style convenience)
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} plaintext - Bytes to hash
     * @returns {uint8[]} Digest
     */
    EncryptBlock(blockIndex, plaintext) {
      // Return hash of the plaintext
      return this.Hash(plaintext);
    }

    /**
     * Hash functions have no inverse
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} ciphertext - Unused
     * @returns {uint8[]} Never returns
     * @throws {Error} Always
     */
    DecryptBlock(blockIndex, ciphertext) {
      // Hash functions are one-way
      throw new Error('MD4 is a one-way hash function - decryption not possible');
    }

    /**
     * Wipe the buffered message
     * @returns {void}
     */
    ClearData() {
      if (this._buffer) OpCodes.ClearArray(this._buffer);
      this._length = 0;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @returns {void}
   */

    Feed(data) {
      // Init() discards the state, so it belongs at the start of the message and
      // not at the start of every call: Feed(a); Feed(b) must absorb the same
      // block sequence as Feed(a || b).
      if (!this._streamStarted) {
        this.Init();
        this._streamStarted = true;
      }
      this.Update(data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Digest
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
      this.SupportedOutputSizes = [new KeySize(16, 16, 1)];

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
        new Vulnerability("Collision Attack", '', "Practical collision attacks demonstrated by Wang et al. in 2004. Can generate two different messages with same MD5 hash.", "https://eprint.iacr.org/2004/199.pdf"),
        new Vulnerability("Chosen-prefix Collision", '', "Attackers can create collisions with chosen prefixes, enabling sophisticated attacks.", "https://www.win.tue.nl/hashclash/rogue-ca/"),
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
   * Create new hash instance
   * @param {boolean} [isInverse=false] - Unused: a hash has no inverse (MD5 returns null for it)
   * @returns {MD5AlgorithmInstance} New hash instance
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
    /**
     * Initialize an MD5 instance
     * @param {MD5Algorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      this.OutputSize = 16; // 128 bits
      this._Reset();
    }

    /**
     * Reset the chaining value and the block buffer
     * @returns {void}
     */
    _Reset() {
      // MD5 initialization values (RFC 1321)
      const initValues = OpCodes.Hex32ToDWords('67452301EFCDAB8998BADCFE10325476');
      this.h = new Uint32Array(initValues);

      this.buffer = new Uint8Array(64);
      this.bufferLength = 0;
      this.totalLength = 0;
    }

    /**
     * Reset the chaining value and the block buffer
     * @returns {void}
     */
    Initialize() {
      this._Reset();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @returns {void}
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
   * @returns {uint8[]} Digest
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
      /** @type {uint8[]} */
      const result = [];
      for (let i = 0; i < 4; i++) {
        const bytes = OpCodes.Unpack32LE(this.h[i]);
        for (let _i = 0; _i < bytes.length; _i++) result.push(bytes[_i]);
      }

      // Restore original state (so Result() can be called multiple times)
      this.h = originalH;
      this.buffer = originalBuffer;
      this.bufferLength = originalBufferLength;
      this.totalLength = originalTotalLength;

      return result;
    }

    /**
     * Process one 64-byte block (RFC 1321 section 3.4)
     * @param {uint8[]} block - 64-byte block
     * @returns {void}
     */
    _ProcessBlock(block) {
      // Convert block to 32-bit words (little-endian)
      /** @type {uint32[]} */
      const w = new Array(16);
      for (let i = 0; i < 16; i++) {
        w[i] = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
      }

      // Initialize working variables
      let a = this.h[0];
      let b = this.h[1];
      let c = this.h[2];
      let d = this.h[3];

      // MD5 rounds
      for (let i = 0; i < 64; i++) {
        /** @type {uint32} */
        let f;
        /** @type {int32} */
        let g;

        if (i < 16) {
          f = MD5_F(b, c, d);
          g = i;
        } else if (i < 32) {
          f = MD5_G(b, c, d);
          g = (5 * i + 1) % 16;
        } else if (i < 48) {
          f = MD5_H(b, c, d);
          g = (3 * i + 5) % 16;
        } else {
          f = MD5_I(b, c, d);
          g = (7 * i) % 16;
        }

        f = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(f, a), MD5_K[i]), w[g]);
        a = d;
        d = c;
        c = b;
        b = OpCodes.Add32(b, OpCodes.RotL32(f, MD5_SHIFTS[i]));
      }

      // Add to hash
      this.h[0] = OpCodes.Add32(this.h[0], a);
      this.h[1] = OpCodes.Add32(this.h[1], b);
      this.h[2] = OpCodes.Add32(this.h[2], c);
      this.h[3] = OpCodes.Add32(this.h[3], d);
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
