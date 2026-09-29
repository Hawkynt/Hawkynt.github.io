# BSC (Block Sorting Compression)

> Burrows-Wheeler Transform, Move-to-Front recoding, and an LZMA-style adaptive bit-tree entropy stage (two trees selected by whether the previous rank was zero). Ported to be byte-for-byte identical to CompressionWorkbench's reduced BB_Bsc reference block.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | BWT + Entropy Coding |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Ilya Grebnov (concept); reduced clean-room reimplementation |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/compression/bsc.js`](../../../algorithms/compression/bsc.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [libbsc Repository](https://github.com/IlyaGrebnov/libbsc)
- [bsc Discussion Thread](https://encode.su/threads/586-bsc-new-block-sorting-compressor)
- [Burrows-Wheeler Transform](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform)

## References

- [Burrows-Wheeler SRC-RR-124](https://www.hpl.hp.com/techreports/Compaq-DEC/SRC-RR-124.pdf)
- [LZMA Specification](https://www.7-zip.org/sdk.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty data test](https://github.com/IlyaGrebnov/libbsc)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte test](https://github.com/IlyaGrebnov/libbsc)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | _(empty)_ |

**Vector 3** — [Classic banana example](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform)

| Field | Value |
| --- | --- |
| `input` | `62616e616e61` |
| `expected` | _(empty)_ |

**Vector 4** — [Mixed alphanumeric data](https://encode.su/threads/586-bsc-new-block-sorting-compressor)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | _(empty)_ |

**Vector 5** — [Repetitive text compression](https://github.com/IlyaGrebnov/libbsc)

| Field | Value |
| --- | --- |
| `input` | `616263616263616263616263616263616263` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
