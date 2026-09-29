# Hamming Code

> Parametrized Hamming error correction codes supporting standard (7,4), (15,11), (31,26) variants, extended SECDED variants with overall parity, and shortened versions. Single-bit error correction using parity bits at power-of-2 positions.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Linear Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Richard Hamming |
| Year | 1950 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/hamming.js`](../../../algorithms/ecc/hamming.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Single Error Correction Only | Standard Hamming codes can only correct single-bit errors. Extended versions (SECDED) can detect double errors. | — |
| Limited Error Detection | Cannot reliably detect burst errors or certain patterns of multiple errors. | — |

## Documentation

- [Wikipedia - Hamming Code](https://en.wikipedia.org/wiki/Hamming_code)
- [Hamming Code Tutorial](https://www.tutorialspoint.com/hamming-code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/hamming)

## References

- [Hamming's Original Paper](https://ieeexplore.ieee.org/document/6772729)
- [Bell Labs Technical Journal](https://archive.org/details/bstj29-2-147)
- [Shortened Hamming Optimization](https://www.researchgate.net/publication/262562757_Optimization_of_shortened_Hamming_codes)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Hamming (7,4) all zeros](https://en.wikipedia.org/wiki/Hamming_code)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `00000000000000` |

**Vector 2** — [Hamming (7,4) all ones](https://en.wikipedia.org/wiki/Hamming_code)

| Field | Value |
| --- | --- |
| `input` | `01010101` |
| `expected` | `01010101010101` |

**Vector 3** — [Hamming (7,4) pattern](https://en.wikipedia.org/wiki/Hamming_code)

| Field | Value |
| --- | --- |
| `input` | `01000100` |
| `expected` | `01000101000100` |

**Vector 4** — [Extended Hamming (8,4) SECDED zeros](https://en.wikipedia.org/wiki/Hamming_code)

| Field | Value |
| --- | --- |
| `parityBits` | `3` |
| `extended` | Yes |
| `input` | `00000000` |
| `expected` | `0000000000000000` |

**Vector 5** — [Extended Hamming (8,4) SECDED ones](https://en.wikipedia.org/wiki/Hamming_code)

| Field | Value |
| --- | --- |
| `parityBits` | `3` |
| `extended` | Yes |
| `input` | `01010101` |
| `expected` | `0101010101010101` |

**Vector 6** — [Shortened Hamming (6,3) zeros](https://www.researchgate.net/publication/262562757_Optimization_of_shortened_Hamming_codes)

| Field | Value |
| --- | --- |
| `parityBits` | `3` |
| `shortened` | `1` |
| `input` | `000000` |
| `expected` | `000000000000` |

**Vector 7** — [Shortened Hamming (6,3) pattern](https://www.researchgate.net/publication/262562757_Optimization_of_shortened_Hamming_codes)

| Field | Value |
| --- | --- |
| `parityBits` | `3` |
| `shortened` | `1` |
| `input` | `010001` |
| `expected` | `010001010001` |

---

[← All algorithms](../README.md)
