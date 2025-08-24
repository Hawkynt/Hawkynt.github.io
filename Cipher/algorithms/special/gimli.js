/*
 * Gimli Cryptographic Permutation Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of Gimli 384-bit permutation
 * Designed for high security and performance across platforms
 * Can be used to construct hash functions or stream ciphers
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        CryptoAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

class GimliAlgorithm extends CryptoAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Gimli";
    this.description = "Cross-platform 384-bit cryptographic permutation designed for high security and performance. Can construct hash functions or stream ciphers using sponge construction. Features 24 rounds with simple operations.";
    this.inventor = "Daniel J. Bernstein, Stefan Kölbl, Stefan Lucks, Pedro Maat Costa Massolino, Florian Mendel, Kashif Nawaz, Tobias Schneider, Peter Schwabe, François-Xavier Standaert, Yosuke Todo, Benoît Viguier";
    this.year = 2017;
    this.category = CategoryType.SPECIAL;
    this.subCategory = "Cryptographic Permutation";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.NL;

    // Algorithm-specific metadata
    this.SupportedInputSizes = [
      new KeySize(48, 48, 0)  // 384-bit input only
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("Gimli Official Site", "https://gimli.cr.yp.to/"),
      new LinkItem("NIST LWC Specification", "https://csrc.nist.gov/CSRC/media/Projects/Lightweight-Cryptography/documents/round-2/spec-doc-rnd2/gimli-spec-round2.pdf"),
      new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/Gimli_(cipher)")
    ];

    this.references = [
      new LinkItem("Original Research Paper", "https://eprint.iacr.org/2017/630"),
      new LinkItem("Java Implementation", "https://github.com/codahale/gimli"),
      new LinkItem("Cryptographic Constructions", "https://github.com/jedisct1/gimli-constructions")
    ];

    // Test vectors from reference implementation
    this.tests = [
      {
        text: "Gimli zero input test vector",
        uri: "https://gimli.cr.yp.to/",
        input: new Array(48).fill(0), // All zeros 384-bit input
        expected: [
          26, 36, 157, 231, 86, 112, 48, 138, 132, 240, 10, 0,
          141, 40, 200, 167, 123, 46, 46, 115, 61, 195, 239, 40,
          118, 47, 25, 229, 108, 161, 50, 86, 198, 38, 212, 241,
          172, 158, 17, 0, 179, 60, 8, 18, 162, 190, 194, 175
        ]
      },
      {
        text: "Gimli test vector from specification",
        uri: "https://csrc.nist.gov/CSRC/media/Projects/Lightweight-Cryptography/documents/round-2/spec-doc-rnd2/gimli-spec-round2.pdf",
        input: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0  // Single bit set
        ],
        expected: [
          157, 152, 248, 4, 10, 89, 41, 86, 202, 130, 98, 54,
          199, 46, 243, 48, 199, 145, 120, 83, 22, 109, 188, 35,
          95, 240, 17, 237, 23, 182, 177, 252, 159, 102, 73, 207,
          12, 113, 103, 241, 168, 220, 157, 100, 140, 128, 215, 235
        ]
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new GimliAlgorithmInstance(this, isInverse);
  }
}

class GimliAlgorithmInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    
    // Gimli constants
    this.ROUNDS = 24;
    this.STATE_SIZE = 48; // 384 bits = 48 bytes
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    this.inputBuffer.push(...data);
  }

  Result() {
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    // Validate input length for Gimli permutation
    if (this.inputBuffer.length !== this.STATE_SIZE) {
      throw new Error(`Gimli requires exactly ${this.STATE_SIZE} bytes (384 bits) input`);
    }

    // Apply Gimli permutation
    const output = this._gimliPermutation([...this.inputBuffer]);

    // Clear input buffer for next operation
    this.inputBuffer = [];
    
    return output;
  }

  _gimliPermutation(state) {
    // Convert bytes to 32-bit words (little-endian)
    const words = new Array(12);
    for (let i = 0; i < 12; i++) {
      words[i] = OpCodes.Pack32LE(
        state[i * 4],
        state[i * 4 + 1],
        state[i * 4 + 2],
        state[i * 4 + 3]
      );
    }

    // Gimli state is organized as 3x4 matrix
    const s = [
      [words[0], words[1], words[2], words[3]],
      [words[4], words[5], words[6], words[7]],
      [words[8], words[9], words[10], words[11]]
    ];

    // Apply 24 rounds
    for (let round = 24; round >= 1; round--) {
      // SP-box (non-linear layer)
      for (let col = 0; col < 4; col++) {
        const x = OpCodes.RotL32(s[0][col], 24);
        const y = OpCodes.RotL32(s[1][col], 9);
        const z = s[2][col];

        s[2][col] = x ^ (z << 1) ^ ((y & z) << 2);
        s[1][col] = y ^ x ^ ((x | z) << 1);
        s[0][col] = z ^ y ^ ((x & y) << 3);
      }

      // Linear layer - Small-Swap (every 4 rounds starting from round 24)
      if (round % 4 === 0) {
        [s[0][0], s[0][1]] = [s[0][1], s[0][0]];
        [s[0][2], s[0][3]] = [s[0][3], s[0][2]];
        
        [s[1][0], s[1][1]] = [s[1][1], s[1][0]];
        [s[1][2], s[1][3]] = [s[1][3], s[1][2]];
      }

      // Linear layer - Big-Swap (every 4 rounds starting from round 22)
      if (round % 4 === 2) {
        [s[0][0], s[0][2]] = [s[0][2], s[0][0]];
        [s[0][1], s[0][3]] = [s[0][3], s[0][1]];
        
        [s[1][0], s[1][2]] = [s[1][2], s[1][0]];
        [s[1][1], s[1][3]] = [s[1][3], s[1][1]];
      }

      // Add round constant to first word of first column
      if (round % 4 === 0) {
        s[0][0] ^= (2654943488 | round); // Round constant
      }
    }

    // Convert back to bytes (little-endian)
    const result = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const bytes = OpCodes.Unpack32LE(s[row][col]);
        result.push(...bytes);
      }
    }

    return result;
  }
}

// Register the algorithm
RegisterAlgorithm(new GimliAlgorithm());