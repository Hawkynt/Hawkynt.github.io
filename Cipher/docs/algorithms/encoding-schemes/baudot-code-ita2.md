# Baudot Code (ITA2)

> 5-bit character encoding used in early teleprinters and telegraph systems. Uses two modes (LETTERS and FIGURES) selected by special shift characters. Educational implementation of International Telegraph Alphabet No. 2 (ITA2/CCITT-2). ITA2 has only 32 five-bit code points per mode and no concept of letter case, so it can only represent the exact uppercase letters, digits, and punctuation listed in its LETTERS/FIGURES tables (plus space, CR, LF and NUL) - any other byte, including lowercase letters and arbitrary binary data, is rejected rather than silently folded or dropped.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Telegraph Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Émile Baudot |
| Year | 1874 |
| Origin | 🇫🇷 France |
| Restricted input domain | Yes |
| Source | [`algorithms/encoding/baudot.js`](../../../algorithms/encoding/baudot.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [ITU-T Recommendation F.1](https://www.itu.int/rec/T-REC-F.1/)
- [CCITT-2 (ITA2) Specification](https://en.wikipedia.org/wiki/Baudot_code)
- [Telegraph History](https://en.wikipedia.org/wiki/Electrical_telegraph)

## References

- [International Telegraph Alphabet](https://en.wikipedia.org/wiki/Telegraph_code)
- [Early Teleprinter Systems](https://www.computerhistory.org/revolution/computer-communications/)
- [Baudot Code Analysis](https://www.dcode.fr/baudot-code)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Baudot empty string test](https://en.wikipedia.org/wiki/Baudot_code)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Single letter A test - Baudot ITA2](https://www.dcode.fr/baudot-code)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `03` |

**Vector 3** — Letter E encoding test - Baudot

Source: ITU-T F.1 standard

| Field | Value |
| --- | --- |
| `input` | `45` |
| `expected` | `01` |

**Vector 4** — [NUL-A-NUL regression test - code point 0 ('\0') must round-trip; it was previously unencodable because '\0' is falsy in JavaScript](https://en.wikipedia.org/wiki/Baudot_code)

| Field | Value |
| --- | --- |
| `input` | `004100` |
| `expected` | `000300` |

---

[← All algorithms](../README.md)
