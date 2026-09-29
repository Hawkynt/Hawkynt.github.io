# Damm

> Damm algorithm using quasigroup of order 10 for check digit calculation. Detects ALL single-digit errors and ALL adjacent transposition errors. Simpler than Verhoeff with same error detection. Invented by H. Michael Damm in 2004.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Check Digit |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | H. Michael Damm |
| Year | 2004 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/checksum/damm.js`](../../../algorithms/checksum/damm.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Uses single quasigroup operation table
- Totally anti-symmetric quasigroup of order 10
- Detects: 100% of single-digit errors
- Detects: 100% of adjacent transposition errors
- Detects: 100% of phonetic errors
- Simpler than Verhoeff (one table vs three)
- Check digit: final interim value equals 0 for valid number
- Used in: Various European identification systems

## Documentation

- [Damm Algorithm on Wikipedia](https://en.wikipedia.org/wiki/Damm_algorithm)
- [Original Paper (2004)](https://archiv.ub.uni-marburg.de/diss/z2004/0516/pdf/dhmd.pdf)
- [Check Digit Systems](https://www.nayuki.io/page/java-checksum-algorithms)

## References

- [python-stdnum Damm algorithm implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/damm.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Damm validation](https://en.wikipedia.org/wiki/Damm_algorithm)

| Field | Value |
| --- | --- |
| `input` | `353732` |
| `expected` | `04` |

**Vector 2** — Simple sequence

Source: Damm calculation

| Field | Value |
| --- | --- |
| `input` | `313233` |
| `expected` | `04` |

**Vector 3** — All zeros

Source: Edge case

| Field | Value |
| --- | --- |
| `input` | `303030` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
