# ROLZ (Reduced Offset LZ)

> Context-aware dictionary compression using reduced offset sets. Combines LZ77 dictionary matching with context modeling to reduce active offsets and improve compression efficiency.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Malcolm Taylor |
| Year | 1999 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/compression/rolz.js`](../../../algorithms/compression/rolz.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [ROLZ Algorithm Paper](https://ieeexplore.ieee.org/document/8801741/)
- [ResearchGate ROLZ Study](https://www.researchgate.net/publication/335200832_RoLZ_-_The_Reduced_Offset_LZ_Data_Compression_Algorithm)

## References

- [Large Text Compression Benchmark](https://www.mattmahoney.net/dc/text.html)
- [ROLZ Wikipedia (Russian)](https://ru.wikipedia.org/wiki/ROLZ)
- [Context Modeling in Compression](https://en.wikipedia.org/wiki/Context_mixing)
- [Dictionary Compression Methods](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input test](https://ieeexplore.ieee.org/document/8801741/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single character - no context established](https://ieeexplore.ieee.org/document/8801741/)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000002080` |

**Vector 3** — [Two characters - building context](https://ieeexplore.ieee.org/document/8801741/)

| Field | Value |
| --- | --- |
| `input` | `4142` |
| `expected` | `02000000209080` |

**Vector 4** — [Alternating pattern - context-aware matching](https://ieeexplore.ieee.org/document/8801741/)

| Field | Value |
| --- | --- |
| `input` | `41424142` |
| `expected` | `040000002090882420` |

**Vector 5** — [Repeating sequence - reduced offset advantage](https://ieeexplore.ieee.org/document/8801741/)

| Field | Value |
| --- | --- |
| `input` | `414243414243` |
| `expected` | `060000002090886412110c` |

**Vector 6** — [Natural text with character repetition](https://ieeexplore.ieee.org/document/8801741/)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `0b00000024194d86c37880ae6f391b0c80` |

**Vector 7** — [Structured runs with repetition - optimal case](https://ieeexplore.ieee.org/document/8801741/)

| Field | Value |
| --- | --- |
| `input` | `616161626262636363616161` |
| `expected` | `0c00000030984c26231188c66331984c2610` |

---

[← All algorithms](../README.md)
