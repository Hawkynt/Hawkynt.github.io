# VIN

> VIN (Vehicle Identification Number) check digit calculation per ISO 3779 and SAE J853. 17-character alphanumeric code using weighted sum modulo 11. Position 9 is check digit (0-9 or X). Used for automotive vehicle identification worldwide.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Vehicle Identification |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | National Highway Traffic Safety Administration (NHTSA) |
| Year | 1981 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/vin-checksum.js`](../../../algorithms/checksum/vin-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: 17 alphanumeric characters (excludes I, O, Q to avoid confusion with 1, 0)
- Position 9: Check digit (0-9 or X for 10)
- Weights: 8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2 (position 1-17)
- Letter values: A=1, B=2, C=3, D=4, E=5, F=6, G=7, H=8, J=1, K=2, L=3, M=4, N=5, P=7, R=9, S=2, T=3, U=4, V=5, W=6, X=7, Y=8, Z=9
- Algorithm: Σ(character_value × weight) mod 11
- Check digit: result of mod 11 (10 represented as 'X')
- Used in: North America (mandatory), many other countries
- Detects: Most transcription errors

## Documentation

- [VIN on Wikipedia](https://en.wikipedia.org/wiki/Vehicle_identification_number)
- [ISO 3779 Standard](https://www.iso.org/standard/52200.html)
- [NHTSA VIN Decoder](https://www.nhtsa.gov/vin-decoder)

## References

- [vininfo - VIN parsing and checksum verification library](https://github.com/idlesign/vininfo)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [VIN with check digit X (1M8GDM9AXKP042788)](https://en.wikibooks.org/wiki/Vehicle_Identification_Numbers_(VIN_codes)/Check_digit)

| Field | Value |
| --- | --- |
| `input` | `314d3847444d3941584b50303432373838` |
| `expected` | `0a` |

**Vector 2** — [VIN all ones (11111111111111111)](https://scientificgems.wordpress.com/2018/04/27/mathematics-in-action-vehicle-identifications-numbers/)

| Field | Value |
| --- | --- |
| `input` | `3131313131313131313131313131313131` |
| `expected` | `01` |

**Vector 3** — [VIN example (5YJ3E1EAXHF000316)](https://vpic.nhtsa.dot.gov/decoder/CheckDigit/Index/5yj3e1eaxhf000316)

| Field | Value |
| --- | --- |
| `input` | `35594a3345314541584846303030333136` |
| `expected` | `0a` |

---

[← All algorithms](../README.md)
