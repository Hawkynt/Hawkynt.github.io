# Verhoeff

> Verhoeff algorithm using dihedral group D5 for superior error detection. Detects ALL single-digit errors and ALL adjacent transposition errors, unlike Luhn. Invented by Dutch mathematician Jacobus Verhoeff in 1969.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Check Digit |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Jacobus Verhoeff |
| Year | 1969 |
| Origin | 🇳🇱 Netherlands |
| Source | [`algorithms/checksum/verhoeff.js`](../../../algorithms/checksum/verhoeff.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Uses three mathematical tables: multiplication, permutation, inverse
- Based on dihedral group D5 (symmetries of pentagon)
- Detects: 100% of single-digit errors
- Detects: 100% of adjacent transposition errors
- Detects: 95.3% of twin errors (e.g., 22→33)
- Detects: 94.2% of jump transpositions (e.g., abc→cba)
- Superior to Luhn but more complex
- Used in: German Betriebsnummer, SIM card serial numbers

## Documentation

- [Verhoeff Algorithm on Wikipedia](https://en.wikipedia.org/wiki/Verhoeff_algorithm)
- [Error Detecting Decimal Codes (1969)](https://pure.tue.nl/ws/files/1951436/597473.pdf)
- [Verhoeff Calculator](https://planetcalc.com/2464/)

## References

- [python-stdnum Verhoeff implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/verhoeff.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Rosetta Code test vector 236](https://rosettacode.org/wiki/Verhoeff_algorithm)

| Field | Value |
| --- | --- |
| `input` | `323336` |
| `expected` | `03` |

**Vector 2** — [Rosetta Code test vector 12345](https://rosettacode.org/wiki/Verhoeff_algorithm)

| Field | Value |
| --- | --- |
| `input` | `3132333435` |
| `expected` | `01` |

**Vector 3** — [Rosetta Code test vector 123456789012](https://rosettacode.org/wiki/Verhoeff_algorithm)

| Field | Value |
| --- | --- |
| `input` | `313233343536373839303132` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
