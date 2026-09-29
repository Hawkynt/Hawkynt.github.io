# CRC-16-CCITT

> 16-bit CRC used in CCITT/ITU-T standards, telecommunications, and X.25 protocol Uses 16-bit polynomial with normal input processing.

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

**Vector 1** — [Empty string](https://reveng.sourceforge.io/crc-catalogue/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0000` |

**Vector 2** — [Single byte A](https://reveng.sourceforge.io/crc-catalogue/)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `58e5` |

**Vector 3** — [String 123456789](https://reveng.sourceforge.io/crc-catalogue/)

| Field | Value |
| --- | --- |
| `input` | `313233343536373839` |
| `expected` | `31c3` |

---

[← All algorithms](../README.md)
