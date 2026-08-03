/*
 * Xpress (LZ77+Huffman) Compression Algorithm
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Microsoft's Xpress compression algorithm, LZ77+Huffman variant, implemented
 * directly from the official specification:
 *   [MS-XCA]: Xpress Compression Algorithm
 *   https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8
 *   (see especially section 2.1 "LZ77+Huffman Compression Algorithm Details" and
 *   its "2.1.4.3 Final Encoding Phase" subsection, which was cross-checked against
 *   real captured Xpress output discussed on the cifs-protocol mailing list to
 *   resolve an apparent ordering ambiguity in the published pseudocode - see the
 *   design note above _compressChunk() below).
 *
 * [MS-XCA] describes data processed in independent 64KB chunks. Each chunk starts
 * with a 256-byte table of 4-bit Huffman code lengths for a 512-symbol alphabet
 * (symbols 0-255 are literal bytes, symbols 256-511 are LZ77 matches), followed by
 * a bit-packed stream of Huffman-coded symbols. Bits are packed MSB-first into
 * 16-bit little-endian words. A match symbol's low 4 bits give (length-3) clamped
 * to 15 (with a raw-byte extension scheme for longer matches) and its high bits
 * give the bit-index of the highest set bit of the match distance (with that many
 * raw extra bits, packed into the same Huffman bit stream, giving the low bits of
 * the distance).
 *
 * Container note: the raw [MS-XCA] byte stream relies on the *decompressed* size
 * being known out-of-band (e.g. from a WIM/CAB header) both to know when to stop
 * decoding and to know where one 64KB chunk's data ends and the next one's table
 * header begins. Since this implementation is self-contained (Feed/Result with no
 * side channel), it wraps the raw per-chunk [MS-XCA] payloads in a small container:
 * a 4-byte total uncompressed length, followed by, per chunk, a 4-byte compressed
 * chunk length and then the chunk payload itself (256-byte table + bit stream).
 * This framing is this implementation's own and is not part of the [MS-XCA] wire
 * format itself.
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
  const { RegisterAlgorithm, CategoryType, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== MS-XCA CONSTANTS =====

  const CHUNK_SIZE = 65536;      // Data is processed in independent 64KB chunks
  const SYMBOL_COUNT = 512;      // 256 literal symbols + 256 match symbols
  const TABLE_BYTES = 256;       // 512 symbols x 4 bits = 256 bytes
  const MAX_CODE_LENGTH = 15;    // Nibble-encoded lengths cap the Huffman depth at 15
  const MIN_MATCH = 3;           // Shortest representable LZ77 match
  const MAX_CHAIN = 96;          // Bounded hash-chain search depth (perf, not spec)

  // ===== BIT-LEVEL HELPERS =====

  // Returns the bit index of the highest set bit of a positive integer
  // (referred to as GetHighBit() in the [MS-XCA] pseudocode).
  function getHighBit(value) {
    let bits = 0;
    let v = value;
    while (v > 1) {
      v = OpCodes.Shr32(v, 1);
      ++bits;
    }
    return bits;
  }

  function maskOf(bitCount) {
    return OpCodes.ToUint32(OpCodes.Shl32(1, bitCount) - 1);
  }

  // Bit-packed writer matching [MS-XCA]'s MSB-first-within-16-bit-little-endian-word
  // convention. Raw bytes (used for match-length extensions) always start at a fresh
  // word boundary: any partially filled word is flushed (zero-padded) first.
  class XpressBitWriter {
    constructor() {
      this.bytes = [];
      this.acc = 0;
      this.bitCount = 0;
    }

    writeBits(value, count) {
      if (count === 0) return;
      this.acc = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shl32(this.acc, count), OpCodes.AndN(value, maskOf(count))));
      this.bitCount += count;

      while (this.bitCount >= 16) {
        const shift = this.bitCount - 16;
        const word = OpCodes.AndN(OpCodes.Shr32(this.acc, shift), 0xFFFF);
        this.bytes.push(OpCodes.AndN(word, 0xFF));
        this.bytes.push(OpCodes.AndN(OpCodes.Shr16(word, 8), 0xFF));
        this.bitCount -= 16;
        this.acc = OpCodes.AndN(this.acc, maskOf(this.bitCount));
      }
    }

    flush() {
      if (this.bitCount > 0) {
        const shift = 16 - this.bitCount;
        const word = OpCodes.AndN(OpCodes.Shl32(this.acc, shift), 0xFFFF);
        this.bytes.push(OpCodes.AndN(word, 0xFF));
        this.bytes.push(OpCodes.AndN(OpCodes.Shr16(word, 8), 0xFF));
        this.acc = 0;
        this.bitCount = 0;
      }
    }

    writeRawByte(value) {
      this.flush();
      this.bytes.push(OpCodes.AndN(value, 0xFF));
    }

    writeRawUint16LE(value) {
      this.flush();
      this.bytes.push(OpCodes.AndN(value, 0xFF));
      this.bytes.push(OpCodes.AndN(OpCodes.Shr16(value, 8), 0xFF));
    }

    writeRawUint32LE(value) {
      this.flush();
      const v = OpCodes.ToUint32(value);
      this.bytes.push(OpCodes.AndN(v, 0xFF));
      this.bytes.push(OpCodes.AndN(OpCodes.Shr32(v, 8), 0xFF));
      this.bytes.push(OpCodes.AndN(OpCodes.Shr32(v, 16), 0xFF));
      this.bytes.push(OpCodes.AndN(OpCodes.Shr32(v, 24), 0xFF));
    }
  }

  class XpressBitReader {
    constructor(bytes, pos) {
      this.bytes = bytes;
      this.pos = pos;
      this.acc = 0;
      this.bitCount = 0;
    }

    _fill() {
      if (this.pos + 1 < this.bytes.length) {
        const lo = this.bytes[this.pos];
        const hi = this.bytes[this.pos + 1];
        const word = OpCodes.Or32(lo, OpCodes.Shl32(hi, 8));
        this.acc = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shl32(this.acc, 16), word));
        this.bitCount += 16;
        this.pos += 2;
      } else if (this.pos < this.bytes.length) {
        const b = this.bytes[this.pos];
        this.acc = OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shl32(this.acc, 8), b));
        this.bitCount += 8;
        this.pos += 1;
      } else {
        throw new Error('Xpress: unexpected end of compressed data');
      }
    }

    readBits(count) {
      if (count === 0) return 0;
      while (this.bitCount < count) this._fill();
      const shift = this.bitCount - count;
      const value = OpCodes.AndN(OpCodes.Shr32(this.acc, shift), maskOf(count));
      this.bitCount -= count;
      this.acc = OpCodes.AndN(this.acc, maskOf(this.bitCount));
      return value;
    }

    // Discards any bits pending from a partially-consumed word - used before
    // reading the raw extension bytes that follow a long-match symbol.
    alignToRawBytes() {
      this.acc = 0;
      this.bitCount = 0;
    }

    readRawByte() {
      if (this.pos >= this.bytes.length) throw new Error('Xpress: unexpected end of compressed data');
      return this.bytes[this.pos++];
    }

    readRawUint16LE() {
      const lo = this.readRawByte();
      const hi = this.readRawByte();
      return OpCodes.Or32(lo, OpCodes.Shl32(hi, 8));
    }

    readRawUint32LE() {
      const b0 = this.readRawByte();
      const b1 = this.readRawByte();
      const b2 = this.readRawByte();
      const b3 = this.readRawByte();
      return OpCodes.ToUint32(OpCodes.Or32(OpCodes.Or32(b0, OpCodes.Shl32(b1, 8)), OpCodes.Or32(OpCodes.Shl32(b2, 16), OpCodes.Shl32(b3, 24))));
    }
  }

  // ===== CANONICAL HUFFMAN TREE (generic, symbol-count agnostic) =====

  class HuffmanTree {
    constructor() {
      this.root = null;
      this.codes = null;
    }

    static buildFromLengths(lengths) {
      const tree = new HuffmanTree();
      let maxLen = 0;
      for (let i = 0; i < lengths.length; ++i) if (lengths[i] > maxLen) maxLen = lengths[i];
      if (maxLen === 0) return tree;

      const blCount = new Array(maxLen + 1).fill(0);
      for (let i = 0; i < lengths.length; ++i) if (lengths[i] > 0) blCount[lengths[i]]++;

      const nextCode = new Array(maxLen + 1).fill(0);
      let code = 0;
      for (let bits = 1; bits <= maxLen; ++bits) {
        code = OpCodes.ToUint32(OpCodes.Shl32(code + blCount[bits - 1], 1));
        nextCode[bits] = code;
      }

      const codes = new Array(lengths.length);
      tree.root = {};
      for (let symbol = 0; symbol < lengths.length; ++symbol) {
        const len = lengths[symbol];
        if (len === 0) continue;

        const symCode = nextCode[len]++;
        codes[symbol] = { code: symCode, length: len };

        let node = tree.root;
        for (let i = len - 1; i >= 0; --i) {
          const bit = OpCodes.AndN(OpCodes.Shr32(symCode, i), 1);
          const key = bit ? 'one' : 'zero';
          if (i === 0) {
            node[key] = { symbol: symbol };
          } else {
            if (!node[key]) node[key] = {};
            node = node[key];
          }
        }
      }

      tree.codes = codes;
      return tree;
    }

    // Symbol codes are written MSB-first (matching [MS-XCA]'s pseudocode WriteBits,
    // which shifts the accumulator left and ORs in new bits from the low end).
    encodeInto(writer, symbol) {
      const entry = this.codes && this.codes[symbol];
      if (!entry) throw new Error(`Xpress: no Huffman code for symbol ${symbol}`);
      writer.writeBits(entry.code, entry.length);
    }

    decode(reader) {
      let node = this.root;
      if (!node) throw new Error('Xpress: invalid Huffman tree');

      while (node.symbol === undefined) {
        const bit = reader.readBits(1);
        node = bit ? node.one : node.zero;
        if (!node) throw new Error('Xpress: invalid Huffman code in compressed data');
      }

      return node.symbol;
    }
  }

  // Builds a set of code lengths (<= MAX_CODE_LENGTH) from symbol frequencies using
  // a standard (simple, O(n^2 log n) for n<=512) Huffman merge.
  function buildLengthsFromFrequencies(freq) {
    const nodes = [];
    for (let i = 0; i < freq.length; ++i) {
      if (freq[i] > 0) nodes.push({ freq: freq[i], symbol: i, left: null, right: null });
    }

    if (nodes.length === 0) return new Array(freq.length).fill(0);

    if (nodes.length === 1) {
      const dummy = nodes[0].symbol === 0 ? 1 : 0;
      nodes.push({ freq: 0, symbol: dummy, left: null, right: null });
    }

    const queue = nodes.slice();
    while (queue.length > 1) {
      queue.sort((a, b) => a.freq - b.freq);
      const a = queue.shift();
      const b = queue.shift();
      queue.push({ freq: a.freq + b.freq, symbol: -1, left: a, right: b });
    }

    const lengths = new Array(freq.length).fill(0);
    (function assign(node, depth) {
      if (node.left === null && node.right === null) {
        lengths[node.symbol] = depth > 0 ? depth : 1;
        return;
      }
      assign(node.left, depth + 1);
      assign(node.right, depth + 1);
    })(queue[0], 0);

    return limitCodeLengths(lengths, MAX_CODE_LENGTH);
  }

  // Safety net: rebalances code lengths that exceed maxBits so the Kraft
  // inequality holds again, preserving relative ordering by original length.
  function limitCodeLengths(lengths, maxBits) {
    let maxLen = 0;
    for (let i = 0; i < lengths.length; ++i) if (lengths[i] > maxLen) maxLen = lengths[i];
    if (maxLen <= maxBits) return lengths;

    const original = lengths.slice();
    const adjusted = lengths.slice();
    for (let i = 0; i < adjusted.length; ++i) if (adjusted[i] > maxBits) adjusted[i] = maxBits;

    const blCount = new Array(maxBits + 1).fill(0);
    for (let i = 0; i < adjusted.length; ++i) if (adjusted[i] > 0) blCount[adjusted[i]]++;

    let kraft = 0;
    for (let bits = 1; bits <= maxBits; ++bits) kraft += blCount[bits] * Math.pow(2, maxBits - bits);
    const full = Math.pow(2, maxBits);

    let bits = maxBits - 1;
    while (kraft > full && bits > 0) {
      if (blCount[bits] === 0) { --bits; continue; }
      blCount[bits]--;
      blCount[bits + 1] += 2;
      kraft -= Math.pow(2, maxBits - bits - 1);
    }

    const symbols = [];
    for (let i = 0; i < adjusted.length; ++i) if (adjusted[i] > 0) symbols.push(i);
    symbols.sort((a, b) => original[a] - original[b] || a - b);

    const newLengths = new Array(lengths.length).fill(0);
    let idx = 0;
    for (let len = 1; len <= maxBits; ++len) {
      for (let c = 0; c < blCount[len]; ++c) newLengths[symbols[idx++]] = len;
    }

    return newLengths;
  }

  // ===== XPRESS ALGORITHM =====

  class XpressAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "Xpress";
      this.description = "Microsoft's Xpress LZ77+Huffman compression algorithm as used in WIM images, NTFS/WOF compression and remote-protocol payloads. Processes data in independent 64KB chunks, each prefixed with a 512-symbol canonical Huffman table.";
      this.inventor = "Microsoft Corporation";
      this.year = 2003;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Hybrid";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("[MS-XCA]: Xpress Compression Algorithm", "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8"),
        new LinkItem("[MS-XCA] 2.1 LZ77+Huffman Compression Algorithm Details", "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/c0244bfe-fd96-4fe5-97dd-39b9fc99b801"),
        new LinkItem("[MS-XCA] 2.1.4.3 Final Encoding Phase", "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/c7ec7ba9-ca8f-448f-bb85-027c1516db1c")
      ];

      this.references = [
        new LinkItem("Xpress (LZXPRESS) family overview - Wikipedia", "https://en.wikipedia.org/wiki/Xpress_(compression_algorithm)"),
        new LinkItem("libfwnt compression format notes (independent reverse-engineering)", "https://github.com/libyal/libfwnt/blob/main/documentation/Compression%20methods.asciidoc"),
        new LinkItem("cifs-protocol mailing list: MS-XCA LZ77+Huffman clarifications", "https://www.mail-archive.com/cifs-protocol@lists.samba.org/msg01150.html")
      ];

      // Round-trip-only test vectors (compression output is implementation-defined;
      // only faithful decompression of our own encoder's output is verified).
      this.tests = [
        new TestCase(
          [],
          [],
          "Xpress LZ77+Huffman round-trip - empty input",
          "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("X"),
          [],
          "Xpress LZ77+Huffman round-trip - single byte",
          "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8"
        ),
        new TestCase(
          (() => { const b = []; for (let i = 0; i < 5000; ++i) b.push(0x61); return b; })(),
          [],
          "Xpress LZ77+Huffman round-trip - long repetitive run",
          "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8"
        ),
        new TestCase(
          (() => { const b = []; for (let i = 0; i < 1000; ++i) b.push(i % 2 === 0 ? 0x41 : 0x42); return b; })(),
          [],
          "Xpress LZ77+Huffman round-trip - alternating byte pattern",
          "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("The 0x100 byte encodes a match of distance 1, length 3, and is also used as an EOF marker in the Xpress LZ77+Huffman format."),
          [],
          "Xpress LZ77+Huffman round-trip - spec-flavoured text",
          "https://www.mail-archive.com/cifs-protocol@lists.samba.org/msg01150.html"
        ),
        new TestCase(
          (() => {
            // Deterministic pseudo-random binary sample crossing a 64KB chunk boundary.
            const b = [];
            let s = 0xC0FFEE;
            for (let i = 0; i < 70000; ++i) {
              s = OpCodes.AndN(s * 1103515245 + 12345, 0x7fffffff);
              b.push(s % 256);
            }
            return b;
          })(),
          [],
          "Xpress LZ77+Huffman round-trip - pseudo-random binary sample spanning multiple chunks",
          "https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new XpressInstance(this, isInverse);
    }
  }

  class XpressInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      // Avoid Array.prototype.push(...data): the spread form blows the engine's
      // call-argument limit for large inputs (tens of thousands of bytes).
      for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data[i]);
    }

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
      const output = [];
      output.push(OpCodes.AndN(data.length, 0xFF));
      output.push(OpCodes.AndN(OpCodes.Shr32(data.length, 8), 0xFF));
      output.push(OpCodes.AndN(OpCodes.Shr32(data.length, 16), 0xFF));
      output.push(OpCodes.AndN(OpCodes.Shr32(data.length, 24), 0xFF));

      for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
        const chunk = data.slice(offset, Math.min(offset + CHUNK_SIZE, data.length));
        const payload = this._compressChunk(chunk);

        output.push(OpCodes.AndN(payload.length, 0xFF));
        output.push(OpCodes.AndN(OpCodes.Shr32(payload.length, 8), 0xFF));
        output.push(OpCodes.AndN(OpCodes.Shr32(payload.length, 16), 0xFF));
        output.push(OpCodes.AndN(OpCodes.Shr32(payload.length, 24), 0xFF));
        for (let i = 0; i < payload.length; ++i) output.push(payload[i]);
      }

      return output;
    }

    // Design note on the length-nibble formula:
    // [MS-XCA]'s published pseudocode for "2.1.4.3 Final Encoding Phase" computes
    // MatchSymbolValue = 256 + min(Length,15) + 16*GetHighBit(Distance) using the
    // *raw* match Length, and only afterwards performs "Length = Length - 3" for the
    // extension bytes. Read literally that would make the match-symbol's low nibble
    // equal to min(rawLength,15) rather than min(rawLength-3,15), which contradicts
    // both the spec's own prose ("if length is less than 18, the decoder ... tak[es]
    // the lower 4 bits and add[s] 3") and a real captured example on the
    // cifs-protocol mailing list, where a (distance=1, length=3) match is shown to
    // encode as exactly symbol 0x100 (256 + 0 + 16*0) - only possible if the nibble
    // is (length-3), not length. This implementation therefore performs the "-3"
    // adjustment before computing the nibble/symbol, which reproduces that captured
    // example's symbol value AND its multi-byte length-extension bytes exactly.
    _compressChunk(chunk) {
      const { tokens, freq } = this._tokenizeChunk(chunk);

      // Append the informational EOF symbol (distance=1, length=3) the spec
      // recommends; harmless for decoding since chunk length is tracked externally.
      tokens.push({ type: 'match', distance: 1, length: 3 });
      freq[256]++;

      const lengths = buildLengthsFromFrequencies(freq);
      const tree = HuffmanTree.buildFromLengths(lengths);

      const header = new Array(TABLE_BYTES);
      for (let i = 0; i < TABLE_BYTES; ++i) {
        const evenLen = OpCodes.AndN(lengths[i * 2], 0xF);
        const oddLen = OpCodes.AndN(lengths[i * 2 + 1], 0xF);
        header[i] = OpCodes.AndN(OpCodes.Or32(evenLen, OpCodes.Shl32(oddLen, 4)), 0xFF);
      }

      const writer = new XpressBitWriter();
      for (let t = 0; t < tokens.length; ++t) {
        const token = tokens[t];
        if (token.type === 'literal') {
          tree.encodeInto(writer, token.value);
          continue;
        }

        const adjLength = token.length - MIN_MATCH;
        const nibble = Math.min(adjLength, 15);
        const highBit = getHighBit(token.distance);
        const symbol = 256 + nibble + 16 * highBit;
        tree.encodeInto(writer, symbol);

        if (nibble === 15) {
          const ext = adjLength - 15;
          if (ext < 255) {
            writer.writeRawByte(ext);
          } else {
            writer.writeRawByte(255);
            if (adjLength < 65536) {
              writer.writeRawUint16LE(adjLength);
            } else {
              writer.writeRawUint16LE(0);
              writer.writeRawUint32LE(adjLength);
            }
          }
        }

        if (highBit > 0) {
          writer.writeBits(token.distance - OpCodes.Shl32(1, highBit), highBit);
        }
      }
      writer.flush();

      return header.concat(writer.bytes);
    }

    _tokenizeChunk(chunk) {
      const tokens = [];
      const freq = new Array(SYMBOL_COUNT).fill(0);
      const hashTable = new Map();
      let pos = 0;

      while (pos < chunk.length) {
        let bestMatch = null;

        if (pos + MIN_MATCH <= chunk.length) {
          const hash = this._hash3(chunk, pos);
          const positions = hashTable.get(hash);

          if (positions) {
            let attempts = 0;
            for (let i = positions.length - 1; i >= 0 && attempts < MAX_CHAIN; --i, ++attempts) {
              const matchPos = positions[i];
              const len = this._matchLength(chunk, matchPos, pos);
              if (len >= MIN_MATCH && (!bestMatch || len > bestMatch.length)) {
                bestMatch = { distance: pos - matchPos, length: len };
                if (len >= chunk.length - pos) break;
              }
            }
          }

          if (!hashTable.has(hash)) hashTable.set(hash, []);
          hashTable.get(hash).push(pos);
        }

        if (bestMatch) {
          tokens.push({ type: 'match', distance: bestMatch.distance, length: bestMatch.length });
          freq[256 + Math.min(bestMatch.length - MIN_MATCH, 15) + 16 * getHighBit(bestMatch.distance)]++;
          pos += bestMatch.length;
        } else {
          tokens.push({ type: 'literal', value: chunk[pos] });
          freq[chunk[pos]]++;
          ++pos;
        }
      }

      return { tokens, freq };
    }

    _hash3(data, pos) {
      const h = data[pos] * 33 * 33 + data[pos + 1] * 33 + data[pos + 2];
      return h % 8192;
    }

    _matchLength(data, matchPos, pos) {
      let len = 0;
      const maxLen = data.length - pos;
      while (len < maxLen && data[matchPos + len] === data[pos + len]) ++len;
      return len;
    }

    // ===== DECOMPRESSION =====

    _decompress(data) {
      if (data.length === 0) return [];

      const totalLen = OpCodes.Or32(OpCodes.Or32(data[0], OpCodes.Shl32(data[1], 8)), OpCodes.Or32(OpCodes.Shl32(data[2], 16), OpCodes.Shl32(data[3], 24)));
      const output = [];
      let pos = 4;

      while (output.length < totalLen) {
        const chunkLen = OpCodes.Or32(OpCodes.Or32(data[pos], OpCodes.Shl32(data[pos + 1], 8)), OpCodes.Or32(OpCodes.Shl32(data[pos + 2], 16), OpCodes.Shl32(data[pos + 3], 24)));
        pos += 4;
        const chunkEnd = pos + chunkLen;
        const chunkTarget = Math.min(output.length + CHUNK_SIZE, totalLen);

        this._decompressChunk(data, pos, output, chunkTarget);
        pos = chunkEnd;
      }

      return output;
    }

    _decompressChunk(data, startPos, output, chunkTarget) {
      const lengths = new Array(SYMBOL_COUNT);
      for (let i = 0; i < TABLE_BYTES; ++i) {
        const byte = data[startPos + i];
        lengths[i * 2] = OpCodes.AndN(byte, 0xF);
        lengths[i * 2 + 1] = OpCodes.AndN(OpCodes.Shr32(byte, 4), 0xF);
      }

      const tree = HuffmanTree.buildFromLengths(lengths);
      const reader = new XpressBitReader(data, startPos + TABLE_BYTES);

      while (output.length < chunkTarget) {
        const symbol = tree.decode(reader);

        if (symbol < 256) {
          output.push(symbol);
          continue;
        }

        const rel = symbol - 256;
        const nibble = OpCodes.AndN(rel, 0xF);
        const highBit = OpCodes.Shr32(rel, 4);

        let length;
        if (nibble < 15) {
          length = nibble + MIN_MATCH;
        } else {
          reader.alignToRawBytes();
          const e = reader.readRawByte();
          if (e !== 255) {
            length = e + 15 + MIN_MATCH;
          } else {
            const v16 = reader.readRawUint16LE();
            if (v16 !== 0) {
              length = v16 + MIN_MATCH;
            } else {
              length = reader.readRawUint32LE() + MIN_MATCH;
            }
          }
        }

        const distance = highBit === 0 ? 1 : OpCodes.Shl32(1, highBit) + reader.readBits(highBit);

        let src = output.length - distance;
        if (src < 0) throw new Error('Xpress: invalid match distance in compressed data');

        const copyTarget = Math.min(output.length + length, chunkTarget);
        while (output.length < copyTarget) {
          output.push(output[src]);
          ++src;
        }
      }
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new XpressAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { XpressAlgorithm, XpressInstance };
}));
