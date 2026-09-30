# Caesar Cipher

> Ancient Roman substitution cipher shifting each letter by fixed number of positions in alphabet. Used by Julius Caesar for military communications with standard shift of 3. One of the oldest known encryption techniques.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Julius Caesar |
| Year | -50 |
| Origin | 🇮🇹 Italy |
| Source | [`algorithms/classical/caesar.js`](../../../algorithms/classical/caesar.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Brute Force Attack](https://en.wikipedia.org/wiki/Caesar_cipher#Breaking_the_cipher) | Only 25 possible keys (shifts 1-25), making brute force trivial even by hand | None - cipher is fundamentally insecure |
| [Frequency Analysis](https://en.wikipedia.org/wiki/Frequency_analysis) | Letter frequencies preserved, making frequency analysis immediately effective | Use only for educational demonstrations of cryptanalysis |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Caesar_cipher)
- [Historical Context](https://en.wikipedia.org/wiki/Julius_Caesar)
- [Cryptanalysis Methods](https://www.dcode.fr/caesar-cipher)

## References

- [DCode Implementation](https://www.dcode.fr/caesar-cipher)
- [Educational Tutorial](https://cryptii.com/pipes/caesar-cipher)
- [Practical Cryptography](https://practicalcryptography.com/ciphers/classical-era/caesar/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Historical Caesar Example](https://en.wikipedia.org/wiki/Caesar_cipher)

| Field | Value |
| --- | --- |
| `shift` | `3` |
| `input` | `48454c4c4f` |
| `expected` | `4b484f4f52` |

**Vector 2** — [Classic Educational Test](https://www.dcode.fr/caesar-cipher)

| Field | Value |
| --- | --- |
| `shift` | `3` |
| `input` | `41545441434b41544441574e` |
| `expected` | `44575744464e445747445a51` |

**Vector 3** — [Full Alphabet Shift](https://practicalcryptography.com/ciphers/classical-era/caesar/)

| Field | Value |
| --- | --- |
| `shift` | `3` |
| `input` | `4142434445464748494a4b4c4d4e4f505152535455565758595a` |
| `expected` | `4445464748494a4b4c4d4e4f505152535455565758595a414243` |

**Vector 4** — [Mixed case text](https://www.dcode.fr/caesar-cipher)

| Field | Value |
| --- | --- |
| `shift` | `3` |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `4b686f6f72205a72756f67` |

**Vector 5** — [Text with numbers](https://www.dcode.fr/caesar-cipher)

| Field | Value |
| --- | --- |
| `shift` | `3` |
| `input` | `54657374313233` |
| `expected` | `57687677313233` |

---

[← All algorithms](../README.md)
