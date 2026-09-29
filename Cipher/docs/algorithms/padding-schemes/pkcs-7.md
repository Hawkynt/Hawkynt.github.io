# PKCS#7

> PKCS#7 padding scheme where padding bytes contain the number of padding bytes added. This ensures data is padded to block boundary with deterministic padding removal. It is the most widely used padding scheme for block ciphers and supports variable block sizes from 1 to 255 bytes.

## Properties

| Property | Value |
| --- | --- |
| Category | Padding Schemes |
| Sub-category | Block Padding |
| Security status | 🛡️ Secure |
| Complexity | Not specified |
| Inventor | RSA Laboratories |
| Year | 1993 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/padding/pkcs.js`](../../../algorithms/padding/pkcs.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsLengthIncluded` | No |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Padding Oracle Attack | When decryption errors reveal padding validity, attackers can decrypt arbitrary ciphertexts byte by byte. Use authenticated encryption modes or ensure error messages don't distinguish between padding and other decryption errors. | — |
| Length Disclosure | The padding scheme reveals information about the original message length modulo block size. | — |

## Documentation

- [RFC 2315 - PKCS #7](https://tools.ietf.org/rfc/rfc2315.txt)
- [RFC 5652 - CMS](https://tools.ietf.org/rfc/rfc5652.txt)
- [Padding in Cryptography](https://en.wikipedia.org/wiki/Padding_(cryptography)#PKCS#5_and_PKCS#7)

## References

- [OpenSSL PKCS7 Padding](https://github.com/openssl/openssl/blob/master/crypto/evp/evp_lib.c)
- [Crypto++ PKCS Padding](https://github.com/weidai11/cryptopp/blob/master/pkcspad.cpp)
- [RSA Laboratories](https://www.rsa.com/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — PKCS#7 padding with 17 bytes needed

Source: RFC 2315

| Field | Value |
| --- | --- |
| `blockSize` | `32` |
| `input` | `6bc1bee22e409f96e93d7e11739317` |
| `expected` | `6bc1bee22e409f96e93d7e117393171111111111111111111111111111111111` |

**Vector 2** — PKCS#7 padding for full block

Source: RFC 2315

| Field | Value |
| --- | --- |
| `blockSize` | `32` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `6bc1bee22e409f96e93d7e117393172a10101010101010101010101010101010` |

**Vector 3** — PKCS#7 padding with 3 bytes needed

Source: RFC 2315

| Field | Value |
| --- | --- |
| `blockSize` | `8` |
| `input` | `6bc1bee22e` |
| `expected` | `6bc1bee22e030303` |

---

[← All algorithms](../README.md)
