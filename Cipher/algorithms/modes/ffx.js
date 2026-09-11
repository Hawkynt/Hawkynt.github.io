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

      // NIST FF1 sample values (FF1samples.pdf, published alongside SP 800-38G
      // on the NIST "Example Values" page). Numeral strings are given as ASCII.
      this.tests = [
        {
          text: "NIST FF1 sample 1 - AES-128, radix 10, empty tweak",
          uri: "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values",
          cipher: "AES",
          input: OpCodes.AnsiToBytes("0123456789"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          tweak: [],
          radix: 10,
          expected: OpCodes.AnsiToBytes("2433477484")
        },
        {
          text: "NIST FF1 sample 2 - AES-128, radix 10, 10-byte tweak",
          uri: "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values",
          cipher: "AES",
          input: OpCodes.AnsiToBytes("0123456789"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          tweak: OpCodes.Hex8ToBytes("39383736353433323130"),
          radix: 10,
          expected: OpCodes.AnsiToBytes("6124200773")
        },
        {
          text: "NIST FF1 sample 3 - AES-128, radix 36, 11-byte tweak",
          uri: "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values",
          cipher: "AES",
          input: OpCodes.AnsiToBytes("0123456789abcdefghi"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
          tweak: OpCodes.Hex8ToBytes("3737373770717273373737"),
          radix: 36,
          expected: OpCodes.AnsiToBytes("a9tv40mll9kdu509eum")
        },
        {
          text: "NIST FF1 sample 5 - AES-192, radix 10, 10-byte tweak",
          uri: "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values",
          cipher: "AES",
          input: OpCodes.AnsiToBytes("0123456789"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3cef4359d8d580aa4f"),
          tweak: OpCodes.Hex8ToBytes("39383736353433323130"),
          radix: 10,
          expected: OpCodes.AnsiToBytes("2496655549")
        },
        {
          text: "NIST FF1 sample 9 - AES-256, radix 36, 11-byte tweak",
          uri: "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values",
          cipher: "AES",
          input: OpCodes.AnsiToBytes("0123456789abcdefghi"),
          key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3cef4359d8d580aa4f7f036d6f04fc6a94"),
          tweak: OpCodes.Hex8ToBytes("3737373770717273373737"),
          radix: 36,
          expected: OpCodes.AnsiToBytes("xs8a0azh2avyalyzuwd")
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

      // FFX[radix] as standardised in NIST SP 800-38G under the name FF1.
      const result = this._ff1(symbols);
      const output = this._symbolsToBytes(result);

      // Clear sensitive data
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];

      return output;
    }

    /**
     * Numeral string to integer, most significant numeral first
     * @private
     */
    _numRadix(numerals) {
      const radix = BigInt(this.radix);
      let value = 0n;
      for (let i = 0; i < numerals.length; i++) value = value * radix + BigInt(numerals[i]);
      return value;
    }

    /**
     * Integer to a numeral string of the given length
     * @private
     */
    _strRadix(value, length) {
      const radix = BigInt(this.radix);
      const numerals = new Array(length).fill(0);
      let remaining = value;
      for (let i = length - 1; i >= 0; i--) {
        numerals[i] = Number(remaining % radix);
        remaining = remaining / radix;
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
    _ff1(symbols) {
      const n = symbols.length;
      const t = this.tweak.length;
      const u = Math.floor(n / 2);
      const v = n - u;

      // b = ceil(ceil(v * log2(radix)) / 8), d = 4*ceil(b/4) + 4
      const b = Math.ceil(Math.ceil(v * Math.log2(this.radix)) / 8);
      const d = 4 * Math.ceil(b / 4) + 4;

      const nBytes = OpCodes.Unpack32BE(n);
      const tBytes = OpCodes.Unpack32BE(t);
      const p = [
        1, 2, 1,
        OpCodes.AndN(OpCodes.Shr32(this.radix, 16), 0xFF),
        OpCodes.AndN(OpCodes.Shr32(this.radix, 8), 0xFF),
        OpCodes.AndN(this.radix, 0xFF),
        10,
        u % 256,
        nBytes[0], nBytes[1], nBytes[2], nBytes[3],
        tBytes[0], tBytes[1], tBytes[2], tBytes[3]
      ];

      // Number of zero bytes that pad the tweak so that Q is block aligned
      const padLength = ((-t - b - 1) % 16 + 16) % 16;

      let a = symbols.slice(0, u);
      let bHalf = symbols.slice(u);

      const rounds = this.isInverse ? [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

      for (const round of rounds) {
        // Q = T || 0^pad || [round] || NUM_radix(other half) as b bytes
        const source = this.isInverse ? a : bHalf;
        const q = [];
        for (let i = 0; i < this.tweak.length; i++) q.push(this.tweak[i]);
        for (let i = 0; i < padLength; i++) q.push(0);
        q.push(round);
        const sourceBytes = this._intToBytes(this._numRadix(source), b);
        for (let i = 0; i < sourceBytes.length; i++) q.push(sourceBytes[i]);

        const prfInput = [];
        for (let i = 0; i < p.length; i++) prfInput.push(p[i]);
        for (let i = 0; i < q.length; i++) prfInput.push(q[i]);
        const r = this._prf(prfInput);

        // S = R || CIPH_K(R xor [1]^16) || CIPH_K(R xor [2]^16) || ... truncated to d
        const s = [];
        for (let i = 0; i < r.length; i++) s.push(r[i]);
        for (let j = 1; s.length < d; j++) {
          const counter = this._intToBytes(BigInt(j), 16);
          const block = this._ciph(OpCodes.XorArrays(r, counter));
          for (let i = 0; i < block.length; i++) s.push(block[i]);
        }
        const y = this._bytesToInt(s.slice(0, d));

        const m = (round % 2 === 0) ? u : v;
        const modulus = BigInt(this.radix) ** BigInt(m);

        if (this.isInverse) {
          // c = (NUM_radix(B) - y) mod radix^m; then B <- A and A <- STR(c)
          let c = (this._numRadix(bHalf) - y) % modulus;
          if (c < 0n) c += modulus;
          bHalf = a;
          a = this._strRadix(c, m);
        } else {
          // c = (NUM_radix(A) + y) mod radix^m; then A <- B and B <- STR(c)
          const c = (this._numRadix(a) + y) % modulus;
          a = bHalf;
          bHalf = this._strRadix(c, m);
        }
      }

      return a.concat(bHalf);
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

  }

  // ===== REGISTRATION =====

    RegisterAlgorithm(new FfxAlgorithm());

  // ===== EXPORTS =====

  return { FfxAlgorithm, FfxModeInstance };
}));