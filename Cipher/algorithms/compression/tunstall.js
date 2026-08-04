/*
 * Tunstall Coding Algorithm Implementation (Variable-to-Fixed Length Coding)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Tunstall coding is the classical variable-to-fixed length code: it builds a
 * complete binary parse tree over the *bit* stream of the source so that every
 * leaf carries (approximately) equal probability, then replaces each variable
 * length bit-string leaf with a single fixed-width codeword. This is the dual
 * of Huffman coding (which is fixed-to-variable).
 *
 * Reference:
 *   B. P. Tunstall, "Synthesis of Noiseless Compression Codes",
 *   Ph.D. dissertation, Georgia Institute of Technology, 1967.
 *   See also: T. J. Ferguson and J. H. Rabinowitz, "Self-synchronizing Huffman
 *   codes", IEEE Transactions on Information Theory, 1984 (background on
 *   variable-to-fixed codes and complete prefix trees).
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

  const DICTIONARY_SIZE = 256; // number of leaves = number of 1-byte codewords

  /**
 * TunstallCompression - Variable-to-fixed length coding algorithm
 * @class
 * @extends {CompressionAlgorithm}
 */

  class TunstallCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Tunstall Coding";
        this.description = "Variable-to-fixed length source code. Builds a complete binary tree over the input bit-stream by repeatedly splitting the highest-probability leaf, producing a dictionary of variable-length bit-strings that are each mapped to one fixed-width (one byte) codeword.";
        this.inventor = "Brian Parker Tunstall";
        this.year = 1967;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Variable-to-Fixed Coding";
        this.securityStatus = null;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem("Tunstall coding - Wikipedia", "https://en.wikipedia.org/wiki/Tunstall_coding"),
          new LinkItem("B.P. Tunstall PhD dissertation abstract (Georgia Tech, 1967)", "https://en.wikipedia.org/wiki/Tunstall_coding#History"),
          new LinkItem("Introduction to Data Compression (Sayood) - Variable-to-fixed codes", "https://www.elsevier.com/books/introduction-to-data-compression/sayood/978-0-12-620862-7")
        ];

        this.references = [
          new LinkItem("Elements of Information Theory (Cover and Thomas)", "https://www.wiley.com/en-us/Elements+of+Information+Theory%2C+2nd+Edition-p-9780471241959"),
          new LinkItem("Self-synchronizing Huffman codes (Ferguson and Rabinowitz, 1984)", "https://doi.org/10.1109/TIT.1984.1056980")
        ];

        // Test vectors - self-computed round-trip verification vectors produced by
        // this implementation. The dictionary is rebuilt deterministically from the
        // transmitted bit-probability header (data length and one-bit count), so the
        // exact codeword stream is implementation-defined but fully reproducible.
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          },
          {
            text: "Repetitive input - all zero bytes",
            uri: "https://en.wikipedia.org/wiki/Tunstall_coding",
            input: [0, 0, 0, 0, 0, 0, 0, 0],
            expected: [0,0,0,8, 0,0,0,0, 254]
          },
          {
            text: "Text sample - 'ABAAAB'",
            uri: "https://en.wikipedia.org/wiki/Tunstall_coding",
            input: OpCodes.AsciiToBytes("ABAAAB"),
            expected: [0,0,0,6, 0,0,0,12, 161,154,178,197,172]
          },
          {
            text: "Text sample - pangram sentence",
            uri: "https://en.wikipedia.org/wiki/Tunstall_coding",
            input: OpCodes.AsciiToBytes("the quick brown fox jumps over the lazy dog"),
            expected: [0,0,0,43, 0,0,0,162, 184,90,79,2,117,185,91,111,157,2,110,178,213,229,212,2,144,213,190,2,156,185,169,116,179,2,213,228,79,178,2,184,90,79,2,168,47,234,191,2,78,213,145]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new TunstallInstance(this, isInverse);
      }
    }

    class TunstallInstance extends IAlgorithmInstance {
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

      // ----- Shared: build a Tunstall dictionary of DICTIONARY_SIZE leaves for a
      //       binary memoryless source with P(bit=1) = p1 -----

      _buildTree(p1) {
        let p0 = 1 - p1;
        // Guard against degenerate all-zero/all-one probabilities so the tree
        // construction always terminates with well-defined (nonzero) splitting.
        if (p1 <= 0) { p1 = 1e-9; p0 = 1 - p1; }
        if (p0 <= 0) { p0 = 1e-9; p1 = 1 - p0; }

        // Leaves: { bits: [0/1,...], prob: number }
        let leaves = [
          { bits: [0], prob: p0 },
          { bits: [1], prob: p1 }
        ];

        while (leaves.length < DICTIONARY_SIZE) {
          let bestIdx = 0;
          for (let i = 1; i < leaves.length; i++) {
            if (leaves[i].prob > leaves[bestIdx].prob) bestIdx = i;
          }
          const parent = leaves[bestIdx];
          leaves.splice(bestIdx, 1);
          leaves.push({ bits: parent.bits.concat([0]), prob: parent.prob * p0 });
          leaves.push({ bits: parent.bits.concat([1]), prob: parent.prob * p1 });
        }

        return leaves; // exactly DICTIONARY_SIZE leaves, index == codeword value
      }

      _buildEncodeTrie(leaves) {
        // Trie node: { code: -1 or leaf index, child0: node|null, child1: node|null }
        const root = { code: -1, child0: null, child1: null };
        for (let code = 0; code < leaves.length; code++) {
          let node = root;
          const bits = leaves[code].bits;
          for (let i = 0; i < bits.length; i++) {
            if (bits[i] === 0) {
              if (!node.child0) node.child0 = { code: -1, child0: null, child1: null };
              node = node.child0;
            } else {
              if (!node.child1) node.child1 = { code: -1, child0: null, child1: null };
              node = node.child1;
            }
          }
          node.code = code;
        }
        return root;
      }

      // ----- Compression -----

      _compress(data) {
        const byteLen = data.length;

        // Count bits to build the empirical probability model.
        let ones = 0, total = byteLen * 8;
        for (let i = 0; i < byteLen; i++) {
          let b = data[i];
          for (let j = 0; j < 8; j++) {
            ones += OpCodes.And32(b, 1);
            b = OpCodes.Shr32(b, 1);
          }
        }

        const p1 = total > 0 ? ones / total : 0.5;
        const leaves = this._buildTree(p1);
        const trie = this._buildEncodeTrie(leaves);

        // Expand input to a bit array (MSB first), padded so the trie can always
        // find a matching leaf even near the end of the stream.
        const bits = [];
        for (let i = 0; i < byteLen; i++) {
          let b = data[i];
          const byteBits = [0, 0, 0, 0, 0, 0, 0, 0];
          for (let j = 7; j >= 0; j--) {
            byteBits[j] = OpCodes.And32(b, 1);
            b = OpCodes.Shr32(b, 1);
          }
          for (let j = 0; j < 8; j++) bits.push(byteBits[j]);
        }
        // Maximum possible leaf depth is DICTIONARY_SIZE - 1 (fully skewed tree).
        for (let i = 0; i < DICTIONARY_SIZE; i++) bits.push(0);

        const codes = [];
        let pos = 0;
        while (pos < total) {
          let node = trie;
          let consumed = 0;
          while (node.code === -1) {
            const bit = bits[pos + consumed];
            node = bit === 0 ? node.child0 : node.child1;
            consumed++;
          }
          codes.push(node.code);
          pos += consumed;
        }

        const output = [];
        { const _src = OpCodes.Unpack32BE(byteLen); for (let _i = 0; _i < _src.length; _i++) output.push(_src[_i]); }
        { const _src = OpCodes.Unpack32BE(ones); for (let _i = 0; _i < _src.length; _i++) output.push(_src[_i]); }
        for (let _i = 0; _i < codes.length; _i++) output.push(codes[_i]);
        return output;
      }

      // ----- Decompression -----

      _decompress(data) {
        if (data.length < 8) return [];

        const byteLen = OpCodes.Pack32BE(data[0], data[1], data[2], data[3]);
        const ones = OpCodes.Pack32BE(data[4], data[5], data[6], data[7]);

        if (byteLen === 0) return [];

        const total = byteLen * 8;
        const p1 = ones / total;
        const leaves = this._buildTree(p1);

        const bits = [];
        let pos = 8;
        while (bits.length < total && pos < data.length) {
          const code = data[pos++];
          const leafBits = leaves[code].bits;
          for (let i = 0; i < leafBits.length; i++) bits.push(leafBits[i]);
        }

        const out = [];
        for (let i = 0; i < byteLen; i++) {
          let byteVal = 0;
          for (let j = 0; j < 8; j++) {
            byteVal = OpCodes.Or32(OpCodes.Shl32(byteVal, 1), bits[i * 8 + j]);
          }
          out.push(OpCodes.ToByte(byteVal));
        }
        return out;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new TunstallCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TunstallCompression, TunstallInstance };
}));
