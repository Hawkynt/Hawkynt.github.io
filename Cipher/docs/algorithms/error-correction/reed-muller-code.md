# Reed-Muller Code

> First-order Reed-Muller codes RM(1,m) with parameters [2^m, 1+m, 2^(m-1)]. Closely related to Hadamard codes and biorthogonal codes. Simple decoding using majority logic. Used in wireless communications and deep-space missions.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Linear Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | David E. Muller, Irving S. Reed |
| Year | 1954 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/reed-muller.js`](../../../algorithms/ecc/reed-muller.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Low Code Rate | First-order RM codes have low code rate (1+m)/2^m, decreasing with larger m. | — |
| Fixed Block Lengths | Block length must be a power of 2, limiting flexibility. | — |

## Documentation

- [Wikipedia - Reed-Muller Code](https://en.wikipedia.org/wiki/Reed–Muller_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/reed_muller)
- [Tutorial PDF](http://pfister.ee.duke.edu/courses/ece590_ecc/rm.pdf)

## References

- [ArXiv - Theory and Algorithms](https://arxiv.org/pdf/2002.03317)
- [Testing Reed-Muller Codes](https://www.researchgate.net/publication/3084486_Testing_Reed-Muller_Codes)
- [MAP Decoding](https://www.researchgate.net/publication/3085113_Simple_MAP_Decoding_of_First-Order_Reed-Muller_and_Hamming_Codes)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RM(1,3) all zeros](https://en.wikipedia.org/wiki/Reed–Muller_code)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `0000000000000000` |

**Vector 2** — [RM(1,3) all ones](https://en.wikipedia.org/wiki/Reed–Muller_code)

| Field | Value |
| --- | --- |
| `input` | `01010101` |
| `expected` | `0100000100010100` |

**Vector 3** — [RM(1,3) pattern test](https://en.wikipedia.org/wiki/Reed–Muller_code)

| Field | Value |
| --- | --- |
| `input` | `01000000` |
| `expected` | `0101010101010101` |

---

[← All algorithms](../README.md)
