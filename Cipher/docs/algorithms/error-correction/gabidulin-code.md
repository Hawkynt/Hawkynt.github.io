# Gabidulin Code

> Rank-metric codes achieving Singleton bound for rank distance. Maximum Rank Distance (MRD) codes over extension fields. Used in network coding, post-quantum cryptography (GPT cryptosystem), and random linear network coding. Rank distance instead of Hamming distance. Analogous to Reed-Solomon codes but for rank metric.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Rank-Metric Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Ernst Gabidulin |
| Year | 1985 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/ecc/gabidulin-code.js`](../../../algorithms/ecc/gabidulin-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Overbeck Attack | Structural attack on GPT cryptosystem using Gabidulin codes - polynomial-time key recovery. | — |
| Rank Distance Complexity | Rank metric distance computation more complex than Hamming distance - requires field operations. | — |
| Field Size Requirements | Security requires large extension fields - field size must exceed code length for MRD property. | — |

## Documentation

- [Error Correction Zoo - Gabidulin Code](https://errorcorrectionzoo.org/c/gabidulin)
- [Wikipedia - Rank Error-Correcting Codes](https://en.wikipedia.org/wiki/Rank_error-correcting_code)
- [Network Coding Overview](https://web.mit.edu/dimitrib/www/netcod.pdf)

## References

- [Original Gabidulin Paper (1985)](https://ieeexplore.ieee.org/document/1057167)
- [Rank-Metric Codes and Applications](https://arxiv.org/abs/1703.08121)
- [GPT Cryptosystem Analysis](https://link.springer.com/chapter/10.1007/978-3-642-25516-8_12)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Gabidulin [4,2] all zeros](https://errorcorrectionzoo.org/c/gabidulin)

| Field | Value |
| --- | --- |
| `input` | `0000` |
| `expected` | `00000000` |

**Vector 2** — [Gabidulin [4,2] pattern [1,0] - first generator row](https://errorcorrectionzoo.org/c/gabidulin)

| Field | Value |
| --- | --- |
| `input` | `0100` |
| `expected` | `01010101` |

**Vector 3** — [Gabidulin [4,2] pattern [0,1] - second generator row](https://errorcorrectionzoo.org/c/gabidulin)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `00010302` |

**Vector 4** — [Gabidulin [4,2] pattern [1,1] - sum of basis vectors](https://errorcorrectionzoo.org/c/gabidulin)

| Field | Value |
| --- | --- |
| `input` | `0101` |
| `expected` | `01000203` |

**Vector 5** — [Gabidulin [4,2] pattern [2,1] - GF(4) linear combination](https://arxiv.org/abs/1703.08121)

| Field | Value |
| --- | --- |
| `input` | `0201` |
| `expected` | `02030100` |

**Vector 6** — [Gabidulin [4,2] pattern [1,3] - GF(4) linear combination](https://arxiv.org/abs/1703.08121)

| Field | Value |
| --- | --- |
| `input` | `0103` |
| `expected` | `01020300` |

---

[← All algorithms](../README.md)
