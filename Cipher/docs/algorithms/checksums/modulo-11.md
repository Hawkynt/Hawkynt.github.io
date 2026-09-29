# Modulo-11

> Modulo-11 weighted checksum used in ISBN-10, ISSN, and various identification systems. Uses position-based weights to detect single-digit errors and most transposition errors. Check digit can be 0-9 or X (representing 10).

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Modular Arithmetic |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | ISBN/ISSN standard |
| Year | 1970 |
| Origin | Not specified |
| Source | [`algorithms/checksum/modulo.js`](../../../algorithms/checksum/modulo.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Algorithm: weighted sum with position-based weights
- Standard weights: (n+1), n, (n-1), ..., 2 from LEFT to RIGHT
- For ISBN-10 (9 digits): weights are 10, 9, 8, 7, 6, 5, 4, 3, 2
- Check digit: (11 - sum mod 11) mod 11
- Result 10 represented as 'X' in ISBN
- Used in: ISBN-10, ISSN, bank routing numbers
- Detects: All single-digit errors
- Detects: Most adjacent transposition errors
- Output: 0-9 or 10 (for 'X')

## Documentation

- [ISBN Check Digit](https://en.wikipedia.org/wiki/International_Standard_Book_Number)
- [Modulo 11 Algorithm](https://www.geeksforgeeks.org/program-check-isbn/)
- [Check Digit Systems](https://en.wikipedia.org/wiki/Check_digit)

## References

- [python-stdnum ISBN-10 modulo-11 check digit implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/isbn.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ISBN-10 format](https://en.wikipedia.org/wiki/International_Standard_Book_Number)

| Field | Value |
| --- | --- |
| `input` | `303132303030303038` |
| `expected` | `03` |

**Vector 2** — Simple digit sequence

Source: Modulo-11 weighted checksum

| Field | Value |
| --- | --- |
| `input` | `313233343536373839` |
| `expected` | `0a` |

**Vector 3** — Zero digits

Source: Modulo-11 edge case

| Field | Value |
| --- | --- |
| `input` | `3030` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
