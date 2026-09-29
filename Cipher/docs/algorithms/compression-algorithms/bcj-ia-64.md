# BCJ IA-64

> Branch/Call/Jump filter for Itanium (IA-64) machine code. Scans 16-byte instruction bundles, uses the 5-bit template field to find slots holding B-unit branch instructions with major opcode 4, and rewrites their bundle-relative 25-bit target into an absolute address so repeated branches to the same target produce identical byte sequences.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Transform |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Igor Pavlov |
| Year | 2003 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/compression/bcj-ia64.js`](../../../algorithms/compression/bcj-ia64.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [7-Zip / LZMA SDK](https://www.7-zip.org/sdk.html)
- [xz File Format / liblzma simple filters](https://tukaani.org/xz/xz-file-format.txt)
- [liblzma IA-64 filter source](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/ia64.c)

## References

- [Intel Itanium Architecture Software Developer's Manual, Vol. 3 (bundle/template format)](https://www.intel.com/content/www/us/en/products/docs/processors/itanium/itanium-architecture-vol-3-manual.html)
- [Tukaani Project (xz-utils)](https://tukaani.org/xz/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty buffer](https://tukaani.org/xz/xz-file-format.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Padding bundle followed by a bundle with a branch in slot 1 (template 18)](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/ia64.c)

| Field | Value |
| --- | --- |
| `input` | `0000000000000000000000000000000012000000000000180900200000000000` |
| `expected` | `0000000000000000000000000000000012000000000000200900200000000000` |

---

[← All algorithms](../README.md)
