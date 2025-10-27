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
      this.description = "FFX (Format-Preserving Encryption) is a Feistel-based construction that preserves the format of input data during encryption. It can handle arbitrary alphabets and string lengths, making it suitable for encrypting credit card numbers, SSNs, and other structured data while maintaining their original format.";
      this.inventor = "Mihir Bellare, Phillip Rogaway, Thomas Spies";
      this.year = 2010;
      this.category = CategoryType.MODE;
      this.subCategory = "Format-Preserving Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL; // Specialized application
      this.complexity = ComplexityType.RESEARCH;
      this.country = CountryCode.US;

      this.RequiresIV = false; // Uses tweak instead of IV
      this.SupportedIVSizes = []; // Not applicable for FFX

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

    CreateInstance(isInverse = false) {
      return new FfxModeInstance(this, isInverse);
    }
  }

  class FfxModeInstance extends IAlgorithmInstance {
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

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.blockCipher) {
        throw new Error("Block cipher not set. Call setBlockCipher() first.");
      }
      if (!this.key) {
        throw new Error("Key must be set for FFX mode.");
      }
      this.inputBuffer.push(...data);
    }

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

      // FFX Feistel network (simplified educational implementation)
      let left = symbols.slice(0, Math.floor(n / 2));
      let right = symbols.slice(Math.floor(n / 2));

      if (this.isInverse) {
        // FFX Decryption: reverse Feistel rounds
        for (let round = this.rounds - 1; round >= 0; round--) {
          const f = this._feistelFunction(left, round);
          const newRight = this._modSubtract(right, f, this.radix);
          right = left;
          left = newRight;
        }
      } else {
        // FFX Encryption: forward Feistel rounds
        for (let round = 0; round < this.rounds; round++) {
          const f = this._feistelFunction(right, round);
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
      if (this.radix === 256) {
        return [...bytes];
      } else if (this.radix === 10) {
        // Decimal conversion
        return OpCodes.BytesToAnsi(bytes).split('').map(c => parseInt(c) % 10);
      } else if (this.radix === 26) {
        // Alphabetic conversion (A-Z)
        return OpCodes.BytesToAnsi(bytes).split('').map(c => {
          const code = c.charCodeAt(0);
          if (code >= 65 && code <= 90) return code - 65; // A-Z -> 0-25
          if (code >= 97 && code <= 122) return code - 97; // a-z -> 0-25
          return 0; // Default fallback
        });
      } else {
        // General radix conversion (simplified)
        return bytes.map(b => b % this.radix);
      }
    }

    /**
     * Convert symbols back to bytes
     * @param {Array} symbols - Symbol array
     * @returns {Array} Byte array
     */
    _symbolsToBytes(symbols) {
      if (this.radix === 256) {
        return [...symbols];
      } else if (this.radix === 10) {
        // Decimal conversion
        const str = symbols.map(s => s.toString()).join('');
        return OpCodes.AnsiToBytes(str);
      } else if (this.radix === 26) {
        // Alphabetic conversion (0-25 -> A-Z)
        const str = symbols.map(s => String.fromCharCode(65 + (s % 26))).join('');
        return OpCodes.AnsiToBytes(str);
      } else {
        // General radix conversion (simplified)
        return symbols.map(s => s & 0xFF);
      }
    }

    /**
     * FFX Feistel function (simplified educational version)
     * @param {Array} input - Right half input
     * @param {number} round - Current round number
     * @returns {Array} Function output
     */
    _feistelFunction(input, round) {
      // Construct PRF input: tweak || round || input
      const prfInput = [];
      prfInput.push(...this.tweak);
      prfInput.push(round & 0xFF);
      prfInput.push(...input.map(s => s & 0xFF));

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

      // Convert PRF output to same length as input
      const output = new Array(input.length);
      for (let i = 0; i < input.length; i++) {
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