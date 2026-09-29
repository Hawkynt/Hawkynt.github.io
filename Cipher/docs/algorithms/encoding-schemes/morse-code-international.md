# Morse Code (International)

> Method of transmitting text information as a series of on-off tones, lights, or clicks using standardized sequences of short and long signals called dots and dashes. Educational implementation following ITU-R M.1677-1 standard. ITU-R M.1677-1 only defines patterns for uppercase letters, digits, a fixed set of punctuation, and space; it has no case distinction and no representation for control characters or arbitrary binary data, so any other byte is rejected rather than silently mapped to '?' or case-folded.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Telegraph Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Samuel Morse |
| Year | 1836 |
| Origin | 🇺🇸 United States |
| Restricted input domain | Yes |
| Source | [`algorithms/encoding/morse.js`](../../../algorithms/encoding/morse.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [ITU-R M.1677-1: International Morse Code](https://www.itu.int/dms_pubrec/itu-r/rec/m/R-REC-M.1677-1-200910-I!!PDF-E.pdf)
- [Morse Code - Wikipedia](https://en.wikipedia.org/wiki/Morse_code)
- [International Telegraph Alphabet](https://en.wikipedia.org/wiki/Telegraph_code)

## References

- [Ham Radio Morse Code Standards](https://www.arrl.org/morse-code)
- [Educational Morse Code Examples](https://morsecode.world/international/morse.html)
- [GNU Radio Morse Implementation](https://github.com/gnuradio/gnuradio/tree/master/gr-digital/lib)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Morse empty string test](https://www.itu.int/dms_pubrec/itu-r/rec/m/R-REC-M.1677-1-200910-I!!PDF-E.pdf)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Single letter E test - ITU-R M.1677-1](https://en.wikipedia.org/wiki/Morse_code#Letters)

| Field | Value |
| --- | --- |
| `input` | `45` |
| `expected` | `2e` |

**Vector 3** — SOS distress signal test - Morse

Source: ITU-R M.1677-1 standard

| Field | Value |
| --- | --- |
| `input` | `534f53` |
| `expected` | `2e2e2e202d2d2d202e2e2e` |

**Vector 4** — Basic word encoding test - Morse

Source: Educational standard

| Field | Value |
| --- | --- |
| `input` | `48454c4c4f` |
| `expected` | `2e2e2e2e202e202e2d2e2e202e2d2e2e202d2d2d` |

**Vector 5** — [Exact-spacing and prosign-collision regression test - a doubled space must round-trip exactly (previous word-splitting collapsed runs of whitespace), and '&'/'='/'(' must decode back to themselves rather than to a same-pattern prosign](https://en.wikipedia.org/wiki/Morse_code)

| Field | Value |
| --- | --- |
| `input` | `534f532020263d28` |
| `expected` | `2e2e2e202d2d2d202e2e2e202f202f20 2e2d2e2e2e202d2e2e2e2d202d2e2d2d 2e` |

---

[← All algorithms](../README.md)
