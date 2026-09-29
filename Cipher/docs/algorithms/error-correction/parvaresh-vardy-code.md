# Parvaresh-Vardy Code

> Algebraic codes achieving list-decoding capacity with efficient algorithms. Generalization of Reed-Solomon using correlated polynomials. First codes explicitly achieving list-decoding capacity. Enabled Guruswami-Rudra folded RS construction. Used in coding theory research and theoretical CS.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Algebraic Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Farzad Parvaresh, Alexander Vardy |
| Year | 2005 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/parvaresh-vardy-code.js`](../../../algorithms/ecc/parvaresh-vardy-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| List Decoding Complexity | List decoding requires polynomial interpolation and root-finding. Computationally more expensive than unique decoding. | — |
| Field Size Requirements | Requires sufficiently large finite field to support parameters. Field size must be at least n for [n,k] code. | — |
| Correlation Construction | Security/efficiency depends on careful choice of correlated polynomial h(x). Improper correlation reduces advantages. | — |

## Documentation

- [Error Correction Zoo - Parvaresh-Vardy](https://errorcorrectionzoo.org/c/parvaresh_vardy)
- [Wikipedia - List Decoding](https://en.wikipedia.org/wiki/List_decoding)
- [List Decoding Capacity](https://arxiv.org/abs/cs/0508023)

## References

- [Parvaresh-Vardy Original Paper](https://ieeexplore.ieee.org/document/1510850)
- [Guruswami-Rudra Codes](https://arxiv.org/abs/cs/0508023)
- [Essential Coding Theory](http://www.cse.buffalo.edu/~atri/courses/coding-theory/book/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Parvaresh-Vardy [8,2] all zeros](https://errorcorrectionzoo.org/c/parvaresh_vardy)

| Field | Value |
| --- | --- |
| `input` | `0000` |
| `expected` | `00000000000000000000000000000000` |

**Vector 2** — [Parvaresh-Vardy [8,2] constant polynomial](https://errorcorrectionzoo.org/c/parvaresh_vardy)

| Field | Value |
| --- | --- |
| `input` | `0100` |
| `expected` | `01010101010101010101010101010101` |

**Vector 3** — [Parvaresh-Vardy [8,2] linear polynomial correlation](https://errorcorrectionzoo.org/c/parvaresh_vardy)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `0102030405060708010405030207060c` |

**Vector 4** — [Parvaresh-Vardy [8,2] mixed correlation](https://errorcorrectionzoo.org/c/parvaresh_vardy)

| Field | Value |
| --- | --- |
| `input` | `0101` |
| `expected` | `0003020504070609000504020306070d` |

---

[← All algorithms](../README.md)
