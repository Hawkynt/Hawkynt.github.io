# PCBC

> Propagating Cipher Block Chaining (PCBC) mode is a variant of CBC where the feedback combines both plaintext and ciphertext from the previous block. This causes errors to propagate indefinitely, making it more sensitive to transmission errors but also more secure against certain attacks.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Block Cipher Mode |
| Security status | ⚠️ Deprecated |
| Complexity | Intermediate |
| Inventor | Kerberos designers |
| Year | 1982 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/pcbc.js`](../../../algorithms/modes/pcbc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| IV sizes | 8 bytes (64 bits) to 32 bytes (256 bits) in steps of 8 bytes |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | Yes |

## Security

**Status:** ⚠️ Deprecated

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Infinite Error Propagation | Single bit error corrupts all subsequent blocks. Use only when error-free transmission is guaranteed. | — |
| IV Reuse | Reusing IV with same key reveals patterns. Always use unique IVs. | — |
| Limited Adoption | Rarely implemented in modern cryptographic libraries due to error propagation issues. | — |

## Documentation

- [Kerberos v4 Specification](https://tools.ietf.org/rfc/rfc1411.txt)
- Applied Cryptography - PCBC Mode — Bruce Schneier - Second Edition
- [NIST Cipher Modes](https://csrc.nist.gov/publications/detail/sp/800-38a/final)

## References

- Handbook of Applied Cryptography — Chapter 7 - Block Cipher Modes
- Cryptography Engineering — Ferguson, Schneier, Kohno - Mode Analysis

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [PCBC test - single block (AES-128)](https://tools.ietf.org/rfc/rfc1411.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `iv` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `7649abac8119b246cee98e9b12e9197d` |

**Vector 2** — [PCBC test - multiple blocks (AES-128)](https://tools.ietf.org/rfc/rfc1411.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `iv` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51` |
| `expected` | `7649abac8119b246cee98e9b12e9197d9e8baff12ad5270a0d1eef93d7037994` |

---

[← All algorithms](../README.md)
