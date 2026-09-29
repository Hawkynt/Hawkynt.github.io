# Twos-Complement-8

> 8-bit two's complement checksum. Sums all bytes modulo 256, then returns two's complement (negate). Verification: sum of all data bytes plus checksum equals zero (mod 256).

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Twos Complement |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (fundamental technique) |
| Year | 1960 |
| Origin | Not specified |
| Source | [`algorithms/checksum/complement.js`](../../../algorithms/checksum/complement.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Algorithm: sum all bytes, then negate (two's complement)
- Two's complement: (~sum + 1) AND 0xFF
- Verification: (sum of all bytes + checksum) AND 0xFF == 0
- Used in: Serial protocols, embedded systems
- Better than simple sum for zero-sum validation
- Similar to LRC but uses summation instead of XOR

## Documentation

- [Two's Complement on Wikipedia](https://en.wikipedia.org/wiki/Two%27s_complement)
- [Checksum Algorithms](https://en.wikipedia.org/wiki/Checksum)
- [Serial Protocol Checksums](https://www.lammertbies.nl/comm/info/serial-checksum)

## References

- [IntelHex library record checksum implementation](https://github.com/python-intelhex/intelhex/blob/master/intelhex/__init__.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Byte sum 0x06, 8-bit complement 0xFA](https://www.lammertbies.nl/comm/info/serial-checksum)

| Field | Value |
| --- | --- |
| `input` | `010203` |
| `expected` | `fa` |

**Vector 2** — [Serial protocol example](https://www.lammertbies.nl/comm/info/serial-checksum)

| Field | Value |
| --- | --- |
| `input` | `25623f52` |
| `expected` | `e8` |

**Vector 3** — [Byte sum 0xFF, 8-bit complement 0x01](https://www.lammertbies.nl/comm/info/serial-checksum)

| Field | Value |
| --- | --- |
| `input` | `ff` |
| `expected` | `01` |

---

[← All algorithms](../README.md)
