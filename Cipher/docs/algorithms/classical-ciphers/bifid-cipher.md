# Bifid Cipher

> Fractionating cipher invented by Félix Delastelle in 1901. Combines Polybius square with transposition, replacing each letter with two coordinates then rearranging them in blocks. Significantly stronger than simple substitution ciphers.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Félix Delastelle |
| Year | 1901 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/classical/bifid.js`](../../../algorithms/classical/bifid.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Frequency Analysis](https://en.wikipedia.org/wiki/Bifid_cipher#Cryptanalysis) | While more resistant than monoalphabetic ciphers, still vulnerable to frequency analysis with sufficient text | Use variable block sizes and longer keywords |
| [Grid Recovery](https://practicalcryptography.com/ciphers/classical-era/bifid/) | Custom keyword grids can sometimes be recovered through cryptanalysis | Educational use only - not suitable for actual security |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Bifid_cipher)
- [Historical Context](https://en.wikipedia.org/wiki/F%C3%A9lix_Delastelle)
- [Educational Tutorial](https://www.dcode.fr/bifid-cipher)

## References

- [dCode Implementation](https://www.dcode.fr/bifid-cipher)
- [Practical Cryptography](https://practicalcryptography.com/ciphers/classical-era/bifid/)
- [CrypTool Portal](https://www.cryptool.org/en/cto/bifid)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Wikipedia worked example - square BGWKZ/QPNDS/IOAXE/FCLUM/THYVR, FLEEATONCE taken as one block](https://en.wikipedia.org/wiki/Bifid_cipher)

| Field | Value |
| --- | --- |
| `key` | `4247574b5a51504e4453494f41584546434c554d54485956522c3130` |
| `input` | `464c454541544f4e4345` |
| `expected` | `5541454f4c5752494e53` |

**Vector 2** — [Plain A-Z square, period 5. The Wikipedia article carries no value for this input; the vector covers the unkeyed square](https://en.wikipedia.org/wiki/Bifid_cipher)

| Field | Value |
| --- | --- |
| `key` | `35` |
| `input` | `48454c4c4f` |
| `expected` | `464e4e5644` |

**Vector 3** — [Keyword CIPHER, period 3. dCode carries no value for this input; the vector covers a keyed square and a block shorter than the message](https://www.dcode.fr/bifid-cipher)

| Field | Value |
| --- | --- |
| `key` | `4349504845522c33` |
| `input` | `41545441434b` |
| `expected` | `445154524b49` |

**Vector 4** — [Period 1 - a single-letter block is its own coordinate pair, so one letter passes through unchanged](https://en.wikipedia.org/wiki/Bifid_cipher)

| Field | Value |
| --- | --- |
| `key` | `31` |
| `input` | `41` |
| `expected` | `41` |

---

[← All algorithms](../README.md)
