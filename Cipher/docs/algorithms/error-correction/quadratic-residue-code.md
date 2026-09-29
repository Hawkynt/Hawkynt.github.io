# Quadratic Residue Code

> Cyclic codes constructed from quadratic residues in finite fields. For prime p ≡ ±1 (mod 8), constructs (p, (p+1)/2) code with excellent distance properties. Binary Golay code is a famous QR code. Automorphism group includes field automorphisms. Used in deep space and satellite communications.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Cyclic Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Andrew Gleason, Solomon Golomb |
| Year | 1958 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/quadratic-residue-code.js`](../../../algorithms/ecc/quadratic-residue-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Limited Code Lengths | Only defined for specific prime lengths p ≡ ±1 (mod 8), limiting flexibility. | — |
| Complex Decoding | Optimal decoding requires algebraic techniques more complex than simple codes. | — |

## Documentation

- [Wikipedia - QR Codes](https://en.wikipedia.org/wiki/Quadratic_residue_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/qr)
- [Cyclic Codes Tutorial](https://web.stanford.edu/class/ee388/handouts/06_cyclic_codes.pdf)

## References

- [Gleason's Theorem](https://www.ams.org/journals/bull/1970-76-01/S0002-9904-1970-12352-8/)
- [QR Code Construction](https://www.sciencedirect.com/topics/mathematics/quadratic-residue-code)
- [Automorphism Groups](https://ieeexplore.ieee.org/document/1055028)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [QR (7,4) all zeros](https://en.wikipedia.org/wiki/Quadratic_residue_code)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `00000000000000` |

**Vector 2** — [QR (7,4) pattern 1000](https://en.wikipedia.org/wiki/Quadratic_residue_code)

| Field | Value |
| --- | --- |
| `input` | `01000000` |
| `expected` | `01000000010100` |

**Vector 3** — [QR (7,4) pattern 0100](https://en.wikipedia.org/wiki/Quadratic_residue_code)

| Field | Value |
| --- | --- |
| `input` | `00010000` |
| `expected` | `00010000000101` |

**Vector 4** — [QR (7,4) all ones](https://en.wikipedia.org/wiki/Quadratic_residue_code)

| Field | Value |
| --- | --- |
| `input` | `01010101` |
| `expected` | `01010101010101` |

---

[← All algorithms](../README.md)
