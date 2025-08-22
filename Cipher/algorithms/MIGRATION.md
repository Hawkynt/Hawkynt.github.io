# Algorithm Migration Guide

This guide explains how to convert existing algorithms or implement algorithms from other sources to work with the AlgorithmFramework.

## 🎯 Migration Overview

### What We're Building

The AlgorithmFramework provides a **universal, composable architecture** where:

- Each algorithm has a single, focused responsibility
- Algorithms can be chained together (Compression → Padding → Block Cipher → Mode → Error Correction → Encoding)
- Same interface works across all algorithm types
- Cross-platform compatibility (Browser + Node.js)
- Multi-language code generation support

### Migration Types

1. **Legacy Universal Cipher Format** → AlgorithmFramework
2. **Foreign Implementation** (C/C++/Java/Python) → AlgorithmFramework
3. **Research Paper** → AlgorithmFramework Implementation
4. **Broken Algorithm** → Fixed AlgorithmFramework Implementation

## 📋 Pre-Migration Checklist

### 1. Algorithm Analysis

- [ ] **Identify algorithm type** (block, stream, hash, MAC, etc.)
- [ ] **Find official test vectors** (NIST, RFC, original paper)
- [ ] **Understand key/block/output sizes** and constraints
- [ ] **Check for implementation variants** (different parameters, rounds, etc.)
- [ ] **Identify security status** (secure, deprecated, broken, educational)

### 2. Reference Collection

- [ ] **Official specification** (NIST standard, RFC, original paper)
- [ ] **Reference implementations** (OpenSSL, Crypto++, Bouncy Castle, etc.)
- [ ] **Test vectors with sources** (never make up test vectors)
- [ ] **Known vulnerabilities** and security analysis
- [ ] **Algorithm variants** and related algorithms

### 3. Architecture Planning

- [ ] **Single responsibility**: What exactly does this algorithm do?
- [ ] **Dependencies**: Does it need padding, modes, or other algorithms?
- [ ] **Composability**: How will it integrate with other algorithms?
- [ ] **Performance considerations**: Multi-block processing capabilities?

## 🔧 Migration Process

### Step 1: Create Algorithm Skeleton

```javascript
// 1. Load dependencies
if (!global.AlgorithmFramework && typeof require !== 'undefined')
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');

if (!global.OpCodes && typeof require !== 'undefined')
  global.OpCodes = require('../../OpCodes.js');

// 2. Import required classes based on algorithm type
const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

// 3. Create algorithm class
class YourAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata - BE ACCURATE
    this.name = "Algorithm Name";
    this.description = "What the algorithm does. Be factual, not marketing.";
    this.inventor = "Original Creator(s)";
    this.year = 1998; // When published
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL; // Be conservative!
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US; // Where developed
    
    // Define capabilities
    this.SupportedKeySizes = [
      new KeySize(16, 32, 8) // min, max, step
    ];
    this.SupportedBlockSizes = [
      new KeySize(16, 16, 0) // fixed size uses step=0
    ];
    
    // Documentation (specs, papers, analysis)
    this.documentation = [
      new LinkItem("Original Paper", "https://example.com/paper.pdf"),
      new LinkItem("NIST Analysis", "https://nvlpubs.nist.gov/...")
    ];
    
    // References (actual implementations)
    this.references = [
      new LinkItem("OpenSSL", "https://github.com/openssl/openssl/blob/master/crypto/algo.c"),
      new LinkItem("Crypto++", "https://github.com/weidai11/cryptopp/blob/master/algo.cpp")
    ];
    
    // Test vectors - CRITICAL for validation
    this.tests = [
      {
        text: "Official Test Vector #1",
        uri: "https://official-source.com/vectors",
        input: OpCodes.Hex8ToBytes("plaintext"),
        key: OpCodes.Hex8ToBytes("key"),
        expected: OpCodes.Hex8ToBytes("ciphertext")
      }
    ];
  }
  
  CreateInstance(isInverse = false) {
    return new YourAlgorithmInstance(this, isInverse);
  }
}

// 4. Create instance class
class YourAlgorithmInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.inputBuffer = [];
    this.BlockSize = 16;
    this.KeySize = 0;
    this.CanReuseTransform = true;
    this.CanTransformMultipleBlocks = false;
  }
  
  // Implement Feed/Result pattern
  Feed(data) { /* accumulate input */ }
  Result() { /* process and return output */ }
}

// 5. Register immediately
RegisterAlgorithm(new YourAlgorithm());
```

