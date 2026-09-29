# OMAC/CMAC

> One-Key Cipher-Based Message Authentication Code as defined in NIST SP 800-38B. Provides provably secure message authentication using a single key with any block cipher.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Block Cipher MAC |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Tetsu Iwata, Kaoru Kurosawa |
| Year | 2003 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/mac/omac.js`](../../../algorithms/mac/omac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| MAC sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST SP 800-38B - CMAC Specification](https://csrc.nist.gov/publications/detail/sp/800-38b/final)
- [RFC 4493 - The AES-CMAC Algorithm](https://tools.ietf.org/html/rfc4493)

## References

- [OpenSSL CMAC Implementation](https://github.com/openssl/openssl/blob/master/crypto/cmac/cmac.c)
- [Bouncy Castle CMAC](https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/macs)
- [Python Cryptography CMAC](https://cryptography.io/en/latest/hazmat/primitives/mac/cmac/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST SP 800-38B Example 1 - Empty Message](https://csrc.nist.gov/publications/detail/sp/800-38b/final)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `input` | _(empty)_ |
| `expected` | `bb1d6929e95937287fa37d129b756746` |

**Vector 2** — [NIST SP 800-38B Example 2 - Single Block](https://csrc.nist.gov/publications/detail/sp/800-38b/final)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `070a16b46b4d4144f79bdd9dd04a287c` |

**Vector 3** — [NIST SP 800-38B Example 3 - Multi Block](https://csrc.nist.gov/publications/detail/sp/800-38b/final)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `input` | `6bc1bee22e409f96e93d7e117393172a ae2d8a571e03ac9c9eb76fac45af8e51 30c81c46a35ce411` |
| `expected` | `dfa66747de9ae63030ca32611497c827` |

---

[← All algorithms](../README.md)
