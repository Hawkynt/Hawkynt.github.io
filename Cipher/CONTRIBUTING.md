# Algorithm Implementation Guidelines

## 🏗️ Architecture Overview

We are designing a clean, interface architecture for maximum usability and consistency. This document outlines the system we're building toward.

The user wants to:
* implement different kinds of algorithms in a meaningful hierarchical structure (symmetric/asymmetric block/stream ciphers, rngs, kdfs, paddingschemes, modes of operation, hashes/checksums, compression, encoding, errorcorrection, authentication, aead)
* register all algorithm instances in a global list (IAlgorithm)
* can inspect metadata of all algorithms in the list
* have an algorithm instance implement some members that do transformations based on default parameter configurations
* have algorithms to CreateInstance (IAlgorithmInstance) where he can modify properties
* use said instance to do transformations
* wrap multiple transformations around another e.g. EncodingAlgorithmInstance(ErrorCorrectionAlgorithmInstance(ModeAlgorithmInstance(PaddingAlgorithmInstance(CipherAlgorithmInstance(CompressionAlgorithmInstance(Data))))))
* want arbitrary nesting like Cipher1(Padding1(Cipher2(Padding2(data)))) and Hash1(Hash2(data))
* may want to do Cipher2(Padding2(Mode1(Cipher1(Padding1(data),Kdf(key1)),Prng(key1))),Hash(key2))
* process arbitrary length stream of bytes (IEnumerable<byte>)
* want the class design work in multiple languages, like JavaScript, C#, Perl, Python, PHP, Ruby, LUA, Rust, C++, FreeBASIC, Delphi
* dont pollute everything with public classes, but keep it as closed as possible, e.g. AesInstance is nested in AesAlgorithm and can only be created by its CreateInstance

```mermaid
classDiagram

%% ===== Core value objects =====
class LinkItem {
  +string text
  +string uri
}

class TestCase {
  +byte[] input      %% mandatory
  +byte[] expected   %% mandatory
  %% duck-typed extras: key, iv, nonce, aad, tag, seed, erasures, etc.
}
TestCase --|> LinkItem

class Vulnerability {
  +string type
  +string mitigation
  %% duck-typed extras: severity, cwe, disclosureDate, etc.
}
Vulnerability --|> LinkItem

%% ===== Auth result =====
class AuthResult {
  +bool Success
  +string? FailureReason
  +byte[]? Output
}

%% ==== Core Interfaces ====
class IAlgorithmInstance {
  <<interface>>
  +Algorithm algorithm
  +void Feed(byte[] data)
  +byte[] Result()
}

%% ===== Algorithm base =====
class Algorithm {
  <<abstract>>
  +string name
  +string description
  +string inventor
  +short? year
  +CategoryType category
  +string subCategory
  +SecurityStatus securityStatus
  +ComplexityType complexity
  +CountryCode country

  +LinkItem[] documentation
  +LinkItem[] references
  +Vulnerability[] knownVulnerabilities
  +TestCase[] tests

  +IAlgorithmInstance CreateInstance(bool isInverse)
}

Algorithm "1" --> "0..*" LinkItem : documentation
Algorithm "1" --> "0..*" Vulnerability : vulnerabilities
Algorithm "1" --> "0..*" TestCase : tests

%% ==== Specialized Algorithm Families ====
Algorithm <|-- CryptoAlgorithm
Algorithm <|-- EncodingAlgorithm
Algorithm <|-- CompressionAlgorithm
Algorithm <|-- ErrorCorrectionAlgorithm
Algorithm <|-- HashFunctionAlgorithm
Algorithm <|-- MacAlgorithm
Algorithm <|-- KdfAlgorithm
Algorithm <|-- PaddingAlgorithm
Algorithm <|-- CipherModeAlgorithm
Algorithm <|-- AeadAlgorithm
Algorithm <|-- RandomGenerationAlgorithm

%% ==== Crypto Subtypes ====
CryptoAlgorithm <|-- SymmetricCipherAlgorithm
CryptoAlgorithm <|-- AsymmetricCipherAlgorithm

SymmetricCipherAlgorithm <|-- BlockCipherAlgorithm
SymmetricCipherAlgorithm <|-- StreamCipherAlgorithm

%% ==== Instance Subtypes ====
IAlgorithmInstance <|-- IBlockCipherInstance
IAlgorithmInstance <|-- IHashFunctionInstance
IAlgorithmInstance <|-- IMacInstance
IAlgorithmInstance <|-- IKdfInstance
IAlgorithmInstance <|-- IAeadInstance
IAlgorithmInstance <|-- IErrorCorrectionInstance
IAlgorithmInstance <|-- IRandomGeneratorInstance

%% ===== Crypto metadata & capabilities =====
class KeySize {
  +word minSize
  +word maxSize
  +word stepSize
}

class BlockCipherAlgorithm {
  +KeySize[] SupportedKeySizes
  +KeySize[] SupportedBlockSizes
}
BlockCipherAlgorithm --|> SymmetricCipherAlgorithm

class HashFunctionAlgorithm {
  +KeySize[] SupportedOutputSizes
}
HashFunctionAlgorithm --|> Algorithm

class KdfAlgorithm {
  +KeySize[] SupportedOutputSizes
  +bool SaltRequired
}
KdfAlgorithm --|> Algorithm

class AeadAlgorithm {
  +KeySize[] SupportedTagSizes
  +bool SupportsDetached
}
AeadAlgorithm --|> CryptoAlgorithm

class MacAlgorithm {
  +KeySize[] SupportedMacSizes
  +bool NeedsKey
}
MacAlgorithm --|> Algorithm

class PaddingAlgorithm {
  +bool IsLengthIncluded
}
PaddingAlgorithm --|> Algorithm

class CipherModeAlgorithm {
  +bool RequiresIV
  +KeySize[] SupportedIVSizes
}
CipherModeAlgorithm --|> Algorithm

class RandomGenerationAlgorithm {
  +bool IsDeterministic
  +bool IsCryptographicallySecure
  +KeySize[] SupportedSeedSizes
}
RandomGenerationAlgorithm --|> Algorithm

%% ===== Instance methods =====
class IBlockCipherInstance {
  <<interface>>
  +word BlockSize
  +word KeySize
}

class IHashFunctionInstance {
  <<interface>>
  +word OutputSize
}

class IMacInstance {
  <<interface>>
  +byte[] ComputeMac(byte[] data)
}

class IKdfInstance {
  <<interface>>
  +word OutputSize
  +qword Iterations
}

class IAeadInstance {
  <<interface>>
  byte[] aad
  word tagSize
}

class IErrorCorrectionInstance {
  <<interface>>
  +bool DetectError(byte[] input)
}

class IRandomGeneratorInstance {
  <<interface>>
  +byte[] NextBytes(word count)
}

```

