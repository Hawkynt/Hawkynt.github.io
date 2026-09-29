# ICE

> Information Concealment Engine with configurable rounds (Thin-ICE: 8 rounds, ICE: 16 rounds). 64-bit Feistel block cipher with key-dependent S-boxes designed by Matthew Kwan.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Matthew Kwan |
| Year | 1997 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/block/ice.js`](../../../algorithms/block/ice.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [ICE Algorithm Specification](https://darkside.com.au/ice/description.html)
- [ICE Home Page](https://darkside.com.au/ice/)
- [Fast Software Encryption 1997 Paper](https://link.springer.com/chapter/10.1007/BFb0052335)

## References

- [Original C Implementation](https://darkside.com.au/ice/ice-doc-C.html)
- [ICE Algorithm Overview](https://darkside.com.au/ice/overview.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Thin-ICE (8 rounds) Official Test Vector](https://darkside.com.au/ice/overview.html)

| Field | Value |
| --- | --- |
| `rounds` | `8` |
| `key` | `deadbeef01234567` |
| `input` | `fedcba9876543210` |
| `expected` | `de240d83a00a9cc0` |

**Vector 2** — [ICE (16 rounds) Official Test Vector](https://darkside.com.au/ice/overview.html)

| Field | Value |
| --- | --- |
| `rounds` | `16` |
| `key` | `deadbeef01234567` |
| `input` | `fedcba9876543210` |
| `expected` | `7d6ef1ef30d47a96` |

---

[← All algorithms](../README.md)
