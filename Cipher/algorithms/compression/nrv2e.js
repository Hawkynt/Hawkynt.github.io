/*
 * NRV2E (UCL / "Not Really Vanished" family) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * NRV2E LE32, matching the reference CompressionWorkbench encoder/decoder
 * (Compression.Core.Dictionary.Nrv2e) byte-for-byte. Structurally identical
 * to NRV2D (see nrv2d.js) in its offset varint (3 bits/iteration, length's
 * leading bit folded into the offset byte's inverted low bit) and the 0x500
 * far-offset bump; the two differ only in the match-length suffix, which is
 * cheapest for NRV2E when the offset repeats the previous match:
 *
 *   <Stream>   := <size:4 LE> [<bare NRV2E LE32 stream>]
 *   length: if m_len_initial == 1: m_len = 1 + readBit()      (1 or 2)
 *           else if readBit() == 1: m_len = 3 + readBit()     (3 or 4)
 *           else: m_len = NRV2B-style varint + 3               (>= 5)
 *   if distance > 0x500: m_len += 1     (far-match bonus)
 *   emitted bytes = m_len + 1
 *
 * References:
 * - UCL homepage: http://www.oberhumer.com/opensource/ucl/
 * - UCL source (ucl/src/n2e_d.c): https://github.com/korczis/ucl/blob/master/src/n2e_d.c
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

  /** @type {int32} */
  const MIN_EMITTED_LEN = 3;
  /** @type {int32} */
  const MAX_OFFSET = 0xFFFFFF;
  /** @type {int32} */
  const OFFSET_LARGE_THRESHOLD = 0x500;
  /** @type {int32} */
  const HASH_BITS = 16;
  /** @type {int32} */
  const HASH_SIZE = OpCodes.Shl32(1, HASH_BITS);
  /** @type {int32} */
  const CHAIN_LIMIT = 64;

  /**
   * @param {uint8[]} data - Bytes
   * @param {int32} pos - Position of the three hashed bytes
   * @returns {uint32} Bucket
   */
  function hash3(data, pos) {
    /** @type {uint32} */
    const h1 = OpCodes.Shl32(data[pos], 8);
    /** @type {uint32} */
    const h2 = OpCodes.Shl32(data[pos + 1], 4);
    /** @type {uint8} */
    const h3 = data[pos + 2];
    return OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(h1, h2), h3), HASH_SIZE - 1);
  }

  /**
   * @param {uint32} value - Value
   * @returns {int32} Index of the highest set bit, -1 for 0
   */
  function highestSetBitIndex(value) {
    /** @type {int32} */
    let index = -1;
    /** @type {uint32} */
    let v = value;
    while (v > 0) {
      v = OpCodes.Shr32(v, 1);
      index++;
    }
    return index;
  }

  // ── Bit-word encoder (32-bit LE words, MSB-first bit order) ───────────────
  //
  // A literal/offset byte must occupy the file position the decoder will be
  // at when it calls ReadByte, which happens right after a specific bit is
  // consumed. Since bits are buffered in 32-bit words, the byte's "epoch"
  // (which word's pending list it belongs to) is fixed by queuing the byte
  // BEFORE writing any bit whose flush could roll over to the next word.

  class Nrv2eEncoder {
    constructor() {
      /** @type {uint8[]} */
      this.bytes = [];
      /** @type {uint8[]} */
      this.pendingBytes = [];
      /** @type {uint32} */
      this.bitWord = 0;
      /** @type {int32} */
      this.bitsUsed = 0;
    }

    /**
     * @param {int32} bit - Bit (any non-zero value writes 1)
     */
    writeBit(bit) {
      this.bitWord = OpCodes.Or32(OpCodes.Shl32(this.bitWord, 1), bit ? 1 : 0);
      this.bitsUsed++;
      if (this.bitsUsed === 32) {
        this._flushWord();
      }
    }

    // NRV2B-style varint: for value >= 2, emit (data, continue=0) pairs from
    // msb-1 down to bit 0, with the trailing continue bit set to 1.
    /**
     * @param {uint32} value - Value >= 2
     */
    writeVarInt(value) {
      /** @type {int32} */
      const msb = highestSetBitIndex(value);
      for (let i = msb - 1; i >= 0; i--) {
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
        this.writeBit(i === 0 ? 1 : 0);
      }
    }

    /**
     * @param {uint8} value - Literal byte
     */
    emitLiteral(value) {
      this.pendingBytes.push(value);
      this.writeBit(1);
    }

    // Emits the NRV2D/E offset-varint bit pattern that decodes to
    // targetVarintValue, queuing offsetByte immediately before the final
    // break bit so its word-epoch matches the bit-word the decoder is
    // consuming when it calls ReadByte for the offset byte.
    // The iterations (data bit a, continue bit b, extra-data bit c or -1)
    // are found from the last one back and then emitted first to last.
    /**
     * @param {uint32} targetVarintValue - Value the decoder's varint must yield
     * @param {uint8} offsetByte - Offset byte read right after the final break bit
     */
    _emitOffsetVarint(targetVarintValue, offsetByte) {
      /** @type {int32[]} */
      const iterA = [];
      /** @type {int32[]} */
      const iterB = [];
      /** @type {int32[]} */
      const iterC = [];
      iterA.push(OpCodes.And32(targetVarintValue, 1)); // iter k (break)
      iterB.push(1);
      iterC.push(-1);
      /** @type {uint32} */
      let mOffPre = OpCodes.Shr32(targetVarintValue, 1);
      while (mOffPre > 1) {
        /** @type {uint32} */
        const c = OpCodes.And32(mOffPre, 1);
        /** @type {uint32} */
        const mOffAfterA = OpCodes.Add32(OpCodes.Shr32(mOffPre, 1), 1);
        /** @type {uint32} */
        const a = OpCodes.And32(mOffAfterA, 1);
        iterA.push(a);
        iterB.push(0);
        iterC.push(c);
        mOffPre = OpCodes.Shr32(mOffAfterA, 1);
      }
      if (mOffPre !== 1) {
        throw new Error("NRV2E varint encoder: failed to walk back to initial m_off=1.");
      }

      /** @type {int32[]} */
      const bits = [];
      for (let k = iterA.length - 1; k >= 0; k--) {
        bits.push(iterA[k]);
        bits.push(iterB[k]);
        if (iterC[k] >= 0) {
          bits.push(iterC[k]);
        }
      }

      for (let i = 0; i < bits.length - 1; i++) {
        this.writeBit(bits[i]);
      }
      this.pendingBytes.push(offsetByte);
      this.writeBit(bits[bits.length - 1]);
    }

    /**
     * @param {int32} offset - Match offset
     * @param {int32} length - Match length
     * @param {boolean} reuseLast - True to code the offset as "same as last"
     */
    emitMatch(offset, length, reuseLast) {
      this.writeBit(0); // match flag

      // UCL emits (m_len + 1) bytes; +1 more if offset > 0x500.
      /** @type {int32} */
      let bumpedLen = length - 1;
      if (offset > OFFSET_LARGE_THRESHOLD) {
        bumpedLen--;
      }
      if (bumpedLen < 1) {
        throw new Error("NRV2E: match too short to encode.");
      }
      /** @type {int32} */
      const mLen = bumpedLen;

      // m_len=1 -> init=1, X=0 ("10"); m_len=2 -> init=1, X=1 ("11");
      // m_len=3 -> init=0, Y=1, Z=0 ("010"); m_len=4 -> init=0, Y=1, Z=1 ("011");
      // m_len>=5 -> init=0, Y=0, varint(m_len-3).
      /** @type {int32} */
      let mLenInitial = 0;
      /** @type {int32[]} */
      const suffixBits = [];
      // -1 when no varint follows
      /** @type {int32} */
      let varintValue = -1;
      if (mLen === 1) {
        mLenInitial = 1; suffixBits.push(0);
      } else if (mLen === 2) {
        mLenInitial = 1; suffixBits.push(1);
      } else if (mLen === 3) {
        mLenInitial = 0; suffixBits.push(1); suffixBits.push(0);
      } else if (mLen === 4) {
        mLenInitial = 0; suffixBits.push(1); suffixBits.push(1);
      } else {
        mLenInitial = 0; suffixBits.push(0);
        varintValue = mLen - 3;
      }

      if (reuseLast) {
        this.writeBit(0); // offset varint value 2: A=0
        this.writeBit(1); // B (break)
        this.writeBit(mLenInitial);
      } else {
        /** @type {uint32} */
        const rawPre = OpCodes.Or32(OpCodes.Shl32(offset - 1, 1), 1 - mLenInitial);
        /** @type {uint32} */
        const byteVal = OpCodes.And32(rawPre, 0xFF);
        /** @type {uint32} */
        const varintForOff = OpCodes.Add32(OpCodes.Shr32(rawPre, 8), 3);
        this._emitOffsetVarint(varintForOff, byteVal);
      }

      for (let k = 0; k < suffixBits.length; k++) {
        this.writeBit(suffixBits[k]);
      }
      if (varintValue >= 0) {
        this.writeVarInt(varintValue);
      }
    }

    /**
     * @returns {uint8[]} All bytes written
     */
    finish() {
      if (this.bitsUsed > 0) {
        this.bitWord = OpCodes.Shl32(this.bitWord, 32 - this.bitsUsed);
        this._flushWord();
      } else if (this.pendingBytes.length > 0) {
        this._flushWord();
      }
      return this.bytes;
    }

    /** Emit the bit word, then the bytes queued behind it */
    _flushWord() {
      /** @type {uint8[]} */
      const w = OpCodes.Unpack32LE(this.bitWord);
      for (let i = 0; i < 4; i++) {
        this.bytes.push(w[i]);
      }
      for (let i = 0; i < this.pendingBytes.length; i++) {
        this.bytes.push(this.pendingBytes[i]);
      }
      /** @type {uint8[]} */
      const noPending = [];
      this.pendingBytes = noPending;
      this.bitWord = 0;
      this.bitsUsed = 0;
    }
  }

  // ── Bit-word decoder ────────────────────────────────────────────────────

  class Nrv2eDecoder {
    /**
     * @param {uint8[]} data - Bit words and bytes
     */
    constructor(data) {
      /** @type {uint8[]} */
      this.data = data;
      /** @type {int32} */
      this.pos = 0;
      /** @type {uint32} */
      this.bitWord = 0;
      /** @type {int32} */
      this.bitsLeft = 0;
      this._refillWord();
    }

    /**
     * @returns {uint32} Next bit
     */
    readBit() {
      if (this.bitsLeft === 0) {
        this._refillWord();
      }
      /** @type {uint32} */
      const bit = OpCodes.And32(OpCodes.Shr32(this.bitWord, 31), 1);
      this.bitWord = OpCodes.Shl32(this.bitWord, 1);
      this.bitsLeft--;
      return bit;
    }

    /**
     * @returns {uint8} Next byte of the byte stream
     */
    readByte() {
      if (this.pos >= this.data.length) {
        throw new Error("NRV2E: unexpected end of byte stream.");
      }
      return this.data[this.pos++];
    }

    /** Load the next 32-bit word, zero padded past the end */
    _refillWord() {
      // Mirrors the reference decoder's RefillWord exactly, including its
      // zero-padding of a short/absent final word.
      /** @type {int32} */
      const take = Math.min(4, this.data.length - this.pos);
      /** @type {uint8[]} */
      const pad = new Array(4);
      for (let i = 0; i < 4; i++) {
        pad[i] = 0;
      }
      if (take > 0) {
        for (let i = 0; i < take; i++) {
          pad[i] = this.data[this.pos + i];
        }
      }
      this.pos += take;
      this.bitWord = OpCodes.Pack32LE(pad[0], pad[1], pad[2], pad[3]);
      this.bitsLeft = 32;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class NRV2ECompression extends CompressionAlgorithm {
    constructor() {
      super();

      this.name = "NRV2E";
      this.description = "UCL library \"Not Really Vanished\" LZ77 variant 2E. Bit-tagged literal/match stream with an exponential-Golomb offset (with single-symbol repeat-offset shortcut) whose match-length code is cheapest when the offset repeats the previous match, used inside the UPX executable packer.";
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
        new LinkItem("NRV2E Decompressor (structure reference only)", "https://github.com/korczis/ucl/blob/master/src/n2e_d.c"),
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
          expected: [64, 0, 0, 0, 0, 0, 22, 181, 65, 1]
        },
        {
          text: "Text sample",
          uri: "http://www.oberhumer.com/opensource/ucl/",
          input: OpCodes.AnsiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox."),
          expected: [65, 0, 0, 0, 254, 255, 255, 255, 116, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 102, 111, 120, 32, 106, 117, 109, 112, 115, 32, 111, 118, 101, 114, 32, 184, 216, 251, 239, 61, 108, 97, 122, 121, 32, 100, 111, 103, 46, 27, 89, 46]
        }
      ];
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {NRV2EInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new NRV2EInstance(this, isInverse);
    }
  }

  class NRV2EInstance extends IAlgorithmInstance {
    /**
     * @param {NRV2ECompression} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - True to decompress
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
    }

    /**
     * Compress or decompress the collected input
     * @returns {uint8[]} Output bytes
     */
    Result() {
      /** @type {uint8[]} */
      let result;
      if (this.isInverse) {
        result = this._decompress(this.inputBuffer);
      } else {
        result = this._compress(this.inputBuffer);
      }
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;
      return result;
    }

    /**
     * @param {uint8[]} input - Input bytes
     * @returns {uint8[]} 4-byte LE size followed by the NRV2E stream
     */
    _compress(input) {
      /** @type {int32} */
      const n = input.length;
      /** @type {uint8[]} */
      const header = OpCodes.Unpack32LE(n);
      if (n === 0) {
        return header;
      }

      /** @type {Nrv2eEncoder} */
      const enc = new Nrv2eEncoder();
      /** @type {int32[]} */
      const head = new Int32Array(HASH_SIZE).fill(-1);
      /** @type {int32[]} */
      const prev = new Int32Array(n);

      /** @type {int32} */
      let lastMatchOffset = 0;
      /** @type {int32} */
      let pos = 0;

      while (pos < n) {
        /** @type {int32} */
        let bestLen = 0;
        /** @type {int32} */
        let bestOff = 0;

        if (pos + MIN_EMITTED_LEN <= n) {
          /** @type {uint32} */
          const h = hash3(input, pos);
          /** @type {int32} */
          let chainLen = 0;
          /** @type {int32} */
          const minPos = Math.max(0, pos - MAX_OFFSET);
          /** @type {int32} */
          let idx = head[h];

          while (idx >= minPos && chainLen < CHAIN_LIMIT) {
            /** @type {int32} */
            const off = pos - idx;
            if (off <= MAX_OFFSET && input[idx] === input[pos]) {
              /** @type {int32} */
              const maxLen = Math.min(n - pos, 1024);
              /** @type {int32} */
              let len = 0;
              while (len < maxLen && input[idx + len] === input[pos + len]) {
                len++;
              }
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

        // NRV2E length encoding is gap-free (min emitted length is 2 for
        // small offsets, 3 for offsets > 0x500); reject too-short matches
        // for far offsets so we never try to encode an unrepresentable length.
        if (bestLen >= MIN_EMITTED_LEN && !(bestOff > OFFSET_LARGE_THRESHOLD && bestLen < 3)) {
          /** @type {boolean} */
          const reuseLast = bestOff === lastMatchOffset;
          enc.emitMatch(bestOff, bestLen, reuseLast);
          lastMatchOffset = bestOff;

          for (let j = 1; j < bestLen && pos + j + MIN_EMITTED_LEN <= n; j++) {
            /** @type {uint32} */
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

      /** @type {uint8[]} */
      const body = enc.finish();
      return header.concat(body);
    }

    /**
     * @param {uint8[]} input - 4-byte LE size followed by the NRV2E stream
     * @returns {uint8[]} Decoded bytes
     */
    _decompress(input) {
      if (input.length < 4) {
        throw new Error("NRV2E: input smaller than 4-byte header.");
      }
      /** @type {uint32} */
      const targetSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (targetSize < 0) {
        throw new Error("NRV2E: negative decompressed size.");
      }
      /** @type {uint8[]} */
      const output = new Array(targetSize);
      if (targetSize === 0) {
        return output;
      }

      /** @type {Nrv2eDecoder} */
      const dec = new Nrv2eDecoder(input.slice(4));
      /** @type {int32} */
      let lastMatchOffset = 1; // UCL initialises last_m_off = 1.
      /** @type {int32} */
      let op = 0;

      while (op < targetSize) {
        /** @type {uint32} */
        let flag = dec.readBit();
        while (flag === 1) {
          /** @type {uint8} */
          const literal = dec.readByte();
          output[op++] = literal;
          if (op >= targetSize) {
            return output;
          }
          flag = dec.readBit();
        }

        // Offset varint: reads (data, continue, [extra-data]) per iteration.
        /** @type {uint32} */
        let mOff = 1;
        for (;;) {
          mOff = OpCodes.Or32(OpCodes.Shl32(mOff, 1), dec.readBit());
          if (mOff > MAX_OFFSET + 3) {
            throw new Error("NRV2E: lookbehind overrun.");
          }
          /** @type {uint32} */
          const stop = dec.readBit();
          if (stop === 1) {
            break;
          }
          mOff = OpCodes.Or32(OpCodes.Shl32(mOff - 1, 1), dec.readBit());
        }

        /** @type {int32} */
        let finalOff = 0;
        /** @type {uint32} */
        let mLen = 0;
        if (mOff === 2) {
          finalOff = lastMatchOffset;
          mLen = dec.readBit();
        } else {
          /** @type {uint8} */
          const b = dec.readByte();
          /** @type {uint32} */
          let raw = OpCodes.Or32(OpCodes.Shl32(mOff - 3, 8), b);
          // Low bit of raw becomes m_len's first bit (inverted).
          mLen = 1 - OpCodes.And32(raw, 1);
          raw = OpCodes.Shr32(raw, 1);
          finalOff = raw + 1;
          lastMatchOffset = finalOff;
        }

        // NRV2E length: m_len in {1,2} via 1+X; {3,4} via 3+Z; or varint+3 for >= 5.
        if (mLen !== 0) {
          /** @type {uint32} */
          const extra = dec.readBit();
          mLen = 1 + extra;
        } else {
          /** @type {uint32} */
          const pairBit = dec.readBit();
          if (pairBit === 1) {
            /** @type {uint32} */
            const extra = dec.readBit();
            mLen = 3 + extra;
          } else {
            mLen = 1;
            /** @type {uint32} */
            let more = 0;
            do {
              mLen = OpCodes.Or32(OpCodes.Shl32(mLen, 1), dec.readBit());
              more = dec.readBit();
            } while (more === 0);
            mLen += 3;
          }
        }

        if (finalOff > OFFSET_LARGE_THRESHOLD) {
          mLen++;
        }
        if (finalOff > op) {
          throw new Error("NRV2E: offset points before start of output.");
        }

        /** @type {int32} */
        const src = op - finalOff;
        /** @type {int32} */
        const totalToEmit = mLen + 1;
        for (let i = 0; i < totalToEmit && op < targetSize; i++) {
          output[op++] = output[src + i];
        }
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new NRV2ECompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { NRV2ECompression, NRV2EInstance };
}));
