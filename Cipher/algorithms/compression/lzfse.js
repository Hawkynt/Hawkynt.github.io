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

  function log2Floor(value) {
    // Returns floor(log2(value)); by convention returns 0 for value <= 0.
    if (value <= 0) return 0;
    let result = 0;
    let v = value;
    while (v > 1) {
      v = OpCodes.Shr32(v, 1);
      result++;
    }
    return result;
  }

  function bitLength(value) {
    // Number of bits needed to represent a positive value (equivalent to
    // .NET's 32 - BitOperations.LeadingZeroCount((uint)value)).
    return value <= 0 ? 0 : log2Floor(value) + 1;
  }

  // ===== HASH CHAIN MATCH FINDER =====
  // Ported from Compression.Core.Dictionary.MatchFinders.HashChainMatchFinder
  // to guarantee byte-identical parses. Note: the modulus used to index the
  // "prev" chain array is the window size itself (not rounded to a power of
  // two), so the bitwise AND used for indexing can alias distinct positions
  // onto the same slot when the window size is not a power of two. That
  // aliasing is part of the reference behavior and is reproduced faithfully.

  const HASH_BITS = 15;
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  const HASH_MASK = HASH_SIZE - 1;

  class HashChainMatchFinder {
    constructor(windowSize, maxChainDepth) {
      this.maxChainDepth = maxChainDepth || 128;
      this.head = new Array(HASH_SIZE).fill(-1);
      this.prevMask = (windowSize > 0 ? windowSize : 1) - 1;
      this.prev = new Array(windowSize > 0 ? windowSize : 1).fill(0);
    }

    _computeHash(data, position) {
      const h = OpCodes.Xor32(
        OpCodes.Xor32(OpCodes.Shl32(data[position], 10), OpCodes.Shl32(data[position + 1], 5)),
        data[position + 2]
      );
      return OpCodes.And32(h, HASH_MASK);
    }

    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length) return { distance: 0, length: 0 };

      let bestDistance = 0;
      let bestLength = 0;

      const hash = this._computeHash(data, position);
      let candidate = this.head[hash];
      let chainCount = 0;
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
          chainCount++;
          continue;
        }

        const distance = position - candidate;
        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));
        let length = 0;
        while (length < limit && data[candidate + length] === data[position + length]) length++;

        if (length >= minLength && length > bestLength) {
          bestLength = length;
          bestDistance = distance;
          if (bestLength >= maxLength) break;
        }

        candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
        if (candidate <= windowStart) break;
        chainCount++;
      }

      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;

      return bestLength >= minLength ? { distance: bestDistance, length: bestLength } : { distance: 0, length: 0 };
    }

    insertPosition(data, position) {
      if (position + 2 >= data.length) return;
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

  function fseBuildTable(normalizedCounts, maxSymbol, tableLog) {
    const tableSize = OpCodes.Shl32(1, tableLog);
    const numBits = new Array(tableSize).fill(0);
    const symbolArr = new Array(tableSize).fill(0);
    const newStateBase = new Array(tableSize).fill(0);

    let highThreshold = tableSize - 1;
    const effectiveCounts = new Array(maxSymbol + 1).fill(0);
    for (let symbol = 0; symbol <= maxSymbol; ++symbol) {
      if (normalizedCounts[symbol] === -1) {
        symbolArr[highThreshold--] = symbol;
        effectiveCounts[symbol] = 1;
      } else {
        effectiveCounts[symbol] = normalizedCounts[symbol];
      }
    }

    let step = OpCodes.Shr32(tableSize, 1) + OpCodes.Shr32(tableSize, 3) + 3;
    const mask = tableSize - 1;
    if (OpCodes.And32(step, mask) === 0) step = OpCodes.Shr32(tableSize, 1) + 1;

    let pos = 0;
    for (let symbol = 0; symbol <= maxSymbol; ++symbol) {
      const count = normalizedCounts[symbol];
      if (count <= 0) continue;

      for (let i = 0; i < count; ++i) {
        symbolArr[pos] = symbol;
        do {
          pos = OpCodes.And32(pos + step, mask);
        } while (pos > highThreshold);
      }
    }

    const symbolNext = effectiveCounts.slice();
    for (let state = 0; state < tableSize; ++state) {
      const symbol = symbolArr[state];
      const nextState = symbolNext[symbol]++;
      const nb = tableLog - log2Floor(nextState);
      numBits[state] = nb;
      newStateBase[state] = OpCodes.Shl32(nextState, nb) - tableSize;
    }

    return { tableLog, tableSize, numBits, symbol: symbolArr, newStateBase };
  }

  function fseNormalize(counts, maxSymbol, tableLog) {
    const tableSize = OpCodes.Shl32(1, tableLog);

    let total = 0;
    let nonZeroCount = 0;
    let onlySymbol = -1;
    for (let s = 0; s <= maxSymbol; ++s) {
      if (counts[s] <= 0) continue;
      total += counts[s];
      nonZeroCount++;
      onlySymbol = s;
    }

    if (total === 0) throw new Error('At least one symbol must have a non-zero count');
    if (nonZeroCount > tableSize) throw new Error('Table size is too small to hold every distinct symbol');

    const normalized = new Array(maxSymbol + 1).fill(0);

    if (nonZeroCount === 1) {
      normalized[onlySymbol] = tableSize;
      return normalized;
    }

    const floorAlloc = new Array(maxSymbol + 1).fill(0);
    const remainder = new Array(maxSymbol + 1).fill(0);
    const symbols = [];
    let used = 0;

    for (let s = 0; s <= maxSymbol; ++s) {
      if (counts[s] <= 0) continue;

      const scaled = counts[s] * tableSize;
      let floor = Math.floor(scaled / total);
      if (floor < 1) floor = 1;

      floorAlloc[s] = floor;
      remainder[s] = scaled - floor * total;
      symbols.push(s);
      used += floor;
    }

    const diff = tableSize - used;

    if (diff > 0) {
      const order = symbols.slice().sort((a, b) => (remainder[b] - remainder[a]) || (a - b));
      for (let i = 0; i < diff; ++i) floorAlloc[order[i % order.length]] += 1;
    } else if (diff < 0) {
      let need = -diff;
      while (need > 0) {
        const order = symbols.filter(s => floorAlloc[s] > 1).sort((a, b) => (remainder[a] - remainder[b]) || (a - b));
        if (order.length === 0) throw new Error('FSE normalization could not converge');

        for (let i = 0; i < order.length; ++i) {
          if (need === 0) break;
          floorAlloc[order[i]] -= 1;
          need--;
        }
      }
    }

    for (const s of symbols) normalized[s] = floorAlloc[s];

    return normalized;
  }

  function fseWriteNormalizedCounts(output, normalizedCounts, maxSymbol, tableLog) {
    output.push(tableLog);
    output.push(OpCodes.And32(maxSymbol, 0xFF));
    output.push(OpCodes.And32(OpCodes.Shr32(maxSymbol, 8), 0xFF));

    for (let s = 0; s <= maxSymbol; ++s) {
      const value = normalizedCounts[s];
      const u16 = value < 0 ? value + 65536 : value;
      output.push(OpCodes.And32(u16, 0xFF));
      output.push(OpCodes.And32(OpCodes.Shr32(u16, 8), 0xFF));
    }
  }

  function fseReadNormalizedCounts(data, posRef) {
    if (data.length - posRef.pos < 3) throw new Error('FSE header too short');

    const tableLog = data[posRef.pos++];
    const maxSymbol = OpCodes.Or32(data[posRef.pos], OpCodes.Shl32(data[posRef.pos + 1], 8));
    posRef.pos += 2;

    if (tableLog < FSE_MIN_TABLE_LOG || tableLog > FSE_MAX_TABLE_LOG) throw new Error('Invalid FSE table log');
    if (maxSymbol > 255) throw new Error('Invalid FSE max symbol');

    const needed = (maxSymbol + 1) * 2;
    if (posRef.pos + needed > data.length) throw new Error('FSE normalized counts data truncated');

    const normalized = new Array(maxSymbol + 1);
    for (let s = 0; s <= maxSymbol; ++s) {
      const raw = OpCodes.Or32(data[posRef.pos], OpCodes.Shl32(data[posRef.pos + 1], 8));
      normalized[s] = raw >= 32768 ? raw - 65536 : raw;
      posRef.pos += 2;
    }

    return { normalized, maxSymbol, tableLog };
  }

  class FseEncoder {
    constructor(normalizedCounts, maxSymbol, tableLog) {
      this.tableLog = tableLog;
      this.tableSize = OpCodes.Shl32(1, tableLog);

      const effectiveCounts = new Array(maxSymbol + 1).fill(0);
      for (let s = 0; s <= maxSymbol; ++s) {
        const nc = normalizedCounts[s];
        effectiveCounts[s] = nc === -1 ? 1 : (nc > 0 ? nc : effectiveCounts[s]);
      }

      const decTable = fseBuildTable(normalizedCounts, maxSymbol, tableLog);

      const statesForSymbol = [];
      for (let s = 0; s <= maxSymbol; ++s) statesForSymbol.push([]);
      for (let state = 0; state < this.tableSize; ++state) statesForSymbol[decTable.symbol[state]].push(state);
      for (let s = 0; s <= maxSymbol; ++s) statesForSymbol[s].sort((a, b) => a - b);

      this.encDecoderState = new Array(maxSymbol + 1).fill(null);
      this.encNbBits = new Array(maxSymbol + 1).fill(null);
      this.encBitsOut = new Array(maxSymbol + 1).fill(null);

      for (let s = 0; s <= maxSymbol; ++s) {
        if (effectiveCounts[s] === 0) continue;

        this.encDecoderState[s] = new Array(this.tableSize).fill(0);
        this.encNbBits[s] = new Array(this.tableSize).fill(0);
        this.encBitsOut[s] = new Array(this.tableSize).fill(0);

        for (const d of statesForSymbol[s]) {
          const nbBits = decTable.numBits[d];
          const baseVal = decTable.newStateBase[d];
          const range = OpCodes.Shl32(1, nbBits);

          for (let bits = 0; bits < range; ++bits) {
            const targetState = baseVal + bits;
            if (targetState < 0 || targetState >= this.tableSize) continue;

            this.encDecoderState[s][targetState] = d;
            this.encNbBits[s][targetState] = nbBits;
            this.encBitsOut[s][targetState] = bits;
          }
        }
      }
    }

    encode(data) {
      if (data.length === 0) return [];

      const outputBytes = [];
      let bitContainer = 0;
      let bitCount = 0;

      const lastSymbol = data[data.length - 1];
      const lastDecState = this.encDecoderState[lastSymbol];
      if (!lastDecState) throw new Error('Cannot encode symbol with zero frequency');
      let state = lastDecState[0];

      for (let i = data.length - 2; i >= 0; --i) {
        const symbol = data[i];
        const decState = this.encDecoderState[symbol];
        if (!decState) throw new Error('Cannot encode symbol with zero frequency');

        const nbBits = this.encNbBits[symbol][state];
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
    constructor(data, totalBits) {
      this.data = data;
      this.bitPos = totalBits - 1;
    }

    _getBit(pos) {
      const byteIdx = OpCodes.Shr32(pos, 3);
      const bitIdx = OpCodes.And32(pos, 7);
      return OpCodes.And32(OpCodes.Shr32(this.data[byteIdx], bitIdx), 1);
    }

    readBitsFromTop(nbBits) {
      let value = 0;
      for (let i = nbBits - 1; i >= 0; --i) {
        const bit = this._getBit(this.bitPos);
        value = OpCodes.Or32(value, OpCodes.Shl32(bit, i));
        this.bitPos--;
      }
      return value;
    }
  }

  class FseDecoder {
    constructor(normalizedCounts, maxSymbol, tableLog) {
      this.table = fseBuildTable(normalizedCounts, maxSymbol, tableLog);
    }

    decode(compressed, originalSize) {
      if (originalSize === 0) return [];

      const output = new Array(originalSize);
      const totalBits = fseFindTotalBits(compressed);
      const bitReader = new MsbBitReader(compressed, totalBits);

      let state = bitReader.readBitsFromTop(this.table.tableLog);

      for (let i = 0; i < originalSize; ++i) {
        output[i] = this.table.symbol[state];
        if (i >= originalSize - 1) continue;

        const nbBits = this.table.numBits[state];
        const readBits = nbBits > 0 ? bitReader.readBitsFromTop(nbBits) : 0;
        state = this.table.newStateBase[state] + readBits;
      }

      return output;
    }
  }

  function fseFindTotalBits(compressed) {
    let lastByteIndex = compressed.length - 1;
    while (lastByteIndex > 0 && compressed[lastByteIndex] === 0) lastByteIndex--;

    if (compressed[lastByteIndex] === 0) throw new Error('No sentinel bit found in FSE stream');

    const highBit = log2Floor(compressed[lastByteIndex]);
    return lastByteIndex * 8 + highBit;
  }

  function fseChooseTableLog(distinctSymbols, dataLength) {
    let log = FSE_MIN_TABLE_LOG;
    while (OpCodes.Shl32(1, log) < distinctSymbols && log < FSE_MAX_TABLE_LOG) log++;

    const bl = dataLength <= 1 ? 1 : bitLength(dataLength);
    log = Math.max(log, Math.min(bl, FSE_DEFAULT_TABLE_LOG));

    return Math.max(FSE_MIN_TABLE_LOG, Math.min(log, FSE_MAX_TABLE_LOG));
  }

  function fseByteCodecEncode(symbols) {
    if (symbols.length === 0) return [];

    const counts = new Array(256).fill(0);
    for (const b of symbols) counts[b]++;

    let maxSymbol = 0;
    for (let s = 255; s >= 0; --s) {
      if (counts[s] > 0) { maxSymbol = s; break; }
    }

    let distinct = 0;
    for (let s = 0; s <= maxSymbol; ++s) if (counts[s] > 0) distinct++;

    const tableLog = fseChooseTableLog(distinct, symbols.length);
    const normalized = fseNormalize(counts, maxSymbol, tableLog);

    const header = [];
    fseWriteNormalizedCounts(header, normalized, maxSymbol, tableLog);

    const encoder = new FseEncoder(normalized, maxSymbol, tableLog);
    const body = encoder.encode(symbols);

    return header.concat(body);
  }

  function fseByteCodecDecode(data, symbolCount) {
    if (symbolCount === 0) return [];

    const posRef = { pos: 0 };
    const { normalized, maxSymbol, tableLog } = fseReadNormalizedCounts(data, posRef);
    const decoder = new FseDecoder(normalized, maxSymbol, tableLog);
    return decoder.decode(data.slice(posRef.pos), symbolCount);
  }

  // ===== VALUE BUCKETING =====
  // Ported from Compression.Core.Dictionary.Lzfse.ValueBucket.

  const BUCKET_DIRECT_MAX = 30;
  const BUCKET_OVERFLOW_SYMBOL = 31;

  function valueBucketEncode(values, overflow) {
    const symbols = new Array(values.length);
    for (let i = 0; i < values.length; ++i) {
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

  function valueBucketDecode(symbols, overflow) {
    const result = new Array(symbols.length);
    let overflowIndex = 0;
    for (let i = 0; i < symbols.length; ++i) {
      if (symbols[i] === BUCKET_OVERFLOW_SYMBOL) {
        if (overflowIndex >= overflow.length) throw new Error('LZFSE value stream overflow table exhausted');
        result[i] = overflow[overflowIndex++];
      } else {
        result[i] = symbols[i];
      }
    }
    return result;
  }

  // ===== VALUE STREAM CONTAINER =====
  // Ported from Compression.Core.Dictionary.Lzfse.LzfseValueStream.

  function lzfseWriteInt(output, value) {
    { const _src = OpCodes.Unpack32LE(value); for (let _i = 0; _i < _src.length; _i++) output.push(_src[_i]); }
  }

  function lzfseReadInt(data, posRef) {
    if (posRef.pos + 4 > data.length) throw new Error('LZFSE stream is truncated at an integer field');
    const value = OpCodes.Pack32LE(data[posRef.pos], data[posRef.pos + 1], data[posRef.pos + 2], data[posRef.pos + 3]);
    posRef.pos += 4;
    return value;
  }

  function lzfseWriteBlock(output, data) {
    lzfseWriteInt(output, data.length);
    for (let _i = 0; _i < data.length; _i++) output.push(data[_i]);
  }

  function lzfseReadBlock(data, posRef) {
    const length = lzfseReadInt(data, posRef);
    if (length < 0 || posRef.pos + length > data.length) throw new Error('LZFSE stream block is truncated');
    const slice = data.slice(posRef.pos, posRef.pos + length);
    posRef.pos += length;
    return slice;
  }

  function lzfseWriteValues(output, values) {
    const overflow = [];
    const symbols = valueBucketEncode(values, overflow);
    lzfseWriteBlock(output, fseByteCodecEncode(symbols));

    lzfseWriteInt(output, overflow.length);
    for (const v of overflow) lzfseWriteInt(output, v);
  }

  function lzfseReadValues(data, posRef, count) {
    const encoded = lzfseReadBlock(data, posRef);
    const symbols = fseByteCodecDecode(encoded, count);

    const overflowCount = lzfseReadInt(data, posRef);
    const overflow = new Array(overflowCount);
    for (let i = 0; i < overflowCount; ++i) overflow[i] = lzfseReadInt(data, posRef);

    return valueBucketDecode(symbols, overflow);
  }

  // ===== LZFSE CODEC =====

  const MIN_MATCH = 4;

  function lzfseCompress(data) {
    const output = [];
    lzfseWriteInt(output, data.length);

    const finder = new HashChainMatchFinder(Math.max(data.length, 1));

    const literalLengths = [];
    const matchLengths = [];
    const distances = [];
    const literalBytes = [];

    let pos = 0;
    let literalStart = 0;

    while (pos < data.length) {
      if (pos + MIN_MATCH <= data.length) {
        const match = finder.findMatch(data, pos, data.length, data.length - pos, MIN_MATCH);
        if (match.length >= MIN_MATCH) {
          const literalRun = pos - literalStart;
          literalLengths.push(literalRun);
          matchLengths.push(match.length - MIN_MATCH);
          distances.push(match.distance);
          for (let i = 0; i < literalRun; ++i) literalBytes.push(data[literalStart + i]);

          for (let i = 1; i < match.length; ++i) finder.insertPosition(data, pos + i);

          pos += match.length;
          literalStart = pos;
          continue;
        }
      }

      ++pos;
    }

    const trailingLiteralRun = pos - literalStart;
    literalLengths.push(trailingLiteralRun);
    for (let i = 0; i < trailingLiteralRun; ++i) literalBytes.push(data[literalStart + i]);

    lzfseWriteInt(output, matchLengths.length);
    lzfseWriteInt(output, literalBytes.length);
    lzfseWriteValues(output, literalLengths);
    lzfseWriteValues(output, matchLengths);
    lzfseWriteValues(output, distances);
    lzfseWriteBlock(output, fseByteCodecEncode(literalBytes));

    return output;
  }

  function lzfseDecompress(data) {
    const posRef = { pos: 0 };
    const originalLength = lzfseReadInt(data, posRef);
    const output = new Array(originalLength);
    if (originalLength === 0) return [];

    const matchCount = lzfseReadInt(data, posRef);
    const literalTotal = lzfseReadInt(data, posRef);

    if (matchCount < 0 || literalTotal < 0) throw new Error('LZFSE stream has a negative count');

    const literalLengths = lzfseReadValues(data, posRef, matchCount + 1);
    const matchLengths = lzfseReadValues(data, posRef, matchCount);
    const distances = lzfseReadValues(data, posRef, matchCount);

    const literalBlock = lzfseReadBlock(data, posRef);
    const literalBytes = fseByteCodecDecode(literalBlock, literalTotal);
    if (literalBytes.length !== literalTotal) throw new Error('LZFSE literal stream length mismatch');

    let outPos = 0;
    let litPos = 0;

    for (let i = 0; i < matchCount; ++i) {
      const literalRun = literalLengths[i];
      if (literalRun < 0 || litPos + literalRun > literalBytes.length || outPos + literalRun > originalLength)
        throw new Error('LZFSE literal run is out of range');
      for (let j = 0; j < literalRun; ++j) output[outPos + j] = literalBytes[litPos + j];
      litPos += literalRun;
      outPos += literalRun;

      const matchLength = matchLengths[i] + MIN_MATCH;
      const distance = distances[i];
      if (distance <= 0 || distance > outPos || outPos + matchLength > originalLength)
        throw new Error('LZFSE match references an invalid distance');

      const srcPos = outPos - distance;
      for (let j = 0; j < matchLength; ++j) output[outPos + j] = output[srcPos + j];
      outPos += matchLength;
    }

    const trailingLiteralRun = literalLengths[matchCount];
    if (trailingLiteralRun < 0 || litPos + trailingLiteralRun > literalBytes.length || outPos + trailingLiteralRun > originalLength)
      throw new Error('LZFSE trailing literal run is out of range');
    for (let j = 0; j < trailingLiteralRun; ++j) output[outPos + j] = literalBytes[litPos + j];
    outPos += trailingLiteralRun;

    if (outPos !== originalLength) throw new Error('LZFSE stream did not reconstruct the expected length');

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
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        const result = this.isInverse ?
          lzfseDecompress(this.inputBuffer) :
          lzfseCompress(this.inputBuffer);

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
