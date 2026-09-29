# LZG

> Minimal LZ77-based compression with a deliberately tiny decoder. Literals pass through untouched; the escape byte 0xFF introduces either an escaped literal or a back-reference over a 2 KiB window. Designed for embedded systems that need fast decompression with minimal memory.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Marcus Geelnard |
| Year | 2004 |
| Origin | 🇸🇪 Sweden |
| Source | [`algorithms/compression/lzg.js`](../../../algorithms/compression/lzg.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [liblzg GitHub Repository](https://github.com/mbitsnbites/liblzg)
- [liblzg Project Site](https://liblzg.bitsnbites.eu/)

## References

- [GitLab Mirror](https://gitlab.com/mbitsnbites/liblzg)
- [LZ77 and LZ78](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - header only](https://liblzg.bitsnbites.eu/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 'A' - one literal](https://liblzg.bitsnbites.eu/)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `0100000041` |

**Vector 3** — [All literals - no match of length 3 exists (ABCD)](https://liblzg.bitsnbites.eu/)

| Field | Value |
| --- | --- |
| `input` | `41424344` |
| `expected` | `0400000041424344` |

**Vector 4** — [Simple repetition - AAAA (literal plus 3-byte back-reference at distance 1)](https://liblzg.bitsnbites.eu/)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | `0400000041ff010001` |

**Vector 5** — [Pattern ABCABC - 3 literals plus a back-reference at distance 3](https://liblzg.bitsnbites.eu/)

| Field | Value |
| --- | --- |
| `input` | `414243414243` |
| `expected` | `06000000414243ff010003` |

**Vector 6** — [Escaped literal - the escape byte 0xFF appearing in the data](https://liblzg.bitsnbites.eu/)

| Field | Value |
| --- | --- |
| `input` | `ff41ff` |
| `expected` | `03000000ff0041ff00` |

**Vector 7** — [Long run - 256 bytes of 'a' (match length capped at 257, then 255)](https://liblzg.bitsnbites.eu/)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `0001000061fffd0001` |

**Vector 8** — [Alternating pattern - 200x 'ab'](https://liblzg.bitsnbites.eu/)

| Field | Value |
| --- | --- |
| `input` | `61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 …` (400 bytes; the full value is in the source) |
| `expected` | `900100006162ffff0002ff8b0002` |

**Vector 9** — [Binary sample - all 256 byte values in order (no repeats)](https://liblzg.bitsnbites.eu/)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00010000000102030405060708090a0b 0c0d0e0f101112131415161718191a1b 1c1d1e1f202122232425262728292a2b 2c2d2e2f303132333435363738393a3b …` (261 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
