# Playfair Cipher

> Classical digraph substitution cipher using 5x5 key grid. Encrypts pairs of letters according to position rules. Invented by Charles Wheatstone but popularized by Lord Playfair. More secure than simple substitution ciphers.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Charles Wheatstone |
| Year | 1854 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/classical/playfair.js`](../../../algorithms/classical/playfair.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Common digraph patterns in plaintext create patterns in ciphertext, enabling cryptanalysis](https://en.wikipedia.org/wiki/Frequency_analysis) | — | Educational use only - use modern ciphers for real security |
| [If plaintext-ciphertext pairs are known, key matrix can be reconstructed](https://en.wikipedia.org/wiki/Known-plaintext_attack) | — | Avoid using with predictable or repeated messages |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Playfair_cipher)
- [Historical Background](https://en.wikipedia.org/wiki/Charles_Wheatstone)
- [Cryptanalysis Methods](https://www.dcode.fr/playfair-cipher)

## References

- [DCode Implementation](https://www.dcode.fr/playfair-cipher)
- [Educational Tutorial](https://cryptii.com/pipes/playfair-cipher)
- [Practical Cryptography](https://practicalcryptography.com/ciphers/classical-era/playfair/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Lord Playfair Demonstration](https://en.wikipedia.org/wiki/Playfair_cipher#History)

| Field | Value |
| --- | --- |
| `key` | `504c4159464149524558414d504c45` |
| `input` | `48494445544845474f4c44494e544845545245455354554d50` |
| `expected` | `424d4f445a4258444e4142454b55444d5549584d4d4f55564946` |

**Vector 2** — [Standard Educational Example](https://www.dcode.fr/playfair-cipher)

| Field | Value |
| --- | --- |
| `key` | `4d4f4e4152434859` |
| `input` | `494e535452554d454e5453` |
| `expected` | `4741544c4d5a434c52515841` |

**Vector 3** — [Hello World Test](https://practicalcryptography.com/ciphers/classical-era/playfair/)

| Field | Value |
| --- | --- |
| `key` | `4b4559574f5244` |
| `input` | `48454c4c4f` |
| `expected` | `4759495a5343` |

---

[← All algorithms](../README.md)
