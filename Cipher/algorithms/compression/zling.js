/*
 * Zling Compression Algorithm Implementation (Educational Version)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Zling - Fast LZMA-like compression using order-1 ROLZ + Huffman encoding
 * Created by Zhang Li (richox) as a lightweight high-performance compressor
 *
 * This is an educational implementation demonstrating the core concepts:
 * - Order-1 ROLZ (Reduced Offset Lempel-Ziv) dictionary compression
 * - Context-based matching using previous byte as context
 * - Huffman encoding for entropy coding
 * - Simplified parameters for learning purposes
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

  class ZlingCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Zling";
      this.description = "Fast LZMA-like compression using order-1 ROLZ (Reduced Offset Lempel-Ziv) followed by Huffman encoding. Achieves 3x faster compression than gzip with competitive ratios.";
      this.inventor = "Zhang Li (richox)";
      this.year = 2013;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary-based";
      this.securityStatus = SecurityStatus.EDUCATIONAL; // Educational implementation
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CN; // China

      // Documentation and references
      this.documentation = [
        new LinkItem("Zling GitHub Repository", "https://github.com/richox/libzling"),
        new LinkItem("ROLZ Algorithm Overview", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
      ];

      this.references = [
        new LinkItem("libzling Source Code", "https://github.com/richox/libzling/tree/master/src"),
        new LinkItem("ROLZ Paper", "https://ieeexplore.ieee.org/document/8801741/"),
        new LinkItem("Huffman Coding", "https://en.wikipedia.org/wiki/Huffman_coding"),
        new LinkItem("Successor: orz Compressor", "https://encode.su/threads/2923-orz-an-optimized-ROLZ-data-compressor-written-in-rust")
      ];

      // Test vectors - educational compression tests with actual outputs from the
      // fixed implementation (the previous vectors were captured from a version
      // with three independent round-trip defects: a stale/aliased dictionary
      // read during ROLZ match search that could accept matches the decoder
      // could not reproduce, a Huffman symbol count and single-run sentinel that
      // both collided with legitimate 256-value alphabets, and a 4-byte length
      // header reassembled with a bitwise-OR helper that only combines two
      // operands, silently discarding the upper 16 bits for any input at or
      // above 65536 bytes). Production Zling uses different parameters and an
      // entirely different encoding format; these vectors are specific to this
      // educational implementation.
      this.tests = [
        {
          text: "Empty input test",
          uri: "https://github.com/richox/libzling",
          input: [],
          expected: []
        },
        {
          text: "Single byte - educational format output",
          uri: "Educational implementation test",
          input: [65],
          expected: OpCodes.Hex8ToBytes("010300000500000001010000004101000000090000009e80")
        },
        {
          text: "Two different bytes - educational format output",
          uri: "Educational implementation test",
          input: [65, 66],
          expected: OpCodes.Hex8ToBytes("01040000060000000201000000410100000042010000000e000000af70")
        },
        {
          text: "Simple repetition AAAA - educational format output",
          uri: "Educational implementation test",
          input: [65, 65, 65, 65],
          expected: OpCodes.Hex8ToBytes("010300000800000004010000004104000000120000009edb40")
        },
        {
          text: "Pattern ABAB - educational format output",
          uri: "Educational implementation test",
          input: [65, 66, 65, 66],
          expected: OpCodes.Hex8ToBytes("010400000800000004010000004102000000420200000015000000af72e0")
        },
        {
          text: "Hello string - educational format output",
          uri: "Educational implementation test",
          input: OpCodes.AnsiToBytes("Hello"),
          expected: OpCodes.Hex8ToBytes("01060000090000000501000000480100000065010000006c020000006f010000001d000000b7bc5548")
        },
        {
          // Regression test for the Huffman symbol-count and sentinel-collision
          // defect: a stream with exactly 256 distinct byte values used to
          // truncate its symbol count byte to 0 and crash the decoder outright
          // ("Cannot read properties of undefined") while walking a Huffman tree
          // built from an empty frequency table.
          text: "All 256 byte values - regression for the Huffman header/sentinel collision",
          uri: "https://en.wikipedia.org/wiki/Byte",
          input: Array.from({ length: 256 }, (_, i) => i),
          expected: OpCodes.Hex8ToBytes("01000100050100000102000000020100000003010000000401000000050100000006010000000701000000080100000009010000000a010000000b010000000c010000000d010000000e010000000f0100000010010000001101000000120100000013010000001401000000150100000016010000001701000000180100000019010000001a010000001b010000001c010000001d010000001e010000001f0100000020010000002101000000220100000023010000002401000000250100000026010000002701000000280100000029010000002a010000002b010000002c010000002d010000002e010000002f0100000030010000003101000000320100000033010000003401000000350100000036010000003701000000380100000039010000003a010000003b010000003c010000003d010000003e010000003f0100000040010000004101000000420100000043010000004401000000450100000046010000004701000000480100000049010000004a010000004b010000004c010000004d010000004e010000004f0100000050010000005101000000520100000053010000005401000000550100000056010000005701000000580100000059010000005a010000005b010000005c010000005d010000005e010000005f0100000060010000006101000000620100000063010000006401000000650100000066010000006701000000680100000069010000006a010000006b010000006c010000006d010000006e010000006f0100000070010000007101000000720100000073010000007401000000750100000076010000007701000000780100000079010000007a010000007b010000007c010000007d010000007e010000007f0100000080010000008101000000820100000083010000008401000000850100000086010000008701000000880100000089010000008a010000008b010000008c010000008d010000008e010000008f0100000090010000009101000000920100000093010000009401000000950100000096010000009701000000980100000099010000009a010000009b010000009c010000009d010000009e010000009f01000000a001000000a101000000a201000000a301000000a401000000a501000000a601000000a701000000a801000000a901000000aa01000000ab01000000ac01000000ad01000000ae01000000af01000000b001000000b101000000b201000000b301000000b401000000b501000000b601000000b701000000b801000000b901000000ba01000000bb01000000bc01000000bd01000000be01000000bf01000000c001000000c101000000c201000000c301000000c401000000c501000000c601000000c701000000c801000000c901000000ca01000000cb01000000cc01000000cd01000000ce01000000cf01000000d001000000d101000000d201000000d301000000d401000000d501000000d601000000d701000000d801000000d901000000da01000000db01000000dc01000000dd01000000de01000000df01000000e001000000e101000000e201000000e301000000e401000000e501000000e601000000e701000000e801000000e901000000ea01000000eb01000000ec01000000ed01000000ee01000000ef01000000f001000000f101000000f201000000f301000000f401000000f501000000f601000000f701000000f801000000f901000000fa01000000fb01000000fc01000000fd01000000fe01000000ff01000000030a0000c03e01014070240b0340f04413054170641b0741f08423094270a42b0b42f0c4330d4370e43b0f43f10443114471244b1344f14453154571645b1745f18463194671a46b1b46f1c4731d4771e47b1f47f20483214872248b2348f24493254972649b2749f284a3294a72a4ab2b4af2c4b32d4b72e4bb2f4bf304c3314c7324cb334cf344d3354d7364db374df384e3394e73a4eb3b4ef3c4f33d4f73e4fb3f4ff40503415074250b4350f44513455174651b4751f48523495274a52b4b52f4c5334d5374e53b4f53f50543515475254b5354f54553555575655b5755f58563595675a56b5b56f5c5735d5775e57b5f57f60583615876258b6358f64593655976659b6759f685a3695a76a5ab6b5af6c5b36d5b76e5bb6f5bf705c3715c7725cb735cf745d3755d7765db775df785e3795e77a5eb7b5ef7c5f37d5f77e5fb7f5fe0")
        },
        {
          text: "Alternating 'ab' pattern - regression for ROLZ overlapping-match reconstruction",
          uri: "https://en.wikipedia.org/wiki/LZ77_and_LZ78",
          input: Array.from({ length: 64 }, (_, i) => i % 2 ? 0x62 : 0x61),
          expected: OpCodes.Hex8ToBytes("010600000800000001020000003d010000004001000000610200000062010000001f000000bfa8a32c")
        },
        {
          // Regression test for the stale/aliased ROLZ dictionary read: the
          // encoder used to verify candidate matches against a partially
          // uninitialized mirror buffer instead of the true input, so it could
          // accept a match the decoder would reconstruct differently once the
          // referenced slot was actually written.
          text: "Pseudo-random byte stream - regression for the ROLZ stale-dictionary-read defect",
          uri: "https://en.wikipedia.org/wiki/Pseudorandomness",
          input: OpCodes.Hex8ToBytes("80000000400040000000004000000040000000000000400000380040000000400000000000004000000000400000004000000000004000000000000000003800"),
          expected: OpCodes.Hex8ToBytes("011100002100000001080000000201000000030100000004010000000605000000080100000009010000000b010000000e010000001d010000001f0100000028010000002f01000000380200000040030000008001000000a90000008f87f8f1f3494359cd57a335d8365cda73039b69d180")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ZlingInstance(this, isInverse);
    }
  }

  // Zling compression instance
  /**
 * Zling cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ZlingInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // Educational Zling Parameters (simplified from production)
      // Production: 16MB block, 10MB dictionary
      // Educational: smaller sizes for clarity
      this.BLOCK_SIZE = 4096;         // Simplified block size
      this.DICTIONARY_SIZE = 2048;     // Simplified dictionary size
      this.MIN_MATCH_LENGTH = 3;       // Minimum match length
      this.MAX_MATCH_LENGTH = 258;     // Maximum match length
      this.HASH_SIZE = 256;            // Hash table size for order-1 context
      this.MAX_OFFSET_COUNT = 16;      // Reduced offset set size (ROLZ key feature)
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
      if (this.inputBuffer.length === 0) {
        return [];
      }

      if (this.isInverse) {
        return this._decompress();
      } else {
        return this._compress();
      }
    }

    // ===== COMPRESSION =====

    _compress() {
      const data = this.inputBuffer;
      this.inputBuffer = [];

      if (data.length === 0) {
        return [];
      }

      // Stage 1: ROLZ compression (order-1 context-based dictionary)
      const rolzCompressed = this._rolzEncode(data);

      // Stage 2: Huffman encoding (entropy coding)
      const huffmanEncoded = this._huffmanEncode(rolzCompressed);

      return huffmanEncoded;
    }

    _rolzEncode(data) {
      const output = [];

      // Context hash tables - each context maintains recent match positions
      // Order-1 ROLZ: context is the previous byte. Positions are stored as true
      // absolute indices into `data` (not the circular dictionary index the
      // decoder addresses matches by), so match verification below can always
      // compare against ground truth instead of the decoder's not-yet-filled
      // circular buffer slots.
      const contextHashes = new Array(256);
      for (let i = 0; i < 256; ++i) {
        contextHashes[i] = [];
      }

      // Header: format version and data length
      output.push(0); // Format version
      output.push(data.length&0xFF);
      output.push(OpCodes.Shr8(data.length, 8));
      output.push(OpCodes.Shr16(data.length, 16));
      output.push(OpCodes.Shr32(data.length, 24));

      let pos = 0;
      let prevByte = 0; // Previous byte for order-1 context

      while (pos < data.length) {
        const currentByte = data[pos];

        // Try to find match in context-specific reduced offset set
        const match = this._findBestMatch(data, pos, prevByte, contextHashes);

        if (match && match.length >= this.MIN_MATCH_LENGTH) {
          // Encode match: [1 = match flag, offset high, offset low, length].
          // The transmitted offset is the circular dictionary slot the decoder
          // will read from, matching how it addresses its own ring buffer.
          const circularOffset = match.sourcePos % this.DICTIONARY_SIZE;
          output.push(1); // Match flag
          output.push(OpCodes.Shr8(circularOffset, 8));
          output.push(circularOffset&0xFF);
          output.push(match.length&0xFF);

          // Update context hashes with the absolute position of every byte just
          // consumed, so future matches can reference them.
          for (let i = 0; i < match.length; ++i) {
            const context = i === 0 ? prevByte : data[pos + i - 1];
            contextHashes[context].push(pos + i);

            // Keep only recent MAX_OFFSET_COUNT positions (ROLZ reduced offset)
            if (contextHashes[context].length > this.MAX_OFFSET_COUNT) {
              contextHashes[context].shift();
            }
          }

          prevByte = data[pos + match.length - 1];
          pos += match.length;
        } else {
          // Encode literal: [0 = literal flag, byte value]
          output.push(0); // Literal flag
          output.push(currentByte);

          contextHashes[prevByte].push(pos);
          if (contextHashes[prevByte].length > this.MAX_OFFSET_COUNT) {
            contextHashes[prevByte].shift();
          }

          prevByte = currentByte;
          ++pos;
        }
      }

      return output;
    }

    _findBestMatch(data, pos, context, contextHashes) {
      if (pos + this.MIN_MATCH_LENGTH > data.length) {
        return null;
      }

      // ROLZ: Only search positions in the reduced offset set for this context
      const candidates = contextHashes[context];
      if (!candidates || candidates.length === 0) {
        return null;
      }

      let bestMatch = null;
      let bestLength = this.MIN_MATCH_LENGTH - 1;
      // Match length is transmitted in a single byte (see _rolzEncode), so it can
      // never exceed 255 even though MAX_MATCH_LENGTH allows a longer match in
      // principle; without this cap a match of 256+ bytes would silently wrap
      // when masked into that byte.
      const maxLen = Math.min(this.MAX_MATCH_LENGTH, data.length - pos, 255);

      // Search through reduced offset set (ROLZ key optimization)
      for (const sourcePos of candidates) {
        // A candidate whose circular dictionary slot has since been overwritten
        // by more recent data can no longer be addressed by the decoder's ring
        // buffer - the transmitted offset would silently reference the wrong
        // (newer) bytes.
        if (pos - sourcePos > this.DICTIONARY_SIZE) {
          continue;
        }

        // Compare directly against `data` (the encoder's full ground truth)
        // rather than a circular "dictionary" mirror. Self-overlapping matches
        // (sourcePos + matchLength reaching into [pos, pos + matchLength)) are
        // still handled correctly this way, because that region's true value is
        // exactly the earlier part of this same repeating run - precisely what
        // the decoder reconstructs by copying progressively from its own
        // circular buffer as it writes each byte.
        let matchLength = 0;
        while (matchLength < maxLen && data[sourcePos + matchLength] === data[pos + matchLength]) {
          ++matchLength;
        }

        // Keep best match
        if (matchLength > bestLength) {
          bestLength = matchLength;
          bestMatch = {
            sourcePos: sourcePos,
            length: matchLength
          };
        }
      }

      return bestMatch;
    }

    // ===== HUFFMAN ENCODING =====

    _huffmanEncode(data) {
      if (data.length === 0) {
        return [];
      }

      // Build frequency table
      const frequencies = {};
      for (const byte of data) {
        frequencies[byte] = (frequencies[byte] || 0) + 1;
      }

      // Handle special case: single unique byte. A one-leaf "tree" cannot be
      // walked by the general left/right traversal below (there is no branch to
      // take), so it is encoded as a dedicated run instead. The mode byte (0)
      // distinguishes this from the general path (1) unambiguously - unlike the
      // former single sentinel byte value 255, which collided with the entirely
      // valid case of a general-path symbol count of 255.
      const uniqueBytes = Object.keys(frequencies);
      if (uniqueBytes.length === 1) {
        const byte = parseInt(uniqueBytes[0]);
        const countBytes = OpCodes.Unpack32LE(data.length);
        return [0, byte, countBytes[0], countBytes[1], countBytes[2], countBytes[3]];
      }

      // Build Huffman tree and generate codes
      const tree = this._buildHuffmanTree(frequencies);
      const codes = {};
      this._generateHuffmanCodes(tree, '', codes);

      // Encode data to bit string
      let bitString = '';
      for (const byte of data) {
        bitString += codes[byte];
      }

      // Pack to bytes with tree header
      return this._packHuffmanData(frequencies, bitString);
    }

    _buildHuffmanTree(frequencies) {
      const nodes = [];

      // Create leaf nodes
      for (const [byte, freq] of Object.entries(frequencies)) {
        nodes.push({
          byte: parseInt(byte),
          freq: freq,
          left: null,
          right: null
        });
      }

      // Build tree bottom-up
      while (nodes.length > 1) {
        // Sort by frequency
        nodes.sort((a, b) => a.freq - b.freq);

        // Take two lowest frequency nodes
        const left = nodes.shift();
        const right = nodes.shift();

        // Create parent node
        const parent = {
          byte: null,
          freq: left.freq + right.freq,
          left: left,
          right: right
        };

        nodes.push(parent);
      }

      return nodes[0];
    }

    _generateHuffmanCodes(node, code, codes) {
      if (!node) return;

      // Leaf node - assign code
      if (node.byte !== null) {
        codes[node.byte] = code || '0';
        return;
      }

      // Traverse tree
      this._generateHuffmanCodes(node.left, code + '0', codes);
      this._generateHuffmanCodes(node.right, code + '1', codes);
    }

    _packHuffmanData(frequencies, bitString) {
      const output = [];

      // Mode byte: 1 = general Huffman-coded path (see _huffmanEncode for mode 0,
      // the single-symbol run).
      output.push(1);

      // Number of unique symbols. A byte-valued stream can legitimately contain
      // all 256 distinct byte values, which a single length byte cannot represent
      // (256 truncates to 0) - two bytes cover the full 0..256 range unambiguously.
      const symbolEntries = Object.entries(frequencies);
      const symbolCountBytes = OpCodes.Unpack16LE(symbolEntries.length);
      output.push(symbolCountBytes[0], symbolCountBytes[1]);

      // Write frequency table. Frequencies are stored as 32-bit values since a
      // single symbol can legitimately occur far more than 65535 times in a large
      // input.
      for (const [byte, freq] of symbolEntries) {
        output.push(parseInt(byte));
        const freqBytes = OpCodes.Unpack32LE(freq);
        output.push(freqBytes[0], freqBytes[1], freqBytes[2], freqBytes[3]);
      }

      // Write bit length
      const bitLengthBytes = OpCodes.Unpack32LE(bitString.length);
      output.push(bitLengthBytes[0], bitLengthBytes[1], bitLengthBytes[2], bitLengthBytes[3]);

      // Pack bits into bytes
      for (let i = 0; i < bitString.length; i += 8) {
        const chunk = bitString.substring(i, i + 8).padEnd(8, '0');
        const byte = parseInt(chunk, 2);
        output.push(byte);
      }

      return output;
    }

    // ===== DECOMPRESSION =====

    _decompress() {
      const data = this.inputBuffer;
      this.inputBuffer = [];

      if (data.length === 0) {
        return [];
      }

      // Stage 1: Huffman decoding
      const huffmanDecoded = this._huffmanDecode(data);

      // Stage 2: ROLZ decoding
      const rolzDecoded = this._rolzDecode(huffmanDecoded);

      return rolzDecoded;
    }

    _huffmanDecode(data) {
      if (data.length === 0) {
        return [];
      }

      // Handle special single-byte-run case (mode 0 - see _huffmanEncode)
      if (data[0] === 0) {
        const byte = data[1];
        const count = OpCodes.Pack32LE(data[2], data[3], data[4], data[5]);
        return new Array(count).fill(byte);
      }

      let pos = 1; // skip mode byte (1 = general path)

      // Read symbol count (2 bytes - see _packHuffmanData for why one byte is
      // not enough to represent the full 0..256 range)
      const symbolCount = OpCodes.Pack16LE(data[pos], data[pos + 1]);
      pos += 2;

      // Read frequency table (4-byte frequencies - see _packHuffmanData)
      const frequencies = {};
      for (let i = 0; i < symbolCount; ++i) {
        const byte = data[pos++];
        const freq = OpCodes.Pack32LE(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
        pos += 4;
        frequencies[byte] = freq;
      }

      // Read bit length
      const bitLength = OpCodes.Pack32LE(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
      pos += 4;

      // Rebuild Huffman tree
      const tree = this._buildHuffmanTree(frequencies);

      // Unpack bits
      let bitString = '';
      while (pos < data.length) {
        const byte = data[pos++];
        bitString += byte.toString(2).padStart(8, '0');
      }
      bitString = bitString.substring(0, bitLength);

      // Decode using tree
      const output = [];
      let node = tree;
      for (const bit of bitString) {
        node = bit === '0' ? node.left : node.right;

        if (node.byte !== null) {
          output.push(node.byte);
          node = tree;
        }
      }

      return output;
    }

    _rolzDecode(data) {
      if (data.length === 0) {
        return [];
      }

      let pos = 0;

      // Read header. OpCodes.OrN only combines two operands (it is a bitwise-OR,
      // not a variadic reduce), so folding all four length bytes through a single
      // call silently discarded the upper two bytes - any length at or above
      // 0x10000 decoded as just its low 16 bits and decoding stopped there.
      const version = data[pos++];
      const originalLength = OpCodes.Pack32LE(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
      pos += 4;

      const output = [];
      const dictionary = new Array(this.DICTIONARY_SIZE).fill(0);
      let dictPos = 0;

      while (pos < data.length && output.length < originalLength) {
        const flag = data[pos++];

        if (flag === 1) {
          // Match
          const offsetHigh = data[pos++];
          const offsetLow = data[pos++];
          const length = data[pos++];
          const offset = OpCodes.OrN(OpCodes.Shl32(offsetHigh, 8), offsetLow);

          // Copy from dictionary
          for (let i = 0; i < length; ++i) {
            const byte = dictionary[(offset + i) % this.DICTIONARY_SIZE];
            output.push(byte);
            dictionary[dictPos] = byte;
            dictPos = (dictPos + 1) % this.DICTIONARY_SIZE;
          }
        } else {
          // Literal
          const byte = data[pos++];
          output.push(byte);
          dictionary[dictPos] = byte;
          dictPos = (dictPos + 1) % this.DICTIONARY_SIZE;
        }
      }

      return output;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new ZlingCompression());

  return ZlingCompression;
}));
