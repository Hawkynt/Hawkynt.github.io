# Cryptographic Algorithms

This directory contains implementations of various cryptographic algorithms organized by category. The following comprehensive list includes algorithms researched from multiple Wikipedia sources (English, German, Chinese, Russian, Japanese, Arabic).

## Algorithm Categories

### Directory Structure
```
algorithms/
├── block/          Block ciphers (58 algorithms)
├── stream/         Stream ciphers (42 algorithms)  
├── hash/           Hash functions (34 algorithms)
├── classical/      Classical ciphers (23 algorithms)
├── encoding/       Encoding schemes (21 algorithms)
├── compression/    Compression algorithms (19 algorithms)
├── asymmetric/     Public-key cryptography (16 algorithms)
├── special/        Special constructs (16 algorithms)
├── mac/           Message authentication codes (6 algorithms)
├── kdf/           Key derivation functions (4 algorithms)
├── ecc/           Error correction codes (4 algorithms)
└── checksum/      Checksum algorithms (1 algorithm)
```

## Implemented Block Ciphers ✅

### Modern Standards
- [x] **AES/Rijndael** (`rijndael.js`) - Advanced Encryption Standard
- [x] **3DES** (`3des.js`) - Triple Data Encryption Standard
- [x] **DES** (`des.js`) - Data Encryption Standard
- [x] **Blowfish** (`blowfish.js`) - Variable-length key cipher
- [x] **Twofish** (`twofish.js`) - AES finalist
- [x] **Serpent** (`serpent.js`) - AES finalist
- [x] **MARS** (`mars.js`) - AES finalist
- [x] **RC5** (`rc5.js`) - Variable block size cipher
- [x] **RC6** (`rc6.js`) - AES finalist
- [x] **IDEA** (`idea.js`) - International Data Encryption Algorithm

### National Standards
- [x] **Camellia** (`camellia.js`) - Japanese standard
- [x] **GOST 28147** (`gost28147.js`) - Soviet/Russian standard
- [x] **GOST Kuznyechik** (`gost-kuznyechik.js`) - Modern Russian standard
- [x] **SM4** (`sm4.js`) - Chinese national standard
- [x] **ARIA** (`aria.js`) - South Korean standard
- [x] **SEED** (`seed.js`) - South Korean standard
- [x] **Kalyna** (`kalyna.js`) - Ukrainian standard

### Lightweight Ciphers
- [x] **TEA** (`tea.js`) - Tiny Encryption Algorithm
- [x] **XTEA** (`xtea.js`) - Extended TEA
- [x] **XXTEA** (`xxtea.js`) - Corrected Block TEA
- [x] **PRESENT** (`present.js`) - Ultra-lightweight cipher
- [x] **Simon** (`simon.js`) - NSA lightweight cipher family
- [x] **Speck** (`speck.js`) - NSA lightweight cipher family
- [x] **LEA** (`lea.js`) - Lightweight encryption algorithm
- [x] **CHAM** (`cham.js`) - Lightweight block cipher

### Research & Historical
- [x] **Lucifer** (`lucifer.js`) - DES predecessor
- [x] **FEAL** (`feal.js`) - Fast data Encipherment Algorithm
- [x] **Square** (`square.js`) - Predecessor to Rijndael
- [x] **Anubis** (`anubis.js`) - NESSIE submission
- [x] **Khazad** (`khazad.js`) - NESSIE submission
- [x] **NOEKEON** (`noekeon.js`) - Simple cipher design

## Implemented Stream Ciphers ✅

### Modern Standards
- [x] **ChaCha20** (`chacha20.js`) - Modern stream cipher
- [x] **XChaCha20** (`xchacha20.js`) - Extended nonce ChaCha20
- [x] **Salsa20** (`salsa20.js`) - High-speed stream cipher
- [x] **XSalsa20** (`xsalsa20.js`) - Extended nonce Salsa20
- [x] **RC4** (`rc4.js`) - Rivest Cipher 4

