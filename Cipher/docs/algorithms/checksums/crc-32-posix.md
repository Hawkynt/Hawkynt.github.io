# CRC-32-POSIX

> CRC-32/POSIX (also known as CKSUM) - base algorithm without length appending Uses 32-bit polynomial with normal input processing.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Cyclic Redundancy Check |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | W. Wesley Peterson |
| Year | 1961 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/crc.js`](../../../algorithms/checksum/crc.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| CRC is designed for error detection, not security. It can be easily manipulated by attackers who know the algorithm. | — | Use cryptographic hash functions (SHA-256, SHA-3) for security purposes. Use CRC only for error detection. |
| CRC-32 has limited output space, making collisions relatively easy to find intentionally. | — | For security applications, use cryptographic hash functions with larger output sizes. |

## Documentation

- [CRC Theory](https://en.wikipedia.org/wiki/Cyclic_redundancy_check)
- [CRC Catalogue](https://reveng.sourceforge.io/crc-catalogue/)
- [CRC Applications](https://users.ece.cmu.edu/~koopman/crc/)

## References

- [Peterson and Brown Paper](https://dl.acm.org/doi/10.1145/321075.321076)
- [CRC Parameter Database](https://reveng.sourceforge.io/crc-catalogue/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string](https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-cksum)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `ffffffff` |

**Vector 2** — [Check value '123456789'](https://reveng.sourceforge.io/crc-catalogue/17plus.htm#crc.cat.crc-32-cksum)

| Field | Value |
| --- | --- |
| `input` | `313233343536373839` |
| `expected` | `765e7680` |

---

[← All algorithms](../README.md)
