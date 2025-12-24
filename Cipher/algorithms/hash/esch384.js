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
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem } = AlgorithmFramework;

  // SPARKLE round constants from specification
  const RC_0 = 0xB7E15162;
  const RC_1 = 0xBF715880;
  const RC_2 = 0x38B4DA56;
  const RC_3 = 0x324E7738;
  const RC_4 = 0xBB1185EB;
  const RC_5 = 0x4F7C7B57;
  const RC_6 = 0xCFBFA1C8;
  const RC_7 = 0xC2B3293D;

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
   * @param {number} x - Left half of 64-bit block
   * @param {number} y - Right half of 64-bit block
   * @param {number} k - 32-bit round constant
   * @returns {Object} {x, y} - Updated block halves
   */
  function alzette(x, y, k) {
    // Step 1: x += ROL1(y), y XOR= ROL8(x), x XOR= k
    x = OpCodes.ToUint32(x + OpCodes.RotL32(y, 1));
    y = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(x, 8)));
    x = OpCodes.Xor32(x, k);

    // Step 2: x += ROL15(y), y XOR= ROL15(x), x XOR= k
    x = OpCodes.ToUint32(x + OpCodes.RotL32(y, 15));
    y = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(x, 15)));
    x = OpCodes.Xor32(x, k);

    // Step 3: x += y, y XOR= ROL1(x), x XOR= k
    x = OpCodes.ToUint32(x + y);
    y = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(x, 1)));
    x = OpCodes.Xor32(x, k);

    // Step 4: x += ROL8(y), y XOR= ROL16(x), x XOR= k
    x = OpCodes.ToUint32(x + OpCodes.RotL32(y, 8));
    y = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(x, 16)));
    x = OpCodes.Xor32(x, k);

    return { x: x, y: y };
  }

  /**
   * leftRotate16 helper: ROL16 for linear layer
   * @param {number} x - 32-bit word
   * @returns {number} Rotated word
   */
  function leftRotate16(x) {
    return OpCodes.RotL32(x, 16);
  }

  /**
   * SPARKLE-512 permutation (16 words, 512 bits)
   * Performs ARXbox layer + linear diffusion layer
   * @param {Array<number>} s - 16-word state array (modified in place)
   * @param {number} steps - Number of steps (8 for slim, 12 for big)
   */
  function sparkle_512(s, steps) {
    let x0, y0, x1, y1, x2, y2, x3, y3, x4, y4, x5, y5, x6, y6, x7, y7;
    let tx, ty, result;

    // Load state into local variables
    x0 = s[0];  y0 = s[1];
    x1 = s[2];  y1 = s[3];
    x2 = s[4];  y2 = s[5];
    x3 = s[6];  y3 = s[7];
    x4 = s[8];  y4 = s[9];
    x5 = s[10]; y5 = s[11];
    x6 = s[12]; y6 = s[13];
    x7 = s[14]; y7 = s[15];

    // Perform all steps
    for (let step = 0; step < steps; ++step) {
      // Add round constants
      y0 = OpCodes.ToUint32(OpCodes.Xor32(y0, SPARKLE_RC[step]));
      y1 = OpCodes.ToUint32(OpCodes.Xor32(y1, step));

      // ARXbox layer - apply Alzette to each branch
      result = alzette(x0, y0, RC_0);
      x0 = result.x; y0 = result.y;

      result = alzette(x1, y1, RC_1);
      x1 = result.x; y1 = result.y;

      result = alzette(x2, y2, RC_2);
      x2 = result.x; y2 = result.y;

      result = alzette(x3, y3, RC_3);
      x3 = result.x; y3 = result.y;

      result = alzette(x4, y4, RC_4);
      x4 = result.x; y4 = result.y;

      result = alzette(x5, y5, RC_5);
      x5 = result.x; y5 = result.y;

      result = alzette(x6, y6, RC_6);
      x6 = result.x; y6 = result.y;

      result = alzette(x7, y7, RC_7);
      x7 = result.x; y7 = result.y;

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
   * @param {Array<number>} s - SPARKLE-512 state (16 words)
   * @param {Array<number>} block - Input block as 4 words
   * @param {number} domain - Domain separator (0x00, 0x01, or 0x02)
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

      this.SupportedOutputSizes = [{ minSize: 48, maxSize: 48, stepSize: 1 }];

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

      // Official NIST LWC test vectors from Esch384.txt
      this.tests = [
        {
          text: "Esch384: Empty message (NIST LWC KAT Count=1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("2981715E2263EBD0CB6E5C2C99D0776D5E691EE737FDE05247895E75D02E7447FD6AB707E2EC8385A539777965E472EE")
        },
        {
          text: "Esch384: Single byte 0x00 (NIST LWC KAT Count=2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("CA78366C86E82726C19EBD1DBBB1375CEF93C570F856CE2FF5DA0CA87140DACD65F3E1C5AF5F84B3F6390B9AC1A2FA4D")
        },
        {
          text: "Esch384: Two bytes 0x0001 (NIST LWC KAT Count=3)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("76A4F5B45A6062DE68F974824FCC7DE8CE4BD9CE64CE9A8958A3409151B2481D13B5D9C1BDCA1A658D31110088C54922")
        },
        {
          text: "Esch384: Four bytes 0x00010203 (NIST LWC KAT Count=5)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("900C76A75AD5FEC6924934E8EADC78BCB3951E241A2AC9301E6D35895689BA7C93411A5B6DEF5A2F87248AFF1BDD240E")
        },
        {
          text: "Esch384: 8 bytes (NIST LWC KAT Count=9)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("571560322D28DC5F8039794B4A3290A17CCDD60FA6C36EE78DCF9C05CE592D64021EF324AF69FCAC6829FD84AA69F35B")
        },
        {
          text: "Esch384: 16 bytes (full rate) (NIST LWC KAT Count=17)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("0008F97D6BBB701D5E33FCC178EFE3E3D5E77915D4A4DAF6E1AE34CD28EDB895A053E19D930B50F72837E1A8F5B1F450")
        },
        {
          text: "Esch384: 20 bytes (NIST LWC KAT Count=21)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F10111213"),
          expected: OpCodes.Hex8ToBytes("7E04B13784F319C59936C2555B3EE347D7E3FBED51138F5FCD79482A1F5BE9D9F9DEA8F598D5B01F4916F3BE6FD0A24D")
        },
        {
          text: "Esch384: 32 bytes (NIST LWC KAT Count=33)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("55BA6E68B5EF92458C75E4888B25B31DC6212933B138C9623217AF9AAFF2A4691B81331DE422387D12F170EF088E0EA1")
        },
        {
          text: "Esch384: 48 bytes (NIST LWC KAT Count=49)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F"),
          expected: OpCodes.Hex8ToBytes("E938CDFE53D40963908D7F3FFA0671D80AB95925964BBBB3EFE97676E94FC21BD6B836482EC13840999473FC7B148EF1")
        },
        {
          text: "Esch384: 64 bytes (NIST LWC KAT Count=65)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F"),
          expected: OpCodes.Hex8ToBytes("580D48B4DCEAD117350855547063A629FD200CD623681EEB4C3C16FA2222614A94CE8A8BB69343A621227DEBD018F0AD")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
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
    constructor(algorithm) {
      super(algorithm);

      // SPARKLE-512 state: 16 words (512 bits)
      this.state = new Array(SPARKLE_512_STATE_SIZE).fill(0);

      // Input buffer for rate bytes
      this.blockWords = new Array(4).fill(0); // 4 words = 16 bytes
      this.blockBytes = new Array(ESCH_384_RATE).fill(0);
      this.count = 0; // Bytes in buffer

      this._outputSize = ESCH_384_HASH_SIZE;
    }

    set outputSize(size) {
      if (size !== ESCH_384_HASH_SIZE) {
        throw new Error(`Invalid output size: ${size} bytes (only 48 supported for Esch384)`);
      }
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
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
