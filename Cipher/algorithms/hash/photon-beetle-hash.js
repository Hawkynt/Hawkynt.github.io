/*
 * PhotonBeetle Hash - NIST Lightweight Cryptography Finalist
 * Professional implementation following NIST LWC specification
 * (c)2006-2025 Hawkynt
 *
 * PhotonBeetle is a lightweight authenticated encryption and hash algorithm based on the PHOTON permutation.
 * Reference: https://www.isical.ac.in/~lightweight/beetle/
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem } = AlgorithmFramework;

  // PhotonBeetle Hash constants
  const INITIAL_RATE_INBYTES = 16;
  const RATE_INBYTES = 4;
  const SQUEEZE_RATE_INBYTES = 16;
  const STATE_INBYTES = 32;
  const TAG_INBYTES = 32;
  const LAST_THREE_BITS_OFFSET = 5;
  const ROUND = 12;
  const D = 8;
  const Dq = 3;
  const Dr = 7;
  const DSquare = 64;

  // PHOTON permutation round constants
  const RC = [
     1,  0,  2,  6, 14, 15, 13,  9,
     3,  2,  0,  4, 12, 13, 15, 11,
     7,  6,  4,  0,  8,  9, 11, 15,
    14, 15, 13,  9,  1,  0,  2,  6,
    13, 12, 14, 10,  2,  3,  1,  5,
    11, 10,  8, 12,  4,  5,  7,  3,
     6,  7,  5,  1,  9,  8, 10, 14,
    12, 13, 15, 11,  3,  2,  0,  4,
     9,  8, 10, 14,  6,  7,  5,  1,
     2,  3,  1,  5, 13, 12, 14, 10,
     5,  4,  6,  2, 10, 11,  9, 13,
    10, 11,  9, 13,  5,  4,  6,  2
  ];

  // MixColumn matrix for PHOTON permutation
  const MixColMatrix = [
    [  2,  4,  2, 11,  2,  8,  5,  6 ],
    [ 12,  9,  8, 13,  7,  7,  5,  2 ],
    [  4,  4, 13, 13,  9,  4, 13,  9 ],
    [  1,  6,  5,  1, 12, 13, 15, 14 ],
    [ 15, 12,  9, 13, 14,  5, 14, 13 ],
    [  9, 14,  5, 15,  4, 12,  9,  6 ],
    [ 12,  2,  2, 10,  3,  1,  1, 14 ],
    [ 15,  1, 13, 10,  5, 10,  2,  3 ]
  ];

  // PHOTON S-box
  const sbox = [ 12, 5, 6, 11, 9, 0, 10, 13, 3, 14, 15, 8, 4, 7, 1, 2 ];

  /**
 * PhotonBeetleHash - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class PhotonBeetleHash extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "PhotonBeetle Hash";
      this.description = "Lightweight hash function based on the PHOTON permutation, finalist in NIST Lightweight Cryptography competition. Optimized for constrained environments with 256-bit output.";
      this.inventor = "Zhenzhen Bao, Avik Chakraborti, Nilanjan Datta, Jian Guo, Mridul Nandi, Thomas Peyrin, Kan Yasuda";
      this.year = 2019;
      this.category = CategoryType.HASH;
      this.subCategory = "Lightweight Hash";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [{ minSize: 32, maxSize: 32, stepSize: 1 }];

      this.documentation = [
        new LinkItem(
          "PhotonBeetle Specification",
          "https://www.isical.ac.in/~lightweight/beetle/"
        ),
        new LinkItem(
          "NIST LWC Project",
          "https://csrc.nist.gov/Projects/lightweight-cryptography"
        ),
        new LinkItem(
          "PhotonBeetle Specification (NIST)",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/photon-beetle-spec-final.pdf"
        )
      ];

      // Official NIST LWC test vectors
      this.tests = [
        {
          text: "Empty message (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("44A99882FEA033566856A27E7F0C94DC84FAC7E411B08B890A4A574E3DB75D4A")
        },
        {
          text: "Single byte 0x00 (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("F165CCD18640B9703E96F1BD9A4A4EE32DD4031E4680A1B9890891DCC63468A7")
        },
        {
          text: "Two bytes 0x0001 (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("0001"),
          expected: OpCodes.Hex8ToBytes("2EF2D38F71E77928DF37FBA337872B639F7748556C1A081821B9B8460AC68FAC")
        },
        {
          text: "Three bytes 0x000102 (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("000102"),
          expected: OpCodes.Hex8ToBytes("F9A8C467209E7B5F32DB28BDE50D5210A81A9C6AA9C1686A05C3619CBF44061D")
        },
        {
          text: "16 bytes sequential (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("AB0D1EB0315DF8AF7F7AE0AC42EAF2F52FB0FDF0904E182DCC796B6CB8D7981A")
        },
        {
          text: "17 bytes sequential (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F10"),
          expected: OpCodes.Hex8ToBytes("5A281AD7EB81FB083D05CCD21B78C4BCA938AF26F20869DA29C8F13B7389BC5F")
        },
        {
          text: "24 bytes sequential (NIST LWC)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          expected: OpCodes.Hex8ToBytes("C65D15E64477D0CA123E85D632E8444C343E00EC08934EF3A8B4E22C871BADF8")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new PhotonBeetleHashInstance(this);
    }
  }

  /**
 * PhotonBeetleHash cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class PhotonBeetleHashInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      this.state = new Array(STATE_INBYTES).fill(0);
      this.state_2d = Array.from({ length: D }, () => new Array(D).fill(0));
      this.buffer = new Array(16).fill(0);
      this.bufPos = 0;
      this.phase = 0;
      this._outputSize = TAG_INBYTES;
    }

    set outputSize(size) {
      if (size !== TAG_INBYTES) {
        throw new Error(`Invalid output size: ${size} bytes (PhotonBeetle Hash only supports 32 bytes)`);
      }
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      let inPos = 0;
      const inLen = data.length;

      // Fill buffer and process complete 16-byte blocks
      while (inPos < inLen) {
        const available = 16 - this.bufPos;
        const toCopy = Math.min(available, inLen - inPos);

        for (let i = 0; i < toCopy; ++i) {
          this.buffer[this.bufPos + i] = data[inPos + i];
        }

        this.bufPos += toCopy;
        inPos += toCopy;

        if (this.bufPos === 16) {
          this._processBuffer();
          this.bufPos = 0;
        }
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      this._finishAbsorbing();

      // Squeeze phase
      this._PHOTON_Permutation();
      const output = new Array(TAG_INBYTES);

      // First squeeze
      for (let i = 0; i < SQUEEZE_RATE_INBYTES; ++i) {
        output[i] = this.state[i];
      }

      // Second squeeze
      this._PHOTON_Permutation();
      for (let i = 0; i < TAG_INBYTES - SQUEEZE_RATE_INBYTES; ++i) {
        output[SQUEEZE_RATE_INBYTES + i] = this.state[i];
      }

      // Reset for next operation
      this.state.fill(0);
      this.buffer.fill(0);
      this.bufPos = 0;
      this.phase = 0;

      return output;
    }

    _processBuffer() {
      if (this.phase === 0) {
        // First block: copy directly to state
        for (let i = 0; i < 16; ++i) {
          this.state[i] = this.buffer[i];
        }
        this.phase = 1;
      } else {
        // Subsequent blocks: permute and XOR in 4-byte chunks
        this._PHOTON_Permutation();
        this._xorBytes(4, this.buffer, 0, this.state, 0);

        this._PHOTON_Permutation();
        this._xorBytes(4, this.buffer, 4, this.state, 0);

        this._PHOTON_Permutation();
        this._xorBytes(4, this.buffer, 8, this.state, 0);

        this._PHOTON_Permutation();
        this._xorBytes(4, this.buffer, 12, this.state, 0);

        this.phase = 2;
      }
    }

    _finishAbsorbing() {
      if (this.phase === 0) {
        // No full blocks processed
        if (this.bufPos !== 0) {
          // Copy partial buffer to state
          for (let i = 0; i < this.bufPos; ++i) {
            this.state[i] = this.buffer[i];
          }
          this.state[this.bufPos] ^= 0x01; // ozs padding
        }
        this.state[STATE_INBYTES - 1] ^= (1 << LAST_THREE_BITS_OFFSET);
      } else if (this.phase === 1 && this.bufPos === 0) {
        // Exactly one full block, no partial data
        this.state[STATE_INBYTES - 1] ^= (2 << LAST_THREE_BITS_OFFSET);
      } else {
        // Process remaining partial data in 4-byte chunks
        let pos = 0;
        const limit = this.bufPos - 4;

        while (pos <= limit) {
          this._PHOTON_Permutation();
          this._xorBytes(4, this.buffer, pos, this.state, 0);
          pos += 4;
        }

        const remaining = this.bufPos - pos;
        if (remaining !== 0) {
          this._PHOTON_Permutation();
          this._xorBytes(remaining, this.buffer, pos, this.state, 0);
          this.state[remaining] ^= 0x01; // ozs padding
          this.state[STATE_INBYTES - 1] ^= (2 << LAST_THREE_BITS_OFFSET);
        } else {
          this.state[STATE_INBYTES - 1] ^= (1 << LAST_THREE_BITS_OFFSET);
        }
      }
    }

    _xorBytes(length, src, srcPos, dest, destPos) {
      for (let i = 0; i < length; ++i) {
        dest[destPos + i] ^= src[srcPos + i];
      }
    }

    _PHOTON_Permutation() {
      // Convert byte array to 2D nibble array
      for (let i = 0; i < DSquare; ++i) {
        this.state_2d[i >> Dq][i & Dr] = ((this.state[i >> 1] & 0xFF) >>> (4 * (i & 1))) & 0xf;
      }

      // 12 rounds of PHOTON permutation
      for (let round = 0; round < ROUND; ++round) {
        // AddConstant
        const rcOff = round * D;
        for (let i = 0; i < D; ++i) {
          this.state_2d[i][0] ^= RC[rcOff + i];
        }

        // SubCells (S-box layer)
        for (let i = 0; i < D; ++i) {
          for (let j = 0; j < D; ++j) {
            this.state_2d[i][j] = sbox[this.state_2d[i][j]];
          }
        }

        // ShiftRows
        for (let i = 1; i < D; ++i) {
          const temp = new Array(D);
          for (let j = 0; j < D; ++j) {
            temp[j] = this.state_2d[i][j];
          }
          for (let j = 0; j < D; ++j) {
            this.state_2d[i][j] = temp[(j + i) % D];
          }
        }

        // MixColumnSerial
        const tempCol = new Array(D);
        for (let j = 0; j < D; ++j) {
          for (let i = 0; i < D; ++i) {
            let sum = 0;
            for (let k = 0; k < D; ++k) {
              const x = MixColMatrix[i][k];
              const b = this.state_2d[k][j];

              // GF(16) multiplication by expanding b
              sum ^= x * (b & 1);
              sum ^= x * (b & 2);
              sum ^= x * (b & 4);
              sum ^= x * (b & 8);
            }

            // Reduction modulo x^4 + x + 1
            let t0 = sum >>> 4;
            sum = (sum & 15) ^ t0 ^ (t0 << 1);

            let t1 = sum >>> 4;
            sum = (sum & 15) ^ t1 ^ (t1 << 1);

            tempCol[i] = sum & 0xf;
          }
          for (let i = 0; i < D; ++i) {
            this.state_2d[i][j] = tempCol[i];
          }
        }
      }

      // Convert 2D nibble array back to byte array
      for (let i = 0; i < DSquare; i += 2) {
        this.state[i >> 1] = ((this.state_2d[i >> Dq][i & Dr] & 0xf)) |
                             ((this.state_2d[i >> Dq][(i + 1) & Dr] & 0xf) << 4);
      }
    }
  }

  RegisterAlgorithm(new PhotonBeetleHash());
  return PhotonBeetleHash;
}));
