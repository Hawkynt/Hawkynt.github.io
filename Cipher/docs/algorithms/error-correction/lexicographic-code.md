# Lexicographic Code

> Greedy construction method for error correction codes. Builds codebook by adding codewords in lexicographic order that maintain minimum distance constraint. Simple construction yields codes including Hamming and Golay codes. Demonstrates fundamental code construction principles.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Constructed Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Unknown (classical technique) |
| Year | 1960 |
| Origin | Not specified |
| Source | [`algorithms/ecc/lexicographic-code.js`](../../../algorithms/ecc/lexicographic-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Suboptimal Parameters | Greedy construction does not always yield optimal codes. May have fewer codewords than best-known codes. | — |
| Construction Complexity | Building codebook requires checking all previous codewords, O(n²) complexity. | — |

## Documentation

- [Lexicographic Codes](https://www.sciencedirect.com/topics/computer-science/lexicographic-code)
- [Greedy Construction](https://www.win.tue.nl/~aeb/codes/Andw.html)
- [Code Construction Methods](http://www.lix.polytechnique.fr/~sorger/cours/Codes/courseSlides3.pdf)

## References

- [Coding Theory Basics](https://www.springer.com/gp/book/9783540641339)
- [Optimal Codes](https://ieeexplore.ieee.org/document/1055404)
- [Greedy Algorithms](https://www.cs.cmu.edu/~avrim/451f11/lectures/lect1004.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Lexicographic (7,3) zeros](https://www.sciencedirect.com/topics/computer-science/lexicographic-code)

| Field | Value |
| --- | --- |
| `n` | `7` |
| `d` | `3` |
| `input` | `00000000` |
| `expected` | `00000000000000` |

**Vector 2** — [Lexicographic (7,3) pattern 1](https://www.sciencedirect.com/topics/computer-science/lexicographic-code)

| Field | Value |
| --- | --- |
| `n` | `7` |
| `d` | `3` |
| `input` | `00000001` |
| `expected` | `00000000010101` |

**Vector 3** — [Lexicographic (7,3) pattern 2](https://www.sciencedirect.com/topics/computer-science/lexicographic-code)

| Field | Value |
| --- | --- |
| `n` | `7` |
| `d` | `3` |
| `input` | `00000100` |
| `expected` | `00000101000001` |

**Vector 4** — [Lexicographic (7,3) pattern 3](https://www.sciencedirect.com/topics/computer-science/lexicographic-code)

| Field | Value |
| --- | --- |
| `n` | `7` |
| `d` | `3` |
| `input` | `00010000` |
| `expected` | `00010001000100` |

---

[← All algorithms](../README.md)
