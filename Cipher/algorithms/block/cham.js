/*
 * CHAM Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * CHAM-128/128 - Korean lightweight block cipher
 * 128-bit blocks with 128-bit keys, 112 rounds
 * ARX operations with 4-branch Feistel structure
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  OpCodes = require('../../OpCodes.js');
}

class CHAMCipher extends AlgorithmFramework.BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "CHAM";
    this.description = "Korean lightweight block cipher designed for resource-constrained devices. CHAM-128/128 uses 128-bit blocks with 128-bit keys and 112 rounds with ARX operations.";
    this.inventor = "Koo, Roh, Kim, Jung, Lee, and Kwon";
    this.year = 2017;
    this.category = AlgorithmFramework.CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
    this.complexity = AlgorithmFramework.ComplexityType.BASIC;
    this.country = AlgorithmFramework.CountryCode.KR;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new AlgorithmFramework.KeySize(16, 16, 1) // CHAM-128/128: 128-bit keys only
    ];
    this.SupportedBlockSizes = [
      new AlgorithmFramework.KeySize(16, 16, 1) // Fixed 128-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new AlgorithmFramework.LinkItem("CHAM: A Family of Lightweight Block Ciphers", "https://link.springer.com/chapter/10.1007/978-3-319-78556-1_1"),
      new AlgorithmFramework.LinkItem("ICISC 2017 Paper", "https://eprint.iacr.org/2017/1032.pdf")
    ];

    this.references = [
      new AlgorithmFramework.LinkItem("Original CHAM Specification", "https://eprint.iacr.org/2017/1032.pdf"),
      new AlgorithmFramework.LinkItem("Lightweight Cryptography Research", "https://csrc.nist.gov/projects/lightweight-cryptography")
    ];
    
    // Test vectors
    this.tests = [
      {
        text: "CHAM-128/128 Zero Test Vector",
        uri: "https://eprint.iacr.org/2017/1032.pdf",
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("3e0f6749aa78c96877b80413913a40ef")
      },
      {
        text: "CHAM-128/128 Pattern Test Vector",
        uri: "https://eprint.iacr.org/2017/1032.pdf",
        input: OpCodes.Hex8ToBytes("0123456789abcdeffedcba9876543210"),
        key: OpCodes.Hex8ToBytes("00112233445566778899aabbccddeeff"),
        expected: OpCodes.Hex8ToBytes("fddd1dbc13ec40586df16447c49f2eab")
      }
    ];
    
    // CHAM-128/128 Constants
    this.ROUNDS = 112;      // 112 rounds for CHAM-128/128
    this.ROT_ALPHA = 1;     // Alpha rotation constant
    this.ROT_BETA = 8;      // Beta rotation constant
  }

  CreateInstance(isInverse = false) {
    return new CHAMInstance(this, isInverse);
  }
}

class CHAMInstance extends AlgorithmFramework.IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.roundKeys = null;
    this.inputBuffer = [];
    this.outputBuffer = [];
    this.BlockSize = 16;    // 128-bit blocks
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
    
    // Process complete blocks
    while (this.inputBuffer.length >= this.BlockSize) {
      const block = this.inputBuffer.splice(0, this.BlockSize);
      const processed = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
      this.outputBuffer.push(...processed);
    }
  }
  
  Result() {
    const result = [...this.outputBuffer];
    this.outputBuffer = [];
    return result;
  }
  
  Reset() {
    this.inputBuffer = [];
    this.outputBuffer = [];
  }
  
  _encryptBlock(blockBytes) {
    if (blockBytes.length !== 16) {
      throw new Error('CHAM: Input must be exactly 16 bytes');
    }
    
    // Convert input to 32-bit words using OpCodes (little-endian)
    let X = [
      OpCodes.Pack32LE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]),
      OpCodes.Pack32LE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]),
      OpCodes.Pack32LE(blockBytes[8], blockBytes[9], blockBytes[10], blockBytes[11]),
      OpCodes.Pack32LE(blockBytes[12], blockBytes[13], blockBytes[14], blockBytes[15])
    ];
    
    // CHAM encryption: 112 rounds with 4-branch Feistel structure
    for (let r = 0; r < this.algorithm.ROUNDS; r++) {
      // Get round key (cycling through the 8 round keys)
      const rk = this.roundKeys[r % 8];
      
      // CHAM round function with odd/even round variation (ARX operations)
      if (r % 2 === 0) {
        // Even rounds: X[0] = ROL((X[0] ^ r) + (ROL(X[1], ROT_ALPHA) ^ rk), ROT_BETA)
        const temp = (OpCodes.RotL32(X[1], this.algorithm.ROT_ALPHA) ^ rk) >>> 0;
        X[0] = ((X[0] ^ r) + temp) >>> 0;
        X[0] = OpCodes.RotL32(X[0], this.algorithm.ROT_BETA);
      } else {
        // Odd rounds: X[0] = ROL((X[0] ^ r) + (ROL(X[1], ROT_BETA) ^ rk), ROT_ALPHA)
        const temp = (OpCodes.RotL32(X[1], this.algorithm.ROT_BETA) ^ rk) >>> 0;
        X[0] = ((X[0] ^ r) + temp) >>> 0;
        X[0] = OpCodes.RotL32(X[0], this.algorithm.ROT_ALPHA);
      }
      
      // 4-branch Feistel state rotation: X = [X[1], X[2], X[3], X[0]]
      const temp_x = X[0];
      X[0] = X[1];
      X[1] = X[2];
      X[2] = X[3];
      X[3] = temp_x;
    }
    
    // Convert back to bytes using OpCodes (little-endian)
    const result = [];
    for (let i = 0; i < 4; i++) {
      const wordBytes = OpCodes.Unpack32LE(X[i]);
      result.push(...wordBytes);
    }
    
    return result;
  }
  
  _decryptBlock(blockBytes) {
    if (blockBytes.length !== 16) {
      throw new Error('CHAM: Input must be exactly 16 bytes');
    }
    
    // Convert input to 32-bit words using OpCodes (little-endian)
    let X = [
      OpCodes.Pack32LE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]),
      OpCodes.Pack32LE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]),
      OpCodes.Pack32LE(blockBytes[8], blockBytes[9], blockBytes[10], blockBytes[11]),
      OpCodes.Pack32LE(blockBytes[12], blockBytes[13], blockBytes[14], blockBytes[15])
    ];
    
    // CHAM decryption: reverse the encryption process (112 rounds in reverse order)
    for (let r = this.algorithm.ROUNDS - 1; r >= 0; r--) {
      // Reverse the 4-branch Feistel state rotation: X = [X[3], X[0], X[1], X[2]]
      const temp_x = X[3];
      X[3] = X[2];
      X[2] = X[1];
      X[1] = X[0];
      X[0] = temp_x;
      
      // Get round key (cycling through the 8 round keys)
      const rk = this.roundKeys[r % 8];
      
      // Reverse CHAM round function with odd/even round variation
      if (r % 2 === 0) {
        // Even rounds (reverse): X[0] = (ROR(X[0], ROT_BETA) - (ROL(X[1], ROT_ALPHA) ^ rk)) ^ r
        const rotated = OpCodes.RotR32(X[0], this.algorithm.ROT_BETA);
        const temp = (OpCodes.RotL32(X[1], this.algorithm.ROT_ALPHA) ^ rk) >>> 0;
        X[0] = ((rotated - temp) >>> 0) ^ r;
      } else {
        // Odd rounds (reverse): X[0] = (ROR(X[0], ROT_ALPHA) - (ROL(X[1], ROT_BETA) ^ rk)) ^ r
        const rotated = OpCodes.RotR32(X[0], this.algorithm.ROT_ALPHA);
        const temp = (OpCodes.RotL32(X[1], this.algorithm.ROT_BETA) ^ rk) >>> 0;
        X[0] = ((rotated - temp) >>> 0) ^ r;
      }
    }
    
    // Convert back to bytes using OpCodes (little-endian)
    const result = [];
    for (let i = 0; i < 4; i++) {
      const wordBytes = OpCodes.Unpack32LE(X[i]);
      result.push(...wordBytes);
    }
    
    return result;
  }
  
  _expandKey(keyBytes) {
    // Convert 128-bit key to four 32-bit words using OpCodes (little-endian)
    const key = [
      OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
      OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
      OpCodes.Pack32LE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
      OpCodes.Pack32LE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
    ];
    
    // CHAM-128/128 key schedule: generate 8 round keys from the 128-bit master key
    const roundKeys = [];
    
    // Generate 8 round keys using the CHAM key schedule
    for (let i = 0; i < 8; i++) {
      // CHAM key schedule: RK[i] = K[i mod 4] ^ ROL(K[(i+1) mod 4], 1) ^ ROL(K[(i+2) mod 4], 8) ^ ROL(K[(i+3) mod 4], 11)
      const k0 = key[i % 4];
      const k1 = key[(i + 1) % 4];
      const k2 = key[(i + 2) % 4];
      const k3 = key[(i + 3) % 4];
      
      // Apply rotations and XOR for key mixing
      const rot1 = OpCodes.RotL32(k1, 1);
      const rot8 = OpCodes.RotL32(k2, 8);
      const rot11 = OpCodes.RotL32(k3, 11);
      
      roundKeys[i] = (k0 ^ rot1 ^ rot8 ^ rot11) >>> 0;
    }
    
    return roundKeys;
  }
}

// Register algorithm
AlgorithmFramework.RegisterAlgorithm(new CHAMCipher());

// Node.js module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CHAMCipher;
}