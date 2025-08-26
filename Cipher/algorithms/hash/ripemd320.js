
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }
  
  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  // RIPEMD-320 constants
  const RIPEMD320_BLOCKSIZE = 64;    // 512 bits
  const RIPEMD320_DIGESTSIZE = 40;   // 320 bits
  const RIPEMD320_ROUNDS = 80;       // Rounds per pipeline
  
  // Initial hash values (same as RIPEMD-160 but extended)
  const IV = [
    0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0,  // Pipeline A
    0x76543210, 0xFEDCBA98, 0x89ABCDEF, 0x01234567, 0x3C2D1E0F   // Pipeline B
  ];
  
  // Round constants for pipeline A
  const KA = [
    0x00000000, 0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xA953FD4E
  ];
  
  // Round constants for pipeline B  
  const KB = [
    0x50A28BE6, 0x5C4DD124, 0x6D703EF3, 0x7A6D76E9, 0x00000000
  ];
  
  // Message schedule for pipeline A
  const RA = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
    3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
    1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
    4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
  ];
  
  // Message schedule for pipeline B
  const RB = [
    5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
    6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
    15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
    8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
    12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
  ];
  
  // Left rotation amounts for pipeline A
  const SA = [
    11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
    7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
    11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
    11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
    9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
  ];
  
  // Left rotation amounts for pipeline B
  const SB = [
    8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
    9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
    9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
    15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
    8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
  ];
  
  /**
   * RIPEMD auxiliary functions
   */
  function F(j, x, y, z) {
    if (j < 16) return x ^ y ^ z;
    else if (j < 32) return (x & y) | (~x & z);
    else if (j < 48) return (x | ~y) ^ z;
    else if (j < 64) return (x & z) | (y & ~z);
    else return x ^ (y | ~z);
  }
  
  /**
   * RIPEMD-320 hasher class
   */
  function RipeMD320Hasher() {
    // Initialize with RIPEMD-320 IVs (10 words total)
    this.state = IV.slice();
    this.buffer = new Uint8Array(RIPEMD320_BLOCKSIZE);
    this.bufferLength = 0;
    this.totalLength = 0;
  }
  
  RipeMD320Hasher.prototype.update = function(data) {
    if (typeof data === 'string') {
      data = OpCodes.AnsiToBytes(data);
    }
    
    this.totalLength += data.length;
    let offset = 0;
    
    // Fill buffer first
    while (offset < data.length && this.bufferLength < RIPEMD320_BLOCKSIZE) {
      this.buffer[this.bufferLength++] = data[offset++];
    }
    
    // Process full buffer
    if (this.bufferLength === RIPEMD320_BLOCKSIZE) {
      this.processBlock(this.buffer);
      this.bufferLength = 0;
    }
    
    // Process remaining full blocks
    while (offset + RIPEMD320_BLOCKSIZE <= data.length) {
      const block = data.slice(offset, offset + RIPEMD320_BLOCKSIZE);
      this.processBlock(block);
      offset += RIPEMD320_BLOCKSIZE;
    }
    
    // Store remaining bytes in buffer
    while (offset < data.length) {
      this.buffer[this.bufferLength++] = data[offset++];
    }
  };
  
  RipeMD320Hasher.prototype.processBlock = function(block) {
    // Convert block to 32-bit words (little-endian)
    const X = new Array(16);
    for (let i = 0; i < 16; i++) {
      X[i] = OpCodes.Pack32LE(
        block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]
      );
    }
    
    // Initialize working variables
    let AL = this.state[0], BL = this.state[1], CL = this.state[2], DL = this.state[3], EL = this.state[4];
    let AR = this.state[5], BR = this.state[6], CR = this.state[7], DR = this.state[8], ER = this.state[9];
    
    // 80 rounds for each pipeline
    for (let j = 0; j < RIPEMD320_ROUNDS; j++) {
      // Pipeline A (left)
      const fL = F(j, BL, CL, DL);
      const kL = KA[Math.floor(j / 16)];
      const TL = (AL + fL + X[RA[j]] + kL) >>> 0;
      const rotatedTL = OpCodes.RotL32(TL, SA[j]);
      const newAL = (rotatedTL + EL) >>> 0;
      
      AL = EL; EL = DL; DL = OpCodes.RotL32(CL, 10); CL = BL; BL = newAL;
      
      // Pipeline B (right)  
      const fR = F(79 - j, BR, CR, DR);
      const kR = KB[Math.floor(j / 16)];
      const TR = (AR + fR + X[RB[j]] + kR) >>> 0;
      const rotatedTR = OpCodes.RotL32(TR, SB[j]);
      const newAR = (rotatedTR + ER) >>> 0;
      
      AR = ER; ER = DR; DR = OpCodes.RotL32(CR, 10); CR = BR; BR = newAR;
    }
    
    // Combine results with original state
    const T = (this.state[1] + CL + DR) >>> 0;
    this.state[1] = (this.state[2] + DL + ER) >>> 0;
    this.state[2] = (this.state[3] + EL + AR) >>> 0;
    this.state[3] = (this.state[4] + AL + BR) >>> 0;
    this.state[4] = (this.state[0] + BL + CR) >>> 0;
    this.state[0] = T;
    
    // Pipeline B state update
    const TB = (this.state[6] + CL + DR) >>> 0;
    this.state[6] = (this.state[7] + DL + ER) >>> 0;
    this.state[7] = (this.state[8] + EL + AR) >>> 0;
    this.state[8] = (this.state[9] + AL + BR) >>> 0;
    this.state[9] = (this.state[5] + BL + CR) >>> 0;
    this.state[5] = TB;
  };
  
  RipeMD320Hasher.prototype.finalize = function() {
    // RIPEMD padding: append 0x80, then zeros, then length
    const paddingLength = RIPEMD320_BLOCKSIZE - ((this.totalLength + 9) % RIPEMD320_BLOCKSIZE);
    const padding = new Uint8Array(paddingLength + 9);
    
    padding[0] = 0x80; // RIPEMD padding byte
    
    // Append length as 64-bit little-endian
    const bitLength = this.totalLength * 8;
    for (let i = 0; i < 8; i++) {
      padding[paddingLength + 1 + i] = (bitLength >>> (i * 8)) & 0xFF;
    }
    
    this.update(padding);
    
    // Convert state to bytes (little-endian)
    const result = new Uint8Array(RIPEMD320_DIGESTSIZE);
    for (let i = 0; i < 10; i++) {
      const bytes = OpCodes.Unpack32LE(this.state[i]);
      result[i * 4] = bytes[0];
      result[i * 4 + 1] = bytes[1];
      result[i * 4 + 2] = bytes[2];
      result[i * 4 + 3] = bytes[3];
    }
    
    return result;
  };
  
  const RipeMD320 = {
    name: "RIPEMD-320",
    description: "Extended RIPEMD hash function producing 320-bit digest. Uses dual 160-bit computation pipelines for enhanced security margin. Part of the RIPEMD family designed as European alternative to MD/SHA.",
    inventor: "Hans Dobbertin, Antoon Bosselaers, Bart Preneel",
    year: 1996,
    country: "BE",
    category: "hash",
    subCategory: "Cryptographic Hash",
    securityStatus: null,
    securityNotes: "Less analyzed than mainstream alternatives. Designed with dual pipeline structure but offers no additional security compared to RIPEMD-160.",
    
    documentation: [
      {text: "RIPEMD-160: A Strengthened Version of RIPEMD", uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"},
      {text: "ISO/IEC 10118-3:2004 Standard", uri: "https://www.iso.org/standard/39876.html"},
      {text: "RIPEMD Family Analysis", uri: "https://en.wikipedia.org/wiki/RIPEMD"}
    ],
    
    references: [
      {text: "RIPEMD Specification", uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"},
      {text: "Cryptographic Hash Functions", uri: "https://csrc.nist.gov/projects/hash-functions"},
      {text: "OpenSSL RIPEMD Source", uri: "https://github.com/openssl/openssl/tree/master/crypto/ripemd"}
    ],
    
    knownVulnerabilities: [],
    
    tests: [
      {
        text: "Empty string test vector",
        uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html",
        input: [],
        expected: OpCodes.Hex8ToBytes("22d65d5661536cdc75c1fdf5c6de7b41b9f27325ebc61e8557177d705a0ec880151c3a32a00899b8")
      },
      {
        text: "Single character 'a' test vector",
        uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html",
        input: OpCodes.AnsiToBytes("a"),
        expected: OpCodes.Hex8ToBytes("ce78850638f92658a5a585097579926dda667a5716562cfcf6fbe77f63542f99b04705d6970dff5d")
      },
      {
        text: "String 'abc' test vector",
        uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html",
        input: OpCodes.AnsiToBytes("abc"),
        expected: OpCodes.Hex8ToBytes("de4c01b3054f8930a79d09ae738e92301e5a17085beffdc1b8d116713e74f82fa942d64cdbc4682d")
      },
      {
        text: "Alphabet test vector",
        uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html",
        input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
        expected: OpCodes.Hex8ToBytes("cabdb1810b92470a2093aa6bce05952c28348cf43ff60841975166bb40ed234004b8824463e6b009")
      }
    ],

    minKeyLength: 0,
    maxKeyLength: 0,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},
    
    // Hash function interface
    Init: function() {
      this.hasher = new RipeMD320Hasher();
      this.bKey = false;
    },
    
    KeySetup: function(key) {
      // RIPEMD-320 doesn't use keys in standard mode
      this.hasher = new RipeMD320Hasher();
      this.bKey = false;
    },
    
    encryptBlock: function(blockIndex, data) {
      if (typeof data === 'string') {
        this.hasher.update(data);
        return OpCodes.BytesToHex(this.hasher.finalize());
      }
      return '';
    },
    
    decryptBlock: function(blockIndex, data) {
      // Hash functions don't decrypt
      return this.encryptBlock(blockIndex, data);
    },
    
    // Direct hash interface
    hash: function(data) {
      const hasher = new RipeMD320Hasher();
      hasher.update(data);
      return hasher.finalize();
    },
    
    ClearData: function() {
      if (this.hasher) {
        this.hasher.state.fill(0);
        this.hasher.buffer.fill(0);
      }
      this.bKey = false;
    }
  };
  
    class RipeMD320Wrapper extends CryptoAlgorithm {
      constructor() {
        super();
        this.name = RipeMD320.name;
        this.category = CategoryType.HASH;
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.complexity = ComplexityType.MEDIUM;
        this.inventor = RipeMD320.inventor;
        this.year = RipeMD320.year;
        this.country = RipeMD320.country;
        this.description = RipeMD320.description;
        
        if (RipeMD320.tests) {
          this.tests = RipeMD320.tests.map(test => 
            new TestCase(test.input, test.expected, test.text, test.uri)
          );
        }
      }
      
      CreateInstance(isInverse = false) {
        return new RipeMD320WrapperInstance(this, isInverse);
      }
    }
    
    class RipeMD320WrapperInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse) {
        super(algorithm, isInverse);
        this.hasher = new RipeMD320Hasher();
      }
      
      ProcessData(input) {
        const result = this.hasher.finalize();
        return Array.from(result); // Convert Uint8Array to regular array
      }
      
      Feed(data) {
        this.hasher.update(data);
      }
      
      Result() {
        return this.ProcessData();
      }
      
      Reset() {
        this.hasher = new RipeMD320Hasher();
      }
    }


  // ===== REGISTRATION =====

    const algorithmInstance = new RipeMD320Wrapper();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RipeMD320Wrapper, RipeMD320WrapperInstance };
}));