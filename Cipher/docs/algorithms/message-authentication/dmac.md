# DMAC

> Double MAC (DMAC) using two-key derivation for enhanced CBC-MAC security. Designed for real-time data sources with variable-length messages.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Block Cipher MAC |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Erez Petrank, Charles Rackoff |
| Year | 1997 |
| Origin | Not specified |
| Source | [`algorithms/mac/dmac.js`](../../../algorithms/mac/dmac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| MAC sizes | 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [CBC MAC for Real-Time Data Sources (IACR ePrint 1997/010)](https://eprint.iacr.org/1997/010)
- [Crypto++ DMAC Implementation](https://github.com/weidai11/cryptopp/blob/master/dmac.h)

## References

- [Crypto++ Validation Tests](https://github.com/weidai11/cryptopp/blob/master/validat4.cpp)
- [NIST SP 800-38B - CMAC (modern successor)](https://csrc.nist.gov/publications/detail/sp/800-38b/final)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Crypto++ DMAC&lt;DES> Test Vector](https://github.com/weidai11/cryptopp/blob/master/validat4.cpp)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef` |
| `input` | `37363534333231204e6f77206973207468652074696d6520666f7220` |
| `expected` | `3580c5c46b8124e2` |

---

[← All algorithms](../README.md)
