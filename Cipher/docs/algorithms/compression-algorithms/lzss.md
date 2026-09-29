# LZSS

> Lempel-Ziv-Storer-Szymanski compression algorithm. An improved variant of LZ77 that omits short matches and uses bit flags to distinguish literals from references. Wire format: a 4-byte little-endian original-length header, then groups of up to 8 tokens each preceded by a flag byte (bit=1 literal, bit=0 match); matches are 2 bytes encoding a 12-bit distance and 4-bit length (3-18) found via a 3-byte hash-chain match finder.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | James A. Storer and Thomas G. Szymanski |
| Year | 1982 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/lzss.js`](../../../algorithms/compression/lzss.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Wikipedia - LZSS](https://en.wikipedia.org/wiki/LZSS)
- [Original Paper](https://dl.acm.org/doi/10.1145/322344.322346)

## References

- [Data Compression Techniques](http://www.data-compression.info/Algorithms/LZSS/)
- [LZSS Implementation Guide](https://oku.edu.mie-u.ac.jp/~okumura/compression/lzss.c)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [AAAAAAAAAA repetition](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141` |
| `expected` | `0a00000001410006` |

**Vector 2** — [Random data - no matches](https://sites.google.com/view/datacompressionguide/dictionary-based-compression/lempel-ziv-lz77lzss-coding)

| Field | Value |
| --- | --- |
| `input` | `4142434445464748494a4b4c4d4e4f50` |
| `expected` | `10000000ff4142434445464748ff494a4b4c4d4e4f50` |

**Vector 3** — [Empty input](https://en.wikipedia.org/wiki/Boundary_condition)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 4** — [Highly repetitive data - 300 bytes](https://en.wikipedia.org/wiki/LZSS)

| Field | Value |
| --- | --- |
| `input` | `58585858585858585858585858585858 58585858585858585858585858585858 58585858585858585858585858585858 58585858585858585858585858585858 …` (300 bytes; the full value is in the source) |
| `expected` | `2c0100000158000f000f000f000f000f 000f000f00000f000f000f000f000f00 0f000f000f00000f0008` |

**Vector 5** — [Alternating pattern - 300 bytes](https://en.wikipedia.org/wiki/LZSS)

| Field | Value |
| --- | --- |
| `input` | `5a595a595a595a595a595a595a595a59 5a595a595a595a595a595a595a595a59 5a595a595a595a595a595a595a595a59 5a595a595a595a595a595a595a595a59 …` (300 bytes; the full value is in the source) |
| `expected` | `2c010000035a59001f001f001f001f00 1f001f00001f001f001f001f001f001f 001f001f00001f001f0017` |

**Vector 6** — [English text sample - repeated sentence](https://en.wikipedia.org/wiki/LZSS)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20546865 20717569636b2062726f776e20666f78 …` (450 bytes; the full value is in the source) |
| `expected` | `c2010000ff5468652071756963ff6b20 62726f776e20ff666f78206a756d70ff 73206f7665722074fe01e06c617a7920 646f0f672e205402cf02cf02cf02cf00 02cf02cf02cf02cf02cf02cf02cf02cf 0002cf02cf02cf02cf02cf02cf02cf02 cf0002cf02cf02c5` |

---

[← All algorithms](../README.md)
