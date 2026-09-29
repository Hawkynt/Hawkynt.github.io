# Trifid Cipher

> Félix Delastelle's three-dimensional fractionating cipher extending the Bifid concept to three dimensions for enhanced security.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Fractionating Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Félix Marie Delastelle |
| Year | 1901 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/classical/trifid.js`](../../../algorithms/classical/trifid.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Trifid Cipher Wikipedia](https://en.wikipedia.org/wiki/Trifid_cipher)
- [Delastelle Ciphers](http://practicalcryptography.com/ciphers/classical-era/trifid/)

## References

- [CrypTool 2 Trifid Cipher Plugin (open-source reference implementation)](https://github.com/CrypToolProject/CrypTool-2)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Delastelle's own example as reproduced on Wikipedia - key alphabet from FELIX MARIE DELASTELLE, group size 5](https://en.wikipedia.org/wiki/Trifid_cipher)

| Field | Value |
| --- | --- |
| `key` | `46454c49584d4152494544454c415354454c4c452c35` |
| `input` | `41494445544f494c454349454c54414944455241` |
| `expected` | `464d4a46564f4953535546544650554645515143` |

**Vector 2** — [Basic Trifid example with period 5](https://en.wikipedia.org/wiki/Trifid_cipher)

| Field | Value |
| --- | --- |
| `key` | `35` |
| `input` | `48454c4c4f` |
| `expected` | `424f4a4e2b` |

**Vector 3** — [Military message with period 6](https://en.wikipedia.org/wiki/Trifid_cipher)

| Field | Value |
| --- | --- |
| `key` | `36` |
| `input` | `41545441434b41544441574e` |
| `expected` | `494241414548474842454445` |

---

[← All algorithms](../README.md)
