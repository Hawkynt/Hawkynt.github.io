# Affine Cipher

> Classical mathematical cipher using linear transformation f(x) = (ax + b) mod 26. Requires coefficient 'a' to be coprime with 26 for reversibility. One of the oldest mathematical ciphers based on modular arithmetic. Input domain: every byte is accepted. A-Z and a-z are enciphered in place with their case preserved; every other byte - digit, punctuation, whitespace, control or high-bit - is carried through unchanged, which is the usual pen-and-paper convention and makes the round trip exact for arbitrary input. Nothing is ever discarded.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (Ancient) |
| Year | 1929 |
| Origin | 🏛️ Ancient |
| Source | [`algorithms/classical/affine.js`](../../../algorithms/classical/affine.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Letter frequencies preserved, making frequency analysis effective against longer texts](https://en.wikipedia.org/wiki/Frequency_analysis) | — | Use only for educational purposes, never for actual security |
| [Only 312 possible keys (12 valid 'a' values × 26 'b' values), vulnerable to brute force](https://en.wikipedia.org/wiki/Brute-force_attack) | — | Consider as demonstration cipher only |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Affine_cipher)
- [Mathematical Foundation](https://mathworld.wolfram.com/AffineCipher.html)
- [Cryptography Theory](https://www.cs.uri.edu/cryptography/classicalaffine.htm)

## References

- [DCode Implementation](https://www.dcode.fr/affine-cipher)
- [Educational Example](https://github.com/geeksforgeeks/affine-cipher)
- [University Tutorial](https://www.cs.uregina.ca/Links/class-info/425/Affine/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DCode Reference Test](https://www.dcode.fr/affine-cipher)

| Field | Value |
| --- | --- |
| `key` | `352c33` |
| `input` | `44434f4445` |
| `expected` | `534e565358` |

**Vector 2** — [GeeksforGeeks Example](https://www.geeksforgeeks.org/affine-cipher/)

| Field | Value |
| --- | --- |
| `key` | `31372c3230` |
| `input` | `48454c4c4f` |
| `expected` | `4a4b5a5a59` |

**Vector 3** — [Identity Transformation](https://en.wikipedia.org/wiki/Affine_cipher)

| Field | Value |
| --- | --- |
| `key` | `312c30` |
| `input` | `4142434445464748494a4b4c4d4e4f505152535455565758595a` |
| `expected` | `4142434445464748494a4b4c4d4e4f505152535455565758595a` |

---

[← All algorithms](../README.md)
