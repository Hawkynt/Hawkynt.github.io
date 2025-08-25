# Hash Algorithms

This directory contains implementations of various cryptographic and non-cryptographic hash functions. The following comprehensive list includes algorithms researched from multiple Wikipedia sources (English, German, Chinese, Russian, Japanese, Arabic).

## Implemented Algorithms ✅

### Cryptographic Hash Functions

#### Modern Secure Hashes
- [x] **BLAKE2b** (`blake2b.js`) - Fast secure hash function
- [x] **BLAKE2s** (`blake2s.js`) - Fast secure hash function (smaller variant)
- [x] **BLAKE3** (`blake3.js`) - Latest BLAKE hash function
- [x] **BLAKE3 Enhanced** (`blake3-enhanced.js`) - Extended BLAKE3 implementation
- [x] **SHA-1** (`sha1.js`) - Secure Hash Algorithm 1 (deprecated)
- [x] **SHA-224** (`sha224.js`) - SHA-2 variant with 224-bit output
- [x] **SHA-256** (`sha256.js`) - SHA-2 with 256-bit output
- [x] **SHA-384** (`sha384.js`) - SHA-2 with 384-bit output
- [x] **SHA-512** (`sha512.js`) - SHA-2 with 512-bit output
- [x] **SHA3-256** (`sha3-256.js`) - SHA-3 with 256-bit output
- [x] **SHAKE128** (`shake128.js`) - Extendable-output function
- [x] **Whirlpool** (`whirlpool.js`) - 512-bit cryptographic hash

#### SHA-3 Competition Finalists
- [x] **Grøstl** (`groestl.js`) - AES-based hash function
- [x] **JH** (`jh.js`) - Bitslice-based hash function
- [x] **Skein** (`skein.js`) - Threefish-based hash function

#### Other Cryptographic Hashes
- [x] **HAVAL** (`haval.js`) - Variable output length hash
- [x] **MD2** (`md2.js`) - Message Digest 2 (obsolete)
- [x] **MD4** (`md4.js`) - Message Digest 4 (broken)
- [x] **MD5** (`md5.js`) - Message Digest 5 (broken)
- [x] **RadioGatún** (`radiogatun.js`) - Stream cipher and hash function
- [x] **RIPEMD-160** (`ripemd160.js`) - RACE Integrity Primitives Evaluation
- [x] **RIPEMD-256** (`ripemd256.js`) - Extended RIPEMD variant
- [x] **RIPEMD-320** (`ripemd320.js`) - Extended RIPEMD variant
- [x] **Streebog** (`streebog.js`) - Russian national standard hash
- [x] **Tiger** (`tiger.js`) - Fast hash function optimized for 64-bit platforms

#### Password Hashing & KDFs
- [x] **Argon2** (`argon2.js`) - Modern password hashing function
- [x] **bcrypt** (`bcrypt.js`) - Adaptive hash function for passwords

### Non-Cryptographic Hash Functions
- [x] **CityHash** (`cityhash.js`) - Fast hash function for strings
- [x] **FNV** (`fnv.js`) - Fowler-Noll-Vo hash function
- [x] **HighwayHash** (`highway-hash.js`) - Fast keyed hash function
- [x] **MurmurHash3** (`murmurhash3.js`) - Non-cryptographic hash function
- [x] **SipHash** (`siphash.js`) - Fast short-input PRF
- [x] **xxHash** (`xxhash.js`) - Extremely fast hash algorithm
- [x] **xxHash3** (`xxhash3.js`) - Latest xxHash variant
- [x] **xxHash32** (`xxhash32.js`) - 32-bit variant of xxHash

## Missing Algorithms ❌

### Cryptographic Hash Functions

#### Modern Standards
- [ ] **SHA-0** - Original SHA (withdrawn)
- [ ] **SHA-512/224** - SHA-2 variant with truncated output
- [ ] **SHA-512/256** - SHA-2 variant with truncated output
- [ ] **SHA3-224** - SHA-3 with 224-bit output
- [ ] **SHA3-384** - SHA-3 with 384-bit output
- [ ] **SHA3-512** - SHA-3 with 512-bit output
- [ ] **SHAKE256** - Extendable-output function

#### SHA-3 Competition Candidates
- [ ] **BLAKE** - Original BLAKE hash function
- [ ] **Blue Midnight Wish** - SHA-3 candidate
- [ ] **CubeHash** - Simple hash function
- [ ] **ECHO** - AES-based hash function
- [ ] **Fugue** - SHA-3 candidate
- [ ] **Hamsi** - Substitution-permutation network hash
- [ ] **Kupyna** - Ukrainian national hash standard
- [ ] **Luffa** - SHA-3 candidate
- [ ] **SHABAL** - SHA-3 candidate
- [ ] **SHAvite-3** - AES-based hash function
- [ ] **SIMD** - Parallel hash function

#### International Standards
- [ ] **GOST R 34.11-94** - Russian hash standard (old)
- [ ] **GOST R 34.11-2012** - Russian hash standard (Streebog)
- [ ] **SM3** - Chinese national hash standard
- [ ] **HAS-160** - Korean hash standard

