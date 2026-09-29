# Crush

> Fast LZ77 coder by Ilya Muravyov. Every token carries a single tag bit; matches add an Elias-gamma coded length and a fixed 16-bit offset. The parse is a backward dynamic program over the gamma cost brackets rather than a greedy longest-match choice.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary (LZ77) |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Ilya Muravyov |
| Year | 2010 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/compression/crush.js`](../../../algorithms/compression/crush.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [bcrush Implementation](https://github.com/jibsen/bcrush)
- [LZ77 Algorithm](https://en.wikipedia.org/wiki/LZ77_and_LZ78)
- [Elias Gamma Coding](https://en.wikipedia.org/wiki/Elias_gamma_coding)

## References

- [Original Crush Discussion](https://encode.su/)
- [Fast Compression Algorithms](https://fastcompression.blogspot.com/)
- [Compression Benchmark](http://mattmahoney.net/dc/text.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - header only](https://github.com/jibsen/bcrush)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte literal](https://github.com/jibsen/bcrush)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000002080` |

**Vector 3** — [Run of one byte - literal then an overlapping match](https://github.com/jibsen/bcrush)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141` |
| `expected` | `0a00000020ce0000` |

**Vector 4** — [Alternating pattern](https://github.com/jibsen/bcrush)

| Field | Value |
| --- | --- |
| `input` | `41424142` |
| `expected` | `040000002090882420` |

**Vector 5** — [Repeating sequence](https://github.com/jibsen/bcrush)

| Field | Value |
| --- | --- |
| `input` | `414243414243414243414243` |
| `expected` | `0c00000020908873800100` |

**Vector 6** — [Natural text without repeats](https://github.com/jibsen/bcrush)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `0b00000024194d86c37880ae6f391b0c80` |

---

[← All algorithms](../README.md)
