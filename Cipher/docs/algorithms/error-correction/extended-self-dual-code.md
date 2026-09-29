# Extended Self-Dual Code

> Extended Hamming [8,4,4] code that is self-dual (C = C⊥). Type II doubly-even self-dual code where all codewords have weight divisible by 4. Generator matrix equals parity-check matrix. Educational example of self-duality. Can correct 1-bit error and detect 2-bit errors (SECDED).

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Self-Dual Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Richard Hamming (extended version) |
| Year | 1950 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/extended-self-dual.js`](../../../algorithms/ecc/extended-self-dual.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Fixed Parameters | Self-dual property requires n even and k=n/2, limiting code parameters. | — |
| Limited Correction | Extended Hamming [8,4,4] can only correct single-bit errors. | — |

## Documentation

- [Wikipedia - Self-Dual Code](https://en.wikipedia.org/wiki/Dual_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/self_dual)
- [Extended Hamming](https://en.wikipedia.org/wiki/Hamming_code)

## References

- [Type II Codes](https://www.sciencedirect.com/topics/mathematics/self-dual-code)
- [Self-Dual Construction](https://arxiv.org/abs/2003.05064)
- [Doubly-Even Codes](https://link.springer.com/article/10.1007/s10623-021-00976-3)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Extended Self-Dual [8,4] all zeros](https://en.wikipedia.org/wiki/Dual_code)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `0000000000000000` |

**Vector 2** — [Extended Self-Dual [8,4] pattern 1000](https://en.wikipedia.org/wiki/Dual_code)

| Field | Value |
| --- | --- |
| `input` | `01000000` |
| `expected` | `0100000001010001` |

**Vector 3** — [Extended Self-Dual [8,4] pattern 0100](https://en.wikipedia.org/wiki/Dual_code)

| Field | Value |
| --- | --- |
| `input` | `00010000` |
| `expected` | `0001000001000101` |

**Vector 4** — [Extended Self-Dual [8,4] all ones](https://en.wikipedia.org/wiki/Dual_code)

| Field | Value |
| --- | --- |
| `input` | `01010101` |
| `expected` | `0101010101010101` |

---

[← All algorithms](../README.md)
