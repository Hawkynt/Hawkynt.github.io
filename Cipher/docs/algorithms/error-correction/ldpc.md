# LDPC

> Low-Density Parity-Check (LDPC) codes using sparse parity-check matrices for efficient error correction. Modern error correction technique used in WiFi, DVB-S2, and 5G. Educational implementation demonstrating belief propagation decoding.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Linear Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Robert Gallager |
| Year | 1962 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/ldpc.js`](../../../algorithms/ecc/ldpc.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Decoding Complexity | Iterative decoding algorithms have high computational complexity and may not converge | — |
| Error Floor Phenomenon | Performance degradation at very low error rates due to near-codewords | — |

## Documentation

- [Wikipedia - LDPC Code](https://en.wikipedia.org/wiki/Low-density_parity-check_code)
- [LDPC Tutorial](https://www.mathworks.com/help/comm/ug/ldpc-encoder-and-decoder.html)
- [Belief Propagation](https://en.wikipedia.org/wiki/Belief_propagation)

## References

- [Gallager's Original Thesis](https://dspace.mit.edu/handle/1721.1/11242)
- [Modern LDPC Codes](https://ieeexplore.ieee.org/document/910572)
- [IEEE 802.11n Standard](https://standards.ieee.org/standard/802_11n-2009.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LDPC basic encoding test](https://en.wikipedia.org/wiki/Low-density_parity-check_code)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `00000000000000` |

**Vector 2** — [LDPC pattern encoding test](https://en.wikipedia.org/wiki/Low-density_parity-check_code)

| Field | Value |
| --- | --- |
| `input` | `01000100` |
| `expected` | `01000100000100` |

---

[← All algorithms](../README.md)
