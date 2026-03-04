;(function() {
'use strict';

const A = window.SZ.Archiver;
const { BitWriter, buildCodeLengths, buildHuffmanTable } = A;

function _writePTLen(bw, lengths, nn, nbit, special) {
  let count = 0;
  for (let i = nn - 1; i >= 0; --i)
    if (lengths[i] > 0) { count = i + 1; break; }

  let nonZero = 0;
  let singleSym = 0;
  for (let i = 0; i < nn; ++i)
    if (lengths[i] > 0) { ++nonZero; singleSym = i; }

  if (nonZero <= 1) {
    bw.putBits(nbit, 0);
    bw.putBits(nbit, nonZero === 0 ? 0 : singleSym);
    return;
  }

  bw.putBits(nbit, count);
  let i = 0;
  while (i < count) {
    const len = lengths[i];
    if (len < 7)
      bw.putBits(3, len);
    else {
      bw.putBits(3, 7);
      for (let k = 7; k < len; ++k) bw.putBits(1, 1);
      bw.putBits(1, 0);
    }
    ++i;
    if (i === special) {
      let gap = 0;
      while (gap < 3 && i + gap < count && lengths[i + gap] === 0) ++gap;
      bw.putBits(2, gap);
      i += gap;
    }
  }
}

function _writeCLen(bw, cLengths, nc, ptTable, ptFixed) {
  let count = 0;
  for (let i = nc - 1; i >= 0; --i)
    if (cLengths[i] > 0) { count = i + 1; break; }

  let nonZero = 0;
  let singleSym = 0;
  for (let i = 0; i < nc; ++i)
    if (cLengths[i] > 0) { ++nonZero; singleSym = i; }

  if (nonZero <= 1) {
    bw.putBits(9, 0);
    bw.putBits(9, nonZero === 0 ? 0 : singleSym);
    return;
  }

  bw.putBits(9, count);
  let i = 0;
  while (i < count) {
    if (cLengths[i] === 0) {
      let run = 0;
      while (i + run < count && cLengths[i + run] === 0) ++run;
      let remaining = run;
      while (remaining > 0) {
        if (remaining >= 20) {
          const rep = Math.min(remaining, 531);
          if (ptFixed < 0) bw.putBits(ptTable[2 * 2], ptTable[2 * 2 + 1]);
          bw.putBits(9, rep - 20);
          remaining -= rep;
        } else if (remaining >= 3) {
          const rep = Math.min(remaining, 18);
          if (ptFixed < 0) bw.putBits(ptTable[1 * 2], ptTable[1 * 2 + 1]);
          bw.putBits(4, rep - 3);
          remaining -= rep;
        } else {
          if (ptFixed < 0) bw.putBits(ptTable[0 * 2], ptTable[0 * 2 + 1]);
          --remaining;
        }
      }
      i += run;
    } else {
      const code = cLengths[i] + 2;
      if (ptFixed < 0) bw.putBits(ptTable[code * 2], ptTable[code * 2 + 1]);
      ++i;
    }
  }
}

function _distToPCode(dist) {
  if (dist <= 1) return dist;
  let p = 1, d = dist;
  while (d >= 2) { d >>>= 1; ++p; }
  return p;
}

function _compressLZHUF(data, NC, NT, THRESHOLD, DICBIT) {
  const DICSIZ = 1 << DICBIT;
  const NP = DICBIT + 1;
  const nbit2 = DICBIT >= 14 ? 5 : 4;
  const MAX_MATCH = NC - 256 + THRESHOLD - 1;
  const BLOCK_SIZE = 8192;

  if (data.length === 0) {
    const bw = new BitWriter();
    bw.putBits(16, 0);
    return bw.finish();
  }

  const bw = new BitWriter();

  const HASH_SIZE = 1 << 15;
  const HASH_MASK = HASH_SIZE - 1;
  const head = new Int32Array(HASH_SIZE).fill(-1);
  const chain = new Int32Array(data.length).fill(-1);

  function hash3(p) {
    return ((data[p] << 10) ^ (data[p + 1] << 5) ^ data[p + 2]) & HASH_MASK;
  }

  const symbolBuf = [];
  let pos = 0;

  function flushBlock() {
    const blockLen = symbolBuf.length;
    if (blockLen === 0) return;

    const cFreq = new Uint32Array(NC);
    const pFreq = new Uint32Array(NP);

    for (const sym of symbolBuf) {
      if (sym.lit !== undefined)
        ++cFreq[sym.lit];
      else {
        ++cFreq[sym.len - THRESHOLD + 256];
        ++pFreq[_distToPCode(sym.dist)];
      }
    }

    const cLengths = buildCodeLengths(cFreq, NC, 16);

    let cLenCount = 0;
    for (let j = NC - 1; j >= 0; --j)
      if (cLengths[j] > 0) { cLenCount = j + 1; break; }

    const ptFreq = new Uint32Array(NT);
    {
      let i = 0;
      while (i < cLenCount) {
        if (cLengths[i] === 0) {
          let run = 0;
          while (i + run < cLenCount && cLengths[i + run] === 0) ++run;
          let remaining = run;
          while (remaining > 0) {
            if (remaining >= 20) {
              ++ptFreq[2];
              remaining -= Math.min(remaining, 531);
            } else if (remaining >= 3) {
              ++ptFreq[1];
              remaining -= Math.min(remaining, 18);
            } else {
              ++ptFreq[0];
              --remaining;
            }
          }
          i += run;
        } else {
          ++ptFreq[cLengths[i] + 2];
          ++i;
        }
      }
    }

    const ptLengths = buildCodeLengths(ptFreq, NT, 16);
    const pLengths = buildCodeLengths(pFreq, NP, 16);

    const ptTable = buildHuffmanTable(ptLengths, NT);
    const cTable = buildHuffmanTable(cLengths, NC);
    const pTable = buildHuffmanTable(pLengths, NP);

    let ptFixed = -1;
    { let nz = 0, fs = 0;
      for (let i = 0; i < NT; ++i) if (ptLengths[i] > 0) { ++nz; fs = i; }
      if (nz <= 1) ptFixed = nz === 0 ? 0 : fs;
    }
    let cFixed = -1;
    { let nz = 0, fs = 0;
      for (let i = 0; i < NC; ++i) if (cLengths[i] > 0) { ++nz; fs = i; }
      if (nz <= 1) cFixed = nz === 0 ? 0 : fs;
    }
    let pFixed = -1;
    { let nz = 0, fs = 0;
      for (let i = 0; i < NP; ++i) if (pLengths[i] > 0) { ++nz; fs = i; }
      if (nz <= 1) pFixed = nz === 0 ? 0 : fs;
    }

    bw.putBits(16, blockLen);
    _writePTLen(bw, ptLengths, NT, 5, 3);
    _writeCLen(bw, cLengths, NC, ptTable, ptFixed);
    _writePTLen(bw, pLengths, NP, nbit2, -1);

    for (const sym of symbolBuf) {
      if (sym.lit !== undefined) {
        if (cFixed < 0) bw.putBits(cTable[sym.lit * 2], cTable[sym.lit * 2 + 1]);
      } else {
        const cCode = sym.len - THRESHOLD + 256;
        if (cFixed < 0) bw.putBits(cTable[cCode * 2], cTable[cCode * 2 + 1]);
        const pc = _distToPCode(sym.dist);
        if (pFixed < 0) bw.putBits(pTable[pc * 2], pTable[pc * 2 + 1]);
        if (pc >= 2)
          bw.putBits(pc - 1, sym.dist & ((1 << (pc - 1)) - 1));
      }
    }

    symbolBuf.length = 0;
  }

  while (pos < data.length) {
    let bestLen = 0;
    let bestDist = 0;

    if (pos + 2 < data.length) {
      const h = hash3(pos);
      let cp = head[h];
      let chainCount = 0;
      const maxChain = 4096;

      while (cp >= 0 && chainCount < maxChain) {
        const d = pos - cp;
        if (d > DICSIZ) break;
        if (d > 0 && data[cp] === data[pos]) {
          let len = 0;
          const maxLen = Math.min(MAX_MATCH, data.length - pos);
          while (len < maxLen && data[cp + len] === data[pos + len]) ++len;
          if (len >= THRESHOLD && len > bestLen) {
            bestLen = len;
            bestDist = d - 1;
          }
        }
        cp = chain[cp];
        ++chainCount;
      }

      chain[pos] = head[h];
      head[h] = pos;
    }

    if (bestLen >= THRESHOLD) {
      symbolBuf.push({ len: bestLen, dist: bestDist });
      for (let i = 1; i < bestLen && pos + i + 2 < data.length; ++i) {
        const h2 = hash3(pos + i);
        chain[pos + i] = head[h2];
        head[h2] = pos + i;
      }
      pos += bestLen;
    } else {
      symbolBuf.push({ lit: data[pos] });
      ++pos;
    }

    if (symbolBuf.length >= BLOCK_SIZE)
      flushBlock();
  }

  if (symbolBuf.length > 0)
    flushBlock();

  return bw.finish();
}

A._writePTLen = _writePTLen;
A._writeCLen = _writeCLen;
A._distToPCode = _distToPCode;
A._compressLZHUF = _compressLZHUF;

})();
