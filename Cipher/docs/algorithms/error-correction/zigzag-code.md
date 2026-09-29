# Zigzag Code

> Diagonal interleaving technique for burst error correction. Data written row-wise into matrix, transmitted in zigzag diagonal pattern. Spreads burst errors across multiple codewords when combined with inner error correction code. Simpler than Fire codes for moderate burst lengths.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Burst Error Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Anastasios N. Venetsanopoulos, Richard Friedlander |
| Year | 1975 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/ecc/zigzag-code.js`](../../../algorithms/ecc/zigzag-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Requires Inner Code | Zigzag interleaving alone does not correct errors - must be combined with error correction code like Hamming or BCH. | — |
| Latency Introduction | Diagonal reading introduces delay as entire matrix block must be buffered before transmission. | — |
| Limited to Block Size | Burst error protection limited to matrix dimensions. Bursts longer than one row may affect multiple symbols after deinterleaving. | — |

## Documentation

- [Burst Error Correction - Wikipedia](https://en.wikipedia.org/wiki/Burst_error-correcting_code)
- [Interleaving Techniques](https://web.njit.edu/~anl/papers/04CASMag.pdf)
- [Error Control Coding](https://www.sciencedirect.com/topics/engineering/interleaver)

## References

- [IEEE Xplore - Interleaving for Burst Errors](https://ieeexplore.ieee.org/document/1286985/)
- [Burst Error Correcting Codes](https://wiki.cse.buffalo.edu/cse545/content/burst-error-correcting-codes)
- [Google Patents - Interleaver for Burst Errors](https://patents.google.com/patent/US6662332B1/en)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [4x4 zigzag diagonal pattern - ascending diagonals](https://en.wikipedia.org/wiki/Burst_error-correcting_code)

| Field | Value |
| --- | --- |
| `rows` | `4` |
| `cols` | `4` |
| `direction` | ascending |
| `input` | `0102030405060708090a0b0c0d0e0f10` |
| `expected` | `0105020906030d0a07040e0b080f0c10` |

**Vector 2** — [4x4 zigzag diagonal pattern - descending diagonals](https://en.wikipedia.org/wiki/Burst_error-correcting_code)

| Field | Value |
| --- | --- |
| `rows` | `4` |
| `cols` | `4` |
| `direction` | descending |
| `input` | `0102030405060708090a0b0c0d0e0f10` |
| `expected` | `01020503060904070a0d080b0e0c0f10` |

**Vector 3** — [3x3 zigzag pattern - ascending](https://web.njit.edu/~anl/papers/04CASMag.pdf)

| Field | Value |
| --- | --- |
| `rows` | `3` |
| `cols` | `3` |
| `direction` | ascending |
| `input` | `010203040506070809` |
| `expected` | `010402070503080609` |

**Vector 4** — [Sequential bytes - 4x4 ascending pattern](https://ieeexplore.ieee.org/document/1286985/)

| Field | Value |
| --- | --- |
| `rows` | `4` |
| `cols` | `4` |
| `direction` | ascending |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `0004010805020c0906030d0a070e0b0f` |

**Vector 5** — [2x8 rectangular zigzag - ascending](https://wiki.cse.buffalo.edu/cse545/content/burst-error-correcting-codes)

| Field | Value |
| --- | --- |
| `rows` | `2` |
| `cols` | `8` |
| `direction` | ascending |
| `input` | `0102030405060708090a0b0c0d0e0f10` |
| `expected` | `0109020a030b040c050d060e070f0810` |

---

[← All algorithms](../README.md)
