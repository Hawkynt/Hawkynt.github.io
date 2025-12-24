/*
 * Esch256 - NIST Lightweight Cryptography Finalist Hash Function
 * Professional implementation based on SPARKLE-384 permutation
 * (c)2006-2025 Hawkynt
 *
 * Esch256 is based on the SPARKLE permutation family, a finalist in NIST's Lightweight
 * Cryptography competition. It uses SPARKLE-384 (12 words, 384 bits) to produce 256-bit
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

  const SPARKLE_RC = [
    RC_0, RC_1, RC_2, RC_3, RC_4, RC_5,
    0xCFBFA1C8, 0xC2B3293D,
    RC_0, RC_1, RC_2, RC_3
  ];

  // Esch256 parameters
  const ESCH_256_RATE = 16;           // 16 bytes rate
  const ESCH_256_HASH_SIZE = 32;      // 256-bit output
  const SPARKLE_384_STATE_SIZE = 12;  // 12 words (384 bits)

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
   * SPARKLE-384 permutation (12 words, 384 bits)
   * Performs ARXbox layer + linear diffusion layer
   * @param {Array<number>} s - 12-word state array (modified in place)
   * @param {number} steps - Number of steps (7 for slim, 11 for big)
   */
  function sparkle_384(s, steps) {
    let x0, y0, x1, y1, x2, y2, x3, y3, x4, y4, x5, y5;
    let tx, ty, result;

    // Load state into local variables
    x0 = s[0];  y0 = s[1];
    x1 = s[2];  y1 = s[3];
    x2 = s[4];  y2 = s[5];
    x3 = s[6];  y3 = s[7];
    x4 = s[8];  y4 = s[9];
    x5 = s[10]; y5 = s[11];

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

      // Linear layer - diffusion step
      // tx = x0 XOR x1 XOR x2; ty = y0 XOR y1 XOR y2
      tx = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(x0, x1), x2));
      ty = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(y0, y1), y2));

      // Apply Feistel-like transformation
      tx = leftRotate16(OpCodes.Xor32(tx, OpCodes.Shl32(tx, 16)));
      ty = leftRotate16(OpCodes.Xor32(ty, OpCodes.Shl32(ty, 16)));

      // Save original values before modification
      const origY0 = y0, origY1 = y1, origY2 = y2, origY5 = y5;
      const origX0 = x0, origX1 = x1, origX2 = x2, origX5 = x5;

      // Modify y3, y4 in place, then update tx
      y3 = OpCodes.ToUint32(OpCodes.Xor32(y3, tx));
      y4 = OpCodes.ToUint32(OpCodes.Xor32(y4, tx));
      tx = OpCodes.ToUint32(OpCodes.Xor32(tx, origY5));

      // Now do the permutation with modified y3/y4
      y5 = origY2;
      y2 = OpCodes.ToUint32(OpCodes.Xor32(y3, origY0));  // Uses modified y3
      y3 = origY0;
      y0 = OpCodes.ToUint32(OpCodes.Xor32(y4, origY1));  // Uses modified y4
      y4 = origY1;
      y1 = OpCodes.ToUint32(OpCodes.Xor32(tx, y5));  // Uses modified tx and y5

      // Same for x branch
      x3 = OpCodes.ToUint32(OpCodes.Xor32(x3, ty));
      x4 = OpCodes.ToUint32(OpCodes.Xor32(x4, ty));
      ty = OpCodes.ToUint32(OpCodes.Xor32(ty, origX5));

      x5 = origX2;
      x2 = OpCodes.ToUint32(OpCodes.Xor32(x3, origX0));  // Uses modified x3
      x3 = origX0;
      x0 = OpCodes.ToUint32(OpCodes.Xor32(x4, origX1));  // Uses modified x4
      x4 = origX1;
      x1 = OpCodes.ToUint32(OpCodes.Xor32(ty, x5));  // Uses modified ty and x5
    }

    // Store state back
    s[0] = OpCodes.ToUint32(x0);  s[1] = OpCodes.ToUint32(y0);
    s[2] = OpCodes.ToUint32(x1);  s[3] = OpCodes.ToUint32(y1);
    s[4] = OpCodes.ToUint32(x2);  s[5] = OpCodes.ToUint32(y2);
    s[6] = OpCodes.ToUint32(x3);  s[7] = OpCodes.ToUint32(y3);
    s[8] = OpCodes.ToUint32(x4);  s[9] = OpCodes.ToUint32(y4);
    s[10] = OpCodes.ToUint32(x5); s[11] = OpCodes.ToUint32(y5);
  }

  /**
   * Esch256 M3 mixing function
   * Implements the Feistel-based mixing from reference implementation
   * @param {Array<number>} s - SPARKLE-384 state (12 words)
   * @param {Array<number>} block - Input block as 4 words
   * @param {number} domain - Domain separator (0x00, 0x01, or 0x02)
   */
  function esch_256_m3(s, block, domain) {
    // tx = block[0] XOR block[2]; ty = block[1] XOR block[3]
    let tx = OpCodes.ToUint32(OpCodes.Xor32(block[0], block[2]));
    let ty = OpCodes.ToUint32(OpCodes.Xor32(block[1], block[3]));

    // Apply Feistel transformation: tx = ROL16(tx XOR left shift tx by 16)
    tx = leftRotate16(OpCodes.Xor32(tx, OpCodes.Shl32(tx, 16)));
    ty = leftRotate16(OpCodes.Xor32(ty, OpCodes.Shl32(ty, 16)));

    // Mix into state
    s[0] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(s[0], block[0]), ty));
    s[1] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(s[1], block[1]), tx));
    s[2] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(s[2], block[2]), ty));
    s[3] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(s[3], block[3]), tx));

    // Add domain separator to s[5] if non-zero
    if (domain !== 0) {
      // DOMAIN macro: OpCodes.Shl32(value, 24) for little-endian
      s[5] = OpCodes.ToUint32(OpCodes.Xor32(s[5], OpCodes.Shl32(domain, 24)));
    }

    s[4] = OpCodes.ToUint32(OpCodes.Xor32(s[4], ty));
    s[5] = OpCodes.ToUint32(OpCodes.Xor32(s[5], tx));
  }

  /**
   * Esch256 Hash Function Algorithm
   */
  class Esch256 extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "Esch256";
      this.description = "NIST Lightweight Cryptography finalist based on SPARKLE-384 permutation. Optimized for constrained devices with 256-bit security.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2019;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [{ minSize: 32, maxSize: 32, stepSize: 1 }];

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

      // Official NIST LWC test vectors from Esch256.txt
      this.tests = [
        {
          text: "Esch256: Empty message (NIST LWC KAT Count=1)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("C0E815D78B875DC768C6C8B3AFA51987CD69E5C087D387368628A511CFAD5730")
        },
        {
          text: "Esch256: Single byte 0x00 (NIST LWC KAT Count=2)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("D515FD9C2852D9D6F00C9CF01D858AF467EEDF21FF68CC14C005B3EFF7A6ECD3")
        },
        {
          text: "Esch256: Two bytes 0x0001 (NIST LWC KAT Count=3)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("FBCAD7AB77FD4CC844534D2716D08C092B40B86E00647ECAA429AFDFE3B3FC43")
        },
        {
          text: "Esch256: Four bytes 0x00010203 (NIST LWC KAT Count=5)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("649D3E5258E504EF842A7176108D36A823E751D5E0EE31E3FAF111415BB9BBC2")
        },
        {
          text: "Esch256: 16 bytes (full rate) (NIST LWC KAT Count=17)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("ACFF841E2A526D83D6E94AB5564D6D64C98F5E8016BB1C2950386ED156C6C174")
        },
        {
          text: "Esch256: 32 bytes (NIST LWC KAT Count=33)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("78B905B2E2D4110B76EF8AFD2495F58AD6FFD6B9727377F3E5DFCEEBF3031E24")
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
      return new Esch256Instance(this);
    }
  }

  /**
   * Esch256 Hash Function Instance
   */
  class Esch256Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // SPARKLE-384 state: 12 words (384 bits)
      this.state = new Array(SPARKLE_384_STATE_SIZE).fill(0);

      // Input buffer for rate bytes
      this.blockWords = new Array(4).fill(0); // 4 words = 16 bytes
      this.blockBytes = new Array(ESCH_256_RATE).fill(0);
      this.count = 0; // Bytes in buffer

      this._outputSize = ESCH_256_HASH_SIZE;
    }

    set outputSize(size) {
      if (size !== ESCH_256_HASH_SIZE) {
        throw new Error(`Invalid output size: ${size} bytes (only 32 supported for Esch256)`);
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
        while (this.count < ESCH_256_RATE && pos < len) {
          this.blockBytes[this.count++] = data[pos++];
        }

        // Process full block ONLY if there's more data coming
        // (the last block is processed in Result() with appropriate domain)
        if (this.count === ESCH_256_RATE && pos < len) {
          // Convert bytes to words (little-endian)
          for (let i = 0; i < 4; ++i) {
            this.blockWords[i] = OpCodes.Pack32LE(
              this.blockBytes[i * 4 + 0],
              this.blockBytes[i * 4 + 1],
              this.blockBytes[i * 4 + 2],
              this.blockBytes[i * 4 + 3]
            );
          }

          // Apply M3 mixing with domain 0x00 (intermediate block)
          esch_256_m3(this.state, this.blockWords, 0x00);

          // Apply SPARKLE-384 with 7 steps (slim)
          sparkle_384(this.state, 7);

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
      if (this.count === ESCH_256_RATE) {
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
        esch_256_m3(this.state, this.blockWords, 0x02);
      } else {
        // Incomplete block: apply padding and domain 0x01
        this.blockBytes[this.count] = 0x80;
        for (let i = this.count + 1; i < ESCH_256_RATE; ++i) {
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
        esch_256_m3(this.state, this.blockWords, 0x01);
      }

      // Apply final SPARKLE-384 with 11 steps (big)
      sparkle_384(this.state, 11);

      // Extract first 16 bytes from state
      const output = new Array(ESCH_256_HASH_SIZE);
      for (let i = 0; i < 4; ++i) {
        const bytes = OpCodes.Unpack32LE(this.state[i]);
        output[i * 4 + 0] = bytes[0];
        output[i * 4 + 1] = bytes[1];
        output[i * 4 + 2] = bytes[2];
        output[i * 4 + 3] = bytes[3];
      }

      // Apply SPARKLE-384 with 7 steps (slim)
      sparkle_384(this.state, 7);

      // Extract next 16 bytes from state
      for (let i = 0; i < 4; ++i) {
        const bytes = OpCodes.Unpack32LE(this.state[i]);
        output[16 + i * 4 + 0] = bytes[0];
        output[16 + i * 4 + 1] = bytes[1];
        output[16 + i * 4 + 2] = bytes[2];
        output[16 + i * 4 + 3] = bytes[3];
      }

      // Reset state for next operation
      this.state.fill(0);
      this.blockWords.fill(0);
      this.blockBytes.fill(0);
      this.count = 0;

      return output;
    }
  }

  RegisterAlgorithm(new Esch256());
  return Esch256;
}));
