# LZP

> Dictionary compression with context-based prediction using hash tables. Combines PPM-style context modeling with LZ77-style string matching for efficient compression of text with repeated patterns.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Charles Bloom |
| Year | 1996 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/lzp.js`](../../../algorithms/compression/lzp.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [LZP Original Paper (DCC 1996)](https://ieeexplore.ieee.org/document/488353/)
- [LZP Algorithm Description](https://hugi.scene.org/online/coding/hugi 12 - colzp.htm)
- [Semantic Scholar - LZP Paper](https://www.semanticscholar.org/paper/LZP:-a-new-data-compression-algorithm-Bloom/b2fb1bd029e412e57bf7a7e332149d5a6e6bcb1a)

## References

- [LZP Streaming Implementation](https://github.com/lmcilroy/lzp)
- [LZP CODEC Implementation](https://github.com/howerj/lzp)
- [Hugi Article - Yet Another LZP Idea](https://hugi.scene.org/online/coding/hugi 16 - cotadlzr.htm)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input test](https://github.com/howerj/lzp)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0000000003` |

**Vector 2** — [Single byte - all literals (no context)](https://github.com/lmcilroy/lzp)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `01000000030041` |

**Vector 3** — [Repetitive pattern - AAAA](https://github.com/howerj/lzp)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | `04000000030041414141` |

**Vector 4** — [Pattern repetition - ABCABC](https://github.com/lmcilroy/lzp)

| Field | Value |
| --- | --- |
| `input` | `414243414243` |
| `expected` | `060000000300414243414243` |

**Vector 5** — [Real text - Hello world!](https://hugi.scene.org/online/coding/hugi 12 - colzp.htm)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20776f726c6421` |
| `expected` | `0c000000030048656c6c6f20776f00726c6421` |

---

[← All algorithms](../README.md)
