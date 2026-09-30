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
  /** @type {int32} */
  const DIRECT_DIGITS = 32;

  /** @type {string} */
  const HEX_DIGITS = '0123456789abcdef';

  /**
   * Two lowercase hex digits of a byte.
   * @param {uint8} value - Byte
   * @returns {string} Two hex digits, most significant first
   */
  function HexByte(value) {
    return HEX_DIGITS.charAt(OpCodes.Shr32(value, 4)) + HEX_DIGITS.charAt(OpCodes.And32(value, 15));
  }

  /**
   * Value of one lowercase hex digit.
   * @param {string} digit - One character of '0123456789abcdef'
   * @returns {int32} Its value 0..15
   */
  function HexValue(digit) {
    return HEX_DIGITS.indexOf(digit);
  }

  /**
   * Read data[from..] as one big-endian unsigned integer.
   * @param {uint8[]} data - Source bytes
   * @param {int32} from - First index to read
   * @returns {BigInt} The value of those bytes, most significant byte first
   */
  function BytesToValue(data, from) {
    if (from >= data.length) {
      return 0n;
    }

    /** @type {string[]} */
    const parts = new Array(data.length - from);
    for (let i = from; i < data.length; i++) {
      parts[i - from] = HexByte(data[i]);
    }

    return BigInt('0x' + parts.join(''));
  }

  /**
   * Render a value as its minimal big-endian byte string.
   * @param {BigInt} value - Non-negative value
   * @returns {uint8[]} Minimal big-endian bytes, empty for zero
   */
  function ValueToBytes(value) {
    /** @type {uint8[]} */
    const empty = [];
    if (value === 0n) {
      return empty;
    }

    /** @type {string} */
    let hex = value.toString(16);
    if (hex.length % 2 === 1) {
      hex = '0' + hex;
    }

    /** @type {uint8[]} */
    const out = new Array(hex.length / 2);
    for (let i = 0, j = 0; i < hex.length; i += 2, j++) {
      out[j] = HexValue(hex.charAt(i)) * 16 + HexValue(hex.charAt(i + 1));
    }

    return out;
  }

  /**
   * One split point: radix^digits, the value that splits a number into its
   * top digits and its bottom `digits` digits.
   */
  class SplitPoint {
    /**
     * @param {int32} digits - Number of digits below the split
     * @param {BigInt} value - radix^digits
     */
    constructor(digits, value) {
      /** @type {int32} */
      this.digits = digits;
      /** @type {BigInt} */
      this.value = value;
    }
  }

  /**
   * Precompute radix^(DIRECT_DIGITS * 2^k) for every k needed to cover digitCount.
   * @param {int32} radix - Target radix
   * @param {int32} digitCount - Upper bound on the number of digits to render
   * @returns {SplitPoint[]} Ascending list of split points
   */
  function BuildSplitPoints(radix, digitCount) {
    /** @type {SplitPoint[]} */
    const points = [];
    /** @type {BigInt} */
    let value = BigInt(radix) ** BigInt(DIRECT_DIGITS);
    /** @type {int32} */
    let digits = DIRECT_DIGITS;

    while (digits < digitCount) {
      points.push(new SplitPoint(digits, value));
      value = value * value;
      digits = digits * 2;
    }

    return points;
  }

  /**
   * Write `value` as exactly `digitCount` radix digits (zero padded on the left,
   * most significant first) into out[offset .. offset+digitCount-1].
   * @param {BigInt} value - Value, known to be below radix^digitCount
   * @param {int32} radix - Target radix
   * @param {int32} digitCount - Exact number of digit slots to fill
   * @param {SplitPoint[]} points - Split points from BuildSplitPoints
   * @param {int32[]} out - Destination digit array
   * @param {int32} offset - First slot to fill
   */
  function RenderDigits(value, radix, digitCount, points, out, offset) {
    if (digitCount <= DIRECT_DIGITS) {
      /** @type {BigInt} */
      const big = BigInt(radix);
      /** @type {BigInt} */
      let rest = value;
      for (let i = offset + digitCount - 1; i >= offset; i--) {
        /** @type {int32} */
        const digit = Number(rest % big);
        out[i] = digit;
        rest = rest / big;
      }
      return;
    }

    // Largest precomputed split strictly below digitCount; because the split
    // points double, the two halves are each strictly smaller than digitCount.
    /** @type {int32} */
    let k = points.length - 1;
    while (k > 0 && points[k].digits >= digitCount) {
      k--;
    }

    /** @type {int32} */
    const lowDigits = points[k].digits;
    /** @type {BigInt} */
    const split = points[k].value;
    /** @type {BigInt} */
    const high = value / split;
    /** @type {BigInt} */
    const low = value - high * split;

    RenderDigits(high, radix, digitCount - lowDigits, points, out, offset);
    RenderDigits(low, radix, lowDigits, points, out, offset + digitCount - lowDigits);
  }

  /**
   * Convert data[from..], read as one big-endian unsigned integer, into its
   * minimal radix-N digit string (most significant digit first, no leading
   * zero digits, empty when the value is zero).
   * @param {uint8[]} data - Source bytes
   * @param {int32} from - First index to read
   * @param {int32} radix - Target radix
   * @returns {int32[]} Digit values in [0, radix)
   */
  function BytesToDigits(data, from, radix) {
    /** @type {BigInt} */
    const value = BytesToValue(data, from);
    /** @type {int32[]} */
    const empty = [];
    if (value === 0n) {
      return empty;
    }

    // Digits needed for a value below 2^bits, plus two slack digits so that
    // rounding in the logarithm can never make the estimate too small - the
    // tightest true margin over all sizes is barely one digit wide. Any surplus
    // shows up as leading zero digits and is stripped below.
    /** @type {int32} */
    const bits = (data.length - from) * 8;
    /** @type {int32} */
    const digitCount = Math.floor(bits * Math.LN2 / Math.log(radix)) + 2;

    /** @type {int32[]} */
    const out = new Array(digitCount);
    RenderDigits(value, radix, digitCount, BuildSplitPoints(radix, digitCount), out, 0);

    /** @type {int32} */
    let start = 0;
    while (start < digitCount && out[start] === 0) {
      start++;
    }

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
   * @param {int32[]} digits - Digit values, most significant first
   * @param {int32} from - First index to read
   * @param {int32} radix - Source radix
   * @returns {BigInt} The value of those digits
   */
  function DigitsToValue(digits, from, radix) {
    /** @type {int32} */
    const count = digits.length - from;
    if (count <= 0) {
      return 0n;
    }

    /** @type {BigInt} */
    const big = BigInt(radix);

    /** @type {int32} */
    let blocks = 1;
    while (blocks * DIRECT_DIGITS < count) {
      blocks = blocks * 2;
    }

    // Right aligned, so the last block holds the least significant digits and
    // any unused blocks at the front simply stay zero.
    /** @type {BigInt[]} */
    const parts = new Array(blocks);
    for (let b = 0; b < blocks; b++) {
      parts[b] = 0n;
    }
    /** @type {int32} */
    let end = digits.length;
    for (let b = blocks - 1; b >= 0 && end > from; b--) {
      /** @type {int32} */
      const start = Math.max(from, end - DIRECT_DIGITS);
      /** @type {BigInt} */
      let value = 0n;
      for (let i = start; i < end; i++) {
        value = value * big + BigInt(digits[i]);
      }

      parts[b] = value;
      end = start;
    }

    /** @type {BigInt} */
    let weight = big ** BigInt(DIRECT_DIGITS);
    /** @type {int32} */
    let len = blocks;
    while (len > 1) {
      /** @type {int32} */
      const half = len / 2;
      for (let i = 0; i < half; i++) {
        parts[i] = parts[2 * i] * weight + parts[2 * i + 1];
      }

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

      // Test vectors with bit-perfect accuracy
      this.tests = [
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
   * @returns {Base62Instance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Base62Instance(this, isInverse);
    }
  }

  /** @type {string} */
  const BASE62_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  /**
 * Base62 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAlgorithmInstance}
 */

  class Base62Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Base62Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.alphabet = OpCodes.AnsiToBytes(BASE62_ALPHABET);
      /** @type {int32} */
      this.base = 62;
      /** @type {uint8[]|null} */
      this.processedData = null;
      /** @type {uint8[]|null} */
      this._feedBuffer = null;

      // Decode lookup table indexed by character code: the digit value, or -1
      // for a character outside the alphabet
      /** @type {int32[]} */
      this.decodeTable = new Array(256);
      for (let i = 0; i < 256; i++) {
        this.decodeTable[i] = -1;
      }
      for (let i = 0; i < this.alphabet.length; i++) {
        this.decodeTable[this.alphabet[i]] = i;
      }
    }

    /**
     * Digit value of a character code.
     * @param {int32} code - Character code
     * @returns {int32} Its digit value, or -1 when it is not a Base62 character
     */
    digitOf(code) {
      if (code < 0 || code >= 256) {
        return -1;
      }
      return this.decodeTable[code];
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

      // Feed is a streaming interface: successive calls extend the message
      // rather than replace it. A single chunk also cannot be converted on its
      // own, because the coder groups whole units of input and emits padding and
      // framing at the end of the message, so the bytes are collected here and
      // converted once, in Result().
      if (!this._feedBuffer) {
        /** @type {uint8[]} */
        const fresh = [];
        this._feedBuffer = fresh;
      }
      for (let i = 0; i < data.length; i++) {
        this._feedBuffer.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._feedBuffer) {
        throw new Error('Base62Instance.Result: No data processed. Call Feed() first.');
      }
      if (this.isInverse) {
        this.processedData = this.decode(this._feedBuffer);
      } else {
        this.processedData = this.encode(this._feedBuffer);
      }
      return this.processedData;
    }

    /**
     * Encode bytes as Base62 characters
     * @param {uint8[]} data - Input bytes
     * @returns {uint8[]} ASCII Base62 characters
     */
    encode(data) {
      /** @type {uint8[]} */
      const empty = [];
      if (data.length === 0) {
        return empty;
      }

      // Leading zero bytes contribute nothing to the integer value, so the
      // conversion below can start past them
      /** @type {int32} */
      let leadingZeros = 0;
      for (let i = 0; i < data.length && data[i] === 0; i++) {
        leadingZeros++;
      }

      // An all-zero input carries no magnitude, only length, so it is spelled as
      // one zero digit per byte. Emitting a single digit regardless of length
      // made every all-zero input encode alike, and decode returned one byte
      // whatever went in - the only inputs this changes are ones that could not
      // survive a round trip before.
      /** @type {uint8} */
      const zeroCode = this.alphabet[0];
      if (leadingZeros === data.length) {
        /** @type {uint8[]} */
        const zeros = new Array(data.length);
        for (let i = 0; i < data.length; i++) {
          zeros[i] = zeroCode;
        }
        return zeros;
      }

      // Convert the remaining bytes, read as one big-endian unsigned integer,
      // to Base62 digits, then prefix one 'A' per leading zero byte
      /** @type {int32[]} */
      const digits = BytesToDigits(data, leadingZeros, this.base);

      /** @type {uint8[]} */
      const result = new Array(leadingZeros + digits.length);
      for (let i = 0; i < leadingZeros; i++) {
        result[i] = zeroCode;
      }
      for (let i = 0; i < digits.length; i++) {
        result[leadingZeros + i] = this.alphabet[digits[i]];
      }

      return result;
    }

    /**
     * Decode Base62 characters to bytes
     * @param {uint8[]} data - ASCII Base62 characters
     * @returns {uint8[]} Decoded bytes
     */
    decode(data) {
      /** @type {uint8[]} */
      const empty = [];
      if (data.length === 0) {
        return empty;
      }

      // Validate input contains only Base62 characters
      for (let i = 0; i < data.length; i++) {
        if (this.digitOf(data[i]) < 0) {
          throw new Error("Base62Instance.decode: Invalid character '" + String.fromCharCode(data[i]) + "'");
        }
      }

      // Count leading 'A' characters (representing zero bytes)
      /** @type {int32} */
      let leadingZeros = 0;
      for (let i = 0; i < data.length && data[i] === this.alphabet[0]; i++) {
        leadingZeros++;
      }

      // Convert Base62 to big integer and back to its minimal byte string
      /** @type {int32[]} */
      const digits = new Array(data.length - leadingZeros);
      for (let i = leadingZeros; i < data.length; i++) {
        digits[i - leadingZeros] = this.digitOf(data[i]);
      }

      /** @type {uint8[]} */
      const valueBytes = ValueToBytes(DigitsToValue(digits, 0, this.base));

      // Add leading zero bytes
      /** @type {uint8[]} */
      const bytes = new Array(leadingZeros + valueBytes.length);
      for (let i = 0; i < leadingZeros; i++) {
        bytes[i] = 0;
      }
      for (let i = 0; i < valueBytes.length; i++) {
        bytes[leadingZeros + i] = valueBytes[i];
      }

      if (bytes.length > 0) {
        return bytes;
      }
      /** @type {uint8[]} */
      const zero = [0];
      return zero;
    }

    // Utility methods for number encoding (common use case for URL shortening)

    /**
     * Encode a non-negative integer as a Base62 string
     * @param {float64} num - Non-negative integer to encode (exact up to 2^53)
     * @returns {string} Its Base62 spelling
     */
    encodeNumber(num) {
      if (num === 0) {
        return BASE62_ALPHABET.charAt(0);
      }

      /** @type {string} */
      let result = "";
      /** @type {float64} */
      let n = num;

      while (n > 0) {
        result = BASE62_ALPHABET.charAt(n % this.base) + result;
        n = Math.floor(n / this.base);
      }

      return result;
    }

    /**
     * Decode a Base62 string to a number
     * @param {string} encoded - Base62 characters
     * @returns {float64} The number they spell (exact up to 2^53)
     */
    decodeNumber(encoded) {
      if (!encoded || encoded.length === 0) {
        return 0;
      }

      /** @type {float64} */
      let num = 0;
      for (let i = 0; i < encoded.length; i++) {
        /** @type {int32} */
        const value = this.digitOf(encoded.charCodeAt(i));
        if (value < 0) {
          throw new Error("Base62Instance.decodeNumber: Invalid character '" + encoded.charAt(i) + "'");
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