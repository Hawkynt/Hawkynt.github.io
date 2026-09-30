# Polybius Square

> Ancient coordinate-based cipher system that converts letters to coordinate pairs using a 5×5 grid. Invented by Greek historian Polybius around 150 BCE for long-distance communication via torch signals. Forms foundation for many advanced classical ciphers.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Polybius |
| Year | -150 |
| Origin | Not specified |
| Source | [`algorithms/classical/polybius.js`](../../../algorithms/classical/polybius.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Frequency Analysis](https://en.wikipedia.org/wiki/Frequency_analysis) | Each letter always maps to same coordinate pair, preserving frequency patterns | Educational use only - provides no security by modern standards |
| [Pattern Recognition](https://en.wikipedia.org/wiki/Pattern_recognition) | Identical plaintext produces identical coordinate patterns making analysis easy | Historical demonstration cipher only |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Polybius_square)
- [Original Historical Account](https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Polybius/10*.html)
- [Cryptanalysis Methods](https://www.dcode.fr/polybius-cipher)

## References

- [DCode Implementation](https://www.dcode.fr/polybius-cipher)
- [Educational Tutorial](https://cryptii.com/pipes/polybius-square)
- [Tap Code History](https://en.wikipedia.org/wiki/Tap_code)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Plain A-Z square, row then column, both 1-indexed. The Wikipedia article works a different message, so it carries no value for this input](https://en.wikipedia.org/wiki/Polybius_square)

| Field | Value |
| --- | --- |
| `key` | _(empty)_ |
| `input` | `48454c4c4f` |
| `expected` | `3233203135203331203331203334` |

**Vector 2** — [Ancient Greek example](https://www.dcode.fr/polybius-cipher)

| Field | Value |
| --- | --- |
| `key` | _(empty)_ |
| `input` | `504f4c5942495553` |
| `expected` | `3335203334203331203534203132203234203435203433` |

**Vector 3** — [I/J equivalence test (J->I conversion)](https://cryptii.com/pipes/polybius-square)

| Field | Value |
| --- | --- |
| `key` | _(empty)_ |
| `input` | `49555354494345` |
| `expected` | `3234203435203433203434203234203133203135` |

---

[← All algorithms](../README.md)
