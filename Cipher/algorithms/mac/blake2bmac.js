/*
 * BLAKE2b-MAC - BLAKE2b in Keyed Hash Mode for Message Authentication
 * Based on BLAKE2 specification - keyed mode for MAC generation
 * (c)2025 Hawkynt
 *
 * BLAKE2 natively supports keying and can produce variable-length MAC outputs
 * Reference: https://www.blake2.net/blake2.pdf
 */

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
          MacAlgorithm, IMacInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== BLAKE2b CONSTANTS =====

  /**
   * BLAKE2b block size in bytes.
   * Each compression function processes exactly 128 bytes of input.
   * @constant {uint8}
   */
  const BLAKE2B_BLOCKBYTES = 128;

  /**
   * Maximum BLAKE2b output size in bytes.
   * BLAKE2b supports variable output from 1 to 64 bytes.
   * @constant {uint8}
   */
  const BLAKE2B_OUTBYTES = 64;

  /**
   * Maximum BLAKE2b key size in bytes.
   * For MAC mode, key can be 1 to 64 bytes.
   * @constant {uint8}
   */
  const BLAKE2B_KEYBYTES = 64;

  /**
   * BLAKE2b initialization vectors (IV).
   * Eight 64-bit constants derived from the fractional parts of the square roots
   * of the first 8 primes (2, 3, 5, 7, 11, 13, 17, 19).
   * These are the same as SHA-512 IVs.
   * @constant {ReadonlyArray<BigInt>}
   */
  const BLAKE2B_IV = Object.freeze([
    BigInt('0x6a09e667f3bcc908'), BigInt('0xbb67ae8584caa73b'),
    BigInt('0x3c6ef372fe94f82b'), BigInt('0xa54ff53a5f1d36f1'),
    BigInt('0x510e527fade682d1'), BigInt('0x9b05688c2b3e6c1f'),
    BigInt('0x1f83d9abfb41bd6b'), BigInt('0x5be0cd19137e2179')
  ]);

  /**
   * Message word permutation schedule (SIGMA).
   * 10 rounds of permutations for mixing message words in the compression function.
   * After round 9, the schedule wraps around (round 10 uses schedule 0, etc.).
   * @constant {ReadonlyArray<ReadonlyArray<uint8>>}
   */
  const SIGMA = Object.freeze([
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
    [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
    [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
    [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
    [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
    [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
    [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
    [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
    [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0]
  ]);

  /**
   * Performs 64-bit right rotation on a BigInt value.
   * Used extensively in BLAKE2b mixing function for diffusion.
   *
   * @param {BigInt} value - The 64-bit value to rotate (will be masked to 64 bits)
   * @param {uint8} positions - Number of bit positions to rotate right (0-63)
   * @returns {BigInt} The rotated 64-bit value
   *
   * @example
   * // Rotate 0x0123456789ABCDEF right by 32 bits
   * const rotated = RotR64(BigInt('0x0123456789ABCDEF'), 32);
   * // Result: 0x89ABCDEF01234567
   */
  function RotR64(value, positions) {
    const mask64 = BigInt('0xffffffffffffffff');
    value = value & mask64;
    positions = BigInt(positions) & BigInt(63);
    return ((value >> positions) | (value << (BigInt(64) - positions))) & mask64;
  }

  /**
   * BLAKE2b G mixing function.
   * Core quarter-round mixing function that operates on four words of the internal state.
   * Provides both confusion (through addition and XOR) and diffusion (through rotation).
   *
   * The G function performs four mixing steps with rotation amounts 32, 24, 16, and 63:
   * 1. v[a] = v[a] + v[b] + x; v[d] = (v[d] ^ v[a]) >>> 32
   * 2. v[c] = v[c] + v[d]; v[b] = (v[b] ^ v[c]) >>> 24
   * 3. v[a] = v[a] + v[b] + y; v[d] = (v[d] ^ v[a]) >>> 16
   * 4. v[c] = v[c] + v[d]; v[b] = (v[b] ^ v[c]) >>> 63
   *
   * @param {Array<BigInt>} v - Working vector (16 x 64-bit words), modified in place
   * @param {uint8} a - First state word index (0-15)
   * @param {uint8} b - Second state word index (0-15)
   * @param {uint8} c - Third state word index (0-15)
   * @param {uint8} d - Fourth state word index (0-15)
   * @param {BigInt} x - First message word (64-bit)
   * @param {BigInt} y - Second message word (64-bit)
   */
  function BLAKE2b_G(v, a, b, c, d, x, y) {
    v[a] = (v[a] + v[b] + x) & BigInt('0xffffffffffffffff');
    v[d] = RotR64(v[d] ^ v[a], 32);
    v[c] = (v[c] + v[d]) & BigInt('0xffffffffffffffff');
    v[b] = RotR64(v[b] ^ v[c], 24);
    v[a] = (v[a] + v[b] + y) & BigInt('0xffffffffffffffff');
    v[d] = RotR64(v[d] ^ v[a], 16);
    v[c] = (v[c] + v[d]) & BigInt('0xffffffffffffffff');
    v[b] = RotR64(v[b] ^ v[c], 63);
  }

  /**
   * BLAKE2b compression function.
   * Processes one 128-byte block of input, mixing it into the hash state.
   * Performs 12 rounds of the G mixing function using the SIGMA permutation schedule.
   *
   * The compression function:
   * 1. Initializes 16-word working vector from state and IVs
   * 2. XORs byte counter into v[12] and v[13]
   * 3. Inverts v[14] if this is the final block
   * 4. Performs 12 rounds of mixing (8 G-function calls per round)
   * 5. XORs working vector back into hash state
   *
   * @param {Array<BigInt>} h - Hash state (8 x 64-bit words), modified in place
   * @param {Array<BigInt>} m - Message block (16 x 64-bit words)
   * @param {Array<BigInt>} t - Byte counter [low64, high64]
   * @param {boolean} f - Final block flag (true for last block)
   *
   * @example
   * // Compress a message block into hash state
   * const h = [...BLAKE2B_IV];
   * const m = new Array(16).fill(BigInt(0)); // message block
   * const t = [BigInt(128), BigInt(0)]; // 128 bytes processed
   * BLAKE2b_compress(h, m, t, false); // not final block
   */
  function BLAKE2b_compress(h, m, t, f) {
    const v = new Array(16);

    // Initialize working vector
    for (let i = 0; i < 8; i++) {
      v[i] = h[i];
      v[i + 8] = BLAKE2B_IV[i];
    }

    v[12] ^= t[0];
    v[13] ^= t[1];

    if (f) {
      v[14] = ~v[14];
    }

    // 12 rounds of mixing
    for (let round = 0; round < 12; round++) {
      const s = SIGMA[round % 10];

      BLAKE2b_G(v, 0, 4,  8, 12, m[s[0]], m[s[1]]);
      BLAKE2b_G(v, 1, 5,  9, 13, m[s[2]], m[s[3]]);
      BLAKE2b_G(v, 2, 6, 10, 14, m[s[4]], m[s[5]]);
      BLAKE2b_G(v, 3, 7, 11, 15, m[s[6]], m[s[7]]);
      BLAKE2b_G(v, 0, 5, 10, 15, m[s[8]], m[s[9]]);
      BLAKE2b_G(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
      BLAKE2b_G(v, 2, 7,  8, 13, m[s[12]], m[s[13]]);
      BLAKE2b_G(v, 3, 4,  9, 14, m[s[14]], m[s[15]]);
    }

    // XOR state with working vector
    for (let i = 0; i < 8; i++) {
      h[i] ^= v[i] ^ v[i + 8];
    }
  }

  /**
   * BLAKE2b-MAC algorithm class.
   * BLAKE2b used in keyed hash mode for message authentication codes.
   *
   * Unlike HMAC which wraps a hash function, BLAKE2b has native keying support
   * built into its design, making it more efficient. The key is mixed into the
   * first compression function call via parameter block initialization.
   *
   * Features:
   * - Variable key size: 1-64 bytes
   * - Variable output size: 1-64 bytes
   * - Faster than HMAC-SHA2 or HMAC-SHA3
   * - Direct keying (no double-hashing like HMAC)
   * - Secure for MAC generation with 256-bit security level
   *
   * @class
   * @extends MacAlgorithm
   *
   * @example
   * // Create BLAKE2b-MAC instance
   * const algo = new BLAKE2BMACAlgorithm();
   * const mac = algo.CreateInstance();
   *
   * // Set 32-byte key and generate 32-byte MAC
   * mac.key = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
   * mac.outputSize = 32;
   * mac.Feed(OpCodes.AnsiToBytes("message to authenticate"));
   * const tag = mac.Result();
   */
  class BLAKE2BMACAlgorithm extends MacAlgorithm {
    /**
     * Constructs a new BLAKE2b-MAC algorithm instance.
     * Initializes metadata, capabilities, documentation, and test vectors.
     */
    constructor() {
      super();

      // Required metadata
      this.name = "BLAKE2b-MAC";
      this.description = "BLAKE2b in keyed hash mode for message authentication. Natively supports keying with variable-length MAC output (1-64 bytes). Faster than HMAC-SHA while providing strong authentication.";
      this.inventor = "Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Christian Winnerlein";
      this.year = 2012;
      this.category = CategoryType.MAC;
      this.subCategory = "Keyed Hash MAC";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INT;

      // MAC-specific metadata
      this.SupportedKeySizes = [new KeySize(1, 64, 1)]; // 1-64 bytes
      this.SupportedOutputSizes = [new KeySize(1, 64, 1)]; // 1-64 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("BLAKE2 Specification", "https://www.blake2.net/blake2.pdf"),
        new LinkItem("RFC 7693 - The BLAKE2 Cryptographic Hash and MAC", "https://tools.ietf.org/rfc/rfc7693.txt"),
        new LinkItem("BLAKE2 Official Website", "https://www.blake2.net/")
      ];

      this.references = [
        new LinkItem("BLAKE2 Reference Implementation", "https://github.com/BLAKE2/BLAKE2"),
        new LinkItem("Botan BLAKE2b Test Vectors", "https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec")
      ];

      // Test vectors from Botan (OpenSSL and Linux kernel)
      this.tests = [
        {
          text: "BLAKE2b-MAC Test Vector - 8-bit output (1 byte)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec",
          input: OpCodes.Hex8ToBytes("53616D706C6520696E70757420666F72206F75746C656E3C6469676573745F6C656E677468"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          outputSize: 1,
          expected: OpCodes.Hex8ToBytes("2a")
        },
        {
          text: "BLAKE2b-MAC Test Vector - 224-bit output (28 bytes), empty input",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec",
          input: [],
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          outputSize: 28,
          expected: OpCodes.Hex8ToBytes("A43D14369294A04B9CD6C6D358C8E663654C4B246C47CFE6373F7788")
        },
        {
          text: "BLAKE2b-MAC Test Vector - 256-bit output (32 bytes), empty input",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec",
          input: [],
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("2FA9FBD9BE36437DE204E139E97D402BCE68C828F43391608C891B5FAED8A98A")
        },
        {
          text: "BLAKE2b-MAC Test Vector - 256-bit output, 1-byte input",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec",
          input: OpCodes.Hex8ToBytes("00"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("34758B647135628297FB09C7930CD04E9528E5669112F5B1318493E14DE77E55")
        },
        {
          text: "BLAKE2b-MAC Test Vector - 256-bit output, single-byte key",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          key: OpCodes.Hex8ToBytes("42"),
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("2E84DBA25F0EE9527950699FF1FDFC9D8983A9B6A4D5FAB5BE351A178A2C7F7D")
        }
      ];
    }

    /**
     * Creates a new instance of the BLAKE2b-MAC algorithm.
     *
     * @param {boolean} [isInverse=false] - Ignored for MAC algorithms (no inverse operation)
     * @returns {BLAKE2BMACInstance} New algorithm instance for MAC generation
     *
     * @example
     * const algo = new BLAKE2BMACAlgorithm();
     * const instance = algo.CreateInstance();
     */
    CreateInstance(isInverse = false) {
      return new BLAKE2BMACInstance(this, isInverse);
    }
  }

  /**
   * BLAKE2b-MAC instance for generating message authentication codes.
   * Implements the Feed/Result pattern for incremental MAC computation.
   *
   * The instance maintains state across Feed() calls and generates the final
   * MAC tag when Result() is called. After Result(), the instance is reset
   * and ready for a new MAC operation with the same key.
   *
   * @class
   * @extends IMacInstance
   *
   * @example
   * // Generate MAC for a message
   * const instance = new BLAKE2BMACInstance(algorithm);
   * instance.key = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
   * instance.outputSize = 32;
   * instance.Feed(OpCodes.AnsiToBytes("Hello, "));
   * instance.Feed(OpCodes.AnsiToBytes("World!"));
   * const mac = instance.Result(); // 32-byte MAC
   *
   * @example
   * // Variable-length MAC with short key
   * const instance = new BLAKE2BMACInstance(algorithm);
   * instance.key = OpCodes.Hex8ToBytes("42"); // 1-byte key
   * instance.outputSize = 16; // 128-bit MAC
   * instance.Feed(OpCodes.AnsiToBytes("data"));
   * const mac = instance.Result();
   */
  class BLAKE2BMACInstance extends IMacInstance {
    /**
     * Constructs a new BLAKE2b-MAC instance.
     *
     * @param {BLAKE2BMACAlgorithm} algorithm - Parent algorithm object
     * @param {boolean} [isInverse=false] - Ignored for MAC algorithms
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /**
       * @type {boolean}
       * @private
       */
      this.isInverse = isInverse;

      /**
       * Secret key for MAC generation (1-64 bytes).
       * @type {Array<uint8>|null}
       * @private
       */
      this._key = null;

      /**
       * Desired MAC output size in bytes (1-64).
       * @type {uint8}
       * @private
       */
      this._outputSize = 32; // Default 32 bytes (256 bits)

      /**
       * Accumulated input data buffer.
       * @type {Array<uint8>}
       * @private
       */
      this.inputBuffer = [];
    }

    /**
     * Sets the secret key for MAC generation.
     * The key is mixed into the first block via parameter block initialization.
     *
     * @param {Array<uint8>} keyBytes - Key material (1-64 bytes)
     * @throws {Error} If key is not a byte array
     * @throws {Error} If key size is outside valid range (1-64 bytes)
     *
     * @example
     * instance.key = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f");
     */
    set key(keyBytes) {
      if (!keyBytes || !Array.isArray(keyBytes)) {
        throw new Error("Key must be a byte array");
      }
      if (keyBytes.length < 1 || keyBytes.length > BLAKE2B_KEYBYTES) {
        throw new Error(`Key size must be between 1 and ${BLAKE2B_KEYBYTES} bytes`);
      }
      this._key = [...keyBytes];
    }

    /**
     * Gets a copy of the current key.
     *
     * @returns {Array<uint8>|null} Copy of key bytes, or null if not set
     */
    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * Sets the desired MAC output size.
     * BLAKE2b supports variable-length output from 1 to 64 bytes.
     *
     * @param {uint8} bytes - Output size in bytes (1-64)
     * @throws {Error} If output size is not an integer or outside valid range
     *
     * @example
     * instance.outputSize = 32; // 256-bit MAC
     * instance.outputSize = 16; // 128-bit MAC
     */
    set outputSize(bytes) {
      if (!Number.isInteger(bytes) || bytes < 1 || bytes > BLAKE2B_OUTBYTES) {
        throw new Error(`Output size must be between 1 and ${BLAKE2B_OUTBYTES} bytes`);
      }
      this._outputSize = bytes;
    }

    /**
     * Gets the current output size setting.
     *
     * @returns {uint8} Output size in bytes (1-64)
     */
    get outputSize() {
      return this._outputSize;
    }

    /**
     * Feeds input data to the MAC computation.
     * Data is accumulated in an internal buffer until Result() is called.
     * Multiple Feed() calls can be made to process data incrementally.
     *
     * @param {Array<uint8>|Uint8Array} data - Input bytes to authenticate
     * @throws {Error} If key has not been set before feeding data
     *
     * @example
     * // Feed data incrementally
     * instance.Feed(OpCodes.AnsiToBytes("Part 1 "));
     * instance.Feed(OpCodes.AnsiToBytes("Part 2"));
     * const mac = instance.Result();
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    /**
     * Computes and returns the final MAC tag.
     * After calling Result(), the instance is reset and ready for a new MAC computation.
     * The same key and output size settings are preserved for the next operation.
     *
     * The computation follows the BLAKE2b specification:
     * 1. Initialize hash state from IVs
     * 2. XOR parameter block (key length, output size) into h[0]
     * 3. Process key as first block (padded to 128 bytes)
     * 4. Process message data in 128-byte blocks
     * 5. Process final block with finalization flag
     * 6. Extract first outputSize bytes as MAC tag
     *
     * @returns {Array<uint8>} MAC tag of configured output size
     * @throws {Error} If key has not been set
     *
     * @example
     * // Generate 32-byte MAC
     * instance.key = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
     * instance.outputSize = 32;
     * instance.Feed(OpCodes.AnsiToBytes("message"));
     * const mac = instance.Result(); // 32-byte MAC tag
     *
     * @example
     * // Empty message MAC (keyed hash of empty string)
     * instance.key = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f");
     * instance.outputSize = 16;
     * const mac = instance.Result(); // MAC of empty message
     */
    Result() {
      if (!this._key) throw new Error("Key not set");

      // Initialize hash state
      const h = new Array(8);
      for (let i = 0; i < 8; i++) {
        h[i] = BLAKE2B_IV[i];
      }

      // Parameter block: h[0] ^= 0x01010000 ^ (keylen << 8) ^ outlen
      h[0] ^= BigInt(0x01010000) ^ (BigInt(this._key.length) << BigInt(8)) ^ BigInt(this._outputSize);

      // Process key block if key is provided
      const buffer = new Uint8Array(BLAKE2B_BLOCKBYTES);
      let bufferLen = 0;
      let totalLen = BigInt(0);

      if (this._key && this._key.length > 0) {
        // Copy key into first block
        for (let i = 0; i < this._key.length; i++) {
          buffer[i] = this._key[i];
        }
        bufferLen = BLAKE2B_BLOCKBYTES; // Key block is always full
      }

      // Process input data
      const input = this.inputBuffer;
      let offset = 0;

      while (offset < input.length) {
        const bytesToCopy = Math.min(BLAKE2B_BLOCKBYTES - bufferLen, input.length - offset);

        for (let i = 0; i < bytesToCopy; i++) {
          buffer[bufferLen + i] = input[offset + i];
        }

        bufferLen += bytesToCopy;
        offset += bytesToCopy;

        if (bufferLen === BLAKE2B_BLOCKBYTES) {
          totalLen += BigInt(BLAKE2B_BLOCKBYTES);

          // Convert buffer to message block (16 x 64-bit words)
          const m = new Array(16);
          for (let i = 0; i < 16; i++) {
            const idx = i * 8;
            m[i] = BigInt(buffer[idx]) |
                   (BigInt(buffer[idx + 1]) << BigInt(8)) |
                   (BigInt(buffer[idx + 2]) << BigInt(16)) |
                   (BigInt(buffer[idx + 3]) << BigInt(24)) |
                   (BigInt(buffer[idx + 4]) << BigInt(32)) |
                   (BigInt(buffer[idx + 5]) << BigInt(40)) |
                   (BigInt(buffer[idx + 6]) << BigInt(48)) |
                   (BigInt(buffer[idx + 7]) << BigInt(56));
          }

          BLAKE2b_compress(h, m, [totalLen, BigInt(0)], false);
          bufferLen = 0;
        }
      }

      // Final block
      totalLen += BigInt(bufferLen);

      // Pad remaining buffer with zeros
      for (let i = bufferLen; i < BLAKE2B_BLOCKBYTES; i++) {
        buffer[i] = 0;
      }

      // Convert buffer to message block
      const m = new Array(16);
      for (let i = 0; i < 16; i++) {
        const idx = i * 8;
        m[i] = BigInt(buffer[idx]) |
               (BigInt(buffer[idx + 1]) << BigInt(8)) |
               (BigInt(buffer[idx + 2]) << BigInt(16)) |
               (BigInt(buffer[idx + 3]) << BigInt(24)) |
               (BigInt(buffer[idx + 4]) << BigInt(32)) |
               (BigInt(buffer[idx + 5]) << BigInt(40)) |
               (BigInt(buffer[idx + 6]) << BigInt(48)) |
               (BigInt(buffer[idx + 7]) << BigInt(56));
      }

      BLAKE2b_compress(h, m, [totalLen, BigInt(0)], true);

      // Extract output bytes
      const output = [];
      for (let i = 0; i < this._outputSize; i++) {
        const wordIndex = Math.floor(i / 8);
        const byteIndex = i % 8;
        output.push(Number((h[wordIndex] >> BigInt(byteIndex * 8)) & BigInt(0xFF)));
      }

      this.inputBuffer = []; // Clear for next operation
      return output;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new BLAKE2BMACAlgorithm());

  return {
    BLAKE2BMACAlgorithm,
    BLAKE2BMACInstance
  };
}));
