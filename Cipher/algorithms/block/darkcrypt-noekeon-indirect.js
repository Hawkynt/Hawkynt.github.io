/*
 * Noekeon-indirect (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The NOEKEON block cipher (Daemen, Peeters, Van Assche, Rijmen, 2000) run in
 * "indirect key" mode, as implemented by the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project).
 *
 * Per the NOEKEON specification (https://gro.noekeon.org/Noekeon-spec.pdf,
 * sections 2.3 and 3.6-3.7): NOEKEON defines two key-usage modes.
 *   - direct mode:   the Working Key equals the Cipher Key (see algorithms/block/noekeon.js)
 *   - indirect mode: the Working Key is derived from the Cipher Key by running
 *                     the full 16-round NOEKEON cipher function itself, using
 *                     the Cipher Key bytes as the State and an all-zero
 *                     "NullVector" as the Working Key for that derivation pass:
 *                       WorkingKey = CipherKey;
 *                       Noekeon(NullVector, WorkingKey);
 *                     The resulting WorkingKey is then used as the (fixed,
 *                     round-invariant) key for the normal 16 encryption rounds.
 *                     For decryption, the spec's InverseNoekeon additionally
 *                     applies Theta(NullVector, WorkingKey) to the derived
 *                     working key before running the rounds in reverse.
 *
 * 128-bit blocks, 128-bit keys, 16 rounds. Test vectors verified against the
 * DarkCrypt implementation.
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

  const NR = 16;
  const NULL_KEY = [0, 0, 0, 0];

  // RC[0..16], generated per spec section 3.7: RC[0]=0x80, LFSR-style doubling in GF(2)/0x1B.
  const ROUND_CONSTANTS = [0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d, 0x9a, 0x2f, 0x5e,
                            0xbc, 0x63, 0xc6, 0x97, 0x35, 0x6a, 0xd4];

  // Gamma: involutive non-linear mapping (spec section 3.3).
  function gamma(a) {
    const t = a[3];
    a[1] = OpCodes.XorN(a[1], OpCodes.OrN(a[3], a[2]));
    a[3] = OpCodes.XorN(a[0], OpCodes.AndN(a[2], ~a[1]));

    a[2] = OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(t, ~a[1]), a[2]), a[3]);

    a[1] = OpCodes.XorN(a[1], OpCodes.OrN(a[3], a[2]));
    a[0] = OpCodes.XorN(t, OpCodes.AndN(a[2], a[1]));
  }

  // Theta: linear mapping that mixes the Working Key k into state a (spec section 3.4).
  function theta(k, a) {
    let t02 = OpCodes.XorN(a[0], a[2]);
    t02 = OpCodes.XorN(OpCodes.XorN(t02, OpCodes.RotL32(t02, 8)), OpCodes.RotL32(t02, 24));

    a[0] = OpCodes.XorN(a[0], k[0]);
    a[1] = OpCodes.XorN(a[1], k[1]);
    a[2] = OpCodes.XorN(a[2], k[2]);
    a[3] = OpCodes.XorN(a[3], k[3]);

    a[1] = OpCodes.XorN(a[1], t02);
    a[3] = OpCodes.XorN(a[3], t02);

    let t13 = OpCodes.XorN(a[1], a[3]);
    t13 = OpCodes.XorN(OpCodes.XorN(t13, OpCodes.RotL32(t13, 8)), OpCodes.RotL32(t13, 24));

    a[0] = OpCodes.XorN(a[0], t13);
    a[2] = OpCodes.XorN(a[2], t13);
  }

  // Theta applied with an all-zero Working Key (used both to derive k' for
  // decryption and, per the spec's Theta-inverse identity, is its own inverse
  // building block). Matches spec section 3.4's "Theta(NullVector, k)".
  function thetaNullKey(a) {
    const state = [a[0], a[1], a[2], a[3]];
    theta(NULL_KEY, state);
    return state;
  }

  function pi1(a) {
    a[1] = OpCodes.RotL32(a[1], 1);
    a[2] = OpCodes.RotL32(a[2], 5);
    a[3] = OpCodes.RotL32(a[3], 2);
  }

  function pi2(a) {
    a[1] = OpCodes.RotL32(a[1], 31);
    a[2] = OpCodes.RotL32(a[2], 27);
    a[3] = OpCodes.RotL32(a[3], 30);
  }

  // Noekeon(WorkingKey, State): the forward cipher function per spec section 3.6.
  // Nr rounds of [State[0]^=RC[i]; Theta(k,State); Pi1; Gamma; Pi2], followed by
  // a final State[0]^=RC[Nr]; Theta(k,State).
  function noekeonForward(key, state) {
    const a = [state[0], state[1], state[2], state[3]];
    for (let i = 0; i < NR; i++) {
      a[0] = OpCodes.XorN(a[0], ROUND_CONSTANTS[i]);
      theta(key, a);
      pi1(a);
      gamma(a);
      pi2(a);
    }
    a[0] = OpCodes.XorN(a[0], ROUND_CONSTANTS[NR]);
    theta(key, a);
    return a;
  }

  // InverseNoekeon(WorkingKey, State): per spec section 3.6. The caller must
  // pass the already Theta(NullVector,.)-transformed key (k').
  function noekeonInverse(keyPrime, state) {
    const a = [state[0], state[1], state[2], state[3]];
    for (let i = NR; i > 0; i--) {
      theta(keyPrime, a);
      a[0] = OpCodes.XorN(a[0], ROUND_CONSTANTS[i]);
      pi1(a);
      gamma(a);
      pi2(a);
    }
    theta(keyPrime, a);
    a[0] = OpCodes.XorN(a[0], ROUND_CONSTANTS[0]);
    return a;
  }

  class DarkCryptNoekeonIndirectAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Noekeon-indirect (DarkCrypt)";
      this.description = "NOEKEON block cipher run in indirect-key mode: the Working Key is derived by running the full 16-round cipher on the Cipher Key with an all-zero round key before the normal rounds run. 128-bit block, 128-bit key.";
      this.inventor = "Joan Daemen, Michaël Peeters, Gilles Van Assche, Vincent Rijmen (base NOEKEON); DarkCrypt indirect-mode packaging by Alexander Myasnikov";
      this.year = 2000;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("NOEKEON Specification", "https://gro.noekeon.org/Noekeon-spec.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Educational implementation", "Non-standard variant packaging of NOEKEON; unanalyzed for this specific mode, not recommended for real use.", "Use AES or another vetted, standardized cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Noekeon-indirect — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("ba6933819299c71699a99f08f678178b")
        },
        {
          text: "DarkCrypt Noekeon-indirect — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("6fff9f6ac54c6ea21d72b895f3fd8776")
        },
        {
          text: "DarkCrypt Noekeon-indirect — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("4e2dde0990661763199db6895a6e7332")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptNoekeonIndirectInstance(this, isInverse);
    }
  }

  class DarkCryptNoekeonIndirectInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._roundKey = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Noekeon-indirect (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;

      // Cipher key -> 32-bit words (big-endian, per NOEKEON spec)
      const cipherKey = [
        OpCodes.Pack32BE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
        OpCodes.Pack32BE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
        OpCodes.Pack32BE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
        OpCodes.Pack32BE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
      ];

      // Indirect key mode (spec 3.6/3.7): WorkingKey = Noekeon(NullVector, CipherKey)
      const workingKey = noekeonForward(NULL_KEY, cipherKey);

      if (!this.isInverse) {
        this._roundKey = workingKey;
      } else {
        // InverseNoekeon first replaces the Working Key with Theta(NullVector, WorkingKey).
        this._roundKey = thetaNullKey(workingKey);
      }
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
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    _toWords(blockBytes) {
      return [
        OpCodes.Pack32BE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]),
        OpCodes.Pack32BE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]),
        OpCodes.Pack32BE(blockBytes[8], blockBytes[9], blockBytes[10], blockBytes[11]),
        OpCodes.Pack32BE(blockBytes[12], blockBytes[13], blockBytes[14], blockBytes[15])
      ];
    }

    _toBytes(words) {
      return [
        ...OpCodes.Unpack32BE(words[0]), ...OpCodes.Unpack32BE(words[1]),
        ...OpCodes.Unpack32BE(words[2]), ...OpCodes.Unpack32BE(words[3])
      ];
    }

    _encryptBlock(blockBytes) {
      const result = noekeonForward(this._roundKey, this._toWords(blockBytes));
      return this._toBytes(result);
    }

    _decryptBlock(blockBytes) {
      const result = noekeonInverse(this._roundKey, this._toWords(blockBytes));
      return this._toBytes(result);
    }
  }

  const algorithmInstance = new DarkCryptNoekeonIndirectAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptNoekeonIndirectAlgorithm, DarkCryptNoekeonIndirectInstance };
}));