## 📋 Metadata Requirements

It is important that we know the name of the algorithm we have at hand and that we can read us into it by examining descriptions, papers and reference sources. To verify that it works, we also need tests. When it is broken, we need proof to, thats what the vulnerabilities field is for.

## 🔧 Current Implementation Guidelines

### Direct Enum Assignment
Always use direct enum object assignment for metadata properties:

### Available Enum Values

**Categories:**
- `CategoryType.ASYMMETRIC` - Public-key cryptography algorithms
- `CategoryType.BLOCK` - Block-based symmetric encryption
- `CategoryType.STREAM` - Stream-based symmetric encryption
- `CategoryType.HASH` - Cryptographic hash algorithms
- `CategoryType.CHECKSUM` - Checksum and integrity verification algorithms
- `CategoryType.COMPRESSION` - Data compression algorithms
- `CategoryType.ENCODING` - Data encoding and representation
- `CategoryType.CLASSICAL` - Historical and educational ciphers
- `CategoryType.MAC` - Message authentication codes
- `CategoryType.KDF` - Key derivation and stretching functions
- `CategoryType.ECC` - Error correction codes
- `CategoryType.MODE` - Block cipher modes of operation
- `CategoryType.PADDING` - Data padding algorithms
- `CategoryType.AEAD` - Authenticated encryption with associated data
- `CategoryType.SPECIAL` - Special purpose algorithms
- `CategoryType.PQC` - Quantum-resistant cryptographic algorithms
- `CategoryType.RANDOM` - Pseudo-random number generators

### SubCategory Examples by Category

**ASYMMETRIC:**
- "Public Key Encryption" - RSA, ECC-based encryption
- "Digital Signatures" - RSA signatures, ECDSA, EdDSA
- "Key Exchange" - Diffie-Hellman, ECDH
- "Post-Quantum" - Lattice-based, code-based algorithms

**BLOCK:**
- "Block Cipher" - AES, DES, Blowfish, etc.
- "Lightweight" - PRESENT, Simon, Speck
- "National Standards" - GOST, SM4, Camellia

**STREAM:**
- "Stream Cipher" - RC4, ChaCha20, Salsa20
- "Synchronous" - LFSR-based ciphers
- "Self-Synchronizing" - CFB mode stream ciphers

**HASH:**
- "Cryptographic Hash" - SHA family, BLAKE, etc.
- "Fast Hash" - xxHash, MurmurHash, etc.

