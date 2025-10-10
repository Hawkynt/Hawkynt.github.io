/*
 * FF1 Format-Preserving Encryption Implementation
 * Based on NIST SP 800-38G (March 2016)
 * Production-grade implementation following BouncyCastle reference
 *
 * FF1 (Format-Preserving Encryption) encrypts structured data while preserving format.
 * Used for credit cards, SSNs, phone numbers, etc.
 *
 * Implementation follows Algorithms 7 (Encrypt) and 8 (Decrypt) from NIST SP 800-38G
 * with proper big integer arithmetic and AES-based PRF (CBC-MAC)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes);
  }
})((function() {
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
          BlockCipherAlgorithm, IBlockCipherInstance, KeySize, LinkItem, Vulnerability } = AlgorithmFramework;

  // Load Rijndael/AES dependency for PRF
  if (typeof require !== 'undefined') {
    try {
      require('./rijndael.js');
    } catch (e) {
      // Rijndael may already be loaded
    }
  }

  // FF1 Constants from NIST SP 800-38G
  const FF1_CONSTANTS = {
    MIN_LENGTH: 2,
    MAX_LENGTH: 56,
    MIN_RADIX: 2,
    MAX_RADIX: 65536,
    BLOCK_SIZE: 16, // AES block size
    MIN_DOMAIN_SIZE: 1000000 // radix^n >= 10^6 per NIST spec
  };

  // ===== BIG INTEGER UTILITIES =====

  // BigInteger operations using JavaScript BigInt
  class BigIntegerUtils {
    static fromByteArray(bytes) {
      if (bytes.length === 0) return 0n;
      let result = 0n;
      for (let i = 0; i < bytes.length; i++) {
        result = OpCodes.ShiftLn(result, 8) + BigInt(bytes[i] & 0xFF);
      }
      return result;
    }

    static toByteArray(bigint, minLength = 0) {
      if (bigint === 0n) {
        return new Uint8Array(Math.max(1, minLength));
      }

      const bytes = [];
      let value = bigint < 0n ? -bigint : bigint;

      while (value > 0n) {
        bytes.unshift(Number(value & 0xFFn));
        value = OpCodes.ShiftRn(value, 8);
      }

      while (bytes.length < minLength) {
        bytes.unshift(0);
      }

      return new Uint8Array(bytes);
    }

    static pow(base, exponent) {
      if (typeof base !== 'bigint') base = BigInt(base);
      if (typeof exponent !== 'bigint') exponent = BigInt(exponent);
      return base ** exponent;
    }

    static mod(a, m) {
      if (typeof a !== 'bigint') a = BigInt(a);
      if (typeof m !== 'bigint') m = BigInt(m);
      const result = a % m;
      return result < 0n ? result + m : result;
    }
  }

  // ===== RADIX CONVERTER =====

  // Converts between numeral arrays and big integers for different radix values
  class RadixConverter {
    constructor(radix) {
      if (radix < 2 || radix > 65536) {
        throw new Error(`Invalid radix ${radix}. Must be between 2 and 65536`);
      }
      this.radix = radix;
      this.bigRadix = BigInt(radix);
    }

    // Convert numeral array to BigInt
    fromEncoding(numerals) {
      let result = 0n;
      for (let i = 0; i < numerals.length; i++) {
        result = result * this.bigRadix + BigInt(numerals[i]);
      }
      return result;
    }

    // Convert BigInt to numeral array of specified length
    toEncoding(bigint, length, output) {
      let value = BigIntegerUtils.mod(bigint, BigIntegerUtils.pow(this.bigRadix, length));

      for (let i = length - 1; i >= 0; i--) {
        output[i] = Number(value % this.bigRadix);
        value = value / this.bigRadix;
      }
    }
  }

  // ===== AES-BASED PRF (CBC-MAC) =====

  // AES-based Pseudo-Random Function using CBC-MAC
  class AESPRF {
    constructor(aesInstance) {
      this.aes = aesInstance;
    }

    // CBC-MAC implementation following NIST SP 800-38G
    prf(data) {
      if (data.length % FF1_CONSTANTS.BLOCK_SIZE !== 0) {
        throw new Error('PRF input must be multiple of block size');
      }

      const blocks = data.length / FF1_CONSTANTS.BLOCK_SIZE;
      let y = new Uint8Array(FF1_CONSTANTS.BLOCK_SIZE);

      for (let i = 0; i < blocks; i++) {
        const blockOffset = i * FF1_CONSTANTS.BLOCK_SIZE;

        // XOR current block with previous output
        for (let j = 0; j < FF1_CONSTANTS.BLOCK_SIZE; j++) {
          y[j] ^= data[blockOffset + j];
        }

        // Encrypt the XOR result
        this.aes.Feed(y);
        y = this.aes.Result();
      }

      return y;
    }
  }

  // ===== NIST SP 800-38G PARAMETER CALCULATIONS =====

  // Calculate b parameter: ceiling(log_2(radix^v)) / 8
  // Following BouncyCastle SP80038G.java implementation for accuracy
  // NOTE: Uses direct bit operations (not OpCodes) as this is integer factorization logic
  function calculateB_FF1(radix, v) {
    // Count trailing zeros (powers of 2 in radix factorization)
    let powersOfTwo = 0;
    let temp = radix;
    while ((temp & 1) === 0) {  // Direct bit test for LSB
      powersOfTwo++;
      temp >>>= 1;  // Unsigned right shift
    }

    // Calculate total bits needed
    let bits = powersOfTwo * v;
    const oddPart = radix >>> powersOfTwo;  // Unsigned right shift

    if (oddPart !== 1) {
      // Add bits from odd part: ceil(log2(oddPart^v))
      const oddPowerBits = BigIntegerUtils.pow(oddPart, v).toString(2).length;
      bits += oddPowerBits;
    }

    return Math.floor((bits + 7) / 8);
  }

  // Calculate P parameter block according to NIST SP 800-38G
  function calculateP_FF1(radix, u, n, t) {
    const P = new Uint8Array(FF1_CONSTANTS.BLOCK_SIZE);

    P[0] = 1;  // Version
    P[1] = 2;  // Method (FF1)
    P[2] = 1;  // Addition flag

    // Radix (3 bytes, big-endian)
    P[3] = 0;
    P[4] = OpCodes.GetByte(radix, 1);
    P[5] = OpCodes.GetByte(radix, 0);

    P[6] = 10;  // Number of rounds
    P[7] = OpCodes.GetByte(u, 0);  // Split parameter

    // n (4 bytes, big-endian)
    P[8] = OpCodes.GetByte(n, 3);
    P[9] = OpCodes.GetByte(n, 2);
    P[10] = OpCodes.GetByte(n, 1);
    P[11] = OpCodes.GetByte(n, 0);

    // t (4 bytes, big-endian)
    P[12] = OpCodes.GetByte(t, 3);
    P[13] = OpCodes.GetByte(t, 2);
    P[14] = OpCodes.GetByte(t, 1);
    P[15] = OpCodes.GetByte(t, 0);

    return P;
  }

  // Calculate moduli for both halves
  function calculateModUV(radix, u, v) {
    const bigRadix = BigInt(radix);
    const modU = BigIntegerUtils.pow(bigRadix, u);
    const modV = BigIntegerUtils.pow(bigRadix, v);
    return { modU, modV };
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class FF1Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "FF1";
      this.description = "Format-Preserving Encryption from NIST SP 800-38G.";
      this.inventor = "NIST";
      this.year = 2016;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Format-Preserving Encryption";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 32, 8) // 128-256 bit AES keys
      ];
      this.SupportedBlockSizes = [
        new KeySize(2, 56, 1) // Variable length strings per NIST spec
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("NIST Special Publication 800-38G", "https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-38g.pdf"),
        new LinkItem("FF1 and FF3 Format-Preserving Encryption Algorithms", "https://csrc.nist.gov/publications/detail/sp/800-38g/final")
      ];

      this.references = [
        new LinkItem("BouncyCastle FF1 Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/fpe/SP80038G.java"),
        new LinkItem("BouncyCastle FF1 Test Vectors", "https://github.com/bcgit/bc-csharp/blob/master/crypto/test/src/crypto/test/SP80038GTest.cs"),
        new LinkItem("Python FF1 Implementation", "https://github.com/mysto/python-fpe")
      ];

      // Known vulnerabilities - none for production implementation
      this.knownVulnerabilities = [];

      // Comprehensive NIST test vectors from BouncyCastle SP80038GTest.java
      this.tests = [
        {
          text: 'NIST FF1-AES128 Sample 1 - decimal digits, no tweak',
          uri: 'https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-38g.pdf',
          input: OpCodes.AnsiToBytes('0123456789'),
          key: OpCodes.Hex8ToBytes('2B7E151628AED2A6ABF7158809CF4F3C'),
          tweak: new Uint8Array(0),
          radix: 10,
          expected: OpCodes.AnsiToBytes('2433477484')
        },
        {
          text: 'NIST FF1-AES128 Sample 2 - decimal digits with tweak',
          uri: 'https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/SP80038GTest.java',
          input: OpCodes.AnsiToBytes('0123456789'),
          key: OpCodes.Hex8ToBytes('2B7E151628AED2A6ABF7158809CF4F3C'),
          tweak: OpCodes.Hex8ToBytes('39383736353433323130'),
          radix: 10,
          expected: OpCodes.AnsiToBytes('6124200773')
        },
        {
          text: 'NIST FF1-AES128 Sample 3 - alphanumeric with tweak',
          uri: 'https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/SP80038GTest.java',
          input: OpCodes.AnsiToBytes('0123456789abcdefghi'),
          key: OpCodes.Hex8ToBytes('2B7E151628AED2A6ABF7158809CF4F3C'),
          tweak: OpCodes.Hex8ToBytes('3737373770717273373737'),
          radix: 36,
          expected: OpCodes.AnsiToBytes('a9tv40mll9kdu509eum')
        },
        {
          text: 'NIST FF1-AES192 Sample 4 - decimal digits, no tweak',
          uri: 'https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/SP80038GTest.java',
          input: OpCodes.AnsiToBytes('0123456789'),
          key: OpCodes.Hex8ToBytes('2B7E151628AED2A6ABF7158809CF4F3CEF4359D8D580AA4F'),
          tweak: new Uint8Array(0),
          radix: 10,
          expected: OpCodes.AnsiToBytes('2830668132')
        },
        {
          text: 'NIST FF1-AES192 Sample 5 - decimal digits with tweak',
          uri: 'https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/SP80038GTest.java',
          input: OpCodes.AnsiToBytes('0123456789'),
          key: OpCodes.Hex8ToBytes('2B7E151628AED2A6ABF7158809CF4F3CEF4359D8D580AA4F'),
          tweak: OpCodes.Hex8ToBytes('39383736353433323130'),
          radix: 10,
          expected: OpCodes.AnsiToBytes('2496655549')
        },
        {
          text: 'NIST FF1-AES256 Sample 6 - decimal digits, no tweak',
          uri: 'https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/SP80038GTest.java',
          input: OpCodes.AnsiToBytes('0123456789'),
          key: OpCodes.Hex8ToBytes('2B7E151628AED2A6ABF7158809CF4F3CEF4359D8D580AA4F7F036D6F04FC6A94'),
          tweak: new Uint8Array(0),
          radix: 10,
          expected: OpCodes.AnsiToBytes('6657667009')
        },
        {
          text: 'NIST FF1-AES256 Sample 7 - decimal digits with tweak',
          uri: 'https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/SP80038GTest.java',
          input: OpCodes.AnsiToBytes('0123456789'),
          key: OpCodes.Hex8ToBytes('2B7E151628AED2A6ABF7158809CF4F3CEF4359D8D580AA4F7F036D6F04FC6A94'),
          tweak: OpCodes.Hex8ToBytes('39383736353433323130'),
          radix: 10,
          expected: OpCodes.AnsiToBytes('1001623463')
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
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 0; // Variable size for FF1
      this.KeySize = 0;

      // FF1 configuration properties (set by test framework)
      this._radix = 10; // Default to decimal
      this._tweak = new Uint8Array(0); // Default empty tweak

      // Internal components
      this.aesInstance = null;
      this.radixConverter = null;
      this.aesPrf = null;
    }

    // Key property setter/getter
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.KeySize = 0;
        this.aesInstance = null;
        this.aesPrf = null;
        return;
      }

      // Validate AES key sizes (128, 192, or 256 bits)
      if (keyBytes.length !== 16 && keyBytes.length !== 24 && keyBytes.length !== 32) {
        throw new Error(`FF1: Invalid key size ${keyBytes.length} bytes. Must be 16, 24, or 32 bytes for AES`);
      }

      this._key = new Uint8Array(keyBytes);
      this.KeySize = keyBytes.length;

      // Initialize AES instance for PRF
      try {
        const RijndaelAlgorithm = AlgorithmFramework.Find('Rijndael (AES)');
        if (!RijndaelAlgorithm) {
          throw new Error('FF1: Rijndael/AES algorithm not found. Required for PRF function.');
        }

        this.aesInstance = RijndaelAlgorithm.CreateInstance(false); // Encryption mode
        this.aesInstance.key = keyBytes;
        this.aesPrf = new AESPRF(this.aesInstance);
      } catch (error) {
        throw new Error(`FF1: Failed to initialize AES for PRF: ${error.message}`);
      }
    }

    get key() {
      return this._key ? new Uint8Array(this._key) : null;
    }

    // Radix property setter/getter (for test framework)
    set radix(value) {
      if (value < FF1_CONSTANTS.MIN_RADIX || value > FF1_CONSTANTS.MAX_RADIX) {
        throw new Error(`FF1: Invalid radix ${value}. Must be between ${FF1_CONSTANTS.MIN_RADIX} and ${FF1_CONSTANTS.MAX_RADIX}`);
      }
      this._radix = value;
      this.radixConverter = new RadixConverter(value);
    }

    get radix() {
      return this._radix;
    }

    // Tweak property setter/getter (for test framework)
    set tweak(value) {
      this._tweak = value ? new Uint8Array(value) : new Uint8Array(0);
    }

    get tweak() {
      return new Uint8Array(this._tweak);
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("FF1: Key not set");
      if (!this.radixConverter) {
        this.radixConverter = new RadixConverter(this._radix);
      }

      // Clear any previous input
      this.inputBuffer = [...data];
    }

    Result() {
      if (!this._key) throw new Error("FF1: Key not set");
      if (this.inputBuffer.length === 0) throw new Error("FF1: No data fed");
      if (!this.aesPrf) throw new Error("FF1: AES PRF not initialized");
      if (!this.radixConverter) {
        this.radixConverter = new RadixConverter(this._radix);
      }

      // Convert buffer to numeral array
      const numerals = this._bytesToNumerals(this.inputBuffer);
      const n = numerals.length;

      // Validate input length per NIST spec
      if (n < FF1_CONSTANTS.MIN_LENGTH || n > FF1_CONSTANTS.MAX_LENGTH) {
        throw new Error(`FF1: Invalid input length ${n}. Must be between ${FF1_CONSTANTS.MIN_LENGTH} and ${FF1_CONSTANTS.MAX_LENGTH}`);
      }

      // Validate minimum domain size (radix^n >= 10^6)
      const domainSize = Math.pow(this._radix, n);
      if (domainSize < FF1_CONSTANTS.MIN_DOMAIN_SIZE) {
        throw new Error(`FF1: Domain size too small. radix^n (${domainSize}) must be >= ${FF1_CONSTANTS.MIN_DOMAIN_SIZE}`);
      }

      // Process with FF1 algorithm
      const outputNumerals = this.isInverse
        ? this._decryptFF1(numerals)
        : this._encryptFF1(numerals);

      // Clear input buffer
      this.inputBuffer = [];

      return this._numeralsToBytes(outputNumerals);
    }

    // FF1 Encryption (Algorithm 7 from NIST SP 800-38G)
    _encryptFF1(numerals) {
      const n = numerals.length;
      const u = Math.floor(n / 2);
      const v = n - u;

      // Split into left (A) and right (B) halves
      let A = numerals.slice(0, u);
      let B = numerals.slice(u);

      // Calculate parameters
      const t = this._tweak.length;
      const b = calculateB_FF1(this._radix, v);
      const d = (b + 7) & ~3; // Round up to nearest multiple of 4
      const P = calculateP_FF1(this._radix, u, n, t);
      const { modU, modV } = calculateModUV(this._radix, u, v);

      let m = v;

      // 10 Feistel rounds
      for (let i = 0; i < 10; i++) {
        // Calculate Y using AES-based PRF
        const y = this._calculateY_FF1(i, P, B, b, d, t);

        // Update m
        m = n - m;
        const modulus = (i & 1) === 0 ? modU : modV;

        // Calculate c = (NUM(A) + y) mod radix^m
        const numA = this.radixConverter.fromEncoding(A);
        const c = BigIntegerUtils.mod(numA + y, modulus);

        // Convert c back to numeral array
        const C = new Array(m);
        this.radixConverter.toEncoding(c, m, C);

        // Feistel swap: A = B, B = C
        const temp = A;
        A = B;
        B = C;
      }

      return A.concat(B);
    }

    // FF1 Decryption (Algorithm 8 from NIST SP 800-38G)
    _decryptFF1(numerals) {
      const n = numerals.length;
      const u = Math.floor(n / 2);
      const v = n - u;

      // Split into left (A) and right (B) halves
      let A = numerals.slice(0, u);
      let B = numerals.slice(u);

      // Calculate parameters
      const t = this._tweak.length;
      const b = calculateB_FF1(this._radix, v);
      const d = (b + 7) & ~3; // Round up to nearest multiple of 4
      const P = calculateP_FF1(this._radix, u, n, t);
      const { modU, modV } = calculateModUV(this._radix, u, v);

      let m = u;

      // 10 Feistel rounds in reverse
      for (let i = 9; i >= 0; i--) {
        // Calculate Y using AES-based PRF
        const y = this._calculateY_FF1(i, P, A, b, d, t);

        // Update m
        m = n - m;
        const modulus = (i & 1) === 0 ? modU : modV;

        // Calculate c = (NUM(B) - y) mod radix^m
        const numB = this.radixConverter.fromEncoding(B);
        const c = BigIntegerUtils.mod(numB - y, modulus);

        // Convert c back to numeral array
        const C = new Array(m);
        this.radixConverter.toEncoding(c, m, C);

        // Feistel swap: B = A, A = C
        const temp = B;
        B = A;
        A = C;
      }

      return A.concat(B);
    }

    // Calculate Y using AES-based PRF (follows NIST SP 800-38G exactly)
    _calculateY_FF1(round, P, numeralArray, b, d, t) {
      // i. Convert numeral array to big integer and then to bytes
      const numAB = this.radixConverter.fromEncoding(numeralArray);
      const bytesAB = BigIntegerUtils.toByteArray(numAB);

      // Construct Q = T || 0^s || [round] || [NUM(B)]_b
      const zeroes = (-(t + b + 1)) & 15; // Padding to make total length multiple of 16
      const Q = new Uint8Array(t + zeroes + 1 + b);

      // Copy tweak
      Q.set(this._tweak, 0);
      // Zeroes are already 0 by default
      // Set round number
      Q[t + zeroes] = round;
      // Copy NUM(B) bytes (right-justified)
      Q.set(bytesAB, Q.length - bytesAB.length);

      // ii. R = PRF(P || Q)
      const PQ = new Uint8Array(P.length + Q.length);
      PQ.set(P, 0);
      PQ.set(Q, P.length);

      let R = this.aesPrf.prf(PQ);

      // iii. If d > 16, extend R
      let sBlocks = R;
      if (d > FF1_CONSTANTS.BLOCK_SIZE) {
        const sBlocksLen = Math.ceil(d / FF1_CONSTANTS.BLOCK_SIZE);
        sBlocks = new Uint8Array(sBlocksLen * FF1_CONSTANTS.BLOCK_SIZE);

        // Copy initial R
        sBlocks.set(R, 0);

        // Extract J from R (last 4 bytes as big-endian int)
        const j0 = OpCodes.Pack32BE(
          R[FF1_CONSTANTS.BLOCK_SIZE - 4],
          R[FF1_CONSTANTS.BLOCK_SIZE - 3],
          R[FF1_CONSTANTS.BLOCK_SIZE - 2],
          R[FF1_CONSTANTS.BLOCK_SIZE - 1]
        );

        // Generate additional blocks
        for (let j = 1; j < sBlocksLen; j++) {
          const sOff = j * FF1_CONSTANTS.BLOCK_SIZE;

          // Copy R[0..11] and set R[12..15] = J XOR j
          sBlocks.set(R.slice(0, FF1_CONSTANTS.BLOCK_SIZE - 4), sOff);

          // Write (j0 XOR j) as 4 bytes big-endian using OpCodes
          const xorResult = OpCodes.XOR32(j0, j);
          sBlocks[sOff + FF1_CONSTANTS.BLOCK_SIZE - 4] = OpCodes.GetByte(xorResult, 3);
          sBlocks[sOff + FF1_CONSTANTS.BLOCK_SIZE - 3] = OpCodes.GetByte(xorResult, 2);
          sBlocks[sOff + FF1_CONSTANTS.BLOCK_SIZE - 2] = OpCodes.GetByte(xorResult, 1);
          sBlocks[sOff + FF1_CONSTANTS.BLOCK_SIZE - 1] = OpCodes.GetByte(xorResult, 0);

          // Encrypt this block
          const block = sBlocks.slice(sOff, sOff + FF1_CONSTANTS.BLOCK_SIZE);
          this.aesInstance.Feed(block);
          const encryptedBlock = this.aesInstance.Result();
          sBlocks.set(encryptedBlock, sOff);
        }
      }

      // iv. Return first d bytes as big integer
      const yBytes = sBlocks.slice(0, d);
      return BigIntegerUtils.fromByteArray(yBytes);
    }

    // Convert bytes to numeral array based on radix
    _bytesToNumerals(bytes) {
      const numerals = [];
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        let numeral;

        // Convert ASCII characters to numeric values
        if (byte >= 48 && byte <= 57) {
          // ASCII digits '0'-'9'
          numeral = byte - 48;
        } else if (byte >= 97 && byte <= 122) {
          // ASCII lowercase 'a'-'z' (10-35)
          numeral = byte - 97 + 10;
        } else if (byte >= 65 && byte <= 90) {
          // ASCII uppercase 'A'-'Z' (36-61 for radix > 36)
          numeral = byte - 65 + 36;
        } else {
          // For non-ASCII or direct byte values, use as-is
          numeral = byte;
        }

        // Validate that numeral value is within radix
        if (numeral >= this._radix) {
          throw new Error(`FF1: Character '${String.fromCharCode(byte)}' (value ${numeral}) not valid for radix ${this._radix}`);
        }

        numerals.push(numeral);
      }
      return numerals;
    }

    // Convert numeral array to bytes (ASCII characters)
    _numeralsToBytes(numerals) {
      const bytes = new Uint8Array(numerals.length);
      for (let i = 0; i < numerals.length; i++) {
        const numeral = numerals[i];

        // Validate numeral is within radix
        if (numeral >= this._radix) {
          throw new Error(`FF1: Invalid numeral value ${numeral} for radix ${this._radix}`);
        }

        // Convert numeral back to ASCII character
        let byte;
        if (numeral < 10) {
          // 0-9 -> ASCII '0'-'9'
          byte = numeral + 48;
        } else if (numeral < 36) {
          // 10-35 -> ASCII 'a'-'z'
          byte = numeral - 10 + 97;
        } else if (numeral < 62) {
          // 36-61 -> ASCII 'A'-'Z'
          byte = numeral - 36 + 65;
        } else {
          // For values >= 62, use as-is
          byte = numeral;
        }

        bytes[i] = byte;
      }
      return bytes;
    }

  }


  // Register the algorithm
  const algorithmInstance = new FF1Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // Export for use
  return { FF1Algorithm, FF1Instance };
});