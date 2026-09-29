# Longitudinal-Parity

> Longitudinal parity check using XOR of all bytes for multi-byte error detection Fundamental error detection using XOR operations.

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

Source: XOR of empty data is 0

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00` |

**Vector 2** — Bytes 0xAA, 0x55

Source: XOR result is 0xFF

| Field | Value |
| --- | --- |
| `input` | `aa55` |
| `expected` | `ff` |

**Vector 3** — Bytes 0x12, 0x34, 0x56

Source: XOR result is 0x70

| Field | Value |
| --- | --- |
| `input` | `123456` |
| `expected` | `70` |

**Vector 4** — Four bytes of 0xFF

Source: Even number of identical bytes XOR to 0

| Field | Value |
| --- | --- |
| `input` | `ffffffff` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
