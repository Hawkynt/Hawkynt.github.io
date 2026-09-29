# Move-to-Front (MTF)

> Data transformation algorithm that restructures data for better compressibility by moving recently seen symbols to the front of the alphabet. Core component of BZIP2.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Transform |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Bentley, Sleator, Tarjan, Wei |
| Year | 1986 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/mtf.js`](../../../algorithms/compression/mtf.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Move-to-Front Transform - Wikipedia](https://en.wikipedia.org/wiki/Move-to-front_transform)
- [Data Compression Guide - MTF](https://sites.google.com/view/datacompressionguide/data-transformation-methods/move-to-front-coding-mtf)

## References

- [A Locally Adaptive Data Compression Scheme](https://www.cs.cmu.edu/~sleator/papers/self-organizing-lists.pdf)
- [BZIP2 Algorithm Description](https://en.wikipedia.org/wiki/Bzip2)
- [GeeksforGeeks MTF Implementation](https://www.geeksforgeeks.org/dsa/move-front-data-transform-algorithm/)
- [MTF in Practice](https://michaeldipperstein.github.io/mtf.html)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://en.wikipedia.org/wiki/Move-to-front_transform)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Single character - position 65 in initial alphabet](https://sites.google.com/view/datacompressionguide/data-transformation-methods/move-to-front-coding-mtf)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `41` |

**Vector 3** — [Repeated character - second occurrence becomes 0](https://www.cs.cmu.edu/~sleator/papers/self-organizing-lists.pdf)

| Field | Value |
| --- | --- |
| `input` | `4141` |
| `expected` | `4100` |

**Vector 4** — [Two different characters - both at original positions](https://www.geeksforgeeks.org/dsa/move-front-data-transform-algorithm/)

| Field | Value |
| --- | --- |
| `input` | `4142` |
| `expected` | `4142` |

**Vector 5** — [Pattern ABA - A moves to front after first occurrence](https://michaeldipperstein.github.io/mtf.html)

| Field | Value |
| --- | --- |
| `input` | `414241` |
| `expected` | `414201` |

**Vector 6** — [ABACA pattern - shows MTF ordering dynamics](https://en.wikipedia.org/wiki/Bzip2)

| Field | Value |
| --- | --- |
| `input` | `4142414341` |
| `expected` | `4142014301` |

**Vector 7** — [Classic banana example - demonstrates compression potential](https://sites.google.com/view/datacompressionguide/data-transformation-methods/move-to-front-coding-mtf)

| Field | Value |
| --- | --- |
| `input` | `62616e616e61` |
| `expected` | `62626e010101` |

---

[← All algorithms](../README.md)
