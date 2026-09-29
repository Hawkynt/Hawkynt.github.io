# Reed-Solomon

> Reed-Solomon error correction codes using polynomial arithmetic over Galois Fields. Can correct burst errors and multiple symbol errors. Used in CDs, DVDs, QR codes, and satellite communications. Educational implementation demonstrating algebraic coding theory.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Algebraic Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Irving S. Reed, Gustave Solomon |
| Year | 1960 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/reed-solomon.js`](../../../algorithms/ecc/reed-solomon.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Symbol Error Limitation | Can only correct up to t symbol errors where 2t+1 ≤ n-k+1. Beyond this, errors may go undetected | — |
| Implementation Complexity | Requires careful implementation of Galois Field arithmetic and polynomial operations | — |

## Documentation

- [Wikipedia - Reed-Solomon](https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction)
- [Reed-Solomon Tutorial](https://www.cs.cmu.edu/~guyb/realworld/reedsolomon/reed_solomon_codes.html)
- [Galois Field Arithmetic](https://en.wikipedia.org/wiki/Finite_field_arithmetic)

## References

- [Reed and Solomon Original Paper](https://dl.acm.org/doi/10.1145/368873.368880)
- [Practical Reed-Solomon](https://ieeexplore.ieee.org/document/1057683)
- [CD Error Correction](https://www.ecma-international.org/publications-and-standards/standards/ecma-130/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Reed-Solomon (7,3) encoding test](https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction)

| Field | Value |
| --- | --- |
| `input` | `010203` |
| `expected` | `010203ac07842f` |

**Vector 2** — [Reed-Solomon zero codeword test](https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction)

| Field | Value |
| --- | --- |
| `input` | `000000` |
| `expected` | `00000000000000` |

**Vector 3** — [Reed-Solomon max value test](https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction)

| Field | Value |
| --- | --- |
| `input` | `ff8040` |
| `expected` | `ff8040bd33e253` |

---

[← All algorithms](../README.md)
