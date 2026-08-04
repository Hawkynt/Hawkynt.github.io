/*
 * FSE (Finite State Entropy) Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Production-quality implementation of Finite State Entropy encoding using tANS
 * (tabled Asymmetric Numeral Systems). This algorithm achieves near-optimal
 * compression like arithmetic coding but with much faster encoding/decoding.
 * Core technology used in Zstandard (zstd) compression.
 *
 * Based on reference implementation: https://github.com/Cyan4973/FiniteStateEntropy
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
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== FSE CONSTANTS =====

  const FSE_TABLE_LOG = 10;
  const FSE_TABLE_SIZE = 1024; // 1 << FSE_TABLE_LOG

  // ===== ALGORITHM IMPLEMENTATION =====

  class FSECompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "FSE";
      this.description = "Finite State Entropy encoding using tANS (tabled Asymmetric Numeral Systems). Achieves near-optimal compression like arithmetic coding but much faster. Core technology used in Zstandard.";
      this.inventor = "Yann Collet";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Entropy Coding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FR;

      // Documentation
      this.documentation = [
        new LinkItem("FSE GitHub Repository", "https://github.com/Cyan4973/FiniteStateEntropy"),
        new LinkItem("Finite State Entropy Paper", "https://arxiv.org/abs/1311.2540"),
        new LinkItem("Zstandard Compression (uses FSE)", "https://github.com/facebook/zstd")
      ];

      this.references = [
        new LinkItem("tANS Theory", "https://arxiv.org/abs/0902.0271"),
        new LinkItem("FSE in Zstd Documentation", "https://github.com/facebook/zstd/blob/dev/doc/zstd_compression_format.md"),
        new LinkItem("Asymmetric Numeral Systems", "https://en.wikipedia.org/wiki/Asymmetric_numeral_systems")
      ];

      // Test vectors - comprehensive round-trip testing
      this.tests = [
        {
          text: "Empty input",
          uri: "https://github.com/Cyan4973/FiniteStateEntropy",
          input: [],
          expected: []
        },
        {
          text: "Single byte",
          uri: "Round-trip test",
          input: [65]
        },
        {
          text: "Repeated bytes - high compressibility",
          uri: "Round-trip test",
          input: [65, 65, 65, 65, 65, 65, 65, 65]
        },
        {
          text: "Two different bytes",
          uri: "Round-trip test",
          input: [65, 66, 65, 66, 65, 66]
        },
        {
          text: "Multiple symbols with varying frequencies",
          uri: "Round-trip test",
          input: [65, 65, 65, 65, 66, 66, 67, 68, 69]
        },
        {
          text: "All different bytes - low compressibility",
          uri: "Round-trip test",
          input: [65, 66, 67, 68, 69, 70, 71, 72]
        },
        {
          text: "Realistic text pattern",
          uri: "Round-trip test",
          input: OpCodes.AnsiToBytes("HELLO WORLD! THIS IS A TEST.")
        },
        // Round-trip regression vectors covering inputs large and varied
        // enough to exercise every branch of the tANS state table (full
        // alphabet, non-uniform frequencies, and a 2-symbol distribution).
        {
          text: "All byte values 0-255 round-trip test",
          uri: "Regression test for tANS table desync",
          input: Array.from({ length: 256 }, (_, i) => i)
        },
        {
          text: "Pseudo-random data round-trip test",
          uri: "Regression test for tANS table desync",
          input: [243, 204, 191, 171, 157, 143, 229, 84, 239, 176, 155, 208, 176, 245, 186, 148, 128, 53, 183, 104, 65, 66, 101, 148, 122, 107, 131, 193, 65, 79, 229, 58, 50, 25, 21, 210, 49, 167, 70, 138, 6, 12, 191, 33, 67, 124, 161, 122, 65, 2, 92, 207, 37, 32, 136, 248, 127, 146, 78, 207, 243, 126, 146, 223, 64, 161, 46, 129, 181, 68, 211, 17, 148, 194, 96, 50, 211, 110, 202, 53, 74, 159, 228, 247, 145, 4, 228, 234, 16, 151, 188, 109, 81, 80, 49, 126, 162, 199, 101, 196, 235, 27, 109, 184, 20, 77, 129, 64, 148, 182, 146, 41, 134, 77, 32, 59, 197, 71, 158, 152, 231, 94, 231, 211, 103, 220, 144, 238, 137, 222, 237, 151, 177, 197, 92, 12, 97, 179, 107, 212, 167, 137, 88, 210, 78, 173, 228, 175, 149, 232, 107, 45, 28, 202, 239, 242, 91, 73, 66, 24, 35, 92, 185, 245, 62, 213, 13, 182, 15, 242, 254, 12, 86, 213, 178, 168, 213, 115, 176, 57, 95, 201, 101, 121, 187, 228, 195, 32, 44, 252, 179, 230, 150, 179, 164, 143, 191, 97, 136, 46, 25, 154, 214, 6, 155, 31, 129, 253, 3, 119, 59, 68, 187, 102, 43, 112, 143, 202, 179, 185, 32, 38, 37, 249, 29, 52, 47, 246, 60, 190, 166, 152, 5, 144, 25, 213, 107, 191, 85, 158, 64, 228, 200, 90, 18, 120, 76, 172, 148, 46, 222, 67, 185, 14, 135, 164, 72, 186, 30, 245, 198, 193, 63, 169, 164, 83, 85, 104, 24, 107, 159, 230, 18, 235, 247, 15, 205, 167, 128, 28, 145, 40, 49, 185, 0, 198, 197, 208, 211, 50, 157, 56, 249, 159, 97, 19, 92, 178, 139, 196]
        },
        {
          text: "Alternating pattern round-trip test",
          uri: "Regression test for tANS table desync",
          input: Array.from({ length: 128 }, (_, i) => i % 2 ? 0x55 : 0xAA)
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new FSEInstance(this, isInverse);
    }
  }

  // ===== FSE IMPLEMENTATION =====

  /**
 * FSE cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class FSEInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.isInverse) {
        // A compressed stream always carries at least the 4-byte length
        // header, so an empty buffer here is not a valid compressed
        // empty message.
        if (this.inputBuffer.length === 0) return [];
        return this._decompress();
      }

      // Compressing empty input still emits the 4-byte length header
      // (matches CompressionWorkbench, which never skips the container).
      return this._compress();
    }

    // ===== COMPRESSION =====

    _compress() {
      const data = this.inputBuffer;
      this.inputBuffer = [];

      // Header: 4-byte LE original length.
      const output = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));

      if (data.length === 0) return output;

      // Count raw byte frequencies and collect the used symbols in
      // ascending byte-value order.
      const rawFreq = new Array(256).fill(0);
      for (let i = 0; i < data.length; i++) rawFreq[data[i]]++;

      const symbols = [];
      for (let i = 0; i < 256; i++) {
        if (rawFreq[i] > 0) symbols.push(i);
      }

      // Single-symbol special case: tableLog=0 sentinel, no table, no bitstream.
      if (symbols.length === 1) {
        output.push(0);
        output.push(symbols[0]);
        return output;
      }

      const tableSize = FSE_TABLE_SIZE;
      const normFreq = normalizeFrequencies(rawFreq, symbols, tableSize, data.length);
      const symbolTable = buildSpreadTable(normFreq, symbols, tableSize);

      // Build per-symbol occurrence mapping.
      const symOccurrence = new Array(256).fill(0);
      const positionToReduced = new Array(tableSize);
      for (let s = 0; s < tableSize; s++) {
        const sym = symbolTable[s];
        const k = symOccurrence[sym]++;
        positionToReduced[s] = normFreq[sym] + k;
      }

      // Build encoding table.
      const encTable = new Array(256);
      for (let i = 0; i < 256; i++) {
        if (normFreq[i] > 0) encTable[i] = new Array(normFreq[i]);
      }
      for (let s = 0; s < tableSize; s++) {
        const sym = symbolTable[s];
        const r = positionToReduced[s];
        encTable[sym][r - normFreq[sym]] = s;
      }

      // Encode symbols in reverse (tANS/ANS is LIFO).
      const bitStack = [];
      let state = tableSize;

      for (let i = data.length - 1; i >= 0; i--) {
        const sym = data[i];
        const f = normFreq[sym];

        // Reduce state to [f, 2*f-1] by emitting low bits.
        while (state >= 2 * f) {
          bitStack.push(OpCodes.AndN(state, 1));
          state = Math.floor(state / 2);
        }

        const spreadPos = encTable[sym][state - f];
        state = spreadPos + tableSize;
      }

      // Header: tableLog, symbolCount16LE, (symbol, freq16LE)*.
      output.push(FSE_TABLE_LOG);

      const countBytes = OpCodes.Unpack16LE(symbols.length);
      output.push(countBytes[0], countBytes[1]);

      for (const sym of symbols) {
        output.push(sym);
        const freqBytes = OpCodes.Unpack16LE(normFreq[sym]);
        output.push(freqBytes[0], freqBytes[1]);
      }

      // Final state, then bit count, then the packed bitstream.
      const stateBytes = OpCodes.Unpack16LE(state);
      output.push(stateBytes[0], stateBytes[1]);

      const bitCountBytes = OpCodes.Unpack32LE(OpCodes.ToUint32(bitStack.length));
      output.push(bitCountBytes[0], bitCountBytes[1], bitCountBytes[2], bitCountBytes[3]);

      const byteCount = Math.floor((bitStack.length + 7) / 8);
      const packed = new Array(byteCount).fill(0);
      for (let i = 0; i < bitStack.length; i++) {
        if (bitStack[i] !== 0) {
          const byteIndex = Math.floor(i / 8);
          packed[byteIndex] = OpCodes.SetBit(packed[byteIndex], i % 8, true);
        }
      }
      for (let i = 0; i < packed.length; i++) output.push(packed[i]);

      return output;
    }

    // ===== DECOMPRESSION =====

    _decompress() {
      const data = this.inputBuffer;
      this.inputBuffer = [];

      let offset = 0;
      const uncompressedSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      offset += 4;

      if (uncompressedSize === 0) return [];

      const tableLogByte = data[offset++];

      // Single-symbol special case.
      if (tableLogByte === 0) {
        const sym = data[offset];
        return new Array(uncompressedSize).fill(sym);
      }

      const tableSize = OpCodes.Shl32(1, tableLogByte);

      const symbolCount = OpCodes.Pack16LE(data[offset], data[offset + 1]);
      offset += 2;

      const normFreq = new Array(256).fill(0);
      const symbols = [];
      for (let i = 0; i < symbolCount; i++) {
        const sym = data[offset++];
        symbols.push(sym);
        normFreq[sym] = OpCodes.Pack16LE(data[offset], data[offset + 1]);
        offset += 2;
      }

      // Final state.
      let state = OpCodes.Pack16LE(data[offset], data[offset + 1]);
      offset += 2;

      const bitCount = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
      offset += 4;

      const byteCount = Math.floor((bitCount + 7) / 8);
      const packed = data.slice(offset, offset + byteCount);

      // Unpack bits.
      const bitStack = new Array(bitCount);
      for (let i = 0; i < bitCount; i++) {
        bitStack[i] = OpCodes.GetBit(packed[Math.floor(i / 8)], i % 8) ? 1 : 0;
      }

      // Rebuild spread table and occurrence mapping.
      const symbolTable = buildSpreadTable(normFreq, symbols, tableSize);

      const symOccurrence = new Array(256).fill(0);
      const positionToReduced = new Array(tableSize);
      for (let s = 0; s < tableSize; s++) {
        const sym = symbolTable[s];
        const k = symOccurrence[sym]++;
        positionToReduced[s] = normFreq[sym] + k;
      }

      // Decode.
      const decoded = new Array(uncompressedSize);
      let bitPos = bitStack.length - 1;

      for (let i = 0; i < uncompressedSize; i++) {
        const spreadPos = state - tableSize;
        const sym = symbolTable[spreadPos];
        decoded[i] = sym;

        const reduced = positionToReduced[spreadPos];
        state = reduced;

        while (state < tableSize) {
          state = state * 2 + bitStack[bitPos--];
        }
      }

      return decoded;
    }
  }

  // ===== FSE/tANS TABLE CONSTRUCTION =====

  // Greedy largest-error/smallest-error rounding: scale every used symbol's
  // raw frequency proportionally to tableSize (minimum 1), then repeatedly
  // bump the symbol with the largest positive rounding error (if under
  // tableSize) or shrink the symbol with the smallest error that still has
  // more than 1 slot (if over), until the normalized frequencies sum to
  // exactly tableSize. Ties resolve to the first symbol reached while
  // iterating `symbols` in ascending byte-value order.
  function normalizeFrequencies(rawFreq, symbols, tableSize, totalCount) {
    const normFreq = new Array(256).fill(0);
    let assigned = 0;

    for (const sym of symbols) {
      let nf = Math.floor(rawFreq[sym] * tableSize / totalCount);
      if (nf < 1) nf = 1;
      normFreq[sym] = nf;
      assigned += nf;
    }

    while (assigned !== tableSize) {
      if (assigned < tableSize) {
        let bestSym = symbols[0];
        let bestError = -Infinity;
        for (const sym of symbols) {
          const ideal = rawFreq[sym] * tableSize / totalCount;
          const error = ideal - normFreq[sym];
          if (error > bestError) {
            bestError = error;
            bestSym = sym;
          }
        }
        normFreq[bestSym]++;
        assigned++;
      } else {
        let bestSym = symbols[0];
        let bestError = Infinity;
        for (const sym of symbols) {
          if (normFreq[sym] <= 1) continue;
          const ideal = rawFreq[sym] * tableSize / totalCount;
          const error = ideal - normFreq[sym];
          if (error < bestError) {
            bestError = error;
            bestSym = sym;
          }
        }
        if (normFreq[bestSym] > 1) {
          normFreq[bestSym]--;
          assigned--;
        } else {
          break;
        }
      }
    }

    return normFreq;
  }

  // Spreads each symbol across the tableSize-entry state table using the
  // classic FSE/tANS pseudo-random walk: step = tableSize*5/8 + 3, applied
  // modulo tableSize, visiting every slot exactly once overall.
  function buildSpreadTable(normFreq, symbols, tableSize) {
    const table = new Array(tableSize);
    const step = OpCodes.Shr32(tableSize, 1) + OpCodes.Shr32(tableSize, 3) + 3;
    const mask = tableSize - 1;
    let pos = 0;

    for (const sym of symbols) {
      for (let i = 0; i < normFreq[sym]; i++) {
        table[pos] = sym;
        pos = OpCodes.AndN(pos + step, mask);
      }
    }

    return table;
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new FSECompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FSECompression, FSEInstance };
}));
