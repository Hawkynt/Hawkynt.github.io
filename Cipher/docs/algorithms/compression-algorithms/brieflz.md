# BriefLZ

> Byte-for-byte port of CompressionWorkbench's clean-room BriefLZ building block: byte-oriented LZ77 with a single tag bit per token (0=literal, 1=match) and Elias-gamma coded match length/offset, matched via a 3-byte multiplicative hash chain. Not bit-compatible with the original Ibsen blz container format (which adds a checksummed header) - only this port's own round trip and CompressionWorkbench's building block are guaranteed to interoperate.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Joergen Ibsen |
| Year | 2002 |
| Origin | Not specified |
| Source | [`algorithms/compression/brieflz.js`](../../../algorithms/compression/brieflz.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [BriefLZ GitHub Repository](https://github.com/jibsen/brieflz)
- [BriefLZ Format Description](https://www.ibsensoftware.com/)
- [Elias Gamma Coding - Wikipedia](https://en.wikipedia.org/wiki/Elias_gamma_coding)

## References

- [Original C Implementation](https://github.com/jibsen/brieflz/blob/master/src/depack.c)
- [BriefLZ README](https://github.com/jibsen/brieflz/blob/master/README.md)
- [Gamma Coding](https://en.wikipedia.org/wiki/Elias_gamma_coding)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://github.com/jibsen/brieflz)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single literal byte](https://github.com/jibsen/brieflz)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000002080` |

**Vector 3** — [Two literal bytes](https://github.com/jibsen/brieflz)

| Field | Value |
| --- | --- |
| `input` | `4142` |
| `expected` | `02000000209080` |

**Vector 4** — [Three literal bytes](https://github.com/jibsen/brieflz)

| Field | Value |
| --- | --- |
| `input` | `414243` |
| `expected` | `0300000020908860` |

**Vector 5** — [256 repeated bytes - exercises long matches and multi-bit gamma codes](https://github.com/jibsen/brieflz)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | _(empty)_ |

**Vector 6** — [1024 repeated bytes - exercises long matches and multi-bit gamma codes](https://github.com/jibsen/brieflz)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 …` (1024 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 7** — [All 256 byte values 0..255](https://github.com/jibsen/brieflz)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | _(empty)_ |

**Vector 8** — [Repeated phrase - exercises literals and matches together](https://github.com/jibsen/brieflz)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
