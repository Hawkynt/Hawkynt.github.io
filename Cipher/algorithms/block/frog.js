/*
 * FROG Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * FROG, by Dianelos Georgoudis, Damian Leroux and Billy Simon Chaves (TecApro
 * International), submitted to the AES competition in 1998. Its defining feature
 * is that the user key is not used by the round function at all: it only derives
 * a large key-dependent "internal key" of per-round substitution and permutation
 * tables, and the encryption primitive is then a short fixed sequence of byte
 * operations driven entirely by those tables.
 *
 * Construction (AES submission, "The FROG Encryption Algorithm", sections 3-5):
 *  1. A 251-byte "random seed" table is built from the first 251 five-digit
 *     groups of the RAND Corporation's "A Million Random Digits with 100,000
 *     Normal Deviates" (1955), each group read as a decimal integer and reduced
 *     mod 256. This is the same nothing-up-my-sleeve source Merkle used for
 *     Khufu/Khafre/Snefru.
 *  2. simpleKey[i] = seed[i mod 251] XOR key[i mod keyLength], over the full
 *     internal key length (blockLength * 2 + 256) * rounds = 2304 bytes for a
 *     128-bit block and the specified 8 rounds.
 *  3. simpleKey is cut into one record per round, each holding xorBu[16],
 *     substPermu[256] and bombPermu[16]. substPermu and bombPermu are each
 *     turned into a genuine permutation by the key-driven shuffle
 *     makePermutation; bombPermu is then forced into a single full-length cycle
 *     (make1Cycle) and stripped of references that the round function's "next
 *     byte" step would cancel out (removeReferences).
 *  4. An IV seeded from the user key (iv[i] ^= key[i], iv[0] ^= keyLength) is
 *     repeatedly FROG-encrypted under that intermediate internal key, OFB
 *     fashion, to produce the FINAL internal key material, which is cut up and
 *     permuted exactly the same way.
 *
 * Round function, for each byte i of the state in ascending order:
 *     state[i] = substPermu[state[i] XOR xorBu[i]]
 *     state[(i + 1) mod blockLength] ^= state[i]
 *     state[bombPermu[i]] ^= state[i]
 * Decryption runs the rounds in reverse, the bytes in descending order, and each
 * byte's three steps in reverse, with substPermu replaced by its inverse:
 *     state[bombPermu[i]] ^= state[i]
 *     state[(i + 1) mod blockLength] ^= state[i]
 *     state[i] = substPermuInverse[state[i]] XOR xorBu[i]
 * make1Cycle and removeReferences are what make this reversible: they guarantee
 * bombPermu[i] is neither i nor (i + 1) mod blockLength, so the two XOR steps
 * touch distinct bytes and neither disturbs state[i] itself.
 *
 * 128-bit block, 128/192/256-bit keys, 8 rounds. Broken by Wagner, Ferguson and
 * Schneier at the AES conference; educational only.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== CONSTANTS =====

  const ROUNDS = 8;
  const BLOCK_LEN = 16;

  // First 251 five-digit groups of "A Million Random Digits with 100,000 Normal
  // Deviates" (RAND Corporation, 1955), each read as a decimal integer and
  // reduced mod 256 - the seed table specified in the FROG AES submission.
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
    for (let i = 0; i < 251; ++i) {
      seed[i] = parseInt(RAND_DIGITS.substr(i * 5, 5), 10) % 256;
    }
    return seed;
  }

  const RANDOM_SEED = buildRandomSeed();

  // ===== INTERNAL KEY CONSTRUCTION =====

  // Turns an arbitrary byte array into a permutation of its own index range by a
  // key-driven selection sweep: at each step the next unused value is chosen at
  // an offset given by the incoming byte. FROG AES submission, "makePermutation".
  function makePermutation(input) {
    const length = input.length;
    const use = new Array(length);
    for (let i = 0; i < length; ++i) use[i] = i;

    let index = 0;
    let last = length - 1;
    for (let i = 0; i < length - 1; ++i) {
      index = (index + input[i]) % (last + 1);
      input[i] = use[index];
      if (index < last) use.splice(index, 1);
      --last;
      if (index > last) index = 0;
    }
    input[length - 1] = use[0];
  }

  function invertPermutation(permutation) {
    const inverse = new Array(permutation.length);
    for (let i = 0; i < permutation.length; ++i) inverse[permutation[i]] = i;
    for (let i = 0; i < permutation.length; ++i) permutation[i] = inverse[i];
  }

  // Merges any shorter cycles of bombPermu into one full-length cycle, so that
  // every byte position is reachable from every other. FROG AES submission,
  // "make1Cycle". A side effect is that bombPermu[i] is never i, which is what
  // keeps the round function's third step from cancelling its own input.
  function make1Cycle(bombPermu, blockLength) {
    const used = new Array(blockLength).fill(0);
    let j = 0;
    for (let i = 0; i < blockLength - 1; ++i) {
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

  // Stops bombPermu[i] pointing at the byte the round function's second step
  // already XORs, which would otherwise undo it. FROG AES submission,
  // "removeReferences".
  function removeReferences(bombPermu, blockLength) {
    for (let i = 0; i < blockLength; ++i) {
      const j = (i + 1) % blockLength;
      if (bombPermu[i] === j) bombPermu[i] = (j + 1) % blockLength;
    }
  }

  // Cuts a flat internal-key byte array into one record per round.
  function toStructuredKey(bytes, blockLength, rounds) {
    const subkeyLength = bytes.length / rounds;
    const result = new Array(rounds);
    for (let r = 0; r < rounds; ++r) {
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

  function makeInternalKey(bytes, blockLength, rounds, invert) {
    const structuredKey = toStructuredKey(bytes, blockLength, rounds);
    for (let r = 0; r < rounds; ++r) {
      const record = structuredKey[r];
      makePermutation(record.substPermu);
      if (invert) invertPermutation(record.substPermu);
      makePermutation(record.bombPermu);
      make1Cycle(record.bombPermu, blockLength);
      removeReferences(record.bombPermu, blockLength);
    }
    return structuredKey;
  }

  // ===== BLOCK TRANSFORM =====

  function frogEncrypt(state, roundKeys) {
    for (let r = 0; r < roundKeys.length; ++r) {
      const record = roundKeys[r];
      for (let i = 0; i < state.length; ++i) {
        state[i] = record.substPermu[OpCodes.XorN(state[i], record.xorBu[i])];
        state[(i + 1) % state.length] ^= state[i];
        state[record.bombPermu[i]] ^= state[i];
      }
    }
  }

  function frogDecrypt(state, roundKeys) {
    for (let r = roundKeys.length - 1; r >= 0; --r) {
      const record = roundKeys[r];
      for (let i = state.length - 1; i >= 0; --i) {
        state[record.bombPermu[i]] ^= state[i];
        state[(i + 1) % state.length] ^= state[i];
        state[i] = OpCodes.XorN(record.substPermu[state[i]], record.xorBu[i]);
      }
    }
  }

  // ===== KEY SCHEDULE =====

  function generateKeys(keyBytes, blockLength, rounds, invert) {
    const keyLength = keyBytes.length;
    const internalKeyLength = (blockLength * 2 + 256) * rounds;

    const simpleKey = new Array(internalKeyLength);
    for (let i = 0; i < internalKeyLength; ++i) {
      simpleKey[i] = OpCodes.XorN(RANDOM_SEED[i % 251], keyBytes[i % keyLength]);
    }

    const intermediateKey = makeInternalKey(simpleKey, blockLength, rounds, false);

    // Self-keying pass: an IV derived from the user key is encrypted over and
    // over under the intermediate internal key, OFB fashion, and the output
    // stream becomes the final internal key material.
    const iv = new Array(blockLength).fill(0);
    const ivLength = Math.min(keyLength, blockLength);
    for (let i = 0; i < ivLength; ++i) iv[i] ^= keyBytes[i];
    iv[0] ^= keyLength;

    const material = new Array(internalKeyLength);
    let filled = 0;
    while (filled < internalKeyLength) {
      frogEncrypt(iv, intermediateKey);
      const chunk = Math.min(blockLength, internalKeyLength - filled);
      for (let j = 0; j < chunk; ++j) material[filled + j] = iv[j];
      filled += chunk;
    }

    return makeInternalKey(material, blockLength, rounds, invert);
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class FROG extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "FROG";
      this.description = "AES candidate from TecApro built on a key-as-program design: the user key derives a large internal key of per-round substitution and permutation tables, and the round function is a short fixed byte sequence driven entirely by those tables. 128-bit block, 128/192/256-bit keys, 8 rounds.";
      this.inventor = "Dianelos Georgoudis, Damian Leroux, Billy Simon Chaves";
      this.year = 1998;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.INSECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CR;

      this.SupportedKeySizes = [new KeySize(16, 32, 8)];
      this.SupportedBlockSizes = [new KeySize(16, 16, 1)];

      this.documentation = [
        new LinkItem("The FROG Encryption Algorithm (TecApro AES submission)", "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/aes-development/frog.pdf"),
        new LinkItem("FROG AES Submission (NESSIE mirror)", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/frog.pdf"),
        new LinkItem("FROG (Wikipedia)", "https://en.wikipedia.org/wiki/FROG")
      ];

      this.references = [
        new LinkItem("A Million Random Digits with 100,000 Normal Deviates (RAND, 1955)", "https://www.rand.org/pubs/monograph_reports/MR1418.html"),
        new LinkItem("Cryptanalysis of FROG (Wagner, Ferguson, Schneier)", "https://www.schneier.com/academic/archives/1999/01/cryptanalysis_of_fro.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Weak key classes and chosen-plaintext attacks", "Wagner, Ferguson and Schneier found large weak-key classes and both chosen-plaintext and chosen-ciphertext attacks; FROG was not selected as an AES finalist.", "Use AES or another vetted cipher.")
      ];

      // Known Answer Test vectors from the AES submission's own ecb_vk.txt and
      // ecb_vt.txt, produced by the submitted reference implementation.
      //
      // BYTE ORDER: FROG numbers a block from the least significant byte up, so
      // index 0 is the LAST byte the AES KAT files print. Every key, plaintext
      // and ciphertext below is therefore the byte-REVERSAL of the string in the
      // KAT file: the file's "KEY=800000...00" is the 16-byte array
      // 00...00,0x80, and so on. They are written here in array order because
      // that is the order this interface consumes and emits.
      //
      // The last three are cross-checks against the FROG shipped in the DarkCrypt
      // Total Commander plugin, an independent implementation of the same
      // construction; they are order-agnostic in the sense that they are quoted
      // exactly as that plugin produces them.
      this.tests = [
        {
          text: "AES KAT ecb_vk.txt I=1 — 128-bit key, single key bit set",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/aes-development/frog.pdf",
          input: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          key: OpCodes.Hex8ToBytes('00000000000000000000000000000080'),
          expected: OpCodes.Hex8ToBytes('1e1a2a532de59da7e230cc718ad2cb6c')
        },
        {
          text: "AES KAT ecb_vk.txt I=128 — 128-bit key, lowest key bit set",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/aes-development/frog.pdf",
          input: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          key: OpCodes.Hex8ToBytes('01000000000000000000000000000000'),
          expected: OpCodes.Hex8ToBytes('4f43f3edeb7c2a85d1d8577e0c7378c4')
        },
        {
          text: "AES KAT ecb_vt.txt I=1 — 128-bit key, single plaintext bit set",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/aes-development/frog.pdf",
          input: OpCodes.Hex8ToBytes('00000000000000000000000000000080'),
          key: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          expected: OpCodes.Hex8ToBytes('82700ab3533100fcd02de6bd6988af43')
        },
        {
          text: "AES KAT ecb_vt.txt I=128 — 128-bit key, lowest plaintext bit set",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/aes-development/frog.pdf",
          input: OpCodes.Hex8ToBytes('01000000000000000000000000000000'),
          key: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          expected: OpCodes.Hex8ToBytes('b46122f040782cb0cd24ce55e92554c7')
        },
        {
          text: "AES KAT — all-zero 128-bit key and plaintext (order-independent)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/aes-development/frog.pdf",
          input: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          key: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          expected: OpCodes.Hex8ToBytes('ce0f0611ec5ea12607d4bb435b58f0bf')
        },
        {
          text: "AES KAT ecb_vk.txt I=1 — 192-bit key",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/aes-development/frog.pdf",
          input: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          key: OpCodes.Hex8ToBytes('000000000000000000000000000000000000000000000080'),
          expected: OpCodes.Hex8ToBytes('d97ec798d02b23e20070c69753f4770e')
        },
        {
          text: "AES KAT ecb_vk.txt I=1 — 256-bit key",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/aes-development/frog.pdf",
          input: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          key: OpCodes.Hex8ToBytes('0000000000000000000000000000000000000000000000000000000000000080'),
          expected: OpCodes.Hex8ToBytes('e100a4921e34bc89b9c6182b42c6b4b3')
        },
        {
          text: "FROG-256 — zero key and plaintext, cross-checked against the DarkCrypt plugin",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes('00000000000000000000000000000000'),
          key: OpCodes.Hex8ToBytes('0000000000000000000000000000000000000000000000000000000000000000'),
          expected: OpCodes.Hex8ToBytes('b57897cc533074f1a543bf69b65c7bbc')
        },
        {
          text: "FROG-256 — incrementing key and plaintext, cross-checked against the DarkCrypt plugin",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes('000102030405060708090a0b0c0d0e0f'),
          key: OpCodes.Hex8ToBytes('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'),
          expected: OpCodes.Hex8ToBytes('2bbb1026a5608ad9bd14ea5064982eb9')
        },
        {
          text: "FROG-256 — shifted incrementing key and plaintext, cross-checked against the DarkCrypt plugin",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes('101112131415161718191a1b1c1d1e1f'),
          key: OpCodes.Hex8ToBytes('0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20'),
          expected: OpCodes.Hex8ToBytes('26fba6a7bbb41616d89c83bd83d97a47')
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new FROGInstance(this, isInverse);
    }
  }

  class FROGInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._roundKeys = null;
      this.BlockSize = BLOCK_LEN;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this._roundKeys = null;
        this.KeySize = 0;
        return;
      }

      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
        && (ks.stepSize === 0 || (keyBytes.length - ks.minSize) % ks.stepSize === 0)
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      // The internal key differs between the two directions: decryption needs
      // each round's substPermu replaced by its inverse.
      this._roundKeys = generateKeys(this._key, BLOCK_LEN, ROUNDS, this.isInverse);
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
      if (this.inputBuffer.length % BLOCK_LEN !== 0)
        throw new Error(`Input length must be a multiple of ${BLOCK_LEN} bytes`);

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += BLOCK_LEN) {
        const state = this.inputBuffer.slice(i, i + BLOCK_LEN);
        if (this.isInverse) frogDecrypt(state, this._roundKeys);
        else frogEncrypt(state, this._roundKeys);
        for (let _i = 0; _i < state.length; _i++) output.push(state[_i]);
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new FROG();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { FROG, FROGInstance };
}));
