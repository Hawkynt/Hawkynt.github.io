/*
 * Threefish-1024 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Threefish-1024 (the largest member of the Threefish tweakable block-cipher family,
 * designed for the Skein hash function) as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project).
 *
 * Structurally this matches the published Threefish-1024 specification exactly: 80 mixing
 * rounds grouped in fours between subkey injections, the standard 16-word permutation
 * pi = [
        {
          text: "DarkCrypt Threefish-1024 - all-zero key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("43cf2a34cb1668e38c2e19ea1757d6b31ac6dead02fea99459d8a0331bdc7273a1f7e9495d60402d1f8b43e48a5ac4f9d9d30965835e07f5455b87f963fdbca6df66b4446b91ffdd27634573f6e0e4c19633cf80da8fe11b890bcf639ac67b347f87c5daa1acc1b8cd0303f4a9168c0b9b7b78baa6fc68db2cbd3337b8519170")
        },
        {
          text: "DarkCrypt Threefish-1024 - incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f"),
          expected: OpCodes.Hex8ToBytes("0df2879eb23d790068020ea5f2bcac77e5f3fa100838a406651a64ae6d7a5f90c2bd1998a755109a3ac91b405a79f6389fa2be42d55f5eb85511ebd6d5893b34a6ea243b6a41b95e01d70144415edae7dc81d190acbec82c27df6bdbedfc6070e7e4ab1c06324f569429e8d66b7c0751fda37d1d6b087095cfb81d3c9fa4b457")
        },
        {
          text: "DarkCrypt Threefish-1024 - shifted incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f90"),
          expected: OpCodes.Hex8ToBytes("4779d2a5205c24767609e10c831e1bad2164a5209c69538e18d39ab2a8cfd959439272edcb6372b4fbeb422098bf28d2ac18b0ce9d102822f7053dd10cd0a30c7f4c0e1ba4d46c9abe0796c296a443d964df4d55c07e86d70b4ec1a615ccd8f7821c2ee608decb1385b4f08dfe695736bc1d41d0c6b1a5e0bf62aed2b75cc53e")
        },
0,9,2,13,6,11,4,15,10,7,12,3,14,5,8,1] applied every round, and the standard
 * 128-bit tweak schedule (T0,T1,T2=T0^T1 injected into words 13/14, round counter into
 * word 15). setup(key) reads 144 bytes: the first 128 bytes are the 1024-bit key, the
 * last 16 bytes are the tweak (both are used - the tweak is NOT forced to zero).
 *
 * DarkCrypt deviates from the published spec in exactly two constants:
 *   - the key-schedule parity word is 0x5555555555555555 (both 32-bit halves 0x55555555),
 *     replacing the standard Skein constant C240 = 0x1BD11BDA1BD11BD1.
 *   - the 8x8 rotation-constant table is a completely different, non-standard set of values.
 * As implemented in the DarkCrypt Total Commander plugin; test vectors verified against the
 * DarkCrypt implementation.
 * 1024-bit blocks, 1024-bit keys, 128-bit tweak (1152-bit total "key" material as exposed
 * by the setup() interface). Educational only.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([
        '../../AlgorithmFramework', '../../OpCodes'], factory);
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

  const MASK64 = OpCodes.ShiftLn(1n, 64n) - 1n;
  // DarkCrypt's non-standard key-schedule parity constant (standard Skein uses C240 = 0x1BD11BDA1BD11BD1).
  const PARITY = 0x5555555555555555n;
  // Standard Threefish-1024 word permutation applied after every round.
  const PI = [0, 9, 2, 13, 6, 11, 4, 15, 10, 7, 12, 3, 14, 5, 8, 1];

  // DarkCrypt's non-standard 8x8 rotation-constant table.
  const RT = [
    [55, 43, 37, 40, 16, 22, 38, 12],
    [25, 25, 46, 13, 14, 13, 52, 57],
    [33, 8, 18, 57, 21, 12, 32, 54],
    [34, 43, 25, 60, 44, 9, 59, 34],
    [28, 7, 47, 48, 51, 9, 35, 41],
    [17, 6, 18, 25, 43, 42, 40, 15],
    [58, 7, 32, 45, 19, 18, 2, 56],
    [47, 49, 27, 58, 37, 48, 53, 56]
  ];

  function rotl(x, r) { const rb = BigInt(r); return OpCodes.AndN(OpCodes.OrN(OpCodes.ShiftLn(x, rb), OpCodes.ShiftRn(x, 64n - rb)), MASK64); }
  function rotr(x, r) { const rb = BigInt(r); return OpCodes.AndN(OpCodes.OrN(OpCodes.ShiftRn(x, rb), OpCodes.ShiftLn(x, 64n - rb)), MASK64); }
  function add(a, b) { return OpCodes.AndN(a + b, MASK64); }
  function sub(a, b) { return OpCodes.AndN(a - b, MASK64); }

  function bytesToWords64LE(bytes, n) {
    const w = [];
    for (let i = 0; i < n; i++) {
      let v = 0n;
      for (let j = 7; j >= 0; j--) v = OpCodes.OrN(OpCodes.ShiftLn(v, 8n), BigInt(bytes[i * 8 + j]));
      w.push(v);
    }
    return w;
  }

  function words64ToBytesLE(words) {
    const out = [];
    for (const w of words) {
      let v = w;
      for (let j = 0; j < 8; j++) { out.push(Number(OpCodes.AndN(v, 0xffn))); v = OpCodes.ShiftRn(v, 8n); }
    }
    return out;
  }

  function keySchedule(keyWords) {
    let x = PARITY;
    for (let i = 0; i < 16; i++) x ^= keyWords[i];
    return [...keyWords, x];
  }

  // Encrypt1024: the 16-word MIX/permute structure is the standard Threefish-1024 definition;
  // RT supplies DarkCrypt's non-standard rotation amounts.
  function encrypt1024(block, K, T) {
    let [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15] = block;
    for (let r = 0; r < 19; r++) {
      b0 = add(b0, K[r % 17]); b1 = add(b1, K[(r + 1) % 17]); b2 = add(b2, K[(r + 2) % 17]); b3 = add(b3, K[(r + 3) % 17]);
      b4 = add(b4, K[(r + 4) % 17]); b5 = add(b5, K[(r + 5) % 17]); b6 = add(b6, K[(r + 6) % 17]); b7 = add(b7, K[(r + 7) % 17]);
      b8 = add(b8, K[(r + 8) % 17]); b9 = add(b9, K[(r + 9) % 17]); b10 = add(b10, K[(r + 10) % 17]); b11 = add(b11, K[(r + 11) % 17]);
      b12 = add(b12, K[(r + 12) % 17]); b13 = add(add(b13, K[(r + 13) % 17]), T[r % 3]); b14 = add(add(b14, K[(r + 14) % 17]), T[(r + 1) % 3]); b15 = add(add(b15, K[(r + 15) % 17]), BigInt(r));

      let rr = RT[0];
      b0 = add(b0, b1); b1 = OpCodes.XorN(rotl(b1, rr[0]), b0);
      b2 = add(b2, b3); b3 = OpCodes.XorN(rotl(b3, rr[1]), b2);
      b4 = add(b4, b5); b5 = OpCodes.XorN(rotl(b5, rr[2]), b4);
      b6 = add(b6, b7); b7 = OpCodes.XorN(rotl(b7, rr[3]), b6);
      b8 = add(b8, b9); b9 = OpCodes.XorN(rotl(b9, rr[4]), b8);
      b10 = add(b10, b11); b11 = OpCodes.XorN(rotl(b11, rr[5]), b10);
      b12 = add(b12, b13); b13 = OpCodes.XorN(rotl(b13, rr[6]), b12);
      b14 = add(b14, b15); b15 = OpCodes.XorN(rotl(b15, rr[7]), b14);

      rr = RT[1];
      b0 = add(b0, b9); b9 = OpCodes.XorN(rotl(b9, rr[0]), b0);
      b2 = add(b2, b13); b13 = OpCodes.XorN(rotl(b13, rr[1]), b2);
      b6 = add(b6, b11); b11 = OpCodes.XorN(rotl(b11, rr[2]), b6);
      b4 = add(b4, b15); b15 = OpCodes.XorN(rotl(b15, rr[3]), b4);
      b10 = add(b10, b7); b7 = OpCodes.XorN(rotl(b7, rr[4]), b10);
      b12 = add(b12, b3); b3 = OpCodes.XorN(rotl(b3, rr[5]), b12);
      b14 = add(b14, b5); b5 = OpCodes.XorN(rotl(b5, rr[6]), b14);
      b8 = add(b8, b1); b1 = OpCodes.XorN(rotl(b1, rr[7]), b8);

      rr = RT[2];
      b0 = add(b0, b7); b7 = OpCodes.XorN(rotl(b7, rr[0]), b0);
      b2 = add(b2, b5); b5 = OpCodes.XorN(rotl(b5, rr[1]), b2);
      b4 = add(b4, b3); b3 = OpCodes.XorN(rotl(b3, rr[2]), b4);
      b6 = add(b6, b1); b1 = OpCodes.XorN(rotl(b1, rr[3]), b6);
      b12 = add(b12, b15); b15 = OpCodes.XorN(rotl(b15, rr[4]), b12);
      b14 = add(b14, b13); b13 = OpCodes.XorN(rotl(b13, rr[5]), b14);
      b8 = add(b8, b11); b11 = OpCodes.XorN(rotl(b11, rr[6]), b8);
      b10 = add(b10, b9); b9 = OpCodes.XorN(rotl(b9, rr[7]), b10);

      rr = RT[3];
      b0 = add(b0, b15); b15 = OpCodes.XorN(rotl(b15, rr[0]), b0);
      b2 = add(b2, b11); b11 = OpCodes.XorN(rotl(b11, rr[1]), b2);
      b6 = add(b6, b13); b13 = OpCodes.XorN(rotl(b13, rr[2]), b6);
      b4 = add(b4, b9); b9 = OpCodes.XorN(rotl(b9, rr[3]), b4);
      b14 = add(b14, b1); b1 = OpCodes.XorN(rotl(b1, rr[4]), b14);
      b8 = add(b8, b5); b5 = OpCodes.XorN(rotl(b5, rr[5]), b8);
      b10 = add(b10, b3); b3 = OpCodes.XorN(rotl(b3, rr[6]), b10);
      b12 = add(b12, b7); b7 = OpCodes.XorN(rotl(b7, rr[7]), b12);

      r++;

      b0 = add(b0, K[r % 17]); b1 = add(b1, K[(r + 1) % 17]); b2 = add(b2, K[(r + 2) % 17]); b3 = add(b3, K[(r + 3) % 17]);
      b4 = add(b4, K[(r + 4) % 17]); b5 = add(b5, K[(r + 5) % 17]); b6 = add(b6, K[(r + 6) % 17]); b7 = add(b7, K[(r + 7) % 17]);
      b8 = add(b8, K[(r + 8) % 17]); b9 = add(b9, K[(r + 9) % 17]); b10 = add(b10, K[(r + 10) % 17]); b11 = add(b11, K[(r + 11) % 17]);
      b12 = add(b12, K[(r + 12) % 17]); b13 = add(add(b13, K[(r + 13) % 17]), T[r % 3]); b14 = add(add(b14, K[(r + 14) % 17]), T[(r + 1) % 3]); b15 = add(add(b15, K[(r + 15) % 17]), BigInt(r));

      rr = RT[4];
      b0 = add(b0, b1); b1 = OpCodes.XorN(rotl(b1, rr[0]), b0);
      b2 = add(b2, b3); b3 = OpCodes.XorN(rotl(b3, rr[1]), b2);
      b4 = add(b4, b5); b5 = OpCodes.XorN(rotl(b5, rr[2]), b4);
      b6 = add(b6, b7); b7 = OpCodes.XorN(rotl(b7, rr[3]), b6);
      b8 = add(b8, b9); b9 = OpCodes.XorN(rotl(b9, rr[4]), b8);
      b10 = add(b10, b11); b11 = OpCodes.XorN(rotl(b11, rr[5]), b10);
      b12 = add(b12, b13); b13 = OpCodes.XorN(rotl(b13, rr[6]), b12);
      b14 = add(b14, b15); b15 = OpCodes.XorN(rotl(b15, rr[7]), b14);

      rr = RT[5];
      b0 = add(b0, b9); b9 = OpCodes.XorN(rotl(b9, rr[0]), b0);
      b2 = add(b2, b13); b13 = OpCodes.XorN(rotl(b13, rr[1]), b2);
      b6 = add(b6, b11); b11 = OpCodes.XorN(rotl(b11, rr[2]), b6);
      b4 = add(b4, b15); b15 = OpCodes.XorN(rotl(b15, rr[3]), b4);
      b10 = add(b10, b7); b7 = OpCodes.XorN(rotl(b7, rr[4]), b10);
      b12 = add(b12, b3); b3 = OpCodes.XorN(rotl(b3, rr[5]), b12);
      b14 = add(b14, b5); b5 = OpCodes.XorN(rotl(b5, rr[6]), b14);
      b8 = add(b8, b1); b1 = OpCodes.XorN(rotl(b1, rr[7]), b8);

      rr = RT[6];
      b0 = add(b0, b7); b7 = OpCodes.XorN(rotl(b7, rr[0]), b0);
      b2 = add(b2, b5); b5 = OpCodes.XorN(rotl(b5, rr[1]), b2);
      b4 = add(b4, b3); b3 = OpCodes.XorN(rotl(b3, rr[2]), b4);
      b6 = add(b6, b1); b1 = OpCodes.XorN(rotl(b1, rr[3]), b6);
      b12 = add(b12, b15); b15 = OpCodes.XorN(rotl(b15, rr[4]), b12);
      b14 = add(b14, b13); b13 = OpCodes.XorN(rotl(b13, rr[5]), b14);
      b8 = add(b8, b11); b11 = OpCodes.XorN(rotl(b11, rr[6]), b8);
      b10 = add(b10, b9); b9 = OpCodes.XorN(rotl(b9, rr[7]), b10);

      rr = RT[7];
      b0 = add(b0, b15); b15 = OpCodes.XorN(rotl(b15, rr[0]), b0);
      b2 = add(b2, b11); b11 = OpCodes.XorN(rotl(b11, rr[1]), b2);
      b6 = add(b6, b13); b13 = OpCodes.XorN(rotl(b13, rr[2]), b6);
      b4 = add(b4, b9); b9 = OpCodes.XorN(rotl(b9, rr[3]), b4);
      b14 = add(b14, b1); b1 = OpCodes.XorN(rotl(b1, rr[4]), b14);
      b8 = add(b8, b5); b5 = OpCodes.XorN(rotl(b5, rr[5]), b8);
      b10 = add(b10, b3); b3 = OpCodes.XorN(rotl(b3, rr[6]), b10);
      b12 = add(b12, b7); b7 = OpCodes.XorN(rotl(b7, rr[7]), b12);
    }

    b0 = add(b0, K[3]); b1 = add(b1, K[4]); b2 = add(b2, K[5]); b3 = add(b3, K[6]);
    b4 = add(b4, K[7]); b5 = add(b5, K[8]); b6 = add(b6, K[9]); b7 = add(b7, K[10]);
    b8 = add(b8, K[11]); b9 = add(b9, K[12]); b10 = add(b10, K[13]); b11 = add(b11, K[14]);
    b12 = add(b12, K[15]); b13 = add(add(b13, K[16]), T[2]); b14 = add(add(b14, K[0]), T[0]); b15 = add(add(b15, K[1]), 20n);

    return [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15];
  }

  function decrypt1024(block, K, T) {
    let [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15] = block;
    let tmp;
    for (let r = 20; r > 1; r--) {
      b0 = sub(b0, K[r % 17]); b1 = sub(b1, K[(r + 1) % 17]); b2 = sub(b2, K[(r + 2) % 17]); b3 = sub(b3, K[(r + 3) % 17]);
      b4 = sub(b4, K[(r + 4) % 17]); b5 = sub(b5, K[(r + 5) % 17]); b6 = sub(b6, K[(r + 6) % 17]); b7 = sub(b7, K[(r + 7) % 17]);
      b8 = sub(b8, K[(r + 8) % 17]); b9 = sub(b9, K[(r + 9) % 17]); b10 = sub(b10, K[(r + 10) % 17]); b11 = sub(b11, K[(r + 11) % 17]);
      b12 = sub(b12, K[(r + 12) % 17]); b13 = sub(sub(b13, K[(r + 13) % 17]), T[r % 3]); b14 = sub(sub(b14, K[(r + 14) % 17]), T[(r + 1) % 3]); b15 = sub(sub(b15, K[(r + 15) % 17]), BigInt(r));

      let rr = RT[7];
      tmp = OpCodes.XorN(b7, b12); b7 = rotr(tmp, rr[7]); b12 = sub(b12, b7);
      tmp = OpCodes.XorN(b3, b10); b3 = rotr(tmp, rr[6]); b10 = sub(b10, b3);
      tmp = OpCodes.XorN(b5, b8); b5 = rotr(tmp, rr[5]); b8 = sub(b8, b5);
      tmp = OpCodes.XorN(b1, b14); b1 = rotr(tmp, rr[4]); b14 = sub(b14, b1);
      tmp = OpCodes.XorN(b9, b4); b9 = rotr(tmp, rr[3]); b4 = sub(b4, b9);
      tmp = OpCodes.XorN(b13, b6); b13 = rotr(tmp, rr[2]); b6 = sub(b6, b13);
      tmp = OpCodes.XorN(b11, b2); b11 = rotr(tmp, rr[1]); b2 = sub(b2, b11);
      tmp = OpCodes.XorN(b15, b0); b15 = rotr(tmp, rr[0]); b0 = sub(b0, b15);

      rr = RT[6];
      tmp = OpCodes.XorN(b9, b10); b9 = rotr(tmp, rr[7]); b10 = sub(b10, b9);
      tmp = OpCodes.XorN(b11, b8); b11 = rotr(tmp, rr[6]); b8 = sub(b8, b11);
      tmp = OpCodes.XorN(b13, b14); b13 = rotr(tmp, rr[5]); b14 = sub(b14, b13);
      tmp = OpCodes.XorN(b15, b12); b15 = rotr(tmp, rr[4]); b12 = sub(b12, b15);
      tmp = OpCodes.XorN(b1, b6); b1 = rotr(tmp, rr[3]); b6 = sub(b6, b1);
      tmp = OpCodes.XorN(b3, b4); b3 = rotr(tmp, rr[2]); b4 = sub(b4, b3);
      tmp = OpCodes.XorN(b5, b2); b5 = rotr(tmp, rr[1]); b2 = sub(b2, b5);
      tmp = OpCodes.XorN(b7, b0); b7 = rotr(tmp, rr[0]); b0 = sub(b0, b7);

      rr = RT[5];
      tmp = OpCodes.XorN(b1, b8); b1 = rotr(tmp, rr[7]); b8 = sub(b8, b1);
      tmp = OpCodes.XorN(b5, b14); b5 = rotr(tmp, rr[6]); b14 = sub(b14, b5);
      tmp = OpCodes.XorN(b3, b12); b3 = rotr(tmp, rr[5]); b12 = sub(b12, b3);
      tmp = OpCodes.XorN(b7, b10); b7 = rotr(tmp, rr[4]); b10 = sub(b10, b7);
      tmp = OpCodes.XorN(b15, b4); b15 = rotr(tmp, rr[3]); b4 = sub(b4, b15);
      tmp = OpCodes.XorN(b11, b6); b11 = rotr(tmp, rr[2]); b6 = sub(b6, b11);
      tmp = OpCodes.XorN(b13, b2); b13 = rotr(tmp, rr[1]); b2 = sub(b2, b13);
      tmp = OpCodes.XorN(b9, b0); b9 = rotr(tmp, rr[0]); b0 = sub(b0, b9);

      rr = RT[4];
      tmp = OpCodes.XorN(b15, b14); b15 = rotr(tmp, rr[7]); b14 = sub(b14, b15);
      tmp = OpCodes.XorN(b13, b12); b13 = rotr(tmp, rr[6]); b12 = sub(b12, b13);
      tmp = OpCodes.XorN(b11, b10); b11 = rotr(tmp, rr[5]); b10 = sub(b10, b11);
      tmp = OpCodes.XorN(b9, b8); b9 = rotr(tmp, rr[4]); b8 = sub(b8, b9);
      tmp = OpCodes.XorN(b7, b6); b7 = rotr(tmp, rr[3]); b6 = sub(b6, b7);
      tmp = OpCodes.XorN(b5, b4); b5 = rotr(tmp, rr[2]); b4 = sub(b4, b5);
      tmp = OpCodes.XorN(b3, b2); b3 = rotr(tmp, rr[1]); b2 = sub(b2, b3);
      tmp = OpCodes.XorN(b1, b0); b1 = rotr(tmp, rr[0]); b0 = sub(b0, b1);

      r--;

      b0 = sub(b0, K[r % 17]); b1 = sub(b1, K[(r + 1) % 17]); b2 = sub(b2, K[(r + 2) % 17]); b3 = sub(b3, K[(r + 3) % 17]);
      b4 = sub(b4, K[(r + 4) % 17]); b5 = sub(b5, K[(r + 5) % 17]); b6 = sub(b6, K[(r + 6) % 17]); b7 = sub(b7, K[(r + 7) % 17]);
      b8 = sub(b8, K[(r + 8) % 17]); b9 = sub(b9, K[(r + 9) % 17]); b10 = sub(b10, K[(r + 10) % 17]); b11 = sub(b11, K[(r + 11) % 17]);
      b12 = sub(b12, K[(r + 12) % 17]); b13 = sub(sub(b13, K[(r + 13) % 17]), T[r % 3]); b14 = sub(sub(b14, K[(r + 14) % 17]), T[(r + 1) % 3]); b15 = sub(sub(b15, K[(r + 15) % 17]), BigInt(r));

      rr = RT[3];
      tmp = OpCodes.XorN(b7, b12); b7 = rotr(tmp, rr[7]); b12 = sub(b12, b7);
      tmp = OpCodes.XorN(b3, b10); b3 = rotr(tmp, rr[6]); b10 = sub(b10, b3);
      tmp = OpCodes.XorN(b5, b8); b5 = rotr(tmp, rr[5]); b8 = sub(b8, b5);
      tmp = OpCodes.XorN(b1, b14); b1 = rotr(tmp, rr[4]); b14 = sub(b14, b1);
      tmp = OpCodes.XorN(b9, b4); b9 = rotr(tmp, rr[3]); b4 = sub(b4, b9);
      tmp = OpCodes.XorN(b13, b6); b13 = rotr(tmp, rr[2]); b6 = sub(b6, b13);
      tmp = OpCodes.XorN(b11, b2); b11 = rotr(tmp, rr[1]); b2 = sub(b2, b11);
      tmp = OpCodes.XorN(b15, b0); b15 = rotr(tmp, rr[0]); b0 = sub(b0, b15);

      rr = RT[2];
      tmp = OpCodes.XorN(b9, b10); b9 = rotr(tmp, rr[7]); b10 = sub(b10, b9);
      tmp = OpCodes.XorN(b11, b8); b11 = rotr(tmp, rr[6]); b8 = sub(b8, b11);
      tmp = OpCodes.XorN(b13, b14); b13 = rotr(tmp, rr[5]); b14 = sub(b14, b13);
      tmp = OpCodes.XorN(b15, b12); b15 = rotr(tmp, rr[4]); b12 = sub(b12, b15);
      tmp = OpCodes.XorN(b1, b6); b1 = rotr(tmp, rr[3]); b6 = sub(b6, b1);
      tmp = OpCodes.XorN(b3, b4); b3 = rotr(tmp, rr[2]); b4 = sub(b4, b3);
      tmp = OpCodes.XorN(b5, b2); b5 = rotr(tmp, rr[1]); b2 = sub(b2, b5);
      tmp = OpCodes.XorN(b7, b0); b7 = rotr(tmp, rr[0]); b0 = sub(b0, b7);

      rr = RT[1];
      tmp = OpCodes.XorN(b1, b8); b1 = rotr(tmp, rr[7]); b8 = sub(b8, b1);
      tmp = OpCodes.XorN(b5, b14); b5 = rotr(tmp, rr[6]); b14 = sub(b14, b5);
      tmp = OpCodes.XorN(b3, b12); b3 = rotr(tmp, rr[5]); b12 = sub(b12, b3);
      tmp = OpCodes.XorN(b7, b10); b7 = rotr(tmp, rr[4]); b10 = sub(b10, b7);
      tmp = OpCodes.XorN(b15, b4); b15 = rotr(tmp, rr[3]); b4 = sub(b4, b15);
      tmp = OpCodes.XorN(b11, b6); b11 = rotr(tmp, rr[2]); b6 = sub(b6, b11);
      tmp = OpCodes.XorN(b13, b2); b13 = rotr(tmp, rr[1]); b2 = sub(b2, b13);
      tmp = OpCodes.XorN(b9, b0); b9 = rotr(tmp, rr[0]); b0 = sub(b0, b9);

      rr = RT[0];
      tmp = OpCodes.XorN(b15, b14); b15 = rotr(tmp, rr[7]); b14 = sub(b14, b15);
      tmp = OpCodes.XorN(b13, b12); b13 = rotr(tmp, rr[6]); b12 = sub(b12, b13);
      tmp = OpCodes.XorN(b11, b10); b11 = rotr(tmp, rr[5]); b10 = sub(b10, b11);
      tmp = OpCodes.XorN(b9, b8); b9 = rotr(tmp, rr[4]); b8 = sub(b8, b9);
      tmp = OpCodes.XorN(b7, b6); b7 = rotr(tmp, rr[3]); b6 = sub(b6, b7);
      tmp = OpCodes.XorN(b5, b4); b5 = rotr(tmp, rr[2]); b4 = sub(b4, b5);
      tmp = OpCodes.XorN(b3, b2); b3 = rotr(tmp, rr[1]); b2 = sub(b2, b3);
      tmp = OpCodes.XorN(b1, b0); b1 = rotr(tmp, rr[0]); b0 = sub(b0, b1);
    }
    b0 = sub(b0, K[0]); b1 = sub(b1, K[1]); b2 = sub(b2, K[2]); b3 = sub(b3, K[3]);
    b4 = sub(b4, K[4]); b5 = sub(b5, K[5]); b6 = sub(b6, K[6]); b7 = sub(b7, K[7]);
    b8 = sub(b8, K[8]); b9 = sub(b9, K[9]); b10 = sub(b10, K[10]); b11 = sub(b11, K[11]);
    b12 = sub(b12, K[12]); b13 = sub(sub(b13, K[13]), T[0]); b14 = sub(sub(b14, K[14]), T[1]); b15 = sub(b15, K[15]);
    return [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15];
  }

  class DarkCryptThreefish1024Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();
      this.name = "Threefish-1024 (DarkCrypt)";
      this.description = "Threefish-1024 as implemented in the DarkCrypt Total Commander plugin. 1024-bit block, 1152-bit key.";
      this.inventor = "Alexander Myasnikov (DarkCrypt plugin)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;
      this.SupportedKeySizes = [new KeySize(144, 144, 0)];
      this.SupportedBlockSizes = [new KeySize(128, 128, 0)];
      this.documentation = [new LinkItem("DarkCrypt plugin", "https://totalcmd.net/plugring/darkcrypttc.html")];
      this.tests = [
        {
          text: "DarkCrypt Threefish-1024 - all-zero key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("43cf2a34cb1668e38c2e19ea1757d6b31ac6dead02fea99459d8a0331bdc7273a1f7e9495d60402d1f8b43e48a5ac4f9d9d30965835e07f5455b87f963fdbca6df66b4446b91ffdd27634573f6e0e4c19633cf80da8fe11b890bcf639ac67b347f87c5daa1acc1b8cd0303f4a9168c0b9b7b78baa6fc68db2cbd3337b8519170")
        },
        {
          text: "DarkCrypt Threefish-1024 - incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f"),
          expected: OpCodes.Hex8ToBytes("0df2879eb23d790068020ea5f2bcac77e5f3fa100838a406651a64ae6d7a5f90c2bd1998a755109a3ac91b405a79f6389fa2be42d55f5eb85511ebd6d5893b34a6ea243b6a41b95e01d70144415edae7dc81d190acbec82c27df6bdbedfc6070e7e4ab1c06324f569429e8d66b7c0751fda37d1d6b087095cfb81d3c9fa4b457")
        },
        {
          text: "DarkCrypt Threefish-1024 - shifted incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f90"),
          expected: OpCodes.Hex8ToBytes("4779d2a5205c24767609e10c831e1bad2164a5209c69538e18d39ab2a8cfd959439272edcb6372b4fbeb422098bf28d2ac18b0ce9d102822f7053dd10cd0a30c7f4c0e1ba4d46c9abe0796c296a443d964df4d55c07e86d70b4ec1a615ccd8f7821c2ee608decb1385b4f08dfe695736bc1d41d0c6b1a5e0bf62aed2b75cc53e")
        }
      ];
    }

    CreateInstance(isInverse = false) { return new DarkCryptThreefish1024Instance(this, isInverse); }
  }

  class DarkCryptThreefish1024Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._K = null;
      this._T = null;
      this.inputBuffer = [];
      this.BlockSize = 128;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._K = null; this._T = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 144)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Threefish-1024 (DarkCrypt) requires exactly 144 bytes (128-byte key + 16-byte tweak)`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      const keyWords = bytesToWords64LE(keyBytes.slice(0, 128), 16);
      const twWords = bytesToWords64LE(keyBytes.slice(128, 144), 2);
      twWords.push(OpCodes.XorN(twWords[0], twWords[1]));

      this._K = keySchedule(keyWords);
      this._T = twWords;
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

    _encryptBlock(block) {
      const words = bytesToWords64LE(block, 16);
      const out = encrypt1024(words, this._K, this._T);
      return words64ToBytesLE(out);
    }

    _decryptBlock(block) {
      const words = bytesToWords64LE(block, 16);
      const out = decrypt1024(words, this._K, this._T);
      return words64ToBytesLE(out);
    }
  }

  const algorithmInstance = new DarkCryptThreefish1024Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptThreefish1024Algorithm, DarkCryptThreefish1024Instance };
}));
