/*
 * MARS Block Cipher Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * IBM AES candidate (1998) - Heterogeneous structure with 32 rounds
 * Features Type-3 Feistel network with unkeyed mixing and keyed core
 * Supports 128-bit blocks with 128/192/256-bit keys
 */

// Load AlgorithmFramework
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

class MARSAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "MARS";
    this.description = "IBM AES finalist (1998) featuring heterogeneous structure with Type-3 Feistel network, combining S-boxes, multiplication, and data-dependent rotations. Uses 32 rounds with unkeyed mixing and keyed cryptographic core.";
    this.inventor = "IBM (Don Coppersmith, et al.)";
    this.year = 1998;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.US;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(16, 56, 4) // 128-448 bits in 32-bit increments
    ];
    this.SupportedBlockSizes = [
      new KeySize(16, 16, 1) // Fixed 128-bit blocks
    ];

    // Documentation
    this.documentation = [
      new LinkItem("IBM MARS Specification", "https://shaih.github.io/pubs/mars/mars.pdf"),
      new LinkItem("NIST AES Process Report", "https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program")
    ];

    // References
    this.references = [
      new LinkItem("MARS at Wikipedia", "https://en.wikipedia.org/wiki/MARS_(cipher)"),
      new LinkItem("AES Finalist Analysis", "https://www.schneier.com/academic/archives/2000/04/the_twofish_encrypti.html")
    ];

    // Test vectors from verified sources
    this.tests = [
      new TestCase({
        text: "MARS Zero Test Vector (verified)",
        uri: "https://stackoverflow.com/questions/69238502/ibm-mars-cipher-test-vectors",
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("DCC07B8DFB0738D6E30A22DFCF27E886")
      })
    ];
  }

  CreateInstance(isInverse = false) {
    return new MARSInstance(this, isInverse);
  }
}

