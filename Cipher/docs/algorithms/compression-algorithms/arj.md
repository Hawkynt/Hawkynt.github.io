# ARJ

> ARJ method 1: LZSS matching over a 26624-byte window with match lengths 3 to 256, feeding a 510-symbol literal/length Huffman tree and a 17-slot position tree rebuilt for every block of at most 16384 tokens. The literal/length code lengths are themselves transmitted through a 19-symbol code-length tree whose own lengths use a three-bit field with a unary extension. Bits are packed most-significant-bit first through a 16-bit register.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Robert K. Jung |
| Year | 1991 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/arj.js`](../../../algorithms/compression/arj.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [ARJ TECHNOTE.TXT (from UNARJ 2.65 sources)](https://raw.githubusercontent.com/tripsin/unarj/master/TECHNOTE.TXT)
- [ARJ](https://en.wikipedia.org/wiki/ARJ)

## References

- [Storer and Szymanski, Data compression via textual substitution, 1982](https://dl.acm.org/doi/10.1145/322344.322346)
- [Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952](https://en.wikipedia.org/wiki/Huffman_coding)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - length header only](https://raw.githubusercontent.com/tripsin/unarj/master/TECHNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 'A' - one literal in a single-symbol tree](https://raw.githubusercontent.com/tripsin/unarj/master/TECHNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `0100000000010000041000` |

**Vector 3** — [Repeated byte run - one literal then a single long match](https://raw.githubusercontent.com/tripsin/unarj/master/TECHNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161` |
| `expected` | `100000000002200430d1364b4004` |

**Vector 4** — [Periodic text - literals then a match carrying position bits](https://raw.githubusercontent.com/tripsin/unarj/master/TECHNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `6162636162636162636162636162636162636162` |
| `expected` | `140000000004280530f13792d0086c` |

---

[← All algorithms](../README.md)
