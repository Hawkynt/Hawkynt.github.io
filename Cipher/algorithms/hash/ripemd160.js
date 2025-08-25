/*
 * RIPEMD-160 Hash Function - Universal AlgorithmFramework Implementation
 * (c)2006-2025 Hawkynt
 */

if (!global.AlgorithmFramework && typeof require !== 'undefined')
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');

if (!global.OpCodes && typeof require !== 'undefined')
  global.OpCodes = require('../../OpCodes.js');

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;

class RIPEMD160Algorithm extends HashFunctionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "RIPEMD-160";
    this.description = "RACE Integrity Primitives Evaluation Message Digest with 160-bit output. Developed as a European alternative to SHA-1 with different design principles. Produces a 160-bit hash digest.";
    this.inventor = "Hans Dobbertin, Antoon Bosselaers, Bart Preneel";
    this.year = 1996;
    this.category = CategoryType.HASH;
    this.subCategory = "Cryptographic Hash";
    this.securityStatus = SecurityStatus.SECURE;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.BE;
    
    // Documentation and references
    this.documentation = [
      new LinkItem("RIPEMD-160: A Strengthened Version of RIPEMD", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"),
      new LinkItem("ISO/IEC 10118-3:2004 Standard", "https://www.iso.org/standard/39876.html"),
      new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/RIPEMD")
    ];
    
    this.references = [
      new LinkItem("OpenSSL Implementation", "https://github.com/openssl/openssl/tree/master/crypto/ripemd"),
      new LinkItem("Bouncy Castle Java Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD160Digest.java"),
      new LinkItem("Original Specification", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html")
    ];
    
    // Test vectors from official sources
    this.tests = [
      new TestCase(
        [], 
        OpCodes.Hex8ToBytes("9c1185a5c5e9fc54612808977ee8f548b2258d31"),
        "Empty string test vector",
        "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("a"), 
        OpCodes.Hex8ToBytes("0bdc9d2d256b3ee9daae347be6f4dc835a467ffe"),
        "Single character 'a' test vector",
        "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("abc"), 
        OpCodes.Hex8ToBytes("8eb208f7e05d987a9b044a8e98c6b087f15a0bfc"),
        "String 'abc' test vector",
        "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
      )
    ];
  }
  
  CreateInstance() {
    return new RIPEMD160Instance(this);
  }
}

class RIPEMD160Instance extends IHashFunctionInstance {
  constructor(algorithm) {
    super(algorithm);
    this.Reset();
  }
  
  Reset() {
    // Standard RIPEMD-160 initialization values
    this._h = [
      0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0
    ];
    
    this._buffer = new Array(64);
    this._length = 0;
    this._bufferLength = 0;
    
    // Clear buffer
    OpCodes.ClearArray(this._buffer);
  }
  
  Feed(data) {
    if (!data || data.length === 0) return;
    
    for (let i = 0; i < data.length; i++) {
      this._buffer[this._bufferLength++] = data[i];
      
      if (this._bufferLength === 64) {
        this._processBlock(this._buffer);
        this._bufferLength = 0;
      }
    }
    
    this._length += data.length;
  }

  Result() {
    return this.GetResult();
  }

  GetResult() {
    // Create working copy for finalization
    const tempH = [...this._h];
    const tempBuffer = [...this._buffer];
    const tempBufferLength = this._bufferLength;
    const tempLength = this._length;
    
    // MD5/SHA-1 style padding
    tempBuffer[tempBufferLength] = 0x80;
    let padLength = tempBufferLength + 1;
    
    // Check if we need an extra block
    if (padLength > 56) {
      while (padLength < 64) {
        tempBuffer[padLength++] = 0x00;
      }
      this._processBlockTemp(tempBuffer, tempH);
      padLength = 0;
    }
    
    // Pad to 56 bytes
    while (padLength < 56) {
      tempBuffer[padLength++] = 0x00;
    }
    
    // Append original length as 64-bit little-endian
    const lengthBits = tempLength * 8;
    tempBuffer[56] = lengthBits & 0xFF;
    tempBuffer[57] = (lengthBits >>> 8) & 0xFF;
    tempBuffer[58] = (lengthBits >>> 16) & 0xFF;
    tempBuffer[59] = (lengthBits >>> 24) & 0xFF;
    tempBuffer[60] = 0;
    tempBuffer[61] = 0;
    tempBuffer[62] = 0;
    tempBuffer[63] = 0;
    
    // Process final block
    this._processBlockTemp(tempBuffer, tempH);
    
    // Convert to byte array (little-endian)
    const result = new Array(20);
    for (let i = 0; i < 5; i++) {
      const bytes = OpCodes.Unpack32LE(tempH[i]);
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] = bytes[j];
      }
    }
    
    return result;
  }
  
  _processBlock(block) {
    this._processBlockTemp(block, this._h);
  }
  
  _processBlockTemp(block, state) {
    // Convert to 32-bit words
    const X = new Array(16);
    for (let i = 0; i < 16; i++) {
      X[i] = OpCodes.Pack32LE(block[i*4], block[i*4+1], block[i*4+2], block[i*4+3]);
    }
    
    // Initialize working variables  
    let AL = state[0], BL = state[1], CL = state[2], DL = state[3], EL = state[4];
    let AR = state[0], BR = state[1], CR = state[2], DR = state[3], ER = state[4];
    
    // Selection of message word
    const r = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13];
    const rp = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11];
    
    // Amount for left rotate per round
    const s = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,8,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];
    const sp = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];
    
    // 80 operations in two parallel lines
    for (let j = 0; j < 80; j++) {
      // Left line
      let t = (AL + this._f(j, BL, CL, DL) + X[r[j]] + this._K(j)) >>> 0;
      t = OpCodes.RotL32(t, s[j]) + EL;
      t = t >>> 0;
      AL = EL; EL = DL; DL = OpCodes.RotL32(CL, 10); CL = BL; BL = t;
      
      // Right line  
      t = (AR + this._f(79-j, BR, CR, DR) + X[rp[j]] + this._Kp(j)) >>> 0;
      t = OpCodes.RotL32(t, sp[j]) + ER;
      t = t >>> 0;
      AR = ER; ER = DR; DR = OpCodes.RotL32(CR, 10); CR = BR; BR = t;
    }
    
    // Combine results
    const t = (state[1] + CL + DR) >>> 0;
    state[1] = (state[2] + DL + ER) >>> 0;
    state[2] = (state[3] + EL + AR) >>> 0;
    state[3] = (state[4] + AL + BR) >>> 0;
    state[4] = (state[0] + BL + CR) >>> 0;
    state[0] = t;
  }
  
  _f(j, x, y, z) {
    if (j < 16) return x ^ y ^ z;
    else if (j < 32) return (x & y) | (~x & z);
    else if (j < 48) return (x | ~y) ^ z;
    else if (j < 64) return (x & z) | (y & ~z);
    else return x ^ (y | ~z);
  }
  
  _K(j) {
    if (j < 16) return 0x00000000;
    else if (j < 32) return 0x5A827999;
    else if (j < 48) return 0x6ED9EBA1;
    else if (j < 64) return 0x8F1BBCDC;
    else return 0xA953FD4E;
  }
  
  _Kp(j) {
    if (j < 16) return 0x50A28BE6;
    else if (j < 32) return 0x5C4DD124;
    else if (j < 48) return 0x6D703EF3;
    else if (j < 64) return 0x7A6D76E9;
    else return 0x00000000;
  }
}

// Register the algorithm
RegisterAlgorithm(new RIPEMD160Algorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RIPEMD160Algorithm;
}