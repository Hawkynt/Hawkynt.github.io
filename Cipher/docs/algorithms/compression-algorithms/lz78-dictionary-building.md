# LZ78 Dictionary Building

> Lempel-Ziv 1978 algorithm builds dictionary of phrases during compression, providing universal compression without sliding window.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Abraham Lempel, Jacob Ziv |
| Year | 1978 |
| Origin | 🇮🇱 Israel |
| Source | [`algorithms/compression/lz78.js`](../../../algorithms/compression/lz78.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Compression of Individual Sequences via Variable-Rate Coding](https://ieeexplore.ieee.org/document/1055934)
- [LZ78 - Wikipedia](https://en.wikipedia.org/wiki/LZ78)
- [Data Compression Techniques](https://web.stanford.edu/class/ee398a/)

## References

- [The Data Compression Book](https://www.amazon.com/Data-Compression-Book-Mark-Nelson/dp/0130907529)
- [Introduction to Data Compression](https://www.elsevier.com/books/introduction-to-data-compression/sayood/978-0-12-620862-7)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://en.wikipedia.org/wiki/LZ78)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Single character](https://en.wikipedia.org/wiki/LZ78)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `00000041` |

**Vector 3** — [Two unique characters](https://en.wikipedia.org/wiki/LZ78)

| Field | Value |
| --- | --- |
| `input` | `4142` |
| `expected` | `0000004100000042` |

**Vector 4** — [Repeated character](https://en.wikipedia.org/wiki/LZ78)

| Field | Value |
| --- | --- |
| `input` | `4141` |
| `expected` | `00000041010001` |

**Vector 5** — [All 256 byte values (regression: byte 0xFF sentinel collision)](https://en.wikipedia.org/wiki/LZ78)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00000000000000010000000200000003 00000004000000050000000600000007 00000008000000090000000a0000000b 0000000c0000000d0000000e0000000f …` (1024 bytes; the full value is in the source) |

**Vector 6** — [Pseudo-random data, odd length](https://en.wikipedia.org/wiki/LZ78)

| Field | Value |
| --- | --- |
| `input` | `80000000000000004000000000004000 00400040800040000000000040000000 4080c000000000000000000000000000 00400000000040004080c00000000000 40` |
| `expected` | `00000080000000000200000003000000 02000040040000000500000007000040 0100000000000040060000000a000000 03000040010000c00b0000000f000000 070000000d0000000a000080000000c0 0b000040` |

**Vector 7** — [Alternating pattern, odd length](https://en.wikipedia.org/wiki/LZ78)

| Field | Value |
| --- | --- |
| `input` | `61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 616261` |
| `expected` | `00000061000000620100006203000061 02000061050000620400006207000061 0600006109000062080000620b000061 0a0000610d0000620c000062040001` |

---

[← All algorithms](../README.md)
