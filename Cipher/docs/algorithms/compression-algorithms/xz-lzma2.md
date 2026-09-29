# XZ/LZMA2

> Genuine .xz container (stream header/block/index/footer, CRC32/CRC64) wrapping a real LZMA1 range encoder/decoder pair through real LZMA2 chunk framing. The encoder runs a hash-chain LZ77 parse (with rep0-3 match awareness) through the range coder to emit genuine LZMA-compressed chunks, falling back to an uncompressed chunk per-chunk when that is smaller. Verified genuinely interoperable with XZ Utils 5.8.2 in both directions.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Lasse Collin, Igor Pavlov |
| Year | 2009 |
| Origin | 🌐 International |
| Source | [`algorithms/compression/xz-lzma2.js`](../../../algorithms/compression/xz-lzma2.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [XZ Utils Wikipedia](https://en.wikipedia.org/wiki/XZ_Utils)
- [Official XZ Utils](https://tukaani.org/xz/)

## References

- [XZ Format Specification](https://tukaani.org/xz/xz-file-format.txt)
- [LZMA SDK / 7-Zip](https://www.7-zip.org/sdk.html)
- [LZMA2 vs LZMA1](https://en.wikipedia.org/wiki/LZMA)
- [Linux Man Page](https://linux.die.net/man/1/xz)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://tukaani.org/xz/xz-file-format.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Single character round-trip](https://tukaani.org/xz/)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | _(empty)_ |

**Vector 3** — [Short text with literals round-trip](https://tukaani.org/xz/xz-file-format.txt)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f` |
| `expected` | _(empty)_ |

**Vector 4** — [Repeated pattern round-trip](https://en.wikipedia.org/wiki/LZMA)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141` |
| `expected` | _(empty)_ |

**Vector 5** — [Repeating sequence round-trip](https://linux.die.net/man/1/xz)

| Field | Value |
| --- | --- |
| `input` | `414243414243414243` |
| `expected` | _(empty)_ |

**Vector 6** — [Natural text round-trip](https://www.7-zip.org/sdk.html)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20576f726c642120546869 7320697320612074657374206f66204c 5a4d413220636f6d7072657373696f6e 2e` |
| `expected` | _(empty)_ |

**Vector 7** — [Pangram text round-trip](https://tukaani.org/xz/xz-file-format.txt)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
