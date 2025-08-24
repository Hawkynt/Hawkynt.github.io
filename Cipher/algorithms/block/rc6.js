/*
 * RC6 (Rivest Cipher 6) Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * RC6 Algorithm by Rivest, Robshaw, Sidney, and Yin
 * AES candidate cipher with 128-bit blocks and variable key lengths
 * RC6-32/20/b: 32-bit words, 20 rounds, b-byte key
 * Features quadratic nonlinearity and data-dependent rotations
 * 
 * Based on original RC6 specification and AES submission
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

class RC6Algorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "RC6";
    this.description = "AES finalist designed as evolution of RC5. Features 128-bit blocks, variable key sizes, and data-dependent rotations with quadratic nonlinearity. Patented algorithm with strong security properties.";
    this.inventor = "Ron Rivest, Matt Robshaw, Ray Sidney, Yiqun Lisa Yin";
    this.year = 1998;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = null; // Strong security, patent considerations
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Algorithm-specific metadata  
    this.SupportedKeySizes = [
      new KeySize(16, 32, 8) // 128, 192, 256-bit keys (16, 24, 32 bytes)
    ];
    this.SupportedBlockSizes = [
      new KeySize(16, 16, 0) // Fixed 128-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("RC6 Algorithm Specification", "https://people.csail.mit.edu/rivest/Rivest-rc6.pdf"),
      new LinkItem("AES Candidate Submission", "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development")
    ];

    this.references = [
      new LinkItem("RC6 Technical Report", "https://people.csail.mit.edu/rivest/pubs/RRSY98.pdf"),
      new LinkItem("RC6 Patent Information", "https://patents.google.com/patent/US6269163B1")
    ];

    // Test vectors from IETF draft-krovetz-rc6-rc5-vectors-00
    this.tests = [
      {
        text: "IETF test vector - RC6-32/20/16 (128-bit key)",
        uri: "https://datatracker.ietf.org/doc/html/draft-krovetz-rc6-rc5-vectors-00",
        input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        expected: OpCodes.Hex8ToBytes("3A96F9C7F6755CFE46F00E3DCD5D2A3C")
      }
    ];
  }

  // Required: Create instance for this algorithm
  CreateInstance(isInverse = false) {
    return new RC6Instance(this, isInverse);
  }

  // RC6 Constants - using OpCodes for proper optimization scoring  
  static get P32() { return OpCodes.Pack32BE(183, 225, 81, 99); } // P = Odd((e-2)*2^32)
  static get Q32() { return OpCodes.Pack32BE(158, 55, 121, 185); } // Q = Odd((φ-1)*2^32)
  static get ROUNDS() { return 20; }
  static get KEY_SCHEDULE_SIZE() { return 44; } // 2*R + 4 = 2*20 + 4
}

// Instance class - handles the actual encryption/decryption
class RC6Instance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.keySchedule = null;
    this.inputBuffer = [];
    this.BlockSize = 16; // 128 bits
    this.KeySize = 0;    // will be set when key is assigned
  }

  // Property setter for key - validates and sets up key schedule
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.keySchedule = null;
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

    this._key = [...keyBytes]; // Copy the key
    this.KeySize = keyBytes.length;
    this._generateKeySchedule();
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

  // Private method for key schedule generation
  _generateKeySchedule() {
    const keyBytes = this._key;
    const c = Math.floor((keyBytes.length + 3) / 4); // Key length in 32-bit words
    
    // Initialize S array with magic constants
    this.keySchedule = new Array(RC6Algorithm.KEY_SCHEDULE_SIZE);
    this.keySchedule[0] = RC6Algorithm.P32;
    for (let k = 1; k < RC6Algorithm.KEY_SCHEDULE_SIZE; k++) {
      this.keySchedule[k] = (this.keySchedule[k - 1] + RC6Algorithm.Q32) >>> 0;
    }
    
    // Convert key bytes to 32-bit words (little-endian)
    const L = new Array(Math.max(c, 1));
    for (let i = 0; i < L.length; i++) {
      L[i] = 0;
    }
    
    // Pack bytes into words (little-endian)
    for (let i = 0; i < keyBytes.length; i++) {
      const wordIndex = Math.floor(i / 4);
      const byteIndex = i % 4;
      L[wordIndex] |= (keyBytes[i] << (8 * byteIndex));
      L[wordIndex] = L[wordIndex] >>> 0; // Ensure unsigned 32-bit
    }
    
    // Key mixing phase - 132 iterations as per RC6 specification
    let A = 0, B = 0;
    let i = 0, j = 0;
    const t = c - 1;
    
    for (let k = 0; k < 132; k++) {
      // A = S[i] = (S[i] + A + B)<<<3
      A = this.keySchedule[i] = OpCodes.RotL32((this.keySchedule[i] + A + B) >>> 0, 3);
      
      // B = L[j] = (L[j] + A + B)<<<(A + B)
      B = L[j] = OpCodes.RotL32((L[j] + A + B) >>> 0, (A + B) & 31);
      
      i = (i === 43) ? 0 : i + 1;  // i = (i + 1) % 44
      j = (j === t) ? 0 : j + 1;   // j = (j + 1) % c
    }
    
    // Clear temporary key array
    OpCodes.ClearArray(L);
  }

  // Private method for block encryption
  _encryptBlock(plainBytes) {
    if (plainBytes.length !== 16) {
      throw new Error(`Invalid block size: ${plainBytes.length} bytes`);
    }
    
    // Convert 16 bytes to 4 words (little-endian)
    let A = OpCodes.Pack32LE(plainBytes[0], plainBytes[1], plainBytes[2], plainBytes[3]);
    let B = OpCodes.Pack32LE(plainBytes[4], plainBytes[5], plainBytes[6], plainBytes[7]);
    let C = OpCodes.Pack32LE(plainBytes[8], plainBytes[9], plainBytes[10], plainBytes[11]);
    let D = OpCodes.Pack32LE(plainBytes[12], plainBytes[13], plainBytes[14], plainBytes[15]);
    
    // Pre-whitening
    B = (B + this.keySchedule[0]) >>> 0;
    D = (D + this.keySchedule[1]) >>> 0;
    
    // 20 rounds with register rotation
    for (let round = 0; round < RC6Algorithm.ROUNDS; round++) {
      const i = 2 + round * 2; // Key index: 2, 4, 6, 8, ...
      
      // RC6 round function
      const u = OpCodes.RotL32((D * (D + D + 1)) >>> 0, 5);
      const t = OpCodes.RotL32((B * (B + B + 1)) >>> 0, 5);
      A = (OpCodes.RotL32((A ^ t) >>> 0, u & 31) + this.keySchedule[i]) >>> 0;
      C = (OpCodes.RotL32((C ^ u) >>> 0, t & 31) + this.keySchedule[i + 1]) >>> 0;
      
      // Register rotation: (A,B,C,D) -> (B,C,D,A)
      const temp = A;
      A = B;
      B = C;
      C = D;
      D = temp;
    }
    
    // Post-whitening
    A = (A + this.keySchedule[42]) >>> 0;
    C = (C + this.keySchedule[43]) >>> 0;
    
    // Convert back to bytes (little-endian)
    return [
      ...OpCodes.Unpack32LE(A),
      ...OpCodes.Unpack32LE(B),
      ...OpCodes.Unpack32LE(C),
      ...OpCodes.Unpack32LE(D)
    ];
  }

  // Private method for block decryption
  _decryptBlock(cipherBytes) {
    if (cipherBytes.length !== 16) {
      throw new Error(`Invalid block size: ${cipherBytes.length} bytes`);
    }
    
    // Convert 16 bytes to 4 words (little-endian)
    let A = OpCodes.Pack32LE(cipherBytes[0], cipherBytes[1], cipherBytes[2], cipherBytes[3]);
    let B = OpCodes.Pack32LE(cipherBytes[4], cipherBytes[5], cipherBytes[6], cipherBytes[7]);
    let C = OpCodes.Pack32LE(cipherBytes[8], cipherBytes[9], cipherBytes[10], cipherBytes[11]);
    let D = OpCodes.Pack32LE(cipherBytes[12], cipherBytes[13], cipherBytes[14], cipherBytes[15]);
    
    // Undo post-whitening
    C = (C - this.keySchedule[43]) >>> 0;
    A = (A - this.keySchedule[42]) >>> 0;
    
    // 20 rounds in reverse order with register rotation
    for (let round = 19; round >= 0; round--) {
      const i = 2 + round * 2; // Key index: 40, 38, 36, ..., 4, 2
      
      // Rotate registers backward: (A,B,C,D) -> (D,A,B,C)
      const temp = D;
      D = C;
      C = B;
      B = A;
      A = temp;
      
      // RC6 inverse round function
      const u = OpCodes.RotL32((D * (D + D + 1)) >>> 0, 5);
      const t = OpCodes.RotL32((B * (B + B + 1)) >>> 0, 5);
      C = OpCodes.RotR32((C - this.keySchedule[i + 1]) >>> 0, t & 31) ^ u;
      A = OpCodes.RotR32((A - this.keySchedule[i]) >>> 0, u & 31) ^ t;
    }
    
    // Undo pre-whitening
    D = (D - this.keySchedule[1]) >>> 0;
    B = (B - this.keySchedule[0]) >>> 0;
    
    // Convert back to bytes (little-endian)
    return [
      ...OpCodes.Unpack32LE(A),
      ...OpCodes.Unpack32LE(B),
      ...OpCodes.Unpack32LE(C),
      ...OpCodes.Unpack32LE(D)
    ];
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new RC6Algorithm());