**CHECKSUM:**
- "Error Detection" - CRC32, Adler32, Fletcher
- "Simple Checksums" - Parity, XOR checksums

**COMPRESSION:**
- "Dictionary" - LZ77, LZW, etc.
- "Statistical" - Huffman, Arithmetic, etc.
- "Modern" - Brotli, Zstandard, etc.

**ENCODING:**
- "Base Encoding" - Base64, Base32, etc.
- "Character Encoding" - ASCII variants, EBCDIC

**CLASSICAL:**
- "Substitution" - Caesar, Atbash, Simple substitution
- "Transposition" - Rail fence, Columnar transposition
- "Polyalphabetic" - Vigenère, Playfair, Enigma

**MAC:**
- "HMAC" - HMAC-SHA family
- "CMAC" - CMAC-AES, OMAC
- "Universal Hash" - Poly1305, GHASH

**KDF:**
- "Password-Based" - PBKDF2, scrypt, Argon2
- "Key Stretching" - bcrypt, HKDF
- "Random Oracle" - MGF1, SHAKE

**ECC:**
- "Block Codes" - Hamming, BCH, Reed-Solomon
- "Convolutional" - Turbo codes, LDPC
- "Modern" - Fountain codes, Raptor codes

**MODE:**
- "Confidentiality" - ECB, CBC, CTR, OFB, CFB
- "Authenticated" - GCM, CCM, EAX, OCB
- "Disk Encryption" - XTS, LRW

**PADDING:**
- "Block Padding" - PKCS#7, ISO 10126, ANSI X9.23
- "Signature Padding" - PSS, PKCS#1, ISO/IEC 9796

**AEAD:**
- "GCM Family" - AES-GCM, ChaCha20-Poly1305
- "OCB Family" - OCB1, OCB2, OCB3
- "CCM Family" - AES-CCM, Camellia-CCM

**SPECIAL:**
- "Format Preserving" - FF1, FF3-1
- "Homomorphic" - Paillier, BGV, CKKS
- "Zero Knowledge" - zk-SNARKs, Bulletproofs

**PQC:**
- "Lattice-Based" - Kyber, Dilithium, NTRU
- "Code-Based" - Classic McEliece, BIKE
- "Multivariate" - Rainbow, GeMSS
- "Hash-Based" - SPHINCS+, XMSS

**RANDOM:**
- "Hardware RNG" - Hardware-based entropy sources
- "PRNG" - Linear congruential, Mersenne Twister
- "CSRNG" - Cryptographically strong PRNGs
- "Stream Cipher RNG" - ChaCha20-based, RC4-based

## **Security Status:**
- `SecurityStatus.SECURE` - Currently considered cryptographically secure
- `SecurityStatus.DEPRECATED` - Still secure but deprecated/being phased out  
- `SecurityStatus.BROKEN` - Cryptographically broken, unsafe for production
- `SecurityStatus.OBSOLETE` - Completely obsolete, historical interest only
- `SecurityStatus.EXPERIMENTAL` - Research phase, security not established
- `SecurityStatus.EDUCATIONAL` - Educational purposes only, not for production

**Countries:** `CountryCode.US`, `CountryCode.RU`, `CountryCode.CN`, `CountryCode.DE`, `CountryCode.GB`, `CountryCode.FR`, `CountryCode.JP`, `CountryCode.KR`, `CountryCode.IL`, `CountryCode.BE`, `CountryCode.CA`, `CountryCode.AU`, `CountryCode.IT`, `CountryCode.NL`, `CountryCode.CH`, `CountryCode.SE`, `CountryCode.NO`, `CountryCode.IN`, `CountryCode.BR`, `CountryCode.UA`, `CountryCode.INTL`, `CountryCode.ANCIENT`, `CountryCode.UNKNOWN`, etc.

**Complexity:** `ComplexityType.BEGINNER`, `ComplexityType.INTERMEDIATE`, `ComplexityType.ADVANCED`, `ComplexityType.EXPERT`, `ComplexityType.RESEARCH`

## 🎯 Coding Standards

### Naming Conventions
- **PascalCase** for methods: `EncryptBlock()`, `DecryptBlock()`, `ComputeHash()`
- **camelCase** for fields: `blockSize`, `keySize`, `roundCount`  
- **underscore prefix** for private: `_keySchedule`, `_roundKeys`, `_CompressRound()`

## ⚠️ Critical Security Guidelines

