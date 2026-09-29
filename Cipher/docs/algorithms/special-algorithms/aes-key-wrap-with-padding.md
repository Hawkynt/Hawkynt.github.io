# AES Key Wrap with Padding

> RFC 5649 extension of AES Key Wrap that supports wrapping keys of any length (not limited to multiples of 8 bytes). Uses Alternative Initial Value (AIV) containing plaintext length.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Key Wrapping |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | NIST |
| Year | 2009 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/crypto/aeswrappad.js`](../../../algorithms/crypto/aeswrappad.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 5649 - Advanced Encryption Standard (AES) Key Wrap with Padding Algorithm](https://www.rfc-editor.org/rfc/rfc5649.txt)
- [NIST SP 800-38F - Recommendation for Block Cipher Modes of Operation: Methods for Key Wrapping](https://csrc.nist.gov/publications/detail/sp/800-38f/final)

## References

- [BouncyCastle RFC5649WrapEngine](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RFC5649WrapEngine.java)
- [RFC 3394 - AES Key Wrap Algorithm](https://www.ietf.org/rfc/rfc3394.txt)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 5649 Section 6.1 - 192-bit KEK, 20-octet Key Data](https://www.rfc-editor.org/rfc/rfc5649.txt)

| Field | Value |
| --- | --- |
| `key` | `5840df6e29b02af1ab493b705bf16ea1ae8338f4dcc176a8` |
| `input` | `c37b7e6492584340bed12207808941155068f738` |
| `expected` | `138bdeaa9b8fa7fc61f97742e72248ee5ae6ae5360d1ae6a5f54f373fa543b6a` |

**Vector 2** — [RFC 5649 Section 6.2 - 192-bit KEK, 7-octet Key Data](https://www.rfc-editor.org/rfc/rfc5649.txt)

| Field | Value |
| --- | --- |
| `key` | `5840df6e29b02af1ab493b705bf16ea1ae8338f4dcc176a8` |
| `input` | `466f7250617369` |
| `expected` | `afbeb0f07dfbf5419200f2ccb50bb24f` |

---

[← All algorithms](../README.md)
