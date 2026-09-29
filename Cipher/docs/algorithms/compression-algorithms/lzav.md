# LZAV

> Fast general-purpose in-memory LZ77 compression algorithm. Achieves 480-600 MB/s compression and 2800-3800 MB/s decompression with better ratios than LZ4. Educational implementation of the hash-table-based approach.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based (LZ77) |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Aleksey Vaneev |
| Year | 2023 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/compression/lzav.js`](../../../algorithms/compression/lzav.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [LZAV GitHub Repository](https://github.com/avaneev/lzav)
- [LZAV Performance Benchmarks](https://github.com/avaneev/lzav#benchmark)
- [LZ77 Algorithm](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

## References

- [LZAV Source Code](https://github.com/avaneev/lzav/blob/main/lzav.h)
- [Compression Benchmark](https://github.com/inikep/lzbench)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://github.com/avaneev/lzav/blob/main/lzav.h)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 0x41](https://github.com/avaneev/lzav/blob/main/lzav.h)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `01000000360141` |

**Vector 3** — [Simple repetition - AAAA (too short for mref=6 match)](https://github.com/avaneev/lzav/blob/main/lzav.h)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | _(empty)_ |

**Vector 4** — [Pattern repetition - ABCABC (too short for mref=6 match)](https://github.com/avaneev/lzav/blob/main/lzav.h)

| Field | Value |
| --- | --- |
| `input` | `414243414243` |
| `expected` | _(empty)_ |

**Vector 5** — [Real text - Hello World! (no match, too short)](https://github.com/avaneev/lzav/blob/main/lzav.h)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20576f726c6421` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
