/*
 * Levenshtein Coding Algorithm Implementation (Universal Code for Integers)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Levenshtein coding is a universal prefix code for non-negative integers. It
 * recursively encodes the bit-length of the value, then the bit-length of that
 * bit-length, and so on, terminating at zero, so it can represent arbitrarily
 * large integers with a code whose length grows with the iterated logarithm of
 * the value (similar in spirit to, and a predecessor of, Elias omega coding).
 *
 * Reference:
 *   V. I. Levenshtein, "On the Redundancy and Delay of Separable Codes for the
 *   Natural Numbers", Problems of Cybernetics, Vol. 20, 1968, pp. 173-179.
 *   See also: P. Fenwick, "Punctured Elias Codes for variable-length coding of
 *   the integers", Technical Report 137, University of Auckland, 1996 (survey
 *   describing the Levenshtein code construction).
 */


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
 * LevenshteinCodingAlgorithm - Universal integer coding algorithm
 * @class
 * @extends {CompressionAlgorithm}
 */

  class LevenshteinCodingAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Levenshtein Coding";
        this.description = "Universal prefix code for non-negative integers. Recursively encodes the bit-length of the bit-length (an iterated-logarithm chain) terminated by zero, so arbitrarily large integers can be represented with a self-delimiting code.";
        this.inventor = "Vladimir I. Levenshtein";
        this.year = 1968;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Universal Codes";
        this.securityStatus = null;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.RU;

        // Documentation and references
        this.documentation = [
          new LinkItem("Levenshtein coding - Wikipedia", "https://en.wikipedia.org/wiki/Levenshtein_coding"),
          new LinkItem("Punctured Elias Codes for variable-length coding of the integers (Fenwick, 1996)", "https://www.cs.auckland.ac.nz/~peter-f/FTPfiles/TechRep137.ps"),
          new LinkItem("Universal code (data compression) - Wikipedia", "https://en.wikipedia.org/wiki/Universal_code_(data_compression)")
        ];

        this.references = [
          new LinkItem("V.I. Levenshtein, 'On the Redundancy and Delay of Separable Codes for the Natural Numbers' (1968)", "https://en.wikipedia.org/wiki/Levenshtein_coding#History"),
          new LinkItem("Elias omega coding (related recursive universal code)", "https://en.wikipedia.org/wiki/Elias_omega_coding")
        ];

        // Test vectors - the bit patterns match the canonical worked examples
        // published on the Wikipedia page for Levenshtein coding (values 0,1,2,3,7,8).
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          },
          {
            text: "Single small value - 1 (code '10')",
            uri: "https://en.wikipedia.org/wiki/Levenshtein_coding",
            input: [1],
            expected: [0,0,0,1, 0,0,0,2, 128]
          },
          {
            text: "Canonical worked examples - 0,1,2,3,7,8 (Wikipedia bit patterns 0,10,1100,1101,1110011,11101000)",
            uri: "https://en.wikipedia.org/wiki/Levenshtein_coding",
            input: [0, 1, 2, 3, 7, 8],
            expected: [0,0,0,6, 0,0,0,26, 89,188,250,0]
          },
          {
            text: "Text sample - 'AB3'",
            uri: "https://en.wikipedia.org/wiki/Levenshtein_coding",
            input: OpCodes.AsciiToBytes("AB3"),
            expected: [0,0,0,3, 0,0,0,41, 242,7,200,47,25,128]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new LevenshteinCodingInstance(this, isInverse);
      }
    }

    class LevenshteinCodingInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      // ----- Levenshtein code for a single non-negative integer -----

      // Returns an array of bits (0/1, MSB-first order of emission).
      _encodeValue(n) {
        if (n === 0) return [0];

        const chunks = []; // binary representation without leading 1, in order produced
        let count = 1;
        let m = n;
        while (true) {
          const bin = m.toString(2);
          const withoutLeading = bin.substring(1); // strip the leading '1'
          chunks.push(withoutLeading);
          const bitsWritten = withoutLeading.length;
          if (bitsWritten === 0) break;
          count++;
          m = bitsWritten;
        }

        // Prepend each newly produced chunk to the front of the accumulated code
        // (this mirrors the recursive "write to the beginning" definition).
        let code = '';
        for (let i = 0; i < chunks.length; i++) code = chunks[i] + code;

        const prefix = '1'.repeat(count) + '0';
        const full = prefix + code;

        const bits = new Array(full.length);
        for (let i = 0; i < full.length; i++) bits[i] = full.charCodeAt(i) === 49 ? 1 : 0; // '1' === 49
        return bits;
      }

      // Decodes one value starting at bits[pos]; returns { value, nextPos } or null.
      _decodeValue(bits, pos) {
        let ones = 0;
        let p = pos;
        while (p < bits.length && bits[p] === 1) { ones++; p++; }
        if (p >= bits.length) return null; // no terminating zero found
        p++; // skip the terminating 0

        if (ones === 0) return { value: 0, nextPos: p };

        let value = 1;
        for (let i = 0; i < ones - 1; i++) {
          if (p + value > bits.length) return null;
          let bin = 1; // implicit leading 1
          for (let j = 0; j < value; j++) bin = bin * 2 + bits[p + j];
          p += value;
          value = bin;
        }

        return { value: value, nextPos: p };
      }

      // ----- Compression -----

      _compress(data) {
        const bits = [];
        for (let i = 0; i < data.length; i++) {
          const valueBits = this._encodeValue(data[i]);
          for (let j = 0; j < valueBits.length; j++) bits.push(valueBits[j]);
        }

        const bitLen = bits.length;
        const byteCount = Math.ceil(bitLen / 8);
        const packed = new Array(byteCount).fill(0);
        for (let i = 0; i < bitLen; i++) {
          if (bits[i] === 1) {
            const byteIndex = Math.floor(i / 8);
            const bitIndex = 7 - (i % 8);
            packed[byteIndex] = OpCodes.Or32(packed[byteIndex], OpCodes.Shl32(1, bitIndex));
          }
        }

        const output = [];
        { const _src = OpCodes.Unpack32BE(data.length); for (let _i = 0; _i < _src.length; _i++) output.push(_src[_i]); }
        { const _src = OpCodes.Unpack32BE(bitLen); for (let _i = 0; _i < _src.length; _i++) output.push(_src[_i]); }
        for (let _i = 0; _i < packed.length; _i++) output.push(packed[_i]);
        return output;
      }

      // ----- Decompression -----

      _decompress(data) {
        if (data.length < 8) return [];

        const count = OpCodes.Pack32BE(data[0], data[1], data[2], data[3]);
        const bitLen = OpCodes.Pack32BE(data[4], data[5], data[6], data[7]);

        if (count === 0) return [];

        const bits = new Array(bitLen);
        for (let i = 0; i < bitLen; i++) {
          const byteIndex = 8 + Math.floor(i / 8);
          const bitIndex = 7 - (i % 8);
          const byteVal = byteIndex < data.length ? data[byteIndex] : 0;
          bits[i] = OpCodes.And32(OpCodes.Shr32(byteVal, bitIndex), 1);
        }

        const out = [];
        let pos = 0;
        for (let i = 0; i < count; i++) {
          const decoded = this._decodeValue(bits, pos);
          if (decoded === null) break;
          out.push(decoded.value);
          pos = decoded.nextPos;
        }
        return out;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new LevenshteinCodingAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LevenshteinCodingAlgorithm, LevenshteinCodingInstance };
}));
