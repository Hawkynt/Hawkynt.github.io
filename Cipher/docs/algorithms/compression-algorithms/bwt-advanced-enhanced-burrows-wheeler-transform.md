# BWT-Advanced (Enhanced Burrows-Wheeler Transform)

> Advanced block-sorting compression using enhanced Burrows-Wheeler Transform with optimal suffix array construction, intelligent post-processing, and multi-stage entropy coding for maximum compression efficiency.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Block Sorting |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Michael Burrows, David Wheeler (Enhanced) |
| Year | 1994 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/bwt-advanced.js`](../../../algorithms/compression/bwt-advanced.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Burrows-Wheeler Transform](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform)
- [Advanced BWT Techniques](https://arxiv.org/abs/1201.3077)
- [Suffix Arrays in Practice](https://web.stanford.edu/class/cs97si/suffix-array.pdf)

## References

- [Original BWT Paper](http://www.hpl.hp.com/techreports/Compaq-DEC/SRC-RR-124.pdf)
- [DCC BWT Improvements](https://ieeexplore.ieee.org/document/1192719)
- [Practical Suffix Arrays](https://github.com/y-256/libdivsufsort)
- [BWT in bzip2](http://www.bzip.org/1.0.5/bzip2-manual-1.0.5.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - header only](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000ffffffff` |

**Vector 2** — [Single character](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `000000010000000161ffffffff` |

**Vector 3** — [Two characters](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform)

| Field | Value |
| --- | --- |
| `input` | `6162` |
| `expected` | `00000002000000016262ffffffff` |

**Vector 4** — [Regression: all 256 byte values](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `0000010000000001ff01020304050607 08090a0b0c0d0e0f1011121314151617 18191a1b1c1d1e1f2021222324252627 28292a2b2c2d2e2f3031323334353637 …` (268 bytes; the full value is in the source) |

**Vector 5** — [Regression: pseudo-random data, length 91](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform)

| Field | Value |
| --- | --- |
| `input` | `000040004000400040003980c0000000 40800040004000000040000000004000 00400000400000408000003980000000 00400000004000000040808000004000 4000000040000000000000004080b880 c000408000000040000040` |
| `expected` | `0000005b0000001b4000010080020201 0001010202c003020302020000000000 01000201020000000101000001000100 00000000010102020002030100000000 00000000000000000000000000000000 000000000000003c03000401000002b9 030000ffffffff` |

**Vector 6** — [Regression: alternating pattern, length 83](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform)

| Field | Value |
| --- | --- |
| `input` | `61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 616261` |
| `expected` | `000000530000002a6162000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000100000000000000000000000000 00000000000000000000000000000000 0000000000000000000000ffffffff` |

---

[← All algorithms](../README.md)
