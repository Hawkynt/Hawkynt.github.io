# Modulo-10

> Simple modulo-10 checksum for digit sequences. Sums all digits and returns remainder when divided by 10. Basic error detection for barcodes and identification numbers.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Modular Arithmetic |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (fundamental technique) |
| Year | 1960 |
| Origin | Not specified |
| Source | [`algorithms/checksum/modulo.js`](../../../algorithms/checksum/modulo.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Algorithm: sum all digits, result mod 10
- Check digit: (10 - sum mod 10) mod 10
- Very simple, weak error detection
- Used in: Simple barcodes, basic validation
- Cannot detect digit transposition errors
- Output: single digit 0-9

## Documentation

- [Check Digit Algorithms](https://en.wikipedia.org/wiki/Check_digit)
- [Modulo Checksums](https://www.geeksforgeeks.org/check-digit/)

## References

- [python-stdnum generic checksum utilities](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/util.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Simple digit sum

Source: Modulo-10 calculation

| Field | Value |
| --- | --- |
| `input` | `313233` |
| `expected` | `06` |

**Vector 2** — Sum with overflow

Source: Modulo-10 with carry

| Field | Value |
| --- | --- |
| `input` | `393837` |
| `expected` | `04` |

**Vector 3** — Long digit sequence

Source: Modulo-10 calculation

| Field | Value |
| --- | --- |
| `input` | `31323334353637383930` |
| `expected` | `05` |

---

[← All algorithms](../README.md)
