/*
 * Xoodyak AEAD Cipher Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * Xoodyak - NIST Lightweight Cryptography Finalist
 * Based on the Xoodoo permutation
 * Reference: BouncyCastle Java implementation and NIST LWC submission
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["../../AlgorithmFramework", "../../OpCodes"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("../../AlgorithmFramework"),
      require("../../OpCodes")
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes);
  }
})(
  (function () {
    if (typeof globalThis !== "undefined") return globalThis;
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
    if (typeof self !== "undefined") return self;
    throw new Error("Unable to locate global object");
  })(),
  function (AlgorithmFramework, OpCodes) {
    "use strict";

    if (!AlgorithmFramework) {
      throw new Error("AlgorithmFramework dependency is required");
    }

    if (!OpCodes) {
      throw new Error("OpCodes dependency is required");
    }

    const {
      RegisterAlgorithm,
      CategoryType,
      SecurityStatus,
      ComplexityType,
      CountryCode,
      AeadAlgorithm,
      IAeadInstance,
      KeySize,
      LinkItem,
    } = AlgorithmFramework;

    // Xoodoo permutation constants
    const ROUNDS = 12;
    const RC = [
      0x00000058, 0x00000038, 0x000003c0, 0x000000d0,
      0x00000120, 0x00000014, 0x00000060, 0x0000002c,
      0x00000380, 0x000000f0, 0x000001a0, 0x00000012
    ];

    const F_BPRIME = 47; // f_bPrime parameter - index into 48-byte state
    const MODE_KEYED = 0;
    const MODE_HASH = 1;
    const PHASE_UP = 2;
    const PHASE_DOWN = 1;

    // Xoodoo state: 12 x 32-bit words = 48 bytes
    const STATE_SIZE = 48;
    const RATE_SIZE = 24; // Absorb/squeeze rate
    const KEY_SIZE = 16;
    const NONCE_SIZE = 16;
    const TAG_SIZE = 16;
    const AAD_BUFFER_SIZE = 44;

    class Xoodyak extends AeadAlgorithm {
      constructor() {
        super();

        this.name = "Xoodyak";
        this.description = "Xoodyak is a lightweight cryptographic scheme based on the Xoodoo permutation, finalist in NIST's Lightweight Cryptography competition. Designed for constrained environments with authenticated encryption and hashing capabilities.";
        this.inventor = "Joan Daemen, Seth Hoffert, Michaël Peeters, Gilles Van Assche, Ronny Van Keer";
        this.year = 2018;
        this.category = CategoryType.SPECIAL;
        this.subCategory = "AEAD Cipher";
        this.securityStatus = SecurityStatus.EXPERIMENTAL;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.BE; // Belgium (main designers from STMicroelectronics and Radboud University)

        this.SupportedKeySizes = [new KeySize(KEY_SIZE, KEY_SIZE, 1)];
        this.SupportedNonceSizes = [new KeySize(NONCE_SIZE, NONCE_SIZE, 1)];
        this.SupportedTagSizes = [new KeySize(TAG_SIZE, TAG_SIZE, 1)];
        this.BlockSize = RATE_SIZE;

        this.documentation = [
          new LinkItem(
            "Xoodyak Official Specification (NIST LWC)",
            "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/xoodyak-spec-final.pdf"
          ),
          new LinkItem(
            "NIST Lightweight Cryptography Project",
            "https://www.nist.gov/programs-projects/lightweight-cryptography"
          ),
          new LinkItem(
            "Xoodoo Permutation Documentation",
            "https://keccak.team/xoodyak.html"
          ),
        ];

        this.references = [
          new LinkItem(
            "BouncyCastle Java Implementation",
            "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/XoodyakEngine.java"
          ),
          new LinkItem(
            "XKCP Reference Implementation",
            "https://github.com/XKCP/XKCP"
          ),
        ];

        // Official NIST LWC KAT test vectors
        this.tests = [
          {
            text: "NIST LWC KAT Vector #1 - Empty plaintext and AD",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            input: OpCodes.Hex8ToBytes(""),
            aad: OpCodes.Hex8ToBytes(""),
            expected: OpCodes.Hex8ToBytes("4BF0E393144CB58069FC1FEBCAFCFB3C"),
          },
          {
            text: "NIST LWC KAT Vector #2 - Empty plaintext, 1 byte AD",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            input: OpCodes.Hex8ToBytes(""),
            aad: OpCodes.Hex8ToBytes("00"),
            expected: OpCodes.Hex8ToBytes("4D2A8D1716DFE3401F3BBE8ACB637AB0"),
          },
          {
            text: "NIST LWC KAT Vector #34 - 1 byte plaintext, empty AD",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            input: OpCodes.Hex8ToBytes("00"),
            aad: OpCodes.Hex8ToBytes(""),
            expected: OpCodes.Hex8ToBytes("8172E50EACEA3E2CBF3D67DDBA8D7ACF1A"),
          },
        ];
      }

      CreateInstance(isInverse = false) {
        return new XoodyakInstance(this, isInverse);
      }
    }

    class XoodyakInstance extends IAeadInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;

        // State management
        this.state = new Array(STATE_SIZE).fill(0);
        this.phase = PHASE_UP;
        this.mode = MODE_KEYED;
        this.encrypted = false;
        this.aadcd = 0x03;

        // Buffers
        this._key = null;
        this._nonce = null;
        this._aad = [];
        this._aadPos = 0;
        this._buffer = [];
        this._bufPos = 0;

        this.KeySize = KEY_SIZE;
        this.NonceSize = NONCE_SIZE;
        this.TagSize = TAG_SIZE;
        this.BlockSize = RATE_SIZE;
      }

      set key(keyBytes) {
        if (!keyBytes) {
          this._key = null;
          return;
        }
        if (keyBytes.length !== KEY_SIZE) {
          throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${KEY_SIZE})`);
        }
        this._key = [...keyBytes];
        this.KeySize = KEY_SIZE;
      }

      get key() {
        return this._key ? [...this._key] : null;
      }

      set nonce(nonceBytes) {
        if (!nonceBytes) {
          this._nonce = null;
          return;
        }
        if (nonceBytes.length !== NONCE_SIZE) {
          throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected ${NONCE_SIZE})`);
        }
        this._nonce = [...nonceBytes];
        this.NonceSize = NONCE_SIZE;
      }

      get nonce() {
        return this._nonce ? [...this._nonce] : null;
      }

      set aad(aadBytes) {
        if (!aadBytes || aadBytes.length === 0) {
          this._aad = [];
          this._aadPos = 0;
          return;
        }
        this._aad = [...aadBytes];
        this._aadPos = aadBytes.length;
      }

      get aad() {
        return this._aad.length > 0 ? [...this._aad] : [];
      }

      Reset() {
        if (!this._key || !this._nonce) {
          this.state.fill(0);
          this.encrypted = false;
          this.phase = PHASE_UP;
          this.aadcd = 0x03;
          this._buffer = [];
          this._bufPos = 0;
          return;
        }

        // Reset state
        this.state.fill(0);
        this.encrypted = false;
        this.phase = PHASE_UP;
        this.aadcd = 0x03;
        this._buffer = [];
        this._bufPos = 0;

        // Initialize with key and nonce
        const KID = new Array(AAD_BUFFER_SIZE).fill(0);
        for (let i = 0; i < this._key.length; ++i) {
          KID[i] = this._key[i];
        }
        for (let i = 0; i < this._nonce.length; ++i) {
          KID[this._key.length + i] = this._nonce[i];
        }
        KID[this._key.length + this._nonce.length] = this._nonce.length;

        this._absorbAny(KID, 0, this._key.length + this._nonce.length + 1, 0x02);
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        if (!this._key) throw new Error("Key not set");
        if (!this._nonce) throw new Error("Nonce not set");

        this._buffer.push(...data);
        this._bufPos = this._buffer.length;
      }

      Result() {
        if (!this._key) throw new Error("Key not set");
        if (!this._nonce) throw new Error("Nonce not set");

        // Process AAD first if present
        if (this._aad.length > 0) {
          this._absorbAny(this._aad, 0, this._aadPos, this.aadcd);
          this.aadcd = 0;
        }

        const output = [];

        // Process full blocks
        let offset = 0;
        while (offset + RATE_SIZE <= this._bufPos) {
          const block = this._buffer.slice(offset, offset + RATE_SIZE);
          const processed = this.isInverse
            ? this._decryptBlock(block)
            : this._encryptBlock(block);
          output.push(...processed);
          offset += RATE_SIZE;
        }

        // Process final partial block if any
        if (offset < this._bufPos || !this.encrypted) {
          const remaining = this._buffer.slice(offset);
          const processed = this.isInverse
            ? this._decryptFinal(remaining)
            : this._encryptFinal(remaining);
          output.push(...processed);
        }

        // Generate/verify tag
        this._up(0x40);
        const tag = this.state.slice(0, TAG_SIZE);

        if (this.isInverse) {
          // Verification mode: check tag matches
          if (output.length < TAG_SIZE) {
            throw new Error("Ciphertext too short for tag");
          }
          const expectedTag = output.splice(output.length - TAG_SIZE, TAG_SIZE);
          let tagMatch = true;
          for (let i = 0; i < TAG_SIZE; ++i) {
            if (tag[i] !== expectedTag[i]) tagMatch = false;
          }
          if (!tagMatch) {
            throw new Error("Authentication tag verification failed");
          }
        } else {
          // Encryption mode: append tag
          output.push(...tag);
        }

        this.phase = PHASE_UP;

        // Clear buffers for next operation
        this._buffer = [];
        this._bufPos = 0;
        this._aad = [];
        this._aadPos = 0;

        return output;
      }

      _encryptBlock(block) {
        this._up(this.encrypted ? 0 : 0x80);
        const output = OpCodes.XorArrays(this.state.slice(0, RATE_SIZE), block);
        this._down(block, 0, RATE_SIZE, 0x00);
        this.phase = PHASE_DOWN;
        this.encrypted = true;
        return output;
      }

      _decryptBlock(block) {
        this._up(this.encrypted ? 0 : 0x80);
        const output = OpCodes.XorArrays(this.state.slice(0, RATE_SIZE), block);
        this._down(output, 0, RATE_SIZE, 0x00);
        this.phase = PHASE_DOWN;
        this.encrypted = true;
        return output;
      }

      _encryptFinal(block) {
        this._up(this.encrypted ? 0 : 0x80);
        const output = OpCodes.XorArrays(this.state.slice(0, block.length), block);
        this._down(block, 0, block.length, 0x00);
        this.phase = PHASE_DOWN;
        return output;
      }

      _decryptFinal(block) {
        this._up(this.encrypted ? 0 : 0x80);
        const output = OpCodes.XorArrays(this.state.slice(0, block.length), block);
        this._down(output, 0, block.length, 0x00);
        this.phase = PHASE_DOWN;
        return output;
      }

      _absorbAny(X, Xoff, XLen, Cd) {
        if (this.phase !== PHASE_UP) {
          this._up(0);
        }

        while (XLen > 0) {
          const splitLen = Math.min(XLen, AAD_BUFFER_SIZE);
          this._down(X, Xoff, splitLen, Cd);
          this.phase = PHASE_DOWN;
          Cd = 0;
          Xoff += splitLen;
          XLen -= splitLen;
        }
      }

      _up(Cu) {
        if (this.mode !== MODE_HASH) {
          this.state[F_BPRIME] ^= Cu;
        }

        // Load state as 12 x 32-bit words
        const a = new Array(12);
        for (let i = 0; i < 12; ++i) {
          a[i] = OpCodes.Pack32LE(
            this.state[i * 4],
            this.state[i * 4 + 1],
            this.state[i * 4 + 2],
            this.state[i * 4 + 3]
          );
        }

        // 12 rounds of Xoodoo permutation
        for (let round = 0; round < ROUNDS; ++round) {
          // Theta: Column Parity Mixer
          const p0 = a[0] ^ a[4] ^ a[8];
          const p1 = a[1] ^ a[5] ^ a[9];
          const p2 = a[2] ^ a[6] ^ a[10];
          const p3 = a[3] ^ a[7] ^ a[11];

          const e0 = OpCodes.RotL32(p3, 5) ^ OpCodes.RotL32(p3, 14);
          const e1 = OpCodes.RotL32(p0, 5) ^ OpCodes.RotL32(p0, 14);
          const e2 = OpCodes.RotL32(p1, 5) ^ OpCodes.RotL32(p1, 14);
          const e3 = OpCodes.RotL32(p2, 5) ^ OpCodes.RotL32(p2, 14);

          a[0] ^= e0; a[4] ^= e0; a[8] ^= e0;
          a[1] ^= e1; a[5] ^= e1; a[9] ^= e1;
          a[2] ^= e2; a[6] ^= e2; a[10] ^= e2;
          a[3] ^= e3; a[7] ^= e3; a[11] ^= e3;

          // Rho-west: plane shift
          const b = [...a];
          a[4] = b[7];
          a[5] = b[4];
          a[6] = b[5];
          a[7] = b[6];
          a[8] = OpCodes.RotL32(b[8], 11);
          a[9] = OpCodes.RotL32(b[9], 11);
          a[10] = OpCodes.RotL32(b[10], 11);
          a[11] = OpCodes.RotL32(b[11], 11);

          // Iota: round constant
          a[0] ^= RC[round];

          // Chi: non-linear layer
          const c0 = a[0] ^ (~a[4] & a[8]);
          const c1 = a[1] ^ (~a[5] & a[9]);
          const c2 = a[2] ^ (~a[6] & a[10]);
          const c3 = a[3] ^ (~a[7] & a[11]);
          const c4 = a[4] ^ (~a[8] & a[0]);
          const c5 = a[5] ^ (~a[9] & a[1]);
          const c6 = a[6] ^ (~a[10] & a[2]);
          const c7 = a[7] ^ (~a[11] & a[3]);
          const c8 = a[8] ^ (~a[0] & a[4]);
          const c9 = a[9] ^ (~a[1] & a[5]);
          const c10 = a[10] ^ (~a[2] & a[6]);
          const c11 = a[11] ^ (~a[3] & a[7]);

          // Rho-east: plane shift
          a[0] = c0;
          a[1] = c1;
          a[2] = c2;
          a[3] = c3;
          a[4] = OpCodes.RotL32(c4, 1);
          a[5] = OpCodes.RotL32(c5, 1);
          a[6] = OpCodes.RotL32(c6, 1);
          a[7] = OpCodes.RotL32(c7, 1);
          a[8] = OpCodes.RotL32(c10, 8);
          a[9] = OpCodes.RotL32(c11, 8);
          a[10] = OpCodes.RotL32(c8, 8);
          a[11] = OpCodes.RotL32(c9, 8);
        }

        // Store state back
        for (let i = 0; i < 12; ++i) {
          const bytes = OpCodes.Unpack32LE(a[i]);
          this.state[i * 4] = bytes[0];
          this.state[i * 4 + 1] = bytes[1];
          this.state[i * 4 + 2] = bytes[2];
          this.state[i * 4 + 3] = bytes[3];
        }
      }

      _down(Xi, XiOff, XiLen, Cd) {
        // XOR input into state
        for (let i = 0; i < XiLen; ++i) {
          this.state[i] ^= Xi[XiOff + i];
        }
        this.state[XiLen] ^= 0x01;
        this.state[F_BPRIME] ^= (this.mode === MODE_HASH) ? (Cd & 0x01) : Cd;
      }
    }

    // Register algorithm
    RegisterAlgorithm(new Xoodyak());

    return Xoodyak;
  }
);
