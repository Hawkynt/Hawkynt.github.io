/*
 * Paranoia (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Paranoia is an undocumented 256-bit block cipher bundled with the DarkCrypt Total
 * Commander plugin (Alexander Myasnikov, "Zarya" project); no public specification exists.
 *
 * Structure (256-bit block = 8 x 32-bit words, 512-bit key = 16 x 32-bit words):
 *   - Key schedule (setup): a 64-word circular buffer is seeded with the 16 key words in
 *     slots 0..15 (slots 16..63 start at zero), then mixed for 144 iterations by an additive
 *     lagged-Fibonacci-style generator with six taps at fixed relative lags (3, 11, 31, 53,
 *     57, 62 words ahead of the write position, all six indices advancing together by one
 *     word per iteration): buffer[pos] += (buffer[tapA] + 0x243F6A89) + rotl(buffer[tapB],3)
 *     + rotl(buffer[tapC],15) + rotl(buffer[tapD],13) + rotl(buffer[tapE],7) +
 *     rotl(buffer[tapF],1), where pos also advances by one word per iteration (wrapping mod
 *     64). The constant 0x243F6A89 is the leading 32 bits of the binary fraction of pi. The
 *     final buffer splits into two per-key tables: Table1 = buffer[0..47] (48 round subkeys)
 *     and Table2 = buffer[48..63] (16 whitening words).
 *   - crypt(): the 8 input words W0..W7 are XORed with Table2[0..7] (input whitening), then
 *     48 rounds of an 8-word shift register run: each round drops W0, shifts W1..W7 down to
 *     W0..W6, and computes a new W7 from a chain of six variable-width lane rotations (byte,
 *     16-bit half-word, nibble, byte, half-word, then 2-bit lanes) interleaved with additions
 *     and XORs of the current W1..W6, native 32-bit rotations after two of the XORs, and a
 *     final addition of a round subkey Table1[g] (g = 0..47, forward order). All six lane-
 *     rotation amounts and the two native-rotation amounts for a given round are extracted
 *     as different bit-fields of a single running value (Table1[47-g] + the round's current
 *     W7, i.e. the 47-round subkey table is *also* read back-to-front as a keystream-like
 *     selector source, independently of its forward use as Table1[g]). After 48 rounds, the
 *     8 words are XORed with Table2[8..15] (output whitening) and written out.
 *   - Because only the addition step "W0 + pi + W1" at the very start of each round's chain
 *     involves the word being dropped (W0) -- everything else depends only on W1..W7 and the
 *     round's subkeys -- the whole construction is a cleanly invertible generalized Feistel
 *     network; decrypt() below runs the 48 rounds in reverse, recomputing each round's
 *     selector bit-fields from the (already known) shifted-back words and un-doing the six
 *     lane rotations, two native rotations, and the additions/XORs in reverse order to
 *     recover the dropped word.
 *
 * 256-bit blocks, 512-bit keys. Undocumented/obscure cipher, educational only.
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

  const BLOCK_BYTES = 32;
  const KEY_BYTES = 64;
  const ROUNDS = 48;
  const PI_CONST = 0x243F6A89;

  // Rotates each laneBits-wide lane of a 32-bit word left by n bits (0 <= n < laneBits),
  // independently across all (32/laneBits) lanes -- the SWAR "byte-lane"/"nibble-lane"/etc
  // rotation primitive this cipher's round function uses six times per round (with
  // laneBits of 8, 16, 4, 8, 16, 2).
  function laneRotL(x, n, laneBits) {
    n &= (laneBits - 1);
    if (n === 0) return OpCodes.ToUint32(x);
    const numLanes = 32 / laneBits;
    const laneMask = OpCodes.Shl32(1, laneBits) - 1;
    let result = 0;
    for (let i = 0; i < numLanes; i++) {
      const shift = i * laneBits;
      const lane = OpCodes.And32(OpCodes.Shr32(x, shift), laneMask);
      const rotated = OpCodes.And32(OpCodes.Or32(OpCodes.Shl32(lane, n), OpCodes.Shr32(lane, laneBits - n)), laneMask);
      result = OpCodes.Or32(result, OpCodes.Shl32(rotated, shift));
    }
    return OpCodes.ToUint32(result);
  }
  function laneRotR(x, n, laneBits) {
    return laneRotL(x, (laneBits - OpCodes.And32(n, laneBits - 1)) % laneBits, laneBits);
  }

  // Key schedule: builds the 64-word buffer (16 key words + 48 zero words), mixes it for
  // 144 iterations via the six-tap additive lagged generator, and splits it into the 48-word
  // round-subkey table and the 16-word whitening table.
  function buildSchedule(key) {
    const buffer = new Uint32Array(64);
    for (let i = 0; i < 16; i++)
      buffer[i] = OpCodes.Pack32LE(key[i * 4], key[i * 4 + 1], key[i * 4 + 2], key[i * 4 + 3]);

    let tapA = 3, tapB = 11, tapC = 31, tapD = 53, tapE = 57, tapF = 62, outPos = 0;
    for (let it = 0; it < 144; it++) {
      const val1 = OpCodes.ToUint32(buffer[OpCodes.And32(tapA, 63)] + PI_CONST);
      const val2 = OpCodes.RotL32(buffer[OpCodes.And32(tapB, 63)], 3);
      const val3 = OpCodes.RotL32(buffer[OpCodes.And32(tapC, 63)], 15);
      const val4 = OpCodes.RotL32(buffer[OpCodes.And32(tapD, 63)], 13);
      const val5 = OpCodes.RotL32(buffer[OpCodes.And32(tapE, 63)], 7);
      const val6 = OpCodes.RotL32(buffer[OpCodes.And32(tapF, 63)], 1);
      const acc = OpCodes.ToUint32(val1 + val2 + val3 + val4 + val5 + val6);
      buffer[OpCodes.And32(outPos, 63)] = OpCodes.ToUint32(buffer[OpCodes.And32(outPos, 63)] + acc);
      outPos++; tapA++; tapB++; tapC++; tapD++; tapE++; tapF++;
    }

    return { table1: buffer.slice(0, 48), table2: buffer.slice(48, 64) };
  }

  class DarkCryptParanoiaAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Paranoia (DarkCrypt)";
      this.description = "Undocumented 256-bit block cipher from the DarkCrypt Total Commander plugin: an 8-word generalized Feistel network over a 512-bit key, whose 48-round subkey table and 16-word whitening table are both generated by a 144-iteration, six-tap additive lagged-Fibonacci generator seeded from the key. No public specification is known.";
      this.inventor = "Alexander Myasnikov (DarkCrypt / \"Zarya\" project)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];   // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(32, 32, 0)]; // fixed 256-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Undocumented/unanalyzed design", "No public cryptanalysis exists for this cipher.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Paranoia — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("ddef11dc4dc6f82c49d317f0e3663344ddd564af8fc55fe91e6f676af9945be7")
        },
        {
          text: "DarkCrypt Paranoia — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("65ebd0608c5a22d201b0c753e56b05ccc8885d10aaa8ac0de3d847900ad22d20")
        },
        {
          text: "DarkCrypt Paranoia — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("6da97a35ce8481696eb617e05e0e190fa34a6a1843cf46cb0812b9770f71d9a8")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptParanoiaInstance(this, isInverse);
    }
  }

  class DarkCryptParanoiaInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._sched = null;
      this.inputBuffer = [];
      this.BlockSize = BLOCK_BYTES;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; this._sched = null; return; }
      if (keyBytes.length !== KEY_BYTES)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Paranoia (DarkCrypt) requires exactly ${KEY_BYTES} bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._sched = buildSchedule(this._key);
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
      const sched = this._sched;
      const W = new Array(8);
      for (let i = 0; i < 8; i++)
        W[i] = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
      for (let i = 0; i < 8; i++) W[i] = OpCodes.Xor32(W[i], sched.table2[i]);

      for (let g = 0; g < ROUNDS; g++) {
        const revIdx = ROUNDS - 1 - g;
        const acc = OpCodes.ToUint32(sched.table1[revIdx] + W[7]);
        const idx1 = OpCodes.And32(OpCodes.Shr32(acc, 26), 7);
        const r1 = OpCodes.And32(OpCodes.Shr32(acc, 10), 31);
        const idx2 = OpCodes.And32(OpCodes.Shr32(acc, 19), 0xF);
        const idx3 = OpCodes.And32(OpCodes.Shr32(acc, 29), 3);
        const r2 = OpCodes.And32(OpCodes.Shr32(acc, 5), 31);
        const idx4 = OpCodes.And32(OpCodes.Shr32(acc, 23), 7);
        const idx6 = OpCodes.And32(OpCodes.Shr32(acc, 15), 0xF);
        const r3 = OpCodes.And32(acc, 31);
        const idx7 = OpCodes.And32(OpCodes.Shr32(acc, 31), 1);

        let v = laneRotL(OpCodes.ToUint32(OpCodes.ToUint32(W[0] + PI_CONST) + W[1]), idx1, 8);
        v = OpCodes.RotL32(OpCodes.Xor32(v, W[2]), r1);
        v = laneRotL(v, idx2, 16);
        v = OpCodes.ToUint32(v + W[3]);
        v = laneRotL(v, idx3, 4);
        v = OpCodes.RotL32(OpCodes.Xor32(v, W[4]), r2);
        v = laneRotL(v, idx4, 8);
        v = OpCodes.ToUint32(v + W[5]);
        v = laneRotL(v, idx6, 16);
        v = OpCodes.RotL32(OpCodes.Xor32(v, W[6]), r3);
        v = laneRotL(v, idx7, 2);
        const newW7 = OpCodes.ToUint32(v + sched.table1[g]);

        W[0] = W[1]; W[1] = W[2]; W[2] = W[3]; W[3] = W[4];
        W[4] = W[5]; W[5] = W[6]; W[6] = W[7]; W[7] = newW7;
      }

      for (let i = 0; i < 8; i++) W[i] = OpCodes.Xor32(W[i], sched.table2[8 + i]);

      const out = [];
      for (let i = 0; i < 8; i++) out.push(...OpCodes.Unpack32LE(W[i]));
      return out;
    }

    _decryptBlock(block) {
      const sched = this._sched;
      const W = new Array(8);
      for (let i = 0; i < 8; i++)
        W[i] = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
      for (let i = 0; i < 8; i++) W[i] = OpCodes.Xor32(W[i], sched.table2[8 + i]);

      for (let g = ROUNDS - 1; g >= 0; g--) {
        const revIdx = ROUNDS - 1 - g;
        const oldW1 = W[0], oldW2 = W[1], oldW3 = W[2], oldW4 = W[3];
        const oldW5 = W[4], oldW6 = W[5], oldW7 = W[6], newW7 = W[7];

        const acc = OpCodes.ToUint32(sched.table1[revIdx] + oldW7);
        const idx1 = OpCodes.And32(OpCodes.Shr32(acc, 26), 7);
        const r1 = OpCodes.And32(OpCodes.Shr32(acc, 10), 31);
        const idx2 = OpCodes.And32(OpCodes.Shr32(acc, 19), 0xF);
        const idx3 = OpCodes.And32(OpCodes.Shr32(acc, 29), 3);
        const r2 = OpCodes.And32(OpCodes.Shr32(acc, 5), 31);
        const idx4 = OpCodes.And32(OpCodes.Shr32(acc, 23), 7);
        const idx6 = OpCodes.And32(OpCodes.Shr32(acc, 15), 0xF);
        const r3 = OpCodes.And32(acc, 31);
        const idx7 = OpCodes.And32(OpCodes.Shr32(acc, 31), 1);

        let v = OpCodes.ToUint32(newW7 - sched.table1[g]);
        v = laneRotR(v, idx7, 2);
        v = OpCodes.Xor32(OpCodes.RotR32(v, r3), oldW6);
        v = laneRotR(v, idx6, 16);
        v = OpCodes.ToUint32(v - oldW5);
        v = laneRotR(v, idx4, 8);
        v = OpCodes.Xor32(OpCodes.RotR32(v, r2), oldW4);
        v = laneRotR(v, idx3, 4);
        v = OpCodes.ToUint32(v - oldW3);
        v = laneRotR(v, idx2, 16);
        v = OpCodes.Xor32(OpCodes.RotR32(v, r1), oldW2);
        v = laneRotR(v, idx1, 8);
        const oldW0 = OpCodes.ToUint32(OpCodes.ToUint32(v - PI_CONST) - oldW1);

        W[0] = oldW0; W[1] = oldW1; W[2] = oldW2; W[3] = oldW3;
        W[4] = oldW4; W[5] = oldW5; W[6] = oldW6; W[7] = oldW7;
      }

      for (let i = 0; i < 8; i++) W[i] = OpCodes.Xor32(W[i], sched.table2[i]);

      const out = [];
      for (let i = 0; i < 8; i++) out.push(...OpCodes.Unpack32LE(W[i]));
      return out;
    }
  }

  const algorithmInstance = new DarkCryptParanoiaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptParanoiaAlgorithm, DarkCryptParanoiaInstance };
}));
