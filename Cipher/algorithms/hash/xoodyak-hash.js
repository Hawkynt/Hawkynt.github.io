/*
 * Xoodyak Hash - NIST Lightweight Cryptography Finalist
 * Professional implementation following NIST LWC specification
 * (c)2006-2025 Hawkynt
 *
 * Xoodyak is a cryptographic scheme based on the Xoodoo permutation, selected as a NIST LWC finalist.
 * This implementation provides the hash mode with 256-bit output.
 * Reference: https://csrc.nist.gov/Projects/lightweight-cryptography/finalists
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem } = AlgorithmFramework;

  // Xoodoo round constants
  const RC = [
    0x00000058, 0x00000038, 0x000003C0, 0x000000D0, 0x00000120,
    0x00000014, 0x00000060, 0x0000002C, 0x00000380, 0x000000F0,
    0x000001A0, 0x00000012
  ];

  const MAXROUNDS = 12;
  const STATE_SIZE = 48;   // 48 bytes = 384 bits = 12 x 32-bit words
  const RABSORB = 16;      // Absorption rate: 16 bytes
  const TAGLEN = 16;       // Tag length for intermediate squeeze

  /**
   * Xoodoo permutation function
   * @param {Array<number>} state - 48-byte state array
   */
  function xoodooPermutation(state) {
    // Unpack state into 12 x 32-bit words (little-endian)
    let a0 = OpCodes.Pack32LE(state[0], state[1], state[2], state[3]);
    let a1 = OpCodes.Pack32LE(state[4], state[5], state[6], state[7]);
    let a2 = OpCodes.Pack32LE(state[8], state[9], state[10], state[11]);
    let a3 = OpCodes.Pack32LE(state[12], state[13], state[14], state[15]);
    let a4 = OpCodes.Pack32LE(state[16], state[17], state[18], state[19]);
    let a5 = OpCodes.Pack32LE(state[20], state[21], state[22], state[23]);
    let a6 = OpCodes.Pack32LE(state[24], state[25], state[26], state[27]);
    let a7 = OpCodes.Pack32LE(state[28], state[29], state[30], state[31]);
    let a8 = OpCodes.Pack32LE(state[32], state[33], state[34], state[35]);
    let a9 = OpCodes.Pack32LE(state[36], state[37], state[38], state[39]);
    let a10 = OpCodes.Pack32LE(state[40], state[41], state[42], state[43]);
    let a11 = OpCodes.Pack32LE(state[44], state[45], state[46], state[47]);

    for (let i = 0; i < MAXROUNDS; ++i) {
      // Theta: Column Parity Mixer
      const p0 = a0^a4^a8;
      const p1 = a1^a5^a9;
      const p2 = a2^a6^a10;
      const p3 = a3^a7^a11;

      const e0 = OpCodes.RotL32(p3, 5)^OpCodes.RotL32(p3, 14);
      const e1 = OpCodes.RotL32(p0, 5)^OpCodes.RotL32(p0, 14);
      const e2 = OpCodes.RotL32(p1, 5)^OpCodes.RotL32(p1, 14);
      const e3 = OpCodes.RotL32(p2, 5)^OpCodes.RotL32(p2, 14);

      a0 ^= e0;
      a4 ^= e0;
      a8 ^= e0;

      a1 ^= e1;
      a5 ^= e1;
      a9 ^= e1;

      a2 ^= e2;
      a6 ^= e2;
      a10 ^= e2;

      a3 ^= e3;
      a7 ^= e3;
      a11 ^= e3;

      // Rho-west: plane shift
      let b0 = a0;
      let b1 = a1;
      let b2 = a2;
      let b3 = a3;

      let b4 = a7;
      let b5 = a4;
      let b6 = a5;
      let b7 = a6;

      let b8 = OpCodes.RotL32(a8, 11);
      let b9 = OpCodes.RotL32(a9, 11);
      let b10 = OpCodes.RotL32(a10, 11);
      let b11 = OpCodes.RotL32(a11, 11);

      // Iota: round constant
      b0 ^= RC[i];

      // Chi: non-linear layer
      a0 = b0^(~b4&b8);
      a1 = b1^(~b5&b9);
      a2 = b2^(~b6&b10);
      a3 = b3^(~b7&b11);

      a4 = b4^(~b8&b0);
      a5 = b5^(~b9&b1);
      a6 = b6^(~b10&b2);
      a7 = b7^(~b11&b3);

      b8 ^= (~b0&b4);
      b9 ^= (~b1&b5);
      b10 ^= (~b2&b6);
      b11 ^= (~b3&b7);

      // Rho-east: plane shift
      a4 = OpCodes.RotL32(a4, 1);
      a5 = OpCodes.RotL32(a5, 1);
      a6 = OpCodes.RotL32(a6, 1);
      a7 = OpCodes.RotL32(a7, 1);

      a8 = OpCodes.RotL32(b10, 8);
      a9 = OpCodes.RotL32(b11, 8);
      a10 = OpCodes.RotL32(b8, 8);
      a11 = OpCodes.RotL32(b9, 8);
    }

    // Pack results back into state (little-endian)
    const bytes0 = OpCodes.Unpack32LE(a0);
    const bytes1 = OpCodes.Unpack32LE(a1);
    const bytes2 = OpCodes.Unpack32LE(a2);
    const bytes3 = OpCodes.Unpack32LE(a3);
    const bytes4 = OpCodes.Unpack32LE(a4);
    const bytes5 = OpCodes.Unpack32LE(a5);
    const bytes6 = OpCodes.Unpack32LE(a6);
    const bytes7 = OpCodes.Unpack32LE(a7);
    const bytes8 = OpCodes.Unpack32LE(a8);
    const bytes9 = OpCodes.Unpack32LE(a9);
    const bytes10 = OpCodes.Unpack32LE(a10);
    const bytes11 = OpCodes.Unpack32LE(a11);

    state[0] = bytes0[0]; state[1] = bytes0[1]; state[2] = bytes0[2]; state[3] = bytes0[3];
    state[4] = bytes1[0]; state[5] = bytes1[1]; state[6] = bytes1[2]; state[7] = bytes1[3];
    state[8] = bytes2[0]; state[9] = bytes2[1]; state[10] = bytes2[2]; state[11] = bytes2[3];
    state[12] = bytes3[0]; state[13] = bytes3[1]; state[14] = bytes3[2]; state[15] = bytes3[3];
    state[16] = bytes4[0]; state[17] = bytes4[1]; state[18] = bytes4[2]; state[19] = bytes4[3];
    state[20] = bytes5[0]; state[21] = bytes5[1]; state[22] = bytes5[2]; state[23] = bytes5[3];
    state[24] = bytes6[0]; state[25] = bytes6[1]; state[26] = bytes6[2]; state[27] = bytes6[3];
    state[28] = bytes7[0]; state[29] = bytes7[1]; state[30] = bytes7[2]; state[31] = bytes7[3];
    state[32] = bytes8[0]; state[33] = bytes8[1]; state[34] = bytes8[2]; state[35] = bytes8[3];
    state[36] = bytes9[0]; state[37] = bytes9[1]; state[38] = bytes9[2]; state[39] = bytes9[3];
    state[40] = bytes10[0]; state[41] = bytes10[1]; state[42] = bytes10[2]; state[43] = bytes10[3];
    state[44] = bytes11[0]; state[45] = bytes11[1]; state[46] = bytes11[2]; state[47] = bytes11[3];
  }

  class XoodyakHash extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "Xoodyak Hash";
      this.description = "NIST Lightweight Cryptography finalist based on the Xoodoo permutation. Designed for resource-constrained environments with strong security properties.";
      this.inventor = "Joan Daemen, Seth Hoffert, Michaël Peeters, Gilles Van Assche, Ronny Van Keer";
      this.year = 2019;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [{ minSize: 32, maxSize: 32, stepSize: 1 }];

      this.documentation = [
        new LinkItem(
          "NIST LWC Finalist",
          "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists"
        ),
        new LinkItem(
          "Xoodyak Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/xoodyak-spec-final.pdf"
        ),
        new LinkItem(
          "Xoodoo Permutation",
          "https://eprint.iacr.org/2018/767.pdf"
        )
      ];

      // Official NIST LWC test vectors
      this.tests = [
        {
          text: "Xoodyak Hash: empty message (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("EA152F2B47BCE24EFB66C479D4ADF17BD324D806E85FF75EE369EE50DC8F8BD1")
        },
        {
          text: "Xoodyak Hash: 0x00 (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("27921F8DDF392894460B70B3ED6C091E6421B7D2147DCD6031D7EFEBAD3030CC")
        },
        {
          text: "Xoodyak Hash: 0x0001 (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("DD3F12E89DB41C61D3C05779705FA946A8C69C79EEFDC1B4A966A5F1AB35073D")
        },
        {
          text: "Xoodyak Hash: 0x000102 (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("000102"),
          expected: OpCodes.Hex8ToBytes("72ABD350DC287E8C4B95DD37BD796D79F90026C1BD4E0D99D2117BAAB26BC2CA")
        },
        {
          text: "Xoodyak Hash: 0x00010203 (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("00010203"),
          expected: OpCodes.Hex8ToBytes("A13AE46F62E433CE4CAD9E4F24C46F37B6B3815C8539A3659DAAECAAE1AB8FDB")
        },
        {
          text: "Xoodyak Hash: 0x0001020304 (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("0001020304"),
          expected: OpCodes.Hex8ToBytes("042383068C131A0D365B781DFCB20E855F4A68DE2072AA8D1E16181563D6F622")
        },
        {
          text: "Xoodyak Hash: 0x000102030405060708 (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("000102030405060708"),
          expected: OpCodes.Hex8ToBytes("D926F7E44B263CBA8F98E2A52B7BE175D406A2E81B462408BDBC408784C4284F")
        },
        {
          text: "Xoodyak Hash: 0x000102030405060708090A0B0C0D0E0F (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("9EA695347CDDDFF9BC63ECE30FE231441D581768FE223DD6BD7367094FD216B3")
        },
        {
          text: "Xoodyak Hash: 0x000102030405060708090A0B0C0D0E0F10111213 (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F10111213"),
          expected: OpCodes.Hex8ToBytes("9BEBE7579EC1D075B6768AE981C54C7D60DB82931B074A618B0A68F84CBCCFE6")
        },
        {
          text: "Xoodyak Hash: 32-byte message (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("CEBE4AFF9EAC2218017DDA5F8207BA830E989187256539BD7D31AE5E94FF0C6E")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new XoodyakHashInstance(this);
    }
  }

  class XoodyakHashInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // Initialize state: 48 bytes, all zeros
      this.state = new Array(STATE_SIZE).fill(0);

      // Mode tracking: 0=INIT_ABSORB, 1=ABSORB, 2=SQUEEZE
      this.mode = 0; // INIT_ABSORB
      this.count = 0; // Position in current block
    }

    /**
     * Absorb data into the hash state
     */
    Feed(data) {
      if (!data || data.length === 0) return;

      let inPos = 0;
      let inlen = data.length;

      // If we were squeezing, restart absorb phase
      if (this.mode === 2) { // SQUEEZE
        xoodooPermutation(this.state);
        this.mode = 0; // INIT_ABSORB
        this.count = 0;
      }

      // First block gets domain 0x01, subsequent blocks get 0x00
      let domain = (this.mode === 0) ? 0x01 : 0x00; // INIT_ABSORB : ABSORB

      // Absorb input data into state
      while (inlen > 0) {
        if (this.count >= RABSORB) {
          // Block is full - apply padding and domain separation
          this.state[RABSORB] ^= 0x01;          // Padding at rate position
          this.state[STATE_SIZE - 1] ^= domain;  // Domain at last byte
          xoodooPermutation(this.state);
          this.mode = 1; // ABSORB
          this.count = 0;
          domain = 0x00;
        }

        // Absorb as much as possible into current block
        const temp = Math.min(RABSORB - this.count, inlen);
        for (let i = 0; i < temp; i++) {
          this.state[this.count + i] ^= data[inPos + i];
        }
        this.count += temp;
        inPos += temp;
        inlen -= temp;
      }
    }

    /**
     * Finalize and produce hash output
     */
    Result() {
      // If we were absorbing, terminate the absorb phase
      if (this.mode !== 2) { // Not SQUEEZE
        const domain = (this.mode === 0) ? 0x01 : 0x00; // INIT_ABSORB : ABSORB
        this.state[this.count] ^= 0x01;          // Padding at current position
        this.state[STATE_SIZE - 1] ^= domain;     // Domain at last byte
        xoodooPermutation(this.state);
        this.mode = 2; // SQUEEZE
        this.count = 0;
      }

      // Squeeze out 32 bytes (256 bits)
      const output = [];
      let outlen = 32;

      while (outlen > 0) {
        if (this.count >= RABSORB) {
          // Need more data - apply padding and permute
          // Padding at index 0 for subsequent squeeze blocks
          this.state[0] ^= 0x01;
          xoodooPermutation(this.state);
          this.count = 0;
        }

        const temp = Math.min(RABSORB - this.count, outlen);
        for (let i = 0; i < temp; i++) {
          output.push(this.state[this.count + i]);
        }
        this.count += temp;
        outlen -= temp;
      }

      // Reset for next operation
      this.state = new Array(STATE_SIZE).fill(0);
      this.mode = 0; // INIT_ABSORB
      this.count = 0;

      return output;
    }
  }

  RegisterAlgorithm(new XoodyakHash());
  return XoodyakHash;
}));