### Mobile/GSM
- [x] **A5/1** (`a5-1.js`) - GSM encryption algorithm
- [x] **A5/2** (`a5-2.js`) - Export version of A5/1
- [x] **A5/3** (`a5-3.js`) - 3G encryption algorithm

### Modern Secure Ciphers
- [x] **Grain** (`grain.js`) - Hardware-oriented stream cipher
- [x] **Trivium** (`trivium.js`) - Hardware-oriented stream cipher
- [x] **Mickey** (`mickey.js`) - Mutual Irregular Clocking KEYstream
- [x] **Rabbit** (`rabbit.js`) - High-performance stream cipher
- [x] **HC-128/256** (`hc-128.js`, `hc-256.js`) - Stream cipher family

## Implemented Classical Ciphers ✅

### Substitution Ciphers
- [x] **Caesar** (`caesar.js`) - Simple shift cipher
- [x] **Affine** (`affine.js`) - Linear substitution cipher
- [x] **Playfair** (`playfair.js`) - Digraph substitution cipher
- [x] **Hill** (`hill.js`) - Polygraphic substitution cipher
- [x] **Polybius** (`polybius.js`) - Square cipher

### Polyalphabetic Ciphers
- [x] **Vigenère** (`vigenere.js`) - Polyalphabetic substitution
- [x] **Beaufort** (`beaufort.js`) - Variant of Vigenère
- [x] **Autokey** (`autokey.js`) - Self-extending key cipher
- [x] **Porta** (`porta.js`) - Polyalphabetic cipher

### Transposition Ciphers
- [x] **Rail Fence** (`railfence.js`) - Zigzag transposition
- [x] **Columnar** (`columnar.js`) - Columnar transposition
- [x] **Scytale** (`scytale.js`) - Ancient transposition cipher

### Complex Classical
- [x] **Enigma** (`enigma.js`) - German cipher machine
- [x] **Four Square** (`foursquare.js`) - Digraph cipher
- [x] **Bifid** (`bifid.js`) - Combines substitution and transposition

## Missing Cryptographic Algorithms ❌

### Block Ciphers
- [ ] **CAST-128/256** - CAST encryption algorithms
- [ ] **DEAL** - Data Encryption Algorithm with Larger blocks
- [ ] **SAFER** - Secure And Fast Encryption Routine
- [ ] **RC2** - Variable key-size block cipher
- [ ] **Skipjack** - NSA encryption algorithm
- [ ] **MAGENTA** - AES candidate
- [ ] **Hierocrypt** - Block cipher family
- [ ] **KASUMI** - 3GPP block cipher
- [ ] **MISTY1/2** - Japanese block ciphers
- [ ] **CLEFIA** - Sony block cipher
- [ ] **Threefish** - Skein hash function's block cipher

### Stream Ciphers
- [ ] **SNOW** - Stream cipher family (SNOW-V, SNOW 3G)
- [ ] **SOBER** - Stream cipher
- [ ] **SEAL** - Software-Efficient Algorithm
- [ ] **WAKE** - Word Auto Key Encryption
- [ ] **MUGI** - Japanese stream cipher
- [ ] **MULTI-S01** - Stream cipher
- [ ] **LILI-128** - Irregular clocking stream cipher
- [ ] **E0** - Bluetooth encryption algorithm
- [ ] **Dragon** - Stream cipher
- [ ] **Phelix** - Stream cipher with authentication
- [ ] **VEST** - Stream cipher family

### Asymmetric Cryptography
- [ ] **Diffie-Hellman** - Key exchange protocol
- [ ] **ElGamal** - Public-key cryptosystem
- [ ] **ECC** - Elliptic Curve Cryptography
- [ ] **DSA** - Digital Signature Algorithm
- [ ] **ECDSA** - Elliptic Curve DSA
- [ ] **Cramer-Shoup** - Public-key cryptosystem
- [ ] **Rabin** - Public-key cryptosystem
- [ ] **McEliece** - Code-based cryptosystem
- [ ] **Merkle-Hellman** - Knapsack cryptosystem
- [ ] **Paillier** - Probabilistic public-key system

