/*
 * Streebog (GOST R 34.11-2012) Hash Function - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * Russian Federal standard hash function, specified by GOST R 34.11-2012 and
 * republished as RFC 6986. Both the 256-bit and the 512-bit variants are the
 * same construction over a 512-bit state; they differ only in the initial
 * chaining value and in how much of the final state is returned.
 *
 * The substitution Pi, the byte permutation Tau, the 64 rows of the linear
 * transformation matrix A and the twelve iteration constants C[1..12] below
 * are the published constants from RFC 6986 sections 6.2 through 6.5.
 *
 * RFC 6986 prints every 512-bit vector most significant byte first. The state
 * here is indexed the other way round, least significant byte first, because
 * that is the order in which the message arrives: message byte i lands at
 * state index i and the single 0x01 padding marker lands immediately past the
 * message, exactly as section 9 step 3.1 requires. The printed constants are
 * therefore reversed once, at load time, and the digest is read back out in
 * index order.
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

  const BLOCK_SIZE = 64;   // 512 bits
  const STATE_SIZE = 64;   // 512 bits

  /**
   * Turn a vector printed most significant byte first, the way RFC 6986 writes
   * them, into the least-significant-first byte array this file works with.
   * @param {string} hex - 128 hexadecimal digits
   * @returns {uint8[]} 64 bytes, index 0 least significant
   */
  function PrintedToState(hex) {
    return Object.freeze(OpCodes.Hex8ToBytes(hex).reverse());
  }

  // RFC 6986 section 6.2 - nonlinear bijection Pi'
  const PI = Object.freeze([
    252, 238, 221,  17, 207, 110,  49,  22, 251, 196, 250, 218,  35, 197,   4,  77,
    233, 119, 240, 219, 147,  46, 153, 186,  23,  54, 241, 187,  20, 205,  95, 193,
    249,  24, 101,  90, 226,  92, 239,  33, 129,  28,  60,  66, 139,   1, 142,  79,
      5, 132,   2, 174, 227, 106, 143, 160,   6,  11, 237, 152, 127, 212, 211,  31,
    235,  52,  44,  81, 234, 200,  72, 171, 242,  42, 104, 162, 253,  58, 206, 204,
    181, 112,  14,  86,   8,  12, 118,  18, 191, 114,  19,  71, 156, 183,  93, 135,
     21, 161, 150,  41,  16, 123, 154, 199, 243, 145, 120, 111, 157, 158, 178, 177,
     50, 117,  25,  61, 255,  53, 138, 126, 109,  84, 198, 128, 195, 189,  13,  87,
    223, 245,  36, 169,  62, 168,  67, 201, 215, 121, 214, 246, 124,  34, 185,   3,
    224,  15, 236, 222, 122, 148, 176, 188, 220, 232,  40,  80,  78,  51,  10,  74,
    167, 151,  96, 115,  30,   0,  98,  68,  26, 184,  56, 130, 100, 159,  38,  65,
    173,  69,  70, 146,  39,  94,  85,  47, 140, 163, 165, 125, 105, 213, 149,  59,
      7,  88, 179,  64, 134, 172,  29, 247,  48,  55, 107, 228, 136, 217, 231, 137,
    225,  27, 131,  73,  76,  63, 248, 254, 141,  83, 170, 144, 202, 216, 133,  97,
     32, 113, 103, 164,  45,  43,   9,  91, 203, 155,  37, 208, 190, 229, 108,  82,
     89, 166, 116, 210, 230, 244, 180, 192, 209, 102, 175, 194,  57,  75,  99, 182
  ]);

  // RFC 6986 section 6.3 - byte permutation Tau
  const TAU = Object.freeze([
     0,  8, 16, 24, 32, 40, 48, 56,  1,  9, 17, 25, 33, 41, 49, 57,
     2, 10, 18, 26, 34, 42, 50, 58,  3, 11, 19, 27, 35, 43, 51, 59,
     4, 12, 20, 28, 36, 44, 52, 60,  5, 13, 21, 29, 37, 45, 53, 61,
     6, 14, 22, 30, 38, 46, 54, 62,  7, 15, 23, 31, 39, 47, 55, 63
  ]);

  // RFC 6986 section 6.4 - rows of the matrix A, row 0 first.
  // Row j is selected by bit 63 - j of the 64-bit subvector being transformed.
  const A_MATRIX = Object.freeze([
    0x8e20faa72ba0b470n, 0x47107ddd9b505a38n, 0xad08b0e0c3282d1cn, 0xd8045870ef14980en,
    0x6c022c38f90a4c07n, 0x3601161cf205268dn, 0x1b8e0b0e798c13c8n, 0x83478b07b2468764n,
    0xa011d380818e8f40n, 0x5086e740ce47c920n, 0x2843fd2067adea10n, 0x14aff010bdd87508n,
    0x0ad97808d06cb404n, 0x05e23c0468365a02n, 0x8c711e02341b2d01n, 0x46b60f011a83988en,
    0x90dab52a387ae76fn, 0x486dd4151c3dfdb9n, 0x24b86a840e90f0d2n, 0x125c354207487869n,
    0x092e94218d243cban, 0x8a174a9ec8121e5dn, 0x4585254f64090fa0n, 0xaccc9ca9328a8950n,
    0x9d4df05d5f661451n, 0xc0a878a0a1330aa6n, 0x60543c50de970553n, 0x302a1e286fc58ca7n,
    0x18150f14b9ec46ddn, 0x0c84890ad27623e0n, 0x0642ca05693b9f70n, 0x0321658cba93c138n,
    0x86275df09ce8aaa8n, 0x439da0784e745554n, 0xafc0503c273aa42an, 0xd960281e9d1d5215n,
    0xe230140fc0802984n, 0x71180a8960409a42n, 0xb60c05ca30204d21n, 0x5b068c651810a89en,
    0x456c34887a3805b9n, 0xac361a443d1c8cd2n, 0x561b0d22900e4669n, 0x2b838811480723ban,
    0x9bcf4486248d9f5dn, 0xc3e9224312c8c1a0n, 0xeffa11af0964ee50n, 0xf97d86d98a327728n,
    0xe4fa2054a80b329cn, 0x727d102a548b194en, 0x39b008152acb8227n, 0x9258048415eb419dn,
    0x492c024284fbaec0n, 0xaa16012142f35760n, 0x550b8e9e21f7a530n, 0xa48b474f9ef5dc18n,
    0x70a6a56e2440598en, 0x3853dc371220a247n, 0x1ca76e95091051adn, 0x0edd37c48a08a6d8n,
    0x07e095624504536cn, 0x8d70c431ac02a736n, 0xc83862965601dd1bn, 0x641c314b2b8ee083n
  ]);

  // RFC 6986 section 6.5 - iteration constants C[1] through C[12]
  const C = Object.freeze([
    // C[1]
    PrintedToState(
      "b1085bda1ecadae9ebcb2f81c0657c1f" +
      "2f6a76432e45d016714eb88d7585c4fc" +
      "4b7ce09192676901a2422a08a460d315" +
      "05767436cc744d23dd806559f2a64507"
    ),
    // C[2]
    PrintedToState(
      "6fa3b58aa99d2f1a4fe39d460f70b5d7" +
      "f3feea720a232b9861d55e0f16b50131" +
      "9ab5176b12d699585cb561c2db0aa7ca" +
      "55dda21bd7cbcd56e679047021b19bb7"
    ),
    // C[3]
    PrintedToState(
      "f574dcac2bce2fc70a39fc286a3d8435" +
      "06f15e5f529c1f8bf2ea7514b1297b7b" +
      "d3e20fe490359eb1c1c93a376062db09" +
      "c2b6f443867adb31991e96f50aba0ab2"
    ),
    // C[4]
    PrintedToState(
      "ef1fdfb3e81566d2f948e1a05d71e4dd" +
      "488e857e335c3c7d9d721cad685e353f" +
      "a9d72c82ed03d675d8b71333935203be" +
      "3453eaa193e837f1220cbebc84e3d12e"
    ),
    // C[5]
    PrintedToState(
      "4bea6bacad4747999a3f410c6ca92363" +
      "7f151c1f1686104a359e35d7800fffbd" +
      "bfcd1747253af5a3dfff00b723271a16" +
      "7a56a27ea9ea63f5601758fd7c6cfe57"
    ),
    // C[6]
    PrintedToState(
      "ae4faeae1d3ad3d96fa4c33b7a3039c0" +
      "2d66c4f95142a46c187f9ab49af08ec6" +
      "cffaa6b71c9ab7b40af21f66c2bec6b6" +
      "bf71c57236904f35fa68407a46647d6e"
    ),
    // C[7]
    PrintedToState(
      "f4c70e16eeaac5ec51ac86febf240954" +
      "399ec6c7e6bf87c9d3473e33197a93c9" +
      "0992abc52d822c3706476983284a0504" +
      "3517454ca23c4af38886564d3a14d493"
    ),
    // C[8]
    PrintedToState(
      "9b1f5b424d93c9a703e7aa020c6e4141" +
      "4eb7f8719c36de1e89b4443b4ddbc49a" +
      "f4892bcb929b069069d18d2bd1a5c42f" +
      "36acc2355951a8d9a47f0dd4bf02e71e"
    ),
    // C[9]
    PrintedToState(
      "378f5a541631229b944c9ad8ec165fde" +
      "3a7d3a1b258942243cd955b7e00d0984" +
      "800a440bdbb2ceb17b2b8a9aa6079c54" +
      "0e38dc92cb1f2a607261445183235adb"
    ),
    // C[10]
    PrintedToState(
      "abbedea680056f52382ae548b2e4f3f3" +
      "8941e71cff8a78db1fffe18a1b336103" +
      "9fe76702af69334b7a1e6c303b7652f4" +
      "3698fad1153bb6c374b4c7fb98459ced"
    ),
    // C[11]
    PrintedToState(
      "7bcd9ed0efc889fb3002c6cd635afe94" +
      "d8fa6bbbebab07612001802114846679" +
      "8a1d71efea48b9caefbacd1d7d476e98" +
      "dea2594ac06fd85d6bcaa4cd81f32d1b"
    ),
    // C[12]
    PrintedToState(
      "378ee767f11631bad21380b00449b17a" +
      "cda43c32bcdf1d77f82012d430219f9b" +
      "5d80ef9d1891cc86e71da4aa88e12852" +
      "faf417d5d9b21b9948bc924af11bd720"
    )
  ]);

  // ===== DERIVED TABLES =====

  /**
   * Which input byte feeds each output byte of P(S(a)).
   * SOURCE[g][j] is the state index whose substituted value becomes byte j of
   * output group g, read straight out of the published Tau.
   */
  const SOURCE = Object.freeze((function () {
    const map = new Array(8);
    for (let g = 0; g < 8; g++) {
      const row = new Array(8);
      for (let j = 0; j < 8; j++) row[j] = TAU[g * 8 + j];
      map[g] = Object.freeze(row);
    }
    return map;
  })());

  /**
   * The linear transformation l, split by byte position.
   *
   * l is linear over GF(2), so l applied to a 64-bit subvector is the XOR of l
   * applied to each of its bytes in isolation. AX[j][b] is l of the value that
   * has byte b at position j and zeros elsewhere; byte j bit t of a subvector
   * is bit 8j + t of it, which selects matrix row 63 - 8j - t.
   */
  const AX = Object.freeze((function () {
    const table = new Array(8);
    for (let j = 0; j < 8; j++) {
      const row = new Array(256);
      for (let b = 0; b < 256; b++) {
        let acc = 0n;
        for (let t = 0; t < 8; t++) {
          if (OpCodes.AndN(OpCodes.ShiftRn(BigInt(b), t), 1n) === 1n)
            acc = OpCodes.XorN(acc, A_MATRIX[63 - j * 8 - t]);
        }
        row[b] = acc;
      }
      table[j] = Object.freeze(row);
    }
    return table;
  })());

  // ===== 512-BIT PRIMITIVES =====

  /**
   * XOR of two 512-bit vectors.
   * @param {uint8[]} a
   * @param {uint8[]} b
   * @returns {uint8[]} a xor b
   */
  function Xor512(a, b) {
    const out = new Array(STATE_SIZE);
    for (let i = 0; i < STATE_SIZE; i++) out[i] = OpCodes.XorN(a[i], b[i]);
    return out;
  }

  /**
   * Addition of two 512-bit vectors modulo 2^512, least significant byte first.
   * @param {uint8[]} a
   * @param {uint8[]} b
   * @returns {uint8[]} a plus b
   */
  function Add512(a, b) {
    const out = new Array(STATE_SIZE);
    let carry = 0;
    for (let i = 0; i < STATE_SIZE; i++) {
      const sum = a[i] + b[i] + carry;
      out[i] = OpCodes.ToByte(sum);
      carry = sum > 255 ? 1 : 0;
    }
    return out;
  }

  /**
   * A 512-bit vector holding a small non-negative integer.
   * @param {number} value
   * @returns {uint8[]}
   */
  function Vec512(value) {
    const out = new Array(STATE_SIZE).fill(0);
    let rest = value;
    for (let i = 0; i < STATE_SIZE && rest > 0; i++) {
      out[i] = rest % 256;
      rest = Math.floor(rest / 256);
    }
    return out;
  }

  /**
   * LPS, the composition L(P(S(a))) of RFC 6986 section 7.
   * @param {uint8[]} state - 64 bytes
   * @returns {uint8[]} 64 bytes
   */
  function LPS(state) {
    const out = new Array(STATE_SIZE);
    for (let g = 0; g < 8; g++) {
      let word = 0n;
      for (let j = 0; j < 8; j++)
        word = OpCodes.XorN(word, AX[j][PI[state[SOURCE[g][j]]]]);
      for (let j = 0; j < 8; j++)
        out[g * 8 + j] = Number(OpCodes.AndN(OpCodes.ShiftRn(word, j * 8), 0xFFn));
    }
    return out;
  }

  /**
   * The round function g_N(h, m) = E(LPS(h xor N), m) xor h xor m.
   * @param {uint8[]} N - block counter vector
   * @param {uint8[]} h - chaining value
   * @param {uint8[]} m - message block
   * @returns {uint8[]} new chaining value
   */
  function RoundFunction(N, h, m) {
    let key = LPS(Xor512(h, N));
    let state = Xor512(m, key);
    for (let i = 0; i < 12; i++) {
      state = LPS(state);
      key = LPS(Xor512(key, C[i]));
      state = Xor512(state, key);
    }
    return Xor512(Xor512(state, h), m);
  }

  const BLOCK_BITS = Vec512(BLOCK_SIZE * 8);
  const ZERO512 = Object.freeze(new Array(STATE_SIZE).fill(0));

  // ===== PUBLISHED TEST VECTORS =====

  /**
   * Published vectors for one digest size.
   * @param {int} digestSize - 32 or 64 bytes
   * @returns {object[]} test cases
   */
  function BuildTests(digestSize) {
    if (digestSize === 32) return [
      {
        text: "RFC 6986 example 1 - M1, 63 bytes",
        uri: "https://www.rfc-editor.org/rfc/rfc6986.txt",
        input: OpCodes.Hex8ToBytes("303132333435363738393031323334353637383930313233343536373839303132333435363738393031323334353637383930313233343536373839303132"),
        expected: OpCodes.Hex8ToBytes("9d151eefd8590b89daa6ba6cb74af9275dd051026bb149a452fd84e5e57b5500")
      },
      {
        text: "RFC 6986 example 2 - M2, 72 bytes spanning two blocks",
        uri: "https://www.rfc-editor.org/rfc/rfc6986.txt",
        input: OpCodes.Hex8ToBytes("d1e520e2e5f2f0e82c20d1f2f0e8e1eee6e820e2edf3f6e82c20e2e5fef2fa20f120eceef0ff20f1f2f0e5ebe0ece820ede020f5f0e0e1f0fbff20efebfaeafb20c8e3eef0e5e2fb"),
        expected: OpCodes.Hex8ToBytes("9dd2fe4e90409e5da87f53976d7405b0c0cac628fc669a741d50063c557e8f50")
      },
      {
        text: "Botan streebog.vec - empty message",
        uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec",
        input: [],
        expected: OpCodes.Hex8ToBytes("3f539a213e97c802cc229d474c6aa32a825a360b2a933a949fd925208d9ce1bb")
      },
      {
        text: "Botan streebog.vec - one byte",
        uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec",
        input: OpCodes.Hex8ToBytes("c6"),
        expected: OpCodes.Hex8ToBytes("d907b672d09f48d27ad06c26647921c9e25d063c038eaaefac81e749dc1d98b5")
      },
      {
        text: "Botan streebog.vec - 64 bytes, exactly the block size, forcing an all-padding block",
        uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec",
        input: OpCodes.Hex8ToBytes("00b7d1c42da82cc055affead5924db662e5a080081697f8287c687fe91d32b4254fbb961725559a32c43c3f8114e05c2991108228ed83edc476fb9a62874fab1"),
        expected: OpCodes.Hex8ToBytes("68367c34ad8441a48ac7fc65657ac73aa51e1a36c5346c0bf011945bcb9ef773")
      },
      {
        text: "Botan streebog.vec - 65 bytes, one over the block size",
        uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec",
        input: OpCodes.Hex8ToBytes("89e8a4ccd6285add12b0c46506e91c09a3c2dd30951eb72818b58187f1a608edebf569fa81254970ad7f04ae9a25827fa6482829fdc0797a5cff6f7446d14576d2"),
        expected: OpCodes.Hex8ToBytes("64f56da108ea18571aacb6852b5be57999ec5de82a7d1f719fcddfc7ec1b0ad1")
      },
      {
        text: "Botan streebog.vec - 127 bytes, one under two blocks",
        uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec",
        input: OpCodes.Hex8ToBytes("c1c065c63b1b848430326ded0cd23cffc644296813df0f968275492026737fd8d26f8690f19512e5a7c936050fc6b011d0538a6d5c1e75f839af3b0237d4a1accb497de6733f9717326260401a77a564e7bca93ae9fe7d257060e44ea08c350c9f64a78ce095fe29a7d1fc23de9350a47b71eda31514d134d84b5180930e29"),
        expected: OpCodes.Hex8ToBytes("1ef768f7ae820c2966b7c60b0cf208ab89c1f7b60f9b2cab61253c38d1f2c987")
      },
      {
        text: "Botan streebog.vec - 128 bytes, an exact multiple of the block size",
        uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec",
        input: OpCodes.Hex8ToBytes("290f597702e009d86f49d5362346309e26919eacbcb86165be4906056d43f95a1e181b2b0c12785c929f17a3d25943f5313641c915bf5dd38882d587da1da65d6658f89764e28ee13a24ac9349e6803579baa17d6ca571793c13f7a0fe46043deeed08922fb2e2353d8718c5f1c7f1fba2df54e9cbbad54a750da656863d2843"),
        expected: OpCodes.Hex8ToBytes("c9c82e740ccc34fc0c14c61ab4eb037542d77ffda00d484aff97c1144346704f")
      }
    ];
    return [
      {
        text: "RFC 6986 example 1 - M1, 63 bytes",
        uri: "https://www.rfc-editor.org/rfc/rfc6986.txt",
        input: OpCodes.Hex8ToBytes("303132333435363738393031323334353637383930313233343536373839303132333435363738393031323334353637383930313233343536373839303132"),
        expected: OpCodes.Hex8ToBytes("1b54d01a4af5b9d5cc3d86d68d285462b19abc2475222f35c085122be4ba1ffa00ad30f8767b3a82384c6574f024c311e2a481332b08ef7f41797891c1646f48")
      },
      {
        text: "RFC 6986 example 2 - M2, 72 bytes spanning two blocks",
        uri: "https://www.rfc-editor.org/rfc/rfc6986.txt",
        input: OpCodes.Hex8ToBytes("d1e520e2e5f2f0e82c20d1f2f0e8e1eee6e820e2edf3f6e82c20e2e5fef2fa20f120eceef0ff20f1f2f0e5ebe0ece820ede020f5f0e0e1f0fbff20efebfaeafb20c8e3eef0e5e2fb"),
        expected: OpCodes.Hex8ToBytes("1e88e62226bfca6f9994f1f2d51569e0daf8475a3b0fe61a5300eee46d961376035fe83549ada2b8620fcd7c496ce5b33f0cb9dddc2b6460143b03dabac9fb28")
      },
      {
        text: "Botan streebog.vec - empty message",
        uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec",
        input: [],
        expected: OpCodes.Hex8ToBytes("8e945da209aa869f0455928529bcae4679e9873ab707b55315f56ceb98bef0a7362f715528356ee83cda5f2aac4c6ad2ba3a715c1bcd81cb8e9f90bf4c1c1a8a")
      },
      {
        text: "Botan streebog.vec - one byte",
        uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec",
        input: OpCodes.Hex8ToBytes("3b"),
        expected: OpCodes.Hex8ToBytes("18ff357b3d82838113a6f34d5bedd966990959e215d6793bcaf09a007dcbcc40b141b268ec3356117914ce9da1278f824d6192ff497f7394592f5c01ec64907a")
      },
      {
        text: "Botan streebog.vec - 64 bytes, exactly the block size, forcing an all-padding block",
        uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec",
        input: OpCodes.Hex8ToBytes("6277ed0cbcd95d4f45f94ac9525effda8b823da886942c662eaa25ac8cfefbc826046c5d017d96d0cbc3fa28e5f46c466432ad3b7e204eb181cba531f4f289c2"),
        expected: OpCodes.Hex8ToBytes("04a8f7eb4feccf00281bca12576779aaa0fd81307679a76366b6ad726f4cbf0a9e16f03d435b561a25338c931750ab812cac1bfc4716de0a408fe132a7d5c9cf")
      },
      {
        text: "Botan streebog.vec - 65 bytes, one over the block size",
        uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec",
        input: OpCodes.Hex8ToBytes("44d2459c2ed212173625fc921fdd05a0f2d6593515944bfc5ca37ef9b75ae3e66234d124722ba75feb698ffe11c319e53726456d9417e396928d8519a3e6898195"),
        expected: OpCodes.Hex8ToBytes("0cbfeaf77ca3c157be6a367b0fda771ba5aa465f27c4a446fa5e23356006aa43cf2a0d1aa8803a2b85a34298ecb99936d8e4e986dce6fd698dbb097b7e3ed8ab")
      },
      {
        text: "Botan streebog.vec - 127 bytes, one under two blocks",
        uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec",
        input: OpCodes.Hex8ToBytes("0079ce89a3bb7209563a1fab751a5b80e6c424b2996d241d601e255d601b81943eb05b44523f1c1b0cde018fe08dca199ab809c05b03ed281d7f4cfb16b978047695a98e7a01ff35c498c7214b9f6c401342d356fd2818036f786236d85211acdeeb7bbe7d669f168737f437d004d9783d4203213c52d178f1787efeb2ee3c"),
        expected: OpCodes.Hex8ToBytes("a7bcd688131c97b57dedc7aebd845e0042ea9f8d3a425f11f57ddfef8eaec040e93d9219b68ab919ac4c5c5c1522ed9cbb50951bace6499e2cd0db13ff57e136")
      },
      {
        text: "Botan streebog.vec - 128 bytes, an exact multiple of the block size",
        uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec",
        input: OpCodes.Hex8ToBytes("25894e39aef06148d682f48a34f100ea694e446bbf79caa7806c7c6f3f8a60a94b9c8b2877c617fead17ac576d8dafd3f8514e49825d54dc9a8916330dc560204bd795d0ce00a49ba3c25c7921381c057bc6a1abb362db79497c878321c2a71793f2bfb7ad211700fecd486241cc6197a50075560147b20b9cbe2f992f516c61"),
        expected: OpCodes.Hex8ToBytes("b4ce87a416b83be3417ccbd7000d658acce2a5c3b57c92aa8ca3d912f20580748c2534a157b4ead16059499b9b11ae8ff07cca94a2a5a314b4ac4faaddcb0162")
      }
    ];
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * StreebogAlgorithm - GOST R 34.11-2012 hash function
   * @class
   * @extends {HashFunctionAlgorithm}
   */
  class StreebogAlgorithm extends HashFunctionAlgorithm {
    /**
     * @param {int} digestSize - 32 for Streebog-256, 64 for Streebog-512
     */
    constructor(digestSize) {
      super();

      const bits = digestSize * 8;
      this.digestSize = digestSize;

      this.name = "Streebog-" + bits;
      this.description = "Russian Federal standard hash function GOST R 34.11-2012, republished as RFC 6986. A 512-bit state is mixed by twelve rounds of an AES-like substitution-permutation network, with a block counter and a running checksum folded in at the end. This is the " + bits + "-bit variant.";
      this.inventor = "Center for Information Protection and Special Communications of the FSB of Russia, InfoTeCS JSC";
      this.year = 2012;
      this.category = CategoryType.HASH;
      this.subCategory = "GOST";
      this.securityStatus = null;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedOutputSizes = [digestSize];
      this.SupportedHashSizes = [new KeySize(digestSize, digestSize, 1)];
      this.BlockSize = BLOCK_SIZE;
      this.blockSize = BLOCK_SIZE;
      this.outputSize = digestSize;

      this.documentation = [
        new LinkItem("RFC 6986 - GOST R 34.11-2012: Hash Function", "https://www.rfc-editor.org/rfc/rfc6986.txt"),
        new LinkItem("GOST R 34.11-2012 (TC26, English)", "https://www.tc26.ru/en/standard/gost/GOST_R_3411-2012_eng.pdf")
      ];

      this.references = [
        new LinkItem("Botan test vectors", "https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec"),
        new LinkItem("Wikipedia: Streebog", "https://en.wikipedia.org/wiki/Streebog")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unexplained S-box", "The origin of the substitution Pi has never been published, which has drawn academic criticism even though no attack on the full function is known.")
      ];

      this.tests = BuildTests(digestSize);
    }

    /**
     * Create new hash instance
     * @param {boolean} [isInverse=false] - unused, hashes have no inverse
     * @returns {Object} New hash instance
     */
    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new StreebogAlgorithmInstance(this, this.digestSize);
    }
  }

  /**
   * Streebog hash instance implementing the Feed/Result pattern
   * @class
   * @extends {IHashFunctionInstance}
   */
  class StreebogAlgorithmInstance extends IHashFunctionInstance {
    /**
     * @param {Object} algorithm - parent algorithm
     * @param {int} digestSize - 32 or 64 bytes
     */
    constructor(algorithm, digestSize) {
      super(algorithm);
      this.digestSize = digestSize;
      this.OutputSize = digestSize;

      // RFC 6986 section 9 step 1.1: the 512-bit variant starts from zero, the
      // 256-bit variant from a vector of 0x01 bytes.
      this._h = new Array(STATE_SIZE).fill(digestSize === 32 ? 0x01 : 0x00);
      this._N = new Array(STATE_SIZE).fill(0);
      this._sigma = new Array(STATE_SIZE).fill(0);

      this._absorber = new BlockAbsorber(BLOCK_SIZE, block => this._absorb(block));
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
     * @returns {uint8[]} digestSize bytes
     */
    Result() {
      // Result() stays repeatable: Finish hands out a copy of the held bytes
      // without advancing the absorber, so restoring the three state vectors
      // afterwards undoes the finalization entirely.
      const saved = [this._h, this._N, this._sigma];
      this._h = this._h.slice();
      this._N = this._N.slice();
      this._sigma = this._sigma.slice();

      this._absorber.Finish((held, pending) => {
        let rest = held;
        let count = pending;

        // A held block that is already full is an ordinary block: the absorber
        // only keeps it back in case more data followed. Streebog then still
        // owes a final block that is nothing but padding, which is what makes
        // an exact multiple of the block size cost one compression more.
        if (count === BLOCK_SIZE) {
          this._absorb(held);
          rest = [];
          count = 0;
        }

        // RFC 6986 section 9 step 3.1: m = 0...0 || 1 || M
        const m = new Array(BLOCK_SIZE).fill(0);
        for (let i = 0; i < count; i++) m[i] = OpCodes.ToByte(rest[i]);
        m[count] = 0x01;

        this._h = RoundFunction(this._N, this._h, m);
        this._N = Add512(this._N, Vec512(count * 8));
        this._sigma = Add512(this._sigma, m);

        // Steps 3.5 and 3.6 fold in the total length and the checksum
        this._h = RoundFunction(ZERO512, this._h, this._N);
        this._h = RoundFunction(ZERO512, this._h, this._sigma);
      });

      // The 256-bit variant keeps the most significant half of the state,
      // which is the upper end of the index range in this byte order.
      const digest = this._h.slice(STATE_SIZE - this.digestSize, STATE_SIZE);

      this._h = saved[0];
      this._N = saved[1];
      this._sigma = saved[2];
      return digest;
    }

    /**
     * Absorb one full 512-bit message block.
     * @param {uint8[]} block - exactly 64 bytes
     */
    _absorb(block) {
      const m = new Array(BLOCK_SIZE);
      for (let i = 0; i < BLOCK_SIZE; i++) m[i] = OpCodes.ToByte(block[i]);
      this._h = RoundFunction(this._N, this._h, m);
      this._N = Add512(this._N, BLOCK_BITS);
      this._sigma = Add512(this._sigma, m);
    }
  }

  // ===== REGISTRATION =====

  const streebog256 = new StreebogAlgorithm(32);
  if (!AlgorithmFramework.Find(streebog256.name)) {
    RegisterAlgorithm(streebog256);
  }

  const streebog512 = new StreebogAlgorithm(64);
  if (!AlgorithmFramework.Find(streebog512.name)) {
    RegisterAlgorithm(streebog512);
  }

  // ===== EXPORTS =====

  return { StreebogAlgorithm, StreebogAlgorithmInstance };
}));
