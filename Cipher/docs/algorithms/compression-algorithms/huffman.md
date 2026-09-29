# Huffman

> Lossless data compression using optimal prefix codes based on symbol frequencies. Developed by David Huffman in 1952 for minimum-redundancy coding.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Statistical |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | David Albert Huffman |
| Year | 1952 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/huffman.js`](../../../algorithms/compression/huffman.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Paper](https://en.wikipedia.org/wiki/Huffman_coding)
- [Information Theory Tutorial](https://web.stanford.edu/class/ee378a/)

## References

- [Huffman's 1952 Paper](https://ieeexplore.ieee.org/document/4051119)
- [Data Compression Book](https://www.data-compression.com/huffman.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://csrc.nist.gov/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000010000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (260 bytes; the full value is in the source) |

**Vector 2** — [Single byte 0x41](https://csrc.nist.gov/)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `01000000010000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (261 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
