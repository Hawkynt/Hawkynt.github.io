# BCJ ARM64

> Branch/Call/Jump filter for AArch64 (ARM64) machine code. Detects BL instructions (top 6 bits equal to 100101) and ADRP instructions (bits 31,28-24 equal to 1001x) and rewrites their word- or page-relative immediates into an absolute form so repeated calls and page references produce identical byte sequences.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Transform |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Lasse Collin (Tukaani Project) |
| Year | 2022 |
| Origin | 🌐 International |
| Source | [`algorithms/compression/bcj-arm64.js`](../../../algorithms/compression/bcj-arm64.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [xz File Format / liblzma simple filters](https://tukaani.org/xz/xz-file-format.txt)
- [XZ Utils 5.4.0 release notes (ARM64 filter stabilized)](https://github.com/tukaani-project/xz/releases/tag/v5.4.0)
- [liblzma ARM64 filter source](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/arm64.c)

## References

- [Arm Architecture Reference Manual for A-profile architecture](https://developer.arm.com/documentation/ddi0487/latest/)
- [Tukaani Project (xz-utils)](https://tukaani.org/xz/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty buffer](https://tukaani.org/xz/xz-file-format.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Two consecutive BL instructions (top 6 bits 100101, little-endian words)](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/arm64.c)

| Field | Value |
| --- | --- |
| `input` | `0000009401000095` |
| `expected` | `0000009402000095` |

**Vector 3** — [ADRP instructions within one 4 KiB page (guard leaves them unchanged)](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/arm64.c)

| Field | Value |
| --- | --- |
| `input` | `0000009001000091` |
| `expected` | `0000009001000091` |

---

[← All algorithms](../README.md)
