# Reduce

> PKZIP methods 2-5 (Reducing): a DLE-escaped LZ77 pre-pass (factor-controlled length/distance bit split) followed by a static, frequency-ranked probabilistic substitution stage using per-byte follower sets of up to 32 candidate successor bytes.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary + RLE |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Systems Enhancement Associates (SEA); adapted by PKWARE, Inc. |
| Year | 1989 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/reduce.js`](../../../algorithms/compression/reduce.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [.ZIP File Format Specification (APPNOTE.TXT)](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)
- [ZIP (file format) - Wikipedia (Reducing method)](https://en.wikipedia.org/wiki/ZIP_(file_format))
- [Move-to-front transform - Wikipedia (adaptive list technique)](https://en.wikipedia.org/wiki/Move-to-front_transform)

## References

- [Info-ZIP unreduce.c (historical decoder notes)](https://github.com/LuaDist/zziplib)
- [ARC archiver history (original SEA reducing algorithm)](https://en.wikipedia.org/wiki/ARC_(file_format))

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0000000004` |

**Vector 2** — [Single byte](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `01000000040000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 000000000041` |

**Vector 3** — [256 repeated bytes](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `00010000040000000000000000000000 04000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000004f00000000000 00000000000000000000000000000000 00000000000000000000000000104002 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 0000000000000004edc300` |

**Vector 4** — [Text sample repeated 4x](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b4000000040000040200000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (259 bytes; the full value is in the source) |

**Vector 5** — [All 256 byte values](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `000100000440f01ff807fd017fb01fe8 07f9017e701fd807f5017d301fc807f1 017cf01eb807ed017bb01ea807e9017a 701e9807e50179301e8807e10178f01d …` (487 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
