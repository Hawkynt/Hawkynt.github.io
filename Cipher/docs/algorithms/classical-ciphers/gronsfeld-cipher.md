# Gronsfeld Cipher

> Polyalphabetic substitution cipher using numeric key instead of letters. Each digit represents Caesar shift value, making it Vigenère variant with reduced key space. Named after Count of Gronsfeld in 16th century.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Count of Gronsfeld |
| Year | 1518 |
| Origin | 🇳🇱 Netherlands |
| Source | [`algorithms/classical/gronsfeld.js`](../../../algorithms/classical/gronsfeld.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Repeated patterns in ciphertext reveal key length, enabling frequency analysis like Vigenère](https://en.wikipedia.org/wiki/Kasiski_examination) | — | None - fundamental weakness of polyalphabetic substitution |
| [Only 10 possible shifts (0-9) compared to 26 for Vigenère, making brute force easier](http://practicalcryptography.com/ciphers/classical-era/gronsfeld/) | — | Use only for educational demonstrations |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Gronsfeld_cipher)
- [Historical Context](http://practicalcryptography.com/ciphers/classical-era/gronsfeld/)
- [Cryptanalysis Methods](https://en.wikipedia.org/wiki/Kasiski_examination)

## References

- [Educational Implementation](https://www.dcode.fr/gronsfeld-cipher)
- [CryptoCrack Examples](https://sites.google.com/site/cryptocrackprogram/user-guide/cipher-types/substitution/gronsfeld)
- [Practical Cryptography](http://practicalcryptography.com/ciphers/classical-era/gronsfeld/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Traditional Gronsfeld example with simple numeric key](https://sites.google.com/site/cryptocrackprogram/user-guide/cipher-types/substitution/gronsfeld)

| Field | Value |
| --- | --- |
| `key` | `3331343135` |
| `input` | `444546454e445448454541535457414c4c4f46544845434153544c45` |
| `expected` | `47464a465347554c464a44545858464f4d5347594b46474258574d49` |

**Vector 2** — [Military communication example](http://practicalcryptography.com/ciphers/classical-era/gronsfeld/)

| Field | Value |
| --- | --- |
| `key` | `31323334` |
| `input` | `41545441434b41544441574e` |
| `expected` | `42565745444d445845435a52` |

**Vector 3** — [Basic alphabet transformation test](https://cryptii.com/pipes/gronsfeld-cipher)

| Field | Value |
| --- | --- |
| `key` | `3132333435` |
| `input` | `4142434445464748494a4b4c4d4e4f505152535455565758595a` |
| `expected` | `424446484a47494b4d4f4c4e505254515355575956585a424441` |

**Vector 4** — [Single digit key test - equivalent to Caesar](https://www.dcode.fr/gronsfeld-cipher)

| Field | Value |
| --- | --- |
| `key` | `33` |
| `input` | `48454c4c4f` |
| `expected` | `4b484f4f52` |

**Vector 5** — [Mixed case text with spaces](https://www.dcode.fr/gronsfeld-cipher)

| Field | Value |
| --- | --- |
| `key` | `3132333435` |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `49676f7074205871757069` |

---

[← All algorithms](../README.md)
