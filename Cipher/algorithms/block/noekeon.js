/*
 * NOEKEON Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * NOEKEON - NESSIE 128-bit block cipher
 * 128-bit blocks with 128-bit keys, 16 rounds
 * Direct Key Mode implementation
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  OpCodes = require('../../OpCodes.js');
}

class NOEKEONCipher extends AlgorithmFramework.BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "NOEKEON";
    this.description = "NESSIE 128-bit block cipher designed by Joan Daemen, Michaël Peeters, Gilles Van Assche and Vincent Rijmen. Direct Key Mode implementation for efficiency.";
    this.inventor = "Joan Daemen, Michaël Peeters, Gilles Van Assche, Vincent Rijmen";
    this.year = 2000;
    this.category = AlgorithmFramework.CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
    this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
    this.country = AlgorithmFramework.CountryCode.BE;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new AlgorithmFramework.KeySize(16, 16, 1) // NOEKEON: 128-bit keys only
    ];
    this.SupportedBlockSizes = [
      new AlgorithmFramework.KeySize(16, 16, 1) // Fixed 128-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new AlgorithmFramework.LinkItem("NOEKEON Specification", "https://gro.noekeon.org/"),
      new AlgorithmFramework.LinkItem("NESSIE Project", "https://www.cosic.esat.kuleuven.be/nessie/")
    ];

    this.references = [
      new AlgorithmFramework.LinkItem("Original NOEKEON Paper", "https://gro.noekeon.org/Noekeon-spec.pdf"),
      new AlgorithmFramework.LinkItem("NESSIE Final Report", "https://www.cosic.esat.kuleuven.be/nessie/")
    ];
    
    // Test vectors from NESSIE
    this.tests = [
      {
        text: "NOEKEON Zero Test Vector",
        uri: "https://gro.noekeon.org/",
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("b1656851699e29fa24b70148503d2dfc")
      },
      {
        text: "NOEKEON Pattern Test Vector",
        uri: "https://gro.noekeon.org/",
        input: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
        key: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
        expected: OpCodes.Hex8ToBytes("2a78421bc7d04f261d1113d3496249b2")
      }
    ];
    
    // NOEKEON Constants
    this.ROUNDS = 16;                     // 16 rounds
    this.RC1_ENCRYPT_START = 0x80;        // Round constant start for encryption
  }

  CreateInstance(isInverse = false) {
    return new NOEKEONInstance(this, isInverse);
  }
}

class NOEKEONInstance extends AlgorithmFramework.IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.keyWords = null;
    this.inputBuffer = [];
    this.outputBuffer = [];
    this.BlockSize = 16;    // 128-bit blocks
    this.KeySize = 0;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.keyWords = null;
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
    this.keyWords = this._convertKeyToWords(keyBytes);
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
  
  _convertKeyToWords(keyBytes) {
    const keyWords = new Array(4);
    for (let i = 0; i < 4; i++) {
      const offset = i * 4;
      keyWords[i] = OpCodes.Pack32BE(
        keyBytes[offset],
        keyBytes[offset + 1],
        keyBytes[offset + 2],
        keyBytes[offset + 3]
      );
    }
    return keyWords;
  }
  
  _encryptBlock(blockBytes) {
    if (blockBytes.length !== 16) {
      throw new Error('NOEKEON: Input must be exactly 16 bytes');
    }
    
    // Convert input to 32-bit words using OpCodes (big-endian)
    const state = new Array(4);
    for (let i = 0; i < 4; i++) {
      const offset = i * 4;
      state[i] = OpCodes.Pack32BE(
        blockBytes[offset],
        blockBytes[offset + 1],
        blockBytes[offset + 2],
        blockBytes[offset + 3]
      );
    }
    
    // NOEKEON encryption
    this._commonLoop(this.keyWords, state, this.algorithm.RC1_ENCRYPT_START, 0);
    
    // Convert back to bytes using OpCodes (big-endian)
    const result = [];
    for (let i = 0; i < 4; i++) {
      const wordBytes = OpCodes.Unpack32BE(state[i]);
      result.push(...wordBytes);
    }
    
    return result;
  }
  
  _decryptBlock(blockBytes) {
    if (blockBytes.length !== 16) {
      throw new Error('NOEKEON: Input must be exactly 16 bytes');
    }
    
    // Convert input to 32-bit words using OpCodes (big-endian)
    const state = new Array(4);
    for (let i = 0; i < 4; i++) {
      const offset = i * 4;
      state[i] = OpCodes.Pack32BE(
        blockBytes[offset],
        blockBytes[offset + 1],
        blockBytes[offset + 2],
        blockBytes[offset + 3]
      );
    }
    
    // NOEKEON decryption
    this._commonLoop(this.keyWords, state, 0, this.algorithm.RC1_ENCRYPT_START);
    
    // Convert back to bytes using OpCodes (big-endian)
    const result = [];
    for (let i = 0; i < 4; i++) {
      const wordBytes = OpCodes.Unpack32BE(state[i]);
      result.push(...wordBytes);
    }
    
    return result;
  }
  
  // NOEKEON Theta function
  _theta(k, a) {
    let tmp = a[0] ^ a[2];
    tmp ^= OpCodes.RotL32(tmp, 8) ^ OpCodes.RotL32(tmp, 24);
    a[1] ^= tmp;
    a[3] ^= tmp;
    
    for (let i = 0; i < 4; i++) {
      a[i] ^= k[i];
    }
    
    tmp = a[1] ^ a[3];
    tmp ^= OpCodes.RotL32(tmp, 8) ^ OpCodes.RotL32(tmp, 24);
    a[0] ^= tmp;
    a[2] ^= tmp;
  }
  
  // NOEKEON Pi1 function
  _pi1(a) {
    a[1] = OpCodes.RotL32(a[1], 1);
    a[2] = OpCodes.RotL32(a[2], 5);
    a[3] = OpCodes.RotL32(a[3], 2);
  }
  
  // NOEKEON Pi2 function  
  _pi2(a) {
    a[1] = OpCodes.RotR32(a[1], 1);
    a[2] = OpCodes.RotR32(a[2], 5);
    a[3] = OpCodes.RotR32(a[3], 2);
  }
  
  // NOEKEON Gamma function
  _gamma(a) {
    a[1] ^= (~a[3]) & (~a[2]);
    a[0] ^= a[2] & a[1];
    
    const tmp = a[3];
    a[3] = a[0];
    a[0] = tmp;
    
    a[2] ^= a[0] ^ a[1] ^ a[3];
    
    a[1] ^= (~a[3]) & (~a[2]);
    a[0] ^= a[2] & a[1];
  }
  
  // Round function
  _round(k, a, RC1, RC2) {
    a[0] ^= RC1;
    this._theta(k, a);
    a[0] ^= RC2;
    this._pi1(a);
    this._gamma(a);
    this._pi2(a);
  }
  
  // Round constant shift register - forward
  _rcShiftRegFwd(RC) {
    if ((RC & 0x80) !== 0) {
      return ((RC << 1) ^ 0x1B) & 0xFF;
    } else {
      return (RC << 1) & 0xFF;
    }
  }
  
  // Round constant shift register - backward
  _rcShiftRegBwd(RC) {
    if ((RC & 0x01) !== 0) {
      return ((RC >>> 1) ^ 0x8D) & 0xFF;
    } else {
      return (RC >>> 1) & 0xFF;
    }
  }
  
  // Common encryption/decryption loop
  _commonLoop(k, a, RC1, RC2) {
    for (let i = 0; i < this.algorithm.ROUNDS; i++) {
      this._round(k, a, RC1, RC2);
      RC1 = this._rcShiftRegFwd(RC1);
      RC2 = this._rcShiftRegBwd(RC2);
    }
    
    // Final theta without pi1, gamma, pi2
    a[0] ^= RC1;
    this._theta(k, a);
    a[0] ^= RC2;
  }
}

// Register algorithm
AlgorithmFramework.RegisterAlgorithm(new NOEKEONCipher());

// Node.js module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NOEKEONCipher;
}