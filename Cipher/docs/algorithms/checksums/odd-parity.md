# Odd-Parity

> Odd parity check ensuring total number of 1 bits is odd Fundamental error detection using XOR operations.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Parity Check |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Richard Hamming |
| Year | 1950 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/parity.js`](../../../algorithms/checksum/parity.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Single Error Detection Only | Can only detect odd numbers of bit errors, not even numbers | — |
| No Correction Capability | Can detect errors but cannot correct them | — |
| Weak Against Burst Errors | Poor performance against consecutive bit errors | — |

## Documentation

- [Parity Check Wikipedia](https://en.wikipedia.org/wiki/Parity_bit)
- [Error Detection Theory](https://en.wikipedia.org/wiki/Error_detection_and_correction)
- [Hamming Code](https://en.wikipedia.org/wiki/Hamming_code)

## References

- [Claude Shannon Papers](https://www.bell-labs.com/usr/dmr/www/shannondp.html)
- [Richard Hamming Biography](https://history.computer.org/pioneers/hamming.html)
- [Error Correction Codes](https://www.cambridge.org/core/books/introduction-to-coding-theory/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Empty data

Source: Odd parity of empty data is 1

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `01` |

**Vector 2** — Single byte 0xFF

Source: 8 bits set - needs odd parity bit

| Field | Value |
| --- | --- |
| `input` | `ff` |
| `expected` | `01` |

**Vector 3** — Single byte 0x0F

Source: 4 bits set - needs odd parity bit

| Field | Value |
| --- | --- |
| `input` | `0f` |
| `expected` | `01` |

**Vector 4** — Single byte 0x07

Source: 3 bits set - already odd

| Field | Value |
| --- | --- |
| `input` | `07` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
