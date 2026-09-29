# Camellia Key Wrap with Padding

> RFC 5649 key wrapping with padding applied to Camellia cipher. Supports arbitrary-length plaintext by padding to 8-byte multiples and embedding length in AIV.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Key Wrapping |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | NIST (RFC 5649 specification with Camellia cipher) |
| Year | 2009 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/crypto/camelliawrappad.js`](../../../algorithms/crypto/camelliawrappad.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 5649 - Advanced Encryption Standard (AES) Key Wrap with Padding Algorithm](https://www.ietf.org/rfc/rfc5649.txt)
- [NIST SP 800-38F - Recommendation for Block Cipher Modes of Operation: Methods for Key Wrapping](https://csrc.nist.gov/publications/detail/sp/800-38f/final)
- [RFC 3713 - Camellia Cipher Specification](https://tools.ietf.org/rfc/rfc3713.txt)

## References

- [BouncyCastle Rfc5649WrapEngine](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/RFC5649WrapEngine.java)
- [BouncyCastle AriaWrapPadEngine](https://github.com/bcgit/bc-csharp/blob/master/crypto/src/crypto/engines/AriaWrapPadEngine.cs)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Self-consistency vector (RFC 5649 wrap structure, sized like RFC 5649 §6.2, with Camellia-128 substituted for AES; no official Camellia-KWP KAT exists) — single-block case (7-octet key data)](https://www.rfc-editor.org/rfc/rfc5649.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `466f7250617369` |
| `expected` | `bdcc8e794701c12804891be045dd11cb` |

**Vector 2** — [Self-consistency vector (RFC 5649 wrap structure, sized like RFC 5649 §6.1, with Camellia-192 substituted for AES; no official Camellia-KWP KAT exists) — multi-block case (20-octet key data, general RFC 3394 loop)](https://www.rfc-editor.org/rfc/rfc5649.txt)

| Field | Value |
| --- | --- |
| `key` | `5840df6e29b02af1ab493b705bf16ea1ae8338f4dcc176a8` |
| `input` | `c37b7e6492584340bed12207808941155068f738` |
| `expected` | `6fe8e088d2042ea144139b1c7a46a63027226d16c01034c73b6333d4ab05884c` |

---

[← All algorithms](../README.md)
