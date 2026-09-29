# LZMS

> Microsoft's LZ77 compression format, introduced with Windows 8 for the WIM (Windows Imaging Format) archiver and msdelta, succeeding LZX/Xpress-Huffman in that lineage. Interleaves a forward Huffman stream for literals, lengths and offset slots with a backward range-coded stream for the binary decisions. Clean-room implementation: no official Microsoft specification exists.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Expert |
| Inventor | Microsoft Corporation |
| Year | 2012 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/lzms.js`](../../../algorithms/compression/lzms.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [wimlib - free implementation of the WIM/SWM/ESD formats (documents the reverse-engineered LZMS design)](https://wimlib.net/)
- [wimlib source repository](https://github.com/ebiggers/wimlib)

## References

- [Windows Imaging Format (WIM) overview](https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/windows-imaging-file-format-wim)
- [LZMA SDK - adaptive binary range coder reference design](https://www.7-zip.org/sdk.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LZMS - empty input (header only)](https://wimlib.net/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [LZMS - single byte](https://wimlib.net/)

| Field | Value |
| --- | --- |
| `input` | `21` |
| `expected` | `010000002100000000` |

**Vector 3** — [LZMS - long repetitive run (300x 0x42)](https://github.com/ebiggers/wimlib)

| Field | Value |
| --- | --- |
| `input` | `42424242424242424242424242424242 42424242424242424242424242424242 42424242424242424242424242424242 42424242424242424242424242424242 …` (300 bytes; the full value is in the source) |
| `expected` | `2c01000042fe2cde1f5e5c` |

**Vector 4** — [LZMS - alternating byte pattern (0xAA/0x55)](https://github.com/ebiggers/wimlib)

| Field | Value |
| --- | --- |
| `input` | `aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55` |
| `expected` | `00010000aa5500fe70df987126` |

**Vector 5** — [LZMS - pseudo-random binary sample](https://github.com/ebiggers/wimlib)

| Field | Value |
| --- | --- |
| `input` | `00004080004000000000400000003800 00400000004080800000408000000000 0040004000400000004080c000400000 00000000400000003800000000000000 …` (512 bytes; the full value is in the source) |
| `expected` | `000200000000408000400010208e00a4 4080802045203e201203c5800a74054b 000c0605409aa05cb0e015ee02c0c197 3041580c413d60bf205eb01897015ae8 24b00f9831460e8d60e6c418f5828540 12070040bb6c17ad038760340e82a940 ad4051083262080b069d012501fcac19 558383701927013d60ad7c109d0668c1 6e608e40a3820c20833820e2841c6301 dcb021390160e03ef205eb60e0140b05 a03c82b160dca8193102c8c2de6c2f9c 73bcba10c3489bff26d3a3aaff392907 7e83506403` |

**Vector 6** — [LZMS - WIM-flavoured text](https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/windows-imaging-file-format-wim)

| Field | Value |
| --- | --- |
| `input` | `546869732057494d202857696e646f77 7320496d6167696e6720466f726d6174 2920696d6167652075736573204c5a4d 5320636f6d7072657373696f6e20666f 72206d6178696d756d20726174696f2e` |
| `expected` | `50000000546869732057494d20285769 6e646f777320496d6167696e6720466f 726d617429206903e2ca40eae6cae640 98b49aa640c6dedae0e4cae6e6d2dedc 40ccdee440dac2f0d2daeada40e4c2e8 d2de5c00004f12572e0000` |

---

[← All algorithms](../README.md)
