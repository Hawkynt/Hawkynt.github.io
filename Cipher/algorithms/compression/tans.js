/*
 * tANS (Table-based Asymmetric Numeral Systems)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Table variant of ANS built the way Duda describes it, which is not the way
 * the FSE flavour in fse.js builds it. The two differ on the two degrees of
 * freedom a tANS coder actually has:
 *
 *   1. Symbol spread. fse.js scatters symbols with the FSE pseudo-random walk
 *      (the position advances by tableSize*5/8 + 3 modulo tableSize). This file
 *      uses Duda's precise initialization instead: every slot a symbol owns is
 *      given the key (2k+1)/(2f), all keys are sorted, and slot i goes to the
 *      owner of the i-th smallest key. That places each symbol's slots as close
 *      to uniformly as an integer table allows, so the realized state
 *      distribution tracks the ideal one more tightly than the walk does.
 *
 *   2. Renormalization. fse.js reduces the state with a comparison loop that
 *      peels one bit at a time. This file precomputes, per symbol, the pair
 *      (maxBits, minStatePlus) and emits the whole bit group in one step:
 *      nbBits is maxBits-1 when the state is below minStatePlus and maxBits
 *      otherwise, with maxBits = tableLog - floor(log2(f)). The decode side
 *      precomputes the matching per-slot (symbol, nbBits, baseState) triple.
 *
 * The table holds 2^11 states (fse.js uses 2^10), the state lives in
 * [tableSize, 2*tableSize), the message is coded back to front as ANS requires,
 * and bits are packed most-significant-bit first within each byte. Frequencies
 * are normalized by largest-remainder apportionment and transmitted in the
 * header, so the model is order-0 and static per message.
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

  // ===== tANS CONSTANTS =====

  /** @type {int32} */
  const TABLE_LOG = 11;
  /** @type {int32} */
  const TABLE_SIZE = 2048;   // 2^TABLE_LOG
  /** @type {int32} */
  const MAX_BITS_PER_SYMBOL = TABLE_LOG;

  /**
   * @returns {int32[]} Powers of two 2^0 .. 2^(TABLE_LOG + 1)
   */
  function buildPowersOfTwo() {
    /** @type {int32[]} */
    const powers = new Array(TABLE_LOG + 2);
    powers[0] = 1;
    for (let i = 1; i < powers.length; i++) {
      powers[i] = powers[i - 1] * 2;
    }
    return powers;
  }

  // Powers of two up to 2^12, so splitting the state never needs a shift.
  /** @type {int32[]} */
  const POW2 = buildPowersOfTwo();

  /**
   * @param {int32} value - Positive value
   * @returns {int32} Index of the highest set bit
   */
  function highBit(value) {
    /** @type {int32} */
    let bit = 0;
    /** @type {int32} */
    let remaining = value;
    while (remaining > 1) {
      remaining = Math.floor(remaining / 2);
      bit++;
    }
    return bit;
  }

  // ===== TABLE CONSTRUCTION =====

  // Largest-remainder apportionment of the raw counts onto tableSize slots.
  // Every symbol that occurs keeps at least one slot; the slots left over after
  // flooring go to the symbols with the largest fractional parts, ties broken
  // by ascending byte value so encoder and decoder always agree.
  /**
   * @param {int32[]} rawFreq - Raw count per byte value
   * @param {int32[]} symbols - Used symbols in ascending order
   * @param {int32} totalCount - Sum of the raw counts
   * @param {int32} tableSize - Number of table slots
   * @returns {int32[]} Normalized frequency per byte value
   */
  function normalizeFrequencies(rawFreq, symbols, totalCount, tableSize) {
    /** @type {int32[]} */
    const norm = new Array(256);
    /** @type {float64[]} */
    const remainder = new Array(256);
    for (let i = 0; i < 256; i++) {
      norm[i] = 0;
      remainder[i] = 0;
    }
    /** @type {int32} */
    let assigned = 0;

    for (let n = 0; n < symbols.length; n++) {
      /** @type {int32} */
      const symbol = symbols[n];
      /** @type {float64} */
      const ideal = rawFreq[symbol] * tableSize / totalCount;
      /** @type {int32} */
      let nf = Math.floor(ideal);
      if (nf < 1) {
        nf = 1;
      }
      norm[symbol] = nf;
      remainder[symbol] = ideal - nf;
      assigned += nf;
    }

    // Ranking: larger fractional part first, equal parts by ascending symbol
    // (a total order, sorted here by insertion).
    /** @type {int32[]} */
    const ranked = [];
    for (let n = 0; n < symbols.length; n++) {
      /** @type {int32} */
      const symbol = symbols[n];
      /** @type {int32} */
      let at = ranked.length;
      ranked.push(symbol);
      while (at > 0) {
        /** @type {int32} */
        const before = ranked[at - 1];
        /** @type {boolean} */
        const higher = remainder[symbol] > remainder[before] ||
          (remainder[symbol] === remainder[before] && symbol < before);
        if (!higher) {
          break;
        }
        ranked[at] = before;
        at--;
      }
      ranked[at] = symbol;
    }

    /** @type {int32} */
    let give = 0;
    while (assigned < tableSize) {
      norm[ranked[give % ranked.length]]++;
      assigned++;
      give++;
    }

    /** @type {int32} */
    let take = ranked.length - 1;
    while (assigned > tableSize) {
      /** @type {int32} */
      const symbol = ranked[take];
      if (norm[symbol] > 1) {
        norm[symbol]--;
        assigned--;
      }
      take = take === 0 ? ranked.length - 1 : take - 1;
    }

    return norm;
  }

  // Duda's precise initialization. A symbol owning f slots claims the keys
  // (2k+1)/(2f) for k = 0..f-1; sorting all tableSize keys and reading them off
  // in order spreads every symbol as evenly as the integer table permits.
  // The claims are ordered by key, equal keys by ascending symbol, with a
  // stable merge sort (entries equal in both keep their claiming order).
  /**
   * @param {int32[]} norm - Normalized frequency per symbol
   * @param {int32[]} symbols - Symbols in table order
   * @param {int32} tableSize - Number of table slots
   * @returns {int32[]} Symbol per slot
   */
  function buildSpreadTable(norm, symbols, tableSize) {
    /** @type {float64[]} */
    let claimKey = [];
    /** @type {int32[]} */
    let claimSymbol = [];

    for (let n = 0; n < symbols.length; n++) {
      /** @type {int32} */
      const symbol = symbols[n];
      /** @type {int32} */
      const f = norm[symbol];
      for (let k = 0; k < f; k++) {
        claimKey.push((2 * k + 1) / (2 * f));
        claimSymbol.push(symbol);
      }
    }

    /** @type {int32} */
    const count = claimKey.length;
    /** @type {float64[]} */
    let otherKey = new Array(count);
    /** @type {int32[]} */
    let otherSymbol = new Array(count);
    for (let width = 1; width < count; width *= 2) {
      for (let lo = 0; lo < count; lo += 2 * width) {
        /** @type {int32} */
        const mid = Math.min(lo + width, count);
        /** @type {int32} */
        const hi = Math.min(lo + 2 * width, count);
        /** @type {int32} */
        let a = lo;
        /** @type {int32} */
        let b = mid;
        for (let k = lo; k < hi; k++) {
          /** @type {boolean} */
          let takeA = a < mid;
          if (takeA && b < hi) {
            // b goes first only when it is strictly smaller
            /** @type {boolean} */
            const bFirst = claimKey[b] < claimKey[a] ||
              (claimKey[b] === claimKey[a] && claimSymbol[b] < claimSymbol[a]);
            takeA = !bFirst;
          }
          if (takeA) {
            otherKey[k] = claimKey[a];
            otherSymbol[k] = claimSymbol[a];
            a++;
          } else {
            otherKey[k] = claimKey[b];
            otherSymbol[k] = claimSymbol[b];
            b++;
          }
        }
      }
      /** @type {float64[]} */
      const swapKey = claimKey;
      claimKey = otherKey;
      otherKey = swapKey;
      /** @type {int32[]} */
      const swapSymbol = claimSymbol;
      claimSymbol = otherSymbol;
      otherSymbol = swapSymbol;
    }

    // A frequency table claiming fewer slots than the table holds leaves the
    // table short; reading the first missing claim fails exactly as reading a
    // missing claim record always did.
    if (count < tableSize) {
      throw new TypeError("Cannot read properties of undefined (reading 'symbol')");
    }

    /** @type {int32[]} */
    const table = new Array(tableSize);
    for (let i = 0; i < tableSize; i++) {
      table[i] = claimSymbol[i];
    }
    return table;
  }

  // Per-symbol renormalization constants. Encoding symbol s from state x emits
  // maxBits-1 bits when x is below minStatePlus and maxBits bits otherwise,
  // which is exactly what drives floor(x / 2^nbBits) into the range [f, 2f).
  /**
   * @param {int32[]} norm - Normalized frequency per symbol
   * @param {int32[]} symbols - Used symbols
   * @param {int32} tableLog - log2 of the table size
   * @param {int32[]} maxBits - Receives the larger bit count per symbol
   * @param {int32[]} minStatePlus - Receives the state threshold per symbol
   */
  function buildSymbolTransforms(norm, symbols, tableLog, maxBits, minStatePlus) {
    for (let i = 0; i < 256; i++) {
      maxBits[i] = 0;
      minStatePlus[i] = 0;
    }

    for (let n = 0; n < symbols.length; n++) {
      /** @type {int32} */
      const symbol = symbols[n];
      /** @type {int32} */
      const f = norm[symbol];
      /** @type {int32} */
      const bits = tableLog - highBit(f);
      maxBits[symbol] = bits;
      minStatePlus[symbol] = f * POW2[bits];
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * TANSAlgorithm - table-driven ANS entropy coder
   * @class
   * @extends {CompressionAlgorithm}
   */
  class TANSAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "tANS (Table-based Asymmetric Numeral Systems)";
      this.description = "Table-driven ANS entropy coder over a 2048-state table. Symbols are spread with Duda's precise initialization (slots ranked by the keys (2k+1)/(2f)) rather than the FSE pseudo-random walk this collection's FSE implementation uses, and renormalization emits a whole precomputed bit group per symbol instead of peeling single bits. Order-0 model: the normalized frequency table is transmitted in the header.";
      this.inventor = "Jarek Duda";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Entropy Coding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.PL;

      this.documentation = [
        new LinkItem("Asymmetric Numeral Systems (original paper)", "https://arxiv.org/abs/0902.0271"),
        new LinkItem("ANS with applications to data compression", "https://arxiv.org/abs/1311.2540"),
        new LinkItem("ANS on Wikipedia (tANS section)", "https://en.wikipedia.org/wiki/Asymmetric_numeral_systems")
      ];

      this.references = [
        new LinkItem("Jarek Duda homepage", "http://th.if.uj.edu.pl/~dudaj/"),
        new LinkItem("Finite State Entropy (the FSE spread, for comparison)", "https://github.com/Cyan4973/FiniteStateEntropy"),
        new LinkItem("ANS discussion thread", "https://encode.su/threads/2078-Asymmetric-Numeral-Systems")
      ];

      // Wire format:
      //   [uint32 LE original length]
      //   [uint8 tableLog][uint16 LE symbol count]
      //   ([uint8 symbol][uint16 LE normalized frequency]) * count
      //   [uint16 LE final state - tableSize][uint32 LE bit count][packed bits]
      //
      // The vectors below are derived by hand. A single distinct symbol takes
      // the whole table (f = 2048), so its renormalization emits zero bits and
      // the state never moves. Two symbols of equal count split the table
      // 1024/1024; precise initialization then interleaves them strictly (even
      // slots to the lower byte value, odd slots to the higher), each symbol
      // costs exactly one bit, and the two orderings differ only in the final
      // state and in that one bit.
      this.tests = [
        new TestCase(
          [],
          [0, 0, 0, 0],
          "Empty input - length header only",
          "https://arxiv.org/abs/0902.0271"
        ),
        new TestCase(
          [65, 65, 65, 65],
          [4, 0, 0, 0, 11, 1, 0, 65, 0, 8, 0, 0, 0, 0, 0, 0],
          "Single distinct symbol - whole table, zero bits emitted",
          "https://arxiv.org/abs/1311.2540"
        ),
        new TestCase(
          [65, 66],
          [2, 0, 0, 0, 11, 2, 0, 65, 0, 4, 66, 0, 4, 0, 0, 2, 0, 0, 0, 64],
          "Two symbols, equal counts - interleaved spread",
          "https://en.wikipedia.org/wiki/Asymmetric_numeral_systems"
        ),
        new TestCase(
          [66, 65],
          [2, 0, 0, 0, 11, 2, 0, 65, 0, 4, 66, 0, 4, 1, 0, 2, 0, 0, 0, 0],
          "Two symbols, reversed order - pins the final state field",
          "http://th.if.uj.edu.pl/~dudaj/"
        ),
        // Round-trip only from here on: these cover uneven frequencies, the
        // full alphabet and long runs, which nobody can check by hand.
        new TestCase(OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. "), [], "Natural text round-trip", "Regression test for table desync"),
        new TestCase(Array.from({ length: 256 }, (_, i) => i), [], "All 256 byte values round-trip", "Regression test for table desync"),
        new TestCase(new Array(512).fill(0x5a), [], "Long run round-trip", "Regression test for zero-bit renormalization"),
        new TestCase([65, 65, 65, 66, 67, 67, 68, 69, 69, 69, 69, 70], [], "Uneven frequencies round-trip", "Regression test for apportionment")
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {TANSInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new TANSInstance(this, isInverse);
    }
  }

  class TANSInstance extends IAlgorithmInstance {
    /**
     * @param {TANSAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - True to decompress
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
     * Compress or decompress the collected input
     * @returns {uint8[]} Output bytes
     */
    Result() {
      if (this.isInverse) {
        // A compressed stream always carries at least the 4-byte length
        // header, so an empty buffer is not a valid compressed message.
        if (this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }
        return this._decompress();
      }
      return this._compress();
    }

    /**
     * @returns {uint8[]} Header, frequency table, final state and bitstream
     */
    _compress() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;

      /** @type {uint8[]} */
      const output = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));
      if (data.length === 0) {
        return output;
      }

      /** @type {int32[]} */
      const rawFreq = new Array(256);
      for (let i = 0; i < 256; i++) {
        rawFreq[i] = 0;
      }
      for (let i = 0; i < data.length; i++) {
        rawFreq[data[i]]++;
      }

      /** @type {int32[]} */
      const symbols = [];
      for (let i = 0; i < 256; i++) {
        if (rawFreq[i] > 0) {
          symbols.push(i);
        }
      }

      /** @type {int32[]} */
      const norm = normalizeFrequencies(rawFreq, symbols, data.length, TABLE_SIZE);
      /** @type {int32[]} */
      const spread = buildSpreadTable(norm, symbols, TABLE_SIZE);
      /** @type {int32[]} */
      const maxBits = new Int32Array(256);
      /** @type {int32[]} */
      const minStatePlus = new Int32Array(256);
      buildSymbolTransforms(norm, symbols, TABLE_LOG, maxBits, minStatePlus);

      // Encoding table: the k-th slot a symbol owns, in increasing slot order,
      // is the state reached when its reduced state equals f + k.
      /** @type {int32[][]} */
      const encodeTable = new Array(256);
      for (let n = 0; n < symbols.length; n++) {
        /** @type {int32} */
        const symbol = symbols[n];
        encodeTable[symbol] = new Int32Array(norm[symbol]);
      }
      /** @type {int32[]} */
      const seen = new Int32Array(256);
      for (let slot = 0; slot < TABLE_SIZE; slot++) {
        /** @type {int32} */
        const symbol = spread[slot];
        /** @type {int32[]} */
        const row = encodeTable[symbol];
        row[seen[symbol]++] = slot + TABLE_SIZE;
      }

      // Bit sink. A symbol never costs more than tableLog bits.
      /** @type {uint8[]} */
      const packed = new Uint8Array(Math.ceil(MAX_BITS_PER_SYMBOL * data.length / 8) + 8);
      /** @type {int32} */
      let bitCount = 0;

      /** @type {int32} */
      let state = TABLE_SIZE;
      for (let i = data.length - 1; i >= 0; i--) {
        /** @type {uint8} */
        const symbol = data[i];
        /** @type {int32} */
        let bits = maxBits[symbol];
        if (state < minStatePlus[symbol]) {
          bits = bits - 1;
        }

        /** @type {int32} */
        const unit = POW2[bits];
        /** @type {int32} */
        const low = state % unit;
        /** @type {int32} */
        const reduced = Math.floor(state / unit);

        for (let j = 0; j < bits; j++) {
          if (Math.floor(low / POW2[j]) % 2 === 1) {
            /** @type {int32} */
            const index = Math.floor(bitCount / 8);
            packed[index] = OpCodes.SetBit(packed[index], 7 - (bitCount % 8), true);
          }
          bitCount++;
        }

        /** @type {int32[]} */
        const row = encodeTable[symbol];
        state = row[reduced - norm[symbol]];
      }

      output.push(TABLE_LOG);

      /** @type {uint8[]} */
      const countBytes = OpCodes.Unpack16LE(symbols.length);
      output.push(countBytes[0]);
      output.push(countBytes[1]);

      for (let n = 0; n < symbols.length; n++) {
        /** @type {int32} */
        const symbol = symbols[n];
        output.push(symbol);
        /** @type {uint8[]} */
        const freqBytes = OpCodes.Unpack16LE(norm[symbol]);
        output.push(freqBytes[0]);
        output.push(freqBytes[1]);
      }

      /** @type {uint8[]} */
      const stateBytes = OpCodes.Unpack16LE(state - TABLE_SIZE);
      output.push(stateBytes[0]);
      output.push(stateBytes[1]);

      /** @type {uint8[]} */
      const bitCountBytes = OpCodes.Unpack32LE(OpCodes.ToUint32(bitCount));
      for (let n = 0; n < 4; n++) {
        output.push(bitCountBytes[n]);
      }

      /** @type {int32} */
      const usedBytes = Math.ceil(bitCount / 8);
      for (let i = 0; i < usedBytes; i++) {
        output.push(packed[i]);
      }

      return output;
    }

    /**
     * @returns {uint8[]} Decoded bytes
     */
    _decompress() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;

      /** @type {uint8[]} */
      const empty = [];
      if (data.length < 4) {
        return empty;
      }
      /** @type {uint32} */
      const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalLength === 0) {
        return empty;
      }

      /** @type {int32} */
      let offset = 4;
      /** @type {uint8} */
      const tableLog = data[offset++];
      /** @type {int32} */
      const tableSize = POW2[tableLog];

      /** @type {uint16} */
      const symbolCount = OpCodes.Pack16LE(data[offset], data[offset + 1]);
      offset += 2;

      /** @type {int32[]} */
      const norm = new Array(256);
      for (let i = 0; i < 256; i++) {
        norm[i] = 0;
      }
      /** @type {int32[]} */
      const symbols = [];
      for (let i = 0; i < symbolCount; i++) {
        /** @type {uint8} */
        const symbol = data[offset++];
        symbols.push(symbol);
        norm[symbol] = OpCodes.Pack16LE(data[offset], data[offset + 1]);
        offset += 2;
      }

      /** @type {uint16} */
      const finalState = OpCodes.Pack16LE(data[offset], data[offset + 1]);
      /** @type {int32} */
      let state = finalState + tableSize;
      offset += 2;

      /** @type {uint32} */
      const bitCount = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
      offset += 4;

      /** @type {int32[]} */
      const spread = buildSpreadTable(norm, symbols, tableSize);

      // Decoding table: slot -> (symbol, bits to read, base state).
      /** @type {int32[]} */
      const slotSymbol = new Array(tableSize);
      /** @type {int32[]} */
      const slotBits = new Array(tableSize);
      /** @type {int32[]} */
      const slotBase = new Array(tableSize);
      /** @type {int32[]} */
      const seen = new Array(256);
      for (let i = 0; i < 256; i++) {
        seen[i] = 0;
      }
      for (let slot = 0; slot < tableSize; slot++) {
        /** @type {int32} */
        const symbol = spread[slot];
        /** @type {int32} */
        const reduced = norm[symbol] + seen[symbol]++;
        /** @type {int32} */
        const bits = tableLog - highBit(reduced);
        slotSymbol[slot] = symbol;
        slotBits[slot] = bits;
        slotBase[slot] = reduced * POW2[bits];
      }

      // The encoder appended each symbol's bits as it walked the message
      // backwards, so the decoder consumes them from the far end backwards.
      /** @type {int32} */
      let readPosition = bitCount;
      /** @type {uint8[]} */
      const output = new Array(originalLength);

      for (let i = 0; i < originalLength; i++) {
        /** @type {int32} */
        const slot = state - tableSize;
        output[i] = slotSymbol[slot];

        /** @type {int32} */
        const bits = slotBits[slot];
        /** @type {int32} */
        let low = 0;
        for (let j = 0; j < bits; j++) {
          readPosition--;
          /** @type {uint8} */
          const byte = data[offset + Math.floor(readPosition / 8)];
          low = low * 2 + (OpCodes.GetBit(byte, 7 - (readPosition % 8)) ? 1 : 0);
        }

        state = slotBase[slot] + low;
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new TANSAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { TANSAlgorithm, TANSInstance };
}));
