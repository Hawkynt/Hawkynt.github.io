# LZMAT

> Real-time compression using match tables instead of hash chains. Developed by Vitaly Evseenko, LZMAT balances fast compression/decompression speed with good compression ratios. Uses efficient match table lookups for pattern finding.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Vitaly Evseenko |
| Year | 2007 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/compression/lzmat.js`](../../../algorithms/compression/lzmat.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [LZMAT Official Page](http://www.matcode.com/lzmat.htm)
- [LZMAT GitHub Mirror](https://github.com/nemequ/lzmat)
- [LZ77 and LZ78 Algorithms](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

## References

- [LZMAT C Implementation](https://github.com/nemequ/lzmat/blob/master/lzmat_enc.c)
- [LZMAT Header File](https://github.com/nemequ/lzmat/blob/master/lzmat.h)
- [LZ Compression Benchmark](https://github.com/inikep/lzbench)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [No repetition - all literals](https://github.com/nemequ/lzmat)

| Field | Value |
| --- | --- |
| `input` | `41424344` |
| `expected` | `0041004200430044` |

**Vector 2** — [Single character repetition](https://github.com/nemequ/lzmat)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | `004101000103` |

**Vector 3** — [Pattern repetition - ABCABC](https://github.com/nemequ/lzmat)

| Field | Value |
| --- | --- |
| `input` | `414243414243` |
| `expected` | `00410042004301000303` |

**Vector 4** — [Overlapping pattern - ABABABAB](https://github.com/nemequ/lzmat)

| Field | Value |
| --- | --- |
| `input` | `4142414241424142` |
| `expected` | `0041004201000206` |

**Vector 5** — [English sentence compression](https://github.com/nemequ/lzmat)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | _(empty)_ |

**Vector 6** — [Repetitive text long enough to exercise the maximum match length](https://github.com/nemequ/lzmat)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 …` (1000 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
