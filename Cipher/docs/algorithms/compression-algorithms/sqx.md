# SQX

> The SQX archiver's LZH method: an LZ77 matcher over a 32 KiB dictionary feeding a 310-symbol main tree that folds literals, four repeated-distance slots, length-2 and length-3 matches with inline distances, and 25 length-4-or-more slots into one alphabet, alongside a 48-slot distance tree. Per-block code lengths travel through a 19-symbol pre-tree written as raw 4-bit fields, and all bit fields are most-significant-bit first.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Rainer Nausedat |
| Year | 2004 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/compression/sqx.js`](../../../algorithms/compression/sqx.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [fileformat.com - SQX File Format](https://docs.fileformat.com/compression/sqx/)
- [Canonical Huffman code](https://en.wikipedia.org/wiki/Canonical_Huffman_code)

## References

- [Storer and Szymanski, Data compression via textual substitution, 1982](https://dl.acm.org/doi/10.1145/322344.322346)
- [Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952](https://en.wikipedia.org/wiki/Huffman_coding)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - length header only](https://docs.fileformat.com/compression/sqx/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 'A' - one literal](https://docs.fileformat.com/compression/sqx/)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `0100000000010100000000000000001b67fefd280000` |

**Vector 3** — [Repeated byte run - one literal then a length-4-or-more match](https://docs.fileformat.com/compression/sqx/)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161` |
| `expected` | `1000000000020100000000000000001d67fd721548c00000` |

**Vector 4** — [Periodic text - literals then a match carrying extra length bits](https://docs.fileformat.com/compression/sqx/)

| Field | Value |
| --- | --- |
| `input` | `6162636162636162636162636162636162636162` |
| `expected` | `140000000004332000000000000000156a9fcb604db910da800000` |

---

[← All algorithms](../README.md)
