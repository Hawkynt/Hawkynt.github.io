/*
 * Diamond2 Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Diamond2 Block Cipher by Michael Paul Johnson (1995)
 * - 128-bit block size (16 bytes)
 * - Variable key length (8 to 65,536 bits)
 * - Minimum 10 rounds (default 10)
 * - Royalty-free algorithm
 *
 * Based on the official specification: https://cryptography.org/mpj/diamond2.pdf
 * Reference implementation: dlock2.zip (DIAMOND2.CPP)
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
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== CRC-32 TABLE GENERATION =====

  /**
   * Build CRC-32 lookup table (CCITT polynomial)
   * Uses polynomial 0x04C11DB7
   */
  function buildCRC32Table() {
    const table = new Array(256);
    const polynomial = 0xEDB88320; // Reversed polynomial for table-driven CRC

    for (let i = 0; i < 256; i++) {
      let crc = i;
      for (let j = 0; j < 8; j++) {
        if (OpCodes.AndN(crc, 1)) {
          crc = OpCodes.ToUint32(OpCodes.XorN(OpCodes.Shr32(crc, 1), polynomial));
        } else {
          crc = OpCodes.ToUint32(OpCodes.Shr32(crc, 1));
        }
      }
      table[i] = OpCodes.ToUint32(crc);
    }
    return table;
  }

  const CRC32_TABLE = buildCRC32Table();

  /**
   * Update CRC-32 accumulator with one byte
   */
  function crc32Update(crc, byte) {
    return OpCodes.ToUint32(OpCodes.XorN(CRC32_TABLE[OpCodes.AndN(OpCodes.XorN(crc, byte), 0xFF)], OpCodes.Shr32(crc, 8)));
  }

  // ===== DIAMOND2 ALGORITHM IMPLEMENTATION =====

  /**
 * Diamond2Algorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */

  class Diamond2Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Diamond2";
      this.description = "Royalty-free block cipher by Michael Paul Johnson with variable key length and substitution-permutation network structure. Uses 128-bit blocks with minimum 10 rounds for high security.";
      this.inventor = "Michael Paul Johnson";
      this.year = 1995;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL; // Conservative classification
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(1, 8192, 1) // 8 to 65,536 bits (1 to 8192 bytes)
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 1) // Fixed 128-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Diamond2 Block Cipher Specification", "https://cryptography.org/mpj/diamond2.pdf"),
        new LinkItem("Original DLOCK2 Implementation", "https://archive.org/details/dlock2dos"),
        new LinkItem("Standard Cryptographic Algorithm Naming (SCAN)", "http://www.users.zetnet.co.uk/hopwood/crypto/scan/cs.html")
      ];

      this.references = [
        new LinkItem("Reference Implementation (C)", "https://archive.org/download/dlock2dos/dlock2.zip"),
        new LinkItem("Michael Paul Johnson's Software Page", "https://mljohnson.org/software.htm")
      ];

      // The complete set of 128-bit-block records from DIAMOND2.DAT, the
      // validation data file shipped with Michael Paul Johnson's Diamond2
      // reference distribution (dlock2.zip). Each record in that file is
      // "block size, rounds, key size, key, plain text, cipher text"; the
      // 64-bit-block records in the same file belong to Diamond2 Lite, which
      // this implementation does not offer.
      const DAT_URI = "https://archive.org/download/dlock2dos/dlock2.zip";

      this.tests = [
        {
          text: "DIAMOND2.DAT record 1 - 15 rounds, 32-byte key",
          uri: DAT_URI,
          rounds: 15,
          key: OpCodes.Hex8ToBytes("E834FDB933C502923D92BC9E14368E70D41C66CBDF36155033A66E07E6CC6D8D"),
          input: OpCodes.Hex8ToBytes("5A8D872D31EEDDE63FC46F6C36456D8E"),
          expected: OpCodes.Hex8ToBytes("39B60490AEEF791A29015D74494AAA89")
        },
        {
          text: "DIAMOND2.DAT record 2 - 12 rounds, 31-byte key",
          uri: DAT_URI,
          rounds: 12,
          key: OpCodes.Hex8ToBytes("EA9A425EFD4115A12DE708150404786F02053FD5090C36E93C35DDC086EE23"),
          input: OpCodes.Hex8ToBytes("6D4DABAEA1BA7CE219FA4D58477DDF04"),
          expected: OpCodes.Hex8ToBytes("8E5172D29A01373BD26164FC07B61152")
        },
        {
          text: "DIAMOND2.DAT record 3 - 9 rounds, 30-byte key",
          uri: DAT_URI,
          rounds: 9,
          key: OpCodes.Hex8ToBytes("056C448E9FC16B3FF9016C7225573DFF4440817785FD598643D69592B503"),
          input: OpCodes.Hex8ToBytes("A5A6631229D0BA0EC35DEBF856E0912E"),
          expected: OpCodes.Hex8ToBytes("6C9B3CEE37415139E5D986EF43182788")
        },
        {
          text: "DIAMOND2.DAT record 4 - 6 rounds, 29-byte key",
          uri: DAT_URI,
          rounds: 6,
          key: OpCodes.Hex8ToBytes("5A3B86CF3D3C147A085EA4D0BBD27BCDB7E75268A52AD226BB1D9AED02"),
          input: OpCodes.Hex8ToBytes("DDCB0A0AA58C3F9A29250858C0D09BF5"),
          expected: OpCodes.Hex8ToBytes("361C79F6AEC715C1DB7F92E26B51693B")
        },
        {
          text: "DIAMOND2.DAT record 5 - 14 rounds, 28-byte key",
          uri: DAT_URI,
          rounds: 14,
          key: OpCodes.Hex8ToBytes("DA7089BAFD4B2540ABA02F430CF54AED1D880B2D9D56C5A1DF864E4D"),
          input: OpCodes.Hex8ToBytes("CBBCC0138EFEB183971E503DA1894AEB"),
          expected: OpCodes.Hex8ToBytes("A2394D3DE23D7A7D15CF5B77E8C8E82F")
        },
        {
          text: "DIAMOND2.DAT record 6 - 11 rounds, 27-byte key",
          uri: DAT_URI,
          rounds: 11,
          key: OpCodes.Hex8ToBytes("BA5EC82DEDBA04F1C74D3428A12131DC1466A3D69B1131D201AAD9"),
          input: OpCodes.Hex8ToBytes("C53BE5469B9B5FD9B82DF46AD04D44FC"),
          expected: OpCodes.Hex8ToBytes("070B9CB9B28A5975D4C6D3BC5B01C7A9")
        },
        {
          text: "DIAMOND2.DAT record 7 - 8 rounds, 26-byte key",
          uri: DAT_URI,
          rounds: 8,
          key: OpCodes.Hex8ToBytes("3CC215D708D03E13260A97B55B290154C6B1B97848C4AB57159D"),
          input: OpCodes.Hex8ToBytes("0DCE02BEF4444712D9A03FEC590479B6"),
          expected: OpCodes.Hex8ToBytes("DA0C70FB54B4CB77B494DF2DE82E1742")
        },
        {
          text: "DIAMOND2.DAT record 8 - 5 rounds, 25-byte key",
          uri: DAT_URI,
          rounds: 5,
          key: OpCodes.Hex8ToBytes("CB920084DDF7554E6037078CBFF7C6B84D40CE318D09F18A39"),
          input: OpCodes.Hex8ToBytes("7A0AE292EDBDC55F3959A09752719A77"),
          expected: OpCodes.Hex8ToBytes("11ABF94C14C04CD89DA555D5E3938115")
        },
        {
          text: "DIAMOND2.DAT record 9 - 13 rounds, 24-byte key",
          uri: DAT_URI,
          rounds: 13,
          key: OpCodes.Hex8ToBytes("20C4357C5B0D24649C0F240235F8F44BA3554C69CDD3DEF6"),
          input: OpCodes.Hex8ToBytes("B3CA5E53B7BFA9B771BE2F5850A47CD6"),
          expected: OpCodes.Hex8ToBytes("10DB36B67930E8075A65F3FFF8F51475")
        },
        {
          text: "DIAMOND2.DAT record 10 - 10 rounds, 23-byte key",
          uri: DAT_URI,
          rounds: 10,
          key: OpCodes.Hex8ToBytes("9E786E7613DDEB65C4198055370E87ACA311D8516CBBDC"),
          input: OpCodes.Hex8ToBytes("89C2D70C333F565ADD4F00861CD9AAD3"),
          expected: OpCodes.Hex8ToBytes("218E81B4516473DECD28338295CE2D07")
        },
        {
          text: "DIAMOND2.DAT record 11 - 7 rounds, 22-byte key",
          uri: DAT_URI,
          rounds: 7,
          key: OpCodes.Hex8ToBytes("83C4BABF755E1A0262E43E3F1A409C187B98EC81FB50"),
          input: OpCodes.Hex8ToBytes("123219A8633B497F61934527FC6B9347"),
          expected: OpCodes.Hex8ToBytes("4F83C10A25481432BBB74F74DABDF9ED")
        },
        {
          text: "DIAMOND2.DAT record 12 - 15 rounds, 21-byte key",
          uri: DAT_URI,
          rounds: 15,
          key: OpCodes.Hex8ToBytes("2DDD7997E72B26DB904429DB1858418A888AB03A69"),
          input: OpCodes.Hex8ToBytes("41591C58686F19B97CA408E92D04B78D"),
          expected: OpCodes.Hex8ToBytes("727EB9C981A74A3F493EF81496ABB269")
        },
        {
          text: "DIAMOND2.DAT record 13 - 12 rounds, 20-byte key",
          uri: DAT_URI,
          rounds: 12,
          key: OpCodes.Hex8ToBytes("853605888BB37D5B36B055BCED151E276D84A717"),
          input: OpCodes.Hex8ToBytes("3C9904A551965B9BD14C2C0B8751E5A8"),
          expected: OpCodes.Hex8ToBytes("CFD8820ADC63B431B1B692A9DDEB216A")
        },
        {
          text: "DIAMOND2.DAT record 14 - 9 rounds, 19-byte key",
          uri: DAT_URI,
          rounds: 9,
          key: OpCodes.Hex8ToBytes("93BB32977B845E258B459A088534D34451CB51"),
          input: OpCodes.Hex8ToBytes("D8CD5DEA26BD945AD0BD6AE78FEE018E"),
          expected: OpCodes.Hex8ToBytes("DA70B8D5D1259D2EB671B3692E86C6EA")
        },
        {
          text: "DIAMOND2.DAT record 15 - 6 rounds, 18-byte key",
          uri: DAT_URI,
          rounds: 6,
          key: OpCodes.Hex8ToBytes("212503AAE04100C8DB7567B83D3AD4DD02ED"),
          input: OpCodes.Hex8ToBytes("352ECDD94A37AB5E2A096D8F3F411026"),
          expected: OpCodes.Hex8ToBytes("60D0EC68ABD975E07B3D892E4E329847")
        },
        {
          text: "DIAMOND2.DAT record 16 - 14 rounds, 17-byte key",
          uri: DAT_URI,
          rounds: 14,
          key: OpCodes.Hex8ToBytes("599B02FBD0D321A789EB97B388BF77C663"),
          input: OpCodes.Hex8ToBytes("56A25A87D40AB25A1DD972A7D154F8A5"),
          expected: OpCodes.Hex8ToBytes("081420F230D5A85AB2B55453C43C7967")
        },
        {
          text: "DIAMOND2.DAT record 17 - 11 rounds, 16-byte key",
          uri: DAT_URI,
          rounds: 11,
          key: OpCodes.Hex8ToBytes("3893A60CB8A96B9A931908514DD4CE5B"),
          input: OpCodes.Hex8ToBytes("16AA615AC61230933525F7723DB0C62F"),
          expected: OpCodes.Hex8ToBytes("67B8C9775C1EF3A1A50D67F6B8C0328B")
        },
        {
          text: "DIAMOND2.DAT record 18 - 8 rounds, 15-byte key",
          uri: DAT_URI,
          rounds: 8,
          key: OpCodes.Hex8ToBytes("2080D9F90D41A8B28C10444547F112"),
          input: OpCodes.Hex8ToBytes("ABB43532DD50A9A6172E44990731F1D3"),
          expected: OpCodes.Hex8ToBytes("D07EBB85466CB7A06CD098B6D88FD05A")
        },
        {
          text: "DIAMOND2.DAT record 19 - 5 rounds, 14-byte key",
          uri: DAT_URI,
          rounds: 5,
          key: OpCodes.Hex8ToBytes("78F9D7B638E5D2B3D4BCAE8DE866"),
          input: OpCodes.Hex8ToBytes("513475C4007E45AC0EBE885F48049EAF"),
          expected: OpCodes.Hex8ToBytes("8F4E2E74CD7B29F64FBE695BAC4C38B1")
        },
        {
          text: "DIAMOND2.DAT record 20 - 13 rounds, 13-byte key",
          uri: DAT_URI,
          rounds: 13,
          key: OpCodes.Hex8ToBytes("9BC7B89CD08D0D65B6751E6B37"),
          input: OpCodes.Hex8ToBytes("D17279F426AEF920DFC500BDD19030EC"),
          expected: OpCodes.Hex8ToBytes("8D038094AF38A418BAFC90017955D6DF")
        },
        {
          text: "DIAMOND2.DAT record 21 - 10 rounds, 12-byte key",
          uri: DAT_URI,
          rounds: 10,
          key: OpCodes.Hex8ToBytes("F1765B73954F7E4D643ED3CA"),
          input: OpCodes.Hex8ToBytes("ADE31EA61538BF8FF5F9037FFACF6B7A"),
          expected: OpCodes.Hex8ToBytes("4FD6830D95AEDB3E9CDCB4C4ABCEFA4C")
        },
        {
          text: "DIAMOND2.DAT record 22 - 7 rounds, 11-byte key",
          uri: DAT_URI,
          rounds: 7,
          key: OpCodes.Hex8ToBytes("365188A69A3AA853F85DED"),
          input: OpCodes.Hex8ToBytes("9F5E649F0981B2BD1FB18C9379C7465F"),
          expected: OpCodes.Hex8ToBytes("45732ADBA08D96FC607626AFA6BD32F8")
        },
        {
          text: "DIAMOND2.DAT record 23 - 15 rounds, 10-byte key",
          uri: DAT_URI,
          rounds: 15,
          key: OpCodes.Hex8ToBytes("78BB28B4CACD56A48B4D"),
          input: OpCodes.Hex8ToBytes("2C680DFAE36A7E10BB5732522AF3EF63"),
          expected: OpCodes.Hex8ToBytes("76F0ECCC8AEE86ABA9A3DE405D34377A")
        },
        {
          text: "DIAMOND2.DAT record 24 - 12 rounds, 9-byte key",
          uri: DAT_URI,
          rounds: 12,
          key: OpCodes.Hex8ToBytes("AAB680401C069E86F1"),
          input: OpCodes.Hex8ToBytes("919881900F2560281C5482C60C917167"),
          expected: OpCodes.Hex8ToBytes("9E9130CCD02AF6A757AEC03FC2EFAC3F")
        },
        {
          text: "DIAMOND2.DAT record 25 - 9 rounds, 8-byte key",
          uri: DAT_URI,
          rounds: 9,
          key: OpCodes.Hex8ToBytes("3361066B2C297543"),
          input: OpCodes.Hex8ToBytes("787699FCB627774FCF0F0D82462D6E7D"),
          expected: OpCodes.Hex8ToBytes("CEB8B4F88C02DF34ADDAF431E7A7A07C")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new Diamond2Instance(this, isInverse);
    }
  }

  /**
 * Diamond2 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class Diamond2Instance extends IBlockCipherInstance {
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
      this.rounds = 10; // Default 10 rounds (as own property for TestCore compatibility)
      this._sboxRounds = 0; // Track rounds for which S-boxes were generated
      this.BlockSize = 16;
      this.KeySize = 0;

      // Diamond2-specific state
      this.substitutionBoxes = null;     // Forward S-boxes
      this.inverseSubstitutionBoxes = null; // Inverse S-boxes for decryption
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
        this.substitutionBoxes = null;
        this.inverseSubstitutionBoxes = null;
        this._sboxRounds = 0; // Track rounds for which S-boxes were generated
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      // Generate substitution boxes based on key
      this._generateSubstitutionBoxes(keyBytes);
      this._sboxRounds = this.rounds; // Remember rounds count for S-boxes
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * Generate substitution boxes using CRC-32 based PRNG
     * This is the key scheduling algorithm from the Diamond2 specification
     */
    _generateSubstitutionBoxes(key) {
      // Validate rounds
      if (this.rounds < 5) {
        throw new Error("Diamond2 requires minimum 5 rounds (10 recommended for security)");
      }

      const numRounds = this.rounds;
      const blockSize = 16; // Diamond2 uses 16-byte blocks

      // Allocate substitution box arrays
      this.substitutionBoxes = new Array(numRounds);
      for (let i = 0; i < numRounds; i++) {
        this.substitutionBoxes[i] = new Array(blockSize);
        for (let j = 0; j < blockSize; j++) {
          this.substitutionBoxes[i][j] = new Uint8Array(256);
        }
      }

      // Key expansion state (persistent across all S-boxes)
      this._keyIndex = 0;
      this._accum = 0xFFFFFFFF; // Initial CRC value (all ones)
      let previousSBox = null;

      // Fill all substitution boxes
      for (let round = 0; round < numRounds; round++) {
        for (let bytePos = 0; bytePos < blockSize; bytePos++) {
          this._makeOneBox(round, bytePos, key, previousSBox);

          // Update previous S-box pointer for next iteration
          previousSBox = this.substitutionBoxes[round][bytePos];
        }
      }

      // Generate inverse substitution boxes for decryption
      if (this.isInverse) {
        this._generateInverseBoxes();
      }
    }

    /**
     * Fill one substitution box (256-byte array)
     * Implements the key scheduling algorithm from Diamond2 spec
     */
    _makeOneBox(round, bytePos, key, previousSBox) {
      const sbox = this.substitutionBoxes[round][bytePos];
      const filled = new Array(256).fill(false);

      // Fill array from 255 down to 0
      for (let n = 255; n >= 0; n--) {
        // Generate pseudorandom position in range [0, n]
        const pos = this._keyrand(n, key, previousSBox);

        // Find the pos-th unfilled slot
        let p = 0;
        while (filled[p]) p++;
        for (let m = 0; m < pos; m++) {
          p++;
          while (filled[p]) p++;
        }

        // Place element n at position p
        sbox[p] = n;
        filled[p] = true;
      }
    }

    /**
     * Generate normalized pseudorandom number in range [0, maxValue]
     * Using CRC-32 based PRNG from Diamond2 specification
     * Uses instance variables _keyIndex and _accum for state persistence
     */
    _keyrand(maxValue, key, previousSBox) {
      if (maxValue === 0) return 0;

      // Calculate minimum number of bits needed to cover range
      let mask = 0;
      for (let i = maxValue; i > 0; i = OpCodes.Shr32(i, 1)) {
        mask = OpCodes.OrN(OpCodes.Shl32(mask, 1), 1);
      }

      let attempts = 0;
      let prandValue;

      do {
        // Update CRC accumulator with next key byte
        if (previousSBox) {
          // Use previous S-box to add more entropy (Diamond2 fix)
          this._accum = crc32Update(this._accum, previousSBox[key[this._keyIndex]]);
        } else {
          // First S-box: use key directly
          this._accum = crc32Update(this._accum, key[this._keyIndex]);
        }

        this._keyIndex++;

        // Recycle key when we reach the end
        if (this._keyIndex >= key.length) {
          this._keyIndex = 0;
          // Mix in key length to add more entropy
          this._accum = crc32Update(this._accum, OpCodes.AndN(key.length, 0xFF));
          this._accum = crc32Update(this._accum, OpCodes.AndN(OpCodes.Shr32(key.length, 8), 0xFF));
        }

        // Mask to get value in approximate range
        prandValue = OpCodes.AndN(this._accum, mask);

        // After 97 attempts, introduce negligible bias to prevent infinite loop
        if (++attempts > 97 && prandValue > maxValue) {
          prandValue -= maxValue;
        }
      } while (prandValue > maxValue);

      return prandValue;
    }

    /**
     * Generate inverse substitution boxes for decryption
     */
    _generateInverseBoxes() {
      const numRounds = this.rounds;
      const blockSize = 16;

      this.inverseSubstitutionBoxes = new Array(numRounds);

      for (let round = 0; round < numRounds; round++) {
        this.inverseSubstitutionBoxes[round] = new Array(blockSize);

        for (let bytePos = 0; bytePos < blockSize; bytePos++) {
          this.inverseSubstitutionBoxes[round][bytePos] = new Uint8Array(256);

          // Build inverse: if sbox[k] = v, then inverse_sbox[v] = k
          for (let k = 0; k < 256; k++) {
            const v = this.substitutionBoxes[round][bytePos][k];
            this.inverseSubstitutionBoxes[round][bytePos][v] = k;
          }
        }
      }
    }

    /**
     * Permutation function - spreads bits across bytes
     * Each output byte takes bits from 8 different input bytes
     */
    _permute(input) {
      const output = new Uint8Array(16);

      for (let i = 0; i < 16; i++) {
        output[i] = OpCodes.OrN(
          OpCodes.OrN(
            OpCodes.OrN(
              OpCodes.OrN(
                OpCodes.OrN(
                  OpCodes.OrN(
                    OpCodes.OrN(OpCodes.AndN(input[i], 1), OpCodes.AndN(input[(i + 1) % 16], 2)),
                    OpCodes.AndN(input[(i + 2) % 16], 4)
                  ),
                  OpCodes.AndN(input[(i + 3) % 16], 8)
                ),
                OpCodes.AndN(input[(i + 4) % 16], 16)
              ),
              OpCodes.AndN(input[(i + 5) % 16], 32)
            ),
            OpCodes.AndN(input[(i + 6) % 16], 64)
          ),
          OpCodes.AndN(input[(i + 7) % 16], 128)
        );
      }

      return output;
    }

    /**
     * Inverse permutation function for decryption
     */
    _inversePermute(input) {
      const output = new Uint8Array(16);

      for (let i = 0; i < 16; i++) {
        output[i] = OpCodes.OrN(
          OpCodes.OrN(
            OpCodes.OrN(
              OpCodes.OrN(
                OpCodes.OrN(
                  OpCodes.OrN(
                    OpCodes.OrN(OpCodes.AndN(input[i], 1), OpCodes.AndN(input[(i + 15) % 16], 2)),
                    OpCodes.AndN(input[(i + 14) % 16], 4)
                  ),
                  OpCodes.AndN(input[(i + 13) % 16], 8)
                ),
                OpCodes.AndN(input[(i + 12) % 16], 16)
              ),
              OpCodes.AndN(input[(i + 11) % 16], 32)
            ),
            OpCodes.AndN(input[(i + 10) % 16], 64)
          ),
          OpCodes.AndN(input[(i + 9) % 16], 128)
        );
      }

      return output;
    }

    /**
     * Substitution function - apply S-boxes to each byte
     */
    _substitute(round, input) {
      const output = new Uint8Array(16);

      for (let i = 0; i < 16; i++) {
        output[i] = this.substitutionBoxes[round][i][input[i]];
      }

      return output;
    }

    /**
     * Inverse substitution for decryption
     */
    _inverseSubstitute(round, input) {
      const output = new Uint8Array(16);

      for (let i = 0; i < 16; i++) {
        output[i] = this.inverseSubstitutionBoxes[round][i][input[i]];
      }

      return output;
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

      // Regenerate S-boxes if rounds changed after key was set
      if (this._sboxRounds !== this.rounds) {
        this._generateSubstitutionBoxes(this._key);
        this._sboxRounds = this.rounds;

        // Regenerate inverse boxes if needed
        if (this.isInverse) {
          this._generateInverseBoxes();
        }
      }

      const output = [];

      // Process each 16-byte block
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const processedBlock = this.isInverse
          ? this._decryptBlock(block)
          : this._encryptBlock(block);
        for (let _i = 0; _i < processedBlock.length; _i++) output.push(processedBlock[_i]);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    /**
     * Encrypt one 16-byte block
     * Algorithm: substitute -> (permute -> substitute) repeated for all rounds
     */
    _encryptBlock(block) {
      let state = new Uint8Array(block);

      // Round 0: substitution only
      state = this._substitute(0, state);

      // Rounds 1 to (numRounds-1): permute then substitute
      for (let round = 1; round < this.rounds; round++) {
        state = this._permute(state);
        state = this._substitute(round, state);
      }

      return Array.from(state);
    }

    /**
     * Decrypt one 16-byte block
     * Reverse operations in reverse order
     */
    _decryptBlock(block) {
      let state = new Uint8Array(block);

      // Generate inverse boxes if not already done
      if (!this.inverseSubstitutionBoxes) {
        this._generateInverseBoxes();
      }

      // Last round: inverse substitute only
      state = this._inverseSubstitute(this.rounds - 1, state);

      // Rounds (numRounds-2) down to 0: inverse substitute then inverse permute
      for (let round = this.rounds - 2; round >= 0; round--) {
        state = this._inversePermute(state);
        state = this._inverseSubstitute(round, state);
      }

      return Array.from(state);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new Diamond2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Diamond2Algorithm, Diamond2Instance };
}));
