# BCH Code

> Bose-Chaudhuri-Hocquenghem cyclic error-correcting codes constructed using polynomials over Galois fields. Can correct multiple random errors with efficient encoding and decoding. Widely used in satellite communications, QR codes, and storage devices.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Cyclic Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Raj Chandra Bose, D. K. Ray-Chaudhuri, Alexis Hocquenghem |
| Year | 1960 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/bch-code.js`](../../../algorithms/ecc/bch-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Decoding Complexity | Full Berlekamp-Massey or Euclidean algorithm decoding requires complex polynomial operations. | — |
| Limited to t Errors | Can only correct up to t errors as designed. More errors may cause miscorrection. | — |

## Documentation

- [Wikipedia - BCH Code](https://en.wikipedia.org/wiki/BCH_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/q-ary_bch)
- [VOCAL Technologies](https://vocal.com/error-correction/bch-codes/)

## References

- [BCH Code Tutorial](https://web.ntpu.edu.tw/~yshan/BCH_code.pdf)
- [Hardware Implementation](https://www.researchgate.net/publication/268255309_Hardware_Implementation_of_BCH_Error-Correcting_Codes_on_a_FPGA)
- [Step-by-step Decoding](https://www.semanticscholar.org/paper/Step-by-step-decoding-of-the-Bose-Chaudhuri-codes-Massey/0715d789cbacaa47ac2cf28f9fb3d5c55158b027)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BCH(7,4) all zeros](https://en.wikipedia.org/wiki/BCH_code)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `00000000000000` |

**Vector 2** — [BCH(7,4) all ones](https://en.wikipedia.org/wiki/BCH_code)

| Field | Value |
| --- | --- |
| `input` | `01010101` |
| `expected` | `01010101010101` |

**Vector 3** — [BCH(7,4) pattern test](https://en.wikipedia.org/wiki/BCH_code)

| Field | Value |
| --- | --- |
| `input` | `01000100` |
| `expected` | `01000100000101` |

---

[← All algorithms](../README.md)
