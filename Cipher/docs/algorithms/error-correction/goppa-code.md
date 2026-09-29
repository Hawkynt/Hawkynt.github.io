# Goppa Code

> Binary Goppa codes defined by polynomials over finite fields. Capable of correcting t errors with redundancy 2t*m bits. Used in McEliece post-quantum cryptosystem. Generalization of BCH codes. Primitive narrow-sense BCH codes are Goppa codes. Duals are geometric RS codes.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Algebraic Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | V. D. Goppa |
| Year | 1970 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/ecc/goppa-code.js`](../../../algorithms/ecc/goppa-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Polynomial Selection | Security depends on choosing irreducible Goppa polynomial - improper selection weakens code. | — |
| Decoding Complexity | Efficient decoding requires Patterson algorithm or other algebraic methods. | — |

## Documentation

- [Error Correction Zoo](https://errorcorrectionzoo.org/c/goppa)
- [Wikipedia - Goppa Code](https://en.wikipedia.org/wiki/Goppa_code)
- [McEliece Cryptosystem](https://en.wikipedia.org/wiki/McEliece_cryptosystem)

## References

- [Original Goppa Paper](https://ieeexplore.ieee.org/document/1054973)
- [BCH/Goppa Connection](https://link.springer.com/chapter/10.1007/978-3-540-37621-7_17)
- [Post-Quantum Crypto](https://classic.mceliece.org/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Goppa [7,3] all zeros](https://errorcorrectionzoo.org/c/goppa)

| Field | Value |
| --- | --- |
| `input` | `00000000000000` |
| `expected` | `00000000000000` |

**Vector 2** — [Goppa [7,3] codeword 1001011](https://errorcorrectionzoo.org/c/goppa)

| Field | Value |
| --- | --- |
| `input` | `01000001000101` |
| `expected` | `01000001000101` |

**Vector 3** — [Goppa [7,3] codeword 0101110](https://errorcorrectionzoo.org/c/goppa)

| Field | Value |
| --- | --- |
| `input` | `00010001010100` |
| `expected` | `00010001010100` |

**Vector 4** — [Goppa [7,3] codeword 1100101](https://errorcorrectionzoo.org/c/goppa)

| Field | Value |
| --- | --- |
| `input` | `01010000010001` |
| `expected` | `01010000010001` |

---

[← All algorithms](../README.md)
