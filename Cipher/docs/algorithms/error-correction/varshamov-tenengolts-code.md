# Varshamov-Tenengolts Code

> Code correcting single insertion, deletion, or asymmetric (0→1) error. Rate-1 code with log(n+1) redundancy bits. Uses weighted checksum: sum of i·x_i ≡ a (mod n+1). Critical for DNA storage and optical communications where synchronization errors occur. Remarkably efficient for indel correction.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Insertion/Deletion Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | R. R. Varshamov, G. M. Tenengolts |
| Year | 1965 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/ecc/varshamov-tenengolts.js`](../../../algorithms/ecc/varshamov-tenengolts.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Single Error Only | Can only correct single insertion OR deletion OR asymmetric error, not multiple. | — |
| Modulo Constraint | Requires knowledge of original word length for proper decoding. | — |

## Documentation

- [Error Correction Zoo](https://errorcorrectionzoo.org/c/vt_single_deletion)
- [GitHub Implementation](https://github.com/shubhamchandak94/VT_codes)
- [DNA Storage Applications](https://www.mdpi.com/1099-4300/23/12/1592)

## References

- [Original VT Paper](https://ieeexplore.ieee.org/document/1054045)
- [Efficient Encoders](https://arxiv.org/abs/2311.04578)
- [Decoder Algorithm](https://cs.stackexchange.com/questions/84084/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [VT (7,0) all zeros](https://errorcorrectionzoo.org/c/vt_single_deletion)

| Field | Value |
| --- | --- |
| `n` | `7` |
| `a` | `0` |
| `input` | `00000000000000` |
| `expected` | `00000000000000` |

**Vector 2** — [VT (7,0) sum=8: positions 1,7](https://errorcorrectionzoo.org/c/vt_single_deletion)

| Field | Value |
| --- | --- |
| `n` | `7` |
| `a` | `0` |
| `input` | `01000000000001` |
| `expected` | `01000000000001` |

**Vector 3** — [VT (7,0) sum=8: positions 2,6](https://errorcorrectionzoo.org/c/vt_single_deletion)

| Field | Value |
| --- | --- |
| `n` | `7` |
| `a` | `0` |
| `input` | `00010000000100` |
| `expected` | `00010000000100` |

**Vector 4** — [VT (7,3) sum=3: position 3](https://errorcorrectionzoo.org/c/vt_single_deletion)

| Field | Value |
| --- | --- |
| `n` | `7` |
| `a` | `3` |
| `input` | `00000100000000` |
| `expected` | `00000100000000` |

---

[← All algorithms](../README.md)
