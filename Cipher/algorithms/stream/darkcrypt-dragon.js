/*
 * Dragon (DarkCrypt) Stream Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Dragon-256: the real word-based eSTREAM Phase 3 Focus candidate designed by
 * K. Chen, M. Henricksen, W. Millan, J. Fuller, L. Simpson, E. Dawson, H. Lee
 * and S. Moon ("Dragon: A Fast Word Based Stream Cipher", ICISC 2004). It uses
 * a single 1024-bit NLFSR (thirty-two 32-bit words), a 64-bit counter memory M,
 * and a reversible state-update function F built from two 8x32 S-boxes (S1, S2)
 * combined into six virtual 32x32 mappings G1-G3/H1-H3. Six words of the NLFSR
 * (indices forming a full positive difference set: 0, 9, 16, 19, 30, 31) feed F
 * each round, producing 64 bits of keystream per round.
 *
 * This file implements the Dragon-256 variant (256-bit key, 256-bit IV) as
 * used by the DarkCrypt Total Commander plugin, which follows the published
 * specification bit-for-bit (verified against the paper's own official
 * 256-bit test vectors as well as against the DarkCrypt implementation's
 * output).
 * Registered as "Dragon (DarkCrypt)" to avoid colliding with the existing
 * educational "Dragon" registration (algorithms/stream/dragon.js), which
 * implements a simplified, non-conformant construction.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  // ===== DRAGON S-BOXES (S1, S2) — official values from the Dragon specification =====

  const S1 = Object.freeze([
    0x393BCE6B,0x232BA00D,0x84E18ADA,0x84557BA7,0x56828948,0x166908F3,
    0x414A3437,0x7BB44897,0x2315BE89,0x7A01F224,0x7056AA5D,0x121A3917,
    0xE3F47FA2,0x1F99D0AD,0x9BAD518B,0x99B9E75F,0x8829A7ED,0x2C511CA9,
    0x1D89BF75,0xF2F8CDD0,0x2DA2C498,0x48314C42,0x922D9AF6,0xAA6CE00C,
    0xAC66E078,0x7D4CB0C0,0x5500C6E8,0x23E4576B,0x6B365D40,0xEE171139,
    0x336BE860,0x5DBEEEFE,0x0E945776,0xD4D52CC4,0x0E9BB490,0x376EB6FD,
    0x6D891655,0xD4078FEE,0xE07401E7,0xA1E4350C,0xABC78246,0x73409C02,
    0x24704A1F,0x478ABB2C,0xA0849634,0x9E9E5FEB,0x77363D8D,0xD350BC21,
    0x876E1BB5,0xC8F55C9D,0xD112F39F,0xDF1A0245,0x9711B3F0,0xA3534F64,
    0x42FB629E,0x15EAD26A,0xD1CFA296,0x7B445FEE,0x88C28D4A,0xCA6A8992,
    0xB40726AB,0x508C65BC,0xBE87B3B9,0x4A894942,0x9AEECC5B,0x6CA6F10B,
    0x303F8934,0xD7A8693A,0x7C8A16E4,0xB8CF0AC9,0xAD14B784,0x819FF9F0,
    0xF20DCDFA,0xB7CB7159,0x58F3199F,0x9855E43B,0x1DF6C2D6,0x46114185,
    0xE46F5D0F,0xAAC70B5B,0x48590537,0x0FD77B28,0x67D16C70,0x75AE53F4,
    0xF7BFECA1,0x6017B2D2,0xD8A0FA28,0xB8FC2E0D,0x80168E15,0x0D7DEC9D,
    0xC5581F55,0xBE4A2783,0xD27012FE,0x53EA81CA,0xEBAA07D2,0x54F5D41D,
    0xABB26FA6,0x41B9EAD9,0xA48174C7,0x1F3026F0,0xEFBADD8E,0x387E9014,
    0x1505AB79,0xEADF0DF7,0x67755401,0xDA2EF962,0x41670B0E,0x0E8642F2,
    0xCE486070,0xA47D3312,0x4D7343A7,0xECDA58D0,0x1F79D536,0xD362576B,
    0x9D3A6023,0xC795A610,0xAE4DF639,0x60C0B14E,0xC6DD8E02,0xBDE93F4E,
    0xB7C3B0FF,0x2BE6BCAD,0xE4B3FDFD,0x79897325,0x3038798B,0x08AE6353,
    0x7D1D20EB,0x3B208D21,0xD0D6D104,0xC5244327,0x9893F59F,0xE976832A,
    0xB1EB320B,0xA409D915,0x7EC6B543,0x66E54F98,0x5FF805DC,0x599B223F,
    0xAD78B682,0x2CF5C6E8,0x4FC71D63,0x08F8FED1,0x81C3C49A,0xE4D0A778,
    0xB5D369CC,0x2DA336BE,0x76BC87CB,0x957A1878,0xFA136FBA,0x8F3C0E7B,
    0x7A1FF157,0x598324AE,0xFFBAAC22,0xD67DE9E6,0x3EB52897,0x4E07E855,
    0x87CE73F5,0x8D046706,0xD42D18F2,0xE71B1727,0x38473B38,0xB37B24D5,
    0x381C6AE1,0xE77D6589,0x6018CBFF,0x93CF3752,0x9B6EA235,0x504A50E8,
    0x464EA180,0x86AFBE5E,0xCC2D6AB0,0xAB91707B,0x1DB4D579,0xF9FAFD24,
    0x2B28CC54,0xCDCFD6B3,0x68A30978,0x43A6DFD7,0xC81DD98E,0xA6C2FD31,
    0x0FD07543,0xAFB400CC,0x5AF11A03,0x2647A909,0x24791387,0x5CFB4802,
    0x88CE4D29,0x353F5F5E,0x7038F851,0xF1F1C0AF,0x78EC6335,0xF2201AD1,
    0xDF403561,0x4462DFC7,0xE22C5044,0x9C829EA3,0x43FD6EAE,0x7A42B3A7,
    0x5BFAAAEC,0x3E046853,0x5789D266,0xE1219370,0xB2C420F8,0x3218BD4E,
    0x84590D94,0xD51D3A8C,0xA3AB3D24,0x2A339E3D,0xFEE67A23,0xAF844391,
    0x17465609,0xA99AD0A1,0x05CA597B,0x6024A656,0x0BF05203,0x8F559DDC,
    0x894A1911,0x909F21B4,0x6A7B63CE,0xE28DD7E7,0x4178AA3D,0x4346A7AA,
    0xA1845E4C,0x166735F4,0x639CA159,0x58940419,0x4E4F177A,0xD17959B2,
    0x12AA6FFD,0x1D39A8BE,0x7667F5AC,0xED0CE165,0xF1658FD8,0x28B04E02,
    0x1FA480CF,0xD3FB6FEF,0xED336CCB,0x9EE3CA39,0x9F224202,0x2D12D6E8,
    0xFAAC50CE,0xFA1E98AE,0x61498532,0x03678CC0,0x9E85EFD7,0x3069CE1A,
    0xF115D008,0x4553AA9F,0x3194BE09,0xB4A9367D,0x0A9DFEEC,0x7CA002D6,
    0x8E53A875,0x965E8183,0x14D79DAC,0x0192B555
  ]);

  const S2 = Object.freeze([
    0xA94BC384,0xF7A81CAE,0xAB84ECD4,0x00DEF340,0x8E2329B8,0x23AF3A22,
    0x23C241FA,0xAED8729E,0x2E59357F,0xC3ED78AB,0x687724BB,0x7663886F,
    0x1669AA35,0x5966EAC1,0xD574C543,0xDBC3F2FF,0x4DD44303,0xCD4F8D01,
    0x0CBF1D6F,0xA8169D59,0x87841E00,0x3C515AD4,0x708784D6,0x13EB675F,
    0x57592B96,0x07836744,0x3E721D90,0x26DAA84F,0x253A4E4D,0xE4FA37D5,
    0x9C0830E4,0xD7F20466,0xD41745BD,0x1275129B,0x33D0F724,0xE234C68A,
    0x4CA1F260,0x2BB0B2B6,0xBD543A87,0x4ABD3789,0x87A84A81,0x948104EB,
    0xA9AAC3EA,0xBAC5B4FE,0xD4479EB6,0xC4108568,0xE144693B,0x5760C117,
    0x48A9A1A6,0xA987B887,0xDF7C74E0,0xBC0682D7,0xEDB7705D,0x57BFFEAA,
    0x8A0BD4F1,0x1A98D448,0xEA4615C9,0x99E0CBD6,0x780E39A3,0xADBCD406,
    0x84DA1362,0x7A0E984B,0xBED853E6,0xD05D610B,0x9CAC6A28,0x1682ACDF,
    0x889F605F,0x9EE2FEBA,0xDB556C92,0x86818021,0x3CC5BEA1,0x75A934C6,
    0x95574478,0x31A92B9B,0xBFE3E92B,0xB28067AE,0xD862D848,0x0732A22D,
    0x840EF879,0x79FFA920,0x0124C8BB,0x26C75B69,0xC3DAAAC5,0x6E71F2E9,
    0x9FD4AFA6,0x474D0702,0x8B6AD73E,0xF5714E20,0xE608A352,0x2BF644F8,
    0x4DF9A8BC,0xB71EAD7E,0x6335F5FB,0x0A271CE3,0xD2B552BB,0x3834A0C3,
    0x341C5908,0x0674A87B,0x8C87C0F1,0xFF0842FC,0x48C46BDB,0x30826DF8,
    0x8B82CE8E,0x0235C905,0xDE4844C3,0x296DF078,0xEFAA6FEA,0x6CB98D67,
    0x6E959632,0xD5D3732F,0x68D95F19,0x43FC0148,0xF808C7B1,0xD45DBD5D,
    0x5DD1B83B,0x8BA824FD,0xC0449E98,0xB743CC56,0x41FADDAC,0x141E9B1C,
    0x8B937233,0x9B59DCA7,0xF1C871AD,0x6C678B4D,0x46617752,0xAAE49354,
    0xCABE8156,0x6D0AC54C,0x680CA74C,0x5CD82B3F,0xA1C72A59,0x336EFB54,
    0xD3B1A748,0xF4EB40D5,0x0ADB36CF,0x59FA1CE0,0x2C694FF9,0x5CE2F81A,
    0x469B9E34,0xCE74A493,0x08B55111,0xEDED517C,0x1695D6FE,0xE37C7EC7,
    0x57827B93,0x0E02A748,0x6E4A9C0F,0x4D840764,0x9DFFC45C,0x891D29D7,
    0xF9AD0D52,0x3F663F69,0xD00A91B9,0x615E2398,0xEDBBC423,0x09397968,
    0xE42D6B68,0x24C7EFB1,0x384D472C,0x3F0CE39F,0xD02E9787,0xC326F415,
    0x9E135320,0x150CB9E2,0xED94AFC7,0x236EAB0F,0x596807A0,0x0BD61C36,
    0xA29E8F57,0x0D8099A5,0x520200EA,0xD11FF96C,0x5FF47467,0x575C0B39,
    0x0FC89690,0xB1FBACE8,0x7A957D16,0xB54D9F76,0x21DC77FB,0x6DE85CF5,
    0xBFE7AEE9,0xC49571A9,0x7F1DE4DA,0x29E03484,0x786BA455,0xC26E2109,
    0x4A0215F4,0x44BFF99C,0x711A2414,0xFDE9CDD0,0xDCE15B77,0x66D37887,
    0xF006CB92,0x27429119,0xF37B9784,0x9BE182D9,0xF21B8C34,0x732CAD2D,
    0xAF8A6A60,0x33A5D3AF,0x633E2688,0x5EAB5FD1,0x23E6017A,0xAC27A7CF,
    0xF0FC5A0E,0xCC857A5D,0x20FB7B56,0x3241F4CD,0xE132B8F7,0x4BB37056,
    0xDA1D5F94,0x76E08321,0xE1936A9C,0x876C99C3,0x2B8A5877,0xEB6E3836,
    0x9ED8A201,0xB49B5122,0xB1199638,0xA0A4AF2B,0x15F50A42,0x775F3759,
    0x41291099,0xB6131D94,0x9A563075,0x224D1EB1,0x12BB0FA2,0xFF9BFC8C,
    0x58237F23,0x98EF2A15,0xD6BCCF8A,0xB340DC66,0x0D7743F0,0x13372812,
    0x6279F82B,0x4E45E519,0x98B4BE06,0x71375BAE,0x2173ED47,0x14148267,
    0xB7AB85B5,0xA875E314,0x1372F18D,0xFD105270,0xB83F161F,0x5C175260,
    0x44FFD49F,0xD428C4F6,0x2C2002FC,0xF2797BAF,0xA3B20A4E,0xB9BF1A89,
    0xE4ABA5E2,0xC912C58D,0x96516F9A,0x51561E77
  ]);

  // Dragon's fixed initial memory constant M = 0x0000447261676F6E (ASCII "Dragon")
  const M_INIT_HI = 0x00004472;
  const M_INIT_LO = 0x61676F6E;

  // Virtual 32x32 mappings, byte order MSB..LSB = x0,x1,x2,x3 (x0 most significant)
  function G1(x) { return OpCodes.XorN(OpCodes.XorN(S2[OpCodes.And32(x, 0xFF)], S1[OpCodes.And32(OpCodes.Shr32(x, 8), 0xFF)]), OpCodes.XorN(S1[OpCodes.And32(OpCodes.Shr32(x, 16), 0xFF)], S1[OpCodes.And32(OpCodes.Shr32(x, 24), 0xFF)])); }
  function G2(x) { return OpCodes.XorN(OpCodes.XorN(S1[OpCodes.And32(x, 0xFF)], S2[OpCodes.And32(OpCodes.Shr32(x, 8), 0xFF)]), OpCodes.XorN(S1[OpCodes.And32(OpCodes.Shr32(x, 16), 0xFF)], S1[OpCodes.And32(OpCodes.Shr32(x, 24), 0xFF)])); }
  function G3(x) { return OpCodes.XorN(OpCodes.XorN(S1[OpCodes.And32(x, 0xFF)], S1[OpCodes.And32(OpCodes.Shr32(x, 8), 0xFF)]), OpCodes.XorN(S2[OpCodes.And32(OpCodes.Shr32(x, 16), 0xFF)], S1[OpCodes.And32(OpCodes.Shr32(x, 24), 0xFF)])); }
  function H1(x) { return OpCodes.XorN(OpCodes.XorN(S1[OpCodes.And32(x, 0xFF)], S2[OpCodes.And32(OpCodes.Shr32(x, 8), 0xFF)]), OpCodes.XorN(S2[OpCodes.And32(OpCodes.Shr32(x, 16), 0xFF)], S2[OpCodes.And32(OpCodes.Shr32(x, 24), 0xFF)])); }
  function H2(x) { return OpCodes.XorN(OpCodes.XorN(S2[OpCodes.And32(x, 0xFF)], S1[OpCodes.And32(OpCodes.Shr32(x, 8), 0xFF)]), OpCodes.XorN(S2[OpCodes.And32(OpCodes.Shr32(x, 16), 0xFF)], S2[OpCodes.And32(OpCodes.Shr32(x, 24), 0xFF)])); }
  function H3(x) { return OpCodes.XorN(OpCodes.XorN(S2[OpCodes.And32(x, 0xFF)], S2[OpCodes.And32(OpCodes.Shr32(x, 8), 0xFF)]), OpCodes.XorN(S1[OpCodes.And32(OpCodes.Shr32(x, 16), 0xFF)], S2[OpCodes.And32(OpCodes.Shr32(x, 24), 0xFF)])); }

  /**
   * Dragon's reversible state-update function F (Table 1 of the specification).
   * Maps six 32-bit words (a,b,c,d,e,f) to six 32-bit words. Layers execute in
   * strict sequential (imperative) order: each step reads the most recently
   * updated value of every variable, including the post-mixing XOR layer which
   * consumes the words just produced by the preceding ADD layer.
   * @param {number[]} w - [a,b,c,d,e,f] as uint32
   * @returns {number[]} [a',b',c',d',e',f'] as uint32
   */
  function dragonF(w) {
    let [a, b, c, d, e, f] = w;

    // Pre-mixing layer
    b = OpCodes.XorN(b, a); d = OpCodes.XorN(d, c); f = OpCodes.XorN(f, e);
    c = OpCodes.Add32(c, b); e = OpCodes.Add32(e, d); a = OpCodes.Add32(a, f);

    // S-box layer
    d = OpCodes.XorN(d, G1(a)); f = OpCodes.XorN(f, G2(c)); b = OpCodes.XorN(b, G3(e));
    a = OpCodes.XorN(a, H1(b)); c = OpCodes.XorN(c, H2(d)); e = OpCodes.XorN(e, H3(f));

    // Post-mixing layer (sequential: XOR sub-step consumes the just-updated ADD results)
    d = OpCodes.Add32(d, a); f = OpCodes.Add32(f, c); b = OpCodes.Add32(b, e);
    c = OpCodes.XorN(c, b); e = OpCodes.XorN(e, d); a = OpCodes.XorN(a, f);

    return [a, b, c, d, e, f];
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class DarkCryptDragonAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Dragon (DarkCrypt)";
      this.description = "Real Dragon-256 eSTREAM Phase 3 Focus candidate: a single 1024-bit NLFSR filtered by a reversible F function built from two 8x32 S-boxes. 256-bit key, 256-bit IV. As implemented in the DarkCrypt Total Commander plugin, and bit-exact with the published specification's own official test vectors.";
      this.inventor = "K. Chen, M. Henricksen, W. Millan, J. Fuller, L. Simpson, E. Dawson, H. Lee, S. Moon";
      this.year = 2004;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.AU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];   // fixed 256-bit
      this.SupportedNonceSizes = [new KeySize(32, 32, 0)];  // fixed 256-bit IV
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("Dragon: A Fast Word Based Stream Cipher (ICISC 2004 paper, with S-box tables and official test vectors)", "https://cr.yp.to/streamciphers/dragon-128/desc.pdf"),
        new LinkItem("eSTREAM Dragon Page", "https://www.ecrypt.eu.org/stream/dragonp2.html"),
        new LinkItem("Dragon (cipher) - Wikipedia", "https://en.wikipedia.org/wiki/Dragon_(cipher)")
      ];

      this.references = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Unofficial Dragon C# reference implementation", "https://github.com/lexbritvin/DragonCipher")
      ];

      this.vulnerabilities = [
        new Vulnerability("Historical eSTREAM Elimination", "Advanced to Phase 3 Focus but not selected for the final eSTREAM portfolio; only known attacks are distinguishing attacks requiring keystream far beyond the specified 2^64-bit limit per key/IV pair.")
      ];

      // Test vectors: first two from the official Dragon specification paper (Appendix A,
      // 256-bit key/IV section); the last two from the DarkCrypt implementation (setup+crypt),
      // reproduced bit-exact by this implementation.
      this.tests = [
        {
          text: "Dragon-256 official specification test vector 1",
          uri: "https://cr.yp.to/streamciphers/dragon-128/desc.pdf",
          key: OpCodes.Hex8ToBytes("0000111122223333444455556666777788889999AAAABBBBCCCCDDDDEEEEFFFF"),
          iv: OpCodes.Hex8ToBytes("0000111122223333444455556666777788889999AAAABBBBCCCCDDDDEEEEFFFF"),
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("BC020767DC48DAE314778D8C927E8B32E086C6CDE593C008600C9D47A488F6223A2B94D6B853D64427E93362ABB8BA21751CAAF7BD3165952A37FC1EA3F12FE25C133BA74C15CE4B3542FDF893DAA751F571025649795D5431914EBA0DE2C2A78013D29B56D4A0283EB6F3127644ECFE38B9CA111924FBC94A0A30F2AFFF5FE0")
        },
        {
          text: "Dragon-256 official specification test vector 2",
          uri: "https://cr.yp.to/streamciphers/dragon-128/desc.pdf",
          key: OpCodes.Hex8ToBytes("00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF"),
          iv: OpCodes.Hex8ToBytes("00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF"),
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("8D3AB9BA01DAA3EB5CBD0F6DE3ECFCAB619AF808CF9C4A42E28777666D2D7037EE6F94AC29D1EEE5340DB0478E91A679480D8D882367CE2A31C96AD449E70756815EBEB2290DBA7A3CCB76A2257BD1222B0B7AED917FAFFF6B58B2B2B05F24F6E271A0169E897BEFF5C22451DA6F9E4052B78BE56C97C1A5C6F8E7910F7B9C98")
        },
        {
          text: "DarkCrypt keystream, incrementing key",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("22b8bb95775a77d46bd97f643b13c95ab27c606b754f471589c6bdc686b8e73989ec90975227504d8f98abb77b0c663f827e999e9036d703374d77c0645774b2a8868d42b10cdcbcf0392d2d4cf410e2e2f01e091c7647cbdee00e3965343ebcbe1d6eedb126b5d22b710679084fee3457cc563dfe00d1bece925acd953062d7")
        },
        {
          text: "DarkCrypt incrementing plaintext, incrementing key",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("22b9b996735f71d363d0756f371ec755a26d7278615a510291dfa7dd9aa5f926a9cdb2b47602766aa7b1819c57214810b24fabada403e1340f744dfb586a4a8d")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptDragonInstance(this, isInverse);
    }
  }

  class DarkCryptDragonInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;

      // Dragon state: 32-word (1024-bit) NLFSR, plus 64-bit memory/counter M
      this.B = null;
      this.Mhi = 0;
      this.Mlo = 0;

      this.keystreamBuffer = [];
      this.keystreamPosition = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      if (keyBytes.length !== 32) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Dragon (DarkCrypt) requires exactly 32 bytes (256 bits)`);
      }

      this._key = [...keyBytes];
      if (this._iv) {
        this._initialize();
      }
    }

    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes || ivBytes.length !== 32) {
        this._iv = new Array(32).fill(0);
      } else {
        this._iv = [...ivBytes];
      }

      if (this._key) {
        this._initialize();
      }
    }

    get iv() { return this._iv ? [...this._iv] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");

      if (this.inputBuffer.length === 0) {
        return [];
      }

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._getNextKeystreamByte();
        output.push(OpCodes.XorN(this.inputBuffer[i], keystreamByte));
      }

      this.inputBuffer = [];
      return output;
    }

    /**
     * Dragon-256 key/IV initialisation (specification Table 2).
     * The 1024-bit state is filled with W0..W7 (128-bit words) =
     * K || (K^IV) || NOT(K^IV) || IV, then mixed for 16 rounds of F,
     * each round replacing W0 with F's first four output words XORed
     * with the (pre-round) W4, and shifting W1..W7 down from W0..W6.
     */
    _initialize() {
      if (!this._key || !this._iv) return;

      const K = this._bytesToWordsBE(this._key);   // 8 words
      const IV = this._bytesToWordsBE(this._iv);    // 8 words
      const KxorIV = K.map((k, i) => OpCodes.XorN(k, IV[i]));
      const notKxorIV = KxorIV.map(x => OpCodes.ToUint32(~x));

      // W0..W7, 32 words total, grouped as 8 blocks of 4 words each
      let W = [].concat(
        K.slice(0, 4), K.slice(4, 8),
        KxorIV.slice(0, 4), KxorIV.slice(4, 8),
        notKxorIV.slice(0, 4), notKxorIV.slice(4, 8),
        IV.slice(0, 4), IV.slice(4, 8)
      );

      let e = M_INIT_HI, f = M_INIT_LO;

      for (let round = 0; round < 16; round++) {
        const W0 = W.slice(0, 4), W6 = W.slice(24, 28), W7 = W.slice(28, 32);
        const a = OpCodes.XorN(OpCodes.XorN(W0[0], W6[0]), W7[0]);
        const b = OpCodes.XorN(OpCodes.XorN(W0[1], W6[1]), W7[1]);
        const c = OpCodes.XorN(OpCodes.XorN(W0[2], W6[2]), W7[2]);
        const d = OpCodes.XorN(OpCodes.XorN(W0[3], W6[3]), W7[3]);

        const out = dragonF([a, b, c, d, e, f]);
        const W4old = W.slice(16, 20);
        const newW0 = [
          OpCodes.XorN(out[0], W4old[0]), OpCodes.XorN(out[1], W4old[1]),
          OpCodes.XorN(out[2], W4old[2]), OpCodes.XorN(out[3], W4old[3])
        ];

        const oldW = W.slice();
        const nextW = new Array(32);
        for (let blk = 7; blk >= 1; blk--) {
          for (let k = 0; k < 4; k++) nextW[blk * 4 + k] = oldW[(blk - 1) * 4 + k];
        }
        for (let k = 0; k < 4; k++) nextW[k] = newW0[k];
        W = nextW;

        e = out[4]; f = out[5];
      }

      this.B = W;             // 32-word NLFSR
      this.Mhi = OpCodes.ToUint32(e);     // 64-bit counter M, split hi/lo
      this.Mlo = OpCodes.ToUint32(f);

      this.keystreamBuffer = [];
      this.keystreamPosition = 0;
    }

    _bytesToWordsBE(bytes) {
      const words = [];
      for (let i = 0; i < bytes.length; i += 4) {
        words.push(OpCodes.Pack32BE(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]));
      }
      return words;
    }

    /**
     * One round of Dragon keystream generation (specification Table 3).
     * Taps at NLFSR indices 0, 9, 16, 19, 30, 31 (a full positive difference
     * set) feed F together with the 64-bit counter M; F's a' and e' outputs
     * form the 64-bit keystream word, b' and c' feed back into the NLFSR
     * head, and the register shifts down by two words each round.
     */
    _generateKeystreamWords() {
      const B = this.B;
      const a = B[0], b = B[9], c = B[16], d = B[19];
      const e = OpCodes.XorN(B[30], this.Mhi);
      const f = OpCodes.XorN(B[31], this.Mlo);

      const out = dragonF([a, b, c, d, e, f]);

      const oldB = B.slice();
      const newB = new Array(32);
      newB[0] = out[1]; newB[1] = out[2];
      for (let i = 2; i < 32; i++) newB[i] = oldB[i - 2];
      this.B = newB;

      // 64-bit counter increment
      const lo = OpCodes.Add32(this.Mlo, 1);
      this.Mhi = (lo === 0) ? OpCodes.Add32(this.Mhi, 1) : this.Mhi;
      this.Mlo = lo;

      return [out[0], out[4]]; // k = a' || e'
    }

    _getNextKeystreamByte() {
      if (this.keystreamPosition >= this.keystreamBuffer.length) {
        const words = this._generateKeystreamWords();
        this.keystreamBuffer = [...OpCodes.Unpack32BE(words[0]), ...OpCodes.Unpack32BE(words[1])];
        this.keystreamPosition = 0;
      }
      return this.keystreamBuffer[this.keystreamPosition++];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DarkCryptDragonAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DarkCryptDragonAlgorithm, DarkCryptDragonInstance };
}));
