# Twos-Complement-16

> 16-bit two's complement checksum. Sums all bytes modulo 65536, then returns two's complement. Better error detection than 8-bit version for larger data blocks.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Twos Complement |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown |
| Year | 1970 |
| Origin | Not specified |
| Source | [`algorithms/checksum/complement.js`](../../../algorithms/checksum/complement.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Algorithm: sum all bytes (16-bit), then negate
- Verification: (sum + checksum) AND 0xFFFF == 0
- Better collision resistance than 8-bit
- Used in network protocols and data integrity

## Documentation

- [Two's Complement on Wikipedia](https://en.wikipedia.org/wiki/Two%27s_complement)
- [Checksum Algorithms](https://en.wikipedia.org/wiki/Checksum)

## References

- [IntelHex library record checksum implementation](https://github.com/python-intelhex/intelhex/blob/master/intelhex/__init__.py)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Byte sum 0x000A, 16-bit complement 0xFFF6](https://en.wikipedia.org/wiki/Two%27s_complement)

| Field | Value |
| --- | --- |
| `input` | `01020304` |
| `expected` | `fff6` |

**Vector 2** — [Byte sum 0x01FE, 16-bit complement 0xFE02](https://en.wikipedia.org/wiki/Two%27s_complement)

| Field | Value |
| --- | --- |
| `input` | `ffff` |
| `expected` | `fe02` |

---

[← All algorithms](../README.md)
