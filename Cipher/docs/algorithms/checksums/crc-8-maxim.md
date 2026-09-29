# CRC-8-MAXIM

> 8-bit CRC used in Maxim/Dallas 1-Wire device registration numbers Uses 8-bit polynomial with reflected input processing.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Cyclic Redundancy Check |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | W. Wesley Peterson |
| Year | 1961 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/crc.js`](../../../algorithms/checksum/crc.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [CRC Theory](https://en.wikipedia.org/wiki/Cyclic_redundancy_check)
- [CRC Catalogue](https://reveng.sourceforge.io/crc-catalogue/)
- [CRC Applications](https://users.ece.cmu.edu/~koopman/crc/)

## References

- [Peterson and Brown Paper](https://dl.acm.org/doi/10.1145/321075.321076)
- [CRC Parameter Database](https://reveng.sourceforge.io/crc-catalogue/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string](https://reveng.sourceforge.io/crc-catalogue/all.htm#crc.cat.crc-8-maxim-dow)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00` |

**Vector 2** — [Single byte 'a'](https://reveng.sourceforge.io/crc-catalogue/all.htm#crc.cat.crc-8-maxim-dow)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `3b` |

**Vector 3** — [Catalogue check value for CRC-8/MAXIM-DOW](https://reveng.sourceforge.io/crc-catalogue/all.htm#crc.cat.crc-8-maxim-dow)

| Field | Value |
| --- | --- |
| `input` | `313233343536373839` |
| `expected` | `a1` |

---

[← All algorithms](../README.md)
