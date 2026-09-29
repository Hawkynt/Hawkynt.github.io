
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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  // Round constants from the reference implementation: none for pass 1
  // (a row of zeros adds nothing), RK2, RK3, RK4 and RK5 for passes 2 to 5.
  /** @type {uint32[][]} */
  const ROUND_CONSTANTS = [
    OpCodes.Hex32ToDWords(
      "0000000000000000000000000000000000000000000000000000000000000000" +
      "0000000000000000000000000000000000000000000000000000000000000000" +
      "0000000000000000000000000000000000000000000000000000000000000000" +
      "0000000000000000000000000000000000000000000000000000000000000000"
    ),
    OpCodes.Hex32ToDWords(
      "452821E638D01377BE5466CF34E90C6CC0AC29B7C97C50DD3F84D5B5B5470917" +
      "9216D5D98979FB1BD1310BA698DFB5AC2FFD72DBD01ADFB7B8E1AFED6A267E96" +
      "BA7C9045F12C7F9924A19947B3916CF70801F2E2858EFC16636920D871574E69" +
      "A458FEA3F4933D7E0D95748F728EB658718BCD5882154AEE7B54A41DC25A59B5"
    ),
    OpCodes.Hex32ToDWords(
      "9C30D5392AF26013C5D1B023286085F0CA417918B8DB38EF8E79DCB0603A180E" +
      "6C9E0E8BB01E8A3ED71577C1BD314B2778AF2FDA55605C60E65525F3AA55AB94" +
      "5748986263E8144055CA396A2AAB10B6B4CC5C341141E8CEA15486AF7C72E993" +
      "B3EE1411636FBC2A2BA9C55D741831F6CE5C3E169B87931EAFD6BA336C24CF5C"
    ),
    OpCodes.Hex32ToDWords(
      "7A325381289586773B8F48986B4BB9AFC4BFE81B6628219361D809CCFB21A991" +
      "487CAC605DEC8032EF845D5DE98575B1DC262302EB651B8823893E81D396ACC5" +
      "0F6D6FF383F442392E0B4482A484200469C8F04A9E1F9B5E21C66842F6E96C9A" +
      "670C9C61ABD388F06A51A0D2D8542F68960FA728AB5133A36EEF0B6C137A3BE4"
    ),
    OpCodes.Hex32ToDWords(
      "BA3BF0507EFB2A98A1F1651D39AF017666CA593E82430E888CEE8619456F9FB4" +
      "7D84A5C33B8B5EBEE06F75D885C12073401A449F56C16AA64ED3AA62363F7706" +
      "1BFEDF72429B023D37D0D724D00A1248DB0FEAD349F1C09B075372C980991B7B" +
      "25D479D8F6E8DEF7E3FE501AB6794C3B976CE0BD04C006BAC1A94FB6409F60C4"
    )
  ];

  // Word order of each pass (matching sphlib): pass 1 sequential, then
  // MP2, MP3, MP4 and MP5.
  /** @type {uint8[][]} */
  const WORD_PERMUTATIONS = [
    OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
    OpCodes.Hex8ToBytes("050e1a120b1c071000171416010a04081e03150911181d06130c0f0d02191f1b"),
    OpCodes.Hex8ToBytes("130904141c1108161d0e190c181e101a1f0f07030100121b0d06150a170b0502"),
    OpCodes.Hex8ToBytes("1804000e02071c171a061e1412191303160b1f15081b0c09011d050f110a100d"),
    OpCodes.Hex8ToBytes("1b03151a110b141d13000c070d081f0a05090e1e12061c18021710160401190f")
  ];

  // HAVAL Hasher - Core implementation of HAVAL algorithm
  class HavalHasher {
    /**
     * @param {int32} passCount - 3, 4 or 5
     * @param {int32} hashBitLength - 128, 160, 192, 224 or 256
     */
    constructor(passCount, hashBitLength) {
      if (passCount !== 3 && passCount !== 4 && passCount !== 5) {
        throw new Error('HAVAL passes must be 3, 4, or 5');
      }
      if (hashBitLength !== 128 && hashBitLength !== 160 && hashBitLength !== 192 &&
          hashBitLength !== 224 && hashBitLength !== 256) {
        throw new Error('HAVAL hash size must be 128, 160, 192, 224, or 256 bits');
      }

      /** @type {int32} */
      this.passes = passCount;
      /** @type {int32} */
      this.hashBits = hashBitLength;
      /** @type {uint8[]} */
      this.buffer = [];
      /** @type {int32} */
      this.totalLength = 0;

      // Initialize state with HAVAL IV (from reference implementation)
      /** @type {uint32[]} */
      this.state = new Uint32Array(OpCodes.Hex32ToDWords(
        "243F6A8885A308D313198A2E03707344A4093822299F31D0082EFA98EC4E6C89"
      ));
    }

    // HAVAL Boolean functions F1 through F5 - correct formulas from reference implementation
    // Based on bitbandi/all-hash-python and reference C implementation

    /**
     * F1: Pass 1 boolean function
     * @param {uint32} x6
     * @param {uint32} x5
     * @param {uint32} x4
     * @param {uint32} x3
     * @param {uint32} x2
     * @param {uint32} x1
     * @param {uint32} x0
     * @returns {uint32}
     */
    f1(x6, x5, x4, x3, x2, x1, x0) {
      return OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.And32(x1, OpCodes.Xor32(x0, x4)), OpCodes.And32(x2, x5)), OpCodes.And32(x3, x6)), x0);
    }

    /**
     * F2: Pass 2 boolean function
     * @param {uint32} x6
     * @param {uint32} x5
     * @param {uint32} x4
     * @param {uint32} x3
     * @param {uint32} x2
     * @param {uint32} x1
     * @param {uint32} x0
     * @returns {uint32}
     */
    f2(x6, x5, x4, x3, x2, x1, x0) {
      return OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.And32(x2, OpCodes.Xor32(OpCodes.Xor32(OpCodes.And32(x1, OpCodes.Not32(x3)), OpCodes.And32(x4, x5)), OpCodes.Xor32(x6, x0))),
             OpCodes.And32(x4, OpCodes.Xor32(x1, x5))), OpCodes.And32(x3, x5)), x0);
    }

    /**
     * F3: Pass 3 boolean function
     * @param {uint32} x6
     * @param {uint32} x5
     * @param {uint32} x4
     * @param {uint32} x3
     * @param {uint32} x2
     * @param {uint32} x1
     * @param {uint32} x0
     * @returns {uint32}
     */
    f3(x6, x5, x4, x3, x2, x1, x0) {
      return OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.And32(x3, OpCodes.Xor32(OpCodes.Xor32(OpCodes.And32(x1, x2), x6), x0)),
             OpCodes.And32(x1, x4)), OpCodes.And32(x2, x5)), x0);
    }

    /**
     * F4: Pass 4 boolean function
     * @param {uint32} x6
     * @param {uint32} x5
     * @param {uint32} x4
     * @param {uint32} x3
     * @param {uint32} x2
     * @param {uint32} x1
     * @param {uint32} x0
     * @returns {uint32}
     */
    f4(x6, x5, x4, x3, x2, x1, x0) {
      return OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.And32(x3, OpCodes.Xor32(OpCodes.Xor32(OpCodes.And32(x1, x2), OpCodes.Or32(x4, x6)), x5)),
             OpCodes.And32(x4, OpCodes.Xor32(OpCodes.Xor32(OpCodes.And32(OpCodes.Not32(x2), x5), x1), OpCodes.Xor32(x6, x0)))),
             OpCodes.And32(x2, x6)), x0);
    }

    /**
     * F5: Pass 5 boolean function
     * @param {uint32} x6
     * @param {uint32} x5
     * @param {uint32} x4
     * @param {uint32} x3
     * @param {uint32} x2
     * @param {uint32} x1
     * @param {uint32} x0
     * @returns {uint32}
     */
    f5(x6, x5, x4, x3, x2, x1, x0) {
      return OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.And32(x0, OpCodes.Not32(OpCodes.Xor32(OpCodes.And32(OpCodes.And32(x1, x2), x3), x5))),
             OpCodes.And32(x1, x4)), OpCodes.And32(x2, x5)), OpCodes.And32(x3, x6));
    }

    /**
     * The PHI-permuted boolean function of one pass: the argument order
     * depends on the pass and on the total number of passes (FP3, FP4, FP5).
     * @param {int32} pass - 0-based pass index
     * @param {uint32} x6
     * @param {uint32} x5
     * @param {uint32} x4
     * @param {uint32} x3
     * @param {uint32} x2
     * @param {uint32} x1
     * @param {uint32} x0
     * @returns {uint32}
     */
    phi(pass, x6, x5, x4, x3, x2, x1, x0) {
      if (this.passes === 3) {
        switch (pass) {
          case 0: return this.f1(x1, x0, x3, x5, x6, x2, x4);
          case 1: return this.f2(x4, x2, x1, x0, x5, x3, x6);
          default: return this.f3(x6, x1, x2, x3, x4, x5, x0);
        }
      }
      if (this.passes === 4) {
        switch (pass) {
          case 0: return this.f1(x2, x6, x1, x4, x5, x3, x0);
          case 1: return this.f2(x3, x5, x2, x0, x1, x6, x4);
          case 2: return this.f3(x1, x4, x3, x6, x0, x2, x5);
          default: return this.f4(x6, x4, x0, x5, x2, x1, x3);
        }
      }
      switch (pass) {
        case 0: return this.f1(x3, x4, x1, x0, x5, x2, x6);
        case 1: return this.f2(x6, x2, x1, x0, x3, x4, x5);
        case 2: return this.f3(x2, x6, x0, x4, x3, x1, x5);
        case 3: return this.f4(x1, x5, x3, x2, x0, x4, x6);
        default: return this.f5(x2, x5, x0, x6, x4, x3, x1);
      }
    }

    /**
     * Process a 1024-bit block
     * @param {uint8[]} block - 128 bytes
     * @returns {void}
     */
    processBlock(block) {
      /** @type {uint32[]} */
      const words = new Array(32);

      // Convert bytes to 32-bit words (little-endian)
      for (let i = 0; i < 32; i++) {
        const offset = i * 4;
        words[i] = OpCodes.Pack32LE(block[offset], block[offset + 1], block[offset + 2], block[offset + 3]);
      }

      // Initialize working state [s0, s1, s2, s3, s4, s5, s6, s7]
      let s0 = this.state[0];
      let s1 = this.state[1];
      let s2 = this.state[2];
      let s3 = this.state[3];
      let s4 = this.state[4];
      let s5 = this.state[5];
      let s6 = this.state[6];
      let s7 = this.state[7];

      // Execute passes - STEP macro from sphlib creates 8 steps per iteration
      // Each group of 8 steps processes: s7, s6, s5, s4, s3, s2, s1, s0 (in that order)
      // STEP(n, p, x7, x6, x5, x4, x3, x2, x1, x0, w, c):
      //   t = FP##n##_##p(x6, x5, x4, x3, x2, x1, x0)
      //   x7 = ROTR32(t, 7) + ROTR32(x7, 11) + w + c

      for (let pass = 0; pass < this.passes; pass++) {
        const wperm = WORD_PERMUTATIONS[pass];
        const constants = ROUND_CONSTANTS[pass];

        // Process all 32 rounds (4 groups of 8 steps each)
        for (let i = 0; i < 32; i++) {
          const word = words[wperm[i]];
          const constant = constants[i];
          /** @type {uint32} */
          let temp = 0;

          // Determine which state variable to update based on position in group of 8
          switch (i % 8) {
            case 0:  // Update s7
              temp = this.phi(pass, s6, s5, s4, s3, s2, s1, s0);
              s7 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s7, 11)), word), constant);
              break;
            case 1:  // Update s6
              temp = this.phi(pass, s5, s4, s3, s2, s1, s0, s7);
              s6 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s6, 11)), word), constant);
              break;
            case 2:  // Update s5
              temp = this.phi(pass, s4, s3, s2, s1, s0, s7, s6);
              s5 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s5, 11)), word), constant);
              break;
            case 3:  // Update s4
              temp = this.phi(pass, s3, s2, s1, s0, s7, s6, s5);
              s4 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s4, 11)), word), constant);
              break;
            case 4:  // Update s3
              temp = this.phi(pass, s2, s1, s0, s7, s6, s5, s4);
              s3 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s3, 11)), word), constant);
              break;
            case 5:  // Update s2
              temp = this.phi(pass, s1, s0, s7, s6, s5, s4, s3);
              s2 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s2, 11)), word), constant);
              break;
            case 6:  // Update s1
              temp = this.phi(pass, s0, s7, s6, s5, s4, s3, s2);
              s1 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s1, 11)), word), constant);
              break;
            case 7:  // Update s0
              temp = this.phi(pass, s7, s6, s5, s4, s3, s2, s1);
              s0 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s0, 11)), word), constant);
              break;
          }
        }
      }

      // Add working state to digest state
      this.state[0] = OpCodes.Add32(this.state[0], s0);
      this.state[1] = OpCodes.Add32(this.state[1], s1);
      this.state[2] = OpCodes.Add32(this.state[2], s2);
      this.state[3] = OpCodes.Add32(this.state[3], s3);
      this.state[4] = OpCodes.Add32(this.state[4], s4);
      this.state[5] = OpCodes.Add32(this.state[5], s5);
      this.state[6] = OpCodes.Add32(this.state[6], s6);
      this.state[7] = OpCodes.Add32(this.state[7], s7);
    }

    /**
     * Absorb message bytes, processing every complete block
     * @param {uint8[]} data - message bytes
     * @returns {void}
     */
    update(data) {
      if (!data || data.length === 0) return;

      for (let _i = 0; _i < data.length; _i++) this.buffer.push(data[_i]);
      this.totalLength += data.length;

      // Process complete 128-byte blocks
      while (this.buffer.length >= 128) {
        const block = this.buffer.splice(0, 128);
        this.processBlock(block);
      }
    }

    /**
     * Pad, process the final block and fold the state to the output size
     * @returns {uint8[]} hashBits / 8 bytes
     */
    finalize() {
      // HAVAL-specific padding algorithm (from reference implementation)
      const msgLen = this.totalLength;

      // Add the mandatory '1' bit (0x01 byte, HAVAL-specific padding)
      this.buffer.push(0x01);

      // Pad with zeros to 118 bytes (leaving 10 bytes for HAVAL-specific metadata)
      while (this.buffer.length % 128 !== 118) {
        this.buffer.push(0x00);
      }

      // HAVAL appends special footer (from sphlib haval_helper.c):
      // Byte 118: 0x01|(PASSES * 8)
      // Byte 119: olen * 8  (where olen is output length in 32-bit words)
      // Bytes 120-127: Message length in bits (64-bit little-endian)

      const PASSES = this.passes;  // Number of passes (3, 4, or 5)
      const olen = Math.floor(this.hashBits / 32);  // Output length in 32-bit words
      const MSGLEN = OpCodes.Shl32(msgLen, 3);  // Message length in bits, low 32 bits

      // Byte 118: VERSION (always 0x01)|(PASSES * 8)
      this.buffer.push(OpCodes.Or8(0x01, PASSES * 8));

      // Byte 119: olen * 8 (output length in words, multiplied by 8)
      this.buffer.push(OpCodes.ToByte(olen * 8));

      // Append MSGLEN in little-endian 64-bit format
      // Note: JavaScript bitwise operators work on 32 bits, so we handle low and high separately
      for (let i = 0; i < 4; i++) {
        this.buffer.push(OpCodes.GetByte(MSGLEN, i));
      }
      // High 32 bits are always 0 for reasonable message sizes
      for (let i = 0; i < 4; i++) {
        this.buffer.push(0x00);
      }

      // Process final block
      if (this.buffer.length === 128) {
        this.processBlock(this.buffer);
      }

      // Fold output to desired length
      return this.foldOutput();
    }

    // Helper functions for tailoring (from sphlib)

    /**
     * @param {uint32} a0
     * @param {uint32} a1
     * @param {uint32} a2
     * @param {uint32} a3
     * @param {int32} n - rotation
     * @returns {uint32}
     */
    mix128(a0, a1, a2, a3, n) {
      let tmp = OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.And32(a0, 0x000000FF),
                OpCodes.And32(a1, 0x0000FF00)),
                OpCodes.And32(a2, 0x00FF0000)),
                OpCodes.And32(a3, 0xFF000000));
      if (n > 0) tmp = OpCodes.RotL32(tmp, n);
      return tmp;
    }

    /**
     * @param {uint32} x5
     * @param {uint32} x6
     * @param {uint32} x7
     * @returns {uint32}
     */
    mix160_0(x5, x6, x7) {
      const tmp = OpCodes.Or32(OpCodes.Or32(OpCodes.And32(x5, 0x01F80000), OpCodes.And32(x6, 0xFE000000)), OpCodes.And32(x7, 0x0000003F));
      return OpCodes.RotL32(tmp, 13);
    }

    /**
     * @param {uint32} x5
     * @param {uint32} x6
     * @param {uint32} x7
     * @returns {uint32}
     */
    mix160_1(x5, x6, x7) {
      const tmp = OpCodes.Or32(OpCodes.Or32(OpCodes.And32(x5, 0xFE000000), OpCodes.And32(x6, 0x0000003F)), OpCodes.And32(x7, 0x00000FC0));
      return OpCodes.RotL32(tmp, 7);
    }

    /**
     * @param {uint32} x5
     * @param {uint32} x6
     * @param {uint32} x7
     * @returns {uint32}
     */
    mix160_2(x5, x6, x7) {
      return OpCodes.Or32(OpCodes.Or32(OpCodes.And32(x5, 0x0000003F), OpCodes.And32(x6, 0x00000FC0)), OpCodes.And32(x7, 0x0007F000));
    }

    /**
     * @param {uint32} x5
     * @param {uint32} x6
     * @param {uint32} x7
     * @returns {uint32}
     */
    mix160_3(x5, x6, x7) {
      const tmp = OpCodes.Or32(OpCodes.Or32(OpCodes.And32(x5, 0x00000FC0), OpCodes.And32(x6, 0x0007F000)), OpCodes.And32(x7, 0x01F80000));
      return OpCodes.Shr32(tmp, 6);
    }

    /**
     * @param {uint32} x5
     * @param {uint32} x6
     * @param {uint32} x7
     * @returns {uint32}
     */
    mix160_4(x5, x6, x7) {
      const tmp = OpCodes.Or32(OpCodes.Or32(OpCodes.And32(x5, 0x0007F000), OpCodes.And32(x6, 0x01F80000)), OpCodes.And32(x7, 0xFE000000));
      return OpCodes.Shr32(tmp, 12);
    }

    /**
     * @param {uint32} x6
     * @param {uint32} x7
     * @returns {uint32}
     */
    mix192_0(x6, x7) {
      const tmp = OpCodes.Or32(OpCodes.And32(x6, 0xFC000000), OpCodes.And32(x7, 0x0000001F));
      return OpCodes.RotL32(tmp, 6);
    }

    /**
     * @param {uint32} x6
     * @param {uint32} x7
     * @returns {uint32}
     */
    mix192_1(x6, x7) {
      return OpCodes.Or32(OpCodes.And32(x6, 0x0000001F), OpCodes.And32(x7, 0x000003E0));
    }

    /**
     * @param {uint32} x6
     * @param {uint32} x7
     * @returns {uint32}
     */
    mix192_2(x6, x7) {
      const tmp = OpCodes.Or32(OpCodes.And32(x6, 0x000003E0), OpCodes.And32(x7, 0x0000FC00));
      return OpCodes.Shr32(tmp, 5);
    }

    /**
     * @param {uint32} x6
     * @param {uint32} x7
     * @returns {uint32}
     */
    mix192_3(x6, x7) {
      const tmp = OpCodes.Or32(OpCodes.And32(x6, 0x0000FC00), OpCodes.And32(x7, 0x001F0000));
      return OpCodes.Shr32(tmp, 10);
    }

    /**
     * @param {uint32} x6
     * @param {uint32} x7
     * @returns {uint32}
     */
    mix192_4(x6, x7) {
      const tmp = OpCodes.Or32(OpCodes.And32(x6, 0x001F0000), OpCodes.And32(x7, 0x03E00000));
      return OpCodes.Shr32(tmp, 16);
    }

    /**
     * @param {uint32} x6
     * @param {uint32} x7
     * @returns {uint32}
     */
    mix192_5(x6, x7) {
      const tmp = OpCodes.Or32(OpCodes.And32(x6, 0x03E00000), OpCodes.And32(x7, 0xFC000000));
      return OpCodes.Shr32(tmp, 21);
    }

    /**
     * Fold 256-bit state to desired output length using HAVAL tailoring
     * Based on sphlib reference implementation
     * @returns {uint8[]} hashBits / 8 bytes
     */
    foldOutput() {
      const s0 = this.state[0];
      const s1 = this.state[1];
      const s2 = this.state[2];
      const s3 = this.state[3];
      const s4 = this.state[4];
      const s5 = this.state[5];
      const s6 = this.state[6];
      const s7 = this.state[7];
      /** @type {uint32[]} */
      const out = [];

      // Apply tailoring based on output length - exact sphlib implementation
      if (this.hashBits === 128) {
        // 128-bit tailoring (case 4 in sphlib)
        out.push(OpCodes.Add32(s0, this.mix128(s7, s4, s5, s6, 24)));
        out.push(OpCodes.Add32(s1, this.mix128(s6, s7, s4, s5, 16)));
        out.push(OpCodes.Add32(s2, this.mix128(s5, s6, s7, s4, 8)));
        out.push(OpCodes.Add32(s3, this.mix128(s4, s5, s6, s7, 0)));
      } else if (this.hashBits === 160) {
        // 160-bit tailoring (case 5 in sphlib)
        out.push(OpCodes.Add32(s0, this.mix160_0(s5, s6, s7)));
        out.push(OpCodes.Add32(s1, this.mix160_1(s5, s6, s7)));
        out.push(OpCodes.Add32(s2, this.mix160_2(s5, s6, s7)));
        out.push(OpCodes.Add32(s3, this.mix160_3(s5, s6, s7)));
        out.push(OpCodes.Add32(s4, this.mix160_4(s5, s6, s7)));
      } else if (this.hashBits === 192) {
        // 192-bit tailoring (case 6 in sphlib)
        out.push(OpCodes.Add32(s0, this.mix192_0(s6, s7)));
        out.push(OpCodes.Add32(s1, this.mix192_1(s6, s7)));
        out.push(OpCodes.Add32(s2, this.mix192_2(s6, s7)));
        out.push(OpCodes.Add32(s3, this.mix192_3(s6, s7)));
        out.push(OpCodes.Add32(s4, this.mix192_4(s6, s7)));
        out.push(OpCodes.Add32(s5, this.mix192_5(s6, s7)));
      } else if (this.hashBits === 224) {
        // 224-bit tailoring (case 7 in sphlib)
        out.push(OpCodes.Add32(s0, OpCodes.And32(OpCodes.Shr32(s7, 27), 0x1F)));
        out.push(OpCodes.Add32(s1, OpCodes.And32(OpCodes.Shr32(s7, 22), 0x1F)));
        out.push(OpCodes.Add32(s2, OpCodes.And32(OpCodes.Shr32(s7, 18), 0x0F)));
        out.push(OpCodes.Add32(s3, OpCodes.And32(OpCodes.Shr32(s7, 13), 0x1F)));
        out.push(OpCodes.Add32(s4, OpCodes.And32(OpCodes.Shr32(s7, 9), 0x0F)));
        out.push(OpCodes.Add32(s5, OpCodes.And32(OpCodes.Shr32(s7, 4), 0x1F)));
        out.push(OpCodes.Add32(s6, OpCodes.And32(s7, 0x0F)));
      } else {
        // 256-bit needs no tailoring (case 8 in sphlib)
        for (let i = 0; i < 8; i++) out.push(this.state[i]);
      }

      /** @type {uint8[]} */
      const result = [];
      for (let i = 0; i < out.length; i++) {
        const bytes = OpCodes.Unpack32LE(out[i]);
        for (let j = 0; j < 4; j++) result.push(bytes[j]);
      }
      return result;
    }
  }

  /**
 * Haval - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Haval extends HashFunctionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "HAVAL";
        this.description = "HAVAL (HAsh of Variable Length) is a cryptographic hash function with variable output length (128, 160, 192, 224, 256 bits) and variable passes (3, 4, 5).";
        this.category = CategoryType.HASH;
        this.subCategory = "Variable Hash";
        this.securityStatus = SecurityStatus.INSECURE; // Known vulnerabilities
        this.complexity = ComplexityType.HIGH;

        // Algorithm properties
        this.inventor = "Yuliang Zheng, Josef Pieprzyk, Jennifer Seberry";
        this.year = 1992;
        this.country = CountryCode.AU;

        // Hash-specific properties
        /** @type {int32} */
        this.hashSize = 256; // bits (default)
        /** @type {int32} */
        this.blockSize = 1024; // bits

        // Documentation
        this.documentation = [
          new LinkItem("HAVAL - A One-Way Hashing Algorithm with Variable Length of Output", "https://web.archive.org/web/20171129084214/http://labs.calyptix.com/haval.php"),
          new LinkItem("US Patent 5,351,310 - HAVAL", "https://patents.google.com/patent/US5351310A/en"),
          new LinkItem("Cryptanalysis of HAVAL", "https://link.springer.com/chapter/10.1007/3-540-48329-2_24")
        ];

        this.references = [
          new LinkItem("Hash Function Cryptanalysis", "https://csrc.nist.gov/projects/hash-functions")
        ];

        // Test vectors from MrHash reference implementation
        this.tests = [
          {
            text: "String 'abc' - HAVAL-128/3",
            uri: "https://github.com/rikyoz/MrHash/blob/master/src/haval.cpp",
            input: OpCodes.AnsiToBytes("abc"),
            expected: OpCodes.Hex8ToBytes("9E40ED883FB63E985D299B40CDA2B8F2"),
            passes: 3,
            hashBits: 128
          },
          {
            text: "String 'abc' - HAVAL-256/3",
            uri: "https://github.com/rikyoz/MrHash/blob/master/src/haval.cpp",
            input: OpCodes.AnsiToBytes("abc"),
            expected: OpCodes.Hex8ToBytes("8699F1E3384D05B2A84B032693E2B6F46DF85A13A50D93808D6874BB8FB9E86C"),
            passes: 3,
            hashBits: 256
          },
          {
            text: "Empty string - HAVAL-256/5",
            uri: "https://github.com/rikyoz/MrHash/blob/master/src/haval.cpp",
            input: [],
            expected: OpCodes.Hex8ToBytes("BE417BB4DD5CFB76C7126F4F8EEB1553A449039307B1A3CD451DBFDC0FBBE330"),
            passes: 5,
            hashBits: 256
          },
          // The 160 and 192-bit folds, from the published php-src HAVAL values
          {
            text: "Empty string - HAVAL-160/3",
            uri: "https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt",
            input: OpCodes.AnsiToBytes(""),
            expected: OpCodes.Hex8ToBytes("D353C3AE22A25401D257643836D7231A9A95F953"),
            passes: 3,
            hashBits: 160
          },
          {
            text: "Empty string - HAVAL-192/5",
            uri: "https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt",
            input: OpCodes.AnsiToBytes(""),
            expected: OpCodes.Hex8ToBytes("4839D0626F95935E17EE2FC4509387BBE2CC46CB382FFE85"),
            passes: 5,
            hashBits: 192
          },
          {
            text: "String 'abc' - HAVAL-160/3",
            uri: "https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt",
            input: OpCodes.AnsiToBytes("abc"),
            expected: OpCodes.Hex8ToBytes("B21E876C4D391E2A897661149D83576B5530A089"),
            passes: 3,
            hashBits: 160
          },
          {
            text: "String 'abc' - HAVAL-160/4",
            uri: "https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt",
            input: OpCodes.AnsiToBytes("abc"),
            expected: OpCodes.Hex8ToBytes("77ACA22F5B12CC09010AFC9C0797308638B1CB9B"),
            passes: 4,
            hashBits: 160
          },
          {
            text: "String 'abc' - HAVAL-160/5",
            uri: "https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt",
            input: OpCodes.AnsiToBytes("abc"),
            expected: OpCodes.Hex8ToBytes("AE646B04845E3351F00C5161D138940E1FA0C11C"),
            passes: 5,
            hashBits: 160
          },
          {
            text: "String 'abc' - HAVAL-192/3",
            uri: "https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt",
            input: OpCodes.AnsiToBytes("abc"),
            expected: OpCodes.Hex8ToBytes("A7B14C9EF3092319B0E75E3B20B957D180BF20745629E8DE"),
            passes: 3,
            hashBits: 192
          },
          {
            text: "String 'abc' - HAVAL-192/4",
            uri: "https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt",
            input: OpCodes.AnsiToBytes("abc"),
            expected: OpCodes.Hex8ToBytes("7E29881ED05C915903DD5E24A8E81CDE5D910142AE66207C"),
            passes: 4,
            hashBits: 192
          },
          {
            text: "String 'abc' - HAVAL-192/5",
            uri: "https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt",
            input: OpCodes.AnsiToBytes("abc"),
            expected: OpCodes.Hex8ToBytes("D12091104555B00119A8D07808A3380BF9E60018915B9025"),
            passes: 5,
            hashBits: 192
          },
          {
            text: "String 'a..z A..Z 0..9' (61 chars) x3 - HAVAL-160/4",
            uri: "https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt",
            input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMOPQRSTUVWXYZ0123456789"),
            expected: OpCodes.Hex8ToBytes("3444E38CC2A132B818B554CED8F7D9592DF28F57"),
            passes: 4,
            hashBits: 160
          },
          {
            text: "String 'a..z A..Z 0..9' (61 chars) x3 - HAVAL-192/4",
            uri: "https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt",
            input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMOPQRSTUVWXYZ0123456789"),
            expected: OpCodes.Hex8ToBytes("0CA58F140ED92828A27913CE5636611ABCADA220FCCF3AF7"),
            passes: 4,
            hashBits: 192
          }
        ];


        // For test suite compatibility
        /** @type {TestCase[]} */
        this.testVectors = this.tests;
      }

      /**
       * Create new hash instance
       * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
       * @returns {HavalInstance} New hash instance
       */
      CreateInstance(isInverse = false) {
        return new HavalInstance(this, isInverse);
      }
    }

    class HavalInstance extends IHashFunctionInstance {
      /**
       * @param {Haval} algorithm - Parent algorithm
       * @param {boolean} [isInverse=false] - Unused: a hash has no inverse
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.inputBuffer = [];
        /** @type {int32} */
        this.hashSize = algorithm.hashSize;
        /** @type {int32} */
        this.blockSize = algorithm.blockSize;

        // Default HAVAL parameters
        /** @type {int32} */
        this.passes = 5;
        /** @type {int32} */
        this.hashBits = 256;
      }

      /**
       * Hash everything fed so far with the configured passes and size
       * @returns {uint8[]} Digest bytes
       */
      Result() {
        // Process using HAVAL hasher (even for empty input)
        // Use instance-specific parameters if set by test framework
        /** @type {HavalHasher} */
        const hasher = new HavalHasher(this.passes, this.hashBits);
        hasher.update(this.inputBuffer);
        /** @type {uint8[]} */
        const result = hasher.finalize();

        this.inputBuffer = [];
        return result;
      }

      /**
       * Direct hash interface with configurable parameters
       * @param {uint8[]} data - Message bytes
       * @param {int32} passCount - 3, 4 or 5 (0 selects 5)
       * @param {int32} outputBitLength - 128 .. 256 (0 selects 256)
       * @returns {uint8[]} Digest bytes
       */
      hash(data, passCount, outputBitLength) {
        /** @type {int32} */
        let p = 5;
        if (passCount) p = passCount;
        /** @type {int32} */
        let bits = 256;
        if (outputBitLength) bits = outputBitLength;
        /** @type {HavalHasher} */
        const hasher = new HavalHasher(p, bits);
        hasher.update(data);
        /** @type {uint8[]} */
        const digest = hasher.finalize();
        return digest;
      }

      /**
       * HAVAL-128
       * @param {uint8[]} data - Message bytes
       * @param {int32} passCount - 3, 4 or 5 (0 selects 3)
       * @returns {uint8[]} Digest bytes
       */
      hash128(data, passCount) {
        return this.hash(data, passCount ? passCount : 3, 128);
      }

      /**
       * HAVAL-160
       * @param {uint8[]} data - Message bytes
       * @param {int32} passCount - 3, 4 or 5 (0 selects 4)
       * @returns {uint8[]} Digest bytes
       */
      hash160(data, passCount) {
        return this.hash(data, passCount ? passCount : 4, 160);
      }

      /**
       * HAVAL-192
       * @param {uint8[]} data - Message bytes
       * @param {int32} passCount - 3, 4 or 5 (0 selects 4)
       * @returns {uint8[]} Digest bytes
       */
      hash192(data, passCount) {
        return this.hash(data, passCount ? passCount : 4, 192);
      }

      /**
       * HAVAL-224
       * @param {uint8[]} data - Message bytes
       * @param {int32} passCount - 3, 4 or 5 (0 selects 4)
       * @returns {uint8[]} Digest bytes
       */
      hash224(data, passCount) {
        return this.hash(data, passCount ? passCount : 4, 224);
      }

      /**
       * HAVAL-256
       * @param {uint8[]} data - Message bytes
       * @param {int32} passCount - 3, 4 or 5 (0 selects 5)
       * @returns {uint8[]} Digest bytes
       */
      hash256(data, passCount) {
        return this.hash(data, passCount ? passCount : 5, 256);
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new Haval();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Haval, HavalInstance };
}));