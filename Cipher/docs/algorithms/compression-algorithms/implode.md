# Implode

> PKWARE DCL/ZIP method 6 (Imploding): an 8K sliding-dictionary LZ77 matcher (minimum match length 3) whose literal, length, and distance-high symbols are entropy-coded with three canonical Huffman trees (a raw distance-low field is sent separately).

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary + Entropy Coding |
| Security status | Not classified |
| Complexity | Expert |
| Inventor | PKWARE, Inc. |
| Year | 1989 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/implode.js`](../../../algorithms/compression/implode.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [.ZIP File Format Specification (APPNOTE.TXT)](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)
- [ZIP (file format) - Wikipedia (Imploding method)](https://en.wikipedia.org/wiki/ZIP_(file_format))
- [Shannon-Fano coding - Wikipedia](https://en.wikipedia.org/wiki/Shannon%E2%80%93Fano_coding)

## References

- [StormLib / implode-decoder (historical decoder notes)](https://github.com/ShieldBattery/implode-decoder)
- [LZ77 - Wikipedia](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0000000003` |

**Vector 2** — [Single byte](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `01000000030ff7f7f7f7f7f7f7f7f7f7 f7f7f7f7f7f703f5f5f5f503f5f5f5f5 0501` |

**Vector 3** — [256 repeated bytes](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `00010000030ff7f7f7f7f7f7f7f7f7f7 f7f7f7f7f7f703f5f5f5f503f5f5f5f5 0d0180bf17` |

**Vector 4** — [Text sample repeated 4x](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b4000000031278f77705f7f7f7f7d706 f7f7f7f7f7f7f7f7f703f5f5f5f50504 16f5f5f5c51d9a360ab4edd8ac418b40 fd76419d5b071a07750934efd8aa4dfb 4050a746ed023c006c59af5bd740c3a0 26a935008405fe20` |

**Vector 5** — [All 256 byte values](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00010000030ff7f7f7f7f7f7f7f7f7f7 f7f7f7f7f7f703f5f5f5f503f5f5f5f5 0102060a1c2468b0e02142860a1d266c b8f01122468a1c256ab4e83162c68a1d …` (320 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
