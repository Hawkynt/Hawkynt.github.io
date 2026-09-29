/*
 * Arithmetic Coding Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Arithmetic coding is a form of entropy encoding used in lossless data compression.
 * Unlike traditional prefix codes, arithmetic coding represents the entire message
 * as a single fraction in the range [0, 1).
 */

// Load AlgorithmFramework (REQUIRED)

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

  class ArithmeticCoding extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Arithmetic Coding";
      this.description = "Arithmetic coding represents the entire message as a single fraction in the range [0,1) using probability models. Unlike prefix codes, achieves optimal compression ratios approaching the Shannon entropy limit.";
      this.inventor = "Jorma Rissanen, Glen Langdon";
      this.year = 1976;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Statistical";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Arithmetic Coding - Wikipedia", "https://en.wikipedia.org/wiki/Arithmetic_coding"),
        new LinkItem("Introduction to Data Compression by Khalid Sayood", "http://rahult.com/bookdc/"),
        new LinkItem("Mark Nelson's Data Compression Tutorial", "https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html")
      ];

      this.references = [
        new LinkItem("Nayuki Reference Implementation", "https://github.com/nayuki/Reference-arithmetic-coding"),
        new LinkItem("CABAC in H.264 Standard", "https://en.wikipedia.org/wiki/Context-adaptive_binary_arithmetic_coding"),
        new LinkItem("JPEG 2000 Arithmetic Coding", "https://www.jpeg.org/jpeg2000/")
      ];

      // Test vectors - round-trip compression tests only (no specific compressed outputs)
      this.tests = [
        new TestCase(
          [], // Empty data
          [], // Empty output
          "Empty data round-trip test",
          "Educational test vector"
        ),
        new TestCase(
          Array.from({ length: 256 }, (_, i) => i), // All 256 distinct byte values
          [],
          "All byte values 0-255 round-trip test",
          "Regression test for decoder/model desync"
        ),
        new TestCase(
          [243, 204, 191, 171, 157, 143, 229, 84, 239, 176, 155, 208, 176, 245, 186, 148, 128, 53, 183, 104, 65, 66, 101, 148, 122, 107, 131, 193, 65, 79, 229, 58, 50, 25, 21, 210, 49, 167, 70, 138, 6, 12, 191, 33, 67, 124, 161, 122, 65, 2, 92, 207, 37, 32, 136, 248, 127, 146, 78, 207, 243, 126, 146, 223, 64, 161, 46, 129, 181, 68, 211, 17, 148, 194, 96, 50, 211, 110, 202, 53, 74, 159, 228, 247, 145, 4, 228, 234, 16, 151, 188, 109, 81, 80, 49, 126, 162, 199, 101, 196, 235, 27, 109, 184, 20, 77, 129, 64, 148, 182, 146, 41, 134, 77, 32, 59, 197, 71, 158, 152, 231, 94, 231, 211, 103, 220, 144, 238, 137, 222, 237, 151, 177, 197, 92, 12, 97, 179, 107, 212, 167, 137, 88, 210, 78, 173, 228, 175, 149, 232, 107, 45, 28, 202, 239, 242, 91, 73, 66, 24, 35, 92, 185, 245, 62, 213, 13, 182, 15, 242, 254, 12, 86, 213, 178, 168, 213, 115, 176, 57, 95, 201, 101, 121, 187, 228, 195, 32, 44, 252, 179, 230, 150, 179, 164, 143, 191, 97, 136, 46, 25, 154, 214, 6, 155, 31, 129, 253, 3, 119, 59, 68, 187, 102, 43, 112, 143, 202, 179, 185, 32, 38, 37, 249, 29, 52, 47, 246, 60, 190, 166, 152, 5, 144, 25, 213, 107, 191, 85, 158, 64, 228, 200, 90, 18, 120, 76, 172, 148, 46, 222, 67, 185, 14, 135, 164, 72, 186, 30, 245, 198, 193, 63, 169, 164, 83, 85, 104, 24, 107, 159, 230, 18, 235, 247, 15, 205, 167, 128, 28, 145, 40, 49, 185, 0, 198, 197, 208, 211, 50, 157, 56, 249, 159, 97, 19, 92, 178, 139, 196], // Pseudo-random (splitmix32) 300-byte sample
          [],
          "Pseudo-random data round-trip test",
          "Regression test for decoder/model desync"
        ),
        new TestCase(
          Array.from({ length: 128 }, (_, i) => i % 2 ? 0x55 : 0xAA), // Alternating 0xAA/0x55
          [],
          "Alternating pattern round-trip test",
          "Regression test for decoder/model desync"
        )
      ];

    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {ArithmeticCodingInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ArithmeticCodingInstance(this, isInverse);

    }
  }

  /**
 * ArithmeticCoding cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class ArithmeticCodingInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {ArithmeticCoding} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];

    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.isInverse) {
        // A compressed stream always carries at least the header, so an
        // empty buffer here is not a valid compressed empty message.
        if (this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }
        return this._decompress();
      }

      // Compressing empty input still emits the header (matches
      // CompressionWorkbench, which never skips the container).
      return this._compress();
    }

    /**
     * @returns {uint8[]} Header, frequency table and coded bits
     */
    _compress() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;

      // Static (two-pass) order-0 model: count exact symbol frequencies over
      // the whole message first and transmit them in the header, capped at
      // 65535 so each entry fits a 16-bit field. Both encoder and decoder
      // then use this frozen table -- nothing is updated while coding.
      /** @type {int32[]} */
      const freqTable = new Array(256);
      for (let i = 0; i < 256; i++) {
        freqTable[i] = 0;
      }
      for (let i = 0; i < data.length; i++) {
        freqTable[data[i]]++;
      }
      for (let i = 0; i < 256; i++) {
        freqTable[i] = Math.min(freqTable[i], 65535);
      }

      // Header: 4-byte LE original length, then 256 x 2-byte LE frequencies.
      /** @type {uint8[]} */
      const output = OpCodes.Unpack32LE(OpCodes.ToUint32(data.length));
      for (let i = 0; i < 256; i++) {
        /** @type {uint8[]} */
        const fb = OpCodes.Unpack16LE(freqTable[i]);
        output.push(fb[0]);
        output.push(fb[1]);
      }

      if (data.length === 0) {
        return output;
      }

      /** @type {CumulativeTable} */
      const table = buildCumulativeFrequencies(freqTable);

      // The coded bits go straight into the output bytes, eight to a byte, MSB
      // first. Collecting them one array element per bit first cost eight times
      // the memory and ran the array out of space at roughly 12.5 MB of input.
      /** @type {MsbBitWriter} */
      const writer = new MsbBitWriter(output);
      /** @type {ArithmeticEncoder} */
      const encoder = new ArithmeticEncoder(table.cumFreq, table.totalFreq, writer);
      encoder.encode(data);
      writer.flush();

      return output;

    }

    /**
     * @returns {uint8[]} Decoded bytes
     */
    _decompress() {
      /** @type {uint8[]} */
      const data = this.inputBuffer;
      /** @type {uint8[]} */
      const fresh = [];
      this.inputBuffer = fresh;

      // Header: 4-byte LE original length.
      /** @type {uint32} */
      const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      /** @type {int32} */
      let offset = 4;

      if (originalSize === 0) {
        /** @type {uint8[]} */
        const empty = [];
        return empty;
      }

      // Header: 256 x 2-byte LE frequency table.
      /** @type {int32[]} */
      const freqTable = new Array(256);
      for (let i = 0; i < 256; i++) {
        freqTable[i] = OpCodes.Pack16LE(data[offset], data[offset + 1]);
        offset += 2;
      }

      /** @type {CumulativeTable} */
      const table = buildCumulativeFrequencies(freqTable);

      // Create fresh decoder for this decompression. The coded bits are read
      // straight out of the compressed bytes rather than expanded into one
      // array element per bit first.
      /** @type {ArithmeticDecoder} */
      const decoder = new ArithmeticDecoder(table.cumFreq, table.totalFreq);
      /** @type {uint8[]} */
      const decoded = decoder.decode(new MsbBitReader(data, offset), originalSize);
      return decoded;

    }
  }

  // ===== ARITHMETIC CODING IMPLEMENTATION =====

  /** @type {int32} */
  const EOF_SYMBOL = 256;
  /** @type {int32} */
  const NUM_SYMBOLS = 257; // 256 byte values + 1 EOF

  // The interval bounds and the products range * cumFreq are float64: the
  // products reach about 2^56 and have always been rounded float64 values
  // (JavaScript numbers), which the coder's output depends on.

  /**
   * Appends single bits to a byte array, most significant bit of each byte
   * first. The final partial byte is padded with zero bits by flush().
   */
  class MsbBitWriter {
    /**
     * @param {uint8[]} bytes - Byte array the completed bytes are appended to
     */
    constructor(bytes) {
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {uint32} */
      this.current = 0;
      /** @type {int32} */
      this.position = 7; // bit position inside the byte being filled
    }

    /**
     * @param {int32} bit - Bit (any non-zero value writes 1)
     */
    writeBit(bit) {
      if (bit) {
        this.current = OpCodes.SetBit(this.current, this.position, true);
      }

      if (this.position === 0) {
        this.bytes.push(this.current);
        this.current = 0;
        this.position = 7;
        return;
      }

      this.position--;
    }

    /** Append the partial last byte, if any */
    flush() {
      if (this.position === 7) {
        return;
      }

      this.bytes.push(this.current);
      this.current = 0;
      this.position = 7;
    }
  }

  /**
   * Reads single bits out of a byte array, most significant bit of each byte
   * first. Reads past the end yield 0, matching the encoder's implicit zero
   * padding.
   */
  class MsbBitReader {
    /**
     * @param {uint8[]} bytes - Bytes to read
     * @param {int32} start - Index of the first byte
     */
    constructor(bytes, start) {
      /** @type {uint8[]} */
      this.bytes = bytes;
      /** @type {int32} */
      this.index = start;
      /** @type {int32} */
      this.position = 7; // bit position inside the byte being read
    }

    /**
     * @returns {uint32} Next bit
     */
    readBit() {
      if (this.index >= this.bytes.length) {
        return 0;
      }

      /** @type {uint32} */
      const bit = OpCodes.GetBit(this.bytes[this.index], this.position) ? 1 : 0;

      if (this.position === 0) {
        this.index++;
        this.position = 7;
      } else {
        this.position--;
      }

      return bit;
    }
  }

  /**
   * Cumulative-frequency boundaries and their total
   */
  class CumulativeTable {
    /**
     * @param {int32[]} cumFreq - Boundaries, length NUM_SYMBOLS + 1
     * @param {int32} totalFreq - Last boundary
     */
    constructor(cumFreq, totalFreq) {
      /** @type {int32[]} */
      this.cumFreq = cumFreq;
      /** @type {int32} */
      this.totalFreq = totalFreq;
    }
  }

  // Builds the cumulative-frequency boundary table (length NUM_SYMBOLS + 1)
  // from a static 256-entry frequency table. The EOF symbol is always given
  // a hardcoded frequency of 1, appended after the real byte frequencies.
  /**
   * @param {int32[]} freqTable - 256 symbol frequencies
   * @returns {CumulativeTable} Boundaries including the EOF symbol
   */
  function buildCumulativeFrequencies(freqTable) {
    /** @type {int32[]} */
    const cumFreq = new Array(NUM_SYMBOLS + 1);
    cumFreq[0] = 0;
    for (let i = 0; i < 256; i++) {
      cumFreq[i + 1] = cumFreq[i] + freqTable[i];
    }
    cumFreq[NUM_SYMBOLS] = cumFreq[256] + 1;
    return new CumulativeTable(cumFreq, cumFreq[NUM_SYMBOLS]);
  }

  class ArithmeticEncoder {
    /**
     * @param {int32[]} cumFreq - Cumulative frequencies
     * @param {int32} totalFreq - Their total
     * @param {MsbBitWriter} writer - Output bits
     */
    constructor(cumFreq, totalFreq, writer) {
      /** @type {float64} */
      this.low = 0;
      /** @type {float64} */
      this.high = 0xFFFFFFFF;
      /** @type {int32} */
      this.followBits = 0;
      /** @type {MsbBitWriter} */
      this.writer = writer;
      /** @type {int32[]} */
      this.cumFreq = cumFreq;
      /** @type {int32} */
      this.totalFreq = totalFreq;
      /** @type {int32} */
      this.BITS = 32;
      /** @type {float64} */
      this.QUARTER = 0x40000000;
      /** @type {float64} */
      this.HALF = 0x80000000;
      /** @type {float64} */
      this.THREE_QUARTERS = 0xC0000000;
    }

    /**
     * @param {uint8[]} data - Bytes to code, followed by the EOF symbol
     */
    encode(data) {
      // Static order-0 model: the frequency table was already built once,
      // over the whole message, by the caller -- nothing is updated here.
      this.low = 0;
      this.high = 0xFFFFFFFF;
      this.followBits = 0;

      for (let i = 0; i < data.length; i++) {
        this._encodeSymbol(data[i]);
      }

      // Encode EOF symbol
      this._encodeSymbol(EOF_SYMBOL);

      // Flush remaining bits
      this._flush();
    }

    /**
     * @param {int32} symbol - Byte value or EOF_SYMBOL
     */
    _encodeSymbol(symbol) {
      /** @type {float64} */
      const symLow = this.cumFreq[symbol];
      /** @type {float64} */
      const symHigh = this.cumFreq[symbol + 1];
      /** @type {float64} */
      const range = this.high - this.low + 1;

      // Update bounds
      this.high = this.low + Math.floor((range * symHigh) / this.totalFreq) - 1;
      this.low = this.low + Math.floor((range * symLow) / this.totalFreq);

      // Output bits and rescale
      while (true) {
        if (this.high < this.HALF) {
          this._outputBit(0);
        } else if (this.low >= this.HALF) {
          this._outputBit(1);
          this.low -= this.HALF;
          this.high -= this.HALF;
        } else if (this.low >= this.QUARTER && this.high < this.THREE_QUARTERS) {
          this.followBits++;
          this.low -= this.QUARTER;
          this.high -= this.QUARTER;
        } else {
          break;
        }

        this.low = OpCodes.ToUint32(OpCodes.Shl32(this.low, 1));
        this.high = OpCodes.Or32(OpCodes.Shl32(this.high, 1), 1);
      }
    }

    /**
     * @param {int32} bit - Bit to output, followed by the pending opposite bits
     */
    _outputBit(bit) {
      this.writer.writeBit(bit);
      while (this.followBits > 0) {
        this.writer.writeBit(1 - bit);
        this.followBits--;
      }
    }

    /** Output the final disambiguating bits */
    _flush() {
      this.followBits++;
      if (this.low < this.QUARTER) {
        this._outputBit(0);
      } else {
        this._outputBit(1);
      }
    }
  }

  class ArithmeticDecoder {
    /**
     * @param {int32[]} cumFreq - Cumulative frequencies
     * @param {int32} totalFreq - Their total
     */
    constructor(cumFreq, totalFreq) {
      /** @type {float64} */
      this.low = 0;
      /** @type {float64} */
      this.high = 0xFFFFFFFF;
      /** @type {float64} */
      this.value = 0;
      /** @type {int32[]} */
      this.cumFreq = cumFreq;
      /** @type {int32} */
      this.totalFreq = totalFreq;
      /** @type {int32} */
      this.BITS = 32;
      /** @type {float64} */
      this.QUARTER = 0x40000000;
      /** @type {float64} */
      this.HALF = 0x80000000;
      /** @type {float64} */
      this.THREE_QUARTERS = 0xC0000000;
      /** @type {MsbBitReader} */
      this.reader = null;
    }

    /**
     * @param {MsbBitReader} reader - Coded bits
     * @param {uint32} originalSize - Largest number of symbols to decode
     * @returns {uint8[]} Decoded bytes (up to the EOF symbol)
     */
    decode(reader, originalSize) {
      // Static order-0 model: the frequency table was already built once,
      // from the header, by the caller -- nothing is updated here.
      this.low = 0;
      this.high = 0xFFFFFFFF;
      this.value = 0;
      this.reader = reader;

      // Read initial value (32 bits; missing trailing bits act as 0)
      for (let i = 0; i < this.BITS; i++) {
        this.value = OpCodes.Or32(OpCodes.Shl32(this.value, 1), reader.readBit());
      }

      /** @type {uint8[]} */
      const symbols = [];
      while (symbols.length < originalSize) {
        /** @type {int32} */
        const symbol = this._decodeSymbol();
        if (symbol === EOF_SYMBOL) {
          break;
        }
        symbols.push(symbol);
      }

      return symbols;
    }

    /**
     * @returns {int32} Next symbol (byte value or EOF_SYMBOL)
     */
    _decodeSymbol() {
      /** @type {float64} */
      const range = this.high - this.low + 1;
      /** @type {float64} */
      const target = Math.floor(((this.value - this.low + 1) * this.totalFreq - 1) / range);

      // Find the symbol whose cumulative frequency range covers `target`
      /** @type {int32} */
      let symbol = 0;
      while (symbol < NUM_SYMBOLS && this.cumFreq[symbol + 1] <= target) {
        symbol++;
      }

      /** @type {float64} */
      const symLow = this.cumFreq[symbol];
      /** @type {float64} */
      const symHigh = this.cumFreq[symbol + 1];

      // Narrow [low, high] to this symbol's sub-interval.
      this.high = this.low + Math.floor((range * symHigh) / this.totalFreq) - 1;
      this.low = this.low + Math.floor((range * symLow) / this.totalFreq);

      // Renormalize low/high/value together, consuming bits as needed
      while (true) {
        if (this.high < this.HALF) {
          // E1: no-op branch, mirrors encoder's condition
        } else if (this.low >= this.HALF) {
          this.low -= this.HALF;
          this.high -= this.HALF;
          this.value -= this.HALF;
        } else if (this.low >= this.QUARTER && this.high < this.THREE_QUARTERS) {
          this.low -= this.QUARTER;
          this.high -= this.QUARTER;
          this.value -= this.QUARTER;
        } else {
          break;
        }

        this.low = OpCodes.ToUint32(OpCodes.Shl32(this.low, 1));
        this.high = OpCodes.Or32(OpCodes.Shl32(this.high, 1), 1);
        this.value = OpCodes.ToUint32(OpCodes.Shl32(this.value, 1));
        this.value = OpCodes.Or32(this.value, this.reader.readBit());
      }

      return symbol;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ArithmeticCoding();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ArithmeticCoding, ArithmeticCodingInstance };
}));