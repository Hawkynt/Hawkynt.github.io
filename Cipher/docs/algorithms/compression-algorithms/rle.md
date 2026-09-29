# RLE

> Simple compression algorithm that replaces consecutive identical bytes with a count-value pair. Most effective on data with long runs of repeated values. Fundamental technique used in many image formats.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Transform |
| Security status | Not classified |
| Complexity | Not specified |
| Inventor | Unknown (fundamental technique) |
| Year | 1967 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/rle.js`](../../../algorithms/compression/rle.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Run-Length Encoding - Wikipedia](https://en.wikipedia.org/wiki/Run-length_encoding)
- [PCX Image Format Specification](https://web.archive.org/web/20100206055706/http://www.qzx.com/pc-gpe/pcx.txt)
- [TIFF PackBits Algorithm](https://www.adobe.io/open/standards/TIFF.html)

## References

- [Mark Nelson RLE Article](https://web.archive.org/web/20071013094925/http://www.dogma.net/markn/articles/rle/rle.htm)
- [Stanford CS106B Compression](https://web.stanford.edu/class/cs106b/lectures/compression/)
- [ITU-T T.4 Fax Standard](https://www.itu.int/rec/T-REC-T.4/en)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Simple repeated pattern - AAABBBCCC](https://en.wikipedia.org/wiki/Run-length_encoding)

| Field | Value |
| --- | --- |
| `input` | `414141424242434343` |
| `expected` | `034103420343` |

**Vector 2** — [Mixed run lengths](https://www.numberanalytics.com/blog/mastering-run-length-encoding-rle-for-data-compression)

| Field | Value |
| --- | --- |
| `input` | `4141414141424243` |
| `expected` | `054102420143` |

**Vector 3** — [No repeated characters](https://en.wikipedia.org/wiki/Run-length_encoding)

| Field | Value |
| --- | --- |
| `input` | `414243444546` |
| `expected` | `014101420143014401450146` |

---

[← All algorithms](../README.md)
