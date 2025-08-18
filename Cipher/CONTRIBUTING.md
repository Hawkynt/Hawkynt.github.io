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
        input: Hex8ToBytes("..."),     // these are byte array always, use Hex8ToBytes()
        iv: ANSIToBytes("HelloWorld"), // or ANSIToBytes() helper
        key: null,                     // null means empty array
        expected: []                   // also empty array
      }
    ],

    Init: function() {
      return true;
    }

    // TODO: Implementation methods here...
  };

  // Auto-register with Subsystem (according to category) if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(NewAlgo); // Subsystem should check for metadata errors and decline request logging when failed.
  

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
