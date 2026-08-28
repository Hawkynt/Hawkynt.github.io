/*
 * Universal Shannon-Fano Coding
 * Compatible with both Browser and Node.js environments
 * Educational implementation of Shannon-Fano algorithm - predecessor to Huffman
 * (c)2006-2025 Hawkynt
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
 * ShannonFanoAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class ShannonFanoAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Shannon-Fano Coding";
        this.description = "Variable-length prefix-free coding algorithm that predates Huffman coding. Divides symbols recursively by frequency to create binary codes, though not always optimal.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Statistical";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.inventor = "Claude Shannon, Robert Fano";
        this.year = 1948;
        this.country = CountryCode.US;

        this.documentation = [
          new LinkItem("A Mathematical Theory of Communication", "https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf"),
          new LinkItem("Shannon-Fano Coding - Wikipedia", "https://en.wikipedia.org/wiki/Shannon%E2%80%93Fano_coding"),
          new LinkItem("Information Theory Primer", "https://web.stanford.edu/class/ee276/"),
          new LinkItem("Data Compression History", "https://www.data-compression.com/theory.shtml")
        ];

        this.references = [
          new LinkItem("MIT Information Theory Course", "https://ocw.mit.edu/courses/electrical-engineering-and-computer-science/"),
          new LinkItem("Shannon-Fano vs Huffman Analysis", "https://www.cs.cmu.edu/~ckingsf/bioinfo-lectures/shannon.pdf"),
          new LinkItem("Rosetta Code Implementation", "https://rosettacode.org/wiki/Shannon-Fano_coding"),
          new LinkItem("Educational Examples", "https://www2.cs.duke.edu/csed/poop/huff/info/")
        ];

        this.knownVulnerabilities = [];

        // Wire format (matches CompressionWorkbench's BB_ShannonFano building
        // block): a 4-byte little-endian original length, a fixed 256-entry
        // frequency table (2-byte little-endian counts), then the coded
        // bitstream. The fixed-size table makes even tiny inputs expand to
        // 512+ header bytes; expected vectors are given as hex for this reason.
        this.tests = [
          new TestCase(
            OpCodes.AnsiToBytes("AAABBC"),
            OpCodes.Hex8ToBytes("0600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000030002000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001580"),
            "Basic frequency encoding",
            "https://en.wikipedia.org/wiki/Shannon%E2%80%93Fano_coding"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("ABCDEF"),
            OpCodes.Hex8ToBytes("06000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100010001000100010001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000013B7"),
            "Alphabet frequency test",
            "https://www2.cs.duke.edu/csed/poop/huff/info/"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("ABABAB"),
            OpCodes.Hex8ToBytes("06000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000300030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000054"),
            "Repeated pattern encoding",
            "https://www.cs.cmu.edu/~ckingsf/bioinfo-lectures/shannon.pdf"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new ShannonFanoInstance(this, isInverse);
      }
    }

    class ShannonFanoInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];
      }


      Result() {
        const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      // Wire format (matches CompressionWorkbench's BB_ShannonFano building
      // block): a 4-byte little-endian original length, then a fixed
      // 256-entry frequency table (2-byte little-endian counts, scaled to
      // fit uint16 only if the true maximum exceeds it), followed by the
      // Shannon-Fano-coded bitstream (MSB-first, zero-padded to a byte
      // boundary). Codes are rebuilt independently on encode and decode
      // from the same frequency table by recursively splitting the
      // freq-sorted symbol list at the point that minimizes the imbalance
      // between the two halves.
      _compress(data) {
        const bitStream = OpCodes.CreateBitStream();
        bitStream.writeUint32LE(data.length);

        const freq = new Array(256).fill(0);
        for (const b of data) freq[b]++;

        let maxFreq = 0;
        for (const f of freq) if (f > maxFreq) maxFreq = f;

        const scaledFreq = new Array(256).fill(0);
        if (maxFreq > 0xFFFF) {
          for (let i = 0; i < 256; i++)
            if (freq[i] > 0) scaledFreq[i] = Math.max(1, Math.floor(freq[i] * 0xFFFF / maxFreq));
        } else {
          for (let i = 0; i < 256; i++) scaledFreq[i] = freq[i];
        }
        for (let i = 0; i < 256; i++) bitStream.writeUint16LE(scaledFreq[i]);

        if (data.length === 0) return bitStream.toArray();

        // Codes are built from the table that was actually written, never from
        // the raw counts. Once the largest count exceeds 0xFFFF the table is
        // rescaled, and the rescaled values are all the decoder will ever see;
        // deriving the encoder's codes from the raw counts gives the two sides
        // different split points, so the stream decodes to garbage of exactly
        // the right length without anything throwing. Below the scaling point
        // the two tables are equal, so short outputs are unchanged.
        const codes = this._buildCodes(scaledFreq);
        for (const b of data) {
          const c = codes[b];
          for (let i = c.length - 1; i >= 0; i--) bitStream.writeBit(OpCodes.And32(OpCodes.Shr32(c.code, i), 1));
        }

        return bitStream.toArray();
      }

      _decompress(data) {
        if (data.length < 4) return [];

        const bitStream = OpCodes.CreateBitStream(data);
        const originalSize = OpCodes.Pack32LE(bitStream.readByte(), bitStream.readByte(), bitStream.readByte(), bitStream.readByte());
        if (originalSize === 0) return [];

        const freq = new Array(256);
        for (let i = 0; i < 256; i++) freq[i] = OpCodes.Pack16LE(bitStream.readByte(), bitStream.readByte());

        const root = this._buildTree(freq);

        const result = [];
        for (let i = 0; i < originalSize; i++) {
          let node = root;
          while (node.left || node.right) {
            const bit = bitStream.readBit();
            node = bit === 0 ? node.left : node.right;
            if (!node) throw new Error('Invalid Shannon-Fano bitstream.');
          }
          result.push(node.symbol);
        }

        return result;
      }

      /**
       * Build a { code, length } table for every symbol with freq > 0, by
       * recursively splitting the freq-sorted symbol list at the index that
       * minimizes |2*runningSum - total|.
       * @private
       */
      _buildCodes(freq) {
        const codes = new Array(256).fill(null);

        const symbols = [];
        for (let i = 0; i < 256; i++) if (freq[i] > 0) symbols.push([i, freq[i]]);

        if (symbols.length === 0) return codes;
        if (symbols.length === 1) { codes[symbols[0][0]] = { code: 0, length: 1 }; return codes; }

        symbols.sort((a, b) => a[1] !== b[1] ? b[1] - a[1] : a[0] - b[0]);
        this._assignCodes(symbols, codes, 0, 0);
        return codes;
      }

      _assignCodes(symbols, codes, currentCode, depth) {
        if (symbols.length === 1) { codes[symbols[0][0]] = { code: currentCode, length: Math.max(1, depth) }; return; }
        if (symbols.length === 0) return;

        const splitIndex = this._splitIndex(symbols);
        const left = symbols.slice(0, splitIndex);
        const right = symbols.slice(splitIndex);

        this._assignCodes(left, codes, OpCodes.Shl32(currentCode, 1), depth + 1);
        this._assignCodes(right, codes, OpCodes.Or32(OpCodes.Shl32(currentCode, 1), 1), depth + 1);
      }

      /**
       * Build the decode tree for the given frequency table, matching the
       * split structure used by _buildCodes/_assignCodes on the encode side.
       * @private
       */
      _buildTree(freq) {
        const symbols = [];
        for (let i = 0; i < 256; i++) if (freq[i] > 0) symbols.push([i, freq[i]]);

        if (symbols.length === 0) return { symbol: 0, left: null, right: null };
        if (symbols.length === 1) {
          const leaf = { symbol: symbols[0][0], left: null, right: null };
          return { symbol: 0, left: leaf, right: leaf };
        }

        symbols.sort((a, b) => a[1] !== b[1] ? b[1] - a[1] : a[0] - b[0]);
        return this._buildSubTree(symbols);
      }

      _buildSubTree(symbols) {
        if (symbols.length === 1) return { symbol: symbols[0][0], left: null, right: null };

        const splitIndex = this._splitIndex(symbols);
        const left = symbols.slice(0, splitIndex);
        const right = symbols.slice(splitIndex);

        return { symbol: 0, left: this._buildSubTree(left), right: this._buildSubTree(right) };
      }

      // Shared split-point search: minimize |2*runningSum - total| over the
      // first count-1 candidate cut points, breaking ties toward the first
      // minimal index (matches the reference's linear scan with strict '<').
      _splitIndex(symbols) {
        let total = 0;
        for (const s of symbols) total += s[1];

        let runningSum = 0, splitIndex = 0, minDiff = Infinity;
        for (let i = 0; i < symbols.length - 1; i++) {
          runningSum += symbols[i][1];
          const diff = Math.abs(2 * runningSum - total);
          if (diff < minDiff) { minDiff = diff; splitIndex = i + 1; }
        }
        return splitIndex;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ShannonFanoAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ShannonFanoAlgorithm, ShannonFanoInstance };
}));