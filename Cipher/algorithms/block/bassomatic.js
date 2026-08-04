/*
 * BassOmatic Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * BassOmatic Algorithm by Phil Zimmermann (1988-1991)
 * Used in PGP 1.0 before being replaced by IDEA after cryptanalysis
 * Block size: 256 bytes (2048 bits), Key size: Variable (up to 255 bytes,
 * counting a leading control byte)
 *
 * Named after the famous SNL "Bass-O-Matic" blender skit by Dan Aykroyd
 *
 * CRITICAL SECURITY NOTE: This cipher was cryptographically broken by Eli Biham
 * in 1991. Most notably, the last bit of each byte was not properly encrypted.
 * This implementation is for HISTORICAL and EDUCATIONAL purposes ONLY.
 *
 * Algorithm Structure (ported directly from the original PGP 1.0 reference
 * source, basslib.c/lfsr.c, released 25 Jun 1989, last revised 22 May 1991):
 * - The first key byte is a control byte:
 *     bits 0-2: number of rounds minus one (1-8 rounds)
 *     bit 3:    1 = slow "8-way" bit shredding, 0 = fast 50%-bitmask shredding
 *     bit 4:    1 = rebuild tables a second time using the BassOmatic itself
 *               as its own pseudo-random generator ("hardrand")
 *     bit 5:    1 = rebuild all tables before every block ("rerand"),
 *               implicitly disabling bit 4
 * - The remaining key bytes seed a 256-byte Linear Feedback Shift Register
 *   (LFSR, primitive polynomial X^255 + X^82 + X^0) that supplies random
 *   bytes used to build 8 permutation tables of 256 entries each (a
 *   "mixer" table is used to further shuffle each freshly built table).
 * - Each round consists of 4 operations, in this order for encryption:
 *     1. XOR the block with one permutation table (xortable)
 *     2. bit-shred the block, scattering bits through two more tables
 *        (or, in 8-way mode, through all 8 tables one bit-plane at a time)
 *     3. rake the block: an unkeyed forward XOR diffusion followed by a
 *        backward addition-mod-256 diffusion
 *     4. substitute 32-byte groups of the block through a rotating
 *        selection of the 8 tables (multilookup)
 *   Decryption runs the rounds in reverse order using tables that were
 *   inverted at key-setup time and the literal inverse of each primitive
 *   (ixortable, unrake).
 *
 * References:
 * - Original PGP 1.0 Unix source code, basslib.c and lfsr.c
 *   (archived at https://archive.org/details/pgp_sourcecode,
 *   file unix_pgp10.tar.gz)
 * - Eli Biham's cryptanalysis at CRYPTO 1991
 * - Phil Zimmermann's PGP documentation
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

  // ===== ALGORITHM CONSTANTS =====

  const NTABLES = 8;           // number of permutation tables (key schedule)
  const BLOCK_SIZE = 256;      // BassOmatic block size in bytes
  const MAXTICS = 16383;       // give up on a stuck LFSR after this many tics
  const BIT_MASKS = [0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01];

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * BassOMaticAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class BassOMaticAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BassOMatic";
      this.description = "Phil Zimmermann's original cipher from PGP 1.0 with 256-byte blocks and variable key sizes. Cryptographically broken by Eli Biham in 1991 due to differential cryptanalysis vulnerabilities and improper encryption of the last bit of each byte.";
      this.inventor = "Philip Zimmermann";
      this.year = 1991;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN; // Broken by Eli Biham at CRYPTO 1991
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      // A key needs a control byte plus at least one seed byte (basslib.c
      // initkey() rejects keylen<2), and the original source clamps the
      // total key length (control byte included) to 255 bytes.
      this.SupportedKeySizes = [
        new KeySize(2, 255, 1)
      ];
      this.SupportedBlockSizes = [
        new KeySize(256, 256, 0) // Fixed 256-byte (2048-bit) blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("BassOMatic Cipher - Crypto Wiki", "https://cryptography.fandom.com/wiki/BassOmatic"),
        new LinkItem("BassOMatic - Wikipedia", "https://en.wikipedia.org/wiki/BassOmatic"),
        new LinkItem("PGP History and Development", "https://philzimmermann.com/EN/background/index.html")
      ];

      this.references = [
        new LinkItem("Cryptanalysis Discussion", "https://crypto.stackexchange.com/questions/61948/what-was-the-bassomatic-cipher-and-what-made-it-so-weak"),
        new LinkItem("Algorithm Hall of Fame - BassOmatic", "https://www.algorithmhalloffame.org/algorithms/block-ciphers/bassomatic/"),
        new LinkItem("PGP 1.0 Source Archive (unix_pgp10.tar.gz, basslib.c/lfsr.c)", "https://archive.org/details/pgp_sourcecode")
      ];

      // Known vulnerabilities - BassOmatic is completely broken
      this.knownVulnerabilities = [
        new Vulnerability("Differential Cryptanalysis",
          "Eli Biham demonstrated vulnerability to differential cryptanalysis at CRYPTO 1991",
          '',
          "https://en.wikipedia.org/wiki/Differential_cryptanalysis"),
        new Vulnerability("Last Bit Encryption Flaw",
          "Conceptual error prevented the last bit of each byte from being properly encrypted",
          '',
          "https://crypto.stackexchange.com/questions/61948/"),
        new Vulnerability("Non-uniform Key Space",
          "Control bits create non-uniform key space with key-dependent algorithm variations",
          '',
          "https://www.algorithmhalloffame.org/algorithms/block-ciphers/bassomatic/")
      ];

      // Test vectors - CRITICAL NOTE: no official/authentic BassOmatic KAT
      // vectors are publicly documented anywhere (there was never a formal
      // publication of test vectors for this 1991 hobbyist-era algorithm,
      // and it was abandoned within months of release once Eli Biham broke
      // it at CRYPTO 1991). The vector below was NOT taken from an official
      // source; it was computed by porting the actual key-schedule and round
      // functions from the original PGP 1.0 reference source (basslib.c and
      // lfsr.c, see the "PGP 1.0 Source Archive" reference above) to a
      // throwaway cross-check implementation, then confirming this
      // JavaScript implementation reproduces the same ciphertext and that
      // encryption/decryption round-trip correctly. Round-trip correctness
      // was additionally verified across all 64 control-byte combinations
      // (every rounds/shred-mode/hardrand/rerand setting).
      this.tests = [
        {
          text: "DarkCrypt Bassomatic'89-2040 vector 1/zero",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("26948fd2c38e8467c2d2d6fdb5e86b1ca4b0a5c7b2c47e226ef8040a3a31a856815f7b13930b5607f4e39bc071594f57ed4945712fe2e74d50ef491216ee6db231a28a5205f5f0557dc96fd1c080be1ae401b8aaf6810c580fa28d2353a9f86f4e03251a480294a5029d7c37df69c3e9128cf494180996c554f3b818913e824512bfb1c7c8e8856c6c6c9ecc63285df3c6fa359808a69d2ceb48cd9388911a289e859b8530f3370245a41dccb4dd77649da74413653ea5ebd397678c572d7b1d9bd02810b0bd435028ce49cd07b086f6b6c63c2a63a38cbf436b366023cdcba4124a0e2540700fac0413ba3928552790f2338a9876170c3f0edc3b723cb4ae6d")
        },
        {
          text: "DarkCrypt Bassomatic'89-2040 vector 2/incr",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfe"),
          expected: OpCodes.Hex8ToBytes("87af3c69de4d0a90303c8b47c9fb5a9015fa98f91d3adb83072bc2ffb96eb18c96cdbfddbb973232036fa963bcc6f5f7de1bfac60077b5cb886c5f74eaf586ad3f3f1278e9cedd1d8f91440a5e0f3070a8ad804e5ffef4c661feb6f14bea0bdde107ba0858cf7d487bbb910d0e67701b21e69d7493b829d82174e6023eca3f9420765c564ee6c706b8e4bf10b17de9dc00520ab97b1a954c476d15c13d404103ffb52d11e19c5f2149b742bc07e1d224316844c93c591cb56210d28fe3478ef928d70dee06c0dbfa9fc2e2f41ad01a61de036e71ff9227d8671415b8a1fb0a813978d70736b8252338b27ffbf30f9954feb668dc47fba61e7df71c6e5209835b")
        },
        {
          text: "DarkCrypt Bassomatic'89-2040 vector 3/incr2",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff"),
          expected: OpCodes.Hex8ToBytes("5fd6a7d9a7638f9cd30a522a1b62fca7752240fcb0d3947bcf9dc7c429650faa3e95715e11bf08d1fcfbbdc6cea78d4d0528304a9184716478d277cc15919b5149f6809436d3d9988af98d1fc18a293af845b4a38d2bd129b1d83324e7340d39ab826c7aa956a91268dfdb64e7f532bad86bac581773c961681a19458935d58bd3aa43a5b51e4f8aaf84abe04801e0b3457bc3f37fff573730242e83a20d9e48b6e60342c8f912e0b6414af78b0116adc29de649ecee448b51d8daaf6b00290872459107ddb038951454d12e293194b7b59424a1a26babfd3705d218711d2c620a05e0b0a138881e2318910c41696edd46d44b24e0f2ec02d9c68a84054726c8")
        },

        {
          text: "Self-consistency vector cross-checked against a direct port of the original basslib.c/lfsr.c (PGP 1.0, 1991) key schedule and round function - no official BassOmatic test vectors are publicly available",
          uri: "https://archive.org/details/pgp_sourcecode",
          key: OpCodes.Hex8ToBytes("03426173734f6d61746963546573744b657931393931504750"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff"),
          expected: OpCodes.Hex8ToBytes("d36f501b78fb5b17cbcbc8420417e0cc3fded4fbd271b251970964a7a0eb43ab032bf8cc1badc12421736981192683142d78e0900fc30546db62e847014e87bd451a66f371c93c32a8e136100b467a713e1bd366193d9eb04c77343bbf4abebe83d10b08cbc67c6ca2dfd30a4390fe600672f13cc846bb77c7f20f147fe1ff0de65041c8b6771451841aa5a4c77bad7b45b2d7ce1ba2c8d413ac8a7a6099a66e384d3d4f6ec8ca07a5887eaa5e75bd9807df39c2352dd47523385f42d58670d263416f58452d2773b6ed59b7e6bab7f27d7dd1537456b82a33cc946ac83b7c8c2f454f409ee2387fd8e87e443c7960792597e265d3e90cbbe2acf084327d63a1")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new BassOMaticInstance(this, isInverse);
    }
  }

  /**
 * BassOMatic cipher instance implementing Feed/Result pattern
 *
 * This is a direct port of the original PGP 1.0 basslib.c/lfsr.c key
 * schedule and round function.  Every helper method below corresponds to
 * one function of the same (or clearly related) name in that source.
 * @class
 * @extends {IBlockCipherInstance}
 */

  class BassOMaticInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this.BlockSize = BLOCK_SIZE;
      this.KeySize = 0;

      // Key-schedule ("key context") state, mirrors basslib.c static state
      this.tlist = null;         // 8 permutation tables of 256 bytes each
      this.bitmasks = null;      // per-table 50%-set bitshredder masks
      this.nrounds = 0;          // 1-8 rounds
      this.shred8ways = false;   // slow 8-way vs fast 50%-mask bit shredding
      this.hardrand = false;     // rebuild tables once more via BassOmatic itself
      this.rerand = false;       // rebuild tables before every block
      this.uncryp = false;       // true while this context decrypts

      this.lfsr = null;          // 256-byte LFSR buffer
      this.rtail = 0;            // index into lfsr buffer

      this.randbuf = null;       // scratch buffer used only while hardrand is set up
      this.randbufCounter = 0;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.KeySize = 0;
        this.tlist = null;
        this.bitmasks = null;
        this.nrounds = 0;
        this.shred8ways = false;
        this.hardrand = false;
        this.rerand = false;
        this.uncryp = false;
        this.lfsr = null;
        this.rtail = 0;
        this.randbuf = null;
        this.randbufCounter = 0;
        return;
      }

      // initkey() rejects a key shorter than 2 bytes (control byte + body)
      if (keyBytes.length < 2) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. BassOmatic requires at least 2 bytes (1 control byte + 1 key byte)`);
      }

      // The original source silently clamps the key to 255 bytes
      let effectiveKey = keyBytes;
      if (effectiveKey.length > 255)
        effectiveKey = effectiveKey.slice(0, 255);

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      this._initKey(effectiveKey, this.isInverse);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // ===== LFSR primitives (ported from lfsr.c) =====

    /**
     * steplfsr256 - advance the 256-byte LFSR by 256 steps (one full cycle).
     * Primitive polynomial: X^255 + X^82 + X^0. Runs 8 bit-parallel LFSRs,
     * producing one whole byte of new state per step.
     */
    _steplfsr256() {
      const lfsr = this.lfsr;
      let ltail = 0, ltap0 = 0, ltap82 = 82, ltap255 = 255;
      let count = BLOCK_SIZE;
      while (count--) {
        ltail = (ltail + 255) % BLOCK_SIZE;
        const value = OpCodes.XorN(OpCodes.XorN(lfsr[ltap0], lfsr[ltap82]), lfsr[ltap255]);
        lfsr[ltail] = OpCodes.AndN(value, 0xFF);
        ltap0 = (ltap0 + 255) % BLOCK_SIZE;
        ltap82 = (ltap82 + 255) % BLOCK_SIZE;
        ltap255 = (ltap255 + 255) % BLOCK_SIZE;
      }
    }

    /**
     * getlfsr - fetch one pseudo-random byte from the LFSR, stepping it
     * whenever the tail wraps around.
     */
    _getlfsr() {
      if (this.rtail === 0)
        this._steplfsr256();
      this.rtail = (this.rtail + 255) % BLOCK_SIZE;
      return this.lfsr[this.rtail];
    }

    /**
     * initlfsr - seed the LFSR buffer from key material. Cumulatively adds
     * the (repeating) seed bytes with carry wraparound so every one of the
     * 8 bit-parallel LFSRs receives a mix of 1s and 0s.
     */
    _initlfsr(seed) {
      const size = seed.length;
      this.lfsr = new Array(BLOCK_SIZE).fill(0);
      this.rtail = 0;
      let c = OpCodes.AndN(size, 0xFFFF);
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        c = OpCodes.AndN(c + seed[i % size], 0xFFFF);
        this.lfsr[i] = OpCodes.AndN(c + Math.floor(c / 256), 0xFF);
      }
    }

    /**
     * stomplfsr - invert about half the bits of the LFSR to break up any
     * "rail" of stuck 0s or 1s that would make it a poor random source.
     */
    _stomplfsr() {
      let i = 255, idx = 0;
      while (i) {
        this.lfsr[idx] = OpCodes.XorN(this.lfsr[idx], i);
        ++idx;
        --i;
      }
    }

    // ===== Key-schedule table construction (ported from basslib.c) =====

    /**
     * buildtbl - build a random byte permutation vector: repeatedly draw
     * random bytes (from the LFSR, or from the BassOmatic itself when
     * useHardRand is set) and append them to the table only the first time
     * each value is seen, until all 256 values are placed.
     */
    _buildtbl(table, useHardRand) {
      const notdup = new Array(BLOCK_SIZE).fill(true);
      let tlen = 0;
      let randtics = MAXTICS;
      do {
        const c = useHardRand ? this._bassrand() : this._getlfsr();
        if (notdup[c]) {
          table[tlen++] = c;
          notdup[c] = false;
        }
        if (--randtics === 0) {
          this._stomplfsr();
          randtics = MAXTICS;
        }
      } while (tlen < BLOCK_SIZE);
      if (!useHardRand)
        this.rtail = 0;
    }

    /** invert - build the inverse of a permutation table. */
    _invertTable(intable) {
      const outtable = new Array(BLOCK_SIZE);
      for (let i = 0; i < BLOCK_SIZE; ++i)
        outtable[intable[i]] = i;
      return outtable;
    }

    /** transpose - out[i] = in[table[i]] for every index. */
    _transpose(inArr, table) {
      const out = new Array(BLOCK_SIZE);
      for (let i = 0; i < BLOCK_SIZE; ++i)
        out[i] = inArr[table[i]];
      return out;
    }

    /** halfmask - true iff exactly half (4) of the 8 bits of c are set. */
    _halfmask(c) {
      return OpCodes.PopCount(c) === 4;
    }

    /**
     * getmask - scan a table (in the order 0,255,254,...,1, matching the
     * byte-wraparound loop of the original C code) for the first entry
     * with exactly 4 bits set, for use as a 50%-bitmask.
     */
    _getmask(table) {
      if (this._halfmask(table[0]))
        return table[0];
      for (let i = 255; i >= 1; --i) {
        if (this._halfmask(table[i]))
          return table[i];
      }
      return 0x0F;
    }

    /**
     * bldtbls - build all 8 permutation tables (and, unless 8-way
     * shredding is selected, their 50%-bitmasks), each mixed through a
     * freshly built transposer table, then invert them all if this
     * context is set up for decryption.
     */
    _bldtbls(useHardRand, invertForDecrypt) {
      const mixer = new Array(BLOCK_SIZE).fill(0);
      this._buildtbl(mixer, useHardRand);

      const tmp = new Array(BLOCK_SIZE).fill(0);
      for (let i = 0; i < NTABLES; ++i) {
        this._buildtbl(tmp, useHardRand);
        if (!this.shred8ways)
          this.bitmasks[i] = this._getmask(tmp);
        this.tlist[i] = this._transpose(tmp, mixer);
      }

      if (invertForDecrypt) {
        for (let i = 0; i < NTABLES; ++i)
          this.tlist[i] = this._invertTable(this.tlist[i]);
      }
    }

    /**
     * initbrand - prime the randbuf scratch buffer used by bassrand():
     * key material first, padded out to 256 bytes with fresh LFSR output.
     */
    _initbrand(seed) {
      this.randbuf = new Array(BLOCK_SIZE).fill(0);
      const seedlen = Math.min(seed.length, BLOCK_SIZE);
      let i = 0;
      for (; i < seedlen; ++i)
        this.randbuf[i] = seed[i];
      for (; i < BLOCK_SIZE; ++i)
        this.randbuf[i] = this._getlfsr();
      this.randbufCounter = 0;
    }

    /**
     * bassrand - BassOmatic's own pseudo-random generator: once randbuf is
     * exhausted, re-encrypt it (using the currently-defined tables, always
     * in the encryption direction) to produce a fresh 256-byte pool.
     */
    _bassrand() {
      if (this.randbufCounter === 0)
        this.randbuf = this._bassomaticCore(this.randbuf, false);
      this.randbufCounter = (this.randbufCounter + 255) % BLOCK_SIZE;
      return this.randbuf[this.randbufCounter];
    }

    // ===== Round primitives (ported from basslib.c) =====

    /** shred1bit - 8-way random bit shred: scatter each bit-plane through its own table. */
    _shred1bit(inArr, outArr) {
      for (let i = 0; i < BLOCK_SIZE; ++i)
        outArr[i] = 0;
      for (let bitIndex = 0; bitIndex < 8; ++bitIndex) {
        const bitmask = BIT_MASKS[bitIndex];
        const table = this.tlist[bitIndex];
        for (let i = 0; i < BLOCK_SIZE; ++i)
          outArr[table[i]] = OpCodes.OrN(outArr[table[i]], OpCodes.AndN(inArr[i], bitmask));
      }
    }

    /** shred4bit - 2-way random bit shred: split each byte in half via bitmask, scatter each half through its own table. */
    _shred4bit(inArr, outArr, t1, t2, bitmask) {
      for (let i = 0; i < BLOCK_SIZE; ++i)
        outArr[t1[i]] = OpCodes.AndN(inArr[i], bitmask);
      const invMask = OpCodes.AndN(OpCodes.Not32(bitmask), 0xFF);
      for (let i = 0; i < BLOCK_SIZE; ++i)
        outArr[t2[i]] = OpCodes.OrN(outArr[t2[i]], OpCodes.AndN(inArr[i], invMask));
    }

    /** multilookup - substitute 32-byte groups through a rotating selection of the 8 tables. */
    _multilookup(inArr, outArr, tiStart) {
      let ti = OpCodes.AndN(tiStart, 0xFF);
      for (let group = 0; group < NTABLES; ++group) {
        const table = this.tlist[OpCodes.AndN(ti, 7)];
        ti = OpCodes.AndN(ti + 1, 0xFF);
        const base = group * 32;
        for (let pos = 0; pos < 32; ++pos)
          outArr[base + pos] = table[inArr[base + pos]];
      }
    }

    /** xortable - XOR the block with a permutation table (its own inverse when the table is unchanged). */
    _xortable(block, table) {
      for (let i = 0; i < BLOCK_SIZE; ++i)
        block[i] = OpCodes.XorN(block[i], table[i]);
    }

    /** ixortable - inverse of xortable when table has already been inverted. */
    _ixortable(block, table) {
      for (let i = 0; i < BLOCK_SIZE; ++i)
        block[table[i]] = OpCodes.XorN(block[table[i]], i);
    }

    /** rake - unkeyed diffusion: cumulative forward XOR, then cumulative backward addition mod 256. */
    _rake(block) {
      for (let i = 1; i < BLOCK_SIZE; ++i)
        block[i] = OpCodes.XorN(block[i], block[i - 1]);
      for (let i = BLOCK_SIZE - 2; i >= 0; --i)
        block[i] = OpCodes.AddMod(block[i], block[i + 1], 256);
    }

    /** unrake - inverse of rake: cumulative forward subtraction mod 256, then cumulative backward XOR. */
    _unrake(block) {
      for (let i = 0; i < BLOCK_SIZE - 1; ++i)
        block[i] = OpCodes.SubMod(block[i], block[i + 1], 256);
      for (let i = BLOCK_SIZE - 1; i >= 1; --i)
        block[i] = OpCodes.XorN(block[i], block[i - 1]);
    }

    /** f(i,j) - circular addressing mod 8 into tlist, as used throughout bassomatic(). */
    _f(i, j) {
      return OpCodes.AndN(i + j, 7);
    }

    /** tl(i,j) - convenience accessor for tlist[f(i,j)]. */
    _tl(i, j) {
      return this.tlist[this._f(i, j)];
    }

    /**
     * bassomatic - encipher (or decipher) exactly one 256-byte block,
     * running this.nrounds rounds forward for encryption or backward for
     * decryption. Rebuilds all tables first if rerand is set.
     */
    _bassomaticCore(inBlock, applyRerand) {
      if (applyRerand === undefined)
        applyRerand = true;
      if (applyRerand && this.rerand)
        this._bldtbls(false, this.uncryp);

      let out = inBlock.slice();
      let tmp = new Array(BLOCK_SIZE).fill(0);

      if (this.uncryp) {
        for (let i = this.nrounds - 1; i >= 0; --i) {
          this._multilookup(out, tmp, this._f(i, 2));
          this._unrake(tmp);
          if (this.shred8ways)
            this._shred1bit(tmp, out);
          else
            this._shred4bit(tmp, out, this._tl(i, 1), this._tl(i, 5), this.bitmasks[this._f(i, 3)]);
          this._ixortable(out, this._tl(i, 0));
        }
      } else {
        for (let i = 0; i < this.nrounds; ++i) {
          this._xortable(out, this._tl(i, 0));
          if (this.shred8ways)
            this._shred1bit(out, tmp);
          else
            this._shred4bit(out, tmp, this._tl(i, 1), this._tl(i, 5), this.bitmasks[this._f(i, 3)]);
          this._rake(tmp);
          this._multilookup(tmp, out, this._f(i, 2));
        }
      }

      return out;
    }

    // ===== Key schedule (ported from initkey() in basslib.c) =====

    /**
     * initkey - derive the full key context (rounds, shredding mode,
     * randomization mode, and all 8 permutation tables) from the key.
     * keyBytes[0] is the control byte; keyBytes[1..] is the seed material.
     */
    _initKey(keyBytes, decrypt) {
      const control = keyBytes[0];
      this.nrounds = OpCodes.AndN(control, 0x07) + 1;
      this.shred8ways = OpCodes.AndN(control, 0x08) !== 0;
      this.rerand = OpCodes.AndN(control, 0x20) !== 0;
      this.hardrand = OpCodes.AndN(control, 0x10) !== 0 && !this.rerand;
      this.uncryp = false; // initially assume encrypt, in case of hardrand

      this.tlist = new Array(NTABLES).fill(null);
      this.bitmasks = new Array(NTABLES).fill(0);

      const keyBody = keyBytes.slice(1);
      this._initlfsr(keyBody);

      // build (and discard) a throwaway table to prime the LFSR
      this._buildtbl(new Array(BLOCK_SIZE).fill(0), false);

      if (!this.rerand)
        this._bldtbls(false, decrypt && !this.hardrand);

      if (this.hardrand) {
        this._initbrand(keyBody);
        this._bldtbls(true, decrypt);
        this.randbuf = null;
        this.randbufCounter = 0;
      }

      this.uncryp = decrypt;

      if (!this.rerand)
        this.lfsr = null; // no longer needed once the tables are fixed
    }

    /**
     * Encrypt a single 256-byte block
     */
    _encryptBlock(block) {
      return this._bassomaticCore(block);
    }

    /**
     * Decrypt a single 256-byte block
     */
    _decryptBlock(block) {
      return this._bassomaticCore(block);
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");

      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Validate input length
      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
      }

      const output = [];

      // Process each 256-byte block
      for (let offset = 0; offset < this.inputBuffer.length; offset += this.BlockSize) {
        const block = this.inputBuffer.slice(offset, offset + this.BlockSize);

        const processed = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);

        for (let _i = 0; _i < processed.length; _i++) output.push(processed[_i]);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new BassOMaticAlgorithm());

  return BassOMaticAlgorithm;
}));
