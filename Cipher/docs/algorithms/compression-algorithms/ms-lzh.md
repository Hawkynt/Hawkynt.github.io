# MS-LZH

> Microsoft DriveSpace 3 codec: LZ77 over a 4 KiB window feeding a DEFLATE-shaped alphabet of 286 literal/length symbols and 30 distance symbols. Blocks carry a leading type bit selecting the fixed Huffman tables or per-block dynamic tables in the RFC 1951 dynamic-header layout.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Hybrid |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Microsoft Corporation |
| Year | 1995 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/ms-lzh.js`](../../../algorithms/compression/ms-lzh.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 1951 - DEFLATE Compressed Data Format](https://www.rfc-editor.org/rfc/rfc1951)
- [DriveSpace](https://en.wikipedia.org/wiki/DriveSpace)
- [SZDD and KWAJ Compression Formats (libmspack)](https://www.cabextract.org.uk/libmspack/doc/szdd_kwaj_format.html)

## References

- [libmspack](https://github.com/kyz/libmspack)
- [Canonical Huffman code](https://en.wikipedia.org/wiki/Canonical_Huffman_code)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - header only](https://www.rfc-editor.org/rfc/rfc1951)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 'A' - one literal then end-of-block](https://www.rfc-editor.org/rfc/rfc1951)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000003880` |

**Vector 3** — [All literals (ABCD)](https://www.rfc-editor.org/rfc/rfc1951)

| Field | Value |
| --- | --- |
| `input` | `41424344` |
| `expected` | `0400000038b939ba00` |

**Vector 4** — [Simple repetition - AAAA](https://www.rfc-editor.org/rfc/rfc1951)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | `0400000038810000` |

**Vector 5** — [Pattern ABCABC](https://www.rfc-editor.org/rfc/rfc1951)

| Field | Value |
| --- | --- |
| `input` | `414243414243` |
| `expected` | `0600000038b939811000` |

**Vector 6** — [English text with repeats](https://www.rfc-editor.org/rfc/rfc1951)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20` |
| `expected` | `5a000000524c4aa850d2ccc9cda84951 4fd3cf284b4fd4284d52ced051a84fd3 4ad128024e9c91aaa950949f975e0674 8e5600` |

**Vector 7** — [Long run - 256 bytes of 'a' (match length capped at 64)](https://www.rfc-editor.org/rfc/rfc1951)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `0001000048e2831418a0290000` |

**Vector 8** — [All 256 byte values in order](https://www.rfc-editor.org/rfc/rfc1951)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00010000181899199a1a9b1b9c1c9d1d 9e1e9f1fa020a121a222a323a424a525 a626a727a828a929aa2aab2bac2cad2d ae2eaf2fb030b131b232b333b434b535 …` (275 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
