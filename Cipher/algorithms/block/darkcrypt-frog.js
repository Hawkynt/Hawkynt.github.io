/*
 * FROG-256 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * FROG as implemented in the DarkCrypt Total Commander plugin (Alexander Myasnikov,
 * "Zarya" project). FROG, by Georgoudis, Leroux and Chaves (TecApro Intl.), is an
 * AES-candidate cipher whose defining feature is a fully key-dependent "internal
 * key" (substitution/permutation tables) rather than fixed round tables. The user
 * key only serves to derive this internal key; the actual encryption/decryption
 * primitive is a short, fixed sequence of byte operations driven entirely by the
 * internal key's per-round records.
 *
 * Internal key derivation (128-bit block, 8 rounds, 256-bit user key):
 *  1. A fixed 251-byte "random seed" table is built from the first 251 five-digit
 *     groups of the RAND Corporation "A Million Random Digits" table, each taken
 *     mod 256 (the same nothing-up-my-sleeve source used by Merkle's Khufu/Khafre).
 *  2. simpleKey[i] = seed[i % 251] XOR key[i % keyLength], for the full internal
 *     key length (blockLength*2 + 256) * rounds = 2304 bytes for 128-bit blocks.
 *  3. simpleKey is split into 8 round records of {xorBu[16], substPermu[256],
 *     bombPermu[16]}; substPermu and bombPermu are each turned into random
 *     permutations via a key-driven Fisher-Yates-style shuffle (makePermutation),
 *     and bombPermu is additionally forced into a single full-length cycle.
 *  4. An IV (seeded from the user key XOR key length) is repeatedly FROG-encrypted
 *     with this intermediate internal key (like OFB self-keying) to produce the
 *     FINAL internal key material, which is again split/permuted the same way.
 *
 * Round function per byte i of the state: state[i] = substPermu[state[i] XOR
 * xorBu[i]]; state[i+1] ^= state[i]; state[bombPermu[i]] ^= state[i]. Decryption
 * runs the same per-byte steps in reverse order with an inverted substPermu.
 *
 * The DarkCrypt implementation matches the standard FROG-128/256 construction
 * exactly (validated against DarkCrypt vectors: no DarkCrypt-specific
 * deviation found).
 * 128-bit blocks, 256-bit keys. Educational only.
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

  const ROUNDS = 8;
  const BLOCK_LEN = 16;

  // First 251 five-digit groups of "A Million Random Digits with 100,000 Normal
  // Deviates" (RAND Corporation, 1955), each string interpreted as a decimal
  // integer and reduced mod 256. This is the standard FROG/Merkle nothing-up-
  // my-sleeve seed (identical text also used for Khufu/Khafre/Snefru S-boxes).
  const RAND_DIGITS =
    "100973253376520135863467354876809590911739292749453754204805648947429624" +
    "805240372063610402008229166508422689531964509303232090256015953347643508" +
    "033606990190252909376707153831131165886767439704436276591280799970801573" +
    "614764032366539895116877121717683366065747173407276850366973617065813398" +
    "851119929170310601080545571824063530342614867990743923403097328526977602" +
    "020516569268665748187305385247186238857963573321350532547048905535754828" +
    "468287098349125624737964575303529647783580834282609352034435273884359852" +
    "017767149056860722109405586097093433505007399811805054313980827732507256" +
    "824829405242015277567851834529963406288980831374670078184754061068711778" +
    "178868540200865075840136766679519036476493296091106299594673488751764969" +
    "918260892893785613682347834113654811767417468509505804776974730395718640" +
    "218165448012435635177270801545318223742111578253143855376374350998177740" +
    "277214432360021045521642379628602655699162680366252291483693687203766211" +
    "399094400564180989320505142256851446427567889629778822543821459891499145" +
    "236847927686461628355494750899233708920048803369459826940368587029734135" +
    "531403334042050823414410481949851574795432979265755760040881222220641312" +
    "550737421110002040128607469796644894392870725815636064932916505344844021" +
    "9525634365177082072073179061196";

  function buildRandomSeed() {
    const seed = new Array(251);
    for (let i = 0; i < 251; i++) {
      seed[i] = parseInt(RAND_DIGITS.substr(i * 5, 5), 10) % 256;
    }
    return seed;
  }

  const RANDOM_SEED = buildRandomSeed();

  function makePermutation(input) {
    const length = input.length;
    const use = new Array(length);
    for (let i = 0; i < length; i++) use[i] = i;
    let index = 0;
    let last = length - 1;
    for (let i = 0; i < length - 1; i++) {
      index = (index + input[i]) % (last + 1);
      input[i] = use[index];
      if (index < last) use.splice(index, 1);
      last--;
      if (index > last) index = 0;
    }
    input[length - 1] = use[0];
  }

  function invertPermutation(permutation) {
    const temp = new Array(permutation.length);
    for (let i = 0; i < permutation.length; i++) temp[permutation[i]] = i;
    for (let i = 0; i < permutation.length; i++) permutation[i] = temp[i];
  }

  // Merges any smaller cycles within bombPermu into a single full-length cycle,
  // which is required for the round function's avalanche property to hold.
  function make1Cycle(bombPermu, blockLength) {
    const used = new Array(blockLength).fill(0);
    let j = 0;
    for (let i = 0; i < blockLength - 1; i++) {
      if (bombPermu[j] === 0) {
        let k = j;
        do {
          k = (k + 1) % blockLength;
        } while (used[k] !== 0);
        bombPermu[j] = k;
        let l = k;
        while (bombPermu[l] !== k) l = bombPermu[l];
        bombPermu[l] = 0;
      }
      used[j] = 1;
      j = bombPermu[j];
    }
  }

  // Prevents bombPermu[i] from pointing at the same index the round function
  // already XORs via the "next byte" step (which would otherwise cancel out).
  function removeReferences(bombPermu, blockLength) {
    for (let i = 0; i < blockLength; i++) {
      const j = (i + 1) % blockLength;
      if (bombPermu[i] === j) bombPermu[i] = (j + 1) % blockLength;
    }
  }

  function toStructuredKey(bytes, blockLength, rounds) {
    const subkeyLength = bytes.length / rounds;
    const result = new Array(rounds);
    for (let r = 0; r < rounds; r++) {
      const offsetXorBu = r * subkeyLength;
      const offsetSubstPermu = offsetXorBu + blockLength;
      const offsetBombPermu = offsetSubstPermu + 256;
      result[r] = {
        xorBu: bytes.slice(offsetXorBu, offsetSubstPermu),
        substPermu: bytes.slice(offsetSubstPermu, offsetBombPermu),
        bombPermu: bytes.slice(offsetBombPermu, offsetBombPermu + blockLength)
      };
    }
    return result;
  }

  function makeInternalKey(key, blockLength, rounds, decrypt) {
    const structuredKey = toStructuredKey(key, blockLength, rounds);
    for (let r = 0; r < rounds; r++) {
      const { substPermu, bombPermu } = structuredKey[r];
      makePermutation(substPermu);
      if (decrypt) invertPermutation(substPermu);
      makePermutation(bombPermu);
      make1Cycle(bombPermu, blockLength);
      removeReferences(bombPermu, blockLength);
    }
    return structuredKey;
  }

  function frogEncrypt(state, keys) {
    for (let r = 0; r < keys.length; r++) {
      const key = keys[r];
      for (let i = 0; i < state.length; i++) {
        state[i] = key.substPermu[OpCodes.Xor32(state[i], key.xorBu[i])];
        const next = (i + 1) % state.length;
        state[next] ^= state[i];
        const k = key.bombPermu[i];
        state[k] ^= state[i];
      }
    }
  }

  function frogDecrypt(state, keys) {
    for (let r = keys.length - 1; r >= 0; r--) {
      const key = keys[r];
      for (let i = state.length - 1; i >= 0; i--) {
        const k = key.bombPermu[i];
        state[k] ^= state[i];
        const next = (i + 1) % state.length;
        state[next] ^= state[i];
        state[i] = OpCodes.Xor32(key.substPermu[state[i]], key.xorBu[i]);
      }
    }
  }

  function generateKeys(keyBytes, blockLength, rounds, decrypt) {
    const keyLength = keyBytes.length;
    const internalKeyLength = (blockLength * 2 + 256) * rounds;

    const simpleKey = new Array(internalKeyLength);
    for (let i = 0; i < simpleKey.length; i++) {
      simpleKey[i] = OpCodes.Xor32(RANDOM_SEED[i % 251], keyBytes[i % keyLength]);
    }

    const internalKey = makeInternalKey(simpleKey, blockLength, rounds, false);

    const iv = new Array(blockLength).fill(0);
    const ivLength = Math.min(keyLength, blockLength);
    for (let i = 0; i < ivLength; i++) iv[i] ^= keyBytes[i];
    iv[0] ^= keyLength;

    let i = 0;
    const result = new Array(internalKeyLength);
    while (i < internalKeyLength) {
      frogEncrypt(iv, internalKey);
      let length = internalKeyLength - i;
      if (length > blockLength) length = blockLength;
      for (let j = 0; j < length; j++) result[i + j] = iv[j];
      i += length;
    }
    return makeInternalKey(result, blockLength, rounds, decrypt);
  }

  class DarkCryptFROGAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "FROG-256 (DarkCrypt)";
      this.description = "FROG AES candidate: fully key-dependent substitution/permutation network, where the user key derives a large \"internal key\" of per-round S-box and diffusion tables rather than driving fixed round logic. 128-bit block, 256-bit key, 8 rounds. As implemented in the DarkCrypt Total Commander plugin, matching the standard FROG-128 construction exactly.";
      this.inventor = "Dianelos Georgoudis, Damian Leroux, Billy Simón Chaves (TecApro Intl.); DarkCrypt packaging by Alexander Myasnikov";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];   // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("FROG (Wikipedia)", "https://en.wikipedia.org/wiki/FROG"),
        new LinkItem("The FROG Encryption Algorithm (TecApro AES submission)", "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/aes-development/frog.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Weak key classes", "Wagner et al. found significant weak-key classes and chosen-plaintext/ciphertext attacks; slow key setup; not selected as an AES finalist.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Frog — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("b57897cc533074f1a543bf69b65c7bbc")
        },
        {
          text: "DarkCrypt Frog — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("2bbb1026a5608ad9bd14ea5064982eb9")
        },
        {
          text: "DarkCrypt Frog — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("26fba6a7bbb41616d89c83bd83d97a47")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptFROGInstance(this, isInverse);
    }
  }

  class DarkCryptFROGInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._roundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = BLOCK_LEN;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._roundKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. FROG-256 (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._roundKeys = generateKeys(this._key, BLOCK_LEN, ROUNDS, this.isInverse);
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
        const state = block.slice();
        if (this.isInverse) frogDecrypt(state, this._roundKeys);
        else frogEncrypt(state, this._roundKeys);
        output.push(...state);
      }
      this.inputBuffer = [];
      return output;
    }
  }

  const algorithmInstance = new DarkCryptFROGAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptFROGAlgorithm, DarkCryptFROGInstance };
}));
