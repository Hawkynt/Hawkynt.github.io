/*
 * Base62 Encoding Implementation
 * Educational implementation of Base62 encoding for URL shortening and ID generation
 * (c)2006-2025 Hawkynt
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

  // ===== BASE CONVERSION HELPERS =====

  // Base62 is a whole-number base conversion: the input is one huge unsigned
  // integer that has to be re-expressed in radix 62. The textbook loop divides
  // that integer by 62 once per output digit; with roughly 1.34 digits per input
  // byte, and every division touching the whole remaining number, the cost grows
  // with the square of the input and a megabyte takes tens of minutes.
  //
  // The conversion below produces exactly the same digits from the same
  // arithmetic, but arranges it so the engine's own big-integer routines do the
  // heavy lifting:
  //
  //   * the input is turned into a BigInt through a hex string, which the engine
  //     parses in linear time, instead of accumulating byte by byte (which is
  //     itself quadratic - every step multiplies the whole accumulator by 256);
  //   * the digits are produced by repeated halving. To render a value as N
  //     digits, split it once against 62^(N/2): the quotient supplies the top
  //     half of the digits and the remainder the bottom half. Each half is then
  //     split again, down to a small block converted directly. One division at
  //     the top replaces N/2 of them, and the same holds recursively.
  //
  // Whole-number base conversion into a non-power-of-two radix cannot be made
  // linear without changing the output, so this is still superlinear - but the
  // work is now a handful of large divisions rather than millions of small ones.

  // Number of digits converted directly at the bottom of the recursion.
  const DIRECT_DIGITS = 32;

  const HEX_BYTE = new Array(256);
  for (let i = 0; i < 256; i++)
    HEX_BYTE[i] = (i < 16 ? '0' : '') + i.toString(16);

  const HEX_VALUE = {};
  for (let i = 0; i < 16; i++)
    HEX_VALUE['0123456789abcdef'.charAt(i)] = i;

  /**
   * Read data[from..] as one big-endian unsigned integer.
   * @param {uint8[]} data - Source bytes
   * @param {number} from - First index to read
   * @returns {BigInt} The value of those bytes, most significant byte first
   */
  function BytesToValue(data, from) {
    if (from >= data.length)
      return 0n;

    const parts = new Array(data.length - from);
    for (let i = from; i < data.length; i++)
      parts[i - from] = HEX_BYTE[data[i]];

    return BigInt('0x' + parts.join(''));
  }

  /**
   * Render a value as its minimal big-endian byte string.
   * @param {BigInt} value - Non-negative value
   * @returns {uint8[]} Minimal big-endian bytes, empty for zero
   */
  function ValueToBytes(value) {
    if (value === 0n)
      return [];

    let hex = value.toString(16);
    if (hex.length % 2 === 1)
      hex = '0' + hex;

    const out = new Array(hex.length / 2);
    for (let i = 0, j = 0; i < hex.length; i += 2, j++)
      out[j] = HEX_VALUE[hex.charAt(i)] * 16 + HEX_VALUE[hex.charAt(i + 1)];

    return out;
  }

  /**
   * Precompute radix^(DIRECT_DIGITS * 2^k) for every k needed to cover digitCount.
   * @param {number} radix - Target radix
   * @param {number} digitCount - Upper bound on the number of digits to render
   * @returns {Array} Ascending list of { digits, value } split points
   */
  function BuildSplitPoints(radix, digitCount) {
    const points = [];
    let value = BigInt(radix) ** BigInt(DIRECT_DIGITS);
    let digits = DIRECT_DIGITS;

    while (digits < digitCount) {
      points.push({ digits: digits, value: value });
      value = value * value;
      digits = digits * 2;
    }

    return points;
  }

  /**
   * Write `value` as exactly `digitCount` radix digits (zero padded on the left,
   * most significant first) into out[offset .. offset+digitCount-1].
   * @param {BigInt} value - Value, known to be below radix^digitCount
   * @param {number} radix - Target radix
   * @param {number} digitCount - Exact number of digit slots to fill
   * @param {Array} points - Split points from BuildSplitPoints
   * @param {number[]} out - Destination digit array
   * @param {number} offset - First slot to fill
   */
  function RenderDigits(value, radix, digitCount, points, out, offset) {
    if (digitCount <= DIRECT_DIGITS) {
      const big = BigInt(radix);
      let rest = value;
      for (let i = offset + digitCount - 1; i >= offset; i--) {
        out[i] = Number(rest % big);
        rest = rest / big;
      }
      return;
    }

    // Largest precomputed split strictly below digitCount; because the split
    // points double, the two halves are each strictly smaller than digitCount.
    let k = points.length - 1;
    while (k > 0 && points[k].digits >= digitCount)
      k--;

    const lowDigits = points[k].digits;
    const split = points[k].value;
    const high = value / split;
    const low = value - high * split;

    RenderDigits(high, radix, digitCount - lowDigits, points, out, offset);
    RenderDigits(low, radix, lowDigits, points, out, offset + digitCount - lowDigits);
  }

  /**
   * Convert data[from..], read as one big-endian unsigned integer, into its
   * minimal radix-N digit string (most significant digit first, no leading
   * zero digits, empty when the value is zero).
   * @param {uint8[]} data - Source bytes
   * @param {number} from - First index to read
   * @param {number} radix - Target radix
   * @returns {number[]} Digit values in [0, radix)
   */
  function BytesToDigits(data, from, radix) {
    const value = BytesToValue(data, from);
    if (value === 0n)
      return [];

    // Digits needed for a value below 2^bits, plus two slack digits so that
    // rounding in the logarithm can never make the estimate too small - the
    // tightest true margin over all sizes is barely one digit wide. Any surplus
    // shows up as leading zero digits and is stripped below.
    const bits = (data.length - from) * 8;
    const digitCount = Math.floor(bits * Math.LN2 / Math.log(radix)) + 2;

    const out = new Array(digitCount);
    RenderDigits(value, radix, digitCount, BuildSplitPoints(radix, digitCount), out, 0);

    let start = 0;
    while (start < digitCount && out[start] === 0)
      start++;

    return start === 0 ? out : out.slice(start);
  }

  /**
   * Read digits[from..] as one radix-N number.
   *
   * The mirror image of the split above: rather than folding one digit at a time
   * into an accumulator that grows to the full width (quadratic again), the
   * digits are converted in small blocks and the blocks are then joined
   * pairwise, so each multiplication carries half the number rather than all of
   * it.
   *
   * @param {number[]} digits - Digit values, most significant first
   * @param {number} from - First index to read
   * @param {number} radix - Source radix
   * @returns {BigInt} The value of those digits
   */
  function DigitsToValue(digits, from, radix) {
    const count = digits.length - from;
    if (count <= 0)
      return 0n;

    const big = BigInt(radix);

    let blocks = 1;
    while (blocks * DIRECT_DIGITS < count)
      blocks = blocks * 2;

    // Right aligned, so the last block holds the least significant digits and
    // any unused blocks at the front simply stay zero.
    const parts = new Array(blocks).fill(0n);
    let end = digits.length;
    for (let b = blocks - 1; b >= 0 && end > from; b--) {
      const start = Math.max(from, end - DIRECT_DIGITS);
      let value = 0n;
      for (let i = start; i < end; i++)
        value = value * big + BigInt(digits[i]);

      parts[b] = value;
      end = start;
    }

    let weight = big ** BigInt(DIRECT_DIGITS);
    let len = blocks;
    while (len > 1) {
      const half = len / 2;
      for (let i = 0; i < half; i++)
        parts[i] = parts[2 * i] * weight + parts[2 * i + 1];

      weight = weight * weight;
      len = half;
    }

    return parts[0];
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class Base62Algorithm extends EncodingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Base62";
      this.description = "Base62 encoding using 62-character alphabet (A-Z, a-z, 0-9) for URL-safe, compact encoding. Commonly used in URL shortening services like bit.ly and for generating user-friendly database IDs. No padding required.";
      this.inventor = "URL Shortening Industry";
      this.year = 2000;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Base Encoding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.INTL;

      // Documentation and references
      this.documentation = [
        new LinkItem("Base62 Wikipedia Article", "https://en.wikipedia.org/wiki/Base62"),
        new LinkItem("URL Shortening Best Practices", "https://developers.google.com/url-shortener/v1/getting_started"),
        new LinkItem("RFC 4648 - Base Encodings Background", "https://tools.ietf.org/html/rfc4648")
      ];

      this.references = [
        new LinkItem("Base62 Online Encoder/Decoder", "https://base62.io/"),
        new LinkItem("Instagram Engineering - Sharding IDs", "https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c"),
        new LinkItem("System Design - URL Shortener", "https://www.educative.io/courses/grokking-the-system-design-interview/m2ygV4E81AR")
      ];

      this.knownVulnerabilities = [];

      // Test vectors with bit-perfect accuracy - initialize after OpCodes is available
      this.tests = this.createTestVectors();
    }

    createTestVectors() {
      // Ensure OpCodes is available
      if (!global.OpCodes) {
        return [];
      }

      return [
        new TestCase(
          OpCodes.AnsiToBytes(""),
          OpCodes.AnsiToBytes(""),
          "Base62 empty string test",
          "https://en.wikipedia.org/wiki/Base62"
        ),
        new TestCase(
          [0],
          OpCodes.AnsiToBytes("A"),
          "Base62 zero byte test - maps to first alphabet character",
          "https://en.wikipedia.org/wiki/Base62"
        ),
        new TestCase(
          [255],
          OpCodes.AnsiToBytes("EH"),
          "Base62 maximum byte test - 255 in Base62",
          "https://en.wikipedia.org/wiki/Base62"
        ),
        new TestCase(
          [72],
          OpCodes.AnsiToBytes("BK"),
          "Base62 single byte - 72 ('H' ASCII)",
          "https://en.wikipedia.org/wiki/Base62"
        ),
        new TestCase(
          [1, 2, 3],
          OpCodes.AnsiToBytes("RLV"),
          "Base62 three byte array test",
          "https://en.wikipedia.org/wiki/Base62"
        ),
        new TestCase(
          [0, 1],
          OpCodes.AnsiToBytes("AB"),
          "Base62 leading zero byte test",
          "https://en.wikipedia.org/wiki/Base62"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Base62Instance(this, isInverse);
    }
  }

  /**
 * Base62 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Base62Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.alphabet = OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789");
      this.base = 62;
      this.processedData = null;

      // Create decode lookup table
      this.decodeTable = {};
      const alphabetStr = OpCodes.BytesToChars(this.alphabet);
      for (let i = 0; i < alphabetStr.length; i++) {
        this.decodeTable[alphabetStr[i]] = i;
      }
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('Base62Instance.Feed: Input must be byte array');
      }

      if (this.isInverse) {
        this.processedData = this.decode(data);
      } else {
        this.processedData = this.encode(data);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (this.processedData === null) {
        throw new Error('Base62Instance.Result: No data processed. Call Feed() first.');
      }
      return this.processedData;
    }

    encode(data) {
      if (data.length === 0) {
        return [];
      }

      // Leading zero bytes contribute nothing to the integer value, so the
      // conversion below can start past them
      let leadingZeros = 0;
      for (let i = 0; i < data.length && data[i] === 0; i++) {
        leadingZeros++;
      }

      // An all-zero input carries no magnitude, only length, so it is spelled as
      // one zero digit per byte. Emitting a single digit regardless of length
      // made every all-zero input encode alike, and decode returned one byte
      // whatever went in - the only inputs this changes are ones that could not
      // survive a round trip before.
      if (leadingZeros === data.length) {
        return new Array(data.length).fill(this.alphabet[0]);
      }

      // Convert the remaining bytes, read as one big-endian unsigned integer,
      // to Base62 digits, then prefix one 'A' per leading zero byte
      const digits = BytesToDigits(data, leadingZeros, this.base);

      const result = new Array(leadingZeros + digits.length);
      const zeroCode = this.alphabet[0];
      for (let i = 0; i < leadingZeros; i++) {
        result[i] = zeroCode;
      }
      for (let i = 0; i < digits.length; i++) {
        result[leadingZeros + i] = this.alphabet[digits[i]];
      }

      return result;
    }

    decode(data) {
      if (data.length === 0) {
        return [];
      }

      const input = OpCodes.BytesToChars(data);

      // Validate input contains only Base62 characters
      for (let i = 0; i < input.length; i++) {
        if (!(input[i] in this.decodeTable)) {
          throw new Error(`Base62Instance.decode: Invalid character '${input[i]}'`);
        }
      }

      // Count leading 'A' characters (representing zero bytes)
      let leadingZeros = 0;
      const alphabetStr = OpCodes.BytesToChars(this.alphabet);
      for (let i = 0; i < input.length && input[i] === alphabetStr[0]; i++) {
        leadingZeros++;
      }

      // Convert Base62 to big integer and back to its minimal byte string
      const digits = new Array(input.length - leadingZeros);
      for (let i = leadingZeros; i < input.length; i++) {
        digits[i - leadingZeros] = this.decodeTable[input[i]];
      }

      const valueBytes = ValueToBytes(DigitsToValue(digits, 0, this.base));

      // Add leading zero bytes
      const bytes = new Array(leadingZeros + valueBytes.length);
      for (let i = 0; i < leadingZeros; i++) {
        bytes[i] = 0;
      }
      for (let i = 0; i < valueBytes.length; i++) {
        bytes[leadingZeros + i] = valueBytes[i];
      }

      return bytes.length > 0 ? bytes : [0];
    }

    // Utility methods for number encoding (common use case for URL shortening)
    encodeNumber(num) {
      if (num === 0) {
        return String.fromCharCode(this.alphabet[0]);
      }

      const alphabetStr = OpCodes.BytesToChars(this.alphabet);
      let result = "";
      let n = num;

      while (n > 0) {
        result = alphabetStr[n % this.base] + result;
        n = Math.floor(n / this.base);
      }

      return result;
    }

    decodeNumber(encoded) {
      if (!encoded || encoded.length === 0) {
        return 0;
      }

      let num = 0;
      for (let i = 0; i < encoded.length; i++) {
        const value = this.decodeTable[encoded[i]];
        if (value === undefined) {
          throw new Error(`Base62Instance.decodeNumber: Invalid character '${encoded[i]}'`);
        }
        num = num * this.base + value;
      }

      return num;
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new Base62Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Base62Algorithm, Base62Instance };
}));