/*
 * Elephant AEAD - NIST Lightweight Cryptography Finalist
 * AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 *
 * Elephant is a family of authenticated encryption algorithms based on sponge
 * permutations (Spongent-π and Keccak-p[200]). It uses an LFSR-based mask
 * technique to provide both encryption and authentication in a lightweight design.
 *
 * Three variants:
 * - Dumbo: Spongent-π[160], 80 rounds, 8-byte tag
 * - Jumbo: Spongent-π[176], 90 rounds, 8-byte tag
 * - Delirium: Keccak-p[200], 18 rounds, 16-byte tag
 *
 * All variants:
 * - 128-bit key
 * - 96-bit nonce
 * - NIST LWC finalist
 *
 * References:
 * - https://www.esat.kuleuven.be/cosic/elephant/
 * - NIST Lightweight Cryptography Round 3
 * - https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/elephant-spec-final.pdf
 *
 * This implementation is for educational purposes only.
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== PERMUTATION PRIMITIVES =====

  /**
   * Spongent S-box lookup table (4-bit to 4-bit non-linear transformation)
   * Applied byte-wise for efficient implementation
   */
  var SPONGENT_SBOX = [
    0xee, 0xed, 0xeb, 0xe0, 0xe2, 0xe1, 0xe4, 0xef, 0xe7, 0xea, 0xe8, 0xe5, 0xe9, 0xec, 0xe3, 0xe6,
    0xde, 0xdd, 0xdb, 0xd0, 0xd2, 0xd1, 0xd4, 0xdf, 0xd7, 0xda, 0xd8, 0xd5, 0xd9, 0xdc, 0xd3, 0xd6,
    0xbe, 0xbd, 0xbb, 0xb0, 0xb2, 0xb1, 0xb4, 0xbf, 0xb7, 0xba, 0xb8, 0xb5, 0xb9, 0xbc, 0xb3, 0xb6,
    0x0e, 0x0d, 0x0b, 0x00, 0x02, 0x01, 0x04, 0x0f, 0x07, 0x0a, 0x08, 0x05, 0x09, 0x0c, 0x03, 0x06,
    0x2e, 0x2d, 0x2b, 0x20, 0x22, 0x21, 0x24, 0x2f, 0x27, 0x2a, 0x28, 0x25, 0x29, 0x2c, 0x23, 0x26,
    0x1e, 0x1d, 0x1b, 0x10, 0x12, 0x11, 0x14, 0x1f, 0x17, 0x1a, 0x18, 0x15, 0x19, 0x1c, 0x13, 0x16,
    0x4e, 0x4d, 0x4b, 0x40, 0x42, 0x41, 0x44, 0x4f, 0x47, 0x4a, 0x48, 0x45, 0x49, 0x4c, 0x43, 0x46,
    0xfe, 0xfd, 0xfb, 0xf0, 0xf2, 0xf1, 0xf4, 0xff, 0xf7, 0xfa, 0xf8, 0xf5, 0xf9, 0xfc, 0xf3, 0xf6,
    0x7e, 0x7d, 0x7b, 0x70, 0x72, 0x71, 0x74, 0x7f, 0x77, 0x7a, 0x78, 0x75, 0x79, 0x7c, 0x73, 0x76,
    0xae, 0xad, 0xab, 0xa0, 0xa2, 0xa1, 0xa4, 0xaf, 0xa7, 0xaa, 0xa8, 0xa5, 0xa9, 0xac, 0xa3, 0xa6,
    0x8e, 0x8d, 0x8b, 0x80, 0x82, 0x81, 0x84, 0x8f, 0x87, 0x8a, 0x88, 0x85, 0x89, 0x8c, 0x83, 0x86,
    0x5e, 0x5d, 0x5b, 0x50, 0x52, 0x51, 0x54, 0x5f, 0x57, 0x5a, 0x58, 0x55, 0x59, 0x5c, 0x53, 0x56,
    0x9e, 0x9d, 0x9b, 0x90, 0x92, 0x91, 0x94, 0x9f, 0x97, 0x9a, 0x98, 0x95, 0x99, 0x9c, 0x93, 0x96,
    0xce, 0xcd, 0xcb, 0xc0, 0xc2, 0xc1, 0xc4, 0xcf, 0xc7, 0xca, 0xc8, 0xc5, 0xc9, 0xcc, 0xc3, 0xc6,
    0x3e, 0x3d, 0x3b, 0x30, 0x32, 0x31, 0x34, 0x3f, 0x37, 0x3a, 0x38, 0x35, 0x39, 0x3c, 0x33, 0x36,
    0x6e, 0x6d, 0x6b, 0x60, 0x62, 0x61, 0x64, 0x6f, 0x67, 0x6a, 0x68, 0x65, 0x69, 0x6c, 0x63, 0x66
  ];

  /**
   * Generic Spongent permutation based on Bouncy Castle reference implementation
   * Supports both 160-bit (Dumbo) and 176-bit (Jumbo) variants
   * @param {Array} state - byte array of state (20 or 22 bytes)
   * @param {number} nBits - state size in bits (160 or 176)
   * @param {number} nRounds - number of rounds (80 or 90)
   * @param {number} lfsrIV - initial value for round constant LFSR (0x75 or 0x45)
   */
  function spongentPermute(state, nBits, nRounds, lfsrIV) {
    var nSBox = OpCodes.Shr32(nBits, 3);  // Number of bytes
    var IV = lfsrIV;
    var tmp = new Array(nSBox);

    for (var round = 0; round < nRounds; ++round) {
      // Add round constants
      state[0] = OpCodes.XorN(state[0], IV);
      var reversedIV = OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(OpCodes.OrN(
        OpCodes.Shl32(OpCodes.AndN(IV, 0x01), 7),
        OpCodes.Shl32(OpCodes.AndN(IV, 0x02), 5)),
        OpCodes.Shl32(OpCodes.AndN(IV, 0x04), 3)),
        OpCodes.Shl32(OpCodes.AndN(IV, 0x08), 1)),
        OpCodes.Shr32(OpCodes.AndN(IV, 0x10), 1)),
        OpCodes.Shr32(OpCodes.AndN(IV, 0x20), 3)),
        OpCodes.Shr32(OpCodes.AndN(IV, 0x40), 5)),
        OpCodes.Shr32(OpCodes.AndN(IV, 0x80), 7));
      state[nSBox - 1] = OpCodes.XorN(state[nSBox - 1], reversedIV);

      // Step LFSR for next round constant
      IV = OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(IV, 1), OpCodes.XorN(OpCodes.Shr32(OpCodes.AndN(0x40, IV), 6), OpCodes.Shr32(OpCodes.AndN(0x20, IV), 5))), 0x7f);

      // S-box layer
      for (var j = 0; j < nSBox; ++j) {
        state[j] = SPONGENT_SBOX[OpCodes.AndN(state[j], 0xFF)];
      }

      // Bit permutation layer
      for (var j = 0; j < nSBox; ++j) {
        tmp[j] = 0;
      }

      for (var j = 0; j < nSBox; ++j) {
        for (var k = 0; k < 8; ++k) {
          var bitNo = OpCodes.Shl32(j, 3) + k;
          var permutedBitNo = bitNo;

          // Apply permutation formula: bit i -> ((i * nBits) / 4) % (nBits - 1)
          // except for last bit which stays in place
          if (permutedBitNo !== nBits - 1) {
            permutedBitNo = OpCodes.Shr32((permutedBitNo * nBits), 2) % (nBits - 1);
          }

          // Extract bit from state and place in permuted position
          var bit = OpCodes.AndN(OpCodes.Shr32(OpCodes.AndN(state[j], 0xFF), k), 0x1);
          tmp[OpCodes.Shr32(permutedBitNo, 3)] = OpCodes.XorN(tmp[OpCodes.Shr32(permutedBitNo, 3)], OpCodes.Shl32(bit, OpCodes.AndN(permutedBitNo, 7)));
        }
      }

      // Copy permuted state back
      for (var j = 0; j < nSBox; ++j) {
        state[j] = tmp[j];
      }
    }
  }

  /**
   * Spongent-π[160] permutation wrapper
   * 160-bit state, 80 rounds, LFSR IV = 0x75
   */
  function spongent160Permute(state) {
    spongentPermute(state, 160, 80, 0x75);
  }

  /**
   * Spongent-π[176] permutation wrapper
   * 176-bit state (22 bytes), 90 rounds, LFSR IV = 0x45
   */
  function spongent176Permute(state) {
    spongentPermute(state, 176, 90, 0x45);
  }

  /**
   * Keccak-p[200] permutation (for Delirium variant)
   * 200-bit state (25 bytes = 5x5 lane array), 18 rounds
   */
  function keccakP200Permute(state) {
    var RC = [
      0x01, 0x82, 0x8a, 0x00, 0x8b, 0x01, 0x81, 0x09, 0x8a,
      0x88, 0x09, 0x0a, 0x8b, 0x8b, 0x89, 0x03, 0x02, 0x80
    ];

    var RHO = [0, 1, 6, 4, 3, 4, 4, 6, 7, 4, 3, 2, 3, 1, 7, 1, 5, 7, 5, 0, 2, 2, 5, 0, 6];

    var tempA = new Array(25);
    var index = function(x, y) { return x + y * 5; };
    var ROL8 = function(a, offset) {
      return OpCodes.AndN(OpCodes.OrN(OpCodes.Shl32(a, offset), OpCodes.Shr32(OpCodes.AndN(a, 0xff), (8 - offset))), 0xFF);
    };

    for (var round = 0; round < 18; ++round) {
      var x, y;

      // Theta
      for (x = 0; x < 5; ++x) {
        tempA[x] = 0;
        for (y = 0; y < 5; ++y) {
          tempA[x] = OpCodes.XorN(tempA[x], state[index(x, y)]);
        }
      }
      for (x = 0; x < 5; ++x) {
        tempA[x + 5] = OpCodes.XorN(ROL8(tempA[(x + 1) % 5], 1), tempA[(x + 4) % 5]);
      }
      for (x = 0; x < 5; ++x) {
        for (y = 0; y < 5; ++y) {
          state[index(x, y)] = OpCodes.XorN(state[index(x, y)], tempA[x + 5]);
        }
      }

      // Rho
      for (x = 0; x < 5; ++x) {
        for (y = 0; y < 5; ++y) {
          tempA[index(x, y)] = ROL8(state[index(x, y)], RHO[index(x, y)]);
        }
      }

      // Pi
      for (x = 0; x < 5; ++x) {
        for (y = 0; y < 5; ++y) {
          state[index(y, (2 * x + 3 * y) % 5)] = tempA[index(x, y)];
        }
      }

      // Chi
      for (y = 0; y < 5; ++y) {
        for (x = 0; x < 5; ++x) {
          tempA[x] = OpCodes.AndN(OpCodes.XorN(state[index(x, y)], OpCodes.AndN(~state[index((x + 1) % 5, y)], state[index((x + 2) % 5, y)])), 0xFF);
        }
        for (x = 0; x < 5; ++x) {
          state[index(x, y)] = tempA[x];
        }
      }

      // Iota
      state[0] = OpCodes.XorN(state[0], RC[round]);
    }
  }

  // ===== LFSR FUNCTIONS =====

  /**
   * Dumbo LFSR: feedback polynomial for 160-bit mask
   * Complete LFSR operation: shift left + compute feedback byte
   * newByte = rotL3(mask[0]) XOR (mask[3] left-shift 7) XOR (mask[13] right-shift 7)
   */
  function dumboLFSR(output, input) {
    var temp = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.RotL8(input[0], 3), OpCodes.Shl32(input[3], 7)), OpCodes.Shr32(input[13], 7)), 0xFF);
    for (var i = 0; i < 19; ++i) {
      output[i] = input[i + 1];
    }
    output[19] = temp;
  }

  /**
   * Jumbo LFSR: feedback polynomial for 176-bit mask
   * Complete LFSR operation: shift left + compute feedback byte
   * newByte = rotL1(mask[0]) XOR (mask[3] left-shift 7) XOR (mask[19] right-shift 7)
   */
  function jumboLFSR(output, input) {
    var temp = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.RotL8(input[0], 1), OpCodes.Shl32(input[3], 7)), OpCodes.Shr32(input[19], 7)), 0xFF);
    for (var i = 0; i < 21; ++i) {
      output[i] = input[i + 1];
    }
    output[21] = temp;
  }

  /**
   * Delirium LFSR: feedback polynomial for 200-bit mask
   * Complete LFSR operation: shift left + compute feedback byte
   * newByte = rotL1(mask[0]) XOR rotL1(mask[2]) XOR (mask[13] left-shift 1)
   */
  function deliriumLFSR(output, input) {
    var temp = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(OpCodes.RotL8(input[0], 1), OpCodes.RotL8(input[2], 1)), OpCodes.Shl32(input[13], 1)), 0xFF);
    for (var i = 0; i < 24; ++i) {
      output[i] = input[i + 1];
    }
    output[24] = temp;
  }

  // ===== ELEPHANT V2 INSTANCE (Protected Counter Sum) =====

  /**
   * Elephant v2 AEAD Instance
   * Implements Protected Counter Sum MAC mode as per NIST LWC Round 3
   * Based on Bouncy Castle ElephantEngine reference implementation
   */
  class ElephantInstance extends IAeadInstance {
    constructor(algorithm, variant) {
      super(algorithm);
      this.variant = variant;
      this._key = null;
      this._nonce = null;
      this._associatedData = [];
      this.inputBuffer = [];
      this.nbIts = 0;
      this.adOff = 0;
      this.aadState = 'INIT';

      // Variant-specific configuration
      if (variant === 'dumbo') {
        this.blockSize = 20;
        this.macSize = 8;
        this.permute = spongent160Permute;
        this.lfsrStep = dumboLFSR;
      } else if (variant === 'jumbo') {
        this.blockSize = 22;
        this.macSize = 8;
        this.permute = spongent176Permute;
        this.lfsrStep = jumboLFSR;
      } else if (variant === 'delirium') {
        this.blockSize = 25;
        this.macSize = 16;
        this.permute = keccakP200Permute;
        this.lfsrStep = deliriumLFSR;
      }

      // v2 three-mask system for protected counter sum
      this.previousMask = new Array(this.blockSize);
      this.currentMask = new Array(this.blockSize);
      this.nextMask = new Array(this.blockSize);
      this.buffer = new Array(this.blockSize);
      this.tagBuffer = new Array(this.blockSize);
      this.previousOutputMessage = new Array(this.blockSize);
      this.expandedKey = new Array(this.blockSize);

      // Initialize arrays to zero
      for (var i = 0; i < this.blockSize; ++i) {
        this.previousMask[i] = 0;
        this.currentMask[i] = 0;
        this.nextMask[i] = 0;
        this.buffer[i] = 0;
        this.tagBuffer[i] = 0;
        this.previousOutputMessage[i] = 0;
        this.expandedKey[i] = 0;
      }
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      if (!Array.isArray(keyBytes) || keyBytes.length !== 16) {
        throw new Error('Invalid key size: ' + (keyBytes ? keyBytes.length : 0) + ' bytes (expected 16)');
      }
      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }
      if (!Array.isArray(nonceBytes) || nonceBytes.length !== 12) {
        throw new Error('Invalid nonce size: ' + (nonceBytes ? nonceBytes.length : 0) + ' bytes (expected 12)');
      }
      this._nonce = [...nonceBytes];
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    set associatedData(adBytes) {
      this._associatedData = adBytes ? [...adBytes] : [];
    }

    get associatedData() {
      return [...this._associatedData];
    }

    /**
     * Helper: XOR two arrays into a third array
     * z[i] XOR-equals x[i] XOR y[i]
     */
    xorTo(len, x, y, z) {
      for (var i = 0; i < len; ++i) {
        z[i] = OpCodes.AndN(OpCodes.XorN(OpCodes.XorN(z[i], x[i]), y[i]), 0xFF);
      }
    }

    /**
     * Helper: XOR array into destination
     * dest[i] ^= src[i]
     */
    xorArray(len, src, dest) {
      for (var i = 0; i < len; ++i) {
        dest[i] = OpCodes.AndN(OpCodes.XorN(dest[i], src[i]), 0xFF);
      }
    }

    /**
     * LFSR step: compute next_mask from current_mask
     * Uses variant-specific feedback polynomial
     * The LFSR function performs complete operation (shift + feedback)
     */
    lfsrStepMask() {
      // The LFSR function does the complete operation
      this.lfsrStep(this.nextMask, this.currentMask);
    }

    /**
     * Swap mask buffers (cyclically shift)
     * previous <- current <- next <- previous
     */
    swapMasks() {
      var temp = this.previousMask;
      this.previousMask = this.currentMask;
      this.currentMask = this.nextMask;
      this.nextMask = temp;
    }

    /**
     * Compute cipher block (v2 algorithm)
     * buffer = nonce || 0...
     * buffer ^= (current_mask XOR next_mask)
     * buffer = permute(buffer)
     * buffer ^= (current_mask XOR next_mask)
     * buffer ^= input
     */
    computeCipherBlock(input, inOff, blockSize, output, outOff) {
      // Initialize buffer with nonce
      for (var i = 0; i < 12; ++i) {
        this.buffer[i] = this._nonce[i];
      }
      for (var i = 12; i < this.blockSize; ++i) {
        this.buffer[i] = 0;
      }

      // buffer ^= (current_mask XOR next_mask)
      this.xorTo(this.blockSize, this.currentMask, this.nextMask, this.buffer);

      // Permute
      this.permute(this.buffer);

      // buffer ^= (current_mask XOR next_mask)
      this.xorTo(this.blockSize, this.currentMask, this.nextMask, this.buffer);

      // buffer ^= input
      for (var i = 0; i < blockSize; ++i) {
        this.buffer[i] = OpCodes.AndN(OpCodes.XorN(this.buffer[i], OpCodes.AndN(input[inOff + i], 0xFF)), 0xFF);
      }

      // Copy to output
      for (var i = 0; i < blockSize; ++i) {
        output[outOff + i] = this.buffer[i];
      }
    }

    /**
     * Process AAD bytes into buffer
     * State machine: INIT -> AAD -> DATA
     */
    processAADBytes(output) {
      var len = 0;

      // State: INIT - first call
      if (this.aadState === 'INIT') {
        // Initialize current_mask from expanded key
        for (var i = 0; i < this.blockSize; ++i) {
          this.currentMask[i] = this.expandedKey[i];
        }
        // Copy nonce to output
        for (var i = 0; i < 12; ++i) {
          output[i] = this._nonce[i];
        }
        len = 12;
        this.aadState = 'AAD';
      } else if (this.aadState === 'AAD') {
        // State: AAD - processing associated data
        // If adlen is divisible by blockSize, add padding block
        if (this.adOff === this._associatedData.length) {
          for (var i = 0; i < this.blockSize; ++i) {
            output[i] = 0;
          }
          output[0] = 0x01;
          return;
        }
      }

      var rOutlen = this.blockSize - len;
      var rAdlen = this._associatedData.length - this.adOff;

      // Fill with associated data if available
      if (rOutlen <= rAdlen) {
        // Enough AD
        for (var i = 0; i < rOutlen; ++i) {
          output[len + i] = this._associatedData[this.adOff + i];
        }
        this.adOff += rOutlen;
      } else {
        // Not enough AD, need to pad
        if (rAdlen > 0) {
          for (var i = 0; i < rAdlen; ++i) {
            output[len + i] = this._associatedData[this.adOff + i];
          }
          this.adOff += rAdlen;
        }
        for (var i = len + rAdlen; i < len + rOutlen; ++i) {
          output[i] = 0;
        }
        output[len + rAdlen] = 0x01;
        this.aadState = 'DATA';
      }
    }

    /**
     * Absorb AAD block into tag
     */
    absorbAAD() {
      this.processAADBytes(this.buffer);
      this.xorArray(this.blockSize, this.nextMask, this.buffer);
      this.permute(this.buffer);
      this.xorArray(this.blockSize, this.nextMask, this.buffer);
      this.xorArray(this.blockSize, this.buffer, this.tagBuffer);
    }

    /**
     * Absorb ciphertext block into tag
     * IMPORTANT: buffer must already be filled with ciphertext block before calling!
     */
    absorbCiphertext() {
      this.xorTo(this.blockSize, this.previousMask, this.nextMask, this.buffer);
      this.permute(this.buffer);
      this.xorTo(this.blockSize, this.previousMask, this.nextMask, this.buffer);
      this.xorArray(this.blockSize, this.buffer, this.tagBuffer);
    }

    /**
     * Process complete message bytes (interleaved AD, plaintext, ciphertext)
     */
    processBytes(m, output, outOff, nbIt, nblocksM, nblocksC, mlen, nblocksAd) {
      var rv = 0;
      var outputMessage = new Array(this.blockSize);

      for (var i = this.nbIts; i < nbIt; ++i) {
        var rSize = (i === nblocksM - 1) ? mlen - i * this.blockSize : this.blockSize;

        // Compute mask for next message
        this.lfsrStepMask();

        if (i < nblocksM) {
          // Compute ciphertext block
          this.computeCipherBlock(m, rv, rSize, output, outOff);

          if (!this.isInverse) {
            // Encryption: save ciphertext
            for (var j = 0; j < rSize; ++j) {
              outputMessage[j] = this.buffer[j];
            }
          } else {
            // Decryption: save ciphertext from input
            for (var j = 0; j < rSize; ++j) {
              outputMessage[j] = m[rv + j];
            }
          }

          outOff += rSize;
          rv += rSize;
        }

        if (i > 0 && i <= nblocksC) {
          // Compute tag for ciphertext block
          var blockOffset = (i - 1) * this.blockSize;

          if (blockOffset === mlen) {
            // Add padding block
            for (var j = 1; j < this.blockSize; ++j) {
              this.buffer[j] = 0;
            }
            this.buffer[0] = 0x01;
          } else {
            var rClen = mlen - blockOffset;
            if (this.blockSize <= rClen) {
              // Enough ciphertext
              for (var j = 0; j < this.blockSize; ++j) {
                this.buffer[j] = this.previousOutputMessage[j];
              }
            } else {
              // Not enough ciphertext, pad
              if (rClen > 0) {
                for (var j = 0; j < rClen; ++j) {
                  this.buffer[j] = this.previousOutputMessage[j];
                }
                for (var j = rClen; j < this.blockSize; ++j) {
                  this.buffer[j] = 0;
                }
                this.buffer[rClen] = 0x01;
              }
            }
          }

          this.absorbCiphertext();
        }

        // Process AD if remaining
        if (i + 1 < nblocksAd) {
          this.absorbAAD();
        }

        // Cyclically shift masks
        this.swapMasks();

        for (var j = 0; j < this.blockSize; ++j) {
          this.previousOutputMessage[j] = outputMessage[j];
        }
      }

      this.nbIts = i;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error('Invalid input data - must be byte array');
      }
      if (!this._key) throw new Error('Key not set');
      if (!this._nonce) throw new Error('Nonce not set');

      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error('Key not set');
      if (!this._nonce) throw new Error('Nonce not set');

      // Initialize expanded key: expandedKey = permute(key || 0...)
      for (var i = 0; i < 16; ++i) {
        this.expandedKey[i] = this._key[i];
      }
      for (var i = 16; i < this.blockSize; ++i) {
        this.expandedKey[i] = 0;
      }
      this.permute(this.expandedKey);

      // Initialize tag buffer to zero
      for (var i = 0; i < this.blockSize; ++i) {
        this.tagBuffer[i] = 0;
      }

      // Reset iteration counter, AD offset, and state
      this.nbIts = 0;
      this.adOff = 0;
      this.aadState = 'INIT';

      var mlen = this.isInverse ? this.inputBuffer.length - this.macSize : this.inputBuffer.length;
      var nblocksC = 1 + Math.floor(mlen / this.blockSize);
      var nblocksM = (mlen % this.blockSize) !== 0 ? nblocksC : nblocksC - 1;
      var nblocksAd = 1 + Math.floor((12 + this._associatedData.length) / this.blockSize);
      var nbIt = Math.max(nblocksC + 1, nblocksAd - 1);

      // Process initial AAD block (nonce + start of AD) similar to processFinalAAD()
      // This initializes current_mask and fills tag_buffer (NOT buffer) with nonce+AD directly
      // This is NOT absorbed - it's the base that ciphertext blocks are XORed into
      if (this.aadState === 'INIT') {
        this.processAADBytes(this.tagBuffer);
      }

      var output = new Array(mlen);
      this.processBytes(this.inputBuffer, output, 0, nbIt, nblocksM, nblocksC, mlen, nblocksAd);

      // Finalize tag: tag = permute(tag XOR expandedKey) XOR expandedKey
      this.xorArray(this.blockSize, this.expandedKey, this.tagBuffer);
      this.permute(this.tagBuffer);
      this.xorArray(this.blockSize, this.expandedKey, this.tagBuffer);

      var result;
      if (!this.isInverse) {
        // Encryption: append tag
        result = new Array(mlen + this.macSize);
        for (var i = 0; i < mlen; ++i) {
          result[i] = output[i];
        }
        for (var i = 0; i < this.macSize; ++i) {
          result[mlen + i] = this.tagBuffer[i];
        }
      } else {
        // Decryption: verify tag (constant-time comparison)
        var receivedTag = this.inputBuffer.slice(mlen);
        var diff = 0;
        for (var i = 0; i < this.macSize; ++i) {
          diff = OpCodes.OrN(diff, OpCodes.XorN(this.tagBuffer[i], receivedTag[i]));
        }
        var tagMatch = (diff === 0);
        if (!tagMatch) {
          throw new Error('Authentication tag verification failed');
        }
        result = output;
      }

      this.inputBuffer = [];
      return result;
    }
  }

  // ===== ALGORITHM CLASSES =====

  /**
 * DumboAlgorithm - AEAD cipher implementation
 * @class
 * @extends {AeadAlgorithm}
 */

  class DumboAlgorithm extends AeadAlgorithm {
    constructor() {
      super();
      this.name = "Elephant-Dumbo";
      this.description = "Elephant AEAD variant using Spongent-π[160] permutation with 80 rounds. NIST Lightweight Cryptography finalist designed for constrained environments.";
      this.inventor = "Tim Beyne, Yu Long Chen, Christoph Dobraunig, Bart Mennink";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];
      this.SupportedTagSizes = [new KeySize(8, 8, 0)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("Elephant Official Site", "https://www.esat.kuleuven.be/cosic/elephant/"),
        new LinkItem("NIST LWC Finalist Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/elephant-spec-final.pdf")
      ];

      this.knownVulnerabilities = [];

      // NIST LWC test vectors
      this.tests = [
        {
          text: "NIST LWC KAT Vector #1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("6655B717736ADFF3")
        },
        {
          text: "NIST LWC KAT Vector #2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("B6925C1C8CA1058E")
        },
        {
          text: "NIST LWC KAT Vector #17 (empty PT, 16-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: [],
          expected: OpCodes.Hex8ToBytes("19361BF080366F41")
        },
        {
          text: "NIST LWC KAT Vector #529 (16-byte PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: [],
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("0867290AD29D219C4BF3BF0BD652099BA0E7FCE07C71C3EB")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      var instance = new ElephantInstance(this, 'dumbo');
      instance.isInverse = isInverse;
      return instance;
    }
  }

  /**
 * JumboAlgorithm - AEAD cipher implementation
 * @class
 * @extends {AeadAlgorithm}
 */

  class JumboAlgorithm extends AeadAlgorithm {
    constructor() {
      super();
      this.name = "Elephant-Jumbo";
      this.description = "Elephant AEAD variant using Spongent-π[176] permutation with 90 rounds. NIST Lightweight Cryptography finalist offering higher security margin.";
      this.inventor = "Tim Beyne, Yu Long Chen, Christoph Dobraunig, Bart Mennink";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];
      this.SupportedTagSizes = [new KeySize(8, 8, 0)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("Elephant Official Site", "https://www.esat.kuleuven.be/cosic/elephant/"),
        new LinkItem("NIST LWC Finalist Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/elephant-spec-final.pdf")
      ];

      this.knownVulnerabilities = [];

      this.tests = [
        {
          text: "NIST LWC KAT Vector #1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("1407EF22639E4AE1")
        },
        {
          text: "NIST LWC KAT Vector #2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("BA8C57132B2035BE")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      var instance = new ElephantInstance(this, 'jumbo');
      instance.isInverse = isInverse;
      return instance;
    }
  }

  /**
 * DeliriumAlgorithm - AEAD cipher implementation
 * @class
 * @extends {AeadAlgorithm}
 */

  class DeliriumAlgorithm extends AeadAlgorithm {
    constructor() {
      super();
      this.name = "Elephant-Delirium";
      this.description = "Elephant AEAD variant using Keccak-p[200] permutation with 18 rounds and 128-bit tag. NIST Lightweight Cryptography finalist with highest security level.";
      this.inventor = "Tim Beyne, Yu Long Chen, Christoph Dobraunig, Bart Mennink";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];
      this.SupportedTagSizes = [new KeySize(16, 16, 0)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("Elephant Official Site", "https://www.esat.kuleuven.be/cosic/elephant/"),
        new LinkItem("NIST LWC Finalist Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/elephant-spec-final.pdf")
      ];

      this.knownVulnerabilities = [];

      this.tests = [
        {
          text: "NIST LWC KAT Vector #1 (empty PT, empty AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: [],
          input: [],
          expected: OpCodes.Hex8ToBytes("48BF257607D09EBE1C0E108B91058877")
        },
        {
          text: "NIST LWC KAT Vector #2 (empty PT, 1-byte AD)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: [],
          expected: OpCodes.Hex8ToBytes("6E3705ABDC45250CEEB36E4D991B741D")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      var instance = new ElephantInstance(this, 'delirium');
      instance.isInverse = isInverse;
      return instance;
    }
  }

  // Register all three variants
  RegisterAlgorithm(new DumboAlgorithm());
  RegisterAlgorithm(new JumboAlgorithm());
  RegisterAlgorithm(new DeliriumAlgorithm());

  return {
    DumboAlgorithm: DumboAlgorithm,
    JumboAlgorithm: JumboAlgorithm,
    DeliriumAlgorithm: DeliriumAlgorithm
  };
}));
