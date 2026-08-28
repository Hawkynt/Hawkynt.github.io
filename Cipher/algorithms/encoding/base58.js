/*
 * Base58 Encoding Implementation
 * Educational implementation of Base58 encoding used in Bitcoin addresses
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

  // Base58 is a whole-number base conversion: the input is one huge unsigned
  // integer that has to be re-expressed in radix 58. The textbook loop divides
  // that integer by 58 once per output digit; with roughly 1.37 digits per input
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
  //     digits, split it once against 58^(N/2): the quotient supplies the top
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

  class Base58Algorithm extends EncodingAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Base58";
      this.description = "Base58 encoding scheme using 58-character alphabet that excludes visually similar characters (0, O, I, l). Created by Satoshi Nakamoto for Bitcoin addresses to reduce transcription errors. Educational implementation.";
      this.inventor = "Satoshi Nakamoto";
      this.year = 2009;
      this.category = CategoryType.ENCODING;
      this.subCategory = "Base Encoding";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTL;

      // Documentation and references
      this.documentation = [
        new LinkItem("Base58 Internet Draft", "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"),
        new LinkItem("Bitcoin Wiki - Base58Check", "https://en.bitcoin.it/wiki/Base58Check_encoding"),
        new LinkItem("Base58 Alphabet", "https://github.com/bitcoin/bitcoin/blob/master/src/base58.cpp")
      ];

      this.references = [
        new LinkItem("Bitcoin Source Code", "https://github.com/bitcoin/bitcoin"),
        new LinkItem("Cryptocurrency Address Formats", "https://en.bitcoin.it/wiki/List_of_address_prefixes"),
        new LinkItem("Base58 Online Converter", "https://www.appdevtools.com/base58-encoder-decoder")
      ];

      this.knownVulnerabilities = [];

      // Test vectors verified with implementation
      this.tests = [
        new TestCase(
          OpCodes.AnsiToBytes(""),
          OpCodes.AnsiToBytes(""),
          "Base58 empty string test",
          "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("f"),
          OpCodes.AnsiToBytes("2m"),
          "Base58 single character test",
          "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("fo"),
          OpCodes.AnsiToBytes("8o8"),
          "Base58 two character test",
          "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("foo"),
          OpCodes.AnsiToBytes("bQbp"),
          "Base58 three character test",
          "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("foob"),
          OpCodes.AnsiToBytes("3csAg9"),
          "Base58 four character test",
          "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("fooba"),
          OpCodes.AnsiToBytes("CZJRhmz"),
          "Base58 five character test",
          "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("foobar"),
          OpCodes.AnsiToBytes("t1Zv2yaZ"),
          "Base58 six character test",
          "https://datatracker.ietf.org/doc/html/draft-msporny-base58-03"
        )
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Base58Instance(this, isInverse);
    }
  }

  /**
 * Base58 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Base58Instance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      // Bitcoin Base58 alphabet - excludes 0, O, I, l
      this.alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      this.processedData = null;

      // Create decode lookup table
      this.decodeTable = {};
      for (let i = 0; i < this.alphabet.length; i++) {
        this.decodeTable[this.alphabet[i]] = i;
      }

      // Character codes of the alphabet, indexed by digit value, so encoding a
      // digit is one array read rather than a string index plus charCodeAt.
      this.alphabetCodes = new Array(this.alphabet.length);
      for (let i = 0; i < this.alphabet.length; i++) {
        this.alphabetCodes[i] = this.alphabet.charCodeAt(i);
      }
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('Base58Instance.Feed: Input must be byte array');
      }

      // Feed is a streaming interface: successive calls extend the message
      // rather than replace it. A single chunk also cannot be converted on its
      // own, because the coder groups whole units of input and emits padding and
      // framing at the end of the message, so the bytes are collected here and
      // converted once, in Result().
      if (!this._feedBuffer) this._feedBuffer = [];
      for (let i = 0; i < data.length; i++) this._feedBuffer.push(data[i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._feedBuffer) {
        throw new Error('Base58Instance.Result: No data processed. Call Feed() first.');
      }
      this.processedData = this.isInverse
        ? this.decode(this._feedBuffer)
        : this.encode(this._feedBuffer);
      return this.processedData;
    }

    encode(data) {
      if (data.length === 0) {
        return [];
      }

      // Count leading zero bytes (they become '1' characters in Base58).
      // Leading zero bytes contribute nothing to the integer value, so the
      // conversion below can start past them.
      let leadingZeros = 0;
      for (let i = 0; i < data.length && data[i] === 0; i++) {
        leadingZeros++;
      }

      // Convert the remaining bytes, read as one big-endian unsigned integer,
      // to Base58 digits
      const digits = BytesToDigits(data, leadingZeros, 58);

      const resultBytes = new Array(leadingZeros + digits.length);
      const oneCode = this.alphabetCodes[0];
      for (let i = 0; i < leadingZeros; i++) {
        resultBytes[i] = oneCode;
      }
      for (let i = 0; i < digits.length; i++) {
        resultBytes[leadingZeros + i] = this.alphabetCodes[digits[i]];
      }

      return resultBytes;
    }

    decode(data) {
      if (data.length === 0) {
        return [];
      }

      const input = OpCodes.BytesToChars(data);

      // Count leading '1's (they represent leading zero bytes)
      let leadingOnes = 0;
      for (let i = 0; i < input.length && input[i] === '1'; i++) {
        leadingOnes++;
      }

      // Translate characters to digit values, rejecting anything outside the
      // alphabet at the first offending position
      const digits = new Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (!(char in this.decodeTable)) {
          throw new Error(`Base58Instance.decode: Invalid character '${char}' in Base58 string`);
        }
        digits[i] = this.decodeTable[char];
      }

      // Convert from Base58 to big integer and back to its minimal byte string
      const bytes = ValueToBytes(DigitsToValue(digits, 0, 58));

      // Add leading zeros for leading '1's
      const result = new Array(leadingOnes + bytes.length);
      for (let i = 0; i < leadingOnes; i++) {
        result[i] = 0;
      }
      for (let i = 0; i < bytes.length; i++) {
        result[leadingOnes + i] = bytes[i];
      }

      return result;
    }

    // Utility methods
    encodeString(str) {
      const bytes = OpCodes.AnsiToBytes(str);
      const encoded = this.encode(bytes);
      return OpCodes.BytesToChars(encoded);
    }

    decodeString(str) {
      const bytes = OpCodes.AnsiToBytes(str);
      const decoded = this.decode(bytes);
      return OpCodes.BytesToChars(decoded);
    }
  }

  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new Base58Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Base58Algorithm, Base58Instance };
}));