### Security Status Rules
- **NEVER** set `securityStatus` to `SecurityStatus.SECURE` unless absolutely certain
- **Prefer**: `SecurityStatus.BROKEN`, `SecurityStatus.EDUCATIONAL`, `SecurityStatus.EXPERIMENTAL`, or `null`
- `null` means "not yet broken or thoroughly analyzed" - this is the safest default
- `SecurityStatus.EDUCATIONAL` means "for learning purposes only"
- `SecurityStatus.BROKEN` means "known vulnerabilities, should not be used in production"
- `SecurityStatus.EXPERIMENTAL` means "research implementation without thorough analysis"

### Why We Don't Claim "Secure"
- Cryptographic security is constantly evolving
- New attacks are discovered regularly  
- We are implementers, not cryptanalysts
- Making security claims creates liability and false confidence

## Test Vector Guidelines

### Always Include Sources
- Link to official test vectors when available
- NIST, RFC, or original paper sources preferred
- Never make up test vectors
- Always start implementation with the test-vectors so you have something to check against.

### Use Proper Format

**The AlgorithmFramework automatically processes and validates test vectors when you register an algorithm.**

You can use either format - the framework will convert plain objects to TestCase objects:

**Option 1: Plain test objects (Recommended for simplicity):**
```javascript
this.tests = [
    {
        text: "NIST SP 800-38A Vector #1",
        uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf",
        input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
        key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
        expected: OpCodes.Hex8ToBytes("3ad77bb40d7a3660a89ecaf32466ef97")
    },
    {
        text: "Another test vector",
        uri: "https://nvlpubs.nist.gov/...",
        input: OpCodes.Hex8ToBytes("ae2d8a571e03ac9c9eb76fac45af8e51"),
        key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
        iv: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        expected: OpCodes.Hex8ToBytes("f5d3d58503b9699de785895a96fdbaaf")
    }
];
```

