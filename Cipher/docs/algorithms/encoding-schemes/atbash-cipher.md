# Atbash Cipher

> Ancient Hebrew substitution cipher that reverses the alphabet. Maps each letter to its opposite position (A↔Z, B↔Y, etc.). Simple monoalphabetic substitution cipher with fixed key that is its own inverse.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Text Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Ancient Hebrew scholars |
| Year | -500 |
| Origin | 🇮🇱 Israel |
| Source | [`algorithms/encoding/atbash.js`](../../../algorithms/encoding/atbash.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Simple substitution cipher vulnerable to frequency analysis - letter frequencies preserved](https://en.wikipedia.org/wiki/Frequency_analysis) | — | Educational use only - easily broken by frequency analysis |
| [Fixed transformation pattern makes it vulnerable to pattern recognition attacks](https://en.wikipedia.org/wiki/Substitution_cipher) | — | Combine with other techniques or use for educational purposes only |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Atbash)
- [Biblical Usage](https://en.wikipedia.org/wiki/Hebrew_alphabet)
- [Historical Context](https://www.britannica.com/topic/cryptology/Early-cryptographic-systems)

## References

- [DCode Implementation](https://www.dcode.fr/atbash-cipher)
- [Educational Tutorial](https://cryptii.com/pipes/atbash-cipher)
- [Bible Code Examples](https://www.bible-codes.org/Atbash.htm)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Basic Atbash transformation](https://www.dcode.fr/atbash-cipher)

| Field | Value |
| --- | --- |
| `key` | _(empty)_ |
| `input` | `48454c4c4f` |
| `expected` | `53564f4f4c` |

**Vector 2** — [Full alphabet test](https://en.wikipedia.org/wiki/Atbash)

| Field | Value |
| --- | --- |
| `key` | _(empty)_ |
| `input` | `4142434445464748494a4b4c4d4e4f505152535455565758595a` |
| `expected` | `5a595857565554535251504f4e4d4c4b4a494847464544434241` |

**Vector 3** — [Mixed case preservation](https://cryptii.com/pipes/atbash-cipher)

| Field | Value |
| --- | --- |
| `key` | _(empty)_ |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `53766f6f6c20446c696f77` |

---

[← All algorithms](../README.md)
