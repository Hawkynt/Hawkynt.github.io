# LZRLE

> LZO-RLE compression combining LZ77 dictionary-based compression with run-length encoding for zero sequences. Default zram compressor in Linux kernel 5.1+, optimized for zero-heavy data common in RAM compression.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary + RLE |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Markus F.X.J. Oberhumer, Dave Rodgman |
| Year | 2018 |
| Origin | Not specified |
| Source | [`algorithms/compression/lzrle.js`](../../../algorithms/compression/lzrle.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Linux Kernel LZO Documentation](https://docs.kernel.org/staging/lzo.html)
- [Kernel.org LZO Specification](https://www.kernel.org/doc/Documentation/lzo.txt)
- [LZO-RLE Patch Discussion](https://lwn.net/Articles/778510/)
- [LZO-RLE Kernel Patch](https://lore.kernel.org/lkml/20181127161913.23863-7-dave.rodgman@arm.com/)

## References

- [Official LZO Homepage](http://www.oberhumer.com/opensource/lzo/)
- [Wikipedia - LZO](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Oberhumer)
- [ZRAM Default to LZO-RLE](https://lore.kernel.org/lkml/20181130114715.27523-9-dave.rodgman@arm.com/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Minimum zero run (4 bytes)](https://github.com/Hawkynt (CompressionWorkbench LzrleBuildingBlock))

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `040000008000` |

**Vector 2** — [Literals only - no compression](https://github.com/Hawkynt (CompressionWorkbench LzrleBuildingBlock))

| Field | Value |
| --- | --- |
| `input` | `414243` |
| `expected` | `0300000003414243` |

**Vector 3** — [Empty input](https://github.com/Hawkynt (CompressionWorkbench LzrleBuildingBlock))

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

---

[← All algorithms](../README.md)
