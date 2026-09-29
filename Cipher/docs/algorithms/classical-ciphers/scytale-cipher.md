# Scytale Cipher

> Ancient Spartan transposition cipher using a staff for military communications in classical antiquity. A scytale reorders the marks on a strip of parchment and never looks at what they are, so this implementation accepts every byte: the message is written across a grid of 'circumference' columns and read off column by column, and the inverse puts it back. No byte is dropped, altered, case-folded or padded, and the round trip is exact for arbitrary input of any length.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Transposition Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Ancient Spartans |
| Year | -500 |
| Origin | 🏛️ Ancient |
| Source | [`algorithms/classical/scytale.js`](../../../algorithms/classical/scytale.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Scytale Cipher Wikipedia](https://en.wikipedia.org/wiki/Scytale)
- [Ancient Cryptography](http://practicalcryptography.com/ciphers/classical-era/scytale/)

## References

- [CrypTool 2 Scytale Plugin (open-source reference implementation)](https://github.com/CrypToolProject/CrypTool-2)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Circumference 3 over a message that does not fill the last row. The Wikipedia article works a different message, so it carries no value for this input](https://en.wikipedia.org/wiki/Scytale)

| Field | Value |
| --- | --- |
| `key` | `33` |
| `input` | `5745415245464f554e444f5554` |
| `expected` | `57524f44544545554f41464e55` |

**Vector 2** — [Circumference 4 over a message that fills the grid exactly. The Wikipedia article works a different message, so it carries no value for this input](https://en.wikipedia.org/wiki/Scytale)

| Field | Value |
| --- | --- |
| `key` | `34` |
| `input` | `41545441434b41544441574e` |
| `expected` | `414344544b4154415741544e` |

---

[← All algorithms](../README.md)
