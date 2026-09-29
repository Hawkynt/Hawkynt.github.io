# FastLZ

> Portable byte-aligned LZ77 compression optimized for speed. Features two compression levels: Level 1 (8KB window, ultra-fast) and Level 2 (64KB+ window, better compression). Widely used in games, middleware, and embedded systems.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Ariya Hidayat |
| Year | 2007 |
| Origin | Not specified |
| Source | [`algorithms/compression/fastlz.js`](../../../algorithms/compression/fastlz.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [FastLZ Official Website](https://ariya.github.io/FastLZ/)
- [FastLZ GitHub Repository](https://github.com/ariya/FastLZ)
- [FastLZ Block Format Specification](https://ariya.github.io/FastLZ/#block-format)

## References

- [FastLZ Source Code (fastlz.c)](https://github.com/ariya/FastLZ/blob/master/fastlz.c)
- [FastLZ Header (fastlz.h)](https://github.com/ariya/FastLZ/blob/master/fastlz.h)
- [LZ77 Algorithm - Wikipedia](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Literal run - 3 bytes (FastLZ spec example)](https://ariya.github.io/FastLZ/#block-format)

| Field | Value |
| --- | --- |
| `input` | `414243` |
| `expected` | `0300000002414243` |

**Vector 2** — [Literal run - 2 bytes (no match possible)](https://ariya.github.io/FastLZ/#block-format)

| Field | Value |
| --- | --- |
| `input` | `4445` |
| `expected` | `02000000014445` |

**Vector 3** — [Long match with repeating pattern (DEDEDEDE...)](https://ariya.github.io/FastLZ/#block-format)

| Field | Value |
| --- | --- |
| `input` | `444544454445444544454445` |
| `expected` | `0c000000014445e00101` |

**Vector 4** — [Simple repetition - AAAA](https://github.com/ariya/FastLZ)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | `0400000000412000` |

**Vector 5** — [Pattern repetition - ABCABC](https://github.com/ariya/FastLZ)

| Field | Value |
| --- | --- |
| `input` | `414243414243` |
| `expected` | `06000000024142432002` |

**Vector 6** — [No repetition - worst case](https://github.com/ariya/FastLZ)

| Field | Value |
| --- | --- |
| `input` | `41424344` |
| `expected` | `040000000341424344` |

---

[← All algorithms](../README.md)
