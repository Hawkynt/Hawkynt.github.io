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
 * FpeMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class FpeModeInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.blockCipher = null;
      this.inputBuffer = [];
      this.key = null;
      this.tweak = [];
      this.alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"; // Default alphabet
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
     * @param {Array} key - Key for block cipher
     */
    setKey(key) {
      if (!key || key.length === 0) {
        throw new Error("Key cannot be empty");
      }
      this.key = [...key];
    }

    /**
     * Set the tweak value
     * @param {Array} tweak - Tweak value for FPE mode
     */
    setTweak(tweak) {
      this.tweak = tweak ? [...tweak] : [];
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
          throw new Error(`FPE operates on 7-bit text; byte ${byte} at offset ${i} is outside that range`);
      }

      // Convert input to string for processing
      const inputStr = OpCodes.BytesToAnsi(this.inputBuffer);

      // Extract alphabet characters and their positions
      const { alphabetChars, formatChars, positions } = this._extractCharacters(inputStr);

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
     * @returns {Object} Extracted character information
     */
    _extractCharacters(input) {
      const alphabetChars = [];
      const formatChars = [];
      const positions = [];

      for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (this.alphabet.includes(char)) {
          alphabetChars.push(char);
          positions.push({ type: 'alphabet', index: alphabetChars.length - 1 });
        } else if (this.preserveFormatChars) {
          formatChars.push(char);
          positions.push({ type: 'format', index: formatChars.length - 1 });
        } else {
          throw new Error(`Character '${char}' not in alphabet and format preservation disabled`);
        }
      }

      return { alphabetChars, formatChars, positions };
    }

    /**
     * Apply FPE transformation to alphabet characters
     * @param {Array} chars - Alphabet characters to transform
     * @returns {Array} Transformed characters
     */
    _applyFPE(chars) {
      // Convert characters to numerals: the position in the alphabet is the
      // numeral value, so the alphabet length is the radix.
      const numerals = chars.map(char => this.alphabet.indexOf(char));

      if (numerals.length < 2) {
        return chars; // Can't apply a Feistel network to a single character
      }

      const result = this._ff1(numerals, this.alphabet.length);
      return result.map(num => this.alphabet[num]);
    }

    /**
     * Numeral string to integer, most significant numeral first
     * @private
     */
    _numRadix(numerals, radix) {
      const base = BigInt(radix);
      let value = 0n;
      for (let i = 0; i < numerals.length; i++) value = value * base + BigInt(numerals[i]);
      return value;
    }

    /**
     * Integer to a numeral string of the given length
     * @private
     */
    _strRadix(value, length, radix) {
      const base = BigInt(radix);
      const numerals = new Array(length).fill(0);
      let remaining = value;
      for (let i = length - 1; i >= 0; i--) {
        numerals[i] = Number(remaining % base);
        remaining = remaining / base;
      }
      return numerals;
    }

    /**
     * Big-endian byte string to integer
     * @private
     */
    _bytesToInt(bytes) {
      let value = 0n;
      for (let i = 0; i < bytes.length; i++) value = value * 256n + BigInt(bytes[i]);
      return value;
    }

    /**
     * Integer to a big-endian byte string of the given length
     * @private
     */
    _intToBytes(value, length) {
      const bytes = new Array(length).fill(0);
      let remaining = value;
      for (let i = length - 1; i >= 0; i--) {
        bytes[i] = Number(remaining % 256n);
        remaining = remaining / 256n;
      }
      return bytes;
    }

    /**
     * Apply the underlying block cipher to one block
     * @private
     */
    _ciph(block) {
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(block);
      return cipher.Result();
    }

    /**
     * PRF from SP 800-38G: CBC-MAC over a block-aligned string with a zero IV
     * @private
     */
    _prf(data) {
      let y = new Array(16).fill(0);
      for (let i = 0; i < data.length; i += 16) {
        y = this._ciph(OpCodes.XorArrays(y, data.slice(i, i + 16)));
      }
      return y;
    }

    /**
     * FF1 encryption and decryption (NIST SP 800-38G algorithms 7 and 8)
     * @private
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
      const p = [
        1, 2, 1,
        OpCodes.AndN(OpCodes.Shr32(radix, 16), 0xFF),
        OpCodes.AndN(OpCodes.Shr32(radix, 8), 0xFF),
        OpCodes.AndN(radix, 0xFF),
        10,
        u % 256,
        nBytes[0], nBytes[1], nBytes[2], nBytes[3],
        tBytes[0], tBytes[1], tBytes[2], tBytes[3]
      ];

      const padLength = ((-t - b - 1) % 16 + 16) % 16;

      let a = symbols.slice(0, u);
      let bHalf = symbols.slice(u);

      const rounds = this.isInverse ? [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

      for (const round of rounds) {
        const source = this.isInverse ? a : bHalf;
        const q = [];
        for (let i = 0; i < this.tweak.length; i++) q.push(this.tweak[i]);
        for (let i = 0; i < padLength; i++) q.push(0);
        q.push(round);
        const sourceBytes = this._intToBytes(this._numRadix(source, radix), b);
        for (let i = 0; i < sourceBytes.length; i++) q.push(sourceBytes[i]);

        const prfInput = [];
        for (let i = 0; i < p.length; i++) prfInput.push(p[i]);
        for (let i = 0; i < q.length; i++) prfInput.push(q[i]);
        const r = this._prf(prfInput);

        const s = [];
        for (let i = 0; i < r.length; i++) s.push(r[i]);
        for (let j = 1; s.length < d; j++) {
          const counter = this._intToBytes(BigInt(j), 16);
          const block = this._ciph(OpCodes.XorArrays(r, counter));
          for (let i = 0; i < block.length; i++) s.push(block[i]);
        }
        const y = this._bytesToInt(s.slice(0, d));

        const m = (round % 2 === 0) ? u : v;
        const modulus = BigInt(radix) ** BigInt(m);

        if (this.isInverse) {
          let c = (this._numRadix(bHalf, radix) - y) % modulus;
          if (c < 0n) c += modulus;
          bHalf = a;
          a = this._strRadix(c, m, radix);
        } else {
          const c = (this._numRadix(a, radix) + y) % modulus;
          a = bHalf;
          bHalf = this._strRadix(c, m, radix);
        }
      }

      return a.concat(bHalf);
    }

    /**
     * Reconstruct string with format characters preserved
     * @param {Array} alphabetChars - Processed alphabet characters
     * @param {Array} formatChars - Original format characters
     * @param {Array} positions - Character position information
     * @returns {string} Reconstructed string
     */
    _reconstructString(alphabetChars, formatChars, positions) {
      const result = [];
      let alphabetIndex = 0;
      let formatIndex = 0;

      for (const pos of positions) {
        if (pos.type === 'alphabet') {
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