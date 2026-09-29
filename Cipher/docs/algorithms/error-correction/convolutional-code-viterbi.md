# Convolutional Code (Viterbi)

> Convolutional encoder with Viterbi maximum likelihood decoder. Uses constraint length K=3, rate 1/2 with generator polynomials (7,5) octal. Widely used in digital communications including WiFi, LTE, and satellite systems.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Convolutional Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Andrew Viterbi |
| Year | 1967 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/convolutional-viterbi.js`](../../../algorithms/ecc/convolutional-viterbi.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Decoding Complexity | Viterbi decoding complexity grows exponentially with constraint length. K=7 is practical limit for software. | — |
| Error Propagation | Bit errors can propagate through decoder state transitions, though typically limited to 5× constraint length. | — |

## Documentation

- [Wikipedia - Viterbi Decoder](https://en.wikipedia.org/wiki/Viterbi_decoder)
- [MIT Viterbi Tutorial](https://web.mit.edu/6.02/www/f2011/handouts/8.pdf)
- [Convolutional Encoding](https://users.ece.utexas.edu/~gerstl/ee382v_f14/soc/drm/Viterbi.pdf)

## References

- [Viterbi's Original Paper](https://ieeexplore.ieee.org/document/1054010)
- [Error Correction Coding](https://www.ece.unb.ca/tervo/ece4253/convolution3.shtml)
- [Princeton Lecture Notes](https://www.cs.princeton.edu/courses/archive/spring18/cos463/lectures/L09-viterbi.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [K=3 all zeros test](https://web.mit.edu/6.02/www/f2011/handouts/8.pdf)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `0000000000000000` |

**Vector 2** — [K=3 single bit test](https://web.mit.edu/6.02/www/f2011/handouts/8.pdf)

| Field | Value |
| --- | --- |
| `input` | `01000000` |
| `expected` | `0101010001010000` |

**Vector 3** — [K=3 all ones test](https://web.mit.edu/6.02/www/f2011/handouts/8.pdf)

| Field | Value |
| --- | --- |
| `input` | `01010101` |
| `expected` | `0101000101000100` |

**Vector 4** — [K=3 alternating pattern](https://web.mit.edu/6.02/www/f2011/handouts/8.pdf)

| Field | Value |
| --- | --- |
| `input` | `01000100` |
| `expected` | `0101010000000100` |

---

[← All algorithms](../README.md)
