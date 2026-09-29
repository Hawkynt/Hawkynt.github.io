# BinHex 4.0 (Macintosh)

> Binary-to-text encoding system used on classic Mac OS for sending binary files over email. Includes run-length encoding and CRC protection for Macintosh file forks. Educational implementation based on Yves Lempereur's original BinHex 4.0 specification.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | File Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Yves Lempereur |
| Year | 1985 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/encoding/binhex.js`](../../../algorithms/encoding/binhex.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [BinHex 4.0 Definition](https://files.stairways.com/other/binhex-40-specs-info.txt)
- [RFC 1741: MIME Content Type for BinHex](https://tools.ietf.org/html/rfc1741)
- [Macintosh File System](https://en.wikipedia.org/wiki/Macintosh_file_system)

## References

- [Classic Mac OS](https://en.wikipedia.org/wiki/Classic_Mac_OS)
- [Apple File Exchange](https://www.apple.com/)
- [Binary Encoding History](https://www.mactech.com/articles/mactech/Vol.02/02.12/BinHex/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — BinHex empty file test

Source: BinHex 4.0 specification

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `28546869732066696c65206d75737420 626520636f6e76657274656420776974 682042696e48657820342e30290a3a0a 3a` |

**Vector 2** — Basic BinHex encoding test

Source: Educational example

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f` |
| `expected` | `28546869732066696c65206d75737420 626520636f6e76657274656420776974 682042696e48657820342e30290a3a35 27395845276d210a3a` |

---

[← All algorithms](../README.md)
