# CBC

> Cipher Block Chaining mode XORs each plaintext block with the previous ciphertext block before encryption. The first block is XORed with an initialization vector (IV). Provides confidentiality but requires padding and is vulnerable to padding oracle attacks without proper implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Block Cipher Mode |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | IBM |
| Year | 1976 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/cbc.js`](../../../algorithms/modes/cbc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| IV sizes | 8 bytes (64 bits) to 32 bytes (256 bits) in steps of 8 bytes |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Padding Oracle Attack | CBC with PKCS#7 padding vulnerable when decryption errors are distinguishable. Use authenticated encryption or proper error handling. | — |
| IV Predictability | Predictable IVs leak information about first block. Always use cryptographically random IVs. | — |
| Bit-flipping Attack | Modification of ciphertext block affects next plaintext block in predictable way | — |

## Documentation

- [NIST SP 800-38A](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf)
- [RFC 3602 - AES-CBC](https://tools.ietf.org/rfc/rfc3602.txt)
- Applied Cryptography — Bruce Schneier - Chapter 9

## References

- [OpenSSL CBC Implementation](https://github.com/openssl/openssl/blob/master/crypto/modes/cbc128.c)
- [Crypto++ CBC Mode](https://github.com/weidai11/cryptopp/blob/master/modes.cpp)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST SP 800-38A CBC single block](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `iv` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `7649abac8119b246cee98e9b12e9197d` |

**Vector 2** — [NIST SP 800-38A CBC multi-block](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `iv` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `6bc1bee22e409f96e93d7e117393172a ae2d8a571e03ac9c9eb76fac45af8e51 30c81c46a35ce411e5fbc1191a0a52ef f69f2445df4f9b17ad2b417be66c3710` |
| `expected` | `7649abac8119b246cee98e9b12e9197d 5086cb9b507219ee95db113a917678b2 73bed6b8e3c1743b7116e69e22229516 3ff1caa1681fac09120eca307586e1a7` |

---

[← All algorithms](../README.md)
