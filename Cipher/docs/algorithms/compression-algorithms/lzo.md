# LZO

> Lempel-Ziv-Oberhumer compression algorithm. A fast compression library emphasizing decompression speed over compression ratio.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Markus F.X.J. Oberhumer |
| Year | 1996 |
| Origin | Not specified |
| Source | [`algorithms/compression/lzo.js`](../../../algorithms/compression/lzo.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Official LZO Homepage](http://www.oberhumer.com/opensource/lzo/)
- [Wikipedia - LZO](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Oberhumer)

## References

- [LZO Data Compression Library](http://www.oberhumer.com/opensource/lzo/lzodoc.html)
- [miniLZO Implementation](http://www.oberhumer.com/opensource/lzo/download/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](http://www.oberhumer.com/opensource/lzo/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single character literal](http://www.oberhumer.com/opensource/lzo/)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000001041` |

**Vector 3** — [Hello World string (no match, too short)](http://www.oberhumer.com/opensource/lzo/lzodoc.html)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `0b000000b048656c6c6f20576f726c64` |

**Vector 4** — [ABCDEFGH sequence (no match, too short)](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Oberhumer)

| Field | Value |
| --- | --- |
| `input` | `4142434445464748` |
| `expected` | `08000000804142434445464748` |

---

[← All algorithms](../README.md)
