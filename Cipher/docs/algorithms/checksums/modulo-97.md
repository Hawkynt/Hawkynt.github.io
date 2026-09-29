# Modulo-97

> Modulo-97 checksum algorithm used in IBAN (International Bank Account Number) validation per ISO 7064. Detects up to 99% of single-digit errors and all transposition errors. Uses mod-97-10 check digit calculation.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Modular Arithmetic |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | ISO 7064 standard |
| Year | 1983 |
| Origin | Not specified |
| Source | [`algorithms/checksum/modulo.js`](../../../algorithms/checksum/modulo.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Algorithm: Convert digits to number, compute mod 97
- Used in: IBAN validation (mod-97-10)
- Check digit calculation: 98 - (number mod 97)
- Validation: (number with check digits) mod 97 == 1
- Detects: ~99% single-digit errors
- Detects: All adjacent transposition errors
- For IBAN: letters converted A=10, B=11, ..., Z=35
- Output: remainder (0-96), or check digits (02-98)

## Documentation

- [ISO 7064:1983 Standard](https://en.wikipedia.org/wiki/ISO_7064)
- [IBAN Validation](https://en.wikipedia.org/wiki/International_Bank_Account_Number)
- [Modulo 97 Algorithm](https://www.geeksforgeeks.org/iban-validator/)

## References

- [python-stdnum ISO 7064 mod 97-10 implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/iso7064/mod_97_10.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Simple digit sequence

Source: Modulo-97 calculation

| Field | Value |
| --- | --- |
| `input` | `313233343536` |
| `expected` | `48` |

**Vector 2** — IBAN check digit validation

Source: Valid IBAN check digit

| Field | Value |
| --- | --- |
| `input` | `3938` |
| `expected` | `01` |

**Vector 3** — Large digit sequence

Source: Modulo-97 overflow handling

| Field | Value |
| --- | --- |
| `input` | `393939393939` |
| `expected` | `1a` |

---

[← All algorithms](../README.md)
