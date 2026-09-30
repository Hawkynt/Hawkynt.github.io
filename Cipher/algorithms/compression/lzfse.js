/*
 * LZFSE (Lempel-Ziv Finite State Entropy) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZFSE is Apple's LZ77 + FSE (tANS) compressor, published as open source at
 * https://github.com/lzfse/lzfse with a format description in that
 * repository's FORMAT.md. Its defining idea - followed here - is to split the
 * LZ77 parse into separate literal, literal-length, match-length and
 * match-distance streams, encode literal bytes and each of the three small
 * "command" alphabets with FSE/tANS instead of Huffman, and let large values
 * escape a small symbol alphabet via an overflow stream rather than growing
 * the alphabet itself. Apple's exact bucket tables (which values map to which
 * of ~20-64 symbols, and how many extra bits each symbol carries) are not
 * published outside their source and are not reproduced; this implementation
 * uses a simpler original bucketing (direct values 0-30, symbol 31 = escape
 * to a raw 32-bit overflow value) that preserves the same "small FSE-coded
 * symbol plus overflow" shape. The block container (stream lengths, overflow
 * tables) is likewise an original design. This is therefore LZFSE-shaped and
 * round-trip correct, not a byte-compatible implementation of Apple's real
 * LZFSE bitstream.
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

  // ===== SMALL INTEGER BIT-LENGTH HELPERS =====

  /**
   * @param {float64} value - Value
   * @returns {int32} floor(log2(value)), 0 for value <= 0
   */
  function log2Floor(value) {
    // Returns floor(log2(value)); by convention returns 0 for value <= 0.
    if (value <= 0) {
      return 0;
    }
    /** @type {int32} */
    let result = 0;
    /** @type {uint32} */
    let v = value;
    while (v > 1) {
      v = OpCodes.Shr32(v, 1);
      result++;
    }
    return result;
  }

  /**
   * @param {int32} value - Value
   * @returns {int32} Bits needed for a positive value, 0 otherwise
   */
  function bitLength(value) {
    // Number of bits needed to represent a positive value (equivalent to
    // .NET's 32 - BitOperations.LeadingZeroCount((uint)value)).
    if (value <= 0) {
      return 0;
    }
    /** @type {int32} */
    const floorLog = log2Floor(value);
    return floorLog + 1;
  }

  /**
   * @param {int32} size - Number of entries
   * @param {int32} value - Initial value of every entry
   * @returns {int32[]} Plain array filled with value
   */
  function filledArray(size, value) {
    /** @type {int32[]} */
    const arr = new Array(size);
    arr.fill(value);
    return arr;
  }

  /**
   * Byte position shared by the stream readers.
   */
  class PosRef {
    /**
     * @param {int32} pos - Initial position
     */
    constructor(pos) {
      /** @type {int32} */
      this.pos = pos;
    }
  }

  // ===== HASH CHAIN MATCH FINDER =====
  // Ported from Compression.Core.Dictionary.MatchFinders.HashChainMatchFinder
  // to guarantee byte-identical parses. Note: the modulus used to index the
  // "prev" chain array is the window size itself (not rounded to a power of
  // two), so the bitwise AND used for indexing can alias distinct positions
  // onto the same slot when the window size is not a power of two. That
  // aliasing is part of the reference behavior and is reproduced faithfully.

  const HASH_BITS = 15;
  /** @type {int32} */
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  /** @type {int32} */
  const HASH_MASK = HASH_SIZE - 1;

  /**
   * Match found by the hash-chain finder; length 0 when none.
   */
  class MatchResult {
    /**
     * @param {int32} distance - Backward distance
     * @param {int32} length - Match length
     */
    constructor(distance, length) {
      /** @type {int32} */
      this.distance = distance;
      /** @type {int32} */
      this.length = length;
    }
  }

  class HashChainMatchFinder {
    /**
     * @param {int32} windowSize - Chain array size
     * @param {int32} maxChainDepth - Chain walk limit (128 when absent or 0)
     */
    constructor(windowSize, maxChainDepth) {
      /** @type {int32} */
      this.maxChainDepth = maxChainDepth ? maxChainDepth : 128;
      /** @type {int32[]} */
      this.head = filledArray(HASH_SIZE, -1);
      /** @type {int32} */
      this.prevMask = (windowSize > 0 ? windowSize : 1) - 1;
      /** @type {int32[]} */
      this.prev = filledArray(windowSize > 0 ? windowSize : 1, 0);
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Position of the three hashed bytes
     * @returns {int32} Hash bucket
     */
    _computeHash(data, position) {
      /** @type {uint32} */
      const h = OpCodes.Xor32(
        OpCodes.Xor32(OpCodes.Shl32(data[position], 10), OpCodes.Shl32(data[position + 1], 5)),
        data[position + 2]
      );
      return OpCodes.And32(h, HASH_MASK);
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Current position, inserted into the chains
     * @param {int32} maxDistance - Farthest allowed distance
     * @param {int32} maxLength - Longest allowed match
     * @param {int32} minLength - Shortest usable match
     * @returns {MatchResult} Longest (nearest on ties) match
     */
    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) {
        return new MatchResult(0, 0);
      }

      /** @type {int32} */
      let bestDistance = 0;
      /** @type {int32} */
      let bestLength = 0;

      /** @type {int32} */
      const hash = this._computeHash(data, position);
      /** @type {int32} */
      let candidate = this.head[hash];
      /** @type {int32} */
      let chainCount = 0;
      /** @type {int32} */
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
          chainCount++;
          continue;
        }

        /** @type {int32} */
        const distance = position - candidate;
        /** @type {int32} */
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));
        /** @type {int32} */
        let length = 0;
        while (length < limit && data[candidate + length] === data[position + length]) {
          length++;
        }

        if (length >= minLength && length > bestLength) {
          bestLength = length;
          bestDistance = distance;
          if (bestLength >= maxLength) {
            break;
          }
        }

        candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
        if (candidate <= windowStart) {
          break;
        }
        chainCount++;
      }

      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;

      if (bestLength >= minLength) {
        return new MatchResult(bestDistance, bestLength);
      }
      return new MatchResult(0, 0);
    }

    /**
     * @param {uint8[]} data - Input
     * @param {int32} position - Position to insert into the chains
     */
    insertPosition(data, position) {
      if (position + 2 >= data.length) {
        return;
      }
      /** @type {int32} */
      const hash = this._computeHash(data, position);
      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;
    }
  }

  // ===== FSE (tANS) ENTROPY CODER =====
  // Ported from Compression.Core.Entropy.Fse.{FseTable,FseEncoder,FseDecoder}
  // and Compression.Core.Dictionary.Lzfse.{FseByteCodec,FseNormalizer}.

  const FSE_MIN_TABLE_LOG = 5;
  const FSE_MAX_TABLE_LOG = 12;
  const FSE_DEFAULT_TABLE_LOG = 11;

  /**
   * FSE decoding table.
   */
  class FseTable {
    /**
     * @param {int32} tableLog - Table log
     * @param {int32} tableSize - 2^tableLog
     * @param {int32[]} numBits - Bits read per state
     * @param {int32[]} symbol - Symbol per state
     * @param {int32[]} newStateBase - Next-state base per state
     */
    constructor(tableLog, tableSize, numBits, symbol, newStateBase) {
      /** @type {int32} */
      this.tableLog = tableLog;
      /** @type {int32} */
      this.tableSize = tableSize;
      /** @type {int32[]} */
      this.numBits = numBits;
      /** @type {int32[]} */
      this.symbol = symbol;
      /** @type {int32[]} */
      this.newStateBase = newStateBase;
    }
  }

  /**
   * @param {int32[]} normalizedCounts - Normalized count per symbol (-1 = low probability)
   * @param {int32} maxSymbol - Highest symbol
   * @param {int32} tableLog - Table log
   * @returns {FseTable} Decoding table
   */
  function fseBuildTable(normalizedCounts, maxSymbol, tableLog) {
    /** @type {int32} */
    const tableSize = OpCodes.Shl32(1, tableLog);
    /** @type {int32[]} */
    const numBits = filledArray(tableSize, 0);
    /** @type {int32[]} */
    const symbolArr = filledArray(tableSize, 0);
    /** @type {int32[]} */
    const newStateBase = filledArray(tableSize, 0);

    /** @type {int32} */
    let highThreshold = tableSize - 1;
    /** @type {int32[]} */
    const effectiveCounts = filledArray(maxSymbol + 1, 0);
    for (let symbol = 0; symbol <= maxSymbol; ++symbol) {
      if (normalizedCounts[symbol] === -1) {
        symbolArr[highThreshold--] = symbol;
        effectiveCounts[symbol] = 1;
      } else {
        effectiveCounts[symbol] = normalizedCounts[symbol];
      }
    }

    /** @type {int32} */
    const half = OpCodes.Shr32(tableSize, 1);
    /** @type {int32} */
    const eighth = OpCodes.Shr32(tableSize, 3);
    /** @type {int32} */
    let step = half + eighth + 3;
    /** @type {int32} */
    const mask = tableSize - 1;
    if (OpCodes.And32(step, mask) === 0) {
      step = OpCodes.Shr32(tableSize, 1) + 1;
    }

    /** @type {int32} */
    let pos = 0;
    for (let symbol = 0; symbol <= maxSymbol; ++symbol) {
      /** @type {int32} */
      const count = normalizedCounts[symbol];
      if (count <= 0) {
        continue;
      }

      for (let i = 0; i < count; ++i) {
        symbolArr[pos] = symbol;
        do {
          pos = OpCodes.And32(pos + step, mask);
        } while (pos > highThreshold);
      }
    }

    /** @type {int32[]} */
    const symbolNext = effectiveCounts.slice();
    for (let state = 0; state < tableSize; ++state) {
      /** @type {int32} */
      const symbol = symbolArr[state];
      /** @type {int32} */
      const nextState = symbolNext[symbol]++;
      /** @type {int32} */
      const nb = tableLog - log2Floor(nextState);
      numBits[state] = nb;
      /** @type {int32} */
      const shifted = OpCodes.Shl32(nextState, nb);
      newStateBase[state] = shifted - tableSize;
    }

    return new FseTable(tableLog, tableSize, numBits, symbolArr, newStateBase);
  }

  // Orders symbols by a remainder key (descending when largest is set,
  // ascending otherwise) and then by symbol value - a total order, applied by
  // an explicit insertion sort that yields the same sequence the former
  // comparator sort produced.
  /**
   * @param {int32[]} symbols - Symbols to order (copied)
   * @param {float64[]} remainder - Remainder per symbol
   * @param {boolean} largest - True to put the largest remainder first
   * @returns {int32[]} Ordered symbols
   */
  function orderByRemainder(symbols, remainder, largest) {
    /** @type {int32[]} */
    const order = symbols.slice();
    for (let i = 1; i < order.length; ++i) {
      /** @type {int32} */
      const item = order[i];
      /** @type {int32} */
      let j = i - 1;
      while (j >= 0 && remainderAfter(order[j], item, remainder, largest)) {
        order[j + 1] = order[j];
        --j;
      }
      order[j + 1] = item;
    }
    return order;
  }

  /**
   * @param {int32} a - Symbol already placed
   * @param {int32} b - Symbol being placed
   * @param {float64[]} remainder - Remainder per symbol
   * @param {boolean} largest - True when larger remainders come first
   * @returns {boolean} True when a sorts after b
   */
  function remainderAfter(a, b, remainder, largest) {
    /** @type {float64} */
    const primary = largest ? remainder[a] - remainder[b] : remainder[b] - remainder[a];
    if (primary !== 0) {
      return primary < 0;
    }
    return a > b;
  }

  /**
   * @param {int32[]} counts - Count per symbol
   * @param {int32} maxSymbol - Highest symbol
   * @param {int32} tableLog - Table log
   * @returns {int32[]} Normalized count per symbol, summing to 2^tableLog
   */
  function fseNormalize(counts, maxSymbol, tableLog) {
    /** @type {int32} */
    const tableSize = OpCodes.Shl32(1, tableLog);

    /** @type {float64} */
    let total = 0;
    /** @type {int32} */
    let nonZeroCount = 0;
    /** @type {int32} */
    let onlySymbol = -1;
    for (let s = 0; s <= maxSymbol; ++s) {
      if (counts[s] <= 0) {
        continue;
      }
      total += counts[s];
      nonZeroCount++;
      onlySymbol = s;
    }

    if (total === 0) {
      throw new Error('At least one symbol must have a non-zero count');
    }
    if (nonZeroCount > tableSize) {
      throw new Error('Table size is too small to hold every distinct symbol');
    }

    /** @type {int32[]} */
    const normalized = filledArray(maxSymbol + 1, 0);

    if (nonZeroCount === 1) {
      normalized[onlySymbol] = tableSize;
      return normalized;
    }

    /** @type {int32[]} */
    const floorAlloc = filledArray(maxSymbol + 1, 0);
    /** @type {float64[]} */
    const remainder = [];
    for (let s = 0; s <= maxSymbol; ++s) {
      remainder.push(0);
    }
    /** @type {int32[]} */
    const symbols = [];
    /** @type {int32} */
    let used = 0;

    for (let s = 0; s <= maxSymbol; ++s) {
      if (counts[s] <= 0) {
        continue;
      }

      /** @type {float64} */
      const count = counts[s];
      /** @type {float64} */
      const scaled = count * tableSize;
      /** @type {int32} */
      let floor = Math.floor(scaled / total);
      if (floor < 1) {
        floor = 1;
      }

      floorAlloc[s] = floor;
      remainder[s] = scaled - floor * total;
      symbols.push(s);
      used += floor;
    }

    /** @type {int32} */
    const diff = tableSize - used;

    if (diff > 0) {
      /** @type {int32[]} */
      const order = orderByRemainder(symbols, remainder, true);
      for (let i = 0; i < diff; ++i) {
        floorAlloc[order[i % order.length]] += 1;
      }
    } else if (diff < 0) {
      /** @type {int32} */
      let need = -diff;
      while (need > 0) {
        /** @type {int32[]} */
        const reducible = [];
        for (let k = 0; k < symbols.length; ++k) {
          if (floorAlloc[symbols[k]] > 1) {
            reducible.push(symbols[k]);
          }
        }
        /** @type {int32[]} */
        const order = orderByRemainder(reducible, remainder, false);
        if (order.length === 0) {
          throw new Error('FSE normalization could not converge');
        }

        for (let i = 0; i < order.length; ++i) {
          if (need === 0) {
            break;
          }
          floorAlloc[order[i]] -= 1;
          need--;
        }
      }
    }

    for (let k = 0; k < symbols.length; ++k) {
      normalized[symbols[k]] = floorAlloc[symbols[k]];
    }

    return normalized;
  }

  /**
   * @param {uint8[]} output - Output, appended to
   * @param {int32[]} normalizedCounts - Normalized count per symbol
   * @param {int32} maxSymbol - Highest symbol
   * @param {int32} tableLog - Table log
   */
  function fseWriteNormalizedCounts(output, normalizedCounts, maxSymbol, tableLog) {
    output.push(tableLog);
    output.push(OpCodes.And32(maxSymbol, 0xFF));
    output.push(OpCodes.And32(OpCodes.Shr32(maxSymbol, 8), 0xFF));

    for (let s = 0; s <= maxSymbol; ++s) {
      /** @type {int32} */
      const value = normalizedCounts[s];
      /** @type {int32} */
      const u16 = value < 0 ? value + 65536 : value;
      output.push(OpCodes.And32(u16, 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(u16, 8), 0xFF));
    }
  }

  /**
   * Normalized-count header of an FSE stream.
   */
  class FseHeader {
    /**
     * @param {int32[]} normalized - Normalized count per symbol
     * @param {int32} maxSymbol - Highest symbol
     * @param {int32} tableLog - Table log
     */
    constructor(normalized, maxSymbol, tableLog) {
      /** @type {int32[]} */
      this.normalized = normalized;
      /** @type {int32} */
      this.maxSymbol = maxSymbol;
      /** @type {int32} */
      this.tableLog = tableLog;
    }
  }

  /**
   * @param {uint8[]} data - FSE stream
   * @param {PosRef} posRef - Read position, advanced
   * @returns {FseHeader} Header fields
   */
  function fseReadNormalizedCounts(data, posRef) {
    if (data.length - posRef.pos < 3) {
      throw new Error('FSE header too short');
    }

    /** @type {int32} */
    const tableLog = data[posRef.pos++];
    /** @type {int32} */
    const maxSymbol = OpCodes.Or32(data[posRef.pos], OpCodes.Shl32(data[posRef.pos + 1], 8));
    posRef.pos += 2;

    if (tableLog < FSE_MIN_TABLE_LOG || tableLog > FSE_MAX_TABLE_LOG) {
      throw new Error('Invalid FSE table log');
    }
    if (maxSymbol > 255) {
      throw new Error('Invalid FSE max symbol');
    }

    /** @type {int32} */
    const needed = (maxSymbol + 1) * 2;
    if (posRef.pos + needed > data.length) {
      throw new Error('FSE normalized counts data truncated');
    }

    /** @type {int32[]} */
    const normalized = new Array(maxSymbol + 1);
    for (let s = 0; s <= maxSymbol; ++s) {
      /** @type {int32} */
      const raw = OpCodes.Or32(data[posRef.pos], OpCodes.Shl32(data[posRef.pos + 1], 8));
      normalized[s] = raw >= 32768 ? raw - 65536 : raw;
      posRef.pos += 2;
    }

    return new FseHeader(normalized, maxSymbol, tableLog);
  }

  class FseEncoder {
    /**
     * @param {int32[]} normalizedCounts - Normalized count per symbol
     * @param {int32} maxSymbol - Highest symbol
     * @param {int32} tableLog - Table log
     */
    constructor(normalizedCounts, maxSymbol, tableLog) {
      /** @type {int32} */
      this.tableLog = tableLog;
      /** @type {int32} */
      this.tableSize = OpCodes.Shl32(1, tableLog);

      /** @type {int32[]} */
      const effectiveCounts = filledArray(maxSymbol + 1, 0);
      for (let s = 0; s <= maxSymbol; ++s) {
        /** @type {int32} */
        const nc = normalizedCounts[s];
        effectiveCounts[s] = nc === -1 ? 1 : (nc > 0 ? nc : effectiveCounts[s]);
      }

      /** @type {FseTable} */
      const decTable = fseBuildTable(normalizedCounts, maxSymbol, tableLog);

      // States are appended in increasing order, so each list is already sorted.
      /** @type {int32[][]} */
      const statesForSymbol = [];
      for (let s = 0; s <= maxSymbol; ++s) {
        /** @type {int32[]} */
        const bucket = [];
        statesForSymbol.push(bucket);
      }
      for (let state = 0; state < this.tableSize; ++state) {
        statesForSymbol[decTable.symbol[state]].push(state);
      }

      /** @type {int32[][]} */
      this.encDecoderState = [];
      /** @type {int32[][]} */
      this.encNbBits = [];
      /** @type {int32[][]} */
      this.encBitsOut = [];
      for (let s = 0; s <= maxSymbol; ++s) {
        this.encDecoderState.push(null);
        this.encNbBits.push(null);
        this.encBitsOut.push(null);
      }

      for (let s = 0; s <= maxSymbol; ++s) {
        if (effectiveCounts[s] === 0) {
          continue;
        }

        /** @type {int32[]} */
        const decoderStates = filledArray(this.tableSize, 0);
        /** @type {int32[]} */
        const nbBitsRow = filledArray(this.tableSize, 0);
        /** @type {int32[]} */
        const bitsOutRow = filledArray(this.tableSize, 0);
        this.encDecoderState[s] = decoderStates;
        this.encNbBits[s] = nbBitsRow;
        this.encBitsOut[s] = bitsOutRow;

        /** @type {int32[]} */
        const states = statesForSymbol[s];
        for (let k = 0; k < states.length; ++k) {
          /** @type {int32} */
          const d = states[k];
          /** @type {int32} */
          const nbBits = decTable.numBits[d];
          /** @type {int32} */
          const baseVal = decTable.newStateBase[d];
          /** @type {int32} */
          const range = OpCodes.Shl32(1, nbBits);

          for (let bits = 0; bits < range; ++bits) {
            /** @type {int32} */
            const targetState = baseVal + bits;
            if (targetState < 0 || targetState >= this.tableSize) {
              continue;
            }

            decoderStates[targetState] = d;
            nbBitsRow[targetState] = nbBits;
            bitsOutRow[targetState] = bits;
          }
        }
      }
    }

    /**
     * @param {int32[]} data - Symbols
     * @returns {uint8[]} Encoded bits, sentinel-terminated
     */
    encode(data) {
      /** @type {uint8[]} */
      const outputBytes = [];
      if (data.length === 0) {
        return outputBytes;
      }

      /** @type {uint32} */
      let bitContainer = 0;
      /** @type {int32} */
      let bitCount = 0;

      /** @type {int32} */
      const lastSymbol = data[data.length - 1];
      /** @type {int32[]} */
      const lastDecState = this.encDecoderState[lastSymbol];
      if (!lastDecState) {
        throw new Error('Cannot encode symbol with zero frequency');
      }
      /** @type {int32} */
      let state = lastDecState[0];

      for (let i = data.length - 2; i >= 0; --i) {
        /** @type {int32} */
        const symbol = data[i];
        /** @type {int32[]} */
        const decState = this.encDecoderState[symbol];
        if (!decState) {
          throw new Error('Cannot encode symbol with zero frequency');
        }

        /** @type {int32} */
        const nbBits = this.encNbBits[symbol][state];
        /** @type {int32} */
        const bitsToOutput = this.encBitsOut[symbol][state];

        if (nbBits > 0) {
          bitContainer = OpCodes.Or32(bitContainer, OpCodes.Shl32(bitsToOutput, bitCount));
          bitCount += nbBits;
        }

        while (bitCount >= 8) {
          outputBytes.push(OpCodes.And32(bitContainer, 0xFF));
          bitContainer = OpCodes.Shr32(bitContainer, 8);
          bitCount -= 8;
        }

        state = decState[state];
      }

      bitContainer = OpCodes.Or32(bitContainer, OpCodes.Shl32(OpCodes.And32(state, this.tableSize - 1), bitCount));
      bitCount += this.tableLog;
      bitContainer = OpCodes.Or32(bitContainer, OpCodes.Shl32(1, bitCount));
      bitCount += 1;

      while (bitCount > 0) {
        outputBytes.push(OpCodes.And32(bitContainer, 0xFF));
        bitContainer = OpCodes.Shr32(bitContainer, 8);
        bitCount -= 8;
      }

      return outputBytes;
    }
  }

  class MsbBitReader {
    /**
     * @param {uint8[]} data - Encoded bits
     * @param {int32} totalBits - Position of the sentinel bit
     */
    constructor(data, totalBits) {
      /** @type {uint8[]} */
      this.data = data;
      /** @type {int32} */
      this.bitPos = totalBits - 1;
    }

    /**
     * @param {int32} pos - Bit position
     * @returns {uint32} That bit (0 past either end)
     */
    _getBit(pos) {
      /** @type {uint32} */
      const byteIdx = OpCodes.Shr32(pos, 3);
      /** @type {uint32} */
      const bitIdx = OpCodes.And32(pos, 7);
      return OpCodes.And32(OpCodes.Shr32(this.data[byteIdx], bitIdx), 1);
    }

    /**
     * @param {int32} nbBits - Bit count
     * @returns {uint32} Bits read downwards from the current position
     */
    readBitsFromTop(nbBits) {
      /** @type {uint32} */
      let value = 0;
      for (let i = nbBits - 1; i >= 0; --i) {
        /** @type {uint32} */
        const bit = this._getBit(this.bitPos);
        value = OpCodes.Or32(value, OpCodes.Shl32(bit, i));
        this.bitPos--;
      }
      return value;
    }
  }

  class FseDecoder {
    /**
     * @param {int32[]} normalizedCounts - Normalized count per symbol
     * @param {int32} maxSymbol - Highest symbol
     * @param {int32} tableLog - Table log
     */
    constructor(normalizedCounts, maxSymbol, tableLog) {
      /** @type {FseTable} */
      this.table = fseBuildTable(normalizedCounts, maxSymbol, tableLog);
    }

    /**
     * @param {uint8[]} compressed - Encoded bits
     * @param {float64} originalSize - Number of symbols
     * @returns {int32[]} Decoded symbols
     */
    decode(compressed, originalSize) {
      if (originalSize === 0) {
        /** @type {int32[]} */
        const empty = [];
        return empty;
      }

      /** @type {int32[]} */
      const output = new Array(originalSize);
      /** @type {int32} */
      const totalBits = fseFindTotalBits(compressed);
      /** @type {MsbBitReader} */
      const bitReader = new MsbBitReader(compressed, totalBits);

      /** @type {int32} */
      let state = bitReader.readBitsFromTop(this.table.tableLog);

      for (let i = 0; i < originalSize; ++i) {
        output[i] = this.table.symbol[state];
        if (i >= originalSize - 1) {
          continue;
        }

        /** @type {int32} */
        const nbBits = this.table.numBits[state];
        /** @type {int32} */
        let readBits = 0;
        if (nbBits > 0) {
          readBits = bitReader.readBitsFromTop(nbBits);
        }
        state = this.table.newStateBase[state] + readBits;
      }

      return output;
    }
  }

  /**
   * @param {uint8[]} compressed - Encoded bits
   * @returns {int32} Position of the sentinel bit
   */
  function fseFindTotalBits(compressed) {
    /** @type {int32} */
    let lastByteIndex = compressed.length - 1;
    while (lastByteIndex > 0 && compressed[lastByteIndex] === 0) {
      lastByteIndex--;
    }

    if (compressed[lastByteIndex] === 0) {
      throw new Error('No sentinel bit found in FSE stream');
    }

    /** @type {int32} */
    const highBit = log2Floor(compressed[lastByteIndex]);
    return lastByteIndex * 8 + highBit;
  }

  /**
   * @param {int32} distinctSymbols - Number of used symbols
   * @param {int32} dataLength - Number of symbols to code
   * @returns {int32} Table log
   */
  function fseChooseTableLog(distinctSymbols, dataLength) {
    /** @type {int32} */
    let log = FSE_MIN_TABLE_LOG;
    while (OpCodes.Shl32(1, log) < distinctSymbols && log < FSE_MAX_TABLE_LOG) {
      log++;
    }

    /** @type {int32} */
    const bl = dataLength <= 1 ? 1 : bitLength(dataLength);
    log = Math.max(log, Math.min(bl, FSE_DEFAULT_TABLE_LOG));

    return Math.max(FSE_MIN_TABLE_LOG, Math.min(log, FSE_MAX_TABLE_LOG));
  }

  /**
   * @param {int32[]} symbols - Byte-valued symbols
   * @returns {uint8[]} Header and FSE bits
   */
  function fseByteCodecEncode(symbols) {
    if (symbols.length === 0) {
      /** @type {uint8[]} */
      const empty = [];
      return empty;
    }

    /** @type {int32[]} */
    const counts = filledArray(256, 0);
    for (let k = 0; k < symbols.length; ++k) {
      counts[symbols[k]]++;
    }

    /** @type {int32} */
    let maxSymbol = 0;
    for (let s = 255; s >= 0; --s) {
      if (counts[s] > 0) {
        maxSymbol = s;
        break;
      }
    }

    /** @type {int32} */
    let distinct = 0;
    for (let s = 0; s <= maxSymbol; ++s) {
      if (counts[s] > 0) {
        distinct++;
      }
    }

    /** @type {int32} */
    const tableLog = fseChooseTableLog(distinct, symbols.length);
    /** @type {int32[]} */
    const normalized = fseNormalize(counts, maxSymbol, tableLog);

    /** @type {uint8[]} */
    const header = [];
    fseWriteNormalizedCounts(header, normalized, maxSymbol, tableLog);

    /** @type {FseEncoder} */
    const encoder = new FseEncoder(normalized, maxSymbol, tableLog);
    /** @type {uint8[]} */
    const body = encoder.encode(symbols);

    return header.concat(body);
  }

  /**
   * @param {uint8[]} data - Header and FSE bits
   * @param {uint32} symbolCount - Number of symbols
   * @returns {int32[]} Decoded symbols
   */
  function fseByteCodecDecode(data, symbolCount) {
    if (symbolCount === 0) {
      /** @type {int32[]} */
      const empty = [];
      return empty;
    }

    /** @type {PosRef} */
    const posRef = new PosRef(0);
    /** @type {FseHeader} */
    const header = fseReadNormalizedCounts(data, posRef);
    /** @type {FseDecoder} */
    const decoder = new FseDecoder(header.normalized, header.maxSymbol, header.tableLog);
    /** @type {int32[]} */
    const decoded = decoder.decode(data.slice(posRef.pos), symbolCount);
    return decoded;
  }

  // ===== VALUE BUCKETING =====
  // Ported from Compression.Core.Dictionary.Lzfse.ValueBucket.

  const BUCKET_DIRECT_MAX = 30;
  const BUCKET_OVERFLOW_SYMBOL = 31;

  /**
   * @param {int32[]} values - Values
   * @param {int32[]} overflow - Receives values above the direct range
   * @returns {int32[]} Bucket symbols
   */
  function valueBucketEncode(values, overflow) {
    /** @type {int32[]} */
    const symbols = new Array(values.length);
    for (let i = 0; i < values.length; ++i) {
      /** @type {int32} */
      const value = values[i];
      if (value >= 0 && value <= BUCKET_DIRECT_MAX) {
        symbols[i] = value;
      } else {
        symbols[i] = BUCKET_OVERFLOW_SYMBOL;
        overflow.push(value);
      }
    }
    return symbols;
  }

  /**
   * @param {int32[]} symbols - Bucket symbols
   * @param {uint32[]} overflow - Values above the direct range
   * @returns {float64[]} Values
   */
  function valueBucketDecode(symbols, overflow) {
    /** @type {float64[]} */
    const result = new Array(symbols.length);
    /** @type {int32} */
    let overflowIndex = 0;
    for (let i = 0; i < symbols.length; ++i) {
      if (symbols[i] === BUCKET_OVERFLOW_SYMBOL) {
        if (overflowIndex >= overflow.length) {
          throw new Error('LZFSE value stream overflow table exhausted');
        }
        result[i] = overflow[overflowIndex++];
      } else {
        result[i] = symbols[i];
      }
    }
    return result;
  }

  // ===== VALUE STREAM CONTAINER =====
  // Ported from Compression.Core.Dictionary.Lzfse.LzfseValueStream.

  /**
   * @param {uint8[]} output - Output, appended to
   * @param {uint32} value - Value written little-endian
   */
  function lzfseWriteInt(output, value) {
    /** @type {uint8[]} */
    const src = OpCodes.Unpack32LE(value);
    for (let i = 0; i < src.length; i++) {
      output.push(src[i]);
    }
  }

  /**
   * @param {uint8[]} data - Stream
   * @param {PosRef} posRef - Read position, advanced
   * @returns {uint32} Value read little-endian
   */
  function lzfseReadInt(data, posRef) {
    if (posRef.pos + 4 > data.length) {
      throw new Error('LZFSE stream is truncated at an integer field');
    }
    /** @type {uint32} */
    const value = OpCodes.Pack32LE(data[posRef.pos], data[posRef.pos + 1], data[posRef.pos + 2], data[posRef.pos + 3]);
    posRef.pos += 4;
    return value;
  }

  /**
   * @param {uint8[]} output - Output, appended to
   * @param {uint8[]} data - Block payload
   */
  function lzfseWriteBlock(output, data) {
    lzfseWriteInt(output, data.length);
    for (let i = 0; i < data.length; i++) {
      output.push(data[i]);
    }
  }

  /**
   * @param {uint8[]} data - Stream
   * @param {PosRef} posRef - Read position, advanced
   * @returns {uint8[]} Block payload
   */
  function lzfseReadBlock(data, posRef) {
    /** @type {float64} */
    const length = lzfseReadInt(data, posRef);
    if (length < 0 || posRef.pos + length > data.length) {
      throw new Error('LZFSE stream block is truncated');
    }
    /** @type {uint8[]} */
    const slice = data.slice(posRef.pos, posRef.pos + length);
    posRef.pos += length;
    return slice;
  }

  /**
   * @param {uint8[]} output - Output, appended to
   * @param {int32[]} values - Values
   */
  function lzfseWriteValues(output, values) {
    /** @type {int32[]} */
    const overflow = [];
    /** @type {int32[]} */
    const symbols = valueBucketEncode(values, overflow);
    lzfseWriteBlock(output, fseByteCodecEncode(symbols));

    lzfseWriteInt(output, overflow.length);
    for (let i = 0; i < overflow.length; ++i) {
      lzfseWriteInt(output, overflow[i]);
    }
  }

  /**
   * @param {uint8[]} data - Stream
   * @param {PosRef} posRef - Read position, advanced
   * @param {float64} count - Number of values
   * @returns {float64[]} Values
   */
  function lzfseReadValues(data, posRef, count) {
    /** @type {uint8[]} */
    const encoded = lzfseReadBlock(data, posRef);
    /** @type {int32[]} */
    const symbols = fseByteCodecDecode(encoded, count);

    /** @type {uint32} */
    const overflowCount = lzfseReadInt(data, posRef);
    /** @type {uint32[]} */
    const overflow = new Array(overflowCount);
    for (let i = 0; i < overflowCount; ++i) {
      /** @type {uint32} */
      const value = lzfseReadInt(data, posRef);
      overflow[i] = value;
    }

    return valueBucketDecode(symbols, overflow);
  }

  // ===== LZFSE CODEC =====

  const MIN_MATCH = 4;

  /**
   * @param {uint8[]} data - Input
   * @returns {uint8[]} LZFSE-style stream
   */
  function lzfseCompress(data) {
    /** @type {uint8[]} */
    const output = [];
    lzfseWriteInt(output, data.length);

    /** @type {HashChainMatchFinder} */
    const finder = new HashChainMatchFinder(Math.max(data.length, 1), 0);

    /** @type {int32[]} */
    const literalLengths = [];
    /** @type {int32[]} */
    const matchLengths = [];
    /** @type {int32[]} */
    const distances = [];
    /** @type {int32[]} */
    const literalBytes = [];

    /** @type {int32} */
    let pos = 0;
    /** @type {int32} */
    let literalStart = 0;

    while (pos < data.length) {
      if (pos + MIN_MATCH <= data.length) {
        /** @type {MatchResult} */
        const match = finder.findMatch(data, pos, data.length, data.length - pos, MIN_MATCH);
        if (match.length >= MIN_MATCH) {
          /** @type {int32} */
          const literalRun = pos - literalStart;
          literalLengths.push(literalRun);
          matchLengths.push(match.length - MIN_MATCH);
          distances.push(match.distance);
          for (let i = 0; i < literalRun; ++i) {
            literalBytes.push(data[literalStart + i]);
          }

          for (let i = 1; i < match.length; ++i) {
            finder.insertPosition(data, pos + i);
          }

          pos += match.length;
          literalStart = pos;
          continue;
        }
      }

      ++pos;
    }

    /** @type {int32} */
    const trailingLiteralRun = pos - literalStart;
    literalLengths.push(trailingLiteralRun);
    for (let i = 0; i < trailingLiteralRun; ++i) {
      literalBytes.push(data[literalStart + i]);
    }

    lzfseWriteInt(output, matchLengths.length);
    lzfseWriteInt(output, literalBytes.length);
    lzfseWriteValues(output, literalLengths);
    lzfseWriteValues(output, matchLengths);
    lzfseWriteValues(output, distances);
    lzfseWriteBlock(output, fseByteCodecEncode(literalBytes));

    return output;
  }

  /**
   * @param {uint8[]} data - LZFSE-style stream
   * @returns {uint8[]} Decompressed bytes
   */
  function lzfseDecompress(data) {
    /** @type {PosRef} */
    const posRef = new PosRef(0);
    /** @type {uint32} */
    const originalLength = lzfseReadInt(data, posRef);
    /** @type {uint8[]} */
    const output = new Array(originalLength);
    if (originalLength === 0) {
      /** @type {uint8[]} */
      const empty = [];
      return empty;
    }

    /** @type {uint32} */
    const matchCount = lzfseReadInt(data, posRef);
    /** @type {uint32} */
    const literalTotal = lzfseReadInt(data, posRef);

    if (matchCount < 0 || literalTotal < 0) {
      throw new Error('LZFSE stream has a negative count');
    }

    /** @type {float64[]} */
    const literalLengths = lzfseReadValues(data, posRef, matchCount + 1);
    /** @type {float64[]} */
    const matchLengths = lzfseReadValues(data, posRef, matchCount);
    /** @type {float64[]} */
    const distances = lzfseReadValues(data, posRef, matchCount);

    /** @type {uint8[]} */
    const literalBlock = lzfseReadBlock(data, posRef);
    /** @type {int32[]} */
    const literalBytes = fseByteCodecDecode(literalBlock, literalTotal);
    if (literalBytes.length !== literalTotal) {
      throw new Error('LZFSE literal stream length mismatch');
    }

    /** @type {float64} */
    let outPos = 0;
    /** @type {float64} */
    let litPos = 0;

    for (let i = 0; i < matchCount; ++i) {
      /** @type {float64} */
      const literalRun = literalLengths[i];
      if (literalRun < 0 || litPos + literalRun > literalBytes.length || outPos + literalRun > originalLength) {
        throw new Error('LZFSE literal run is out of range');
      }
      for (let j = 0; j < literalRun; ++j) {
        output[outPos + j] = literalBytes[litPos + j];
      }
      litPos += literalRun;
      outPos += literalRun;

      /** @type {float64} */
      const matchLength = matchLengths[i] + MIN_MATCH;
      /** @type {float64} */
      const distance = distances[i];
      if (distance <= 0 || distance > outPos || outPos + matchLength > originalLength) {
        throw new Error('LZFSE match references an invalid distance');
      }

      /** @type {float64} */
      const srcPos = outPos - distance;
      for (let j = 0; j < matchLength; ++j) {
        output[outPos + j] = output[srcPos + j];
      }
      outPos += matchLength;
    }

    /** @type {float64} */
    const trailingLiteralRun = literalLengths[matchCount];
    if (trailingLiteralRun < 0 || litPos + trailingLiteralRun > literalBytes.length || outPos + trailingLiteralRun > originalLength) {
      throw new Error('LZFSE trailing literal run is out of range');
    }
    for (let j = 0; j < trailingLiteralRun; ++j) {
      output[outPos + j] = literalBytes[litPos + j];
    }
    outPos += trailingLiteralRun;

    if (outPos !== originalLength) {
      throw new Error('LZFSE stream did not reconstruct the expected length');
    }

    return output;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * LZFSEAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class LZFSEAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "LZFSE";
        this.description = "Apple's Lempel-Ziv Finite State Entropy compression algorithm. Splits the LZ77 parse into literal/length/distance streams and entropy-codes each with FSE (tANS), with an overflow stream for values outside the small direct symbol alphabet. Follows LZFSE's documented shape but is not a byte-compatible reproduction of Apple's real bitstream (whose bucket tables are unpublished).";
        this.inventor = "Apple Inc.";
        this.year = 2015;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.US; // United States

        // Documentation and references
        this.documentation = [
          new LinkItem("LZFSE GitHub Repository (Apple reference implementation)", "https://github.com/lzfse/lzfse"),
          new LinkItem("LZFSE Wikipedia", "https://en.wikipedia.org/wiki/LZFSE"),
          new LinkItem("Apple Developer Documentation", "https://developer.apple.com/documentation/compression/compression_lzfse")
        ];

        this.references = [
          new LinkItem("LZFSE GitHub Repository", "https://github.com/lzfse/lzfse"),
          new LinkItem("Apple's Compression Framework", "https://developer.apple.com/documentation/compression/algorithm/lzfse"),
          new LinkItem("LZFSE Technical Analysis", "https://encode.su/threads/2221-LZFSE-New-Apple-Data-Compression")
        ];

        // Test vectors - cross-checked byte-for-byte against the CompressionWorkbench
        // (C#) BB_Lzfse reference implementation, which this format follows.
        this.tests = [
          new TestCase(
            [],
            OpCodes.Hex8ToBytes("00000000000000000000000006000000050000200020000000000000000000000000000000000000000000000000"),
            "Empty input",
            "https://github.com/lzfse/lzfse"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("A"),
            OpCodes.Hex8ToBytes("01000000000000000100000008000000050100000020002000000000000000000000000000000000000000008800000005410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200020"),
            "Single byte literal",
            "https://github.com/lzfse/lzfse"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("Hello World"),
            OpCodes.Hex8ToBytes("0b000000000000000b0000001c000000050b00000000000000000000000000000000000000000000002000200000000000000000000000000000000000000000ee00000005720000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000300030000000000000000000000000008000000000006000000000003004316d73503"),
            "Text with no repetition - all literals",
            "https://github.com/lzfse/lzfse"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("abcdefabcdef"),
            OpCodes.Hex8ToBytes("0c000000010000000600000012000000050600100000000000000000000000100046000000000a00000005020000000000200020000000001200000005060000000000000000000000000020002000000000d40000000566000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000060006000500050005000500ca7106"),
            "Structured pattern with clear repetition",
            "https://github.com/lzfse/lzfse"
          ),
          new TestCase(
            OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
            OpCodes.Hex8ToBytes("b4000000030000002800000045000000051f00100000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000008009804010000001f00000045000000051f000b000b00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a00be01010000007f00000044000000051f00000000000000000000000000000000000000000000000000000000000b0000000000000000000000000000000000000000000000000000000000000000001500d2020000001f0000002d00000010010000067a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020002000200020003000200020002000200020002000200020002000600020001000300010001000300010001000100010001002425835a352ce49495b011827f2c9c3986c356d4d1bf3e"),
            "Repeated text sample (4x)",
            "https://github.com/lzfse/lzfse"
          ),
          new TestCase(
            (function() { const a = []; for (let i = 0; i < 256; ++i) a.push(0x61); return a; })(),
            OpCodes.Hex8ToBytes("0001000001000000010000000800000005010010001000460000000044000000051f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020002001000000fb00000008000000050100000020002000000000c80000000561000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200020"),
            "256 repeated bytes",
            "https://github.com/lzfse/lzfse"
          ),
          new TestCase(
            (function() { const a = []; for (let i = 0; i < 256; ++i) a.push(i); return a; })(),
            OpCodes.Hex8ToBytes("00010000000000000001000044000000051f0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000200100000000010000000000000000000000000000000000000403000009ff000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200020002000200bd376e2b62dc56134ac43efb75ac26e35d940ecb457c3970ea642158d24c0940fd77ae28e55f9610cd477ef8722f66e05a174ec842ff79b02ae7619812cf49803d74ee68255cd6500d44be38f56fa620dd578e08c53f76336ae45e1b52cc46033af771a822df59900ac7fe78f26c2960da541148c23cf973aa24e15b920cc9437a376ee8621f56d04a073efb75ac26e35d940ecb457cf6702d64de58154cc640fd77ae28e55f9610cd477e3b72ec66235ad44e0b42ff79b02ae7619812cf4980fa743168e25c1950ca440138f56fa620dd578e08c5fc76f06a275ed8520f46c03af771a822df59900ac74178356ce6601d54ce48053cf973aa24e15b920cc94303"),
            "All 256 byte values",
            "https://github.com/lzfse/lzfse"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new LZFSEInstance(this, isInverse);
      }
    }

    class LZFSEInstance extends IAlgorithmInstance {
      /**
       * @param {LZFSEAlgorithm} algorithm - Owning algorithm
       * @param {boolean} isInverse - True for decompression
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        /** @type {boolean} */
        this.isInverse = isInverse; // true = decompress, false = compress
        /** @type {uint8[]} */
        this.inputBuffer = [];
      }


      /**
       * @returns {uint8[]} Compressed or decompressed bytes
       */
      Result() {
        /** @type {uint8[]} */
        let result = [];
        if (this.isInverse) {
          result = lzfseDecompress(this.inputBuffer);
        } else {
          result = lzfseCompress(this.inputBuffer);
        }

        this.inputBuffer = [];
        return result;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new LZFSEAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZFSEAlgorithm, LZFSEInstance };
}));
