# Two-Square Cipher

> Classical polygraphic substitution cipher using two 5x5 Polybius squares for digraph encryption with enhanced security.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Polygraphic Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Unknown |
| Year | 1850 |
| Origin | ❓ Unknown |
| Source | [`algorithms/classical/twosquare.js`](../../../algorithms/classical/twosquare.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Two-Square Cipher Information](https://en.wikipedia.org/wiki/Two-square_cipher)
- [Classical Cryptography Guide](http://practicalcryptography.com/ciphers/classical-era/two-square/)

## References

- [Two-Square (Double Playfair) Cipher Reference Implementation (Python)](https://github.com/scottmilton1/two-square-cipher)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Keywords SECRET and CIPHER, odd-length message padded with X. No published source carries this value](https://en.wikipedia.org/wiki/Two-square_cipher)

| Field | Value |
| --- | --- |
| `key` | `5345435245542c434950484552` |
| `input` | `48454c4c4f` |
| `expected` | `4d434b4d5057` |

**Vector 2** — [Keywords EXAMPLE and KEYWORD, J folded onto I. No published source carries this value](https://en.wikipedia.org/wiki/Two-square_cipher)

| Field | Value |
| --- | --- |
| `key` | `4558414d504c452c4b4559574f5244` |
| `input` | `41545441434b41544441574e` |
| `expected` | `455652434c59455643425650` |

---

[← All algorithms](../README.md)