**Option 2: TestCase objects (More explicit):**
```javascript
this.tests = [
    new TestCase(
        OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"), // input
        OpCodes.Hex8ToBytes("3ad77bb40d7a3660a89ecaf32466ef97"), // expected
        "NIST SP 800-38A Vector #1",                              // description
        "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/..."         // source URI
    )
];

// Additional properties can be added after construction
this.tests[0].key = OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c");

### Hash Function Tests
```javascript
this.tests = [
    {
        text: "Empty string hash",
        uri: "https://tools.ietf.org/rfc/rfc...",
        input: OpCodes.AnsiToBytes(""), 
        expected: OpCodes.Hex8ToBytes("e3b0c44298fc1c149afbf4c8996fb924")
    },
    {
        text: "Simple string hash",
        uri: "https://tools.ietf.org/rfc/rfc...",
        input: OpCodes.AnsiToBytes("abc"),
        expected: OpCodes.Hex8ToBytes("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    }
];
```

### Variable Output Tests (for algorithms like SHAKE)
```javascript
this.tests = [
    {
        text: "SHAKE128 32-byte output",
        uri: "https://nvlpubs.nist.gov/...",
        input: OpCodes.AnsiToBytes("Hello World"),
        outputSize: 32, // Specify desired output length
        expected: OpCodes.Hex8ToBytes("46b9dd2b0ba88d13233b3feb743eeb24...")
    },
    {
        text: "SHAKE128 64-byte output",  
        uri: "https://nvlpubs.nist.gov/...",
        input: OpCodes.AnsiToBytes("Hello World"),
        outputSize: 64,
        expected: OpCodes.Hex8ToBytes("46b9dd2b0ba88d13233b3feb743eeb24...")
    }
];
```

**✅ Framework Benefits:**
- Automatically converts plain objects to TestCase objects
- Validates that `input` and `expected` are present and valid
- Ensures test vectors are properly formatted
- Throws helpful error messages for invalid test data
- Prevents duplicate algorithm registration
```javascript
[
    {
        text: "SHAKE128 32-byte output",
        uri: "https://nvlpubs.nist.gov/...",
        input: OpCodes.AnsiToBytes("Hello World"),
        outputSize: 32,
        expected: OpCodes.Hex8ToBytes("46b9dd2b0ba88d13233b3feb743eeb24...")
    },
    {
        text: "SHAKE128 16-byte output", 
        uri: "https://nvlpubs.nist.gov/...",
        input: OpCodes.AnsiToBytes("Hello World"),
        outputSize: 16,
        expected: OpCodes.Hex8ToBytes("46b9dd2b0ba88d13233b3feb743eeb24")
    }
]
```

### Stream Cipher Tests
```javascript
[
    {
        text: "Basic stream encryption",
        uri: "https://example.com/spec",
        input: OpCodes.AnsiToBytes("Hello World"),
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        iv: OpCodes.Hex8ToBytes("0001020304050607"),
        expected: OpCodes.Hex8ToBytes("1a2b3c4d5e6f708190a1b2")
    }
]
```

## Required Interface Implementation

### Critical: Feed/Result Pattern

**All algorithms must implement the Feed/Result pattern through CreateInstance:**

1. **Algorithm Class**: Extends appropriate base class and implements `CreateInstance(isInverse)`
2. **Instance Class**: Extends `IAlgorithmInstance` and implements `Feed(data)` and `Result()`
3. **Properties**: Instance properties can be set to configure behavior (key, iv, outputSize, etc.)

### CreateInstance Return Values

**The `CreateInstance(isInverse)` method should:**
- Return a new instance object when the operation is supported
- Return `null` when the requested operation is not available
- **Never throw** for unsupported inverse operations

**Examples:**
```javascript
CreateInstance(isInverse = false) {
  if (isInverse) {
    return null; // Hash functions don't have inverse operations
  }
  return new YourHashFunctionInstance(this);
}

CreateInstance(isInverse = false) {
  // Block ciphers typically support both encrypt and decrypt
  return new YourBlockCipherInstance(this, isInverse);
}

CreateInstance(isInverse = false) {
  if (isInverse && !this.supportsDecryption) {
    return null; // Some stream ciphers might not support decryption
  }
  return new YourStreamCipherInstance(this, isInverse);
}
```

**Why return null instead of throwing:**
- Allows testing framework to gracefully handle unsupported operations
- Enables round-trip testing to automatically skip when inverse isn't available
- Follows the "null object pattern" for cleaner error handling
- Prevents test failures when algorithms legitimately don't support inverse operations

### Why This Architecture

1. **Unified Interface**: All transformations use the same Feed/Result pattern
2. **Composability**: Instances can be easily chained together
3. **Configurability**: Properties can be modified after instance creation
4. **Stateful Processing**: Instances maintain state between Feed calls
5. **Streaming Support**: Can process data in chunks via multiple Feed calls

### Critical Test Vector Guidelines

1. **Always use OpCodes helpers**: `Hex8ToBytes()`, `AnsiToBytes()`
2. **Byte arrays only**: Testing framework works with byte arrays, not strings
3. **Exact block sizes**: Input must match algorithm's block size requirements  
4. **Official sources**: Link to NIST, RFC, or original paper test vectors
5. **Multiple vectors**: Include at least 3 test vectors to verify correctness

## Testing Framework Flow

```
All Algorithm Types:
1. Load algorithm file and get registered algorithm from AlgorithmFramework.Algorithms
2. For each test vector:
   a. Call algorithm.CreateInstance(isInverse) -> get instance
   b. Framework automatically applies test vector properties to instance:
      - if (test.key) instance.key = test.key
      - if (test.iv) instance.iv = test.iv  
      - if (test.outputSize) instance.outputSize = test.outputSize
      - if (test.nonce) instance.nonce = test.nonce
      - etc. (any property found in test vector)
   c. Call instance.Feed(test.input)
   d. Call instance.Result() -> get output
   e. Compare output with test.expected
   f. For round-trip testing: create inverse instance and test reverse operation
3. Report pass/fail for each vector

Block Ciphers:
- Test properties: input, expected, key (required), iv (optional)
- Framework sets instance.key = test.key before Feed()
- Feed test.input, expect test.expected from Result()

Hash Functions:  
- Test properties: input, expected, outputSize (optional)
- Framework sets instance.outputSize = test.outputSize if specified
- Feed test.input, expect test.expected from Result()

Stream Ciphers:
- Test properties: input, expected, key (required), iv (optional)
- Framework sets instance.key = test.key and instance.iv = test.iv
- Feed test.input, expect test.expected from Result()

Compression:
- Test properties: input, expected  
- Feed test.input, compare Result() with test.expected
- For round-trip: create inverse instance, feed compressed, get decompressed

Encoding:
- Test properties: input, expected, outputSize (optional)
- Feed test.input, compare Result() with test.expected
- For round-trip: create inverse instance, feed encoded, get decoded
```

**✅ Key Benefits:**
- Test vectors contain all configuration in one place
- No manual property setting needed in test code
- Framework automatically applies test properties to instances
- Consistent testing across all algorithm types

**⚠️ No method-specific calls like KeySetup, EncryptBlock, Hash, etc.**

### Error Handling Requirements

The testing framework expects specific error handling patterns:

**Instance Creation:**
- Throw `Error("CreateInstance() not implemented")` if not overridden
- Return `null` when inverse operations are not available (e.g. `CreateInstance(true)` for hash functions)
- Return `null` when the requested operation mode is not supported by the algorithm

**Feed/Result Operations:**
- Throw `Error("Feed() not implemented")` if not overridden  
- Throw `Error("Result() not implemented")` if not overridden
- Throw `Error("Invalid input data")` for malformed input

**Property Validation:**
- Throw `Error("Invalid key size")` for unsupported key lengths
- Throw `Error("Invalid block size")` for incorrect input lengths  
- Throw `Error("Invalid output size")` for unsupported digest lengths
- Throw `Error("Key not set")` if key required but not provided

**General:**
- Use standard JavaScript `Error` objects
- Include descriptive error messages
- Validate properties before processing
- Handle edge cases (empty arrays, null values, etc.)

### Required Dependencies

Every algorithm file should include these dependencies and register itself:

```javascript
// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

// Import required classes
const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

// Define your algorithm class
class YourAlgorithm extends BlockCipherAlgorithm {
  // ... implementation
}

// Register immediately when file loads
RegisterAlgorithm(new YourAlgorithm());
```

## 📐 Implementation Template

### Block Cipher Algorithm

```javascript
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

class YourBlockCipher extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Your Block Cipher";
    this.description = "Brief description of what this cipher does";
    this.inventor = "Algorithm Creator Name";
    this.year = 2024;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL; // Be honest about security
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(16, 32, 8) // 16-32 bytes, 8-byte steps
    ];
    this.SupportedBlockSizes = [
      new KeySize(16, 16, 1) // Fixed 16-byte blocks
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("Algorithm Specification", "https://example.com/spec")
    ];

    this.references = [
      new LinkItem("Original Paper", "https://example.com/paper")
    ];

    // Test vectors (REQUIRED) - Include all properties directly
    this.tests = [
      {
        text: "NIST SP 800-38A Vector #1",
        uri: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf",
        input: OpCodes.Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
        key: OpCodes.Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
        expected: OpCodes.Hex8ToBytes("3ad77bb40d7a3660a89ecaf32466ef97")
      }
    ];
  }

  // Required: Create instance for this algorithm
  CreateInstance(isInverse = false) {
    return new YourBlockCipherInstance(this, isInverse);
  }
}

