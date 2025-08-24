/*
 * PRESENT Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * PRESENT - Lightweight block cipher for constrained environments
 * 64-bit blocks with 80-bit keys, 31 rounds
 * Substitution-Permutation Network (SPN) structure
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
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

class PresentAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "PRESENT";
    this.description = "PRESENT-80 lightweight block cipher designed for constrained environments. Substitution-Permutation Network with 64-bit blocks, 80-bit keys, and 31 rounds. Educational implementation following ISO/IEC 29192-2 specification.";
    this.inventor = "Andrey Bogdanov, Lars R. Knudsen, Gregor Leander, Christof Paar, Axel Poschmann, Matthew J.B. Robshaw, Yannick Seurin, C. Vikkelsoe";
    this.year = 2007;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.BASIC;
    this.country = CountryCode.DE;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(10, 10, 0)  // PRESENT-80: 80-bit keys only
    ];
    this.SupportedBlockSizes = [
      new KeySize(8, 8, 0)    // 64-bit blocks only
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("ISO/IEC 29192-2:2019 - PRESENT", "https://www.iso.org/standard/56425.html"),
      new LinkItem("PRESENT Specification", "https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31"),
      new LinkItem("Wikipedia - PRESENT", "https://en.wikipedia.org/wiki/PRESENT")
    ];

    this.references = [
      new LinkItem("Original PRESENT Paper", "https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31"),
      new LinkItem("Crypto++ PRESENT Implementation", "https://github.com/weidai11/cryptopp/blob/master/present.cpp"),
      new LinkItem("PRESENT Analysis", "https://eprint.iacr.org/2007/024.pdf"),
      new LinkItem("Lightweight Cryptography", "https://csrc.nist.gov/projects/lightweight-cryptography")
    ];

    // Known vulnerabilities
    this.knownVulnerabilities = [
      new Vulnerability(
        "Linear cryptanalysis",
        "Susceptible to linear cryptanalytic attacks",
        "Use for educational purposes only in constrained environments"
      ),
      new Vulnerability(
        "Small block size",
        "64-bit block size vulnerable to birthday attacks",
        "Avoid encrypting large amounts of data with single key"
      )
    ];

    // Test vectors using OpCodes byte arrays
    this.tests = [
      {
        text: "PRESENT-80 all zeros test vector - educational",
        uri: "https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31",
        input: OpCodes.Hex8ToBytes("0000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000"),
        expected: OpCodes.Hex8ToBytes("5579c1387b228445")
      },
      {
        text: "PRESENT-80 pattern test vector - educational",
        uri: "https://link.springer.com/chapter/10.1007/978-3-540-74735-2_31",
        input: OpCodes.Hex8ToBytes("0000000000000000"),
        key: OpCodes.Hex8ToBytes("ffffffffffffffffffff"),
        expected: OpCodes.Hex8ToBytes("e72c46c0f5945049")
      }
    ];

    // PRESENT Constants
    this.ROUNDS = 31;
    this.BLOCK_SIZE = 8;   // 64 bits
    this.KEY_SIZE = 10;    // 80 bits
    
    // PRESENT S-Box (4-bit substitution)
    this.SBOX = [
      0xC, 0x5, 0x6, 0xB, 0x9, 0x0, 0xA, 0xD,
      0x3, 0xE, 0xF, 0x8, 0x4, 0x7, 0x1, 0x2
    ];
    
    // PRESENT Inverse S-Box
    this.SBOX_INV = [
      0x5, 0xE, 0xF, 0x8, 0xC, 0x1, 0x2, 0xD,
      0xB, 0x4, 0x6, 0x3, 0x0, 0x7, 0x9, 0xA
    ];
  }

  CreateInstance(isInverse = false) {
    return new PresentInstance(this, isInverse);
  }
}

class PresentInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.roundKeys = null;
    this.inputBuffer = [];
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

    // Validate key size (80 bits / 10 bytes)
    if (keyBytes.length !== 10) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes. PRESENT requires 10 bytes (80 bits)`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    this.roundKeys = this._generateRoundKeys(keyBytes);
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

    // Validate input length for block cipher
    if (this.inputBuffer.length % this.BlockSize !== 0) {
      throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
    }

    const output = [];
    const blockSize = this.BlockSize;
    
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

  _encryptBlock(block) {
    if (block.length !== 8) {
      throw new Error("PRESENT requires exactly 8 bytes per block");
    }

    // Convert input to 64-bit state (as two 32-bit words)
    let state = this._bytesToState(block);
    
    // Apply 31 rounds
    for (let round = 0; round < this.algorithm.ROUNDS; round++) {
      // Add round key
      state = this._addRoundKey(state, this.roundKeys[round]);
      
      // Apply S-box layer
      state = this._sBoxLayer(state);
      
      // Apply permutation layer (skip on last round)
      if (round < this.algorithm.ROUNDS - 1) {
        state = this._permutationLayer(state);
      }
    }
    
    // Add final round key
    state = this._addRoundKey(state, this.roundKeys[this.algorithm.ROUNDS]);
    
    return this._stateToBytes(state);
  }

  _decryptBlock(block) {
    if (block.length !== 8) {
      throw new Error("PRESENT requires exactly 8 bytes per block");
    }

    // Convert input to 64-bit state (as two 32-bit words)
    let state = this._bytesToState(block);
    
    // Remove final round key
    state = this._addRoundKey(state, this.roundKeys[this.algorithm.ROUNDS]);
    
    // Apply 31 rounds in reverse
    for (let round = this.algorithm.ROUNDS - 1; round >= 0; round--) {
      // Apply inverse permutation layer (skip on first iteration)
      if (round < this.algorithm.ROUNDS - 1) {
        state = this._invPermutationLayer(state);
      }
      
      // Apply inverse S-box layer
      state = this._invSBoxLayer(state);
      
      // Add round key
      state = this._addRoundKey(state, this.roundKeys[round]);
    }
    
    return this._stateToBytes(state);
  }

  // Convert 8 bytes to 64-bit state (as two 32-bit words)
  _bytesToState(bytes) {
    const high = OpCodes.Pack32BE(bytes[0], bytes[1], bytes[2], bytes[3]);
    const low = OpCodes.Pack32BE(bytes[4], bytes[5], bytes[6], bytes[7]);
    return { high: high, low: low };
  }

  // Convert 64-bit state back to 8 bytes
  _stateToBytes(state) {
    const highBytes = OpCodes.Unpack32BE(state.high);
    const lowBytes = OpCodes.Unpack32BE(state.low);
    return [...highBytes, ...lowBytes];
  }

  // Add round key (XOR operation)
  _addRoundKey(state, roundKey) {
    return {
      high: (state.high ^ roundKey.high) >>> 0,
      low: (state.low ^ roundKey.low) >>> 0
    };
  }

  // Apply S-box to all 4-bit nibbles
  _sBoxLayer(state) {
    let result = { high: 0, low: 0 };
    
    // Process high 32 bits
    for (let i = 0; i < 8; i++) {
      const nibble = (state.high >>> (28 - i * 4)) & 0xF;
      const sboxValue = this.algorithm.SBOX[nibble];
      result.high |= (sboxValue << (28 - i * 4));
    }
    
    // Process low 32 bits
    for (let i = 0; i < 8; i++) {
      const nibble = (state.low >>> (28 - i * 4)) & 0xF;
      const sboxValue = this.algorithm.SBOX[nibble];
      result.low |= (sboxValue << (28 - i * 4));
    }
    
    return { high: result.high >>> 0, low: result.low >>> 0 };
  }

  // Apply inverse S-box to all 4-bit nibbles
  _invSBoxLayer(state) {
    let result = { high: 0, low: 0 };
    
    // Process high 32 bits
    for (let i = 0; i < 8; i++) {
      const nibble = (state.high >>> (28 - i * 4)) & 0xF;
      const sboxValue = this.algorithm.SBOX_INV[nibble];
      result.high |= (sboxValue << (28 - i * 4));
    }
    
    // Process low 32 bits
    for (let i = 0; i < 8; i++) {
      const nibble = (state.low >>> (28 - i * 4)) & 0xF;
      const sboxValue = this.algorithm.SBOX_INV[nibble];
      result.low |= (sboxValue << (28 - i * 4));
    }
    
    return { high: result.high >>> 0, low: result.low >>> 0 };
  }

  // Apply bit permutation layer following ISO/IEC 29192-2 specification
  _permutationLayer(state) {
    // PRESENT permutation formula: P(i) = (4 * i) mod 63 for i = 0..62, P(63) = 63
    let result = { high: 0, low: 0 };
    
    // Extract all 64 bits into array for permutation
    const bits = new Array(64);
    for (let i = 0; i < 32; i++) {
      bits[i] = (state.high >>> (31 - i)) & 1;
      bits[i + 32] = (state.low >>> (31 - i)) & 1;
    }
    
    // Apply PRESENT permutation
    const permutedBits = new Array(64);
    for (let i = 0; i < 64; i++) {
      if (i === 63) {
        permutedBits[63] = bits[63]; // Special case: bit 63 stays at position 63
      } else {
        permutedBits[(4 * i) % 63] = bits[i];
      }
    }
    
    // Reconstruct the 64-bit state from permuted bits
    for (let i = 0; i < 32; i++) {
      if (permutedBits[i]) {
        result.high |= (1 << (31 - i));
      }
      if (permutedBits[i + 32]) {
        result.low |= (1 << (31 - i));
      }
    }
    
    return { high: result.high >>> 0, low: result.low >>> 0 };
  }

  // Apply inverse bit permutation layer
  _invPermutationLayer(state) {
    // Inverse PRESENT permutation
    let result = { high: 0, low: 0 };
    
    // Extract all 64 bits into array for inverse permutation
    const bits = new Array(64);
    for (let i = 0; i < 32; i++) {
      bits[i] = (state.high >>> (31 - i)) & 1;
      bits[i + 32] = (state.low >>> (31 - i)) & 1;
    }
    
    // Apply inverse PRESENT permutation
    const permutedBits = new Array(64);
    for (let i = 0; i < 64; i++) {
      if (i === 63) {
        permutedBits[63] = bits[63]; // Special case: bit 63 stays at position 63
      } else {
        // Find source position j where (4 * j) mod 63 = i
        // This is equivalent to j = (16 * i) mod 63 (since 4 * 16 = 64 ≡ 1 mod 63)
        const sourcePos = (16 * i) % 63;
        permutedBits[sourcePos] = bits[i];
      }
    }
    
    // Reconstruct the 64-bit state from inverse permuted bits
    for (let i = 0; i < 32; i++) {
      if (permutedBits[i]) {
        result.high |= (1 << (31 - i));
      }
      if (permutedBits[i + 32]) {
        result.low |= (1 << (31 - i));
      }
    }
    
    return { high: result.high >>> 0, low: result.low >>> 0 };
  }

  // Generate round keys using PRESENT key schedule
  _generateRoundKeys(keyBytes) {
    const roundKeys = [];
    
    // Convert key to 80-bit BigInt (big-endian)
    let key = BigInt(0);
    for (let i = 0; i < this.algorithm.KEY_SIZE; i++) {
      const byteValue = BigInt(keyBytes[i] & 0xFF);
      key = key * BigInt(256) + byteValue; // Build big-endian integer
    }
    
    // Generate 32 round keys (rounds 0-31 + final key)
    for (let round = 0; round <= this.algorithm.ROUNDS; round++) {
      // Extract 64-bit round key from leftmost bits (bits 79-16)
      const roundKey64 = key >> BigInt(16); // Shift right by 16 to get top 64 bits
      
      // Split into high and low 32-bit words
      const roundKeyHigh = Number((roundKey64 >> BigInt(32)) & BigInt(0xFFFFFFFF));
      const roundKeyLow = Number(roundKey64 & BigInt(0xFFFFFFFF));
      
      roundKeys[round] = {
        high: roundKeyHigh >>> 0,
        low: roundKeyLow >>> 0
      };
      
      // Update key state for next round (if not last round)
      if (round < this.algorithm.ROUNDS) {
        // Step 1: Rotate left by 61 positions
        const mask = (BigInt(1) << BigInt(19)) - BigInt(1); // 2^19 - 1
        const leftPart = key >> BigInt(19); // key >> 19
        const rightPart = (key & mask) << BigInt(61); // (key & mask) << 61
        key = rightPart + leftPart;
        
        // Step 2: Apply S-box to leftmost 4 bits (bits 79-76)
        const topNibble = Number(key >> BigInt(76));
        const sboxValue = BigInt(this.algorithm.SBOX[topNibble]);
        
        // Replace top 4 bits
        const bottomPart = key & ((BigInt(1) << BigInt(76)) - BigInt(1)); // key & (2**76-1)
        key = (sboxValue << BigInt(76)) + bottomPart;
        
        // Step 3: XOR bits with round counter at position 15
        const counterValue = BigInt(round + 1) << BigInt(15);
        key = key ^ counterValue;
        
        // Ensure key stays within 80-bit range
        key = key & ((BigInt(1) << BigInt(80)) - BigInt(1));
      }
    }
    
    return roundKeys;
  }
}

// Register the algorithm
RegisterAlgorithm(new PresentAlgorithm());

// Export for module usage  
if (typeof module !== 'undefined' && module.exports) {
  module.exports = new PresentAlgorithm();
}