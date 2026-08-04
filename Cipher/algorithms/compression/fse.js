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

  const FSE_MIN_TABLELOG = 5;
  const FSE_MAX_TABLELOG = 12;  // Educational implementation uses smaller tables
  const FSE_DEFAULT_TABLELOG = 11;
  const FSE_MAX_SYMBOL_VALUE = 255;

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
        // Round-trip regression vectors: the previous implementation
        // stored the input reversed after a frequency-table header and
        // never un-reversed it on decode (and never actually used the
        // tANS tables it built), so anything but the RLE special case
        // decoded to the wrong bytes.
        {
          text: "All byte values 0-255 round-trip test",
          uri: "Regression test for rANS table desync",
          input: Array.from({ length: 256 }, (_, i) => i)
        },
        {
          text: "Pseudo-random data round-trip test",
          uri: "Regression test for rANS table desync",
          input: [243, 204, 191, 171, 157, 143, 229, 84, 239, 176, 155, 208, 176, 245, 186, 148, 128, 53, 183, 104, 65, 66, 101, 148, 122, 107, 131, 193, 65, 79, 229, 58, 50, 25, 21, 210, 49, 167, 70, 138, 6, 12, 191, 33, 67, 124, 161, 122, 65, 2, 92, 207, 37, 32, 136, 248, 127, 146, 78, 207, 243, 126, 146, 223, 64, 161, 46, 129, 181, 68, 211, 17, 148, 194, 96, 50, 211, 110, 202, 53, 74, 159, 228, 247, 145, 4, 228, 234, 16, 151, 188, 109, 81, 80, 49, 126, 162, 199, 101, 196, 235, 27, 109, 184, 20, 77, 129, 64, 148, 182, 146, 41, 134, 77, 32, 59, 197, 71, 158, 152, 231, 94, 231, 211, 103, 220, 144, 238, 137, 222, 237, 151, 177, 197, 92, 12, 97, 179, 107, 212, 167, 137, 88, 210, 78, 173, 228, 175, 149, 232, 107, 45, 28, 202, 239, 242, 91, 73, 66, 24, 35, 92, 185, 245, 62, 213, 13, 182, 15, 242, 254, 12, 86, 213, 178, 168, 213, 115, 176, 57, 95, 201, 101, 121, 187, 228, 195, 32, 44, 252, 179, 230, 150, 179, 164, 143, 191, 97, 136, 46, 25, 154, 214, 6, 155, 31, 129, 253, 3, 119, 59, 68, 187, 102, 43, 112, 143, 202, 179, 185, 32, 38, 37, 249, 29, 52, 47, 246, 60, 190, 166, 152, 5, 144, 25, 213, 107, 191, 85, 158, 64, 228, 200, 90, 18, 120, 76, 172, 148, 46, 222, 67, 185, 14, 135, 164, 72, 186, 30, 245, 198, 193, 63, 169, 164, 83, 85, 104, 24, 107, 159, 230, 18, 235, 247, 15, 205, 167, 128, 28, 145, 40, 49, 185, 0, 198, 197, 208, 211, 50, 157, 56, 249, 159, 97, 19, 92, 178, 139, 196]
        },
        {
          text: "Alternating pattern round-trip test",
          uri: "Regression test for rANS table desync",
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
      if (this.inputBuffer.length === 0) return [];

      const result = this.isInverse ?
        this._decompress(this.inputBuffer) :
        this._compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    // ===== COMPRESSION =====

    _compress(data) {
      if (data.length === 0) return [];

      // Special case: single repeated symbol
      const uniqueSymbols = new Set(data);
      if (uniqueSymbols.size === 1) {
        return this._compressRLE(data);
      }

      // Build frequency table
      const frequencies = this._countFrequencies(data);

      // Determine optimal table log
      const tableLog = this._optimalTableLog(data.length, Object.keys(frequencies).length);
      const tableSize = OpCodes.Shl32(1, tableLog);

      // Normalize frequencies
      const normalizedCounter = this._normalizeFrequencies(frequencies, tableLog, tableSize);

      // Cumulative-frequency table needed by the rANS encoder
      const { cumStart } = this._buildRansTable(normalizedCounter, tableSize);

      // Header: [tableLog, symbolCount, (symbol, freq16LE)*, dataLength32LE]
      const output = [];
      output.push(tableLog);

      const symbols = [];
      for (let i = 0; i <= FSE_MAX_SYMBOL_VALUE; ++i) {
        if (normalizedCounter[i] > 0) symbols.push(i);
      }
      output.push(symbols.length);

      for (const symbol of symbols) {
        output.push(symbol);
        const freqBytes = this._packShort(normalizedCounter[symbol]);
        for (let _i = 0; _i < freqBytes.length; _i++) output.push(freqBytes[_i]);
      }

      const lengthBytes = this._packLength(data.length);
      for (let _i = 0; _i < lengthBytes.length; _i++) output.push(lengthBytes[_i]);

      // rANS-encoded payload
      const encoded = this._encode(data, normalizedCounter, tableLog, cumStart);
      for (let _i = 0; _i < encoded.length; _i++) output.push(encoded[_i]);

      return output;
    }

    _compressRLE(data) {
      // RLE format: [0xFF, symbol, length_bytes...]
      const symbol = data[0];
      const lengthBytes = this._packLength(data.length);
      return [0xFF, symbol, ...lengthBytes];
    }

    _countFrequencies(data) {
      const freq = {};
      for (const byte of data) {
        freq[byte] = (freq[byte] || 0) + 1;
      }
      return freq;
    }

    _optimalTableLog(srcSize, maxSymbolValue) {
      // Determine optimal table log based on source size and symbol count
      let tableLog = FSE_DEFAULT_TABLELOG;

      if (srcSize < 256) tableLog = Math.max(FSE_MIN_TABLELOG, 8);
      else if (srcSize < 2048) tableLog = 10;
      else tableLog = FSE_DEFAULT_TABLELOG;

      // Adjust for symbol count
      if (maxSymbolValue < 16) tableLog = Math.min(tableLog, 9);

      return Math.min(tableLog, FSE_MAX_TABLELOG);
    }

    _normalizeFrequencies(frequencies, tableLog, tableSize) {
      const symbols = Object.keys(frequencies).map(Number);
      const normalized = new Array(FSE_MAX_SYMBOL_VALUE + 1).fill(0);

      // Calculate total frequency
      let total = 0;
      for (const symbol of symbols) {
        total += frequencies[symbol];
      }

      // Normalize to table size
      let distributed = 0;
      let maxFreq = 0;
      let maxSymbol = 0;

      for (const symbol of symbols) {
        const freq = frequencies[symbol];
        // Use OpCodes for proper 32-bit operations
        const scaled = OpCodes.Mul32(freq, tableSize);
        const norm = Math.max(1, Math.floor(scaled / total));
        normalized[symbol] = norm;
        distributed = OpCodes.Add32(distributed, norm);

        if (norm > maxFreq) {
          maxFreq = norm;
          maxSymbol = symbol;
        }
      }

      // Adjust to exactly match table size
      if (distributed < tableSize) {
        // Add remainder to most frequent symbol using OpCodes
        const remainder = OpCodes.Sub32(tableSize, distributed);
        normalized[maxSymbol] = OpCodes.Add32(normalized[maxSymbol], remainder);
      } else if (distributed > tableSize) {
        // Subtract excess from most frequent symbol using OpCodes
        const excess = OpCodes.Sub32(distributed, tableSize);
        normalized[maxSymbol] = OpCodes.Sub32(normalized[maxSymbol], excess);
      }

      return normalized;
    }

    // Build the cumulative-frequency table shared by the rANS encoder and
    // decoder: cumStart[symbol] is the first table slot owned by `symbol`,
    // and slotToSymbol maps every slot in [0, tableSize) back to its owner.
    // Both sides derive this purely from normalizedCounter, so as long as
    // they agree on normalizedCounter they agree on this table too.
    _buildRansTable(normalizedCounter, tableSize) {
      const cumStart = new Array(FSE_MAX_SYMBOL_VALUE + 2).fill(0);
      for (let symbol = 0; symbol <= FSE_MAX_SYMBOL_VALUE; ++symbol) {
        cumStart[symbol + 1] = OpCodes.Add32(cumStart[symbol], normalizedCounter[symbol]);
      }

      const slotToSymbol = new Array(tableSize);
      for (let symbol = 0; symbol <= FSE_MAX_SYMBOL_VALUE; ++symbol) {
        const freq = normalizedCounter[symbol];
        const base = cumStart[symbol];
        for (let k = 0; k < freq; ++k) {
          slotToSymbol[base + k] = symbol;
        }
      }

      return { cumStart, slotToSymbol };
    }

    // Byte-oriented rANS (range Asymmetric Numeral System) encode: a real
    // entropy coder driven by normalizedCounter, replacing the previous
    // stub that just stored the input bytes reversed (and which the
    // decoder never un-reversed, so it never round-tripped). Symbols are
    // processed back-to-front, which is required by rANS so that the
    // decoder -- reading forward -- reproduces the original front-to-back
    // symbol order.
    _encode(data, normalizedCounter, tableLog, cumStart) {
      const RANS_L = OpCodes.Shl32(1, 23);

      let x = RANS_L;
      const chronological = [];

      for (let i = data.length - 1; i >= 0; --i) {
        const symbol = data[i];
        const freq = normalizedCounter[symbol];
        const start = cumStart[symbol];

        const xMax = OpCodes.Mul32(OpCodes.Shl32(OpCodes.Shr32(RANS_L, tableLog), 8), freq);
        while (x >= xMax) {
          chronological.push(OpCodes.And32(x, 0xFF));
          x = OpCodes.Shr32(x, 8);
        }

        x = OpCodes.Add32(OpCodes.Add32(OpCodes.Shl32(Math.floor(x / freq), tableLog), x % freq), start);
      }

      // Flush the final 32-bit state, most-significant byte first, so
      // that after the reversal below it reads out little-endian.
      for (let k = 3; k >= 0; --k) {
        chronological.push(OpCodes.And32(OpCodes.Shr32(x, 8 * k), 0xFF));
      }

      // Every byte was appended in the exact chronological order rANS
      // requires to be *written backwards*; reversing the whole sequence
      // once yields the stream the decoder reads forward.
      chronological.reverse();
      return chronological;
    }

    _decodeRans(stream, normalizedCounter, tableLog, cumStart, slotToSymbol, count) {
      const tableSize = OpCodes.Shl32(1, tableLog);
      const mask = OpCodes.Sub32(tableSize, 1);
      const RANS_L = OpCodes.Shl32(1, 23);

      let bi = 0;
      const nextByte = () => (bi < stream.length ? stream[bi++] : 0);

      let x = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
        nextByte(),
        OpCodes.Shl32(nextByte(), 8)),
        OpCodes.Shl32(nextByte(), 16)),
        OpCodes.Shl32(nextByte(), 24));

      const output = new Array(count);
      for (let j = 0; j < count; ++j) {
        const slot = OpCodes.And32(x, mask);
        const symbol = slotToSymbol[slot];
        const freq = normalizedCounter[symbol];
        const start = cumStart[symbol];

        x = OpCodes.Sub32(OpCodes.Add32(OpCodes.Mul32(freq, OpCodes.Shr32(x, tableLog)), slot), start);

        while (x < RANS_L) {
          x = OpCodes.Or32(OpCodes.Shl32(x, 8), nextByte());
        }

        output[j] = symbol;
      }

      return output;
    }

    // ===== DECOMPRESSION =====

    _decompress(data) {
      if (data.length === 0) return [];

      // Check for RLE format
      if (data[0] === 0xFF && data.length >= 3) {
        return this._decompressRLE(data);
      }

      if (data.length < 3) return [];

      let offset = 0;

      // Read header
      const tableLog = data[offset++];
      if (tableLog < FSE_MIN_TABLELOG || tableLog > FSE_MAX_TABLELOG) {
        return [];
      }

      const symbolCount = data[offset++];
      if (symbolCount === 0 || offset + symbolCount * 3 > data.length) {
        return [];
      }

      // Read normalized counter
      const normalizedCounter = new Array(FSE_MAX_SYMBOL_VALUE + 1).fill(0);
      for (let i = 0; i < symbolCount; ++i) {
        if (offset + 2 > data.length) return [];
        const symbol = data[offset++];
        const freq = this._unpackShort(data[offset], data[offset + 1]);
        offset += 2;
        normalizedCounter[symbol] = freq;
      }

      // Read data length
      if (offset + 4 > data.length) return [];
      const dataLength = this._unpackLength(data.slice(offset, offset + 4));
      offset += 4;

      if (dataLength === 0) return [];

      // Read rANS-encoded payload and decode it with the same cumulative
      // table the encoder derived from the identical normalizedCounter.
      const tableSize = OpCodes.Shl32(1, tableLog);
      const { cumStart, slotToSymbol } = this._buildRansTable(normalizedCounter, tableSize);
      const encodedData = data.slice(offset);

      return this._decodeRans(encodedData, normalizedCounter, tableLog, cumStart, slotToSymbol, dataLength);
    }

    _decompressRLE(data) {
      if (data.length < 6) return [];
      const symbol = data[1];
      const length = this._unpackLength(data.slice(2, 6));
      return new Array(length).fill(symbol);
    }

    // ===== UTILITY FUNCTIONS =====

    _packLength(length) {
      // Pack 32-bit length using OpCodes
      return OpCodes.Unpack32LE(length);
    }

    _unpackLength(bytes) {
      // Unpack 32-bit length using OpCodes
      if (bytes.length < 4) return 0;
      return OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
    }

    _packShort(value) {
      // Pack 16-bit value using OpCodes for shifts/masking
      return [OpCodes.And32(value, 0xFF), OpCodes.And32(OpCodes.Shr32(value, 8), 0xFF)];
    }

    _unpackShort(b0, b1) {
      // Unpack 16-bit value using OpCodes for shifts/masking
      return OpCodes.Or32(OpCodes.And32(b0, 0xFF), OpCodes.Shl32(OpCodes.And32(b1, 0xFF), 8));
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new FSECompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FSECompression, FSEInstance };
}));
