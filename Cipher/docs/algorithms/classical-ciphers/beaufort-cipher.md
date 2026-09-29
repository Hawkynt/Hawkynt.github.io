# Beaufort Cipher

> Reciprocal polyalphabetic substitution cipher invented by Sir Francis Beaufort. Uses formula C = (K - P) mod 26 where encryption and decryption are identical operations. Variant of Vigenère cipher with reciprocal property. Input domain: every byte is accepted. A-Z and a-z are enciphered in place with their case preserved and advance the keyword; every other byte - digit, punctuation, whitespace, control or high-bit - is carried through unchanged and leaves the keyword position alone, which is the usual pen-and-paper convention and makes the round trip exact for arbitrary input. Nothing is ever discarded.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Sir Francis Beaufort |
| Year | 1857 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/classical/beaufort.js`](../../../algorithms/classical/beaufort.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Letter frequencies partially preserved, making frequency analysis effective on longer texts](https://en.wikipedia.org/wiki/Frequency_analysis) | — | Use only for educational demonstrations, not for actual security |
| [Repeating key patterns can be detected using Kasiski's method for determining key length](https://en.wikipedia.org/wiki/Kasiski_examination) | — | Consider as historical demonstration cipher only |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Beaufort_cipher)
- [Historical Background](https://en.wikipedia.org/wiki/Francis_Beaufort)
- [Cryptanalysis Methods](https://www.dcode.fr/beaufort-cipher)

## References

- [DCode Implementation](https://www.dcode.fr/beaufort-cipher)
- [Practical Cryptography](https://practicalcryptography.com/ciphers/classical-era/beaufort/)
- [Educational Examples](https://cryptii.com/pipes/beaufort-cipher)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Key shorter than the message. No published source carries this value](https://en.wikipedia.org/wiki/Beaufort_cipher)

| Field | Value |
| --- | --- |
| `key` | `4c454d4f4e` |
| `input` | `41545441434b41544441574e` |
| `expected` | `4c4c544f4c4245544c4e5052` |

**Vector 2** — [Educational Test Vector](https://www.dcode.fr/beaufort-cipher)

| Field | Value |
| --- | --- |
| `key` | `4b4559` |
| `input` | `48454c4c4f` |
| `expected` | `44414e5a51` |

**Vector 3** — [Reciprocal Property Test](https://practicalcryptography.com/ciphers/classical-era/beaufort/)

| Field | Value |
| --- | --- |
| `key` | `434950484552` |
| `input` | `42454155464f5254` |
| `expected` | `4245504e5a444c50` |

---

[← All algorithms](../README.md)
