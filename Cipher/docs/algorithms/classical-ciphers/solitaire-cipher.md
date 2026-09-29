# Solitaire Cipher

> Bruce Schneier's card-based stream cipher designed for manual use without computer assistance from Neal Stephenson's Cryptonomicon. Input domain: uppercase A-Z only. The deck yields a keystream value of 1 to 26 which is added to a letter of the alphabet modulo 26; the pencil-and-paper procedure has the operator strip punctuation and case from the message before starting, and there is no card value that could carry a digit, a space or a high-bit byte. Anything outside A-Z is therefore refused by name and position rather than dropped, and A-Z round-trips exactly.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Bruce Schneier |
| Year | 1999 |
| Origin | 🇺🇸 United States |
| Restricted input domain | Yes |
| Source | [`algorithms/classical/solitaire.js`](../../../algorithms/classical/solitaire.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Solitaire Cipher Specification](https://www.schneier.com/academic/solitaire/)
- [Cryptonomicon Reference](https://en.wikipedia.org/wiki/Solitaire_(cipher))

## References

- [Schneier's Solitaire (Pontifex) Algorithm Description](https://www.schneier.com/academic/solitaire/)
- [kisom/solitaire - Pontifex Reference Implementation (C, GitHub)](https://github.com/kisom/solitaire/blob/master/src/pontifex.c)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Schneier sample 1 - unkeyed deck in bridge order, ten A's](https://www.schneier.com/academic/solitaire/)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141` |
| `expected` | `45584b59495a53474548` |

**Vector 2** — [Schneier sample 2 - deck keyed with the passphrase FOO, fifteen A's](https://www.schneier.com/academic/solitaire/)

| Field | Value |
| --- | --- |
| `key` | `464f4f` |
| `input` | `414141414141414141414141414141` |
| `expected` | `4954485a554a495747524641524d57` |

**Vector 3** — [Schneier sample 3 - deck keyed with CRYPTONOMICON, message SOLITAIRE padded to SOLITAIREX](https://www.schneier.com/academic/solitaire/)

| Field | Value |
| --- | --- |
| `key` | `43525950544f4e4f4d49434f4e` |
| `input` | `534f4c49544149524558` |
| `expected` | `4b4952414b53464a414e` |

---

[← All algorithms](../README.md)
