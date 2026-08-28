/*
 * LZHAM Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A clean-room port of CompressionWorkbench's LZHAM building block (BB_LZHAM),
 * byte-for-byte identical to its wire format.
 *
 * Scope honesty: Rich Geldreich's production LZHAM codec
 * (https://github.com/richgel999/lzham_codec) is an LZMA-class compressor with
 * adaptive binary range coding, rep-match slots and a polar/Huffman hybrid.
 * This is the simpler LZ77-plus-Huffman formulation the reference block
 * documents: a hash-chain LZ77 parser (32 KB window, 3..258 byte matches, at
 * most 64 chain probes) whose literal/length and distance symbols are coded
 * with canonical Huffman codes derived from the symbol frequencies, with the
 * code-length table written verbatim ahead of the token stream.
 *
 * Method references (public specifications, no third-party source consulted):
 *   - P. Deutsch, RFC 1951 "DEFLATE Compressed Data Format Specification"
 *     (the length/distance code partitioning and canonical-code construction
 *     reused here), https://www.rfc-editor.org/rfc/rfc1951
 *   - https://en.wikipedia.org/wiki/LZ77_and_LZ78
 *
 * Wire format:
 *   [originalLength: uint32 LE]
 *   286 literal/length code lengths, 4 bits each, MSB-first
 *   30 distance code lengths, 4 bits each
 *   token stream: Huffman symbol, then any extra length bits, then a Huffman
 *   distance symbol and its extra bits for matches
 *   padded to a byte boundary with zero bits
 * Empty input yields the four header bytes only.
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
          CompressionAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  // ===== PARSER CONSTANTS =====

  const MIN_MATCH_LEN = 3;
  const MAX_MATCH_LEN = 258;
  const WINDOW_SIZE = 32768;
  const HASH_BITS = 15;
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  const HASH_MASK = HASH_SIZE - 1;
  const MAX_CHAIN_PROBES = 64;

  const LITLEN_SYMBOLS = 286;
  const DIST_SYMBOLS = 30;
  const MAX_CODE_LEN = 15;

  // ===== SYMBOL PARTITIONING (RFC 1951 length/distance layout) =====

  function getLengthCode(length) {
    if (length >= 3 && length <= 10) return 257 + length - 3;
    if (length >= 11 && length <= 18) return 265 + Math.trunc((length - 11) / 2);
    if (length >= 19 && length <= 34) return 269 + Math.trunc((length - 19) / 4);
    if (length >= 35 && length <= 66) return 273 + Math.trunc((length - 35) / 8);
    if (length >= 67 && length <= 130) return 277 + Math.trunc((length - 67) / 16);
    if (length >= 131 && length <= 257) return 281 + Math.trunc((length - 131) / 32);
    if (length === 258) return 285;
    throw new Error('LZHAM: match length out of range: ' + length);
  }

  function getLengthExtra(length) {
    const code = getLengthCode(length);
    if (code >= 257 && code <= 264) return { code: code, extraBits: 0, extraVal: 0 };
    if (code >= 265 && code <= 268) return { code: code, extraBits: 1, extraVal: (length - 11) % 2 };
    if (code >= 269 && code <= 272) return { code: code, extraBits: 2, extraVal: (length - 19) % 4 };
    if (code >= 273 && code <= 276) return { code: code, extraBits: 3, extraVal: (length - 35) % 8 };
    if (code >= 277 && code <= 280) return { code: code, extraBits: 4, extraVal: (length - 67) % 16 };
    if (code >= 281 && code <= 284) return { code: code, extraBits: 5, extraVal: (length - 131) % 32 };
    if (code === 285) return { code: 285, extraBits: 0, extraVal: 0 };
    throw new Error('LZHAM: invalid length code: ' + code);
  }

  function getDistCode(distance) {
    const d = distance - 1;
    if (d === 0) return 0;
    if (d === 1) return 1;
    let bits = 0;
    let val = d;
    while (val >= 2) { val = OpCodes.Shr32(val, 1); bits++; }
    return bits * 2 + OpCodes.And32(OpCodes.Shr32(d, bits - 1), 1);
  }

  function getDistExtra(distance) {
    const code = getDistCode(distance);
    if (code <= 1) return { code: code, extraBits: 0, extraVal: 0 };
    const extra = Math.trunc((code - 2) / 2);
    const baseDist = OpCodes.Shl32(2 + OpCodes.And32(code, 1), extra);
    return { code: code, extraBits: extra, extraVal: distance - 1 - baseDist };
  }

  function decodeLength(code, reader) {
    if (code >= 257 && code <= 264) return code - 254;
    if (code >= 265 && code <= 268) return 11 + (code - 265) * 2 + reader.readBits(1);
    if (code >= 269 && code <= 272) return 19 + (code - 269) * 4 + reader.readBits(2);
    if (code >= 273 && code <= 276) return 35 + (code - 273) * 8 + reader.readBits(3);
    if (code >= 277 && code <= 280) return 67 + (code - 277) * 16 + reader.readBits(4);
    if (code >= 281 && code <= 284) return 131 + (code - 281) * 32 + reader.readBits(5);
    if (code === 285) return 258;
    throw new Error('LZHAM: invalid length code: ' + code);
  }

  function decodeDistance(code, reader) {
    if (code <= 1) return code + 1;
    const extra = Math.trunc((code - 2) / 2);
    const baseDist = OpCodes.Shl32(2 + OpCodes.And32(code, 1), extra);
    return baseDist + reader.readBits(extra) + 1;
  }

  // ===== CODE LENGTH ASSIGNMENT =====

  // Length-limited approximation: every symbol gets ceil(log2(total / freq))
  // bits (its ideal Shannon cost rounded up), then the assignment is nudged
  // until the Kraft sum lands on 1. The ceiling is evaluated with exact
  // integer arithmetic - the smallest L with freq * 2^L >= total - so the
  // result never depends on floating-point rounding.
  function buildCodeLengths(freq, maxLen) {
    const n = freq.length;
    const codeLens = new Array(n).fill(0);

    const indices = [];
    for (let i = 0; i < n; i++)
      if (freq[i] > 0) indices.push(i);

    if (indices.length === 0) return codeLens;
    if (indices.length === 1) { codeLens[indices[0]] = 1; return codeLens; }

    let total = 0;
    for (let k = 0; k < indices.length; k++) total += freq[indices[k]];

    for (let k = 0; k < indices.length; k++) {
      const idx = indices[k];
      let len = 0;
      let scaled = freq[idx];
      while (scaled < total) { scaled *= 2; len++; }
      codeLens[idx] = Math.max(1, Math.min(maxLen, len));
    }

    kraftCorrect(codeLens, maxLen);
    return codeLens;
  }

  function kraftSum(codeLens) {
    let kraft = 0.0;
    for (let i = 0; i < codeLens.length; i++)
      if (codeLens[i] > 0) kraft += Math.pow(2, -codeLens[i]);
    return kraft;
  }

  function kraftCorrect(codeLens, maxLen) {
    // Too many codes for the tree: lengthen the shortest one until it fits.
    for (;;) {
      if (kraftSum(codeLens) <= 1.0001) break;
      let minLen = Infinity;
      let minIdx = -1;
      for (let i = 0; i < codeLens.length; i++)
        if (codeLens[i] > 0 && codeLens[i] < minLen) { minLen = codeLens[i]; minIdx = i; }
      if (minIdx < 0 || codeLens[minIdx] >= maxLen) break;
      codeLens[minIdx]++;
    }

    // Tree not full: shorten the longest code to reclaim the slack.
    for (;;) {
      if (kraftSum(codeLens) >= 0.9999) break;
      let maxL = 0;
      let maxIdx = -1;
      for (let i = 0; i < codeLens.length; i++)
        if (codeLens[i] > maxL) { maxL = codeLens[i]; maxIdx = i; }
      if (maxIdx < 0 || codeLens[maxIdx] <= 1) break;
      codeLens[maxIdx]--;
    }
  }

  // Canonical code assignment (RFC 1951 section 3.2.2).
  function buildCanonicalCodes(codeLens) {
    const n = codeLens.length;
    const codes = new Array(n);
    for (let i = 0; i < n; i++) codes[i] = { code: 0, len: 0 };

    let maxLen = 0;
    for (let i = 0; i < n; i++)
      if (codeLens[i] > maxLen) maxLen = codeLens[i];
    if (maxLen === 0) return codes;

    const blCount = new Array(maxLen + 1).fill(0);
    for (let i = 0; i < n; i++)
      if (codeLens[i] > 0) blCount[codeLens[i]]++;

    const nextCode = new Array(maxLen + 1).fill(0);
    let c = 0;
    for (let bits = 1; bits <= maxLen; bits++) {
      c = OpCodes.Shl32(c + blCount[bits - 1], 1);
      nextCode[bits] = c;
    }

    for (let i = 0; i < n; i++) {
      const len = codeLens[i];
      if (len > 0) {
        codes[i] = { code: nextCode[len], len: len };
        nextCode[len]++;
      }
    }
    return codes;
  }

  // ===== BIT IO (MSB-first) =====

  class BitWriter {
    constructor() {
      this.output = [];
      this.buffer = 0;
      this.bitCount = 0;
    }
    writeBits(value, count) {
      for (let i = count - 1; i >= 0; i--) {
        this.buffer = OpCodes.Or32(OpCodes.Shl32(this.buffer, 1), OpCodes.And32(OpCodes.Shr32(value, i), 1));
        this.bitCount++;
        if (this.bitCount === 8) {
          this.output.push(OpCodes.And32(this.buffer, 0xFF));
          this.buffer = 0;
          this.bitCount = 0;
        }
      }
    }
    writeCode(c) { this.writeBits(c.code, c.len); }
    flush() {
      if (this.bitCount > 0) {
        this.buffer = OpCodes.Shl32(this.buffer, 8 - this.bitCount);
        this.output.push(OpCodes.And32(this.buffer, 0xFF));
        this.buffer = 0;
        this.bitCount = 0;
      }
    }
  }

  class BitReader {
    constructor(data) {
      this.data = data;
      this.bitPos = 0;
    }
    readBit() {
      const byteIndex = Math.trunc(this.bitPos / 8);
      if (byteIndex >= this.data.length) return 0;
      const bit = OpCodes.And32(OpCodes.Shr32(this.data[byteIndex], 7 - (this.bitPos % 8)), 1);
      this.bitPos++;
      return bit;
    }
    readBits(count) {
      let value = 0;
      for (let i = 0; i < count; i++)
        value = OpCodes.Or32(OpCodes.Shl32(value, 1), this.readBit());
      return value;
    }
  }

  function decodeSymbol(reader, codes, codeLens) {
    let code = 0;
    let maxLen = 0;
    for (let i = 0; i < codeLens.length; i++)
      if (codeLens[i] > maxLen) maxLen = codeLens[i];
    if (maxLen === 0) throw new Error('LZHAM: empty Huffman table');

    for (let len = 1; len <= maxLen; len++) {
      code = OpCodes.Or32(OpCodes.Shl32(code, 1), reader.readBit());
      for (let sym = 0; sym < codes.length; sym++)
        if (codeLens[sym] === len && codes[sym].code === code) return sym;
    }

    throw new Error('LZHAM: invalid Huffman code');
  }

  function hash3(data, pos) {
    const mixed = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Shl32(data[pos], 10), OpCodes.Shl32(data[pos + 1], 5)), data[pos + 2]);
    return OpCodes.And32(mixed, HASH_MASK);
  }

  // ===== ENCODER =====

  function encodeBody(data) {
    if (data.length === 0) return [];

    // LZ77 pass over hash chains of three-byte prefixes.
    const tokens = [];
    const hashHead = new Int32Array(HASH_SIZE).fill(-1);
    const hashPrev = new Int32Array(data.length); // implicitly seeded with 0

    let pos = 0;
    while (pos < data.length) {
      let bestLen = 0;
      let bestDist = 0;

      if (pos + 2 < data.length) {
        const h = hash3(data, pos);
        let chainPos = hashHead[h];
        hashPrev[pos] = chainPos;
        hashHead[h] = pos;

        let chainLen = 0;
        while (chainPos >= 0 && chainLen < MAX_CHAIN_PROBES) {
          const dist = pos - chainPos;
          if (dist > WINDOW_SIZE) break;

          let len = 0;
          const maxLen = Math.min(MAX_MATCH_LEN, data.length - pos);
          while (len < maxLen && data[chainPos + len] === data[pos + len]) len++;

          if (len >= MIN_MATCH_LEN && len > bestLen) {
            bestLen = len;
            bestDist = dist;
            if (bestLen === maxLen) break;
          }

          chainPos = hashPrev[chainPos];
          chainLen++;
        }
      }

      if (bestLen >= MIN_MATCH_LEN) {
        tokens.push({ isMatch: true, lit: 0, len: bestLen, dist: bestDist });
        for (let i = 1; i < bestLen && pos + i + 2 < data.length; i++) {
          const h = hash3(data, pos + i);
          hashPrev[pos + i] = hashHead[h];
          hashHead[h] = pos + i;
        }
        pos += bestLen;
      } else {
        if (pos + 2 < data.length) {
          const h = hash3(data, pos);
          hashPrev[pos] = hashHead[h];
          hashHead[h] = pos;
        }
        tokens.push({ isMatch: false, lit: data[pos], len: 0, dist: 0 });
        pos++;
      }
    }

    // Symbol frequencies drive the Huffman code lengths.
    const litLenFreq = new Array(LITLEN_SYMBOLS).fill(0);
    const distFreq = new Array(DIST_SYMBOLS).fill(0);

    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t];
      if (token.isMatch) {
        litLenFreq[getLengthCode(token.len)]++;
        distFreq[getDistCode(token.dist)]++;
      } else {
        litLenFreq[token.lit]++;
      }
    }

    const litLenCodeLen = buildCodeLengths(litLenFreq, MAX_CODE_LEN);
    const distCodeLen = buildCodeLengths(distFreq, MAX_CODE_LEN);

    const litLenCodes = buildCanonicalCodes(litLenCodeLen);
    const distCodes = buildCanonicalCodes(distCodeLen);

    const writer = new BitWriter();

    // The decoder rebuilds both tables from these raw code lengths.
    for (let i = 0; i < litLenCodeLen.length; i++) writer.writeBits(litLenCodeLen[i], 4);
    for (let i = 0; i < distCodeLen.length; i++) writer.writeBits(distCodeLen[i], 4);

    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t];
      if (token.isMatch) {
        const lengthInfo = getLengthExtra(token.len);
        writer.writeCode(litLenCodes[lengthInfo.code]);
        if (lengthInfo.extraBits > 0) writer.writeBits(lengthInfo.extraVal, lengthInfo.extraBits);

        const distInfo = getDistExtra(token.dist);
        writer.writeCode(distCodes[distInfo.code]);
        if (distInfo.extraBits > 0) writer.writeBits(distInfo.extraVal, distInfo.extraBits);
      } else {
        writer.writeCode(litLenCodes[token.lit]);
      }
    }

    writer.flush();
    return writer.output;
  }

  // ===== DECODER =====

  function decodeBody(compressed, originalSize) {
    if (originalSize === 0) return [];

    const reader = new BitReader(compressed);

    const litLenCodeLen = new Array(LITLEN_SYMBOLS);
    for (let i = 0; i < LITLEN_SYMBOLS; i++) litLenCodeLen[i] = reader.readBits(4);

    const distCodeLen = new Array(DIST_SYMBOLS);
    for (let i = 0; i < DIST_SYMBOLS; i++) distCodeLen[i] = reader.readBits(4);

    const litLenCodes = buildCanonicalCodes(litLenCodeLen);
    const distCodes = buildCanonicalCodes(distCodeLen);

    const output = new Array(originalSize).fill(0);
    let outPos = 0;

    while (outPos < originalSize) {
      const sym = decodeSymbol(reader, litLenCodes, litLenCodeLen);

      if (sym < 256) {
        output[outPos++] = sym;
      } else {
        const length = decodeLength(sym, reader);
        const distSym = decodeSymbol(reader, distCodes, distCodeLen);
        const distance = decodeDistance(distSym, reader);

        for (let i = 0; i < length; i++)
          output[outPos + i] = output[outPos - distance + i];
        outPos += length;
      }
    }

    return output;
  }

  // ===== MAIN ALGORITHM =====

  class LZHAMAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "LZHAM";
      this.description = "LZ77 parsing over 32 KB hash chains (matches of 3 to 258 bytes, at most 64 chain probes) with the literal/length and distance alphabets coded by canonical Huffman codes whose code-length table is written verbatim ahead of the token stream. Byte-for-byte identical to CompressionWorkbench's BB_LZHAM reference block. This is the LZ-plus-Huffman formulation of the design, not the production LZHAM codec's adaptive binary range coder with rep-match slots.";
      this.inventor = "Rich Geldreich";
      this.year = 2009;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("LZHAM GitHub Repository", "https://github.com/richgel999/lzham_codec"),
        new LinkItem("RFC 1951 - DEFLATE Compressed Data Format", "https://www.rfc-editor.org/rfc/rfc1951"),
        new LinkItem("LZ77 and LZ78 - Wikipedia", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      this.references = [
        new LinkItem("Rich Geldreich's Blog", "https://richg42.blogspot.com/"),
        new LinkItem("Canonical Huffman Code - Wikipedia", "https://en.wikipedia.org/wiki/Canonical_Huffman_code"),
        new LinkItem("LZHAM vs Other Codecs", "https://encode.su/threads/456-LZHAM-vs-LZMA-vs-Deflate")
      ];

      // Wire format: [originalLength uint32 LE][code-length table][token stream].
      // Expected bytes reproduce CompressionWorkbench's BB_LZHAM block.
      this.tests = [
        {
          text: "Empty input - header only",
          uri: "https://github.com/richgel999/lzham_codec",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single byte 0x41 - one literal, single-symbol table",
          uri: "https://github.com/richgel999/lzham_codec",
          input: [65],
          expected: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        {
          text: "Repeated English pangram (4x) - literals plus long matches",
          uri: "https://www.rfc-editor.org/rfc/rfc1951",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
          expected: [180, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 0, 0, 0, 0, 0, 0, 80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 85, 85, 85, 85, 85, 85, 84, 85, 85, 85, 85, 102, 96, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 102, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 1, 2, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 203, 150, 45, 167, 166, 33, 23, 46, 80, 48, 186, 16, 212, 235, 128, 91, 93, 199, 182, 145, 252, 236, 40, 154, 111, 143, 224, 240]
        },
        {
          text: "256 identical bytes - maximum-length match run",
          uri: "https://en.wikipedia.org/wiki/LZ77_and_LZ78",
          input: (function() { const a = new Array(256); a.fill(0x61); return a; })(),
          expected: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 120]
        },
        {
          text: "All 256 byte values in order - uniform 8-bit literal table",
          uri: "https://en.wikipedia.org/wiki/Canonical_Huffman_code",
          input: (function() { const a = new Array(256); for (let i = 0; i < 256; ++i) a[i] = i; return a; })(),
          expected: (function() {
            // 286 lit/len code lengths: symbols 0..255 are 8 bits, the rest unused;
            // 30 distance lengths, all unused; then the literals verbatim.
            const out = [0, 1, 0, 0];
            for (let i = 0; i < 128; ++i) out.push(0x88);
            for (let i = 0; i < 30; ++i) out.push(0);
            for (let i = 0; i < 256; ++i) out.push(i);
            return out;
          })()
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new LZHAMInstance(this, isInverse);
    }
  }

  class LZHAMInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse; // true = decompress, false = compress
      this.inputBuffer = [];
    }


    Result() {
      const result = this.isInverse ?
        this.decompress(this.inputBuffer) :
        this.compress(this.inputBuffer);

      this.inputBuffer = [];
      return result;
    }

    compress(data) {
      const input = data || [];
      const result = OpCodes.Unpack32LE(input.length);
      if (input.length === 0) return result;

      const encoded = encodeBody(input);
      for (let _i = 0; _i < encoded.length; _i++) result.push(encoded[_i]);
      return result;
    }

    decompress(data) {
      const bytes = data || [];
      if (bytes.length < 4) return [];

      const originalSize = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      if (originalSize === 0) return [];

      return decodeBody(bytes.slice(4), originalSize);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZHAMAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { LZHAMAlgorithm, LZHAMInstance, BitWriter, BitReader };
}));
