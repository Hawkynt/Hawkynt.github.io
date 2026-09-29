# LZTURBO

> Fast hash-matched LZ77 front end wrapped in a magic/method/length block, modelling LZTURBO's documented outer shape. LZTURBO's real bitstream is closed-source and undocumented, so only the documented block layout is reproduced; the proprietary entropy back end is not (payload is left entropy-uncoded).

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | powturbo |
| Year | 2013 |
| Origin | Not specified |
| Source | [`algorithms/compression/lzturbo.js`](../../../algorithms/compression/lzturbo.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [powturbo Website](https://sites.google.com/site/powturbo/)
- [TurboBench Repository](https://github.com/powturbo/TurboBench)
- [Fast Compression Overview](https://en.wikipedia.org/wiki/LZ4_(compression_algorithm))

## References

- [LZ77 Foundation](https://en.wikipedia.org/wiki/LZ77_and_LZ78)
- [Fast Compression Techniques](https://fastcompression.blogspot.com/)
- [Compression Benchmarks](https://github.com/inikep/lzbench)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://github.com/powturbo/TurboBench)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `4c5a5431000000000000000000` |

**Vector 2** — [Single byte literal](https://github.com/powturbo/TurboBench)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `4c5a54310001000000020000001f41` |

**Vector 3** — [Two character literals](https://github.com/powturbo/TurboBench)

| Field | Value |
| --- | --- |
| `input` | `4142` |
| `expected` | `4c5a54310002000000030000002f4142` |

**Vector 4** — [Repeating pattern shorter than the minimum match length](https://github.com/powturbo/TurboBench)

| Field | Value |
| --- | --- |
| `input` | `414243414243` |
| `expected` | `4c5a54310006000000070000006f414243414243` |

**Vector 5** — [Structured pattern with clear repetition](https://github.com/powturbo/TurboBench)

| Field | Value |
| --- | --- |
| `input` | `616263646566616263646566` |
| `expected` | `4c5a5431000c0000000a00000062616263646566060000` |

**Vector 6** — [Text with no repetition - all literals](https://github.com/powturbo/TurboBench)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `4c5a5431000b0000000c000000bf48656c6c6f20576f726c64` |

**Vector 7** — [Repeated text sample (4x)](https://github.com/powturbo/TurboBench)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `4c5a543100b400000036000000f01074 686520717569636b2062726f776e2066 6f78206a756d7073206f766572201f00 00916c617a7920646f672e0e00000e71 2d0000` |

**Vector 8** — [256 repeated bytes](https://github.com/powturbo/TurboBench)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `4c5a54310000010000060000001e61ed010000` |

**Vector 9** — [All 256 byte values](https://github.com/powturbo/TurboBench)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `4c5a5431000001000002010000fff100 0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 …` (271 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
