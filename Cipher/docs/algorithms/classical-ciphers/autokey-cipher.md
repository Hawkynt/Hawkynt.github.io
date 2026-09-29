# Autokey Cipher

> Enhanced Vigenère cipher that extends the key using plaintext itself, eliminating periodic key repetition. Uses initial keyword plus plaintext letters to create non-repeating key sequence. More secure than standard Vigenère. Input domain: every byte is accepted. A-Z and a-z are enciphered in place with their case preserved and are the only bytes that extend the running key, which uses their uppercase form; every other byte - digit, punctuation, whitespace, control or high-bit - is carried through unchanged and takes no part in the key, which is the usual pen-and-paper convention and makes the round trip exact for arbitrary input. Nothing is ever discarded.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Blaise de Vigenère |
| Year | 1586 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/classical/autokey.js`](../../../algorithms/classical/autokey.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [If portion of plaintext is known, can recover key and decrypt remainder of message](https://en.wikipedia.org/wiki/Known-plaintext_attack) | — | Avoid predictable beginnings or known phrases |
| [While more secure than Vigenère, still vulnerable to advanced statistical attacks](https://en.wikipedia.org/wiki/Autokey_cipher#Cryptanalysis) | — | Educational use only |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Autokey_cipher)
- [Original Vigenère Work](https://gallica.bnf.fr/ark:/12148/bpt6k5493743)
- [Cryptanalysis Methods](https://www.dcode.fr/autokey-cipher)

## References

- [DCode Implementation](https://www.dcode.fr/autokey-cipher)
- [Cryptii Educational Tool](https://cryptii.com/pipes/autokey-cipher)
- [Practical Cryptography](https://practicalcryptography.com/ciphers/classical-era/autokey/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Classic Autokey Example](https://www.dcode.fr/autokey-cipher)

| Field | Value |
| --- | --- |
| `key` | `4c454d4f4e` |
| `input` | `41545441434b41544441574e` |
| `expected` | `4c58464f504b544d4443474e` |

**Vector 2** — [Educational Test Vector](https://practicalcryptography.com/ciphers/classical-era/autokey/)

| Field | Value |
| --- | --- |
| `key` | `4b4559` |
| `input` | `48454c4c4f` |
| `expected` | `52494a5353` |

**Vector 3** — [DCode Reference](https://www.dcode.fr/autokey-cipher)

| Field | Value |
| --- | --- |
| `key` | `4155544f4b4559` |
| `input` | `44434f4445` |
| `expected` | `445748524f` |

---

[← All algorithms](../README.md)
