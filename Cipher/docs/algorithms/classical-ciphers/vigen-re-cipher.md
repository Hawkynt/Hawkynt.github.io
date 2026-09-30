# Vigenère Cipher

> Classical polyalphabetic substitution cipher using repeating keyword to shift letters. Developed by Blaise de Vigenère in 16th century, considered unbreakable for centuries until Kasiski examination was developed. Uses Caesar cipher with different shift for each position. Input domain: every byte is accepted. A-Z and a-z are enciphered in place with their case preserved and advance the keyword; every other byte - digit, punctuation, whitespace, control or high-bit - is carried through unchanged and leaves the keyword position alone, which is the usual pen-and-paper convention and makes the round trip exact for arbitrary input. Nothing is ever discarded.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Blaise de Vigenère |
| Year | 1553 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/classical/vigenere.js`](../../../algorithms/classical/vigenere.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Kasiski Examination](https://en.wikipedia.org/wiki/Kasiski_examination) | Repeated patterns in ciphertext reveal keyword length, enabling frequency analysis | None - fundamental weakness of polyalphabetic substitution |
| [Index of Coincidence](https://en.wikipedia.org/wiki/Index_of_coincidence) | Statistical analysis can determine keyword length and enable cryptanalysis | Use only for educational demonstrations |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Vigen%C3%A8re_cipher)
- [Historical Context](https://en.wikipedia.org/wiki/Blaise_de_Vigen%C3%A8re)
- [Cryptanalysis Methods](https://en.wikipedia.org/wiki/Kasiski_examination)

## References

- [Educational Implementation](https://www.dcode.fr/vigenere-cipher)
- [Interactive Tutorial](https://cryptii.com/pipes/vigenere-cipher)
- [Practical Cryptography](https://practicalcryptography.com/ciphers/classical-era/vigenere-gronsfeld-and-autokey/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Classic Vigenère example from textbooks](https://www.dcode.fr/vigenere-cipher)

| Field | Value |
| --- | --- |
| `key` | `4c454d4f4e` |
| `input` | `41545441434b41544441574e` |
| `expected` | `4c58464f50564546524e4852` |

**Vector 2** — [GeeksforGeeks educational example](https://www.geeksforgeeks.org/vigenere-cipher/)

| Field | Value |
| --- | --- |
| `key` | `4159555348` |
| `input` | `4745454b53464f524745454b53` |
| `expected` | `474359435a464d4c594c45494d` |

**Vector 3** — [Trinity College Computer Science example](https://www.cs.tcd.ie/courses/bacsf/4ba2.05/crypto/vigenere.html)

| Field | Value |
| --- | --- |
| `key` | `52454c4154494f4e53` |
| `input` | `544f42454f524e4f54544f42455448415449535448455155455354494f4e` |
| `expected` | `4b534d45485a42424c4b534d454d504f47414a5853454a4353464c5a5359` |

**Vector 4** — [Short key pattern test](https://practicalcryptography.com/ciphers/classical-era/vigenere-gronsfeld-and-autokey/)

| Field | Value |
| --- | --- |
| `key` | `41424344` |
| `input` | `43525950544f495353484f5254464f5243525950544f475241504859` |
| `expected` | `4353415354504b565349515554475155435341535450495541514a42` |

**Vector 5** — [Classic pangram with simple key](https://www.dcode.fr/vigenere-cipher)

| Field | Value |
| --- | --- |
| `key` | `4b4559` |
| `input` | `544845515549434b42524f574e464f58 4a554d50534f5645525448454c415a59 444f47` |
| `expected` | `444c434159474d4f5a425355584a4d48 4e53575451595a434258464f50594a43 42594b` |

---

[← All algorithms](../README.md)
