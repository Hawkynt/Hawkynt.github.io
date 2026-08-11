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

  const TABLE_LOG = 11;
  const TABLE_SIZE = 2048;   // 2^TABLE_LOG
  const MAX_BITS_PER_SYMBOL = TABLE_LOG;

  // Powers of two up to 2^12, so splitting the state never needs a shift.
  const POW2 = (() => {
    const powers = new Array(TABLE_LOG + 2);
    powers[0] = 1;
    for (let i = 1; i < powers.length; i++) powers[i] = powers[i - 1] * 2;
    return powers;
  })();

  function highBit(value) {
    let bit = 0;
    let remaining = value;
    while (remaining > 1) { remaining = Math.floor(remaining / 2); bit++; }
    return bit;
  }

  // ===== TABLE CONSTRUCTION =====

  // Largest-remainder apportionment of the raw counts onto tableSize slots.
  // Every symbol that occurs keeps at least one slot; the slots left over after
  // flooring go to the symbols with the largest fractional parts, ties broken
  // by ascending byte value so encoder and decoder always agree.
  function normalizeFrequencies(rawFreq, symbols, totalCount, tableSize) {
    const norm = new Array(256).fill(0);
    const remainder = new Array(256).fill(0);
    let assigned = 0;

    for (const symbol of symbols) {
      const ideal = rawFreq[symbol] * tableSize / totalCount;
      let nf = Math.floor(ideal);
      if (nf < 1) nf = 1;
      norm[symbol] = nf;
      remainder[symbol] = ideal - nf;
      assigned += nf;
    }

    const ranked = symbols.slice().sort((a, b) => (remainder[b] - remainder[a]) || (a - b));

    let give = 0;
    while (assigned < tableSize) {
      norm[ranked[give % ranked.length]]++;
      assigned++;
      give++;
    }

    let take = ranked.length - 1;
    while (assigned > tableSize) {
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
  function buildSpreadTable(norm, symbols, tableSize) {
    const claims = new Array(tableSize);
    let count = 0;

    for (const symbol of symbols) {
      const f = norm[symbol];
      for (let k = 0; k < f; k++) {
        claims[count++] = { key: (2 * k + 1) / (2 * f), symbol: symbol };
      }
    }

    claims.sort((a, b) => (a.key - b.key) || (a.symbol - b.symbol));

    const table = new Array(tableSize);
    for (let i = 0; i < tableSize; i++) table[i] = claims[i].symbol;
    return table;
  }

  // Per-symbol renormalization constants. Encoding symbol s from state x emits
  // maxBits-1 bits when x is below minStatePlus and maxBits bits otherwise,
  // which is exactly what drives floor(x / 2^nbBits) into the range [f, 2f).
  function buildSymbolTransforms(norm, symbols, tableLog) {
    const maxBits = new Array(256).fill(0);
    const minStatePlus = new Array(256).fill(0);

    for (const symbol of symbols) {
      const f = norm[symbol];
      const bits = tableLog - highBit(f);
      maxBits[symbol] = bits;
      minStatePlus[symbol] = f * POW2[bits];
    }

    return { maxBits, minStatePlus };
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

    CreateInstance(isInverse = false) {
      return new TANSInstance(this, isInverse);
    }
  }

  class TANSInstance extends IAlgorithmInstance {
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
      if (this.isInverse) {
        // A compressed stream always carries at least the 4-byte length
        // header, so an empty buffer is not a valid compressed message.
        if (this.inputBuffer.length === 0) return [];
        return this._decompress();
      }
      return this._compress();
    }

    _compress() {
      const data = this.inputBuffer;
      this.inputBuffer = [];

      const output = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));
      if (data.length === 0) return output;

      const rawFreq = new Array(256).fill(0);
      for (let i = 0; i < data.length; i++) rawFreq[data[i]]++;

      const symbols = [];
      for (let i = 0; i < 256; i++) {
        if (rawFreq[i] > 0) symbols.push(i);
      }

      const norm = normalizeFrequencies(rawFreq, symbols, data.length, TABLE_SIZE);
      const spread = buildSpreadTable(norm, symbols, TABLE_SIZE);
      const transforms = buildSymbolTransforms(norm, symbols, TABLE_LOG);

      // Encoding table: the k-th slot a symbol owns, in increasing slot order,
      // is the state reached when its reduced state equals f + k.
      const encodeTable = new Array(256);
      for (const symbol of symbols) encodeTable[symbol] = new Array(norm[symbol]);
      const seen = new Array(256).fill(0);
      for (let slot = 0; slot < TABLE_SIZE; slot++) {
        const symbol = spread[slot];
        encodeTable[symbol][seen[symbol]++] = slot + TABLE_SIZE;
      }

      // Bit sink. A symbol never costs more than tableLog bits.
      const packed = new Uint8Array(Math.ceil(MAX_BITS_PER_SYMBOL * data.length / 8) + 8);
      let bitCount = 0;

      let state = TABLE_SIZE;
      for (let i = data.length - 1; i >= 0; i--) {
        const symbol = data[i];
        const bits = state < transforms.minStatePlus[symbol]
          ? transforms.maxBits[symbol] - 1
          : transforms.maxBits[symbol];

        const unit = POW2[bits];
        const low = state % unit;
        const reduced = Math.floor(state / unit);

        for (let j = 0; j < bits; j++) {
          if (Math.floor(low / POW2[j]) % 2 === 1) {
            const index = Math.floor(bitCount / 8);
            packed[index] = OpCodes.SetBit(packed[index], 7 - (bitCount % 8), true);
          }
          bitCount++;
        }

        state = encodeTable[symbol][reduced - norm[symbol]];
      }

      output.push(TABLE_LOG);

      const countBytes = OpCodes.Unpack16LE(symbols.length);
      output.push(countBytes[0], countBytes[1]);

      for (const symbol of symbols) {
        output.push(symbol);
        const freqBytes = OpCodes.Unpack16LE(norm[symbol]);
        output.push(freqBytes[0], freqBytes[1]);
      }

      const stateBytes = OpCodes.Unpack16LE(state - TABLE_SIZE);
      output.push(stateBytes[0], stateBytes[1]);

      const bitCountBytes = OpCodes.Unpack32LE(OpCodes.ToUint32(bitCount));
      output.push(bitCountBytes[0], bitCountBytes[1], bitCountBytes[2], bitCountBytes[3]);

      const usedBytes = Math.ceil(bitCount / 8);
      for (let i = 0; i < usedBytes; i++) output.push(packed[i]);

      return output;
    }

    _decompress() {
      const data = this.inputBuffer;
      this.inputBuffer = [];

      if (data.length < 4) return [];
      const originalLength = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalLength === 0) return [];

      let offset = 4;
      const tableLog = data[offset++];
      const tableSize = POW2[tableLog];

      const symbolCount = OpCodes.Pack16LE(data[offset], data[offset + 1]);
      offset += 2;

      const norm = new Array(256).fill(0);
      const symbols = [];
      for (let i = 0; i < symbolCount; i++) {
        const symbol = data[offset++];
        symbols.push(symbol);
        norm[symbol] = OpCodes.Pack16LE(data[offset], data[offset + 1]);
        offset += 2;
      }

      let state = OpCodes.Pack16LE(data[offset], data[offset + 1]) + tableSize;
      offset += 2;

      const bitCount = OpCodes.Pack32LE(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
      offset += 4;

      const spread = buildSpreadTable(norm, symbols, tableSize);

      // Decoding table: slot -> (symbol, bits to read, base state).
      const slotSymbol = new Array(tableSize);
      const slotBits = new Array(tableSize);
      const slotBase = new Array(tableSize);
      const seen = new Array(256).fill(0);
      for (let slot = 0; slot < tableSize; slot++) {
        const symbol = spread[slot];
        const reduced = norm[symbol] + seen[symbol]++;
        const bits = tableLog - highBit(reduced);
        slotSymbol[slot] = symbol;
        slotBits[slot] = bits;
        slotBase[slot] = reduced * POW2[bits];
      }

      // The encoder appended each symbol's bits as it walked the message
      // backwards, so the decoder consumes them from the far end backwards.
      let readPosition = bitCount;
      const output = new Array(originalLength);

      for (let i = 0; i < originalLength; i++) {
        const slot = state - tableSize;
        output[i] = slotSymbol[slot];

        const bits = slotBits[slot];
        let low = 0;
        for (let j = 0; j < bits; j++) {
          readPosition--;
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
