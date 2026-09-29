# QuickLZ

> Fast compression algorithm optimized for speed (150-300 MB/s). Uses hash-based LZ77 with control words and optimized match encoding. Level 1 provides balanced speed and compression ratio.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Lasse Mikkel Reinhold |
| Year | 2009 |
| Origin | Not specified |
| Source | [`algorithms/compression/quicklz.js`](../../../algorithms/compression/quicklz.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [QuickLZ Official Website](http://www.quicklz.com/)
- [QuickLZ Wikipedia](https://en.wikipedia.org/wiki/QuickLZ)
- [QuickLZ Manual](http://www.quicklz.com/manual.html)

## References

- [Official QuickLZ Repository](https://github.com/robottwo/quicklz)
- [QuickLZ C# Port](https://www.codeproject.com/Articles/16875/QuickLZ-Pure-C-Port)
- [QuickLZ Format Documentation](https://github.com/ReSpeak/quicklz/blob/master/Format.md)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty data](http://www.quicklz.com/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [No repeated patterns - all literals (ABCD)](http://www.quicklz.com/)

| Field | Value |
| --- | --- |
| `input` | `41424344` |
| `expected` | `040000000000000041424344` |

**Vector 3** — [Pattern repetition - ABC repeated 4 times](http://www.quicklz.com/)

| Field | Value |
| --- | --- |
| `input` | `414243414243414243414243` |
| `expected` | `0c000000080000004142435667` |

**Vector 4** — [Real text compression - English phrase](http://www.quicklz.com/)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20666f78` |
| `expected` | `130000000000000054686520717569636b2062726f776e20666f78` |

**Vector 5** — [High repetition - 16 identical characters](http://www.quicklz.com/)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141414141414141` |
| `expected` | `10000000080000004141415a55` |

**Vector 6** — [Highly repetitive data - 300 bytes](http://www.quicklz.com/)

| Field | Value |
| --- | --- |
| `input` | `58585858585858585858585858585858 58585858585858585858585858585858 58585858585858585858585858585858 58585858585858585858585858585858 …` (300 bytes; the full value is in the source) |
| `expected` | `2c01000018000000585858dfddffdfdd06` |

**Vector 7** — [Alternating pattern - 300 bytes](http://www.quicklz.com/)

| Field | Value |
| --- | --- |
| `input` | `5a595a595a595a595a595a595a595a59 5a595a595a595a595a595a595a595a59 5a595a595a595a595a595a595a595a59 5a595a595a595a595a595a595a595a59 …` (300 bytes; the full value is in the source) |
| `expected` | `2c010000300000005a595a59ffcfffcffc05` |

**Vector 8** — [English text sample - repeated sentence](http://www.quicklz.com/)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20546865 20717569636b2062726f776e20666f78 …` (450 bytes; the full value is in the source) |
| `expected` | `c2010000000000005468652071756963 6b2062726f776e20666f78206a756d70 73206f766572207401180000e0766c61 7a7920646f672e202fe0ff7f6772` |

---

[← All algorithms](../README.md)
