/*
 * SNOW 2.0 (DarkCrypt) Stream Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SNOW 2.0 (Ekdahl & Johansson, 2002) as implemented in the DarkCrypt Total
 * Commander plugin (Alexander Myasnikov, "Zarya" project). The 16-word LFSR
 * over GF(2^32) (feedback taps s0, s2, s11 combined via multiplication/
 * division by the field element alpha), the two-register finite state
 * machine (whose non-linear function S(w) is one AES round -- SubBytes +
 * MixColumns -- applied to a single 32-bit word), the 256-bit key loading
 * (s_i = ~k_(7-i) for i=0..7, s_(8+i) = k_(7-i) for i=0..7, all words
 * big-endian) and the 128-bit IV folding (XORed into s9, s10, s12, s15) are
 * all bit-exact to the published SNOW 2.0 specification. The
 * alpha-multiplication/division tables are embedded verbatim as data
 * constants; the FSM diffusion table is derived from the standard AES
 * S-box at load time.
 *
 * This DarkCrypt build differs from the published specification in two
 * ways:
 *
 * 1. Each keystream call XORs precisely 64 hardcoded bytes (16 keystream
 *    words) into the buffer, rather than an arbitrary caller-supplied
 *    length.
 * 2. The key schedule always runs in 256-bit mode, matching the plugin's
 *    "Snow2 (256 bit)" listing. Also, exactly ONE generation-mode clock's
 *    output is discarded immediately after the 32-round key/IV warm-up
 *    before the real keystream begins (i.e. the first output starts at
 *    generation-clock index 1, not index 0); this deviation was determined
 *    empirically by comparing against the DarkCrypt implementation's own
 *    output and is preserved here to remain bit-exact with it.
 *
 * IV folding (s9/s10/s12/s15) was validated against the DarkCrypt
 * implementation using an all-zero IV; non-zero-IV behavior follows the
 * same data flow but has not been independently confirmed.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  const KEY_LEN = 32; // 256-bit key only (the DarkCrypt implementation hardcodes the 256-bit key schedule)
  const IV_LEN = 16;  // 128-bit IV
  const WARMUP_CLOCKS = 32;

  // Standard AES S-box (used to build the SNOW 2.0 FSM's non-linear function S(w))
  const SBOX = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
  ];

  // GF(2^32) multiplication-by-alpha (MULA_TABLE) and division-by-alpha (DIVA_TABLE) tables
  // for the SNOW 2.0 LFSR, embedded verbatim as data constants (256 32-bit entries each),
  // as used by the DarkCrypt implementation.
  const MULA_TABLE = OpCodes.Hex32ToDWords(
      "00000000e19fcf136b9737268a08f835d6876e4c3718a15fbd10596a5c8f967905a7dc98e438138b6e30ebbe8faf24ad" +
      "d320b2d432bf7dc7b8b785f259284ae10ae71199eb78de8a617026bf80efe9acdc607fd53dffb0c6b7f748f3566887e0" +
      "0f40cd01eedf021264d7fa2785483534d9c7a34d38586c5eb250946b53cf5b781467229bf5f8ed887ff015bd9e6fdaae" +
      "c2e04cd7237f83c4a9777bf148e8b4e211c0fe03f05f31107a57c9259bc80636c747904f26d85f5cacd0a7694d4f687a" +
      "1e803302ff1ffc11751704249488cb37c8075d4e2998925da3906a68420fa57b1b27ef9afab8208970b0d8bc912f17af" +
      "cda081d62c3f4ec5a637b6f047a879e328ce449fc9518b8c435973b9a2c6bcaafe492ad31fd6e5c095de1df57441d2e6" +
      "2d699807ccf6571446feaf21a7616032fbeef64b1a7139589079c16d71e60e7e22295506c3b69a1549be6220a821ad33" +
      "f4ae3b4a1531f4599f390c6c7ea6c37f278e899ec611468d4c19beb8ad8671abf109e7d2109628c19a9ed0f47b011fe7" +
      "3ca96604dd36a917573e5122b6a19e31ea2e08480bb1c75b81b93f6e6026f07d390eba9cd891758f52998dbab30642a9" +
      "ef89d4d00e161bc3841ee3f665812ce5364e779dd7d1b88e5dd940bbbc468fa8e0c919d10156d6c28b5e2ef76ac1e1e4" +
      "33e9ab05d2766416587e9c23b9e15330e56ec54904f10a5a8ef9f26f6f663d7c50358897b1aa47843ba2bfb1da3d70a2" +
      "86b2e6db672d29c8ed25d1fd0cba1eee5592540fb40d9b1c3e056329df9aac3a83153a43628af550e8820d65091dc276" +
      "5ad2990ebb4d561d3145ae28d0da613b8c55f7426dca3851e7c2c064065d0f775f754596beea8a8534e272b0d57dbda3" +
      "89f22bda686de4c9e2651cfc03fad3ef4452aa0ca5cd651f2fc59d2ace5a523992d5c440734a0b53f942f36618dd3c75" +
      "41f57694a06ab9872a6241b2cbfd8ea1977218d876edd7cbfce52ffe1d7ae0ed4eb5bb95af2a748625228cb3c4bd43a0" +
      "9832d5d979ad1acaf3a5e2ff123a2dec4b12670daa8da81e2085502bc11a9f389d9509417c0ac652f6023e67179df174" +
      "78fbcc089964031b136cfb2ef2f3343dae7ca2444fe36d57c5eb956224745a717d5c10909cc3df8316cb27b6f754e8a5" +
      "abdb7edc4a44b1cfc04c49fa21d386e9721cdd9193831282198beab7f81425a4a49bb3dd45047ccecf0c84fb2e934be8" +
      "77bb01099624ce1a1c2c362ffdb3f93ca13c6f4540a3a056caab58632b3497706c9cee938d032180070bd9b5e69416a6" +
      "ba1b80df5b844fccd18cb7f9301378ea693b320b88a4fd1802ac052de333ca3ebfbc5c475e239354d42b6b6135b4a472" +
      "667bff0a87e430190decc82cec73073fb0fc914651635e55db6ba6603af4697363dc23928243ec81084b14b4e9d4dba7" +
      "b55b4dde54c482cddecc7af83f53b5eb"
  );

  const DIVA_TABLE = OpCodes.Hex32ToDWords(
      "00000000180f40cd301e80332811c0fe603ca9667833e9ab50222955482d6998c078fbccd877bb01f0667bffe8693b32" +
      "a04452aab84b1267905ad2998855925429f05f3131ff1ffc19eedf0201e19fcf49ccf65751c3b69a79d2766461dd36a9" +
      "e988a4fdf187e430d99624cec199640389b40d9b91bb4d56b9aa8da8a1a5cd655249be624a46feaf62573e517a587e9c" +
      "327517042a7a57c9026b97371a64d7fa923145ae8a3e0563a22fc59dba208550f20decc8ea02ac05c2136cfbda1c2c36" +
      "7bb9e15363b6a19e4ba7616053a821ad1b854835038a08f82b9bc806339488cbbbc11a9fa3ce5a528bdf9aac93d0da61" +
      "dbfdb3f9c3f2f334ebe333caf3ec7307a492d5c4bc9d9509948c55f78c83153ac4ae7ca2dca13c6ff4b0fc91ecbfbc5c" +
      "64ea2e087ce56ec554f4ae3b4cfbeef604d6876e1cd9c7a334c8075d2cc747908d628af5956dca38bd7c0ac6a5734a0b" +
      "ed5e2393f551635edd40a3a0c54fe36d4d1a7139551531f47d04f10a650bb1c72d26d85f352998921d38586c053718a1" +
      "f6db6ba6eed42b6bc6c5eb95decaab5896e7c2c08ee8820da6f942f3bef6023e36a3906a2eacd0a706bd10591eb25094" +
      "569f390c4e9079c16681b93f7e8ef9f2df2b3497c724745aef35b4a4f73af469bf179df1a718dd3c8f091dc297065d0f" +
      "1f53cf5b075c8f962f4d4f6837420fa57f6f663d676026f04f71e60e577ea6c3e18d0321f98243ecd1938312c99cc3df" +
      "81b1aa4799beea8ab1af2a74a9a06ab921f5f8ed39fab82011eb78de09e4381341c9518b59c6114671d7d1b869d89175" +
      "c87d5c10d0721cddf863dc23e06c9ceea841f576b04eb5bb985f7545805035880805a7dc100ae711381b27ef20146722" +
      "68390eba70364e7758278e894028ce44b3c4bd43abcbfd8e83da3d709bd57dbdd3f81425cbf754e8e3e69416fbe9d4db" +
      "73bc468f6bb3064243a2c6bc5bad86711380efe90b8faf24239e6fda3b912f179a34e272823ba2bfaa2a6241b225228c" +
      "fa084b14e2070bd9ca16cb27d2198bea5a4c19be424359736a52998d725dd9403a70b0d8227ff0150a6e30eb12617026" +
      "451fd6e55d109628750156d66d0e161b25237f833d2c3f4e153dffb00d32bf7d85672d299d686de4b579ad1aad76edd7" +
      "e55b844ffd54c482d545047ccd4a44b16cef89d474e0c9195cf109e744fe492a0cd320b214dc607f3ccda08124c2e04c" +
      "ac977218b49832d59c89f22b8486b2e6ccabdb7ed4a49bb3fcb55b4de4ba1b80175668870f59284a2748e8b43f47a879" +
      "776ac1e16f65812c477441d25f7b011fd72e934bcf21d386e7301378ff3f53b5b7123a2daf1d7ae0870cba1e9f03fad3" +
      "3ea637b626a9777b0eb8b78516b7f7485e9a9ed04695de1d6e841ee3768b5e2efedecc7ae6d18cb7cec04c49d6cf0c84" +
      "9ee2651c86ed25d1aefce52fb6f3a5e2"
  );

  // AES round T-table (Te0), derived from the standard AES S-box:
  // TE0[x] = (2*S[x]) | (S[x]<<8) | (S[x]<<16) | (3*S[x]<<24)   (little-endian byte packing)
  function gfMul2(x) { return OpCodes.And32(OpCodes.Xor32(OpCodes.Shl32(x, 1), (OpCodes.And32(x, 0x80) ? 0x1B : 0)), 0xFF); }
  function gfMul3(x) { return OpCodes.Xor32(gfMul2(x), x); }
  const TE0 = new Array(256);
  for (let x = 0; x < 256; x++) {
    const s = SBOX[x];
    TE0[x] = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(gfMul3(s), 24), OpCodes.Shl32(s, 16)), OpCodes.Shl32(s, 8)), gfMul2(s));
  }

  // SNOW 2.0 FSM non-linear function: one AES round (SubBytes+MixColumns) on a 32-bit word.
  function sBoxWord(w) {
    const b0 = OpCodes.And32(w, 0xFF), b1 = OpCodes.And32(OpCodes.Shr32(w, 8), 0xFF), b2 = OpCodes.And32(OpCodes.Shr32(w, 16), 0xFF), b3 = OpCodes.And32(OpCodes.Shr32(w, 24), 0xFF);
    return OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(TE0[b0], OpCodes.RotL32(TE0[b1], 8)), OpCodes.RotL32(TE0[b2], 16)), OpCodes.RotL32(TE0[b3], 24));
  }

  function mulAlpha(x) { return OpCodes.Xor32(OpCodes.Shl32(x, 8), MULA_TABLE[OpCodes.Shr32(x, 24)]); }
  function divAlpha(x) { return OpCodes.Xor32(OpCodes.Shr32(x, 8), DIVA_TABLE[OpCodes.And32(x, 0xFF)]); }

  class DarkCryptSnow2Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "SNOW 2.0 (DarkCrypt)";
      this.description = "Ekdahl and Johansson's SNOW 2.0 stream cipher (16-word GF(2^32) LFSR + AES-S-box-based FSM), as implemented in the DarkCrypt Total Commander plugin's 256-bit-key-only build. The algorithm core is bit-exact to the published SNOW 2.0 specification.";
      this.inventor = "Patrik Ekdahl, Thomas Johansson (base design); DarkCrypt port by Alexander Myasnikov";
      this.year = 2002;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.SE;

      this.SupportedKeySizes = [new KeySize(KEY_LEN, KEY_LEN, 0)];   // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("SNOW 2.0 specification (Ekdahl and Johansson)", "https://www.ecrypt.eu.org/stream/p3ciphers/snow/snow2.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Distinguishing attacks", "SNOW 2.0 has known distinguishing attacks with complexity below exhaustive search in academic literature; superseded by SNOW 3G / SNOW-V for production use.", "Use a vetted, currently-recommended stream cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation (setup(key,iv) then crypt() XOR,
      // in fixed 64-byte blocks -- see file header).
      this.tests = [
        {
          text: "DarkCrypt Snow2 — keystream from incrementing key, zero IV, zero input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("7aa40e9615aed53d3a69c1ddc2912a1a86dafe5c0432ac08956837bd05ab20091989294a98d23cf63531e62ae1873175524a2f14ce103ae166ab132c435767efe875062bddf190d760d4c635ffaffd360f399c3c4f2df769d1590f74f034917aa0db223318e74778f9181a8e0c893c6159191db89f5ffd40293fbc8cba6a39b1")
        },
        {
          text: "DarkCrypt Snow2 — incrementing key/plaintext, zero IV",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("7aa50c9511abd33a3260cbd6ce9c241596cbec4f1027ba1f8d712da619b63e1639a80b69bcf71ad11d18cc01cdaa1f5a627b1d27fa250cd65e9229177f6a59d0")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptSnow2Instance(this, isInverse);
    }
  }

  class DarkCryptSnow2Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;
      this._s = null;      // 16-word LFSR state (circular buffer)
      this._head = 0;      // logical index of s0 within the circular buffer
      this._r1 = 0;
      this._r2 = 0;
      this._pendingBytes = [];
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._s = null; return; }
      if (keyBytes.length !== KEY_LEN)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. SNOW 2.0 (DarkCrypt) requires exactly ${KEY_LEN} bytes`);
      this._key = [...keyBytes];
      this._tryInit();
    }
    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; this._s = null; return; }
      if (ivBytes.length !== IV_LEN)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. SNOW 2.0 (DarkCrypt) requires exactly ${IV_LEN} bytes`);
      this._iv = [...ivBytes];
      this._tryInit();
    }
    get iv() { return this._iv ? [...this._iv] : null; }

    set nonce(nonceBytes) { this.iv = nonceBytes; }
    get nonce() { return this.iv; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._s) throw new Error("Key/IV not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._s) throw new Error("Key/IV not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++)
        output.push(OpCodes.XorN(this.inputBuffer[i], this._nextKeystreamByte()));

      this.inputBuffer = [];
      return output;
    }

    _tryInit() {
      if (!this._key || !this._iv) { this._s = null; return; }

      // Load 8 big-endian 32-bit key words k0..k7
      const k = new Array(8);
      for (let i = 0; i < 8; i++) {
        const o = i * 4;
        k[i] = OpCodes.Pack32BE(this._key[o], this._key[o + 1], this._key[o + 2], this._key[o + 3]);
      }
      // Load 4 big-endian 32-bit IV words iv0..iv3
      const iv = new Array(4);
      for (let i = 0; i < 4; i++) {
        const o = i * 4;
        iv[i] = OpCodes.Pack32BE(this._iv[o], this._iv[o + 1], this._iv[o + 2], this._iv[o + 3]);
      }

      // Standard SNOW 2.0 256-bit key loading: s_i = ~k_(7-i) for i=0..7, s_(8+i) = k_(7-i) for i=0..7
      const s = new Array(16);
      for (let i = 0; i < 8; i++) s[i] = OpCodes.Not32(k[7 - i]);
      for (let i = 0; i < 8; i++) s[8 + i] = k[7 - i];

      // IV folding (as implemented in the DarkCrypt plugin)
      s[10] = OpCodes.XorN(s[10], iv[1]); // s10 ^= iv word1 (bytes 4..7)
      s[9] = OpCodes.XorN(s[9], iv[0]);  // s9  ^= iv word0 (bytes 0..3)
      s[12] = OpCodes.XorN(s[12], iv[2]); // s12 ^= iv word2 (bytes 8..11)
      s[15] = OpCodes.XorN(s[15], iv[3]); // s15 ^= iv word3 (bytes 12..15)

      this._s = s;
      this._head = 0;
      this._r1 = 0;
      this._r2 = 0;
      this._pendingBytes = [];

      for (let t = 0; t < WARMUP_CLOCKS; t++) this._clock(true);
      // Discards exactly one generation-mode clock's output before real keystream starts (see file header)
      this._clock(false);
    }

    _tap(offset) { return this._s[OpCodes.And32(this._head + offset, 15)]; }

    // One SNOW 2.0 clock. withF=true folds the FSM feedback into the LFSR update (key/IV
    // warm-up mode, no output); withF=false is normal generation mode and returns the
    // 32-bit keystream word z = (s15 + R1) XOR R2 XOR s0.
    _clock(withF) {
      const s = this._s;
      const s0 = this._tap(0);
      const s2 = this._tap(2);
      const s5 = this._tap(5);
      const s11 = this._tap(11);
      const s15 = this._tap(15);

      const f = OpCodes.XorN(OpCodes.Add32(s15, this._r1), this._r2);

      let v = OpCodes.XorN(OpCodes.XorN(mulAlpha(s0), s2), divAlpha(s11));
      let z = null;
      if (withF)
        v = OpCodes.XorN(v, f);
      else
        z = OpCodes.XorN(f, s0);

      const r2New = sBoxWord(this._r1);
      const r1New = OpCodes.Add32(this._r2, s5); // R1' = R2(old) + s5(old); R2' = S(R1(old))

      s[this._head] = v; // shift-in: overwrite the slot that just vacated position s0
      this._head = OpCodes.And32(this._head + 1, 15);
      this._r1 = r1New;
      this._r2 = r2New;
      return z;
    }

    _nextKeystreamByte() {
      if (this._pendingBytes.length === 0) {
        const z = this._clock(false);
        this._pendingBytes = OpCodes.Unpack32LE(z);
      }
      return this._pendingBytes.shift();
    }
  }

  const algorithmInstance = new DarkCryptSnow2Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSnow2Algorithm, DarkCryptSnow2Instance };
}));
