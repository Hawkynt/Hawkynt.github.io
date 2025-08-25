/*
 * Simon Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * NSA's Simon cipher (2013) - Feistel-like design for hardware optimization
 * Simon64/128: 64-bit blocks with 128-bit keys, 44 rounds
 * Lightweight cipher optimized for hardware efficiency
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

class SimonCipher extends AlgorithmFramework.BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Simon";
    this.description = "NSA's lightweight block cipher family designed for resource-constrained environments. Simon64/128 variant uses 64-bit blocks with 128-bit keys and 44 rounds. Optimized for hardware implementation.";
    this.inventor = "NSA (National Security Agency)";
    this.year = 2013;
    this.category = AlgorithmFramework.CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
    this.complexity = AlgorithmFramework.ComplexityType.BASIC;
    this.country = AlgorithmFramework.CountryCode.US;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new AlgorithmFramework.KeySize(16, 16, 0) // Simon64/128: 128-bit keys only
    ];
    this.SupportedBlockSizes = [
      new AlgorithmFramework.KeySize(8, 8, 0) // Fixed 64-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new AlgorithmFramework.LinkItem("The Simon and Speck Families of Lightweight Block Ciphers", "https://eprint.iacr.org/2013/404.pdf"),
      new AlgorithmFramework.LinkItem("NSA Simon and Speck Specification", "https://nsacyber.github.io/simon-speck/"),
      new AlgorithmFramework.LinkItem("Lightweight Cryptography Standardization", "https://csrc.nist.gov/projects/lightweight-cryptography")
    ];

    this.references = [
      new AlgorithmFramework.LinkItem("NSA Reference Implementation", "https://github.com/nsacyber/simon-speck-supercop"),
      new AlgorithmFramework.LinkItem("Cryptanalysis of Simon variants", "https://eprint.iacr.org/2014/448.pdf"),
      new AlgorithmFramework.LinkItem("NIST Lightweight Cryptography", "https://csrc.nist.gov/Projects/Lightweight-Cryptography")
    ];
    
    this.knownVulnerabilities = [
      new AlgorithmFramework.Vulnerability("Reduced-round attacks", "Various attacks exist against reduced-round variants (not full 44 rounds)", "Use full-round implementation and consider alternatives for high-security applications")
    ];
    
    // Test vectors from NSA specification
    this.tests = [
      {
        text: "Simon64/128 Test Vector #1",
        uri: "https://eprint.iacr.org/2013/404.pdf",
        input: OpCodes.Hex8ToBytes("656c69746e696874"),
        key: OpCodes.Hex8ToBytes("1f1e1d1c1b1a19181716151413121110"),
        expected: OpCodes.Hex8ToBytes("be921012427893c2")
      },
      {
        text: "Simon64/128 Test Vector #2 (zero key)",
        uri: "https://eprint.iacr.org/2013/404.pdf",
        input: OpCodes.Hex8ToBytes("0000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("8ae8d3db04628ce4")
      }
    ];
    
    // Simon64/128 Constants
    this.ROUNDS = 44;       // NSA standard: 44 rounds for 64/128 variant
    this.WORD_SIZE = 32;    // 32-bit words (64-bit block = 2 words)
    this.m = 4;            // Number of key words for Simon64/128
  }

  CreateInstance(isInverse = false) {
    return new SimonInstance(this, isInverse);
  }

  // Z3 sequence for Simon64/128 (from NSA specification)
  static getZ3Sequence() {
    // Z3 sequence for Simon64/128 configuration (62 bits)
    // Source: NSA reference implementation 
    return [1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0,
            1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0,
            0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1];
  }

  // Simon round function implementation
  // F(x) = ((x <<< 1) & (x <<< 8)) ^ (x <<< 2)
  static roundFunction(x) {
    const rot1 = OpCodes.RotL32(x, 1);
    const rot8 = OpCodes.RotL32(x, 8);
    const rot2 = OpCodes.RotL32(x, 2);
    
    return ((rot1 & rot8) ^ rot2) >>> 0;
  }
}

class SimonInstance extends AlgorithmFramework.IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.roundKeys = null;
    this.inputBuffer = [];
    this.outputBuffer = [];
    this.BlockSize = 8;     // 64-bit blocks
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
      (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)
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
    if (blockBytes.length !== 8) {
      throw new Error('Simon: Input must be exactly 8 bytes');
    }
    
    // Simon uses little-endian byte ordering for 32-bit words  
    let x = OpCodes.Pack32LE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
    let y = OpCodes.Pack32LE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);
    
    // Simon encryption: 44 rounds of Feistel-like operations
    // Round function: (x, y) -> (y ^ F(x) ^ k_i, x)
    // where F(x) = ((x <<< 1) & (x <<< 8)) ^ (x <<< 2)
    for (let i = 0; i < this.algorithm.ROUNDS; i++) {
      const temp = y ^ SimonCipher.roundFunction(x) ^ this.roundKeys[i];
      y = x;
      x = temp;
    }
    
    // Convert back to bytes (little-endian)
    const xBytes = OpCodes.Unpack32LE(x);
    const yBytes = OpCodes.Unpack32LE(y);
    return [...xBytes, ...yBytes];
  }
  
  _decryptBlock(blockBytes) {
    if (blockBytes.length !== 8) {
      throw new Error('Simon: Input must be exactly 8 bytes');
    }
    
    // Simon uses little-endian byte ordering for 32-bit words  
    let x = OpCodes.Pack32LE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
    let y = OpCodes.Pack32LE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);
    
    // Simon decryption: reverse the encryption process
    // Inverse operations in reverse order:
    // (x, y) -> (y, x ^ F(y) ^ k_i)
    for (let i = this.algorithm.ROUNDS - 1; i >= 0; i--) {
      const temp = x;
      x = y;
      y = temp ^ SimonCipher.roundFunction(x) ^ this.roundKeys[i];
    }
    
    // Convert back to bytes (little-endian)
    const xBytes = OpCodes.Unpack32LE(x);
    const yBytes = OpCodes.Unpack32LE(y);
    return [...xBytes, ...yBytes];
  }
  
  _expandKey(keyBytes) {
    // Simon64/128: Convert 128-bit key to four 32-bit words (little-endian)
    const k = [
      OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
      OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
      OpCodes.Pack32LE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
      OpCodes.Pack32LE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
    ];
    
    // Expand key to 44 round keys using Simon key schedule
    const roundKeys = new Array(this.algorithm.ROUNDS);
    
    // Initialize first 4 round keys directly from master key
    for (let i = 0; i < this.algorithm.m; i++) {
      roundKeys[i] = k[i];
    }
    
    // Generate remaining round keys using Simon key schedule for m=4
    // k_i = c ^ (z3)_{i-m} ^ k_{i-m} ^ ((k_{i-1} >>> 3) ^ k_{i-3} ^ ((k_{i-1} >>> 3) ^ k_{i-3}) >>> 1)
    const c = 0xfffffffc;  // 2^32 - 4
    const z3Sequence = SimonCipher.getZ3Sequence();
    
    for (let i = this.algorithm.m; i < this.algorithm.ROUNDS; i++) {
      let tmp = OpCodes.RotR32(roundKeys[i - 1], 3);
      tmp ^= roundKeys[i - 3];
      tmp ^= OpCodes.RotR32(tmp, 1);
      tmp ^= roundKeys[i - this.algorithm.m];
      tmp ^= c;
      tmp ^= z3Sequence[i - this.algorithm.m];
      
      roundKeys[i] = tmp >>> 0;
    }
    
    return roundKeys;
  }
}

// Register algorithm
AlgorithmFramework.RegisterAlgorithm(new SimonCipher());

// Node.js module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SimonCipher;
}