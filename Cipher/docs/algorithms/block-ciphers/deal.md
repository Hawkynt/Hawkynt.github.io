# DEAL

> Data Encryption Algorithm with Larger blocks - Feistel cipher using DES as F-function. AES candidate by Outerbridge (1998) based on Knudsen's design extending DES to 128-bit blocks.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Not specified |
| Inventor | Richard Outerbridge (design by Lars Knudsen) |
| Year | 1998 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/block/deal.js`](../../../algorithms/block/deal.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** ❌ Broken

DEAL was an AES candidate but was rejected due to performance issues and cryptanalytic vulnerabilities. Inherits DES weaknesses and has additional structural issues.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Based on DES - inherits DES weaknesses and has additional vulnerabilities | — | — |
| Performance issues - Triple-DES level performance making it impractical | — | — |
| Cryptanalytic attacks exist against DEAL variants, especially DEAL-192 | — | — |

## Documentation

- [DEAL AES Submission](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development)
- [On the Security of DEAL](https://link.springer.com/chapter/10.1007/3-540-48519-8_5)
- [DEAL Analysis by Knudsen](https://www.iacr.org/conferences/crypto98/)

## References

- [AES Competition Archive](https://csrc.nist.gov/archive/aes/)
- [DEAL Implementation Analysis](https://en.wikipedia.org/wiki/DEAL)
- [Feistel Ciphers Using DES](https://www.schneier.com/academic/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — DEAL-128 All Zeros Test

Source: Educational test vector based on enhanced DEAL structure

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `74169b48b45345a9109c60f817f38860` |

**Vector 2** — DEAL-128 Pattern Test

Source: Educational test vector with pattern input

| Field | Value |
| --- | --- |
| `key` | `fedcba9876543210fedcba9876543210` |
| `input` | `0123456789abcdef0123456789abcdef` |
| `expected` | `79828f5a2ed701b6d0b0a0cff6781950` |

**Vector 3** — DEAL-256 Extended Key Test

Source: Educational test vector for 256-bit keys (8 rounds)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000111111111111111122222222222222223333333333333333` |
| `input` | `ffffffffffffffffffffffffffffffff` |
| `expected` | `9f74751d6a2dbfcfd1d1d254cb1c003d` |

---

[← All algorithms](../README.md)
