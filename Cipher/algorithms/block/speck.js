/*
 * Speck Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * NSA's Speck cipher (2013) - ARX (Addition-Rotation-XOR) design
 * Speck64/128: 64-bit blocks with 128-bit keys, 27 rounds
 * Lightweight cipher optimized for software efficiency
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  OpCodes = require('../../OpCodes.js');
}

class SpeckCipher extends AlgorithmFramework.BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Speck";
    this.description = "NSA's lightweight ARX (Addition-Rotation-XOR) cipher designed for software efficiency. Speck64/128 variant uses 64-bit blocks with 128-bit keys and 27 rounds. Companion to Simon cipher.";
    this.inventor = "NSA (National Security Agency)";
    this.year = 2013;
    this.category = AlgorithmFramework.CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
    this.complexity = AlgorithmFramework.ComplexityType.BASIC;
    this.country = AlgorithmFramework.CountryCode.US;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new AlgorithmFramework.KeySize(16, 16, 1) // Speck64/128: 128-bit keys only
    ];
    this.SupportedBlockSizes = [
      new AlgorithmFramework.KeySize(8, 8, 1) // Fixed 64-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new AlgorithmFramework.LinkItem("The Simon and Speck Families of Lightweight Block Ciphers", "https://eprint.iacr.org/2013/404.pdf"),
      new AlgorithmFramework.LinkItem("NSA Simon and Speck Specification", "https://nsacyber.github.io/simon-speck/"),
      new AlgorithmFramework.LinkItem("Lightweight Cryptography Standardization", "https://csrc.nist.gov/projects/lightweight-cryptography")
    ];

    this.references = [
      new AlgorithmFramework.LinkItem("NSA Reference Implementation", "https://github.com/nsacyber/simon-speck-supercop"),
      new AlgorithmFramework.LinkItem("Cryptanalysis of Speck variants", "https://eprint.iacr.org/2016/1010.pdf"),
      new AlgorithmFramework.LinkItem("NIST Lightweight Cryptography", "https://csrc.nist.gov/Projects/Lightweight-Cryptography")
    ];
    
    this.knownVulnerabilities = [
      new AlgorithmFramework.Vulnerability("Reduced-round attacks", "Various attacks exist against reduced-round variants (not full 27 rounds)", "Use full-round implementation and consider alternatives for high-security applications")
    ];
    
    // Test vectors from NSA specification
    this.tests = [
      {
        text: "Speck64/128 Test Vector #1",
        uri: "https://eprint.iacr.org/2013/404.pdf",
        input: OpCodes.Hex8ToBytes("656c69746e696874"),
        key: OpCodes.Hex8ToBytes("1f1e1d1c1b1a19181716151413121110"),
        expected: OpCodes.Hex8ToBytes("1b1a2ddb4c642438")
      },
      {
        text: "Speck64/128 Test Vector #2 (zero key)",
        uri: "https://eprint.iacr.org/2013/404.pdf",
        input: OpCodes.Hex8ToBytes("0000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("84e8c9622b6fbc1a")
      }
    ];
    
    // Speck64/128 Constants
    this.ROUNDS = 27;       // NSA standard: 27 rounds for 64/128 variant
    this.ALPHA = 8;         // Right rotation constant
    this.BETA = 3;          // Left rotation constant
  }

  CreateInstance(isInverse = false) {
    return new SpeckInstance(this, isInverse);
  }
}

class SpeckInstance extends AlgorithmFramework.IBlockCipherInstance {
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
    if (blockBytes.length !== 8) {
      throw new Error('Speck: Input must be exactly 8 bytes');
    }
    
    // Convert input to 32-bit words using OpCodes (little-endian for Speck)
    let x = OpCodes.Pack32LE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
    let y = OpCodes.Pack32LE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);
    
    // Speck encryption: 27 rounds of ARX operations
    // Round function based on NSA specification:
    // x = (ROR(x, 8) + y) ^ roundKey
    // y = ROL(y, 3) ^ x
    for (let i = 0; i < this.algorithm.ROUNDS; i++) {
      // Right rotate x by 8 bits, add y, then XOR with round key
      x = OpCodes.RotR32(x, this.algorithm.ALPHA);
      x = (x + y) >>> 0;
      x ^= this.roundKeys[i];
      
      // Left rotate y by 3 bits, then XOR with new x
      y = OpCodes.RotL32(y, this.algorithm.BETA);
      y ^= x;
    }
    
    // Convert back to bytes using OpCodes (little-endian)
    const result0 = OpCodes.Unpack32LE(x);
    const result1 = OpCodes.Unpack32LE(y);
    return [...result0, ...result1];
  }
  
  _decryptBlock(blockBytes) {
    if (blockBytes.length !== 8) {
      throw new Error('Speck: Input must be exactly 8 bytes');
    }
    
    // Convert input to 32-bit words using OpCodes (little-endian for Speck)
    let x = OpCodes.Pack32LE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
    let y = OpCodes.Pack32LE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);
    
    // Speck decryption: reverse the encryption process
    // Inverse operations in reverse order:
    // y = ROR(y ^ x, 3)
    // x = ROL((x ^ roundKey) - y, 8)
    for (let i = this.algorithm.ROUNDS - 1; i >= 0; i--) {
      // Reverse: y = ROL(y, 3) ^ x
      y ^= x;
      y = OpCodes.RotR32(y, this.algorithm.BETA);
      
      // Reverse: x = (ROR(x, 8) + y) ^ roundKey
      x ^= this.roundKeys[i];
      x = (x - y) >>> 0;
      x = OpCodes.RotL32(x, this.algorithm.ALPHA);
    }
    
    // Convert back to bytes using OpCodes (little-endian)
    const result0 = OpCodes.Unpack32LE(x);
    const result1 = OpCodes.Unpack32LE(y);
    return [...result0, ...result1];
  }
  
  _expandKey(keyBytes) {
    // Convert 128-bit key to four 32-bit words using OpCodes (little-endian)
    // NSA Speck uses specific ordering: k3, k2, k1, k0 (reverse order)
    const k = [
      OpCodes.Pack32LE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15]), // k3 -> k0
      OpCodes.Pack32LE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),   // k2 -> k1  
      OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),     // k1 -> k2
      OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3])      // k0 -> k3
    ];
    
    // Expand key to 27 round keys using Speck key schedule
    const roundKeys = new Array(this.algorithm.ROUNDS);
    
    // Initialize first round key and working variables
    roundKeys[0] = k[0];  // First round key is k[0]
    let l = [k[1], k[2], k[3]];  // Key schedule working array
    
    // Generate remaining round keys using Speck key schedule
    // Key schedule uses same ARX structure as round function
    for (let i = 0; i < this.algorithm.ROUNDS - 1; i++) {
      // Apply round function to l[i % 3] and roundKeys[i]
      // l[i % 3] = (ROR(l[i % 3], 8) + roundKeys[i]) ^ i
      const idx = i % 3;
      l[idx] = OpCodes.RotR32(l[idx], this.algorithm.ALPHA);
      l[idx] = (l[idx] + roundKeys[i]) >>> 0;
      l[idx] ^= i;
      
      // Generate next round key: roundKeys[i+1] = ROL(roundKeys[i], 3) ^ l[i % 3]
      roundKeys[i + 1] = OpCodes.RotL32(roundKeys[i], this.algorithm.BETA) ^ l[idx];
    }
    
    return roundKeys;
  }
}

// Register algorithm
AlgorithmFramework.RegisterAlgorithm(new SpeckCipher());

// Node.js module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpeckCipher;
}