### Step 2: Convert Algorithm Logic

#### From Legacy Universal Format

```javascript
// OLD: Universal Cipher Pattern
const Algorithm = {
  name: 'AES',
  KeySetup: function(key) { /* ... */ },
  EncryptBlock: function(blockIndex, data) { /* ... */ },
  DecryptBlock: function(blockIndex, data) { /* ... */ }
};

// NEW: AlgorithmFramework Pattern
class AesInstance extends IBlockCipherInstance {
  set key(keyBytes) { 
    // Convert KeySetup logic here
  }
  
  Feed(data) { 
    this.inputBuffer.push(...data); 
  }
  
  Result() {
    // Convert EncryptBlock/DecryptBlock logic here
    const output = this.isInverse 
      ? this._decryptBlock(this.inputBuffer)
      : this._encryptBlock(this.inputBuffer);
    this.inputBuffer = [];
    return output;
  }
}
```

#### From Foreign Implementation

```c
// C Implementation Example
void aes_encrypt(const uint8_t *key, const uint8_t *plaintext, uint8_t *ciphertext) {
    // Key schedule
    uint32_t round_keys[44];
    key_expansion(key, round_keys);
    
    // Encryption rounds
    add_round_key(plaintext, round_keys);
    for (int round = 1; round < 10; round++) {
        sub_bytes();
        shift_rows();
        mix_columns();
        add_round_key(round_keys + 4*round);
    }
    // Final round...
}
```

