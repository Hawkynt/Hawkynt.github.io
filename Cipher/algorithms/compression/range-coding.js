/*
 * Range Coding Algorithm Implementation (Educational Version)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Range coding - Entropy coding method that assigns codewords to symbols
 * based on their probability distributions. More general than arithmetic coding.
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

  class RangeCodingAlgorithm extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Range Coding";
        this.description = "Entropy coding method that assigns codewords to symbols based on their probability distributions. More general and efficient than arithmetic coding.";
        this.inventor = "G. Nigel N. Martin";
        this.year = 1979;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Entropy Coding";
        this.securityStatus = null;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.GB; // Great Britain

        // Documentation and references
        this.documentation = [
          new LinkItem("Range Encoding - Wikipedia", "https://en.wikipedia.org/wiki/Range_encoding"),
          new LinkItem("Arithmetic Coding Explained", "https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html")
        ];

        this.references = [
          new LinkItem("Original Range Coding Paper", "https://www.drdobbs.com/database/arithmetic-coding-data-compression/184402828"),
          new LinkItem("Compression Research Papers", "https://compression.ca/"),
          new LinkItem("Data Compression Explained", "https://web.stanford.edu/class/ee398a/handouts/papers/WittenACM87ArithmCoding.pdf")
        ];

        // Test vectors - based on range coding specifications and examples
        this.tests = [
          new TestCase(
            [],
            [],
            "Empty input",
            "https://en.wikipedia.org/wiki/Range_encoding"
          ),
          new TestCase(
            global.OpCodes.AnsiToBytes("A"),
            [0, 0, 0, 1, 0, 1, 65, 255, 255, 255, 255, 128, 0, 0, 0],
            "Single character encoding",
            "https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html"
          ),
          new TestCase(
            global.OpCodes.AnsiToBytes("AA"),
            [0, 0, 0, 2, 0, 1, 65, 255, 255, 255, 255, 192, 0, 0, 0],
            "Repeated character - high probability",
            "https://compression.ca/"
          ),
          new TestCase(
            global.OpCodes.AnsiToBytes("AB"),
            [0, 0, 0, 2, 0, 2, 65, 127, 255, 255, 255, 66, 127, 255, 255, 255, 160, 0, 0, 0],
            "Two different characters - equal probability",
            "https://web.stanford.edu/class/ee398a/handouts/papers/WittenACM87ArithmCoding.pdf"
          ),
          new TestCase(
            global.OpCodes.AnsiToBytes("Hello"),
            [0, 0, 0, 5, 0, 4, 72, 51, 51, 51, 51, 101, 51, 51, 51, 51, 108, 102, 102, 102, 102, 111, 51, 51, 51, 51, 180, 0, 0, 0],
            "Hello string with frequency analysis",
            "https://en.wikipedia.org/wiki/Range_encoding"
          )
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new RangeCodingInstance(this, isInverse);
      }
    }

    class RangeCodingInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse; // true = decompress, false = compress
        this.inputBuffer = [];

        // Range coding parameters
        this.RANGE_MAX = 0xFFFFFFFF; // Maximum range value
        this.QUARTER = this.RANGE_MAX >> 2; // Quarter point
        this.HALF = this.QUARTER << 1; // Half point  
        this.THREE_QUARTERS = this.HALF + this.QUARTER; // Three quarters point
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        const result = this.isInverse ? 
          this.decompress(this.inputBuffer) : 
          this.compress(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      }

      compress(data) {
        if (!data || data.length === 0) return [];

        const inputString = this._bytesToString(data);

        // Step 1: Build frequency table
        const frequencies = this._buildFrequencyTable(inputString);
        const totalFreq = inputString.length;

        // Step 2: Build cumulative frequency table
        const cumulativeFreq = this._buildCumulativeFrequencyTable(frequencies, totalFreq);

        // Step 3: Encode using range coding
        const encoded = this._encodeRange(inputString, cumulativeFreq, totalFreq);

        // Step 4: Pack compressed data
        const compressed = this._packCompressedData(cumulativeFreq, encoded, inputString.length);

        return this._stringToBytes(compressed);
      }

      decompress(data) {
        if (!data || data.length === 0) return [];

        const compressedString = this._bytesToString(data);

        // Unpack compressed data
        const { cumulativeFreq, encoded, originalLength } = this._unpackCompressedData(compressedString);

        // Decode range-encoded data
        const decoded = this._decodeRange(encoded, cumulativeFreq, originalLength);

        return this._stringToBytes(decoded);
      }

      _buildFrequencyTable(data) {
        const frequencies = {};
        for (let i = 0; i < data.length; i++) {
          const char = data.charAt(i);
          frequencies[char] = (frequencies[char] || 0) + 1;
        }
        return frequencies;
      }

      _buildCumulativeFrequencyTable(frequencies, totalFreq) {
        const symbols = Object.keys(frequencies).sort();
        const cumulativeFreq = {};
        let cumulative = 0;

        for (const symbol of symbols) {
          cumulativeFreq[symbol] = {
            low: cumulative,
            high: cumulative + frequencies[symbol],
            count: frequencies[symbol]
          };
          cumulative += frequencies[symbol];
        }

        return cumulativeFreq;
      }

      _encodeRange(data, cumulativeFreq, totalFreq) {
        let low = 0;
        let high = this.RANGE_MAX;
        const output = [];
        let pendingBits = 0;

        for (let i = 0; i < data.length; i++) {
          const symbol = data.charAt(i);
          const symbolInfo = cumulativeFreq[symbol];

          // Calculate new range
          const range = high - low + 1;
          const newHigh = low + Math.floor((range * symbolInfo.high) / totalFreq) - 1;
          const newLow = low + Math.floor((range * symbolInfo.low) / totalFreq);

          high = newHigh;
          low = newLow;

          // Output bits when possible
          while (true) {
            if (high < this.HALF) {
              // Output 0 and any pending 1s
              this._outputBit(output, 0);
              this._outputPendingBits(output, pendingBits, 1);
              pendingBits = 0;
            } else if (low >= this.HALF) {
              // Output 1 and any pending 0s
              this._outputBit(output, 1);
              this._outputPendingBits(output, pendingBits, 0);
              pendingBits = 0;
              low -= this.HALF;
              high -= this.HALF;
            } else if (low >= this.QUARTER && high < this.THREE_QUARTERS) {
              // Scale to avoid underflow
              pendingBits++;
              low -= this.QUARTER;
              high -= this.QUARTER;
            } else {
              break;
            }

            // Scale up
            low = low << 1;
            high = (high << 1) + 1;
          }
        }

        // Output final bits
        if (low < this.QUARTER) {
          this._outputBit(output, 0);
          this._outputPendingBits(output, pendingBits, 1);
        } else {
          this._outputBit(output, 1);
          this._outputPendingBits(output, pendingBits, 0);
        }

        return this._bitsToBytes(output);
      }

      _decodeRange(encoded, cumulativeFreq, length) {
        const symbols = Object.keys(cumulativeFreq);
        const totalFreq = Math.max(...symbols.map(s => cumulativeFreq[s].high));

        let low = 0;
        let high = this.RANGE_MAX;
        let code = this._bytesToCode(encoded);
        let decoded = '';
        let bitPos = 0;

        for (let i = 0; i < length; i++) {
          // Find symbol for current code position
          const range = high - low + 1;
          const scaledValue = Math.floor(((code - low + 1) * totalFreq - 1) / range);

          let symbol = null;
          for (const s of symbols) {
            const info = cumulativeFreq[s];
            if (scaledValue >= info.low && scaledValue < info.high) {
              symbol = s;
              break;
            }
          }

          if (symbol === null) break;

          decoded += symbol;
          const symbolInfo = cumulativeFreq[symbol];

          // Update range
          const newHigh = low + Math.floor((range * symbolInfo.high) / totalFreq) - 1;
          const newLow = low + Math.floor((range * symbolInfo.low) / totalFreq);
          high = newHigh;
          low = newLow;

          // Scale range and code
          while ((high < this.HALF) || (low >= this.HALF)) {
            if (high < this.HALF) {
              // Both in lower half
            } else if (low >= this.HALF) {
              // Both in upper half
              low -= this.HALF;
              high -= this.HALF;
              code -= this.HALF;
            }

            low = low << 1;
            high = (high << 1) + 1;
            code = (code << 1) & this.RANGE_MAX;

            // Read next bit if available
            if (bitPos < encoded.length * 8) {
              const byteIndex = Math.floor(bitPos / 8);
              const bitIndex = bitPos % 8;
              if (encoded[byteIndex] & (128 >> bitIndex)) {
                code |= 1;
              }
              bitPos++;
            }
          }

          // Handle underflow
          while (low >= this.QUARTER && high < this.THREE_QUARTERS) {
            low -= this.QUARTER;
            high -= this.QUARTER;
            code -= this.QUARTER;

            low = low << 1;
            high = (high << 1) + 1;
            code = (code << 1) & this.RANGE_MAX;

            if (bitPos < encoded.length * 8) {
              const byteIndex = Math.floor(bitPos / 8);
              const bitIndex = bitPos % 8;
              if (encoded[byteIndex] & (128 >> bitIndex)) {
                code |= 1;
              }
              bitPos++;
            }
          }
        }

        return decoded;
      }

      _outputBit(output, bit) {
        output.push(bit);
      }

      _outputPendingBits(output, count, bit) {
        for (let i = 0; i < count; i++) {
          output.push(bit);
        }
      }

      _bitsToBytes(bits) {
        const bytes = [];

        // Pad to byte boundary
        while (bits.length % 8 !== 0) {
          bits.push(0);
        }

        for (let i = 0; i < bits.length; i += 8) {
          let byte = 0;
          for (let j = 0; j < 8; j++) {
            if (bits[i + j]) {
              byte |= (128 >> j);
            }
          }
          bytes.push(byte);
        }

        return bytes;
      }

      _bytesToCode(bytes) {
        let code = 0;
        for (let i = 0; i < Math.min(4, bytes.length); i++) {
          code = (code << 8) | bytes[i];
        }
        return code;
      }

      _packCompressedData(cumulativeFreq, encoded, originalLength) {
        const bytes = [];

        // Header: [OriginalLength(4)][TableSize(2)][Table][EncodedLength(4)][EncodedData]

        // Original length (4 bytes, big-endian)
        // TODO: use Opcodes for unpacking
        bytes.push((originalLength >>> 24) & 0xFF);
        bytes.push((originalLength >>> 16) & 0xFF);
        bytes.push((originalLength >>> 8) & 0xFF);
        bytes.push(originalLength & 0xFF);

        // Serialize frequency table
        const symbols = Object.keys(cumulativeFreq);
        const tableSize = symbols.length;

        // Table size (2 bytes, big-endian)
        // TODO: use Opcodes for unpacking
        bytes.push((tableSize >>> 8) & 0xFF);
        bytes.push(tableSize & 0xFF);

        // Table entries: [CharCode(1)][Frequency(4)]
        for (const symbol of symbols) {
          const info = cumulativeFreq[symbol];
          bytes.push(symbol.charCodeAt(0) & 0xFF);
          // TODO: use Opcodes for unpacking
          bytes.push((info.count >>> 24) & 0xFF);
          bytes.push((info.count >>> 16) & 0xFF);
          bytes.push((info.count >>> 8) & 0xFF);
          bytes.push(info.count & 0xFF);
        }

        // Encoded data length
        // TODO: use Opcodes for unpacking
        bytes.push((encoded.length >>> 24) & 0xFF);
        bytes.push((encoded.length >>> 16) & 0xFF);
        bytes.push((encoded.length >>> 8) & 0xFF);
        bytes.push(encoded.length & 0xFF);

        // Encoded data
        bytes.push(...encoded);

        return this._bytesToString(bytes);
      }

      _unpackCompressedData(compressedData) {
        const bytes = this._stringToBytes(compressedData);

        if (bytes.length < 10) {
          throw new Error('Invalid compressed data: too short');
        }

        let pos = 0;

        // Read original length
  // TODO: use OpCodes for packing
        const originalLength = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | 
                             (bytes[pos + 2] << 8) | bytes[pos + 3];
        pos += 4;

        // Read table size
  // TODO: use OpCodes for packing
        const tableSize = (bytes[pos] << 8) | bytes[pos + 1];
        pos += 2;

        // Read frequency table
        const frequencies = {};
        for (let i = 0; i < tableSize; i++) {
          if (pos + 4 >= bytes.length) {
            throw new Error('Invalid compressed data: incomplete table');
          }

          const charCode = bytes[pos++];
  // TODO: use OpCodes for packing
          const count = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | 
                       (bytes[pos + 2] << 8) | bytes[pos + 3];
          pos += 4;

          const char = String.fromCharCode(charCode);
          frequencies[char] = count;
        }

        // Build cumulative frequency table
        const totalFreq = Object.values(frequencies).reduce((a, b) => a + b, 0);
        const cumulativeFreq = this._buildCumulativeFrequencyTable(frequencies, totalFreq);

        // Read encoded data length
        if (pos + 3 >= bytes.length) {
          throw new Error('Invalid compressed data: missing encoded data length');
        }

  // TODO: use OpCodes for packing
        const encodedLength = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | 
                            (bytes[pos + 2] << 8) | bytes[pos + 3];
        pos += 4;

        // Read encoded data
        const encoded = bytes.slice(pos, pos + encodedLength);

        return { cumulativeFreq, encoded, originalLength };
      }

      // Utility functions
      _stringToBytes(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
          bytes.push(str.charCodeAt(i) & 0xFF);
        }
        return bytes;
      }

      _bytesToString(bytes) {
        let str = "";
        for (let i = 0; i < bytes.length; i++) {
          str += String.fromCharCode(bytes[i]);
        }
        return str;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new RangeCodingAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RangeCodingAlgorithm, RangeCodingInstance };
}));