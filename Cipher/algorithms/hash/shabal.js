/*
 * Shabal Hash Function - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * Shabal was submitted to the NIST SHA-3 competition by the Saphir project and
 * reached the second round. It keeps three registers - A of twelve words, B and
 * C of sixteen each - and a block counter W. Every 512-bit message block is
 * added into B, mixed by a permutation of forty-eight steps, subtracted from C,
 * and then B and C trade places.
 *
 * The five digest sizes share one core and differ only in their initial state
 * and in how many words of B the digest is taken from. The digest is always the
 * TAIL of B: Shabal-256 returns B[8..15], not B[0..7].
 *
 * The initial states below are the published values reached by running the
 * compression function over the two initialisation blocks, so hashing starts
 * with the counter already at one.
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
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, Vulnerability,
          KeySize, BlockAbsorber } = AlgorithmFramework;

  // ===== CONSTANTS =====

  const BLOCK_SIZE = 64; // 512 bits

  // ===== SHABAL INITIAL STATES =====

  const INIT_192 = Object.freeze({
    a: Object.freeze([
      0xFD749ED4, 0xB798E530, 0x33904B6F, 0x46BDA85E,
      0x076934B4, 0x454B4058, 0x77F74527, 0xFB4CF465,
      0x62931DA9, 0xE778C8DB, 0x22B3998E, 0xAC15CFB9
    ]),
    b: Object.freeze([
      0x58BCBAC4, 0xEC47A08E, 0xAEE933B2, 0xDFCBC824,
      0xA7944804, 0xBF65BDB0, 0x5A9D4502, 0x59979AF7,
      0xC5CEA54E, 0x4B6B8150, 0x16E71909, 0x7D632319,
      0x930573A0, 0xF34C63D1, 0xCAF914B4, 0xFDD6612C
    ]),
    c: Object.freeze([
      0x61550878, 0x89EF2B75, 0xA1660C46, 0x7EF3855B,
      0x7297B58C, 0x1BC67793, 0x7FB1C723, 0xB66FC640,
      0x1A48B71C, 0xF0976D17, 0x088CE80A, 0xA454EDF3,
      0x1C096BF4, 0xAC76224B, 0x5215781C, 0xCD5D2669
    ])
  });

  const INIT_224 = Object.freeze({
    a: Object.freeze([
      0xA5201467, 0xA9B8D94A, 0xD4CED997, 0x68379D7B,
      0xA7FC73BA, 0xF1A2546B, 0x606782BF, 0xE0BCFD0F,
      0x2F25374E, 0x069A149F, 0x5E2DFF25, 0xFAECF061
    ]),
    b: Object.freeze([
      0xEC9905D8, 0xF21850CF, 0xC0A746C8, 0x21DAD498,
      0x35156EEB, 0x088C97F2, 0x26303E40, 0x8A2D4FB5,
      0xFEEE44B6, 0x8A1E9573, 0x7B81111A, 0xCBC139F0,
      0xA3513861, 0x1D2C362E, 0x918C580E, 0xB58E1B9C
    ]),
    c: Object.freeze([
      0xE4B573A1, 0x4C1A0880, 0x1E907C51, 0x04807EFD,
      0x3AD8CDE5, 0x16B21302, 0x02512C53, 0x2204CB18,
      0x99405F2D, 0xE5B648A1, 0x70AB1D43, 0xA10C25C2,
      0x16F1AC05, 0x38BBEB56, 0x9B01DC60, 0xB1096D83
    ])
  });

  const INIT_256 = Object.freeze({
    a: Object.freeze([
      0x52F84552, 0xE54B7999, 0x2D8EE3EC, 0xB9645191,
      0xE0078B86, 0xBB7C44C9, 0xD2B5C1CA, 0xB0D2EB8C,
      0x14CE5A45, 0x22AF50DC, 0xEFFDBC6B, 0xEB21B74A
    ]),
    b: Object.freeze([
      0xB555C6EE, 0x3E710596, 0xA72A652F, 0x9301515F,
      0xDA28C1FA, 0x696FD868, 0x9CB6BF72, 0x0AFE4002,
      0xA6E03615, 0x5138C1D4, 0xBE216306, 0xB38B8890,
      0x3EA8B96B, 0x3299ACE4, 0x30924DD4, 0x55CB34A5
    ]),
    c: Object.freeze([
      0xB405F031, 0xC4233EBA, 0xB3733979, 0xC0DD9D55,
      0xC51C28AE, 0xA327B8E1, 0x56C56167, 0xED614433,
      0x88B59D60, 0x60E2CEBA, 0x758B4B8B, 0x83E82A7F,
      0xBC968828, 0xE6E00BF7, 0xBA839E55, 0x9B491C60
    ])
  });

  const INIT_384 = Object.freeze({
    a: Object.freeze([
      0xC8FCA331, 0xE55C504E, 0x003EBF26, 0xBB6B8D83,
      0x7B0448C1, 0x41B82789, 0x0A7C9601, 0x8D659CFF,
      0xB6E2673E, 0xCA54C77B, 0x1460FD7E, 0x3FCB8F2D
    ]),
    b: Object.freeze([
      0x527291FC, 0x2A16455F, 0x78E627E5, 0x944F169F,
      0x1CA6F016, 0xA854EA25, 0x8DB98ABE, 0xF2C62641,
      0x30117DCB, 0xCF5C4309, 0x93711A25, 0xF9F671B8,
      0xB01D2116, 0x333F4B89, 0xB285D165, 0x86829B36
    ]),
    c: Object.freeze([
      0xF764B11A, 0x76172146, 0xCEF6934D, 0xC6D28399,
      0xFE095F61, 0x5E6018B4, 0x5048ECF5, 0x51353261,
      0x6E6E36DC, 0x63130DAD, 0xA9C69BD6, 0x1E90EA0C,
      0x7C35073B, 0x28D95E6D, 0xAA340E0D, 0xCB3DEE70
    ])
  });

  const INIT_512 = Object.freeze({
    a: Object.freeze([
      0x20728DFD, 0x46C0BD53, 0xE782B699, 0x55304632,
      0x71B4EF90, 0x0EA9E82C, 0xDBB930F1, 0xFAD06B8B,
      0xBE0CAE40, 0x8BD14410, 0x76D2ADAC, 0x28ACAB7F
    ]),
    b: Object.freeze([
      0xC1099CB7, 0x07B385F3, 0xE7442C26, 0xCC8AD640,
      0xEB6F56C7, 0x1EA81AA9, 0x73B9D314, 0x1DE85D08,
      0x48910A5A, 0x893B22DB, 0xC5A0DF44, 0xBBC4324E,
      0x72D2F240, 0x75941D99, 0x6D8BDE82, 0xA1A7502B
    ]),
    c: Object.freeze([
      0xD9BF68D1, 0x58BAD750, 0x56028CB2, 0x8134F359,
      0xB5D469D8, 0x941A8CC2, 0x418B2A6E, 0x04052780,
      0x7F07D787, 0x5194358F, 0x3C60D665, 0xBE97D79A,
      0x950C3434, 0xAED9A06D, 0x2537DC8D, 0x7CDB5969
    ])
  });

  const INITIAL_STATE = Object.freeze({
    24: INIT_192,
    28: INIT_224,
    32: INIT_256,
    48: INIT_384,
    64: INIT_512
  });

  // ===== SHABAL CORE =====

  /**
   * The Shabal state and compression function.
   * @class
   */
  class ShabalCore {
    /**
     * @param {int} outputSize - digest length in bytes
     */
    constructor(outputSize) {
      const init = INITIAL_STATE[outputSize];
      if (!init) throw new Error('Invalid output size: ' + outputSize);

      this.outputSize = outputSize;
      this.a = init.a.slice();
      this.b = init.b.slice();
      this.c = init.c.slice();

      // The published initial states already include the two initialisation
      // blocks, so the counter starts at one rather than zero.
      this.w = 1;

      this.absorber = new BlockAbsorber(BLOCK_SIZE, block => this.processBlock(block));
    }

    /**
     * Read sixteen little-endian 32-bit words from a 64-byte block.
     * @param {uint8[]} block
     * @returns {uint32[]} sixteen words
     */
    readM(block) {
      const m = new Array(16);
      for (let i = 0; i < 16; ++i)
        m[i] = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
      return m;
    }

    /**
     * Add the message block into B.
     * @param {uint32[]} m
     */
    addM(m) {
      for (let i = 0; i < 16; ++i) this.b[i] = OpCodes.ToUint32(this.b[i] + m[i]);
    }

    /**
     * Subtract the message block from C.
     * @param {uint32[]} m
     */
    subM(m) {
      for (let i = 0; i < 16; ++i) this.c[i] = OpCodes.ToUint32(this.c[i] - m[i]);
    }

    /**
     * Fold the block counter into the low two words of A.
     */
    xorW() {
      this.a[0] = OpCodes.Xor32(this.a[0], OpCodes.ToUint32(this.w));
      this.a[1] = OpCodes.Xor32(this.a[1], OpCodes.ToUint32(Math.floor(this.w / 0x100000000)));
    }

    /**
     * One of the forty-eight permutation steps.
     * @param {int} xa0 - index into A being written
     * @param {int} xa1 - index into A being read
     * @param {int} xb0 - index into B being written
     * @param {int} xb1 - index into B being read
     * @param {int} xb2 - index into B being read
     * @param {int} xb3 - index into B being read
     * @param {int} xc0 - index into C being read
     * @param {uint32} xm - the message word for this step
     */
    permElt(xa0, xa1, xb0, xb1, xb2, xb3, xc0, xm) {
      const spun = OpCodes.ToUint32(OpCodes.RotL32(this.a[xa1], 15) * 5);
      const mixed = OpCodes.ToUint32(
        OpCodes.Xor32(OpCodes.Xor32(this.a[xa0], spun), this.c[xc0]) * 3
      );
      const select = OpCodes.And32(this.b[xb2], OpCodes.Not32(this.b[xb3]));

      this.a[xa0] = OpCodes.Xor32(
        OpCodes.Xor32(OpCodes.Xor32(mixed, this.b[xb1]), select),
        xm
      );
      this.b[xb0] = OpCodes.Not32(OpCodes.Xor32(OpCodes.RotL32(this.b[xb0], 1), this.a[xa0]));
    }

    /**
     * The full permutation: rotate B, run three passes of sixteen steps, then
     * fold three staggered slices of C into A.
     * @param {uint32[]} m - the sixteen message words
     */
    perm(m) {
      for (let i = 0; i < 16; ++i) this.b[i] = OpCodes.RotL32(this.b[i], 17);

      for (let pass = 0; pass < 3; ++pass) {
        const base = pass * 4;
        for (let j = 0; j < 16; ++j) {
          this.permElt(
            (base + j) % 12,
            (base + j + 11) % 12,
            j,
            (j + 13) % 16,
            (j + 9) % 16,
            (j + 6) % 16,
            (24 - j) % 16,
            m[j]
          );
        }
      }

      // A[k] takes C[k + 11], C[k + 15] and C[k + 3], all modulo sixteen.
      for (let k = 0; k < 12; ++k) {
        let sum = this.a[k];
        sum += this.c[(k + 11) % 16];
        sum += this.c[(k + 15) % 16];
        sum += this.c[(k + 3) % 16];
        this.a[k] = OpCodes.ToUint32(sum);
      }
    }

    /**
     * Exchange B and C.
     */
    swapBC() {
      const held = this.b;
      this.b = this.c;
      this.c = held;
    }

    /**
     * Compress one full 512-bit block.
     * @param {uint8[]} block - exactly 64 bytes
     */
    processBlock(block) {
      const m = this.readM(block);
      this.addM(m);
      this.xorW();
      this.perm(m);
      this.subM(m);
      this.swapBC();
      this.w += 1;
    }

    /**
     * Absorb message bytes.
     * @param {uint8[]} data
     */
    update(data) {
      if (!data || data.length === 0) return;
      this.absorber.Absorb(Array.from(data));
    }

    /**
     * Pad, run the three extra permutations and read the digest out of B.
     * @returns {uint8[]} outputSize bytes
     */
    finalize() {
      // finalize() stays repeatable: Finish hands out a copy of the held bytes
      // without advancing the absorber, so the state is snapshotted and put
      // back once the digest has been read.
      const saved = [this.a, this.b, this.c, this.w];
      this.a = this.a.slice();
      this.b = this.b.slice();
      this.c = this.c.slice();

      this.absorber.Finish((held, pending) => {
        let rest = held;
        let count = pending;

        // A held block that is already full is an ordinary block; the absorber
        // only kept it back in case more data followed. Shabal then still owes
        // a block that is nothing but padding.
        if (count === BLOCK_SIZE) {
          this.processBlock(held);
          rest = [];
          count = 0;
        }

        const last = new Array(BLOCK_SIZE).fill(0);
        for (let i = 0; i < count; ++i) last[i] = OpCodes.ToByte(rest[i]);
        last[count] = 0x80;

        const m = this.readM(last);
        this.addM(m);
        this.xorW();
        this.perm(m);

        // Three more permutations over the same block, with B and C trading
        // places each time and the counter left where it is.
        for (let i = 0; i < 3; ++i) {
          this.swapBC();
          this.xorW();
          this.perm(m);
        }
      });

      // The digest is the tail of B, so a shorter digest drops leading words.
      const words = this.outputSize / 4;
      const digest = new Array(this.outputSize);
      let at = 0;
      for (let i = 16 - words; i < 16; ++i) {
        const bytes = OpCodes.Unpack32LE(this.b[i]);
        for (let j = 0; j < 4; ++j) digest[at++] = bytes[j];
      }

      this.a = saved[0];
      this.b = saved[1];
      this.c = saved[2];
      this.w = saved[3];
      return digest;
    }
  }

  // ===== ALGORITHM CLASSES =====

  /**
   * ShabalAlgorithmBase - shared metadata for every Shabal digest size
   * @class
   * @extends {HashFunctionAlgorithm}
   */
  class ShabalAlgorithmBase extends HashFunctionAlgorithm {
    /**
     * @param {int} variant - digest length in bits
     * @param {int} outputSize - digest length in bytes
     */
    constructor(variant, outputSize) {
      super();

      this.name = 'Shabal-' + variant;
      this.description = 'Shabal-' + variant + ' is a cryptographic hash function submitted to the NIST SHA-3 competition by the Saphir project. It advanced to the second round but was not selected as a finalist. Three registers and a block counter are mixed by a forty-eight step permutation over each 512-bit block.';
      this.inventor = 'Emmanuel Bresson, Anne Canteaut, Benoit Chevallier-Mames, Christophe Clavier, Thomas Fuhr, Aline Gouget, Thomas Icart, Jean-Francois Misarsky, Maria Naya-Plasencia, Pascal Paillier, Thomas Pornin, Jean-Rene Reinhard, Celine Thuillet, Marion Videau';
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = 'SHA-3 Candidate';
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FR;

      this.outputSize = outputSize;
      this.blockSize = BLOCK_SIZE;
      this.BlockSize = BLOCK_SIZE;
      this.SupportedOutputSizes = [outputSize];
      this.SupportedHashSizes = [new KeySize(outputSize, outputSize, 1)];

      this.documentation = [
        new LinkItem('Shabal Specification', 'https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/sha-3/documents/Shabal.pdf'),
        new LinkItem('NIST SHA-3 Competition', 'https://csrc.nist.gov/projects/hash-functions/sha-3-project'),
        new LinkItem('Wikipedia - Shabal', 'https://en.wikipedia.org/wiki/Shabal')
      ];

      this.references = [
        new LinkItem('sphlib reference implementation and vectors', 'https://github.com/pornin/sphlib/blob/master/c/test_shabal.c'),
        new LinkItem('RustCrypto Shabal Implementation', 'https://github.com/RustCrypto/hashes/tree/master/shabal')
      ];

      this.knownVulnerabilities = [
        new Vulnerability('Distinguisher on the keyed permutation', 'Non-random behaviour was shown for the internal permutation during the SHA-3 second round; no attack on the hash function itself followed, but the result contributed to Shabal not advancing.')
      ];

      this.tests = [];
    }

    /**
     * Create new hash instance
     * @param {boolean} [isInverse=false] - unused, hashes have no inverse
     * @returns {Object} New hash instance
     */
    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new ShabalAlgorithmInstance(this, this.outputSize);
    }
  }

  /**
   * Shabal hash instance implementing the Feed/Result pattern
   * @class
   * @extends {IHashFunctionInstance}
   */
  class ShabalAlgorithmInstance extends IHashFunctionInstance {
    /**
     * @param {Object} algorithm - parent algorithm
     * @param {int} outputSize - digest length in bytes
     */
    constructor(algorithm, outputSize) {
      super(algorithm);
      this.outputSize = outputSize;
      this.OutputSize = outputSize;
      this.core = new ShabalCore(outputSize);
    }

    /**
     * Feed data to the hash. Successive calls extend the message.
     * @param {uint8[]} data - Input data bytes
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data) && !ArrayBuffer.isView(data)) {
        throw new Error('Invalid input data - must be byte array');
      }
      this.core.update(data);
    }

    /**
     * Finish the message and return the digest.
     * @returns {uint8[]} outputSize bytes
     */
    Result() {
      return this.core.finalize();
    }
  }

  // ===== VARIANTS =====

  class Shabal192 extends ShabalAlgorithmBase {
    constructor() {
      super(192, 24);
      this.tests = [
        {
          text: "sphlib test_shabal.c - 103-byte reference string",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("6162636465666768696a6b6c6d6e6f707172737475767778797a2d303132333435363738392d4142434445464748494a4b4c4d4e4f505152535455565758595a2d303132333435363738392d6162636465666768696a6b6c6d6e6f707172737475767778797a"),
          expected: OpCodes.Hex8ToBytes("690fae79226d95760ae8fdb4f58c0537111756557d307b15")
        }
      ];
    }
  }

  class Shabal224 extends ShabalAlgorithmBase {
    constructor() {
      super(224, 28);
      this.tests = [
        {
          text: "NIST SHA-3 KAT Len=0 - empty message",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: [],
          expected: OpCodes.Hex8ToBytes("562b4fdbe1706247552927f814b66a3d74b465a090af23e277bf8029")
        },
        {
          text: "NIST SHA-3 KAT Len=8 - one byte",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("cc"),
          expected: OpCodes.Hex8ToBytes("63d1743b183146ac2a75416c9a0d88c66f85a422a43e3171ef9cc923")
        },
        {
          text: "NIST SHA-3 KAT Len=504 - 63 bytes, one under the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("f57c64006d9ea761892e145c99df1b24640883da79d9ed5262859dcda8c3c32e05b03d984f1ab4a230242ab6b78d368dc5aaa1e6d3498d53371e84b0c1d4ba"),
          expected: OpCodes.Hex8ToBytes("349b108ce08584f824bda3fb0327682baeef9296a469c008b8b7b49e")
        },
        {
          text: "NIST SHA-3 KAT Len=512 - 64 bytes, exactly the block size, forcing an all-padding block",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("e926ae8b0af6e53176dbffcc2a6b88c6bd765f939d3d178a9bde9ef3aa131c61e31c1e42cdfaf4b4dcde579a37e150efbef5555b4c1cb40439d835a724e2fae7"),
          expected: OpCodes.Hex8ToBytes("1f53cf00d91cef8e082f4f2e842603e1d6ed51109d577722150d227c")
        },
        {
          text: "NIST SHA-3 KAT Len=520 - 65 bytes, one over the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("16e8b3d8f988e9bb04de9c96f2627811c973ce4a5296b4772ca3eefeb80a652bdf21f50df79f32db23f9f73d393b2d57d9a0297f7a2f2e79cfda39fa393df1ac00"),
          expected: OpCodes.Hex8ToBytes("895bd0aece88d04e020478b65e8537ef42201d2edc78c247add4b7cf")
        },
        {
          text: "NIST SHA-3 KAT Len=1016 - 127 bytes, one under two blocks",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("a62fc595b4096e6336e53fcdfc8d1cc175d71dac9d750a6133d23199eaac288207944cea6b16d27631915b4619f743da2e30a0c00bbdb1bbb35ab852ef3b9aec6b0a8dcc6e9e1abaa3ad62ac0a6c5de765de2c3711b769e3fde44a74016fff82ac46fa8f1797d3b2a726b696e3dea5530439acee3a45c2a51bc32dd055650b"),
          expected: OpCodes.Hex8ToBytes("ad8966767488bd49c9d84d1a112e48e7baf243f0668ac6bca3c15df5")
        },
        {
          text: "NIST SHA-3 KAT Len=1024 - 128 bytes, an exact multiple of the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("2b6db7ced8665ebe9deb080295218426bdaa7c6da9add2088932cdffbaa1c14129bccdd70f369efb149285858d2b1d155d14de2fdb680a8b027284055182a0cae275234cc9c92863c1b4ab66f304cf0621cd54565f5bff461d3b461bd40df28198e3732501b4860eadd503d26d6e69338f4e0456e9e9baf3d827ae685fb1d817"),
          expected: OpCodes.Hex8ToBytes("7868d08191da62938d904835ef709310617d51d5d59cfaa63b2ec5a3")
        }
      ];
    }
  }

  class Shabal256 extends ShabalAlgorithmBase {
    constructor() {
      super(256, 32);
      this.tests = [
        {
          text: "NIST SHA-3 KAT Len=0 - empty message",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: [],
          expected: OpCodes.Hex8ToBytes("aec750d11feee9f16271922fbaf5a9be142f62019ef8d720f858940070889014")
        },
        {
          text: "NIST SHA-3 KAT Len=8 - one byte",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("cc"),
          expected: OpCodes.Hex8ToBytes("f52e6a62fa8a0e0fcdea5e12800c3b4301a0bf8b0f897bbe7685cdc659fdd3f8")
        },
        {
          text: "NIST SHA-3 KAT Len=504 - 63 bytes, one under the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("f57c64006d9ea761892e145c99df1b24640883da79d9ed5262859dcda8c3c32e05b03d984f1ab4a230242ab6b78d368dc5aaa1e6d3498d53371e84b0c1d4ba"),
          expected: OpCodes.Hex8ToBytes("cc91d63fda30dcaa3efb6e580ef74fe5f343897234af3b5902462764fe2a905a")
        },
        {
          text: "NIST SHA-3 KAT Len=512 - 64 bytes, exactly the block size, forcing an all-padding block",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("e926ae8b0af6e53176dbffcc2a6b88c6bd765f939d3d178a9bde9ef3aa131c61e31c1e42cdfaf4b4dcde579a37e150efbef5555b4c1cb40439d835a724e2fae7"),
          expected: OpCodes.Hex8ToBytes("1303d2ba5fbaf789c0ed488b07b6a542371780231204ab72398a106a7355e3af")
        },
        {
          text: "NIST SHA-3 KAT Len=520 - 65 bytes, one over the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("16e8b3d8f988e9bb04de9c96f2627811c973ce4a5296b4772ca3eefeb80a652bdf21f50df79f32db23f9f73d393b2d57d9a0297f7a2f2e79cfda39fa393df1ac00"),
          expected: OpCodes.Hex8ToBytes("596d27ef127e129d77b27a26b3a6bbe661cfe4ec11e98a028accbc2fa0435b99")
        },
        {
          text: "NIST SHA-3 KAT Len=1016 - 127 bytes, one under two blocks",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("a62fc595b4096e6336e53fcdfc8d1cc175d71dac9d750a6133d23199eaac288207944cea6b16d27631915b4619f743da2e30a0c00bbdb1bbb35ab852ef3b9aec6b0a8dcc6e9e1abaa3ad62ac0a6c5de765de2c3711b769e3fde44a74016fff82ac46fa8f1797d3b2a726b696e3dea5530439acee3a45c2a51bc32dd055650b"),
          expected: OpCodes.Hex8ToBytes("6eea046c1a389cc93f1cdb783c9da0ac4a38c8f65abe51cca7eec23571b49897")
        },
        {
          text: "NIST SHA-3 KAT Len=1024 - 128 bytes, an exact multiple of the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("2b6db7ced8665ebe9deb080295218426bdaa7c6da9add2088932cdffbaa1c14129bccdd70f369efb149285858d2b1d155d14de2fdb680a8b027284055182a0cae275234cc9c92863c1b4ab66f304cf0621cd54565f5bff461d3b461bd40df28198e3732501b4860eadd503d26d6e69338f4e0456e9e9baf3d827ae685fb1d817"),
          expected: OpCodes.Hex8ToBytes("ddc4eebe6d8ba774e2bb53130bf0447b0158ba0475a13e1d35dd09c740cf00ca")
        }
      ];
    }
  }

  class Shabal384 extends ShabalAlgorithmBase {
    constructor() {
      super(384, 48);
      this.tests = [
        {
          text: "NIST SHA-3 KAT Len=0 - empty message",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: [],
          expected: OpCodes.Hex8ToBytes("ff093d67d22b06a674b5f384719150d617e0ff9c8923569a2ab60cda886df63c91a25f33cd71cc22c9eebc5cd6aee52a")
        },
        {
          text: "NIST SHA-3 KAT Len=8 - one byte",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("cc"),
          expected: OpCodes.Hex8ToBytes("da6e116f4fc2740abb1308089251582e516c1b0da5e56492126e3aa8fe4be1a9ce5d58514cf32a5c1bd9211b535acfb5")
        },
        {
          text: "NIST SHA-3 KAT Len=504 - 63 bytes, one under the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("f57c64006d9ea761892e145c99df1b24640883da79d9ed5262859dcda8c3c32e05b03d984f1ab4a230242ab6b78d368dc5aaa1e6d3498d53371e84b0c1d4ba"),
          expected: OpCodes.Hex8ToBytes("5d08a206824624183efe7d76e127b6d3b126ce879de7c286235b7bf875b27665358741dd61afdbbb333cf4bfcad9f89e")
        },
        {
          text: "NIST SHA-3 KAT Len=512 - 64 bytes, exactly the block size, forcing an all-padding block",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("e926ae8b0af6e53176dbffcc2a6b88c6bd765f939d3d178a9bde9ef3aa131c61e31c1e42cdfaf4b4dcde579a37e150efbef5555b4c1cb40439d835a724e2fae7"),
          expected: OpCodes.Hex8ToBytes("166c63e8bbe2af4310ab59b8707f82a0e9c3947a434bfd409db486e25d33c9894ee0d232a078a5280182fc75d67bc9b1")
        },
        {
          text: "NIST SHA-3 KAT Len=520 - 65 bytes, one over the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("16e8b3d8f988e9bb04de9c96f2627811c973ce4a5296b4772ca3eefeb80a652bdf21f50df79f32db23f9f73d393b2d57d9a0297f7a2f2e79cfda39fa393df1ac00"),
          expected: OpCodes.Hex8ToBytes("33d1a460b27ed08d9fe19a35bb60df4b7a239ce26a66e7f0ddb6b358fde925b25bb5adf0307fc4324b4286221b1bf965")
        },
        {
          text: "NIST SHA-3 KAT Len=1016 - 127 bytes, one under two blocks",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("a62fc595b4096e6336e53fcdfc8d1cc175d71dac9d750a6133d23199eaac288207944cea6b16d27631915b4619f743da2e30a0c00bbdb1bbb35ab852ef3b9aec6b0a8dcc6e9e1abaa3ad62ac0a6c5de765de2c3711b769e3fde44a74016fff82ac46fa8f1797d3b2a726b696e3dea5530439acee3a45c2a51bc32dd055650b"),
          expected: OpCodes.Hex8ToBytes("070dc6a175ef1fe6fe6bc8187371890ecbdeaca2c747ea5cba48535ea00786652b6db1cf14fdb7b4917f8b6d45cf4220")
        },
        {
          text: "NIST SHA-3 KAT Len=1024 - 128 bytes, an exact multiple of the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("2b6db7ced8665ebe9deb080295218426bdaa7c6da9add2088932cdffbaa1c14129bccdd70f369efb149285858d2b1d155d14de2fdb680a8b027284055182a0cae275234cc9c92863c1b4ab66f304cf0621cd54565f5bff461d3b461bd40df28198e3732501b4860eadd503d26d6e69338f4e0456e9e9baf3d827ae685fb1d817"),
          expected: OpCodes.Hex8ToBytes("03a37aa2fdf6c8bb11c3e760ec3fe533ef72807c39fd6e83c73669f44ec70bea67fdbaba02fad35c43a9e067b1794138")
        }
      ];
    }
  }

  class Shabal512 extends ShabalAlgorithmBase {
    constructor() {
      super(512, 64);
      this.tests = [
        {
          text: "NIST SHA-3 KAT Len=0 - empty message",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: [],
          expected: OpCodes.Hex8ToBytes("fc2d5dff5d70b7f6b1f8c2fcc8c1f9fe9934e54257eded0cf2b539a2ef0a19ccffa84f8d9fa135e4bd3c09f590f3a927ebd603ac29eb729e6f2a9af031ad8dc6")
        },
        {
          text: "NIST SHA-3 KAT Len=8 - one byte",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("cc"),
          expected: OpCodes.Hex8ToBytes("da2621ac83fa9ed23e2fd977cdba8906492e7c9405940974a4017c61a9615bb32a3ec0ff89937b58395168b012175973dea0def7b4412c4c1ed80e5b2d9a6ad0")
        },
        {
          text: "NIST SHA-3 KAT Len=504 - 63 bytes, one under the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("f57c64006d9ea761892e145c99df1b24640883da79d9ed5262859dcda8c3c32e05b03d984f1ab4a230242ab6b78d368dc5aaa1e6d3498d53371e84b0c1d4ba"),
          expected: OpCodes.Hex8ToBytes("73981b87c3038e99d2c863729315aea3d0294904a6d6f0e4c3c2a28d2a503ed835b68f2f4407c99205fa08b2d6067633abc03cfa921dc61b55f9d1671cbe3257")
        },
        {
          text: "NIST SHA-3 KAT Len=512 - 64 bytes, exactly the block size, forcing an all-padding block",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("e926ae8b0af6e53176dbffcc2a6b88c6bd765f939d3d178a9bde9ef3aa131c61e31c1e42cdfaf4b4dcde579a37e150efbef5555b4c1cb40439d835a724e2fae7"),
          expected: OpCodes.Hex8ToBytes("ec6dbea0c9817a4a29b91e55358da61a9bf6938d5464190f82e48d1c8adc5cdeee3f0b3c6d37ee097db55a725c20282d3b6ddfbc00c57bd8f375536dfdfba36c")
        },
        {
          text: "NIST SHA-3 KAT Len=520 - 65 bytes, one over the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("16e8b3d8f988e9bb04de9c96f2627811c973ce4a5296b4772ca3eefeb80a652bdf21f50df79f32db23f9f73d393b2d57d9a0297f7a2f2e79cfda39fa393df1ac00"),
          expected: OpCodes.Hex8ToBytes("0e7ef0baa779ca25aec58208794c881b2a6a6d1d9d428e77230ef3d810bd6d26c0fc903ca69a76879e42b9a2f7fd6dd8bd24ea9ad3494cab4c91e68d557b559d")
        },
        {
          text: "NIST SHA-3 KAT Len=1016 - 127 bytes, one under two blocks",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("a62fc595b4096e6336e53fcdfc8d1cc175d71dac9d750a6133d23199eaac288207944cea6b16d27631915b4619f743da2e30a0c00bbdb1bbb35ab852ef3b9aec6b0a8dcc6e9e1abaa3ad62ac0a6c5de765de2c3711b769e3fde44a74016fff82ac46fa8f1797d3b2a726b696e3dea5530439acee3a45c2a51bc32dd055650b"),
          expected: OpCodes.Hex8ToBytes("426f43d642d488abe1b8df01a3360f2502cef215ef054627a36866f288a4d3eb6f8f6a235247570a8ed4d33dd0419d8f468c8f424e72ae9faa0be929e7824f78")
        },
        {
          text: "NIST SHA-3 KAT Len=1024 - 128 bytes, an exact multiple of the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_shabal.c",
          input: OpCodes.Hex8ToBytes("2b6db7ced8665ebe9deb080295218426bdaa7c6da9add2088932cdffbaa1c14129bccdd70f369efb149285858d2b1d155d14de2fdb680a8b027284055182a0cae275234cc9c92863c1b4ab66f304cf0621cd54565f5bff461d3b461bd40df28198e3732501b4860eadd503d26d6e69338f4e0456e9e9baf3d827ae685fb1d817"),
          expected: OpCodes.Hex8ToBytes("523d5356af034b0539cdb3f79345167224a4869d19d57ba5f7b5bfecf5b6a4e6b4a88dd2ace88e692c30610ed80753f34baf67ca5bf2698d711b95b77dea58f0")
        }
      ];
    }
  }

  // ===== REGISTRATION =====

  for (const Variant of [Shabal192, Shabal224, Shabal256, Shabal384, Shabal512]) {
    const algorithmInstance = new Variant();
    if (!AlgorithmFramework.Find(algorithmInstance.name)) {
      RegisterAlgorithm(algorithmInstance);
    }
  }

  // ===== EXPORTS =====

  return { ShabalCore, ShabalAlgorithmBase, ShabalAlgorithmInstance, Shabal192, Shabal224, Shabal256, Shabal384, Shabal512 };
}));
