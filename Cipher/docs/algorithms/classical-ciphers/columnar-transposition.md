# Columnar Transposition

> Classical transposition cipher that arranges plaintext in a grid and reads columns in keyword-alphabetical order. Input domain: uppercase A-Z only. This is the complete form of the cipher, in which the final row of the grid is filled out with the letter X before the columns are read, so the alphabet has to be the one the padding letter belongs to and anything else is refused by name and position rather than dropped. Decryption removes trailing X again, which means a message that genuinely ends in X comes back short - the same ambiguity as zero padding, and the one thing here that is not an exact round trip.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Unknown (Classical) |
| Year | 1500 |
| Origin | Not specified |
| Restricted input domain | Yes |
| Source | [`algorithms/classical/columnar.js`](../../../algorithms/classical/columnar.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Wikipedia: Transposition Cipher](https://en.wikipedia.org/wiki/Transposition_cipher)
- [Educational Tool](https://www.dcode.fr/columnar-transposition-cipher)
- [Crypto Corner: Columnar Transposition Cipher](https://crypto.interactive-maths.com/columnar-transposition-cipher.html)

## References

- [pycipher columnartransposition.py (Python reference implementation)](https://github.com/jameslyons/pycipher/blob/master/pycipher/columnartransposition.py)
- [Practical Cryptography: Columnar Transposition Cipher](http://practicalcryptography.com/ciphers/columnar-transposition-cipher/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Three columns with a short last row filled out with X. No published source carries this value](https://en.wikipedia.org/wiki/Transposition_cipher)

| Field | Value |
| --- | --- |
| `key` | `4b4559` |
| `input` | `48454c4c4f` |
| `expected` | `454f484c4c58` |

**Vector 2** — [Keyword with a repeated letter - SECRET dedupes to five columns. No published source carries this value](https://www.dcode.fr/columnar-transposition-cipher)

| Field | Value |
| --- | --- |
| `key` | `534543524554` |
| `input` | `41545441434b41544441574e` |
| `expected` | `54545854414e414458414b57434158` |

**Vector 3** — [Single column - one column is no transposition at all and needs no padding](https://en.wikipedia.org/wiki/Transposition_cipher)

| Field | Value |
| --- | --- |
| `key` | `5a` |
| `input` | `41` |
| `expected` | `41` |

---

[← All algorithms](../README.md)
