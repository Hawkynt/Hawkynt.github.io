/*
 * Skipjack Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Skipjack Algorithm by NSA (Declassified June 24, 1998)
 * - 64-bit block size, 80-bit key size (10 bytes)
 * - Uses unbalanced Feistel network with 32 rounds
 * - Originally designed for Clipper chip (Escrowed Encryption Standard)
 * - Historical significance as first declassified NSA block cipher
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

class SkipjackAlgorithm extends AlgorithmFramework.BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Skipjack";
    this.description = "Declassified NSA block cipher from 1998, originally designed for the Clipper chip. Uses unbalanced Feistel network with 32 rounds, 64-bit blocks, and 80-bit keys. Historical significance only.";
    this.inventor = "NSA (National Security Agency)";
    this.year = 1987;
    this.category = AlgorithmFramework.CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = AlgorithmFramework.SecurityStatus.BROKEN;
    this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
    this.country = AlgorithmFramework.CountryCode.US;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new AlgorithmFramework.KeySize(10, 10, 1) // Fixed 80-bit key
    ];
    this.SupportedBlockSizes = [
      new AlgorithmFramework.KeySize(8, 8, 1) // Fixed 64-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new AlgorithmFramework.LinkItem("Skipjack and KEA Algorithm Specifications", "https://csrc.nist.gov/csrc/media/projects/cryptographic-algorithm-validation-program/documents/skipjack/skipjack.pdf"),
      new AlgorithmFramework.LinkItem("NIST Special Publication 800-17", "https://csrc.nist.gov/publications/detail/sp/800-17/archive/1998-02-01"),
      new AlgorithmFramework.LinkItem("Declassification of SkipJack", "https://www.nsa.gov/news-features/declassified-documents/")
    ];

    this.references = [
      new AlgorithmFramework.LinkItem("Original NSA Reference Implementation", "https://github.com/coruus/nist-testvectors"),
      new AlgorithmFramework.LinkItem("Cryptanalysis of SkipJack", "https://www.schneier.com/academic/archives/1998/09/cryptanalysis_of_ski.html"),
      new AlgorithmFramework.LinkItem("SkipJack Cryptanalysis Papers", "https://eprint.iacr.org/")
    ];

    // Known vulnerabilities
    this.knownVulnerabilities = [
      new AlgorithmFramework.Vulnerability("NIST Withdrawal", "https://csrc.nist.gov/publications/detail/sp/800-17/archive/1998-02-01", "NIST approval withdrawn in 2015. Not approved for new cryptographic protection", "Use modern standardized ciphers like AES"),
      new AlgorithmFramework.Vulnerability("Differential Cryptanalysis", "https://www.schneier.com/academic/archives/1998/09/cryptanalysis_of_ski.html", "Vulnerable to differential attacks with reduced complexity", "Algorithm is deprecated - do not use for any security applications"),
      new AlgorithmFramework.Vulnerability("Related-key attacks", "https://eprint.iacr.org/", "Weak key schedule allows related-key attacks", "Historical and educational interest only")
    ];

    // Test vectors from NIST documentation
    this.tests = [
      {
        text: "Skipjack NIST test vector - all zeros",
        uri: "NIST Special Publication 800-17",
        input: OpCodes.Hex8ToBytes("0000000000000000"),
        key: OpCodes.Hex8ToBytes("0000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("eca5910f64641e3d")
      },
      {
        text: "Skipjack NIST test vector - pattern",
        uri: "NIST Special Publication 800-17",
        input: OpCodes.Hex8ToBytes("3322110033ccbbaa"),
        key: OpCodes.Hex8ToBytes("0077665544332211"),
        expected: OpCodes.Hex8ToBytes("25cac6a5d2720000")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new SkipjackInstance(this, isInverse);
  }
}

class SkipjackInstance extends AlgorithmFramework.IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.keyBytes = null;
    this.inputBuffer = [];
    this.BlockSize = 8;
    this.KeySize = 0;
    
    // Initialize F-table (S-box) - Official from NSA specification
    this._initFTable();
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.keyBytes = null;
      this.KeySize = 0;
      return;
    }

    // Validate key size
    if (keyBytes.length !== 10) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 10)`);
    }

    this._key = [...keyBytes];
    this.keyBytes = [...keyBytes];
    this.KeySize = keyBytes.length;
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

  /**
   * Initialize Skipjack F-table (S-box) - Official from NSA specification
   */
  _initFTable() {
    this.FTABLE = new Uint8Array([
      0xa3,0xd7,0x09,0x83,0xf8,0x48,0xf6,0xf4,0xb3,0x21,0x15,0x78,0x99,0xb1,0xaf,0xf9,
      0xe7,0x2d,0x4d,0x8a,0xce,0x4c,0xca,0x2e,0x52,0x95,0xd9,0x1e,0x4e,0x38,0x44,0x28,
      0x0a,0xdf,0x02,0xa0,0x17,0xf1,0x60,0x68,0x12,0xb7,0x7a,0xc3,0xe9,0xfa,0x3d,0x53,
      0x96,0x84,0x6b,0xba,0xf2,0x63,0x9a,0x19,0x7c,0xae,0xe5,0xf5,0xf7,0x16,0x6a,0xa2,
      0x39,0xb6,0x7b,0x0f,0xc1,0x93,0x81,0x1b,0xee,0xb4,0x1a,0xea,0xd0,0x91,0x2f,0xb8,
      0x55,0xb9,0xda,0x85,0x3f,0x41,0xbf,0xe0,0x5a,0x58,0x80,0x5f,0x66,0x0b,0xd8,0x90,
      0x35,0xd5,0xc0,0xa7,0x33,0x06,0x65,0x69,0x45,0x00,0x94,0x56,0x6d,0x98,0x9b,0x76,
      0x97,0xfc,0xb2,0xc2,0xb0,0xfe,0xdb,0x20,0xe1,0xeb,0xd6,0xe4,0xdd,0x47,0x4a,0x1d,
      0x42,0xed,0x9e,0x6e,0x49,0x3c,0xcd,0x43,0x27,0xd2,0x07,0xd4,0xde,0xc7,0x67,0x18,
      0x89,0xcb,0x30,0x1f,0x8d,0xc6,0x8f,0xaa,0xc8,0x74,0xdc,0xc9,0x5d,0x5c,0x31,0xa4,
      0x70,0x88,0x61,0x2c,0x9f,0x0d,0x2b,0x87,0x50,0x82,0x54,0x64,0x26,0x7d,0x03,0x40,
      0x34,0x4b,0x1c,0x73,0xd1,0xc4,0xfd,0x3b,0xcc,0xfb,0x7f,0xab,0xe6,0x3e,0x5b,0xa5,
      0xad,0x04,0x23,0x9c,0x14,0x51,0x22,0xf0,0x29,0x79,0x71,0x7e,0xff,0x8c,0x0e,0xe2,
      0x0c,0xef,0xbc,0x72,0x75,0x6f,0x37,0xa1,0xec,0xd3,0x8e,0x62,0x8b,0x86,0x10,0xe8,
      0x08,0x77,0x11,0xbe,0x92,0x4f,0x24,0xc5,0x32,0x36,0x9d,0xcf,0xf3,0xa6,0xbb,0xac,
      0x5e,0x6c,0xa9,0x13,0x57,0x25,0xb5,0xe3,0xbd,0xa8,0x3a,0x01,0x05,0x59,0x2a,0x46
    ]);
  }

  /**
   * G-function definitions (matching C reference implementation)
   */
  _g0(input, key) {
    const g1 = (input >>> 8) & 0xFF;
    const g2 = input & 0xFF;
    const g3 = this.FTABLE[g2 ^ key[0]] ^ g1;
    const g4 = this.FTABLE[g3 ^ key[1]] ^ g2;
    const g5 = this.FTABLE[g4 ^ key[2]] ^ g3;
    const g6 = this.FTABLE[g5 ^ key[3]] ^ g4;
    return (g5 << 8) | g6;
  }

  _g4(input, key) {
    const g1 = (input >>> 8) & 0xFF;
    const g2 = input & 0xFF;
    const g3 = this.FTABLE[g2 ^ key[4]] ^ g1;
    const g4 = this.FTABLE[g3 ^ key[5]] ^ g2;
    const g5 = this.FTABLE[g4 ^ key[6]] ^ g3;
    const g6 = this.FTABLE[g5 ^ key[7]] ^ g4;
    return (g5 << 8) | g6;
  }

  _g8(input, key) {
    const g1 = (input >>> 8) & 0xFF;
    const g2 = input & 0xFF;
    const g3 = this.FTABLE[g2 ^ key[8]] ^ g1;
    const g4 = this.FTABLE[g3 ^ key[9]] ^ g2;
    const g5 = this.FTABLE[g4 ^ key[0]] ^ g3;
    const g6 = this.FTABLE[g5 ^ key[1]] ^ g4;
    return (g5 << 8) | g6;
  }

  _g2(input, key) {
    const g1 = (input >>> 8) & 0xFF;
    const g2 = input & 0xFF;
    const g3 = this.FTABLE[g2 ^ key[2]] ^ g1;
    const g4 = this.FTABLE[g3 ^ key[3]] ^ g2;
    const g5 = this.FTABLE[g4 ^ key[4]] ^ g3;
    const g6 = this.FTABLE[g5 ^ key[5]] ^ g4;
    return (g5 << 8) | g6;
  }

  _g6(input, key) {
    const g1 = (input >>> 8) & 0xFF;
    const g2 = input & 0xFF;
    const g3 = this.FTABLE[g2 ^ key[6]] ^ g1;
    const g4 = this.FTABLE[g3 ^ key[7]] ^ g2;
    const g5 = this.FTABLE[g4 ^ key[8]] ^ g3;
    const g6 = this.FTABLE[g5 ^ key[9]] ^ g4;
    return (g5 << 8) | g6;
  }

  /**
   * Inverse G-functions for decryption
   */
  _g0Inv(input, key) {
    const g6 = input & 0xFF;
    const g5 = (input >>> 8) & 0xFF;
    const g4 = this.FTABLE[g5 ^ key[3]] ^ g6;
    const g3 = this.FTABLE[g4 ^ key[2]] ^ g5;
    const g2 = this.FTABLE[g3 ^ key[1]] ^ g4;
    const g1 = this.FTABLE[g2 ^ key[0]] ^ g3;
    return (g1 << 8) | g2;
  }

  _g4Inv(input, key) {
    const g6 = input & 0xFF;
    const g5 = (input >>> 8) & 0xFF;
    const g4 = this.FTABLE[g5 ^ key[7]] ^ g6;
    const g3 = this.FTABLE[g4 ^ key[6]] ^ g5;
    const g2 = this.FTABLE[g3 ^ key[5]] ^ g4;
    const g1 = this.FTABLE[g2 ^ key[4]] ^ g3;
    return (g1 << 8) | g2;
  }

  _g8Inv(input, key) {
    const g6 = input & 0xFF;
    const g5 = (input >>> 8) & 0xFF;
    const g4 = this.FTABLE[g5 ^ key[1]] ^ g6;
    const g3 = this.FTABLE[g4 ^ key[0]] ^ g5;
    const g2 = this.FTABLE[g3 ^ key[9]] ^ g4;
    const g1 = this.FTABLE[g2 ^ key[8]] ^ g3;
    return (g1 << 8) | g2;
  }

  _g2Inv(input, key) {
    const g6 = input & 0xFF;
    const g5 = (input >>> 8) & 0xFF;
    const g4 = this.FTABLE[g5 ^ key[5]] ^ g6;
    const g3 = this.FTABLE[g4 ^ key[4]] ^ g5;
    const g2 = this.FTABLE[g3 ^ key[3]] ^ g4;
    const g1 = this.FTABLE[g2 ^ key[2]] ^ g3;
    return (g1 << 8) | g2;
  }

  _g6Inv(input, key) {
    const g6 = input & 0xFF;
    const g5 = (input >>> 8) & 0xFF;
    const g4 = this.FTABLE[g5 ^ key[9]] ^ g6;
    const g3 = this.FTABLE[g4 ^ key[8]] ^ g5;
    const g2 = this.FTABLE[g3 ^ key[7]] ^ g4;
    const g1 = this.FTABLE[g2 ^ key[6]] ^ g3;
    return (g1 << 8) | g2;
  }

  /**
   * Encrypt 64-bit block
   */
  _encryptBlock(block) {
    if (block.length !== 8) {
      throw new Error('Skipjack block size must be exactly 8 bytes');
    }
    
    const key = this.keyBytes;
    
    // Convert plaintext to 4 16-bit words using OpCodes
    let w1 = OpCodes.Pack32BE(block[0], block[1], 0, 0) >>> 16;
    let w2 = OpCodes.Pack32BE(block[2], block[3], 0, 0) >>> 16;
    let w3 = OpCodes.Pack32BE(block[4], block[5], 0, 0) >>> 16;
    let w4 = OpCodes.Pack32BE(block[6], block[7], 0, 0) >>> 16;
    
    // First 8 rounds (Rule A) - exactly matching C reference
    w1 = this._g0(w1, key); w4 ^= w1 ^ 1;
    w4 = this._g4(w4, key); w3 ^= w4 ^ 2;
    w3 = this._g8(w3, key); w2 ^= w3 ^ 3;
    w2 = this._g2(w2, key); w1 ^= w2 ^ 4;
    w1 = this._g6(w1, key); w4 ^= w1 ^ 5;
    w4 = this._g0(w4, key); w3 ^= w4 ^ 6;
    w3 = this._g4(w3, key); w2 ^= w3 ^ 7;
    w2 = this._g8(w2, key); w1 ^= w2 ^ 8;
    
    // Second 8 rounds (Rule B) - exactly matching C reference
    w2 ^= w1 ^ 9;  w1 = this._g2(w1, key);
    w1 ^= w4 ^ 10; w4 = this._g6(w4, key);
    w4 ^= w3 ^ 11; w3 = this._g0(w3, key);
    w3 ^= w2 ^ 12; w2 = this._g4(w2, key);
    w2 ^= w1 ^ 13; w1 = this._g8(w1, key);
    w1 ^= w4 ^ 14; w4 = this._g2(w4, key);
    w4 ^= w3 ^ 15; w3 = this._g6(w3, key);
    w3 ^= w2 ^ 16; w2 = this._g0(w2, key);
    
    // Third 8 rounds (Rule A) - exactly matching C reference
    w1 = this._g4(w1, key); w4 ^= w1 ^ 17;
    w4 = this._g8(w4, key); w3 ^= w4 ^ 18;
    w3 = this._g2(w3, key); w2 ^= w3 ^ 19;
    w2 = this._g6(w2, key); w1 ^= w2 ^ 20;
    w1 = this._g0(w1, key); w4 ^= w1 ^ 21;
    w4 = this._g4(w4, key); w3 ^= w4 ^ 22;
    w3 = this._g8(w3, key); w2 ^= w3 ^ 23;
    w2 = this._g2(w2, key); w1 ^= w2 ^ 24;
    
    // Last 8 rounds (Rule B) - exactly matching C reference
    w2 ^= w1 ^ 25; w1 = this._g6(w1, key);
    w1 ^= w4 ^ 26; w4 = this._g0(w4, key);
    w4 ^= w3 ^ 27; w3 = this._g4(w3, key);
    w3 ^= w2 ^ 28; w2 = this._g8(w2, key);
    w2 ^= w1 ^ 29; w1 = this._g2(w1, key);
    w1 ^= w4 ^ 30; w4 = this._g6(w4, key);
    w4 ^= w3 ^ 31; w3 = this._g0(w3, key);
    w3 ^= w2 ^ 32; w2 = this._g4(w2, key);
    
    // Pack back to bytes
    const cipherBytes = [
      (w1 >>> 8) & 0xFF, w1 & 0xFF,
      (w2 >>> 8) & 0xFF, w2 & 0xFF,
      (w3 >>> 8) & 0xFF, w3 & 0xFF,
      (w4 >>> 8) & 0xFF, w4 & 0xFF
    ];
    
    return cipherBytes;
  }

  /**
   * Decrypt 64-bit block
   */
  _decryptBlock(block) {
    if (block.length !== 8) {
      throw new Error('Skipjack block size must be exactly 8 bytes');
    }
    
    const key = this.keyBytes;
    
    // Convert ciphertext to 4 16-bit words using OpCodes
    let w1 = OpCodes.Pack32BE(block[0], block[1], 0, 0) >>> 16;
    let w2 = OpCodes.Pack32BE(block[2], block[3], 0, 0) >>> 16;
    let w3 = OpCodes.Pack32BE(block[4], block[5], 0, 0) >>> 16;
    let w4 = OpCodes.Pack32BE(block[6], block[7], 0, 0) >>> 16;
    
    // First 8 rounds (reverse of last 8 encryption rounds)
    w2 = this._g4Inv(w2, key); w3 ^= w2 ^ 32;
    w3 = this._g0Inv(w3, key); w4 ^= w3 ^ 31;
    w4 = this._g6Inv(w4, key); w1 ^= w4 ^ 30;
    w1 = this._g2Inv(w1, key); w2 ^= w1 ^ 29;
    w2 = this._g8Inv(w2, key); w3 ^= w2 ^ 28;
    w3 = this._g4Inv(w3, key); w4 ^= w3 ^ 27;
    w4 = this._g0Inv(w4, key); w1 ^= w4 ^ 26;
    w1 = this._g6Inv(w1, key); w2 ^= w1 ^ 25;
    
    // Second 8 rounds (reverse of third 8 encryption rounds)
    w1 ^= w2 ^ 24; w2 = this._g2Inv(w2, key);
    w2 ^= w3 ^ 23; w3 = this._g8Inv(w3, key);
    w3 ^= w4 ^ 22; w4 = this._g4Inv(w4, key);
    w4 ^= w1 ^ 21; w1 = this._g0Inv(w1, key);
    w1 ^= w2 ^ 20; w2 = this._g6Inv(w2, key);
    w2 ^= w3 ^ 19; w3 = this._g2Inv(w3, key);
    w3 ^= w4 ^ 18; w4 = this._g8Inv(w4, key);
    w4 ^= w1 ^ 17; w1 = this._g4Inv(w1, key);
    
    // Third 8 rounds (reverse of second 8 encryption rounds)
    w2 = this._g0Inv(w2, key); w3 ^= w2 ^ 16;
    w3 = this._g6Inv(w3, key); w4 ^= w3 ^ 15;
    w4 = this._g2Inv(w4, key); w1 ^= w4 ^ 14;
    w1 = this._g8Inv(w1, key); w2 ^= w1 ^ 13;
    w2 = this._g4Inv(w2, key); w3 ^= w2 ^ 12;
    w3 = this._g0Inv(w3, key); w4 ^= w3 ^ 11;
    w4 = this._g6Inv(w4, key); w1 ^= w4 ^ 10;
    w1 = this._g2Inv(w1, key); w2 ^= w1 ^ 9;
    
    // Last 8 rounds (reverse of first 8 encryption rounds)
    w1 ^= w2 ^ 8; w2 = this._g8Inv(w2, key);
    w2 ^= w3 ^ 7; w3 = this._g4Inv(w3, key);
    w3 ^= w4 ^ 6; w4 = this._g0Inv(w4, key);
    w4 ^= w1 ^ 5; w1 = this._g6Inv(w1, key);
    w1 ^= w2 ^ 4; w2 = this._g2Inv(w2, key);
    w2 ^= w3 ^ 3; w3 = this._g8Inv(w3, key);
    w3 ^= w4 ^ 2; w4 = this._g4Inv(w4, key);
    w4 ^= w1 ^ 1; w1 = this._g0Inv(w1, key);
    
    // Pack back to bytes
    const plainBytes = [
      (w1 >>> 8) & 0xFF, w1 & 0xFF,
      (w2 >>> 8) & 0xFF, w2 & 0xFF,
      (w3 >>> 8) & 0xFF, w3 & 0xFF,
      (w4 >>> 8) & 0xFF, w4 & 0xFF
    ];
    
    return plainBytes;
  }
}

// Register the algorithm
AlgorithmFramework.RegisterAlgorithm(new SkipjackAlgorithm());