/*
 * TupleHash256 - SHA-3 Derived Tuple Hashing (256-bit security)
 * Professional implementation following NIST SP 800-185
 * (c)2006-2025 Hawkynt
 *
 * TupleHash provides unambiguous hashing of tuple input strings with XOF mode support.
 * Reference: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem } = AlgorithmFramework;

  // Load CSHAKE256 for underlying implementation
  // Try global scope first (browser), then require (Node.js)
  const global = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof self !== 'undefined' ? self : {}));

  let CSHAKE256 = global.CSHAKE256;
  if (!CSHAKE256 && typeof require !== 'undefined') {
    try {
      CSHAKE256 = require('./cshake256.js');
    } catch(e) {
      // CSHAKE256 will be checked at runtime
    }
  }

  /**
   * Left-encode: Encode integer with length prefix at start
   * @param {number} value - Value to encode
   * @returns {Array<number>} Encoded bytes [length, bytes...]
   */
  function leftEncode(value) {
    // Count bytes needed
    let n = 1;
    let v = value;
    while ((v >>= 8) !== 0) n++;

    const result = new Array(n + 1);
    result[0] = n;
    for (let i = 1; i <= n; i++) {
      result[i] = (value >>> (8 * (n - i))) & 0xFF;
    }
    return result;
  }

  /**
   * Right-encode: Encode integer with length suffix at end
   * @param {number} value - Value to encode
   * @returns {Array<number>} Encoded bytes [bytes..., length]
   */
  function rightEncode(value) {
    // Count bytes needed
    let n = 1;
    let v = value;
    while ((v >>= 8) !== 0) n++;

    const result = new Array(n + 1);
    result[n] = n;
    for (let i = 0; i < n; i++) {
      result[i] = (value >>> (8 * (n - i - 1))) & 0xFF;
    }
    return result;
  }

  /**
   * Encode tuple element: leftEncode(bitLength) || data
   * @param {Array<number>} data - Data bytes
   * @returns {Array<number>} Encoded tuple element
   */
  function encodeTuple(data) {
    const bitLength = data.length * 8;
    return [...leftEncode(bitLength), ...data];
  }

  class TupleHash256 extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "TupleHash256";
      this.description = "SHA-3 derived function for unambiguous tuple hashing with 256-bit security. Encodes each tuple element to prevent collisions between different tuple structures.";
      this.inventor = "John Kelsey, Shu-jen Chang, Ray Perlner (NIST)";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-3 Derived";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.SupportedOutputSizes = [{ minSize: 1, maxSize: 1024, stepSize: 1 }];

      this.documentation = [
        new LinkItem(
          "NIST SP 800-185",
          "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf"
        ),
        new LinkItem(
          "NIST Test Vectors",
          "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf"
        )
      ];

      // Official NIST test vectors from SP 800-185 (via BouncyCastle)
      this.tests = [
        {
          text: "TupleHash256: (000102, 101112131415), empty S, 64 bytes (NIST)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java",
          input: null,
          outputSize: 64,
          customization: [],
          tuples: [
            OpCodes.Hex8ToBytes("000102"),
            OpCodes.Hex8ToBytes("101112131415")
          ],
          expected: OpCodes.Hex8ToBytes("CFB7058CACA5E668F81A12A20A2195CE97A925F1DBA3E7449A56F82201EC607311AC2696B1AB5EA2352DF1423BDE7BD4BB78C9AED1A853C78672F9EB23BBE194")
        },
        {
          text: "TupleHash256: (000102, 101112131415), S='My Tuple App', 64 bytes (NIST)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java",
          input: null,
          outputSize: 64,
          customization: OpCodes.AnsiToBytes("My Tuple App"),
          tuples: [
            OpCodes.Hex8ToBytes("000102"),
            OpCodes.Hex8ToBytes("101112131415")
          ],
          expected: OpCodes.Hex8ToBytes("147C2191D5ED7EFD98DBD96D7AB5A11692576F5FE2A5065F3E33DE6BBA9F3AA1C4E9A068A289C61C95AAB30AEE1E410B0B607DE3620E24A4E3BF9852A1D4367E")
        },
        {
          text: "TupleHash256: (000102, 101112131415, 202122232425262728), S='My Tuple App', 64 bytes (NIST)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java",
          input: null,
          outputSize: 64,
          customization: OpCodes.AnsiToBytes("My Tuple App"),
          tuples: [
            OpCodes.Hex8ToBytes("000102"),
            OpCodes.Hex8ToBytes("101112131415"),
            OpCodes.Hex8ToBytes("202122232425262728")
          ],
          expected: OpCodes.Hex8ToBytes("45000BE63F9B6BFD89F54717670F69A9BC763591A4F05C50D68891A744BCC6E7D6D5B5E82C018DA999ED35B0BB49C9678E526ABD8E85C13ED254021DB9E790CE")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new TupleHash256Instance(this);
    }
  }

  class TupleHash256Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // Ensure CSHAKE256 is available
      if (!CSHAKE256) {
        throw new Error("CSHAKE256 is required for TupleHash256");
      }

      // Create CSHAKE256 instance with N="TupleHash"
      const CSHAKE256Algorithm = CSHAKE256.CSHAKE256Algorithm || CSHAKE256;
      const cshakeAlgo = new CSHAKE256Algorithm();
      this.cshake = cshakeAlgo.CreateInstance();
      this.cshake.functionName = OpCodes.AnsiToBytes("TupleHash");

      this._outputSize = 64; // Default 64 bytes (512 bits)
      this._customization = [];
      this._xofMode = false;
      this._firstOutput = true;
    }

    set outputSize(size) {
      if (size < 1 || size > 1024) {
        throw new Error(`Invalid output size: ${size} bytes`);
      }
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
    }

    set customization(customBytes) {
      this._customization = customBytes ? [...customBytes] : [];
      this.cshake.customization = this._customization;
    }

    get customization() {
      return [...this._customization];
    }

    set xofMode(enabled) {
      this._xofMode = !!enabled;
    }

    get xofMode() {
      return this._xofMode;
    }

    set tuples(tupleArray) {
      // Special property for testing: accepts array of byte arrays
      if (!tupleArray || !Array.isArray(tupleArray)) return;

      for (const tuple of tupleArray) {
        this.Feed(tuple);
      }
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      // Encode the tuple element and feed to CSHAKE
      const encoded = encodeTuple(data);
      this.cshake.Feed(encoded);
    }

    Result() {
      if (this._firstOutput) {
        this._firstOutput = false;

        // Append right_encode(output_length * 8) for fixed-length output
        // For XOF mode, append right_encode(0)
        const outputBits = this._xofMode ? 0 : (this._outputSize * 8);
        const encoded = rightEncode(outputBits);
        this.cshake.Feed(encoded);
      }

      // Get output from CSHAKE
      this.cshake.outputSize = this._outputSize;
      const result = this.cshake.Result();

      // Reset for next operation
      const CSHAKE256Algorithm = CSHAKE256.CSHAKE256Algorithm || CSHAKE256;
      const cshakeAlgo = new CSHAKE256Algorithm();
      this.cshake = cshakeAlgo.CreateInstance();
      this.cshake.functionName = OpCodes.AnsiToBytes("TupleHash");
      this.cshake.customization = this._customization;
      this._firstOutput = true;

      return result;
    }
  }

  RegisterAlgorithm(new TupleHash256());
  return TupleHash256;
}));
