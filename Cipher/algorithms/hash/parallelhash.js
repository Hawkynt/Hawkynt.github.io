/*
 * ParallelHash - Parallel Hash Function
 * Professional implementation following NIST SP 800-185
 * (c)2006-2025 Hawkynt
 *
 * ParallelHash is a hash function designed to support efficient hashing of very long strings
 * by taking advantage of parallelism available in modern processors. It uses cSHAKE internally.
 * Reference: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Load dependencies first
    require('./cshake.js');
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize } = AlgorithmFramework;

  /**
   * leftEncode from NIST SP 800-185
   * Encodes integer with byte count prefix
   * @param {uint32} value - Value to encode
   * @returns {uint8[]} Encoded bytes [length, bytes...]
   */
  function leftEncode(value) {
    // Determine number of bytes needed
    let n = 1;
    let v = OpCodes.Shr32(value, 8);
    while (v !== 0) {
      n++;
      v = OpCodes.Shr32(v, 8);
    }

    /** @type {uint8[]} */
    const result = [n]; // Byte count prefix

    // Encode value in big-endian
    for (let i = 1; i <= n; i++) {
      result.push(OpCodes.GetByte(value, n - i));
    }

    return result;
  }

  /**
   * rightEncode from NIST SP 800-185
   * Encodes integer with byte count suffix
   * @param {uint32} value - Value to encode
   * @returns {uint8[]} Encoded bytes [bytes..., length]
   */
  function rightEncode(value) {
    // Determine number of bytes needed
    let n = 1;
    let v = OpCodes.Shr32(value, 8);
    while (v !== 0) {
      n++;
      v = OpCodes.Shr32(v, 8);
    }

    /** @type {uint8[]} */
    const result = [];

    // Encode value in big-endian
    for (let i = 0; i < n; i++) {
      result.push(OpCodes.GetByte(value, n - i - 1));
    }

    result.push(n); // Byte count suffix

    return result;
  }

  /**
   * Get cSHAKE instance for the given bit length
   * Returns cSHAKE128 or cSHAKE256 instance
   * @param {int32} bitLength - 128 or 256
   * @param {uint8[]} functionName - N
   * @param {uint8[]} customization - S
   * @returns {IHashFunctionInstance} A fresh cSHAKE instance
   */
  function getCSHAKEInstance(bitLength, functionName, customization) {
    // Load the appropriate cSHAKE algorithm
    const cshakeName = bitLength === 128 ? "cSHAKE128" : "cSHAKE256";
    const cshakeAlgo = AlgorithmFramework.Find(cshakeName);

    if (!cshakeAlgo) {
      throw new Error(cshakeName + ' algorithm not found. Please ensure cshake.js is loaded.');
    }

    /** @type {IHashFunctionInstance} */
    const instance = cshakeAlgo.CreateInstance();
    instance.functionName = functionName;
    instance.customization = customization;
    return instance;
  }

  /**
 * ParallelHashAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class ParallelHashAlgorithm extends HashFunctionAlgorithm {
    /**
     * @param {int32} bitLength - 128 or 256
     */
    constructor(bitLength) {
      super();
      /** @type {int32} */
      this.bitLength = bitLength;
      this.name = 'ParallelHash' + bitLength;
      this.description = 'ParallelHash' + bitLength + ' is a parallel hash function from NIST SP 800-185 that supports efficient hashing of very long strings using parallelism. Based on cSHAKE' + bitLength + '.';
      this.inventor = "NIST";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "Parallel Hash Function";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.SupportedOutputSizes = [new KeySize(1, 1024, 1)]; // Variable output
      /** @type {int32} */
      this.BlockSize = bitLength === 128 ? 168 : 136; // cSHAKE rate

      this.documentation = [
        new LinkItem("NIST SP 800-185", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf"),
        new LinkItem("NIST Examples", "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/ParallelHash_samples.pdf")
      ];

      this.references = [
        new LinkItem("BouncyCastle Implementation", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/ParallelHash.java")
      ];

      // Extract test vectors from reference implementation
      if (bitLength === 128) {
        this.tests = [
          {
            text: "ParallelHash128: Sample #1 (B=8, S='', 32 bytes) - NIST",
            uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/ParallelHash_samples.pdf",
            input: OpCodes.Hex8ToBytes("000102030405060710111213141516172021222324252627"),
            blockSize: 8,
            customization: [],
            outputSize: 32,
            expected: OpCodes.Hex8ToBytes("BA8DC1D1D979331D3F813603C67F72609AB5E44B94A0B8F9AF46514454A2B4F5")
          },
          {
            text: "ParallelHash128: Sample #2 (B=8, S='Parallel Data', 32 bytes) - NIST",
            uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/ParallelHash_samples.pdf",
            input: OpCodes.Hex8ToBytes("000102030405060710111213141516172021222324252627"),
            blockSize: 8,
            customization: OpCodes.AnsiToBytes("Parallel Data"),
            outputSize: 32,
            expected: OpCodes.Hex8ToBytes("FC484DCB3F84DCEEDC353438151BEE58157D6EFED0445A81F165E495795B7206")
          },
          {
            text: "ParallelHash128: Sample #3 (B=12, S='Parallel Data', 32 bytes) - NIST",
            uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/ParallelHash_samples.pdf",
            input: OpCodes.Hex8ToBytes(
              "000102030405060708090A0B101112131415161718191A1B202122232425262728292A2B" +
              "303132333435363738393A3B404142434445464748494A4B505152535455565758595A5B"
            ),
            blockSize: 12,
            customization: OpCodes.AnsiToBytes("Parallel Data"),
            outputSize: 32,
            expected: OpCodes.Hex8ToBytes("F7FD5312896C6685C828AF7E2ADB97E393E7F8D54E3C2EA4B95E5ACA3796E8FC")
          },
          {
            // ParallelHash_samples.pdf carries the three fixed-length samples
            // only; it has no XOF section, so this value is cited where it is
            // actually published.
            text: "ParallelHash128: XOF mode (B=12, S='Parallel Data', 32 bytes)",
            uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/ParallelHashTest.java",
            input: OpCodes.Hex8ToBytes(
              "000102030405060708090A0B101112131415161718191A1B202122232425262728292A2B" +
              "303132333435363738393A3B404142434445464748494A4B505152535455565758595A5B"
            ),
            blockSize: 12,
            customization: OpCodes.AnsiToBytes("Parallel Data"),
            outputSize: 32,
            xofMode: true,
            expected: OpCodes.Hex8ToBytes("0127AD9772AB904691987FCC4A24888F341FA0DB2145E872D4EFD255376602F0")
          }
        ];
      } else if (bitLength === 256) {
        this.tests = [
          {
            text: "ParallelHash256: Sample #1 (B=8, S='', 64 bytes) - NIST",
            uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/ParallelHash_samples.pdf",
            input: OpCodes.Hex8ToBytes("000102030405060710111213141516172021222324252627"),
            blockSize: 8,
            customization: [],
            outputSize: 64,
            expected: OpCodes.Hex8ToBytes(
              "BC1EF124DA34495E948EAD207DD98422" +
              "35DA432D2BBC54B4C110E64C451105531B7F2A3E0CE055C02805E7C2DE1FB746" +
              "AF97A1DD01F43B824E31B87612410429"
            )
          },
          {
            text: "ParallelHash256: Sample #2 (B=8, S='Parallel Data', 64 bytes) - NIST",
            uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/ParallelHash_samples.pdf",
            input: OpCodes.Hex8ToBytes("000102030405060710111213141516172021222324252627"),
            blockSize: 8,
            customization: OpCodes.AnsiToBytes("Parallel Data"),
            outputSize: 64,
            expected: OpCodes.Hex8ToBytes(
              "CDF15289B54F6212B4BC270528B49526" +
              "006DD9B54E2B6ADD1EF6900DDA3963BB33A72491F236969CA8AFAEA29C682D" +
              "47A393C065B38E29FAE651A2091C833110"
            )
          },
          {
            text: "ParallelHash256: Sample #3 (B=12, S='Parallel Data', 64 bytes) - NIST",
            uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/ParallelHash_samples.pdf",
            input: OpCodes.Hex8ToBytes(
              "000102030405060708090A0B101112131415161718191A1B202122232425262728292A2B" +
              "303132333435363738393A3B404142434445464748494A4B505152535455565758595A5B"
            ),
            blockSize: 12,
            customization: OpCodes.AnsiToBytes("Parallel Data"),
            outputSize: 64,
            expected: OpCodes.Hex8ToBytes(
              "69D0FCB764EA055DD09334BC6021CB7E" +
              "4B61348DFF375DA262671CDEC3EFFA8D1B4568A6CCE16B1CAD946DDDE27F6CE2" +
              "B8DEE4CD1B24851EBF00EB90D43813E9"
            )
          },
          {
            // As above: the NIST sample PDF has no XOF section.
            text: "ParallelHash256: XOF mode (B=12, S='Parallel Data', 64 bytes)",
            uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/ParallelHashTest.java",
            input: OpCodes.Hex8ToBytes(
              "000102030405060708090A0B101112131415161718191A1B202122232425262728292A2B" +
              "303132333435363738393A3B404142434445464748494A4B505152535455565758595A5B"
            ),
            blockSize: 12,
            customization: OpCodes.AnsiToBytes("Parallel Data"),
            outputSize: 64,
            xofMode: true,
            expected: OpCodes.Hex8ToBytes(
              "6B3E790B330C889A204C2FBC728D809F" +
              "19367328D852F4002DC829F73AFD6BCEFB7FE5B607B13A801C0BE5C1170BDB79" +
              "4E339458FDB0E62A6AF3D42558970249"
            )
          }
        ];
      }
    }

    /**
     * Create new hash instance
     * @param {boolean} [isInverse=false] - A hash has no inverse: true yields null
     * @returns {ParallelHashInstance} New hash instance
     */
    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new ParallelHashInstance(this, this.bitLength);
    }
  }

  /**
 * ParallelHash instance implementing the Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class ParallelHashInstance extends IHashFunctionInstance {
    /**
     * Initialize a ParallelHash instance
     * @param {ParallelHashAlgorithm} algorithm - Parent algorithm instance
     * @param {int32} bitLength - 128 or 256
     */
    constructor(algorithm, bitLength) {
      super(algorithm);
      /** @type {int32} */
      this.bitLength = bitLength;
      /** @type {int32} Default: 32 bytes for 128-bit, 64 bytes for 256-bit */
      this._outputSize = bitLength / 4;
      /** @type {int32} Default block size parameter B */
      this._blockSize = 8;
      /** @type {uint8[]} S parameter */
      this._customization = [];
      /** @type {boolean} XOF mode flag */
      this._xofMode = false;

      // Main cSHAKE instance (accumulates compressed block hashes)
      /** @type {IHashFunctionInstance} */
      this.cshake = null;

      // Compressor cSHAKE instance (hashes individual blocks)
      /** @type {IHashFunctionInstance} */
      this.compressor = null;

      // Buffer for current block
      /** @type {uint8[]} */
      this.buffer = [];

      // Count of blocks processed
      /** @type {uint32} */
      this.nCount = 0;

      // Internal state flag
      /** @type {boolean} */
      this.firstOutput = true;
    }

    /**
     * Set the output length
     * @param {int32} size - Output length in bytes, 1..1024
     */
    set outputSize(size) {
      if (size < 1 || size > 1024) {
        throw new Error('Invalid output size: ' + size + ' bytes');
      }
      this._outputSize = size;
    }

    /**
     * The output length
     * @returns {int32} Output length in bytes
     */
    get outputSize() {
      return this._outputSize;
    }

    /**
     * Set the block size B
     * @param {int32} size - Block size in bytes (positive)
     */
    set blockSize(size) {
      if (size <= 0) {
        throw new Error("Block size must be greater than 0");
      }
      this._blockSize = size;
      /** @type {uint8[]} */
      const empty = [];
      this.buffer = empty; // Reset buffer when block size changes
    }

    /**
     * The block size B
     * @returns {int32} Block size in bytes
     */
    get blockSize() {
      return this._blockSize;
    }

    /**
     * Set the customization string S
     * @param {uint8[]} customBytes - S as bytes (null clears it)
     */
    set customization(customBytes) {
      /** @type {uint8[]} */
      const copy = [];
      if (customBytes !== null && customBytes !== undefined) {
        for (let i = 0; i < customBytes.length; i++) copy.push(customBytes[i]);
      }
      this._customization = copy;
    }

    /**
     * The customization string S
     * @returns {uint8[]} Copy of S
     */
    get customization() {
      return this._customization.slice();
    }

    /**
     * Select XOF output (right_encode(0)) instead of fixed-length output
     * @param {boolean} enabled - True for ParallelHashXOF
     */
    set xofMode(enabled) {
      this._xofMode = enabled ? true : false;
    }

    /**
     * Whether XOF output is selected
     * @returns {boolean} True for ParallelHashXOF
     */
    get xofMode() {
      return this._xofMode;
    }

    /**
     * Initialize cSHAKE instances
     * @returns {void}
     */
    _initialize() {
      if (this.cshake !== null) {
        return; // Already initialized
      }

      /** @type {uint8[]} */
      const empty = [];

      // Main cSHAKE with function name "ParallelHash" and customization S
      const functionName = OpCodes.AnsiToBytes("ParallelHash");
      this.cshake = getCSHAKEInstance(this.bitLength, functionName, this._customization);

      // Compressor cSHAKE with empty function name and customization
      this.compressor = getCSHAKEInstance(this.bitLength, empty, empty);

      // Reset state
      this.buffer = empty.slice();
      this.nCount = 0;
      this.firstOutput = true;

      // Feed leftEncode(B) to main cSHAKE
      const bEncoded = leftEncode(this._blockSize);
      this.cshake.Feed(bEncoded);
    }

    /**
     * Compress a block using cSHAKE
     * @param {uint8[]} blockData - One block of B bytes (or the final shorter one)
     * @returns {void}
     */
    _compressBlock(blockData) {
      // Hash the block with compressor cSHAKE
      const compressorOutput = this.bitLength / 4; // 32 bytes for 128-bit, 64 bytes for 256-bit
      this.compressor.outputSize = compressorOutput;
      this.compressor.Feed(blockData);
      /** @type {uint8[]} */
      const compressed = this.compressor.Result();

      // Feed compressed hash to main cSHAKE
      this.cshake.Feed(compressed);
      this.nCount++;

      // Reset compressor for next block
      /** @type {uint8[]} */
      const empty = [];
      this.compressor = getCSHAKEInstance(this.bitLength, empty, empty);
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Initialize on first feed
      this._initialize();

      let offset = 0;

      // Fill current block
      while (offset < data.length && this.buffer.length < this._blockSize) {
        this.buffer.push(data[offset++]);
      }

      // Process complete blocks
      while (this.buffer.length === this._blockSize) {
        this._compressBlock(this.buffer);
        this.buffer = [];

        // Fill next block
        while (offset < data.length && this.buffer.length < this._blockSize) {
          this.buffer.push(data[offset++]);
        }
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Initialize if never fed data
      this._initialize();

      if (this.firstOutput) {
        // Process any remaining buffered data
        if (this.buffer.length > 0) {
          this._compressBlock(this.buffer);
          this.buffer = [];
        }

        // Feed rightEncode(nCount) and rightEncode(outputSize * 8)
        const nEncoded = rightEncode(this.nCount);
        this.cshake.Feed(nEncoded);

        // For XOF mode, output size is 0 (variable length)
        const outputSizeBits = this._xofMode ? 0 : this._outputSize * 8;
        const outEncoded = rightEncode(outputSizeBits);
        this.cshake.Feed(outEncoded);

        this.firstOutput = false;
      }

      // Get final output from main cSHAKE
      this.cshake.outputSize = this._outputSize;
      /** @type {uint8[]} */
      const output = this.cshake.Result();
      return output;
    }
  }

  // Register ParallelHash128
  const parallelHash128 = new ParallelHashAlgorithm(128);
  if (!AlgorithmFramework.Find(parallelHash128.name)) {
    RegisterAlgorithm(parallelHash128);
  }

  // Register ParallelHash256
  const parallelHash256 = new ParallelHashAlgorithm(256);
  if (!AlgorithmFramework.Find(parallelHash256.name)) {
    RegisterAlgorithm(parallelHash256);
  }

  return {
    ParallelHashAlgorithm,
    ParallelHashInstance,
    ParallelHash128: parallelHash128,
    ParallelHash256: parallelHash256
  };
}));
