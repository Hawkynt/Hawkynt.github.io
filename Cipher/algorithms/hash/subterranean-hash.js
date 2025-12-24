/*
 * Subterranean-Hash Implementation
 * Compatible with both Browser and Node.js environments
 *
 * Subterranean is a lightweight cryptographic primitive designed by Joan Daemen
 * (co-designer of AES and SHA-3). It features a 257-bit state and provides
 * authenticated encryption and hashing functionality.
 *
 * This implementation follows the reference from the NIST Lightweight Cryptography
 * standardization process.
 *
 * Reference: https://cs.ru.nl/~joan/subterranean.html
 * NIST LWC Submission: https://csrc.nist.gov/Projects/lightweight-cryptography
 *
 * WARNING: This is an educational implementation. Use production-grade
 * cryptographic libraries for security-critical applications.
 */

(function(global) {
  'use strict';

  // Load AlgorithmFramework (REQUIRED)
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }

  // Load OpCodes for cryptographic operations (REQUIRED)
  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  /**
   * Subterranean-Hash Algorithm Class
   *
   * Produces a 256-bit (32-byte) hash digest using the Subterranean permutation.
   * The algorithm operates on a 257-bit internal state represented as nine 32-bit words.
   */
  class SubterraneanHash extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Subterranean-Hash";
      this.description = "Lightweight cryptographic hash function designed by Joan Daemen based on a 257-bit permutation. Finalist in NIST's Lightweight Cryptography standardization process offering efficient hashing for resource-constrained environments.";
      this.inventor = "Joan Daemen";
      this.year = 2017;
      this.category = CategoryType.HASH;
      this.subCategory = "Hash Function";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      // Algorithm capabilities - fixed 256-bit output
      this.SupportedOutputSizes = [new KeySize(32, 32, 1)];

      // Documentation with direct links
      this.documentation = [
        new LinkItem("Official Website", "https://cs.ru.nl/~joan/subterranean.html"),
        new LinkItem("NIST LWC Submission", "https://csrc.nist.gov/Projects/lightweight-cryptography/round-2-candidates"),
        new LinkItem("Specification (PDF)", "https://cs.ru.nl/~joan/papers/Subterranean-2.pdf")
      ];

      // Official test vectors from NIST LWC Known Answer Tests
      this.tests = [
        {
          text: "NIST LWC KAT - Empty message",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("4DE2B673C183D1031BBBA5FB63CC15270DAAFBBE1F77FA7FBEAF1D17CF694FEB")
        },
        {
          text: "NIST LWC KAT - Single zero byte",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("91E6735EB598B7FAD5EA99EEA59DC9524C1BDD1FF864108CB5011C28E6572AFB")
        },
        {
          text: "NIST LWC KAT - Two bytes (00 01)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("7E59E39B3ADDCE9632836D7EA47BBDF28B37566FF7307BA5F235737D8D71D908")
        },
        {
          text: "NIST LWC KAT - Three bytes (00 01 02)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102"),
          expected: OpCodes.Hex8ToBytes("5DC635642F27A2BFC259373E58894FB4220AAB502DC7E5D79B95A657C098F0D4")
        },
        {
          text: "NIST LWC KAT - Four bytes (00 01 02 03)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("B6F84FCC1C4CF0AF391136BAA0B9ECA326840E8602773354F3D4D63ECC711A48")
        },
        {
          text: "NIST LWC KAT - 16 bytes",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("E5DC937F458A9CF4064473E20C3F9AC0970ED71852AF636ADE8B48C5C1AF4717")
        }
      ];
    }

    /**
     * Creates an instance for hashing operations
     * @param {boolean} isInverse - Not applicable for hash functions (always false)
     * @returns {SubterraneanHashInstance|null} Hash instance or null if inverse requested
     */
    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Hash functions have no inverse
      return new SubterraneanHashInstance(this);
    }
  }

  /**
   * Subterranean-Hash Instance Class
   *
   * Implements the Feed/Result pattern for incremental hashing.
   * The 257-bit state is represented as nine 32-bit words (x[0] to x[8]),
   * where x[8] contains only the 257th bit.
   */
  class SubterraneanHashInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // 257-bit state: nine 32-bit words (x[8] holds only 1 bit)
      this.state = new Array(9).fill(0);

      // Input buffer for accumulating data
      this.inputBuffer = [];
    }

    /**
     * Feed data into the hash function
     * @param {Array<number>} data - Byte array to hash
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
     * Compute and return the final hash digest
     * @returns {Array<number>} 256-bit (32-byte) hash digest
     */
    Result() {
      // Process each input byte with the duplex construction
      for (let i = 0; i < this.inputBuffer.length; ++i) {
        this._duplexByte(this.inputBuffer[i]);
        this._duplexZero();
      }

      // Final padding: two more duplex operations with zero bytes
      this._duplexZero();
      this._duplexZero();

      // Blank operation: 8 rounds without data
      this._blank();

      // Squeeze out 32 bytes of output
      const output = this._squeeze(32);

      // Reset state for next use
      this.state = new Array(9).fill(0);
      this.inputBuffer = [];

      return output;
    }

    /**
     * Performs the Subterranean round function
     * Implements chi, iota, theta, and pi transformations on the 257-bit state
     * @private
     */
    _round() {
      let x0 = this.state[0];
      let x1 = this.state[1];
      let x2 = this.state[2];
      let x3 = this.state[3];
      let x4 = this.state[4];
      let x5 = this.state[5];
      let x6 = this.state[6];
      let x7 = this.state[7];
      let x8 = this.state[8];

      // Step chi: s[i] = s[i] ^ (~(s[i+1])&s[i+2])
      // Apply chi transformation with bit shifts across word boundaries
      const chi = (a, b) => {
        const t0 = OpCodes.Or32(OpCodes.Shr32(a, 1), OpCodes.Shl32(b, 31));
        const t1 = OpCodes.Or32(OpCodes.Shr32(a, 2), OpCodes.Shl32(b, 30));
        return OpCodes.Xor32(a, OpCodes.And32(OpCodes.Not32(t0), t1));
      };

      x8 = OpCodes.Xor32(x8, OpCodes.Shl32(x0, 1));
      x0 = chi(x0, x1);
      x1 = chi(x1, x2);
      x2 = chi(x2, x3);
      x3 = chi(x3, x4);
      x4 = chi(x4, x5);
      x5 = chi(x5, x6);
      x6 = chi(x6, x7);
      x7 = chi(x7, x8);
      x8 = OpCodes.Xor32(x8, OpCodes.And32(OpCodes.Not32(OpCodes.Shr32(x8, 1)), OpCodes.Shr32(x8, 2)));

      // Step iota: invert s[0]
      x0 = OpCodes.Xor32(x0, 1);

      // Step theta: s[i] = s[i] ^ s[i+3] ^ s[i+8]
      const theta = (a, b) => {
        const t0 = OpCodes.Or32(OpCodes.Shr32(a, 3), OpCodes.Shl32(b, 29));
        const t1 = OpCodes.Or32(OpCodes.Shr32(a, 8), OpCodes.Shl32(b, 24));
        return OpCodes.Xor32(OpCodes.Xor32(a, t0), t1);
      };

      x8 = OpCodes.Xor32(OpCodes.And32(x8, 1), OpCodes.Shl32(x0, 1));
      x0 = theta(x0, x1);
      x1 = theta(x1, x2);
      x2 = theta(x2, x3);
      x3 = theta(x3, x4);
      x4 = theta(x4, x5);
      x5 = theta(x5, x6);
      x6 = theta(x6, x7);
      x7 = theta(x7, x8);
      x8 = OpCodes.Xor32(OpCodes.Xor32(x8, OpCodes.Shr32(x8, 3)), OpCodes.Shr32(x8, 8));

      // Step pi: permute bits with rule s[i] = s[(i * 12) % 257]
      // This is the most complex step - each output bit comes from a specific input bit
      // BCP = bit copy, BUP = move bit up, BDN = move bit down
      const BCP = (x, bit) => OpCodes.And32(x, OpCodes.Shl32(1, bit));
      const BUP = (x, from, to) => OpCodes.And32(OpCodes.Shl32(x, (to - from)), OpCodes.Shl32(1, to));
      const BDN = (x, from, to) => OpCodes.And32(OpCodes.Shr32(x, (from - to)), OpCodes.Shl32(1, to));

      // Compute new state values with pi permutation
      this.state[0] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       BCP(x0,  0), BDN(x0, 12,  1)), BDN(x0, 24,  2)),
                       BDN(x1,  4,  3)), BDN(x1, 16,  4)), BDN(x1, 28,  5)),
                       BDN(x2,  8,  6)), BDN(x2, 20,  7)), BUP(x3,  0,  8)),
                       BDN(x3, 12,  9)), BDN(x3, 24, 10)), BUP(x4,  4, 11)),
                       BDN(x4, 16, 12)), BDN(x4, 28, 13)), BUP(x5,  8, 14)),
                       BDN(x5, 20, 15)), BUP(x6,  0, 16)), BUP(x6, 12, 17)),
                       BDN(x6, 24, 18)), BUP(x7,  4, 19)), BUP(x7, 16, 20)),
                       BDN(x7, 28, 21)), BUP(x0,  7, 22)), BUP(x0, 19, 23)),
                       BDN(x0, 31, 24)), BUP(x1, 11, 25)), BUP(x1, 23, 26)),
                       BUP(x2,  3, 27)), BUP(x2, 15, 28)), BUP(x2, 27, 29)),
                       BUP(x3,  7, 30)), BUP(x3, 19, 31));

      this.state[1] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       BDN(x3, 31,  0), BDN(x4, 11,  1)), BDN(x4, 23,  2)),
                       BCP(x5,  3)), BDN(x5, 15,  4)), BDN(x5, 27,  5)),
                       BDN(x6,  7,  6)), BDN(x6, 19,  7)), BDN(x6, 31,  8)),
                       BDN(x7, 11,  9)), BDN(x7, 23, 10)), BUP(x0,  2, 11)),
                       BDN(x0, 14, 12)), BDN(x0, 26, 13)), BUP(x1,  6, 14)),
                       BDN(x1, 18, 15)), BDN(x1, 30, 16)), BUP(x2, 10, 17)),
                       BDN(x2, 22, 18)), BUP(x3,  2, 19)), BUP(x3, 14, 20)),
                       BDN(x3, 26, 21)), BUP(x4,  6, 22)), BUP(x4, 18, 23)),
                       BDN(x4, 30, 24)), BUP(x5, 10, 25)), BUP(x5, 22, 26)),
                       BUP(x6,  2, 27)), BUP(x6, 14, 28)), BUP(x6, 26, 29)),
                       BUP(x7,  6, 30)), BUP(x7, 18, 31));

      this.state[2] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       BDN(x7, 30,  0), BDN(x0,  9,  1)), BDN(x0, 21,  2)),
                       BUP(x1,  1,  3)), BDN(x1, 13,  4)), BDN(x1, 25,  5)),
                       BUP(x2,  5,  6)), BDN(x2, 17,  7)), BDN(x2, 29,  8)),
                       BCP(x3,  9)), BDN(x3, 21, 10)), BUP(x4,  1, 11)),
                       BDN(x4, 13, 12)), BDN(x4, 25, 13)), BUP(x5,  5, 14)),
                       BDN(x5, 17, 15)), BDN(x5, 29, 16)), BUP(x6,  9, 17)),
                       BDN(x6, 21, 18)), BUP(x7,  1, 19)), BUP(x7, 13, 20)),
                       BDN(x7, 25, 21)), BUP(x0,  4, 22)), BUP(x0, 16, 23)),
                       BDN(x0, 28, 24)), BUP(x1,  8, 25)), BUP(x1, 20, 26)),
                       BUP(x2,  0, 27)), BUP(x2, 12, 28)), BUP(x2, 24, 29)),
                       BUP(x3,  4, 30)), BUP(x3, 16, 31));

      this.state[3] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       BDN(x3, 28,  0), BDN(x4,  8,  1)), BDN(x4, 20,  2)),
                       BUP(x5,  0,  3)), BDN(x5, 12,  4)), BDN(x5, 24,  5)),
                       BUP(x6,  4,  6)), BDN(x6, 16,  7)), BDN(x6, 28,  8)),
                       BUP(x7,  8,  9)), BDN(x7, 20, 10)), BUP(x8,  0, 11)),
                       BUP(x0, 11, 12)), BDN(x0, 23, 13)), BUP(x1,  3, 14)),
                       BCP(x1, 15)), BDN(x1, 27, 16)), BUP(x2,  7, 17)),
                       BDN(x2, 19, 18)), BDN(x2, 31, 19)), BUP(x3, 11, 20)),
                       BDN(x3, 23, 21)), BUP(x4,  3, 22)), BUP(x4, 15, 23)),
                       BDN(x4, 27, 24)), BUP(x5,  7, 25)), BUP(x5, 19, 26)),
                       BDN(x5, 31, 27)), BUP(x6, 11, 28)), BUP(x6, 23, 29)),
                       BUP(x7,  3, 30)), BUP(x7, 15, 31));

      this.state[4] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       BDN(x7, 27,  0), BDN(x0,  6,  1)), BDN(x0, 18,  2)),
                       BDN(x0, 30,  3)), BDN(x1, 10,  4)), BDN(x1, 22,  5)),
                       BUP(x2,  2,  6)), BDN(x2, 14,  7)), BDN(x2, 26,  8)),
                       BUP(x3,  6,  9)), BDN(x3, 18, 10)), BDN(x3, 30, 11)),
                       BUP(x4, 10, 12)), BDN(x4, 22, 13)), BUP(x5,  2, 14)),
                       BUP(x5, 14, 15)), BDN(x5, 26, 16)), BUP(x6,  6, 17)),
                       BCP(x6, 18)), BDN(x6, 30, 19)), BUP(x7, 10, 20)),
                       BDN(x7, 22, 21)), BUP(x0,  1, 22)), BUP(x0, 13, 23)),
                       BDN(x0, 25, 24)), BUP(x1,  5, 25)), BUP(x1, 17, 26)),
                       BDN(x1, 29, 27)), BUP(x2,  9, 28)), BUP(x2, 21, 29)),
                       BUP(x3,  1, 30)), BUP(x3, 13, 31));

      this.state[5] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       BDN(x3, 25,  0), BDN(x4,  5,  1)), BDN(x4, 17,  2)),
                       BDN(x4, 29,  3)), BDN(x5,  9,  4)), BDN(x5, 21,  5)),
                       BUP(x6,  1,  6)), BDN(x6, 13,  7)), BDN(x6, 25,  8)),
                       BUP(x7,  5,  9)), BDN(x7, 17, 10)), BDN(x7, 29, 11)),
                       BUP(x0,  8, 12)), BDN(x0, 20, 13)), BUP(x1,  0, 14)),
                       BUP(x1, 12, 15)), BDN(x1, 24, 16)), BUP(x2,  4, 17)),
                       BUP(x2, 16, 18)), BDN(x2, 28, 19)), BUP(x3,  8, 20)),
                       BUP(x3, 20, 21)), BUP(x4,  0, 22)), BUP(x4, 12, 23)),
                       BCP(x4, 24)), BUP(x5,  4, 25)), BUP(x5, 16, 26)),
                       BDN(x5, 28, 27)), BUP(x6,  8, 28)), BUP(x6, 20, 29)),
                       BUP(x7,  0, 30)), BUP(x7, 12, 31));

      this.state[6] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       BDN(x7, 24,  0), BDN(x0,  3,  1)), BDN(x0, 15,  2)),
                       BDN(x0, 27,  3)), BDN(x1,  7,  4)), BDN(x1, 19,  5)),
                       BDN(x1, 31,  6)), BDN(x2, 11,  7)), BDN(x2, 23,  8)),
                       BUP(x3,  3,  9)), BDN(x3, 15, 10)), BDN(x3, 27, 11)),
                       BUP(x4,  7, 12)), BDN(x4, 19, 13)), BDN(x4, 31, 14)),
                       BUP(x5, 11, 15)), BDN(x5, 23, 16)), BUP(x6,  3, 17)),
                       BUP(x6, 15, 18)), BDN(x6, 27, 19)), BUP(x7,  7, 20)),
                       BUP(x7, 19, 21)), BDN(x7, 31, 22)), BUP(x0, 10, 23)),
                       BUP(x0, 22, 24)), BUP(x1,  2, 25)), BUP(x1, 14, 26)),
                       BUP(x1, 26, 27)), BUP(x2,  6, 28)), BUP(x2, 18, 29)),
                       BCP(x2, 30)), BUP(x3, 10, 31));

      this.state[7] = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(
                       BDN(x3, 22,  0), BDN(x4,  2,  1)), BDN(x4, 14,  2)),
                       BDN(x4, 26,  3)), BDN(x5,  6,  4)), BDN(x5, 18,  5)),
                       BDN(x5, 30,  6)), BDN(x6, 10,  7)), BDN(x6, 22,  8)),
                       BUP(x7,  2,  9)), BDN(x7, 14, 10)), BDN(x7, 26, 11)),
                       BUP(x0,  5, 12)), BDN(x0, 17, 13)), BDN(x0, 29, 14)),
                       BUP(x1,  9, 15)), BDN(x1, 21, 16)), BUP(x2,  1, 17)),
                       BUP(x2, 13, 18)), BDN(x2, 25, 19)), BUP(x3,  5, 20)),
                       BUP(x3, 17, 21)), BDN(x3, 29, 22)), BUP(x4,  9, 23)),
                       BUP(x4, 21, 24)), BUP(x5,  1, 25)), BUP(x5, 13, 26)),
                       BUP(x5, 25, 27)), BUP(x6,  5, 28)), BUP(x6, 17, 29)),
                       BUP(x6, 29, 30)), BUP(x7,  9, 31));

      this.state[8] = BDN(x7, 21, 0);
    }

    /**
     * Absorbs a single byte into the state with specific bit permutation
     * @param {number} dataByte - Single byte to absorb
     * @private
     */
    _absorbByte(dataByte) {
      const x = OpCodes.And32(dataByte, 0xFF);

      // Rearrange bits and absorb into state (specific to Subterranean's structure)
      this.state[0] = OpCodes.Xor32(this.state[0], OpCodes.And32(OpCodes.Shl32(x, 1), 0x00000002));
      this.state[1] = OpCodes.Xor32(this.state[1], OpCodes.And32(x, 0x00000008));
      this.state[2] = OpCodes.Xor32(this.state[2], 0x00000001); // 9th padding bit is always 1
      this.state[4] = OpCodes.Xor32(this.state[4], OpCodes.Xor32(OpCodes.And32(OpCodes.Shl32(x, 6), 0x00000100), OpCodes.And32(OpCodes.Shl32(x, 1), 0x00000040)));
      this.state[5] = OpCodes.Xor32(this.state[5], OpCodes.And32(OpCodes.Shl32(x, 15), 0x00010000));
      this.state[6] = OpCodes.Xor32(this.state[6], OpCodes.And32(OpCodes.Shr32(x, 1), 0x00000020));
      this.state[7] = OpCodes.Xor32(this.state[7], OpCodes.Xor32(OpCodes.And32(OpCodes.Shl32(x, 21), 0x02000000), OpCodes.And32(OpCodes.Shl32(x, 3), 0x00000400)));
    }

    /**
     * Duplex operation with a single byte
     * @param {number} dataByte - Byte to absorb
     * @private
     */
    _duplexByte(dataByte) {
      this._round();
      this._absorbByte(dataByte);
    }

    /**
     * Duplex operation with zero bytes (padding)
     * @private
     */
    _duplexZero() {
      this._round();
      this.state[0] = OpCodes.Xor32(this.state[0], 0x02); // Padding for empty block
    }

    /**
     * Blank operation: 8 rounds with padding
     * @private
     */
    _blank() {
      for (let round = 0; round < 8; ++round) {
        this._round();
        this.state[0] = OpCodes.Xor32(this.state[0], 0x02); // Padding bit
      }
    }

    /**
     * Extracts 32 bits from the state for output
     * @returns {number} Extracted 32-bit word
     * @private
     */
    _extract() {
      // Extract and XOR multiple state bits to produce output
      // This implements the complex extraction permutation
      const x0 = this.state[0];
      const x1 = this.state[1];
      const x2 = this.state[2];
      const x3 = this.state[3];
      const x4 = this.state[4];
      const x5 = this.state[5];
      const x6 = this.state[6];
      const x7 = this.state[7];

      let x, y;

      // P0 permutation
      x = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
        OpCodes.And32(x0, 0x00010000),
        OpCodes.Shl32(OpCodes.And32(x0, 0x00000800), 6)),
        OpCodes.Shl32(OpCodes.And32(x0, 0x00400000), 7)),
        OpCodes.Shl32(OpCodes.And32(x0, 0x00000004), 10)),
        OpCodes.Shl32(OpCodes.And32(x0, 0x00020000), 13)),
        OpCodes.Shr32(OpCodes.And32(x0, 0x00800000), 16)),
        OpCodes.Shl32(OpCodes.And32(x0, 0x00000010), 20)),
        OpCodes.Shr32(OpCodes.And32(x0, 0x40000100), 4)),
        OpCodes.Shr32(OpCodes.And32(x0, 0x00008002), 1));
      y = OpCodes.And32(x, 0x65035091);

      // P1 permutation
      x = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
        OpCodes.And32(x1, 0x00000008),
        OpCodes.Shl32(OpCodes.And32(x1, 0x00004000), 5)),
        OpCodes.Shl32(OpCodes.And32(x1, 0x00000004), 8)),
        OpCodes.Shr32(OpCodes.And32(x1, 0x10000000), 22)),
        OpCodes.Shl32(OpCodes.And32(x1, 0x00000001), 28)),
        OpCodes.Shr32(OpCodes.And32(x1, 0x00001000), 3));
      y = OpCodes.Xor32(y, OpCodes.And32(x, 0x10080648));

      // P2 permutation
      x = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
        OpCodes.Shl32(OpCodes.And32(x2, 0x00000200), 2),
        OpCodes.Shl32(OpCodes.And32(x2, 0x10000000), 3)),
        OpCodes.Shl32(OpCodes.And32(x2, 0x00000001), 8)),
        OpCodes.Shl32(OpCodes.And32(x2, 0x00000040), 9)),
        OpCodes.Shr32(OpCodes.And32(x2, 0x80000000), 18)),
        OpCodes.Shr32(OpCodes.And32(x2, 0x00020000), 16)),
        OpCodes.Shl32(OpCodes.And32(x2, 0x00000010), 18)),
        OpCodes.Shl32(OpCodes.And32(x2, 0x00000008), 22)),
        OpCodes.Shr32(OpCodes.And32(x2, 0x01000000), 3));
      y = OpCodes.Xor32(y, OpCodes.And32(x, 0x8260a902));

      // P3 permutation
      x = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
        OpCodes.Shl32(OpCodes.And32(x3, 0x00200000), 6),
        OpCodes.Shl32(OpCodes.And32(x3, 0x00008000), 8)),
        OpCodes.Shr32(OpCodes.And32(x3, 0x02000000), 23)),
        OpCodes.Shr32(OpCodes.And32(x3, 0x08000000), 22)),
        OpCodes.Shr32(OpCodes.And32(x3, 0x01000000), 6));
      y = OpCodes.Xor32(y, OpCodes.And32(x, 0x08840024));

      // P4 permutation (with special handling for duplicated bit 20)
      y = OpCodes.Xor32(y, OpCodes.And32(OpCodes.Shl32(x4, 20), 0x00100000));
      x = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
        OpCodes.Shl32(OpCodes.And32(x4, 0x00040000), 5),
        OpCodes.Shl32(OpCodes.And32(x4, 0x00000200), 9)),
        OpCodes.Shl32(OpCodes.And32(x4, 0x00001000), 15)),
        OpCodes.Shl32(OpCodes.And32(x4, 0x00000002), 19)),
        OpCodes.Shr32(OpCodes.And32(x4, 0x00000100), 6)),
        OpCodes.Shr32(OpCodes.And32(x4, 0x00000040), 1));
      y = OpCodes.Xor32(y, OpCodes.And32(x, 0x08940024));

      // P5 permutation
      x = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
        OpCodes.Shl32(OpCodes.And32(x5, 0x00000004), 11),
        OpCodes.Shl32(OpCodes.And32(x5, 0x00000200), 12)),
        OpCodes.Shr32(OpCodes.And32(x5, 0x00010000), 15)),
        OpCodes.Shr32(OpCodes.And32(x5, 0x01000000), 13)),
        OpCodes.Shr32(OpCodes.And32(x5, 0x08000000), 12)),
        OpCodes.Shr32(OpCodes.And32(x5, 0x20000000), 7)),
        OpCodes.Shl32(OpCodes.And32(x5, 0x00000020), 26)),
        OpCodes.Shr32(OpCodes.And32(x5, 0x40000000), 5));
      y = OpCodes.Xor32(y, OpCodes.And32(x, 0x8260a802));

      // P6 permutation
      x = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
        OpCodes.And32(x6, 0x00080000),
        OpCodes.Shl32(OpCodes.And32(x6, 0x00000020), 1)),
        OpCodes.Shr32(OpCodes.And32(x6, 0x40000000), 27)),
        OpCodes.Shl32(OpCodes.And32(x6, 0x00000002), 7)),
        OpCodes.Shr32(OpCodes.And32(x6, 0x80000000), 21)),
        OpCodes.Shr32(OpCodes.And32(x6, 0x00200000), 12));
      y = OpCodes.Xor32(y, OpCodes.And32(x, 0x00080748));

      // P7 permutation - using helper for rotation
      const rotL27 = (val) => OpCodes.RotL32(val, 27);
      x = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(
        OpCodes.Shr32(OpCodes.And32(x7, 0x02000000), 21),
        OpCodes.Shr32(OpCodes.And32(x7, 0x80000000), 19)),
        OpCodes.Shl32(OpCodes.And32(x7, 0x00010000), 14)),
        OpCodes.Shl32(OpCodes.And32(x7, 0x00000800), 18)),
        OpCodes.Shl32(OpCodes.And32(x7, 0x00000008), 23)),
        rotL27(OpCodes.And32(x7, 0x20400002))),
        OpCodes.Shr32(OpCodes.And32(x7, 0x00040000), 4)),
        OpCodes.Shr32(OpCodes.And32(x7, 0x00000400), 3)),
        OpCodes.Shr32(OpCodes.And32(x7, 0x00020000), 1));
      y = OpCodes.Xor32(y, OpCodes.And32(x, 0x75035090));

      // XOR with the single bit in x[8]
      return OpCodes.Xor32(y, this.state[8]);
    }

    /**
     * Squeeze operation: extract output bytes from state
     * @param {number} length - Number of bytes to extract
     * @returns {Array<number>} Extracted bytes
     * @private
     */
    _squeeze(length) {
      const output = [];

      while (length > 4) {
        const word = this._extract();
        this._duplexZero();

        // Store as little-endian
        output.push(OpCodes.And32(word, 0xFF));
        output.push(OpCodes.And32(OpCodes.Shr32(word, 8), 0xFF));
        output.push(OpCodes.And32(OpCodes.Shr32(word, 16), 0xFF));
        output.push(OpCodes.And32(OpCodes.Shr32(word, 24), 0xFF));

        length -= 4;
      }

      // Handle remaining bytes
      if (length > 0) {
        const word = this._extract();

        for (let i = 0; i < length; ++i) {
          output.push(OpCodes.And32(OpCodes.Shr32(word, (i * 8)), 0xFF));
        }
      }

      return output;
    }
  }

  // Register algorithm immediately
  RegisterAlgorithm(new SubterraneanHash());

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
