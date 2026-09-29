# BCJ x86

> Branch/Call/Jump filter for 32/64-bit x86 machine code. Scans for CALL (0xE8) and JMP (0xE9) opcodes and rewrites their 32-bit little-endian relative displacement into an absolute value relative to the start of the buffer, making repeated calls to the same target produce identical byte sequences that an LZ-family compressor can match.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Transform |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Igor Pavlov |
| Year | 2001 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/compression/bcj-x86.js`](../../../algorithms/compression/bcj-x86.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [7-Zip / LZMA SDK](https://www.7-zip.org/sdk.html)
- [xz File Format / liblzma simple filters](https://tukaani.org/xz/xz-file-format.txt)
- [liblzma x86 filter source](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/x86.c)

## References

- [Tukaani Project (xz-utils)](https://tukaani.org/xz/)
- [7-Zip source browser](https://sourceforge.net/projects/sevenzip/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty buffer](https://tukaani.org/xz/xz-file-format.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [CALL rel32 immediately followed by NOP padding](https://www.7-zip.org/sdk.html)

| Field | Value |
| --- | --- |
| `input` | `e800000000909090` |
| `expected` | `e805000000909090` |

**Vector 3** — [Typical function prologue with CALL and JMP](https://www.7-zip.org/sdk.html)

| Field | Value |
| --- | --- |
| `input` | `5589e5e810000000e920000000c3` |
| `expected` | `5589e5e818000000e92d000000c3` |

---

[← All algorithms](../README.md)
