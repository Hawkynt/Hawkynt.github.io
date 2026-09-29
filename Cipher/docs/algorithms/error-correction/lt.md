# LT

> LT (Luby Transform) codes are the first practical implementation of digital fountain codes. They provide rateless error correction where encoded symbols can be generated on-demand. Uses Robust Soliton degree distribution for optimal performance with linear encoding/decoding complexity.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Fountain Codes |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Michael Luby |
| Year | 2002 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/lt-codes.js`](../../../algorithms/ecc/lt-codes.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `supportsContinuousEncoding` | Yes |
| `supportsRateless` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [LT Codes Paper](https://www.icsi.berkeley.edu/pubs/theory/luby02lt.pdf)
- [Digital Fountain Survey](https://zoo.cs.yale.edu/classes/cs434/cs434-2018-spring/readings/fountain-codes.pdf)
- [Fountain Codes Tutorial](https://en.wikipedia.org/wiki/Fountain_code)

## References

- [LT-code Reference Implementation (Python)](https://github.com/anrosent/LT-code)
- [Google gofountain Luby Transform Implementation (Go)](https://github.com/google/gofountain/blob/master/luby.go)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — LT encoding test with 4 source symbols

Source: Reference implementation test vector

| Field | Value |
| --- | --- |
| `k` | `4` |
| `overhead` | `1` |
| `seed` | `12345` |
| `input` | `48656c6c` |
| `expected` | `48656c6c09652d09` |

**Vector 2** — LT encoding test with 8 source symbols

Source: Reference implementation test vector

| Field | Value |
| --- | --- |
| `k` | `8` |
| `overhead` | `0.5` |
| `seed` | `54321` |
| `input` | `0102030405060708` |
| `expected` | `0102030405060708030a0309` |

---

[← All algorithms](../README.md)
