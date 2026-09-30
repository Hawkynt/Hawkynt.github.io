# Bazeries Cylinder Cipher

> Mechanical transposition cipher using cylindrical device with rotating disks. Text written horizontally around cylinder then read vertically. Invented by Étienne Bazeries for French military communications in 1891.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Étienne Bazeries |
| Year | 1891 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/classical/bazeries.js`](../../../algorithms/classical/bazeries.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Frequency Analysis](https://en.wikipedia.org/wiki/Frequency_analysis) | As transposition cipher, preserves letter frequencies making frequency analysis effective | Historical significance only - not suitable for modern security applications |
| [Known Plaintext Attack](https://en.wikipedia.org/wiki/Known-plaintext_attack) | Knowledge of plaintext portion reveals transposition pattern and allows key recovery | Avoid predictable message formats and standard headers |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Bazeries_cylinder)
- [Original Work (French)](https://archive.org/details/leschiffressecr00bazegoog)
- [Crypto Museum](https://cryptomuseum.com/crypto/bazeries/)

## References

- [NSA Cryptologic Heritage](https://www.nsa.gov/about/cryptologic-heritage/)
- [DCode Implementation](https://www.dcode.fr/bazeries-cipher)
- [Historical Analysis](https://www.ciphermachinesandcryptology.com/en/bazeries.htm)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Historical Bazeries Example](https://archive.org/details/leschiffressecr00bazegoog)

| Field | Value |
| --- | --- |
| `key` | `434950484552` |
| `input` | `444546454e445448454541535457414c4c4f46544845434153544c45` |
| `expected` | `44545446534e414c4345454c45454548575454464541484c44534f41` |

**Vector 2** — [Educational Demonstration](https://cryptomuseum.com/crypto/bazeries/)

| Field | Value |
| --- | --- |
| `key` | `4b4559` |
| `input` | `48454c4c4f` |
| `expected` | `454f484c4c` |

**Vector 3** — [Matrix Transposition Test](https://www.dcode.fr/bazeries-cipher)

| Field | Value |
| --- | --- |
| `key` | `534543524554` |
| `input` | `43525950544f475241504859` |
| `expected` | `594152525448505043474f59` |

---

[← All algorithms](../README.md)
