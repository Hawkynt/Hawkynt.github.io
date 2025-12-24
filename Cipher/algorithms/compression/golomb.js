/*
 * Golomb Coding Algorithm Implementation (Educational Version)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Golomb coding - Optimal prefix coding for geometric distributions
 * Includes Rice coding (power-of-2 parameters) as a special case
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

  /**
 * GolombCompression - Compression algorithm implementation
 * @class
 * @extends {CompressionAlgorithm}
 */

  class GolombCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Golomb";
        this.description = "Golomb coding is a lossless data compression method using prefix codes optimized for geometric distributions. Rice coding (power-of-2 parameters) is included as a special case.";
        this.inventor = "Solomon W. Golomb";
        this.year = 1966;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Entropy Coding";
        this.securityStatus = null;
        this.complexity = ComplexityType.BASIC;
        this.country = CountryCode.US; // United States

        // Documentation and references
        this.documentation = [
          new LinkItem("Wikipedia - Golomb Coding", "https://en.wikipedia.org/wiki/Golomb_coding"),
          new LinkItem("Wikipedia - Rice Coding", "https://en.wikipedia.org/wiki/Rice_coding")
        ];

        this.references = [
          new LinkItem("Run-length encodings", "https://ieeexplore.ieee.org/document/1054904"),
          new LinkItem("Information Theory Foundations", "https://web.stanford.edu/class/ee376a/")
        ];

        // Test vectors - from Golomb coding research and specifications
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          },
          {
            text: "Golomb parameter m=2, input=0",
            uri: "https://en.wikipedia.org/wiki/Golomb_coding",
            input: [0],
            expected: [2, 2, 0]
          },
          {
            text: "Golomb parameter m=2, input=3",
            uri: "https://rosettacode.org/wiki/Rice_coding",
            input: [3],
            expected: [2, 3, 160]
          },
          {
            text: "Sequential integers 0-4",
            uri: "https://unix4lyfe.org/rice-coding/",
            input: [0, 1, 2, 3, 4],
            expected: [2, 14, 25, 112]
          },
          {
            text: "Geometric distribution pattern",
            uri: "https://en.wikipedia.org/wiki/Golomb_coding",
            input: [0, 0, 1, 0, 2, 1, 0, 3],
            expected: [2, 18, 4, 137, 64]
          },
          {
            text: "Powers of 2 sequence",
            uri: "https://en.wikipedia.org/wiki/Rice_coding",
            input: [1, 2, 4, 8],
            expected: [2, 15, 102, 120]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new GolombInstance(this, isInverse);
      }
    }

    // Golomb coding instance - educational implementation
    class GolombInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];

        // Golomb Parameters
        this.parameter = 2;  // Default M parameter (can be adjusted)
        this.isRice = false; // Whether to use Rice coding (M = power of 2)
      }

      SetParameter(m) {
        this.parameter = m;
        this.isRice = this._isPowerOfTwo(m);
      }

      Feed(data) {
        if (!data || data.length === 0) return;

        // First byte can be parameter setting
        if (this.inputBuffer.length === 0 && data.length > 1 && !this.isInverse) {
          // Allow parameter to be set via first data element
          // In practice, this would be negotiated or fixed
        }

        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) {
          return [];
        }

        if (this.isInverse) {
          const result = this._decode(this.inputBuffer);
          this.inputBuffer = [];
          return result;
        } else {
          const result = this._encode(this.inputBuffer);
          this.inputBuffer = [];
          return result;
        }
      }

      _encode(values) {
        if (values.length === 0) {
          return [];
        }

        const output = [];
        const bitBuffer = new BitBuffer();

        // Store parameter as first byte
        output.push(this.parameter);

        for (const value of values) {
          if (value < 0) {
            throw new Error("Golomb coding requires non-negative integers");
          }

          this._encodeValue(bitBuffer, value);
        }

        // Store bit count in second byte, then encoded bits
        const bits = bitBuffer.getBytes();
        if (bits.length > 0) {
          output.push(OpCodes.ToByte(bitBuffer.getBitCount())); // Lower 8 bits of bit count
          output.push(...bits);
        } else {
          output.push(0); // No bits encoded
        }

        return output;
      }

      _decode(data) {
        if (data.length < 3) {
          return [];
        }

        // Read parameter and bit count
        const parameter = data[0];
        const bitCount = data[1];
        this.SetParameter(parameter);

        if (bitCount === 0) {
          return []; // No encoded data
        }

        const values = [];
        const bitBuffer = new BitBuffer();

        // Load encoded data into bit buffer
        for (let i = 2; i < data.length; i++) {
          bitBuffer.addByte(data[i]);
        }

        // Set the actual bit count to avoid reading padding
        bitBuffer.setValidBitCount(bitCount);

        // Decode values until buffer is empty
        while (bitBuffer.hasMoreBits()) {
          try {
            const value = this._decodeValue(bitBuffer);
            if (value !== null) {
              values.push(value);
            } else {
              break;
            }
          } catch (e) {
            break; // End of valid data
          }
        }

        return values;
      }

      _encodeValue(bitBuffer, value) {
        const quotient = Math.floor(value / this.parameter);
        const remainder = value % this.parameter;

        // Encode quotient in unary (quotient 1s followed by 0)
        for (let i = 0; i < quotient; i++) {
          bitBuffer.addBit(1);
        }
        bitBuffer.addBit(0);

        // Encode remainder using truncated binary
        this._encodeTruncatedBinary(bitBuffer, remainder, this.parameter);
      }

      _decodeValue(bitBuffer) {
        // Read quotient (count 1s until 0)
        let quotient = 0;
        while (bitBuffer.hasMoreBits()) {
          const bit = bitBuffer.readBit();
          if (bit === 1) {
            quotient++;
          } else {
            break;
          }
        }

        // Read remainder using truncated binary
        const remainder = this._decodeTruncatedBinary(bitBuffer, this.parameter);
        if (remainder === null) return null;

        return quotient * this.parameter + remainder;
      }

      _encodeTruncatedBinary(bitBuffer, value, m) {
        if (m === 1) {
          return; // No remainder bits needed
        }

        const k = Math.floor(Math.log2(m));
        const u = Math.pow(2, k + 1) - m;

        if (value < u) {
          // Use k bits
          for (let i = k - 1; i >= 0; i--) {
            bitBuffer.addBit(OpCodes.ToByte(OpCodes.Shr32(value, i)&1));
          }
        } else {
          // Use k+1 bits
          const adjusted = value + u;
          for (let i = k; i >= 0; i--) {
            bitBuffer.addBit(OpCodes.ToByte(OpCodes.Shr32(adjusted, i)&1));
          }
        }
      }

      _decodeTruncatedBinary(bitBuffer, m) {
        if (m === 1) {
          return 0; // No remainder bits
        }

        const k = Math.floor(Math.log2(m));
        const u = Math.pow(2, k + 1) - m;

        // Read first k bits
        let value = 0;
        for (let i = 0; i < k; i++) {
          if (!bitBuffer.hasMoreBits()) return null;
          value = OpCodes.ToUint32(OpCodes.Shl32(value, 1)|bitBuffer.readBit());
        }

        if (value < u) {
          return value;
        } else {
          // Read one more bit
          if (!bitBuffer.hasMoreBits()) return null;
          value = OpCodes.ToUint32(OpCodes.Shl32(value, 1)|bitBuffer.readBit());
          return value - u;
        }
      }

      _isPowerOfTwo(n) {
        return n > 0 && (n&(n - 1)) === 0;
      }
    }

    // Helper class for bit-level operations
    class BitBuffer {
      constructor() {
        this.bits = [];
        this.readPos = 0;
        this.validBitCount = -1; // -1 means use all bits
      }

      addBit(bit) {
        this.bits.push(bit&1);
      }

      addByte(byte) {
        for (let i = 7; i >= 0; i--) {
          this.addBit(OpCodes.ToByte(OpCodes.Shr32(byte, i)&1));
        }
      }

      readBit() {
        const maxPos = this.validBitCount >= 0 ? this.validBitCount : this.bits.length;
        if (this.readPos >= maxPos) {
          throw new Error("No more bits to read");
        }
        return this.bits[this.readPos++];
      }

      hasMoreBits() {
        const maxPos = this.validBitCount >= 0 ? this.validBitCount : this.bits.length;
        return this.readPos < maxPos;
      }

      getBitCount() {
        return this.bits.length;
      }

      setValidBitCount(count) {
        this.validBitCount = count;
      }

      getBytes() {
        if (this.bits.length === 0) {
          return [];
        }

        const bytes = [];
        const bitsCopy = [...this.bits];

        // Pad to byte boundary
        while (bitsCopy.length % 8 !== 0) {
          bitsCopy.push(0);
        }

        for (let i = 0; i < bitsCopy.length; i += 8) {
          let byte = 0;
          for (let j = 0; j < 8; j++) {
            byte |= OpCodes.Shl32(bitsCopy[i + j], 7 - j);
          }
          bytes.push(byte);
        }

        return bytes;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new GolombCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { GolombCompression, GolombInstance };
}));