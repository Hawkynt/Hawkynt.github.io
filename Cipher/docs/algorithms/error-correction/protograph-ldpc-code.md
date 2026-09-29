# Protograph LDPC Code

> LDPC codes constructed from small prototype graphs (protographs) expanded via copy-and-permute operations. AR4JA (Accumulate-Repeat-4-Jagged-Accumulate) protograph provides near-capacity performance with structured design enabling analytical threshold analysis. Adopted in NASA deep space communications (CCSDS standard), DVB-S2X satellite broadcasting, and 5G NR. Educational implementation demonstrates protograph expansion with circulant permutation matrices.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Structured LDPC Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Dariush Divsalar, Sam Dolinar, Christopher Jones |
| Year | 2004 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/protograph-ldpc.js`](../../../algorithms/ecc/protograph-ldpc.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Iterative Decoding Complexity | Belief propagation decoder requires multiple iterations with high computational cost | — |
| Short Cycle Impact | Small protographs expanded with small lifting factors can create short cycles degrading performance | — |
| Error Floor Phenomenon | Trapping sets in expanded graph can cause performance degradation at low error rates | — |

## Documentation

- [Wikipedia - Protograph](https://en.wikipedia.org/wiki/Low-density_parity-check_code#Protograph_LDPC_codes)
- [Error Correction Zoo - Protograph LDPC](https://errorcorrectionzoo.org/c/protograph_ldpc)
- [CCSDS Standard - AR4JA Codes](https://ccsds.org/Pubs/131x1o2e2s.pdf)
- [ProtographLDPC Library](https://shubhamchandak94.github.io/ProtographLDPC/)

## References

- [Divsalar et al. - Construction of Protograph LDPC Codes](https://tmo.jpl.nasa.gov/progress_report/42-165/165E.pdf)
- [NASA Tech Brief - AR4JA Encoders/Decoders](https://www.techbriefs.com/component/content/article/23061-npo-47162)
- [AR4JA Protograph Structure](https://shubhamchandak94.github.io/ProtographLDPC/methods-sample-protographs.html)
- [CCSDS 131.1-O-2 Standard](https://public.ccsds.org/Pubs/131x1o2.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Protograph LDPC all-zero codeword (N=4)](https://ccsds.org/Pubs/131x1o2e2s.pdf)

| Field | Value |
| --- | --- |
| `input` | `0000000000000000` |
| `expected` | `00000000000000000000000000000000` |

**Vector 2** — [Protograph LDPC round-trip test 1](https://shubhamchandak94.github.io/ProtographLDPC/methods-sample-protographs.html)

| Field | Value |
| --- | --- |
| `input` | `0100010001000100` |
| `expected` | _(empty)_ |

**Vector 3** — [Protograph LDPC round-trip test 2](https://tmo.jpl.nasa.gov/progress_report/42-165/165E.pdf)

| Field | Value |
| --- | --- |
| `input` | `0001000100010001` |
| `expected` | _(empty)_ |

**Vector 4** — [Protograph LDPC round-trip test 3](https://errorcorrectionzoo.org/c/protograph_ldpc)

| Field | Value |
| --- | --- |
| `input` | `0101000001010000` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
