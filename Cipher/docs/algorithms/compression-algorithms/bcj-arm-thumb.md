# BCJ ARM-Thumb

> Branch/Call/Jump filter for 16-bit ARM Thumb (T32) machine code. Detects the two-halfword BL (Branch with Link) instruction, identified by the 0xF0xx/0xF8xx halfword pattern, and rewrites its halfword-scaled 22-bit relative offset into an absolute address so repeated calls to the same target produce identical byte sequences.

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
| Source | [`algorithms/compression/bcj-arm-thumb.js`](../../../algorithms/compression/bcj-arm-thumb.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [7-Zip / LZMA SDK](https://www.7-zip.org/sdk.html)
- [xz File Format / liblzma simple filters](https://tukaani.org/xz/xz-file-format.txt)
- [liblzma ARM-Thumb filter source](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/armthumb.c)

## References

- [ARM Architecture Reference Manual (Thumb branch instructions)](https://developer.arm.com/documentation/ddi0406/latest/)
- [Tukaani Project (xz-utils)](https://tukaani.org/xz/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty buffer](https://tukaani.org/xz/xz-file-format.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Two consecutive Thumb BL instructions (halfword pair F0xx/F8xx)](https://www.7-zip.org/sdk.html)

| Field | Value |
| --- | --- |
| `input` | `00f000f801f102f9` |
| `expected` | `00f002f801f106f9` |

---

[← All algorithms](../README.md)
