/*
 * TEA (Tiny Encryption Algorithm) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Implements the Tiny Encryption Algorithm by David Wheeler and Roger Needham (1994).
 * 64-bit blocks with 128-bit keys using 32 rounds.
 * Educational implementation - known cryptographic weaknesses make it unsuitable for production.
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

class TEAAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "TEA";
    this.description = "Tiny Encryption Algorithm with 64-bit blocks and 128-bit keys using simple XOR, shift, and add operations. Fast but has known cryptanalytic weaknesses.";
    this.inventor = "David Wheeler, Roger Needham";
    this.year = 1994;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.BROKEN;
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.GB;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(16, 16, 0) // Fixed 128-bit keys
    ];
    this.SupportedBlockSizes = [
      new KeySize(8, 8, 0) // Fixed 64-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("TEA: A Tiny Encryption Algorithm", "https://www.cix.co.uk/~klockstone/tea.htm"),
      new LinkItem("Cambridge Computer Laboratory TEA", "https://www.cl.cam.ac.uk/teaching/1415/SecurityII/tea.pdf"),
      new LinkItem("Original TEA Paper", "https://link.springer.com/chapter/10.1007/3-540-60590-8_29")
    ];

    this.references = [
      new LinkItem("Crypto++ TEA Implementation", "https://github.com/weidai11/cryptopp/blob/master/tea.cpp"),
      new LinkItem("Bouncy Castle TEA Implementation", "https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines"),
      new LinkItem("TEA Cryptanalysis Papers", "https://eprint.iacr.org/")
    ];

    // Known vulnerabilities
    this.knownVulnerabilities = [
      new Vulnerability(
        "Related-key attacks",
        "TEA is vulnerable to related-key attacks due to weak key schedule",
        "Use XTEA or modern ciphers like AES instead"
      ),
      new Vulnerability(
        "Equivalent keys",
        "Multiple keys can encrypt to the same ciphertext",
        "Algorithm is obsolete - use modern alternatives"
      )
    ];

    // Test vectors from TEA specification
    this.tests = [
      {
        text: "TEA All Zeros Test Vector",
        uri: "https://www.cix.co.uk/~klockstone/tea.htm",
        input: OpCodes.Hex8ToBytes("0000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("41EA3A0A94BAA940")
      },
      {
        text: "TEA All Ones Test Vector",
        uri: "https://www.cix.co.uk/~klockstone/tea.htm",
        input: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFF"),
        key: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
        expected: OpCodes.Hex8ToBytes("319BBEFB016ABDB2")
      },
      {
        text: "TEA Sequential Pattern Test",
        uri: "https://www.cix.co.uk/~klockstone/tea.htm",
        input: OpCodes.Hex8ToBytes("0123456789ABCDEF"),
        key: OpCodes.Hex8ToBytes("0123456789ABCDEFFEDCBA9876543210"),
        expected: OpCodes.Hex8ToBytes("17B5BA5198581091")
      },
      {
        text: "TEA ASCII Test Vector",
        uri: "https://www.cix.co.uk/~klockstone/tea.htm",
        input: OpCodes.AnsiToBytes("HELLO123"),
        key: OpCodes.AnsiToBytes("YELLOW SUBMARINE"),
        expected: OpCodes.Hex8ToBytes("7ADC06304F85383E")
      },
      {
        text: "TEA Single Bit Key Test",
        uri: "https://www.cix.co.uk/~klockstone/tea.htm",
        input: OpCodes.Hex8ToBytes("0000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000001"),
        expected: OpCodes.Hex8ToBytes("0C6D2A1D930C3FAB")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new TEAInstance(this, isInverse);
  }
}

class TEAInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.inputBuffer = [];
    this.BlockSize = 8;
    this.KeySize = 0;
    
    // TEA constants
    this.DELTA = OpCodes.Pack32BE(...OpCodes.Hex8ToBytes("9E3779B9")); // Magic constant (2^32 / golden ratio)
    this.ROUNDS = 32;        // Standard TEA uses 32 rounds
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.KeySize = 0;
      return;
    }

    // Validate key size (must be 16 bytes)
    if (keyBytes.length !== 16) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes. TEA requires exactly 16 bytes`);
    }

    this._key = [...keyBytes];
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

  _encryptBlock(block) {
    // Convert block to two 32-bit words (big-endian)
    let v0 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
    let v1 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
    
    // Extract key as four 32-bit words (big-endian)
    const k0 = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
    const k1 = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
    const k2 = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
    const k3 = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);
    
    let sum = 0;
    
    // 32 rounds of TEA encryption
    for (let i = 0; i < this.ROUNDS; i++) {
      sum = (sum + this.DELTA) >>> 0;
      v0 = (v0 + (((v1 << 4) + k0) ^ (v1 + sum) ^ ((v1 >>> 5) + k1))) >>> 0;
      v1 = (v1 + (((v0 << 4) + k2) ^ (v0 + sum) ^ ((v0 >>> 5) + k3))) >>> 0;
    }
    
    // Convert back to bytes
    const v0Bytes = OpCodes.Unpack32BE(v0);
    const v1Bytes = OpCodes.Unpack32BE(v1);
    
    return [...v0Bytes, ...v1Bytes];
  }

  _decryptBlock(block) {
    // Convert block to two 32-bit words (big-endian)
    let v0 = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
    let v1 = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
    
    // Extract key as four 32-bit words (big-endian)
    const k0 = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
    const k1 = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);
    const k2 = OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]);
    const k3 = OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]);
    
    let sum = (this.DELTA * this.ROUNDS) >>> 0;
    
    // 32 rounds of TEA decryption (reverse order)
    for (let i = 0; i < this.ROUNDS; i++) {
      v1 = (v1 - (((v0 << 4) + k2) ^ (v0 + sum) ^ ((v0 >>> 5) + k3))) >>> 0;
      v0 = (v0 - (((v1 << 4) + k0) ^ (v1 + sum) ^ ((v1 >>> 5) + k1))) >>> 0;
      sum = (sum - this.DELTA) >>> 0;
    }
    
    // Convert back to bytes
    const v0Bytes = OpCodes.Unpack32BE(v0);
    const v1Bytes = OpCodes.Unpack32BE(v1);
    
    return [...v0Bytes, ...v1Bytes];
  }
}

// Register the algorithm
RegisterAlgorithm(new TEAAlgorithm());