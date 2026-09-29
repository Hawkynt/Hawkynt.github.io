# LRC

> Longitudinal Redundancy Check used in serial communications, as specified for Modbus ASCII. Sums all bytes modulo 256 and takes the two's complement. Verification: sum of all data bytes plus LRC equals zero (modulo 256).

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Redundancy Check |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (telecommunications standard) |
| Year | 1960 |
| Origin | Not specified |
| Source | [`algorithms/checksum/lrc.js`](../../../algorithms/checksum/lrc.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- LRC = ((sum of all bytes) XOR 0xFF) + 1 = two's complement of the 8-bit sum
- Verification: (sum of all bytes + LRC) AND 0xFF == 0
- Simple error detection for serial protocols
- Can detect single-bit errors and some multi-bit errors
- Used in ASCII-based protocols and legacy systems

## Documentation

- [Longitudinal Redundancy Check](https://en.wikipedia.org/wiki/Longitudinal_redundancy_check)
- [LRC Checksum Calculator](https://forums.ni.com/t5/Example-Code/Checksum-generator-XOR-8-bit-8-bit-sum-LRC-8-bit-16-bit-sum/ta-p/4116999)

## References

- [minimalmodbus Modbus ASCII LRC implementation](https://github.com/pyhys/minimalmodbus/blob/master/minimalmodbus.py)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Wikipedia LRC worked example - STX 0 0 1 # ETX](https://en.wikipedia.org/wiki/Longitudinal_redundancy_check)

| Field | Value |
| --- | --- |
| `input` | `023030312303` |
| `expected` | `47` |

**Vector 2** — [minimalmodbus known value - 'ABCDE'](https://github.com/pyhys/minimalmodbus/blob/master/tests/test_minimalmodbus.py)

| Field | Value |
| --- | --- |
| `input` | `4142434445` |
| `expected` | `b1` |

---

[← All algorithms](../README.md)
