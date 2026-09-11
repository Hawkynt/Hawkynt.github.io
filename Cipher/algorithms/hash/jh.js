/*
 * JH Hash Function - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * JH was designed by Hongjun Wu and was one of the five finalists of the NIST
 * SHA-3 competition. This implements the round-three version of January 2011,
 * in which the permutation E8 was raised from 35.5 to 42 rounds.
 *
 * The 1024-bit state is regrouped into 256 four-bit elements. Each round sends
 * every element through one of two published S-boxes, chosen element by element
 * by the bits of a 256-bit round constant; pairs of elements are then mixed by
 * a maximum distance separable code over GF(2^4); and the elements are finally
 * permuted. The round constants are not tabulated: the first is the fractional
 * part of the square root of two and each later one is produced from its
 * predecessor by the same round applied to a 64-element state, so the whole
 * schedule follows from one published value.
 *
 * The four digest sizes share this construction and differ only in the initial
 * state, which is the digest size in bits compressed with an all-zero block,
 * and in how many trailing bytes of the state form the digest.
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

  const BLOCK_SIZE = 64;    // 512 bits
  const STATE_BYTES = 128;  // 1024 bits
  const ELEMENTS = 256;     // four-bit elements in the grouped state
  const ROUNDS = 42;
  const NIBBLE = 0x0F;

  // The two published four-bit S-boxes; a round constant bit picks between them
  const SBOX = Object.freeze([
    Object.freeze([9, 0, 4, 11, 13, 12, 3, 15, 1, 10, 2, 6, 7, 5, 8, 14]),
    Object.freeze([3, 12, 6, 13, 5, 7, 1, 9, 15, 2, 0, 4, 11, 10, 14, 8])
  ]);

  // Round constant of the first round: the fractional part of the square root
  // of two, 6a09e667f3bcc908b2fb1366ea957d3e3adec17512775099da2f590b0667322a,
  // written as 64 four-bit elements.
  const ROUND_CONSTANT_ZERO = Object.freeze([
    0x6, 0xa, 0x0, 0x9, 0xe, 0x6, 0x6, 0x7, 0xf, 0x3, 0xb, 0xc, 0xc, 0x9, 0x0, 0x8,
    0xb, 0x2, 0xf, 0xb, 0x1, 0x3, 0x6, 0x6, 0xe, 0xa, 0x9, 0x5, 0x7, 0xd, 0x3, 0xe,
    0x3, 0xa, 0xd, 0xe, 0xc, 0x1, 0x7, 0x5, 0x1, 0x2, 0x7, 0x7, 0x5, 0x0, 0x9, 0x9,
    0xd, 0xa, 0x2, 0xf, 0x5, 0x9, 0x0, 0xb, 0x0, 0x6, 0x6, 0x7, 0x3, 0x2, 0x2, 0xa
  ]);

  // ===== GF(2^4) AND THE ROUND =====

  /**
   * Multiplication by two in GF(2^4) modulo x^4 + x + 1.
   * @param {int} x - a four-bit element
   * @returns {int} 2x
   */
  function Double(x) {
    const shifted = OpCodes.Shl32(x, 1);
    const overflow = OpCodes.Xor32(OpCodes.Shr32(x, 3), OpCodes.And32(OpCodes.Shr32(x, 2), 2));
    return OpCodes.And32(OpCodes.Xor32(shifted, overflow), NIBBLE);
  }

  /**
   * The linear layer, a maximum distance separable code applied to one pair of
   * four-bit elements in place.
   * @param {int[]} elements
   * @param {int} at - index of the first element of the pair
   */
  function MixPair(elements, at) {
    let a = elements[at];
    let b = elements[at + 1];
    b = OpCodes.Xor32(b, Double(a));
    a = OpCodes.Xor32(a, Double(b));
    elements[at] = a;
    elements[at + 1] = b;
  }

  /**
   * One round: substitute, mix and permute.
   *
   * The same round shape serves both the 256-element permutation E8 and the
   * 64-element one that generates the round constants; only the length and the
   * S-box selection differ, which is why there is one function and not two.
   *
   * @param {int[]} elements - the state, an even number of four-bit elements
   * @param {int[]|null} selector - one S-box index per element, or null to use
   *        S-box 0 throughout, which is how the constants are generated
   * @returns {int[]} the new state
   */
  function Round(elements, selector) {
    const count = elements.length;
    const half = count / 2;
    const mixed = new Array(count);

    for (let i = 0; i < count; i++) mixed[i] = SBOX[selector === null ? 0 : selector[i]][elements[i]];
    for (let i = 0; i < count; i += 2) MixPair(mixed, i);

    // Initial swap of the permutation layer
    for (let i = 0; i < count; i += 4) {
      const held = mixed[i + 2];
      mixed[i + 2] = mixed[i + 3];
      mixed[i + 3] = held;
    }

    // The permutation proper: even positions to the front, odd to the back
    const out = new Array(count);
    for (let i = 0; i < half; i++) {
      out[i] = mixed[i * 2];
      out[i + half] = mixed[i * 2 + 1];
    }

    // Final swap, over the back half only
    for (let i = half; i < count; i += 2) {
      const held = out[i];
      out[i] = out[i + 1];
      out[i + 1] = held;
    }

    return out;
  }

  /**
   * The S-box selection for every round, derived once from the published first
   * round constant. Round r + 1 is round r put through the 64-element round.
   */
  const ROUND_SELECTORS = Object.freeze((function () {
    const all = new Array(ROUNDS);
    let constant = ROUND_CONSTANT_ZERO.slice();
    for (let r = 0; r < ROUNDS; r++) {
      const selector = new Array(ELEMENTS);
      for (let i = 0; i < ELEMENTS; i++)
        selector[i] = OpCodes.And32(OpCodes.Shr32(constant[Math.floor(i / 4)], 3 - (i % 4)), 1);
      all[r] = Object.freeze(selector);
      constant = Round(constant, null);
    }
    return all;
  })());

  // ===== THE PERMUTATION E8 AND THE COMPRESSION FUNCTION F8 =====

  /**
   * Read bit i of a big-endian bit string held in a byte array.
   * @param {uint8[]} bytes
   * @param {int} index - bit index, counting from the first bit of byte 0
   * @returns {int} 0 or 1
   */
  function BitAt(bytes, index) {
    return OpCodes.And32(OpCodes.Shr32(bytes[Math.floor(index / 8)], 7 - (index % 8)), 1);
  }

  /**
   * E8, the 42-round bijection, applied to the 1024-bit state in place.
   *
   * The state is first regrouped: element i takes bits i, i + 256, i + 512 and
   * i + 768 of the state as its four bits, and the first and second halves of
   * that element list are then interleaved. The last step undoes both.
   *
   * @param {uint8[]} state - 128 bytes, modified in place
   */
  function Permute(state) {
    const grouped = new Array(ELEMENTS);
    for (let i = 0; i < ELEMENTS; i++) {
      const b0 = BitAt(state, i);
      const b1 = BitAt(state, i + 256);
      const b2 = BitAt(state, i + 512);
      const b3 = BitAt(state, i + 768);
      grouped[i] = OpCodes.Or32(
        OpCodes.Or32(OpCodes.Shl32(b0, 3), OpCodes.Shl32(b1, 2)),
        OpCodes.Or32(OpCodes.Shl32(b2, 1), b3)
      );
    }

    let elements = new Array(ELEMENTS);
    for (let i = 0; i < 128; i++) {
      elements[i * 2] = grouped[i];
      elements[i * 2 + 1] = grouped[i + 128];
    }

    for (let r = 0; r < ROUNDS; r++) elements = Round(elements, ROUND_SELECTORS[r]);

    const ungrouped = new Array(ELEMENTS);
    for (let i = 0; i < 128; i++) {
      ungrouped[i] = elements[i * 2];
      ungrouped[i + 128] = elements[i * 2 + 1];
    }

    for (let i = 0; i < STATE_BYTES; i++) state[i] = 0;
    for (let i = 0; i < ELEMENTS; i++) {
      const element = ungrouped[i];
      const shift = 7 - (i % 8);
      const at = Math.floor(i / 8);
      state[at] = OpCodes.Or32(state[at], OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(element, 3), 1), shift));
      state[at + 32] = OpCodes.Or32(state[at + 32], OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(element, 2), 1), shift));
      state[at + 64] = OpCodes.Or32(state[at + 64], OpCodes.Shl32(OpCodes.And32(OpCodes.Shr32(element, 1), 1), shift));
      state[at + 96] = OpCodes.Or32(state[at + 96], OpCodes.Shl32(OpCodes.And32(element, 1), shift));
    }
  }

  /**
   * F8: fold the block into the first half of the state, permute, fold it into
   * the second half.
   * @param {uint8[]} state - 128 bytes, modified in place
   * @param {uint8[]} block - 64 bytes
   */
  function Compress(state, block) {
    for (let i = 0; i < BLOCK_SIZE; i++) state[i] = OpCodes.Xor32(state[i], OpCodes.ToByte(block[i]));
    Permute(state);
    for (let i = 0; i < BLOCK_SIZE; i++) state[i + BLOCK_SIZE] = OpCodes.Xor32(state[i + BLOCK_SIZE], OpCodes.ToByte(block[i]));
  }

  /**
   * The initial state for a digest size: the size in bits occupies the first
   * two bytes of an otherwise empty state, which is then compressed with an
   * all-zero block. Computing it costs one E8, so each size is worked out once
   * and kept.
   */
  const INITIAL_STATES = new Map();

  /**
   * @param {int} digestBits - 224, 256, 384 or 512
   * @returns {uint8[]} a fresh copy of the initial 128-byte state
   */
  function InitialState(digestBits) {
    let cached = INITIAL_STATES.get(digestBits);
    if (!cached) {
      cached = new Array(STATE_BYTES).fill(0);
      cached[0] = OpCodes.ToByte(OpCodes.Shr32(digestBits, 8));
      cached[1] = OpCodes.ToByte(digestBits);
      Compress(cached, new Array(BLOCK_SIZE).fill(0));
      INITIAL_STATES.set(digestBits, cached);
    }
    return cached.slice();
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * JHAlgorithmBase - shared metadata for every JH digest size
   * @class
   * @extends {HashFunctionAlgorithm}
   */
  class JHAlgorithmBase extends HashFunctionAlgorithm {
    /**
     * @param {int} digestBits - 224, 256, 384 or 512
     */
    constructor(digestBits) {
      super();

      this.digestBits = digestBits;
      const digestSize = digestBits / 8;

      this.name = "JH-" + digestBits;
      this.description = "JH is a SHA-3 finalist designed by Hongjun Wu. A 1024-bit state is regrouped into 256 four-bit elements and driven through 42 rounds of S-box substitution, a maximum distance separable mixing layer and a permutation. This is the " + digestBits + "-bit variant of the round-three design.";
      this.inventor = "Hongjun Wu";
      this.year = 2011;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-3 Candidate";
      this.securityStatus = null;
      this.complexity = ComplexityType.HIGH;
      this.country = CountryCode.CN;

      this.SupportedOutputSizes = [digestSize];
      this.SupportedHashSizes = [new KeySize(digestSize, digestSize, 1)];
      this.BlockSize = BLOCK_SIZE;
      this.blockSize = BLOCK_SIZE;
      this.outputSize = digestSize;

      this.documentation = [
        new LinkItem("The Hash Function JH, round 3 specification", "https://www3.ntu.edu.sg/home/wuhj/research/jh/jh_round3.pdf"),
        new LinkItem("JH home page", "https://www3.ntu.edu.sg/home/wuhj/research/jh/"),
        new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project")
      ];

      this.references = [
        new LinkItem("JH reference implementation", "https://www3.ntu.edu.sg/home/wuhj/research/jh/jh_ref.h"),
        new LinkItem("sphlib known-answer vectors", "https://github.com/pornin/sphlib/blob/master/c/test_jh.c"),
        new LinkItem("Wikipedia: JH", "https://en.wikipedia.org/wiki/JH_(hash_function)")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Preimage attacks on reduced rounds", "Preimage and semi-free-start results exist against JH cut down to a fraction of its 42 rounds. The full function has no published break, but SHA-3 went to Keccak instead.")
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
      return new JHAlgorithmInstance(this, this.digestBits);
    }
  }

  /**
   * JH hash instance implementing the Feed/Result pattern
   * @class
   * @extends {IHashFunctionInstance}
   */
  class JHAlgorithmInstance extends IHashFunctionInstance {
    /**
     * @param {Object} algorithm - parent algorithm
     * @param {int} digestBits - 224, 256, 384 or 512
     */
    constructor(algorithm, digestBits) {
      super(algorithm);
      this.digestBits = digestBits;
      this.OutputSize = digestBits / 8;
      this._state = InitialState(digestBits);
      this._absorber = new BlockAbsorber(BLOCK_SIZE, block => Compress(this._state, block));
    }

    /**
     * Feed data to the hash. Successive calls extend the message.
     * @param {uint8[]} data - Input data bytes
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data) && !ArrayBuffer.isView(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      this._absorber.Absorb(Array.from(data));
    }

    /**
     * Finish the message and return the digest.
     * @returns {uint8[]} the trailing digestBits/8 bytes of the state
     */
    Result() {
      // Result() stays repeatable: Finish hands out a copy of the held bytes
      // without advancing the absorber, so the state is snapshotted and put
      // back once the digest has been read.
      const saved = this._state;
      this._state = this._state.slice();

      this._absorber.Finish((held, pending, total) => {
        let rest = held;
        let count = pending;

        // A held block that is already full is an ordinary block; the absorber
        // only kept it back in case more data followed.
        if (count === BLOCK_SIZE) {
          Compress(this._state, held);
          rest = [];
          count = 0;
        }

        // The length field is 128 bits, big-endian, at the end of the final
        // block. Anything this code can be handed fits in the low 64.
        const lengthBlock = () => {
          const block = new Array(BLOCK_SIZE).fill(0);
          let bits = OpCodes.ShiftLn(BigInt(total), 3);
          for (let i = 0; i < 16; i++) {
            block[BLOCK_SIZE - 1 - i] = Number(OpCodes.AndN(bits, 0xFFn));
            bits = OpCodes.ShiftRn(bits, 8);
          }
          return block;
        };

        if (count === 0) {
          // The message ends on a block boundary, so the padding bit and the
          // length field share a single extra block.
          const block = lengthBlock();
          block[0] = 0x80;
          Compress(this._state, block);
        } else {
          const block = new Array(BLOCK_SIZE).fill(0);
          for (let i = 0; i < count; i++) block[i] = OpCodes.ToByte(rest[i]);
          block[count] = 0x80;
          Compress(this._state, block);
          Compress(this._state, lengthBlock());
        }
      });

      const digest = this._state.slice(STATE_BYTES - this.OutputSize, STATE_BYTES);
      this._state = saved;
      return digest;
    }
  }

  // ===== VARIANTS =====

  class JH224 extends JHAlgorithmBase {
    constructor() {
      super(224);
      this.tests = [
        {
          text: "NIST SHA-3 KAT Len=0 - empty message, one combined padding block",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: [],
          expected: OpCodes.Hex8ToBytes("2c99df889b019309051c60fecc2bd285a774940e43175b76b2626630")
        },
        {
          text: "NIST SHA-3 KAT Len=8 - one byte",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("cc"),
          expected: OpCodes.Hex8ToBytes("f79c791ac9b9d80ec934312d6b26748481198e3ca78ebb01b2c9ca51")
        },
        {
          text: "NIST SHA-3 KAT Len=504 - 63 bytes, one under the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("f57c64006d9ea761892e145c99df1b24640883da79d9ed5262859dcda8c3c32e05b03d984f1ab4a230242ab6b78d368dc5aaa1e6d3498d53371e84b0c1d4ba"),
          expected: OpCodes.Hex8ToBytes("2cb2a73729a62f69d9af8252189c1dce8c02286314db64ac6111e3d7")
        },
        {
          text: "NIST SHA-3 KAT Len=512 - 64 bytes, exactly the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("e926ae8b0af6e53176dbffcc2a6b88c6bd765f939d3d178a9bde9ef3aa131c61e31c1e42cdfaf4b4dcde579a37e150efbef5555b4c1cb40439d835a724e2fae7"),
          expected: OpCodes.Hex8ToBytes("982a5d2aa039f9c7d5cff3cc8a34c3a0b205892e7c5b09ed68f2cc84")
        },
        {
          text: "NIST SHA-3 KAT Len=520 - 65 bytes, one over the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("16e8b3d8f988e9bb04de9c96f2627811c973ce4a5296b4772ca3eefeb80a652bdf21f50df79f32db23f9f73d393b2d57d9a0297f7a2f2e79cfda39fa393df1ac00"),
          expected: OpCodes.Hex8ToBytes("b6261dd52e1bc8869aa8658a310a888840cc9433b46b3e959002b672")
        },
        {
          text: "NIST SHA-3 KAT Len=1016 - 127 bytes, one under two blocks",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("a62fc595b4096e6336e53fcdfc8d1cc175d71dac9d750a6133d23199eaac288207944cea6b16d27631915b4619f743da2e30a0c00bbdb1bbb35ab852ef3b9aec6b0a8dcc6e9e1abaa3ad62ac0a6c5de765de2c3711b769e3fde44a74016fff82ac46fa8f1797d3b2a726b696e3dea5530439acee3a45c2a51bc32dd055650b"),
          expected: OpCodes.Hex8ToBytes("99311ca7952d3970a3435f9d246ab4f6e720a27e5647b8cdbcc54c01")
        },
        {
          text: "NIST SHA-3 KAT Len=1024 - 128 bytes, an exact multiple of the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("2b6db7ced8665ebe9deb080295218426bdaa7c6da9add2088932cdffbaa1c14129bccdd70f369efb149285858d2b1d155d14de2fdb680a8b027284055182a0cae275234cc9c92863c1b4ab66f304cf0621cd54565f5bff461d3b461bd40df28198e3732501b4860eadd503d26d6e69338f4e0456e9e9baf3d827ae685fb1d817"),
          expected: OpCodes.Hex8ToBytes("5e3c00c2c0e126a2e6327aa30db4c3f66052c74cf10cac9c380f5d56")
        }
      ];
    }
  }

  class JH256 extends JHAlgorithmBase {
    constructor() {
      super(256);
      this.tests = [
        {
          text: "NIST SHA-3 KAT Len=0 - empty message, one combined padding block",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: [],
          expected: OpCodes.Hex8ToBytes("46e64619c18bb0a92a5e87185a47eef83ca747b8fcc8e1412921357e326df434")
        },
        {
          text: "NIST SHA-3 KAT Len=8 - one byte",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("cc"),
          expected: OpCodes.Hex8ToBytes("7b1191f13a2667830142541bfc5918543d2a434c7692e70c3e5e9bbdddb7f581")
        },
        {
          text: "NIST SHA-3 KAT Len=504 - 63 bytes, one under the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("f57c64006d9ea761892e145c99df1b24640883da79d9ed5262859dcda8c3c32e05b03d984f1ab4a230242ab6b78d368dc5aaa1e6d3498d53371e84b0c1d4ba"),
          expected: OpCodes.Hex8ToBytes("98f236f14420fa4d6d7187d429f446b28a82c359e7d0ff59d0efc983bb224ad9")
        },
        {
          text: "NIST SHA-3 KAT Len=512 - 64 bytes, exactly the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("e926ae8b0af6e53176dbffcc2a6b88c6bd765f939d3d178a9bde9ef3aa131c61e31c1e42cdfaf4b4dcde579a37e150efbef5555b4c1cb40439d835a724e2fae7"),
          expected: OpCodes.Hex8ToBytes("9d35c0cc1880a36ebb6cb33b732c0c2adb4a418b4bf0df9173b539263653e90b")
        },
        {
          text: "NIST SHA-3 KAT Len=520 - 65 bytes, one over the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("16e8b3d8f988e9bb04de9c96f2627811c973ce4a5296b4772ca3eefeb80a652bdf21f50df79f32db23f9f73d393b2d57d9a0297f7a2f2e79cfda39fa393df1ac00"),
          expected: OpCodes.Hex8ToBytes("334f80e3a32b128528267a1541821dda9ea69199ce506f6e88dcbf35ebb80f4e")
        },
        {
          text: "NIST SHA-3 KAT Len=1016 - 127 bytes, one under two blocks",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("a62fc595b4096e6336e53fcdfc8d1cc175d71dac9d750a6133d23199eaac288207944cea6b16d27631915b4619f743da2e30a0c00bbdb1bbb35ab852ef3b9aec6b0a8dcc6e9e1abaa3ad62ac0a6c5de765de2c3711b769e3fde44a74016fff82ac46fa8f1797d3b2a726b696e3dea5530439acee3a45c2a51bc32dd055650b"),
          expected: OpCodes.Hex8ToBytes("7ff3cf7b9a468cfb581a5bd21cc68ff0c3ef3fcfe2a63bd68e9b3934e0ffd488")
        },
        {
          text: "NIST SHA-3 KAT Len=1024 - 128 bytes, an exact multiple of the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("2b6db7ced8665ebe9deb080295218426bdaa7c6da9add2088932cdffbaa1c14129bccdd70f369efb149285858d2b1d155d14de2fdb680a8b027284055182a0cae275234cc9c92863c1b4ab66f304cf0621cd54565f5bff461d3b461bd40df28198e3732501b4860eadd503d26d6e69338f4e0456e9e9baf3d827ae685fb1d817"),
          expected: OpCodes.Hex8ToBytes("43b7d01d93213874b2ac0792bed8c137e865ba5fa87b20a3151a984f4af267a6")
        }
      ];
    }
  }

  class JH384 extends JHAlgorithmBase {
    constructor() {
      super(384);
      this.tests = [
        {
          text: "NIST SHA-3 KAT Len=0 - empty message, one combined padding block",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: [],
          expected: OpCodes.Hex8ToBytes("2fe5f71b1b3290d3c017fb3c1a4d02a5cbeb03a0476481e25082434a881994b0ff99e078d2c16b105ad069b569315328")
        },
        {
          text: "NIST SHA-3 KAT Len=8 - one byte",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("cc"),
          expected: OpCodes.Hex8ToBytes("ccfa3732089cb4d49af04daa865cb2376bfa264e527b5eb8486cd09b3fb9a8019140a1ca9df7539efbb3a3118d8e0584")
        },
        {
          text: "NIST SHA-3 KAT Len=504 - 63 bytes, one under the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("f57c64006d9ea761892e145c99df1b24640883da79d9ed5262859dcda8c3c32e05b03d984f1ab4a230242ab6b78d368dc5aaa1e6d3498d53371e84b0c1d4ba"),
          expected: OpCodes.Hex8ToBytes("93125f2f4036ac69f2bdd5be4b87c299fc535ae6422d61fed98b618eeeecd0f002a6a307e2b110de59eb2bfeb26e74f0")
        },
        {
          text: "NIST SHA-3 KAT Len=512 - 64 bytes, exactly the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("e926ae8b0af6e53176dbffcc2a6b88c6bd765f939d3d178a9bde9ef3aa131c61e31c1e42cdfaf4b4dcde579a37e150efbef5555b4c1cb40439d835a724e2fae7"),
          expected: OpCodes.Hex8ToBytes("b605535f1860879c2e7356c762967bc67d6f80a68a85194daf0057e3adf3baffd3b07ca1bf3bd6c4b76f3cafc901ce6b")
        },
        {
          text: "NIST SHA-3 KAT Len=520 - 65 bytes, one over the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("16e8b3d8f988e9bb04de9c96f2627811c973ce4a5296b4772ca3eefeb80a652bdf21f50df79f32db23f9f73d393b2d57d9a0297f7a2f2e79cfda39fa393df1ac00"),
          expected: OpCodes.Hex8ToBytes("bcbab04b2a71f872e7719311172da75b86cd2ebb5aafe19aa51b43f6c20ab2e7d1e1dccb67e3ccb88788e1ad75a00479")
        },
        {
          text: "NIST SHA-3 KAT Len=1016 - 127 bytes, one under two blocks",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("a62fc595b4096e6336e53fcdfc8d1cc175d71dac9d750a6133d23199eaac288207944cea6b16d27631915b4619f743da2e30a0c00bbdb1bbb35ab852ef3b9aec6b0a8dcc6e9e1abaa3ad62ac0a6c5de765de2c3711b769e3fde44a74016fff82ac46fa8f1797d3b2a726b696e3dea5530439acee3a45c2a51bc32dd055650b"),
          expected: OpCodes.Hex8ToBytes("37fbb48174496057ae36cfd2323f11aaea4aea2072e7692e23b435cefb9681c36d656b5ded64f44837661dc053de3454")
        },
        {
          text: "NIST SHA-3 KAT Len=1024 - 128 bytes, an exact multiple of the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("2b6db7ced8665ebe9deb080295218426bdaa7c6da9add2088932cdffbaa1c14129bccdd70f369efb149285858d2b1d155d14de2fdb680a8b027284055182a0cae275234cc9c92863c1b4ab66f304cf0621cd54565f5bff461d3b461bd40df28198e3732501b4860eadd503d26d6e69338f4e0456e9e9baf3d827ae685fb1d817"),
          expected: OpCodes.Hex8ToBytes("fef557b18a29160fd3bc78cc0cc66c5613b0f2d463c231bc23a03bdb15674197a293104d7a86544f8216d8066b84d8b5")
        }
      ];
    }
  }

  class JH512 extends JHAlgorithmBase {
    constructor() {
      super(512);
      this.tests = [
        {
          text: "NIST SHA-3 KAT Len=0 - empty message, one combined padding block",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: [],
          expected: OpCodes.Hex8ToBytes("90ecf2f76f9d2c8017d979ad5ab96b87d58fc8fc4b83060f3f900774faa2c8fabe69c5f4ff1ec2b61d6b316941cedee117fb04b1f4c5bc1b919ae841c50eec4f")
        },
        {
          text: "NIST SHA-3 KAT Len=8 - one byte",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("cc"),
          expected: OpCodes.Hex8ToBytes("277c93806945992a7f10102f28471af2783fe32003b3f63320810e74f1bc233bf8669ab4b922db9ef13fcdcd4d31193b731eedde98fc87c129c04a4a1071f66f")
        },
        {
          text: "NIST SHA-3 KAT Len=504 - 63 bytes, one under the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("f57c64006d9ea761892e145c99df1b24640883da79d9ed5262859dcda8c3c32e05b03d984f1ab4a230242ab6b78d368dc5aaa1e6d3498d53371e84b0c1d4ba"),
          expected: OpCodes.Hex8ToBytes("197514abfb2c85c94566b72beeb9b95f6a4fb2d19306579f1e64241c4751b3df09a04dc77d7cb19d38baba36d23d73438a7c92bcbace65fad3586f9b7621205a")
        },
        {
          text: "NIST SHA-3 KAT Len=512 - 64 bytes, exactly the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("e926ae8b0af6e53176dbffcc2a6b88c6bd765f939d3d178a9bde9ef3aa131c61e31c1e42cdfaf4b4dcde579a37e150efbef5555b4c1cb40439d835a724e2fae7"),
          expected: OpCodes.Hex8ToBytes("d1dbacb16c6a88bea992cd34f92d1375f05215037cf989e155d324d6d1e4204320cf18c1ad6bf11019cdd112bac3c7cb73e41a94254b8c5af3db8245318ffc70")
        },
        {
          text: "NIST SHA-3 KAT Len=520 - 65 bytes, one over the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("16e8b3d8f988e9bb04de9c96f2627811c973ce4a5296b4772ca3eefeb80a652bdf21f50df79f32db23f9f73d393b2d57d9a0297f7a2f2e79cfda39fa393df1ac00"),
          expected: OpCodes.Hex8ToBytes("726a9b558ee790de5f0f9b7f6a06c163c1f2352f2a5a61e4316e5a17174be886d9b0d0e194cc05eca1708e4e1f42749ac279ccf42d97a86b917141357bce8db3")
        },
        {
          text: "NIST SHA-3 KAT Len=1016 - 127 bytes, one under two blocks",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("a62fc595b4096e6336e53fcdfc8d1cc175d71dac9d750a6133d23199eaac288207944cea6b16d27631915b4619f743da2e30a0c00bbdb1bbb35ab852ef3b9aec6b0a8dcc6e9e1abaa3ad62ac0a6c5de765de2c3711b769e3fde44a74016fff82ac46fa8f1797d3b2a726b696e3dea5530439acee3a45c2a51bc32dd055650b"),
          expected: OpCodes.Hex8ToBytes("72c91078e9237b996f7ddc0936a4e69ba28c37fff2d11061601cf04915ff5dec31e530a3aefa09141fc9061b3baf2fb2ee7a841d5350b16dbe63ed50897fa2f7")
        },
        {
          text: "NIST SHA-3 KAT Len=1024 - 128 bytes, an exact multiple of the block size",
          uri: "https://github.com/pornin/sphlib/blob/master/c/test_jh.c",
          input: OpCodes.Hex8ToBytes("2b6db7ced8665ebe9deb080295218426bdaa7c6da9add2088932cdffbaa1c14129bccdd70f369efb149285858d2b1d155d14de2fdb680a8b027284055182a0cae275234cc9c92863c1b4ab66f304cf0621cd54565f5bff461d3b461bd40df28198e3732501b4860eadd503d26d6e69338f4e0456e9e9baf3d827ae685fb1d817"),
          expected: OpCodes.Hex8ToBytes("9ec6669f30f482a65d93fe7811923b6bdf3a1bde032502e0b1a064c9d893c03507576fc4fbc745d458c1402ba76f7d4c4539c4dfed7c058596fa270416865162")
        }
      ];
    }
  }

  // ===== REGISTRATION =====

  for (const Variant of [JH224, JH256, JH384, JH512]) {
    const algorithmInstance = new Variant();
    if (!AlgorithmFramework.Find(algorithmInstance.name)) {
      RegisterAlgorithm(algorithmInstance);
    }
  }

  // ===== EXPORTS =====

  return { JHAlgorithmBase, JHAlgorithmInstance, JH224, JH256, JH384, JH512 };
}));
