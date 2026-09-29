# Extended Golay Code

> Perfect binary (24,12,8) linear code that can correct up to 3 errors or detect up to 4 errors. One of only two non-trivial perfect binary codes. Used in Voyager spacecraft, satellite communications, and mobile radio.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Linear Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Marcel J. E. Golay |
| Year | 1949 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/ecc/extended-golay.js`](../../../algorithms/ecc/extended-golay.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Limited Block Size | Fixed 12-bit message size may not be optimal for all applications. | — |
| Decoding Complexity | Full syndrome decoding requires lookup tables or complex algebraic operations. | — |

## Documentation

- [Wikipedia - Binary Golay Code](https://en.wikipedia.org/wiki/Binary_Golay_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/extended_golay)
- [Wolfram MathWorld](https://mathworld.wolfram.com/GolayCode.html)

## References

- [Algebraic Decoding](https://destevez.net/2018/05/algebraic-decoding-of-golay2412/)
- [Golay's Original Paper](https://ieeexplore.ieee.org/document/6769252)
- [Implementation Guide](http://aqdi.com/articles/using-the-golay-error-detection-and-correction-code-3/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Extended Golay all zeros](https://en.wikipedia.org/wiki/Binary_Golay_code)

| Field | Value |
| --- | --- |
| `input` | `000000000000000000000000` |
| `expected` | `000000000000000000000000000000000000000000000000` |

**Vector 2** — [Extended Golay all ones](https://en.wikipedia.org/wiki/Binary_Golay_code)

| Field | Value |
| --- | --- |
| `input` | `010101010101010101010101` |
| `expected` | `010101010101010101010101010101010101010101010101` |

**Vector 3** — [Extended Golay single bit](http://aqdi.com/articles/using-the-golay-error-detection-and-correction-code-3/)

| Field | Value |
| --- | --- |
| `input` | `010000000000000000000000` |
| `expected` | `010000000000000000000000010100000001010100010001` |

---

[← All algorithms](../README.md)
