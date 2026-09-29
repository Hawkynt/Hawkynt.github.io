# Algebraic Geometry Code

> Evaluation AG codes constructed from algebraic curves over finite fields via the Goppa construction. First codes to exceed the Gilbert-Varshamov bound asymptotically. Generalize Reed-Solomon codes by using function fields and the Riemann-Roch theorem. This implementation demonstrates evaluation construction over GF(4) using a genus-1 elliptic curve.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Algebraic Geometry Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | V. D. Goppa, Tsfasman-Vladut-Zink |
| Year | 1981 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/ecc/algebraic-geometry-code.js`](../../../algorithms/ecc/algebraic-geometry-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Decoding Complexity | AG code decoding requires sophisticated algebraic geometry algorithms (e.g., Guruswami-Sudan list decoding) with higher computational cost than Reed-Solomon. | — |
| Construction Complexity | Requires advanced knowledge of algebraic curves, divisors, and Riemann-Roch theorem to design codes with specific parameters. | — |
| Field Size Requirements | Achieving asymptotic advantages requires working over larger finite fields where curve constructions become more complex. | — |

## Documentation

- [Error Correction Zoo - AG Codes](https://errorcorrectionzoo.org/c/ag)
- [Evaluation AG Code](https://errorcorrectionzoo.org/c/evaluation)
- [Wikipedia - Algebraic Geometry Codes](https://en.wikipedia.org/wiki/Algebraic_geometry_code)

## References

- [Goppa Original Paper (1981)](https://www.mathnet.ru/eng/dan44594)
- [TVZ Bound-Breaking Result](https://link.springer.com/article/10.1007/BF01418215)
- [AG Codes Tutorial (Høholdt et al.)](https://www.cs.utexas.edu/~danama/courses/codes/lec7-AG-codes.pdf)
- [Cambridge Survey on AG Codes](https://www.cambridge.org/core/books/abs/surveys-in-combinatorics-2015/constructions-of-block-codes-from-algebraic-curves-over-finite-fields/95A4AE500A6DC75AECF9B6619908B0E5)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [AG [8,4] all-zeros codeword](https://errorcorrectionzoo.org/c/evaluation)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `0000000000000000` |

**Vector 2** — [AG [8,4] constant function f=1](https://www.cs.utexas.edu/~danama/courses/codes/lec7-AG-codes.pdf)

| Field | Value |
| --- | --- |
| `input` | `01000000` |
| `expected` | `0101010101010101` |

**Vector 3** — [AG [8,4] coordinate function f=x](https://www.cs.utexas.edu/~danama/courses/codes/lec7-AG-codes.pdf)

| Field | Value |
| --- | --- |
| `input` | `00010000` |
| `expected` | `0000010102020303` |

**Vector 4** — [AG [8,4] coordinate function f=y](https://www.cs.utexas.edu/~danama/courses/codes/lec7-AG-codes.pdf)

| Field | Value |
| --- | --- |
| `input` | `00000100` |
| `expected` | `0001000102030203` |

**Vector 5** — [AG [8,4] polynomial function f=x^2](https://errorcorrectionzoo.org/c/evaluation)

| Field | Value |
| --- | --- |
| `input` | `00000001` |
| `expected` | `0000010103030202` |

**Vector 6** — [AG [8,4] linear combination f=1+x](https://www.cs.utexas.edu/~danama/courses/codes/lec7-AG-codes.pdf)

| Field | Value |
| --- | --- |
| `input` | `01010000` |
| `expected` | `0101000003030202` |

**Vector 7** — [AG [8,4] linear combination f=x+y](https://www.cs.utexas.edu/~danama/courses/codes/lec7-AG-codes.pdf)

| Field | Value |
| --- | --- |
| `input` | `00010100` |
| `expected` | `0001010000010100` |

**Vector 8** — [AG [8,4] full combination f=1+x+y+x^2](https://errorcorrectionzoo.org/c/ag)

| Field | Value |
| --- | --- |
| `input` | `01010101` |
| `expected` | `0100010002030203` |

---

[← All algorithms](../README.md)
