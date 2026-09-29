# BALZ

> ROLZ (reduced-offset Lempel-Ziv) compressor by Ilya Muravyov: matches are drawn from a 64-entry table selected by the previous byte, so only a slot index is transmitted, and every bit is coded by a 12-bit adaptive binary arithmetic coder.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based (ROLZ) |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Ilya Muravyov |
| Year | 2008 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/compression/balz.js`](../../../algorithms/compression/balz.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [BALZ v1.00 Release Thread](https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!)
- [BALZ SourceForge Project](https://sourceforge.net/projects/balz/)
- [ROLZ Wikipedia](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

## References

- [Ilya Muravyov GitHub](https://github.com/encode84)
- [Arithmetic coding](https://en.wikipedia.org/wiki/Arithmetic_coding)
- [Matt Mahoney's Compression Benchmark](https://mattmahoney.net/dc/text.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - header only](https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte literal](https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `0100000041fffffe` |

**Vector 3** — [Run of one byte - literal then a single ROLZ match](https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141` |
| `expected` | `0a0000004121f0008678` |

**Vector 4** — [Alternating pattern](https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!)

| Field | Value |
| --- | --- |
| `input` | `41424142` |
| `expected` | `04000000412253673fb46e` |

**Vector 5** — [Repeating sequence - reduced-offset advantage](https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!)

| Field | Value |
| --- | --- |
| `input` | `414243414243414243414243` |
| `expected` | `0c00000041225448f8f9794f3f` |

**Vector 6** — [Natural text](https://encode.su/threads/1038-balz-v1-00-new-LZ77-encoder-is-here!)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `0b0000004835ebd7577ab768ca98283d3b86f2` |

---

[← All algorithms](../README.md)