```javascript
// JavaScript AlgorithmFramework Version
class AesInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this._roundKeys = null;
    this._state = null; // Holds the transformed block
    this.BlockSize = 16;
    this.KeySize = 0;
    this.CanReuseTransform = false;  // Instance cannot be reused
    this.CanTransformMultipleBlocks = false;
  }
  
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this._roundKeys = null;
      this.KeySize = 0;
      return;
    }
    
    // Validate key size
    if (keyBytes.length !== 16 && keyBytes.length !== 24 && keyBytes.length !== 32)
      throw new Error(`Invalid AES key size: ${keyBytes.length} bytes`);
      
    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    this._roundKeys = this._keyExpansion(keyBytes);
  }
  
  get key() {
    return this._key ? [...this._key] : null;
  }
  
  Feed(data) {
    if (!data || data.length === 0)
      return;
    if (!this.key)
      throw new Error("Key not set");
    if (data.length !== this.BlockSize)
      throw new Error(`AES requires exactly ${this.BlockSize} bytes, got ${data.length}`);
      
    // Transform the block immediately and store in internal state
    this._state = this.isInverse 
      ? this._decryptBlock(data)
      : this._encryptBlock(data);
  }
  
  Result() {
    if (!this.key)
      throw new Error("Key not set");
    if (!this._state)
      throw new Error("No data fed");
      
    // Return the transformed state
    return [...this._state];
  }
  
_encryptBlock(block) {
    let state = [...block];
    
    this._addRoundKey(state, this._roundKeys, 0);
    const rounds = this._getRounds();
    
    for (let round = 1; round < rounds; ++round) {
      this._subBytes(state);
      this._shiftRows(state);
      this._mixColumns(state);
      this._addRoundKey(state, this._roundKeys, round);
    }
    
    // Final round (no MixColumns)
    this._subBytes(state);
    this._shiftRows(state);
    this._addRoundKey(state, this._roundKeys, rounds);
    
    return state;
  }
  
  _decryptBlock(block) {
    let state = [...block];
    const rounds = this._getRounds();
    
    this._addRoundKey(state, this._roundKeys, rounds);
    
    for (let round = rounds - 1; round > 0; --round) {
      this._invShiftRows(state);
      this._invSubBytes(state);
      this._addRoundKey(state, this._roundKeys, round);
      this._invMixColumns(state);
    }
    
    // Final round
    this._invShiftRows(state);
    this._invSubBytes(state);
    this._addRoundKey(state, this._roundKeys, 0);
    
    return state;
  }
  
  _getRounds() {
    switch (this.KeySize) {
      case 16: return 10; // AES-128
      case 24: return 12; // AES-192
      case 32: return 14; // AES-256
      default: throw new Error(`Invalid key size: ${this.KeySize}`);
    }
  }
  
  _keyExpansion(key) {
    // Convert C key expansion logic using OpCodes
    const keyWords = this.KeySize / 4;
    const rounds = this._getRounds();
    const roundKeys = new Array((rounds + 1) * 4);
    
    // Copy original key
    for (let i = 0; i < keyWords; ++i) {
      roundKeys[i] = OpCodes.Pack32BE(
        key[4*i], key[4*i+1], key[4*i+2], key[4*i+3]
      );
    }
    
    // Generate round keys using OpCodes operations
    for (let i = keyWords; i < roundKeys.length; ++i) {
      let temp = roundKeys[i - 1];
      
      if (i % keyWords === 0) {
        temp = this._subWord(OpCodes.RotL32(temp, 8)) ^ this._rcon(i / keyWords);
      } else if (keyWords > 6 && i % keyWords === 4) {
        temp = this._subWord(temp);
      }
      
      roundKeys[i] = roundKeys[i - keyWords] ^ temp;
    }
    
    return roundKeys;
  }
  
  // Helper methods using OpCodes
  _subBytes(state) {
    for (let i = 0; i < 16; ++i)
      state[i] = this._sBox[state[i]];
  }
  
  _addRoundKey(state, roundKeys, round) {
    for (let i = 0; i < 4; ++i) {
      const keyWord = roundKeys[round * 4 + i];
      const keyBytes = OpCodes.Unpack32BE(keyWord);
      for (let j = 0; j < 4; ++j)
        state[i * 4 + j] ^= keyBytes[j];
    }
  }
  
  // ... other AES operations using OpCodes
}
```

### Step 3: Use OpCodes Library

**CRITICAL**: Always use OpCodes for cryptographic operations:

```javascript
// ❌ DON'T: Direct bit manipulation
const rotated = (value << 8) | (value >>> 24);
const packed = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;

// ✅ DO: Use OpCodes
const rotated = OpCodes.RotL32(value, 8);
const packed = OpCodes.Pack32BE(b0, b1, b2, b3);

// ✅ Common OpCodes operations
OpCodes.RotL32(value, positions)     // 32-bit left rotation
OpCodes.RotR32(value, positions)     // 32-bit right rotation
OpCodes.Pack32BE(b0, b1, b2, b3)     // Pack bytes to 32-bit (big-endian)
OpCodes.Pack32LE(b0, b1, b2, b3)     // Pack bytes to 32-bit (little-endian)
OpCodes.Unpack32BE(word)             // Unpack 32-bit to bytes (big-endian)
OpCodes.Unpack32LE(word)             // Unpack 32-bit to bytes (little-endian)
OpCodes.XorBytes(array1, array2)     // XOR byte arrays
OpCodes.Hex8ToBytes(hexString)       // Convert hex to bytes
OpCodes.AnsiToBytes(string)          // Convert ASCII to bytes
OpCodes.SecureCompare(a, b)          // Constant-time comparison
OpCodes.ClearArray(array)            // Secure memory clearing
```

