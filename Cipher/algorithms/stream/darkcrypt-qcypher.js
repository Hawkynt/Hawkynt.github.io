/*
 * QCypher (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * QCypher as implemented in the DarkCrypt Total Commander plugin (Alexander
 * Myasnikov, "Zarya" project).
 *
 * Unlike most ciphers in this DarkCrypt batch (setup(key,iv) plus
 * crypt(buf,len) doing an independent-keystream XOR), QCypher takes a fixed
 * 64-byte (512-bit) key with no IV, and processes data one byte at a time:
 *   setup(key)         - initializes the internal state from the 64-byte key
 *   crypt(byteValue)   - transforms one byte and returns one byte
 *
 * crypt() is an autokey/self-feedback byte transform: the returned byte is a
 * non-trivial function of both the current internal state (a 256-byte table
 * plus three running indices A,B,C) AND the input byte itself (the input byte
 * feeds an S-box lookup, not just a final XOR), so the plaintext byte
 * directly becomes the ciphertext byte -- there is no separate "keystream to
 * XOR externally" step. This matches the readme's "(512 bit, CBC)" label
 * (chained/self-referential, not a plain independent keystream). setup() runs
 * the 64-byte key through this same transform twice more (once per key byte,
 * once for the bytes 0..255) as its key-schedule warm-up.
 *
 * No separate decrypt operation is defined by the plugin (only "crypt" and
 * "setup" exist). For a fixed internal state, the byte transform is a
 * bijection on 0..255, so decryption here inverts it by searching, for each
 * ciphertext byte and the current state, the unique plaintext byte whose
 * encryption under that state produces the given ciphertext byte, then
 * committing the real state update with that recovered plaintext byte --
 * reproducing the only self-consistent inverse of the transform.
 *
 * 64-byte (512-bit) key, no IV. Educational only.
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

  const KEY_SIZE = 64; // 512 bits

  class QCypherState {
    constructor() {
      this.sbox = new Array(256).fill(0);
      this.A = 0;
      this.B = 0;
      this.C = 0;
    }

    clone() {
      const s = new QCypherState();
      s.sbox = this.sbox.slice();
      s.A = this.A;
      s.B = this.B;
      s.C = this.C;
      return s;
    }
  }

  // The single-byte "crypt" transform used internally by QCypher.
  // Mutates state in place and returns the transformed byte.
  function qcTransform(state, P) {
    const S = state.sbox;
    const A = state.A, B = state.B, C = state.C;

    const T3 = S[A];
    const T4 = S[T3];
    const T5 = S[B];
    const T6 = S[T5];

    const T7 = OpCodes.Xor8(P, OpCodes.And8(S[OpCodes.Xor8(OpCodes.And8(P, 0x55), A)], 0xAA));
    const T8 = OpCodes.Xor8(T7, OpCodes.And8(S[OpCodes.Xor8(OpCodes.And8(T7, 0xAA), B)], 0x55));
    const T9 = OpCodes.Xor8(OpCodes.Xor8(T8, OpCodes.AddMod(A, B, 256)), OpCodes.AddMod(T3, T5, 256));
    const T10 = OpCodes.Xor8(T9, OpCodes.And8(S[OpCodes.Xor8(B, OpCodes.And8(T9, 0xAA))], 0x55));
    const T11 = OpCodes.Xor8(T10, OpCodes.And8(S[OpCodes.Xor8(A, OpCodes.And8(T10, 0x55))], 0xAA));

    const T12 = OpCodes.And8(P, T11);
    const T13 = OpCodes.Xor8(P, T11);
    const T14 = OpCodes.And8(T8, T9);
    const T15 = OpCodes.Xor8(T8, T9);
    const T16 = OpCodes.Xor8(A, T15);
    const T17 = OpCodes.Xor8(B, T15);

    S[C] = OpCodes.Xor8(S[C], T16);
    const Cx80 = OpCodes.Xor8(C, 0x80);
    S[Cx80] = OpCodes.Xor8(S[Cx80], T17);

    state.A = OpCodes.ToByte(A + T12 + T6 + 1);
    state.B = OpCodes.Xor8(B, OpCodes.Xor8(T13, OpCodes.Xor8(T14, T4)));
    state.C = OpCodes.ToByte(C + 1);

    return T11;
  }

  function qcSetup(key) {
    const state = new QCypherState();
    for (let i = 0; i < KEY_SIZE; i++)
      state.sbox[i] = OpCodes.Xor8(state.sbox[i], key[i]);

    state.A = state.B = state.C = 0;

    for (let i = 0; i < KEY_SIZE; i++)
      qcTransform(state, key[i]);

    for (let i = 0; i < 256; i++)
      qcTransform(state, OpCodes.And32(i, 0xFF));

    return state;
  }

  class QCypherAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "QCypher (DarkCrypt)";
      this.description = "Autokey byte-feedback stream cipher from the DarkCrypt Total Commander plugin. A 256-entry table plus three running indices are updated on every byte using an S-box-driven transform in which the plaintext byte itself indexes the table, so encryption is not a plain independent-keystream XOR.";
      this.inventor = "DarkCrypt variant by Alexander Myasnikov";
      this.year = 2013;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(KEY_SIZE, KEY_SIZE, 0)]; // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard, unanalyzed construction", "Ad-hoc autokey S-box transform with no public design rationale or cryptanalysis; not recommended for real use.", "Use a vetted stream cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation
      // (setup(key) then crypt(byte) applied per byte).
      this.tests = [
        {
          text: "DarkCrypt Qcypher — keystream from incrementing key, zero plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("bfc942b0682ded41418464d6357e8dba86af59fb971424fcd25b5827fe74dd437d12caa54d09e4d0c2a3d4db2b16f6c1fece08767dcbe78442036d83b7d3acb92b57e4543371e0caca4810784571a8fe7599cbaffe3c7e3e1a7810d3bd5a2330972af0bda7ab74edb6e12b6a81557704c01d8af10a9cf6cde1c016f5313e78ef")
        },
        {
          text: "DarkCrypt Qcypher — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("bf3502c4af056921ca34a9b99e94c4eb3872e9bf05d36fcc8d04bd78800e9b817d2984e03ba9c5f58f022631ef4111ddbd859b5fa4673acc7f9b7a6ebb0e589e")
        },
        {
          text: "DarkCrypt Qcypher — all-zero key, zero plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("f234bc5b14597fb310906d97aff87900")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new QCypherInstance(this, isInverse);
    }
  }

  class QCypherInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._state = null;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._state = null; return; }
      if (keyBytes.length !== KEY_SIZE)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. QCypher (DarkCrypt) requires exactly ${KEY_SIZE} bytes`);
      this._key = [...keyBytes];
      this._state = qcSetup(this._key);
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

      const output = [];
      if (this.isInverse) {
        for (let i = 0; i < this.inputBuffer.length; i++)
          output.push(this._decryptByte(this.inputBuffer[i]));
      } else {
        for (let i = 0; i < this.inputBuffer.length; i++)
          output.push(qcTransform(this._state, this.inputBuffer[i]));
      }

      this.inputBuffer = [];
      return output;
    }

    // Inverts the per-state bijection: finds the plaintext byte whose forward
    // transform under the current state equals the given ciphertext byte, then
    // commits the real state update using that plaintext byte.
    _decryptByte(cipherByte) {
      for (let p = 0; p < 256; p++) {
        const probe = this._state.clone();
        if (qcTransform(probe, p) === cipherByte) {
          qcTransform(this._state, p);
          return p;
        }
      }
      throw new Error("QCypher (DarkCrypt): no matching plaintext byte found for state (unexpected)");
    }
  }

  const algorithmInstance = new QCypherAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { QCypherAlgorithm, QCypherInstance };
}));
