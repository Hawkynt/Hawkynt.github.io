/*
 * FFX (Format-Preserving Encryption, Feistel-based) Mode of Operation
 * Format-preserving encryption using Feistel networks for arbitrary alphabets
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
    root.FFX = factory(root.AlgorithmFramework, root.OpCodes);
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

  class FfxAlgorithm extends CipherModeAlgorithm {
    constructor() {
      super();

      this.name = "FFX";
      this.description = "FFX (Format-Preserving Encryption) is a Feistel-based construction that preserves the format of input data during encryption. It can handle arbitrary alphabets and string lengths, making it suitable for encrypting credit card numbers, SSNs, and other structured data while maintaining their original format. Input is restricted to the configured alphabet: for radix 2-36 the canonical base-N digits '0'-'9' then lowercase 'a'-'z', for radix 37-255 byte values below the radix, and for radix 256 any byte. At least two symbols are required. Anything else is rejected rather than reduced into range, because folding a byte modulo the radix is not reversible.";
      this.inventor = "Mihir Bellare, Phillip Rogaway, Thomas Spies";
      this.year = 2010;
      this.category = CategoryType.MODE;
      this.subCategory = "Format-Preserving Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL; // Specialized application
      this.complexity = ComplexityType.RESEARCH;
      this.country = CountryCode.US;

      this.RequiresIV = false; // Uses tweak instead of IV
      this.SupportedIVSizes = []; // Not applicable for FFX

      // Format-preserving encryption is defined only over its own alphabet, so a
      // sweep with arbitrary bytes must expect a refusal rather than a result.
      this.restrictedInputDomain = "strings over the configured radix alphabet, at least two symbols long";

      this.documentation = [
        new LinkItem("NIST SP 800-38G", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf"),
        new LinkItem("FFX Original Paper", "https://eprint.iacr.org/2010/042.pdf"),
        new LinkItem("Format-Preserving Encryption Survey", "https://web.cs.ucdavis.edu/~rogaway/papers/fpe.pdf")
      ];

      this.references = [
        new LinkItem("Python FPE Library", "https://github.com/mysto/python-fpe"),
        new LinkItem("Java FF1 Implementation", "https://github.com/privacylogistics/java-fpe"),
        new LinkItem("NIST FF1/FF3 Reference", "https://github.com/capitalone/fpe")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Alphabet Size Limitation", "FFX security depends on alphabet size and message length. Small alphabets or short messages may provide insufficient security."),
        new Vulnerability("Side Channel Analysis", "Implementation must protect against timing attacks and other side-channel vulnerabilities during Feistel round computations.")
      ];

      // Round-trip test vectors based on NIST SP 800-38G
      this.tests = [
        {
          text: "FFX round-trip test #1 - 10-digit number",
          uri: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf",
          input: OpCodes.AnsiToBytes("0123456789"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          tweak: OpCodes.Hex8ToBytes(""),
          radix: 10
        },
        {
          text: "FFX round-trip test #2 - hex string",
          uri: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf",
          input: OpCodes.AnsiToBytes("0123456789abcdef"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          tweak: OpCodes.Hex8ToBytes("39383736353433323130"),
          radix: 16
        },
        {
          text: "FFX round-trip test #3 - 19-digit number",
          uri: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf",
          input: OpCodes.AnsiToBytes("0123456789123456789"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          tweak: OpCodes.Hex8ToBytes("3737373770717273373737"),
          radix: 10
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new FfxModeInstance(this, isInverse);
    }
  }

  /**
 * FfxMode cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class FfxModeInstance extends IAlgorithmInstance {
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
      this.radix = 10; // Default to decimal
      this.rounds = 10; // Standard FFX rounds
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
     * @param {Array} tweak - Tweak value for FFX mode
     */
    setTweak(tweak) {
      this.tweak = tweak ? [...tweak] : [];
    }

    /**
     * Set the radix (alphabet size)
     * @param {number} radix - Size of the alphabet (2-2^16)
     */
    setRadix(radix) {
      if (radix < 2 || radix > 65536) {
        throw new Error("Radix must be between 2 and 65536");
      }
      this.radix = radix;
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
        throw new Error("Key must be set for FFX mode.");
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
        throw new Error("Key must be set for FFX mode.");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      // Convert input to symbols based on radix
      const symbols = this._bytesToSymbols(this.inputBuffer);
      const n = symbols.length;

      if (n < 2) {
        throw new Error("Input must contain at least 2 symbols for FFX");
      }

      // FFX Feistel network (simplified educational implementation).
      // The split follows NIST SP 800-38G FF1: u = floor(n/2), v = n - u, so for
      // an odd-length message the two halves differ in length and swap roles each
      // round. The round function output must therefore be sized to the half it
      // is combined with, not to the half it was derived from. Sizing it to its
      // own input made _modAdd truncate to the shorter array, silently dropping a
      // symbol per round on every odd-length message.
      const u = Math.floor(n / 2);
      let left = symbols.slice(0, u);
      let right = symbols.slice(u);

      if (this.isInverse) {
        // FFX Decryption: reverse Feistel rounds.
        // Forward round i maps (A,B) to (B, A + F(B,i)), so given the pair after
        // the round the previous B is the current A and the previous A is the
        // current B minus F(A,i).
        for (let round = this.rounds - 1; round >= 0; round--) {
          const f = this._feistelFunction(left, round, right.length);
          const newRight = this._modSubtract(right, f, this.radix);
          right = left;
          left = newRight;
        }
      } else {
        // FFX Encryption: forward Feistel rounds
        for (let round = 0; round < this.rounds; round++) {
          const f = this._feistelFunction(right, round, left.length);
          const newRight = this._modAdd(left, f, this.radix);
          left = right;
          right = newRight;
        }
      }

      // Combine halves and convert back to bytes
      const result = left.concat(right);
      const output = this._symbolsToBytes(result);

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return output;
    }

    /**
     * Convert bytes to symbols based on radix
     * @param {Array} bytes - Input bytes
     * @returns {Array} Symbol array
     */
    _bytesToSymbols(bytes) {
      // Format-preserving encryption is only defined on strings over its own
      // alphabet, so anything outside it is refused rather than folded into range.
      // Reducing a byte modulo the radix is not injective: two different inputs
      // became the same symbol, the symbol was written back out as its own small
      // value instead of the character it came from, and neither the length nor
      // the content survived the return trip.
      if (this.radix === 256) return [...bytes];

      if (this.radix > 256)
        throw new Error(`FFX radix ${this.radix} cannot be represented one symbol per byte; use radix 2-256`);

      if (this.radix <= 36) {
        // Canonical base-N digits, the same set Number.prototype.toString(radix)
        // produces: '0'-'9' then 'a'-'z'. Uppercase is rejected rather than
        // folded in, because the output is written in the canonical lowercase
        // form and accepting both would make the mapping non-injective.
        return bytes.map(b => {
          const symbol = this._digitValue(b);
          if (symbol < 0 || symbol >= this.radix)
            throw new Error(`FFX input is outside its alphabet: byte 0x${OpCodes.AndN(b, 0xFF).toString(16)} is not a base-${this.radix} digit`);
          return symbol;
        });
      }

      // Radices above the digit alphabet address byte values directly.
      return bytes.map(b => {
        if (b >= this.radix)
          throw new Error(`FFX input is outside its alphabet: byte value ${b} is not below radix ${this.radix}`);
        return b;
      });
    }

    /**
     * Value of an ASCII digit character, or -1 when it is not one.
     * @param {number} code - Character code
     * @returns {number} Digit value or -1
     */
    _digitValue(code) {
      if (code >= 0x30 && code <= 0x39) return code - 0x30;       // '0'-'9'
      if (code >= 0x61 && code <= 0x7A) return code - 0x61 + 10;  // 'a'-'z'
      return -1;
    }

    /**
     * Convert symbols back to bytes
     * @param {Array} symbols - Symbol array
     * @returns {Array} Byte array
     */
    _symbolsToBytes(symbols) {
      // Exact inverse of _bytesToSymbols, so the format really is preserved.
      if (this.radix === 256) return [...symbols];
      if (this.radix <= 36) return symbols.map(s => this._digitCharacter(s));
      return [...symbols];
    }

    /**
     * ASCII character code for a base-N digit value.
     * @param {number} symbol - Digit value
     * @returns {number} Character code
     */
    _digitCharacter(symbol) {
      return symbol < 10 ? 0x30 + symbol : 0x61 + (symbol - 10);
    }

    /**
     * FFX Feistel function (simplified educational version)
     * @param {Array} input - Right half input
     * @param {number} round - Current round number
     * @returns {Array} Function output
     */
    _feistelFunction(input, round, outputLength) {
      // Construct PRF input: tweak || round || input
      const prfInput = [];
      for (let i = 0; i < this.tweak.length; i++) prfInput.push(this.tweak[i]);
      prfInput.push(OpCodes.AndN(round, 0xFF));
      for (let i = 0; i < input.length; i++) prfInput.push(OpCodes.AndN(input[i], 0xFF));

      // Pad to block size
      const blockSize = this.blockCipher.BlockSize;
      while (prfInput.length % blockSize !== 0) {
        prfInput.push(0);
      }

      // Apply block cipher
      const cipher = this.blockCipher.algorithm.CreateInstance(false);
      cipher.key = this.key;
      cipher.Feed(prfInput);
      const prf = cipher.Result();

      // Size the output to the half it will be combined with, which is not
      // necessarily the half it was derived from.
      const length = outputLength === undefined ? input.length : outputLength;
      const output = new Array(length);
      for (let i = 0; i < length; i++) {
        output[i] = prf[i % prf.length] % this.radix;
      }

      return output;
    }

    /**
     * Modular addition for symbol arrays
     * @param {Array} a - First operand
     * @param {Array} b - Second operand
     * @param {number} radix - Modulus
     * @returns {Array} Result array
     */
    _modAdd(a, b, radix) {
      const minLength = Math.min(a.length, b.length);
      const result = new Array(minLength);

      for (let i = 0; i < minLength; i++) {
        result[i] = (a[i] + b[i]) % radix;
      }

      return result;
    }

    /**
     * Modular subtraction for symbol arrays
     * @param {Array} a - First operand
     * @param {Array} b - Second operand
     * @param {number} radix - Modulus
     * @returns {Array} Result array
     */
    _modSubtract(a, b, radix) {
      const minLength = Math.min(a.length, b.length);
      const result = new Array(minLength);

      for (let i = 0; i < minLength; i++) {
        result[i] = (a[i] - b[i] + radix) % radix;
      }

      return result;
    }
  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new FfxAlgorithm());

  // ===== EXPORTS =====

  return { FfxAlgorithm, FfxModeInstance };
}));