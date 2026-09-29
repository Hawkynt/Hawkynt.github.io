/*
 * Esch384 - NIST Lightweight Cryptography Finalist Hash Function
 * Professional implementation based on SPARKLE-512 permutation
 * (c)2006-2025 Hawkynt
 *
 * Esch384 is based on the SPARKLE permutation family, a finalist in NIST's Lightweight
 * Cryptography competition. It uses SPARKLE-512 (16 words, 512 bits) to produce 384-bit
 * hash outputs with efficient performance on constrained devices.
 *
 * Reference Implementation: https://github.com/cryptolu/sparkle
 * NIST LWC Specification: https://csrc.nist.gov/projects/lightweight-cryptography
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
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize } = AlgorithmFramework;

  // SPARKLE round constants from specification
  const RC_0 = 0xB7E15162;
  const RC_1 = 0xBF715880;
  const RC_2 = 0x38B4DA56;
  const RC_3 = 0x324E7738;
  const RC_4 = 0xBB1185EB;
  const RC_5 = 0x4F7C7B57;
  const RC_6 = 0xCFBFA1C8;
  const RC_7 = 0xC2B3293D;

  /** @type {uint32[]} */
  const SPARKLE_RC = [
    RC_0, RC_1, RC_2, RC_3, RC_4, RC_5, RC_6, RC_7,
    RC_0, RC_1, RC_2, RC_3
  ];

  // Esch384 parameters
  const ESCH_384_RATE = 16;           // 16 bytes rate
  const ESCH_384_HASH_SIZE = 48;      // 384-bit output
  const SPARKLE_512_STATE_SIZE = 16;  // 16 words (512 bits)

  /**
   * Alzette ARXbox: Core building block of SPARKLE permutation
   * Implements ADD-ROTATE-XOR operations with round constant
   * @param {uint32[]} xy - The branch [x, y] (left and right half of a 64-bit block), updated in place
   * @param {uint32} k - 32-bit round constant
   * @returns {void}
   */
  function alzette(xy, k) {
    let x = xy[0];
    let y = xy[1];

    // Step 1: x += ROL1(y), y XOR= ROL8(x), x XOR= k
    x = OpCodes.Add32(x, OpCodes.RotL32(y, 1));
    y = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(x, 8)));
    x = OpCodes.Xor32(x, k);

    // Step 2: x += ROL15(y), y XOR= ROL15(x), x XOR= k
    x = OpCodes.Add32(x, OpCodes.RotL32(y, 15));
    y = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(x, 15)));
    x = OpCodes.Xor32(x, k);

    // Step 3: x += y, y XOR= ROL1(x), x XOR= k
    x = OpCodes.Add32(x, y);
    y = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(x, 1)));
    x = OpCodes.Xor32(x, k);

    // Step 4: x += ROL8(y), y XOR= ROL16(x), x XOR= k
    x = OpCodes.Add32(x, OpCodes.RotL32(y, 8));
    y = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(x, 16)));
    x = OpCodes.Xor32(x, k);

    xy[0] = x;
    xy[1] = y;
  }

  /**
   * leftRotate16 helper: ROL16 for linear layer
   * @param {uint32} x - 32-bit word
   * @returns {uint32} Rotated word
   */
  function leftRotate16(x) {
    return OpCodes.RotL32(x, 16);
  }

  /**
   * SPARKLE-512 permutation (16 words, 512 bits)
   * Performs ARXbox layer + linear diffusion layer
   * @param {uint32[]} s - 16-word state array (modified in place)
   * @param {int32} steps - Number of steps (8 for slim, 12 for big)
   * @returns {void}
   */
  function sparkle_512(s, steps) {
    /** @type {uint32[]} */
    const xy = [0, 0];
    /** @type {uint32} */
    let tx;
    /** @type {uint32} */
    let ty;

    // Load state into local variables
    let x0 = s[0];  let y0 = s[1];
    let x1 = s[2];  let y1 = s[3];
    let x2 = s[4];  let y2 = s[5];
    let x3 = s[6];  let y3 = s[7];
    let x4 = s[8];  let y4 = s[9];
    let x5 = s[10]; let y5 = s[11];
    let x6 = s[12]; let y6 = s[13];
    let x7 = s[14]; let y7 = s[15];

    // Perform all steps
    for (let step = 0; step < steps; ++step) {
      // Add round constants
      y0 = OpCodes.ToUint32(OpCodes.Xor32(y0, SPARKLE_RC[step]));
      y1 = OpCodes.ToUint32(OpCodes.Xor32(y1, step));

      // ARXbox layer - apply Alzette to each branch
      xy[0] = x0; xy[1] = y0;
      alzette(xy, RC_0);
      x0 = xy[0]; y0 = xy[1];

      xy[0] = x1; xy[1] = y1;
      alzette(xy, RC_1);
      x1 = xy[0]; y1 = xy[1];

      xy[0] = x2; xy[1] = y2;
      alzette(xy, RC_2);
      x2 = xy[0]; y2 = xy[1];

      xy[0] = x3; xy[1] = y3;
      alzette(xy, RC_3);
      x3 = xy[0]; y3 = xy[1];

      xy[0] = x4; xy[1] = y4;
      alzette(xy, RC_4);
      x4 = xy[0]; y4 = xy[1];

      xy[0] = x5; xy[1] = y5;
      alzette(xy, RC_5);
      x5 = xy[0]; y5 = xy[1];

      xy[0] = x6; xy[1] = y6;
      alzette(xy, RC_6);
      x6 = xy[0]; y6 = xy[1];

      xy[0] = x7; xy[1] = y7;
      alzette(xy, RC_7);
      x7 = xy[0]; y7 = xy[1];

      // Linear layer - diffusion step
      // tx = x0 XOR x1 XOR x2 XOR x3; ty = y0 XOR y1 XOR y2 XOR y3
      tx = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(x0, x1), x2), x3));
      ty = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(y0, y1), y2), y3));

      // Apply Feistel-like transformation
      tx = leftRotate16(OpCodes.Xor32(tx, OpCodes.Shl32(tx, 16)));
      ty = leftRotate16(OpCodes.Xor32(ty, OpCodes.Shl32(ty, 16)));

      // Save original values before modification
      const origY0 = y0, origY1 = y1, origY2 = y2, origY3 = y3, origY7 = y7;
      const origX0 = x0, origX1 = x1, origX2 = x2, origX3 = x3, origX7 = x7;

      // Modify y4, y5, y6 in place, then update tx
      y4 = OpCodes.ToUint32(OpCodes.Xor32(y4, tx));
      y5 = OpCodes.ToUint32(OpCodes.Xor32(y5, tx));
      y6 = OpCodes.ToUint32(OpCodes.Xor32(y6, tx));
      tx = OpCodes.ToUint32(OpCodes.Xor32(tx, origY7));

      // Now do the permutation with modified y4/y5/y6
      y7 = origY3;
      y3 = OpCodes.ToUint32(OpCodes.Xor32(y4, origY0));  // Uses modified y4
      y4 = origY0;
      y0 = OpCodes.ToUint32(OpCodes.Xor32(y5, origY1));  // Uses modified y5
      y5 = origY1;
      y1 = OpCodes.ToUint32(OpCodes.Xor32(y6, origY2));  // Uses modified y6
      y6 = origY2;
      y2 = OpCodes.ToUint32(OpCodes.Xor32(tx, y7));  // Uses modified tx and y7

      // Same for x branch
      x4 = OpCodes.ToUint32(OpCodes.Xor32(x4, ty));
      x5 = OpCodes.ToUint32(OpCodes.Xor32(x5, ty));
      x6 = OpCodes.ToUint32(OpCodes.Xor32(x6, ty));
      ty = OpCodes.ToUint32(OpCodes.Xor32(ty, origX7));

      x7 = origX3;
      x3 = OpCodes.ToUint32(OpCodes.Xor32(x4, origX0));  // Uses modified x4
      x4 = origX0;
      x0 = OpCodes.ToUint32(OpCodes.Xor32(x5, origX1));  // Uses modified x5
      x5 = origX1;
      x1 = OpCodes.ToUint32(OpCodes.Xor32(x6, origX2));  // Uses modified x6
      x6 = origX2;
      x2 = OpCodes.ToUint32(OpCodes.Xor32(ty, x7));  // Uses modified ty and x7
    }

    // Store state back
    s[0] = OpCodes.ToUint32(x0);  s[1] = OpCodes.ToUint32(y0);
    s[2] = OpCodes.ToUint32(x1);  s[3] = OpCodes.ToUint32(y1);
    s[4] = OpCodes.ToUint32(x2);  s[5] = OpCodes.ToUint32(y2);
    s[6] = OpCodes.ToUint32(x3);  s[7] = OpCodes.ToUint32(y3);
    s[8] = OpCodes.ToUint32(x4);  s[9] = OpCodes.ToUint32(y4);
    s[10] = OpCodes.ToUint32(x5); s[11] = OpCodes.ToUint32(y5);
    s[12] = OpCodes.ToUint32(x6); s[13] = OpCodes.ToUint32(y6);
    s[14] = OpCodes.ToUint32(x7); s[15] = OpCodes.ToUint32(y7);
  }

  /**
   * Esch384 M4 mixing function
   * Implements the Feistel-based mixing from reference implementation
   * @param {uint32[]} s - SPARKLE-512 state (16 words)
   * @param {uint32[]} block - Input block as 4 words
   * @param {uint32} domain - Domain separator (0x00, 0x01, or 0x02)
   * @returns {void}
   */
  function esch_384_m4(s, block, domain) {
    // tx = block[0] XOR block[2]; ty = block[1] XOR block[3]
    let tx = OpCodes.ToUint32(OpCodes.Xor32(block[0], block[2]));
    let ty = OpCodes.ToUint32(OpCodes.Xor32(block[1], block[3]));

    // Apply Feistel transformation: tx = ROL16(tx XOR left shift tx by 16)
    tx = leftRotate16(OpCodes.Xor32(tx, OpCodes.Shl32(tx, 16)));
    ty = leftRotate16(OpCodes.Xor32(ty, OpCodes.Shl32(ty, 16)));

    // Mix into state (M4 mixes into 8 state words instead of 6)
    s[0] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(s[0], block[0]), ty));
    s[1] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(s[1], block[1]), tx));
    s[2] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(s[2], block[2]), ty));
    s[3] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(s[3], block[3]), tx));

    // Add domain separator to s[7] if non-zero
    if (domain !== 0) {
      // DOMAIN macro: OpCodes.Shl32(value, 24) for little-endian
      s[7] = OpCodes.ToUint32(OpCodes.Xor32(s[7], OpCodes.Shl32(domain, 24)));
    }

    s[4] = OpCodes.ToUint32(OpCodes.Xor32(s[4], ty));
    s[5] = OpCodes.ToUint32(OpCodes.Xor32(s[5], tx));
    s[6] = OpCodes.ToUint32(OpCodes.Xor32(s[6], ty));
    s[7] = OpCodes.ToUint32(OpCodes.Xor32(s[7], tx));
  }

  /**
   * Esch384 Hash Function Algorithm
   */
  class Esch384 extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "Esch384";
      this.description = "NIST Lightweight Cryptography finalist based on SPARKLE-512 permutation. Optimized for constrained devices with 384-bit security.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2019;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [new KeySize(48, 48, 1)];

      this.documentation = [
        new LinkItem(
          "NIST LWC Sparkle Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf"
        ),
        new LinkItem(
          "Sparkle Project Website",
          "https://sparkle-lwc.github.io/"
        ),
        new LinkItem(
          "GitHub Reference Implementation",
          "https://github.com/cryptolu/sparkle"
        )
      ];

      this.references = [
        new LinkItem("Official SPARKLE/Esch reference implementation (cryptolu team)", "https://github.com/cryptolu/sparkle")
      ];

      // Official NIST LWC test vectors from Esch384.txt
      this.tests = [
        {
          text: "Esch384: Empty message (NIST LWC KAT Count=1)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("2981715E2263EBD0CB6E5C2C99D0776D5E691EE737FDE05247895E75D02E7447FD6AB707E2EC8385A539777965E472EE")
        },
        {
          text: "Esch384: Single byte 0x00 (NIST LWC KAT Count=2)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("CA78366C86E82726C19EBD1DBBB1375CEF93C570F856CE2FF5DA0CA87140DACD65F3E1C5AF5F84B3F6390B9AC1A2FA4D")
        },
        {
          text: "Esch384: Two bytes 0x0001 (NIST LWC KAT Count=3)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("76A4F5B45A6062DE68F974824FCC7DE8CE4BD9CE64CE9A8958A3409151B2481D13B5D9C1BDCA1A658D31110088C54922")
        },
        {
          text: "Esch384: Four bytes 0x00010203 (NIST LWC KAT Count=5)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("900C76A75AD5FEC6924934E8EADC78BCB3951E241A2AC9301E6D35895689BA7C93411A5B6DEF5A2F87248AFF1BDD240E")
        },
        {
          text: "Esch384: 8 bytes (NIST LWC KAT Count=9)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("571560322D28DC5F8039794B4A3290A17CCDD60FA6C36EE78DCF9C05CE592D64021EF324AF69FCAC6829FD84AA69F35B")
        },
        {
          text: "Esch384: 16 bytes (full rate) (NIST LWC KAT Count=17)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("0008F97D6BBB701D5E33FCC178EFE3E3D5E77915D4A4DAF6E1AE34CD28EDB895A053E19D930B50F72837E1A8F5B1F450")
        },
        {
          text: "Esch384: 20 bytes (NIST LWC KAT Count=21)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F10111213"),
          expected: OpCodes.Hex8ToBytes("7E04B13784F319C59936C2555B3EE347D7E3FBED51138F5FCD79482A1F5BE9D9F9DEA8F598D5B01F4916F3BE6FD0A24D")
        },
        {
          text: "Esch384: 32 bytes (NIST LWC KAT Count=33)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("55BA6E68B5EF92458C75E4888B25B31DC6212933B138C9623217AF9AAFF2A4691B81331DE422387D12F170EF088E0EA1")
        },
        {
          text: "Esch384: 48 bytes (NIST LWC KAT Count=49)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F"),
          expected: OpCodes.Hex8ToBytes("E938CDFE53D40963908D7F3FFA0671D80AB95925964BBBB3EFE97676E94FC21BD6B836482EC13840999473FC7B148EF1")
        },
        {
          text: "Esch384: 64 bytes (NIST LWC KAT Count=65)",
          uri: "https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          expected: OpCodes.Hex8ToBytes("580D48B4DCEAD117350855547063A629FD200CD623681EEB4C3C16FA2222614A94CE8A8BB69343A621227DEBD018F0AD")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Esch384Instance} New hash instance, or null for the inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new Esch384Instance(this);
    }
  }

  /**
   * Esch384 Hash Function Instance
   */
  class Esch384Instance extends IHashFunctionInstance {
    /**
     * Initialize an Esch384 instance
     * @param {Esch384} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);

      // SPARKLE-512 state: 16 words (512 bits)
      /** @type {uint32[]} */
      this.state = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

      // Input buffer for rate bytes
      /** @type {uint32[]} */
      this.blockWords = [0, 0, 0, 0]; // 4 words = 16 bytes
      /** @type {uint8[]} */
      this.blockBytes = OpCodes.CreateArray(ESCH_384_RATE, 0);
      /** @type {int32} */
      this.count = 0; // Bytes in buffer

      /** @type {int32} */
      this._outputSize = ESCH_384_HASH_SIZE;
    }

    /**
     * Set the digest size (only 48 bytes is supported)
     * @param {int32} size - Digest size in bytes
     */
    set outputSize(size) {
      if (size !== ESCH_384_HASH_SIZE) {
        throw new Error('Invalid output size: ' + size + ' bytes (only 48 supported for Esch384)');
      }
      this._outputSize = size;
    }

    /**
     * Digest size in bytes
     * @returns {int32} Always 48
     */
    get outputSize() {
      return this._outputSize;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @returns {void}
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      let pos = 0;
      const len = data.length;

      while (pos < len) {
        // Fill buffer
        while (this.count < ESCH_384_RATE && pos < len) {
          this.blockBytes[this.count++] = data[pos++];
        }

        // Process full block ONLY if there's more data coming
        // (the last block is processed in Result() with appropriate domain)
        if (this.count === ESCH_384_RATE && pos < len) {
          // Convert bytes to words (little-endian)
          for (let i = 0; i < 4; ++i) {
            this.blockWords[i] = OpCodes.Pack32LE(
              this.blockBytes[i * 4 + 0],
              this.blockBytes[i * 4 + 1],
              this.blockBytes[i * 4 + 2],
              this.blockBytes[i * 4 + 3]
            );
          }

          // Apply M4 mixing with domain 0x00 (intermediate block)
          esch_384_m4(this.state, this.blockWords, 0x00);

          // Apply SPARKLE-512 with 8 steps (slim)
          sparkle_512(this.state, 8);

          this.count = 0;
        }
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Pad and finalize
      if (this.count === ESCH_384_RATE) {
        // Complete block: domain 0x02
        // Convert bytes to words (little-endian)
        for (let i = 0; i < 4; ++i) {
          this.blockWords[i] = OpCodes.Pack32LE(
            this.blockBytes[i * 4 + 0],
            this.blockBytes[i * 4 + 1],
            this.blockBytes[i * 4 + 2],
            this.blockBytes[i * 4 + 3]
          );
        }
        esch_384_m4(this.state, this.blockWords, 0x02);
      } else {
        // Incomplete block: apply padding and domain 0x01
        this.blockBytes[this.count] = 0x80;
        for (let i = this.count + 1; i < ESCH_384_RATE; ++i) {
          this.blockBytes[i] = 0x00;
        }

        // Convert padded bytes to words
        for (let i = 0; i < 4; ++i) {
          this.blockWords[i] = OpCodes.Pack32LE(
            this.blockBytes[i * 4 + 0],
            this.blockBytes[i * 4 + 1],
            this.blockBytes[i * 4 + 2],
            this.blockBytes[i * 4 + 3]
          );
        }
        esch_384_m4(this.state, this.blockWords, 0x01);
      }

      // Apply final SPARKLE-512 with 12 steps (big)
      sparkle_512(this.state, 12);

      // Extract first 16 bytes from state
      /** @type {uint8[]} */
      const output = new Array(ESCH_384_HASH_SIZE);
      for (let i = 0; i < 4; ++i) {
        const bytes = OpCodes.Unpack32LE(this.state[i]);
        output[i * 4 + 0] = bytes[0];
        output[i * 4 + 1] = bytes[1];
        output[i * 4 + 2] = bytes[2];
        output[i * 4 + 3] = bytes[3];
      }

      // Apply SPARKLE-512 with 8 steps (slim)
      sparkle_512(this.state, 8);

      // Extract next 16 bytes from state
      for (let i = 0; i < 4; ++i) {
        const bytes = OpCodes.Unpack32LE(this.state[i]);
        output[16 + i * 4 + 0] = bytes[0];
        output[16 + i * 4 + 1] = bytes[1];
        output[16 + i * 4 + 2] = bytes[2];
        output[16 + i * 4 + 3] = bytes[3];
      }

      // Apply SPARKLE-512 with 8 steps (slim) again
      sparkle_512(this.state, 8);

      // Extract final 16 bytes from state
      for (let i = 0; i < 4; ++i) {
        const bytes = OpCodes.Unpack32LE(this.state[i]);
        output[32 + i * 4 + 0] = bytes[0];
        output[32 + i * 4 + 1] = bytes[1];
        output[32 + i * 4 + 2] = bytes[2];
        output[32 + i * 4 + 3] = bytes[3];
      }

      // Reset state for next operation
      this.state.fill(0);
      this.blockWords.fill(0);
      this.blockBytes.fill(0);
      this.count = 0;

      return output;
    }
  }

  RegisterAlgorithm(new Esch384());
  return Esch384;
}));
