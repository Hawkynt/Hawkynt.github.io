/*
 * ARJ Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ARJ (Archived by Robert Jung) methods 1 to 3 are, in the words of Jung's own
 * TECHNOTE.TXT, "Lempel-Ziv 77 sliding window with static Huffman encoding".
 * The concrete shape is the LZHUF three-level tree layout of that era: an LZSS
 * matcher over a 26624-byte window (method 1; methods 2 and 3 use 2048) with
 * match lengths from 3 to 256, feeding two Huffman trees rebuilt for each block
 * of at most 16384 tokens, plus a third tree that describes the first one.
 *
 * Wire format produced here - a 4-byte little-endian uncompressed length
 * followed by the ARJ bit stream. Each block opens with a 16-bit token count,
 * then three headers:
 *   - the 19-symbol code-length tree: a 5-bit symbol count, then per symbol a
 *     3-bit length for 0 to 6 and otherwise (length - 4) one bits and a zero,
 *     with a 2-bit "how many of symbols 3 to 5 are absent" field after symbol 2
 *   - the 510-symbol literal/length tree: a 9-bit symbol count, then its code
 *     lengths through the code-length tree, in which symbol 0 is one zero
 *     length, 1 is 3 to 18 zeros (4 extra bits), 2 is 20 or more zeros (9 extra
 *     bits) and symbol k above 2 is the length k - 2. Literal/length symbols 0
 *     to 255 are literal bytes, 256 and up are match lengths 3 to 256
 *   - the 17-slot position tree, written like the code-length tree but with no
 *     skip field. Slot 0 is distance 0 and slot s above that is 2^(s-1) plus
 *     (s - 1) raw bits, the distance being one less than the match offset
 * A count of zero in any of the three headers means the tree holds a single
 * symbol, whose index follows in the same width and which then costs no bits.
 *
 * Bits are packed most-significant-bit first through a 16-bit register, the
 * arrangement the original encoder's putbits used.
 *
 * Documentation and references:
 *   - ARJ TECHNOTE.TXT, distributed with the UNARJ 2.65 sources
 *     https://raw.githubusercontent.com/tripsin/unarj/master/TECHNOTE.TXT
 *   - https://en.wikipedia.org/wiki/ARJ - overview of the archiver
 *   - Haruhiko Okumura, "LZHUF" (1989) - the LZSS plus Huffman design whose
 *     three-level tree encoding this method follows
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

  const { RegisterAlgorithm, CategoryType, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== ARJ CONSTANTS =====

  const WINDOW_SIZE = 26624;            // method 1; methods 2 and 3 use 2048
  const THRESHOLD = 3;                  // minimum encodable match length
  const MAX_MATCH = 256;
  const NC = 510;                       // 256 literals + 254 length codes
  const NP = 17;                        // position slots (MAXDICBIT + 1)
  const NT = 19;                        // code-length tree symbols
  const BLOCK_SIZE = 16384;             // tokens per block
  const MAX_CODE_BITS = 16;
  const C_BIT = 9;                      // width of the literal/length count field
  const P_BIT = 5;                      // width of the position-tree count field
  const T_BIT = 5;                      // width of the code-length-tree count field
  const C_TABLE_BITS = 12;
  const P_TABLE_BITS = 8;
  const C_TABLE_SIZE = 4096;
  const P_TABLE_SIZE = 256;

  const HASH_SIZE = 32768;
  const HASH_MASK = 32767;
  const MAX_CHAIN_DEPTH = 128;

  // ===== BIT OUTPUT (most-significant-bit first through a 16-bit register) =====

  class ArjBitWriter {
    constructor() {
      this.bytes = [];
      this.bitBuf = 0;
      this.bitCount = 0;
    }

    // Emits the low `count` bits of `value`, most significant first. The register
    // holds only sixteen bits, so a write that would overflow it is finished from
    // `value` again once both whole bytes have been flushed.
    putBits(count, value) {
      if (count === 0)
        return;

      const shifted = OpCodes.And32(OpCodes.Shl32(value, 16 - count), 0xFFFF);
      this.bitBuf = OpCodes.And32(OpCodes.Or32(this.bitBuf, OpCodes.Shr32(shifted, this.bitCount)), 0xFFFF);
      this.bitCount += count;

      if (this.bitCount < 8)
        return;

      this.bytes.push(OpCodes.And32(OpCodes.Shr32(this.bitBuf, 8), 0xFF));
      this.bitCount -= 8;

      if (this.bitCount < 8) {
        this.bitBuf = OpCodes.And32(OpCodes.Shl32(this.bitBuf, 8), 0xFFFF);
        return;
      }

      this.bytes.push(OpCodes.And32(this.bitBuf, 0xFF));
      this.bitCount -= 8;
      this.bitBuf = OpCodes.And32(OpCodes.Shl32(value, 16 - this.bitCount), 0xFFFF);
    }

    flush() {
      if (this.bitCount > 0)
        this.bytes.push(OpCodes.And32(OpCodes.Shr32(this.bitBuf, 8), 0xFF));
      return this.bytes;
    }
  }

  // ===== BIT INPUT (the original fillbuf/getbits pair) =====

  class ArjBitReader {
    constructor(data, start) {
      this.data = data;
      this.pos = start;
      this.bitBuf = 0;
      this.bitCount = 0;
      this.byteBuf = 0;
      this.fillBuf(16);
    }

    // Past the end of the payload the reader yields zero bytes, which is what a
    // decoder positioned inside a larger archive would see as padding.
    nextByte() {
      return this.pos < this.data.length ? this.data[this.pos++] : 0;
    }

    fillBuf(count) {
      let n = count;
      while (this.bitCount < n) {
        this.bitBuf = OpCodes.And32(
          OpCodes.Or32(
            OpCodes.Shl32(this.bitBuf, this.bitCount),
            OpCodes.And32(OpCodes.Shr32(this.byteBuf, 8 - this.bitCount), 0xFF)
          ),
          0xFFFF
        );
        n -= this.bitCount;
        this.byteBuf = this.nextByte();
        this.bitCount = 8;
      }

      this.bitCount -= n;
      this.bitBuf = OpCodes.And32(
        OpCodes.Or32(OpCodes.Shl32(this.bitBuf, n), OpCodes.Shr32(this.byteBuf, 8 - n)),
        0xFFFF
      );
      this.byteBuf = OpCodes.And32(OpCodes.Shl32(this.byteBuf, n), 0xFF);
    }

    peekTop(count) {
      return OpCodes.Shr32(this.bitBuf, 16 - count);
    }

    getBits(count) {
      const value = this.peekTop(count);
      this.fillBuf(count);
      return value;
    }
  }

  // ===== HUFFMAN TREE CONSTRUCTION =====

  function downHeap(heap, heapSize, start, freq) {
    let i = start;
    const k = heap[i];
    let j = 2 * i;

    while (j <= heapSize) {
      if (j < heapSize && freq[heap[j]] > freq[heap[j + 1]]) ++j;
      if (freq[k] <= freq[heap[j]]) break;

      heap[i] = heap[j];
      i = j;
      j = 2 * i;
    }

    heap[i] = k;
  }

  // Canonical numbering over the finished lengths: shortest codes first, equal
  // lengths in ascending symbol order, kept inside sixteen bits.
  function makeCode(n, len, code) {
    const lenCnt = new Array(MAX_CODE_BITS + 1).fill(0);
    for (let i = 0; i < n; ++i)
      if (len[i] > 0) ++lenCnt[len[i]];

    const start = new Array(MAX_CODE_BITS + 2).fill(0);
    for (let i = 1; i <= MAX_CODE_BITS; ++i)
      start[i + 1] = OpCodes.And32(OpCodes.Shl32(start[i] + lenCnt[i], 1), 0xFFFF);

    for (let i = 0; i < n; ++i)
      if (len[i] > 0) code[i] = start[len[i]]++;
  }

  // Builds code lengths the way the original encoder did: a min-heap over the
  // participating symbols, merging the two lightest at a time and recording the
  // order in which symbols leave the heap. Lengths are then handed out longest
  // first in that same order, after the depth histogram has been capped at
  // sixteen bits and repaired until the Kraft sum is exact again. Returns the
  // root node index, which is at or above `n` when the tree has real structure
  // and is the single symbol itself otherwise.
  function makeTree(n, freq, len, code) {
    const heap = new Array(n + 1).fill(0);
    let heapSize = 0;
    for (let i = 0; i < n; ++i) len[i] = 0;

    for (let i = 0; i < n; ++i)
      if (freq[i] > 0) heap[++heapSize] = i;

    if (heapSize < 2) {
      const sym = heapSize > 0 ? heap[1] : 0;
      code[sym] = 0;
      return sym;
    }

    const left = new Array(2 * n).fill(0);
    const right = new Array(2 * n).fill(0);
    const nodeFreq = new Array(2 * n).fill(0);
    for (let i = 0; i < n; ++i) nodeFreq[i] = freq[i];

    for (let i = Math.floor(heapSize / 2); i >= 1; --i)
      downHeap(heap, heapSize, i, nodeFreq);

    const sortOrder = [];
    let avail = n;

    while (heapSize > 1) {
      const i = heap[1];
      if (i < n) sortOrder.push(i);
      heap[1] = heap[heapSize--];
      downHeap(heap, heapSize, 1, nodeFreq);

      const j = heap[1];
      if (j < n) sortOrder.push(j);

      const k = avail++;
      nodeFreq[k] = nodeFreq[i] + nodeFreq[j];
      left[k] = i;
      right[k] = j;
      heap[1] = k;
      downHeap(heap, heapSize, 1, nodeFreq);
    }

    const root = heap[1];

    // Leaf depths, walked with an explicit stack so a maximally skewed tree
    // cannot exhaust the call stack. Every leaf is written exactly once, so the
    // traversal order does not matter.
    const depth = new Array(avail).fill(0);
    const stack = [[root, 0]];
    while (stack.length > 0) {
      const entry = stack.pop();
      const node = entry[0];
      const d = entry[1];
      if (node < n) {
        depth[node] = d;
        continue;
      }

      stack.push([left[node], d + 1]);
      stack.push([right[node], d + 1]);
    }

    const lenCnt = new Array(MAX_CODE_BITS + 1).fill(0);
    for (let i = 0; i < sortOrder.length; ++i)
      ++lenCnt[Math.min(depth[sortOrder[i]], MAX_CODE_BITS)];

    // Capping depths at sixteen can push the Kraft sum above one; move one code
    // down a level at a time until it is exact again.
    const kraftFull = OpCodes.Shl32(1, MAX_CODE_BITS);
    let cum = 0;
    for (let i = MAX_CODE_BITS; i > 0; --i)
      cum += lenCnt[i] * OpCodes.Shl32(1, MAX_CODE_BITS - i);

    while (cum !== kraftFull) {
      --lenCnt[MAX_CODE_BITS];
      for (let i = MAX_CODE_BITS - 1; i > 0; --i) {
        if (lenCnt[i] === 0) continue;

        --lenCnt[i];
        lenCnt[i + 1] += 2;
        break;
      }
      --cum;
    }

    let sortIdx = 0;
    for (let i = MAX_CODE_BITS; i > 0; --i) {
      let cnt = lenCnt[i];
      while (--cnt >= 0)
        len[sortOrder[sortIdx++]] = i;
    }

    makeCode(n, len, code);
    return root;
  }

  // ===== MATCH FINDER =====

  class HashChainMatchFinder {
    constructor(windowSize, maxChainDepth) {
      this.maxChainDepth = maxChainDepth;
      this.head = new Int32Array(HASH_SIZE).fill(-1);
      this.prev = new Int32Array(windowSize);
      this.prevMask = windowSize - 1;
    }

    static computeHash(data, position) {
      return OpCodes.And32(
        OpCodes.Xor32(
          OpCodes.Xor32(OpCodes.Shl32(data[position], 10), OpCodes.Shl32(data[position + 1], 5)),
          data[position + 2]
        ),
        HASH_MASK
      );
    }

    findMatch(data, position, maxDistance, maxLength, minLength) {
      if (position + 2 >= data.length)
        return { distance: 0, length: 0 };

      let bestDistance = 0;
      let bestLength = 0;

      const hash = HashChainMatchFinder.computeHash(data, position);
      let candidate = this.head[hash];
      let chainCount = 0;
      const windowStart = Math.max(0, position - maxDistance);

      while (candidate >= windowStart && chainCount < this.maxChainDepth) {
        if (candidate === position) {
          candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
          ++chainCount;
          continue;
        }

        const limit = Math.min(maxLength, Math.min(data.length - position, data.length - candidate));
        if (bestLength === 0 || (bestLength < limit && data[candidate + bestLength] === data[position + bestLength])) {
          let length = 0;
          while (length < limit && data[candidate + length] === data[position + length])
            ++length;

          if (length >= minLength && length > bestLength) {
            bestLength = length;
            bestDistance = position - candidate;
            if (bestLength >= maxLength)
              break;
          }
        }

        candidate = this.prev[OpCodes.And32(candidate, this.prevMask)];
        if (candidate <= windowStart)
          break;

        ++chainCount;
      }

      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;

      return bestLength >= minLength
        ? { distance: bestDistance, length: bestLength }
        : { distance: 0, length: 0 };
    }

    insertPosition(data, position) {
      if (position + 2 >= data.length)
        return;

      const hash = HashChainMatchFinder.computeHash(data, position);
      this.prev[OpCodes.And32(position, this.prevMask)] = this.head[hash];
      this.head[hash] = position;
    }
  }

  // ===== ENCODER =====

  // Slot number of a distance: how many bits it takes to write it down.
  function getPositionSlot(distance) {
    let slot = 0;
    let d = distance;
    while (d > 0) {
      d = OpCodes.Shr32(d, 1);
      ++slot;
    }
    return slot;
  }

  // Frequencies of the code-length tree's own symbols: 0 for a short zero run,
  // 1 for a medium one, 2 for a long one, and k + 2 for a code length of k.
  function countTFreq(cLen, nc, tFreq) {
    for (let i = 0; i < tFreq.length; ++i) tFreq[i] = 0;

    let n = nc;
    while (n > 0 && cLen[n - 1] === 0) --n;

    let i = 0;
    while (i < n) {
      const k = cLen[i++];
      if (k !== 0) {
        ++tFreq[k + 2];
        continue;
      }

      let count = 1;
      while (i < n && cLen[i] === 0) { ++i; ++count; }

      if (count <= 2) tFreq[0] += count;
      else if (count <= 18) ++tFreq[1];
      else if (count === 19) { ++tFreq[0]; ++tFreq[1]; }
      else ++tFreq[2];
    }
  }

  // Writes one of the two small trees: a count, then each length as three bits
  // when it fits in six, otherwise as (k - 4) one bits and a zero. The
  // code-length tree additionally carries a 2-bit skip count after symbol 2.
  function writePtLen(writer, ptLen, count, nbit, iSpecial) {
    let n = count;
    while (n > 0 && ptLen[n - 1] === 0) --n;

    writer.putBits(nbit, n);
    let i = 0;
    while (i < n) {
      const k = ptLen[i++];
      if (k <= 6)
        writer.putBits(3, k);
      else
        writer.putBits(k - 3, 0xFFFE);

      if (i !== iSpecial)
        continue;

      while (i < 6 && ptLen[i] === 0) ++i;
      writer.putBits(2, i - 3);
    }
  }

  // Writes the literal/length code lengths through the code-length tree.
  function writeCLen(writer, cLen, nc, ptLen, ptCode) {
    let n = nc;
    while (n > 0 && cLen[n - 1] === 0) --n;

    writer.putBits(C_BIT, n);
    let i = 0;
    while (i < n) {
      const k = cLen[i++];
      if (k !== 0) {
        writer.putBits(ptLen[k + 2], ptCode[k + 2]);
        continue;
      }

      let count = 1;
      while (i < n && cLen[i] === 0) { ++i; ++count; }

      if (count <= 2) {
        for (let j = 0; j < count; ++j)
          writer.putBits(ptLen[0], ptCode[0]);
      } else if (count <= 18) {
        writer.putBits(ptLen[1], ptCode[1]);
        writer.putBits(4, count - 3);
      } else if (count === 19) {
        writer.putBits(ptLen[0], ptCode[0]);
        writer.putBits(ptLen[1], ptCode[1]);
        writer.putBits(4, 15);
      } else {
        writer.putBits(ptLen[2], ptCode[2]);
        writer.putBits(C_BIT, count - 20);
      }
    }
  }

  function arjCompress(input) {
    const result = [
      OpCodes.And32(input.length, 0xFF),
      OpCodes.And32(OpCodes.Shr32(input.length, 8), 0xFF),
      OpCodes.And32(OpCodes.Shr32(input.length, 16), 0xFF),
      OpCodes.And32(OpCodes.Shr32(input.length, 24), 0xFF)
    ];
    if (input.length === 0)
      return result;

    // --- token collection ---
    const matchFinder = new HashChainMatchFinder(WINDOW_SIZE, MAX_CHAIN_DEPTH);
    const isLiteral = [];
    const values = [];
    const lengths = [];
    const distances = [];
    let pos = 0;

    while (pos < input.length) {
      const match = matchFinder.findMatch(input, pos, WINDOW_SIZE, MAX_MATCH, THRESHOLD);

      if (match.length >= THRESHOLD) {
        isLiteral.push(false);
        values.push(0);
        lengths.push(match.length);
        distances.push(match.distance - 1);
        for (let i = 1; i < match.length && pos + i < input.length; ++i)
          matchFinder.insertPosition(input, pos + i);
        pos += match.length;
        continue;
      }

      isLiteral.push(true);
      values.push(input[pos]);
      lengths.push(0);
      distances.push(0);
      ++pos;
    }

    const writer = new ArjBitWriter();
    let tokenIdx = 0;

    while (tokenIdx < isLiteral.length) {
      const blockEnd = Math.min(tokenIdx + BLOCK_SIZE, isLiteral.length);
      const blockCount = blockEnd - tokenIdx;

      const cFreq = new Array(NC).fill(0);
      const pFreq = new Array(NP).fill(0);
      for (let i = tokenIdx; i < blockEnd; ++i) {
        if (isLiteral[i]) {
          ++cFreq[values[i]];
          continue;
        }

        ++cFreq[lengths[i] - THRESHOLD + 256];
        ++pFreq[getPositionSlot(distances[i])];
      }

      const cLen = new Array(NC).fill(0);
      const cCode = new Array(NC).fill(0);
      const cRoot = makeTree(NC, cFreq, cLen, cCode);

      const ptLen = new Array(NP).fill(0);
      const ptCode = new Array(NP).fill(0);

      writer.putBits(16, blockCount);

      if (cRoot >= NC) {
        const tFreq = new Array(NT).fill(0);
        countTFreq(cLen, NC, tFreq);

        const tLen = new Array(NT).fill(0);
        const tCode = new Array(NT).fill(0);
        const tRoot = makeTree(NT, tFreq, tLen, tCode);

        if (tRoot >= NT) {
          writePtLen(writer, tLen, NT, T_BIT, 3);
        } else {
          writer.putBits(T_BIT, 0);
          writer.putBits(T_BIT, tRoot);
        }

        writeCLen(writer, cLen, NC, tLen, tCode);
      } else {
        writer.putBits(T_BIT, 0);      // code-length tree: no symbol list
        writer.putBits(T_BIT, 0);      // its single symbol, unused here
        writer.putBits(C_BIT, 0);      // literal/length tree: no symbol list
        writer.putBits(C_BIT, cRoot);  // its single symbol
      }

      const pRoot = makeTree(NP, pFreq, ptLen, ptCode);
      if (pRoot >= NP) {
        writePtLen(writer, ptLen, NP, P_BIT, -1);
      } else {
        writer.putBits(P_BIT, 0);
        writer.putBits(P_BIT, pRoot);
      }

      for (let i = tokenIdx; i < blockEnd; ++i) {
        if (isLiteral[i]) {
          writer.putBits(cLen[values[i]], cCode[values[i]]);
          continue;
        }

        const lengthCode = lengths[i] - THRESHOLD + 256;
        writer.putBits(cLen[lengthCode], cCode[lengthCode]);

        const posSlot = getPositionSlot(distances[i]);
        writer.putBits(ptLen[posSlot], ptCode[posSlot]);
        if (posSlot > 1)
          writer.putBits(posSlot - 1, distances[i]);
      }

      tokenIdx = blockEnd;
    }

    const body = writer.flush();
    for (let i = 0; i < body.length; ++i)
      result.push(body[i]);
    return result;
  }

  // ===== DECODER =====

  // Decode tables: a code no longer than `tableBits` indexes the flat table
  // directly, a longer one continues through a binary tree in left/right.
  function makeTable(state, nchar, bitLen, tableBits, table, tableSize) {
    const count = new Array(MAX_CODE_BITS + 1).fill(0);
    for (let i = 0; i < nchar; ++i)
      if (bitLen[i] > 0 && bitLen[i] <= MAX_CODE_BITS) ++count[bitLen[i]];

    const start = new Array(MAX_CODE_BITS + 2).fill(0);
    for (let i = 1; i <= MAX_CODE_BITS; ++i)
      start[i + 1] = OpCodes.Shl32(start[i] + count[i], 1);

    const code = new Array(nchar).fill(0);
    for (let i = 0; i < nchar; ++i)
      if (bitLen[i] > 0) code[i] = start[bitLen[i]]++;

    for (let i = 0; i < tableSize; ++i) table[i] = 0;

    let avail = nchar;

    for (let sym = 0; sym < nchar; ++sym) {
      const len = bitLen[sym];
      if (len === 0) continue;

      if (len <= tableBits) {
        const prefix = OpCodes.Shl32(code[sym], tableBits - len);
        const fillCount = OpCodes.Shl32(1, tableBits - len);
        for (let j = 0; j < fillCount; ++j)
          table[prefix + j] = sym;
        continue;
      }

      const prefix = OpCodes.Shr32(code[sym], len - tableBits);
      if (table[prefix] === 0) {
        state.left[avail] = 0;
        state.right[avail] = 0;
        table[prefix] = avail++;
      }

      let node = table[prefix];
      for (let bit = len - tableBits - 1; bit > 0; --bit) {
        if (OpCodes.And32(code[sym], OpCodes.Shl32(1, bit)) !== 0) {
          if (state.right[node] === 0) {
            state.left[avail] = 0;
            state.right[avail] = 0;
            state.right[node] = avail++;
          }
          node = state.right[node];
        } else {
          if (state.left[node] === 0) {
            state.left[avail] = 0;
            state.right[avail] = 0;
            state.left[node] = avail++;
          }
          node = state.left[node];
        }
      }

      if (OpCodes.And32(code[sym], 1) !== 0)
        state.right[node] = sym;
      else
        state.left[node] = sym;
    }
  }

  function walkOverflow(state, reader, symbol, limit, tableBits) {
    let j = symbol;
    let mask = OpCodes.Shl32(1, 16 - tableBits - 1);
    while (j >= limit) {
      j = OpCodes.And32(reader.bitBuf, mask) !== 0 ? state.right[j] : state.left[j];
      mask = OpCodes.Shr32(mask, 1);
    }
    return j;
  }

  function readPtLen(state, reader, nn, nbit, iSpecial) {
    const n = reader.getBits(nbit);

    if (n === 0) {
      const c = reader.getBits(nbit);
      for (let i = 0; i < nn; ++i) state.ptLen[i] = 0;
      for (let i = 0; i < P_TABLE_SIZE; ++i) state.ptTable[i] = c;
      return;
    }

    const limit = Math.min(n, nn);
    let idx = 0;
    while (idx < limit) {
      let c = reader.peekTop(3);
      if (c === 7) {
        let mask = OpCodes.Shl32(1, 12);
        while (OpCodes.And32(reader.bitBuf, mask) !== 0) {
          mask = OpCodes.Shr32(mask, 1);
          ++c;
        }
      }
      reader.fillBuf(c < 7 ? 3 : c - 3);
      state.ptLen[idx++] = c;

      if (idx !== iSpecial)
        continue;

      let skip = reader.getBits(2);
      while (--skip >= 0 && idx < nn)
        state.ptLen[idx++] = 0;
    }

    while (idx < nn) state.ptLen[idx++] = 0;
    makeTable(state, nn, state.ptLen, P_TABLE_BITS, state.ptTable, P_TABLE_SIZE);
  }

  function readCLen(state, reader) {
    const n = reader.getBits(C_BIT);

    if (n === 0) {
      const c = reader.getBits(C_BIT);
      for (let i = 0; i < NC; ++i) state.cLen[i] = 0;
      for (let i = 0; i < C_TABLE_SIZE; ++i) state.cTable[i] = c;
      return;
    }

    let idx = 0;
    while (idx < n) {
      let c = state.ptTable[reader.peekTop(P_TABLE_BITS)];
      if (c >= NT)
        c = walkOverflow(state, reader, c, NT, P_TABLE_BITS);
      reader.fillBuf(state.ptLen[c]);

      if (c > 2) {
        state.cLen[idx++] = c - 2;
        continue;
      }

      let runLen;
      if (c === 0) runLen = 1;
      else if (c === 1) runLen = reader.getBits(4) + 3;
      else runLen = reader.getBits(C_BIT) + 20;

      while (--runLen >= 0 && idx < NC)
        state.cLen[idx++] = 0;
    }

    while (idx < NC) state.cLen[idx++] = 0;
    makeTable(state, NC, state.cLen, C_TABLE_BITS, state.cTable, C_TABLE_SIZE);
  }

  function arjDecompress(input) {
    if (input.length < 4)
      return [];

    const originalSize = OpCodes.Or32(
      OpCodes.Or32(input[0], OpCodes.Shl32(input[1], 8)),
      OpCodes.Or32(OpCodes.Shl32(input[2], 16), OpCodes.Shl32(input[3], 24))
    );
    if (originalSize === 0)
      return [];

    const reader = new ArjBitReader(input, 4);
    const state = {
      cLen: new Array(NC).fill(0),
      ptLen: new Array(Math.max(NT, NP)).fill(0),
      cTable: new Array(C_TABLE_SIZE).fill(0),
      ptTable: new Array(P_TABLE_SIZE).fill(0),
      left: new Array(2 * NC).fill(0),
      right: new Array(2 * NC).fill(0)
    };

    const output = new Array(originalSize).fill(0);
    // The classic LZSS window starts filled with spaces, so a reference reaching
    // back before the first byte reads as blanks rather than as leftover memory.
    const window = new Uint8Array(WINDOW_SIZE).fill(0x20);
    let windowPos = 0;
    let outPos = 0;
    let blockSize = 0;

    while (outPos < originalSize) {
      if (blockSize === 0) {
        blockSize = reader.getBits(16);
        readPtLen(state, reader, NT, T_BIT, 3);
        readCLen(state, reader);
        readPtLen(state, reader, NP, P_BIT, -1);
      }
      --blockSize;

      let c = state.cTable[reader.peekTop(C_TABLE_BITS)];
      if (c >= NC)
        c = walkOverflow(state, reader, c, NC, C_TABLE_BITS);
      reader.fillBuf(state.cLen[c]);

      if (c < 256) {
        output[outPos++] = c;
        window[windowPos] = c;
        windowPos = (windowPos + 1) % WINDOW_SIZE;
        continue;
      }

      const length = c - 256 + THRESHOLD;

      let p = state.ptTable[reader.peekTop(P_TABLE_BITS)];
      if (p >= NP)
        p = walkOverflow(state, reader, p, NP, P_TABLE_BITS);
      reader.fillBuf(state.ptLen[p]);
      if (p !== 0)
        p = OpCodes.Shl32(1, p - 1) + reader.getBits(p - 1);

      let srcPos = ((windowPos - p - 1) % WINDOW_SIZE + WINDOW_SIZE) % WINDOW_SIZE;
      for (let j = 0; j < length && outPos < originalSize; ++j) {
        const b = window[srcPos];
        output[outPos++] = b;
        window[windowPos] = b;
        windowPos = (windowPos + 1) % WINDOW_SIZE;
        srcPos = (srcPos + 1) % WINDOW_SIZE;
      }
    }

    return output;
  }

  // ===== ALGORITHM =====

  class ArjCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "ARJ";
      this.description = "ARJ method 1: LZSS matching over a 26624-byte window with match lengths 3 to 256, feeding a 510-symbol literal/length Huffman tree and a 17-slot position tree rebuilt for every block of at most 16384 tokens. The literal/length code lengths are themselves transmitted through a 19-symbol code-length tree whose own lengths use a three-bit field with a unary extension. Bits are packed most-significant-bit first through a 16-bit register.";
      this.inventor = "Robert K. Jung";
      this.year = 1991;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("ARJ TECHNOTE.TXT (from UNARJ 2.65 sources)", "https://raw.githubusercontent.com/tripsin/unarj/master/TECHNOTE.TXT"),
        new LinkItem("ARJ", "https://en.wikipedia.org/wiki/ARJ")
      ];

      this.references = [
        new LinkItem("Storer and Szymanski, Data compression via textual substitution, 1982", "https://dl.acm.org/doi/10.1145/322344.322346"),
        new LinkItem("Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952", "https://en.wikipedia.org/wiki/Huffman_coding")
      ];

      this.tests = [
        {
          text: "Empty input - length header only",
          uri: "https://raw.githubusercontent.com/tripsin/unarj/master/TECHNOTE.TXT",
          input: [],
          expected: [0x00, 0x00, 0x00, 0x00]
        },
        {
          text: "Single byte 'A' - one literal in a single-symbol tree",
          uri: "https://raw.githubusercontent.com/tripsin/unarj/master/TECHNOTE.TXT",
          input: [0x41],
          expected: [
            0x01, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x04, 0x10, 0x00
          ]
        },
        {
          text: "Repeated byte run - one literal then a single long match",
          uri: "https://raw.githubusercontent.com/tripsin/unarj/master/TECHNOTE.TXT",
          input: OpCodes.AnsiToBytes("aaaaaaaaaaaaaaaa"),
          expected: [
            0x10, 0x00, 0x00, 0x00, 0x00, 0x02, 0x20, 0x04, 0x30, 0xD1, 0x36, 0x4B,
            0x40, 0x04
          ]
        },
        {
          text: "Periodic text - literals then a match carrying position bits",
          uri: "https://raw.githubusercontent.com/tripsin/unarj/master/TECHNOTE.TXT",
          input: OpCodes.AnsiToBytes("abcabcabcabcabcabcab"),
          expected: [
            0x14, 0x00, 0x00, 0x00, 0x00, 0x04, 0x28, 0x05, 0x30, 0xF1, 0x37, 0x92,
            0xD0, 0x08, 0x6C
          ]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new ArjInstance(this, isInverse);
    }
  }

  class ArjInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; ++i)
        this.inputBuffer.push(data[i]);
    }

    Result() {
      const data = this.inputBuffer;
      this.inputBuffer = [];
      return this.isInverse ? arjDecompress(data) : arjCompress(data);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ArjCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ArjCompression, ArjInstance };
}));
