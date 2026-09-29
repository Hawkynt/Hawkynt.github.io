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
   * @class
   */
  class RadioGatunHasher {
    constructor() {
      // RadioGatún[32] state arrays - exact C reference sizes
      /** @type {uint32[]} */
      this.e = new Uint32Array(42); // mill array
      /** @type {uint32[]} */
      this.f = new Uint32Array(42); // belt array
      /** @type {uint32[]} */
      this.n = new Uint32Array(45); // temp array for mill transformation
      /** @type {int32} */
      this.g = 19; // mill size
      /** @type {int32} */
      this.h = 13; // belt width

      // Arrays are initialized to zero by Uint32Array constructor

      /** @type {uint8[]} */
      this.buffer = [];
      /** @type {boolean} */
      this.inputPhase = true;
    }

    /**
     * Belt-and-mill round function (nanorg32.c m())
     * @returns {void}
     */
    beltmill() {
      // Exact translation of C nanorg32.c beltmill function m()
      let j = 0;

      // Mill-to-belt feedforward: b(12)f[c+c%3*h]^=e[c+1]
      for (let c = 0; c < 12; c++) {
        this.f[c + (c % 3) * this.h] = OpCodes.Xor32(this.f[c + (c % 3) * this.h], this.e[c + 1]);
      }

      // Mill transformation: b(g){i=c*7%g;k=e[i++];k^=e[i%g]|~e[(i+1)%g];j+=c;n[c]=n[c+g]=k>>j%32|k<<-j%32;}
      for (let c = 0; c < this.g; c++) {
        let i = (c * 7) % this.g;
        let k = this.e[i++];
        k = OpCodes.ToUint32(OpCodes.Xor32(k, OpCodes.Or32(this.e[i % this.g], OpCodes.Not32(this.e[(i + 1) % this.g]))));
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
        this.e[idx] = OpCodes.Xor32(OpCodes.Xor32(this.n[idx], this.n[idx + 1]), this.n[idx + 4]);
        this.f[i] = this.f[idx]; // f[i+1] = f[i] where i is the decremented value
      }

      // Belt-to-mill feedforward: b(3)e[c+h]^=f[c*h]=f[c*h+h]
      for (let c = 0; c < 3; c++) {
        this.f[c * this.h] = this.f[c * this.h + this.h];
        this.e[c + this.h] = OpCodes.Xor32(this.e[c + this.h], this.f[c * this.h]);
      }

      // Iota: *e^=1
      this.e[0] = OpCodes.Xor32(this.e[0], 1);
    }

    /**
     * Append message bytes
     * @param {uint8[]} data - Message bytes
     * @returns {void}
     */
    update(data) {
      if (!this.inputPhase) {
        throw new Error('Cannot update after finalization has begun');
      }

      // Add data to buffer
      for (let i = 0; i < data.length; i++) {
        this.buffer.push(data[i]);
      }
    }

    /**
     * Absorb the buffered input (once) and squeeze output bytes
     * @param {int32} outputBytes - Number of output bytes (at most 32)
     * @returns {uint8[]} Digest bytes (a Uint8Array)
     */
    finalize(outputBytes) {

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
          const byte = OpCodes.And32(OpCodes.Shr32(this.e[wordIndex], 8 * bytePos), 255);
          output[outputOffset++] = byte;
        }
        // After odd iterations (wordSelect % 2 == 1), run mill
        if ((wordSelect % 2) === 1) {
          this.beltmill();
        }
      }

      return output;
    }

    /**
     * Absorb the whole buffer with the 0x01 padding and 18 blank rounds
     * @returns {void}
     */
    processAllInput() {
      // C: for(;;m()){b(3){for(j=0;j<4;){f[c*h]^=k=OpCodes.Shl32((*q?255&*q:1), 8)*j++;e[c+16]^=k;if(!*q++){b(18)m();return;}}}}
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
              byte = OpCodes.And32(this.buffer[inputPos], 0xFF);
            } else {
              byte = 1; // Padding
              hitEnd = true;
            }

            // k = byte << (8*j)
            let k = OpCodes.Shl32(byte, 8 * j);

            // f[c*h]^=k; e[c+16]^=k;
            this.f[c * this.h] = OpCodes.Xor32(this.f[c * this.h], k);
            this.e[c + 16] = OpCodes.Xor32(this.e[c + 16], k);

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
    }
  }

  /**
 * RadioGatunAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

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

      this.references = [
        new LinkItem("RadioGatún official reference code and test vectors", "https://radiogatun.noekeon.org/")
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

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {RadioGatunInstance} New hash instance, null for the (nonexistent) inverse
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new RadioGatunInstance(this);
    }
  }

  /**
 * RadioGatun cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class RadioGatunInstance extends IHashFunctionInstance {
    /**
     * @param {RadioGatunAlgorithm} algorithm - Parent algorithm
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {RadioGatunHasher} */
      this.hasher = new RadioGatunHasher();
      this.inputBuffer = [];
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Process accumulated input
      this.hasher.update(this.inputBuffer);
      /** @type {uint8[]} */
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