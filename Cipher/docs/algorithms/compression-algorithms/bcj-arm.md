# BCJ ARM

> Branch/Call/Jump filter for 32-bit ARM (A32) machine code. Detects BL (Branch with Link) instructions, identified by the 0xEB opcode byte, and rewrites their word-aligned 24-bit relative offset into an absolute word address so repeated calls to the same target produce identical byte sequences.

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
| Source | [`algorithms/compression/bcj-arm.js`](../../../algorithms/compression/bcj-arm.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [7-Zip / LZMA SDK](https://www.7-zip.org/sdk.html)
- [xz File Format / liblzma simple filters](https://tukaani.org/xz/xz-file-format.txt)
- [liblzma ARM filter source](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/arm.c)

## References

- [ARM Architecture Reference Manual (branch instructions)](https://developer.arm.com/documentation/ddi0406/latest/)
- [Tukaani Project (xz-utils)](https://tukaani.org/xz/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty buffer](https://tukaani.org/xz/xz-file-format.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Two consecutive BL instructions (little-endian words, opcode byte 0xEB)](https://www.7-zip.org/sdk.html)

| Field | Value |
| --- | --- |
| `input` | `000000eb010203eb` |
| `expected` | `000000eb020203eb` |

---

[← All algorithms](../README.md)
