# NPI

> NPI (National Provider Identifier) check digit for US healthcare providers using Luhn algorithm. 10-digit unique identifier required by HIPAA for physicians, pharmacies, hospitals in electronic healthcare transactions. Administered by CMS (Centers for Medicare and Medicaid Services).

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Healthcare Identifier |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | US Department of Health and Human Services |
| Year | 2007 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/npi-checksum.js`](../../../algorithms/checksum/npi-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: 10 digits (9 data + 1 check)
- All NPIs: First digit is always '1' or '2'
- Type 1: Individual providers (1...)
- Type 2: Organizations (2...)
- Algorithm: Luhn with constant prefix '80840'
- Check digit: Luhn('80840' + 9 digits)
- Required for: Medicare, Medicaid, HIPAA transactions
- Public registry: Available online for lookups
- Example: 1234567893
- Mandatory since: May 23, 2007

## Documentation

- [NPI on Wikipedia](https://en.wikipedia.org/wiki/National_Provider_Identifier)
- [NPI Registry](https://npiregistry.cms.hhs.gov/)
- [HIPAA NPI Requirements](https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand)

## References

- [python-stdnum US NPI implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/us/npi.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Example NPI 1234567893](https://en.wikipedia.org/wiki/National_Provider_Identifier)

| Field | Value |
| --- | --- |
| `input` | `313233343536373839` |
| `expected` | `03` |

**Vector 2** — [CMS Registry NPI 1993999998](https://npiregistry.cms.hhs.gov/)

| Field | Value |
| --- | --- |
| `input` | `313939333939393939` |
| `expected` | `08` |

**Vector 3** — [Type 2 Organization NPI](https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand)

| Field | Value |
| --- | --- |
| `input` | `323334353637383930` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
