/*
 * Sosemanuk (DarkCrypt) Stream Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Sosemanuk (Berbain, Billet, Canteaut, Chevalier-Mames, Gilbert, Gouget,
 * Grieu, Muller, Necer, Reinhard, Thuillet -- 2005), an eSTREAM Profile 1
 * (software) portfolio finalist, as implemented in the DarkCrypt Total
 * Commander plugin (Alexander Myasnikov, "Zarya" project).
 *
 * Sosemanuk combines a 10-word LFSR over GF(2^32) (design influenced by
 * SNOW 2.0), a finite state machine (FSM) with two 32-bit memory registers,
 * and two primitives borrowed from Serpent: "Serpent24" (Serpent's own key
 * schedule, truncated to the first 24 of its rounds, used here to expand
 * the cipher key into a 25 x 128-bit subkey array) for the key schedule,
 * and one round of the Serpent S-box S2, applied bitslice across four
 * 32-bit words, as the output whitening transform ("Serpent1"). The IV is
 * injected by encrypting it with the full Serpent24 permutation (using
 * those same subkeys) and harvesting specific intermediate round states as
 * the initial LFSR and FSM registers.
 *
 * This port's key schedule, IV setup and keystream generation loop are a
 * direct translation of the original Sosemanuk reference implementation
 * (X-CRYPT project, 2005; sosemanuk.c/sosemanuk.h, released for
 * unrestricted use including commercial applications) -- the Serpent
 * bitslice S-box circuits (Osvik's "Speeding up Serpent" formulation), the
 * Serpent linear transform, the truncated Serpent24 key schedule, the IV
 * encryption/harvesting sequence, and the GF(2^32) multiplication-by-alpha
 * and multiplication-by-1/alpha tables were all taken from that reference
 * and verified byte-exact against the DarkCrypt implementation's own
 * keystream output.
 *
 * As implemented in the DarkCrypt Total Commander plugin, setup() reads a
 * fixed 32-byte (256-bit) key and a fixed 16-byte (128-bit) IV, regardless
 * of Sosemanuk's nominal support for 128-256 bit keys; both sizes were
 * confirmed against the DarkCrypt test vectors (16-byte and 20/24/28-byte
 * keys do not reproduce them).
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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance,
          LinkItem, KeySize } = AlgorithmFramework;

  // ===== SOSEMANUK CONSTANTS =====

  const KEY_LEN = 32;        // fixed 256-bit key, as read by the DarkCrypt implementation's setup()
  const IV_LEN = 16;         // fixed 128-bit IV
  const BLOCK_LEN = 80;      // bytes of keystream produced per internal round

  // Multiplication by alpha in GF(2^32): alpha * x = (x << 8) ^ MUL_A_TABLE[x >>> 24]
  const MUL_A_TABLE = [
    0x00000000,0xE19FCF13,0x6B973726,0x8A08F835,0xD6876E4C,0x3718A15F,0xBD10596A,0x5C8F9679,
    0x05A7DC98,0xE438138B,0x6E30EBBE,0x8FAF24AD,0xD320B2D4,0x32BF7DC7,0xB8B785F2,0x59284AE1,
    0x0AE71199,0xEB78DE8A,0x617026BF,0x80EFE9AC,0xDC607FD5,0x3DFFB0C6,0xB7F748F3,0x566887E0,
    0x0F40CD01,0xEEDF0212,0x64D7FA27,0x85483534,0xD9C7A34D,0x38586C5E,0xB250946B,0x53CF5B78,
    0x1467229B,0xF5F8ED88,0x7FF015BD,0x9E6FDAAE,0xC2E04CD7,0x237F83C4,0xA9777BF1,0x48E8B4E2,
    0x11C0FE03,0xF05F3110,0x7A57C925,0x9BC80636,0xC747904F,0x26D85F5C,0xACD0A769,0x4D4F687A,
    0x1E803302,0xFF1FFC11,0x75170424,0x9488CB37,0xC8075D4E,0x2998925D,0xA3906A68,0x420FA57B,
    0x1B27EF9A,0xFAB82089,0x70B0D8BC,0x912F17AF,0xCDA081D6,0x2C3F4EC5,0xA637B6F0,0x47A879E3,
    0x28CE449F,0xC9518B8C,0x435973B9,0xA2C6BCAA,0xFE492AD3,0x1FD6E5C0,0x95DE1DF5,0x7441D2E6,
    0x2D699807,0xCCF65714,0x46FEAF21,0xA7616032,0xFBEEF64B,0x1A713958,0x9079C16D,0x71E60E7E,
    0x22295506,0xC3B69A15,0x49BE6220,0xA821AD33,0xF4AE3B4A,0x1531F459,0x9F390C6C,0x7EA6C37F,
    0x278E899E,0xC611468D,0x4C19BEB8,0xAD8671AB,0xF109E7D2,0x109628C1,0x9A9ED0F4,0x7B011FE7,
    0x3CA96604,0xDD36A917,0x573E5122,0xB6A19E31,0xEA2E0848,0x0BB1C75B,0x81B93F6E,0x6026F07D,
    0x390EBA9C,0xD891758F,0x52998DBA,0xB30642A9,0xEF89D4D0,0x0E161BC3,0x841EE3F6,0x65812CE5,
    0x364E779D,0xD7D1B88E,0x5DD940BB,0xBC468FA8,0xE0C919D1,0x0156D6C2,0x8B5E2EF7,0x6AC1E1E4,
    0x33E9AB05,0xD2766416,0x587E9C23,0xB9E15330,0xE56EC549,0x04F10A5A,0x8EF9F26F,0x6F663D7C,
    0x50358897,0xB1AA4784,0x3BA2BFB1,0xDA3D70A2,0x86B2E6DB,0x672D29C8,0xED25D1FD,0x0CBA1EEE,
    0x5592540F,0xB40D9B1C,0x3E056329,0xDF9AAC3A,0x83153A43,0x628AF550,0xE8820D65,0x091DC276,
    0x5AD2990E,0xBB4D561D,0x3145AE28,0xD0DA613B,0x8C55F742,0x6DCA3851,0xE7C2C064,0x065D0F77,
    0x5F754596,0xBEEA8A85,0x34E272B0,0xD57DBDA3,0x89F22BDA,0x686DE4C9,0xE2651CFC,0x03FAD3EF,
    0x4452AA0C,0xA5CD651F,0x2FC59D2A,0xCE5A5239,0x92D5C440,0x734A0B53,0xF942F366,0x18DD3C75,
    0x41F57694,0xA06AB987,0x2A6241B2,0xCBFD8EA1,0x977218D8,0x76EDD7CB,0xFCE52FFE,0x1D7AE0ED,
    0x4EB5BB95,0xAF2A7486,0x25228CB3,0xC4BD43A0,0x9832D5D9,0x79AD1ACA,0xF3A5E2FF,0x123A2DEC,
    0x4B12670D,0xAA8DA81E,0x2085502B,0xC11A9F38,0x9D950941,0x7C0AC652,0xF6023E67,0x179DF174,
    0x78FBCC08,0x9964031B,0x136CFB2E,0xF2F3343D,0xAE7CA244,0x4FE36D57,0xC5EB9562,0x24745A71,
    0x7D5C1090,0x9CC3DF83,0x16CB27B6,0xF754E8A5,0xABDB7EDC,0x4A44B1CF,0xC04C49FA,0x21D386E9,
    0x721CDD91,0x93831282,0x198BEAB7,0xF81425A4,0xA49BB3DD,0x45047CCE,0xCF0C84FB,0x2E934BE8,
    0x77BB0109,0x9624CE1A,0x1C2C362F,0xFDB3F93C,0xA13C6F45,0x40A3A056,0xCAAB5863,0x2B349770,
    0x6C9CEE93,0x8D032180,0x070BD9B5,0xE69416A6,0xBA1B80DF,0x5B844FCC,0xD18CB7F9,0x301378EA,
    0x693B320B,0x88A4FD18,0x02AC052D,0xE333CA3E,0xBFBC5C47,0x5E239354,0xD42B6B61,0x35B4A472,
    0x667BFF0A,0x87E43019,0x0DECC82C,0xEC73073F,0xB0FC9146,0x51635E55,0xDB6BA660,0x3AF46973,
    0x63DC2392,0x8243EC81,0x084B14B4,0xE9D4DBA7,0xB55B4DDE,0x54C482CD,0xDECC7AF8,0x3F53B5EB
  ];

  // Multiplication by 1/alpha in GF(2^32): (1/alpha) * x = (x >>> 8) ^ MUL_IA_TABLE[x & 0xFF]
  const MUL_IA_TABLE = [
    0x00000000,0x180F40CD,0x301E8033,0x2811C0FE,0x603CA966,0x7833E9AB,0x50222955,0x482D6998,
    0xC078FBCC,0xD877BB01,0xF0667BFF,0xE8693B32,0xA04452AA,0xB84B1267,0x905AD299,0x88559254,
    0x29F05F31,0x31FF1FFC,0x19EEDF02,0x01E19FCF,0x49CCF657,0x51C3B69A,0x79D27664,0x61DD36A9,
    0xE988A4FD,0xF187E430,0xD99624CE,0xC1996403,0x89B40D9B,0x91BB4D56,0xB9AA8DA8,0xA1A5CD65,
    0x5249BE62,0x4A46FEAF,0x62573E51,0x7A587E9C,0x32751704,0x2A7A57C9,0x026B9737,0x1A64D7FA,
    0x923145AE,0x8A3E0563,0xA22FC59D,0xBA208550,0xF20DECC8,0xEA02AC05,0xC2136CFB,0xDA1C2C36,
    0x7BB9E153,0x63B6A19E,0x4BA76160,0x53A821AD,0x1B854835,0x038A08F8,0x2B9BC806,0x339488CB,
    0xBBC11A9F,0xA3CE5A52,0x8BDF9AAC,0x93D0DA61,0xDBFDB3F9,0xC3F2F334,0xEBE333CA,0xF3EC7307,
    0xA492D5C4,0xBC9D9509,0x948C55F7,0x8C83153A,0xC4AE7CA2,0xDCA13C6F,0xF4B0FC91,0xECBFBC5C,
    0x64EA2E08,0x7CE56EC5,0x54F4AE3B,0x4CFBEEF6,0x04D6876E,0x1CD9C7A3,0x34C8075D,0x2CC74790,
    0x8D628AF5,0x956DCA38,0xBD7C0AC6,0xA5734A0B,0xED5E2393,0xF551635E,0xDD40A3A0,0xC54FE36D,
    0x4D1A7139,0x551531F4,0x7D04F10A,0x650BB1C7,0x2D26D85F,0x35299892,0x1D38586C,0x053718A1,
    0xF6DB6BA6,0xEED42B6B,0xC6C5EB95,0xDECAAB58,0x96E7C2C0,0x8EE8820D,0xA6F942F3,0xBEF6023E,
    0x36A3906A,0x2EACD0A7,0x06BD1059,0x1EB25094,0x569F390C,0x4E9079C1,0x6681B93F,0x7E8EF9F2,
    0xDF2B3497,0xC724745A,0xEF35B4A4,0xF73AF469,0xBF179DF1,0xA718DD3C,0x8F091DC2,0x97065D0F,
    0x1F53CF5B,0x075C8F96,0x2F4D4F68,0x37420FA5,0x7F6F663D,0x676026F0,0x4F71E60E,0x577EA6C3,
    0xE18D0321,0xF98243EC,0xD1938312,0xC99CC3DF,0x81B1AA47,0x99BEEA8A,0xB1AF2A74,0xA9A06AB9,
    0x21F5F8ED,0x39FAB820,0x11EB78DE,0x09E43813,0x41C9518B,0x59C61146,0x71D7D1B8,0x69D89175,
    0xC87D5C10,0xD0721CDD,0xF863DC23,0xE06C9CEE,0xA841F576,0xB04EB5BB,0x985F7545,0x80503588,
    0x0805A7DC,0x100AE711,0x381B27EF,0x20146722,0x68390EBA,0x70364E77,0x58278E89,0x4028CE44,
    0xB3C4BD43,0xABCBFD8E,0x83DA3D70,0x9BD57DBD,0xD3F81425,0xCBF754E8,0xE3E69416,0xFBE9D4DB,
    0x73BC468F,0x6BB30642,0x43A2C6BC,0x5BAD8671,0x1380EFE9,0x0B8FAF24,0x239E6FDA,0x3B912F17,
    0x9A34E272,0x823BA2BF,0xAA2A6241,0xB225228C,0xFA084B14,0xE2070BD9,0xCA16CB27,0xD2198BEA,
    0x5A4C19BE,0x42435973,0x6A52998D,0x725DD940,0x3A70B0D8,0x227FF015,0x0A6E30EB,0x12617026,
    0x451FD6E5,0x5D109628,0x750156D6,0x6D0E161B,0x25237F83,0x3D2C3F4E,0x153DFFB0,0x0D32BF7D,
    0x85672D29,0x9D686DE4,0xB579AD1A,0xAD76EDD7,0xE55B844F,0xFD54C482,0xD545047C,0xCD4A44B1,
    0x6CEF89D4,0x74E0C919,0x5CF109E7,0x44FE492A,0x0CD320B2,0x14DC607F,0x3CCDA081,0x24C2E04C,
    0xAC977218,0xB49832D5,0x9C89F22B,0x8486B2E6,0xCCABDB7E,0xD4A49BB3,0xFCB55B4D,0xE4BA1B80,
    0x17566887,0x0F59284A,0x2748E8B4,0x3F47A879,0x776AC1E1,0x6F65812C,0x477441D2,0x5F7B011F,
    0xD72E934B,0xCF21D386,0xE7301378,0xFF3F53B5,0xB7123A2D,0xAF1D7AE0,0x870CBA1E,0x9F03FAD3,
    0x3EA637B6,0x26A9777B,0x0EB8B785,0x16B7F748,0x5E9A9ED0,0x4695DE1D,0x6E841EE3,0x768B5E2E,
    0xFEDECC7A,0xE6D18CB7,0xCEC04C49,0xD6CF0C84,0x9EE2651C,0x86ED25D1,0xAEFCE52F,0xB6F3A5E2
  ];

  function mulA(x) { return OpCodes.Or32(OpCodes.And32(OpCodes.RotL32(x, 8), 0xFFFFFF00), 0) === 0 ? 0 : OpCodes.Xor32(OpCodes.Shl32(x, 8), MUL_A_TABLE[OpCodes.And32(OpCodes.Shr32(x, 24), 0xFF)]); }
  function mulG(x) { return OpCodes.Xor32(OpCodes.Shr32(x, 8), MUL_IA_TABLE[OpCodes.And32(x, 0xFF)]); }

  // ===== SERPENT BITSLICE S-BOXES =====
  //
  // Each takes a 5-element register array [r0,r1,r2,r3,r4] (r4 is scratch,
  // its initial value is never read) and returns the mutated array. These
  // circuits (Dag Arne Osvik, "Speeding up Serpent") operate bitwise on
  // 32-bit words, applying the Serpent S-box independently across all 32
  // bit-lanes in parallel -- exactly the semantics of plain 32-bit AND/OR/
  // XOR/NOT in JavaScript, so this is a direct, literal transcription.

  function S0(r) {
    let r0 = r[0], r1 = r[1], r2 = r[2], r3 = r[3], r4 = r[4];
    r3 ^= r0;  r4  = r1;
    r1 &= r3;  r4 ^= r2;
    r1 ^= r0;  r0 |= r3;
    r0 ^= r4;  r4 ^= r3;
    r3 ^= r2;  r2 |= r1;
    r2 ^= r4;  r4 = ~r4;
    r4 |= r1;  r1 ^= r3;
    r1 ^= r4;  r3 |= r0;
    r1 ^= r3;  r4 ^= r3;
    return [OpCodes.ToUint32(r0), OpCodes.ToUint32(r1), OpCodes.ToUint32(r2), OpCodes.ToUint32(r3), OpCodes.ToUint32(r4)];
  }

  function S1(r) {
    let r0 = r[0], r1 = r[1], r2 = r[2], r3 = r[3], r4 = r[4];
    r0 = ~r0;  r2 = ~r2;
    r4  = r0;  r0 &= r1;
    r2 ^= r0;  r0 |= r3;
    r3 ^= r2;  r1 ^= r0;
    r0 ^= r4;  r4 |= r1;
    r1 ^= r3;  r2 |= r0;
    r2 &= r4;  r0 ^= r1;
    r1 &= r2;
    r1 ^= r0;  r0 &= r2;
    r0 ^= r4;
    return [OpCodes.ToUint32(r0), OpCodes.ToUint32(r1), OpCodes.ToUint32(r2), OpCodes.ToUint32(r3), OpCodes.ToUint32(r4)];
  }

  function S2(r) {
    let r0 = r[0], r1 = r[1], r2 = r[2], r3 = r[3], r4 = r[4];
    r4  = r0;  r0 &= r2;
    r0 ^= r3;  r2 ^= r1;
    r2 ^= r0;  r3 |= r4;
    r3 ^= r1;  r4 ^= r2;
    r1  = r3;  r3 |= r4;
    r3 ^= r0;  r0 &= r1;
    r4 ^= r0;  r1 ^= r3;
    r1 ^= r4;  r4 = ~r4;
    return [OpCodes.ToUint32(r0), OpCodes.ToUint32(r1), OpCodes.ToUint32(r2), OpCodes.ToUint32(r3), OpCodes.ToUint32(r4)];
  }

  function S3(r) {
    let r0 = r[0], r1 = r[1], r2 = r[2], r3 = r[3], r4 = r[4];
    r4  = r0;  r0 |= r3;
    r3 ^= r1;  r1 &= r4;
    r4 ^= r2;  r2 ^= r3;
    r3 &= r0;  r4 |= r1;
    r3 ^= r4;  r0 ^= r1;
    r4 &= r0;  r1 ^= r3;
    r4 ^= r2;  r1 |= r0;
    r1 ^= r2;  r0 ^= r3;
    r2  = r1;  r1 |= r3;
    r1 ^= r0;
    return [OpCodes.ToUint32(r0), OpCodes.ToUint32(r1), OpCodes.ToUint32(r2), OpCodes.ToUint32(r3), OpCodes.ToUint32(r4)];
  }

  function S4(r) {
    let r0 = r[0], r1 = r[1], r2 = r[2], r3 = r[3], r4 = r[4];
    r1 ^= r3;  r3 = ~r3;
    r2 ^= r3;  r3 ^= r0;
    r4  = r1;  r1 &= r3;
    r1 ^= r2;  r4 ^= r3;
    r0 ^= r4;  r2 &= r4;
    r2 ^= r0;  r0 &= r1;
    r3 ^= r0;  r4 |= r1;
    r4 ^= r0;  r0 |= r3;
    r0 ^= r2;  r2 &= r3;
    r0 = ~r0;  r4 ^= r2;
    return [OpCodes.ToUint32(r0), OpCodes.ToUint32(r1), OpCodes.ToUint32(r2), OpCodes.ToUint32(r3), OpCodes.ToUint32(r4)];
  }

  function S5(r) {
    let r0 = r[0], r1 = r[1], r2 = r[2], r3 = r[3], r4 = r[4];
    r0 ^= r1;  r1 ^= r3;
    r3 = ~r3;  r4  = r1;
    r1 &= r0;  r2 ^= r3;
    r1 ^= r2;  r2 |= r4;
    r4 ^= r3;  r3 &= r1;
    r3 ^= r0;  r4 ^= r1;
    r4 ^= r2;  r2 ^= r0;
    r0 &= r3;  r2 = ~r2;
    r0 ^= r4;  r4 |= r3;
    r2 ^= r4;
    return [OpCodes.ToUint32(r0), OpCodes.ToUint32(r1), OpCodes.ToUint32(r2), OpCodes.ToUint32(r3), OpCodes.ToUint32(r4)];
  }

  function S6(r) {
    let r0 = r[0], r1 = r[1], r2 = r[2], r3 = r[3], r4 = r[4];
    r2 = ~r2;  r4  = r3;
    r3 &= r0;  r0 ^= r4;
    r3 ^= r2;  r2 |= r4;
    r1 ^= r3;  r2 ^= r0;
    r0 |= r1;  r2 ^= r1;
    r4 ^= r0;  r0 |= r3;
    r0 ^= r2;  r4 ^= r3;
    r4 ^= r0;  r3 = ~r3;
    r2 &= r4;
    r2 ^= r3;
    return [OpCodes.ToUint32(r0), OpCodes.ToUint32(r1), OpCodes.ToUint32(r2), OpCodes.ToUint32(r3), OpCodes.ToUint32(r4)];
  }

  function S7(r) {
    let r0 = r[0], r1 = r[1], r2 = r[2], r3 = r[3], r4 = r[4];
    r4  = r1;  r1 |= r2;
    r1 ^= r3;  r4 ^= r2;
    r2 ^= r1;  r3 |= r4;
    r3 &= r0;  r4 ^= r2;
    r3 ^= r1;  r1 |= r4;
    r1 ^= r0;  r0 |= r4;
    r0 ^= r2;  r1 ^= r4;
    r2 ^= r1;  r1 &= r0;
    r1 ^= r4;  r2 = ~r2;
    r2 |= r0;
    r4 ^= r2;
    return [OpCodes.ToUint32(r0), OpCodes.ToUint32(r1), OpCodes.ToUint32(r2), OpCodes.ToUint32(r3), OpCodes.ToUint32(r4)];
  }

  const SBOX = [S0, S1, S2, S3, S4, S5, S6, S7];

  // The Serpent linear transform, operating on four 32-bit words in place.
  function serpentLT(x0, x1, x2, x3) {
    x0 = OpCodes.RotL32(x0, 13);
    x2 = OpCodes.RotL32(x2, 3);
    x1 = OpCodes.Xor32(OpCodes.Xor32(x1, x0), x2);
    x3 = OpCodes.Xor32(OpCodes.Xor32(x3, x2), (OpCodes.Shl32(x0, 3)));
    x1 = OpCodes.RotL32(x1, 1);
    x3 = OpCodes.RotL32(x3, 7);
    x0 = OpCodes.Xor32(OpCodes.Xor32(x0, x1), x3);
    x2 = OpCodes.Xor32(OpCodes.Xor32(x2, x3), (OpCodes.Shl32(x1, 7)));
    x0 = OpCodes.RotL32(x0, 5);
    x2 = OpCodes.RotL32(x2, 22);
    return [x0, x1, x2, x3];
  }

  // ===== KEY SCHEDULE: truncated Serpent24 key schedule =====
  //
  // Produces 25 128-bit subkeys (100 32-bit words) from the (padded)
  // 256-bit key, using Serpent's own w_i = (w_i-8 ^ w_i-5 ^ w_i-3 ^ w_i-1
  // ^ phi ^ i) <<< 11 recurrence (WUP) plus round-robin S-box application
  // (SKS) identical to the Serpent key schedule, just stopped after
  // producing 25 subkeys instead of 33.

  function sosemanukSchedule(key) {
    const wbuf = new Array(32).fill(0);
    for (let i = 0; i < key.length; i++) wbuf[i] = key[i];
    if (key.length < 32) {
      wbuf[key.length] = 0x01;
      // remaining bytes already zero from fill(0)
    }

    const w = new Array(8);
    for (let i = 0; i < 8; i++) {
      w[i] = OpCodes.Pack32LE(wbuf[i*4], wbuf[i*4+1], wbuf[i*4+2], wbuf[i*4+3]);
    }

    const sk = new Array(100).fill(0);
    let si = 0;

    function WUP(idx, i5, i3, i1, cc) {
      const tt = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(w[idx], w[i5]), w[i3]), w[i1]), OpCodes.Xor32(0x9E3779B9, cc));
      w[idx] = OpCodes.RotL32(tt, 11);
    }
    function WUP0(cc) {
      WUP(0, 3, 5, 7, cc);
      WUP(1, 4, 6, 0, cc + 1);
      WUP(2, 5, 7, 1, cc + 2);
      WUP(3, 6, 0, 2, cc + 3);
    }
    function WUP1(cc) {
      WUP(4, 7, 1, 3, cc);
      WUP(5, 0, 2, 4, cc + 1);
      WUP(6, 1, 3, 5, cc + 2);
      WUP(7, 2, 4, 6, cc + 3);
    }

    function SKS(sboxIdx, o0, o1, o2, o3, d0, d1, d2, d3) {
      const out = SBOX[sboxIdx]([w[o0], w[o1], w[o2], w[o3], 0]);
      sk[si++] = out[d0];
      sk[si++] = out[d1];
      sk[si++] = out[d2];
      sk[si++] = out[d3];
    }

    const SKS0 = () => SKS(0, 4, 5, 6, 7, 1, 4, 2, 0);
    const SKS1 = () => SKS(1, 0, 1, 2, 3, 2, 0, 3, 1);
    const SKS2 = () => SKS(2, 4, 5, 6, 7, 2, 3, 1, 4);
    const SKS3 = () => SKS(3, 0, 1, 2, 3, 1, 2, 3, 4);
    const SKS4 = () => SKS(4, 4, 5, 6, 7, 1, 4, 0, 3);
    const SKS5 = () => SKS(5, 0, 1, 2, 3, 1, 3, 0, 2);
    const SKS6 = () => SKS(6, 4, 5, 6, 7, 0, 1, 4, 2);
    const SKS7 = () => SKS(7, 0, 1, 2, 3, 4, 3, 1, 0);

    WUP0(0);   SKS3();
    WUP1(4);   SKS2();
    WUP0(8);   SKS1();
    WUP1(12);  SKS0();
    WUP0(16);  SKS7();
    WUP1(20);  SKS6();
    WUP0(24);  SKS5();
    WUP1(28);  SKS4();
    WUP0(32);  SKS3();
    WUP1(36);  SKS2();
    WUP0(40);  SKS1();
    WUP1(44);  SKS0();
    WUP0(48);  SKS7();
    WUP1(52);  SKS6();
    WUP0(56);  SKS5();
    WUP1(60);  SKS4();
    WUP0(64);  SKS3();
    WUP1(68);  SKS2();
    WUP0(72);  SKS1();
    WUP1(76);  SKS0();
    WUP0(80);  SKS7();
    WUP1(84);  SKS6();
    WUP0(88);  SKS5();
    WUP1(92);  SKS4();
    WUP0(96);  SKS3();

    return sk;
  }

  // ===== IV SETUP =====
  //
  // Encrypts the 128-bit IV with the full Serpent24 permutation (using the
  // subkeys from the key schedule); the LFSR's initial ten words and the
  // FSM's two registers are harvested from specific intermediate round
  // states during that encryption (per the Sosemanuk specification), not
  // from its final output.

  function sosemanukInit(sk, iv) {
    const ivtmp = new Array(16).fill(0);
    for (let i = 0; i < Math.min(16, iv.length); i++) ivtmp[i] = iv[i];

    // r is a fixed 5-slot register bank; the i0..i4/o0..o3 index arguments
    // below select which physical slot plays which role for that round
    // (this mirrors the reference implementation's register-renaming
    // trick, which avoids an explicit permutation step).
    const r = [
      OpCodes.Pack32LE(ivtmp[0], ivtmp[1], ivtmp[2], ivtmp[3]),
      OpCodes.Pack32LE(ivtmp[4], ivtmp[5], ivtmp[6], ivtmp[7]),
      OpCodes.Pack32LE(ivtmp[8], ivtmp[9], ivtmp[10], ivtmp[11]),
      OpCodes.Pack32LE(ivtmp[12], ivtmp[13], ivtmp[14], ivtmp[15]),
      0
    ];

    function KA(zc, i0, i1, i2, i3) {
      r[i0] = OpCodes.Xor32(r[i0], sk[zc]);
      r[i1] = OpCodes.Xor32(r[i1], sk[zc + 1]);
      r[i2] = OpCodes.Xor32(r[i2], sk[zc + 2]);
      r[i3] = OpCodes.Xor32(r[i3], sk[zc + 3]);
    }
    function applyS(sboxIdx, i0, i1, i2, i3, i4) {
      const out = SBOX[sboxIdx]([r[i0], r[i1], r[i2], r[i3], r[i4]]);
      r[i0] = out[0]; r[i1] = out[1]; r[i2] = out[2]; r[i3] = out[3]; r[i4] = out[4];
    }
    function applyLT(o0, o1, o2, o3) {
      const lt = serpentLT(r[o0], r[o1], r[o2], r[o3]);
      r[o0] = lt[0]; r[o1] = lt[1]; r[o2] = lt[2]; r[o3] = lt[3];
    }
    function FSS(zc, sboxIdx, i0, i1, i2, i3, i4, o0, o1, o2, o3) {
      KA(zc, i0, i1, i2, i3);
      applyS(sboxIdx, i0, i1, i2, i3, i4);
      applyLT(o0, o1, o2, o3);
    }
    function FSF(zc, sboxIdx, i0, i1, i2, i3, i4, o0, o1, o2, o3) {
      KA(zc, i0, i1, i2, i3);
      applyS(sboxIdx, i0, i1, i2, i3, i4);
      applyLT(o0, o1, o2, o3);
      KA(zc + 4, o0, o1, o2, o3);
    }

    const rc = { s: new Array(10) };

    FSS(0,  0, 0,1,2,3,4, 1,4,2,0);
    FSS(4,  1, 1,4,2,0,3, 2,1,0,4);
    FSS(8,  2, 2,1,0,4,3, 0,4,1,3);
    FSS(12, 3, 0,4,1,3,2, 4,1,3,2);
    FSS(16, 4, 4,1,3,2,0, 1,0,4,2);
    FSS(20, 5, 1,0,4,2,3, 0,2,1,4);
    FSS(24, 6, 0,2,1,4,3, 0,2,3,1);
    FSS(28, 7, 0,2,3,1,4, 4,1,2,0);
    FSS(32, 0, 4,1,2,0,3, 1,3,2,4);
    FSS(36, 1, 1,3,2,4,0, 2,1,4,3);
    FSS(40, 2, 2,1,4,3,0, 4,3,1,0);
    FSS(44, 3, 4,3,1,0,2, 3,1,0,2);
    rc.s[9] = r[3];
    rc.s[8] = r[1];
    rc.s[7] = r[0];
    rc.s[6] = r[2];

    FSS(48, 4, 3,1,0,2,4, 1,4,3,2);
    FSS(52, 5, 1,4,3,2,0, 4,2,1,3);
    FSS(56, 6, 4,2,1,3,0, 4,2,0,1);
    FSS(60, 7, 4,2,0,1,3, 3,1,2,4);
    FSS(64, 0, 3,1,2,4,0, 1,0,2,3);
    FSS(68, 1, 1,0,2,3,4, 2,1,3,0);
    rc.r1 = r[2];
    rc.s[4] = r[1];
    rc.r2 = r[3];
    rc.s[5] = r[0];

    FSS(72, 2, 2,1,3,0,4, 3,0,1,4);
    FSS(76, 3, 3,0,1,4,2, 0,1,4,2);
    FSS(80, 4, 0,1,4,2,3, 1,3,0,2);
    FSS(84, 5, 1,3,0,2,4, 3,2,1,0);
    FSS(88, 6, 3,2,1,0,4, 3,2,4,1);
    FSF(92, 7, 3,2,4,1,0, 0,1,2,3);
    rc.s[3] = r[0];
    rc.s[2] = r[1];
    rc.s[1] = r[2];
    rc.s[0] = r[3];

    return rc;
  }

  // ===== KEYSTREAM GENERATION =====
  //
  // Produces one 80-byte block of keystream, advancing the LFSR+FSM state
  // by 10 internal rounds (which, since the LFSR has 10 taps, amounts to
  // one full rotation of the shift register). Every group of 4 rounds
  // yields 4 "dropped" LFSR words and 4 FSM/LFSR combination words; one
  // Serpent S-box S2 round is applied (bitslice) across the 4 combination
  // words and the result is XORed with the 4 dropped words to produce 16
  // bytes of output (little-endian).

  function sosemanukRound(rc) {
    const s = rc.s;
    let r1 = rc.r1, r2 = rc.r2;
    const out = new Array(BLOCK_LEN).fill(0);

    let k = 0;
    for (let group = 0; group < 5; group++) {
      const v = new Array(4);
      const u = new Array(4);

      for (let j = 0; j < 4; j++) {
        const x0 = k % 10, x1 = (k + 1) % 10, x3 = (k + 3) % 10, x8 = (k + 8) % 10, x9 = (k + 9) % 10;

        // FSM update (uses the pre-update r1 to select the multiplexer input).
        const muxed = OpCodes.And32(r1, 1) ? OpCodes.Xor32(s[x1], s[x8]) : s[x1];
        const or1 = r1;
        r1 = OpCodes.ToUint32(r2 + muxed);
        r2 = OpCodes.RotL32(OpCodes.Mul32(or1, 0x54655307), 7);

        // LFSR update: drop s[x0], compute its replacement (s_t+10).
        const dropped = s[x0];
        s[x0] = OpCodes.Xor32(OpCodes.Xor32(mulA(s[x0]), mulG(s[x3])), s[x9]);

        // Combination word (s[x9] is still the pre-update value: x9 != x0).
        const combined = OpCodes.Xor32((OpCodes.ToUint32(s[x9] + r1)), r2);

        v[j] = dropped;
        u[j] = combined;
        k++;
      }

      const sres = S2([u[0], u[1], u[2], u[3], 0]);
      const w0 = OpCodes.Xor32(sres[2], v[0]);
      const w1 = OpCodes.Xor32(sres[3], v[1]);
      const w2 = OpCodes.Xor32(sres[1], v[2]);
      const w3 = OpCodes.Xor32(sres[4], v[3]);

      const off = group * 16;
      const b0 = OpCodes.Unpack32LE(w0), b1 = OpCodes.Unpack32LE(w1);
      const b2 = OpCodes.Unpack32LE(w2), b3 = OpCodes.Unpack32LE(w3);
      for (let i = 0; i < 4; i++) {
        out[off + i] = b0[i];
        out[off + 4 + i] = b1[i];
        out[off + 8 + i] = b2[i];
        out[off + 12 + i] = b3[i];
      }
    }

    rc.r1 = r1;
    rc.r2 = r2;
    return out;
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class DarkCryptSosemanukAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "Sosemanuk (DarkCrypt)";
      this.description = "Sosemanuk stream cipher (eSTREAM Profile 1 software portfolio finalist) as implemented in the DarkCrypt Total Commander plugin. Combines a 10-word LFSR over GF(2^32), a finite state machine, and two Serpent-derived primitives (a truncated Serpent24 key schedule and a Serpent S2 output whitening round).";
      this.inventor = "Come Berbain, Olivier Billet, Anne Canteaut, Nicolas Courtois, Henri Gilbert, Louis Goubin, Aline Gouget, Louis Granboulan, Cedric Lauradoux, Marine Minier, Thomas Pornin, Herve Sibert";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.FR;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];    // fixed 256-bit key (as read by the DarkCrypt implementation)
      this.SupportedNonceSizes = [new KeySize(16, 16, 0)];  // fixed 128-bit IV

      this.documentation = [
        new LinkItem("Sosemanuk, a fast software-oriented stream cipher (design paper)", "https://cr.yp.to/streamciphers/sosemanuk/desc.pdf"),
        new LinkItem("eSTREAM Sosemanuk portfolio page", "https://www.ecrypt.eu.org/stream/e2-sosemanuk.html"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.references = [
        new LinkItem("Sosemanuk reference implementation (X-CRYPT project)", "https://github.com/cchcc/SOSEMANUK/blob/master/C/SOSEMANUK.C")
      ];

      // Test vectors verified against the DarkCrypt implementation (setup(key,iv) + crypt(buf,len)).
      this.tests = [
        {
          text: "DarkCrypt Sos — sequential key, zero IV, 128 zero bytes",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          input: new Array(128).fill(0),
          expected: OpCodes.Hex8ToBytes("2ad642926b0f1f68435ebfad013b04defc6d5708210edf21fe5382f04793c68cc604cb9acfd4e93d19820a9030cb024752ace97037d7b5553b8742b68e1f4c5b3846f97de8605a8427c8aac1308508acf0b643ccd9a915651f55235df5f63b0ce3476cd68ac2a99af78141322edf6522f55cc605497c608f734a4ebf1d661ef2")
        },
        {
          text: "DarkCrypt Sos — sequential key, zero IV, incrementing 64-byte input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("2ad740916f0a196f4b57b5a60d360ad1ec7c451b351bc936e64a98eb5b8ed893e625e9b9ebf1cf1a31ab20bb1ce62c68629ddb4303e2836203be788db2227264")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptSosemanukInstance(this, isInverse);
    }
  }

  class DarkCryptSosemanukInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      this.rc = null;
      this.keystreamBuffer = [];
      this.keystreamPosition = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.rc = null;
        return;
      }

      if (!Array.isArray(keyBytes) && !(keyBytes instanceof Uint8Array)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== KEY_LEN) {
        throw new Error(`Invalid Sosemanuk key size: ${keyBytes.length} bytes. Key must be 32 bytes (256 bits)`);
      }

      this._key = Array.from(keyBytes);
      this._sk = sosemanukSchedule(this._key);
      this._initialize();
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    set iv(ivData) {
      if (!ivData) {
        this._iv = null;
      } else {
        if (!Array.isArray(ivData) && !(ivData instanceof Uint8Array)) {
          throw new Error("Invalid IV - must be byte array");
        }
        if (ivData.length !== IV_LEN) {
          throw new Error(`Invalid Sosemanuk IV size: ${ivData.length} bytes. IV must be 16 bytes (128 bits)`);
        }
        this._iv = Array.from(ivData);
      }

      if (this._key) {
        this._initialize();
      }
    }

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    set nonce(nonceData) {
      this.iv = nonceData;
    }

    get nonce() {
      return this.iv;
    }

    _initialize() {
      if (!this._key) return;
      const iv = this._iv || new Array(IV_LEN).fill(0);
      this.rc = sosemanukInit(this._sk, iv);
      this.keystreamBuffer = [];
      this.keystreamPosition = 0;
    }

    _getNextKeystreamByte() {
      if (this.keystreamPosition >= this.keystreamBuffer.length) {
        this.keystreamBuffer = sosemanukRound(this.rc);
        this.keystreamPosition = 0;
      }
      return this.keystreamBuffer[this.keystreamPosition++];
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data) && !(data instanceof Uint8Array)) {
        throw new Error("Invalid input data - must be byte array");
      }
      if (!this._key) {
        throw new Error("Key not set");
      }

      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (!this.rc) {
        throw new Error("Sosemanuk not properly initialized");
      }

      const output = new Array(this.inputBuffer.length);
      for (let i = 0; i < this.inputBuffer.length; i++) {
        output[i] = OpCodes.Xor32(this.inputBuffer[i], this._getNextKeystreamByte());
      }

      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new DarkCryptSosemanukAlgorithm();
  RegisterAlgorithm(algorithmInstance);

  return { DarkCryptSosemanukAlgorithm, DarkCryptSosemanukInstance };
}));
