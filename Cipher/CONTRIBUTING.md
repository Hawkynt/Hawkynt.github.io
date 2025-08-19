# Metadata Guidelines for Contributors

## ⚠️ Critical Security Guidelines

### Security Status Rules
- **NEVER** set `securityStatus` to anything claiming the algorithm is "secure"
- **Only use**: `"insecure"`, `"educational"`, `"experimental"`,or `null`
- `null` means "not yet broken or thoroughly analyzed" - this is the safest default
- `"educational"` means "for learning purposes only"
- `"insecure"` means "known vulnerabilities, should not be used in production"
- `"experimental"` means "cleanroom implementation without any testvectors just from specs/papers"

### Why We Don't Claim "Secure"
- Cryptographic security is constantly evolving
- New attacks are discovered regularly
- We are not cryptanalysts - we are implementers
- Making security claims creates liability and false confidence

## Required Metadata Structure

Follow this exact structure from `Metadata-template.js`:

```javascript
const AlgorithmName = {
    name: "Algorithm Display Name",
    description: "Clear description (maximum 3 sentences). Explain what it does and primary use case. Keep concise but informative.",
    inventor: "Person/Organization Who Created It", // Empty string if unknown
    year: 1995, // Year first published/appeared, or null if unknown
    country: "US", // ISO country code where developed, or null
    category: "cipher", // See categories below
    subCategory: "Block Cipher", // Specific type within category
    securityStatus: null, // ONLY "insecure", "educational", or null
    securityNotes: "Brief security assessment (max 3 sentences). Known issues or analysis status.",
    
    documentation: [
        // Links to papers, specifications, analysis
        {text: "Wikipedia Article", uri: "https://en.wikipedia.org/..."},
        {text: "Original Paper", uri: "https://..."},
        {text: "NIST Standard", uri: "https://..."}
    ],
    
    references: [
        // Links to actual implementations (code repositories)
        {text: "OpenSSL Implementation", uri: "https://github.com/openssl/..."},
        {text: "Author's C++ Code", uri: "https://github.com/.../file.cpp"},
        {text: "RFC Specification", uri: "https://tools.ietf.org/rfc/..."}
    ],
    
    knownVulnerabilities: [
        {
            type: "Attack Type", 
            text: "Description of vulnerability and impact",
            mitigation: "How to mitigate or why to avoid"
        }
    ],
    
    tests: [
        // Test vectors - use official sources when possible
        {
            text: "Test Vector Description",
            uri: "Source URL (NIST, RFC, etc.)",
            keySize: 16, // For ciphers
            blockSize: 16, // For block ciphers
            input: Hex8ToBytes("input_hex"),
            key: Hex8ToBytes("key_hex"), // For ciphers
            expected: Hex8ToBytes("expected_output_hex")
        }
    ],

    /* methods and implementation following */
    //
};
```

## Valid Categories

Use these exact category (=Subsystem) values:

