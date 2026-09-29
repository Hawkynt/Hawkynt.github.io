# VEST

> Variable Encryption Standard stream cipher with configurable key sizes and word-based operations. Submitted to eSTREAM but not selected for final portfolio due to cryptanalytic concerns.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Sean O'Neil |
| Year | 2005 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/vest.js`](../../../algorithms/stream/vest.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits); 10 bytes (80 bits); 12 bytes (96 bits); 14 bytes (112 bits); 16 bytes (128 bits) |
| Nonce sizes | 8 bytes (64 bits) to 16 bytes (128 bits) in steps of 2 bytes |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Cryptanalytic Concerns | Not selected for eSTREAM final portfolio due to security concerns | — |

## Documentation

- [eSTREAM VEST Specification](https://www.ecrypt.eu.org/stream/vestpf.html)

## References

- [eSTREAM Phase 2 Evaluation](https://www.ecrypt.eu.org/stream/vest.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — VEST basic test vector with 128-bit key and IV

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `564553542074657374206b6579203136` |
| `iv` | `5645535420746573742049562031362e` |
| `input` | `48656c6c6f205645535421` |
| `expected` | `b789d192d0dea9dbadefdf` |

**Vector 2** — VEST with 64-bit key (minimum size)

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `564553546b657938` |
| `iv` | `5645535469763634` |
| `input` | `4d696e696d756d` |
| `expected` | `b38591979b8992` |

---

[← All algorithms](../README.md)
