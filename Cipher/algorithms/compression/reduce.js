/*
 * Reduce (ZIP Methods 2-5) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * PKWARE's ZIP "Reducing" method (based on SEA's algorithm from the ARC
 * archiver) combines two passes: a run-length pass that escapes repeated
 * runs of a single byte with a DLE marker byte, followed by a probabilistic
 * substitution pass. The probabilistic pass keeps, for every possible
 * "previous byte" context, an adaptive candidate list of up to 32 bytes that
 * are likely to follow it (a "follower set"). When the next byte is present
 * in the current context's follower set it is coded as a short index into
 * that set (with a move-to-front update); otherwise it is coded as a raw
 * byte, flagged by a single control bit.
 *
 * Note: PKWARE's original bit-level "compression factor" (1-4) format packs
 * the run length and back-reference distance together inside one control
 * byte using a factor-dependent bit split. This implementation captures the
 * two-stage structure described below (DLE run-length pre-pass followed by
 * adaptive follower-set substitution) with an explicit, simpler run-length
 * encoding rather than reproducing PKWARE's exact bit layout.
 *
 * Reference:
 *   PKWARE, Inc., ".ZIP File Format Specification" (APPNOTE.TXT), section
 *   describing compression methods 2-5 "Reducing" (factors 1-4).
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

  // ===== ALGORITHM IMPLEMENTATION =====

  const DLE = 0x90;
  const DLE_LITERAL_MARKER = 255; // reserved count value: "one literal DLE byte", never produced as a run-chunk count (chunk is capped at 256, so count never exceeds 254)
  const MAX_FOLLOWER_SET = 32;

  // ----- Bit-level stream helpers (MSB-first) -----

  class BitWriter {
    constructor() {
      this.bytes = [];
      this.cur = 0;
      this.nbits = 0;
    }

    writeBit(bit) {
      this.cur = OpCodes.Or32(OpCodes.Shl32(this.cur, 1), OpCodes.And32(bit, 1));
      this.nbits++;
      if (this.nbits === 8) {
        this.bytes.push(OpCodes.ToByte(this.cur));
        this.cur = 0;
        this.nbits = 0;
      }
    }

    writeBits(value, width) {
      for (let i = width - 1; i >= 0; i--) this.writeBit(OpCodes.And32(OpCodes.Shr32(value, i), 1));
    }

    finish() {
      if (this.nbits > 0) {
        this.cur = OpCodes.Shl32(this.cur, 8 - this.nbits);
        this.bytes.push(OpCodes.ToByte(this.cur));
        this.cur = 0;
        this.nbits = 0;
      }
      return this.bytes;
    }
  }

  class BitReader {
    constructor(bytes) {
      this.bytes = bytes;
      this.pos = 0;
    }

    readBit() {
      const byteIndex = Math.floor(this.pos / 8);
      const bitIndex = 7 - (this.pos % 8);
      const byteVal = byteIndex < this.bytes.length ? this.bytes[byteIndex] : 0;
      this.pos++;
      return OpCodes.And32(OpCodes.Shr32(byteVal, bitIndex), 1);
    }

    readBits(width) {
      let value = 0;
      for (let i = 0; i < width; i++) value = OpCodes.Or32(OpCodes.Shl32(value, 1), this.readBit());
      return value;
    }
  }

  // Minimal number of bits needed to represent values 0..(n-1).
  function bitsFor(n) {
    if (n <= 1) return 0;
    let bits = 0;
    let cap = 1;
    while (cap < n) { cap = OpCodes.Shl32(cap, 1); bits++; }
    return bits;
  }

  // Deterministic pseudo-random byte generator used only to build reproducible
  // binary test vectors below (no crypto dependency, no external randomness).
  // A classic 32-bit LCG, masked to 31 bits with OpCodes.And32 (equivalent to
  // the textbook "& 0x7fffffff" step, without writing a raw bit operator here).
  function pseudoRandomBytes(seed, count) {
    let s = seed;
    const out = [];
    for (let i = 0; i < count; i++) {
      s = OpCodes.And32(s * 1103515245 + 12345, 0x7fffffff);
      out.push(s % 256);
    }
    return out;
  }

  // Mixed text/binary generator: mostly a short ASCII cycle with pseudo-random
  // bytes interspersed, so both the DLE run-length pre-pass and the follower-set
  // stage see realistic non-repetitive structure alongside binary noise.
  function pseudoRandomMixedBytes(seed, count) {
    let s = seed;
    const out = [];
    for (let i = 0; i < count; i++) {
      if (i % 11 < 6) {
        out.push(0x61 + (i % 5));
      } else {
        s = OpCodes.And32(s * 1103515245 + 12345, 0x7fffffff);
        out.push(s % 256);
      }
    }
    return out;
  }

  /**
 * ReduceCompression - PKZIP "Reducing" (RLE + probabilistic follower sets)
 * @class
 * @extends {CompressionAlgorithm}
 */

  class ReduceCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Reduce";
        this.description = "PKZIP methods 2-5 (Reducing): a DLE-escaped run-length pre-pass followed by adaptive probabilistic substitution using per-byte 'follower sets' of up to 32 candidate successor bytes with move-to-front adaptation.";
        this.inventor = "Systems Enhancement Associates (SEA); adapted by PKWARE, Inc.";
        this.year = 1989;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary + RLE";
        this.securityStatus = null;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem(".ZIP File Format Specification (APPNOTE.TXT)", "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"),
          new LinkItem("ZIP (file format) - Wikipedia (Reducing method)", "https://en.wikipedia.org/wiki/ZIP_(file_format)"),
          new LinkItem("Move-to-front transform - Wikipedia (adaptive list technique)", "https://en.wikipedia.org/wiki/Move-to-front_transform")
        ];

        this.references = [
          new LinkItem("Info-ZIP unreduce.c (historical decoder notes)", "https://github.com/LuaDist/zziplib"),
          new LinkItem("ARC archiver history (original SEA reducing algorithm)", "https://en.wikipedia.org/wiki/ARC_(file_format)")
        ];

        // Test vectors - self-computed round-trip verification vectors produced by
        // this implementation. PKWARE's exact bit-level "compression factor" layout
        // is not reproduced (see file header note); these vectors validate the
        // documented two-stage structure (RLE pre-pass + follower-set coding).
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          },
          {
            text: "Repetitive input - 'AAAAAAAAAA'",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: OpCodes.AsciiToBytes("AAAAAAAAAA"),
            expected: [0,0,0,10,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,25,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,28,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,65,0]
          },
          {
            text: "Text sample - 'the quick brown fox'",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: OpCodes.AsciiToBytes("the quick brown fox"),
            expected: [0,0,0,19,0,0,0,19,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,13,197,137,152,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,92,129,107,0,18,0,91,192,5,148,22,48,1,32,0,0,72,2,119,120,0,23,80,91,192,5,160,22,144,1,110,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,116,0,4,4,64]
          },
          {
            // Regression vector: pseudo-random binary bytes reliably contain
            // 3-byte runs (birthday-bound over the RLE stage), which is
            // exactly the case that collided with the "literal DLE" marker
            // before the DLE_LITERAL_MARKER fix (see _rleEncode header note).
            text: "Pseudo-random binary sample (300 bytes, deterministic LCG)",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: pseudoRandomBytes(0x2468ace0, 300),
            expected: [0,0,1,44,0,0,0,208,18,64,1,0,224,20,0,80,1,64,9,0,224,20,0,80,1,64,0,0,1,64,0,0,1,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,12,2,1,224,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,12,3,2,64,0,0,0,0,0,0,0,0,0,0,0,40,16,8,0,44,4,20,24,28,12,60,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,192,0,0,0,129,64,16,10,0,1,18,68,98,8,4,129,24,130,129,8,132,34,18,153,140,128,17,146,2,25,68,97,5,34,73,8,1,50,8,200,134,64,8,96,10,0,100,2,0,4,4,145,0,9,40,8,18,128,66,32,4,112,72,0,144,9,0,128,128,146,0,32,6,80,2,37,0,130,2,9,0]
          },
          {
            // Regression vector: mostly ASCII with pseudo-random binary bytes
            // interspersed (including runs of exactly 3 identical bytes),
            // covering the same collision in a realistic mixed-content file.
            text: "Mixed text/binary sample (300 bytes, deterministic LCG)",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: pseudoRandomMixedBytes(0x2468ace0, 300),
            expected: [0,0,1,44,0,0,1,25,34,65,1,140,1,133,136,225,148,38,36,0,217,25,88,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,144,0,0,0,0,0,32,1,145,150,1,133,137,225,140,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,70,40,0,4,0,216,192,32,3,100,0,64,9,148,0,54,24,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,140,0,0,0,0,0,0,8,3,0,0,0,0,0,0,0,0,0,0,0,0,12,4,0,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,140,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,64,0,8,32,0,4,129,32,48,0,73,20,64,1,80,196,8,0,18,0,138,0,2,140,152,40,0,37,8,208,0,18,104,0,2,128,32,0,160,66,0,2,64,10,0,9,18,21,0,4,144,20,0,20,8,0,4,130,36,80,0,88,33,2,128,2,80,19,0,0,144,19,96,0,41,144,0,9,0,128,1,64,132,0,5,0,38,0,5,8,132,48,0,84,19,92,0,18,104,0,2,64,145,48,0,40,144,224]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new ReduceInstance(this, isInverse);
      }
    }

    class ReduceInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      // ----- Stage 1: DLE-escaped run-length pre-pass -----

      // Unambiguous DLE run-length encoder:
      //  - a literal DLE byte in the source is always written as DLE,0xFF
      //    (DLE_LITERAL_MARKER) - a fixed sentinel that the run-chunk branch
      //    below can never itself produce, so the decoder never has to guess
      //    which of the two DLE,count producers wrote a given pair
      //  - a run of length >=3 of any other byte v is written as v, then one
      //    or more (DLE, count) pairs, each pair repeating v (count+2) times;
      //    count is kept in 0..254 (chunk in 2..256) precisely so it can
      //    never collide with the reserved DLE_LITERAL_MARKER value
      //  - runs shorter than 3 are written literally (no escaping needed)
      //
      // Note: an earlier version of this encoder used count===0 for the
      // "literal DLE" marker, which collided with the legitimate 2-byte-run
      // chunk (chunk=2 => count=chunk-2=0) produced by the second branch.
      // Random/binary input hits the DLE byte value (0x90) roughly once
      // every 256 bytes, and 2-byte runs of an arbitrary byte are common, so
      // that collision reliably desynchronized the decoder on binary data
      // even though it never showed up on the empty/repetitive/text vectors.
      _rleEncode(data) {
        const out = [];
        let i = 0;
        while (i < data.length) {
          const v = data[i];
          let run = 1;
          while (i + run < data.length && data[i + run] === v) run++;

          if (v === DLE) {
            for (let k = 0; k < run; k++) { out.push(DLE); out.push(DLE_LITERAL_MARKER); }
            i += run;
            continue;
          }

          if (run < 3) {
            for (let k = 0; k < run; k++) out.push(v);
            i += run;
            continue;
          }

          out.push(v);
          let remaining = run - 1;
          while (remaining > 0) {
            const chunk = Math.min(remaining, 256);
            out.push(DLE);
            out.push(chunk - 2);
            remaining -= chunk;
          }
          i += run;
        }
        return out;
      }

      _rleDecode(data) {
        const out = [];
        let i = 0;
        let last = -1;
        while (i < data.length) {
          const b = data[i++];
          if (b !== DLE) {
            out.push(b);
            last = b;
          } else {
            const count = data[i++];
            if (count === DLE_LITERAL_MARKER) {
              out.push(DLE);
              last = DLE;
            } else {
              for (let k = 0; k < count + 2; k++) out.push(last);
            }
          }
        }
        return out;
      }

      // ----- Stage 2: adaptive follower-set probabilistic coding -----

      _buildFollowerSets(data) {
        const sets = [];
        for (let i = 0; i < 256; i++) sets.push([]);
        for (let i = 0; i < data.length - 1; i++) {
          const ctx = data[i];
          const next = data[i + 1];
          const set = sets[ctx];
          if (set.indexOf(next) === -1 && set.length < MAX_FOLLOWER_SET) set.push(next);
        }
        return sets;
      }

      _writeFollowerSets(writer, sets) {
        for (let ctx = 0; ctx < 256; ctx++) {
          const set = sets[ctx];
          writer.writeBits(set.length, 6);
          for (let i = 0; i < set.length; i++) writer.writeBits(set[i], 8);
        }
      }

      _readFollowerSets(reader) {
        const sets = [];
        for (let ctx = 0; ctx < 256; ctx++) {
          const n = reader.readBits(6);
          const set = [];
          for (let i = 0; i < n; i++) set.push(reader.readBits(8));
          sets.push(set);
        }
        return sets;
      }

      _probEncode(data, sets, writer) {
        let prev = 0;
        for (let i = 0; i < data.length; i++) {
          const b = data[i];
          const set = sets[prev];
          const idx = set.indexOf(b);
          if (set.length === 0) {
            writer.writeBits(b, 8);
          } else if (idx !== -1) {
            writer.writeBit(0);
            writer.writeBits(idx, bitsFor(set.length));
            set.splice(idx, 1);
            set.unshift(b);
          } else {
            writer.writeBit(1);
            writer.writeBits(b, 8);
          }
          prev = b;
        }
      }

      _probDecode(reader, sets, count) {
        const out = [];
        let prev = 0;
        for (let i = 0; i < count; i++) {
          const set = sets[prev];
          let b;
          if (set.length === 0) {
            b = reader.readBits(8);
          } else {
            const flag = reader.readBit();
            if (flag === 1) {
              b = reader.readBits(8);
            } else {
              const idx = reader.readBits(bitsFor(set.length));
              b = set[idx];
              set.splice(idx, 1);
              set.unshift(b);
            }
          }
          out.push(b);
          prev = b;
        }
        return out;
      }

      // ----- Compression -----

      _compress(data) {
        const rle = this._rleEncode(data);
        const sets = this._buildFollowerSets(rle);

        const writer = new BitWriter();
        this._writeFollowerSets(writer, sets);
        this._probEncode(rle, sets, writer);

        const output = [];
        output.push(...OpCodes.Unpack32BE(data.length));
        output.push(...OpCodes.Unpack32BE(rle.length));
        output.push(...writer.finish());
        return output;
      }

      // ----- Decompression -----

      _decompress(data) {
        if (data.length < 8) return [];

        const originalLength = OpCodes.Pack32BE(data[0], data[1], data[2], data[3]);
        const rleLength = OpCodes.Pack32BE(data[4], data[5], data[6], data[7]);
        if (originalLength === 0) return [];

        const reader = new BitReader(data.slice(8));
        const sets = this._readFollowerSets(reader);
        const rle = this._probDecode(reader, sets, rleLength);

        return this._rleDecode(rle).slice(0, originalLength);
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ReduceCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ReduceCompression, ReduceInstance };
}));
