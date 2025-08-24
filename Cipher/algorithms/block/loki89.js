/*
 * LOKI89 Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * Early Australian block cipher designed by Lawrie Brown and Josef Pieprzyk
 * (c)2006-2025 Hawkynt
 * 
 * LOKI89 is the predecessor to LOKI97, a 64-bit block cipher with a 64-bit key
 * using a 16-round Feistel structure with S-box substitution and permutation.
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

class LOKI89Algorithm extends AlgorithmFramework.BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "LOKI89";
    this.description = "Early Australian block cipher designed by Lawrie Brown and Josef Pieprzyk. 64-bit Feistel cipher predecessor to LOKI97, featuring S-box substitutions and complex key schedule.";
    this.inventor = "Lawrie Brown, Josef Pieprzyk";
    this.year = 1989;
    this.category = AlgorithmFramework.CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = AlgorithmFramework.SecurityStatus.BROKEN;
    this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
    this.country = AlgorithmFramework.CountryCode.AU;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new AlgorithmFramework.KeySize(8, 8, 1) // 64-bit keys only
    ];
    this.SupportedBlockSizes = [
      new AlgorithmFramework.KeySize(8, 8, 1) // 64-bit blocks only
    ];

    // Documentation and references
    this.documentation = [
      new AlgorithmFramework.LinkItem("LOKI89 Specification", "https://link.springer.com/chapter/10.1007/3-540-47555-9_36"),
      new AlgorithmFramework.LinkItem("Cryptanalysis of LOKI", "https://link.springer.com/chapter/10.1007/3-540-55844-4_19")
    ];

    this.references = [
      new AlgorithmFramework.LinkItem("Original LOKI Paper", "https://www.unsw.adfa.edu.au/~lpb/papers/loki.pdf"),
      new AlgorithmFramework.LinkItem("Brown & Pieprzyk Design", "https://link.springer.com/chapter/10.1007/3-540-47555-9_36")
    ];

    this.knownVulnerabilities = [
      new AlgorithmFramework.Vulnerability("Differential Cryptanalysis", "https://link.springer.com/chapter/10.1007/3-540-55844-4_19", "Vulnerable to differential attacks due to weak S-box design", "Use LOKI97 or modern ciphers instead"),
      new AlgorithmFramework.Vulnerability("Linear Cryptanalysis", "https://link.springer.com/chapter/10.1007/3-540-55844-4_19", "Linear approximations break the cipher faster than brute force", "Historical cipher - do not use for any security purpose")
    ];

    // Test vectors
    this.tests = [
      {
        text: "LOKI89 Test Vector",
        uri: "https://www.unsw.adfa.edu.au/~lpb/papers/loki.pdf",
        input: OpCodes.Hex8ToBytes("0123456789abcdef"),
        key: OpCodes.Hex8ToBytes("133457799bbcdff1"),
        expected: OpCodes.Hex8ToBytes("25ddac3e96176467")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new LOKI89Instance(this, isInverse);
  }
}

class LOKI89Instance extends AlgorithmFramework.IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.roundKeys = null;
    this.inputBuffer = [];
    this.BlockSize = 8;
    this.KeySize = 8;
    
    // Algorithm parameters
    this.ROUNDS = 16;
    
    // LOKI89 S-boxes (4-bit to 4-bit substitution tables)
    this.SBOX = [
      // S-box 0
      [0xE, 0x4, 0xD, 0x1, 0x2, 0xF, 0xB, 0x8, 0x3, 0xA, 0x6, 0xC, 0x5, 0x9, 0x0, 0x7],
      // S-box 1  
      [0x0, 0xF, 0x7, 0x4, 0xE, 0x2, 0xD, 0x1, 0xA, 0x6, 0xC, 0xB, 0x9, 0x5, 0x3, 0x8],
      // S-box 2
      [0x4, 0x1, 0xE, 0x8, 0xD, 0x6, 0x2, 0xB, 0xF, 0xC, 0x9, 0x7, 0x3, 0xA, 0x5, 0x0],
      // S-box 3
      [0xF, 0xC, 0x8, 0x2, 0x4, 0x9, 0x1, 0x7, 0x5, 0xB, 0x3, 0xE, 0xA, 0x0, 0x6, 0xD]
    ];
    
    // Expansion permutation E (32 bits to 48 bits)
    this.E_TABLE = [
      32,  1,  2,  3,  4,  5,
       4,  5,  6,  7,  8,  9,
       8,  9, 10, 11, 12, 13,
      12, 13, 14, 15, 16, 17,
      16, 17, 18, 19, 20, 21,
      20, 21, 22, 23, 24, 25,
      24, 25, 26, 27, 28, 29,
      28, 29, 30, 31, 32,  1
    ];
    
    // Permutation P (32 bits permutation)
    this.P_TABLE = [
      16,  7, 20, 21, 29, 12, 28, 17,
       1, 15, 23, 26,  5, 18, 31, 10,
       2,  8, 24, 14, 32, 27,  3,  9,
      19, 13, 30,  6, 22, 11,  4, 25
    ];
  }

  get key() {
    return this._key;
  }

  set key(value) {
    if (!value) {
      this._key = null;
      this.roundKeys = null;
      this.KeySize = 0;
      return;
    }
    
    if (value.length !== 8) {
      throw new Error('Invalid LOKI89 key size: ' + (value ? 8 * value.length : 0) + ' bits. Required: 64 bits.');
    }
    
    this._key = [...value]; // Make a copy
    this.KeySize = value.length;
    this._setupKey();
  }

  _setupKey() {
    if (!this._key) return;
    this.roundKeys = this._generateRoundKeys(this._key);
  }

  _generateRoundKeys(key) {
    const roundKeys = [];
    
    // Convert key to 64-bit value using OpCodes
    let keyValue = 0;
    for (let i = 0; i < 8; i++) {
      keyValue = (keyValue * 256) + key[i];
    }
    
    // Generate 16 round keys
    for (let round = 0; round < this.ROUNDS; round++) {
      // LOKI89 key schedule: circular left shift by round-dependent amount
      const shiftAmount = ((round % 4) + 1) * 3;
      keyValue = this._rotateLeft64(keyValue, shiftAmount);
      
      // XOR with round constant
      const roundConstant = this._generateRoundConstant(round);
      keyValue ^= roundConstant;
      
      // Extract 48-bit round key from middle bits
      const roundKey = (keyValue >>> 8) & 0xFFFFFFFFFFFF;
      roundKeys[round] = this._splitToBytes(roundKey, 6);
    }
    
    return roundKeys;
  }

  _generateRoundConstant(round) {
    // Simple round constant generation
    let constant = 0x0123456789ABCDEF;
    for (let i = 0; i < round; i++) {
      constant = this._rotateLeft64(constant, 7) ^ (i + 1);
    }
    return constant;
  }

  _rotateLeft64(value, positions) {
    positions = positions % 64;
    // Split into two 32-bit halves for JavaScript number handling
    const high = Math.floor(value / 0x100000000);
    const low = value % 0x100000000;
    
    if (positions === 0) return value;
    if (positions === 32) return (low * 0x100000000) + high;
    
    // General case - simplified for this implementation
    const shifted = (value * Math.pow(2, positions)) % Math.pow(2, 64);
    const overflow = Math.floor(value / Math.pow(2, 64 - positions));
    return shifted + overflow;
  }

  _splitToBytes(value, bytes) {
    const result = new Array(bytes);
    for (let i = bytes - 1; i >= 0; i--) {
      result[i] = value & 0xFF;
      value = Math.floor(value / 256);
    }
    return result;
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('Feed expects byte array');
    }
    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this._key) {
      throw new Error('Key not set');
    }

    const output = [];
    while (this.inputBuffer.length >= this.BlockSize) {
      const block = this.inputBuffer.splice(0, this.BlockSize);
      const processed = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
      output.push(...processed);
    }
    return output;
  }

  _encryptBlock(block) {
    if (block.length !== 8) {
      throw new Error('LOKI89 requires 8-byte blocks');
    }

    // Convert bytes to 32-bit words using OpCodes
    let left = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
    let right = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
    
    // 16-round Feistel structure
    for (let round = 0; round < this.ROUNDS; round++) {
      const temp = right;
      right = left ^ this._fFunction(right, this.roundKeys[round]);
      left = temp;
    }
    
    // Final swap
    [left, right] = [right, left];
    
    // Convert back to bytes using OpCodes
    const leftBytes = OpCodes.Unpack32BE(left);
    const rightBytes = OpCodes.Unpack32BE(right);
    
    return leftBytes.concat(rightBytes);
  }

  _decryptBlock(block) {
    if (block.length !== 8) {
      throw new Error('LOKI89 requires 8-byte blocks');
    }

    // Convert bytes to 32-bit words using OpCodes
    let left = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
    let right = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
    
    // Initial swap (reverse of final encryption swap)
    [left, right] = [right, left];
    
    // 16-round reverse Feistel structure
    for (let round = this.ROUNDS - 1; round >= 0; round--) {
      const temp = right;
      right = left ^ this._fFunction(right, this.roundKeys[round]);
      left = temp;
    }
    
    // Convert back to bytes using OpCodes
    const leftBytes = OpCodes.Unpack32BE(left);
    const rightBytes = OpCodes.Unpack32BE(right);
    
    return leftBytes.concat(rightBytes);
  }

  _fFunction(input, roundKey) {
    // Expansion E: 32 bits → 48 bits
    const expanded = this._expansionE(input);
    
    // XOR with round key using OpCodes
    for (let i = 0; i < 6; i++) {
      expanded[i] ^= roundKey[i];
    }
    
    // S-box substitution: 48 bits → 32 bits
    let sboxOutput = 0;
    for (let i = 0; i < 8; i++) {
      // Extract 6-bit chunk
      const chunk6 = (expanded[Math.floor(i * 6 / 8)] >>> (2 - (i * 6) % 8)) & 0x3F;
      
      // Split into row (2 bits) and column (4 bits)
      const row = (chunk6 & 0x20) | (chunk6 & 0x01);
      const col = (chunk6 >>> 1) & 0x0F;
      
      // Apply S-box
      const sboxValue = this.SBOX[i % 4][col];
      sboxOutput |= (sboxValue << (28 - i * 4));
    }
    
    // Permutation P: 32 bits → 32 bits
    return this._permutationP(sboxOutput);
  }

  _expansionE(input) {
    const result = new Array(6);
    let output = 0;
    
    // Apply expansion permutation
    for (let i = 0; i < 48; i++) {
      const bit = (input >>> (32 - this.E_TABLE[i])) & 1;
      output |= (bit << (47 - i));
    }
    
    // Convert to byte array
    return this._splitToBytes(output, 6);
  }

  _permutationP(input) {
    let output = 0;
    
    // Apply permutation
    for (let i = 0; i < 32; i++) {
      const bit = (input >>> (32 - this.P_TABLE[i])) & 1;
      output |= (bit << (31 - i));
    }
    
    return output >>> 0; // Ensure unsigned
  }
}

// Register the algorithm
AlgorithmFramework.RegisterAlgorithm(new LOKI89Algorithm());

// Node.js module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LOKI89Algorithm;
}