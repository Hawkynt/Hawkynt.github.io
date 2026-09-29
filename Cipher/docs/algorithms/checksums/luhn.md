# Luhn

> Luhn algorithm (mod 10 algorithm) for validating identification numbers. Invented by Hans Peter Luhn at IBM in 1954. Used in credit cards, IMEI, Canadian SIN. Detects all single-digit errors and most adjacent transpositions.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Check Digit |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Hans Peter Luhn (IBM) |
| Year | 1954 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/luhn.js`](../../../algorithms/checksum/luhn.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Algorithm: From right to left, double every second digit
- If doubled digit > 9, subtract 9 (equivalent to adding digits: 16→1+6=7)
- Sum all digits, check digit = (10 - sum % 10) % 10
- Validation: sum of all digits including check digit ≡ 0 (mod 10)
- Detects: All single-digit errors
- Detects: Most (but not all) adjacent transpositions
- Used in: Visa, MasterCard, American Express, IMEI numbers
- Not cryptographically secure - only for error detection

## Documentation

- [Luhn Algorithm on Wikipedia](https://en.wikipedia.org/wiki/Luhn_algorithm)
- [US Patent 2,950,048](https://patents.google.com/patent/US2950048A/en)
- [Credit Card Validation](https://www.creditcardvalidator.org/articles/luhn-algorithm)

## References

- [python-stdnum Luhn implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/luhn.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Rosetta Code test vector 49927398716](https://rosettacode.org/wiki/Luhn_test_of_credit_card_numbers)

| Field | Value |
| --- | --- |
| `input` | `34393932373339383731` |
| `expected` | `06` |

**Vector 2** — [Rosetta Code test vector 1234567812345670](https://rosettacode.org/wiki/Luhn_test_of_credit_card_numbers)

| Field | Value |
| --- | --- |
| `input` | `313233343536373831323334353637` |
| `expected` | `00` |

**Vector 3** — [Simple Luhn test 12345674](https://rosettacode.org/wiki/Luhn_test_of_credit_card_numbers)

| Field | Value |
| --- | --- |
| `input` | `31323334353637` |
| `expected` | `04` |

---

[← All algorithms](../README.md)
