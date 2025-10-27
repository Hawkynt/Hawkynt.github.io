/* GIFT-COFB AEAD Algorithm
 * NIST Lightweight Cryptography Competition Finalist
 * Based on GIFT-128 block cipher with COFB mode
 * Reference: https://www.isical.ac.in/~lightweight/COFB/
 * Specification: https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/gift-cofb-spec-final.pdf
 */

// Load AlgorithmFramework
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const {
  RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
  AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize
} = AlgorithmFramework;

// Constants
const BLOCK_SIZE = 16;
const KEY_SIZE = 16;
const NONCE_SIZE = 16;
const TAG_SIZE = 16;
const ROUNDS = 40;

// Round constants for GIFT-128
const GIFT_RC = new Uint8Array([
  0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3E, 0x3D, 0x3B, 0x37, 0x2F,
  0x1E, 0x3C, 0x39, 0x33, 0x27, 0x0E, 0x1D, 0x3A, 0x35, 0x2B,
  0x16, 0x2C, 0x18, 0x30, 0x21, 0x02, 0x05, 0x0B, 0x17, 0x2E,
  0x1C, 0x38, 0x31, 0x23, 0x06, 0x0D, 0x1B, 0x36, 0x2D, 0x1A
]);

class GIFTCOFB extends AeadAlgorithm {
  constructor() {
    super();

    this.name = "GIFT-COFB";
    this.description = "NIST Lightweight Cryptography finalist using GIFT-128 block cipher with COFB mode. Provides authenticated encryption with 128-bit security.";
    this.inventor = "Subhadeep Banik, Andrey Bogdanov, Takanori Isobe, Martin Aagaard";
    this.year = 2019;
    this.category = CategoryType.AEAD;
    this.subCategory = "Authenticated Encryption";
    this.securityStatus = SecurityStatus.EXPERIMENTAL;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.INTL;

    this.SupportedKeySizes = [new KeySize(KEY_SIZE, KEY_SIZE, 1)];
    this.SupportedNonceSizes = [new KeySize(NONCE_SIZE, NONCE_SIZE, 1)];
    this.SupportedTagSizes = [TAG_SIZE];
    this.SupportsDetached = false;

    this.documentation = [
      new LinkItem("GIFT-COFB Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/gift-cofb-spec-final.pdf"),
      new LinkItem("GIFT-COFB Website", "https://www.isical.ac.in/~lightweight/COFB/"),
      new LinkItem("NIST LWC Project", "https://csrc.nist.gov/projects/lightweight-cryptography")
    ];

    this.references = [
      new LinkItem("NIST LWC Competition", "https://csrc.nist.gov/projects/lightweight-cryptography"),
      new LinkItem("GIFT Paper", "https://eprint.iacr.org/2017/622")
    ];

    // Official NIST LWC KAT test vectors
    this.tests = [
      {
        text: "NIST LWC KAT Vector #1 (Empty PT/AD)",
        uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
        input: OpCodes.Hex8ToBytes(""),
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        aad: OpCodes.Hex8ToBytes(""),
        expected: OpCodes.Hex8ToBytes("368965836D36614DE2FC24D0F801B9AF")
      },
      {
        text: "NIST LWC KAT Vector #2 (Empty PT, 1-byte AD)",
        uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
        input: OpCodes.Hex8ToBytes(""),
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        aad: OpCodes.Hex8ToBytes("00"),
        expected: OpCodes.Hex8ToBytes("AE5DCDD1285D5177FE251DEB99D727DC")
      },
      {
        text: "NIST LWC KAT Vector #3 (Empty PT, 2-byte AD)",
        uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
        input: OpCodes.Hex8ToBytes(""),
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        aad: OpCodes.Hex8ToBytes("0001"),
        expected: OpCodes.Hex8ToBytes("C4879E1B355D97DEA42CB661B2C1F9CA")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new GIFTCOFBInstance(this, isInverse);
  }
}

class GIFTCOFBInstance extends IAeadInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this._key = null;
    this._nonce = null;
    this.aadBuffer = [];
    this.dataBuffer = [];
    this.tagSize = TAG_SIZE;
  }

