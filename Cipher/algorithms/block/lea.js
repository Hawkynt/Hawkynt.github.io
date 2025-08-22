/*
 * LEA (Lightweight Encryption Algorithm) Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * LEA - Korean national standard (KS X 3246)
 * 128-bit blocks with 128/192/256-bit keys, ARX structure
 * High-speed software implementation optimized cipher
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
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

class LEAAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "LEA";
    this.description = "Lightweight Encryption Algorithm, Korean national standard (KS X 3246). ARX-based block cipher with 128-bit blocks, optimized for high-speed software implementation.";
    this.inventor = "Deukjo Hong, Jung-Keun Lee, Dong-Chan Kim, Daesung Kwon, Kwon Ho Ryu, Dong-Geon Lee";
    this.year = 2013;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = null; // Korean standard, no known breaks
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.KR;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(16, 32, 8) // 128, 192, 256-bit keys (16, 24, 32 bytes)
    ];
    this.SupportedBlockSizes = [
      new KeySize(16, 16, 1) // Fixed 128-bit (16-byte) blocks
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("LEA Specification", "https://seed.kisa.or.kr/kisa/algorithm/EgovLeaInfo.do"),
      new LinkItem("ISO/IEC 29192-2:2019", "https://www.iso.org/standard/56552.html"),
      new LinkItem("LEA Design Paper", "https://eprint.iacr.org/2013/794.pdf")
    ];

    this.references = [
      new LinkItem("KISA Reference Implementation", "https://seed.kisa.or.kr/kisa/algorithm/EgovLeaInfo.do"),
      new LinkItem("LEA GitHub Repository", "https://github.com/hkscy/LEA")
    ];

    // Test vectors from Korean standard
    this.tests = [
      new TestCase(
        OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"), // input
        OpCodes.Hex8ToBytes("9fc84e3528c6c61832554f45b80de94f"), // expected
        "LEA-128 Test Vector - KS X 3246",
        "https://seed.kisa.or.kr/kisa/algorithm/EgovLeaInfo.do"
      )
    ];
    // Additional property for key in test vector
    this.tests[0].key = OpCodes.Hex8ToBytes("0f1e2d3c4b5a69788796a5b4c3d2e1f0");
    
    // LEA Constants - Key schedule constants δ[i] (based on golden ratio)
    this.DELTA = [
      0xc3efe9db, 0x44626b02, 0x79e27c8a, 0x78df30ec,
      0x715ea49e, 0xc785da0a, 0xe04ef22a, 0xe5c40957,
      0x06fce657, 0xf3848f2f, 0xb073da8f, 0x8adb1ba5,
      0x3a14dfe1, 0x79ddb6b7, 0xe9e91c10, 0x7c8e2e9c,
      0xa16d8b4f, 0xd7b08ad3, 0xaafbc10f, 0x0f2e7fb5,
      0xdea75cf4, 0x2e4f2e98, 0x3f7f1f02, 0xf5cd9e04,
      0x01e4f2b0, 0x6e4c1ab8, 0x99fe2d05, 0x60b5f72e,
      0x20f6d5a5, 0xe0c1a2c8, 0x5b1b1b97, 0x23d764c1,
      0x63f5c28e, 0x2e3b0ad9, 0xa8b6c4c4, 0x3a8bd8fb,
      0xab86c5fb, 0x2e9dc9db, 0xd70d77eb, 0x40be96b0,
      0x7f5d7c56, 0x83f7ba2e, 0xc7ea0be3, 0xbf5f8c96,
      0x10cf8f8d, 0x3cd777d9, 0x42bb0ada, 0xa7e9b6b7
    ];
  }

  // Required: Create instance for this algorithm
  CreateInstance(isInverse = false) {
    return new LEAInstance(this, isInverse);
  }
}

// Instance class - handles the actual encryption/decryption
class LEAInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.roundKeys = null;
    this.rounds = 0;
    this.inputBuffer = [];
    this.BlockSize = 16; // 128-bit blocks
    this.KeySize = 0;    // will be set when key is assigned
  }

  // Property setter for key - validates and sets up key schedule
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.roundKeys = null;
      this.rounds = 0;
      this.KeySize = 0;
      return;
    }

    // Validate key size
    const validSizes = [16, 24, 32];
    if (!validSizes.includes(keyBytes.length)) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 16, 24, or 32 bytes)`);
    }

    this._key = [...keyBytes]; // Copy the key
    this.KeySize = keyBytes.length;
    
    // Determine number of rounds based on key length
    if (this.KeySize === 16) {
      this.rounds = 24;
    } else if (this.KeySize === 24) {
      this.rounds = 28;
    } else if (this.KeySize === 32) {
      this.rounds = 32;
    }
    
    // Generate round keys
    this._generateRoundKeys();
  }

  get key() {
    return this._key ? [...this._key] : null; // Return copy
  }

  // Feed data to the cipher (accumulates until we have complete blocks)
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.key) throw new Error("Key not set");

    // Add data to input buffer
    this.inputBuffer.push(...data);
  }

  // Get the result of the transformation
  Result() {
    if (!this.key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    // Process complete blocks
    const output = [];
    const blockSize = this.BlockSize;
    
    // Validate input length for block cipher
    if (this.inputBuffer.length % blockSize !== 0) {
      throw new Error(`Input length must be multiple of ${blockSize} bytes`);
    }

    // Process each block
    for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
      const block = this.inputBuffer.slice(i, i + blockSize);
      const processedBlock = this.isInverse 
        ? this._decryptBlock(block) 
        : this._encryptBlock(block);
      output.push(...processedBlock);
    }

    // Clear input buffer for next operation
    this.inputBuffer = [];
    
    return output;
  }

  // Generate round keys based on key length
  _generateRoundKeys() {
    this.roundKeys = [];
    const K = [];
    const keyWords = this.KeySize / 4;
    
    // Convert key bytes to 32-bit words (little-endian)
    for (let i = 0; i < keyWords; i++) {
      const offset = i * 4;
      K[i] = OpCodes.Pack32LE(
        this._key[offset], 
        this._key[offset + 1], 
        this._key[offset + 2], 
        this._key[offset + 3]
      );
    }
    
    // Generate round keys based on key length
    for (let i = 0; i < this.rounds; i++) {
      const roundKey = new Array(6);
      
      if (keyWords === 4) { // 128-bit key
        const T = [
          ((K[0] + OpCodes.RotL32(this.algorithm.DELTA[i % 4], i)) >>> 0),
          ((K[1] + OpCodes.RotL32(this.algorithm.DELTA[i % 4], i + 1)) >>> 0),
          ((K[2] + OpCodes.RotL32(this.algorithm.DELTA[i % 4], i + 2)) >>> 0),
          ((K[3] + OpCodes.RotL32(this.algorithm.DELTA[i % 4], i + 3)) >>> 0)
        ];
        
        // Update key words for next round
        K[0] = OpCodes.RotL32(T[0], 1);
        K[1] = OpCodes.RotL32(T[1], 3);
        K[2] = OpCodes.RotL32(T[2], 6);
        K[3] = OpCodes.RotL32(T[3], 11);
        
        // Round key is 6 words (192 bits)
        roundKey[0] = K[0];
        roundKey[1] = K[1];
        roundKey[2] = K[2];
        roundKey[3] = K[3];
        roundKey[4] = K[1];
        roundKey[5] = K[3];
        
      } else if (keyWords === 6) { // 192-bit key
        const T = [
          ((K[0] + OpCodes.RotL32(this.algorithm.DELTA[i % 6], i)) >>> 0),
          ((K[1] + OpCodes.RotL32(this.algorithm.DELTA[i % 6], i + 1)) >>> 0),
          ((K[2] + OpCodes.RotL32(this.algorithm.DELTA[i % 6], i + 2)) >>> 0),
          ((K[3] + OpCodes.RotL32(this.algorithm.DELTA[i % 6], i + 3)) >>> 0),
          ((K[4] + OpCodes.RotL32(this.algorithm.DELTA[i % 6], i + 4)) >>> 0),
          ((K[5] + OpCodes.RotL32(this.algorithm.DELTA[i % 6], i + 5)) >>> 0)
        ];
        
        // Update key words for next round
        K[0] = OpCodes.RotL32(T[0], 1);
        K[1] = OpCodes.RotL32(T[1], 3);
        K[2] = OpCodes.RotL32(T[2], 6);
        K[3] = OpCodes.RotL32(T[3], 11);
        K[4] = OpCodes.RotL32(T[4], 13);
        K[5] = OpCodes.RotL32(T[5], 17);
        
        // Round key is 6 words (192 bits)
        roundKey[0] = K[0];
        roundKey[1] = K[1];
        roundKey[2] = K[2];
        roundKey[3] = K[3];
        roundKey[4] = K[4];
        roundKey[5] = K[5];
        
      } else if (keyWords === 8) { // 256-bit key
        const T = [
          ((K[(6 * i) % 8] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i)) >>> 0),
          ((K[(6 * i + 1) % 8] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 1)) >>> 0),
          ((K[(6 * i + 2) % 8] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 2)) >>> 0),
          ((K[(6 * i + 3) % 8] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 3)) >>> 0),
          ((K[(6 * i + 4) % 8] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 4)) >>> 0),
          ((K[(6 * i + 5) % 8] + OpCodes.RotL32(this.algorithm.DELTA[i % 8], i + 5)) >>> 0)
        ];
        
        // Update key words for next round
        for (let j = 0; j < 6; j++) {
          K[(6 * i + j) % 8] = OpCodes.RotL32(T[j], [1, 3, 6, 11, 13, 17][j]);
        }
        
        // Round key is 6 words (192 bits)
        for (let j = 0; j < 6; j++) {
          roundKey[j] = T[j];
        }
      }
      
      this.roundKeys[i] = roundKey;
    }
  }

  // Encrypt 128-bit block
  _encryptBlock(block) {
    // Convert input to 32-bit words using OpCodes (little-endian for LEA)
    let X = [
      OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
      OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
      OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
      OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
    ];
    
    // LEA encryption rounds - implementing the correct round function
    for (let i = 0; i < this.rounds; i++) {
      const RK = this.roundKeys[i];
      
      // Store original values before transformation
      const X0 = X[0], X1 = X[1], X2 = X[2], X3 = X[3];
      
      // LEA round function (ARX operations) - correct specification
      // X[0] = ((X[0] ^ RK[0]) + (X[1] ^ RK[1])) <<< 9
      X[0] = OpCodes.RotL32(((X0 ^ RK[0]) + (X1 ^ RK[1])) >>> 0, 9);
      
      // X[1] = ((X[1] ^ RK[2]) + (X[2] ^ RK[3])) >>> 5
      X[1] = OpCodes.RotR32(((X1 ^ RK[2]) + (X2 ^ RK[3])) >>> 0, 5);
      
      // X[2] = ((X[2] ^ RK[4]) + (X[3] ^ RK[5])) >>> 3
      X[2] = OpCodes.RotR32(((X2 ^ RK[4]) + (X3 ^ RK[5])) >>> 0, 3);
      
      // X[3] = X[0] (state rotation)
      X[3] = X0;
    }
    
    // Convert back to byte array using OpCodes (little-endian)
    const result = [];
    for (let i = 0; i < 4; i++) {
      const wordBytes = OpCodes.Unpack32LE(X[i]);
      result.push(...wordBytes);
    }
    
    return result;
  }

  // Decrypt 128-bit block  
  _decryptBlock(block) {
    // Convert input to 32-bit words using OpCodes (little-endian for LEA)
    let X = [
      OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
      OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
      OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
      OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
    ];
    
    // LEA decryption rounds (reverse order and inverse operations)
    for (let i = this.rounds - 1; i >= 0; i--) {
      const RK = this.roundKeys[i];
      
      // Reverse the state rotation: X[3] -> X[0], X[0] -> X[1], X[1] -> X[2], X[2] -> X[3]
      const temp = X[3];
      X[3] = X[2];
      X[2] = X[1];
      X[1] = X[0];
      X[0] = temp;
      
      // Inverse LEA round function
      // Reverse: X[2] = ((X[2] ^ RK[4]) + (X[3] ^ RK[5])) >>> 3
      X[2] = OpCodes.RotL32(X[2], 3);
      X[2] = (X[2] - (X[3] ^ RK[5])) >>> 0;
      X[2] = X[2] ^ RK[4];
      
      // Reverse: X[1] = ((X[1] ^ RK[2]) + (X[2] ^ RK[3])) >>> 5  
      X[1] = OpCodes.RotL32(X[1], 5);
      X[1] = (X[1] - (X[2] ^ RK[3])) >>> 0;
      X[1] = X[1] ^ RK[2];
      
      // Reverse: X[0] = ((X[0] ^ RK[0]) + (X[1] ^ RK[1])) <<< 9
      X[0] = OpCodes.RotR32(X[0], 9);
      X[0] = (X[0] - (X[1] ^ RK[1])) >>> 0;
      X[0] = X[0] ^ RK[0];
    }
    
    // Convert back to byte array using OpCodes (little-endian)
    const result = [];
    for (let i = 0; i < 4; i++) {
      const wordBytes = OpCodes.Unpack32LE(X[i]);
      result.push(...wordBytes);
    }
    
    return result;
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new LEAAlgorithm());
