# Hermitian Code

> Algebraic geometry codes from Hermitian curves over finite fields. Exceed Gilbert-Varshamov bound. Defined over x^q + y^q + 1 = 0 in GF(q²). Parameters [n=q³, k, d] where n = q³ is the number of rational points. Used in deep space communications and coding theory research. Achieve better rates than Reed-Solomon codes.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Algebraic Geometry Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | V. D. Goppa, Garcia-Stichtenoth |
| Year | 1981 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/ecc/hermitian-code.js`](../../../algorithms/ecc/hermitian-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Decoding Complexity | Algebraic geometry decoding algorithms are computationally intensive compared to Reed-Solomon. | — |
| Field Size Requirements | Requires large finite fields for practical parameters - field size must be square for Hermitian curve. | — |
| Construction Complexity | Curve theory and rational points computation requires advanced algebraic geometry knowledge. | — |

## Documentation

- [Error Correction Zoo - AG Codes](https://errorcorrectionzoo.org/c/ag)
- [Wikipedia - Algebraic Geometry Codes](https://en.wikipedia.org/wiki/Algebraic_geometry_code)
- [Hermitian Curves in Coding Theory](https://www.win.tue.nl/~ruudp/paper/46.pdf)

## References

- [Garcia-Stichtenoth Construction](https://ieeexplore.ieee.org/document/259647)
- [Algebraic Geometry Codes Survey](https://arxiv.org/abs/0811.2346)
- [Hermitian Codes Performance](https://link.springer.com/article/10.1007/s10623-006-9000-x)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Hermitian [8,3] all zeros codeword](https://errorcorrectionzoo.org/c/ag)

| Field | Value |
| --- | --- |
| `input` | `000000` |
| `expected` | `0000000000000000` |

**Vector 2** — [Hermitian [8,3] basis function f=1 (constant)](https://arxiv.org/abs/0811.2346)

| Field | Value |
| --- | --- |
| `input` | `010000` |
| `expected` | `0101010101010101` |

**Vector 3** — [Hermitian [8,3] basis function f=x](https://arxiv.org/abs/0811.2346)

| Field | Value |
| --- | --- |
| `input` | `000100` |
| `expected` | `0001020302030001` |

**Vector 4** — [Hermitian [8,3] basis function f=y](https://arxiv.org/abs/0811.2346)

| Field | Value |
| --- | --- |
| `input` | `000001` |
| `expected` | `0002010303010200` |

**Vector 5** — [Hermitian [8,3] linear combination f=1+x](https://www.win.tue.nl/~ruudp/paper/46.pdf)

| Field | Value |
| --- | --- |
| `input` | `010100` |
| `expected` | `0100030203020100` |

**Vector 6** — [Hermitian [8,3] linear combination f=x+y](https://www.win.tue.nl/~ruudp/paper/46.pdf)

| Field | Value |
| --- | --- |
| `input` | `000101` |
| `expected` | `0003030001020201` |

---

[← All algorithms](../README.md)
