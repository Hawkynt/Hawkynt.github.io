# ROT

> ROT (rotate) character substitution cipher that shifts characters by a fixed offset. ROT13 shifts letters by 13 positions, ROT47 shifts printable ASCII by 47. Self-inverting cipher for educational purposes.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Character Substitution |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (folklore origin) |
| Year | 1980 |
| Origin | 🌐 International |
| Source | [`algorithms/encoding/rot.js`](../../../algorithms/encoding/rot.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Provides no cryptographic security | — | — |
| Trivially broken by frequency analysis | — | — |
| Preserves word boundaries and punctuation | — | — |
| Educational use only - not for actual data protection | — | — |

## Documentation

- [ROT13 - Wikipedia](https://en.wikipedia.org/wiki/ROT13)
- [Caesar Cipher Family](https://en.wikipedia.org/wiki/Caesar_cipher)
- [RFC 1036 - Usenet ROT13](https://tools.ietf.org/html/rfc1036#section-5.2)

## References

- [UNIX tr Command](https://www.gnu.org/software/coreutils/manual/html_node/tr-invocation.html)
- [Python ROT13 Codec](https://docs.python.org/3/library/codecs.html#text-encodings)
- [ROT47 Specification](https://en.wikipedia.org/wiki/ROT13#Variants)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ROT13 empty string test](https://en.wikipedia.org/wiki/ROT13)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [ROT13 single uppercase letter test](https://en.wikipedia.org/wiki/ROT13)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `4e` |

**Vector 3** — [ROT13 single lowercase letter test](https://en.wikipedia.org/wiki/ROT13)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `6e` |

**Vector 4** — [ROT13 uppercase word test](https://en.wikipedia.org/wiki/ROT13)

| Field | Value |
| --- | --- |
| `input` | `48454c4c4f` |
| `expected` | `5552595942` |

**Vector 5** — [ROT13 lowercase word test](https://en.wikipedia.org/wiki/ROT13)

| Field | Value |
| --- | --- |
| `input` | `68656c6c6f` |
| `expected` | `7572797962` |

**Vector 6** — [ROT13 mixed case with punctuation test](https://en.wikipedia.org/wiki/ROT13)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f2c20576f726c6421` |
| `expected` | `55727979622c204a6265797121` |

**Vector 7** — [ROT13 pangram test](https://en.wikipedia.org/wiki/ROT13)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e` |
| `expected` | `477572206468767078206f65626a6120 73626b2077687a636620626972652067 757220796e6d6c207162742e` |

---

[← All algorithms](../README.md)
