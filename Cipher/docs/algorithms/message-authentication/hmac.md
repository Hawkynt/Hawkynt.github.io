# HMAC

> Hash-based Message Authentication Code as defined in RFC 2104. Provides cryptographic authentication and integrity verification using any cryptographic hash function.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | HMAC |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Mihir Bellare, Ran Canetti, Hugo Krawczyk |
| Year | 1996 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/mac/hmac.js`](../../../algorithms/mac/hmac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| MAC sizes | 16 bytes (128 bits) to 64 bytes (512 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Weak Hash Function | Use modern hash functions like SHA-256 or SHA-512 instead of MD5 or SHA-1 | — |
| Key Reuse | Use unique keys for different applications and contexts | — |

## Documentation

- [RFC 2104 - HMAC: Keyed-Hashing for Message Authentication](https://tools.ietf.org/rfc/rfc2104.txt)
- [RFC 4231 - Test Vectors for HMAC-SHA-224/256/384/512](https://tools.ietf.org/rfc/rfc4231.txt)
- [NIST FIPS 198-1 - The Keyed-Hash Message Authentication Code](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.198-1.pdf)

## References

- [OpenSSL HMAC Implementation](https://github.com/openssl/openssl/blob/master/crypto/hmac/hmac.c)
- [Python hashlib HMAC](https://github.com/python/cpython/blob/main/Lib/hmac.py)
- [Go crypto/hmac](https://golang.org/pkg/crypto/hmac/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [HMAC-MD5 Botan Vector 1 - 'Hi There'](https://github.com/randombit/botan/blob/master/src/tests/data/mac/hmac.vec)

| Field | Value |
| --- | --- |
| `key` | `0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b` |
| `hashFunction` | `4d4435` |
| `input` | `4869205468657265` |
| `expected` | `9294727a3638bb1c13f48ef8158bfc9d` |

**Vector 2** — [HMAC-MD5 Botan Vector 2 - 'Test With Truncation'](https://github.com/randombit/botan/blob/master/src/tests/data/mac/hmac.vec)

| Field | Value |
| --- | --- |
| `key` | `0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c` |
| `hashFunction` | `4d4435` |
| `input` | `546573742057697468205472756e636174696f6e` |
| `expected` | `56461ef2342edc00f9bab995690efd4c` |

---

[← All algorithms](../README.md)
