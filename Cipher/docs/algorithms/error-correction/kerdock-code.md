# Kerdock Code

> Nonlinear binary code that is Z4-linear. For odd m, parameters [2^(m+1), 2^(2m), 2^m - 2^((m-1)/2)]. The [16, 256, 6] Kerdock code (m=3) achieves optimal nonlinear parameters. Related to Preparata codes via Gray map. Important in sequence design and wireless communications.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Nonlinear Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | A. M. Kerdock |
| Year | 1972 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/kerdock-code.js`](../../../algorithms/ecc/kerdock-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Nonlinear Structure | Nonlinear codes have complex decoding, no simple syndrome decoding like linear codes. | — |
| Fixed Parameters | Kerdock codes only defined for specific parameter sets based on odd m. | — |

## Documentation

- [Wikipedia - Kerdock Code](https://en.wikipedia.org/wiki/Kerdock_code)
- [Error Correction Zoo](https://errorcorrectionzoo.org/c/kerdock)
- [Z4-Linearity](https://www.ams.org/journals/bull/1994-31-02/S0273-0979-1994-00522-0/)

## References

- [Original Kerdock Paper](https://ieeexplore.ieee.org/document/1054893)
- [Gray Map Construction](https://ieeexplore.ieee.org/document/259642)
- [Sequence Design](https://link.springer.com/chapter/10.1007/978-94-011-3810-9_23)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Kerdock [16,6] all zeros](https://en.wikipedia.org/wiki/Kerdock_code)

| Field | Value |
| --- | --- |
| `m` | `3` |
| `input` | `000000000000` |
| `expected` | `00000000000000000000000000000000` |

**Vector 2** — [Kerdock [16,6] pattern 100000](https://en.wikipedia.org/wiki/Kerdock_code)

| Field | Value |
| --- | --- |
| `m` | `3` |
| `input` | `010000000000` |
| `expected` | `00010001000100010001000100010001` |

**Vector 3** — [Kerdock [16,6] pattern 010000](https://en.wikipedia.org/wiki/Kerdock_code)

| Field | Value |
| --- | --- |
| `m` | `3` |
| `input` | `000100000000` |
| `expected` | `00000101000001010000010100000101` |

**Vector 4** — [Kerdock [16,6] pattern 001000](https://en.wikipedia.org/wiki/Kerdock_code)

| Field | Value |
| --- | --- |
| `m` | `3` |
| `input` | `000001000000` |
| `expected` | `00000000010101010000000001010101` |

---

[← All algorithms](../README.md)
