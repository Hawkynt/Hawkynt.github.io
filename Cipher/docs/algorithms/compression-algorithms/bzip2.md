# BZIP2

> Block-sorting compression using Burrows-Wheeler Transform, Move-to-Front coding, Run-Length Encoding, and Huffman coding. Both compression and decompression are implemented and interoperate with the real bzip2 CLI in both directions (verified against bzip2 1.0.8: it decodes our compressed output, and our decoder reads real bzip2 -9 output, including block and stream CRC verification). The encoder always uses the minimum legal number of Huffman tables (2, both identical) rather than bzip2's multi-table selector optimization, so output is larger than the reference encoder's but fully standard-compliant.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Block Sorting |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Julian Seward |
| Year | 1996 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/compression/bzip2.js`](../../../algorithms/compression/bzip2.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Official BZIP2 Homepage](https://sourceware.org/bzip2/)
- [BZIP2 Format Specification](https://github.com/dsnet/compress/blob/master/doc/bzip2-format.pdf)
- [Wikipedia - Bzip2](https://en.wikipedia.org/wiki/Bzip2)

## References

- [Burrows-Wheeler Transform Paper](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform)
- [Original bzip2 Repository](https://gitlab.com/bzip2/bzip2)
- [Go Implementation Reference](https://github.com/golang/go/tree/master/src/compress/bzip2)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Hello World - Go stdlib test vector](https://github.com/golang/go/blob/master/src/compress/bzip2/bzip2_test.go)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `input` | `425a68393141592653594eece8360000 0251800010400006449080200031064c 4101a7a9a580bb9431f8bb9229c28482 776741b0` |
| `expected` | `68656c6c6f20776f726c640a` |

**Vector 2** — [32 Zero Bytes - Go stdlib test vector](https://github.com/golang/go/blob/master/src/compress/bzip2/bzip2_test.go)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `input` | `425a6839314159265359b5aa50980000 00600040000004200021008283177245 385090b5aa5098` |
| `expected` | `0000000000000000000000000000000000000000000000000000000000000000` |

**Vector 3** — [1MiB Zeros - Go stdlib test vector](https://github.com/golang/go/blob/master/src/compress/bzip2/bzip2_test.go)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `input` | `425a683931415926535938571ce50008 084000c0040008200030cc0529a60806 c4201e2ee48a70a12070ae39ca` |
| `expected` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (1048576 bytes; the full value is in the source) |

**Vector 4** — [Round-trip - short text (compression + decompression)](https://sourceware.org/bzip2/)

| Field | Value |
| --- | --- |
| `inverse` | No |
| `input` | `68656c6c6f20776f726c64` |
| `expected` | _(empty)_ |

**Vector 5** — [Round-trip - repeated pattern (compression + decompression)](https://sourceware.org/bzip2/)

| Field | Value |
| --- | --- |
| `inverse` | No |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 …` (900 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 6** — [Round-trip - all 256 byte values (compression + decompression)](https://sourceware.org/bzip2/)

| Field | Value |
| --- | --- |
| `inverse` | No |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
