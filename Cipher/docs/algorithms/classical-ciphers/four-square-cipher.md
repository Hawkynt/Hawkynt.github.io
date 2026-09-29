# Four-Square Cipher

> Classical polygraphic cipher using four 5x5 squares for digraph encryption, offering enhanced security over simple substitution ciphers.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Polygraphic Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Felix Marie Delastelle |
| Year | 1902 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/classical/foursquare.js`](../../../algorithms/classical/foursquare.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Four-Square Cipher Wikipedia](https://en.wikipedia.org/wiki/Four-square_cipher)
- [Practical Cryptography Tutorial](http://practicalcryptography.com/ciphers/classical-era/four-square/)

## References

- [Classical Cryptography Guide](http://practicalcryptography.com/ciphers/classical-era/four-square/)
- [Delastelle Cipher Systems](https://en.wikipedia.org/wiki/F%C3%A9lix_Delastelle)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Keywords EXAMPLE and KEYWORD over one digraph pair, J folded onto I. No published source carries this value](https://en.wikipedia.org/wiki/Four-square_cipher)

| Field | Value |
| --- | --- |
| `key` | `4558414d504c452c4b4559574f5244` |
| `input` | `48454c50` |
| `expected` | `46594e46` |

**Vector 2** — [Keywords with repeated letters - FORTIFICATION and BATTLE both dedupe. No published source carries this value](https://en.wikipedia.org/wiki/Four-square_cipher)

| Field | Value |
| --- | --- |
| `key` | `464f5254494649434154494f4e2c424154544c45` |
| `input` | `41545441434b41544441574e` |
| `expected` | `54504d4c49465450464c584b` |

**Vector 3** — [Odd-length message padded to an even number of digraphs with X. No published source carries this value](https://en.wikipedia.org/wiki/Four-square_cipher)

| Field | Value |
| --- | --- |
| `key` | `4a4f484e2c5041554c` |
| `input` | `424541544c4553` |
| `expected` | `41414e4f50505358` |

---

[← All algorithms](../README.md)
