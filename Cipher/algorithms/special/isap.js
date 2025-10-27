/*
 * ISAP AEAD Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * ISAP - NIST Lightweight Cryptography Finalist
 * Based on Ascon permutation with re-keying for side-channel resistance
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

    // ISAP-A-128 parameters
    const KEY_SIZE = 16;
    const NONCE_SIZE = 16;
    const TAG_SIZE = 16;
    const ISAP_RH = 64; // Rate for hashing (64 bits = 8 bytes)
    const BLOCK_SIZE = 8;

    // ISAP-A-128 initialization vectors (from BouncyCastle)
    // Format: [variant(1), flags(1-3), sH(1), sB(1), sE(1), sK(1)]
    // For ISAP-A-128: sH=12, sB=12, sE=12, sK=12 (0x0c each)
    const ISAP_IV1 = 0x01804001_0C0C0C0Cn; // For MAC
    const ISAP_IV2 = 0x02804001_0C0C0C0Cn; // For re-keying
    const ISAP_IV3 = 0x03804001_0C0C0C0Cn; // For encryption

    class ISAP extends AeadAlgorithm {
      constructor() {
        super();

        this.name = "ISAP-A-128";
        this.description = "ISAP is a lightweight authenticated encryption algorithm designed for resistance against side-channel and fault attacks, finalist in NIST's Lightweight Cryptography competition. Based on the Ascon permutation.";
        this.inventor = "Christoph Dobraunig, Maria Eichlseder, Stefan Mangard, Florian Mendel, Robert Primas, Thomas Unterluggauer";
        this.year = 2017;
        this.category = CategoryType.SPECIAL;
        this.subCategory = "AEAD Cipher";
        this.securityStatus = SecurityStatus.EXPERIMENTAL;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.AT; // Austria

        this.SupportedKeySizes = [new KeySize(KEY_SIZE, KEY_SIZE, 1)];
        this.SupportedNonceSizes = [new KeySize(NONCE_SIZE, NONCE_SIZE, 1)];
        this.SupportedTagSizes = [new KeySize(TAG_SIZE, TAG_SIZE, 1)];
        this.BlockSize = BLOCK_SIZE;

        this.documentation = [
          new LinkItem(
            "ISAP Official Specification (NIST LWC)",
            "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/isap-spec-final.pdf"
          ),
          new LinkItem(
            "NIST Lightweight Cryptography Project",
            "https://www.nist.gov/programs-projects/lightweight-cryptography"
          ),
          new LinkItem(
            "ISAP Official Website",
            "https://isap.iaik.tugraz.at/"
          ),
        ];

        this.references = [
          new LinkItem(
            "BouncyCastle Java Implementation",
            "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/ISAPEngine.java"
          ),
          new LinkItem(
            "ISAP Reference Implementation",
            "https://github.com/isap-lwc/isap-code-package"
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
            expected: OpCodes.Hex8ToBytes("79A08D4D8B9F23D3699CBB91174DD67B"),
          },
          {
            text: "NIST LWC KAT Vector #2 - Empty plaintext, 1 byte AD",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            input: OpCodes.Hex8ToBytes(""),
            aad: OpCodes.Hex8ToBytes("00"),
            expected: OpCodes.Hex8ToBytes("1C08E1C57809657AE74AB46A0C788990"),
          },
        ];
      }

      CreateInstance(isInverse = false) {
        return new ISAPInstance(this, isInverse);
      }
    }

    class ISAPInstance extends IAeadInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;

        // 64-bit mask for BigInt operations
        this.MASK64 = 0xFFFFFFFFFFFFFFFFn;

        // Ascon state (5 x 64-bit words = 40 bytes)
        this.pState = [0n, 0n, 0n, 0n, 0n];
        this.macState = [0n, 0n, 0n, 0n, 0n];

        this._key = null;
        this._nonce = null;
        this._aad = [];
        this._aadPos = 0;
        this._buffer = [];
        this._bufPos = 0;

        this.KeySize = KEY_SIZE;
        this.NonceSize = NONCE_SIZE;
        this.TagSize = TAG_SIZE;
        this.BlockSize = BLOCK_SIZE;
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
          this.pState = [0n, 0n, 0n, 0n, 0n];
          this.macState = [0n, 0n, 0n, 0n, 0n];
          this._buffer = [];
          this._bufPos = 0;
          return;
        }

        // Convert key and nonce to 64-bit words
        const k0 = this._bytesToU64BE(this._key, 0);
        const k1 = this._bytesToU64BE(this._key, 8);
        const npub0 = this._bytesToU64BE(this._nonce, 0);
        const npub1 = this._bytesToU64BE(this._nonce, 8);

        // Initialize encryption state with re-keying
        this._isapRK(this.pState, ISAP_IV3, this._nonce, NONCE_SIZE, k0, k1);
        this.pState[3] = npub0;
        this.pState[4] = npub1;
        this._asconP(this.pState, 12, 1); // sB=12, sE=1 for ISAP-A-128

        // Initialize MAC state
        this.macState[0] = npub0;
        this.macState[1] = npub1;
        this.macState[2] = ISAP_IV1;
        this.macState[3] = 0n;
        this.macState[4] = 0n;
        this._asconP(this.macState, 12, 0);

        this._buffer = [];
        this._bufPos = 0;
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

        const output = [];

        // Process AAD for MAC
        if (this._aadPos > 0) {
          this._processAAD();
        }

        // Encrypt/decrypt data
        const msgLen = this.isInverse ? this._bufPos - TAG_SIZE : this._bufPos;

        let offset = 0;
        while (offset + BLOCK_SIZE <= msgLen) {
          const block = this._buffer.slice(offset, offset + BLOCK_SIZE);
          const word = this._bytesToU64BE(block, 0);
          const outWord = word ^ this.pState[0];
          output.push(...this._u64ToBytesBE(outWord)); // BIG-endian for full blocks!
          this._asconP(this.pState, 12, 1); // sB=12, sE=1
          offset += BLOCK_SIZE;
        }

        // Final partial block
        if (offset < msgLen) {
          const remaining = this._buffer.slice(offset, msgLen);
          const partialOut = this._u64ToBytesLE(this.pState[0]);
          for (let i = 0; i < remaining.length; ++i) {
            output.push(partialOut[i] ^ remaining[i]);
          }
        }

        // Compute/verify MAC
        const tag = this._computeMAC(msgLen);

        if (this.isInverse) {
          // Verify tag
          const expectedTag = this._buffer.slice(msgLen, msgLen + TAG_SIZE);
          let tagMatch = true;
          for (let i = 0; i < TAG_SIZE; ++i) {
            if (tag[i] !== expectedTag[i]) tagMatch = false;
          }
          if (!tagMatch) {
            throw new Error("Authentication tag verification failed");
          }
        } else {
          // Append tag
          output.push(...tag);
        }

        // Clear buffers
        this._buffer = [];
        this._bufPos = 0;
        this._aad = [];
        this._aadPos = 0;

        return output;
      }

      _processAAD() {
        let offset = 0;
        while (offset + BLOCK_SIZE <= this._aadPos) {
          const block = this._aad.slice(offset, offset + BLOCK_SIZE);
          this.macState[0] = (this.macState[0] ^ this._bytesToU64BE(block, 0)) & this.MASK64;
          this._asconP(this.macState, 12, 0);
          offset += BLOCK_SIZE;
        }

        // Final AAD block
        if (offset < this._aadPos) {
          for (let i = 0; i < this._aadPos - offset; ++i) {
            const shift = BigInt((7 - i) * 8);
            this.macState[0] = (this.macState[0] ^ (BigInt(this._aad[offset + i]) << shift)) & this.MASK64;
          }
          const shift = BigInt((7 - (this._aadPos - offset)) * 8);
          this.macState[0] = (this.macState[0] ^ (0x80n << shift)) & this.MASK64;
        }
        this._asconP(this.macState, 12, 0);
        this.macState[4] = (this.macState[4] ^ 1n) & this.MASK64;
      }

      _computeMAC(msgLen) {
        // Absorb message into MAC state
        let offset = 0;
        const message = this.isInverse
          ? this._buffer.slice(0, msgLen)
          : this._buffer.slice(0, msgLen);

        while (offset + BLOCK_SIZE <= msgLen) {
          const block = message.slice(offset, offset + BLOCK_SIZE);
          this.macState[0] = (this.macState[0] ^ this._bytesToU64BE(block, 0)) & this.MASK64;
          this._asconP(this.macState, 12, 0);
          offset += BLOCK_SIZE;
        }

        // Final message block
        if (offset < msgLen) {
          for (let i = 0; i < msgLen - offset; ++i) {
            const shift = BigInt((7 - i) * 8);
            this.macState[0] = (this.macState[0] ^ (BigInt(message[offset + i]) << shift)) & this.MASK64;
          }
          const shift = BigInt((7 - (msgLen - offset)) * 8);
          this.macState[0] = (this.macState[0] ^ (0x80n << shift)) & this.MASK64;
        }
        this._asconP(this.macState, 12, 0);

        // Re-key and finalize
        const tag = new Array(TAG_SIZE);
        const tmp = [...this.macState];
        const tagBytes = [...this._u64ToBytesBE(this.macState[0]), ...this._u64ToBytesBE(this.macState[1])];

        const k0 = this._bytesToU64BE(this._key, 0);
        const k1 = this._bytesToU64BE(this._key, 8);
        this._isapRK(this.macState, ISAP_IV2, tagBytes, TAG_SIZE, k0, k1);

        this.macState[2] = tmp[2];
        this.macState[3] = tmp[3];
        this.macState[4] = tmp[4];

        this._asconP(this.macState, 12, 0);

        const tag0 = this._u64ToBytesBE(this.macState[0]);
        const tag1 = this._u64ToBytesBE(this.macState[1]);

        return [...tag0, ...tag1];
      }

      _isapRK(state, iv, Y, ylen, k0, k1) {
        // Initialize state
        state[0] = k0;
        state[1] = k1;
        state[2] = iv;
        state[3] = 0n;
        state[4] = 0n;
        this._asconP(state, 12, 0);

        // Absorb Y bit-by-bit
        for (let i = 0; i < (ylen * 8) - 1; ++i) {
          const bitPos = i & 7;
          const bytePos = i >>> 3;
          const bit = (Y[bytePos] >>> (7 - bitPos)) & 0x01;
          state[0] = (state[0] ^ (BigInt(bit) << 63n)) & this.MASK64;
          this._asconP(state, 1, 0); // sB=1, sE=0 for ISAP-A-128
        }
        const lastBit = Y[ylen - 1] & 0x01;
        state[0] = (state[0] ^ (BigInt(lastBit) << 63n)) & this.MASK64;
        this._asconP(state, 12, 0);
      }

      _asconP(state, sB, sE) {
        // Ascon permutation with sB rounds
        const rounds = sB;
        const startRound = 12 - rounds;
        for (let i = 0; i < rounds; ++i) {
          const roundNum = startRound + i;
          // Add round constant to x2 low byte: ((0xF - roundNum) << 4) | roundNum
          const constant = BigInt(((0xF - roundNum) << 4) | roundNum);
          state[2] = (state[2] ^ constant) & this.MASK64;

          // Substitution layer
          state[0] = (state[0] ^ state[4]) & this.MASK64;
          state[4] = (state[4] ^ state[3]) & this.MASK64;
          state[2] = (state[2] ^ state[1]) & this.MASK64;
          const t0 = state[0];
          const t1 = state[1];
          const t2 = state[2];
          const t3 = state[3];
          const t4 = state[4];
          state[0] = (t0 ^ (~t1 & t2)) & this.MASK64;
          state[1] = (t1 ^ (~t2 & t3)) & this.MASK64;
          state[2] = (t2 ^ (~t3 & t4)) & this.MASK64;
          state[3] = (t3 ^ (~t4 & t0)) & this.MASK64;
          state[4] = (t4 ^ (~t0 & t1)) & this.MASK64;
          state[1] = (state[1] ^ state[0]) & this.MASK64;
          state[0] = (state[0] ^ state[4]) & this.MASK64;
          state[3] = (state[3] ^ state[2]) & this.MASK64;
          state[2] = (~state[2]) & this.MASK64;

          // Linear diffusion layer (must operate on current state values)
          const l0 = state[0];
          const l1 = state[1];
          const l2 = state[2];
          const l3 = state[3];
          const l4 = state[4];
          state[0] = (l0 ^ this._rotr64(l0, 19) ^ this._rotr64(l0, 28)) & this.MASK64;
          state[1] = (l1 ^ this._rotr64(l1, 61) ^ this._rotr64(l1, 39)) & this.MASK64;
          state[2] = (l2 ^ this._rotr64(l2, 1) ^ this._rotr64(l2, 6)) & this.MASK64;
          state[3] = (l3 ^ this._rotr64(l3, 10) ^ this._rotr64(l3, 17)) & this.MASK64;
          state[4] = (l4 ^ this._rotr64(l4, 7) ^ this._rotr64(l4, 41)) & this.MASK64;
        }
      }

      _rotr64(value, positions) {
        const mask = 0xFFFFFFFFFFFFFFFFn;
        return ((value >> BigInt(positions)) | (value << BigInt(64 - positions))) & mask;
      }

      _bytesToU64BE(bytes, offset) {
        let result = 0n;
        for (let i = 0; i < 8; ++i) {
          result = (result << 8n) | BigInt(bytes[offset + i] || 0);
        }
        return result;
      }

      _u64ToBytesBE(value) {
        const bytes = new Array(8);
        for (let i = 7; i >= 0; --i) {
          bytes[i] = Number(value & 0xFFn);
          value >>= 8n;
        }
        return bytes;
      }

      _u64ToBytesLE(value) {
        const bytes = new Array(8);
        for (let i = 0; i < 8; ++i) {
          bytes[i] = Number(value & 0xFFn);
          value >>= 8n;
        }
        return bytes;
      }
    }

    // Register algorithm
    RegisterAlgorithm(new ISAP());

    return ISAP;
  }
);
