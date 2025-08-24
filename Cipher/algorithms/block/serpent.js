/*
 * Serpent Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Serpent Algorithm by Anderson, Biham, and Knudsen
 * - 128-bit block size, variable key length (128, 192, 256 bits)
 * - 32 rounds with 8 different 4x4 S-boxes
 * - Substitution-permutation network structure
 * - AES finalist with conservative security margin
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

class SerpentAlgorithm extends AlgorithmFramework.BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Serpent";
    this.description = "AES finalist cipher by Anderson, Biham, and Knudsen with 32 rounds and 8 S-boxes. Uses substitution-permutation network with 128-bit blocks and 128/192/256-bit keys. Conservative security design.";
    this.inventor = "Ross Anderson, Eli Biham, Lars Knudsen";
    this.year = 1998;
    this.category = AlgorithmFramework.CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = null; // Conservative assessment - strong cipher but AES preferred
    this.complexity = AlgorithmFramework.ComplexityType.ADVANCED;
    this.country = AlgorithmFramework.CountryCode.GB;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new AlgorithmFramework.KeySize(16, 16, 1), // 128-bit
      new AlgorithmFramework.KeySize(24, 24, 1), // 192-bit
      new AlgorithmFramework.KeySize(32, 32, 1)  // 256-bit
    ];
    this.SupportedBlockSizes = [
      new AlgorithmFramework.KeySize(16, 16, 1) // Fixed 128-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new AlgorithmFramework.LinkItem("Serpent Algorithm Specification", "https://www.cl.cam.ac.uk/~rja14/serpent.html"),
      new AlgorithmFramework.LinkItem("Serpent: A New Block Cipher Proposal", "https://www.cl.cam.ac.uk/~rja14/Papers/serpent.pdf"),
      new AlgorithmFramework.LinkItem("NIST AES Candidate Submission", "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development")
    ];

    this.references = [
      new AlgorithmFramework.LinkItem("Crypto++ Serpent Implementation", "https://github.com/weidai11/cryptopp/blob/master/serpent.cpp"),
      new AlgorithmFramework.LinkItem("libgcrypt Serpent Implementation", "https://github.com/gpg/libgcrypt/blob/master/cipher/serpent.c"),
      new AlgorithmFramework.LinkItem("Bouncy Castle Serpent Implementation", "https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines")
    ];

    // No known practical attacks against full Serpent
    this.knownVulnerabilities = [
      new AlgorithmFramework.Vulnerability("Performance vs AES", "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development", "Slower than AES, which contributed to AES selection by NIST", "AES preferred for performance-critical applications, Serpent acceptable for high-security needs")
    ];

    // Test vectors from official specification
    this.tests = [
      {
        text: "Serpent 128-bit key test vector",
        uri: "https://www.cl.cam.ac.uk/~rja14/serpent.html",
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("d29d576fcea3a3a7ed9099f29273d78e")
      },
      {
        text: "Serpent 256-bit key test vector", 
        uri: "https://www.cl.cam.ac.uk/~rja14/serpent.html",
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("b2288b968ae8b08648d1ce9606fd992d")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new SerpentInstance(this, isInverse);
  }
}

class SerpentInstance extends AlgorithmFramework.IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.roundKeys = null;
    this.inputBuffer = [];
    this.BlockSize = 16;
    this.KeySize = 0;
    
    // Serpent constants
    this.ROUNDS = 32;
    this.PHI = 0x9e3779b9; // Golden ratio constant for key schedule
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
    
    // Generate round keys
    this.roundKeys = this._generateKeySchedule(keyBytes);
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
    
    // Process each 16-byte block
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

  // S-box transformations using optimized boolean functions
  // S0 transformation (15 terms)
  _sb0(a, b, c, d) {
    let t1 = a ^ d;
    let t2 = a & d;
    let t3 = c ^ t1;
    let t6 = b & t1;
    let t4 = b ^ t3;
    let t10 = ~t3;
    let h = t2 ^ t4;
    let t7 = a ^ t6;
    let t14 = ~t7;
    let t8 = c | t7;
    let t11 = t3 ^ t7;
    let g = t4 ^ t8;
    let t12 = h & t11;
    let f = t10 ^ t12;
    let e = t12 ^ t14;
    return [e, f, g, h];
  }

  // Inverse S0 transformation (15 terms)
  _ib0(a, b, c, d) {
    let t1 = ~a;
    let t2 = a ^ b;
    let t3 = t1 | t2;
    let t4 = d ^ t3;
    let t7 = d & t2;
    let t5 = c ^ t4;
    let t8 = t1 ^ t7;
    let g = t2 ^ t5;
    let t11 = a & t4;
    let t9 = g & t8;
    let t14 = t5 ^ t8;
    let f = t4 ^ t9;
    let t12 = t5 | f;
    let h = t11 ^ t12;
    let e = h ^ t14;
    return [e, f, g, h];
  }

  // S1 transformation
  _sb1(a, b, c, d) {
    let t2 = ~a;
    let t3 = b ^ t2;
    let t4 = a | b;
    let t7 = a ^ d;
    let h = t3 & t7;
    let t6 = a ^ t3;
    let g = t4 ^ h;
    let t9 = b | h;
    let t11 = t4 & t7;
    let t8 = t6 ^ t9;
    let e = t2 ^ t11;
    let t12 = c ^ t11;
    let f = t9 ^ e;
    let t14 = c & e;
    let t13 = t8 ^ t12;
    let t15 = t6 & t14;
    let t16 = f ^ t15;
    let w = t13 ^ t16;
    return [h, w, g, f];
  }

  // Inverse S1 transformation  
  _ib1(a, b, c, d) {
    let t1 = a ^ d;
    let t2 = a & b;
    let t3 = b ^ c;
    let t4 = a ^ t3;
    let t5 = b | d;
    let t7 = c | t1;
    let t6 = t4 & t5;
    let t8 = t2 | t7;
    let g = t4 ^ t8;
    let t10 = ~g;
    let t11 = t5 & t7;
    let t12 = t1 ^ t6;
    let t13 = t10 | t12;
    let t14 = t3 ^ t11;
    let e = t13 ^ t14;
    let h = t3 & e;
    let t17 = t10 ^ h;
    let f = t12 ^ t17;
    return [f, g, h, e];
  }

  // S2 transformation
  _sb2(a, b, c, d) {
    let t1 = ~a;
    let t2 = b ^ d;
    let t3 = c & t1;
    let e = t2 ^ t3;
    let t5 = c ^ t1;
    let t6 = c ^ e;
    let t7 = b & t6;
    let f = t5 ^ t7;
    let g = a ^ ((d | t7) & (e | t5));
    let h = (t2 & t5) ^ g;
    return [e, f, g, h];
  }

  // Inverse S2 transformation
  _ib2(a, b, c, d) {
    let t1 = b ^ d;
    let t2 = ~t1;
    let t3 = a ^ c;
    let t4 = c ^ t1;
    let t7 = a | t2;
    let t5 = b & t4;
    let t8 = t3 | t5;
    let t6 = t3 ^ t7;
    let f = t6 ^ t8;
    let h = ((a ^ t4) & t8) ^ t1;
    let e = t1 ^ ((t2 | b) & t3);
    let g = (d & f) ^ h ^ e;
    return [e, f, g, h];
  }

  // S3 transformation
  _sb3(a, b, c, d) {
    let t1 = a ^ c;
    let t2 = d ^ t1;
    let t3 = a & t2;
    let t4 = d ^ t3;
    let t5 = b & t4;
    let g = t2 ^ t5;
    let t7 = a | g;
    let t8 = b | d;
    let t11 = a | d;
    let t9 = t4 & t7;
    let t10 = t8 ^ t9;
    let t12 = b ^ t11;
    let t13 = t7 ^ t10;
    let t14 = t1 ^ t12;
    let f = t13 ^ t14;
    let h = ~t13;
    let e = t14 ^ h;
    return [e, f, g, h];
  }

  // Inverse S3 transformation
  _ib3(a, b, c, d) {
    let t1 = a | b;
    let t2 = b ^ c;
    let t3 = b & t2;
    let t4 = a ^ t3;
    let t5 = c ^ t4;
    let t6 = d | t4;
    let e = t2 ^ t6;
    let t8 = t2 | e;
    let t9 = d & t8;
    let g = t5 ^ t9;
    let t11 = t1 ^ e;
    let t12 = g ^ t11;
    let t13 = t5 & t11;
    let f = e ^ t13;
    let h = t5 ^ t12;
    return [e, f, g, h];
  }

  // S4 transformation
  _sb4(a, b, c, d) {
    let t1 = a ^ d;
    let t2 = d & t1;
    let t3 = c ^ t2;
    let t4 = b | t3;
    let h = t1 ^ t4;
    let t6 = ~b;
    let t7 = t1 | t6;
    let e = t3 ^ t7;
    let t9 = a & e;
    let t10 = t1 ^ t6;
    let t11 = t4 & t10;
    let g = t9 ^ t11;
    let t13 = a ^ t3;
    let t14 = t10 & g;
    let f = t13 ^ t14;
    return [e, f, g, h];
  }

  // Inverse S4 transformation
  _ib4(a, b, c, d) {
    let t1 = c | d;
    let t2 = a & t1;
    let t3 = b ^ t2;
    let t4 = a & t3;
    let t5 = c ^ t4;
    let e = d ^ t5;
    let t7 = ~a;
    let t8 = t5 & e;
    let t9 = t3 | t8;
    let g = t7 ^ t9;
    let t11 = a ^ e;
    let t12 = e | g;
    let t13 = t3 ^ t12;
    let h = t11 ^ t13;
    let t15 = t3 & h;
    let f = e ^ t15;
    return [e, f, g, h];
  }

  // S5 transformation
  _sb5(a, b, c, d) {
    let t1 = ~a;
    let t2 = a ^ b;
    let t3 = a ^ d;
    let t4 = c ^ t1;
    let t5 = t2 | t3;
    let e = t4 ^ t5;
    let t7 = d & e;
    let t8 = t2 ^ e;
    let t9 = t1 | t7;
    let f = t8 ^ t9;
    let t11 = t2 | t7;
    let t12 = t3 ^ t9;
    let t13 = f & t12;
    let g = t11 ^ t13;
    let t15 = t1 ^ t7;
    let h = t12 ^ t15;
    return [e, f, g, h];
  }

  // Inverse S5 transformation
  _ib5(a, b, c, d) {
    let t1 = ~c;
    let t2 = b & t1;
    let t3 = d ^ t2;
    let t4 = a & t3;
    let t5 = b ^ t1;
    let h = t4 ^ t5;
    let t7 = b | h;
    let t8 = a & t7;
    let e = t3 ^ t8;
    let t10 = a | d;
    let t11 = t1 ^ t7;
    let f = t10 ^ t11;
    let t13 = a ^ c;
    let t14 = b & t10;
    let t15 = t4 | t13;
    let g = t14 ^ t15;
    return [e, f, g, h];
  }

  // S6 transformation
  _sb6(a, b, c, d) {
    let t1 = ~a;
    let t2 = a ^ d;
    let t3 = b ^ t2;
    let t4 = t1 | t2;
    let t5 = c ^ t4;
    let f = b ^ t5;
    let t13 = ~t5;
    let t7 = t2 | f;
    let t8 = d ^ t7;
    let t9 = t5 & t8;
    let g = t3 ^ t9;
    let t11 = t5 ^ t8;
    let e = g ^ t11;
    let t14 = t3 & t11;
    let h = t13 ^ t14;
    return [e, f, g, h];
  }

  // Inverse S6 transformation
  _ib6(a, b, c, d) {
    let t1 = ~a;
    let t2 = a ^ b;
    let t3 = c ^ t2;
    let t4 = c | t1;
    let t5 = d ^ t4;
    let t13 = d & t1;
    let f = t3 ^ t5;
    let t7 = t3 & t5;
    let t8 = t2 ^ t7;
    let t9 = b | t8;
    let h = t5 ^ t9;
    let t11 = b | h;
    let e = t8 ^ t11;
    let t14 = t3 ^ t11;
    let g = t13 ^ t14;
    return [e, f, g, h];
  }

  // S7 transformation
  _sb7(a, b, c, d) {
    let t1 = ~c;
    let t2 = b ^ c;
    let t3 = b | t1;
    let t4 = d ^ t3;
    let t5 = a & t4;
    let g = t2 ^ t5;
    let t7 = a ^ d;
    let t8 = b ^ t5;
    let t9 = t2 | t8;
    let e = t7 ^ t9;
    let t11 = ~t4;
    let t12 = g & e;
    let f = t11 ^ t12;
    let t14 = t2 ^ e;
    let h = g ^ t14;
    return [e, f, g, h];
  }

  // Inverse S7 transformation
  _ib7(a, b, c, d) {
    let t1 = a & b;
    let t2 = a | b;
    let t3 = c | t1;
    let t4 = d & t2;
    let h = t3 ^ t4;
    let t6 = ~d;
    let t7 = b ^ t4;
    let t8 = h ^ t6;
    let t11 = c ^ t7;
    let t9 = t7 | t8;
    let f = a ^ t9;
    let t12 = d | f;
    let e = t11 ^ t12;
    let t14 = a & h;
    let g = t8 ^ t14;
    return [e, f, g, h];
  }

  // Similar implementations for S1-S7 and their inverses would follow...
  // For brevity, implementing simplified S-box functions
  _sbox(sboxNum, x0, x1, x2, x3) {
    // Complete Serpent S-box implementation (all 8 S-boxes)
    switch (sboxNum) {
      case 0: return this._sb0(x0, x1, x2, x3);
      case 1: return this._sb1(x0, x1, x2, x3);
      case 2: return this._sb2(x0, x1, x2, x3);
      case 3: return this._sb3(x0, x1, x2, x3);
      case 4: return this._sb4(x0, x1, x2, x3);
      case 5: return this._sb5(x0, x1, x2, x3);
      case 6: return this._sb6(x0, x1, x2, x3);
      case 7: return this._sb7(x0, x1, x2, x3);
      default: throw new Error(`Invalid S-box number: ${sboxNum}`);
    }
  }

  _sboxInv(sboxNum, x0, x1, x2, x3) {
    // Complete Serpent inverse S-box implementation (all 8 inverse S-boxes)
    switch (sboxNum) {
      case 0: return this._ib0(x0, x1, x2, x3);
      case 1: return this._ib1(x0, x1, x2, x3);
      case 2: return this._ib2(x0, x1, x2, x3);
      case 3: return this._ib3(x0, x1, x2, x3);
      case 4: return this._ib4(x0, x1, x2, x3);
      case 5: return this._ib5(x0, x1, x2, x3);
      case 6: return this._ib6(x0, x1, x2, x3);
      case 7: return this._ib7(x0, x1, x2, x3);
      default: throw new Error(`Invalid inverse S-box number: ${sboxNum}`);
    }
  }

  // Linear transformation function
  _linearTransform(x0, x1, x2, x3) {
    x0 = OpCodes.RotL32(x0, 13);
    x2 = OpCodes.RotL32(x2, 3);
    x3 ^= x2 ^ ((x0 << 3) >>> 0);
    x1 ^= x0 ^ x2;
    x3 = OpCodes.RotL32(x3, 7);
    x1 = OpCodes.RotL32(x1, 1);
    x0 ^= x1 ^ x3;
    x2 ^= x3 ^ ((x1 << 7) >>> 0);
    x0 = OpCodes.RotL32(x0, 5);
    x2 = OpCodes.RotL32(x2, 22);
    
    return [x0, x1, x2, x3];
  }

  // Inverse linear transformation function
  _linearTransformInv(x0, x1, x2, x3) {
    x2 = OpCodes.RotR32(x2, 22);
    x0 = OpCodes.RotR32(x0, 5);
    x2 ^= x3 ^ ((x1 << 7) >>> 0);
    x0 ^= x1 ^ x3;
    x3 = OpCodes.RotR32(x3, 7);
    x1 = OpCodes.RotR32(x1, 1);
    x3 ^= x2 ^ ((x0 << 3) >>> 0);
    x1 ^= x0 ^ x2;
    x2 = OpCodes.RotR32(x2, 3);
    x0 = OpCodes.RotR32(x0, 13);
    
    return [x0, x1, x2, x3];
  }

  // Key scheduling function
  _generateKeySchedule(key) {
    // Pad key to 256 bits if necessary
    const keyWords = new Array(8).fill(0);
    
    // Copy key bytes into words
    for (let i = 0; i < Math.min(key.length, 32); i++) {
      const wordIndex = Math.floor(i / 4);
      const byteIndex = i % 4;
      keyWords[wordIndex] |= (key[i] << (byteIndex * 8));
    }
    
    // If key is shorter than 256 bits, apply padding
    if (key.length < 32) {
      const padIndex = key.length;
      const wordIndex = Math.floor(padIndex / 4);
      const byteIndex = padIndex % 4;
      keyWords[wordIndex] |= (1 << (byteIndex * 8));
    }
    
    // Generate extended key
    const extendedKey = new Array(140);
    
    // Copy initial key words
    for (let i = 0; i < 8; i++) {
      extendedKey[i] = keyWords[i] >>> 0; // Ensure unsigned 32-bit
    }
    
    // Generate remaining key words
    for (let i = 8; i < 140; i++) {
      const temp = extendedKey[i - 8] ^ extendedKey[i - 5] ^ extendedKey[i - 3] ^ extendedKey[i - 1] ^ this.PHI ^ (i - 8);
      extendedKey[i] = OpCodes.RotL32(temp, 11);
    }
    
    // Apply S-boxes to subkeys
    const roundKeys = [];
    
    for (let round = 0; round < 33; round++) {
      const baseIndex = round * 4 + 8;
      const sboxIndex = (7 - (round % 8)) % 8; // Correct S-box order for key schedule
      
      const x0 = extendedKey[baseIndex];
      const x1 = extendedKey[baseIndex + 1];
      const x2 = extendedKey[baseIndex + 2];
      const x3 = extendedKey[baseIndex + 3];
      
      const transformed = this._sbox(sboxIndex, x0, x1, x2, x3);
      roundKeys.push(transformed);
    }
    
    return roundKeys;
  }

  // Encrypt a block
  _encryptBlock(block) {
    if (block.length !== 16) {
      throw new Error('Serpent block size must be exactly 16 bytes');
    }

    // Convert plaintext to 32-bit words (little-endian)
    let x0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
    let x1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
    let x2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
    let x3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

    const sboxOrder = [0, 1, 2, 3, 4, 5, 6, 7]; // S-box order for encryption

    // 32 encryption rounds
    for (let round = 0; round < this.ROUNDS; round++) {
      // Key mixing
      x0 ^= this.roundKeys[round][0];
      x1 ^= this.roundKeys[round][1];
      x2 ^= this.roundKeys[round][2];
      x3 ^= this.roundKeys[round][3];

      // S-box substitution
      const sboxIndex = sboxOrder[round % 8];
      const sboxResult = this._sbox(sboxIndex, x0, x1, x2, x3);
      x0 = sboxResult[0];
      x1 = sboxResult[1];
      x2 = sboxResult[2];
      x3 = sboxResult[3];

      // Linear transformation (except in the last round)
      if (round < this.ROUNDS - 1) {
        const ltResult = this._linearTransform(x0, x1, x2, x3);
        x0 = ltResult[0];
        x1 = ltResult[1];
        x2 = ltResult[2];
        x3 = ltResult[3];
      }
    }

    // Final key mixing
    x0 ^= this.roundKeys[32][0];
    x1 ^= this.roundKeys[32][1];
    x2 ^= this.roundKeys[32][2];
    x3 ^= this.roundKeys[32][3];

    // Convert back to bytes (little-endian)
    const result = [];
    const bytes0 = OpCodes.Unpack32LE(x0);
    const bytes1 = OpCodes.Unpack32LE(x1);
    const bytes2 = OpCodes.Unpack32LE(x2);
    const bytes3 = OpCodes.Unpack32LE(x3);

    result.push(...bytes0, ...bytes1, ...bytes2, ...bytes3);
    
    return result;
  }

  // Decrypt a block
  _decryptBlock(block) {
    if (block.length !== 16) {
      throw new Error('Serpent block size must be exactly 16 bytes');
    }

    // Convert ciphertext to 32-bit words (little-endian)
    let x0 = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
    let x1 = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
    let x2 = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
    let x3 = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);

    const sboxOrder = [0, 1, 2, 3, 4, 5, 6, 7]; // Same S-box order for decryption

    // Initial key mixing (undo final key mixing)
    x0 ^= this.roundKeys[32][0];
    x1 ^= this.roundKeys[32][1];
    x2 ^= this.roundKeys[32][2];
    x3 ^= this.roundKeys[32][3];

    // 32 decryption rounds (in reverse order)
    for (let round = this.ROUNDS - 1; round >= 0; round--) {
      // Inverse linear transformation first (except for last round which is now first)
      if (round < this.ROUNDS - 1) {
        const ltResult = this._linearTransformInv(x0, x1, x2, x3);
        x0 = ltResult[0];
        x1 = ltResult[1];
        x2 = ltResult[2];
        x3 = ltResult[3];
      }

      // Inverse S-box substitution (undo the S-box from encryption)
      const sboxIndex = sboxOrder[round % 8];
      const sboxResult = this._sboxInv(sboxIndex, x0, x1, x2, x3);
      x0 = sboxResult[0];
      x1 = sboxResult[1];
      x2 = sboxResult[2];
      x3 = sboxResult[3];

      // Key mixing (undo the round key)
      x0 ^= this.roundKeys[round][0];
      x1 ^= this.roundKeys[round][1];
      x2 ^= this.roundKeys[round][2];
      x3 ^= this.roundKeys[round][3];
    }

    // Convert back to bytes (little-endian)
    const result = [];
    const bytes0 = OpCodes.Unpack32LE(x0);
    const bytes1 = OpCodes.Unpack32LE(x1);
    const bytes2 = OpCodes.Unpack32LE(x2);
    const bytes3 = OpCodes.Unpack32LE(x3);

    result.push(...bytes0, ...bytes1, ...bytes2, ...bytes3);
    
    return result;
  }
}

// Register the algorithm
AlgorithmFramework.RegisterAlgorithm(new SerpentAlgorithm());