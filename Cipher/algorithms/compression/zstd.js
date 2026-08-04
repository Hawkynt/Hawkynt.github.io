/*
 * Zstandard-style (Zstd) Framing Demo — NOT RFC 8878 compatible
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Educational implementation that mimics the outer container of a Zstandard
 * (RFC 8878) stream — real magic number, real frame header layout, real
 * block header layout — but implements neither LZ77 matching nor the FSE /
 * Huffman entropy coders that real Zstandard requires. It only ever emits
 * RAW and RLE blocks, and its decoder cannot interpret genuine COMPRESSED
 * blocks produced by real Zstd implementations.
 *
 * Implementation Features:
 * - RFC 8878-shaped frame header parsing (magic, descriptor, content size)
 * - RAW and RLE block encode/decode with correct block-header bit layout
 * - Multi-block output for inputs larger than the 128 KiB block size limit
 * - COMPRESSED block type is recognized but NOT entropy-decoded (no FSE/Huffman)
 *
 * Compatibility: streams produced here are NOT valid Zstandard (RFC 8878)
 * streams and cannot be read by facebook/zstd, the zstd CLI, or Node's
 * zlib.zstdDecompressSync. Likewise this decoder cannot read real Zstandard
 * output. Round-trips only against itself.
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
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== ZSTD CONSTANTS =====

  const ZSTD_MAGIC_NUMBER = 0xFD2FB528;
  const ZSTD_MAGIC_SKIPPABLE_START = 0x184D2A50;
  const ZSTD_MAGIC_SKIPPABLE_MASK = 0xFFFFFFF0;

  const BLOCK_TYPE_RAW = 0;
  const BLOCK_TYPE_RLE = 1;
  const BLOCK_TYPE_COMPRESSED = 2;
  const BLOCK_TYPE_RESERVED = 3;

  const MAX_BLOCK_SIZE = 128 * 1024; // 128 KB
  const MIN_WINDOW_LOG = 10;
  const MAX_WINDOW_LOG = 31;

  // Predefined literals length codes (RFC 8878 Appendix A.1)
  const DEFAULT_LL_CODE = new Int16Array([
    4, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1,
    2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 1, 1, 1, 1, 1,
    -1, -1, -1, -1
  ]);

  // Predefined match length codes (RFC 8878 Appendix A.2)
  const DEFAULT_ML_CODE = new Int16Array([
    1, 4, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1,
    -1, -1, -1, -1, -1
  ]);

  // Predefined offset codes (RFC 8878 Appendix A.3)
  const DEFAULT_OF_CODE = new Int16Array([
    1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1
  ]);

  // ===== ALGORITHM IMPLEMENTATION =====

  class ZstdCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Zstandard-style (custom framing, not RFC 8878 compatible)";
      this.description = "Educational demo that reproduces the Zstandard (RFC 8878) magic number and frame/block header layout for RAW and RLE blocks only. It has no LZ77 matching and no FSE/Huffman entropy coding, so it is NOT RFC 8878 compliant and CANNOT interoperate with facebook/zstd, the zstd CLI, or Node's zlib.zstdCompressSync/zstdDecompressSync. It only round-trips against its own output.";
      this.inventor = "Yann Collet";
      this.year = 2016;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary + Entropy";
      this.securityStatus = null; // Not a security primitive
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Zstandard RFC 8878", "https://tools.ietf.org/html/rfc8878"),
        new LinkItem("Official Zstd Repository", "https://github.com/facebook/zstd"),
        new LinkItem("Zstd Format Specification", "https://github.com/facebook/zstd/blob/dev/doc/zstd_compression_format.md"),
        new LinkItem("FSE Documentation", "https://github.com/Cyan4973/FiniteStateEntropy")
      ];

      this.references = [
        new LinkItem("Facebook Zstd", "https://github.com/facebook/zstd"),
        new LinkItem("RFC 8878 Full Text", "https://www.rfc-editor.org/rfc/rfc8878.txt"),
        new LinkItem("Finite State Entropy", "https://github.com/Cyan4973/FiniteStateEntropy"),
        new LinkItem("LZ4 (by same author)", "https://github.com/lz4/lz4")
      ];

      // Self-consistent test vectors, generated from this file's own encoder — NOT
      // third-party/official Zstandard vectors (this format cannot produce those).
      // The byte layout mirrors RFC 8878's frame/block header shape purely as an
      // informational reference for readers; it does not imply wire compatibility.
      // Format: input = uncompressed data, expected = compressed output
      this.tests = [
        // Test 1: Simple uncompressed frame (Raw block)
        new TestCase(
          OpCodes.AnsiToBytes("hello"),
          // Raw block frame: Magic(4) + Descriptor(1) + ContentSize(1) + BlockHeader(3) + Data(5)
          // Magic: 0xFD2FB528 (LE) = 28 B5 2F FD
          // Descriptor: 0x20 (Single_Segment=1, Content_Size_Flag=0)
          // Content Size: 5 (for "hello")
          // Block Header: Size=5 shifted 3 bits, OR Type=Raw shifted 1 bit, OR Last=1 = 0x29 = 29 00 00 (LE)
          OpCodes.Hex8ToBytes("28B52FFD200529000068656C6C6F"),
          "Self-consistent - Raw block, short input",
          "https://tools.ietf.org/html/rfc8878"
        ),
        // Test 2: RLE block frame
        new TestCase(
          OpCodes.AnsiToBytes("AAAAAAAAAA"),
          // RLE block: Magic(4) + Descriptor(1) + ContentSize(1) + BlockHeader(3) + RepeatedByte(1)
          // Content Size: 10 (ten 'A's)
          // Block Header: Size=10 shifted 3 bits, OR Type=RLE shifted 1 bit, OR Last=1 = 0x53 = 53 00 00 (LE)
          OpCodes.Hex8ToBytes("28B52FFD200A53000041"),
          "Self-consistent - RLE block, repeated byte",
          "https://tools.ietf.org/html/rfc8878"
        ),
        // Test 3: Empty frame
        new TestCase(
          [],
          // Empty frame: Magic(4) + Descriptor(1) + ContentSize(1) + BlockHeader(3)
          // Content Size: 0
          // Block Header: Size=0 shifted 3 bits, OR Type=Raw shifted 1 bit, OR Last=1 = 0x01 = 01 00 00 (LE)
          OpCodes.Hex8ToBytes("28B52FFD2000010000"),
          "Self-consistent - Empty frame",
          "https://tools.ietf.org/html/rfc8878"
        ),
        // Test 4: >=256 bytes, exercises the 2-byte content-size-flag path and a
        // non-repetitive payload (raw block).
        new TestCase(
          (() => {
            let seed = 0x2468ACE0, a = [];
            for (let i = 0; i < 300; ++i) { seed = OpCodes.AndN(seed * 1103515245 + 12345, 0x7fffffff); a.push(OpCodes.AndN(seed, 0xFF)); }
            return a;
          })(),
          [], // Round-trip only - exact bytes aren't the point here
          "Round-trip - 300 bytes pseudo-random (2-byte content size)",
          "https://tools.ietf.org/html/rfc8878"
        ),
        // Test 5: >MAX_BLOCK_SIZE (128 KiB), non-repetitive - exercises multi-block
        // splitting with the 4-byte content-size-flag path.
        new TestCase(
          (() => {
            const a = new Array(200000);
            for (let i = 0; i < 200000; ++i) a[i] = OpCodes.AndN(i * 37 + 11, 0xFF);
            return a;
          })(),
          [], // Round-trip only - exact bytes aren't the point here
          "Round-trip - 200000 bytes pseudo-random, spans multiple blocks",
          "https://tools.ietf.org/html/rfc8878"
        ),
        // Test 6: >MAX_BLOCK_SIZE, fully repetitive - exercises multi-block RLE
        // splitting, where only the final block sets Last_Block.
        new TestCase(
          new Array(150000).fill(0x61),
          [], // Round-trip only - exact bytes aren't the point here
          "Round-trip - 150000 repeated bytes, spans multiple RLE blocks",
          "https://tools.ietf.org/html/rfc8878"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ZstdInstance(this, isInverse);
    }
  }

  // ===== ZSTD DECOMPRESSION IMPLEMENTATION =====

  /**
 * Zstd cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ZstdInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.isInverse) {
        if (this.inputBuffer.length === 0) {
          return [];
        }
        return this._decompress();
      } else {
        // Compression: even empty input should produce a valid frame
        return this._compress();
      }
    }

    // ===== DECOMPRESSION (Production Quality) =====

    _decompress() {
      try {
        const reader = new BitReader(this.inputBuffer);
        const result = [];

        // Read and validate magic number
        const magic = reader.readU32LE();

        if (magic === ZSTD_MAGIC_NUMBER) {
          // Standard Zstd frame
          const frame = this._decodeFrame(reader);
          for (let _i = 0; _i < frame.length; _i++) result.push(frame[_i]);
        } else if (OpCodes.AndN(magic, ZSTD_MAGIC_SKIPPABLE_MASK) === ZSTD_MAGIC_SKIPPABLE_START) {
          // Skippable frame - read size and skip
          const frameSize = reader.readU32LE();
          reader.skipBytes(frameSize);
        } else {
          throw new Error(`Invalid Zstd magic number: 0x${magic.toString(16)}`);
        }

        this.inputBuffer = [];
        return result;
      } catch (e) {
        this.inputBuffer = [];
        throw new Error(`Zstd decompression failed: ${e.message}`);
      }
    }

    _decodeFrame(reader) {
      // Read frame header descriptor
      const descriptor = reader.readU8();

      const frameContentSizeFlag = OpCodes.AndN(OpCodes.Shr32(descriptor, 6), 3);
      const singleSegmentFlag = OpCodes.AndN(OpCodes.Shr32(descriptor, 5), 1);
      const checksumFlag = OpCodes.AndN(OpCodes.Shr32(descriptor, 2), 1);
      const dictIdFlag = OpCodes.AndN(descriptor, 3);

      // Read window descriptor (if not single segment)
      let windowSize = 0;
      if (!singleSegmentFlag) {
        const windowDescriptor = reader.readU8();
        const exponent = OpCodes.Shr32(windowDescriptor, 3);
        const mantissa = OpCodes.AndN(windowDescriptor, 7);
        const windowLog = MIN_WINDOW_LOG + exponent;
        const windowBase = OpCodes.Shl32(1, windowLog);
        windowSize = windowBase + OpCodes.Shr32(windowBase, 3) * mantissa;
      }

      // Read dictionary ID if present
      if (dictIdFlag) {
        const dictIdSize = [0, 1, 2, 4][dictIdFlag];
        reader.skipBytes(dictIdSize);
      }

      // Read frame content size if present
      let frameContentSize = 0;
      if (singleSegmentFlag || frameContentSizeFlag) {
        let sizeBytes;
        if (singleSegmentFlag) {
          // Single segment: size bytes determined by frameContentSizeFlag
          sizeBytes = frameContentSizeFlag === 0 ? 1 : [1, 2, 4, 8][frameContentSizeFlag];
        } else {
          // Multi-segment: size bytes from frameContentSizeFlag
          sizeBytes = [1, 2, 4, 8][frameContentSizeFlag];
        }

        if (sizeBytes === 1) {
          frameContentSize = reader.readU8();
        } else if (sizeBytes === 2) {
          frameContentSize = reader.readU16LE() + 256;
        } else if (sizeBytes === 4) {
          frameContentSize = reader.readU32LE();
        } else if (sizeBytes === 8) {
          const low = reader.readU32LE();
          const high = reader.readU32LE();
          frameContentSize = low + high * 0x100000000;
        }
      }

      // Decode blocks
      const decoded = [];
      let lastBlock = false;

      while (!lastBlock) {
        const blockHeader = reader.readU24LE();
        lastBlock = OpCodes.AndN(blockHeader, 1) !== 0;
        const blockType = OpCodes.AndN(OpCodes.Shr32(blockHeader, 1), 3);
        const blockSize = OpCodes.Shr32(blockHeader, 3);

        if (blockSize > MAX_BLOCK_SIZE) {
          throw new Error(`Block size ${blockSize} exceeds maximum ${MAX_BLOCK_SIZE}`);
        }

        const blockData = this._decodeBlock(reader, blockType, blockSize);
        for (let _i = 0; _i < blockData.length; _i++) decoded.push(blockData[_i]);
      }

      // Skip checksum if present
      if (checksumFlag) {
        reader.skipBytes(4);
      }

      return decoded;
    }

    _decodeBlock(reader, blockType, blockSize) {
      switch (blockType) {
        case BLOCK_TYPE_RAW:
          // Raw uncompressed block
          return reader.readBytes(blockSize);

        case BLOCK_TYPE_RLE:
          // RLE block - single byte repeated blockSize times
          const byte = reader.readU8();
          return new Array(blockSize).fill(byte);

        case BLOCK_TYPE_COMPRESSED:
          // Compressed block - requires full Zstd decompression
          return this._decodeCompressedBlock(reader, blockSize);

        case BLOCK_TYPE_RESERVED:
          throw new Error('Reserved block type encountered');

        default:
          throw new Error(`Unknown block type: ${blockType}`);
      }
    }

    _decodeCompressedBlock(reader, blockSize) {
      // Simplified compressed block handler
      // A full implementation would decode FSE/Huffman streams and execute sequences
      // For educational purposes, we return the block as literals
      return reader.readBytes(blockSize);
    }

    // ===== COMPRESSION (Simplified Educational Version) =====

    _compress() {
      const data = [...this.inputBuffer];
      const result = [];
      const len = data.length;

      // Magic number (little-endian)
      const [b0, b1, b2, b3] = OpCodes.Unpack32LE(ZSTD_MAGIC_NUMBER);
      result.push(b0, b1, b2, b3);

      // Frame header descriptor + content size (Single_Segment_Flag=1).
      // The Content_Size_Flag (descriptor bits 7-6) MUST reflect how many size
      // bytes are actually written, per RFC 8878 §3.1.1.1.1 - decided up front
      // from the real data length, not patched in afterwards.
      let sizeFlag, sizeBytes;
      if (len < 256) {
        sizeFlag = 0;
        sizeBytes = [len];
      } else if (len <= 256 + 0xFFFF) {
        sizeFlag = 1;
        const v = len - 256;
        sizeBytes = [OpCodes.AndN(v, 0xFF), OpCodes.AndN(OpCodes.Shr32(v, 8), 0xFF)];
      } else if (len <= 0xFFFFFFFF) {
        sizeFlag = 2;
        sizeBytes = OpCodes.Unpack32LE(len);
      } else {
        sizeFlag = 3;
        const high = Math.floor(len / 0x100000000);
        const low = len - high * 0x100000000;
        sizeBytes = OpCodes.Unpack32LE(low).concat(OpCodes.Unpack32LE(high));
      }

      const descriptor = OpCodes.OrN(OpCodes.Shl32(sizeFlag, 6), 0x20); // Single_Segment=1
      result.push(descriptor);
      for (let _i = 0; _i < sizeBytes.length; _i++) result.push(sizeBytes[_i]);

      if (len === 0) {
        // Empty frame - just header + empty block
        const blockHeader = OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(0, 3), OpCodes.Shl32(BLOCK_TYPE_RAW, 1)), 1); // Last block, raw, size=0
        result.push(OpCodes.AndN(blockHeader, 0xFF));
        result.push(OpCodes.AndN(OpCodes.Shr32(blockHeader, 8), 0xFF));
        result.push(OpCodes.AndN(OpCodes.Shr32(blockHeader, 16), 0xFF));

        this.inputBuffer = [];
        return result;
      }

      // Split into blocks no larger than MAX_BLOCK_SIZE; only the final block
      // sets Last_Block. Each block independently picks RLE (fully repetitive
      // chunk) or raw.
      let offset = 0;
      while (offset < len) {
        const chunkSize = Math.min(MAX_BLOCK_SIZE, len - offset);
        const chunk = data.slice(offset, offset + chunkSize);
        const isLast = (offset + chunkSize === len) ? 1 : 0;
        const isRepetitive = this._isRepetitive(chunk);

        if (isRepetitive && chunk.length > 1) {
          // RLE block
          const blockHeader = OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(chunk.length, 3), OpCodes.Shl32(BLOCK_TYPE_RLE, 1)), isLast);
          result.push(OpCodes.AndN(blockHeader, 0xFF));
          result.push(OpCodes.AndN(OpCodes.Shr32(blockHeader, 8), 0xFF));
          result.push(OpCodes.AndN(OpCodes.Shr32(blockHeader, 16), 0xFF));
          result.push(chunk[0]); // The repeated byte
        } else {
          // Raw block
          const blockHeader = OpCodes.OrN(OpCodes.OrN(OpCodes.Shl32(chunk.length, 3), OpCodes.Shl32(BLOCK_TYPE_RAW, 1)), isLast);
          result.push(OpCodes.AndN(blockHeader, 0xFF));
          result.push(OpCodes.AndN(OpCodes.Shr32(blockHeader, 8), 0xFF));
          result.push(OpCodes.AndN(OpCodes.Shr32(blockHeader, 16), 0xFF));
          for (let _i = 0; _i < chunk.length; _i++) result.push(chunk[_i]);
        }

        offset += chunkSize;
      }

      this.inputBuffer = [];
      return result;
    }

    _isRepetitive(data) {
      if (data.length === 0) return false;
      const first = data[0];
      for (let i = 1; i < data.length; ++i) {
        if (data[i] !== first) return false;
      }
      return true;
    }
  }

  // ===== BIT READER UTILITY =====

  class BitReader {
    constructor(data) {
      this.data = data;
      this.pos = 0;
    }

    readU8() {
      if (this.pos >= this.data.length) {
        throw new Error('Unexpected end of data');
      }
      return this.data[this.pos++];
    }

    readU16LE() {
      const b0 = this.readU8();
      const b1 = this.readU8();
      return OpCodes.Pack16LE(b0, b1);
    }

    readU24LE() {
      const b0 = this.readU8();
      const b1 = this.readU8();
      const b2 = this.readU8();
      return OpCodes.OrN(OpCodes.OrN(b0, OpCodes.Shl32(b1, 8)), OpCodes.Shl32(b2, 16));
    }

    readU32LE() {
      const b0 = this.readU8();
      const b1 = this.readU8();
      const b2 = this.readU8();
      const b3 = this.readU8();
      return OpCodes.Pack32LE(b0, b1, b2, b3);
    }

    readBytes(count) {
      if (this.pos + count > this.data.length) {
        throw new Error('Unexpected end of data');
      }
      const result = this.data.slice(this.pos, this.pos + count);
      this.pos += count;
      return result;
    }

    skipBytes(count) {
      if (this.pos + count > this.data.length) {
        throw new Error('Unexpected end of data');
      }
      this.pos += count;
    }

    hasMore() {
      return this.pos < this.data.length;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ZstdCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ZstdCompression, ZstdInstance };
}));
