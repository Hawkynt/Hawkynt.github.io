/*
 * Fcrypt-EDE (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * "Fcrypt", a DES-inspired 64-bit block cipher used inside the DarkCrypt Total
 * Commander plugin (Alexander Myasnikov, "Zarya" project), composed here as a
 * 3-key Encrypt-Decrypt-Encrypt (EDE) construction from a 192-bit (24-byte) key,
 * mirroring how the plugin's other "-EDE" variants (e.g. GOST-28147-89 (EDE))
 * chain three independently-keyed passes of a smaller base cipher.
 *
 * No public specification exists; this implementation follows the behavior
 * of the DarkCrypt plugin:
 *   - setup(key) builds three independent 16-word (64-byte) subkey schedules:
 *     Kc from key[0:8], Ka from key[8:16], Kb from key[16:24];
 *   - crypt(block)   = Encrypt(Decrypt(Encrypt(block, Kc), Ka), Kb)
 *     decrypt(block) = Decrypt(Encrypt(Decrypt(block, Kb), Ka), Kc)
 *   - the base cipher itself is a classic 16-round alternating Feistel network
 *     on a 64-bit block: round i XORs subkey[i] into whichever half was updated
 *     last, splits the result into 4 bytes, looks each byte up in one of four
 *     256-entry 32-bit tables, XORs the four table outputs together, and XORs
 *     that into the other half;
 *   - the base cipher's 8-byte key schedule discards the low bit of each key
 *     byte (DES-style parity-bit convention, 8x7=56 significant bits), packs
 *     the 56 bits into a rotating 32+24-bit register pair, and for each of the
 *     16 rounds byte-reverses (bswaps) the current 32-bit half to produce that
 *     round's subkey word before rotating the pair by 11 bits for the next round.
 * Test vectors verified against the DarkCrypt implementation (crypt/decrypt
 * round-trip verified). 64-bit blocks, 192-bit keys. Educational only.
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
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // Four 256-entry 32-bit substitution/permutation tables.
  // Byte i of (subkey ^ half) selects table Ti; the four lookups are XORed together.
  const DARKCRYPT_FCRYPT_T0 = Object.freeze([
    0x50070000,0xF8030000,0x90050000,0x20030000,0xE8040000,0x80050000,0xC8060000,0x88000000,
    0x68060000,0x30040000,0x30040000,0x88040000,0x50000000,0x90050000,0x98040000,0x30000000,
    0x70000000,0x30000000,0x90060000,0x28030000,0x98030000,0x28060000,0x40010000,0x00030000,
    0x90070000,0x00010000,0xA8050000,0xC0010000,0xF0030000,0xD0060000,0xF8040000,0x18070000,
    0x90060000,0x78060000,0x20060000,0xE0010000,0x08030000,0xF8070000,0x50020000,0x50020000,
    0xA8010000,0x60050000,0x50050000,0xF8020000,0x58010000,0xD8050000,0xE0050000,0x98020000,
    0x70020000,0xE8040000,0xC0030000,0x18050000,0xE0060000,0x48000000,0x90010000,0x80000000,
    0x30060000,0x78030000,0x30030000,0xB0060000,0x58050000,0x48050000,0x78050000,0xE8070000,
    0xD8010000,0xA8040000,0x40070000,0xA0010000,0xD0040000,0x08040000,0x90030000,0x00040000,
    0xE0040000,0x98070000,0x60070000,0xD0060000,0xF8040000,0x30010000,0xB0030000,0xA8000000,
    0xF0010000,0xA8020000,0x68020000,0xF0060000,0x20040000,0x70070000,0x68050000,0x38060000,
    0x88070000,0x58030000,0xE8010000,0x98060000,0x20000000,0x48020000,0x50050000,0x20010000,
    0x58000000,0x50040000,0x18040000,0xD0050000,0xD0070000,0x28040000,0x00050000,0x40050000,
    0x88050000,0xA0060000,0x08000000,0xC0060000,0x80030000,0x20030000,0x80070000,0x88020000,
    0x90060000,0x18060000,0x38050000,0xA8030000,0x60040000,0x28050000,0x20030000,0x78070000,
    0x80000000,0x70020000,0xB8050000,0x30060000,0x08030000,0x18000000,0x58070000,0x20020000,
    0xE8010000,0x28070000,0x98050000,0xD8020000,0x70050000,0xA8060000,0x68050000,0xE8000000,
    0xD0070000,0xD0020000,0xF0000000,0x98010000,0x58050000,0x98040000,0x10050000,0xB8050000,
    0x38070000,0x40050000,0x28020000,0x20050000,0x68060000,0x48010000,0x18030000,0x20020000,
    0xB0050000,0x48030000,0xF0030000,0x70010000,0x10030000,0x18000000,0x40060000,0x00070000,
    0xB8000000,0xD8050000,0x38060000,0x98070000,0xF8010000,0xB0010000,0xD0050000,0x88030000,
    0x70040000,0xB8040000,0x28030000,0x00030000,0x48030000,0xB0050000,0xB0070000,0x30070000,
    0x70030000,0x00070000,0x08040000,0xC8020000,0x40070000,0x78050000,0xE8060000,0xA8040000,
    0x10010000,0xC8040000,0xE8070000,0x18030000,0xC8000000,0xA0030000,0x08030000,0x88050000,
    0xB0050000,0xD8020000,0x70050000,0xA0020000,0x98050000,0x80030000,0xF8070000,0x30060000,
    0xD8010000,0xF0010000,0x08060000,0xB8060000,0x08070000,0x70000000,0xB0030000,0x28070000,
    0xB0010000,0x78020000,0xC8020000,0x38060000,0x40000000,0x70030000,0x10040000,0x30050000,
    0x98040000,0x20060000,0x50050000,0x30010000,0x48020000,0x00070000,0x08010000,0x20030000,
    0x38000000,0xF8040000,0x20030000,0x08040000,0xE0040000,0xF8050000,0xC8070000,0x88060000,
    0x18020000,0xC0070000,0xB0050000,0xC8050000,0x88070000,0x20010000,0xA8030000,0x18000000,
    0x20070000,0x80050000,0xC8040000,0x30020000,0xE8010000,0xA8070000,0x88060000,0xC8010000,
    0x90030000,0x90000000,0xB0070000,0xD0050000,0x60000000,0x68000000,0x10020000,0x70010000
  ]);

  const DARKCRYPT_FCRYPT_T1 = Object.freeze([
    0x030000B8,0x000000A0,0x05000030,0x070000F0,0x05000090,0x020000F0,0x04000060,0x010000F0,
    0x03000038,0x03000060,0x05000008,0x00000068,0x06000010,0x05000010,0x06000008,0x04000028,
    0x03000060,0x030000D8,0x03000038,0x06000030,0x01000018,0x07000018,0x07000090,0x04000048,
    0x02000080,0x040000E0,0x00000018,0x050000B8,0x03000098,0x07000030,0x07000008,0x010000C8,
    0x01000088,0x01000060,0x01000038,0x040000F8,0x05000028,0x03000048,0x02000020,0x060000B0,
    0x01000018,0x04000018,0x040000C0,0x030000E8,0x010000E0,0x050000A0,0x01000068,0x040000C8,
    0x000000E0,0x000000F8,0x04000060,0x01000000,0x00000018,0x030000E0,0x020000F8,0x05000068,
    0x070000A0,0x070000D0,0x040000A8,0x06000050,0x030000B0,0x02000020,0x06000068,0x050000B0,
    0x050000C0,0x05000008,0x05000008,0x050000F0,0x040000F0,0x020000A0,0x04000078,0x00000058,
    0x000000B0,0x030000A0,0x01000088,0x04000050,0x01000018,0x000000B8,0x00000020,0x070000D0,
    0x030000C8,0x04000020,0x05000088,0x070000A8,0x00000098,0x05000058,0x050000A8,0x01000070,
    0x05000050,0x00000060,0x03000000,0x03000058,0x020000D8,0x06000020,0x02000058,0x050000E0,
    0x07000010,0x05000078,0x02000028,0x03000098,0x070000D0,0x06000048,0x02000048,0x06000068,
    0x00000000,0x04000090,0x030000E8,0x040000B8,0x030000D0,0x000000C0,0x03000000,0x010000E8,
    0x06000078,0x020000D8,0x060000F0,0x06000030,0x07000010,0x07000030,0x050000D8,0x04000058,
    0x00000030,0x060000D0,0x00000040,0x000000A8,0x000000D8,0x04000040,0x03000050,0x000000B8,
    0x04000048,0x06000080,0x05000048,0x06000008,0x06000048,0x03000080,0x03000058,0x07000028,
    0x02000018,0x070000A0,0x03000040,0x06000040,0x06000098,0x04000020,0x01000040,0x00000050,
    0x02000090,0x03000030,0x05000018,0x06000050,0x07000090,0x07000018,0x030000F8,0x030000D0,
    0x01000088,0x070000B8,0x04000040,0x040000A0,0x020000F0,0x040000E0,0x03000018,0x060000A8,
    0x01000020,0x03000030,0x070000E0,0x05000098,0x020000B8,0x01000028,0x050000F0,0x04000048,
    0x02000020,0x06000020,0x07000000,0x04000078,0x01000018,0x010000E0,0x00000090,0x02000090,
    0x070000A8,0x000000F0,0x070000A0,0x06000058,0x000000C0,0x01000098,0x000000F8,0x070000C0,
    0x03000048,0x00000080,0x040000E8,0x06000098,0x070000B8,0x01000040,0x070000C0,0x01000080,
    0x00000028,0x020000F0,0x01000090,0x06000000,0x060000A8,0x000000C8,0x050000E8,0x02000028,
    0x04000058,0x020000D8,0x070000E8,0x050000E0,0x07000010,0x020000E0,0x05000048,0x040000B0,
    0x07000078,0x03000080,0x06000078,0x06000010,0x01000050,0x05000098,0x03000008,0x05000068,
    0x04000000,0x02000040,0x04000008,0x050000B8,0x000000E8,0x02000018,0x060000C8,0x060000B8,
    0x02000028,0x07000080,0x060000C0,0x04000050,0x020000C8,0x030000E0,0x020000B8,0x06000008,
    0x030000C8,0x06000038,0x010000A0,0x060000B0,0x02000018,0x060000F8,0x07000020,0x030000C0,
    0x000000B0,0x00000030,0x060000D0,0x04000090,0x030000B0,0x02000088,0x07000008,0x060000A0,
    0x03000080,0x00000018,0x07000000,0x01000078,0x040000B0,0x04000088,0x04000010,0x04000000
  ]);

  const DARKCRYPT_FCRYPT_T2 = Object.freeze([
    0x00800700,0x00B80100,0x00200100,0x00980200,0x00500100,0x00180000,0x00180400,0x00300400,
    0x00880600,0x00600700,0x00800200,0x00800700,0x00100200,0x00C00300,0x00780100,0x00680300,
    0x00F80500,0x00000400,0x00380400,0x00380100,0x00A80400,0x00100700,0x00280600,0x00E80200,
    0x00C80700,0x00780300,0x00D80600,0x00A00500,0x00280300,0x00700300,0x00380700,0x00200100,
    0x00400600,0x00D00000,0x00D80500,0x00480200,0x00A80500,0x00500000,0x00E80300,0x00C80500,
    0x00400700,0x00E00600,0x00B80500,0x00C80600,0x00280200,0x00000100,0x00D80000,0x00700600,
    0x00C80200,0x00E80400,0x00580300,0x00E80500,0x00700000,0x00780400,0x00180500,0x00480500,
    0x00E00500,0x00A00300,0x00300500,0x00B00700,0x00F80300,0x00F80200,0x00880500,0x00400300,
    0x00200400,0x00E00500,0x00480500,0x00E80700,0x00A80200,0x00800200,0x00480700,0x00B00500,
    0x00980000,0x00F00200,0x00380000,0x00C00500,0x00A80400,0x00100000,0x00000600,0x00800600,
    0x00500300,0x00D00000,0x00280400,0x00E80500,0x00B00500,0x00E80700,0x00F00700,0x00B80000,
    0x00F80100,0x00480000,0x00180500,0x00680400,0x00D80700,0x00680700,0x00D00600,0x00E80000,
    0x00680300,0x00E00000,0x00600300,0x00080000,0x00D00200,0x00280700,0x00880300,0x00F00100,
    0x00580400,0x00580300,0x00F00500,0x00480100,0x00580700,0x00900000,0x00C80000,0x00A00100,
    0x00680600,0x00980500,0x00E80500,0x00A80100,0x00500700,0x00580200,0x00A80600,0x00700500,
    0x00500100,0x00C80300,0x00D00200,0x00280500,0x00900100,0x00900000,0x00D80300,0x00E00600,
    0x00600100,0x00800600,0x00100100,0x00580200,0x00880500,0x00280400,0x00C80200,0x00000400,
    0x00000600,0x00800100,0x00F80400,0x00980300,0x00980600,0x00A00000,0x00400200,0x00000200,
    0x00380000,0x00680100,0x00780400,0x00000400,0x00780000,0x00700600,0x00580000,0x00F00200,
    0x00B80500,0x00F00200,0x00600500,0x00200100,0x00A00400,0x00500200,0x00C00000,0x00A80000,
    0x00280000,0x00400700,0x00100000,0x00B80300,0x00480500,0x00380600,0x00000200,0x00280200,
    0x00480400,0x00880600,0x00500700,0x00F00600,0x00600000,0x00C80300,0x00500100,0x00C80400,
    0x00600300,0x00F00100,0x00A80400,0x00E80600,0x00600400,0x00E80300,0x00680500,0x00780300,
    0x00E00600,0x00F80700,0x00E80700,0x00100300,0x00380200,0x00980500,0x00080100,0x00500400,
    0x00600700,0x00700400,0x00C80000,0x00C00000,0x00A00500,0x00700300,0x00E80100,0x00E80700,
    0x00A00300,0x00A00200,0x00F00000,0x00200000,0x00280400,0x00C00600,0x00E00500,0x00F80000,
    0x00B00200,0x00380700,0x00D00100,0x00B00200,0x00380300,0x00B00600,0x00400600,0x00280500,
    0x00980700,0x00700400,0x00F00600,0x00700500,0x00B80100,0x00480200,0x00B80500,0x00D00700,
    0x00400600,0x00A00700,0x00F80000,0x00000700,0x00500100,0x00D80400,0x00A80000,0x00880600,
    0x00A00100,0x00700000,0x00A80500,0x00000700,0x00200200,0x00C00300,0x00200400,0x00C80200,
    0x00B00200,0x00400300,0x00B80300,0x00280500,0x00A00000,0x00300000,0x00A80700,0x00780100,
    0x00600400,0x00500400,0x00980300,0x00000400,0x00B00300,0x00A00500,0x00800000,0x00300400
  ]);

  const DARKCRYPT_FCRYPT_T3 = Object.freeze([
    0x00004805,0x00005001,0x00004002,0x00008802,0x00002004,0x0000F003,0x00004802,0x00001007,
    0x0000A805,0x0000B805,0x00001002,0x00009801,0x0000E803,0x0000E802,0x00003005,0x00009000,
    0x00002002,0x00004002,0x00006803,0x00004001,0x00005005,0x00000001,0x00006803,0x0000B802,
    0x0000B006,0x00005803,0x0000E802,0x00009003,0x00008007,0x00009004,0x0000D002,0x0000D800,
    0x00009802,0x00000004,0x00002001,0x00008003,0x0000D004,0x00006006,0x00003805,0x00003003,
    0x00000805,0x00000800,0x00002805,0x00000802,0x0000B804,0x00000802,0x00008801,0x00001004,
    0x00008807,0x0000A000,0x00007806,0x00009802,0x00006800,0x00000005,0x00008000,0x00006006,
    0x00005001,0x0000E803,0x00009006,0x0000F805,0x00005802,0x0000D000,0x0000D806,0x0000B000,
    0x00003802,0x0000B007,0x00008802,0x0000B001,0x00006807,0x00009807,0x0000C805,0x0000D000,
    0x00003805,0x0000F806,0x00004801,0x00001802,0x00000800,0x0000A002,0x00008003,0x00002005,
    0x0000F805,0x0000A006,0x00005800,0x00009802,0x00002002,0x00000003,0x0000F004,0x00001801,
    0x00000805,0x0000C000,0x00004003,0x00007802,0x00008007,0x00007801,0x00001004,0x00001006,
    0x00005001,0x00000802,0x00009005,0x00001002,0x00006000,0x00006807,0x00006000,0x0000E800,
    0x00009800,0x0000D001,0x0000E001,0x00007003,0x0000A801,0x0000E006,0x00000003,0x00002803,
    0x00002804,0x00004807,0x00002003,0x00001000,0x0000D004,0x0000F801,0x0000F804,0x00003804,
    0x0000B004,0x0000F806,0x0000F005,0x00009007,0x00005806,0x00002807,0x00006003,0x0000A006,
    0x0000D002,0x00001804,0x0000F805,0x00009004,0x0000D800,0x0000A004,0x00000000,0x00001002,
    0x00007806,0x00005802,0x00000000,0x0000A803,0x0000D005,0x00007804,0x0000B003,0x0000F802,
    0x0000E802,0x0000D001,0x00006802,0x00004800,0x00009000,0x00004000,0x0000C001,0x0000A804,
    0x0000B800,0x00002007,0x00000800,0x0000E800,0x00006002,0x00004805,0x00006006,0x00002804,
    0x00001004,0x00006002,0x0000E804,0x00007801,0x0000D801,0x00003003,0x00000805,0x0000A001,
    0x00008000,0x00006806,0x0000C802,0x00004804,0x00002805,0x00008801,0x00007806,0x00002800,
    0x00004006,0x00002004,0x0000D007,0x00003806,0x0000D005,0x00007002,0x00005804,0x0000D000,
    0x0000C800,0x00008807,0x00000805,0x0000D801,0x0000C000,0x00009000,0x0000B800,0x00008005,
    0x0000C004,0x00006804,0x00005800,0x00001801,0x00001806,0x0000D001,0x00006801,0x00000001,
    0x0000F806,0x00009800,0x00000005,0x00004005,0x00006002,0x00006800,0x00006003,0x00007801,
    0x00003802,0x00009800,0x00009800,0x00009002,0x0000F800,0x00006801,0x0000A807,0x0000C803,
    0x0000E801,0x00001005,0x0000A002,0x0000E805,0x00004803,0x00004006,0x00005803,0x00009807,
    0x00002800,0x00004001,0x00008807,0x0000B000,0x00003002,0x00000002,0x00008005,0x00008800,
    0x00009806,0x0000B805,0x0000A804,0x00004802,0x00007806,0x00001806,0x0000E800,0x00007804,
    0x0000C006,0x00000807,0x00009803,0x0000D806,0x00006805,0x00004006,0x00004806,0x00004805,
    0x00000805,0x00001006,0x00002806,0x00001807,0x0000D005,0x0000E007,0x00007000,0x00002801
  ]);

  // 8-byte key -> 16 subkey words (DES-style: low bit of each key byte dropped,
  // 8x7=56 significant bits packed into a rotating 32+24-bit register pair;
  // each round byte-reverses the current 32-bit half for that round's subkey,
  // then rotates the pair by 11 bits for the next round).
  function darkCryptFcryptExpandKey(keyBytes) {
    let eax = OpCodes.Shr32(keyBytes[0], 1);
    let edx = OpCodes.Shr32(keyBytes[1], 1);
    eax = OpCodes.OrN(OpCodes.Shl32(eax, 7), edx);
    edx = OpCodes.Shr32(keyBytes[2], 1);
    eax = OpCodes.OrN(OpCodes.Shl32(eax, 7), edx);
    edx = OpCodes.Shr32(keyBytes[3], 1);
    eax = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(eax, 7), edx));

    let savedEdx = eax;
    eax = OpCodes.AndN(eax, 0x0F);
    let esi = OpCodes.Shr32(keyBytes[4], 1);
    eax = OpCodes.OrN(OpCodes.Shl32(eax, 7), esi);
    esi = OpCodes.Shr32(keyBytes[5], 1);
    eax = OpCodes.OrN(OpCodes.Shl32(eax, 7), esi);
    esi = OpCodes.Shr32(keyBytes[6], 1);
    eax = OpCodes.OrN(OpCodes.Shl32(eax, 7), esi);
    esi = OpCodes.Shr32(keyBytes[7], 1);
    eax = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(eax, 7), esi));

    edx = OpCodes.Shr32(savedEdx, 4);

    function bswap32(x) {
      return OpCodes.ToUint32(
        OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(
          OpCodes.Shl32(OpCodes.AndN(x, 0xFF), 24),
          OpCodes.Shl32(OpCodes.AndN(OpCodes.Shr32(x, 8), 0xFF), 16)),
          OpCodes.Shl32(OpCodes.AndN(OpCodes.Shr32(x, 16), 0xFF), 8)),
          OpCodes.AndN(OpCodes.Shr32(x, 24), 0xFF))
      );
    }

    const subkeys = new Array(16);
    subkeys[0] = bswap32(eax);

    for (let i = 1; i < 16; i++) {
      const oldEax = eax, oldEdx = edx;
      eax = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(oldEax, 11), OpCodes.Shl32(OpCodes.AndN(oldEdx, 0x7FF), 21)));
      edx = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(oldEdx, 11), OpCodes.Shl32(OpCodes.AndN(oldEax, 0x7FF), 13)));
      subkeys[i] = bswap32(eax);
    }
    return subkeys;
  }

  function darkCryptFcryptF(t) {
    const b0 = OpCodes.AndN(t, 0xFF);
    const b1 = OpCodes.AndN(OpCodes.Shr32(t, 8), 0xFF);
    const b2 = OpCodes.AndN(OpCodes.Shr32(t, 16), 0xFF);
    const b3 = OpCodes.AndN(OpCodes.Shr32(t, 24), 0xFF);
    return OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(
      DARKCRYPT_FCRYPT_T0[b0], DARKCRYPT_FCRYPT_T1[b1]),
      DARKCRYPT_FCRYPT_T2[b2]),
      DARKCRYPT_FCRYPT_T3[b3]));
  }

  // Base cipher: 16-round alternating Feistel on a 64-bit (2x32-bit LE) block.
  function darkCryptFcryptCoreEncrypt(block, subkeys) {
    let A = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
    let B = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
    for (let i = 0; i < 16; i++) {
      if (OpCodes.And32(i, 1) === 0) {
        const t = OpCodes.ToUint32(OpCodes.XorN(subkeys[i], B));
        A = OpCodes.ToUint32(OpCodes.XorN(A, darkCryptFcryptF(t)));
      } else {
        const t = OpCodes.ToUint32(OpCodes.XorN(subkeys[i], A));
        B = OpCodes.ToUint32(OpCodes.XorN(B, darkCryptFcryptF(t)));
      }
    }
    return [...OpCodes.Unpack32LE(A), ...OpCodes.Unpack32LE(B)];
  }

  function darkCryptFcryptCoreDecrypt(block, subkeys) {
    let A = OpCodes.Pack32LE(block[0], block[1], block[2], block[3]);
    let B = OpCodes.Pack32LE(block[4], block[5], block[6], block[7]);
    for (let i = 15; i >= 0; i--) {
      if (OpCodes.And32(i, 1) === 0) {
        const t = OpCodes.ToUint32(OpCodes.XorN(subkeys[i], B));
        A = OpCodes.ToUint32(OpCodes.XorN(A, darkCryptFcryptF(t)));
      } else {
        const t = OpCodes.ToUint32(OpCodes.XorN(subkeys[i], A));
        B = OpCodes.ToUint32(OpCodes.XorN(B, darkCryptFcryptF(t)));
      }
    }
    return [...OpCodes.Unpack32LE(A), ...OpCodes.Unpack32LE(B)];
  }

  class DarkCryptFcryptEdeAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Fcrypt-EDE (DarkCrypt)";
      this.description = "3-key Encrypt-Decrypt-Encrypt composition of \"Fcrypt\", a DES-inspired 64-bit block cipher from the DarkCrypt Total Commander plugin. The 192-bit key splits into three independent 64-bit Fcrypt subkeys Kc/Ka/Kb; crypt(block) = Encrypt(Decrypt(Encrypt(block,Kc),Ka),Kb). The inner cipher is a 16-round alternating Feistel network using four 256-entry 32-bit lookup tables per round and a DES-style (parity-bit-dropping) key schedule.";
      this.inventor = "Unknown (DarkCrypt plugin author: Alexander Myasnikov)";
      this.year = 2006;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(24, 24, 0)]; // fixed 192-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];  // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("EDE (Encrypt-Decrypt-Encrypt) composition", "https://en.wikipedia.org/wiki/Triple_DES")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard, unanalyzed cipher", "No public specification exists for this cipher; the base cipher and its EDE composition have not been subjected to public cryptanalysis.", "Use AES or another vetted cipher."),
        new Vulnerability("Meet-in-the-middle", "Triple-EDE constructions built from a 64-bit-block cipher offer materially less than 3x the effective key strength against meet-in-the-middle attacks.", "Prefer a modern wide-block cipher such as AES-256.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Fcrypt — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0e0900c73ef7ed41")
        },
        {
          text: "DarkCrypt Fcrypt — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f1011121314151617"),
          expected: OpCodes.Hex8ToBytes("669264ffa9c6239a")
        },
        {
          text: "DarkCrypt Fcrypt — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718"),
          expected: OpCodes.Hex8ToBytes("8bdb7d0bfb37291c")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptFcryptEdeInstance(this, isInverse);
    }
  }

  class DarkCryptFcryptEdeInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.kc = null;
      this.ka = null;
      this.kb = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.kc = null; this.ka = null; this.kb = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 24)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Fcrypt-EDE (DarkCrypt) requires exactly 24 bytes`);
      this._key = [...keyBytes];
      this.kc = darkCryptFcryptExpandKey(this._key.slice(0, 8));
      this.ka = darkCryptFcryptExpandKey(this._key.slice(8, 16));
      this.kb = darkCryptFcryptExpandKey(this._key.slice(16, 24));
      this.KeySize = keyBytes.length;
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

    // crypt(block) = Encrypt(Decrypt(Encrypt(block,Kc),Ka),Kb)
    _encryptBlock(block) {
      let stage = darkCryptFcryptCoreEncrypt(block, this.kc);
      stage = darkCryptFcryptCoreDecrypt(stage, this.ka);
      stage = darkCryptFcryptCoreEncrypt(stage, this.kb);
      return stage;
    }

    // decrypt(block) = Decrypt(Encrypt(Decrypt(block,Kb),Ka),Kc)
    _decryptBlock(block) {
      let stage = darkCryptFcryptCoreDecrypt(block, this.kb);
      stage = darkCryptFcryptCoreEncrypt(stage, this.ka);
      stage = darkCryptFcryptCoreDecrypt(stage, this.kc);
      return stage;
    }
  }

  const algorithmInstance = new DarkCryptFcryptEdeAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptFcryptEdeAlgorithm, DarkCryptFcryptEdeInstance };
}));
