/*
 * Sinople (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The Sinople block cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). 128-bit block (4x32-bit words), 128-bit key.
 * Structure: a 4-branch generalized-Feistel network with 64 rounds, alternating
 * between two distinct round functions F and G in blocks of 16 rounds (F,G,F,G),
 * each keyed by one 32-bit subkey word drawn from a 64-word schedule. Both round
 * functions use two fixed 256-entry x 32-bit S-box tables (S0 for XOR taps, S1 for
 * ADD taps).
 *   F(word0..word3, K): x = word3 XOR K; three bytes are carved out of x via
 *     ROR(x,2)&0xFF, ROR(x,12)&0xFF, ROR(x,22)&0xFF (non-byte-aligned taps), each
 *     looked up in S0/S1; new word0 = ROR(word3,8); new word1 = (S0[b0]^word0)+S1[b0];
 *     new word2 = (word1^S0[b1])+S1[b1]; new word3 = S1[b2]+(word2^S0[b2]).
 *   G(word0..word3, K): a 3-step chained accumulator. Each of word0,word1,word2 is
 *     XORed with K and split into 4 standard little-endian bytes; two S0 and two S1
 *     lookups combine as acc = S0[b0] + (S1[b1] ^ ((S1[b3]^seed) + S0[b2])), where the
 *     first step seeds with word3 and each following step seeds with the previous
 *     accumulator; new word0 = final accumulator, new word1..3 = ROR(word0..2, 8).
 * Key schedule: state is initialized to the 4 key words; for i=0..15 the round
 * function F is self-applied 16 times with constant round key i (state = F(state,i)),
 * and the resulting 4-word state is appended to a flat 64-word subkey array (so the
 * schedule is 256 total self-applications of F with round keys 0..15, snapshotted
 * every 16 iterations).
 * Encryption applies F to rounds 0-15 (keys 0-15), G to rounds 16-31 (keys 16-31),
 * F to rounds 32-47 (keys 32-47), G to rounds 48-63 (keys 48-63). Decryption applies
 * the algebraic inverses of F and G in reverse round/key order.
 * As implemented in the DarkCrypt Total Commander plugin; test vectors verified
 * against the DarkCrypt implementation.
 * 128-bit blocks, 128-bit keys. Educational only.
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
}((function () {
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
          BlockCipherAlgorithm, IBlockCipherInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // S0: fixed XOR-tap S-box (256 x 32-bit).
  const S0 = [
    0x80b26358, 0x6dd6428b, 0xeb18fbf2, 0xcf9a5de5, 0x52338ab4, 0xcba557d0, 0x4f3931d0, 0xeede690c,
    0xe1f810ea, 0xcfc4fc91, 0x62203ec7, 0x7a63c227, 0xedcc58a1, 0x17b62c48, 0x697b6e99, 0x0628dafa,
    0xf0896b35, 0xa71d2cd4, 0xc11a047a, 0x094e3e85, 0x03b2416d, 0xa2d17b44, 0x6ccdbf9e, 0x2a53fc5d,
    0x8417b843, 0xa9ecd2dc, 0x17eafe12, 0x2a2b5d54, 0xc16ed9c1, 0xa042b33f, 0x0c604729, 0xbc933ad5,
    0xe6893738, 0xb7b8835d, 0x7e0ef9c9, 0xb1c65d0d, 0x260a0f19, 0x6f938178, 0x53b0fcf6, 0xe4df5195,
    0x94c6684a, 0x6f826762, 0x66233ef0, 0x11c7d942, 0x452f1a4f, 0x956737ec, 0xa000a714, 0xe9b27390,
    0x03b1b4cb, 0x3bbc8ab6, 0xfd638b6c, 0x4c72922e, 0xd63cd9c5, 0x894e0a97, 0xf19f8ba2, 0xebf0be85,
    0x5e942d64, 0x3081bb34, 0x8e4833fb, 0xf4d9b4d4, 0x2cc15a74, 0xe2c66e50, 0xc6c49908, 0xd522b89b,
    0xe9b7878a, 0x42735a30, 0xafcd72e3, 0x10d4cb7d, 0x56d6ac6f, 0x99bef655, 0x10aea650, 0xe31fbd7e,
    0xb9e27e67, 0x3bdeac10, 0xdcea30c6, 0xde6353ed, 0xd3b1b734, 0xa659954b, 0xc14cf94a, 0xa0d23fb4,
    0x1e95071e, 0xe75e7e5e, 0x08228f01, 0xbcbfbd57, 0x1daf6fda, 0xa782ac71, 0xdb07b735, 0xd8494a42,
    0x78e22620, 0x2a1c2f36, 0x36b74ac2, 0x023e19f3, 0x13f869aa, 0x073ac9b7, 0x7ceda226, 0x4b3ccfa9,
    0x73f827d8, 0xf6792cbe, 0xbe619895, 0x949cf5b0, 0xa95c2b7b, 0x2b545008, 0xaa3402a1, 0xaf404381,
    0xda1f9618, 0x9a609e84, 0xb8f66053, 0xe9d8be6b, 0xa6837c9e, 0x8607f059, 0x8724e9fe, 0x213c444a,
    0xebfe79e0, 0x48d26e03, 0x12962a04, 0x3be911af, 0x7939fae1, 0x82b16e45, 0x3c423037, 0x268f398c,
    0x1df0f347, 0x589c4782, 0xbe740d24, 0xd3380877, 0x4cc46d48, 0x32eefa78, 0x566deeb4, 0xe34e6086,
    0xaef1493d, 0x4eb54cd5, 0x12483a81, 0xe949c57c, 0x5f3cabc7, 0x8390d684, 0xa8caa6c4, 0xa7661ad5,
    0x98ab0a0b, 0xeba59676, 0x1458bfa1, 0x4cb480f6, 0x328c5f4e, 0xe1c6091a, 0x80241b45, 0x37ecedde,
    0xf8e14e67, 0xd49433f3, 0xb99f501c, 0xd7bff7b3, 0xa6c9f2a6, 0x15564174, 0xf6bc04f8, 0x8aad4d9f,
    0x16a6791c, 0xe93979f3, 0x599a4ff2, 0xfa251592, 0x97e81968, 0x38cd3ca4, 0xc1e33a0a, 0xc25660f0,
    0x1c08c7df, 0x4d49df2f, 0x073640b1, 0xca02c608, 0x9a80116d, 0xf7572437, 0x4432e16c, 0x728623f3,
    0x0204492f, 0x8c7800ee, 0xbf6af2b8, 0x98dbcf56, 0x904913be, 0x65a80c7f, 0x91a56f29, 0xd435987e,
    0xb9cdc730, 0x8e5b1d54, 0x6c2634a2, 0x507245b9, 0xfe8cafbb, 0x4e77a150, 0x2ffcc5b6, 0xb6c19a2c,
    0x64f85eed, 0x7f15d598, 0x6ef09636, 0x97916533, 0xafaa3740, 0x5dab99f5, 0xb8ab11aa, 0xc622d751,
    0x2a1557bc, 0x008708ba, 0x27031ffe, 0x83b9ef1e, 0xbf1c6a7d, 0x2ce138dd, 0x7efa96a3, 0xb8b71c5b,
    0x0ad106b9, 0x5ee74ae4, 0x609dd74c, 0x6b48acee, 0xf48da75f, 0xcd69e154, 0x051e6b84, 0xc9e07370,
    0x6e5d66b0, 0x7377951e, 0x994649c9, 0x6e4ee492, 0x42c3e57b, 0x2e8ef724, 0x3b3abda3, 0xbb2604fd,
    0x7b05db98, 0xfad04d47, 0xd0044319, 0xe51a513b, 0xb4a3a92a, 0x3707f460, 0xdc474b4d, 0x4a6f4826,
    0x252bc3c0, 0x30acce91, 0x4c81672c, 0x154d34a7, 0xf1702b0e, 0x4d38fad3, 0x4a567a4f, 0x9e166cba,
    0x5c98810e, 0xc368421c, 0xf3ef9c95, 0xea829a82, 0x5a15cc0f, 0xfa43d06b, 0x3eb40f31, 0x0ded5d04,
    0x1d1688f4, 0x34f16528, 0xe227ea4e, 0x054149e9, 0x4b363315, 0xa7e57e11, 0xd023c2c3, 0x1e66227d,
    0xde2d4df4, 0x178bd0db, 0x8867871e, 0x3e2e2edd, 0x73311581, 0x45319877, 0x5309d50a, 0x342f4780
  ];

  // S1: fixed ADD-tap S-box (256 x 32-bit).
  const S1 = [
    0x2883d2bf, 0x6d06c2ed, 0xbbc0e8a5, 0x9c4d9827, 0x68b6a43a, 0x076eff68, 0xb4674931, 0x06612aec,
    0xaf0fa5ca, 0x10fc9d00, 0x895fa667, 0x2dc393aa, 0x88b11802, 0x75546ce7, 0x52fc7389, 0xf997af66,
    0x599d3371, 0x0c956a19, 0x1f886fc0, 0xa0794e40, 0x859ce835, 0xfb2298ca, 0x669e0cd9, 0x4bbb1508,
    0x66e10d7c, 0xe2e4b233, 0xc2baf581, 0x1d164db4, 0x6d2fde1a, 0x81937b37, 0xf816db18, 0x18e0ea3f,
    0xd5b3b309, 0x956bcd0b, 0x79e534d4, 0x7e3658e1, 0x202a7bb5, 0x3c0be11a, 0xd8d62f12, 0x2023f019,
    0xb1175428, 0xfbfe6fb0, 0xc2c60e8a, 0x354bc57b, 0xef46361f, 0x34335297, 0x5aee0467, 0x51722d58,
    0xe326f5a1, 0x09925b51, 0xabfb8ad6, 0x4dd2ff4a, 0x6b1bbacb, 0x26983e3c, 0xa1fe9c23, 0x264ed763,
    0xac71cb8a, 0xea8b60e2, 0x215310a2, 0x0953a2e7, 0xf5c39182, 0xd2cff017, 0x06ccdc0e, 0xd82e0374,
    0xada63b2a, 0xa6085a77, 0x78ff0870, 0xc7702fe4, 0x102ff069, 0x81e1699a, 0xeb6a743e, 0x5e660919,
    0x0c6f4a7a, 0x8d0012bd, 0x9dd5b86c, 0xc105cafa, 0x867f0164, 0x5e4db6db, 0xa5313f7e, 0x63b9c6bf,
    0x8eeded7a, 0xd3ad269e, 0xb2f8fb02, 0xd2857062, 0xc2494a9e, 0x300793d3, 0xde5255fa, 0xde46a7eb,
    0x5858f5ae, 0x4a3c8fce, 0xed28a880, 0xaad61d82, 0xe20ff8a9, 0x242393ca, 0xc5820824, 0xdf6414f1,
    0x79ba232b, 0x0596efe5, 0x396120d9, 0x601a4815, 0x9ac582dc, 0xbabf0118, 0xfe34192f, 0xe5593c8c,
    0x54ea84bd, 0xc53547cf, 0xc0ae5c68, 0x431ae965, 0xeb115498, 0x1948ef0a, 0x1f8279e8, 0xb5f72ff2,
    0xea57dff3, 0x1142daf3, 0xa4b0be26, 0x93b3a27d, 0x15fb11cd, 0xe0d6f796, 0x5ea177d7, 0x3c139a18,
    0xfac5423d, 0xda49597d, 0xe82d89ad, 0x3a57bc6e, 0x17b0b3d1, 0x619d2bfe, 0xfd61b277, 0x574c816d,
    0x46dc6f92, 0x4d7a4c0e, 0x3cc8baff, 0x2b858527, 0xe3bc64af, 0x4a109ed5, 0xc1aba37b, 0xc5d648c0,
    0x3904c4d5, 0x93445aa9, 0xec4ac530, 0x8b03c194, 0x7298f3f6, 0xf8909a4b, 0xf525eb3c, 0x2abd869d,
    0x08edc0e9, 0xda573ee7, 0x37666622, 0xa7e20c56, 0xc994d1ac, 0x69535c5c, 0x0a0710fe, 0x13d87044,
    0x061120a6, 0x64102f2a, 0xde22822c, 0x0802a5e5, 0x3b19469b, 0x3796a3ae, 0xdc42075a, 0x10e57116,
    0x8907e58e, 0xc76cdaed, 0xe0927227, 0x5eeda39e, 0xdb1cca20, 0x63cd9997, 0x90ec41f5, 0xafb34d94,
    0x456a307d, 0x6f53d57b, 0xa955188a, 0x8913347d, 0xdd6befa9, 0xaf3d8cfe, 0x0023fa7b, 0x38d51e00,
    0xea1f855e, 0x9bd57db5, 0x08fbc88a, 0x1cee0768, 0xf8011ebc, 0x72501e9b, 0x4887c627, 0xf6bda3eb,
    0xd384806c, 0x121e9877, 0x70f35da2, 0xdb855ea1, 0xc1f52a04, 0xdb22405e, 0x164f743a, 0x75ea9507,
    0x4ac97165, 0x15fc4d76, 0x86733df9, 0xa20af90d, 0x4438daf5, 0x03ecc5b8, 0xa6c1d612, 0x5d2806f0,
    0xcf27017d, 0x66c8f507, 0x5dcfcec4, 0xe49c07ed, 0x7731d6fe, 0xdfb0c97d, 0x9f4dedde, 0xb5d6e1bd,
    0xe0459143, 0x33cfbd3e, 0x3fd167b3, 0xb354495d, 0x9130d7f1, 0xab2afbe7, 0x02bc3a4b, 0xf6d4cfde,
    0x348bfa55, 0x15bbdb33, 0x521cf5d3, 0x47370bc3, 0xadf2d9dd, 0xd0645e4b, 0xb5be9aa2, 0x489e29cd,
    0x0fbb638b, 0x8893f72d, 0x90a682ae, 0x49673a37, 0xbac5b7b2, 0x36aaab91, 0x1ee872c0, 0x644596fa,
    0x6df2b10e, 0xdaa4658e, 0x000d3505, 0xa834a026, 0xb0a5b244, 0x4e40f345, 0xb2ee8bf6, 0x294992f4,
    0xf8d0e4f0, 0x948b9b86, 0x633ab27f, 0x8e085752, 0x1432a534, 0x916b9416, 0x5c26e12b, 0xe979e9c1,
    0x813484c2, 0x4eee8d41, 0xb47f0a94, 0xf0202f42, 0xb50f26b9, 0xf34c1f05, 0x6669bc56, 0x3041fe77
  ];

  const ROUNDS = 64;

  class DarkCryptSinopleAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Sinople (DarkCrypt)";
      this.description = "128-bit block, 128-bit key cipher from the DarkCrypt Total Commander plugin. 4-branch generalized Feistel network, 64 rounds alternating two S-box-based round functions (F, G) in blocks of 16.";
      this.inventor = "Alexander Myasnikov (DarkCrypt \"Zarya\" project)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];   // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed proprietary design", "Custom cipher bundled with a closed-source plugin; no public cryptanalysis exists.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Sinople — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("af42853eb08e593fe31ac3b2c69c762b")
        },
        {
          text: "DarkCrypt Sinople — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("c98474b5908773ba772b3cece5700eeb")
        },
        {
          text: "DarkCrypt Sinople — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("552ed4407de60e0c9d9f16e18a546f21")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptSinopleInstance(this, isInverse);
    }
  }

  class DarkCryptSinopleInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._KS = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._KS = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Sinople (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._KS = this._buildSchedule(this._key);
    }

    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % this.BlockSize !== 0)
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    // Round function F: keys the last word (word3); the new word0 is a rotate of the
    // old word3, and three S-box-derived taps (non-byte-aligned rotate offsets 2/12/22)
    // feed words 0,1,2 into the new words 1,2,3.
    _F(state, K) {
      const w0 = state[0], w1 = state[1], w2 = state[2], w3 = state[3];
      const x = OpCodes.Xor32(w3, K);
      const b0 = OpCodes.And32(OpCodes.RotR32(x, 2), 0xFF);
      const b1 = OpCodes.And32(OpCodes.RotR32(x, 12), 0xFF);
      const b2 = OpCodes.And32(OpCodes.RotR32(x, 22), 0xFF);
      const t0a = S0[b0], t0b = S1[b0];
      const t1a = S0[b1], t1b = S1[b1];
      const t2a = S0[b2], t2b = S1[b2];
      return [
        OpCodes.RotR32(w3, 8),
        OpCodes.Add32(OpCodes.Xor32(t0a, w0), t0b),
        OpCodes.Add32(OpCodes.Xor32(w1, t1a), t1b),
        OpCodes.Add32(t2b, OpCodes.Xor32(w2, t2a))
      ];
    }

    // Algebraic inverse of _F.
    _invF(state, K) {
      const o0 = state[0], o1 = state[1], o2 = state[2], o3 = state[3];
      const w3 = OpCodes.RotL32(o0, 8);
      const x = OpCodes.Xor32(w3, K);
      const b0 = OpCodes.And32(OpCodes.RotR32(x, 2), 0xFF);
      const b1 = OpCodes.And32(OpCodes.RotR32(x, 12), 0xFF);
      const b2 = OpCodes.And32(OpCodes.RotR32(x, 22), 0xFF);
      const t0a = S0[b0], t0b = S1[b0];
      const t1a = S0[b1], t1b = S1[b1];
      const t2a = S0[b2], t2b = S1[b2];
      return [
        OpCodes.Xor32(OpCodes.Sub32(o1, t0b), t0a),
        OpCodes.Xor32(OpCodes.Sub32(o2, t1b), t1a),
        OpCodes.Xor32(OpCodes.Sub32(o3, t2b), t2a),
        w3
      ];
    }

    // Single chained-accumulator step used by G/invG: standard little-endian byte
    // decomposition of (w XOR K), two S0 taps and two S1 taps, mixed with a seed.
    _step(w, K, seed) {
      const x = OpCodes.Xor32(w, K);
      const b0 = OpCodes.And32(x, 0xFF);
      const t0 = S0[b0];
      const x1 = OpCodes.RotR32(x, 8);
      const b1 = OpCodes.And32(x1, 0xFF);
      const t1 = S1[b1];
      const x2 = OpCodes.RotR32(x1, 8);
      const b2 = OpCodes.And32(x2, 0xFF);
      const t2 = S0[b2];
      const x3 = OpCodes.RotR32(x2, 8);
      const b3 = OpCodes.And32(x3, 0xFF);
      const t3 = S1[b3];
      return OpCodes.Add32(t0, OpCodes.Xor32(t1, OpCodes.Add32(OpCodes.Xor32(t3, seed), t2)));
    }

    _unstep(w, K, out) {
      const x = OpCodes.Xor32(w, K);
      const b0 = OpCodes.And32(x, 0xFF);
      const t0 = S0[b0];
      const x1 = OpCodes.RotR32(x, 8);
      const b1 = OpCodes.And32(x1, 0xFF);
      const t1 = S1[b1];
      const x2 = OpCodes.RotR32(x1, 8);
      const b2 = OpCodes.And32(x2, 0xFF);
      const t2 = S0[b2];
      const x3 = OpCodes.RotR32(x2, 8);
      const b3 = OpCodes.And32(x3, 0xFF);
      const t3 = S1[b3];
      return OpCodes.Xor32(t3, OpCodes.Sub32(OpCodes.Xor32(OpCodes.Sub32(out, t0), t1), t2));
    }

    // Round function G: a 3-step chained accumulator over words 0,1,2 (seeded by word3)
    // becomes the new word0; words 0,1,2 rotate down (with an 8-bit rotate) into 1,2,3.
    _G(state, K) {
      const w0 = state[0], w1 = state[1], w2 = state[2], w3 = state[3];
      let acc = this._step(w0, K, w3);
      acc = this._step(w1, K, acc);
      acc = this._step(w2, K, acc);
      return [acc, OpCodes.RotR32(w0, 8), OpCodes.RotR32(w1, 8), OpCodes.RotR32(w2, 8)];
    }

    // Algebraic inverse of _G.
    _invG(state, K) {
      const o0 = state[0], o1 = state[1], o2 = state[2], o3 = state[3];
      const w0 = OpCodes.RotL32(o1, 8);
      const w1 = OpCodes.RotL32(o2, 8);
      const w2 = OpCodes.RotL32(o3, 8);
      const acc2 = this._unstep(w2, K, o0);
      const acc1 = this._unstep(w1, K, acc2);
      const w3 = this._unstep(w0, K, acc1);
      return [w0, w1, w2, w3];
    }

    // Key schedule: starting from the 4 key words, F is self-applied 16 times per
    // outer round (constant round key i = 0..15), snapshotting the resulting 4-word
    // state into a flat 64-word subkey array after each batch of 16 self-applications.
    _buildSchedule(keyBytes) {
      let state = [
        OpCodes.Pack32LE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
        OpCodes.Pack32LE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
        OpCodes.Pack32LE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
        OpCodes.Pack32LE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
      ];
      const KS = new Array(ROUNDS);
      let idx = 0;
      for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 16; j++) state = this._F(state, i);
        KS[idx++] = state[0];
        KS[idx++] = state[1];
        KS[idx++] = state[2];
        KS[idx++] = state[3];
      }
      return KS;
    }

    _encryptBlock(block) {
      let state = [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
      ];
      const KS = this._KS;
      for (let r = 0; r < 16; r++) state = this._F(state, KS[r]);
      for (let r = 16; r < 32; r++) state = this._G(state, KS[r]);
      for (let r = 32; r < 48; r++) state = this._F(state, KS[r]);
      for (let r = 48; r < 64; r++) state = this._G(state, KS[r]);
      return [
        ...OpCodes.Unpack32LE(state[0]), ...OpCodes.Unpack32LE(state[1]),
        ...OpCodes.Unpack32LE(state[2]), ...OpCodes.Unpack32LE(state[3])
      ];
    }

    _decryptBlock(block) {
      let state = [
        OpCodes.Pack32LE(block[0], block[1], block[2], block[3]),
        OpCodes.Pack32LE(block[4], block[5], block[6], block[7]),
        OpCodes.Pack32LE(block[8], block[9], block[10], block[11]),
        OpCodes.Pack32LE(block[12], block[13], block[14], block[15])
      ];
      const KS = this._KS;
      for (let r = 63; r >= 48; r--) state = this._invG(state, KS[r]);
      for (let r = 47; r >= 32; r--) state = this._invF(state, KS[r]);
      for (let r = 31; r >= 16; r--) state = this._invG(state, KS[r]);
      for (let r = 15; r >= 0; r--) state = this._invF(state, KS[r]);
      return [
        ...OpCodes.Unpack32LE(state[0]), ...OpCodes.Unpack32LE(state[1]),
        ...OpCodes.Unpack32LE(state[2]), ...OpCodes.Unpack32LE(state[3])
      ];
    }
  }

  const algorithmInstance = new DarkCryptSinopleAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSinopleAlgorithm, DarkCryptSinopleInstance };
}));
