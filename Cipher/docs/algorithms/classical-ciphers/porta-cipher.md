# Porta Cipher

> Reciprocal polyalphabetic substitution cipher invented by Giovan Battista Bellaso in 1563. Uses 13-row substitution tableau where same operation encrypts and decrypts. Key feature is reciprocal property making it self-inverse.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Giovan Battista Bellaso |
| Year | 1563 |
| Origin | 🇮🇹 Italy |
| Source | [`algorithms/classical/porta.js`](../../../algorithms/classical/porta.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Period Analysis](https://en.wikipedia.org/wiki/Kasiski_examination) | Short keys create detectable repeating patterns vulnerable to Kasiski examination | Use longer, non-repeating keys |
| [Limited Alphabets](https://en.wikipedia.org/wiki/Porta_cipher#Security) | Only 13 effective substitution alphabets vs 26 in full polyalphabetic ciphers | Educational use only - not suitable for actual security |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Porta_cipher)
- [Historical Context](https://archive.org/details/lacifradelsiggio00bell)
- [Educational Tutorial](https://cryptii.com/pipes/porta-cipher)

## References

- [dCode Implementation](https://www.dcode.fr/porta-cipher)
- [Practical Cryptography](https://practicalcryptography.com/ciphers/classical-era/porta/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Practical Cryptography worked example - DEFENDTHEEASTWALLOFTHECASTLE under FORTIFICATION](http://practicalcryptography.com/ciphers/porta-cipher/)

| Field | Value |
| --- | --- |
| `key` | `464f5254494649434154494f4e` |
| `input` | `444546454e445448454541535457414c4c4f46544845434153544c45` |
| `expected` | `53594e4e4a534356524e524c41485554554b5543565259524c414e59` |

**Vector 2** — [Reciprocity - the same worked example run again on its own ciphertext returns the plaintext](http://practicalcryptography.com/ciphers/porta-cipher/)

| Field | Value |
| --- | --- |
| `key` | `464f5254494649434154494f4e` |
| `input` | `53594e4e4a534356524e524c41485554554b5543565259524c414e59` |
| `expected` | `444546454e445448454541535457414c4c4f46544845434153544c45` |

**Vector 3** — [First row of the published tableau read straight off - key letter A pairs A-M with N-Z](http://practicalcryptography.com/ciphers/porta-cipher/)

| Field | Value |
| --- | --- |
| `key` | `41` |
| `input` | `4142434445464748494a4b4c4d4e4f505152535455565758595a` |
| `expected` | `4e4f505152535455565758595a4142434445464748494a4b4c4d` |

---

[← All algorithms](../README.md)