### Step 4: Implement Feed/Result Pattern

```javascript
class YourAlgorithmInstance extends IBlockCipherInstance {
  Feed(data) {
    if (!data || data.length === 0)
      return;
    if (!this.key)
      throw new Error("Key not set");
      
    this.inputBuffer.push(...data);
  }
  
  Result() {
    if (!this.key)
      throw new Error("Key not set");
    if (this.inputBuffer.length === 0)
      throw new Error("No data fed");
    
    // Validate input based on capabilities
    if (this.CanTransformMultipleBlocks) {
      if (this.inputBuffer.length % this.BlockSize !== 0)
        throw new Error(`Input must be multiple of ${this.BlockSize} bytes`);
    } else {
      if (this.inputBuffer.length !== this.BlockSize)
        throw new Error(`Input must be exactly ${this.BlockSize} bytes`);
    }
    
    // Process the data
    const output = this._processData(this.inputBuffer);
    
    // Clear for next operation
    this.inputBuffer = [];
    return output;
  }
}
```

### Example 2: Converting Hash Function (C to JavaScript)

Hash functions typically use TransformBlock/Finalize pattern. Here's how to convert to Feed/Result:

```c
// Original C hash implementation (SHA-256 style)
typedef struct {
    uint32_t state[8];
    uint8_t buffer[64];
    size_t buffer_len;
    uint64_t total_len;
} sha256_ctx;

void sha256_init(sha256_ctx *ctx) {
    ctx->state[0] = 0x6a09e667;
    ctx->state[1] = 0xbb67ae85;
    // ... initialize state
    ctx->buffer_len = 0;
    ctx->total_len = 0;
}

void sha256_update(sha256_ctx *ctx, const uint8_t *data, size_t len) {
    // Process complete blocks
    while (len >= 64) {
        sha256_transform(ctx->state, data);
        data += 64;
        len -= 64;
        ctx->total_len += 64;
    }
    
    // Buffer remaining bytes
    memcpy(ctx->buffer + ctx->buffer_len, data, len);
    ctx->buffer_len += len;
    ctx->total_len += len;
}

void sha256_final(sha256_ctx *ctx, uint8_t *hash) {
    // Add padding and length, transform final blocks
    // Extract 32 bytes from state
    for (int i = 0; i < 8; ++i) {
        hash[i*4 + 0] = (ctx->state[i] >> 24) & 0xff;
        hash[i*4 + 1] = (ctx->state[i] >> 16) & 0xff;
        hash[i*4 + 2] = (ctx->state[i] >> 8) & 0xff;
        hash[i*4 + 3] = ctx->state[i] & 0xff;
    }
}
```

