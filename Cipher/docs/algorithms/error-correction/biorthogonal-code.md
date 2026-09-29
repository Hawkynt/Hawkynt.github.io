# Biorthogonal Code

> Extension of first-order Reed-Muller codes including complements of all codewords. Parameters [2^m, m+1, 2^(m-1)] where extra bit selects between codeword and its complement. Achieves twice the codebook size of Hadamard codes. Used in spread spectrum and code-division multiple access.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Linear Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Irving S. Reed, David E. Muller (extended concept) |
| Year | 1954 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/biorthogonal-code.js`](../../../algorithms/ecc/biorthogonal-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Moderate Code Rate | Code rate (m+1)/2^m is low for large m. Example: m=4 gives (5/16) = 31.25%. | — |
| Power-of-2 Constraint | Block length must be 2^m, limiting flexibility. | — |

## Documentation

- [Biorthogonal Codes](https://en.wikipedia.org/wiki/Reed%E2%80%93Muller_code#Biorthogonal_codes)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/reed_muller)
- [Orthogonal Signaling](https://www.ece.rutgers.edu/~orfanidi/ece348/codes.pdf)

## References

- [Reed-Muller Codes and Biorthogonal](https://web.stanford.edu/class/ee388/handouts/08_rm_codes.pdf)
- [CDMA Applications](https://www.researchgate.net/publication/3333956_Biorthogonal_codes_for_CDMA)
- [Spread Spectrum Systems](https://ieeexplore.ieee.org/document/268588)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Biorthogonal (8,4) all zeros](https://en.wikipedia.org/wiki/Reed%E2%80%93Muller_code)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `0000000000000000` |

**Vector 2** — [Biorthogonal (8,4) pattern 0001](https://en.wikipedia.org/wiki/Reed%E2%80%93Muller_code)

| Field | Value |
| --- | --- |
| `input` | `00000001` |
| `expected` | `0000000101010100` |

**Vector 3** — [Biorthogonal (8,4) pattern 0010](https://en.wikipedia.org/wiki/Reed%E2%80%93Muller_code)

| Field | Value |
| --- | --- |
| `input` | `00000100` |
| `expected` | `0001010000010100` |

**Vector 4** — [Biorthogonal (8,4) pattern 1000](https://en.wikipedia.org/wiki/Reed%E2%80%93Muller_code)

| Field | Value |
| --- | --- |
| `input` | `01000000` |
| `expected` | `0101010101010101` |

---

[← All algorithms](../README.md)