// Instance class - handles the actual encryption/decryption
class YourBlockCipherInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.keySchedule = null;
    this.inputBuffer = [];
    this.BlockSize = 16; // bytes
    this.KeySize = 0;    // will be set when key is assigned
  }

  // Property setter for key - validates and sets up key schedule
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.keySchedule = null;
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

    this._key = [...keyBytes]; // Copy the key
    this.KeySize = keyBytes.length;
    this.keySchedule = this._generateKeySchedule(keyBytes);
  }

  get key() {
    return this._key ? [...this._key] : null; // Return copy
  }

  // Feed data to the cipher (accumulates until we have complete blocks)
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.key) throw new Error("Key not set");

    // Add data to input buffer
    this.inputBuffer.push(...data);
  }

  // Get the result of the transformation
  Result() {
    if (!this.key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    // Process complete blocks
    const output = [];
    const blockSize = this.BlockSize;
    
    // Validate input length for block cipher
    if (this.inputBuffer.length % blockSize !== 0) {
      throw new Error(`Input length must be multiple of ${blockSize} bytes`);
    }

    // Process each block
    for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
      const block = this.inputBuffer.slice(i, i + blockSize);
      const processedBlock = this.isInverse 
        ? this._decryptBlock(block) 
        : this._encryptBlock(block);
      output.push(...processedBlock);
    }

    // Clear input buffer for next operation
    this.inputBuffer = [];
    
    return output;
  }

  // Private methods for actual crypto operations
  _generateKeySchedule(key) {
    // Implement your key schedule generation here
    // This is algorithm-specific
    return key; // Simplified
  }

  _encryptBlock(block) {
    // Implement your block encryption here
    // This is algorithm-specific
    return block.map(b => b ^ this.keySchedule[0]); // Simplified XOR
  }

  _decryptBlock(block) {
    // Implement your block decryption here
    // For this simple example, it's the same as encryption
    return block.map(b => b ^ this.keySchedule[0]); // Simplified XOR
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new YourBlockCipher());
```

### Hash Function Algorithm

```javascript
// Load dependencies
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
        HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