#### Historical & Specialized
- [ ] **RIPEMD** - Original RIPEMD
- [ ] **RIPEMD-128** - 128-bit RIPEMD variant
- [ ] **MD6** - Proposed successor to MD5
- [ ] **MDC-2** - Hash function based on block ciphers
- [ ] **N-Hash** - Hash function
- [ ] **Snefru** - Early cryptographic hash function
- [ ] **VSH** - Very Smooth Hash
- [ ] **FSB** - Fast Syndrome Based hash
- [ ] **SWIFFT** - Lattice-based hash function
- [ ] **LM hash** - LAN Manager hash (obsolete)
- [ ] **NTLM** - NT LAN Manager hash
- [ ] **PBKDF2** - Password-Based Key Derivation Function
- [ ] **scrypt** - Password-based key derivation function
- [ ] **Balloon Hashing** - Memory-hard hash function

#### Specialized Cryptographic Hashes
- [ ] **PANAMA** - Hash function and stream cipher
- [ ] **SMASH** - Simple hash function
- [ ] **FORK-256** - Hash function
- [ ] **FFT-Hash** - Fast Fourier Transform based hash
- [ ] **Edonkey2k** - Hash used in eDonkey network
- [ ] **MASH-1** - Modular Arithmetic Secure Hash
- [ ] **X11** - Chained hash algorithm (cryptocurrency)

### Non-Cryptographic Hash Functions
- [ ] **Jenkins hash function** - Simple hash function
- [ ] **DJB2** - Simple hash function by Dan Bernstein
- [ ] **SDBM** - Hash function used in SDBM database
- [ ] **lose lose** - Trivial hash function
- [ ] **Pearson hashing** - Hash function based on lookup table
- [ ] **Zobrist hashing** - Hash function used in game programming
- [ ] **Rolling hash** - Hash function allowing efficient recomputation
- [ ] **MinHash** - Locality sensitive hashing
- [ ] **SimHash** - Locality sensitive hashing for near-duplicate detection
- [ ] **Consistent hashing** - Distributed hashing technique

### Specialized Hash Applications
- [ ] **ECOH** - Elliptic Curve Only Hash
- [ ] **MINMAX** - Hash function
- [ ] **Truncated SHA variants** - Various truncated outputs
- [ ] **Keyed hash functions** - HMAC variants and others

## Algorithm Categories

### By Security Level
- **Secure**: SHA-2, SHA-3, BLAKE2/3, Whirlpool, Streebog
- **Broken**: MD4, MD5, SHA-1 (collision attacks)
- **Obsolete**: MD2, SHA-0, LM hash

### By Performance
- **Very Fast**: xxHash, CityHash, FNV, MurmurHash
- **Fast**: BLAKE2, SipHash, HighwayHash
- **Medium**: SHA-256, SHA-512, RIPEMD-160
- **Slow**: Argon2, bcrypt, scrypt (intentionally slow)

### By Output Size
- **128-bit**: MD5, MD4, RIPEMD-128
- **160-bit**: SHA-1, RIPEMD-160
- **224-bit**: SHA-224, SHA3-224
- **256-bit**: SHA-256, SHA3-256, BLAKE2s
- **384-bit**: SHA-384, SHA3-384
- **512-bit**: SHA-512, SHA3-512, BLAKE2b, Whirlpool
- **Variable**: HAVAL, SHAKE128/256

### By Design
- **Merkle-Damgård**: MD5, SHA-1, SHA-2
- **Sponge**: SHA-3, SHAKE
- **HAIFA**: BLAKE2
- **Wide-pipe**: Grøstl, Skein

## Implementation Notes

All hash algorithms in this collection:
- Follow the universal cipher pattern established in the codebase
- Support both Node.js and browser environments
- Include comprehensive test vectors from official sources
- Implement proper error handling and input validation
- Are designed for educational and research purposes

## References

- [English Wikipedia - Cryptographic Hash Function](https://en.wikipedia.org/wiki/Cryptographic_hash_function)
- [German Wikipedia - Kryptographische Hashfunktion](https://de.wikipedia.org/wiki/Kryptographische_Hashfunktion)
- [Chinese Wikipedia - 密码雜湊函數](https://zh.wikipedia.org/wiki/%E5%AF%86%E7%A2%BC%E9%9B%9C%E6%B9%8A%E5%87%BD%E6%95%B8)
- [Russian Wikipedia - Криптографическая хеш-функция](https://ru.wikipedia.org/wiki/%D0%9A%D1%80%D0%B8%D0%BF%D1%82%D0%BE%D0%B3%D1%80%D0%B0%D1%84%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B0%D1%8F_%D1%85%D1%8D%D1%88-%D1%84%D1%83%D0%BD%D0%BA%D1%86%D0%B8%D1%8F)
- [Japanese Wikipedia - 暗号学的ハッシュ関数](https://ja.wikipedia.org/wiki/%E6%9A%97%E5%8F%B7%E5%AD%A6%E7%9A%84%E3%83%8F%E3%83%83%E3%82%B7%E3%83%A5%E9%96%A2%E6%95%B0)
