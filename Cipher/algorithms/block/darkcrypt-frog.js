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
  // Deviates" (RAND Corporation, 1955), each group read as a decimal integer and
  // reduced mod 256 (group 0 "10097" -> 0x71, group 1 "32533" -> 0x15, ...). This is
  // the standard FROG/Merkle nothing-up-my-sleeve seed (identical text also used
  // for Khufu/Khafre/Snefru S-boxes).
  const RANDOM_SEED = OpCodes.Hex8ToBytes(
    "7115e812715c3f9d7cc1a6c57e38e5e59ca23611e659bd57a90051cc0846cbe1a03ba7bd649d540b07821d33202d87ed8b21" +
    "11dd1832594a15cdbff2543503e6e7760f0f6b041522039c39425dffbf035587cdc8b9cc3425231844b9c90ae0ea0778c973" +
    "d86739ff5d6e2af9440e1d3780542598dd89270bfc329023b2be2ba267f96d08eb219e6ffccda9360a14ddc9b2e059b8b641" +
    "c90a3c06bfae4f621aa0fc333f4f06667bad31036ee95a9ee4d2d1ed1e5f1cb3ccdc48a34da6c062a51991a25bd429e66e06" +
    "6bbb7f2652621e43e150d0863cfa9957943c42a5481da552d3cf00b1ce0d060e5cf83cc9845f23d776b179b41b53831a272e" +
    "0c"
  );

  /**
   * Turn a byte array into a permutation of 0..length-1 in place, driven by its
   * own contents.
   * @param {uint8[]} input - Bytes to permute (length at most 256)
   */
  function makePermutation(input) {
    const length = input.length;
    /** @type {uint8[]} */
    const use = new Array(length);
    for (let i = 0; i < length; i++) use[i] = i;
    /** @type {uint32} */
    let index = 0;
    let last = length - 1;
    for (let i = 0; i < length - 1; i++) {
      index = OpCodes.Add32(index, input[i]) % (last + 1);
      input[i] = use[index];
      if (index < last) use.splice(index, 1);
      last--;
      if (index > last) index = 0;
    }
    input[length - 1] = use[0];
  }

  /**
   * @param {uint8[]} permutation - Permutation to invert in place
   */
  function invertPermutation(permutation) {
    /** @type {uint8[]} */
    const temp = new Array(permutation.length);
    for (let i = 0; i < permutation.length; i++) temp[permutation[i]] = i;
    for (let i = 0; i < permutation.length; i++) permutation[i] = temp[i];
  }

  // Merges any smaller cycles within bombPermu into a single full-length cycle,
  // which is required for the round function's avalanche property to hold.
  /**
   * @param {uint8[]} bombPermu - Diffusion permutation, modified in place
   * @param {int32} blockLength - Block length in bytes
   */
  function make1Cycle(bombPermu, blockLength) {
    /** @type {uint8[]} */
    const used = new Array(blockLength);
    for (let i = 0; i < blockLength; i++) used[i] = 0;
    /** @type {uint8} */
    let j = 0;
    for (let i = 0; i < blockLength - 1; i++) {
      if (bombPermu[j] === 0) {
        /** @type {int32} */
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
  /**
   * @param {uint8[]} bombPermu - Diffusion permutation, modified in place
   * @param {int32} blockLength - Block length in bytes
   */
  function removeReferences(bombPermu, blockLength) {
    for (let i = 0; i < blockLength; i++) {
      const j = (i + 1) % blockLength;
      if (bombPermu[i] === j) bombPermu[i] = (j + 1) % blockLength;
    }
  }

  // The internal key is a flat list of three tables per round r:
  // [3r] xorBu (blockLength bytes), [3r+1] substPermu (256 bytes),
  // [3r+2] bombPermu (blockLength bytes).
  /**
   * @param {uint8[]} bytes - Raw internal key bytes
   * @param {int32} blockLength - Block length in bytes
   * @param {int32} rounds - Number of rounds
   * @returns {uint8[][]} Three tables per round
   */
  function toStructuredKey(bytes, blockLength, rounds) {
    const subkeyLength = bytes.length / rounds;
    /** @type {uint8[][]} */
    const result = [];
    for (let r = 0; r < rounds; r++) {
      const offsetXorBu = r * subkeyLength;
      const offsetSubstPermu = offsetXorBu + blockLength;
      const offsetBombPermu = offsetSubstPermu + 256;
      result.push(bytes.slice(offsetXorBu, offsetSubstPermu));
      result.push(bytes.slice(offsetSubstPermu, offsetBombPermu));
      result.push(bytes.slice(offsetBombPermu, offsetBombPermu + blockLength));
    }
    return result;
  }

  /**
   * @param {uint8[]} key - Raw internal key bytes
   * @param {int32} blockLength - Block length in bytes
   * @param {int32} rounds - Number of rounds
   * @param {boolean} decrypt - Invert the substitution tables
   * @returns {uint8[][]} Three tables per round (see toStructuredKey)
   */
  function makeInternalKey(key, blockLength, rounds, decrypt) {
    const structuredKey = toStructuredKey(key, blockLength, rounds);
    for (let r = 0; r < rounds; r++) {
      const substPermu = structuredKey[r * 3 + 1];
      const bombPermu = structuredKey[r * 3 + 2];
      makePermutation(substPermu);
      if (decrypt) invertPermutation(substPermu);
      makePermutation(bombPermu);
      make1Cycle(bombPermu, blockLength);
      removeReferences(bombPermu, blockLength);
    }
    return structuredKey;
  }

  /**
   * @param {uint8[]} state - Block, encrypted in place
   * @param {uint8[][]} keys - Internal key (three tables per round)
   */
  function frogEncrypt(state, keys) {
    const rounds = keys.length / 3;
    for (let r = 0; r < rounds; r++) {
      const xorBu = keys[r * 3];
      const substPermu = keys[r * 3 + 1];
      const bombPermu = keys[r * 3 + 2];
      for (let i = 0; i < state.length; i++) {
        state[i] = substPermu[OpCodes.Xor32(state[i], xorBu[i])];
        const next = (i + 1) % state.length;
        state[next] ^= state[i];
        const k = bombPermu[i];
        state[k] ^= state[i];
      }
    }
  }

  /**
   * @param {uint8[]} state - Block, decrypted in place
   * @param {uint8[][]} keys - Internal key (three tables per round)
   */
  function frogDecrypt(state, keys) {
    const rounds = keys.length / 3;
    for (let r = rounds - 1; r >= 0; r--) {
      const xorBu = keys[r * 3];
      const substPermu = keys[r * 3 + 1];
      const bombPermu = keys[r * 3 + 2];
      for (let i = state.length - 1; i >= 0; i--) {
        const k = bombPermu[i];
        state[k] ^= state[i];
        const next = (i + 1) % state.length;
        state[next] ^= state[i];
        state[i] = OpCodes.Xor32(substPermu[state[i]], xorBu[i]);
      }
    }
  }

  /**
   * @param {uint8[]} keyBytes - Key bytes
   * @param {int32} blockLength - Block length in bytes
   * @param {int32} rounds - Number of rounds
   * @param {boolean} decrypt - Build the decryption key
   * @returns {uint8[][]} Internal key (three tables per round)
   */
  function generateKeys(keyBytes, blockLength, rounds, decrypt) {
    const keyLength = keyBytes.length;
    const internalKeyLength = (blockLength * 2 + 256) * rounds;

    /** @type {uint8[]} */
    const simpleKey = new Array(internalKeyLength);
    for (let i = 0; i < simpleKey.length; i++) {
      simpleKey[i] = OpCodes.Xor32(RANDOM_SEED[i % 251], keyBytes[i % keyLength]);
    }

    const internalKey = makeInternalKey(simpleKey, blockLength, rounds, false);

    /** @type {uint8[]} */
    const iv = new Array(blockLength);
    for (let i = 0; i < blockLength; i++) iv[i] = 0;
    const ivLength = Math.min(keyLength, blockLength);
    for (let i = 0; i < ivLength; i++) iv[i] ^= keyBytes[i];
    iv[0] ^= keyLength;

    let i = 0;
    /** @type {uint8[]} */
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
          text: "NIST AES round-1 FROG KAT ecb_vk.txt, KEYSIZE=256, I=1 (byte order reversed, the little-endian convention this build uses)",
          uri: "https://web.archive.org/web/20070109105622if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/frog-vals.zip",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000080"),
          expected: OpCodes.Hex8ToBytes("e100a4921e34bc89b9c6182b42c6b4b3")
        },
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

    /**
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     * @returns {DarkCryptFROGInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new DarkCryptFROGInstance(this, isInverse);
    }
  }

  class DarkCryptFROGInstance extends IBlockCipherInstance {
    /**
     * @param {DarkCryptFROGAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decrypt instead of encrypt
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[][]|null} */
      this._roundKeys = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      this.BlockSize = BLOCK_LEN;
      this.KeySize = 0;
    }

    /**
     * @param {uint8[]|null} keyBytes - Key bytes, or null to clear
     */
    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._roundKeys = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. FROG-256 (DarkCrypt) requires exactly 32 bytes");
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._roundKeys = generateKeys(this._key, BLOCK_LEN, ROUNDS, this.isInverse);
    }

    /**
     * @returns {uint8[]|null} Copy of the key, or null
     */
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
        throw new Error("Input length must be multiple of " + this.BlockSize + " bytes");

      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        const state = block.slice();
        if (this.isInverse) frogDecrypt(state, this._roundKeys);
        else frogEncrypt(state, this._roundKeys);
        for (let _i = 0; _i < state.length; _i++) output.push(state[_i]);
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
