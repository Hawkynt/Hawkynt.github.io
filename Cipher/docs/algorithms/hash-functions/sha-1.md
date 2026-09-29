# SHA-1

> Secure Hash Algorithm producing 160-bit digest. CRYPTOGRAPHICALLY BROKEN - practical collision attacks demonstrated in 2017. DO NOT USE for security purposes. Educational implementation only.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Cryptographic Hash |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | National Security Agency (NSA) |
| Year | 1995 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/sha1.js`](../../../algorithms/hash/sha1.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 20 bytes (160 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Collision Attack | Practical collision attacks demonstrated in 2017. Two different PDFs can produce the same SHA-1 hash. | Use SHA-256 or SHA-3 instead. Never use SHA-1 for digital signatures, certificates, or security purposes. |

## Documentation

- [RFC 3174: US Secure Hash Algorithm 1](https://tools.ietf.org/html/rfc3174)
- [NIST FIPS 180-1 (Superseded)](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-1.pdf)
- [SHAttered Attack](https://shattered.io/)

## References

- [OpenSSL Implementation (Deprecated)](https://github.com/openssl/openssl/blob/master/crypto/sha/sha1dgst.c)
- [RFC 3174 Specification](https://tools.ietf.org/html/rfc3174)
- [Git SHA-1DC Implementation](https://github.com/git/git/blob/master/sha1dc/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string test vector](https://tools.ietf.org/html/rfc3174)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `da39a3ee5e6b4b0d3255bfef95601890afd80709` |

**Vector 2** — [Single character 'a' test vector](https://tools.ietf.org/html/rfc3174)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `86f7e437faa5a7fce15d1ddcb9eaeaea377667b8` |

**Vector 3** — [String 'abc' test vector](https://tools.ietf.org/html/rfc3174)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `a9993e364706816aba3e25717850c26c9cd0d89d` |

**Vector 4** — [Message 'message digest' test vector](https://tools.ietf.org/html/rfc3174)

| Field | Value |
| --- | --- |
| `input` | `6d65737361676520646967657374` |
| `expected` | `c12252ceda8be8994d5fa0290a47231c1d16aae3` |

**Vector 5** — [Alphabet test vector](https://tools.ietf.org/html/rfc3174)

| Field | Value |
| --- | --- |
| `input` | `6162636465666768696a6b6c6d6e6f707172737475767778797a` |
| `expected` | `32d10c7b8cf96570ca04ce37f2a19d84240d3a89` |

---

[← All algorithms](../README.md)
