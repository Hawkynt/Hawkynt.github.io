# RAR3 (classic)

> The classic RAR method of RAR 3.x and 4.x: LZ77 matching over a 4 MiB dictionary with four repeat-offset slots, coded through four Huffman tables - a 299-symbol main table of literals, repeat markers and match-length slots, a 60-slot distance table, a 17-symbol low-distance table carrying the bottom four bits of long distances, and a 28-symbol repeat-length table. Table code lengths travel as deltas modulo 16 through a 20-symbol code-length tree. LZ mode only; the optional PPMd coder and the virtual-machine filters are not produced.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Eugene Roshal |
| Year | 2002 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/compression/rar.js`](../../../algorithms/compression/rar.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RAR (file format)](https://en.wikipedia.org/wiki/RAR_(file_format))
- [Canonical Huffman code](https://en.wikipedia.org/wiki/Canonical_Huffman_code)

## References

- [Storer and Szymanski, Data compression via textual substitution, 1982](https://dl.acm.org/doi/10.1145/322344.322346)
- [Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952](https://en.wikipedia.org/wiki/Huffman_coding)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - length header only](https://en.wikipedia.org/wiki/RAR_(file_format))

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 'A' - one literal](https://en.wikipedia.org/wiki/RAR_(file_format))

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `01000000008000000000000000085b3ff516085480` |

**Vector 3** — [Repeated byte run - one literal then a match](https://en.wikipedia.org/wiki/RAR_(file_format))

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161` |
| `expected` | `10000000008000000000000000086b3fe691cb042a4100` |

**Vector 4** — [Periodic text - literals then a match carrying extra length bits](https://en.wikipedia.org/wiki/RAR_(file_format))

| Field | Value |
| --- | --- |
| `input` | `6162636162636162636162636162636162636162` |
| `expected` | `14000000199000000000000000082b54fe3306edcbb82f101b00` |

---

[← All algorithms](../README.md)
