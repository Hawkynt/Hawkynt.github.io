# BCJ SPARC

> Branch/Call/Jump filter for big-endian SPARC machine code. Detects CALL instructions, identified by their top two format bits equal to 01, and rewrites their word-aligned 30-bit relative displacement into an absolute word address so repeated calls to the same target produce identical byte sequences.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Transform |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Igor Pavlov |
| Year | 2003 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/compression/bcj-sparc.js`](../../../algorithms/compression/bcj-sparc.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [7-Zip / LZMA SDK](https://www.7-zip.org/sdk.html)
- [xz File Format / liblzma simple filters](https://tukaani.org/xz/xz-file-format.txt)
- [liblzma SPARC filter source](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/sparc.c)

## References

- [The SPARC Architecture Manual (CALL instruction, Format 1)](https://www.gaisler.com/doc/sparcv8.pdf)
- [Tukaani Project (xz-utils)](https://tukaani.org/xz/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty buffer](https://tukaani.org/xz/xz-file-format.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Two consecutive CALL instructions (big-endian words, format bits 01)](https://www.7-zip.org/sdk.html)

| Field | Value |
| --- | --- |
| `input` | `4000001040000100` |
| `expected` | `4000001040000101` |

---

[← All algorithms](../README.md)
