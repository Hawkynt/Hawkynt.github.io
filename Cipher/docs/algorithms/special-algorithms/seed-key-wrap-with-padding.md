# SEED Key Wrap with Padding

> RFC 5649 key wrapping with padding applied to SEED cipher. Supports arbitrary-length plaintext by padding to 8-byte multiples and embedding length in AIV.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Key Wrapping |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | NIST (RFC 5649 specification with SEED cipher) |
| Year | 2009 |
| Origin | 🇰🇷 South Korea |
| Source | [`algorithms/crypto/seedwrappad.js`](../../../algorithms/crypto/seedwrappad.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 5649 - Advanced Encryption Standard (AES) Key Wrap with Padding Algorithm](https://www.ietf.org/rfc/rfc5649.txt)
- [NIST SP 800-38F - Recommendation for Block Cipher Modes of Operation: Methods for Key Wrapping](https://csrc.nist.gov/publications/detail/sp/800-38f/final)
- [RFC 4269 - The SEED Encryption Algorithm](https://tools.ietf.org/rfc/rfc4269.txt)

## References

- [BouncyCastle Rfc5649WrapEngine](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RFC5649WrapEngine.java)
- [BouncyCastle SEEDEngine](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/SEEDEngine.java)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Self-consistency vector (RFC 5649 wrap structure, sized like RFC 5649 §6.2, with SEED substituted for AES; no official SEED-KWP KAT exists) — single-block case (7-octet key data)](https://www.rfc-editor.org/rfc/rfc5649.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `466f7250617369` |
| `expected` | `47e20ac2284005f3dbdf0b2ee509a460` |

**Vector 2** — [Self-consistency vector (RFC 5649 wrap structure, sized like RFC 5649 §6.1, with SEED substituted for AES; no official SEED-KWP KAT exists) — multi-block case (20-octet key data, general RFC 3394 loop)](https://www.rfc-editor.org/rfc/rfc5649.txt)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `input` | `c37b7e6492584340bed12207808941155068f738` |
| `expected` | `938241514e0bf5f5ead58fe8eb09a93fa101fefc47e2f90de121a3765644226a` |

---

[← All algorithms](../README.md)