```javascript
// JavaScript AlgorithmFramework Version
class Sha256Instance extends IHashInstance {
  constructor(algorithm) {
    super(algorithm);
    this._state = new Array(8);
    this._buffer = [];
    this._totalLength = 0;
    this.HashSize = 32;
    this.BlockSize = 64;
    this.CanReuseTransform = false;  // Hash instances are single-use
    this._initialize();
  }
  
  _initialize() {
    // Initialize SHA-256 state using OpCodes
    this._state[0] = 0x6a09e667;
    this._state[1] = 0xbb67ae85;
    this._state[2] = 0x3c6ef372;
    this._state[3] = 0xa54ff53a;
    this._state[4] = 0x510e527f;
    this._state[5] = 0x9b05688c;
    this._state[6] = 0x1f83d9ab;
    this._state[7] = 0x5be0cd19;
    this._buffer = [];
    this._totalLength = 0;
  }
  
  Feed(data) {
    if (!data || data.length === 0)
      return;
      
    this._totalLength += data.length;
    this._buffer.push(...data);
    
    // Process complete blocks immediately
    while (this._buffer.length >= this.BlockSize) {
      const block = this._buffer.splice(0, this.BlockSize);
      this._transformBlock(block);
    }
  }
  
  Result() {
    // Apply padding and process final block(s)
    this._finalize();
    
    // Extract hash from state using OpCodes
    const hash = new Array(this.HashSize);
    for (let i = 0; i < 8; ++i) {
      const bytes = OpCodes.Unpack32BE(this._state[i]);
      hash[i * 4 + 0] = bytes[0];
      hash[i * 4 + 1] = bytes[1];
      hash[i * 4 + 2] = bytes[2];
      hash[i * 4 + 3] = bytes[3];
    }
    
    return hash;
  }
  
  _transformBlock(block) {
    // SHA-256 compression function using OpCodes
    const w = new Array(64);
    
    // Prepare message schedule
    for (let i = 0; i < 16; ++i)
      w[i] = OpCodes.Pack32BE(block[i*4], block[i*4+1], block[i*4+2], block[i*4+3]);
      
    for (let i = 16; i < 64; ++i) {
      const s0 = OpCodes.XorArrays([
        OpCodes.RotR32(w[i-15], 7),
        OpCodes.RotR32(w[i-15], 18),
        w[i-15] >>> 3
      ]);
      const s1 = OpCodes.XorArrays([
        OpCodes.RotR32(w[i-2], 17),
        OpCodes.RotR32(w[i-2], 19), 
        w[i-2] >>> 10
      ]);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }
    
    // Compression rounds using OpCodes operations
    let [a, b, c, d, e, f, g, h] = this._state;
    
    for (let i = 0; i < 64; ++i) {
      const S1 = OpCodes.XorArrays([
        OpCodes.RotR32(e, 6),
        OpCodes.RotR32(e, 11),
        OpCodes.RotR32(e, 25)
      ]);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + this._k[i] + w[i]) >>> 0;
      
      const S0 = OpCodes.XorArrays([
        OpCodes.RotR32(a, 2),
        OpCodes.RotR32(a, 13),
        OpCodes.RotR32(a, 22)
      ]);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      
      h = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }
    
    // Add to state
    this._state[0] = (this._state[0] + a) >>> 0;
    this._state[1] = (this._state[1] + b) >>> 0;
    this._state[2] = (this._state[2] + c) >>> 0;
    this._state[3] = (this._state[3] + d) >>> 0;
    this._state[4] = (this._state[4] + e) >>> 0;
    this._state[5] = (this._state[5] + f) >>> 0;
    this._state[6] = (this._state[6] + g) >>> 0;
    this._state[7] = (this._state[7] + h) >>> 0;
  }
  
  _finalize() {
    const bitLength = this._totalLength * 8;
    
    // Add padding: 0x80 followed by zeros
    this._buffer.push(0x80);
    
    // Pad to 56 bytes (leave 8 bytes for length)
    while (this._buffer.length % 64 !== 56)
      this._buffer.push(0x00);
      
    // Append length as 64-bit big-endian
    const lengthBytes = OpCodes.Unpack64BE(bitLength);
    this._buffer.push(...lengthBytes);
    
    // Process final block
    if (this._buffer.length === 64) {
      this._transformBlock(this._buffer);
      this._buffer = [];
    }
  }
}
```

## ✅ Testing & Validation

### 1. Unit Testing

```javascript
// Create test script in .agent.tmp/
const algorithm = global.AlgorithmFramework.Algorithms.find(a => a.name === 'Your Algorithm');

// Test basic functionality
const instance = algorithm.CreateInstance(false);
instance.key = OpCodes.Hex8ToBytes("key");
instance.Feed(OpCodes.Hex8ToBytes("plaintext"));
const result = instance.Result();

// Test round-trip
const decryptInstance = algorithm.CreateInstance(true);
decryptInstance.key = instance.key;
decryptInstance.Feed(result);
const decrypted = decryptInstance.Result();

console.log('Round-trip success:', 
  decrypted.every((b, i) => b === plaintext[i]));
```

