# Zling

> LZ77 dictionary matching followed by canonical Huffman entropy coding, after Zhang Li's libzling. A bounded hash-chain parser emits flag-byte grouped literal and match tokens; the resulting byte stream is Huffman coded with code lengths limited to 15 bits.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Zhang Li (richox) |
| Year | 2013 |
| Origin | 🇨🇳 China |
| Source | [`algorithms/compression/zling.js`](../../../algorithms/compression/zling.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Zling GitHub Repository](https://github.com/richox/libzling)
- [Huffman Coding](https://en.wikipedia.org/wiki/Huffman_coding)
- [Canonical Huffman codes (RFC 1951)](https://www.rfc-editor.org/rfc/rfc1951#section-3.2.2)

## References

- [libzling Source Code](https://github.com/richox/libzling/tree/master/src)
- [LZ77 and LZ78](https://en.wikipedia.org/wiki/LZ77_and_LZ78)
- [Successor: orz Compressor](https://encode.su/threads/2923-orz-an-optimized-ROLZ-data-compressor-written-in-rust)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - header only](https://github.com/richox/libzling)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte](https://github.com/richox/libzling)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `01000000020000000100000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (265 bytes; the full value is in the source) |

**Vector 3** — [Two different bytes](https://github.com/richox/libzling)

| Field | Value |
| --- | --- |
| `input` | `4142` |
| `expected` | `02000000030000000200000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (265 bytes; the full value is in the source) |

**Vector 4** — [Simple repetition AAAA](https://github.com/richox/libzling)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | `04000000050000000202020000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (266 bytes; the full value is in the source) |

**Vector 5** — [Pattern ABAB](https://github.com/richox/libzling)

| Field | Value |
| --- | --- |
| `input` | `41424142` |
| `expected` | `04000000050000000200000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (265 bytes; the full value is in the source) |

**Vector 6** — [Hello string](https://github.com/richox/libzling)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f` |
| `expected` | `05000000060000000300000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (266 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
