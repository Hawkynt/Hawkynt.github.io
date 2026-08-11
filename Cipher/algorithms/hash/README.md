# Hash Algorithms

This directory contains implementations of various cryptographic and non-cryptographic hash functions. The following comprehensive list includes algorithms researched from multiple Wikipedia sources (English, German, Chinese, Russian, Japanese, Arabic).

## Implemented Algorithms

<!-- BEGIN GENERATED ALGORITHM LIST -->

115 implemented, generated from the registry by `tools/refresh-readmes.js`.

- **ASCON-HASH** (`ascon-hash.js`) - Lightweight hash function based on Ascon permutation, finalist in CAESAR competition and standardized by NIST
- **Ascon-Hash256** (`ascon-hash.js`) - Lightweight hash function based on Ascon permutation, standardized in NIST SP 800-232
- **ASCON-XOF** (`ascon-hash.js`) - Lightweight extendable output function (XOF) based on Ascon permutation, standardized by NIST
- **BLAKE-224** (`blake.js`) - BLAKE-224 hash function from SHA-3 competition
- **BLAKE-256** (`blake.js`) - BLAKE-256 hash function from SHA-3 competition
- **BLAKE-384** (`blake.js`) - BLAKE-384 hash function from SHA-3 competition
- **BLAKE-512** (`blake.js`) - BLAKE-512 hash function from SHA-3 competition
- **BLAKE2b** (`blake2.js`) - BLAKE2b is a high-speed cryptographic hash function optimized for 64-bit platforms
- **BLAKE2s** (`blake2.js`) - BLAKE2s is a high-speed cryptographic hash function optimized for 8-32 bit platforms
- **BLAKE2xs** (`blake2.js`) - BLAKE2xs is an eXtendable Output Function (XOF) based on BLAKE2s
- **BLAKE3** (`blake3.js`) - Modern cryptographic hash function based on BLAKE2
- **BLAKE3-Enhanced** (`blake3-enhanced.js`) - Enhanced educational implementation of BLAKE3 cryptographic hash function
- **CHC** (`chc.js`) - Cipher Hash Construction builds a cryptographic hash from a block cipher using Matyas-Meyer-Oseas construction
- **CityHash** (`cityhash.js`) - Fast non-cryptographic hash function developed by Google
- **COMB4P(MD4,MD5)** (`comb4p.js`) - COMB4P hash combiner using MD4 and MD5
- **COMB4P(SHA-1,RIPEMD-160)** (`comb4p.js`) - COMB4P hash combiner using SHA-1 and RIPEMD-160
- **cSHAKE128** (`cshake.js`) - cSHAKE128 is a customizable extendable-output function based on SHAKE128 from NIST SP 800-185
- **cSHAKE256** (`cshake.js`) - cSHAKE256 is a customizable extendable-output function based on SHAKE256 from NIST SP 800-185
- **CubeHash-256** (`cubehash.js`) - CubeHash-16+16/32+16-256 variant producing 256-bit hashes
- **CubeHash-512** (`cubehash.js`) - CubeHash-16+16/32+16-512 hash function designed by Daniel J
- **DryGASCON128-HASH** (`drygascon-hash.js`) - Lightweight hash function using DrySPONGE construction with GASCON permutation
- **DryGASCON256-HASH** (`drygascon-hash.js`) - Extended lightweight hash function using DrySPONGE construction with GASCON permutation
- **DSTU7564 (Kupyna)** (`dstu7564.js`) - Ukrainian national standard hash function
- **DSTU7564-256 (Kupyna-256)** (`kupyna.js`) - Ukrainian National Standard hash function (DSTU 7564:2014)
- **DSTU7564-512 (Kupyna-512)** (`kupyna.js`) - Ukrainian National Standard hash function (DSTU 7564:2014)
- **ECHO** (`echo.js`) - ECHO is an AES-based cryptographic hash function submitted to the NIST SHA-3 competition (Round 2)
- **Esch256** (`esch256.js`) - NIST Lightweight Cryptography finalist based on SPARKLE-384 permutation
- **Esch384** (`esch384.js`) - NIST Lightweight Cryptography finalist based on SPARKLE-512 permutation
- **FNV-1a** (`fnv.js`) - FNV-1a is a fast non-cryptographic hash function with good distribution properties
- **Fugue-224** (`fugue.js`) - Fugue-224 is an AES-inspired cryptographic hash function with 224-bit output, submitted to the NIST SHA-3 competition (2008-2012)
- **Fugue-256** (`fugue.js`) - Fugue-256 is an AES-inspired cryptographic hash function with 256-bit output, submitted to the NIST SHA-3 competition (2008-2012)
- **Fugue-384** (`fugue.js`) - Fugue-384 is an AES-inspired cryptographic hash function with 384-bit output, submitted to the NIST SHA-3 competition (2008-2012)
- **Fugue-512** (`fugue.js`) - Fugue-512 is an AES-inspired cryptographic hash function with 512-bit output, submitted to the NIST SHA-3 competition (2008-2012)
- **GIMLI-24-HASH** (`gimli24-hash.js`) - Lightweight hash function based on the GIMLI-24 permutation using a sponge construction
- **GOST R 34.11-94** (`gost3411.js`) - Soviet/Russian national hash standard producing 256-bit digests
- **Grøstl** (`groestl.js`) - Grøstl is a cryptographic hash function designed as a SHA-3 candidate
- **Hamsi-224** (`hamsi.js`) - SHA-3 candidate hash function with 224-bit output
- **Hamsi-256** (`hamsi.js`) - SHA-3 candidate hash function with 256-bit output
- **Hamsi-384** (`hamsi.js`) - SHA-3 candidate hash function with 384-bit output
- **Hamsi-512** (`hamsi.js`) - SHA-3 candidate hash function with 512-bit output
- **Haraka-256** (`haraka.js`) - High-performance hash function optimized for short inputs using AES round function
- **Haraka-512** (`haraka.js`) - High-performance hash function for 512-bit inputs producing 256-bit output using AES round function
- **HAVAL** (`haval.js`) - HAVAL (HAsh of Variable Length) is a cryptographic hash function with variable output length (128, 160, 192, 224, 256 bits) and variable passes (3, 4, 5)
- **HighwayHash** (`highway-hash.js`) - Educational implementation of HighwayHash-style keyed hash function
- **ISAP Hash** (`isap-hash.js`) - Ascon-based hash function used in the ISAP authenticated encryption scheme
- **JH** (`jh.js`) - JH is a cryptographic hash function with bitslice design submitted to the NIST SHA-3 competition
- **KangarooTwelve** (`kangaroo.js`) - Fast hashing based on Keccak-p[1600,12] with tree structure for parallel processing
- **Keccak (DarkCrypt)** (`darkcrypt-keccak.js`) - Keccak sponge hash variant used by the DarkCrypt Total Commander plugin
- **Keccak-224** (`keccak.js`) - Original Keccak-224 hash function (pre-SHA3)
- **Keccak-256** (`keccak.js`) - Original Keccak-256 hash function (pre-SHA3)
- **Keccak-384** (`keccak.js`) - Original Keccak-384 hash function (pre-SHA3)
- **Keccak-512** (`keccak.js`) - Original Keccak-512 hash function (pre-SHA3)
- **KNOT-HASH-256-256** (`knot-hash.js`) - Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition
- **KNOT-HASH-256-384** (`knot-hash.js`) - Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition
- **KNOT-HASH-384-384** (`knot-hash.js`) - Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition
- **KNOT-HASH-512-512** (`knot-hash.js`) - Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition
- **LSH-224** (`lsh.js`) - Korean Lightweight Secure Hash producing 224-bit digests
- **LSH-256** (`lsh.js`) - Korean Lightweight Secure Hash producing 256-bit digests
- **LSH-384** (`lsh.js`) - Korean cryptographic hash function standard producing 384-bit digests
- **LSH-512** (`lsh.js`) - Korean cryptographic hash function standard producing 512-bit digests
- **LSH-512-256** (`lsh.js`) - Korean cryptographic hash function standard producing 256-bit digests
- **Luffa-224** (`luffa.js`) - SHA-3 candidate hash function producing 224-bit outputs using 3 parallel state chains with a sponge-like construction
- **Luffa-256** (`luffa.js`) - SHA-3 candidate hash function producing 256-bit outputs using 3 parallel state chains with a sponge-like construction
- **Luffa-384** (`luffa.js`) - SHA-3 candidate hash function producing 384-bit outputs using 4 parallel state chains with a sponge-like construction
- **Luffa-512** (`luffa.js`) - SHA-3 candidate hash function producing 512-bit outputs using 5 parallel state chains with a sponge-like construction
- **MD2** (`md.js`) - MD2 is a 128-bit cryptographic hash function and predecessor to MD4 and MD5
- **MD4** (`md.js`) - MD4 is a 128-bit cryptographic hash function and predecessor to MD5
- **MD5** (`md.js`) - 128-bit cryptographic hash function designed by Ronald Rivest
- **MD6 (DarkCrypt)** (`darkcrypt-md6.js`) - Standard MD6-512 hash function as used by the DarkCrypt Total Commander plugin: the unmodified MIT reference MD6 implementation, hardcoded to digest size d=512 bits, r=168 rounds, mode parameter L=64 (fully hierarchical), and no key
- **MDC-2** (`mdc2.js`) - Modification Detection Code 2, an ISO/IEC 10118-2 standard hash function based on DES encryption
- **MurmurHash3** (`murmurhash3.js`) - Fast non-cryptographic hash function with excellent distribution properties
- **Panama-BE** (`panama.js`) - Panama hash function with big-endian byte order
- **Panama-BE-MAC** (`panama.js`) - Panama-BE MAC using hermetic hash function construction
- **Panama-LE** (`panama.js`) - Panama hash function with little-endian byte order
- **Panama-LE-MAC** (`panama.js`) - Panama-LE MAC using hermetic hash function construction
- **ParallelHash128** (`parallelhash.js`) - ParallelHash128 is a parallel hash function from NIST SP 800-185 that supports efficient hashing of very long strings using parallelism
- **ParallelHash256** (`parallelhash.js`) - ParallelHash256 is a parallel hash function from NIST SP 800-185 that supports efficient hashing of very long strings using parallelism
- **PhotonBeetle Hash** (`photon-beetle-hash.js`) - Lightweight hash function based on the PHOTON permutation, finalist in NIST Lightweight Cryptography competition
- **RadioGatún** (`radiogatun.js`) - RadioGatún is a belt-and-mill hash function that served as a predecessor to Keccak/SHA-3 design
- **RIPEMD-128** (`ripemd.js`) - RACE Integrity Primitives Evaluation Message Digest with 128-bit output
- **RIPEMD-160** (`ripemd.js`) - RACE Integrity Primitives Evaluation Message Digest with 160-bit output
- **RIPEMD-256** (`ripemd.js`) - RIPEMD-256 is an extension of RIPEMD-128 with 256-bit output
- **RIPEMD-320** (`ripemd.js`) - Extended RIPEMD hash function producing 320-bit digest
- **SHA-3-224** (`sha3.js`) - SHA-3-224 produces 224-bit digests using the Keccak sponge construction with capacity 448 bits
- **SHA-3-256** (`sha3.js`) - SHA-3-256 produces 256-bit digests using the Keccak sponge construction with capacity 512 bits
- **SHA-3-384** (`sha3.js`) - SHA-3-384 produces 384-bit digests using the Keccak sponge construction with capacity 768 bits
- **SHA-3-512** (`sha3.js`) - SHA-3-512 produces 512-bit digests using the Keccak sponge construction with capacity 1024 bits
- **SHA-384** (`sha512.js`) - SHA-384 (Secure Hash Algorithm 384-bit) is a cryptographic hash function from the SHA-2 family
- **SHA-512** (`sha512.js`) - SHA-512 (Secure Hash Algorithm 512-bit) is a cryptographic hash function from the SHA-2 family designed by NIST
- **SHA-512/224** (`sha512.js`) - SHA-512/224 is a truncated variant of SHA-512 with a modified initialization vector, producing 224-bit hash values
- **SHA-512/256** (`sha512.js`) - SHA-512/256 is a truncated variant of SHA-512 with a modified initialization vector, producing 256-bit hash values
- **Shabal-192** (`shabal.js`) - Shabal-192 is a cryptographic hash function submitted to NIST SHA-3 competition
- **Shabal-224** (`shabal.js`) - Shabal-224 is a cryptographic hash function submitted to NIST SHA-3 competition
- **Shabal-256** (`shabal.js`) - Shabal-256 is a cryptographic hash function submitted to NIST SHA-3 competition
- **Shabal-384** (`shabal.js`) - Shabal-384 is a cryptographic hash function submitted to NIST SHA-3 competition
- **Shabal-512** (`shabal.js`) - Shabal-512 is a cryptographic hash function submitted to NIST SHA-3 competition
- **SHAKE128** (`shake.js`) - SHAKE128 is an extendable-output function (XOF) from NIST FIPS 202 with 128-bit security
- **SHAKE256** (`shake.js`) - SHAKE256 is an extendable-output function (XOF) from NIST FIPS 202 with 256-bit security
- **SipHash-2-4** (`siphash.js`) - Fast cryptographically secure pseudorandom function designed for hash tables and data structures requiring collision resistance
- **Skein** (`skein.js`) - Skein-512 hash function from NIST SHA-3 competition
- **Skein (DarkCrypt)** (`darkcrypt-skein.js`) - Skein-512-512 variant used by the DarkCrypt Total Commander plugin
- **SKINNY-tk2-HASH** (`skinny-hash.js`) - Lightweight hash function based on SKINNY-128-256 tweakable block cipher
- **SKINNY-tk3-HASH** (`skinny-hash.js`) - Lightweight hash function based on SKINNY-128-384 tweakable block cipher
- **SM3** (`sm3.js`) - Chinese national cryptographic hash standard producing 256-bit digests
- **SparkleHash** (`sparkle-hash.js`) - NIST Lightweight Cryptography finalist based on the Sparkle permutation
- **Streebog (GOST R 34.11-2012)** (`streebog.js`) - Russian Federal standard hash function specified in GOST R 34.11-2012
- **Subterranean-Hash** (`subterranean-hash.js`) - Lightweight cryptographic hash function designed by Joan Daemen based on a 257-bit permutation
- **Tiger** (`tiger.js`) - Tiger is a cryptographic hash function designed by Ross Anderson and Eli Biham in 1995 for efficiency on 64-bit platforms
- **TupleHash128** (`tuplehash.js`) - SHA-3 derived function for unambiguous tuple hashing with 128-bit security
- **TupleHash256** (`tuplehash.js`) - SHA-3 derived function for unambiguous tuple hashing with 256-bit security
- **Whirlpool** (`whirlpool.js`) - Whirlpool is a cryptographic hash function designed by Vincent Rijmen and Paulo S
- **Xoodyak Hash** (`xoodyak-hash.js`) - NIST Lightweight Cryptography finalist based on the Xoodoo permutation
- **xxHash** (`xxhash.js`) - Extremely fast non-cryptographic hash function designed for high performance applications like databases and compression systems
- **xxHash3** (`xxhash3.js`) - Ultra-fast non-cryptographic hash function optimized for speed and quality
- **xxHash32** (`xxhash32.js`) - xxHash is an extremely fast non-cryptographic hash algorithm designed by Yann Collet

