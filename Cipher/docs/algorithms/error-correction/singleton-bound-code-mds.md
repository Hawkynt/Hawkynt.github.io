# Singleton Bound Code (MDS)

> Maximum Distance Separable code achieving Singleton bound d=n-k+1 using Cauchy matrix construction. Provides optimal erasure correction with any k symbols sufficient to reconstruct message. Used in RAID-6, distributed storage, and network coding. Educational implementation demonstrating MDS property beyond Reed-Solomon.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Maximum Distance Separable Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Richard Singleton |
| Year | 1964 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/singleton-bound-code.js`](../../../algorithms/ecc/singleton-bound-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Erasure-Only Correction | This implementation focuses on erasure correction (known error locations). Error correction requires syndrome decoding. | — |
| Galois Field Arithmetic Complexity | GF(256) operations require careful implementation. Performance depends on log/antilog table efficiency. | — |
| Matrix Inversion Numerical Stability | Cauchy matrix inversion over finite fields requires exact arithmetic to avoid reconstruction failures. | — |

## Documentation

- [Singleton Bound - Wikipedia](https://en.wikipedia.org/wiki/Singleton_bound)
- [MDS Codes - Error Correction Zoo](https://errorcorrectionzoo.org/c/mds)
- [Cauchy Matrix MDS Construction](https://en.wikipedia.org/wiki/Cauchy_matrix)

## References

- [Singleton (1964) - Maximum distance q-nary codes](https://ieeexplore.ieee.org/document/1053689)
- [Blahut (2003) - Algebraic Codes for Data Transmission](https://doi.org/10.1017/CBO9780511800467)
- [Roth (2006) - Introduction to Coding Theory](https://www.cambridge.org/core/books/introduction-to-coding-theory/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [MDS (6,4) encoding - systematic form with Cauchy parity](https://en.wikipedia.org/wiki/MDS_code)

| Field | Value |
| --- | --- |
| `input` | `01020304` |
| `expected` | `010203041400` |

**Vector 2** — [MDS zero codeword test - demonstrates linearity](https://en.wikipedia.org/wiki/MDS_code)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `000000000000` |

**Vector 3** — [MDS maximum value test in GF(256)](https://en.wikipedia.org/wiki/MDS_code)

| Field | Value |
| --- | --- |
| `input` | `ffffffff` |
| `expected` | `ffffffff6161` |

**Vector 4** — [MDS basis vector e_1 - first column of generator](https://en.wikipedia.org/wiki/MDS_code)

| Field | Value |
| --- | --- |
| `input` | `01000000` |
| `expected` | `010000008ef4` |

**Vector 5** — [MDS random message - demonstrates general encoding](https://en.wikipedia.org/wiki/MDS_code)

| Field | Value |
| --- | --- |
| `input` | `64c83296` |
| `expected` | `64c832962db0` |

---

[← All algorithms](../README.md)
