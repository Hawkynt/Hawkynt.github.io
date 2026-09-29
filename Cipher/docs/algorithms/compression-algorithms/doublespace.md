# DoubleSpace

> MS-DOS 6.0/6.2 real-time disk compression codec (DBLSPACE.BIN, SVDC cluster format). Sliding-window LZ77 with a 4KB window, a 2-bit length class (extending to 14 bits), and a 2-bit distance class selecting one of four fixed-width offset tiers; minimum match length 2 bytes. Documented-subset reimplementation - no official bitstream spec exists.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Microsoft Corporation |
| Year | 1993 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/doublespace.js`](../../../algorithms/compression/doublespace.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Microsoft TechNet Archive - What is DoubleSpace and How Does It Work?](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10))
- [Wikipedia - DriveSpace](https://en.wikipedia.org/wiki/DriveSpace)

## References

- [Stac Electronics, Inc. v. Microsoft Corp., 38 F.3d 1126 (Fed. Cir. 1994)](https://en.wikipedia.org/wiki/Stac_Electronics_v._Microsoft_Corporation)
- [Storer and Szymanski, Data compression via textual substitution, 1982](https://dl.acm.org/doi/10.1145/322344.322346)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10))

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10))

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000008200` |

**Vector 3** — [Text sample repeated 4x](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10))

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b4000000e8a02903224e9d3463d68010 23e7cd1d3720ccbcc103424d9d3670e6 807863a78c1c90e26113464f1e1064de 9c713940f3ff0716` |

**Vector 4** — [256 repeated bytes](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10))

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `00010000c2feef0200` |

**Vector 5** — [All 256 byte values](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10))

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00010000000410308040010307102450 b0804103070f204490308142050b1730 64d0b08143070f1f4084103182440913 2750a450b182450b172f60c490318346 …` (292 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
