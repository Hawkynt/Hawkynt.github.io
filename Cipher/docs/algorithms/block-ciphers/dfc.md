# DFC

> Data Encryption Standard Forte Cipher - AES candidate by CNRS, France. Features 128-bit blocks, variable key sizes (128/192/256-bit), and 8 rounds with S-box substitution and linear transformation.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | CNRS (Centre National de la Recherche Scientifique) |
| Year | 1998 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/block/dfc.js`](../../../algorithms/block/dfc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [DFC AES Candidate Specification](https://csrc.nist.gov/csrc/media/projects/cryptographic-algorithm-validation-program/documents/aes/aesval.html)

## References

- [AES Development - NIST](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — DFC 128-bit test vector

Source: AES candidate specification

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `d4afd7ffa1faec7940528fddb189401d` |

---

[← All algorithms](../README.md)
