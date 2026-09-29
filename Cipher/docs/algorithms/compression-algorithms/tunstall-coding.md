# Tunstall Coding

> Variable-to-fixed length source code. Builds a byte-alphabet dictionary by repeatedly splitting the highest-probability phrase into its 256 one-byte extensions, producing a set of variable-length input phrases that are each mapped to one fixed-width codeword.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Variable-to-Fixed Coding |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Brian Parker Tunstall |
| Year | 1967 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/tunstall.js`](../../../algorithms/compression/tunstall.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Tunstall coding - Wikipedia](https://en.wikipedia.org/wiki/Tunstall_coding)
- [B.P. Tunstall PhD dissertation abstract (Georgia Tech, 1967)](https://en.wikipedia.org/wiki/Tunstall_coding#History)
- [Introduction to Data Compression (Sayood) - Variable-to-fixed codes](https://www.elsevier.com/books/introduction-to-data-compression/sayood/978-0-12-620862-7)

## References

- [Elements of Information Theory (Cover and Thomas)](https://www.wiley.com/en-us/Elements+of+Information+Theory%2C+2nd+Edition-p-9780471241959)
- [Self-synchronizing Huffman codes (Ferguson and Rabinowitz, 1984)](https://doi.org/10.1109/TIT.1984.1056980)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://en.wikipedia.org/wiki/Boundary_condition)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Repetitive input - all zero bytes](https://en.wikipedia.org/wiki/Tunstall_coding)

| Field | Value |
| --- | --- |
| `input` | `0000000000000000` |
| `expected` | `08000000080000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (1040 bytes; the full value is in the source) |

**Vector 3** — [Text sample - 'ABAAAB'](https://en.wikipedia.org/wiki/Tunstall_coding)

| Field | Value |
| --- | --- |
| `input` | `414241414142` |
| `expected` | `06000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (1031 bytes; the full value is in the source) |

**Vector 4** — [Text sample - pangram sentence](https://en.wikipedia.org/wiki/Tunstall_coding)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `2b000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (1066 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
