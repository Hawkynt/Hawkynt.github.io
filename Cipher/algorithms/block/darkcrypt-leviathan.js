/*
 * Leviathan (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Leviathan is implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). Although exposed through the
 * plugin's generic stream-cipher setup()/crypt() interface, crypt() only
 * ever advances and consumes exactly one 16-byte chunk of keystream per
 * call regardless of the requested length, which for a single-call
 * encryption behaves like a 128-bit-key, 128-bit-block cipher (the
 * underlying generator can still be run further for additional blocks,
 * which this implementation supports by keeping the generator state alive
 * across successive blocks).
 *
 * Internally the implementation builds a 256-entry word table via a
 * four-round, doubled RC4-style key schedule (Fluhrer/McGrew-style
 * "Leviathan" stream cipher construction), primes an internal
 * Fibonacci-style position counter together with sixteen table-driven
 * checkpoints, and then produces 32-bit keystream words via an
 * S-box-diffusion step, refreshing checkpoints via a single-step fallback
 * whenever the running counter drops under a 0x10000 threshold. The cipher
 * output for a block is a straight XOR of the block with the generated
 * keystream words (little-endian); consequently encryption and decryption
 * are the same self-inverse operation.
 *
 * 128-bit key, 128-bit block. Test vector verified against the DarkCrypt
 * implementation.
 * Educational only.
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

  const THRESHOLD = 0x10000;
  const CHECKPOINT_ROUNDS = 16; // number of doubling checkpoints built during priming

  // Build the 256-entry table via the four-round doubled RC4-style key schedule.
  function keySchedule(keyBytes) {
    const table = new Array(256).fill(0);
    for (let round = 0; round < 4; ++round) {
      for (let i = 0; i < 256; ++i)
        table[i] = OpCodes.ToUint32(OpCodes.Shl32(table[i], 8) + i);

      let j = round;
      for (let pass = 0; pass < 2; ++pass) {
        for (let i = 0; i < 256; ++i) {
          j = OpCodes.And32(j + OpCodes.And32(table[i], 0xFF) + keyBytes[i % 16], 0xFF);
          const t = table[i]; table[i] = table[j]; table[j] = t;
        }
      }
    }
    for (let k = 0; k < 256; ++k) table[k] = OpCodes.XorN(table[k], k);
    return table;
  }

  // Prime the Fibonacci-style position counter and build the doubling checkpoints
  // (equivalent to the priming call made once from setup() with position=0).
  function primeState(table) {
    let esi = 0x8000;
    let counter = 1;
    let eax = 0, edx = 0;
    let index = 0;

    const history1 = new Array(CHECKPOINT_ROUNDS).fill(0);
    const history2 = new Array(CHECKPOINT_ROUNDS).fill(0);
    const history3 = new Array(CHECKPOINT_ROUNDS).fill(0);

    for (;;) {
      eax = OpCodes.ToUint32(eax + counter);
      edx = OpCodes.ToUint32(edx + eax);
      eax = OpCodes.ToUint32(eax + edx);

      history1[index] = eax;
      history2[index] = edx;
      history3[index] = counter;
      index++;

      edx = OpCodes.RotR32(edx, 8);
      eax = OpCodes.XorN(eax, table[OpCodes.And32(eax, 0xFF)]);
      edx = OpCodes.XorN(edx, table[OpCodes.And32(edx, 0xFF)]);
      edx = OpCodes.RotR32(edx, 8);
      eax = OpCodes.RotL32(eax, 8);
      eax = OpCodes.XorN(eax, table[OpCodes.And32(eax, 0xFF)]);
      edx = OpCodes.XorN(edx, table[OpCodes.And32(edx, 0xFF)]);
      counter = OpCodes.ToUint32(counter * 2);
      eax = OpCodes.RotL32(eax, 8);

      esi = OpCodes.Shr32(esi, 1);
      if (!(esi > 0)) break;
    }

    return {
      index, x1: eax, x2: edx, x3: counter,
      history1, history2, history3
    };
  }

  // Produce `count` 32-bit keystream words, advancing state in place.
  function generateWords(table, state, count) {
    const out = [];
    let index = state.index;
    let eax = state.x1, edx = state.x2, ecx = state.x3;
    const h1 = state.history1, h2 = state.history2, h3 = state.history3;

    for (let k = 0; k < count; ++k) {
      // Refresh (extend) checkpoints via single-step advances while the
      // running position counter is below the fast-generation threshold.
      while (ecx < THRESHOLD) {
        let a = eax, d = edx, c = ecx;
        a = OpCodes.ToUint32(a + c);
        d = OpCodes.ToUint32(d + a);
        a = OpCodes.ToUint32(a + d);
        h1[index] = a; h2[index] = d; h3[index] = c;

        d = OpCodes.RotR32(d, 8);
        a = OpCodes.XorN(a, table[OpCodes.And32(a, 0xFF)]);
        d = OpCodes.XorN(d, table[OpCodes.And32(d, 0xFF)]);
        d = OpCodes.RotR32(d, 8);
        a = OpCodes.RotL32(a, 8);
        a = OpCodes.XorN(a, table[OpCodes.And32(a, 0xFF)]);
        d = OpCodes.XorN(d, table[OpCodes.And32(d, 0xFF)]);
        c = OpCodes.ToUint32(c * 2);
        a = OpCodes.RotL32(a, 8);

        eax = a; edx = d; ecx = c;
        index++;
      }

      // Fast path: emit one keystream word from the current state, then
      // pull the next word forward from the previous checkpoint.
      out.push(OpCodes.XorN(eax, edx));

      let a = OpCodes.ToUint32(~h1[index - 1]);
      a = OpCodes.RotR32(a, 8);
      a = OpCodes.XorN(a, table[OpCodes.And32(a, 0xFF)]);
      a = OpCodes.RotR32(a, 8);
      a = OpCodes.XorN(a, table[OpCodes.And32(a, 0xFF)]);

      let d = h2[index - 1];
      d = OpCodes.XorN(d, table[OpCodes.And32(d, 0xFF)]);
      d = OpCodes.RotL32(d, 8);
      d = OpCodes.XorN(d, table[OpCodes.And32(d, 0xFF)]);
      d = OpCodes.RotL32(d, 8);

      const newX3 = OpCodes.ToUint32(2 * h3[index - 1] + 1);
      eax = a; edx = d; ecx = newX3;
      index--;
    }

    state.index = index; state.x1 = eax; state.x2 = edx; state.x3 = ecx;
    return out;
  }

  class DarkCryptLeviathanAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Leviathan (DarkCrypt)";
      this.description = "Keystream-driven block cipher from the DarkCrypt Total Commander plugin: a four-round doubled RC4-style table schedule feeds a Fibonacci-style position counter with S-box-diffused output words, XORed with the block. Exposed through the plugin's generic stream setup()/crypt() interface but only ever advances one 16-byte block per call.";
      this.inventor = "Leviathan stream cipher by David McGrew and Scott Fluhrer; DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];   // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Leviathan stream cipher (NESSIE submission)", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/leviathan.zip")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard exposure", "Exposed as a single-block primitive via a stream-cipher interface that discards the requested length; the underlying keystream generator is unanalyzed as reconstructed here and not recommended for real use.", "Use a vetted stream or block cipher.")
      ];

      // Test vector verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Leviathan — zero block, incrementing key",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("3d2a20bbae89b73ffc9e78598186ef31")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptLeviathanInstance(this, isInverse);
    }
  }

  class DarkCryptLeviathanInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._table = null;
      this._state = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._table = null; this._state = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Leviathan (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._table = keySchedule(this._key);
      this._state = primeState(this._table);
    }

    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % this.BlockSize !== 0)
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...this._transformBlock(block));
      }
      this.inputBuffer = [];
      return output;
    }

    // Encryption and decryption are the same XOR-with-keystream operation
    // (self-inverse); the generator state advances identically either way.
    _transformBlock(block) {
      const words = generateWords(this._table, this._state, 4);
      const ks = [];
      for (const w of words) ks.push(...OpCodes.Unpack32LE(w));

      const out = new Array(this.BlockSize);
      for (let i = 0; i < this.BlockSize; ++i) out[i] = OpCodes.XorN(block[i], ks[i]);
      return out;
    }
  }

  const algorithmInstance = new DarkCryptLeviathanAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptLeviathanAlgorithm, DarkCryptLeviathanInstance };
}));
