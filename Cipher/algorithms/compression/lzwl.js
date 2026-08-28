/*
 * LZWL (Digram-Seeded LZW) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * LZWL is classic LZW whose initial dictionary is extended with the most
 * frequent byte digrams (overlapping consecutive byte pairs) found in the
 * input by an up-front frequency analysis. Seeding the dictionary this way
 * lets the encoder start emitting multi-byte codes immediately instead of
 * having to learn every digram from scratch, which speeds convergence on
 * digram-rich data (e.g. natural-language text) versus plain LZW.
 *
 * Encoding uses a (parentCode, childByte) trie exactly like classic LZW,
 * with a decoder-mirrored dictionary-size/code-width counter (the encoder
 * advances its own copy of "what the decoder's next free code and code
 * width will be" one step behind its own trie, since the decoder cannot
 * learn a new phrase until it has actually seen and emitted the code that
 * completes it) and a dedicated stop code for clean end-of-stream framing.
 * Bits are packed MSB-first.
 *
 * Wire format:
 *   bytes 0..3   - original (uncompressed) data length, 32-bit little-endian
 *                  (if 0, this is the entire output; nothing else follows)
 *   bytes 4..5   - digram table entry count N, 16-bit little-endian
 *   N * 2 bytes  - the digram table itself, one (a,b) byte pair per entry,
 *                  in descending-frequency order, digrams of equal frequency
 *                  in ascending digram value order (first byte high, second
 *                  byte low); these N digrams are pre-registered as codes
 *                  256..256+N-1, code 256+N is the stop code
 *   remainder    - the MSB-first-packed LZW code stream: codes 0..255 are
 *                  literal bytes, 256..256+N-1 are the seeded digrams,
 *                  256+N is the stop code, and any higher code is a phrase
 *                  the decoder itself has learned by the time it is used;
 *                  starts at 9-bit codes and widens by 1 bit whenever the
 *                  decoder's dictionary would otherwise overflow the
 *                  current width, up to a maximum of 16 bits (65536-entry
 *                  dictionary)
 *
 * References:
 * - LZWL (Wikipedia): https://en.wikipedia.org/wiki/LZWL
 * - Lempel-Ziv-Welch (base algorithm): https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CompressionAlgorithm, IAlgorithmInstance, LinkItem } = AlgorithmFramework;

  const MAX_BITS = 16;
  const MAX_DICT_SIZE = 65536; // 2 raised to the power of MAX_BITS
  const MAX_DIGRAMS = 128;

  // ===== BIT-LEVEL I/O (MSB-first) =====

  class BitWriter {
    constructor() {
      this.bytes = [];
      this.buffer = 0;
      this.bitCount = 0;
    }

    writeBit(bit) {
      this.buffer = this.buffer * 2 + bit;
      ++this.bitCount;
      if (this.bitCount === 8) {
        this.bytes.push(this.buffer);
        this.buffer = 0;
        this.bitCount = 0;
      }
    }

    writeBits(value, count) {
      for (let i = count - 1; i >= 0; --i)
        this.writeBit(OpCodes.GetBit(value, i) ? 1 : 0);
    }

    flush() {
      if (this.bitCount > 0) {
        this.buffer = OpCodes.Shl8(this.buffer, 8 - this.bitCount);
        this.bytes.push(this.buffer);
        this.buffer = 0;
        this.bitCount = 0;
      }
    }
  }

  class BitReader {
    constructor(bytes) {
      this.bytes = bytes;
      this.bitIndex = 0;
    }

    readBits(count) {
      let value = 0;
      for (let i = 0; i < count; ++i) {
        const byteIndex = Math.floor(this.bitIndex / 8);
        if (byteIndex >= this.bytes.length)
          throw new Error('Unexpected end of LZWL bitstream.');
        const bitInByte = this.bitIndex - byteIndex * 8;
        const bit = OpCodes.GetBit(this.bytes[byteIndex], 7 - bitInByte) ? 1 : 0;
        ++this.bitIndex;
        value = value * 2 + bit;
      }
      return value;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class LZWLCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "LZWL";
      this.description = "LZW whose initial dictionary is seeded with the input's most frequent byte digrams (found via an up-front frequency analysis), so common byte pairs get single codes from the start. Otherwise a standard trie-based LZW with a decoder-mirrored code-width counter and an explicit stop code.";
      this.inventor = "Jan Platos, Jiri Dvorsky, Vaclav Snasel";
      this.year = 2006;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.UNKNOWN;

      this.documentation = [
        new LinkItem("LZWL (Wikipedia)", "https://en.wikipedia.org/wiki/LZWL"),
        new LinkItem("Lempel-Ziv-Welch (base algorithm)", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch")
      ];

      this.references = [
        new LinkItem("LZW compression overview", "https://www.geeksforgeeks.org/computer-networks/lzw-lempel-ziv-welch-compression-technique/")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "https://en.wikipedia.org/wiki/LZWL",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single byte",
          uri: "https://en.wikipedia.org/wiki/LZWL",
          input: [0x41],
          expected: [1, 0, 0, 0, 0, 0, 32, 192, 0]
        },
        {
          text: "Highly repetitive input (256 'a' bytes)",
          uri: "https://en.wikipedia.org/wiki/LZWL",
          input: new Array(256).fill(0x61),
          expected: [0, 1, 0, 0, 1, 0, 97, 97, 128, 64, 160, 112, 72, 44, 26, 15, 8, 132, 194, 161, 112, 200, 108, 58, 31, 16, 136, 196, 162, 113, 72, 172, 14, 2]
        },
        {
          text: "All 256 byte values once each, in order",
          uri: "https://en.wikipedia.org/wiki/LZWL",
          input: (function() { const a = new Array(256); for (let i = 0; i < 256; ++i) a[i] = i; return a; })(),
          expected: [0, 1, 0, 0, 0, 0, 0, 0, 64, 64, 48, 32, 20, 12, 7, 4, 2, 65, 64, 176, 96, 52, 28, 15, 8, 4, 66, 65, 48, 160, 84, 44, 23, 12, 6, 67, 65, 176, 224, 116, 60, 31, 16, 8, 68, 66, 49, 32, 148, 76, 39, 20, 10, 69, 66, 177, 96, 180, 92, 47, 24, 12, 70, 67, 49, 160, 212, 108, 55, 28, 14, 71, 67, 177, 224, 244, 124, 63, 32, 16, 72, 68, 50, 33, 20, 140, 71, 36, 18, 73, 68, 178, 97, 52, 156, 79, 40, 20, 74, 69, 50, 161, 84, 172, 87, 44, 22, 75, 69, 178, 225, 116, 188, 95, 48, 24, 76, 70, 51, 33, 148, 204, 103, 52, 26, 77, 70, 179, 97, 180, 220, 111, 56, 28, 78, 71, 51, 161, 212, 236, 119, 60, 30, 79, 71, 179, 225, 244, 252, 127, 64, 32, 80, 72, 52, 34, 21, 12, 135, 68, 34, 81, 72, 180, 98, 53, 28, 143, 72, 36, 82, 73, 52, 162, 85, 44, 151, 76, 38, 83, 73, 180, 226, 117, 60, 159, 80, 40, 84, 74, 53, 34, 149, 76, 167, 84, 42, 85, 74, 181, 98, 181, 92, 175, 88, 44, 86, 75, 53, 162, 213, 108, 183, 92, 46, 87, 75, 181, 226, 245, 124, 191, 96, 48, 88, 76, 54, 35, 21, 140, 199, 100, 50, 89, 76, 182, 99, 53, 156, 207, 104, 52, 90, 77, 54, 163, 85, 172, 215, 108, 54, 91, 77, 182, 227, 117, 188, 223, 112, 56, 92, 78, 55, 35, 149, 204, 231, 116, 58, 93, 78, 183, 99, 181, 220, 239, 120, 60, 94, 79, 55, 163, 213, 236, 247, 124, 62, 95, 79, 183, 227, 245, 252, 255, 64, 0]
        },
        {
          // Regression/stress test for the digram-frequency-table tie-break:
          // this sample has many digrams tied on frequency, so it pins the
          // rule that equal frequencies are ordered by ascending digram value.
          text: "Every digram over 0x70..0x73 exactly twice - the frequency sort ties throughout, so the table pins the ascending-digram-value rule",
          uri: "https://en.wikipedia.org/wiki/LZWL",
          input: (function() {
            const a = [];
            for (let r = 0; r < 2; ++r)
              for (let i = 0; i < 4; ++i)
                for (let j = 0; j < 4; ++j) a.push(0x70 + i, 0x70 + j);
            return a;
          })(),
          expected: [64, 0, 0, 0, 16, 0, 112, 112, 112, 113, 112, 114, 112, 115, 113, 112, 113, 113, 113, 114, 113, 115, 114, 112, 114, 113, 114, 114, 114, 115, 115, 113, 115, 114, 115, 115, 115, 112, 128, 64, 96, 80, 56, 36, 22, 13, 7, 132, 66, 97, 80, 184, 124, 50, 27, 14, 136, 193, 33, 16, 200, 12, 22, 19, 13, 129, 65, 161, 82, 8, 244, 114, 32]
        },
        {
          text: "'the quick brown fox...' repeated 4 times (digram-sort tie-break stress test)",
          uri: "https://en.wikipedia.org/wiki/LZWL",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. ".repeat(4)),
          expected: [180, 0, 0, 0, 41, 0, 101, 32, 104, 101, 116, 104, 32, 116, 32, 98, 32, 100, 32, 102, 32, 106, 32, 108, 32, 111, 32, 113, 46, 32, 97, 122, 98, 114, 99, 107, 100, 111, 101, 114, 102, 111, 103, 46, 105, 99, 106, 117, 107, 32, 108, 97, 109, 112, 110, 32, 111, 103, 111, 118, 111, 119, 111, 120, 112, 115, 113, 117, 114, 32, 114, 111, 115, 32, 117, 105, 117, 109, 118, 101, 119, 110, 120, 32, 121, 32, 122, 121, 129, 64, 35, 209, 56, 172, 54, 55, 24, 136, 201, 162, 145, 121, 12, 106, 33, 3, 128, 194, 33, 146, 120, 124, 74, 115, 43, 145, 67, 160, 146, 9, 44, 26, 57, 7, 145, 199, 97, 50, 72, 252, 170, 119, 40, 130, 198, 97, 116, 249, 101, 14, 95, 70, 153, 82, 102, 180, 201, 197, 62, 45, 81, 159, 85, 39, 85, 105, 117, 22, 99, 72, 154, 82, 230, 244, 233, 213, 130, 123, 83, 16, 74, 64]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new LZWLInstance(this, isInverse);
    }
  }

  class LZWLInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
      this.inputBuffer = [];
      return result;
    }

    _compress(data) {
      const output = OpCodes.Unpack32LE(data.length);

      if (data.length === 0)
        return output;

      // Analyze digram (overlapping consecutive byte pair) frequencies.
      const digramFreq = new Array(65536).fill(0);
      for (let i = 0; i < data.length - 1; ++i) {
        const d = OpCodes.Pack16BE(data[i], data[i + 1]);
        ++digramFreq[d];
      }

      // Select every digram occurring at least twice, then order them most
      // frequent first, digrams of equal frequency by ascending 16-bit digram
      // value (first byte high, second byte low). Which 128 digrams survive
      // the cut and the code each one gets are therefore a function of the
      // data alone; the comparison never returns 0 for two different digrams,
      // so the result does not depend on whether the host sort is stable.
      let topDigrams = [];
      for (let d = 0; d < 65536; ++d) {
        if (digramFreq[d] >= 2)
          topDigrams.push(d);
      }
      topDigrams.sort((a, b) => digramFreq[a] !== digramFreq[b] ? digramFreq[b] - digramFreq[a] : a - b);
      if (topDigrams.length > MAX_DIGRAMS)
        topDigrams = topDigrams.slice(0, MAX_DIGRAMS);

      // Write digram table.
      for (let i = 0; i < 2; ++i) output.push(0); // placeholder, filled below
      const countBytes = OpCodes.Unpack16LE(topDigrams.length);
      output[output.length - 2] = countBytes[0];
      output[output.length - 1] = countBytes[1];
      for (const d of topDigrams) {
        const pair = OpCodes.Unpack16BE(d);
        output.push(pair[0], pair[1]);
      }

      // Build initial dictionary as a trie: (parentCode, childByte) -> code.
      // Codes 0-255 = single bytes. Codes 256..256+N-1 = digrams. Code
      // 256+N = stop code.
      const trie = new Map();
      let trieNextCode = 256;

      for (const d of topDigrams) {
        const pair = OpCodes.Unpack16BE(d);
        const key = pair[0] * 256 + pair[1];
        if (!trie.has(key))
          trie.set(key, trieNextCode);
        ++trieNextCode;
      }

      const stopCode = trieNextCode;
      ++trieNextCode;
      let decoderNextCode = trieNextCode;
      let hasPrevious = false;

      let codeWidth = 9;
      while (OpCodes.Shl32(1, codeWidth) < trieNextCode)
        ++codeWidth;

      // LZW encode using the trie.
      const writer = new BitWriter();
      let currentCode = data[0];
      let i = 1;

      while (i < data.length) {
        const nextByte = data[i];
        const key = currentCode * 256 + nextByte;
        const existingCode = trie.get(key);

        if (existingCode !== undefined) {
          currentCode = existingCode;
          ++i;
          continue;
        }

        writer.writeBits(currentCode, codeWidth);

        if (trieNextCode < MAX_DICT_SIZE) {
          trie.set(key, trieNextCode);
          ++trieNextCode;
        }

        if (hasPrevious) {
          if (decoderNextCode < MAX_DICT_SIZE) {
            ++decoderNextCode;
            if (decoderNextCode >= OpCodes.Shl32(1, codeWidth) && codeWidth < MAX_BITS)
              ++codeWidth;
          }
        }
        hasPrevious = true;

        currentCode = nextByte;
        ++i;
      }

      writer.writeBits(currentCode, codeWidth);

      if (hasPrevious && decoderNextCode < MAX_DICT_SIZE) {
        ++decoderNextCode;
        if (decoderNextCode >= OpCodes.Shl32(1, codeWidth) && codeWidth < MAX_BITS)
          ++codeWidth;
      }

      writer.writeBits(stopCode, codeWidth);
      writer.flush();

      for (let k = 0; k < writer.bytes.length; ++k) output.push(writer.bytes[k]);

      return output;
    }

    _decompress(input) {
      const originalSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (originalSize === 0)
        return [];

      let offset = 4;
      const digramCount = OpCodes.Pack16LE(input[offset], input[offset + 1]);
      offset += 2;

      const dict = [];
      let nextCode = 0;
      for (let i = 0; i < 256; ++i)
        dict[nextCode++] = [i];

      for (let i = 0; i < digramCount; ++i) {
        const a = input[offset++];
        const b = input[offset++];
        dict[nextCode++] = [a, b];
      }

      const stopCode = nextCode++;

      let codeWidth = 9;
      while (OpCodes.Shl32(1, codeWidth) < nextCode)
        ++codeWidth;

      const reader = new BitReader(input.slice(offset));
      const result = [];

      const firstCode = reader.readBits(codeWidth);
      if (firstCode === stopCode || dict[firstCode] === undefined)
        return result;

      let prevEntry = dict[firstCode];
      for (let k = 0; k < prevEntry.length; ++k) result.push(prevEntry[k]);

      while (result.length < originalSize) {
        const code = reader.readBits(codeWidth);
        if (code === stopCode)
          break;

        let entry;
        if (dict[code] !== undefined) {
          entry = dict[code];
        } else if (code === nextCode) {
          // Classic LZW "KwKwK" case: the code refers to the entry that is
          // about to be created from the still-pending phrase.
          entry = prevEntry.concat([prevEntry[0]]);
        } else {
          throw new Error(`LZWL: unknown code ${code} at position ${result.length}.`);
        }

        for (let k = 0; k < entry.length; ++k) result.push(entry[k]);

        if (nextCode < MAX_DICT_SIZE) {
          dict[nextCode] = prevEntry.concat([entry[0]]);
          ++nextCode;
          if (nextCode >= OpCodes.Shl32(1, codeWidth) && codeWidth < MAX_BITS)
            ++codeWidth;
        }

        prevEntry = entry;
      }

      if (result.length > originalSize)
        result.length = originalSize;

      return result;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new LZWLCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LZWLCompression, LZWLInstance };
}));
