/*
 * FPE (Format-Preserving Encryption) Mode of Operation
 * General framework for format-preserving encryption schemes
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
    root.FPE = factory(root.AlgorithmFramework, root.OpCodes);
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

  class FpeAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "FPE";
      this.description = "FPE (Format-Preserving Encryption) is a general framework for encryption schemes that preserve the format and structure of input data. It enables encryption of structured data like credit card numbers, phone numbers, and database fields while maintaining their original format, length, and character sets. Input must be 7-bit text containing at least two characters of the configured alphabet; characters outside the alphabet are passed through unchanged when format preservation is on. Bytes with the high bit set are rejected, since the text conversion cannot represent them and both directions must agree on which characters are encrypted.";
      this.inventor = "Various (NIST standardization)";
      this.year = 2009;
      this.category = CategoryType.MODE;
      this.subCategory = "Format-Preserving Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL; // Application-specific
      this.complexity = ComplexityType.RESEARCH;
      this.country = CountryCode.US;

      this.RequiresIV = false; // Uses tweak instead of IV
      this.SupportedIVSizes = []; // Not applicable for FPE

      // Format-preserving encryption is defined on text over an alphabet, so a
      // sweep with arbitrary bytes must expect a refusal rather than a result.
      this.restrictedInputDomain = "7-bit text with at least two characters of the configured alphabet";

      this.documentation = [
        new LinkItem("NIST SP 800-38G", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf"),
        new LinkItem("Format-Preserving Encryption Survey", "https://web.cs.ucdavis.edu/~rogaway/papers/fpe.pdf"),
        new LinkItem("FF1 and FF3 Modes", "https://csrc.nist.gov/publications/detail/sp/800-38g/final")
      ];

      this.references = [
        new LinkItem("Python FPE Implementation", "https://github.com/mysto/python-fpe"),
        new LinkItem("Java FPE Library", "https://github.com/privacylogistics/java-fpe"),
        new LinkItem("C++ FPE Implementation", "https://github.com/capitalone/fpe")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Small Domain Security", "FPE security degrades with small alphabets or short strings. Minimum security requires alphabet size × string length ≥ 1,000,000."),
        new Vulnerability("Implementation Complexity", "Proper FPE requires careful implementation of cycle-walking, radix conversion, and PRF construction to avoid bias and maintain security.")
      ];

      // NIST FF1 sample values (FF1samples.pdf, published alongside SP 800-38G
      // on the NIST "Example Values" page). The radix-36 samples use the
      // canonical base-36 alphabet, digits then lowercase letters.
      this.tests = [
        {
          text: "NIST FF1 sample 1 - AES-128, radix 10, empty tweak",
          uri: "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values",
          cipher: "AES",
          input: OpCodes.AnsiToBytes("0123456789"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          tweak: [],
          alphabet: "0123456789",
          expected: OpCodes.AnsiToBytes("2433477484")
        },
        {
          text: "NIST FF1 sample 2 - AES-128, radix 10, 10-byte tweak",
          uri: "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values",
          cipher: "AES",
          input: OpCodes.AnsiToBytes("0123456789"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          tweak: OpCodes.Hex8ToBytes("39383736353433323130"),
          alphabet: "0123456789",
          expected: OpCodes.AnsiToBytes("6124200773")
        },
        {
          text: "NIST FF1 sample 3 - AES-128, radix 36, 11-byte tweak",
          uri: "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values",
          cipher: "AES",
          input: OpCodes.AnsiToBytes("0123456789abcdefghi"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          tweak: OpCodes.Hex8ToBytes("3737373770717273373737"),
          alphabet: "0123456789abcdefghijklmnopqrstuvwxyz",
          expected: OpCodes.AnsiToBytes("a9tv40mll9kdu509eum")
        },
        {
          text: "NIST FF1 sample 4 - AES-192, radix 10, empty tweak",
          uri: "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values",
          cipher: "AES",
          input: OpCodes.AnsiToBytes("0123456789"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3cef4359d8d580aa4f"),
          tweak: [],
          alphabet: "0123456789",
          expected: OpCodes.AnsiToBytes("2830668132")
        },
        {
          text: "NIST FF1 sample 7 - AES-256, radix 10, empty tweak",
          uri: "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values",
          cipher: "AES",
          input: OpCodes.AnsiToBytes("0123456789"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3cef4359d8d580aa4f7f036d6f04fc6a94"),
          tweak: [],
          alphabet: "0123456789",
          expected: OpCodes.AnsiToBytes("6657667009")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new FpeModeInstance(this, isInverse);
    }
  }

  /**
   * Input split into alphabet and format characters
   */
  class FpeCharacters {
    /**
     * @param {string[]} alphabetChars - Characters of the alphabet, in order
     * @param {string[]} formatChars - Other characters, in order
     * @param {string[]} positions - Kind of each input character: 'alphabet' or 'format'
     */
    constructor(alphabetChars, formatChars, positions) {
      /** @type {string[]} */
      this.alphabetChars = alphabetChars;
      /** @type {string[]} */
      this.formatChars = formatChars;
      /** @type {string[]} */
      this.positions = positions;
    }
  }

  /**
 * FpeMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class FpeModeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {FpeAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {IBlockCipherInstance|null} */
      this.blockCipher = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this.key = null;
      /** @type {uint8[]} */
      this.tweak = [];
      /** @type {string} */
      this.alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"; // Default alphabet
      /** @type {boolean} */
      this.preserveFormatChars = true; // Preserve non-alphabet characters
    }

    /**
     * Set the underlying block cipher instance (typically AES)
     * @param {IBlockCipherInstance} cipher - The block cipher to use
     */
    setBlockCipher(cipher) {
      if (!cipher || !cipher.BlockSize) {
        throw new Error("Invalid block cipher instance");
      }
      this.blockCipher = cipher;
    }

    /**
     * Set the encryption key
     * @param {uint8[]} key - Key for block cipher
     */
    setKey(key) {
      if (!key || key.length === 0) {
        throw new Error("Key cannot be empty");
      }
      this.key = [...key];
    }

    /**
     * Set the tweak value
     * @param {uint8[]} tweak - Tweak value for FPE mode
     */
    setTweak(tweak) {
      if (tweak) {
        this.tweak = [...tweak];
      } else {
        /** @type {uint8[]} */
        const empty = [];
        this.tweak = empty;
      }
    }

    /**
     * Set the alphabet for format-preserving encryption
     * @param {string} alphabet - Character set to preserve
     */
    setAlphabet(alphabet) {
      if (!alphabet || alphabet.length < 2) {
        throw new Error("Alphabet must contain at least 2 characters");
      }
      this.alphabet = alphabet;
    }

    /**
     * Set whether to preserve format characters (non-alphabet)
     * @param {boolean} preserve - Whether to preserve format characters
     */
    setPreserveFormatChars(preserve) {
      this.preserveFormatChars = preserve;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.key) {
        throw new Error("Key must be set for FPE mode.");
      }
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.key) {
        throw new Error("Key must be set for FPE mode.");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      // FPE works on text: it splits the input into alphabet characters and
      // format characters, and both directions must agree on which is which.
      // The ANSI conversion below is 7-bit, so a byte with the high bit set came
      // back as a different character - sometimes one that IS in the alphabet,
      // which changed the number of encrypted symbols and desynchronized the
      // Feistel split. Refuse such input instead of corrupting it silently.
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const byte = this.inputBuffer[i];
        if (byte < 0 || byte > 0x7F)
          throw new Error("FPE operates on 7-bit text; byte " + byte + " at offset " + i + " is outside that range");
      }

      // Convert input to string for processing
      const inputStr = OpCodes.BytesToAnsi(this.inputBuffer);

      // Extract alphabet characters and their positions
      /** @type {FpeCharacters} */
      const extracted = this._extractCharacters(inputStr);
      /** @type {string[]} */
      const alphabetChars = extracted.alphabetChars;
      /** @type {string[]} */
      const formatChars = extracted.formatChars;
      /** @type {string[]} */
      const positions = extracted.positions;

      if (alphabetChars.length < 2) {
        throw new Error("Input must contain at least 2 alphabet characters for FPE");
      }

      // Apply FPE to alphabet characters only
      const processedChars = this._applyFPE(alphabetChars);

      // Reconstruct string with format characters preserved
      const result = this._reconstructString(processedChars, formatChars, positions);

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return OpCodes.AnsiToBytes(result);
    }

    /**
     * Extract alphabet and format characters with their positions
     * @param {string} input - Input string
     * @returns {FpeCharacters} Extracted character information
     */
    _extractCharacters(input) {
      /** @type {string[]} */
      const alphabetChars = [];
      /** @type {string[]} */
      const formatChars = [];
      /** @type {string[]} */
      const positions = [];

      for (let i = 0; i < input.length; i++) {
        /** @type {string} */
        const char = input.charAt(i);
        if (this.alphabet.includes(char)) {
          alphabetChars.push(char);
          positions.push('alphabet');
        } else if (this.preserveFormatChars) {
          formatChars.push(char);
          positions.push('format');
        } else {
          throw new Error("Character '" + char + "' not in alphabet and format preservation disabled");
        }
      }

      const extracted = new FpeCharacters(alphabetChars, formatChars, positions);
      return extracted;
    }

    /**
     * Apply FPE transformation to alphabet characters
     * @param {string[]} chars - Alphabet characters to transform
     * @returns {string[]} Transformed characters
     */
    _applyFPE(chars) {
      // Convert characters to numerals: the position in the alphabet is the
      // numeral value, so the alphabet length is the radix.
      /** @type {int32[]} */
      const numerals = new Array(chars.length);
      for (let i = 0; i < chars.length; i++) numerals[i] = this.alphabet.indexOf(chars[i]);

      if (numerals.length < 2) {
        return chars; // Can't apply a Feistel network to a single character
      }

      const result = this._ff1(numerals, this.alphabet.length);
      /** @type {string[]} */
      const transformed = new Array(result.length);
      for (let i = 0; i < result.length; i++) transformed[i] = this.alphabet.charAt(result[i]);
      return transformed;
    }

    /**
     * Numeral string to integer, most significant numeral first
     * @private
     * @param {int32[]} numerals
     * @param {int32} radix
     * @returns {BigInt}
     */
    _numRadix(numerals, radix) {
      /** @type {BigInt} */
      const base = BigInt(radix);
      /** @type {BigInt} */
      let value = 0n;
      for (let i = 0; i < numerals.length; i++) value = value * base + BigInt(numerals[i]);
      return value;
    }

    /**
     * Integer to a numeral string of the given length
     * @private
     * @param {BigInt} value
     * @param {int32} length
     * @param {int32} radix
     * @returns {int32[]}
     */
    _strRadix(value, length, radix) {
      /** @type {BigInt} */
      const base = BigInt(radix);
      /** @type {int32[]} */
      const numerals = new Array(length); // every element is written below
      /** @type {BigInt} */
      let remaining = value;
      for (let i = length - 1; i >= 0; i--) {
        numerals[i] = OpCodes.ToInt(Number(remaining % base));
        remaining = remaining / base;
      }
      return numerals;
    }

    /**
     * Big-endian byte string to integer
     * @private
     * @param {uint8[]} bytes
     * @returns {BigInt}
     */
    _bytesToInt(bytes) {
      /** @type {BigInt} */
      let value = 0n;
      for (let i = 0; i < bytes.length; i++) value = value * 256n + BigInt(bytes[i]);
      return value;
    }

    /**
     * Integer to a big-endian byte string of the given length
     * @private
     * @param {BigInt} value
     * @param {int32} length
     * @returns {uint8[]}
     */
    _intToBytes(value, length) {
      const bytes = OpCodes.CreateArray(length, 0);
      /** @type {BigInt} */
      let remaining = value;
      for (let i = length - 1; i >= 0; i--) {
        bytes[i] = OpCodes.ToByte(Number(remaining % 256n));
        remaining = remaining / 256n;
      }
      return bytes;
    }

    /**
     * Apply the underlying block cipher to one block
     * @private
     * @param {uint8[]} block
     * @returns {uint8[]}
     */
    _ciph(block) {
      /** @type {IBlockCipherInstance} */
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(block);
      /** @type {uint8[]} */
      const enciphered = cipher.Result();
      return enciphered;
    }

    /**
     * PRF from SP 800-38G: CBC-MAC over a block-aligned string with a zero IV
     * @private
     * @param {uint8[]} data
     * @returns {uint8[]}
     */
    _prf(data) {
      let y = OpCodes.CreateArray(16, 0);
      for (let i = 0; i < data.length; i += 16) {
        y = this._ciph(OpCodes.XorArrays(y, data.slice(i, i + 16)));
      }
      return y;
    }

    /**
     * FF1 encryption and decryption (NIST SP 800-38G algorithms 7 and 8)
     * @private
     * @param {int32[]} symbols
     * @param {int32} radix
     * @returns {int32[]}
     */
    _ff1(symbols, radix) {
      const n = symbols.length;
      const t = this.tweak.length;
      const u = Math.floor(n / 2);
      const v = n - u;

      const b = Math.ceil(Math.ceil(v * Math.log2(radix)) / 8);
      const d = 4 * Math.ceil(b / 4) + 4;

      const nBytes = OpCodes.Unpack32BE(n);
      const tBytes = OpCodes.Unpack32BE(t);
      /** @type {uint8[]} */
      const p = [
        1, 2, 1,
        OpCodes.And32(OpCodes.Shr32(radix, 16), 0xFF),
        OpCodes.And32(OpCodes.Shr32(radix, 8), 0xFF),
        OpCodes.And32(radix, 0xFF),
        10,
        u % 256,
        nBytes[0], nBytes[1], nBytes[2], nBytes[3],
        tBytes[0], tBytes[1], tBytes[2], tBytes[3]
      ];

      const padLength = ((-t - b - 1) % 16 + 16) % 16;

      let a = symbols.slice(0, u);
      let bHalf = symbols.slice(u);

      // Rounds 0..9 when encrypting, 9..0 when decrypting
      for (let roundIndex = 0; roundIndex < 10; roundIndex++) {
        const round = this.isInverse ? 9 - roundIndex : roundIndex;
        const source = this.isInverse ? a : bHalf;
        /** @type {uint8[]} */
        const q = [];
        for (let i = 0; i < this.tweak.length; i++) q.push(this.tweak[i]);
        for (let i = 0; i < padLength; i++) q.push(0);
        q.push(round);
        const sourceBytes = this._intToBytes(this._numRadix(source, radix), b);
        for (let i = 0; i < sourceBytes.length; i++) q.push(sourceBytes[i]);

        /** @type {uint8[]} */
        const prfInput = [];
        for (let i = 0; i < p.length; i++) prfInput.push(p[i]);
        for (let i = 0; i < q.length; i++) prfInput.push(q[i]);
        const r = this._prf(prfInput);

        /** @type {uint8[]} */
        const s = [];
        for (let i = 0; i < r.length; i++) s.push(r[i]);
        for (let j = 1; s.length < d; j++) {
          const counter = this._intToBytes(BigInt(j), 16);
          const block = this._ciph(OpCodes.XorArrays(r, counter));
          for (let i = 0; i < block.length; i++) s.push(block[i]);
        }
        const y = this._bytesToInt(s.slice(0, d));

        const m = (round % 2 === 0) ? u : v;
        /** @type {BigInt} */
        const modulus = BigInt(radix) ** BigInt(m);

        if (this.isInverse) {
          /** @type {BigInt} */
          let c = (this._numRadix(bHalf, radix) - y) % modulus;
          if (c < 0n) c += modulus;
          bHalf = a;
          a = this._strRadix(c, m, radix);
        } else {
          /** @type {BigInt} */
          const c = (this._numRadix(a, radix) + y) % modulus;
          a = bHalf;
          bHalf = this._strRadix(c, m, radix);
        }
      }

      return a.concat(bHalf);
    }

    /**
     * Reconstruct string with format characters preserved
     * @param {string[]} alphabetChars - Processed alphabet characters
     * @param {string[]} formatChars - Original format characters
     * @param {string[]} positions - Kind of each character: 'alphabet' or 'format'
     * @returns {string} Reconstructed string
     */
    _reconstructString(alphabetChars, formatChars, positions) {
      /** @type {string[]} */
      const result = [];
      let alphabetIndex = 0;
      let formatIndex = 0;

      for (let i = 0; i < positions.length; i++) {
        if (positions[i] === 'alphabet') {
          result.push(alphabetChars[alphabetIndex++]);
        } else {
          result.push(formatChars[formatIndex++]);
        }
      }

      return result.join('');
    }

  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new FpeAlgorithm());

  // ===== EXPORTS =====

  return { FpeAlgorithm, FpeModeInstance };
}));