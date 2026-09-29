# AES-SIV

> Educational implementation of AES-SIV deterministic authenticated encryption. Provides nonce misuse resistance with simplified cryptographic operations.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Deterministic AEAD |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Phillip Rogaway, Thomas Shrimpton |
| Year | 2006 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/special/aes-siv.js`](../../../algorithms/special/aes-siv.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 5297 - Synthetic Initialization Vector (SIV) Authenticated Encryption](https://tools.ietf.org/html/rfc5297)
- [NIST SP 800-38F - Methods for Key Derivation and Data Protection](https://csrc.nist.gov/publications/detail/sp/800-38f/final)

## References

- [Deterministic Authenticated-Encryption (DAE) Paper](https://web.cs.ucdavis.edu/~rogaway/papers/siv.pdf)
- [SIV Mode Security Analysis](https://eprint.iacr.org/2006/221.pdf)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — AES-SIV Educational test - empty plaintext

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `5816c832781ec9725816c832380ecbf2` |

**Vector 2** — AES-SIV Educational test - with data

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f` |
| `aad` | _(empty)_ |
| `input` | `112233445566778899aabbccddee` |
| `expected` | `3095603a1188f06912b7421853b22c8b9416bfdc4422397d9416bfdce54a` |

---

[← All algorithms](../README.md)