### Message Authentication Codes (MACs)
- [ ] **HMAC** - Hash-based MAC
- [ ] **CMAC** - Cipher-based MAC
- [ ] **GMAC** - Galois MAC
- [ ] **Poly1305** - MAC function
- [ ] **SipHash** - MAC for hash tables
- [ ] **BLAKE2** - Keyed hash function

### Key Derivation Functions
- [ ] **PBKDF2** - Password-Based Key Derivation Function
- [ ] **scrypt** - Password-based KDF
- [ ] **bcrypt** - Password hashing function
- [ ] **HKDF** - HMAC-based KDF

### Authenticated Encryption
- [ ] **AES-GCM** - Galois/Counter Mode
- [ ] **AES-CCM** - Counter with CBC-MAC
- [ ] **AES-EAX** - Authenticated encryption mode
- [ ] **AES-OCB** - Offset Codebook Mode
- [ ] **ChaCha20-Poly1305** - AEAD construction
- [ ] **XChaCha20-Poly1305** - Extended AEAD

## Algorithm Status by Category

| Category | Implemented | Missing | Total | Coverage |
|----------|-------------|---------|-------|----------|
| **Block Ciphers** | 58 | ~40 | ~98 | 59% |
| **Stream Ciphers** | 42 | ~25 | ~67 | 63% |
| **Hash Functions** | 34 | ~50 | ~84 | 40% |
| **Classical Ciphers** | 23 | ~15 | ~38 | 61% |
| **Compression** | 19 | ~48 | ~67 | 28% |
| **Asymmetric** | 16 | ~20 | ~36 | 44% |
| **MACs** | 6 | ~10 | ~16 | 38% |
| **KDFs** | 4 | ~8 | ~12 | 33% |
| **Overall** | **202** | **~216** | **~418** | **48%** |

## Implementation Quality

All algorithms in this collection:
- ✅ Follow the universal cipher pattern
- ✅ Support Node.js and browser environments  
- ✅ Include comprehensive test vectors
- ✅ Implement proper error handling
- ✅ Are designed for educational purposes
- ✅ Include metadata compliance checking
- ✅ Support cross-language code generation

## Security Classifications

### 🔴 **Broken/Insecure** (Do not use for security)
- MD2, MD4, MD5, SHA-1, DES, RC4, A5/1, A5/2, Classical ciphers

### 🟡 **Deprecated** (Avoid for new applications)  
- 3DES, Blowfish (64-bit block), IDEA (patent issues)

### 🟢 **Secure** (Recommended for current use)
- AES, ChaCha20, SHA-2, SHA-3, BLAKE2/3, Modern authenticated encryption

### 🔵 **Post-Quantum** (Future-ready)
- CRYSTALS-Kyber, CRYSTALS-Dilithium, SPHINCS+, FALCON

## Performance Tiers

### ⚡ **Ultra-Fast**
- ChaCha20, xxHash, CityHash, RC4

### 🚀 **Fast** 
- AES (with hardware), BLAKE2, Salsa20

### ⚖️ **Balanced**
- Most modern block ciphers, SHA-2

### 🐌 **Slow** (Intentionally)
- Argon2, bcrypt, scrypt (password hashing)

## Educational Value

This comprehensive collection serves as:
- 📚 **Cryptographic Learning Resource** - Study algorithm evolution
- 🔬 **Research Platform** - Compare different approaches  
- 🛠️ **Implementation Reference** - Cross-language code generation
- 📊 **Performance Analysis** - Benchmark different algorithms
- 🔍 **Security Analysis** - Understand vulnerabilities and improvements

---

**Total Cryptographic Algorithms**: 202/418+ implemented (48% coverage)

For detailed information about specific categories, see the README.md files in each subdirectory.