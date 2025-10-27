/*
 * TupleHash128 - SHA-3 Derived Tuple Hashing (128-bit security)
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

  // Load CSHAKE128 for underlying implementation
  // Try global scope first (browser), then require (Node.js)
  const global = typeof globalThis !== 'undefined' ? globalThis
    : (typeof window !== 'undefined' ? window
    : (typeof self !== 'undefined' ? self : {}));

  let CSHAKE128 = global.CSHAKE128;
  if (!CSHAKE128 && typeof require !== 'undefined') {
    try {
      CSHAKE128 = require('./cshake128.js');
    } catch(e) {
      // CSHAKE128 will be checked at runtime
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

  class TupleHash128 extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "TupleHash128";
      this.description = "SHA-3 derived function for unambiguous tuple hashing with 128-bit security. Encodes each tuple element to prevent collisions between different tuple structures.";
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

      // Official NIST test vectors from SP 800-185
      this.tests = [
        {
          text: "TupleHash128: (000102, 101112131415), empty S, 32 bytes (NIST)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf",
          input: null,
          tuples: [
            OpCodes.Hex8ToBytes("000102"),
            OpCodes.Hex8ToBytes("101112131415")
          ],
          customization: [],
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("C5D8786C1AFB9B8211AB34B65B2C0048FA64E6D48E263264CE1707D3FFC8ED11")
        },
        {
          text: "TupleHash128: (000102, 101112131415), S='My Tuple App', 32 bytes (NIST)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf",
          input: null,
          tuples: [
            OpCodes.Hex8ToBytes("000102"),
            OpCodes.Hex8ToBytes("101112131415")
          ],
          customization: OpCodes.AnsiToBytes("My Tuple App"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("75CDB20FF4DB1154E841D758E24160C54BAE86EB8C13E7F5F40EB35588E96DFB")
        },
        {
          text: "TupleHash128: (000102, 101112131415, 202122232425262728), S='My Tuple App', 32 bytes (NIST)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf",
          input: null,
          tuples: [
            OpCodes.Hex8ToBytes("000102"),
            OpCodes.Hex8ToBytes("101112131415"),
            OpCodes.Hex8ToBytes("202122232425262728")
          ],
          customization: OpCodes.AnsiToBytes("My Tuple App"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("E60F202C89A2631EDA8D4C588CA5FD07F39E5151998DECCF973ADB3804BB6E84")
        },
        {
          text: "TupleHash128 XOF: (000102, 101112131415, 202122232425262728), S='My Tuple App', 32 bytes (NIST)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf",
          input: null,
          tuples: [
            OpCodes.Hex8ToBytes("000102"),
            OpCodes.Hex8ToBytes("101112131415"),
            OpCodes.Hex8ToBytes("202122232425262728")
          ],
          customization: OpCodes.AnsiToBytes("My Tuple App"),
          outputSize: 32,
          xofMode: true,
          expected: OpCodes.Hex8ToBytes("900FE16CAD098D28E74D632ED852F99DAAB7F7DF4D99E775657885B4BF76D6F8")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new TupleHash128Instance(this);
    }
  }

  class TupleHash128Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // Ensure CSHAKE128 is available
      if (!CSHAKE128) {
        throw new Error("CSHAKE128 is required for TupleHash128");
      }

      // Create CSHAKE128 instance with N="TupleHash"
      const CSHAKE128Algorithm = CSHAKE128.CSHAKE128Algorithm || CSHAKE128;
      const cshakeAlgo = new CSHAKE128Algorithm();
      this.cshake = cshakeAlgo.CreateInstance();
      this.cshake.functionName = OpCodes.AnsiToBytes("TupleHash");

      this._outputSize = 32; // Default 32 bytes (256 bits)
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
      const CSHAKE128Algorithm = CSHAKE128.CSHAKE128Algorithm || CSHAKE128;
      const cshakeAlgo = new CSHAKE128Algorithm();
      this.cshake = cshakeAlgo.CreateInstance();
      this.cshake.functionName = OpCodes.AnsiToBytes("TupleHash");
      this.cshake.customization = this._customization;
      this._firstOutput = true;

      return result;
    }
  }

  RegisterAlgorithm(new TupleHash128());
  return TupleHash128;
}));