class YourHashFunction extends HashFunctionAlgorithm {
  constructor() {
    super();
    
    this.name = "Your Hash Function";
    this.description = "Brief description of your hash function";
    this.category = CategoryType.HASH;
    this.subCategory = "Cryptographic Hash";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;
    
    this.SupportedOutputSizes = [
      new KeySize(32, 32, 1) // Fixed 32-byte output
    ];

    // Test vectors - include all properties directly
    this.tests = [
      {
        text: "Empty string test",
        uri: "https://example.com/spec",
        input: OpCodes.AnsiToBytes(""),
        expected: OpCodes.Hex8ToBytes("e3b0c44298fc1c149afbf4c8996fb924") // SHA-256 empty string
      },
      {
        text: "Simple string test", 
        uri: "https://example.com/spec",
        input: OpCodes.AnsiToBytes("abc"),
        expected: OpCodes.Hex8ToBytes("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // Hash functions do not support inverse operations
    }
    return new YourHashFunctionInstance(this);
  }
}

class YourHashFunctionInstance extends IHashFunctionInstance {
  constructor(algorithm) {
    super(algorithm);
    this.outputSize = 32; // Default output size
    this.inputBuffer = [];
    this.OutputSize = 32;
  }

  // Property setter for output size (for variable-length hashes)
  set outputSize(size) {
    const isValidSize = this.algorithm.SupportedOutputSizes.some(os => 
      size >= os.minSize && size <= os.maxSize &&
      (size - os.minSize) % os.stepSize === 0
    );
    
    if (!isValidSize) {
      throw new Error(`Invalid output size: ${size} bytes`);
    }
    
    this._outputSize = size;
    this.OutputSize = size;
  }

  get outputSize() {
    return this._outputSize || 32;
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    
    // Accumulate all input data
    this.inputBuffer.push(...data);
  }

  Result() {
    // Implement your hash function here
    const hash = new Array(this.outputSize).fill(0);
    
    // Simple example: XOR all input bytes into hash positions
    for (let i = 0; i < this.inputBuffer.length; i++) {
      hash[i % this.outputSize] ^= this.inputBuffer[i];
    }
    
    // Clear buffer for next operation
    this.inputBuffer = [];
    
    return hash;
  }
}

RegisterAlgorithm(new YourHashFunction());
```

### Stream Cipher Algorithm

```javascript
// Load dependencies
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
        StreamCipherAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

class YourStreamCipher extends StreamCipherAlgorithm {
  constructor() {
    super();
    
    this.name = "Your Stream Cipher";
    this.description = "Brief description of your stream cipher";
    this.category = CategoryType.STREAM;
    this.subCategory = "Stream Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Test vectors - include all properties directly
    this.tests = [
      {
        text: "Basic encryption test",
        uri: "https://example.com/spec",
        input: OpCodes.AnsiToBytes("Hello World"),
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        iv: OpCodes.Hex8ToBytes("0001020304050607"),
        expected: OpCodes.Hex8ToBytes("1a2b3c4d5e6f708190a1b2")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new YourStreamCipherInstance(this, isInverse);
  }
}

class YourStreamCipherInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse; // For stream ciphers, encrypt/decrypt are typically the same
    this.key = null;
    this.iv = null;
    this.state = null;
    this.inputBuffer = [];
  }

  // Property setters with validation
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this._initializeState();
      return;
    }

    // Validate key (implement your key size requirements)
    if (keyBytes.length < 16 || keyBytes.length > 32) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
    }

    this._key = [...keyBytes];
    this._initializeState();
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  set iv(ivBytes) {
    if (!ivBytes) {
      this._iv = null;
      this._initializeState();
      return;
    }

    // Validate IV (implement your IV size requirements)
    if (ivBytes.length !== 8) {
      throw new Error(`Invalid IV size: ${ivBytes.length} bytes`);
    }

    this._iv = [...ivBytes];
    this._initializeState();
  }

  get iv() {
    return this._iv ? [...this._iv] : null;
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.key) throw new Error("Key not set");

    // For stream ciphers, we can process data immediately
    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this.key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    // Generate keystream and XOR with input
    const keystream = this._generateKeystream(this.inputBuffer.length);
    const output = this.inputBuffer.map((byte, i) => byte ^ keystream[i]);

    // Clear buffer for next operation
    this.inputBuffer = [];

    return output;
  }

  _initializeState() {
    if (!this.key) {
      this.state = null;
      return;
    }

    // Initialize cipher state from key and IV
    this.state = {
      key: this.key,
      iv: this.iv || new Array(8).fill(0),
      counter: 0
    };
  }

  _generateKeystream(length) {
    if (!this.state) {
      throw new Error("Cipher state not initialized");
    }

    // Implement your keystream generation here
    // This is a simplified example
    const keystream = new Array(length);
    for (let i = 0; i < length; i++) {
      // Simple LFSR-style keystream (not cryptographically secure!)
      const index = (this.state.counter + i) % this.state.key.length;
      keystream[i] = this.state.key[index] ^ this.state.iv[i % this.state.iv.length];
    }

    this.state.counter += length;
    return keystream;
  }
}

