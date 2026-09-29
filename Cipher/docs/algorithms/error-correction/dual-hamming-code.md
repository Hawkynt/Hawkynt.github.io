# Dual Hamming Code

> Dual code of Hamming (7,4) yielding Simplex (7,3) code. Generator matrix of dual is parity-check matrix of original. All non-zero codewords have constant Hamming weight 4. Demonstrates duality principle: dual of [n,k,d] code is [n,n-k,d_perp]. Educational example of code duality.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Dual Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Richard Hamming (original), Dual concept classical |
| Year | 1950 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/dual-hamming.js`](../../../algorithms/ecc/dual-hamming.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Lower Rate | Dual code has rate k/n where original has (n-k)/n. Hamming (7,4) rate 4/7 → Dual rate 3/7. | — |
| Different Properties | Dual may have different error correction capabilities than original code. | — |

## Documentation

- [Wikipedia - Dual Code](https://en.wikipedia.org/wiki/Dual_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/dual)
- [Linear Code Duality](https://users.physics.ox.ac.uk/~Steane/qec/qec_ams_6.html)

## References

- [Self-Dual Codes](https://errorcorrectionzoo.org/c/self_dual)
- [Hamming Code](https://en.wikipedia.org/wiki/Hamming_code)
- [Code Theory Basics](https://cs-people.bu.edu/mbun/courses/599_S22/notes/lec19.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Dual Hamming (7,3) all zeros](https://en.wikipedia.org/wiki/Dual_code)

| Field | Value |
| --- | --- |
| `input` | `000000` |
| `expected` | `00000000000000` |

**Vector 2** — [Dual Hamming (7,3) pattern 001](https://en.wikipedia.org/wiki/Dual_code)

| Field | Value |
| --- | --- |
| `input` | `000001` |
| `expected` | `00000001010101` |

**Vector 3** — [Dual Hamming (7,3) pattern 010](https://en.wikipedia.org/wiki/Dual_code)

| Field | Value |
| --- | --- |
| `input` | `000100` |
| `expected` | `00010100000101` |

**Vector 4** — [Dual Hamming (7,3) pattern 100](https://en.wikipedia.org/wiki/Dual_code)

| Field | Value |
| --- | --- |
| `input` | `010000` |
| `expected` | `01000100010001` |

---

[← All algorithms](../README.md)
