/*
 * DES (Data Encryption Standard) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Implements the Data Encryption Standard as specified in FIPS 46-3.
 * 64-bit block cipher with 56-bit effective key length.
 * Educational use only - DES is cryptographically broken.
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

class DESAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "DES";
    this.description = "Data Encryption Standard, the first widely adopted symmetric encryption algorithm. 64-bit blocks with 56-bit keys. Broken by brute force attacks.";
    this.inventor = "IBM";
    this.year = 1975;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.BROKEN;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(8, 8, 1) // Fixed 8-byte (64-bit) keys
    ];
    this.SupportedBlockSizes = [
      new KeySize(8, 8, 1) // Fixed 8-byte (64-bit) blocks
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("FIPS 46-3 Specification", "https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25"),
      new LinkItem("NIST SP 800-67 Rev 2", "https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final"),
      new LinkItem("RFC 4772 - Security Implications", "https://tools.ietf.org/rfc/rfc4772.txt")
    ];

    this.references = [
      new LinkItem("ANSI X3.92-1981 Standard", "https://webstore.ansi.org/standards/incits/ansix3921981r1999"),
      new LinkItem("DES Challenge Results", "https://en.wikipedia.org/wiki/DES_Challenges"),
      new LinkItem("NIST CAVP Test Vectors", "https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/block-ciphers")
    ];

    // Test vectors from FIPS 46-3 and authoritative sources
    this.tests = [
      {
        text: "FIPS 46-3 Weak Key Test Vector #1",
        uri: "https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25",
        input: OpCodes.Hex8ToBytes("8000000000000000"),
        key: OpCodes.Hex8ToBytes("0101010101010101"),
        expected: OpCodes.Hex8ToBytes("95F8A5E5DD31D900")
      },
      {
        text: "FIPS 46-3 Weak Key Test Vector #2", 
        uri: "https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25",
        input: OpCodes.Hex8ToBytes("4000000000000000"),
        key: OpCodes.Hex8ToBytes("0101010101010101"),
        expected: OpCodes.Hex8ToBytes("DD7F121CA5015619")
      },
      {
        text: "FIPS 46-3 Single Bit Key Test",
        uri: "https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25",
        input: OpCodes.Hex8ToBytes("0000000000000000"),
        key: OpCodes.Hex8ToBytes("8001010101010101"),
        expected: OpCodes.Hex8ToBytes("95A8D72813DAA94D")
      },
      {
        text: "DES Standard Test Pattern",
        uri: "https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25",
        input: OpCodes.Hex8ToBytes("4E6F772069737420"),
        key: OpCodes.Hex8ToBytes("0123456789ABCDEF"),
        expected: OpCodes.Hex8ToBytes("3FA40E8A984D4815")
      },
      {
        text: "DES Educational Test Vector",
        uri: "https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25",
        input: OpCodes.Hex8ToBytes("0123456789ABCDEF"),
        key: OpCodes.Hex8ToBytes("133457799BBCDFF1"),
        expected: OpCodes.Hex8ToBytes("85E813540F0AB405")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new DESInstance(this, isInverse);
  }
}

class DESInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.subkeys = null;
    this.inputBuffer = [];
    this.BlockSize = 8;
    this.KeySize = 0;
    
    // Initialize DES constants and tables
    this._initTables();
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.subkeys = null;
      this.KeySize = 0;
      return;
    }

    // Validate key size
    const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
      keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
      (keyBytes.length - ks.minSize) % ks.stepSize === 0
    );
    
    if (!isValidSize) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    this.subkeys = this._generateSubkeys(keyBytes);
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.key) throw new Error("Key not set");

    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this.key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    // Validate input length
    if (this.inputBuffer.length % this.BlockSize !== 0) {
      throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
    }

    const output = [];
    
    // Process each 8-byte block
    for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
      const block = this.inputBuffer.slice(i, i + this.BlockSize);
      const processedBlock = this.isInverse 
        ? this._decryptBlock(block) 
        : this._encryptBlock(block);
      output.push(...processedBlock);
    }

    // Clear input buffer
    this.inputBuffer = [];
    
    return output;
  }

  _initTables() {
    // Initial Permutation
    this.IP = [
      58, 50, 42, 34, 26, 18, 10, 2,
      60, 52, 44, 36, 28, 20, 12, 4,
      62, 54, 46, 38, 30, 22, 14, 6,
      64, 56, 48, 40, 32, 24, 16, 8,
      57, 49, 41, 33, 25, 17, 9, 1,
      59, 51, 43, 35, 27, 19, 11, 3,
      61, 53, 45, 37, 29, 21, 13, 5,
      63, 55, 47, 39, 31, 23, 15, 7
    ];
    
    // Final Permutation (inverse of IP)
    this.FP = [
      40, 8, 48, 16, 56, 24, 64, 32,
      39, 7, 47, 15, 55, 23, 63, 31,
      38, 6, 46, 14, 54, 22, 62, 30,
      37, 5, 45, 13, 53, 21, 61, 29,
      36, 4, 44, 12, 52, 20, 60, 28,
      35, 3, 43, 11, 51, 19, 59, 27,
      34, 2, 42, 10, 50, 18, 58, 26,
      33, 1, 41, 9, 49, 17, 57, 25
    ];
    
    // Permuted Choice 1 (64 bits to 56 bits)
    this.PC1 = [
      57, 49, 41, 33, 25, 17, 9,
      1, 58, 50, 42, 34, 26, 18,
      10, 2, 59, 51, 43, 35, 27,
      19, 11, 3, 60, 52, 44, 36,
      63, 55, 47, 39, 31, 23, 15,
      7, 62, 54, 46, 38, 30, 22,
      14, 6, 61, 53, 45, 37, 29,
      21, 13, 5, 28, 20, 12, 4
    ];
    
    // Permuted Choice 2 (56 bits to 48 bits)
    this.PC2 = [
      14, 17, 11, 24, 1, 5,
      3, 28, 15, 6, 21, 10,
      23, 19, 12, 4, 26, 8,
      16, 7, 27, 20, 13, 2,
      41, 52, 31, 37, 47, 55,
      30, 40, 51, 45, 33, 48,
      44, 49, 39, 56, 34, 53,
      46, 42, 50, 36, 29, 32
    ];
    
    // Expansion table (32 bits to 48 bits)
    this.E = [
      32, 1, 2, 3, 4, 5,
      4, 5, 6, 7, 8, 9,
      8, 9, 10, 11, 12, 13,
      12, 13, 14, 15, 16, 17,
      16, 17, 18, 19, 20, 21,
      20, 21, 22, 23, 24, 25,
      24, 25, 26, 27, 28, 29,
      28, 29, 30, 31, 32, 1
    ];
    
    // P-box permutation
    this.P = [
      16, 7, 20, 21,
      29, 12, 28, 17,
      1, 15, 23, 26,
      5, 18, 31, 10,
      2, 8, 24, 14,
      32, 27, 3, 9,
      19, 13, 30, 6,
      22, 11, 4, 25
    ];
    
    // Rotation schedule for key generation
    this.SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
    
    // Initialize S-boxes
    this._initSBoxes();
  }

  _initSBoxes() {
    const sboxHex = [
      "0E040D01020F0B08030A060C05090007" +
      "000F07040E020D010A060C0B09050308" +
      "04010E080D06020B0F0C0907030A0500" +
      "0F0C080204090107050B030E0A00060D",
      
      "0F01080E060B03040907020D0C00050A" +
      "030D04070F02080E0C00010A06090B05" +
      "000E070B0A040D0105080C060903020F" +
      "0D080A01030F04020B06070C00050E09",
      
      "0A00090E06030F05010D0C070B040208" +
      "0D0700090304060A0208050E0C0B0F01" +
      "0D060409080F03000B01020C050A0E07" +
      "010A0D0006090807040F0E030B05020C",
      
      "070D0E030006090A010208050B0C040F" +
      "0D080B05060F00030407020C010A0E09" +
      "0A0609000C0B070D0F01030E05020804" +
      "030F00060A010D080904050B0C07020E",
      
      "020C0401070A0B060805030F0D000E09" +
      "0E0B020C04070D0105000F0A03090806" +
      "0402010B0A0D07080F090C050603000E" +
      "0B080C07010E020D060F00090A040503",
      
      "0C010A0F09020608000D03040E07050B" +
      "0A0F0402070C090506010D0E000B0308" +
      "090E0F0502080C030700040A010D0B06" +
      "0403020C09050F0A0B0E01070600080D",
      
      "040B020E0F00080D030C0907050A0601" +
      "0D000B070409010A0E03050C020F0806" +
      "01040B0D0C03070E0A0F060800050902" +
      "060B0D0801040A070905000F0E02030C",
      
      "0D020804060F0B010A09030E05000C07" +
      "010F0D080A0307040C05060B000E0902" +
      "070B0401090C0E0200060A0D0F030508" +
      "02010E07040A080D0F0C09000305060B"
    ];

    this.SBOX = [];
    for (let i = 0; i < sboxHex.length; i++) {
      const flatSbox = OpCodes.Hex8ToBytes(sboxHex[i]);
      const sbox = [];
      for (let row = 0; row < 4; row++) {
        sbox[row] = [];
        for (let col = 0; col < 16; col++) {
          sbox[row][col] = flatSbox[row * 16 + col];
        }
      }
      this.SBOX.push(sbox);
    }
  }

  _generateSubkeys(key) {
    // Convert key to bits and apply PC1 permutation
    let keyBits = this._bytesToBits(key);
    keyBits = this._permute(keyBits, this.PC1);

    // Split into two 28-bit halves
    let c = keyBits.slice(0, 28);
    let d = keyBits.slice(28, 56);

    const subkeys = [];

    // Generate 16 subkeys
    for (let i = 0; i < 16; i++) {
      // Left circular shift both halves
      c = this._leftShift(c, this.SHIFTS[i]);
      d = this._leftShift(d, this.SHIFTS[i]);

      // Combine and apply PC2 permutation
      const combined = c.concat(d);
      subkeys[i] = this._permute(combined, this.PC2);
    }

    return subkeys;
  }

  _encryptBlock(input) {
    return this._crypt(input, false);
  }

  _decryptBlock(input) {
    return this._crypt(input, true);
  }

  _crypt(input, isDecrypt) {
    // Convert input to bits and apply initial permutation
    let bits = this._bytesToBits(input);
    bits = this._permute(bits, this.IP);

    // Split into left and right halves
    let left = bits.slice(0, 32);
    let right = bits.slice(32, 64);

    // 16 rounds of Feistel network
    for (let i = 0; i < 16; i++) {
      const temp = right.slice();
      const key = isDecrypt ? this.subkeys[15 - i] : this.subkeys[i];
      right = this._xorBits(left, this._feistelFunction(right, key));
      left = temp;
    }

    // Combine halves (note: right and left are swapped before final permutation)
    const combined = right.concat(left);
    
    // Apply final permutation and convert back to bytes
    const finalBits = this._permute(combined, this.FP);
    return this._bitsToBytes(finalBits);
  }

  _feistelFunction(right, key) {
    // Expansion permutation (32 bits to 48 bits)
    const expanded = this._permute(right, this.E);
    
    // XOR with round key
    const xored = this._xorBits(expanded, key);
    
    // S-box substitution (48 bits to 32 bits)
    const substituted = this._sboxSubstitution(xored);
    
    // P-box permutation
    return this._permute(substituted, this.P);
  }

  _sboxSubstitution(input) {
    const output = [];
    
    for (let i = 0; i < 8; i++) {
      // Extract 6-bit block for this S-box
      const block = input.slice(i * 6, (i + 1) * 6);
      
      // Calculate row (outer bits) and column (middle 4 bits)
      const row = (block[0] << 1) | block[5];
      const col = (block[1] << 3) | (block[2] << 2) | (block[3] << 1) | block[4];
      
      // Get value from S-box
      const val = this.SBOX[i][row][col];
      
      // Convert to 4-bit binary and add to output
      for (let j = 3; j >= 0; j--) {
        output.push((val >> j) & 1);
      }
    }
    
    return output;
  }

  _permute(input, table) {
    const output = new Array(table.length);
    for (let i = 0; i < table.length; i++) {
      output[i] = input[table[i] - 1];
    }
    return output;
  }

  _xorBits(a, b) {
    const result = new Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] ^ b[i];
    }
    return result;
  }

  _leftShift(input, n) {
    return input.slice(n).concat(input.slice(0, n));
  }

  _bytesToBits(bytes) {
    const bits = new Array(bytes.length * 8);
    for (let i = 0; i < bytes.length; i++) {
      for (let j = 0; j < 8; j++) {
        bits[i * 8 + j] = (bytes[i] >> (7 - j)) & 1;
      }
    }
    return bits;
  }

  _bitsToBytes(bits) {
    const bytes = new Array(bits.length / 8);
    for (let i = 0; i < bytes.length; i++) {
      let val = 0;
      for (let j = 0; j < 8; j++) {
        val = (val << 1) | bits[i * 8 + j];
      }
      bytes[i] = val;
    }
    return bytes;
  }
}

// Register the algorithm
RegisterAlgorithm(new DESAlgorithm());