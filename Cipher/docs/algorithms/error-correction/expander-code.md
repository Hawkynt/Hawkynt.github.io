# Expander Code

> Linear error-correcting codes based on expander graphs with strong connectivity properties. Used in modern LDPC constructions, polar codes, and theoretical computer science. Parameters depend on graph expansion properties. Achieve capacity on erasure channels with efficient iterative decoding. Foundation for modern capacity-achieving codes.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Expander Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Michael Sipser, Daniel Spielman |
| Year | 1996 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/expander-code.js`](../../../algorithms/ecc/expander-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Graph Construction | Requires explicit expander graph construction or random sampling. Graph quality critically affects error correction performance. | — |
| Iterative Decoding | Message-passing decoding may not converge for all error patterns. Convergence depends on graph expansion properties. | — |
| Error Floor | Like LDPC codes, expander codes may have error floors at low bit error rates due to suboptimal graph structures. | — |

## Documentation

- [Wikipedia - Expander Graph](https://en.wikipedia.org/wiki/Expander_graph)
- [Error Correction Zoo - Expander Codes](https://errorcorrectionzoo.org/c/expander)
- [Expander Codes Survey](https://courses.cs.washington.edu/courses/cse533/05au/expander-codes.pdf)
- [Graph-Based Codes](https://www.cambridge.org/core/journals/combinatorics-probability-and-computing/article/expanderbased-codes/)

## References

- [Sipser-Spielman Original Paper (1996)](https://ieeexplore.ieee.org/document/514929)
- [Linear-Time Encodable Codes](https://people.csail.mit.edu/madhu/papers/1996/ss-stoc.pdf)
- [Expander Graphs and their Applications](https://www.ams.org/bull/2006-43-04/S0273-0979-06-01126-8/)
- [Modern Applications of Expander Codes](https://arxiv.org/abs/cs/0406036)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Expander code (12,6) all-zero codeword](https://people.csail.mit.edu/madhu/papers/1996/ss-stoc.pdf)

| Field | Value |
| --- | --- |
| `input` | `000000000000` |
| `expected` | `000000000000000000000000` |

**Vector 2** — [Expander code (12,6) single bit position 0](https://people.csail.mit.edu/madhu/papers/1996/ss-stoc.pdf)

| Field | Value |
| --- | --- |
| `input` | `010000000000` |
| `expected` | `010000010100000100010000` |

**Vector 3** — [Expander code (12,6) single bit position 1](https://ieeexplore.ieee.org/document/514929)

| Field | Value |
| --- | --- |
| `input` | `000100000000` |
| `expected` | `000100010001010000000100` |

**Vector 4** — [Expander code (12,6) two bits pattern](https://ieeexplore.ieee.org/document/514929)

| Field | Value |
| --- | --- |
| `input` | `010100000000` |
| `expected` | `010100000101010100010100` |

---

[← All algorithms](../README.md)
