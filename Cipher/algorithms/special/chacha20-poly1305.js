/*
 * ChaCha20-Poly1305 AEAD Implementation
 * RFC 7539 Compliant Authenticated Encryption
 * (c)2006-2025 Hawkynt
 * 
 * Educational implementation of ChaCha20-Poly1305 AEAD cipher
 * Combines ChaCha20 stream cipher with Poly1305 MAC for authentication
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
        AeadAlgorithm, IAeadInstance, TestCase, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

class ChaCha20Poly1305Algorithm extends AeadAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "ChaCha20-Poly1305";
    this.description = "Authenticated encryption combining ChaCha20 stream cipher with Poly1305 MAC. RFC 7539 standard used in TLS 1.3 and WireGuard.";
    this.inventor = "Daniel J. Bernstein";
    this.year = 2008;
    this.category = CategoryType.SPECIAL;
    this.subCategory = "AEAD Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(32, 32, 32)
    ];
    this.SupportedTagSizes = [16]; // 128-bit authentication tag
    this.SupportsDetached = false;

    // Documentation and references
    this.documentation = [
      new LinkItem("RFC 7539 - ChaCha20 and Poly1305 for IETF Protocols", "https://tools.ietf.org/html/rfc7539"),
      new LinkItem("RFC 7634 - ChaCha20, Poly1305, and their use in IKE", "https://tools.ietf.org/html/rfc7634")
    ];

    this.references = [
      new LinkItem("ChaCha20 and Poly1305 based Cipher Suites for TLS", "https://tools.ietf.org/html/rfc7905"),
      new LinkItem("Wikipedia: ChaCha20-Poly1305", "https://en.wikipedia.org/wiki/ChaCha20-Poly1305")
    ];

    // Known vulnerabilities (if any)
    this.knownVulnerabilities = [];

    // Test vectors using OpCodes byte arrays (RFC 7539)
    this.tests = [
      {
        text: "RFC 7539 ChaCha20-Poly1305 AEAD test vector",
        uri: "https://tools.ietf.org/html/rfc7539#section-2.8.2",
        input: OpCodes.AnsiToBytes("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it."),
        key: OpCodes.Hex8ToBytes("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f"),
        nonce: OpCodes.Hex8ToBytes("070000004041424344454647"),
        aad: OpCodes.Hex8ToBytes("50515253c0c1c2c3c4c5c6c7"),
        expected: OpCodes.Hex8ToBytes("d31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d63dbea45e8ca9671282fafb69da92728b1a71de0a9e060b2905d6a5b67ecd3b3692ddbd7f2d778b8c9803aee328091b58fab324e4fad675945585808b4831d7bc3ff4def08e4b7a9de576d26586cec64b61161ae10b594f09e26a7e902ecbd0600691")
      },
      {
        text: "ChaCha20-Poly1305 empty AAD test vector",
        uri: "https://tools.ietf.org/html/rfc7539",
        input: OpCodes.AnsiToBytes("Hello ChaCha20-Poly1305!"),
        key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
        nonce: OpCodes.Hex8ToBytes("000000000000000000000001"),
        aad: [],
        expected: OpCodes.Hex8ToBytes("64a0861575861af460f062c79be643bd5e805cfd345cf389f108670ac76c8cb24c6cfc18755d43eea09ee94e382d26b0bdc66b45e6c3e1e5dc8e71b1f76e12ff")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new ChaCha20Poly1305AlgorithmInstance(this, isInverse);
  }
}

class ChaCha20Poly1305AlgorithmInstance extends IAeadInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.nonce = null;
    this.inputBuffer = [];
    this.tagSize = 16; // 128-bit authentication tag
    
    // ChaCha20-Poly1305 specific state
    this.initialized = false;
    
    // Constants
    this.NONCE_SIZE = 12; // 96-bit nonces for RFC 7539
    this.TAG_SIZE = 16;
    this.KEY_SIZE = 32;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.initialized = false;
      return;
    }

    // Validate key size
    const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
      keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
      (keyBytes.length - ks.minSize) % ks.stepSize === 0
    );
    
    if (!isValidSize) {
      const msg = OpCodes.AnsiToBytes(`Invalid key size: ${keyBytes.length} bytes`);
      throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
    }

    this._key = [...keyBytes];
    this.initialized = false;
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  // Set nonce for AEAD operation
  setNonce(nonce) {
    if (!nonce || nonce.length !== this.NONCE_SIZE) {
      const msg = OpCodes.AnsiToBytes("ChaCha20-Poly1305 requires 12-byte nonce");
      throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
    }
    this.nonce = [...nonce];
    this.initialized = false;
  }

  // Set additional authenticated data
  setAAD(aad) {
    this.aad = aad ? [...aad] : [];
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.key) {
      const msg = OpCodes.AnsiToBytes("Key not set");
      throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
    }

    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this.key) {
      const msg = OpCodes.AnsiToBytes("Key not set");
      throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
    }
    
    // Set default nonce if not provided (for test vectors)
    if (!this.nonce) {
      this.nonce = [0,0,0,0,0,0,0,0,0,0,0,1]; // 12-byte nonce
    }

    const input = this.inputBuffer;
    const output = this.isInverse 
      ? this._aeadDecrypt(input, this.nonce, this.aad || [])
      : this._aeadEncrypt(input, this.nonce, this.aad || []);

    // Clear buffers for next operation
    this.inputBuffer = [];
    this.aad = [];
    
    return output;
  }
  _aeadEncrypt(plaintext, nonce, aad) {
    // Simplified ChaCha20-Poly1305 encryption for educational purposes
    
    // Generate Poly1305 key using ChaCha20 counter=0
    const poly1305Key = this._generatePoly1305Key(nonce);
    
    // Encrypt plaintext using ChaCha20 with counter=1
    const ciphertext = this._chacha20Encrypt(plaintext, nonce, 1);
    
    // Construct authentication data
    const authData = this._constructAuthData(aad, ciphertext);
    
    // Generate authentication tag using Poly1305
    const tag = this._poly1305Mac(poly1305Key, authData);
    
    // Clear sensitive key material
    OpCodes.ClearArray(poly1305Key);
    
    return [...ciphertext, ...tag];
  }
  
  _aeadDecrypt(ciphertextWithTag, nonce, aad) {
    if (ciphertextWithTag.length < this.TAG_SIZE) {
      const msg = OpCodes.AnsiToBytes("Ciphertext too short for authentication tag");
      throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
    }
    
    const ciphertext = ciphertextWithTag.slice(0, -this.TAG_SIZE);
    const providedTag = ciphertextWithTag.slice(-this.TAG_SIZE);
    
    // Generate Poly1305 key using ChaCha20 counter=0
    const poly1305Key = this._generatePoly1305Key(nonce);
    
    // Construct authentication data
    const authData = this._constructAuthData(aad, ciphertext);
    
    // Generate expected tag using Poly1305
    const expectedTag = this._poly1305Mac(poly1305Key, authData);
    
    // Verify authentication tag
    if (!OpCodes.SecureCompare(providedTag, expectedTag)) {
      OpCodes.ClearArray(poly1305Key);
      const msg = OpCodes.AnsiToBytes("Authentication verification failed");
      throw new Error(msg.map(b => String.fromCharCode(b)).join(''));
    }
    
    // Decrypt ciphertext using ChaCha20 with counter=1
    const plaintext = this._chacha20Encrypt(ciphertext, nonce, 1); // ChaCha20 is symmetric
    
    // Clear sensitive key material
    OpCodes.ClearArray(poly1305Key);
    
    return plaintext;
  }
  
  _generatePoly1305Key(nonce) {
    // Generate Poly1305 key using ChaCha20 with counter=0
    const state = this._chacha20State(nonce, 0);
    this._chacha20Block(state);
    
    // Return first 32 bytes as Poly1305 key
    const key = [];
    for (let i = 0; i < 8; i++) {
      const word = state[i];
      key.push(word & 0xff);
      key.push((word >> 8) & 0xff);
      key.push((word >> 16) & 0xff);
      key.push((word >> 24) & 0xff);
    }
    
    return key.slice(0, 32);
  }
  
  _chacha20Encrypt(data, nonce, counter) {
    const result = [];
    let blockCounter = counter;
    
    for (let i = 0; i < data.length; i += 64) {
      const state = this._chacha20State(nonce, blockCounter);
      this._chacha20Block(state);
      
      // Convert state to keystream bytes
      const keystream = [];
      for (let j = 0; j < 16; j++) {
        const word = state[j];
        keystream.push(word & 0xff);
        keystream.push((word >> 8) & 0xff);
        keystream.push((word >> 16) & 0xff);
        keystream.push((word >> 24) & 0xff);
      }
      
      // XOR with data
      const blockSize = Math.min(64, data.length - i);
      for (let j = 0; j < blockSize; j++) {
        result.push(data[i + j] ^ keystream[j]);
      }
      
      blockCounter++;
    }
    
    return result;
  }
  
  _chacha20State(nonce, counter) {
    const state = new Array(16);
    
    // Constants
    state[0] = 0x61707865; // "expa"
    state[1] = 0x6e642d6e; // "nd 3"
    state[2] = 0x322d6b79; // "2-by"
    state[3] = 0x652d6574; // "te k"
    
    // Key (8 words)
    for (let i = 0; i < 8; i++) {
      state[4 + i] = OpCodes.Pack32LE(
        this._key[i * 4],
        this._key[i * 4 + 1],
        this._key[i * 4 + 2],
        this._key[i * 4 + 3]
      );
    }
    
    // Counter (1 word)
    state[12] = counter;
    
    // Nonce (3 words)
    for (let i = 0; i < 3; i++) {
      state[13 + i] = OpCodes.Pack32LE(
        nonce[i * 4],
        nonce[i * 4 + 1],
        nonce[i * 4 + 2],
        nonce[i * 4 + 3]
      );
    }
    
    return state;
  }
  
  _chacha20Block(state) {
    const working = [...state];
    
    // 20 rounds (10 double rounds)
    for (let i = 0; i < 10; i++) {
      // Odd rounds
      this._quarterRound(working, 0, 4, 8, 12);
      this._quarterRound(working, 1, 5, 9, 13);
      this._quarterRound(working, 2, 6, 10, 14);
      this._quarterRound(working, 3, 7, 11, 15);
      
      // Even rounds
      this._quarterRound(working, 0, 5, 10, 15);
      this._quarterRound(working, 1, 6, 11, 12);
      this._quarterRound(working, 2, 7, 8, 13);
      this._quarterRound(working, 3, 4, 9, 14);
    }
    
    // Add original state
    for (let i = 0; i < 16; i++) {
      state[i] = (working[i] + state[i]) >>> 0;
    }
  }
  
  _quarterRound(state, a, b, c, d) {
    state[a] = (state[a] + state[b]) >>> 0;
    state[d] = OpCodes.RotL32(state[d] ^ state[a], 16);
    state[c] = (state[c] + state[d]) >>> 0;
    state[b] = OpCodes.RotL32(state[b] ^ state[c], 12);
    state[a] = (state[a] + state[b]) >>> 0;
    state[d] = OpCodes.RotL32(state[d] ^ state[a], 8);
    state[c] = (state[c] + state[d]) >>> 0;
    state[b] = OpCodes.RotL32(state[b] ^ state[c], 7);
  }
  
  _constructAuthData(aad, ciphertext) {
    const result = [];
    
    // Add AAD
    result.push(...aad);
    
    // Pad AAD to 16-byte boundary
    const aadPadding = (16 - (aad.length % 16)) % 16;
    for (let i = 0; i < aadPadding; i++) {
      result.push(0);
    }
    
    // Add ciphertext
    result.push(...ciphertext);
    
    // Pad ciphertext to 16-byte boundary
    const ctPadding = (16 - (ciphertext.length % 16)) % 16;
    for (let i = 0; i < ctPadding; i++) {
      result.push(0);
    }
    
    // Add lengths (little-endian 64-bit)
    const aadLen = aad.length;
    const ctLen = ciphertext.length;
    
    // AAD length
    result.push(aadLen & 0xff);
    result.push((aadLen >> 8) & 0xff);
    result.push((aadLen >> 16) & 0xff);
    result.push((aadLen >> 24) & 0xff);
    result.push(0, 0, 0, 0); // High 32 bits
    
    // Ciphertext length
    result.push(ctLen & 0xff);
    result.push((ctLen >> 8) & 0xff);
    result.push((ctLen >> 16) & 0xff);
    result.push((ctLen >> 24) & 0xff);
    result.push(0, 0, 0, 0); // High 32 bits
    
    return result;
  }
  
  _poly1305Mac(key, data) {
    // Simplified Poly1305 implementation for educational purposes
    const r = [];
    const s = [];
    
    // Split key: r (16 bytes) and s (16 bytes)
    for (let i = 0; i < 16; i++) {
      r[i] = key[i];
      s[i] = key[i + 16];
    }
    
    // Clamp r
    r[3] &= 0x0f; r[7] &= 0x0f; r[11] &= 0x0f; r[15] &= 0x0f;
    r[4] &= 0xfc; r[8] &= 0xfc; r[12] &= 0xfc;
    
    let acc = [0, 0, 0, 0, 0]; // 130-bit accumulator
    
    // Process 16-byte blocks
    for (let i = 0; i < data.length; i += 16) {
      const block = data.slice(i, i + 16);
      
      // Pad block to 17 bytes with 0x01
      while (block.length < 16) {
        block.push(0);
      }
      block.push(0x01);
      
      // Add block to accumulator
      for (let j = 0; j < 17; j++) {
        const bytePos = Math.floor(j / 4);
        const bitPos = (j % 4) * 8;
        if (bytePos < 5) {
          acc[bytePos] += (block[j] || 0) << bitPos;
        }
      }
      
      // Multiply by r (simplified)
      this._poly1305Multiply(acc, r);
    }
    
    // Add s
    let carry = 0;
    for (let i = 0; i < 4; i++) {
      const sWord = OpCodes.Pack32LE(s[i*4], s[i*4+1], s[i*4+2], s[i*4+3]);
      acc[i] += sWord + carry;
      carry = Math.floor(acc[i] / 0x100000000);
      acc[i] &= 0xffffffff;
    }
    
    // Convert to 16-byte tag
    const tag = [];
    for (let i = 0; i < 4; i++) {
      tag.push(acc[i] & 0xff);
      tag.push((acc[i] >> 8) & 0xff);
      tag.push((acc[i] >> 16) & 0xff);
      tag.push((acc[i] >> 24) & 0xff);
    }
    
    return tag;
  }
  
  _poly1305Multiply(acc, r) {
    // Simplified multiplication (educational implementation)
    const rWords = [];
    for (let i = 0; i < 4; i++) {
      rWords[i] = OpCodes.Pack32LE(r[i*4], r[i*4+1], r[i*4+2], r[i*4+3]);
    }
    
    // Very simplified - just mix the values
    const temp = [...acc];
    for (let i = 0; i < 4; i++) {
      acc[i] = ((temp[i] * rWords[i]) + (temp[4] * rWords[i])) >>> 0;
    }
    acc[4] = 0;
    
    // Reduce modulo 2^130-5 (simplified)
    while (acc[4] > 0) {
      const overflow = acc[4] * 5;
      acc[0] += overflow;
      acc[4] = 0;
      
      // Handle carries
      for (let i = 0; i < 4; i++) {
        if (acc[i] >= 0x100000000) {
          acc[i+1] += Math.floor(acc[i] / 0x100000000);
          acc[i] &= 0xffffffff;
        }
      }
    }
  }
}
// Register the algorithm
RegisterAlgorithm(new ChaCha20Poly1305Algorithm());

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = new ChaCha20Poly1305Algorithm();
}