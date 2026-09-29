# LZH

> LHA/LHarc -lh5- method: LZSS matching over an 8 KiB window feeding two per-block Huffman trees, a 510-symbol literal/length tree whose code lengths travel through a 19-symbol code-length tree, and a slot-based position tree with raw extra bits.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Haruyasu Yoshizaki, Haruhiko Okumura |
| Year | 1988 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/compression/lzh.js`](../../../algorithms/compression/lzh.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [LHA file format](https://en.wikipedia.org/wiki/LHA_(file_format))
- [LZ77 and LZ78](https://en.wikipedia.org/wiki/LZ77_and_LZ78)
- [Canonical Huffman code](https://en.wikipedia.org/wiki/Canonical_Huffman_code)

## References

- [Haruhiko Okumura on LZHUF and LZARI](https://oku.edu.mie-u.ac.jp/~okumura/compression/)
- [Huffman coding](https://en.wikipedia.org/wiki/Huffman_coding)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - header only](https://en.wikipedia.org/wiki/LHA_(file_format))

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 'A' - single-symbol trees](https://en.wikipedia.org/wiki/LHA_(file_format))

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `0100000000010000041000` |

**Vector 3** — [All literals (ABCD)](https://en.wikipedia.org/wiki/LHA_(file_format))

| Field | Value |
| --- | --- |
| `input` | `41424344` |
| `expected` | `04000000000428052450b7c006c0` |

**Vector 4** — [Simple repetition - AAAA](https://en.wikipedia.org/wiki/LHA_(file_format))

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | `04000000000220043010b6554010` |

**Vector 5** — [Pattern ABCABC](https://en.wikipedia.org/wiki/LHA_(file_format))

| Field | Value |
| --- | --- |
| `input` | `414243414243` |
| `expected` | `06000000000428053010b7951021b0` |

**Vector 6** — [English text with repeats](https://en.wikipedia.org/wiki/LHA_(file_format))

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20` |
| `expected` | `5a000000002b48aeb0a93e067fd560f5 5200e0018e46079c0012334184289f56 3c8959c3f2b8551af902a9a235f33bce 07c47eb75e18` |

**Vector 7** — [Long run - 256 bytes of 'a'](https://en.wikipedia.org/wiki/LHA_(file_format))

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `00010000000220043fd136c34010` |

**Vector 8** — [All 256 byte values in order](https://en.wikipedia.org/wiki/LHA_(file_format))

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00010000010002a000000020406080a0 c0e10121416181a1c1e20222426282a2 c2e30323436383a3c3e40424446484a4 c4e50525456585a5c5e60626466686a6 …` (266 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
