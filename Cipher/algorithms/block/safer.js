/*
 * SAFER (Secure And Fast Encryption Routine) Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * SAFER K-64/K-128 - Block cipher by James Massey
 * 64-bit blocks with 64-bit or 128-bit keys
 * Uses exponential/logarithmic S-boxes based on GF(257)
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

class SaferAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "SAFER";
    this.description = "Secure And Fast Encryption Routine by James Massey. Uses exponential/logarithmic S-boxes based on GF(257) and Pseudo-Hadamard Transform for diffusion. Educational implementation supporting K-64 and K-128 variants.";
    this.inventor = "James Massey";
    this.year = 1993;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.CH;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(8, 16, 8)  // SAFER: 64-bit (K-64) or 128-bit (K-128) keys
    ];
    this.SupportedBlockSizes = [
      new KeySize(8, 8, 0)    // 64-bit blocks only
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("SAFER Specification", "https://link.springer.com/chapter/10.1007/3-540-58108-1_24"),
      new LinkItem("Applied Cryptography - SAFER", "https://www.schneier.com/academic/archives/1995/12/the_safer_k64_and_sa.html"),
      new LinkItem("Wikipedia - SAFER", "https://en.wikipedia.org/wiki/SAFER")
    ];

    this.references = [
      new LinkItem("Original SAFER Paper", "https://link.springer.com/chapter/10.1007/3-540-58108-1_24"),
      new LinkItem("Crypto++ SAFER Implementation", "https://github.com/weidai11/cryptopp/blob/master/safer.cpp"),
      new LinkItem("SAFER Analysis", "https://www.cosic.esat.kuleuven.be/publications/article-431.pdf"),
      new LinkItem("ETH Zurich Reference Implementation", "https://web.archive.org/web/20060926072149/http://www.isi.ee.ethz.ch/~moliner/safer.c")
    ];

    // Known vulnerabilities
    this.knownVulnerabilities = [
      new Vulnerability(
        "Weak keys in some variants",
        "Certain key patterns may exhibit reduced security",
        "Use random keys and strengthened variants when available"
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
        text: "SAFER K-64 all zeros plaintext - educational test vector",
        uri: "https://web.archive.org/web/20060926072149/http://www.isi.ee.ethz.ch/~moliner/safer.c",
        input: OpCodes.Hex8ToBytes("0000000000000000"),
        key: OpCodes.Hex8ToBytes("3132333435363738"),
        expected: OpCodes.Hex8ToBytes("e519c009a424e4a3")
      },
      {
        text: "SAFER K-64 ASCII test - educational",
        uri: "https://web.archive.org/web/20060926072149/http://www.isi.ee.ethz.ch/~moliner/safer.c",
        input: OpCodes.Hex8ToBytes("4142434445464748"),
        key: OpCodes.Hex8ToBytes("3132333435363738"),
        expected: OpCodes.Hex8ToBytes("1520040d0b094476")
      },
      {
        text: "SAFER K-64 binary test - educational",
        uri: "https://web.archive.org/web/20060926072149/http://www.isi.ee.ethz.ch/~moliner/safer.c",
        input: OpCodes.Hex8ToBytes("0123456789abcdef"),
        key: OpCodes.Hex8ToBytes("0123456789abcdef"),
        expected: OpCodes.Hex8ToBytes("1beb104970df4e30")
      }
    ];

    // SAFER Constants
    this.BLOCK_LEN = 8;
    this.MAX_ROUNDS = 13;
    this.K64_DEFAULT_ROUNDS = 6;
    this.K128_DEFAULT_ROUNDS = 10;
    this.TAB_LEN = 256;

    // Initialize exponential and logarithm tables
    this._initTables();
  }

  // Initialize exponential and logarithm lookup tables
  _initTables() {
    this.exp_tab = new Array(this.TAB_LEN);
    this.log_tab = new Array(this.TAB_LEN);
    
    let exp = 1;
    for (let i = 0; i < this.TAB_LEN; i++) {
      this.exp_tab[i] = exp & 0xFF;
      this.log_tab[this.exp_tab[i]] = i;
      exp = (exp * 45) % 257; // GF(257) with primitive element 45
    }
  }

  CreateInstance(isInverse = false) {
    return new SaferInstance(this, isInverse);
  }
}

class SaferInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.expandedKey = null;
    this.nofRounds = 0;
    this.inputBuffer = [];
    this.BlockSize = 8;     // 64-bit blocks
    this.KeySize = 0;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.expandedKey = null;
      this.nofRounds = 0;
      this.KeySize = 0;
      return;
    }

    // Validate key size (64 or 128 bits)
    if (keyBytes.length !== 8 && keyBytes.length !== 16) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes. SAFER requires 8 bytes (K-64) or 16 bytes (K-128)`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    
    // Set rounds based on key size
    if (keyBytes.length === 8) {
      this.nofRounds = this.algorithm.K64_DEFAULT_ROUNDS;
    } else {
      this.nofRounds = this.algorithm.K128_DEFAULT_ROUNDS;
    }
    
    this.expandedKey = this._expandKey(keyBytes);
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
      throw new Error("SAFER requires exactly 8 bytes per block");
    }

    let [a, b, c, d, e, f, g, h] = block;
    let round = this.nofRounds;
    let keyIndex = 0;
    
    while (round--) {
      // Key addition/XOR
      a ^= this.expandedKey[++keyIndex]; 
      b = (b + this.expandedKey[++keyIndex]) & 0xFF;
      c = (c + this.expandedKey[++keyIndex]) & 0xFF; 
      d ^= this.expandedKey[++keyIndex];
      e ^= this.expandedKey[++keyIndex]; 
      f = (f + this.expandedKey[++keyIndex]) & 0xFF;
      g = (g + this.expandedKey[++keyIndex]) & 0xFF; 
      h ^= this.expandedKey[++keyIndex];
      
      // S-box layer
      a = (this._EXP(a) + this.expandedKey[++keyIndex]) & 0xFF; 
      b = this._LOG(b) ^ this.expandedKey[++keyIndex];
      c = this._LOG(c) ^ this.expandedKey[++keyIndex]; 
      d = (this._EXP(d) + this.expandedKey[++keyIndex]) & 0xFF;
      e = (this._EXP(e) + this.expandedKey[++keyIndex]) & 0xFF; 
      f = this._LOG(f) ^ this.expandedKey[++keyIndex];
      g = this._LOG(g) ^ this.expandedKey[++keyIndex]; 
      h = (this._EXP(h) + this.expandedKey[++keyIndex]) & 0xFF;
      
      // Pseudo-Hadamard Transform layers
      [a, b] = this._PHT(a, b); [c, d] = this._PHT(c, d);
      [e, f] = this._PHT(e, f); [g, h] = this._PHT(g, h);
      
      [a, c] = this._PHT(a, c); [e, g] = this._PHT(e, g);
      [b, d] = this._PHT(b, d); [f, h] = this._PHT(f, h);
      
      [a, e] = this._PHT(a, e); [b, f] = this._PHT(b, f);
      [c, g] = this._PHT(c, g); [d, h] = this._PHT(d, h);
      
      // Permutation
      let t = b; b = e; e = c; c = t;
      t = d; d = f; f = g; g = t;
    }
    
    // Final key addition
    a ^= this.expandedKey[++keyIndex]; 
    b = (b + this.expandedKey[++keyIndex]) & 0xFF;
    c = (c + this.expandedKey[++keyIndex]) & 0xFF; 
    d ^= this.expandedKey[++keyIndex];
    e ^= this.expandedKey[++keyIndex]; 
    f = (f + this.expandedKey[++keyIndex]) & 0xFF;
    g = (g + this.expandedKey[++keyIndex]) & 0xFF; 
    h ^= this.expandedKey[++keyIndex];
    
    return [a & 0xFF, b & 0xFF, c & 0xFF, d & 0xFF, 
            e & 0xFF, f & 0xFF, g & 0xFF, h & 0xFF];
  }

  _decryptBlock(block) {
    if (block.length !== 8) {
      throw new Error("SAFER requires exactly 8 bytes per block");
    }

    let [a, b, c, d, e, f, g, h] = block;
    let round = this.nofRounds;
    
    // Start from end of key
    let keyIndex = this.algorithm.BLOCK_LEN * (1 + 2 * round);
    
    // Reverse final key addition
    h ^= this.expandedKey[keyIndex]; 
    g = (g - this.expandedKey[--keyIndex]) & 0xFF;
    f = (f - this.expandedKey[--keyIndex]) & 0xFF; 
    e ^= this.expandedKey[--keyIndex];
    d ^= this.expandedKey[--keyIndex]; 
    c = (c - this.expandedKey[--keyIndex]) & 0xFF;
    b = (b - this.expandedKey[--keyIndex]) & 0xFF; 
    a ^= this.expandedKey[--keyIndex];
    
    while (round--) {
      // Reverse permutation
      let t = e; e = b; b = c; c = t;
      t = f; f = d; d = g; g = t;
      
      // Reverse Pseudo-Hadamard Transform layers
      [a, e] = this._IPHT(a, e); [b, f] = this._IPHT(b, f);
      [c, g] = this._IPHT(c, g); [d, h] = this._IPHT(d, h);
      
      [a, c] = this._IPHT(a, c); [e, g] = this._IPHT(e, g);
      [b, d] = this._IPHT(b, d); [f, h] = this._IPHT(f, h);
      
      [a, b] = this._IPHT(a, b); [c, d] = this._IPHT(c, d);
      [e, f] = this._IPHT(e, f); [g, h] = this._IPHT(g, h);
      
      // Reverse S-box layer
      h = (h - this.expandedKey[--keyIndex]) & 0xFF; 
      g = g ^ this.expandedKey[--keyIndex];
      f = f ^ this.expandedKey[--keyIndex]; 
      e = (e - this.expandedKey[--keyIndex]) & 0xFF;
      d = (d - this.expandedKey[--keyIndex]) & 0xFF; 
      c = c ^ this.expandedKey[--keyIndex];
      b = b ^ this.expandedKey[--keyIndex]; 
      a = (a - this.expandedKey[--keyIndex]) & 0xFF;
      
      h = this._LOG(h) ^ this.expandedKey[--keyIndex]; 
      g = (this._EXP(g) - this.expandedKey[--keyIndex]) & 0xFF;
      f = (this._EXP(f) - this.expandedKey[--keyIndex]) & 0xFF; 
      e = this._LOG(e) ^ this.expandedKey[--keyIndex];
      d = this._LOG(d) ^ this.expandedKey[--keyIndex]; 
      c = (this._EXP(c) - this.expandedKey[--keyIndex]) & 0xFF;
      b = (this._EXP(b) - this.expandedKey[--keyIndex]) & 0xFF; 
      a = this._LOG(a) ^ this.expandedKey[--keyIndex];
    }
    
    return [a & 0xFF, b & 0xFF, c & 0xFF, d & 0xFF, 
            e & 0xFF, f & 0xFF, g & 0xFF, h & 0xFF];
  }

  // Exponential S-box lookup
  _EXP(x) {
    return this.algorithm.exp_tab[x & 0xFF];
  }

  // Logarithmic S-box lookup
  _LOG(x) {
    return this.algorithm.log_tab[x & 0xFF];
  }

  // Pseudo-Hadamard Transform
  _PHT(x, y) {
    const new_y = (y + x) & 0xFF;
    const new_x = (x + new_y) & 0xFF;
    return [new_x, new_y];
  }

  // Inverse Pseudo-Hadamard Transform
  _IPHT(x, y) {
    const new_x = (x - y) & 0xFF;
    const new_y = (y - new_x) & 0xFF;
    return [new_x, new_y];
  }

  // Expand user key to round keys
  _expandKey(keyBytes) {
    const nofRounds = this.nofRounds;
    if (nofRounds > this.algorithm.MAX_ROUNDS) {
      throw new Error(`Too many rounds: ${nofRounds}`);
    }
    
    const keyLen = 1 + this.algorithm.BLOCK_LEN * (1 + 2 * nofRounds);
    const key = new Array(keyLen);
    let keyIndex = 0;
    
    // Store number of rounds as first byte
    key[keyIndex++] = nofRounds;
    
    const ka = new Array(this.algorithm.BLOCK_LEN + 1);
    const kb = new Array(this.algorithm.BLOCK_LEN + 1);
    
    ka[this.algorithm.BLOCK_LEN] = 0;
    kb[this.algorithm.BLOCK_LEN] = 0;
    
    // Initialize ka and kb arrays
    for (let j = 0; j < this.algorithm.BLOCK_LEN; j++) {
      const userkey1_j = keyBytes[j] || 0;
      const userkey2_j = (keyBytes.length > 8) ? (keyBytes[j + 8] || 0) : userkey1_j;
      
      ka[this.algorithm.BLOCK_LEN] ^= ka[j] = OpCodes.RotL8(userkey1_j, 5);
      kb[this.algorithm.BLOCK_LEN] ^= kb[j] = key[keyIndex++] = userkey2_j;
    }
    
    // Generate round keys
    for (let i = 1; i <= nofRounds; i++) {
      // Rotate ka and kb arrays
      for (let j = 0; j < this.algorithm.BLOCK_LEN + 1; j++) {
        ka[j] = OpCodes.RotL8(ka[j], 6);
        kb[j] = OpCodes.RotL8(kb[j], 6);
      }
      
      // Generate first 8 bytes of round key
      for (let j = 0; j < this.algorithm.BLOCK_LEN; j++) {
        key[keyIndex++] = (ka[j] + this._EXP(this._EXP((18 * i + j + 1) & 0xFF))) & 0xFF;
      }
      
      // Generate second 8 bytes of round key
      for (let j = 0; j < this.algorithm.BLOCK_LEN; j++) {
        key[keyIndex++] = (kb[j] + this._EXP(this._EXP((18 * i + j + 10) & 0xFF))) & 0xFF;
      }
    }
    
    return key;
  }
}

// Register the algorithm
RegisterAlgorithm(new SaferAlgorithm());

// Export for module usage  
if (typeof module !== 'undefined' && module.exports) {
  module.exports = new SaferAlgorithm();
}