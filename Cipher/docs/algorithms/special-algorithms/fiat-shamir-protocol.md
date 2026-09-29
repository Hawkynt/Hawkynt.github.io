# Fiat-Shamir Protocol

> Zero-knowledge identification protocol using quadratic residues. Demonstrates proof of knowledge without revealing secrets through interactive challenge-response.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Zero-Knowledge Proof |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Amos Fiat, Adi Shamir |
| Year | 1986 |
| Origin | 🇮🇱 Israel |
| Source | [`algorithms/special/fiat-shamir.js`](../../../algorithms/special/fiat-shamir.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [FS86: How to prove yourself: practical solutions to identification and signature problems](https://link.springer.com/chapter/10.1007/3-540-47721-7_12)

## References

- [Fiat-Shamir Zero-Knowledge Protocol Implementation](https://github.com/ivansarno/FiatShamirProtocol)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Educational Fiat-Shamir proof verification with deterministic parameters](https://link.springer.com/chapter/10.1007/3-540-47721-7_12)

| Field | Value |
| --- | --- |
| `timeSteps` | `10000` |
| `input` | `74657374` |
| `expected` | `74657374` |

---

[← All algorithms](../README.md)
