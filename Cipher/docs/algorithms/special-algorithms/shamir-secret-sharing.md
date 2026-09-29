# Shamir Secret Sharing

> Secret sharing scheme that splits a secret into n shares where any k shares can reconstruct the original secret. Based on polynomial interpolation over finite fields. Provides perfect secrecy.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Secret Sharing |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Adi Shamir |
| Year | 1979 |
| Origin | 🇮🇱 Israel |
| Source | [`algorithms/special/shamir-secret-sharing.js`](../../../algorithms/special/shamir-secret-sharing.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Paper](https://web.mit.edu/6.857/OldStuff/Fall03/ref/Shamir-HowToShareASecret.pdf)
- [Wikipedia Article](https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing)
- [Tutorial](https://www.cs.jhu.edu/~sdoshi/crypto/papers/shamirturing.pdf)

## References

- [Implementation Guide](https://github.com/dsprenkels/sss)
- [Mathematical Background](https://en.wikipedia.org/wiki/Polynomial_interpolation)
- [Finite Field Arithmetic](https://en.wikipedia.org/wiki/Finite_field_arithmetic)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Simple secret sharing: single byte value](https://web.mit.edu/6.857/OldStuff/Fall03/ref/Shamir-HowToShareASecret.pdf)

| Field | Value |
| --- | --- |
| `threshold` | `3` |
| `totalShares` | `5` |
| `testReconstruction` | Yes |
| `input` | `41` |
| `expected` | `41` |

**Vector 2** — [Multi-byte secret sharing test](https://web.mit.edu/6.857/OldStuff/Fall03/ref/Shamir-HowToShareASecret.pdf)

| Field | Value |
| --- | --- |
| `threshold` | `2` |
| `totalShares` | `3` |
| `testReconstruction` | Yes |
| `input` | `54657374` |
| `expected` | `54657374` |

---

[← All algorithms](../README.md)
