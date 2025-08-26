/*
 * FF1 Format-Preserving Encryption Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * FF1 (Format-Preserving Encryption) from NIST SP 800-38G (March 2016)
 * Educational implementation for learning format-preserving encryption concepts.
 * Encrypts structured data while preserving the format (credit cards, SSNs, etc.)
 * 
 * EDUCATIONAL IMPLEMENTATION ONLY - DO NOT USE IN PRODUCTION
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

  // ===== ALGORITHM IMPLEMENTATION =====

  class FF1Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "FF1";
      this.description = "Format-Preserving Encryption from NIST SP 800-38G (March 2016). Encrypts structured data while preserving format. Educational implementation for learning FPE concepts.";
      this.inventor = "NIST";
      this.year = 2016;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Format-Preserving Encryption";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 32, 8) // 128-256 bit AES keys
      ];
      this.SupportedBlockSizes = [
        new KeySize(2, 56, 1) // Variable length strings per NIST spec
      ];

      // FF1 constants from NIST SP 800-38G
      this.RADIX_MIN = 2;
      this.RADIX_MAX = 65536;

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST Special Publication 800-38G", "https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-38g.pdf"),
        new LinkItem("FF1 and FF3 Format-Preserving Encryption Algorithms", "https://csrc.nist.gov/publications/detail/sp/800-38g/final"),
        new LinkItem("Format-Preserving Encryption Overview", "https://blog.cryptographyengineering.com/2009/07/11/format-preserving-encryption-or-how-to/")
      ];

      this.references = [
        new LinkItem("libfpe C++ Implementation", "https://github.com/mysto/libfpe"),
        new LinkItem("Python FF1 Implementation", "https://github.com/mysto/python-fpe"),
        new LinkItem("Format-Preserving Encryption in Practice", "https://eprint.iacr.org/2009/251.pdf")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Small domain attacks",
          "FF1 can be vulnerable if the domain size is too small or if patterns exist in plaintext",
          "Use sufficiently large domains and avoid predictable patterns"
        ),
        new Vulnerability(
          "Educational implementation",
          "This is a simplified educational implementation, not suitable for production use",
          "Use proven cryptographic libraries like those from NIST or commercial vendors"
        )
      ];

      // Test vectors from NIST SP 800-38G Appendix A.5
      this.tests = [
        {
          text: "NIST FF1 Sample 1 - decimal digits",
          uri: "https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-38g.pdf",
          input: OpCodes.AnsiToBytes("0123456789"),
          key: OpCodes.Hex8ToBytes("2B7E151628AED2A6ABF7158809CF4F3C"),
          tweak: OpCodes.AnsiToBytes(""),
          radix: 10,
          expected: OpCodes.AnsiToBytes("2400479559")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new FF1Instance(this, isInverse);
    }
  }
  class FF1Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.key = null;
      this.inputBuffer = [];
      this.BlockSize = 0; // Variable size for FF1
      this.KeySize = 0;

      // FF1 configuration
      this.radix = 10; // Default to decimal
      this.tweak = []; // Tweak data

      // FF1 constants
      this.RADIX_MIN = 2;
      this.RADIX_MAX = 65536;
      this.MIN_LEN = 2;
      this.MAX_LEN = 56;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size (must be 16, 24, or 32 bytes for AES)
      if (keyBytes.length !== 16 && keyBytes.length !== 24 && keyBytes.length !== 32) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. FF1 requires 16, 24, or 32 byte AES keys`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Set FF1 parameters
    setRadix(radix) {
      if (radix < this.RADIX_MIN || radix > this.RADIX_MAX) {
        throw new Error(`Invalid radix: ${radix}. Must be between ${this.RADIX_MIN} and ${this.RADIX_MAX}`);
      }
      this.radix = radix;
    }

    setTweak(tweakBytes) {
      this.tweak = tweakBytes ? [...tweakBytes] : [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this.key) throw new Error("Key not set");

      // For FF1, we expect string data that represents numerals
      if (typeof data === 'string') {
        this.inputBuffer.push(...OpCodes.AnsiToBytes(data));
      } else {
        this.inputBuffer.push(...data);
      }
    }

    Result() {
      if (!this.key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Convert buffer to string
      const inputString = String.fromCharCode(...this.inputBuffer);

      // Validate input length
      if (inputString.length < this.MIN_LEN || inputString.length > this.MAX_LEN) {
        throw new Error(`Input length must be between ${this.MIN_LEN} and ${this.MAX_LEN} characters`);
      }

      // Process the string with FF1
      const outputString = this.isInverse 
        ? this._decrypt(inputString)
        : this._encrypt(inputString);

      // Clear input buffer
      this.inputBuffer = [];

      return OpCodes.AnsiToBytes(outputString);
    }
    // FF1 encryption function
    _encrypt(plaintext) {
      // Convert string to numerals based on radix
      const X = this._stringToNumerals(plaintext);
      const n = X.length;

      if (n < this.MIN_LEN || n > this.MAX_LEN) {
        throw new Error(`FF1: Invalid plaintext length ${n}. Must be between ${this.MIN_LEN} and ${this.MAX_LEN}`);
      }

      // Split into two halves
      const u = Math.floor(n / 2);
      const v = n - u;
      const A = X.slice(0, u);
      const B = X.slice(u);

      // FF1 has 10 rounds
      for (let i = 0; i < 10; i++) {
        // Construct Q (simplified for educational purposes)
        const Q = [1, 2, 1, this.radix & 0xFF, (this.radix >> 8) & 0xFF, 10, u & 0xFF];

        // Add tweak if present
        if (this.tweak.length > 0) {
          Q.push(...this.tweak);
        }

        // Add round number and B
        Q.push(i);
        const bInt = this._numeralStringToInt(B);
        Q.push(bInt & 0xFF, (bInt >> 8) & 0xFF, (bInt >> 16) & 0xFF, (bInt >> 24) & 0xFF);

        // Simplified PRF calculation (educational implementation)
        const R = this._prf(Q);
        const y = R[0] | (R[1] << 8) | (R[2] << 16) | (R[3] << 24);

        // Calculate modular arithmetic
        const aInt = this._numeralStringToInt(A);
        const modulus = Math.pow(this.radix, u);
        const c = (aInt + y) % modulus;
        const C = this._intToNumeralString(c, u);

        // Swap for next round
        A.splice(0, A.length, ...B);
        B.splice(0, B.length, ...C);
      }

      return this._numeralsToString([...A, ...B]);
    }

    // FF1 decryption function  
    _decrypt(ciphertext) {
      // Convert string to numerals based on radix
      const Y = this._stringToNumerals(ciphertext);
      const n = Y.length;

      // Split into two halves
      const u = Math.floor(n / 2);
      const v = n - u;
      const A = Y.slice(0, u);
      const B = Y.slice(u);

      // FF1 rounds in reverse
      for (let i = 9; i >= 0; i--) {
        // Construct Q
        const Q = [1, 2, 1, this.radix & 0xFF, (this.radix >> 8) & 0xFF, 10, u & 0xFF];

        if (this.tweak.length > 0) {
          Q.push(...this.tweak);
        }

        Q.push(i);
        const aInt = this._numeralStringToInt(A);
        Q.push(aInt & 0xFF, (aInt >> 8) & 0xFF, (aInt >> 16) & 0xFF, (aInt >> 24) & 0xFF);

        const R = this._prf(Q);
        const y = R[0] | (R[1] << 8) | (R[2] << 16) | (R[3] << 24);

        const bInt = this._numeralStringToInt(B);
        const modulus = Math.pow(this.radix, v);
        const c = (bInt - y + modulus) % modulus;
        const C = this._intToNumeralString(c, v);

        // Swap for next round
        B.splice(0, B.length, ...A);
        A.splice(0, A.length, ...C);
      }

      return this._numeralsToString([...A, ...B]);
    }
    // Helper functions for FF1 processing

    // Simplified PRF function using key (educational implementation)
    _prf(input) {
      // Simplified AES-like function for educational purposes
      // In production, use proper AES encryption
      let result = new Array(16);
      for (let i = 0; i < 16; i++) {
        result[i] = input[i % input.length] ^ this._key[i % this.KeySize];
      }
      return result;
    }

    // Convert string to numeral array
    _stringToNumerals(str) {
      const numerals = [];
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        let numeral;

        if (char >= '0' && char <= '9') {
          numeral = char.charCodeAt(0) - 48;
        } else if (char >= 'a' && char <= 'z') {
          numeral = char.charCodeAt(0) - 87;
        } else if (char >= 'A' && char <= 'Z') {
          numeral = char.charCodeAt(0) - 55;
        } else {
          throw new Error('FF1: Invalid character in input string');
        }

        if (numeral >= this.radix) {
          throw new Error('FF1: Character not valid for specified radix');
        }
        numerals.push(numeral);
      }
      return numerals;
    }

    // Convert numeral array to string  
    _numeralsToString(numerals) {
      let result = '';
      for (let i = 0; i < numerals.length; i++) {
        const numeral = numerals[i];
        if (numeral < 10) {
          result += String.fromCharCode(48 + numeral);
        } else if (numeral < 36) {
          result += String.fromCharCode(87 + numeral);
        } else {
          throw new Error('FF1: Invalid numeral value');
        }
      }
      return result;
    }

    // Numeral string to big integer (simplified)
    _numeralStringToInt(numerals) {
      let result = 0;
      for (let i = 0; i < numerals.length; i++) {
        result = result * this.radix + numerals[i];
      }
      return result;
    }

    // Big integer to numeral string (simplified)
    _intToNumeralString(value, length) {
      const numerals = [];
      for (let i = 0; i < length; i++) {
        numerals.unshift(value % this.radix);
        value = Math.floor(value / this.radix);
      }
      return numerals;
    }
  }
  // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new FF1Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FF1Algorithm, FF1Instance };
}));