# BCH

> Bose-Chaudhuri-Hocquenghem (BCH) error correction codes using Galois Field arithmetic. Can detect and correct multiple random errors in transmitted data. Educational implementation for learning error correction principles.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Cyclic Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | R.C. Bose, D.K. Ray-Chaudhuri, A. Hocquenghem |
| Year | 1960 |
| Origin | 🌐 International |
| Source | [`algorithms/ecc/bch.js`](../../../algorithms/ecc/bch.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Limited Error Correction Capacity | BCH codes can only correct up to t errors per codeword. Beyond this limit, errors may go undetected or be incorrectly corrected | — |
| Implementation Complexity | Requires careful Galois Field arithmetic implementation to avoid introducing errors in the correction process | — |

## Documentation

- [Wikipedia - BCH Code](https://en.wikipedia.org/wiki/BCH_code)
- [BCH Error Correction Theory](https://www.mathworks.com/help/comm/ug/bch-encoder-and-decoder.html)
- [Galois Field Arithmetic](https://en.wikipedia.org/wiki/Finite_field_arithmetic)

## References

- [Bose and Ray-Chaudhuri Original Paper](https://projecteuclid.org/journals/illinois-journal-of-mathematics/volume-6/number-1/On-a-class-of-error-correcting-binary-group-codes/10.1215/ijm/1255631584.full)
- [Hocquenghem's Paper](https://www.google.com/search?q=hocquenghem+codes+correcteurs+erreurs)
- [Modern BCH Implementation Guide](https://ieeexplore.ieee.org/document/1057683)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BCH Error-free data test](https://en.wikipedia.org/wiki/BCH_code)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `0000000000` |

**Vector 2** — [BCH Pattern data test](https://en.wikipedia.org/wiki/BCH_code)

| Field | Value |
| --- | --- |
| `input` | `01010101` |
| `expected` | `0101010100` |

---

[← All algorithms](../README.md)
