# OneAndZeros

> One and Zeros padding scheme appends a single '1' bit (0x80 byte) followed by zero bits (0x00 bytes) to fill the block. Provides unambiguous padding removal. Also known as ISO/IEC 9797-1 Padding Method 2.

## Properties

| Property | Value |
| --- | --- |
| Category | Padding Schemes |
| Sub-category | Bit Padding |
| Security status | 🛡️ Secure |
| Complexity | Beginner |
| Inventor | ISO/IEC |
| Year | 1999 |
| Origin | Not specified |
| Source | [`algorithms/padding/oneandzeros.js`](../../../algorithms/padding/oneandzeros.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsLengthIncluded` | No |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [ISO/IEC 9797-1:2011 - Padding Method 2](https://www.iso.org/standard/50375.html)
- [Botan OneAndZeros Padding](https://github.com/randombit/botan/blob/master/src/lib/modes/mode_pad/mode_pad.cpp)

## References

- [Botan Padding Test Vectors](https://github.com/randombit/botan/blob/master/src/tests/data/pad.vec)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [OneAndZeros Padding - 3 bytes to 16 bytes](https://github.com/randombit/botan/blob/master/src/tests/data/pad.vec)

| Field | Value |
| --- | --- |
| `blockSize` | `16` |
| `input` | `ffffff` |
| `expected` | `ffffff80000000000000000000000000` |

**Vector 2** — [OneAndZeros Padding - 4 bytes to 32 bytes](https://github.com/randombit/botan/blob/master/src/tests/data/pad.vec)

| Field | Value |
| --- | --- |
| `blockSize` | `32` |
| `input` | `ffffffff` |
| `expected` | `ffffffff80000000000000000000000000000000000000000000000000000000` |

**Vector 3** — [OneAndZeros Padding - 8 bytes to 16 bytes (full block)](https://github.com/randombit/botan/blob/master/src/tests/data/pad.vec)

| Field | Value |
| --- | --- |
| `blockSize` | `8` |
| `input` | `ffffffffffffffff` |
| `expected` | `ffffffffffffffff8000000000000000` |

---

[← All algorithms](../README.md)
