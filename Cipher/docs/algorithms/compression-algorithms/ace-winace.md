# ACE (WinAce)

> WinAce's ACE 1.0 method: an LZ77 matcher over a 32 KiB dictionary feeding two per-block Huffman trees, a 284-symbol main tree of literals, an end-of-block marker and 27 match-length slots whose code lengths travel through a 19-symbol pre-tree, plus a 2-bit distance mode selecting either an explicit 15-bit distance or one of three recent distances. Bits are packed most-significant-bit first and flushed as 16-bit little-endian words.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Marcel Lemke |
| Year | 1998 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/compression/ace-archiver.js`](../../../algorithms/compression/ace-archiver.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [ACE (compression format)](https://en.wikipedia.org/wiki/ACE_(compression_format))
- [Canonical Huffman code](https://en.wikipedia.org/wiki/Canonical_Huffman_code)

## References

- [Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952](https://en.wikipedia.org/wiki/Huffman_coding)
- [Ziv and Lempel, A Universal Algorithm for Sequential Data Compression, 1977](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - length header only](https://en.wikipedia.org/wiki/ACE_(compression_format))

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 'A' - one literal plus end-of-block](https://en.wikipedia.org/wiki/ACE_(compression_format))

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `0100000080090080000000000000b30da5fe00202000` |

**Vector 3** — [Repeated byte run - one literal then a single long match](https://en.wikipedia.org/wiki/ACE_(compression_format))

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161` |
| `expected` | `1000000081090010000000000000b60a13fe4080008080043000` |

**Vector 4** — [Periodic text - three literals then a match carrying extra length bits](https://en.wikipedia.org/wiki/ACE_(compression_format))

| Field | Value |
| --- | --- |
| `input` | `6162636162636162636162636162636162636162` |
| `expected` | `1400000080090011000000000000b70ae0cf0cf000066e0000480009` |

---

[← All algorithms](../README.md)
