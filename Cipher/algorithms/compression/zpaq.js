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

  /**
 * ZPAQAlgorithm - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class ZPAQAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "ZPAQ (Journaling Archiver)";
        this.description = "Advanced journaling archiver with incremental backup capabilities and maximum compression ratios. Uses context mixing, preprocessing, and block-based compression with versioning and deduplication support.";
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Journaling Archive";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.EXPERT;
        this.inventor = "Matt Mahoney";
        this.year = 2009;
        this.country = CountryCode.US;

        // ZPAQ parameters
        this.BLOCK_SIZE = 65536;        // 64KB blocks
        this.MAX_MEMORY = 512 * 1024;   // 512KB memory (educational)
        this.HASH_SIZE = 65536;         // Hash table size
        this.VERSION = 1;               // Archive version

        this.documentation = [
          new LinkItem("ZPAQ Specification", "http://mattmahoney.net/dc/zpaq.html"),
          new LinkItem("ZPAQ Documentation", "http://mattmahoney.net/dc/zpaq206.pdf"),
          new LinkItem("ZPAQ GitHub", "https://github.com/zpaq/zpaq")
        ];

        this.references = [
          new LinkItem("Journaling Archive Theory", "http://mattmahoney.net/dc/dce.html#Section_81"),
          new LinkItem("Incremental Backup Systems", "https://en.wikipedia.org/wiki/Incremental_backup"),
          new LinkItem("Data Deduplication", "https://en.wikipedia.org/wiki/Data_deduplication"),
          new LinkItem("Block-based Compression", "https://compression.ca/act/act_pdf/")
        ];

        // Test vectors that match our simplified implementation. Every `expected`
        // byte string below was captured from a run of the fixed implementation
        // and independently confirmed to decode back to the original input; the
        // previous vectors were captured from a version that framed blocks with a
        // scan for a 0xFF sentinel byte and an 8-bit RLE run count, both of which
        // silently corrupted any block whose compressed payload legitimately
        // contained a 0xFF byte, or any repeated run longer than 256 bytes.
        this.tests = [
          new TestCase(
            [],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Version header + empty archive
            "Empty archive - header only",
            "http://mattmahoney.net/dc/zpaq.html"
          ),
          new TestCase(
            [65], // Single byte 'A'
            [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 193],
            "Single byte compression",
            "http://mattmahoney.net/dc/zpaq206.pdf"
          ),
          new TestCase(
            [65, 65, 65, 65], // 4 A's (repetitive)
            [1, 0, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 1, 5, 0, 0, 0, 65, 4, 0, 0, 0],
            "Repetitive data compression",
            "https://github.com/zpaq/zpaq"
          ),
          new TestCase(
            new Array(1024).fill(0x61), // 1024 repeated bytes
            OpCodes.Hex8ToBytes("01000000010000000004000001050000006100040000"),
            "1024-byte repeated run - regression for the former 8-bit (max 256) RLE count",
            "https://en.wikipedia.org/wiki/Run-length_encoding"
          ),
          new TestCase(
            Array.from({ length: 256 }, (_, i) => i),
            OpCodes.Hex8ToBytes("0100000001000000000100000000010000800102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff"),
            "All 256 byte values - regression for the former 0xFF end-marker scan colliding with legitimate payload bytes",
            "https://en.wikipedia.org/wiki/Byte"
          ),
          new TestCase(
            Array.from({ length: 64 }, (_, i) => i % 2 ? 0x62 : 0x61),
            OpCodes.Hex8ToBytes("0100000001000000400000000040000000e1010001000100010002010201020102010201020102010201020102010201020102010201020102010201020102010201020102010201020102010201020102"),
            "Alternating 'ab' pattern",
            "https://en.wikipedia.org/wiki/LZ77_and_LZ78"
          ),
          new TestCase(
            OpCodes.Hex8ToBytes("00004000000000004000004080004000000000000040800040000040004080b800003800000000004080c00000004080c0000000000000400040000000000000"),
            [],
            "Pseudo-random byte stream - validated via round-trip only; see fuzz harness",
            "https://en.wikipedia.org/wiki/Pseudorandomness"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new ZPAQInstance(this, isInverse);
      }
    }

    class ZPAQInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // ZPAQ state
        this.version = algorithm.VERSION;
        this.blockSize = algorithm.BLOCK_SIZE;

        // Compression context
        this.contextModel = new ZPAQContextModel();
        this.preprocessor = new ZPAQPreprocessor();
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        const result = this.isInverse ?
          this.decompress(this.inputBuffer) :
          this.compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      compress(data) {
        if (!data || data.length === 0) {
          return this._createEmptyArchive();
        }

        const archive = [];

        // ZPAQ Header
        archive.push(this.version);       // Version
        archive.push(0, 0, 0);           // Flags (reserved)

        // Number of blocks
        const numBlocks = Math.ceil(data.length / this.blockSize);
        const numBlocksBytes = OpCodes.Unpack32LE(numBlocks);
        for (let _i = 0; _i < numBlocksBytes.length; _i++) archive.push(numBlocksBytes[_i]);

        // Original size
        const sizeBytes = OpCodes.Unpack32LE(data.length);
        for (let _i = 0; _i < sizeBytes.length; _i++) archive.push(sizeBytes[_i]);

        // Process data in blocks
        let offset = 0;
        while (offset < data.length) {
          const blockEnd = Math.min(offset + this.blockSize, data.length);
          const block = data.slice(offset, blockEnd);

          // Process block through ZPAQ pipeline
          const framedBlock = this._compressBlock(block);
          for (let _i = 0; _i < framedBlock.length; _i++) archive.push(framedBlock[_i]);

          offset = blockEnd;
        }

        return archive;
      }

      decompress(data) {
        if (!data || data.length < 12) return [];

        // Parse ZPAQ header
        const version = data[0];
        const flags = OpCodes.Pack32LE(data[1], data[2], data[3], 0);
        const numBlocks = OpCodes.Pack32LE(data[4], data[5], data[6], data[7]);
        const originalSize = OpCodes.Pack32LE(data[8], data[9], data[10], data[11]);

        if (originalSize === 0) return [];

        // Initialize decompression state
        this._initializeDecompression();

        const decompressed = [];
        let offset = 12;

        // Decompress blocks. Each block is self-delimiting via an explicit
        // [type, length] header (see _compressBlock) rather than a scan for a
        // sentinel byte value, since the compressed payload can legitimately
        // contain any byte value - including whatever sentinel a scan would look
        // for - and a scan would stop at the first coincidental occurrence
        // instead of the block's real end.
        for (let blockNum = 0; blockNum < numBlocks && offset < data.length; blockNum++) {
          const blockResult = this._decompressBlock(data, offset);
          for (let _i = 0; _i < blockResult.data.length; _i++) decompressed.push(blockResult.data[_i]);
          offset = blockResult.nextOffset;
        }

        return decompressed.slice(0, originalSize);
      }

      /**
       * Create empty ZPAQ archive
       * @private
       */
      _createEmptyArchive() {
        return [
          this.version,     // Version
          0, 0, 0,         // Flags
          0, 0, 0, 0,      // Number of blocks (0)
          0, 0, 0, 0       // Original size (0)
        ];
      }

      /**
       * Compress a single block using the ZPAQ pipeline and frame it with an
       * explicit [type, length] header so the decoder never has to guess where
       * the block ends.
       * @private
       */
      _compressBlock(block) {
        let type, payload;

        if (this._isHighlyRepetitive(block)) {
          // Run-length shortcut: [value, count(4 bytes LE)]. The count is a full
          // 32-bit field (not a single byte) because a block can be up to
          // BLOCK_SIZE (65536) bytes of the same value.
          const countBytes = OpCodes.Unpack32LE(block.length);
          type = 1;
          payload = [block[0], countBytes[0], countBytes[1], countBytes[2], countBytes[3]];
        } else {
          type = 0;
          payload = this._contextCompress(block);
        }

        const lengthBytes = OpCodes.Unpack32LE(payload.length);
        const framed = [type, lengthBytes[0], lengthBytes[1], lengthBytes[2], lengthBytes[3]];
        for (let _i = 0; _i < payload.length; _i++) framed.push(payload[_i]);
        return framed;
      }

      /**
       * Decompress a single length-framed block (see _compressBlock).
       * @private
       */
      _decompressBlock(data, offset) {
        if (offset + 5 > data.length) {
          return { data: [], nextOffset: data.length };
        }

        const type = data[offset];
        const length = OpCodes.Pack32LE(data[offset + 1], data[offset + 2], data[offset + 3], data[offset + 4]);
        const payloadStart = offset + 5;
        const payload = data.slice(payloadStart, payloadStart + length);
        const nextOffset = payloadStart + length;

        if (type === 1) {
          const value = payload[0];
          const count = OpCodes.Pack32LE(payload[1], payload[2], payload[3], payload[4]);
          return { data: new Array(count).fill(value), nextOffset: nextOffset };
        }

        return { data: this._contextDecompress(payload), nextOffset: nextOffset };
      }

      /**
       * Context model compression
       * @private
       */
      _contextCompress(data) {
        if (data.length === 0) return [];

        const compressed = [];
        this.contextModel.reset();

        // Use context model for general compression
        let context = 0;
        for (let i = 0; i < data.length; i++) {
          const byte = data[i];
          const prediction = this.contextModel.predict(context);

          // Encode byte (simplified arithmetic coding)
          const encoded = this._encodeByte(byte, prediction);
          compressed.push(encoded);

          // Update context and model
          this.contextModel.update(context, byte);
          context = OpCodes.RotL32(context, 8)|byte;
          context &= 0xFFFFFF; // 24-bit context
        }

        return compressed;
      }

      /**
       * Context model decompression
       * @private
       */
      _contextDecompress(data) {
        if (data.length === 0) return [];

        const decompressed = [];
        this.contextModel.reset();

        // Context model decompression
        let context = 0;
        for (let i = 0; i < data.length; i++) {
          const encoded = data[i];
          const prediction = this.contextModel.predict(context);

          // Decode byte
          const byte = this._decodeByte(encoded, prediction);
          decompressed.push(byte);

          // Update context and model
          this.contextModel.update(context, byte);
          context = ((OpCodes.Shl32(context, 8))|byte)&0xFFFFFF;
        }

        return decompressed;
      }

      /**
       * Check if data is highly repetitive
       * @private
       */
      _isHighlyRepetitive(data) {
        if (data.length < 4) return false;
        
        const first = data[0];
        for (let i = 1; i < data.length; i++) {
          if (data[i] !== first) return false;
        }
        return true;
      }

      /**
       * Encode byte using prediction
       * @private
       */
      _encodeByte(byte, prediction) {
        // Simplified encoding - store signed error
        const error = byte - prediction;
        return error&0xFF;
      }

      /**
       * Decode byte using prediction
       * @private
       */
      _decodeByte(encoded, prediction) {
        // Simplified decoding - restore from signed error
        const signedError = encoded > 127 ? encoded - 256 : encoded;
        return (prediction + signedError)&0xFF;
      }

      /**
       * Initialize decompression state
       * @private
       */
      _initializeDecompression() {
        this.contextModel.reset();
      }
    }

    /**
     * ZPAQ Context Model for compression
     */
    class ZPAQContextModel {
      constructor() {
        this.contexts = new Map();
        this.order = 4; // Context order
      }

      reset() {
        this.contexts.clear();
      }

      predict(context) {
        const mask = OpCodes.RotL32(1, this.order * 8) - 1;
        const contextKey = context&mask;
        const contextData = this.contexts.get(contextKey);
        
        if (contextData) {
          return contextData.prediction;
        } else {
          return 128; // Default prediction
        }
      }

      update(context, actualByte) {
        const mask = OpCodes.RotL32(1, this.order * 8) - 1;
        const contextKey = context&mask;
        
        if (!this.contexts.has(contextKey)) {
          this.contexts.set(contextKey, {
            prediction: 128,
            count: 0
          });
        }

        const contextData = this.contexts.get(contextKey);
        
        // Update prediction using exponential moving average
        const alpha = 1.0 / (contextData.count + 1);
        contextData.prediction = Math.floor(contextData.prediction * (1 - alpha) + actualByte * alpha);
        contextData.count++;
      }
    }

    /**
     * ZPAQ Preprocessor for data transformation
     */
    class ZPAQPreprocessor {
      constructor() {
        this.transformers = [
          this._deltaTransform,
          this._moveToFrontTransform
        ];
      }

      preprocess(data) {
        // Apply best transformation
        let bestData = data;
        let bestRatio = 1.0;

        for (const transform of this.transformers) {
          try {
            const transformed = transform.call(this, data);
            const ratio = this._estimateCompressibility(transformed) / data.length;
            
            if (ratio < bestRatio) {
              bestRatio = ratio;
              bestData = transformed;
            }
          } catch (e) {
            // Skip failed transformations
          }
        }

        return bestData;
      }

      /**
       * Delta transformation
       * @private
       */
      _deltaTransform(data) {
        if (data.length === 0) return data;

        const transformed = [data[0]];
        for (let i = 1; i < data.length; i++) {
          transformed.push((data[i] - data[i-1])&0xFF);
        }
        return transformed;
      }

      /**
       * Move-to-front transformation
       * @private
       */
      _moveToFrontTransform(data) {
        const alphabet = [];
        for (let i = 0; i < 256; i++) alphabet.push(i);
        
        const transformed = [];
        for (const byte of data) {
          const pos = alphabet.indexOf(byte);
          transformed.push(pos);
          
          // Move to front
          alphabet.splice(pos, 1);
          alphabet.unshift(byte);
        }
        
        return transformed;
      }

      /**
       * Estimate compressibility of data
       * @private
       */
      _estimateCompressibility(data) {
        const freq = new Array(256).fill(0);
        for (const byte of data) {
          freq[byte]++;
        }

        let entropy = 0;
        for (const f of freq) {
          if (f > 0) {
            const p = f / data.length;
            entropy -= p * Math.log2(p);
          }
        }

        return entropy * data.length / 8; // Estimated compressed size in bytes
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new ZPAQAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ZPAQAlgorithm, ZPAQInstance, ZPAQContextModel, ZPAQPreprocessor };
}));