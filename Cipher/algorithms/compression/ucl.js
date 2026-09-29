/*
 * UCL (Universal Compression Library) NRV2B Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * UCL - NRV2B (Not Really Vanished 2B) compression algorithm
 * Created by Markus F.X.J. Oberhumer (same author as LZO)
 * Used in UPX (Ultimate Packer for eXecutables)
 *
 * NRV2B LE32, matching the reference CompressionWorkbench encoder/decoder
 * (Compression.Core.Dictionary.Nrv2b) byte-for-byte. Bits are packed into
 * 32-bit little-endian words and consumed MSB-first; literal and
 * match-offset bytes are inlined into the byte stream between bit-word
 * refills, in the order the decoder consumes them.
 *
 *   <Stream>   := <size:4 LE> [<bare NRV2B LE32 stream>]
 *   control bit 1 -> one literal byte follows
 *   control bit 0 -> a back-reference:
 *     offset varint: v = 1; repeat { v = v*2 + dataBit; } until stopBit == 1
 *       if v == 2: reuse the previous match's offset
 *       else: byte = nextByte(); distance = (v - 3) * 256 + byte + 1; remember it
 *     length: if readBit() == 0: m_len = 1
 *             else if readBit() == 0: m_len = 2
 *             else: m_len = varint + 2                          (>= 4)
 *     if distance > 0xD00: m_len += 1     (far-match bonus)
 *     emitted bytes = m_len + 2
 *
 * References:
 * - Official UCL Homepage: http://www.oberhumer.com/opensource/ucl/
 * - UCL source (ucl/src/n2b_d.c): https://github.com/korczis/ucl/blob/master/src/n2b_d.c
 * - UPX Homepage: https://upx.github.io/
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

  // ===== FORMAT CONSTANTS =====

  /** @type {int32} */
  const MIN_EMITTED_LEN = 3;
  /** @type {int32} */
  const MAX_OFFSET = 0xFFFFFF;
  /** @type {int32} */
  const OFFSET_LARGE_THRESHOLD = 0xD00;
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

  // NRV2B length encoding has a gap at m_len=3 (emitted size 5 when offset <=
  // 0xD00, 6 otherwise). Snap any proposed length landing in the gap to the
  // next-lower encodable length so the encoder never tries to emit an
  // unrepresentable size.
  /**
   * @param {int32} proposed - Match length
   * @param {int32} offset - Match offset
   * @returns {int32} An encodable length no longer than proposed
   */
  function snapToEncodable(proposed, offset) {
    /** @type {int32} */
    const effective = offset > OFFSET_LARGE_THRESHOLD ? proposed - 1 : proposed;
    /** @type {int32} */
    const mLen = effective - 2;
    if (mLen === 3) {
      return offset > OFFSET_LARGE_THRESHOLD ? 5 : 4;
    }
    return proposed;
  }

  // ── Bit-word encoder (32-bit LE words, MSB-first bit order) ───────────────
  //
  // A literal/offset byte must occupy the file position the decoder will be
  // at when it calls ReadByte, which happens right after a specific bit is
  // consumed. Since bits are buffered in 32-bit words, the byte's "epoch"
  // (which word's pending list it belongs to) is fixed by queuing the byte
  // BEFORE writing any bit whose flush could roll over to the next word.

  class Nrv2bEncoder {
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

    // For value >= 2, emit (data, continue=0) pairs from msb-1 down to bit 0,
    // with the trailing continue bit set to 1.
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

    // Writes all varint bits except the final continue bit; the caller
    // writes the trailing continue=1 bit after queuing any pending byte, so
    // the byte's epoch lines up with the word containing that final bit.
    /**
     * @param {uint32} value - Value >= 2
     */
    writeVarIntExceptFinalContinue(value) {
      /** @type {int32} */
      const msb = highestSetBitIndex(value);
      for (let i = msb - 1; i >= 1; i--) {
        this.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
        this.writeBit(0);
      }
      this.writeBit(OpCodes.And32(value, 1));
    }

    /**
     * @param {uint8} value - Literal byte
     */
    emitLiteral(value) {
      this.pendingBytes.push(value);
      this.writeBit(1);
    }

    /**
     * @param {int32} offset - Match offset
     * @param {int32} length - Match length
     * @param {boolean} reuseLast - True to code the offset as "same as last"
     */
    emitMatch(offset, length, reuseLast) {
      this.writeBit(0); // match flag

      if (reuseLast) {
        this.writeVarInt(2);
      } else {
        /** @type {int32} */
        const adjusted = offset - 1;
        /** @type {uint32} */
        const v = OpCodes.Add32(OpCodes.Shr32(adjusted, 8), 3);
        this.writeVarIntExceptFinalContinue(v);
        this.pendingBytes.push(OpCodes.And32(adjusted, 0xFF));
        this.writeBit(1); // final continue bit
      }

      /** @type {int32} */
      let emitted = length;
      if (offset > OFFSET_LARGE_THRESHOLD) {
        emitted--;
      }
      /** @type {int32} */
      const mLen = emitted - 2;
      if (mLen === 1) {
        this.writeBit(0);
      } else if (mLen === 2) {
        this.writeBit(1);
        this.writeBit(0);
      } else {
        if (mLen < 4) {
          throw new Error("NRV2B: unencodable match length 3 (encoder didn't snap).");
        }
        this.writeBit(1);
        this.writeBit(1);
        this.writeVarInt(mLen - 2);
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

  class Nrv2bDecoder {
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
        throw new Error("NRV2B: unexpected end of byte stream.");
      }
      return this.data[this.pos++];
    }

    /**
     * @returns {uint32} Next varint
     */
    readVarInt() {
      /** @type {uint32} */
      let v = 1;
      for (;;) {
        v = OpCodes.Or32(OpCodes.Shl32(v, 1), this.readBit());
        /** @type {uint32} */
        const stop = this.readBit();
        if (stop === 1) {
          return v;
        }
      }
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

  class UCLCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "UCL (NRV2B)";
      this.description = "Universal Compression Library implementing NRV2B algorithm. LZ77-based compression with a bit-packed 32-bit little-endian stream, offering better compression than LZO while maintaining fast decompression speed. Used extensively in UPX executable packer.";
      this.inventor = "Markus F.X.J. Oberhumer";
      this.year = 2004;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.AT; // Austria

      // Documentation and references
      this.documentation = [
        new LinkItem("Official UCL Homepage", "http://www.oberhumer.com/opensource/ucl/"),
        new LinkItem("UCL Wikipedia", "https://en.wikipedia.org/wiki/UCL_(data_compression_software)"),
        new LinkItem("UPX Homepage", "https://upx.github.io/")
      ];

      this.references = [
        new LinkItem("UCL Source Code Repository", "https://github.com/korczis/ucl"),
        new LinkItem("NRV2B Decompression Implementation", "https://github.com/korczis/ucl/blob/master/src/n2b_d.c"),
        new LinkItem("UPX Source Code", "https://github.com/upx/upx"),
        new LinkItem("Educational NRV Implementation", "https://github.com/pts/pts-decompress-nrv")
      ];

      // Test vectors (byte-for-byte against the reference NRV2B LE32 encoder)
      this.tests = [
        {
          text: "Empty input",
          uri: "https://github.com/korczis/ucl",
          input: [],
          expected: [0, 0, 0, 0]
        },
        {
          text: "Single byte 'A'",
          uri: "https://github.com/korczis/ucl/blob/master/src/n2b_d.c",
          input: OpCodes.AnsiToBytes("A"),
          roundTripOnly: true
        },
        {
          text: "Hello World",
          uri: "http://www.oberhumer.com/opensource/ucl/",
          input: OpCodes.AnsiToBytes("Hello World"),
          roundTripOnly: true
        },
        {
          text: "Repeated pattern AAABBBCCC",
          uri: "https://github.com/korczis/ucl",
          input: OpCodes.AnsiToBytes("AAABBBCCC"),
          roundTripOnly: true
        },
        {
          text: "Lorem ipsum text",
          uri: "http://www.oberhumer.com/opensource/ucl/",
          input: OpCodes.AnsiToBytes("Lorem ipsum dolor sit amet"),
          roundTripOnly: true
        },
        {
          text: "Large repetitive block (1200x 'A') - regression for match-length overflow",
          uri: "https://github.com/korczis/ucl",
          input: new Array(1200).fill(0x41),
          roundTripOnly: true
        }
      ];
    }

    /**
     * Create a new instance
     * @param {boolean} [isInverse=false] - True to decompress
     * @returns {UCLInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new UCLInstance(this, isInverse);
    }
  }

  // UCL NRV2B compression instance
  class UCLInstance extends IAlgorithmInstance {
    /**
     * @param {UCLCompression} algorithm - Parent algorithm
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
     * @returns {uint8[]} 4-byte LE size followed by the NRV2B stream
     */
    _compress(input) {
      /** @type {int32} */
      const n = input.length;
      /** @type {uint8[]} */
      const header = OpCodes.Unpack32LE(n);
      if (n === 0) {
        return header;
      }

      /** @type {Nrv2bEncoder} */
      const enc = new Nrv2bEncoder();
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

        // Large offsets require length >= 4 because the decoder's offset-threshold
        // length bump steals one byte from the encoded m_len (length 3 would need
        // encoded m_len=0, which isn't part of the encoding). Reject such short
        // matches with far offsets.
        if (bestLen >= MIN_EMITTED_LEN && !(bestOff > OFFSET_LARGE_THRESHOLD && bestLen < 4)) {
          bestLen = snapToEncodable(bestLen, bestOff);
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
     * @param {uint8[]} input - 4-byte LE size followed by the NRV2B stream
     * @returns {uint8[]} Decoded bytes
     */
    _decompress(input) {
      if (input.length < 4) {
        throw new Error("NRV2B: input smaller than 4-byte header.");
      }
      /** @type {uint32} */
      const targetSize = OpCodes.Pack32LE(input[0], input[1], input[2], input[3]);
      if (targetSize < 0) {
        throw new Error("NRV2B: negative decompressed size.");
      }
      /** @type {uint8[]} */
      const output = new Array(targetSize);
      if (targetSize === 0) {
        return output;
      }

      /** @type {Nrv2bDecoder} */
      const dec = new Nrv2bDecoder(input.slice(4));
      /** @type {int32} */
      let lastMatchOffset = 0;
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

        /** @type {uint32} */
        const mOff = dec.readVarInt();

        /** @type {int32} */
        let finalOff = 0;
        if (mOff === 2) {
          if (lastMatchOffset === 0) {
            throw new Error("NRV2B: reuse-last-offset before any match emitted.");
          }
          finalOff = lastMatchOffset;
        } else {
          /** @type {uint8} */
          const b = dec.readByte();
          /** @type {uint32} */
          const raw = OpCodes.Or32(OpCodes.Shl32(mOff - 3, 8), b);
          if (raw === 0xFFFFFFFF) {
            break;
          }
          finalOff = raw + 1;
          lastMatchOffset = finalOff;
        }

        /** @type {int32} */
        let mLen = 0;
        /** @type {uint32} */
        const lengthBit1 = dec.readBit();
        if (lengthBit1 === 0) {
          mLen = 1;
        } else {
          /** @type {uint32} */
          const lengthBit2 = dec.readBit();
          if (lengthBit2 === 0) {
            mLen = 2;
          } else {
            /** @type {uint32} */
            const lengthCode = dec.readVarInt();
            mLen = lengthCode + 2;
          }
        }

        if (finalOff > OFFSET_LARGE_THRESHOLD) {
          mLen++;
        }
        if (finalOff > op) {
          throw new Error("NRV2B: offset points before start of output.");
        }

        /** @type {int32} */
        const src = op - finalOff;
        /** @type {int32} */
        const totalToEmit = mLen + 2;
        for (let i = 0; i < totalToEmit && op < targetSize; i++) {
          output[op++] = output[src + i];
        }
      }

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new UCLCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { UCLCompression, UCLInstance };
}));
