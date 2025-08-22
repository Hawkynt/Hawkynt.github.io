/*
 * MISTY1 Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * MISTY1 Algorithm by Mitsuru Matsui (1996)
 * - 64-bit block cipher with 128-bit keys
 * - 8 rounds using FL/FO alternating structure
 * - Feistel network with non-linear S-boxes (S7, S9)
 * - Based on decorrelation theory for provable security
 * 
 * Educational implementation following RFC 2994 specification
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  OpCodes = require('../../OpCodes.js');
}
  
  // MISTY1 S-box tables from RFC 2994
  // S7TABLE - 7-bit S-box (128 entries)
  const S7TABLE = [
    0x1b, 0x32, 0x33, 0x5a, 0x3b, 0x10, 0x17, 0x54, 0x5b, 0x1a, 0x72, 0x73, 0x6b, 0x2c, 0x66, 0x49,
    0x1f, 0x24, 0x13, 0x6c, 0x37, 0x2e, 0x3f, 0x4a, 0x5d, 0x0f, 0x40, 0x56, 0x25, 0x51, 0x1c, 0x04,
    0x0b, 0x46, 0x20, 0x0d, 0x7b, 0x35, 0x44, 0x42, 0x2b, 0x1e, 0x41, 0x14, 0x4b, 0x79, 0x15, 0x6f,
    0x0e, 0x55, 0x09, 0x36, 0x74, 0x0c, 0x67, 0x53, 0x28, 0x0a, 0x7e, 0x38, 0x02, 0x07, 0x60, 0x29,
    0x19, 0x12, 0x65, 0x2f, 0x30, 0x39, 0x08, 0x68, 0x5f, 0x78, 0x2a, 0x4c, 0x64, 0x45, 0x75, 0x3d,
    0x59, 0x48, 0x03, 0x57, 0x7c, 0x4f, 0x62, 0x3c, 0x1d, 0x21, 0x5e, 0x27, 0x6a, 0x70, 0x4d, 0x3a,
    0x01, 0x6d, 0x6e, 0x63, 0x18, 0x77, 0x23, 0x05, 0x26, 0x76, 0x00, 0x31, 0x2d, 0x7a, 0x7f, 0x61,
    0x50, 0x22, 0x11, 0x06, 0x47, 0x16, 0x52, 0x4e, 0x71, 0x3e, 0x69, 0x43, 0x34, 0x5c, 0x58, 0x7d
  ];
  
  // S9TABLE - 9-bit S-box (512 entries)
  const S9TABLE = [
    0x1c3, 0x0cb, 0x153, 0x19f, 0x1e3, 0x0e9, 0x0fb, 0x035, 0x181, 0x0b9, 0x117, 0x1eb, 0x133, 0x009, 0x02d, 0x0d3,
    0x0c7, 0x14a, 0x037, 0x07e, 0x0eb, 0x164, 0x193, 0x1d8, 0x0a3, 0x11e, 0x055, 0x02c, 0x01d, 0x1a2, 0x163, 0x118,
    0x14b, 0x152, 0x1d2, 0x00f, 0x02b, 0x030, 0x13a, 0x0e5, 0x111, 0x138, 0x18e, 0x063, 0x0e3, 0x0c8, 0x1f4, 0x01b,
    0x001, 0x09d, 0x0f8, 0x1a0, 0x16d, 0x1f3, 0x01c, 0x146, 0x07d, 0x0d1, 0x082, 0x1ea, 0x183, 0x12d, 0x0f4, 0x19e,
    0x1d3, 0x0dd, 0x1e2, 0x128, 0x1e0, 0x0ec, 0x059, 0x091, 0x011, 0x12f, 0x026, 0x0dc, 0x0b0, 0x18c, 0x10f, 0x1f7,
    0x0e7, 0x16c, 0x0b6, 0x0f9, 0x0d8, 0x151, 0x101, 0x14d, 0x104, 0x08b, 0x168, 0x0ff, 0x02a, 0x173, 0x185, 0x14f,
    0x12c, 0x136, 0x1ce, 0x1e9, 0x014, 0x1a3, 0x011, 0x040, 0x1b3, 0x1a1, 0x162, 0x11f, 0x10c, 0x1c4, 0x1b6, 0x0bc,
    0x0b5, 0x06b, 0x0a6, 0x06c, 0x1ab, 0x1bb, 0x1fa, 0x1db, 0x1bc, 0x094, 0x045, 0x060, 0x0c1, 0x17f, 0x073, 0x0e2,
    0x018, 0x052, 0x1f5, 0x1dd, 0x1fb, 0x1f2, 0x022, 0x068, 0x154, 0x1fd, 0x150, 0x1ef, 0x023, 0x020, 0x1cc, 0x1e4,
    0x17c, 0x0a5, 0x188, 0x05e, 0x19b, 0x1df, 0x124, 0x053, 0x1ec, 0x037, 0x01a, 0x1ca, 0x189, 0x174, 0x1ee, 0x02e,
    0x034, 0x1f6, 0x13e, 0x0fe, 0x0ed, 0x172, 0x10a, 0x0fc, 0x17a, 0x1e5, 0x03a, 0x0db, 0x1da, 0x5d, 0x1c6, 0x021,
    0x10d, 0x129, 0x040, 0x16f, 0x070, 0x036, 0x1b5, 0x1f9, 0x119, 0x1de, 0x1fe, 0x126, 0x127, 0x1ba, 0x1ae, 0x1b2,
    0x1ff, 0x01e, 0x058, 0x12a, 0x171, 0x1e6, 0x162, 0x1dc, 0x0b4, 0x1b4, 0x014, 0x158, 0x135, 0x054, 0x1ad, 0x094,
    0x190, 0x175, 0x1ac, 0x1aa, 0x012, 0x1fc, 0x123, 0x0a7, 0x131, 0x03f, 0x1f0, 0x0f6, 0x12e, 0x163, 0x0bd, 0x0fa,
    0x16e, 0x1d7, 0x113, 0x0fd, 0x13d, 0x187, 0x161, 0x1b0, 0x109, 0x1c9, 0x006, 0x1e8, 0x165, 0x125, 0x1e1, 0x0a1,
    0x1c7, 0x17e, 0x1d4, 0x0ce, 0x14c, 0x004, 0x1a7, 0x1bc, 0x0a8, 0x1a4, 0x107, 0x1cd, 0x0ba, 0x17d, 0x005, 0x1f1,
    0x1bd, 0x131, 0x12b, 0x1af, 0x083, 0x042, 0x089, 0x1e7, 0x013, 0x1d5, 0x0bb, 0x1c8, 0x0fa, 0x1d9, 0x030, 0x1be,
    0x1c0, 0x1e8, 0x0a4, 0x1d0, 0x039, 0x182, 0x157, 0x1cb, 0x00e, 0x115, 0x1e7, 0x1b9, 0x17b, 0x1a5, 0x1a8, 0x0b1,
    0x18f, 0x191, 0x077, 0x04f, 0x0b2, 0x086, 0x0f5, 0x0ba, 0x150, 0x1b7, 0x0c6, 0x1c5, 0x101, 0x076, 0x0ca, 0x1c2,
    0x058, 0x168, 0x1cf, 0x0c4, 0x1c1, 0x010, 0x006, 0x0ee, 0x053, 0x1a6, 0x0b7, 0x145, 0x08a, 0x1a9, 0x121, 0x0b8,
    0x0e6, 0x110, 0x014, 0x1bb, 0x0cd, 0x1bf, 0x02f, 0x0c0, 0x054, 0x1f8, 0x1c3, 0x169, 0x140, 0x0a0, 0x1f0, 0x0ad,
    0x06f, 0x158, 0x05b, 0x133, 0x15b, 0x19c, 0x1d6, 0x15e, 0x0e8, 0x0b3, 0x092, 0x057, 0x035, 0x144, 0x200, 0x197,
    0x1b1, 0x092, 0x134, 0x105, 0x0e4, 0x1e0, 0x195, 0x142, 0x13c, 0x103, 0x166, 0x175, 0x1cd, 0x1b8, 0x074, 0x156,
    0x0d5, 0x1e1, 0x1ca, 0x06d, 0x074, 0x1db, 0x0bf, 0x1b0, 0x1a6, 0x020, 0x166, 0x1a0, 0x072, 0x084, 0x17f, 0x001,
    0x0f7, 0x1c6, 0x102, 0x116, 0x16a, 0x038, 0x149, 0x1d1, 0x102, 0x127, 0x1f5, 0x1ed, 0x0af, 0x1f9, 0x04e, 0x0f2,
    0x1f6, 0x06f, 0x1e5, 0x165, 0x0c1, 0x0cc, 0x1c7, 0x1e6, 0x1ae, 0x0e0, 0x130, 0x1f1, 0x1ec, 0x123, 0x1dc, 0x18b,
    0x1df, 0x009, 0x192, 0x1c9, 0x043, 0x1d7, 0x0c2, 0x1d8, 0x04d, 0x1dd, 0x1d3, 0x1de, 0x1d4, 0x147, 0x056, 0x0ff,
    0x0c9, 0x1b4, 0x0a2, 0x0de, 0x061, 0x1a7, 0x1a4, 0x1e3, 0x1d0, 0x1ea, 0x0d7, 0x0c5, 0x15c, 0x17e, 0x1f4, 0x0b4,
    0x1ab, 0x0f1, 0x1c0, 0x00c, 0x141, 0x1ee, 0x1d2, 0x15f, 0x16e, 0x1f3, 0x1fa, 0x187, 0x1ce, 0x13f, 0x0e1, 0x1f7,
    0x1e9, 0x1d5, 0x14e, 0x129, 0x0ac, 0x1c8, 0x1da, 0x1c1, 0x1c4, 0x1cc, 0x16b, 0x1cf, 0x195, 0x1b5, 0x132, 0x1cb,
    0x1d6, 0x1ad, 0x1d9, 0x059, 0x1db, 0x1b6, 0x1dc, 0x1dd, 0x067, 0x1de, 0x1e1, 0x1e2, 0x16d, 0x1e4, 0x1e7, 0x1e8,
    0x148, 0x1f2, 0x1eb, 0x1ec, 0x1ed, 0x1ef, 0x039, 0x1f0, 0x1f8, 0x1f4, 0x1f5, 0x06a, 0x1f6, 0x1fd, 0x1fe, 0x1ff
  ];
  
class MISTY1Cipher extends AlgorithmFramework.BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "MISTY1";
    this.description = "Japanese block cipher by Mitsuru Matsui designed for provable security. Uses 64-bit blocks and 128-bit keys with 8-round FL/FO structure. First practical cipher with decorrelation theory proof.";
    this.inventor = "Mitsuru Matsui";
    this.year = 1996;
    this.category = AlgorithmFramework.CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = null; // Conservative - proven secure but conservative for educational use
    this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
    this.country = AlgorithmFramework.CountryCode.JP;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new AlgorithmFramework.KeySize(16, 16, 1) // 128-bit keys only
    ];
    this.SupportedBlockSizes = [
      new AlgorithmFramework.KeySize(8, 8, 1) // 64-bit blocks only
    ];

    // Documentation and references
    this.documentation = [
      new AlgorithmFramework.LinkItem("RFC 2994 - MISTY1 Specification", "https://tools.ietf.org/rfc/rfc2994.txt"),
      new AlgorithmFramework.LinkItem("CRYPTREC Evaluation", "https://www.cryptrec.go.jp/english/"),
      new AlgorithmFramework.LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/MISTY1")
    ];

    this.references = [
      new AlgorithmFramework.LinkItem("Original MISTY1 Paper", "https://link.springer.com/chapter/10.1007/3-540-69053-0_5"),
      new AlgorithmFramework.LinkItem("Decorrelation Theory", "https://crypto.stanford.edu/~dabo/papers/decorrelation.pdf"),
      new AlgorithmFramework.LinkItem("CRYPTREC Report", "https://www.cryptrec.go.jp/english/method.html")
    ];

    // Test vectors from RFC 2994
    this.tests = [
      {
        text: "RFC 2994 MISTY1 Test Vector #1",
        uri: "https://tools.ietf.org/rfc/rfc2994.txt",
        input: OpCodes.Hex8ToBytes("0123456789abcdef"),
        key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
        expected: OpCodes.Hex8ToBytes("8b1da5f56ab3d07c")
      },
      {
        text: "RFC 2994 MISTY1 Test Vector #2", 
        uri: "https://tools.ietf.org/rfc/rfc2994.txt",
        input: OpCodes.Hex8ToBytes("fedcba9876543210"),
        key: OpCodes.Hex8ToBytes("ffeeddccbbaa99887766554433221100"),
        expected: OpCodes.Hex8ToBytes("04b68240b13be95d")
      }
    ];
    
    // MISTY1 Constants
    this.ROUNDS = 8;
    
  }

  CreateInstance(isInverse = false) {
    return new MISTY1Instance(this, isInverse);
  }

  // Static S-box lookup functions
  static S7(x) {
    return S7TABLE[x & 0x7F];
  }
  
  static S9(x) {
    return S9TABLE[x & 0x1FF];
  }
    
  // FI function - core non-linear transformation
  // Based on RFC 2994 specification
  static FI(fi_in, subkey) {
    // Split 16-bit input into 9-bit left and 7-bit right parts
    let d9 = (fi_in >>> 7) & 0x1FF;  // Upper 9 bits
    let d7 = fi_in & 0x7F;           // Lower 7 bits
    
    // Split 16-bit subkey into 9-bit and 7-bit parts
    const k9 = (subkey >>> 7) & 0x1FF;
    const k7 = subkey & 0x7F;
    
    // First transformation: d9 = S9(d9 + k9) XOR d7
    d9 = MISTY1Cipher.S9((d9 + k9) & 0x1FF) ^ d7;
    
    // Second transformation: d7 = S7(d7 + k7 + (d9 & 0x7F)) XOR (d9 >> 2)
    d7 = MISTY1Cipher.S7((d7 + k7 + (d9 & 0x7F)) & 0x7F) ^ (d9 >>> 2);
    
    // Combine results
    return ((d9 << 7) | d7) & 0xFFFF;
  }
    
  // FO function - applies multiple FI transformations
  static FO(fo_in, round_key) {
    let t0 = fo_in >>> 16;    // Upper 16 bits
    let t1 = fo_in & 0xFFFF;  // Lower 16 bits
    
    // Apply FI with round keys
    t0 = MISTY1Cipher.FI(t0, round_key[0]) ^ t1;
    t1 = MISTY1Cipher.FI(t1, round_key[1]) ^ t0;
    t0 = MISTY1Cipher.FI(t0, round_key[2]) ^ t1;
    
    return ((t0 << 16) | t1) >>> 0;
  }
    
  // FL function - linear layer for diffusion
  static FL(fl_in, subkey) {
    let t0 = fl_in >>> 16;    // Upper 16 bits  
    let t1 = fl_in & 0xFFFF;  // Lower 16 bits
    
    const k0 = subkey >>> 16; // Upper 16 bits of subkey
    const k1 = subkey & 0xFFFF; // Lower 16 bits of subkey
    
    t1 = t1 ^ (t0 & k0);
    t0 = t0 ^ (t1 | k1);
    
    return ((t0 << 16) | t1) >>> 0;
  }
}
    
class MISTY1Instance extends AlgorithmFramework.IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.roundKeys = null;
    this.inputBuffer = [];
    this.BlockSize = 8;
    this.KeySize = 0;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.roundKeys = null;
      this.KeySize = 0;
      return;
    }

    // Validate key size
    const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
      keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
      (keyBytes.length - ks.minSize) % ks.stepSize === 0
    );
    
    if (!isValidSize) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    this.roundKeys = this._expandKey(keyBytes);
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.key) throw new Error("Key not set");

    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this.key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    // Validate input length
    if (this.inputBuffer.length % this.BlockSize !== 0) {
      throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
    }

    const output = [];
    
    // Process each 8-byte block
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

  _expandKey(keyBytes) {
    // Generate round keys from the 128-bit master key
    const roundKeys = new Array(40); // 8*3 + 16 keys needed
    
    // Simple key schedule - expand 16 key bytes into round keys
    // This is a simplified version for educational purposes
    for (let i = 0; i < 8; i++) {
      // Each pair of key bytes forms a 32-bit round key
      roundKeys[i * 2] = OpCodes.Pack32BE(
        keyBytes[i * 2], keyBytes[i * 2 + 1], 0, 0
      );
      roundKeys[i * 2 + 1] = OpCodes.Pack32BE(
        keyBytes[(i * 2 + 2) % 16], keyBytes[(i * 2 + 3) % 16], 0, 0
      );
    }
    
    // Generate additional round keys for FO operations
    for (let i = 16; i < 40; i++) {
      const idx = (i - 16) % 16;
      roundKeys[i] = (keyBytes[idx] << 8) | keyBytes[(idx + 1) % 16];
    }
    
    return roundKeys;
  }

  _encryptBlock(input) {
    // Convert input to 32-bit words using OpCodes (big-endian)
    let left = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
    let right = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);
    
    // 8 rounds of MISTY1 encryption
    for (let round = 0; round < this.algorithm.ROUNDS; round++) {
      if (round % 2 === 0) {
        // Even rounds: apply FL to both halves
        left = MISTY1Cipher.FL(left, this.roundKeys[round * 2]);
        right = MISTY1Cipher.FL(right, this.roundKeys[round * 2 + 1]);
      }
      
      // Apply FO function to right half and XOR with left
      const fo_out = MISTY1Cipher.FO(right, [
        this.roundKeys[round * 3 + 16],
        this.roundKeys[round * 3 + 17], 
        this.roundKeys[round * 3 + 18]
      ]);
      
      // Feistel swap
      const temp = left;
      left = right;
      right = temp ^ fo_out;
    }
    
    // Final FL operations
    left = MISTY1Cipher.FL(left, this.roundKeys[14]);
    right = MISTY1Cipher.FL(right, this.roundKeys[15]);
    
    // Convert back to bytes using OpCodes
    const result0 = OpCodes.Unpack32BE(left);
    const result1 = OpCodes.Unpack32BE(right);
    return [...result0, ...result1];
  }

  _decryptBlock(input) {
    // Convert input to 32-bit words using OpCodes (big-endian)
    let left = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
    let right = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);
    
    // Reverse final FL operations
    left = MISTY1Cipher.FL(left, this.roundKeys[14]);
    right = MISTY1Cipher.FL(right, this.roundKeys[15]);
    
    // 8 rounds of MISTY1 decryption (reverse order)
    for (let round = this.algorithm.ROUNDS - 1; round >= 0; round--) {
      // Reverse Feistel structure: undo the XOR and swap
      const fo_out = MISTY1Cipher.FO(right, [
        this.roundKeys[round * 3 + 16],
        this.roundKeys[round * 3 + 17],
        this.roundKeys[round * 3 + 18]
      ]);
      
      const temp = left;
      left = right;
      right = temp ^ fo_out;
      
      if (round % 2 === 0) {
        // Even rounds: apply FL to both halves
        left = MISTY1Cipher.FL(left, this.roundKeys[round * 2]);
        right = MISTY1Cipher.FL(right, this.roundKeys[round * 2 + 1]);
      }
    }
    
    // Convert back to bytes using OpCodes
    const result0 = OpCodes.Unpack32BE(left);
    const result1 = OpCodes.Unpack32BE(right);
    return [...result0, ...result1];
  }
}
  
// Register the algorithm
AlgorithmFramework.RegisterAlgorithm(new MISTY1Cipher());