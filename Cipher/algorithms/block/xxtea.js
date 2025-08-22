/*
 * XXTEA (Corrected Block TEA) Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * XXTEA Algorithm by Roger Needham and David Wheeler (1998)
 * - Variable block size cipher (minimum 8 bytes, maximum 1024 bytes)
 * - 128-bit keys with improved key schedule
 * - Better diffusion across entire variable-length blocks
 * - Uses same golden ratio constant: 0x9E3779B9
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

class XXTEAAlgorithm extends AlgorithmFramework.BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "XXTEA";
    this.description = "Corrected Block TEA by Needham and Wheeler with variable block sizes and enhanced security over TEA/XTEA. Supports blocks from 8 bytes to 1KB with 128-bit keys and improved diffusion.";
    this.inventor = "Roger Needham, David Wheeler";
    this.year = 1998;
    this.category = AlgorithmFramework.CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
    this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
    this.country = AlgorithmFramework.CountryCode.GB;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new AlgorithmFramework.KeySize(16, 16, 1) // Fixed 128-bit key
    ];
    this.SupportedBlockSizes = [
      new AlgorithmFramework.KeySize(8, 1024, 4) // Variable 8-byte to 1KB blocks (multiple of 4)
    ];

    // Documentation and references
    this.documentation = [
      new AlgorithmFramework.LinkItem("Block TEA corrections and improvements", "https://www.cix.co.uk/~klockstone/xxtea.htm"),
      new AlgorithmFramework.LinkItem("Variable block cipher design", "https://link.springer.com/chapter/10.1007/3-540-60590-8_29"),
      new AlgorithmFramework.LinkItem("Cambridge Cryptography Research", "https://www.cl.cam.ac.uk/research/security/")
    ];

    this.references = [
      new AlgorithmFramework.LinkItem("Crypto++ XXTEA Implementation", "https://github.com/weidai11/cryptopp/blob/master/tea.cpp"),
      new AlgorithmFramework.LinkItem("Node.js XXTEA Implementation", "https://www.npmjs.com/package/xxtea"),
      new AlgorithmFramework.LinkItem("Python XXTEA Implementation", "https://pypi.org/project/xxtea/")
    ];

    // Known vulnerabilities
    this.knownVulnerabilities = [
      new AlgorithmFramework.Vulnerability("Limited standardization", "https://www.schneier.com/academic/", "Not widely standardized or analyzed compared to modern ciphers", "Use standardized ciphers like AES for production security applications"),
      new AlgorithmFramework.Vulnerability("Variable block complexity", "https://eprint.iacr.org/", "Variable block sizes may introduce implementation complexities and edge cases", "Careful implementation and testing required for security-critical applications")
    ];

    // Test vectors from various sources
    this.tests = [
      {
        text: "XXTEA 8-byte block test vector",
        uri: "Educational test vector",
        input: OpCodes.Hex8ToBytes("0000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("0537042bab575d00")
      },
      {
        text: "XXTEA 12-byte variable block test",
        uri: "Educational test vector",
        input: OpCodes.Hex8ToBytes("000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("123456789abcdef0123456789abcdef0"),
        expected: OpCodes.Hex8ToBytes("e91306eadbf9a325d8181800")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new XXTEAInstance(this, isInverse);
  }
}

class XXTEAInstance extends AlgorithmFramework.IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.keyWords = null;
    this.inputBuffer = [];
    this.BlockSize = 8; // Minimum block size
    this.KeySize = 0;
    
    // XXTEA constants
    this.DELTA = 0x9E3779B9;                   // Magic constant: 2^32 / golden ratio
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.keyWords = null;
      this.KeySize = 0;
      return;
    }

    // Validate key size
    if (keyBytes.length !== 16) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 16)`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    
    // Convert 128-bit key to four 32-bit words using OpCodes (big-endian)
    this.keyWords = [
      OpCodes.Pack32BE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
      OpCodes.Pack32BE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
      OpCodes.Pack32BE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
      OpCodes.Pack32BE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15])
    ];
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
    if (this.inputBuffer.length < 8 || this.inputBuffer.length % 4 !== 0) {
      throw new Error(`Input must be at least 8 bytes and multiple of 4 bytes`);
    }

    const output = this.isInverse 
      ? this._decryptData(this.inputBuffer) 
      : this._encryptData(this.inputBuffer);

    // Clear input buffer
    this.inputBuffer = [];
    
    return output;
  }

  // Encrypt variable-length data
  _encryptData(data) {
    // Convert to 32-bit words using OpCodes (big-endian)
    const words = [];
    for (let i = 0; i < data.length; i += 4) {
      words.push(OpCodes.Pack32BE(data[i], data[i+1], data[i+2], data[i+3]));
    }
    
    // XXTEA encryption algorithm
    const encryptedWords = this._encryptWords(words, this.keyWords);
    
    // Convert back to bytes using OpCodes
    const result = [];
    for (let i = 0; i < encryptedWords.length; i++) {
      const bytes = OpCodes.Unpack32BE(encryptedWords[i]);
      result.push(...bytes);
    }
    
    return result;
  }

  // Decrypt variable-length data
  _decryptData(data) {
    // Convert to 32-bit words using OpCodes (big-endian)
    const words = [];
    for (let i = 0; i < data.length; i += 4) {
      words.push(OpCodes.Pack32BE(data[i], data[i+1], data[i+2], data[i+3]));
    }
    
    // XXTEA decryption algorithm
    const decryptedWords = this._decryptWords(words, this.keyWords);
    
    // Convert back to bytes using OpCodes
    const result = [];
    for (let i = 0; i < decryptedWords.length; i++) {
      const bytes = OpCodes.Unpack32BE(decryptedWords[i]);
      result.push(...bytes);
    }
    
    return result;
  }

  // Internal XXTEA encryption algorithm
  _encryptWords(v, k) {
    const n = v.length;
    if (n < 2) return v; // Need at least 2 words
    
    // Copy input to avoid modification
    const words = OpCodes.CopyArray(v);
    
    // Calculate number of rounds: 6 + 52/n (minimum 6 rounds)
    const rounds = 6 + Math.floor(52 / n);
    let sum = 0;
    let z = words[n-1];
    
    for (let round = 0; round < rounds; round++) {
      sum = (sum + this.DELTA) >>> 0;
      const e = (sum >>> 2) & 3;
      
      for (let p = 0; p < n; p++) {
        const y = words[(p + 1) % n];
        const mx = this._calculateMX(z, y, sum, k[(p & 3) ^ e], p, e);
        words[p] = (words[p] + mx) >>> 0;
        z = words[p];
      }
    }
    
    return words;
  }

  // Internal XXTEA decryption algorithm
  _decryptWords(v, k) {
    const n = v.length;
    if (n < 2) return v; // Need at least 2 words
    
    // Copy input to avoid modification
    const words = OpCodes.CopyArray(v);
    
    // Calculate number of rounds: 6 + 52/n (minimum 6 rounds)
    const rounds = 6 + Math.floor(52 / n);
    let sum = (rounds * this.DELTA) >>> 0;
    let y = words[0];
    
    for (let round = 0; round < rounds; round++) {
      const e = (sum >>> 2) & 3;
      
      for (let p = n - 1; p >= 0; p--) {
        const z = words[p > 0 ? p - 1 : n - 1];
        const mx = this._calculateMX(z, y, sum, k[(p & 3) ^ e], p, e);
        words[p] = (words[p] - mx) >>> 0;
        y = words[p];
      }
      
      sum = (sum - this.DELTA) >>> 0;
    }
    
    return words;
  }

  // Calculate the MX value for XXTEA round function
  _calculateMX(z, y, sum, key, p, e) {
    // Original XXTEA MX calculation with improved bit operations
    const part1 = ((z >>> 5) ^ (y << 2)) >>> 0;
    const part2 = ((y >>> 3) ^ (z << 4)) >>> 0;
    const part3 = (sum ^ y) >>> 0;
    const part4 = (key ^ z) >>> 0;
    
    return ((part1 + part2) ^ (part3 + part4)) >>> 0;
  }
}

// Register the algorithm
AlgorithmFramework.RegisterAlgorithm(new XXTEAAlgorithm());