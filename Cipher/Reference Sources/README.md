# Cryptographic Reference Sources Collection

This directory contains comprehensive reference sources for cryptographic algorithm implementations and competition checklists used to enhance the SynthelicZ Cipher Tools project.

## Directory Structure

```
Reference Sources/
├── Libraries/           # Cloned cryptographic libraries
├── Checklists/         # Competition and project comparison checklists
└── README.md           # This overview document
```

## 📋 Checklist

Below is a table of all algorithms found in the wild and their current implementation status inside our JavaScript library.
Please mention where you found (Could be competitions, software, personal pages, academic papers, etc.), where to find reference source code (could be names of libraries, github pages, etc.).
A word on categories:

* block        : Symmetric key block ciphers (e.g., AES, DES, Blowfish), needs key
* stream       : Symmetric key stream ciphers (e.g., RC4, Salsa20), needs key
* asymmetric   : Asymmetric key algorithms (e.g., RSA, ECC), needs keys
* checksum     : Functions for computing checksums (e.g., CRC32, Adler), no salt
* hash         : Cryptographic hash functions (e.g., SHA-256, MD5), with salt
* kdf          : Functions for securely hashing passwords (e.g., bcrypt, Argon2), needs iterations
* compression  : Data compression algorithms (e.g., DEFLATE, LZMA)
* encoding     : Character encoding schemes (e.g., UTF-8, ASCII, Morse)
* padding      : Data padding schemes (e.g., PKCS#7, ANSI X.923)
* modes        : Block cipher modes of operation (e.g., ECB, CBC, GCM)
* ecc          : Error correction codes (e.g., Reed-Solomon, LDPC)
* mac          : Message authentication codes (e.g., HMAC, CMAC)
* pqc          : Post-quantum cryptography (e.g., Lizard, NTRU)

| Category | Name     | Author                      | Year | Listed at               | Sources Libraries       | Test-Vectors | Implementation Status      |
| -------- | -------- | --------------------------- | ---- | ----------------------- | ----------------------- | ------------ | -------------------------- |
| block    | Rijndael | Joan Daemen, Vincent Rijmen | 2001 | NIST, NESSIE, DarkCrypt | Bouncy Castle, Crypto++ | ✅            | ⚠️ Not passing test-vectors |
| block    | Blowfish | Bruce Schneier              | 1993 | NIST, eSTREAM           | Bouncy Castle, Crypto++ | ✅            | ✅ Fully compliant          |

...


## 📚 Reference Libraries (9 total)

### **Core Academic References**
1. **[Bouncy Castle](Libraries/bouncy-castle/)** (Java) - Comprehensive cryptographic library
2. **[Crypto++]( https://github.com/weidai11/cryptopp )** (C++) - Free C++ library of cryptographic schemes
3. **[LibTomCrypt](Libraries/libtomcrypt/)** (C) - Portable cryptographic library
4. **[CEX](Libraries/cex/)** (C++) - Modern cryptographic library with extensive implementations
5. **[Crypto3](Libraries/crypto3/)** (C++) - Cryptographic algorithms collection

### **Production Libraries**  
6. **[OpenSSL](Libraries/openssl/)** (C) - Industry standard TLS/SSL and crypto library
7. **[wolfSSL](Libraries/wolfssl/)** (C) - Embedded-focused TLS/SSL implementation
8. **[mbedTLS](Libraries/mbedtls/)** (C) - Portable, easy-to-use TLS library

### **Language-Specific Libraries**
9. **[CryptoJS](Libraries/crypto-js/)** (JavaScript) - JavaScript cryptographic standards
10. **[PyCryptodome](Libraries/pycryptodome/)** (Python) - Self-contained Python cryptographic library

## 📋 Competition Checklists (5 total)

### Historical Cryptographic Competitions

* [NESSIE Project](https://web.archive.org/web/20130801084122/https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions.html) (2000-2003)
  * European cryptographic primitive evaluation
* [eSTREAM Project](https://competitions.cr.yp.to/estream.html) (2004-2008)
  * Stream cipher competition (response to NESSIE failures)
* [SHA-3 Competition](https://competitions.cr.yp.to/sha3.html) (2007-2012)
  * NIST hash function standardization  
* [CAESAR Competition](https://competitions.cr.yp.to/caesar-submissions.html) (2013-2019)
  * Authenticated encryption schemes
* [AES Competition](https://competitions.cr.yp.to/aes.html)
  * an unclassified, publicly disclosed encryption algorithm capable of protecting sensitive government information well into the next century
* [PHC Competition](https://www.password-hashing.net/)
  * Password Hashing Competition
* [CRYPTREC Competition](https://www.cryptrec.go.jp/)

### Cipher Collections

* [DarkCrypt TC](Checklists/DarkCrypt_TC_Cipher_Checklist.md)
  * Total Commander plugin cipher support

### Other sources

* [German Wikipedia](https://de.wikipedia.org/wiki/Kategorie:Kryptologisches_Verfahren)
* [English Wikipedia](https://en.wikipedia.org/wiki/Category:Cryptographic_algorithms)
* [Chinese Wikipedia](https://zh.wikipedia.org/wiki/%E5%AF%86%E7%A2%BC%E5%AD%B8%E4%B8%BB%E9%A1%8C%E5%88%97%E8%A1%A8)
* [Russian Wikipedia](https://ru.wikipedia.org/wiki/%D0%9A%D1%80%D0%B8%D0%BF%D1%82%D0%BE%D0%B3%D1%80%D0%B0%D1%84%D0%B8%D1%8F)
* [Japanese Wikipedia](https://ja.wikipedia.org/wiki/%E3%83%96%E3%83%AD%E3%83%83%E3%82%AF%E6%9A%97%E5%8F%B7)