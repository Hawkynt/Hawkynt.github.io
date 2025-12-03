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
      this.description = "FPE (Format-Preserving Encryption) is a general framework for encryption schemes that preserve the format and structure of input data. It enables encryption of structured data like credit card numbers, phone numbers, and database fields while maintaining their original format, length, and character sets.";
      this.inventor = "Various (NIST standardization)";
      this.year = 2009;
      this.category = CategoryType.MODE;
      this.subCategory = "Format-Preserving Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL; // Application-specific
      this.complexity = ComplexityType.RESEARCH;
      this.country = CountryCode.US;

      this.RequiresIV = false; // Uses tweak instead of IV
      this.SupportedIVSizes = []; // Not applicable for FPE

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

      // Round-trip test vectors based on NIST SP 800-38G
      this.tests = [
        {
          text: "FPE round-trip test #1 - Decimal",
          uri: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf",
          input: OpCodes.AnsiToBytes("0123456789"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          tweak: OpCodes.Hex8ToBytes(""),
          alphabet: "0123456789"
        },
        {
          text: "FPE round-trip test #2 - Credit Card",
          uri: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf",
          input: OpCodes.AnsiToBytes("4000001234567899"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          tweak: OpCodes.Hex8ToBytes("3031323334353637"),
          alphabet: "0123456789"
        },
        {
          text: "FPE round-trip test #3 - Alphanumeric",
          uri: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf",
          input: OpCodes.AnsiToBytes("ABC123def456"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          tweak: OpCodes.Hex8ToBytes("303132333435363738393a3b3c3d3e3f"),
          alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
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
      this.inputBuffer.push(...data);
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
      // Convert characters to numbers based on alphabet
      const numbers = chars.map(char => this.alphabet.indexOf(char));
      const radix = this.alphabet.length;
      const n = numbers.length;

      if (n < 2) {
        return chars; // Can't apply Feistel to single character
      }

      // Simple Feistel-based FPE (properly invertible)
      let left = numbers.slice(0, Math.floor(n / 2));
      let right = numbers.slice(Math.floor(n / 2));
      const rounds = 4; // Fixed number of rounds for consistency

      if (this.isInverse) {
        // FPE Decryption: reverse Feistel rounds
        for (let round = rounds - 1; round >= 0; round--) {
          const f = this._feistelFunction(left, round, radix, right.length);
          const newRight = this._modSubtract(right, f, radix);
          right = left;
          left = newRight;
        }
      } else {
        // FPE Encryption: forward Feistel rounds
        for (let round = 0; round < rounds; round++) {
          const f = this._feistelFunction(right, round, radix, left.length);
          const newRight = this._modAdd(left, f, radix);
          left = right;
          right = newRight;
        }
      }

      // Combine halves and convert back to characters
      const result = left.concat(right);
      return result.map(num => this.alphabet[num % radix]);
    }

    /**
     * Apply PRF-based transformation (simplified FPE round function)
     * @param {Array} input - Input numbers
     * @param {number} round - Round number for domain separation
     * @returns {Array} Transformed numbers
     */
    _applyPRF(input, round) {
      // Construct PRF input: tweak || round || input
      const prfInput = [];
      prfInput.push(...this.tweak);
      prfInput.push(OpCodes.AndN(round, 0xFF));
      prfInput.push(...input.map(n => OpCodes.AndN(n, 0xFF)));

      // Pad to block size
      const blockSize = this.blockCipher.BlockSize;
      while (prfInput.length % blockSize !== 0) {
        prfInput.push(0);
      }

      // Apply block cipher as PRF
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(prfInput);
      const prf = cipher.Result();

      // Transform input using PRF output
      const result = new Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const prfByte = prf[i % prf.length];
        if (this.isInverse) {
          result[i] = (input[i] - prfByte + 256) % 256;
        } else {
          result[i] = (input[i] + prfByte) % 256;
        }
      }

      return result;
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

    /**
     * Feistel function for FPE rounds
     * @param {Array} input - Input half
     * @param {number} round - Round number
     * @param {number} radix - Number base
     * @param {number} targetSize - Target output size
     * @returns {Array} Function output
     */
    _feistelFunction(input, round, radix, targetSize) {
      // Construct PRF input: tweak || round || input
      const prfInput = [];
      prfInput.push(...this.tweak);
      prfInput.push(OpCodes.AndN(round, 0xFF));
      prfInput.push(...input.map(n => OpCodes.AndN(n, 0xFF)));

      // Pad to block size
      const blockSize = this.blockCipher.BlockSize;
      while (prfInput.length % blockSize !== 0) {
        prfInput.push(0);
      }

      // Apply block cipher as PRF
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(prfInput);
      const prf = cipher.Result();

      // Convert PRF output to target size with correct radix
      const output = new Array(targetSize);
      for (let i = 0; i < targetSize; i++) {
        output[i] = prf[i % prf.length] % radix;
      }

      return output;
    }

    /**
     * Modular addition for arrays
     * @param {Array} a - First operand
     * @param {Array} b - Second operand
     * @param {number} radix - Modulus
     * @returns {Array} Result array
     */
    _modAdd(a, b, radix) {
      const maxLength = Math.max(a.length, b.length);
      const result = new Array(maxLength);

      for (let i = 0; i < maxLength; i++) {
        const aVal = i < a.length ? a[i] : 0;
        const bVal = i < b.length ? b[i] : 0;
        result[i] = (aVal + bVal) % radix;
      }

      return result;
    }

    /**
     * Modular subtraction for arrays
     * @param {Array} a - First operand
     * @param {Array} b - Second operand
     * @param {number} radix - Modulus
     * @returns {Array} Result array
     */
    _modSubtract(a, b, radix) {
      const maxLength = Math.max(a.length, b.length);
      const result = new Array(maxLength);

      for (let i = 0; i < maxLength; i++) {
        const aVal = i < a.length ? a[i] : 0;
        const bVal = i < b.length ? b[i] : 0;
        result[i] = (aVal - bVal + radix) % radix;
      }

      return result;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new FpeAlgorithm());

  // ===== EXPORTS =====

  return { FpeAlgorithm, FpeModeInstance };
}));