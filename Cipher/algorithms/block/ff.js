/*
 * FF (Format-Preserving Encryption) Consolidated Implementation
 * Includes FF1 and FF3 algorithms from NIST SP 800-38G (March 2016)
 * Production-grade FF1 + Educational FF3 (deprecated) implementation
 *
 * FF1: Secure format-preserving encryption for credit cards, SSNs, phone numbers, etc.
 * FF3: DEPRECATED due to security vulnerabilities - included for historical/educational purposes
 *
 * Implementation follows NIST SP 800-38G with proper big integer arithmetic and AES-based PRF
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

  // Load Rijndael/AES dependency for FF1 PRF
  /** @type {Object|null} */
  let RijndaelModule = null;
  if (typeof require !== 'undefined') {
    try {
      RijndaelModule = require('./rijndael.js');
    } catch (e) {
      // Rijndael may already be loaded, will try AlgorithmFramework.Find() as fallback
    }
  }

  // ===== SHARED UTILITIES =====

  // FF1 Constants from NIST SP 800-38G
  const FF1_MIN_LENGTH = 2;
  const FF1_MAX_LENGTH = 56;
  const FF1_MIN_RADIX = 2;
  const FF1_MAX_RADIX = 65536;
  const FF1_BLOCK_SIZE = 16; // AES block size
  const FF1_MIN_DOMAIN_SIZE = 1000000; // radix^n >= 10^6 per NIST spec

  // FF3 Constants
  const FF3_MIN_RADIX = 2;
  const FF3_MAX_RADIX = 65536;
  const FF3_TWEAK_LENGTH = 8; // FF3 requires 64-bit (8 byte) tweak
  const FF3_ROUNDS = 8;
  const FF3_MIN_DOMAIN_SIZE = 100; // radix^minlen >= 100 per NIST SP 800-38G Section 5.2

  // The lengths one radix admits, per NIST SP 800-38G Section 5.2 (FF3
  // requirements): minlen is the smallest n with radix^n >= 100, and maxlen is
  // 2 * floor(log_radix(2^96)). The old code hard-coded 2 and 56, which are the
  // decimal answers, and applied them to every radix.
  /**
   * @param {int32} radix - Radix
   * @returns {int32[]} [minLength, maxLength]
   */
  function ff3LengthLimits(radix) {
    let minLength = 2;
    while (Math.pow(radix, minLength) < FF3_MIN_DOMAIN_SIZE) minLength++;
    const maxLength = 2 * Math.floor(96 * Math.LN2 / Math.log(radix));
    /** @type {int32[]} */
    const limits = [minLength, maxLength];
    return limits;
  }

  // ===== BIG INTEGER UTILITIES (SHARED) =====

  // BigInteger operations using JavaScript BigInt
  /**
   * @param {uint8[]} bytes - Big-endian bytes
   * @returns {BigInt} Their value
   */
  function bigFromBytes(bytes) {
    if (bytes.length === 0) return 0n;
    /** @type {BigInt} */
    let result = 0n;
    for (let i = 0; i < bytes.length; i++) {
      result = OpCodes.ShiftLn(result, 8) + BigInt(OpCodes.And32(bytes[i], 0xFF));
    }
    return result;
  }

  /**
   * @param {BigInt} bigint - Value (its magnitude is encoded)
   * @param {int32} [minLength=0] - Minimum output length (zero-padded on the left)
   * @returns {uint8[]} Big-endian bytes
   */
  function bigToBytes(bigint, minLength = 0) {
    if (bigint === 0n) {
      /** @type {uint8[]} */
      const zero = new Uint8Array(Math.max(1, minLength));
      return zero;
    }

    /** @type {uint8[]} */
    const bytes = [];
    let value = bigint < 0n ? -bigint : bigint;

    while (value > 0n) {
      /** @type {uint8} */
      const low = Number(OpCodes.AndN(value, 0xFFn));
      bytes.unshift(low);
      value = OpCodes.ShiftRn(value, 8);
    }

    while (bytes.length < minLength) {
      bytes.unshift(0);
    }

    /** @type {uint8[]} */
    const out = new Uint8Array(bytes);
    return out;
  }

  /**
   * @param {BigInt} base - Base
   * @param {int32} exponent - Exponent
   * @returns {BigInt} base ** exponent
   */
  function bigPow(base, exponent) {
    return base ** BigInt(exponent);
  }

  /**
   * @param {BigInt} a - Value
   * @param {BigInt} m - Modulus
   * @returns {BigInt} a mod m in 0..m-1
   */
  function bigMod(a, m) {
    const result = a % m;
    return result < 0n ? result + m : result;
  }

  // ===== RADIX CONVERTER (SHARED) =====

  // Converts between numeral arrays and big integers for different radix values
  class RadixConverter {
    /**
     * @param {int32} radix - Radix 2..65536
     */
    constructor(radix) {
      if (radix < 2 || radix > 65536) {
        throw new Error("Invalid radix " + radix + ". Must be between 2 and 65536");
      }
      /** @type {int32} */
      this.radix = radix;
      /** @type {BigInt} */
      this.bigRadix = BigInt(radix);
    }

    // Convert numeral array to BigInt
    /**
     * @param {int32[]} numerals - Numerals, most significant first
     * @returns {BigInt} Their value
     */
    fromEncoding(numerals) {
      /** @type {BigInt} */
      let result = 0n;
      for (let i = 0; i < numerals.length; i++) {
        result = result * this.bigRadix + BigInt(numerals[i]);
      }
      return result;
    }

    // Convert BigInt to numeral array of specified length
    /**
     * @param {BigInt} bigint - Value
     * @param {int32} length - Number of numerals
     * @param {int32[]} output - Receives the numerals, most significant first
     */
    toEncoding(bigint, length, output) {
      let value = bigMod(bigint, bigPow(this.bigRadix, length));

      for (let i = length - 1; i >= 0; i--) {
        /** @type {int32} */
        const digit = Number(value % this.bigRadix);
        output[i] = digit;
        value = value / this.bigRadix;
      }
    }
  }

  // Finds the AES block cipher: the directly imported module first (bypasses
  // the AlgorithmFramework registry), then the registry under its names.
  /**
   * @returns {BlockCipherAlgorithm|null} The Rijndael algorithm, or null
   */
  function findRijndael() {
    /** @type {BlockCipherAlgorithm|null} */
    let found = null;
    if (RijndaelModule && RijndaelModule.RijndaelAlgorithm) {
      /** @type {BlockCipherAlgorithm} */
      const created = new RijndaelModule.RijndaelAlgorithm();
      found = created;
    }
    if (!found) found = AlgorithmFramework.Find('Rijndael (AES)');
    if (!found) found = AlgorithmFramework.Find('Rijndael');
    if (!found) found = AlgorithmFramework.Find('AES');
    return found;
  }

  // ===== FF1-SPECIFIC UTILITIES =====

  // AES-based Pseudo-Random Function using CBC-MAC
  class AESPRF {
    /**
     * @param {IBlockCipherInstance} aesInstance - Keyed AES encryptor
     */
    constructor(aesInstance) {
      /** @type {IBlockCipherInstance} */
      this.aes = aesInstance;
    }

    // CBC-MAC implementation following NIST SP 800-38G
    /**
     * @param {uint8[]} data - Input, a multiple of 16 bytes
     * @returns {uint8[]} 16-byte CBC-MAC
     */
    prf(data) {
      if (data.length % FF1_BLOCK_SIZE !== 0) {
        throw new Error('PRF input must be multiple of block size');
      }

      const blocks = data.length / FF1_BLOCK_SIZE;
      /** @type {uint8[]} */
      let y = new Uint8Array(FF1_BLOCK_SIZE);

      for (let i = 0; i < blocks; i++) {
        const blockOffset = i * FF1_BLOCK_SIZE;

        // XOR current block with previous output
        for (let j = 0; j < FF1_BLOCK_SIZE; j++) {
          y[j] = OpCodes.Xor32(y[j], data[blockOffset + j]);
        }

        // Encrypt the XOR result
        this.aes.Feed(y);
        /** @type {uint8[]} */
        const encrypted = this.aes.Result();
        y = encrypted;
      }

      return y;
    }
  }

  // Calculate b parameter: ceiling(log_2(radix^v)) / 8
  // Following BouncyCastle SP80038G.java implementation for accuracy
  /**
   * @param {int32} radix - Radix
   * @param {int32} v - Length of the right half
   * @returns {int32} Bytes needed for radix^v
   */
  function calculateB_FF1(radix, v) {
    // Count trailing zeros (powers of 2 in radix factorization)
    let powersOfTwo = 0;
    /** @type {uint32} */
    let temp = radix;
    while (OpCodes.And32(temp, 1) === 0) {  // Bit test for LSB
      powersOfTwo++;
      temp = OpCodes.Shr32(temp, 1);  // Unsigned right shift
    }

    // Calculate total bits needed
    let bits = powersOfTwo * v;
    const oddPart = OpCodes.Shr32(radix, powersOfTwo);  // Unsigned right shift

    if (oddPart !== 1) {
      // Add bits from odd part: ceil(log2(oddPart^v)), the bit length of the positive oddPart^v
      const oddPowerBits = OpCodes.BitCountN(bigPow(BigInt(oddPart), v));
      bits += oddPowerBits;
    }

    return Math.floor((bits + 7) / 8);
  }

  // Calculate P parameter block according to NIST SP 800-38G
  /**
   * @param {int32} radix - Radix
   * @param {int32} u - Length of the left half
   * @param {int32} n - Message length
   * @param {int32} t - Tweak length
   * @returns {uint8[]} The 16-byte P block
   */
  function calculateP_FF1(radix, u, n, t) {
    /** @type {uint8[]} */
    const P = new Uint8Array(FF1_BLOCK_SIZE);

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
  /**
   * @param {int32} radix - Radix
   * @param {int32} u - Length of the left half
   * @param {int32} v - Length of the right half
   * @returns {BigInt[]} [radix^u, radix^v]
   */
  function calculateModUV(radix, u, v) {
    const bigRadix = BigInt(radix);
    /** @type {BigInt[]} */
    const moduli = [bigPow(bigRadix, u), bigPow(bigRadix, v)];
    return moduli;
  }

  // ===== FF1 ALGORITHM IMPLEMENTATION =====

  /**
 * FF1Algorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

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

      // The complete set of FF1 sample vectors NIST publishes alongside
      // SP 800-38G, covering AES-128/192/256 and radix 10 and 36.
      const FF1_SAMPLES_URI = 'https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF1samples.pdf';
      const K128 = '2B7E151628AED2A6ABF7158809CF4F3C';
      const K192 = '2B7E151628AED2A6ABF7158809CF4F3CEF4359D8D580AA4F';
      const K256 = '2B7E151628AED2A6ABF7158809CF4F3CEF4359D8D580AA4F7F036D6F04FC6A94';
      const T0 = '';
      const T1 = '39383736353433323130';
      const T2 = '3737373770717273373737';

      this.tests = [
        { n: 'Sample #1 AES-128', k: K128, t: T0, r: 10, p: '0123456789', c: '2433477484' },
        { n: 'Sample #2 AES-128', k: K128, t: T1, r: 10, p: '0123456789', c: '6124200773' },
        { n: 'Sample #3 AES-128', k: K128, t: T2, r: 36, p: '0123456789abcdefghi', c: 'a9tv40mll9kdu509eum' },
        { n: 'Sample #4 AES-192', k: K192, t: T0, r: 10, p: '0123456789', c: '2830668132' },
        { n: 'Sample #5 AES-192', k: K192, t: T1, r: 10, p: '0123456789', c: '2496655549' },
        { n: 'Sample #6 AES-192', k: K192, t: T2, r: 36, p: '0123456789abcdefghi', c: 'xbj3kv35jrawxv32ysr' },
        { n: 'Sample #7 AES-256', k: K256, t: T0, r: 10, p: '0123456789', c: '6657667009' },
        { n: 'Sample #8 AES-256', k: K256, t: T1, r: 10, p: '0123456789', c: '1001623463' },
        { n: 'Sample #9 AES-256', k: K256, t: T2, r: 36, p: '0123456789abcdefghi', c: 'xs8a0azh2avyalyzuwd' }
      ].map(s => ({
        text: 'NIST FF1 ' + s.n + ' radix ' + s.r,
        uri: FF1_SAMPLES_URI,
        input: OpCodes.AnsiToBytes(s.p),
        key: OpCodes.Hex8ToBytes(s.k),
        tweak: s.t ? OpCodes.Hex8ToBytes(s.t) : new Uint8Array(0),
        radix: s.r,
        expected: OpCodes.AnsiToBytes(s.c)
      })).concat([
        // No NIST sample needs more than one PRF block. From 37 radix-36
        // numerals on, d = 4 * ceil(b / 4) + 4 exceeds 16 and step 6.ii extends
        // R with CIPH(R xor [j]); 36 numerals is the last length with d = 16.
        { n: '36 numerals, d = 16', k: K128, t: T2, r: 36, p: '0123456789abcdefghijklmnopqrstuvwxyz', c: 'etctqbhw42iifzhqis3g034b3qcrdrc4de0b' },
        { n: '37 numerals, d = 20', k: K128, t: T2, r: 36, p: '0123456789abcdefghijklmnopqrstuvwxyz0', c: '0yzk1dh3qrizd3fakndofz0lswvabsajv45o9' },
        { n: '42 numerals, d = 20', k: K192, t: T0, r: 36, p: 'zyxwvutsrqponmlkjihgfedcba9876543210zyxwvu', c: '0km7yov4j83dez5xjgj0f3garxzbtuv8lb38oyl5dl' },
        { n: '56 numerals, d = 24', k: K256, t: T1, r: 36, p: '0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghij', c: 'kjgglrhxgz6085z4vy46f12kenmi9msle48zlxb1ign5h8wzq6at5s4y' }
      ].map(s => ({
        text: 'FF1 radix ' + s.r + ', ' + s.n + ' (Bouncy Castle FpeFf1Engine)',
        uri: 'https://github.com/bcgit/bc-csharp/blob/master/crypto/src/crypto/fpe/FpeFf1Engine.cs',
        input: OpCodes.AnsiToBytes(s.p),
        key: OpCodes.Hex8ToBytes(s.k),
        tweak: s.t ? OpCodes.Hex8ToBytes(s.t) : new Uint8Array(0),
        radix: s.r,
        expected: OpCodes.AnsiToBytes(s.c)
      })));
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {FF1Instance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new FF1Instance(this, isInverse);
    }
  }

  /**
 * FF1 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class FF1Instance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {FF1Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 0; // Variable size for FF1
      this.KeySize = 0;

      // FF1 configuration properties (set by test framework)
      /** @type {int32} */
      this._radix = 10; // Default to decimal
      /** @type {uint8[]} */
      this._tweak = new Uint8Array(0); // Default empty tweak

      // Internal components
      /** @type {IBlockCipherInstance|null} */
      this.aesInstance = null;
      /** @type {RadixConverter|null} */
      this.radixConverter = null;
      /** @type {AESPRF|null} */
      this.aesPrf = null;
    }

    // Key property setter/getter
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

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
        throw new Error("FF1: Invalid key size " + keyBytes.length + " bytes. Must be 16, 24, or 32 bytes for AES");
      }

      this._key = new Uint8Array(keyBytes);
      this.KeySize = keyBytes.length;

      // Reset AES instance (will be lazily initialized when needed)
      this.aesInstance = null;
      this.aesPrf = null;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? new Uint8Array(this._key) : null;
    }

    // Radix property setter/getter (for test framework)
    /**
     * @param {int32} value - Radix 2..65536
     */
    set radix(value) {
      if (value < FF1_MIN_RADIX || value > FF1_MAX_RADIX) {
        throw new Error("FF1: Invalid radix " + value + ". Must be between " + FF1_MIN_RADIX + " and " + FF1_MAX_RADIX);
      }
      this._radix = value;
      this.radixConverter = new RadixConverter(value);
    }

    /**
     * @returns {int32} Radix
     */
    get radix() {
      return this._radix;
    }

    // Tweak property setter/getter (for test framework)
    /**
     * @param {uint8[]|null} value - Tweak bytes (null for none)
     */
    set tweak(value) {
      this._tweak = value ? new Uint8Array(value) : new Uint8Array(0);
    }

    /**
     * @returns {uint8[]} Copy of the tweak
     */
    get tweak() {
      return new Uint8Array(this._tweak);
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("FF1: Key not set");
      if (!this.radixConverter) {
        this.radixConverter = new RadixConverter(this._radix);
      }

      // Clear any previous input
      // Feed is a streaming interface: successive calls extend the message
      // rather than replace it, so Feed(a); Feed(b) processes the same bytes
      // as Feed(a || b).
      for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("FF1: Key not set");
      if (this.inputBuffer.length === 0) throw new Error("FF1: No data fed");

      // Lazy initialization of AES for PRF (ensures Rijndael is loaded)
      if (!this.aesPrf) {
        try {
          // The directly imported module first, then the AlgorithmFramework registry
          const RijndaelAlgorithm = findRijndael();

          if (!RijndaelAlgorithm) {
            throw new Error('Rijndael/AES algorithm not found. Ensure rijndael.js is loaded.');
          }

          /** @type {IBlockCipherInstance} */
          const aes = RijndaelAlgorithm.CreateInstance(false); // Encryption mode
          this.aesInstance = aes;
          aes.key = this._key;
          this.aesPrf = new AESPRF(aes);
        } catch (error) {
          throw new Error("FF1: Failed to initialize AES for PRF: " + error.message);
        }
      }

      if (!this.radixConverter) {
        this.radixConverter = new RadixConverter(this._radix);
      }

      // Convert buffer to numeral array
      const numerals = this._bytesToNumerals(this.inputBuffer);
      const n = numerals.length;

      // Validate input length per NIST spec
      if (n < FF1_MIN_LENGTH || n > FF1_MAX_LENGTH) {
        throw new Error("FF1: Invalid input length " + n + ". Must be between " + FF1_MIN_LENGTH + " and " + FF1_MAX_LENGTH);
      }

      // Validate minimum domain size (radix^n >= 10^6)
      const domainSize = Math.pow(this._radix, n);
      if (domainSize < FF1_MIN_DOMAIN_SIZE) {
        throw new Error("FF1: Domain size too small. radix^n (" + domainSize + ") must be >= " + FF1_MIN_DOMAIN_SIZE);
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
    /**
     * @param {int32[]} numerals - Input numerals
     * @returns {int32[]} Output numerals
     */
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
      const d = OpCodes.And32(b + 7, 0xFFFFFFFC); // Round up to nearest multiple of 4
      const P = calculateP_FF1(this._radix, u, n, t);
      const moduli = calculateModUV(this._radix, u, v);
      const modU = moduli[0], modV = moduli[1];

      let m = v;

      // 10 Feistel rounds
      for (let i = 0; i < 10; i++) {
        // Calculate Y using AES-based PRF
        const y = this._calculateY_FF1(i, P, B, b, d, t);

        // Update m
        m = n - m;
        const modulus = OpCodes.And32(i, 1) === 0 ? modU : modV;

        // Calculate c = (NUM(A) + y) mod radix^m
        /** @type {BigInt} */
        const numA = this.radixConverter.fromEncoding(A);
        const c = bigMod(numA + y, modulus);

        // Convert c back to numeral array
        /** @type {int32[]} */
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
    /**
     * @param {int32[]} numerals - Input numerals
     * @returns {int32[]} Output numerals
     */
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
      const d = OpCodes.And32(b + 7, 0xFFFFFFFC); // Round up to nearest multiple of 4
      const P = calculateP_FF1(this._radix, u, n, t);
      const moduli = calculateModUV(this._radix, u, v);
      const modU = moduli[0], modV = moduli[1];

      let m = u;

      // 10 Feistel rounds in reverse
      for (let i = 9; i >= 0; i--) {
        // Calculate Y using AES-based PRF
        const y = this._calculateY_FF1(i, P, A, b, d, t);

        // Update m
        m = n - m;
        const modulus = OpCodes.And32(i, 1) === 0 ? modU : modV;

        // Calculate c = (NUM(B) - y) mod radix^m
        /** @type {BigInt} */
        const numB = this.radixConverter.fromEncoding(B);
        const c = bigMod(numB - y, modulus);

        // Convert c back to numeral array
        /** @type {int32[]} */
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
    /**
     * @param {int32} round - Round number
     * @param {uint8[]} P - The P block
     * @param {int32[]} numeralArray - Half being fed to the PRF
     * @param {int32} b - Bytes of NUM(half)
     * @param {int32} d - Bytes of output
     * @param {int32} t - Tweak length
     * @returns {BigInt} y
     */
    _calculateY_FF1(round, P, numeralArray, b, d, t) {
      // i. Convert numeral array to big integer and then to bytes
      /** @type {BigInt} */
      const numAB = this.radixConverter.fromEncoding(numeralArray);
      const bytesAB = bigToBytes(numAB);

      // Construct Q = T || 0^s || [round] || [NUM(B)]_b
      const zeroes = OpCodes.And32(-(t + b + 1), 15); // Padding to make total length multiple of 16
      /** @type {uint8[]} */
      const Q = new Uint8Array(OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(t, zeroes), 1), b));

      // Copy tweak
      Q.set(this._tweak, 0);
      // Zeroes are already 0 by default
      // Set round number
      Q[OpCodes.Add32(t, zeroes)] = round;
      // Copy NUM(B) bytes (right-justified)
      Q.set(bytesAB, Q.length - bytesAB.length);

      // ii. R = PRF(P || Q)
      /** @type {uint8[]} */
      const PQ = new Uint8Array(P.length + Q.length);
      PQ.set(P, 0);
      PQ.set(Q, P.length);

      /** @type {uint8[]} */
      const R = this.aesPrf.prf(PQ);

      // iii. If d > 16, extend R
      let sBlocks = R;
      if (d > FF1_BLOCK_SIZE) {
        const sBlocksLen = Math.ceil(d / FF1_BLOCK_SIZE);
        /** @type {uint8[]} */
        const extended = new Uint8Array(sBlocksLen * FF1_BLOCK_SIZE);
        sBlocks = extended;

        // Copy initial R
        sBlocks.set(R, 0);

        // Extract J from R (last 4 bytes as big-endian int)
        const j0 = OpCodes.Pack32BE(
          R[FF1_BLOCK_SIZE - 4],
          R[FF1_BLOCK_SIZE - 3],
          R[FF1_BLOCK_SIZE - 2],
          R[FF1_BLOCK_SIZE - 1]
        );

        // Generate additional blocks
        for (let j = 1; j < sBlocksLen; j++) {
          const sOff = j * FF1_BLOCK_SIZE;

          // Copy R[0..11] and set R[12..15] = J XOR j
          sBlocks.set(R.slice(0, FF1_BLOCK_SIZE - 4), sOff);

          // Write (j0 XOR j) as 4 bytes big-endian using OpCodes
          const xorResult = OpCodes.Xor32(j0, j);
          sBlocks[sOff + FF1_BLOCK_SIZE - 4] = OpCodes.GetByte(xorResult, 3);
          sBlocks[sOff + FF1_BLOCK_SIZE - 3] = OpCodes.GetByte(xorResult, 2);
          sBlocks[sOff + FF1_BLOCK_SIZE - 2] = OpCodes.GetByte(xorResult, 1);
          sBlocks[sOff + FF1_BLOCK_SIZE - 1] = OpCodes.GetByte(xorResult, 0);

          // Encrypt this block
          const block = sBlocks.slice(sOff, sOff + FF1_BLOCK_SIZE);
          this.aesInstance.Feed(block);
          /** @type {uint8[]} */
          const encryptedBlock = this.aesInstance.Result();
          sBlocks.set(encryptedBlock, sOff);
        }
      }

      // iv. Return first d bytes as big integer
      const yBytes = sBlocks.slice(0, d);
      return bigFromBytes(yBytes);
    }

    // Convert bytes to numeral array based on radix
    /**
     * @param {uint8[]} bytes - Characters
     * @returns {int32[]} Numerals
     */
    _bytesToNumerals(bytes) {
      /** @type {int32[]} */
      const numerals = [];
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        /** @type {int32} */
        let numeral = 0;

        // Convert ASCII characters to numeric values
        if (byte >= 48 && byte <= 57) {
          // ASCII digits '0'-'9'
          numeral = byte - 48;
        } else if (byte >= 97 && byte <= 122) {
          // ASCII lowercase 'a'-'z' (10-35)
          numeral = byte - 87; // byte - 97 + 10
        } else if (byte >= 65 && byte <= 90) {
          // ASCII uppercase 'A'-'Z' (36-61 for radix > 36)
          numeral = byte - 29; // byte - 65 + 36
        } else {
          // For non-ASCII or direct byte values, use as-is
          numeral = byte;
        }

        // Validate that numeral value is within radix
        if (numeral >= this._radix) {
          throw new Error("FF1: Character '" + (String.fromCharCode(byte)) + "' (value " + numeral + ") not valid for radix " + this._radix);
        }

        numerals.push(numeral);
      }
      return numerals;
    }

    // Convert numeral array to bytes (ASCII characters)
    /**
     * @param {int32[]} numerals - Numerals
     * @returns {uint8[]} Characters
     */
    _numeralsToBytes(numerals) {
      /** @type {uint8[]} */
      const bytes = new Uint8Array(numerals.length);
      for (let i = 0; i < numerals.length; i++) {
        const numeral = numerals[i];

        // Validate numeral is within radix
        if (numeral >= this._radix) {
          throw new Error("FF1: Invalid numeral value " + numeral + " for radix " + this._radix);
        }

        // Convert numeral back to ASCII character
        /** @type {int32} */
        let byte = 0;
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

  // ===== FF3 ALGORITHM IMPLEMENTATION =====

  /**
   * @returns {uint8[]} An all-zero 8-byte tweak
   */
  function zeroTweak() {
    /** @type {uint8[]} */
    const tweak = new Array(FF3_TWEAK_LENGTH);
    tweak.fill(0);
    return tweak;
  }

  /**
 * FF3Algorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class FF3Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "FF3";
      this.description = "Format-Preserving Encryption from NIST SP 800-38G (March 2016). DEPRECATED due to security vulnerabilities discovered after publication. Educational implementation for historical reference only.";
      this.inventor = "NIST";
      this.year = 2016;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Format-Preserving Encryption";
      this.securityStatus = SecurityStatus.BROKEN;
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
        new LinkItem("FF3 Security Vulnerabilities", "https://eprint.iacr.org/2017/521.pdf"),
        new LinkItem("NIST Withdrawal of FF3-1", "https://csrc.nist.gov/News/2017/Update-to-SP-800-38G")
      ];

      this.references = [
        new LinkItem("FF3 Security Analysis", "https://eprint.iacr.org/2017/521.pdf"),
        new LinkItem("Format-Preserving Encryption Vulnerabilities", "https://blog.cryptographyengineering.com/2016/08/13/format-preserving-encryption-ff1-and/"),
        new LinkItem("NIST SP 800-38G Rev 1", "https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-38g.pdf")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "FF3 Algorithm Deprecated",
          "FF3 was deprecated by NIST in 2017 due to discovered security vulnerabilities",
          "Use FF1 instead of FF3, or modern encryption algorithms like AES"
        ),
        new Vulnerability(
          "Practical distinguishing attacks",
          "FF3 is vulnerable to practical attacks that can distinguish it from a random permutation",
          "FF3 should never be used in production - algorithm is fundamentally broken"
        )
      ];

      // The complete set of FF3 sample vectors NIST publishes alongside
      // SP 800-38G, covering AES-128/192/256 and radix 10 and 26.
      const FF3_SAMPLES_URI = "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf";
      const K128 = "EF4359D8D580AA4F7F036D6F04FC6A94";
      const K192 = "EF4359D8D580AA4F7F036D6F04FC6A942B7E151628AED2A6";
      const K256 = "EF4359D8D580AA4F7F036D6F04FC6A942B7E151628AED2A6ABF7158809CF4F3C";
      const T1 = "D8E7920AFA330A73";
      const T2 = "9A768A92F60E12D8";
      const T0 = "0000000000000000";

      this.tests = [
        { n: "Sample #1  AES-128", k: K128, t: T1, r: 10, p: "890121234567890000", c: "750918814058654607" },
        { n: "Sample #2  AES-128", k: K128, t: T2, r: 10, p: "890121234567890000", c: "018989839189395384" },
        { n: "Sample #3  AES-128", k: K128, t: T1, r: 10, p: "89012123456789000000789000000", c: "48598367162252569629397416226" },
        { n: "Sample #4  AES-128", k: K128, t: T0, r: 10, p: "89012123456789000000789000000", c: "34695224821734535122613701434" },
        { n: "Sample #5  AES-128", k: K128, t: T2, r: 26, p: "0123456789abcdefghi", c: "g2pk40i992fn20cjakb" },
        { n: "Sample #6  AES-192", k: K192, t: T1, r: 10, p: "890121234567890000", c: "646965393875028755" },
        { n: "Sample #7  AES-192", k: K192, t: T2, r: 10, p: "890121234567890000", c: "961610514491424446" },
        { n: "Sample #8  AES-192", k: K192, t: T1, r: 10, p: "89012123456789000000789000000", c: "53048884065350204541786380807" },
        { n: "Sample #9  AES-192", k: K192, t: T0, r: 10, p: "89012123456789000000789000000", c: "98083802678820389295041483512" },
        { n: "Sample #10 AES-192", k: K192, t: T2, r: 26, p: "0123456789abcdefghi", c: "i0ihe2jfj7a9opf9p88" },
        { n: "Sample #11 AES-256", k: K256, t: T1, r: 10, p: "890121234567890000", c: "922011205562777495" },
        { n: "Sample #12 AES-256", k: K256, t: T2, r: 10, p: "890121234567890000", c: "504149865578056140" },
        { n: "Sample #13 AES-256", k: K256, t: T1, r: 10, p: "89012123456789000000789000000", c: "04344343235792599165734622699" },
        { n: "Sample #14 AES-256", k: K256, t: T0, r: 10, p: "89012123456789000000789000000", c: "30859239999374053872365555822" },
        { n: "Sample #15 AES-256", k: K256, t: T2, r: 26, p: "0123456789abcdefghi", c: "p0b2godfja9bhb7bk38" }
      ].map(s => ({
        text: "NIST FF3 " + s.n + " radix " + s.r,
        uri: FF3_SAMPLES_URI,
        input: OpCodes.AnsiToBytes(s.p),
        key: OpCodes.Hex8ToBytes(s.k),
        tweak: OpCodes.Hex8ToBytes(s.t),
        radix: s.r,
        expected: OpCodes.AnsiToBytes(s.c)
      }));
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {FF3Instance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new FF3Instance(this, isInverse);
    }
  }

  /**
 * FF3 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class FF3Instance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {FF3Algorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this.keyReversed = null;
      /** @type {IBlockCipherInstance|null} */
      this.aesInstance = null;
      this.key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 0; // Variable size for FF3
      this.KeySize = 0;

      // FF3 configuration
      /** @type {int32} */
      this._radix = 10; // Default to decimal
      /** @type {uint8[]} */
      this._tweak = zeroTweak(); // Tweak data (8 bytes for FF3)

      // AES instance for the round function, created lazily under REVB(K)
      this.aesInstance = null;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      this.aesInstance = null;

      if (!keyBytes) {
        this._key = null;
        this.KeySize = 0;
        this.keyReversed = null;
        return;
      }

      // Validate key size (must be 16, 24, or 32 bytes for AES)
      if (keyBytes.length !== 16 && keyBytes.length !== 24 && keyBytes.length !== 32) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. FF3 requires 16, 24, or 32 byte AES keys");
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      // FF3 keys the block cipher with REVB(K), SP 800-38G Algorithm 9 step 4c
      this.keyReversed = [...this._key].reverse();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Radix property setter/getter
    /**
     * @param {int32} value - Radix 2..65536
     */
    set radix(value) {
      if (value < FF3_MIN_RADIX || value > FF3_MAX_RADIX) {
        throw new Error("Invalid radix: " + value + ". Must be between " + FF3_MIN_RADIX + " and " + FF3_MAX_RADIX);
      }
      this._radix = value;
    }

    /**
     * @returns {int32} Radix (the constructor sets 10 and the setter never stores less than 2)
     */
    get radix() {
      return this._radix;
    }

    // Tweak property setter/getter
    /**
     * @param {uint8[]|null} value - 8-byte tweak (null for zeros)
     */
    set tweak(value) {
      if (value && value.length !== FF3_TWEAK_LENGTH) {
        throw new Error("FF3 tweak must be exactly " + FF3_TWEAK_LENGTH + " bytes (64 bits)");
      }
      this._tweak = value ? [...value] : zeroTweak();
    }

    /**
     * @returns {uint8[]} The tweak (the constructor and setter always store one)
     */
    get tweak() {
      return this._tweak;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");

      // For FF3, we expect string data that represents numerals
      if (typeof data === 'string') {
        for (let _i = 0; _i < data.length; _i++) {
          /** @type {uint16} */
          const code = data.charCodeAt(_i);
          this.inputBuffer.push(code);
        }
      } else {
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Decode to numerals first: a byte that is not a symbol of this radix has
      // no numeral and is rejected here rather than folded into range.
      const X = this._bytesToNumerals(this.inputBuffer);
      const n = X.length;

      // Validate input length against what this radix actually admits
      const limits = ff3LengthLimits(this._radix);
      const minLength = limits[0], maxLength = limits[1];
      if (n < minLength || n > maxLength) {
        throw new Error("Input length " + n + " is outside the " + minLength + ".." + maxLength + " "
          + "characters radix " + this._radix + " admits");
      }

      // Process the numerals with FF3
      const Y = this.isInverse ? this._decrypt(X) : this._encrypt(X);

      // Clear input buffer
      this.inputBuffer = [];

      return this._numeralsToBytes(Y);
    }

    // REV: reverse the order of the characters (numerals) of a string,
    // SP 800-38G Section 4.2.
    /**
     * @param {int32[]} numerals - Numerals
     * @returns {int32[]} Reversed copy
     */
    _rev(numerals) {
      /** @type {int32[]} */
      const out = new Array(numerals.length);
      for (let i = 0; i < numerals.length; i++) out[i] = numerals[numerals.length - 1 - i];
      return out;
    }

    // REVB: reverse the order of the bytes of a byte string,
    // SP 800-38G Section 4.2.
    /**
     * @param {uint8[]} bytes - Bytes
     * @returns {uint8[]} Reversed copy
     */
    _revb(bytes) {
      /** @type {uint8[]} */
      const out = new Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) out[i] = bytes[bytes.length - 1 - i];
      return out;
    }

    // One FF3 round: the P block of Algorithm 9 step 4b and the S block of
    // step 4c, returning y = NUM(S) as a BigInt.
    // W is the 4-byte tweak half, N is NUM_radix(REV(half)).
    /**
     * @param {uint8[]} W - 4-byte tweak half
     * @param {int32} roundIndex - Round number
     * @param {BigInt} N - NUM_radix(REV(half))
     * @returns {BigInt} y
     */
    _roundY(W, roundIndex, N) {
      /** @type {uint8[]} */
      const P = new Array(16);
      for (let j = 0; j < 4; j++) P[j] = W[j];
      P[3] = OpCodes.Xor32(P[3], roundIndex); // W XOR [i]^4

      // [NUM_radix(REV(half))]^12 - 12 bytes, big-endian
      const numBytes = bigToBytes(N, 12);
      const offset = numBytes.length - 12;
      for (let j = 0; j < 12; j++) P[4 + j] = numBytes[offset + j];

      // S = REVB(CIPH_REVB(K)(REVB(P)))
      const S = this._revb(this._aesEncrypt(this._revb(P)));
      return bigFromBytes(S);
    }

    // FF3 encryption - NIST SP 800-38G Algorithm 9
    /**
     * @param {int32[]} X - Plaintext numerals
     * @returns {int32[]} Ciphertext numerals
     */
    _encrypt(X) {
      const n = X.length;

      // Step 1/2: split into two halves (FF3 uses ceiling for the first half)
      const u = Math.ceil(n / 2);
      const v = n - u;
      let A = [...X.slice(0, u)];
      let B = [...X.slice(u)];

      // Step 3: parse tweak into TL (leftmost 32 bits) and TR (rightmost 32)
      const TL = this._tweak.slice(0, 4);
      const TR = this._tweak.slice(4, 8);

      // Step 4: 8 rounds
      for (let i = 0; i < FF3_ROUNDS; i++) {
        const even = OpCodes.And32(i, 1) === 0;
        const m = even ? u : v;
        const W = even ? TR : TL;

        const y = this._roundY(W, i, this._numeralArrayToBigInt(this._rev(B)));

        // Step 4e/4f: c = (NUM_radix(REV(A)) + y) mod radix^m, C = REV(STR(c))
        const c = this._addMod(this._numeralArrayToBigInt(this._rev(A)), y, this._pow(this._radix, m));
        const C = this._rev(this._bigIntToNumeralArray(c, m));

        A = B;
        B = C;
      }

      return [...A, ...B];
    }

    // FF3 decryption - NIST SP 800-38G Algorithm 10
    /**
     * @param {int32[]} Y - Ciphertext numerals
     * @returns {int32[]} Plaintext numerals
     */
    _decrypt(Y) {
      const n = Y.length;

      const u = Math.ceil(n / 2);
      const v = n - u;
      let A = [...Y.slice(0, u)];
      let B = [...Y.slice(u)];

      const TL = this._tweak.slice(0, 4);
      const TR = this._tweak.slice(4, 8);

      // Rounds run 7 down to 0
      for (let i = FF3_ROUNDS - 1; i >= 0; i--) {
        const even = OpCodes.And32(i, 1) === 0;
        const m = even ? u : v;
        const W = even ? TR : TL;

        const y = this._roundY(W, i, this._numeralArrayToBigInt(this._rev(A)));

        // c = (NUM_radix(REV(B)) - y) mod radix^m, C = REV(STR(c))
        const c = this._subMod(this._numeralArrayToBigInt(this._rev(B)), y, this._pow(this._radix, m));
        const C = this._rev(this._bigIntToNumeralArray(c, m));

        B = A;
        A = C;
      }

      return [...A, ...B];
    }

    // CIPH_REVB(K): AES-ECB encryption of one block under the byte-reversed
    // key, as SP 800-38G Algorithm 9 step 4c requires.
    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Encrypted block
     */
    _aesEncrypt(block) {
      if (!this._key || this._key.length === 0) {
        throw new Error("AES key not set for FF3 encryption");
      }

      if (!this.aesInstance) {
        // Prefer the directly imported module, fall back to the registry
        const RijndaelAlgorithm = findRijndael();
        if (!RijndaelAlgorithm) {
          throw new Error('FF3: Rijndael/AES algorithm not found. Ensure rijndael.js is loaded.');
        }

        /** @type {IBlockCipherInstance} */
        const aes = RijndaelAlgorithm.CreateInstance(false);
        this.aesInstance = aes;
        aes.key = this.keyReversed; // REVB(K)
      }

      this.aesInstance.Feed(block);
      /** @type {uint8[]} */
      const encrypted = this.aesInstance.Result();
      return encrypted;
    }

    // Decode input bytes to a numeral array.
    //
    // NIST SP 800-38G Section 4 requires the character-to-numeral map to be a
    // bijection onto {0..radix-1}: only then does STR^m_radix invert NUM_radix
    // and the cipher preserve its own format. The map used here previously sent
    // both 'A' and 'a' to 10 while the inverse emitted only lowercase, so for
    // any radix above 10 an upper-case message came back lower-cased -
    // "ABCDEFGHIJKLMNOP" decrypted to "abcdefghijklmnop". The 62-symbol map
    // below is injective, matching the one FF1 in this same file already uses,
    // and a byte outside it is refused rather than folded into range.
    /**
     * @param {uint8[]} bytes - Characters
     * @returns {int32[]} Numerals
     */
    _bytesToNumerals(bytes) {
      /** @type {int32[]} */
      const numerals = [];
      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        /** @type {int32} */
        let numeral = 0;

        if (byte >= 48 && byte <= 57) {
          numeral = byte - 48;        // '0'-'9' -> 0..9
        } else if (byte >= 97 && byte <= 122) {
          numeral = byte - 87;        // 'a'-'z' -> 10..35 (byte - 97 + 10)
        } else if (byte >= 65 && byte <= 90) {
          numeral = byte - 29;        // 'A'-'Z' -> 36..61 (byte - 65 + 36)
        } else {
          /** @type {string} */
          const hex = byte.toString(16);
          throw new Error("FF3: byte 0x" + hex + " is not a symbol of radix " + this._radix);
        }

        if (numeral >= this._radix) {
          throw new Error("FF3: symbol value " + numeral + " is not valid for radix " + this._radix);
        }
        numerals.push(numeral);
      }
      return numerals;
    }

    // Encode a numeral array back to bytes, inverting _bytesToNumerals exactly.
    /**
     * @param {int32[]} numerals - Numerals
     * @returns {uint8[]} Characters
     */
    _numeralsToBytes(numerals) {
      /** @type {uint8[]} */
      const bytes = new Uint8Array(numerals.length);
      for (let i = 0; i < numerals.length; i++) {
        const numeral = numerals[i];
        if (numeral >= this._radix) {
          throw new Error("FF3: numeral " + numeral + " is not valid for radix " + this._radix);
        }

        if (numeral < 10) {
          bytes[i] = numeral + 48;
        } else if (numeral < 36) {
          bytes[i] = numeral - 10 + 97;
        } else if (numeral < 62) {
          bytes[i] = numeral - 36 + 65;
        } else {
          throw new Error("FF3: radix " + this._radix + " needs more than the 62 symbols this encoding carries");
        }
      }
      return bytes;
    }

    // Convert numeral array to big integer (using string arithmetic for precision)
    /**
     * @param {int32[]} numerals - Numerals, most significant first
     * @returns {BigInt} Their value
     */
    _numeralArrayToBigInt(numerals) {
      /** @type {BigInt} */
      let result = 0n;
      const radix = BigInt(this._radix);
      for (let i = 0; i < numerals.length; i++) {
        result = result * radix + BigInt(numerals[i]);
      }
      return result;
    }

    // Convert big integer to numeral array
    /**
     * @param {BigInt} value - Value
     * @param {int32} length - Number of numerals
     * @returns {int32[]} Numerals, most significant first
     */
    _bigIntToNumeralArray(value, length) {
      /** @type {int32[]} */
      const numerals = [];
      const radix = BigInt(this._radix);
      let bigValue = BigInt(value);

      for (let i = 0; i < length; i++) {
        /** @type {int32} */
        const digit = Number(bigValue % radix);
        numerals.unshift(digit);
        bigValue = bigValue / radix;
      }
      return numerals;
    }

    // Convert big integer to byte array (little-endian)
    /**
     * @param {BigInt} value - Value
     * @param {int32} length - Number of bytes
     * @returns {uint8[]} Little-endian bytes
     */
    _bigIntToBytes(value, length) {
      /** @type {uint8[]} */
      const bytes = new Array(length);
      let bigValue = BigInt(value);

      for (let i = 0; i < length; i++) {
        /** @type {uint8} */
        const low = Number(OpCodes.AndN(bigValue, 0xFFn));
        bytes[i] = low;
        bigValue = OpCodes.ShiftRn(bigValue, 8);
      }
      return bytes;
    }

    // Big integer power function
    /**
     * @param {int32} base - Base
     * @param {int32} exponent - Exponent
     * @returns {BigInt} base ** exponent
     */
    _pow(base, exponent) {
      return BigInt(base) ** BigInt(exponent);
    }

    // Modular addition for big integers
    /**
     * @param {BigInt} a - Addend
     * @param {BigInt} b - Addend
     * @param {BigInt} mod - Modulus
     * @returns {BigInt} (a + b) mod m
     */
    _addMod(a, b, mod) {
      return (BigInt(a) + BigInt(b)) % BigInt(mod);
    }

    // Modular subtraction for big integers
    /**
     * @param {BigInt} a - Minuend
     * @param {BigInt} b - Subtrahend
     * @param {BigInt} mod - Modulus
     * @returns {BigInt} (a - b) mod m in 0..m-1
     */
    _subMod(a, b, mod) {
      const result = (BigInt(a) - BigInt(b)) % BigInt(mod);
      return result < 0n ? result + BigInt(mod) : result;
    }
  }

  // ===== REGISTRATION =====

  const ff1Instance = new FF1Algorithm();
  if (!AlgorithmFramework.Find(ff1Instance.name)) {
    RegisterAlgorithm(ff1Instance);
  }

  const ff3Instance = new FF3Algorithm();
  if (!AlgorithmFramework.Find(ff3Instance.name)) {
    RegisterAlgorithm(ff3Instance);
  }

  // ===== EXPORTS =====

  return { FF1Algorithm, FF1Instance, FF3Algorithm, FF3Instance };
});