<!-- END GENERATED ALGORITHM LIST -->

## Missing Algorithms ❌

### Cryptographic Hash Functions

#### Modern Standards
- [ ] **SHA-0** - Original SHA (withdrawn)

#### SHA-3 Competition Candidates
- [ ] **BLAKE** - Original BLAKE hash function
- [ ] **Blue Midnight Wish** - SHA-3 candidate
- [ ] **CubeHash** - Simple hash function
- [ ] **Fugue** - SHA-3 candidate
- [ ] **Hamsi** - Substitution-permutation network hash
- [ ] **Kupyna** - Ukrainian national hash standard
- [ ] **Luffa** - SHA-3 candidate
- [ ] **SHABAL** - SHA-3 candidate
- [ ] **SHAvite-3** - AES-based hash function
- [ ] **SIMD** - Parallel hash function

#### International Standards
- [ ] **GOST R 34.11-2012** - Russian hash standard (Streebog)
- [ ] **HAS-160** - Korean hash standard

#### Historical & Specialized
- [ ] **RIPEMD** - Original RIPEMD
- [ ] **N-Hash** - Hash function
- [ ] **Snefru** - Early cryptographic hash function
- [ ] **VSH** - Very Smooth Hash
- [ ] **FSB** - Fast Syndrome Based hash
- [ ] **SWIFFT** - Lattice-based hash function
- [ ] **LM hash** - LAN Manager hash (obsolete)
- [ ] **NTLM** - NT LAN Manager hash

#### Specialized Cryptographic Hashes
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
