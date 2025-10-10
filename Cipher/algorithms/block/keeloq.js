/* Keeloq Block Cipher
 * Microchip proprietary cipher for remote keyless entry
 * (c)2006-2025 Hawkynt
 *
 * 32-bit block cipher with 64-bit key
 * 528 rounds using NLFSR structure
 */

if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
        BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize } = AlgorithmFramework;

class Keeloq extends BlockCipherAlgorithm {
  constructor() {
    super();

    this.name = "Keeloq";
    this.description = "32-bit block cipher with 64-bit key designed for remote keyless entry systems. Uses 528-round NLFSR structure. Owned by Microchip. Cryptographically broken with known practical attacks.";
    this.inventor = "Nanoteq (Willem Smit)";
    this.year = 1985;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.BROKEN;
    this.complexity = ComplexityType.BEGINNER;
    this.country = CountryCode.ZA;

    this.SupportedKeySizes = [new KeySize(8, 8, 1)];  // 64-bit key
    this.SupportedBlockSizes = [new KeySize(4, 4, 1)];  // 32-bit block

    this.documentation = [
      new LinkItem("Wikipedia - Keeloq", "https://en.wikipedia.org/wiki/KeeLoq"),
      new LinkItem("IACR Cryptanalysis Paper", "https://eprint.iacr.org/2007/055.pdf")
    ];

    this.references = [
      new LinkItem("GitHub Implementation", "https://github.com/hadipourh/KeeLoq")
    ];

    this.tests = [
      {
        text: "GitHub test vector #1",
        uri: "https://github.com/hadipourh/KeeLoq",
        input: OpCodes.Hex8ToBytes("f741e2db"),
        key: OpCodes.Hex8ToBytes("5cec6701b79fd949"),
        expected: OpCodes.Hex8ToBytes("e44f4cdf")
      },
      {
        text: "GitHub test vector #2",
        uri: "https://github.com/hadipourh/KeeLoq",
        input: OpCodes.Hex8ToBytes("0ca69b92"),
        key: OpCodes.Hex8ToBytes("5cec6701b79fd949"),
        expected: OpCodes.Hex8ToBytes("a6ac0ea2")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new KeeloqInstance(this, isInverse);
  }
}

class KeeloqInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this.BlockSize = 4;
    this.KeySize = 0;

    // NLF lookup constant (5-bit input, 1-bit output)
    this.NLF = 0x3A5C742E;
    this.ROUNDS = 528;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      return;
    }

    if (keyBytes.length !== 8) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 8)`);
    }

    this._key = [...keyBytes];
    this.KeySize = 8;
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  _nlf(input) {
    // 5-bit input to 1-bit output nonlinear function
    return (this.NLF >>> input) & 0x1;
  }

  _encryptBlock(block) {
    // Load 32-bit value (big-endian)
    let state = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);

    // Convert key to 64-bit value: bytes 0-3 are HIGH word, bytes 4-7 are LOW word
    const keyHigh = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
    const keyLow = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);

    // 528 rounds
    for (let i = 0; i < this.ROUNDS; ++i) {
      // NLF input: bits 31, 26, 20, 9, 1
      const nlf_input = (((state >>> 31) & 0x1) << 4) |
                        (((state >>> 26) & 0x1) << 3) |
                        (((state >>> 20) & 0x1) << 2) |
                        (((state >>> 9) & 0x1) << 1) |
                        ((state >>> 1) & 0x1);

      const nlf_out = this._nlf(nlf_input);

      // Key bit selection (cycles through 64-bit key)
      const keyIndex = i % 64;
      const keyBit = (keyIndex < 32) ? ((keyLow >>> keyIndex) & 0x1) : ((keyHigh >>> (keyIndex - 32)) & 0x1);

      // Feedback: key_bit XOR bit16 XOR bit0 XOR nlf_out
      const feedback = keyBit ^ ((state >>> 16) & 0x1) ^ (state & 0x1) ^ nlf_out;

      // Shift right and insert feedback at bit 31
      state = ((state >>> 1) | (feedback << 31)) >>> 0;
    }

    // Output (big-endian)
    return [...OpCodes.Unpack32BE(state)];
  }

  _decryptBlock(block) {
    // Load 32-bit value (big-endian)
    let state = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);

    // Convert key to 64-bit value: bytes 0-3 are HIGH word, bytes 4-7 are LOW word
    const keyHigh = OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3]);
    const keyLow = OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]);

    // 528 rounds in reverse
    for (let i = this.ROUNDS - 1; i >= 0; --i) {
      // NLF input for decryption: bits 30, 25, 19, 8, 0 (one position left from encrypt)
      const nlf_input = (((state >>> 30) & 0x1) << 4) |
                        (((state >>> 25) & 0x1) << 3) |
                        (((state >>> 19) & 0x1) << 2) |
                        (((state >>> 8) & 0x1) << 1) |
                        (state & 0x1);

      const nlf_out = this._nlf(nlf_input);

      // Key bit selection (same as encryption)
      const keyIndex = i % 64;
      const keyBit = (keyIndex < 32) ? ((keyLow >>> keyIndex) & 0x1) : ((keyHigh >>> (keyIndex - 32)) & 0x1);

      // Feedback: key_bit XOR bit15 XOR bit31 XOR nlf_out
      const feedback = keyBit ^ ((state >>> 15) & 0x1) ^ ((state >>> 31) & 0x1) ^ nlf_out;

      // Shift left and insert feedback at bit 0
      state = (((state << 1) | feedback) & 0xFFFFFFFF) >>> 0;
    }

    // Output (big-endian)
    return [...OpCodes.Unpack32BE(state)];
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this._key) throw new Error("Key not set");
    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this._key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");
    if (this.inputBuffer.length % this.BlockSize !== 0) {
      throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
    }

    const output = [];
    for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
      const block = this.inputBuffer.slice(i, i + this.BlockSize);
      const processedBlock = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
      output.push(...processedBlock);
    }

    this.inputBuffer = [];
    return output;
  }
}

RegisterAlgorithm(new Keeloq());
