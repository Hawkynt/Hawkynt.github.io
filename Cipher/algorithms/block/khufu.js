/*
 * Khufu Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Ralph Merkle's Khufu (Xerox PARC, 1989/1990): 64-bit blocks, a key of up to
 * 64 bytes, 8 to 64 rounds in multiples of 8 (default 16), one key-dependent
 * 256 x 32-bit S-box per octet of 8 rounds and four 32-bit auxiliary keys.
 *
 * SOURCES
 *   - R.C. Merkle, "Fast Software Encryption Functions", CRYPTO '90, LNCS 537,
 *     pp. 476-501: the round function, rotation schedule, auxiliary keys, the
 *     64-byte key state encrypted with Khufu in CBC mode under the standard
 *     S-box, and the Knuth shuffle of each byte column of the standard S-box.
 *   - US patent 5,003,597 (Merkle, 1991), FIG. 3, FIG. 4 and Appendix A (the
 *     Xerox reference program by Merkle and Rodriguez, version 1.0 of
 *     February 9, 1989): the exact standard S-box, how it is drawn from the
 *     RAND digits, and the precise key schedule summarised below.
 *
 * STANDARD S-BOX
 *   Start from the identity in every byte column, then for column 0..3 (0 is
 *   the most significant byte) and row 0..254 swap the column bytes of row and
 *   randomInRange(row, 255). randomInRange(a, b) reads decimal digits in order
 *   from RAND's "A Million Random Digits with 100,000 Normal Deviates" (1955):
 *   with n = b - a + 1 it takes the fewest digits k with 10^k >= n, rejects a
 *   value v >= floor(10^k / n) * n, and returns a + v mod n. This consumes the
 *   first 3027 digits ("10097 32533 76520 ...") and yields the table below,
 *   whose rows agree with FIG. 3 of the patent; it is also S-box 0 of Merkle's
 *   Snefru 2.5a reference code.
 *
 * KEY SCHEDULE (Appendix A, sBoxesFromRandomArray)
 *   - The key bytes, zero-padded to 64 bytes, form the state, read as 16
 *     big-endian words.
 *   - The state is encrypted three times with 16-round Khufu in CBC mode, using
 *     the standard S-box for both octets, zero auxiliary keys, and the last 8
 *     state bytes (as they stand before each pass) as the IV.
 *   - Auxiliary keys 0..3 are state words 0..3.
 *   - A byte cursor starts at state byte 16. S-box o (o = 0, 1, ...) starts as
 *     the standard S-box; for column 0..3 the mask is reset to 0xFF, and for
 *     row 0..254 a candidate row + (state[cursor] AND mask) is drawn, the
 *     cursor advanced, and the draw repeated while the candidate exceeds 255.
 *     When the cursor passes byte 63 it wraps to 0, the state is encrypted once
 *     more as above, and only then is the mask narrowed while 255 - row still
 *     fits in mask >> 1. The column bytes of row and the candidate are swapped.
 *
 * ENCRYPTION
 *   L, R = the two big-endian halves, XORed with auxiliary keys 0 and 1. Each
 *   round XORs R with S[octet][L AND 0xFF], rotates L right by the schedule
 *   16,16,8,8,16,16,24,24 and swaps L and R; octet o uses S-box o. Finally L and
 *   R are XORed with auxiliary keys 2 and 3.
 *
 * TEST VECTORS
 *   Appendix A gives the output of "pharaoh khufu 345 e0 16" for the input
 *   "Hello there, world!\n" (CBC, zero IV, 0x80 then zero padding): 0000...
 *   then DAA19C48 C60E2947 C87FD857 BEEB1D71 D76CC01B 1DE661BE. Its three blocks
 *   are written below as single-block vectors (the CBC chaining value folded
 *   into the plaintext). The remaining vectors come from that reference program
 *   compiled as a black box; it reproduces both published checks of the
 *   listing (the vector above and the self-test words 556318067, 113379917,
 *   2856241156, 2619501619 for ten 1024-byte CBC passes under the all-zero key).
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
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== CONSTANTS =====

  /**
   * Merkle's standard S-box, drawn from the RAND digits (see header).
   * @type {uint32[]}
   */
  const STANDARD_SBOX = [
    0x64F9001B, 0xFEDDCDF6, 0x7C8FF1E2, 0x11D71514, 0x8B8C18D3, 0xDDDF881E, 0x6EAB5056, 0x88CED8E1,
    0x49148959, 0x69C56FD5, 0xB7994F03, 0x0FBCEE3E, 0x3C264940, 0x21557E58, 0xE14B3FC2, 0x2E5CF591,
    0xDCEFF8CE, 0x092A1648, 0xBE812936, 0xFF7B0C6A, 0xD5251037, 0xAFA448F1, 0x7DAFC95A, 0x1EA69C3F,
    0xA417ABE7, 0x5890E423, 0xB0CB70C0, 0xC85025F7, 0x244D97E3, 0x1FF3595F, 0xC4EC6396, 0x59181E17,
    0xE635B477, 0x354E7DBF, 0x796F7753, 0x66EB52CC, 0x77C3F995, 0x32E3A927, 0x80CCAED6, 0x4E2BE89D,
    0x375BBD28, 0xAD1A3D05, 0x2B1B42B3, 0x16C44C71, 0x4D54BFA8, 0xE57DDC7A, 0xEC6D8144, 0x5A71046B,
    0xD8229650, 0x87FC8F24, 0xCBC60E09, 0xB6390366, 0xD9F76092, 0xD393A70B, 0x1D31A08A, 0x9CD971C9,
    0x5C1EF445, 0x86FAB694, 0xFDB44165, 0x8EAAFCBE, 0x4BCAC6EB, 0xFB7A94E5, 0x5789D04E, 0xFA13CF35,
    0x236B8DA9, 0x4133F000, 0x6224261C, 0xF412F23B, 0xE75E56A4, 0x30022116, 0xBAF17F1F, 0xD09872F9,
    0xC1A3699C, 0xF1E802AA, 0x0DD145DC, 0x4FDCE093, 0x8D8412F0, 0x6CD0F376, 0x3DE6B73D, 0x84BA737F,
    0xB43A30F2, 0x44569F69, 0x00E4EACA, 0xB58DE3B0, 0x959113C8, 0xD62EFEE9, 0x90861F83, 0xCED69874,
    0x2F793CEE, 0xE8571C30, 0x483665D1, 0xAB07B031, 0x914C844F, 0x15BF3BE8, 0x2C3F2A9A, 0x9EB95FD4,
    0x92E7472D, 0x2297CC5B, 0xEE5F2782, 0x5377B562, 0xDB8EBBCF, 0xF961DEDD, 0xC59B5C60, 0x1BD3910D,
    0x26D206AD, 0xB28514D8, 0x5ECF6B52, 0x7FEA78BB, 0x504879AC, 0xED34A884, 0x36E51D3C, 0x1753741D,
    0x8C47CAED, 0x9D0A40EF, 0x3145E221, 0xDA27EB70, 0xDF730BA3, 0x183C8789, 0x739AC0A6, 0x9A58DFC6,
    0x54B134C1, 0xAC3E242E, 0xCC493902, 0x7B2DDA99, 0x8F15BC01, 0x29FD38C7, 0x27D5318F, 0x604AAFF5,
    0xF29C6818, 0xC38AA2EC, 0x1019D4C3, 0xA8FB936E, 0x20ED7B39, 0x0B686119, 0x89A0906F, 0x1CC7829E,
    0x9952EF4B, 0x850E9E8C, 0xCD063A90, 0x67002F8E, 0xCFAC8CB7, 0xEAA24B11, 0x988B4E6C, 0x46F066DF,
    0xCA7EEC08, 0xC7BBA664, 0x831D17BD, 0x63F575E6, 0x9764350E, 0x47870D42, 0x026CA4A2, 0x8167D587,
    0x61B6ADAB, 0xAA6564D2, 0x70DA237B, 0x25E1C74A, 0xA1C901A0, 0x0EB0A5DA, 0x7670F741, 0x51C05AEA,
    0x933DFA32, 0x0759FF1A, 0x56010AB8, 0x5FDECB78, 0x3F32EDF8, 0xAEBEDBB9, 0x39F8326D, 0xD20858C5,
    0x9B638BE4, 0xA572C80A, 0x28E0A19F, 0x432099FC, 0x3A37C3CD, 0xBF95C585, 0xB392C12A, 0x6AA707D7,
    0x52F66A61, 0x12D483B1, 0x96435B5E, 0x3E75802B, 0x3BA52B33, 0xA99F51A5, 0xBDA1E157, 0x78C2E70C,
    0xFCAE7CE0, 0xD1602267, 0x2AFFAC4D, 0x4A510947, 0x0AB2B83A, 0x7A04E579, 0x340DFD80, 0xB916E922,
    0xE29D5E9B, 0xF5624AF4, 0x4CA9D9AF, 0x6BBD2CFE, 0xE3B7F620, 0xC2746E07, 0x5B42B9B6, 0xA06919BC,
    0xF0F2C40F, 0x72217AB5, 0x14C19DF3, 0xF3802DAE, 0xE094BEB4, 0xA2101AFF, 0x0529575D, 0x55CDB27C,
    0xA33BDDB2, 0x6528B37D, 0x740C05DB, 0xE96A62C4, 0x40782846, 0x6D30D706, 0xBBF48E2C, 0xBCE2D3DE,
    0x049E37FA, 0x01B5E634, 0x2D886D8D, 0x7E5A2E7E, 0xD7412013, 0x06E90F97, 0xE45D3EBA, 0xB8AD3386,
    0x13051B25, 0x0C035354, 0x71C89B75, 0xC638FBD0, 0x197F11A1, 0xEF0F08FB, 0xF8448651, 0x38409563,
    0x452F4443, 0x5D464D55, 0x03D8764C, 0xB1B8D638, 0xA70BBA2F, 0x94B3D210, 0xEB6692A7, 0xD409C2D9,
    0x68838526, 0xA6DB8A15, 0x751F6C98, 0xDE769A88, 0xC9EE4668, 0x1A82A373, 0x0896AA49, 0x42233681,
    0xF62C55CB, 0x9F1C5404, 0xF74FB15C, 0xC06E4312, 0x6FFE5D72, 0x8AA8678B, 0x337CD129, 0x8211CEFD
  ];

  /**
   * Right-rotation applied to the S-box index half after each round of an octet.
   * @type {int32[]}
   */
  const ROTATE_SCHEDULE = [16, 16, 8, 8, 16, 16, 24, 24];

  /** @type {int32} */
  const STATE_BYTES = 64;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * KhufuAlgorithm - Block cipher implementation
   * @class
   * @extends {BlockCipherAlgorithm}
   */
  class KhufuAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Khufu";
      this.description = "Ralph Merkle's Khufu: a 64-bit Feistel block cipher with a key of up to 512 bits and 8 to 64 rounds (default 16). Each octet of 8 rounds uses its own key-dependent S-box, built by shuffling the byte columns of a standard S-box drawn from RAND's published random digits with a key stream from Khufu in CBC mode.";
      this.inventor = "Ralph Merkle";
      this.year = 1990;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN; // 16-round Khufu falls to differential cryptanalysis
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(1, 64, 1) // 8-512 bits, zero-padded to 64 bytes
      ];
      this.SupportedBlockSizes = [
        new KeySize(8, 8, 0) // Fixed 64-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("CRYPTO '90 Paper: Fast Software Encryption Functions", "https://link.springer.com/chapter/10.1007/3-540-38424-3_34"),
        new LinkItem("U.S. Patent 5,003,597 (with the reference program as Appendix A)", "https://patents.google.com/patent/US5003597A/en"),
        new LinkItem("RAND: A Million Random Digits with 100,000 Normal Deviates", "https://www.rand.org/pubs/monograph_reports/MR1418.html"),
        new LinkItem("Wikipedia - Khufu and Khafre", "https://en.wikipedia.org/wiki/Khufu_and_Khafre")
      ];

      this.references = [
        new LinkItem("US 5,003,597 full text and drawings (PDF)", "https://patentimages.storage.googleapis.com/da/90/c5/6e9f3e99ad270f/US5003597.pdf"),
        new LinkItem("Gilbert and Chauvaud: A Chosen Plaintext Attack of the 16-round Khufu Cryptosystem", "https://link.springer.com/chapter/10.1007/3-540-48658-5_33")
      ];

      // Vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Differential Cryptanalysis",
          "16-round Khufu is broken by a differential chosen-plaintext attack using about 2^43 chosen plaintexts (Gilbert and Chauvaud, CRYPTO '94).",
          "Use a modern cipher such as AES.",
          "https://link.springer.com/chapter/10.1007/3-540-48658-5_33"
        )
      ];

      // The first three vectors are the published "Hello there, world!" output
      // of the patent's reference program (see header); the others were computed
      // with that reference program used as a black box.
      this.tests = [
        {
          text: "US 5,003,597 Appendix A: key 0x345, \"Hello th\" (block 1 of the published CBC output)",
          uri: "https://patents.google.com/patent/US5003597A/en",
          input: OpCodes.Hex8ToBytes("48656C6C6F207468"),
          key: OpCodes.Hex8ToBytes("3450"),
          expected: OpCodes.Hex8ToBytes("DAA19C48C60E2947")
        },
        {
          text: "US 5,003,597 Appendix A: key 0x345, block 2 (\"ere, wor\" XOR block 1)",
          uri: "https://patents.google.com/patent/US5003597A/en",
          input: OpCodes.Hex8ToBytes("BFD3F964E6794635"),
          key: OpCodes.Hex8ToBytes("3450"),
          expected: OpCodes.Hex8ToBytes("C87FD857BEEB1D71")
        },
        {
          text: "US 5,003,597 Appendix A: key 0x345, block 3 (\"ld!\\n\" and 0x80 padding XOR block 2)",
          uri: "https://patents.google.com/patent/US5003597A/en",
          input: OpCodes.Hex8ToBytes("A41BF95D3EEB1D71"),
          key: OpCodes.Hex8ToBytes("3450"),
          expected: OpCodes.Hex8ToBytes("D76CC01B1DE661BE")
        },
        {
          text: "Zero 64-bit key, zero block, 16 rounds (reference program of US 5,003,597)",
          uri: "https://patents.google.com/patent/US5003597A/en",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000"),
          expected: OpCodes.Hex8ToBytes("4B31A94CC29F4223")
        },
        {
          text: "512-bit key 00..3F, 16 rounds (reference program of US 5,003,597)",
          uri: "https://patents.google.com/patent/US5003597A/en",
          input: OpCodes.Hex8ToBytes("0123456789ABCDEF"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          expected: OpCodes.Hex8ToBytes("76AF43AD43DB9918")
        },
        {
          text: "512-bit key 00..3F, 32 rounds (reference program of US 5,003,597)",
          uri: "https://patents.google.com/patent/US5003597A/en",
          input: OpCodes.Hex8ToBytes("0123456789ABCDEF"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          rounds: 32,
          expected: OpCodes.Hex8ToBytes("4AE44E6BB4CE0CAE")
        },
        {
          text: "128-bit key, all-ones block, 8 rounds (reference program of US 5,003,597)",
          uri: "https://patents.google.com/patent/US5003597A/en",
          input: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFF"),
          key: OpCodes.Hex8ToBytes("0123456789ABCDEFFEDCBA9876543210"),
          rounds: 8,
          expected: OpCodes.Hex8ToBytes("09A0009FFE68AA60")
        },
        {
          text: "128-bit key, all-ones block, 64 rounds (reference program of US 5,003,597)",
          uri: "https://patents.google.com/patent/US5003597A/en",
          input: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFF"),
          key: OpCodes.Hex8ToBytes("0123456789ABCDEFFEDCBA9876543210"),
          rounds: 64,
          expected: OpCodes.Hex8ToBytes("AC21A13CE5EC13F2")
        }
      ];
    }

    /**
     * Create new cipher instance
     * @param {boolean} [isInverse=false] - True for decryption, false for encryption
     * @returns {KhufuInstance} New cipher instance
     */
    CreateInstance(isInverse = false) {
      return new KhufuInstance(this, isInverse);
    }
  }

  /**
   * Khufu cipher instance implementing Feed/Result pattern
   * @class
   * @extends {IBlockCipherInstance}
   */
  class KhufuInstance extends IBlockCipherInstance {
    /**
     * Initialize Khufu cipher instance
     * @param {KhufuAlgorithm} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Decryption mode flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = 8; // 64 bits

      /** @type {int32} */
      this._rounds = 16;
      /** @type {uint32[][]|null} */
      this.sBoxes = null;
      /** @type {uint32[]|null} */
      this.auxKeys = null;
    }

    /**
     * Set encryption/decryption key
     * @param {uint8[]|null} keyBytes - Encryption key or null to clear
     * @throws {Error} If key size is invalid
     */
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.sBoxes = null;
        this.auxKeys = null;
        return;
      }

      if (keyBytes.length < 1 || keyBytes.length > STATE_BYTES) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. Khufu requires 1-64 bytes");
      }

      this._key = [...keyBytes];
      this._expandKey();
    }

    /**
     * Get copy of current key
     * @returns {uint8[]|null} Copy of key bytes or null
     */
    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * Set the number of rounds (a multiple of 8 from 8 to 64)
     * @param {int32} value - Round count
     * @throws {Error} If the round count is not allowed
     */
    set rounds(value) {
      if (value < 8 || value > 64 || value % 8 !== 0) {
        throw new Error("Invalid rounds: " + value + ". Must be a multiple of 8 between 8 and 64");
      }
      this._rounds = value;
      if (this._key) {
        this._expandKey();
      }
    }

    /**
     * @returns {int32} Round count
     */
    get rounds() {
      return this._rounds;
    }

    /**
     * Feed data to cipher for processing
     * @param {uint8[]} data - Input data bytes
     * @throws {Error} If key not set
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");

      for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i]);
    }

    /**
     * Get cipher result (encrypted or decrypted data)
     * @returns {uint8[]} Processed output bytes
     * @throws {Error} If key not set, no data fed, or invalid input length
     */
    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      if (this.inputBuffer.length % this.BlockSize !== 0) {
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");
      }

      /** @type {uint8[]} */
      const output = [];

      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processed = this.isInverse
          ? this._decryptBlock(block)
          : this._encryptBlock(block);
        for (let j = 0; j < processed.length; j++) output.push(processed[j]);
      }

      this.inputBuffer = [];
      return output;
    }

    /**
     * Encrypt the two halves of one block.
     * @param {uint32} left - Left half
     * @param {uint32} right - Right half
     * @param {uint32[][]} sBoxes - One S-box per octet
     * @param {uint32[]} aux - Auxiliary keys 0..3
     * @returns {uint32[]} The encrypted [left, right]
     */
    _encryptHalves(left, right, sBoxes, aux) {
      let l = OpCodes.Xor32(left, aux[0]);
      let r = OpCodes.Xor32(right, aux[1]);

      for (let octet = 0; octet < sBoxes.length; octet++) {
        const sBox = sBoxes[octet];
        for (let round = 0; round < 8; round++) {
          const mixed = OpCodes.Xor32(r, sBox[OpCodes.ToByte(l)]);
          r = OpCodes.RotR32(l, ROTATE_SCHEDULE[round]);
          l = mixed;
        }
      }

      return [OpCodes.Xor32(l, aux[2]), OpCodes.Xor32(r, aux[3])];
    }

    /**
     * Decrypt the two halves of one block.
     * @param {uint32} left - Left half
     * @param {uint32} right - Right half
     * @param {uint32[][]} sBoxes - One S-box per octet
     * @param {uint32[]} aux - Auxiliary keys 0..3
     * @returns {uint32[]} The decrypted [left, right]
     */
    _decryptHalves(left, right, sBoxes, aux) {
      let l = OpCodes.Xor32(left, aux[2]);
      let r = OpCodes.Xor32(right, aux[3]);

      for (let octet = sBoxes.length - 1; octet >= 0; octet--) {
        const sBox = sBoxes[octet];
        for (let round = 7; round >= 0; round--) {
          const unrotated = OpCodes.RotL32(r, ROTATE_SCHEDULE[round]);
          r = OpCodes.Xor32(l, sBox[OpCodes.ToByte(unrotated)]);
          l = unrotated;
        }
      }

      return [OpCodes.Xor32(l, aux[0]), OpCodes.Xor32(r, aux[1])];
    }

    /**
     * Encrypt the 64-byte key state in place with 16-round Khufu in CBC mode,
     * under the standard S-box and zero auxiliary keys, chaining from the last
     * 8 state bytes.
     * @param {uint8[]} state - Key state, overwritten in place
     */
    _stirState(state) {
      /** @type {uint32[][]} */
      const standardBoxes = [STANDARD_SBOX, STANDARD_SBOX];
      /** @type {uint32[]} */
      const zeroAux = [0, 0, 0, 0];
      let chainL = OpCodes.Pack32BE(state[56], state[57], state[58], state[59]);
      let chainR = OpCodes.Pack32BE(state[60], state[61], state[62], state[63]);

      for (let offset = 0; offset < STATE_BYTES; offset += 8) {
        const l = OpCodes.Xor32(OpCodes.Pack32BE(state[offset], state[offset + 1], state[offset + 2], state[offset + 3]), chainL);
        const r = OpCodes.Xor32(OpCodes.Pack32BE(state[offset + 4], state[offset + 5], state[offset + 6], state[offset + 7]), chainR);
        const encrypted = this._encryptHalves(l, r, standardBoxes, zeroAux);
        chainL = encrypted[0];
        chainR = encrypted[1];
        const leftBytes = OpCodes.Unpack32BE(chainL);
        const rightBytes = OpCodes.Unpack32BE(chainR);
        for (let i = 0; i < 4; i++) {
          state[offset + i] = leftBytes[i];
          state[offset + 4 + i] = rightBytes[i];
        }
      }
    }

    /**
     * Derive the auxiliary keys and one S-box per octet from the key.
     */
    _expandKey() {
      /** @type {uint8[]} */
      const state = new Array(STATE_BYTES);
      for (let i = 0; i < STATE_BYTES; i++) {
        state[i] = i < this._key.length ? this._key[i] : 0;
      }

      for (let pass = 0; pass < 3; pass++) {
        this._stirState(state);
      }

      /** @type {uint32[]} */
      const aux = new Array(4);
      for (let i = 0; i < 4; i++) {
        aux[i] = OpCodes.Pack32BE(state[4 * i], state[4 * i + 1], state[4 * i + 2], state[4 * i + 3]);
      }

      /** @type {uint32[][]} */
      const sBoxes = [];
      let cursor = 16;
      const octets = this._rounds / 8;

      for (let octet = 0; octet < octets; octet++) {
        // columns[c][row] is byte c (0 = most significant) of entry row
        /** @type {uint8[][]} */
        const columns = [];
        for (let c = 0; c < 4; c++) {
          /** @type {uint8[]} */
          const fresh = new Array(256);
          columns.push(fresh);
        }
        for (let row = 0; row < 256; row++) {
          const bytes = OpCodes.Unpack32BE(STANDARD_SBOX[row]);
          for (let c = 0; c < 4; c++) columns[c][row] = bytes[c];
        }

        for (let c = 0; c < 4; c++) {
          const column = columns[c];
          /** @type {uint8} */
          let mask = 0xFF;
          /** @type {uint8} */
          let narrower = 0x7F;

          for (let row = 0; row < 255; row++) {
            /** @type {int32} */
            let target = 0;
            do {
              target = row + OpCodes.And8(state[cursor], mask);
              ++cursor;
              if (cursor === STATE_BYTES) {
                cursor = 0;
                this._stirState(state);
                // The reference narrows the mask only when it refills the state
                while (OpCodes.Or8(narrower, 255 - row) === narrower) {
                  mask = narrower;
                  narrower = OpCodes.Shr8(mask, 1);
                }
              }
            } while (target > 255);

            const swap = column[row];
            column[row] = column[target];
            column[target] = swap;
          }
        }

        /** @type {uint32[]} */
        const sBox = new Array(256);
        for (let row = 0; row < 256; row++) {
          sBox[row] = OpCodes.Pack32BE(columns[0][row], columns[1][row], columns[2][row], columns[3][row]);
        }
        sBoxes.push(sBox);
      }

      this.auxKeys = aux;
      this.sBoxes = sBoxes;
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _encryptBlock(block) {
      const halves = this._encryptHalves(
        OpCodes.Pack32BE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32BE(block[4], block[5], block[6], block[7]),
        this.sBoxes, this.auxKeys);
      return [...OpCodes.Unpack32BE(halves[0]), ...OpCodes.Unpack32BE(halves[1])];
    }

    /**
     * @param {uint8[]} block - Input block
     * @returns {uint8[]} Output block
     */
    _decryptBlock(block) {
      const halves = this._decryptHalves(
        OpCodes.Pack32BE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32BE(block[4], block[5], block[6], block[7]),
        this.sBoxes, this.auxKeys);
      return [...OpCodes.Unpack32BE(halves[0]), ...OpCodes.Unpack32BE(halves[1])];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new KhufuAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { KhufuAlgorithm, KhufuInstance };
}));
