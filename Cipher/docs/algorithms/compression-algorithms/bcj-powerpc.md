# BCJ PowerPC

> Branch/Call/Jump filter for big-endian PowerPC machine code. Detects B/BL (Branch, Branch with Link) instructions, identified by opcode 18 with the absolute-address bit clear, and rewrites their word-aligned 24-bit relative offset into an absolute byte address so repeated branches to the same target produce identical byte sequences.

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
| Source | [`algorithms/compression/bcj-powerpc.js`](../../../algorithms/compression/bcj-powerpc.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [7-Zip / LZMA SDK](https://www.7-zip.org/sdk.html)
- [xz File Format / liblzma simple filters](https://tukaani.org/xz/xz-file-format.txt)
- [liblzma PowerPC filter source](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/powerpc.c)

## References

- [Power ISA specification (branch instructions)](https://openpowerfoundation.org/specifications/isa/)
- [Tukaani Project (xz-utils)](https://tukaani.org/xz/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty buffer](https://tukaani.org/xz/xz-file-format.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Two consecutive B/BL instructions (big-endian words, opcode 18)](https://www.7-zip.org/sdk.html)

| Field | Value |
| --- | --- |
| `input` | `4800000148001001` |
| `expected` | `4800000148001005` |

---

[← All algorithms](../README.md)
