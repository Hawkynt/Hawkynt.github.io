/*
 * CryptoPro Key Wrap Implementation
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 *
 * RFC 4357 Section 6.5 - CryptoPro KEK Diversification Algorithm
 * Russian cryptographic standard variant of GOST 28147-89 key wrapping
 *
 * Reference: Bouncy Castle CryptoProWrapEngine.java
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
})((function () {
  if (typeof globalThis !== "undefined") return globalThis;
  if (typeof window !== "undefined") return window;
  if (typeof global !== "undefined") return global;
  if (typeof self !== "undefined") return self;
  throw new Error("Unable to locate global object");
})(), function (AlgorithmFramework, OpCodes) {
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
    CryptoAlgorithm,
    IAlgorithmInstance,
    KeySize,
    LinkItem,
    Vulnerability
  } = AlgorithmFramework;

  const BLOCK_SIZE = 8;
  const KEY_BYTES = 32;
  const UKM_SIZE = 8; // User Key Material size
  const MAC_SIZE = 4; // MAC output size (4 bytes)

  // CryptoPro S-box (E-A standard S-box used in Russian cryptography)
  const CRYPTOPRO_SBOX = [
    0x9,0x6,0x3,0x2,0x8,0xB,0x1,0x7,0xA,0x4,0xE,0xF,0xC,0x0,0xD,0x5,
    0x3,0x7,0xE,0x9,0x8,0xA,0xF,0x0,0x5,0x2,0x6,0xC,0xB,0x4,0xD,0x1,
    0xE,0x4,0x6,0x2,0xB,0x3,0xD,0x8,0xC,0xF,0x5,0xA,0x0,0x7,0x1,0x9,
    0xE,0x7,0xA,0xC,0xD,0x1,0x3,0x9,0x0,0x2,0xB,0x4,0xF,0x8,0x5,0x6,
    0xB,0x5,0x1,0x9,0x8,0xD,0xF,0x0,0xE,0x4,0x2,0x3,0xC,0x7,0xA,0x6,
    0x3,0xA,0xD,0xC,0x1,0x2,0x0,0xB,0x7,0x5,0x9,0x4,0x8,0xF,0xE,0x6,
    0x1,0xD,0x2,0x9,0x7,0xA,0x6,0x0,0x8,0xC,0x4,0x5,0xF,0x3,0xB,0xE,
    0xB,0xA,0xF,0x5,0x0,0xC,0xE,0x8,0x6,0x2,0x3,0x9,0x1,0x7,0xD,0x4
  ];

  // GCFB constant 'C' from RFC 4357
  const GCFB_C = [
    0x69, 0x00, 0x72, 0x22, 0x64, 0xC9, 0x04, 0x23,
    0x8D, 0x3A, 0xDB, 0x96, 0x46, 0xE9, 0x2A, 0xC4,
    0x18, 0xFE, 0xAC, 0x94, 0x00, 0xED, 0x07, 0x12,
    0xC0, 0x86, 0xDC, 0xC2, 0xEF, 0x4C, 0xA9, 0x2B
  ];

  /**
   * GOST 28147-89 cipher core functions
   */
  class GOSTCipher {
    constructor(sbox) {
      this.sbox = sbox || CRYPTOPRO_SBOX;
      this.workingKey = null;
    }

    init(keyBytes) {
      this.workingKey = new Uint32Array(8);
      for (let i = 0; i < 8; i++) {
        const offset = i * 4;
        this.workingKey[i] = OpCodes.Pack32LE(
          keyBytes[offset],
          keyBytes[offset + 1],
          keyBytes[offset + 2],
          keyBytes[offset + 3]
        ) >>> 0;
      }
    }

    _mainStep(n1, keyWord) {
      // Add key modulo 2^32
      const cm = OpCodes.Add32(n1, keyWord);

      // S-box substitution (8 x 4-bit S-boxes)
      let om = 0;
      om += this.sbox[0 + ((cm >>> 0) & 0xF)] << 0;
      om += this.sbox[16 + ((cm >>> 4) & 0xF)] << 4;
      om += this.sbox[32 + ((cm >>> 8) & 0xF)] << 8;
      om += this.sbox[48 + ((cm >>> 12) & 0xF)] << 12;
      om += this.sbox[64 + ((cm >>> 16) & 0xF)] << 16;
      om += this.sbox[80 + ((cm >>> 20) & 0xF)] << 20;
      om += this.sbox[96 + ((cm >>> 24) & 0xF)] << 24;
      om += this.sbox[112 + ((cm >>> 28) & 0xF)] << 28;

      // 11-bit left rotation
      return OpCodes.RotL32(om, 11);
    }

    encryptBlock(input, inOff, output, outOff) {
      let N1 = OpCodes.Pack32LE(input[inOff], input[inOff + 1], input[inOff + 2], input[inOff + 3]);
      let N2 = OpCodes.Pack32LE(input[inOff + 4], input[inOff + 5], input[inOff + 6], input[inOff + 7]);

      // 32 rounds (3 full cycles forward + 1 reverse cycle)
      // Forward rounds: 3 cycles of 8 subkeys
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let j = 0; j < 8; j++) {
          const tmp = N1;
          N1 = (N2 ^ this._mainStep(N1, this.workingKey[j])) >>> 0;
          N2 = tmp;
        }
      }

      // Final reverse round: 8 subkeys in reverse order
      for (let j = 7; j >= 0; j--) {
        const tmp = N1;
        N1 = (N2 ^ this._mainStep(N1, this.workingKey[j])) >>> 0;
        N2 = tmp;
      }

      // Write output (little-endian)
      const leftBytes = OpCodes.Unpack32LE(N2);
      const rightBytes = OpCodes.Unpack32LE(N1);
      for (let i = 0; i < 4; i++) {
        output[outOff + i] = leftBytes[i];
        output[outOff + i + 4] = rightBytes[i];
      }
    }

    decryptBlock(input, inOff, output, outOff) {
      let N1 = OpCodes.Pack32LE(input[inOff], input[inOff + 1], input[inOff + 2], input[inOff + 3]);
      let N2 = OpCodes.Pack32LE(input[inOff + 4], input[inOff + 5], input[inOff + 6], input[inOff + 7]);

      // Forward round first
      for (let j = 0; j < 8; j++) {
        const tmp = N1;
        N1 = (N2 ^ this._mainStep(N1, this.workingKey[j])) >>> 0;
        N2 = tmp;
      }

      // Then 3 reverse cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        for (let j = 7; j >= 0; j--) {
          const tmp = N1;
          N1 = (N2 ^ this._mainStep(N1, this.workingKey[j])) >>> 0;
          N2 = tmp;
        }
      }

      // Write output (little-endian)
      const leftBytes = OpCodes.Unpack32LE(N2);
      const rightBytes = OpCodes.Unpack32LE(N1);
      for (let i = 0; i < 4; i++) {
        output[outOff + i] = leftBytes[i];
        output[outOff + i + 4] = rightBytes[i];
      }
    }
  }

  /**
   * GOST 28147-89 MAC
   */
  class GOSTMAC {
    constructor(sbox) {
      this.cipher = new GOSTCipher(sbox);
      this.mac = new Array(BLOCK_SIZE).fill(0);
      this.buf = new Array(BLOCK_SIZE).fill(0);
      this.bufOff = 0;
      this.firstStep = true;
      this.macIV = null;
    }

    init(keyBytes, ivBytes) {
      this.cipher.init(keyBytes);
      this.macIV = ivBytes ? Array.from(ivBytes) : null;
      this.reset();
    }

    update(data, offset, length) {
      if (!data || length === 0) return;

      let len = length;
      let inOff = offset;
      const gapLen = BLOCK_SIZE - this.bufOff;

      if (len > gapLen) {
        // Fill buffer
        for (let i = 0; i < gapLen; i++) {
          this.buf[this.bufOff + i] = data[inOff + i] & 0xFF;
        }

        this._processBlock();
        this.bufOff = 0;
        len -= gapLen;
        inOff += gapLen;

        // Process full blocks
        while (len > BLOCK_SIZE) {
          for (let i = 0; i < BLOCK_SIZE; i++) {
            this.buf[i] = data[inOff + i] & 0xFF;
          }
          this._processBlock();
          len -= BLOCK_SIZE;
          inOff += BLOCK_SIZE;
        }
      }

      // Copy remaining
      for (let i = 0; i < len; i++) {
        this.buf[this.bufOff + i] = data[inOff + i] & 0xFF;
      }
      this.bufOff += len;
    }

    doFinal(output, outOff) {
      // Pad with zeros
      while (this.bufOff < BLOCK_SIZE) {
        this.buf[this.bufOff++] = 0;
      }

      const sum = new Array(BLOCK_SIZE);
      if (this.firstStep) {
        this.firstStep = false;
        for (let i = 0; i < BLOCK_SIZE; i++) {
          sum[i] = this.buf[i];
        }
      } else {
        for (let i = 0; i < BLOCK_SIZE; i++) {
          sum[i] = (this.buf[i] ^ this.mac[i]) & 0xFF;
        }
      }

      // Encrypt final block
      this.cipher.encryptBlock(sum, 0, this.mac, 0);

      // Extract MAC (first 4 bytes from middle)
      const startPos = (BLOCK_SIZE / 2) - MAC_SIZE;
      for (let i = 0; i < MAC_SIZE; i++) {
        output[outOff + i] = this.mac[startPos + i];
      }

      this.reset();
      return MAC_SIZE;
    }

    _processBlock() {
      const sum = new Array(BLOCK_SIZE);

      if (this.firstStep) {
        this.firstStep = false;
        if (this.macIV !== null) {
          for (let i = 0; i < BLOCK_SIZE; i++) {
            sum[i] = (this.buf[i] ^ this.macIV[i]) & 0xFF;
          }
        } else {
          for (let i = 0; i < BLOCK_SIZE; i++) {
            sum[i] = this.buf[i];
          }
        }
      } else {
        for (let i = 0; i < BLOCK_SIZE; i++) {
          sum[i] = (this.buf[i] ^ this.mac[i]) & 0xFF;
        }
      }

      this.cipher.encryptBlock(sum, 0, this.mac, 0);
    }

    reset() {
      this.buf.fill(0);
      this.mac.fill(0);
      this.bufOff = 0;
      this.firstStep = true;
    }
  }

  /**
   * RFC 4357 Section 6.5 - CryptoPro KEK Diversification Algorithm
   *
   * Given a random 64-bit UKM and a GOST 28147-89 key K, this algorithm
   * creates a new GOST 28147-89 key K(UKM).
   */
  function cryptoProDiversify(K, ukm, sbox) {
    // K is modified in place through 8 iterations
    const keyBytes = Array.from(K);
    const cipher = new GOSTCipher(sbox);

    for (let i = 0; i < 8; i++) {
      // Calculate S[i] vector
      let sOn = 0;
      let sOff = 0;

      for (let j = 0; j < 8; j++) {
        const kj = OpCodes.Pack32LE(
          keyBytes[j * 4],
          keyBytes[j * 4 + 1],
          keyBytes[j * 4 + 2],
          keyBytes[j * 4 + 3]
        );

        // Check if bit j of ukm[i] is set
        if ((ukm[i] & (1 << j)) !== 0) {
          sOn = OpCodes.Add32(sOn, kj);
        } else {
          sOff = OpCodes.Add32(sOff, kj);
        }
      }

      // Create S[i] = sOn | sOff (8 bytes)
      const s = new Array(8);
      const sOnBytes = OpCodes.Unpack32LE(sOn);
      const sOffBytes = OpCodes.Unpack32LE(sOff);
      for (let j = 0; j < 4; j++) {
        s[j] = sOnBytes[j];
        s[j + 4] = sOffBytes[j];
      }

      // K[i+1] = encryptCFB(S[i], K[i], K[i])
      // According to RFC 4357, this uses GCFB (GOST CFB) mode
      // The key is encrypted using itself with S[i] as IV
      cipher.init(keyBytes);

      // GCFB encrypts the key using itself: processBlock(K, K) with IV=S
      // We need to XOR the key with encrypted S values
      const tempKey = new Array(KEY_BYTES);
      for (let block = 0; block < 4; block++) {
        const blockOffset = block * BLOCK_SIZE;

        // Encrypt S[i] (or previous ciphertext for CFB chaining)
        const iv = new Array(BLOCK_SIZE);
        if (block === 0) {
          // First block uses S as IV
          for (let j = 0; j < BLOCK_SIZE; j++) {
            iv[j] = s[j];
          }
        } else {
          // Subsequent blocks use previous ciphertext as IV
          for (let j = 0; j < BLOCK_SIZE; j++) {
            iv[j] = tempKey[blockOffset - BLOCK_SIZE + j];
          }
        }

        // Encrypt the IV
        const encryptedIV = new Array(BLOCK_SIZE);
        cipher.encryptBlock(iv, 0, encryptedIV, 0);

        // XOR with key block to produce ciphertext
        for (let j = 0; j < BLOCK_SIZE; j++) {
          tempKey[blockOffset + j] = (keyBytes[blockOffset + j] ^ encryptedIV[j]) & 0xFF;
        }
      }

      // Copy temp key back
      for (let j = 0; j < KEY_BYTES; j++) {
        keyBytes[j] = tempKey[j];
      }
    }

    return keyBytes;
  }

  class CryptoProWrapAlgorithm extends CryptoAlgorithm {
    constructor() {
      super();

      this.name = "CryptoPro Key Wrap";
      this.description = "Russian GOST 28147-89 based key wrapping with RFC 4357 key diversification. Uses CryptoPro S-box and optional MAC for integrity.";
      this.inventor = "CryptoPro (Russian cryptographic standard)";
      this.year = 2006;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [
        new KeySize(KEY_BYTES, KEY_BYTES, 0)
      ];
      this.SupportedBlockSizes = [
        new KeySize(32, 32, 0) // Wraps 32-byte keys
      ];

      this.documentation = [
        new LinkItem("RFC 4357 - Additional Cryptographic Algorithms for GOST 28147-89", "https://www.rfc-editor.org/rfc/rfc4357"),
        new LinkItem("GOST 28147-89 Standard (TC26)", "https://www.tc26.ru/en/standard/gost/")
      ];

      this.references = [
        new LinkItem("Bouncy Castle CryptoProWrapEngine.java", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/CryptoProWrapEngine.java"),
        new LinkItem("RFC 4357 Section 6.5 - KEK Diversification", "https://www.rfc-editor.org/rfc/rfc4357#section-6.5")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Deprecated standard",
          "GOST 28147-89 has been superseded by newer Russian cryptographic standards.",
          "Use modern key wrap algorithms like AES Key Wrap (RFC 3394) for new applications."
        ),
        new Vulnerability(
          "S-box dependency",
          "Security depends on the CryptoPro S-box parameter set.",
          "Always use the standardized CryptoPro S-box (E-A)."
        )
      ];

      // Test vectors - validated with round-trip testing
      this.tests = [
        {
          text: "CryptoPro Wrap Test (Bouncy Castle compatible)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/CryptoProWrapEngine.java",
          input: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          key: OpCodes.Hex8ToBytes("546d203368656c326973652073736e62206167796967747473656865202c3d73"),
          ukm: OpCodes.Hex8ToBytes("1234567890abcdef"),
          // Expected output is 36 bytes: 32 bytes encrypted + 4 bytes MAC
          expected: OpCodes.Hex8ToBytes("0b45e8051b41a19ae67354da4e6249dc477444e855ce81375361fad40dbf659375d073f5")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new CryptoProWrapInstance(this, isInverse);
    }
  }

  class CryptoProWrapInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse) {
      super(algorithm);
      this.isInverse = !!isInverse;
      this._key = null;
      this._ukm = null;
      this.cipher = new GOSTCipher(CRYPTOPRO_SBOX);
      this.mac = new GOSTMAC(CRYPTOPRO_SBOX);
      this.inputBuffer = [];
    }

    set key(keyBytes) {
      if (!keyBytes || keyBytes.length === 0) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== KEY_BYTES) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes. CryptoPro Wrap requires 32 bytes (256 bits).");
      }

      this._key = Array.from(keyBytes);
    }

    get key() {
      return this._key ? Array.from(this._key) : null;
    }

    set ukm(ukmBytes) {
      if (!ukmBytes || ukmBytes.length === 0) {
        this._ukm = null;
        return;
      }

      if (ukmBytes.length !== UKM_SIZE) {
        throw new Error("Invalid UKM size: " + ukmBytes.length + " bytes. Must be 8 bytes.");
      }

      this._ukm = Array.from(ukmBytes);
    }

    get ukm() {
      return this._ukm ? Array.from(this._ukm) : null;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._ukm) {
        throw new Error("UKM (User Key Material) not set");
      }

      for (let i = 0; i < data.length; i++) {
        this.inputBuffer.push(data[i] & 0xFF);
      }
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._ukm) {
        throw new Error("UKM (User Key Material) not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      let output;

      if (this.isInverse) {
        // Unwrap
        output = this._unwrap(this.inputBuffer);
      } else {
        // Wrap
        output = this._wrap(this.inputBuffer);
      }

      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer.length = 0;

      return output;
    }

    _wrap(input) {
      if (input.length !== 32) {
        throw new Error("Invalid input size for wrapping: " + input.length + " bytes. Must be 32 bytes.");
      }

      // Apply key diversification (copy key first since diversify modifies in-place)
      const diversifiedKey = cryptoProDiversify(Array.from(this._key), this._ukm, CRYPTOPRO_SBOX);

      // Initialize cipher and MAC with diversified key
      this.cipher.init(diversifiedKey);
      this.mac.init(diversifiedKey, this._ukm);

      // Compute MAC over plaintext
      this.mac.update(input, 0, input.length);

      // Wrap: encrypt + append MAC
      const wrappedKey = new Array(input.length + MAC_SIZE);

      // Encrypt all blocks (4 blocks of 8 bytes each)
      this.cipher.encryptBlock(input, 0, wrappedKey, 0);
      this.cipher.encryptBlock(input, 8, wrappedKey, 8);
      this.cipher.encryptBlock(input, 16, wrappedKey, 16);
      this.cipher.encryptBlock(input, 24, wrappedKey, 24);

      // Append MAC
      this.mac.doFinal(wrappedKey, input.length);

      // Clear sensitive data
      OpCodes.ClearArray(diversifiedKey);

      return wrappedKey;
    }

    _unwrap(input) {
      if (input.length !== 36) {
        throw new Error("Invalid input size for unwrapping: " + input.length + " bytes. Must be 36 bytes (32 + 4 MAC).");
      }

      // Apply key diversification (copy key first since diversify modifies in-place)
      const diversifiedKey = cryptoProDiversify(Array.from(this._key), this._ukm, CRYPTOPRO_SBOX);

      // Initialize cipher and MAC with diversified key
      this.cipher.init(diversifiedKey);
      this.mac.init(diversifiedKey, this._ukm);

      // Decrypt all blocks
      const decryptedKey = new Array(32);
      this.cipher.decryptBlock(input, 0, decryptedKey, 0);
      this.cipher.decryptBlock(input, 8, decryptedKey, 8);
      this.cipher.decryptBlock(input, 16, decryptedKey, 16);
      this.cipher.decryptBlock(input, 24, decryptedKey, 24);

      // Compute MAC over decrypted data
      this.mac.update(decryptedKey, 0, decryptedKey.length);
      const macResult = new Array(MAC_SIZE);
      this.mac.doFinal(macResult, 0);

      // Extract expected MAC from input
      const macExpected = new Array(MAC_SIZE);
      for (let i = 0; i < MAC_SIZE; i++) {
        macExpected[i] = input[32 + i];
      }

      // Constant-time MAC comparison
      if (!OpCodes.ConstantTimeCompare(macResult, macExpected, MAC_SIZE)) {
        OpCodes.ClearArray(diversifiedKey);
        OpCodes.ClearArray(decryptedKey);
        throw new Error("MAC verification failed");
      }

      // Clear sensitive data
      OpCodes.ClearArray(diversifiedKey);

      return decryptedKey;
    }

    Dispose() {
      if (this._key) {
        OpCodes.ClearArray(this._key);
        this._key = null;
      }
      if (this._ukm) {
        OpCodes.ClearArray(this._ukm);
        this._ukm = null;
      }
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer.length = 0;
    }
  }

  const algorithmInstance = new CryptoProWrapAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { CryptoProWrapAlgorithm, CryptoProWrapInstance };
});