  // Property setters with validation
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      return;
    }
    if (keyBytes.length !== KEY_SIZE) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${KEY_SIZE})`);
    }
    this._key = [...keyBytes];
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
  }

  get nonce() {
    return this._nonce ? [...this._nonce] : null;
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this._key) throw new Error("Key not set");
    if (!this._nonce) throw new Error("Nonce not set");
    this.dataBuffer.push(...data);
  }

  Result() {
    if (!this._key) throw new Error("Key not set");
    if (!this._nonce) throw new Error("Nonce not set");

    // Initialize Y and offset
    const Y = new Uint8Array(BLOCK_SIZE);
    const offset = new Uint8Array(8);
    const input = new Uint8Array(BLOCK_SIZE);

    // Initialize: Y = E(nonce)
    for (let i = 0; i < NONCE_SIZE; ++i) {
      input[i] = this._nonce[i];
    }
    this._giftb128(input, this._key, Y);
    for (let i = 0; i < 8; ++i) {
      offset[i] = Y[i];
    }

    const messageLen = this.isInverse ? this.dataBuffer.length - TAG_SIZE : this.dataBuffer.length;
    const output = [];

    // Process AAD
    let aadPos = 0;
    while (aadPos + BLOCK_SIZE <= this.aad.length) {
      const block = this.aad.slice(aadPos, aadPos + BLOCK_SIZE);
      this._pho1(input, Y, block, 0, BLOCK_SIZE);
      this._doubleHalfBlock(offset);
      for (let i = 0; i < 8; ++i) {
        input[i] ^= offset[i];
      }
      this._giftb128(input, this._key, Y);
      aadPos += BLOCK_SIZE;
    }

    // Final AAD processing
    const aadPartialLen = this.aad.length - aadPos;
    this._tripleHalfBlock(offset);
    if (aadPartialLen !== 0) {
      this._tripleHalfBlock(offset);
    }
    if (messageLen === 0) {
      this._tripleHalfBlock(offset);
      this._tripleHalfBlock(offset);
    }
    if (this.aad.length > 0 || aadPartialLen !== 0) {
      this._pho1(input, Y, this.aad, aadPos, aadPartialLen);
      for (let i = 0; i < 8; ++i) {
        input[i] ^= offset[i];
      }
      this._giftb128(input, this._key, Y);
    }

    // Process message
    let msgPos = 0;
    while (msgPos + BLOCK_SIZE <= messageLen) {
      const block = this.dataBuffer.slice(msgPos, msgPos + BLOCK_SIZE);
      this._doubleHalfBlock(offset);

      if (this.isInverse) {
        // Decrypt: M = C XOR Y
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          output.push(Y[i] ^ block[i]);
        }
        this._pho1(input, Y, output, msgPos, BLOCK_SIZE);
      } else {
        // Encrypt: C = M XOR Y
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          output.push(Y[i] ^ block[i]);
        }
        this._pho1(input, Y, block, 0, BLOCK_SIZE);
      }

      for (let i = 0; i < 8; ++i) {
        input[i] ^= offset[i];
      }
      this._giftb128(input, this._key, Y);
      msgPos += BLOCK_SIZE;
    }

    // Final message block
    const msgPartialLen = messageLen - msgPos;
    if (msgPartialLen > 0) {
      this._tripleHalfBlock(offset);
      this._tripleHalfBlock(offset);

      const block = this.dataBuffer.slice(msgPos, msgPos + msgPartialLen);

      if (this.isInverse) {
        // Decrypt partial block
        for (let i = 0; i < msgPartialLen; ++i) {
          output.push(Y[i] ^ block[i]);
        }
        this._pho1(input, Y, output, msgPos, msgPartialLen);
      } else {
        // Encrypt partial block
        for (let i = 0; i < msgPartialLen; ++i) {
          output.push(Y[i] ^ block[i]);
        }
        this._pho1(input, Y, block, 0, msgPartialLen);
      }

      for (let i = 0; i < 8; ++i) {
        input[i] ^= offset[i];
      }
      this._giftb128(input, this._key, Y);
    }

    // Generate/verify tag
    if (this.isInverse) {
      // Verify tag
      const receivedTag = this.dataBuffer.slice(messageLen, messageLen + TAG_SIZE);
      for (let i = 0; i < TAG_SIZE; ++i) {
        if (Y[i] !== receivedTag[i]) {
          throw new Error("Authentication failed: Tag mismatch");
        }
      }
      this.aadBuffer = [];
      this.dataBuffer = [];
      return output;
    } else {
      // Append tag
      for (let i = 0; i < TAG_SIZE; ++i) {
        output.push(Y[i]);
      }
      this.aadBuffer = [];
      this.dataBuffer = [];
      return output;
    }
  }

  // GIFT-128 block cipher
  _giftb128(P, K, C) {
    const S = new Uint32Array(4);
    const W = new Uint16Array(8);

    // Load state
    S[0] = OpCodes.Pack32BE(P[0], P[1], P[2], P[3]);
    S[1] = OpCodes.Pack32BE(P[4], P[5], P[6], P[7]);
    S[2] = OpCodes.Pack32BE(P[8], P[9], P[10], P[11]);
    S[3] = OpCodes.Pack32BE(P[12], P[13], P[14], P[15]);

    // Load key
    for (let i = 0; i < 8; ++i) {
      W[i] = (K[i * 2] << 8) | K[i * 2 + 1];
    }

    // 40 rounds
    for (let round = 0; round < ROUNDS; ++round) {
      // SubCells
      S[1] ^= S[0] & S[2];
      S[0] ^= S[1] & S[3];
      S[2] ^= S[0] | S[1];
      S[3] ^= S[2];
      S[1] ^= S[3];
      S[3] ^= 0xFFFFFFFF;
      S[2] ^= S[0] & S[1];
      const T = S[0];
      S[0] = S[3];
      S[3] = T;

      // PermBits
      S[0] = this._rowperm(S[0], 0, 3, 2, 1);
      S[1] = this._rowperm(S[1], 1, 0, 3, 2);
      S[2] = this._rowperm(S[2], 2, 1, 0, 3);
      S[3] = this._rowperm(S[3], 3, 2, 1, 0);

      // AddRoundKey
      S[2] ^= ((W[2] & 0xFFFF) << 16) | (W[3] & 0xFFFF);
      S[1] ^= ((W[6] & 0xFFFF) << 16) | (W[7] & 0xFFFF);

      // Add round constant
      S[3] ^= 0x80000000 ^ (GIFT_RC[round] & 0xFF);

      // Key state update
      const T6 = ((W[6] & 0xFFFF) >>> 2) | ((W[6] & 0xFFFF) << 14);
      const T7 = ((W[7] & 0xFFFF) >>> 12) | ((W[7] & 0xFFFF) << 4);
      W[7] = W[5];
      W[6] = W[4];
      W[5] = W[3];
      W[4] = W[2];
      W[3] = W[1];
      W[2] = W[0];
      W[1] = T7;
      W[0] = T6;
    }

    // Store state
    const bytes = OpCodes.Unpack32BE(S[0]);
    C[0] = bytes[0]; C[1] = bytes[1]; C[2] = bytes[2]; C[3] = bytes[3];
    const bytes1 = OpCodes.Unpack32BE(S[1]);
    C[4] = bytes1[0]; C[5] = bytes1[1]; C[6] = bytes1[2]; C[7] = bytes1[3];
    const bytes2 = OpCodes.Unpack32BE(S[2]);
    C[8] = bytes2[0]; C[9] = bytes2[1]; C[10] = bytes2[2]; C[11] = bytes2[3];
    const bytes3 = OpCodes.Unpack32BE(S[3]);
    C[12] = bytes3[0]; C[13] = bytes3[1]; C[14] = bytes3[2]; C[15] = bytes3[3];
  }

  // Row permutation for PermBits
  _rowperm(S, B0_pos, B1_pos, B2_pos, B3_pos) {
    let T = 0;
    for (let b = 0; b < 8; ++b) {
      T |= ((S >>> (4 * b)) & 0x1) << (b + 8 * B0_pos);
      T |= ((S >>> (4 * b + 1)) & 0x1) << (b + 8 * B1_pos);
      T |= ((S >>> (4 * b + 2)) & 0x1) << (b + 8 * B2_pos);
      T |= ((S >>> (4 * b + 3)) & 0x1) << (b + 8 * B3_pos);
    }
    return T >>> 0;
  }

  // Double half-block in GF(2^64): x^64 + x^4 + x^3 + x + 1
  _doubleHalfBlock(s) {
    const mask = ((s[0] & 0xFF) >>> 7) * 27;
    for (let i = 0; i < 7; ++i) {
      s[i] = (((s[i] & 0xFF) << 1) | ((s[i + 1] & 0xFF) >>> 7)) & 0xFF;
    }
    s[7] = (((s[7] & 0xFF) << 1) ^ mask) & 0xFF;
  }

  // Triple half-block in GF(2^64)
  _tripleHalfBlock(s) {
    const tmp = new Uint8Array(8);
    const mask = ((s[0] & 0xFF) >>> 7) * 27;
    for (let i = 0; i < 7; ++i) {
      tmp[i] = (((s[i] & 0xFF) << 1) | ((s[i + 1] & 0xFF) >>> 7)) & 0xFF;
    }
    tmp[7] = (((s[7] & 0xFF) << 1) ^ mask) & 0xFF;
    for (let i = 0; i < 8; ++i) {
      s[i] ^= tmp[i];
    }
  }

  // Pho1 function: padding, G transform, XOR
  _pho1(d, Y, M, mOff, noOfBytes) {
    const tmpM = new Uint8Array(BLOCK_SIZE);
    const tmp = new Uint8Array(BLOCK_SIZE);

    // Padding
    if (noOfBytes === 0) {
      tmpM[0] = 0x80;
    } else if (noOfBytes < BLOCK_SIZE) {
      for (let i = 0; i < noOfBytes; ++i) {
        tmpM[i] = M[mOff + i];
      }
      tmpM[noOfBytes] = 0x80;
    } else {
      for (let i = 0; i < noOfBytes; ++i) {
        tmpM[i] = M[mOff + i];
      }
    }

    // G(Y): swap halves and rotate second half left by 1 bit
    for (let i = 0; i < 8; ++i) {
      tmp[i] = Y[i + 8];
    }
    for (let i = 0; i < 7; ++i) {
      tmp[i + 8] = ((Y[i] & 0xFF) << 1) | ((Y[i + 1] & 0xFF) >>> 7);
    }
    tmp[15] = ((Y[7] & 0xFF) << 1) | ((Y[0] & 0xFF) >>> 7);

    // Update Y and d
    for (let i = 0; i < BLOCK_SIZE; ++i) {
      Y[i] = tmp[i];
      d[i] = (Y[i] ^ tmpM[i]) & 0xFF;
    }
  }
}

// Register algorithm
RegisterAlgorithm(new GIFTCOFB());
