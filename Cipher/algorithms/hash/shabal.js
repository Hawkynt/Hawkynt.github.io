/*
 * Shabal Hash Function
 *
 * Shabal is a cryptographic hash function submitted to NIST's SHA-3 competition.
 * It advanced to the second round but was not selected as a finalist.
 *
 * Reference Implementation:
 * https://github.com/pornin/sphlib/blob/master/c/shabal.c
 * https://github.com/RustCrypto/hashes/tree/master/shabal
 *
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
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== SHABAL INITIALIZATION CONSTANTS =====
  // From https://github.com/RustCrypto/hashes/blob/master/shabal/src/consts.rs

  const INIT_192 = {
    a: [0xFD749ED4, 0xB798E530, 0x33904B6F, 0x46BDA85E, 0x076934B4, 0x454B4058, 0x77F74527, 0xFB4CF465, 0x62931DA9, 0xE778C8DB, 0x22B3998E, 0xAC15CFB9],
    b: [0x58BCBAC4, 0xEC47A08E, 0xAEE933B2, 0xDFCBC824, 0xA7944804, 0xBF65BDB0, 0x5A9D4502, 0x599779AF, 0xC5CEA54E, 0x4B6B8150, 0x16E71909, 0x7D632319, 0x930573A0, 0xF34C63D1, 0xCAF914B4, 0xFDD6612C],
    c: [0x61550878, 0x89EF2B75, 0xA1660C46, 0x7EF3855B, 0x7297B58C, 0x1BC67793, 0x7FB1C723, 0xB66FC640, 0x1A48B71C, 0xF0976D17, 0x088CE80A, 0xA454EDF3, 0x1C096BF4, 0xAC76224B, 0x5215781C, 0xCD5D2669]
  };

  const INIT_224 = {
    a: [0xA5201467, 0xA9B8D94A, 0xD4CED997, 0x68379D7B, 0xA7FC73BA, 0xF1A2546B, 0x606782BF, 0xE0BCFD0F, 0x2F25374E, 0x069A149F, 0x5E2DFF25, 0xFAECF061],
    b: [0xEC9905D8, 0xF21850CF, 0xC0A746C8, 0x21DAD498, 0x35156EEB, 0x088C97F2, 0x26303E40, 0x8A2D4FB5, 0xFEEE44B6, 0x8A1E9573, 0x7B81111A, 0xCBC139F0, 0xA3513861, 0x1D2C362E, 0x918C580E, 0xB58E1B9C],
    c: [0xE4B573A1, 0x4C1A0880, 0x1E907C51, 0x04807EFD, 0x3AD8CDE5, 0x16B21302, 0x02512C53, 0x2204CB18, 0x99405F2D, 0xE5B648A1, 0x70AB1D43, 0xA10C25C2, 0x16F1AC05, 0x38BBEB56, 0x9B01DC60, 0xB1096D83]
  };

  const INIT_256 = {
    a: [0x52F84552, 0xE54B7999, 0x2D8EE3EC, 0xB9645191, 0xE0078B86, 0xBB7C44C9, 0xD2B5C1CA, 0xB0D2EB8C, 0x14CE5A45, 0x22AF50DC, 0xEFFDBC6B, 0xEB21B74A],
    b: [0xB555C6EE, 0x3E710596, 0xA72A652F, 0x9301515F, 0xDA28C1FA, 0x696FD868, 0x9CB6BF72, 0x0AFE4002, 0xA6E03615, 0x5138C1D4, 0xBE216306, 0xB38B8890, 0x3EA8B96B, 0x3299ACE4, 0x30924DD4, 0x55CB34A5],
    c: [0xB405F031, 0xC4233EBA, 0xB3733979, 0xC0DD9D55, 0xC51C28AE, 0xA327B8E1, 0x56C56167, 0xED614433, 0x88B59D60, 0x60E2CEBA, 0x758B4B8B, 0x83E82A7F, 0xBC968828, 0xE6E00BF7, 0xBA839E55, 0x9B491C60]
  };

  const INIT_384 = {
    a: [0xC8FCA331, 0xE55C504E, 0x003EBF26, 0xBB6B8D83, 0x7B0448C1, 0x41B82789, 0x0A7C9601, 0x8D659CFF, 0xB6E2673E, 0xCA54C77B, 0x1460FD7E, 0x3FCB8F2D],
    b: [0x527291FC, 0x2A16455F, 0x78E627E5, 0x944F169F, 0x1CA6F016, 0xA854EA25, 0x8DB98ABE, 0xF2C62641, 0x301117DC, 0xCF5C4309, 0x93711A25, 0xF9F671B8, 0xB01D2116, 0x333F4B89, 0xB285D165, 0x86829B36],
    c: [0xF764B11A, 0x76172146, 0xCEF6934D, 0xC6D28399, 0xFE095F61, 0x5E6018B4, 0x5048ECF5, 0x51353261, 0x6E6E36DC, 0x63130DAD, 0xA9C69BD6, 0x1E90EA0C, 0x7C35073B, 0x28D95E6D, 0xAA340E0D, 0xCB3DEE70]
  };

  const INIT_512 = {
    a: [0x20728DFD, 0x46C0BD53, 0xE782B699, 0x55304632, 0x71B4EF90, 0x0EA9E82C, 0xDBB930F1, 0xFAD06B8B, 0xBE0CAE40, 0x8BD14410, 0x76D2ADAC, 0x28ACAB7F],
    b: [0xC1099CB7, 0x07B385F3, 0xE7442C26, 0xCC8AD640, 0xEB6F56C7, 0x1EA81AA9, 0x73B9D314, 0x1DE85D08, 0x48910A5A, 0x893B22DB, 0xC5A0DF44, 0xBBC4324E, 0x72D2F240, 0x75941D99, 0x6D8BDE82, 0xA1A7502B],
    c: [0xD9BF68D1, 0x58BAD750, 0x560228CB, 0x8134F359, 0xB5D469D8, 0x941A8CC2, 0x418B2A6E, 0x04052780, 0x7F07D787, 0x5194358F, 0x3C60D665, 0xBE97D79A, 0x950C3434, 0xAED9A06D, 0x2537DC8D, 0x7CDB5969]
  };

  // ===== SHABAL CORE ALGORITHM =====

  class ShabalCore {
    constructor(outputSize) {
      this.outputSize = outputSize;

      // Select initialization vector based on output size
      let init;
      switch (outputSize) {
        case 24: init = INIT_192; break;
        case 28: init = INIT_224; break;
        case 32: init = INIT_256; break;
        case 48: init = INIT_384; break;
        case 64: init = INIT_512; break;
        default: throw new Error('Invalid output size: ' + outputSize);
      }

      // Initialize state arrays (use spread to copy arrays)
      this.a = [...init.a];
      this.b = [...init.b];
      this.c = [...init.c];
      this.w = 1; // Block counter starts at 1

      // Input buffer for incomplete blocks
      this.buffer = [];
      this.totalLength = 0;
    }

    // Add message block to B
    addM(m) {
      for (let i = 0; i < 16; ++i) {
        this.b[i] = (this.b[i] + m[i]) >>> 0;
      }
    }

    // Subtract message block from C
    subM(m) {
      for (let i = 0; i < 16; ++i) {
        this.c[i] = (this.c[i] - m[i]) >>> 0;
      }
    }

    // XOR block counter into A
    xorW() {
      this.a[0] = (this.a[0]^(this.w&0xFFFFFFFF)) >>> 0;
      this.a[1] = (this.a[1]^((this.w / 0x100000000) >>> 0)) >>> 0;
    }

    // Permutation element operation
    permElt(xa0, xa1, xb0, xb1, xb2, xb3, xc0, xm) {
      const t1 = OpCodes.RotL32(this.a[xa1], 15);
      const t2 = (t1 * 5) >>> 0;
      const t3 = ((this.a[xa0]^t2^this.c[xc0]) * 3) >>> 0;
      this.a[xa0] = (t3^this.b[xb1]^(this.b[xb2]&~this.b[xb3])^xm) >>> 0;

      const t = OpCodes.RotL32(this.b[xb0], 1);
      this.b[xb0] = (~(t^this.a[xa0])) >>> 0;
    }

    // Full permutation on message block
    permBlocks(m) {
      // 48 permutation operations (3 passes of 16 operations each)
      // Pass 1
      this.permElt(0, 11, 0, 13, 9, 6, 8, m[0]);
      this.permElt(1, 0, 1, 14, 10, 7, 7, m[1]);
      this.permElt(2, 1, 2, 15, 11, 8, 6, m[2]);
      this.permElt(3, 2, 3, 0, 12, 9, 5, m[3]);
      this.permElt(4, 3, 4, 1, 13, 10, 4, m[4]);
      this.permElt(5, 4, 5, 2, 14, 11, 3, m[5]);
      this.permElt(6, 5, 6, 3, 15, 12, 2, m[6]);
      this.permElt(7, 6, 7, 4, 0, 13, 1, m[7]);
      this.permElt(8, 7, 8, 5, 1, 14, 0, m[8]);
      this.permElt(9, 8, 9, 6, 2, 15, 15, m[9]);
      this.permElt(10, 9, 10, 7, 3, 0, 14, m[10]);
      this.permElt(11, 10, 11, 8, 4, 1, 13, m[11]);
      this.permElt(0, 11, 12, 9, 5, 2, 12, m[12]);
      this.permElt(1, 0, 13, 10, 6, 3, 11, m[13]);
      this.permElt(2, 1, 14, 11, 7, 4, 10, m[14]);
      this.permElt(3, 2, 15, 12, 8, 5, 9, m[15]);

      // Pass 2
      this.permElt(4, 3, 0, 13, 9, 6, 8, m[0]);
      this.permElt(5, 4, 1, 14, 10, 7, 7, m[1]);
      this.permElt(6, 5, 2, 15, 11, 8, 6, m[2]);
      this.permElt(7, 6, 3, 0, 12, 9, 5, m[3]);
      this.permElt(8, 7, 4, 1, 13, 10, 4, m[4]);
      this.permElt(9, 8, 5, 2, 14, 11, 3, m[5]);
      this.permElt(10, 9, 6, 3, 15, 12, 2, m[6]);
      this.permElt(11, 10, 7, 4, 0, 13, 1, m[7]);
      this.permElt(0, 11, 8, 5, 1, 14, 0, m[8]);
      this.permElt(1, 0, 9, 6, 2, 15, 15, m[9]);
      this.permElt(2, 1, 10, 7, 3, 0, 14, m[10]);
      this.permElt(3, 2, 11, 8, 4, 1, 13, m[11]);
      this.permElt(4, 3, 12, 9, 5, 2, 12, m[12]);
      this.permElt(5, 4, 13, 10, 6, 3, 11, m[13]);
      this.permElt(6, 5, 14, 11, 7, 4, 10, m[14]);
      this.permElt(7, 6, 15, 12, 8, 5, 9, m[15]);

      // Pass 3
      this.permElt(8, 7, 0, 13, 9, 6, 8, m[0]);
      this.permElt(9, 8, 1, 14, 10, 7, 7, m[1]);
      this.permElt(10, 9, 2, 15, 11, 8, 6, m[2]);
      this.permElt(11, 10, 3, 0, 12, 9, 5, m[3]);
      this.permElt(0, 11, 4, 1, 13, 10, 4, m[4]);
      this.permElt(1, 0, 5, 2, 14, 11, 3, m[5]);
      this.permElt(2, 1, 6, 3, 15, 12, 2, m[6]);
      this.permElt(3, 2, 7, 4, 0, 13, 1, m[7]);
      this.permElt(4, 3, 8, 5, 1, 14, 0, m[8]);
      this.permElt(5, 4, 9, 6, 2, 15, 15, m[9]);
      this.permElt(6, 5, 10, 7, 3, 0, 14, m[10]);
      this.permElt(7, 6, 11, 8, 4, 1, 13, m[11]);
      this.permElt(8, 7, 12, 9, 5, 2, 12, m[12]);
      this.permElt(9, 8, 13, 10, 6, 3, 11, m[13]);
      this.permElt(10, 9, 14, 11, 7, 4, 10, m[14]);
      this.permElt(11, 10, 15, 12, 8, 5, 9, m[15]);
    }

    // Full permutation with all steps
    perm(m) {
      // Rotate B elements left by 17 bits
      for (let i = 0; i < 16; ++i) {
        this.b[i] = OpCodes.RotL32(this.b[i], 17);
      }

      // Apply permutation blocks
      this.permBlocks(m);

      // Add C elements to A
      this.a[0] = (this.a[0] + this.c[11] + this.c[15] + this.c[3]) >>> 0;
      this.a[1] = (this.a[1] + this.c[12] + this.c[0] + this.c[4]) >>> 0;
      this.a[2] = (this.a[2] + this.c[13] + this.c[1] + this.c[5]) >>> 0;
      this.a[3] = (this.a[3] + this.c[14] + this.c[2] + this.c[6]) >>> 0;
      this.a[4] = (this.a[4] + this.c[15] + this.c[3] + this.c[7]) >>> 0;
      this.a[5] = (this.a[5] + this.c[0] + this.c[4] + this.c[8]) >>> 0;
      this.a[6] = (this.a[6] + this.c[1] + this.c[5] + this.c[9]) >>> 0;
      this.a[7] = (this.a[7] + this.c[2] + this.c[6] + this.c[10]) >>> 0;
      this.a[8] = (this.a[8] + this.c[3] + this.c[7] + this.c[11]) >>> 0;
      this.a[9] = (this.a[9] + this.c[4] + this.c[8] + this.c[12]) >>> 0;
      this.a[10] = (this.a[10] + this.c[5] + this.c[9] + this.c[13]) >>> 0;
      this.a[11] = (this.a[11] + this.c[6] + this.c[10] + this.c[14]) >>> 0;
    }

    // Swap B and C arrays
    swapBC() {
      const temp = this.b;
      this.b = this.c;
      this.c = temp;
    }

    // Read 16 32-bit words from 64-byte block (little-endian)
    readM(block) {
      const m = new Array(16);
      for (let i = 0; i < 16; ++i) {
        m[i] = OpCodes.Pack32LE(
          block[i * 4],
          block[i * 4 + 1],
          block[i * 4 + 2],
          block[i * 4 + 3]
        );
      }
      return m;
    }

    // Process one 64-byte block
    processBlock(block) {
      const m = this.readM(block);
      this.addM(m);
      this.xorW();
      this.perm(m);
      this.subM(m);
      this.swapBC();
      this.w += 1;
    }

    // Update with data
    update(data) {
      if (!data || data.length === 0) return;

      this.buffer.push(...data);
      this.totalLength += data.length;

      // Process complete 64-byte blocks
      while (this.buffer.length >= 64) {
        const block = this.buffer.splice(0, 64);
        this.processBlock(block);
      }
    }

    // Finalize and produce hash
    finalize() {
      // Pad final block with 0x80 followed by zeros
      const pos = this.buffer.length;
      this.buffer[pos] = 0x80;

      // Pad to 64 bytes
      while (this.buffer.length < 64) {
        this.buffer.push(0x00);
      }

      const m = this.readM(this.buffer);

      // Process final block
      this.addM(m);
      this.xorW();
      this.perm(m);

      // Additional 3 rounds without incrementing W
      for (let i = 0; i < 3; ++i) {
        this.swapBC();
        this.xorW();
        this.perm(m);
      }

      // Extract hash from B (little-endian)
      const hash = [];
      for (let i = 0; i < this.outputSize / 4; ++i) {
        const bytes = OpCodes.Unpack32LE(this.b[i]);
        hash.push(...bytes);
      }

      return hash;
    }
  }

  // ===== SHABAL ALGORITHM CLASSES =====

  // Base class for all Shabal variants
  /**
 * ShabalAlgorithmBase - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class ShabalAlgorithmBase extends HashFunctionAlgorithm {
    constructor(variant, outputSize) {
      super();

      this.name = 'Shabal-' + variant;
      this.description = 'Shabal-' + variant + ' is a cryptographic hash function submitted to NIST SHA-3 competition. Advanced to second round but was not selected as finalist due to security concerns.';
      this.inventor = 'Emmanuel Bresson, Anne Canteaut, Benoit Chevallier-Mames, Christophe Clavier, Thomas Fuhr, Aline Gouget, Thomas Icart, Jean-Francois Misarsky, Maria Naya-Plasencia, Pascal Paillier, Thomas Pornin, Jean-Rene Reinhard, Celine Thuillet, Marion Videau';
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = 'SHA-3 Candidate';
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FR;

      this.outputSize = outputSize;
      this.blockSize = 64; // 512 bits
      this.SupportedOutputSizes = [outputSize];

      this.documentation = [
        new LinkItem('Shabal Specification', 'https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/sha-3/documents/Shabal.pdf'),
        new LinkItem('NIST SHA-3 Competition', 'https://csrc.nist.gov/projects/hash-functions/sha-3-project'),
        new LinkItem('Wikipedia - Shabal', 'https://en.wikipedia.org/wiki/Shabal')
      ];

      this.references = [
        new LinkItem('RustCrypto Shabal Implementation', 'https://github.com/RustCrypto/hashes/tree/master/shabal'),
        new LinkItem('sphlib Reference Implementation', 'https://github.com/pornin/sphlib/blob/master/c/shabal.c')
      ];

      // Test vectors will be added by subclasses
      this.tests = [];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new ShabalAlgorithmInstance(this, this.outputSize);
    }
  }

  /**
 * ShabalAlgorithm cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ShabalAlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm, outputSize) {
      super(algorithm);
      this.outputSize = outputSize;
      this.core = new ShabalCore(outputSize);
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Convert string to bytes if needed
      if (typeof data === 'string') {
        data = OpCodes.AnsiToBytes(data);
      }

      this.core.update(data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      return this.core.finalize();
    }
  }

  // ===== SHABAL VARIANTS =====

  class Shabal192 extends ShabalAlgorithmBase {
    constructor() {
      super(192, 24);

      // Test vectors validated against reference implementation
      this.tests = [
        {
          text: 'Empty string',
          uri: 'https://github.com/RustCrypto/hashes/tree/master/shabal',
          input: OpCodes.AnsiToBytes(''),
          expected: OpCodes.Hex8ToBytes('b09ada740ba5c9b2b1ceca00d247782ff61635a541bcda20')
        },
        {
          text: 'Test: "abc"',
          uri: 'https://github.com/RustCrypto/hashes/tree/master/shabal',
          input: OpCodes.AnsiToBytes('abc'),
          expected: OpCodes.Hex8ToBytes('3d332f26b12be360ce530da8446ae4e3236167148acd5abf')
        },
        {
          text: 'Test: "message digest"',
          uri: 'https://github.com/RustCrypto/hashes/tree/master/shabal',
          input: OpCodes.AnsiToBytes('message digest'),
          expected: OpCodes.Hex8ToBytes('52ea651a570af365328bc7aa05fb1764392fa06640ff3bd9')
        }
      ];
    }
  }

  class Shabal224 extends ShabalAlgorithmBase {
    constructor() {
      super(224, 28);

      // Test vectors validated against reference implementation
      this.tests = [
        {
          text: 'Empty string',
          uri: 'https://github.com/RustCrypto/hashes/tree/master/shabal',
          input: OpCodes.AnsiToBytes(''),
          expected: OpCodes.Hex8ToBytes('9ba48ff8698b52af7ff8bf6907d1f583d25995584f6a6666adecf77c')
        },
        {
          text: 'Test: "abc"',
          uri: 'https://github.com/RustCrypto/hashes/tree/master/shabal',
          input: OpCodes.AnsiToBytes('abc'),
          expected: OpCodes.Hex8ToBytes('1ef493c9a9b6f29ecd8325c4ff614a8e03fe9badf66bc2270711d1d7')
        },
        {
          text: 'Test: "message digest"',
          uri: 'https://github.com/RustCrypto/hashes/tree/master/shabal',
          input: OpCodes.AnsiToBytes('message digest'),
          expected: OpCodes.Hex8ToBytes('b592ae2f6e452fbf688532490fe0942495afb390d089d3f058d3a5aa')
        }
      ];
    }
  }

  class Shabal256 extends ShabalAlgorithmBase {
    constructor() {
      super(256, 32);

      // Test vectors validated against reference implementation
      this.tests = [
        {
          text: 'Empty string',
          uri: 'https://github.com/RustCrypto/hashes/tree/master/shabal',
          input: OpCodes.AnsiToBytes(''),
          expected: OpCodes.Hex8ToBytes('e423f8b7b92d7b56bc904bcd77fc2724d428d633775ce9ccc3e24672e3ea5900')
        },
        {
          text: 'Test: "a"',
          uri: 'https://github.com/RustCrypto/hashes/tree/master/shabal',
          input: OpCodes.AnsiToBytes('a'),
          expected: OpCodes.Hex8ToBytes('8b2713afd40ae006bc1e4376ed0944019661424d4f3d834385b4284ec54f4b14')
        },
        {
          text: 'Test: "abc"',
          uri: 'https://github.com/RustCrypto/hashes/tree/master/shabal',
          input: OpCodes.AnsiToBytes('abc'),
          expected: OpCodes.Hex8ToBytes('16fce961d2912aabbb68666c4ad6cc33a10fcb5242bf202835b3f630135e7e1a')
        },
        {
          text: 'Test: "message digest"',
          uri: 'https://github.com/RustCrypto/hashes/tree/master/shabal',
          input: OpCodes.AnsiToBytes('message digest'),
          expected: OpCodes.Hex8ToBytes('fae9365a72aad1e5f26943c32abdd458e687896b633b4032a72619f996b38380')
        }
      ];
    }
  }

  class Shabal384 extends ShabalAlgorithmBase {
    constructor() {
      super(384, 48);

      // Test vectors validated against reference implementation
      this.tests = [
        {
          text: 'Empty string',
          uri: 'https://github.com/RustCrypto/hashes/tree/master/shabal',
          input: OpCodes.AnsiToBytes(''),
          expected: OpCodes.Hex8ToBytes('89a352fac1aa5e3b352dd0583ec3150f39da60a37d54ba5d3ddd462ce1c6c8ff44c8ce63597c7d4527f5d4fae0a360e2')
        },
        {
          text: 'Test: "abc"',
          uri: 'https://github.com/RustCrypto/hashes/tree/master/shabal',
          input: OpCodes.AnsiToBytes('abc'),
          expected: OpCodes.Hex8ToBytes('52534f8087ea39998ec3bb883fefef2b5c7969a68257638888f5f5cf24a7e75ade1091c3a5dc972c4d8cf9c16a067e48')
        }
      ];
    }
  }

  class Shabal512 extends ShabalAlgorithmBase {
    constructor() {
      super(512, 64);

      // Test vectors validated against reference implementation
      this.tests = [
        {
          text: 'Empty string',
          uri: 'https://github.com/RustCrypto/hashes/tree/master/shabal',
          input: OpCodes.AnsiToBytes(''),
          expected: OpCodes.Hex8ToBytes('5d96afa391e772147ea97c86b7e62f699c559d0d5fbc8a3cba11bf2e856398232c7033c163a058778f9ffc7576ad72be95ab38475d5940f748ca99c8a3d5ba55')
        },
        {
          text: 'Test: "abc"',
          uri: 'https://github.com/RustCrypto/hashes/tree/master/shabal',
          input: OpCodes.AnsiToBytes('abc'),
          expected: OpCodes.Hex8ToBytes('f83d74d7425501000d846f0bb76e5fb90f3f767d7388174b089f58a87ca2261d70a27f03adfe109a3f718c7ff5bc800f505f4d0116169bd8c758d5adb3f4b0c7')
        }
      ];
    }
  }

  // Register all variants
  RegisterAlgorithm(new Shabal192());
  RegisterAlgorithm(new Shabal224());
  RegisterAlgorithm(new Shabal256());
  RegisterAlgorithm(new Shabal384());
  RegisterAlgorithm(new Shabal512());

  return {
    Shabal192: Shabal192,
    Shabal224: Shabal224,
    Shabal256: Shabal256,
    Shabal384: Shabal384,
    Shabal512: Shabal512
  };
}));
