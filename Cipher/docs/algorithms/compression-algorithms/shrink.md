# Shrink

> PKZIP method 1 (Shrinking): dynamic LZW coding with encoder-controlled variable code width (9-13 bits) and partial dictionary clearing, which frees only leaf (unreferenced) entries instead of resetting the whole table.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary (LZW) |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | PKWARE, Inc. (based on Terry Welch's LZW) |
| Year | 1989 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/shrink.js`](../../../algorithms/compression/shrink.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [.ZIP File Format Specification (APPNOTE.TXT)](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)
- [ZIP (file format) - Wikipedia (Shrinking method)](https://en.wikipedia.org/wiki/ZIP_(file_format))
- [A Technique for High-Performance Data Compression (Welch, 1984)](https://ieeexplore.ieee.org/document/1659158)

## References

- [Info-ZIP unshrink.c (historical decoder notes)](https://github.com/LuaDist/zziplib)
- [Lempel-Ziv-Welch - Wikipedia](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000004100` |

**Vector 3** — [256 repeated bytes](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `0001000061020a1c48b0a0c18308132a5cc8b0a1c38710234a9c48b1a240` |

**Vector 4** — [Text sample repeated 4x](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b400000074d0940111a74e9a316b4088 91f3e68e1b1066dee001a1a64e1b3873 40bcb153460e888003d984d193070499 37675c7c1448d02042850c1d429448d1 22468d1c3d82042192a449942a77163c 987061c387112756bc987163c7952147 963c99126a4ba2308fce546ab3694eab 3da7020501` |

**Vector 5** — [All 256 byte values](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `000100000002081840a0808103081228 58c0a08183071022489840a182850b18 3268d8c0a183870f2042881841a28489 132852a858c1a2858b173062c89841a3 …` (292 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
