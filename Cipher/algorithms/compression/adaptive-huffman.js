/*
 * Adaptive (Dynamic) Huffman Coding - FGK Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The classic Faller-Gallager-Knuth scheme. Unlike static Huffman coding no
 * code-length table is transmitted: encoder and decoder both start from a tree
 * holding only the NYT ("Not Yet Transmitted") node and rebuild identical codes
 * symbol by symbol by replaying the same update procedure.
 *
 * References:
 *   N. Faller, "An Adaptive System for Data Compression", Record of the 7th
 *     Asilomar Conference on Circuits, Systems and Computers, 1973.
 *   R. G. Gallager, "Variations on a Theme by Huffman", IEEE Transactions on
 *     Information Theory 24(6), 1978.
 *   D. E. Knuth, "Dynamic Huffman Coding", Journal of Algorithms 6(2), 1985.
 *
 * Every node carries a number such that, read in increasing number order,
 * weights are non-decreasing and every parent's number exceeds both of its
 * children's numbers (the sibling property). An already-seen symbol is coded as
 * the root-to-leaf path; a symbol seen for the first time is coded as the path
 * to the NYT node followed by its raw 8-bit value, after which NYT is split
 * into a new internal node with a fresh NYT child and a leaf for the symbol.
 * After every symbol the leaf's weight is incremented and propagated to the
 * root, swapping each node with the highest-numbered node of equal weight
 * (skipping its own ancestors) before incrementing.
 *
 * Wire format (matches CompressionWorkbench's BB_AdaptiveHuffman building
 * block): [originalLength: 4 bytes little-endian][bit-packed stream], bits
 * most-significant-bit first, final partial byte zero-padded. An empty input
 * produces only the 4-byte header.
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

  // ===== BIT STREAM HELPERS (MSB-first) =====

  class MsbBitWriter {
    constructor() {
      this.bytes = [];
      this.buf = 0;
      this.nBits = 0;
    }

    writeBit(bit) {
      this.buf = OpCodes.Or32(OpCodes.Shl32(this.buf, 1), OpCodes.And32(bit, 1));
      this.nBits++;
      if (this.nBits === 8) {
        this.bytes.push(OpCodes.And32(this.buf, 0xFF));
        this.buf = 0;
        this.nBits = 0;
      }
    }

    flush() {
      if (this.nBits > 0) {
        this.buf = OpCodes.Shl32(this.buf, 8 - this.nBits);
        this.bytes.push(OpCodes.And32(this.buf, 0xFF));
        this.buf = 0;
        this.nBits = 0;
      }
      return this.bytes;
    }
  }

  class MsbBitReader {
    constructor(bytes, startByte) {
      this.bytes = bytes;
      this.bitPos = startByte * 8;
    }

    readBit() {
      const byteIndex = Math.floor(this.bitPos / 8);
      if (byteIndex >= this.bytes.length)
        throw new Error('Adaptive Huffman: unexpected end of bitstream');
      const shift = 7 - (this.bitPos % 8);
      const bit = OpCodes.And32(OpCodes.Shr32(this.bytes[byteIndex], shift), 1);
      this.bitPos++;
      return bit;
    }
  }

  // ===== FGK ADAPTIVE HUFFMAN TREE =====

  class FgkNode {
    constructor(weight, symbol, isNyt, number) {
      this.weight = weight;
      this.symbol = symbol;
      this.isNyt = isNyt === true;
      this.number = number;
      this.parent = null;
      this.left = null;
      this.right = null;
    }

    get isLeaf() {
      return this.left === null && this.right === null;
    }
  }

  class FgkTree {
    constructor() {
      this.nyt = new FgkNode(0, -1, true, 1);
      this.root = this.nyt;
      this.symbolNode = new Array(256).fill(null);
      this.order = [this.nyt];
    }

    encodeSymbol(writer, symbol) {
      const leaf = this.symbolNode[symbol];

      if (leaf !== null) {
        const bits = FgkTree._pathBits(leaf);
        for (let i = 0; i < bits.length; i++) writer.writeBit(bits[i]);
        this._updateTree(leaf);
        return;
      }

      const escapeBits = FgkTree._pathBits(this.nyt);
      for (let i = 0; i < escapeBits.length; i++) writer.writeBit(escapeBits[i]);

      for (let i = 7; i >= 0; --i) writer.writeBit(OpCodes.And32(OpCodes.Shr32(symbol, i), 1));

      const newLeaf = this._splitNyt(symbol);
      this._updateTree(newLeaf);
    }

    decodeSymbol(reader) {
      let node = this.root;
      while (!node.isLeaf) node = reader.readBit() === 0 ? node.left : node.right;

      if (!node.isNyt) {
        const symbol = node.symbol;
        this._updateTree(node);
        return symbol;
      }

      let raw = 0;
      for (let i = 0; i < 8; ++i) raw = OpCodes.Or32(OpCodes.Shl32(raw, 1), reader.readBit());

      const newLeaf = this._splitNyt(raw);
      this._updateTree(newLeaf);
      return raw;
    }

    // Replaces the current NYT node with an internal node whose children are
    // the same (reused) NYT node and a new leaf for the symbol, both at weight
    // zero; the caller's subsequent update raises the leaf to weight one.
    _splitNyt(symbol) {
      const oldNyt = this.nyt;
      const newLeaf = new FgkNode(0, symbol, false, 0);
      const newInternal = new FgkNode(0, -1, false, 0);

      const parent = oldNyt.parent;
      newInternal.parent = parent;
      if (parent === null)
        this.root = newInternal;
      else if (parent.left === oldNyt)
        parent.left = newInternal;
      else
        parent.right = newInternal;

      newInternal.left = oldNyt;
      newInternal.right = newLeaf;
      oldNyt.parent = newInternal;
      newLeaf.parent = newInternal;

      // oldNyt keeps its number (the lowest weight-zero slot); newLeaf and
      // newInternal are inserted directly above it and everything above is
      // renumbered.
      const insertAt = oldNyt.number;
      this.order.splice(insertAt, 0, newLeaf);
      this.order.splice(insertAt + 1, 0, newInternal);
      for (let i = insertAt; i < this.order.length; ++i) this.order[i].number = i + 1;

      this.symbolNode[symbol] = newLeaf;
      return newLeaf;
    }

    _updateTree(start) {
      let node = start;
      while (node !== null) {
        const swapWith = this._findSwapCandidate(node);
        if (swapWith !== null) this._swap(node, swapWith);

        ++node.weight;
        node = node.parent;
      }
    }

    // The highest-numbered node of the same weight, excluding the node itself
    // and its ancestors. Equal-weight nodes always form a contiguous run in the
    // number ordering, so the run's top end is walked downward.
    _findSwapCandidate(node) {
      const weight = node.weight;
      let hi = node.number - 1;
      while (hi + 1 < this.order.length && this.order[hi + 1].weight === weight) ++hi;

      for (let i = hi; i > node.number - 1; --i) {
        const candidate = this.order[i];
        if (!FgkTree._isAncestorOf(candidate, node)) return candidate;
      }

      return null;
    }

    static _isAncestorOf(candidate, node) {
      for (let n = node.parent; n !== null; n = n.parent)
        if (n === candidate) return true;

      return false;
    }

    // Exchanges the tree positions and numbers of two nodes, each carrying its
    // own subtree along with it.
    _swap(a, b) {
      const pa = a.parent;
      const pb = b.parent;
      const aWasLeft = pa !== null && pa.left === a;
      const bWasLeft = pb !== null && pb.left === b;

      a.parent = pb;
      if (pb === null)
        this.root = a;
      else if (bWasLeft)
        pb.left = a;
      else
        pb.right = a;

      b.parent = pa;
      if (pa === null)
        this.root = b;
      else if (aWasLeft)
        pa.left = b;
      else
        pa.right = b;

      const an = a.number;
      a.number = b.number;
      b.number = an;
      this.order[a.number - 1] = a;
      this.order[b.number - 1] = b;
    }

    // Root-to-target path as bits (0 = left child, 1 = right child), root first.
    static _pathBits(target) {
      const bits = [];
      for (let n = target; n.parent !== null; n = n.parent) bits.push(n.parent.left === n ? 0 : 1);

      bits.reverse();
      return bits;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * AdaptiveHuffmanCompression - Compression algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class AdaptiveHuffmanCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Adaptive Huffman (FGK)";
      this.description = "Faller-Gallager-Knuth dynamic Huffman coding. The code tree adapts after every symbol and no code-length table is transmitted: the decoder replays the identical incremental update procedure, so both sides always hold the same tree. New symbols are introduced through a NYT escape node followed by the raw byte value. Vitter's tighter node-numbering refinement is not applied.";
      this.inventor = "Newton Faller, Robert G. Gallager, Donald E. Knuth";
      this.year = 1973;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Entropy Coding";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Adaptive Huffman coding", "https://en.wikipedia.org/wiki/Adaptive_Huffman_coding"),
        new LinkItem("Knuth, Dynamic Huffman Coding (Journal of Algorithms 6(2), 1985)", "https://www.sciencedirect.com/science/article/abs/pii/0196677485900360"),
        new LinkItem("Gallager, Variations on a Theme by Huffman (IEEE Trans. Inf. Theory, 1978)", "https://ieeexplore.ieee.org/document/1055959")
      ];

      this.references = [
        new LinkItem("Vitter, Design and Analysis of Dynamic Huffman Codes (JACM 34(4), 1987)", "https://dl.acm.org/doi/10.1145/31846.42227"),
        new LinkItem("Sayood, Introduction to Data Compression - adaptive Huffman chapter", "https://www.sciencedirect.com/book/9780124157965/introduction-to-data-compression")
      ];

      // Test vectors - byte-exact against CompressionWorkbench's
      // BB_AdaptiveHuffman building block. Expected outputs are given as hex.
      this.tests = [
        new TestCase(
          [],
          OpCodes.Hex8ToBytes("00000000"),
          "Empty input - only the 4-byte little-endian length header",
          "https://en.wikipedia.org/wiki/Adaptive_Huffman_coding"
        ),
        new TestCase(
          OpCodes.AsciiToBytes("A"),
          OpCodes.Hex8ToBytes("0100000041"),
          "Single byte 0x41 - empty NYT path plus the raw eight-bit value",
          "https://en.wikipedia.org/wiki/Adaptive_Huffman_coding"
        ),
        new TestCase(
          (function() { const b = new Array(256); for (let i = 0; i < 256; ++i) b[i] = 0x61; return b; })(),
          OpCodes.Hex8ToBytes("0001000061fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe"),
          "Long repetitive run - 256 copies of 0x61 collapse to one bit each",
          "https://en.wikipedia.org/wiki/Adaptive_Huffman_coding"
        ),
        new TestCase(
          (function() { const b = new Array(64); for (let i = 0; i < 64; ++i) b[i] = (i % 2) === 0 ? 0x61 : 0x62; return b; })(),
          OpCodes.Hex8ToBytes("4000000061315b6db6db6db6db6db6db6db4"),
          "Alternating two-byte pattern - 32 repetitions of 'ab'",
          "https://en.wikipedia.org/wiki/Adaptive_Huffman_coding"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("d3b07a1c8f4e2b6905c1fd3846a70e92"),
          OpCodes.Hex8ToBytes("10000000d3580f507047e27415a34802f3071fb438823329d01c4920"),
          "Pseudo-random binary sample - 16 high-entropy bytes, all first occurrences",
          "https://en.wikipedia.org/wiki/Adaptive_Huffman_coding"
        ),
        new TestCase(
          OpCodes.AsciiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
          OpCodes.Hex8ToBytes("b400000074340cb08038e3ac34a318358e3151ca0dec774376233281e370d51636c8e1039ef71da5034e5ec36646101eae3cfd0c99519ec17732a7a1fbad8bbd977861d8167b0caee30ad7d66fd155147b2e79a86e990722dc476f7f0b7b635f697e47635a359a30aeab5b2e79af374c83916e83b7bf85bdb1afb4bf23b1ad1acd385f75ad973cd4"),
          "ASCII text - 'the quick brown fox jumps over the lazy dog. ' repeated four times",
          "https://en.wikipedia.org/wiki/Adaptive_Huffman_coding"
        ),
        new TestCase(
          (function() { const b = new Array(256); for (let i = 0; i < 256; ++i) b[i] = i; return b; })(),
          OpCodes.Hex8ToBytes("00010000000080500c02602c03203804702701540b806303501c40f0087823c09682780a582b40b482f00c3832c0d283680e183a40f083e0107c21f045d08f8126c25d04d909f0145c29b05550ae8164c2d905d10be0183c317064d0cd81a2c35506c90dd01c1c39307450ec81e0c3d107c10fc0207e20fc217a21f8227622f4237223f0246e24ec256a25e8266626e4276227e0285e28dc295a29d82a562ad42b522bd02c4e2ccc2d4a2dc82e462ec42f422fc0303e30bc313a31b8323632b4333233b0342e34ac352a35a8362636a4372237a0381e389c391a39983a163a943b123b903c0e3c8c3d0a3d883e063e843f023f80407f207f105f483f8427b217d10de487f04477227b115d48be84673237911dc48fe0486f2477125b493d84a6b257512da497d04c672673135949bc84e63277113d849fc0505f286f14574a3b8525b296d14d64a7b054572a6b15554aba856532b6915d44afa0584f2c6716534b3985a4b2d6516d24b7905c472e6317514bb885e432f6117d04bf80603f305f184f4c378623b315d18ce4c7706437325b194d4cb686633335919cc4cf60682f34571a4b4d3586a2b35551aca4d7506c2736531b494db486e2337511bc84df40701f384f1c474e338721b394d1cc64e73074173a4b1d454eb2876133b491dc44ef20780f3c471e434f3187a0b3d451ec24f7107c073e431f414fb087e033f411fc04ff"),
          "All 256 byte values 0x00..0xFF - every symbol arrives through the NYT escape",
          "https://en.wikipedia.org/wiki/Adaptive_Huffman_coding"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new AdaptiveHuffmanInstance(this, isInverse);
    }
  }

  class AdaptiveHuffmanInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      const input = this.inputBuffer;
      this.inputBuffer = [];
      return this.isInverse ? this._decompress(input) : this._compress(input);
    }

    _compress(data) {
      const out = [
        OpCodes.And32(data.length, 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 8), 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 16), 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 24), 0xFF)
      ];

      if (data.length === 0) return out;

      const tree = new FgkTree();
      const writer = new MsbBitWriter();
      for (let i = 0; i < data.length; i++) tree.encodeSymbol(writer, OpCodes.And32(data[i], 0xFF));
      const bits = writer.flush();
      for (let i = 0; i < bits.length; i++) out.push(bits[i]);

      return out;
    }

    _decompress(data) {
      if (data.length < 4) return [];

      const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalSize === 0) return [];

      const reader = new MsbBitReader(data, 4);
      const tree = new FgkTree();
      const result = new Array(originalSize);
      for (let i = 0; i < originalSize; ++i) result[i] = tree.decodeSymbol(reader);

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new AdaptiveHuffmanCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { AdaptiveHuffmanCompression, AdaptiveHuffmanInstance };
}));
