;(function() {
  'use strict';

  const A = window.SZ.Archiver;

  class BitReader {
    constructor(data) {
      this._data = data;
      this._pos = 0;
      this._bitBuf = 0;
      this._bitCount = 0;
    }

    get pos() { return this._pos; }
    get bitsLeft() { return (this._data.length - this._pos) * 8 + this._bitCount; }

    getBits(n) {
      let result = 0;
      while (n > 0) {
        if (this._bitCount === 0) {
          this._bitBuf = this._pos < this._data.length ? this._data[this._pos++] : 0;
          this._bitCount = 8;
        }
        const take = Math.min(n, this._bitCount);
        result = (result << take) | ((this._bitBuf >>> (this._bitCount - take)) & ((1 << take) - 1));
        this._bitCount -= take;
        n -= take;
      }
      return result;
    }

    getBitsLE(n) {
      let result = 0;
      let shift = 0;
      while (n > 0) {
        if (this._bitCount === 0) {
          this._bitBuf = this._pos < this._data.length ? this._data[this._pos++] : 0;
          this._bitCount = 8;
        }
        const bit = (this._bitBuf >>> (8 - this._bitCount)) & 1;
        result |= (bit << shift);
        --this._bitCount;
        ++shift;
        --n;
      }
      return result;
    }

    peekBits(n) {
      const savedPos = this._pos;
      const savedBuf = this._bitBuf;
      const savedCount = this._bitCount;
      const result = this.getBits(n);
      this._pos = savedPos;
      this._bitBuf = savedBuf;
      this._bitCount = savedCount;
      return result;
    }
  }

  class BitWriter {
    constructor() {
      this._bytes = [];
      this._bitBuf = 0;
      this._bitCount = 0;
    }

    putBits(n, value) {
      while (n > 0) {
        const space = 8 - this._bitCount;
        const take = Math.min(n, space);
        const bits = (value >>> (n - take)) & ((1 << take) - 1);
        this._bitBuf = (this._bitBuf << take) | bits;
        this._bitCount += take;
        n -= take;
        if (this._bitCount === 8) {
          this._bytes.push(this._bitBuf & 0xFF);
          this._bitBuf = 0;
          this._bitCount = 0;
        }
      }
    }

    finish() {
      if (this._bitCount > 0)
        this._bytes.push((this._bitBuf << (8 - this._bitCount)) & 0xFF);
      return new Uint8Array(this._bytes);
    }
  }

  function buildCodeLengths(freqs, numCodes, maxBits) {
    const lengths = new Uint8Array(numCodes);
    const symbols = [];
    for (let i = 0; i < numCodes; ++i)
      if (freqs[i] > 0)
        symbols.push(i);

    const n = symbols.length;
    if (n === 0) return lengths;
    if (n === 1) { lengths[symbols[0]] = 1; return lengths; }

    symbols.sort((a, b) => freqs[a] - freqs[b] || a - b);

    const totalNodes = 2 * n - 1;
    const nodeFreq = new Float64Array(totalNodes);
    for (let i = 0; i < n; ++i) nodeFreq[i] = freqs[symbols[i]];

    const parentNode = new Int32Array(totalNodes).fill(-1);
    let li = 0;
    const internalQ = [];
    let ii = 0;

    function pickMin() {
      if (li >= n) return internalQ[ii++];
      if (ii >= internalQ.length) return li++;
      if (nodeFreq[li] <= nodeFreq[internalQ[ii]]) return li++;
      return internalQ[ii++];
    }

    for (let j = 0; j < n - 1; ++j) {
      const a = pickMin();
      const b = pickMin();
      const nodeIdx = n + j;
      nodeFreq[nodeIdx] = nodeFreq[a] + nodeFreq[b];
      parentNode[a] = nodeIdx;
      parentNode[b] = nodeIdx;
      internalQ.push(nodeIdx);
    }

    const depth = new Uint8Array(totalNodes);
    for (let j = totalNodes - 2; j >= 0; --j)
      depth[j] = depth[parentNode[j]] + 1;

    const blCount = new Uint32Array(maxBits + 1);
    let overflow = 0;
    for (let i = 0; i < n; ++i) {
      if (depth[i] > maxBits) ++overflow;
      ++blCount[Math.min(depth[i], maxBits)];
    }

    if (overflow === 0) {
      for (let i = 0; i < n; ++i)
        lengths[symbols[i]] = depth[i];
      return lengths;
    }

    while (overflow > 0) {
      let bits = maxBits - 1;
      while (bits > 0 && blCount[bits] === 0) --bits;
      if (bits === 0) break;
      --blCount[bits];
      blCount[bits + 1] += 2;
      --blCount[maxBits];
      overflow -= 2;
    }

    let si = 0;
    for (let bits = maxBits; bits >= 1; --bits)
      for (let c = 0; c < blCount[bits]; ++c)
        lengths[symbols[si++]] = bits;

    return lengths;
  }

  function buildHuffmanTable(lengths, numCodes) {
    const MAX_BITS = 16;
    const counts = new Uint16Array(MAX_BITS + 1);
    for (let i = 0; i < numCodes; ++i)
      if (lengths[i]) ++counts[lengths[i]];

    const nextCode = new Uint16Array(MAX_BITS + 1);
    let code = 0;
    for (let bits = 1; bits <= MAX_BITS; ++bits) {
      code = (code + counts[bits - 1]) << 1;
      nextCode[bits] = code;
    }

    const table = new Int32Array(numCodes * 2);
    for (let i = 0; i < numCodes; ++i) {
      if (lengths[i]) {
        table[i * 2] = lengths[i];
        table[i * 2 + 1] = nextCode[lengths[i]]++;
      }
    }
    return table;
  }

  function decodeHuffman(br, table, numCodes) {
    let code = 0;
    for (let bits = 1; bits <= 16; ++bits) {
      code = (code << 1) | br.getBits(1);
      for (let i = 0; i < numCodes; ++i)
        if (table[i * 2] === bits && table[i * 2 + 1] === code)
          return i;
    }
    return 0;
  }

  function buildHuffmanLookup(lengths, numCodes) {
    const MAX_BITS = 16;
    const counts = new Uint16Array(MAX_BITS + 1);
    for (let i = 0; i < numCodes; ++i)
      if (lengths[i]) ++counts[lengths[i]];

    const nextCode = new Uint16Array(MAX_BITS + 1);
    let code = 0;
    for (let bits = 1; bits <= MAX_BITS; ++bits) {
      code = (code + counts[bits - 1]) << 1;
      nextCode[bits] = code;
    }

    const symbols = [];
    for (let i = 0; i < numCodes; ++i)
      if (lengths[i])
        symbols.push({ symbol: i, bits: lengths[i], code: nextCode[lengths[i]]++ });

    symbols.sort((a, b) => a.bits - b.bits || a.code - b.code);
    return symbols;
  }

  function decodeHuffmanLookup(br, lookup) {
    let code = 0;
    let bits = 0;
    let idx = 0;
    for (let b = 1; b <= 16; ++b) {
      code = (code << 1) | br.getBits(1);
      ++bits;
      while (idx < lookup.length && lookup[idx].bits === bits) {
        if (lookup[idx].code === code) return lookup[idx].symbol;
        ++idx;
      }
    }
    return 0;
  }

  A.BitReader = BitReader;
  A.BitWriter = BitWriter;
  A.buildCodeLengths = buildCodeLengths;
  A.buildHuffmanTable = buildHuffmanTable;
  A.decodeHuffman = decodeHuffman;
  A.buildHuffmanLookup = buildHuffmanLookup;
  A.decodeHuffmanLookup = decodeHuffmanLookup;

})();
