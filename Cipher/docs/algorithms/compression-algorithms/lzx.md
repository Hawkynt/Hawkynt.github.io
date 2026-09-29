# LZX

> Microsoft's Lempel-Ziv Extended codec used in CAB, CHM and WIM. LZ77 over a 32 KiB window feeding a main tree of literals plus position-slot/length-header symbols, a secondary length tree and repeated-offset registers R0/R1/R2, all carried in a bit stream flushed as 16-bit little-endian words.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Jonathan Forbes, Tomi Poutanen |
| Year | 1996 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/lzx.js`](../../../algorithms/compression/lzx.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Microsoft CAB Format Specification](https://learn.microsoft.com/en-us/previous-versions/bb417343(v=msdn.10))
- [LZX Algorithm Overview](https://en.wikipedia.org/wiki/LZX)
- [libmspack](https://github.com/kyz/libmspack)

## References

- [Microsoft ms-compress](https://github.com/coderforlife/ms-compress)
- [Canonical Huffman code](https://en.wikipedia.org/wiki/Canonical_Huffman_code)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - header only](https://en.wikipedia.org/wiki/LZX)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 'A' - one literal](https://en.wikipedia.org/wiki/LZX)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `01000000002000100000000000002102 fa077d9f40f400000000000000001f04 f77d00d000000000000000007d10dff7 00640000` |

**Vector 3** — [All literals (ABCD)](https://en.wikipedia.org/wiki/LZX)

| Field | Value |
| --- | --- |
| `input` | `41424344` |
| `expected` | `04000000002000400000000000002120 fa077daacef700000000000000001000 f77d40df00000000000000004100dff7 917d00b00000` |

**Vector 4** — [Simple repetition - AAAA](https://en.wikipedia.org/wiki/LZX)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | `04000000002000400000000000002102 fa077d9f48f400000000000008002d04 dff7e07c000000000000000007017ddf 50f60000` |

**Vector 5** — [Pattern ABCABC](https://en.wikipedia.org/wiki/LZX)

| Field | Value |
| --- | --- |
| `input` | `414243414243` |
| `expected` | `06000000002000600000000000003123 fd077d56cff700000000000000001000 f77d40df00000000000000004100dff7 9b7d00580000` |

**Vector 6** — [English text with repeats](https://en.wikipedia.org/wiki/LZX)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20` |
| `expected` | `5a000000052000a00000000055214300 cf0cdbf448d5c0037f032c7f00000000 0000008041082efd27ae78df00000000 000000004088f7c97fdfa08914c2ab4f 441ee1ac5cf98d2a817cd154ac1b38ef 111fd1fa80c50000` |

**Vector 7** — [Long run - 256 bytes of 'a'](https://en.wikipedia.org/wiki/LZX)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `00010000102000000000000000002102 da077d9f40fc00000000000008003384 7d9fc8f700200000000000001020f77d 5bdf00a40000` |

**Vector 8** — [All 256 byte values in order](https://en.wikipedia.org/wiki/LZX)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00010000102000000000100000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000100df07f47d0000 …` (334 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
