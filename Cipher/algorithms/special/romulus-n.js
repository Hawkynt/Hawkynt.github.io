/* Romulus-N AEAD Algorithm
 * NIST Lightweight Cryptography Competition Finalist
 * Based on SKINNY-128-384+ tweakable block cipher
 * Reference: https://romulusae.github.io/romulus/
 * Specification: https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/romulus-spec-final.pdf
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

// 8-bit S-box for SKINNY
const SBOX_8 = new Uint8Array([
  0x65, 0x4c, 0x6a, 0x42, 0x4b, 0x63, 0x43, 0x6b, 0x55, 0x75, 0x5a, 0x7a, 0x53, 0x73, 0x5b, 0x7b,
  0x35, 0x8c, 0x3a, 0x81, 0x89, 0x33, 0x80, 0x3b, 0x95, 0x25, 0x98, 0x2a, 0x90, 0x23, 0x99, 0x2b,
  0xe5, 0xcc, 0xe8, 0xc1, 0xc9, 0xe0, 0xc0, 0xe9, 0xd5, 0xf5, 0xd8, 0xf8, 0xd0, 0xf0, 0xd9, 0xf9,
  0xa5, 0x1c, 0xa8, 0x12, 0x1b, 0xa0, 0x13, 0xa9, 0x05, 0xb5, 0x0a, 0xb8, 0x03, 0xb0, 0x0b, 0xb9,
  0x32, 0x88, 0x3c, 0x85, 0x8d, 0x34, 0x84, 0x3d, 0x91, 0x22, 0x9c, 0x2c, 0x94, 0x24, 0x9d, 0x2d,
  0x62, 0x4a, 0x6c, 0x45, 0x4d, 0x64, 0x44, 0x6d, 0x52, 0x72, 0x5c, 0x7c, 0x54, 0x74, 0x5d, 0x7d,
  0xa1, 0x1a, 0xac, 0x15, 0x1d, 0xa4, 0x14, 0xad, 0x02, 0xb1, 0x0c, 0xbc, 0x04, 0xb4, 0x0d, 0xbd,
  0xe1, 0xc8, 0xec, 0xc5, 0xcd, 0xe4, 0xc4, 0xed, 0xd1, 0xf1, 0xdc, 0xfc, 0xd4, 0xf4, 0xdd, 0xfd,
  0x36, 0x8e, 0x38, 0x82, 0x8b, 0x30, 0x83, 0x39, 0x96, 0x26, 0x9a, 0x28, 0x93, 0x20, 0x9b, 0x29,
  0x66, 0x4e, 0x68, 0x41, 0x49, 0x60, 0x40, 0x69, 0x56, 0x76, 0x58, 0x78, 0x50, 0x70, 0x59, 0x79,
  0xa6, 0x1e, 0xaa, 0x11, 0x19, 0xa3, 0x10, 0xab, 0x06, 0xb6, 0x08, 0xba, 0x00, 0xb3, 0x09, 0xbb,
  0xe6, 0xce, 0xea, 0xc2, 0xcb, 0xe3, 0xc3, 0xeb, 0xd6, 0xf6, 0xda, 0xfa, 0xd3, 0xf3, 0xdb, 0xfb,
  0x31, 0x8a, 0x3e, 0x86, 0x8f, 0x37, 0x87, 0x3f, 0x92, 0x21, 0x9e, 0x2e, 0x97, 0x27, 0x9f, 0x2f,
  0x61, 0x48, 0x6e, 0x46, 0x4f, 0x67, 0x47, 0x6f, 0x51, 0x71, 0x5e, 0x7e, 0x57, 0x77, 0x5f, 0x7f,
  0xa2, 0x18, 0xae, 0x16, 0x1f, 0xa7, 0x17, 0xaf, 0x01, 0xb2, 0x0e, 0xbe, 0x07, 0xb7, 0x0f, 0xbf,
  0xe2, 0xca, 0xee, 0xc6, 0xcf, 0xe7, 0xc7, 0xef, 0xd2, 0xf2, 0xde, 0xfe, 0xd7, 0xf7, 0xdf, 0xff
]);

// TWEAKEY permutation for SKINNY
const TWEAKEY_P = new Uint8Array([9, 15, 8, 13, 10, 14, 12, 11, 0, 1, 2, 3, 4, 5, 6, 7]);

// Round constants for SKINNY
const RC = new Uint8Array([
  0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3E, 0x3D, 0x3B, 0x37, 0x2F,
  0x1E, 0x3C, 0x39, 0x33, 0x27, 0x0E, 0x1D, 0x3A, 0x35, 0x2B,
  0x16, 0x2C, 0x18, 0x30, 0x21, 0x02, 0x05, 0x0B, 0x17, 0x2E,
  0x1C, 0x38, 0x31, 0x23, 0x06, 0x0D, 0x1B, 0x36, 0x2D, 0x1A
]);

class RomulusN extends AeadAlgorithm {
  constructor() {
    super();

    this.name = "Romulus-N";
    this.description = "NIST Lightweight Cryptography finalist using SKINNY-128-384+ tweakable block cipher. Provides authenticated encryption with 128-bit security.";
    this.inventor = "Tetsu Iwata, Mustafa Khairallah, Kazuhiko Minematsu, Thomas Peyrin";
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
      new LinkItem("Romulus Specification", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/romulus-spec-final.pdf"),
      new LinkItem("Romulus Website", "https://romulusae.github.io/romulus/"),
      new LinkItem("NIST LWC Project", "https://csrc.nist.gov/projects/lightweight-cryptography")
    ];

    this.references = [
      new LinkItem("NIST LWC Competition", "https://csrc.nist.gov/projects/lightweight-cryptography"),
      new LinkItem("GitHub Reference", "https://github.com/romulusae/romulus")
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
        expected: OpCodes.Hex8ToBytes("5D8DB25AACB3DAB45FBC2F8D77849F90")
      },
      {
        text: "NIST LWC KAT Vector #2 (Empty PT, 1-byte AD)",
        uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
        input: OpCodes.Hex8ToBytes(""),
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        aad: OpCodes.Hex8ToBytes("00"),
        expected: OpCodes.Hex8ToBytes("2590094BA7DD1CDFF6BDED1878B0BD55")
      },
      {
        text: "NIST LWC KAT Vector #3 (Empty PT, 2-byte AD)",
        uri: "https://csrc.nist.gov/projects/lightweight-cryptography",
        input: OpCodes.Hex8ToBytes(""),
        key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
        aad: OpCodes.Hex8ToBytes("0001"),
        expected: OpCodes.Hex8ToBytes("4937850252E6D938F72E2B1FF82010F0")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new RomulusNInstance(this, isInverse);
  }
}

class RomulusNInstance extends IAeadInstance {
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

    const s = new Uint8Array(BLOCK_SIZE); // 16-byte state
    const CNT = new Uint8Array(7);
    CNT[0] = 0x01; // Initialize counter
    let twist = true;

    // Process AAD
    let aadPos = 0;
    while (aadPos + BLOCK_SIZE <= this.aad.length) {
      const block = this.aad.slice(aadPos, aadPos + BLOCK_SIZE);
      if (twist) {
        // XOR with state
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          s[i] ^= block[i];
        }
      } else {
        // Block cipher
        this._blockCipher(s, this._key, block, 0, CNT, 0x08);
      }
      this._lfsrGF56(CNT);
      twist = !twist;
      aadPos += BLOCK_SIZE;
    }

    // Process final AAD block
    if (aadPos < this.aad.length) {
      const mp = new Uint8Array(BLOCK_SIZE);
      const len8 = this.aad.length - aadPos;
      this._pad(this.aad, aadPos, mp, BLOCK_SIZE, len8);
      if (twist) {
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          s[i] ^= mp[i];
        }
      } else {
        this._blockCipher(s, this._key, mp, 0, CNT, 0x08);
      }
      this._lfsrGF56(CNT);
    }

    // Determine final AAD domain byte
    if (this.aad.length === 0) {
      this._lfsrGF56(CNT);
      this._blockCipher(s, this._key, this._nonce, 0, CNT, 0x1a);
    } else if ((aadPos & 15) !== 0) {
      this._blockCipher(s, this._key, this._nonce, 0, CNT, 0x1a);
    } else {
      this._blockCipher(s, this._key, this._nonce, 0, CNT, 0x18);
    }

    // Reset counter for message processing
    CNT[0] = 0x01;
    for (let i = 1; i < 7; ++i) CNT[i] = 0;

    const output = [];
    const messageLen = this.isInverse ? this.dataBuffer.length - TAG_SIZE : this.dataBuffer.length;

    // Process complete message blocks
    let msgPos = 0;
    while (msgPos + BLOCK_SIZE <= messageLen) {
      const block = this.dataBuffer.slice(msgPos, msgPos + BLOCK_SIZE);
      const temp = new Uint8Array(BLOCK_SIZE);

      this._g8A(s, temp);

      if (this.isInverse) {
        // Decrypt
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          temp[i] ^= block[i];
          s[i] ^= temp[i];
        }
        output.push(...temp);
      } else {
        // Encrypt
        for (let i = 0; i < BLOCK_SIZE; ++i) {
          s[i] ^= block[i];
          temp[i] ^= block[i];
        }
        output.push(...temp);
      }

      this._lfsrGF56(CNT);
      this._blockCipher(s, this._key, this._nonce, 0, CNT, 0x04);
      msgPos += BLOCK_SIZE;
    }

    // Process final message block
    if (msgPos < messageLen) {
      const len8 = messageLen - msgPos;
      const block = this.dataBuffer.slice(msgPos, msgPos + len8);
      const temp = new Uint8Array(BLOCK_SIZE);

      this._rho(block, temp, s, len8, this.isInverse);
      output.push(...temp.slice(0, len8));

      this._lfsrGF56(CNT);
      this._blockCipher(s, this._key, this._nonce, 0, CNT, len8 === BLOCK_SIZE ? 0x14 : 0x15);
    } else if (messageLen === 0) {
      this._lfsrGF56(CNT);
      this._blockCipher(s, this._key, this._nonce, 0, CNT, 0x15);
    }

    // Generate tag
    const tag = new Uint8Array(TAG_SIZE);
    this._g8A(s, tag);

    if (this.isInverse) {
      // Verify tag
      const receivedTag = this.dataBuffer.slice(messageLen, messageLen + TAG_SIZE);
      for (let i = 0; i < TAG_SIZE; ++i) {
        if (tag[i] !== receivedTag[i]) {
          throw new Error("Authentication failed: Tag mismatch");
        }
      }
      this.aadBuffer = [];
      this.dataBuffer = [];
      return output;
    } else {
      // Append tag
      output.push(...tag);
      this.aadBuffer = [];
      this.dataBuffer = [];
      return output;
    }
  }

  // SKINNY-128-384+ encryption
  // Direct translation from Bouncy Castle Java (lines 634-741)
  _skinny128_384Plus(input, userkey) {
    const state = [[0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]];
    const keyCells = [
      [[0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]],
      [[0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]],
      [[0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]]
    ];
    const keyCells_tmp = [
      [[0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]],
      [[0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]],
      [[0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]]
    ];

    // Initialize state and key cells - Java lines 641-648
    for (let i = 0; i < 4; ++i) {
      const q = i << 2;
      for (let j = 0; j < 4; ++j) {
        state[i][j] = input[q + j] & 0xFF;
        keyCells[0][i][j] = userkey[q + j] & 0xFF;
        keyCells[1][i][j] = userkey[q + 16 + j] & 0xFF;
        keyCells[2][i][j] = userkey[q + 32 + j] & 0xFF;
      }
    }

    // 40 rounds - Java line 649
    for (let round = 0; round < 40; ++round) {
      // SubCell8 - Java lines 652-658
      for (let i = 0; i < 4; ++i) {
        for (let j = 0; j < 4; ++j) {
          state[i][j] = SBOX_8[state[i][j] & 0xFF] & 0xFF;
        }
      }

      // AddConstants - Java lines 660-662
      state[0][0] = (state[0][0] ^ (RC[round] & 0xf)) & 0xFF;
      state[1][0] = (state[1][0] ^ ((RC[round] >>> 4) & 0x3)) & 0xFF;
      state[2][0] = (state[2][0] ^ 0x2) & 0xFF;

      // AddKey - Java lines 665-671 (first 2 rows only)
      for (let i = 0; i <= 1; ++i) {
        for (let j = 0; j < 4; ++j) {
          state[i][j] = (state[i][j] ^ keyCells[0][i][j] ^ keyCells[1][i][j] ^ keyCells[2][i][j]) & 0xFF;
        }
      }

      // TWEAKEY permutation - Java lines 672-684
      for (let i = 0; i < 4; ++i) {
        for (let j = 0; j < 4; ++j) {
          const pos = TWEAKEY_P[j + (i << 2)];
          const q = pos >>> 2;
          const r = pos & 3;
          keyCells_tmp[0][i][j] = keyCells[0][q][r];
          keyCells_tmp[1][i][j] = keyCells[1][q][r];
          keyCells_tmp[2][i][j] = keyCells[2][q][r];
        }
      }

      // LFSR updates - Java lines 686-697 (first 2 rows)
      for (let i = 0; i <= 1; ++i) {
        for (let j = 0; j < 4; ++j) {
          keyCells[0][i][j] = keyCells_tmp[0][i][j];
          let tmp = keyCells_tmp[1][i][j] & 0xFF;
          keyCells[1][i][j] = (((tmp << 1) & 0xFE) ^ ((tmp >>> 7) & 0x01) ^ ((tmp >>> 5) & 0x01)) & 0xFF;
          tmp = keyCells_tmp[2][i][j] & 0xFF;
          keyCells[2][i][j] = (((tmp >>> 1) & 0x7F) ^ ((tmp << 7) & 0x80) ^ ((tmp << 1) & 0x80)) & 0xFF;
        }
      }

      // Copy remaining rows - Java lines 698-706
      for (let i = 2; i < 4; ++i) {
        for (let j = 0; j < 4; ++j) {
          keyCells[0][i][j] = keyCells_tmp[0][i][j];
          keyCells[1][i][j] = keyCells_tmp[1][i][j];
          keyCells[2][i][j] = keyCells_tmp[2][i][j];
        }
      }

      // ShiftRows - Java lines 708-723
      let tmp = state[1][3];
      state[1][3] = state[1][2];
      state[1][2] = state[1][1];
      state[1][1] = state[1][0];
      state[1][0] = tmp;

      tmp = state[2][0];
      state[2][0] = state[2][2];
      state[2][2] = tmp;
      tmp = state[2][1];
      state[2][1] = state[2][3];
      state[2][3] = tmp;

      tmp = state[3][0];
      state[3][0] = state[3][1];
      state[3][1] = state[3][2];
      state[3][2] = state[3][3];
      state[3][3] = tmp;

      // MixColumn - Java lines 725-735
      for (let j = 0; j < 4; ++j) {
        state[1][j] = (state[1][j] ^ state[2][j]) & 0xFF;
        state[2][j] = (state[2][j] ^ state[0][j]) & 0xFF;
        state[3][j] = (state[3][j] ^ state[2][j]) & 0xFF;
        tmp = state[3][j];
        state[3][j] = state[2][j];
        state[2][j] = state[1][j];
        state[1][j] = state[0][j];
        state[0][j] = tmp;
      }
    }

    // Flatten state back to byte array - Java lines 737-740
    for (let i = 0; i < 16; ++i) {
      input[i] = state[i >>> 2][i & 0x3] & 0xFF;
    }
  }

  // Block cipher interface
  _blockCipher(s, K, T, tOff, CNT, D) {
    const KT = new Uint8Array(48);
    // Combine counter, domain byte, tweakey, and key
    for (let i = 0; i < 7; ++i) KT[i] = CNT[i];
    KT[7] = D;
    for (let i = 0; i < 16; ++i) KT[16 + i] = T[tOff + i];
    for (let i = 0; i < 16; ++i) KT[32 + i] = K[i];
    this._skinny128_384Plus(s, KT);
  }

  // GF(2^56) LFSR: CNT' = 2 * CNT mod (x^56 + x^7 + x^4 + x^2 + 1)
  _lfsrGF56(CNT) {
    const fb0 = (CNT[6] & 0xFF) >>> 7;
    CNT[6] = (((CNT[6] & 0xFF) << 1) | ((CNT[5] & 0xFF) >>> 7)) & 0xFF;
    CNT[5] = (((CNT[5] & 0xFF) << 1) | ((CNT[4] & 0xFF) >>> 7)) & 0xFF;
    CNT[4] = (((CNT[4] & 0xFF) << 1) | ((CNT[3] & 0xFF) >>> 7)) & 0xFF;
    CNT[3] = (((CNT[3] & 0xFF) << 1) | ((CNT[2] & 0xFF) >>> 7)) & 0xFF;
    CNT[2] = (((CNT[2] & 0xFF) << 1) | ((CNT[1] & 0xFF) >>> 7)) & 0xFF;
    CNT[1] = (((CNT[1] & 0xFF) << 1) | ((CNT[0] & 0xFF) >>> 7)) & 0xFF;
    if (fb0 === 1) {
      CNT[0] = (((CNT[0] & 0xFF) << 1) ^ 0x95) & 0xFF;
    } else {
      CNT[0] = ((CNT[0] & 0xFF) << 1) & 0xFF;
    }
  }

  // G(S): Key stream generation
  _g8A(s, c) {
    for (let i = 0; i < BLOCK_SIZE; ++i) {
      c[i] = (((s[i] & 0xFF) >>> 1) ^ (s[i] & 0x80) ^ ((s[i] & 0x01) << 7)) & 0xFF;
    }
  }

  // Padding function
  _pad(m, mOff, mp, l, len8) {
    mp[l - 1] = len8 & 0x0F;
    for (let i = 0; i < len8; ++i) {
      mp[i] = m[mOff + i];
    }
  }

  // Rho function (encryption/decryption with padding)
  _rho(m, c, s, len8, isDecrypt) {
    const mp = new Uint8Array(BLOCK_SIZE);
    this._pad(m, 0, mp, BLOCK_SIZE, len8);
    this._g8A(s, c);

    if (isDecrypt) {
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        s[i] ^= mp[i];
        if (i < len8) {
          s[i] ^= c[i];
          c[i] ^= mp[i];
        }
      }
    } else {
      for (let i = 0; i < BLOCK_SIZE; ++i) {
        s[i] ^= mp[i];
        if (i < len8) {
          c[i] ^= mp[i];
        } else {
          c[i] = 0;
        }
      }
    }
  }
}

// Register algorithm
RegisterAlgorithm(new RomulusN());
