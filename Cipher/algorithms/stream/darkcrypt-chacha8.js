/*
 * ChaCha8 (DarkCrypt) Stream Cipher
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * Reduced-round (8-round) ChaCha variant using the original Bernstein
 * state layout: 256-bit key, 64-bit block counter (state words 12-13),
 * and 64-bit nonce (state words 14-15) - as opposed to the RFC 7539
 * layout (32-bit counter + 96-bit nonce) used by modern ChaCha20.
 *
 * This matches the "ChaCha" implementation in the DarkCrypt Total Commander
 * plugin, which exposes a fixed 256-bit key, 64-bit IV, and an 8-round
 * permutation.
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class ChaCha8DarkCryptAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "ChaCha8 (DarkCrypt)";
      this.description = "Reduced-round (8-round) ChaCha variant with the original Bernstein state layout (64-bit block counter + 64-bit nonce, instead of RFC 7539's 32-bit counter + 96-bit nonce). Matches the DarkCrypt Total Commander plugin's ChaCha implementation.";
      this.inventor = "Daniel J. Bernstein (base cipher); DarkCryptTC (parameterization)";
      this.year = 2008;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.SupportedKeySizes = [new KeySize(32, 32, 1)];
      this.SupportedNonceSizes = [new KeySize(8, 8, 1)];
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("Bernstein: ChaCha, a variant of Salsa20", "https://cr.yp.to/chacha/chacha-20080128.pdf"),
        new LinkItem("RFC 7539: ChaCha20 and Poly1305 for IETF Protocols (for comparison)", "https://tools.ietf.org/html/rfc7539"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.references = [
        new LinkItem("Bernstein's Original ChaCha Reference Implementation (eSTREAM submission)", "https://cr.yp.to/streamciphers/timings/estreambench/submissions/salsa20/chacha8/ref/chacha.c"),
        new LinkItem("DarkCryptTC", "https://sourceforge.net/projects/darkcrypttc/")
      ];

      this.tests = [
        {
          text: "DarkCrypt Chacha - 128-byte keystream (key=00..1F, nonce=0)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          nonce: OpCodes.Hex8ToBytes("0000000000000000"),
          input: new Array(128).fill(0),
          expected: OpCodes.Hex8ToBytes("4015b28f6e12ab6ad9e8667b31c51233f78f172790b2d94f326b2ed7ffbcbecbff9ead365f89ce3b6f4055bc759d90fd8f831d27c7b0df93b3b9ed8238a256d6761a6e0fc8b2b859f5a9f3ae170a7599b0b023ce79d7659b32ee79373e727289712ff289f30f641fcd822ff8e656ffd8725691f839a7b433a5b61053d99baee0")
        },
        {
          text: "DarkCrypt Chacha - enc of 00..3F (key=00..1F, nonce=0)",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          nonce: OpCodes.Hex8ToBytes("0000000000000000"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("4014b08c6a17ad6dd1e16c703dc81c3ce79e053484a7cf582a7234cce3a1a0d4dfbf8f157bace81c47697f9759b0bed2bfb22f14f385e9a48b80d7b9049f68e9")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new ChaCha8DarkCryptInstance(this, isInverse);
    }
  }

  class ChaCha8DarkCryptInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._nonce = new Array(8).fill(0);
      this.counterLo = 0;
      this.counterHi = 0;
      this.state = new Array(16);
      this.keystreamBuffer = [];
      this.keystreamPosition = 0;

      this.CONSTANTS = [
        OpCodes.Pack32LE(0x65, 0x78, 0x70, 0x61), // "expa"
        OpCodes.Pack32LE(0x6e, 0x64, 0x20, 0x33), // "nd 3"
        OpCodes.Pack32LE(0x32, 0x2d, 0x62, 0x79), // "2-by"
        OpCodes.Pack32LE(0x74, 0x65, 0x20, 0x6b)  // "te k"
      ];
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this._initializeState();
    }

    get key() { return this._key ? [...this._key] : null; }

    set nonce(nonceBytes) {
      if (!nonceBytes || nonceBytes.length !== 8) {
        this._nonce = new Array(8).fill(0);
      } else {
        this._nonce = [...nonceBytes];
      }
      this._initializeState();
    }

    get nonce() { return this._nonce ? [...this._nonce] : null; }

    set iv(ivBytes) {
      this.nonce = ivBytes;
    }

    get iv() { return this.nonce; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._getNextKeystreamByte();
        output.push(OpCodes.XorN(this.inputBuffer[i], keystreamByte));
      }

      this.inputBuffer = [];
      return output;
    }

    _initializeState() {
      if (!this._key || !this._nonce) return;

      // Constants (words 0-3)
      for (let i = 0; i < 4; i++) {
        this.state[i] = this.CONSTANTS[i];
      }

      // Key (words 4-11)
      for (let i = 0; i < 8; i++) {
        const offset = i * 4;
        this.state[4 + i] = OpCodes.Pack32LE(
          this._key[offset],
          this._key[offset + 1],
          this._key[offset + 2],
          this._key[offset + 3]
        );
      }

      // 64-bit block counter (words 12-13), original Bernstein layout
      this.counterLo = 0;
      this.counterHi = 0;
      this.state[12] = 0;
      this.state[13] = 0;

      // 64-bit nonce (words 14-15)
      for (let i = 0; i < 2; i++) {
        const offset = i * 4;
        this.state[14 + i] = OpCodes.Pack32LE(
          this._nonce[offset],
          this._nonce[offset + 1],
          this._nonce[offset + 2],
          this._nonce[offset + 3]
        );
      }

      this.keystreamBuffer = [];
      this.keystreamPosition = 0;
    }

    _quarterRound(state, a, b, c, d) {
      state[a] = OpCodes.Add32(state[a], state[b]);
      state[d] = OpCodes.XorN(state[d], state[a]);
      state[d] = OpCodes.RotL32(state[d], 16);

      state[c] = OpCodes.Add32(state[c], state[d]);
      state[b] = OpCodes.XorN(state[b], state[c]);
      state[b] = OpCodes.RotL32(state[b], 12);

      state[a] = OpCodes.Add32(state[a], state[b]);
      state[d] = OpCodes.XorN(state[d], state[a]);
      state[d] = OpCodes.RotL32(state[d], 8);

      state[c] = OpCodes.Add32(state[c], state[d]);
      state[b] = OpCodes.XorN(state[b], state[c]);
      state[b] = OpCodes.RotL32(state[b], 7);
    }

    _generateBlock() {
      this.state[12] = this.counterLo;
      this.state[13] = this.counterHi;

      const workingState = this.state.slice(0);

      // 8 rounds (4 double-rounds)
      for (let round = 0; round < 4; round++) {
        this._quarterRound(workingState, 0, 4, 8, 12);
        this._quarterRound(workingState, 1, 5, 9, 13);
        this._quarterRound(workingState, 2, 6, 10, 14);
        this._quarterRound(workingState, 3, 7, 11, 15);

        this._quarterRound(workingState, 0, 5, 10, 15);
        this._quarterRound(workingState, 1, 6, 11, 12);
        this._quarterRound(workingState, 2, 7, 8, 13);
        this._quarterRound(workingState, 3, 4, 9, 14);
      }

      for (let i = 0; i < 16; i++) {
        workingState[i] = OpCodes.Add32(workingState[i], this.state[i]);
      }

      const keystream = [];
      for (let i = 0; i < 16; i++) {
        const bytes = OpCodes.Unpack32LE(workingState[i]);
        keystream.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }

      // Increment 64-bit counter for next block
      this.counterLo = OpCodes.Add32(this.counterLo, 1);
      if (this.counterLo === 0) {
        this.counterHi = OpCodes.Add32(this.counterHi, 1);
      }

      return keystream;
    }

    _getNextKeystreamByte() {
      if (this.keystreamPosition >= this.keystreamBuffer.length) {
        this.keystreamBuffer = this._generateBlock();
        this.keystreamPosition = 0;
      }

      return this.keystreamBuffer[this.keystreamPosition++];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ChaCha8DarkCryptAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ChaCha8DarkCryptAlgorithm, ChaCha8DarkCryptInstance };
}));