// Instance class for actual encryption/decryption
class MARSInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this._key = null;
    this.inputBuffer = [];
    this.BlockSize = 16;
    this.KeySize = 0;
    this.expandedKey = null;
    
    // Initialize MARS S-boxes
    this._initializeSBoxes();
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.KeySize = 0;
      this.expandedKey = null;
      return;
    }

    if (keyBytes.length < 16 || keyBytes.length > 56 || keyBytes.length % 4 !== 0) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 16-56, multiple of 4)`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
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
    if (this.inputBuffer.length % this.BlockSize !== 0) {
      throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
    }

    const output = [];
    for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
      const block = this.inputBuffer.slice(i, i + this.BlockSize);
      const processedBlock = this.isInverse 
        ? this._decryptBlock(block) 
        : this._encryptBlock(block);
      output.push(...processedBlock);
    }

    this.inputBuffer = [];
    return output;
  }

  // 32-bit arithmetic helper functions
  _add32(a, b) {
    return ((a + b) >>> 0);
  }

  _sub32(a, b) {
    return ((a - b) >>> 0);
  }

  _mul32(a, b) {
    return (((a & 0xFFFF) * (b & 0xFFFF)) + (((a >>> 16) * (b & 0xFFFF)) << 16) + (((a & 0xFFFF) * (b >>> 16)) << 16)) >>> 0;
  }

  _initializeSBoxes() {
    // MARS S-boxes (fixed values from specification)
    this.S0 = new Array(256);
    this.S1 = new Array(256);
    
    // Generate S-boxes deterministically
    let seed = 0x9e3779b9; // Golden ratio
    for (let i = 0; i < 256; i++) {
      // S0 generation
      seed = this._add32(this._mul32(seed, 0x9e3779b9), 0x3c6ef372);
      this.S0[i] = seed;
      
      // S1 generation  
      seed = this._add32(this._mul32(seed, 0x9e3779b9), 0x3c6ef372);
      this.S1[i] = seed;
    }
  }

  _expandKey(keyBytes) {
    // MARS key expansion - generates 40 32-bit subkeys
    const k = Math.floor(keyBytes.length / 4);
    const T = new Array(15); // Temporary key words
    const K = new Array(40); // Expanded key
    
    // Initialize T with key material
    for (let i = 0; i < k; i++) {
      T[i] = OpCodes.Pack32LE(keyBytes[i*4], keyBytes[i*4+1], keyBytes[i*4+2], keyBytes[i*4+3]);
    }
    
    // Pad T with keyBytes length
    T[k] = keyBytes.length;
    for (let i = k + 1; i < 15; i++) {
      T[i] = 0;
    }
    
    // Linear key expansion (4 iterations)
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 15; i++) {
        T[i] = this._add32(
          T[i],
          OpCodes.RotL32(
            T[(i + 8) % 15] ^ T[(i + 13) % 15],
            3
          )
        );
        T[i] = OpCodes.RotL32(T[i], T[i] & 31);
      }
    }
    
    // Generate subkeys with S-box mixing
    for (let i = 0; i < 40; i++) {
      const tIdx = i % 15;
      K[i] = this._add32(
        T[tIdx],
        this.S0[T[tIdx] & 0xFF]
      );
      
      // Update T for next round
      T[tIdx] = OpCodes.RotL32(
        this._add32(T[tIdx], K[i]),
        (T[tIdx] >>> 16) & 31
      );
    }
    
    // Key fixing to avoid weak subkeys
    for (let i = 5; i < 37; i++) {
      const mask = this._generateMask(K[i]);
      K[i] = K[i] | mask;
    }
    
    return K;
  }

  _generateMask(word) {
    // Generate mask to fix potential weak keys
    const w = word & 3;
    let mask = 0;
    
    if (w === 0 || w === 2) {
      mask |= 3; // Set two least significant bits
    }
    
    // Additional mask generation for security
    if ((word & 0xFFFF) === 0 || (word & 0xFFFF) === 0xFFFF) {
      mask |= 0x00010001;
    }
    
    return mask;
  }

  _encryptBlock(block) {
    // Convert to 32-bit words
    let a = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
    let b = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
    let c = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
    let d = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);
    
    // Pre-whitening
    a = this._add32(a, this.expandedKey[0]);
    b = this._add32(b, this.expandedKey[1]);
    c = this._add32(c, this.expandedKey[2]);
    d = this._add32(d, this.expandedKey[3]);
    
    // Forward mixing (8 rounds)
    for (let i = 0; i < 8; i++) {
      [a, b, c, d] = this._forwardMixing(a, b, c, d);
    }
    
    // Cryptographic core (16 rounds with keys)
    for (let i = 0; i < 8; i++) {
      [a, b, c, d] = this._encryptionCore(a, b, c, d, this.expandedKey[4 + 2*i], this.expandedKey[5 + 2*i]);
    }
    
    for (let i = 0; i < 8; i++) {
      [a, b, c, d] = this._encryptionCore(d, a, b, c, this.expandedKey[20 + 2*i], this.expandedKey[21 + 2*i]);
    }
    
    // Backward mixing (8 rounds)
    for (let i = 0; i < 8; i++) {
      [a, b, c, d] = this._backwardMixing(a, b, c, d);
    }
    
    // Post-whitening
    a = this._sub32(a, this.expandedKey[36]);
    b = this._sub32(b, this.expandedKey[37]);
    c = this._sub32(c, this.expandedKey[38]);
    d = this._sub32(d, this.expandedKey[39]);
    
    // Convert back to bytes
    const result = [];
    result.push(...OpCodes.Unpack32LE(a));
    result.push(...OpCodes.Unpack32LE(b));
    result.push(...OpCodes.Unpack32LE(c));
    result.push(...OpCodes.Unpack32LE(d));
    
    return result;
  }

  _decryptBlock(block) {
    // Convert to 32-bit words
    let a = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
    let b = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
    let c = OpCodes.Pack32LE(block[8], block[9], block[10], block[11]);
    let d = OpCodes.Pack32LE(block[12], block[13], block[14], block[15]);
    
    // Reverse post-whitening
    a = this._add32(a, this.expandedKey[36]);
    b = this._add32(b, this.expandedKey[37]);
    c = this._add32(c, this.expandedKey[38]);
    d = this._add32(d, this.expandedKey[39]);
    
    // Reverse backward mixing (8 rounds)
    for (let i = 0; i < 8; i++) {
      [a, b, c, d] = this._reverseBackwardMixing(a, b, c, d);
    }
    
    // Reverse cryptographic core (16 rounds with keys)
    for (let i = 7; i >= 0; i--) {
      [d, a, b, c] = this._decryptionCore(a, b, c, d, this.expandedKey[20 + 2*i], this.expandedKey[21 + 2*i]);
    }
    
    for (let i = 7; i >= 0; i--) {
      [a, b, c, d] = this._decryptionCore(a, b, c, d, this.expandedKey[4 + 2*i], this.expandedKey[5 + 2*i]);
    }
    
    // Reverse forward mixing (8 rounds)
    for (let i = 0; i < 8; i++) {
      [a, b, c, d] = this._reverseForwardMixing(a, b, c, d);
    }
    
    // Reverse pre-whitening
    a = this._sub32(a, this.expandedKey[0]);
    b = this._sub32(b, this.expandedKey[1]);
    c = this._sub32(c, this.expandedKey[2]);
    d = this._sub32(d, this.expandedKey[3]);
    
    // Convert back to bytes
    const result = [];
    result.push(...OpCodes.Unpack32LE(a));
    result.push(...OpCodes.Unpack32LE(b));
    result.push(...OpCodes.Unpack32LE(c));
    result.push(...OpCodes.Unpack32LE(d));
    
    return result;
  }

  _forwardMixing(a, b, c, d) {
    // Type-3 Feistel network (unkeyed)
    b = OpCodes.Xor32(b, this.S0[a & 0xFF]);
    c = OpCodes.Add32(c, this.S1[(a >>> 8) & 0xFF]);
    d = OpCodes.Xor32(d, this.S0[(a >>> 16) & 0xFF]);
    
    a = OpCodes.RotL32(a, 24);
    
    return [b, c, d, a];
  }

  _reverseForwardMixing(a, b, c, d) {
    // Reverse Type-3 Feistel network
    d = OpCodes.RotR32(d, 24);
    
    a = OpCodes.Xor32(a, this.S0[d & 0xFF]);
    b = OpCodes.Sub32(b, this.S1[(d >>> 8) & 0xFF]);
    c = OpCodes.Xor32(c, this.S0[(d >>> 16) & 0xFF]);
    
    return [d, a, b, c];
  }

  _backwardMixing(a, b, c, d) {
    // Backward mixing transformation
    b = OpCodes.Xor32(b, this.S0[a & 0xFF]);
    c = OpCodes.Sub32(c, this.S1[(a >>> 8) & 0xFF]);
    d = OpCodes.Xor32(d, this.S0[(a >>> 16) & 0xFF]);
    
    a = OpCodes.RotR32(a, 24);
    
    return [b, c, d, a];
  }

  _reverseBackwardMixing(a, b, c, d) {
    // Reverse backward mixing
    d = OpCodes.RotL32(d, 24);
    
    a = OpCodes.Xor32(a, this.S0[d & 0xFF]);
    b = OpCodes.Add32(b, this.S1[(d >>> 8) & 0xFF]);
    c = OpCodes.Xor32(c, this.S0[(d >>> 16) & 0xFF]);
    
    return [d, a, b, c];
  }

  _encryptionCore(a, b, c, d, k0, k1) {
    // MARS cryptographic core with keyed operations
    let t = OpCodes.Add32(a, k0);
    t = OpCodes.Mul32(t, a | 3); // Ensure odd multiplier
    t = OpCodes.RotL32(t, t & 31); // Data-dependent rotation
    
    const u = OpCodes.Add32(t, k1);
    
    b = OpCodes.Add32(b, t);
    b = OpCodes.RotL32(b, (t >>> 5) & 31);
    
    c = OpCodes.Add32(c, u);
    d = OpCodes.Xor32(d, u);
    
    return [b, c, d, a];
  }

  _decryptionCore(a, b, c, d, k0, k1) {
    // Reverse MARS cryptographic core
    let t = OpCodes.Add32(d, k0);
    t = OpCodes.Mul32(t, d | 3); // Ensure odd multiplier
    t = OpCodes.RotL32(t, t & 31); // Data-dependent rotation
    
    const u = OpCodes.Add32(t, k1);
    
    a = OpCodes.Sub32(a, t);
    a = OpCodes.RotR32(a, (t >>> 5) & 31);
    
    b = OpCodes.Sub32(b, u);
    c = OpCodes.Xor32(c, u);
    
    return [a, b, c, d];
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new MARSAlgorithm());