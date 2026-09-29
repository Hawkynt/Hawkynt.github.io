# HMAC-SHA256

> Hash-based Message Authentication Code using SHA-256 as defined in RFC 2104 and RFC 4231. Combines cryptographic hashing with a secret key to provide authentication and integrity verification.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | HMAC |
| Security status | 🛡️ Secure |
| Complexity | Beginner |
| Inventor | Mihir Bellare, Ran Canetti, Hugo Krawczyk |
| Year | 1996 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/mac/hmac-sha256.js`](../../../algorithms/mac/hmac-sha256.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| MAC sizes | 1 byte (8 bits) to 64 bytes (512 bits) |
| Output sizes | 1 byte (8 bits) to 32 bytes (256 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 2104 - HMAC: Keyed-Hashing for Message Authentication](https://tools.ietf.org/html/rfc2104)
- [RFC 4231 - Identifiers and Test Vectors for HMAC-SHA-224/256/384/512](https://tools.ietf.org/html/rfc4231)
- [NIST FIPS 198-1 - The Keyed-Hash Message Authentication Code (HMAC)](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.198-1.pdf)

## References

- [OpenSSL HMAC Implementation](https://github.com/openssl/openssl/blob/master/crypto/hmac/hmac.c)
- [libsodium HMAC-SHA256](https://github.com/jedisct1/libsodium/blob/master/src/libsodium/crypto_auth/hmacsha256/auth_hmacsha256.c)
- [Botan HMAC Implementation](https://github.com/randombit/botan/blob/master/src/lib/mac/hmac/hmac.cpp)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 4231 Test Case 1 - 'Hi There'](https://tools.ietf.org/html/rfc4231#section-4.2)

| Field | Value |
| --- | --- |
| `key` | `0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b` |
| `input` | `4869205468657265` |
| `expected` | `b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7` |

**Vector 2** — [RFC 4231 Test Case 2 - 'what do ya want for nothing?'](https://tools.ietf.org/html/rfc4231#section-4.3)

| Field | Value |
| --- | --- |
| `key` | `4a656665` |
| `input` | `7768617420646f2079612077616e7420666f72206e6f7468696e673f` |
| `expected` | `5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843` |

**Vector 3** — [RFC 4231 Test Case 3 - 50 bytes of 0xDD](https://tools.ietf.org/html/rfc4231#section-4.4)

| Field | Value |
| --- | --- |
| `key` | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |
| `input` | `dddddddddddddddddddddddddddddddd dddddddddddddddddddddddddddddddd dddddddddddddddddddddddddddddddd dddd` |
| `expected` | `773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe` |

**Vector 4** — [RFC 4231 Test Case 4 - 50 bytes of 0xCD](https://tools.ietf.org/html/rfc4231#section-4.5)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10111213141516171819` |
| `input` | `cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd cdcd` |
| `expected` | `82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b` |

**Vector 5** — [RFC 4231 Test Case 6 - Key > Block Size](https://tools.ietf.org/html/rfc4231#section-4.7)

| Field | Value |
| --- | --- |
| `key` | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaa` |
| `input` | `54657374205573696e67204c61726765 72205468616e20426c6f636b2d53697a 65204b6579202d2048617368204b6579 204669727374` |
| `expected` | `60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54` |

**Vector 6** — [RFC 4231 Test Case 7 - Large Key and Data](https://tools.ietf.org/html/rfc4231#section-4.8)

| Field | Value |
| --- | --- |
| `key` | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa aaaaaa` |
| `input` | `54686973206973206120746573742075 73696e672061206c6172676572207468 616e20626c6f636b2d73697a65206b65 7920616e642061206c61726765722074 68616e20626c6f636b2d73697a652064 6174612e20546865206b6579206e6565 647320746f2062652068617368656420 6265666f7265206265696e6720757365 642062792074686520484d414320616c 676f726974686d2e` |
| `expected` | `9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2` |

---

[← All algorithms](../README.md)
