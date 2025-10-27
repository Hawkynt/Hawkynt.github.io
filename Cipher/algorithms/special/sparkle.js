/*
 * Sparkle SCHWAEMM AEAD Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * Sparkle - NIST Lightweight Cryptography Finalist
 * SCHWAEMM authenticated encryption variants based on Sparkle permutation
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

    // Sparkle round constants
    const RCON = [
      0xB7E15162, 0xBF715880, 0x38B4DA56, 0x324E7738,
      0xBB1185EB, 0x4F7C7B57, 0xCFBFA1C8, 0xC2B3293D
    ];

    // SCHWAEMM128-128 parameters
    const KEY_SIZE = 16;      // 128 bits
    const NONCE_SIZE = 16;    // 128 bits
    const TAG_SIZE = 16;      // 128 bits
    const STATE_WORDS = 8;    // 256-bit state = 8 x 32-bit words
    const RATE_WORDS = 4;     // 128-bit rate = 4 x 32-bit words
    const KEY_WORDS = 4;      // 128-bit key = 4 x 32-bit words
    const TAG_WORDS = 4;      // 128-bit tag = 4 x 32-bit words
    const BLOCK_SIZE = 16;    // 16 bytes
    const SPARKLE_STEPS_SLIM = 7;
    const SPARKLE_STEPS_BIG = 10;
    const CAP_MASK = -1;      // For SCHWAEMM128-128, no masking needed

    // Domain separation constants
    const CAP_BRANS = 2;      // 128-bit capacity = 2 branches
    const _A0 = (1 << CAP_BRANS) << 24;
    const _A1 = ((1 ^ (1 << CAP_BRANS)) << 24);
    const _M2 = ((2 ^ (1 << CAP_BRANS)) << 24);
    const _M3 = ((3 ^ (1 << CAP_BRANS)) << 24);

    class Sparkle extends AeadAlgorithm {
      constructor() {
        super();

        this.name = "Sparkle SCHWAEMM128-128";
        this.description = "Sparkle is a lightweight cryptographic permutation suite, finalist in NIST's Lightweight Cryptography competition. SCHWAEMM128-128 provides authenticated encryption with 128-bit security.";
        this.inventor = "Christof Beierle, Alex Biryukov, Luan Cardoso dos Santos, Johann Großschädl, Léo Perrin, Aleksei Udovenko, Vesselin Velichkov, Qingju Wang";
        this.year = 2019;
        this.category = CategoryType.SPECIAL;
        this.subCategory = "AEAD Cipher";
        this.securityStatus = SecurityStatus.EXPERIMENTAL;
        this.complexity = ComplexityType.INTERMEDIATE;
        this.country = CountryCode.INTL; // International team

        this.SupportedKeySizes = [new KeySize(KEY_SIZE, KEY_SIZE, 1)];
        this.SupportedNonceSizes = [new KeySize(NONCE_SIZE, NONCE_SIZE, 1)];
        this.SupportedTagSizes = [new KeySize(TAG_SIZE, TAG_SIZE, 1)];
        this.BlockSize = BLOCK_SIZE;

        this.documentation = [
          new LinkItem(
            "Sparkle Official Specification (NIST LWC)",
            "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf"
          ),
          new LinkItem(
            "NIST Lightweight Cryptography Project",
            "https://www.nist.gov/programs-projects/lightweight-cryptography"
          ),
          new LinkItem(
            "Sparkle Official Website",
            "https://sparkle-lwc.github.io/"
          ),
        ];

        this.references = [
          new LinkItem(
            "BouncyCastle Java Implementation",
            "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/SparkleEngine.java"
          ),
          new LinkItem(
            "Sparkle Reference Implementation",
            "https://github.com/cryptolu/sparkle"
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
            expected: OpCodes.Hex8ToBytes("DDCE77CDB748E6D053CAB7E9190A8349"),
          },
          {
            text: "NIST LWC KAT Vector #2 - Empty plaintext, 1 byte AD",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            input: OpCodes.Hex8ToBytes(""),
            aad: OpCodes.Hex8ToBytes("00"),
            expected: OpCodes.Hex8ToBytes("D2A4133E82B64F800B6DAB2403FB094D"),
          },
          {
            text: "NIST LWC KAT Vector #34 - 1 byte plaintext, empty AD",
            uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
            key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
            input: OpCodes.Hex8ToBytes("00"),
            aad: OpCodes.Hex8ToBytes(""),
            expected: OpCodes.Hex8ToBytes("C82F4C62C1F58DFED3AB14C200EBBFF2F9"),
          },
        ];
      }

      CreateInstance(isInverse = false) {
        return new SparkleInstance(this, isInverse);
      }
    }

    class SparkleInstance extends IAeadInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;

        // State management
        this.state = new Array(STATE_WORDS).fill(0);
        this.k = new Array(KEY_WORDS).fill(0);
        this.npub = new Array(RATE_WORDS).fill(0);
        this.encrypted = false;
        this.initialized = false;

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
        this.BlockSize = BLOCK_SIZE;
      }

      set key(keyBytes) {
        if (!keyBytes) {
          this._key = null;
          this.initialized = false;
          return;
        }
        if (keyBytes.length !== KEY_SIZE) {
          throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${KEY_SIZE})`);
        }
        this._key = [...keyBytes];
        // Pack key into 32-bit words (little-endian)
        for (let i = 0; i < KEY_WORDS; ++i) {
          this.k[i] = OpCodes.Pack32LE(
            keyBytes[i * 4],
            keyBytes[i * 4 + 1],
            keyBytes[i * 4 + 2],
            keyBytes[i * 4 + 3]
          );
        }
        this.KeySize = KEY_SIZE;
        this.initialized = false;
      }

      get key() {
        return this._key ? [...this._key] : null;
      }

      set nonce(nonceBytes) {
        if (!nonceBytes) {
          this._nonce = null;
          this.initialized = false;
          return;
        }
        if (nonceBytes.length !== NONCE_SIZE) {
          throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected ${NONCE_SIZE})`);
        }
        this._nonce = [...nonceBytes];
        // Pack nonce into 32-bit words (little-endian)
        for (let i = 0; i < RATE_WORDS; ++i) {
          this.npub[i] = OpCodes.Pack32LE(
            nonceBytes[i * 4],
            nonceBytes[i * 4 + 1],
            nonceBytes[i * 4 + 2],
            nonceBytes[i * 4 + 3]
          );
        }
        this.NonceSize = NONCE_SIZE;
        this.initialized = false;
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
          this._buffer = [];
          this._bufPos = 0;
          return;
        }

        // Initialize: load nonce into rate-part, key into capacity-part
        for (let i = 0; i < RATE_WORDS; ++i) {
          this.state[i] = this.npub[i];
        }
        for (let i = 0; i < KEY_WORDS; ++i) {
          this.state[RATE_WORDS + i] = this.k[i];
        }

        // Debug
        if (typeof process !== 'undefined' && process.env.DEBUG_SPARKLE) {
          const toHex = (w) => w.toString(16).padStart(8,'0').toUpperCase();
          console.log('Nonce (npub):', this.npub.map(toHex).join(' '));
          console.log('Key (k):', this.k.map(toHex).join(' '));
          console.log('Initial state (before Sparkle(BIG)):', this.state.map(toHex).join(' '));
        }

        // Execute Sparkle with BIG number of steps
        this._sparkle(SPARKLE_STEPS_BIG);

        // Debug
        if (typeof process !== 'undefined' && process.env.DEBUG_SPARKLE) {
          const toHex = (w) => w.toString(16).padStart(8,'0').toUpperCase();
          console.log('State after init Sparkle(BIG):', this.state.map(toHex).join(' '));
        }

        this.encrypted = false;
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

        // Initialize state if not already done
        if (!this.initialized) {
          this.Reset();
          this.initialized = true;
        }

        // Process AAD first if present
        this._processAAD();

        const output = [];
        let dataToProcess = this._buffer;
        let expectedTag = null;

        // In decryption mode, extract tag from end of input
        if (this.isInverse) {
          if (this._bufPos < TAG_SIZE) {
            throw new Error("Ciphertext too short for tag");
          }
          // Split input: ciphertext || tag
          expectedTag = this._buffer.slice(this._bufPos - TAG_SIZE, this._bufPos);
          dataToProcess = this._buffer.slice(0, this._bufPos - TAG_SIZE);
        } else {
          dataToProcess = this._buffer.slice(0, this._bufPos);
        }

        // Process full blocks
        let offset = 0;
        const dataLength = dataToProcess.length;
        while (offset + BLOCK_SIZE <= dataLength) {
          const block = dataToProcess.slice(offset, offset + BLOCK_SIZE);
          const processed = this.isInverse
            ? this._decryptBlock(block)
            : this._encryptBlock(block);
          output.push(...processed);
          offset += BLOCK_SIZE;
        }

        // Process final block (may be partial)
        const remaining = dataToProcess.slice(offset);
        const finalOutput = this.isInverse
          ? this._decryptFinal(remaining)
          : this._encryptFinal(remaining);
        output.push(...finalOutput);

        // Generate/verify tag
        const tag = this._finalize();

        if (this.isInverse) {
          // Verification mode: check tag
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

        // Clear buffers
        this._buffer = [];
        this._bufPos = 0;
        this._aad = [];
        this._aadPos = 0;

        return output;
      }

      _processAAD() {
        // Process full AAD blocks
        let offset = 0;
        while (offset + BLOCK_SIZE <= this._aadPos) {
          const block = this._aad.slice(offset, offset + BLOCK_SIZE);
          this._processAADBlock(block, true); // true = full block, uses SLIM
          offset += BLOCK_SIZE;
        }

        // Always process final AAD block (even if empty)
        const finalBlock = new Array(BLOCK_SIZE).fill(0);
        const remaining = this._aadPos - offset;

        // Copy remaining AAD bytes
        for (let i = 0; i < remaining; ++i) {
          finalBlock[i] = this._aad[offset + i];
        }

        // Add constant and padding
        if (remaining < BLOCK_SIZE) {
          this.state[STATE_WORDS - 1] ^= _A0;
          finalBlock[remaining] = 0x80;
        } else {
          this.state[STATE_WORDS - 1] ^= _A1;
        }

        this._processAADBlock(finalBlock, false); // false = final block, uses BIG
      }

      _processAADBlock(block, useSLIM) {
        // Debug
        if (typeof process !== 'undefined' && process.env.DEBUG_SPARKLE) {
          const toHex = (w) => w.toString(16).padStart(8,'0').toUpperCase();
          const toHexByte = (b) => b.toString(16).padStart(2,'0').toUpperCase();
          console.log('\nAAD block processing, useSLIM=', useSLIM);
          console.log('Block bytes:', block.map(toHexByte).join(' '));
          console.log('State before AAD rho:', this.state.map(toHex).join(' '));
        }

        // Rho transformation for AAD
        for (let i = 0; i < RATE_WORDS / 2; ++i) {
          const j = i + RATE_WORDS / 2;

          const s_i = this.state[i];
          const s_j = this.state[j];

          const d_i = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
          const d_j = OpCodes.Pack32LE(block[j * 4], block[j * 4 + 1], block[j * 4 + 2], block[j * 4 + 3]);

          this.state[i] = s_j ^ d_i ^ this.state[RATE_WORDS + i];
          this.state[j] = s_i ^ s_j ^ d_j ^ this.state[RATE_WORDS + (j & CAP_MASK)];
        }

        // Debug
        if (typeof process !== 'undefined' && process.env.DEBUG_SPARKLE) {
          const toHex = (w) => w.toString(16).padStart(8,'0').toUpperCase();
          console.log('State after AAD rho:', this.state.map(toHex).join(' '));
        }

        // Use SLIM for full blocks, BIG for final block
        this._sparkle(useSLIM ? SPARKLE_STEPS_SLIM : SPARKLE_STEPS_BIG);

        // Debug
        if (typeof process !== 'undefined' && process.env.DEBUG_SPARKLE) {
          const toHex = (w) => w.toString(16).padStart(8,'0').toUpperCase();
          const steps = useSLIM ? 'SLIM' : 'BIG';
          console.log(`State after Sparkle(${steps}):`, this.state.map(toHex).join(' '));
        }
      }

      _encryptBlock(block) {
        const output = new Array(BLOCK_SIZE);

        for (let i = 0; i < RATE_WORDS / 2; ++i) {
          const j = i + RATE_WORDS / 2;

          const s_i = this.state[i];
          const s_j = this.state[j];

          const d_i = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
          const d_j = OpCodes.Pack32LE(block[j * 4], block[j * 4 + 1], block[j * 4 + 2], block[j * 4 + 3]);

          this.state[i] = s_j ^ d_i ^ this.state[RATE_WORDS + i];
          this.state[j] = s_i ^ s_j ^ d_j ^ this.state[RATE_WORDS + (j & CAP_MASK)];

          const out_i = d_i ^ s_i;
          const out_j = d_j ^ s_j;

          const bytes_i = OpCodes.Unpack32LE(out_i);
          const bytes_j = OpCodes.Unpack32LE(out_j);

          output[i * 4] = bytes_i[0];
          output[i * 4 + 1] = bytes_i[1];
          output[i * 4 + 2] = bytes_i[2];
          output[i * 4 + 3] = bytes_i[3];
          output[j * 4] = bytes_j[0];
          output[j * 4 + 1] = bytes_j[1];
          output[j * 4 + 2] = bytes_j[2];
          output[j * 4 + 3] = bytes_j[3];
        }

        this._sparkle(SPARKLE_STEPS_SLIM);
        this.encrypted = true;

        return output;
      }

      _decryptBlock(block) {
        const output = new Array(BLOCK_SIZE);

        for (let i = 0; i < RATE_WORDS / 2; ++i) {
          const j = i + RATE_WORDS / 2;

          const s_i = this.state[i];
          const s_j = this.state[j];

          const d_i = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
          const d_j = OpCodes.Pack32LE(block[j * 4], block[j * 4 + 1], block[j * 4 + 2], block[j * 4 + 3]);

          this.state[i] = s_i ^ s_j ^ d_i ^ this.state[RATE_WORDS + i];
          this.state[j] = s_i ^ d_j ^ this.state[RATE_WORDS + (j & CAP_MASK)];

          const out_i = d_i ^ s_i;
          const out_j = d_j ^ s_j;

          const bytes_i = OpCodes.Unpack32LE(out_i);
          const bytes_j = OpCodes.Unpack32LE(out_j);

          output[i * 4] = bytes_i[0];
          output[i * 4 + 1] = bytes_i[1];
          output[i * 4 + 2] = bytes_i[2];
          output[i * 4 + 3] = bytes_i[3];
          output[j * 4] = bytes_j[0];
          output[j * 4 + 1] = bytes_j[1];
          output[j * 4 + 2] = bytes_j[2];
          output[j * 4 + 3] = bytes_j[3];
        }

        this._sparkle(SPARKLE_STEPS_SLIM);
        this.encrypted = true;

        return output;
      }

      _encryptFinal(block) {
        // Skip final block processing if no data to process
        if (block.length === 0) {
          return [];
        }

        const output = new Array(block.length);

        // Add domain separation constant
        this.state[STATE_WORDS - 1] ^= (block.length < BLOCK_SIZE) ? _M2 : _M3;

        // Prepare buffer with padding
        const buffer = new Array(RATE_WORDS).fill(0);
        for (let i = 0; i < block.length; ++i) {
          const wordIdx = (i >>> 2);
          const byteIdx = (i & 3);
          buffer[wordIdx] |= (block[i] & 0xFF) << (byteIdx << 3);
        }

        if (block.length < BLOCK_SIZE) {
          const wordIdx = (block.length >>> 2);
          const byteIdx = (block.length & 3);
          buffer[wordIdx] ^= 0x80 << (byteIdx << 3);
        }

        // Rho and rate-whitening
        for (let i = 0; i < RATE_WORDS / 2; ++i) {
          const j = i + RATE_WORDS / 2;

          const s_i = this.state[i];
          const s_j = this.state[j];

          this.state[i] = s_j ^ buffer[i] ^ this.state[RATE_WORDS + i];
          this.state[j] = s_i ^ s_j ^ buffer[j] ^ this.state[RATE_WORDS + (j & CAP_MASK)];

          buffer[i] ^= s_i;
          buffer[j] ^= s_j;
        }

        // Extract output
        for (let i = 0; i < block.length; ++i) {
          const wordIdx = (i >>> 2);
          const byteIdx = (i & 3);
          output[i] = (buffer[wordIdx] >>> (byteIdx << 3)) & 0xFF;
        }

        this._sparkle(SPARKLE_STEPS_BIG);

        return output;
      }

      _decryptFinal(block) {
        // Skip final block processing if no data to process
        if (block.length === 0) {
          return [];
        }

        const output = new Array(block.length);

        // Add domain separation constant
        this.state[STATE_WORDS - 1] ^= (block.length < BLOCK_SIZE) ? _M2 : _M3;

        // Prepare buffer
        const buffer = new Array(RATE_WORDS).fill(0);
        for (let i = 0; i < block.length; ++i) {
          const wordIdx = (i >>> 2);
          const byteIdx = (i & 3);
          buffer[wordIdx] |= (block[i] & 0xFF) << (byteIdx << 3);
        }

        if (block.length < BLOCK_SIZE) {
          // Copy remaining state for partial block
          const tmp = (block.length & 3) << 3;
          const wordIdx = block.length >>> 2;
          buffer[wordIdx] |= (this.state[wordIdx] >>> tmp) << tmp;
          for (let idx = wordIdx + 1; idx < RATE_WORDS; ++idx) {
            buffer[idx] = this.state[idx];
          }
          // Add padding
          buffer[block.length >>> 2] ^= 0x80 << ((block.length & 3) << 3);
        }

        // Rho and rate-whitening for decryption
        for (let i = 0; i < RATE_WORDS / 2; ++i) {
          const j = i + RATE_WORDS / 2;

          const s_i = this.state[i];
          const s_j = this.state[j];

          this.state[i] = s_i ^ s_j ^ buffer[i] ^ this.state[RATE_WORDS + i];
          this.state[j] = s_i ^ buffer[j] ^ this.state[RATE_WORDS + (j & CAP_MASK)];

          buffer[i] ^= s_i;
          buffer[j] ^= s_j;
        }

        // Extract output
        for (let i = 0; i < block.length; ++i) {
          const wordIdx = (i >>> 2);
          const byteIdx = (i & 3);
          output[i] = (buffer[wordIdx] >>> (byteIdx << 3)) & 0xFF;
        }

        this._sparkle(SPARKLE_STEPS_BIG);

        return output;
      }

      _finalize() {
        // Debug: show state before key addition
        if (typeof process !== 'undefined' && process.env.DEBUG_SPARKLE) {
          const toHex = (w) => w.toString(16).padStart(8,'0').toUpperCase();
          console.log('State before key add:', this.state.map(toHex).join(' '));
          console.log('Key:', this.k.map(toHex).join(' '));
        }

        // Add key to capacity part
        for (let i = 0; i < KEY_WORDS; ++i) {
          this.state[RATE_WORDS + i] ^= this.k[i];
        }

        // Debug: show state after key addition
        if (typeof process !== 'undefined' && process.env.DEBUG_SPARKLE) {
          const toHex = (w) => w.toString(16).padStart(8,'0').toUpperCase();
          console.log('State after key add:', this.state.map(toHex).join(' '));
        }

        // Extract tag from capacity part
        const tag = new Array(TAG_SIZE);
        for (let i = 0; i < TAG_WORDS; ++i) {
          const bytes = OpCodes.Unpack32LE(this.state[RATE_WORDS + i]);
          tag[i * 4] = bytes[0];
          tag[i * 4 + 1] = bytes[1];
          tag[i * 4 + 2] = bytes[2];
          tag[i * 4 + 3] = bytes[3];
        }

        return tag;
      }

      _sparkle(steps) {
        // Sparkle ARX-box permutation
        if (typeof process !== 'undefined' && process.env.DEBUG_SPARKLE_DETAILED) {
          const toHex = (w) => w.toString(16).padStart(8,'0').toUpperCase();
          console.log(`\n=== Sparkle(${steps}) START ===`);
          console.log('Input:', this.state.map(toHex).join(' '));
        }

        for (let step = 0; step < steps; ++step) {
          // Add round constant to first word
          this.state[1] ^= RCON[step % 8];
          this.state[3] ^= step;

          if (typeof process !== 'undefined' && process.env.DEBUG_SPARKLE_DETAILED) {
            const toHex = (w) => w.toString(16).padStart(8,'0').toUpperCase();
            console.log(`\nStep ${step} after round constant:`);
            console.log(this.state.map(toHex).join(' '));
          }

          // ARXbox layer - process branches (pairs of adjacent words)
          for (let b = 0; b < STATE_WORDS / 2; ++b) {
            const i = b * 2;      // Even index: 0, 2, 4, 6
            const j = b * 2 + 1;  // Odd index: 1, 3, 5, 7
            const rc = RCON[b];   // RCON[0..3]

            // Alzette ARX-box on branch (state[i], state[j])
            let x = this.state[i];
            let y = this.state[j];

            x = (x + OpCodes.RotR32(y, 31)) >>> 0;
            y ^= OpCodes.RotR32(x, 24);
            x ^= rc;
            x = (x + OpCodes.RotR32(y, 17)) >>> 0;
            y ^= OpCodes.RotR32(x, 17);
            x ^= rc;
            x = (x + y) >>> 0;
            y ^= OpCodes.RotR32(x, 31);
            x ^= rc;
            x = (x + OpCodes.RotR32(y, 24)) >>> 0;
            y ^= OpCodes.RotR32(x, 16);
            x ^= rc;

            this.state[i] = x;
            this.state[j] = y;
          }

          if (typeof process !== 'undefined' && process.env.DEBUG_SPARKLE_DETAILED) {
            const toHex = (w) => w.toString(16).padStart(8,'0').toUpperCase();
            console.log(`Step ${step} after ARXbox:`);
            console.log(this.state.map(toHex).join(' '));
          }

          // Linear layer - uses ELL function
          const s0 = this.state[0];
          const s1 = this.state[1];
          const s2 = this.state[2];
          const s3 = this.state[3];
          const s4 = this.state[4];
          const s5 = this.state[5];
          const s6 = this.state[6];
          const s7 = this.state[7];

          // ELL(x) = rotateRight(x, 16) ^ (x & 0xFFFF)
          const t02 = (OpCodes.RotR32(s0 ^ s2, 16) ^ ((s0 ^ s2) & 0xFFFF)) >>> 0;
          const t13 = (OpCodes.RotR32(s1 ^ s3, 16) ^ ((s1 ^ s3) & 0xFFFF)) >>> 0;

          const u0 = s0 ^ s4;
          const u1 = s1 ^ s5;
          const u2 = s2 ^ s6;
          const u3 = s3 ^ s7;

          this.state[0] = (u2 ^ t13) >>> 0;
          this.state[1] = (u3 ^ t02) >>> 0;
          this.state[2] = (u0 ^ t13) >>> 0;
          this.state[3] = (u1 ^ t02) >>> 0;
          this.state[4] = s0;
          this.state[5] = s1;
          this.state[6] = s2;
          this.state[7] = s3;

          if (typeof process !== 'undefined' && process.env.DEBUG_SPARKLE_DETAILED) {
            const toHex = (w) => w.toString(16).padStart(8,'0').toUpperCase();
            console.log(`Step ${step} after linear layer:`);
            console.log(this.state.map(toHex).join(' '));
          }
        }

        if (typeof process !== 'undefined' && process.env.DEBUG_SPARKLE_DETAILED) {
          const toHex = (w) => w.toString(16).padStart(8,'0').toUpperCase();
          console.log(`\n=== Sparkle(${steps}) END ===`);
          console.log('Output:', this.state.map(toHex).join(' '));
        }
      }
    }

    // Register algorithm
    RegisterAlgorithm(new Sparkle());

    return Sparkle;
  }
);
