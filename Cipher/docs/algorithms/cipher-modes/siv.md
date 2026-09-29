# SIV

> Synthetic IV (SIV) mode provides deterministic authenticated encryption by first computing an authentication tag (synthetic IV) using S2V, then encrypting with CTR mode using the synthetic IV. This mode is nonce-misuse resistant and supports key-commitment, making it safe even when nonces are reused or generated incorrectly.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Deterministic AEAD |
| Security status | 🛡️ Secure |
| Complexity | Expert |
| Inventor | Rogaway, Shrimpton |
| Year | 2006 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/siv.js`](../../../algorithms/modes/siv.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Nonce Reuse Safe | SIV is specifically designed to be safe against nonce reuse, unlike most AEAD modes. | — |
| Deterministic | Same plaintext with same AAD produces same ciphertext - may leak information patterns. | — |
| Performance | Requires two passes over data (S2V then CTR), making it slower than single-pass AEAD modes. | — |

## Documentation

- [RFC 5297 - SIV Mode](https://tools.ietf.org/rfc/rfc5297.txt)
- [SIV Original Paper](https://web.cs.ucdavis.edu/~rogaway/papers/siv.html)
- [NIST Recommendation](https://csrc.nist.gov/publications/detail/sp/800-38f/final)

## References

- Deterministic Encryption — Bellare et al. - DAE Security Model
- [S2V Construction](https://tools.ietf.org/rfc/rfc5297.txt#section-2.4)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 5297 A.1 - deterministic authenticated encryption](https://www.rfc-editor.org/rfc/rfc5297.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `aad` | `[[16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39]]` |
| `input` | `112233445566778899aabbccddee` |
| `expected` | `85632d07c6e8f37f950acd320a2ecc9340c02b9690c4dc04daef7f6afe5c` |

**Vector 2** — [RFC 5297 A.2 - nonce-based authenticated encryption](https://www.rfc-editor.org/rfc/rfc5297.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `7f7e7d7c7b7a79787776757473727170404142434445464748494a4b4c4d4e4f` |
| `aad` | `[[0,17,34,51,68,85,102,119,136,153,170,187,204,221,238,255,222,173,218,218,222,173,218,218,255,238,221,204,187,170,153,136,119,102,85,68,51,34,17,0],[16,32,48,64,80,96,112,128,144,160],[9,249,17,2,157,116,227,91,216,65,86,197,99,86,136,192]]` |
| `input` | `7468697320697320736f6d6520706c61 696e7465787420746f20656e63727970 74207573696e67205349562d414553` |
| `expected` | `7bdb6e3b432667eb06f4d14bff2fbd0f cb900f2fddbe404326601965c889bf17 dba77ceb094fa663b7a3f748ba8af829 ea64ad544a272e9c485b62a3fd5c0d` |

---

[← All algorithms](../README.md)
