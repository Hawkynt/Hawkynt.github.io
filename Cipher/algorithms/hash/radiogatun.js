/*
 * RadioGatún[32] Hash Function - Correct Implementation
 * Based on the reference implementation by Sam Trenholme
 * (c)2006-2025 Hawkynt
 */

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

  /**
   * RadioGatún[32] implementation based on the correct reference
   */
  function RadioGatunHasher() {
    // RadioGatún[32] state arrays - exact C reference sizes
    this.e = new Uint32Array(42); // mill array
    this.f = new Uint32Array(42); // belt array
    this.n = new Uint32Array(45); // temp array for mill transformation
    this.g = 19; // mill size
    this.h = 13; // belt width

    // Arrays are initialized to zero by Uint32Array constructor

    this.buffer = [];
    this.inputPhase = true;
  }

  RadioGatunHasher.prototype.beltmill = function() {
    // Exact translation of C nanorg32.c beltmill function m()
    let j = 0;

    // Mill-to-belt feedforward: b(12)f[c+c%3*h]^=e[c+1]
    for (let c = 0; c < 12; c++) {
      this.f[c + (c % 3) * this.h] = (this.f[c + (c % 3) * this.h] ^ this.e[c + 1]) >>> 0;
    }

    // Mill transformation: b(g){i=c*7%g;k=e[i++];k^=e[i%g]|~e[(i+1)%g];j+=c;n[c]=n[c+g]=k>>j%32|k<<-j%32;}
    for (let c = 0; c < this.g; c++) {
      let i = (c * 7) % this.g;
      let k = this.e[i++];
      k = (k ^ (this.e[i % this.g] | (~this.e[(i + 1) % this.g] >>> 0))) >>> 0;
      j += c;
      const rot = j % 32;
      // Use OpCodes for rotation: k>>j%32|k<<-j%32 means rotate right by j%32
      this.n[c] = this.n[c + this.g] = OpCodes.RotR32(k, rot);
    }

    // Combined belt rotation and theta: for(i=39;i--;f[i+1]=f[i])e[i]=n[i]^n[i+1]^n[i+4]
    // C loop semantics: init i=39, then loop with i--, check i!=0, body e[i]=..., increment f[i+1]=f[i]
    // So it processes i=38,37,...,1,0
    for (let i = 39; i > 0; i--) {
      const idx = i - 1; // After decrement
      this.e[idx] = (this.n[idx] ^ this.n[idx + 1] ^ this.n[idx + 4]) >>> 0;
      this.f[i] = this.f[idx]; // f[i+1] = f[i] where i is the decremented value
    }

    // Belt-to-mill feedforward: b(3)e[c+h]^=f[c*h]=f[c*h+h]
    for (let c = 0; c < 3; c++) {
      this.f[c * this.h] = this.f[c * this.h + this.h];
      this.e[c + this.h] = (this.e[c + this.h] ^ this.f[c * this.h]) >>> 0;
    }

    // Iota: *e^=1
    this.e[0] = (this.e[0] ^ 1) >>> 0;
  };

  RadioGatunHasher.prototype.update = function(data) {
    if (!this.inputPhase) {
      throw new Error('Cannot update after finalization has begun');
    }

    if (typeof data === 'string') {
      data = OpCodes.AnsiToBytes(data);
    }

    // Add data to buffer
    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data[i]);
    }
  };

  RadioGatunHasher.prototype.finalize = function(outputBytes) {
    outputBytes = outputBytes || 32; // Default 256 bits

    if (this.inputPhase) {
      this.processAllInput();
      this.inputPhase = false;
    }

    // Generate output exactly like C reference: b(8){j=c;b(4)printf("%02x",(e[1+j%2]>>8*c)&255);c=j;if(c%2)m();}
    const output = new Uint8Array(outputBytes);
    let outputOffset = 0;

    // Output generation loop
    for (let outer = 0; outer < 8 && outputOffset < outputBytes; outer++) {
      const wordSelect = outer; // saves in j
      // Extract 4 bytes from alternating words
      for (let bytePos = 0; bytePos < 4 && outputOffset < outputBytes; bytePos++) {
        const wordIndex = 1 + (wordSelect % 2); // alternates between e[1] and e[2]
        const byte = (this.e[wordIndex] >>> (8 * bytePos)) & 255;
        output[outputOffset++] = byte;
      }
      // After odd iterations (wordSelect % 2 == 1), run mill
      if ((wordSelect % 2) === 1) {
        this.beltmill();
      }
    }

    return output;
  };

  RadioGatunHasher.prototype.processAllInput = function() {
    // C: for(;;m()){b(3){for(j=0;j<4;){f[c*h]^=k=(*q?255&*q:1)<<8*j++;e[c+16]^=k;if(!*q++){b(18)m();return;}}}}
    // CRITICAL: for(;;m()) means m() is in INCREMENT section - runs AFTER body, not before!

    let inputPos = 0;

    while (true) {
      // Process 3 words (12 bytes total)
      for (let c = 0; c < 3; c++) {
        // Process 4 bytes per word
        for (let j = 0; j < 4; j++) {
          let byte;
          let hitEnd = false;

          if (inputPos < this.buffer.length) {
            byte = this.buffer[inputPos] & 0xFF;
          } else {
            byte = 1; // Padding
            hitEnd = true;
          }

          // k = byte << (8*j)
          let k = (byte << (8 * j)) >>> 0;

          // f[c*h]^=k; e[c+16]^=k;
          this.f[c * this.h] = (this.f[c * this.h] ^ k) >>> 0;
          this.e[c + 16] = (this.e[c + 16] ^ k) >>> 0;

          // if(!*q++) - if we just read end, do blank rounds and return
          if (hitEnd) {
            for (let i = 0; i < 18; i++) {
              this.beltmill();
            }
            return;
          }

          inputPos++; // Increment after checking end
        }
      }

      // Call m() at END of iteration (C for loop increment section)
      this.beltmill();
    }
  };

  // RadioGatún Universal Cipher Interface
  const RadioGatun = {
    internalName: 'radiogatun',
    name: 'RadioGatún',
    // Algorithm metadata
    blockSize: 96,          // 12 bytes input block
    digestSize: 256,        // Default 32 bytes output
    keySize: 0,
    rounds: 18,             // Blank rounds

    // Security level
    securityLevel: 128,

    // Reference links
    referenceLinks: [
      {
        title: "RadioGatún, a belt-and-mill hash function",
        url: "https://radiogatun.noekeon.org/radiogatun.pdf",
        type: "specification"
      },
      {
        title: "RadioGatún Official Page",
        url: "https://keccak.team/radiogatun.html",
        type: "homepage"
      },
      {
        title: "GitHub Reference Implementation",
        url: "https://github.com/samboy/rg32hash",
        type: "implementation"
      }
    ],

    // Required Cipher interface properties
    minKeyLength: 0,        // Minimum key length in bytes
    maxKeyLength: 64,        // Maximum key length in bytes
    stepKeyLength: 1,       // Key length step size
    minBlockSize: 0,        // Minimum block size in bytes
    maxBlockSize: 0,        // Maximum block size (0 = unlimited)
    stepBlockSize: 1,       // Block size step
    instances: {},          // Instance tracking

    // Hash function interface
    Init: function() {
      this.hasher = new RadioGatunHasher();
      this.bKey = false;
    },

    KeySetup: function(key) {
      // RadioGatún doesn't use keys in standard mode
      this.hasher = new RadioGatunHasher();
      this.bKey = false;
    },

    encryptBlock: function(blockIndex, data) {
      if (typeof data === 'string') {
        this.hasher.update(data);
        return this.hasher.finalize();
      }
      return new Uint8Array(0);
    },

    decryptBlock: function(blockIndex, data) {
      // Hash functions don't decrypt
      return this.encryptBlock(blockIndex, data);
    },

    // Direct hash interface with variable output
    hash: function(data, outputBytes) {
      const hasher = new RadioGatunHasher();
      hasher.update(data);
      return hasher.finalize(outputBytes || 32);
    },

    // Stream interface (unlimited output)
    stream: function(data, outputBytes) {
      return this.hash(data, outputBytes);
    },

    ClearData: function() {
      if (this.hasher) {
        // Clear state
        for (let i = 0; i < 39; i++) {
          this.hasher.belt[i] = 0;
        }
        for (let i = 0; i < this.hasher.mill.length; i++) {
          this.hasher.mill[i] = 0;
        }
        this.hasher.buffer = [];
      }
      this.bKey = false;
    }
  };

  class RadioGatunAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "RadioGatún";
      this.category = CategoryType.HASH;
      this.subCategory = "Belt-and-Mill Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
      this.year = 2006;
      this.country = CountryCode.BE;
      this.description = "RadioGatún is a belt-and-mill hash function that served as a predecessor to Keccak/SHA-3 design. Uses 19-word mill and 39-word belt with 32-bit words.";

      this.documentation = [
        new LinkItem("RadioGatún Official Specification", "https://radiogatun.noekeon.org/radiogatun.pdf"),
        new LinkItem("RadioGatún Homepage", "https://keccak.team/radiogatun.html")
      ];

      // Test vectors from official RadioGatún specification and implementations
      this.tests = [
        {
          text: 'RadioGatún[32] - Empty string test vector',
          uri: 'https://radiogatun.noekeon.org/',
          input: [],
          expected: OpCodes.Hex8ToBytes('F30028B54AFAB6B3E55355D277711109A19BEDA7091067E9A492FB5ED9F20117')
        },
        {
          text: 'RadioGatún[32] - Single character "0"',
          uri: 'https://github.com/coruus/sphlib/blob/master/src/c/test_radiogatun.c',
          input: [48],
          expected: OpCodes.Hex8ToBytes('AF0D3F51B98E90EEEBAE86DD0B304A4003AC5F755FA2CAC2B6866A0A91C5C752')
        },
        {
          text: 'RadioGatún[32] - "The quick brown fox jumps over the lazy dog"',
          uri: 'https://en.wikipedia.org/wiki/RadioGatún',
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          expected: OpCodes.Hex8ToBytes('191589005FEC1F2A248F96A16E9553BF38D0AEE1648FFA036655CE29C2E229AE')
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new RadioGatunInstance(this);
    }
  }

  class RadioGatunInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.hasher = new RadioGatunHasher();
      this.inputBuffer = [];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      // Process accumulated input
      this.hasher.update(this.inputBuffer);
      const result = this.hasher.finalize(32); // Default 256-bit output

      // Reset for next use
      this.hasher = new RadioGatunHasher();
      this.inputBuffer = [];

      return Array.from(result);
    }
  }


  // ===== REGISTRATION =====

  const algorithmInstance = new RadioGatunAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RadioGatunAlgorithm, RadioGatunInstance, RadioGatunHasher };
}));