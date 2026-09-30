# Hill Cipher

> Classical polygraphic substitution cipher using linear algebra with matrix multiplication modulo 26. Encrypts blocks of letters using matrix operations. Invented by Lester S. Hill in 1929, requires matrix to be invertible mod 26.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Lester S. Hill |
| Year | 1929 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/classical/hill.js`](../../../algorithms/classical/hill.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Known Plaintext Attack](https://en.wikipedia.org/wiki/Known-plaintext_attack) | If enough plaintext-ciphertext pairs are known, the key matrix can be recovered using linear algebra | Requires n known plaintext blocks for n×n matrix, but still vulnerable |
| [Frequency Analysis](https://en.wikipedia.org/wiki/Frequency_analysis) | While more resistant than monoalphabetic ciphers, still vulnerable to advanced frequency analysis | Educational use only - modern ciphers provide much better security |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Hill_cipher)
- [Original Paper](https://www.jstor.org/stable/2269264)
- [Mathematical Background](https://en.wikipedia.org/wiki/Matrix_(mathematics))

## References

- [DCode Implementation](https://www.dcode.fr/hill-cipher)
- [Educational Tutorial](https://www.cs.uri.edu/cryptography/hillcipher.htm)
- [Matrix Algebra](https://www.khanacademy.org/math/algebra-home/alg-matrices)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Wikipedia worked 2x2 example - HELP under [[3,3],[2,5]]](https://en.wikipedia.org/wiki/Hill_cipher)

| Field | Value |
| --- | --- |
| `key` | `332c332c322c35` |
| `input` | `48454c50` |
| `expected` | `48494154` |

**Vector 2** — [Wikipedia worked 3x3 example - ACT under [[6,24,1],[13,16,10],[20,17,15]]](https://en.wikipedia.org/wiki/Hill_cipher)

| Field | Value |
| --- | --- |
| `key` | `362c32342c312c31332c31362c31302c32302c31372c3135` |
| `input` | `414354` |
| `expected` | `504f48` |

**Vector 3** — [Wikipedia worked 3x3 example - CAT under the same matrix](https://en.wikipedia.org/wiki/Hill_cipher)

| Field | Value |
| --- | --- |
| `key` | `362c32342c312c31332c31362c31302c32302c31372c3135` |
| `input` | `434154` |
| `expected` | `46494e` |

**Vector 4** — [Padding case - odd-length text filled out to the block size with X. No published source carries this value; it is here to keep the padding path covered](https://en.wikipedia.org/wiki/Hill_cipher)

| Field | Value |
| --- | --- |
| `key` | `332c322c352c37` |
| `input` | `48454c4c4f` |
| `expected` | `444c44434b58` |

---

[← All algorithms](../README.md)
