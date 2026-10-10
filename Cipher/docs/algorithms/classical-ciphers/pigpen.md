# Pigpen

> Geometric substitution cipher using tic-tac-toe and X-shaped grids with dots. Also known as Freemason cipher, used by secret societies for concealing correspondence since early 18th century.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Freemasons/Rosicrucians |
| Year | 1700 |
| Origin | 🌐 International |
| Source | [`algorithms/classical/pigpen.js`](../../../algorithms/classical/pigpen.js) |

## Security

**Status:** 🎓 Educational Only

Historical educational cipher easily broken by frequency analysis. Used by secret societies for concealment rather than security against determined cryptanalysts.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Recognizable Symbols | Geometric symbols are easily recognizable as pigpen cipher once pattern is known | — |
| Frequency Analysis | Maintains letter frequency patterns making cryptanalysis straightforward | — |

## Documentation

- [Freemason History](https://freemasonry.bcy.ca/texts/pigpen.html)
- [Secret Society Cryptography](https://en.wikipedia.org/wiki/Pigpen_cipher)
- [Masonic Symbolism](https://www.masonicdictionary.com/)

## References

- [Cipher Machines Museum](https://www.cryptomuseum.com/)
- [Historical Cryptography](https://www.nsa.gov/about/cryptologic-heritage/)
- [American Cryptogram Association](https://www.cryptogram.org/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Pigpen Standard Test

Source: Historical Freemason lodge records

| Field | Value |
| --- | --- |
| `key` | `7374616e64617264` |
| `input` | `48454c4c4f` |
| `expected` | `48454c4c4f` |

**Vector 2** — Pigpen ASCII Variant

Source: ASCII compatibility test

| Field | Value |
| --- | --- |
| `key` | `6173636969` |
| `input` | `534543524554` |
| `expected` | `534543524554` |

---

[← All algorithms](../README.md)
