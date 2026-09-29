# CRC-128-HPC

> High-Performance Computing variant optimized for scientific computing and parallel processing Uses 128-bit polynomial with normal input processing.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Cyclic Redundancy Check |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | W. Wesley Peterson |
| Year | 1961 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/crc.js`](../../../algorithms/checksum/crc.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Not Cryptographically Secure | CRC is designed for error detection, not security. It can be easily manipulated by attackers who know the algorithm. | Use cryptographic hash functions (SHA-256, SHA-3) for security purposes. Use CRC only for error detection. |
| Hash Collisions | CRC-128 has limited output space, making collisions relatively easy to find intentionally. | For security applications, use cryptographic hash functions with larger output sizes. |

## Documentation

- [CRC Theory](https://en.wikipedia.org/wiki/Cyclic_redundancy_check)
- [CRC Catalogue](https://reveng.sourceforge.io/crc-catalogue/)
- [CRC Applications](https://users.ece.cmu.edu/~koopman/crc/)

## References

- [Peterson and Brown Paper](https://dl.acm.org/doi/10.1145/321075.321076)
- [CRC Parameter Database](https://reveng.sourceforge.io/crc-catalogue/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Empty string

Source: HPC test vector

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000000000000000000000000000` |

**Vector 2** — Single byte 'a'

Source: HPC test vector

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `80000001b86e00006e000000000072fb` |

---

[← All algorithms](../README.md)