### 2. Test Suite Validation

```bash
# Test single algorithm
node tests/TestSuite.js your-algorithm.js --verbose

# Full test suite
node tests/TestSuite.js --verbose
```

### 3. Cross-Reference Validation

Always validate against multiple sources:

- Official test vectors
- Reference implementations (OpenSSL, etc.)
- Other educational implementations
- Known answer tests from specifications

## ⚠️ Common Migration Pitfalls

### 1. Security Status Mistakes

```javascript
// ❌ WRONG: Never claim "secure"
this.securityStatus = SecurityStatus.SECURE;

// ✅ CORRECT: Be conservative
this.securityStatus = SecurityStatus.EDUCATIONAL;
this.securityStatus = SecurityStatus.BROKEN;
this.securityStatus = null; // Not yet analyzed
```

### 2. Test Vector Issues

```javascript
// ❌ WRONG: Made up test vectors
this.tests = [{
  text: "My test vector",
  input: OpCodes.Hex8ToBytes("1234"),
  expected: OpCodes.Hex8ToBytes("abcd") // NO!
}];

// ✅ CORRECT: Official test vectors
this.tests = [{
  text: "NIST SP 800-38A Vector #1",
  uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/...",
  input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
  key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
  expected: OpCodes.Hex8ToBytes("3ad77bb40d7a3660a89ecaf32466ef97")
}];
```

### 3. Scope Confusion

```javascript
// ❌ WRONG: Block cipher doing padding
class AesInstance extends IBlockCipherInstance {
  Result() {
    // Add PKCS#7 padding - NO! This belongs in padding algorithm
    if (this.inputBuffer.length % 16 !== 0) {
      const padding = 16 - (this.inputBuffer.length % 16);
      for (let i = 0; i < padding; ++i)
        this.inputBuffer.push(padding);
    }
  }
}

// ✅ CORRECT: Block cipher only processes complete blocks
class AesInstance extends IBlockCipherInstance {
  Result() {
    if (this.inputBuffer.length !== this.BlockSize)
      throw new Error(`AES requires exactly ${this.BlockSize} bytes`);
    // Process single block only
  }
}
```

### 4. OpCodes Avoidance

```javascript
// ❌ WRONG: Manual bit operations
const s0 = ((w >>> 7) | (w << 25)) >>> 0;
const s1 = ((w >>> 18) | (w << 14)) >>> 0;

// ✅ CORRECT: Use OpCodes
const s0 = OpCodes.RotR32(w, 7);
const s1 = OpCodes.RotR32(w, 18);
```

## 📊 Quality Standards

### Algorithm Implementation Quality

- [ ] **All OpCodes used** for cryptographic operations
- [ ] **Official test vectors** with source attribution
- [ ] **Round-trip testing** passes (encrypt → decrypt = original)
- [ ] **Error handling** for invalid inputs
- [ ] **Memory security** using OpCodes.ClearArray() where appropriate
- [ ] **Performance considered** (CanTransformMultipleBlocks, CanReuseTransform)

### Code Quality Standards

- [ ] **JSDoc documentation** with type annotations
- [ ] **K&R bracket style** with 2-space indentation
- [ ] **Prefix increment** (++i) in loops
- [ ] **Omitted braces** for single-statement conditionals
- [ ] **Descriptive variable names** following conventions
- [ ] **Proper error messages** with context

### Metadata Quality

- [ ] **Accurate algorithm information** (inventor, year, country)
- [ ] **Honest security assessment** (never claim "secure")
- [ ] **Complete documentation links** to specifications
- [ ] **Reference implementation links** to source code
- [ ] **Known vulnerabilities** documented if applicable
- [ ] **Algorithm variants** and related algorithms noted

## 🔍 Migration Examples

### Example 1: Legacy Block Cipher

