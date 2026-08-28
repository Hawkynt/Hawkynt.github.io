/*
 * NRV2D (UCL / "Not Really Vanished" family) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * NRV2D LE32, matching the reference CompressionWorkbench encoder/decoder
 * (Compression.Core.Dictionary.Nrv2d) byte-for-byte. Bits are packed into
 * 32-bit little-endian words and consumed MSB-first; literal and
 * match-offset bytes are inlined into the byte stream between bit-word
 * refills, in the order the decoder consumes them.
 *
 *   <Stream>   := <size:4 LE> [<bare NRV2D LE32 stream>]
 *   control bit 1 -> one literal byte follows
 *   control bit 0 -> a back-reference:
 *     offset varint: m_off = 1; loop {
 *       m_off = m_off*2 + dataBit;
 *       if (stopBit) break;
 *       m_off = (m_off-1)*2 + extraDataBit;   // 3 bits/iteration, unlike
 *     }                                        // NRV2B's 2 bits/iteration
 *     if m_off == 2: reuse the previous match's offset, m_len_initial = readBit()
 *     else: byte = nextByte(); raw = (m_off-3)*256 + byte
 *           m_len_initial = ~raw & 1 (inverted low bit of raw)
 *           distance = (raw >> 1) + 1; remember it
 *     length: m_len = m_len_initial*2 + readBit()
 *       if m_len == 0: m_len = NRV2B-style varint + 2   (>= 4)
 *       else: m_len in {1, 2, 3}
 *     if distance > 0x500: m_len += 1     (far-match bonus)
 *     emitted bytes = m_len + 1
 *
 * References:
 * - UCL homepage: http://www.oberhumer.com/opensource/ucl/
 * - UCL source (ucl/src/n2d_d.c): https://github.com/korczis/ucl/blob/master/src/n2d_d.c
 * - UPX (uses UCL's NRV algorithms): https://upx.github.io/
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

  const MIN_EMITTED_LEN = 3;
  const MAX_OFFSET = 0xFFFFFF;
  const OFFSET_LARGE_THRESHOLD = 0x500;
  const HASH_BITS = 16;
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  const CHAIN_LIMIT = 64;

  function hash3(data, pos) {
    const h1 = OpCodes.Shl32(data[pos], 8);
    const h2 = OpCodes.Shl32(data[pos + 1], 4);
    const h3 = data[pos + 2];
    return OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(h1, h2), h3), HASH_SIZE - 1);
  }

  function highestSetBitIndex(value) {
    let index = -1, v = value;
    while (v > 0) { v = OpCodes.Shr32(v, 1); index++; }
    return index;
  }

  // ── Bit-word encoder (32-bit LE words, MSB-first bit order) ───────────────
  //
  // A literal/offset byte must occupy the file position the decoder will be
  // at when it calls ReadByte, which happens right after a specific bit is
  // consumed. Since bits are buffered in 32-bit words, the byte's "epoch"
  // (which word's pending list it belongs to) is fixed by queuing the byte
  // BEFORE writing any bit whose flush could roll over to the next word.

  class Nrv2dEncoder {
    constructor() {
      this.bytes = [];
      this.pendingBytes = [];
      this.bitWord = 0;
      this.bitsUsed = 0;
    }

    writeBit(bit) {
      this.bitWord = OpCodes.Or32(OpCodes.Shl32(this.bitWord, 1), bit ? 1 : 0);
      this.bitsUsed++;
      if (this.bitsUsed === 32) this._flushWord();
    }

    // NRV2B-style varint: for value >= 2, emit (data, continue=0) pairs from
    // msb-1 down to bit 0, with the trailing continue bit set to 1.
    writeVarInt(value) {
      const msb = highestSetBitIndex(value);
      for (let i = msb - 1; i >= 0; i--) {
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
        this.writeBit(i === 0 ? 1 : 0);
      }
    }

    emitLiteral(value) {
      this.pendingBytes.push(value);
      this.writeBit(1);
    }

    // Emits the NRV2D offset-varint bit pattern that decodes to
    // targetVarintValue, queuing offsetByte immediately before the final
    // break bit so its word-epoch matches the bit-word the decoder is
    // consuming when it calls ReadByte for the offset byte.
    _emitOffsetVarint(targetVarintValue, offsetByte) {
      const iterations = [[OpCodes.And32(targetVarintValue, 1), 1, null]]; // iter k (break)
      let mOffPre = OpCodes.Shr32(targetVarintValue, 1);
      while (mOffPre > 1) {
        const c = OpCodes.And32(mOffPre, 1);
        const mOffAfterA = OpCodes.Shr32(mOffPre, 1) + 1;
        const a = OpCodes.And32(mOffAfterA, 1);
        iterations.push([a, 0, c]);
        mOffPre = OpCodes.Shr32(mOffAfterA, 1);
      }
      if (mOffPre !== 1)
        throw new Error("NRV2D varint encoder: failed to walk back to initial m_off=1.");
      iterations.reverse();

      const bits = [];
      for (const [a, b, c] of iterations) {
        bits.push(a);
        bits.push(b);
        if (c !== null) bits.push(c);
      }

      for (let i = 0; i < bits.length - 1; i++) this.writeBit(bits[i]);
      this.pendingBytes.push(offsetByte);
      this.writeBit(bits[bits.length - 1]);
    }

    emitMatch(offset, length, reuseLast) {
      this.writeBit(0); // match flag

      // Final m_len (after the offset-bump compensation): UCL emits
      // (m_len + 1) bytes, and the decoder bumps m_len by 1 for far offsets.
      let bumpedLen = length - 1;
      if (offset > OFFSET_LARGE_THRESHOLD) bumpedLen--;
      if (bumpedLen < 1) throw new Error("NRV2D: match too short to encode.");
      const mLen = bumpedLen;

      // m_len=1 -> bits 01, m_len=2 -> 10, m_len=3 -> 11, m_len>=4 -> 00 + varint(m_len-2).
      let mLenInitial, mLenSecond, useVarint = false, varintValue = 0;
      switch (mLen) {
        case 1: mLenInitial = 0; mLenSecond = 1; break;
        case 2: mLenInitial = 1; mLenSecond = 0; break;
        case 3: mLenInitial = 1; mLenSecond = 1; break;
        default:
          mLenInitial = 0; mLenSecond = 0; useVarint = true;
          varintValue = mLen - 2;
          break;
      }

      if (reuseLast) {
        this.writeBit(0); // offset varint value 2: A=0
        this.writeBit(1); // B (break)
        this.writeBit(mLenInitial);
      } else {
        const rawPre = OpCodes.Or32(OpCodes.Shl32(offset - 1, 1), 1 - mLenInitial);
        const byteVal = OpCodes.And32(rawPre, 0xFF);
        const varintForOff = OpCodes.Shr32(rawPre, 8) + 3;
        this._emitOffsetVarint(varintForOff, byteVal);
      }

      this.writeBit(mLenSecond);
      if (useVarint) this.writeVarInt(varintValue);
    }

    finish() {
      if (this.bitsUsed > 0) {
        this.bitWord = OpCodes.Shl32(this.bitWord, 32 - this.bitsUsed);
        this._flushWord();
      } else if (this.pendingBytes.length > 0) {
        this._flushWord();
      }
      return this.bytes;
    }

    _flushWord() {
      const w = OpCodes.Unpack32LE(this.bitWord);
      for (let i = 0; i < 4; i++) this.bytes.push(w[i]);
      for (let i = 0; i < this.pendingBytes.length; i++) this.bytes.push(this.pendingBytes[i]);
      this.pendingBytes.length = 0;
      this.bitWord = 0;
      this.bitsUsed = 0;
    }
  }

  // ── Bit-word decoder ────────────────────────────────────────────────────

  class Nrv2dDecoder {
    constructor(data) {
      this.data = data;
      this.pos = 0;
      this.bitWord = 0;
      this.bitsLeft = 0;
      this._refillWord();
    }

    readBit() {
      if (this.bitsLeft === 0) this._refillWord();
      const bit = OpCodes.And32(OpCodes.Shr32(this.bitWord, 31), 1);
      this.bitWord = OpCodes.Shl32(this.bitWord, 1);
      this.bitsLeft--;
      return bit;
    }

    readByte() {
      if (this.pos >= this.data.length) throw new Error("NRV2D: unexpected end of byte stream.");
      return this.data[this.pos++];
    }

    _refillWord() {
      // Mirrors the reference decoder's RefillWord exactly, including its
      // zero-padding of a short/absent final word.
      const take = Math.min(4, this.data.length - this.pos);
      const pad = [0, 0, 0, 0];
      if (take > 0) for (let i = 0; i < take; i++) pad[i] = this.data[this.pos + i];
      this.pos += take;
      this.bitWord = OpCodes.Pack32LE(pad[0], pad[1], pad[2], pad[3]);
      this.bitsLeft = 32;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class NRV2DCompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "NRV2D";
      this.description = "UCL library \"Not Really Vanished\" LZ77 variant 2D. Bit-tagged literal/match stream with an exponential-Golomb offset (with single-symbol repeat-offset shortcut) and a two-tier length code, used inside the UPX executable packer.";
      this.inventor = "Markus F.X.J. Oberhumer";
      this.year = 1999;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.AT;

      this.documentation = [
        new LinkItem("Official UCL Homepage", "http://www.oberhumer.com/opensource/ucl/"),
        new LinkItem("UCL Wikipedia", "https://en.wikipedia.org/wiki/UCL_(data_compression_software)")
      ];

      this.references = [
        new LinkItem("UCL Source Code Repository", "https://github.com/korczis/ucl"),
        new LinkItem("NRV2D Decompressor (structure reference only)", "https://github.com/korczis/ucl/blob/master/src/n2d_d.c"),
        new LinkItem("UPX Homepage", "https://upx.github.io/")
      ];

      this.tests = [
        {
          text: "Empty input",
          uri: "http://www.oberhumer.com/opensource/ucl/",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Highly repetitive input (64 'A' bytes)",
          uri: "http://www.oberhumer.com/opensource/ucl/",
          input: new Array(64).fill(0x41),
          expected: [64, 0, 0, 0, 0, 0, 66, 181, 65, 1]
        },
        {
          text: "Text sample",
          uri: "http://www.oberhumer.com/opensource/ucl/",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox."),
          expected: [65, 0, 0, 0, 254, 255, 255, 255, 116, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 102, 111, 120, 32, 106, 117, 109, 112, 115, 32, 111, 118, 101, 114, 32, 24, 90, 246, 255, 60, 108, 97, 122, 121, 32, 100, 111, 103, 46, 27, 89, 46]
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new NRV2DInstance(this, isInverse);
    }
  }

  class NRV2DInstance extends IAlgorithmInstance {
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

    _compress(input) {
      const n = input.length;
      const header = OpCodes.Unpack32LE(n);
      if (n === 0) return header;

      const enc = new Nrv2dEncoder();
      const head = new Int32Array(HASH_SIZE).fill(-1);
      const prev = new Int32Array(n);

      let lastMatchOffset = 0;
      let pos = 0;

      while (pos < n) {
        let bestLen = 0, bestOff = 0;

        if (pos + MIN_EMITTED_LEN <= n) {
          const h = hash3(input, pos);
          let chainLen = 0;
          const minPos = Math.max(0, pos - MAX_OFFSET);
          let idx = head[h];

          while (idx >= minPos && chainLen < CHAIN_LIMIT) {
            const off = pos - idx;
            if (off <= MAX_OFFSET && input[idx] === input[pos]) {
              const maxLen = Math.min(n - pos, 1024);
              let len = 0;
              while (len < maxLen && input[idx + len] === input[pos + len]) len++;
              if (len >= MIN_EMITTED_LEN && len > bestLen) {
                bestLen = len;
                bestOff = off;
              }
            }
            idx = prev[idx];
            chainLen++;
          }
          prev[pos] = head[h];
          head[h] = pos;
        }

        // NRV2D length encoding is gap-free (min emitted length is 2 for
        // small offsets, 3 for offsets > 0x500); reject too-short matches
        // for far offsets so we never try to encode an unrepresentable length.
        if (bestLen >= MIN_EMITTED_LEN && !(bestOff > OFFSET_LARGE_THRESHOLD && bestLen < 3)) {
          const reuseLast = bestOff === lastMatchOffset;
          enc.emitMatch(bestOff, bestLen, reuseLast);
          lastMatchOffset = bestOff;

          for (let j = 1; j < bestLen && pos + j + MIN_EMITTED_LEN <= n; j++) {
            const h = hash3(input, pos + j);
            prev[pos + j] = head[h];
            head[h] = pos + j;
          }
          pos += bestLen;
        } else {
          enc.emitLiteral(input[pos]);
          pos++;
        }
      }

      return header.concat(enc.finish());
    }

    _decompress(input) {
      if (input.length < 4) throw new Error("NRV2D: input smaller than 4-byte header.");
      const targetSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (targetSize < 0) throw new Error("NRV2D: negative decompressed size.");
      if (targetSize === 0) return [];

      const dec = new Nrv2dDecoder(input.slice(4));
      const output = new Array(targetSize);
      let lastMatchOffset = 1; // UCL initialises last_m_off = 1.
      let op = 0;

      while (op < targetSize) {
        while (dec.readBit() === 1) {
          output[op++] = dec.readByte();
          if (op >= targetSize) return output;
        }

        // Offset varint: reads (data, continue, [extra-data]) per iteration.
        let mOff = 1;
        for (;;) {
          mOff = OpCodes.Or32(OpCodes.Shl32(mOff, 1), dec.readBit());
          if (mOff > MAX_OFFSET + 3) throw new Error("NRV2D: lookbehind overrun.");
          if (dec.readBit() === 1) break;
          mOff = OpCodes.Or32(OpCodes.Shl32(mOff - 1, 1), dec.readBit());
        }

        let finalOff, mLen;
        if (mOff === 2) {
          finalOff = lastMatchOffset;
          mLen = dec.readBit();
        } else {
          const b = dec.readByte();
          let raw = OpCodes.Or32(OpCodes.Shl32(mOff - 3, 8), b);
          // Low bit of raw becomes m_len's first bit (inverted).
          mLen = 1 - OpCodes.And32(raw, 1);
          raw = OpCodes.Shr32(raw, 1);
          finalOff = raw + 1;
          lastMatchOffset = finalOff;
        }

        mLen = OpCodes.Or32(OpCodes.Shl32(mLen, 1), dec.readBit());
        if (mLen === 0) {
          mLen = 1;
          do {
            mLen = OpCodes.Or32(OpCodes.Shl32(mLen, 1), dec.readBit());
          } while (dec.readBit() === 0);
          mLen += 2;
        }

        if (finalOff > OFFSET_LARGE_THRESHOLD) mLen++;
        if (finalOff > op) throw new Error("NRV2D: offset points before start of output.");

        const src = op - finalOff;
        const totalToEmit = mLen + 1;
        for (let i = 0; i < totalToEmit && op < targetSize; i++) output[op++] = output[src + i];
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new NRV2DCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { NRV2DCompression, NRV2DInstance };
}));
