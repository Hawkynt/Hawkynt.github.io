# BaseKing

> 192-bit block cipher with 192-bit key size using 11 rounds plus final transformation.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Joan Daemen |
| Year | 1994 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/block/baseking.js`](../../../algorithms/block/baseking.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 24 bytes (192 bits) |
| Block sizes | 24 bytes (192 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [Tim van Dijk's Bachelor Thesis](https://www.cs.ru.nl/bachelors-theses/2017/Tim_van_Dijk___4477073___A_high-performance_threshold_implementation_of_a_BaseKing_variant_on_an_ARM_architecture.pdf)
- Joan Daemen's Doctoral Dissertation — Cipher and hash function design strategies based on linear and differential cryptanalysis

## References

- [Joan Daemen Research Page](https://cs.ru.nl/~joan/JoanDaemenResearch.html)
- Tim van Dijk's Python Reference Implementation — BaseKing.py and DoubleKing.py from Bachelor thesis

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — All zeros test vector

Source: Tim van Dijk's Python reference implementation

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000000` |
| `input` | `000000000000000000000000000000000000000000000000` |
| `expected` | `38014f256f53468810426df18e7304b8a3084a5da3d01a94` |

**Vector 2** — All ones test vector

Source: Tim van Dijk's Python reference implementation

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffffffffffffffffffff` |
| `input` | `ffffffffffffffffffffffffffffffffffffffffffffffff` |
| `expected` | `44509d632a2e7ecca77202ab8caaf43f9c77d1205a8b6cd1` |

**Vector 3** — Sequential pattern test vector

Source: Tim van Dijk's Python reference implementation

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718` |
| `input` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `expected` | `a56cc31ee5510c41ed66d01b5d0622444625c974147a7328` |

---

[← All algorithms](../README.md)
