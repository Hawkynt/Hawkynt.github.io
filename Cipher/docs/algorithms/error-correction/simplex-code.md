# Simplex Code

> Dual of Hamming code with parameters [2^m-1, m, 2^(m-1)]. All non-zero codewords have constant Hamming weight 2^(m-1). Maximal-length linear codes with excellent error correction properties. Used in communication systems requiring equidistant codewords.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Linear Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | David E. Muller (dual concept) |
| Year | 1954 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/simplex-code.js`](../../../algorithms/ecc/simplex-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Very Low Code Rate | Code rate m/(2^m-1) decreases exponentially with m. Example: m=4 gives rate 4/15 = 26.7%. | — |
| Fixed Parameters | Block length must be 2^m-1, limiting flexibility in practical applications. | — |

## Documentation

- [Wikipedia - Simplex Code](https://en.wikipedia.org/wiki/Simplex_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/simplex)
- [Dual Codes Tutorial](http://www.inference.org.uk/mackay/codes/dual.html)

## References

- [Linear Codes Theory](https://web.stanford.edu/class/ee387/handouts/notes7.pdf)
- [Simplex Code Properties](https://www.researchgate.net/publication/220576843_On_the_Simplex_Code)
- [MacWilliams Identity](https://en.wikipedia.org/wiki/MacWilliams_identity)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Simplex (7,3) all zeros](https://en.wikipedia.org/wiki/Simplex_code)

| Field | Value |
| --- | --- |
| `input` | `000000` |
| `expected` | `00000000000000` |

**Vector 2** — [Simplex (7,3) pattern 001](https://en.wikipedia.org/wiki/Simplex_code)

| Field | Value |
| --- | --- |
| `input` | `000001` |
| `expected` | `00000001010101` |

**Vector 3** — [Simplex (7,3) pattern 010](https://en.wikipedia.org/wiki/Simplex_code)

| Field | Value |
| --- | --- |
| `input` | `000100` |
| `expected` | `00010100000101` |

**Vector 4** — [Simplex (7,3) pattern 100](https://en.wikipedia.org/wiki/Simplex_code)

| Field | Value |
| --- | --- |
| `input` | `010000` |
| `expected` | `01000100010001` |

---

[← All algorithms](../README.md)