- `"cipher"` - Block/stream ciphers (AES, ChaCha20, etc.)
- `"modeOfOperation"` - Cipher modes (CBC, GCM, etc.)  
- `"paddingScheme"` - Padding methods (PKCS#7, OAEP, etc.)
- `"hash"` - Hash functions (SHA-256, Blake2, etc.)
- `"checksum"` - Checksums (CRC32, Adler32, etc.)
- `"compression"` - Compression algorithms (DEFLATE, LZ77, etc.)
- `"keyDerivation"` - KDF functions (PBKDF2, Argon2, etc.)
- `"randomNumberGenerator"` - RNG algorithms
- `"encodingScheme"` - Encoding methods (Base64, Hex, etc.)
- `"errorCorrection"` - Error correction codes

## Valid SubCategories by Category

### `"cipher"` subcategories:
- `"Block Cipher"` - Fixed-size block encryption (AES, DES, Blowfish)
- `"Stream Cipher"` - Byte-by-byte encryption (ChaCha20, RC4, Salsa20)
- `"Classical Cipher"` - Historical/educational ciphers (Caesar, Vigenère, Enigma)
- `"Asymmetric Cipher"` - Public key cryptography (RSA, NTRU, Post-Quantum)

### `"modeOfOperation"` subcategories:
- `"Confidentiality Mode"` - Encryption only (ECB, CBC, CTR, OFB, CFB)
- `"Authenticated Mode"` - Encryption + authentication (GCM, CCM, EAX, OCB)
- `"Format Preserving"` - Structure-preserving (XTS, FFX, FPE)
- `"Key Wrapping"` - Key encryption modes (KW, KWP)

### `"paddingScheme"` subcategories:
- `"Block Padding"` - For block ciphers (PKCS#7, PKCS#5, ISO 10126)
- `"Signature Padding"` - For digital signatures (PSS, PKCS#1 v1.5)
- `"Encryption Padding"` - For asymmetric encryption (OAEP, PKCS#1 v1.5)
- `"Bit Padding"` - Bit-level padding (ISO 7816-4, Bit Padding)

### `"hash"` subcategories:
- `"Cryptographic Hash"` - Cryptographic hash functions (SHA-2, SHA-3, BLAKE2, MD5, SHA-1, MD4)
- `"Fast Hash"` - Non-cryptographic hashes (xxHash, MurmurHash, CityHash)
- `"Specialized Hash"` - Domain-specific (SipHash, SHAKE, Groestl)

### `"checksum"` subcategories:
- `"CRC Family"` - Cyclic redundancy checks (CRC32, CRC16, Adler32)
- `"Simple Checksum"` - Basic checksums (Fletcher, BSD checksum)
- `"Network Checksum"` - Protocol checksums (Internet checksum)

### `"compression"` subcategories:
- `"Dictionary"` - Dictionary-based (LZ77, LZ78, LZW, LZ4)
- `"Statistical"` - Entropy-based (Huffman, Arithmetic, Shannon-Fano)
- `"Transform"` - Transform-based (BWT, Delta, RLE)
- `"Modern"` - Advanced algorithms (Brotli, Zstandard, PPM)

### `"keyDerivation"` subcategories:
- `"Password-Based"` - From passwords (PBKDF2, scrypt, Argon2)
- `"Key-Based"` - From existing keys (HKDF, KBKDF)
- `"Function-Based"` - Mathematical functions (Balloon, bcrypt)

### `"encodingScheme"` subcategories:
- `"Base Encoding"` - Base-n encodings (Base64, Base32, Base58, Base85)
- `"Text Encoding"` - Character encodings (Morse, Baudot, Atbash)
- `"Binary Encoding"` - Binary representations (Hex, BinHex, UUEncode)
- `"Specialized"` - Domain-specific (PEM, Bubble Babble, Z85)

### `"errorCorrection"` subcategories:
- `"Block Code"` - Block-based codes (Hamming, BCH, Reed-Solomon)
- `"Convolutional"` - Convolutional codes and turbo codes
- `"LDPC"` - Low-density parity-check codes
- `"Linear Code"` - Linear algebraic codes

### `"randomNumberGenerator"` subcategories:
- `"CSPRNG"` - Cryptographically secure (ChaCha20-DRNG, HMAC-DRNG)
- `"PRNG"` - Pseudorandom generators (Linear congruential, Mersenne Twister)
- `"Hardware RNG"` - Hardware-based entropy sources
- `"Stream Cipher RNG"` - Stream ciphers used as RNGs

## Security Status Guidelines

### When to use `null` (DEFAULT)
- Algorithm is widely used but not thoroughly analyzed by us
- No known practical attacks but not claiming security
- Standard algorithms like AES, ChaCha20, SHA-256
- **This is the safest and recommended default**

### When to use `"educational"`
- Algorithm designed for teaching cryptographic concepts
- Simple classical ciphers (Caesar, Vigenère)
- Toy algorithms for demonstration
- Deprecated algorithms still useful for learning

### When to use `"insecure"`  
- Algorithm has known practical attacks
- Completely broken algorithms (DES, MD5, RC4)
- Academic attacks that make it unsuitable for production

### When to use `"experimental"`  
- Algorithm has no known reference sources nor test-vectors
- At the current form of implementation it can not be verified for correctness and is just a mere toy

## Test Vector Guidelines

### Always Include Sources
- Link to official test vectors when available
- NIST, RFC, or original paper sources preferred
- Never make up test vectors
- Always start implementation with the test-vectors so you have something to check against.

### Use Proper Format
```javascript
tests: [
    {
        text: "NIST SP 800-38A Vector #1", // Descriptive name
        uri: "https://nvlpubs.nist.gov/...", // Official source
        keySize: 16, // Key size in bytes
        blockSize: 16, // Block size in bytes (if applicable)
        input: Hex8ToBytes("6bc1bee22e409f96e93d7e117393172a"),
        key: Hex8ToBytes("2b7e151628aed2a6abf7158809cf4f3c"),
        expected: Hex8ToBytes("3ad77bb40d7a3660a89ecaf32466ef97")
    }
]
```

### Hash Function Tests
```javascript
{
    text: "Empty string hash",
    uri: "https://tools.ietf.org/rfc/rfc...",
    input: null, // Can be empty array or null, too
    expected: Hex8ToBytes("e3b0c44298fc1c149afbf4c8996fb924")
}
```

### Variable Output Tests
```javascript
{
    text: "SHAKE128 32-byte output",
    uri: "https://nvlpubs.nist.gov/...",
    outputSize: 32, // Output size in bytes
    input: ANSIToBytes("Hello World"),
    expected: Hex8ToBytes("46b9dd2b0ba88d13233b3feb743eeb24...")
}
```

## Required Method Signatures for Testing

### Critical: Testing Framework Dependencies

**The testing framework expects specific method signatures.** Algorithms that don't implement these exact methods will fail all tests, regardless of correctness.

### Block Cipher Required Methods

```javascript
// Required for cipher registration and testing
const YourCipher = {
  // Interface properties (REQUIRED)
  internalName: 'your-cipher-name',  // Used by testing framework
  minKeyLength: 16,                  // Bytes
  maxKeyLength: 32,                  // Bytes  
  stepKeyLength: 1,                  // Key size increment
  minBlockSize: 16,                  // Bytes
  maxBlockSize: 16,                  // Bytes
  stepBlockSize: 1,                  // Block size increment
  instances: {},                     // Instance storage (REQUIRED)
  cantDecode: false,                 // true if encryption-only
  isInitialized: false,              // Initialization flag

  // REQUIRED METHOD: KeySetup(key) -> instanceId
  KeySetup: function(key) {
    // Must validate key length and return unique ID
    // Testing framework calls this before every test vector
  },

  // REQUIRED METHOD: encryptBlock(instanceId, plaintext) -> ciphertext  
  encryptBlock: function(id, plaintext) {
    // Must encrypt exactly one block using the instance
    // Testing framework validates output against test vectors
  },

  // REQUIRED METHOD: decryptBlock(instanceId, ciphertext) -> plaintext
  decryptBlock: function(id, ciphertext) {
    // Must decrypt exactly one block using the instance  
    // Testing framework validates round-trip encryption
  }
};
```

### Hash Function Required Methods

```javascript
const YourHash = {
  // Interface properties
  name: "Your Hash",
  category: "hash",
  subCategory: "Cryptographic Hash", // or "Fast Hash", "Specialized Hash"
  // ... metadata ...

  // REQUIRED METHOD: Init() -> boolean
  Init: function() {
    return true; // Return true if initialization successful
  },

  // REQUIRED METHOD: Hash(input) -> output
  Hash: function(input) {
    // Input: byte array or null/empty for empty string
    // Output: hash digest as byte array
    // Testing framework validates against test vectors
  },

  // OPTIONAL: For variable-output hashes (SHAKE, etc.)
  HashWithLength: function(input, outputLength) {
    // Generate hash with specified output length
    // Used for extendable-output functions
  }
};
```

### Stream Cipher Required Methods

```javascript
const YourStreamCipher = {
  // Interface properties  
  name: "Your Stream Cipher",
  category: "cipher",
  subCategory: "Stream Cipher",
  minKeyLength: 16,
  maxKeyLength: 32,
  instances: {},
  // ... metadata ...

  // REQUIRED METHOD: KeySetup(key, iv) -> instanceId
  KeySetup: function(key, iv) {
    // Initialize keystream generator with key and optional IV
    // Return unique instance ID
    const instanceId = global.OpCodes.GenerateID();
    this.instances[instanceId] = new this.StreamInstance(key, iv);
    return instanceId;
  },

  // REQUIRED METHOD: encrypt(instanceId, plaintext) -> ciphertext
  encrypt: function(id, plaintext) {
    // Generate keystream and XOR with plaintext
    // Return ciphertext of same length
  },

  // REQUIRED METHOD: decrypt(instanceId, ciphertext) -> plaintext  
  decrypt: function(id, ciphertext) {
    // Generate same keystream and XOR with ciphertext
    // Stream ciphers: encrypt and decrypt are typically identical
  },

  // OPTIONAL: For resettable stream ciphers
  reset: function(id) {
    // Reset keystream to initial state
  }
};
```

### Checksum Required Methods

```javascript
const YourChecksum = {
  // Interface properties
  name: "Your Checksum",
  category: "checksum",
  subCategory: "CRC Family", // or "Simple Checksum", "Network Checksum"
  // ... metadata ...

  // REQUIRED METHOD: Init() -> boolean
  Init: function() {
    return true;
  },

  // REQUIRED METHOD: Calculate(input) -> checksum
  Calculate: function(input) {
    // Input: byte array
    // Output: checksum value (number or byte array)
    // For CRC: typically return as 32-bit number
    // For Adler32: return as 32-bit number
  },

  // OPTIONAL: For incremental checksums
  Update: function(state, newData) {
    // Update existing checksum with new data
    // Return updated checksum state
  }
};
```

### Compression Required Methods

```javascript
const YourCompression = {
  // Interface properties
  name: "Your Compression",
  category: "compression", 
  subCategory: "Dictionary", // or "Statistical", "Transform", "Modern"
  // ... metadata ...

  // REQUIRED METHOD: Init() -> boolean
  Init: function() {
    return true;
  },

  // REQUIRED METHOD: Compress(input) -> compressed
  Compress: function(input) {
    // Input: byte array to compress
    // Output: compressed byte array
    // Should be smaller than input for typical data
  },

  // REQUIRED METHOD: Decompress(compressed) -> original
  Decompress: function(compressed) {
    // Input: compressed byte array
    // Output: original uncompressed byte array
    // Must exactly match original Compress() input
  },

  // OPTIONAL: For streaming compression
  CompressStream: function(inputStream) {
    // Handle streaming data compression
  }
};
```

### ECC (Elliptic Curve) Required Methods

```javascript
const YourECC = {
  // Interface properties
  name: "Your ECC Algorithm",
  category: "ecc",
  subCategory: "ECDSA", // or "ECDH", "EdDSA", "Curve25519"
  // ... metadata ...

  // REQUIRED METHOD: Init() -> boolean
  Init: function() {
    return true;
  },

  // REQUIRED METHOD: GenerateKeyPair() -> {publicKey, privateKey}
  GenerateKeyPair: function() {
    // Generate ECC key pair
    // Return object with publicKey and privateKey byte arrays
  },

  // REQUIRED METHOD: Sign(privateKey, message) -> signature
  Sign: function(privateKey, message) {
    // Sign message with private key
    // Return signature as byte array
  },

  // REQUIRED METHOD: Verify(publicKey, message, signature) -> boolean
  Verify: function(publicKey, message, signature) {
    // Verify signature against message and public key
    // Return true if signature is valid
  },

  // For ECDH key exchange:
  // REQUIRED METHOD: ComputeSharedSecret(privateKey, publicKey) -> sharedSecret
  ComputeSharedSecret: function(privateKey, publicKey) {
    // Compute shared secret for key exchange
    // Return shared secret as byte array
  }
};
```

### Encoding Required Methods

```javascript
const YourEncoding = {
  // Interface properties
  name: "Your Encoding",
  category: "encodingScheme",
  subCategory: "Base Encoding", // or "Text Encoding", "Binary Encoding", "Specialized"
  // ... metadata ...

  // REQUIRED METHOD: Init() -> boolean
  Init: function() {
    return true;
  },

  // REQUIRED METHOD: Encode(input) -> encoded
  Encode: function(input) {
    // Input: byte array to encode
    // Output: encoded string or byte array
    // E.g., Base64: bytes -> ASCII string
  },

  // REQUIRED METHOD: Decode(encoded) -> original
  Decode: function(encoded) {
    // Input: encoded string or byte array
    // Output: original byte array
    // Must exactly reverse Encode() operation
  },

  // OPTIONAL: For validation
  IsValid: function(encoded) {
    // Check if encoded data is valid for this encoding
    // Return boolean
  }
};
```

### Padding Scheme Required Methods

```javascript
const YourPadding = {
  // Interface properties
  name: "Your Padding",
  category: "paddingScheme",
  subCategory: "Block Padding", // or "Signature Padding", "Encryption Padding", "Bit Padding"
  // ... metadata ...

  // REQUIRED METHOD: Init() -> boolean  
  Init: function() {
    return true;
  },

  // REQUIRED METHOD: Pad(data, blockSize) -> paddedData
  Pad: function(data, blockSize) {
    // Input: data to pad, target block size
    // Output: padded data that's multiple of blockSize
    // E.g., PKCS#7: add bytes with value = number of padding bytes
  },

  // REQUIRED METHOD: Unpad(paddedData) -> originalData
  Unpad: function(paddedData) {
    // Input: padded data from Pad()
    // Output: original data with padding removed
    // Must validate padding is correct and throw if invalid
  },

  // OPTIONAL: Validation
  ValidatePadding: function(paddedData, blockSize) {
    // Check if padding is valid
    // Return boolean
  }
};
```

### Mode of Operation Required Methods

```javascript
const YourMode = {
  // Interface properties
  name: "Your Mode",
  category: "modeOfOperation", 
  subCategory: "Confidentiality Mode", // or "Authenticated Mode", "Format Preserving", "Key Wrapping"
  // ... metadata ...

  // REQUIRED METHOD: Init() -> boolean
  Init: function() {
    return true;
  },

  // REQUIRED METHOD: Encrypt(cipher, key, plaintext, iv) -> ciphertext
  Encrypt: function(cipher, key, plaintext, iv) {
    // Input: cipher object, key, plaintext, optional IV
    // Output: encrypted data (may include IV/auth tag for some modes)
    // Use provided cipher for block encryption
  },

  // REQUIRED METHOD: Decrypt(cipher, key, ciphertext, iv) -> plaintext
  Decrypt: function(cipher, key, ciphertext, iv) {
    // Input: cipher object, key, ciphertext, optional IV
    // Output: decrypted plaintext
    // For authenticated modes: verify auth tag and throw if invalid
  },

  // For authenticated modes:
  // REQUIRED METHOD: EncryptWithAuth(cipher, key, plaintext, aad, iv) -> {ciphertext, authTag}
  EncryptWithAuth: function(cipher, key, plaintext, aad, iv) {
    // Additional Authenticated Data (AAD) for AEAD modes
    // Return object with ciphertext and authentication tag
  }
};
```

### MAC (Message Authentication Code) Required Methods

```javascript
const YourMAC = {
  // Interface properties
  name: "Your MAC",
  category: "mac",
  subCategory: "HMAC", // or "CMAC", "GMAC", "Poly1305"
  minKeyLength: 16,
  maxKeyLength: 64,
  // ... metadata ...

  // REQUIRED METHOD: Init() -> boolean
  Init: function() {
    return true;
  },

  // REQUIRED METHOD: Generate(key, message) -> mac
  Generate: function(key, message) {
    // Input: secret key, message to authenticate
    // Output: MAC tag as byte array
    // Fixed or variable length depending on algorithm
  },

  // REQUIRED METHOD: Verify(key, message, mac) -> boolean
  Verify: function(key, message, mac) {
    // Input: secret key, message, MAC tag to verify
    // Output: true if MAC is valid for message
    // Should use constant-time comparison
  },

  // OPTIONAL: For incremental MAC computation
  StartMAC: function(key) {
    // Initialize MAC computation state
    // Return state object
  },

  UpdateMAC: function(state, data) {
    // Update MAC with additional data
    // Modify state object
  },

  FinalizeMAC: function(state) {
    // Finalize MAC computation
    // Return MAC tag
  }
};
```

### KDF (Key Derivation Function) Required Methods

```javascript
const YourKDF = {
  // Interface properties
  name: "Your KDF",
  category: "keyDerivation",
  subCategory: "Password-Based", // or "Key-Based", "Function-Based"
  // ... metadata ...

  // REQUIRED METHOD: Init() -> boolean
  Init: function() {
    return true;
  },

  // REQUIRED METHOD: DeriveKey(password, salt, iterations, keyLength) -> derivedKey
  DeriveKey: function(password, salt, iterations, keyLength) {
    // Input: password/key material, salt, iteration count, desired key length
    // Output: derived key of specified length
    // For PBKDF2, scrypt, Argon2, etc.
  },

  // For HKDF-style KDFs:
  // REQUIRED METHOD: Extract(salt, inputKeyMaterial) -> pseudoRandomKey
  Extract: function(salt, inputKeyMaterial) {
    // Extract step: extract pseudorandom key from input
  },

  // REQUIRED METHOD: Expand(pseudoRandomKey, info, length) -> outputKeyMaterial  
  Expand: function(pseudoRandomKey, info, length) {
    // Expand step: expand to desired length with optional context info
  },

  // OPTIONAL: For parameter validation
  ValidateParameters: function(iterations, memorySize, parallelism) {
    // Validate KDF parameters are secure
    // Return boolean or throw exception
  }
};
```

### Random Number Generator Required Methods

```javascript
const YourRNG = {
  // Interface properties
  name: "Your RNG",
  category: "randomNumberGenerator",
  subCategory: "CSPRNG", // or "PRNG", "Hardware RNG", "Stream Cipher RNG"
  // ... metadata ...

  // REQUIRED METHOD: Init(seed) -> boolean
  Init: function(seed) {
    // Initialize RNG with seed material
    // Return true if successful
  },

  // REQUIRED METHOD: GenerateBytes(length) -> randomBytes
  GenerateBytes: function(length) {
    // Generate specified number of random bytes
    // Output: byte array of requested length
  },

  // REQUIRED METHOD: GenerateUInt32() -> randomInteger  
  GenerateUInt32: function() {
    // Generate random 32-bit integer
    // Return number in range [0, 2^32-1]
  },

  // REQUIRED METHOD: GenerateUInt64() -> randomInteger  
  GenerateUInt64: function() {
    // Generate random 64-bit integer
    // Return number in range [0, 2^64-1]
  },

  // OPTIONAL: For reseeding
  Reseed: function(additionalSeed) {
    // Add entropy to existing RNG state
  },

  // OPTIONAL: For statistical testing
  GetEntropyEstimate: function() {
    // Return estimated bits of entropy per output bit
  }
};
```

### Error Correction Code Required Methods

```javascript
const YourECC_ErrorCorrection = {
  // Interface properties (note: different from elliptic curves)
  name: "Your Error Correction",
  category: "errorCorrection",
  subCategory: "Block Code", // or "Convolutional", "LDPC", "Linear Code"
  // ... metadata ...

  // REQUIRED METHOD: Init() -> boolean
  Init: function() {
    return true;
  },

  // REQUIRED METHOD: Encode(data) -> codedData
  Encode: function(data) {
    // Input: original data to protect
    // Output: data with error correction codes added
    // Adds redundancy for error detection/correction
  },

  // REQUIRED METHOD: Decode(codedData) -> {data, errorsDetected, errorsCorrected}
  Decode: function(codedData) {
    // Input: possibly corrupted coded data
    // Output: object with original data and error statistics
    // Detect and correct errors where possible
  },

  // OPTIONAL: For specific error patterns
  CorrectErrors: function(codedData, errorPositions) {
    // Correct known error positions
  },

  // OPTIONAL: For syndrome calculation
  CalculateSyndrome: function(codedData) {
    // Calculate error syndrome for debugging
  }
};
```

### Post-Quantum Cryptography Required Methods

```javascript
const YourPQC = {
  // Interface properties
  name: "Your Post-Quantum Algorithm", 
  category: "pqc", // or could be "asymmetric" with PQC subcategory
  subCategory: "Lattice-Based", // or "Code-Based", "Multivariate", "Hash-Based"
  // ... metadata ...

  // REQUIRED METHOD: Init() -> boolean
  Init: function() {
    return true;
  },

  // For PQC Key Encapsulation Mechanisms (KEMs):
  // REQUIRED METHOD: GenerateKeyPair() -> {publicKey, privateKey}
  GenerateKeyPair: function() {
    // Generate post-quantum key pair
    // Keys are typically much larger than classical crypto
  },

  // REQUIRED METHOD: Encapsulate(publicKey) -> {ciphertext, sharedSecret}
  Encapsulate: function(publicKey) {
    // Encapsulate a random shared secret
    // Return ciphertext and the shared secret
  },

  // REQUIRED METHOD: Decapsulate(privateKey, ciphertext) -> sharedSecret
  Decapsulate: function(privateKey, ciphertext) {
    // Decapsulate shared secret from ciphertext
    // Return the shared secret (should match Encapsulate output)
  },

  // For PQC Digital Signatures:
  // REQUIRED METHOD: Sign(privateKey, message) -> signature
  Sign: function(privateKey, message) {
    // Sign message with post-quantum signature scheme
  },

  // REQUIRED METHOD: Verify(publicKey, message, signature) -> boolean
  Verify: function(publicKey, message, signature) {
    // Verify post-quantum signature
  }
};
```

### Classical Cipher Required Methods

```javascript
const YourClassicalCipher = {
  // Interface properties
  name: "Your Classical Cipher",
  category: "cipher",
  subCategory: "Classical Cipher",
  // ... metadata ...

  // REQUIRED METHOD: Init() -> boolean
  Init: function() {
    return true;
  },

  // REQUIRED METHOD: Encrypt(plaintext, key) -> ciphertext
  Encrypt: function(plaintext, key) {
    // Input: plaintext string, key (string, number, or array)
    // Output: ciphertext string
    // Classical ciphers often work on text, not bytes
  },

  // REQUIRED METHOD: Decrypt(ciphertext, key) -> plaintext
  Decrypt: function(ciphertext, key) {
    // Input: ciphertext string, key
    // Output: plaintext string
    // Should exactly reverse Encrypt operation
  },

  // OPTIONAL: For key validation
  ValidateKey: function(key) {
    // Check if key is valid for this cipher
    // Return boolean or throw exception
  },

  // OPTIONAL: For alphabet management
  SetAlphabet: function(alphabet) {
    // Set custom alphabet for the cipher
    // Default usually English A-Z
  }
};
```

### Special Algorithm Category Methods

```javascript
const YourSpecialAlgorithm = {
  // Interface properties
  name: "Your Special Algorithm",
  category: "special", // For algorithms that don't fit other categories
  subCategory: "Custom Type",
  // ... metadata ...

  // REQUIRED METHOD: Init() -> boolean
  Init: function() {
    return true;
  },

  // REQUIRED METHOD: Process(input, parameters) -> output
  Process: function(input, parameters) {
    // Generic processing method for special algorithms
    // Input/output depends on specific algorithm purpose
  },

  // OPTIONAL: Algorithm-specific methods
  Configure: function(options) {
    // Configure algorithm-specific parameters
  },

  Reset: function() {
    // Reset algorithm to initial state
  }
};
```

### Why These Signatures Are Mandatory

1. **Automated Testing**: The test runner calls these exact method names
2. **Interface Validation**: `StrictAlgorithmTester` checks for these methods
3. **Integration**: The `Cipher` system expects this interface
4. **Test Vectors**: Framework maps test vector data to these method calls

### Testing Framework Flow

```
Block Ciphers:
1. Load algorithm file
2. Check for required methods (KeySetup, encryptBlock, decryptBlock)
3. For each test vector:
   a. Call KeySetup(test.key) -> get instanceId
   b. Call encryptBlock(instanceId, test.input) -> get result
   c. Compare result with test.expected
   d. Call decryptBlock(instanceId, result) -> verify round-trip
4. Report pass/fail for each vector

Hash Functions:
1. Load algorithm file  
2. Check for required methods (Init, Hash)
3. For each test vector:
   a. Call Hash(test.input) -> get result
   b. Compare result with test.expected
4. Report pass/fail for each vector

Stream Ciphers:
1. Load algorithm file
2. Check for required methods (KeySetup, encrypt, decrypt)
3. For each test vector:
   a. Call KeySetup(test.key, test.iv) -> get instanceId
   b. Call encrypt(instanceId, test.input) -> get result
   c. Compare result with test.expected
   d. Call decrypt(instanceId, result) -> verify round-trip
4. Report pass/fail for each vector

Compression Algorithms:
1. Load algorithm file
2. Check for required methods (Init, Compress, Decompress)
3. For each test vector:
   a. Call Compress(test.input) -> get compressed
   b. Call Decompress(compressed) -> get decompressed
   c. Compare decompressed with test.input (round-trip test)
   d. Optionally compare compressed with test.expected
4. Report pass/fail for each vector

Encoding Schemes:
1. Load algorithm file
2. Check for required methods (Init, Encode, Decode)
3. For each test vector:
   a. Call Encode(test.input) -> get encoded
   b. Compare encoded with test.expected
   c. Call Decode(encoded) -> verify round-trip
4. Report pass/fail for each vector

MAC/KDF/Other Categories:
1. Load algorithm file
2. Check for category-specific required methods
3. Run category-appropriate test vectors
4. Report results
```

**⚠️ Missing any required method = ALL TESTS FAIL**

### Error Handling Requirements

The testing framework expects specific error handling patterns:

```javascript
// Use global.throwException for errors (REQUIRED format)
if (!this.instances[id]) {
  global.throwException('Unknown Object Reference Exception', id, 'YourCipher', 'encryptBlock');
  return plaintext; // Always return something
}

if (key.length < this.minKeyLength) {
  global.throwException('Invalid Key Length Exception', key.length, 'YourCipher', 'KeySetup'); 
  return null;
}
```

### Required Dependencies

Every algorithm file MUST include these dependencies:

```javascript
// Load OpCodes for cryptographic operations (REQUIRED)
if (!global.OpCodes && typeof require !== 'undefined') {
  require('../../OpCodes.js');
}

// Load Cipher system (REQUIRED)  
if (!global.Cipher) {
  if (typeof require !== 'undefined') {
    try {
      require('../../universal-cipher-env.js');
      require('../../cipher.js');
    } catch (e) {
      console.error('Failed to load cipher dependencies:', e.message);
      return;
    }
  }
}
```

### Test Vector Requirements for Testing Framework

The testing framework expects test vectors in this exact format:

```javascript
tests: [
  {
    text: "Test Vector Description",                    // REQUIRED: Human-readable description
    uri: "https://official-source.com/test-vectors",   // OPTIONAL: Official source URL
    keySize: 16,                                        // OPTIONAL: Key size in bytes (for ciphers)
    blockSize: 16,                                      // OPTIONAL: Block size in bytes (for block ciphers)
    input: OpCodes.Hex8ToBytes("plaintext_hex"),       // REQUIRED: Input as byte array
    key: OpCodes.Hex8ToBytes("key_hex"),               // OPTIONAL: Key as byte array (for ciphers)
    iv: OpCodes.Hex8ToBytes("iv_hex"),                 // OPTIONAL: IV as byte array (if needed)
    expected: OpCodes.Hex8ToBytes("expected_hex")      // REQUIRED: Expected output as byte array
  }
]
```

### Alternative Test Vector Formats

```javascript
// For legacy compatibility, these formats also work:
testVectors: [
  {
    input: OpCodes.StringToBytes("string_input"),          // String input (converted to bytes)
    key: OpCodes.StringToBytes("string_key"),              // String key  
    expected: OpCodes.StringToBytes("string_output"),      // String expected output
    text: "Test description"
  }
]

// Hash function test vectors:
tests: [
  {
    text: "Hash test vector",
    uri: "https://source.com",
    input: OpCodes.StringToBytes("message"),     // Message to hash
    expected: OpCodes.Hex8ToBytes("hash_hex")    // Expected hash output
  }
]

// Stream cipher test vectors:
tests: [
  {
    text: "Stream cipher test vector",
    uri: "https://source.com",
    keySize: 32,
    input: OpCodes.Hex8ToBytes("plaintext_hex"),
    key: OpCodes.Hex8ToBytes("key_hex"),
    iv: OpCodes.Hex8ToBytes("iv_hex"),           // Initialization vector
    expected: OpCodes.Hex8ToBytes("ciphertext_hex")
  }
]

// Compression algorithm test vectors:
tests: [
  {
    text: "Compression test vector",
    uri: "https://source.com", 
    input: OpCodes.StringToBytes("repetitive data data data"),
    expected: OpCodes.Hex8ToBytes("compressed_hex"), // Optional: expected compressed form
    // Note: Round-trip test (compress->decompress) is always performed
  }
]

// Encoding scheme test vectors:
tests: [
  {
    text: "Base64 encoding test",
    uri: "https://tools.ietf.org/rfc/rfc4648.txt",
    input: OpCodes.StringToBytes("Hello World"),
    expected: OpCodes.StringToBytes("SGVsbG8gV29ybGQ=")  // Expected encoded string
  }
]

// MAC test vectors:
tests: [
  {
    text: "HMAC test vector",
    uri: "https://tools.ietf.org/rfc/rfc2104.txt",
    keySize: 16,
    input: OpCodes.StringToBytes("message"),
    key: OpCodes.Hex8ToBytes("key_hex"),
    expected: OpCodes.Hex8ToBytes("mac_hex")
  }
]

// KDF test vectors:
tests: [
  {
    text: "PBKDF2 test vector",
    uri: "https://tools.ietf.org/rfc/rfc6070.txt",
    password: OpCodes.StringToBytes("password"),
    salt: OpCodes.StringToBytes("salt"),
    iterations: 1000,
    keyLength: 32,
    expected: OpCodes.Hex8ToBytes("derived_key_hex")
  }
]

// Checksum test vectors:
tests: [
  {
    text: "CRC32 test vector", 
    uri: "https://source.com",
    input: OpCodes.StringToBytes("123456789"),
    expected: OpCodes.Hex8ToBytes("CBF43926")  // Expected CRC32 value as number
  }
]

// ECC test vectors:
tests: [
  {
    text: "ECDSA signature test",
    uri: "https://source.com",
    privateKey: OpCodes.Hex8ToBytes("private_key_hex"),
    publicKey: OpCodes.Hex8ToBytes("public_key_hex"),
    message: OpCodes.StringToBytes("message to sign"),
    signature: OpCodes.Hex8ToBytes("signature_hex"),
    // Note: Signature verification test, not generation (due to randomness)
  }
]
```

### Critical Test Vector Guidelines

1. **Always use OpCodes helpers**: `Hex8ToBytes()`, `StringToBytes()`, `ANSIToBytes()`
2. **Byte arrays only**: Testing framework works with byte arrays, not strings
3. **Exact block sizes**: Input must match algorithm's block size requirements  
4. **Official sources**: Link to NIST, RFC, or original paper test vectors
5. **Multiple vectors**: Include at least 3 test vectors to verify correctness

### Instance ID Generation

Use the OpCodes helper for generating unique instance IDs:

```javascript
KeySetup: function(key) {
  const instanceId = global.OpCodes.GenerateID();
  this.instances[instanceId] = new this.YourCipherInstance(key);
  return instanceId;
}
```

## Implementation Template

Use this template for new algorithms (NewAlgo):

```javascript
/*
 * NewAlgo Implementation
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';

  const NewAlgo = {
    name: "Algorithm Name",
    description: "What it does (max 3 sentences).",
    inventor: "Creator Name",
    year: 2005,
    country: "US",
    category: "cipher",
    subCategory: "Block/Symmetric",
    securityStatus: null, // NEVER claim "secure"!
    securityNotes: "Not thoroughly analyzed. Use at your own risk.",
    
    documentation: [ // documentation is a MUST, it must have been described somewhere
      {text: "Wikipedia", uri: "https://..."},
      {text: "Original Paper", uri: "https://..."}
    ],
    
    references: [ // at least one reference SHOULD exist
      {text: "Reference Implementation", uri: "https://github.com/..."}
    ],
    
    knownVulnerabilities: [
      // COULD add if any are known or leave empty or null
    ],
    
    tests: [ // we SHOULD at least have one test-vector to verify our implementation otherwise this is "experimental"
      {
        text: "Official Test Vector",
        uri: "https://...",
        input: OpCodes.Hex8ToBytes("..."),     // these are byte array always, use Hex8ToBytes()
        iv: OpCodes.ANSIToBytes("HelloWorld"), // or ANSIToBytes() helper
        key: null,                     // null means empty array
        expected: []                   // also empty array
      }
    ],

    Init: function() {
      return true;
    }

    // Required interface properties for block ciphers
    internalName: 'algorithm-internal-name',
    minKeyLength: 16,      // Minimum key size in bytes
    maxKeyLength: 32,      // Maximum key size in bytes  
    stepKeyLength: 1,      // Key size increment step
    minBlockSize: 16,      // Minimum block size in bytes
    maxBlockSize: 16,      // Maximum block size in bytes
    stepBlockSize: 1,      // Block size increment step
    instances: {},         // Storage for cipher instances
    cantDecode: false,     // Set to true if algorithm only encrypts
    isInitialized: false,  // Initialization status

    // Required method: Key setup and instance creation
    KeySetup: function(key) {
      // Validate key length
      if (key.length < this.minKeyLength || key.length > this.maxKeyLength) {
        global.throwException('Invalid Key Length Exception', key.length, 'NewAlgo', 'KeySetup');
        return null;
      }
      
      // Generate unique instance ID
      const instanceId = global.OpCodes.GenerateID();
      
      // Create and store cipher instance with key
      this.instances[instanceId] = new this.NewAlgoInstance(key);
      
      return instanceId;
    },

    // Required method: Encrypt single block
    encryptBlock: function(id, plaintext) {
      if (!this.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'NewAlgo', 'encryptBlock');
        return plaintext;
      }
      
      if (plaintext.length !== this.minBlockSize) {
        global.throwException('Invalid Block Size Exception', plaintext.length, 'NewAlgo', 'encryptBlock');
        return plaintext;
      }
      
      // Implement encryption logic here
      const instance = this.instances[id];
      return this.encrypt(instance, plaintext);
    },

    // Required method: Decrypt single block  
    decryptBlock: function(id, ciphertext) {
      if (this.cantDecode) {
        global.throwException('Decode Not Supported Exception', '', 'NewAlgo', 'decryptBlock');
        return ciphertext;
      }
      
      if (!this.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'NewAlgo', 'decryptBlock');
        return ciphertext;
      }
      
      if (ciphertext.length !== this.minBlockSize) {
        global.throwException('Invalid Block Size Exception', ciphertext.length, 'NewAlgo', 'decryptBlock');
        return ciphertext;
      }
      
      // Implement decryption logic here
      const instance = this.instances[id];
      return this.decrypt(instance, ciphertext);
    },

    // Core encryption function (implement algorithm here)
    encrypt: function(instance, plaintext) {
      // TODO: Implement your encryption algorithm
      // Input: instance (from KeySetup), plaintext (string of exact block size)
      // Output: encrypted string of same length
      throw new Error('NewAlgo encryption not yet implemented');
    },

    // Core decryption function (implement algorithm here)  
    decrypt: function(instance, ciphertext) {
      // TODO: Implement your decryption algorithm
      // Input: instance (from KeySetup), ciphertext (string of exact block size) 
      // Output: decrypted string of same length
      throw new Error('NewAlgo decryption not yet implemented');
    },

    // Instance constructor for storing key-specific data
    NewAlgoInstance: function(key) {
      // Store processed key, subkeys, or other key-derived state
      this.key = key;
      // Add key expansion, subkey generation, etc. here
    }
  };

  // Auto-register with Cipher subsystem if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function')
    global.Cipher.AddCipher(NewAlgo); // System validates interface and metadata
  

})(typeof global !== 'undefined' ? global : window);
```

## Common Mistakes to Avoid

❌ **DON'T:**
- Set `securityStatus: "secure"` or similar
- Make up test vectors
- Link to general pages instead of specific implementations  
- Use categories not in the approved list
- Include implementation details in description

✅ **DO:**
- Use `securityStatus: null` as default
- Link to official test vectors
- Link directly to code files
- Keep descriptions concise but informative
- Include inventor attribution when known

## Helper Functions Available

```javascript
// Convert hex string to byte array
Hex8ToBytes("deadbeef") // → [0xde, 0xad, 0xbe, 0xef]

// Convert byte array to hex string  
ANSIToBytes("ABC") // → [0x41, 0x42, 0x43]
```

## Questions?

If you're unsure about:
- Security status → Use `null`
- Category → Check the approved list above  
- Test vectors → Look for official NIST/RFC sources
- Implementation → Follow the template exactly

## Testing Troubleshooting

### Common Test Failures and Solutions

❌ **"Interface validation failed"**
- **Cause**: Missing required methods for your algorithm category
- **Solution**: Implement all required methods with exact signatures for your category

❌ **"Unknown Object Reference Exception"**  
- **Cause**: `KeySetup` didn't store instance or returned invalid ID (block/stream ciphers)
- **Solution**: Ensure `KeySetup` returns valid ID and stores in `this.instances[id]`

❌ **"Invalid Block Size Exception"**
- **Cause**: Input length doesn't match `minBlockSize`/`maxBlockSize` (block ciphers)
- **Solution**: Validate input length in your methods

❌ **"Hash function returned wrong length"**
- **Cause**: Hash output doesn't match expected digest size
- **Solution**: Ensure your Hash() method returns correct number of bytes

❌ **"Compression round-trip failed"** 
- **Cause**: Decompress(Compress(data)) != data
- **Solution**: Debug your compression/decompression logic for data integrity

❌ **"Encoding round-trip failed"**
- **Cause**: Decode(Encode(data)) != data  
- **Solution**: Ensure encoding/decoding are exact inverses

❌ **"MAC verification failed"**
- **Cause**: Generate() and Verify() methods are inconsistent
- **Solution**: Ensure Verify(key, msg, Generate(key, msg)) returns true

❌ **"Stream cipher keystream mismatch"**
- **Cause**: encrypt() and decrypt() generate different keystreams
- **Solution**: Ensure both methods generate identical keystream sequences

❌ **"KDF output length incorrect"**
- **Cause**: DeriveKey() doesn't return requested key length
- **Solution**: Verify output byte array has exact requested length

❌ **"Test vector mismatch"**
- **Cause**: Algorithm output doesn't match expected result
- **Solution**: Debug your core algorithm logic with test vectors

❌ **"Algorithm not found"**
- **Cause**: Algorithm not properly registered with appropriate subsystem
- **Solution**: Call correct registration function based on category:
  - Block/Stream Ciphers: `global.Cipher.AddCipher(YourAlgorithm)`
  - Hash Functions: `global.Hash.AddHash(YourAlgorithm)` (if hash subsystem exists)
  - Other: Follow category-specific registration pattern

### Testing Checklist

Before submitting your algorithm, verify:

✅ **Required Properties** (all algorithms):
- [ ] `name` property set with clear algorithm name
- [ ] `category` property matches approved categories
- [ ] `subCategory` property matches approved subcategories
- [ ] Complete metadata (description, inventor, year, etc.)

✅ **Category-Specific Properties**:
- [ ] Block/Stream Ciphers: `internalName`, `minKeyLength`, `maxKeyLength`, `instances`
- [ ] Block Ciphers: `minBlockSize`, `maxBlockSize`, `cantDecode`
- [ ] Hash Functions: Appropriate digest size documentation
- [ ] Compression: Input/output size relationships documented
- [ ] MAC/KDF: Key size requirements specified

✅ **Required Methods** (category-dependent):
- [ ] **Block Ciphers**: `KeySetup(key)`, `encryptBlock(id, plaintext)`, `decryptBlock(id, ciphertext)`
- [ ] **Stream Ciphers**: `KeySetup(key, iv)`, `encrypt(id, plaintext)`, `decrypt(id, ciphertext)`
- [ ] **Hash Functions**: `Init()`, `Hash(input)`
- [ ] **Compression**: `Init()`, `Compress(input)`, `Decompress(compressed)`
- [ ] **Encoding**: `Init()`, `Encode(input)`, `Decode(encoded)`
- [ ] **MAC**: `Init()`, `Generate(key, message)`, `Verify(key, message, mac)`
- [ ] **KDF**: `Init()`, `DeriveKey(password, salt, iterations, keyLength)`
- [ ] **Checksum**: `Init()`, `Calculate(input)`
- [ ] **ECC**: `Init()`, `GenerateKeyPair()`, `Sign()`, `Verify()` or similar
- [ ] **Classical**: `Init()`, `Encrypt(plaintext, key)`, `Decrypt(ciphertext, key)`

✅ **Error Handling**:
- [ ] All methods use `global.throwException` for errors
- [ ] Proper error message format: `(type, value, algorithmName, methodName)`
- [ ] Methods return sensible defaults when errors occur
- [ ] Input validation (key sizes, block sizes, parameter ranges)

✅ **Test Vectors**:
- [ ] At least 3 test vectors provided for main functionality
- [ ] Test vectors use `OpCodes.Hex8ToBytes()`, `OpCodes.StringToBytes()`, or similar
- [ ] Official sources linked in `uri` field (NIST, RFC, papers)
- [ ] Test vectors cover edge cases (empty input, maximum sizes, etc.)
- [ ] All test vectors pass when algorithm is run

✅ **Integration**:
- [ ] Dependencies loaded (`OpCodes.js`, `cipher.js`, etc.)
- [ ] Algorithm auto-registers with appropriate subsystem
- [ ] No console errors when loading algorithm file
- [ ] Proper IIFE wrapper with global/window detection

✅ **Round-Trip Testing**:
- [ ] **Block/Stream Ciphers**: encrypt(decrypt(x)) == x and decrypt(encrypt(x)) == x
- [ ] **Compression**: decompress(compress(x)) == x
- [ ] **Encoding**: decode(encode(x)) == x
- [ ] **MAC**: verify(key, msg, generate(key, msg)) == true
- [ ] **KDF**: Deterministic output for same inputs

### Manual Testing

Test your algorithm manually before submitting:

```javascript
// 1. Load your algorithm file
// 2. Test basic functionality:
const testKey = OpCodes.Hex8ToBytes("0123456789abcdef0123456789abcdef");
const testInput = OpCodes.Hex8ToBytes("0123456789abcdef");

const id = YourAlgorithm.KeySetup(testKey);
const encrypted = YourAlgorithm.encryptBlock(id, testInput);
const decrypted = YourAlgorithm.decryptBlock(id, encrypted);

console.log("Round-trip test:", testInput === decrypted);
```