RegisterAlgorithm(new YourStreamCipher());
```

## Common Mistakes to Avoid

❌ **DON'T:**
- Set `securityStatus: "secure"` or similar
- Make up test vectors
- Link to general pages instead of specific implementations  
- Use categories not in the approved list
- Include implementation details in description
- Spilling warnings about unsecure status or educational purpose

✅ **DO:**
- Use `securityStatus: null` as default
- Link to official test vectors
- Link directly to code files
- Keep descriptions concise but informative
- Include inventor attribution when known

## Helper Functions Available

The OpCodes library provides essential helper functions for algorithm implementations:

```javascript
// Convert hex string to byte array
OpCodes.Hex8ToBytes("deadbeef") // → [0xde, 0xad, 0xbe, 0xef]

// Convert ASCII string to byte array  
OpCodes.AnsiToBytes("ABC") // → [0x41, 0x42, 0x43]

// Convert byte array to hex string
OpCodes.BytesToHex8([0xde, 0xad, 0xbe, 0xef]) // → "deadbeef"

// XOR byte arrays
OpCodes.XorBytes([0x01, 0x02], [0x03, 0x04]) // → [0x02, 0x06]

// Rotate operations (useful for many ciphers)
OpCodes.RotL32(0x12345678, 8) // Rotate left 32-bit
OpCodes.RotR32(0x12345678, 8) // Rotate right 32-bit

// Pack/unpack operations (endianness conversion)
OpCodes.PackBytes32BE([0x12, 0x34, 0x56, 0x78]) // → 0x12345678 (big-endian)
OpCodes.UnpackBytes32LE(0x12345678) // → [0x78, 0x56, 0x34, 0x12] (little-endian)
```

**Note:** Always use `OpCodes.Hex8ToBytes()` and `OpCodes.AnsiToBytes()` in test vectors, never hardcode byte arrays.

## Testing Troubleshooting

### Common Test Failures and Solutions

❌ **"CreateInstance() not implemented"**
- **Cause**: Algorithm class doesn't override CreateInstance method
- **Solution**: Implement CreateInstance method that returns appropriate instance class

❌ **"Feed() not implemented"** 
- **Cause**: Instance class doesn't override Feed method from IAlgorithmInstance
- **Solution**: Implement Feed method to accept and process input data

❌ **"Result() not implemented"**
- **Cause**: Instance class doesn't override Result method from IAlgorithmInstance
- **Solution**: Implement Result method to return transformation output

❌ **"Key not set"**
- **Cause**: Algorithm requires key but instance.key property not set before Feed()
- **Solution**: Set instance.key = keyBytes before calling Feed()

❌ **"No data fed"**
- **Cause**: Result() called before any Feed() calls
- **Solution**: Call Feed() with data before calling Result()

❌ **"Invalid key size"** / **"Invalid IV size"** / **"Invalid output size"**
- **Cause**: Property validation failed for algorithm requirements
- **Solution**: Check algorithm's Supported*Sizes arrays for valid ranges

❌ **"Test vector mismatch"**
- **Cause**: Algorithm output doesn't match expected result
- **Solution**: Debug your Feed/Result implementation with test vectors

❌ **"Algorithm not found in registry"**
- **Cause**: Algorithm not properly registered via RegisterAlgorithm()
- **Solution**: Ensure RegisterAlgorithm(new YourAlgorithm()) is called

❌ **"Round-trip test failed"**
- **Cause**: algorithm.CreateInstance(false) + algorithm.CreateInstance(true) don't reverse each other
- **Solution**: Ensure inverse instance properly reverses the transformation, or return `null` from CreateInstance(true) if inverse operations are not supported

❌ **"Property setter validation failed"**
- **Cause**: Instance property setters have validation that's too strict or incorrect
- **Solution**: Review property setter validation logic and SupportedSizes metadata

### Testing Your Implementation

```javascript
// Basic test of your algorithm
const algorithm = AlgorithmFramework.Find("Your Algorithm Name");
const instance = algorithm.CreateInstance(false);

// Configure the instance
instance.key = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f");

// Test with simple data
instance.Feed(OpCodes.AnsiToBytes("Hello"));
const result = instance.Result();
console.log("Result:", OpCodes.BytesToHex8(result));

// Test round-trip
const inverse = algorithm.CreateInstance(true);
inverse.key = instance.key;
inverse.Feed(result);
const recovered = inverse.Result();
console.log("Recovered:", OpCodes.BytesToHex8(recovered));
```

### Manual Testing

Test your algorithm manually before submitting:

Run:

```bash
node Tests/TestSuite.js Algorithm.js
```