```javascript
// BEFORE: Universal Cipher Format
(function(global) {
  const TEA = {
    name: 'TEA',
    KeySetup: function(key) {
      this.key = key;
    },
    EncryptBlock: function(blockIndex, data) {
      // TEA encryption logic
      return encryptedData;
    }
  };
  global.Cipher.Add(TEA);
})(typeof global !== 'undefined' ? global : window);

// AFTER: AlgorithmFramework
class TeaAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    this.name = "TEA (Tiny Encryption Algorithm)";
    this.description = "Simple Feistel cipher for educational purposes.";
    // ... proper metadata
  }
  
  CreateInstance(isInverse = false) {
    return new TeaInstance(this, isInverse);
  }
}

class TeaInstance extends IBlockCipherInstance {
  // ... proper Feed/Result implementation
}

RegisterAlgorithm(new TeaAlgorithm());
```

### Example 2: Research Paper Implementation

``` plaintext
Paper: "NewCipher: A Novel Symmetric Encryption Algorithm"
Source: Academic conference, test vectors in appendix
```

```javascript
class NewCipher extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    this.name = "NewCipher";
    this.description = "Novel symmetric encryption from 2023 research paper.";
    this.inventor = "Smith, Jones, Brown";
    this.year = 2023;
    this.securityStatus = SecurityStatus.EXPERIMENTAL; // Research phase
    this.complexity = ComplexityType.RESEARCH;
    
    this.documentation = [
      new LinkItem("Original Paper", "https://conference.com/newcipher2023.pdf"),
      new LinkItem("Extended Analysis", "https://eprint.iacr.org/...")
    ];
    
    // Use test vectors from paper appendix
    this.tests = [
      {
        text: "Paper Test Vector A.1",
        uri: "https://conference.com/newcipher2023.pdf (Appendix A)",
        input: OpCodes.Hex8ToBytes("..."), // From paper
        key: OpCodes.Hex8ToBytes("..."),   // From paper
        expected: OpCodes.Hex8ToBytes("...") // From paper
      }
    ];
  }
}
```

## 📝 Migration Checklist

### Pre-Implementation

- [ ] Algorithm type identified and appropriate base class selected
- [ ] Official test vectors located with source URLs
- [ ] Reference implementations found for comparison
- [ ] Security status honestly assessed
- [ ] Algorithm scope clearly defined (no padding/mode mixing)

### Implementation

- [ ] Algorithm and instance classes created
- [ ] All cryptographic operations use OpCodes
- [ ] Feed/Result pattern correctly implemented
- [ ] Error handling for invalid inputs
- [ ] Capability flags set appropriately
- [ ] JSDoc documentation added

### Testing

- [ ] All test vectors pass
- [ ] Round-trip testing succeeds
- [ ] TestSuite.js passes without errors
- [ ] Cross-reference validation against other implementations
- [ ] Edge cases tested (empty input, wrong key size, etc.)

### Documentation

- [ ] Accurate metadata (name, inventor, year, country)
- [ ] Conservative security status
- [ ] Complete documentation and reference links
- [ ] Known vulnerabilities documented
- [ ] Algorithm description factual and concise

### Quality Assurance

- [ ] Code follows project style guidelines
- [ ] No hardcoded magic numbers without explanation
- [ ] Memory cleared securely where appropriate
- [ ] Performance considerations documented
- [ ] Integration with other algorithms tested

## 🎓 Best Practices Summary

1. **Start with test vectors** - implement tests first, then make them pass
2. **Use OpCodes exclusively** - never do manual bit manipulation
3. **Be conservative with security claims** - when in doubt, mark as educational
4. **Focus on single responsibility** - block ciphers only do block operations
5. **Document everything** - future maintainers will thank you
6. **Test extensively** - official vectors, cross-references, round-trips
7. **Follow the patterns** - look at existing implementations for guidance

Remember: The goal is not just working code, but **maintainable, composable, and educationally valuable** implementations that demonstrate cryptographic principles clearly.
