
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

  // HAVAL Hasher - Core implementation of HAVAL algorithm
  class HavalHasher {
    constructor(passes, hashBits) {
      if (![3, 4, 5].includes(passes)) {
        throw new Error('HAVAL passes must be 3, 4, or 5');
      }
      if (![128, 160, 192, 224, 256].includes(hashBits)) {
        throw new Error('HAVAL hash size must be 128, 160, 192, 224, or 256 bits');
      }

      this.passes = passes;
      this.hashBits = hashBits;
      this.buffer = [];
      this.totalLength = 0;

      // Initialize state with HAVAL IV (from reference implementation)
      this.state = new Uint32Array([
        0x243F6A88, 0x85A308D3, 0x13198A2E, 0x03707344,
        0xA4093822, 0x299F31D0, 0x082EFA98, 0xEC4E6C89
      ]);
    }

    // HAVAL Boolean functions F1 through F5 - correct formulas from reference implementation
    // Based on bitbandi/all-hash-python and reference C implementation

    // F1: Pass 1 boolean function
    f1(x6, x5, x4, x3, x2, x1, x0) {
      return OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(x1, OpCodes.XorN(x0, x4)), OpCodes.AndN(x2, x5)), OpCodes.AndN(x3, x6)), x0);
    }

    // F2: Pass 2 boolean function
    f2(x6, x5, x4, x3, x2, x1, x0) {
      return OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(x2, OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(x1, ~x3), OpCodes.AndN(x4, x5)), OpCodes.XorN(x6, x0))),
             OpCodes.AndN(x4, OpCodes.XorN(x1, x5))), OpCodes.AndN(x3, x5)), x0);
    }

    // F3: Pass 3 boolean function
    f3(x6, x5, x4, x3, x2, x1, x0) {
      return OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(x3, OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(x1, x2), x6), x0)),
             OpCodes.AndN(x1, x4)), OpCodes.AndN(x2, x5)), x0);
    }

    // F4: Pass 4 boolean function
    f4(x6, x5, x4, x3, x2, x1, x0) {
      return OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(x3, OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(x1, x2), OpCodes.OrN(x4, x6)), x5)),
             OpCodes.AndN(x4, OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(~x2, x5), x1), OpCodes.XorN(x6, x0)))),
             OpCodes.AndN(x2, x6)), x0);
    }

    // F5: Pass 5 boolean function
    f5(x6, x5, x4, x3, x2, x1, x0) {
      return OpCodes.XorN(OpCodes.XorN(OpCodes.XorN(OpCodes.AndN(x0, ~OpCodes.XorN(OpCodes.AndN(OpCodes.AndN(x1, x2), x3), x5)),
             OpCodes.AndN(x1, x4)), OpCodes.AndN(x2, x5)), OpCodes.AndN(x3, x6));
    }

    // Round constants from reference implementation - RK2, RK3, RK4, RK5
    getRoundConstants() {
      return {
        // No constants for pass 1
        // RK2 - Pass 2 constants
        pass2: [
          0x452821E6, 0x38D01377, 0xBE5466CF, 0x34E90C6C, 0xC0AC29B7, 0xC97C50DD, 0x3F84D5B5, 0xB5470917,
          0x9216D5D9, 0x8979FB1B, 0xD1310BA6, 0x98DFB5AC, 0x2FFD72DB, 0xD01ADFB7, 0xB8E1AFED, 0x6A267E96,
          0xBA7C9045, 0xF12C7F99, 0x24A19947, 0xB3916CF7, 0x0801F2E2, 0x858EFC16, 0x636920D8, 0x71574E69,
          0xA458FEA3, 0xF4933D7E, 0x0D95748F, 0x728EB658, 0x718BCD58, 0x82154AEE, 0x7B54A41D, 0xC25A59B5
        ],
        // RK3 - Pass 3 constants
        pass3: [
          0x9C30D539, 0x2AF26013, 0xC5D1B023, 0x286085F0, 0xCA417918, 0xB8DB38EF, 0x8E79DCB0, 0x603A180E,
          0x6C9E0E8B, 0xB01E8A3E, 0xD71577C1, 0xBD314B27, 0x78AF2FDA, 0x55605C60, 0xE65525F3, 0xAA55AB94,
          0x57489862, 0x63E81440, 0x55CA396A, 0x2AAB10B6, 0xB4CC5C34, 0x1141E8CE, 0xA15486AF, 0x7C72E993,
          0xB3EE1411, 0x636FBC2A, 0x2BA9C55D, 0x741831F6, 0xCE5C3E16, 0x9B87931E, 0xAFD6BA33, 0x6C24CF5C
        ],
        // RK4 - Pass 4 constants
        pass4: [
          0x7A325381, 0x28958677, 0x3B8F4898, 0x6B4BB9AF, 0xC4BFE81B, 0x66282193, 0x61D809CC, 0xFB21A991,
          0x487CAC60, 0x5DEC8032, 0xEF845D5D, 0xE98575B1, 0xDC262302, 0xEB651B88, 0x23893E81, 0xD396ACC5,
          0x0F6D6FF3, 0x83F44239, 0x2E0B4482, 0xA4842004, 0x69C8F04A, 0x9E1F9B5E, 0x21C66842, 0xF6E96C9A,
          0x670C9C61, 0xABD388F0, 0x6A51A0D2, 0xD8542F68, 0x960FA728, 0xAB5133A3, 0x6EEF0B6C, 0x137A3BE4
        ],
        // RK5 - Pass 5 constants
        pass5: [
          0xBA3BF050, 0x7EFB2A98, 0xA1F1651D, 0x39AF0176, 0x66CA593E, 0x82430E88, 0x8CEE8619, 0x456F9FB4,
          0x7D84A5C3, 0x3B8B5EBE, 0xE06F75D8, 0x85C12073, 0x401A449F, 0x56C16AA6, 0x4ED3AA62, 0x363F7706,
          0x1BFEDF72, 0x429B023D, 0x37D0D724, 0xD00A1248, 0xDB0FEAD3, 0x49F1C09B, 0x075372C9, 0x80991B7B,
          0x25D479D8, 0xF6E8DEF7, 0xE3FE501A, 0xB6794C3B, 0x976CE0BD, 0x04C006BA, 0xC1A94FB6, 0x409F60C4
        ]
      };
    }

    // PHI permutations for state variables - different for each pass/total configuration
    // FP3 (3-pass) permutations
    fp3_1(x6, x5, x4, x3, x2, x1, x0) { return this.f1(x1, x0, x3, x5, x6, x2, x4); }
    fp3_2(x6, x5, x4, x3, x2, x1, x0) { return this.f2(x4, x2, x1, x0, x5, x3, x6); }
    fp3_3(x6, x5, x4, x3, x2, x1, x0) { return this.f3(x6, x1, x2, x3, x4, x5, x0); }

    // FP4 (4-pass) permutations
    fp4_1(x6, x5, x4, x3, x2, x1, x0) { return this.f1(x2, x6, x1, x4, x5, x3, x0); }
    fp4_2(x6, x5, x4, x3, x2, x1, x0) { return this.f2(x3, x5, x2, x0, x1, x6, x4); }
    fp4_3(x6, x5, x4, x3, x2, x1, x0) { return this.f3(x1, x4, x3, x6, x0, x2, x5); }
    fp4_4(x6, x5, x4, x3, x2, x1, x0) { return this.f4(x6, x4, x0, x5, x2, x1, x3); }

    // FP5 (5-pass) permutations
    fp5_1(x6, x5, x4, x3, x2, x1, x0) { return this.f1(x3, x4, x1, x0, x5, x2, x6); }
    fp5_2(x6, x5, x4, x3, x2, x1, x0) { return this.f2(x6, x2, x1, x0, x3, x4, x5); }
    fp5_3(x6, x5, x4, x3, x2, x1, x0) { return this.f3(x2, x6, x0, x4, x3, x1, x5); }
    fp5_4(x6, x5, x4, x3, x2, x1, x0) { return this.f4(x1, x5, x3, x2, x0, x4, x6); }
    fp5_5(x6, x5, x4, x3, x2, x1, x0) { return this.f5(x2, x5, x0, x6, x4, x3, x1); }

    // HAVAL processes 32 words directly from each 1024-bit block
    // No expansion needed - just use the 32 words directly
    prepareMessage(words) {
      // HAVAL uses all 32 words from the 1024-bit block directly
      return words.slice(0, 32);
    }

    // Process a 1024-bit block
    processBlock(block) {
      const words = [];

      // Convert bytes to 32-bit words (little-endian)
      for (let i = 0; i < 32; i++) {
        const offset = i * 4;
        words[i] = OpCodes.Pack32LE(
          block[offset] || 0,
          block[offset + 1] || 0,
          block[offset + 2] || 0,
          block[offset + 3] || 0
        );
      }

      // Get constants
      const K = this.getRoundConstants();

      // Initialize working state [s0, s1, s2, s3, s4, s5, s6, s7]
      let [s0, s1, s2, s3, s4, s5, s6, s7] = this.state;

      // Select the correct PHI permutations based on number of passes
      const fpFunctions = this.passes === 3 ? [this.fp3_1, this.fp3_2, this.fp3_3] :
                         this.passes === 4 ? [this.fp4_1, this.fp4_2, this.fp4_3, this.fp4_4] :
                                            [this.fp5_1, this.fp5_2, this.fp5_3, this.fp5_4, this.fp5_5];

      // Define word permutations for each pass (matching sphlib)
      const wordPermutations = [
        // Pass 1: Sequential order
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
        // Pass 2: MP2
        [5, 14, 26, 18, 11, 28, 7, 16, 0, 23, 20, 22, 1, 10, 4, 8, 30, 3, 21, 9, 17, 24, 29, 6, 19, 12, 15, 13, 2, 25, 31, 27],
        // Pass 3: MP3
        [19, 9, 4, 20, 28, 17, 8, 22, 29, 14, 25, 12, 24, 30, 16, 26, 31, 15, 7, 3, 1, 0, 18, 27, 13, 6, 21, 10, 23, 11, 5, 2],
        // Pass 4: MP4
        [24, 4, 0, 14, 2, 7, 28, 23, 26, 6, 30, 20, 18, 25, 19, 3, 22, 11, 31, 21, 8, 27, 12, 9, 1, 29, 5, 15, 17, 10, 16, 13],
        // Pass 5: MP5
        [27, 3, 21, 26, 17, 11, 20, 29, 19, 0, 12, 7, 13, 8, 31, 10, 5, 9, 14, 30, 18, 6, 28, 24, 2, 23, 16, 22, 4, 1, 25, 15]
      ];

      const constantArrays = [null, K.pass2, K.pass3, K.pass4, K.pass5];

      // Execute passes - STEP macro from sphlib creates 8 steps per iteration
      // Each group of 8 steps processes: s7, s6, s5, s4, s3, s2, s1, s0 (in that order)
      // STEP(n, p, x7, x6, x5, x4, x3, x2, x1, x0, w, c):
      //   t = FP##n##_##p(x6, x5, x4, x3, x2, x1, x0)
      //   x7 = ROTR32(t, 7) + ROTR32(x7, 11) + w + c

      for (let pass = 0; pass < this.passes; pass++) {
        const fpFunc = fpFunctions[pass];
        const wperm = wordPermutations[pass];
        const constants = constantArrays[pass] || [];

        // Process all 32 rounds (4 groups of 8 steps each)
        for (let i = 0; i < 32; i++) {
          const word = words[wperm[i]];
          const constant = constants[i] || 0;
          let temp, newVal;

          // Determine which state variable to update based on position in group of 8
          switch (i % 8) {
            case 0:  // Update s7
              temp = fpFunc.call(this, s6, s5, s4, s3, s2, s1, s0);
              s7 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s7, 11)), word), constant);
              break;
            case 1:  // Update s6
              temp = fpFunc.call(this, s5, s4, s3, s2, s1, s0, s7);
              s6 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s6, 11)), word), constant);
              break;
            case 2:  // Update s5
              temp = fpFunc.call(this, s4, s3, s2, s1, s0, s7, s6);
              s5 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s5, 11)), word), constant);
              break;
            case 3:  // Update s4
              temp = fpFunc.call(this, s3, s2, s1, s0, s7, s6, s5);
              s4 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s4, 11)), word), constant);
              break;
            case 4:  // Update s3
              temp = fpFunc.call(this, s2, s1, s0, s7, s6, s5, s4);
              s3 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s3, 11)), word), constant);
              break;
            case 5:  // Update s2
              temp = fpFunc.call(this, s1, s0, s7, s6, s5, s4, s3);
              s2 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s2, 11)), word), constant);
              break;
            case 6:  // Update s1
              temp = fpFunc.call(this, s0, s7, s6, s5, s4, s3, s2);
              s1 = OpCodes.Add32(OpCodes.Add32(OpCodes.Add32(OpCodes.RotR32(temp, 7), OpCodes.RotR32(s1, 11)), word), constant);
              break;
            case 7:  // Update s0
              temp = fpFunc.call(this, s7, s6, s5, s4, s3, s2, s1);
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

    update(data) {
      if (!data || data.length === 0) return;

      this.buffer.push(...data);
      this.totalLength += data.length;

      // Process complete 128-byte blocks
      while (this.buffer.length >= 128) {
        const block = this.buffer.splice(0, 128);
        this.processBlock(block);
      }
    }

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
      // Byte 118: 0x01 | (PASSES << 3)
      // Byte 119: olen << 3  (where olen is output length in 32-bit words)
      // Bytes 120-127: Message length in bits (64-bit little-endian)

      const PASSES = this.passes;  // Number of passes (3, 4, or 5)
      const olen = this.hashBits / 32;  // Output length in 32-bit words
      const MSGLEN = msgLen * 8;  // Message length in bits

      // Byte 118: VERSION (always 0x01) | (PASSES * 8)
      this.buffer.push(OpCodes.OrN(0x01, (PASSES * 8)));

      // Byte 119: olen * 8 (output length in words, multiplied by 8)
      this.buffer.push(olen * 8);

      // Append MSGLEN in little-endian 64-bit format
      // Note: JavaScript bitwise operators work on 32 bits, so we handle low and high separately
      for (let i = 0; i < 4; i++) {
        this.buffer.push(OpCodes.AndN(OpCodes.Shr32(MSGLEN, i * 8), 0xFF));
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
    mix128(a0, a1, a2, a3, n) {
      let tmp = OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.AndN(a0, 0x000000FF),
                OpCodes.AndN(a1, 0x0000FF00)),
                OpCodes.AndN(a2, 0x00FF0000)),
                OpCodes.AndN(a3, 0xFF000000));
      if (n > 0) tmp = OpCodes.RotL32(tmp, n);
      return tmp;
    }

    mix160_0(x5, x6, x7) {
      const tmp = OpCodes.OrN(OpCodes.OrN(OpCodes.AndN(x5, 0x01F80000), OpCodes.AndN(x6, 0xFE000000)), OpCodes.AndN(x7, 0x0000003F));
      return OpCodes.RotL32(tmp, 13);
    }

    mix160_1(x5, x6, x7) {
      const tmp = OpCodes.OrN(OpCodes.OrN(OpCodes.AndN(x5, 0xFE000000), OpCodes.AndN(x6, 0x0000003F)), OpCodes.AndN(x7, 0x00000FC0));
      return OpCodes.RotL32(tmp, 7);
    }

    mix160_2(x5, x6, x7) {
      return OpCodes.OrN(OpCodes.OrN(OpCodes.AndN(x5, 0x0000003F), OpCodes.AndN(x6, 0x00000FC0)), OpCodes.AndN(x7, 0x0007F000));
    }

    mix160_3(x5, x6, x7) {
      const tmp = OpCodes.OrN(OpCodes.OrN(OpCodes.AndN(x5, 0x00000FC0), OpCodes.AndN(x6, 0x0007F000)), OpCodes.AndN(x7, 0x01F80000));
      return OpCodes.RotL32(tmp, 6);
    }

    mix160_4(x5, x6, x7) {
      const tmp = OpCodes.OrN(OpCodes.OrN(OpCodes.AndN(x5, 0x0007F000), OpCodes.AndN(x6, 0x01F80000)), OpCodes.AndN(x7, 0xFE000000));
      return OpCodes.RotL32(tmp, 12);
    }

    mix192_0(x6, x7) {
      const tmp = OpCodes.OrN(OpCodes.AndN(x6, 0xFC000000), OpCodes.AndN(x7, 0x0000001F));
      return OpCodes.RotL32(tmp, 6);
    }

    mix192_1(x6, x7) {
      return OpCodes.OrN(OpCodes.AndN(x6, 0x0000001F), OpCodes.AndN(x7, 0x000003E0));
    }

    mix192_2(x6, x7) {
      const tmp = OpCodes.OrN(OpCodes.AndN(x6, 0x000003E0), OpCodes.AndN(x7, 0x0000FC00));
      return OpCodes.RotL32(tmp, 5);
    }

    mix192_3(x6, x7) {
      const tmp = OpCodes.OrN(OpCodes.AndN(x6, 0x0000FC00), OpCodes.AndN(x7, 0x001F0000));
      return OpCodes.RotL32(tmp, 10);
    }

    mix192_4(x6, x7) {
      const tmp = OpCodes.OrN(OpCodes.AndN(x6, 0x001F0000), OpCodes.AndN(x7, 0x03E00000));
      return OpCodes.RotL32(tmp, 16);
    }

    mix192_5(x6, x7) {
      const tmp = OpCodes.OrN(OpCodes.AndN(x6, 0x03E00000), OpCodes.AndN(x7, 0xFC000000));
      return OpCodes.RotL32(tmp, 21);
    }

    // Fold 256-bit state to desired output length using HAVAL tailoring
    // Based on sphlib reference implementation
    foldOutput() {
      const [s0, s1, s2, s3, s4, s5, s6, s7] = this.state;
      const result = [];

      // Apply tailoring based on output length - exact sphlib implementation
      if (this.hashBits === 128) {
        // 128-bit tailoring (case 4 in sphlib)
        const w0 = OpCodes.Add32(s0, this.mix128(s7, s4, s5, s6, 24));
        const w1 = OpCodes.Add32(s1, this.mix128(s6, s7, s4, s5, 16));
        const w2 = OpCodes.Add32(s2, this.mix128(s5, s6, s7, s4, 8));
        const w3 = OpCodes.Add32(s3, this.mix128(s4, s5, s6, s7, 0));
        result.push(...OpCodes.Unpack32LE(w0));
        result.push(...OpCodes.Unpack32LE(w1));
        result.push(...OpCodes.Unpack32LE(w2));
        result.push(...OpCodes.Unpack32LE(w3));
      } else if (this.hashBits === 160) {
        // 160-bit tailoring (case 5 in sphlib)
        const w0 = OpCodes.Add32(s0, this.mix160_0(s5, s6, s7));
        const w1 = OpCodes.Add32(s1, this.mix160_1(s5, s6, s7));
        const w2 = OpCodes.Add32(s2, this.mix160_2(s5, s6, s7));
        const w3 = OpCodes.Add32(s3, this.mix160_3(s5, s6, s7));
        const w4 = OpCodes.Add32(s4, this.mix160_4(s5, s6, s7));
        result.push(...OpCodes.Unpack32LE(w0));
        result.push(...OpCodes.Unpack32LE(w1));
        result.push(...OpCodes.Unpack32LE(w2));
        result.push(...OpCodes.Unpack32LE(w3));
        result.push(...OpCodes.Unpack32LE(w4));
      } else if (this.hashBits === 192) {
        // 192-bit tailoring (case 6 in sphlib)
        const w0 = OpCodes.Add32(s0, this.mix192_0(s6, s7));
        const w1 = OpCodes.Add32(s1, this.mix192_1(s6, s7));
        const w2 = OpCodes.Add32(s2, this.mix192_2(s6, s7));
        const w3 = OpCodes.Add32(s3, this.mix192_3(s6, s7));
        const w4 = OpCodes.Add32(s4, this.mix192_4(s6, s7));
        const w5 = OpCodes.Add32(s5, this.mix192_5(s6, s7));
        result.push(...OpCodes.Unpack32LE(w0));
        result.push(...OpCodes.Unpack32LE(w1));
        result.push(...OpCodes.Unpack32LE(w2));
        result.push(...OpCodes.Unpack32LE(w3));
        result.push(...OpCodes.Unpack32LE(w4));
        result.push(...OpCodes.Unpack32LE(w5));
      } else if (this.hashBits === 224) {
        // 224-bit tailoring (case 7 in sphlib)
        const w0 = OpCodes.Add32(s0, OpCodes.AndN(OpCodes.Shr32(s7, 27), 0x1F));
        const w1 = OpCodes.Add32(s1, OpCodes.AndN(OpCodes.Shr32(s7, 22), 0x1F));
        const w2 = OpCodes.Add32(s2, OpCodes.AndN(OpCodes.Shr32(s7, 18), 0x0F));
        const w3 = OpCodes.Add32(s3, OpCodes.AndN(OpCodes.Shr32(s7, 13), 0x1F));
        const w4 = OpCodes.Add32(s4, OpCodes.AndN(OpCodes.Shr32(s7, 9), 0x0F));
        const w5 = OpCodes.Add32(s5, OpCodes.AndN(OpCodes.Shr32(s7, 4), 0x1F));
        const w6 = OpCodes.Add32(s6, OpCodes.AndN(s7, 0x0F));
        result.push(...OpCodes.Unpack32LE(w0));
        result.push(...OpCodes.Unpack32LE(w1));
        result.push(...OpCodes.Unpack32LE(w2));
        result.push(...OpCodes.Unpack32LE(w3));
        result.push(...OpCodes.Unpack32LE(w4));
        result.push(...OpCodes.Unpack32LE(w5));
        result.push(...OpCodes.Unpack32LE(w6));
      } else {
        // 256-bit needs no tailoring (case 8 in sphlib)
        result.push(...OpCodes.Unpack32LE(s0));
        result.push(...OpCodes.Unpack32LE(s1));
        result.push(...OpCodes.Unpack32LE(s2));
        result.push(...OpCodes.Unpack32LE(s3));
        result.push(...OpCodes.Unpack32LE(s4));
        result.push(...OpCodes.Unpack32LE(s5));
        result.push(...OpCodes.Unpack32LE(s6));
        result.push(...OpCodes.Unpack32LE(s7));
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
        this.hashSize = 256; // bits (default)
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
          }
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new HavalInstance(this, isInverse);
      }
    }

    class HavalInstance extends IHashFunctionInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.inputBuffer = [];
        this.hashSize = algorithm.hashSize;
        this.blockSize = algorithm.blockSize;

        // Default HAVAL parameters
        this.passes = 5;
        this.hashBits = 256;
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        // Process using HAVAL hasher (even for empty input)
        // Use instance-specific parameters if set by test framework
        const hasher = new HavalHasher(this.passes, this.hashBits);
        hasher.update(this.inputBuffer);
        const result = hasher.finalize();

        this.inputBuffer = [];
        return Array.from(result);
      }

      // Direct hash interface with configurable parameters
      hash(data, passes, outputBits) {
        const hasher = new HavalHasher(passes || 5, outputBits || 256);
        hasher.update(data);
        return hasher.finalize();
      }

      // Convenient preset variants
      hash128(data, passes) {
        return this.hash(data, passes || 3, 128);
      }

      hash160(data, passes) {
        return this.hash(data, passes || 4, 160);
      }

      hash192(data, passes) {
        return this.hash(data, passes || 4, 192);
      }

      hash224(data, passes) {
        return this.hash(data, passes || 4, 224);
      }

      hash256(data, passes) {
        return this.hash(data, passes || 5, 256);
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