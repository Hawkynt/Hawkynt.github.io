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
        if (crc & 1) {
          crc = (crc >>> 1) ^ polynomial;
        } else {
          crc = crc >>> 1;
        }
      }
      table[i] = crc >>> 0;
    }
    return table;
  }

  const CRC32_TABLE = buildCRC32Table();

  /**
   * Update CRC-32 accumulator with one byte
   */
  function crc32Update(crc, byte) {
    return (CRC32_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8)) >>> 0;
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

      // Test vectors from DIAMOND2.DAT in dlock2.zip (official reference implementation)
      this.tests = [
        {
          text: "Diamond2 Test Vector #1 (15 rounds, 32-byte key)",
          uri: "https://archive.org/download/dlock2dos/dlock2.zip (DIAMOND2.DAT)",
          rounds: 15,
          key: OpCodes.Hex8ToBytes("E834FDB933C502923D92BC9E14368E70D41C66CBDF36155033A66E07E6CC6D8D"),
          input: OpCodes.Hex8ToBytes("5A8D872D31EEDDE63FC46F6C36456D8E"),
          expected: OpCodes.Hex8ToBytes("39B60490AEEF791A29015D74494AAA89")
        },
        {
          text: "Diamond2 Test Vector #2 (12 rounds, 31-byte key)",
          uri: "https://archive.org/download/dlock2dos/dlock2.zip (DIAMOND2.DAT)",
          rounds: 12,
          key: OpCodes.Hex8ToBytes("EA9A425EFD4115A12DE708150404786F02053FD5090C36E93C35DDC086EE23"),
          input: OpCodes.Hex8ToBytes("6D4DABAEA1BA7CE219FA4D58477DDF04"),
          expected: OpCodes.Hex8ToBytes("8E5172D29A01373BD26164FC07B61152")
        },
        {
          text: "Diamond2 Test Vector #3 (9 rounds, 30-byte key)",
          uri: "https://archive.org/download/dlock2dos/dlock2.zip (DIAMOND2.DAT)",
          rounds: 9,
          key: OpCodes.Hex8ToBytes("056C448E9FC16B3FF9016C7225573DFF4440817785FD598643D69592B503"),
          input: OpCodes.Hex8ToBytes("A5A6631229D0BA0EC35DEBF856E0912E"),
          expected: OpCodes.Hex8ToBytes("6C9B3CEE37415139E5D986EF43182788")
        },
        {
          text: "Diamond2 Test Vector #4 (6 rounds - testing minimum+, 29-byte key)",
          uri: "https://archive.org/download/dlock2dos/dlock2.zip (DIAMOND2.DAT)",
          rounds: 6,
          key: OpCodes.Hex8ToBytes("5A3B86CF3D3C147A085EA4D0BBD27BCDB7E75268A52AD226BB1D9AED02"),
          input: OpCodes.Hex8ToBytes("DDCB0A0AA58C3F9A29250858C0D09BF5"),
          expected: OpCodes.Hex8ToBytes("361C79F6AEC715C1DB7F92E26B51693B")
        },
        {
          text: "Diamond2 Test Vector #5 (14 rounds, 28-byte key)",
          uri: "https://archive.org/download/dlock2dos/dlock2.zip (DIAMOND2.DAT)",
          rounds: 14,
          key: OpCodes.Hex8ToBytes("DA7089BAFD4B2540ABA02F430CF54AED1D880B2D9D56C5A1DF864E4D"),
          input: OpCodes.Hex8ToBytes("CBBCC0138EFEB183971E503DA1894AEB"),
          expected: OpCodes.Hex8ToBytes("A2394D3DE23D7A7D15CF5B77E8C8E82F")
        },
        {
          text: "Diamond2 Test Vector #6 (11 rounds, 27-byte key)",
          uri: "https://archive.org/download/dlock2dos/dlock2.zip (DIAMOND2.DAT)",
          rounds: 11,
          key: OpCodes.Hex8ToBytes("BA5EC82DEDBA04F1C74D3428A12131DC1466A3D69B1131D201AAD9"),
          input: OpCodes.Hex8ToBytes("C53BE5469B9B5FD9B82DF46AD04D44FC"),
          expected: OpCodes.Hex8ToBytes("070B9CB9B28A5975D4C6D3BC5B01C7A9")
        },
        {
          text: "Diamond2 Test Vector #7 (8 rounds, 26-byte key)",
          uri: "https://archive.org/download/dlock2dos/dlock2.zip (DIAMOND2.DAT)",
          rounds: 8,
          key: OpCodes.Hex8ToBytes("3CC215D708D03E13260A97B55B290154C6B1B97848C4AB57159D"),
          input: OpCodes.Hex8ToBytes("0DCE02BEF4444712D9A03FEC590479B6"),
          expected: OpCodes.Hex8ToBytes("DA0C70FB54B4CB77B494DF2DE82E1742")
        },
        {
          text: "Diamond2 Test Vector #8 (5 rounds - below minimum, 25-byte key)",
          uri: "https://archive.org/download/dlock2dos/dlock2.zip (DIAMOND2.DAT)",
          rounds: 5,
          key: OpCodes.Hex8ToBytes("CB920084DDF7554E6037078CBFF7C6B84D40CE318D09F18A39"),
          input: OpCodes.Hex8ToBytes("7A0AE292EDBDC55F3959A09752719A77"),
          expected: OpCodes.Hex8ToBytes("11ABF94C14C04CD89DA555D5E3938115")
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
      for (let i = maxValue; i > 0; i = i >>> 1) {
        mask = (mask << 1) | 1;
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
          this._accum = crc32Update(this._accum, key.length & 0xFF);
          this._accum = crc32Update(this._accum, (key.length >>> 8) & 0xFF);
        }

        // Mask to get value in approximate range
        prandValue = this._accum & mask;

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
        output[i] =
          (input[i] & 1) |
          (input[(i + 1) % 16] & 2) |
          (input[(i + 2) % 16] & 4) |
          (input[(i + 3) % 16] & 8) |
          (input[(i + 4) % 16] & 16) |
          (input[(i + 5) % 16] & 32) |
          (input[(i + 6) % 16] & 64) |
          (input[(i + 7) % 16] & 128);
      }

      return output;
    }

    /**
     * Inverse permutation function for decryption
     */
    _inversePermute(input) {
      const output = new Uint8Array(16);

      for (let i = 0; i < 16; i++) {
        output[i] =
          (input[i] & 1) |
          (input[(i + 15) % 16] & 2) |
          (input[(i + 14) % 16] & 4) |
          (input[(i + 13) % 16] & 8) |
          (input[(i + 12) % 16] & 16) |
          (input[(i + 11) % 16] & 32) |
          (input[(i + 10) % 16] & 64) |
          (input[(i + 9) % 16] & 128);
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

      this.inputBuffer.push(...data);
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
        output.push(...processedBlock);
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
