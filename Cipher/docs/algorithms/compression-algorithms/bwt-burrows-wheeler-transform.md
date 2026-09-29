# BWT (Burrows-Wheeler Transform)

> Reversible data transformation that rearranges string characters to improve performance of other compression techniques. Used as preprocessing step in bzip2 and other advanced compressors.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Transform |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Michael Burrows, David Wheeler |
| Year | 1994 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/bwt.js`](../../../algorithms/compression/bwt.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Burrows-Wheeler Transform - Wikipedia](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform)
- [Original BWT Paper](https://www.hpl.hp.com/techreports/Compaq-DEC/SRC-RR-124.pdf)
- [bzip2 Algorithm](https://sourceware.org/bzip2/)

## References

- [bzip2 Implementation](https://sourceware.org/bzip2/downloads.html)
- [Educational BWT Tutorial](https://web.stanford.edu/class/cs262/notes/lecture12.pdf)
- [CompressionWorkbench BurrowsWheelerTransform (reference implementation)](https://github.com/Hawkynt)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Empty data test - still emits the 4-byte primary-index header

Source: Edge case test

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — Single byte test

Source: Minimal transformation test

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `0000000041` |

**Vector 3** — Regression: all 256 byte values

Source: Regression test for sentinel-free cyclic rotation sort

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00000000ff000102030405060708090a 0b0c0d0e0f101112131415161718191a 1b1c1d1e1f202122232425262728292a 2b2c2d2e2f303132333435363738393a …` (260 bytes; the full value is in the source) |

**Vector 4** — Regression: pseudo-random data, length 91 - exercises the gap-doubling tie-break passes

Source: Regression test - non-repeating pseudo-random input

| Field | Value |
| --- | --- |
| `input` | `000040004000400040003980c0000000 40800040004000000040000000004000 00400000400000408000003980000000 00400000004000000040808000004000 4000000040000000000000004080b880 c000408000000040000040` |
| `expected` | `1a000000400000804000404000400080 c0400080000000000000404040804040 00000000400000404000000000000000 400080404000c0000000000000000000 00000000000000000000000000000000 0000003940408040404039b8808080` |

**Vector 5** — Regression: alternating pattern, length 83 - heavily tied rotations, exercises the ascending-position tie-break

Source: Regression test - repetitive alternating input

| Field | Value |
| --- | --- |
| `input` | `61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 616261` |
| `expected` | `29000000626262626262626262626262 62626262626262626262626262626262 62626262626262626262626262616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161` |

**Vector 6** — Regression: period-4 input, length 64 - four classes of 16 identical rotations

Source: Regression test - fully tied rotation classes

| Field | Value |
| --- | --- |
| `input` | `61626364616263646162636461626364 61626364616263646162636461626364 61626364616263646162636461626364 61626364616263646162636461626364` |
| `expected` | `00000000646464646464646464646464 64646464616161616161616161616161 61616161626262626262626262626262 62626262636363636363636363636363 63636363` |

---

[← All algorithms](../README.md)
