/*
 * Skein (DarkCrypt variant) - AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * As implemented in the DarkCrypt Total Commander plugin (no public specification
 * matches this variant's output). It is a full Skein-512-512 pipeline (UBI chaining
 * mode, "SHA3" configuration-block schema, standard tweak encoding with TYPE_CFG=4/
 * TYPE_MSG=48/TYPE_OUT=63 and first/final flag bits in the expected positions,
 * little-endian byte packing) built on a Threefish-512 core, but it differs from the
 * modern reference Skein-512 implementation in two ways: it uses the DEPRECATED
 * pre-tweak (October 2008, NIST SHA-3 round 1) rotation constant schedule from Skein
 * spec v1.3 Appendix D Table 29 rather than the final v1.3 rotation schedule, and the
 * Threefish-512 key schedule's parity word is computed with the constant
 * 0x5555555555555555 (an alternating-bit pattern) instead of the standard
 * C_240 = 0x1BD11BDAA9FC1A22.
 *
 * Everything else (UBI tweak bookkeeping, output-transform counter-block extraction,
 * message/config block byte packing) matches standard Skein-512-512 exactly. Test
 * vectors verified against the DarkCrypt implementation.
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
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

  // ===== THREEFISH-512 CORE (DarkCrypt variant) =====

  // Deprecated pre-tweak Threefish-512 rotation constants (Skein spec v1.3, Appendix D,
  // Table 29 - "October 2008 (NIST Round 1)"). Matches the DarkCrypt implementation.
  const ROTATION_0_0 = 38, ROTATION_0_1 = 30, ROTATION_0_2 = 50, ROTATION_0_3 = 53;
  const ROTATION_1_0 = 48, ROTATION_1_1 = 20, ROTATION_1_2 = 43, ROTATION_1_3 = 31;
  const ROTATION_2_0 = 34, ROTATION_2_1 = 14, ROTATION_2_2 = 15, ROTATION_2_3 = 27;
  const ROTATION_3_0 = 26, ROTATION_3_1 = 12, ROTATION_3_2 = 58, ROTATION_3_3 = 7;
  const ROTATION_4_0 = 33, ROTATION_4_1 = 49, ROTATION_4_2 = 8,  ROTATION_4_3 = 42;
  const ROTATION_5_0 = 39, ROTATION_5_1 = 27, ROTATION_5_2 = 41, ROTATION_5_3 = 14;
  const ROTATION_6_0 = 29, ROTATION_6_1 = 26, ROTATION_6_2 = 11, ROTATION_6_3 = 9;
  const ROTATION_7_0 = 33, ROTATION_7_1 = 51, ROTATION_7_2 = 39, ROTATION_7_3 = 35;

  const ROUNDS_512 = 72;

  // DarkCrypt's non-standard key-schedule parity constant. Standard Skein uses
  // C_240 = 0x1BD11BDAA9FC1A22; this implementation instead XORs the chain
  // words with the alternating-bit pattern 0x5555555555555555.
  const C_PARITY = 0x5555555555555555n;

  const MASK64 = 0xFFFFFFFFFFFFFFFFn;

  function rotlXor64(x, n, xor) {
    x = OpCodes.AndN(BigInt(x), MASK64);
    xor = OpCodes.AndN(BigInt(xor), MASK64);
    n = OpCodes.AndN(Number(n), 63);
    return OpCodes.AndN(OpCodes.XorN(OpCodes.RotL64n(x, n), xor), MASK64);
  }

  // Threefish-512 encryption (DarkCrypt variant: deprecated rotations + custom parity)
  function threefish512Encrypt(key, tweak, block) {
    const kw = new Array(17);
    let knw = C_PARITY;
    for (let i = 0; i < 8; i++) {
      kw[i] = OpCodes.AndN(BigInt(key[i]), MASK64);
      knw = OpCodes.XorN(knw, kw[i]);
    }
    kw[8] = knw;
    for (let i = 0; i < 8; i++) kw[9 + i] = kw[i];

    const t = new Array(5);
    t[0] = OpCodes.AndN(BigInt(tweak[0]), MASK64);
    t[1] = OpCodes.AndN(BigInt(tweak[1]), MASK64);
    t[2] = OpCodes.XorN(t[0], t[1]);
    t[3] = t[0];
    t[4] = t[1];

    let b0 = OpCodes.AndN(BigInt(block[0]), MASK64);
    let b1 = OpCodes.AndN(BigInt(block[1]), MASK64);
    let b2 = OpCodes.AndN(BigInt(block[2]), MASK64);
    let b3 = OpCodes.AndN(BigInt(block[3]), MASK64);
    let b4 = OpCodes.AndN(BigInt(block[4]), MASK64);
    let b5 = OpCodes.AndN(BigInt(block[5]), MASK64);
    let b6 = OpCodes.AndN(BigInt(block[6]), MASK64);
    let b7 = OpCodes.AndN(BigInt(block[7]), MASK64);

    b0 += kw[0];
    b1 += kw[1];
    b2 += kw[2];
    b3 += kw[3];
    b4 += kw[4];
    b5 += kw[5] + t[0];
    b6 += kw[6] + t[1];
    b7 += kw[7];

    for (let d = 1; d < (ROUNDS_512 / 4); d += 2) {
      const dm9 = d % 9;
      const dm3 = d % 3;

      b1 = rotlXor64(b1, ROTATION_0_0, b0 += b1);
      b3 = rotlXor64(b3, ROTATION_0_1, b2 += b3);
      b5 = rotlXor64(b5, ROTATION_0_2, b4 += b5);
      b7 = rotlXor64(b7, ROTATION_0_3, b6 += b7);

      b1 = rotlXor64(b1, ROTATION_1_0, b2 += b1);
      b7 = rotlXor64(b7, ROTATION_1_1, b4 += b7);
      b5 = rotlXor64(b5, ROTATION_1_2, b6 += b5);
      b3 = rotlXor64(b3, ROTATION_1_3, b0 += b3);

      b1 = rotlXor64(b1, ROTATION_2_0, b4 += b1);
      b3 = rotlXor64(b3, ROTATION_2_1, b6 += b3);
      b5 = rotlXor64(b5, ROTATION_2_2, b0 += b5);
      b7 = rotlXor64(b7, ROTATION_2_3, b2 += b7);

      b1 = rotlXor64(b1, ROTATION_3_0, b6 += b1);
      b7 = rotlXor64(b7, ROTATION_3_1, b0 += b7);
      b5 = rotlXor64(b5, ROTATION_3_2, b2 += b5);
      b3 = rotlXor64(b3, ROTATION_3_3, b4 += b3);

      b0 += kw[dm9];
      b1 += kw[dm9 + 1];
      b2 += kw[dm9 + 2];
      b3 += kw[dm9 + 3];
      b4 += kw[dm9 + 4];
      b5 += kw[dm9 + 5] + t[dm3];
      b6 += kw[dm9 + 6] + t[dm3 + 1];
      b7 += kw[dm9 + 7] + BigInt(d);

      b1 = rotlXor64(b1, ROTATION_4_0, b0 += b1);
      b3 = rotlXor64(b3, ROTATION_4_1, b2 += b3);
      b5 = rotlXor64(b5, ROTATION_4_2, b4 += b5);
      b7 = rotlXor64(b7, ROTATION_4_3, b6 += b7);

      b1 = rotlXor64(b1, ROTATION_5_0, b2 += b1);
      b7 = rotlXor64(b7, ROTATION_5_1, b4 += b7);
      b5 = rotlXor64(b5, ROTATION_5_2, b6 += b5);
      b3 = rotlXor64(b3, ROTATION_5_3, b0 += b3);

      b1 = rotlXor64(b1, ROTATION_6_0, b4 += b1);
      b3 = rotlXor64(b3, ROTATION_6_1, b6 += b3);
      b5 = rotlXor64(b5, ROTATION_6_2, b0 += b5);
      b7 = rotlXor64(b7, ROTATION_6_3, b2 += b7);

      b1 = rotlXor64(b1, ROTATION_7_0, b6 += b1);
      b7 = rotlXor64(b7, ROTATION_7_1, b0 += b7);
      b5 = rotlXor64(b5, ROTATION_7_2, b2 += b5);
      b3 = rotlXor64(b3, ROTATION_7_3, b4 += b3);

      b0 += kw[dm9 + 1];
      b1 += kw[dm9 + 2];
      b2 += kw[dm9 + 3];
      b3 += kw[dm9 + 4];
      b4 += kw[dm9 + 5];
      b5 += kw[dm9 + 6] + t[dm3 + 1];
      b6 += kw[dm9 + 7] + t[dm3 + 2];
      b7 += kw[dm9 + 8] + BigInt(d + 1);
    }

    return [
      OpCodes.AndN(b0, MASK64), OpCodes.AndN(b1, MASK64), OpCodes.AndN(b2, MASK64), OpCodes.AndN(b3, MASK64),
      OpCodes.AndN(b4, MASK64), OpCodes.AndN(b5, MASK64), OpCodes.AndN(b6, MASK64), OpCodes.AndN(b7, MASK64)
    ];
  }

  // ===== SKEIN-512 UBI MODE (standard) =====

  const PARAM_TYPE_CONFIG = 4;
  const PARAM_TYPE_MESSAGE = 48;
  const PARAM_TYPE_OUTPUT = 63;

  const T1_FINAL = OpCodes.ShiftLn(1n, 63);
  const T1_FIRST = OpCodes.ShiftLn(1n, 62);

  class SkeinUBI {
    constructor(blockSize) {
      this.blockSize = blockSize;
      this.currentBlock = new Uint8Array(blockSize);
      this.currentOffset = 0;
      this.tweak = [0n, 0n];
      this.message = new Array(8);
    }

    reset(type) {
      this.tweak[0] = 0n;
      this.tweak[1] = OpCodes.OrN(OpCodes.ShiftLn(BigInt(type), 56), T1_FIRST);
      this.currentOffset = 0;
    }

    update(data, offset, length, chain) {
      let copied = 0;
      while (copied < length) {
        if (this.currentOffset === this.blockSize) {
          this.processBlock(chain);
          this.tweak[1] &= ~T1_FIRST;
          this.currentOffset = 0;
        }

        const toCopy = Math.min(length - copied, this.blockSize - this.currentOffset);
        for (let i = 0; i < toCopy; i++) {
          this.currentBlock[this.currentOffset + i] = data[offset + copied + i];
        }
        copied += toCopy;
        this.currentOffset += toCopy;
        this.tweak[0] += BigInt(toCopy);
      }
    }

    processBlock(chain) {
      for (let i = 0; i < 8; i++) {
        const off = i * 8;
        let w = 0n;
        for (let j = 0; j < 8; j++) {
          w = OpCodes.OrN(w, OpCodes.ShiftLn(BigInt(this.currentBlock[off + j]), j * 8));
        }
        this.message[i] = w;
      }

      const output = threefish512Encrypt(chain, this.tweak, this.message);

      for (let i = 0; i < 8; i++) {
        chain[i] = OpCodes.AndN(OpCodes.XorN(output[i], this.message[i]), MASK64);
      }
    }

    doFinal(chain) {
      for (let i = this.currentOffset; i < this.blockSize; i++) this.currentBlock[i] = 0;
      this.tweak[1] = OpCodes.OrN(this.tweak[1], T1_FINAL);
      this.processBlock(chain);
    }
  }

  // ===== SKEIN HASH FUNCTION (DarkCrypt variant, 512-bit output) =====

  class SkeinHasher {
    constructor(outputBits) {
      this.outputBits = outputBits;
      this.blockSize = 64;
      this.chain = new Array(8).fill(0n);
      this.ubi = new SkeinUBI(this.blockSize);

      this.processConfig();
      this.initialState = [...this.chain];
    }

    processConfig() {
      // Configuration block: "SHA3" (4 bytes) + version (2 bytes) + reserved (2 bytes)
      // + output length in bits (8 bytes), zero-padded to the 64-byte block size.
      const config = new Uint8Array(32);
      config[0] = 0x53; // 'S'
      config[1] = 0x48; // 'H'
      config[2] = 0x41; // 'A'
      config[3] = 0x33; // '3'
      config[4] = 1;    // Version 1 (low byte)
      config[5] = 0;    // Version (high byte)

      const outBits = BigInt(this.outputBits);
      for (let i = 0; i < 8; i++) {
        config[8 + i] = Number(OpCodes.AndN(OpCodes.ShiftRn(outBits, BigInt(i * 8)), 0xFFn));
      }

      this.ubi.reset(PARAM_TYPE_CONFIG);
      this.ubi.update(config, 0, 32, this.chain);
      this.ubi.doFinal(this.chain);
    }

    update(data) {
      if (typeof data === 'string') data = OpCodes.AnsiToBytes(data);
      this.ubi.update(data, 0, data.length, this.chain);
    }

    finalize() {
      this.ubi.doFinal(this.chain);

      const outputBytes = this.outputBits / 8;
      const result = new Uint8Array(outputBytes);

      const counter = new Uint8Array(8);
      this.ubi.reset(PARAM_TYPE_OUTPUT);
      this.ubi.update(counter, 0, 8, this.chain);

      const outputWords = [...this.chain];
      this.ubi.doFinal(outputWords);

      const wordsNeeded = Math.ceil(outputBytes / 8);
      for (let i = 0; i < wordsNeeded; i++) {
        const word = outputWords[i];
        const bytesToWrite = Math.min(8, outputBytes - i * 8);
        for (let j = 0; j < bytesToWrite; j++) {
          result[i * 8 + j] = Number(OpCodes.AndN(OpCodes.ShiftRn(word, BigInt(j * 8)), 0xFFn));
        }
      }

      return result;
    }

    reset() {
      for (let i = 0; i < 8; i++) this.chain[i] = this.initialState[i];
      this.ubi.reset(PARAM_TYPE_MESSAGE);
    }
  }

  // ===== ALGORITHM REGISTRATION =====

  class DarkCryptSkeinAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "Skein (DarkCrypt)";
      this.description = "Skein-512-512 variant used by the DarkCrypt Total Commander plugin. Uses the deprecated pre-tweak (October 2008, NIST round 1) Threefish-512 rotation constants from Skein spec v1.3 Appendix D Table 29 combined with a non-standard key-schedule parity constant (0x5555555555555555 instead of the standard C_240); matches no published Skein test vector.";
      this.inventor = "Bruce Schneier, Niels Ferguson, Stefan Lucks, Doug Whiting, Mihir Bellare, Tadayoshi Kohno, Jon Callas, Jesse Walker (Skein); DarkCrypt plugin author (variant constant substitution)";
      this.year = 2008;
      this.category = CategoryType.HASH;
      this.subCategory = "DarkCrypt Variant";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.SupportedOutputSizes = [64]; // 512 bits
      this.blockSize = 64;
      this.outputSize = 64;

      this.documentation = [
        new LinkItem("Skein 1.3 Specification", "https://www.schneier.com/academic/skein/skein1.3.pdf"),
        new LinkItem("Threefish Cipher", "https://www.schneier.com/academic/threefish/"),
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.references = [
        new LinkItem("DarkCrypt Total Commander plugin", "https://github.com/Zdimon/DarkCryptTC")
      ];

      // Vectors generated from the DarkCrypt implementation's hashnow(inPtr, outPtr, len)
      // export; empty/"abc"/incr64 (bytes 0x00..0x3F) inputs.
      this.tests = [
        new TestCase(
          OpCodes.Hex8ToBytes(""),
          OpCodes.Hex8ToBytes("d3f7263a09837f4ce5c8ef70a5ddffac7b92d6c2ace5a12265bd5b593260a3ff20d8b4b4c5494e945448b37abb1fc526f6b46089208fde938d7f23724c4bdfb7"),
          "DarkCrypt Skein empty string",
          "https://github.com/Zdimon/DarkCryptTC"
        ),
        new TestCase(
          OpCodes.AnsiToBytes("abc"),
          OpCodes.Hex8ToBytes("c52438c670f3d580dc4cb8d085141a19643668f82a6ad5f4ecb9292f04b8f38f1b9dcc8dc4108f72e6ec81fc6cbcd6edf1867fc4f0beafa692957a4adc1183e3"),
          "DarkCrypt Skein \"abc\"",
          "https://github.com/Zdimon/DarkCryptTC"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          OpCodes.Hex8ToBytes("df2624902ccc7e042541952126f94750802b3a1e61fa6e22f8bc981066874095883455ddd2b0c96a28f1074b4f151829ffc65415503f504e76f362c312120644"),
          "DarkCrypt Skein incremental 64-byte message",
          "https://github.com/Zdimon/DarkCryptTC"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new DarkCryptSkeinInstance(this);
    }
  }

  class DarkCryptSkeinInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.hasher = new SkeinHasher(512);
      this.hasher.ubi.reset(PARAM_TYPE_MESSAGE);
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.hasher.update(data);
    }

    Result() {
      return this.hasher.finalize();
    }

    ProcessData(input, key) {
      this.hasher.reset();
      this.hasher.ubi.reset(PARAM_TYPE_MESSAGE);
      this.hasher.update(input);
      return this.hasher.finalize();
    }

    Reset() {
      this.hasher = new SkeinHasher(512);
      this.hasher.ubi.reset(PARAM_TYPE_MESSAGE);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DarkCryptSkeinAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptSkeinAlgorithm, DarkCryptSkeinInstance };
}));
